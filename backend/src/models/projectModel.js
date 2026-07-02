import { getClient } from '../config/db.js';

const createProjectWithVariables = async (projectData) => {
  const {
    projectName, clientName, contactNumber, dateOrdered,
    clientPayment, priorityLevel, dueDate, projectDetails
  } = projectData;

  console.log("Creating project with data:", projectData);

  const client = await getClient();

  try {
    await client.query('BEGIN'); 
    const projectInsertQuery = `
      INSERT INTO projects (project_name, client_name, contact_number, date_ordered, client_payment, priority_level, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const projectValues = [projectName, clientName, contactNumber, dateOrdered, clientPayment, priorityLevel, dueDate];
    console.log("Project values:", projectValues);
    const projectRes = await client.query(projectInsertQuery, projectValues);
    const projectId = projectRes.rows[0].id;
    console.log("Project ID:", projectId);

    if (projectDetails && projectDetails.length > 0) {
      const variableInsertQuery = `
        INSERT INTO project_variables (project_id, variable_name, variable_detail)
        VALUES ($1, $2, $3);
      `;
      for (const variable of projectDetails) {
        // Only insert if the variable actually has a name typed in
        if (variable.name && variable.name.trim() !== '') {
           await client.query(variableInsertQuery, [projectId, variable.name, variable.detail]);
        }
      }
    }

    await client.query('COMMIT'); 
    return projectId;
  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error("Error in createProjectWithVariables:", error);
    throw error;
  } finally {
    client.release();
  }
};


// PROJECT LIST

// PROJECT LIST
const getAllProjects = async () => {
  const client = await getClient();
  try {
    // Binago natin ang query para mag-check sa job_assignments table
    const query = `
      SELECT 
        p.id, 
        p.project_name, 
        p.client_name, 
        p.contact_number, 
        p.client_payment, 
        p.due_date, 
        p.priority_level,
        CASE 
            WHEN p.status = 'Completed' THEN 'Completed'
            WHEN EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.project_id = p.id) THEN 'In Progress'
            ELSE COALESCE(p.status, 'Pending')
        END as status
      FROM projects p
      ORDER BY p.created_at DESC;
    `;
    const res = await client.query(query);
    
    // Wala na yung .map() dito dahil database na ang bahala sa pag-compute ng tamang status!
    return res.rows;
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

// EDIT PROJECT

const getProjectById = async (id) => {
  const client = await getClient();
  try {
    const projectRes = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    const variablesRes = await client.query('SELECT * FROM project_variables WHERE project_id = $1', [id]);
    
    if (projectRes.rows.length === 0) return null;

    return {
      ...projectRes.rows[0],
      variables: variablesRes.rows
    };
  } finally {
    client.release();
  }
};

const updateProject = async (id, projectData) => {
  const {
    projectName, clientName, contactNumber, dateOrdered,
    clientPayment, priorityLevel, dueDate, projectDetails
  } = projectData;

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const updateQuery = `
      UPDATE projects 
      SET project_name = $1, client_name = $2, contact_number = $3, 
          date_ordered = $4, client_payment = $5, priority_level = $6, due_date = $7
      WHERE id = $8
    `;
    await client.query(updateQuery, [
      projectName, clientName, contactNumber, dateOrdered, 
      clientPayment, priorityLevel, dueDate, id
    ]);

    await client.query('DELETE FROM project_variables WHERE project_id = $1', [id]);

    if (projectDetails && projectDetails.length > 0) {
      const variableInsertQuery = `
        INSERT INTO project_variables (project_id, variable_name, variable_detail)
        VALUES ($1, $2, $3);
      `;
      for (const variable of projectDetails) {
        if (variable.name.trim() !== '') {
           await client.query(variableInsertQuery, [id, variable.name, variable.detail]);
        }
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};


const markProjectAsCompleted = async (projectId) => {
    const client = await getClient();
    try {
        const sql = `
            UPDATE projects 
            SET status = 'Completed', date_completed = CURRENT_DATE -- <--- IDINAGDAG ITO
            WHERE id = $1 
            RETURNING *;
        `;
        const res = await client.query(sql, [projectId]);
        return res.rows[0];
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

const getCompletedProjectsHistory = async () => {
    const client = await getClient();
    try {
        const query = `
            SELECT 
                id, 
                project_name, 
                date_ordered AS date_started, 
                date_completed, 
                due_date
            FROM projects
            WHERE status = 'Completed'
            ORDER BY date_completed DESC;
        `;
        const res = await client.query(query);
        return res.rows;
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

const deleteProjectById = async (id) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Delete associated variables first due to foreign keys
    await client.query('DELETE FROM project_variables WHERE project_id = $1', [id]);

    // 2. Optional: If you want to delete associated job assignments as well, uncomment below:
    // await client.query('DELETE FROM job_assignments WHERE project_id = $1', [id]);

    // 3. Delete the actual project record
    const res = await client.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);

    await client.query('COMMIT');
    return res.rows.length > 0; // returns true if a row was deleted
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export {
  createProjectWithVariables,
  getAllProjects,
  getProjectById,
  updateProject,
  markProjectAsCompleted,
  getCompletedProjectsHistory,
  deleteProjectById
}
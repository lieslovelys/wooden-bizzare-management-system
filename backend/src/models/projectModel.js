import { getClient } from '../config/db.js';

export const createProjectWithVariables = async (projectData) => {
  const {
    projectName, clientName, contactNumber, dateOrdered,
    clientPayment, priorityLevel, dueDate, projectDetails
  } = projectData;

  const client = await getClient();

  try {
    await client.query('BEGIN'); 
    const projectInsertQuery = `
      INSERT INTO projects (project_name, client_name, contact_number, date_ordered, client_payment, priority_level, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const projectValues = [projectName, clientName, contactNumber, dateOrdered, clientPayment, priorityLevel, dueDate];
    const projectRes = await client.query(projectInsertQuery, projectValues);
    const projectId = projectRes.rows[0].id;

    if (projectDetails && projectDetails.length > 0) {
      const variableInsertQuery = `
        INSERT INTO project_variables (project_id, variable_name, variable_detail)
        VALUES ($1, $2, $3);
      `;
      for (const variable of projectDetails) {
        // Only insert if the variable actually has a name typed in
        if (variable.name.trim() !== '') {
           await client.query(variableInsertQuery, [projectId, variable.name, variable.detail]);
        }
      }
    }

    await client.query('COMMIT'); 
    return projectId;
  } catch (error) {
    await client.query('ROLLBACK'); 
    throw error;
  } finally {
    client.release();
  }
};


// PROJECT LIST

export const getAllProjects = async () => {
  const client = await getClient();
  try {
    const query = `
      SELECT 
        id, 
        project_name, 
        client_name, 
        contact_number, 
        client_payment, 
        due_date, 
        priority_level,
        status -- <--- IDINAGDAG ANG STATUS DITO
      FROM projects
      ORDER BY created_at DESC;
    `;
    const res = await client.query(query);
    return res.rows;
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

// EDIT PROJECT

export const getProjectById = async (id) => {
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

export const updateProject = async (id, projectData) => {
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


export const markProjectAsCompleted = async (projectId) => {
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

export const getCompletedProjectsHistory = async () => {
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
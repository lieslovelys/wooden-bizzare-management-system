import { query } from '../config/db.js'; 

export const getAllJobOrders = async () => {
    const sqlString = `
        SELECT id, project_name, due_date, priority_level, status
        FROM projects
        WHERE status != 'Completed' OR status IS NULL
        ORDER BY due_date ASC;
    `;
    const { rows } = await query(sqlString);
    return rows;
};

export const getJobOrderById = async (projectId) => {
    const projectSql = `SELECT * FROM projects WHERE id = $1`;
    const projectResult = await query(projectSql, [projectId]);

    if (projectResult.rows.length === 0) {
        return null; 
    }

    const projectData = projectResult.rows[0];

    const variablesSql = `
        SELECT id, variable_name, variable_detail 
        FROM project_variables 
        WHERE project_id = $1
        ORDER BY id ASC
    `;
    const variablesResult = await query(variablesSql, [projectId]);

    return {
        ...projectData,
        variables: variablesResult.rows
    };
};

export const getWorkers = async () => {
    const sql = `
        SELECT u.user_id, u.first_name, u.last_name, w.job_role, w.photo, w.job_type
        FROM users u
        LEFT JOIN worker_details w ON u.user_id = w.user_id
        WHERE u.user_role = 'Worker'
    `;
    const { rows } = await query(sql);
    return rows;
};

export const getProjectAssignments = async (projectId) => {
    const sql = `
        SELECT j.assignment_id, j.stage_name, j.start_date, j.due_date, j.date_completed, j.status,
               u.first_name, u.last_name
        FROM job_assignments j
        LEFT JOIN users u ON j.worker_id = u.user_id
        WHERE j.project_id = $1
        ORDER BY j.assignment_id ASC
    `;
    const { rows } = await query(sql, [projectId]);
    return rows;
};


export const createJobAssignment = async (projectId, workerId, stageName, startDate, dueDate) => {
    try {

        const insertSql = `
            INSERT INTO job_assignments (project_id, worker_id, stage_name, start_date, due_date, status)
            VALUES ($1, $2, $3, $4, $5, 'Assigned')
            RETURNING *;
        `;
        const { rows } = await query(insertSql, [projectId, workerId, stageName, startDate, dueDate]);


        const updateProjSql = `
            UPDATE projects 
            SET status = 'In Progress' 
            WHERE id = $1;
        `;
        await query(updateProjSql, [projectId]);

        return rows[0];
    } catch (error) {
        console.error("DATABASE ERROR in createJobAssignment:", error.message);
        throw error;
    }
};

export const getTasksByWorkerId = async (workerId) => {
    try {
        const sql = `
            SELECT 
                ja.assignment_id,
                p.id AS project_id,
                p.project_name,
                ja.due_date,
                p.priority_level AS priority,
                ja.status,
                ja.stage_name
            FROM job_assignments ja
            JOIN projects p ON ja.project_id = p.id
            WHERE ja.worker_id = $1
            ORDER BY ja.due_date ASC
        `;
        const { rows } = await query(sql, [workerId]);
        return rows;
    } catch (error) {
        console.error("DATABASE ERROR in getTasksByWorkerId:", error.message);
        throw error;
    }
};


export const getTasksForQA = async () => {
    try {
        const sql = `
            SELECT 
                ja.assignment_id,
                p.id AS project_id,
                p.project_name,
                ja.due_date,
                p.priority_level,
                ja.status,
                ja.stage_name,
                u.first_name,
                u.last_name
            FROM job_assignments ja
            LEFT JOIN projects p ON ja.project_id = p.id
            LEFT JOIN users u ON ja.worker_id = u.user_id 
            WHERE ja.status::text ILIKE 'For QA'
            ORDER BY ja.due_date ASC
        `;
        const { rows } = await query(sql);
        return rows;
    } catch (error) {
        console.error("DATABASE ERROR in getTasksForQA:", error.message);
        throw error;
    }
};

export const updateAssignmentStatus = async (assignmentId, newStatus) => {
    try {
        let sql;

        if (newStatus === 'Approved') {
            sql = `
                UPDATE job_assignments 
                SET status = $1, date_completed = CURRENT_DATE 
                WHERE assignment_id = $2 RETURNING *
            `;
        } 
        // --- BAGONG LOGIC PARA KAY WORKER (date_submitted) ---
        else if (newStatus === 'For QA') {
            sql = `
                UPDATE job_assignments 
                SET status = $1, date_submitted = CURRENT_DATE 
                WHERE assignment_id = $2 RETURNING *
            `;
        }
        // -----------------------------------------------------
        else {
            sql = `
                UPDATE job_assignments 
                SET status = $1 
                WHERE assignment_id = $2 RETURNING *
            `;
        }

        const { rows } = await query(sql, [newStatus, assignmentId]);
        return rows[0];

    } catch (error) {
        console.error("DATABASE ERROR in updateAssignmentStatus:", error.message);
        throw error;
    }
};

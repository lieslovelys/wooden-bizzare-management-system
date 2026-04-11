import { query } from '../config/db.js'; 

export const getDashboardStats = async () => {

    const projectsQuery = `
        SELECT COUNT(*) 
        FROM projects 
        WHERE status IS NULL 
           OR LOWER(status) NOT IN ('completed', 'done')
    `;
    const projectsResult = await query(projectsQuery);
    

    const workersResult = await query("SELECT COUNT(*) FROM users WHERE user_role = 'Worker'");

    return {
        activeProjects: parseInt(projectsResult.rows[0].count, 10),
        totalWorkers: parseInt(workersResult.rows[0].count, 10)
    };
};
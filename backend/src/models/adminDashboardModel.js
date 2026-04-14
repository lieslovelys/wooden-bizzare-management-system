import { query } from '../config/db.js'; 

export const getDashboardStats = async () => {
    // Since 'status' column may not exist, count all projects
    const projectsResult = await query("SELECT COUNT(*) FROM projects");
    
    const workersResult = await query("SELECT COUNT(*) FROM users WHERE user_role = 'Worker'");

    return {
        activeProjects: parseInt(projectsResult.rows[0].count, 10),
        totalWorkers: parseInt(workersResult.rows[0].count, 10)
    };
};
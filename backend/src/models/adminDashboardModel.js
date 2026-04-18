import { query } from '../config/db.js'; 

export const getDashboardStats = async () => {
    // 1. Active Projects Query
    const projectsQuery = `
        SELECT COUNT(*) 
        FROM projects 
        WHERE status IS NULL 
           OR LOWER(status) NOT IN ('completed', 'done')
    `;
    const projectsResult = await query(projectsQuery);
    
    // 2. Total Workers Query
    const workersResult = await query("SELECT COUNT(*) FROM users WHERE user_role = 'Worker'");

    // 3. Monthly Profit Query (BAGONG DAGDAG)
    // Kinukuha nito ang total profit ngayong kasalukuyang buwan at taon.
    const profitQuery = `
        SELECT COALESCE(SUM(net_profit), 0) AS total_monthly_profit
        FROM project_profit
        WHERE EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM updated_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    `;
    const profitResult = await query(profitQuery);

    // Ibinabalik ang tatlong stats nang sabay-sabay
    return {
        activeProjects: parseInt(projectsResult.rows[0].count, 10),
        totalWorkers: parseInt(workersResult.rows[0].count, 10),
        monthlyProfit: parseFloat(profitResult.rows[0].total_monthly_profit)
    };
};
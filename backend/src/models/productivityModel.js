import { query } from '../config/db.js'; 

export const getWorkerProductivity = async () => {
    const sql = `
        SELECT 
            u.user_id,
            u.first_name || ' ' || u.last_name AS worker_name,
            wd.job_role,
            wd.job_type,
            
            -- Bilangin ang Early, On-Time, at Late
            COUNT(CASE WHEN ja.date_submitted < ja.due_date THEN 1 END) AS early_count,
            COUNT(CASE WHEN ja.date_submitted = ja.due_date THEN 1 END) AS on_time_count,
            COUNT(CASE WHEN ja.date_submitted > ja.due_date THEN 1 END) AS late_count,
            
            -- Bilangin ang Accepted (Verified) at Repair
            COUNT(CASE WHEN ja.status = 'Approved' THEN 1 END) AS accepted_count,
            COUNT(CASE WHEN ja.status = 'Repair' THEN 1 END) AS repair_count

        FROM users u
        JOIN worker_details wd ON u.user_id = wd.user_id
        LEFT JOIN job_assignments ja ON u.user_id = ja.worker_id
        
        WHERE u.user_role = 'Worker'
        
        -- I-group para magsama-sama ang records ng iisang tao
        GROUP BY u.user_id, u.first_name, u.last_name, wd.job_role, wd.job_type
        
        -- I-sort para ang pinakamaraming accepted at early ang nasa top 1 (Rank)
        ORDER BY accepted_count DESC, early_count DESC;
    `;
    
    const result = await query(sql);
    return result.rows;
};
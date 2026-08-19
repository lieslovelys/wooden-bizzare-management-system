import { query } from '../config/db.js';

// P1-6: this used to be three sequential round trips (active projects, total workers, monthly
// profit). Combined into one query via scalar subselects. On a single vCPU with a small
// connection pool (P1-2), one round trip on one connection genuinely beats three concurrent
// ones — `Promise.all` would be the right instinct on a multi-core box, but not this one.
export const getDashboardStats = async () => {
    const sql = `
        SELECT
            (SELECT COUNT(*)
               FROM projects
              WHERE status IS NULL
                 OR LOWER(status) NOT IN ('completed', 'done')) AS active_projects,
            (SELECT COUNT(*)
               FROM users
              WHERE user_role = 'Worker') AS total_workers,
            -- P1-9: updated_at is timestamptz — compare against the Manila calendar month
            -- explicitly rather than relying on the session's implicit default timezone.
            (SELECT COALESCE(SUM(net_profit), 0)
               FROM project_profit
              WHERE EXTRACT(MONTH FROM updated_at AT TIME ZONE 'Asia/Manila') = EXTRACT(MONTH FROM NOW() AT TIME ZONE 'Asia/Manila')
                AND EXTRACT(YEAR FROM updated_at AT TIME ZONE 'Asia/Manila') = EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Asia/Manila')
            ) AS total_monthly_profit
    `;
    const { rows } = await query(sql);

    return {
        activeProjects: parseInt(rows[0].active_projects, 10),
        totalWorkers: parseInt(rows[0].total_workers, 10),
        monthlyProfit: parseFloat(rows[0].total_monthly_profit)
    };
};

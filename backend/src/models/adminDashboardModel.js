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

// Item 48 — the dashboard's new profit-trend widget. generate_series builds the last `months`
// Manila calendar months (including the current one, so the last entry always matches
// getDashboardStats's own monthlyProfit — same attribution rule: project_profit.updated_at,
// compared in Manila time, not the session's implicit default timezone). LEFT JOIN + COALESCE
// means a month with no recorded profit comes back as 0 rather than being skipped.
export const getProfitTrend = async (months) => {
    const sql = `
        WITH month_series AS (
            SELECT date_trunc('month', NOW() AT TIME ZONE 'Asia/Manila')
                     - (n || ' months')::interval AS month_start
              FROM generate_series($1::int - 1, 0, -1) AS n
        )
        SELECT
            to_char(ms.month_start, 'YYYY-MM') AS month,
            COALESCE(SUM(pp.net_profit), 0) AS net_profit
        FROM month_series ms
        LEFT JOIN project_profit pp
               ON date_trunc('month', pp.updated_at AT TIME ZONE 'Asia/Manila') = ms.month_start
        GROUP BY ms.month_start
        ORDER BY ms.month_start ASC
    `;
    const { rows } = await query(sql, [months]);

    return rows.map(row => ({
        month: row.month,
        netProfit: parseFloat(row.net_profit)
    }));
};

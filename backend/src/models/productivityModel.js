import { query } from '../config/db.js';

// P1-3: capped-only (a leaderboard over the worker headcount, no paging UI). The `GROUP BY`
// means the total can't come from a `COUNT(*) OVER()` window on the same query (that would count
// pre-aggregation rows) — a second query wrapping the grouped query is the documented exception
// (see ARCHITECTURE_REVIEW.md P1-3). Sequential rather than concurrent (P1-6 precedent: one
// connection at a time beats two on this box's small pool). `u.user_id ASC` tiebreaks the two
// aggregate-alias ORDER BY columns so OFFSET paging is deterministic if this endpoint is ever
// paged past its default limit.
export const getWorkerProductivity = async ({ limit, offset }) => {
    const baseSql = `
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
    `;

    const countResult = await query(`SELECT COUNT(*) AS total FROM (${baseSql}) s`);
    const total = Number(countResult.rows[0].total);

    // I-sort para ang pinakamaraming accepted at early ang nasa top 1 (Rank)
    const pageResult = await query(
        `${baseSql} ORDER BY accepted_count DESC, early_count DESC, u.user_id ASC LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    return { rows: pageResult.rows, total };
};

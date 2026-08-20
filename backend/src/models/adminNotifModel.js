import { query } from '../config/db.js';
import { splitCountedRows } from '../utils/pagination.js';

// P1-3: paged, plus the `type` filter this GET never had (the two bulk mutations below already
// took an optional `type` — see P2 notification-component consolidation — but the read itself
// filtered client-side in globals/NotificationList.jsx, which would show an empty/short page once
// this list is paged server-side for a role-scoped screen). `id DESC` tiebreaks `created_at`,
// which is not unique.
export const getAllNotifications = async ({ limit, offset, type = null }) => {
    const { rows } = await query(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM notifications
         WHERE ($1::text IS NULL OR type = $1)
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [type, limit, offset]
    );
    return splitCountedRows(rows);
};


// `type` is optional (null/undefined = all types) — see routes/adminNotifRoutes.js. Used so a
// single role-scoped screen (PM/QC) can bulk-act on just its own notification type instead of
// issuing one request per row, matching what Admin's unscoped call already did.
export const markAllAsRead = async (type = null) => {
    const { rows } = await query(
        'UPDATE notifications SET is_read = TRUE WHERE ($1::text IS NULL OR type = $1) RETURNING *',
        [type]
    );
    return rows;
};

export const deleteNotification = async (id) => {
    const { rows } = await query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
    return rows[0];
};


export const clearAllNotifications = async (type = null) => {
    await query('DELETE FROM notifications WHERE ($1::text IS NULL OR type = $1)', [type]);
};


export const createNotification = async (type, title, message, targetRole, referenceId = null) => {
    const sql = `
        INSERT INTO notifications (type, title, message, target_role, reference_id) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *
    `;
    const { rows } = await query(sql, [type, title, message, targetRole, referenceId]);
    return rows[0];
};

export const markOneAsRead = async (id) => {
    const { rows } = await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
    return rows[0];
};
import { query } from '../config/db.js'; 


export const getAllNotifications = async () => {
    const { rows } = await query('SELECT * FROM notifications ORDER BY created_at DESC');
    return rows;
};


export const markAllAsRead = async () => {
    const { rows } = await query('UPDATE notifications SET is_read = TRUE RETURNING *');
    return rows;
};

export const deleteNotification = async (id) => {
    const { rows } = await query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
    return rows[0];
};


export const clearAllNotifications = async () => {
    await query('DELETE FROM notifications');
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
import { query } from "../config/db.js";

const createUser = async (username, password, first_name, middle_name, last_name, suffix, user_role) => {
    try{
        const result = await query(`INSERT INTO users (username, user_password, first_name, middle_name, last_name, suffix, user_role)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`, [username, password, first_name, middle_name, last_name, suffix, user_role]);
        
        return result.rows;
    }
    catch(e){
        return e;
    }
}

const getUserByUsername = async (username) => {
    try{
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows;
    }
    catch(e){
        return e;
    }
}

const deleteUserById = async (id) => {
    try {
        const result = await query('DELETE FROM users WHERE user_id = $1 RETURNING *', [id]);
        return result.rows;
    } catch (e) {
        throw e;
    }
}

// --- BAGONG FUNCTION PARA SA ACCOUNT LIST ---
const getAllUsers = async () => {
    try {
        const text = `
            SELECT 
                '#' || LPAD(user_id::text, 3, '0') AS formatted_id,
                user_id,
                username,
                TRIM(CONCAT_WS(' ', first_name, middle_name, last_name, NULLIF(suffix::text, 'None'))) AS full_name,
                user_role
            FROM users
            ORDER BY user_id ASC;
        `;
        const result = await query(text);
        return result.rows;
    }
    catch(e){
        throw e; 
    }
}

const getAllWorkers = async () => {
    try {
        const text = `
            SELECT 
                u.user_id,         /* <-- IDINAGDAG NATIN ITO PARA PANG-UPDATE */
                u.username,        /* <-- IDINAGDAG NATIN ITO PARA MAKITA MO YUNG USERNAME */
                'W-' || LPAD(u.user_id::text, 2, '0') AS formatted_id,
                TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, NULLIF(u.suffix::text, 'None'))) AS full_name,
                w.job_type,
                w.job_role,
                w.contact,
                w.rate
            FROM users u
            LEFT JOIN worker_details w ON u.user_id = w.user_id
            WHERE u.user_role = 'Worker'
            ORDER BY u.user_id ASC;
        `;
        const result = await query(text);
        return result.rows;
    } catch (e) {
        throw e;
    }
}

const createWorkerDetails = async (user_id, job_type, job_role, contact, rate) => {
    try {
        const text = `
            INSERT INTO worker_details (user_id, job_type, job_role, contact, rate)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await query(text, [user_id, job_type, job_role, contact, rate]);
        return result.rows[0];
    } catch (e) {
        throw e;
    }
}

const updateWorkerDetails = async (user_id, job_type, job_role, contact, rate) => {
    try {
        // I-check muna natin kung may record na siya sa worker_details table
        const checkQuery = `SELECT * FROM worker_details WHERE user_id = $1`;
        const checkResult = await query(checkQuery, [user_id]);

        if (checkResult.rows.length > 0) {
            // KUNG MERON NA: I-u-update lang natin yung columns
            const updateQuery = `
                UPDATE worker_details 
                SET job_type = $1, job_role = $2, contact = $3, rate = $4
                WHERE user_id = $5 RETURNING *;
            `;
            const result = await query(updateQuery, [job_type, job_role, contact, rate, user_id]);
            return result.rows[0];
        } else {
            // KUNG WALA PA (Blangko talaga): I-i-insert natin yung bagong data niya
            const insertQuery = `
                INSERT INTO worker_details (user_id, job_type, job_role, contact, rate)
                VALUES ($1, $2, $3, $4, $5) RETURNING *;
            `;
            const result = await query(insertQuery, [user_id, job_type, job_role, contact, rate]);
            return result.rows[0];
        }
    } catch (e) {
        throw e;
    }
}

export default {
    getUserByUsername,
    createUser,
    getAllUsers,
    deleteUserById,
    getAllWorkers,
    createWorkerDetails,
    updateWorkerDetails
}
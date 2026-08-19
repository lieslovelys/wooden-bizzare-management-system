import { query, getClient } from "../config/db.js";

const createUser = async (username, password, first_name, middle_name, last_name, suffix, user_role) => {
    try{
        const result = await query(`INSERT INTO users (username, user_password, first_name, middle_name, last_name, suffix, user_role)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`, [username, password, first_name, middle_name, last_name, suffix, user_role]);

        return result.rows;
    }
    catch(e){
        throw e;
    }
}

const getUserByUsername = async (username) => {
    try{
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows;
    }
    catch(e){
        throw e;
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
                u.user_id,         
                u.username,        
                u.first_name,      
                u.middle_name,     
                u.last_name,       
                u.suffix,
                w.detail_id,       
                w.photo,           /* <--- SIGURADUHING NANDITO ITO PARA SA PICTURE */
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

const createWorkerDetails = async (user_id, job_type, job_role, contact, rate, photo = null) => {
    try {
        const text = `
            INSERT INTO worker_details (user_id, job_type, job_role, contact, rate, photo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const result = await query(text, [user_id, job_type, job_role, contact, rate, photo]);
        return result.rows[0];
    } catch (e) {
        throw e;
    }
}

// P1-5: creates the `users` row and its `worker_details` row in one transaction. The two used
// to be separate queries (userController.addWorker calling createUser then createWorkerDetails)
// — a failure on the second left an orphaned login with no worker profile. Used by addWorker;
// createUser/createWorkerDetails stay exported individually since other callers (bootstrap
// admin script) only need the users-row half.
const createWorkerWithDetails = async (username, password, first_name, middle_name, last_name, suffix, job_type, job_role, contact, rate, photo = null) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        const userResult = await client.query(
            `INSERT INTO users (username, user_password, first_name, middle_name, last_name, suffix, user_role)
             VALUES ($1, $2, $3, $4, $5, $6, 'Worker')
             RETURNING *`,
            [username, password, first_name, middle_name, last_name, suffix]
        );
        const newUser = userResult.rows[0];

        const detailsResult = await client.query(
            `INSERT INTO worker_details (user_id, job_type, job_role, contact, rate, photo)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [newUser.user_id, job_type, job_role, contact, rate, photo]
        );

        await client.query('COMMIT');
        return { user: newUser, details: detailsResult.rows[0] };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// IDINAGDAG ANG 'photo' SA PARAMETERS
// P1-7/P1-6: was a SELECT-then-INSERT-or-UPDATE across two round trips (a race, since two
// concurrent requests could both see "no row" and both try to INSERT). Now a single upsert,
// made possible by the UNIQUE(user_id) constraint added on worker_details in the P1-7 migration.
const updateWorkerDetails = async (user_id, job_type, job_role, contact, rate, photo = null) => {
    try {
        const upsertQuery = `
            INSERT INTO worker_details (user_id, job_type, job_role, contact, rate, photo)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE
                SET job_type = EXCLUDED.job_type,
                    job_role = EXCLUDED.job_role,
                    contact = EXCLUDED.contact,
                    rate = EXCLUDED.rate,
                    photo = EXCLUDED.photo
            RETURNING *;
        `;
        const result = await query(upsertQuery, [user_id, job_type, job_role, contact, rate, photo]);
        return result.rows[0];
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
    createWorkerWithDetails,
    updateWorkerDetails
}
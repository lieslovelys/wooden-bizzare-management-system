import { query, getClient } from "../config/db.js";
import { splitCountedRows } from "../utils/pagination.js";

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

// The CTE snapshots worker_details.photo_path BEFORE the DELETE fires the
// worker_details_user_id_fkey ON DELETE CASCADE, so the caller (userService.deleteUser) still
// gets the filename it needs to remove from disk even though the row that held it is already
// gone by the time this statement returns.
const deleteUserById = async (id) => {
    try {
        const result = await query(
            `WITH deleted_photo AS (
                SELECT photo_path FROM worker_details WHERE user_id = $1
            )
            DELETE FROM users WHERE user_id = $1
            RETURNING *, (SELECT photo_path FROM deleted_photo) AS photo_path`,
            [id]
        );
        return result.rows;
    } catch (e) {
        throw e;
    }
}

// --- BAGONG FUNCTION PARA SA ACCOUNT LIST ---
// P1-3: capped-only (headcount-bounded, no paging UI on the frontend) — see
// ARCHITECTURE_REVIEW.md P1-3 for why capped-only endpoints default their limit to MAX_LIMIT
// rather than the smaller DEFAULT_LIMIT other paged endpoints use.
const getAllUsers = async ({ limit, offset }) => {
    try {
        const text = `
            SELECT
                '#' || LPAD(user_id::text, 3, '0') AS formatted_id,
                user_id,
                username,
                TRIM(CONCAT_WS(' ', first_name, middle_name, last_name, NULLIF(suffix::text, 'None'))) AS full_name,
                user_role,
                COUNT(*) OVER() AS total_count
            FROM users
            ORDER BY user_id ASC
            LIMIT $1 OFFSET $2;
        `;
        const result = await query(text, [limit, offset]);
        return splitCountedRows(result.rows);
    }
    catch(e){
        throw e;
    }
}

const getAllWorkers = async ({ limit, offset }) => {
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
                w.photo_path,      /* filename only now — served via GET /api/workers/:id/photo, see utils/photoStorage.js */
                'W-' || LPAD(u.user_id::text, 2, '0') AS formatted_id,
                TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, NULLIF(u.suffix::text, 'None'))) AS full_name,
                w.job_type,
                w.job_role,
                w.contact,
                w.rate,
                COUNT(*) OVER() AS total_count
            FROM users u
            LEFT JOIN worker_details w ON u.user_id = w.user_id
            WHERE u.user_role = 'Worker'
            ORDER BY u.user_id ASC
            LIMIT $1 OFFSET $2;
        `;
        const result = await query(text, [limit, offset]);
        return splitCountedRows(result.rows);
    } catch (e) {
        throw e;
    }
}

// Looked up by the photo-serving route (GET /api/workers/:id/photo) so it can resolve a
// filename from an id without trusting anything the client sent about the path itself.
const getWorkerPhotoPath = async (user_id) => {
    try {
        const result = await query('SELECT photo_path FROM worker_details WHERE user_id = $1', [user_id]);
        return result.rows[0]?.photo_path ?? null;
    } catch (e) {
        throw e;
    }
}

// P1-5: creates the `users` row and its `worker_details` row in one transaction. The two used
// to be separate queries (userController.addWorker calling createUser then a since-removed
// createWorkerDetails) — a failure on the second left an orphaned login with no worker profile.
// Used by addWorker; createUser stays exported individually since other callers (bootstrap
// admin script) only need the users-row half.
const createWorkerWithDetails = async (username, password, first_name, middle_name, last_name, suffix, job_type, job_role, contact, rate, photoPath = null) => {
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
            `INSERT INTO worker_details (user_id, job_type, job_role, contact, rate, photo_path)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [newUser.user_id, job_type, job_role, contact, rate, photoPath]
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

// P1-7/P1-6: was a SELECT-then-INSERT-or-UPDATE across two round trips (a race, since two
// concurrent requests could both see "no row" and both try to INSERT). Still a single upsert,
// made possible by the UNIQUE(user_id) constraint added on worker_details in the P1-7 migration.
//
// `photoOpt` is `{ photoChanged, photoPath }` rather than a bare value, because "the caller sent
// no photo at all" (keep whatever's there) and "the caller explicitly cleared it" (photoPath:
// null) need to be distinguishable — see userService.updateWorker. The transaction (rather than
// a bare upsert) exists so the row is locked between reading the OLD photo_path and writing the
// new one; the caller uses the returned `previousPhotoPath` to delete the now-orphaned file only
// after the database write that replaces it has actually committed.
const updateWorkerDetails = async (user_id, job_type, job_role, contact, rate, { photoChanged = false, photoPath = null } = {}) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        const existing = await client.query(
            'SELECT photo_path FROM worker_details WHERE user_id = $1 FOR UPDATE',
            [user_id]
        );
        const previousPhotoPath = existing.rows[0]?.photo_path ?? null;
        const nextPhotoPath = photoChanged ? photoPath : previousPhotoPath;

        const result = await client.query(
            `INSERT INTO worker_details (user_id, job_type, job_role, contact, rate, photo_path)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id) DO UPDATE
                SET job_type = EXCLUDED.job_type,
                    job_role = EXCLUDED.job_role,
                    contact = EXCLUDED.contact,
                    rate = EXCLUDED.rate,
                    photo_path = EXCLUDED.photo_path
             RETURNING *`,
            [user_id, job_type, job_role, contact, rate, nextPhotoPath]
        );

        await client.query('COMMIT');
        return { details: result.rows[0], previousPhotoPath };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export default {
    getUserByUsername,
    createUser,
    getAllUsers,
    deleteUserById,
    getAllWorkers,
    getWorkerPhotoPath,
    createWorkerWithDetails,
    updateWorkerDetails
}
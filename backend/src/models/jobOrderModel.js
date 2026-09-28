import { query, getClient } from '../config/db.js';
import { splitCountedRows } from '../utils/pagination.js';

// P1-3: paged. `priority` is an optional array of display-form values ('High'/'Medium'/'Low') —
// matched against the same normalization globals/JobOrder.jsx used to do client-side
// (`priority_level ? capitalize(lowercase) : 'Low'`), now done in SQL so the filter and the
// badge the user sees always agree. `sort` flips the due-date direction; `id ASC` is a
// tiebreaker so OFFSET paging over the nullable, non-unique `due_date` column is deterministic
// (a nullable ORDER BY column with no tiebreaker can duplicate or skip rows across pages).
export const getAllJobOrders = async ({ limit, offset, priority, sort } = {}) => {
    const conditions = [`(status != 'Completed' OR status IS NULL)`];
    const params = [];

    if (priority && priority.length > 0) {
        params.push(priority);
        conditions.push(`INITCAP(LOWER(COALESCE(priority_level, 'Low'))) = ANY($${params.length}::text[])`);
    }

    const direction = sort === 'desc' ? 'DESC' : 'ASC';
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const sqlString = `
        SELECT id, project_name, due_date, priority_level, status, COUNT(*) OVER() AS total_count
        FROM projects
        WHERE ${conditions.join(' AND ')}
        ORDER BY due_date ${direction}, id ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;
    const { rows } = await query(sqlString, params);
    return splitCountedRows(rows);
};

export const getJobOrderById = async (projectId) => {
    const projectSql = `SELECT * FROM projects WHERE id = $1`;
    const projectResult = await query(projectSql, [projectId]);

    if (projectResult.rows.length === 0) {
        return null; 
    }

    const projectData = projectResult.rows[0];

    const variablesSql = `
        SELECT id, variable_name, variable_detail 
        FROM project_variables 
        WHERE project_id = $1
        ORDER BY id ASC
    `;
    const variablesResult = await query(variablesSql, [projectId]);

    return {
        ...projectData,
        variables: variablesResult.rows
    };
};

// P1-3: capped-only — a dropdown feed (globals/JobOrderDetails.jsx's worker-assignment select),
// no paging UI on the frontend. Previously had NO `ORDER BY` at all, which made OFFSET paging
// nondeterministic (rows could duplicate or go missing across pages) — added one even though
// this endpoint isn't expected to page past its default limit in practice.
export const getWorkers = async ({ limit, offset }) => {
    const sql = `
        SELECT u.user_id, u.first_name, u.last_name, w.job_role, w.job_type,
               COUNT(*) OVER() AS total_count
        FROM users u
        LEFT JOIN worker_details w ON u.user_id = w.user_id
        WHERE u.user_role = 'Worker'
        ORDER BY u.user_id ASC
        LIMIT $1 OFFSET $2
    `;
    const { rows } = await query(sql, [limit, offset]);
    return splitCountedRows(rows);
};

// P1-3: capped-only — naturally bounded (assignment stages per project), no paging UI.
// `assignment_id` is a primary key, so the existing ORDER BY is already a deterministic
// tiebreaker on its own.
// FR-7/FR-9: also selects `qa_notes` and the reviewer's name (joined via `qa_checker_id`, which
// this same track-A pass is the first code to ever write) — feeds both
// globals/ProjectVerificationDetail.jsx (showing a reviewer their own past decisions) and
// worker/WorkerJobOrderDetail.jsx (showing a worker why their stage came back for repair).
export const getProjectAssignments = async (projectId, { limit, offset }) => {
    const sql = `
        SELECT j.assignment_id, j.stage_name, j.start_date, j.due_date, j.date_completed, j.status,
               j.qa_notes, u.first_name, u.last_name,
               q.first_name AS qa_checker_first_name, q.last_name AS qa_checker_last_name,
               COUNT(*) OVER() AS total_count
        FROM job_assignments j
        LEFT JOIN users u ON j.worker_id = u.user_id
        LEFT JOIN users q ON j.qa_checker_id = q.user_id
        WHERE j.project_id = $1
        ORDER BY j.assignment_id ASC
        LIMIT $2 OFFSET $3
    `;
    const { rows } = await query(sql, [projectId, limit, offset]);
    return splitCountedRows(rows);
};


// P1-5: the assignment insert and the project-status flip used to be two independent
// queries — a failure on the second left an assignment hanging off a project still marked
// `Pending`. Wrapped in one transaction so they succeed or fail together.
//
// Behavior change from the pre-P1a version, called out deliberately: the status update used
// to be unconditional, so assigning work to an already-`Completed` project silently reopened
// it. `AND status IS DISTINCT FROM 'Completed'` guards against that.
export const createJobAssignment = async (projectId, workerId, stageName, startDate, dueDate) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        const insertSql = `
            INSERT INTO job_assignments (project_id, worker_id, stage_name, start_date, due_date, status)
            VALUES ($1, $2, $3, $4, $5, 'Assigned')
            RETURNING *;
        `;
        const { rows } = await client.query(insertSql, [projectId, workerId, stageName, startDate, dueDate]);

        const updateProjSql = `
            UPDATE projects
            SET status = 'In Progress'
            WHERE id = $1 AND status IS DISTINCT FROM 'Completed';
        `;
        await client.query(updateProjSql, [projectId]);

        await client.query('COMMIT');
        return rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        // Not logged here — always propagates to errorHandler.js, which logs every unexpected
        // error centrally (structured, with the request's correlation id).
        throw error;
    } finally {
        client.release();
    }
};

// P1-3: paged. `status` matches the task_status enum exactly (the frontend's Assigned/Repair
// toggle buttons); `priority` matches `p.priority_level` exactly too — worker/WorkerJobOrder.jsx
// never normalized case here (unlike JobOrder.jsx's INITCAP treatment), so the filter stays a
// literal match to preserve exactly what the client-side `.filter()` it replaces used to do.
// `assignment_id ASC` tiebreaks the nullable, non-unique `due_date` for deterministic paging.
export const getTasksByWorkerId = async (workerId, { limit, offset, status, priority, sort } = {}) => {
    try {
        const conditions = ['ja.worker_id = $1'];
        const params = [workerId];

        if (status) {
            params.push(status);
            conditions.push(`ja.status = $${params.length}::task_status`);
        }
        if (priority) {
            params.push(priority);
            conditions.push(`p.priority_level = $${params.length}`);
        }

        const direction = sort === 'desc' ? 'DESC' : 'ASC';
        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const sql = `
            SELECT
                ja.assignment_id,
                p.id AS project_id,
                p.project_name,
                ja.due_date,
                p.priority_level AS priority,
                ja.status,
                ja.stage_name,
                COUNT(*) OVER() AS total_count
            FROM job_assignments ja
            JOIN projects p ON ja.project_id = p.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY ja.due_date ${direction}, ja.assignment_id ASC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const { rows } = await query(sql, params);
        return splitCountedRows(rows);
    } catch (error) {
        // See createJobAssignment above — errorHandler.js logs this centrally.
        throw error;
    }
};


// P1-3: paged. `stage` matches `ja.stage_name` exactly (the QC screen's Stage dropdown).
export const getTasksForQA = async ({ limit, offset, stage } = {}) => {
    try {
        const conditions = [`ja.status = 'For QA'`];
        const params = [];

        if (stage) {
            params.push(stage);
            conditions.push(`ja.stage_name = $${params.length}`);
        }

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const sql = `
            SELECT
                ja.assignment_id,
                p.id AS project_id,
                p.project_name,
                ja.due_date,
                p.priority_level,
                ja.status,
                ja.stage_name,
                u.first_name,
                u.last_name,
                COUNT(*) OVER() AS total_count
            FROM job_assignments ja
            LEFT JOIN projects p ON ja.project_id = p.id
            LEFT JOIN users u ON ja.worker_id = u.user_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY ja.due_date ASC, ja.assignment_id ASC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const { rows } = await query(sql, params);
        return splitCountedRows(rows);
    } catch (error) {
        // See createJobAssignment above — errorHandler.js logs this centrally.
        throw error;
    }
};

// Fetch a single assignment by its own ID — used to authorize a status change before it's
// made (ownership/role checks in jobOrderController.updateQAStatus).
export const getAssignmentById = async (assignmentId) => {
    const sql = `
        SELECT assignment_id, worker_id, project_id, status
        FROM job_assignments
        WHERE assignment_id = $1
    `;
    const { rows } = await query(sql, [assignmentId]);
    return rows[0] || null;
};

// `allowedFromStatuses` makes the authorization check atomic with the write: the row only
// updates if it's still in a state the caller is permitted to transition from, closing a
// race window between an earlier read (getAssignmentById) and this update. If nothing matched
// — wrong current state, or the assignment no longer exists — rows[0] is undefined and the
// caller (jobOrderController.updateQAStatus) treats that as a 409, not a silent success.
//
// FR-7: `qaCheckerId`/`qaNotes` populate the audit-trail columns on a reviewer's Approved/Repair
// transition — the service passes both as `null` on a worker's own 'For QA' submission, so this
// only ever appends to the two branches below that a reviewer can reach. A stale `qa_notes` from
// a previous repair round is deliberately left in place across a worker's resubmission (there's
// no branch here that clears it) — FR-9 needs the worker to still be able to read why a prior
// round was rejected.
export const updateAssignmentStatus = async (assignmentId, newStatus, allowedFromStatuses, qaCheckerId = null, qaNotes = null) => {
    try {
        let sql;

        if (newStatus === 'Approved') {
            // date_completed is timestamptz (P1-9) — NOW() rather than CURRENT_DATE, which
            // would silently pin it to Manila midnight.
            sql = `
                UPDATE job_assignments
                SET status = $1, date_completed = NOW(), qa_checker_id = $4, qa_notes = $5
                WHERE assignment_id = $2 AND status = ANY($3::task_status[]) RETURNING *
            `;
        }
        // --- BAGONG LOGIC PARA KAY WORKER (date_submitted) ---
        else if (newStatus === 'For QA') {
            // date_submitted stays a plain `date` (P1-9) — explicit Manila business day
            // rather than the session's implicit default, since productivity.js's early/
            // on-time/late ranking is derived directly from this column.
            sql = `
                UPDATE job_assignments
                SET status = $1, date_submitted = (NOW() AT TIME ZONE 'Asia/Manila')::date
                WHERE assignment_id = $2 AND status = ANY($3::task_status[]) RETURNING *
            `;
        }
        // -----------------------------------------------------
        else {
            // Reviewer setting Repair (or any future non-Approved reviewer status).
            sql = `
                UPDATE job_assignments
                SET status = $1, qa_checker_id = $4, qa_notes = $5
                WHERE assignment_id = $2 AND status = ANY($3::task_status[]) RETURNING *
            `;
        }

        const { rows } = await query(sql, [newStatus, assignmentId, allowedFromStatuses, qaCheckerId, qaNotes]);
        return rows[0];

    } catch (error) {
        // See createJobAssignment above — errorHandler.js logs this centrally.
        throw error;
    }
};

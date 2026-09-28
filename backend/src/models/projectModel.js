import { getClient } from '../config/db.js';
import { splitCountedRows } from '../utils/pagination.js';

const createProjectWithVariables = async (projectData) => {
  const {
    projectName, clientName, contactNumber, dateOrdered,
    clientPayment, priorityLevel, dueDate, projectDetails
  } = projectData;

  const client = await getClient();

  try {
    await client.query('BEGIN');
    const projectInsertQuery = `
      INSERT INTO projects (project_name, client_name, contact_number, date_ordered, client_payment, priority_level, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const projectValues = [projectName, clientName, contactNumber, dateOrdered, clientPayment, priorityLevel, dueDate];
    const projectRes = await client.query(projectInsertQuery, projectValues);
    const projectId = projectRes.rows[0].id;

    // P1-6: was an N-iteration insert loop (one round trip per variable). One multi-row
    // insert via unnest() replaces it regardless of how many variables are supplied.
    const namedVariables = (projectDetails || []).filter((v) => v.name && v.name.trim() !== '');
    if (namedVariables.length > 0) {
      await client.query(
        `INSERT INTO project_variables (project_id, variable_name, variable_detail)
         SELECT $1, n, d
         FROM unnest($2::text[], $3::text[]) AS t(n, d)`,
        [projectId, namedVariables.map((v) => v.name), namedVariables.map((v) => v.detail)]
      );
    }

    await client.query('COMMIT');
    return projectId;
  } catch (error) {
    await client.query('ROLLBACK');
    // Not logged here — always propagates to errorHandler.js, which logs every unexpected error
    // centrally (structured, with the request's correlation id).
    throw error;
  } finally {
    client.release();
  }
};


// PROJECT LIST

// P1-3: paged, with `search` (project name or id) and `status` (exact match — an array, so
// ProjectList.jsx can request e.g. ['Pending','In Progress'] to reproduce its old client-side
// "always hide Completed" behavior explicitly rather than that exclusion being silently baked
// into every caller — admin/Profit.jsx's project dropdown still wants Completed projects
// included, and omitting `status` entirely preserves that).
// FR-8: `status` used to be a CASE containing a correlated EXISTS, recomputing it independently
// of the stored column on every read — a second source of truth (PRD.md B.6). The stored column
// is now the single source (see migrations/*_project-status-single-source-of-truth.js, which
// backfilled it to match what this CASE used to derive, and constrained it going forward); this
// just selects it directly. The CTE wrapper stays even though it's no longer load-bearing for a
// derived column, since it's still what lets `status` be filtered in a plain WHERE below.
const getAllProjects = async ({ limit, offset, search, status } = {}) => {
  const client = await getClient();
  try {
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.project_name ILIKE $${params.length} OR s.id::text ILIKE $${params.length})`);
    }
    if (status && status.length > 0) {
      params.push(status);
      conditions.push(`s.status = ANY($${params.length}::text[])`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const query = `
      WITH s AS (
        SELECT
          p.id,
          p.project_name,
          p.client_name,
          p.contact_number,
          p.client_payment,
          p.due_date,
          p.priority_level,
          p.created_at,
          p.status
        FROM projects p
      )
      SELECT s.*, COUNT(*) OVER() AS total_count
      FROM s
      ${whereClause}
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;
    const res = await client.query(query, params);

    return splitCountedRows(res.rows);
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
};

// EDIT PROJECT

const getProjectById = async (id) => {
  const client = await getClient();
  try {
    const projectRes = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    const variablesRes = await client.query('SELECT * FROM project_variables WHERE project_id = $1', [id]);
    
    if (projectRes.rows.length === 0) return null;

    return {
      ...projectRes.rows[0],
      variables: variablesRes.rows
    };
  } finally {
    client.release();
  }
};

const updateProject = async (id, projectData) => {
  const {
    projectName, clientName, contactNumber, dateOrdered,
    clientPayment, priorityLevel, dueDate, projectDetails
  } = projectData;

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const updateQuery = `
      UPDATE projects 
      SET project_name = $1, client_name = $2, contact_number = $3, 
          date_ordered = $4, client_payment = $5, priority_level = $6, due_date = $7
      WHERE id = $8
    `;
    await client.query(updateQuery, [
      projectName, clientName, contactNumber, dateOrdered, 
      clientPayment, priorityLevel, dueDate, id
    ]);

    await client.query('DELETE FROM project_variables WHERE project_id = $1', [id]);

    // P1-6: was an N-iteration insert loop; one multi-row insert via unnest() replaces it.
    const namedVariables = (projectDetails || []).filter((v) => v.name.trim() !== '');
    if (namedVariables.length > 0) {
      await client.query(
        `INSERT INTO project_variables (project_id, variable_name, variable_detail)
         SELECT $1, n, d
         FROM unnest($2::text[], $3::text[]) AS t(n, d)`,
        [id, namedVariables.map((v) => v.name), namedVariables.map((v) => v.detail)]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};


// FR-8: used to be an unconditional UPDATE — the "every assigned stage must be Approved" rule
// (PRD B.5 workflow 6) lived only in the frontend's disabled-button check
// (globals/JobOrderDetails.jsx's `isCompleteDisabled`), so a direct API call could complete a
// project with outstanding work. This enforces the same rule server-side, atomically with the
// write (`FOR UPDATE` locks the row across the read-then-write so a concurrent assignment can't
// slip in between the count and the update).
//
// Returns one of three shapes, which the service maps to 404/409/200:
//   null                                 — no such project
//   { incomplete: true, ... }            — project exists but isn't ready to complete
//   the updated project row              — success
const markProjectAsCompleted = async (projectId) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        const projectRes = await client.query(
            `SELECT id FROM projects WHERE id = $1 FOR UPDATE`,
            [projectId]
        );
        if (projectRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        // Mirrors JobOrderDetails.jsx's isCompleteDisabled exactly: only *assigned* stages must
        // be Approved (a project with no Painter stage, say, doesn't need one to be "done"), and
        // a project with zero assignments at all isn't ready either.
        const countRes = await client.query(
            `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'Approved') AS approved
             FROM job_assignments WHERE project_id = $1`,
            [projectId]
        );
        const total = Number(countRes.rows[0].total);
        const approved = Number(countRes.rows[0].approved);
        if (total === 0 || approved < total) {
            await client.query('ROLLBACK');
            return { incomplete: true, totalAssigned: total, approvedCount: approved };
        }

        const updateRes = await client.query(
            `UPDATE projects
             SET status = 'Completed', date_completed = (NOW() AT TIME ZONE 'Asia/Manila')::date -- P1-9: explicit Manila business day, not the session's implicit default
             WHERE id = $1
             RETURNING *;`,
            [projectId]
        );

        await client.query('COMMIT');
        return updateRes.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// P1-3: paged, and now returns `remark` as a real column instead of leaving it to be computed
// client-side (admin/ProjectHistory.jsx used to derive it from date_completed vs due_date with a
// setHours(0,0,0,0) day-truncation — both columns are plain `date`s, deliberately not
// `timestamptz` per P1-9, so the SQL comparison is already day-truncated with no extra work).
// `remark` is optional filter param, matching the exact values the frontend's dropdown produces.
const getCompletedProjectsHistory = async ({ limit, offset, remark } = {}) => {
    const client = await getClient();
    try {
        const conditions = [];
        const params = [];
        if (remark) {
            params.push(remark);
            conditions.push(`h.remark = $${params.length}`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const query = `
            WITH h AS (
                SELECT
                    id,
                    project_name,
                    date_ordered AS date_started,
                    date_completed,
                    due_date,
                    CASE
                        WHEN date_completed IS NULL OR due_date IS NULL THEN 'Unknown'
                        WHEN date_completed < due_date THEN 'Early'
                        WHEN date_completed > due_date THEN 'Late'
                        ELSE 'On-time'
                    END AS remark
                FROM projects
                WHERE status = 'Completed'
            )
            SELECT h.*, COUNT(*) OVER() AS total_count
            FROM h
            ${whereClause}
            ORDER BY date_completed DESC, id DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx};
        `;
        const res = await client.query(query, params);
        return splitCountedRows(res.rows);
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

const deleteProjectById = async (id) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Delete associated variables first due to foreign keys
    await client.query('DELETE FROM project_variables WHERE project_id = $1', [id]);

    // 2. Optional: If you want to delete associated job assignments as well, uncomment below:
    // await client.query('DELETE FROM job_assignments WHERE project_id = $1', [id]);

    // 3. Delete the actual project record
    const res = await client.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);

    await client.query('COMMIT');
    return res.rows.length > 0; // returns true if a row was deleted
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export {
  createProjectWithVariables,
  getAllProjects,
  getProjectById,
  updateProject,
  markProjectAsCompleted,
  getCompletedProjectsHistory,
  deleteProjectById
}
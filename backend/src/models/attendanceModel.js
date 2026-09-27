import { query } from "../config/db.js";
import { splitCountedRows } from "../utils/pagination.js";

// P1-3: paged — one row per worker per day, the highest-cardinality list in the app, and the
// strongest case for pagination in the codebase (no ceiling on how long a worker's history
// grows). `a.id ASC` tiebreaks `a.date`, which is not unique per worker.
// Kinukuha ang attendance gamit ang user_id galing sa React
export async function getAttendanceByWorkerId(userId, { limit, offset }) {
  const { rows } = await query(
    `SELECT
       a.id,
       a.worker_id,
       a.date,
       a.day_of_week,
       a.time_in::TEXT  AS time_in,
       a.time_out::TEXT AS time_out,
       a.status,
       a.late_minutes,
       a.overtime_minutes,
       a.notes,
       a.created_at,
       COUNT(*) OVER() AS total_count
     FROM attendance a
     JOIN worker_details w ON a.worker_id = w.detail_id
     WHERE w.user_id = $1
     ORDER BY a.date ASC, a.id ASC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return splitCountedRows(rows);
}

export async function getAttendanceById(id) {
  const { rows } = await query(
    `SELECT
       id, worker_id, date, day_of_week, 
       time_in::TEXT AS time_in, time_out::TEXT AS time_out, 
       status, late_minutes, overtime_minutes, notes, created_at
     FROM attendance
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null; 
}

// FR-5: `status`/`late_minutes` are computed by attendanceService.js's computeAttendance and
// passed in here alongside the raw times — this model just persists what it's given.
export async function createAttendance({ worker_id, date, day_of_week, time_in, time_out, status, late_minutes }) {
  // DITO ANG MAGIC: Yung 'worker_id' parameter na tinanggap galing React ay actually 'user_id'.
  // Kaya magse-SELECT tayo ng detail_id bago mag-INSERT sa table.
  // P1-7: worker_details.user_id is now UNIQUE, so the `LIMIT 1` this used to need to force
  // determinism is redundant.
  const { rows } = await query(
    `INSERT INTO attendance (worker_id, date, day_of_week, time_in, time_out, status, late_minutes)
     VALUES (
        (SELECT detail_id FROM worker_details WHERE user_id = $1),
        $2, $3, $4, $5, $6, $7
     )
     RETURNING
       id, worker_id, date, day_of_week,
       time_in::TEXT AS time_in, time_out::TEXT AS time_out,
       status, late_minutes, overtime_minutes, created_at`,
    [worker_id, date, day_of_week || null, time_in || null, time_out || null, status, late_minutes]
  );
  return rows[0];
}

export async function updateAttendance(id, { date, day_of_week, time_in, time_out, status, late_minutes }) {
  const { rows } = await query(
    `UPDATE attendance
     SET date     = $1,
        day_of_week = $2,
         time_in  = $3,
         time_out = $4,
         status   = $5,
         late_minutes = $6
     WHERE id = $7
     RETURNING
       id, worker_id, date, day_of_week,
       time_in::TEXT AS time_in, time_out::TEXT AS time_out,
       status, late_minutes, overtime_minutes, created_at`,
    [date, day_of_week || null, time_in || null, time_out || null, status, late_minutes, id]
  );
  return rows[0] || null;
}

export async function deleteAttendance(id) {
  const { rowCount } = await query(`DELETE FROM attendance WHERE id = $1`, [id]);
  return rowCount > 0;
}
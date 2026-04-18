import { query } from "../config/db.js";

// Kinukuha ang attendance gamit ang user_id galing sa React
export async function getAttendanceByWorkerId(userId) {
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
       a.created_at
     FROM attendance a
     JOIN worker_details w ON a.worker_id = w.detail_id
     WHERE w.user_id = $1
     ORDER BY a.date ASC`,
    [userId]
  );
  return rows; 
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

export async function createAttendance({ worker_id, date, time_in, time_out }) {
  // DITO ANG MAGIC: Yung 'worker_id' parameter na tinanggap galing React ay actually 'user_id'.
  // Kaya magse-SELECT tayo ng detail_id bago mag-INSERT sa table.
  const { rows } = await query(
    `INSERT INTO attendance (worker_id, date, time_in, time_out)
     VALUES (
        (SELECT detail_id FROM worker_details WHERE user_id = $1 LIMIT 1), 
        $2, $3, $4
     )
     RETURNING
       id, worker_id, date, day_of_week, 
       time_in::TEXT AS time_in, time_out::TEXT AS time_out, 
       status, late_minutes, overtime_minutes, created_at`,
    [worker_id, date, time_in || null, time_out || null]
  );
  return rows[0];
}

export async function updateAttendance(id, { date, time_in, time_out }) {
  const { rows } = await query(
    `UPDATE attendance
     SET date     = $1,
         time_in  = $2,
         time_out = $3
     WHERE id = $4
     RETURNING
       id, worker_id, date, day_of_week, 
       time_in::TEXT AS time_in, time_out::TEXT AS time_out, 
       status, late_minutes, overtime_minutes, created_at`,
    [date, time_in || null, time_out || null, id]
  );
  return rows[0] || null;
}

export async function deleteAttendance(id) {
  const { rowCount } = await query(`DELETE FROM attendance WHERE id = $1`, [id]);
  return rowCount > 0;
}
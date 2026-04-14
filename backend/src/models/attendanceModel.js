import { query } from "../config/db.js";

export async function getAttendanceByWorkerId(workerId) {
  const { rows } = await query(
    `SELECT
       id,
       worker_id,
       date,
       time_in::TEXT  AS time_in,
       time_out::TEXT AS time_out,
       created_at
     FROM attendance
     WHERE worker_id = $1
     ORDER BY date ASC`,
    [workerId]
  );
  return rows.map(row => ({
    ...row,
    day_of_week: getDayOfWeek(row.date)
  }));
}

export async function getAttendanceById(id) {
  const { rows } = await query(
    `SELECT
       id,
       worker_id,
       date,
       time_in::TEXT  AS time_in,
       time_out::TEXT AS time_out,
       created_at
     FROM attendance
     WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    day_of_week: getDayOfWeek(rows[0].date)
  };
}

export async function createAttendance({ worker_id, date, day_of_week, time_in, time_out }) {
  const computedDay = day_of_week || getDayOfWeek(date);
  const { rows } = await query(
    `INSERT INTO attendance (worker_id, date, time_in, time_out)
     VALUES ($1, $2, $3, $4)
     RETURNING
       id, worker_id, date,
       time_in::TEXT  AS time_in,
       time_out::TEXT AS time_out,
       created_at`,
    [worker_id, date, time_in || null, time_out || null]
  );
  return {
    ...rows[0],
    day_of_week: computedDay
  };
}

export async function updateAttendance(id, { date, time_in, time_out }) {
  const { rows } = await query(
    `UPDATE attendance
     SET date     = $1,
         time_in  = $2,
         time_out = $3
     WHERE id = $4
     RETURNING
       id, worker_id, date,
       time_in::TEXT  AS time_in,
       time_out::TEXT AS time_out,
       created_at`,
    [date, time_in || null, time_out || null, id]
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    day_of_week: getDayOfWeek(rows[0].date)
  };
}

export async function deleteAttendance(id) {
  const { rowCount } = await query(`DELETE FROM attendance WHERE id = $1`, [id]);
  return rowCount > 0;
}

function getDayOfWeek(date) {
  if (!date) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(date);
  return days[d.getDay()];
}
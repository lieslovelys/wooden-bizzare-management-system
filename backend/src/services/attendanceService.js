import {
  getAttendanceByWorkerId,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
} from "../models/attendanceModel.js";
import { AppError } from "../errors/AppError.js";

// FR-5 (PRD.md C.1 / B.6): the shop's working hours, used to compute `status`/`late_minutes`
// server-side instead of leaving every row at the database default ('Absent', 0). This is the
// one place these rules live — the migration that backfills pre-existing rows
// (migrations/1790505569341_compute-attendance-status.js) applies the same formula, but inlined
// as raw SQL rather than importing this file, since a migration must keep working exactly as
// written even if these rules change later.
//
// Overtime is deliberately NOT computed yet: the client hasn't specified the rule (e.g. whether a
// few extra minutes count, or only whole hours past shift end), so `overtime_minutes` stays at
// its schema default of 0 until that's clarified.
const SHIFT_START_MINUTES = 8 * 60 + 30;                          // 08:30
const LATE_GRACE_MINUTES = 15;                                    // time-in up to 08:45 is Present
const LATE_THRESHOLD_MINUTES = SHIFT_START_MINUTES + LATE_GRACE_MINUTES; // 08:45
const LUNCH_START_MINUTES = 12 * 60;                              // 12:00, excluded from worked time
const LUNCH_END_MINUTES = 13 * 60;                                // 13:00
const HALF_DAY_MINUTES = 4 * 60;                                  // worked < 4h => Half-day

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// A time_out with no time_in, or a time_out at/before time_in, can't be represented by the
// `time`-typed (no date part) columns as a real shift — see PRD.md B.2 on the overnight-shift
// gap. Reject rather than silently computing nonsense minutes.
function validateTimes(time_in, time_out) {
  if (time_out && !time_in) {
    throw new AppError(400, "time_out requires time_in.");
  }
  if (time_in && time_out && toMinutes(time_out) <= toMinutes(time_in)) {
    throw new AppError(400, "time_out must be after time_in.");
  }
}

// Pure — no I/O, no thrown AppError (validateTimes already ruled out the shapes it can't handle)
// — so it's trivial to table-test. Half-day is checked before Late: a worker whose shift is only
// a few hours (e.g. a planned afternoon-only day) shouldn't also be flagged with hours of "late
// minutes" for an arrival that was expected.
function computeAttendance({ time_in, time_out }) {
  if (!time_in) return { status: 'Absent', late_minutes: 0 };

  const inMinutes = toMinutes(time_in);

  if (time_out) {
    const outMinutes = toMinutes(time_out);
    const lunchOverlap = Math.max(
      0,
      Math.min(outMinutes, LUNCH_END_MINUTES) - Math.max(inMinutes, LUNCH_START_MINUTES)
    );
    const workedMinutes = (outMinutes - inMinutes) - lunchOverlap;
    if (workedMinutes < HALF_DAY_MINUTES) {
      return { status: 'Half-day', late_minutes: 0 };
    }
  }

  if (inMinutes > LATE_THRESHOLD_MINUTES) {
    return { status: 'Late', late_minutes: inMinutes - SHIFT_START_MINUTES };
  }
  return { status: 'Present', late_minutes: 0 };
}

// A duplicate (worker_id, date) is rejected by the database: `unique_worker_date
// UNIQUE(worker_id, date)` is defined on the attendance table in the initial-schema migration
// (not the later P1a uniqueness-constraints one — an earlier version of this comment looked only
// there and concluded, wrongly, that no such constraint existed). This mapping is reachable, and
// is kept exactly as it behaved before this refactor (it used to live twice, verbatim, in the old
// controller's postAttendance/putAttendance).
function rethrowAsConflictIfDuplicate(err) {
  if (err.code === '23505') {
    throw new AppError(409, "Attendance record already exists for this worker on this date.");
  }
  throw err;
}

const getWorkerAttendance = (workerId, pagination) => getAttendanceByWorkerId(workerId, pagination);

const getAttendanceRecord = async (id) => {
  const record = await getAttendanceById(id);
  if (!record) throw new AppError(404, "Attendance record not found.");
  return record;
};

const postAttendance = async (fields) => {
  validateTimes(fields.time_in, fields.time_out);
  const computed = computeAttendance(fields);
  try {
    return await createAttendance({ ...fields, ...computed });
  } catch (err) {
    rethrowAsConflictIfDuplicate(err);
  }
};

const putAttendance = async (id, fields) => {
  validateTimes(fields.time_in, fields.time_out);
  const computed = computeAttendance(fields);
  try {
    const record = await updateAttendance(id, { ...fields, ...computed });
    if (!record) throw new AppError(404, "Attendance record not found.");
    return record;
  } catch (err) {
    if (err instanceof AppError) throw err;
    rethrowAsConflictIfDuplicate(err);
  }
};

const removeAttendance = async (id) => {
  const deleted = await deleteAttendance(id);
  if (!deleted) throw new AppError(404, "Attendance record not found.");
};

export default {
  computeAttendance,
  getWorkerAttendance,
  getAttendanceRecord,
  postAttendance,
  putAttendance,
  removeAttendance
}

import {
  getAttendanceByWorkerId,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
} from "../models/attendanceModel.js";
import { AppError } from "../errors/AppError.js";

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
  try {
    return await createAttendance(fields);
  } catch (err) {
    rethrowAsConflictIfDuplicate(err);
  }
};

const putAttendance = async (id, fields) => {
  try {
    const record = await updateAttendance(id, fields);
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
  getWorkerAttendance,
  getAttendanceRecord,
  postAttendance,
  putAttendance,
  removeAttendance
}

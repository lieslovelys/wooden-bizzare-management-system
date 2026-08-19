import {
  getAttendanceByWorkerId,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
} from "../models/attendanceModel.js";
import { AppError } from "../errors/AppError.js";

// A duplicate (worker_id, date) can't actually happen today — the schema has no uniqueness
// constraint covering the attendance table (checked: the P1a
// 1787110540000_add-uniqueness-constraints.js migration doesn't touch it). This mapping is kept
// exactly as it behaved before this refactor (it used to live twice, verbatim, in the old
// controller's postAttendance/putAttendance) so nothing changes if that constraint is ever added.
function rethrowAsConflictIfDuplicate(err) {
  if (err.code === '23505') {
    throw new AppError(409, "Attendance record already exists for this worker on this date.");
  }
  throw err;
}

const getWorkerAttendance = (workerId) => getAttendanceByWorkerId(workerId);

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

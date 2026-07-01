import {
  getAttendanceByWorkerId,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
} from "../models/attendanceModel.js";

export async function getWorkerAttendance(req, res) {
  try {
    const data = await getAttendanceByWorkerId(req.params.workerId);
    res.status(200).json(data);
  } catch (err) { 
    console.error("[getWorkerAttendance]", err); 
    res.status(500).json({ error: "Failed to fetch attendance." }); 
  }
}

export async function getAttendanceRecord(req, res) {
  try {
    const record = await getAttendanceById(req.params.id);
    if (!record) return res.status(404).json({ error: "Attendance record not found." });
    res.status(200).json(record);
  } catch (err) { 
    console.error("[getAttendanceRecord]", err); 
    res.status(500).json({ error: "Failed to fetch attendance record." }); 
  }
}

export async function postAttendance(req, res) {
  const { worker_id, date, day_of_week, time_in, time_out } = req.body;

  if (!worker_id) return res.status(400).json({ error: "worker_id is required." });
  if (!date)      return res.status(400).json({ error: "date is required." });

  try {
    const record = await createAttendance({ worker_id, date, day_of_week, time_in, time_out });
    res.status(201).json(record);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: "Attendance record already exists for this worker on this date." });
    }
    console.error("[postAttendance]", err);
    res.status(500).json({ error: "Failed to create attendance record." });
  }
}

export async function putAttendance(req, res) {
  const { date, day_of_week, time_in, time_out } = req.body;

  if (!date) return res.status(400).json({ error: "date is required." });

  try {
    const record = await updateAttendance(req.params.id, { date, day_of_week, time_in, time_out });
    if (!record) return res.status(404).json({ error: "Attendance record not found." });
    res.status(200).json(record);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: "Attendance record already exists for this worker on this date." });
    }
    console.error("[putAttendance]", err);
    res.status(500).json({ error: "Failed to update attendance record." });
  }
}

export async function removeAttendance(req, res) {
  try {
    const deleted = await deleteAttendance(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Attendance record not found." });
    res.status(200).json({ message: "Attendance record deleted." });
  } catch (err) { 
    console.error("[removeAttendance]", err); 
    res.status(500).json({ error: "Failed to delete attendance record." }); 
  }
}
import express from "express";
import Attendance from "../services/attendanceService.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

// Attendance is entirely admin/PM-entered — Workers have no attendance screens.
const ADMIN_PM = requireRole('Admin', 'Production Manager');

// More specific routes first
router.get("/worker/:workerId", ADMIN_PM, async (req, res) => {
  const data = await Attendance.getWorkerAttendance(req.params.workerId);
  res.status(200).json(data);
});

router.post("/", ADMIN_PM, async (req, res) => {
  const { worker_id, date, day_of_week, time_in, time_out } = req.body;

  if (!worker_id) return res.status(400).json({ error: "worker_id is required." });
  if (!date)      return res.status(400).json({ error: "date is required." });

  const record = await Attendance.postAttendance({ worker_id, date, day_of_week, time_in, time_out });
  res.status(201).json(record);
});

router.put("/:id", ADMIN_PM, async (req, res) => {
  const { date, day_of_week, time_in, time_out } = req.body;

  if (!date) return res.status(400).json({ error: "date is required." });

  const record = await Attendance.putAttendance(req.params.id, { date, day_of_week, time_in, time_out });
  res.status(200).json(record);
});

router.delete("/:id", ADMIN_PM, async (req, res) => {
  await Attendance.removeAttendance(req.params.id);
  res.status(200).json({ message: "Attendance record deleted." });
});

router.get("/:id", ADMIN_PM, async (req, res) => {
  const record = await Attendance.getAttendanceRecord(req.params.id);
  res.status(200).json(record);
});

export default router;

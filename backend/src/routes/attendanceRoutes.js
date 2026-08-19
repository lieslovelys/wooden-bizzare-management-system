import express from "express";
import {
  getWorkerAttendance,
  getAttendanceRecord,
  postAttendance,
  putAttendance,
  removeAttendance
} from "../controllers/attendanceController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

// Attendance is entirely admin/PM-entered — Workers have no attendance screens.
const ADMIN_PM = requireRole('Admin', 'Production Manager');

// More specific routes first
router.get("/worker/:workerId", ADMIN_PM, getWorkerAttendance);
router.post("/", ADMIN_PM, postAttendance);
router.put("/:id", ADMIN_PM, putAttendance);
router.delete("/:id", ADMIN_PM, removeAttendance);
router.get("/:id", ADMIN_PM, getAttendanceRecord);

export default router;
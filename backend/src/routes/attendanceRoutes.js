import express from "express";
import {
  getWorkerAttendance,
  getAttendanceRecord,
  postAttendance,
  putAttendance,
  removeAttendance
} from "../controllers/attendanceController.js";

const router = express.Router();

// More specific routes first
router.get("/worker/:workerId", getWorkerAttendance);
router.post("/", postAttendance);
router.put("/:id", putAttendance);
router.delete("/:id", removeAttendance);
router.get("/:id", getAttendanceRecord);

export default router;
import express from "express";
import Attendance from "../services/attendanceService.js";
import { requireRole } from "../middleware/auth.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import { ok } from "../utils/respond.js";
import { validate } from "../middleware/validate.js";
import { idParams } from "../schemas/common.js";
import { createBody, updateBody } from "../schemas/attendanceSchemas.js";

const router = express.Router();

// Attendance is entirely admin/PM-entered — Workers have no attendance screens.
const ADMIN_PM = requireRole('Admin', 'Production Manager');

// P1-3: paged — the highest-cardinality list in the app (one row per worker per day, unbounded
// growth). See ARCHITECTURE_REVIEW.md P1-3.
// More specific routes first
router.get("/worker/:workerId", ADMIN_PM, validate({ params: idParams('workerId') }), async (req, res) => {
  const pagination = parsePagination(req.query);
  const { rows, total } = await Attendance.getWorkerAttendance(req.params.workerId, pagination);
  res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.post("/", ADMIN_PM, validate({ body: createBody }), async (req, res) => {
  const { worker_id, date, day_of_week, time_in, time_out } = req.body;
  const record = await Attendance.postAttendance({ worker_id, date, day_of_week, time_in, time_out });
  res.status(201).json(ok(record));
});

router.put("/:id", ADMIN_PM, validate({ params: idParams(), body: updateBody }), async (req, res) => {
  const { date, day_of_week, time_in, time_out } = req.body;
  const record = await Attendance.putAttendance(req.params.id, { date, day_of_week, time_in, time_out });
  res.status(200).json(ok(record));
});

router.delete("/:id", ADMIN_PM, validate({ params: idParams() }), async (req, res) => {
  await Attendance.removeAttendance(req.params.id);
  res.status(200).json(ok(null));
});

router.get("/:id", ADMIN_PM, validate({ params: idParams() }), async (req, res) => {
  const record = await Attendance.getAttendanceRecord(req.params.id);
  res.status(200).json(ok(record));
});

export default router;

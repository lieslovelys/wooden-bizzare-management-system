import express from 'express';
import JobOrder from '../services/jobOrderService.js';
import { requireRole, requireSelfOrRole, requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ADMIN_PM = requireRole('Admin', 'Production Manager');
const ANY_ASSIGNED_ROLE = requireRole('Admin', 'Production Manager', 'Quality Checker', 'Worker');

router.get('/job-orders', ADMIN_PM, async (req, res) => {
    const jobOrders = await JobOrder.getJobOrders();
    res.status(200).json(jobOrders);
});

router.get('/job-orders/:id', ANY_ASSIGNED_ROLE, async (req, res) => {
    const details = await JobOrder.getJobOrderDetails(req.params.id);
    res.status(200).json(details);
});

// P1-10: renamed from '/workers' — moving userRoutes to mount under '/api' (see server.js)
// made that path collide with userRoutes' own GET /api/workers (account-management worker
// list, a different response shape: {success,data} vs. this endpoint's bare array). Since
// userRoutes is mounted first, the collision would have silently shadowed this one, breaking
// the worker-assignment dropdown in globals/JobOrderDetails.jsx (confirmed by tracing its one
// caller before fixing this).
router.get('/assignable-workers', ADMIN_PM, async (req, res) => {
    const workers = await JobOrder.getWorkersList();
    res.status(200).json(workers);
});

router.get('/job-orders/:id/assignments', ANY_ASSIGNED_ROLE, async (req, res) => {
    const assignments = await JobOrder.getAssignments(req.params.id);
    res.status(200).json(assignments);
});

router.post('/job-orders/:id/assign', ADMIN_PM, async (req, res) => {
    const { stage, workerId, startDate, dueDate } = req.body;
    const newAssignment = await JobOrder.assignTask(req.params.id, workerId, stage, startDate, dueDate);
    res.status(201).json(newAssignment);
});

router.get('/workers/:workerId/tasks', requireSelfOrRole('workerId', 'Admin'), async (req, res) => {
    const tasks = await JobOrder.getWorkerTasks(req.params.workerId);
    res.status(200).json(tasks);
});

router.get('/qa/tasks', requireRole('Admin', 'Production Manager', 'Quality Checker'), async (req, res) => {
    const tasks = await JobOrder.getQATasks();
    res.status(200).json(tasks);
});

// Role/ownership branching for this one happens inside the service (worker submitting their
// own task vs. a reviewer approving/rejecting someone else's) — requireAuth only here.
router.put('/assignments/:assignmentId/status', requireAuth, async (req, res) => {
    const updatedTask = await JobOrder.updateQAStatus(req.params.assignmentId, req.body.status, req.session.user);
    res.status(200).json({ message: "Task status updated successfully", task: updatedTask });
});

export default router;

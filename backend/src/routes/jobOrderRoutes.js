import express from 'express';
import JobOrder from '../services/jobOrderService.js';
import { requireRole, requireSelfOrRole, requireAuth } from '../middleware/auth.js';
import { parsePagination, buildMeta, MAX_LIMIT } from '../utils/pagination.js';
import { ok } from '../utils/respond.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { jobOrdersQuery, workerTasksQuery, qaTasksQuery, assignBody, assignmentStatusBody } from '../schemas/jobOrderSchemas.js';

const router = express.Router();

const ADMIN_PM = requireRole('Admin', 'Production Manager');
const ANY_ASSIGNED_ROLE = requireRole('Admin', 'Production Manager', 'Quality Checker', 'Worker');

// P1-3: paged — see ARCHITECTURE_REVIEW.md P1-3.
router.get('/job-orders', ADMIN_PM, validate({ query: jobOrdersQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { priority, sort } = req.valid.query;
    const { rows, total } = await JobOrder.getJobOrders({ ...pagination, priority, sort });
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.get('/job-orders/:id', ANY_ASSIGNED_ROLE, validate({ params: idParams() }), async (req, res) => {
    const details = await JobOrder.getJobOrderDetails(req.params.id);
    res.status(200).json(ok(details));
});

// P1-10: renamed from '/workers' — moving userRoutes to mount under '/api' (see server.js)
// made that path collide with userRoutes' own GET /api/workers (account-management worker
// list, a different response shape: {success,data} vs. this endpoint's bare array). Since
// userRoutes is mounted first, the collision would have silently shadowed this one, breaking
// the worker-assignment dropdown in globals/JobOrderDetails.jsx (confirmed by tracing its one
// caller before fixing this).
// P1-3: capped-only (a dropdown feed) — defaults to MAX_LIMIT so it isn't silently truncated to
// 25 rows now that the envelope carries a limit at all.
router.get('/assignable-workers', ADMIN_PM, async (req, res) => {
    const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
    const { rows, total } = await JobOrder.getWorkersList(pagination);
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

// P1-3: capped-only (assignment stages per project, naturally bounded).
router.get('/job-orders/:id/assignments', ANY_ASSIGNED_ROLE, validate({ params: idParams() }), async (req, res) => {
    const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
    const { rows, total } = await JobOrder.getAssignments(req.params.id, pagination);
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.post('/job-orders/:id/assign', ADMIN_PM, validate({ params: idParams(), body: assignBody }), async (req, res) => {
    const { stage, workerId, startDate, dueDate } = req.body;
    const newAssignment = await JobOrder.assignTask(req.params.id, workerId, stage, startDate, dueDate);
    res.status(201).json(ok(newAssignment));
});

// P1-3: paged. `status`/`priority` replace worker/WorkerJobOrder.jsx's client-side `.filter()`
// calls, matched exactly (no case normalization) to preserve their old behavior.
router.get('/workers/:workerId/tasks', requireSelfOrRole('workerId', 'Admin'), validate({ params: idParams('workerId'), query: workerTasksQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { status, priority, sort } = req.valid.query;
    const { rows, total } = await JobOrder.getWorkerTasks(req.params.workerId, { ...pagination, status, priority, sort });
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

// P1-3: paged. `stage` replaces globals/ProjectVerification.jsx's client-side `.filter()`.
router.get('/qa/tasks', requireRole('Admin', 'Production Manager', 'Quality Checker'), validate({ query: qaTasksQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { stage } = req.valid.query;
    const { rows, total } = await JobOrder.getQATasks({ ...pagination, stage });
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

// P1-3: resolves a notification deep-link to a single assignment directly, so
// globals/ProjectVerification.jsx doesn't have to search a (now paged) task list for a row that
// may not be on the currently-loaded page. FR-9 remainder: also used by
// worker/WorkerJobOrder.jsx's own task-notification deep-link, so Worker is allowed too — the
// service enforces a Worker can only look up their own assignment.
router.get('/assignments/:assignmentId', requireRole('Admin', 'Production Manager', 'Quality Checker', 'Worker'), validate({ params: idParams('assignmentId') }), async (req, res) => {
    const assignment = await JobOrder.getAssignmentDetails(req.params.assignmentId, req.session.user);
    res.status(200).json(ok(assignment));
});

// Role/ownership branching for this one happens inside the service (worker submitting their
// own task vs. a reviewer approving/rejecting someone else's) — requireAuth only here.
router.put('/assignments/:assignmentId/status', requireAuth, validate({ params: idParams('assignmentId'), body: assignmentStatusBody }), async (req, res) => {
    const { status, notes } = req.valid.body;
    const updatedTask = await JobOrder.updateQAStatus(req.params.assignmentId, status, req.session.user, notes);
    res.status(200).json(ok(updatedTask));
});

export default router;

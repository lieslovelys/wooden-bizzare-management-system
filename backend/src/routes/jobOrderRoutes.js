import express from 'express';
import { getJobOrders, getJobOrderDetails, getWorkersList, getAssignments, assignTask, getWorkerTasks, getQATasks,
    updateQAStatus } from '../controllers/jobOrderController.js';
import { requireRole, requireSelfOrRole, requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ADMIN_PM = requireRole('Admin', 'Production Manager');
const ANY_ASSIGNED_ROLE = requireRole('Admin', 'Production Manager', 'Quality Checker', 'Worker');

router.get('/job-orders', ADMIN_PM, getJobOrders);
router.get('/job-orders/:id', ANY_ASSIGNED_ROLE, getJobOrderDetails);
// P1-10: renamed from '/workers' — moving userRoutes to mount under '/api' (see server.js)
// made that path collide with userRoutes' own GET /api/workers (account-management worker
// list, a different response shape: {success,data} vs. this endpoint's bare array). Since
// userRoutes is mounted first, the collision would have silently shadowed this one, breaking
// the worker-assignment dropdown in globals/JobOrderDetails.jsx (confirmed by tracing its one
// caller before fixing this).
router.get('/assignable-workers', ADMIN_PM, getWorkersList);
router.get('/job-orders/:id/assignments', ANY_ASSIGNED_ROLE, getAssignments);
router.post('/job-orders/:id/assign', ADMIN_PM, assignTask);
router.get('/workers/:workerId/tasks', requireSelfOrRole('workerId', 'Admin'), getWorkerTasks);
router.get('/qa/tasks', requireRole('Admin', 'Production Manager', 'Quality Checker'), getQATasks);
// Role/ownership branching for this one happens inside the controller (worker submitting their
// own task vs. a reviewer approving/rejecting someone else's) — requireAuth only here.
router.put('/assignments/:assignmentId/status', requireAuth, updateQAStatus);

export default router;

// Also export for direct API access
export { getWorkersList };
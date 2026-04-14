import express from 'express';
import { getJobOrders, getJobOrderDetails, getWorkersList, getAssignments, assignTask, getWorkerTasks, getQATasks,
    updateQAStatus } from '../controllers/jobOrderController.js';

const router = express.Router();

router.get('/job-orders', getJobOrders);
router.get('/job-orders/:id', getJobOrderDetails);
router.get('/workers', getWorkersList); 
router.get('/job-orders/:id/assignments', getAssignments); 
router.post('/job-orders/:id/assign', assignTask); 
router.get('/workers/:workerId/tasks', getWorkerTasks);
router.get('/qa/tasks', getQATasks); 
router.put('/assignments/:assignmentId/status', updateQAStatus); 

export default router;

// Also export for direct API access
export { getWorkersList };
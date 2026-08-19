import express from 'express';
import { getStats } from '../controllers/adminDashboardController.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', requireRole('Admin', 'Production Manager'), getStats);

export default router;
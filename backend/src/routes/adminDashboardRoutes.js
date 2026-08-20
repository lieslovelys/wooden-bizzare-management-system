import express from 'express';
import Dashboard from '../services/adminDashboardService.js';
import { requireRole } from '../middleware/auth.js';
import { ok } from '../utils/respond.js';

const router = express.Router();

router.get('/stats', requireRole('Admin', 'Production Manager'), async (req, res) => {
    const stats = await Dashboard.getStats();
    res.status(200).json(ok(stats));
});

export default router;

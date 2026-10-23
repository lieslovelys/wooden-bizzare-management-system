import express from 'express';
import Dashboard from '../services/adminDashboardService.js';
import { requireRole } from '../middleware/auth.js';
import { ok } from '../utils/respond.js';

const router = express.Router();

router.get('/stats', requireRole('Admin', 'Production Manager'), async (req, res) => {
    const stats = await Dashboard.getStats();
    res.status(200).json(ok(stats));
});

// Item 48 — Admin only, same as every /api/profit route (money, not ops status).
router.get('/profit-trend', requireRole('Admin'), async (req, res) => {
    const trend = await Dashboard.getProfitTrend();
    res.status(200).json(ok(trend));
});

export default router;

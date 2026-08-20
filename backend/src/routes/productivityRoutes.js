import express from 'express';
import Productivity from '../services/productivityService.js';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta, MAX_LIMIT } from '../utils/pagination.js';
import { ok } from '../utils/respond.js';

const router = express.Router();

// P1-3: capped-only (a leaderboard over the worker headcount, no paging UI) — defaults to
// MAX_LIMIT so the leaderboard isn't silently truncated to 25 rows. See
// ARCHITECTURE_REVIEW.md P1-3.
// Ang endpoint natin ay magiging GET /api/productivity
router.get('/', requireRole('Admin'), async (req, res) => {
    const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
    const { rows, total } = await Productivity.getProductivityStats(pagination);
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

export default router;

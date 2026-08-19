import express from 'express';
import Productivity from '../services/productivityService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Ang endpoint natin ay magiging GET /api/productivity
router.get('/', requireRole('Admin'), async (req, res) => {
    const stats = await Productivity.getProductivityStats();
    res.status(200).json(stats);
});

export default router;

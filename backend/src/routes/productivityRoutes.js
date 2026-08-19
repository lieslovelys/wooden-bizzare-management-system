import express from 'express';
import { getProductivityStats } from '../controllers/productivityController.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Ang endpoint natin ay magiging GET /api/productivity
router.get('/', requireRole('Admin'), getProductivityStats);

export default router;
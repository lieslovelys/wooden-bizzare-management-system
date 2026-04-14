import express from 'express';
import { getProductivityStats } from '../controllers/productivityController.js';

const router = express.Router();

// Ang endpoint natin ay magiging GET /api/productivity
router.get('/', getProductivityStats);

export default router;
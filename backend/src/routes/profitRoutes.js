import express from "express";
import * as ProfitController from "../controllers/profitController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

const ADMIN_ONLY = requireRole('Admin');

router.get("/:projectId", ADMIN_ONLY, ProfitController.getProfit);
router.post("/:projectId", ADMIN_ONLY, ProfitController.saveProfit);
router.delete("/:projectId", ADMIN_ONLY, ProfitController.deleteProfit);

export default router;
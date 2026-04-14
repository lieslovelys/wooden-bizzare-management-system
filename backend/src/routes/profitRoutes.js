import express from "express";
import * as ProfitController from "../controllers/profitController.js";

const router = express.Router();

router.get("/:projectId", ProfitController.getProfit);
router.post("/:projectId", ProfitController.saveProfit);
router.delete("/:projectId", ProfitController.deleteProfit);

export default router;
import express from "express";
import Profit from "../services/profitService.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

const ADMIN_ONLY = requireRole('Admin');

router.get("/:projectId", ADMIN_ONLY, async (req, res) => {
  const profit = await Profit.getProfit(req.params.projectId);
  res.json(profit);
});

router.post("/:projectId", ADMIN_ONLY, async (req, res) => {
  const { client_payment, worker_wages, materials_cost, other_expenses, expense_items } = req.body;

  // Check if the values are numbers (allow 0)
  if (typeof client_payment !== 'number' || typeof worker_wages !== 'number' ||
      typeof materials_cost !== 'number' || typeof other_expenses !== 'number') {
    console.error("[saveProfit] Invalid amount field types for project", req.params.projectId);
    return res.status(400).json({ error: "All amount fields must be valid numbers." });
  }

  const result = await Profit.saveProfit(req.params.projectId, {
    client_payment,
    worker_wages,
    materials_cost,
    other_expenses,
    expense_items
  });
  res.json(result);
});

router.delete("/:projectId", ADMIN_ONLY, async (req, res) => {
  await Profit.deleteProfit(req.params.projectId);
  res.json({ message: "Profit record deleted." });
});

export default router;

import express from "express";
import Profit from "../services/profitService.js";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParams } from "../schemas/common.js";
import { profitBody } from "../schemas/profitSchemas.js";

const router = express.Router();

const ADMIN_ONLY = requireRole('Admin');

router.get("/:projectId", ADMIN_ONLY, validate({ params: idParams('projectId') }), async (req, res) => {
  const profit = await Profit.getProfit(req.params.projectId);
  res.json(profit);
});

router.post("/:projectId", ADMIN_ONLY, validate({ params: idParams('projectId'), body: profitBody }), async (req, res) => {
  const { client_payment, worker_wages, materials_cost, other_expenses, expense_items } = req.body;

  const result = await Profit.saveProfit(req.params.projectId, {
    client_payment,
    worker_wages,
    materials_cost,
    other_expenses,
    expense_items
  });
  res.json(result);
});

router.delete("/:projectId", ADMIN_ONLY, validate({ params: idParams('projectId') }), async (req, res) => {
  await Profit.deleteProfit(req.params.projectId);
  res.json({ message: "Profit record deleted." });
});

export default router;

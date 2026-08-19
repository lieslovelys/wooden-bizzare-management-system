import {
  getProfitByProjectId,
  upsertProfit,
  deleteProfitByProjectId,
} from "../models/profitModel.js";

// ============================================================
// PROFIT CONTROLLERS
// ============================================================

export async function getProfit(req, res) {
  try { 
    res.json(await getProfitByProjectId(req.params.projectId)); 
  } catch (err) { 
    console.error("[getProfit]", err); 
    res.status(500).json({ error: "Failed to fetch profit data." }); 
  }
}

export async function saveProfit(req, res) {
  const { client_payment, worker_wages, materials_cost, other_expenses, expense_items } = req.body;

  // Check if the values are numbers (allow 0)
  if (typeof client_payment !== 'number' || typeof worker_wages !== 'number' ||
      typeof materials_cost !== 'number' || typeof other_expenses !== 'number') {
    console.error("[saveProfit] Invalid amount field types for project", req.params.projectId);
    return res.status(400).json({ error: "All amount fields must be valid numbers." });
  }

  try {
    const result = await upsertProfit(req.params.projectId, {
      client_payment,
      worker_wages,
      materials_cost,
      other_expenses,
      expense_items
    });
    res.json(result);
  } catch (err) {
    console.error("[saveProfit] Error for project", req.params.projectId, err.message);
    res.status(500).json({ error: "Failed to save profit data." });
  }
}

export async function deleteProfit(req, res) {
  try {
    const deleted = await deleteProfitByProjectId(req.params.projectId);
    if (!deleted) return res.status(404).json({ error: "No profit record found for this project." });
    res.json({ message: "Profit record deleted." });
  } catch (err) { 
    console.error("[deleteProfit]", err); 
    res.status(500).json({ error: "Failed to delete profit data." }); 
  }
}
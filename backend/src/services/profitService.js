import {
  getProfitByProjectId,
  upsertProfit,
  deleteProfitByProjectId,
} from "../models/profitModel.js";
import { AppError } from "../errors/AppError.js";

// ============================================================
// PROFIT SERVICE
// ============================================================

const getProfit = (projectId) => getProfitByProjectId(projectId);

// FR-7: `recordedBy` is the session user's id, threaded through from the route.
const saveProfit = (projectId, data, recordedBy) => upsertProfit(projectId, data, recordedBy);

const deleteProfit = async (projectId) => {
  const deleted = await deleteProfitByProjectId(projectId);
  if (!deleted) throw new AppError(404, "No profit record found for this project.");
};

export default {
  getProfit,
  saveProfit,
  deleteProfit
}

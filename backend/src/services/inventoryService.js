import {
  getAllItems,
  getItemById,
  getLowStock,
  createItemWithVariants,
  updateItemWithVariants,
  deleteItem,
  getVariantById,
  adjustVariantStock,
  getVariantMovements,
  getProjectMaterials,
  OVER_RETURN,
} from "../models/inventoryModel.js";
import { getAllProjects, getProjectById } from "../models/projectModel.js";
import { AppError } from "../errors/AppError.js";

const getItems = (pagination) => getAllItems(pagination);

const getLowStockItems = (pagination) => getLowStock(pagination);

const getItem = async (id) => {
  const item = await getItemById(id);
  if (!item) throw new AppError(404, 'Inventory item not found');
  return item;
};

const createItem = (dto) => createItemWithVariants(dto);

const updateItem = async (id, dto) => {
  const updated = await updateItemWithVariants(id, dto);
  if (!updated) throw new AppError(404, 'Inventory item not found');
  return getItemById(id);
};

const removeItem = async (id) => {
  const deleted = await deleteItem(id);
  if (!deleted) throw new AppError(404, 'Inventory item not found');
};

// Caller identity is passed in explicitly by the route (req.session.user.user_id) — this
// function never touches req/res/next, matching the convention jobOrderService.updateQAStatus
// and userService.deleteUser already established.
// FR-3: `projectId` optionally tags the movement as consumed by / returned to a project. The
// schema layer already restricts which reason/delta combinations may carry one — this function
// checks the project itself actually exists and is still open, which a schema can't express.
const adjustStock = async (variantId, delta, reason, callerId, projectId) => {
  if (projectId != null) {
    const project = await getProjectById(projectId);
    if (!project) throw new AppError(404, 'Project not found');
    if (project.status === 'Completed') throw new AppError(409, 'Project is already completed');
  }

  const resultingStock = await adjustVariantStock(variantId, delta, reason, callerId, projectId ?? null);
  if (resultingStock === OVER_RETURN) {
    throw new AppError(409, 'Cannot return more than this project has used');
  }
  if (resultingStock === null) {
    // Disambiguate "no such variant" from "would go negative" with one follow-up read — the
    // UPDATE's WHERE clause can't tell the two apart, and the caller needs different errors.
    const variant = await getVariantById(variantId);
    if (!variant) throw new AppError(404, 'Variant not found');
    throw new AppError(409, 'Insufficient stock');
  }
  return resultingStock;
};

const getMovements = async (variantId, pagination) => {
  const variant = await getVariantById(variantId);
  if (!variant) throw new AppError(404, 'Variant not found');
  return getVariantMovements(variantId, pagination);
};

// FR-3: the picker feed for "which project is this stock movement for" on both the Job Order
// and Inventory screens — open projects only, since a Completed project can no longer be tagged
// (adjustStock enforces that; this just keeps the dropdown from offering it in the first place).
const getOpenProjects = (pagination) => getAllProjects({ ...pagination, status: ['Pending', 'In Progress'] });

const getMaterials = async (projectId, pagination) => {
  const project = await getProjectById(projectId);
  if (!project) throw new AppError(404, 'Project not found');
  return getProjectMaterials(projectId, pagination);
};

export default {
  getItems,
  getLowStockItems,
  getItem,
  createItem,
  updateItem,
  removeItem,
  adjustStock,
  getMovements,
  getOpenProjects,
  getMaterials,
};

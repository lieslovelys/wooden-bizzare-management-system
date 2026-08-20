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
} from "../models/inventoryModel.js";
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
const adjustStock = async (variantId, delta, reason, callerId) => {
  const resultingStock = await adjustVariantStock(variantId, delta, reason, callerId);
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

export default {
  getItems,
  getLowStockItems,
  getItem,
  createItem,
  updateItem,
  removeItem,
  adjustStock,
  getMovements,
};

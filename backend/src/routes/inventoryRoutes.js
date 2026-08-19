import express from 'express';
import Inventory from '../services/inventoryService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// PRD B.4's capability matrix grants inventory management to all three of these roles.
const INVENTORY_ROLES = requireRole('Admin', 'Production Manager', 'Inventory Staff');

const ALLOWED_CATEGORIES = ['Raw Material', 'Tool', 'Consumable'];
const ADJUST_REASONS = ['Received', 'Used', 'Damaged', 'Correction'];

function validateItemBody(body) {
  const { name, category, unit, variants } = body;
  if (typeof name !== 'string' || !name.trim()) return 'name is required.';
  if (!ALLOWED_CATEGORIES.includes(category)) return 'Invalid category.';
  if (typeof unit !== 'string' || !unit.trim()) return 'unit is required.';
  if (!Array.isArray(variants) || variants.length === 0) return 'At least one variant is required.';
  for (const v of variants) {
    if (typeof v.name !== 'string' || !v.name.trim()) return 'Each variant needs a name.';
    if (v.minStock !== undefined && (!Number.isInteger(v.minStock) || v.minStock < 0)) {
      return 'minStock must be a non-negative integer.';
    }
  }
  return null;
}

router.get('/', INVENTORY_ROLES, async (req, res) => {
  const items = await Inventory.getItems();
  res.status(200).json({ success: true, data: items });
});

router.post('/', INVENTORY_ROLES, async (req, res) => {
  const validationError = validateItemBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const itemId = await Inventory.createItem(req.body);
  res.status(201).json({ success: true, message: 'Item created successfully', itemId });
});

// Must be registered before GET /:id, or it is shadowed and resolves as an item lookup for the
// literal id "low-stock" — same class of route-order trap the /history route in
// projectRoutes.js and the /workers collision from P1-10 both guard against.
router.get('/low-stock', INVENTORY_ROLES, async (req, res) => {
  const items = await Inventory.getLowStockItems();
  res.status(200).json({ success: true, data: items });
});

router.get('/:id', INVENTORY_ROLES, async (req, res) => {
  const item = await Inventory.getItem(req.params.id);
  res.status(200).json({ success: true, data: item });
});

router.put('/:id', INVENTORY_ROLES, async (req, res) => {
  const validationError = validateItemBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const item = await Inventory.updateItem(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Item updated successfully', data: item });
});

router.delete('/:id', INVENTORY_ROLES, async (req, res) => {
  await Inventory.removeItem(req.params.id);
  res.status(200).json({ success: true, message: 'Item deleted successfully' });
});

router.post('/variants/:variantId/adjust', INVENTORY_ROLES, async (req, res) => {
  const { delta, reason } = req.body;
  if (!Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ error: 'delta must be a non-zero integer.' });
  }
  if (reason !== undefined && !ADJUST_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason.' });
  }

  const resultingStock = await Inventory.adjustStock(
    req.params.variantId,
    delta,
    reason,
    req.session.user.user_id
  );
  res.status(200).json({ success: true, data: { resultingStock } });
});

router.get('/variants/:variantId/movements', INVENTORY_ROLES, async (req, res) => {
  const movements = await Inventory.getMovements(req.params.variantId);
  res.status(200).json({ success: true, data: movements });
});

export default router;

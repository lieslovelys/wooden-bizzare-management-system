import express from 'express';
import Inventory from '../services/inventoryService.js';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta, MAX_LIMIT } from '../utils/pagination.js';
import { ok } from '../utils/respond.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { inventoryItemBody, adjustBody } from '../schemas/inventorySchemas.js';

const router = express.Router();

// PRD B.4's capability matrix grants inventory management to all three of these roles.
const INVENTORY_ROLES = requireRole('Admin', 'Production Manager', 'Inventory Staff');

// P1-3: capped-only (SKU-bounded, no paging UI) — defaults to MAX_LIMIT. See
// ARCHITECTURE_REVIEW.md P1-3.
router.get('/', INVENTORY_ROLES, async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
  const { rows, total } = await Inventory.getItems(pagination);
  res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.post('/', INVENTORY_ROLES, validate({ body: inventoryItemBody }), async (req, res) => {
  const itemId = await Inventory.createItem(req.body);
  res.status(201).json(ok({ itemId }));
});

// Must be registered before GET /:id, or it is shadowed and resolves as an item lookup for the
// literal id "low-stock" — same class of route-order trap the /history route in
// projectRoutes.js and the /workers collision from P1-10 both guard against.
// P1-3: capped-only.
router.get('/low-stock', INVENTORY_ROLES, async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
  const { rows, total } = await Inventory.getLowStockItems(pagination);
  res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

// FR-3: the project picker for tagging a stock movement — GET /api/projects is Admin-only, so
// Inventory Staff (who can adjust stock but can't see the Projects screen) need their own way to
// list open projects. Registered before GET /:id for the same route-order reason as /low-stock.
// P1-3: capped-only (open projects are naturally bounded).
router.get('/projects', INVENTORY_ROLES, async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
  const { rows, total } = await Inventory.getOpenProjects(pagination);
  res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

// FR-3: a project's materials-consumed summary, read by globals/ProjectMaterials.jsx. Also
// registered before GET /:id for the same reason.
// P1-3: capped-only (a project draws from a small, bounded set of variants in practice).
router.get('/projects/:projectId/materials', INVENTORY_ROLES, validate({ params: idParams('projectId') }), async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
  const { rows, total } = await Inventory.getMaterials(req.params.projectId, pagination);
  res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.get('/:id', INVENTORY_ROLES, validate({ params: idParams() }), async (req, res) => {
  const item = await Inventory.getItem(req.params.id);
  res.status(200).json(ok(item));
});

router.put('/:id', INVENTORY_ROLES, validate({ params: idParams(), body: inventoryItemBody }), async (req, res) => {
  const item = await Inventory.updateItem(req.params.id, req.body);
  res.status(200).json(ok(item));
});

router.delete('/:id', INVENTORY_ROLES, validate({ params: idParams() }), async (req, res) => {
  await Inventory.removeItem(req.params.id);
  res.status(200).json(ok(null));
});

router.post('/variants/:variantId/adjust', INVENTORY_ROLES, validate({ params: idParams('variantId'), body: adjustBody }), async (req, res) => {
  const { delta, reason, projectId } = req.body;
  const resultingStock = await Inventory.adjustStock(
    req.params.variantId,
    delta,
    reason,
    req.session.user.user_id,
    projectId
  );
  res.status(200).json(ok({ resultingStock }));
});

// P1-3: paged — an append-only audit log with no ceiling, the strongest case for pagination in
// the codebase.
router.get('/variants/:variantId/movements', INVENTORY_ROLES, validate({ params: idParams('variantId') }), async (req, res) => {
  const pagination = parsePagination(req.query);
  const { rows, total } = await Inventory.getMovements(req.params.variantId, pagination);
  res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

export default router;

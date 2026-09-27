import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

vi.mock('../models/inventoryModel.js', () => ({
  getAllItems: vi.fn(),
  getItemById: vi.fn(),
  getLowStock: vi.fn(),
  createItemWithVariants: vi.fn(),
  updateItemWithVariants: vi.fn(),
  deleteItem: vi.fn(),
  getVariantById: vi.fn(),
  adjustVariantStock: vi.fn(),
  getVariantMovements: vi.fn(),
  getProjectMaterials: vi.fn(),
  OVER_RETURN: Symbol('over-return'),
}));

// FR-3: adjustStock's project checks read the project through projectModel.js, not
// inventoryModel.js — mocked separately so its call args can be asserted independently.
vi.mock('../models/projectModel.js', () => ({
  getAllProjects: vi.fn(),
  getProjectById: vi.fn(),
}));

const model = await import('../models/inventoryModel.js');
const projectModel = await import('../models/projectModel.js');
const InventoryService = (await import('../services/inventoryService.js')).default;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inventoryService.getItem', () => {
  it('returns the item when the model finds one', async () => {
    model.getItemById.mockResolvedValue({ id: 1, name: 'Plywood' });
    const item = await InventoryService.getItem(1);
    expect(item).toEqual({ id: 1, name: 'Plywood' });
    expect(model.getItemById).toHaveBeenCalledWith(1);
  });

  it('throws AppError(404) when the model finds nothing', async () => {
    model.getItemById.mockResolvedValue(null);
    await expect(InventoryService.getItem(999)).rejects.toMatchObject({
      status: 404,
      body: { error: 'Inventory item not found' },
    });
  });
});

describe('inventoryService.updateItem', () => {
  it('throws AppError(404) when the update matches no row', async () => {
    model.updateItemWithVariants.mockResolvedValue(null);
    await expect(InventoryService.updateItem(999, {})).rejects.toBeInstanceOf(AppError);
  });

  it('re-reads the item after a successful update', async () => {
    model.updateItemWithVariants.mockResolvedValue(1);
    model.getItemById.mockResolvedValue({ id: 1, name: 'Updated' });
    const result = await InventoryService.updateItem(1, { name: 'Updated' });
    expect(result).toEqual({ id: 1, name: 'Updated' });
  });
});

describe('inventoryService.removeItem', () => {
  it('throws AppError(404) when nothing was deleted', async () => {
    model.deleteItem.mockResolvedValue(false);
    await expect(InventoryService.removeItem(999)).rejects.toMatchObject({ status: 404 });
  });

  it('resolves silently on a real delete', async () => {
    model.deleteItem.mockResolvedValue(true);
    await expect(InventoryService.removeItem(1)).resolves.toBeUndefined();
  });
});

describe('inventoryService.adjustStock', () => {
  it('passes the caller id through to the model, with a null projectId when untagged', async () => {
    model.adjustVariantStock.mockResolvedValue(4);
    await InventoryService.adjustStock(5, -1, 'Used', 42);
    expect(model.adjustVariantStock).toHaveBeenCalledWith(5, -1, 'Used', 42, null);
  });

  it('returns the resulting stock on success', async () => {
    model.adjustVariantStock.mockResolvedValue(4);
    const result = await InventoryService.adjustStock(5, -1, 'Used', 42);
    expect(result).toBe(4);
  });

  it('throws AppError(404) when the variant does not exist', async () => {
    model.adjustVariantStock.mockResolvedValue(null);
    model.getVariantById.mockResolvedValue(null);
    await expect(InventoryService.adjustStock(999, -1, 'Used', 42)).rejects.toMatchObject({
      status: 404,
      body: { error: 'Variant not found' },
    });
  });

  it('throws AppError(409) when the adjustment would go negative', async () => {
    model.adjustVariantStock.mockResolvedValue(null);
    model.getVariantById.mockResolvedValue({ id: 5, current_stock: 0 });
    await expect(InventoryService.adjustStock(5, -10, 'Used', 42)).rejects.toMatchObject({
      status: 409,
      body: { error: 'Insufficient stock' },
    });
  });

  // FR-3
  describe('with a projectId', () => {
    it('throws AppError(404) when the project does not exist, without touching the model', async () => {
      projectModel.getProjectById.mockResolvedValue(null);
      await expect(InventoryService.adjustStock(5, -1, 'Used', 42, 99)).rejects.toMatchObject({
        status: 404,
        body: { error: 'Project not found' },
      });
      expect(model.adjustVariantStock).not.toHaveBeenCalled();
    });

    it('throws AppError(409) when the project is already completed', async () => {
      projectModel.getProjectById.mockResolvedValue({ id: 99, status: 'Completed' });
      await expect(InventoryService.adjustStock(5, -1, 'Used', 42, 99)).rejects.toMatchObject({
        status: 409,
        body: { error: 'Project is already completed' },
      });
      expect(model.adjustVariantStock).not.toHaveBeenCalled();
    });

    it('forwards the projectId to the model on an open project', async () => {
      projectModel.getProjectById.mockResolvedValue({ id: 99, status: 'In Progress' });
      model.adjustVariantStock.mockResolvedValue(7);
      await InventoryService.adjustStock(5, -3, 'Used', 42, 99);
      expect(model.adjustVariantStock).toHaveBeenCalledWith(5, -3, 'Used', 42, 99);
    });

    it('throws AppError(409) when the model reports an over-return', async () => {
      projectModel.getProjectById.mockResolvedValue({ id: 99, status: 'Pending' });
      model.adjustVariantStock.mockResolvedValue(model.OVER_RETURN);
      await expect(InventoryService.adjustStock(5, 10, 'Returned', 42, 99)).rejects.toMatchObject({
        status: 409,
        body: { error: 'Cannot return more than this project has used' },
      });
    });
  });
});

describe('inventoryService.getOpenProjects', () => {
  it('filters to Pending/In Progress projects', async () => {
    projectModel.getAllProjects.mockResolvedValue({ rows: [{ id: 1 }], total: 1 });
    const result = await InventoryService.getOpenProjects({ limit: 200, offset: 0 });
    expect(result).toEqual({ rows: [{ id: 1 }], total: 1 });
    expect(projectModel.getAllProjects).toHaveBeenCalledWith({
      limit: 200,
      offset: 0,
      status: ['Pending', 'In Progress'],
    });
  });
});

describe('inventoryService.getMaterials', () => {
  it('throws AppError(404) for an unknown project', async () => {
    projectModel.getProjectById.mockResolvedValue(null);
    await expect(InventoryService.getMaterials(999, {})).rejects.toMatchObject({ status: 404 });
    expect(model.getProjectMaterials).not.toHaveBeenCalled();
  });

  it('returns the model rows for a known project', async () => {
    projectModel.getProjectById.mockResolvedValue({ id: 1 });
    model.getProjectMaterials.mockResolvedValue({ rows: [{ variant_id: 5, net_used: 2 }], total: 1 });
    const result = await InventoryService.getMaterials(1, { limit: 200, offset: 0 });
    expect(result).toEqual({ rows: [{ variant_id: 5, net_used: 2 }], total: 1 });
  });
});

describe('inventoryService.getMovements', () => {
  it('throws AppError(404) for an unknown variant', async () => {
    model.getVariantById.mockResolvedValue(null);
    await expect(InventoryService.getMovements(999)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the movement history for a known variant', async () => {
    model.getVariantById.mockResolvedValue({ id: 5 });
    model.getVariantMovements.mockResolvedValue([{ id: 1, delta: -1 }]);
    const movements = await InventoryService.getMovements(5);
    expect(movements).toEqual([{ id: 1, delta: -1 }]);
  });
});

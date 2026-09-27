import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors/AppError.js';

vi.mock('../services/inventoryService.js', () => ({
  default: {
    getItems: vi.fn(),
    getLowStockItems: vi.fn(),
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    adjustStock: vi.fn(),
    getMovements: vi.fn(),
    getOpenProjects: vi.fn(),
    getMaterials: vi.fn(),
  },
}));

const Inventory = (await import('../services/inventoryService.js')).default;
const inventoryRoutes = (await import('../routes/inventoryRoutes.js')).default;

// A bare app with a stubbed session, mirroring how app.js wires the real one — no real
// express-session/connect-pg-simple, so these tests need no database. See ARCHITECTURE_REVIEW.md
// P1-11 for why route-level tests mock the service layer rather than exercising real SQL.
function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use('/api/inventory', inventoryRoutes);
  app.use(errorHandler);
  return app;
}

const ADMIN = { user_id: 1, user_role: 'Admin' };
const WORKER = { user_id: 2, user_role: 'Worker' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth', () => {
  it('401s every route with no session', async () => {
    const app = buildApp(null);
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });

  it('403s a role not in the inventory allowlist', async () => {
    const app = buildApp(WORKER);
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/inventory', () => {
  it('returns the {success, data, meta} envelope', async () => {
    Inventory.getItems.mockResolvedValue({ rows: [{ id: 1, name: 'Plywood' }], total: 1 });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ id: 1, name: 'Plywood' }],
      meta: { page: 1, limit: 200, total: 1, totalPages: 1 },
    });
  });

  it('400s a non-integer page', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory?page=abc');
    expect(res.status).toBe(400);
    expect(Inventory.getItems).not.toHaveBeenCalled();
  });

  it('clamps a limit above MAX_LIMIT rather than erroring', async () => {
    Inventory.getItems.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory?limit=99999');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(200);
  });
});

describe('GET /api/inventory/low-stock', () => {
  it('resolves to the low-stock endpoint, not GET /:id', async () => {
    Inventory.getLowStockItems.mockResolvedValue({ rows: [{ variant_id: 5 }], total: 1 });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/low-stock');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ variant_id: 5 }],
      meta: { page: 1, limit: 200, total: 1, totalPages: 1 },
    });
    expect(Inventory.getLowStockItems).toHaveBeenCalledOnce();
    expect(Inventory.getItem).not.toHaveBeenCalled();
  });
});

describe('GET /api/inventory/projects', () => {
  it('resolves to the project-picker endpoint, not GET /:id', async () => {
    Inventory.getOpenProjects.mockResolvedValue({ rows: [{ id: 1, project_name: 'Cabinet' }], total: 1 });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/projects');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 1, project_name: 'Cabinet' }]);
    expect(Inventory.getItem).not.toHaveBeenCalled();
  });
});

describe('GET /api/inventory/projects/:projectId/materials', () => {
  it('resolves to the materials endpoint, not GET /:id', async () => {
    Inventory.getMaterials.mockResolvedValue({ rows: [{ variant_id: 5, net_used: 2 }], total: 1 });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/projects/1/materials');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ variant_id: 5, net_used: 2 }],
      meta: { page: 1, limit: 200, total: 1, totalPages: 1 },
    });
    expect(Inventory.getItem).not.toHaveBeenCalled();
  });

  it('400s a non-numeric projectId', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/projects/abc/materials');
    expect(res.status).toBe(400);
    expect(Inventory.getMaterials).not.toHaveBeenCalled();
  });
});

describe('GET /api/inventory/:id', () => {
  it('returns the item', async () => {
    Inventory.getItem.mockResolvedValue({ id: 1, name: 'Plywood' });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: 1, name: 'Plywood' } });
  });

  it('renders a service AppError(404) via the centralized error handler', async () => {
    Inventory.getItem.mockRejectedValue(new AppError(404, 'Inventory item not found'));
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Inventory item not found' });
  });
});

describe('POST /api/inventory', () => {
  const validBody = {
    name: 'Plywood',
    category: 'Raw Material',
    unit: 'sheet',
    variants: [{ name: '4x8', minStock: 5 }],
  };

  it('400s a missing name', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory').send({ ...validBody, name: '' });
    expect(res.status).toBe(400);
    expect(Inventory.createItem).not.toHaveBeenCalled();
  });

  it('400s an invalid category', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory').send({ ...validBody, category: 'Nope' });
    expect(res.status).toBe(400);
  });

  it('400s an empty variants array', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory').send({ ...validBody, variants: [] });
    expect(res.status).toBe(400);
  });

  it('creates the item on a valid body', async () => {
    Inventory.createItem.mockResolvedValue(7);
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { itemId: 7 } });
    expect(Inventory.createItem).toHaveBeenCalledWith(validBody);
  });
});

describe('PUT /api/inventory/:id', () => {
  const validBody = {
    name: 'Plywood',
    category: 'Tool',
    unit: 'pcs',
    variants: [{ id: 1, name: '4x8', minStock: 3 }],
  };

  it('400s an invalid body the same way POST does', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).put('/api/inventory/1').send({ ...validBody, unit: '' });
    expect(res.status).toBe(400);
  });

  it('updates on a valid body', async () => {
    Inventory.updateItem.mockResolvedValue({ id: 1, ...validBody });
    const app = buildApp(ADMIN);
    const res = await request(app).put('/api/inventory/1').send(validBody);
    expect(res.status).toBe(200);
    expect(Inventory.updateItem).toHaveBeenCalledWith('1', validBody);
  });
});

describe('DELETE /api/inventory/:id', () => {
  it('deletes and returns the success envelope', async () => {
    Inventory.removeItem.mockResolvedValue(undefined);
    const app = buildApp(ADMIN);
    const res = await request(app).delete('/api/inventory/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });
});

describe('POST /api/inventory/variants/:variantId/adjust', () => {
  it('400s a missing delta', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory/variants/5/adjust').send({ reason: 'Used' });
    expect(res.status).toBe(400);
    expect(Inventory.adjustStock).not.toHaveBeenCalled();
  });

  it('400s a zero delta', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory/variants/5/adjust').send({ delta: 0 });
    expect(res.status).toBe(400);
  });

  it('400s a non-integer delta', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/inventory/variants/5/adjust').send({ delta: 1.5 });
    expect(res.status).toBe(400);
  });

  it('400s an invalid reason', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app)
      .post('/api/inventory/variants/5/adjust')
      .send({ delta: 1, reason: 'Not a real reason' });
    expect(res.status).toBe(400);
  });

  it('passes the session user id through as the caller', async () => {
    Inventory.adjustStock.mockResolvedValue(4);
    const app = buildApp(ADMIN);
    const res = await request(app)
      .post('/api/inventory/variants/5/adjust')
      .send({ delta: -1, reason: 'Used' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { resultingStock: 4 } });
    expect(Inventory.adjustStock).toHaveBeenCalledWith('5', -1, 'Used', 1, undefined);
  });

  it('renders a service AppError(409) via the centralized error handler', async () => {
    Inventory.adjustStock.mockRejectedValue(new AppError(409, 'Insufficient stock'));
    const app = buildApp(ADMIN);
    const res = await request(app)
      .post('/api/inventory/variants/5/adjust')
      .send({ delta: -100, reason: 'Used' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Insufficient stock' });
  });

  // FR-3: the reason/projectId/delta pairing rules enforced by schemas/inventorySchemas.js's
  // adjustBody superRefine.
  describe('project tagging', () => {
    it('400s a Returned adjustment with no projectId', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/inventory/variants/5/adjust')
        .send({ delta: 1, reason: 'Returned' });
      expect(res.status).toBe(400);
      expect(Inventory.adjustStock).not.toHaveBeenCalled();
    });

    it('400s a Returned adjustment with a negative delta', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/inventory/variants/5/adjust')
        .send({ delta: -1, reason: 'Returned', projectId: 1 });
      expect(res.status).toBe(400);
    });

    it('400s a projectId tagged to a Damaged adjustment', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/inventory/variants/5/adjust')
        .send({ delta: -1, reason: 'Damaged', projectId: 1 });
      expect(res.status).toBe(400);
    });

    it('400s a Used adjustment tagged to a project with a positive delta', async () => {
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/inventory/variants/5/adjust')
        .send({ delta: 1, reason: 'Used', projectId: 1 });
      expect(res.status).toBe(400);
    });

    it('forwards a valid projectId to the service', async () => {
      Inventory.adjustStock.mockResolvedValue(4);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/inventory/variants/5/adjust')
        .send({ delta: -3, reason: 'Used', projectId: 1 });
      expect(res.status).toBe(200);
      expect(Inventory.adjustStock).toHaveBeenCalledWith('5', -3, 'Used', 1, 1);
    });

    it('forwards a valid Returned projectId to the service', async () => {
      Inventory.adjustStock.mockResolvedValue(4);
      const app = buildApp(ADMIN);
      const res = await request(app)
        .post('/api/inventory/variants/5/adjust')
        .send({ delta: 3, reason: 'Returned', projectId: 1 });
      expect(res.status).toBe(200);
      expect(Inventory.adjustStock).toHaveBeenCalledWith('5', 3, 'Returned', 1, 1);
    });
  });
});

describe('GET /api/inventory/variants/:variantId/movements', () => {
  it('returns the movement history', async () => {
    Inventory.getMovements.mockResolvedValue({ rows: [{ id: 1, delta: -1 }], total: 1 });
    const app = buildApp(ADMIN);
    const res = await request(app).get('/api/inventory/variants/5/movements');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ id: 1, delta: -1 }],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
  });
});

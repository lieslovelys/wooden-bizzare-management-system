import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';

// Item 48 — GET /api/dashboard/profit-trend. Role gating itself is covered end-to-end by
// routeAuthorization.test.js; this just checks the route reaches the service and shapes the
// response envelope correctly.
vi.mock('../services/adminDashboardService.js', () => ({
  default: {
    getStats: vi.fn(),
    getProfitTrend: vi.fn(),
  },
}));

const Dashboard = (await import('../services/adminDashboardService.js')).default;
const adminDashboardRoutes = (await import('../routes/adminDashboardRoutes.js')).default;

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use('/api/dashboard', adminDashboardRoutes);
  app.use(errorHandler);
  return app;
}

const ADMIN = { user_id: 1, user_role: 'Admin' };
const PM = { user_id: 2, user_role: 'Production Manager' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/dashboard/profit-trend', () => {
  it('returns the service result wrapped in the standard envelope', async () => {
    const trend = [{ month: '2026-01', netProfit: 0 }, { month: '2026-02', netProfit: 500 }];
    Dashboard.getProfitTrend.mockResolvedValue(trend);

    const res = await request(buildApp(ADMIN)).get('/api/dashboard/profit-trend');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: trend });
    expect(Dashboard.getProfitTrend).toHaveBeenCalledTimes(1);
  });

  it('is Admin-only, unlike /stats which also allows Production Manager', async () => {
    const res = await request(buildApp(PM)).get('/api/dashboard/profit-trend');

    expect(res.status).toBe(403);
    expect(Dashboard.getProfitTrend).not.toHaveBeenCalled();
  });
});

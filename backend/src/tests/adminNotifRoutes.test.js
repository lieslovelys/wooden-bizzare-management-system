import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';

// P2 (notification-component consolidation): mark-all-read and clear/all gained an optional
// ?type= query param so the Production Manager and Quality Checker notification screens can
// bulk-act on just their own type instead of looping one request per row — see
// ARCHITECTURE_REVIEW.md P2. These tests cover only that new behavior; the pre-existing routes
// in this file have no other test coverage yet (tracked separately, same P2 bullet).
vi.mock('../services/adminNotifService.js', () => ({
  default: {
    getNotifications: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAllNotifications: vi.fn(),
    deleteNotification: vi.fn(),
    markOneAsRead: vi.fn(),
  },
}));

const Notif = (await import('../services/adminNotifService.js')).default;
const adminNotifRoutes = (await import('../routes/adminNotifRoutes.js')).default;

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use('/api/notifications', adminNotifRoutes);
  app.use(errorHandler);
  return app;
}

const PM = { user_id: 1, user_role: 'Production Manager' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/notifications/mark-all-read', () => {
  it('omitting ?type= preserves the original unscoped call', async () => {
    Notif.markAllAsRead.mockResolvedValue([]);
    const app = buildApp(PM);
    const res = await request(app).put('/api/notifications/mark-all-read');
    expect(res.status).toBe(200);
    expect(Notif.markAllAsRead).toHaveBeenCalledWith(null);
  });

  it('passes a known ?type= through to the service', async () => {
    Notif.markAllAsRead.mockResolvedValue([]);
    const app = buildApp(PM);
    const res = await request(app).put('/api/notifications/mark-all-read?type=project');
    expect(res.status).toBe(200);
    expect(Notif.markAllAsRead).toHaveBeenCalledWith('project');
  });

  it('400s an unknown type without calling the service', async () => {
    const app = buildApp(PM);
    const res = await request(app).put('/api/notifications/mark-all-read?type=bogus');
    expect(res.status).toBe(400);
    expect(Notif.markAllAsRead).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/notifications/clear/all', () => {
  it('omitting ?type= preserves the original unscoped call', async () => {
    Notif.clearAllNotifications.mockResolvedValue(undefined);
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/clear/all');
    expect(res.status).toBe(200);
    expect(Notif.clearAllNotifications).toHaveBeenCalledWith(null);
  });

  it('passes a known ?type= through to the service', async () => {
    Notif.clearAllNotifications.mockResolvedValue(undefined);
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/clear/all?type=verification');
    expect(res.status).toBe(200);
    expect(Notif.clearAllNotifications).toHaveBeenCalledWith('verification');
  });

  it('400s an unknown type without calling the service', async () => {
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/clear/all?type=bogus');
    expect(res.status).toBe(400);
    expect(Notif.clearAllNotifications).not.toHaveBeenCalled();
  });
});

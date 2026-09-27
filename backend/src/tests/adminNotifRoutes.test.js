import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors/AppError.js';

// P2 (notification-component consolidation) + FR-4 (per-user notifications, PRD.md C.1): every
// handler now forwards req.session.user through to the service as `caller`, so the model/service
// layer can scope visibility and read/dismiss state to that one user — see
// services/adminNotifService.js. These tests cover the caller-forwarding and role-gating; the
// visibility/scoping logic itself is covered by tests/adminNotifModel.test.js.
vi.mock('../services/adminNotifService.js', () => ({
  default: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
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
const WORKER = { user_id: 9, user_role: 'Worker' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/notifications', () => {
  it('passes the caller through to the service alongside pagination/type', async () => {
    Notif.getNotifications.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp(PM);
    const res = await request(app).get('/api/notifications?type=project&page=2&limit=10');
    expect(res.status).toBe(200);
    expect(Notif.getNotifications).toHaveBeenCalledWith(
      PM,
      { page: 2, limit: 10, offset: 10, type: 'project' },
    );
  });

  it('Worker (no notification screen) gets 403', async () => {
    const app = buildApp(WORKER);
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(403);
    expect(Notif.getNotifications).not.toHaveBeenCalled();
  });

  it('an unauthenticated caller gets 401', async () => {
    const app = buildApp(null);
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
    expect(Notif.getNotifications).not.toHaveBeenCalled();
  });
});

describe('GET /api/notifications/unread-count', () => {
  it('passes the caller through and returns the count', async () => {
    Notif.getUnreadCount.mockResolvedValue(3);
    const app = buildApp(PM);
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { count: 3 } });
    expect(Notif.getUnreadCount).toHaveBeenCalledWith(PM);
  });

  it('does not get shadowed by the /:id route', async () => {
    // A regression guard: /unread-count must be registered before /:id, or it would 400 trying
    // to parse "unread-count" as a numeric id instead.
    Notif.getUnreadCount.mockResolvedValue(0);
    const app = buildApp(PM);
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/notifications/mark-all-read', () => {
  it('omitting ?type= preserves the original unscoped call', async () => {
    Notif.markAllAsRead.mockResolvedValue([]);
    const app = buildApp(PM);
    const res = await request(app).put('/api/notifications/mark-all-read');
    expect(res.status).toBe(200);
    expect(Notif.markAllAsRead).toHaveBeenCalledWith(PM, null);
  });

  it('passes a known ?type= through to the service', async () => {
    Notif.markAllAsRead.mockResolvedValue([]);
    const app = buildApp(PM);
    const res = await request(app).put('/api/notifications/mark-all-read?type=project');
    expect(res.status).toBe(200);
    expect(Notif.markAllAsRead).toHaveBeenCalledWith(PM, 'project');
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
    expect(Notif.clearAllNotifications).toHaveBeenCalledWith(PM, null);
  });

  it('passes a known ?type= through to the service', async () => {
    Notif.clearAllNotifications.mockResolvedValue(undefined);
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/clear/all?type=verification');
    expect(res.status).toBe(200);
    expect(Notif.clearAllNotifications).toHaveBeenCalledWith(PM, 'verification');
  });

  it('400s an unknown type without calling the service', async () => {
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/clear/all?type=bogus');
    expect(res.status).toBe(400);
    expect(Notif.clearAllNotifications).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/notifications/:id', () => {
  it('passes the caller through to the service', async () => {
    Notif.deleteNotification.mockResolvedValue(undefined);
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/5');
    expect(res.status).toBe(200);
    expect(Notif.deleteNotification).toHaveBeenCalledWith(PM, '5');
  });

  it('propagates a 404 from the service (not visible / already gone)', async () => {
    Notif.deleteNotification.mockRejectedValue(new AppError(404, 'Notification not found'));
    const app = buildApp(PM);
    const res = await request(app).delete('/api/notifications/5');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/notifications/:id/read', () => {
  it('passes the caller through to the service', async () => {
    Notif.markOneAsRead.mockResolvedValue(undefined);
    const app = buildApp(PM);
    const res = await request(app).put('/api/notifications/5/read');
    expect(res.status).toBe(200);
    expect(Notif.markOneAsRead).toHaveBeenCalledWith(PM, '5');
  });
});

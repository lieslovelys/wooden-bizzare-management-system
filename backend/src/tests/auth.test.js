import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAuth, requireRole, requireSelfOrRole } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';

// This is the entire P0-2 authorization fix (ARCHITECTURE_REVIEW.md P0-2: "No authorization
// middleware on any route") and, until now, it had zero test coverage — every route's real
// security boundary was only ever exercised by hand. Tested directly against fake req/res/next
// rather than through supertest, since these are plain functions with no Express app needed;
// one supertest case at the bottom proves the one requireSelfOrRole call site actually has the
// middleware mounted, not just that the middleware itself is correct in isolation.

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  it('401s when there is no session at all', () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when the session has no user', () => {
    const req = { session: {} };
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when a user is present', () => {
    const req = { session: { user: { user_id: 1, user_role: 'Admin' } } };
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('401s (not 403) when unauthenticated, even against an empty allowlist', () => {
    // The unauthenticated check runs before the role check — an anonymous caller should never
    // learn anything about which roles a route accepts.
    const req = {};
    const res = makeRes();
    const next = vi.fn();
    requireRole('Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s an authenticated caller whose role is not in the allowlist', () => {
    const req = { session: { user: { user_id: 1, user_role: 'Worker' } } };
    const res = makeRes();
    const next = vi.fn();
    requireRole('Admin', 'Production Manager')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the caller holds one of the allowed roles', () => {
    const req = { session: { user: { user_id: 1, user_role: 'Production Manager' } } };
    const res = makeRes();
    const next = vi.fn();
    requireRole('Admin', 'Production Manager')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireSelfOrRole', () => {
  it('401s when unauthenticated', () => {
    const req = { params: { workerId: '5' } };
    const res = makeRes();
    const next = vi.fn();
    requireSelfOrRole('workerId', 'Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the caller is acting on their own id', () => {
    const req = { session: { user: { user_id: 5, user_role: 'Worker' } }, params: { workerId: '5' } };
    const res = makeRes();
    const next = vi.fn();
    requireSelfOrRole('workerId', 'Admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when the caller is not self but holds an allowed role', () => {
    const req = { session: { user: { user_id: 1, user_role: 'Admin' } }, params: { workerId: '5' } };
    const res = makeRes();
    const next = vi.fn();
    requireSelfOrRole('workerId', 'Admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('403s when the caller is neither self nor holds an allowed role', () => {
    const req = { session: { user: { user_id: 1, user_role: 'Worker' } }, params: { workerId: '5' } };
    const res = makeRes();
    const next = vi.fn();
    requireSelfOrRole('workerId', 'Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('compares the id and the param as strings, so a numeric session id still matches', () => {
    // user_id on req.session.user is a number (as it comes off the DB row); req.params values
    // are always strings. Both sides go through String() before comparing — if that coercion
    // were dropped, `5 === '5'` would be false and every self-access would 403.
    const req = { session: { user: { user_id: 5, user_role: 'Worker' } }, params: { workerId: '5' } };
    const res = makeRes();
    const next = vi.fn();
    requireSelfOrRole('workerId', 'Admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not fail open on a lookalike id ("5" vs "50")', () => {
    const req = { session: { user: { user_id: 5, user_role: 'Worker' } }, params: { workerId: '50' } };
    const res = makeRes();
    const next = vi.fn();
    requireSelfOrRole('workerId', 'Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// Pins the one requireSelfOrRole call site (jobOrderRoutes.js's GET /workers/:workerId/tasks)
// end to end through supertest — proving the middleware is actually mounted on the route, not
// just correct as a standalone function.
vi.mock('../services/jobOrderService.js', () => ({
  default: {
    getJobOrders: vi.fn(),
    getJobOrderDetails: vi.fn(),
    getWorkersList: vi.fn(),
    getAssignments: vi.fn(),
    assignTask: vi.fn(),
    getWorkerTasks: vi.fn(),
    getQATasks: vi.fn(),
    updateQAStatus: vi.fn(),
    getAssignmentDetails: vi.fn(),
  },
}));

const JobOrder = (await import('../services/jobOrderService.js')).default;
const jobOrderRoutes = (await import('../routes/jobOrderRoutes.js')).default;

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use('/api/job-orders', jobOrderRoutes);
  app.use(errorHandler);
  return app;
}

describe('requireSelfOrRole mounted on GET /workers/:workerId/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403s a Worker requesting another worker\'s task list', async () => {
    const app = buildApp({ user_id: 5, user_role: 'Worker' });
    const res = await request(app).get('/api/job-orders/workers/99/tasks');
    expect(res.status).toBe(403);
    expect(JobOrder.getWorkerTasks).not.toHaveBeenCalled();
  });

  it('200s a Worker requesting their own task list', async () => {
    JobOrder.getWorkerTasks.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp({ user_id: 5, user_role: 'Worker' });
    const res = await request(app).get('/api/job-orders/workers/5/tasks');
    expect(res.status).toBe(200);
    expect(JobOrder.getWorkerTasks).toHaveBeenCalledTimes(1);
  });

  it('200s an Admin requesting any worker\'s task list', async () => {
    JobOrder.getWorkerTasks.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp({ user_id: 1, user_role: 'Admin' });
    const res = await request(app).get('/api/job-orders/workers/99/tasks');
    expect(res.status).toBe(200);
  });
});

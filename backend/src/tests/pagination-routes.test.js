import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';

// P1-3: covers two representative paged routes end to end — one that already answered
// {success,data} (projects) and one that used to be a bare array (job-orders) — asserting the
// `meta` block, limit clamping, a bad filter value 400ing, and that filters reach the service.
// See ARCHITECTURE_REVIEW.md P1-3.

vi.mock('../services/projectService.js', () => ({
  default: {
    createProject: vi.fn(),
    getProjects: vi.fn(),
    getSingleProject: vi.fn(),
    updateExistingProject: vi.fn(),
    completeProject: vi.fn(),
    getProjectHistory: vi.fn(),
    removeProject: vi.fn(),
  },
}));

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

const Project = (await import('../services/projectService.js')).default;
const JobOrder = (await import('../services/jobOrderService.js')).default;
const projectRoutes = (await import('../routes/projectRoutes.js')).default;
const jobOrderRoutes = (await import('../routes/jobOrderRoutes.js')).default;

function buildApp(user, mount, router) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use(mount, router);
  app.use(errorHandler);
  return app;
}

const ADMIN = { user_id: 1, user_role: 'Admin' };
const PM = { user_id: 2, user_role: 'Production Manager' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/projects (already {success,data})', () => {
  it('returns data plus a meta block', async () => {
    Project.getProjects.mockResolvedValue({ rows: [{ id: 1, project_name: 'Cabinet' }], total: 1 });
    const app = buildApp(ADMIN, '/api/projects', projectRoutes);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ id: 1, project_name: 'Cabinet' }],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
  });

  it('clamps a limit above MAX_LIMIT rather than erroring', async () => {
    Project.getProjects.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp(ADMIN, '/api/projects', projectRoutes);
    const res = await request(app).get('/api/projects?limit=99999');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(200);
  });

  it('400s an invalid status without calling the service', async () => {
    const app = buildApp(ADMIN, '/api/projects', projectRoutes);
    const res = await request(app).get('/api/projects?status=Bogus');
    expect(res.status).toBe(400);
    expect(Project.getProjects).not.toHaveBeenCalled();
  });

  it('passes search and a CSV status filter through to the service', async () => {
    Project.getProjects.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp(ADMIN, '/api/projects', projectRoutes);
    await request(app).get('/api/projects?search=cabinet&status=Pending,In Progress');
    expect(Project.getProjects).toHaveBeenCalledWith(expect.objectContaining({
      search: 'cabinet',
      status: ['Pending', 'In Progress'],
    }));
  });
});

describe('GET /api/job-orders (formerly a bare array)', () => {
  it('now returns {success, data, meta} instead of a bare array', async () => {
    JobOrder.getJobOrders.mockResolvedValue({ rows: [{ id: 1, project_name: 'Table' }], total: 1 });
    const app = buildApp(PM, '/api', jobOrderRoutes);
    const res = await request(app).get('/api/job-orders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ id: 1, project_name: 'Table' }],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
  });

  it('400s an invalid priority value without calling the service', async () => {
    const app = buildApp(PM, '/api', jobOrderRoutes);
    const res = await request(app).get('/api/job-orders?priority=Urgent');
    expect(res.status).toBe(400);
    expect(JobOrder.getJobOrders).not.toHaveBeenCalled();
  });

  it('passes a CSV priority filter and sort through to the service', async () => {
    JobOrder.getJobOrders.mockResolvedValue({ rows: [], total: 0 });
    const app = buildApp(PM, '/api', jobOrderRoutes);
    await request(app).get('/api/job-orders?priority=High,Low&sort=desc');
    expect(JobOrder.getJobOrders).toHaveBeenCalledWith(expect.objectContaining({
      priority: ['High', 'Low'],
      sort: 'desc',
    }));
  });

  it('400s page=0', async () => {
    const app = buildApp(PM, '/api', jobOrderRoutes);
    const res = await request(app).get('/api/job-orders?page=0');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/assignments/:assignmentId (new deep-link endpoint)', () => {
  it('returns the single assignment', async () => {
    JobOrder.getAssignmentDetails.mockResolvedValue({ assignment_id: 5, project_id: 3 });
    const app = buildApp(PM, '/api', jobOrderRoutes);
    const res = await request(app).get('/api/assignments/5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { assignment_id: 5, project_id: 3 } });
    expect(JobOrder.getAssignmentDetails).toHaveBeenCalledWith('5', PM);
  });

  // FR-9 remainder: a Worker's own task-notification deep-link uses this same endpoint now —
  // the service (not this route) enforces they can only look up their own assignment.
  it('allows a Worker caller, forwarding their identity for the service to scope', async () => {
    const WORKER = { user_id: 9, user_role: 'Worker' };
    JobOrder.getAssignmentDetails.mockResolvedValue({ assignment_id: 5, worker_id: 9 });
    const app = buildApp(WORKER, '/api', jobOrderRoutes);
    const res = await request(app).get('/api/assignments/5');
    expect(res.status).toBe(200);
    expect(JobOrder.getAssignmentDetails).toHaveBeenCalledWith('5', WORKER);
  });
});

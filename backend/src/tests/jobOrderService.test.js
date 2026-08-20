import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

// jobOrderService.updateQAStatus carries the fix for P0-3 ("Workers can self-approve their own
// QA") and the state-machine enforcement PRD FR-6 credits as done — see
// ARCHITECTURE_REVIEW.md P0-3 and PRD.md FR-6. Neither had any test coverage before this file.

vi.mock('../models/jobOrderModel.js', () => ({
  getAllJobOrders: vi.fn(),
  getJobOrderById: vi.fn(),
  getWorkers: vi.fn(),
  getProjectAssignments: vi.fn(),
  createJobAssignment: vi.fn(),
  getTasksByWorkerId: vi.fn(),
  getAssignmentById: vi.fn(),
  updateAssignmentStatus: vi.fn(),
  getTasksForQA: vi.fn(),
}));

vi.mock('../models/adminNotifModel.js', () => ({
  createNotification: vi.fn(),
}));

const jobOrderModel = await import('../models/jobOrderModel.js');
const adminNotifModel = await import('../models/adminNotifModel.js');
const JobOrderService = (await import('../services/jobOrderService.js')).default;

const WORKER = { user_id: 5, user_role: 'Worker' };
const OTHER_WORKER = { user_id: 6, user_role: 'Worker' };
const ADMIN = { user_id: 1, user_role: 'Admin' };
const PM = { user_id: 2, user_role: 'Production Manager' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('jobOrderService.updateQAStatus', () => {
  it('404s when the assignment does not exist', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue(null);
    await expect(JobOrderService.updateQAStatus(999, 'For QA', WORKER)).rejects.toMatchObject({
      status: 404,
    });
    expect(jobOrderModel.updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it("403s a Worker acting on another worker's assignment", async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: OTHER_WORKER.user_id, status: 'Assigned' });
    await expect(JobOrderService.updateQAStatus(1, 'For QA', WORKER)).rejects.toMatchObject({
      status: 403,
    });
    expect(jobOrderModel.updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it('400s a Worker trying to self-approve their own task (P0-3)', async () => {
    // This is the exact exploit P0-3 closed: a worker sending {status:'Approved'} for their
    // own assignment used to succeed outright with no check at all.
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    await expect(JobOrderService.updateQAStatus(1, 'Approved', WORKER)).rejects.toMatchObject({
      status: 400,
    });
    expect(jobOrderModel.updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it("400s a reviewer sending a status outside 'Approved'/'Repair'", async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    await expect(JobOrderService.updateQAStatus(1, 'Assigned', ADMIN)).rejects.toMatchObject({
      status: 400,
    });
    expect(jobOrderModel.updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it('409s when the conditional update matches no row (bad current-state transition)', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'Assigned' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue(undefined);
    await expect(JobOrderService.updateQAStatus(1, 'Approved', ADMIN)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("a Worker submitting 'For QA' passes WORKER_SUBMITTABLE_FROM and notifies QC exactly once", async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'Assigned' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'For QA' });

    const result = await JobOrderService.updateQAStatus(1, 'For QA', WORKER);

    expect(result).toEqual({ assignment_id: 1, status: 'For QA' });
    expect(jobOrderModel.updateAssignmentStatus).toHaveBeenCalledWith(
      1,
      'For QA',
      ['Assigned', 'Repair', 'In Progress', 'Rework'],
    );
    expect(adminNotifModel.createNotification).toHaveBeenCalledTimes(1);
    expect(adminNotifModel.createNotification).toHaveBeenCalledWith(
      'verification',
      expect.any(String),
      expect.any(String),
      'QC',
      1,
    );
  });

  it('a reviewer approving passes REVIEWABLE_FROM and sends no notification', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'Approved' });

    const result = await JobOrderService.updateQAStatus(1, 'Approved', PM);

    expect(result).toEqual({ assignment_id: 1, status: 'Approved' });
    expect(jobOrderModel.updateAssignmentStatus).toHaveBeenCalledWith(1, 'Approved', ['For QA']);
    expect(adminNotifModel.createNotification).not.toHaveBeenCalled();
  });

  it('a reviewer setting Repair also passes REVIEWABLE_FROM and sends no notification', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'Repair' });

    await JobOrderService.updateQAStatus(1, 'Repair', ADMIN);

    expect(jobOrderModel.updateAssignmentStatus).toHaveBeenCalledWith(1, 'Repair', ['For QA']);
    expect(adminNotifModel.createNotification).not.toHaveBeenCalled();
  });
});

describe('jobOrderService.getAssignmentDetails', () => {
  it('404s when the model finds nothing', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue(null);
    await expect(JobOrderService.getAssignmentDetails(999)).rejects.toBeInstanceOf(AppError);
  });

  it('returns the assignment when found', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1 });
    const result = await JobOrderService.getAssignmentDetails(1);
    expect(result).toEqual({ assignment_id: 1 });
  });
});

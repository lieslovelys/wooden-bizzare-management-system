import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

// jobOrderService.updateQAStatus carries the fix for P0-3 ("Workers can self-approve their own
// QA"), the state-machine enforcement PRD FR-6 credits as done, and (added in track A) FR-7's
// qa_checker_id/qa_notes audit trail — see ARCHITECTURE_REVIEW.md P0-3 and PRD.md FR-6/FR-7.

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

  it("a Worker submitting 'For QA' passes WORKER_SUBMITTABLE_FROM, writes no audit fields, and notifies QC exactly once", async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'Assigned' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'For QA' });

    const result = await JobOrderService.updateQAStatus(1, 'For QA', WORKER);

    expect(result).toEqual({ assignment_id: 1, status: 'For QA' });
    // FR-7: a worker's own submission never attributes qa_checker_id/qa_notes — those columns
    // only ever get written on the reviewer branch below.
    expect(jobOrderModel.updateAssignmentStatus).toHaveBeenCalledWith(
      1,
      'For QA',
      ['Assigned', 'Repair', 'In Progress', 'Rework'],
      null,
      null,
    );
    expect(adminNotifModel.createNotification).toHaveBeenCalledTimes(1);
    expect(adminNotifModel.createNotification).toHaveBeenCalledWith(
      'verification',
      expect.any(String),
      expect.any(String),
      'Quality Checker', // FR-4: target_role is the real user_role enum value, not 'QC'
      1,
    );
  });

  it('a reviewer approving passes REVIEWABLE_FROM, records who approved, and notifies the owning worker (FR-9)', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'Approved', stage_name: 'Carpenter' });

    const result = await JobOrderService.updateQAStatus(1, 'Approved', PM);

    expect(result).toEqual({ assignment_id: 1, status: 'Approved', stage_name: 'Carpenter' });
    // FR-7: PM.user_id (2) is written as qa_checker_id even though PM keeps approve rights —
    // the segregation gap PRD B.1 flags becomes visible in data rather than closed by fiat.
    expect(jobOrderModel.updateAssignmentStatus).toHaveBeenCalledWith(1, 'Approved', ['For QA'], PM.user_id, null);
    // FR-9 remainder: 'task'-typed, target_user_id-scoped to the worker who owns the assignment —
    // never a 'Worker'-wide broadcast, which would put every other worker's outcome in their list.
    expect(adminNotifModel.createNotification).toHaveBeenCalledTimes(1);
    expect(adminNotifModel.createNotification).toHaveBeenCalledWith(
      'task',
      expect.any(String),
      expect.stringContaining('Carpenter'),
      null,
      1,
      WORKER.user_id,
    );
  });

  it('a reviewer setting Repair with a reason passes it through as qa_notes and notifies the worker with that reason (FR-9)', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'Repair', stage_name: 'Painter' });

    await JobOrderService.updateQAStatus(1, 'Repair', ADMIN, 'Joints are loose, redo the frame.');

    expect(jobOrderModel.updateAssignmentStatus).toHaveBeenCalledWith(
      1,
      'Repair',
      ['For QA'],
      ADMIN.user_id,
      'Joints are loose, redo the frame.',
    );
    expect(adminNotifModel.createNotification).toHaveBeenCalledTimes(1);
    expect(adminNotifModel.createNotification).toHaveBeenCalledWith(
      'task',
      expect.any(String),
      expect.stringContaining('Joints are loose, redo the frame.'),
      null,
      1,
      WORKER.user_id,
    );
  });

  // FR-6: PRD B.5 workflow 5 used to let a repair action carry no reason at all — a worker
  // learned only that their status changed. These two are the actual regression tests for that.
  it('400s a reviewer setting Repair with no notes at all', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    await expect(JobOrderService.updateQAStatus(1, 'Repair', ADMIN)).rejects.toMatchObject({
      status: 400,
    });
    expect(jobOrderModel.updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it('400s a reviewer setting Repair with a whitespace-only reason', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    await expect(JobOrderService.updateQAStatus(1, 'Repair', ADMIN, '   ')).rejects.toMatchObject({
      status: 400,
    });
    expect(jobOrderModel.updateAssignmentStatus).not.toHaveBeenCalled();
  });

  it('does not require a reason to Approve', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id, status: 'For QA' });
    jobOrderModel.updateAssignmentStatus.mockResolvedValue({ assignment_id: 1, status: 'Approved' });

    await expect(JobOrderService.updateQAStatus(1, 'Approved', ADMIN)).resolves.toEqual({
      assignment_id: 1,
      status: 'Approved',
    });
  });
});

describe('jobOrderService.getJobOrderDetails', () => {
  it('404s when the model finds nothing', async () => {
    jobOrderModel.getJobOrderById.mockResolvedValue(null);
    await expect(JobOrderService.getJobOrderDetails(999)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the job order when found', async () => {
    const details = { id: 1, project_name: 'Cabinet Set' };
    jobOrderModel.getJobOrderById.mockResolvedValue(details);
    await expect(JobOrderService.getJobOrderDetails(1)).resolves.toEqual(details);
  });
});

describe('jobOrderService.getAssignmentDetails', () => {
  it('404s when the model finds nothing', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue(null);
    await expect(JobOrderService.getAssignmentDetails(999)).rejects.toBeInstanceOf(AppError);
  });

  it('returns the assignment when found (no caller — reviewer deep-link)', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1 });
    const result = await JobOrderService.getAssignmentDetails(1);
    expect(result).toEqual({ assignment_id: 1 });
  });

  // FR-9 remainder: a Worker can now deep-link into this same endpoint from their own task
  // notification — restricted to their own assignment, same shape as updateQAStatus's guard.
  it("403s a Worker looking up another worker's assignment", async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: OTHER_WORKER.user_id });
    await expect(JobOrderService.getAssignmentDetails(1, WORKER)).rejects.toMatchObject({ status: 403 });
  });

  it('returns the assignment for the Worker who owns it', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: WORKER.user_id });
    const result = await JobOrderService.getAssignmentDetails(1, WORKER);
    expect(result).toEqual({ assignment_id: 1, worker_id: WORKER.user_id });
  });

  it('returns any assignment for a reviewer caller', async () => {
    jobOrderModel.getAssignmentById.mockResolvedValue({ assignment_id: 1, worker_id: OTHER_WORKER.user_id });
    const result = await JobOrderService.getAssignmentDetails(1, ADMIN);
    expect(result).toEqual({ assignment_id: 1, worker_id: OTHER_WORKER.user_id });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

// projectService.completeProject carries FR-8's server-side enforcement of "every assigned
// stage must be Approved before a project can complete" (PRD.md B.5 workflow 6) — previously
// only a disabled-button check in globals/JobOrderDetails.jsx, so a direct API call could
// complete a project with outstanding work, and completing an unknown project id silently
// answered 200 (models/projectModel.js used to return `res.rows[0]`, undefined on no match).
// See ARCHITECTURE_REVIEW.md track-A plan, findings 1 and 3.

vi.mock('../models/projectModel.js', () => ({
  createProjectWithVariables: vi.fn(),
  getAllProjects: vi.fn(),
  getProjectById: vi.fn(),
  updateProject: vi.fn(),
  markProjectAsCompleted: vi.fn(),
  getCompletedProjectsHistory: vi.fn(),
  deleteProjectById: vi.fn(),
}));

vi.mock('../models/adminNotifModel.js', () => ({
  createNotification: vi.fn(),
}));

const projectModel = await import('../models/projectModel.js');
const adminNotifModel = await import('../models/adminNotifModel.js');
const ProjectService = (await import('../services/projectService.js')).default;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projectService.completeProject', () => {
  it('404s when the project does not exist', async () => {
    projectModel.markProjectAsCompleted.mockResolvedValue(null);
    await expect(ProjectService.completeProject(999)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('409s when an assigned stage is not yet Approved', async () => {
    projectModel.markProjectAsCompleted.mockResolvedValue({
      incomplete: true,
      totalAssigned: 3,
      approvedCount: 2,
    });
    await expect(ProjectService.completeProject(1)).rejects.toBeInstanceOf(AppError);
    await expect(ProjectService.completeProject(1)).rejects.toMatchObject({ status: 409 });
  });

  it('409s when no stage has been assigned at all', async () => {
    projectModel.markProjectAsCompleted.mockResolvedValue({
      incomplete: true,
      totalAssigned: 0,
      approvedCount: 0,
    });
    await expect(ProjectService.completeProject(1)).rejects.toMatchObject({ status: 409 });
  });

  it('resolves with the completed project when every assigned stage is Approved', async () => {
    const completed = { id: 1, status: 'Completed', date_completed: '2026-08-20' };
    projectModel.markProjectAsCompleted.mockResolvedValue(completed);
    await expect(ProjectService.completeProject(1)).resolves.toEqual(completed);
  });
});

// Previously untested (ARCHITECTURE_REVIEW.md item 12/19) — the same 404-on-missing-project
// shape completeProject already covers above.
describe('projectService.getSingleProject', () => {
  it('404s when the project does not exist', async () => {
    projectModel.getProjectById.mockResolvedValue(null);
    await expect(ProjectService.getSingleProject(999)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the project when found', async () => {
    const project = { id: 1, project_name: 'Cabinet Set' };
    projectModel.getProjectById.mockResolvedValue(project);
    await expect(ProjectService.getSingleProject(1)).resolves.toEqual(project);
  });
});

describe('projectService.removeProject', () => {
  it('404s when nothing was deleted', async () => {
    projectModel.deleteProjectById.mockResolvedValue(false);
    await expect(ProjectService.removeProject(999)).rejects.toMatchObject({ status: 404 });
  });

  it('resolves silently on a real delete', async () => {
    projectModel.deleteProjectById.mockResolvedValue(true);
    await expect(ProjectService.removeProject(1)).resolves.toBeUndefined();
  });
});

describe('projectService.createProject', () => {
  it('still returns the new project id when the notification insert fails', async () => {
    // Deliberate swallow (see the service's own try/catch) — a notifications-table hiccup must
    // never fail project creation itself.
    projectModel.createProjectWithVariables.mockResolvedValue(42);
    adminNotifModel.createNotification.mockRejectedValue(new Error('notifications table missing'));
    await expect(ProjectService.createProject({ project_name: 'Cabinet Set' })).resolves.toBe(42);
  });
});

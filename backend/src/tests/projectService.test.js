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

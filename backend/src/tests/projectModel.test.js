import { describe, it, expect, vi, beforeEach } from 'vitest';

// FR-8 regression guard: getAllProjects used to recompute `status` on every read via a
// correlated `EXISTS` subquery against job_assignments (a second source of truth alongside the
// stored `projects.status` column — see migrations/*_project-status-single-source-of-truth.js
// and PRD.md B.6). This asserts the query it actually sends selects the stored column directly
// rather than reintroducing that recomputation.

vi.mock('../config/db.js', () => ({
  getClient: vi.fn(),
  query: vi.fn(),
}));

const db = await import('../config/db.js');
const { getAllProjects } = await import('../models/projectModel.js');

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeClient() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
  db.getClient.mockResolvedValue(client);
  return client;
}

describe('projectModel.getAllProjects', () => {
  it('selects the stored status column directly, with no EXISTS recomputation', async () => {
    const client = fakeClient();
    await getAllProjects({ limit: 25, offset: 0 });

    const [sql] = client.query.mock.calls[0];
    expect(sql).toContain('p.status');
    expect(sql).not.toMatch(/EXISTS/i);
    expect(client.release).toHaveBeenCalled();
  });
});

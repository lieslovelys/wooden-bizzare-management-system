import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectHistory from './ProjectHistory';

// Previously untested (ARCHITECTURE_REVIEW.md item 19/23). Uses the real usePaginatedList hook
// (only ../api/client is mocked) — matches how usePaginatedList.test.js itself is tested, and
// lets this file assert on the actual query string ProjectHistory builds.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const HISTORY_PAGE = {
  success: true,
  data: [
    { id: 3, project_name: 'Cabinet Set', date_started: '2026-01-01', date_completed: '2026-01-10', remark: 'Early' },
  ],
  meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

const PROJECT_DETAILS = {
  success: true,
  data: {
    id: 3, project_name: 'Cabinet Set', due_date: '2026-01-15', priority_level: 'High',
    date_completed: '2026-01-10', variables: [{ id: 1, variable_name: 'Wood', variable_detail: 'Narra' }],
  },
};

const TASKS = {
  success: true,
  data: [
    {
      assignment_id: 1, stage_name: 'Cutting', first_name: 'Juan', last_name: 'Dela Cruz',
      start_date: '2026-01-02', date_completed: '2026-01-08', due_date: '2026-01-15', status: 'Approved',
    },
    {
      assignment_id: 2, stage_name: 'Sanding', first_name: 'Maria', last_name: 'Santos',
      start_date: '2026-01-09', date_completed: null, due_date: null, status: 'Approved',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/projects/history')) return Promise.resolve(HISTORY_PAGE);
    if (url === '/api/job-orders/3') return Promise.resolve(PROJECT_DETAILS);
    if (url === '/api/job-orders/3/assignments') return Promise.resolve(TASKS);
    return Promise.resolve({ success: true, data: [] });
  });
});

describe('ProjectHistory', () => {
  it('renders the list with a remark badge', async () => {
    render(<ProjectHistory />);
    expect(await screen.findByText('Cabinet Set')).toBeInTheDocument();
    // "Early" is also one of the filter <select>'s <option> labels — scope to the badge.
    expect(screen.getByText('Early', { selector: 'span' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/projects/history?'));
  });

  it('sends no remark param for "All"', async () => {
    render(<ProjectHistory />);
    await screen.findByText('Cabinet Set');
    const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/projects/history'))[0];
    expect(call).not.toContain('remark=');
  });

  it('requests the selected remark filter', async () => {
    render(<ProjectHistory />);
    await screen.findByText('Cabinet Set');
    api.get.mockClear();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Late' } });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('remark=Late')));
  });

  it('drills into a project: fetches details/assignments and shows the progress count', async () => {
    render(<ProjectHistory />);
    await screen.findByText('Cabinet Set');

    fireEvent.click(screen.getByText('Cabinet Set'));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/job-orders/3'));
    expect(api.get).toHaveBeenCalledWith('/api/job-orders/3/assignments');
    expect(await screen.findByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('Wood:', { exact: false })).toBeInTheDocument();
  });

  it('computes each task remark, falling back to the project completion date when the task has none', async () => {
    render(<ProjectHistory />);
    await screen.findByText('Cabinet Set');
    fireEvent.click(screen.getByText('Cabinet Set'));
    await screen.findByText('2/2');

    // Task 1: completed 2026-01-08 vs its own due_date 2026-01-15 -> Early. Task 2: no
    // date_completed/due_date of its own, but is Approved -> falls back to the project's
    // date_completed (2026-01-10) vs the project's due_date (2026-01-15) -> Early too.
    expect(screen.getAllByText('Early', { selector: 'span' })).toHaveLength(2);
  });

  it('gives an unfinished task its own status colour instead of one flat "pending" style (ARCHITECTURE_REVIEW.md item 35)', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/projects/history')) return Promise.resolve(HISTORY_PAGE);
      if (url === '/api/job-orders/3') return Promise.resolve(PROJECT_DETAILS);
      if (url === '/api/job-orders/3/assignments') {
        return Promise.resolve({
          success: true,
          data: [
            { assignment_id: 1, stage_name: 'Cutting', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-01-02', date_completed: null, due_date: null, status: 'For QA' },
          ],
        });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    render(<ProjectHistory />);
    await screen.findByText('Cabinet Set');
    fireEvent.click(screen.getByText('Cabinet Set'));

    const badge = await screen.findByText('For QA', { selector: 'span' });
    expect(badge).toHaveClass('wb-status--for-qa');
  });

  it('goes back to the list', async () => {
    render(<ProjectHistory />);
    await screen.findByText('Cabinet Set');
    fireEvent.click(screen.getByText('Cabinet Set'));
    await screen.findByText('Back to History');

    fireEvent.click(screen.getByText('Back to History'));

    expect(await screen.findByText('PROJECT HISTORY')).toBeInTheDocument();
  });
});

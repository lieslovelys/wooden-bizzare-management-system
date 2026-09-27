import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkerJobOrder from './WorkerJobOrder';
import { UserContext } from '../context/UserContext';

// FR-9 remainder (PRD.md C.1): a worker's job order list used to only have Assigned/Repair
// filters — a submitted (For QA) or Approved task simply vanished from the list (PRD B.5
// workflow 4). Covers: the two new filter buttons reach the GET as ?status=, and a task
// notification's deep-link (worker/WorkerNotification.jsx -> here) opens the right task directly.
vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}));

const { api } = await import('../api/client');

const USER = { userID: 5 };

const pageOf = (rows) => ({
  success: true,
  data: rows,
  meta: { page: 1, limit: 25, total: rows.length, totalPages: rows.length > 0 ? 1 : 0 },
});

const TASK = {
  assignment_id: 11,
  project_id: 3,
  project_name: 'Dining Set',
  due_date: '2026-01-10',
  priority: 'High',
  status: 'Assigned',
};

beforeEach(() => {
  vi.clearAllMocks();
});

const renderPage = ({ route = '/worker/job-order', state } = {}) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: route, state }]}>
      <UserContext.Provider value={USER}>
        <Routes>
          <Route path="/worker/job-order" element={<WorkerJobOrder />} />
        </Routes>
      </UserContext.Provider>
    </MemoryRouter>
  );

describe('WorkerJobOrder', () => {
  it('defaults to the Assigned filter', async () => {
    api.get.mockResolvedValue(pageOf([TASK]));
    renderPage();
    await screen.findByText('Dining Set');
    expect(api.get).toHaveBeenCalledWith('/api/workers/5/tasks?page=1&limit=25&status=Assigned');
  });

  it('clicking "For QA" requests that status', async () => {
    api.get.mockResolvedValue(pageOf([]));
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('For QA'));

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/api/workers/5/tasks?page=1&limit=25&status=For+QA')
    );
  });

  it('clicking "Approved" requests that status', async () => {
    api.get.mockResolvedValue(pageOf([]));
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Approved'));

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/api/workers/5/tasks?page=1&limit=25&status=Approved')
    );
  });

  it('a task-notification deep-link resolves the assignment and opens its detail directly', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/assignments/')) {
        return Promise.resolve({ success: true, data: { assignment_id: 11, project_id: 3, status: 'Repair' } });
      }
      return Promise.resolve(pageOf([]));
    });

    renderPage({ state: { targetAssignmentId: 11 } });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/assignments/11'));
    // Landing directly in the detail view means the job-order-list-only "JOB ORDER LIST" header
    // shouldn't be showing anymore.
    await waitFor(() => expect(screen.queryByText('JOB ORDER LIST')).not.toBeInTheDocument());
  });
});

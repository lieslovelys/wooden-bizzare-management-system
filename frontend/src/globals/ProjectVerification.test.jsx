import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProjectVerification from './ProjectVerification';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). ProjectVerificationDetail has its own
// test file, so it's stubbed here — this file is about the list: stage filter and the
// notification deep-link resolution via GET /api/assignments/:id (see ARCHITECTURE_REVIEW.md
// P1-3, "a paged task list broke its notification-click resolution").
vi.mock('./ProjectVerificationDetail', () => ({
  default: ({ projectId, onBack }) => (
    <div>
      PVD_STUB {projectId}
      <button onClick={onBack}>Stub Back</button>
    </div>
  ),
}));

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PAGE = {
  success: true,
  data: [{
    project_id: 4, project_name: 'Dining Set', first_name: 'Juan', last_name: 'Dela Cruz',
    stage_name: 'Carpenter', assignment_id: 11,
  }],
  meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

const paramsOf = (url) => new URL(`http://x${url}`).searchParams;

const renderList = (route = '/project-verification', state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: route, state }]}>
      <Routes>
        <Route path="/project-verification" element={<ProjectVerification />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/qa/tasks')) return Promise.resolve(PAGE);
    return Promise.resolve({ success: true, data: [] });
  });
});

describe('ProjectVerification', () => {
  it('renders the task list', async () => {
    renderList();
    expect(await screen.findByText('Dining Set')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
  });

  it('requests the selected stage filter', async () => {
    renderList();
    await screen.findByText('Dining Set');
    api.get.mockClear();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Carver' } });

    await waitFor(() => {
      const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/qa/tasks'));
      expect(call).toBeTruthy();
      expect(paramsOf(call[0]).get('stage')).toBe('Carver');
    });
  });

  it('clicking a row opens the detail view', async () => {
    renderList();
    fireEvent.click(await screen.findByText('Dining Set'));

    expect(screen.getByText('PVD_STUB 4', { exact: false })).toBeInTheDocument();
  });

  it('resolves a notification deep link to the project and opens detail directly', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/qa/tasks')) return Promise.resolve(PAGE);
      if (url === '/api/assignments/11') {
        return Promise.resolve({ success: true, data: { project_id: 4 } });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    renderList('/project-verification', { targetTaskId: 11 });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/assignments/11'));
    expect(await screen.findByText('PVD_STUB 4', { exact: false })).toBeInTheDocument();
  });
});

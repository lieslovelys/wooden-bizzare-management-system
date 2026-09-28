import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './ProjectList';
import { ToastContext } from '../context/ToastContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). Uses the real usePaginatedList hook
// (only ../api/client is mocked), matching admin/ProjectHistory.test.jsx's approach, and renders
// the real EditProjectForm/ProjectDetails on navigation since both get their own test files.
// The delete flow (item 26) goes through the real ConfirmModal rather than window.confirm/alert —
// see globals/ConfirmModal.test.jsx for that component's own coverage.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PAGE = {
  success: true,
  data: [{ id: 4, project_name: 'Dining Set', status: 'Pending' }],
  meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

const paramsOf = (url) => new URL(`http://x${url}`).searchParams;

const renderList = (route = '/project-list', state, showToast = vi.fn()) => ({
  showToast,
  ...render(
    <ToastContext.Provider value={showToast}>
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <Routes>
          <Route path="/project-list" element={<ProjectList />} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>
  ),
});

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(PAGE);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProjectList', () => {
  it('defaults to Pending + In Progress and renders the rows', async () => {
    renderList();
    expect(await screen.findByText('Dining Set')).toBeInTheDocument();

    const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/projects'))[0];
    expect(paramsOf(call).get('status')).toBe('Pending,In Progress');
  });

  it('requests only the selected status when a filter is chosen', async () => {
    renderList();
    await screen.findByText('Dining Set');
    api.get.mockClear();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'In Progress' } });

    await waitFor(() => {
      const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/projects'));
      expect(call).toBeTruthy();
      expect(paramsOf(call[0]).get('status')).toBe('In Progress');
    });
  });

  it('debounces the search input', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderList();
    await waitFor(() => expect(screen.getByText('Dining Set')).toBeInTheDocument());
    api.get.mockClear();

    fireEvent.change(screen.getByPlaceholderText('Search project ID or name....'), { target: { value: 'cab' } });
    expect(api.get).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(300); });
    await waitFor(() => {
      const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/projects'));
      expect(paramsOf(call[0]).get('search')).toBe('cab');
    });
  });

  it('opens a confirm dialog naming the project, deletes, toasts, and refetches on confirm', async () => {
    api.delete.mockResolvedValue({ success: true });
    const { showToast } = renderList();
    await screen.findByText('Dining Set');
    api.get.mockClear();

    fireEvent.click(screen.getByText('Delete'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('WB-04');
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Yes, Delete'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/projects/4'));
    expect(showToast).toHaveBeenCalledWith('Project successfully deleted.', 'success');
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not delete when the confirm dialog is cancelled', async () => {
    renderList();
    await screen.findByText('Dining Set');

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toasts the server error on a failed delete', async () => {
    api.delete.mockRejectedValue(new Error('Cannot delete project with active job orders'));
    const { showToast } = renderList();
    await screen.findByText('Dining Set');

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Yes, Delete'));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Cannot delete project with active job orders', 'error'));
  });

  it('switches to EditProjectForm on Edit', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/projects/4')) {
        return Promise.resolve({ success: true, data: { id: 4, project_name: 'Dining Set', priority_level: 'High' } });
      }
      return Promise.resolve(PAGE);
    });
    renderList();
    await screen.findByText('Dining Set');

    fireEvent.click(screen.getByText('Edit'));

    expect(await screen.findByText('EDIT PROJECT')).toBeInTheDocument();
  });

  it('opens ProjectDetails directly for a notification deep link', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/projects/4')) {
        return Promise.resolve({ success: true, data: { id: 4, project_name: 'Dining Set', variables: [] } });
      }
      return Promise.resolve(PAGE);
    });
    renderList('/project-list', { targetProjectId: 4 });

    expect(await screen.findByText('WB-04')).toBeInTheDocument();
    expect(screen.queryByText('Dining Set', { selector: '.pl-col.name-col' })).not.toBeInTheDocument();
  });
});

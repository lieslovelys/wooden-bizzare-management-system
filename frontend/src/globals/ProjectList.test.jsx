import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './ProjectList';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). Uses the real usePaginatedList hook
// (only ../api/client is mocked), matching admin/ProjectHistory.test.jsx's approach, and renders
// the real EditProjectForm/ProjectDetails on navigation since both get their own test files.
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

const renderList = (route = '/project-list', state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: route, state }]}>
      <Routes>
        <Route path="/project-list" element={<ProjectList />} />
      </Routes>
    </MemoryRouter>
  );

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

  it('confirms, deletes, alerts, and refetches on Delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    api.delete.mockResolvedValue({ success: true });
    renderList();
    await screen.findByText('Dining Set');
    api.get.mockClear();

    fireEvent.click(screen.getByText('Delete'));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('WB-04'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/projects/4'));
    expect(window.alert).toHaveBeenCalledWith('Project successfully deleted.');
    await waitFor(() => expect(api.get).toHaveBeenCalled());
  });

  it('does not delete when the confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderList();
    await screen.findByText('Dining Set');

    fireEvent.click(screen.getByText('Delete'));

    expect(api.delete).not.toHaveBeenCalled();
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import JobOrder from './JobOrder';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). JobOrderDetails has its own test file,
// so it's stubbed here — this file is about the list: priority filter, sort toggle, and
// the notification deep-link switch.
vi.mock('./JobOrderDetails', () => ({
  default: ({ jobId, onBack }) => (
    <div>
      JOB_ORDER_DETAILS_STUB {jobId}
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
  data: [{ id: 4, project_name: 'Dining Set', due_date: '2026-01-10', priority_level: 'High' }],
  meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

const paramsOf = (url) => new URL(`http://x${url}`).searchParams;

const renderList = (route = '/job-order', state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: route, state }]}>
      <Routes>
        <Route path="/job-order" element={<JobOrder />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(PAGE);
});

describe('JobOrder', () => {
  it('renders the list with no priority param when all three are selected', async () => {
    renderList();
    expect(await screen.findByText('Dining Set', { exact: false })).toBeInTheDocument();

    const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/job-orders'))[0];
    expect(paramsOf(call).has('priority')).toBe(false);
  });

  it('deselecting a priority sends the remaining ones', async () => {
    renderList();
    await screen.findByText('Dining Set', { exact: false });
    api.get.mockClear();

    fireEvent.click(screen.getByText('LOW'));

    await waitFor(() => {
      const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/job-orders'));
      expect(call).toBeTruthy();
      expect(paramsOf(call[0]).get('priority')).toBe('High,Medium');
    });
  });

  it('toggles sort direction and requests sort=desc', async () => {
    renderList();
    await screen.findByText('Dining Set', { exact: false });
    api.get.mockClear();

    fireEvent.click(screen.getByText('Sort by Due Date (Nearest first)'));

    await waitFor(() => {
      const call = api.get.mock.calls.find(([url]) => url.startsWith('/api/job-orders'));
      expect(paramsOf(call[0]).get('sort')).toBe('desc');
    });
    expect(screen.getByText('Sort by Due Date (Farthest first)')).toBeInTheDocument();
  });

  it('clicking a row opens JobOrderDetails', async () => {
    renderList();
    fireEvent.click(await screen.findByText('Dining Set', { exact: false }));

    expect(screen.getByText('JOB_ORDER_DETAILS_STUB 4', { exact: false })).toBeInTheDocument();
  });

  it('a notification deep link opens the detail view directly', async () => {
    renderList('/job-order', { targetProjectId: 4 });

    expect(await screen.findByText('JOB_ORDER_DETAILS_STUB 4', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('JOB ORDER LIST')).not.toBeInTheDocument();
  });
});

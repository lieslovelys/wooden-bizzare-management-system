import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profit from './Profit';

// Previously untested (ARCHITECTURE_REVIEW.md item 12/19). Also the regression test for a real
// bug this pass fixed: handleProjectChange compared the <select>'s string value against `p.id`
// (a number) with `===`, so "Profit Detail — <name>" never showed a name — see the fix's own
// comment in Profit.jsx.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

const { api, ApiError } = await import('../api/client');

const PROJECTS = [
  { id: 7, project_name: 'Cabinet Set' },
  { id: 12, project_name: 'Dining Table' },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/api/projects?limit=200') return Promise.resolve({ data: PROJECTS });
    return Promise.reject(new ApiError(404, 'Not found'));
  });
});

async function selectProject(id) {
  await screen.findByText('Cabinet Set'); // waits for the project list to load
  fireEvent.change(screen.getByRole('combobox'), { target: { value: String(id) } });
}

describe('Profit', () => {
  it('shows the selected project\'s name in the header (regression: id/value type mismatch)', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/projects?limit=200') return Promise.resolve({ data: PROJECTS });
      if (url === '/api/profit/7') return Promise.resolve({ data: { client_payment: 1000, worker_wages: 200, materials_cost: 100, other_expenses: 0, expense_items: [] } });
      return Promise.reject(new ApiError(404, 'Not found'));
    });

    render(<Profit />);
    await selectProject(7);

    expect(await screen.findByText('Profit Detail — Cabinet Set')).toBeInTheDocument();
  });

  it('fills the form from the fetched profit data', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/projects?limit=200') return Promise.resolve({ data: PROJECTS });
      if (url === '/api/profit/7') return Promise.resolve({ data: { client_payment: 1000, worker_wages: 200, materials_cost: 100, other_expenses: 0, expense_items: [] } });
      return Promise.reject(new ApiError(404, 'Not found'));
    });

    const { container } = render(<Profit />);
    await selectProject(7);

    await waitFor(() => {
      const inputs = container.querySelectorAll('.profit-spinner input[type="number"]');
      expect(inputs[0]).toHaveValue(1000);
      expect(inputs[1]).toHaveValue(200);
      expect(inputs[2]).toHaveValue(100);
    });
  });

  it('shows a blank form (not an error) on a 404 — no profit saved for this project yet', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/projects?limit=200') return Promise.resolve({ data: PROJECTS });
      if (url === '/api/profit/7') return Promise.reject(new ApiError(404, 'No profit record'));
      return Promise.reject(new ApiError(404, 'Not found'));
    });

    const { container } = render(<Profit />);
    await selectProject(7);

    await waitFor(() => {
      const inputs = container.querySelectorAll('.profit-spinner input[type="number"]');
      expect(inputs[0]).toHaveValue(null);
    });
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('saves numeric fields, treating a blank input as 0', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/projects?limit=200') return Promise.resolve({ data: PROJECTS });
      if (url === '/api/profit/7') return Promise.resolve({ data: { client_payment: 1000, worker_wages: "", materials_cost: "", other_expenses: "", expense_items: [] } });
      return Promise.reject(new ApiError(404, 'Not found'));
    });
    api.post.mockResolvedValue({ data: { client_payment: 1000, worker_wages: 0, materials_cost: 0, other_expenses: 0, expense_items: [] } });

    render(<Profit />);
    await selectProject(7);
    await screen.findByText('Save Changes');

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/profit/7', {
      client_payment: 1000,
      worker_wages: 0,
      materials_cost: 0,
      other_expenses: 0,
      expense_items: [],
    }));
  });
});

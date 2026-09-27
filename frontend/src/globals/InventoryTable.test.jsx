import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InventoryTable from './InventoryTable';
import { expectCardLabels } from '../tests/expectCardLabels';

// P1-11: InventoryTable now talks to /api/inventory instead of localStorage — see
// ARCHITECTURE_REVIEW.md P1-11. These tests mock the shared client rather than hitting a real
// backend, matching the scope confirmed for this pass (new code only).
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const { api } = await import('../api/client');

const SAMPLE_ITEM = {
  id: 1,
  name: 'Plywood',
  category: 'Raw Material',
  unit: 'sheet',
  total_stock: 4,
  status: 'Low',
  variants: [{ id: 5, name: '4x8', current: 4, min: 5 }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryTable', () => {
  it('renders items fetched from the API', async () => {
    // P1-3: /api/inventory now also carries a `meta` block — InventoryTable doesn't read it
    // (capped-only, no paging UI), so this only needs to keep resolving {success,data}.
    api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM], meta: { page: 1, limit: 200, total: 1, totalPages: 1 } });

    const { container } = render(<InventoryTable />);

    expect(await screen.findByText('Plywood')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/inventory');
    // DESIGN.md §7#10 — mobile card conversion (css/globals.css's .wb-card-table).
    expectCardLabels(container, '.inventory-table');
  });

  it('submits the add-item form with the expected body', async () => {
    api.get.mockResolvedValue({ success: true, data: [] });
    api.post.mockResolvedValue({ success: true, itemId: 2 });

    const { container } = render(<InventoryTable />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ Add Item'));

    // No <label htmlFor> association exists on this form (pre-existing across the app, not
    // something this pass touches) — inputs are queried positionally instead:
    // [item name, unit, first variant name], in DOM order.
    const textInputs = container.querySelectorAll('.modal-content input[type="text"]');
    fireEvent.change(textInputs[0], { target: { value: 'Screws' } });
    fireEvent.change(textInputs[1], { target: { value: 'box' } });
    fireEvent.change(textInputs[2], { target: { value: '1-inch' } });

    fireEvent.click(screen.getByText('Add Item'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/inventory', {
      name: 'Screws',
      category: 'Raw Material',
      unit: 'box',
      variants: [{ id: undefined, name: '1-inch', minStock: 5 }],
    }));
  });

  it('posts a +1 adjustment with the selected reason', async () => {
    api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM] });
    api.post.mockResolvedValue({ success: true, data: { resultingStock: 5 } });

    render(<InventoryTable />);
    await screen.findByText('Plywood');

    // Expand the row to reveal the +1/-1 adjusters.
    fireEvent.click(screen.getByText('Plywood'));

    fireEvent.click(screen.getByText('+1'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/inventory/variants/5/adjust', {
      delta: 1,
      reason: 'Received',
    }));
  });

  // FR-3
  describe('project tagging', () => {
    const OPEN_PROJECTS = [{ id: 3, project_name: 'Cabinet Set' }];

    it('lazily loads open projects only once Used/Returned is picked', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/inventory') return Promise.resolve({ success: true, data: [SAMPLE_ITEM] });
        if (url === '/api/inventory/projects') return Promise.resolve({ success: true, data: OPEN_PROJECTS });
        return Promise.resolve({ success: true, data: [] });
      });

      render(<InventoryTable />);
      await screen.findByText('Plywood');
      fireEvent.click(screen.getByText('Plywood'));

      expect(api.get).not.toHaveBeenCalledWith('/api/inventory/projects');

      fireEvent.change(screen.getByTitle('Reason for adjustment'), { target: { value: 'Used' } });

      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/inventory/projects'));
      expect(await screen.findByText('WB-03 — Cabinet Set')).toBeInTheDocument();
    });

    it('posts a tagged -1 Used adjustment once a project is selected', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/inventory') return Promise.resolve({ success: true, data: [SAMPLE_ITEM] });
        if (url === '/api/inventory/projects') return Promise.resolve({ success: true, data: OPEN_PROJECTS });
        return Promise.resolve({ success: true, data: [] });
      });
      api.post.mockResolvedValue({ success: true, data: { resultingStock: 3 } });

      render(<InventoryTable />);
      await screen.findByText('Plywood');
      fireEvent.click(screen.getByText('Plywood'));

      fireEvent.change(screen.getByTitle('Reason for adjustment'), { target: { value: 'Used' } });
      await screen.findByText('WB-03 — Cabinet Set');
      fireEvent.change(screen.getByTitle('Project'), { target: { value: '3' } });

      fireEvent.click(screen.getByText('-1'));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/inventory/variants/5/adjust', {
        delta: -1,
        reason: 'Used',
        projectId: 3,
      }));
    });

    it('disables +1 for Returned until a project is selected', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/inventory') return Promise.resolve({ success: true, data: [SAMPLE_ITEM] });
        if (url === '/api/inventory/projects') return Promise.resolve({ success: true, data: OPEN_PROJECTS });
        return Promise.resolve({ success: true, data: [] });
      });

      render(<InventoryTable />);
      await screen.findByText('Plywood');
      fireEvent.click(screen.getByText('Plywood'));

      fireEvent.change(screen.getByTitle('Reason for adjustment'), { target: { value: 'Returned' } });
      await screen.findByText('WB-03 — Cabinet Set');

      expect(screen.getByText('+1')).toBeDisabled();
      fireEvent.change(screen.getByTitle('Project'), { target: { value: '3' } });
      expect(screen.getByText('+1')).not.toBeDisabled();
    });
  });
});

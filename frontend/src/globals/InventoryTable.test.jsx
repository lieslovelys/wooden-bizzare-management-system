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

const TOOL_ITEM = {
  id: 2,
  name: 'Hammer',
  category: 'Tool',
  unit: 'pcs',
  total_stock: 10,
  status: 'OK',
  variants: [{ id: 6, name: 'Standard', current: 10, min: 2 }],
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

  // Previously untested half of this screen (ARCHITECTURE_REVIEW.md item 19/23) — the
  // adjuster/project-tagging half above was already covered from item 18.
  describe('edit/delete/category filter', () => {
    it('opens Edit prefilled from the row, and keeps an existing variant\'s numeric id on submit', async () => {
      api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM] });
      api.put.mockResolvedValue({ success: true });

      const { container } = render(<InventoryTable />);
      await screen.findByText('Plywood');

      fireEvent.click(container.querySelector('.edit-btn'));

      expect(screen.getByText('Edit item')).toBeInTheDocument();
      const textInputs = container.querySelectorAll('.modal-content input[type="text"]');
      expect(textInputs[0]).toHaveValue('Plywood');
      expect(textInputs[1]).toHaveValue('sheet');
      expect(textInputs[2]).toHaveValue('4x8');

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/inventory/1', {
        name: 'Plywood',
        category: 'Raw Material',
        unit: 'sheet',
        variants: [{ id: 5, name: '4x8', minStock: 5 }],
      }));
    });

    it('gives a variant added during edit id: undefined, and drops blank-named variants', async () => {
      api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM] });
      api.put.mockResolvedValue({ success: true });

      const { container } = render(<InventoryTable />);
      await screen.findByText('Plywood');
      fireEvent.click(container.querySelector('.edit-btn'));

      fireEvent.click(screen.getByText('+ Add variant'));
      const textInputs = container.querySelectorAll('.modal-content input[type="text"]');
      // [0]=name, [1]=unit, [2]=existing variant, [3]=new blank variant just added.
      fireEvent.change(textInputs[3], { target: { value: '8x4' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/inventory/1', {
        name: 'Plywood',
        category: 'Raw Material',
        unit: 'sheet',
        variants: [
          { id: 5, name: '4x8', minStock: 5 },
          { id: undefined, name: '8x4', minStock: 5 },
        ],
      }));
    });

    it('strips digits typed into the unit field', async () => {
      api.get.mockResolvedValue({ success: true, data: [] });
      const { container } = render(<InventoryTable />);
      await waitFor(() => expect(api.get).toHaveBeenCalled());

      fireEvent.click(screen.getByText('+ Add Item'));
      const textInputs = container.querySelectorAll('.modal-content input[type="text"]');
      fireEvent.change(textInputs[1], { target: { value: 'kg123' } });

      expect(textInputs[1]).toHaveValue('kg');
    });

    it('Cancel closes the modal without a request', async () => {
      api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM] });
      render(<InventoryTable />);
      await screen.findByText('Plywood');

      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Add new item')).not.toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('delete: does nothing when the confirm is dismissed', async () => {
      api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM] });
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { container } = render(<InventoryTable />);
      await screen.findByText('Plywood');
      fireEvent.click(container.querySelector('.delete-btn'));

      expect(api.delete).not.toHaveBeenCalled();
    });

    it('delete: removes the item and refetches when confirmed', async () => {
      api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM] });
      api.delete.mockResolvedValue({ success: true });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { container } = render(<InventoryTable />);
      await screen.findByText('Plywood');
      fireEvent.click(container.querySelector('.delete-btn'));

      await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/inventory/1'));
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    });

    it('category filter narrows the list, and shows the empty message for a category with no items', async () => {
      api.get.mockResolvedValue({ success: true, data: [SAMPLE_ITEM, TOOL_ITEM] });
      render(<InventoryTable />);
      await screen.findByText('Plywood');
      expect(screen.getByText('Hammer')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Raw materials'));
      expect(screen.getByText('Plywood')).toBeInTheDocument();
      expect(screen.queryByText('Hammer')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Consumables'));
      expect(screen.queryByText('Plywood')).not.toBeInTheDocument();
      expect(screen.getByText(/No items found in this category/)).toBeInTheDocument();
    });
  });
});

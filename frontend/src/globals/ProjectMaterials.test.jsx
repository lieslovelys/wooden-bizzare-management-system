import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectMaterials from './ProjectMaterials';
import { expectCardLabels } from '../tests/expectCardLabels';

// FR-3 (final clause): materials consumed per project. Mocks the shared client rather than a
// real backend, matching the convention InventoryTable.test.jsx and Attendance.test.jsx already
// established.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const MATERIALS = [
  { item_id: 1, item_name: 'Plywood', unit: 'sheet', variant_id: 5, variant_name: '4x8', used: 3, returned: 1, net_used: 2 },
];

const ITEMS = [
  { id: 1, name: 'Plywood', unit: 'sheet', variants: [{ id: 5, name: '4x8', current: 10, min: 2 }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/inventory/projects/')) return Promise.resolve({ success: true, data: MATERIALS });
    if (url === '/api/inventory') return Promise.resolve({ success: true, data: ITEMS });
    return Promise.resolve({ success: true, data: [] });
  });
});

describe('ProjectMaterials', () => {
  it('renders the materials summary fetched from the API', async () => {
    const { container } = render(<ProjectMaterials projectId={7} />);

    expect(await screen.findByText('Plywood')).toBeInTheDocument();
    expect(screen.getByText('4x8')).toBeInTheDocument();
    expect(screen.getByText('2 sheet')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/inventory/projects/7/materials');
    // DESIGN.md §7#10 — mobile card conversion (css/globals.css's .wb-card-table).
    expectCardLabels(container, '.jod-table');
  });

  it('submits a Used record with the expected body', async () => {
    api.post.mockResolvedValue({ success: true, data: { resultingStock: 7 } });
    render(<ProjectMaterials projectId={7} />);

    await screen.findByText('Plywood');

    fireEvent.change(screen.getByDisplayValue('-- Select a variant --'), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Record Usage'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/inventory/variants/5/adjust', {
      delta: -3,
      reason: 'Used',
      projectId: 7,
    }));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkerList from './WorkerList';
import { expectCardLabels } from '../tests/expectCardLabels';

// Previously untested (DESIGN.md §7#10 backlog pass) — this table had no coverage of any kind,
// so the mobile card conversion had nothing pinning its data-label wiring.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const WORKERS = [
  { user_id: 10, formatted_id: 'WK-0010', full_name: 'Juan Dela Cruz', job_type: 'Regular', job_role: 'Carpenter', contact: '09171234567', rate: 650 },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ success: true, data: WORKERS });
});

describe('WorkerList', () => {
  it('renders workers fetched from the API', async () => {
    const { container } = render(<WorkerList />);

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/workers');
    // DESIGN.md §7#10 — mobile card conversion (css/globals.css's .wb-card-table). The desktop
    // height-filler rows (see WorkerList.jsx) are hidden at mobile width, not labeled.
    expectCardLabels(container, '.worker-table', { skipSelector: '.worker-table-filler' });
  });
});

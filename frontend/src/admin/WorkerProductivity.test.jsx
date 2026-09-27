import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkerProductivity from './WorkerProductivity';
import { expectCardLabels } from '../tests/expectCardLabels';

// Previously untested (DESIGN.md §7#10 backlog pass) — this table had no coverage of any kind,
// so the mobile card conversion had nothing pinning its data-label wiring.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PRODUCTIVITY = [
  { user_id: 10, worker_name: 'Juan Dela Cruz', job_role: 'Carpenter', job_type: 'Regular', early_count: 5, on_time_count: 3, late_count: 1, accepted_count: 8, repair_count: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ success: true, data: PRODUCTIVITY });
});

describe('WorkerProductivity', () => {
  it('renders the leaderboard fetched from the API', async () => {
    const { container } = render(<WorkerProductivity />);

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/productivity');
    // DESIGN.md §7#10 — mobile card conversion (css/globals.css's .wb-card-table). The rank/name
    // cell is deliberately unlabeled (it's the card's own header, not a label/value pair) —
    // expectCardLabels only requires a label on every OTHER non-colspan cell.
    expectCardLabels(container, '.prod-table', { skipSelector: '.rank-col' });
  });
});

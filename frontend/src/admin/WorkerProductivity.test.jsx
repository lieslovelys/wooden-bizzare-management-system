import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkerProductivity from './WorkerProductivity';
import { expectCardLabels } from '../tests/expectCardLabels';

// Previously untested (DESIGN.md §7#10 backlog pass) — this table had no coverage of any kind,
// so the mobile card conversion had nothing pinning its data-label wiring. Extended for
// ARCHITECTURE_REVIEW.md item 23 with tab/filter interaction and rank-class coverage. Note:
// WorkerProductivity's role filter omits "Delivery" (present in the add/edit forms' RoleSelect) —
// left as-is, not touched by this pass; may be intentional since delivery isn't a QC-scored
// production stage, but flagged rather than assumed.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PRODUCTIVITY = [
  { user_id: 10, worker_name: 'Juan Dela Cruz', job_role: 'Carpenter', job_type: 'Regular', early_count: 5, on_time_count: 3, late_count: 1, accepted_count: 8, repair_count: 0 },
  { user_id: 11, worker_name: 'Maria Santos', job_role: 'Painter', job_type: 'Regular', early_count: 2, on_time_count: 1, late_count: 0, accepted_count: 3, repair_count: 1 },
  { user_id: 12, worker_name: 'Pedro Reyes', job_role: 'Carver', job_type: 'Part-Time', early_count: 1, on_time_count: 0, late_count: 0, accepted_count: 1, repair_count: 0 },
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

  it('defaults to the Regular tab, hiding Part-Time workers', async () => {
    render(<WorkerProductivity />);
    await screen.findByText('Juan Dela Cruz');
    expect(screen.queryByText('Pedro Reyes')).not.toBeInTheDocument();
  });

  it('switches to the Part-time tab', async () => {
    render(<WorkerProductivity />);
    await screen.findByText('Juan Dela Cruz');

    fireEvent.click(screen.getByText('Part-time Workers'));

    expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
    expect(screen.getByText('Pedro Reyes')).toBeInTheDocument();
  });

  it('filters by role within the active tab', async () => {
    render(<WorkerProductivity />);
    await screen.findByText('Juan Dela Cruz');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Painter' } });

    expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
  });

  it('shows the empty-category message when nothing matches', async () => {
    render(<WorkerProductivity />);
    await screen.findByText('Juan Dela Cruz');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Liha' } });

    expect(screen.getByText('No workers found for this category.')).toBeInTheDocument();
  });

  it('ranks by server order: gold/silver/bronze for the top three', async () => {
    render(<WorkerProductivity />);
    await screen.findByText('Juan Dela Cruz');

    const rows = screen.getAllByText(/Dela Cruz|Santos/).map((el) => el.closest('tr'));
    expect(rows[0]).toHaveClass('rank-gold');
    expect(rows[1]).toHaveClass('rank-silver');
  });
});

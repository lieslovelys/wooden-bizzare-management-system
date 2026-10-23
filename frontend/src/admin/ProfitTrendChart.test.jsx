import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfitTrendChart from './ProfitTrendChart';

// ARCHITECTURE_REVIEW.md item 49 — the Admin dashboard v2's profit-trend widget, backed by item
// 48's GET /api/dashboard/profit-trend (6 Manila calendar months, oldest first).
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const TREND = [
  { month: '2026-05', netProfit: 0 },
  { month: '2026-06', netProfit: 0 },
  { month: '2026-07', netProfit: 0 },
  { month: '2026-08', netProfit: 23000 },
  { month: '2026-09', netProfit: 0 },
  { month: '2026-10', netProfit: 0 },
];

const ALL_ZERO = TREND.map((row) => ({ ...row, netProfit: 0 }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfitTrendChart', () => {
  it('renders a bar per month and an accessible table with the full values, plus the correct total', async () => {
    api.get.mockResolvedValue({ success: true, data: TREND });
    const { container } = render(<ProfitTrendChart />);

    await screen.findByText('6-month total');
    // Only one of the six months is non-zero, so the 6-month total equals that one value — both
    // the total figure and the hidden table's August row render the same formatted string.
    expect(container.querySelector('.ptc-total-value')).toHaveTextContent('₱23,000.00');

    expect(container.querySelectorAll('.ptc-bar')).toHaveLength(6);

    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    expect(table).toHaveClass('wb-visually-hidden');
    expect(screen.getByText('Aug 2026')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '₱23,000.00' })).toBeInTheDocument();
  });

  it('bolds the current (last) month\'s label', async () => {
    api.get.mockResolvedValue({ success: true, data: TREND });
    render(<ProfitTrendChart />);

    await screen.findByText('6-month total');
    const octLabel = screen.getByText('Oct');
    expect(octLabel).toHaveStyle({ fontWeight: 600 });
    const mayLabel = screen.getByText('May');
    expect(mayLabel).toHaveStyle({ fontWeight: 400 });
  });

  it('shows the empty state when every month is zero', async () => {
    api.get.mockResolvedValue({ success: true, data: ALL_ZERO });
    render(<ProfitTrendChart />);

    expect(await screen.findByText('No profit recorded yet')).toBeInTheDocument();
    expect(screen.queryByText('6-month total')).not.toBeInTheDocument();
  });

  it('renders a negative month with a minus-prefixed label', async () => {
    const withLoss = TREND.map((row, i) => (i === 3 ? { ...row, netProfit: -5000 } : row));
    api.get.mockResolvedValue({ success: true, data: withLoss });
    const { container } = render(<ProfitTrendChart />);

    await screen.findByText('6-month total');
    // The y-axis's own bottom label happens to show the same compact figure (niceMin), since
    // the only negative month sets the scale's floor — scope to the bar's own label to avoid
    // matching both.
    const negativeBar = container.querySelector('.ptc-bar--negative').closest('.ptc-bar-col');
    expect(negativeBar.querySelector('.ptc-bar-label')).toHaveTextContent('−₱5k');
  });

  it('shows an error message when the fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    render(<ProfitTrendChart />);

    expect(await screen.findByText("Couldn't load the profit trend.")).toBeInTheDocument();
  });

  it('shows skeleton bars, not the chart, while loading', () => {
    api.get.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<ProfitTrendChart />);

    expect(container.querySelector('.ptc-skeleton-plot')).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('.ptc-bar')).toHaveLength(0);
  });
});

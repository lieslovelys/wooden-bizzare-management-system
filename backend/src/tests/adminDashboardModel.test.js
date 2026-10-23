import { describe, it, expect, vi, beforeEach } from 'vitest';

// Item 48 — getProfitTrend must use the same month-attribution rule as getDashboardStats's
// monthlyProfit (project_profit.updated_at, compared in Manila time), so the chart's last bar
// always agrees with the KPI card. This guards that the query stays parameterized (no string
// interpolation of `months`, per CLAUDE.md's SQL rule) and that rows map to the documented shape.

vi.mock('../config/db.js', () => ({
  query: vi.fn(),
}));

const db = await import('../config/db.js');
const { getProfitTrend } = await import('../models/adminDashboardModel.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminDashboardModel.getProfitTrend', () => {
  it('parameterizes the month count rather than interpolating it', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await getProfitTrend(6);

    const [sql, params] = db.query.mock.calls[0];
    expect(params).toEqual([6]);
    expect(sql).toContain('$1');
    expect(sql).toMatch(/Asia\/Manila/);
  });

  it('maps rows to { month, netProfit }, parsing the numeric string', async () => {
    db.query.mockResolvedValue({
      rows: [
        { month: '2026-05', net_profit: '0' },
        { month: '2026-06', net_profit: '12345.67' },
      ],
    });

    const result = await getProfitTrend(6);

    expect(result).toEqual([
      { month: '2026-05', netProfit: 0 },
      { month: '2026-06', netProfit: 12345.67 },
    ]);
  });
});

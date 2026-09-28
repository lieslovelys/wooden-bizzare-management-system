import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import QCDashboard from './QCDashboard';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). Same P1-3 meta.total rule as
// PM_dashboard.test.jsx. QualityCheckerNotification is stubbed since NotificationList has its
// own test file.
vi.mock('./QualityCheckerNotification', () => ({
  default: () => <div>QC_NOTIFICATION_STUB</div>,
}));

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QCDashboard', () => {
  it('reads toVerifyCount from meta.total, not the current page length', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: Array.from({ length: 25 }, (_, i) => ({ assignment_id: i })),
      meta: { page: 1, limit: 25, total: 42, totalPages: 2 },
    });

    render(<QCDashboard />);

    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  it('stays at 0 when the fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    render(<QCDashboard />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

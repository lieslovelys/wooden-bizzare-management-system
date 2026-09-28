import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PM_dashboard from './PM_dashboard';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). Covers the P1-3 regression this
// component's own comment calls out: "Tasks to verify" must read meta.total, not data.length,
// since /api/qa/tasks is now paged (25 rows/page) — data.length would just be the page size.
// PMNotification is stubbed since NotificationList has its own test file.
vi.mock('./PMNotification', () => ({
  default: () => <div>PM_NOTIFICATION_STUB</div>,
}));

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PM_dashboard', () => {
  it('reads toVerifyCount from meta.total, not the current page length', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/dashboard/stats') {
        return Promise.resolve({ success: true, data: { activeProjects: 3 } });
      }
      if (url === '/api/qa/tasks') {
        // 25 rows on this page, but 60 total across all pages.
        return Promise.resolve({
          success: true,
          data: Array.from({ length: 25 }, (_, i) => ({ assignment_id: i })),
          meta: { page: 1, limit: 25, total: 60, totalPages: 3 },
        });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    render(<PM_dashboard />);

    expect(await screen.findByText('60')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('stays at 0 when the fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    render(<PM_dashboard />);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getAllByText('0')).toHaveLength(2);
  });
});

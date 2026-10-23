import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import A_Dashboard from './A_Dashboard';

// Previously untested (ARCHITECTURE_REVIEW.md item 25). AdminNotification is stubbed since
// NotificationList (its real body) has its own test file. ARCHITECTURE_REVIEW.md item 49 —
// ProfitTrendChart/UpcomingProjects are stubbed the same way; each has its own test file.
vi.mock('./AdminNotification', () => ({
  default: () => <div>ADMIN_NOTIFICATION_STUB</div>,
}));
vi.mock('./ProfitTrendChart', () => ({
  default: () => <div>PROFIT_TREND_STUB</div>,
}));
vi.mock('./UpcomingProjects', () => ({
  default: () => <div>UPCOMING_PROJECTS_STUB</div>,
}));

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const renderIt = () => render(<MemoryRouter><A_Dashboard /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A_Dashboard', () => {
  it('renders the page header and the stats cards with formatted currency', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: { activeProjects: 5, totalWorkers: 12, monthlyProfit: 34500.5 },
    });
    renderIt();

    // ARCHITECTURE_REVIEW.md item 44 — the compact page header replacing the old gradient divider.
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Active projects')).toBeInTheDocument();
    expect(screen.getByText('Total workers')).toBeInTheDocument();
    expect(screen.getByText('Monthly profit')).toBeInTheDocument();
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('₱34,500.50')).toBeInTheDocument();
  });

  it('stays at 0 when the stats fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    renderIt();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('₱0.00')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  // ARCHITECTURE_REVIEW.md item 49 — the "Create project" shortcut the user asked for.
  it('renders a Create project shortcut linking to /admin/create-project', async () => {
    api.get.mockResolvedValue({ success: true, data: { activeProjects: 0, totalWorkers: 0, monthlyProfit: 0 } });
    renderIt();

    const link = await screen.findByText('Create project');
    expect(link.closest('a')).toHaveAttribute('href', '/admin/create-project');
  });

  it('renders the profit trend and upcoming projects sections', async () => {
    api.get.mockResolvedValue({ success: true, data: { activeProjects: 0, totalWorkers: 0, monthlyProfit: 0 } });
    renderIt();

    expect(await screen.findByText('PROFIT_TREND_STUB')).toBeInTheDocument();
    expect(screen.getByText('UPCOMING_PROJECTS_STUB')).toBeInTheDocument();
  });
});

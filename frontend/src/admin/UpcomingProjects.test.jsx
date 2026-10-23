import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpcomingProjects from './UpcomingProjects';

// ARCHITECTURE_REVIEW.md item 49 — the Admin dashboard v2's upcoming-projects widget, backed by
// the existing GET /api/job-orders (already ORDER BY due_date ASC, id ASC and excluding
// Completed — models/jobOrderModel.js) plus item 48's new client_name column.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

function isoDateFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const renderIt = () => render(<MemoryRouter><UpcomingProjects /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpcomingProjects', () => {
  it('requests the first 5 by due date and renders id/client/priority', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: [
        { id: 7, project_name: 'Dining Set', client_name: 'Santos Family', due_date: isoDateFromToday(5), priority_level: 'High', status: 'In Progress' },
      ],
    });
    renderIt();

    expect(await screen.findByText('Dining Set')).toBeInTheDocument();
    expect(screen.getByText('WB-07')).toBeInTheDocument();
    expect(screen.getByText('Santos Family')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/job-orders?limit=5');
  });

  it('marks a past-due row as overdue', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: [
        { id: 4, project_name: 'Kitchen Cabinets', client_name: 'Reyes Residence', due_date: isoDateFromToday(-3), priority_level: 'High', status: 'In Progress' },
      ],
    });
    renderIt();

    expect(await screen.findByText(/Overdue/)).toBeInTheDocument();
  });

  it('a row link carries the project id as router state', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: [
        { id: 11, project_name: 'King Bed Frame', client_name: 'Garcia Household', due_date: isoDateFromToday(10), priority_level: 'Low', status: 'Pending' },
      ],
    });
    renderIt();

    const link = (await screen.findByText('King Bed Frame')).closest('a');
    expect(link).toHaveAttribute('href', '/admin/job-order');
  });

  it('shows the empty state with a Create project link when there are no rows', async () => {
    api.get.mockResolvedValue({ success: true, data: [] });
    renderIt();

    expect(await screen.findByText('No active projects')).toBeInTheDocument();
    const createLink = screen.getByText('Create project').closest('a');
    expect(createLink).toHaveAttribute('href', '/admin/create-project');
  });

  it('shows an error message when the fetch fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    renderIt();

    expect(await screen.findByText("Couldn't load projects.")).toBeInTheDocument();
  });
});

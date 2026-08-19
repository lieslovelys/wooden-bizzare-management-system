import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationList from './NotificationList';

// P2 (notification-component consolidation): NotificationList replaces AdminNotification,
// PMNotification, and QualityCheckerNotification — see ARCHITECTURE_REVIEW.md P2. These tests
// cover the `type` filter and the type-scoped bulk actions (the actual bug fix: PM/QC used to
// loop one request per notification instead of issuing one scoped request like Admin's).
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const { api } = await import('../api/client');

const NOTIFS = [
  { id: 1, type: 'project', title: 'Project A', message: 'msg', is_read: false, reference_id: 10 },
  { id: 2, type: 'verification', title: 'Task B', message: 'msg', is_read: false, reference_id: 20 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

const renderList = (props) =>
  render(
    <MemoryRouter>
      <NotificationList resolveTarget={() => null} {...props} />
    </MemoryRouter>
  );

describe('NotificationList', () => {
  it('with no type filter, shows every notification (Admin behavior)', async () => {
    api.get.mockResolvedValue(NOTIFS);
    renderList({});
    expect(await screen.findByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
  });

  it('with a type filter, shows only matching notifications (PM/QC behavior)', async () => {
    api.get.mockResolvedValue(NOTIFS);
    renderList({ type: 'project' });
    expect(await screen.findByText('Project A')).toBeInTheDocument();
    expect(screen.queryByText('Task B')).not.toBeInTheDocument();
  });

  it('clicking a notification marks it read and navigates via resolveTarget', async () => {
    api.get.mockResolvedValue(NOTIFS);
    api.put.mockResolvedValue({ message: 'ok' });
    const resolveTarget = vi.fn(() => ({ path: '/somewhere', state: { targetProjectId: 10 } }));
    renderList({ resolveTarget });

    fireEvent.click(await screen.findByText('Project A'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/notifications/1/read'));
    expect(resolveTarget).toHaveBeenCalledWith(NOTIFS[0]);
  });

  it('"Clear All" with a type issues one scoped request, not one per row', async () => {
    api.get.mockResolvedValue(NOTIFS);
    api.delete.mockResolvedValue({ message: 'ok' });
    renderList({ type: 'project' });

    fireEvent.click(await screen.findByText('Clear All'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledWith('/api/notifications/clear/all?type=project');
  });

  it('"Clear All" with no type issues one unscoped request (Admin behavior)', async () => {
    api.get.mockResolvedValue(NOTIFS);
    api.delete.mockResolvedValue({ message: 'ok' });
    renderList({});

    fireEvent.click(await screen.findByText('Clear All'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledWith('/api/notifications/clear/all');
  });

  it('"Mark All as Read" with a type issues one scoped request', async () => {
    api.get.mockResolvedValue(NOTIFS);
    api.put.mockResolvedValue({ message: 'ok' });
    renderList({ type: 'verification' });

    fireEvent.click(await screen.findByText('Mark All as Read'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/notifications/mark-all-read?type=verification'));
    expect(api.put).toHaveBeenCalledTimes(1);
  });
});

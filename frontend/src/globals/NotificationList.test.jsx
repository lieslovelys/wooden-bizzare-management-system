import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationList from './NotificationList';

// P2 (notification-component consolidation): NotificationList replaces AdminNotification,
// PMNotification, and QualityCheckerNotification — see ARCHITECTURE_REVIEW.md P2. P1-3 then
// made the list itself server-paginated and server-filtered by `type` (previously the GET
// fetched everything and filtered by type client-side) — see ARCHITECTURE_REVIEW.md P1-3.
// These tests cover the `type` filter reaching the GET, and the type-scoped bulk actions (the
// P2 bug fix: PM/QC used to loop one request per notification instead of issuing one scoped
// request like Admin's).
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// FR-4: NotificationList calls refreshUnread() after every mutating action so the navbar badge
// (which polls independently) doesn't wait out its own interval to reflect the change. Mocked
// here rather than wrapped in a real NotificationProvider, since these tests only care that the
// call happens, not the polling behavior itself (covered by NotificationProvider.test.jsx).
const mockRefreshUnread = vi.fn();
vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ arrivals: 0, refreshUnread: mockRefreshUnread }),
}));

const { api } = await import('../api/client');

const PROJECT_NOTIF = { id: 1, type: 'project', title: 'Project A', message: 'msg', is_read: false, reference_id: 10 };
const VERIFICATION_NOTIF = { id: 2, type: 'verification', title: 'Task B', message: 'msg', is_read: false, reference_id: 20 };

const pageOf = (rows) => ({
  success: true,
  data: rows,
  meta: { page: 1, limit: 25, total: rows.length, totalPages: rows.length > 0 ? 1 : 0 },
});

beforeEach(() => {
  vi.clearAllMocks();
});

const renderList = (props) =>
  render(
    <MemoryRouter>
      <NotificationList resolveTarget={() => null} {...props} />
    </MemoryRouter>
  );

describe('NotificationList', () => {
  it('with no type filter, shows every notification and requests no ?type= (Admin behavior)', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF, VERIFICATION_NOTIF]));
    renderList({});
    expect(await screen.findByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/notifications?page=1&limit=25');
  });

  it('with a type filter, requests ?type= and shows only what the server returns (PM/QC behavior)', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    renderList({ type: 'project' });
    expect(await screen.findByText('Project A')).toBeInTheDocument();
    expect(screen.queryByText('Task B')).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/notifications?page=1&limit=25&type=project');
  });

  it('deleting a single notification dismisses it and refreshes the unread count', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    api.delete.mockResolvedValue({ message: 'ok' });
    renderList({});

    fireEvent.click(await screen.findByTitle('Delete Notification'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/notifications/1'));
    expect(mockRefreshUnread).toHaveBeenCalled();
  });

  it('pressing Enter on a notification row marks it read, same as a click (DESIGN.md §8 keyboard operability)', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    api.put.mockResolvedValue({ message: 'ok' });
    renderList({});

    // ARCHITECTURE_REVIEW.md item 33 — clickableProps (role="button"/tabIndex/onKeyDown) moved
    // off .notif-item onto an inner wrapper, so this no longer has keyboard behavior of its own
    // (see NotificationList.jsx's nested-interactive fix).
    const row = (await screen.findByText('Project A')).closest('[role="button"]');
    fireEvent.keyDown(row, { key: 'Enter' });

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/notifications/1/read'));
  });

  it('a keydown that bubbles up from the delete button does not also mark the row read', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    api.put.mockResolvedValue({ message: 'ok' });
    renderList({});

    // Dispatched directly on the inner button (not the row) so it bubbles up with
    // event.target === the button and event.currentTarget === the row, exactly the case
    // clickableProps' `e.target !== e.currentTarget` guard exists for.
    const deleteBtn = await screen.findByTitle('Delete Notification');
    fireEvent.keyDown(deleteBtn, { key: 'Enter' });

    expect(api.put).not.toHaveBeenCalled();
  });

  it('clicking a notification marks it read, navigates via resolveTarget, and refreshes the unread count', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF, VERIFICATION_NOTIF]));
    api.put.mockResolvedValue({ message: 'ok' });
    const resolveTarget = vi.fn(() => ({ path: '/somewhere', state: { targetProjectId: 10 } }));
    renderList({ resolveTarget });

    fireEvent.click(await screen.findByText('Project A'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/notifications/1/read'));
    expect(resolveTarget).toHaveBeenCalledWith(PROJECT_NOTIF);
    expect(mockRefreshUnread).toHaveBeenCalled();
  });

  // ARCHITECTURE_REVIEW.md item 44 — the panel's own action buttons are now sentence case
  // ("Clear all"/"Mark all as read"); the ConfirmModal's own button keeps its original
  // "Clear All" label (confirmLabel prop below, unchanged), which `{ selector: '.wb-btn-yes' }`
  // disambiguates from the panel's own "Clear all" trigger.
  it('"Clear all" opens a confirm dialog, and Cancel issues no request', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    renderList({});

    fireEvent.click(await screen.findByText('Clear all'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Other users will still see them');
    fireEvent.click(screen.getByText('Cancel'));

    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Clear all", once confirmed, with a type issues one scoped request, not one per row, and refreshes the unread count', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    api.delete.mockResolvedValue({ message: 'ok' });
    renderList({ type: 'project' });

    fireEvent.click(await screen.findByText('Clear all'));
    fireEvent.click(screen.getByText('Clear All', { selector: '.wb-btn-yes' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledWith('/api/notifications/clear/all?type=project');
    expect(mockRefreshUnread).toHaveBeenCalled();
  });

  it('"Clear all", once confirmed, with no type issues one unscoped request (Admin behavior)', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF, VERIFICATION_NOTIF]));
    api.delete.mockResolvedValue({ message: 'ok' });
    renderList({});

    fireEvent.click(await screen.findByText('Clear all'));
    fireEvent.click(screen.getByText('Clear All', { selector: '.wb-btn-yes' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(1));
    expect(api.delete).toHaveBeenCalledWith('/api/notifications/clear/all');
  });

  it('"Mark all as read" with a type issues one scoped request and refreshes the unread count', async () => {
    api.get.mockResolvedValue(pageOf([VERIFICATION_NOTIF]));
    api.put.mockResolvedValue({ message: 'ok' });
    renderList({ type: 'verification' });

    fireEvent.click(await screen.findByText('Mark all as read'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/notifications/mark-all-read?type=verification'));
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(mockRefreshUnread).toHaveBeenCalled();
  });

  it('embedded renders an h2 title; the default renders an h1', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF]));
    const { rerender } = renderList({});
    expect(await screen.findByRole('heading', { level: 1, name: /Notifications/ })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NotificationList resolveTarget={() => null} embedded />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { level: 2, name: /Notifications/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('shows the unread count among the visible rows', async () => {
    api.get.mockResolvedValue(pageOf([PROJECT_NOTIF, { ...VERIFICATION_NOTIF, is_read: true }]));
    renderList({});
    expect(await screen.findByText('1 unread')).toBeInTheDocument();
  });

  it('shows a timestamp from created_at', async () => {
    api.get.mockResolvedValue(pageOf([{ ...PROJECT_NOTIF, created_at: '2026-10-21T07:45:00.000Z' }]));
    renderList({});
    expect(await screen.findByText('Oct 21, 2026, 3:45 PM')).toBeInTheDocument();
  });

  it('shows the empty state with the caller-provided message when there are no rows', async () => {
    api.get.mockResolvedValue(pageOf([]));
    renderList({ emptyMessage: 'No new tasks to verify.' });
    expect(await screen.findByText('No notifications')).toBeInTheDocument();
    expect(screen.getByText('No new tasks to verify.')).toBeInTheDocument();
  });
});

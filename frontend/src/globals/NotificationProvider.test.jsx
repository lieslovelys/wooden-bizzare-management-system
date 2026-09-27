import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import NotificationProvider from './NotificationProvider';
import { useNotifications } from '../context/NotificationContext';

// FR-4 (PRD.md C.1): "Notifications never update live" (PRD.md B.6) — this provider polls the
// unread count on an interval so globals/Navbar.jsx's badge and globals/NotificationList.jsx's
// list both pick up a new notification without a reload. Covers: the poll interval, pausing while
// the tab is hidden, polling immediately on becoming visible again, and cleanup on unmount.
vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}));

const { api } = await import('../api/client');

const countOf = (count) => ({ success: true, data: { count } });

// Renders unreadCount/arrivals as text so tests can assert on them without reaching into
// implementation details.
const Consumer = () => {
  const { unreadCount, arrivals } = useNotifications();
  return <div>count:{unreadCount} arrivals:{arrivals}</div>;
};

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NotificationProvider', () => {
  it('polls once on mount and again every 30s', async () => {
    api.get.mockResolvedValue(countOf(2));
    render(<NotificationProvider><Consumer /></NotificationProvider>);

    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('count:2 arrivals:1')).toBeInTheDocument();

    api.get.mockResolvedValue(countOf(2));
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('increments arrivals only when the count goes up, not when it stays the same or drops', async () => {
    api.get.mockResolvedValue(countOf(1));
    render(<NotificationProvider><Consumer /></NotificationProvider>);
    await act(async () => {});
    expect(await screen.findByText('count:1 arrivals:1')).toBeInTheDocument();

    // Same count next poll — arrivals must not tick again.
    api.get.mockResolvedValue(countOf(1));
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(await screen.findByText('count:1 arrivals:1')).toBeInTheDocument();

    // Count drops (e.g. the user read something elsewhere) — still no new "arrival".
    api.get.mockResolvedValue(countOf(0));
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(await screen.findByText('count:0 arrivals:1')).toBeInTheDocument();
  });

  it('skips the interval poll while the tab is hidden', async () => {
    api.get.mockResolvedValue(countOf(0));
    render(<NotificationProvider><Consumer /></NotificationProvider>);
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);

    setHidden(true);
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('polls immediately when the tab becomes visible again', async () => {
    api.get.mockResolvedValue(countOf(0));
    render(<NotificationProvider><Consumer /></NotificationProvider>);
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);

    setHidden(true);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Hidden, so the visibilitychange handler's own guard should skip it.
    expect(api.get).toHaveBeenCalledTimes(1);

    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('stops polling after unmount', async () => {
    api.get.mockResolvedValue(countOf(0));
    const { unmount } = render(<NotificationProvider><Consumer /></NotificationProvider>);
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('refreshUnread() re-polls immediately without waiting for the interval', async () => {
    let capturedRefresh;
    const Trigger = () => {
      const { refreshUnread } = useNotifications();
      capturedRefresh = refreshUnread;
      return null;
    };
    api.get.mockResolvedValue(countOf(0));
    render(<NotificationProvider><Trigger /></NotificationProvider>);
    await act(async () => {});
    expect(api.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await capturedRefresh();
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

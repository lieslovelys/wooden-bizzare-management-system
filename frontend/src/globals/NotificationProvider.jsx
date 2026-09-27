import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import { api } from '../api/client';

// FR-4 (PRD.md C.1): notifications used to never update live — a new one only appeared after
// navigating to (or reloading) the notifications screen (PRD.md B.6). This polls the unread count
// so globals/Navbar.jsx's badge and globals/NotificationList.jsx's list both pick up new
// notifications without a reload. Polling, not push: five roles and a small per-shop headcount
// don't justify a WebSocket/SSE channel on the one-vCPU deployment target (CLAUDE.md
// "Hosting target").
const POLL_MS = 30000;

const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [arrivals, setArrivals] = useState(0);
  // Bumped by refreshUnread() to re-run the effect below on demand (same shape as
  // usePaginatedList.js's refetchTick), rather than calling a setState-carrying function
  // directly from the effect body or from an external caller — react-hooks/set-state-in-effect
  // flags the former.
  const [refreshTick, setRefreshTick] = useState(0);
  // Mirrors unreadCount for the poll closure's own comparison — a ref so a count change doesn't
  // need to tear down/rebuild the interval below.
  const countRef = useRef(0);

  const refreshUnread = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    let ignore = false;

    // Defined inside the effect (mirrors the ignore-guarded fetch in hooks/usePaginatedList.js)
    // so its setState calls are attributed to this effect's own async work, not a synchronous
    // call at the top of the effect body.
    const poll = async () => {
      try {
        const result = await api.get('/api/notifications/unread-count');
        if (ignore) return;
        const next = result?.data?.count ?? 0;
        if (next > countRef.current) {
          setArrivals((a) => a + 1);
        }
        countRef.current = next;
        setUnreadCount(next);
      } catch {
        // A failed poll (transient network blip, or a session mid-expiry) leaves the last known
        // count in place rather than flashing the badge to 0. A real 401 is already handled by
        // api/client.js, which redirects to /login.
      }
    };

    poll();
    const interval = setInterval(() => {
      // Skip while the tab isn't visible — no point polling a screen nobody's looking at.
      if (!document.hidden) poll();
    }, POLL_MS);

    // Polls right away when the tab becomes visible again, rather than waiting out whatever's
    // left of the current interval.
    const onVisibilityChange = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      ignore = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshTick]);

  return (
    <NotificationContext.Provider value={{ unreadCount, arrivals, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;

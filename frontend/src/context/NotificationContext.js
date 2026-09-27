import { createContext, useContext } from 'react';

// FR-4 (PRD.md C.1): live unread-notification polling for the three notification-bearing role
// shells (Admin, ProductionManager, QualityChecker) — see globals/NotificationProvider.jsx. Split
// from the provider so this file exports no component, exempting it from
// react-refresh/only-export-components (same reasoning as ToastContext.js / the App.jsx
// UserContext split).
//
// The default value (no provider mounted) reports zero and a no-op refresh, so
// globals/Navbar.jsx's badge renders nothing on a role shell (Worker, Inventory Staff) that
// doesn't wrap its tree in NotificationProvider — those roles have no notification screen yet.
const defaultValue = { unreadCount: 0, arrivals: 0, refreshUnread: () => {} };

export const NotificationContext = createContext(defaultValue);

// unreadCount: the current count, for the navbar badge.
// arrivals: increments only when the count goes up — a stable "something new came in" signal a
//   list can hand to usePaginatedList's `refreshKey` without refetching on every poll tick.
// refreshUnread: re-polls immediately (call after a mark-read/dismiss action rather than waiting
//   for the next interval tick).
export const useNotifications = () => useContext(NotificationContext);

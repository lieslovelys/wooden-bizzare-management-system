import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/admin.css';
import { api } from '../api/client';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useNotifications } from '../context/NotificationContext';
import Pagination from './Pagination';
import ConfirmModal from './ConfirmModal';
import { clickableProps } from '../utils/a11y';
import { formatDateTime } from '../utils/format';

// Shared by admin/AdminNotification.jsx, product_manager/PMNotification.jsx, and
// quality_checker/QualityCheckerNotification.jsx — those three were ~90% line-for-line
// identical forks (see ARCHITECTURE_REVIEW.md P2). `type` scopes the displayed list and all
// three actions (the GET as of P1-3, plus the two bulk actions since P2) to one notification
// type via the backend's `?type=` query param (routes/adminNotifRoutes.js); omit it for the
// unscoped "all types" behavior Admin's screen needs. Scoping the bulk actions server-side is
// the actual bug fix from the P2 pass, not just dedup: the PM/QC forks used to loop and issue
// one request per notification to fake a type-scoped bulk action, where Admin's always issued
// exactly one.
//
// ARCHITECTURE_REVIEW.md item 44 — `embedded` (set by a dashboard screen, e.g. A_Dashboard.jsx)
// renders the panel title as an <h2> instead of an <h1>, since a dashboard already has its own
// page-level <h1>; the standalone Notification tabs render the default <h1>.
// item 49 (REDESIGN-v2.md) — `pageSize` lets the dashboard's embedded panel request a shorter
// page (6, matching the mock) without affecting the standalone Notification tabs' default of 25.
const NotificationList = ({ type, emptyMessage = 'No new notifications.', resolveTarget, embedded = false, pageSize = 25 }) => {
  const navigate = useNavigate();
  // FR-4: `arrivals` ticks up whenever NotificationProvider's poll sees the unread count go up,
  // so this list picks up a new notification without a manual reload — see
  // globals/NotificationProvider.jsx and hooks/usePaginatedList.js's `refreshKey`.
  const { arrivals, refreshUnread } = useNotifications();

  // Opens the "Clear All" confirmation modal in place of the old window.confirm.
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // P1-3: server-paginated and server-filtered by `type` — this GET used to fetch every
  // notification and filter by type client-side, which would show an empty/short page for a
  // role-scoped screen (PM/QC) once the list is paged. See ARCHITECTURE_REVIEW.md P1-3.
  const { rows: displayed, setRows, meta, page, setPage, loading, refetch } = usePaginatedList('/api/notifications', {
    params: { type },
    pageSize,
    refreshKey: arrivals,
  });

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`);
      // Deleting a single row doesn't change which rows belong on this page, so update it in
      // place rather than round-tripping for a full refetch.
      setRows(prev => prev.filter(notif => notif.id !== id));
      refreshUnread();
    } catch (error) {
      console.error("Error deleting notification:", error.message);
    }
  };

  // A bulk action changes how many rows exist in total, which can change which page the
  // caller should be looking at — refetch (via page reset, or directly if already on page 1)
  // rather than trying to guess the new local state.
  const afterBulkAction = () => {
    if (page !== 1) setPage(1); else refetch();
  };

  const executeClearAll = async () => {
    setConfirmClearAll(false);
    try {
      const qs = type ? `?type=${encodeURIComponent(type)}` : '';
      await api.delete(`/api/notifications/clear/all${qs}`);
      afterBulkAction();
      refreshUnread();
    } catch (error) {
      console.error("Error clearing notifications:", error.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const qs = type ? `?type=${encodeURIComponent(type)}` : '';
      await api.put(`/api/notifications/mark-all-read${qs}`);
      afterBulkAction();
      refreshUnread();
    } catch (error) {
      console.error("Error marking all as read:", error.message);
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      setRows(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      try {
        await api.put(`/api/notifications/${notif.id}/read`);
        refreshUnread();
      } catch (error) {
        console.error("Error marking notification as read:", error.message);
      }
    }

    const target = resolveTarget(notif);
    if (target) navigate(target.path, { state: target.state });
  };

  const hasRows = displayed.length > 0;
  const unreadCount = displayed.filter((n) => !n.is_read).length;
  const TitleTag = embedded ? 'h2' : 'h1';

  return (
    <div className="notif-container wb-panel">
      {/* Not `danger`: Clear All only dismisses the caller's own copy, not a destructive
          delete of anyone else's — see the confirmation text below. */}
      {confirmClearAll && (
        <ConfirmModal
          title="Clear All Notifications?"
          text={
            type
              ? `Clear all ${type} notifications from your own list? Other users will still see them.`
              : 'Clear all notifications from your own list? Other users will still see them.'
          }
          confirmLabel="Clear All"
          onCancel={() => setConfirmClearAll(false)}
          onConfirm={executeClearAll}
        />
      )}

      <div className="notif-panel-header">
        <TitleTag className="notif-header">
          Notifications
          {!loading && hasRows && (
            <span className="notif-unread-count">{unreadCount} unread</span>
          )}
        </TitleTag>

        {/* ARCHITECTURE_REVIEW.md item 44 — the bulk actions moved from a footer row into the
            panel header. item 49 (REDESIGN-v2.md) — restyled onto the shared .wb-btn kit
            (secondary/danger) instead of the bespoke .notif-action-btn-face chip. */}
        {!loading && hasRows && (
          <div className="notif-header-actions">
            <button type="button" className="wb-btn wb-btn--secondary" onClick={handleMarkAllAsRead}>
              <i className="fa-solid fa-check-double" aria-hidden="true"></i>
              Mark all as read
            </button>
            <button
              type="button"
              className="wb-btn wb-btn--danger"
              onClick={() => setConfirmClearAll(true)}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {loading ? (
        /* item 44 — a skeleton shell instead of a bare "Loading notifications..." line, so the
           panel keeps its real height and shape while the first page is in flight.
           item 49 — the icon-tile skeleton is gone along with the icon box it stood in for. */
        <div className="notif-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="notif-skeleton-row" aria-hidden="true">
              <div className="notif-skeleton-lines">
                <div className="notif-skeleton-line notif-skeleton-line-title"></div>
                <div className="notif-skeleton-line notif-skeleton-line-message"></div>
              </div>
            </div>
          ))}
          <div className="notif-loading-label">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            Loading notifications…
          </div>
        </div>
      ) : hasRows ? (
        <div className="notif-list">
          {displayed.map((notif) => (
            <div key={notif.id} className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}>
              {/* ARCHITECTURE_REVIEW.md item 33 — clickableProps used to sit on this row, which
                  contained the real delete <button> below: axe's nested-interactive rule flags
                  a role="button" wrapping another focusable control. This inner
                  display:contents wrapper carries the row's own click/keyboard behavior
                  instead, leaving the delete button as a sibling rather than a descendant,
                  with no change to the flex layout.
                  item 49 (REDESIGN-v2.md) — the leading icon box (iconMeta/.notif-icon-wrapper)
                  is removed app-wide per the user's request: "pure notifications", text only. */}
              <div {...clickableProps(() => handleNotifClick(notif))} style={{ display: 'contents' }}>
                <div className="notif-content">
                  <div className="notif-title-row">
                    <span className="notif-title">{notif.title}</span>
                    {!notif.is_read && <span className="unread-dot"></span>}
                  </div>
                  <div className="notif-message">{notif.message}</div>
                  {notif.created_at && (
                    <time className="notif-time" dateTime={notif.created_at}>
                      {formatDateTime(notif.created_at)}
                    </time>
                  )}
                </div>
              </div>

              <button
                className="notif-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(notif.id);
                }}
                title="Delete Notification"
                aria-label={`Dismiss notification: ${notif.title}`}
              >
                <i className="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="notif-empty wb-empty">
          <div className="notif-empty-icon wb-empty__icon">
            <i className="fa-solid fa-bell" aria-hidden="true"></i>
          </div>
          <div className="notif-empty-title wb-empty__title">No notifications</div>
          <div className="notif-empty-message wb-empty__text">{emptyMessage}</div>
        </div>
      )}

      {!loading && <Pagination page={page} meta={meta} onChange={setPage} />}
    </div>
  );
};

export default NotificationList;

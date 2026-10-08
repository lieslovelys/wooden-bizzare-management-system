import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/admin.css';
import { api } from '../api/client';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useNotifications } from '../context/NotificationContext';
import Pagination from './Pagination';
import ConfirmModal from './ConfirmModal';

// Shared by admin/AdminNotification.jsx, product_manager/PMNotification.jsx, and
// quality_checker/QualityCheckerNotification.jsx — those three were ~90% line-for-line
// identical forks (see ARCHITECTURE_REVIEW.md P2). `type` scopes the displayed list and all
// three actions (the GET as of P1-3, plus the two bulk actions since P2) to one notification
// type via the backend's `?type=` query param (routes/adminNotifRoutes.js); omit it for the
// unscoped "all types" behavior Admin's screen needs. Scoping the bulk actions server-side is
// the actual bug fix from the P2 pass, not just dedup: the PM/QC forks used to loop and issue
// one request per notification to fake a type-scoped bulk action, where Admin's always issued
// exactly one.
const NotificationList = ({ type, emptyMessage = 'No new notifications.', resolveTarget }) => {
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
    pageSize: 25,
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

  if (loading) return <div className="notif-container"><p style={{textAlign: 'center'}}>Loading notifications...</p></div>;

  return (
    <div className="notif-container">
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

      <h1 className="notif-header">
        <span className="notif-bell"></span> Notifications
      </h1>

      <div className="notif-list">
        {displayed.length > 0 ? (
          displayed.map((notif) => (
            <div
                key={notif.id}
                className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                onClick={() => handleNotifClick(notif)}
                style={{ cursor: 'pointer' }}
            >
                <div className="notif-icon-wrapper">
                    {notif.type === 'project' ? (
                        /* PROJECT ICON: Document / Blueprint (Gold) */
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--color-accent)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    ) : notif.type === 'verification' ? (
                        /* VERIFICATION ICON: Checkmark Circle (Dark Brown) */
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--color-accent-text)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    ) : (
                        /* DEFAULT ICON (any other type) */
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--color-text-muted)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    )}
                </div>

                <div className="notif-content">
                    <div className="notif-title-row">
                        <div className="notif-title">{notif.title}</div>
                        {!notif.is_read && <span className="unread-dot"></span>}
                    </div>
                    <div className="notif-message">{notif.message}</div>
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
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
          ))
        ) : (
          <div className="notif-empty">
            {emptyMessage}
          </div>
        )}
      </div>

      {displayed.length > 0 && (
        <div className="notif-actions">
          <button className="notif-btn-secondary" onClick={() => setConfirmClearAll(true)}>
            Clear All
          </button>
          <button className="notif-btn-primary" onClick={handleMarkAllAsRead}>
            Mark All as Read
          </button>
        </div>
      )}

      <Pagination page={page} meta={meta} onChange={setPage} />
    </div>
  );
};

export default NotificationList;

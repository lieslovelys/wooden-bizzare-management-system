import NotificationList from '../globals/NotificationList';

// Thin wrapper over the shared NotificationList (P2 dedup — see ARCHITECTURE_REVIEW.md).
// Admin sees every notification type unscoped, matching the original behavior. Forwards its own
// props (e.g. A_Dashboard.jsx's `embedded`, item 44) through to the shared component.
const AdminNotification = (props) => (
  <NotificationList
    {...props}
    resolveTarget={(notif) => {
      if (notif.type === 'project') {
        return { path: '../job-order', state: { targetProjectId: notif.reference_id } };
      }
      if (notif.type === 'verification') {
        return { path: '../project-verification', state: { targetTaskId: notif.reference_id } };
      }
      return null;
    }}
  />
);

export default AdminNotification;

import NotificationList from '../globals/NotificationList';

// Thin wrapper over the shared NotificationList (P2 dedup — see ARCHITECTURE_REVIEW.md).
// Default export name kept as VerificationNotification so nothing else in this file needs to change.
// Forwards its own props (e.g. a dashboard's `embedded`, item 44) through to the shared component.
const VerificationNotification = (props) => (
  <NotificationList
    {...props}
    type="verification"
    emptyMessage="No new tasks to verify."
    resolveTarget={(notif) => ({ path: '../project-verification', state: { targetTaskId: notif.reference_id } })}
  />
);

export default VerificationNotification;

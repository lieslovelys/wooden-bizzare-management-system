import NotificationList from '../globals/NotificationList';

// FR-9 remainder: Worker's first notification screen — thin wrapper over the shared
// NotificationList (P2 dedup pattern, see ARCHITECTURE_REVIEW.md), same shape as
// admin/AdminNotification.jsx. Unscoped (no `type`): a Worker only ever sees their own
// 'task'-typed, target_user_id-scoped rows anyway (models/adminNotifModel.js), so there's nothing
// else to filter out.
const WorkerNotification = () => (
  <NotificationList
    emptyMessage="No task updates yet."
    resolveTarget={(notif) => ({ path: '../job-order', state: { targetAssignmentId: notif.reference_id } })}
  />
);

export default WorkerNotification;

import NotificationList from '../globals/NotificationList';

// Thin wrapper over the shared NotificationList (P2 dedup — see ARCHITECTURE_REVIEW.md).
// Default export name kept as ProjectNotification so nothing else in this file needs to change.
const ProjectNotification = () => (
  <NotificationList
    type="project"
    emptyMessage="No new projects assigned."
    resolveTarget={(notif) => ({ path: '../job-order', state: { targetProjectId: notif.reference_id } })}
  />
);

export default ProjectNotification;

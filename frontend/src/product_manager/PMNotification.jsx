import NotificationList from '../globals/NotificationList';

// Thin wrapper over the shared NotificationList (P2 dedup — see ARCHITECTURE_REVIEW.md).
// Default export name kept as ProjectNotification so nothing else in this file needs to change.
// Forwards its own props (e.g. a dashboard's `embedded`, item 44) through to the shared component.
const ProjectNotification = (props) => (
  <NotificationList
    {...props}
    type="project"
    emptyMessage="No new projects assigned."
    resolveTarget={(notif) => ({ path: '../job-order', state: { targetProjectId: notif.reference_id } })}
  />
);

export default ProjectNotification;

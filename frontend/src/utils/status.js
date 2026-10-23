// ARCHITECTURE_REVIEW.md item 35: the three places that colour a task's status
// (worker/WorkerJobOrder.jsx, worker/WorkerJobOrderDetail.jsx, globals/JobOrderDetails.jsx) and
// admin/ProjectHistory.jsx's "not finished yet" badge each built their own
// `status.toLowerCase().replace(' ', '-')` class name, which only replaces the FIRST space (no
// multi-word status collides with that today, but it's still a latent bug) and gave every status
// a different, gapped colour mapping. This is the one place that maps a `task_status` value
// (backend/src/schemas/common.js) onto the shared `.wb-status--*` palette in css/globals.css.

// Rework and Repair share a colour — both mean "sent back to the worker" — and Rework is the one
// value in the enum no current code path actually produces (see jobOrderService.js's own comment
// on WORKER_SUBMITTABLE_FROM), so this mapping is ready for it rather than leaving it uncolored.
const TASK_STATUS_SLUGS = {
  Assigned: 'assigned',
  'In Progress': 'in-progress',
  'For QA': 'for-qa',
  Approved: 'approved',
  Repair: 'repair',
  Rework: 'repair',
};

// Anything not in the map above (null, '', an unrecognized string) gets the neutral modifier
// rather than silently rendering an unstyled, unmapped class name.
export function taskStatusClass(status) {
  const slug = TASK_STATUS_SLUGS[status] ?? 'neutral';
  return `wb-status wb-status--${slug}`;
}

// ARCHITECTURE_REVIEW.md item 49 — a separate mapping for `projects.status` (the enum
// migrations/1787200873418_project-status-single-source-of-truth.js locks to 'Pending'/
// 'In Progress'/'Completed'), which is NOT the same enum as task_status above. The Admin
// dashboard's upcoming-projects widget reads /api/job-orders, which already excludes Completed,
// so only the first two values are ever seen here in practice; 'Completed' and anything else
// still resolve safely to neutral rather than throwing or rendering unstyled.
const PROJECT_STATUS_SLUGS = {
  'In Progress': 'in-progress',
};

export function projectStatusClass(status) {
  const slug = PROJECT_STATUS_SLUGS[status] ?? 'neutral';
  return `wb-status wb-status--${slug}`;
}

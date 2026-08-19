// P1-4: only `attendance` has indexes today. Add indexes on every actively-queried FK and
// filter column that isn't already covered by a UNIQUE constraint (see the next migration —
// users.username, worker_details.user_id, and project_profit.project_id are deliberately
// NOT indexed here to avoid a duplicate index once their UNIQUE constraints land).
//
// The paired fix for `WHERE ja.status::text ILIKE 'For QA'` (which defeats the new
// job_assignments.status index by casting it to text before comparing) is an application-code
// change in models/jobOrderModel.js, not part of this migration.
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createIndex('users', 'user_role');

  pgm.createIndex('job_assignments', 'project_id');
  pgm.createIndex('job_assignments', 'worker_id');
  pgm.createIndex('job_assignments', 'status');

  pgm.createIndex('projects', 'status');
  pgm.createIndex('projects', 'due_date');
  pgm.createIndex('projects', 'created_at');

  pgm.createIndex('project_expense_items', 'profit_id');
  pgm.createIndex('project_variables', 'project_id');

  pgm.createIndex('notifications', 'created_at');
};

export const down = (pgm) => {
  pgm.dropIndex('notifications', 'created_at');

  pgm.dropIndex('project_variables', 'project_id');
  pgm.dropIndex('project_expense_items', 'profit_id');

  pgm.dropIndex('projects', 'created_at');
  pgm.dropIndex('projects', 'due_date');
  pgm.dropIndex('projects', 'status');

  pgm.dropIndex('job_assignments', 'status');
  pgm.dropIndex('job_assignments', 'worker_id');
  pgm.dropIndex('job_assignments', 'project_id');

  pgm.dropIndex('users', 'user_role');
};

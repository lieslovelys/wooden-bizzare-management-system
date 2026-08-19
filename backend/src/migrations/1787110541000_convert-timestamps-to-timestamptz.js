// P1-9: every timestamp column in this schema is naive `timestamp` (or, for users.created_at,
// plain `date`), against a business that runs on Asia/Manila time and a VPS OS clock that
// defaults to UTC. Converts each to `timestamptz` so Postgres stores an unambiguous instant
// and renders it in whatever session timezone is asked for (config/db.js sets the pool's
// session timezone to Asia/Manila as part of this same pass).
//
// Assumption, confirmed with the user before writing this migration: the database this runs
// against holds only locally-written dev data, written by a Postgres running on a Manila-time
// machine — consistent with the fact that deployment has never worked (P1-10), so no rows
// exist that a UTC server wrote. The `AT TIME ZONE 'Asia/Manila'` USING clauses below
// interpret every existing naive value as Manila wall-clock time. Run this against a database
// with UTC-server-written history and it will silently shift every timestamp by 8 hours.
//
// Left as plain `date` on purpose (not touched by this migration): attendance.date,
// job_assignments.start_date/due_date/date_submitted, projects.due_date/date_ordered/
// date_completed. These are calendar dates in the business's own timezone, not instants.
export const shorthands = undefined;

const TZ = 'Asia/Manila';

// `project_profit_summary` (defined in index.sql) selects pp.updated_at, which blocks
// `ALTER ... TYPE` while the view exists ("cannot alter type of a column used by a view or
// rule"). Drop it before the ALTER and recreate it verbatim afterward — the column list and
// types are unaffected by this migration, only how `updated_at` is stored internally.
const DROP_PROFIT_SUMMARY_VIEW = `DROP VIEW IF EXISTS "project_profit_summary";`;
const CREATE_PROFIT_SUMMARY_VIEW = `
CREATE VIEW "project_profit_summary" AS (
	SELECT
		p.id AS project_id,
		p.project_name,
		p.client_name,
		pp.client_payment,
		pp.worker_wages,
		pp.materials_cost,
		pp.other_expenses,
		pp.total_expenses,
		pp.net_profit,
		pp.updated_at
	FROM projects p
	JOIN project_profit pp ON pp.project_id = p.id
);
`;

export const up = (pgm) => {
  pgm.alterColumn('attendance', 'created_at', { type: 'timestamptz', using: `created_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('attendance', 'created_at', { default: pgm.func('CURRENT_TIMESTAMP') });
  pgm.alterColumn('attendance', 'updated_at', { type: 'timestamptz', using: `updated_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('attendance', 'updated_at', { default: pgm.func('CURRENT_TIMESTAMP') });

  pgm.alterColumn('projects', 'created_at', { type: 'timestamptz', using: `created_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('projects', 'created_at', { default: pgm.func('CURRENT_TIMESTAMP') });

  pgm.alterColumn('job_assignments', 'date_completed', { type: 'timestamptz', using: `date_completed AT TIME ZONE '${TZ}'` });

  pgm.sql(DROP_PROFIT_SUMMARY_VIEW);
  pgm.alterColumn('project_profit', 'updated_at', { type: 'timestamptz', using: `updated_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('project_profit', 'updated_at', { default: pgm.func('CURRENT_TIMESTAMP') });
  pgm.sql(CREATE_PROFIT_SUMMARY_VIEW);

  // users.created_at is a plain `date` (DEFAULT now()::date, effectively). Time-of-day
  // precision was already lost before this migration runs and is not recoverable — this
  // widens the column without inventing a fake time-of-day, anchoring every existing row at
  // Manila midnight on its recorded date.
  pgm.alterColumn('users', 'created_at', {
    type: 'timestamptz',
    using: `(created_at::timestamp) AT TIME ZONE '${TZ}'`,
  });
  pgm.alterColumn('users', 'created_at', { default: pgm.func('CURRENT_TIMESTAMP') });
};

export const down = (pgm) => {
  pgm.alterColumn('users', 'created_at', {
    type: 'date',
    using: `(created_at AT TIME ZONE '${TZ}')::date`,
  });
  pgm.alterColumn('users', 'created_at', { default: pgm.func('now()') });

  pgm.sql(DROP_PROFIT_SUMMARY_VIEW);
  pgm.alterColumn('project_profit', 'updated_at', { type: 'timestamp', using: `updated_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('project_profit', 'updated_at', { default: pgm.func('CURRENT_TIMESTAMP') });
  pgm.sql(CREATE_PROFIT_SUMMARY_VIEW);

  pgm.alterColumn('job_assignments', 'date_completed', { type: 'timestamp', using: `date_completed AT TIME ZONE '${TZ}'` });

  pgm.alterColumn('projects', 'created_at', { type: 'timestamp', using: `created_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('projects', 'created_at', { default: pgm.func('CURRENT_TIMESTAMP') });

  pgm.alterColumn('attendance', 'updated_at', { type: 'timestamp', using: `updated_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('attendance', 'updated_at', { default: pgm.func('CURRENT_TIMESTAMP') });
  pgm.alterColumn('attendance', 'created_at', { type: 'timestamp', using: `created_at AT TIME ZONE '${TZ}'` });
  pgm.alterColumn('attendance', 'created_at', { default: pgm.func('CURRENT_TIMESTAMP') });
};

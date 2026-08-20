// Drops `project_profit_summary` — see ARCHITECTURE_REVIEW.md "Two unused database views" and
// docs/reference_md/PRD.md B.2. It's a bare `projects JOIN project_profit` with no aggregation,
// never queried by any backend code (models/profitModel.js reads `project_profit` directly), and
// adds nothing a real query couldn't do itself.
//
// `attendance_summary` (the other view named in that PRD section) is deliberately KEPT, not
// dropped here — every column it aggregates (status, late_minutes, overtime_minutes) is frozen
// at the database default until PRD FR-5 ("Attendance status is never computed") is implemented;
// wiring it into a screen today would render every worker as all-absent with zero minutes. It's
// worth keeping unwired rather than dropping, since FR-5 is what makes it useful.

export const shorthands = undefined;

const DROP_SQL = `DROP VIEW IF EXISTS "project_profit_summary";`;

// Recreates the view exactly as it stood right before this migration's `up` ran — the definition
// from 1787110541000_convert-timestamps-to-timestamptz.js's own `up` (which recreated it after a
// DROP forced by a column-type change), not the original one in the initial-schema migration. A
// `down` restores the state the *previous* migration left, and that's this one.
const CREATE_SQL = `
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
  pgm.sql(DROP_SQL);
};

export const down = (pgm) => {
  pgm.sql(CREATE_SQL);
};

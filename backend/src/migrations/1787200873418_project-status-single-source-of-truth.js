// FR-8 (PRD.md Part C): projects.status was free text with no constraint, and every read path
// except this one recomputed it on the fly via a `CASE ... EXISTS` (models/projectModel.js) —
// two sources of truth that could disagree (ARCHITECTURE_REVIEW.md / PRD.md B.6). This migration
// makes the stored column authoritative: backfill it to whatever the CASE would have derived,
// then constrain it so it can't drift again. See models/projectModel.js's getAllProjects, whose
// CASE this backfill logic mirrors exactly, and markProjectAsCompleted, which already wrote the
// stored column correctly on completion.
export const shorthands = undefined;

// Mirrors the CASE in the pre-migration getAllProjects: NULL -> Pending; not Completed AND has
// an assignment -> In Progress; otherwise leave it (already Pending or Completed).
const BACKFILL_SQL = `
UPDATE projects SET status = 'Pending' WHERE status IS NULL;

UPDATE projects p
SET status = 'In Progress'
WHERE p.status IS DISTINCT FROM 'Completed'
  AND EXISTS (SELECT 1 FROM job_assignments ja WHERE ja.project_id = p.id)
  AND p.status IS DISTINCT FROM 'In Progress';
`;

// Fails loudly, naming the offending rows, rather than letting the CHECK constraint below reject
// with a bare violation — same preflight pattern as 1787110540000_add-uniqueness-constraints.js.
const PREFLIGHT_SQL = `
DO $$
DECLARE
  bad_list text;
BEGIN
  SELECT string_agg(id::text || ':' || status, ', ') INTO bad_list
  FROM projects
  WHERE status NOT IN ('Pending', 'In Progress', 'Completed');

  IF bad_list IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add status CHECK constraint — projects with an unrecognized status exist (id:status): %', bad_list;
  END IF;
END $$;
`;

export const up = (pgm) => {
  pgm.sql(BACKFILL_SQL);
  pgm.sql(PREFLIGHT_SQL);

  pgm.alterColumn('projects', 'status', { notNull: true });
  pgm.alterColumn('projects', 'status', { default: 'Pending' });
  pgm.addConstraint('projects', 'projects_status_check', {
    check: `status IN ('Pending', 'In Progress', 'Completed')`,
  });
};

// Drops the constraint and NOT NULL/default, but deliberately leaves the backfilled data in
// place — re-NULLing rows the up() derived would throw away real information, and the old read
// path (the CASE this replaces) tolerated both a NULL and a populated status column anyway.
export const down = (pgm) => {
  pgm.dropConstraint('projects', 'projects_status_check');
  pgm.alterColumn('projects', 'status', { default: null });
  pgm.alterColumn('projects', 'status', { notNull: false });
};

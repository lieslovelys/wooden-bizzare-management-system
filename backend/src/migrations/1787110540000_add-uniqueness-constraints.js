// P1-7: three 1:1 relationships the application code already assumes but the schema never
// enforced — users.username (login does `SELECT ... WHERE username = $1` then blindly takes
// rows[0]), worker_details.user_id, and project_profit.project_id (both currently papered
// over with `LIMIT 1` in the model layer). Add real UNIQUE constraints so the database
// enforces the invariant instead of application code hoping it holds.
//
// Each constraint is preceded by a preflight that fails loudly, naming the duplicate values,
// rather than letting a bare Postgres constraint-violation error surface — the migration
// cannot safely guess which duplicate row to keep, so it stops and leaves that decision to a
// human.
export const shorthands = undefined;

const preflight = (column, table = 'users') => `
DO $$
DECLARE
  dup_list text;
BEGIN
  SELECT string_agg(v::text, ', ') INTO dup_list
  FROM (
    SELECT ${column} AS v
    FROM ${table}
    WHERE ${column} IS NOT NULL
    GROUP BY ${column}
    HAVING COUNT(*) > 1
  ) d;

  IF dup_list IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add UNIQUE constraint on %.% — duplicate values exist: %', '${table}', '${column}', dup_list;
  END IF;
END $$;
`;

export const up = (pgm) => {
  pgm.sql(preflight('username', 'users'));
  pgm.addConstraint('users', 'users_username_unique', { unique: 'username' });

  pgm.sql(preflight('user_id', 'worker_details'));
  pgm.addConstraint('worker_details', 'worker_details_user_id_unique', { unique: 'user_id' });

  pgm.sql(preflight('project_id', 'project_profit'));
  pgm.addConstraint('project_profit', 'project_profit_project_id_unique', { unique: 'project_id' });
};

export const down = (pgm) => {
  pgm.dropConstraint('project_profit', 'project_profit_project_id_unique');
  pgm.dropConstraint('worker_details', 'worker_details_user_id_unique');
  pgm.dropConstraint('users', 'users_username_unique');
};

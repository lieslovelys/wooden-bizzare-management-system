// FR-4 (PRD.md C.1): notifications.is_read was one flag shared by every viewer, and target_role
// was written as 'PM'/'QC' (never matching the user_role enum) then ignored entirely by
// getAllNotifications — every logged-in user saw every notification, filtered only by `type` in
// the browser (PRD.md B.6). This migration makes target_role a real, enforced role filter and
// moves read/dismissed state into a per-user receipts table instead of a single shared column.
//
// Same preflight-before-constraint pattern as 1787200873418_project-status-single-source-of-truth.js
// and 1787110540000_add-uniqueness-constraints.js: fail loudly, naming the offending rows, rather
// than letting the type change reject with a bare cast error.
export const shorthands = undefined;

const NORMALIZE_LEGACY_VALUES_SQL = `
UPDATE notifications SET target_role = 'Production Manager' WHERE target_role = 'PM';
UPDATE notifications SET target_role = 'Quality Checker' WHERE target_role = 'QC';
`;

const PREFLIGHT_SQL = `
DO $$
DECLARE
  bad_list text;
BEGIN
  SELECT string_agg(id::text || ':' || target_role, ', ') INTO bad_list
  FROM notifications
  WHERE target_role IS NOT NULL
    AND target_role NOT IN (SELECT unnest(enum_range(NULL::user_role))::text);

  IF bad_list IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert notifications.target_role to user_role — unrecognized values exist (id:target_role): %', bad_list;
  END IF;
END $$;
`;

// A notification with is_read = true predates per-user receipts, so there's no way to know which
// individual viewers had actually read it. Rather than have every existing notification reappear
// as "unread" for everyone once receipts exist, backfill a read receipt for every user who could
// have seen it (role match, plus every Admin — Admin sees all, per PRD.md B.1) at the read
// timestamp closest to what we have: created_at.
const BACKFILL_READ_RECEIPTS_SQL = `
INSERT INTO notification_receipts (notification_id, user_id, read_at)
SELECT n.id, u.user_id, n.created_at
FROM notifications n
JOIN users u ON (u.user_role = 'Admin' OR u.user_role = n.target_role)
WHERE n.is_read = true
ON CONFLICT (notification_id, user_id) DO NOTHING;
`;

const REVERT_LEGACY_VALUES_SQL = `
UPDATE notifications SET target_role = 'PM' WHERE target_role = 'Production Manager';
UPDATE notifications SET target_role = 'QC' WHERE target_role = 'Quality Checker';
`;

export const up = (pgm) => {
  pgm.sql(NORMALIZE_LEGACY_VALUES_SQL);
  pgm.sql(PREFLIGHT_SQL);
  pgm.alterColumn('notifications', 'target_role', {
    type: 'user_role',
    using: 'target_role::user_role',
  });
  pgm.createIndex('notifications', 'target_role');

  pgm.createTable('notification_receipts', {
    notification_id: {
      type: 'integer',
      notNull: true,
      references: 'notifications',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    read_at: { type: 'timestamptz' },
    dismissed_at: { type: 'timestamptz' },
  });
  pgm.addConstraint('notification_receipts', 'notification_receipts_pkey', {
    primaryKey: ['notification_id', 'user_id'],
  });

  pgm.sql(BACKFILL_READ_RECEIPTS_SQL);

  pgm.dropColumn('notifications', 'is_read');
};

// Deliberately leaves the backfilled receipts in place — dropping the table would throw away
// real per-user read state, and the old read path (a single shared is_read) tolerated a
// derived "true if anyone's receipt says so" value fine.
export const down = (pgm) => {
  pgm.addColumn('notifications', {
    is_read: { type: 'boolean', default: false },
  });
  pgm.sql(`
    UPDATE notifications n SET is_read = true
    WHERE EXISTS (
      SELECT 1 FROM notification_receipts r
      WHERE r.notification_id = n.id AND r.read_at IS NOT NULL
    );
  `);

  pgm.dropTable('notification_receipts');

  pgm.dropIndex('notifications', 'target_role');
  pgm.alterColumn('notifications', 'target_role', {
    type: 'varchar(50)',
    using: 'target_role::text',
  });
  pgm.sql(REVERT_LEGACY_VALUES_SQL);
};

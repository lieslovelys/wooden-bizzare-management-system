// FR-9 remainder (PRD.md C.1): notifications.target_role only ever targets a whole role, so a
// QA-outcome notification ("your task was approved/repaired") had nowhere to go without spamming
// every Worker in the shop with every other worker's outcomes. target_user_id adds an optional
// per-user target alongside the existing role target — see models/adminNotifModel.js for how the
// two combine in the visibility predicate.
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumn('notifications', {
    target_user_id: {
      type: 'bigint',
      references: 'users',
      onDelete: 'CASCADE',
    },
  });
  pgm.createIndex('notifications', 'target_user_id');
};

// A user-targeted row (target_user_id set) has no meaning as a role broadcast once the column is
// gone — deleting it outright avoids it silently reappearing as a 'Worker'-wide notification.
export const down = (pgm) => {
  pgm.sql(`DELETE FROM notifications WHERE target_user_id IS NOT NULL;`);
  pgm.dropIndex('notifications', 'target_user_id');
  pgm.dropColumn('notifications', 'target_user_id');
};

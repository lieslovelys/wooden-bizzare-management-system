// P1-1: express-session currently uses the default in-memory MemoryStore, so every
// deploy/restart logs everyone out and session memory grows unbounded. This table is the
// schema connect-pg-simple expects (server.js wires it up in the same change).
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable('session', {
    sid: { type: 'varchar', notNull: true, primaryKey: true },
    sess: { type: 'json', notNull: true },
    // timestamptz, not timestamp — see the P1-9 timezone policy this pass also lands.
    expire: { type: 'timestamptz(6)', notNull: true },
  });

  pgm.createIndex('session', 'expire', { name: 'IDX_session_expire' });
};

export const down = (pgm) => {
  pgm.dropTable('session');
};

import { describe, it, expect, vi, beforeEach } from 'vitest';

// FR-4 regression guard (PRD.md C.1 / B.6): notifications.is_read used to be one flag shared by
// every viewer, and target_role was written but never read. This asserts every query that reads
// or writes read/dismissed state is scoped to the caller's own role/receipts — no query here may
// touch every row unconditionally the way the old UPDATE/DELETE ...  notifications (no WHERE
// beyond an optional ?type=) used to.

vi.mock('../config/db.js', () => ({
  query: vi.fn(),
}));

const db = await import('../config/db.js');
const notifModel = await import('../models/adminNotifModel.js');

beforeEach(() => {
  vi.clearAllMocks();
  db.query.mockResolvedValue({ rows: [] });
});

const CALLER = { userId: 2, role: 'Production Manager' };

describe('adminNotifModel visibility scoping', () => {
  it('getAllNotifications scopes by the caller role and excludes dismissed rows', async () => {
    await notifModel.getAllNotifications({ ...CALLER, limit: 25, offset: 0 });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("$2 = 'Admin'");
    expect(sql).toContain('n.target_role::text = $2');
    // FR-9 remainder: a target_user_id match is an alternative to the role predicate, not an
    // additional restriction on it — a personally-targeted row bypasses the role check entirely.
    expect(sql).toContain('n.target_user_id = $1');
    expect(sql).toContain('n.target_user_id IS NULL');
    expect(sql).toContain('r.dismissed_at IS NULL');
    expect(sql).toContain('notification_receipts');
    expect(params).toEqual([CALLER.userId, CALLER.role, null, 25, 0]);
  });

  it('countUnread scopes by role and excludes read/dismissed rows', async () => {
    db.query.mockResolvedValue({ rows: [{ count: 0 }] });
    await notifModel.countUnread(CALLER);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('r.read_at IS NULL');
    expect(sql).toContain('r.dismissed_at IS NULL');
    expect(params).toEqual([CALLER.userId, CALLER.role]);
  });

  it('markAllAsRead writes receipts, never a global UPDATE against notifications.is_read', async () => {
    await notifModel.markAllAsRead({ ...CALLER, type: null });
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/^\s*INSERT INTO notification_receipts/);
    expect(sql).not.toMatch(/UPDATE\s+notifications\s+SET/i);
  });

  it('dismissAllNotifications writes receipts, never a physical DELETE FROM notifications', async () => {
    await notifModel.dismissAllNotifications({ ...CALLER, type: null });
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/^\s*INSERT INTO notification_receipts/);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+notifications\b/i);
  });

  it('markOneAsRead scopes the target row to the caller role, never an unconditional UPDATE by id', async () => {
    await notifModel.markOneAsRead(5, CALLER);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('n.id = $2');
    expect(sql).toContain("$3 = 'Admin'");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+notifications\b/i);
    expect(params).toEqual([CALLER.userId, 5, CALLER.role]);
  });

  it('dismissNotification scopes the target row to the caller role, never a physical DELETE', async () => {
    await notifModel.dismissNotification(5, CALLER);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('n.id = $2');
    expect(sql).toContain("$3 = 'Admin'");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+notifications\b/i);
    expect(params).toEqual([CALLER.userId, 5, CALLER.role]);
  });

  // FR-9 remainder: createNotification writes the optional per-user target alongside the
  // existing role target — see models/adminNotifModel.js's module comment for how the two combine
  // on read.
  it('createNotification writes target_user_id as its 6th column/param', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });
    await notifModel.createNotification('task', 'Task Approved', 'msg', null, 7, 5);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('target_user_id');
    expect(params).toEqual(['task', 'Task Approved', 'msg', null, 7, 5]);
  });
});

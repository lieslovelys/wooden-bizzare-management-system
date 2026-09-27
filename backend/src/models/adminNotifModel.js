import { query } from '../config/db.js';
import { splitCountedRows } from '../utils/pagination.js';

// FR-4 (PRD.md C.1): read/dismissed state moved from a single notifications.is_read column
// (shared by every viewer) into a per-user notification_receipts table, and target_role now
// actually gates visibility instead of being written and then ignored — see
// migrations/1790500717992_per-user-notifications.js and PRD.md B.6. Every query below repeats
// the same visibility rule: Admin sees everything, anyone else only sees their own role's
// target_role. Comparing target_role as text (`n.target_role::text = $role`) rather than casting
// the role parameter to the enum keeps the JS side a plain string, matching every other caller of
// this module.
//
// FR-9 remainder: target_user_id (migration 1790503216322_per-user-notification-target.js) adds
// an optional per-user target alongside the role target, for a notification that belongs to one
// specific caller (e.g. "your task was approved") rather than a whole role. A user-targeted row
// is visible ONLY to that user — not to Admin — since it's a personal message, not a role
// broadcast; Admin already sees everything role-targeted, but seeing every worker's individual
// task outcomes too would defeat the point of scoping it. When target_user_id is set, the role
// predicate is skipped entirely. Spelled out inline in every query below rather than factored into
// a shared fragment, matching the rest of this module's style.

// P1-3: paged, plus the role-scoped visibility filter FR-4 adds. `id DESC` tiebreaks
// `created_at`, which is not unique. The LEFT JOIN's absence of a row means "never read or
// dismissed" — no fan-out row is written when a notification is created.
export const getAllNotifications = async ({ userId, role, limit, offset, type = null }) => {
    const { rows } = await query(
        `SELECT n.*, (r.read_at IS NOT NULL) AS is_read, COUNT(*) OVER() AS total_count
         FROM notifications n
         LEFT JOIN notification_receipts r
           ON r.notification_id = n.id AND r.user_id = $1
         WHERE (n.target_user_id = $1
                OR (n.target_user_id IS NULL AND ($2 = 'Admin' OR n.target_role::text = $2)))
           AND r.dismissed_at IS NULL
           AND ($3::text IS NULL OR n.type = $3)
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT $4 OFFSET $5`,
        [userId, role, type, limit, offset]
    );
    return splitCountedRows(rows);
};

// Powers the navbar unread badge (routes/adminNotifRoutes.js's GET /unread-count) — a single
// indexed COUNT, not the full list, so polling this on an interval stays cheap on the one-vCPU
// deployment target (see CLAUDE.md "Hosting target").
export const countUnread = async ({ userId, role }) => {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS count
         FROM notifications n
         LEFT JOIN notification_receipts r
           ON r.notification_id = n.id AND r.user_id = $1
         WHERE (n.target_user_id = $1
                OR (n.target_user_id IS NULL AND ($2 = 'Admin' OR n.target_role::text = $2)))
           AND r.dismissed_at IS NULL
           AND r.read_at IS NULL`,
        [userId, role]
    );
    return rows[0].count;
};

// `type` is optional (null/undefined = all types) — see routes/adminNotifRoutes.js. Used so a
// single role-scoped screen (PM/QC/Worker) can bulk-act on just its own notification type instead
// of issuing one request per row, matching what Admin's unscoped call already did.
export const markAllAsRead = async ({ userId, role, type = null }) => {
    const { rows } = await query(
        `INSERT INTO notification_receipts (notification_id, user_id, read_at)
         SELECT n.id, $1, now()
         FROM notifications n
         WHERE (n.target_user_id = $1
                OR (n.target_user_id IS NULL AND ($2 = 'Admin' OR n.target_role::text = $2)))
           AND ($3::text IS NULL OR n.type = $3)
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET read_at = COALESCE(notification_receipts.read_at, now())
         RETURNING notification_id`,
        [userId, role, type]
    );
    return rows;
};

// Per-user "dismiss" — replaces the old physical DELETE, which removed the row for every viewer.
// Returns the affected row (or undefined if the id doesn't exist or isn't visible to this caller)
// so the service can tell "already gone" apart from "not yours to dismiss".
export const dismissNotification = async (id, { userId, role }) => {
    const { rows } = await query(
        `INSERT INTO notification_receipts (notification_id, user_id, read_at, dismissed_at)
         SELECT n.id, $1, now(), now()
         FROM notifications n
         WHERE n.id = $2
           AND (n.target_user_id = $1
                OR (n.target_user_id IS NULL AND ($3 = 'Admin' OR n.target_role::text = $3)))
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET
           read_at = COALESCE(notification_receipts.read_at, now()),
           dismissed_at = now()
         RETURNING notification_id`,
        [userId, id, role]
    );
    return rows[0];
};

// Per-user "clear all" — replaces the old physical DELETE FROM notifications, which cleared the
// list for every viewer, not just the caller.
export const dismissAllNotifications = async ({ userId, role, type = null }) => {
    await query(
        `INSERT INTO notification_receipts (notification_id, user_id, read_at, dismissed_at)
         SELECT n.id, $1, now(), now()
         FROM notifications n
         WHERE (n.target_user_id = $1
                OR (n.target_user_id IS NULL AND ($2 = 'Admin' OR n.target_role::text = $2)))
           AND ($3::text IS NULL OR n.type = $3)
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET
           read_at = COALESCE(notification_receipts.read_at, now()),
           dismissed_at = now()`,
        [userId, role, type]
    );
};

// FR-9 remainder: `targetUserId` (default null) lets a caller scope a notification to one
// specific user instead of (or as well as — though every current caller passes one or the other,
// not both) a whole role. See the module-level comment above for how the two combine on read.
export const createNotification = async (type, title, message, targetRole, referenceId = null, targetUserId = null) => {
    const sql = `
        INSERT INTO notifications (type, title, message, target_role, reference_id, target_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const { rows } = await query(sql, [type, title, message, targetRole, referenceId, targetUserId]);
    return rows[0];
};

// Returns the affected row (or undefined) so the service can 404 on "not visible to this caller"
// rather than silently succeeding on someone else's notification.
export const markOneAsRead = async (id, { userId, role }) => {
    const { rows } = await query(
        `INSERT INTO notification_receipts (notification_id, user_id, read_at)
         SELECT n.id, $1, now()
         FROM notifications n
         WHERE n.id = $2
           AND (n.target_user_id = $1
                OR (n.target_user_id IS NULL AND ($3 = 'Admin' OR n.target_role::text = $3)))
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET read_at = COALESCE(notification_receipts.read_at, now())
         RETURNING notification_id`,
        [userId, id, role]
    );
    return rows[0];
};

import express from 'express';
import Notif from '../services/adminNotifService.js';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { ok } from '../utils/respond.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { typeQuery } from '../schemas/adminNotifSchemas.js';

const router = express.Router();

// FR-9 remainder: Worker now has a notification screen too (QA-outcome notifications, see
// jobOrderService.updateQAStatus) — only Inventory Staff still has none.
const NOTIF_ROLES = requireRole('Admin', 'Production Manager', 'Quality Checker', 'Worker');

// FR-4: every handler passes req.session.user through as `caller` so the service/model layer can
// scope visibility (target_role) and read/dismiss state (notification_receipts) to that one
// user — see CLAUDE.md "services never touch req/res" and adminNotifService.js.

// P1-3: paged, and honors ?type= on the read itself, not just the two bulk mutations below —
// previously globals/NotificationList.jsx filtered by type client-side, which would show an
// empty/short page once this list is paged server-side for a role-scoped screen (PM/QC).
router.get('/', NOTIF_ROLES, validate({ query: typeQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { type } = req.valid.query;
    const { rows, total } = await Notif.getNotifications(req.session.user, { ...pagination, type: type ?? null });
    res.json(ok(rows, buildMeta({ ...pagination, total })));
});

// Powers the navbar unread badge (globals/NotificationProvider.jsx) — before any `/:id` route so
// `unread-count` never matches the `:id` param.
router.get('/unread-count', NOTIF_ROLES, async (req, res) => {
    const count = await Notif.getUnreadCount(req.session.user);
    res.json(ok({ count }));
});

router.put('/mark-all-read', NOTIF_ROLES, validate({ query: typeQuery }), async (req, res) => {
    await Notif.markAllAsRead(req.session.user, req.valid.query.type ?? null);
    res.json(ok(null));
});

router.delete('/clear/all', NOTIF_ROLES, validate({ query: typeQuery }), async (req, res) => {
    await Notif.clearAllNotifications(req.session.user, req.valid.query.type ?? null);
    res.json(ok(null));
});

router.delete('/:id', NOTIF_ROLES, validate({ params: idParams() }), async (req, res) => {
    await Notif.deleteNotification(req.session.user, req.params.id);
    res.json(ok(null));
});

router.put('/:id/read', NOTIF_ROLES, validate({ params: idParams() }), async (req, res) => {
    await Notif.markOneAsRead(req.session.user, req.params.id);
    res.json(ok(null));
});

export default router;

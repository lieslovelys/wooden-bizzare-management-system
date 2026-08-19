import express from 'express';
import Notif from '../services/adminNotifService.js';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { typeQuery } from '../schemas/adminNotifSchemas.js';

const router = express.Router();

// Worker and Inventory Staff have no notification screens.
const NOTIF_ROLES = requireRole('Admin', 'Production Manager', 'Quality Checker');

// P1-3: paged, and now honors ?type= on the read itself, not just the two bulk mutations below
// — previously globals/NotificationList.jsx filtered by type client-side, which would show an
// empty/short page for a role-scoped screen (PM/QC) once this list is paged server-side.
router.get('/', NOTIF_ROLES, validate({ query: typeQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { type } = req.valid.query;
    const { rows, total } = await Notif.getNotifications({ ...pagination, type: type ?? null });
    res.json({ success: true, data: rows, meta: buildMeta({ ...pagination, total }) });
});

router.put('/mark-all-read', NOTIF_ROLES, validate({ query: typeQuery }), async (req, res) => {
    await Notif.markAllAsRead(req.valid.query.type ?? null);
    res.json({ message: "All notifications marked as read" });
});

router.delete('/clear/all', NOTIF_ROLES, validate({ query: typeQuery }), async (req, res) => {
    await Notif.clearAllNotifications(req.valid.query.type ?? null);
    res.json({ message: "All notifications cleared" });
});

router.delete('/:id', NOTIF_ROLES, validate({ params: idParams() }), async (req, res) => {
    await Notif.deleteNotification(req.params.id);
    res.json({ message: "Notification deleted successfully" });
});

router.put('/:id/read', NOTIF_ROLES, validate({ params: idParams() }), async (req, res) => {
    await Notif.markOneAsRead(req.params.id);
    res.json({ message: "Notification marked as read" });
});

export default router;

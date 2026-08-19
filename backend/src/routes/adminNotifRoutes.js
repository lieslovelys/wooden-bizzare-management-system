import express from 'express';
import Notif from '../services/adminNotifService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Worker and Inventory Staff have no notification screens.
const NOTIF_ROLES = requireRole('Admin', 'Production Manager', 'Quality Checker');

// The only two notification types this system produces (see PRD B.6 / userService callers).
const KNOWN_TYPES = ['project', 'verification'];

// Optional ?type= — scopes a bulk action to one notification type instead of all of them, so
// the Production Manager and Quality Checker notification screens can issue one bulk request
// instead of one request per row (P2 notification-component consolidation). Omitting it
// preserves the original unscoped behavior Admin's screen relies on.
const parseTypeQuery = (req, res) => {
    const { type } = req.query;
    if (type === undefined) return { ok: true, type: null };
    if (!KNOWN_TYPES.includes(type)) {
        res.status(400).json({ error: `Invalid type. Must be one of: ${KNOWN_TYPES.join(', ')}` });
        return { ok: false };
    }
    return { ok: true, type };
};

router.get('/', NOTIF_ROLES, async (req, res) => {
    const notifications = await Notif.getNotifications();
    res.json(notifications);
});

router.put('/mark-all-read', NOTIF_ROLES, async (req, res) => {
    const parsed = parseTypeQuery(req, res);
    if (!parsed.ok) return;
    await Notif.markAllAsRead(parsed.type);
    res.json({ message: "All notifications marked as read" });
});

router.delete('/clear/all', NOTIF_ROLES, async (req, res) => {
    const parsed = parseTypeQuery(req, res);
    if (!parsed.ok) return;
    await Notif.clearAllNotifications(parsed.type);
    res.json({ message: "All notifications cleared" });
});

router.delete('/:id', NOTIF_ROLES, async (req, res) => {
    await Notif.deleteNotification(req.params.id);
    res.json({ message: "Notification deleted successfully" });
});

router.put('/:id/read', NOTIF_ROLES, async (req, res) => {
    await Notif.markOneAsRead(req.params.id);
    res.json({ message: "Notification marked as read" });
});

export default router;

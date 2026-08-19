import express from 'express';
import * as notifController from '../controllers/adminNotifController.js'; // Wag kalimutan yung .js
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Worker and Inventory Staff have no notification screens.
const NOTIF_ROLES = requireRole('Admin', 'Production Manager', 'Quality Checker');

router.get('/', NOTIF_ROLES, notifController.getNotifications);

router.put('/mark-all-read', NOTIF_ROLES, notifController.markAllAsRead);

router.delete('/clear/all', NOTIF_ROLES, notifController.clearAllNotifications);

router.delete('/:id', NOTIF_ROLES, notifController.deleteNotification);
router.put('/:id/read', NOTIF_ROLES, notifController.markOneAsRead);

export default router;
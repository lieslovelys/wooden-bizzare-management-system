import express from 'express';
import * as notifController from '../controllers/adminNotifController.js'; // Wag kalimutan yung .js

const router = express.Router();

router.get('/', notifController.getNotifications);

router.put('/mark-all-read', notifController.markAllAsRead);

router.delete('/clear/all', notifController.clearAllNotifications);

router.delete('/:id', notifController.deleteNotification);
router.put('/:id/read', notifController.markOneAsRead);

export default router; 
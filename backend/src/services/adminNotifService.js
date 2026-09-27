import * as notifModel from '../models/adminNotifModel.js'; // Wag kalimutan yung .js
import { AppError } from '../errors/AppError.js';

// FR-4: every function takes `caller` (req.session.user, passed in by the route — see CLAUDE.md
// "services never touch req/res") and forwards { userId, role } to the model, which is what
// scopes both visibility (target_role) and read/dismiss state (notification_receipts) to that
// one caller. Same shape as jobOrderService.updateQAStatus's `caller` argument.
const asIdentity = (caller) => ({ userId: caller.user_id, role: caller.user_role });

const getNotifications = (caller, pagination) =>
    notifModel.getAllNotifications({ ...asIdentity(caller), ...pagination });

const getUnreadCount = (caller) => notifModel.countUnread(asIdentity(caller));

const markAllAsRead = (caller, type) =>
    notifModel.markAllAsRead({ ...asIdentity(caller), type });

const clearAllNotifications = (caller, type) =>
    notifModel.dismissAllNotifications({ ...asIdentity(caller), type });

// Throwing on an empty result (rather than silently returning) means a caller can never observe
// a false "it worked" for a notification that doesn't exist, or that isn't theirs to act on
// (wrong role) — see CLAUDE.md's rule against returning error-shaped values.
const deleteNotification = async (caller, id) => {
    const affected = await notifModel.dismissNotification(id, asIdentity(caller));
    if (!affected) {
        throw new AppError(404, 'Notification not found');
    }
};

const markOneAsRead = async (caller, id) => {
    const affected = await notifModel.markOneAsRead(id, asIdentity(caller));
    if (!affected) {
        throw new AppError(404, 'Notification not found');
    }
};

export default {
    getNotifications,
    getUnreadCount,
    markAllAsRead,
    clearAllNotifications,
    deleteNotification,
    markOneAsRead
}

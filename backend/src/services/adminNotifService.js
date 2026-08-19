import * as notifModel from '../models/adminNotifModel.js'; // Wag kalimutan yung .js

const getNotifications = () => notifModel.getAllNotifications();

const markAllAsRead = (type) => notifModel.markAllAsRead(type);

const clearAllNotifications = (type) => notifModel.clearAllNotifications(type);

const deleteNotification = (id) => notifModel.deleteNotification(id);

const markOneAsRead = (id) => notifModel.markOneAsRead(id);

export default {
    getNotifications,
    markAllAsRead,
    clearAllNotifications,
    deleteNotification,
    markOneAsRead
}

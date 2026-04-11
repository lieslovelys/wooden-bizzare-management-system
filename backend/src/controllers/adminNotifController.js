import * as notifModel from '../models/adminNotifModel.js'; // Wag kalimutan yung .js

export const getNotifications = async (req, res) => {
    try {
        const notifications = await notifModel.getAllNotifications();
        res.json(notifications);
    } catch (error) {
        console.error("Error in getNotifications:", error.message);
        res.status(500).json({ error: 'Server Error fetching notifications' });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        await notifModel.markAllAsRead();
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error in markAllAsRead:", error.message);
        res.status(500).json({ error: 'Server Error marking notifications' });
    }
};

export const clearAllNotifications = async (req, res) => {
    try {
        await notifModel.clearAllNotifications();
        res.json({ message: "All notifications cleared" });
    } catch (error) {
        console.error("Error in clearAllNotifications:", error.message);
        res.status(500).json({ error: 'Server Error clearing notifications' });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await notifModel.deleteNotification(id);
        res.json({ message: "Notification deleted successfully" });
    } catch (error) {
        console.error("Error in deleteNotification:", error.message);
        res.status(500).json({ error: 'Server Error deleting notification' });
    }
};

export const markOneAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await notifModel.markOneAsRead(id);
        res.json({ message: "Notification marked as read" });
    } catch (error) {
        console.error("Error in markOneAsRead:", error.message);
        res.status(500).json({ error: 'Server Error marking notification' });
    }
};
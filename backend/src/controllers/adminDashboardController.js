import * as adminDashboardModel from '../models/adminDashboardModel.js';

export const getStats = async (req, res) => {
    try {
        const stats = await adminDashboardModel.getDashboardStats();
        res.status(200).json(stats);
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
};
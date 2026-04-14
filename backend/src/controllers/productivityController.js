import * as productivityModel from '../models/productivityModel.js';

export const getProductivityStats = async (req, res) => {
    try {
        const stats = await productivityModel.getWorkerProductivity();
        res.status(200).json(stats);
    } catch (error) {
        console.error("Error fetching productivity stats:", error);
        res.status(500).json({ error: "Server error fetching productivity data" });
    }
};
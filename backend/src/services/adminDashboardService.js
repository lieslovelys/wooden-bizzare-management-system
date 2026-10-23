import * as adminDashboardModel from '../models/adminDashboardModel.js';

const getStats = () => adminDashboardModel.getDashboardStats();

// Item 48 — fixed at 6 months (the user's choice); no query parameter, since nothing calls this
// with any other value yet. Widen to a parameter if a future screen needs a different window.
const PROFIT_TREND_MONTHS = 6;

const getProfitTrend = () => adminDashboardModel.getProfitTrend(PROFIT_TREND_MONTHS);

export default {
    getStats,
    getProfitTrend
}

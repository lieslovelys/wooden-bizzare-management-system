import * as adminDashboardModel from '../models/adminDashboardModel.js';

const getStats = () => adminDashboardModel.getDashboardStats();

export default {
    getStats
}

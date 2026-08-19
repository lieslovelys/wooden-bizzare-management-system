import * as productivityModel from '../models/productivityModel.js';

const getProductivityStats = () => productivityModel.getWorkerProductivity();

export default {
    getProductivityStats
}

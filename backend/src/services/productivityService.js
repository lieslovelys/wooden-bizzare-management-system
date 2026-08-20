import * as productivityModel from '../models/productivityModel.js';

const getProductivityStats = (pagination) => productivityModel.getWorkerProductivity(pagination);

export default {
    getProductivityStats
}

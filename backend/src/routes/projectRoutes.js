import express from 'express';
import {
    createProject,
    getProjects,
    getSingleProject,
    updateExistingProject,
    completeProject,
    getProjectHistory,
    removeProject
} from '../controllers/projectController.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const ADMIN_ONLY = requireRole('Admin');
const ADMIN_PM = requireRole('Admin', 'Production Manager');

router.post('/', ADMIN_ONLY, createProject);
router.get('/', ADMIN_ONLY, getProjects);
router.put('/:id', ADMIN_ONLY, updateExistingProject);
router.get('/history', ADMIN_PM, getProjectHistory);
router.get('/:id', ADMIN_ONLY, getSingleProject);
router.delete('/:id', ADMIN_ONLY, removeProject);

router.put('/:id/complete', ADMIN_PM, completeProject);

export default router;
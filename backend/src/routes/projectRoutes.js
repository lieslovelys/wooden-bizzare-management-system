import express from 'express';
import { createProject, getProjects, getSingleProject, updateExistingProject } from '../controllers/projectController.js';

const router = express.Router();

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getSingleProject);      
router.put('/:id', updateExistingProject)

export default router;
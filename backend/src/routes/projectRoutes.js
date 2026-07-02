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

const router = express.Router();

router.post('/', createProject);
router.get('/', getProjects);   
router.put('/:id', updateExistingProject);
router.get('/history', getProjectHistory);
router.get('/:id', getSingleProject);
router.delete('/:id', removeProject);


router.put('/:id/complete', completeProject);

export default router;
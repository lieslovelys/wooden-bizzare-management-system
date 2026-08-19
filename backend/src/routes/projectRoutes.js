import express from 'express';
import Project from '../services/projectService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const ADMIN_ONLY = requireRole('Admin');
const ADMIN_PM = requireRole('Admin', 'Production Manager');

router.post('/', ADMIN_ONLY, async (req, res) => {
    const projectId = await Project.createProject(req.body);
    res.status(201).json({
        success: true,
        message: 'Project created successfully',
        projectId
    });
});

router.get('/', ADMIN_ONLY, async (req, res) => {
    const projects = await Project.getProjects();
    res.status(200).json({
        success: true,
        data: projects
    });
});

router.put('/:id', ADMIN_ONLY, async (req, res) => {
    await Project.updateExistingProject(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Project updated successfully' });
});

router.get('/history', ADMIN_PM, async (req, res) => {
    const history = await Project.getProjectHistory();
    res.status(200).json({ success: true, data: history });
});

router.get('/:id', ADMIN_ONLY, async (req, res) => {
    const project = await Project.getSingleProject(req.params.id);
    res.status(200).json({ success: true, data: project });
});

router.delete('/:id', ADMIN_ONLY, async (req, res) => {
    await Project.removeProject(req.params.id);
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
});

router.put('/:id/complete', ADMIN_PM, async (req, res) => {
    const updatedProject = await Project.completeProject(req.params.id);
    res.status(200).json({
        success: true,
        message: 'Project marked as completed',
        data: updatedProject
    });
});

export default router;

import express from 'express';
import Project from '../services/projectService.js';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { ok } from '../utils/respond.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { projectBody, statusQuery, remarkQuery } from '../schemas/projectSchemas.js';

const router = express.Router();

const ADMIN_ONLY = requireRole('Admin');
const ADMIN_PM = requireRole('Admin', 'Production Manager');

router.post('/', ADMIN_ONLY, validate({ body: projectBody }), async (req, res) => {
    const projectId = await Project.createProject(req.body);
    res.status(201).json(ok({ projectId }));
});

router.get('/', ADMIN_ONLY, validate({ query: statusQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { status } = req.valid.query;
    const search = req.query.search ? String(req.query.search) : undefined;
    const { rows, total } = await Project.getProjects({ ...pagination, search, status });
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.put('/:id', ADMIN_ONLY, validate({ params: idParams(), body: projectBody }), async (req, res) => {
    await Project.updateExistingProject(req.params.id, req.body);
    res.status(200).json(ok(null));
});

router.get('/history', ADMIN_PM, validate({ query: remarkQuery }), async (req, res) => {
    const pagination = parsePagination(req.query);
    const { remark } = req.valid.query;
    const { rows, total } = await Project.getProjectHistory({ ...pagination, remark });
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.get('/:id', ADMIN_ONLY, validate({ params: idParams() }), async (req, res) => {
    const project = await Project.getSingleProject(req.params.id);
    res.status(200).json(ok(project));
});

router.delete('/:id', ADMIN_ONLY, validate({ params: idParams() }), async (req, res) => {
    await Project.removeProject(req.params.id);
    res.status(200).json(ok(null));
});

router.put('/:id/complete', ADMIN_PM, validate({ params: idParams() }), async (req, res) => {
    const updatedProject = await Project.completeProject(req.params.id);
    res.status(200).json(ok(updatedProject));
});

export default router;

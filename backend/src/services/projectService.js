import {
    createProjectWithVariables,
    getAllProjects,
    getProjectById,
    updateProject,
    markProjectAsCompleted,
    getCompletedProjectsHistory,
    deleteProjectById
} from '../models/projectModel.js';

// --- IDINAGDAG NATIN ANG IMPORT NA ITO PARA SA NOTIFICATION ---
import { createNotification } from '../models/adminNotifModel.js';
import { AppError } from '../errors/AppError.js';

const createProject = async (body) => {
    const projectId = await createProjectWithVariables(body);
    console.log("Project created:", projectId);

    try {
        await createNotification(
            'project',
            'New Project Arrived',
            `A new project has been created. See Job Orders to view and assign workers.`,
            'PM',
            projectId
        );
    } catch (notifErr) {
        console.warn("Notification creation failed (table may not exist):", notifErr.message);
    }

    return projectId;
};

// PROJECT LIST

const getProjects = () => getAllProjects();

// EDIT PROJECT

const getSingleProject = async (id) => {
    const project = await getProjectById(id);
    if (!project) {
        throw new AppError(404, 'Project not found', { success: false, message: 'Project not found' });
    }
    return project;
};

const updateExistingProject = (id, body) => updateProject(id, body);

const completeProject = (id) => markProjectAsCompleted(id);

const getProjectHistory = () => getCompletedProjectsHistory();

// REMOVE PROJECT
const removeProject = async (id) => {
    const isDeleted = await deleteProjectById(id);
    if (!isDeleted) {
        throw new AppError(404, 'Project not found', { success: false, message: 'Project not found' });
    }
};

export default {
    createProject,
    getProjects,
    getSingleProject,
    updateExistingProject,
    completeProject,
    getProjectHistory,
    removeProject
}

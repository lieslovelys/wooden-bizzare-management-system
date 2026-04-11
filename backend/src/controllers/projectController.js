import { 
    createProjectWithVariables, 
    getAllProjects, 
    getProjectById, 
    updateProject,
    markProjectAsCompleted,
    getCompletedProjectsHistory 
} from '../models/projectModel.js';

// --- IDINAGDAG NATIN ANG IMPORT NA ITO PARA SA NOTIFICATION ---
import { createNotification } from '../models/adminNotifModel.js'; 


export const createProject = async (req, res) => {
  try {
    const projectId = await createProjectWithVariables(req.body);
    
    await createNotification(
        'project', 
        'New Project Arrived', 
        `A new project has been created. See Job Orders to view and assign workers.`, 
        'PM', 
        projectId 
    );


    res.status(201).json({ 
        success: true, 
        message: 'Project created successfully', 
        projectId 
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Server error while creating project' 
    });
  }
};

// PROJECT LIST

export const getProjects = async (req, res) => {
  try {
    const projects = await getAllProjects();
    res.status(200).json({ 
        success: true, 
        data: projects 
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Server error while fetching projects' 
    });
  }
};

//EDIT PROJECT

export const getSingleProject = async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateExistingProject = async (req, res) => {
  try {
    await updateProject(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating' });
  }
};



export const completeProject = async (req, res) => {
    try {
        const updatedProject = await markProjectAsCompleted(req.params.id);
        res.status(200).json({ 
            success: true, 
            message: 'Project marked as completed', 
            data: updatedProject 
        });
    } catch (error) {
        console.error('Error completing project:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while completing project' 
        });
    }
};

export const getProjectHistory = async (req, res) => {
    try {
        const history = await getCompletedProjectsHistory();
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        console.error('Error fetching project history:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
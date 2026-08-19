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


const createProject = async (req, res) => {
  try {
    const projectId = await createProjectWithVariables(req.body);
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

const getProjects = async (req, res) => {
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

const getSingleProject = async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateExistingProject = async (req, res) => {
  try {
    await updateProject(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating' });
  }
};



const completeProject = async (req, res) => {
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

const getProjectHistory = async (req, res) => {
    try {
        const history = await getCompletedProjectsHistory();
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        console.error('Error fetching project history:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// REMOVE PROJECT
const removeProject = async (req, res) => {
  try {
    const isDeleted = await deleteProjectById(req.params.id);
    
    if (!isDeleted) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting project' });
  }
};

export {
 createProject,
 getProjects,
 getSingleProject,
 updateExistingProject,
 completeProject,
 getProjectHistory,
 removeProject
}
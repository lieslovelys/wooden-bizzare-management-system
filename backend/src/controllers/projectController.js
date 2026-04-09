import { createProjectWithVariables, getAllProjects, getProjectById, updateProject } from '../models/projectModel.js';

export const createProject = async (req, res) => {
  try {
    const projectId = await createProjectWithVariables(req.body);
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
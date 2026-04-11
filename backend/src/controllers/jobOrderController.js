import { 
    getAllJobOrders, 
    getJobOrderById, 
    getWorkers, 
    getProjectAssignments, 
    createJobAssignment, 
    getTasksByWorkerId, 
    updateAssignmentStatus, 
    getTasksForQA 
} from '../models/jobOrderModel.js';

import { createNotification } from '../models/adminNotifModel.js';

export const getJobOrders = async (req, res) => {
    try {
        const jobOrders = await getAllJobOrders();
        res.status(200).json(jobOrders);
    } catch (error) {
        console.error("Error sa pag-fetch ng job orders:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getJobOrderDetails = async (req, res) => {
    const { id } = req.params; 
    
    try {
        const details = await getJobOrderById(id);
        
        if (!details) {
            return res.status(404).json({ error: "Project hindi nahanap" });
        }
        
        res.status(200).json(details);
    } catch (error) {
        console.error("Error fetching project details:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getWorkersList = async (req, res) => {
    try {
        const workers = await getWorkers();
        res.status(200).json(workers);
    } catch (error) {
        res.status(500).json({ error: "Error fetching workers" });
    }
};

export const getAssignments = async (req, res) => {
    try {
        const assignments = await getProjectAssignments(req.params.id);
        res.status(200).json(assignments);
    } catch (error) {
        res.status(500).json({ error: "Error fetching assignments" });
    }
};

export const assignTask = async (req, res) => {
    const { stage, workerId, startDate, dueDate } = req.body;
    try {
        const newAssignment = await createJobAssignment(req.params.id, workerId, stage, startDate, dueDate);
        res.status(201).json(newAssignment);
    } catch (error) {
        console.error("Assign error:", error);
        res.status(500).json({ error: "Error assigning task" });
    }
};

export const getWorkerTasks = async (req, res) => {
    const { workerId } = req.params; 
    
    try {
        const tasks = await getTasksByWorkerId(workerId);
        res.status(200).json(tasks);
    } catch (error) {
        console.error("Error fetching worker tasks:", error);
        res.status(500).json({ error: "Failed to fetch worker tasks" });
    }
};

// --- QUALITY CHECKER CONTROLLERS ---

export const getQATasks = async (req, res) => {
    try {
        const tasks = await getTasksForQA(); 
        res.status(200).json(tasks); 
    } catch (error) {
        console.error("Error fetching QA tasks:", error);
        res.status(500).json({ error: "Failed to fetch QA tasks" });
    }
}

export const updateQAStatus = async (req, res) => {
    const { assignmentId } = req.params;
    const { status } = req.body; 

    try {
        const updatedTask = await updateAssignmentStatus(assignmentId, status);
        if (!updatedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        if (status === 'For QA') {
            await createNotification(
                'verification', // type
                'Task Ready for Verification', // title
                `A worker has submitted a task. Please check the Project Verification page.`, 
                'QC', 
                assignmentId 
            );
        }

        res.status(200).json({ message: "Task status updated successfully", task: updatedTask });
    } catch (error) {
        console.error("Error updating task status:", error);
        res.status(500).json({ error: "Failed to update task status" });
    }
};
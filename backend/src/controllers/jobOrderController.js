import {
    getAllJobOrders,
    getJobOrderById,
    getWorkers,
    getProjectAssignments,
    createJobAssignment,
    getTasksByWorkerId,
    getAssignmentById,
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

// Statuses a task can be submitted FROM by the worker who owns it (i.e. not yet under review).
// Includes 'In Progress' and 'Rework' even though no current code path produces them, so this
// doesn't need to change if the state machine (PRD FR-6) is filled in later.
const WORKER_SUBMITTABLE_FROM = ['Assigned', 'Repair', 'In Progress', 'Rework'];
// Statuses a reviewer (Admin / Production Manager / Quality Checker) may set, and the only
// status a task can be reviewed FROM.
const REVIEWER_SETTABLE_STATUSES = ['Approved', 'Repair'];
const REVIEWABLE_FROM = ['For QA'];

export const updateQAStatus = async (req, res) => {
    const { assignmentId } = req.params;
    const { status } = req.body;
    const caller = req.session.user;

    try {
        const assignment = await getAssignmentById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ error: "Task not found" });
        }

        let allowedFromStatuses;

        if (caller.user_role === 'Worker') {
            // A worker may only submit their OWN assignment, and only ever move it to 'For QA' —
            // this is the fix for the self-approval vulnerability (a worker could previously send
            // {status:'Approved'} for their own task with no check at all).
            if (String(assignment.worker_id) !== String(caller.user_id)) {
                return res.status(403).json({ error: "You can only update your own assigned tasks" });
            }
            if (status !== 'For QA') {
                return res.status(400).json({ error: "Workers may only submit a task as 'For QA'" });
            }
            allowedFromStatuses = WORKER_SUBMITTABLE_FROM;
        } else {
            // Admin / Production Manager / Quality Checker: reviewing someone else's submission.
            if (!REVIEWER_SETTABLE_STATUSES.includes(status)) {
                return res.status(400).json({ error: "Status must be 'Approved' or 'Repair'" });
            }
            allowedFromStatuses = REVIEWABLE_FROM;
        }

        const updatedTask = await updateAssignmentStatus(assignmentId, status, allowedFromStatuses);
        if (!updatedTask) {
            // The row existed (checked above) but wasn't in an allowed state to make this
            // transition — either it moved between the read and the write, or it was never in a
            // state this caller could act on.
            return res.status(409).json({ error: "Task is not in a state that allows this update" });
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
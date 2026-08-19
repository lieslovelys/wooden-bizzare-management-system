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
import { AppError } from '../errors/AppError.js';

const getJobOrders = () => getAllJobOrders();

const getJobOrderDetails = async (id) => {
    const details = await getJobOrderById(id);
    if (!details) {
        throw new AppError(404, 'Project hindi nahanap');
    }
    return details;
};

const getWorkersList = () => getWorkers();

const getAssignments = (projectId) => getProjectAssignments(projectId);

const assignTask = (projectId, workerId, stage, startDate, dueDate) =>
    createJobAssignment(projectId, workerId, stage, startDate, dueDate);

const getWorkerTasks = (workerId) => getTasksByWorkerId(workerId);

// --- QUALITY CHECKER ---

const getQATasks = () => getTasksForQA();

// Statuses a task can be submitted FROM by the worker who owns it (i.e. not yet under review).
// Includes 'In Progress' and 'Rework' even though no current code path produces them, so this
// doesn't need to change if the state machine (PRD FR-6) is filled in later.
const WORKER_SUBMITTABLE_FROM = ['Assigned', 'Repair', 'In Progress', 'Rework'];
// Statuses a reviewer (Admin / Production Manager / Quality Checker) may set, and the only
// status a task can be reviewed FROM.
const REVIEWER_SETTABLE_STATUSES = ['Approved', 'Repair'];
const REVIEWABLE_FROM = ['For QA'];

// `caller` is the session user object (req.session.user) — the route passes it through since
// this service never touches req/res itself.
const updateQAStatus = async (assignmentId, status, caller) => {
    const assignment = await getAssignmentById(assignmentId);
    if (!assignment) {
        throw new AppError(404, 'Task not found');
    }

    let allowedFromStatuses;

    if (caller.user_role === 'Worker') {
        // A worker may only submit their OWN assignment, and only ever move it to 'For QA' —
        // this is the fix for the self-approval vulnerability (a worker could previously send
        // {status:'Approved'} for their own task with no check at all).
        if (String(assignment.worker_id) !== String(caller.user_id)) {
            throw new AppError(403, 'You can only update your own assigned tasks');
        }
        if (status !== 'For QA') {
            throw new AppError(400, "Workers may only submit a task as 'For QA'");
        }
        allowedFromStatuses = WORKER_SUBMITTABLE_FROM;
    } else {
        // Admin / Production Manager / Quality Checker: reviewing someone else's submission.
        if (!REVIEWER_SETTABLE_STATUSES.includes(status)) {
            throw new AppError(400, "Status must be 'Approved' or 'Repair'");
        }
        allowedFromStatuses = REVIEWABLE_FROM;
    }

    const updatedTask = await updateAssignmentStatus(assignmentId, status, allowedFromStatuses);
    if (!updatedTask) {
        // The row existed (checked above) but wasn't in an allowed state to make this
        // transition — either it moved between the read and the write, or it was never in a
        // state this caller could act on.
        throw new AppError(409, 'Task is not in a state that allows this update');
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

    return updatedTask;
};

export default {
    getJobOrders,
    getJobOrderDetails,
    getWorkersList,
    getAssignments,
    assignTask,
    getWorkerTasks,
    getQATasks,
    updateQAStatus
}

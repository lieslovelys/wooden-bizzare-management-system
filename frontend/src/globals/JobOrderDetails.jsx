import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatDate, formatProjectId } from '../utils/format';
import { taskStatusClass } from '../utils/status';
import ConfirmModal from './ConfirmModal';
import ProjectMaterials from './ProjectMaterials';

// Fixed list of production stages — doesn't depend on any component state, so it's hoisted out
// rather than recreated (and re-triggering effects that depend on it) on every render.
const ALL_STAGES = ['Carpenter', 'Carver', 'Liha', 'Painter', 'Delivery'];

const JobOrderDetail = ({ jobId, onBack }) => {
    const id = useId();
    const [projectDetails, setProjectDetails] = useState(null);
    const [workers, setWorkers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- POP-UP STATES ---
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const showToast = useToast();

    // The "complete project" success toast is followed by a delayed onBack() — cancel that
    // delay on unmount so it can't navigate after this component is already gone.
    const backTimerRef = useRef(null);
    useEffect(() => {
        return () => {
            if (backTimerRef.current) {
                clearTimeout(backTimerRef.current);
            }
        };
    }, []);

    const [formData, setFormData] = useState({ stage: 'Carpenter', workerId: '', startDate: '', dueDate: '' });

    // Tracks whether assignable-workers has been fetched at least once, so fetchAllData can skip
    // refetching it on a re-assign without needing `workers` itself in its own dependency list
    // (ARCHITECTURE_REVIEW.md item 32 — reading `workers.length` there used to force that).
    const workersLoadedRef = useRef(false);

    // P1-3: both /job-orders/:id/assignments and /assignable-workers now answer
    // {success, data, meta} instead of a bare array — see ARCHITECTURE_REVIEW.md P1-3.
    // P2: /job-orders/:id now answers {success, data} instead of the bare project object — see
    // ARCHITECTURE_REVIEW.md P2.
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const detailsResult = await api.get(`/api/job-orders/${jobId}`);
            setProjectDetails(detailsResult.data);
            const assignmentsResult = await api.get(`/api/job-orders/${jobId}/assignments`);
            setAssignments(assignmentsResult.data || []);

            if (!workersLoadedRef.current) {
                const workersResult = await api.get(`/api/assignable-workers`);
                setWorkers(workersResult.data || []);
                workersLoadedRef.current = true;
            }
        } catch (error) {
            console.error("Error fetching data:", error.message);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => { if (jobId) fetchAllData(); }, [jobId, fetchAllData]);

    const assignedStages = useMemo(() => assignments.map(a => a.stage_name), [assignments]);

    useEffect(() => {
        if (assignedStages.includes(formData.stage)) {
            const firstAvailable = ALL_STAGES.find(s => !assignedStages.includes(s));
            if (firstAvailable) setFormData(prev => ({ ...prev, stage: firstAvailable }));
        }
    }, [assignedStages, formData.stage]);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const filteredWorkers = useMemo(
        () => workers.filter(w => w.job_role && w.job_role.toLowerCase() === formData.stage.toLowerCase()),
        [workers, formData.stage]
    );

    useEffect(() => {
        if (filteredWorkers.length > 0) setFormData(prev => ({ ...prev, workerId: filteredWorkers[0].user_id }));
        else setFormData(prev => ({ ...prev, workerId: '' }));
    }, [filteredWorkers]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleAssign = async (e) => {
        e.preventDefault();
        
        if (!formData.workerId || !formData.startDate || !formData.dueDate) {
            showToast("Pakikumpleto ang form at siguraduhing may available na worker.", "error");
            return;
        }

        if (formData.dueDate < formData.startDate) {
            showToast("Due date cannot be earlier than Start Date.", "error");
            return;
        }

        try {
            await api.post(`/api/job-orders/${jobId}/assign`, formData);
            showToast("Worker assigned successfully!", "success");
            fetchAllData();
            setFormData(prev => ({ ...prev, startDate: '', dueDate: '' }));
        } catch (error) {
            console.error("Submit error:", error.message);
            showToast(error.message || "Failed to assign worker.", "error");
        }
    };

    // --- BAGONG MARK AS COMPLETE LOGIC ---
    const executeCompleteProject = async () => {
        setShowConfirmModal(false); // Itago ang modal
        try {
            await api.put(`/api/projects/${jobId}/complete`);
            showToast("Project Marked as Completed!", "success");
            backTimerRef.current = setTimeout(() => onBack(), 2000); // Wait 2 secs para makita ang success message bago bumalik
        } catch (error) {
            console.error("Complete error:", error.message);
            showToast(error.message || "Server error. Paki-check ang connection.", "error");
        }
    };

    if (loading) return <div className="jod-wrapper"><p style={{ textAlign: 'center' }}>Loading project data...</p></div>;
    if (!projectDetails) return <div className="jod-wrapper"><button className="jod-back-btn" onClick={onBack}>Back</button><p>Project not found.</p></div>;

    const totalAssigned = assignments.length; 
    const completedStages = assignments.filter(a => a.status === 'Approved').length;
    const progressPercent = totalAssigned === 0 ? 0 : (completedStages / totalAssigned) * 100;

    // --- BAGONG LOGIC: Disable ba ang button? ---
    // Disable kung walang assigned OR kung mas mababa ang completed sa total assigned
    const isCompleteDisabled = totalAssigned === 0 || completedStages < totalAssigned;

    return (
        <div className="jod-wrapper">
            {showConfirmModal && (
                <ConfirmModal
                    title="Complete Project?"
                    text="Sigurado ka bang tapos na ang project na ito? Malilipat ito sa Project History."
                    confirmLabel="Yes, Complete It"
                    onCancel={() => setShowConfirmModal(false)}
                    onConfirm={executeCompleteProject}
                />
            )}

            <button className="jod-back-btn" onClick={onBack}>← Back to Job Order List</button>

            <div className="jod-container jod-overview-container">
                <div className="jod-ov-header">
                    <h1 className="jod-ov-id">{formatProjectId(projectDetails.id)}</h1>
                    <p className="jod-ov-name">{projectDetails.project_name}</p>
                </div>

                <div className="jod-ov-info-bar">
                    <div className="jod-ov-info-block">
                        <span className="jod-ov-label">Date Ordered</span>
                        <span className="jod-ov-value">{formatDate(projectDetails.date_ordered)}</span>
                    </div>
                    <div className="jod-ov-info-block jod-ov-due">
                        <span className="jod-ov-label">Due Date</span>
                        <span className="jod-ov-value due-date">{formatDate(projectDetails.due_date)}</span>
                    </div>
                    <div className="jod-ov-info-block jod-ov-priority">
                        <span className="jod-ov-label">Priority</span>
                        <span className={`jod-ov-value priority-${projectDetails.priority_level ? projectDetails.priority_level.toLowerCase() : 'low'}`}>
                            {projectDetails.priority_level || 'Normal'}
                        </span>
                    </div>
                </div>

                <div className="jod-ov-details-box">
                    <div className="jod-ov-details-header">
                        <span className="jod-ov-details-title">PROJECT DETAILS</span>
                    </div>
                    <div className="jod-ov-scroll-area">
                        {projectDetails.variables && projectDetails.variables.length > 0 ? (
                            projectDetails.variables.map(variable => (
                                <div key={variable.id} className="jod-ov-detail-item">
                                    <strong>{variable.variable_name}</strong>
                                    <p>{variable.variable_detail}</p>
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No variables assigned.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="jod-container jod-progress-container">
                <div className="jod-progress-header">
                    <h3 className="jod-container-title">Project Progress</h3>
                    <div className="jod-progress-bar-wrapper">
                        <div className="jod-progress-bar">
                            <div className="jod-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <span className="jod-progress-text">{completedStages}/{totalAssigned}</span>
                    </div>
                </div>
                
                <table className="jod-table wb-card-table">
                    <thead>
                        <tr>
                            <th>STAGE</th>
                            <th>WORKER</th>
                            <th>START DATE</th>
                            <th>DATE COMPLETED</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assignments.map((assignment) => (
                            <tr key={assignment.assignment_id}>
                                <td data-label="Stage">{assignment.stage_name}</td>
                                <td data-label="Worker">{assignment.first_name} {assignment.last_name}</td>
                                <td data-label="Start Date">{formatDate(assignment.start_date)}</td>
                                <td data-label="Date Completed">{assignment.date_completed ? formatDate(assignment.date_completed) : '-'}</td>
                                <td data-label="Status"><span className={`jod-status ${taskStatusClass(assignment.status)}`}>{assignment.status}</span></td>
                            </tr>
                        ))}
                        {assignments.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No workers assigned yet.</td></tr>
                        )}
                    </tbody>
                </table>

                <div className="jod-complete-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <button 
                        onClick={() => setShowConfirmModal(true)} 
                        className="jod-complete-btn" 
                        disabled={isCompleteDisabled}
                        style={{ 
                            opacity: isCompleteDisabled ? 0.5 : 1, 
                            cursor: isCompleteDisabled ? 'not-allowed' : 'pointer',
                            width: '100%' // In-adjust para maging pantay sa design
                        }}
                    >
                        Mark as Completed
                    </button>
                    {/* INFO TEXT: Para malaman ni PM kung bakit disabled yung button */}
                    {isCompleteDisabled && totalAssigned > 0 && (
                        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontStyle: 'italic' }}>
                            *All assigned stages must be Approved before completing.
                        </span>
                    )}
                </div>
            </div>

            <ProjectMaterials projectId={jobId} />

            <div className="jod-container jod-assign-container">
                <div className="jod-assign-header">
                    <h3 className="jod-container-title-white">Assign Worker</h3>
                </div>
                <form className="jod-form" onSubmit={handleAssign}>
                    <div className="jod-form-grid">
                        <div className="jod-form-group">
                            <label htmlFor={`${id}-stage`}>Stage</label>
                            <select id={`${id}-stage`} name="stage" value={formData.stage} onChange={handleChange}>
                                {ALL_STAGES.map(stageName => (
                                    <option key={stageName} value={stageName} disabled={assignedStages.includes(stageName)}>
                                        {stageName} {assignedStages.includes(stageName) ? '(Assigned)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="jod-form-group">
                            <label htmlFor={`${id}-workerId`}>Worker</label>
                            <select id={`${id}-workerId`} name="workerId" value={formData.workerId} onChange={handleChange}>
                                {filteredWorkers.length > 0 ? (
                                    filteredWorkers.map(worker => (
                                        <option key={worker.user_id} value={worker.user_id}>
                                            {worker.first_name} {worker.last_name}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">-- No available workers for this stage --</option>
                                )}
                            </select>
                        </div>

                        <div className="jod-form-group">
                            <label htmlFor={`${id}-startDate`}>Start Date</label>
                            <input id={`${id}-startDate`} type="date" name="startDate" value={formData.startDate} onChange={handleChange} required min={today} />
                        </div>
                        <div className="jod-form-group">
                            <label htmlFor={`${id}-dueDate`}>Due Date</label>
                            <input id={`${id}-dueDate`} type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required min={formData.startDate || today} />
                        </div>
                    </div>
                    <div className="jod-form-actions">
                        <button type="submit" className="jod-submit-btn" disabled={!formData.workerId || assignedStages.includes(formData.stage)}>
                            Assign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JobOrderDetail;

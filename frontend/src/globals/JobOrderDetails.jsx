import React, { useState, useEffect } from 'react';

const JobOrderDetail = ({ jobId, onBack }) => {
    const [projectDetails, setProjectDetails] = useState(null);
    const [workers, setWorkers] = useState([]); 
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- POP-UP STATES ---
    const [toast, setToast] = useState({ visible: false, message: '', type: '' });
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
    };

    const [formData, setFormData] = useState({ stage: 'Carpenter', workerId: '', startDate: '', dueDate: '' });

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // FIX: Tinanggal ang localhost dito
            const detailsRes = await fetch(import.meta.env.VITE_BACKEND_IP + `/api/job-orders/${jobId}`);
            if (detailsRes.ok) setProjectDetails(await detailsRes.json());

            // FIX: Tinanggal ang localhost dito
            const assignRes = await fetch(import.meta.env.VITE_BACKEND_IP + `/api/job-orders/${jobId}/assignments`);
            if (assignRes.ok) setAssignments(await assignRes.json());

            if (workers.length === 0) {
                // FIX: Tinanggal ang localhost dito
                const workersRes = await fetch(import.meta.env.VITE_BACKEND_IP + `/api/workers`);
                if (workersRes.ok) setWorkers(await workersRes.json());
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (jobId) fetchAllData(); }, [jobId]);

    const allStages = ['Carpenter', 'Carver', 'Liha', 'Painter', 'Delivery'];
    const assignedStages = assignments.map(a => a.stage_name);

    useEffect(() => {
        if (assignedStages.includes(formData.stage)) {
            const firstAvailable = allStages.find(s => !assignedStages.includes(s));
            if (firstAvailable) setFormData(prev => ({ ...prev, stage: firstAvailable }));
        }
    }, [assignments, formData.stage]);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const filteredWorkers = workers.filter(w => w.job_role && w.job_role.toLowerCase() === formData.stage.toLowerCase());

    useEffect(() => {
        if (filteredWorkers.length > 0) setFormData(prev => ({ ...prev, workerId: filteredWorkers[0].user_id }));
        else setFormData(prev => ({ ...prev, workerId: '' })); 
    }, [formData.stage, workers]); 

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
            // FIX: Tinanggal ang localhost dito sa POST request
            const response = await fetch(import.meta.env.VITE_BACKEND_IP + `/api/job-orders/${jobId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                showToast("Worker assigned successfully!", "success");
                fetchAllData(); 
                setFormData(prev => ({ ...prev, startDate: '', dueDate: '' })); 
            } else {
                showToast("Failed to assign worker.", "error");
            }
        } catch (error) {
            console.error("Submit error:", error);
        }
    };

    // --- BAGONG MARK AS COMPLETE LOGIC ---
    const executeCompleteProject = async () => {
        setShowConfirmModal(false); // Itago ang modal
        try {
            // FIX: Tinanggal ang localhost dito sa PUT request
            const response = await fetch(import.meta.env.VITE_BACKEND_IP + `/api/projects/${jobId}/complete`, { method: 'PUT' });
            if (response.ok) {
                showToast("Project Marked as Completed!", "success");
                setTimeout(() => onBack(), 2000); // Wait 2 secs para makita ang success message bago bumalik
            } else {
                showToast("Failed to complete project.", "error");
            }
        } catch (error) {
            console.error("Complete error:", error);
            showToast("Server error. Paki-check ang connection.", "error");
        }
    };

    const formatDateToWords = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };
    const formatId = (id) => `WB-${String(id).padStart(2, '0')}`;
    const getStatusClass = (status) => status ? status.toLowerCase().replace(' ', '-') : '';

    if (loading) return <div className="jod-wrapper"><p style={{ textAlign: 'center' }}>Loading project data...</p></div>;
    if (!projectDetails) return <div className="jod-wrapper"><button onClick={onBack}>Back</button><p>Project not found.</p></div>;

    const totalAssigned = assignments.length; 
    const completedStages = assignments.filter(a => a.status === 'Approved').length;
    const progressPercent = totalAssigned === 0 ? 0 : (completedStages / totalAssigned) * 100;

    // --- BAGONG LOGIC: Disable ba ang button? ---
    // Disable kung walang assigned OR kung mas mababa ang completed sa total assigned
    const isCompleteDisabled = totalAssigned === 0 || completedStages < totalAssigned;

    return (
        <div className="jod-wrapper">
            {/* RENDER TOAST */}
            {toast.visible && (
                <div className="wb-toast-container">
                    <div className={`wb-toast ${toast.type}`}>
                        {toast.type === 'success' ? '' : ''} {toast.message}
                    </div>
                </div>
            )}

            {/* RENDER CUSTOM CONFIRM MODAL */}
            {showConfirmModal && (
                <div className="wb-modal-overlay">
                    <div className="wb-modal-box">
                        <h3 className="wb-modal-title">Complete Project?</h3>
                        <p className="wb-modal-text">Sigurado ka bang tapos na ang project na ito? Malilipat ito sa Project History.</p>
                        <div className="wb-modal-actions">
                            <button className="wb-btn-no" onClick={() => setShowConfirmModal(false)}>Cancel</button>
                            <button className="wb-btn-yes" onClick={executeCompleteProject}>Yes, Complete It</button>
                        </div>
                    </div>
                </div>
            )}

            <button className="jod-back-btn" onClick={onBack}>← Back to Job Order List</button>

            <div className="jod-container jod-overview-container">
                <div className="jod-ov-header">
                    <h1 className="jod-ov-id">{formatId(projectDetails.id)}</h1>
                    <p className="jod-ov-name">{projectDetails.project_name}</p>
                </div>

                <div className="jod-ov-info-bar">
                    <div className="jod-ov-info-block">
                        <span className="jod-ov-label">Date Ordered</span>
                        <span className="jod-ov-value">{formatDateToWords(projectDetails.date_ordered)}</span>
                    </div>
                    <div className="jod-ov-info-block jod-ov-due">
                        <span className="jod-ov-label">Due Date</span>
                        <span className="jod-ov-value due-date">{formatDateToWords(projectDetails.due_date)}</span>
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
                            <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#8b816a' }}>No variables assigned.</p>
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
                
                <table className="jod-table">
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
                                <td>{assignment.stage_name}</td>
                                <td>{assignment.first_name} {assignment.last_name}</td>
                                <td>{new Date(assignment.start_date).toLocaleDateString()}</td>
                                <td>{assignment.date_completed ? new Date(assignment.date_completed).toLocaleDateString() : '-'}</td>
                                <td><span className={`jod-status ${getStatusClass(assignment.status)}`}>{assignment.status}</span></td>
                            </tr>
                        ))}
                        {assignments.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: '#8b816a' }}>No workers assigned yet.</td></tr>
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
                        <span style={{ fontSize: '12px', color: '#d9534f', fontStyle: 'italic' }}>
                            *All assigned stages must be Approved before completing.
                        </span>
                    )}
                </div>
            </div>

            <div className="jod-container jod-assign-container">
                <div className="jod-assign-header">
                    <h3 className="jod-container-title-white">Assign Worker</h3>
                </div>
                <form className="jod-form" onSubmit={handleAssign}>
                    <div className="jod-form-grid">
                        <div className="jod-form-group">
                            <label>Stage</label>
                            <select name="stage" value={formData.stage} onChange={handleChange}>
                                {allStages.map(stageName => (
                                    <option key={stageName} value={stageName} disabled={assignedStages.includes(stageName)}>
                                        {stageName} {assignedStages.includes(stageName) ? '(Assigned)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="jod-form-group">
                            <label>Worker</label>
                            <select name="workerId" value={formData.workerId} onChange={handleChange}>
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
                            <label>Start Date</label>
                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required min={today} />
                        </div>
                        <div className="jod-form-group">
                            <label>Due Date</label>
                            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required min={formData.startDate || today} />
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

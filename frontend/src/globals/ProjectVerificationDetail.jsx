import React, { useState, useEffect } from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatDate, formatProjectId } from '../utils/format';

const ProjectVerificationDetail = ({ projectId, onBack }) => {
    const [projectInfo, setProjectInfo] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const showToast = useToast();

    useEffect(() => {
        let ignore = false;

        const fetchDetails = async (idToFetch) => {
            setLoading(true);
            try {
                const info = await api.get(`/api/job-orders/${idToFetch}`);
                const assignData = await api.get(`/api/job-orders/${idToFetch}/assignments`);
                if (ignore) return;

                setProjectInfo(info);
                const formattedTasks = assignData.map(t => ({
                    id: t.assignment_id,
                    stage: t.stage_name,
                    worker: `${t.first_name} ${t.last_name}`,
                    start: formatDate(t.start_date),
                    due: formatDate(t.due_date),
                    status: t.status
                }));
                setTasks(formattedTasks);
            } catch (error) {
                if (!ignore) console.error("Error fetching detail data:", error.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        if (projectId) {
            const numericId = String(projectId).replace('WB-', '').replace(/^0+/, '');
            fetchDetails(numericId);
        }

        return () => { ignore = true; };
    }, [projectId]);

    const handleStatusUpdate = async (assignmentId, newStatus) => {
        try {
            await api.put(`/api/assignments/${assignmentId}/status`, { status: newStatus });

            setTasks(tasks.map(task =>
                task.id === assignmentId ? { ...task, status: newStatus } : task
            ));

            // --- GINAMIT ANG TOAST IMBES NA ALERT ---
            if (newStatus === 'Repair') {
                showToast("Task assigned back to worker for repair", "error");
            } else if (newStatus === 'Approved') {
                showToast("Task successfully approved!", "success");
            }
        } catch (error) {
            console.error("Error updating status:", error.message);
            showToast(error.message || "Cannot update status. Please check your connection.", "error");
        }
    };

    if (loading) return <div className="qc-pvd-wrapper"><p style={{padding: '20px'}}>Loading details...</p></div>;
    if (!projectInfo) return <div className="qc-pvd-wrapper"><button className="qc-pvd-back-btn" onClick={onBack}>← Back</button><p>Project not found.</p></div>;

    const totalTasks = tasks.length || 1;
    const approvedTasks = tasks.filter(t => t.status === 'Approved').length;
    const progressPercent = (approvedTasks / totalTasks) * 100;

    return (
        <div className="qc-pvd-wrapper">
            <button className="qc-pvd-back-btn" onClick={onBack}>← Back to Project List</button>

            <div className="qc-pvd-container qc-pvd-ov-container">
                <div className="qc-pvd-header">
                    <h1 className="qc-pvd-id">{formatProjectId(projectInfo.id)}</h1>
                    <p className="qc-pvd-name">{projectInfo.project_name}</p>
                </div>

                <div className="qc-pvd-info-bar">
                    <div className="qc-pvd-info-block">
                        <span className="qc-pvd-label">Date Ordered</span>
                        <span className="qc-pvd-value">{formatDate(projectInfo.date_ordered)}</span>
                    </div>
                    <div className="qc-pvd-info-block">
                        <span className="qc-pvd-label">Due Date</span>
                        <span className="qc-pvd-value qc-pvd-due">{formatDate(projectInfo.due_date)}</span>
                    </div>
                    <div className="qc-pvd-info-block">
                        <span className="qc-pvd-label">Priority</span>
                        <span className="qc-pvd-value qc-pvd-priority">{projectInfo.priority_level || 'Normal'}</span>
                    </div>
                </div>

                <div className="qc-pvd-details-box">
                    <div className="qc-pvd-details-header">
                        <span className="qc-pvd-details-title">PROJECT DETAILS</span>
                    </div>
                    <div className="qc-pvd-scroll-area">
                        {projectInfo.variables && projectInfo.variables.length > 0 ? (
                            projectInfo.variables.map(v => (
                                <div key={v.id} className="qc-pvd-detail-item">
                                    <strong>{v.variable_name}</strong>
                                    <p>{v.variable_detail}</p>
                                </div>
                            ))
                        ) : (
                            <p style={{fontSize: '12px', fontStyle: 'italic'}}>No specific details provided.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="qc-pvd-container">
                <div className="qc-pvd-progress-header">
                    <h3 className="qc-pvd-title">Project Progress</h3>
                    <div className="qc-pvd-bar-wrapper">
                        <div className="qc-pvd-bar">
                            <div className="qc-pvd-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <span className="qc-pvd-progress-text">{approvedTasks}/{totalTasks}</span>
                    </div>
                </div>
                
                <table className="qc-pvd-table">
                    <thead>
                        <tr>
                            <th>STAGE</th>
                            <th>WORKER</th>
                            <th>START DATE</th>
                            <th>DUE DATE</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map(task => (
                            <tr key={task.id}>
                                <td>{task.stage}</td>
                                <td>{task.worker}</td>
                                <td>{task.start}</td>
                                <td>{task.due}</td>
                                <td>
                                    {task.status === 'For QA' ? (
                                        <div className="qc-pvd-actions">
                                            <button 
                                                className="qc-pvd-btn approve" 
                                                onClick={() => handleStatusUpdate(task.id, 'Approved')}
                                            >
                                                ✓ Approve
                                            </button>
                                            <button 
                                                className="qc-pvd-btn repair" 
                                                onClick={() => handleStatusUpdate(task.id, 'Repair')}
                                            >
                                                ✕ Repair
                                            </button>
                                        </div>
                                    ) : task.status === 'Repair' ? (
                                        <span className="qc-pvd-status-badge" style={{backgroundColor: '#ff0000', color: '#ffffff'}}>Needs Repair</span>
                                    ) : (
                                        <span className="qc-pvd-status-badge">{task.status}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProjectVerificationDetail;

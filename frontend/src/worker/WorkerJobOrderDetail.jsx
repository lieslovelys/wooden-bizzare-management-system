import React, { useState, useEffect } from 'react';

const WorkerJobOrderDetail = ({ projectId, assignmentId, workerStatus, onBack }) => {
    const [currentStatus, setCurrentStatus] = useState(workerStatus || 'Assigned');
    
    const [projectDetails, setProjectDetails] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- BAGONG STATES PARA SA POP-UPS ---
    const [toast, setToast] = useState({ visible: false, message: '', type: '' });
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
    };

    useEffect(() => {
        const fetchProjectData = async () => {
            setLoading(true);
            try {
                const detailsRes = await fetch(`http://localhost:8080/api/job-orders/${projectId}`);
                if (detailsRes.ok) setProjectDetails(await detailsRes.json());

                const assignRes = await fetch(`http://localhost:8080/api/job-orders/${projectId}/assignments`);
                if (assignRes.ok) setAssignments(await assignRes.json());

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (projectId) fetchProjectData();
    }, [projectId]);

    const formatId = (id) => `WB-${String(id).padStart(2, '0')}`;
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    // --- BINAGONG LOGIC: Papalabasin muna ang modal ---
    const handleActionClick = () => {
        setShowConfirmModal(true);
    };

    // --- BAGONG LOGIC: Ito ang mag-e-execute kapag nag-YES sa Modal ---
    const executeSubmitWork = async () => {
        setShowConfirmModal(false); // Itago agad yung confirmation modal
        
        try {
            const response = await fetch(`http://localhost:8080/api/assignments/${assignmentId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'For QA' })
            });

            if (response.ok) {
                setCurrentStatus('For QA');
                
                setAssignments(prevAssignments => 
                    prevAssignments.map(assign => 
                        assign.assignment_id === assignmentId 
                            ? { ...assign, status: 'For QA' } 
                            : assign
                    )
                );
                
                // Ipakita ang Success Toast imbes na alert()
                showToast("Work submitted to Quality Checker!", "success");
                
                // Automatic babalik sa Job Order List after 1.5 seconds!
                setTimeout(() => {
                    onBack();
                }, 1500);

            } else {
                showToast("Failed to update status.", "error");
            }
        } catch (error) {
            console.error("Error submitting work:", error);
            showToast("May problema sa connection sa server.", "error");
        }
    };

    const renderActionButton = () => {
        if (currentStatus === 'Assigned' || currentStatus === 'In Progress') {
            return (
                <button className="wjo-action-btn done" onClick={handleActionClick}>
                    I AM DONE
                </button>
            );
        } else if (currentStatus === 'Repair' || currentStatus === 'Rework') {
            return (
                <button className="wjo-action-btn repair" onClick={handleActionClick}>
                    WORK REPAIR
                </button>
            );
        } else if (currentStatus === 'For QA' || currentStatus === 'Work Submitted') {
            return (
                <button className="wjo-action-btn submitted" disabled>
                    WORK SUBMITTED
                </button>
            );
        }
        return null;
    };

    if (loading) return <div className="wjo-detail-wrapper"><p>Loading...</p></div>;
    if (!projectDetails) return <div className="wjo-detail-wrapper"><button onClick={onBack}>Back</button><p>Project not found.</p></div>;

    return (
        <div className="wjo-detail-wrapper">
            
            {/* RENDER TOAST NOTIFICATION */}
            {toast.visible && (
                <div className="wb-toast-container">
                    <div className={`wb-toast ${toast.type}`}>
                        {toast.type === 'success' ? '' : ''} {toast.message}
                    </div>
                </div>
            )}

            {/* RENDER CUSTOM CONFIRMATION MODAL */}
            {showConfirmModal && (
                <div className="wb-modal-overlay">
                    <div className="wb-modal-box">
                        <h3 className="wb-modal-title">Submit Work?</h3>
                        <p className="wb-modal-text">Sigurado ka bang tapos na ito at ipapasa na sa Quality Checker?</p>
                        <div className="wb-modal-actions">
                            <button className="wb-btn-no" onClick={() => setShowConfirmModal(false)}>Cancel</button>
                            <button className="wb-btn-yes" onClick={executeSubmitWork}>Yes, Submit</button>
                        </div>
                    </div>
                </div>
            )}

            <button className="wjo-back-btn" onClick={onBack}>← Back to Job Order List</button>

            <div className="wjo-container wjo-ov-container">
                <div className="wjo-ov-header">
                    <h1 className="wjo-ov-id">{formatId(projectDetails.id)}</h1>
                    <p className="wjo-ov-name">{projectDetails.project_name}</p>
                </div>

                <div className="wjo-ov-info-bar">
                    <div className="wjo-ov-info-block">
                        <span className="wjo-ov-label">Date Ordered</span>
                        <span className="wjo-ov-value">{formatDate(projectDetails.date_ordered)}</span>
                    </div>
                    <div className="wjo-ov-info-block">
                        <span className="wjo-ov-label">Due Date</span>
                        <span className="wjo-ov-value due-date">{formatDate(projectDetails.due_date)}</span>
                    </div>
                    <div className="wjo-ov-info-block">
                        <span className="wjo-ov-label">Priority</span>
                        <span className={`wjo-ov-value priority-${projectDetails.priority_level?.toLowerCase()}`}>
                            {projectDetails.priority_level || 'Normal'}
                        </span>
                    </div>
                </div>

                <div className="wjo-ov-details-box">
                    <div className="wjo-ov-details-header">
                        <span className="wjo-ov-details-title">PROJECT DETAILS</span>
                    </div>
                    <div className="wjo-ov-scroll-area">
                        {projectDetails.variables && projectDetails.variables.length > 0 ? (
                            projectDetails.variables.map(v => (
                                <div key={v.id} className="wjo-ov-detail-item">
                                    <strong>{v.variable_name}</strong>
                                    <p>{v.variable_detail}</p>
                                </div>
                            ))
                        ) : (
                            <p style={{fontStyle: 'italic', fontSize: '12px'}}>No variables.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="wjo-container">
                <div className="wjo-progress-header">
                    <h3 className="wjo-container-title">Project Progress</h3>
                </div>
                <table className="wjo-table">
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
                        {assignments.map(assign => (
                            <tr key={assign.assignment_id}>
                                <td>{assign.stage_name}</td>
                                <td>{assign.first_name} {assign.last_name}</td>
                                <td>{new Date(assign.start_date).toLocaleDateString()}</td>
                                <td>{new Date(assign.due_date).toLocaleDateString()}</td>
                                <td><span className={`wjo-status ${assign.status.toLowerCase().replace(' ', '-')}`}>{assign.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="wjo-action-container">
                {renderActionButton()}
            </div>
        </div>
    );
};

export default WorkerJobOrderDetail;
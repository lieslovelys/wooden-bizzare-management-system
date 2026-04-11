import React, { useState, useEffect } from 'react';

const WorkerJobOrderDetail = ({ projectId, assignmentId, workerStatus, onBack }) => {
    const [currentStatus, setCurrentStatus] = useState(workerStatus || 'Assigned');
    
    const [projectDetails, setProjectDetails] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const handleActionClick = async () => {
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
                
                alert("Naipasa na sa Quality Checker!");
            } else {
                console.error("Failed to update status.");
            }
        } catch (error) {
            console.error("Error submitting work:", error);
            alert("May problema sa connection sa server.");
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
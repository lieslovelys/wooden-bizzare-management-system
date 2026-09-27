import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatDate, formatProjectId } from '../utils/format';
import ConfirmModal from '../globals/ConfirmModal';

const WorkerJobOrderDetail = ({ projectId, assignmentId, workerStatus, onBack }) => {
    const [currentStatus, setCurrentStatus] = useState(workerStatus || 'Assigned');

    const [projectDetails, setProjectDetails] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- BAGONG STATES PARA SA POP-UPS ---
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const showToast = useToast();

    // The post-submit success toast is followed by a delayed onBack() — cancel that delay on
    // unmount so it can't navigate after this component is already gone.
    const backTimerRef = useRef(null);
    useEffect(() => {
        return () => {
            if (backTimerRef.current) {
                clearTimeout(backTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let ignore = false;

        const fetchProjectData = async () => {
            setLoading(true);
            try {
                // P2: /job-orders/:id now answers {success, data} instead of the bare project
                // object — see ARCHITECTURE_REVIEW.md P2.
                const details = await api.get(`/api/job-orders/${projectId}`);
                // P1-3: this endpoint now answers {success, data, meta} instead of a bare array.
                const assigns = await api.get(`/api/job-orders/${projectId}/assignments`);
                if (ignore) return;
                setProjectDetails(details.data);
                setAssignments(assigns.data || []);
            } catch (error) {
                if (!ignore) console.error("Error fetching data:", error.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        if (projectId) fetchProjectData();
        return () => { ignore = true; };
    }, [projectId]);

    // --- BINAGONG LOGIC: Papalabasin muna ang modal ---
    const handleActionClick = () => {
        setShowConfirmModal(true);
    };

    // --- BAGONG LOGIC: Ito ang mag-e-execute kapag nag-YES sa Modal ---
    const executeSubmitWork = async () => {
        setShowConfirmModal(false); // Itago agad yung confirmation modal
        
        try {
            await api.put(`/api/assignments/${assignmentId}/status`, { status: 'For QA' });

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
            backTimerRef.current = setTimeout(() => {
                onBack();
            }, 1500);
        } catch (error) {
            console.error("Error submitting work:", error.message);
            showToast(error.message || "May problema sa connection sa server.", "error");
        }
    };

    // FR-6/FR-9 (taken as a deliberate early slice — see track-A plan commit 3): a worker whose
    // own stage was sent back for repair can now see why. `assignments` holds every stage on the
    // project (not just this worker's), so find this worker's own row by `assignmentId` — the id
    // WorkerJobOrder.jsx already passed in to identify which task is being viewed.
    const myAssignment = assignments.find(a => a.assignment_id === assignmentId);
    const reviewerName = myAssignment && (myAssignment.qa_checker_first_name || myAssignment.qa_checker_last_name)
        ? `${myAssignment.qa_checker_first_name || ''} ${myAssignment.qa_checker_last_name || ''}`.trim()
        : null;

    const renderRepairReason = () => {
        if (currentStatus !== 'Repair' && currentStatus !== 'Rework') return null;
        if (!myAssignment?.qa_notes) return null;
        return (
            <div className="wjo-repair-reason">
                <strong>Reason for repair{reviewerName ? ` (from ${reviewerName})` : ''}:</strong>
                <p>{myAssignment.qa_notes}</p>
            </div>
        );
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
        } else if (currentStatus === 'Approved') {
            return (
                <button className="wjo-action-btn approved" disabled>
                    APPROVED
                </button>
            );
        }
        return null;
    };

    if (loading) return <div className="wjo-detail-wrapper"><p>Loading...</p></div>;
    if (!projectDetails) return <div className="wjo-detail-wrapper"><button onClick={onBack}>Back</button><p>Project not found.</p></div>;

    return (
        <div className="wjo-detail-wrapper">
            {showConfirmModal && (
                <ConfirmModal
                    title="Submit Work?"
                    text="Are you sure to submit your work to Quality Checker?"
                    confirmLabel="Yes, Submit"
                    onCancel={() => setShowConfirmModal(false)}
                    onConfirm={executeSubmitWork}
                />
            )}

            <button className="wjo-back-btn" onClick={onBack}>← Back to Job Order List</button>

            <div className="wjo-container wjo-ov-container">
                <div className="wjo-ov-header">
                    <h1 className="wjo-ov-id">{formatProjectId(projectDetails.id)}</h1>
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
                <table className="wjo-table wb-card-table">
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
                                <td data-label="Stage">{assign.stage_name}</td>
                                <td data-label="Worker">{assign.first_name} {assign.last_name}</td>
                                {/* FIX: Ginamit ang formatDate function dito */}
                                <td data-label="Start Date">{formatDate(assign.start_date)}</td>
                                <td data-label="Due Date">{formatDate(assign.due_date)}</td>
                                <td data-label="Status"><span className={`wjo-status ${assign.status.toLowerCase().replace(' ', '-')}`}>{assign.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {renderRepairReason()}

            <div className="wjo-action-container">
                {renderActionButton()}
            </div>
        </div>
    );
};

export default WorkerJobOrderDetail;

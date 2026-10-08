import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // <-- 1. IDINAGDAG ITO
import ProjectVerificationDetail from './ProjectVerificationDetail';
import Pagination from './Pagination';
import { api } from '../api/client';
import { formatProjectId } from '../utils/format';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { clickableProps } from '../utils/a11y';

const ProjectVerification = () => {
    const [stageFilter, setStageFilter] = useState('All');
    const [selectedProjectId, setSelectedProjectId] = useState(null);

    const location = useLocation(); // <-- 2. I-SETUP ANG LOCATION

    // P1-3: server-paginated and server-filtered — `stage` used to be a client-side .filter()
    // over the whole fetched list (see ARCHITECTURE_REVIEW.md P1-3).
    const { rows: rawTasks, meta, page, setPage, loading } = usePaginatedList('/api/qa/tasks', {
        params: { stage: stageFilter !== 'All' ? stageFilter : undefined },
        pageSize: 25,
    });

    const displayedTasks = rawTasks.map(task => ({
        id: formatProjectId(task.project_id),
        rawProjectId: task.project_id,
        projectName: task.project_name,
        workerName: `${task.first_name} ${task.last_name}`,
        stage: task.stage_name,
        assignmentId: task.assignment_id
    }));

    // --- 3. BAGONG USEEFFECT PARA SA NOTIFICATION ---
    // P1-3: resolves the notification target directly via GET /api/assignments/:id instead of
    // searching the (now paged) task list for it — the target task may not be on the currently
    // loaded page. See ARCHITECTURE_REVIEW.md P1-3.
    useEffect(() => {
        if (!(location.state && location.state.targetTaskId)) return;
        let ignore = false;
        (async () => {
            try {
                const result = await api.get(`/api/assignments/${location.state.targetTaskId}`);
                if (!ignore && result?.data) {
                    setSelectedProjectId(result.data.project_id);
                    window.history.replaceState({}, document.title);
                }
            } catch (error) {
                if (!ignore) console.error("Error resolving notification target:", error.message);
            }
        })();
        return () => { ignore = true; };
    }, [location]);
    // ------------------------------------------------

    if (selectedProjectId) {
        return (
            <ProjectVerificationDetail 
                projectId={selectedProjectId} 
                onBack={() => setSelectedProjectId(null)} 
            />
        );
    }

    return (
        <div className="qc-pv-wrapper">
            <div className="qc-pv-header">
                <h2 className="qc-pv-title">PROJECT VERIFICATION LIST</h2>
                <p className="qc-pv-subtitle">Click project to verify</p>
            </div>

            <div className="qc-pv-controls">
                <select
                    className="qc-pv-dropdown"
                    aria-label="Filter by stage"
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                >
                    <option value="All">Stage</option>
                    <option value="Carpenter">Carpenter</option>
                    <option value="Carver">Carver</option>
                    <option value="Liha">Liha</option>
                    <option value="Painter">Painter</option>
                    <option value="Delivery">Delivery</option>
                </select>
            </div>

            <div className="qc-pv-list">
                <div className="qc-pv-row qc-pv-list-header">
                    <div>Project ID</div>
                    <div>Project Name</div>
                    <div>Worker Name</div>
                    <div>Stage</div>
                </div>

                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#5b5035' }}>
                        Loading submitted projects...
                    </div>
                ) : displayedTasks.length > 0 ? (
                    displayedTasks.map((task, index) => (
                        <div 
                            key={index} 
                            className="qc-pv-row qc-pv-item"
                            {...clickableProps(() => setSelectedProjectId(task.rawProjectId))}
                        >
                            <div>{task.id}</div>
                            <div>{task.projectName}</div>
                            <div>{task.workerName}</div>
                            <div>{task.stage}</div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No pending projects for Quality Check.
                    </div>
                )}
            </div>

            <Pagination page={page} meta={meta} onChange={setPage} />
        </div>
    );
};

export default ProjectVerification;

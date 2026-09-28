import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import JobOrderDetails from './JobOrderDetails';
import Pagination from './Pagination';
import { formatDateShort, formatProjectId } from '../utils/format';
import { usePaginatedList } from '../hooks/usePaginatedList';

const ALL_PRIORITIES = ['High', 'Medium', 'Low'];

const JobOrderList = () => {
    const location = useLocation();

    // Binago natin 'to. Imbes na ID lang para ma-highlight,
    // ginawa nating state para malaman kung anong view ang ipapakita.
    //
    // Derived from location.state at mount time (a notification link always mounts this
    // component fresh via a route change — see Admin.jsx/ProductionManager.jsx — so a lazy
    // initializer is sufficient) rather than an effect that calls setState directly, which
    // eslint-plugin-react-hooks' set-state-in-effect rule flags as an avoidable extra render.
    const [viewingJobId, setViewingJobId] = useState(() => location.state?.targetProjectId ?? null);

    const [activePriorities, setActivePriorities] = useState(ALL_PRIORITIES);
    const [sortDesc, setSortDesc] = useState(false);

    // --- 3. BAGONG USEEFFECT PARA SA NOTIFICATION CLICK ---
    // I-clear ang history state para kung i-refresh ni user ang page, hindi siya mag-loop.
    useEffect(() => {
        if (location.state && location.state.targetProjectId) {
            window.history.replaceState({}, document.title);
        }
    }, [location]);
    // -----------------------------------------------------

    // P1-3: server-paginated, server-filtered, and server-sorted — the priority filter and the
    // "sort by nearest due date" button both used to re-derive from the whole fetched table
    // client-side (see ARCHITECTURE_REVIEW.md P1-3). Omitting `priority` when every option is
    // selected preserves the original unfiltered request.
    const priorityParam = activePriorities.length < ALL_PRIORITIES.length ? activePriorities : undefined;
    const { rows: filteredJobs, meta, page, setPage, loading } = usePaginatedList('/api/job-orders', {
        params: { priority: priorityParam, sort: sortDesc ? 'desc' : undefined },
        pageSize: 25,
    });

    const handleSortClick = () => setSortDesc(prev => !prev);

    const togglePriority = (priority) => {
        setActivePriorities(prev => {
            if (prev.includes(priority)) return prev.filter(p => p !== priority);
            return [...prev, priority];
        });
    };

    // --- VIEW SWITCHER LOGIC ---
    // Kung may naka-set na viewingJobId, i-render ang Detail Page
    if (viewingJobId) {
        return (
            <JobOrderDetails
                jobId={viewingJobId} 
                onBack={() => setViewingJobId(null)} // Reset state para bumalik sa list
            />
        );
    }

    // Kung walang naka-set, i-render ang Job Order List
    return (
        <div className="jol-wrapper">
            <div className="jol-header">
                <h2 className="jol-title">JOB ORDER LIST</h2>
                <p className="jol-subtitle">Click order to assign worker</p>
            </div>

            <div className="jol-controls">
                <button className="jol-btn" onClick={handleSortClick}>
                    Sort by Due Date ({sortDesc ? 'Farthest first' : 'Nearest first'})
                </button>

                <div className="jol-filter-group">
                    <span className="jol-filter-label">Filter Priority:</span>
                    <button className={`jol-btn ${activePriorities.includes('High') ? 'active high' : ''}`} onClick={() => togglePriority('High')}>HIGH</button>
                    <button className={`jol-btn ${activePriorities.includes('Medium') ? 'active medium' : ''}`} onClick={() => togglePriority('Medium')}>MEDIUM</button>
                    <button className={`jol-btn ${activePriorities.includes('Low') ? 'active low' : ''}`} onClick={() => togglePriority('Low')}>LOW</button>
                </div>
            </div>

            <div className="jol-list">
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Loading job orders...
                    </div>
                ) : filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className="jol-item"
                            onClick={() => setViewingJobId(job.id)} // Dito tina-trigger yung pag-switch ng view
                        >
                            <div className="jol-name">{formatProjectId(job.id)} {job.project_name}</div>
                            <div className="jol-date">{formatDateShort(job.due_date)}</div>
                            <div className={`jol-priority ${job.priority_level ? job.priority_level.toLowerCase() : ''}`}>
                                {job.priority_level ? job.priority_level.toUpperCase() : 'N/A'}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        No projects match the selected priority filters.
                    </div>
                )}
            </div>

            <Pagination page={page} meta={meta} onChange={setPage} />
        </div>
    );
};

export default JobOrderList;

import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../css/worker.css';
import WorkerJobOrderDetail from './WorkerJobOrderDetail';
import Pagination from '../globals/Pagination';
import { api } from '../api/client';
import { UserContext } from '../context/UserContext';
import { formatDateShort, formatProjectId } from '../utils/format';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { clickableProps } from '../utils/a11y';

const FILTERS = ['Assigned', 'Repair', 'For QA', 'Approved'];

const EMPTY_MESSAGE = {
    Assigned: 'No assigned tasks.',
    Repair: 'Nothing sent back for repair.',
    'For QA': 'No tasks waiting on Quality Checker.',
    Approved: 'No approved tasks yet.',
};

const mapTasks = (data) => data.map(task => ({
    id: formatProjectId(task.project_id),
    name: task.project_name,
    dueDate: task.due_date,
    priority: task.priority || 'Normal',
    status: task.status,
    projectId: task.project_id,
    assignmentId: task.assignment_id
}));

const WorkerJobOrder = () => {
    const { userID } = useContext(UserContext);
    const location = useLocation();

    const [activeFilter, setActiveFilter] = useState('Assigned');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [sortDesc, setSortDesc] = useState(false);
    // { projectId, assignmentId, status } of the currently-open task, or null for the list view.
    const [selectedTask, setSelectedTask] = useState(null);

    // P1-3: server-paginated and server-filtered — status/priority/sort used to be client-side
    // .filter()/.sort() over the whole fetched list (see ARCHITECTURE_REVIEW.md P1-3).
    const { rows: rawTasks, meta, page, setPage, loading, refetch } = usePaginatedList(
        userID ? `/api/workers/${userID}/tasks` : null,
        {
            params: {
                status: activeFilter,
                priority: priorityFilter !== 'All' ? priorityFilter : undefined,
                sort: sortDesc ? 'desc' : undefined,
            },
            pageSize: 25,
        }
    );
    const displayedTasks = mapTasks(rawTasks);

    // FR-9 remainder: a worker's own QA-outcome notification (globals/NotificationList.jsx via
    // worker/WorkerNotification.jsx) deep-links here with the assignment id — resolve it directly
    // via GET /api/assignments/:id rather than requiring it to be on the currently-loaded (and
    // filtered) page. Mirrors globals/ProjectVerification.jsx's identical pattern.
    useEffect(() => {
        if (!location.state?.targetAssignmentId) return;
        let ignore = false;
        (async () => {
            try {
                const result = await api.get(`/api/assignments/${location.state.targetAssignmentId}`);
                if (!ignore && result?.data) {
                    setSelectedTask({
                        projectId: result.data.project_id,
                        assignmentId: result.data.assignment_id,
                        status: result.data.status,
                    });
                    window.history.replaceState({}, document.title);
                }
            } catch (error) {
                if (!ignore) console.error("Error resolving notification target:", error.message);
            }
        })();
        return () => { ignore = true; };
    }, [location]);

    if (selectedTask) {
        return (
            <WorkerJobOrderDetail
                projectId={selectedTask.projectId}
                assignmentId={selectedTask.assignmentId}
                workerStatus={selectedTask.status}
                onBack={() => {
                    setSelectedTask(null); // Itago ang details
                    refetch(); // <-- TATAWAGIN NATIN ULIT YUNG BACKEND PARA MAG-REFRESH!
                }}
            />
        );
    }

    return (
        <div className="wjo-wrapper">
            <div className="wjo-header">
                <h2 className="wjo-title">JOB ORDER LIST</h2>
                <p className="wjo-subtitle">Click order to view</p>
            </div>

            <div className="wjo-controls">
                <span className="wjo-filter-label">Filtered by:</span>
                <button className="wjo-btn-dark" onClick={() => setSortDesc(prev => !prev)}>
                    Due {sortDesc ? '▼' : '▲'}
                </button>
                <select className="wjo-btn-dark dropdown" aria-label="Filter by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                    <option value="All">Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
                {FILTERS.map((status) => (
                    <button
                        key={status}
                        className={`wjo-filter-btn ${status.toLowerCase().replace(' ', '-')} ${activeFilter === status ? 'active' : ''}`}
                        onClick={() => setActiveFilter(status)}
                    >
                        {status}
                    </button>
                ))}
            </div>

            <div className="wjo-list">
                {!userID || loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-danger)' }}>
                        {!userID ? 'Loading worker session...' : 'Loading tasks...'}
                    </div>
                ) : displayedTasks.length > 0 ? (
                    displayedTasks.map((task) => (
                        <div
                            key={task.assignmentId}
                            className="wjo-item"
                            {...clickableProps(() => setSelectedTask({ projectId: task.projectId, assignmentId: task.assignmentId, status: task.status }))}
                        >
                            <div className="wjo-item-id">{task.id}</div>
                            <div className="wjo-item-name">{task.name}</div>
                            <div className="wjo-item-center">{formatDateShort(task.dueDate)}</div>
                            <div className={`wjo-item-center wjo-priority ${task.priority.toLowerCase()}`}>{task.priority}</div>
                            <div className="wjo-badge-container">
                                <div className={`wjo-badge ${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        {EMPTY_MESSAGE[activeFilter] || 'No tasks.'}
                    </div>
                )}
            </div>

            <Pagination page={page} meta={meta} onChange={setPage} />
        </div>
    );
};

export default WorkerJobOrder;

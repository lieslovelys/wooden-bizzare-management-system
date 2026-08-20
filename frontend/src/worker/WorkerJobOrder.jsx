import React, { useState, useContext } from 'react';
import '../css/worker.css';
import WorkerJobOrderDetail from './WorkerJobOrderDetail';
import Pagination from '../globals/Pagination';
import { UserContext } from '../context/UserContext';
import { formatDateShort, formatProjectId } from '../utils/format';
import { usePaginatedList } from '../hooks/usePaginatedList';

const mapTasks = (data) => data.map(task => ({
    id: formatProjectId(task.project_id),
    name: task.project_name,
    dueDate: task.due_date,
    priority: task.priority || 'Normal',
    status: task.status,
    assignmentId: task.assignment_id
}));

const WorkerJobOrder = () => {
    const { userID } = useContext(UserContext);

    const [activeFilter, setActiveFilter] = useState('Assigned');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [sortDesc, setSortDesc] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);

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

    if (selectedTaskId) {
        const selectedTaskData = displayedTasks.find(t => t.id === selectedTaskId);
        const numericId = selectedTaskId.replace('WB-', '').replace(/^0+/, '');

        return (
            <WorkerJobOrderDetail
                projectId={numericId}
                assignmentId={selectedTaskData.assignmentId}
                workerStatus={selectedTaskData.status}
                onBack={() => {
                    setSelectedTaskId(null); // Itago ang details
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
                <select className="wjo-btn-dark dropdown" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                    <option value="All">Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
                <button className={`wjo-filter-btn assigned ${activeFilter === 'Assigned' ? 'active' : ''}`} onClick={() => setActiveFilter('Assigned')}>Assigned</button>
                <button className={`wjo-filter-btn repair ${activeFilter === 'Repair' ? 'active' : ''}`} onClick={() => setActiveFilter('Repair')}>Repair</button>
            </div>

            <div className="wjo-list">
                {!userID || loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#cc0000' }}>
                        {!userID ? 'Loading worker session...' : 'Loading tasks...'}
                    </div>
                ) : displayedTasks.length > 0 ? (
                    displayedTasks.map((task) => (
                        <div key={task.id} className="wjo-item" onClick={() => setSelectedTaskId(task.id)}>
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
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8b816a' }}>
                        No assigned tasks.
                    </div>
                )}
            </div>

            <Pagination page={page} meta={meta} onChange={setPage} />
        </div>
    );
};

export default WorkerJobOrder;

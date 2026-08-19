import React, { useState, useEffect, useContext } from 'react';
import '../css/worker.css';
import WorkerJobOrderDetail from './WorkerJobOrderDetail';
import { UserContext } from '../context/UserContext';
import { api } from '../api/client';
import { formatDateShort, formatProjectId } from '../utils/format';

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
    const [sortByDue, setSortByDue] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [tasks, setTasks] = useState([]);

    // Manual re-fetch (used after returning from the detail view) — kept as a plain function
    // separate from the mount effect below, which needs its own ignore-guarded fetch rather than
    // calling this one, per the pattern established in InventoryTable.jsx (P1-11).
    const fetchMyTasks = async () => {
        if (!userID) return;
        try {
            const data = await api.get(`/api/workers/${userID}/tasks`);
            setTasks(mapTasks(data));
        } catch (error) {
            console.error("Error fetching worker tasks:", error.message);
        }
    };

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!userID) return;
            try {
                const data = await api.get(`/api/workers/${userID}/tasks`);
                if (!ignore) setTasks(mapTasks(data));
            } catch (error) {
                if (!ignore) console.error("Error fetching worker tasks:", error.message);
            }
        })();
        return () => { ignore = true; };
    }, [userID]);

    let displayedTasks = tasks.filter(task => task.status === activeFilter);
    if (priorityFilter !== 'All') displayedTasks = displayedTasks.filter(task => task.priority === priorityFilter);
    if (sortByDue) displayedTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (selectedTaskId) {
        const selectedTaskData = tasks.find(t => t.id === selectedTaskId);
        const numericId = selectedTaskId.replace('WB-', '').replace(/^0+/, ''); 

        return (
            <WorkerJobOrderDetail 
                projectId={numericId} 
                assignmentId={selectedTaskData.assignmentId} 
                workerStatus={selectedTaskData.status} 
                onBack={() => {
                    setSelectedTaskId(null); // Itago ang details
                    fetchMyTasks(); // <-- TATAWAGIN NATIN ULIT YUNG BACKEND PARA MAG-REFRESH!
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
                <button className="wjo-btn-dark" onClick={() => setSortByDue(!sortByDue)}>Due</button>
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
                {!userID ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#cc0000' }}>
                        Loading worker session...
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
        </div>
    );
};

export default WorkerJobOrder;

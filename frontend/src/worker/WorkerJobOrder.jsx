import React, { useState, useEffect, useContext } from 'react'; // <-- Idagdag ang useContext
import '../css/worker.css';
import WorkerJobOrderDetail from './WorkerJobOrderDetail';

// IMPORTANTE: I-adjust mo ang '../App' base sa kung nasaan ang App.jsx mo mula dito sa file na ito.
import { UserContext } from '../App'; 

const WorkerJobOrder = () => {
    // --- KUNIN ANG USER ID MULA SA CONTEXT ---
    const { userID } = useContext(UserContext); 

    const [activeFilter, setActiveFilter] = useState('Assigned');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [sortByDue, setSortByDue] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [tasks, setTasks] = useState([]);

    // --- BACKEND FETCH LOGIC ---
    useEffect(() => {
        // Huwag mag-fetch kung wala pang userID (e.g., naglo-load pa yung session sa App.jsx)
        if (!userID) return;

        const fetchMyTasks = async () => {
            try {
                // Gagamitin na natin ang tunay na userID mula sa Context!
                const response = await fetch(`http://localhost:8080/api/workers/${userID}/tasks`);
                if (response.ok) {
                    const data = await response.json();
                    
                    const formattedTasks = data.map(task => ({
                        id: `WB-${String(task.project_id).padStart(2, '0')}`,
                        name: task.project_name,
                        dueDate: task.due_date,
                        priority: task.priority || 'Normal',
                        status: task.status,
                        assignmentId: task.assignment_id
                    }));
                    
                    setTasks(formattedTasks);
                }
            } catch (error) {
                console.error("Error fetching worker tasks:", error);
            }
        };

        fetchMyTasks();
    }, [userID]); // <-- Mag-re-run ang fetch kapag nakuha na ng Context ang userID
    // ----------------------------------

    const formatUI_Date = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    let displayedTasks = tasks.filter(task => task.status === activeFilter);
    if (priorityFilter !== 'All') displayedTasks = displayedTasks.filter(task => task.priority === priorityFilter);
    if (sortByDue) displayedTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

if (selectedTaskId) {
        const selectedTaskData = tasks.find(t => t.id === selectedTaskId);
        const numericId = selectedTaskId.replace('WB-', '').replace(/^0+/, ''); 

        return (
            <WorkerJobOrderDetail 
                projectId={numericId} 
                assignmentId={selectedTaskData.assignmentId} // <-- IPASA ITO
                workerStatus={selectedTaskData.status} 
                onBack={() => setSelectedTaskId(null)} 
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
                            <div className="wjo-item-center">{formatUI_Date(task.dueDate)}</div>
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
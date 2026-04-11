import React, { useState, useEffect } from 'react';
import JobOrderDetail from './JobOrderDetail';

const JobOrderList = () => {
    const [jobOrders, setJobOrders] = useState([]);
    
    // State para malaman kung anong view ang ipapakita.
    const [viewingJobId, setViewingJobId] = useState(null); 
    
    // Filter state: default ay nakikita lahat (High, Medium, Low)
    const [activePriorities, setActivePriorities] = useState(['High', 'Medium', 'Low']); 
    
    // Mock data derived from image_3.png for visualization
    useEffect(() => {
        const mockData = [
            { id: 1, project_name: 'dasasaasd', due_date: '2026-04-29', priority_level: 'High' },
            { id: 2, project_name: 'Snow WHite', due_date: '2026-04-29', priority_level: 'Medium' },
            { id: 3, project_name: 'ihsnag', due_date: '2026-04-03', priority_level: 'Low' },
            { id: 4, project_name: 'DOORIS BIG', due_date: '2026-04-28', priority_level: 'High' },
            { id: 5, project_name: 'ZYBWFDDFDFDFSFSDA', due_date: '2026-04-28', priority_level: 'High' },
        ];
        
        // Default sort pagka-load is by nearest due date
        const initialSorted = sortJobsByDate(mockData);
        setJobOrders(initialSorted);
    }, []);

    // Formats date string (e.g., '2026-04-28') to 'APR 28'
    const formatUI_Date = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    };

    // --- SORTING LOGIC ---
    const sortJobsByDate = (jobs) => {
        return [...jobs].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    };

    const handleSortClick = () => {
        const sorted = sortJobsByDate(jobOrders);
        setJobOrders(sorted);
    };

    // --- FILTERING LOGIC ---
    const togglePriority = (priority) => {
        setActivePriorities(prev => {
            if (prev.includes(priority)) return prev.filter(p => p !== priority);
            return [...prev, priority];
        });
    };

    // Ito yung ipapakita sa screen, naka-filter base sa activePriorities state
    const filteredJobs = jobOrders.filter(job => {
        // Handle potential null/empty priorities safely and match display text
        const priority = job.priority_level 
            ? job.priority_level.charAt(0).toUpperCase() + job.priority_level.slice(1).toLowerCase() 
            : 'Low';
        return activePriorities.includes(priority);
    });

    // --- VIEW SWITCHER LOGIC ---
    // Kung may naka-set na viewingJobId, i-render ang Detail Page
    if (viewingJobId) {
        return (
            <JobOrderDetail 
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
                    Sort by Nearest Due Date
                </button>

                <div className="jol-filter-group">
                    <span className="jol-filter-label">Filter Priority:</span>
                    <button 
                        className={`jol-btn ${activePriorities.includes('High') ? 'active high' : ''}`}
                        onClick={() => togglePriority('High')}
                    >
                        HIGH
                    </button>
                    <button 
                        className={`jol-btn ${activePriorities.includes('Medium') ? 'active medium' : ''}`}
                        onClick={() => togglePriority('Medium')}
                    >
                        MEDIUM
                    </button>
                    <button 
                        className={`jol-btn ${activePriorities.includes('Low') ? 'active low' : ''}`}
                        onClick={() => togglePriority('Low')}
                    >
                        LOW
                    </button>
                </div>
            </div>

            <div className="jol-list">
                {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className="jol-item"
                            onClick={() => setViewingJobId(job.id)} // Tina-trigger yung pag-switch ng view
                        >
                            <div className="jol-name">
                                Project {job.id} - {job.project_name}
                            </div>
                            <div className="jol-date">
                                {formatUI_Date(job.due_date)}
                            </div>
                            <div className={`jol-priority ${job.priority_level ? job.priority_level.toLowerCase() : ''}`}>
                                {job.priority_level ? job.priority_level.toUpperCase() : 'N/A'}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8b816a' }}>
                        No projects match the selected priority filters.
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobOrderList;
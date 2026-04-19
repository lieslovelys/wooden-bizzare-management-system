import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; 
import JobOrderDetails from './JobOrderDetails';

const JobOrderList = () => {
    const [jobOrders, setJobOrders] = useState([]);
    
    // Binago natin 'to. Imbes na ID lang para ma-highlight, 
    // ginawa nating state para malaman kung anong view ang ipapakita.
    const [viewingJobId, setViewingJobId] = useState(null); 
    
    const [activePriorities, setActivePriorities] = useState(['High', 'Medium', 'Low']); 
    
    const location = useLocation(); 

    // --- 3. BAGONG USEEFFECT PARA SA NOTIFICATION CLICK ---
    useEffect(() => {
        if (location.state && location.state.targetProjectId) {
            // Kung may ipinadalang ID galing sa Notification, i-set agad para bumukas ang details
            setViewingJobId(location.state.targetProjectId);
            
            // I-clear ang history state para kung i-refresh ni user ang page, hindi siya mag-loop
            window.history.replaceState({}, document.title);
        }
    }, [location]);
    // -----------------------------------------------------

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // FIX: Tinanggal ang localhost at ginawang relative path
                const response = await fetch('/api/job-orders');
                const data = await response.json();
                const initialSorted = sortJobsByDate(data);
                setJobOrders(initialSorted);
            } catch (error) {
                console.error("Failed to fetch job orders:", error);
            }
        };
        fetchJobs();
    }, []);

    const formatUI_Date = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const sortJobsByDate = (jobs) => {
        return [...jobs].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    };

    const handleSortClick = () => {
        const sorted = sortJobsByDate(jobOrders);
        setJobOrders(sorted);
    };

    const togglePriority = (priority) => {
        setActivePriorities(prev => {
            if (prev.includes(priority)) return prev.filter(p => p !== priority);
            return [...prev, priority];
        });
    };

    const filteredJobs = jobOrders.filter(job => {
        const priority = job.priority_level 
            ? job.priority_level.charAt(0).toUpperCase() + job.priority_level.slice(1).toLowerCase() 
            : 'Low';
        return activePriorities.includes(priority);
    });

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
                    Sort by Nearest Due Date
                </button>

                <div className="jol-filter-group">
                    <span className="jol-filter-label">Filter Priority:</span>
                    <button className={`jol-btn ${activePriorities.includes('High') ? 'active high' : ''}`} onClick={() => togglePriority('High')}>HIGH</button>
                    <button className={`jol-btn ${activePriorities.includes('Medium') ? 'active medium' : ''}`} onClick={() => togglePriority('Medium')}>MEDIUM</button>
                    <button className={`jol-btn ${activePriorities.includes('Low') ? 'active low' : ''}`} onClick={() => togglePriority('Low')}>LOW</button>
                </div>
            </div>

            <div className="jol-list">
                {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className="jol-item"
                            onClick={() => setViewingJobId(job.id)} // Dito tina-trigger yung pag-switch ng view
                        >
                            <div className="jol-name">WB-{job.id} {job.project_name}</div>
                            <div className="jol-date">{formatUI_Date(job.due_date)}</div>
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
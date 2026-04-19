import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // <-- 1. IDINAGDAG ITO
import ProjectVerificationDetail from './ProjectVerificationDetail';

const ProjectVerification = () => {
    const [stageFilter, setStageFilter] = useState('All');
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const location = useLocation(); // <-- 2. I-SETUP ANG LOCATION

    useEffect(() => {
        const fetchQATasks = async () => {
            try {
                // FIX: Tinanggal ang localhost at ginawang relative path
                const response = await fetch('/api/qa/tasks');
                if (response.ok) {
                    const data = await response.json();
                    
                    const formattedTasks = data.map(task => ({
                        id: `WB-${String(task.project_id).padStart(2, '0')}`, 
                        rawProjectId: task.project_id, 
                        projectName: task.project_name,
                        workerName: `${task.first_name} ${task.last_name}`,
                        stage: task.stage_name,
                        assignmentId: task.assignment_id 
                    }));
                    
                    setTasks(formattedTasks);
                }
            } catch (error) {
                console.error("Error fetching QA tasks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchQATasks();
    }, []); 

    // --- 3. BAGONG USEEFFECT PARA SA NOTIFICATION ---
    useEffect(() => {
        // Kailangan nating hintayin na ma-load yung 'tasks' (tasks.length > 0)
        // bago natin hanapin yung match ng notification!
        if (location.state && location.state.targetTaskId && tasks.length > 0) {
            
            // Hanapin ang task na may kaparehong assignmentId galing sa Notif
            const matchedTask = tasks.find(
                t => String(t.assignmentId) === String(location.state.targetTaskId)
            );

            if (matchedTask) {
                // Kapag nahanap, i-set yung Project ID niya para bumukas ang Details!
                setSelectedProjectId(matchedTask.rawProjectId);
                
                // I-clear ang location state
                window.history.replaceState({}, document.title);
            }
        }
    }, [location, tasks]); // Babantayan niya ang 'location' at 'tasks'
    // ------------------------------------------------

    const displayedTasks = stageFilter === 'All' 
        ? tasks 
        : tasks.filter(task => task.stage === stageFilter);

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
                            onClick={() => setSelectedProjectId(task.rawProjectId)}
                        >
                            <div>{task.id}</div>
                            <div>{task.projectName}</div>
                            <div>{task.workerName}</div>
                            <div>{task.stage}</div>
                        </div>
                    ))
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8b816a', fontStyle: 'italic' }}>
                        No pending projects for Quality Check.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectVerification;

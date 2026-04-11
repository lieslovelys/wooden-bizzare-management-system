import React, { useState, useEffect } from 'react';

const JobOrderDetail = ({ jobId, onBack }) => {
    const [projectDetails, setProjectDetails] = useState(null);
    const [workers, setWorkers] = useState([]); 
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        stage: 'Carpenter', 
        workerId: '', 
        startDate: '',
        dueDate: ''
    });

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Details
            const detailsRes = await fetch(`http://localhost:8080/api/job-orders/${jobId}`);
            if (detailsRes.ok) setProjectDetails(await detailsRes.json());

            // 2. Fetch Assignments
            const assignRes = await fetch(`http://localhost:8080/api/job-orders/${jobId}/assignments`);
            if (assignRes.ok) setAssignments(await assignRes.json());

            // 3. Fetch Workers 
            if (workers.length === 0) {
                const workersRes = await fetch(`http://localhost:8080/api/workers`);
                if (workersRes.ok) {
                    const workersData = await workersRes.json();
                    setWorkers(workersData);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (jobId) fetchAllData();
    }, [jobId]);

    // --- FILTERING LOGIC ---
    const filteredWorkers = workers.filter(worker => 
        worker.job_role && worker.job_role.toLowerCase() === formData.stage.toLowerCase()
    );

    useEffect(() => {
        if (filteredWorkers.length > 0) {
            setFormData(prev => ({ ...prev, workerId: filteredWorkers[0].user_id }));
        } else {
            setFormData(prev => ({ ...prev, workerId: '' })); 
        }
    }, [formData.stage, workers]); 

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        
        if (!formData.workerId || !formData.startDate || !formData.dueDate) {
            alert("Pakikumpleto ang form at siguraduhing may available na worker para sa stage na ito.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/api/job-orders/${jobId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert("Worker assigned successfully!");
                fetchAllData(); 
                setFormData(prev => ({ ...prev, startDate: '', dueDate: '' })); 
            } else {
                alert("Failed to assign worker.");
            }
        } catch (error) {
            console.error("Submit error:", error);
        }
    };

    // --- BAGONG FUNCTION: MARK AS COMPLETED ---
    const handleCompleteProject = async () => {
        if(window.confirm("Sigurado ka bang tapos na ang project na ito? Malilipat ito sa Project History.")) {
            try {
                // Tinatawag yung backend route na ginawa natin kanina
                const response = await fetch(`http://localhost:8080/api/projects/${jobId}/complete`, { 
                    method: 'PUT' 
                });
                
                if (response.ok) {
                    alert("Project Marked as Completed! 🎉");
                    onBack(); // Ibabalik si PM sa listahan
                } else {
                    alert("Failed to complete project.");
                }
            } catch (error) {
                console.error("Complete project error:", error);
                alert("Server error. Paki-check ang connection.");
            }
        }
    };

    // Formatters
    const formatDateToWords = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };
    const formatId = (id) => `WB-${String(id).padStart(2, '0')}`;
    const getStatusClass = (status) => status ? status.toLowerCase().replace(' ', '-') : '';

    if (loading) return <div className="jod-wrapper"><p style={{ textAlign: 'center' }}>Loading project data...</p></div>;
    if (!projectDetails) return <div className="jod-wrapper"><button onClick={onBack}>Back</button><p>Project not found.</p></div>;

    // --- BAGONG PROGRESS LOGIC ---
    // Naka-depende na ito sa kung ilang assignments ang nagawa ni PM
    const totalAssigned = assignments.length; 
    const completedStages = assignments.filter(a => a.status === 'Approved').length;
    // Iwasan ang pag-divide sa zero kung wala pang na-assign
    const progressPercent = totalAssigned === 0 ? 0 : (completedStages / totalAssigned) * 100;

    return (
        <div className="jod-wrapper">
            <button className="jod-back-btn" onClick={onBack}>← Back to Job Order List</button>

            {/* CONTAINER 1: PROJECT OVERVIEW */}
            <div className="jod-container jod-overview-container">
                <div className="jod-ov-header">
                    <h1 className="jod-ov-id">{formatId(projectDetails.id)}</h1>
                    <p className="jod-ov-name">{projectDetails.project_name}</p>
                </div>

                <div className="jod-ov-info-bar">
                    <div className="jod-ov-info-block">
                        <span className="jod-ov-label">Date Ordered</span>
                        <span className="jod-ov-value">{formatDateToWords(projectDetails.date_ordered)}</span>
                    </div>
                    <div className="jod-ov-info-block jod-ov-due">
                        <span className="jod-ov-label">Due Date</span>
                        <span className="jod-ov-value due-date">{formatDateToWords(projectDetails.due_date)}</span>
                    </div>
                    <div className="jod-ov-info-block jod-ov-priority">
                        <span className="jod-ov-label">Priority</span>
                        <span className={`jod-ov-value priority-${projectDetails.priority_level ? projectDetails.priority_level.toLowerCase() : 'low'}`}>
                            {projectDetails.priority_level || 'Normal'}
                        </span>
                    </div>
                </div>

                <div className="jod-ov-details-box">
                    <div className="jod-ov-details-header">
                        <span className="jod-ov-details-title">PROJECT DETAILS</span>
                    </div>
                    <div className="jod-ov-scroll-area">
                        {projectDetails.variables && projectDetails.variables.length > 0 ? (
                            projectDetails.variables.map(variable => (
                                <div key={variable.id} className="jod-ov-detail-item">
                                    <strong>{variable.variable_name}</strong>
                                    <p>{variable.variable_detail}</p>
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#8b816a' }}>No variables assigned.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTAINER 2: PROJECT PROGRESS */}
            <div className="jod-container jod-progress-container">
                <div className="jod-progress-header">
                    <h3 className="jod-container-title">Project Progress</h3>
                    <div className="jod-progress-bar-wrapper">
                        <div className="jod-progress-bar">
                            <div className="jod-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <span className="jod-progress-text">{completedStages}/{totalAssigned}</span>
                    </div>
                </div>
                
                <table className="jod-table">
                    <thead>
                        <tr>
                            <th>STAGE</th>
                            <th>WORKER</th>
                            <th>START DATE</th>
                            <th>DATE COMPLETED</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assignments.map((assignment) => (
                            <tr key={assignment.assignment_id}>
                                <td>{assignment.stage_name}</td>
                                <td>{assignment.first_name} {assignment.last_name}</td>
                                <td>{new Date(assignment.start_date).toLocaleDateString()}</td>
                                <td>{assignment.date_completed ? new Date(assignment.date_completed).toLocaleDateString() : '-'}</td>
                                <td><span className={`jod-status ${getStatusClass(assignment.status)}`}>{assignment.status}</span></td>
                            </tr>
                        ))}
                        {assignments.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: '#8b816a' }}>No workers assigned yet.</td></tr>
                        )}
                    </tbody>
                </table>

                {/* --- MARK AS COMPLETED BUTTON SECTION --- */}
                <div className="jod-complete-wrapper">
                    <button 
                        onClick={handleCompleteProject} 
                        className="jod-complete-btn" 
                        disabled={totalAssigned === 0}
                    >
                        Mark as Completed
                    </button>
                </div>
            </div>

            {/* CONTAINER 3: ASSIGN WORKER FORM */}
            <div className="jod-container jod-assign-container">
                <div className="jod-assign-header">
                    <h3 className="jod-container-title-white">Assign Worker</h3>
                </div>
                <form className="jod-form" onSubmit={handleAssign}>
                    <div className="jod-form-grid">
                        <div className="jod-form-group">
                            <label>Stage</label>
                            <select name="stage" value={formData.stage} onChange={handleChange}>
                                <option value="Carpenter">Carpenter</option>
                                <option value="Carver">Carver</option>
                                <option value="Liha">Liha</option> 
                                <option value="Painter">Painter</option>
                                <option value="Delivery">Delivery</option> 
                            </select>
                        </div>
                        
                        <div className="jod-form-group">
                            <label>Worker</label>
                            <select name="workerId" value={formData.workerId} onChange={handleChange}>
                                {filteredWorkers.length > 0 ? (
                                    filteredWorkers.map(worker => (
                                        <option key={worker.user_id} value={worker.user_id}>
                                            {worker.first_name} {worker.last_name}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">-- No available workers for this stage --</option>
                                )}
                            </select>
                        </div>

                        <div className="jod-form-group">
                            <label>Start Date</label>
                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required/>
                        </div>
                        <div className="jod-form-group">
                            <label>Due Date</label>
                            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required/>
                        </div>
                    </div>
                    <div className="jod-form-actions">
                        <button type="submit" className="jod-submit-btn" disabled={!formData.workerId}>Assign</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JobOrderDetail;
import React, { useState } from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { formatDate, formatProjectId } from '../utils/format';
import { usePaginatedList } from '../hooks/usePaginatedList';
import Pagination from '../globals/Pagination';
import { clickableProps } from '../utils/a11y';

const ProjectHistory = () => {
  const [remarksFilter, setRemarksFilter] = useState('All');

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // P1-3: server-paginated and server-filtered — `remark` used to be computed client-side from
  // date_completed vs due_date after fetching the whole table (see ARCHITECTURE_REVIEW.md P1-3);
  // the backend now returns it as a real column using the exact same comparison, so there's one
  // definition instead of two that could drift.
  const remark = remarksFilter === 'All' ? undefined : remarksFilter;
  const { rows: displayedHistory, meta, page, setPage, loading } = usePaginatedList('/api/projects/history', {
    params: { remark },
    pageSize: 25,
  });

  const handleRowClick = async (projectId) => {
    setSelectedProjectId(projectId);
    setDetailsLoading(true);
    
    try {
        const [detailsData, tasksData] = await Promise.all([
            // P2: /job-orders/:id now answers {success, data} instead of the bare project
            // object — see ARCHITECTURE_REVIEW.md P2.
            api.get(`/api/job-orders/${projectId}`),
            // P1-3: this endpoint now answers {success, data, meta} instead of a bare array.
            api.get(`/api/job-orders/${projectId}/assignments`)
        ]);

        setProjectDetails(detailsData.data);
        setProjectTasks(tasksData.data || []);
    } catch (error) {
        console.error("Error fetching detailed project info:", error.message);
    } finally {
        setDetailsLoading(false);
    }
  };

  const calculateRemark = (completedStr, dueStr) => {
    if (!completedStr || !dueStr) return 'Unknown';
    
    const completedDate = new Date(completedStr);
    const dueDate = new Date(dueStr);

    if (isNaN(completedDate.getTime()) || isNaN(dueDate.getTime())) {
        return 'Unknown'; 
    }
    
    completedDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    if (completedDate < dueDate) return 'Early';
    if (completedDate > dueDate) return 'Late';
    return 'On-time';
  };

  const getBadgeClass = (remark) => {
    switch (remark) {
      case 'Early': return 'ph-badge ph-badge-early';
      case 'On-time': return 'ph-badge ph-badge-ontime';
      case 'Late': return 'ph-badge ph-badge-late';
      default: return 'ph-badge-pending';
    }
  };

  if (selectedProjectId) {
      return (
          <div className="ph-container">
              <button className="ph-back-btn" onClick={() => setSelectedProjectId(null)}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                 Back to History
              </button>

              {detailsLoading || !projectDetails ? (
                  <p style={{ textAlign: 'center', marginTop: '50px', color: 'var(--color-text-muted)' }}>Loading project details...</p>
              ) : (
                  <div className="ph-detailed-view">
                      
                      {/* TOP CARD: Project Info */}
                      <div className="ph-card-top">
                          <div className="ph-card-id">{formatProjectId(projectDetails.id)}</div>
                          <h1 className="ph-card-name">{projectDetails.project_name}</h1>
                          
                          <div className="ph-gold-stats">
                              <div className="ph-gold-box">
                                  <div className="ph-gb-label">Date Ordered</div>
                                  <div className="ph-gb-value">{formatDate(projectDetails.created_at || projectDetails.date_ordered || new Date())}</div> 
                              </div>
                              <div className="ph-gold-box">
                                  <div className="ph-gb-label">Due Date</div>
                                  <div className="ph-gb-value ph-red-text">{formatDate(projectDetails.due_date)}</div>
                              </div>
                              <div className="ph-gold-box">
                                  <div className="ph-gb-label">Priority</div>
                                  <div className="ph-gb-value">{projectDetails.priority_level}</div>
                              </div>
                          </div>

                          <div className="ph-details-section">
                              <div className="ph-ds-label">PROJECT DETAILS</div>
                              <div className="ph-ds-whitebox">
                                  {projectDetails.variables && projectDetails.variables.length > 0 ? (
                                      projectDetails.variables.map(v => (
                                          <div key={v.id} style={{ marginBottom: '8px' }}>
                                            <strong style={{color: 'var(--color-text)'}}>{v.variable_name}:</strong> {v.variable_detail}
                                          </div>
                                      ))
                                  ) : (
                                      <div style={{opacity: 0.7}}>No specific details provided.</div>
                                  )}
                              </div>
                          </div>
                      </div>

                      {/* BOTTOM CARD: Progress Table */}
                      <div className="ph-card-bottom">
                          <div className="ph-progress-header">
                              <h2>Project Progress</h2>
                              <div className="ph-progress-bar-container">
                                  <div className="ph-progress-track">
                                      <div className="ph-progress-fill" style={{ 
                                          width: `${projectTasks.length > 0 ? (projectTasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length / projectTasks.length) * 100 : 0}%` 
                                      }}></div>
                                  </div>
                                  <span className="ph-progress-text">
                                      {projectTasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length}/{projectTasks.length}
                                  </span>
                              </div>
                          </div>

                          <div className="ph-task-table">
                              {/* Grid Header */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr', padding: '15px', borderBottom: '2px solid var(--color-border)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>
                                  <div>Stage</div>
                                  <div>Worker</div>
                                  <div>Start Date</div>
                                  <div>Date Completed</div>
                                  <div>Remarks</div>
                              </div>
                              
                              {/* Grid Items */}
                              <div>
                                  {projectTasks.length > 0 ? (
                                      projectTasks.map(task => {
                                          
                                          // --- BAGONG LOGIC PARA SA WORKERS (Fallback to Project Date) ---
                                          const isTaskDone = task.status === 'Approved' || task.status === 'Completed';
                                          const actualDateCompleted = task.date_completed || (isTaskDone ? projectDetails.date_completed : null);
                                          const actualDueDate = task.due_date || projectDetails.due_date;

                                          const taskRemark = (isTaskDone && actualDateCompleted)
                                              ? calculateRemark(actualDateCompleted, actualDueDate) 
                                              : task.status;

                                          return (
                                              <div key={task.assignment_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr', padding: '18px 15px', borderBottom: '1px solid var(--color-border)', alignItems: 'center', textAlign: 'center', fontSize: '0.95rem', color: 'var(--color-text)', fontWeight: 500 }}>
                                                  <div><strong style={{color: 'var(--color-text)'}}>{task.stage_name}</strong></div>
                                                  <div>{task.first_name} {task.last_name}</div>
                                                  <div>{formatDate(task.start_date)}</div>
                                                  <div>{formatDate(actualDateCompleted)}</div> {/* Gumamit na rin ng actualDateCompleted dito */}
                                                  <div>
                                                      <span className={actualDateCompleted ? getBadgeClass(taskRemark) : 'ph-badge-pending'}>
                                                          {taskRemark}
                                                      </span>
                                                  </div>
                                              </div>
                                          );
                                      })
                                  ) : (
                                      <div style={{textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)'}}>
                                          No workers assigned yet.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <div className="ph-container">
      <h1 className="ph-title">PROJECT HISTORY</h1>

      <div className="ph-controls">
        <select
          className="ph-filter-select"
          aria-label="Filter by remark"
          value={remarksFilter}
          onChange={(e) => setRemarksFilter(e.target.value)}
        >
          <option value="All">Remarks (All)</option>
          <option value="Early">Early</option>
          <option value="On-time">On-time</option>
          <option value="Late">Late</option>
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading history...</p>
      ) : (
        <div className="ph-grid-wrapper">
            
            {/* GRID HEADER */}
            <div className="ph-header">
                <div className="ph-col">Project ID</div>
                <div className="ph-col">Project Name</div>
                <div className="ph-col">Date Started</div>
                <div className="ph-col">Date Completed</div>
                <div className="ph-col">Remarks</div>
            </div>

            {/* GRID CARDS */}
            <div className="ph-list">
                {displayedHistory.length > 0 ? (
                    displayedHistory.map((proj) => (
                        <div
                            key={proj.id}
                            className="ph-item clickable-row"
                            {...clickableProps(() => handleRowClick(proj.id))}
                            title="Click to view details"
                        >
                            <div className="ph-col" style={{color: 'var(--color-text-muted)', fontWeight: 600}}>{formatProjectId(proj.id)}</div>
                            <div className="ph-col ph-project-name">{proj.project_name}</div>
                            <div className="ph-col">{formatDate(proj.date_started)}</div>
                            <div className="ph-col">{formatDate(proj.date_completed)}</div>
                            <div className="ph-col">
                                <span className={getBadgeClass(proj.remark)}>
                                    {proj.remark}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="ph-empty-state">
                        No history based on filter.
                    </div>
                )}
            </div>

            <Pagination page={page} meta={meta} onChange={setPage} />
        </div>
      )}
    </div>
  );
};

export default ProjectHistory;

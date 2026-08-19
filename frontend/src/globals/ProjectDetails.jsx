import React, { useState, useEffect } from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { formatDate, formatProjectId } from '../utils/format';

const ProjectDetails = ({ projectId, onBack }) => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        const result = await api.get(`/api/projects/${projectId}`);

        if (result.success) {
          setProject(result.data);
        }
      } catch (error) {
        console.error('Error fetching project details:', error.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  if (loading) return <p style={{ textAlign: 'center' }}>Loading details...</p>;
  if (!project) return <p style={{ textAlign: 'center' }}>Project not found.</p>;

  return (
    <div className="details-main-wrapper">
      <div className="details-card-container">
        {/* Header Section */}
        <div className="details-header-section">
          <h1 className="details-title">{formatProjectId(project.id)}</h1>
          <h2 className="details-subtitle">{project.project_name || 'UNTITLED PROJECT'}</h2>
        </div>

        {/* 3 Info Boxes */}
        <div className="details-summary-row">
          <div className="details-box">
            <span className="box-label">Date Ordered</span>
            <span className="box-value">{formatDate(project.date_ordered)}</span>
          </div>
          <div className="details-box">
            <span className="box-label">Due Date</span>
            {/* Kulay pula yung due date sa design mo */}
            <span className="box-value due-date-value">{formatDate(project.due_date)}</span>
          </div>
          <div className="details-box">
            <span className="box-label">Priority</span>
            {/* Kulay orange/gold pag high priority */}
            <span className={`box-value priority-text-${project.priority_level?.toLowerCase()}`}>
              {project.priority_level || 'N/A'}
            </span>
          </div>
        </div>

        {/* Scrollable Project Details Section */}
        <div className="details-variables-section">
          <h3 className="variables-header">PROJECT DETAILS</h3>
          
          <div className="variables-scroll-area">
            {project.variables && project.variables.length > 0 ? (
              project.variables.map((variable, index) => (
                <div key={index} className="variable-card">
                  <h4 className="variable-title">{variable.variable_name || `Variable ${index + 1}`}</h4>
                  <p className="variable-desc">{variable.variable_detail || 'No details provided.'}</p>
                </div>
              ))
            ) : (
              <p style={{ padding: '20px' }}>No variable details found for this project.</p>
            )}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          className="btn-action edit"
          style={{ padding: '8px 24px' }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default ProjectDetails;

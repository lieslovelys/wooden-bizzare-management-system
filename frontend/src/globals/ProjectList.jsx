import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import EditProjectForm from './EditProjectForm';
import '../css/admin.css';
import ProjectDetails from './ProjectDetails';
import { api } from '../api/client';

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  
  const [editingProjectId, setEditingProjectId] = useState(null); 
  const [viewingProjectId, setViewingProjectId] = useState(null);

  const [activeRowId, setActiveRowId] = useState(null);

  const location = useLocation(); 

  useEffect(() => {
    if (location.state && location.state.targetProjectId) {
        setViewingProjectId(location.state.targetProjectId);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const result = await api.get('/api/projects');

      if (result.success) {
        setProjects(result.data);
      } else if (Array.isArray(result)) {
        setProjects(result);
      }
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW DELETE HANDLER FUNCTION ---
  const handleDelete = async (id, name) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete project "WB${id} - ${name}"? This action cannot be undone.`);

    if (!confirmDelete) return;

    try {
      const result = await api.delete(`/api/projects/${id}`);

      if (result.success) {
        alert('Project successfully deleted.');
        fetchProjects(); // Refresh the list without wiping page state
      } else {
        alert(result.message || 'Failed to delete project.');
      }
    } catch (error) {
      console.error('Error deleting project:', error.message);
      alert(error.message || 'An error occurred while connecting to the server.');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((project) => {
    const currentStatus = project.status ? project.status.toLowerCase() : 'pending';
    if (currentStatus === 'completed' || currentStatus === 'done') {
        return false; 
    }

    if (statusFilter !== 'All' && currentStatus !== statusFilter.toLowerCase()) {
        return false;
    }

    const searchLower = searchTerm.toLowerCase();
    return (
      (project.project_name && project.project_name.toLowerCase().includes(searchLower)) ||
      (project.id && project.id.toString().includes(searchLower))
    );
  });

  if (editingProjectId) {
    return (
      <EditProjectForm 
        projectId={editingProjectId} 
        onCancel={() => setEditingProjectId(null)} 
        onSuccess={() => {
          setEditingProjectId(null); 
          fetchProjects(); 
        }} 
      />
    );
  }

  if (viewingProjectId) {
    return (
      <ProjectDetails 
        projectId={viewingProjectId} 
        onBack={() => setViewingProjectId(null)} 
      />
    );
  }

  return (
    <div className="project-list-container">
      
      {/* HEADER CONTROLS */}
      <div className="list-top-controls">
        <div className="search-container" style={{ margin: 0, flex: 1 }}>
          <span className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input 
            type="text" 
            className="search-input"
            placeholder="Search project ID or name...."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select 
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
        >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
        </select>
      </div>

      {loading ? (
        <p style={{textAlign: 'center', marginTop: '20px'}}>Loading projects...</p>
      ) : (
        <div className="pl-grid-wrapper">
          
          {/* GRID HEADER */}
          <div className="pl-header">
            <div className="pl-col">Project ID</div>
            <div className="pl-col">Project Name</div>
            <div className="pl-col">Status</div>
            <div className="pl-col action-col">Action</div>
          </div>

          {/* GRID CARDS (LIST ITEMS) */}
          <div className="pl-list">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((proj) => (
                <div 
                  key={proj.id}
                  className={`pl-item ${activeRowId === proj.id ? 'active' : ''}`}
                  onClick={() => setActiveRowId(proj.id)}
                >
                  <div className="pl-col id-col">WB{proj.id}</div>
                  <div className="pl-col name-col">{proj.project_name}</div>
                  
                  {/* Status Badge */}
                  <div className="pl-col">
                    <span className={`status-badge ${proj.status ? proj.status.toLowerCase().replace(' ', '-') : 'pending'}`}>
                        {proj.status || 'Pending'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="pl-col action-col">
                    <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-action edit" 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setEditingProjectId(proj.id);
                        }}
                      >
                        Edit
                      </button>
                      
                      {/* --- ADDED DELETE BUTTON --- */}
                      <button 
                        className="btn-action delete" 
                        style={{ backgroundColor: '#dc3545', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation(); // Stops the grid row from expanding/activating
                            handleDelete(proj.id, proj.project_name);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: '#8b816a', backgroundColor: '#ffffff', borderRadius: '12px' }}>
                No projects match your search or filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
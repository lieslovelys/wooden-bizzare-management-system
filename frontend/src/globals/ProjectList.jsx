import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // <-- 1. IDINAGDAG ITO
import EditProjectForm from './EditProjectForm'; 
import '../css/admin.css';
import ProjectDetails from './ProjectDetails';

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  
  const [editingProjectId, setEditingProjectId] = useState(null); 
  const [viewingProjectId, setViewingProjectId] = useState(null);

  const [activeRowId, setActiveRowId] = useState(null);

  const location = useLocation(); // <-- 2. I-SETUP ANG LOCATION

  // --- 3. BAGONG USEEFFECT PARA SA NOTIFICATION ---
  useEffect(() => {
    // Kapag may ipinasang state galing sa notification, buksan agad yung Details
    if (location.state && location.state.targetProjectId) {
        setViewingProjectId(location.state.targetProjectId);
        
        // I-clear ang location state para hindi bumalik sa details view kapag nag-refresh
        window.history.replaceState({}, document.title);
    }
  }, [location]);
  // ------------------------------------------------

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/projects');
      const result = await response.json();
      
      if (result.success) {
        setProjects(result.data);
      } else if (Array.isArray(result)) {
        setProjects(result);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((project) => {
    // 1. TANGGALIN KAPAG TAPOS NA
    const currentStatus = project.status ? project.status.toLowerCase() : 'pending';
    if (currentStatus === 'completed' || currentStatus === 'done') {
        return false; 
    }

    // 2. STATUS FILTERING LOGIC
    if (statusFilter !== 'All' && currentStatus !== statusFilter.toLowerCase()) {
        return false;
    }

    // 3. SEARCH LOGIC
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

  // --- KUNG MAY VIEWING ID, IPAPAKITA ANG DETAILS ---
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
      <div className="search-container">
        <span className="search-icon">
          {/* Ito ang SVG code para sa magnifying glass */}
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
        <div className="table-responsive">
          <table className="project-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Status</th>
                <th className="action-col">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((proj) => (
                  <tr 
                    key={proj.id}
                    className={activeRowId === proj.id ? 'active-row' : ''}
                    onClick={() => setActiveRowId(proj.id)}
                  >
                    <td> WB{proj.id}</td>
                    <td>{proj.project_name}</td>
                    
                    <td>
                        <span className={`status-badge ${proj.status ? proj.status.toLowerCase().replace(' ', '-') : 'pending'}`}>
                            {proj.status || 'Pending'}
                        </span>
                    </td>

                    <td className="action-buttons">
                      <button 
                        className="btn-action edit" 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setEditingProjectId(proj.id);
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-action details" 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            setViewingProjectId(proj.id);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
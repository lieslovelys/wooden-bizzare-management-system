import React, { useState, useEffect } from 'react';
import EditProjectForm from './EditProjectForm'; 
import '../css/admin.css';
import ProjectDetails from './ProjectDetails';

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  

  const [editingProjectId, setEditingProjectId] = useState(null); 
  const [viewingProjectId, setViewingProjectId] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data);
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



  // KUNG WALA NAMANG INE-EDIT, ANG TABLE ANG LALABAS
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



      {loading ? (
        <p style={{textAlign: 'center', marginTop: '20px'}}>Loading projects...</p>
      ) : (
        <div className="table-responsive">
          <table className="project-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Client Name</th>
                <th>Contact Number</th>
                <th>Client Payment</th>
                <th>Due Date</th>
                <th>Priority Level</th>
                <th className="action-col">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((proj) => (
                  <tr key={proj.id}>
                    <td>{proj.id}</td>
                    <td>{proj.project_name}</td>
                    <td>{proj.client_name}</td>
                    <td>{proj.contact_number}</td>
                    <td>{proj.client_payment ? `₱${parseFloat(proj.client_payment).toFixed(2)}` : 'N/A'}</td>
                    <td>{proj.due_date ? new Date(proj.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td className={`priority-${proj.priority_level?.toLowerCase()}`}>
                      {proj.priority_level}
                    </td>
                    <td className="action-buttons">
                      {/* DITO NATIN NILAGAY YUNG ONCLICK */}
                      <button className="btn-action edit" onClick={() => setEditingProjectId(proj.id)}>Edit</button>
                      <button className="btn-action details" onClick={() => setViewingProjectId(proj.id)}>Details</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
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
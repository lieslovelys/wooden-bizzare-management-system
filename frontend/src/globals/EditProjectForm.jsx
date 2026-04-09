import React, { useState, useEffect } from 'react';
import '../css/admin.css';

const EditProjectForm = ({ projectId, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    projectName: '', clientName: '', contactNumber: '',
    dateOrdered: '', clientPayment: '', priorityLevel: 'High', dueDate: '',
  });
  
  const [projectDetails, setProjectDetails] = useState([{ name: '', detail: '' }]);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const response = await fetch(`http://localhost:8080/api/projects/${projectId}`);
        const result = await response.json();
        
        if (result.success) {
          const p = result.data;
          
          const formattedDateOrdered = p.date_ordered ? new Date(p.date_ordered).toISOString().split('T')[0] : '';
          const formattedDueDate = p.due_date ? new Date(p.due_date).toISOString().split('T')[0] : '';
          
          setFormData({
            projectName: p.project_name || '',
            clientName: p.client_name || '',
            contactNumber: p.contact_number || '',
            dateOrdered: formattedDateOrdered,
            clientPayment: p.client_payment || '',
            priorityLevel: p.priority_level || 'High',
            dueDate: formattedDueDate
          });

          if (p.variables && p.variables.length > 0) {
            setProjectDetails(p.variables.map(v => ({ name: v.variable_name, detail: v.variable_detail })));
          } else {
            setProjectDetails([{ name: '', detail: '' }]);
          }
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVariableChange = (index, field, value) => {
    const newDetails = [...projectDetails];
    newDetails[index][field] = value;
    setProjectDetails(newDetails);
  };

  const addVariable = () => setProjectDetails([...projectDetails, { name: '', detail: '' }]);
  
  const removeVariable = (index) => {
    setProjectDetails(projectDetails.filter((_, i) => i !== index));
  };

  // I-save ang pagbabago
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, projectDetails };

    try {
      const response = await fetch(`http://localhost:8080/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Project successfully updated!');
        onSuccess(); 
      } else {
        alert('Failed to update project.');
      }
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  if (loading) return <p>Loading project details...</p>;

  return (
    <div className="project-form-container">
      <div className="list-header-banner edit-banner">
        <h2>Edit Project</h2>
      </div>

      <form onSubmit={handleSubmit} className="project-form">
        <div className="form-group full-width">
          <label>Project Name</label>
          <input type="text" name="projectName" value={formData.projectName} onChange={handleInputChange} required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Client Name</label>
            <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date Ordered</label>
            <input type="date" name="dateOrdered" value={formData.dateOrdered} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>Client Payment (₱)</label>
            <input type="number" step="0.01" name="clientPayment" value={formData.clientPayment} onChange={handleInputChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Priority Level</label>
            <select name="priorityLevel" value={formData.priorityLevel} onChange={handleInputChange} className="priority-select">
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleInputChange} />
          </div>
        </div>

        <div className="dynamic-section">
          <label>Project Details</label>
          {projectDetails.map((variable, index) => (
            <div key={index} className="dynamic-row">
              <input type="text" placeholder={`Variable ${index + 1}`} value={variable.name} onChange={(e) => handleVariableChange(index, 'name', e.target.value)} />
              <input type="text" placeholder="Variable Details" value={variable.detail} onChange={(e) => handleVariableChange(index, 'detail', e.target.value)} />
              <button type="button" className="btn-remove" onClick={() => removeVariable(index)} disabled={projectDetails.length === 1}>X</button>
            </div>
          ))}
          <button type="button" className="btn-add-variable" onClick={addVariable}>+Add Variable</button>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-submit">Update Project</button>
        </div>
      </form>
    </div>
  );
};

export default EditProjectForm;
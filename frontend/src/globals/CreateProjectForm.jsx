import React, { useState } from 'react';
import '../css/admin.css';

const CreateProjectForm = () => {
  const [formData, setFormData] = useState({
    projectName: '',
    clientName: '',
    contactNumber: '',
    dateOrdered: '',
    clientPayment: '',
    priorityLevel: 'High',
    dueDate: '',
  });

  const [projectDetails, setProjectDetails] = useState([
    { name: '', detail: '' }
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVariableChange = (index, field, value) => {
    const newDetails = [...projectDetails];
    newDetails[index][field] = value;
    setProjectDetails(newDetails);
  };

  const addVariable = () => {
    setProjectDetails([...projectDetails, { name: '', detail: '' }]);
  };

  const removeVariable = (index) => {
    const newDetails = projectDetails.filter((_, i) => i !== index);
    setProjectDetails(newDetails);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      projectDetails
    };

    try {
      const response = await fetch('http://localhost:8080/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Project successfully created!');
        setFormData({
            projectName: '', clientName: '', contactNumber: '',
            dateOrdered: '', clientPayment: '', priorityLevel: 'High', dueDate: ''
        });
        setProjectDetails([{ name: '', detail: '' }]);
      } else {
        alert('Failed to create project.');
      }
    } catch (error) {
      console.error('Submission error:', error);
    }
  };

  return (
    <div className="project-form-container">
      {/* Tabs */}


      <form onSubmit={handleSubmit} className="project-form">
        {/* Full Width Row */}
        <div className="form-group full-width">
          <label>Project Name</label>
          <input 
            type="text" 
            name="projectName"
            value={formData.projectName}
            onChange={handleInputChange}
            required 
          />
        </div>

        {/* 2-Column Grid */}
        <div className="form-row">
          <div className="form-group">
            <label>Client Name</label>
            <input 
              type="text" 
              name="clientName"
              value={formData.clientName}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input 
              type="text" 
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date Ordered</label>
            <input 
              type="date" 
              name="dateOrdered"
              value={formData.dateOrdered}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label>Client Payment (₱)</label>
            <input 
              type="number" 
              step="0.01"
              name="clientPayment"
              placeholder="0.0"
              value={formData.clientPayment}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Priority Level</label>
            <select 
              name="priorityLevel" 
              value={formData.priorityLevel}
              onChange={handleInputChange}
              className="priority-select"
            >
              <option value="High" className="priority-high">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input 
              type="date" 
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Dynamic Project Details section */}
        <div className="dynamic-section">
          <label>Project Details</label>
          {projectDetails.map((variable, index) => (
            <div key={index} className="dynamic-row">
              <input 
                type="text" 
                placeholder={`Variable ${index + 1}`}
                value={variable.name}
                onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
              />
              <input 
                type="text" 
                placeholder="Variable Details"
                value={variable.detail}
                onChange={(e) => handleVariableChange(index, 'detail', e.target.value)}
              />
              <button 
                type="button" 
                className="btn-remove" 
                onClick={() => removeVariable(index)}
                disabled={projectDetails.length === 1}
              >
                X
              </button>
            </div>
          ))}
          <button type="button" className="btn-add-variable" onClick={addVariable}>
            +Add Variable
          </button>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="button" className="btn-cancel">Cancel</button>
          <button type="submit" className="btn-submit">Create Project</button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectForm;
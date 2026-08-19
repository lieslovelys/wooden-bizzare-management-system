import React, { useState } from 'react';
import '../css/admin.css';
import { api } from '../api/client';

const CreateProjectForm = () => {
  const [formData, setFormData] = useState({
    projectName: '', clientName: '', contactNumber: '',
    dateOrdered: '', clientPayment: '', priorityLevel: 'High', dueDate: '',
  });

  const [projectDetails, setProjectDetails] = useState([{ name: '', detail: '' }]);
  
  // --- BAGONG STATE PARA SA POP-UP (TOAST) ---
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });

  // Function para magpalabas ng popup na nawawala after 3 seconds
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'clientName') {
      const noNumbers = value.replace(/[0-9]/g, ''); 
      setFormData(prev => ({ ...prev, [name]: noNumbers }));
      return;
    }
    if (name === 'contactNumber') {
      const onlyNumbers = value.replace(/[^0-9]/g, ''); 
      if (onlyNumbers.length <= 11) {
        setFormData(prev => ({ ...prev, [name]: onlyNumbers }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVariableChange = (index, field, value) => {
    const newDetails = [...projectDetails];
    newDetails[index][field] = value;
    setProjectDetails(newDetails);
  };

  const addVariable = () => setProjectDetails([...projectDetails, { name: '', detail: '' }]);
  const removeVariable = (index) => setProjectDetails(projectDetails.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.dueDate && formData.dateOrdered && formData.dueDate < formData.dateOrdered) {
        showToast('Due date cannot be earlier than Date Ordered.', 'error');
        return;
    }

    const payload = { ...formData, projectDetails };

    try {
      await api.post('/api/projects', payload);
      showToast('Project successfully created!', 'success');
      setFormData({
          projectName: '', clientName: '', contactNumber: '',
          dateOrdered: '', clientPayment: '', priorityLevel: 'High', dueDate: ''
      });
      setProjectDetails([{ name: '', detail: '' }]);
    } catch (error) {
      console.error('Submission error:', error.message);
      showToast(error.message || 'Server error.', 'error');
    }
  };

  return (
    <div className="project-form-container">
      {/* RENDER TOAST KUNG VISIBLE */}
      {toast.visible && (
        <div className="wb-toast-container">
            <div className={`wb-toast ${toast.type}`}>
                {toast.type === 'success' ? '' : ''} {toast.message}
            </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="project-form">
        <h2 className="form-title">CREATE PROJECT</h2>
        
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
            <input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} maxLength="11" placeholder="e.g. 09123456789" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date Ordered</label>
            <input type="date" name="dateOrdered" value={formData.dateOrdered} onChange={handleInputChange} min={today} />
          </div>
          <div className="form-group">
            <label>Client Payment (₱)</label>
            <input type="number" step="0.01" name="clientPayment" placeholder="0.0" value={formData.clientPayment} onChange={handleInputChange} />
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
            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleInputChange} min={formData.dateOrdered || today} />
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
          <button type="submit" className="btn-submit">Create Project</button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectForm;

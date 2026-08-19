import React, { useEffect, useRef, useState } from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const EditProjectForm = ({ projectId, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    projectName: '', clientName: '', contactNumber: '',
    dateOrdered: '', clientPayment: '', priorityLevel: 'High', dueDate: '',
  });

  const [projectDetails, setProjectDetails] = useState([{ name: '', detail: '' }]);

  const showToast = useToast();

  // Post-submit onSuccess() is delayed so the success toast is visible; cancelled on unmount so
  // it can't fire after this form is already gone.
  const successTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchProjectData = async () => {
      try {
        const result = await api.get(`/api/projects/${projectId}`);
        if (ignore) return;

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
        if (!ignore) console.error('Error fetching project:', error.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchProjectData();
    return () => { ignore = true; };
  }, [projectId]);

  // --- ERROR HANDLER PARA SA TEXT INPUTS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // ERROR HANDLER: Client Name (Bawal ang numbers)
    if (name === 'clientName') {
      const noNumbers = value.replace(/[0-9]/g, ''); 
      setFormData(prev => ({ ...prev, [name]: noNumbers }));
      return;
    }

    // ERROR HANDLER: Contact Number (Puro numbers lang at max 11 digits)
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
  
  const removeVariable = (index) => {
    setProjectDetails(projectDetails.filter((_, i) => i !== index));
  };

  // I-save ang pagbabago
  const handleSubmit = async (e) => {
    e.preventDefault();

    // DOUBLE CHECK: Bawal mauna ang Due Date sa Date Ordered
    if (formData.dueDate && formData.dateOrdered && formData.dueDate < formData.dateOrdered) {
        showToast('Due date cannot be earlier than Date Ordered.', 'error');
        return;
    }

    const payload = { ...formData, projectDetails };

    try {
      await api.put(`/api/projects/${projectId}`, payload);
      showToast('Project successfully updated!', 'success');
      // Maghihintay ng 1.5 seconds bago bumalik para mabasa ang message
      successTimerRef.current = setTimeout(() => {
          onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Update error:', error.message);
      showToast(error.message || 'Server error. Please try again.', 'error');
    }
  };

  if (loading) return <p>Loading project details...</p>;

  return (
    <div className="project-form-container">
      <div className="list-header-banner edit-banner">
        <h2>EDIT PROJECT</h2>
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
            <input 
                type="text" 
                name="contactNumber" 
                value={formData.contactNumber} 
                onChange={handleInputChange} 
                maxLength="11" 
            />
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
            <input 
                type="date" 
                name="dueDate" 
                value={formData.dueDate} 
                onChange={handleInputChange} 
                min={formData.dateOrdered} /* HTML restriction base sa Date Ordered */
            />
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

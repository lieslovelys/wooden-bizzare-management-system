import React from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useProjectForm, EMPTY_PROJECT_FORM } from '../hooks/useProjectForm';
import ProjectFormFields from './ProjectFormFields';

const CreateProjectForm = () => {
  const {
    formData, setFormData,
    projectDetails, setProjectDetails,
    handleInputChange, handleVariableChange, addVariable, removeVariable, validateDates,
  } = useProjectForm();

  const showToast = useToast();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dateError = validateDates();
    if (dateError) {
      showToast(dateError, 'error');
      return;
    }

    const payload = { ...formData, projectDetails };

    try {
      await api.post('/api/projects', payload);
      showToast('Project successfully created!', 'success');
      setFormData(EMPTY_PROJECT_FORM);
      setProjectDetails([{ name: '', detail: '' }]);
    } catch (error) {
      console.error('Submission error:', error.message);
      showToast(error.message || 'Server error.', 'error');
    }
  };

  return (
    <div className="project-form-container">
      <form onSubmit={handleSubmit} className="project-form">
        <h2 className="form-title">CREATE PROJECT</h2>

        <ProjectFormFields
          formData={formData}
          onInputChange={handleInputChange}
          projectDetails={projectDetails}
          onVariableChange={handleVariableChange}
          onAddVariable={addVariable}
          onRemoveVariable={removeVariable}
          minDate={today}
        />

        <div className="form-actions">
          <button type="submit" className="btn-submit">Create Project</button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectForm;

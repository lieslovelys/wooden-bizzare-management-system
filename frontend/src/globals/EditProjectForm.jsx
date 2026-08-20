import React, { useEffect, useRef, useState } from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useProjectForm } from '../hooks/useProjectForm';
import ProjectFormFields from './ProjectFormFields';
import { toDateInputValue } from '../utils/format';

const EditProjectForm = ({ projectId, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(true);

  const {
    formData, setFormData,
    projectDetails, setProjectDetails,
    handleInputChange, handleVariableChange, addVariable, removeVariable, validateDates,
  } = useProjectForm();

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

          // PRD B.6: was `new Date(...).toISOString().split('T')[0]`, which parses to local
          // midnight then renders in UTC — a day earlier in UTC+8. toDateInputValue builds the
          // string from local calendar parts instead, so an untouched date survives a save.
          const formattedDateOrdered = toDateInputValue(p.date_ordered);
          const formattedDueDate = toDateInputValue(p.due_date);

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
  }, [projectId, setFormData, setProjectDetails]);

  // I-save ang pagbabago
  const handleSubmit = async (e) => {
    e.preventDefault();

    // DOUBLE CHECK: Bawal mauna ang Due Date sa Date Ordered
    const dateError = validateDates();
    if (dateError) {
      showToast(dateError, 'error');
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
        <ProjectFormFields
          formData={formData}
          onInputChange={handleInputChange}
          projectDetails={projectDetails}
          onVariableChange={handleVariableChange}
          onAddVariable={addVariable}
          onRemoveVariable={removeVariable}
        />

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-submit">Update Project</button>
        </div>
      </form>
    </div>
  );
};

export default EditProjectForm;

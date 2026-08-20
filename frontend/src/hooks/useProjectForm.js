import { useState } from 'react';
import { withoutDigits, digitsOnly } from '../utils/formValidators';

export const EMPTY_PROJECT_FORM = {
  projectName: '', clientName: '', contactNumber: '',
  dateOrdered: '', clientPayment: '', priorityLevel: 'High', dueDate: '',
};

// Shared form state + handlers behind CreateProjectForm/EditProjectForm. The two forms differ
// only in how they load initial data, how they submit, and the `minDate` they pass to
// ProjectFormFields — the field set, the dynamic "Project Details" rows, and the
// due-date-before-date-ordered rule are otherwise identical. See ARCHITECTURE_REVIEW.md P2,
// "Near-identical components maintained as separate copies."
export function useProjectForm(initialFormData = EMPTY_PROJECT_FORM, initialProjectDetails = [{ name: '', detail: '' }]) {
  const [formData, setFormData] = useState(initialFormData);
  const [projectDetails, setProjectDetails] = useState(initialProjectDetails);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'clientName') {
      setFormData(prev => ({ ...prev, [name]: withoutDigits(value) }));
      return;
    }

    if (name === 'contactNumber') {
      const digits = digitsOnly(value);
      if (digits !== undefined) {
        setFormData(prev => ({ ...prev, [name]: digits }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVariableChange = (index, field, value) => {
    setProjectDetails(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addVariable = () => setProjectDetails(prev => [...prev, { name: '', detail: '' }]);
  const removeVariable = (index) => setProjectDetails(prev => prev.filter((_, i) => i !== index));

  // Returns an error message if the dates are invalid, or null if they're fine — the
  // due-date-before-date-ordered rejection shared by both forms' handleSubmit.
  const validateDates = () => {
    if (formData.dueDate && formData.dateOrdered && formData.dueDate < formData.dateOrdered) {
      return 'Due date cannot be earlier than Date Ordered.';
    }
    return null;
  };

  return {
    formData,
    setFormData,
    projectDetails,
    setProjectDetails,
    handleInputChange,
    handleVariableChange,
    addVariable,
    removeVariable,
    validateDates,
  };
}

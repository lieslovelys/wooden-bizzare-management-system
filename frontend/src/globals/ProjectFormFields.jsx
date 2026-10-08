import React, { useId } from 'react';

// The seven top-level fields plus the dynamic Project Details rows, identical between
// CreateProjectForm and EditProjectForm. See ARCHITECTURE_REVIEW.md P2, "Near-identical
// components maintained as separate copies."
//
// `minDate` is the one real behavioral difference between the two callers: CreateProjectForm
// passes today's date (a new project can't be dated in the past); EditProjectForm passes
// undefined, since an existing project's already-past date needs to stay editable.
const ProjectFormFields = ({
  formData,
  onInputChange,
  projectDetails,
  onVariableChange,
  onAddVariable,
  onRemoveVariable,
  minDate,
}) => {
  const id = useId();

  return (
    <>
      <div className="form-group full-width">
        <label htmlFor={`${id}-projectName`}>Project Name</label>
        <input id={`${id}-projectName`} type="text" name="projectName" value={formData.projectName} onChange={onInputChange} required />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`${id}-clientName`}>Client Name</label>
          <input id={`${id}-clientName`} type="text" name="clientName" value={formData.clientName} onChange={onInputChange} />
        </div>
        <div className="form-group">
          <label htmlFor={`${id}-contactNumber`}>Contact Number</label>
          <input id={`${id}-contactNumber`} type="text" name="contactNumber" value={formData.contactNumber} onChange={onInputChange} maxLength="11" placeholder="e.g. 09123456789" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`${id}-dateOrdered`}>Date Ordered</label>
          <input id={`${id}-dateOrdered`} type="date" name="dateOrdered" value={formData.dateOrdered} onChange={onInputChange} min={minDate} />
        </div>
        <div className="form-group">
          <label htmlFor={`${id}-clientPayment`}>Client Payment (₱)</label>
          <input id={`${id}-clientPayment`} type="number" step="0.01" name="clientPayment" placeholder="0.0" value={formData.clientPayment} onChange={onInputChange} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`${id}-priorityLevel`}>Priority Level</label>
          <select id={`${id}-priorityLevel`} name="priorityLevel" value={formData.priorityLevel} onChange={onInputChange} className="priority-select">
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor={`${id}-dueDate`}>Due Date</label>
          <input id={`${id}-dueDate`} type="date" name="dueDate" value={formData.dueDate} onChange={onInputChange} min={formData.dateOrdered || minDate} />
        </div>
      </div>

      <div className="dynamic-section">
        <label id={`${id}-details-label`}>Project Details</label>
        {projectDetails.map((variable, index) => (
          <div key={index} className="dynamic-row" role="group" aria-labelledby={`${id}-details-label`}>
            <input type="text" aria-label={`Variable ${index + 1} name`} placeholder={`Variable ${index + 1}`} value={variable.name} onChange={(e) => onVariableChange(index, 'name', e.target.value)} />
            <input type="text" aria-label={`Variable ${index + 1} details`} placeholder="Variable Details" value={variable.detail} onChange={(e) => onVariableChange(index, 'detail', e.target.value)} />
            <button type="button" className="btn-remove" aria-label={`Remove variable ${index + 1}`} onClick={() => onRemoveVariable(index)} disabled={projectDetails.length === 1}>X</button>
          </div>
        ))}
        <button type="button" className="btn-add-variable" onClick={onAddVariable}>+Add Variable</button>
      </div>
    </>
  );
};

export default ProjectFormFields;

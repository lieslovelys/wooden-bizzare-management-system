import React from 'react';

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
}) => (
  <>
    <div className="form-group full-width">
      <label>Project Name</label>
      <input type="text" name="projectName" value={formData.projectName} onChange={onInputChange} required />
    </div>

    <div className="form-row">
      <div className="form-group">
        <label>Client Name</label>
        <input type="text" name="clientName" value={formData.clientName} onChange={onInputChange} />
      </div>
      <div className="form-group">
        <label>Contact Number</label>
        <input type="text" name="contactNumber" value={formData.contactNumber} onChange={onInputChange} maxLength="11" placeholder="e.g. 09123456789" />
      </div>
    </div>

    <div className="form-row">
      <div className="form-group">
        <label>Date Ordered</label>
        <input type="date" name="dateOrdered" value={formData.dateOrdered} onChange={onInputChange} min={minDate} />
      </div>
      <div className="form-group">
        <label>Client Payment (₱)</label>
        <input type="number" step="0.01" name="clientPayment" placeholder="0.0" value={formData.clientPayment} onChange={onInputChange} />
      </div>
    </div>

    <div className="form-row">
      <div className="form-group">
        <label>Priority Level</label>
        <select name="priorityLevel" value={formData.priorityLevel} onChange={onInputChange} className="priority-select">
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <div className="form-group">
        <label>Due Date</label>
        <input type="date" name="dueDate" value={formData.dueDate} onChange={onInputChange} min={formData.dateOrdered || minDate} />
      </div>
    </div>

    <div className="dynamic-section">
      <label>Project Details</label>
      {projectDetails.map((variable, index) => (
        <div key={index} className="dynamic-row">
          <input type="text" placeholder={`Variable ${index + 1}`} value={variable.name} onChange={(e) => onVariableChange(index, 'name', e.target.value)} />
          <input type="text" placeholder="Variable Details" value={variable.detail} onChange={(e) => onVariableChange(index, 'detail', e.target.value)} />
          <button type="button" className="btn-remove" onClick={() => onRemoveVariable(index)} disabled={projectDetails.length === 1}>X</button>
        </div>
      ))}
      <button type="button" className="btn-add-variable" onClick={onAddVariable}>+Add Variable</button>
    </div>
  </>
);

export default ProjectFormFields;

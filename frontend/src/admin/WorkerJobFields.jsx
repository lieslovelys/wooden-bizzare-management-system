import React, { useId } from 'react';

// The Role/Worker Type/Contact Number/Daily Rate fields, verbatim between AddWorkerModal and
// EditWorkerModal — including the two hardcoded option lists, which existed twice and could
// silently diverge. See ARCHITECTURE_REVIEW.md P2, "Near-identical components maintained as
// separate copies."
//
// Exported individually rather than as one fixed block: AddWorkerModal renders Role before
// Worker Type and EditWorkerModal renders the reverse, and AddWorkerModal marks Contact
// Number `required` with a placeholder while EditWorkerModal doesn't — preserving each modal's
// exact original layout and attributes without a mode flag.

export const RoleSelect = ({ value, onChange }) => {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id}>Role / Specialization</label>
      <select id={id} name="role" value={value} onChange={onChange}>
        <option value="Carpenter">Carpenter</option>
        <option value="Carver">Carver</option>
        <option value="Liha">Liha</option>
        <option value="Delivery">Delivery</option>
        <option value="Painter">Painter</option>
      </select>
    </div>
  );
};

export const WorkerTypeSelect = ({ value, onChange }) => {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id}>Worker Type</label>
      <select id={id} name="workerType" value={value} onChange={onChange}>
        <option value="Regular">Regular</option>
        <option value="Part-Time">Part-Time</option>
      </select>
    </div>
  );
};

export const ContactNumberField = ({ value, onChange, required, placeholder }) => {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id}>Contact Number</label>
      <input
        id={id}
        type="text"
        name="contactNumber"
        value={value}
        onChange={onChange}
        required={required}
        maxLength="11"
        placeholder={placeholder}
      />
    </div>
  );
};

export const DailyRateField = ({ value, onChange, required }) => {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id}>Daily Rate (₱)</label>
      <input id={id} type="number" name="dailyRate" value={value} onChange={onChange} placeholder="0.00" step="0.01" required={required} />
    </div>
  );
};

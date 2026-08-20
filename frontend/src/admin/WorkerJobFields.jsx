import React from 'react';

// The Role/Worker Type/Contact Number/Daily Rate fields, verbatim between AddWorkerModal and
// EditWorkerModal — including the two hardcoded option lists, which existed twice and could
// silently diverge. See ARCHITECTURE_REVIEW.md P2, "Near-identical components maintained as
// separate copies."
//
// Exported individually rather than as one fixed block: AddWorkerModal renders Role before
// Worker Type and EditWorkerModal renders the reverse, and AddWorkerModal marks Contact
// Number `required` with a placeholder while EditWorkerModal doesn't — preserving each modal's
// exact original layout and attributes without a mode flag.

export const RoleSelect = ({ value, onChange }) => (
  <div className="form-group">
    <label>Role / Specialization</label>
    <select name="role" value={value} onChange={onChange}>
      <option value="Carpenter">Carpenter</option>
      <option value="Carver">Carver</option>
      <option value="Liha">Liha</option>
      <option value="Delivery">Delivery</option>
      <option value="Painter">Painter</option>
    </select>
  </div>
);

export const WorkerTypeSelect = ({ value, onChange }) => (
  <div className="form-group">
    <label>Worker Type</label>
    <select name="workerType" value={value} onChange={onChange}>
      <option value="Regular">Regular</option>
      <option value="Part-Time">Part-Time</option>
    </select>
  </div>
);

export const ContactNumberField = ({ value, onChange, required, placeholder }) => (
  <div className="form-group">
    <label>Contact Number</label>
    <input
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

export const DailyRateField = ({ value, onChange, required }) => (
  <div className="form-group">
    <label>Daily Rate (₱)</label>
    <input type="number" name="dailyRate" value={value} onChange={onChange} placeholder="0.00" step="0.01" required={required} />
  </div>
);

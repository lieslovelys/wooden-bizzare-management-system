import React, { useState, useEffect } from 'react';
import '../css/admin.css';

const EditWorkerModal = ({ isOpen, onClose, workerData, onUpdate }) => {
  const [formData, setFormData] = useState({
    workerType: 'Regular',
    role: 'Carpenter', 
    contactNumber: '',
    dailyRate: ''
  });

  useEffect(() => {
    if (workerData && isOpen) {
      setFormData({
        workerType: workerData.job_type || 'Regular',
        role: workerData.job_role || 'Carpenter', // Default natin sa Carpenter
        contactNumber: workerData.contact || '',
        dailyRate: workerData.rate || ''
      });
    }
  }, [workerData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="add-worker-modal">
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
            <span style={{ color: '#000000' }}>Edit Worker: </span>
            <span style={{ color: '#5C4033' }}>{workerData?.full_name}</span>
          </h3>
          <p style={{fontSize: '0.8rem', color: '#666', margin: '5px 0 0 0'}}>
            Username: <strong>{workerData?.username}</strong>
          </p>
        </div>
        <form className="modal-form-body" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Worker Type</label>
              <select value={formData.workerType} onChange={(e) => setFormData({...formData, workerType: e.target.value})}>
                <option value="Regular">Regular</option>
                <option value="Part-Time">Part-Time</option>
              </select>
            </div>
            
            {/* --- PINALITAN NATIN TO NG DROPDOWN --- */}
            <div className="form-group">
              <label>Role / Specialization</label>
              <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                <option value="Carpenter">Carpenter</option>
                <option value="Carver">Carver</option>
                <option value="Liha">Liha</option>
                <option value="Delivery">Delivery</option>
                <option value="Painter">Painter</option>
              </select>
            </div>

            <div className="form-group">
              <label>Contact Number</label>
              <input type="text" value={formData.contactNumber} onChange={(e) => setFormData({...formData, contactNumber: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Daily Rate (₱)</label>
              <input type="number" value={formData.dailyRate} onChange={(e) => setFormData({...formData, dailyRate: e.target.value})} placeholder="0.00" step="0.01" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-add">Update Details</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWorkerModal;
import React, { useState, useEffect } from 'react';
import '../css/admin.css';

const EditWorkerModal = ({ isOpen, onClose, workerData, onUpdate }) => {
  const [formData, setFormData] = useState({
    workerType: 'Regular',
    role: 'Carpenter', 
    contactNumber: '',
    dailyRate: ''
  });
  
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // --- BAGONG STATE PARA SA POP-UP (TOAST) ---
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
  };

  useEffect(() => {
    if (workerData && isOpen) {
      setFormData({
        workerType: workerData.job_type || 'Regular',
        role: workerData.job_role || 'Carpenter', 
        contactNumber: workerData.contact || '',
        dailyRate: workerData.rate || ''
      });
      setPreviewUrl(workerData.photo || null);
    }
  }, [workerData, isOpen]);

  if (!isOpen) return null;

  // --- ERROR HANDLER PARA SA TEXT INPUTS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // ERROR HANDLER BAGO MAG-SAVE: Dapat saktong 11 digits ang contact number
    if (formData.contactNumber && formData.contactNumber.length < 11) {
        showToast('Contact number must be exactly 11 digits.', 'error');
        return;
    }

    onUpdate({ ...formData, photo: previewUrl });
  };

  // CHECKER KUNG PWEDENG PINDUTIN ANG UPDATE BUTTON
  // Kung blank ang contactNumber O blank ang dailyRate, magiging true ang isSaveDisabled (hindi mapipindot)
  const isSaveDisabled = !formData.contactNumber || !formData.dailyRate;

  return (
    <div className="modal-overlay" style={{ fontFamily: 'Arial, sans-serif' }}>
        
      {/* RENDER TOAST KUNG VISIBLE */}
      {toast.visible && (
        <div className="wb-toast-container">
            <div className={`wb-toast ${toast.type}`}>
                {toast.type === 'success' ? '✅' : '⚠️'} {toast.message}
            </div>
        </div>
      )}

      <div className="add-worker-modal" style={{ maxWidth: '500px' }}>
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
            
            {/* --- Profile Picture Upload --- */}
            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
              <div className="profile-picture-upload">
                {previewUrl ? (
                  <img src={previewUrl} alt="Profile Preview" className="profile-preview" />
                ) : (
                  <div className="profile-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                )}
                <label htmlFor="edit-profile-upload" className="upload-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Change Photo
                </label>
                <input 
                  type="file" 
                  id="edit-profile-upload" 
                  accept="image/*" 
                  onChange={handleImageChange} 
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Worker Type</label>
              <select name="workerType" value={formData.workerType} onChange={handleInputChange}>
                <option value="Regular">Regular</option>
                <option value="Part-Time">Part-Time</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Role / Specialization</label>
              <select name="role" value={formData.role} onChange={handleInputChange}>
                <option value="Carpenter">Carpenter</option>
                <option value="Carver">Carver</option>
                <option value="Liha">Liha</option>
                <option value="Delivery">Delivery</option>
                <option value="Painter">Painter</option>
              </select>
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
            <div className="form-group">
              <label>Daily Rate (₱)</label>
              <input 
                type="number" 
                name="dailyRate" 
                value={formData.dailyRate} 
                onChange={handleInputChange} 
                placeholder="0.00" 
                step="0.01" 
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button 
                type="submit" 
                className="btn-add"
                disabled={isSaveDisabled}
                style={{ opacity: isSaveDisabled ? 0.5 : 1, cursor: isSaveDisabled ? 'not-allowed' : 'pointer' }}
            >
                Update Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWorkerModal;
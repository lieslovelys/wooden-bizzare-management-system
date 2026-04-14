import React, { useState } from 'react';
import '../css/admin.css';

const AddWorkerModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: 'None',
    username: '',
    password: '',
    workerType: 'Regular',
    role: 'Carpenter', 
    contactNumber: '',
    dailyRate: ''
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, photo: previewUrl });
    setFormData({
      firstName: '', middleName: '', lastName: '', suffix: 'None', username: '', password: '',
      workerType: 'Regular', role: 'Carpenter', contactNumber: '', dailyRate: ''
    });
    setProfilePicture(null);
    setPreviewUrl(null);
  };

  return (
    // Nilagyan natin ng font-family Arial dito para sakop lahat
    <div className="modal-overlay" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="add-worker-modal" style={{ maxWidth: '700px' }}> {/* Pinaliit ng konti yung width */}
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>Add Worker Account & Details</h3>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          <div className="form-grid">
            
            {/* --- Profile Picture --- */}
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
                <label htmlFor="profile-upload" className="upload-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Upload Photo
                </label>
                <input 
                  type="file" 
                  id="profile-upload" 
                  accept="image/*" 
                  onChange={handleImageChange} 
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* --- Account Credentials --- */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <strong style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Account Credentials</strong>
            </div>
            
            <div className="form-group">
              <label>First Name</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Middle Name</label>
              <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} placeholder="Leave blank if none" />
            </div>

            <div className="form-group">
              <label>Last Name</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
            
            {/* --- BAGONG SUFFIX DROPDOWN --- */}
            <div className="form-group">
              <label>Suffix</label>
              <select name="suffix" value={formData.suffix} onChange={handleChange}>
                <option value="None">None</option>
                <option value="Sr.">Sr.</option>
                <option value="Jr.">Jr.</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="V">V</option>
              </select>
            </div>

            <div className="form-group">
              <label>Username</label>
              <input type="text" name="username" value={formData.username} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>

            {/* --- Job Information --- */}
            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '10px' }}>
              <strong style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Job Information</strong>
            </div>

            <div className="form-group">
              <label>Role / Specialization</label>
              <select name="role" value={formData.role} onChange={handleChange}>
                <option value="Carpenter">Carpenter</option>
                <option value="Carver">Carver</option>
                <option value="Liha">Liha</option>
                <option value="Delivery">Delivery</option>
                <option value="Painter">Painter</option>
              </select>
            </div>

            <div className="form-group">
              <label>Worker Type</label>
              <select name="workerType" value={formData.workerType} onChange={handleChange}>
                <option value="Regular">Regular</option>
                <option value="Part-Time">Part-Time</option>
              </select>
            </div>

            <div className="form-group">
              <label>Contact Number</label>
              <input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Daily Rate (₱)</label>
              <input type="number" name="dailyRate" value={formData.dailyRate} onChange={handleChange} placeholder="0.00" step="0.01" required />
            </div>

          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-add">Add Worker</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWorkerModal;
import React, { useState } from 'react';
import '../css/admin.css';
import { useToast } from '../context/ToastContext';
import { digitsOnly, isIncompleteContactNumber, CONTACT_NUMBER_ERROR } from '../utils/formValidators';
import PhotoUpload from '../globals/PhotoUpload';
import { RoleSelect, WorkerTypeSelect, ContactNumberField, DailyRateField } from './WorkerJobFields';

// `formData`/`previewUrl` initialize directly from `workerData` props instead of syncing via a
// setState-in-effect (the P2 lint fix — see ARCHITECTURE_REVIEW.md). Re-deriving on every open
// (including reopening the same worker after an edit-then-cancel) relies on the parent
// (WorkerList.jsx) keying this component so it remounts each time it opens — see the `key` prop
// at the call site.
const EditWorkerModal = ({ isOpen, onClose, workerData, onUpdate }) => {
  const [formData, setFormData] = useState({
    workerType: workerData?.job_type || 'Regular',
    role: workerData?.job_role || 'Carpenter',
    contactNumber: workerData?.contact || '',
    dailyRate: workerData?.rate || ''
  });

  const [previewUrl, setPreviewUrl] = useState(workerData?.photo || null);

  const showToast = useToast();

  if (!isOpen) return null;

  // --- ERROR HANDLER PARA SA TEXT INPUTS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // ERROR HANDLER: Contact Number (Puro numbers lang at max 11 digits)
    if (name === 'contactNumber') {
      const digits = digitsOnly(value);
      if (digits !== undefined) {
        setFormData(prev => ({ ...prev, [name]: digits }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // ERROR HANDLER BAGO MAG-SAVE: Dapat saktong 11 digits ang contact number
    if (isIncompleteContactNumber(formData.contactNumber)) {
        showToast(CONTACT_NUMBER_ERROR, 'error');
        return;
    }

    onUpdate({ ...formData, photo: previewUrl });
  };

  // CHECKER KUNG PWEDENG PINDUTIN ANG UPDATE BUTTON
  // Kung blank ang contactNumber O blank ang dailyRate, magiging true ang isSaveDisabled (hindi mapipindot)
  const isSaveDisabled = !formData.contactNumber || !formData.dailyRate;

  return (
    <div className="modal-overlay" style={{ fontFamily: 'Arial, sans-serif' }}>
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

            <PhotoUpload previewUrl={previewUrl} onChange={setPreviewUrl} inputId="edit-profile-upload" label="Change Photo" />

            <WorkerTypeSelect value={formData.workerType} onChange={handleInputChange} />
            <RoleSelect value={formData.role} onChange={handleInputChange} />
            <ContactNumberField value={formData.contactNumber} onChange={handleInputChange} />
            <DailyRateField value={formData.dailyRate} onChange={handleInputChange} />
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

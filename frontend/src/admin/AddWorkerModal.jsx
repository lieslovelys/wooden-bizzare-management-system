import React, { useEffect, useId, useRef, useState } from 'react';
import '../css/admin.css';
import { useToast } from '../context/ToastContext';
import { withoutDigits, digitsOnly, isIncompleteContactNumber, CONTACT_NUMBER_ERROR } from '../utils/formValidators';
import PhotoUpload from '../globals/PhotoUpload';
import { RoleSelect, WorkerTypeSelect, ContactNumberField, DailyRateField } from './WorkerJobFields';
import { useDialog } from '../hooks/useDialog';

const EMPTY_FORM = {
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
};

const AddWorkerModal = ({ isOpen, onClose, onSave }) => {
  const id = useId();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [previewUrl, setPreviewUrl] = useState(null);

  const showToast = useToast();
  const dialogRef = useDialog({ open: isOpen, onClose });

  // Post-submit close is delayed so the success toast is visible; the delay is cancelled on
  // unmount so it can't call onClose() after this modal is already gone.
  const closeTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    // ERROR HANDLER: Bawal ang numbers sa Pangalan
    if (['firstName', 'middleName', 'lastName'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: withoutDigits(value) }));
      return;
    }

    // ERROR HANDLER: Puro numbers lang at hanggang 11 digits sa Contact Number
    if (name === 'contactNumber') {
      const digits = digitsOnly(value);
      if (digits !== undefined) {
        setFormData(prev => ({ ...prev, [name]: digits }));
      }
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Optional: I-check kung eksaktong 11 numbers ang nilagay (para hindi kulang)
    if (isIncompleteContactNumber(formData.contactNumber)) {
        showToast(CONTACT_NUMBER_ERROR, 'error');
        return;
    }

    try {
        // Ipinapasa ang data pabalik sa parent component (WorkerList)
        await onSave({ ...formData, photo: previewUrl });

        // Magpapakita ng Success Message
        showToast('Worker successfully added! 🎉', 'success');

        // I-clear ang form
        setFormData(EMPTY_FORM);
        setPreviewUrl(null);

        // Bibigyan natin ng 1.5 seconds delay bago isara ang modal para mabasa nila yung success message
        closeTimerRef.current = setTimeout(() => {
            onClose();
        }, 1500);

    } catch (error) {
        // Surfaces the server's actual reason (e.g. a duplicate username) instead of a generic
        // message, and — since this catch is now the only place a failed add is handled (see
        // WorkerList.jsx's handleSaveNewWorker) — leaves the form exactly as typed rather than
        // clearing it, so the admin doesn't have to redo the whole thing over one bad field.
        console.error(error);
        showToast(error.message || 'Failed to add worker.', 'error');
    }
  };

  return (
    <div className="modal-overlay">
      <div ref={dialogRef} className="add-worker-modal" style={{ maxWidth: '700px' }} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="modal-header">
          <h3 id={`${id}-title`} style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>Add Worker Account & Details</h3>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body">
          <div className="form-grid">

            <PhotoUpload previewUrl={previewUrl} onChange={setPreviewUrl} inputId="profile-upload" label="Upload Photo" />

            {/* --- Account Credentials --- */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <strong style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Account Credentials</strong>
            </div>

            <div className="form-group">
              <label htmlFor={`${id}-firstName`}>First Name</label>
              <input id={`${id}-firstName`} type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-middleName`}>Middle Name</label>
              <input id={`${id}-middleName`} type="text" name="middleName" value={formData.middleName} onChange={handleChange} placeholder="Leave blank if none" />
            </div>

            <div className="form-group">
              <label htmlFor={`${id}-lastName`}>Last Name</label>
              <input id={`${id}-lastName`} type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label htmlFor={`${id}-suffix`}>Suffix</label>
              <select id={`${id}-suffix`} name="suffix" value={formData.suffix} onChange={handleChange}>
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
              <label htmlFor={`${id}-username`}>Username</label>
              <input id={`${id}-username`} type="text" name="username" value={formData.username} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor={`${id}-password`}>Password</label>
              <input id={`${id}-password`} type="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>

            {/* --- Job Information --- */}
            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '10px' }}>
              <strong style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Job Information</strong>
            </div>

            <RoleSelect value={formData.role} onChange={handleChange} />
            <WorkerTypeSelect value={formData.workerType} onChange={handleChange} />
            <ContactNumberField value={formData.contactNumber} onChange={handleChange} required placeholder="09..." />
            <DailyRateField value={formData.dailyRate} onChange={handleChange} required />

          </div>

<div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>

            {/* Dinagdagan natin ng disabled condition */}
            <button
                type="submit"
                className="btn-add"
                disabled={!previewUrl}
                style={{ opacity: !previewUrl ? 0.5 : 1, cursor: !previewUrl ? 'not-allowed' : 'pointer' }}
            >
                Add Worker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWorkerModal;

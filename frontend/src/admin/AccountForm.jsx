import React, { useId, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { withoutDigits, digitsOnly, isIncompleteContactNumber, CONTACT_NUMBER_ERROR } from '../utils/formValidators';
import PhotoUpload from '../globals/PhotoUpload';
import { RoleSelect, WorkerTypeSelect, ContactNumberField, DailyRateField } from './WorkerJobFields';

// Item 40: replaces TempSignup.jsx. That screen posted straight to the old POST /api/signup with
// whatever userRole the caller picked, including 'Worker' — which created a login with no
// worker_details row (no rate, no job role; PRD.md C.2's now-closed gap). This form creates every
// account type, and picks the right endpoint for each:
//   - 'Worker' posts to POST /api/workers (the same body shape as AddWorkerModal.jsx), which
//     writes the users + worker_details rows in one transaction.
//   - every other role posts to POST /api/users (schemas/userSchemas.js's accountBody, which now
//     rejects 'Worker' server-side too).

const ACCOUNT_ROLES = ['Admin', 'Production Manager', 'Inventory Staff', 'Quality Checker', 'Worker'];

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: 'None',
  username: '',
  password: '',
  confirmPassword: '',
  userRole: '',
  workerType: 'Regular',
  role: 'Carpenter',
  contactNumber: '',
  dailyRate: '',
};

const AccountForm = () => {
  const id = useId();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = useToast();

  const isWorker = formData.userRole === 'Worker';

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Same name/contact-number guards as AddWorkerModal.jsx.
    if (['firstName', 'middleName', 'lastName'].includes(name)) {
      setFormData((prev) => ({ ...prev, [name]: withoutDigits(value) }));
      return;
    }

    if (name === 'contactNumber') {
      const digits = digitsOnly(value);
      if (digits !== undefined) {
        setFormData((prev) => ({ ...prev, [name]: digits }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (isWorker && isIncompleteContactNumber(formData.contactNumber)) {
      showToast(CONTACT_NUMBER_ERROR, 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (isWorker) {
        await api.post('/api/workers', {
          username: formData.username,
          password: formData.password,
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          suffix: formData.suffix,
          workerType: formData.workerType,
          role: formData.role,
          contactNumber: formData.contactNumber,
          dailyRate: formData.dailyRate,
          photo: previewUrl,
        });
      } else {
        await api.post('/api/users', {
          username: formData.username,
          password: formData.password,
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          suffix: formData.suffix,
          userRole: formData.userRole,
        });
      }

      showToast('Account successfully created!', 'success');
      resetForm();
    } catch (error) {
      console.error('Error creating account:', error.message);
      showToast(error.message || 'Failed to create account. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || (isWorker && !previewUrl);

  return (
    <form onSubmit={handleSubmit} className="account-form">
      <div className="account-form-grid">
        <div className="account-form-section-title">
          <strong>Account Credentials</strong>
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
          <label htmlFor={`${id}-userRole`}>Account Role</label>
          <select id={`${id}-userRole`} name="userRole" value={formData.userRole} onChange={handleChange} required>
            <option value="" disabled>Select a role</option>
            {ACCOUNT_ROLES.map((roleOption) => (
              <option key={roleOption} value={roleOption}>{roleOption}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor={`${id}-password`}>Password</label>
          <input id={`${id}-password`} type="password" name="password" value={formData.password} onChange={handleChange} minLength={8} required />
        </div>

        <div className="form-group">
          <label htmlFor={`${id}-confirmPassword`}>Confirm Password</label>
          <input id={`${id}-confirmPassword`} type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} minLength={8} required />
        </div>

        {isWorker && (
          <>
            <div className="account-form-section-title">
              <strong>Job Information</strong>
            </div>

            <PhotoUpload previewUrl={previewUrl} onChange={setPreviewUrl} inputId={`${id}-photo`} label="Upload Photo" />

            <RoleSelect value={formData.role} onChange={handleChange} />
            <WorkerTypeSelect value={formData.workerType} onChange={handleChange} />
            <ContactNumberField value={formData.contactNumber} onChange={handleChange} required placeholder="09..." />
            <DailyRateField value={formData.dailyRate} onChange={handleChange} required />
          </>
        )}
      </div>

      <div className="account-form-actions">
        <button type="submit" className="account-form-submit" disabled={submitDisabled}>
          {submitting ? 'Creating…' : 'Create Account'}
        </button>
      </div>
    </form>
  );
};

export default AccountForm;

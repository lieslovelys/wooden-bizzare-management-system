import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountForm from './AccountForm';
import { ToastContext } from '../context/ToastContext';

// Item 40 — replaces TempSignup.test.jsx. AccountForm is the only screen that can create every
// account type: a non-Worker role posts to POST /api/users (schemas/userSchemas.js's accountBody
// now rejects 'Worker' there), and 'Worker' posts to POST /api/workers instead, the same body
// shape AddWorkerModal.jsx sends, so a Worker always gets a matching worker_details row.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../utils/resizeImage', () => ({
  resizeImageToDataUrl: vi.fn(),
}));

const { api } = await import('../api/client');
const { resizeImageToDataUrl } = await import('../utils/resizeImage');

function renderForm(showToast = vi.fn()) {
  return {
    showToast,
    ...render(
      <ToastContext.Provider value={showToast}>
        <AccountForm />
      </ToastContext.Provider>
    ),
  };
}

function fillCredentials({ password = 'a-real-password', confirmPassword = password } = {}) {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Juana' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Dela Cruz' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'juana.delacruz' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirmPassword } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountForm', () => {
  it('every field can be found by its label', () => {
    renderForm();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Middle Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Suffix')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Account Role')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('does not show the Job Information fields until Worker is selected', () => {
    renderForm();
    expect(screen.queryByLabelText('Role / Specialization')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'Worker' } });

    expect(screen.getByLabelText('Role / Specialization')).toBeInTheDocument();
    expect(screen.getByLabelText('Worker Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Daily Rate (₱)')).toBeInTheDocument();
  });

  it('posts a non-Worker account to POST /api/users and resets on success', async () => {
    api.post.mockResolvedValue({ success: true, data: [{ user_id: 9 }] });
    const { showToast } = renderForm();
    fillCredentials();
    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'Production Manager' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/users', {
      username: 'juana.delacruz',
      password: 'a-real-password',
      firstName: 'Juana',
      middleName: '',
      lastName: 'Dela Cruz',
      suffix: 'None',
      userRole: 'Production Manager',
    }));
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/successfully created/i), 'success');
    await waitFor(() => expect(screen.getByLabelText('Username')).toHaveValue(''));
  });

  it('posts a Worker account to POST /api/workers with the job-info fields and the photo', async () => {
    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,NEWPHOTO');
    api.post.mockResolvedValue({ success: true });
    renderForm();
    fillCredentials();
    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'Worker' } });
    fireEvent.change(screen.getByLabelText('Contact Number'), { target: { value: '09171234567' } });
    fireEvent.change(screen.getByLabelText('Daily Rate (₱)'), { target: { value: '650' } });

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Upload Photo'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByAltText('Profile Preview')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workers', expect.objectContaining({
      username: 'juana.delacruz',
      workerType: 'Regular',
      role: 'Carpenter',
      contactNumber: '09171234567',
      dailyRate: '650',
      photo: expect.stringMatching(/^data:/),
    })));
  });

  it('disables submit for a Worker account until a photo is chosen', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'Worker' } });
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  it('blocks submission and shows an error toast on a password mismatch', async () => {
    const { showToast } = renderForm();
    fillCredentials({ password: 'a-real-password', confirmPassword: 'different-password' });
    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'Admin' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(api.post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/do not match/i), 'error');
  });

  it('keeps the typed values and shows the server error on failure', async () => {
    api.post.mockRejectedValue(new Error('Username already exists.'));
    const { showToast } = renderForm();
    fillCredentials();
    fireEvent.change(screen.getByLabelText('Account Role'), { target: { value: 'Admin' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Username already exists.', 'error'));
    expect(screen.getByLabelText('Username')).toHaveValue('juana.delacruz');
  });
});

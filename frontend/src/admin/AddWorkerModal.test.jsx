import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddWorkerModal from './AddWorkerModal';
import { ToastContext } from '../context/ToastContext';

// Previously untested (ARCHITECTURE_REVIEW.md item 19/23). Mirrors EditWorkerModal.test.jsx's
// setup (../utils/resizeImage mocked) plus a ToastContext wrapper to assert on showToast calls —
// no existing test did that before this file. Fields are queried by label text (item 30 linked
// every <label> here via htmlFor) — that's also the test proving the association works.
vi.mock('../utils/resizeImage', () => ({
  resizeImageToDataUrl: vi.fn(),
}));
const { resizeImageToDataUrl } = await import('../utils/resizeImage');

function renderModal(props, showToast = vi.fn()) {
  return {
    showToast,
    ...render(
      <ToastContext.Provider value={showToast}>
        <AddWorkerModal isOpen={true} onClose={vi.fn()} onSave={vi.fn()} {...props} />
      </ToastContext.Provider>
    ),
  };
}

async function fillRequiredFields() {
  resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,NEWPHOTO');
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Dela Cruz' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'juan.delacruz' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
  fireEvent.change(screen.getByLabelText('Contact Number'), { target: { value: '09171234567' } });
  fireEvent.change(screen.getByLabelText('Daily Rate (₱)'), { target: { value: '650' } });

  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  const fileInput = document.getElementById('profile-upload');
  fireEvent.change(fileInput, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByAltText('Profile Preview')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddWorkerModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ToastContext.Provider value={vi.fn()}>
        <AddWorkerModal isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />
      </ToastContext.Provider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Add Worker until a photo is chosen', async () => {
    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,NEWPHOTO');
    renderModal({});
    expect(screen.getByRole('button', { name: /add worker/i })).toBeDisabled();

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.getElementById('profile-upload'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /add worker/i })).not.toBeDisabled());
  });

  it('strips digits typed into the name fields', () => {
    renderModal({});
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Juan123' } });
    expect(screen.getByLabelText('First Name')).toHaveValue('Juan');
  });

  it('blocks submission on an incomplete contact number', async () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    await fillRequiredFields();

    fireEvent.change(screen.getByLabelText('Contact Number'), { target: { value: '0917' } });
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the form data and photo, and shows only the success toast', async () => {
    const onSave = vi.fn().mockResolvedValue();
    const { showToast } = renderModal({ onSave });
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      username: 'juan.delacruz',
      contactNumber: '09171234567',
      dailyRate: '650',
      photo: expect.stringMatching(/^data:/),
    })));
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/successfully added/i), 'success');
  });

  // Regression test for the bug fixed alongside this file: onSave rejecting (a duplicate
  // username, a validation 400) used to still show a success toast on top of the error toast and
  // clear the form — see WorkerList.jsx's handleSaveNewWorker and ARCHITECTURE_REVIEW.md item 23.
  it('on a rejected onSave, shows only the error toast and keeps the typed values', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Username already taken'));
    const { showToast } = renderModal({ onSave });
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Username already taken', 'error');
    expect(screen.getByLabelText('First Name')).toHaveValue('Juan');
    expect(screen.getByLabelText('Username')).toHaveValue('juan.delacruz');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

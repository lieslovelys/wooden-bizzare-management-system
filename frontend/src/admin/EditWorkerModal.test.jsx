import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditWorkerModal from './EditWorkerModal';

// Previously untested (item 19's own note: "the remaining admin list/modal screens ...
// AddWorkerModal.jsx, EditWorkerModal.jsx" — see ARCHITECTURE_REVIEW.md). Written alongside the
// PRD.md C.2 photo-storage pass, so its main focus is the photo contract: an unchanged photo
// must send NO `photo` key at all (JSON.stringify drops `undefined`), not the previous preview
// URL — see EditWorkerModal.jsx's own comment on why.
vi.mock('../api/client', () => ({
  apiUrl: (path) => 'https://api.test' + path,
}));
vi.mock('../utils/resizeImage', () => ({
  resizeImageToDataUrl: vi.fn(),
}));
const { resizeImageToDataUrl } = await import('../utils/resizeImage');

const WORKER = {
  user_id: 7,
  full_name: 'Juan Dela Cruz',
  username: 'juan.delacruz',
  job_type: 'Regular',
  job_role: 'Carpenter',
  contact: '09171234567',
  rate: 650,
  photo_path: 'w7.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditWorkerModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <EditWorkerModal isOpen={false} onClose={vi.fn()} workerData={WORKER} onUpdate={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the worker's existing photo via workerPhotoUrl, not an inlined data URL", () => {
    render(<EditWorkerModal isOpen={true} onClose={vi.fn()} workerData={WORKER} onUpdate={vi.fn()} />);
    expect(screen.getByAltText('Profile Preview')).toHaveAttribute(
      'src', 'https://api.test/api/workers/7/photo?v=w7.jpg'
    );
  });

  it('shows the placeholder when the worker has no photo on file', () => {
    render(<EditWorkerModal isOpen={true} onClose={vi.fn()} workerData={{ ...WORKER, photo_path: null }} onUpdate={vi.fn()} />);
    expect(screen.queryByAltText('Profile Preview')).not.toBeInTheDocument();
  });

  it('submits with photo: undefined when untouched — dropped entirely once JSON.stringify-d', async () => {
    const handleUpdate = vi.fn();
    render(<EditWorkerModal isOpen={true} onClose={vi.fn()} workerData={WORKER} onUpdate={handleUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: /update details/i }));

    await waitFor(() => expect(handleUpdate).toHaveBeenCalled());
    const payload = handleUpdate.mock.calls[0][0];
    // The in-memory object still carries the key (an object-spread always does), but that's not
    // what reaches the server — api/client.js's request() sends JSON.stringify(body), which
    // omits an `undefined`-valued key outright. That's the actual contract with the backend's
    // "absent = keep the current photo" rule (userService.updateWorker).
    expect(payload.photo).toBeUndefined();
    expect('photo' in JSON.parse(JSON.stringify(payload))).toBe(false);
    expect(payload).toMatchObject({
      workerType: 'Regular', role: 'Carpenter', contactNumber: '09171234567', dailyRate: 650,
    });
  });

  it('submits the new data URL when the photo is changed', async () => {
    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,NEWPHOTO');
    const handleUpdate = vi.fn();
    render(<EditWorkerModal isOpen={true} onClose={vi.fn()} workerData={WORKER} onUpdate={handleUpdate} />);

    const file = new File(['x'], 'new.jpg', { type: 'image/jpeg' });
    const fileInput = document.getElementById('edit-profile-upload');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByAltText('Profile Preview')).toHaveAttribute(
      'src', 'data:image/jpeg;base64,NEWPHOTO'
    ));

    fireEvent.click(screen.getByRole('button', { name: /update details/i }));

    await waitFor(() => expect(handleUpdate).toHaveBeenCalled());
    expect(handleUpdate.mock.calls[0][0].photo).toBe('data:image/jpeg;base64,NEWPHOTO');
  });

  it('blocks submission on an incomplete contact number', async () => {
    const handleUpdate = vi.fn();
    render(<EditWorkerModal isOpen={true} onClose={vi.fn()} workerData={{ ...WORKER, contact: '0917' }} onUpdate={handleUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: /update details/i }));

    expect(handleUpdate).not.toHaveBeenCalled();
  });

  it('disables Update Details when contact number or daily rate is blank', () => {
    render(<EditWorkerModal isOpen={true} onClose={vi.fn()} workerData={{ ...WORKER, contact: '', rate: '' }} onUpdate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /update details/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const handleClose = vi.fn();
    render(<EditWorkerModal isOpen={true} onClose={handleClose} workerData={WORKER} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalled();
  });
});

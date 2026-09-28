import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkerList from './WorkerList';
import { expectCardLabels } from '../tests/expectCardLabels';

// Previously untested (DESIGN.md §7#10 backlog pass) — this table had no coverage of any kind,
// so the mobile card conversion had nothing pinning its data-label wiring. Extended for
// ARCHITECTURE_REVIEW.md item 23 with search/filter/add/edit interaction coverage — see
// AddWorkerModal.test.jsx for the add-worker false-success regression test this pass also fixed.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../utils/resizeImage', () => ({
  resizeImageToDataUrl: vi.fn(),
}));

const { api } = await import('../api/client');
const { resizeImageToDataUrl } = await import('../utils/resizeImage');

const WORKERS = [
  { user_id: 10, formatted_id: 'WK-0010', full_name: 'Juan Dela Cruz', job_type: 'Regular', job_role: 'Carpenter', contact: '09171234567', rate: 650 },
  { user_id: 11, formatted_id: 'WK-0011', full_name: 'Maria Santos', job_type: 'Part-Time', job_role: 'Painter', contact: '09179876543', rate: 500 },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ success: true, data: WORKERS });
});

describe('WorkerList', () => {
  it('renders workers fetched from the API', async () => {
    const { container } = render(<WorkerList />);

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/workers');
    // DESIGN.md §7#10 — mobile card conversion (css/globals.css's .wb-card-table). The desktop
    // height-filler rows (see WorkerList.jsx) are hidden at mobile width, not labeled.
    expectCardLabels(container, '.worker-table', { skipSelector: '.worker-table-filler' });
  });

  it('filters by search term, matching either the name or the formatted id', async () => {
    render(<WorkerList />);
    await screen.findByText('Juan Dela Cruz');

    fireEvent.change(screen.getByPlaceholderText("Search worker's name"), { target: { value: 'maria' } });

    expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search worker's name"), { target: { value: 'WK-0010' } });
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  it('filters by role and by type', async () => {
    render(<WorkerList />);
    await screen.findByText('Juan Dela Cruz');

    const [roleFilter, typeFilter] = screen.getAllByRole('combobox');

    fireEvent.change(roleFilter, { target: { value: 'Painter' } });
    expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();

    fireEvent.change(roleFilter, { target: { value: 'Role' } });
    fireEvent.change(typeFilter, { target: { value: 'Regular' } });
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
  });

  it('shows the empty state when a filter matches nobody', async () => {
    render(<WorkerList />);
    await screen.findByText('Juan Dela Cruz');

    fireEvent.change(screen.getByPlaceholderText("Search worker's name"), { target: { value: 'nobody' } });

    expect(screen.getByText('No workers found.')).toBeInTheDocument();
  });

  it('adds a worker: POSTs to /api/workers, closes the modal, and refetches', async () => {
    api.post.mockResolvedValue({ success: true });
    render(<WorkerList />);
    await screen.findByText('Juan Dela Cruz');

    fireEvent.click(screen.getByText('+ Add Worker'));
    expect(screen.getByText('Add Worker Account & Details')).toBeInTheDocument();

    resizeImageToDataUrl.mockResolvedValue('data:image/jpeg;base64,NEWPHOTO');
    const modal = screen.getByText('Add Worker Account & Details').closest('.add-worker-modal');
    fireEvent.change(modal.querySelector('[name="firstName"]'), { target: { value: 'Pedro' } });
    fireEvent.change(modal.querySelector('[name="lastName"]'), { target: { value: 'Reyes' } });
    fireEvent.change(modal.querySelector('[name="username"]'), { target: { value: 'pedro.reyes' } });
    fireEvent.change(modal.querySelector('[name="password"]'), { target: { value: 'hunter2' } });
    fireEvent.change(modal.querySelector('[name="contactNumber"]'), { target: { value: '09170001111' } });
    fireEvent.change(modal.querySelector('[name="dailyRate"]'), { target: { value: '600' } });

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.getElementById('profile-upload'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByAltText('Profile Preview')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^add worker$/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workers', expect.objectContaining({
      firstName: 'Pedro', lastName: 'Reyes', username: 'pedro.reyes',
    })));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('edits a worker: PUTs to /api/workers/:id, closes the modal, and refetches', async () => {
    api.put.mockResolvedValue({ success: true });
    render(<WorkerList />);
    await screen.findByText('Juan Dela Cruz');

    // The single edit-icon button per row, in the "Action" column — see WorkerList.jsx's markup.
    const rows = screen.getAllByRole('row').slice(1, 1 + WORKERS.length);
    fireEvent.click(rows[0].querySelector('button'));

    expect(screen.getByRole('button', { name: /update details/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /update details/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/workers/10', expect.any(Object)));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
});

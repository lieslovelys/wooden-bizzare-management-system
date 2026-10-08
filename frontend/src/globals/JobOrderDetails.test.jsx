import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JobOrderDetails from './JobOrderDetails';
import { expectCardLabels } from '../tests/expectCardLabels';

// Previously untested (ARCHITECTURE_REVIEW.md item 12/19) — the assign-worker form and the
// FR-8 "every assigned stage must be Approved" complete gate had no coverage at all.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
// Has its own test file (ProjectMaterials.test.jsx) and its own /api/inventory* calls — stubbed
// out here so this file only has to mock the job-order/project/worker endpoints.
vi.mock('./ProjectMaterials', () => ({ default: () => null }));

const { api } = await import('../api/client');

const PROJECT = {
    id: 7,
    project_name: 'Cabinet Set',
    date_ordered: '2026-09-01',
    due_date: '2026-10-01',
    priority_level: 'Normal',
    variables: [],
};

const WORKERS = [
    { user_id: 10, first_name: 'Juan', last_name: 'Dela Cruz', job_role: 'Carpenter' },
    { user_id: 11, first_name: 'Maria', last_name: 'Santos', job_role: 'Carver' },
];

// The real startDate/dueDate inputs carry a `min` (today, per JobOrderDetails.jsx), which jsdom
// enforces as a real constraint on submit — a literal past-dated string would silently block the
// submit once that date passed (ARCHITECTURE_REVIEW.md item 32). Build dates relative to "now"
// instead, so this test keeps working no matter when it runs.
function isoDateFromToday(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function mockGets({ assignments = [], workers = WORKERS } = {}) {
    api.get.mockImplementation((url) => {
        if (url === '/api/job-orders/7') return Promise.resolve({ success: true, data: PROJECT });
        if (url === '/api/job-orders/7/assignments') return Promise.resolve({ success: true, data: assignments });
        if (url === '/api/assignable-workers') return Promise.resolve({ success: true, data: workers });
        return Promise.resolve({ success: true, data: [] });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('JobOrderDetails — assign worker', () => {
    it('auto-selects the first worker matching the default stage and posts the assign body', async () => {
        mockGets();
        api.post.mockResolvedValue({ success: true, data: {} });

        const { container } = render(<JobOrderDetails jobId={7} onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');
        // fetchAllData's three GETs resolve as separate awaits — wait for the last of them
        // (the worker auto-select effect enabling Assign) rather than just the first re-render.
        await waitFor(() => expect(screen.getByText('Assign')).not.toBeDisabled());

        const startDate = isoDateFromToday(3);
        const dueDate = isoDateFromToday(8);
        const [startInput, dueInput] = container.querySelectorAll('input[type="date"]');
        fireEvent.change(startInput, { target: { value: startDate } });
        fireEvent.change(dueInput, { target: { value: dueDate } });

        fireEvent.click(screen.getByText('Assign'));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/job-orders/7/assign', {
            stage: 'Carpenter',
            workerId: 10, // auto-selected: the only worker whose job_role matches the default stage
            startDate,
            dueDate,
        }));
    });
});

describe('JobOrderDetails — mark as completed', () => {
    it('disables Complete when no worker is assigned yet', async () => {
        mockGets({ assignments: [] });
        render(<JobOrderDetails jobId={7} onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');
        expect(screen.getByText('Mark as Completed')).toBeDisabled();
    });

    it('disables Complete while any assigned stage is not yet Approved', async () => {
        mockGets({
            assignments: [
                { assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', status: 'Approved' },
                { assignment_id: 2, stage_name: 'Carver', first_name: 'Maria', last_name: 'Santos', start_date: '2026-09-05', status: 'For QA' },
            ],
        });
        const { container } = render(<JobOrderDetails jobId={7} onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');
        expect(screen.getByText('Mark as Completed')).toBeDisabled();
        // DESIGN.md §7#10 — the mobile card conversion (css/globals.css's .wb-card-table) reads
        // a label off each <td>'s data-label attribute; this catches a cell missing one.
        expectCardLabels(container, '.jod-table');
    });

    it('completes the project once every assigned stage is Approved', async () => {
        mockGets({
            assignments: [
                { assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', status: 'Approved' },
            ],
        });
        api.put.mockResolvedValue({ success: true, data: {} });
        const onBack = vi.fn();

        render(<JobOrderDetails jobId={7} onBack={onBack} />);
        await screen.findByText('Cabinet Set');

        const completeBtn = screen.getByText('Mark as Completed');
        expect(completeBtn).not.toBeDisabled();
        fireEvent.click(completeBtn);

        fireEvent.click(screen.getByText('Yes, Complete It'));

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/projects/7/complete'));
        await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1), { timeout: 3000 });
    });

    it('does not navigate back when completing fails', async () => {
        mockGets({
            assignments: [
                { assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', status: 'Approved' },
            ],
        });
        api.put.mockRejectedValue(new Error('Not all assigned stages are Approved yet.'));
        const onBack = vi.fn();

        render(<JobOrderDetails jobId={7} onBack={onBack} />);
        await screen.findByText('Cabinet Set');

        fireEvent.click(screen.getByText('Mark as Completed'));
        fireEvent.click(screen.getByText('Yes, Complete It'));

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/projects/7/complete'));
        expect(onBack).not.toHaveBeenCalled();
    });
});

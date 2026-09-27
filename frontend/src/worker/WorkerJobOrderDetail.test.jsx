import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkerJobOrderDetail from './WorkerJobOrderDetail';

// Previously untested (ARCHITECTURE_REVIEW.md item 12/19) — the worker-side submit action and
// FR-9's "show the worker their own repair reason" display had no coverage.
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PROJECT = { id: 7, project_name: 'Cabinet Set', date_ordered: '2026-09-01', due_date: '2026-10-01', priority_level: 'Normal', variables: [] };

function mockGets(assignments) {
    api.get.mockImplementation((url) => {
        if (url === '/api/job-orders/7') return Promise.resolve({ success: true, data: PROJECT });
        if (url === '/api/job-orders/7/assignments') return Promise.resolve({ success: true, data: assignments });
        return Promise.resolve({ success: true, data: [] });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('WorkerJobOrderDetail', () => {
    it('submits work and shows a disabled "WORK SUBMITTED" button', async () => {
        mockGets([{ assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', due_date: '2026-09-10', status: 'Assigned' }]);
        api.put.mockResolvedValue({ success: true, data: {} });

        render(<WorkerJobOrderDetail projectId={7} assignmentId={1} workerStatus="Assigned" onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');

        fireEvent.click(screen.getByText('I AM DONE'));
        fireEvent.click(screen.getByText('Yes, Submit'));

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/assignments/1/status', { status: 'For QA' }));
        const submitted = await screen.findByText('WORK SUBMITTED');
        expect(submitted).toBeDisabled();
    });

    it('shows this worker\'s own repair reason and reviewer name when sent back for repair', async () => {
        mockGets([
            { assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', due_date: '2026-09-10', status: 'Repair', qa_notes: 'Joints are loose.', qa_checker_first_name: 'Ana', qa_checker_last_name: 'Reyes' },
            // Another stage's own notes on the same project must not leak into this worker's view.
            { assignment_id: 2, stage_name: 'Carver', first_name: 'Maria', last_name: 'Santos', start_date: '2026-09-05', due_date: '2026-09-10', status: 'Repair', qa_notes: 'Not this one.' },
        ]);

        render(<WorkerJobOrderDetail projectId={7} assignmentId={1} workerStatus="Repair" onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');

        expect(screen.getByText('Joints are loose.')).toBeInTheDocument();
        expect(screen.getByText(/from Ana Reyes/)).toBeInTheDocument();
        expect(screen.queryByText('Not this one.')).not.toBeInTheDocument();
        expect(screen.getByText('WORK REPAIR')).toBeInTheDocument();
    });

    it('shows a disabled "APPROVED" button once approved', async () => {
        mockGets([{ assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', due_date: '2026-09-10', status: 'Approved' }]);

        render(<WorkerJobOrderDetail projectId={7} assignmentId={1} workerStatus="Approved" onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');

        expect(screen.getByText('APPROVED')).toBeDisabled();
    });
});

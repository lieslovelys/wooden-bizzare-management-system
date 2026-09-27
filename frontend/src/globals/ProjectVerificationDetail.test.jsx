import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectVerificationDetail from './ProjectVerificationDetail';

// Previously untested (ARCHITECTURE_REVIEW.md item 12/19) — the QA Approve/Repair actions and
// FR-6's rejection-reason requirement had no coverage from the reviewer side (jobOrderService's
// own rules were already covered from the service side, in jobOrderService.test.js).
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { api } = await import('../api/client');

const PROJECT = { id: 7, project_name: 'Cabinet Set', date_ordered: '2026-09-01', due_date: '2026-10-01', priority_level: 'Normal', variables: [] };

const TASKS = [
    { assignment_id: 1, stage_name: 'Carpenter', first_name: 'Juan', last_name: 'Dela Cruz', start_date: '2026-09-05', due_date: '2026-09-10', status: 'For QA' },
];

function mockGets(tasks = TASKS) {
    api.get.mockImplementation((url) => {
        if (url === '/api/job-orders/7') return Promise.resolve({ success: true, data: PROJECT });
        if (url === '/api/job-orders/7/assignments') return Promise.resolve({ success: true, data: tasks });
        return Promise.resolve({ success: true, data: [] });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ProjectVerificationDetail', () => {
    it('accepts a WB-formatted projectId and strips it down to the numeric id for the fetch', async () => {
        mockGets();
        render(<ProjectVerificationDetail projectId="WB-07" onBack={vi.fn()} />);
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/job-orders/7'));
    });

    it('approves a task and swaps its actions for the Approved badge', async () => {
        mockGets();
        api.put.mockResolvedValue({ success: true, data: {} });

        render(<ProjectVerificationDetail projectId={7} onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');

        fireEvent.click(screen.getByText('✓ Approve'));

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/assignments/1/status', {
            status: 'Approved',
            notes: undefined,
        }));
        expect(await screen.findByText('Approved')).toBeInTheDocument();
        expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
    });

    it('keeps Send disabled until a non-blank reason is entered, then sends it as notes', async () => {
        mockGets();
        api.put.mockResolvedValue({ success: true, data: {} });

        render(<ProjectVerificationDetail projectId={7} onBack={vi.fn()} />);
        await screen.findByText('Cabinet Set');

        fireEvent.click(screen.getByText('✕ Repair'));
        const sendBtn = screen.getByText('Send');
        expect(sendBtn).toBeDisabled();

        const textarea = screen.getByPlaceholderText('e.g. Joints are loose, redo the frame.');
        fireEvent.change(textarea, { target: { value: '   ' } });
        expect(sendBtn).toBeDisabled();

        fireEvent.change(textarea, { target: { value: 'Joints are loose, redo the frame.' } });
        expect(sendBtn).not.toBeDisabled();

        fireEvent.click(sendBtn);

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/assignments/1/status', {
            status: 'Repair',
            notes: 'Joints are loose, redo the frame.',
        }));
        expect(await screen.findByText('Needs Repair')).toBeInTheDocument();
    });
});

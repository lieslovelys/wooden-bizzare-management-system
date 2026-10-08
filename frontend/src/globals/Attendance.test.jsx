import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Attendance from './Attendance';

// FR-5 (PRD.md C.1): status/late_minutes are now computed server-side instead of always sitting
// at the database default — this covers that the log renders whatever the server sends, with no
// client-side computation of its own.
// utils/format.js's workerPhotoUrl() goes through this module's apiUrl() — mocked to a fixed
// prefix here too (see utils/format.test.js's own mock for why: VITE_BACKEND_IP is unset in
// CI's `npm test` step).
vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiUrl: (path) => 'https://api.test' + path,
}));

const { api } = await import('../api/client');

const WORKER = { user_id: 7, first_name: 'Juan', last_name: 'Dela Cruz', job_role: 'Carpenter', job_type: 'Full-time', photo_path: 'w7.jpg' };

const LOG_ROWS = [
  { id: 1, date: '2026-01-05', day_of_week: 'Monday', time_in: '08:46:00', time_out: '17:00:00', status: 'Late', late_minutes: 16 },
  { id: 2, date: '2026-01-06', day_of_week: 'Tuesday', time_in: '13:00:00', time_out: '16:00:00', status: 'Half-day', late_minutes: 0 },
];

const pageOf = (rows) => ({
  success: true,
  data: rows,
  meta: { page: 1, limit: 25, total: rows.length, totalPages: rows.length > 0 ? 1 : 0 },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/workers')) return Promise.resolve(pageOf([WORKER]));
    if (url.startsWith('/api/attendance/worker/')) return Promise.resolve(pageOf(LOG_ROWS));
    return Promise.resolve(pageOf([]));
  });
});

describe('Attendance log status column', () => {
  it('renders the server-computed status for each row, with late minutes shown', async () => {
    render(<Attendance />);

    const workerRow = await screen.findByText(/DELA CRUZ, JUAN/i);
    fireEvent.click(workerRow.closest('.att-item'));

    await waitFor(() => expect(screen.getByText('Late · 16m')).toBeInTheDocument());
    expect(screen.getByText('Half-day')).toBeInTheDocument();
  });
});

describe('Attendance worker avatar', () => {
  it("uses workerPhotoUrl's id/photo_path URL, not an inlined photo, for the selected worker", async () => {
    render(<Attendance />);

    const workerRow = await screen.findByText(/DELA CRUZ, JUAN/i);
    fireEvent.click(workerRow.closest('.att-item'));

    const avatar = await screen.findByAltText("Juan Dela Cruz's photo");
    expect(avatar).toHaveAttribute('src', 'https://api.test/api/workers/7/photo?v=w7.jpg');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// FR-5 (PRD.md C.1 / B.6): attendanceService now computes `status`/`late_minutes` server-side
// instead of leaving every row at the database default. Closes the attendanceService coverage
// gap noted in ARCHITECTURE_REVIEW.md's P2 "No tests, anywhere" item.

vi.mock('../models/attendanceModel.js', () => ({
  getAttendanceByWorkerId: vi.fn(),
  getAttendanceById: vi.fn(),
  createAttendance: vi.fn(),
  updateAttendance: vi.fn(),
  deleteAttendance: vi.fn(),
}));

const attendanceModel = await import('../models/attendanceModel.js');
const AttendanceService = (await import('../services/attendanceService.js')).default;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('attendanceService.computeAttendance', () => {
  it('is Absent with no time_in', () => {
    expect(AttendanceService.computeAttendance({ time_in: null, time_out: null }))
      .toEqual({ status: 'Absent', late_minutes: 0 });
  });

  it('is Present at exactly shift start (08:30)', () => {
    expect(AttendanceService.computeAttendance({ time_in: '08:30', time_out: null }))
      .toEqual({ status: 'Present', late_minutes: 0 });
  });

  it('is still Present at the end of the 15-minute grace period (08:45)', () => {
    expect(AttendanceService.computeAttendance({ time_in: '08:45', time_out: null }))
      .toEqual({ status: 'Present', late_minutes: 0 });
  });

  it('is Late one minute past the grace period (08:46), counting minutes from shift start', () => {
    expect(AttendanceService.computeAttendance({ time_in: '08:46', time_out: null }))
      .toEqual({ status: 'Late', late_minutes: 16 });
  });

  it('is Late from time_in alone when there is no time_out yet', () => {
    expect(AttendanceService.computeAttendance({ time_in: '09:00', time_out: null }))
      .toEqual({ status: 'Late', late_minutes: 30 });
  });

  it('is Half-day for a short morning shift under 4 worked hours', () => {
    expect(AttendanceService.computeAttendance({ time_in: '08:00', time_out: '11:00' }))
      .toEqual({ status: 'Half-day', late_minutes: 0 });
  });

  it('is Present at exactly 4 worked hours spanning the lunch break', () => {
    // 08:30-13:30 = 5h elapsed, minus the full 1h lunch overlap = 4h worked (the boundary).
    expect(AttendanceService.computeAttendance({ time_in: '08:30', time_out: '13:30' }))
      .toEqual({ status: 'Present', late_minutes: 0 });
  });

  it('Half-day takes priority over Late, and reports 0 late minutes', () => {
    // Arriving at 13:00 would otherwise be hours "late," but a short afternoon-only shift is
    // Half-day instead, with no late-minutes penalty.
    expect(AttendanceService.computeAttendance({ time_in: '13:00', time_out: '16:00' }))
      .toEqual({ status: 'Half-day', late_minutes: 0 });
  });

  it('does not compute overtime — always 0, regardless of time_out', () => {
    const result = AttendanceService.computeAttendance({ time_in: '08:30', time_out: '20:00' });
    expect(result.status).toBe('Present');
    expect(result).not.toHaveProperty('overtime_minutes');
  });
});

describe('attendanceService.postAttendance', () => {
  const FIELDS = { worker_id: 5, date: '2026-01-05', day_of_week: 'Monday', time_in: '08:46', time_out: '17:00' };

  it('rejects a time_out with no time_in', async () => {
    await expect(AttendanceService.postAttendance({ ...FIELDS, time_in: null }))
      .rejects.toMatchObject({ status: 400 });
    expect(attendanceModel.createAttendance).not.toHaveBeenCalled();
  });

  it('rejects a time_out at or before time_in', async () => {
    await expect(AttendanceService.postAttendance({ ...FIELDS, time_in: '17:00', time_out: '17:00' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(AttendanceService.postAttendance({ ...FIELDS, time_in: '17:00', time_out: '08:00' }))
      .rejects.toMatchObject({ status: 400 });
    expect(attendanceModel.createAttendance).not.toHaveBeenCalled();
  });

  it('forwards the computed status/late_minutes to the model', async () => {
    attendanceModel.createAttendance.mockResolvedValue({ id: 1, ...FIELDS, status: 'Late', late_minutes: 16 });
    await AttendanceService.postAttendance(FIELDS);
    expect(attendanceModel.createAttendance).toHaveBeenCalledWith({
      ...FIELDS,
      status: 'Late',
      late_minutes: 16,
    });
  });

  it('maps a duplicate (worker_id, date) to a 409', async () => {
    attendanceModel.createAttendance.mockRejectedValue({ code: '23505' });
    await expect(AttendanceService.postAttendance(FIELDS)).rejects.toMatchObject({ status: 409 });
  });
});

describe('attendanceService.putAttendance', () => {
  const FIELDS = { date: '2026-01-05', day_of_week: 'Monday', time_in: '08:30', time_out: '11:00' };

  it('validates times the same way as postAttendance', async () => {
    await expect(AttendanceService.putAttendance(1, { ...FIELDS, time_out: '08:00' }))
      .rejects.toMatchObject({ status: 400 });
    expect(attendanceModel.updateAttendance).not.toHaveBeenCalled();
  });

  it('forwards the computed status/late_minutes to the model', async () => {
    attendanceModel.updateAttendance.mockResolvedValue({ id: 1, ...FIELDS, status: 'Half-day', late_minutes: 0 });
    await AttendanceService.putAttendance(1, FIELDS);
    expect(attendanceModel.updateAttendance).toHaveBeenCalledWith(1, {
      ...FIELDS,
      status: 'Half-day',
      late_minutes: 0,
    });
  });

  it('404s when the record does not exist', async () => {
    attendanceModel.updateAttendance.mockResolvedValue(null);
    await expect(AttendanceService.putAttendance(999, FIELDS)).rejects.toMatchObject({ status: 404 });
  });

  it('maps a duplicate (worker_id, date) to a 409', async () => {
    attendanceModel.updateAttendance.mockRejectedValue({ code: '23505' });
    await expect(AttendanceService.putAttendance(1, FIELDS)).rejects.toMatchObject({ status: 409 });
  });
});

describe('attendanceService.getAttendanceRecord / removeAttendance', () => {
  it('404s when the record does not exist', async () => {
    attendanceModel.getAttendanceById.mockResolvedValue(null);
    await expect(AttendanceService.getAttendanceRecord(999)).rejects.toMatchObject({ status: 404 });
  });

  it('returns the record when found', async () => {
    attendanceModel.getAttendanceById.mockResolvedValue({ id: 1 });
    await expect(AttendanceService.getAttendanceRecord(1)).resolves.toEqual({ id: 1 });
  });

  it('404s removing a record that does not exist', async () => {
    attendanceModel.deleteAttendance.mockResolvedValue(false);
    await expect(AttendanceService.removeAttendance(999)).rejects.toMatchObject({ status: 404 });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';

// FR-5: time_in/time_out are now parsed by attendanceService (not passed straight through to
// Postgres), so schemas/attendanceSchemas.js constrains them to HH:MM[:SS] at the route boundary
// — this covers that a malformed value 400s before ever reaching the service.
vi.mock('../services/attendanceService.js', () => ({
  default: {
    getWorkerAttendance: vi.fn(),
    getAttendanceRecord: vi.fn(),
    postAttendance: vi.fn(),
    putAttendance: vi.fn(),
    removeAttendance: vi.fn(),
  },
}));

const Attendance = (await import('../services/attendanceService.js')).default;
const attendanceRoutes = (await import('../routes/attendanceRoutes.js')).default;

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use('/api/attendance', attendanceRoutes);
  app.use(errorHandler);
  return app;
}

const ADMIN = { user_id: 1, user_role: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/attendance', () => {
  const VALID = { worker_id: 5, date: '2026-01-05', time_in: '08:30', time_out: '17:00' };

  it('rejects a malformed time_in', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/attendance').send({ ...VALID, time_in: '8:30am' });
    expect(res.status).toBe(400);
    expect(Attendance.postAttendance).not.toHaveBeenCalled();
  });

  it('accepts a well-formed request', async () => {
    Attendance.postAttendance.mockResolvedValue({ id: 1, ...VALID, status: 'Present', late_minutes: 0 });
    const app = buildApp(ADMIN);
    const res = await request(app).post('/api/attendance').send(VALID);
    expect(res.status).toBe(201);
    expect(Attendance.postAttendance).toHaveBeenCalledWith(VALID);
  });
});

describe('PUT /api/attendance/:id', () => {
  const VALID = { date: '2026-01-05', time_in: '08:30', time_out: '17:00' };

  it('rejects a malformed time_out', async () => {
    const app = buildApp(ADMIN);
    const res = await request(app).put('/api/attendance/1').send({ ...VALID, time_out: '5pm' });
    expect(res.status).toBe(400);
    expect(Attendance.putAttendance).not.toHaveBeenCalled();
  });
});

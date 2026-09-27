import { z } from 'zod';
import { idParam } from './common.js';

// Replaces attendanceRoutes.js's inline `if (!worker_id) ...` / `if (!date) ...` checks.
// worker_id was previously just a truthiness check (so a non-numeric value reached
// createAttendance and 500'd on the bigint FK insert) — reusing `idParam` here fixes that the
// same way the route-param guards do. day_of_week stays an untyped string, passed straight
// through to Postgres.
//
// FR-5: time_in/time_out are now parsed by attendanceService.js's computeAttendance (not just
// passed through to Postgres), so they're constrained to HH:MM[:SS] here rather than left as any
// string — a malformed value 400s at the route boundary instead of reaching the parser.
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const timeField = z.string().regex(TIME_RE, 'must be HH:MM or HH:MM:SS.').optional().nullable();

export const createBody = z.object({
  worker_id: idParam,
  date: z.string().min(1, 'date is required.'),
  day_of_week: z.string().optional(),
  time_in: timeField,
  time_out: timeField,
});

export const updateBody = z.object({
  date: z.string().min(1, 'date is required.'),
  day_of_week: z.string().optional(),
  time_in: timeField,
  time_out: timeField,
});

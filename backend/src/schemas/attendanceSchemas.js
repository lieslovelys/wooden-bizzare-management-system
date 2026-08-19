import { z } from 'zod';
import { idParam } from './common.js';

// Replaces attendanceRoutes.js's inline `if (!worker_id) ...` / `if (!date) ...` checks.
// worker_id was previously just a truthiness check (so a non-numeric value reached
// createAttendance and 500'd on the bigint FK insert) — reusing `idParam` here fixes that the
// same way the route-param guards do. day_of_week/time_in/time_out stay untyped strings;
// attendanceService/attendanceModel pass them straight through to Postgres and this pass isn't
// changing that contract.
export const createBody = z.object({
  worker_id: idParam,
  date: z.string().min(1, 'date is required.'),
  day_of_week: z.string().optional(),
  time_in: z.string().optional().nullable(),
  time_out: z.string().optional().nullable(),
});

export const updateBody = z.object({
  date: z.string().min(1, 'date is required.'),
  day_of_week: z.string().optional(),
  time_in: z.string().optional().nullable(),
  time_out: z.string().optional().nullable(),
});

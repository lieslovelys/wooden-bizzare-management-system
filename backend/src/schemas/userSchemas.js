import { z } from 'zod';
import { USER_ROLE, SUFFIX } from './common.js';

// Item 40: replaces the old signupBody, which let a caller pick `userRole: 'Worker'` here too —
// that created a users row with no matching worker_details (no rate, no job role; see PRD.md
// C.2/318's now-closed gap). Workers are created only through POST /api/workers
// (workerBody below), which writes both rows in one transaction
// (userModel.createWorkerWithDetails). Replaces userRoutes.js's old inline
// `ALLOWED_ROLES.includes(b.userRole)` check.
export const accountBody = z.object({
  username: z.string().trim().min(1, 'username is required.'),
  password: z.string().min(8, 'password must be at least 8 characters.'),
  firstName: z.string().trim().min(1, 'firstName is required.'),
  middleName: z.string().optional(),
  lastName: z.string().trim().min(1, 'lastName is required.'),
  suffix: z.union([z.enum(SUFFIX), z.literal('')]).optional(),
  userRole: z.enum(
    USER_ROLE.filter((r) => r !== 'Worker'),
    { message: 'userRole must be a non-Worker role — create a Worker via POST /api/workers.' }
  ),
});

// POST /workers had no body validation at all — a blank username/password/name would reach the
// database as a bare NOT NULL-less insert (the columns are nullable, so it wouldn't even 500;
// it would silently create a broken login). workerType/role (job_type/job_role) are free-text
// varchar columns fed by a fixed frontend <select>, not a Postgres enum, so they're validated as
// non-empty strings here rather than a closed set. dailyRate stays permissive (string or number,
// including "") because userService.addWorker's caller-side default (`"" -> 0`) already handles
// an empty value — tightening it here would just duplicate that logic with different behavior.
export const workerBody = z.object({
  username: z.string().trim().min(1, 'username is required.'),
  password: z.string().min(1, 'password is required.'),
  firstName: z.string().trim().min(1, 'firstName is required.'),
  middleName: z.string().optional(),
  lastName: z.string().trim().min(1, 'lastName is required.'),
  suffix: z.union([z.enum(SUFFIX), z.literal('')]).optional(),
  workerType: z.string().trim().min(1, 'workerType is required.'),
  role: z.string().trim().min(1, 'role is required.'),
  contactNumber: z.string().optional(),
  dailyRate: z.union([z.string(), z.number()]).optional(),
  photo: z.string().optional().nullable(),
});

// PUT /workers/:id is an upsert-style update (see userModel.updateWorkerDetails's
// `ON CONFLICT ... DO UPDATE`) — every field optional, matching its existing "whatever was sent
// replaces the row" behavior rather than requiring a full worker payload on every edit.
export const workerUpdateBody = z.object({
  workerType: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  contactNumber: z.string().optional(),
  dailyRate: z.union([z.string(), z.number()]).optional(),
  photo: z.string().optional().nullable(),
});

import { z } from 'zod';
import { PRIORITY, TASK_STATUS, STAGE, csvEnum } from './common.js';

const sortEnum = z.enum(['asc', 'desc']);

// Replaces jobOrderRoutes.js's inline parsePriorityFilter + parseSort on GET /job-orders.
export const jobOrdersQuery = z.object({
  priority: csvEnum(PRIORITY, 'priority'),
  sort: sortEnum.optional(),
});

// Replaces the inline ALLOWED_TASK_STATUSES check on GET /workers/:workerId/tasks, and also
// fixes a real gap the audit found: `priority` was read off `req.query` and passed straight to
// the model with no validation at all (unlike the near-identical /job-orders filter above) —
// `getTasksByWorkerId` treats it as a single-value equality match, not the CSV list /job-orders
// uses, so this is `z.enum`, not `csvEnum`.
export const workerTasksQuery = z.object({
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  sort: sortEnum.optional(),
});

// Replaces the inline ALLOWED_STAGES check on GET /qa/tasks.
export const qaTasksQuery = z.object({
  stage: z.enum(STAGE).optional(),
});

// POST /job-orders/:id/assign validated neither field before this — an invalid `stage` or a
// non-numeric `workerId` both reached the database unchecked (see ARCHITECTURE_REVIEW.md P2).
export const assignBody = z.object({
  workerId: z.coerce.number().int().positive('workerId must be a positive integer.'),
  stage: z.enum(STAGE),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

// PUT /assignments/:assignmentId/status validated neither field before this — `status` reached
// jobOrderService.updateQAStatus as a raw string (see track-A plan finding 2). `notes` is FR-6/
// FR-7's rejection reason / review comment; shape-only validation here, the "a Repair must carry
// a non-empty reason" business rule itself lives in the service per CLAUDE.md's layer contract.
export const assignmentStatusBody = z.object({
  status: z.enum(TASK_STATUS),
  notes: z.string().trim().max(1000).optional(),
});

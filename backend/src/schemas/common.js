import { z } from 'zod';

// Shared building blocks for the per-route schema files. Centralized here so the same enum
// isn't retyped (and risks drifting) across userSchemas/projectSchemas/jobOrderSchemas/etc — see
// ARCHITECTURE_REVIEW.md P2 "input validation library".

// Coerces a route param to a positive integer, replacing the numeric check that never existed
// on any of the app's 26 `:id`-taking handlers (every one previously reached Postgres as an
// unvalidated string and 500'd on `WHERE id = 'abc'`). `z.coerce.number()` runs before `.int()`,
// so "12" passes and "abc"/"1.5"/"-1"/"0" all fail with one consistent message.
export const idParam = z.coerce.number().int().positive();

// A single-key params schema for the common case of one `:id`-shaped param. `name` matches
// whatever the route actually calls it (`id`, `workerId`, `projectId`, `assignmentId`,
// `variantId`) so the schema still validates the right key.
export function idParams(name = 'id') {
  return z.object({ [name]: idParam });
}

// Enum sets — must match the Postgres enum / frontend `<select>` options exactly. Previously
// duplicated as loose arrays in individual route files (ALLOWED_ROLES, ALLOWED_TASK_STATUSES,
// ALLOWED_STAGES, ALLOWED_PRIORITIES, ALLOWED_REMARKS, ALLOWED_PROJECT_STATUSES,
// ALLOWED_CATEGORIES, ADJUST_REASONS, KNOWN_TYPES) — one definition each now.
export const USER_ROLE = ['Admin', 'Production Manager', 'Inventory Staff', 'Quality Checker', 'Worker'];
export const SUFFIX = ['None', 'Sr.', 'Jr.', 'II', 'III', 'IV', 'V'];
export const PROJECT_STATUS = ['Pending', 'In Progress', 'Completed'];
export const TASK_STATUS = ['Assigned', 'In Progress', 'For QA', 'Rework', 'Approved', 'Repair'];
export const STAGE = ['Carpenter', 'Carver', 'Liha', 'Painter', 'Delivery'];
export const PRIORITY = ['High', 'Medium', 'Low'];
export const REMARK = ['Early', 'On-time', 'Late', 'Unknown'];
export const INVENTORY_CATEGORY = ['Raw Material', 'Tool', 'Consumable'];
export const ADJUST_REASON = ['Received', 'Used', 'Damaged', 'Correction'];
export const NOTIF_TYPE = ['project', 'verification'];

// A comma-separated multi-value filter, e.g. `?status=Pending,In Progress`. Replaces the
// near-identical parseStatusFilter (projectRoutes.js) / parsePriorityFilter (jobOrderRoutes.js)
// helpers: split, trim, drop empties, reject anything not in `values`. Returns `undefined` when
// the param is omitted, matching their "no filter" behavior.
export function csvEnum(values, fieldName) {
  return z
    .string()
    .optional()
    .transform((raw) => (raw === undefined ? undefined : raw.split(',').map((v) => v.trim()).filter(Boolean)))
    .refine((arr) => arr === undefined || arr.every((v) => values.includes(v)), {
      message: `${fieldName} must be one of: ${values.join(', ')}`,
    });
}

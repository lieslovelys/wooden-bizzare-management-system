import { z } from 'zod';
import { INVENTORY_CATEGORY, ADJUST_REASON } from './common.js';

// A direct translation of inventoryRoutes.js's inline validateItemBody — same field-by-field
// checks, now as a schema shared by POST / and PUT /:id (both called it identically before).
const variant = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().trim().min(1, 'Each variant needs a name.'),
  minStock: z.number().int().nonnegative('minStock must be a non-negative integer.').optional(),
});

export const inventoryItemBody = z.object({
  name: z.string().trim().min(1, 'name is required.'),
  category: z.enum(INVENTORY_CATEGORY, { message: 'Invalid category.' }),
  unit: z.string().trim().min(1, 'unit is required.'),
  variants: z.array(variant).min(1, 'At least one variant is required.'),
});

// A direct translation of the inline delta/reason checks on POST /variants/:variantId/adjust.
// FR-3: `projectId` optionally tags the movement as consumed by (reason 'Used', delta < 0) or
// returned to (reason 'Returned', delta > 0) a project — see services/inventoryService.js for
// the project-status/over-return checks a schema alone can't express.
export const adjustBody = z
  .object({
    delta: z.number().int('delta must be a non-zero integer.').refine((v) => v !== 0, {
      message: 'delta must be a non-zero integer.',
    }),
    reason: z.enum(ADJUST_REASON, { message: 'Invalid reason.' }).optional(),
    projectId: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === 'Returned') {
      if (!data.projectId) {
        ctx.addIssue({ code: 'custom', path: ['projectId'], message: 'A Returned adjustment requires a project.' });
      }
      if (data.delta <= 0) {
        ctx.addIssue({ code: 'custom', path: ['delta'], message: 'A Returned adjustment must be a positive delta.' });
      }
    } else if (data.projectId !== undefined) {
      if (data.reason !== 'Used') {
        ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A project can only be tagged on a Used or Returned adjustment.' });
      } else if (data.delta >= 0) {
        ctx.addIssue({ code: 'custom', path: ['delta'], message: 'A Used adjustment tagged to a project must be a negative delta.' });
      }
    }
  });

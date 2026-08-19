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
export const adjustBody = z.object({
  delta: z.number().int('delta must be a non-zero integer.').refine((v) => v !== 0, {
    message: 'delta must be a non-zero integer.',
  }),
  reason: z.enum(ADJUST_REASON, { message: 'Invalid reason.' }).optional(),
});

import { z } from 'zod';

// A direct translation of profitRoutes.js's inline `typeof x !== 'number'` checks — deliberately
// `z.number()` rather than `z.union([z.string(), z.number()])`, since the original check
// rejected numeric strings too and admin/Profit.jsx already sends real numbers.
const expenseItem = z.object({
  description: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
});

export const profitBody = z.object({
  client_payment: z.number(),
  worker_wages: z.number(),
  materials_cost: z.number(),
  other_expenses: z.number(),
  expense_items: z.array(expenseItem).optional(),
});

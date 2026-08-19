import { z } from 'zod';
import { PRIORITY, PROJECT_STATUS, REMARK, csvEnum } from './common.js';

// Neither POST / nor PUT /:id validated a single body field before this — a blank `projectName`
// reached `createProjectWithVariables` and inserted a row with an empty name. `projectDetails`
// (the project-variables array; frontend/src/globals/CreateProjectForm.jsx builds it as
// `{name, detail}` pairs, filtered for a non-empty name in the model itself) stays loosely typed
// since the model already drops blank-named entries.
const variable = z.object({
  name: z.string().optional(),
  detail: z.string().optional(),
});

export const projectBody = z.object({
  projectName: z.string().trim().min(1, 'projectName is required.'),
  clientName: z.string().optional(),
  contactNumber: z.string().optional(),
  dateOrdered: z.string().optional(),
  clientPayment: z.union([z.string(), z.number()]).optional(),
  priorityLevel: z.enum(PRIORITY).optional(),
  dueDate: z.string().optional(),
  projectDetails: z.array(variable).optional(),
});

// Replaces projectRoutes.js's inline parseStatusFilter.
export const statusQuery = z.object({
  status: csvEnum(PROJECT_STATUS, 'status'),
});

// Replaces the inline ALLOWED_REMARKS check on GET /history.
export const remarkQuery = z.object({
  remark: z.enum(REMARK).optional(),
});

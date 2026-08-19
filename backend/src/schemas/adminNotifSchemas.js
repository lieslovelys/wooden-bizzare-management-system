import { z } from 'zod';
import { NOTIF_TYPE } from './common.js';

// Replaces adminNotifRoutes.js's inline parseTypeQuery, which wrote a 400 into `res` directly
// *and* returned `{ok:false}` for the caller to `return` on — a caller that forgot the `return`
// would double-send. A thrown AppError removes that failure mode by construction.
export const typeQuery = z.object({
  type: z.enum(NOTIF_TYPE).optional(),
});

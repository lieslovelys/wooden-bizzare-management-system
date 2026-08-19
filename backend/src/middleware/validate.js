import { z } from 'zod';
import { AppError } from '../errors/AppError.js';

// Route-boundary request validation — see ARCHITECTURE_REVIEW.md P2 "input validation library".
// Pass zod schemas for whichever of params/query/body a route needs; each is optional. On
// success the parsed (and possibly coerced/transformed) output is written to `req.valid`, never
// back onto `req.params`/`req.query`/`req.body` — `req.query` is a getter-only property in
// Express 5, and leaving the originals untouched means every existing `req.params.id`/`req.body`
// read elsewhere in a route keeps behaving exactly as it did before this middleware existed.
// On failure, throws AppError(400, ...) with the first validation issue's message — Express 5
// forwards the rejection to errorHandler automatically, same as every other thrown AppError.
export function validate({ params, query, body } = {}) {
  return (req, res, next) => {
    try {
      const valid = {};
      if (params) valid.params = params.parse(req.params);
      if (query) valid.query = query.parse(req.query);
      if (body) valid.body = body.parse(req.body);
      req.valid = valid;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, err.issues[0]?.message || 'Invalid request'));
      }
      next(err);
    }
  };
}

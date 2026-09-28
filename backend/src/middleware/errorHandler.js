import { AppError } from '../errors/AppError.js';

// Centralized error handler. Must be the LAST middleware mounted in server.js.
// Express 5 forwards rejected async route handlers here automatically.
//
// Logs the real error server-side (structured, via req.log — pino's `err` serializer includes
// the stack — never a full request body, user row, or financial payload, per CLAUDE.md) and
// returns a sanitized message to the client. Never forwards raw pg error fields
// (code/detail/constraint/table) or a stack trace to the client.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // AppError is operational: a service deliberately threw this, with a status and body it
  // already chose to be client-safe — send it through as-is. Not logged as an error: this is
  // expected control flow (a 404, a validation failure), not a bug.
  if (err instanceof AppError) {
    return res.status(err.status).json(err.body);
  }

  // Anything else is unexpected (a DB error, a bug) — log server-side, never leak internals.
  // `req.log` carries this request's correlation id (app.js's pino-http middleware); falls back
  // to plain console.error for the rare hand-rolled test app that mounts this middleware without
  // pino-http ahead of it.
  (req.log || console).error({ err }, `Unhandled error: ${req.method} ${req.originalUrl}`);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

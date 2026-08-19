import { AppError } from '../errors/AppError.js';

// Centralized error handler. Must be the LAST middleware mounted in server.js.
// Express 5 forwards rejected async route handlers here automatically.
//
// Logs the real error server-side (event + method/path only — never a full request body,
// user row, or financial payload, per CLAUDE.md) and returns a sanitized message to the
// client. Never forwards raw pg error fields (code/detail/constraint/table) or a stack trace.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // AppError is operational: a service deliberately threw this, with a status and body it
  // already chose to be client-safe — send it through as-is.
  if (err instanceof AppError) {
    return res.status(err.status).json(err.body);
  }

  // Anything else is unexpected (a DB error, a bug) — log server-side, never leak internals.
  console.error(`[${req.method} ${req.originalUrl}]`, err.message);
  res.status(500).json({ error: 'Internal server error' });
}

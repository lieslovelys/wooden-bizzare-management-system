// PRD.md C.2 "Observability": one shared, structured (JSON) logger for the whole backend —
// replaces the mix of plain `console.log`/`console.error` calls that used to be scattered across
// routes/services/models/scripts, none of which could be correlated back to the HTTP request
// that caused them, or filtered/aggregated by level.
//
// Request-scoped logging (routes, and errorHandler.js) goes through `req.log` instead of this
// module directly — see app.js's `pino-http` middleware, which hands every request a child
// logger already bound with that request's correlation id (`req.id`). This module is for
// everything OUTSIDE a request: process startup/shutdown (server.js), the one-off DB connection
// smoke test (config/db.js), CLI scripts (scripts/*.js), and the one genuinely-swallowed error in
// utils/photoStorage.js's removePhoto (nothing else will ever log that one, since it doesn't
// rethrow).
//
// Silenced during the test suite (`VITEST` is set automatically by Vitest) — every backend test
// that exercises `app.js` would otherwise emit a JSON log line per request, which is pure noise
// in `npm test` output and tells a test failure nothing a supertest assertion doesn't already.
import pino from 'pino';

export const logger = pino({
  level: process.env.VITEST ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  // Defense in depth alongside the CLAUDE.md rule against logging request bodies/full user rows/
  // financial payloads — redacts these fields if they ever end up in a logged object regardless
  // of which layer passed it in, rather than relying solely on every call site remembering not
  // to.
  redact: {
    paths: ['password', 'user_password', 'photo', 'req.headers.cookie', 'req.headers.authorization'],
    censor: '[redacted]',
  },
});

export default logger;

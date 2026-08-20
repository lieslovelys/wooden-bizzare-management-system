// Thrown by services to signal an expected, client-facing failure (not-found, forbidden,
// validation, state conflict, etc.) — never returned as a value. errorHandler.js is what turns
// this into the actual HTTP response, so a service can throw and let it propagate without ever
// touching req/res itself. See CLAUDE.md's rule against `catch(e){ return e; }`, which this
// replaces.
export class AppError extends Error {
  // `body` is the exact JSON body the client receives. Defaults to the one error shape the
  // whole API now answers with — { success: false, error: message } — see
  // ARCHITECTURE_REVIEW.md P2 "Inconsistent API contract". `error` stays top-level (never
  // nested) because frontend/src/api/client.js builds its thrown ApiError's message from
  // `data.error || data.message`; nesting it would silently degrade every user-facing toast to
  // a generic "Request failed (NNN)". An explicit `body` is still accepted for the rare case
  // that genuinely needs a different shape, but nothing in this codebase currently does.
  constructor(status, message, body) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.body = body ?? { success: false, error: message };
  }
}

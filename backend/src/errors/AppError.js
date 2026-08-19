// Thrown by services to signal an expected, client-facing failure (not-found, forbidden,
// validation, state conflict, etc.) — never returned as a value. errorHandler.js is what turns
// this into the actual HTTP response, so a service can throw and let it propagate without ever
// touching req/res itself. See CLAUDE.md's rule against `catch(e){ return e; }`, which this
// replaces.
export class AppError extends Error {
  // `body` is the exact JSON body the client receives. Defaults to { error: message } — the
  // shape most of this API already uses. A handful of existing endpoints instead answer with
  // { success: false, message }; those pass that shape explicitly so their callers (some of
  // which branch on result.success) see byte-identical responses after this refactor.
  constructor(status, message, body) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.body = body ?? { error: message };
  }
}

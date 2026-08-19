// Shared API client. Every backend request goes through this instead of calling fetch()
// directly — see docs/reference_md/ARCHITECTURE_REVIEW.md, "P0 prerequisite".
//
// Fixes, by construction, three problems the ad-hoc inline fetch() calls had:
//  - 58 of 61 call sites never sent credentials, so they only worked because the backend had
//    no auth to fail against. This always sends `credentials: 'include'`.
//  - Some call sites (quality_checker/QualityCheckerNotification.jsx) omitted the base URL
//    entirely and silently hit the wrong host. The base URL is applied in exactly one place.
//  - Failed responses were sometimes parsed as JSON anyway (e.g. an HTML error page from the
//    SPA catch-all), throwing an unrelated SyntaxError. This parses defensively and always
//    throws a typed ApiError with the real status.

const BASE_URL = import.meta.env.VITE_BACKEND_IP;

// Paths where a 401 is an EXPECTED outcome, not a stale/expired session — auto-redirecting to
// /login on these would either loop (calling /login itself just failed auth) or fire on every
// normal "not logged in yet" check (/session-user, probed directly by App.jsx anyway, not via
// this client — listed here defensively in case that ever changes).
const AUTH_EXEMPT_PATHS = ['/api/login', '/api/session-user'];

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. the SPA catch-all's index.html) — leave data as null and
      // fall through to the status-based handling below.
    }
  }

  if (response.status === 401 && !AUTH_EXEMPT_PATHS.includes(path)) {
    // Session missing/expired mid-use. Consistent with the app's existing hard-reload pattern
    // on login/logout rather than introducing a separate client-side auth state.
    window.location.assign('/login');
    throw new ApiError(401, 'Session expired');
  }

  if (!response.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path, body) => request(path, { method: 'DELETE', body }),
};

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Route-authorization matrix — see ARCHITECTURE_REVIEW.md item 19. CLAUDE.md's "Route auth" rule
// says any new route needs an explicit role check "or it is a live hole, not a gap waiting to be
// closed" — until this file, that guarantee was only ever checked by hand. This exercises the
// REAL app.js (not a hand-built Express app), so it's the actual mount table, actual route order,
// and every router's actual middleware chain under test, not a reimplementation of it.
//
// Design:
//   - `ROUTES` is a hand-maintained table of every route this app serves, with the access rule
//     each one is supposed to enforce.
//   - The `describe('route authorization matrix', ...)` block below fires one request per
//     (route, role) pair against the real app and checks the status.
//   - The `describe('route matrix completeness', ...)` block below walks each router's own
//     `.stack` and asserts, in both directions, that ROUTES is exactly the live route set — a new
//     route with no row here fails it, and so does a stale row for a route that no longer exists.
//
// Only `config/db.js`, `express-session`, and `connect-pg-simple` are mocked (so no real
// Postgres/session-store connection is attempted on import) — every `services/*.js` is
// automocked, so a route handler may itself 400/500 on the placeholder request bodies below.
// That's fine: these tests only assert on 401/403, never on a 2xx body.

vi.mock('../config/db.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  query: vi.fn(),
  getClient: vi.fn(),
}));

// Ignores the real `session` argument entirely — nothing here ever calls a Store method, so a
// bare no-op class satisfies `new PgSession({...})` in app.js without needing to fake out
// express-session's own `.Store` base class.
vi.mock('connect-pg-simple', () => ({
  default: () => class {},
}));

// Replaces express-session with a middleware that reads the caller's fake identity off a test
// header instead of a real cookie/store round-trip — `x-test-user` carries a JSON
// `{ user_id, user_role }` object, or is absent for an anonymous request.
function fakeSession() {
  return (req, res, next) => {
    const raw = req.headers['x-test-user'];
    req.session = {
      user: raw ? JSON.parse(raw) : undefined,
      save: (cb) => cb && cb(),
      destroy: (cb) => cb && cb(),
    };
    next();
  };
}
vi.mock('express-session', () => ({ default: fakeSession }));

vi.mock('../services/userService.js');
vi.mock('../services/projectService.js');
vi.mock('../services/jobOrderService.js');
vi.mock('../services/productivityService.js');
vi.mock('../services/adminNotifService.js');
vi.mock('../services/adminDashboardService.js');
vi.mock('../services/profitService.js');
vi.mock('../services/attendanceService.js');
vi.mock('../services/inventoryService.js');

// app.js exits the process if this is unset (see CLAUDE.md P0-4) — set before the dynamic
// import below so that check passes.
process.env.SECRET_KEY = 'test-secret';
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

const { app } = await import('../app.js');

// Imported again directly (not just via app.js's own graph) so the completeness guard below can
// walk each router's `.stack` — these resolve to the same cached module instances app.js already
// mounted, not a second registration.
const userRoutes = (await import('../routes/userRoutes.js')).default;
const projectRoutes = (await import('../routes/projectRoutes.js')).default;
const jobOrderRoutes = (await import('../routes/jobOrderRoutes.js')).default;
const productivityRoutes = (await import('../routes/productivityRoutes.js')).default;
const adminNotifRoutes = (await import('../routes/adminNotifRoutes.js')).default;
const adminDashboardRoutes = (await import('../routes/adminDashboardRoutes.js')).default;
const profitRoutes = (await import('../routes/profitRoutes.js')).default;
const attendanceRoutes = (await import('../routes/attendanceRoutes.js')).default;
const inventoryRoutes = (await import('../routes/inventoryRoutes.js')).default;

const ROLES = ['Admin', 'Production Manager', 'Inventory Staff', 'Quality Checker', 'Worker'];

// Access-rule markers for the routes that aren't a plain requireRole(...) allowlist.
const PUBLIC_NO_AUTH = 'PUBLIC_NO_AUTH'; // no auth middleware at all
const ANY_AUTH = 'ANY_AUTH'; // requireAuth only (or an equivalent in-handler check) — any role passes
const SKIP = 'SKIP'; // still a real, mounted route — excluded only from the per-role assertions
const selfOrAdmin = (paramName, ...roles) => ({ kind: 'SELF_OR_ADMIN', paramName, roles });

// One row per route actually mounted in server.js/app.js. `template` is the full path exactly as
// Express sees it (mount prefix + the router's own route.path) — the completeness guard below
// compares this table against the live `router.stack` of each file, so a typo here fails loudly
// instead of silently testing the wrong thing.
const ROUTES = [
  // userRoutes, mounted at /api
  ['POST', '/api/login', SKIP], // rate-limited + its own 401 semantics — covered by userService.test.js
  ['GET', '/api/session-user', ANY_AUTH], // no requireRole; the handler itself throws 401 with no session
  ['POST', '/api/logout', PUBLIC_NO_AUTH], // must keep answering 200 with no session at all — see its own comment
  ['POST', '/api/users', ['Admin']], // item 40 — was POST /signup
  ['GET', '/api/users', ['Admin']],
  ['DELETE', '/api/users/:id', ['Admin']],
  ['GET', '/api/workers', ['Admin']],
  ['POST', '/api/workers', ['Admin']],
  ['PUT', '/api/workers/:id', ['Admin']],
  ['GET', '/api/workers/:id/photo', ['Admin']],

  // projectRoutes, mounted at /api/projects
  ['POST', '/api/projects', ['Admin']],
  ['GET', '/api/projects', ['Admin']],
  ['PUT', '/api/projects/:id', ['Admin']],
  ['GET', '/api/projects/history', ['Admin', 'Production Manager']],
  ['GET', '/api/projects/:id', ['Admin']],
  ['DELETE', '/api/projects/:id', ['Admin']],
  ['PUT', '/api/projects/:id/complete', ['Admin', 'Production Manager']],

  // jobOrderRoutes, mounted at /api
  ['GET', '/api/job-orders', ['Admin', 'Production Manager']],
  ['GET', '/api/job-orders/:id', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['GET', '/api/assignable-workers', ['Admin', 'Production Manager']],
  ['GET', '/api/job-orders/:id/assignments', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['POST', '/api/job-orders/:id/assign', ['Admin', 'Production Manager']],
  ['GET', '/api/workers/:workerId/tasks', selfOrAdmin('workerId', 'Admin')],
  ['GET', '/api/qa/tasks', ['Admin', 'Production Manager', 'Quality Checker']],
  ['GET', '/api/assignments/:assignmentId', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['PUT', '/api/assignments/:assignmentId/status', ANY_AUTH], // role/ownership branching happens inside the service

  // productivityRoutes, mounted at /api/productivity
  ['GET', '/api/productivity', ['Admin']],

  // adminNotifRoutes, mounted at /api/notifications
  ['GET', '/api/notifications', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['GET', '/api/notifications/unread-count', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['PUT', '/api/notifications/mark-all-read', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['DELETE', '/api/notifications/clear/all', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['DELETE', '/api/notifications/:id', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],
  ['PUT', '/api/notifications/:id/read', ['Admin', 'Production Manager', 'Quality Checker', 'Worker']],

  // adminDashboardRoutes, mounted at /api/dashboard
  ['GET', '/api/dashboard/stats', ['Admin', 'Production Manager']],
  ['GET', '/api/dashboard/profit-trend', ['Admin']],

  // profitRoutes, mounted at /api/profit
  ['GET', '/api/profit/:projectId', ['Admin']],
  ['POST', '/api/profit/:projectId', ['Admin']],
  ['DELETE', '/api/profit/:projectId', ['Admin']],

  // attendanceRoutes, mounted at /api/attendance
  ['GET', '/api/attendance/worker/:workerId', ['Admin', 'Production Manager']],
  ['POST', '/api/attendance', ['Admin', 'Production Manager']],
  ['PUT', '/api/attendance/:id', ['Admin', 'Production Manager']],
  ['DELETE', '/api/attendance/:id', ['Admin', 'Production Manager']],
  ['GET', '/api/attendance/:id', ['Admin', 'Production Manager']],

  // inventoryRoutes, mounted at /api/inventory
  ['GET', '/api/inventory', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['POST', '/api/inventory', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['GET', '/api/inventory/low-stock', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['GET', '/api/inventory/projects', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['GET', '/api/inventory/projects/:projectId/materials', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['GET', '/api/inventory/:id', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['PUT', '/api/inventory/:id', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['DELETE', '/api/inventory/:id', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['POST', '/api/inventory/variants/:variantId/adjust', ['Admin', 'Production Manager', 'Inventory Staff']],
  ['GET', '/api/inventory/variants/:variantId/movements', ['Admin', 'Production Manager', 'Inventory Staff']],
].map(([method, template, access]) => ({ method, template, access }));

async function call(method, path, user) {
  const req = request(app)[method.toLowerCase()](path);
  if (user) req.set('x-test-user', JSON.stringify(user));
  return req.send({});
}

describe('route authorization matrix', () => {
  for (const { method, template, access } of ROUTES) {
    if (access === SKIP) continue;
    const path = template.replace(/:[^/]+/g, '1');

    it(`${method} ${template}`, async () => {
      if (access === PUBLIC_NO_AUTH) {
        const anon = await call(method, path);
        expect(anon.status, 'anonymous').not.toBe(401);
        expect(anon.status, 'anonymous').not.toBe(403);
        for (const role of ROLES) {
          const res = await call(method, path, { user_id: 1, user_role: role });
          expect(res.status, role).not.toBe(401);
          expect(res.status, role).not.toBe(403);
        }
        return;
      }

      if (access === ANY_AUTH) {
        const anon = await call(method, path);
        expect(anon.status, 'anonymous').toBe(401);
        for (const role of ROLES) {
          const res = await call(method, path, { user_id: 1, user_role: role });
          expect(res.status, role).not.toBe(401);
          expect(res.status, role).not.toBe(403);
        }
        return;
      }

      if (access && access.kind === 'SELF_OR_ADMIN') {
        const { paramName, roles } = access;
        const anon = await call(method, path);
        expect(anon.status, 'anonymous').toBe(401);

        // The substituted id is "1" — a Worker whose own id matches it passes as themself.
        const selfRes = await call(method, path, { user_id: 1, user_role: 'Worker' });
        expect(selfRes.status, 'self').not.toBe(401);
        expect(selfRes.status, 'self').not.toBe(403);

        // A mismatched id (":paramName" -> "2", everything else -> "1"): a Worker who isn't self
        // and isn't in `roles` is forbidden; an allowed role passes regardless; anyone else is
        // forbidden too.
        const otherPath = template
          .replace(new RegExp(`:${paramName}\\b`), '2')
          .replace(/:[^/]+/g, '1');

        const mismatchRes = await call(method, otherPath, { user_id: 1, user_role: 'Worker' });
        expect(mismatchRes.status, 'mismatched, not self, not an allowed role').toBe(403);

        for (const role of roles) {
          const res = await call(method, otherPath, { user_id: 1, user_role: role });
          expect(res.status, role).not.toBe(401);
          expect(res.status, role).not.toBe(403);
        }

        const disallowed = ROLES.filter((r) => r !== 'Worker' && !roles.includes(r));
        for (const role of disallowed) {
          const res = await call(method, otherPath, { user_id: 1, user_role: role });
          expect(res.status, role).toBe(403);
        }
        return;
      }

      // Plain requireRole(...roles) allowlist.
      const roles = access;
      const anon = await call(method, path);
      expect(anon.status, 'anonymous').toBe(401);

      for (const role of ROLES) {
        const res = await call(method, path, { user_id: 1, user_role: role });
        if (roles.includes(role)) {
          expect(res.status, role).not.toBe(401);
          expect(res.status, role).not.toBe(403);
        } else {
          expect(res.status, role).toBe(403);
        }
      }
    });
  }
});

describe('route matrix completeness', () => {
  it('ROUTES matches every route actually mounted in app.js, in both directions', () => {
    const MOUNTS = [
      [userRoutes, '/api'],
      [projectRoutes, '/api/projects'],
      [jobOrderRoutes, '/api'],
      [productivityRoutes, '/api/productivity'],
      [adminNotifRoutes, '/api/notifications'],
      [adminDashboardRoutes, '/api/dashboard'],
      [profitRoutes, '/api/profit'],
      [attendanceRoutes, '/api/attendance'],
      [inventoryRoutes, '/api/inventory'],
    ];

    const live = new Set();
    for (const [router, prefix] of MOUNTS) {
      for (const layer of router.stack) {
        if (!layer.route) continue;
        const routePath = layer.route.path === '/' ? '' : layer.route.path;
        const full = `${prefix}${routePath}`;
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (enabled) live.add(`${method.toUpperCase()} ${full}`);
        }
      }
    }

    const declared = new Set(ROUTES.map((r) => `${r.method} ${r.template}`));

    // A route mounted in the app with no row above would otherwise ship with zero authorization
    // coverage; a row left behind for a route that no longer exists would silently stop meaning
    // anything. Both directions matter.
    expect([...live].filter((r) => !declared.has(r)), 'mounted but missing a ROUTES row').toEqual([]);
    expect([...declared].filter((r) => !live.has(r)), 'ROUTES row with no matching mounted route').toEqual([]);
  });
});

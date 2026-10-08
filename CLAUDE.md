# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

**Wooden Bizarre Management System** — an internal operations app for a custom woodworking /
furniture shop in the Philippines. It tracks a client order from intake, through staged
production and QA sign-off, to completion, plus per-project profitability, worker attendance,
and productivity. Single tenant, five roles (`Admin`, `Production Manager`, `Inventory Staff`,
`Quality Checker`, `Worker`), money in PHP (₱), business day in Asia/Manila time.

Full product behavior: [`docs/reference_md/PRD.md`](docs/reference_md/PRD.md).
Known issues and the improvement roadmap: [`docs/reference_md/ARCHITECTURE_REVIEW.md`](docs/reference_md/ARCHITECTURE_REVIEW.md).
UI rules and the mobile-responsiveness backlog (binding for new/changed UI work, Worker role is
the current priority): [`docs/design/DESIGN.md`](docs/design/DESIGN.md).

**Hosting target:** a single **Hostinger VPS, KVM 1 plan — 1 vCPU, 4 GB RAM, 50 GB NVMe**
(self-managed, root access, no managed database or load balancer). `docker-compose.yml` (repo
root) runs it as three containers — `db` (Postgres), `backend` (Express, migrates itself on
boot), `proxy` (Nginx — serves the built frontend and reverse-proxies `/api` to `backend`); a
fourth named volume, `uploads`, holds worker photo files (`backend/src/utils/photoStorage.js`) —
see `deploy/README.md` for first-time setup and `deploy/backup.sh`/`restore.sh` for the
`pg_dump` + uploads-tarball backup story (a VPS snapshot alone is not a substitute — see that
README for why). Currently **HTTP-only**: no domain is pointed at the VPS yet, so there's no TLS
(Let's Encrypt can't certify a bare IP) — `COOKIE_SECURE` in `.env` must stay `false` until that
changes, or sessions silently stop working. The single vCPU is the binding constraint, not RAM
or disk: extra app containers don't add real parallelism on one core, so "scaling" here mostly
means keeping the app efficient within that one core rather than fanning out replicas. See
`PRD.md` C.2 and `ARCHITECTURE_REVIEW.md` P1-1/P1-2/P1-10 for what this changes concretely.

## Repo layout — read this before running anything

```
docker-compose.yml      # 3 services: db, backend, proxy — see "Hosting target" above
.env.example             # what docker-compose.yml reads; copy to untracked .env
deploy/                  backup.sh, restore.sh, README.md
.github/workflows/ci.yml # backend install, frontend lint+build, docker build (both images)
backend/
  .gitignore
  src/                  # <-- the actual backend package root, NOT backend/
    package.json         (name: "src")
    package-lock.json
    node_modules/
    .env                  (untracked, required — see below; distinct from the root .env.example)
    app.js                # Express app: every middleware/route registration. Exports `app`
                           # (and `pool`) unstarted, so tests can import it without binding a port.
    server.js              # process entrypoint: app.listen() + SIGTERM/SIGINT drain — nothing else
    Dockerfile, docker-entrypoint.sh, .dockerignore
    config/db.js, logger.js   # logger.js: shared structured (pino) logger — see below
    migrations/           # node-pg-migrate; ALL schema changes land here, including the initial
                           # schema (a fresh DB is just `npm run migrate`, nothing else first)
    scripts/               createAdmin.js, migrate.js, backfillPhotos.js   # see below
    middleware/            auth.js, errorHandler.js
    errors/                 AppError.js
    utils/                  pagination.js   # parsePagination/buildMeta/splitCountedRows — see below
                            photoStorage.js  # worker-photo file storage — see below
    uploads/                (untracked; local-dev default for UPLOAD_DIR — see below)
    routes/ services/ models/
    tests/                 # vitest; services mocked via vi.mock, routes via supertest
frontend/
  package.json, vite.config.js, index.html
  Dockerfile, nginx.conf, .dockerignore
  .env                  (untracked, required — see below)
  src/
    App.jsx, Login.jsx, TempSignup.jsx, main.jsx
    Admin.jsx, ProductionManager.jsx, QualityChecker.jsx, Worker.jsx, Inventory.jsx   # role shells
    admin/ product_manager/ quality_checker/ worker/ globals/ auth-components/         # screens
    api/client.js                                                    # shared fetch wrapper
    context/    UserContext.js, ToastContext.js         # createContext() only — see below
    utils/      format.js                               # shared display formatters — see below
                resizeImage.js                          # client-side photo resize — see below
    hooks/      usePaginatedList.js                     # server-paginated list fetching — see below
    css/
    tests/                 # vitest setup (jsdom + @testing-library/react); test files sit next
                           # to the component they cover, e.g. globals/InventoryTable.test.jsx
docs/
  reference_md/   PRD.md, ARCHITECTURE_REVIEW.md
  design/         (empty)
```

**The backend package root is `backend/src/`, not `backend/`.** `package.json`,
`package-lock.json`, `node_modules/`, and `.env` all live in `backend/src/`. `.gitignore` sits
one level up at `backend/`. All `npm` commands run from `backend/src`.

There is **no root `package.json`** and no workspace tooling — nothing installs, builds, lints,
or runs both halves together. Treat this as two independent projects that happen to share a repo.

## Running the app

**Locally (no Docker), PowerShell, matching this environment:**

```powershell
# Backend (Express on $PORT, default 8080)
cd backend/src
npm install
npm start          # or `npm run dev` for nodemon auto-restart

# Frontend (Vite dev server on :5173)
cd frontend
npm install
npm run dev

# Database — a fresh DB is just this, nothing else first:
cd backend/src
npm run migrate          # applies every migration, including the initial schema
npm run migrate:down     # reverts the most recently applied migration
npm run migrate:create   # scaffolds a new migration file
```

**Via Docker Compose** (matches the deployed topology — one command builds and runs all three
services): `cp .env.example .env`, fill in real values, then `docker compose up -d --build`
from the repo root. See `deploy/README.md`.

**Tests** (Vitest in both halves — `npm test` from `backend/src` or `frontend`): backend tests
mock the model/service layers (`vi.mock`) and, for routes, use `supertest` against `app.js`'s
exported `app` with a stubbed `req.session` — no database or listening port needed.
`backend/src/tests/routeAuthorization.test.js` is the one exception: it imports the real `app.js`
(mocking only `config/db.js`/`express-session`/`connect-pg-simple` and automocking every service)
and drives every route with a real `supertest` request, checking 401/403 across all five roles —
see ARCHITECTURE_REVIEW.md item 19 and the "Route auth" rule below. Frontend tests mock
`api/client.js` and render with `@testing-library/react` (jsdom). Items 23 and 25 closed out
every screen with real logic that used to have no coverage. What's left untested is a short,
deliberate list, not a gap: the five role-shell files (routing only, tied to the declined
role-shell consolidation), the three one-line `*Notification.jsx` wrappers over the
already-tested `NotificationList.jsx`, `globals/InfoCard.jsx` (exercised indirectly by every
dashboard test), and `auth-components/ProtectedRoute.jsx` (covered by
`RoleBasedRedirect.test.jsx`) — see `ARCHITECTURE_REVIEW.md` items 23/25 and its P2 "No tests,
anywhere" item for the fuller history.

**Trap if you're migrating a pre-existing local database created before the initial-schema
migration existed** (i.e. one originally bootstrapped by hand from the now-deleted
`backend/index.sql`): `npm run migrate` will try to re-run the initial-schema migration and fail
on "already exists," since that database's schema predates this file. Mark it applied without
re-running its SQL by inserting a row directly —
`INSERT INTO pgmigrations (name, run_on) VALUES ('1700000000000_initial-schema', NOW())` — then
make sure the `id` ordering in `pgmigrations` matches name-timestamp order (delete and reinsert
all rows in that order if not), since `node-pg-migrate`'s `checkOrder` check compares the two
and refuses to run otherwise. A genuinely fresh database never hits this.

## Environment variables

Never commit any `.env`, and never echo its values into chat, logs, commit messages, or
documents (including this one). Three separate files, three separate purposes — don't conflate
them:

**`.env.example`** (repo root) — the contract for `docker-compose.yml`. Copy to a root `.env`
for the Docker Compose path; not read by `npm start`/`npm run dev` at all.

**`backend/src/.env`** (untracked, required for local non-Docker dev)
| Variable | Purpose |
|---|---|
| `SQL_USER`, `SQL_HOST`, `SQL_DB`, `SQL_PASS`, `SQL_PORT` | Postgres connection (read in `config/db.js`) |
| `SQL_CA_CERT` | Optional path to a private CA cert file, for a non-localhost Postgres that isn't signed by a public CA. Certificate verification is otherwise mandatory (`rejectUnauthorized: true`) for any non-localhost connection — see `ARCHITECTURE_REVIEW.md` P1-2. |
| `SECRET_KEY` | Session-cookie signing secret. **Required** — the server fails fast at startup (`process.exit(1)`) if unset; there is no fallback. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist |
| `COOKIE_SECURE` | `true` marks the session cookie HTTPS-only. Deliberately **not** tied to `NODE_ENV` (see P1-10) — leave `false` until the deployment actually terminates TLS somewhere, or the browser will never send the cookie back and every login will silently fail. |
| `PORT` | Server port (default `8080`) |
| `NODE_ENV` | Production-mode toggle. No longer affects the cookie flag (see `COOKIE_SECURE`) or the log format (see `LOG_LEVEL` — `pino`'s output is always structured JSON regardless of environment). |
| `LOG_LEVEL` | Optional — minimum level `config/logger.js`'s shared `pino` logger emits (default `'info'`). Forced to `'silent'` automatically under Vitest (`VITEST` is set by the test runner itself), regardless of this variable. |
| `UPLOAD_DIR` | Optional locally — worker photo files (`utils/photoStorage.js`). Defaults to `backend/src/uploads/` (gitignored) when unset. The Docker deployment sets it to `/data/uploads`, the mountpoint of the `uploads` named volume (`docker-compose.yml`). |

**`frontend/.env`** (untracked, required for local non-Docker dev)
| Variable | Purpose |
|---|---|
| `VITE_BACKEND_IP` | Backend base URL, concatenated onto every API call (`import.meta.env.VITE_BACKEND_IP + '/path'`). Baked into the build at `vite build` time — changing it requires a rebuild. Empty string in the Docker deployment (frontend and API are same-origin behind Nginx there); a real cross-origin URL (e.g. `http://localhost:8080`) for local dev, where the Vite dev server and Express run on different ports. |

**Traps worth knowing before you debug around them:**
- `ALLOWED_ORIGINS=""` is falsy in JS, so CORS silently falls back to `http://localhost:5173`
  even when the var is "set" to an empty string.

## Architecture conventions

Backend is a plain three-layer Express app: `routes/` → `services/` → `models/`, one file per
domain area (users, projects, job orders, attendance, profit, productivity, notifications,
dashboard). The layers have a strict, one-directional contract:

- **`routes/`** owns everything HTTP: status codes, response bodies, session/cookie mutation,
  and request-*shape* validation (is a required field present, is it the right type). Every route
  is an inline `async (req, res) => { ... }` handler with no `try/catch` — Express 5 forwards a
  rejected promise to `errorHandler` automatically, which is what turns a thrown error into a
  response.
- **`services/`** owns business logic: plain arguments in, plain data out. A service function
  must never reference `req`, `res`, or `next` — if it needs the caller's identity (e.g. a
  self-delete guard, a role check), the route reads it off `req.session.user` and passes it in as
  an argument. A service signals an expected failure (not found, forbidden, invalid state, a
  business-rule violation) by `throw new AppError(status, message[, body])`
  (`backend/src/errors/AppError.js`) — never by returning an error-shaped object, and never
  `catch(e){ return e; }` (see the rule below). `errorHandler.js` unwraps an `AppError` into
  exactly the response it specifies; anything else it treats as unexpected and logs server-side.
- **`models/`** owns all SQL and returns `result.rows`.

Every module `default`-exports an object of named functions — follow that shape for new files
rather than mixing named and default exports.

**List endpoints are paginated** (P1-3): a route parses `?page`/`?limit` with
`parsePagination(req.query)` (`backend/src/utils/pagination.js`) — it throws `AppError(400, ...)`
on garbage input and clamps an oversized `limit` down to `MAX_LIMIT` (200) rather than erroring.
Every list model takes `{ limit, offset, ...filters }`, adds `COUNT(*) OVER()` to its query, and
returns `{ rows, total }` via `splitCountedRows` from the same file; the route wraps that as
`{ success: true, data: rows, meta: buildMeta({ page, limit, total }) }`. A handful of
headcount/SKU-bounded lists (accounts, workers, productivity, inventory items) are capped-only —
no real paging UI on the frontend — and call `parsePagination(req.query, { defaultLimit:
MAX_LIMIT })` so an unpaginated caller still gets everything up to the cap instead of a silently
truncated 25-row page. New list endpoints should follow this pattern rather than returning a bare
array or an unbounded result set.

Any `ORDER BY` a paginated query relies on must be over a column (or column set) that's actually
unique — a nullable or non-unique sort column needs an explicit tiebreaker (e.g. `ORDER BY
due_date ASC, id ASC`), or `OFFSET` paging can duplicate or skip rows across pages. See the
`getAllJobOrders`/`getWorkerProductivity`/etc. models in `backend/src/models/` for the pattern.

Frontend is plain React + Vite, no TypeScript, no state-management library (`useState`/`useEffect`
+ one `UserContext` for the logged-in user, `context/UserContext.js`), CSS in plain global
stylesheets under `frontend/src/css/`. All API calls go through the shared client in
`frontend/src/api/client.js` (`api.get/post/put/delete`) — it always sends `credentials:
'include'` and prefixes `VITE_BACKEND_IP`. New fetch logic should use it rather than calling
`fetch` directly; the one intentional exception is `App.jsx`'s `/session-user` check, where a 401
is an expected "not logged in yet" state rather than an error.

Toast notifications go through `useToast()` (`frontend/src/context/ToastContext.js` +
`frontend/src/globals/ToastProvider.jsx`, mounted once at the app root in `App.jsx`) — call
`showToast(message, type)`, don't reintroduce a local `useState`/`setTimeout` toast per component
(P2; that pattern used to be copy-pasted into 12 components, none of which cleared its timer).
Confirmations go through the shared `globals/ConfirmModal.jsx` (pass `danger` for a destructive
action, e.g. a delete) — never `window.confirm`/`window.alert`, which `eslint.config.js`'s
`no-alert` rule fails CI on (ARCHITECTURE_REVIEW.md item 26). Fonts (Inter, Playfair Display) and
icons (Font Awesome, solid style only) are self-hosted npm packages imported from
`frontend/src/main.jsx`, not CDN `<link>`/`@import` references anywhere — not in `index.html`, not
in a stylesheet — `frontend/src/tests/thirdPartyAssets.test.js` fails if either comes back
(ARCHITECTURE_REVIEW.md items 27-28).
Display formatting (currency, project/worker IDs, dates, times) goes through the shared functions
in `frontend/src/utils/format.js` rather than a local inline formatter, so the same value renders
identically everywhere (P2; before this, the same project id rendered as `WB7`, `WB-7`, or
`WB-07` depending on the screen).

Colors come from the `:root` custom properties defined at the top of `frontend/src/css/globals.css`
(`--color-accent`, `--color-text`, `--color-danger`, etc. — see `docs/design/DESIGN.md` §4 for the
full list and what each means) — don't add a new hex literal or reuse an existing one directly; if
none of the tokens fit, that's a real new color and should become a new token, not a one-off
literal (DESIGN.md §3 rule 7). A table that needs a mobile-responsive layout uses the shared
`.wb-card-table` utility (same file) plus a `data-label` attribute on every non-`colspan` `<td>`,
rather than a bespoke per-table mobile conversion — see any of `globals/JobOrderDetails.jsx`,
`admin/Profit.jsx`, or `globals/InventoryTable.jsx` for the pattern, and
`frontend/src/tests/expectCardLabels.js` for how it's tested.

Notification read/dismissed state is per-user (FR-4): `notifications.target_role` gates who can
see a row at all (a real `user_role` value, checked in every query in
`backend/src/models/adminNotifModel.js`), and `notification_receipts` — not
`notifications.is_read` — records whether *this* caller has read or dismissed it, so one user
acting on a notification never affects anyone else's list. `notifications.target_user_id` (FR-9)
adds an optional per-user target alongside the role target, for a notification that belongs to
one specific caller (e.g. `jobOrderService.updateQAStatus`'s "your task was approved/repaired") —
when set, it's visible only to that user, not to Admin, since it's a personal message rather than
a role broadcast; a new notification should target a role via `target_role` or one user via
`target_user_id`, not both. `globals/NotificationProvider.jsx` (mounted in
`Admin.jsx`/`ProductionManager.jsx`/`QualityChecker.jsx`/`Worker.jsx` — every role but Inventory
Staff, which has no notification screen) polls the unread count for the navbar badge and to
refresh `globals/NotificationList.jsx` live; consume it via `useNotifications()`
(`frontend/src/context/NotificationContext.js`) rather than adding another poll loop.

A screen backed by a paged list endpoint uses `usePaginatedList(endpoint, { params, pageSize })`
(`frontend/src/hooks/usePaginatedList.js`) rather than its own `useState`/`useEffect` fetch —
it unwraps `{success, data, meta}`, resets to page 1 when `params` changes, debounces a `search`
param (~300ms) so typing doesn't fire a request per keystroke, and returns `setRows` for
optimistic single-row updates that don't change which rows belong on the current page (a bulk
action should call `refetch()` or change `page` instead, since either can change the total).
Render `<Pagination page={page} meta={meta} onChange={setPage} />`
(`frontend/src/globals/Pagination.jsx`) below the list — it renders nothing at one page or fewer.
A capped-only endpoint (no paging UI) is still consumed as `{success, data, meta}`, just without
the hook or the `<Pagination>` component.

## Non-negotiable rules for new code

- **All SQL goes through `query()` / `getClient()`** from `backend/src/config/db.js`, using
  `$1..$n` placeholders. The codebase currently has **zero** SQL string interpolation — keep it
  that way; never build a query string with template literals or concatenation.
- **Multi-statement writes use a transaction**: `getClient()`, then `BEGIN` / `COMMIT` /
  `ROLLBACK` with `finally { client.release() }`. Reference implementation:
  `createProjectWithVariables` in `backend/src/models/projectModel.js`.
- **Never `catch(e){ return e; }`.** Returning an `Error` object as if it were data is an existing
  bug pattern (e.g. `userModel.js`) that turns real failures into false successes on the client.
  Throw, and let the caller handle or propagate it.
- **Services never touch `req`, `res`, or `next`, and signal failure by throwing `AppError`.**
  See "Architecture conventions" above. This is what keeps `services/` testable without an
  Express request and keeps every response body constructed in exactly one place (the route).
- **Never log request bodies, full user rows, or financial payloads.** `userRoutes.js`'s login
  route used to log the bcrypt hash on every attempt (P0-7) — already fixed, but don't repeat
  that shape. A log call should carry an event description and an id, not a raw object;
  `config/logger.js`'s `redact` config is defense-in-depth on top of this, not a substitute for it.
- **Logging goes through `req.log` (inside a route or `errorHandler.js`, where a request is in
  scope — this is a structured, pre-correlated child logger, courtesy of `app.js`'s `pino-http`
  middleware) or the shared `logger` from `backend/src/config/logger.js` (everywhere else:
  services/models can't touch `req`, per the rule above; neither can `server.js`/`config/db.js`'s
  startup/shutdown code, which runs outside any request). Never plain `console.log`/
  `console.error` in application code — the two exceptions are `scripts/migrate.js` and
  `scripts/createAdmin.js`, one-shot CLI tools a human runs and reads directly, documented in
  their own header comments.
- **Money is `numeric(12,2)`.** `net_profit` and `total_expenses` on `project_profit` are
  **generated stored columns** — computed by Postgres from the other columns. Never recompute
  profit in JS; read the generated column.
- **The shop's working hours (FR-5) live in one place**: `WORKING_HOURS`-derived constants at the
  top of `backend/src/services/attendanceService.js` (shift 08:30–17:00, a 15-minute grace period,
  lunch 12:00–13:00 excluded from worked time, `Half-day` under 4 worked hours). Change the rule
  there, not in the model or the migration that backfilled existing rows (that migration inlines
  the same formula as raw SQL deliberately — see its header comment). `overtime_minutes` is not
  computed yet, pending the client's overtime rule.
- **New comments in English.** Existing Tagalog comments in the codebase are being left as-is —
  don't rewrite them as a side effect of an unrelated change, and don't add new Tagalog comments.
- **Route auth**: real server-side authorization exists (`backend/src/middleware/auth.js` —
  `requireAuth`, `requireRole(...roles)`, `requireSelfOrRole(paramName, ...roles)`), applied
  per-route inside each router file. Any new route needs an explicit role check from this
  middleware — there is no blanket `app.use()` gate, so an unguarded route is a live hole, not a
  gap waiting to be closed. It also needs a row in `backend/src/tests/routeAuthorization.test.js`'s
  `ROUTES` table (see ARCHITECTURE_REVIEW.md item 19) — that file's completeness guard walks every
  router's real route table and fails CI if a mounted route has no matching row, or a row no
  longer matches a real route.
- **Every backend route lives under `/api`** (as of P1-10) — mount new routers with
  `app.use('/api/...', ...)` in `server.js`, not at root. This is what lets the Nginx reverse
  proxy (`frontend/nginx.conf`) use one general `/api/` rule instead of a growing list of
  root-level exceptions; a route added outside `/api` won't be reachable through the deployed
  stack at all. `/healthz`/`/readyz` are the one deliberate exception (infrastructure endpoints,
  each with its own explicit Nginx `location` block).
- **Schema changes go through `backend/src/migrations/`** (node-pg-migrate) — there is no other
  path; the historical `backend/index.sql` bootstrap has been folded into the first migration
  and deleted. Create a migration with `npm run migrate:create -- <name>` from `backend/src`,
  give it a real `down`, and see the existing migrations for the project's conventions (e.g. a
  preflight check before adding a `UNIQUE` constraint on data that might already violate it).
- **User-uploaded files go through `backend/src/utils/photoStorage.js`**, never into a database
  column (see PRD.md C.2 "Storage discipline" and `worker_details.photo_path`) — decode/validate
  with `decodePhotoDataUrl`, write with `savePhoto`, remove with `removePhoto`. A file is served
  by resolving an id to a checked, on-disk path (`GET /api/workers/:id/photo`), never by trusting
  a client-supplied filename or path directly.

## Known-broken / in-flight — don't mistake these for your own changes

- **No TLS yet.** The Docker Compose deployment is HTTP-only until a domain is pointed at the
  VPS — see "Hosting target" above. Don't set `COOKIE_SECURE=true` before that's actually true.
- **Docker builds are unverified outside CI.** The Dockerfiles/`docker-compose.yml` were written
  and reviewed on a machine without Docker installed — `.github/workflows/ci.yml`'s
  `docker-build` job is the first place they're actually built. Watch that Actions run before
  trusting a fresh image.
P0 (authorization, session-secret fail-fast, rate limiting), P1a (session store, connection pool
limits, indexes, transactions, uniqueness constraints, `timestamptz`, baseline production
middleware), P1-10 (Docker Compose deployment, `/api` route namespace, backups, CI), the P2
routes/services refactor (`controllers/` → `services/`, `AppError`), P1-11 (Inventory:
real `/api/inventory` backend with a stock-movement audit trail, replacing the old
`localStorage`-only screen), a P2 frontend-consolidation pass (shared `ToastProvider`/
`useToast()`, shared `utils/format.js` display formatters, hoisting `Attendance.jsx`'s five
nested components to module scope, merging the three near-identical notification components into
one `NotificationList`, and fixing every frontend lint error so `npm run lint` is now a real CI
gate), and P1-3 (pagination — every list endpoint now takes `?page`/`?limit`, with server-side
search/filter/sort replacing what 8 screens used to do client-side over an unbounded result set)
are complete — see `ARCHITECTURE_REVIEW.md` for exactly what each covered.

Full findings, severity, and fix order live in `docs/reference_md/ARCHITECTURE_REVIEW.md`.

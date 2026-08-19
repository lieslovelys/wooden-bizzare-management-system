# Architecture Review — Wooden Bizarre Management System

**Purpose:** a prioritized, reviewable backlog of the system-design, security, and scalability
work needed to take this app from its current state to something that safely serves
**50–300 concurrent users** on a **single Hostinger VPS, KVM 1 plan (1 vCPU, 4 GB RAM, 50 GB
NVMe)**, run via Docker Compose. Ordered severity-first (P0 → P1 → P2). No code has been changed
as part of producing this document — see [`PRD.md`](./PRD.md) for the target state each item is
working toward.

The confirmed plan changes how several items below should be read. **One vCPU is the binding
constraint, not RAM or disk**: it rules out getting more throughput by running additional app
containers (P1-1, P1-10 below), and it means "50–300 concurrent users" has to be understood as
concurrent *sessions*, not concurrent in-flight requests — see PRD.md C.2 for that distinction and
the load-testing caveat attached to it. **4 GB RAM is shared by Node, Postgres, and Nginx** on the
same box, so pool sizes and Postgres `max_connections` need deliberate, conservative values rather
than either library's defaults (P1-2). **50 GB NVMe** is comfortable for the relational data but
not for unbounded image blobs stored inline in the database (flagged under P1-2 and P1-11-adjacent
below) or for on-box backup retention (P1-10).

Each item states what's wrong, why it matters, the affected file(s), and the shape of the fix, so
it can be approved and executed independently.

---

## P0 — Security & correctness blockers

**Status: ✅ Resolved.** All eight items below (and the P0 prerequisite) have been implemented
and verified — see `middleware/auth.js`, `middleware/errorHandler.js`,
`scripts/createAdmin.js`, and the per-route role checks now applied throughout
`backend/src/routes/`. The descriptions below are kept as the historical record of what was
wrong and why; they no longer describe the current state of the code.

These are exploitable today, remotely, without any credentials. Fix before anything else.

### P0-1. Unauthenticated signup accepts an arbitrary role
`POST /signup` (`backend/src/routes/userRoutes.js`) takes `userRole` directly from the request
body with no authentication check. Anyone who can reach the server can create an `Admin` account
with a single POST. The public route `/protoacc` (`frontend/src/App.jsx`) is a live, unauthenticated
UI for exactly this — a `<select>` that defaults to `Admin`.

**Fix nuance:** the form component (`TempSignup`) is not dead code to delete — it's also rendered
inside the real Admin "Account Creation" screen (`admin/CreateAccount.jsx`). The fix is: remove the
public `/protoacc` route, put `POST /signup` behind admin-only auth, and constrain `userRole` to a
server-side whitelist — not delete the component.

### P0-2. No authorization middleware on any route
There is no `requireAuth` / `requireRole` anywhere in the backend. `req.session.user` is read in
exactly one route (`GET /session-user`). Every other route — roughly 20 mutating endpoints plus
every sensitive read — is reachable by an anonymous HTTP client. This includes:
- `DELETE /users/:id` — deletes any account, including admins, and **cascades away that worker's
  entire attendance and job-assignment history** (both are `ON DELETE CASCADE`, no soft delete,
  no audit table).
- `GET /workers` — worker names, contact numbers, daily wages, and photos, world-readable.
- `GET /api/profit/:projectId`, `GET /api/dashboard/stats` — full company financials, world-readable.

**Fix:** a single `requireAuth` (and `requireRole(...)`) middleware applied per-route or per-router,
checked against `req.session.user`, before any handler runs.

### P0-3. Workers can self-approve their own QA
`PUT /api/assignments/:assignmentId/status` has no auth and no ownership/role check. A worker can
set their own assignment straight to `Approved`, bypassing the Quality Checker entirely — the
QA workflow the product exists around has no server-side enforcement at all. Fixed by P0-2 plus an
explicit state-machine check (see P1 list) so `Assigned`/`Repair` workers can only ever set
`For QA`, and only a Quality Checker/Admin/Production Manager account can set `Approved`/`Repair`.

### P0-4. Forgeable session secret
`server.js`:
```js
secret: process.env.SECRET_KEY || 'default_secret_key',
```
If `SECRET_KEY` is ever unset, every session cookie is signed with a constant string that is
public in this repository — trivial to forge a session for any user, including Admin. **Fix:**
fail fast at boot (throw / `process.exit(1)`) if `SECRET_KEY` is missing, rather than silently
falling back.

### P0-5. Login crashes and leaks internals on an unknown username
`userController.js` login logic:
```js
const result = await User.getUserByUsername(username);
const matched = await bcrypt.compare(password, result[0].user_password);
```
For a username that doesn't exist, `result` is `[]`, so `result[0]` is `undefined` and the next
line throws. Combined with `userModel.js`'s `catch(e){ return e; }` pattern, the thrown error
propagates as data, and the route ends up returning **HTTP 500 with a stack trace** for an unknown
username, vs. HTTP 200 `{err:true}` for a known username with a wrong password — a direct response
oracle for username enumeration. **Fix:** check `result.length === 0` explicitly and return a
uniform 401 for both "unknown user" and "wrong password," with no crash path.

### P0-6. Raw database errors returned to unauthenticated callers
`userRoutes.js`, signup failure path:
```js
res.status(404).send({message: 'Error creating user', body: e});
```
`e` is the raw `pg` error object, whose enumerable properties (`code`, `detail`, `table`,
`constraint`, `column`) are sent straight to the client — schema disclosure to anyone. The same
signup path also reports **HTTP 200 on genuine failure** in some cases (`userModel.js` swallows the
error and returns it as if it were a successful result row). **Fix:** centralized error-handling
middleware that logs the real error server-side and returns a sanitized generic message; audit
every `catch(e){ return e; }` in the model layer (see P2) since each one is a variant of this bug.

### P0-7. Credentials and financial payloads written to logs
`userController.js`, login handler: `console.log(result)` prints the **full user row, including the
bcrypt password hash,** on every login attempt. Similar `console.log`s of full request bodies exist
in the profit and project controllers. On any platform that aggregates stdout (which is most VPS/
Docker setups), this means password hashes and client financials sit in plaintext logs. **Fix:**
remove these logs entirely, or replace with structured logs that name the event without dumping the
object.

### P0-8. No rate limiting on login
`POST /login` is unthrottled. Combined with bcrypt cost 10, this is both a credential-stuffing
vector and a cheap CPU-exhaustion DoS vector (an attacker can force the server to do real bcrypt
work per request, unbounded). **Fix:** `express-rate-limit` (or equivalent) on `/login` at minimum;
consider it shop-wide once P0-2 lands.

---

## P0 prerequisite — the frontend cannot survive the P0 fixes as written

**Status: ✅ Resolved.** The shared client (`frontend/src/api/client.js`) exists and all 61
call sites across 26 files are migrated to it — confirmed by re-grepping `frontend/src` for
`fetch(`, which now only matches `api/client.js` itself and the one deliberate exception in
`App.jsx` (`/session-user`, where a 401 is an expected "not logged in yet" state, not an
error). The `QualityCheckerNotification.jsx` base-URL bug described below was fixed as part of
the migration.

This isn't a separate severity tier so much as a sequencing fact: **fixing P0-2 will break the
app** unless this lands first or alongside it.

There are **61 `fetch` calls across 26 frontend files, and only 3 of them send
`credentials: 'include'`** (`App.jsx`, `Login.jsx`, `globals/Logout.jsx`). The other 58 send no
session cookie at all. They currently work purely *because* there is no server-side auth to fail
against (P0-2) and because production happens to be same-origin (the backend serves the built
frontend). The moment auth middleware is added, all 58 of those calls start returning 401.

**Fix, and do it first:** introduce a single shared API client — one module wrapping `fetch`,
prefixing `VITE_BACKEND_IP`, always sending `credentials: 'include'`, and centralizing response/
error handling (checking `response.ok`, surfacing a consistent error shape). Migrate all 61 call
sites to it. This is not a P2 cleanup item — it is a hard, ordered prerequisite for P0-2.

While migrating, also fix the one concretely broken call site this centralization will surface
immediately: `quality_checker/QualityCheckerNotification.jsx` omits the base URL on 4 of its 5
fetches (delete, clear-all, and both mark-read paths), so those requests currently hit the SPA
catch-all instead of the API, return `index.html` with HTTP 200, and the UI reports success while
the database is never touched. It is the clearest existing proof of why inline, unwrapped fetch
calls are unsafe to keep.

---

## P1 — Multi-user & scalability

Needed to actually hold up under 50–300 concurrent users.

**Status of the "P1a" backend-and-schema hardening subset (P1-1, P1-2, P1-4 through P1-9):
✅ Resolved.** Landed as one pass, with migration tooling (`node-pg-migrate`, pulled forward
from P1-10) added as a prerequisite since four of these items needed schema changes and
`index.sql` has no migration story of its own. See `backend/src/migrations/` for the schema
changes and the per-item notes below for what changed and where. **Still outstanding:** P1-3
(pagination), P1-10 (the deployment rewrite proper — Docker Compose, `.env.example`, CI; the
migration-tooling slice is done), and P1-11 (Inventory backend) are each their own separate
pass and are not part of this update.

### P1-1. Session store cannot survive more than one process
**Status: ✅ Resolved** — `server.js` now uses `connect-pg-simple` backed by the `session` table
(`migrations/…_create-session-table.js`), reusing the pool exported from `config/db.js`.

`express-session` is configured with no `store:` option, so it uses the default in-memory
`MemoryStore` (`server.js`). Consequences: every deploy/restart logs every user out, and memory
grows unbounded with no session GC. On the confirmed 1-vCPU KVM 1 plan, the classic reason to fix
this — running multiple app containers to use more cores — doesn't apply; a second container on
one vCPU adds scheduling overhead, not throughput. The reasons that still make this a P1 here are:
every deploy currently logs everyone out (real, frequent disruption for shop staff mid-shift), the
unbounded memory growth is a slow leak on a box with only 4 GB total, and it's a one-time fix that
keeps the door open if the plan is ever upgraded to a multi-core tier. **Fix:** `connect-pg-simple`
backed by a session table in the same Postgres instance — no Redis needed at this scale, and it
avoids adding a second service to a box that's already tight on RAM.

### P1-2. No connection-pool limits or timeouts
**Status: ✅ Resolved** — `config/db.js` now sets `max: 10`, `idleTimeoutMillis`,
`connectionTimeoutMillis`, `statement_timeout`, and `rejectUnauthorized: true` (with an
optional `SQL_CA_CERT` for a private CA). The `Postgres max_connections` tuning this item also
recommends is a deployment-time (P1-10) configuration step, not an application code change, and
remains outstanding.

`config/db.js`'s `pg.Pool` sets only `user/host/database/password/port`. No `max`,
`idleTimeoutMillis`, `connectionTimeoutMillis`, or `statement_timeout`. Under load, requests queue
indefinitely instead of failing fast, and a single slow query can starve the whole pool. Also,
`ssl: { rejectUnauthorized: false }` for any non-localhost host disables certificate verification
against the production database — a MITM exposure on the DB connection. **Fix:** explicit `max`
sized against 4 GB of total RAM shared with Postgres and Nginx on the same box — a small pool
(roughly `max: 10`) is appropriate for a single app container, paired with a Postgres
`max_connections` turned down from its default of 100 to something in the 20–30 range (each
Postgres backend process has a real, non-trivial memory cost; left at the default, Postgres alone
can reserve more RAM than this plan comfortably has to spare). Add sane
`idleTimeoutMillis`/`connectionTimeoutMillis`, and either a real CA cert or a documented reason for
skipping verification.

### P1-3. No pagination on any list endpoint
Every list route (`/users`, `/workers`, `/api/projects`, `/api/projects/history`,
`/api/job-orders`, `/api/notifications`, `/api/productivity`, `/api/qa/tasks`,
`/api/attendance/worker/:id`) returns its entire table, unbounded. `GET /workers` additionally
ships base64-encoded photos in the list payload. At even moderate row counts this becomes the
dominant cost on every screen load. **Fix:** `limit`/`offset` (or cursor) on every list endpoint,
with the frontend updated to request pages instead of filtering full result sets client-side (the
current pattern on effectively every list screen).

### P1-4. Missing indexes on nearly every foreign key and filter column
**Status: ✅ Resolved** — indexes added via `migrations/…_add-indexes.js`; the `ILIKE` cast
fixed in `models/jobOrderModel.js` (`WHERE ja.status = 'For QA'`). `users.username`,
`worker_details.user_id`, and `project_profit.project_id` are deliberately not indexed by this
migration — their P1-7 `UNIQUE` constraints create the index instead.

Only `attendance` has indexes (`date`, `day_of_week`, `status`, `worker_id`). Unindexed and
actively queried: `users.username` (every login), `users.user_role`, `worker_details.user_id`,
`job_assignments.project_id`/`worker_id`/`status`, `projects.status`/`due_date`/`created_at`,
`project_profit.project_id`, `project_expense_items.profit_id`, `project_variables.project_id`,
`notifications.created_at`. One query additionally defeats indexing outright:
`WHERE ja.status::text ILIKE 'For QA'` casts an enum column to text before comparing, so no index
on `status` could ever be used even if one existed. **Fix:** add indexes on every FK and on every
column that appears in a `WHERE`/`ORDER BY` in the model layer; rewrite the `ILIKE` comparison as a
plain enum equality check.

### P1-5. Missing transactions around multi-statement writes
**Status: ✅ Resolved** — both wrapped in `getClient()` + `BEGIN`/`COMMIT`/`ROLLBACK`. As a
deliberate accompanying behavior fix, `createJobAssignment`'s project-status update now guards
with `AND status IS DISTINCT FROM 'Completed'` — previously unconditional, so assigning work to
a finished project silently reopened it. `addWorker` now calls a new
`userModel.createWorkerWithDetails`, doing both inserts in one transaction.

`createJobAssignment` (`jobOrderModel.js`) inserts an assignment, then issues a *separate* query to
flip the project's status — two independent connections, no transaction, so a failure on the
second leaves an assignment on a project still marked `Pending`. `addWorker`
(`userController.js`) creates the user row, then the worker-details row, as two independent
queries — a failure on the second leaves an orphaned login with no worker profile. **Fix:** wrap
both in `getClient()` + `BEGIN`/`COMMIT`/`ROLLBACK`, matching the pattern already used correctly in
`projectModel.js`'s `createProjectWithVariables`.

### P1-6. Sequential-await round trips where one query (or `Promise.all`) would do
**Status: ✅ Resolved**, with one deliberate deviation from the suggested fix — the
dashboard-stats query is combined into one query with scalar subselects rather than
`Promise.all`, since on a single vCPU with a small pool (P1-2) one round trip on one connection
beats three concurrent ones; `Promise.all` is the right call on a multi-core box, not this one.
`upsertProfit` and the `project_variables` insert paths (`createProjectWithVariables`,
`updateProject`) now use a single multi-row `unnest()` insert instead of a per-row loop, and
`upsertProfit` no longer re-`SELECT`s after `COMMIT`. Delete-then-reinsert is kept rather than
diffed, deliberately: `frontend/src/admin/Profit.jsx` builds new expense rows client-side with
no id, so there is no stable identity to diff against without also changing the client
contract (P2 API-envelope work).

The dashboard-stats query issues three independent `COUNT`/`SUM` queries sequentially instead of in
parallel or combined; the profit model re-`SELECT`s expense items after `COMMIT` when it already
has the data it just wrote; several project/profit paths delete-all-then-loop-insert child rows
(variables, expense items) on every edit rather than diffing. **Fix:** `Promise.all` for genuinely
independent reads, combine what can be one query, and replace delete-then-reinsert with an upsert/
diff where the child-row identity matters.

### P1-7. Missing uniqueness constraints
**Status: ✅ Resolved** — added via `migrations/…_add-uniqueness-constraints.js`, each preceded
by a preflight `DO` block that names any existing duplicates and aborts rather than letting a
bare constraint-violation error surface (the migration can't safely guess which duplicate row
to keep). `userModel.updateWorkerDetails` now does a single `INSERT ... ON CONFLICT (user_id)
DO UPDATE` instead of a `SELECT`-then-branch; the now-redundant `LIMIT 1` workarounds in
`profitModel.js` and `attendanceModel.js` were removed.

`users.username` has no `UNIQUE` constraint — two accounts can share a username, and login
(`SELECT * ... WHERE username = $1`, then blindly `rows[0]`) becomes non-deterministic when that
happens. `worker_details.user_id` and `project_profit.project_id` are both meant to be 1:1 with
their parent but aren't constrained as such — both are currently papered over in application code
with `LIMIT 1`. **Fix:** add the `UNIQUE` constraints and let the database enforce the invariant the
code already assumes.

### P1-8. Missing baseline production middleware
**Status: ✅ Resolved** — `server.js` now runs `helmet` (CSP rebuilt without
`script-src 'unsafe-eval'`; `style-src 'unsafe-inline'` is kept deliberately, since the
frontend relies on it — removing that dependency is a separate P2 frontend refactor),
`compression`, `morgan`, `app.set('trust proxy', 1)`, `GET /healthz`/`GET /readyz`, and a
`SIGTERM`/`SIGINT` graceful-shutdown handler that drains requests and closes the pool.

No `helmet`, no `express-rate-limit` (beyond the login-specific fix in P0-8), no `compression`, no
centralized error-handling middleware, no request logging, no health/readiness endpoint, no
graceful shutdown (`SIGTERM` handler closing the pool and draining requests). The hand-rolled CSP
includes `script-src 'unsafe-inline' 'unsafe-eval'`, which largely defeats its purpose. `proxy: true`
is set on the session config but `app.set('trust proxy', 1)` is never called, so `secure` cookie
behavior behind a reverse proxy is unreliable. **Fix:** add the standard middleware stack; replace
the hand-rolled CSP with `helmet`'s CSP builder without the unsafe directives; add `trust proxy`.

### P1-9. Timestamps without timezone, against an Asia/Manila business day
**Status: ✅ Resolved** — converted to `timestamptz` via
`migrations/…_convert-timestamps-to-timestamptz.js`, interpreting existing naive values as
Asia/Manila wall-clock time (confirmed assumption: the migrated database held only
locally-written dev data — re-running this migration against UTC-server-written history would
shift every timestamp by 8 hours, so don't copy it blindly onto a different database without
re-checking that assumption). `config/db.js` sets the pool's session timezone
(`-c timezone=Asia/Manila`); day-boundary–deriving queries (`date_completed`,
`date_submitted`, the monthly-profit windows) were audited to use an explicit
`AT TIME ZONE 'Asia/Manila'` rather than relying on that session default implicitly. Calendar
`date` columns (`attendance.date`, due dates, etc.) were deliberately left as `date`.

Every timestamp column (`attendance.created_at`/`updated_at`, `projects.created_at`,
`job_assignments.date_completed`, `project_profit.updated_at`) is `timestamp` rather than
`timestamptz`; `users.created_at` is a plain `date`. Deployed on a Hostinger VPS whose OS clock is
typically UTC by default, against a business that operates in UTC+8, "today" as computed by the
database and "today" as
experienced by shop staff can disagree near midnight. **Fix:** migrate to `timestamptz`, set an
explicit application-level timezone policy (store UTC, render Asia/Manila), and audit any place
that currently derives a "day" boundary (attendance, in particular).

### P1-10. Deployment is currently non-functional and undocumented
**Status: ✅ Resolved.** `docker-compose.yml` (repo root) runs `db`/`backend`/`proxy` per the
fix direction below. `backend/index.sql` was folded into `backend/src/migrations/1700000000000_
initial-schema.js` and deleted — `npm run migrate` alone now builds a fresh database, no
separate bootstrap step first (confirmed by diffing a scratch database built purely from the
migration chain against the existing dev database: identical columns, indexes, constraints, and
views). The `server.js` static-serving/SPA-catch-all code that used to serve a nonexistent
`backend/src/dist` is deleted outright — Nginx (`frontend/nginx.conf`) now owns that job
entirely, along with reverse-proxying `/api/*` to `backend`. `.env.example` (root) documents
every `docker-compose.yml` variable; `deploy/backup.sh`/`restore.sh` cover the `pg_dump` story;
`.github/workflows/ci.yml` builds both Docker images (the only place they're verified — no
Docker was available in the sandbox this was implemented in) plus frontend lint/build.

**Deliberately still open, by confirmed decision:** no TLS (`COOKIE_SECURE=false` until a domain
exists and Certbot is wired up — see `deploy/README.md`); no automated off-box backup sync
(`rclone`/`rsync`, documented but not implemented); actual VPS provisioning (installing Docker,
firewall rules, DNS) hasn't happened — this item covers making the stack deployable, not
deploying it.

**A real bug found and fixed along the way:** `server.js` used to set
`cookie.secure: process.env.NODE_ENV === 'production'`. The backend's Docker image sets
`NODE_ENV=production` (for `morgan`'s log format), which — combined with the HTTP-only interim
deployment above — would have silently broken every login (a `secure` cookie is never sent by
a browser over plain HTTP). Decoupled into its own `COOKIE_SECURE` variable, defaulting to
`false`.

**Also resolved as part of this work, pulled forward from the P2 list below:** the
route-namespace inconsistency (auth/account routes were mounted at `/`, everything else under
`/api`) — see that P2 bullet.

The rest of this section is kept as the historical record of what was wrong.

- The SPA catch-all in `server.js` serves `backend/src/dist`, a directory that does not exist in
  this repo — every non-API `GET` currently returns a 500. Git history shows build output was
  committed directly into that path at least five separate times as a substitute for a real build
  step, and `backend/.gitignore` still doesn't exclude `dist`, so it will happen again.
- `setup.sh`, the repo's only prior provisioning script, is deleted from the working tree and — as
  written — could never have produced a working deployment even if restored: it's adapted from an
  unrelated project, writes `.env` variable names the application doesn't read (`DB_USER` instead of
  `SQL_USER`, etc.), never writes `SECRET_KEY` or `ALLOWED_ORIGINS`, and configures an Nginx
  `proxy_pass` that strips the `/api` prefix Express routes are mounted *with*.
- No migration tooling; `index.sql` is a single non-idempotent script (`CREATE TYPE` lacks
  `IF NOT EXISTS`), and there was never a redeploy path that re-applied it — schema drift between
  environments is effectively guaranteed over time.
- No `.env.example`, no CI, and deploys used `npm install` rather than `npm ci`, so the committed
  lockfiles were never actually honored in production.

**Fix (per the confirmed direction):** replace bare-metal provisioning with **Docker Compose on the
Hostinger KVM 1 VPS (1 vCPU, 4 GB RAM, 50 GB NVMe)** — one app container, Postgres, and an Nginx
reverse-proxy/static-file service, each with a `Dockerfile` and defined healthchecks; a migration
tool (even a lightweight one like `node-pg-migrate`) driving schema changes as part of the deploy;
`.env.example` documenting every variable with no real values; CI running lint/build/tests (once
tests exist, P2) before a deploy is possible. Hostinger offers VPS OS templates with Docker
pre-installed, which removes the Docker-engine-install step from provisioning but doesn't replace
any of the above — Postgres, backups, TLS (e.g. Certbot against the VPS's own domain/IP), and the
reverse proxy are still entirely the app's own compose stack to define and operate.

**Sizing note specific to this plan:** with one vCPU, resist the urge to add app-container
replicas or a PM2 cluster for throughput — there's no second core for them to run on, and the
added memory footprint on a 4 GB box is a net loss. A short-lived second container during a
blue/green deploy handoff is fine; a standing fleet is not. If load testing later shows the app
genuinely needs more than one core, that's a plan-upgrade decision (Hostinger's KVM 2 and above),
not something to work around in Compose config.

### P1-11. Inventory is not multi-user at all
As documented in the PRD (B.6): the Inventory module persists to `localStorage`, so it isn't
"slow under load," it simply doesn't work for more than one person or one device. Building the
backend for it (API, schema already exists, add stock-movement/audit rows) is both a functional
requirement (PRD FR-3) and a scalability item — it's the one screen in the product with zero
server involvement today.

---

## P2 — Maintainability & developer experience

Not urgent, but each of these increases the cost of every future change until addressed.

- **No input validation library.** Request bodies are trusted almost everywhere; invalid enum
  values and non-numeric `:id` path params currently surface as opaque 500s instead of 400s.
  Introduce `zod` or `express-validator` and validate at the route boundary.
- **Inconsistent API contract.** Four different response envelope shapes (`{success, data}`, bare
  arrays, `{err, message}`, `{message, body}`) still stand — not addressed by this pass, since
  fixing it means changing every response shape's consumer, a materially bigger diff than the
  route-namespace piece below. `GET /logout` still mutates state.
  ~~auth/account routes mounted at `/` instead of `/api`~~ — **resolved as part of P1-10**:
  `userRoutes` now mounts at `/api` (`server.js`), with the ~7 frontend call sites updated to
  match. ~~three overlapping "workers" endpoints~~ — down to two intentionally distinct ones:
  `GET /api/workers` (account management, `userController.getWorkers`, `{success,data}`) and
  `GET /api/assignable-workers` (job-order assignment dropdown,
  `jobOrderController.getWorkersList`, bare array — renamed from `/workers` during the P1-10
  route move specifically because both routes ended up at the same path once `userRoutes` moved
  under `/api`, and `userRoutes` being mounted first would have silently shadowed the other,
  breaking `globals/JobOrderDetails.jsx`'s worker-assignment dropdown; caught by enumerating
  every registered route programmatically rather than by inspection alone). The dead duplicate
  registration was already removed in the P0 pass.
- **`showToast` reimplemented in 11 components**, each with the identical 3-second timer and
  near-identical markup; extract to one provider/hook.
- **No cleanup in any `useEffect`.** No component cancels an in-flight fetch on unmount and no
  component clears its own timers — 11 toast timers and several navigation-delay timers are all
  currently uncancelled, which can call `setState` on an unmounted component and, in at least one
  screen (`globals/Attendance.jsx`), causes a worse problem: five sub-components are defined
  *inside* that component's render body, so they remount on every parent re-render, discarding
  any half-typed form input in the attendance modal on every unrelated state change.
- **Near-identical components maintained as separate copies**: `AdminNotification`,
  `PMNotification`, and `QualityCheckerNotification` are ~90% line-for-line identical (the base-URL
  bug fixed under the P0 prerequisite exists in exactly one of the three copies precisely because
  they're forks, not one parameterized component). Same pattern for the five role-shell files
  (tabs array + `Navbar` + `Routes`) and the Create/Edit project and worker forms. Consolidate once
  the API-client migration is done and the components are already being touched.
- **Client-side derived business logic duplicated with drift**: three different currency-formatting
  implementations and four different project-ID display formats currently coexist, so the same
  project can render as `WB7`, `WB-7`, or `WB-07` depending which screen you're on. Centralize as
  shared formatters.
- **No tests, anywhere**, for either project — no test runner is even installed.
  ~~No CI~~ — **resolved**: `.github/workflows/ci.yml` (added in P1-10) runs backend install,
  frontend lint+build, and builds both Docker images; extend it once real tests exist.
  ~~No `engines`/`.nvmrc`~~ — **resolved**: both `package.json`s pin `"node": ">=24"`, matching
  the Dockerfiles; root `.nvmrc` added. ~~`nodemon` in `dependencies`~~ — **resolved** (P1a).
  `frontend/README.md` is still the unmodified Vite template.
- **Two unused database views** (`attendance_summary`, `project_profit_summary`) — either wire them
  into the dashboard/reporting screens they were clearly built for, or drop them.
- **~10 pre-existing frontend lint errors**, found when wiring up CI in the P1-10 pass (not fixed
  there — none of them are in files that pass touched, and several are real logic smells worth
  looking at individually rather than mechanically silencing): an accessed-before-declared
  function in `globals/JobOrder.jsx`, `Date.now()` called during render in
  `globals/InventoryTable.jsx`, synchronous `setState` inside `useEffect` in
  `admin/EditWorkerModal.jsx` and `worker/WorkerJobOrder.jsx`, an unused `onBack` prop in
  `globals/ProjectDetails.jsx`, plus a handful of unused-variable errors. `ci.yml`'s lint step is
  `continue-on-error: true` until this is paid down — currently visible in the CI log, not
  gating the build.

---

## Suggested execution order

1. **P0 prerequisite** (shared API client) — ✅ done; must land first; nothing in P0-2/P0-3 is
   safe to ship without it.
2. **P0-1 through P0-8** — ✅ done.
3. **P1-1 (session store)** early, since it blocks any multi-instance testing of everything after
   it — ✅ done, along with the rest of the "P1a" backend/schema hardening subset (P1-2, P1-4
   through P1-9).
4. **P1-10 (Docker Compose deployment)** — ✅ done: three-service compose stack, `index.sql`
   folded into the migration chain, `/api` route namespace cleanup, backups, CI. Deliberately
   still open within it: TLS/a real domain, and actually provisioning the VPS itself (see that
   section for the full list).
5. **Still outstanding:** P1-3 (pagination), P1-11 (Inventory backend), and P2 items
   opportunistically, folded into whichever change already touches the same files.

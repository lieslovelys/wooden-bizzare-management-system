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
changes and the per-item notes below for what changed and where. At the time this P1a pass
landed, P1-3 (pagination), P1-10 (the deployment rewrite proper — Docker Compose,
`.env.example`, CI; the migration-tooling slice was already done), and P1-11 (Inventory backend)
were each their own separate pass, not part of this update — P1-10 and P1-11 have since landed
too (see their own sections below); P1-3 remains the one still outstanding.

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
**Status: ✅ Resolved.** All 15 list endpoints now accept `?page`/`?limit`
(`backend/src/utils/pagination.js`'s `parsePagination`, `DEFAULT_LIMIT` 25 / `MAX_LIMIT` 200) and
answer `{ success, data, meta: { page, limit, total, totalPages } }` — no endpoint returns an
unbounded result set anymore. `parsePagination` throws `AppError(400, ...)` on garbage
(`page=0`, non-integer, etc.) and clamps an oversized `limit` down to the cap rather than
erroring; the total comes from `COUNT(*) OVER()` in the same query (`splitCountedRows` strips it
back off each row) rather than a second round trip, following the same one-connection-beats-two
reasoning P1-6 already established for the dashboard-stats query.

**Two tiers, by design.** 8 endpoints whose row count grows without bound got real paging UI and
server-side filters on the frontend: `/api/projects` (`search`, `status`), `/api/projects/history`
(`remark`, now a real SQL column instead of a client-side computation — see below),
`/api/job-orders` (`priority`, `sort`), `/api/workers/:workerId/tasks` (`status`, `priority`,
`sort`), `/api/qa/tasks` (`stage`), `/api/notifications` (`type`, extending the `?type=` the P2
pass already gave the bulk-mutation routes to the read itself), `/api/attendance/worker/:workerId`
(the highest-cardinality list in the app — one row per worker per day, no filter existed), and
`/api/inventory/variants/:variantId/movements` (an append-only audit log, the strongest case for
paging in the codebase). The other 7 — `/api/users`, `/api/workers`, `/api/assignable-workers`,
`/api/job-orders/:id/assignments`, `/api/productivity`, `/api/inventory`,
`/api/inventory/low-stock` — are bounded by headcount, SKU count, or assignment-stages-per-project
and got no paging UI; they call `parsePagination` with `defaultLimit: MAX_LIMIT` so an unpaginated
caller (every existing frontend consumer) still gets everything up to the 200-row cap instead of
being silently truncated to 25.

**A correctness prerequisite, not just an addition:** `OFFSET` paging over a nullable or
non-unique `ORDER BY` column can duplicate or skip rows across pages. Seven models needed an
explicit tiebreaker added (e.g. `ORDER BY due_date ASC, id ASC`) and one
(`jobOrderModel.getWorkers`, the assignment dropdown) had **no `ORDER BY` at all** before this —
fixed regardless of whether that endpoint is ever paged past its default limit in practice.

**Real bugs fixed along the way, surfaced by actually tracing every consumer of a changed
envelope:**
- `globals/ProjectList.jsx` hid Completed projects via a client-side filter that ran regardless of
  the status dropdown. Paginating naively would have made that exclusion produce short or empty
  pages, since the server would count and slice Completed rows the client then discarded. Fixed
  by having the screen request `status=Pending,In Progress` explicitly — `admin/Profit.jsx`'s
  project dropdown, which deliberately wants Completed projects too, sends no `status` param and
  is unaffected.
- `admin/ProjectHistory.jsx` computed `remark` (`Early`/`Late`/`On-time`) client-side from
  `date_completed` vs `due_date` after fetching the whole table. The backend now returns it as a
  real column using the identical day-truncated comparison, so there's one definition instead of
  two that could drift, and it's now a real filter (`?remark=`) instead of a client-side one.
- `globals/ProjectVerification.jsx` resolved a verification-notification deep link by searching
  the loaded task array for a matching `assignmentId` — silently doing nothing once that task
  could sit on a page that was never fetched. Fixed with a new `GET
  /api/assignments/:assignmentId` (added specifically for this) that resolves the link directly
  instead of depending on what's currently loaded.
- `quality_checker/QCDashboard.jsx` and `product_manager/PM_dashboard.jsx` derived their "tasks to
  verify" tile from `data.length` on `/api/qa/tasks` — now `meta.total`, since `data.length` would
  otherwise just be the page size.
- `globals/JobOrder.jsx`'s "Sort by Nearest Due Date" button re-sorted whatever was currently
  loaded, which only ever produced a no-op (the base query was already ascending by
  default) — replaced with a real ascending/descending `sort` toggle against the server, and the
  identical dead-toggle bug in `worker/WorkerJobOrder.jsx`'s "Due" button was fixed the same way.
- `globals/NotificationList.jsx`'s optimistic local mutations for "Clear All"/"Mark All as Read"
  assumed the whole notification set was in memory; a bulk action can now change the total (and
  thus which page is valid), so those two handlers reset to page 1 or refetch instead — the
  single-row delete/mark-read handlers still mutate in place via a `setRows` the new
  `usePaginatedList` hook exposes, since neither changes page membership.

**Frontend infrastructure:** `frontend/src/hooks/usePaginatedList.js` is the shared seam every
paged screen hangs off — builds the query string, resets to page 1 when the filter set changes
(adjusting state during render per React's documented pattern, not in a `useEffect`, so it takes
effect in the same render), and debounces a `search` param (~300ms) without debouncing everything
else. `frontend/src/globals/Pagination.jsx` is a self-contained `‹ Prev · Showing 26–50 of 312 ·
Next ›` control that renders nothing at one page or fewer — it drops in below any list screen's
markup since the app has no shared table component to hang paging state off of (confirmed: 10 list
screens split between real `<table>`s and per-screen CSS-grid div "tables", each with its own
class-prefix convention).

**Deliberately out of scope for this pass:** cursor-based pagination (plain `LIMIT`/`OFFSET` is
correct and sufficient at this data scale); a typeahead for the two dropdown feeds
(`admin/Profit.jsx`'s project selector, `globals/JobOrderDetails.jsx`'s worker selector) that now
explicitly request the 200-row cap rather than inheriting the smaller paged default — past that
count they'd need one, which isn't this pass; the `notifications` table's shared-`is_read` and
ignored-`target_role` defects (PRD B.6, still untouched). The non-list response envelopes
(`{message, body}` on signup, `{err, message}` on login) and `GET /logout` → `POST` were also out
of scope here, but have since been resolved by later commits — see the P2 "Inconsistent API
contract" bullet below.

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
**Status: ✅ Resolved** (for items, variants, stock adjustment, and low-stock reporting —
"materials consumed per project," the fourth clause of PRD FR-3, is deliberately deferred; see
below). `globals/InventoryTable.jsx` now talks to `/api/inventory` instead of `localStorage`, so
Admin, Production Manager, and Inventory Staff finally see one shared, server-persisted view
instead of three silently divergent per-browser copies.

`models/inventoryModel.js` / `services/inventoryService.js` / `routes/inventoryRoutes.js` were
added following the same layer contract as the routes/services refactor above (routes own HTTP,
services throw `AppError`, models own SQL). `inventory_items.total_stock`/`status` are no longer
stored columns — both are derived in SQL from `item_variants` on every read (`SUM`/`bool_or`),
avoiding the same two-sources-of-truth defect `projects.status` already has (see the P2 bullet on
project status below). A new `stock_movements` table is the FR-3 audit trail: every stock
adjustment records who (`user_id`, `ON DELETE SET NULL` so a later account deletion doesn't erase
history), when, how much (signed `delta`), the resulting total (so history is replayable), and
why (a `reason` the frontend now prompts for). The adjustment itself
(`adjustVariantStock` in the model) expresses its non-negative guard directly in the `UPDATE`'s
`WHERE` clause rather than a separate read-then-check, so two concurrent adjustments on the same
variant serialize correctly instead of racing on a stale read — verified by firing two concurrent
`-1` requests at the same variant and confirming two movement rows and a total reduced by exactly
2, no lost update. `min_stock` is now configurable per variant from the add/edit modal (it was
hardcoded to `5` client-side before). Low-stock reporting is a derived `status` field plus a
dedicated `GET /api/inventory/low-stock` endpoint — deliberately **not** wired into the
`notifications` table, which is still broken in the two ways PRD B.6 documents (one shared
`is_read` flag; `target_role` values that don't match the role enum and are ignored by the
reader) — inventory alerts would otherwise inherit both bugs.

**Deliberately deferred:** "materials consumed per project" (the fourth FR-3 clause) — it needs
new UI on the project/job-order screens and a link between a stock movement and a project that
doesn't exist yet. Pagination on the inventory list and its movement history landed later as part
of P1-3 (see that section). Also out of scope here: real-database integration tests (the new
backend tests mock the model/service layers — see the P2 "No tests" bullet).

The rest of this section is kept as the historical record of what was wrong.

As documented in the PRD (B.6): the Inventory module persists to `localStorage`, so it isn't
"slow under load," it simply doesn't work for more than one person or one device. Building the
backend for it (API, schema already exists, add stock-movement/audit rows) is both a functional
requirement (PRD FR-3) and a scalability item — it's the one screen in the product with zero
server involvement today.

---

## P2 — Maintainability & developer experience

Not urgent, but each of these increases the cost of every future change until addressed.

- ~~**No input validation library.**~~ **Resolved**: `zod` request-body/query schemas
  (`backend/src/schemas/`, 8 modules) plus `backend/src/middleware/validate.js` validate at the
  route boundary — a bad enum or a non-numeric `:id` param now 400s with a real message instead of
  surfacing as an opaque 500.
- ~~**Inconsistent API contract.**~~ **Resolved.** All four response envelope shapes
  (`{success, data}`, bare arrays, `{err, message}`, `{message, body}`) are now one shape,
  `{success, data[, meta]}`, built by the shared `ok()` helper (`backend/src/utils/respond.js`)
  every route calls — including `login`/`signup`, which used to be the two `{err, message}`/
  `{message, body}` holdouts. ~~bare-array list endpoints~~ — **the list half is resolved by
  P1-3**: all 15 list endpoints (previously a mix of `{success,data}` and 9 bare arrays) now answer
  `{success, data, meta}` — see that section. `GET /logout` is now `POST /logout`, so the one
  state-mutating request that was still a `GET` no longer is.
  ~~auth/account routes mounted at `/` instead of `/api`~~ — **resolved as part of P1-10**:
  `userRoutes` now mounts at `/api` (`server.js`), with the ~7 frontend call sites updated to
  match. ~~three overlapping "workers" endpoints~~ — down to two intentionally distinct ones:
  `GET /api/workers` (account management, `userService.getWorkers`, `{success,data}`) and
  `GET /api/assignable-workers` (job-order assignment dropdown,
  `jobOrderService.getWorkersList`, bare array — renamed from `/workers` during the P1-10
  route move specifically because both routes ended up at the same path once `userRoutes` moved
  under `/api`, and `userRoutes` being mounted first would have silently shadowed the other,
  breaking `globals/JobOrderDetails.jsx`'s worker-assignment dropdown; caught by enumerating
  every registered route programmatically rather than by inspection alone). The dead duplicate
  registration was already removed in the P0 pass.
  **The *structural* half is now resolved** by the routes/services refactor (see execution order
  below): every response body used to be constructed inside a `(req, res)` controller handler,
  scattered across 35 functions in 8 files with inconsistent `try/catch`-then-`res.status(500)`
  boilerplate; it now lives in exactly one place per endpoint — the route — with business logic
  moved to `services/` (renamed from `controllers/`), which take plain arguments, return plain
  data, and signal failure by throwing a typed `AppError`
  (`backend/src/errors/AppError.js`) instead of the old `{err: true}`-style return-value
  convention or `catch(e){ return e; }`. Every 2xx/4xx body was verified byte-identical before and
  after (a scripted `curl` sweep over all 39 routes, diffed). The one deliberate behavior change:
  ~8 bespoke 500 bodies (e.g. `{success:false, message:'Server error while fetching projects'}`)
  normalized to the error handler's single `{error:'Internal server error'}`, which also makes
  `errorHandler.js` live code for the first time — previously zero controllers called `next(err)`,
  so it only ever fired for `userRoutes.js`'s four inline handlers. Standardizing the *shapes*
  themselves (the four envelopes above) is smaller now that they all live in `routes/`, but is
  still deliberately unaddressed here.
- ~~**`showToast` reimplemented in 11 components**~~ — **resolved (P2 frontend-consolidation
  pass)**: `context/ToastContext.js` + `globals/ToastProvider.jsx`, mounted once at the app root
  in `App.jsx`. `useToast()` returns a stable `showToast(message, type)`; the previous 12 copies
  (11 originally counted, plus `InventoryTable.jsx` added in P1-11) each had their own uncancelled
  `setTimeout` and could truncate a second toast fired while the first was still showing — the
  shared provider clears the previous timer before starting a new one, fixing that too.
- ~~**No cleanup in any `useEffect`.**~~ — **resolved for the effects this pass touched**: the 12
  toast timers are handled by the ToastProvider above; four navigation-delay timers
  (`AddWorkerModal`, `EditProjectForm`, `JobOrderDetails`, `WorkerJobOrderDetail`) are now stored
  in a `useRef` and cleared on unmount; several fetch effects gained the `ignore`-flag cleanup
  pattern `InventoryTable.jsx` established in P1-11. The worse problem — `globals/Attendance.jsx`
  defining five sub-components *inside* its own render body, remounting them (and discarding any
  half-typed form input) on every unrelated parent re-render — is fixed by hoisting all five
  (`WorkerAvatar`, `EmployeeListView`, `AttendanceLogView`, `AddAttendanceModal`,
  `EditAttendanceModal`) to module scope with explicit props. Fetch effects in files this pass
  didn't otherwise touch are still uncancelled — not swept wholesale.
- **Near-identical components maintained as separate copies**: ~~`AdminNotification`,
  `PMNotification`, and `QualityCheckerNotification` are ~90% line-for-line identical~~ —
  **resolved**: all three are now thin wrappers around one `globals/NotificationList.jsx`
  (`type`/`emptyMessage`/`resolveTarget` props), keeping their original default-export names so
  the role-shell imports didn't need to change. This was more than dedup: the PM/QC forks issued
  one HTTP request *per notification* to fake a type-scoped bulk action (`DELETE`/`PUT` per row)
  where Admin's issued exactly one unscoped request; `routes/adminNotifRoutes.js`'s
  `mark-all-read`/`clear/all` now take an optional `?type=` so all three screens issue exactly one
  bulk request (P1-3 later extended `?type=` to the `GET` itself, once the list was paginated —
  see that section). ~~The Create/Edit project and worker forms~~ — **resolved (engineering-debt
  pass)**: `AddWorkerModal`/`EditWorkerModal` and `CreateProjectForm`/`EditProjectForm` stay four
  separate components (Add and Edit differ in how they load, submit, and gate their submit
  button — collapsing them behind a `mode` flag would trade duplication for branching), but every
  piece that was verbatim identical between each pair is now extracted once:
  `utils/formValidators.js` (digit-strip and contact-number rules, which had already drifted —
  both worker modals validated contact-number completeness on submit, neither project form did),
  `globals/PhotoUpload.jsx` (the profile-picture preview + `FileReader` handler),
  `admin/WorkerJobFields.jsx` (Role/Worker Type/Contact/Daily Rate, including the two option lists
  that existed twice and could silently diverge), and `hooks/useProjectForm.js` +
  `globals/ProjectFormFields.jsx` (the seven-field block, the dynamic Project Details rows, and
  the due-date-before-date-ordered check). Found and fixed along the way: `Admin.jsx` was the only
  role shell missing a catch-all `*` route, so a bad Admin sub-path rendered an empty
  `page-content` instead of redirecting. **The five role-shell files are deliberately left
  separate, by decision, not oversight**: each is ~10 lines of a tabs array plus a route list that
  is genuinely per-role, and a shared `<RoleShell>` abstraction would cost more readability than
  four small files save. The `notifications` table's shared-`is_read` and ignored-`target_role`
  defects (PRD B.6) remain untouched — out of scope for this bullet. **Extended (track A, FR-6)**:
  a third copy of the `wb-modal-overlay`/`wb-modal-box` confirmation-modal markup — this time
  `globals/ProjectVerificationDetail.jsx`'s new repair-reason prompt, alongside the two that
  already existed in `globals/JobOrderDetails.jsx` and `worker/WorkerJobOrderDetail.jsx` — became
  a shared `globals/ConfirmModal.jsx`, and all three call sites now use it.
- ~~**Client-side derived business logic duplicated with drift**~~ — **resolved**: `utils/format.js`
  now centralizes `formatCurrency`, `formatProjectId`, `formatWorkerId`, `formatDate`,
  `formatDateShort`, and `formatTime12h`. The same project now renders `WB-07` everywhere
  (previously `WB7`/`WB-7`/`WB-07` depending on screen) and money renders `₱1,200.00` everywhere
  (previously also `₱ 1200.00` and bare `1,200` with no symbol, on `admin/A_Dashboard.jsx`'s
  monthly-profit tile).
- **No tests, anywhere**, for either project — no test runner is even installed.
  **Partially resolved (P1-11, extended by the P2 frontend-consolidation pass and P1-3):** Vitest
  is installed and gated in CI for both halves (`backend/src`: vitest + supertest, mocking
  `models/`/`services/` — no database needed; `frontend`: vitest + `@testing-library/react`/jsdom,
  mocking `api/client.js`), but coverage is still limited to the code each pass actually added or
  rewrote: the P1-11 Inventory files, (P2) `utils/format.test.js`,
  `globals/ToastProvider.test.jsx`, `globals/NotificationList.test.jsx`, and
  `backend/src/tests/adminNotifRoutes.test.js`, plus (P1-3) `backend/src/tests/pagination.test.js`
  (`parsePagination`/`buildMeta`/`splitCountedRows` exhaustively), `backend/src/tests/
  pagination-routes.test.js` (end-to-end coverage of one `{success,data}`-turned-paged route and
  one bare-array-turned-paged route: `meta`, limit clamping, a bad filter 400ing, filters reaching
  the service), and `frontend/src/hooks/usePaginatedList.test.js` +
  `frontend/src/globals/Pagination.test.jsx`.
  **Backfilled since (engineering-debt pass, backend):** `backend/src/tests/auth.test.js`
  (`middleware/auth.js` — the entire P0-2 authorization fix — `requireAuth`/`requireRole`/
  `requireSelfOrRole`, including the unauthenticated-before-role-check ordering and the
  string/numeric id-coercion behavior `requireSelfOrRole` depends on, plus a `supertest` case
  proving its one real call site is actually mounted); `backend/src/tests/
  jobOrderService.test.js` (`updateQAStatus`'s five `AppError` branches, including the P0-3
  self-approval case verbatim, and both allow-lists reaching the model call); `backend/src/tests/
  userService.test.js` (`login`'s enumeration-oracle guarantee — asserted as the unknown-username
  and wrong-password failures being *equal to each other*, not just "a 401" — plus `deleteUser`'s
  self-delete guard and that `createUser`/`addWorker` pass the model a bcrypt hash, never the
  plaintext password). **Backfilled since (track A):** `backend/src/tests/projectService.test.js`
  (FR-8's `completeProject` 404/409/success branches) and `backend/src/tests/projectModel.test.js`
  (a regression guard asserting `getAllProjects` selects the stored `status` column directly
  rather than reintroducing the `EXISTS` recomputation FR-8 removed); extended `backend/src/tests/
  jobOrderService.test.js` and new `backend/src/tests/profitService.test.js` (FR-7's audit-trail
  writes — a reviewer decision records `qa_checker_id`/`qa_notes`, a worker submission records
  neither, a profit save records `recorded_by`); extended `jobOrderService.test.js` again for
  FR-6's rejection-reason requirement (a reason-less or whitespace-only `Repair` 400s, Approve
  stays reason-optional). On the frontend: `utils/format.test.js` gained `toDateInputValue`
  coverage (including the exact UTC+8 shift the old `toISOString()` bug produced) and new
  `globals/ConfirmModal.test.jsx` (the shared modal FR-6's reason prompt introduced — rendering,
  both button callbacks, and `confirmDisabled` actually blocking `onConfirm`). The routes/
  services refactor's remaining untested surface (`attendanceService`), the bulk of
  `Attendance.jsx`'s hoisted sub-components, and everything else pre-P1-11 on the frontend —
  still zero automated coverage, and deliberately left for a later pass.
  ~~No CI~~ — **resolved**: `.github/workflows/ci.yml` (added in P1-10) runs backend install,
  frontend lint+test+build, and builds both Docker images; all three (`npm test` × 2, `npm run
  lint`) are now real gates — see the lint-errors bullet below for when the lint gate flipped.
  ~~No `engines`/`.nvmrc`~~ — **resolved**: both `package.json`s pin `"node": ">=24"`, matching
  the Dockerfiles; root `.nvmrc` added. ~~`nodemon` in `dependencies`~~ — **resolved** (P1a).
  `frontend/README.md` is still the unmodified Vite template.
- ~~**Two unused database views**~~ — **resolved (engineering-debt pass)**: `project_profit_summary`
  (a bare `projects JOIN project_profit` with no aggregation, and `profitModel.js` already reads
  `project_profit` directly) is dropped, via a migration whose `down` recreates it exactly —
  verified with a real `up → down → up` round-trip against a local database, not just read by
  inspection. `attendance_summary` is kept, deliberately unwired: every column it aggregates
  (`status`, `late_minutes`, `overtime_minutes`) is frozen at its default until PRD FR-5 lands —
  see PRD.md B.2 "Unused views" for the full reasoning.
- ~~**~9 pre-existing frontend lint errors**~~ — **resolved (P2 frontend-consolidation pass)**:
  all fixed with the real underlying change rather than a suppression — the `UserContext` export
  moved out of `App.jsx` into `context/UserContext.js` (fast-refresh violation); the missing back
  button in `globals/ProjectDetails.jsx` was actually implemented (its `onBack` prop had never
  been wired to anything); `globals/JobOrder.jsx`'s `sortJobsByDate` was hoisted above the
  component and its notification-click effect changed from a `setState`-in-effect into a lazy
  `useState` initializer; the same `setState`-in-effect pattern in `admin/EditWorkerModal.jsx` and
  `worker/WorkerJobOrder.jsx` was fixed by deriving initial state from props (with the parent
  keying the modal to force a remount on each open) and by inlining an `ignore`-guarded fetch,
  respectively; and the remaining unused-variable errors (`Admin.jsx`, `Login.jsx`,
  `admin/AddWorkerModal.jsx`, `admin/Profit.jsx`) were genuinely dead code, removed. `ci.yml`'s
  lint step is a real gate now (`continue-on-error` removed) — the 3 remaining
  `exhaustive-deps` **warnings** in `globals/JobOrderDetails.jsx` are deliberately left as
  warnings (genuine stale-closure smells needing per-effect judgement) and don't fail the step,
  since `eslint .` only exits non-zero on errors.

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
5. **Routes/services refactor (P2, pulled forward)** — ✅ done: `controllers/` renamed to
   `services/`; every response body construction moved out of the middle layer and into
   `routes/`; failures signalled via a new `AppError` class instead of ad hoc return-value
   conventions. Purely structural — see the "Inconsistent API contract" bullet above for what it
   did and didn't change.
6. **P1-11 (Inventory backend)** — ✅ done: items/variants/stock-adjustment/low-stock now served
   from `/api/inventory` with a `stock_movements` audit trail, replacing the `localStorage`-only
   screen; "materials consumed per project" (part of FR-3) deliberately deferred. Also landed:
   Vitest in both halves, gated in CI, covering the new Inventory code (see the P2 "No tests"
   bullet for what's still uncovered).
7. **P2 frontend-consolidation pass** — ✅ done: shared `ToastProvider`/`useToast()` replacing 12
   copy-pasted toast implementations; shared `utils/format.js` display formatters closing the
   `WB7`/`WB-7`/`WB-07` and `₱ 1200.00`/`₱1,200`/`1,200` drift; `globals/Attendance.jsx`'s five
   render-body-nested sub-components hoisted to module scope (the actual fix for its
   discarded-form-input bug); the three notification components merged into one
   `globals/NotificationList.jsx` with a type-scoped `?type=` bulk-action query param on the
   backend; all ~9 pre-existing frontend lint errors fixed for real (not suppressed), flipping
   `ci.yml`'s lint step into a real gate. Deliberately deferred within P2 at the time: the
   Create/Edit form pairs and the five role-shell files (not consolidated, still open — see item
   11), and the four response-envelope shapes / input validation / `GET /logout` (closed since,
   by item 9 below).
8. **P1-3 (pagination)** — ✅ done: all 15 list endpoints take `?page`/`?limit` and answer
   `{success, data, meta}`; 8 whose row count grows without bound gained server-side search/
   filter/sort (replacing what those screens did client-side) and real paging UI
   (`frontend/src/hooks/usePaginatedList.js` + `frontend/src/globals/Pagination.jsx`); the other
   7 are capped-only. Also closed the *list* half of the P2 "Inconsistent API contract" item (the
   9 formerly-bare-array endpoints now match the 6 that were already `{success,data}`), fixed a
   real deep-link bug in `globals/ProjectVerification.jsx` (a paged task list broke its
   notification-click resolution) via a new `GET /api/assignments/:assignmentId`, and gave
   `admin/ProjectHistory.jsx`'s `remark` a single server-side definition instead of a duplicated
   client-side one.
9. **P2 backend-contract cleanup** — ✅ done: `zod` schemas (`backend/src/schemas/`) plus
   `middleware/validate.js` validate every route boundary; the remaining non-list response shapes
   (`{err, message}` on login, `{message, body}` on signup) were folded into the same `{success,
   data}` envelope every other route already used via a shared `ok()` helper
   (`backend/src/utils/respond.js`); `GET /logout` is now `POST /logout`. This closes the *rest*
   of the P2 "Inconsistent API contract" item that P1-3 (item 8) left standing.
10. **DESIGN.md Worker-path mobile responsiveness** — ✅ done: the six Worker-path findings
    DESIGN.md §7 opened with (viewport-height units, tap-target sizing, the mobile control stack,
    the floating hamburger, hover-only tap affordances) are fixed — see that document's §7 for the
    detail. `docs/design/DESIGN.md` is tracked in git for the first time as part of this.
11. **Engineering-debt pass** — ✅ done: backfilled `middleware/auth.js` (the whole P0-2 fix),
    `jobOrderService.updateQAStatus`'s P0-3 self-approval guard, and `userService.login`'s
    enumeration-oracle guarantee with real tests (backend: 65 → 99); deduped the Create/Edit
    project and worker form pairs into shared field components + validators, while deliberately
    leaving the five role-shell files separate (frontend: 37 → 50); dropped the unused
    `project_profit_summary` view and documented why `attendance_summary` stays unwired pending
    FR-5 — see the relevant bullets above for detail on each.
12. **Still outstanding:** the deferred five-role-shell consolidation (declined by decision, not
    revisited without new information), test coverage for `attendanceService`/`profitService` and
    everything pre-P1-11 on the frontend, and DESIGN.md §7 items 7–11 (the cross-cutting
    responsiveness backlog: the CSS custom-property/token migration, `.app-container`'s
    `overflow-x: hidden`, the 1024px icon-only rail, 7 unconverted `<table>`s, px/rem drift).
13. **Track A, phase 1 — QA accountability** — ✅ done. FR-8: `projects.status` is now the
    single source of truth, with `markProjectAsCompleted` enforcing the completion rule and
    404/409 distinctly in the database rather than only in the frontend. FR-7:
    `qa_checker_id`/`qa_notes`/`project_profit.recorded_by` are populated on every reviewer
    decision and every profit save. FR-6: a `Repair` with no non-empty reason now 400s, and
    `globals/ProjectVerificationDetail.jsx` prompts for one via a new shared
    `globals/ConfirmModal.jsx` (extracted from its third near-identical usage, alongside
    `globals/JobOrderDetails.jsx`'s complete-confirmation and `worker/WorkerJobOrderDetail.jsx`'s
    submit-confirmation, which were migrated onto it too). `worker/WorkerJobOrderDetail.jsx` also
    shows a rejected worker their own reason — a deliberate early slice of FR-9 (see PRD.md B.5
    workflow 5). Also fixed: the `EditProjectForm.jsx` date round-trip bug (PRD B.6), via a new
    `utils/format.js` `toDateInputValue` that builds a date-input value from local calendar parts
    instead of `toISOString()`. See PRD.md B.6 for full detail on each. Backend tests
    99 → 111 across the three commits; frontend tests 50 → 59.
14. **Remaining after phase 1:** FR-4 (notifications — per-user read state, real role filtering,
    live update), FR-9's remainder (the `For QA`/`Approved` worker lifecycle view, and actual QA-
    outcome notifications — its rejection-reason display already landed in phase 1), FR-5
    (attendance computation), and FR-3's materials-per-project half — see PRD.md C.1 for all seven,
    and the track-A plan file for the dependency order they're sequenced in.

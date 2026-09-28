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
`compression`, structured request logging, `app.set('trust proxy', 1)`, `GET /healthz`/
`GET /readyz`, and a `SIGTERM`/`SIGINT` graceful-shutdown handler that drains requests and closes
the pool. `morgan` (plain-text access logging) was replaced by `pino`/`pino-http` — see item 22 —
once the "no request logging" gap this item closed grew a follow-up requirement of its own
(structured logs, correlation ids) that morgan can't provide.

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
**Status: ✅ Resolved**, now including "materials consumed per project" (the fourth clause of PRD
FR-3 — closed by item 18; see below for what item 18 added on top of the rest of this section).
`globals/InventoryTable.jsx` now talks to `/api/inventory` instead of `localStorage`, so
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

**"Materials consumed per project" (the fourth FR-3 clause) — resolved, see item 18.** Deferred
at the time this section was first written; item 18 added the `stock_movements.project_id` link
and the UI on both the Job Order and Inventory screens. Pagination on the inventory list and its
movement history landed later as part of P1-3 (see that section). Also out of scope here:
real-database integration tests (the new backend tests mock the model/service layers — see the P2
"No tests" bullet).

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
  still zero automated coverage at the time, deliberately left for a later pass.
  **Backfilled since (item 19):** a route-authorization matrix covering all 51 backend routes
  against the real `app.js` (`backend/src/tests/routeAuthorization.test.js`), plus five
  previously-untested core-workflow screens (`Login.jsx`, `auth-components/RoleBasedRedirect.jsx`/
  `ProtectedRoute.jsx`, `globals/JobOrderDetails.jsx`, `globals/ProjectVerificationDetail.jsx`,
  `worker/WorkerJobOrderDetail.jsx`, `admin/Profit.jsx`).
  **Backfilled since (item 23):** the remaining admin list/modal screens, `Navbar.jsx`
  (+`Logout.jsx`), and `App.jsx`'s session bootstrap — closing this paragraph's frontend gap in
  full except the declined role-shell consolidation, which was never a test-coverage question.
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
  inspection. `attendance_summary` was kept, deliberately unwired: every column it aggregates
  (`status`, `late_minutes`, `overtime_minutes`) was frozen at its default until PRD FR-5 landed —
  see item 17 below (`status`/`late_minutes` are now real; `overtime_minutes` is still on hold,
  so the view stays unwired) and PRD.md B.2 "Unused views" for the full reasoning.
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
   screen; "materials consumed per project" (part of FR-3) deliberately deferred at the time (later
   closed — see item 18). Also landed: Vitest in both halves, gated in CI, covering the new
   Inventory code (see the P2 "No tests" bullet for what's still uncovered).
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
12. **Still outstanding at the time:** the deferred five-role-shell consolidation (declined by
    decision, not revisited without new information), test coverage for `profitService` and
    everything pre-P1-11 on the frontend (`attendanceService`'s gap closed by item 17;
    `profitService` and the route-authorization/core-screen gap closed by item 19 below — that
    correction is item 19's own, since `profitService.test.js` had actually existed since the
    track-A phase-1 pass, several items before this one was written), and DESIGN.md §7 items 7–11
    (the cross-cutting responsiveness backlog: the CSS custom-property/token migration,
    `.app-container`'s `overflow-x: hidden`, the 1024px icon-only rail, 7 unconverted `<table>`s,
    px/rem drift) — closed by item 20 below.
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
    live update — done next, see item 15), FR-9's remainder (the `For QA`/`Approved` worker
    lifecycle view, and actual QA-outcome notifications — its rejection-reason display already
    landed in phase 1; done next, see item 16), FR-5 (attendance computation — done next, see
    item 17), and FR-3's materials-per-project half (done next, see item 18) — see PRD.md C.1 for
    all seven.
15. **FR-4 (notifications)** — ✅ done. `notifications.target_role` is now a real `user_role` value
    (migration `1790500717992_per-user-notifications.js` normalizes the legacy `'PM'`/`'QC'`
    values and preflight-checks for anything else, same pattern as
    `1787200873418_project-status-single-source-of-truth.js`), and every notification query
    (list, unread-count, mark-read, dismiss) filters by it — a caller sees a notification only
    when it matches their own role, or they're Admin. Read/dismissed state moved off the single
    shared `notifications.is_read` column (one person opening or clearing a notification used to
    affect everyone) into a per-user `notification_receipts` table; `DELETE /:id` and
    `DELETE /clear/all` are now a per-user "dismiss" (an upsert into that table) rather than a
    physical row delete. `services/adminNotifService.js` and `models/adminNotifModel.js` take the
    caller's identity as an explicit argument, same pattern as `jobOrderService.updateQAStatus`.
    Live updates: `globals/NotificationProvider.jsx` polls a new `GET
    /api/notifications/unread-count` every 30s (paused while the tab is hidden, immediate on
    becoming visible again), feeding both a new navbar unread badge (`globals/Navbar.jsx`) and a
    `refreshKey` on `hooks/usePaginatedList.js` that lets `globals/NotificationList.jsx` pick up a
    new notification without a reload. Polling, not push — see CLAUDE.md "Hosting target" for why
    a WebSocket/SSE channel isn't justified here. Mounted only around the three notification-
    bearing role shells (Admin, Production Manager, Quality Checker) — Worker and Inventory Staff
    have no notification screen yet (that's part of FR-9's remainder). See PRD.md B.6 for the
    full before/after. Backend tests 111 → 132 (new `adminNotifService.test.js`,
    `adminNotifModel.test.js`, extended `adminNotifRoutes.test.js`); frontend tests 59 → 67 (new
    `NotificationProvider.test.jsx`, extended `NotificationList.test.jsx` and
    `usePaginatedList.test.js`).
16. **FR-9 remainder (worker lifecycle view + QA-outcome notifications)** — ✅ done, closing out
    FR-9 entirely. `worker/WorkerJobOrder.jsx` gets two new filters, `For QA` and `Approved`,
    alongside the existing `Assigned`/`Repair` — the backend already accepted any `task_status` on
    `GET /api/workers/:workerId/tasks`, so this half was frontend-only; the task-selection state
    also moved from a formatted project id to `{projectId, assignmentId, status}`, fixing a latent
    bug where a worker with two stages on the same project couldn't distinguish which one they'd
    clicked. QA-outcome notifications needed a new targeting axis: `notifications.target_role` can
    only address a whole role, so a per-worker "your task was approved/repaired" message would
    otherwise have had to broadcast to every Worker. Migration
    `1790503216322_per-user-notification-target.js` adds `notifications.target_user_id`
    (nullable, `ON DELETE CASCADE`), and every query in `models/adminNotifModel.js` widens its
    visibility predicate to `target_user_id = caller OR (target_user_id IS NULL AND <existing
    role check>)` — a user-targeted row is visible only to that one user, deliberately not to
    Admin, since it's a personal message rather than a role broadcast.
    `jobOrderService.updateQAStatus` now fires a `'task'`-typed, target-user-scoped notification
    to the assignment's owning worker on every Approve/Repair decision (the Repair message
    includes the reviewer's reason); the existing `'For QA'` → Quality Checker notification is
    unchanged. Worker gets its first notification screen (`worker/WorkerNotification.jsx`, the
    same `globals/NotificationList.jsx` FR-4 built), mounts `globals/NotificationProvider.jsx` for
    the navbar badge and live polling, and `GET /api/assignments/:assignmentId` (the deep-link
    endpoint) now allows a Worker caller, scoped in the service to their own assignment only —
    Inventory Staff is the one role left with no notification screen. Backend tests 132 → 138;
    frontend tests 67 → 71 (new `worker/WorkerJobOrder.test.jsx`).
17. **FR-5 (attendance status/late-minutes computation)** — ✅ done, status/late minutes only;
    overtime deliberately deferred. `services/attendanceService.js` gains a frozen
    `WORKING_HOURS` constant (shift 08:30–17:00, a 15-minute grace period, lunch 12:00–13:00
    excluded from worked time, a worked day under 4 hours is `Half-day` regardless of arrival
    time and takes priority over `Late`) and a pure `computeAttendance()` that
    `postAttendance`/`putAttendance` now run on every insert/update, replacing the old
    pass-the-times-straight-to-Postgres behavior; two new `AppError(400)` guards reject a
    `time_out` with no `time_in` and a `time_out` at or before `time_in` (the `time`-typed, no
    date-part columns can't represent an overnight shift — see PRD.md B.2). Migration
    `1790505569341_compute-attendance-status.js` backfills every pre-existing row with the same
    formula, inlined as raw SQL rather than importing the service (a migration must keep behaving
    exactly as written even if the app's rules change later) — verified with a real
    up → down → up round-trip. `schemas/attendanceSchemas.js` now constrains `time_in`/`time_out`
    to `HH:MM[:SS]` instead of accepting any string. `globals/Attendance.jsx` gets a new Status
    column showing the computed badge (e.g. "Late · 16m"); `.log-header`/`.log-item` go from 5 to
    6 grid columns. **`overtime_minutes` is deliberately still not computed** — the client hasn't
    specified the rule yet (e.g. whether partial minutes count, or only whole hours past shift
    end) — so `attendance_summary`'s overtime columns stay meaningless and the view remains
    unwired; see PRD.md B.6. This also closes item 12's `attendanceService` test-coverage gap
    (`profitService` and everything pre-P1-11 on the frontend remain open). Backend tests
    138 → 161 (new `attendanceService.test.js`, new `attendanceRoutes.test.js`); frontend tests
    71 → 72 (new `globals/Attendance.test.jsx`). See PRD.md FR-5/B.6 for the full before/after.
18. **FR-3's final clause (materials consumed per project)** — ✅ done, closing out FR-3 entirely.
    A stock movement can now be tagged with the project it was consumed by or returned to, via one
    write path: both screens still call the existing
    `POST /api/inventory/variants/:variantId/adjust` (no second ledger). Migration
    `1790509115968_stock-movement-project-link.js` adds `stock_movements.project_id` (FK →
    projects, `SET NULL`, partial index `WHERE project_id IS NOT NULL`) — verified with a real
    up → down → up round-trip. `schemas/inventorySchemas.js`'s `adjustBody` gains a `superRefine`
    pairing rule: a `'Returned'` movement requires a `projectId` and a positive delta; a `projectId`
    on any other reason is only allowed on `'Used'` and requires a negative delta. `ADJUST_REASON`
    (schemas/common.js) gains `'Returned'`. `services/inventoryService.js`'s `adjustStock` checks
    the tagged project exists (404) and isn't `Completed` (409) before writing; `adjustVariantStock`
    (models/inventoryModel.js) additionally checks, inside the same transaction that already
    row-locks the variant, that a `'Returned'` amount doesn't exceed that project+variant's net
    consumption so far (409 `Cannot return more than this project has used` — a new `OVER_RETURN`
    sentinel, distinct from the existing `null` "no such variant / would go negative" sentinel). A
    project's materials-consumed record is simply its tagged movements netted per variant — new
    `getProjectMaterials` (model) / `getMaterials` (service) / `GET
    /api/inventory/projects/:projectId/materials` (route, capped-only); a new `GET
    /api/inventory/projects` (capped-only, both registered ahead of `GET /:id` for the same
    route-order reason as `/low-stock`) feeds the project picker on both screens, since
    `GET /api/projects` is Admin-only and Inventory Staff need one too. New
    `globals/ProjectMaterials.jsx`, mounted on `globals/JobOrderDetails.jsx` between the progress
    table and the assign-worker form, shows the running summary (used/returned/net per variant)
    and a record-usage/return form. `globals/InventoryTable.jsx`'s existing adjuster row gains a
    project `<select>` (lazily fetched — only once a row's reason is set to `Used`/`Returned`, so
    the screen's initial load stays at one request) and disables `+1` for `Used` and `-1` for
    `Returned` (and `+1` for `Returned` until a project is picked), mirroring the schema's pairing
    rule client-side. Deliberately out of scope, per the client's own instruction: nothing feeds
    Profit's `materials_cost` — quantities only, since variants carry no unit price. Backend tests
    161 → 177 (extended `inventoryService.test.js` and `inventoryRoutes.test.js`); frontend tests
    72 → 77 (new `globals/ProjectMaterials.test.jsx`, extended `InventoryTable.test.jsx`). See
    PRD.md FR-3/B.2/B.6 for the full before/after.
19. **Test-coverage backfill: route-authorization matrix + core-workflow screens** — ✅ done. With
    all of PRD C.1 closed except FR-5's overtime clause (blocked on the client), this is the
    remaining item-12 gap that isn't declined-by-decision or CSS backlog. Two parts:
    - **Route authorization.** New `backend/src/tests/routeAuthorization.test.js` imports the
      *real* `app.js` (only `config/db.js`, `express-session`, and `connect-pg-simple` are
      mocked, plus every `services/*.js` automocked) and drives it with `supertest` under a fake
      session middleware keyed off a test header. A hand-maintained `ROUTES` table lists all 51
      routes this app serves with the access rule each is supposed to enforce (a role allowlist,
      `ANY_AUTH` for the two routes gated only by `requireAuth`/an in-handler check, `SELF_OR_ADMIN`
      for `GET /workers/:workerId/tasks`, or `PUBLIC_NO_AUTH` for `POST /logout`, which must keep
      answering 200 with no session at all) and fires one request per (route, role) pair,
      asserting only on 401/403 — a mocked service returning `undefined` may make an allowed-role
      request 400/500, which is fine, since the assertion never checks the 2xx body. A second test
      walks each router's own `.stack` and asserts, in both directions, that `ROUTES` is exactly
      the live route set: a new route with no matrix row fails it, and so does a stale row for a
      route that no longer exists. Manually verified both failure modes before landing (temporarily
      deleting a `ROUTES` row, and temporarily widening a route's `requireRole(...)` allowlist) —
      each made the guard fail, then was reverted. Small related gaps closed alongside it:
      `projectService.test.js` gained `getSingleProject`/`removeProject`/`createProject`'s
      notification-swallow coverage, `jobOrderService.test.js` gained `getJobOrderDetails`'s 404.
    - **Core-workflow screens.** New tests for five previously-uncovered screens: `Login.jsx`
      (submit, and the shared incorrect-credentials message), `auth-components/RoleBasedRedirect.jsx`
      + `ProtectedRoute.jsx` (every role's landing shell, the unknown/undefined-role fallback to
      `/login`, and the allow/deny gate), `globals/JobOrderDetails.jsx` (the assign-worker form's
      auto-selected-worker submission, and FR-8's complete gate — disabled with zero or partial
      approvals, the full confirm-and-complete flow, and a failed complete not navigating away),
      `globals/ProjectVerificationDetail.jsx` (Approve, and FR-6's Repair-reason requirement:
      Send stays disabled for blank/whitespace-only input), and `worker/WorkerJobOrderDetail.jsx`
      (submit-to-QA, FR-9's own-repair-reason display — including that another stage's notes on
      the same project don't leak into it — and the disabled Approved state). Found and fixed a
      real bug while writing the last of these: `admin/Profit.jsx`'s `handleProjectChange` compared
      the `<select>`'s string value against `p.id` (a number) with `===`, so "Profit Detail —
      &lt;name&gt;" never showed a project's name once one was selected — fixed to `String(p.id)
      === projId`, with `admin/Profit.test.jsx`'s header assertion as the regression test; that
      file also covers the fetch-fill/404-blank-form/save paths.
    - Backend tests 177 → 235; frontend tests 77 → 103.
    - ~~Still open after this: the remaining admin list/modal screens ..., `InventoryTable.jsx`'s
      CRUD-modal half, `globals/Navbar.jsx`, and `App.jsx`'s session bootstrap~~ — **closed, see
      item 23.** The declined role-shell consolidation remains open. The DESIGN.md §7
      cross-cutting CSS backlog this note used to list is closed — see item 20.

20. **DESIGN.md §7 cross-cutting CSS backlog (items 7–11)** — ✅ done, six commits on `main`. With
    this, everything in item 12's "still outstanding" list is closed except the declined
    role-shell consolidation. See `docs/design/DESIGN.md` §4/§5/§7 for the binding-rule detail;
    this entry covers what changed and how it was verified.
    - **Mobile card tables + eliminate page overflow (items 10, 8).** A shared `.wb-card-table`
      utility (`css/globals.css`) generalizes the pre-existing `worker/WorkerJobOrderDetail.jsx`
      conversion — hide `<thead>`, turn each `<tr>` into a card, read each `<td>`'s label from a
      `data-label` attribute via `::before`/`attr()` instead of a hardcoded `:nth-child` list — and
      is applied to the 7 other raw `<table>`s (`admin/Profit.jsx`, `admin/WorkerList.jsx`,
      `admin/WorkerProductivity.jsx`, `globals/InventoryTable.jsx`, `globals/JobOrderDetails.jsx`,
      `globals/ProjectMaterials.jsx` — added by FR-3 since DESIGN.md's list was last written —
      `globals/ProjectVerificationDetail.jsx`), with a new `tests/expectCardLabels.js` helper
      wired into 8 test files (2 of them new: `WorkerList.jsx`/`WorkerProductivity.jsx` had zero
      coverage before this). Removing `.app-container`'s `overflow-x: hidden` (item 8) required
      first fixing everything it was masking beyond the tables: three unguarded `width: 1000px`
      containers with no `max-width` pairing (`CreateAccount`, `ProjectHistory`,
      `CreateProjectForm`, `Attendance`), several unwrapped control rows (`WorkerList`'s search
      header, `JobOrder`'s priority filters, `InventoryTable`'s header, `Profit`'s input grid), and
      a systemic CSS Grid/flex `min-width: auto` trap across every div-based "table" row in the app
      (`.jol-item`, `.qc-pv-row`, `.wjo-item`, `.att-item`/`.log-item`, `.ph-item`, `.al-item`).
    - **Labeled tablet rail (item 9).** The 769–1024px sidebar now keeps every tab's label
      (stacked under the icon, wraps to 2 lines) instead of hiding it outright, closing the
      specific case DESIGN.md called out (Worker's rail reduced to unlabeled icons).
    - **Two stray `900px` breakpoints** (not in DESIGN.md's original item list, found scoping this
      pass) — login and the account list — widened to the codebase's real 1024px breakpoint.
    - **Font-size `px` → `rem` (item 11).** All 92 declarations converted; pixel-identical at the
      default root size, since nothing overrides it.
    - **Design tokens (item 7).** `:root` custom properties for the accent/surface/border/text/
      semantic families, with ~9–18 drifted variants per family folded onto each; 820
      literal-to-`var()` replacements across all 7 non-empty `css/` files via a scratchpad-only
      script (never committed itself). A ~92-color literal tail (one-off badge/status colors)
      deliberately stays literal — see DESIGN.md §4 for the full consolidation map and the
      rationale for not forcing everything onto a token.
    - **Verification.** A scratchpad-only Playwright sweep (cached Chromium, fixture-mocked
      `/api/*`, never committed — no backend or database involved) drove every screen for every
      role at 360/768/1024px after each step: 25 overflow failures at baseline, 0 after item 8
      landed, still 0 after every later step. Frontend suite 105/105 throughout (up from 103 at
      the start of this item — the 8 `expectCardLabels` wirings plus 2 new test files), lint
      clean (3 pre-existing warnings), build clean at every step.
    - **Known residual gap, not touched:** several raw-table action buttons (inventory
      edit/delete, the profit delete icon, the inventory reason/adjust controls) stay under 44px
      specifically in the 769–1024px tablet range, since `.wb-card-table` is mobile-only
      (`max-width: 768px`) by design, matching the codebase's breakpoint convention. Resizing
      these at every width (including desktop) is a design decision, not a responsiveness fix.
    - **Not verifiable in this environment, and not claimed:** how any of this feels on a real
      budget Android phone — touch responsiveness, on-screen keyboard behavior, legibility under
      shop-floor glare. The Playwright sweep confirms layout geometry, not feel.
    - **Still open after this:** the 54 JSX inline-style hex literals the token migration didn't
      touch (scoped to `frontend/src/css/` — see DESIGN.md §4), and the declined role-shell
      consolidation. Item 19's remaining test-coverage gaps are closed — see item 23.

21. **PRD.md C.2 "Storage discipline": worker photos moved off the database** — ✅ done, three
    commits on `main`. This was the last C.2 NFR not blocked on the client or on VPS access — see
    PRD.md C.2's own row for the resolved-state summary.
    - **The problem.** `worker_details.photo` was an unbounded base64 `text` value, capped only
      by the shared 10mb request-body limit; nothing capped it client-side either. `GET
      /api/workers` (`userModel.getAllWorkers`) inlined every worker's full photo into every row
      of the 200-worker cap — on a single vCPU, the most expensive response in the app to
      serialize and gzip for no reason a viewer actually needed (the worker LIST screens never
      rendered a photo at all; only `Attendance.jsx` and the edit modal ever showed one).
    - **Storage.** New `backend/src/utils/photoStorage.js` is the one place that reads or writes
      an actual photo file: `UPLOAD_DIR` (a Docker named volume, `/data/uploads`, in the deployed
      stack; `backend/src/uploads/`, gitignored, in local dev), a random-UUID filename per photo,
      magic-byte validation against the declared type (never trusting a client's MIME string
      alone), and a 512KB cap on a NEW upload — generous, since `frontend/src/utils/resizeImage.js`
      already shrinks whatever was picked to ~512px client-side first.
    - **The "absent vs. cleared" trap.** `PUT /api/workers/:id` used to default a missing `photo`
      to `null`, which was harmless only because `EditWorkerModal.jsx` always re-sent the current
      photo from the (then photo-carrying) list row. Once the list stopped carrying it, that
      default would have silently wiped every edit's photo. Fixed by making `photo` genuinely
      three-state end to end — absent (keep), a string (replace), `null` (clear) — from
      `EditWorkerModal.jsx`'s `photoChanged` flag through `userService.updateWorker` to
      `userModel.updateWorkerDetails`'s `{ photoChanged, photoPath }` argument, inside a
      transaction that `SELECT ... FOR UPDATE`s the row so the old file is only removed once the
      replacing write has actually committed.
    - **Serving.** New `GET /api/workers/:id/photo` (Admin-only, same as the rest of `/workers`)
      resolves an id to a checked, on-disk path — never a client-supplied path — and answers with
      long-cache headers plus `Cross-Origin-Resource-Policy: same-site` (helmet's default
      `same-origin` would otherwise block the frontend's `<img>` in local, non-Docker dev, where
      Vite and the API are different origins; the Docker deployment is same-origin behind Nginx
      either way). `utils/format.js`'s new `workerPhotoUrl(worker)` builds the URL from
      `{user_id, photo_path}`, with a `?v=<photo_path>` cache-buster (the filename itself changes
      on every replace, so this never needs revalidating against a stale browser cache).
    - **Backfill.** New `scripts/backfillPhotos.js` (`npm run photos:backfill`) is idempotent and
      moves any remaining legacy `photo` value onto disk, deliberately without the new 512KB cap
      (an existing value the app already accepted under the old limit shouldn't be silently
      dropped for being over a cap introduced after the fact). Run automatically on every
      container boot (`docker-entrypoint.sh`, right after `npm run migrate`), so an existing
      deployment backfills itself on its next deploy with no manual step.
    - **Deploy.** `docker-compose.yml` gains a named `uploads` volume; the Dockerfile creates and
      chowns its mountpoint while still root, before the existing non-root `USER appuser` switch.
      The shared body-size limit (`app.js`'s `express.json`/`urlencoded`, `frontend/nginx.conf`'s
      `client_max_body_size`) drops from 10mb to 1mb now that photo uploads have a real cap of
      their own and nothing else in the app sends anywhere near that much. `deploy/backup.sh`
      tars the `uploads` volume right after its existing `pg_dump` (so every `photo_path` the
      dump references already has a matching file), with the same 14-file retention;
      `deploy/restore.sh` takes an optional matching tarball, extracted additively.
    - **Verification.** Backend tests 235 → 273 (new `photoStorage.test.js`,
      `workerPhotoRoutes.test.js` — real `app.js` via supertest, not a hand-built one —,
      `backfillPhotos.test.js`, and new `userService.test.js` coverage for every photo-lifecycle
      branch). Frontend tests 105 → 125 (new `resizeImage.test.js`, rewritten
      `PhotoUpload.test.jsx`, new `format.test.js`/`Attendance.test.jsx` coverage, and new
      `EditWorkerModal.test.jsx` — closing part of item 19's "remaining admin list/modal screens"
      gap as a side effect). Lint clean (3 pre-existing warnings), both builds clean. The local
      dev database's migration was verified with a real up → down → up round-trip.
    - **Not independently re-verifiable here:** Docker isn't installed in this environment, so
      the named-volume ownership behavior, the entrypoint's automatic backfill step, and the two
      backup/restore scripts' `docker compose exec ... tar` paths are covered only by shell
      syntax-checking and by reading them against `docker-compose.yml`'s real service names, not
      by an actual running stack — the existing `docker-build` CI job remains the first place the
      Dockerfile itself gets built.
    - **Deferred, and recorded rather than silently dropped:** dropping the legacy
      `worker_details.photo` column (needs a later migration, once every environment — including
      whichever one this deploys to first — has actually run the backfill; the entrypoint runs
      migrations *before* the backfill script, so doing the drop in this same pass would destroy
      any not-yet-migrated photo); `attendance.photo` (unused — no route or service reads or
      writes it, so there's nothing to migrate); off-box backup sync automation (already
      P1-10's own open item, unchanged by this).

22. **PRD.md C.2 "Observability": structured logging, correlation IDs, and a first real latency
    measurement** — ✅ done, four commits on `main`. The last C.2 item that needed no one else's
    input — see PRD.md C.2's own Observability/Latency/Database-pooling rows for the resolved-
    state summary.
    - **The problem.** `morgan` gave a plain-text access log (method/path/status) and nothing
      else: no way to tell which of several log lines belonged to the same request, no structured
      (parseable) format, and ~33 separate `console.log`/`console.error` calls scattered across
      15 files, several of which logged an error and then rethrew it — duplicating, in an
      unstructured and un-correlated form, what the centralized error handler already saw.
      Meanwhile, the NFR's own p95 latency target had never actually been measured — it was a
      number in a table, not a verified property.
    - **Structured logging.** `morgan` is gone; `pino` + `pino-http` (net **−1** dependency) give
      one shared logger (`config/logger.js`, JSON always — no `pino-pretty`, kept simple) with a
      `redact` config as defense-in-depth alongside the existing "never log passwords/financial
      payloads" rule. `pino-http` (`app.js`) generates a correlation id per request (honors an
      incoming `X-Request-Id`, otherwise mints a UUID), echoes it on the response, and hands every
      request a `req.log` child logger pre-bound with that id — trimmed to
      `{id, method, url}`/`{statusCode}` rather than pino-http's default full-header dump, which
      was several hundred bytes of near-constant noise per line (caught and fixed by checking real
      log output from a running server, not just the test suite — see below). `/healthz`/`/readyz`
      are excluded from the automatic access log (polled every 10–15s by the Docker healthcheck;
      logging every poll is noise, not a request worth correlating anything to), but still logged
      explicitly on a real `/readyz` failure.
    - **The `console.*` sweep.** Every call site outside `tests/` is now one of: `req.log` (routes,
      errorHandler.js — where a request is in scope); the shared `logger` directly (services/
      models/`server.js`/`config/db.js` — these can't touch `req`, per CLAUDE.md's architecture
      rule, so no correlation id, which is correct: they're not request-scoped events); or a
      documented exception. The biggest simplification: eight model functions
      (`inventoryModel.js` ×3, `jobOrderModel.js` ×4, `projectModel.js` ×1) logged an error and
      then unconditionally rethrew it — always propagating to `errorHandler.js`, which now logs
      every unexpected error centrally anyway. The log line was removed, not migrated, since a
      second copy with neither structure nor a correlation id was strictly worse information than
      the one `errorHandler.js` already produces. `profitModel.js`'s `getMonthlyProfit` is the one
      real exception among the models (it swallows its error and returns `0` rather than
      rethrowing, so nothing else will ever log that failure) and keeps logging, migrated to the
      shared logger. Caught a real bug applying the same treatment to
      `utils/photoStorage.js::removePhoto`: logging the filename under the key `photo` would have
      been silently redacted by `config/logger.js`'s own redact list (which targets that literal
      key — meaning something different there, the legacy base64 column) — renamed to `photoPath`
      in the log call. `scripts/migrate.js`/`createAdmin.js` deliberately keep plain
      `console.log`/`console.error` (one-shot CLI tools a human runs and reads directly;
      `migrate.js` also wraps node-pg-migrate's own plain-text verbose output, so partially
      structuring just its two wrapper lines would be inconsistent for no benefit) —
      `scripts/backfillPhotos.js`, by contrast, moved to the shared logger, since unlike the other
      two it runs unattended on every container boot and has no third-party plain-text output to
      stay consistent with.
    - **Load test.** A scratchpad-only (never committed) `autocannon` run against the real local
      dev backend, seeded with a modest, clearly-tagged synthetic dataset (~60 workers, ~60
      projects, ~120 assignments, 20 inventory items — the real dev DB was otherwise 11 users, 1
      project, too sparse to say anything about pagination/join cost) and cleaned up
      (verified byte-for-byte back to the pre-seed row counts) immediately after. Six
      representative read endpoints at 10/30/60 concurrent connections: **zero errors, zero
      timeouts, p99 under 130ms in every case** — comfortably inside the 500ms target. Pushed to
      300 concurrent connections (far past the "50–300 users with an open tab, not 300
      simultaneous requests" scenario PRD.md C.2 itself describes) against the single heaviest
      endpoint: still zero errors, latency degraded gracefully to ~850ms p97.5 rather than hanging
      or crashing — bounded queuing, not the indefinite kind the NFR warns against, though also
      not a clean fail-fast rejection; recorded as a partial observation, not oversold as either.
    - **Not representative, and not claimed as such:** this ran on an 8-core/~8GB local dev
      machine, not the 1-vCPU/4GB target VPS — these numbers are a lower bound on real latency,
      not a prediction of it. A real measurement against the actual deployed hardware, once it's
      provisioned (still P1-10's own open item), is still open.
    - **Verification.** Backend suite 273/273 throughout (read carefully before each console.*
      removal to confirm no test asserted on it — none did). No new tests were added purely for
      logging plumbing (there's no assertion-worthy behavior change a route/service test would
      catch that the existing 273 don't already cover), but the structured-output and
      correlation-id claims above were verified against a real running server, not inferred from
      the test suite passing — see the serializer bug this caught, above. Frontend untouched by
      this item. Backend `npm audit`: removing morgan actually dropped a vulnerability count (4 →
      3); the remaining three (`body-parser`, `brace-expansion`, `qs` — all transitive, none from
      `pino`/`pino-http`) are pre-existing and out of scope here.
    - **Still open after this:** everything item 21 already left open, plus the real-VPS latency
      measurement noted above, plus PRD C.2's own "50–300 concurrent users" distinction, which
      still wants validating against real usage patterns once the app is live, not this pass's
      synthetic one.

23. **Remaining frontend test coverage** — ✅ done, five commits on `main`. Closes item 19's and
    item 20's "still open" lists in full except the declined role-shell consolidation and the 54
    JSX inline-hex literals (both still open, unrelated to test coverage).
    - **A real bug, found while scoping this item.**
      `admin/WorkerList.jsx`'s `handleSaveNewWorker` caught its own errors and toasted them, but
      `admin/AddWorkerModal.jsx`'s `handleSubmit` unconditionally showed a success toast and
      cleared the form after `await`ing `onSave` — so a failed add (a duplicate username, a
      validation 400, a 500) showed **both** the error toast and the success toast, and wiped
      everything the admin had typed, on every failure. `EditWorkerModal.jsx` wasn't affected (it
      neither awaits `onUpdate` nor toasts on success). Fixed by making `AddWorkerModal` the sole
      owner of both toasts: `WorkerList`'s handler no longer catches, and `AddWorkerModal`'s catch
      now surfaces the server's actual message. The regression test for this was verified against
      the unfixed code first (confirmed it failed there) before the fix landed, matching the
      precedent item 19 set with `Profit.jsx`'s `handleProjectChange` bug.
    - **New coverage, previously untested screens:** `admin/AddWorkerModal.jsx`,
      `admin/AccountList.jsx` (list, empty state, the delete-confirm modal, and both delete
      outcomes), `admin/ProjectHistory.jsx` (built against the real `usePaginatedList` hook rather
      than a mock, so the remark-filter query string and the "All" → no-param case are asserted
      directly; the row-click drill-down; the per-task remark calculation including its fallback
      to the project's own `date_completed`/`due_date` when a done task has neither),
      `globals/Navbar.jsx` (role/name display, tab hrefs, the active-tab pathname match including
      the bare-role-path → dashboard-tab fallback, the unread badge's `showUnreadBadge`/`99+`/
      zero-count rules, the mobile menu) plus `globals/Logout.jsx`'s confirm portal, and
      `App.jsx`'s session bootstrap — the `/api/session-user` `{success, data}` unwrap the file's
      own comment calls "the highest-blast-radius site in the app," including the full redirect
      chain a disallowed role's URL takes (`/admin/* → /login → / → their own shell`, never
      actually rendering the shell it wasn't allowed into).
    - **Interaction coverage added to already-render-tested screens:** `admin/WorkerList.jsx`
      (search by name/formatted-id, role/type filters, the empty state, add/edit round-trips),
      `admin/WorkerProductivity.jsx` (the Regular/Part-time tab switch, the role filter, the
      empty-category message, gold/silver rank classes), and `globals/InventoryTable.jsx`'s
      CRUD-modal half — the adjuster/project-tagging half was already covered from item 18 (Edit
      prefilled from the row and keeping an existing variant's numeric id on submit, a
      newly-added variant getting `id: undefined`, blank-named variants dropped, Cancel, both
      delete outcomes, the category filter).
    - **Noted, not touched:** `admin/WorkerProductivity.jsx`'s role filter omits "Delivery"
      (present in `WorkerJobFields.jsx`'s `RoleSelect`, used by the add/edit worker forms) — may
      be intentional, since delivery isn't a QC-scored production stage with early/late/repair
      counts of its own, but flagged here rather than silently assumed either way.
    - **Verification.** Frontend tests 125 → 177 across the five commits; lint clean throughout
      (the same 3 pre-existing `JobOrderDetails.jsx` warnings, unrelated to this item); both
      builds clean. Backend untouched by this item — its suite still 273/273.
    - **Still open after this:** the declined role-shell consolidation, and the 54 JSX inline-hex
      literals (item 20's own "still open" note) — neither is a test-coverage gap.

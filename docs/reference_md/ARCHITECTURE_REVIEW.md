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
  (+`Logout.jsx`), and `App.jsx`'s session bootstrap.
  **Backfilled since (item 25):** the project detail/list/verification/job-order screens, the
  three role dashboards, and account/project creation — closing this paragraph's frontend gap in
  full except the declined role-shell consolidation, which was never a test-coverage question, and
  a short, deliberate list of routing-only/thin-wrapper files item 25 itself names.
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
    - **Still open after this:** ~~the 54 JSX inline-style hex literals the token migration didn't
      touch (scoped to `frontend/src/css/` — see DESIGN.md §4)~~ — closed by item 24 — and the
      declined role-shell consolidation. Item 19's remaining test-coverage gaps are closed — see
      item 23.

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
    - **Deferred at the time, closed by item 41 below:** dropping the legacy
      `worker_details.photo` column (needed a later migration, once every environment — including
      whichever one this deploys to first — had actually run the backfill; the entrypoint ran
      migrations *before* the backfill script, so doing the drop in this same pass would have
      destroyed any not-yet-migrated photo) and `attendance.photo` (unused — no route or service
      reads or writes it, so there was nothing to migrate, only a column to drop). Still open:
      off-box backup sync automation (already P1-10's own open item, unchanged by this).

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
      `pino`/`pino-http`) were pre-existing and out of scope here. (They were actually triaged and
      patched later, in item 38.)
    - **Still open after this:** everything item 21 already left open, plus the real-VPS latency
      measurement noted above, plus PRD C.2's own "50–300 concurrent users" distinction, which
      still wants validating against real usage patterns once the app is live, not this pass's
      synthetic one.

23. **Remaining frontend test coverage** — ✅ done, five commits on `main`. Closes item 19's and
    item 20's "still open" lists in full except the declined role-shell consolidation and the 54
    ~~JSX inline-hex literals~~ (both still open, unrelated to test coverage — the hex literals
    are closed by item 24 below).
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
    - **Still open after this, at the time:** the declined role-shell consolidation — see item 24
      for the JSX inline-hex literals, item 20's own "still open" note (neither was a
      test-coverage gap) — plus a further slice of untested screens this item's own scoping
      hadn't enumerated: the project detail/list/verification/job-order screens, the three role
      dashboards, and account/project creation. Closed by item 25 below.

24. **JSX inline-hex literals migrated onto the `:root` tokens** — ✅ done, one commit on `main`
    plus this doc pass. Closes the last item on item 20's/item 23's "still open" lists — the 54
    inline `style={{ color: '#...' }}` hex literals in `.jsx` files that the CSS-scoped token
    migration (item 7 in DESIGN.md §7, i.e. the pass behind items 19/20) left untouched, per
    DESIGN.md §4's own note that this was simply out of scope for a pass scoped to
    `frontend/src/css/`, not a technical limitation.
    - **Scope.** A fresh count found 55 hex occurrences across `frontend/src/**/*.{js,jsx}`, two
      of them out of scope on inspection: `utils/resizeImage.js`'s canvas `ctx.fillStyle` (a
      `<canvas>` 2D context can't resolve a CSS custom property, so `var()` there would just
      silently paint nothing) and one hex value that only exists inside a pre-existing Tagalog
      comment in `admin/WorkerList.jsx` (left as-is per the CLAUDE.md rule against touching
      existing Tagalog comments). That left 53 across 18 `.jsx` files.
    - **Rule applied — identical to the CSS pass's own, not a new one.** A literal moved to a
      token only when it was either the token's exact value or a drift variant of the same
      visual role, exactly matching DESIGN.md §4's existing consolidation map. 45 of the 53
      migrated this way — `--color-text-muted`, `--color-danger`, `--color-accent`,
      `--color-accent-text`, `--color-text`, `--color-border`, `--color-surface`,
      `--color-surface-cream`, and `--color-text-inverse` all picked up one or more sites. Four
      SVG `stroke="#..."` presentation attributes (`InventoryTable.jsx` ×2, `WorkerList.jsx`,
      `NotificationList.jsx` ×3) moved into `style={{ stroke: 'var(--color-...)' }}` rather than
      staying a bare attribute, since `var()` inside a raw SVG presentation attribute isn't
      guaranteed to resolve but an inline `style` always does.
    - **Four JSX-only drift values, folded into DESIGN.md §4's map for the first time.** None of
      these appeared anywhere in `css/`, but each is the same drift pattern the map already folds
      elsewhere: `#cc0000` (`WorkerJobOrder.jsx`'s session-error text), `#ff4d4d`
      (`InventoryTable.jsx`'s delete icon), and `#dc3545` (`ProjectList.jsx`'s delete button) all
      fold onto `--color-danger`, joining the `#ff0000`/`#c62828`/etc. variants the map already
      lists there; `#8B7E5C` (`WorkerProductivity.jsx`'s empty-category message) folds onto
      `--color-text-muted`. These are small, deliberate visual shifts of the same kind the CSS
      pass itself already accepted when it folded, e.g., `#ff0000` onto `#d32f2f`.
    - **Kept as a literal tail (8), matching the CSS pass's own precedent for what stays literal:**
      `#666`, `#000000`, and `#5C4033` (all three in `EditWorkerModal.jsx` — the subtitle plus the
      worker-name heading's two-tone styling), `#5b5035` (`ProjectVerification.jsx`), `#999`
      (`PhotoUpload.jsx`), and `#ddd` (`AddWorkerModal.jsx` ×2) — neutral greys and a brown
      distinct from the muted-text family, each used once or twice, which is exactly what
      DESIGN.md §4's literal-tail paragraph already describes for the CSS side. (Correction, made
      during item 25's doc pass: this bullet originally also listed `Navbar.jsx`'s `#666` here,
      but the implementation actually migrated that one site onto `--color-text-muted` — a
      reasonable per-site call, since it's the same muted-subtitle role, just not what this bullet
      said at the time. The count of 8 literals and the re-grep verification below were already
      counting the corrected, as-shipped state; only this bullet's prose was stale.)
    - **No behavior change.** Every substitution is either the token's exact existing value or one
      of the drift folds above — nothing here is a new color decision beyond the four drift
      folds, which are named explicitly rather than silently absorbed.
    - **Verification.** A grep confirmed every `var(--color-...)` name introduced actually exists
      on `:root` in `css/globals.css` (the one failure mode that fails silently — a typo'd
      variable name resolves to nothing, not an error). A re-grep for hex literals across
      `frontend/src/**/*.{js,jsx}` after the change returned exactly the 8 kept literals plus the
      2 out-of-scope exclusions above, confirming nothing was missed or double-counted. Frontend
      suite 177/177 (unchanged — no test asserts on any of these values), lint clean (the same 3
      pre-existing `JobOrderDetails.jsx` warnings), build clean. Backend untouched.
    - **Still open after this:** the declined role-shell consolidation, plus item 23's own
      leftover list of untested screens — closed by item 25 below.

25. **Remaining frontend test coverage, second pass** — ✅ done, three commits on `main` plus this
    doc pass. Closes CLAUDE.md's "Tests" paragraph list of still-untested screens: the per-role
    dashboards, `CreateAccount.jsx`/`CreateProject.jsx`, and the project detail/verification/
    job-order screens.
    - **New coverage.** `globals/ProjectList.jsx` (default `status=Pending,In Progress`, the
      status dropdown, debounced search, delete confirm/alert/refetch, and its Edit/notification
      deep-link switches into the real `EditProjectForm`/`ProjectDetails`); `globals/
      ProjectDetails.jsx` (render, the empty-variables fallback, the fetch-failure "Project not
      found" state, Back); `globals/CreateProjectForm.jsx`/`globals/EditProjectForm.jsx` (POST/PUT
      payload shape, the shared `useProjectForm` due-before-ordered validation blocking submit,
      success/error toasts, `EditProjectForm`'s PRD B.6 date-prefill via `toDateInputValue` and its
      1500ms post-submit `onSuccess` delay); `globals/JobOrder.jsx` (the priority-toggle filter,
      including the "all three selected → no param sent" case; the sort-direction toggle; the
      notification deep-link); `globals/ProjectVerification.jsx` (the stage filter; the
      notification deep-link's `GET /api/assignments/:id` resolution — the same P1-3 fix item 8
      made); `TempSignup.jsx` (the signup body shape, digit-stripping on the name fields, reset +
      success toast, error toast leaving the form intact); `admin/A_Dashboard.jsx`/
      `product_manager/PM_dashboard.jsx`/`quality_checker/QCDashboard.jsx` (stats-card rendering,
      and for the latter two, the P1-3 regression their own code comments warn about — "tasks to
      verify" must read `meta.total`, not the current page's `data.length`); `admin/
      CreateAccount.jsx`/`admin/CreateProject.jsx` (the tab switch between their two children).
    - **Testing note, not a source change.** Submitting a form in a test uses
      `fireEvent.submit(form)` rather than clicking the submit button — jsdom runs the same
      `required`/`min` constraint validation a real browser does on a button-driven submission, so
      a click silently no-ops before `handleSubmit` (and the JS-level `validateDates()` check)
      ever runs. Dispatching the submit event directly is testing-library's documented way around
      that. Also: `vi.waitFor` (vitest's own) polls a condition but doesn't wrap it in React's
      `act()`, so a DOM read taken right after one resolves can catch a state update mid-flight
      when that update lands in the same tick as the awaited call — caught here by a stale read on
      `TempSignup`'s post-submit form-reset. Every new file in this item (and the three
      already-committed ones from earlier in this item that had used it) uses
      `@testing-library/react`'s `waitFor` instead, which does wrap in `act()`.
    - **Deliberately still not covered**, and not considered a gap: the five role-shell files
      (`Admin.jsx`/`ProductionManager.jsx`/`QualityChecker.jsx`/`Worker.jsx`/`Inventory.jsx`),
      which are routing-only and tied to the declined role-shell consolidation; the three one-line
      `*Notification.jsx` wrappers over the already-tested `NotificationList.jsx`; `globals/
      InfoCard.jsx`, exercised indirectly by every dashboard test above; `auth-components/
      ProtectedRoute.jsx`, already covered by `RoleBasedRedirect.test.jsx`.
    - **Verification.** Frontend tests 177 → 221 across the three commits; lint clean throughout
      (the same 3 pre-existing `JobOrderDetails.jsx` warnings); both builds clean. Backend
      untouched — its suite still 273/273.
    - **Still open after this:** the declined role-shell consolidation, plus DESIGN.md §8's
      deferred native-dialog replacement — closed by item 26 below.

26. **Replace the remaining native `window.confirm`/`alert` dialogs** — ✅ done, three commits on
    `main`. Closes DESIGN.md §8's "Replacing `window.alert`/`window.confirm` with in-app UI"
    deferral. The Worker path (`worker/WorkerJobOrderDetail.jsx`) had already been migrated to
    `ConfirmModal`/toasts by the time this item started; three call sites hadn't been:
    `globals/ProjectList.jsx`'s delete (`window.confirm` + three `alert()`s for
    success/failure/error), `globals/InventoryTable.jsx`'s delete (`window.confirm`), and
    `globals/NotificationList.jsx`'s "Clear All" (`window.confirm`).
    - **`ConfirmModal.jsx` gains a `danger` prop** (red title/confirm button, via new
      `.wb-modal-title.danger`/`.wb-btn-yes.danger` rules in `globals.css`) rather than each
      caller hardcoding `style={{color: 'var(--color-danger)'}}` — the reason two screens,
      `admin/AccountList.jsx` and `globals/Attendance.jsx`, had their own bespoke copy of the same
      `wb-modal-overlay`/`wb-modal-box` markup in the first place. Both now render `ConfirmModal
      danger` instead, dropping their redundant `showConfirmModal` boolean —
      `accountToDelete`/`recordToDelete` being non-null already means the modal is open. Same
      pass adds dialog semantics (`role="dialog"`, `aria-modal`, `aria-labelledby` via `useId`);
      focus trapping and Escape handling are explicitly out of scope, left for the separately
      deferred accessibility pass (DESIGN.md §8).
    - **The three remaining native dialogs** now render `ConfirmModal`: `ProjectList`'s delete
      (`danger`, plus its three `alert()`s replaced with `showToast()` calls via `useToast()`, so
      they're no longer inconsistent with the rest of the app's feedback); `InventoryTable`'s
      delete (`danger`, and its confirmation text now names the item); `NotificationList`'s Clear
      All (not `danger` — it only dismisses the caller's own copy, not a destructive delete of
      anyone else's, matching the existing "Other users will still see them" wording).
    - **Guard against regression.** `eslint.config.js` adds `'no-alert': 'error'` (ESLint core's
      rule for `alert`/`confirm`/`prompt`), so a reintroduced native dialog fails the existing
      `npm run lint` CI gate rather than depending on review to catch it.
    - **Tests.** Every `vi.spyOn(window, 'confirm'|'alert')` in the three affected files' test
      suites is replaced with real clicks through the rendered dialog (`getByRole('dialog')`);
      `ProjectList.test.jsx` also gained an error-path toast test, and
      `NotificationList.test.jsx` gained an explicit Cancel-issues-no-request test.
      `ConfirmModal.test.jsx` gained cases for the `danger` class and the dialog role.
    - **Verification.** Frontend tests 221 → 226; a repo-wide grep for `window.confirm`,
      `window.alert`, bare `alert(`, and bare `confirm(` outside test files and comments returned
      zero hits; lint clean (same 3 pre-existing `JobOrderDetails.jsx` warnings, plus the new
      `no-alert` rule found nothing else to flag); both builds clean. Backend untouched — its
      suite still 273/273.
    - **Still open after this:** the declined role-shell consolidation, plus DESIGN.md §8's
      deferred self-hosted fonts — closed by item 27 below. The remaining §8 deferrals (a formal
      accessibility standard, PWA) are separate, larger efforts, not implied by this item.

27. **Self-host fonts and icons** — ✅ done, two commits on `main`. Closes DESIGN.md §8's
    "Self-hosted fonts" deferral. `index.html` loaded Inter and Playfair Display from Google Fonts
    and Font Awesome 6.4.0 from cdnjs — extra third-party DNS/TLS round-trips before the page could
    render any text or icon, and a real cost on an unreliable shop-floor connection.
    - **Scope.** A repo-wide check of every `<i className="fa-...">` and CSS `content:` icon glyph
      (Navbar's hamburger/logout, every role shell's `tab.icon`, `account.css`'s `\f0d7` caret)
      found the app uses only the Font Awesome **solid** style — no `fa-regular`/`far` or
      `fa-brands`/`fab` anywhere — so only the solid webfont needed bundling, not the full
      `all.min.css`.
    - **Packages.** `@fontsource/inter`, `@fontsource/playfair-display`, and
      `@fortawesome/fontawesome-free` as runtime `dependencies`, imported from `main.jsx` ahead of
      `globals.css` so the `@font-face` rules exist before anything references the families.
      Font Awesome is pinned `^6.4.0` deliberately — v7 renames the CSS font family to
      "Font Awesome 7 Free", which would silently break `account.css`'s hand-written
      `font-family: "Font Awesome 6 Free"` glyph rule.
    - **Same weights, so no visual change.** Only the weights already loaded (Inter 400/500/600,
      Playfair Display 500/600/700) were bundled. Several rules ask for weights never loaded today
      (Inter 700, Playfair Display 900 in `TempSignup.css`) — the browser was already synthesizing
      those from the heaviest loaded weight, and still does, so nothing renders differently.
      Loading a real Inter 700/Playfair 900 would be a visible change and is a separate, un-started
      follow-up, not folded in here.
    - **`index.html`** loses both `preconnect`s and both CDN `<link>` tags; nothing else in it
      changes. `nginx.conf`'s existing `location ~* \.(?:…|woff2?|…)$` immutable 1-year cache rule
      already covers the new hashed asset files, so it's unchanged.
    - **Guard against regression.** New `tests/indexHtml.test.js` reads `index.html` off disk and
      asserts no `<link>`/`<script>` has an `http(s)://` (or protocol-relative `//`) URL — the
      counterpart to item 26's `no-alert` eslint rule, so a CDN reference can't creep back in
      unnoticed. (Had to resolve the file path via `fileURLToPath(import.meta.url)` +
      `path.join`, not `new URL('../../index.html', import.meta.url)` — jsdom, this suite's test
      environment, replaces the global `URL` constructor with one that resolves relative URLs
      against `window.location` instead of a file base, so the latter silently produced an
      `http://localhost:3000/...` URL instead of a file path.)
    - **Verification.** Frontend tests 226 → 227; lint clean (same 3 pre-existing
      `JobOrderDetails.jsx` warnings); build clean, with the `dist/assets/` listing showing hashed
      Inter/Playfair/`fa-solid-900` files and no `fa-regular`/`fa-brands` files; a grep of the
      built `dist/index.html` for `googleapis`/`gstatic`/`cdnjs` returned zero hits. A
      `vite preview` request confirmed the served `index.html` carries no CDN link and the built
      CSS references the self-hosted `fa-solid-900` files. `npm audit`'s 12 pre-existing
      vulnerabilities (react-router-dom, undici, vite) were confirmed unchanged by diffing against
      a stash of this item's `package.json` changes — none of the three new packages added a new
      one. Backend untouched — its suite still 273/273.
    - **Correction (made during item 28):** this verification missed a live CDN reference.
      `globals.css:1` carried its own `@import url('https://fonts.googleapis.com/...')` —
      presumably a leftover from before the `main.jsx` imports were added — that the grep above
      never caught, since it only checked `dist/index.html`, not the built CSS. The production app
      kept fetching fonts from Google at runtime despite this item's own text and verification
      saying otherwise. See item 28 for the fix and the widened guard.
    - **Still open after this:** only the declined role-shell consolidation remains on this
      backlog's "still open" lists. DESIGN.md §8's remaining deferrals (a formal accessibility
      standard, PWA) are separate, larger efforts, not implied by this item. The Inter 700/Playfair
      900 real-weight follow-up noted above is a new, small, un-started candidate — closed by item
      28, which also caught the `globals.css` regression above.

28. **Finish self-hosting fonts: remove the leftover CDN `@import`, load the real weights** — ✅
    done, two commits on `main`. Closes the gap item 27 left open.
    - **The regression.** `globals.css:1` still read
      `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&display=swap')`
      after item 27 landed — a CDN font-loading reference item 27's own verification missed
      because it only grepped `dist/index.html` for `googleapis`/`gstatic`/`cdnjs`, never the
      built CSS. Deleted outright; `main.jsx`'s `@fontsource/*` imports already supplied the same
      families and weights.
    - **The guard, widened.** `tests/indexHtml.test.js` is renamed `tests/thirdPartyAssets.test.js`
      and gains a second test that walks every `src/css/*.css` file for a remote `@import`/`url()`
      — the same class of regression this item just fixed can't land silently again, in either
      `index.html` or a stylesheet.
    - **The real weights.** A repo-wide pass found 177 CSS rules asking for a weight `main.jsx`
      never loaded — the browser was synthesizing all of them from the nearest loaded weight:
      - ~80 rules for Inter 700/`bold` (table headers, item labels, the active nav item, several
        buttons)
      - 4 rules for Inter 800 (`.attendance-log-name`, `.profit-net-label`,
        `.rank-badge-container`, `.stat-pill`)
      - 3 rules for Playfair Display 800 (`.profit-net-value`, `.info-card-value`,
        `.prod-header-title`)

      The rest of the 177 sit on screens that render in Arial, Georgia, or the browser's default
      serif (`html`/`body` sets no `font-family`, so Inter only applies inside containers that set
      it themselves) — those don't need a Playfair/Inter weight at all, and are a separate,
      un-started typography-consistency question for the planned redesign (DESIGN.md §1), not this
      item's concern. `main.jsx` gains `@fontsource/inter/700.css`, `@fontsource/inter/800.css`,
      and `@fontsource/playfair-display/800.css` — no new dependency, since both `@fontsource`
      packages already ship every weight; this just imports three more files already on disk.
    - **Backend cleanup, found alongside this.** `backend/src/app.js`'s helmet CSP still allowed
      `fonts.googleapis.com`/`fonts.gstatic.com`/`cdnjs.cloudflare.com` in `styleSrc`/`fontSrc`/
      `scriptSrc` — harmless (that policy only governs API responses; Nginx serves the frontend
      directly) but stale now that nothing self-hosted needs them. Removed.
    - **Verification.** `grep -r "googleapis\|gstatic\|cdnjs" frontend/dist` returns zero hits —
      this time covering `dist/assets/*.css`, which is what item 27's check missed. The `dist/`
      listing shows Inter 700/800 and Playfair Display 800 woff/woff2 files alongside the existing
      ones. Frontend tests 227 → 228 (the new stylesheet-scan test); lint clean (same 3
      pre-existing `JobOrderDetails.jsx` warnings); both builds clean. Backend tests still 273/273.
      One pre-existing frontend test failure was found during this pass and is unrelated to it:
      `JobOrderDetails.test.jsx`'s auto-select-the-only-worker case fails identically on a clean
      checkout of `main` from before this item (confirmed via `git stash`), so it's a pre-existing
      issue, not something this item introduced or is responsible for fixing.
    - **Still open after this:** only the declined role-shell consolidation remains. DESIGN.md §8's
      remaining deferrals (accessibility, PWA) and the tablet tap-target gap are separate,
      un-started candidates — the tap-target gap is closed next, by item 29.

29. **Tablet tap targets: 44px through 769-1024px, not just mobile** — ✅ done, one commit on
    `main`. Closes DESIGN.md §7's "known residual gap" note left by item 20.
    - **The gap.** `.wb-card-table`'s tap-target rule (`td button/select/input { min-height: 44px
      }`) only applied inside its `max-width: 768px` card-conversion block. At 769-1024px the
      table is still a real `<table>`, so about 20 controls stayed at their raw size — inventory's
      action/reason-select/project-select/adjust controls (~24-25px), the profit table's delete
      icon and expense inputs, WorkerList's edit button, the QA approve/repair buttons, several
      back buttons with `padding: 0`, and a handful of filter/add buttons (38-41px).
    - **Most of the table-cell controls needed no new selector.** Moving the existing rule into
      its own `max-width: 1024px` block (the card-layout conversion itself stays at
      `max-width: 768px`) was enough on its own — `.wb-card-table td button/select/input` is a
      descendant combinator, so it already reaches every control nested inside a converted
      table's `<td>` regardless of depth. That covers inventory's expanded-variants-row controls,
      the profit table, WorkerList's edit button, and `ProjectVerificationDetail`'s approve/repair
      buttons without touching any of those files.
    - **What did need its own rule, because it lives outside any table:** inventory's
      `.filter-btn`/`.add-btn`/`.add-variant-btn`; `admin.css`'s `.profit-spinner-buttons button`/
      `.profit-add-btn`/`.filter-dropdown`/`.btn-add-worker`; `globals.css`'s `.jod-back-btn`/
      `.qc-pvd-back-btn`/`.jod-form-group input`+`select`. Each got its own `max-width: 1024px`
      rule — not applied unconditionally — since DESIGN.md §7's own note was explicit that
      resizing a control at every width, including desktop, is a design decision this pass
      shouldn't make silently. `globals/JobOrderDetails.jsx`'s unstyled "Project not found"
      fallback back button (a bare `<button>` with no class at all) picked up the `jod-back-btn`
      class along the way, gaining both the existing styling and this fix.
    - **Verification.** A scratchpad-only Playwright script (not committed) injected each fixed
      selector's real markup against the built CSS and measured it at 360/768/900/1024/1280px:
      every control is ≥44px in its smaller dimension from 360 through 1024px, and reverts to its
      original compact size at 1280px — confirming the fix doesn't touch desktop, as intended.
      Frontend tests still 227/228 passing (lint clean, same 3 pre-existing
      `JobOrderDetails.jsx` warnings; build clean) — the one failure is the pre-existing,
      unrelated `JobOrderDetails.test.jsx` case noted in item 28. Backend untouched.
    - **Still open after this:** only the declined role-shell consolidation remains on this
      backlog's own list. DESIGN.md §8's accessibility and PWA deferrals are separate,
      un-started efforts — the accessibility pass is next, item 30.

30. **Accessibility pass** — ✅ done, seven commits on `main`. Closes DESIGN.md §8's "a formal
    accessibility standard" deferral. Scoped during planning to: real label associations, visible
    keyboard focus, keyboard-operable clickable rows, dialog behavior (Escape/focus trap/focus
    return), and — per an explicit decision — fixing the two concrete contrast failures found
    (muted text, gold-as-text) rather than only documenting them. A WCAG AA contrast *audit* of
    the full palette beyond those two was not re-litigated; §4's locked palette and the ~92-color
    literal tail stand as before, outside the two specific failures this item fixed.
    - **Labels and accessible names (commit 1).** Of 69 form controls app-wide, only 10 had a
      `<label>` actually tied to their control via `htmlFor`/`id`; the rest were a visually
      adjacent-but-unlinked `<label>`, placeholder-only, or a filter `<select>` using its first
      option as its only label. Linked every one via `useId()` (the pattern `ConfirmModal.jsx`
      already used), starting with the shared components that cover the most call sites —
      `ProjectFormFields` (used by both Create/EditProjectForm), `WorkerJobFields`' four exports
      (used by both Add/EditWorkerModal) — then `AddWorkerModal`, both `Attendance` modals,
      `InventoryTable`'s add/edit modal, `JobOrderDetails`' assign-worker form, and
      `ProjectMaterials`' record-usage form. Every placeholder-only input and first-option-as-label
      filter `<select>` got an `aria-label` instead, since there's no visible label to link; the
      two inventory `<select>`s that already had `title=` got `aria-label` too, since `title` isn't
      reliably announced by screen readers. Every icon-only button (Navbar's hamburger/close,
      Login's show/hide password, InventoryTable's edit/delete, AccountList's delete,
      NotificationList's dismiss, Profit's spinner +/-) got an `aria-label`; every purely decorative
      `<i>`/`<svg>` next to a control that already has one got `aria-hidden`. Weak alt text fixed
      along the way: Login/Navbar's generic "Gavel"/"logo", Logout's misspelled "Wooden Bizzare
      Logo", Attendance's static "avatar" (now the worker's own name).
    - **Keyboard operability (commit 2).** 10 clickable `<div>`/`<tr>` list rows across the app had
      an `onClick` and nothing else — no tab stop, no role, no keyboard activation. New
      `frontend/src/utils/a11y.js` exports `clickableProps(onActivate)`:
      `role="button"` + `tabIndex={0}` + `onClick` + an `onKeyDown` that activates on Enter/Space
      (`preventDefault` on Space so the page doesn't scroll, matching a real `<button>`'s own
      behavior). A row containing its own interactive children (a notification's delete button, an
      inventory row's edit/delete) is handled by checking `e.target === e.currentTarget` before
      activating, so a keydown bubbling up from the inner control doesn't double-fire the row's own
      handler on top of the inner control's — verified with a real dispatched-and-bubbled DOM event
      in `NotificationList.test.jsx`, not a hand-constructed one. Applied to `AccountList`'s
      `.al-item`, `ProjectHistory`'s `.ph-item`, `JobOrder`'s `.jol-item`, `ProjectList`'s
      `.pl-item`, `ProjectVerification`'s `.qc-pv-row`, `WorkerJobOrder`'s `.wjo-item`,
      `NotificationList`'s `.notif-item`, and `Attendance`'s `.att-item`.
      `InventoryTable`'s expandable `<tr className="main-row">` got the same Enter/Space handling
      by hand instead of `clickableProps` — overriding a `<tr>`'s implicit role to `"button"` would
      strip its table-row semantics, so it keeps `role="row"` and gains
      `tabIndex`/`onKeyDown`/`aria-expanded` directly. `Navbar`'s Logout `<div>` became a real
      `<button type="button">`, with a small inline-style reset (background/border, not the
      existing `borderTop` divider — the `border` shorthand would have reset that too) since
      `.nav-item`'s CSS class covers layout/color but not a real button's UA defaults. The active
      sidebar `<Link>` also gained `aria-current="page"`.
    - **Visible focus (commit 3).** Zero `:focus-visible` rules existed, and 27 `outline: none`
      declarations across the CSS removed the browser's default focus indicator with nothing put
      back. New `--color-focus` token (aliased to `--color-info`, #2b4c7e, >3:1 against both white
      and cream) plus one global `:focus-visible { outline: 3px solid var(--color-focus);
      outline-offset: 2px; }` rule — `:focus-visible` rather than bare `:focus`, so a mouse click
      doesn't show a ring the way Tab does. Overridden to `--color-accent` (gold) inside
      `.wooden-navbar`/`.mobile-topbar`, since blue doesn't read against the dark sidebar and gold
      already means "active/focused" there. All 27 `outline: none` declarations removed and checked
      individually: about two-thirds sat in a component's own `:focus` rule that already supplies a
      border-color/box-shadow glow (that glow stays as a second cue layered on top of the new
      outline, not a replacement for it); the rest had no existing replacement and now rely on the
      global rule alone. Two sites needed the removal inside their own `:focus`-scoped rule
      specifically, not just the base rule, since a selector like `.foo:focus { outline: none; }`
      has higher specificity than the bare `:focus-visible` rule and would have kept winning
      otherwise. Verified with a Playwright screenshot against the real built preview (not just
      `getComputedStyle`, which gave an inconsistent read on one focused element despite the rule,
      token, and `:focus-visible` match all checking out correctly by every other means tried) —
      the blue ring renders correctly, layered outside the existing gold glow. New DESIGN.md §3
      rule 9 codifies this.
    - **Dialog behavior (commit 4).** None of the app's 7 modals/drawers handled Escape or managed
      focus — opening one left focus wherever it already was, Tab could walk out of the dialog into
      page content behind the overlay, and closing one never returned focus anywhere. New
      `frontend/src/hooks/useDialog.js`: `useDialog({ open, onClose, initialFocusRef })` returns a
      ref for the dialog's box element; while open it focuses `initialFocusRef` (or the first
      focusable element) on open, traps Tab/Shift+Tab within the dialog, closes on Escape, and
      restores focus to whatever was focused before — only if that element is still in the document
      (the control that opened a dialog can itself have been removed by the time it closes, e.g. a
      deleted row's own delete button). Applied to all 7: `ConfirmModal`/`Logout` (both mounted
      conditionally by their callers, so `open: true` for their whole lifetime — cleanup fires on
      unmount, exactly when the caller stops rendering them); `AddWorkerModal`/`EditWorkerModal`
      (stay mounted with a real `isOpen` prop); `Attendance`'s Add/Edit modals (conditionally
      mounted, same as `ConfirmModal`); `InventoryTable`'s add/edit modal; and `Navbar`'s mobile nav
      drawer — the one structurally different case, since `.wooden-navbar` is also the permanent
      desktop sidebar, not a transient overlay. `role="dialog"` and the dialog behavior there are
      conditional on `isMobileOpen`, which can only become true via the hamburger button that's
      itself only visible on mobile widths, so the trap/Escape/focus-return never engage while this
      element is acting as the plain sidebar. `ConfirmModal` gained an optional `initialFocusRef`
      prop (defaults to its Cancel button — the safer default for a destructive confirmation);
      `ProjectVerificationDetail`'s repair-reason textarea now reaches it through that prop instead
      of its own `autoFocus`, which only ever handled open-time focus and did nothing for Escape or
      Tab-trapping.
    - **Contrast (commit 5), per the confirmed decision to fix rather than only document.** Two
      systemic failures:
      - `--color-text-muted` (#8b816a) measured ~3.9:1 on white and ~3.6:1 on cream — both under
        AA's 4.5:1 floor — and is used in ~65 places. Darkened to #756d5a (~5.1:1/~4.7:1), a
        hue-preserving darkening computed with a scratchpad WCAG relative-luminance script (not
        committed).
      - `--color-accent` (gold) measures ~2.4:1 on white and ~2.2:1 on cream as text — it fails
        outright, not even clearing the 3:1 bar large text gets. ~50 sites used it as text color on
        a light surface: page titles, active tabs, badges, links, buttons, icon fills. Gold stays
        unchanged everywhere it's a fill, a border, or text on the dark sidebar/dark buttons (about
        4 sites — `.prod-tab.active`, the login page's dark-panel subtitle and "mastered." text,
        `.mobile-menu-btn`) — none of those were ever the failure. Everywhere else, each site was
        checked individually for its actual rendered size: large text (≥24px, or ≥18.66px bold —
        WCAG's own large-text exemption, only needs 3:1) moved to `--color-accent-dark`; everything
        else, including icon fills (treated at the stricter bar since an icon's fill color is this
        same token and the two are easy to conflate), moved to `--color-accent-text`. Neither token
        is new — both already existed for other purposes. One stray non-token literal (`#c9a445`,
        `InventoryTable`'s `.min-text`) folded onto `--color-accent-text` alongside the rest. New
        DESIGN.md §3 rule 10 and a "Gold is a fill, not body text" usage note in §4.
    - **Regression guard (commit 6).** `eslint-plugin-jsx-a11y`'s recommended config added to
      `eslint.config.js`, the same role `no-alert` (item 26) plays for native dialogs — a missing
      label, an unlabeled icon button, or a removed-with-nothing-put-back focus outline now fails
      `npm run lint` in CI. Zero new `npm audit` vulnerabilities (confirmed via `git stash` diff).
      Running it surfaced a few real gaps the earlier commits had missed: `WorkerList.jsx`'s
      edit-icon button had no `aria-label` at all; a `WorkerList` search-icon's gold stroke was
      never updated in the contrast commit (missed because that commit's own grep only matched
      `color:`, not `stroke:`); Login's `href="#"` footer link (not a real link — no destination
      exists for this yet) became a plain `<span>`, since an `<a>` claims to navigate and this one
      can't; two group-heading `<label>`s (`ProjectFormFields`' "Project Details",
      `InventoryTable`'s "Variants") weren't associated with any single control — they head a
      *group* of fields, referenced via `aria-labelledby` on each row's `role="group"` instead, so
      they became plain elements with the same look (`.dynamic-section-label`/
      `.variants-group-label`) rather than a `<label>` with nothing to associate to. The four
      click-outside-to-close overlays (`Attendance`'s two custom modals, `Logout`, `Navbar`'s
      mobile drawer) got `role="presentation"` — they're backdrops, not semantic controls;
      `useDialog`'s Escape handling is the real keyboard equivalent. Each dialog's own content
      wrapper kept an `eslint-disable` comment (with a reason) for its `stopPropagation`-only
      `onClick`, since `role="dialog"` is already the correct semantic role there. Four test files
      (`CreateProjectForm`, `EditProjectForm`, `AddWorkerModal`, `InventoryTable`) switched field
      queries from `name`-attribute selectors to `getByLabelText`, removing now-stale "no label
      association exists" comments — that's also the test proving each link actually works.
    - **A real regression, found by verification, fixed (commit 7).** An axe-core sweep (below)
      against a mocked authenticated Admin screen caught one the test suite structurally
      couldn't: `Navbar.jsx`'s user-name subtitle used `--color-text-muted`, and the darkening
      commit 5 applied for legibility on light surfaces actually broke it here — the *original*
      value (#8b816a) passed 4.5:1 against this dark sidebar background (4.67:1); the darkened one
      fails (3.5:1). Confirmed by grepping every other `--color-text-muted` site in both `css/` and
      every `.jsx` inline style — this was the only one on a dark background. Fixed with `#A09A8E`
      instead of the token — not a new color, but the value `.nav-item`'s own CSS already uses for
      its default label text on this same sidebar, so it was already established as the right
      color for this role; passes at 6.4:1.
    - **Verification.** `eslint-plugin-jsx-a11y` clean (0 errors); frontend tests 237 → 245 across
      the pass (new `utils/a11y.test.js`, `hooks/useDialog.test.jsx`, plus cases added to
      `ConfirmModal`/`NotificationList`/`WorkerJobOrder`/`Attendance` tests) — the one
      `JobOrderDetails.test.jsx` failure throughout is the pre-existing, unrelated case noted in
      item 28; lint and both builds clean throughout; backend untouched (273/273). Beyond the test
      suite: a Playwright keyboard-tab sweep against a mocked, authenticated Admin screen confirmed
      every sidebar tab and the Logout button are reachable in logical order with a visible focus
      ring at each stop. An axe-core sweep (`wcag2a`/`wcag2aa` rule sets) ran against the Login page
      (0 violations, 18 checks passed) and three mocked authenticated Admin screens (Dashboard,
      Account List, Worker List) via Playwright route-mocking every `/api/*` call — this is what
      found and confirmed the fix for the regression above.
    - **Found by the axe sweep, confirmed real, deliberately left for a separate pass — not
      silently fixed, since both are pre-existing and outside this item's scoped two contrast
      fixes. Both closed by item 31 below:**
      - `.nav-item.active .nav-label` — white text (`--color-text-inverse`) on the gold active-tab
        fill (`--color-accent`) measures 2.34:1. This is white-on-gold-*fill*, not gold-as-text,
        so it's a different failure mode than either of this item's two scoped fixes; the gold fill
        itself is correct and unchanged per this item's own rule.
      - `.logout-nav-item .nav-label` — `--color-danger` red on the dark sidebar background
        measures 3.61:1. Not a muted-text or gold-as-text case either.
    - **Not independently verifiable in this environment, and not claimed:** real screen-reader
      behavior (TalkBack/NVDA/VoiceOver) — everything above is markup/ARIA/contrast correctness,
      not a live assistive-technology pass. The axe sweep covered the Login page fully and three
      representative Admin screens via route-mocking; it did not cover every screen/role
      combination in the app — item 33 is that full sweep.
    - **Still open after this:** the two findings above (closed by item 31), plus the declined
      role-shell consolidation, which remains open on this backlog's own list. DESIGN.md §8's PWA
      deferral is blocked on TLS (service workers only register on HTTPS or `localhost`, and the
      deployment is HTTP-only on a bare IP until a domain exists — the same dependency
      `COOKIE_SECURE` already has). The font-family fragmentation DESIGN.md records for the
      planned redesign is a separate, un-started candidate.

31. **Finish AA contrast: text on gold fills, and the sidebar Logout red** — ✅ done, three commits
    on `main` plus this doc pass. Closes the two findings item 30's axe sweep left open above.
    - **The sidebar Logout label.** `--color-danger` on `--color-surface-dark` measured 3.61:1,
      under AA's 4.5:1 floor. Rather than retarget `--color-danger` itself (every other use of it
      is on a light surface and already passes), a new `--color-danger-on-dark` token (`#ef5350`,
      ~5.2:1 on the sidebar) covers text/icons on a dark surface specifically; `Navbar.jsx`'s
      Logout button is the only site that needed it — confirmed by grepping every `--color-danger`
      use in the codebase for another one on a dark background, and found none.
    - **Text on gold fills.** The axe sweep's other finding — white text on the active sidebar
      tab's gold fill, 2.34:1 — turned out to be one of about 20 sites with the same problem the
      sweep never reached, since it only covered Login and three Admin screens. A new
      `--color-text-on-accent` token (aliases `--color-text`, ~7.7:1 on `--color-accent`, same
      alias pattern as `--color-focus`) replaced white/`--color-text-inverse` wherever text or an
      icon sits on a solid gold fill: `.nav-item.active`, the sidebar avatar circle, the login
      submit button's hover state, `ConfirmModal`'s primary `.wb-btn-yes` button (used throughout
      the app) and its duplicate declaration in `admin.css`, `.btn-add-worker` (also duplicated,
      one declaration under a literal `#CBA135` rather than the token), `.worker-banner`, the
      profile-photo upload button, the rank-1 leaderboard badge, `JobOrder`'s hover state,
      `ProjectVerification`'s selected-row text, `JobOrderDetails`'s selected-item state,
      `Attendance`'s edit-button hover, `ProjectList`'s edit-button hover, `Profit`'s save-button
      hover, the account-creation tab bar's active state, the Worker job-order "assigned" filter
      pill, and `WorkerJobOrderDetail`'s dark-button hover/active states. One more turned up under
      a literal near-accent gold hex rather than the token: `dashboard.css`'s `.notif-item`
      (`#BC963B`, 2.78:1). The gold fill itself is unchanged at every site, per item 30's "gold is
      a fill, not body text" rule — only the text/icon color on top of it moved. Two sites needed
      an explicit color added back rather than just a value swap, since they'd otherwise have
      inherited the new dark default meant for a different selector at the same specificity:
      `.wb-btn-yes.danger` (red fill, needs its white text back) and the second, cascade-winning
      `.btn-add-worker` declaration.
    - **Checked and deliberately left alone, a different failure mode than either fix above:**
      `account.css`'s `.btn-delete` — white text on a light red fill (`#FF8A8A`), 2.27:1. Found
      while sweeping for white-on-gold sites; it's white-on-*red*, not gold, so it's outside this
      item's two scoped fixes and is recorded here rather than fixed silently.
      `.wjo-filter-btn:not(.active)` (white on a 50%-opacity grey fill) and every `:disabled` state
      (`.wb-btn-yes:disabled`, etc.) were also checked and left: WCAG doesn't require disabled
      controls to meet contrast, and the grey-fill case is a different problem than either of this
      item's two fixes. Both `.btn-delete` and `.wjo-filter-btn:not(.active)` (not a `:disabled`
      control, so actually in scope) are fixed by item 33, which also found the opacity trick
      measures closer to ~1.4:1 against its real white backdrop than the ~50% figure above.
    - **Regression guard.** New `frontend/src/tests/contrast.test.js` parses `globals.css`'s
      `:root` tokens (resolving one-level `var()` aliases), computes the real WCAG contrast ratio,
      and checks it against every pair DESIGN.md §3 rule 10 promises — both new tokens, plus the
      four pairs item 30 already relied on (muted text, gold-as-text, gold icon fills, the focus
      ring) that nothing had been checking directly. Item 30's own regression (found only because
      a manual axe sweep happened to touch the one screen it broke) would have failed this test
      outright had it existed then.
    - **Verification.** The new test's 9 cases pass; frontend tests 245 → 254 across the three
      commits; lint and both builds clean throughout; the one `JobOrderDetails.test.jsx` failure
      noted in item 28 is the only pre-existing gap, unrelated to this item. Contrast ratios for
      every changed pair were computed directly with the WCAG relative-luminance formula (the
      same approach item 30 used) rather than estimated.
    - **Still open after this:** only the declined role-shell consolidation remains on this
      backlog's own list. The `.btn-delete` finding above, and DESIGN.md's font-family
      fragmentation note for the planned redesign, are separate, un-started candidates. The
      `JobOrderDetails.test.jsx` failure this item's verification (and every phase's since item
      28) reported as a pre-existing, unrelated gap is closed by item 32 below — which also found
      a second, independent reason CI itself had been red the whole time.

32. **Make the frontend suite (and CI) green** — ✅ done, three commits on `main` plus this doc
    pass.
    - **CI had been red on `main` since at least 2026-09-28** (`gh run list` showed every run
      since then failing at the frontend job's `npm test` step), which meant `npm run build` and
      the whole `docker-build` job — the only place the Dockerfiles are actually built, per
      CLAUDE.md — had been silently **skipped** on every push across items 28 through 31. Every
      one of those items' own "tests pass, one pre-existing failure" reports were accurate about
      what ran *locally*, on a UTC+8 dev machine; none of them ran in, or reproduced, the CI
      runner's own UTC zone, which is what hid the second failure below.
    - **Root cause 1 — `utils/format.test.js`'s `toDateInputValue` "UTC+8" case only failed in
      CI.** The test's own comment already said it needs to run in Asia/Manila, but nothing
      enforced that; it passed on every UTC+8 local machine and failed on the UTC GitHub Actions
      runner, which is the opposite of what every prior phase's local run could see. Fixed by
      pinning `TZ: 'Asia/Manila'` on `vite.config.js`'s `test.env` — Vitest's test workers inherit
      it regardless of the host's own zone. Reproduced before (`TZ=UTC npx vitest run
      src/utils/format.test.js` failed identically to CI) and after (same command passes) the fix.
    - **Root cause 2 — `JobOrderDetails.test.jsx`'s assign-worker case was a time bomb, not a
      logic bug.** It typed the literal start date `2026-10-05` into an input whose `min` is
      `today` (a real constraint JobOrderDetails.jsx sets and jsdom enforces on submit). It passed
      in CI on 2026-09-28 and failed from the moment the real date passed Oct 5 — exactly the
      single failure every subsequent phase reported as "pre-existing, unrelated." Fixed by
      building the test's dates relative to "now" (a small `isoDateFromToday(days)` helper) instead
      of a literal string, the same way the component itself computes `today`.
    - **Lint.** `JobOrderDetails.jsx` carried 3 `react-hooks/exhaustive-deps` warnings since item
      28 (on the `fetchAllData`, stage-reset, and worker-filter effects) — harmless to CI only
      because `npm run lint` didn't fail on warnings, which is also why they stayed "pre-existing"
      across four phases. Fixed with `useCallback`/`useMemo` and a `workersLoadedRef` in place of
      reading `workers.length` directly (behavior unchanged); `package.json`'s `lint` script is now
      `eslint . --max-warnings 0`, so a new warning can't sit uncounted the same way again.
    - **Verification.** `npm test` 254/254, including a `TZ=UTC npm test` run reproducing the CI
      zone exactly; `npm run lint` clean under the new `--max-warnings 0`; `npm run build` clean.
      Pushed and watched the resulting GitHub Actions run go green across all three jobs —
      `backend`, `frontend`, and `docker-build` — the first fully green run since at least
      2026-09-28, confirming the Dockerfiles still build.
    - **Still open after this:** only the declined role-shell consolidation remains on this
      backlog's own list.

33. **Full axe-core accessibility sweep, all five roles** — ✅ done, four commits on `main` plus
    this doc pass. Item 30's own sweep covered only the Login page and three Admin screens; this
    closes the gap that left open.
    - **The harness.** A scratchpad-only Playwright + axe-core script (never committed, matching
      items 29-31's own verification tooling) serves `frontend/dist` via `vite preview`
      (`VITE_BACKEND_IP` empty, same-origin), mocks every `/api/*` call per role and per status
      value via `page.route`, and visits all 26 routes across every role shell — Login, all 12
      `Admin.jsx` routes, all 7 `ProductionManager.jsx` routes, all 3 `QualityChecker.jsx` routes,
      both `Worker.jsx` routes, and `Inventory.jsx`'s one route — at 1280px and 360px, running
      `axe.run` with the `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tag set at each. Where a screen
      only renders a state after a click (`JobOrderDetails`, `ProjectVerificationDetail`,
      `WorkerJobOrderDetail`, `AccountList`'s and `ProjectList`'s own tabs inside
      `CreateAccount`/`CreateProject`, the mobile nav drawer), the harness drives that click first
      and runs axe again. `axe`'s `incomplete` results (gradients, pseudo-elements, a native
      `<select>`'s background-image, text too short to classify, elements the mobile card layout's
      absolute positioning overlaps) are axe's known inability to auto-resolve those cases, not
      confirmed findings; each is a case this sweep's own fixes (the ones below) don't touch,
      reviewed by hand where the fix mattered and otherwise left as the same expected noise
      `wb-card-table`'s existing conventions already produce.
    - **Found: a systemic gap in the ~85-color literal tail DESIGN.md §4 says was never
      individually contrast-audited** — real violations across every group below, all fixed in
      place (folded onto an existing passing token, never a new literal, per DESIGN.md §3 rule 7).
      Most were caught directly by the sweep; a few sites it never actually rendered (reachable
      only through an interaction deeper than the harness's own click-sequences went, e.g.
      `ProjectDetails`/`EditProjectForm`'s priority text, or `ProjectList`'s in-progress badge
      before its own fix made it render clean) were found the same way — computing the real WCAG
      ratio from the literal values — and confirmed fixed by their absence from every later run:
      - **The "medium"/"high" priority orange failed everywhere it was used as foreground text**
        (`.jol-btn.active.medium`, `.jol-priority.medium`, `worker.css`'s `.wjo-priority.medium` —
        all `#f57c00`, ~2.4-2.7:1 — plus `.project-form-container .priority-select` and
        `.details-main-wrapper .priority-text-high`, both `#e67e22`, ~2.8:1). Neither literal was
        close enough to any existing token to just retarget, so this is a new, deliberately darker
        `--color-warning` (`#9a4b00`) rather than a same-value rename — ~6.2:1 on white, ~5.4:1
        inside a 10%-tint badge.
      - **Three sites a gold *fill* needed `--color-text-on-accent` on, the same rule item 31
        applied everywhere else, that its own sweep (Login + 3 Admin screens) never reached:**
        `admin.css`'s `.type-badge.regular` (white text, ~2.14:1), `inventory.css`'s
        `.variant-pill` (`--color-accent-text`, ~4.44:1), and `admin.css`'s `.rank-silver` leaderboard
        badge — a literal silver, not gold, but the identical "light fill needs dark text" problem
        (white text, ~1.91:1, failing even the 3:1 large-bold-text floor; fixed with
        `--color-text` on the unchanged literal fill, ~9.4:1).
      - **`--color-danger`'s own 10%-opacity tint badge formula — reused from
        `--color-success`/`--color-info`, which both have more luminance headroom — measured only
        ~4.26-4.28:1.** `.jol-priority.high`, `.ph-badge-late`, and a literal-red variant on
        `.att-status-badge.absent` (folded onto the token in the same change) all moved to 6%,
        clearing 4.5:1 (~4.56:1) with a visually negligible change to the tint. The identical,
        currently-unreachable `.wjo-status.rework` (today's "needs repair" status string is
        `Repair`, which maps to `.repair`, not `.rework` — a separate, pre-existing dead-class gap
        recorded below, not fixed) got the same fix for consistency. The literal `#fff0f0` +
        `--color-danger` pairing used at 7 more sites (delete-button hover states in
        `AccountList`/`Profit`/notifications/attendance, `.profit-banner--error`, the project-form
        remove button, `ProjectVerificationDetail`'s repair button) measured a near-identical
        ~4.49:1 and moved to the same 6%-tint formula.
      - **`inventory.css`'s two solid-fill status pills** (`.status-pill.low` — `#ffb3b3` +
        `--color-danger`, ~2.92:1; `.status-pill.good` — `#a3ff99` + `#008000`, ~4.23:1) moved onto
        the same danger/success tint-badge formula as the rest of the app, fixing the ratio and
        folding `#008000` onto `--color-success` in the same change.
      - **`ProjectList.jsx`'s `.status-badge.in-progress`** (`#4a90e2`) measured only ~3.29:1 even
        against solid white — too light a blue to work as text at all, tint or not. Folded onto
        `--color-info`, used for the same "in progress" role elsewhere (`.ph-badge-ontime`,
        `.wjo-status.in-progress`).
      - **The two leftover findings item 31 recorded but didn't fix:** `account.css`'s
        `.btn-delete` (white on `#FF8A8A`, 2.27:1) moved onto `--color-danger` with the same
        `filter: brightness(0.9)` hover convention `.wb-btn-yes.danger` already uses.
        `.wjo-filter-btn:not(.active)` actually measures ~1.4:1 against its real white backdrop —
        worse than item 31's ~50% estimate, since `opacity: 0.5` composites the *whole* button
        (grey fill and white text together) toward the page background rather than just dimming
        the fill, and it isn't a `:disabled` control so it's in scope here. Fixed by dropping the
        opacity trick for a solid `--color-border` fill with `--color-text`, the same pairing
        `ConfirmModal`'s own `.wb-btn-no` secondary button already uses.
      - **The same opacity-compositing bug, found on a second sweep pass after the structural fix
        below:** `NotificationList.jsx`'s `.notif-item.read` used `opacity: 0.85` to look
        "dimmer," which washed `.notif-message`'s `#666666` text (passes ~5.75:1 on its own) down
        to ~3.97:1 together with the row's own `#fafafa` background. Fixed by dropping the
        opacity, keeping the flat background, which already read as "read" against `.unread`'s
        cream fill without it.
    - **Found: two structural violations beyond color.**
      - **`nested-interactive`** on `AccountList.jsx`, `ProjectList.jsx`, and
        `NotificationList.jsx`'s list rows: each wraps a real `<button>` (delete, or Edit+Delete)
        inside a `role="button"` row via `clickableProps()` (item 30's own fix for keyboard
        operability) — axe correctly flags a widget role containing another focusable control,
        regardless of the `e.target !== e.currentTarget` guard already preventing any actual
        double-fire. Fixed the same way at each site: `clickableProps()` moves off the row onto an
        inner `display: contents` wrapper around everything *except* the action button(s), which
        become siblings instead of descendants — no layout change (`display: contents` makes the
        wrapper's own children direct grid/flex items of the real row, exactly as before), and no
        behavior change for anything but the DOM node an assistive-tech user's focus model now
        sees. `ProjectHistory.jsx`, `Attendance.jsx`'s `.att-item`, `JobOrder.jsx`, and
        `ProjectVerification.jsx` use the same `clickableProps()` pattern but don't nest a button
        inside the row — checked and confirmed clean, not touched.
      - **`aria-conditional-attr`** on `InventoryTable.jsx`'s expandable `<tr>`: `aria-expanded` is
        only valid on a treegrid row, not a plain table row. Removed outright rather than
        restructuring the table to `role="treegrid"` — the expand/collapse state is still
        conveyed by the `.active` class and the detail row's own position in document order.
    - **Checked and deliberately left alone, for reasons unrelated to any scoped fix above:**
      - `globals.css`'s `.status-done`/`.status-progress`/`.pv-status-approved`/`.pv-btn-approve`/
        `.pv-status-repair`/`.pv-btn-repair`/`.pv-table`/`.pv-action-buttons` family (several of
        which independently measured as failing, by hand, during this item's audit) has no `.jsx`
        reference anywhere in the app — dead CSS from a removed or refactored component, with no
        live render path for the sweep itself to ever reach. Recorded here rather than fixed
        silently, since cleaning up dead code is a different kind of change than an accessibility
        fix.
      - `.jod-status`/`worker.css`'s `.wjo-badge`/`.ph-badge-pending` render several distinct
        status strings with no color override at all (no background, inherited text) rather than
        failing contrast — e.g. `.wjo-badge` conflates `assigned`/`for-qa`/`approved` into one gold
        tint since only `.repair` gets its own rule. Not a WCAG violation (nothing fails contrast
        if nothing overrides it), so left alone; picking distinct colors for these states is a
        design decision, not a contrast fix.
    - **Regression guard.** `frontend/src/tests/contrast.test.js` gained a `--color-warning`
      pair (plain text, the two literals it replaces) and a new `TINT_PAIRS` suite that
      alpha-composites a `--color-x-rgb` token at its real badge opacity over `--color-surface`
      before measuring — this is what makes `--color-danger`'s own borderline case a real,
      automated regression check instead of something only a manual axe sweep (as happened twice
      in this item) would catch. 254 → 260 tests.
    - **Verification.** The harness ran three times against `frontend/dist`: once before any fix
      (confirming the known item-31 leftovers plus every sweep-reachable finding above, deduped
      from the raw per-screen/per-state axe output down to 13 distinct color-contrast CSS rules
      and the 2 structural rule types), once more after the color/structural commits (down to the
      single `.notif-message` opacity case above, missed in the first pass since it wasn't yet
      fixed), and a final run at 0 violations — only axe's own expected `incomplete` noise
      remains, 47 entries, all reviewed by hand per the categories above. `npm test` 260/260;
      `npm run lint` clean at `--max-warnings 0`; `npm run build` clean. Pushed and watched the
      resulting GitHub Actions run go green across `backend`, `frontend`, and `docker-build`.
    - **Not independently verified, and not claimed:** real screen-reader behavior
      (TalkBack/NVDA/VoiceOver) and legibility on a real device — everything above is
      markup/ARIA/contrast correctness computed against rendered DOM styles, not a live
      assistive-technology or shop-floor pass.
    - **Still open after this:** only the declined role-shell consolidation remains on this
      backlog's own list. The dead `.pv-*`/`.status-done`/`.status-progress` CSS family (removed
      by item 34 below) and the unmapped-status-string distinguishability gaps above are separate
      candidates — the former is now closed, the latter is item 35.

34. **Cleanup: delete the dead CSS item 33 found, and bump CI's `actions/checkout`/`setup-node` to
    v5.** Two small, unrelated fixes the user asked to pick up together right after item 33.
    - **Dead-code confirmation, not just a grep.** A scratchpad script (never committed) pulled
      every class selector out of `frontend/src/css/*.css` and checked whether that exact name
      ever appears as a literal token in any `.jsx`/`.js` under `frontend/src` (excluding test
      files). It deliberately over-reports: anything built dynamically, e.g.
      `status.toLowerCase().replace(...)` producing `.in-progress`/`.for-qa`/`.rework`, or the
      `.active`/`.read`/`.unread` state classes, never appears as a literal string and shows up as
      a false positive — those were filtered out by hand, not deleted. Each real candidate was
      also checked for a same-named rule living in a different stylesheet before deletion, since a
      same-specificity collision (two files defining `.progress-bar` for two different screens,
      for instance) would make "unreferenced in JSX" the wrong question to ask — the right
      question is whether *this specific rule* is the one actually styling something live.
    - **What came out:** `globals.css`'s legacy `JOB ORDER STYLES` section
      (`.job-order-*`, `.details-*`, `.progress-*`/`.progress-table`/`.progress-bar*`,
      `.stage-name`, `.submit-button`, `.submitted-button`) and `PROJECT VERIFICATION STYLES`
      section (the whole `.pv-*` family) — about 640 lines, superseded by the newer
      `.jod-*`/`.qc-pv-*` sections elsewhere in the same file and confirmed to have zero overlap
      with any live selector anywhere else in `frontend/src/css/`. This also removes `#4a8a4a` and
      `#5a7aba`, the two dead-but-mathematically-failing literals item 33 found and deliberately
      left alone pending this item. `InventoryTable.jsx`'s own `.progress-bar`/
      `.progress-bar-container` (a real, live variant-stock-level bar, `inventory.css`) share a
      class name with the now-deleted dead rule but were independently confirmed self-contained in
      `inventory.css` — deleting the dead copy only removes a latent same-name collision risk, it
      changes nothing about how that bar renders.
    - **Scope kept deliberately narrow.** The same scan surfaced roughly 150 more "possibly dead"
      selectors across `account.css`, `dashboard.css`, `admin.css`, and `worker.css` (an old
      `.notification-*`/`.admin-notification-*` family superseded by `NotificationList.jsx`'s
      `.notif-*` classes, an old `.worker-modal`/`.worker-form-*`/`.worker-view-*` family, etc.).
      These were named only in the "dead CSS" option offered to the user as the `.pv-*`/
      `.status-*` family specifically, not a general dead-CSS audit, so they're left alone here —
      recorded as a real, separate candidate for later, not silently rolled into this item's scope.
    - **CI.** `.github/workflows/ci.yml`'s `actions/checkout` and `actions/setup-node` moved from
      `@v4` to `@v5` in all three jobs (`backend`, `frontend`, `docker-build`'s one `checkout`
      step) — this is exactly what GitHub's "forced to run on Node.js 24" annotation named.
      `docker/setup-buildx-action@v3` and `docker/build-push-action@v6` weren't flagged and were
      left as they are.
    - **Verification.** `npm test` 260/260 (unchanged — nothing deleted was under test, since
      nothing deleted was reachable); `npm run lint` clean at `--max-warnings 0`; `npm run build`
      clean (one iteration caught a real mistake: a `*/` sequence inside the explanatory comment
      left in place of the deleted block closed the CSS comment early and broke the build —
      fixed by rewording before this ever reached a commit). Pushed and watched the GitHub Actions
      run go green with the Node 20 deprecation annotation gone.
    - **Still open after this:** the declined role-shell consolidation, the ~150 other
      possibly-dead selectors noted above (not started — later finished in item 39), and item 35
      (status-badge colors) and item 36 (font consistency) — both approved as later phases of
      this same multi-part request.

35. **UI: give every `task_status` value one shared colour.** Closes the distinguishability gap
    item 33 recorded (`.jod-status`, `.wjo-badge`, `.ph-badge-pending` conflating several distinct
    statuses into one undifferentiated look) rather than leaving it as a "design decision for
    later" — the second phase of the same multi-part request item 34 opened.
    - **Three independent, gapped mappings for one enum.** `task_status` is
      `Assigned, In Progress, For QA, Rework, Approved, Repair`
      (`backend/src/schemas/common.js`). `worker/WorkerJobOrderDetail.jsx`'s `.wjo-status` had no
      colour at all for `Repair` (only the dead `.rework` class did, since the live status string
      is `Repair`, not `Rework`); `worker/WorkerJobOrder.jsx`'s `.wjo-badge` gave `Assigned`,
      `In Progress`, `For QA`, and `Approved` the identical gold tint and only singled out
      `Repair`; `globals/JobOrderDetails.jsx`'s `.jod-status` only ever coloured `In Progress`
      (`.done` was dead — no live status is ever `"done"`). `admin/ProjectHistory.jsx`'s
      "not finished yet" badge (`ph-badge-pending`) gave every one of those four statuses the same
      flat cream look instead of distinguishing them at all. All three components also built their
      class name with `status.toLowerCase().replace(' ', '-')`, which only replaces the *first*
      space — latent, since no current status has two.
    - **One helper, one palette.** `utils/status.js`'s `taskStatusClass(status)` maps the enum
      explicitly (so the first-space bug can't recur) and returns a shared `wb-status wb-status--*`
      pair; `Rework` and `Repair` share the `repair` modifier (both mean "sent back"), and anything
      unmapped — `null`, `''`, an unrecognized string — gets `neutral` rather than silently
      rendering with no class. The six modifiers (`globals.css`, next to `.wb-card-table`) reuse
      `contrast.test.js`'s existing `TINT_PAIRS` opacities: accent/gold at 10% for Assigned, info
      at 10% for In Progress, the item-33 `--color-warning` at 10% for For QA, success at 12% for
      Approved, danger at 6% for Repair/Rework, and a solid `--color-border` fill for `neutral`.
      `.wjo-status`, `.wjo-badge`, `.jod-status`, and `ph-badge`'s default case now carry only pill
      shape (padding/radius/font-size/min-width); colour comes from whichever `.wb-status--*`
      class `taskStatusClass()` adds alongside it. `JobOrderDetails.jsx`'s now-unused
      `getStatusClass` helper and `admin.css`'s dead `.ph-badge-pending` rule were deleted outright
      rather than left in place unreferenced.
    - **A real contrast bug the badges' own translucency created, caught before it shipped.**
      Each `.wb-status--*` tint is layered as `linear-gradient(rgba(...), rgba(...)), var(--color-surface)`
      instead of a plain `rgba()` fill, so the pill always composites against opaque white
      regardless of the row underneath it. Several of these rows (`.wjo-item`, `.jod-table tr`,
      `.wjo-table tr`) turn `--color-surface-cream` on hover or when active; a danger tint computed
      by hand against that cream backdrop (not `--color-surface`) measured only ~4.20:1, under
      4.5:1 — a real, row-state-dependent failure axe's static sweep structurally cannot see, since
      it never fires `:hover`. The gradient-over-opaque-white fix sidesteps the problem rather than
      hand-tuning a second opacity for the cream case, and is also what makes `contrast.test.js`'s
      `TINT_PAIRS` math (which composites each tint over `--color-surface` specifically) true for
      these pills in *every* row state they can appear in, not just the resting one.
    - **Filter pills aligned to match.** `worker.css`'s `.wjo-filter-btn.repair`/`.for-qa` used to
      be a dark-espresso and golden-brown solid fill respectively — FR-9's own comment claimed
      these "matched `.wjo-status`'s hues," which was never true, since `.wjo-status` had no colour
      for Repair at all. Both now use the same `--color-danger`/`--color-warning` solid fills the
      palette above uses, with the base rule's white text measuring ~4.98:1 and ~6.21:1.
    - **Palette choices, flagged rather than decided silently:** Repair/Rework landing on red, and
      For QA landing on the item-33 warning-amber, are both one-line changes in `globals.css`'s
      `.wb-status--repair`/`--for-qa` if a different pairing (the old espresso, the old cream) is
      preferred.
    - **Tests.** A new `utils/status.test.js` covers every enum value, the `Rework`→`repair`
      alias, and the `neutral` fallback for `null`/`''`/an unrecognized string.
      `WorkerJobOrderDetail.test.jsx`'s existing Repair-reason test, `WorkerJobOrder.test.jsx`,
      `JobOrderDetails.test.jsx`, and `ProjectHistory.test.jsx` each gained an assertion that a
      Repair/For QA/Approved row renders with its matching `wb-status--*` class — 260 → 276 tests.
      `contrast.test.js` gained the two filter-pill solid pairs
      (`--color-text-inverse` on `--color-danger`/`--color-warning`) and the one `TINT_PAIRS` case
      the existing set didn't cover (`--color-accent-text` on the accent tint, for Assigned).
    - **Verification.** `npm test` 276/276; `npm run lint` clean at `--max-warnings 0`;
      `npm run build` clean. Re-ran the scratchpad axe-core sweep (item 33's harness, whose
      fixtures already exercise every `task_status` value) against the rebuilt `dist`: 0
      violations, `incomplete` up from item 33's final 47 to 52 — exactly the five new
      `.wb-status--*` pills, each flagged only because axe can't auto-resolve a `linear-gradient`
      background, not because any of them actually fail; `contrast.test.js`'s `TINT_PAIRS`/`PAIRS`
      math is what actually confirms each one passes. Pushed and watched CI go green.
    - **Still open after this:** the declined role-shell consolidation, the ~150 possibly-dead
      selectors item 34 recorded, and item 36 (font consistency) — the last approved phase of this
      multi-part request.

36. **UI: fix the font-family inconsistency DESIGN.md §8 recorded.** The last of the four-part
    request items 34–35 opened.
    - **No app-wide default existed at all.** `globals.css`'s `html, body` reset set `margin`,
      `padding`, and sizing, but never `font-family` — so every screen rendered whatever its own,
      per-component declaration said, or the browser's default sans-serif where nothing was set.
      Fixed with one line on that reset: `font-family: 'Inter', sans-serif;`, matching item
      27/28's self-hosted base font.
    - **A full audit of every `font-family` in `frontend/src/css/*.css`** (confirmed there's no
      `font:` shorthand usage anywhere, so grepping the longhand property is a complete list)
      found, beyond the expected stray `Arial`/`Georgia` one-offs:
      - **A real, silent bug**: `TempSignup.css`'s `.signup-wrapper .form-title` declared
        `font-family` *twice* on the same rule — `'Playfair Display', serif` (with a comment
        explaining the contrast reasoning behind that choice), then four lines later
        `Georgia, 'Times New Roman', Times, serif`. CSS takes the last declaration on a
        duplicate property, so this heading had been silently rendering in Georgia the whole
        time despite the comment's intent. Fixed by deleting the second, overriding line.
      - **A typo**: `globals.css`'s `.attendance-log-title h3` had
        `font-family: 'Arial', 'san-serif';` — the fallback is misspelled (missing an "s").
        `Arial` itself is valid, so this mostly worked by accident; it's a heading, so it now
        gets the same `Playfair Display` every other section title has.
      - **`dashboard.css` is entirely dead** — confirmed via `grep -rln "dashboard.css"` against
        every `.jsx`/`.js`: never imported anywhere. Its two bare-`serif` headings were fixed
        anyway (trivial one-line edits, cosmetic-only, no live effect), the same precedent as
        item 33's `.wjo-status.rework`, with a comment left in the file explaining why. This
        doesn't reopen item 34's separate, larger "~150 possibly-dead selectors" question.
    - **The fix, applied per element role, not blanket-deleted:** a heading/title gets
      `'Playfair Display', serif`; a form control (`<input>`/`<select>`/`<button>`/`<textarea>`,
      none of which inherit `font-family` from their ancestor by default in any browser) gets
      `inherit`; everything else (a `div`/`form` wrapper, body text) simply loses the stray
      declaration so it inherits the new `html`/`body` default. About 20 sites across
      `globals.css`, `admin.css`, `inventory.css`, `TempSignup.css`, and `dashboard.css` were
      touched this way. Two pre-existing `'Inter', Arial, sans-serif'` fallback stacks
      (`globals.css`) and `account.css`'s `"Font Awesome 6 Free"` icon font were left alone —
      already consistent, or not a typeface choice at all.
    - **Regression guard.** A new `frontend/src/tests/fontConsistency.test.js`, built the same
      way `thirdPartyAssets.test.js` is (same `listCssFiles` walk), asserts every `font-family:`
      value found anywhere under `frontend/src/css/` is one of the five allowed values above — a
      future stray declaration fails CI instead of drifting back in unnoticed.
    - **Verification.** `npm test` 277/277 (276 → 277); `npm run lint` clean at
      `--max-warnings 0`; `npm run build` clean. Re-ran the item-33 axe harness against the
      rebuilt `dist`: still 0 violations, 52 `incomplete` (unchanged from item 35's final count —
      a font swap doesn't touch color contrast, and this confirms it didn't). Took a handful of
      Playwright screenshots of the screens with the most text-density risk from the metric
      change (Admin dashboard, WorkerList, Attendance, Inventory) at 1280px and 360px and checked
      by eye for new overflow or clipping — this is where a pre-existing `.admin-stats-grid`
      clip at 360px was first noticed and confirmed unrelated to this change (git-stash A/B
      screenshot comparison against the pre-fix Georgia rendering, pixel-identical either way).
      That clip is a real, separate bug — fixed below, in item 37, not here. The `3e0cf77` commit
      message says this document records it; it didn't, until this correction.
    - **Still open after this:** only the declined role-shell consolidation, and the ~150
      possibly-dead selectors item 34 recorded, remain on this backlog's own list. This closes
      out the full four-part request (items 34–36). The `.admin-stats-grid` clip noticed along the
      way became item 37, a separate, later-approved item.

37. **UI: stop the dashboard stat cards clipping on phones and with long values.** A real bug
    noticed (but correctly left unfixed, as out of scope) while verifying item 36; picked up next
    once the user chose it from the post-item-36 backlog discussion.
    - **A corrected diagnosis.** The clip was first attributed to `.admin-stat-card`/
      `-label`/`-value`/`-sub` (`globals.css`, the `ADMIN DASHBOARD STYLES` section). Those rules
      have no JSX reference anywhere — dead code, confirmed the same way item 34 confirmed its
      own dead selectors. The live card is `globals/InfoCard.jsx`'s `.info-card`/`-label`/
      `-value`/`-sub` family, which the three dashboard screens (`admin/A_Dashboard.jsx`,
      `product_manager/PM_dashboard.jsx`, `quality_checker/QCDashboard.jsx`) all render through.
      Item 36's "pre-existing, not a font regression" conclusion still holds either way —
      `.info-card-label`/`-value` set their own `font-family` explicitly, so item 36 never touched
      them.
    - **Three independent causes, not one.**
      - `.admin-dashboard`'s own `padding: 40px` stacked on top of `.page-content`'s mobile
        `15px` side padding, leaving roughly 250px of width for a 3-column grid at 360px.
      - `.admin-stats-grid` kept `grid-template-columns: repeat(3, 1fr)` at every width, with no
        mobile override — about 62px per card once the double padding above is included.
      - `.info-card-value` was a fixed `3rem` regardless of card width or content length —
        clipping `₱48,230.50`'s leading `₱` even at 1280px desktop width, and badly for a
        realistic 7-figure value (`₱1,234,567.89`).
    - **Fix, each cause addressed separately.**
      - A `@media (max-width: 768px)` block (the codebase's existing breakpoint — DESIGN.md §3
        rule 2) zeroes `.admin-dashboard`'s own padding and stacks `.admin-stats-grid` to one
        column. `product_manager/PM_dashboard.jsx` and `quality_checker/QCDashboard.jsx` keep
        their own inline `style={{ display: 'flex', ... }}` override regardless, so they're
        unaffected either way — the width they now have is just wider, which is what let their
        cards stop needing to shrink below their own `minWidth`.
      - `.info-card`'s fixed `height: 160px` became `min-height: 160px` (a wrapped label/sub now
        grows the card instead of being cut off by `overflow: hidden`), plus `container-type:
        inline-size` so `.info-card-value`'s size can respond to the *card's* width, not the
        viewport — the three dashboards give this same component very different widths (a grid
        column vs. a 250–400px flex item).
      - `.info-card-value` gained a `min(3rem, 23cqi)` ceiling (shrinks only once the card itself
        narrows — short counts like `5`/`12` still render at the full `3rem` on every width this
        app uses) and a new `.info-card-value--long` modifier (`min(3rem, 14cqi)`) that
        `InfoCard.jsx` applies once the formatted value passes 7 characters — sized so a
        13-character value (a realistic 7-figure ₱ amount) fits the card at any width.
      - A real cascade-order bug caught before it shipped: the mobile override was first written
        inside `globals.css`'s earlier, shared `RESPONSIVE DESIGN` block (around the file's
        `.page-content` mobile rules). At equal specificity CSS resolves ties by source order,
        and the unconditional `.admin-stats-grid`/`.admin-dashboard` rules sit *later* in the
        file (the `ADMIN DASHBOARD STYLES` section) — so the later, unconditional rule was
        silently winning over the earlier media-query override at every width, and the first
        screenshot pass still showed the exact pre-fix clip. Moved the override to directly
        after the unconditional rules it's meant to override, confirmed by rebuilding and
        re-screenshotting.
    - **Tests.** New `globals/InfoCard.test.jsx` — label/value/sub rendering, each variant's
      border class, and that only a value over 7 characters (checked against
      `utils/format.js`'s `formatCurrency`) gets `--long`. `InfoCard.jsx` was previously untested
      directly (CLAUDE.md listed it as exercised only indirectly via each dashboard's own test) —
      that line is updated.
    - **Verification.** `npm test` 283/283 (277 → 283); `npm run lint` clean at
      `--max-warnings 0`; `npm run build` clean. A scratchpad Playwright script screenshotted all
      three dashboards at 360/800/1280px, with both the fixture's normal profit value and a
      temporary 7-figure override, and asserted `document.documentElement.scrollWidth <=
      clientWidth` at every combination (DESIGN.md §3 rule 1) — 18 combinations, zero overflow,
      confirmed visually too (one column at 360px, no clipped text at any width or value length,
      the shrink-to-fit only visibly engaging on the long value at 800px/360px). Re-ran the
      item-33 axe harness against the rebuilt `dist`: 0 violations, 51 `incomplete` (down 1 from
      item 36's 52 — the new `.info-card-value--long` selector is the same gradient-background
      card axe already couldn't auto-resolve pre-fix, just renamed; the one-entry drop is axe's
      own selector/dedup heuristics shifting, not a fix or a regression — `contrast.test.js`'s
      hand-computed math, unchanged by this item, is what actually confirms the `.info-card-*`
      family passes). Pushed and watched CI go green.
    - **Still open after this:** the declined role-shell consolidation, and the ~150 possibly-dead
      selectors item 34 recorded.

38. **Triage and fix the `npm audit` warnings.** Both halves had accumulated findings nobody had
    actually triaged — earlier items only ever checked they hadn't *added* new ones (item 21's
    own backend count, item 28's frontend count, item 33's lint-gate commit). Picked up from the
    post-item-37 backlog discussion.
    - **Fresh counts going in:** backend 9 (1 critical, 6 high, 1 moderate, 1 low); frontend 13
      (10 high, 2 moderate, 1 low). My own earlier backlog summary guessed the frontend ones were
      "probably build/test tools that never ship" — true for frontend, **wrong for backend**: 5
      of the backend's 9 ship in the Docker image (`backend/src/Dockerfile` runs `npm ci
      --omit=dev`), confirmed by diffing `npm audit` against `npm audit --omit=dev`.
    - **Triaged, not just patched** — reachability checked against the real code, not assumed
      from the advisory text alone:
      - `proxy-addr` (critical, ships): the IPv4-mapped-IPv6 subnet-matching bug only fires when
        `trust proxy` is configured with a *list* of trusted subnets. `app.js` sets it to the
        number `1` (`app.set('trust proxy', 1)`), which Express's own `compileTrust` turns into
        `(a, i) => i < 1` — a hop-count check that never touches the vulnerable subnet-matching
        code path at all. Not reachable here. Fixed anyway (no-op version bump).
      - `compression` (high, ships): `app.use(compression())` at `app.js:63` is real and
        unconditional. The memory-leak-on-premature-close bug is a genuine DoS risk on the
        1-vCPU/4GB target VPS. Reachable, fixed.
      - `qs` (moderate, ships): `express.urlencoded({ extended: true })` at `app.js:107` parses
        with `qs`. Reachable, fixed.
      - `body-parser` (low, ships): the bug needs an *invalid* `limit` value to silently disable
        size enforcement; `app.js` passes the valid literal `'1mb'`. Not reachable. Fixed anyway.
      - `react-router`/`react-router-dom` (high, ships in the bundle): grepped every `navigate()`
        call and every `<Navigate>` in the frontend. Every target is either a hardcoded literal
        (`'../job-order'`, `'../project-verification'`, the `*Notification.jsx` resolvers) or a
        fixed `redirectPath` prop (`auth-components/ProtectedRoute.jsx`) — never
        user-controlled input. Most of the advisories are SSR/RSC/framework-mode bugs
        (`__manifest`, vendored turbo-stream deserialization, `deserializeErrors` SSR hydration)
        this client-only SPA with no server-rendering doesn't use at all. The one that's at all
        client-side-reachable, the `<Link>`/`useNavigate` open redirect, needs a
        user-controlled navigation target to exploit. Not reachable. Fixed anyway (no source
        changes needed — a version-range bump only).
      - `braces` (high, dev-only via `nodemon` → `chokidar`): **no fixed version exists yet** —
        npm's only offer is `npm audit fix --force`, which downgrades `nodemon` to `1.14.10`, a
        real breaking change to accept for a dev-only file watcher. Declined; accepted as open.
        It never ships (confirmed via `npm audit --omit=dev`), and it would only matter if
        `nodemon`'s file-glob matching ever ran against attacker-controlled input, which it
        doesn't in local dev.
      - Everything else on both sides (`brace-expansion`, `source-map-js`, and, frontend-only,
        `vite`, `postcss`, `nanoid`, `undici`, `js-yaml`, `browserslist`, `@babel/core`,
        `@humanfs/node`, `baseline-browser-mapping`) is build/lint/test tooling — `vitest`,
        `vite`, `eslint`, `nodemon`'s own transitive tree — never part of the shipped image or
        bundle. Fixed anyway; all were plain in-range version bumps.
    - **Fix:** `npm audit fix` (no `--force`) in each half. Every change landed inside the
      existing `package.json` version ranges — `package.json` itself is untouched in both halves,
      only the two lockfiles changed. Backend: `proxy-addr` 2.0.7→2.0.8, `compression`
      1.8.1→1.8.2, `qs` 6.15.0→6.16.1, `body-parser` 2.2.2→2.3.0, `brace-expansion` 5.0.5→5.0.12,
      `source-map-js` 1.2.1→1.2.2. Frontend: `react-router`/`react-router-dom` 7.14.0→7.18.4,
      `vite` 8.0.3→8.3.4, `postcss` 8.5.8→8.5.31, `undici` 8.10.0→8.12.3, plus the transitive
      bundler (`rolldown` 1.0.0-rc.12→1.2.14) and CSS minifier (`lightningcss` 1.32→1.33) vite
      pulls in — the minifier matters here since it's what processes item 37's new container
      queries.
    - **A real local-environment snag, unrelated to the project, caught and fixed along the
      way:** two `vite preview` processes orphaned from earlier sessions' verification scripts
      (the same Windows `spawn(..., {shell:true})` orphaning pattern documented in items 33/37 —
      `.kill()` only terminates the shell wrapper, not the real grandchild server) were holding
      the old `rolldown` native binding file locked on disk. That caused `npm install` to
      silently leave `node_modules` in a half-upgraded state (the package manifest said 1.2.14,
      the actual `.node` binary on disk was still the old build), which broke `vitest` outright
      (`Cannot convert undefined or null to object` inside rolldown's error path) until
      diagnosed and the stale processes killed.
    - **Decided, not just left alone:** no CI audit gate (e.g. `npm audit --audit-level=high`) is
      being added. The user's call — advisories get published on their own schedule, unrelated to
      any given push, so a hard gate would turn CI red on commits that changed nothing; a
      periodic manual re-check (like this item) does the same job without that noise.
    - **Verification.** Backend: `npm test` 273/273; `npm audit` now shows only the accepted
      `braces` chain (3 entries, all transitive through dev-only `nodemon`); `npm audit
      --omit=dev` shows **0**. Frontend: `npm test` 283/283; `npm run lint` clean; `npm run
      build` clean, output byte-identical in size to the pre-fix build (`index-*.js` 399.62 kB,
      `index-*.css` 183.04 kB, same file count); `npm audit` shows **0**. Because of the
      bundler/minifier bump specifically: re-ran item 37's 18-combination Playwright screenshot
      sweep against the rebuilt `dist` (still zero horizontal overflow at every width/value
      combination) and the item-33 axe harness (still 0 violations, 51 `incomplete` — identical
      to item 37's post-fix count, confirming the dependency bump changed nothing behaviorally).
      Pushed both halves as separate commits (so a regression in one bisects independently) and
      watched CI go green, including `docker-build` — the real check that `rolldown`'s and
      `lightningcss`'s Linux-only optional native binaries still resolve correctly from a
      lockfile written on Windows.
    - **Still open after this:** the declined role-shell consolidation, the `braces` advisory
      (no fix exists upstream yet), and the ~150 possibly-dead selectors item 34 recorded.

39. **Cleanup: delete the dead CSS item 34 recorded.** Item 34 flagged "~150 possibly dead
    selectors" as a real, separate candidate and deliberately left them alone. Items 35 and 37
    already removed a few along the way; this closes out what was left.
    - **Method.** Re-ran item 34's scratchpad class-name scan (every `.css` class that never
      appears as a literal token in any non-test `.js`/`.jsx`) — it reported 106 this time. Every
      hit was checked by hand, not deleted on the scan's say-so alone.
    - **Two things changed the picture from a simple class-by-class trim:**
      - **Four stylesheets are never imported anywhere**, so every rule in them was dead whatever
        its class names said: `account.css` (191 lines, everything scoped under
        `.account-creation`, a class nothing renders), `dashboard.css` (123 lines — its own header
        comment already said it was dead), and the two empty `pm.css`/`qualitychecker.css`.
        Confirmed by grepping every `import`/`@import` across `frontend/src`. Deleted outright.
      - **About 40 of the 106 hits were false positives**, kept: classes built at runtime
        (`.wb-status--*` via `taskStatusClass`, `.att-status-badge.late`/`.half-day`
        (`Attendance.jsx`), `.priority-high`/`.priority-text-high` via `priority-${...}`), and
        names that only ever occur inside a comment (`.details-`, `.job-order-`, `.progress-`,
        `.pv-`, `.jod-`, `.qc-pv-`, `.admin-stat-card`, `.rework`, and the item-34/37 tombstone
        text itself).
    - **What came out of the three live files**, each left as a one-line tombstone comment
      naming what was there and why (same convention as items 34/37 — and checked every one for a
      stray `*/` this time, since writing exactly that bug into one of these comments is how item
      34 broke its own build): `globals.css`'s old `.admin-notifications-*`/
      `.admin-notification-*`/`.admin-btn` block and the whole "NOTIFICATION SECTION (GLOBAL)"
      `.notification-*` family (both superseded by `NotificationList.jsx`'s `.notif-*` classes),
      plus `.jod-ov-scroll-icons` and `.qc-pv-col-left`; `admin.css`'s
      `.create-account .placeholder-box`, the old `.worker-modal*`/`.worker-form-*`/
      `.worker-select-*`/`.worker-view-*` family (superseded by the live `.add-worker-modal`),
      `.ph-item.active-row` (`ProjectHistory.jsx` only ever renders `"ph-item clickable-row"`),
      and `.notif-title-group`/`.notif-time` (their live `.notif-*` siblings stay); `worker.css`'s
      `.wjo-progress-bar-wrapper`/`-bar`/`-fill`/`-text` and their mobile overrides
      (`.wjo-progress-header` is live and stays), and the mobile `.dropdown-menu`/
      `.dropdown-options-container` rule, whose own Tagalog comment already said to replace it
      with the real class name and nothing ever did.
    - **Left alone on purpose:** the `@keyframes fadeIn` defined identically in both `admin.css`
      and `globals.css` — a real duplicate, not dead code, since both copies are referenced by a
      live rule in their own file. Element and ID selectors were out of scope (the scan is
      class-based only, and there are no ID selectors in this codebase anyway).
    - **New guard: `frontend/src/tests/stylesheetImports.test.js`.** A class-name scan can't catch
      "a whole file nobody imports" — nothing inside `account.css`/`dashboard.css` was the bug,
      the missing import was. This test walks `src/css`, collects every `import '...css'`
      specifier from non-test `.js`/`.jsx` under `src`, and asserts every file under `src/css` is
      imported somewhere. `fontConsistency.test.js`'s allowlist lost its `"Font Awesome 6 Free"`
      entry, since `account.css` was the only file that declared it and `account.css` is gone —
      the real icon font (`main.jsx`'s `@fortawesome/fontawesome-free` import) is unaffected.
    - **Verification.** `npm test`: 284/284 (283 + the new guard). `npm run lint --max-warnings 0`:
      clean. `npm run build`: clean; built CSS dropped from 183.04 kB to 175.38 kB, JS unchanged
      at 399.62 kB (no `.jsx` touched). Distinct hex-color literals across `src/css` (same
      grep-based count as DESIGN.md §4's "literal tail") dropped from 95 to 81, 14 gone with the
      dead rules.
      - **Computed-style diff, not just a visual spot-check.** Built the pre-item-39 tree and the
        post-item-39 tree to two scratchpad output directories (outside `frontend/`, so ESLint
        never sees them — item 38's lesson), served both with a tiny static file server (`vite
        preview` won't serve an arbitrary external directory), and for every role/route in the
        item-33 harness's route list, at 1280px and 360px, dumped every element's
        `getComputedStyle` keyed by a DOM path and diffed the two JSON dumps. First pass showed 41
        differences, all `opacity`/`height`/`boxShadow` noise from in-flight CSS animations
        (`fadeInUp`/`orbFloat`/`goldPulse`) and a font-load race affecting native `<select>`
        height by 1–2px. Re-ran with `prefers-reduced-motion: reduce` emulated and an explicit
        `document.fonts.ready` wait: down to 23 diffs, all still the same `<select>`-height/
        `boxShadow` shape. To rule out the CSS change itself, swept the **same** post-item-39
        build against itself twice — the identical shape of diff reappeared comparing a build to
        itself, which is conclusive: it's rendering non-determinism (native control metrics,
        sub-pixel animation sampling), not anything this item changed. **Zero diffs are
        attributable to the CSS deletions.**
      - Re-ran the item-33 axe harness against the rebuilt `dist`: 0 violations, 51 `incomplete`
        — identical to item 38's post-fix count, confirming no behavioral regression.
    - `git diff --stat` across both code commits showed only the expected CSS/test files — no
      `package.json`/lockfile changes, since this item touched no dependency.
    - Pushed both commits plus docs, watched CI go green.
    - **Still open after this:** the declined role-shell consolidation, the `braces` advisory (no
      fix exists upstream yet), and the legacy `worker_details.photo` column drop (item 21) —
      closed by item 41 below.

40. **Remove `TempSignup`, the user asked for it directly.** P0-1 (above) already closed the
    security hole — `POST /signup` was put behind `requireRole('Admin')` and `/protoacc`, the
    public unauthenticated route, was deleted — but left `TempSignup.jsx` itself in place as the
    real body of the Admin "Account Creation" tab, since at the time it was the only way to create
    a non-Worker account at all. The user asked for it to be removed outright and replaced with a
    proper form, plus sample accounts seeded for local testing.
    - **The gap this also closed:** `accountBody` (ex-`signupBody`) let a caller pick
      `userRole: 'Worker'`, which created a `users` row with no matching `worker_details` — no
      wage rate, no job role, until a second edit (PRD.md B.5's "Account provisioning" called this
      out directly). `userRole` now excludes `'Worker'` server-side
      (`z.enum(USER_ROLE.filter(r => r !== 'Worker'))`), so creating one that way is a 400, not a
      silently incomplete account.
    - **Backend: `POST /signup` → `POST /users`.** Moved to sit next to the existing
      `GET`/`DELETE /users`, behind the same `ADMIN_ONLY`; returns 201 instead of 200;
      `accountBody`'s password floor raised to 8 characters, matching
      `scripts/createAdmin.js`'s own. New `tests/userRoutes.test.js` covers the 201 path, the
      `Worker`-rejected-here path, the under-8-character-password rejection, and that
      `/api/signup` now 404s. `tests/routeAuthorization.test.js`'s table follows the rename.
    - **Frontend: new `admin/AccountForm.jsx`.** Renders in `CreateAccount.jsx`'s "Account
      Creation" tab in `TempSignup`'s place. First/Middle/Last name, Suffix, Username, Password (8+
      chars), Confirm Password, and a required Account Role select that starts empty so nobody
      lands on a privileged role by default. Choosing Worker reveals a Job Information section
      built from the same `admin/WorkerJobFields.jsx` pieces and `globals/PhotoUpload.jsx`
      `AddWorkerModal.jsx` already uses — a photo is required, same as there. Submitting posts to
      `POST /api/workers` for Worker and `POST /api/users` for everything else; a password
      mismatch blocks the request client-side with a toast; a server failure keeps the form as
      typed. `TempSignup.jsx`/`.test.jsx`/`.css` are deleted outright, along with `App.jsx`'s now
      dead `/protoacc` comment and `globals.css`'s now-unreferenced `.signup` rule (tombstoned).
      New `admin/AccountForm.test.jsx` covers every field by label, the Worker section appearing/
      disappearing, both endpoints' exact request bodies, the disabled-until-photo state, and the
      keep-form-on-error path.
    - **New `scripts/seedSampleAccounts.js`** (`npm run seed:accounts`), the same shape as
      `scripts/createAdmin.js`: one account per role (Admin/PM/Inventory/QC) plus one Worker per
      `STAGE` value, passwords randomly generated per run
      (`crypto.randomBytes(12).toString('base64url')`, 16 characters), written to
      `docs/tmp/sample-accounts.md` — never to a commit, never to stdout. Refuses to run with
      `NODE_ENV=production`. Idempotent: a username that already exists is left untouched, and
      since its real password isn't known to a later run, the script now reads its OWN previous
      output file first and carries that account's previously recorded password forward, rather
      than overwriting the one place it's written down with a placeholder — caught by actually
      re-running the script twice during verification and noticing the second run had silently
      discarded the real passwords before this carry-forward existed.
    - **`docs/tmp/`** added to the root `.gitignore` — these are real, working passwords on
      whatever database `backend/src/.env` points at, and must never reach a commit.
    - **Verification.** Backend: `npm test` 277/277. Frontend: `npm test` 287/287, `npm run lint
      --max-warnings 0` clean, `npm run build` clean (CSS 175.38 kB → 175.24 kB). Ran
      `npm run migrate` (nothing pending) then `npm run seed:accounts` for real against the local
      database: all 9 accounts created, then a second run confirmed all 9 correctly skipped with
      their passwords preserved. Started the real server and, for all 9 accounts, logged in via
      `POST /api/login` and confirmed `GET /api/session-user`'s `user_role` matched; confirmed all
      5 Workers appear in `GET /api/workers` with their job role/type/contact/rate. `git status`
      confirmed `docs/tmp/` never appears as trackable. Re-ran the item-33 axe harness against the
      rebuilt `dist` covering the new form: 0 violations. Stopped the server afterward and
      confirmed via `netstat` that nothing was left listening.
    - **A real, local-environment snag caught and fixed along the way, unrelated to the feature
      itself:** the backend's login route is rate-limited (10/15min, `userRoutes.js`'s
      `loginLimiter`) — re-running the 9-account login-verification script against a server that
      had already seen several earlier attempts in the same window tripped it; restarting the dev
      server (the in-memory limiter isn't Postgres-backed) reset it for the real check.
    - **Still open after this:** the declined role-shell consolidation, the `braces` advisory (no
      fix exists upstream yet), and the legacy `worker_details.photo` column drop (item 21) —
      closed by item 41 below.

41. **Close out the backlog: drop `nodemon` (and the `braces` advisory with it), and drop the
    legacy photo columns.** The user asked to "fix the remaining issues on backlog" — item 40's
    own "still open" list, minus the role-shell consolidation, which the user confirmed stays
    declined when asked directly (each of the five role-shell files is ~10 lines of genuinely
    per-role routing; a shared `<RoleShell>` would cost more readability than the five small files
    save).
    - **The `braces` advisory.** It only ever reached the project through `nodemon` →
      `chokidar@3` → `braces`, a dev-only chain with no fix: nodemon 3.1.14 is already the latest
      release and still pins `chokidar ^3.5.2`. Replaced `"dev": "nodemon server.js"` with
      `"dev": "node --watch server.js"` — Node 24 is used everywhere already (CI, both
      Dockerfiles, local dev), and its `--watch` flag is stable and watches the imported module
      graph, the same restart-on-save behavior nodemon gave. `npm uninstall nodemon` removes the
      dependency outright. A fresh `npm audit` also turned up a new, unrelated finding — vitest's
      own `vite` dependency, 3 launch-editor advisories, dev-only — fixed by a plain
      `npm audit fix`. `npm audit` now reports 0 in both halves (it was already 0 on the frontend).
    - **The legacy photo columns.** Item 21 deferred dropping `worker_details.photo` because
      doing so safely needed every real environment to have already run
      `scripts/backfillPhotos.js`, and nobody could say which environments existed yet. New
      migration `1792604443343_drop-legacy-photo-columns.js` removes that dependency: its `up()`
      moves any remaining legacy photo onto disk itself, as part of the same run that drops the
      column, so it's safe to run against a database in any state — never backfilled, partially
      backfilled, or fully backfilled. `attendance.photo` (unused — no route or service has ever
      read or written it) is dropped alongside it, guarded by a preflight check that refuses the
      drop if a value was somehow written there by hand. `scripts/backfillPhotos.js` and its test
      are deleted (replaced by the migration); `docker-entrypoint.sh`'s standalone backfill step
      goes with it, since `npm run migrate` already runs on every boot.
    - **A real atomicity bug found and fixed by actually running this against the local
      database, not just its mocked tests.** The first version of the migration wrote each row's
      file and `photo_path` update as it went, planning to undo any already-written files if a
      later row failed to decode — reasoning that the whole thing was protected by one
      transaction. It wasn't: `pgm.db.query()` executes immediately against the migration's
      connection, *before* node-pg-migrate opens the transaction that wraps this file's queued
      `pgm.sql()`/`dropColumn()` calls (confirmed by reading node-pg-migrate's own
      `MigrationBuilder._apply`, which fully awaits `up(pgm)` before collecting and
      transaction-wrapping whatever it queued). Reproduced live: seeded one good legacy-photo row
      and one corrupt one, ran the migration, and watched the good row's `photo_path` survive a
      migration run that otherwise failed and rolled back the column drop — exactly the dangling
      reference the design was supposed to prevent. Fixed by decoding every row up front (a pure,
      side-effect-free check) before writing or updating anything at all, so the dominant failure
      mode — a corrupt legacy value — now throws with zero side effects; a rarer failure during
      the write phase itself (disk full, a dropped connection) is handled by having the function
      undo every file write and `photo_path` update it already made this run.
    - **`userModel.js` cleanup that follows from the drop:** `createWorkerDetails` (dead — its
      last real caller was the now-deleted backfill script, and it inserted into the
      now-nonexistent `photo` column) is removed; `updateWorkerDetails`'s
      `photo = CASE WHEN $7 ...` clause and its extra parameter go with it, since there's no
      longer a legacy column to clear.
    - **Verification.** Backend: 277/277 (272 unaffected + the former `backfillPhotos.test.js`'s
      5 cases moved and rewritten as `tests/dropLegacyPhotoColumns.test.js`'s 4, reflecting the
      fixed decode-first design, including a dedicated case for the write-phase rollback).
      `npm audit` and `npm audit --omit=dev`: 0 and 0; `npm ls braces nodemon`: empty. `npm run
      dev` confirmed to start Node's own `--watch`, serve `/healthz`, and the process + port both
      cleaned up afterward via PID/`netstat`. Against the real local database: a down/up round
      trip with a genuine legacy base64 photo row confirmed `photo_path` was set and the file
      readable on disk; a second down/up with a deliberately corrupt row confirmed the fixed
      failure path leaves zero side effects (no `photo_path` set, no file written); fixing that
      row and re-running confirmed a clean full pass. All test rows, their uploaded files, and two
      unrelated orphaned files left over from an earlier, since-fixed test run were cleaned up
      afterward. Frontend: unaffected, `npm test` re-run as a sanity check.
    - **Still open after this:** only the declined role-shell consolidation remains on this
      backlog's own list. Blocked on someone else, unchanged: the overtime rule (client), TLS/a
      domain/real VPS latency/off-box backup automation (infra), the PWA deferral (needs TLS), and
      a real screen-reader/device pass (human + devices).

42. **Go live: Hostinger VPS + domain, automatic HTTPS, a GUI instead of bare SSH, and
    auto-deploy from `main` — closing out item 40's TLS/domain/VPS-latency/backups block.** The
    user had a VPS and domain (`woodenbizarre.tech`) ready and asked for three things: a guided
    cutover, a server-management GUI instead of doing everything over SSH, and Render-style
    auto-deploy on push.
    - **Legacy VPS inventory, done first and read-only.** The VPS turned out to already be running
      a bare-metal (no Docker) deploy of the app from a July 2026 commit — PM2 + system Nginx +
      Postgres 16, with a working Certbot-issued certificate already live for the domain. Its
      database held 5 users (1 admin, 4 clearly-test workers), 2 toy projects, and zero
      attendance/profit/inventory rows — recognizably throwaway client-testing data, on a schema
      that predates this repo's `pgmigrations` bookkeeping entirely (no photo-file storage, no
      pagination indexes, nothing from items 1–41). Recommended against migrating it — mapping a
      6-month-stale, un-tracked schema onto the current migration chain column-by-column was real
      effort for data that didn't look worth preserving — and the user agreed: a cold backup for
      the record, then a fresh database, the client re-tests on the real thing.
    - **Caddy replaces Nginx in the `proxy` image, not Caddy in front of Nginx.** Caddy requests
      and renews its own Let's Encrypt certificate for whatever `SITE_ADDRESS` names
      (`frontend/Caddyfile`), with no separate certbot service or renewal cron. Replacing Nginx
      outright, rather than stacking Caddy in front of it, keeps exactly **one** proxy hop in
      front of the app — `app.js`'s `app.set('trust proxy', 1)` and `userRoutes.js`'s per-IP
      `loginLimiter` both depend on that being true. A second hop would make every real visitor
      look like the first proxy's IP to the app, collapsing every user into one shared
      rate-limit bucket and breaking the `X-Forwarded-Proto` that `COOKIE_SECURE`'s `secure`
      cookie flag depends on. `SITE_ADDRESS` defaults to `:80` (plain HTTP, no TLS) when unset —
      local `docker compose up` and CI's new smoke test need no domain at all.
    - **Images are built once, by CI, and the VPS only pulls.** `docker-compose.yml`'s `backend`
      and `proxy` services now carry `image: ghcr.io/strydomph/wbms-…:${IMAGE_TAG:-latest}`
      alongside their existing `build:` — `build:` still serves local dev and CI's own smoke test,
      while the VPS pulls a tag it never has to compile. The one vCPU never spends a deploy
      compiling anything.
    - **CI (`images` job, replacing `docker-build`): builds both images, then actually *runs* the
      full compose stack and smoke-tests it** (`curl` against `/`, `/healthz`, `/readyz` through
      the proxy) — the first time this repo's CI has run the stack end to end rather than only
      building the Dockerfiles. `DOMAIN`/`PORTAINER_ADDRESS` are pinned to the `.invalid` TLD
      (RFC 2606) for that smoke test specifically so Caddy's automatic-HTTPS attempt for those
      site blocks fails fast against a domain that can never resolve, instead of risking Let's
      Encrypt rate limits against the real `woodenbizarre.tech` on every CI run. On `main` only,
      it then pushes both images to GHCR (two tags each: the commit SHA and `latest`) and prunes
      old package versions, since private GHCR packages are capped at 500MB on this plan.
    - **A real bug, found immediately by that smoke test actually running the stack for the first
      time:** every backend container failed to boot, "the server does not support SSL
      connections." `config/db.js`'s cert-verification-on-by-default logic (P1-2) only treated a
      literal `localhost`/`127.0.0.1` host as safe to connect to without TLS; the compose
      network's `db` hostname (how `backend` has always reached Postgres in
      `docker-compose.yml`, hardcoded there, not read from `.env`) is neither, so it fell into the
      `rejectUnauthorized: true` branch against a stock `postgres:17-alpine` that's never had TLS
      configured at all. This bug has been latent in `docker-compose.yml` since P1-10 — the old
      `docker-build` CI job only ever built the images, never ran them, and `CLAUDE.md` already
      flagged "Docker builds are unverified outside CI" for exactly this reason. Fixed with a new
      `SQL_SSL` env var: `false` opts a host out of TLS explicitly, on the same reasoning as the
      existing `localhost` case one hop out — traffic between two containers on the same
      Docker-created bridge network never leaves the VPS, so there's no MITM path for P1-2's
      verification to defend against. `docker-compose.yml` sets it for exactly the `backend`
      service; it stays unset (and so fully defended) everywhere else, including local dev and
      any future real external Postgres host. **`scripts/migrate.js` duplicates this same SSL
      logic independently** (its own header comment explains why: it can't import `config/db.js`
      directly, since that module opens a real pool connection as an import-time side effect) —
      missed on the first pass, caught by the compose smoke test still failing identically after
      the `config/db.js` fix alone. Fixed the same way there.
    - **A second, unrelated real bug, found once the first one stopped masking it:** with the
      database connection fixed, the stack came up healthy but the smoke test's own `curl` still
      failed — `Connection reset by peer`. `proxy` (Caddy) had no Docker `healthcheck` at all, so
      `docker compose up --wait` only ever waited for the container *process* to start, not for
      Caddy to finish loading its config and actually bind its listener — a startup race that
      nothing had ever been positioned to notice before this smoke test existed. Fixed by adding
      a real `healthcheck` to the `proxy` service, deliberately against Caddy's own admin API
      (`http://localhost:2019/config/`, always plain HTTP) rather than `/healthz` through the
      site itself — that stays identical whether `SITE_ADDRESS` is `:80` (CI, local) or a real
      domain with Caddy's own automatic HTTPS redirect in front of it. The first version of that
      healthcheck used `wget --spider`, matching a common pattern elsewhere — but it made `proxy`
      fail straight to `unhealthy` instead of the normal retry/interval cadence (BusyBox wget,
      the only wget in this Alpine-based image, doesn't support `--spider`), caught immediately
      by re-running the smoke test and comparing the timing against `backend`'s own healthcheck,
      which does pass. Fixed by matching `backend`'s already-proven `wget -qO-` form instead.
      Confirmed by re-running the compose smoke test, which now passes end to end.
    - **A new `deploy` job runs `ssh … deploy/deploy.sh <sha>`** — a plain `ssh` call, deliberately
      not a third-party GitHub Action, to avoid that supply-chain surface for something that can
      reach production. It's gated on the `DEPLOY_ENABLED` repository variable, so it stays a
      harmless no-op in Actions until the VPS side of the cutover is actually finished, and on
      `concurrency: production` so two pushes can't race each other onto the server. The
      workflow's own short-lived `GITHUB_TOKEN` is piped into the VPS's `docker login`, so no
      long-lived registry credential is stored there at all.
    - **`deploy/deploy.sh`**, run on the VPS: refuses to run against a dirty working tree (a sign
      someone hand-edited the server instead of going through a commit), checks out the deployed
      SHA, runs `backup.sh` as a pre-deploy safety net, pulls the new images, and
      `docker compose up -d --wait` — which fails the whole deploy loudly if the backend's
      migrate-on-boot crash-loops, rather than leaving the new containers silently unhealthy while
      the old ones keep serving. A rollback is re-running an older successful Actions run; schema
      migrations are not reversed by it.
    - **Portainer** (`portainer/portainer-ce`, a new `portainer` service) is the GUI the user
      asked for in place of bare SSH — container list, logs, restart/stop, resource use. It's
      reached at its own subdomain (`portainer.woodenbizarre.tech`) proxied by Caddy with its own
      automatic certificate, deliberately never sharing an origin (and so never sharing cookies or
      CORS trust) with the app itself. Hostinger's own "Docker Manager" API/panel feature was
      considered and rejected: it only works on their separate Docker OS template, which would
      mean reinstalling the VPS's OS, and Hostinger itself documents it as experimental.
    - **Docs:** `deploy/README.md` rewritten as the step-by-step cutover guide (DNS, firewall,
      Docker install, a dedicated `deploy` user, a read-only `git` deploy key, `.env`, first
      deploy, Portainer's first-login window, the GitHub secrets/variable, and a troubleshooting
      section for the cookie/HTTPS mismatch, DNS propagation, and a failed migration on boot).
      `PRD.md`'s one remaining "Nginx" mention (the C.2 database-pooling row) now says Caddy.
    - **This repo-side half (CI, Caddy, compose, docs) is committed to `main` and verified in CI.**
      The VPS cutover itself (DNS already pointed here from the legacy deploy; installing Docker;
      creating the `deploy` user; the first `deploy/deploy.sh` run; Portainer's first login; the
      GitHub secrets) is a separate, interactive pass with the user, since several of its steps
      are destructive (stopping the legacy Nginx/PM2 deploy, freeing port 80/443) or need
      credentials only they hold. `DEPLOY_ENABLED` stays unset — CI builds, smoke-tests, and
      publishes images, but nothing reaches the VPS — until that pass is done.
    - **Still open after this:** the VPS cutover itself (tracked above, not yet run), the overtime
      rule (client), real VPS latency and off-box backup sync automation (infra, now partially
      addressed — `deploy.sh` backs up before every deploy, but nothing ships the result off-box
      yet), the PWA deferral (its TLS blocker is now resolved once the cutover lands), a real
      screen-reader/device pass (human + devices), and the declined role-shell consolidation.

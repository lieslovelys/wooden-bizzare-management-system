# Wooden Bizarre Management System — Product Specification

**Status:** Living document. Part B (as-is) reflects the codebase as of 2026-08-17. Part C
(target-state) is the agreed direction for the hardening work tracked in
[`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md).

---

# Part A — Product Overview

## A.1 Problem statement

The Wooden Bizarre is a custom woodworking/furniture shop. Before this system, tracking a client
order from quote to delivery — who's working on what stage, whether it passed quality checks,
whether the job actually made money, and who showed up for work — lived in spreadsheets and
memory. The Wooden Bizarre Management System replaces that with a single shared web application
so the shop owner, production manager, quality checker, and workers all see the same state.

## A.2 Business context

- Single business, single location, single tenant. No multi-shop or franchise concept.
- Currency: Philippine peso (₱). Business day: Asia/Manila (UTC+8).
- Users are shop staff on shared or personal devices, primarily desktop/laptop browsers on the
  shop floor and in the office. No mobile app; the web app is not currently mobile-optimized.
- Data sensitivity: worker daily wages, client contact details, and project financials are the
  sensitive fields in this system. There is no payment-card or health data.

## A.3 Primary users (roles)

| Role | Who they are | Primary concern |
|---|---|---|
| **Admin** | Shop owner / office manager | Everything — accounts, projects, money, people |
| **Production Manager** | Runs the shop floor | Assigning work, tracking job progress |
| **Quality Checker** | QA | Approving or rejecting finished stages |
| **Worker** | Craftsperson (carpenter, carver, painter, etc.) | Seeing and completing assigned tasks |
| **Inventory Staff** | Materials/stock | Tracking raw materials and tools |

## A.4 Glossary

| Term | Meaning |
|---|---|
| **Project** | A client order — the top-level unit of work. Has a name, client, price, priority, and due date. |
| **Project variable** | A free-text spec attached to a project (e.g. "Wood Type: Narra", "Dimensions: 6ft"). An open-ended list, not a fixed schema. |
| **Job order** | The Production Manager's / Admin's working view of a non-completed project — same underlying record as a project. |
| **Stage** | One unit of production work on a project (Carpenter, Carver, Liha, Painter, Delivery). |
| **Assignment** | A stage assigned to one worker with a start/due date and a status. |
| **For QA** | A worker has submitted their stage; it's now waiting on the Quality Checker. |
| **Rework / Repair** | The Quality Checker sent a stage back to the worker. (Both exist in the schema; only `Repair` is currently used by the UI — see B.6.) |
| **Attendance record** | One row per worker per calendar date: time in, time out, status. |
| **Net profit** | `client_payment − worker_wages − materials_cost − other_expenses`, computed by the database, not the application. |

## A.5 What's in this document

- **Part B** describes the system as it exists today: roles and their actual (client-side-only)
  permissions, the full data model, the API surface, every screen, the workflows as implemented,
  and the functional gaps found during the audit — stated as product facts, not code review.
- **Part C** states the target: functional requirements, non-functional requirements sized to
  50–300 concurrent users, and security requirements, each written so it can be tested and
  tracked independently.

---

# Part B — As-Is Specification

## B.1 Roles & permissions

`user_role` is a Postgres enum: `Admin`, `Production Manager`, `Inventory Staff`,
`Quality Checker`, `Worker`. Routing after login is a `switch` on this string
(`auth-components/RoleBasedRedirect.jsx`) sending each role to its own path prefix.

**Every permission below is enforced only in the React UI (hidden menu items, disabled buttons,
route redirects). The backend has no authorization middleware on any route** — any of these
actions can currently be performed by an unauthenticated HTTP client regardless of role. This
table describes the *intended* permission surface as expressed by the UI, not an actual security
boundary. See ARCHITECTURE_REVIEW.md P0 for the fix.

| Capability | Admin | Prod. Manager | Quality Checker | Worker | Inventory Staff |
|---|:---:|:---:|:---:|:---:|:---:|
| Create/delete user accounts | ✓ | | | | |
| Create workers (with wage rate) | ✓ | | | | |
| View account list | ✓ | | | | |
| Create projects | ✓ | | | | |
| Edit / delete projects | ✓ | | | | |
| View job order queue | ✓ | ✓ | | | |
| Assign worker to stage | ✓ | ✓ | | | |
| Mark project complete | ✓ | ✓ | | | |
| Approve / send-to-repair (QA) | ✓ | ✓ | ✓ | | |
| View own assigned tasks | | | | ✓ | |
| Submit stage for QA | | | | ✓ | |
| Record/edit attendance | ✓ | ✓ | | | |
| View own attendance | (all workers') | (all workers') | | | |
| Enter/edit project profit | ✓ | | | | |
| View worker productivity leaderboard | ✓ | | | | |
| View project history | ✓ | ✓ | | | |
| Manage inventory | ✓ | ✓ | | | ✓ *(shared, server-persisted since P1-11 — see B.6)* |
| Receive role-scoped notifications | ✓ (sees all) | ✓ (project-type) | ✓ (verification-type) | none | none |

Notable gap: **Admin and Production Manager both have full QA approve/reject rights**
(`globals/ProjectVerification.jsx` is mounted, unmodified, under both role trees) — there is no
separation between "manages the work" and "signs off the work," even though a dedicated Quality
Checker role exists.

## B.2 Data model

11 tables, 3 enum types, 4 indexes (all on one table), 1 unused reporting view. ~~Single
monolithic bootstrap script (`backend/index.sql`), no migration tool, not idempotent.~~ —
**Resolved (P1-10)**: `index.sql` was folded into `backend/src/migrations/1700000000000_
initial-schema.js` and deleted; schema changes now go through `node-pg-migrate`
(`backend/src/migrations/`), each one reviewable and re-applied automatically on deploy.

### Entity relationship overview

```
users ──┬─(1:N, CASCADE)──→ worker_details.user_id ──(1:N, CASCADE)──→ attendance.worker_id
        │                          ↑ (attendance targets worker_details.detail_id)
        ├─(1:N, CASCADE)──→ job_assignments.worker_id      ← targets users.user_id directly
        ├─(1:N, SET NULL)─→ job_assignments.qa_checker_id  (never populated by any code path)
        └─(1:N, SET NULL)─→ project_profit.recorded_by     (never populated by any code path)

projects ─┬─(1:N, CASCADE)─→ job_assignments.project_id
          ├─(1:N, CASCADE)─→ project_variables.project_id
          └─(1:N, CASCADE)─→ project_profit.project_id ──(1:N, CASCADE)──→ project_expense_items.profit_id

inventory_items ──(1:N, CASCADE)──→ item_variants.item_id     [P1-11: real backend, /api/inventory]
                                          └─(1:N, CASCADE)──→ stock_movements.variant_id  (audit trail)
notifications                                                  [no foreign keys to anything]
```

**Modeling hazard worth flagging explicitly:** `attendance.worker_id` is a foreign key to
`worker_details.detail_id`, while `job_assignments.worker_id` — same column name — is a foreign
key to `users.user_id`. These are two different identifiers for "a worker." Any future code that
joins attendance to assignments must route through `worker_details`, and the shared column name
makes an off-by-one confusion an easy, silent bug to introduce.

### Tables

**`users`** — `user_id` (PK, identity), `username` (varchar, **nullable, not unique**),
`user_password` (varchar(255), bcrypt hash), `first_name`/`middle_name`/`last_name`, `suffix`
(enum: None/Sr./Jr./II/III/IV/V), `user_role` (enum), `created_at` (`date`, not `timestamp`).

**`worker_details`** — one row per Worker user. `detail_id` (PK), `user_id` (FK → users, CASCADE,
not unique — a user can have more than one row), `job_type`, `job_role` (specialization:
Carpenter/Carver/Liha/Painter/Delivery), `contact`, `rate` (`numeric(10,2)`, daily wage), `photo`
(base64 `text`, no size cap).

**`attendance`** — the best-constrained table. `id` (PK), `worker_id` (FK → worker_details,
CASCADE, NOT NULL), `date` (NOT NULL), `day_of_week`, `time_in`/`time_out` (`time`, no date part
— cannot represent an overnight shift), `status` (varchar, `CHECK` constrained to
Present/Absent/Half-day/Late, default `'Absent'`), `late_minutes`/`overtime_minutes` (integer,
default 0), `notes`, `photo`, `created_at`/`updated_at`. `UNIQUE(worker_id, date)`.

**`projects`** — `id` (PK), `project_name` (NOT NULL), `client_name` (NOT NULL, no `clients`
table — re-typed per project), `contact_number`, `date_ordered`, `client_payment`
(`numeric(12,2)`), `priority_level` (free text, no constraint), `due_date`, `created_at`, `status`
(varchar, default `'Pending'`, no `CHECK`), `date_completed` (`date`).

**`job_assignments`** — `assignment_id` (PK), `project_id` (FK → projects, CASCADE),
`worker_id` (FK → **users**, CASCADE), `stage_name` (NOT NULL), `start_date`/`due_date`,
`status` (enum: Assigned/In Progress/For QA/Rework/Approved/Repair, default `Assigned`),
`qa_checker_id` (FK → users, SET NULL, never written), `qa_notes` (never written),
`date_completed` (`timestamp`), `date_submitted` (`date`).

**`project_profit`** — one row per project (not `UNIQUE`-enforced, code assumes 1:1 via
`LIMIT 1`). `client_payment`/`worker_wages`/`materials_cost`/`other_expenses`
(`numeric(12,2) NOT NULL DEFAULT 0`), `total_expenses` and `net_profit` as **`GENERATED ALWAYS ...
STORED`** columns, `recorded_by` (FK → users, never written), `updated_at`.

**`project_expense_items`** — itemized expenses under a profit record: `profit_id` (FK →
project_profit, CASCADE), `category`, `description`, `amount`.

**`project_variables`** — free-form spec pairs per project: `project_id` (FK, CASCADE),
`variable_name`, `variable_detail`.

**`inventory_items`** / **`item_variants`** — `name`/`category`/`unit` and per-item
`variant_name`/`current_stock`/`min_stock`. **P1-11 (resolved):** now served by
`routes/inventoryRoutes.js` → `services/inventoryService.js` → `models/inventoryModel.js`, the
same layer contract as the rest of the backend. `total_stock`/`status` are no longer stored
columns — both are derived from `item_variants` on every read (sum of `current_stock`; `'Low'` if
any variant is at or below its `min_stock`) to avoid a second source of truth. **`stock_movements`**
(new) is the audit trail every adjustment writes to: `variant_id` (FK, CASCADE), `user_id` (FK →
users, `SET NULL`), signed `delta`, `resulting_stock`, `reason`, `created_at`. See B.6 for what's
still open (materials consumed per project).

**`notifications`** — `type`, `title`, `message`, `is_read` (boolean, **one flag shared by every
viewer**), `target_role` (varchar, free text — written as `'PM'`/`'QC'` while the actual role enum
values are `'Production Manager'`/`'Quality Checker'`), `created_at`, `reference_id` (polymorphic,
no FK).

### Unused views

~~`attendance_summary` and `project_profit_summary` are defined in `index.sql` but never queried
by any backend code.~~ — **Resolved (engineering-debt pass)**: `project_profit_summary` — a bare
`projects JOIN project_profit` with no aggregation, and `profitModel.js` already reads
`project_profit` directly — was dropped (`backend/src/migrations/
1787195165375_drop-unused-profit-summary-view.js`). `attendance_summary` is **kept, still
unwired, on purpose**: every column it aggregates (`status`, `late_minutes`, `overtime_minutes`)
is frozen at the database default until FR-5 ("Attendance status is never computed," below) is
implemented — wiring it into a reporting screen today would render every worker as all-absent
with zero minutes. It becomes worth using the moment FR-5 lands.

## B.3 API surface

~32 routes. Auth/account routes are mounted at `/` (not `/api`); everything else is under `/api`.
**No route requires authentication.** Response shapes are inconsistent across four different
envelopes: `{success, data}`, bare arrays, `{err, message}`, `{message, body}`.

**This table predates the P0/P1-10 work and is now stale on both fronts it describes**: every
route requires role-based auth today (`middleware/auth.js`), and every backend route — including
auth/account routes — now lives under `/api` (see `CLAUDE.md`). The four-envelope inconsistency
it flags is still accurate. Re-auditing this table route-by-route is its own documentation pass;
not done here. The 8 routes P1-11 added are listed separately below since they're new, not stale.

| Method | Path | Purpose |
|---|---|---|
| POST | `/signup` | Create an account — **role taken directly from the request body** |
| POST | `/login` | Authenticate, populate session |
| GET | `/session-user` | Return the current session's user (only route that reads the session) |
| GET | `/logout` | Destroy session (a state-mutating `GET`) |
| GET | `/users` | List all accounts |
| DELETE | `/users/:id` | Delete an account — cascades to that worker's attendance and job history |
| GET | `/workers` | List workers (includes daily rate and photo) |
| POST | `/workers` | Create a worker (account + worker profile) |
| PUT | `/workers/:id` | Update a worker's profile/rate |
| POST | `/api/projects` | Create project + variables |
| GET | `/api/projects` | List projects (derived status) |
| PUT | `/api/projects/:id` | Update project + replace variables |
| GET | `/api/projects/history` | List completed projects |
| GET | `/api/projects/:id` | Single project + variables |
| DELETE | `/api/projects/:id` | Delete project (cascades) |
| PUT | `/api/projects/:id/complete` | Mark complete |
| GET | `/api/job-orders` | Non-completed projects, as job orders |
| GET | `/api/job-orders/:id` | Job order + variables |
| GET | `/api/workers` | Workers, for the assignment dropdown |
| GET | `/api/job-orders/:id/assignments` | Stage assignments for a project |
| POST | `/api/job-orders/:id/assign` | Assign a worker to a stage; auto-flips project to In Progress |
| GET | `/api/workers/:workerId/tasks` | A worker's task list (no ownership check — any ID works) |
| GET | `/api/qa/tasks` | Assignments with status `For QA` |
| PUT | `/api/assignments/:assignmentId/status` | Change an assignment's status |
| GET | `/api/productivity` | Per-worker performance leaderboard |
| GET | `/api/notifications` | All notifications (not filtered by role) |
| PUT | `/api/notifications/mark-all-read` | Mark every notification read, globally |
| DELETE | `/api/notifications/clear/all` | Delete all notifications |
| DELETE | `/api/notifications/:id` | Delete one |
| PUT | `/api/notifications/:id/read` | Mark one read |
| GET | `/api/dashboard/stats` | Active projects / total workers / monthly net profit |
| GET | `/api/profit/:projectId` | P&L + expense items |
| POST | `/api/profit/:projectId` | Upsert P&L (a `POST` used for an idempotent update) |
| DELETE | `/api/profit/:projectId` | Delete P&L |
| GET | `/api/attendance/worker/:workerId` | A worker's attendance log (no ownership check) |
| POST | `/api/attendance` | Create attendance row |
| PUT | `/api/attendance/:id` | Update times |
| DELETE | `/api/attendance/:id` | Delete row |
| GET | `/api/attendance/:id` | Single record |

~~No list endpoint supports pagination, filtering, or sorting parameters — every list request
returns the full table and the frontend filters client-side.~~ **Resolved by P1-3**: all 15 list
endpoints (the ones above plus the P1-11 additions below) now take `?page`/`?limit` and answer
`{success, data, meta}`; the 8 whose row count grows without bound also take server-side filters
(`search`, `status`, `type`, `priority`, `stage`, `remark`, `sort`, depending on the endpoint) —
see `ARCHITECTURE_REVIEW.md` P1-3 for exactly which. One new route was added specifically to keep
a notification deep-link working once its target list was paged:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/assignments/:assignmentId` | Single job-assignment lookup, for resolving a verification-notification deep link without depending on which page it would otherwise be on |

**Added by P1-11**, all under `/api/inventory`, `requireRole('Admin', 'Production Manager',
'Inventory Staff')`, `{success, data}` envelope (`meta` added by P1-3 on the two list routes):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/inventory` | List items with variants, derived `total_stock`/`status` |
| POST | `/api/inventory` | Create item + variants |
| GET | `/api/inventory/low-stock` | Variants at or below their `min_stock` |
| GET | `/api/inventory/:id` | Single item + variants |
| PUT | `/api/inventory/:id` | Update item + variants (surviving variants keep their stock) |
| DELETE | `/api/inventory/:id` | Delete item (variants and their movement history cascade) |
| POST | `/api/inventory/variants/:variantId/adjust` | Adjust stock; `{delta, reason}`, writes a `stock_movements` row |
| GET | `/api/inventory/variants/:variantId/movements` | Audit trail for one variant |

## B.4 Screen inventory

| Role | Screens (sidebar order) |
|---|---|
| **Admin** (12) | Dashboard · Account Creation · Create Project · Job Order · Worker List · Project Verification · Attendance · Inventory Table · Profit · Worker Productivity · Project History · Notification |
| **Production Manager** (7) | Dashboard · Job Order · Project Verification · Inventory · Attendance · Project History · Notifications |
| **Quality Checker** (3) | Dashboard · Project Verification · Notifications |
| **Worker** (1) | Job Order |
| **Inventory Staff** (1) | Inventory Table |

Note: **project creation is Admin-only** — the Production Manager, despite owning the job-order
workflow day to day, has no Create Project screen; new orders must go through Admin first.

## B.5 Workflows

**1. Account provisioning.** Today, via the "Account Creation" tab (Admin → Account Creation),
which embeds the same form exposed publicly at `/protoacc`: name, suffix, username, password, and
a free choice of role (including Admin). A **separate, parallel path** exists for workers
specifically — "Worker List → Add Worker" — which additionally captures job role, contact, and
daily rate in one step. The two paths produce accounts with different completeness: a worker
created via the general signup form has no wage rate or job-role until a second edit; there is no
password-reset or account-edit capability anywhere in the product once an account exists.

**2. Project intake.** Admin fills in project name, client name, contact number, order date,
client payment, priority (High/Medium/Low), due date, and an open-ended list of project variables
(specification pairs). Saving creates the project and fires a "New Project Arrived" notification
targeted at the Production Manager.

**3. Job order queue → stage assignment.** The Production Manager (or Admin) opens a project from
the Job Order list and assigns workers to stages (Carpenter, Carver, Liha, Painter, Delivery) —
one worker per stage, worker choices auto-filtered to those whose job role matches the stage. The
first assignment auto-flips the project's status to `In Progress`. There is no un-assign,
re-assign, or delete-assignment action anywhere — a wrong assignment is permanent. There is no
stage ordering or dependency: Delivery can be assigned and approved before Carpenter has even
started.

**4. Worker executes and submits.** A worker sees their assigned stages (filtered to `Assigned`
or `Repair` — **there is no way for a worker to view stages currently `For QA` or already
`Approved`**; submitted work simply disappears from their list). Submitting sets status to
`For QA`, stamps `date_submitted`, and fires a notification to the Quality Checker.

**5. QA review.** The Quality Checker (or Admin/Production Manager — see B.1) reviews stages with
status `For QA` and either Approves (stamps `date_completed`) or sends to `Repair`. **A repair
action carries no reason, comment, or evidence** — the worker learns only that the status
changed, with no notification channel of their own to see why (Workers receive no notifications
at all).

**6. Completion.** Once every *assigned* stage is Approved, the project can be marked Completed
and moves to Project History. Loophole: a project with only one stage ever assigned (of the five
possible) can be completed on that one stage's approval — the "must be Approved" check only looks
at stages that were actually assigned, not all five.

**7. Profit & expense recording.** Admin enters client payment, worker wages, materials cost, and
other expenses per project; itemized expense lines can be added under "Other Expenses." Net
profit and total expenses are computed by the database as generated columns. The itemized
breakdown is **never reconciled against the "other expenses" total** — the two can disagree with
no warning. `client_payment` is captured independently here and at project creation, with nothing
keeping the two synchronized. Worker wages are typed in by hand; nothing derives them from the
worker's daily rate and recorded attendance, despite both existing in the system.

**8. Attendance → productivity.** Attendance is **entirely retrospective and admin-entered** —
there is no worker-facing clock-in/out anywhere in the product. An Admin or Production Manager
opens a worker's log and manually adds a date/time-in/time-out record. Nothing computes
`status`/`late_minutes`/`overtime_minutes` from the times entered (see B.6). The productivity
leaderboard separately compares each assignment's `date_submitted` against its `due_date` to
classify Early/On-time/Late, and counts current-status `Approved`/`Repair` — meaning a stage that
was once sent to Repair and later Approved shows only as Accepted, and repair history silently
disappears from the metric over time.

## B.6 Known functional gaps

Stated as product facts — what a user experiences — not as code defects.

- **Inventory has a real backend now (P1-11), except for the project link.** Items, variants,
  stock adjustment (with a who/when/how-much/why audit trail via `stock_movements`), and
  low-stock reporting are all server-persisted through `/api/inventory`, shared correctly across
  Admin, Production Manager, and Inventory Staff. **Still missing:** there is no link between
  inventory and projects — nothing records material consumed by a job. That remains open under
  FR-3.
- **Attendance status is never computed.** Every record keeps the database default `'Absent'`
  with zero late/overtime minutes regardless of the times entered, which makes the
  `attendance_summary` view and any payroll derivation from this data meaningless as it stands.
- **Notifications are global, not per-user.** One shared `is_read` flag means one person opening
  a notification marks it read for every other person with access to that list. `target_role`
  values (`'PM'`, `'QC'`) don't match the role enum (`'Production Manager'`, `'Quality Checker'`)
  and the reader ignores the column anyway — every logged-in user's notification list currently
  includes every role's notifications, filtered only by `type` in the browser. **Partially
  improved (ARCHITECTURE_REVIEW.md P2):** the three per-role screens (`AdminNotification`,
  `PMNotification`, `QualityCheckerNotification`) are now one shared component
  (`globals/NotificationList.jsx`), and "mark all read"/"clear all" take an optional `?type=` so
  a Production Manager or Quality Checker no longer has to issue one request per notification to
  fake a type-scoped bulk action — but this only changed how the *bulk actions* are scoped, not
  the underlying per-user `is_read` sharing or the ignored `target_role` column, both of which
  remain exactly as described above.
- **Notifications never update live.** There is no polling or push of any kind; a new
  notification only appears after the user navigates to (or reloads) that screen.
- **`Rework` is invisible in reporting.** The status enum includes both `Rework` and `Repair`, but
  only `Repair` is ever produced by the UI and only `Repair` is counted in productivity.
- **No QA audit trail.** `qa_checker_id` and `qa_notes` exist on `job_assignments` but are never
  written by any code path, so there's no record of who approved or rejected a stage, or why.
  `project_profit.recorded_by` is the same story for financial entries.
- **Project status has two sources of truth**: a stored `status` column, and a value recomputed on
  read via a `CASE ... EXISTS` query. The two can disagree.
- ~~**The monthly-profit figure has no year predicate**~~ — **Resolved**: both
  `adminDashboardModel.js` and `profitModel.js`'s monthly-profit queries now carry a year predicate
  alongside the month one, and compare against `AT TIME ZONE 'Asia/Manila'` rather than the
  server's local time.
- **Segregation of duties**: both Admin and Production Manager can approve/reject QA on their own
  team's work, despite a dedicated Quality Checker role existing.
- **Dates entered in the shop's local timezone are corrupted on edit.** The project-edit form
  round-trips a date through JavaScript's UTC conversion before display; in UTC+8, an edited
  project's dates can silently shift by a day when re-saved.
- ~~**A specific, currently-broken data path**: the Quality Checker's notification screen sends
  delete/clear-all/mark-read requests to the wrong host~~ — **Resolved (ARCHITECTURE_REVIEW.md
  P2)**: the three per-role notification screens (`AdminNotification`, `PMNotification`,
  `QualityCheckerNotification`) are now one shared `globals/NotificationList.jsx`, which goes
  through the shared `api/client.js` request wrapper like every other screen — there's no bare
  `fetch` left to have the wrong host baked into.

---

# Part C — Target-State Requirements

## C.1 Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | Every state-changing API request is authorized server-side against the caller's actual role and, where applicable, ownership (e.g. a worker may only read/act on their own tasks and attendance). |
| FR-2 | Account creation is an Admin-only, authenticated action with a whitelist of assignable roles. There is no unauthenticated path to creating any account. |
| FR-3 | Inventory is a real, server-persisted module: items and variants via API, stock increment/decrement with an audit trail (who, when, how much, why), low-stock alerting against each variant's configurable `min_stock` **(✅ done, P1-11)**, and a record of materials consumed per project **(still open)**. |
| FR-4 | Notifications carry per-user read state (not a single shared flag), are correctly filtered by the recipient's role, and update without a manual page reload (polling or push). |
| FR-5 | Attendance status, late minutes, and overtime minutes are computed server-side from recorded time-in/time-out against the shop's defined working hours, not left at a default. |
| FR-6 | Assignment status changes follow an enforced state machine (e.g. `Assigned → For QA → Approved`, `For QA → Repair → Assigned`) rather than accepting an arbitrary string **(✅ done — `jobOrderService.updateQAStatus`'s `WORKER_SUBMITTABLE_FROM` allow-list and role-scoped target statuses reject an invalid transition with a 409)**; QA rejections require a reason **(still open — this is really FR-7's audit trail, since there's nowhere to record the reason without `qa_notes` being written)**. |
| FR-7 | Every QA decision and every financial entry records who made it and when (audit trail on `job_assignments` and `project_profit`, actually populated). |
| FR-8 | Project status is a single source of truth (the stored column, updated transactionally alongside the events that change it — not recomputed differently on read). |
| FR-9 | Workers can see the full lifecycle of their own tasks, including those currently `For QA` or already `Approved`, and receive notification of QA outcomes including rejection reasons. |

## C.2 Non-functional requirements

Sized to the target load of **50–300 concurrent users** on a **single Hostinger VPS, KVM 1 plan
(1 vCPU, 4 GB RAM, 50 GB NVMe)**, run via Docker Compose.

**On "50–300 concurrent users" against one vCPU.** This target should be read as up to ~300
staff who may have the app open over the course of a shift, not 300 simultaneous in-flight HTTP
requests — the latter would saturate a single core regardless of how the app is built. For an
internal shop tool, actual concurrent *request* volume at any given instant is expected to be a
small fraction of that (most open tabs are idle; requests are short, I/O-bound calls to Postgres,
which suits Node's single-threaded event loop fine on one core). This distinction should be
validated with a load test against realistic usage patterns before it's treated as proven —
"concurrent users" and "requests per second" are being used precisely, not interchangeably, in the
rest of this table.

| Area | Requirement |
|---|---|
| **Latency** | p95 API response time under 500ms for list/read endpoints, under 1s for writes, under the realistic concurrent-request rate described above (to be confirmed by load testing, not assumed). |
| **Pagination** | Every list endpoint supports `limit`/`offset` (or cursor) with a sane default page size; no endpoint returns an unbounded result set. |
| **Sessions** | Session state survives an app restart and, if more than one app container is ever run on the VM, is shared correctly between them (i.e. not the default in-memory store). Restart-resilience alone justifies this fix even with a single container. |
| **Database pooling** | Connection pool size, idle timeout, and connection-acquire timeout are explicitly configured against 4 GB of total RAM shared by Node, Postgres, and Nginx — e.g. a small app-side pool (roughly `max: 10`) and a correspondingly modest Postgres `max_connections` (well below its default of 100), not left at either library's defaults. Load beyond capacity should fail fast with a clear error rather than queuing indefinitely or pushing the VM into swap. |
| **Scaling model** | One vCPU means additional app containers do not add real parallelism — there's no second core for them to run on. Prefer a single, efficient app container (two only briefly, for a zero-downtime deploy handoff) over a scaled-out fleet; PM2 cluster mode / multiple Node workers buys nothing here and should be revisited only if the plan is upgraded to a multi-core tier. There is no managed load balancer on a Hostinger VPS regardless. |
| **Observability** | Structured, leveled logging (no raw `console.log` of request/response bodies); a health/readiness endpoint; basic request logging with correlation IDs. |
| **Resilience** | Graceful shutdown (drains in-flight requests, closes the DB pool cleanly) on `SIGTERM`. |
| **Backups** | Documented, tested database backup and restore procedure with a defined recovery point objective, shipped off-box rather than stored on the same 50 GB volume as the running app. A Hostinger VM-level snapshot is not a substitute for this — it backs up the whole disk on the provider's schedule, not an application-consistent, restorable Postgres dump. |
| **Storage discipline** | Worker and attendance photos are currently stored as unbounded base64 blobs in Postgres `text` columns with no size cap. On a 50 GB disk shared with the OS, Docker images, and the database itself, this is a concrete capacity risk, not just a performance one — cap upload size and prefer file storage (a mounted volume or external object storage) over inlining images in the database. |
| **Time correctness** | All stored timestamps are timezone-aware (or explicitly and consistently normalized to Asia/Manila); attendance "day" boundaries match the shop's actual business day. Note the VM's OS clock defaults to UTC. |
| **Schema evolution** | Schema changes are applied through a migration tool, are reviewable, and are re-applied automatically as part of deployment — not hand-run against production. |
| **Deployment** | The app, database, and reverse proxy run as defined, versioned services (Docker Compose) that can be stood up identically in development and on the target Hostinger VPS. |

## C.3 Security requirements

| Area | Requirement |
|---|---|
| **Authentication** | Passwords remain bcrypt-hashed (already correct); login failures return a uniform response regardless of whether the username exists (no enumeration oracle); failed-login attempts are rate-limited. |
| **Authorization** | Server-side role and ownership checks on every mutating and sensitive-read endpoint (see FR-1). |
| **Session management** | Session secret is required at boot with no insecure fallback (the process fails to start rather than running with a known default); session store survives restarts and multi-instance deployment. |
| **Secrets** | No secret value is ever logged, committed, or echoed into generated documents; a documented `.env.example` exists with variable names but no values. |
| **Input validation** | Request bodies are validated against an explicit schema before touching the database; invalid enum values, malformed IDs, and out-of-range numbers return `400`, not a raw database error. |
| **Transport & headers** | Standard security headers (HSTS, `X-Content-Type-Options`, `X-Frame-Options`/frame-ancestors, `Referrer-Policy`) plus a CSP that does not rely on `'unsafe-inline'`/`'unsafe-eval'`. |
| **Error responses** | Clients never receive raw database error objects, stack traces, or internal identifiers; errors are logged server-side and returned as sanitized, generic messages. |
| **PII handling** | Worker daily wages and client contact details are only ever returned to roles authorized to see them (FR-1) — never included in a public or cross-role response. |

## C.4 Out of scope

Explicitly not part of this effort: multi-tenancy (multiple businesses on one deployment), a
native mobile app, payroll disbursement/payment processing, and a client-facing portal. These may
be revisited later but are not requirements for the hardening work this document informs.

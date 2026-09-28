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
        ├─(1:N, SET NULL)─→ job_assignments.qa_checker_id  (FR-7: populated on every reviewer decision)
        └─(1:N, SET NULL)─→ project_profit.recorded_by     (FR-7: populated on every profit save)

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
Carpenter/Carver/Liha/Painter/Delivery), `contact`, `rate` (`numeric(10,2)`, daily wage),
`photo_path` (varchar(64), a filename on the `uploads` volume — **C.2 resolved**, see below).
`photo` (base64 `text`) is legacy and no longer written to; it's read once, by
`scripts/backfillPhotos.js`, to move any pre-existing value onto disk, and is dropped in a later
migration once every environment has run that backfill (see ARCHITECTURE_REVIEW.md item 21).

**`attendance`** — the best-constrained table. `id` (PK), `worker_id` (FK → worker_details,
CASCADE, NOT NULL), `date` (NOT NULL), `day_of_week`, `time_in`/`time_out` (`time`, no date part
— cannot represent an overnight shift), `status` (varchar, `CHECK` constrained to
Present/Absent/Half-day/Late, default `'Absent'`), `late_minutes`/`overtime_minutes` (integer,
default 0), `notes`, `photo` (varchar — unused: no route or service reads or writes it; not part
of the C.2 photo-storage work, since there's no code path to migrate), `created_at`/`updated_at`.
`UNIQUE(worker_id, date)`.

**`projects`** — `id` (PK), `project_name` (NOT NULL), `client_name` (NOT NULL, no `clients`
table — re-typed per project), `contact_number`, `date_ordered`, `client_payment`
(`numeric(12,2)`), `priority_level` (free text, no constraint), `due_date`, `created_at`, `status`
(varchar, `NOT NULL`, default `'Pending'`, `CHECK`-constrained to
Pending/In Progress/Completed — **FR-8**, previously unconstrained), `date_completed` (`date`).

**`job_assignments`** — `assignment_id` (PK), `project_id` (FK → projects, CASCADE),
`worker_id` (FK → **users**, CASCADE), `stage_name` (NOT NULL), `start_date`/`due_date`,
`status` (enum: Assigned/In Progress/For QA/Rework/Approved/Repair, default `Assigned`),
`qa_checker_id` (FK → users, SET NULL, **FR-7:** written on every reviewer Approve/Repair
decision), `qa_notes` (**FR-7:** written on every reviewer decision; kept across a worker's
resubmission rather than cleared, so a rejection reason stays visible through the next round),
`date_completed` (`timestamp`), `date_submitted` (`date`).

**`project_profit`** — one row per project (`UNIQUE`-enforced on `project_id` since P1-7).
`client_payment`/`worker_wages`/`materials_cost`/`other_expenses`
(`numeric(12,2) NOT NULL DEFAULT 0`), `total_expenses` and `net_profit` as **`GENERATED ALWAYS ...
STORED`** columns, `recorded_by` (FK → users, **FR-7:** written on every save), `updated_at`.

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
is the audit trail every adjustment writes to: `variant_id` (FK, CASCADE), `user_id` (FK →
users, `SET NULL`), signed `delta`, `resulting_stock`, `reason`, `created_at`, and **`project_id`**
(FK → projects, `SET NULL` — FR-3's final clause: tags a `'Used'`/`'Returned'` movement to the
project it was consumed by / returned to; `SET NULL` rather than `CASCADE` so deleting a project
doesn't rewrite inventory history the stock movement genuinely happened). A project's materials-
consumed record is simply its tagged `stock_movements` rows, netted per variant — no separate
ledger. Deleting a *variant* still `CASCADE`s its movements (the P1-11 design, unchanged here), so
it drops that variant's history from any project total that included it, same as it always has
for the audit trail generally.

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
was frozen at the database default until FR-5 ("Attendance status is never computed," below) was
implemented. `status`/`late_minutes` are now real (see B.6) — `overtime_minutes` is still frozen
at 0 pending the client's overtime rule, so this view isn't wired into a reporting screen yet;
doing so today would be accurate on attendance/lateness but silently show zero overtime for
everyone.

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
| GET | `/api/notifications` | Notifications visible to the caller's role, with the caller's own read/dismissed state (FR-4) |
| GET | `/api/notifications/unread-count` | Caller's own unread count, for the navbar badge (FR-4) |
| PUT | `/api/notifications/mark-all-read` | Mark every notification the caller can see as read for that caller only (FR-4) |
| DELETE | `/api/notifications/clear/all` | Dismiss every notification the caller can see, for that caller only (FR-4) |
| DELETE | `/api/notifications/:id` | Dismiss one, for the caller only (FR-4) |
| PUT | `/api/notifications/:id/read` | Mark one read, for the caller only (FR-4) |
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

**4. Worker executes and submits.** ~~A worker sees their assigned stages (filtered to `Assigned`
or `Repair` — **there is no way for a worker to view stages currently `For QA` or already
`Approved`**; submitted work simply disappears from their list).~~ — **Resolved (FR-9)**:
`worker/WorkerJobOrder.jsx` now has `For QA` and `Approved` filters alongside `Assigned`/`Repair`,
so a submitted or completed task stays visible instead of vanishing from the list. Submitting sets
status to `For QA`, stamps `date_submitted`, and fires a notification to the Quality Checker.

**5. QA review.** The Quality Checker (or Admin/Production Manager — see B.1) reviews stages with
status `For QA` and either Approves (stamps `date_completed`) or sends to `Repair`. ~~**A repair
action carries no reason, comment, or evidence** — the worker learns only that the status
changed, with no notification channel of their own to see why (Workers receive no notifications
at all).~~ — **Resolved (FR-6/FR-9)**: `jobOrderService.updateQAStatus` now 400s a `Repair` sent
with no non-empty reason, and `globals/ProjectVerificationDetail.jsx` prompts for one before
submitting (Approve stays reason-optional). `worker/WorkerJobOrderDetail.jsx` shows the reason
(and who sent it) on the worker's own task. On top of that, every Approve/Repair decision now
fires a `'task'`-typed notification targeted at just that one worker (`notifications.target_user_id`,
migration `1790503216322_per-user-notification-target.js`) — not a `'Worker'`-wide broadcast,
which would put every other worker's task outcomes in everyone's list — surfaced on a new Worker
notification screen (`worker/WorkerNotification.jsx`, using the same `globals/NotificationList.jsx`
FR-4 built) with a navbar badge and live polling like the other three roles.

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
opens a worker's log and manually adds a date/time-in/time-out record. **FR-5 (done, overtime on
hold):** `status`/`late_minutes` are now computed from the times entered against the shop's
working hours (see B.6) and shown on the log; `overtime_minutes` is still not computed, pending
the client's overtime rule. The productivity
leaderboard separately compares each assignment's `date_submitted` against its `due_date` to
classify Early/On-time/Late, and counts current-status `Approved`/`Repair` — meaning a stage that
was once sent to Repair and later Approved shows only as Accepted, and repair history silently
disappears from the metric over time.

## B.6 Known functional gaps

Stated as product facts — what a user experiences — not as code defects.

- ~~**Inventory has a real backend now (P1-11), except for the project link.**~~ **Resolved
  (FR-3's final clause).** Items, variants, stock adjustment (with a who/when/how-much/why audit
  trail via `stock_movements`), low-stock reporting, and now materials-consumed-per-project are
  all server-persisted through `/api/inventory`, shared correctly across Admin, Production
  Manager, and Inventory Staff. A stock adjustment reason `'Used'`/`'Returned'` may optionally
  carry a `projectId`, recorded from either the Job Order detail screen (`ProjectMaterials.jsx`)
  or the Inventory screen's adjuster row (so Inventory Staff, who have no job-order screen, can
  tag usage too); the project must be open (`Pending`/`In Progress`) and a `'Returned'` amount
  can't exceed that project's net consumption of the variant so far. Quantities only — nothing
  feeds Profit's `materials_cost`, since variants carry no unit price; that stays hand-entered.
- ~~**Attendance status is never computed.**~~ **Resolved (FR-5), status/late minutes only.**
  `services/attendanceService.js` now computes `status`/`late_minutes` server-side against the
  shop's working hours (shift 08:30–17:00, a 15-minute grace period before `Late`, lunch
  12:00–13:00 excluded from worked time, and a worked day under 4 hours is `Half-day` regardless
  of arrival time, taking priority over `Late`) on every insert/update, and a migration backfilled
  every pre-existing row with the same formula — see `WORKING_HOURS` in that file for the exact
  rules. **`overtime_minutes` is deliberately still left at 0** — the client hasn't specified the
  overtime rule yet (e.g. whether a few extra minutes count, or only whole hours past shift end)
  — so `attendance_summary`'s overtime columns remain meaningless until that's clarified, even
  though its status/late-minutes columns are now real.
- ~~**Notifications are global, not per-user.**~~ **Resolved (FR-4).** `target_role` is now a real
  `user_role` value (the old `'PM'`/`'QC'` are normalized on migration), and every notification
  query — list, unread-count, mark-read, dismiss — filters by it: a caller sees a notification only
  when `target_role` matches their own role, or they're Admin (who sees everything, per B.1).
  Read/dismissed state moved off the single shared `notifications.is_read` column into a per-user
  `notification_receipts` table, so one person opening or clearing a notification no longer
  affects anyone else's list — see `migrations/1790500717992_per-user-notifications.js` and
  `models/adminNotifModel.js`. The P2 per-role screen consolidation
  (`globals/NotificationList.jsx`) and its `?type=` bulk-action scoping are unaffected by this.
- ~~**Notifications never update live.**~~ **Resolved (FR-4).** `globals/NotificationProvider.jsx`
  polls `GET /api/notifications/unread-count` every 30s (paused while the browser tab is hidden,
  and re-polled immediately when it becomes visible again) for the three notification-bearing role
  shells (Admin, Production Manager, Quality Checker). The navbar badge and
  `globals/NotificationList.jsx`'s list both pick up a new notification without a manual reload.
  Polling, not push — see CLAUDE.md "Hosting target" for why a WebSocket/SSE channel isn't
  justified on the one-vCPU deployment target for this few roles/users.
- **`Rework` is invisible in reporting.** The status enum includes both `Rework` and `Repair`, but
  only `Repair` is ever produced by the UI and only `Repair` is counted in productivity.
- ~~**No QA audit trail.** `qa_checker_id` and `qa_notes` exist on `job_assignments` but are never
  written by any code path, so there's no record of who approved or rejected a stage, or why.
  `project_profit.recorded_by` is the same story for financial entries.~~ — **Resolved (FR-7)**:
  `jobOrderService.updateQAStatus` now writes `qa_checker_id` (the reviewer's own user id) and
  `qa_notes` on every Approve/Repair decision — never on a worker's own submission, so a worker
  resubmitting can't overwrite who reviewed a prior round. `profitService.saveProfit` writes
  `project_profit.recorded_by` from the session user on every save. **By design, not a gap:**
  Admin and Production Manager still both hold approve rights (see the segregation-of-duties
  bullet below) — `qa_checker_id` makes that visible in the data rather than closing it.
- ~~**Project status has two sources of truth**: a stored `status` column, and a value recomputed
  on read via a `CASE ... EXISTS` query. The two can disagree.~~ — **Resolved (FR-8)**: the
  `CASE ... EXISTS` in `models/projectModel.js`'s `getAllProjects` is gone; every read now selects
  the stored `projects.status` column directly. A migration
  (`migrations/*_project-status-single-source-of-truth.js`) backfilled existing rows to match what
  the old `CASE` would have derived, then added `NOT NULL`, a default of `'Pending'`, and a
  `CHECK (status IN ('Pending','In Progress','Completed'))` — the column was free text with no
  constraint before this. `markProjectAsCompleted` now enforces "every *assigned* stage must be
  Approved" (PRD B.5 workflow 6) transactionally in the database (`FOR UPDATE` locks the project
  row across the read-then-write) instead of only in the frontend's disabled-button check, and
  distinguishes an unknown project (404) from one that isn't ready yet (409) — previously it
  answered `200` for both an unknown project id and a project completed with outstanding work.
  **Not changed:** the "not all five stages" loophole this same bullet used to describe is still
  live — a project that was only ever assigned one of the five possible stages completes on that
  stage's approval. Closing it requires deciding every project needs all five stages, which isn't
  true (a project with no painting shouldn't need a Painter stage to complete); left as a product
  decision, not fixed here.
- ~~**The monthly-profit figure has no year predicate**~~ — **Resolved**: both
  `adminDashboardModel.js` and `profitModel.js`'s monthly-profit queries now carry a year predicate
  alongside the month one, and compare against `AT TIME ZONE 'Asia/Manila'` rather than the
  server's local time.
- **Segregation of duties**: both Admin and Production Manager can approve/reject QA on their own
  team's work, despite a dedicated Quality Checker role existing. **Deliberately not changed by
  FR-7** (see above) — Admin/PM keep approve rights; `qa_checker_id` now records who actually
  signed off, so this gap is visible in the audit trail rather than closed.
- ~~**Dates entered in the shop's local timezone are corrupted on edit.** The project-edit form
  round-trips a date through JavaScript's UTC conversion before display; in UTC+8, an edited
  project's dates can silently shift by a day when re-saved.~~ — **Resolved (track A)**:
  `EditProjectForm.jsx` used `new Date(x).toISOString().split('T')[0]` to populate its date
  inputs, which parses to local midnight and renders in UTC — a day earlier in UTC+8. Replaced
  with `utils/format.js`'s new `toDateInputValue`, which builds the date string from local
  calendar parts instead of round-tripping through UTC.
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
| FR-3 | Inventory is a real, server-persisted module: items and variants via API, stock increment/decrement with an audit trail (who, when, how much, why), low-stock alerting against each variant's configurable `min_stock` **(✅ done, P1-11)**, and a record of materials consumed per project **(✅ done — see B.6.)**. |
| FR-4 | Notifications carry per-user read state (not a single shared flag), are correctly filtered by the recipient's role, and update without a manual page reload (polling or push). **(✅ done — see B.6.)** |
| FR-5 | Attendance status, late minutes, and overtime minutes are computed server-side from recorded time-in/time-out against the shop's defined working hours, not left at a default. **(✅ status/late minutes done — see B.6; overtime deliberately on hold, see below.)** |
| FR-6 | Assignment status changes follow an enforced state machine (e.g. `Assigned → For QA → Approved`, `For QA → Repair → Assigned`) rather than accepting an arbitrary string **(✅ done — `jobOrderService.updateQAStatus`'s `WORKER_SUBMITTABLE_FROM` allow-list and role-scoped target statuses reject an invalid transition with a 409)**; QA rejections require a reason **(✅ done — a `Repair` with no non-empty reason 400s; see B.5 workflow 5)**. |
| FR-7 | Every QA decision and every financial entry records who made it and when (audit trail on `job_assignments` and `project_profit`, actually populated). **(✅ done — see B.6.)** |
| FR-8 | Project status is a single source of truth (the stored column, updated transactionally alongside the events that change it — not recomputed differently on read). **(✅ done — see B.6.)** |
| FR-9 | Workers can see the full lifecycle of their own tasks, including those currently `For QA` or already `Approved`, and receive notification of QA outcomes including rejection reasons. **(✅ done — see B.5 workflows 4/5.)** |

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
| **Storage discipline** | **✅ Resolved for worker photos** (the only photo field actually in use — see B.2's `attendance.photo` note). Worker photos are real files on the `uploads` Docker named volume (`backend/src/utils/photoStorage.js`), resized client-side to ~512px before upload (`frontend/src/utils/resizeImage.js`) and capped server-side at 512KB after decoding — `worker_details` stores only a filename (`photo_path`). `GET /api/workers` no longer inlines the photo into every row; a viewer fetches one at a time via `GET /api/workers/:id/photo`. `scripts/backfillPhotos.js` (run automatically on every container boot, `docker-entrypoint.sh`) moves any pre-existing base64 value out of the database. |
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

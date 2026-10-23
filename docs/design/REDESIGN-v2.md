# REDESIGN-v2.md — brief for Claude Design

This file is written for **Claude Design** to read cold, with no other repo context. If you're a
human: this is the brief, `DESIGN.md` is the binding rulebook it's constrained by.
[`REDESIGN.md`](REDESIGN.md) was the first round (ARCHITECTURE_REVIEW.md item 44) — it's kept as
history and isn't required reading, since every "current state" claim below is re-measured against
the code as it stands today, after item 44 shipped.

**Status: this brief is new, not yet run.** ARCHITECTURE_REVIEW.md item 48.

**Attach a current screenshot of the Admin dashboard, plus 2–3 other screens (a Job Order detail
page, the Worker List, and one modal, e.g. Add Worker) alongside this file when you hand it off.**

## 1. What this app is

Wooden Bizarre Management System — an internal operations tool for a custom woodworking shop. It
tracks client orders from intake through production and QA to completion, plus profitability,
attendance, and worker productivity. Five roles: Admin, Production Manager, Inventory Staff,
Quality Checker, Worker. It's used at a desk (Admin, Production Manager, Quality Checker, Inventory
Staff) and on the shop floor from a phone (Worker — this is the one role most likely to be used
one-handed, away from a desk, and the project's standing mobile-responsiveness priority).

This brief covers **two things**: an app-wide component kit (so every screen can modernize, not
just one), and a specific redesign of the **Admin dashboard**, which gets new sections beyond what
item 44 built.

## 2. The problem

The user's own words, looking at the live, already-redesigned (item 44) Admin dashboard: **"it
looks like a 2009 UI."** Concretely, across the app today:

- **Flat white-on-white with no surface hierarchy.** The page background and every card are the
  same white (`--color-surface`), separated only by 1px borders — nothing reads as "raised" or
  gives the eye a resting layer behind the content.
- **No shared component language.** Each screen has its own bespoke button/input/card classes
  (`.add-worker-modal .form-group input`, `.search-bar input`, `.btn-add-worker`, …) with
  inconsistent radii, padding and sizing between screens, rather than one shared vocabulary.
- **Mismatched corner radii everywhere**, measured directly from `frontend/src/css/*.css`:
  12px appears 30 times, 10px 21 times, 8px 22 times, 20px 14 times, 16px 10 times, plus smaller
  counts at 5/6/15/30px — at least eight different radii in active use, with no evident system,
  plus:
- **27 full-pill (25px radius) buttons/badges** scattered across `globals.css`, `admin.css` and
  `worker.css` — filter chips, modal actions, notification actions, status pills — reading as
  consumer-app/rounded rather than an internal console.
- **14 `linear-gradient` fills**, mostly gold, used decoratively on things like the sidebar glow
  and old stat-card treatments rather than as a deliberate accent.
- **The Admin dashboard itself is sparse.** Item 44 fixed the page's density/sizing problems but
  only shows 3 numbers (active projects, total workers, monthly profit) and a notification list —
  there's no trend, no shortcut to the most common action (create a project), and no sense of
  what's coming up.

**Goal this round: a modern, warm SaaS-dashboard feel** — closer to what a 2024+ operations
console (Linear, Vercel, Stripe-dashboard-adjacent) looks like — **not** the flatter,
information-console direction item 44 asked for. Re-read §4 below carefully: it reverses several
of item 44's specific choices (radius, shadow) on purpose.

## 3. Hard constraints

These come from `docs/design/DESIGN.md`, the project's binding UI rulebook, and must not be
violated:

- **Palette is locked** (hex values below) — typography, spacing, radii and shadows are open to
  change.
- **Every interactive element has a ≥44px hit area** in its smaller dimension, even if the visual
  is smaller — pad a small-looking button's hit area invisibly if needed.
- **Nothing is conveyed by `:hover` alone** — this app runs on touchscreens with no hover.
- **A visible `:focus-visible` ring** on every interactive element — never removed without an
  equally visible replacement.
- **Breakpoints are 768px (mobile) and 1024px (tablet) only** — no new breakpoint without a
  documented reason.
- **No horizontal page scroll at 360px wide.**
- **Body text ≥4.5:1 contrast; large text (≥24px, or ≥18.66px bold) and UI-element boundaries
  ≥3:1.**
- **Gold (`--color-accent`) is a fill/border/dark-background color, never text on a light
  surface** — it fails 4.5:1 and even 3:1 against white or cream. Use `--color-accent-dark` (large
  text only) or `--color-accent-text` (everything else) instead. On the dark sidebar, gold text or
  icons are fine (it's a dark surface, not light).
- **Text/icons sitting on top of a solid gold fill use `--color-text-on-accent`**, never white —
  white-on-gold measures only ~2.3–2.8:1.
- **No new hex literals.** Reuse a token below, or propose a new *named token* (e.g. a page
  background tint, a chart series color) — never a one-off value baked into a component.
- **Icons are Font Awesome, solid style only.**
- **Typography: one family, Geist** (self-hosted, behind the `--font-sans` token), for everything
  including page titles — **except** two deliberately narrow exceptions that must stay exactly as
  they are: the literal brand wordmark "The Wooden Bizarre," and the Login page's hero tagline
  ("Craft, tracked. Business, mastered.") — both use a second token, `--font-brand` (Playfair
  Display). **Do not extend `--font-brand` to anything else**, including dashboard headings.

### Palette (locked — reuse these, don't invent new ones)

| Token | Hex | Use |
|---|---|---|
| `--color-accent` | `#cca43b` | Brand gold — fills, borders, dark-surface text |
| `--color-accent-light` | `#d4c47a` | Light gold tint |
| `--color-accent-dark` | `#8b7a2a` | Gold as large text (≥24px / ≥18.66px bold) |
| `--color-accent-text` | `#5c4a11` | Gold as normal-size text/icon fill |
| `--color-text-on-accent` | alias of `--color-text` | Text/icon on a solid gold fill |
| `--color-surface` | `#ffffff` | Card/panel background |
| `--color-surface-dark` | `#1a1612` | Sidebar, dark buttons |
| `--color-surface-cream` | `#fbf5e8` | Soft accent panels |
| `--color-border` | `#eaeaea` | Hairline borders/dividers |
| `--color-text` | `#1a1612` | Body text |
| `--color-text-muted` | `#756d5a` | Secondary text |
| `--color-text-inverse` | `#ffffff` | Text on dark surfaces |
| `--color-danger` | `#d32f2f` | Errors, rework/reject |
| `--color-danger-on-dark` | `#ef5350` | Danger text on the dark sidebar |
| `--color-success` | `#2e6b3b` | Approved/positive states |
| `--color-info` | `#2b4c7e` | In-progress states |
| `--color-warning` | `#9a4b00` | Priority/attention states |
| `--color-focus` | alias of `--color-info` | Keyboard focus ring (light surfaces) |
| `--color-focus-on-dark` | alias of `--color-accent-light` | Keyboard focus ring (dark sidebar) |
| `--color-accent-tint` | `rgba(204, 164, 59, .14)` | Low-alpha gold wash (e.g. active-nav bg) |

All of these are real CSS custom properties on `:root` in `frontend/src/css/globals.css` — a `*-rgb`
sibling (e.g. `--color-accent-rgb: 204, 164, 59`) exists for most of them, for building an `rgba()`
tint. Propose additions in the same style, not as inline literals.

### Current layout/spacing/radius/shadow tokens (all open to revision)

Added in item 44, all real tokens in the same `:root` block:

| Token | Value |
|---|---|
| `--radius-sm` | 2px |
| `--radius-md` | 4px |
| `--space-1` / `-2` / `-3` / `-4` / `-6` / `-8` | 4 / 8 / 12 / 16 / 24 / 32px |
| `--font-size-xs` / `-sm` / `-md` / `-lg` / `-xl` / `-2xl` | 12 / 13 / 14 / 16 / 20 / 24px |
| `--font-size-kpi` | 28px |
| `--shadow-sm` | `0 1px 2px rgba(26, 22, 18, .06)` |
| `--sidebar-width` | 236px |
| `--sidebar-rail` | 80px |

**These are exactly what this brief is asking Claude Design to revise.** `--radius-md` at 4px and
a single barely-visible `--shadow-sm` are the item-44 "flat console" choices that produced the
"2009 UI" read when combined with the rest of the app's inconsistency. Proposing a slightly larger
radius scale (e.g. 6–10px) and a 2–3 step shadow scale (resting, raised, overlay) is expected and
welcome.

## 4. Design direction

**Modern, warm SaaS dashboard** — the feel of a well-made 2024+ operations console (think Linear,
Vercel or a Stripe dashboard), not a flat internal console and not a soft consumer app. In
concrete terms, several of these intentionally **reverse** item 44's specific choices:

- **Surface hierarchy.** Give the page itself a very subtle tinted background (a near-white, warm
  neutral — propose it as a new token, not a raw hex), with white cards and panels sitting visibly
  on top of it. Item 44's page background was plain white, identical to every card.
- **Softer radii.** Propose a slightly larger, still-restrained radius scale — roughly **6–10px**
  for cards/panels/modals, **4–6px** for buttons and inputs, **3–4px** for small badges. This
  replaces item 44's uniform 2px/4px scale. Still **no full pill buttons** (nothing at 20px+
  radius) and still sharper than the current 12–25px mess described in §2.
- **A real but restrained shadow scale.** 2–3 steps: a resting card shadow, a slightly stronger
  "raised" shadow (e.g. for a hovered or focused card, or a popover), and an overlay/modal shadow.
  Still **no hover-lift or translate animation** — a shadow can change on hover/focus, position
  must not.
- **No gradients.** Gold is for primary actions, accents, and small semantic bars/indicators —
  never a large gradient fill. This matches item 44's rule; it's the one thing item 44 got right
  and v2 keeps.
- **More breathing room between sections**, but not a return to the pre-item-44 oversized feel —
  keep item 44's tighter page gutter and type scale as the baseline, and add deliberate spacing
  between distinct sections (e.g. the KPI row, the new trend/upcoming-projects area, and
  notifications) rather than uniformly inflating padding everywhere.
- **Typography stays as item 44 left it**: Geist throughout, a 12/13/14/16/20/24/28px scale,
  tabular figures for numbers. This isn't being revisited in this round.

## 5. App-wide foundation: a component kit

This is new in v2 — item 44 only restyled the dashboard and the sidebar; everything else still
uses ad hoc per-screen classes. Produce a **spec sheet** (not full page mockups) for each of the
following, covering all listed variants and states, so later work can migrate screens one at a
time against one shared vocabulary rather than inventing new per-screen CSS. For each component,
give the current state (below), then the target.

- **Buttons.** Current: no shared button class — e.g. `.submit-btn` (Login), `.btn-add-worker`,
  various 25px-pill action buttons. Target: primary (solid gold, `--color-text-on-accent`),
  secondary (outline or tinted), ghost (text-only), and danger (outline or solid
  `--color-danger`) — plus an icon-only button variant. All at a default size with a ≥44px hit
  area, and state treatments (hover, focus-visible, disabled, loading).
- **Form fields.** Text input, select, textarea, and a search field (with a leading icon, as
  `.search-bar input` already has). A field wrapper with label, helper/hint text, and an error
  state (`--color-danger` text + border), matching how validation already surfaces in e.g.
  `AddWorkerModal`.
- **Card / panel.** A generic surface primitive: optional header row (title + trailing actions,
  like the Notifications panel's "Mark all as read" / "Clear all"), body, optional footer.
- **Data table**, including the existing mobile fallback: `.wb-card-table` already converts a
  table to stacked cards at narrow widths using a `data-label` attribute per cell
  (`frontend/src/globals/JobOrderDetails.jsx`, `admin/Profit.jsx`, `globals/InventoryTable.jsx`
  are current examples) — keep that mechanism, just give the resulting look the new visual
  language (radius, shadow, spacing).
- **Status badges.** Keep the existing semantic mapping (`frontend/src/utils/status.js`'s
  `taskStatusClass`): Assigned (gold/accent), In Progress (info/blue), For QA (warning/amber),
  Approved (success/green), Repair/Rework (danger/red), with a neutral fallback. Only the pill's
  shape/radius is open to change, not its color-to-status mapping (that's an accessibility-tested
  contract — see ARCHITECTURE_REVIEW.md item 35).
- **Tabs** (used for sub-navigation, e.g. Admin's Account Creation screen's two tabs).
- **Modal / drawer.** Centered modal (e.g. Add Worker) and the existing off-canvas mobile nav
  drawer — both already use `frontend/src/hooks/useDialog.js` for focus-trap/Escape/return-focus
  behavior; only the visual treatment changes.
- **Toast notifications** (`globals/ToastProvider.jsx`) — success/error/info variants.
- **Pagination** (`globals/Pagination.jsx`) — page controls shown below a paged list.
- **Empty state and loading skeleton** — a generic pattern usable for "no data yet" and
  loading-in-progress across different screens (the Notifications panel already has its own
  version of both; generalize that look).
- **Page header** — title, optional subtitle/date, and a slot for a primary action button on the
  right (the dashboard's new "Create project" button, in §6, is the first real consumer of this).
- **Sidebar** (`globals/Navbar.jsx`) — refine item 44's version (236px desktop / 80px tablet rail /
  280px mobile drawer + dark mobile topbar) to match the new radius/shadow language on its active
  nav indicator and any raised elements, without changing its dark-surface color or its structure.

## 6. Screen: the Admin dashboard v2

Builds on item 44's layout (page header, KPI row, notifications panel) and adds the sections the
user asked for. **Every data point below has a real backend source already implemented — nothing
here should be invented or designed against fake/placeholder data shapes.**

- **Page header.** "Dashboard" + the current month (unchanged from item 44), plus a new **primary
  "Create project" button** at the right of the header row (per the new page-header component in
  §5). It's a real navigation shortcut — clicking it goes to the existing Create Project screen.
- **KPI row.** Unchanged data: active projects, total workers, monthly profit — `GET
  /api/dashboard/stats`. Restyle with the new card look (§4's radius/shadow), keep the layout (3
  cards, stacking at ≤768px).
- **Profit trend.** New. `GET /api/dashboard/profit-trend` (Admin only) returns the last 6 months
  of net profit, oldest first:
  ```json
  [
    { "month": "2026-05", "netProfit": 0 },
    { "month": "2026-06", "netProfit": 0 },
    { "month": "2026-07", "netProfit": 0 },
    { "month": "2026-08", "netProfit": 23000 },
    { "month": "2026-09", "netProfit": 0 },
    { "month": "2026-10", "netProfit": 0 }
  ]
  ```
  (Real response shape, captured against the dev database.) A month with no recorded profit comes
  back as exactly `0`, not omitted — always 6 entries. The last entry always equals the KPI row's
  "Monthly profit" card, since both use the same month-attribution rule.
  - Propose a chart type: a bar chart (one bar per month) or a filled area/line chart. It needs to
    read clearly with mostly-zero data (a shop with sparse completed projects some months) as well
    as with a large value (handle `₱1,234,567.89` without the axis/labels breaking). Use a solid
    accent fill or a single muted series color, not a decorative gradient — §4 still bans
    gradients, since this chart lives inside a card already on a white surface.
  - Needs an accessible text alternative (e.g. a visually-hidden data table) — it will be
    hand-built as inline SVG, so don't assume any particular charting library's default styling.
  - Month labels should read e.g. "May" / "Jun" (short form), not the raw `"2026-05"` string.
- **Upcoming projects.** New. `GET /api/job-orders?limit=5` returns the next 5 non-completed
  projects sorted by due date ascending (soonest first), each with `id`, `project_name`,
  `client_name`, `due_date`, `priority_level`, and `status`. Real response shape:
  ```json
  { "id": 7, "project_name": "Dining Set", "client_name": "Santos Family",
    "due_date": "2026-11-02", "priority_level": "High", "status": "In Progress" }
  ```
  - Render as a compact list or mini-table: project id (shown as `WB-07`, i.e.
    zero-padded with a `WB-` prefix — the app's existing project-id display format), name, client,
    due date, and a priority/status badge (reuse the badge component from §5).
  - A project whose due date has already passed should be visually distinguished (e.g. the due
    date in `--color-danger`) — "overdue" isn't a field in the payload, it's `due_date < today`.
  - Each row is a link to that project's job order detail page.
  - Include a "View all" link/button to the full Job Order list screen.
  - **Empty state:** no active projects — show the shared empty-state pattern from §5, not a blank
    gap.
- **Notifications.** Same panel as today (`globals/NotificationList.jsx`), same data
  (`GET /api/notifications`) — **but remove the icon box entirely, everywhere this component is
  used** (the dashboard panel and the standalone Notification tab on Admin/PM/QC — it's one shared
  component). Each row becomes text-only: the unread indicator (the existing left accent bar +
  dot), title, message, and timestamp — no leading icon square. Keep the header's "Mark all as
  read" / "Clear all" actions and the unread-row visual treatment (accent bar) exactly as a
  concept, restyled per §4/§5.
- **Layout.** Suggest an arrangement at 1366px — e.g. a 2-column row (profit trend + upcoming
  projects side by side) with the KPI row above and notifications full-width below — but the exact
  grid is open; optimize for scanability over a literal 2-column mandate. Must also work cleanly
  at 1024px (tablet, sidebar collapsed to the rail) and 360px (mobile, drawer closed and open) —
  everything stacks single-column at ≤768px, same breakpoint item 44 already uses.
- **States to design, not just the happy path:** loading (skeleton) and empty (no data) for each
  of the three new sections independently — a shop could have projects due but no profit history
  yet, or vice versa; a long currency value (`₱1,234,567.89`) in both the KPI card and the trend
  chart; and visible keyboard-focus states on the new "Create project" button and each
  upcoming-project row.

**Explicitly out of scope — do not add:** anything needing a backend endpoint that doesn't already
exist (e.g. "today's attendance," per-worker productivity widgets, inventory alerts). If you think
one would genuinely help, list it as a "future, needs backend" idea rather than designing it
against invented data.

## 7. Implementation mapping

So the output translates back into real code without guesswork:

| Design element | Component | CSS |
|---|---|---|
| KPI cards | `frontend/src/globals/InfoCard.jsx` | `.info-card*` in `globals.css` |
| Profit trend | new component, `frontend/src/admin/ProfitTrendChart.jsx` (doesn't exist yet) | new |
| Upcoming projects | new component, `frontend/src/admin/UpcomingProjects.jsx` (doesn't exist yet) | new |
| Notifications panel | `frontend/src/globals/NotificationList.jsx` | `.notif-*` in `admin.css` — shared by the Admin/PM/QC Notification tabs too |
| Sidebar | `frontend/src/globals/Navbar.jsx` | `.wooden-navbar`, `.nav-item`, `.mobile-topbar` in `globals.css` |
| Page header | `frontend/src/admin/A_Dashboard.jsx`'s header block today; a shared component is the ask | `.admin-page-header` in `globals.css` |
| Page layout/gutter | `frontend/src/admin/A_Dashboard.jsx` | `.page-content`, `.admin-dashboard`, `.admin-stats-grid` in `globals.css` |

**Data sources** (already implemented, Phase A of item 48):
- `GET /api/dashboard/stats` — Admin, Production Manager
- `GET /api/dashboard/profit-trend` — Admin only
- `GET /api/job-orders?limit=5` — Admin, Production Manager
- `GET /api/notifications` — every role except Inventory Staff

**Expected output includes:** a token table of every new/changed `--radius-*`/`--space-*`/
`--font-size-*`/`--shadow-*`/surface-tint token, with values — expressed as token
additions/changes, not inline hex or pixel literals scattered through component specs.

## 8. Deliverables requested

- The component kit spec sheet (§5): one representative example of each component/variant/state,
  doesn't need to be a full page.
- Dashboard mockups at **1366px** (desktop), **1024px** (tablet, sidebar collapsed to the rail),
  and **360px** (mobile, both drawer-closed and drawer-open).
- The states listed in §6.
- A token table: every new or changed token, with its value and intended use.
- **One** representative non-dashboard screen (the Job Order detail page,
  `frontend/src/globals/JobOrderDetails.jsx`) restyled using the component kit, as a proof that the
  kit actually carries over to a dense, table-heavy screen and not just the dashboard.

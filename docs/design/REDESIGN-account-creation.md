# REDESIGN-account-creation.md — brief for Claude Design

This file is written for **Claude Design** to read cold, with no other repo context. If you're a
human: this is the brief, `DESIGN.md` is the binding rulebook it's constrained by.

**Status: brief — not yet implemented.** ARCHITECTURE_REVIEW.md item 51 (this brief).
Implementation will be its own later item, the same two-phase flow as items 48 → 49.

This app already has a shipped design system: Claude Design project
`74c0aaa0-cdb0-4957-b893-5957f7cf422c` (`Admin Dashboard Redesign.dc.html` — `DashboardV2`,
`SidebarV2`, `ComponentKit`, `JobOrderDetail`). **Open that project and treat it as the visual
reference before proposing anything new.** This brief is not a fresh design round — it's asking
for one more screen to be brought onto a language that's already decided (§2).

**Attach these screenshots alongside this file when you hand it off:**
- the Account Creation tab, both its plain-role view and its Worker view (the extra "Job
  information" fields)
- the Account List tab
- the delete-account confirmation modal
- the Admin dashboard, as the live reference for the already-shipped look

## 1. What this app and screen are

Wooden Bizarre Management System — an internal operations tool for a custom woodworking shop. It
tracks client orders from intake through production and QA to completion, plus profitability,
attendance, and worker productivity. Five roles: Admin, Production Manager, Inventory Staff,
Quality Checker, Worker.

This brief covers one screen: **Admin → Account Creation**
(`frontend/src/admin/CreateAccount.jsx`), reached from the sidebar tab of the same name. It's
Admin-only and has two tabs:
- **Account Creation** (`admin/AccountForm.jsx`) — creates a login for any of the five roles.
- **Account List** (`admin/AccountList.jsx`) — lists every account and deletes one.

**Overlap, explicitly out of scope:** Worker List's own "Add Worker" modal
(`admin/AddWorkerModal.jsx`) can also create a Worker account, and shares its job-info fields
with this form (`admin/WorkerJobFields.jsx`, `globals/PhotoUpload.jsx`). Restyling that modal is a
separate, later screen — not this brief.

## 2. The design language is already decided. Reuse it, don't re-propose it.

Everything below is live today in `frontend/src/css/globals.css`'s `:root` and its "COMPONENT
KIT" section, and already renders on the Admin dashboard and the Job Order detail page. **Use
these as-is.** A new token is only acceptable when nothing below genuinely fits — flag any such
case explicitly as a deviation, with a one-line reason, the same way REDESIGN-v2.md's
implementation (item 49) flagged its own deliberate deviations. A silent new value is not an
acceptable outcome of this brief.

### Tokens already shipped

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | badges, skeleton bars |
| `--radius-md` | 6px | buttons, inputs, nav items, tabs |
| `--radius-lg` | 8px | cards, panels, toasts, icon tiles |
| `--radius-xl` | 10px | modals, mobile drawer |
| `--space-1` … `--space-8` | 4/8/12/16/20/24/32px | spacing scale (`--space-5` = 20px, card/panel padding) |
| `--section-gap` | 32px | gap between distinct page sections |
| `--font-size-xs/-sm/-md/-lg/-xl/-2xl/-kpi` | 12/13/14/16/20/24/28px | type scale |
| `--shadow-1` | resting | cards/buttons at rest |
| `--shadow-2` | raised | hover/focus state of a raised surface |
| `--shadow-3` | overlay | modals, the mobile drawer |
| `--color-surface-page` | `#f7f5f0` | the page background behind white cards (already the Admin page's background) |
| `--color-border-strong` | `#8f877a` | input / secondary-button borders, ≥3:1 on white |
| `--color-info-tint` / `--color-warning-tint` / `--color-success-tint` / `--color-danger-tint` / `--color-neutral-tint` | low-alpha washes | badge/row backgrounds |
| `--control-height` | 36px | visual button/input height |
| `--hit-min` | 44px | minimum real hit area (via an `::after`, not padding) |
| `--focus-ring` | `2px solid var(--color-focus)` | what `:focus-visible` renders everywhere |

Plus the full locked palette (§4 below) and the existing radius/space/shadow values are the
complete scale — don't add a step between them.

### Kit classes already shipped (`globals.css`, "COMPONENT KIT" section)

- **`.wb-btn`** + `--primary` / `--secondary` / `--ghost` / `--danger` / `--danger-solid` /
  `--icon`. A 36px visual control inside a real 44px hit area.
- **`.wb-panel`** with `__header` / `__title` / `__subtitle` / `__body` / `__footer`.
- **`.wb-page-header`** with `__title` / `__subtitle`, and a slot on the right for a primary
  action button.
- **`.wb-field`** / **`.wb-input`** (text/select/textarea) with `__label`, `__hint`, `__error`.
- **`.wb-badge`** — shape only; color comes from the existing `.wb-status--*` classes
  (`utils/status.js`), or a new semantic mapping you propose for account roles (§5).
- **`.wb-table`**, which becomes `.wb-card-table`'s stacked-card layout at ≤768px via a
  `data-label` attribute per cell — see `frontend/src/globals/JobOrderDetails.jsx` or
  `admin/Profit.jsx` for a live example of this mechanism; don't invent a different mobile
  conversion.
- **`.wb-empty`** (icon + title + text) and **`.wb-skeleton`** — the generic loading/empty
  patterns.
- The shared **`ConfirmModal`** (`globals/ConfirmModal.jsx`, `danger` variant already used by
  this exact screen's delete flow) and **`ToastProvider`** (success/error/info, now with a
  leading icon) — both already restyled onto these tokens; reuse them exactly as they render
  today, don't re-skin them.

### What is new and needs a design: **tabs**

REDESIGN-v2.md §5 asked for a tabs component, but item 49 shipped it unbuilt because nothing
consumed it yet. This screen is the first real consumer — design `.wb-tabs` now, for real use,
not a hypothetical.

## 3. The problem: current state, measured

This screen never went through item 44 or item 49 — it's still on its original, pre-redesign
CSS, entirely in `frontend/src/css/admin.css` (lines 1–336). Measured directly against that file:

- **25px pill shapes** on the tab buttons (`.create-account .tab-button`, line 30) and the
  account-role `<select>` (`.account-form .form-group select`, line 119) — v2's direction
  explicitly caps radii at 10px; nothing in this app should hit 20px+.
- **Radii outside the shipped scale:** 16px on the form card (`.tab-content-container`, line 56),
  12px on list rows (`.al-item`, line 237) and role badges' corner (line 280), 8px on inputs and
  the submit button. None of these are `--radius-sm/md/lg/xl`.
- **A hover-lift animation:** `.account-list .al-item:hover { transform: translateY(-2px) }`
  (line 246) — REDESIGN-v2.md §4 bans position/translate changes on hover; a shadow may change,
  position must not.
- **A hex literal that also fails contrast:** the delete icon is `color: #b3b3b3` (line 296),
  roughly 2.1:1 against white — under the 3:1 bar for a UI-element boundary, and not a token.
- **Non-token shadows:** e.g. `0 4px 20px rgba(0,0,0,.03)` (line 58) and `0 2px 5px
  rgba(0,0,0,.02)` (line 239) — ad hoc values, not `--shadow-1/2/3`.
- **Inline-styled loading and empty states:** a plain `<p style={...}>Loading accounts...</p>`
  and a `<div style={{ borderRadius: '12px', ... }}>No accounts found.</div>`
  (`admin/AccountList.jsx` lines 82 and 140) instead of `.wb-skeleton`/`.wb-empty`.
- **Tabs with no real tab semantics:** two plain `<button>`s with no `role="tablist"`,
  `role="tab"`, `aria-selected`, or `role="tabpanel"` (`admin/CreateAccount.jsx` lines 17–28).
- **A row "active" state that does nothing:** clicking a list row just toggles a highlight
  class (`admin/AccountList.jsx`'s `activeRowId`) with no associated action — worth dropping
  rather than carrying forward.

## 4. Hard constraints

Unchanged from REDESIGN-v2.md, repeated here so this brief is self-contained:

- **Palette is locked** (table below) — typography, spacing, radii and shadows are already fixed
  by §2 above, not open in this round either.
- **Every interactive element has a ≥44px hit area** in its smaller dimension, even if the visual
  is smaller.
- **Nothing is conveyed by `:hover` alone** — this app runs on touchscreens with no hover.
- **A visible `:focus-visible` ring** on every interactive element — the tabs, every field, the
  submit button, and every list row's delete button.
- **Breakpoints are 768px (mobile) and 1024px (tablet) only.**
- **No horizontal page scroll at 360px wide.**
- **Body text ≥4.5:1 contrast; large text (≥24px, or ≥18.66px bold) and UI-element boundaries
  ≥3:1.**
- **Gold (`--color-accent`) is a fill/border/dark-background color, never text on a light
  surface** — use `--color-accent-dark` (large text only) or `--color-accent-text` (everything
  else) instead.
- **Text/icons on a solid gold fill use `--color-text-on-accent`**, never white.
- **No new hex literals.** Reuse a token from §2, or propose a new named token with a reason.
- **Icons are Font Awesome, solid style only.**
- **Typography is Geist (`--font-sans`) for everything on this screen** — `--font-brand` stays
  limited to the literal "The Wooden Bizarre" wordmark and the Login hero tagline; do not extend
  it to this screen's headings.
- **No gradients.**
- **No hover-lift or translate animation** — this brief is explicitly removing the one that
  exists today (§3).

### Palette (locked — reuse these, don't invent new ones)

| Token | Hex | Use |
|---|---|---|
| `--color-accent` | `#cca43b` | Brand gold — fills, borders, dark-surface text |
| `--color-accent-light` | `#d4c47a` | Light gold tint |
| `--color-accent-dark` | `#8b7a2a` | Gold as large text (≥24px / ≥18.66px bold) |
| `--color-accent-text` | `#5c4a11` | Gold as normal-size text/icon fill |
| `--color-text-on-accent` | alias of `--color-text` | Text/icon on a solid gold fill |
| `--color-surface` | `#ffffff` | Card/panel background |
| `--color-surface-page` | `#f7f5f0` | Page background behind cards |
| `--color-surface-cream` | `#fbf5e8` | Soft accent panels |
| `--color-border` | `#eaeaea` | Hairline borders/dividers |
| `--color-border-strong` | `#8f877a` | Input / secondary-button borders |
| `--color-text` | `#1a1612` | Body text |
| `--color-text-muted` | `#756d5a` | Secondary text |
| `--color-text-inverse` | `#ffffff` | Text on dark surfaces |
| `--color-danger` | `#d32f2f` | Errors, delete |
| `--color-success` | `#2e6b3b` | Positive states |
| `--color-info` | `#2b4c7e` | In-progress / neutral-informational states |
| `--color-warning` | `#9a4b00` | Priority/attention states |
| `--color-focus` | alias of `--color-info` | Keyboard focus ring |

All are real CSS custom properties on `:root` in `frontend/src/css/globals.css` — a `*-rgb`
sibling exists for most, for building an `rgba()` tint.

## 5. Screen spec: real data contracts only

Every field, endpoint, and response shape below is real — nothing here should be invented.

### Page header
`.wb-page-header`: a title (propose copy — "Accounts" or similar; the sidebar nav label itself
stays "Account Creation" and is out of scope) and an optional subtitle. No primary action button
needed here — account creation is the form itself, not a navigation shortcut.

### Tabs — the new component
Two tabs: **"Create account"** and **"Account list"**. Design `.wb-tabs` as a real, reusable kit
component:
- Must be implementable as an actual ARIA tablist (`role="tablist"`/`"tab"`/`"tabpanel"`,
  `aria-selected`, arrow-key movement between tabs) — not just two buttons that happen to look
  like tabs.
- States: default, hover, selected, focus-visible, disabled (not used here, but part of the
  spec).
- Behavior at 360px: still usable one-handed, no horizontal scroll.
- No pill shape — radius comes from `--radius-md`, matching every other control.

### Create-account form — `.wb-panel`
Two fieldset-style sections inside one panel, matching the current grouping:

**"Account details"** (always shown):
- First name, Middle name ("Leave blank if none"), Last name — strip digits as typed.
- Suffix — select: None / Sr. / Jr. / II / III / IV / V.
- Username.
- Account Role — select: Admin / Production Manager / Inventory Staff / Quality Checker /
  Worker.
- Password, Confirm password — both min 8 characters.

**"Job information"** (shown only when Role = Worker):
- Photo upload — required; the submit button stays disabled until a photo is set.
- Role / Specialization — select: Carpenter / Carver / Liha / Delivery / Painter.
- Worker Type — select: Regular / Part-Time.
- Contact Number — digits only, up to 11, placeholder `09…`.
- Daily Rate (₱) — number.

**Submission:**
- Role = Worker → `POST /api/workers` with `{ username, password, firstName, middleName,
  lastName, suffix, workerType, role, contactNumber, dailyRate, photo }`.
- Any other role → `POST /api/users` with `{ username, password, firstName, middleName,
  lastName, suffix, userRole }`.
- Submit button reads "Create account" at rest, "Creating…" while submitting, and is disabled
  during submission or (Worker only) until a photo is set — use `.wb-btn--primary`.
- A password/confirm mismatch blocks submission today via a toast; **propose an inline
  `.wb-field__error` on the Confirm password field instead**, so the error sits next to what
  caused it.
- Success clears the form and shows a success toast (unchanged behavior, restyled toast).

**Layout:** 2 columns at desktop/tablet widths, collapsing to 1 column at ≤768px — same
breakpoint the rest of the app uses.

### Account list — `.wb-table` → `.wb-card-table`
Real response shape, `GET /api/users`, capped at 200 rows (no paging UI, no search, no edit —
this is a deliberately small, bounded list):
```json
{ "user_id": 3, "formatted_id": "#003", "full_name": "JUAN DELA CRUZ",
  "username": "jdelacruz", "user_role": "Production Manager" }
```
Columns: ID (`formatted_id`), Name (`full_name`), Role (badge), Username, and a delete action.

- Table markup follows the existing `.wb-card-table`/`data-label` mechanism so it collapses to
  stacked cards at ≤768px — see `globals/JobOrderDetails.jsx` for the live pattern.
- Role shown as a `.wb-badge`. Propose a color mapping drawn from the existing tint tokens
  (`--color-info-tint`, `--color-success-tint`, etc.) — but it must read as a **category**, not a
  **status**: don't reuse the task-status green/red/amber/blue meanings
  (Assigned/In Progress/For QA/Approved/Repair) for roles, since that would visually imply a
  workflow state that doesn't exist here.
- Delete action: a `.wb-btn--icon` (trash icon, danger color on hover/focus-visible) that opens
  the existing `ConfirmModal` (`danger` variant) exactly as it does today — no change to that
  flow, only its trigger button's look.
- Drop the current click-to-highlight row state (`activeRowId`) — it has no associated action and
  shouldn't be carried forward.

### States to design (not just the happy path)
- List: loading (`.wb-skeleton` rows), empty (`.wb-empty` — "No accounts yet"), and a fetch
  error (today silently swallowed to the console; propose a visible state, e.g. an inline error
  message with a retry action).
- Form: submitting; the Worker variant with no photo yet (submit disabled, with a visible hint
  near the upload control saying a photo is required); inline field errors (password mismatch);
  a server-error toast (e.g. a network failure).
- A long full name with a suffix, to confirm the table/card layout doesn't break ("MARIA SANTOS
  DELA CRUZ III").
- Visible focus rings on: each tab, every field, the submit button, and every row's delete
  button.

## 6. Out of scope / "future, needs backend"

List these as ideas, don't design them against invented data:
- Editing an existing account.
- Resetting a password.
- Deactivating an account instead of hard-deleting it.
- Search or filter on the account list.
- An inline "username already taken" field error. Today, a duplicate username isn't caught by a
  dedicated check — it falls through to a generic `500 Internal server error` (there's no
  `AppError` thrown for this case yet, see `backend/src/services/userService.js`). You may show
  where this error *would* surface (e.g. a `.wb-field__error` under Username), flagged as needing
  a backend change — don't design it as if the backend already supports it.
- Restyling Worker List's own Add Worker / Edit Worker modals, even though they share
  `WorkerJobFields.jsx` and `PhotoUpload.jsx` with this form.

## 7. Implementation mapping

So the output translates back into real code without guesswork:

| Design element | Component | CSS |
|---|---|---|
| Tab shell | `frontend/src/admin/CreateAccount.jsx` | `.create-account .tab-*` in `admin.css` (to be replaced by `.wb-tabs`) |
| Create form | `frontend/src/admin/AccountForm.jsx` | `.account-form*` in `admin.css` |
| Worker-only fields | `frontend/src/admin/WorkerJobFields.jsx` | shared with `AddWorkerModal.jsx`/`EditWorkerModal.jsx` |
| Photo upload | `frontend/src/globals/PhotoUpload.jsx` | inline styles today; shared with both worker modals |
| Account list | `frontend/src/admin/AccountList.jsx` | `.account-list .al-*` in `admin.css` |
| Delete confirm | `frontend/src/globals/ConfirmModal.jsx` | already on the kit |
| Tabs (new) | new kit component | new `.wb-tabs*` rules, `globals.css`'s "COMPONENT KIT" section |

**Data sources** (already implemented):
- `POST /api/users` — Admin only, every role except Worker.
- `POST /api/workers` — Admin only, Worker accounts.
- `GET /api/users` — Admin only, capped at 200, no paging UI.
- `DELETE /api/users/:id` — Admin only; returns `400` "You cannot delete your own account" if the
  caller targets their own row. Cover this as an error-toast case, or propose hiding the delete
  action on the caller's own row.

## 8. Deliverables requested

- Mockups at **1366px** (desktop), **1024px** (tablet), and **360px** (mobile):
  - the Create tab, both the non-Worker and the Worker variant
  - the List tab
  - the List tab at 360px in its card-table form
- A **tabs component spec sheet** covering every state in §5.
- The **states listed in §5**, not just the happy path.
- A **token table**: every new or changed token, with its value, intended use, and reason. An
  empty table ("no new tokens needed") is the expected and preferred outcome — this brief exists
  to reuse §2's language, not extend it.

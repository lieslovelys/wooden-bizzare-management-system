# REDESIGN.md — brief for Claude Design

This file is written for **Claude Design** to read cold, with no other repo context. If you're a
human: this is the brief, `DESIGN.md` is the binding rulebook it's constrained by.

> **Status: this brief has been implemented** — ARCHITECTURE_REVIEW.md item 44, built from the
> Claude Design project this brief produced. Everything below describes the brief as written and
> the *pre-item-44* state of the screen; it's kept as history and as the brief's own record, not
> updated to describe the current code. See item 44 for what actually shipped and where it
> diverged from (or filled a gap in) this brief.

## 1. What this app is

Wooden Bizarre Management System — an internal operations tool for a custom woodworking shop. It
tracks client orders from intake through production and QA to completion, plus profitability,
attendance, and worker productivity. It is used at a desk (Admin, Production Manager, Quality
Checker) and on the shop floor from a phone (Worker). This brief covers the **Admin dashboard**
and the **shared sidebar** every role uses — later screens will reuse the same foundation.

**Attach a current screenshot of the Admin dashboard alongside this file when you hand it off.**

## 2. The problem with the current UI

The current screens are a working first pass, not a finished design. Concretely, on the Admin
dashboard:
- Everything is oversized: large rounded cards, large type, large gaps.
- The page gutter is doubled (two stacked 40px paddings — see §6), wasting space that could go to
  content.
- Stat cards are filled edge-to-edge with a gold gradient, which reads as decorative rather than
  informational, and doesn't scale to more than 3 KPIs.
- Corners are rounded 12–16px and buttons are full pill shapes throughout — soft and consumer-app,
  not an internal operations tool.

**Goal: a more professional, denser, flatter layout.** Specifically: sharper corners, smaller
content, less wasted padding, gold used as an accent rather than a fill.

## 3. Hard constraints

These come from `docs/design/DESIGN.md`, the project's binding UI rulebook, and must not be
violated by the redesign:

- **Palette is locked** (hex values below) — typography, spacing, and radii are open to change.
- **Every interactive element has a ≥44px hit area** in its smaller dimension, even if the visual
  is smaller — pad a small-looking button's hit area invisibly if needed.
- **Nothing is conveyed by `:hover` alone** — this app runs on touchscreens with no hover.
- **A visible `:focus-visible` ring** on every interactive element (currently a 3px ring in
  `--color-focus`, offset 2px) — never removed without an equally visible replacement.
- **Breakpoints are 768px (mobile) and 1024px (tablet) only** — no new breakpoint without a
  documented reason.
- **No horizontal page scroll at 360px wide.**
- **Body text ≥4.5:1 contrast; large text (≥24px, or ≥18.66px bold) and UI-element boundaries
  ≥3:1.**
- **Gold (`--color-accent`) is a fill/border/dark-background color, never text on a light
  surface** — it fails 4.5:1 and even 3:1 against white or cream. Use `--color-accent-dark` (large
  text only) or `--color-accent-text` (everything else) instead.
- **Text/icons sitting on top of a solid gold fill use `--color-text-on-accent`**, never white —
  white-on-gold measures only ~2.3–2.8:1.
- **No new hex literals.** Reuse a token below; if something genuinely new is needed, propose it
  as a named token addition, not a one-off value.
- **Icons are Font Awesome, solid style only.**

### Palette (locked — reuse these, don't invent new ones)

| Token | Hex | Use |
|---|---|---|
| `--color-accent` | `#cca43b` | Brand gold — fills, borders, dark-surface text |
| `--color-accent-light` | `#d4c47a` | Light gold tint |
| `--color-accent-dark` | `#8b7a2a` | Gold as large text (≥24px / ≥18.66px bold) |
| `--color-accent-text` | `#5c4a11` | Gold as normal-size text/icon fill |
| `--color-text-on-accent` | alias of `--color-text` | Text/icon on a solid gold fill |
| `--color-surface` | `#ffffff` | Page/card background |
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
| `--color-focus` | alias of `--color-info` | Keyboard focus ring |

All of these are real CSS custom properties on `:root` in `frontend/src/css/globals.css` — propose
additions (e.g. a radius or spacing scale) in the same style, not as inline literals.

## 4. Design direction

Professional, restrained, information-dense — the feel of an internal operations console, not a
marketing landing page.

- **Sharper corners.** A small radius scale: **4px** for cards, panels, buttons, and inputs; **2px**
  for small badges/pills. No 12–16px rounding anywhere in this scope, and no full-pill buttons.
- **Flat surfaces.** White cards with a 1px `--color-border`, at most a subtle `0 1px 2px`
  shadow. No gradients, no hover-lift/translate effects, no text-shadow.
- **Gold as an accent, not a fill.** Thin bars, the active-nav indicator, focus rings, and primary
  actions. Never a large gold-filled surface like the current stat cards.
- **A smaller type scale.** Suggested: 12 / 13 / 14 / 16 / 20 / 24px, with **14px as the default
  body/UI text size** (down from the current ~16px base feel). The app uses one typeface, **Geist**
  (self-hosted, behind `globals.css`'s `--font-sans` token — ARCHITECTURE_REVIEW.md item 43
  dropped the earlier Inter/Playfair Display split, which read as "vintage"), for everything
  including the brand wordmark and page titles — no serif anywhere. Use tabular figures for
  numbers (so currency columns align), and weight (600–800) rather than a second family to
  distinguish a heading or wordmark from body text. Typography itself is still open to further
  change per DESIGN.md §1; this scale is a starting proposal, not a constraint.
- **A 4px-based spacing scale.** Suggested: 4 / 8 / 12 / 16 / 24 / 32px. The page gutter should
  land around 24–32px total, not the current doubled 80px (see §6).

## 5. Shared shell: the sidebar

Used by every role (Admin, Production Manager, Quality Checker, Worker, Inventory Staff) — this
restyles the frame of the whole app, not just the dashboard.

**Current state** (`globals/Navbar.jsx`, `frontend/src/css/globals.css:693-939`):
- Desktop: fixed 300px-wide dark sidebar, sticky.
- 55×55px logo, 50×50px avatar circle.
- Nav items: 14×20px padding, 1rem/600 weight text, 12px radius, 15px icon-to-label gap.
- Active tab: solid gold fill block with a glow shadow, dark text on top.
- Tablet (≤1024px): collapses to a 96px rail — icon stacked above a wrapped label.
- Mobile (≤768px): a 280px off-canvas drawer, plus a 56px fixed topbar holding the hamburger.
- Admin alone has 12 tabs plus Logout, so vertical density matters.

**Target direction:**
- Desktop width: roughly **232–240px** (down from 300px).
- Logo: roughly **32–36px**.
- A more compact profile row: avatar **32px** (down from 50px), role and name on two small lines.
- Nav items: **14px text, 16px icon, 4px radius**, keeping a real **≥44px** hit area even though
  the visual is smaller — pad vertically to hit that, don't just shrink the row.
- Active state: a **3px gold left bar** plus a subtle background tint (e.g. gold at low opacity),
  replacing the current solid gold block + glow. Gold as *text or icon color* on this dark
  background is fine (it's a dark surface, not light — §3's gold-as-text restriction doesn't
  apply here).
- Logout stays pinned to the bottom of the nav list.
- Design the tablet rail and the mobile drawer/topbar too, scaled consistently with the desktop
  sizing above — this is one shared component across three breakpoints, not three designs.

## 6. Screen: Admin dashboard

**Current state** (`frontend/src/admin/A_Dashboard.jsx`, styles in
`frontend/src/css/globals.css:951-1091` and `frontend/src/css/admin.css:1603-1797`):

- **Double gutter.** `.page-content` already has `padding: 40px`; `.admin-dashboard` adds another
  `padding: 40px` inside it — an **80px gutter** on desktop. This is a large part of why the page
  reads as oversized.
- **Stat cards** (`globals/InfoCard.jsx`): gold gradient fill, 16px radius, `min-height: 160px`,
  30×25px padding, a 10px solid-colour left border, centred content, value in Geist 3rem/800
  (Playfair Display before item 43 — same size/weight, font swapped) with a text-shadow, hover
  lift (`translateY(-5px)`). Grid: 3 columns, 32px gap, 64px bottom margin. There are only 3 stats
  today (see §6's "out of scope" note).
- **Divider:** a 6px gold gradient bar between the stat grid and the notifications panel.
- **Notifications panel** (`globals/NotificationList.jsx`): header in Geist 2.5rem (Playfair
  before item 43); rows padded 22×25px with 12px radius, a 48px icon box, 1.1rem title, 0.95rem
  message; unread rows get a cream background fill plus a 5px gold left border and their own
  hover lift; actions are 25px-radius pill buttons; the whole panel has a fixed `width: 1000px`
  centred with `margin: 40px auto`.

**Target layout:**
1. A compact page header: "Dashboard" title plus the current month/year, much smaller than the
   current 2.5rem notification header.
2. A row of 3 KPI cards.
3. A "Notifications" panel below, **full content width** (no fixed 1000px), separated from the
   KPI row by spacing and a section heading rather than the 6px gradient divider — **remove that
   divider**.

**KPI cards — target:**
- White background, 1px border, 4px radius, left-aligned content (not centred).
- Roughly **96–110px tall** (down from 160px).
- A small uppercase muted label (~12px).
- A value around **28–32px**, Geist 700, tabular figures (down from 3rem).
- An optional sub-line (e.g. "October 2026").
- The per-card accent becomes a **thin 3px bar** (top or left edge) in the card's semantic color
  (success/gold/info), replacing the current 10px border on a gold-filled card.
- Must render `₱1,234,567.89` (a realistic 7-figure profit) without clipping or overflow — the
  current fixed-size value text has clipped on real currency values before.

**Notifications panel — target:**
- Section title around **16–18px** (down from 40px).
- Rows padded roughly **12×16px**, a **32px** icon box (down from 48px), **14px** title, **13px**
  message.
- Unread state: a **3px gold left bar** plus the existing unread dot — no cream block fill.
- Rows separated by a hairline divider rather than each being its own floating card with a
  shadow.
- The delete control's visual can shrink, but keep its **44px hit area**.
- "Mark all as read" / "Clear all" become compact **4px-radius** buttons in the panel header, not
  25px pill buttons.
- Pagination stays below the list, unchanged in behavior.

**States to design**, not just the happy path:
- Unread row and read row
- Empty list
- Loading
- Keyboard focus state on a row and on the action buttons
- A long currency KPI value (`₱1,234,567.89`)
- 360px mobile layout — KPI cards stacked, notifications panel full-width, no page-level
  horizontal scroll

**Explicitly out of scope — do not add:** new widgets such as charts, a "recent projects" list,
or "today's attendance". The dashboard's backend endpoint (`GET /api/dashboard/stats`) currently
returns exactly three numbers — active projects, total workers, monthly profit — and nothing
else. New widgets would need new backend work first; list them as "future, needs backend" ideas
in your output if you think they'd help, but don't design them as if the data already exists.

## 7. Implementation mapping

So the output translates back into real code without guesswork:

| Design element | Component | CSS |
|---|---|---|
| KPI/stat cards | `frontend/src/globals/InfoCard.jsx` | `.info-card*` in `globals.css` — also used by the Production Manager and Quality Checker dashboards, so they inherit this redesign automatically |
| Notifications panel | `frontend/src/globals/NotificationList.jsx` | `.notif-*` in `admin.css` — also used by the standalone Notification tab on Admin/PM/QC |
| Sidebar | `frontend/src/globals/Navbar.jsx` | `.wooden-navbar`, `.nav-item`, `.mobile-topbar` in `globals.css` |
| Page layout/gutter | `frontend/src/admin/A_Dashboard.jsx` | `.page-content`, `.admin-dashboard`, `.admin-stats-grid`, `.admin-divider` in `globals.css` |

**Expected output includes:** any new design tokens (e.g. a `--radius-*` scale, a `--space-*`
scale, `--font-size-*` scale) to add to `:root` in `globals.css`, expressed as token
additions/values rather than inline hex or pixel literals scattered through component CSS.

## 8. Deliverables requested

- Mockups at **1366px** (desktop), **1024px** (tablet, sidebar collapsed to the rail), and
  **360px** (mobile, both drawer-closed and drawer-open).
- The states listed in §6.
- A spec table: radius, spacing, type size, shadow, and which color token is used per element
  (KPI card, notification row, nav item, buttons), so it's a direct implementation reference
  against §7's component map.

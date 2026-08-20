# DESIGN.md

UI guidance for this repository. This is **binding for new and changed UI work**, the same way
`CLAUDE.md` is binding for backend work — not a mood board, and not aspirational. Where it
disagrees with an existing screen, the existing screen is debt, not precedent.

## 1. Status

The current UI is a working first pass and is **explicitly provisional** — a visual redesign is
planned, and nothing in this document should be read as "the design is settled." What *is*
settled, effective now, regardless of the redesign:

- **The app must be mobile responsive.** Not "should work if you squint" — genuinely usable on a
  small touch screen, per the rules in §3.
- **The Worker role is the priority.** It's the role most likely to be used away from a desk, and
  the one this document's backlog (§7) is ordered around.
- **The palette is locked** (§4); **typography is open** to change in the redesign.

A screen that is merely ugly is not a defect this document cares about. A screen that fails §3 on
a phone is.

## 2. Target devices

Design floor: **a budget Android phone, 360×640, on the shop floor** — touch-only, frequently
one-handed, sometimes with glare on the screen or sawdust on the fingers. This is harder than the
generic "phones and tablets" target most responsive checklists assume, and it's specifically the
Worker role's real usage context. If a Worker screen works at 360px under those conditions, it
works everywhere else this app runs.

Desktop is real (Admin, Production Manager, and Quality Checker are plausibly desk-bound) but is
the **secondary** target for the Worker role specifically.

## 3. Binding rules

Numbered so a review comment can cite one directly.

1. **Mobile-first correctness.** Any new or touched screen must be fully usable at 360px wide
   with **no horizontal scroll on the page body**.
2. **Use the existing breakpoints.** 768px (mobile) and 1024px (tablet) are already the
   codebase's two breakpoints (`css/worker.css`, `css/globals.css`, `css/admin.css` all use
   exactly these). Don't introduce a third without a documented reason — a stray breakpoint is
   how responsive CSS quietly stops covering real devices.
3. **Interactive elements are ≥44px in their smaller dimension.** Buttons, dropdowns, list rows
   that act as tap targets, pagination controls — all of it. This is a real, currently-failing
   constraint on the Worker screen; see §7.
4. **Nothing is communicated by `:hover` alone.** There is no hover on a touchscreen. Any state
   conveyed only via `:hover` needs an equivalent `:active` or visible default state.
5. **Wide content scrolls in its own container**, via `overflow-x: auto` on that container —
   never `overflow-x: hidden` on an ancestor as a way to hide overflow instead of fixing it.
   Hiding it doesn't remove the content, it just makes part of the screen unreachable.
6. **Full-viewport layout heights use `dvh`, not `vh`.** On Android Chrome, the address bar
   resizes the viewport dynamically; `100vh` is taller than what's actually visible and produces
   a spurious scroll or a clipped bottom. Use `100dvh` (with a plain `vh` fallback only if a
   target browser genuinely lacks `dvh` support).
7. **Reuse a palette value; don't add a new hex.** Pull from §4. Once the token migration (§5)
   lands, reference the token instead of the literal.
8. **No fixed pixel widths on layout containers** (wrappers, page sections, sidebars). Use
   `max-width` with fluid sizing, or `%`/`flex`/`grid`, so the container can actually shrink on a
   360px screen instead of forcing horizontal scroll.

## 4. Palette (locked)

The values already in production use, canonicalized. This table is also what the token migration
(§5) reads from — the CSS variable names below are what `:root` should define, not something in
place yet.

| Role | Value | Proposed token | Notes |
|---|---|---|---|
| Accent (primary) | `#cca43b` | `--color-accent` | The brand gold. 83 uses — the canonical one. |
| Accent (variants in use) | `#D1AA3A`, `#b8a040`, `#d4c47a`, `#8b7a2a` | — | Drift, not intentional variety. Consolidate onto `--color-accent` (+ a computed hover/tint) during the token migration rather than keeping five golds. |
| Surface (dark) | `#1A1612` | `--color-surface-dark` | "Dark espresso" — sidebar, dark buttons. |
| Surface (light) | `#ffffff` | `--color-surface` | Page background. |
| Surface (cream) | `#fbf5e8`, `#fcfaf5` | `--color-surface-cream` | Soft accent panels (e.g. worker detail box). |
| Border / divider | `#eaeaea`, `#f0ede5` | `--color-border` | |
| Text (muted) | `#8b816a`, `#888888` | `--color-text-muted` | |
| Text on gold (dark) | `#5c4a11`, `#5a4a00`, `#4a3b00`, `#3a2e00` | `--color-accent-text` | Also drift — pick one during migration. |
| Semantic: danger | `#d32f2f` | `--color-danger` | Overdue dates, rework/reject states. |
| Semantic: success | `#2e6b3b` | `--color-success` | Approved states. |
| Semantic: info | `#2b4c7e` | `--color-info` | In-progress states. |

If the redesign changes the palette, this table (and the tokens it defines) is the one place that
needs updating for the change to propagate — that's the point of §5.

## 5. Design tokens

**Commitment:** migrate the hardcoded hex values above to CSS custom properties on `:root`,
starting with the accent and neutrals (highest occurrence count, most drifted). This is a
**separate pass** from the Worker responsiveness backlog in §7 — do not block worker fixes on it,
and do not let a worker-fix PR turn into a repo-wide find/replace.

Until the migration lands, rule 7 (§3) still applies: reuse an existing literal from §4 rather
than inventing a new one.

## 6. Priority: the Worker path

"Make Worker responsive" spans more than `worker/`, since the role shell reuses shared
components. The path, in the order a Worker actually moves through it:

```
Login.jsx
  → Worker.jsx (role shell)
    → globals/Navbar.jsx (off-canvas drawer + hamburger)
      → worker/WorkerJobOrder.jsx (task list, filters, Pagination)
        → worker/WorkerJobOrderDetail.jsx (task detail, progress table)
      → globals/NotificationList.jsx
      → globals/ToastProvider.jsx (toast surface)
      → globals/Logout.jsx (confirm modal)
```

`globals/Pagination.jsx` and the shared toast/logout surfaces count as in-scope for the Worker
priority even though they're not in `worker/` — a Worker hits all of them.

## 7. Backlog

### Worker path (priority — fix these first)

**Status: ✅ Resolved, items 1–6.** All six Worker-path findings below are fixed: `dvh` fallback
pairs on every full-viewport height (19 sites), the three `100vw`/`100vh` fixed overlays converted
to `inset: 0` (§3.5 — `100vw` includes scrollbar width and was itself an overflow source),
`min-height: 44px` on the six Worker tap targets, `.wjo-controls` reflowed from a five-row mobile
stack into a two-column grid, the floating hamburger moved into a real `.mobile-topbar` bar so
scrolled content can't run under it, and `:hover`-only affordances gated behind
`@media (hover: hover)` with `:active` states added. Two things fixed beyond this table's original
scope: `.wjo-back-btn` (`worker.css`) was also under 44px — a genuine §3.3 failure this backlog
didn't enumerate — and the three `inset: 0` overlay conversions above. Not yet done: a human
DevTools pass at 360×640 to visually confirm all six — jsdom computes no layout, so none of this
could be asserted by the automated test suite. See §7 cross-cutting item 7's gold count below,
which grew from 83 to **86** while this pass was in flight — the token migration is not yet
reducing the drift it's meant to stop.

| # | Finding | Where | Rule violated |
|---|---|---|---|
| 1 | ~~`min-height: 100vh` in the mobile layout — Android's dynamic URL bar makes this taller than the real viewport, producing a spurious scroll / clipped bottom. Repo-wide: 19 occurrences of `100vh`, zero of `100dvh`.~~ **Resolved**: every site now pairs a `100vh` fallback with `100dvh` on the next line. | `frontend/src/css/globals.css:565` (mobile `.page-content`); also `:510`, `:520` | §3.6 |
| 2 | ~~`.wb-pagination` (added in P1-3) has no mobile rules at all. `.wb-pagination-btn` is `padding: 8px 18px` at 13px ≈ 36px tall — under the 44px minimum — and the three-item row is tight at 360px. Rendered on the Worker task list.~~ **Resolved**: `.wb-pagination-btn` is `min-height: 44px` with `inline-flex` centring; a new `@media (max-width: 768px)` block moves the range readout to its own line and lets the two buttons share the row. | `frontend/src/css/globals.css:3854-3893` | §3.3 |
| 3 | ~~Worker control buttons under the tap-target minimum: `.wjo-btn-dark` (`padding: 10px 24px` @ ~0.9rem ≈ 38px tall), `.wjo-btn-dark.dropdown`, `.wjo-filter-btn`.~~ **Resolved**: all three, plus `.wjo-back-btn` (found during the fix, not in this table originally), are `min-height: 44px`. | `frontend/src/css/worker.css:52, 81, 113` | §3.3 |
| 4 | ~~Mobile control stack: at 768px, `.wjo-controls` goes `flex-direction: column` with all five filter controls full-width, pushing roughly 200–250px down before the first task is visible on a 640px-tall screen.~~ **Resolved**: `.wjo-controls` is now a two-column grid (`grid-template-columns: 1fr 1fr`) with the filter label spanning both columns — about 138px instead of ~220px before the first task row. | `frontend/src/css/worker.css:236-251` | §2 target device |
| 5 | ~~The floating hamburger (`position: fixed; top: 15px; left: 15px; z-index: 9998`) is only cleared by the 80px top-padding at scroll-top; once the page scrolls, it sits over whatever content is beneath it.~~ **Resolved**: the button now lives inside a new `<header className="mobile-topbar">` (`globals/Navbar.jsx`), `position: fixed; inset: 0 0 auto 0; height: 56px`, and `.page-content`'s mobile top padding dropped from 80px to 72px to match. | `frontend/src/css/globals.css:661-665` (button), `:557-565` (padding "fix") | §2 target device |
| 6 | ~~`.wjo-item:hover` is the only affordance that a task row is tappable, with no `:active` state — meaningless on touch, and a tap can leave the hover style stuck.~~ **Resolved**: the `:hover` rules (and the two colour-inversion `:hover` rules alongside them) are now gated behind `@media (hover: hover)`, and a `.wjo-item:active` pressed state was added that works on both pointer types; the same `:active` treatment was extended to the Worker control buttons. | `frontend/src/css/worker.css:156, 216-217` | §3.4 |

### Cross-cutting (after the worker path)

| # | Finding | Where |
|---|---|---|
| 7 | Zero CSS custom properties exist anywhere in `frontend/src/css/`. The accent gold alone is hardcoded 86 times (up from 83) and has already drifted into 5 variants — the concrete case for §5. | all of `frontend/src/css/` |
| 8 | `.app-container { overflow-x: hidden }` hides horizontal overflow instead of fixing its source — content wider than the viewport becomes unreachable rather than scrollable. | `frontend/src/css/globals.css:508-513` |
| 9 | Tablet view (1024px) collapses the sidebar to icon-only with all labels hidden. For Worker specifically — one tab — that's a 90px rail holding a single unlabeled icon. | `frontend/src/css/globals.css:677-696` |
| 10 | 8 screens (`admin/Profit.jsx`, `admin/WorkerList.jsx`, `admin/WorkerProductivity.jsx`, `globals/InventoryTable.jsx`, `globals/JobOrderDetails.jsx`, `globals/ProjectVerificationDetail.jsx`, `worker/WorkerJobOrderDetail.jsx`) use raw `<table>` with no mobile card conversion — `worker/WorkerJobOrderDetail.jsx`'s table is the one exception, already converted at 768px (`css/worker.css:625+`). | listed files |
| 11 | Font-size unit drift: 92 `px` declarations vs. 218 `rem` across `frontend/src/css/`. | repo-wide |

## 8. Deliberately deferred

Considered during scoping and intentionally left out of both this document's binding rules and
the current backlog — not overlooked:

- **A formal accessibility standard** (WCAG AA contrast audit, real `<label for>` associations —
  none exist today, visible keyboard-focus states). Worth doing, but a distinct effort from mobile
  responsiveness and not gated on it.
- **Self-hosted fonts.** `index.html` loads Google Fonts and Font Awesome from CDNs. On an
  unreliable shop-floor connection this is a real cost, but it's a build/asset change, not a
  layout one.
- **Installable / offline (PWA).** Significant scope on its own; not implied by "mobile
  responsive."
- **Replacing `window.alert`/`window.confirm`** with in-app UI (used in several screens,
  including the Worker path). A UX inconsistency, not a responsiveness defect.

If any of these become priorities, they belong in a revision of this document, not folded
silently into a responsiveness pass.

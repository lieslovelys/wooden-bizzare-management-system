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
9. **Never remove the keyboard focus outline without a replacement that passes 3:1 contrast.**
   `outline: none` with nothing put back is how a keyboard-only user loses track of where they are
   on the page entirely — see ARCHITECTURE_REVIEW.md item 30, which found 27 instances of exactly
   this. The shared `:focus-visible` rule in `css/globals.css` (`--color-focus`, overridden to
   `--color-accent` on the dark sidebar) is the default; a component's own `:focus`/`:focus-within`
   glow layers on top of it rather than replacing it.
10. **Body text needs ≥4.5:1 contrast; large text (≥24px, or ≥18.66px bold) and UI-element
    boundaries need ≥3:1.** See §4's "Gold is a fill, not body text" note — the accent gold fails
    4.5:1 against both white and cream outright (~2.4:1/2.2:1), which is why it's never a *text*
    color on a light surface, only a fill/border/dark-background color. The same rule applies in
    the other direction too: text or an icon *on top of* a gold fill uses `--color-text-on-accent`
    (ARCHITECTURE_REVIEW.md item 31), never `--color-text-inverse`/white — white-on-gold-fill
    measures only ~2.3–2.8:1 depending on the exact gold shade, nowhere near 4.5:1 or even the
    3:1 large-text floor.

## 4. Palette (locked)

**Landed** (§5, §7#7): every token below is a real CSS custom property on `:root` in
`frontend/src/css/globals.css`, defined first (before any component stylesheet) since `main.jsx`
imports it first. New UI work references the token, not the literal — §3 rule 7.

| Role | Canonical value | Token | Notes |
|---|---|---|---|
| Accent (primary) | `#cca43b` | `--color-accent` (+ `--color-accent-rgb`) | The brand gold. |
| Accent (light) | `#d4c47a` | `--color-accent-light` | Light tint. |
| Accent (dark) | `#8b7a2a` | `--color-accent-dark` | Hover/press shade — kept as its own token rather than folded into `--color-accent`, since it's a genuinely distinct shade, not drift. |
| Accent, text-on | aliases `--color-text` | `--color-text-on-accent` | ARCHITECTURE_REVIEW.md item 31 — what goes *on top of* a gold fill (buttons, badges, the active sidebar tab, selected list rows). An alias, not a new literal, so a redesign can retarget it in one place the way `--color-focus` already does. ~7.7:1 on `--color-accent`. |
| Surface (dark) | `#1a1612` | `--color-surface-dark` (+ `-rgb`) | "Dark espresso" — sidebar, dark buttons. Doubles as `--color-text` in a `color:` property — see the consolidation note below. |
| Surface (light) | `#ffffff` | `--color-surface` (+ `-rgb`) | Page background. Doubles as `--color-text-inverse` in a `color:` property. |
| Surface (cream) | `#fbf5e8` | `--color-surface-cream` | Soft accent panels (e.g. worker detail box). |
| Border / divider | `#eaeaea` | `--color-border` | |
| Text | `#1a1612` | `--color-text` | Same hex as surface-dark — see above. |
| Text (muted) | `#756d5a` | `--color-text-muted` | Darkened from the original `#8b816a` (ARCHITECTURE_REVIEW.md item 30/§3 rule 10) — that value measured ~3.9:1 on white and ~3.6:1 on cream, both under AA's 4.5:1 floor for normal-size text. This value measures ~5.1:1/~4.7:1. |
| Text (inverse) | `#ffffff` | `--color-text-inverse` | Same hex as surface — see above. |
| Semantic: danger | `#d32f2f` | `--color-danger` (+ `-rgb`) | Overdue dates, rework/reject states. |
| Semantic: danger, on dark | `#ef5350` | `--color-danger-on-dark` | ARCHITECTURE_REVIEW.md item 31 — `--color-danger` itself measures only 3.61:1 on `--color-surface-dark` (the sidebar); this lighter red is for danger text/icons on a dark surface specifically (currently just the sidebar's Logout button), ~5.2:1 there. `--color-danger` is unchanged for light surfaces. |
| Semantic: success | `#2e6b3b` | `--color-success` (+ `-rgb`) | Approved states. |
| Semantic: success (dark) | `#1e5631` | `--color-success-dark` | Hover shade. |
| Semantic: info | `#2b4c7e` | `--color-info` (+ `-rgb`) | In-progress states. |

**Consolidation map** — the drift each token's migration folded onto it (see item 7 in §7 for how
this was done and verified):
- `--color-accent`: `#D1AA3A`, `#d4af37`, `#d4b54e`, `#c8b060`, `#c8b840`, `#bfa15f`, `#b8a040`,
  `#b8a030`, `#b89132` (9 variants, one brand color).
- `--color-accent-light`: `#e8d98a`, `#e2ce8f`, `#d4c060`.
- `--color-accent-text`: `#5a4a00`, `#4a3b00`, `#3a2e00`, `#4b3b1a`, `#4b3600`, `#4a3c0e`,
  `#5b4614` (7 variants onto `#5c4a11`).
- `--color-surface-cream`: `#fcfaf5`, `#faf7f0`, `#fdf8ee`, `#faf4e6`.
- `--color-border`: `#f0ede5`, `#f4f4f4`.
- `--color-text`: `#1a1a1a`, `#333`.
- `--color-text-muted`: `#888888`, `#888`.
- `--color-danger`: `#c62828`, `#cc3300`, `#ff0000`, `#d9534f`. Folded from `.jsx` inline styles
  too (item 24, ARCHITECTURE_REVIEW.md): `#cc0000`, `#ff4d4d`, `#dc3545`.
- `--color-text-muted`: also folded from a `.jsx` inline style (item 24): `#8B7E5C`.
- `--color-accent-text`: also folded, item 30: `#c9a445` (`InventoryTable.jsx`'s `.min-text`, a
  gold literal that was never a token in the first place).

**The literal tail.** ~92 distinct one-off colors (badge/status accents, the warning oranges
`#f57c00`/`#e67e22`, rank bronze/silver, a handful of generic greys distinct from the muted-text
family, etc.), each used a handful of times or fewer, stay as literals — forcing every incidental
color onto an ill-fitting token isn't the goal; undoing the gold/brown/cream/border/text drift
above was. If the redesign changes the palette, `:root`'s definitions are the one place that
needs updating for the change to propagate.

**Gold is a fill, not body text (ARCHITECTURE_REVIEW.md item 30 / §3 rule 10).**
`--color-accent` measures ~2.4:1 on white and ~2.2:1 on cream — it fails AA's 4.5:1 floor by a wide
margin and doesn't even clear the 3:1 bar large text gets. It's still correct as a *fill* (button
backgrounds, badge backgrounds, progress bars), a *border*, or *text on the dark sidebar/dark
buttons* (`--color-surface-dark` is dark enough that gold reads fine there) — none of those are
the failure this item fixed. What changed is gold used as **text color on a light surface**:
- Text ≥24px, or ≥18.66px bold (WCAG's "large text" exemption, only needs 3:1) → `--color-accent-dark`.
- Everything else, including icon fills, which this pass treats at the stricter bar since an
  icon's fill color is this same token and the two are easy to conflate → `--color-accent-text`.

  Every site this item moved — page titles, active tabs, badges, links, buttons, icons — used one
  of these two tokens on exactly that basis; neither is a new color decision, both already existed
  for other purposes before this pass.

**The other side of the same rule (ARCHITECTURE_REVIEW.md item 31).** Gold-as-*fill* is still
correct, but text or an icon sitting *on top of* that fill needs `--color-text-on-accent`
(~7.7:1), not `--color-text-inverse`/white — white-on-gold-fill measures only ~2.3–2.8:1
depending on the exact shade (`--color-accent`, its `#b8962e` hover, or a handful of still-literal
near-accent golds such as `#CBA135`/`#BC963B`), nowhere near AA even at the 3:1 large-text floor.
This covers buttons, badges, the sidebar avatar circle and active nav tab, and selected list rows.
A gold fill with no text on it at all (dividers, progress bars, the scrollbar thumb, the unread
dot) is untouched by either rule.

**JSX inline styles — migrated (item 24, ARCHITECTURE_REVIEW.md).** The `.jsx`-file hex literals
the CSS-scoped token pass above didn't touch (54 at the time item 20 first recorded them, 53 once
one out-of-scope canvas `fillStyle` and one hex-inside-a-comment were excluded from the count) are
now on the same tokens, using the identical consolidation rule: a literal moves to a token only
when it's the token's exact value or a drift variant of the same role (`style={{ color:
'var(--color-accent)' }}` works in JSX exactly like it does in CSS, since `:root`'s custom
properties are visible everywhere; a raw SVG `stroke="#..."` attribute moved into `style={{
stroke: 'var(--color-...)' }}` instead, since `var()` support isn't guaranteed on a bare
presentation attribute). Four JSX-only drift values not previously in the map above got folded in
alongside this. A small literal tail stays, matching this section's own precedent for the CSS
pass: `#666`, `#000000`, `#5C4033`, `#5b5035`, `#999`, `#ddd` — each a single- or few-use neutral
grey or brown distinct from the muted-text family. `utils/resizeImage.js`'s canvas `fillStyle`
stays a literal too — a `<canvas>` context can't resolve a CSS custom property at all.

## 5. Design tokens

**Landed.** The hardcoded hex values are migrated to the CSS custom properties on `:root` listed
in §4, covering the accent and neutrals (highest occurrence count, most drifted) plus the
semantic colors. This landed as its own pass, after the Worker responsiveness backlog in §7's
worker-path items — not folded into a worker-fix PR as a repo-wide find/replace.

Rule 7 (§3) now means exactly what it always pointed at: reference the token from §4, and if a
genuinely new color is needed, add it as a token rather than a new literal.

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
didn't enumerate — and the three `inset: 0` overlay conversions above.

The cross-cutting pass below (items 7–11) closed the "not yet done" gap this status used to note:
a scratchpad-only Playwright sweep (cached Chromium, fixture-mocked API, never committed —
driving every screen for every role at 360/768/1024px) now programmatically confirms zero
horizontal page-body overflow and flags any interactive element under 44px, which jsdom's test
suite structurally cannot do. What that sweep still can't confirm, and what remains genuinely
unverified: how any of this actually feels on a real budget Android phone — touch responsiveness,
on-screen keyboard behavior, and legibility under real shop-floor glare.

| # | Finding | Where | Rule violated |
|---|---|---|---|
| 1 | ~~`min-height: 100vh` in the mobile layout — Android's dynamic URL bar makes this taller than the real viewport, producing a spurious scroll / clipped bottom. Repo-wide: 19 occurrences of `100vh`, zero of `100dvh`.~~ **Resolved**: every site now pairs a `100vh` fallback with `100dvh` on the next line. | `frontend/src/css/globals.css:565` (mobile `.page-content`); also `:510`, `:520` | §3.6 |
| 2 | ~~`.wb-pagination` (added in P1-3) has no mobile rules at all. `.wb-pagination-btn` is `padding: 8px 18px` at 13px ≈ 36px tall — under the 44px minimum — and the three-item row is tight at 360px. Rendered on the Worker task list.~~ **Resolved**: `.wb-pagination-btn` is `min-height: 44px` with `inline-flex` centring; a new `@media (max-width: 768px)` block moves the range readout to its own line and lets the two buttons share the row. | `frontend/src/css/globals.css:3854-3893` | §3.3 |
| 3 | ~~Worker control buttons under the tap-target minimum: `.wjo-btn-dark` (`padding: 10px 24px` @ ~0.9rem ≈ 38px tall), `.wjo-btn-dark.dropdown`, `.wjo-filter-btn`.~~ **Resolved**: all three, plus `.wjo-back-btn` (found during the fix, not in this table originally), are `min-height: 44px`. | `frontend/src/css/worker.css:52, 81, 113` | §3.3 |
| 4 | ~~Mobile control stack: at 768px, `.wjo-controls` goes `flex-direction: column` with all five filter controls full-width, pushing roughly 200–250px down before the first task is visible on a 640px-tall screen.~~ **Resolved**: `.wjo-controls` is now a two-column grid (`grid-template-columns: 1fr 1fr`) with the filter label spanning both columns — about 138px instead of ~220px before the first task row. | `frontend/src/css/worker.css:236-251` | §2 target device |
| 5 | ~~The floating hamburger (`position: fixed; top: 15px; left: 15px; z-index: 9998`) is only cleared by the 80px top-padding at scroll-top; once the page scrolls, it sits over whatever content is beneath it.~~ **Resolved**: the button now lives inside a new `<header className="mobile-topbar">` (`globals/Navbar.jsx`), `position: fixed; inset: 0 0 auto 0; height: 56px`, and `.page-content`'s mobile top padding dropped from 80px to 72px to match. | `frontend/src/css/globals.css:661-665` (button), `:557-565` (padding "fix") | §2 target device |
| 6 | ~~`.wjo-item:hover` is the only affordance that a task row is tappable, with no `:active` state — meaningless on touch, and a tap can leave the hover style stuck.~~ **Resolved**: the `:hover` rules (and the two colour-inversion `:hover` rules alongside them) are now gated behind `@media (hover: hover)`, and a `.wjo-item:active` pressed state was added that works on both pointer types; the same `:active` treatment was extended to the Worker control buttons. | `frontend/src/css/worker.css:156, 216-217` | §3.4 |

### Cross-cutting (after the worker path)

**Status: ✅ Resolved, items 7–11**, plus two related findings not originally enumerated here
(a stray third breakpoint, and several overflow sources the sweep found beyond the raw tables
item 10 named). Scoping this pass also corrected two things this table had gotten stale: item 10
actually covered 7 unconverted tables, not 8 — `worker/WorkerJobOrderDetail.jsx`'s was already
done — and FR-3 had added an 8th (`ProjectMaterials.jsx`) since this table was last written; and
item 9's "Worker — one tab" was stale since FR-4 added a Notifications tab.

| # | Finding | Where | Resolution |
|---|---|---|---|
| 7 | ~~Zero CSS custom properties exist anywhere in `frontend/src/css/`. The accent gold alone is hardcoded 86 times and has already drifted into 5+ variants.~~ | all of `frontend/src/css/` | **Resolved**: `:root` tokens (§4/§5), 820 literal→`var()` replacements across all 7 non-empty CSS files. A ~92-color literal tail of one-off badge/status colors deliberately stays literal — see §4. |
| 8 | ~~`.app-container { overflow-x: hidden }` hides horizontal overflow instead of fixing its source.~~ | `frontend/src/css/globals.css` | **Resolved**: the rule is removed outright. Getting there required fixing every real overflow source it was masking — three unguarded `width: 1000px` containers with no `max-width` pairing, several unwrapped control rows, and a systemic CSS Grid/flex `min-width: auto` trap across every div-based "table" row in the app — not just item 10's tables. A scratchpad Playwright sweep confirms 0/105 overflow checks across every role/screen/viewport with the rule gone. |
| 9 | ~~Tablet view (1024px) collapses the sidebar to icon-only with all labels hidden. For Worker specifically — one tab — that's a 90px rail holding a single unlabeled icon.~~ | `frontend/src/css/globals.css` | **Resolved**: every tab keeps its label now, stacked under the icon (96px rail, `min-height: 44px`, wraps to 2 lines for a longer label like "Project Verification"). Verified at 900px across Admin's full 13-tab set: zero overlap, every row ≥44px tall. |
| 10 | ~~7 screens use raw `<table>` with no mobile card conversion.~~ | `admin/Profit.jsx`, `admin/WorkerList.jsx`, `admin/WorkerProductivity.jsx`, `globals/InventoryTable.jsx`, `globals/JobOrderDetails.jsx`, `globals/ProjectMaterials.jsx`, `globals/ProjectVerificationDetail.jsx` | **Resolved**: a shared `.wb-card-table` utility (generalizing the pre-existing `worker/WorkerJobOrderDetail.jsx` conversion) applied to all 7, plus `InventoryTable`'s expandable variants panel getting its own mobile treatment. New `tests/expectCardLabels.js` pins the data-label wiring across 8 test files. |
| 11 | ~~Font-size unit drift: 92 `px` declarations vs. 218 `rem`.~~ | repo-wide | **Resolved**: all 92 converted (`N/16` rem, pixel-identical at the default root size). |
| — | *Not originally listed*: two `@media (max-width: 900px)` rules (login, account list) violated rule 2 (§3) — a stray third breakpoint. | `globals.css` (login), `admin.css` (account list) | **Resolved**: both widened to the existing 1024px breakpoint. |

~~**Known residual gap, not touched by this pass.** Several raw-table action buttons (inventory
edit/delete, the profit-table delete icon, the inventory reason/adjust controls) are still under
44px specifically in the 769–1024px tablet range: `.wb-card-table`'s conversion, like the
Worker-path original it generalizes, is deliberately mobile-only (`max-width: 768px`), matching
the codebase's existing breakpoint convention. Fixing this would mean resizing these controls at
every width, including desktop, which is a design decision, not a responsiveness bug fix — left
for a future pass rather than folded in silently here.~~ **Resolved** (ARCHITECTURE_REVIEW.md item
29): a separate `max-width: 1024px` rule now covers every `.wb-card-table` interactive control
through the tablet range, plus the handful of standalone controls (back buttons, filter/add
buttons, the profit spinner) that sat outside any table. Still deliberately scoped to
tablet-and-below, not every width — resizing these at desktop size too remains the design
decision this note always said it was, left untouched.

## 8. Deliberately deferred

Considered during scoping and intentionally left out of both this document's binding rules and
the current backlog — not overlooked:

- ~~**A formal accessibility standard** (WCAG AA contrast audit, real `<label for>` associations —
  none exist today, visible keyboard-focus states). Worth doing, but a distinct effort from mobile
  responsiveness and not gated on it.~~ **Resolved** (ARCHITECTURE_REVIEW.md item 30): every form
  control now has a real label (`htmlFor`/`id` or `aria-label`); every icon-only button has an
  accessible name; the 10 clickable list rows that were `<div onClick>` with no keyboard path are
  reachable and activatable via Tab/Enter/Space; a global `:focus-visible` outline (with a
  gold-on-dark override for the sidebar) replaces the 27 `outline: none` declarations that removed
  the browser's default with nothing put back; all 7 modals/drawers close on Escape, trap Tab, and
  return focus on close; the two concrete contrast failures found (`--color-text-muted`,
  `--color-accent` used as text on a light surface) are fixed, not just documented — see DESIGN.md
  §4's "Gold is a fill, not body text" note. `eslint-plugin-jsx-a11y`'s recommended config is a real
  CI gate now, the same role `no-alert` plays for native dialogs. Not independently verified: real
  screen-reader behavior (TalkBack/NVDA/VoiceOver) — see item 30 for exactly what was and wasn't
  checked, and for two new, smaller contrast findings (white-on-gold active tab, red-on-dark
  Logout label) the axe-core sweep surfaced and left for a separate pass, being pre-existing and
  outside this item's two scoped fixes. Also recorded there as a finding for the planned redesign,
  not something this pass touched: `html`/`body` sets no `font-family`, so several screens
  (Inventory, WorkerList, the notification/job-order/pv-\* blocks, `.details-main-wrapper`) render
  in Arial, Georgia, or the browser's default serif rather than the Inter/Playfair Display pair
  item 27/28 self-hosted.
- ~~**Self-hosted fonts.** `index.html` loads Google Fonts and Font Awesome from CDNs. On an
  unreliable shop-floor connection this is a real cost, but it's a build/asset change, not a
  layout one.~~ **Resolved** (ARCHITECTURE_REVIEW.md items 27-28): Inter, Playfair Display, and the
  Font Awesome solid font ship inside the Vite build via `@fontsource/*` and
  `@fortawesome/fontawesome-free`, imported from `main.jsx` — now at their real weights (item 28
  added Inter 700/800 and Playfair Display 800, which the CSS had been asking for all along and
  the browser was faking); `index.html` has no CDN `<link>` left and `globals.css` has no CDN
  `@import` left (item 27 landed the former but missed the latter — item 28 caught it), enforced
  by `tests/thirdPartyAssets.test.js`.
- **Installable / offline (PWA).** Significant scope on its own; not implied by "mobile
  responsive." Also genuinely blocked right now, not just deferred: a service worker (the piece
  that makes offline caching and a real install prompt possible) only registers over HTTPS or
  `localhost`, and the deployment is HTTP-only on a bare IP until a domain exists and
  `COOKIE_SECURE` can flip to `true` (see CLAUDE.md "Hosting target") — the same dependency, not a
  separate one. A manifest alone (no service worker) could still ship before that and give a
  home-screen shortcut on some browsers, but wasn't pursued separately from the full feature.
- ~~**Replacing `window.alert`/`window.confirm`** with in-app UI (used in several screens,
  including the Worker path). A UX inconsistency, not a responsiveness defect.~~ **Resolved**
  (ARCHITECTURE_REVIEW.md item 26): every remaining call site now uses the shared
  `globals/ConfirmModal.jsx` (with a new `danger` variant) and `useToast()`; `eslint.config.js`'s
  `no-alert` rule stops a native dialog from coming back.

If any of these become priorities, they belong in a revision of this document, not folded
silently into a responsiveness pass.

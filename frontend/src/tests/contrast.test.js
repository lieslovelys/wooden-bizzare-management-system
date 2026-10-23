import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// DESIGN.md §3 rule 10 / ARCHITECTURE_REVIEW.md items 30-31: the design tokens in
// css/globals.css's :root carry an implicit WCAG AA promise — e.g. "--color-text-muted passes
// 4.5:1 on --color-surface" — that nothing previously checked. Item 30 found and fixed exactly
// this kind of promise being silently broken (the darkened --color-text-muted passed on light
// surfaces but regressed to 3.5:1 on the one dark surface that also used it) only because a
// manual axe-core sweep happened to touch that screen. This test computes the real WCAG
// relative-luminance contrast ratio for every pair documented below, so a future token edit (or
// the planned redesign) fails CI instead of silently regressing a pair nothing else exercises.
// Same jsdom-URL caveat as thirdPartyAssets.test.js — resolve import.meta.url first, then
// path.join, rather than a relative `new URL(...)`.
const thisFile = fileURLToPath(import.meta.url);
const frontendRoot = path.join(path.dirname(thisFile), '..', '..');
const globalsCssPath = path.join(frontendRoot, 'src', 'css', 'globals.css');

function parseRootTokens(css) {
  const rootBlock = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? '';
  const tokens = {};
  for (const match of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  // Resolve var()-aliased tokens (e.g. --color-focus: var(--color-info);) — one pass is enough,
  // since nothing in this file chains more than one level deep today.
  for (const [name, value] of Object.entries(tokens)) {
    const aliasMatch = value.match(/^var\((--[\w-]+)\)$/);
    if (aliasMatch) tokens[name] = tokens[aliasMatch[1]];
  }
  return tokens;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatioRgb(rgbA, rgbB) {
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastRatio(hex1, hex2) {
  return contrastRatioRgb(hexToRgb(hex1), hexToRgb(hex2));
}

// ARCHITECTURE_REVIEW.md item 33 — the "-rgb" tokens (e.g. --color-danger-rgb) exist for the
// `rgba(var(--color-x-rgb), p)` soft-tint badges used throughout the app (status pills, priority
// tags). Alpha-compositing over a solid background isn't a straight two-token lookup, so these
// two helpers mix the tint over its real backdrop before measuring — the same math that found
// --color-danger's usual 10% tint only clears ~4.28:1 against the 4.5:1 bar (see TINT_PAIRS below).
function parseRgbTriple(str) {
  return str.split(',').map((n) => parseInt(n.trim(), 10));
}

function mixOverBackground(tintRgb, bgRgb, alpha) {
  return tintRgb.map((c, i) => Math.round(alpha * c + (1 - alpha) * bgRgb[i]));
}

const css = readFileSync(globalsCssPath, 'utf-8');
const tokens = parseRootTokens(css);

// Each pair is [foreground token, background token, minimum ratio, what it's for]. 4.5 is WCAG
// AA's normal-text bar; 3 is the large-text/UI-boundary bar (DESIGN.md §3 rule 10).
const PAIRS = [
  ['--color-text-on-accent', '--color-accent', 4.5, 'text/icons on a gold fill (item 31)'],
  ['--color-danger-on-dark', '--color-surface-dark', 4.5, 'the sidebar Logout label (item 31)'],
  ['--color-text-muted', '--color-surface', 4.5, 'muted text on white (item 30)'],
  ['--color-text-muted', '--color-surface-cream', 4.5, 'muted text on cream (item 30)'],
  ['--color-accent-text', '--color-surface', 4.5, 'gold-as-text on white (item 30)'],
  ['--color-accent-text', '--color-surface-cream', 4.5, 'gold-as-text on cream (item 30)'],
  ['--color-accent-dark', '--color-surface', 3, 'gold icon fills on white (item 30)'],
  ['--color-focus', '--color-surface', 3, 'the keyboard focus ring on white (item 30)'],
  ['--color-focus', '--color-surface-cream', 3, 'the keyboard focus ring on cream (item 30)'],
  ['--color-warning', '--color-surface', 4.5, 'the "medium"/"high" priority orange as plain text on white (item 33)'],
  ['--color-warning', '--color-surface-cream', 4.5, 'the same, on cream (item 33)'],
  ['--color-text-inverse', '--color-danger', 4.5, '.wjo-filter-btn.repair\'s white text (item 35)'],
  ['--color-text-inverse', '--color-warning', 4.5, '.wjo-filter-btn.for-qa\'s white text (item 35)'],
  ['--color-text-inverse', '--color-surface-dark', 4.5, 'idle sidebar nav item text (item 44)'],
  ['--color-accent-light', '--color-surface-dark', 3, '--color-focus-on-dark, the dark-sidebar keyboard focus ring (item 44)'],
  // ARCHITECTURE_REVIEW.md item 49 (REDESIGN-v2.md) — --color-surface-page is the new app-wide
  // page tint behind white cards (.role-layout/.page-content); every text/icon color already
  // checked against --color-surface/--color-surface-cream above needs to clear it too, since
  // some UI (e.g. a panel's own header) can sit directly on the page tint rather than on a card.
  ['--color-text-muted', '--color-surface-page', 4.5, 'muted text directly on the page tint (item 49)'],
  ['--color-text', '--color-surface-page', 4.5, 'body text directly on the page tint (item 49)'],
  ['--color-danger', '--color-surface-page', 4.5, 'danger text directly on the page tint (item 49)'],
  ['--color-accent-text', '--color-surface-page', 4.5, 'gold-as-text directly on the page tint (item 49)'],
  ['--color-focus', '--color-surface-page', 3, 'the keyboard focus ring on the page tint (item 49)'],
  ['--color-border-strong', '--color-surface', 3, 'the kit\'s input/secondary-button border on white (item 49)'],
];

describe('design token contrast (DESIGN.md §3 rule 10)', () => {
  it.each(PAIRS)('%s on %s clears %s:1 — %s', (fg, bg, minRatio) => {
    expect(tokens[fg], `token ${fg} not found in :root`).toBeDefined();
    expect(tokens[bg], `token ${bg} not found in :root`).toBeDefined();

    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });
});

// ARCHITECTURE_REVIEW.md item 33 — each pair is [foreground token, its "-rgb" companion, the
// tint's opacity, the real background it sits on, minimum ratio, what it's for]. --color-danger's
// own luminance is just high enough that the 10% tint formula --color-success/--color-info use
// comfortably (they're darker) measured only ~4.26-4.28:1 for danger, under the 4.5:1 bar — hence
// the lower 6% for danger specifically. A future opacity or token-value edit that breaks this
// again fails here instead of waiting for another manual axe sweep to notice.
//
// ARCHITECTURE_REVIEW.md item 49 (REDESIGN-v2.md) — the v2 ComponentKit mock proposed moving
// every one of these onto a shared --color-*-tint token and raising "assigned" to 14% (matching
// --color-accent-tint, the active-sidebar-nav tint) and danger to 8%. Assigned's 14% is adopted
// here (7.70:1, still comfortably over 4.5); danger's proposed 8% measured only ~4.42:1 — below
// the bar — so danger stays at the existing 6% (--color-danger-tint, 4.55:1). See
// ARCHITECTURE_REVIEW.md item 49 deviation 1 for the full writeup.
const TINT_PAIRS = [
  ['--color-danger', '--color-danger-rgb', 0.06, '--color-surface', 4.5, 'danger-tint badges, e.g. .ph-badge-late/.status-pill.low (item 33)'],
  ['--color-success', '--color-success-rgb', 0.12, '--color-surface', 4.5, 'success-tint badges, e.g. .att-status-badge.present/.status-pill.good'],
  ['--color-info', '--color-info-rgb', 0.1, '--color-surface', 4.5, 'info-tint badges, e.g. .ph-badge-ontime/.status-badge.in-progress (item 33)'],
  ['--color-warning', '--color-warning-rgb', 0.1, '--color-surface', 4.5, 'warning-tint badges, e.g. .jol-priority.medium (item 33)'],
  ['--color-accent-text', '--color-accent-rgb', 0.14, '--color-surface', 4.5, '.wb-status--assigned, 10% → 14% (item 49)'],
  ['--color-accent-light', '--color-accent-rgb', 0.14, '--color-surface-dark', 4.5, 'active sidebar nav item text on --color-accent-tint (item 44)'],
];

describe('design token tint-badge contrast (ARCHITECTURE_REVIEW.md item 33)', () => {
  it.each(TINT_PAIRS)('%s at %s opacity on %s clears %s:1 — %s', (fg, rgbToken, opacity, bg, minRatio) => {
    expect(tokens[fg], `token ${fg} not found in :root`).toBeDefined();
    expect(tokens[rgbToken], `token ${rgbToken} not found in :root`).toBeDefined();
    expect(tokens[bg], `token ${bg} not found in :root`).toBeDefined();

    const effectiveBg = mixOverBackground(parseRgbTriple(tokens[rgbToken]), hexToRgb(tokens[bg]), opacity);
    const ratio = contrastRatioRgb(hexToRgb(tokens[fg]), effectiveBg);
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });
});

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

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
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
];

describe('design token contrast (DESIGN.md §3 rule 10)', () => {
  it.each(PAIRS)('%s on %s clears %s:1 — %s', (fg, bg, minRatio) => {
    expect(tokens[fg], `token ${fg} not found in :root`).toBeDefined();
    expect(tokens[bg], `token ${bg} not found in :root`).toBeDefined();

    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });
});

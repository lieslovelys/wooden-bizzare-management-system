import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ARCHITECTURE_REVIEW.md item 36: before this, html/body set no font-family at all, so every
// screen fell back to whatever a stray per-component declaration said — Arial, Georgia, a bare
// 'serif', even a typo'd 'Arial', 'san-serif' (globals.css's .attendance-log-title h3) — or
// the browser default where nothing was set. Item 36 normalized every one of those onto Inter
// (the app-wide default, delete the stray declaration so it inherits), Playfair Display (section
// headings/titles), or inherit (form controls, which don't inherit font-family by default). This
// is the regression guard, the same role thirdPartyAssets.test.js plays for CDN references —
// reuses its listCssFiles walk so a new stray declaration fails CI instead of silently drifting
// back in.
//
// ARCHITECTURE_REVIEW.md item 39: account.css — the only file with a "Font Awesome 6 Free"
// font-family declaration — turned out to be dead (never imported anywhere) and was deleted
// along with it, so that allowlist entry went too; the icon font itself (main.jsx's
// @fortawesome/fontawesome-free import) is unaffected.
//
// ARCHITECTURE_REVIEW.md item 40: TempSignup.css (the file this comment used to cite for the
// typo'd 'san-serif' example above) is also gone, deleted along with TempSignup.jsx — replaced
// by admin/AccountForm.jsx, which has no CSS file of its own (its rules live in admin.css).
//
// ARCHITECTURE_REVIEW.md item 43: Inter and Playfair Display (read as "vintage") are gone,
// replaced by a single Geist family behind one token, globals.css's --font-sans — so every CSS
// declaration is now that var() or inherit, nothing else. This also closes a gap item 36 left
// open: three admin/*.jsx files had an inline `style={{ fontFamily: 'Arial, sans-serif' }}` that
// this CSS-only scan never saw. The scan below now also walks non-test .jsx/.js for an inline
// `fontFamily:` so that gap can't reopen silently.
//
// ARCHITECTURE_REVIEW.md item 45: Playfair Display comes back, but deliberately narrow — only
// the "The Wooden Bizarre" brand wordmark, behind a second token, --font-brand, not a general
// heading font (item 43's "one family, Geist, everywhere" still holds for everything else). The
// EXPECTED_BRAND_SELECTORS check below pins exactly which selectors may use it, so a future
// "let's make every heading Playfair again" change has to edit this test on purpose rather than
// drift into it unnoticed.
//
// ARCHITECTURE_REVIEW.md item 46: the Login page's hero tagline joins the same exception (the
// user asked for it back too, after seeing it next to the now-restored wordmark) — one more
// entry in EXPECTED_BRAND_SELECTORS, not a new token. Its sibling, .hero-subtext, is deliberately
// left alone: it never had its own font-family in the first place, so there's no "original" to
// revert there.
const thisFile = fileURLToPath(import.meta.url);
const frontendRoot = path.join(path.dirname(thisFile), '..', '..');
const srcDir = path.join(frontendRoot, 'src');
const cssDir = path.join(srcDir, 'css');

function listFiles(dir, exts) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath, exts);
    return exts.some((ext) => entry.name.endsWith(ext)) ? [entryPath] : [];
  });
}

// Matches a real font-family declaration (`font-family:` at the start of a CSS statement),
// not an occurrence of the words "font" and "family" inside a comment.
const FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;]+);/g;

const ALLOWED_VALUES = new Set(['var(--font-sans)', 'var(--font-brand)', 'inherit']);

// Items 45-46 — the only selectors allowed to use --font-brand: the three that render the
// literal brand name "The Wooden Bizarre" (Login.jsx and Navbar.jsx), plus the Login page's hero
// tagline, a deliberate one-off branding exception alongside them.
const EXPECTED_BRAND_SELECTORS = new Set([
  '.login-layout .brand-title h2',
  '.title-group h3',
  '.mobile-topbar-title',
  '.login-layout .hero-text h1',
]);

// Matches a whole CSS rule (selector + declaration block) so a --font-brand declaration can be
// traced back to its selector. Simple brace-balance isn't needed here since none of this app's
// rules nest braces (no @media around these three, no nested selectors) — the existing
// FONT_FAMILY_DECLARATION regex makes the same non-nesting assumption.
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;

describe('font-family consistency (ARCHITECTURE_REVIEW.md items 36, 43, 45, 46)', () => {
  it('every font-family declaration in src/css is one of the app\'s font tokens, or inherit', () => {
    const offenders = listFiles(cssDir, ['.css']).flatMap((filePath) => {
      const css = readFileSync(filePath, 'utf-8');
      const relPath = path.relative(frontendRoot, filePath);
      return [...css.matchAll(FONT_FAMILY_DECLARATION)]
        .map((match) => match[1].trim())
        .filter((value) => !ALLOWED_VALUES.has(value))
        .map((value) => `${relPath}: font-family: ${value}`);
    });

    expect(offenders, `an unexpected font-family value was found: ${offenders.join(', ')}`).toEqual([]);
  });

  it('only the expected brand/hero selectors use --font-brand', () => {
    const foundSelectors = new Set();
    for (const filePath of listFiles(cssDir, ['.css'])) {
      // Strip comments first — CSS_RULE's selector group otherwise swallows a comment
      // immediately above the selector too, since both sit between the previous `}` and the
      // next `{`.
      const css = readFileSync(filePath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of css.matchAll(CSS_RULE)) {
        const [, selector, body] = match;
        if (/font-family\s*:\s*var\(--font-brand\)/.test(body)) {
          foundSelectors.add(selector.trim());
        }
      }
    }

    const missing = [...EXPECTED_BRAND_SELECTORS].filter((s) => !foundSelectors.has(s));
    const unexpected = [...foundSelectors].filter((s) => !EXPECTED_BRAND_SELECTORS.has(s));
    expect(missing, `expected selector(s) missing --font-brand: ${missing.join(', ')}`).toEqual([]);
    expect(unexpected, `unexpected selector(s) using --font-brand: ${unexpected.join(', ')}`).toEqual([]);
  });

  // Item 43 — a CSS-only scan missed three admin/*.jsx files that set the font with an inline
  // `style={{ fontFamily: '...' }}` instead of a stylesheet rule (stylesheetImports.test.js's
  // listFiles/exclusion-filter convention, reused here). No inline fontFamily is allowed at all:
  // every element should inherit --font-sans from html/body rather than override it per-component.
  it('no component sets font-family inline — everything inherits --font-sans', () => {
    const jsFiles = listFiles(srcDir, ['.jsx', '.js']).filter(
      (f) => !f.endsWith('.test.js') && !f.endsWith('.test.jsx') && !f.includes(`${path.sep}tests${path.sep}`)
    );

    const offenders = jsFiles.flatMap((filePath) => {
      const code = readFileSync(filePath, 'utf-8');
      const relPath = path.relative(frontendRoot, filePath);
      return code.includes('fontFamily') ? [relPath] : [];
    });

    expect(offenders, `inline fontFamily found in: ${offenders.join(', ')}`).toEqual([]);
  });
});

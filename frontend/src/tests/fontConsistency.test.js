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

const ALLOWED_VALUES = new Set(['var(--font-sans)', 'inherit']);

describe('font-family consistency (ARCHITECTURE_REVIEW.md items 36, 43)', () => {
  it('every font-family declaration in src/css is the app\'s one font token, or inherit', () => {
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

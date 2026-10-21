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
const thisFile = fileURLToPath(import.meta.url);
const frontendRoot = path.join(path.dirname(thisFile), '..', '..');
const cssDir = path.join(frontendRoot, 'src', 'css');

function listCssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(entryPath);
    return entry.name.endsWith('.css') ? [entryPath] : [];
  });
}

// Matches a real font-family declaration (`font-family:` at the start of a CSS statement),
// not an occurrence of the words "font" and "family" inside a comment.
const FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;]+);/g;

const ALLOWED_VALUES = new Set([
  "'Inter', sans-serif",
  "'Playfair Display', serif",
  'inherit',
  "'Inter', Arial, sans-serif",
]);

describe('font-family consistency (ARCHITECTURE_REVIEW.md item 36)', () => {
  it('every font-family declaration in src/css is one of the app\'s two typefaces, or inherit', () => {
    const offenders = listCssFiles(cssDir).flatMap((filePath) => {
      const css = readFileSync(filePath, 'utf-8');
      const relPath = path.relative(frontendRoot, filePath);
      return [...css.matchAll(FONT_FAMILY_DECLARATION)]
        .map((match) => match[1].trim())
        .filter((value) => !ALLOWED_VALUES.has(value))
        .map((value) => `${relPath}: font-family: ${value}`);
    });

    expect(offenders, `an unexpected font-family value was found: ${offenders.join(', ')}`).toEqual([]);
  });
});

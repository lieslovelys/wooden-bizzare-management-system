import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// DESIGN.md §8 / ARCHITECTURE_REVIEW.md items 27-28: fonts and icons used to load from Google
// Fonts and cdnjs via <link> tags in index.html, and globals.css also carried its own leftover
// @import of the same Google Fonts URL that item 27 missed (its check only grepped the built
// index.html, not the built CSS). Everything now loads from npm packages imported in main.jsx, so
// the app makes zero third-party requests before it renders. This is the regression guard — the
// counterpart to eslint's `no-alert` rule from item 26 — so a CDN reference can't creep back into
// index.html or any stylesheet unnoticed.
// jsdom (this suite's test environment) replaces the global URL constructor with one that
// resolves relative URLs against `window.location` rather than a file base, so
// `new URL('../../index.html', import.meta.url)` silently resolves to an http(s) URL instead of
// a file path. Resolving import.meta.url on its own first (always a real file:// URL) sidesteps
// that, then plain path.join walks to the repo file(s).
const thisFile = fileURLToPath(import.meta.url);
const frontendRoot = path.join(path.dirname(thisFile), '..', '..');
const indexHtmlPath = path.join(frontendRoot, 'index.html');
const cssDir = path.join(frontendRoot, 'src', 'css');

const REMOTE_URL = /(?:url\(\s*["']?|@import\s+["']?)(?:https?:)?\/\/[^)"']+/gi;

function listCssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(entryPath);
    return entry.name.endsWith('.css') ? [entryPath] : [];
  });
}

describe('third-party asset references', () => {
  it('index.html loads no stylesheet or script from a third-party origin', () => {
    const html = readFileSync(indexHtmlPath, 'utf-8');
    const tags = html.match(/<(?:link|script)\b[^>]*>/g) ?? [];
    const remoteTags = tags.filter((tag) => /\shref=["'](?:https?:)?\/\//.test(tag) || /\ssrc=["'](?:https?:)?\/\//.test(tag));

    expect(remoteTags, `index.html references a third-party URL: ${remoteTags.join(', ')}`).toEqual([]);
  });

  it('no stylesheet under src/css imports or references a third-party origin', () => {
    const offenders = listCssFiles(cssDir).flatMap((filePath) => {
      const css = readFileSync(filePath, 'utf-8');
      const matches = css.match(REMOTE_URL) ?? [];
      return matches.map((match) => `${path.relative(frontendRoot, filePath)}: ${match}`);
    });

    expect(offenders, `a stylesheet references a third-party URL: ${offenders.join(', ')}`).toEqual([]);
  });
});

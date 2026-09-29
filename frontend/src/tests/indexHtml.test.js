import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// DESIGN.md §8 / ARCHITECTURE_REVIEW.md item 27: fonts and icons used to load from Google Fonts
// and cdnjs via <link> tags here. They're now bundled through npm packages imported in main.jsx
// instead, so the app makes zero third-party requests before it renders. This is the regression
// guard — the counterpart to eslint's `no-alert` rule from item 26 — so a CDN <link> can't creep
// back into index.html unnoticed.
// jsdom (this suite's test environment) replaces the global URL constructor with one that
// resolves relative URLs against `window.location` rather than a file base, so
// `new URL('../../index.html', import.meta.url)` silently resolves to an http(s) URL instead of
// a file path. Resolving import.meta.url on its own first (always a real file:// URL) sidesteps
// that, then plain path.join walks up to the repo file.
const thisFile = fileURLToPath(import.meta.url);
const indexHtmlPath = path.join(path.dirname(thisFile), '..', '..', 'index.html');

describe('index.html', () => {
  it('loads no stylesheet or script from a third-party origin', () => {
    const html = readFileSync(indexHtmlPath, 'utf-8');
    const tags = html.match(/<(?:link|script)\b[^>]*>/g) ?? [];
    const remoteTags = tags.filter((tag) => /\shref=["'](?:https?:)?\/\//.test(tag) || /\ssrc=["'](?:https?:)?\/\//.test(tag));

    expect(remoteTags, `index.html references a third-party URL: ${remoteTags.join(', ')}`).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ARCHITECTURE_REVIEW.md item 39: account.css and dashboard.css sat in src/css for a long time
// with no <any>.jsx/.js ever importing them — a whole-file version of the "possibly dead CSS"
// item 34 flagged at the class level. A class-name scan can't catch that (nothing inside the
// file is the bug; the import itself is missing), so this is a separate, narrower guard: every
// file under src/css must be imported by at least one non-test .js/.jsx under src. It deliberately
// doesn't check the reverse (a .jsx importing a nonexistent file already fails the build) or
// look inside a stylesheet for which classes are actually used — that's item 34/39's manual class
// audit, not something worth automating (too many runtime-built class names to do blind).
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

// Matches `import '...css'` / `import "...css"`, the only form this codebase uses for a
// stylesheet (no `import styles from './x.css'` CSS-modules usage anywhere).
const CSS_IMPORT = /import\s+['"]([^'"]+\.css)['"]/g;

describe('every stylesheet under src/css is actually imported (ARCHITECTURE_REVIEW.md item 39)', () => {
  it('has no orphaned .css file', () => {
    const cssFiles = new Set(listFiles(cssDir, ['.css']));

    const jsFiles = listFiles(srcDir, ['.jsx', '.js']).filter(
      (f) => !f.endsWith('.test.js') && !f.endsWith('.test.jsx') && !f.includes(`${path.sep}tests${path.sep}`)
    );

    for (const filePath of jsFiles) {
      const code = readFileSync(filePath, 'utf-8');
      for (const match of code.matchAll(CSS_IMPORT)) {
        const resolved = path.resolve(path.dirname(filePath), match[1]);
        cssFiles.delete(resolved);
      }
    }

    const orphaned = [...cssFiles].map((f) => path.relative(frontendRoot, f));
    expect(orphaned, `stylesheet(s) with no importer anywhere in src: ${orphaned.join(', ')}`).toEqual([]);
  });
});

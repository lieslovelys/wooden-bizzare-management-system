import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

// utils/photoStorage.js reads UPLOAD_DIR from process.env once, at module-evaluation time — so
// each test gets a fresh module instance (vi.resetModules + a fresh dynamic import) pointed at
// its own disposable temp directory, rather than sharing whatever the first import resolved.
let tmpDir;
let photoStorage;
beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wbms-photos-'));
  process.env.UPLOAD_DIR = tmpDir;
  vi.resetModules();
  photoStorage = await import('../utils/photoStorage.js');
});
afterEach(async () => {
  delete process.env.UPLOAD_DIR;
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

// Minimal fabricated buffers: decodePhotoDataUrl only inspects the leading magic-byte signature,
// never decodes the image itself, so these don't need to be real, renderable images.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

function dataUrl(mime, buf) {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

describe('photoStorage.decodePhotoDataUrl', () => {
  it('accepts a valid jpeg, png, and webp', () => {
    expect(photoStorage.decodePhotoDataUrl(dataUrl('image/jpeg', JPEG_BYTES)).ext).toBe('jpg');
    expect(photoStorage.decodePhotoDataUrl(dataUrl('image/png', PNG_BYTES)).ext).toBe('png');
    expect(photoStorage.decodePhotoDataUrl(dataUrl('image/webp', WEBP_BYTES)).ext).toBe('webp');
  });

  it('rejects a non-data-URL string', () => {
    expect(() => photoStorage.decodePhotoDataUrl('not-a-data-url')).toThrow(/data:image/);
    expect(() => photoStorage.decodePhotoDataUrl('https://example.com/photo.jpg')).toThrow();
  });

  it('rejects non-string input', () => {
    expect(() => photoStorage.decodePhotoDataUrl(undefined)).toThrow();
    expect(() => photoStorage.decodePhotoDataUrl(null)).toThrow();
    expect(() => photoStorage.decodePhotoDataUrl(42)).toThrow();
  });

  it('rejects a declared type whose bytes do not match its real magic number', () => {
    // Declares png, but the bytes are really a jpeg.
    expect(() => photoStorage.decodePhotoDataUrl(dataUrl('image/png', JPEG_BYTES))).toThrow(/does not match/);
  });

  it('rejects a photo over the byte cap', () => {
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(1024)]);
    expect(() => photoStorage.decodePhotoDataUrl(dataUrl('image/jpeg', big), { maxBytes: 100 })).toThrow(/limit/);
  });

  it("accepts an oversized photo when maxBytes is raised (the backfill script's use)", () => {
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(1024)]);
    expect(() => photoStorage.decodePhotoDataUrl(dataUrl('image/jpeg', big), { maxBytes: Infinity })).not.toThrow();
  });

  it('rejects an empty payload', () => {
    // The regex itself requires at least one base64 character, so an empty payload fails the
    // "well-formed data URL" check before reaching the emptiness check — either way, it throws.
    expect(() => photoStorage.decodePhotoDataUrl('data:image/jpeg;base64,')).toThrow();
  });
});

describe('photoStorage save / remove / resolve', () => {
  it('saves a photo and can read it back at the resolved path', async () => {
    const filename = await photoStorage.savePhoto(JPEG_BYTES, 'jpg');
    expect(filename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    const full = photoStorage.resolvePhotoPath(filename);
    expect(fs.readFileSync(full)).toEqual(JPEG_BYTES);
  });

  it('removePhoto deletes the file', async () => {
    const filename = await photoStorage.savePhoto(PNG_BYTES, 'png');
    await photoStorage.removePhoto(filename);
    expect(fs.existsSync(photoStorage.resolvePhotoPath(filename))).toBe(false);
  });

  it('removePhoto on a missing file does not throw', async () => {
    await expect(photoStorage.removePhoto('does-not-exist.jpg')).resolves.toBeUndefined();
  });

  it('removePhoto on a falsy name is a no-op', async () => {
    await expect(photoStorage.removePhoto(null)).resolves.toBeUndefined();
    await expect(photoStorage.removePhoto(undefined)).resolves.toBeUndefined();
  });

  it('resolvePhotoPath rejects a traversal attempt', () => {
    // path.basename() already strips any '/'-separated directory component, so this exercises
    // that resolvePhotoPath ends up pointed at a harmless literal filename inside UPLOAD_DIR
    // rather than actually escaping it — not that it throws (there's nothing left to escape
    // with once basename has stripped the traversal segments).
    expect(photoStorage.resolvePhotoPath('../../etc/passwd')).toBe(
      path.join(photoStorage.UPLOAD_DIR, 'passwd')
    );
  });

  it('photoExistsSync is true only for a real, on-disk file', async () => {
    const filename = await photoStorage.savePhoto(WEBP_BYTES, 'webp');
    expect(photoStorage.photoExistsSync(filename)).toBe(true);
    expect(photoStorage.photoExistsSync('nope.jpg')).toBe(false);
    expect(photoStorage.photoExistsSync(null)).toBe(false);
  });
});

describe('photoStorage.ensureUploadDir', () => {
  it('creates the directory if missing and leaves no write-check file behind', async () => {
    await fsp.rm(photoStorage.UPLOAD_DIR, { recursive: true, force: true });
    await photoStorage.ensureUploadDir();
    expect(fs.existsSync(photoStorage.UPLOAD_DIR)).toBe(true);
    const entries = await fsp.readdir(photoStorage.UPLOAD_DIR);
    expect(entries).toEqual([]);
  });
});

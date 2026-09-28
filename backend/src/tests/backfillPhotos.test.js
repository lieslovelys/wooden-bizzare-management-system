import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

// scripts/backfillPhotos.js: migrates legacy base64 worker_details.photo values onto disk. `query`
// is mocked (no real database); photoStorage is the REAL module, pointed at a disposable temp
// dir, so this also proves the decode→save→UPDATE sequence actually produces a readable file, not
// just that the right mock calls happened.

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const dataUrl = (buf) => `data:image/jpeg;base64,${buf.toString('base64')}`;

let tmpDir;
const queryMock = vi.fn();

vi.mock('../config/db.js', () => ({
  query: (...args) => queryMock(...args),
  pool: { query: vi.fn(), connect: vi.fn() },
  getClient: vi.fn(),
}));

let backfillPhotos;
beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wbms-backfill-'));
  process.env.UPLOAD_DIR = tmpDir;
  vi.resetModules();
  queryMock.mockReset();
  ({ backfillPhotos } = await import('../scripts/backfillPhotos.js'));
});
afterEach(async () => {
  delete process.env.UPLOAD_DIR;
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('backfillPhotos', () => {
  it('migrates a legacy base64 row to a real file and clears both photo and re-fetches nothing else', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ detail_id: 1, photo: dataUrl(JPEG_BYTES) }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await backfillPhotos();

    expect(result).toEqual({ total: 1, migrated: 1, skipped: 0 });
    // The UPDATE call: [photoPath, detailId]
    const updateCall = queryMock.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE worker_details SET photo_path/);
    const [photoPath, detailId] = updateCall[1];
    expect(detailId).toBe(1);
    expect(photoPath).toMatch(/\.jpg$/);
    // The actual file was written and is readable.
    expect(fs.readFileSync(path.join(tmpDir, photoPath))).toEqual(JPEG_BYTES);
  });

  it('does not use the normal 512KB upload cap — legacy oversized photos still migrate', async () => {
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(600 * 1024)]);
    queryMock
      .mockResolvedValueOnce({ rows: [{ detail_id: 2, photo: dataUrl(big) }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await backfillPhotos();
    expect(result).toEqual({ total: 1, migrated: 1, skipped: 0 });
  });

  it('is a no-op when nothing needs migrating (the SELECT itself already filters photo_path IS NULL)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await backfillPhotos();
    expect(result).toEqual({ total: 0, migrated: 0, skipped: 0 });
    expect(queryMock).toHaveBeenCalledTimes(1); // SELECT only — no UPDATE fired
  });

  it('leaves an undecodable row untouched and counts it as skipped', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ detail_id: 3, photo: 'not-a-real-data-url' }] });

    const result = await backfillPhotos();

    expect(result).toEqual({ total: 1, migrated: 0, skipped: 1 });
    expect(queryMock).toHaveBeenCalledTimes(1); // no UPDATE for the bad row
  });

  it('processes multiple rows independently — one bad row does not block the rest', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { detail_id: 1, photo: dataUrl(JPEG_BYTES) },
          { detail_id: 2, photo: 'garbage' },
          { detail_id: 3, photo: dataUrl(JPEG_BYTES) },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE for detail_id 1
      .mockResolvedValueOnce({ rows: [] }); // UPDATE for detail_id 3

    const result = await backfillPhotos();
    expect(result).toEqual({ total: 3, migrated: 2, skipped: 1 });
  });
});

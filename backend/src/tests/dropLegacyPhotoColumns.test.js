import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

// migrations/1792604443343_drop-legacy-photo-columns.js's moveLegacyWorkerPhotos: moves any
// remaining legacy base64 worker_details.photo values onto disk before the column is dropped.
// This was tests/backfillPhotos.test.js's coverage, moved here when scripts/backfillPhotos.js was
// deleted — see that migration's header comment for why. `db` (pgm.db's real shape: `.select`
// returns rows directly, `.query` returns a QueryResult) is mocked; photoStorage is the REAL
// module, pointed at a disposable temp dir, so this also proves the decode -> save -> UPDATE
// sequence actually produces a readable file, not just that the right mock calls happened.

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const dataUrl = (buf) => `data:image/jpeg;base64,${buf.toString('base64')}`;

let tmpDir;
let moveLegacyWorkerPhotos;

function buildDb() {
    return {
        select: vi.fn(),
        query: vi.fn().mockResolvedValue({ rows: [] }),
    };
}

// photoStorage.js resolves UPLOAD_DIR from process.env at MODULE LOAD time, not per-call — so
// the env var has to be set before the module (and the migration file that imports it) is
// imported. vi.resetModules() + a dynamic import per test, same as the old backfillPhotos.test.js
// did, is what makes each test's own temp dir actually take effect.
beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wbms-drop-photo-'));
    process.env.UPLOAD_DIR = tmpDir;
    vi.resetModules();
    ({ moveLegacyWorkerPhotos } = await import('../migrations/1792604443343_drop-legacy-photo-columns.js'));
});
afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('moveLegacyWorkerPhotos', () => {
    it('migrates a legacy base64 row to a real file and writes its photo_path', async () => {
        const db = buildDb();
        db.select.mockResolvedValueOnce([{ detail_id: 1, photo: dataUrl(JPEG_BYTES) }]);

        const result = await moveLegacyWorkerPhotos(db);

        expect(result).toEqual({ total: 1, migrated: 1 });
        expect(db.query).toHaveBeenCalledTimes(1);
        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toMatch(/UPDATE worker_details SET photo_path/);
        const [photoPath, detailId] = params;
        expect(detailId).toBe(1);
        expect(photoPath).toMatch(/\.jpg$/);
        expect(fs.readFileSync(path.join(tmpDir, photoPath))).toEqual(JPEG_BYTES);
    });

    it('does not use the normal 512KB upload cap — legacy oversized photos still migrate', async () => {
        const db = buildDb();
        const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(600 * 1024)]);
        db.select.mockResolvedValueOnce([{ detail_id: 2, photo: dataUrl(big) }]);

        const result = await moveLegacyWorkerPhotos(db);
        expect(result).toEqual({ total: 1, migrated: 1 });
    });

    it('is a no-op when nothing needs migrating (the SELECT itself already filters photo_path IS NULL)', async () => {
        const db = buildDb();
        db.select.mockResolvedValueOnce([]);

        const result = await moveLegacyWorkerPhotos(db);
        expect(result).toEqual({ total: 0, migrated: 0 });
        expect(db.query).not.toHaveBeenCalled();
    });

    it('throws on an undecodable row, before writing or updating anything, whatever its position', async () => {
        const db = buildDb();
        db.select.mockResolvedValueOnce([
            { detail_id: 1, photo: dataUrl(JPEG_BYTES) },
            { detail_id: 2, photo: 'not-a-real-data-url' },
        ]);

        await expect(moveLegacyWorkerPhotos(db)).rejects.toThrow(/detail_id=2/);

        // Every row is decoded (a pure check) up front, before anything is written — so row 1
        // never gets a file written or a photo_path UPDATE issued at all once row 2 fails to
        // decode. This matters because db.query() runs outside the column-drop's own transaction
        // (see this function's own header comment) — nothing written here would be rolled back.
        expect(db.query).not.toHaveBeenCalled();
        expect(fs.readdirSync(tmpDir)).toEqual([]);
    });

    it('undoes every write this run already made if a later row fails during the write phase itself', async () => {
        const db = buildDb();
        db.select.mockResolvedValueOnce([
            { detail_id: 1, photo: dataUrl(JPEG_BYTES) },
            { detail_id: 2, photo: dataUrl(JPEG_BYTES) },
        ]);
        // Both rows decode fine; row 2's own UPDATE fails instead (e.g. a dropped connection) —
        // a rarer failure mode than a bad legacy value, but one that happens after row 1's
        // write — and row 2's own file write — have already committed outside any transaction.
        let queryCalls = 0;
        db.query.mockImplementation(async () => {
            queryCalls++;
            if (queryCalls === 2) throw new Error('connection lost');
            return { rows: [] };
        });

        await expect(moveLegacyWorkerPhotos(db)).rejects.toThrow(/connection lost/);

        // Both files this run wrote — row 1's (whose UPDATE had already succeeded) and row 2's
        // (written to disk before its own UPDATE failed) — are removed again, and both rows'
        // photo_path are explicitly reset to NULL. The migration leaves no trace of this run.
        const row1PhotoPath = db.query.mock.calls[0][1][0];
        const row2PhotoPath = db.query.mock.calls[1][1][0];
        expect(fs.existsSync(path.join(tmpDir, row1PhotoPath))).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, row2PhotoPath))).toBe(false);
        expect(db.query).toHaveBeenCalledTimes(4);
        const undoCalls = db.query.mock.calls.slice(2);
        expect(undoCalls.every(([sql]) => /UPDATE worker_details SET photo_path = NULL/.test(sql))).toBe(true);
        expect(undoCalls.map(([, params]) => params[0]).sort()).toEqual([1, 2]);
    });
});

// Drops the legacy base64 photo columns (PRD.md C.2 "Storage discipline" — see
// migrations/1790580121489_worker-photo-files.js and ARCHITECTURE_REVIEW.md item 21's
// "Deferred" note). That item left worker_details.photo in place because dropping it safely
// needed every real environment to have already run scripts/backfillPhotos.js first, and nobody
// could say which environments existed yet. This migration removes that dependency: it moves any
// remaining legacy photo onto disk itself, inside this same run, so it's safe against a database
// in any state — never backfilled, partially backfilled, or fully backfilled.
//
// attendance.photo is dropped alongside it: no route or service has ever read or written that
// column (see ARCHITECTURE_REVIEW.md item 21's "Deferred" note), so there's nothing to migrate,
// only a preflight check that nobody wrote to it by hand outside the app.
//
// Replaces scripts/backfillPhotos.js and docker-entrypoint.sh's standalone backfill step, both
// deleted in this same commit — see tests/dropLegacyPhotoColumns.test.js for what was
// backfillPhotos.test.js's coverage, moved here.
export const shorthands = undefined;

import photoStorage from '../utils/photoStorage.js';

// Exported so tests can drive it against a mocked `db` (an object with `.select`/`.query`,
// matching pgm.db's real shape) without a live Postgres connection or the rest of a migration
// run.
//
// IMPORTANT, found by actually running this migration against a real database rather than only
// its mocked tests: `pgm.db.query()` runs IMMEDIATELY against the migration's connection, before
// node-pg-migrate opens the transaction that wraps this file's queued pgm.sql()/dropColumn()
// calls (see node-pg-migrate's MigrationBuilder._apply — it awaits `up(pgm)` to completion FIRST,
// and only then collects and transaction-wraps what was queued during that call). So a
// `photo_path` UPDATE issued here is NOT rolled back if a later row in this same loop, or the
// column drop that follows it, fails — confirmed by seeding a good row and a bad row locally and
// watching the good row's photo_path survive a failed migration run. That rules out the simpler
// "write as you go, undo written files if a later row throws" design: an already-committed
// photo_path update would be left pointing at a file this function then deletes.
//
// The fix: decode every row up front — a pure, side-effect-free check — before writing or
// updating anything at all. A bad legacy value (the overwhelmingly likely failure mode) now
// throws before this function has touched disk or the database, so there is nothing to undo.
// Only if a rarer failure happens during the write phase itself (disk full, a dropped connection)
// does this function undo what it already committed — every file and `photo_path` UPDATE this
// run made before the failure.
export async function moveLegacyWorkerPhotos(db) {
    const rows = await db.select(
        'SELECT detail_id, photo FROM worker_details WHERE photo IS NOT NULL AND photo_path IS NULL'
    );

    // Deliberately NOT capped at photoStorage.MAX_PHOTO_BYTES — same reasoning as the old
    // backfillPhotos.js this replaces: these are legacy values the app already accepted under the
    // old 10mb limit, and the point of this move is to relocate them as-is, not to discard
    // anyone's existing photo for being over a cap introduced after the fact.
    const decoded = rows.map((row) => {
        try {
            return { row, ...photoStorage.decodePhotoDataUrl(row.photo, { maxBytes: Infinity }) };
        } catch (e) {
            throw new Error(
                `Cannot drop worker_details.photo: row detail_id=${row.detail_id} does not decode as a real ` +
                `image. Investigate and fix that row by hand, then re-run the migration. (${e.message})`
            );
        }
    });

    const written = [];
    try {
        for (const { row, buffer, ext } of decoded) {
            const photoPath = await photoStorage.savePhoto(buffer, ext);
            written.push({ photoPath, detailId: row.detail_id });
            await db.query('UPDATE worker_details SET photo_path = $1 WHERE detail_id = $2', [photoPath, row.detail_id]);
        }
    } catch (e) {
        for (const { photoPath, detailId } of written) {
            await photoStorage.removePhoto(photoPath);
            await db.query('UPDATE worker_details SET photo_path = NULL WHERE detail_id = $1', [detailId]);
        }
        throw e;
    }

    return { total: rows.length, migrated: rows.length };
}

export const up = async (pgm) => {
    await moveLegacyWorkerPhotos(pgm.db);

    // Nothing in this codebase has ever read or written attendance.photo, so this should never
    // fire — it's here so a value written by hand, outside the app, is caught loudly rather than
    // silently dropped by the column drop below.
    pgm.sql(`
        DO $$
        DECLARE
            cnt integer;
        BEGIN
            SELECT COUNT(*) INTO cnt FROM attendance WHERE photo IS NOT NULL;
            IF cnt > 0 THEN
                RAISE EXCEPTION 'Cannot drop attendance.photo — % row(s) have a non-null value and nothing in this codebase ever wrote one; investigate before dropping.', cnt;
            END IF;
        END $$;
    `);

    pgm.dropColumn('worker_details', 'photo');
    pgm.dropColumn('attendance', 'photo');
};

export const down = (pgm) => {
    pgm.addColumn('worker_details', { photo: { type: 'text' } });
    pgm.addColumn('attendance', { photo: { type: 'varchar' } });
};

// One-time (but idempotent) migration of legacy base64 photos out of worker_details.photo and
// onto disk, into worker_details.photo_path — see PRD.md C.2 "Storage discipline" and
// migrations/1790580121489_worker-photo-files.js.
//
// Run automatically on every container boot (docker-entrypoint.sh, after `npm run migrate`), so
// a fresh deploy of this code onto an existing database backfills itself with no manual step —
// consistent with this repo's existing auto-migrate-on-boot choice. Safe to re-run: only rows
// with `photo IS NOT NULL AND photo_path IS NULL` are touched, and a row is left exactly alone
// (not even nulled out) if its `photo` value doesn't decode as a real image, so a bad legacy row
// can be investigated by hand later rather than silently losing its photo.
//
// Usage (from backend/src): `npm run photos:backfill`
//
// Uses config/logger.js's structured logger, unlike migrate.js/createAdmin.js — those are
// interactive tools a human types and reads directly (and migrate.js also wraps node-pg-migrate's
// own plain-text verbose output, so partially structuring just its two lines would be
// inconsistent); this one runs unattended on every container boot (docker-entrypoint.sh), so its
// output lands in `docker compose logs` for someone to read later, not a live terminal.

import 'dotenv/config';
import { query } from '../config/db.js';
import photoStorage from '../utils/photoStorage.js';
import { logger } from '../config/logger.js';

// Exported so tests can drive it against a mocked `query`/`photoStorage` without spawning a
// process — see tests/backfillPhotos.test.js.
export async function backfillPhotos() {
  const { rows } = await query(
    `SELECT detail_id, photo FROM worker_details WHERE photo IS NOT NULL AND photo_path IS NULL`
  );

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      // Deliberately NOT capped at photoStorage.MAX_PHOTO_BYTES: these are legacy values the
      // app already accepted under the old 10mb limit, and the point of this pass is to move
      // them as-is, not to silently discard anyone's existing photo because it's larger than
      // the new cap applies to NEW uploads.
      const { buffer, ext } = photoStorage.decodePhotoDataUrl(row.photo, { maxBytes: Infinity });
      const photoPath = await photoStorage.savePhoto(buffer, ext);
      await query(
        'UPDATE worker_details SET photo_path = $1, photo = NULL WHERE detail_id = $2',
        [photoPath, row.detail_id]
      );
      migrated++;
    } catch (e) {
      logger.error({ err: e, detailId: row.detail_id }, '[backfillPhotos] could not migrate row');
      skipped++;
    }
  }

  return { total: rows.length, migrated, skipped };
}

async function main() {
  const { total, migrated, skipped } = await backfillPhotos();
  logger.info({ total, migrated, skipped }, '[backfillPhotos] done');
  process.exit(0);
}

// Only run as a script when invoked directly (`node scripts/backfillPhotos.js`), not when
// imported by the test suite.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logger.error({ err }, '[backfillPhotos] failed');
    process.exit(1);
  });
}

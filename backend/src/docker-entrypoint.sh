#!/bin/sh
# Runs on every container start. Auto-migrate-on-boot is a deliberate choice for this specific
# deployment (a single VPS, single operator) — the P1a migrations already have preflight guards
# for unsafe changes (see migrations/*_add-uniqueness-constraints.js) and run inside
# transactions, so the risk this adds is low, and it removes a manual step an operator could
# otherwise forget before restarting on new code.
set -e

echo "[entrypoint] running database migrations..."
npm run migrate

# PRD.md C.2 "Storage discipline": moves any pre-existing worker_details.photo base64 value onto
# the uploads volume, so an existing deployment backfills itself automatically on the next
# deploy rather than needing a manual step — idempotent (see scripts/backfillPhotos.js), so this
# is a no-op after the first run.
echo "[entrypoint] backfilling legacy worker photos..."
npm run photos:backfill

echo "[entrypoint] starting: $*"
exec "$@"

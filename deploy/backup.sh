#!/bin/sh
# Dumps the compose stack's Postgres database to deploy/backups/, gzipped, and prunes to the
# most recent 14 (roughly two weeks of nightly backups). Run from anywhere — it cd's to the
# repo root itself.
#
# Intended to be driven by host cron (see deploy/README.md), since a VPS snapshot is not a
# substitute for this: it doesn't run while the app is live in a consistent state, and it
# competes with the app for the same 50 GB disk instead of shipping off-box.
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
    echo "backup.sh: .env not found at repo root — copy .env.example to .env first." >&2
    exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Found by item 42's first real deploy (nothing to run this against yet, on a brand-new VPS):
# `docker compose exec` failing here used to go unnoticed — it's the non-last command in a pipe
# to `gzip`, so `set -e` never saw its exit code, and `gzip` happily wrote a small, valid-looking,
# but EMPTY gzip file, with no error at all. Guard explicitly instead of relying on that pipe.
# No container for `db` at all (`-a`, any state) means this stack has never been deployed yet —
# that's deploy.sh's own first-ever run, not a failure, so skip cleanly. A container that EXISTS
# but isn't currently running is a real problem (the app is down) and should fail loudly instead.
if [ -z "$(docker compose ps -a -q db 2>/dev/null)" ]; then
    echo "backup.sh: no 'db' container exists yet (nothing has been deployed here before) — nothing to back up. Skipping."
    exit 0
fi
if [ -z "$(docker compose ps -q db 2>/dev/null)" ]; then
    echo "backup.sh: 'db' container exists but isn't running — investigate before trusting any backup from this host." >&2
    exit 1
fi

mkdir -p deploy/backups
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="deploy/backups/${SQL_DB}_${STAMP}.sql.gz"

docker compose exec -T db pg_dump -U "$SQL_USER" -d "$SQL_DB" | gzip > "$OUT"
echo "backup.sh: wrote $OUT"

# Retention: keep the 14 most recent dumps for this database, delete the rest.
# shellcheck disable=SC2012
ls -1t "deploy/backups/${SQL_DB}"_*.sql.gz 2>/dev/null | tail -n +15 | while IFS= read -r old; do
    rm -f -- "$old"
    echo "backup.sh: pruned $old"
done

# PRD.md C.2 "Storage discipline": worker photos live on the `uploads` named volume, not in
# Postgres — a real backup needs both artifacts, not just the database dump above. Run AFTER the
# pg_dump so every worker_details.photo_path the dump references already has a matching file in
# this tarball, not a not-yet-existing one from a photo uploaded mid-backup.
UPLOADS_OUT="deploy/backups/uploads_${STAMP}.tar.gz"
docker compose exec -T backend tar -czf - -C /data/uploads . > "$UPLOADS_OUT"
echo "backup.sh: wrote $UPLOADS_OUT"

# shellcheck disable=SC2012
ls -1t deploy/backups/uploads_*.tar.gz 2>/dev/null | tail -n +15 | while IFS= read -r old; do
    rm -f -- "$old"
    echo "backup.sh: pruned $old"
done

echo "backup.sh: done. Remember these only live on this VPS until synced off-box (rclone/rsync — not automated by this script)."

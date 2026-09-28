#!/bin/sh
# Restores a dump produced by backup.sh into the compose stack's Postgres database, and
# optionally a matching worker-photos tarball onto the `uploads` volume.
#
# Usage: deploy/restore.sh deploy/backups/<db>_<timestamp>.sql.gz [deploy/backups/uploads_<timestamp>.tar.gz]
#
# DESTRUCTIVE: this restores into the live database the `db` service is already running.
# Take a fresh backup first if there's anything in the current database worth keeping. The
# uploads half is additive (extracted on top of whatever's already in the volume, nothing is
# deleted first) — an orphaned extra file is harmless, unlike a mismatched database row.
set -eu

cd "$(dirname "$0")/.."

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <path-to-dump.sql.gz> [path-to-uploads.tar.gz]" >&2
    exit 1
fi
FILE="$1"
UPLOADS_FILE="${2:-}"
if [ ! -f "$FILE" ]; then
    echo "restore.sh: $FILE not found." >&2
    exit 1
fi
if [ -n "$UPLOADS_FILE" ] && [ ! -f "$UPLOADS_FILE" ]; then
    echo "restore.sh: $UPLOADS_FILE not found." >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "restore.sh: .env not found at repo root — copy .env.example to .env first." >&2
    exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

printf 'This will restore "%s" into the live "%s" database. Continue? [y/N] ' "$FILE" "$SQL_DB"
read -r CONFIRM
case "$CONFIRM" in
    y|Y|yes|YES) ;;
    *) echo "restore.sh: aborted."; exit 1 ;;
esac

gunzip -c "$FILE" | docker compose exec -T db psql -U "$SQL_USER" -d "$SQL_DB"
echo "restore.sh: database restored."

if [ -n "$UPLOADS_FILE" ]; then
    docker compose exec -T backend tar -xzf - -C /data/uploads < "$UPLOADS_FILE"
    echo "restore.sh: uploads restored from $UPLOADS_FILE."
fi

echo "restore.sh: done."

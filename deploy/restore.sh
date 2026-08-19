#!/bin/sh
# Restores a dump produced by backup.sh into the compose stack's Postgres database.
#
# Usage: deploy/restore.sh deploy/backups/<db>_<timestamp>.sql.gz
#
# DESTRUCTIVE: this restores into the live database the `db` service is already running.
# Take a fresh backup first if there's anything in the current database worth keeping.
set -eu

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
    echo "Usage: $0 <path-to-dump.sql.gz>" >&2
    exit 1
fi
FILE="$1"
if [ ! -f "$FILE" ]; then
    echo "restore.sh: $FILE not found." >&2
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
echo "restore.sh: done."

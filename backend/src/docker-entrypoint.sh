#!/bin/sh
# Runs on every container start. Auto-migrate-on-boot is a deliberate choice for this specific
# deployment (a single VPS, single operator) — the P1a migrations already have preflight guards
# for unsafe changes (see migrations/*_add-uniqueness-constraints.js) and run inside
# transactions, so the risk this adds is low, and it removes a manual step an operator could
# otherwise forget before restarting on new code.
set -e

echo "[entrypoint] running database migrations..."
npm run migrate

echo "[entrypoint] starting: $*"
exec "$@"

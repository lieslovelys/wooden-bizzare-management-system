# Deployment notes

## Stack

`docker-compose.yml` (repo root) runs three services: `db` (Postgres), `backend` (Express,
migrates itself on boot — see `backend/src/docker-entrypoint.sh`), and `proxy` (Nginx, serves
the built frontend and reverse-proxies `/api` to `backend`). See
`docs/reference_md/ARCHITECTURE_REVIEW.md` P1-10 and `CLAUDE.md` for the sizing rationale
(single Hostinger KVM 1 VPS — 1 vCPU, 4 GB RAM, 50 GB NVMe).

First-time setup on the VPS:

```sh
cp .env.example .env
# fill in real values in .env
docker compose up -d --build
```

## Backups

`backup.sh` dumps the live database (via `docker compose exec db pg_dump`), gzips it into
`deploy/backups/` (gitignored), and keeps the most recent 14. Wire it into host cron, e.g.
nightly at 2am:

```
0 2 * * * /path/to/repo/deploy/backup.sh >> /var/log/wbms-backup.log 2>&1
```

**This alone is not a real backup strategy** — `deploy/backups/` lives on the same disk as
everything else on this VPS. Sync it off-box regularly (`rclone`/`rsync` to another host or
object storage; not automated by this script — set up whichever the VPS account already has
credentials for).

`restore.sh <path-to-dump.sql.gz>` reverses it, with an interactive confirmation prompt since
it's destructive to whatever's currently in the live database.

## TLS

Not set up yet — this deployment is HTTP-only until a domain is pointed at the VPS (Let's
Encrypt/Certbot can't issue a certificate for a bare IP). Once a domain exists, that's a small
follow-up: a `certbot` service in `docker-compose.yml` plus a `listen 443 ssl` block and
redirect in `frontend/nginx.conf`, not a restructure of this stack. Remember to also flip
`COOKIE_SECURE=true` in `.env` at the same time — see the comment on that variable in
`.env.example` for why leaving it `false` after TLS lands would be its own bug.

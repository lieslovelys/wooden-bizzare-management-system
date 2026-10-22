# Deployment notes

## Stack

`docker-compose.yml` (repo root) runs four services: `db` (Postgres), `backend` (Express,
migrates itself on boot — see `backend/src/docker-entrypoint.sh`), `proxy` (Caddy — serves the
built frontend, reverse-proxies `/api` to `backend`, and handles TLS automatically), and
`portainer` (a container-management GUI). See `docs/reference_md/ARCHITECTURE_REVIEW.md`
P1-10/item 42 and `CLAUDE.md` for the sizing rationale (single Hostinger KVM 1 VPS — 1 vCPU,
4 GB RAM, 50 GB NVMe).

**Deploys are automatic.** A push to `main` that passes CI builds both images, smoke-tests the
whole compose stack, pushes them to GHCR, then SSHes into the VPS and runs `deploy/deploy.sh`,
which pulls the new images and recreates the stack (`.github/workflows/ci.yml`'s `images`/
`deploy` jobs). The VPS itself never runs `npm install` or a Docker build — one vCPU can't spare
that mid-deploy while the app is serving live traffic. This file is the one-time setup to turn
that on; after it's done, you don't SSH in for routine deploys at all.

---

## One-time VPS setup

Steps are labeled **[hPanel]** (Hostinger's web control panel), **[server]** (an SSH/terminal
session on the VPS) or **[GitHub]** (repo settings / `gh` CLI).

### 1. DNS — [hPanel]

In hPanel → Domains → DNS, point the app's domain at the VPS's IP:

| Type | Name | Value |
|---|---|---|
| A | `@` | the VPS's public IP |
| A | `www` | the VPS's public IP |
| A | `portainer` | the VPS's public IP |

Remove any conflicting parking-page A/AAAA record. DNS can take a few minutes to an hour to
propagate — `dig +short yourdomain.com` from your own machine should return the VPS IP before you
move on, or Caddy's certificate request in step 6 will fail.

### 2. Firewall — [hPanel]

hPanel → VPS → Firewall: allow inbound **22/tcp** (SSH), **80/tcp** and **443/tcp** (HTTP/HTTPS),
and **443/udp** (HTTP/3 — Caddy uses it when available; harmless to allow even if unused).

### 3. Docker — [server]

```sh
curl -fsSL https://get.docker.com | sh
```

Create (or reuse) an unprivileged deploy user in the `docker` group, so routine deploys never run
as root:

```sh
useradd -m -s /bin/bash deploy        # skip if it already exists
usermod -aG docker deploy
```

### 4. Clone the repo — [server, as `deploy`]

The repo is private, so cloning needs a credential. A **read-only deploy key** (scoped to this
one repo, not a personal access token) is the right shape for a server that only ever needs to
`git fetch`:

```sh
sudo -iu deploy
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_key -N ""
cat ~/.ssh/github_deploy_key.pub   # add this in GitHub: repo → Settings → Deploy keys → Add
                                   # deploy key (read-only is enough — leave "Allow write" off)
```

Then, still as `deploy`:

```sh
cat >> ~/.ssh/config <<'EOF'
Host github.com
    IdentityFile ~/.ssh/github_deploy_key
EOF
git clone git@github.com:StrydomPH/Wooden_Bizarre-Management-System.git /opt/wbms
```

(`/opt/wbms` needs to be writable by `deploy` — `sudo mkdir -p /opt/wbms && sudo chown deploy:deploy /opt/wbms` first if `/opt` isn't.)

### 5. `.env` — [server, as `deploy`]

```sh
cd /opt/wbms
cp .env.example .env
```

Fill in `.env`:
- `SQL_USER` / `SQL_PASS` / `SQL_DB` — pick values; `SQL_PASS` generated with
  `openssl rand -base64 32`, never typed by hand or committed anywhere.
- `SECRET_KEY` — `openssl rand -base64 48`.
- `ALLOWED_ORIGINS=https://yourdomain.com`
- `COOKIE_SECURE=true`
- `SITE_ADDRESS=yourdomain.com` and `DOMAIN=yourdomain.com`
- `PORTAINER_ADDRESS=portainer.yourdomain.com`
- Leave `IMAGE_TAG` blank — `deploy/deploy.sh` sets it per deploy.

Never commit this file or paste its contents anywhere (chat, logs, a doc).

### 6. First deploy — [server, as `deploy`]

The very first run needs a one-time manual registry login (afterwards, CI does this itself with
its own short-lived token):

```sh
docker login ghcr.io -u <your-github-username>   # paste a classic PAT with read:packages when prompted
sh deploy/deploy.sh <commit-sha-you-want-live>    # usually: git rev-parse origin/main
```

This pulls both images, brings up all four containers, and waits for the backend's healthcheck
(which depends on its own migrate-on-boot succeeding) before returning. Watch for Caddy's
automatic certificate request to succeed — `docker compose logs proxy` should show it obtaining a
certificate for your domain within the first minute or two, assuming DNS from step 1 has
propagated.

### 7. Portainer first login — [you, in a browser, within 5 minutes of the container starting]

Open `https://portainer.yourdomain.com` and create the admin account. Portainer locks its setup
wizard after 5 minutes for security — if you miss the window, restart the container
(`docker compose restart portainer`) and try again immediately.

### 8. Wire up GitHub Actions — [GitHub]

A **separate** deploy keypair, just for CI (don't reuse the one from step 4 — that one's
read-only for `git`, this one needs SSH login):

```sh
ssh-keygen -t ed25519 -f wbms_ci_deploy -N ""
# public half → appended to deploy's ~/.ssh/authorized_keys on the VPS
# private half → GitHub secret VPS_SSH_KEY (below)
```

Repo → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `VPS_HOST` | the VPS's IP or hostname |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | the CI keypair's **private** key from above |
| Secret | `VPS_KNOWN_HOSTS` | output of `ssh-keyscan <VPS_HOST>` run from your own machine |
| Variable | `DEPLOY_ENABLED` | `true` |

Also create a GitHub **environment** named `production` (repo → Settings → Environments) — the
`deploy` job targets it, which is also where you can later require manual approval on deploys if
you want one.

### 9. Confirm it

Push anything to `main` (even the docs commit for this setup) and watch the `deploy` job in
Actions — that's the first real end-to-end run. After it finishes, `https://yourdomain.com`
should be live over HTTPS.

---

## Routine use

- **Deploys:** automatic on every `main` push once step 8 is done. To roll back, re-run an older
  successful workflow run in Actions — `deploy.sh` checks out that run's SHA and pulls its
  images. Migrations are not reversed by a rollback; see `backend/src/migrations/` if a schema
  change needs manually walking back.
- **Portainer** (`https://portainer.yourdomain.com`): logs, restart/stop a container, resource
  use — the GUI alternative to SSHing in for routine checks.
- **Manual deploy**, if ever needed: `ssh deploy@<host> "cd /opt/wbms && sh deploy/deploy.sh <sha>"`.

## Backups

`backup.sh` dumps the live database (via `docker compose exec db pg_dump`) and archives the
`uploads` volume (worker photos — see `utils/photoStorage.js` and PRD.md C.2 "Storage
discipline") into `deploy/backups/` (gitignored), each gzipped, each keeping the most recent 14.
`deploy/deploy.sh` already runs it before every deploy as a safety net. Also wire it into host
cron for routine nightly backups independent of deploys, e.g.:

```
0 2 * * * /opt/wbms/deploy/backup.sh >> /var/log/wbms-backup.log 2>&1
```

**This alone is not a real backup strategy** — `deploy/backups/` lives on the same disk as
everything else on this VPS. Sync it off-box regularly (`rclone`/`rsync` to another host or
object storage; not automated by this script — set up whichever the VPS account already has
credentials for). A restore needs BOTH artifacts to be complete: the database dump references
photo filenames the uploads tarball actually has to contain.

`restore.sh <path-to-dump.sql.gz> [path-to-uploads.tar.gz]` reverses it, with an interactive
confirmation prompt since the database half is destructive to whatever's currently live. The
uploads argument is optional and additive — it extracts on top of whatever's already on the
volume rather than replacing it outright.

## TLS

Automatic. `proxy` (Caddy) requests and renews its own Let's Encrypt certificate for whatever
`SITE_ADDRESS` names in `.env`, with no certbot service or renewal cron — see
`frontend/Caddyfile`. Certificates persist in the `caddy_data` named volume across redeploys, so
a routine deploy doesn't re-request one. With `SITE_ADDRESS` unset (local dev, CI), Caddy serves
plain HTTP on `:80` instead — nothing here needs a domain to work locally.

## Troubleshooting

- **Logins silently fail / the session cookie never sticks.** `COOKIE_SECURE=true` in `.env` but
  something's actually serving over plain HTTP in front of the app (DNS not pointed here yet, or
  the cert request failed) — the browser then refuses to send a `Secure` cookie back.
  `docker compose logs proxy` shows whether Caddy actually has a certificate.
- **Caddy can't get a certificate.** Usually DNS hasn't propagated yet (`dig +short <domain>`
  should return this VPS's IP), or port 80/443 isn't reachable from the internet (check step 2's
  firewall rules — Let's Encrypt's HTTP challenge needs port 80 open, even though the end result
  is HTTPS).
- **`deploy/deploy.sh` fails on "working tree is not clean."** Something was edited by hand
  directly on the VPS instead of through a commit. Inspect with `git status`/`git diff` in
  `/opt/wbms` before deciding whether to discard it or turn it into a real commit.
- **The `deploy` job in Actions is skipped, not failed.** `vars.DEPLOY_ENABLED` isn't `true` yet
  — see step 8. A skip here is normal before the VPS is set up, not a bug.
- **Migration fails on boot (`backend` never turns healthy, `deploy.sh` times out on `--wait`).**
  `docker compose logs backend` shows the migration error directly. The previous containers are
  still running underneath (compose doesn't tear down the old ones until the new ones are
  healthy), so the site stays up on the old version while you fix the migration and re-deploy.

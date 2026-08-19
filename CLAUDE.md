# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

**Wooden Bizarre Management System** — an internal operations app for a custom woodworking /
furniture shop in the Philippines. It tracks a client order from intake, through staged
production and QA sign-off, to completion, plus per-project profitability, worker attendance,
and productivity. Single tenant, five roles (`Admin`, `Production Manager`, `Inventory Staff`,
`Quality Checker`, `Worker`), money in PHP (₱), business day in Asia/Manila time.

Full product behavior: [`docs/reference_md/PRD.md`](docs/reference_md/PRD.md).
Known issues and the improvement roadmap: [`docs/reference_md/ARCHITECTURE_REVIEW.md`](docs/reference_md/ARCHITECTURE_REVIEW.md).

**Hosting target:** a single **Hostinger VPS, KVM 1 plan — 1 vCPU, 4 GB RAM, 50 GB NVMe**
(self-managed, root access, no managed database or load balancer). `docker-compose.yml` (repo
root) runs it as three containers — `db` (Postgres), `backend` (Express, migrates itself on
boot), `proxy` (Nginx — serves the built frontend and reverse-proxies `/api` to `backend`); see
`deploy/README.md` for first-time setup and `deploy/backup.sh`/`restore.sh` for the
`pg_dump`-based backup story (a VPS snapshot alone is not a substitute — see that README for
why). Currently **HTTP-only**: no domain is pointed at the VPS yet, so there's no TLS
(Let's Encrypt can't certify a bare IP) — `COOKIE_SECURE` in `.env` must stay `false` until that
changes, or sessions silently stop working. The single vCPU is the binding constraint, not RAM
or disk: extra app containers don't add real parallelism on one core, so "scaling" here mostly
means keeping the app efficient within that one core rather than fanning out replicas. See
`PRD.md` C.2 and `ARCHITECTURE_REVIEW.md` P1-1/P1-2/P1-10 for what this changes concretely.

## Repo layout — read this before running anything

```
docker-compose.yml      # 3 services: db, backend, proxy — see "Hosting target" above
.env.example             # what docker-compose.yml reads; copy to untracked .env
deploy/                  backup.sh, restore.sh, README.md
.github/workflows/ci.yml # backend install, frontend lint+build, docker build (both images)
backend/
  .gitignore
  src/                  # <-- the actual backend package root, NOT backend/
    package.json         (name: "src")
    package-lock.json
    node_modules/
    .env                  (untracked, required — see below; distinct from the root .env.example)
    server.js
    Dockerfile, docker-entrypoint.sh, .dockerignore
    config/db.js
    migrations/           # node-pg-migrate; ALL schema changes land here, including the initial
                           # schema (a fresh DB is just `npm run migrate`, nothing else first)
    scripts/               createAdmin.js, migrate.js
    middleware/            auth.js, errorHandler.js
    routes/ controllers/ models/
frontend/
  package.json, vite.config.js, index.html
  Dockerfile, nginx.conf, .dockerignore
  .env                  (untracked, required — see below)
  src/
    App.jsx, Login.jsx, TempSignup.jsx, main.jsx
    Admin.jsx, ProductionManager.jsx, QualityChecker.jsx, Worker.jsx, Inventory.jsx   # role shells
    admin/ product_manager/ quality_checker/ worker/ globals/ auth-components/         # screens
    api/client.js                                                    # shared fetch wrapper
    css/
docs/
  reference_md/   PRD.md, ARCHITECTURE_REVIEW.md
  design/         (empty)
```

**The backend package root is `backend/src/`, not `backend/`.** `package.json`,
`package-lock.json`, `node_modules/`, and `.env` all live in `backend/src/`. `.gitignore` sits
one level up at `backend/`. All `npm` commands run from `backend/src`.

There is **no root `package.json`** and no workspace tooling — nothing installs, builds, lints,
or runs both halves together. Treat this as two independent projects that happen to share a repo.

## Running the app

**Locally (no Docker), PowerShell, matching this environment:**

```powershell
# Backend (Express on $PORT, default 8080)
cd backend/src
npm install
npm start          # or `npm run dev` for nodemon auto-restart

# Frontend (Vite dev server on :5173)
cd frontend
npm install
npm run dev

# Database — a fresh DB is just this, nothing else first:
cd backend/src
npm run migrate          # applies every migration, including the initial schema
npm run migrate:down     # reverts the most recently applied migration
npm run migrate:create   # scaffolds a new migration file
```

**Via Docker Compose** (matches the deployed topology — one command builds and runs all three
services): `cp .env.example .env`, fill in real values, then `docker compose up -d --build`
from the repo root. See `deploy/README.md`.

`npm test` in `backend/src` is the unmodified `create-*` stub (`exit 1`) — there are no tests
in either project.

**Trap if you're migrating a pre-existing local database created before the initial-schema
migration existed** (i.e. one originally bootstrapped by hand from the now-deleted
`backend/index.sql`): `npm run migrate` will try to re-run the initial-schema migration and fail
on "already exists," since that database's schema predates this file. Mark it applied without
re-running its SQL by inserting a row directly —
`INSERT INTO pgmigrations (name, run_on) VALUES ('1700000000000_initial-schema', NOW())` — then
make sure the `id` ordering in `pgmigrations` matches name-timestamp order (delete and reinsert
all rows in that order if not), since `node-pg-migrate`'s `checkOrder` check compares the two
and refuses to run otherwise. A genuinely fresh database never hits this.

## Environment variables

Never commit any `.env`, and never echo its values into chat, logs, commit messages, or
documents (including this one). Three separate files, three separate purposes — don't conflate
them:

**`.env.example`** (repo root) — the contract for `docker-compose.yml`. Copy to a root `.env`
for the Docker Compose path; not read by `npm start`/`npm run dev` at all.

**`backend/src/.env`** (untracked, required for local non-Docker dev)
| Variable | Purpose |
|---|---|
| `SQL_USER`, `SQL_HOST`, `SQL_DB`, `SQL_PASS`, `SQL_PORT` | Postgres connection (read in `config/db.js`) |
| `SQL_CA_CERT` | Optional path to a private CA cert file, for a non-localhost Postgres that isn't signed by a public CA. Certificate verification is otherwise mandatory (`rejectUnauthorized: true`) for any non-localhost connection — see `ARCHITECTURE_REVIEW.md` P1-2. |
| `SECRET_KEY` | Session-cookie signing secret. **Required** — the server fails fast at startup (`process.exit(1)`) if unset; there is no fallback. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist |
| `COOKIE_SECURE` | `true` marks the session cookie HTTPS-only. Deliberately **not** tied to `NODE_ENV` (see P1-10) — leave `false` until the deployment actually terminates TLS somewhere, or the browser will never send the cookie back and every login will silently fail. |
| `PORT` | Server port (default `8080`) |
| `NODE_ENV` | `production` enables the verbose `morgan` log format. No longer affects the cookie flag — see `COOKIE_SECURE`. |

**`frontend/.env`** (untracked, required for local non-Docker dev)
| Variable | Purpose |
|---|---|
| `VITE_BACKEND_IP` | Backend base URL, concatenated onto every API call (`import.meta.env.VITE_BACKEND_IP + '/path'`). Baked into the build at `vite build` time — changing it requires a rebuild. Empty string in the Docker deployment (frontend and API are same-origin behind Nginx there); a real cross-origin URL (e.g. `http://localhost:8080`) for local dev, where the Vite dev server and Express run on different ports. |

**Traps worth knowing before you debug around them:**
- `ALLOWED_ORIGINS=""` is falsy in JS, so CORS silently falls back to `http://localhost:5173`
  even when the var is "set" to an empty string.

## Architecture conventions

Backend is a plain three-layer Express app: `routes/` → `controllers/` → `models/`, one file per
domain area (users, projects, job orders, attendance, profit, productivity, notifications,
dashboard). Models own all SQL and return `result.rows`. Every module `default`-exports an object
of named functions — follow that shape for new files rather than mixing named and default exports.

Frontend is plain React + Vite, no TypeScript, no state-management library (`useState`/`useEffect`
+ one `UserContext` for the logged-in user), CSS in plain global stylesheets under
`frontend/src/css/`. All API calls go through the shared client in `frontend/src/api/client.js`
(`api.get/post/put/delete`) — it always sends `credentials: 'include'` and prefixes
`VITE_BACKEND_IP`. New fetch logic should use it rather than calling `fetch` directly; the one
intentional exception is `App.jsx`'s `/session-user` check, where a 401 is an expected "not
logged in yet" state rather than an error.

## Non-negotiable rules for new code

- **All SQL goes through `query()` / `getClient()`** from `backend/src/config/db.js`, using
  `$1..$n` placeholders. The codebase currently has **zero** SQL string interpolation — keep it
  that way; never build a query string with template literals or concatenation.
- **Multi-statement writes use a transaction**: `getClient()`, then `BEGIN` / `COMMIT` /
  `ROLLBACK` with `finally { client.release() }`. Reference implementation:
  `createProjectWithVariables` in `backend/src/models/projectModel.js`.
- **Never `catch(e){ return e; }`.** Returning an `Error` object as if it were data is an existing
  bug pattern (e.g. `userModel.js`, `userController.js`) that turns real failures into false
  successes on the client. Throw, and let the caller handle or propagate it.
- **Never log request bodies, full user rows, or financial payloads.** An existing bug
  (`userController.js`, login handler) logs the bcrypt hash on every login attempt — don't repeat
  that shape. `console.log`/`console.error` should carry an event description and an ID, not a
  raw object.
- **Money is `numeric(12,2)`.** `net_profit` and `total_expenses` on `project_profit` are
  **generated stored columns** — computed by Postgres from the other columns. Never recompute
  profit in JS; read the generated column.
- **New comments in English.** Existing Tagalog comments in the codebase are being left as-is —
  don't rewrite them as a side effect of an unrelated change, and don't add new Tagalog comments.
- **Route auth**: real server-side authorization exists (`backend/src/middleware/auth.js` —
  `requireAuth`, `requireRole(...roles)`, `requireSelfOrRole(paramName, ...roles)`), applied
  per-route inside each router file. Any new route needs an explicit role check from this
  middleware — there is no blanket `app.use()` gate, so an unguarded route is a live hole, not a
  gap waiting to be closed.
- **Every backend route lives under `/api`** (as of P1-10) — mount new routers with
  `app.use('/api/...', ...)` in `server.js`, not at root. This is what lets the Nginx reverse
  proxy (`frontend/nginx.conf`) use one general `/api/` rule instead of a growing list of
  root-level exceptions; a route added outside `/api` won't be reachable through the deployed
  stack at all. `/healthz`/`/readyz` are the one deliberate exception (infrastructure endpoints,
  each with its own explicit Nginx `location` block).
- **Schema changes go through `backend/src/migrations/`** (node-pg-migrate) — there is no other
  path; the historical `backend/index.sql` bootstrap has been folded into the first migration
  and deleted. Create a migration with `npm run migrate:create -- <name>` from `backend/src`,
  give it a real `down`, and see the existing migrations for the project's conventions (e.g. a
  preflight check before adding a `UNIQUE` constraint on data that might already violate it).

## Known-broken / in-flight — don't mistake these for your own changes

- **No TLS yet.** The Docker Compose deployment is HTTP-only until a domain is pointed at the
  VPS — see "Hosting target" above. Don't set `COOKIE_SECURE=true` before that's actually true.
- **Docker builds are unverified outside CI.** The Dockerfiles/`docker-compose.yml` were written
  and reviewed on a machine without Docker installed — `.github/workflows/ci.yml`'s
  `docker-build` job is the first place they're actually built. Watch that Actions run before
  trusting a fresh image.
- Pagination (P1-3) and the Inventory backend (P1-11, currently `localStorage`-only on the
  frontend) are both still outstanding — not part of the P0/P0-prerequisite/P1a/P1-10 work
  completed so far.

P0 (authorization, session-secret fail-fast, rate limiting), P1a (session store, connection pool
limits, indexes, transactions, uniqueness constraints, `timestamptz`, baseline production
middleware), and P1-10 (Docker Compose deployment, `/api` route namespace, backups, CI) are
complete — see `ARCHITECTURE_REVIEW.md` for exactly what each covered.

Full findings, severity, and fix order live in `docs/reference_md/ARCHITECTURE_REVIEW.md`.

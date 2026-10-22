#!/bin/sh
# Runs ON THE VPS, invoked over SSH by .github/workflows/ci.yml's `deploy` job (item 42 — see
# ARCHITECTURE_REVIEW.md). Pulls the two images CI already built and pushed to GHCR for the given
# commit and brings the compose stack up to match — this is the whole "push to main deploys
# automatically" story. The VPS never runs `npm install`/`npm run build`/`docker build` itself;
# one vCPU can't spare the time for that mid-deploy while the app is also serving live traffic.
#
# Usage: deploy/deploy.sh <git-sha>
#
# Expects: a `deploy` user already in the `docker` group, this repo cloned at /opt/wbms with a
# real .env (see deploy/README.md), and `docker login ghcr.io` already done for this shell (the
# calling workflow step pipes GITHUB_TOKEN in right before invoking this script).
set -eu

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
    echo "Usage: $0 <git-sha>" >&2
    exit 1
fi
SHA="$1"

if [ ! -f .env ]; then
    echo "deploy.sh: .env not found at repo root — see deploy/README.md's first-time setup." >&2
    exit 1
fi

# A dirty tree here means someone edited files by hand on the VPS instead of through a commit —
# refuse rather than silently discard or silently merge over it. (.env itself is untracked, so
# this never trips on the real secrets.)
if [ -n "$(git status --porcelain)" ]; then
    echo "deploy.sh: working tree is not clean — investigate by hand before deploying." >&2
    git status --short
    exit 1
fi

echo "deploy.sh: fetching and checking out $SHA..."
git fetch origin --quiet
git checkout --detach --quiet "$SHA"

# A pre-deploy safety net, not a substitute for the off-box backup story in deploy/README.md —
# see backup.sh's own header for why.
echo "deploy.sh: taking a pre-deploy backup..."
sh ./deploy/backup.sh

echo "deploy.sh: pulling images for $SHA..."
IMAGE_TAG="$SHA" docker compose pull backend proxy

echo "deploy.sh: recreating the stack..."
# --wait fails this script (and so the workflow) if the backend's healthcheck — which depends on
# its own migrate-on-boot succeeding — never turns healthy, instead of silently leaving the old
# containers running while new ones crash-loop in the background.
IMAGE_TAG="$SHA" docker compose up -d --wait

echo "deploy.sh: pruning dangling images..."
docker image prune -f

echo "deploy.sh: deployed $SHA."

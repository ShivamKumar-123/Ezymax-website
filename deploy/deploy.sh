#!/usr/bin/env bash
#
# Deploy Ezymex to the production host.
#
# Run on the server, from /opt/ezymex. CI calls it over SSH; a human can call
# it by hand the same way. Decides what to touch from what actually changed
# between the deployed commit and the one being deployed, because rebuilding
# four Next.js images to ship a backend one-liner costs twenty minutes for
# nothing.
#
#   ./deploy/deploy.sh                 # deploy origin/main
#   ./deploy/deploy.sh <ref>           # deploy a specific commit/tag
#   FORCE_ALL=1 ./deploy/deploy.sh     # rebuild everything, ignore the diff
#
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/opt/ezymex}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
TARGET_REF="${1:-origin/main}"
HEALTH_URL="${HEALTH_URL:-https://api.ezymex.com/api/v1/auth/platform-status}"

cd "$REPO_DIR"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mDEPLOY FAILED: %s\033[0m\n' "$*" >&2; exit 1; }

# ── Which service owns which path ────────────────────────────────────────────
# Backend services share backend/packages, so a change there rebuilds all of
# them. Frontends are independent.
BACKEND_SERVICES="gateway admin-api market-data b-book-engine risk-engine"

services_for_path() {
  case "$1" in
    backend/packages/*)            echo "$BACKEND_SERVICES" ;;
    backend/services/gateway/*)    echo "gateway" ;;
    backend/services/admin/*)      echo "admin-api" ;;
    backend/services/market-data/*) echo "market-data" ;;
    backend/services/b-book-engine/*) echo "b-book-engine" ;;
    backend/services/risk-engine/*)   echo "risk-engine" ;;
    backend/*)                     echo "$BACKEND_SERVICES" ;;
    frontend/trader/*)             echo "trader-frontend" ;;
    frontend/admin/*)              echo "admin-frontend" ;;
    frontend/ib/*)                 echo "ib-frontend" ;;
    frontend/landing/*)            echo "landing-frontend" ;;
    docker-compose*.yml|.env)      echo "$BACKEND_SERVICES trader-frontend admin-frontend ib-frontend landing-frontend" ;;
    *)                             echo "" ;;
  esac
}

is_frontend() { case "$1" in *-frontend) return 0 ;; *) return 1 ;; esac; }

# ── Work out the change set ──────────────────────────────────────────────────
BEFORE="$(git rev-parse HEAD)"
say "Fetching $TARGET_REF"
git fetch --prune origin || die "git fetch failed"
AFTER="$(git rev-parse "$TARGET_REF")" || die "unknown ref: $TARGET_REF"

if [ "$BEFORE" = "$AFTER" ] && [ "${FORCE_ALL:-0}" != "1" ]; then
  echo "Already at $AFTER — nothing to deploy."
  exit 0
fi

echo "  from $BEFORE"
echo "  to   $AFTER"

if [ "${FORCE_ALL:-0}" = "1" ]; then
  TOUCHED="$BACKEND_SERVICES trader-frontend admin-frontend ib-frontend landing-frontend"
  echo "  FORCE_ALL set — rebuilding everything"
else
  CHANGED_PATHS="$(git diff --name-only "$BEFORE" "$AFTER")"
  TOUCHED=""
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    TOUCHED="$TOUCHED $(services_for_path "$p")"
  done <<< "$CHANGED_PATHS"
fi

# De-duplicate while keeping it readable.
TOUCHED="$(echo "$TOUCHED" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')"

if [ -z "${TOUCHED// /}" ]; then
  say "No deployable service changed (docs/CI only) — pulling and stopping."
  git merge --ff-only "$AFTER" || die "fast-forward failed"
  exit 0
fi

say "Services to deploy:${TOUCHED}"

# ── Roll the code forward ────────────────────────────────────────────────────
say "Updating working tree"
git merge --ff-only "$AFTER" || die "fast-forward failed (local commits on the server?)"

rollback() {
  say "Rolling back to $BEFORE"
  git merge --ff-only "$BEFORE" 2>/dev/null || git reset --hard "$BEFORE"
  for s in $TOUCHED; do
    if is_frontend "$s"; then
      $COMPOSE build "$s" >/dev/null 2>&1 || true
    fi
    $COMPOSE up -d --force-recreate "$s" >/dev/null 2>&1 || true
  done
  die "deploy failed and was rolled back to $BEFORE"
}
trap rollback ERR

# ── Build images for the frontends that changed ──────────────────────────────
# --no-cache because Docker's COPY layer cache has silently shipped a stale
# bundle here before: the layer key does not notice a file the build pulled in
# after the cache entry was made.
for s in $TOUCHED; do
  if is_frontend "$s"; then
    say "Building $s (no cache)"
    $COMPOSE build --no-cache "$s" || die "build failed for $s"
  fi
done

# ── Recreate containers ──────────────────────────────────────────────────────
# --force-recreate on everything, backend included: the backend code is
# bind-mounted so `restart` would pick it up, but `restart` does NOT re-read
# .env, and an env change that silently does not apply is a worse failure than
# a few seconds of recreate.
for s in $TOUCHED; do
  say "Recreating $s"
  $COMPOSE up -d --force-recreate "$s" || die "could not start $s"
done

# ── Prove it came back ───────────────────────────────────────────────────────
say "Waiting for services to settle"
sleep 20

for s in $TOUCHED; do
  state="$($COMPOSE ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$s" '$1==s{print $2}')"
  [ "$state" = "running" ] || die "$s is '$state', expected running"
  echo "  $s: running"
done

say "Health check"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL" || echo 000)"
[ "$code" = "200" ] || die "health check returned $code from $HEALTH_URL"
echo "  gateway: $code"

# Frontends answer through nginx on their own vhosts.
for host in ezymex.com trade.ezymex.com admin.ezymex.com ib.ezymex.com; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$host/" || echo 000)"
  case "$code" in
    200|301|302|307|308) echo "  $host: $code" ;;
    *) die "$host returned $code" ;;
  esac
done

trap - ERR
say "Deployed $AFTER"
git --no-pager log -1 --format='  %h %s' "$AFTER"

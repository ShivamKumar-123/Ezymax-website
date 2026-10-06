#!/usr/bin/env bash
#
# One-command deploy: pull, figure out what actually changed, run migrations
# if needed, rebuild + restart only the affected services, reload nginx if
# its config changed, then healthcheck. Bails out cleanly when nothing
# changed so repeated runs are cheap.
#
# Usage (on the server):
#   ./deploy.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/ezymex}"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

cd "$REPO_DIR"

BEFORE=$(git rev-parse HEAD)
git pull --ff-only origin main
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "Already up to date ($AFTER). Nothing to do."
  exit 0
fi

CHANGED=$(git diff --name-only "$BEFORE" "$AFTER")
echo "── Changed files ────────────────────────────────"
echo "$CHANGED"
echo "─────────────────────────────────────────────────"

matches() { echo "$CHANGED" | grep -E "$1" >/dev/null 2>&1; }

# `packages/common` is shared by every backend service, so changes there
# fan out to all of them. Frontends are independent.
NEEDS_COMMON=0;       matches '^backend/packages/common/'         && NEEDS_COMMON=1
NEEDS_GATEWAY=0;      matches '^backend/services/gateway/'        && NEEDS_GATEWAY=1
NEEDS_ADMIN_API=0;    matches '^backend/services/admin/'          && NEEDS_ADMIN_API=1
NEEDS_BBOOK=0;        matches '^backend/services/b-book-engine/'  && NEEDS_BBOOK=1
NEEDS_MD=0;           matches '^backend/services/market-data/'    && NEEDS_MD=1
NEEDS_RISK=0;         matches '^backend/services/risk-engine/'    && NEEDS_RISK=1
NEEDS_TRADER=0;       matches '^frontend/trader/'                 && NEEDS_TRADER=1
NEEDS_ADMIN_FE=0;     matches '^frontend/admin/'                  && NEEDS_ADMIN_FE=1
NEEDS_MIGRATE=0;      matches '^backend/infra/migrations/'        && NEEDS_MIGRATE=1
NEEDS_NGINX=0;        matches '^deploy/nginx/'                    && NEEDS_NGINX=1

if [ $NEEDS_COMMON -eq 1 ]; then
  NEEDS_GATEWAY=1; NEEDS_ADMIN_API=1; NEEDS_BBOOK=1; NEEDS_MD=1; NEEDS_RISK=1
fi

if [ $NEEDS_MIGRATE -eq 1 ]; then
  echo "▶ Running migrations…"
  docker compose --profile migrate run --rm migrate
fi

TO_BUILD=()
[ $NEEDS_GATEWAY -eq 1 ]   && TO_BUILD+=(gateway)
[ $NEEDS_ADMIN_API -eq 1 ] && TO_BUILD+=(admin-api)
[ $NEEDS_BBOOK -eq 1 ]     && TO_BUILD+=(b-book-engine)
[ $NEEDS_MD -eq 1 ]        && TO_BUILD+=(market-data)
[ $NEEDS_RISK -eq 1 ]      && TO_BUILD+=(risk-engine)
[ $NEEDS_TRADER -eq 1 ]    && TO_BUILD+=(trader-frontend)
[ $NEEDS_ADMIN_FE -eq 1 ]  && TO_BUILD+=(admin-frontend)

if [ ${#TO_BUILD[@]} -gt 0 ]; then
  echo "▶ Building: ${TO_BUILD[*]}"
  $COMPOSE build "${TO_BUILD[@]}"
  echo "▶ Restarting: ${TO_BUILD[*]}"
  $COMPOSE up -d "${TO_BUILD[@]}"
else
  echo "▶ No service rebuild needed."
fi

if [ $NEEDS_NGINX -eq 1 ]; then
  echo "▶ Reloading nginx…"
  sudo cp deploy/nginx/ezymex.conf /etc/nginx/sites-available/ezymex.conf
  # cloudflare-real-ip.conf is dropped into conf.d once at install time;
  # we re-copy it on each deploy so edits to the file flow through.
  if [ -f deploy/nginx/cloudflare-real-ip.conf ]; then
    sudo cp deploy/nginx/cloudflare-real-ip.conf /etc/nginx/conf.d/cloudflare-real-ip.conf
  fi
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "▶ Healthcheck…"
sleep 4
# The gateway / trader containers take a few seconds to boot after `up -d`,
# so a single probe often sees a transient 502 from nginx. Retry every 3 s
# for up to HEALTHCHECK_TIMEOUT (default 60 s) and judge the LAST result.
# 5xx or a flat 000 (no connection) is a real failure. 4xx still means the
# stack is up — caller can decide whether the route should exist.
HEALTH_DEADLINE=$((SECONDS + ${HEALTHCHECK_TIMEOUT:-60}))
while :; do
  CODE_API=$(curl -sk --max-time 10 -o /dev/null -w "%{http_code}" https://api.ezymex.com/health   || echo "000")
  CODE_TRD=$(curl -sk --max-time 10 -o /dev/null -w "%{http_code}" https://trade.ezymex.com/       || echo "000")
  # On a connection error curl prints "000" via -w AND the fallback echo adds
  # another "000" → "000000", which slipped past the `000` match below and
  # passed a dead stack. Keep the 3-digit status only.
  CODE_API=${CODE_API:0:3}; CODE_TRD=${CODE_TRD:0:3}
  fail=0
  case "$CODE_API" in 000|5*) fail=1 ;; esac
  case "$CODE_TRD" in 000|5*) fail=1 ;; esac
  [ $fail -eq 0 ] && break
  [ $SECONDS -ge $HEALTH_DEADLINE ] && break
  sleep 3
done
echo "  api.ezymex.com/health  → HTTP $CODE_API"
echo "  trade.ezymex.com       → HTTP $CODE_TRD"

if [ $fail -ne 0 ]; then
  echo "⚠️  Healthcheck failed. Inspect with:"
  echo "    $COMPOSE logs --tail=120 gateway trader-frontend"
  exit 1
fi

echo "✅ Deploy complete: ${BEFORE:0:7} → ${AFTER:0:7}"

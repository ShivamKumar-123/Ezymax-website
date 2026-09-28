#!/usr/bin/env bash
# Deploy the current main branch on the Kalks VPS. Run as the `kalks` user:  ~/kalks/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source ~/.cargo/env
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144

git pull --ff-only
pnpm install --frozen-lockfile
cargo build --release -p market-data -p gateway -p trading -p ib

# trading engine secrets are generated on the server on first deploy (never committed, never printed)
touch .env.local
grep -q '^TRADING_SESSION_SECRET=' .env.local || printf '\nTRADING_SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^TRADING_INTERNAL_TOKEN=' .env.local || printf 'TRADING_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^TRADING_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  # same server and credentials as the gateway, database kalks_trading (created on first start)
  printf 'TRADING_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/kalks_trading\1#')" >> .env.local
fi
# IB service secrets (same rules as the engine): internal token generated once, database kalks_ib
grep -q '^IB_INTERNAL_TOKEN=' .env.local || printf 'IB_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^IB_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'IB_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/kalks_ib\1#')" >> .env.local
fi
# the Client Area and Back Office BFFs reach the IB service with the same token
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^IB_URL=' "$f" || printf 'IB_URL=http://127.0.0.1:8096\n' >> "$f"
  grep -q '^IB_INTERNAL_TOKEN=' "$f" || printf 'IB_INTERNAL_TOKEN=%s\n' "$(grep '^IB_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
pnpm turbo run build --filter=@kalks/crm --filter=@kalks/admin --filter=@kalks/terminal --concurrency=1

# service units + edge config (idempotent)
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable kalks-market-data kalks-gateway kalks-trading kalks-ib kalks-crm kalks-admin kalks-terminal >/dev/null
sudo systemctl restart kalks-market-data kalks-gateway kalks-trading kalks-ib kalks-crm kalks-admin kalks-terminal
sudo systemctl reload caddy
sleep 5
for u in 127.0.0.1:8081/health 127.0.0.1:8080/health 127.0.0.1:8090/health 127.0.0.1:8096/health 127.0.0.1:3000/login 127.0.0.1:3001/login 127.0.0.1:3002/login; do
  printf "%-26s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' "http://$u")"
done

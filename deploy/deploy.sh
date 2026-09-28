#!/usr/bin/env bash
# Deploy the current main branch on the Kalks VPS. Run as the `kalks` user:  ~/kalks/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source ~/.cargo/env
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144

# Pull first, then run the freshly pulled copy of this script (bash reads scripts while running, so
# steps added by the pull would otherwise be skipped).
if [ -z "${KALKS_DEPLOY_PULLED:-}" ]; then
  git pull --ff-only
  KALKS_DEPLOY_PULLED=1 exec "$0" "$@"
fi
pnpm install --frozen-lockfile
cargo build --release -p market-data -p gateway -p trading -p ib
cargo build --release -p academy
cargo build --release -p algo

# trading engine secrets are generated on the server on first deploy (never committed, never printed)
touch .env.local
grep -q '^TRADING_SESSION_SECRET=' .env.local || printf '\nTRADING_SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^TRADING_INTERNAL_TOKEN=' .env.local || printf 'TRADING_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^TRADING_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  # same server and credentials as the gateway, database kalks_trading (created on first start)
  printf 'TRADING_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/kalks_trading\1#')" >> .env.local
fi
# KYC documents (gateway): AES-256-GCM data key generated once and never printed. BACK IT UP: without it the
# stored documents can't be decrypted. Files live outside every web root, 0700 / 0600.
grep -q '^KYC_ENCRYPTION_KEY=' .env.local || printf 'KYC_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^KYC_STORAGE_DIR=' .env.local || printf 'KYC_STORAGE_DIR=%s\n' "$HOME/.kalks-data/kyc" >> .env.local
install -d -m 700 "$(grep '^KYC_STORAGE_DIR=' .env.local | cut -d= -f2-)"
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
# Academy secrets: internal token generated once, database kalks_academy, public URL printed on certificates;
# the Client Area and Back Office BFFs reach the service with the same token
grep -q '^ACADEMY_INTERNAL_TOKEN=' .env.local || printf 'ACADEMY_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^ACADEMY_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'ACADEMY_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/kalks_academy\1#')" >> .env.local
fi
grep -q '^ACADEMY_VERIFY_URL=' .env.local || printf 'ACADEMY_VERIFY_URL=https://app.kalkstrade.com\n' >> .env.local
for f in apps/crm/.env.production.local apps/admin/.env.production.local; do
  touch "$f"
  grep -q '^ACADEMY_URL=' "$f" || printf 'ACADEMY_URL=http://127.0.0.1:8098\n' >> "$f"
  grep -q '^ACADEMY_INTERNAL_TOKEN=' "$f" || printf 'ACADEMY_INTERNAL_TOKEN=%s\n' "$(grep '^ACADEMY_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# ALGO service secrets: internal token and API-key HMAC master generated once (never printed), database
# kalks_algo. The AI assistant's Claude key is read from .env.claude (copied from the terminal's env if missing).
grep -q '^ALGO_INTERNAL_TOKEN=' .env.local || printf 'ALGO_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^ALGO_KEY_SECRET=' .env.local || printf 'ALGO_KEY_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^ALGO_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'ALGO_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/kalks_algo\1#')" >> .env.local
fi
if ! grep -q '^ANTHROPIC_API_KEY=' .env.claude 2>/dev/null && grep -q '^ANTHROPIC_API_KEY=' apps/terminal/.env.production.local 2>/dev/null; then
  (umask 077; grep '^ANTHROPIC_API_KEY=' apps/terminal/.env.production.local > .env.claude)
fi
# the Client Area and Back Office BFFs reach the ALGO service with the same token
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^ALGO_URL=' "$f" || printf 'ALGO_URL=http://127.0.0.1:8099\n' >> "$f"
  grep -q '^ALGO_INTERNAL_TOKEN=' "$f" || printf 'ALGO_INTERNAL_TOKEN=%s\n' "$(grep '^ALGO_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# ALGO service secrets: internal token and API-key HMAC master generated once (never printed), database
# kalks_algo. The AI assistant's Claude key is read from .env.claude (copied from the terminal's env if missing).
grep -q '^ALGO_INTERNAL_TOKEN=' .env.local || printf 'ALGO_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^ALGO_KEY_SECRET=' .env.local || printf 'ALGO_KEY_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^ALGO_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'ALGO_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/kalks_algo\1#')" >> .env.local
fi
if ! grep -q '^ANTHROPIC_API_KEY=' .env.claude 2>/dev/null && grep -q '^ANTHROPIC_API_KEY=' apps/terminal/.env.production.local 2>/dev/null; then
  (umask 077; grep '^ANTHROPIC_API_KEY=' apps/terminal/.env.production.local > .env.claude)
fi
# the Client Area and Back Office BFFs reach the ALGO service with the same token
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^ALGO_URL=' "$f" || printf 'ALGO_URL=http://127.0.0.1:8099\n' >> "$f"
  grep -q '^ALGO_INTERNAL_TOKEN=' "$f" || printf 'ALGO_INTERNAL_TOKEN=%s\n' "$(grep '^ALGO_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
pnpm turbo run build --filter=@kalks/crm --filter=@kalks/admin --filter=@kalks/terminal --concurrency=1

# service units + edge config (idempotent)
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable kalks-market-data kalks-gateway kalks-trading kalks-ib kalks-crm kalks-admin kalks-terminal >/dev/null
sudo systemctl restart kalks-market-data kalks-gateway kalks-trading kalks-ib kalks-crm kalks-admin kalks-terminal
sudo systemctl enable kalks-academy >/dev/null && sudo systemctl restart kalks-academy
sudo systemctl enable kalks-algo >/dev/null && sudo systemctl restart kalks-algo
sudo systemctl reload caddy
sleep 5
for u in 127.0.0.1:8081/health 127.0.0.1:8080/health 127.0.0.1:8090/health 127.0.0.1:8096/health 127.0.0.1:3000/login 127.0.0.1:3001/login 127.0.0.1:3002/login; do
  printf "%-26s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' "http://$u")"
done
printf "%-26s %s\n" 127.0.0.1:8098/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8098/health)"
printf "%-26s %s\n" 127.0.0.1:8099/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/health)"

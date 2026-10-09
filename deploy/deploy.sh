#!/usr/bin/env bash
# Deploy the current main branch on the Ezymex VPS. Run as the `ezymex` user:  ~/ezymex/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source ~/.cargo/env
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144

# Pull first, then run the freshly pulled copy of this script (bash reads scripts while running, so
# steps added by the pull would otherwise be skipped).
if [ -z "${EZYMEX_DEPLOY_PULLED:-}" ]; then
  git pull --ff-only
  EZYMEX_DEPLOY_PULLED=1 exec "$0" "$@"
fi
# TradingView Advanced Charts (licensed, never in git): uploaded once to /srv/ezymex-src; the postinstall step copies it
# into the terminal (scripts/sync-assets.mjs). Without it the terminal keeps its own chart.
if [ -d /srv/ezymex-src/charting_library-master ]; then export TV_LIBRARY_DIR=/srv/ezymex-src/charting_library-master; fi
pnpm install --frozen-lockfile
cargo build --release -p market-data -p gateway -p trading -p prop -p ib
cargo build --release -p academy
cargo build --release -p algo
cargo build --release -p wallet
cargo build --release -p support
cargo build --release -p growth
cargo build --release -p reports
cargo build --release -p news
cargo build --release -p options

# trading engine secrets are generated on the server on first deploy (never committed, never printed)
touch .env.local
grep -q '^TRADING_SESSION_SECRET=' .env.local || printf '\nTRADING_SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^TRADING_INTERNAL_TOKEN=' .env.local || printf 'TRADING_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^TRADING_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  # same server and credentials as the gateway, database ezymex_trading (created on first start)
  printf 'TRADING_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_trading\1#')" >> .env.local
fi
# gateway (sign-in) and market-data admin secrets, generated once; every service runs in production mode on the
# server (development modes expose sign-in codes and relax checks)
grep -q '^SESSION_SECRET=' .env.local || printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^GATEWAY_INTERNAL_TOKEN=' .env.local || printf 'GATEWAY_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^MARKET_DATA_ADMIN_TOKEN=' .env.local || printf 'MARKET_DATA_ADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
for v in GATEWAY_ENV TRADING_ENV IB_ENV PROP_ENV ACADEMY_ENV ALGO_ENV WALLET_ENV SUPPORT_ENV GROWTH_ENV REPORTS_ENV NEWS_ENV OPTIONS_ENV; do
  grep -q "^$v=" .env.local || printf '%s=production\n' "$v" >> .env.local
done
# the three apps' BFFs reach the gateway and the trading engine with the same tokens; the Back Office edits spreads
# through market-data's admin API
for app in apps/crm apps/admin apps/terminal; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^GATEWAY_URL=' "$f" || printf 'GATEWAY_URL=http://127.0.0.1:8080\n' >> "$f"
  grep -q '^GATEWAY_INTERNAL_TOKEN=' "$f" || printf 'GATEWAY_INTERNAL_TOKEN=%s\n' "$(grep '^GATEWAY_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
  grep -q '^TRADING_URL=' "$f" || printf 'TRADING_URL=http://127.0.0.1:8090\n' >> "$f"
  grep -q '^TRADING_INTERNAL_TOKEN=' "$f" || printf 'TRADING_INTERNAL_TOKEN=%s\n' "$(grep '^TRADING_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
f=apps/admin/.env.production.local
grep -q '^MARKET_DATA_URL=' "$f" || printf 'MARKET_DATA_URL=http://127.0.0.1:8081\n' >> "$f"
grep -q '^MARKET_DATA_ADMIN_TOKEN=' "$f" || printf 'MARKET_DATA_ADMIN_TOKEN=%s\n' "$(grep '^MARKET_DATA_ADMIN_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
# KYC documents (gateway): AES-256-GCM data key generated once and never printed. BACK IT UP: without it the
# stored documents can't be decrypted. Files live outside every web root, 0700 / 0600.
grep -q '^KYC_ENCRYPTION_KEY=' .env.local || printf 'KYC_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^KYC_STORAGE_DIR=' .env.local || printf 'KYC_STORAGE_DIR=%s\n' "$HOME/.ezymex-data/kyc" >> .env.local
install -d -m 700 "$(grep '^KYC_STORAGE_DIR=' .env.local | cut -d= -f2-)"
# IB service secrets (same rules as the engine): internal token generated once, database ezymex_ib
grep -q '^IB_INTERNAL_TOKEN=' .env.local || printf 'IB_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^IB_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'IB_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_ib\1#')" >> .env.local
fi
# the Client Area and Back Office BFFs reach the IB service with the same token
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^IB_URL=' "$f" || printf 'IB_URL=http://127.0.0.1:8096\n' >> "$f"
  grep -q '^IB_INTERNAL_TOKEN=' "$f" || printf 'IB_INTERNAL_TOKEN=%s\n' "$(grep '^IB_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# Academy secrets: internal token generated once, database ezymex_academy, public URL printed on certificates;
# the Client Area and Back Office BFFs reach the service with the same token
grep -q '^ACADEMY_INTERNAL_TOKEN=' .env.local || printf 'ACADEMY_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^ACADEMY_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'ACADEMY_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_academy\1#')" >> .env.local
fi
grep -q '^ACADEMY_VERIFY_URL=' .env.local || printf 'ACADEMY_VERIFY_URL=https://app.ezymex.com\n' >> .env.local
for f in apps/crm/.env.production.local apps/admin/.env.production.local; do
  touch "$f"
  grep -q '^ACADEMY_URL=' "$f" || printf 'ACADEMY_URL=http://127.0.0.1:8098\n' >> "$f"
  grep -q '^ACADEMY_INTERNAL_TOKEN=' "$f" || printf 'ACADEMY_INTERNAL_TOKEN=%s\n' "$(grep '^ACADEMY_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# prop service secrets (same rules as the engine): internal token generated once, database ezymex_prop
grep -q '^PROP_INTERNAL_TOKEN=' .env.local || printf 'PROP_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^PROP_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'PROP_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_prop\1#')" >> .env.local
fi
# the Client Area and Back Office BFFs reach the prop service with the same token
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^PROP_URL=' "$f" || printf 'PROP_URL=http://127.0.0.1:8097\n' >> "$f"
  grep -q '^PROP_INTERNAL_TOKEN=' "$f" || printf 'PROP_INTERNAL_TOKEN=%s\n' "$(grep '^PROP_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# ALGO service secrets: internal token and API-key HMAC master generated once (never printed), database
# ezymex_algo. The AI assistant's Claude key is read from .env.claude (copied from the terminal's env if missing).
grep -q '^ALGO_INTERNAL_TOKEN=' .env.local || printf 'ALGO_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^ALGO_KEY_SECRET=' .env.local || printf 'ALGO_KEY_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^ALGO_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'ALGO_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_algo\1#')" >> .env.local
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
# ezymex_algo. The AI assistant's Claude key is read from .env.claude (copied from the terminal's env if missing).
grep -q '^ALGO_INTERNAL_TOKEN=' .env.local || printf 'ALGO_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
grep -q '^ALGO_KEY_SECRET=' .env.local || printf 'ALGO_KEY_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^ALGO_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'ALGO_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_algo\1#')" >> .env.local
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
# wallet secrets (never printed): internal token generated once, database ezymex_wallet next to the gateway's.
# Receiving addresses are seeded from WALLET_BSC_ADDRESS / WALLET_TRON_ADDRESS on the first start only (set them
# by hand in .env.local; nothing is seeded by default); after that they are an audited Back Office setting.
# TRONGRID_API_KEY comes from .env.tron when present.
grep -q '^WALLET_INTERNAL_TOKEN=' .env.local || printf 'WALLET_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^WALLET_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'WALLET_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_wallet\1#')" >> .env.local
fi
if ! grep -q '^TRONGRID_API_KEY=' .env.local && [ -f .env.tron ] && grep -q '^TRONGRID_API_KEY=' .env.tron; then
  grep '^TRONGRID_API_KEY=' .env.tron >> .env.local
fi
# the Client Area and Back Office BFFs reach the wallet with the same token
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^WALLET_URL=' "$f" || printf 'WALLET_URL=http://127.0.0.1:8095\n' >> "$f"
  grep -q '^WALLET_INTERNAL_TOKEN=' "$f" || printf 'WALLET_INTERNAL_TOKEN=%s\n' "$(grep '^WALLET_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# support + notifications service: internal token generated once (never printed), database ezymex_support,
# chat attachments stored privately under ~/.ezymex-data/support. The AI help bot's Claude key is read from
# .env.claude (see ALGO above); emails go through the same SMTP relay settings as the gateway (SMTP_*).
grep -q '^SUPPORT_INTERNAL_TOKEN=' .env.local || printf 'SUPPORT_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^SUPPORT_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'SUPPORT_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_support\1#')" >> .env.local
fi
grep -q '^SUPPORT_STORAGE_DIR=' .env.local || printf 'SUPPORT_STORAGE_DIR=%s\n' "$HOME/.ezymex-data/support" >> .env.local
grep -q '^SUPPORT_APP_URL=' .env.local || printf 'SUPPORT_APP_URL=https://app.ezymex.com\n' >> .env.local
install -d -m 700 "$(grep '^SUPPORT_STORAGE_DIR=' .env.local | cut -d= -f2-)"
# the Client Area, Back Office and Ezymex Trader BFFs reach the support service with the same token; browsers
# open the realtime stream at wss://<host>/support/stream (Caddy). Wallet, prop and IB push notifications with it too.
for app in apps/crm apps/admin apps/terminal; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^SUPPORT_URL=' "$f" || printf 'SUPPORT_URL=http://127.0.0.1:8100\n' >> "$f"
  grep -q '^SUPPORT_INTERNAL_TOKEN=' "$f" || printf 'SUPPORT_INTERNAL_TOKEN=%s\n' "$(grep '^SUPPORT_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# the Client Area's mobile AI routes (/api/mobile/trade/ai-trader, /options/explain) use the same Claude key
if ! grep -q '^ANTHROPIC_API_KEY=' apps/crm/.env.production.local 2>/dev/null && grep -q '^ANTHROPIC_API_KEY=' .env.claude 2>/dev/null; then
  (umask 077; touch apps/crm/.env.production.local; grep '^ANTHROPIC_API_KEY=' .env.claude >> apps/crm/.env.production.local)
fi
# growth (rewards + marketing) secrets: internal token generated once, database ezymex_growth next to the gateway's;
# the Client Area, Back Office and Ezymex Trader BFFs reach the service with the same token (Ezymex Trader: option share cards)
grep -q '^GROWTH_INTERNAL_TOKEN=' .env.local || printf 'GROWTH_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^GROWTH_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'GROWTH_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_growth\1#')" >> .env.local
fi
for app in apps/crm apps/admin apps/terminal; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^GROWTH_URL=' "$f" || printf 'GROWTH_URL=http://127.0.0.1:8101\n' >> "$f"
  grep -q '^GROWTH_INTERNAL_TOKEN=' "$f" || printf 'GROWTH_INTERNAL_TOKEN=%s\n' "$(grep '^GROWTH_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# reports (statements, analytics, broker reports) secrets: internal token generated once, database ezymex_reports next
# to the gateway's; scheduled report emails use the gateway's SMTP_* relay settings. The BFFs reach it with the same token.
grep -q '^REPORTS_INTERNAL_TOKEN=' .env.local || printf 'REPORTS_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^REPORTS_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'REPORTS_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_reports\1#')" >> .env.local
fi
for app in apps/crm apps/admin; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^REPORTS_URL=' "$f" || printf 'REPORTS_URL=http://127.0.0.1:8102\n' >> "$f"
  grep -q '^REPORTS_INTERNAL_TOKEN=' "$f" || printf 'REPORTS_INTERNAL_TOKEN=%s\n' "$(grep '^REPORTS_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# news + economic calendar service: internal token generated once (never printed), database ezymex_news next to
# the gateway's. Calendar reminders go through the support service (SUPPORT_INTERNAL_TOKEN); the daily AI brief
# reads the Claude key from .env.claude. The Client Area, Back Office and Ezymex Trader BFFs use the same token.
grep -q '^NEWS_INTERNAL_TOKEN=' .env.local || printf 'NEWS_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^NEWS_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'NEWS_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_news\1#')" >> .env.local
fi
for app in apps/crm apps/admin apps/terminal; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^NEWS_URL=' "$f" || printf 'NEWS_URL=http://127.0.0.1:8103\n' >> "$f"
  grep -q '^NEWS_INTERNAL_TOKEN=' "$f" || printf 'NEWS_INTERNAL_TOKEN=%s\n' "$(grep '^NEWS_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# Ezymex FX Options service: internal token generated once (never printed), database ezymex_options next to the
# gateway's. The trading engine (reads .env.local) and the Client Area, Back Office and Ezymex Trader BFFs use the same
# token. The module itself stays OFF per broker until switched on in the Back Office (tenant ezymex: demo only).
grep -q '^OPTIONS_INTERNAL_TOKEN=' .env.local || printf 'OPTIONS_INTERNAL_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env.local
if ! grep -q '^OPTIONS_DATABASE_URL=' .env.local && grep -q '^GATEWAY_DATABASE_URL=' .env.local; then
  printf 'OPTIONS_DATABASE_URL=%s\n' "$(grep '^GATEWAY_DATABASE_URL=' .env.local | cut -d= -f2- | sed -E 's#/[^/?]+([?].*)?$#/ezymex_options\1#')" >> .env.local
fi
grep -q '^OPTIONS_URL=' .env.local || printf 'OPTIONS_URL=http://127.0.0.1:8104\n' >> .env.local
for app in apps/crm apps/admin apps/terminal; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^OPTIONS_URL=' "$f" || printf 'OPTIONS_URL=http://127.0.0.1:8104\n' >> "$f"
  grep -q '^OPTIONS_INTERNAL_TOKEN=' "$f" || printf 'OPTIONS_INTERNAL_TOKEN=%s\n' "$(grep '^OPTIONS_INTERNAL_TOKEN=' .env.local | cut -d= -f2-)" >> "$f"
done
# the apps' public URLs, inlined at build time: market-data at the public edge (live quotes in the browser), Ezymex
# Trader (Trade links and sign-in hand-off), the Client Area (links back from the Trader and the Back Office) and the
# language cookie shared across the subdomains
for app in apps/crm apps/admin apps/terminal; do
  f="$app/.env.production.local"; touch "$f"
  grep -q '^NEXT_PUBLIC_MARKET_DATA_URL=' "$f" || printf 'NEXT_PUBLIC_MARKET_DATA_URL=https://api.ezymex.com\n' >> "$f"
  grep -q '^NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN=' "$f" || printf 'NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN=.ezymex.com\n' >> "$f"
done
f=apps/crm/.env.production.local
grep -q '^NEXT_PUBLIC_TERMINAL_URL=' "$f" || printf 'NEXT_PUBLIC_TERMINAL_URL=https://trade.ezymex.com\n' >> "$f"
grep -q '^NEXT_PUBLIC_APP_URL=' "$f" || printf 'NEXT_PUBLIC_APP_URL=https://app.ezymex.com\n' >> "$f"
f=apps/admin/.env.production.local
grep -q '^NEXT_PUBLIC_CRM_URL=' "$f" || printf 'NEXT_PUBLIC_CRM_URL=https://app.ezymex.com\n' >> "$f"
grep -q '^NEXT_PUBLIC_TRADE_URL=' "$f" || printf 'NEXT_PUBLIC_TRADE_URL=https://trade.ezymex.com\n' >> "$f"
f=apps/terminal/.env.production.local
grep -q '^NEXT_PUBLIC_CLIENT_AREA_URL=' "$f" || printf 'NEXT_PUBLIC_CLIENT_AREA_URL=https://app.ezymex.com\n' >> "$f"
pnpm turbo run build --filter=@ezymex/crm --filter=@ezymex/admin --filter=@ezymex/terminal --concurrency=1

# Installing the units / edge config and restarting needs root: done here when sudo works without a password,
# otherwise root runs deploy/install.sh next (the deploy user doesn't need sudo).
if sudo -n true 2>/dev/null; then
  sudo bash deploy/install.sh
else
  echo "Build done. Now as root: bash $PWD/deploy/install.sh"
fi

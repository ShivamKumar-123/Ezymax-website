#!/usr/bin/env bash
# Deploy the DEMO showcase (mock data, no sign-in) from a separate checkout at ~/kalks-demo.
# demo.kalkstrade.com / demo-trade.kalkstrade.com / demo-admin.kalkstrade.com → ports 4000 / 4002 / 4001.
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144
[ -d ~/kalks-demo/.git ] || git clone -q "$(git -C ~/kalks remote get-url origin)" ~/kalks-demo
cd ~/kalks-demo
git pull --ff-only
for app in crm admin terminal; do
  f=apps/$app/.env.production.local
  {
    echo "NEXT_PUBLIC_KALKS_MODE=demo"
    echo "NEXT_PUBLIC_MARKET_DATA_URL=https://api.kalkstrade.com"
    echo "NEXT_PUBLIC_TERMINAL_URL=https://demo-trade.kalkstrade.com"
    echo "NEXT_PUBLIC_CLIENT_AREA_URL=https://demo.kalkstrade.com"
  } > "$f"
done
# the mobile app (apps/mobile, Expo) is built with EAS, never on the server: skip its React Native toolchain
pnpm install --frozen-lockfile --filter '!@kalks/mobile'
pnpm turbo run build --filter=@kalks/crm --filter=@kalks/admin --filter=@kalks/terminal --concurrency=1
sudo cp ~/kalks/deploy/systemd/kalks-demo-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kalks-demo-crm kalks-demo-admin kalks-demo-terminal >/dev/null
sudo systemctl restart kalks-demo-crm kalks-demo-admin kalks-demo-terminal
sleep 5
for p in 4000 4001 4002; do printf "demo :%s %s\n" $p "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$p/login)"; done

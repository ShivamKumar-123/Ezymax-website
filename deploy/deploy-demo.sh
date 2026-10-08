#!/usr/bin/env bash
# Deploy the DEMO showcase (mock data, no sign-in) from a separate checkout at ~/ezymex-demo.
# demo.ezymex.com / demo-trade.ezymex.com / demo-admin.ezymex.com → ports 4000 / 4002 / 4001.
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144
[ -d ~/ezymex-demo/.git ] || git clone -q "$(git -C ~/ezymex remote get-url origin)" ~/ezymex-demo
cd ~/ezymex-demo
git pull --ff-only
for app in crm admin terminal; do
  f=apps/$app/.env.production.local
  {
    echo "NEXT_PUBLIC_EZYMEX_MODE=demo"
    echo "NEXT_PUBLIC_MARKET_DATA_URL=https://api.ezymex.com"
    echo "NEXT_PUBLIC_TERMINAL_URL=https://demo-trade.ezymex.com"
    echo "NEXT_PUBLIC_CLIENT_AREA_URL=https://demo.ezymex.com"
  } > "$f"
done
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@ezymex/crm --filter=@ezymex/admin --filter=@ezymex/terminal --concurrency=1
sudo cp ~/ezymex/deploy/systemd/ezymex-demo-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ezymex-demo-crm ezymex-demo-admin ezymex-demo-terminal >/dev/null
sudo systemctl restart ezymex-demo-crm ezymex-demo-admin ezymex-demo-terminal
sleep 5
for p in 4000 4001 4002; do printf "demo :%s %s\n" $p "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$p/login)"; done

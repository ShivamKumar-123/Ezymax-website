#!/usr/bin/env bash
# Deploy the current main branch on the Kalks VPS. Run as the `kalks` user:  ~/kalks/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source ~/.cargo/env
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=6144

git pull --ff-only
pnpm install --frozen-lockfile
cargo build --release -p market-data -p gateway
pnpm turbo run build --filter=@kalks/crm --filter=@kalks/admin --filter=@kalks/terminal --concurrency=1

# service units + edge config (idempotent)
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable kalks-market-data kalks-gateway kalks-crm kalks-admin kalks-terminal >/dev/null
sudo systemctl restart kalks-market-data kalks-gateway kalks-crm kalks-admin kalks-terminal
sudo systemctl reload caddy
sleep 5
for u in 127.0.0.1:8081/health 127.0.0.1:8080/health 127.0.0.1:3000/login 127.0.0.1:3001/login 127.0.0.1:3002/login; do
  printf "%-26s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' "http://$u")"
done

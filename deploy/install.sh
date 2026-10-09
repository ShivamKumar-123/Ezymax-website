#!/usr/bin/env bash
# Install what deploy.sh built: systemd units, the edge config (Caddy or nginx), restarts and health checks. Needs root;
# deploy.sh runs it itself when sudo works without a password, otherwise run it as root after deploy.sh:
#   bash /home/ezymex/ezymex/deploy/install.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || exec sudo bash "$0" "$@"
cd "$(dirname "$0")/.."

# market-data holds the price provider's WebSocket connections, which the provider limits per key and keeps
# counting for a while after a restart (reconnects are then refused with HTTP 429). So it restarts only when what it
# runs changed: its binary, its config inputs (instruments, holiday calendars, its unit file, its .env.local
# settings). The fingerprint of what it was last started with is kept in ~ezymex/.ezymex-deploy.
md_fingerprint() {
  {
    if [ -f target/release/market-data ]; then sha256sum target/release/market-data | cut -d' ' -f1; else echo no-binary; fi
    find config/instruments.json config/holidays -type f -print0 | sort -z | xargs -0 sha256sum
    sha256sum deploy/systemd/ezymex-market-data.service
    grep -E '^(INFOWAY_|MARKET_DATA_|INSTRUMENTS_FILE=|HOLIDAYS_DIR=|DATABASE_URL=|STORE_TICKS=|TICKS_RETENTION_HOURS=|BACKFILL_|RUST_LOG=)' .env.local 2>/dev/null | sha256sum
  } | sha256sum | cut -d' ' -f1
}
MD_FP_FILE="$(dirname "$PWD")/.ezymex-deploy/market-data.fingerprint"
mkdir -p "$(dirname "$MD_FP_FILE")"

# service units + edge config (idempotent)
sudo cp deploy/systemd/*.service /etc/systemd/system/
# edge: Caddy on a server of its own (deploy/Caddyfile, automatic HTTPS), else nginx behind Cloudflare with an origin
# certificate (deploy/nginx, when nginx already serves other sites on :80/:443)
if command -v caddy >/dev/null; then
  sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
  EDGE=caddy
else
  sudo cp deploy/nginx/ezymex-proxy.conf /etc/nginx/snippets/ezymex-proxy.conf
  sudo cp deploy/nginx/ezymex-platform.conf /etc/nginx/sites-enabled/ezymex-platform.conf
  sudo install -d -m 755 /srv/ezymex/downloads
  sudo nginx -t
  EDGE=nginx
fi
sudo systemctl daemon-reload
sudo systemctl enable ezymex-market-data ezymex-gateway ezymex-trading ezymex-ib ezymex-prop ezymex-crm ezymex-admin ezymex-terminal >/dev/null
md_now="$(md_fingerprint)"
if [ "$md_now" != "$(cat "$MD_FP_FILE" 2>/dev/null || true)" ]; then
  echo "market-data changed: restarting it (it closes its provider connections first)"
  sudo systemctl restart ezymex-market-data
  printf '%s\n' "$md_now" > "$MD_FP_FILE"
elif ! sudo systemctl is-active --quiet ezymex-market-data; then
  echo "market-data unchanged but not running: starting it"
  sudo systemctl start ezymex-market-data
else
  echo "market-data unchanged: not restarted (provider connections untouched)"
fi
sudo systemctl restart ezymex-gateway ezymex-trading ezymex-ib ezymex-prop ezymex-crm ezymex-admin ezymex-terminal
sudo systemctl enable ezymex-academy >/dev/null && sudo systemctl restart ezymex-academy
sudo systemctl enable ezymex-algo >/dev/null && sudo systemctl restart ezymex-algo
sudo systemctl enable ezymex-wallet >/dev/null && sudo systemctl restart ezymex-wallet
sudo systemctl enable ezymex-support >/dev/null && sudo systemctl restart ezymex-support
sudo systemctl enable ezymex-growth >/dev/null && sudo systemctl restart ezymex-growth
sudo systemctl enable ezymex-reports >/dev/null && sudo systemctl restart ezymex-reports
sudo systemctl enable ezymex-news >/dev/null && sudo systemctl restart ezymex-news
sudo systemctl enable ezymex-options >/dev/null && sudo systemctl restart ezymex-options
sudo systemctl enable ezymex-staking >/dev/null && sudo systemctl restart ezymex-staking
sudo systemctl reload "$EDGE" || echo "$EDGE reload timed out (long-lived connections); config is validated, continuing"
sleep 5
for u in 127.0.0.1:8081/health 127.0.0.1:8080/health 127.0.0.1:8090/health 127.0.0.1:8096/health 127.0.0.1:8097/health 127.0.0.1:3000/login 127.0.0.1:3001/login 127.0.0.1:3002/login; do
  printf "%-26s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' "http://$u")"
done
printf "%-26s %s\n" 127.0.0.1:8098/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8098/health)"
printf "%-26s %s\n" 127.0.0.1:8095/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8095/health)"
printf "%-26s %s\n" 127.0.0.1:8099/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/health)"
printf "%-26s %s\n" 127.0.0.1:8100/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/health)"
printf "%-26s %s\n" 127.0.0.1:8101/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8101/health)"
printf "%-26s %s\n" 127.0.0.1:8102/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8102/health)"
printf "%-26s %s\n" 127.0.0.1:8103/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8103/health)"
printf "%-26s %s\n" 127.0.0.1:8104/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8104/health)"
printf "%-26s %s\n" 127.0.0.1:8105/health "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8105/health)"

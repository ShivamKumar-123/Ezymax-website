#!/usr/bin/env bash
# Deploy the website (repo kalks-markets/kalks-website, cloned at ~/kalks-website). Run as `kalks` on the VPS.
set -euo pipefail
cd ~/kalks-website
git pull --ff-only
npm ci --no-audit --no-fund
cd apps/trader
npm ci --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=6144 npm run build
sudo cp ~/kalks/deploy/systemd/kalks-website.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kalks-website >/dev/null
sudo systemctl restart kalks-website
sleep 5
printf "website %s\n" "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/)"

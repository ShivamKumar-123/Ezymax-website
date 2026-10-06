#!/usr/bin/env bash
#
# Ezymex — install the white-label domain agent as a root cron job
# (runs every minute; the agent itself exits instantly when idle).
#
# Idempotent: rewrites /etc/cron.d/ezymex-wl-agent each run.
# Run once per server:  sudo ./scripts/install-wl-agent-cron.sh
set -euo pipefail

COMPOSE_DIR="${EZYMEX_DIR:-/opt/ezymex}"
SCRIPT="$COMPOSE_DIR/scripts/wl-domain-agent.sh"
CRON_FILE="/etc/cron.d/ezymex-wl-agent"
LOG="/var/log/ezymex-wl-agent.log"

[[ $EUID -eq 0 ]] || { echo "[install] run with sudo (nginx/certbot need root)"; exit 1; }
[[ -f "$SCRIPT" ]] || { echo "[install] $SCRIPT missing"; exit 1; }
[[ -f "$COMPOSE_DIR/.env" ]] || { echo "[install] $COMPOSE_DIR/.env missing"; exit 1; }

chmod +x "$SCRIPT"
touch "$LOG"

cat > "$CRON_FILE" <<EOF
# Ezymex white-label domain agent — provisions/tears down tenant
# nginx blocks + SSL certs. Managed by scripts/install-wl-agent-cron.sh.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * root EZYMEX_DIR=$COMPOSE_DIR $SCRIPT >> $LOG 2>&1
EOF
chmod 644 "$CRON_FILE"

echo "[install] agent installed: $CRON_FILE (runs every minute)"
echo "[install] log: $LOG"
echo "[install] test now with: sudo EZYMEX_DIR=$COMPOSE_DIR $SCRIPT && tail $LOG"

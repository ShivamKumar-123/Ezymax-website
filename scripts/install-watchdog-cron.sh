#!/usr/bin/env bash
#
# Install the SwissCresta health watchdog as a root cron job (every 5 min).
# Idempotent — rewrites /etc/cron.d/swisscresta-watchdog each run.
#
#   sudo ./scripts/install-watchdog-cron.sh
set -euo pipefail

COMPOSE_DIR="${SWISSCRESTA_DIR:-/opt/swisscresta}"
SCRIPT="$COMPOSE_DIR/scripts/health-watchdog.py"
CRON_FILE="/etc/cron.d/swisscresta-watchdog"
LOG="/var/log/swisscresta-watchdog.log"
LOGROTATE="/etc/logrotate.d/swisscresta-watchdog"

[[ $EUID -eq 0 ]] || { echo "[install] run with sudo"; exit 1; }
[[ -f "$SCRIPT" ]] || { echo "[install] $SCRIPT missing"; exit 1; }
[[ -f "$COMPOSE_DIR/.env" ]] || { echo "[install] $COMPOSE_DIR/.env missing"; exit 1; }

chmod +x "$SCRIPT"
touch "$LOG"

cat > "$CRON_FILE" <<EOF
# SwissCresta health watchdog — pages by email when the platform breaks.
# Managed by scripts/install-watchdog-cron.sh.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/5 * * * * root SWISSCRESTA_DIR=$COMPOSE_DIR /usr/bin/python3 $SCRIPT >> $LOG 2>&1
EOF
chmod 644 "$CRON_FILE"

cat > "$LOGROTATE" <<EOF
$LOG {
    weekly
    rotate 6
    compress
    missingok
    notifempty
    copytruncate
}
EOF
chmod 644 "$LOGROTATE"

echo "[install] watchdog installed: $CRON_FILE (every 5 minutes)"
echo "[install] log: $LOG (rotated weekly)"
echo "[install] send a test alert:  sudo python3 $SCRIPT --test-email"

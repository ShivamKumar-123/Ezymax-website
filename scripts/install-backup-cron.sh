#!/usr/bin/env bash
#
# FXArtha — install the daily backup cron entry for the current user.
#
# Idempotent: re-runs replace any prior fxartha backup line in the
# crontab so multiple invocations don't stack up duplicate jobs.
#
# Run once per server (typically as root, since `docker compose` and
# /var/log writes need root on a default Docker install).
set -euo pipefail

COMPOSE_DIR="${FXARTHA_DIR:-/opt/fxartha}"
SCRIPT="$COMPOSE_DIR/scripts/backup.sh"
LOG="/var/log/fxartha-backup.log"

[[ -x "$SCRIPT" ]] || { echo "[install] $SCRIPT not executable — chmod +x scripts/*.sh"; exit 1; }
[[ -f "$COMPOSE_DIR/.env" ]] || { echo "[install] $COMPOSE_DIR/.env missing"; exit 1; }

# 03:00 server time, daily. Source .env so BACKUP_* + POSTGRES_USER are
# visible to the script. Append output to a rotated log so cron failures
# are diagnosable.
LINE="0 3 * * * set -a; source $COMPOSE_DIR/.env; set +a; $SCRIPT >> $LOG 2>&1"

# Strip any prior fxartha line, then append the new one. The `|| true` keeps a
# fresh server (no existing crontab → `crontab -l` exits non-zero) from tripping
# `set -e -o pipefail` and aborting mid-subshell, which would leave the crontab
# empty and the job uninstalled.
( crontab -l 2>/dev/null | grep -v -F "$SCRIPT" || true; echo "$LINE" ) | crontab -

# Ensure the log file exists and is writable so the first run doesn't
# silently fail before we get a chance to tail it.
touch "$LOG"
chmod 0640 "$LOG"

echo "[install] crontab installed:"
crontab -l | grep "$SCRIPT" || true
echo
echo "[install] tail logs after the first cron run with:"
echo "  tail -f $LOG"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# ProTrader Database Backup Script
#
# Backs up both PostgreSQL (main) and TimescaleDB databases.
# Stores compressed dumps in a timestamped directory.
#
# Usage:
#   ./scripts/backup-db.sh                   # backup to ./backups/
#   ./scripts/backup-db.sh /mnt/backup       # backup to custom dir
#   BACKUP_RETAIN_DAYS=14 ./scripts/backup-db.sh  # keep 14 days
#
# Cron example (daily at 02:00):
#   0 2 * * * cd /opt/ptd2 && ./scripts/backup-db.sh /mnt/backup >> /var/log/ptd2-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TARGET="$BACKUP_DIR/$TIMESTAMP"

# DB credentials — read from .env or use defaults
POSTGRES_USER="${POSTGRES_USER:-protrader}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-protrader_dev}"
POSTGRES_DB="${POSTGRES_DB:-protrader}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5435}"

TIMESCALE_USER="${TIMESCALE_USER:-protrader}"
TIMESCALE_PASSWORD="${TIMESCALE_PASSWORD:-protrader_dev}"
TIMESCALE_DB="${TIMESCALE_DB:-marketdata}"
TIMESCALE_HOST="${TIMESCALE_HOST:-localhost}"
TIMESCALE_PORT="${TIMESCALE_PORT:-5433}"

echo "╔══════════════════════════════════════════════╗"
echo "║  ProTrader Database Backup — $TIMESTAMP  ║"
echo "╚══════════════════════════════════════════════╝"

mkdir -p "$TARGET"

# --- Main PostgreSQL ---
echo "[1/2] Backing up PostgreSQL ($POSTGRES_DB)..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --format=custom \
    --compress=9 \
    --file="$TARGET/protrader_main.dump" \
    2>&1

MAIN_SIZE=$(du -sh "$TARGET/protrader_main.dump" 2>/dev/null | cut -f1)
echo "    ✓ protrader_main.dump ($MAIN_SIZE)"

# --- TimescaleDB ---
echo "[2/2] Backing up TimescaleDB ($TIMESCALE_DB)..."
PGPASSWORD="$TIMESCALE_PASSWORD" pg_dump \
    -h "$TIMESCALE_HOST" \
    -p "$TIMESCALE_PORT" \
    -U "$TIMESCALE_USER" \
    -d "$TIMESCALE_DB" \
    --format=custom \
    --compress=9 \
    --file="$TARGET/protrader_timescale.dump" \
    2>&1

TS_SIZE=$(du -sh "$TARGET/protrader_timescale.dump" 2>/dev/null | cut -f1)
echo "    ✓ protrader_timescale.dump ($TS_SIZE)"

# --- Prune old backups ---
if [ "$RETAIN_DAYS" -gt 0 ]; then
    echo "Pruning backups older than $RETAIN_DAYS days..."
    find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +"$RETAIN_DAYS" -exec rm -rf {} + 2>/dev/null || true
fi

echo ""
echo "Backup complete → $TARGET"
echo "  Main DB:      $MAIN_SIZE"
echo "  TimescaleDB:  $TS_SIZE"

#!/usr/bin/env bash
#
# Daily Postgres backup with GFS rotation. Runs pg_dump inside the postgres
# container in custom format (compressed binary, restorable with pg_restore).
#
# Layout:
#   /opt/swisscresta/backups/db/daily/   — kept 14 days
#   /opt/swisscresta/backups/db/weekly/  — Sunday's daily, kept 8 weeks
#   /opt/swisscresta/backups/db/monthly/ — 1st-of-month, kept 12 months
#
# File names: swisscresta-YYYYMMDD-HHMMSS.dump, or .dump.gpg when
# BACKUP_GPG_PASSPHRASE is set (env, or the same key in $REPO_DIR/.env).
#
# Safety (ops hardening):
#   * single run at a time — flock on $BACKUP_ROOT/.backup.lock;
#   * the dump streams pg_dump → (gpg) → <file>.partial, so a plaintext copy
#     never touches disk when encryption is on (custom format is already
#     compressed, so there is no separate gzip stage);
#   * the .partial is verified (decrypt + `pg_restore --list` inside the
#     postgres container) BEFORE an atomic rename to the final name — a
#     truncated / corrupt dump never takes the place of a good one;
#   * a passphrase that is set while gpg is missing is a hard failure, never
#     a silent plaintext fallback.
#
# Cron (3:15 AM IST as the `swiss` user):
#   15 3 * * * /opt/swisscresta/deploy/scripts/backup-db.sh
#
# Restore with deploy/scripts/restore-db.sh <file>.
#
# Off-server copy (optional but recommended): rclone to Hostinger Object
# Storage / S3 / Backblaze. Set RCLONE_REMOTE in /opt/swisscresta/.env and
# uncomment the rclone block at the bottom.
set -euo pipefail
umask 077

REPO_DIR="${REPO_DIR:-/opt/swisscresta}"
BACKUP_ROOT="${BACKUP_ROOT:-$REPO_DIR/backups/db}"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"

STAMP=$(date +%Y%m%d-%H%M%S)
DOW=$(date +%u)        # 1..7, Mon..Sun
DOM=$(date +%d)        # 01..31
LOG="$BACKUP_ROOT/backup.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# ── Single-run lock ──────────────────────────────────────────────────────
if ! command -v flock >/dev/null 2>&1; then
  log "FAIL flock not installed (util-linux); refusing to run without a lock"
  exit 1
fi
exec 9>"$BACKUP_ROOT/.backup.lock"
if ! flock -n 9; then
  log "FAIL another backup-db.sh run holds $BACKUP_ROOT/.backup.lock; exiting"
  exit 1
fi

# ── Encryption passphrase ────────────────────────────────────────────────
# Read ONLY this one key from .env (strict KEY=VALUE parse, never `source`),
# so cron picks it up without executing anything embedded in the file.
GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"
if [ -z "$GPG_PASSPHRASE" ] && [ -f "$REPO_DIR/.env" ]; then
  _line=$(grep -E '^[[:space:]]*(export[[:space:]]+)?BACKUP_GPG_PASSPHRASE=' "$REPO_DIR/.env" | tail -n 1 || true)
  if [ -n "$_line" ]; then
    _val="${_line#*=}"; _val="${_val%$'\r'}"
    _val="${_val%\"}"; _val="${_val#\"}"; _val="${_val%\'}"; _val="${_val#\'}"
    GPG_PASSPHRASE="$_val"
  fi
  unset _line _val
fi

if [ -n "$GPG_PASSPHRASE" ]; then
  if ! command -v gpg >/dev/null 2>&1; then
    log "FAIL BACKUP_GPG_PASSPHRASE is set but gpg is not installed (apt-get install -y gnupg)"
    exit 1
  fi
  EXT="dump.gpg"
else
  EXT="dump"
fi

FILE="$BACKUP_ROOT/daily/swisscresta-$STAMP.$EXT"
PARTIAL="$FILE.partial"
PROMO_PARTIAL=""

cleanup() { rm -f "$PARTIAL" ${PROMO_PARTIAL:+"$PROMO_PARTIAL"}; }
trap cleanup EXIT

# Passphrase goes over an fd from a process substitution (a pipe) — never
# argv (visible in ps) and never a temp file.
gpg_encrypt() {
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --symmetric --cipher-algo AES256 --compress-algo none --output - \
    3< <(printf '%s' "$GPG_PASSPHRASE")
}
gpg_decrypt() {
  gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --decrypt 3< <(printf '%s' "$GPG_PASSPHRASE")
}

cd "$REPO_DIR"

log "starting pg_dump → $FILE"
# pg_dump inside the postgres container. -F c = custom (binary, compressed,
# parallel-restore-capable). Stream stdout to the host .partial file.
if [ -n "$GPG_PASSPHRASE" ]; then
  if ! $COMPOSE exec -T postgres sh -c \
      'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -F c "$POSTGRES_DB"' \
      | gpg_encrypt > "$PARTIAL"; then
    log "FAIL pg_dump/gpg errored; removing partial file"
    exit 1
  fi
else
  if ! $COMPOSE exec -T postgres sh -c \
      'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -F c "$POSTGRES_DB"' \
      > "$PARTIAL"; then
    log "FAIL pg_dump errored; removing partial file"
    exit 1
  fi
fi

SIZE=$(stat -c%s "$PARTIAL")
if [ "$SIZE" -lt 1024 ]; then
  log "FAIL dump is suspiciously small ($SIZE bytes); removing"
  exit 1
fi

# Verify: the archive must decrypt and its table of contents must parse.
# pg_restore runs in the postgres container (same version as pg_dump);
# --list reads only the TOC, so this is cheap and writes nothing.
if [ -n "$GPG_PASSPHRASE" ]; then
  verify_ok=1
  gpg_decrypt < "$PARTIAL" | $COMPOSE exec -T postgres pg_restore --list >/dev/null || verify_ok=0
else
  verify_ok=1
  $COMPOSE exec -T postgres pg_restore --list < "$PARTIAL" >/dev/null || verify_ok=0
fi
if [ "$verify_ok" -ne 1 ]; then
  log "FAIL verification (decrypt + pg_restore --list) failed; removing partial file"
  exit 1
fi

mv -f "$PARTIAL" "$FILE"
log "ok daily ($SIZE bytes, verified)"

# Promote to weekly on Sunday (DOW=7) and monthly on the 1st. Copy to a
# .partial in the target dir, then rename, so a half-written copy never
# carries the final name.
promote() {
  local dest="$BACKUP_ROOT/$1/swisscresta-$STAMP.$EXT"
  PROMO_PARTIAL="$dest.partial"
  cp -a "$FILE" "$PROMO_PARTIAL"
  mv -f "$PROMO_PARTIAL" "$dest"
  PROMO_PARTIAL=""
}
if [ "$DOW" = "7" ]; then
  promote weekly
  log "promoted → weekly"
fi
if [ "$DOM" = "01" ]; then
  promote monthly
  log "promoted → monthly"
fi

# Rotation. Mtime-based, not count-based, so a missed day doesn't shift the
# window. Numbers tuned for a small wallet DB; bump if disk pressure builds.
# Covers both plain (.dump) and encrypted (.dump.gpg) archives; stale
# .partial files from a killed run are swept after a day.
find "$BACKUP_ROOT/daily"   -type f \( -name 'swisscresta-*.dump' -o -name 'swisscresta-*.dump.gpg' \) -mtime +14 -delete
find "$BACKUP_ROOT/weekly"  -type f \( -name 'swisscresta-*.dump' -o -name 'swisscresta-*.dump.gpg' \) -mtime +56 -delete
find "$BACKUP_ROOT/monthly" -type f \( -name 'swisscresta-*.dump' -o -name 'swisscresta-*.dump.gpg' \) -mtime +365 -delete
find "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly" \
  -type f -name 'swisscresta-*.partial' -mtime +1 -delete
log "rotation done"

# ── Off-server upload (uncomment after configuring rclone) ───────────────
# if [ -n "${RCLONE_REMOTE:-}" ]; then
#   log "rclone sync → $RCLONE_REMOTE"
#   rclone sync "$BACKUP_ROOT" "$RCLONE_REMOTE" --exclude '*.partial' --exclude '.backup.lock' --log-file="$LOG"
# fi

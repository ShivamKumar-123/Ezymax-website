#!/usr/bin/env bash
#
# FXArtha — daily backup of Postgres + TimescaleDB + uploads/.
#
# Runs on the host (NOT inside a container) and shells into the running
# postgres / timescaledb containers via `docker compose exec` to take
# logical dumps with pg_dumpall. Output goes to the local `backups/`
# directory and (optionally) an `rclone` remote configured by the
# operator with `rclone config`.
#
# Designed to be invoked by host cron with the project's `.env` already
# sourced into the environment. See `scripts/install-backup-cron.sh`.
#
# Idempotent: safe to re-run on demand. Previous dumps are not touched
# except by the retention sweep.
set -euo pipefail

# ─── Config (overridable via env or .env) ─────────────────────────────
COMPOSE_DIR="${FXARTHA_DIR:-/opt/fxartha}"
DEST="${BACKUP_LOCAL_DIR:-${COMPOSE_DIR}/backups}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-14}"
# rclone remote — empty = local-only (NOT recommended for prod). Example: "b2:fxartha-backups"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
# GPG passphrase for symmetric encryption (`gpg --symmetric --cipher-algo
# AES256`). MUST be set in production — KYC documents, password hashes,
# and PII must never sit on disk or at the offsite remote in plaintext.
# Empty = unencrypted (loud warning). Generate with `openssl rand -hex 32`
# and store in a password manager — never the same file as the data.
GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"
STAMP="$(date +%Y-%m-%d_%H%M)"

# Colour-free, parsable log lines so cron output is easy to grep.
log() { printf '[backup %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# Encrypt $1 (path) in-place. If GPG_PASSPHRASE is empty, leaves the
# file untouched and logs a warning. Output replaces input on success.
encrypt_inplace() {
  local f="$1"
  if [[ -z "$GPG_PASSPHRASE" ]]; then
    log "WARN: BACKUP_GPG_PASSPHRASE not set — $f is plaintext (UNSAFE in prod)"
    return 0
  fi
  if ! command -v gpg >/dev/null; then
    log "WARN: gpg not installed — install with 'apt-get install -y gnupg'; $f stays plaintext"
    return 0
  fi
  local enc="$f.gpg"
  GPG_PASSPHRASE="$GPG_PASSPHRASE" gpg \
    --batch --yes --quiet --pinentry-mode loopback \
    --passphrase-fd 3 \
    --cipher-algo AES256 \
    --symmetric --output "$enc" "$f" 3<<<"$GPG_PASSPHRASE"
  rm -f "$f"
  log "encrypted → $enc"
}

mkdir -p "$DEST"
chmod 0700 "$DEST"
cd "$COMPOSE_DIR"

# ─── 1. Postgres ──────────────────────────────────────────────────────
DUMP="$DEST/postgres-$STAMP.sql.gz"
log "dumping postgres → $DUMP"
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T postgres pg_dumpall -U "${POSTGRES_USER:-fxartha}" \
  | gzip > "$DUMP"
encrypt_inplace "$DUMP"

# ─── 2. Uploads (KYC + manual deposit screenshots) ─────────────────────
UPLOADS="$DEST/uploads-$STAMP.tar.gz"
if [[ -d "$COMPOSE_DIR/uploads" ]]; then
  log "archiving uploads → $UPLOADS"
  tar czf "$UPLOADS" -C "$COMPOSE_DIR" uploads
  encrypt_inplace "$UPLOADS"
else
  log "no uploads/ directory — skipping"
fi

# ─── 3. TimescaleDB (separate DB, separate dump) ──────────────────────
# Skip cleanly if the timescaledb service isn't part of this deployment.
TS="$DEST/timescale-$STAMP.sql.gz"
if docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q timescaledb >/dev/null 2>&1 \
   && [[ -n "$(docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q timescaledb)" ]]; then
  log "dumping timescaledb → $TS"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T timescaledb pg_dumpall -U "${TIMESCALE_USER:-fxartha}" \
    | gzip > "$TS"
  encrypt_inplace "$TS"
else
  log "timescaledb not running — skipping"
fi

# ─── 4. Local retention ───────────────────────────────────────────────
log "purging local backups older than ${RETAIN_DAYS}d"
find "$DEST" \( -name "*.gz" -o -name "*.gz.gpg" \) -type f -mtime +"$RETAIN_DAYS" -delete

# ─── 5. Offsite mirror ────────────────────────────────────────────────
if [[ -n "$RCLONE_REMOTE" ]]; then
  if command -v rclone >/dev/null; then
    log "syncing to $RCLONE_REMOTE"
    rclone copy --transfers=2 --checkers=2 --quiet "$DEST" "$RCLONE_REMOTE/"
    # Mirror retention to remote — best-effort; an rclone failure here
    # must not fail the whole backup since the local dump is already on
    # disk and is the more important artefact.
    rclone delete --min-age "${RETAIN_DAYS}d" "$RCLONE_REMOTE/" --quiet || true
  else
    log "WARN: BACKUP_RCLONE_REMOTE is set but rclone is not installed; skipping offsite sync"
  fi
else
  log "BACKUP_RCLONE_REMOTE not set — local-only backup (NOT safe for prod)"
fi

log "done in ${SECONDS}s"

#!/usr/bin/env bash
#
# Ezymex — daily backup of Postgres + TimescaleDB + uploads/.
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
#
# Safety: one run at a time (flock on $DEST/.backup.lock); each artefact is
# streamed producer → gzip → gpg → <name>.partial (plaintext never on disk
# when BACKUP_GPG_PASSPHRASE is set), verified by decrypt + `gzip -t`, then
# renamed atomically. A passphrase set while gpg is missing is fatal.
set -euo pipefail

# ─── Config (overridable via env or .env) ─────────────────────────────
COMPOSE_DIR="${EZYMEX_DIR:-/opt/ezymex}"

# H-INF-2: load .env WITHOUT `source` — sourcing executes any command
# substitution / backticks embedded in a value (arbitrary code as whoever runs
# cron). Parse strict KEY=VALUE lines only; ignore everything else.
load_env_file() {
  local f="$1"; [[ -f "$f" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    line="${line#"${line%%[![:space:]]*}"}"      # ltrim
    [[ "$line" == export\ * ]] && line="${line#export }"
    key="${line%%=*}"; val="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    export "$key=$val"
  done < "$f"
}
load_env_file "$COMPOSE_DIR/.env"

DEST="${BACKUP_LOCAL_DIR:-${COMPOSE_DIR}/backups}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-14}"
# rclone remote — empty = local-only (NOT recommended for prod). Example: "b2:ezymex-backups"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
# GPG passphrase for symmetric encryption (`gpg --symmetric --cipher-algo
# AES256`). MUST be set in production — KYC documents, password hashes,
# and PII must never sit on disk or at the offsite remote in plaintext.
# Empty = unencrypted (loud warning). Generate with `openssl rand -hex 32`
# and store in a password manager — never the same file as the data.
GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"
STAMP="$(date +%Y-%m-%d_%H%M)"

# H-INF-4: in production, refuse to run without encryption. KYC docs, password
# hashes and PII must never be written to disk / the offsite remote in
# plaintext. Fail loudly at the top rather than silently producing an
# unencrypted dump.
if [[ "${ENVIRONMENT:-}" == "production" && -z "$GPG_PASSPHRASE" ]]; then
  echo "[backup] FATAL: ENVIRONMENT=production but BACKUP_GPG_PASSPHRASE is unset." >&2
  echo "[backup] Set a strong passphrase (openssl rand -hex 32) before backing up." >&2
  exit 1
fi

# Colour-free, parsable log lines so cron output is easy to grep.
log() { printf '[backup %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# A passphrase that is set but cannot be used is a hard failure — the old
# behaviour (warn, keep the dump in plaintext) silently wrote PII to disk.
if [[ -n "$GPG_PASSPHRASE" ]] && ! command -v gpg >/dev/null 2>&1; then
  echo "[backup] FATAL: BACKUP_GPG_PASSPHRASE is set but gpg is not installed (apt-get install -y gnupg)." >&2
  exit 1
fi
if [[ -z "$GPG_PASSPHRASE" ]]; then
  log "WARN: BACKUP_GPG_PASSPHRASE not set — dumps are plaintext (UNSAFE in prod)"
fi

mkdir -p "$DEST"
chmod 0700 "$DEST"
umask 077
cd "$COMPOSE_DIR"

# ─── Single-run lock ──────────────────────────────────────────────────
command -v flock >/dev/null 2>&1 || { echo "[backup] FATAL: flock (util-linux) not installed" >&2; exit 1; }
exec 9>"$DEST/.backup.lock"
if ! flock -n 9; then
  echo "[backup] FATAL: another backup.sh run holds $DEST/.backup.lock" >&2
  exit 1
fi

# The artefact currently being written; removed by the EXIT trap if the
# run dies before the verified rename.
CURRENT_PARTIAL=""
trap 'if [[ -n "$CURRENT_PARTIAL" ]]; then rm -f "$CURRENT_PARTIAL"; fi' EXIT

# Passphrase over an fd from a process substitution (a pipe) — never argv
# (visible in ps) and never a temp file.
gpg_encrypt() {
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --symmetric --cipher-algo AES256 --compress-algo none --output - \
    3< <(printf '%s' "$GPG_PASSPHRASE")
}
gpg_decrypt() {
  gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --decrypt 3< <(printf '%s' "$GPG_PASSPHRASE")
}

# write_artifact <final-name-without-.gpg> <producer-fn>
# The producer writes a gzip stream to stdout. It is piped (through gpg when
# a passphrase is set) into <final>.partial — plaintext never touches disk —
# then verified (decrypt + gzip -t) and atomically renamed into place.
write_artifact() {
  local final="$1" producer="$2" out
  out="$final"
  [[ -n "$GPG_PASSPHRASE" ]] && out="$final.gpg"
  CURRENT_PARTIAL="$out.partial"
  local wrote=1
  if [[ -n "$GPG_PASSPHRASE" ]]; then
    "$producer" | gpg_encrypt > "$CURRENT_PARTIAL" || wrote=0
  else
    "$producer" > "$CURRENT_PARTIAL" || wrote=0
  fi
  if [[ "$wrote" -ne 1 ]]; then
    log "FAIL writing $out ($producer errored); partial removed"
    exit 1
  fi
  local ok=1
  if [[ -n "$GPG_PASSPHRASE" ]]; then
    gpg_decrypt < "$CURRENT_PARTIAL" | gzip -t || ok=0
  else
    gzip -t < "$CURRENT_PARTIAL" || ok=0
  fi
  if [[ "$ok" -ne 1 ]]; then
    log "FAIL verification of $out (decrypt + gzip -t) failed"
    exit 1
  fi
  mv -f "$CURRENT_PARTIAL" "$out"
  CURRENT_PARTIAL=""
  log "verified → $out"
}

dump_postgres() {
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T postgres pg_dumpall -U "${POSTGRES_USER:-ezymex}" \
    | gzip
}
archive_uploads() {
  tar czf - -C "$COMPOSE_DIR" uploads
}
dump_timescale() {
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T timescaledb pg_dumpall -U "${TIMESCALE_USER:-ezymex}" \
    | gzip
}

# ─── 1. Postgres ──────────────────────────────────────────────────────
DUMP="$DEST/postgres-$STAMP.sql.gz"
log "dumping postgres → $DUMP"
write_artifact "$DUMP" dump_postgres

# ─── 2. Uploads (KYC + manual deposit screenshots) ─────────────────────
UPLOADS="$DEST/uploads-$STAMP.tar.gz"
if [[ -d "$COMPOSE_DIR/uploads" ]]; then
  log "archiving uploads → $UPLOADS"
  write_artifact "$UPLOADS" archive_uploads
else
  log "no uploads/ directory — skipping"
fi

# ─── 3. TimescaleDB (separate DB, separate dump) ──────────────────────
# Skip cleanly if the timescaledb service isn't part of this deployment.
TS="$DEST/timescale-$STAMP.sql.gz"
if docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q timescaledb >/dev/null 2>&1 \
   && [[ -n "$(docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q timescaledb)" ]]; then
  log "dumping timescaledb → $TS"
  write_artifact "$TS" dump_timescale
else
  log "timescaledb not running — skipping"
fi

# ─── 4. Local retention ───────────────────────────────────────────────
log "purging local backups older than ${RETAIN_DAYS}d"
find "$DEST" \( -name "*.gz" -o -name "*.gz.gpg" \) -type f -mtime +"$RETAIN_DAYS" -delete
# Stale .partial files from a killed run (never verified — not backups).
find "$DEST" -name "*.partial" -type f -mtime +1 -delete

# ─── 5. Offsite mirror ────────────────────────────────────────────────
if [[ -n "$RCLONE_REMOTE" ]]; then
  if command -v rclone >/dev/null; then
    log "syncing to $RCLONE_REMOTE"
    rclone copy --transfers=2 --checkers=2 --quiet \
      --exclude "*.partial" --exclude ".backup.lock" "$DEST" "$RCLONE_REMOTE/"
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

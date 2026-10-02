#!/usr/bin/env bash
#
# Restore a Postgres dump produced by backup-db.sh. DESTRUCTIVE — drops and
# recreates every object in the target database. Requires explicit YES.
#
# Accepts both plain custom-format dumps (.dump) and encrypted ones
# (.dump.gpg, written when BACKUP_GPG_PASSPHRASE is set). Encrypted dumps are
# decrypted as a stream straight into pg_restore — no plaintext temp file.
#
# Usage:
#   deploy/scripts/restore-db.sh /opt/swisscresta/backups/db/daily/swisscresta-YYYYMMDD-HHMMSS.dump
#   BACKUP_GPG_PASSPHRASE=... deploy/scripts/restore-db.sh .../swisscresta-YYYYMMDD-HHMMSS.dump.gpg
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/swisscresta}"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 <dump-file>" >&2
  exit 2
fi

case "$FILE" in
  *.partial)
    echo "Refusing to restore $FILE: .partial files are unverified / incomplete." >&2
    exit 2 ;;
esac

ENCRYPTED=0
case "$FILE" in *.gpg) ENCRYPTED=1 ;; esac

GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"
if [ "$ENCRYPTED" -eq 1 ]; then
  # Same strict single-key .env lookup as backup-db.sh (never `source`).
  if [ -z "$GPG_PASSPHRASE" ] && [ -f "$REPO_DIR/.env" ]; then
    _line=$(grep -E '^[[:space:]]*(export[[:space:]]+)?BACKUP_GPG_PASSPHRASE=' "$REPO_DIR/.env" | tail -n 1 || true)
    if [ -n "$_line" ]; then
      _val="${_line#*=}"; _val="${_val%$'\r'}"
      _val="${_val%\"}"; _val="${_val#\"}"; _val="${_val%\'}"; _val="${_val#\'}"
      GPG_PASSPHRASE="$_val"
    fi
    unset _line _val
  fi
  [ -n "$GPG_PASSPHRASE" ] || { echo "$FILE is encrypted but BACKUP_GPG_PASSPHRASE is not set" >&2; exit 2; }
  command -v gpg >/dev/null 2>&1 || { echo "gpg is required to decrypt $FILE" >&2; exit 2; }
fi

echo "About to restore: $FILE"
echo "Target: postgres container at $REPO_DIR"
echo "This will DROP existing tables and replace them with the dump's contents."
read -r -p "Type 'YES' to proceed: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "Aborted."; exit 1; }

cd "$REPO_DIR"

# Plain dump → stdout, or decrypted stream → stdout.
emit_dump() {
  if [ "$ENCRYPTED" -eq 1 ]; then
    gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
      --decrypt "$FILE" 3< <(printf '%s' "$GPG_PASSPHRASE")
  else
    cat "$FILE"
  fi
}

# Stream the dump into pg_restore inside the postgres container.
# --clean --if-exists makes the restore idempotent against a populated DB.
# --no-owner avoids "role does not exist" noise when restoring across envs.
emit_dump | $COMPOSE exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Restore complete. You should restart any service that caches DB state:"
echo "  $COMPOSE restart gateway admin-api"

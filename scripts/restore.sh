#!/usr/bin/env bash
#
# Ezymex — restore Postgres (and optionally uploads + timescaledb) from
# backup files produced by scripts/backup.sh.
#
# Usage:
#   scripts/restore.sh <postgres.sql.gz> [<uploads.tar.gz>] [<timescale.sql.gz>]
#
# Example:
#   scripts/restore.sh \
#     backups/postgres-2026-05-02_0300.sql.gz \
#     backups/uploads-2026-05-02_0300.tar.gz \
#     backups/timescale-2026-05-02_0300.sql.gz
#
# Encrypted artefacts (*.gpg) are accepted as well; set BACKUP_GPG_PASSPHRASE.
# They are decrypted as a stream straight into psql / tar — no plaintext copy
# is written to disk. *.partial files (unverified, from an interrupted
# backup) are refused.
#
# Brings only the postgres / timescaledb containers up before piping the
# dump in — the rest of the stack stays down so app services don't write
# into the DB while it's being restored. After this script exits the
# operator brings everything else back up with the standard compose
# command (printed at the end).
set -euo pipefail

DUMP="${1:?postgres dump path required (e.g. backups/postgres-...sql.gz or .sql.gz.gpg)}"
UPLOADS="${2:-}"
TS_DUMP="${3:-}"
COMPOSE_DIR="${EZYMEX_DIR:-/opt/ezymex}"
GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"

[[ -f "$DUMP" ]] || { echo "[restore] $DUMP not found"; exit 1; }
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || { echo "[restore] $UPLOADS not found"; exit 1; }
[[ -z "$TS_DUMP" || -f "$TS_DUMP" ]] || { echo "[restore] $TS_DUMP not found"; exit 1; }

# Validate every input up front (before the confirmation prompt) so a
# missing passphrase / gpg can't abort the restore half-way through.
for f in "$DUMP" "$UPLOADS" "$TS_DUMP"; do
  [[ -n "$f" ]] || continue
  if [[ "$f" == *.partial ]]; then
    echo "[restore] $f is a .partial (unverified / incomplete) file — refusing"; exit 1
  fi
  if [[ "$f" == *.gpg ]]; then
    [[ -n "$GPG_PASSPHRASE" ]] || { echo "[restore] $f is encrypted but BACKUP_GPG_PASSPHRASE is not set"; exit 1; }
    command -v gpg >/dev/null || { echo "[restore] gpg required to decrypt $f"; exit 1; }
  fi
done

# Write $1 to stdout, decrypting first if it ends in .gpg. Used
# transparently below so the rest of the restore stays the same whether or
# not encryption was on. The passphrase goes over an fd from a process
# substitution (a pipe) — never argv, never a temp file.
decrypt_stream() {
  local src="$1"
  if [[ "$src" == *.gpg ]]; then
    gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
      --decrypt "$src" 3< <(printf '%s' "$GPG_PASSPHRASE")
  else
    cat "$src"
  fi
}

cd "$COMPOSE_DIR"

echo
echo "[restore] target stack:    $COMPOSE_DIR"
echo "[restore] postgres dump:   $DUMP"
[[ -n "$UPLOADS" ]] && echo "[restore] uploads tarball: $UPLOADS"
[[ -n "$TS_DUMP" ]] && echo "[restore] timescale dump:  $TS_DUMP"
echo
read -r -p "[restore] this will OVERWRITE the running database. Continue? (yes/N) " ans
[[ "$ans" == "yes" ]] || { echo "aborted"; exit 1; }

# ─── Postgres ─────────────────────────────────────────────────────────
echo "[restore] starting postgres alone"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres
# pg_isready loop — wait up to 30s for the container's healthcheck
for i in $(seq 1 30); do
  if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
       pg_isready -U "${POSTGRES_USER:-ezymex}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[restore] piping (decrypted) $DUMP → psql"
decrypt_stream "$DUMP" | gunzip -c | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T postgres psql -U "${POSTGRES_USER:-ezymex}" -d postgres -v ON_ERROR_STOP=1

# ─── TimescaleDB (optional) ───────────────────────────────────────────
if [[ -n "$TS_DUMP" ]]; then
  echo "[restore] starting timescaledb alone"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d timescaledb
  for i in $(seq 1 30); do
    if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T timescaledb \
         pg_isready -U "${TIMESCALE_USER:-ezymex}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  echo "[restore] piping (decrypted) $TS_DUMP → timescale psql"
  decrypt_stream "$TS_DUMP" | gunzip -c | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T timescaledb psql -U "${TIMESCALE_USER:-ezymex}" -d postgres -v ON_ERROR_STOP=1
fi

# ─── Uploads (optional) ───────────────────────────────────────────────
if [[ -n "$UPLOADS" ]]; then
  echo "[restore] extracting (decrypted) $UPLOADS → $COMPOSE_DIR"
  decrypt_stream "$UPLOADS" | tar xzf - -C "$COMPOSE_DIR"
fi

echo
echo "[restore] DB + files restored. Bring the rest of the stack up with:"
echo
echo "  cd $COMPOSE_DIR && \\"
echo "  APP_VERSION=\$(date +%s) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo

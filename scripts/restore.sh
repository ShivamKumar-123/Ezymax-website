#!/usr/bin/env bash
#
# FXArtha — restore Postgres (and optionally uploads + timescaledb) from
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
# Brings only the postgres / timescaledb containers up before piping the
# dump in — the rest of the stack stays down so app services don't write
# into the DB while it's being restored. After this script exits the
# operator brings everything else back up with the standard compose
# command (printed at the end).
set -euo pipefail

DUMP="${1:?postgres dump path required (e.g. backups/postgres-...sql.gz or .sql.gz.gpg)}"
UPLOADS="${2:-}"
TS_DUMP="${3:-}"
COMPOSE_DIR="${FXARTHA_DIR:-/opt/fxartha}"
GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"

[[ -f "$DUMP" ]] || { echo "[restore] $DUMP not found"; exit 1; }
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || { echo "[restore] $UPLOADS not found"; exit 1; }
[[ -z "$TS_DUMP" || -f "$TS_DUMP" ]] || { echo "[restore] $TS_DUMP not found"; exit 1; }

# Decrypt $1 if it ends in .gpg, write plaintext to $2. Otherwise just
# copy the file path through. Used transparently below so the rest of
# the restore stays the same whether or not encryption was on.
decrypt_to() {
  local src="$1" dst="$2"
  if [[ "$src" == *.gpg ]]; then
    [[ -n "$GPG_PASSPHRASE" ]] || { echo "[restore] $src is encrypted but BACKUP_GPG_PASSPHRASE is not set"; exit 1; }
    command -v gpg >/dev/null || { echo "[restore] gpg required to decrypt $src"; exit 1; }
    GPG_PASSPHRASE="$GPG_PASSPHRASE" gpg --batch --yes --quiet --pinentry-mode loopback \
      --passphrase-fd 3 --decrypt --output "$dst" "$src" 3<<<"$GPG_PASSPHRASE"
  else
    cp "$src" "$dst"
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
       pg_isready -U "${POSTGRES_USER:-fxartha}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

TMP_PG=$(mktemp --suffix=.sql.gz)
# Pre-init so the EXIT trap doesn't hit `set -u` when TS/uploads aren't given.
TMP_TS=""
TMP_UP=""
trap 'rm -f "$TMP_PG" "$TMP_TS" "$TMP_UP"' EXIT
decrypt_to "$DUMP" "$TMP_PG"

# A fresh postgres (entrypoint + init-db.sql) pre-creates the role/db/schema.
# A full pg_dumpall then collides with that (CREATE ROLE/DATABASE/tables) and —
# worse — the pre-existing FK constraints get enforced mid-COPY, producing
# "violates foreign key constraint" errors and a partial restore. Drop the
# target DB first so the dump rebuilds it cleanly in dependency order
# (schema → data → constraints). Roles are cluster-global; the dump's
# "role already exists" is harmless, so ON_ERROR_STOP is omitted for this
# full-cluster load.
PGDB="${POSTGRES_DB:-fxartha}"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-fxartha}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$PGDB' AND pid<>pg_backend_pid();" >/dev/null 2>&1 || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-fxartha}" -d postgres -c "DROP DATABASE IF EXISTS $PGDB;"

echo "[restore] piping (decrypted) $DUMP → psql"
gunzip -c "$TMP_PG" | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T postgres psql -U "${POSTGRES_USER:-fxartha}" -d postgres

# ─── TimescaleDB (optional) ───────────────────────────────────────────
if [[ -n "$TS_DUMP" ]]; then
  echo "[restore] starting timescaledb alone"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d timescaledb
  for i in $(seq 1 30); do
    if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T timescaledb \
         pg_isready -U "${TIMESCALE_USER:-fxartha}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  TMP_TS=$(mktemp --suffix=.sql.gz)
  decrypt_to "$TS_DUMP" "$TMP_TS"
  echo "[restore] piping (decrypted) $TS_DUMP → timescale psql"
  gunzip -c "$TMP_TS" | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T timescaledb psql -U "${TIMESCALE_USER:-fxartha}" -d postgres -v ON_ERROR_STOP=1
fi

# ─── Uploads (optional) ───────────────────────────────────────────────
if [[ -n "$UPLOADS" ]]; then
  TMP_UP=$(mktemp --suffix=.tar.gz)
  decrypt_to "$UPLOADS" "$TMP_UP"
  echo "[restore] extracting (decrypted) $UPLOADS → $COMPOSE_DIR"
  tar xzf "$TMP_UP" -C "$COMPOSE_DIR"
fi

echo
echo "[restore] DB + files restored. Bring the rest of the stack up with:"
echo
echo "  cd $COMPOSE_DIR && \\"
echo "  APP_VERSION=\$(date +%s) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo

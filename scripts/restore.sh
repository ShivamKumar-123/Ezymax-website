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

DUMP="${1:?postgres dump path required (e.g. backups/postgres-...sql.gz)}"
UPLOADS="${2:-}"
TS_DUMP="${3:-}"
COMPOSE_DIR="${FXARTHA_DIR:-/opt/fxartha}"

[[ -f "$DUMP" ]] || { echo "[restore] $DUMP not found"; exit 1; }
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || { echo "[restore] $UPLOADS not found"; exit 1; }
[[ -z "$TS_DUMP" || -f "$TS_DUMP" ]] || { echo "[restore] $TS_DUMP not found"; exit 1; }

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

echo "[restore] piping $DUMP → psql"
gunzip -c "$DUMP" | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T postgres psql -U "${POSTGRES_USER:-fxartha}" -d postgres -v ON_ERROR_STOP=1

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
  echo "[restore] piping $TS_DUMP → timescale psql"
  gunzip -c "$TS_DUMP" | docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec -T timescaledb psql -U "${TIMESCALE_USER:-fxartha}" -d postgres -v ON_ERROR_STOP=1
fi

# ─── Uploads (optional) ───────────────────────────────────────────────
if [[ -n "$UPLOADS" ]]; then
  echo "[restore] extracting $UPLOADS → $COMPOSE_DIR"
  tar xzf "$UPLOADS" -C "$COMPOSE_DIR"
fi

echo
echo "[restore] DB + files restored. Bring the rest of the stack up with:"
echo
echo "  cd $COMPOSE_DIR && \\"
echo "  APP_VERSION=\$(date +%s) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo

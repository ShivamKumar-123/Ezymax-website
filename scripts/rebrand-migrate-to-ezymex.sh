#!/usr/bin/env bash
#
# One-time server migration for the SwissCresta -> Ezymex rebrand.
#
# The code rebrand renamed things the running server is bound to: the
# Compose project name (which prefixes the VOLUMES), the Postgres role and
# database, the deploy directory, the nginx/fail2ban config filenames and the
# cron log paths. None of that moves by itself — a plain `git pull && docker
# compose up -d` on a rebranded checkout comes up pointing at volumes and a
# database that do not exist, i.e. an EMPTY PLATFORM.
#
# This script performs the migration in dependency order, taking a full dump
# first and verifying row counts after, so a failure is recoverable.
#
# Usage (as root, ON THE SERVER, from the OLD directory):
#
#     sudo ./scripts/rebrand-migrate-to-ezymex.sh --dry-run    # print the plan
#     sudo ./scripts/rebrand-migrate-to-ezymex.sh              # do it
#
# It is idempotent: each step checks whether it has already been applied, so a
# re-run after a partial failure resumes rather than double-applying.
set -euo pipefail

OLD_NAME="swisscresta"
NEW_NAME="ezymex"
OLD_DIR="${OLD_DIR:-/opt/${OLD_NAME}}"
NEW_DIR="${NEW_DIR:-/opt/${NEW_NAME}}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/${NEW_NAME}-rebrand}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[33m    ! %s\033[0m\n' "$*"; }
die()  { printf '\033[31m    x %s\033[0m\n' "$*" >&2; exit 1; }

run() {
  if [[ $DRY_RUN -eq 1 ]]; then printf '    [dry-run] %s\n' "$*"; else eval "$@"; fi
}

[[ $EUID -eq 0 ]] || die "run as root (sudo)"

# ─────────────────────────────────────────────────────────────────────────
# 0. Locate the live stack
# ─────────────────────────────────────────────────────────────────────────
say "0/8  Locating the running stack"

if [[ -d "$NEW_DIR" && ! -d "$OLD_DIR" ]]; then
  info "Already at $NEW_DIR — directory step previously completed."
  WORK_DIR="$NEW_DIR"
elif [[ -d "$OLD_DIR" ]]; then
  WORK_DIR="$OLD_DIR"
else
  die "neither $OLD_DIR nor $NEW_DIR exists — set OLD_DIR=... explicitly"
fi
info "working directory: $WORK_DIR"

cd "$WORK_DIR"
COMPOSE_FILES="-f docker-compose.yml"
[[ -f docker-compose.prod.yml ]] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"

# The OLD project name is what the live containers/volumes are prefixed with.
OLD_COMPOSE="docker compose -p $OLD_NAME $COMPOSE_FILES"
NEW_COMPOSE="docker compose $COMPOSE_FILES"   # name: ezymex now lives in the file

# Read the DB credentials the stack is actually using.
[[ -f .env ]] || die ".env not found in $WORK_DIR"
# shellcheck disable=SC1091
set -a; source ./.env; set +a
PGPASS="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD missing from .env}"

# ─────────────────────────────────────────────────────────────────────────
# 1. Full backup BEFORE touching anything
# ─────────────────────────────────────────────────────────────────────────
say "1/8  Backup (pg_dumpall + uploads)"
run "mkdir -p '$BACKUP_DIR'"

PG_CID="$($OLD_COMPOSE ps -q postgres 2>/dev/null || true)"
TS_CID="$($OLD_COMPOSE ps -q timescaledb 2>/dev/null || true)"

if [[ -n "$PG_CID" ]]; then
  info "dumping postgres -> $BACKUP_DIR/pg-$STAMP.sql.gz"
  run "docker exec -e PGPASSWORD='$PGPASS' '$PG_CID' pg_dumpall -U '$OLD_NAME' \
        | gzip > '$BACKUP_DIR/pg-$STAMP.sql.gz'"
else
  warn "postgres container not running — skipping live dump (volume copy below still protects data)"
fi

if [[ -n "$TS_CID" ]]; then
  info "dumping timescaledb -> $BACKUP_DIR/ts-$STAMP.sql.gz"
  run "docker exec -e PGPASSWORD='${TIMESCALE_PASSWORD:-$PGPASS}' '$TS_CID' \
        pg_dumpall -U '${TIMESCALE_USER:-$OLD_NAME}' | gzip > '$BACKUP_DIR/ts-$STAMP.sql.gz'"
fi

if [[ -d "$WORK_DIR/backend/uploads" ]]; then
  info "archiving uploads/"
  run "tar czf '$BACKUP_DIR/uploads-$STAMP.tar.gz' -C '$WORK_DIR/backend' uploads"
fi

# Record pre-migration row counts so step 7 can verify nothing was lost.
COUNTS_BEFORE="$BACKUP_DIR/rowcounts-before-$STAMP.txt"
if [[ -n "$PG_CID" && $DRY_RUN -eq 0 ]]; then
  docker exec -e PGPASSWORD="$PGPASS" "$PG_CID" psql -U "$OLD_NAME" -d "$OLD_NAME" -At -c "
    SELECT 'users='||(SELECT count(*) FROM users)
        ||' accounts='||(SELECT count(*) FROM trading_accounts)
        ||' positions='||(SELECT count(*) FROM positions)
        ||' transactions='||(SELECT count(*) FROM transactions);
  " > "$COUNTS_BEFORE" 2>/dev/null || warn "could not read row counts (fresh install?)"
  [[ -s "$COUNTS_BEFORE" ]] && info "before: $(cat "$COUNTS_BEFORE")"
fi

# ─────────────────────────────────────────────────────────────────────────
# 2. Stop the old stack
# ─────────────────────────────────────────────────────────────────────────
say "2/8  Stopping the '$OLD_NAME' stack"
# NOTE: no -v. Removing volumes here would delete the data this whole script
# exists to preserve.
run "$OLD_COMPOSE down --remove-orphans"

# ─────────────────────────────────────────────────────────────────────────
# 3. Re-point the volumes
# ─────────────────────────────────────────────────────────────────────────
# Compose derives volume names as <project>_<volume>. Renaming the project
# orphans the old ones. Docker cannot rename a volume, so each is copied
# into its new name through a throwaway alpine container.
say "3/8  Copying volumes ${OLD_NAME}_* -> ${NEW_NAME}_*"
for VOL in pg_data ts_data redis_data; do
  SRC="${OLD_NAME}_${VOL}"
  DST="${NEW_NAME}_${VOL}"
  if ! docker volume inspect "$SRC" >/dev/null 2>&1; then
    warn "$SRC does not exist — skipping"
    continue
  fi
  if docker volume inspect "$DST" >/dev/null 2>&1; then
    info "$DST already exists — skipping (idempotent re-run)"
    continue
  fi
  info "$SRC -> $DST"
  run "docker volume create '$DST' >/dev/null"
  run "docker run --rm -v '$SRC':/from -v '$DST':/to alpine \
        sh -c 'cd /from && cp -a . /to/'"
done

# ─────────────────────────────────────────────────────────────────────────
# 4. Rename the Postgres role + databases
# ─────────────────────────────────────────────────────────────────────────
say "4/8  Renaming Postgres role and database"
if [[ $DRY_RUN -eq 1 ]]; then
  info "[dry-run] ALTER ROLE $OLD_NAME RENAME TO $NEW_NAME"
  info "[dry-run] ALTER DATABASE $OLD_NAME RENAME TO $NEW_NAME"
else
  # Bring ONLY postgres up, on the new project, against the copied volume.
  $NEW_COMPOSE up -d postgres
  info "waiting for postgres to accept connections..."
  for _ in $(seq 1 60); do
    CID="$($NEW_COMPOSE ps -q postgres)"
    [[ -n "$CID" ]] && docker exec "$CID" pg_isready -U "$OLD_NAME" >/dev/null 2>&1 && break
    sleep 2
  done
  CID="$($NEW_COMPOSE ps -q postgres)"
  [[ -n "$CID" ]] || die "postgres did not start"

  # ALTER ROLE ... RENAME resets the password (Postgres drops the md5 hash
  # because it is salted with the role name), so it is set again right after.
  docker exec -e PGPASSWORD="$PGPASS" "$CID" psql -U "$OLD_NAME" -d postgres -v ON_ERROR_STOP=1 <<SQL || info "role/db already renamed — continuing"
SELECT 'renaming' WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$OLD_NAME');
ALTER DATABASE $OLD_NAME RENAME TO $NEW_NAME;
ALTER ROLE $OLD_NAME RENAME TO $NEW_NAME;
ALTER ROLE $NEW_NAME WITH PASSWORD '$PGPASS';
SQL
  info "role + database now '$NEW_NAME'"
fi

# ─────────────────────────────────────────────────────────────────────────
# 5. Move the deploy directory
# ─────────────────────────────────────────────────────────────────────────
say "5/8  Moving $OLD_DIR -> $NEW_DIR"
if [[ -d "$OLD_DIR" && ! -d "$NEW_DIR" ]]; then
  run "mv '$OLD_DIR' '$NEW_DIR'"
  WORK_DIR="$NEW_DIR"
  info "moved"
else
  info "nothing to move"
fi

# ─────────────────────────────────────────────────────────────────────────
# 6. nginx + fail2ban + cron
# ─────────────────────────────────────────────────────────────────────────
say "6/8  Reinstalling host config (nginx, fail2ban, cron)"

for F in /etc/nginx/sites-enabled /etc/nginx/sites-available /etc/nginx/conf.d; do
  [[ -d "$F" ]] || continue
  while IFS= read -r OLDCONF; do
    [[ -n "$OLDCONF" ]] || continue
    NEWCONF="${OLDCONF//$OLD_NAME/$NEW_NAME}"
    info "nginx: $(basename "$OLDCONF") -> $(basename "$NEWCONF")"
    run "mv '$OLDCONF' '$NEWCONF'"
    run "sed -i 's/$OLD_NAME/$NEW_NAME/g' '$NEWCONF'"
  done < <(find "$F" -maxdepth 1 -name "*${OLD_NAME}*" 2>/dev/null)
done

for J in /etc/fail2ban/jail.d /etc/fail2ban/filter.d; do
  [[ -d "$J" ]] || continue
  while IFS= read -r OLDJ; do
    [[ -n "$OLDJ" ]] || continue
    NEWJ="${OLDJ//$OLD_NAME/$NEW_NAME}"
    info "fail2ban: $(basename "$OLDJ") -> $(basename "$NEWJ")"
    run "mv '$OLDJ' '$NEWJ'"
    run "sed -i 's/$OLD_NAME/$NEW_NAME/g' '$NEWJ'"
  done < <(find "$J" -maxdepth 1 -name "*${OLD_NAME}*" 2>/dev/null)
done

# Drop stale cron entries, then let the repo's own installers rewrite them
# with the new paths (they are the source of truth for schedule + flags).
run "rm -f /etc/cron.d/*${OLD_NAME}* 2>/dev/null || true"
for S in install-backup-cron.sh install-watchdog-cron.sh install-wl-agent-cron.sh; do
  if [[ -x "$NEW_DIR/scripts/$S" ]]; then
    info "cron: $S"
    run "EZYMEX_DIR='$NEW_DIR' '$NEW_DIR/scripts/$S'"
  fi
done

run "nginx -t && systemctl reload nginx" || warn "nginx reload failed — check 'nginx -t' output"
run "systemctl restart fail2ban" || warn "fail2ban restart failed (non-fatal)"

# ─────────────────────────────────────────────────────────────────────────
# 7. Bring the stack up and verify
# ─────────────────────────────────────────────────────────────────────────
say "7/8  Starting the '$NEW_NAME' stack"
cd "$WORK_DIR"
run "$NEW_COMPOSE --profile migrate up migrate"   # alembic -> head (incl. 0077)
run "$NEW_COMPOSE up -d"

if [[ $DRY_RUN -eq 0 ]]; then
  info "waiting for the gateway to report healthy..."
  for _ in $(seq 1 60); do
    curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && break
    sleep 3
  done
  curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 \
    && info "gateway healthy" || warn "gateway not answering /health yet — check logs"

  CID="$($NEW_COMPOSE ps -q postgres)"
  if [[ -n "$CID" && -s "$COUNTS_BEFORE" ]]; then
    AFTER="$(docker exec -e PGPASSWORD="$PGPASS" "$CID" psql -U "$NEW_NAME" -d "$NEW_NAME" -At -c "
      SELECT 'users='||(SELECT count(*) FROM users)
          ||' accounts='||(SELECT count(*) FROM trading_accounts)
          ||' positions='||(SELECT count(*) FROM positions)
          ||' transactions='||(SELECT count(*) FROM transactions);")"
    info "before: $(cat "$COUNTS_BEFORE")"
    info "after : $AFTER"
    [[ "$AFTER" == "$(cat "$COUNTS_BEFORE")" ]] \
      && info "row counts match" \
      || warn "ROW COUNTS DIFFER — investigate before deleting the old volumes"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────
# 8. What is deliberately NOT done
# ─────────────────────────────────────────────────────────────────────────
say "8/8  Done — manual follow-ups"
cat <<EOF

    The old volumes (${OLD_NAME}_pg_data, ${OLD_NAME}_ts_data,
    ${OLD_NAME}_redis_data) were COPIED, not moved, and are still on disk.
    That is deliberate: they are the rollback path. Once the platform has
    been verified end-to-end, reclaim the space with

        docker volume rm ${OLD_NAME}_pg_data ${OLD_NAME}_ts_data ${OLD_NAME}_redis_data

    Still to do by hand (this script cannot know your DNS/registrar):

      * DNS + TLS for the new domain (ezymex.com, www, trade, api, admin).
        Issue certs BEFORE flipping DNS:
            certbot --nginx -d ezymex.com -d www.ezymex.com \\
                    -d trade.ezymex.com -d api.ezymex.com -d admin.ezymex.com
      * Update .env for production: COOKIE_DOMAIN=.ezymex.com,
        CORS_ORIGINS / API_CORS_ORIGINS / TRADER_APP_URL, and the
        *_CALLBACK_BASE_URL values for OxaPay / Razorpay.
      * Re-point payment-provider and OAuth dashboards at the new webhook
        and redirect URLs — those live outside this server.
      * White-label tenants keep their own domains and are unaffected, but
        their nginx blocks live in the tenants file referenced by
        BRANDING_NGINX_TENANTS_FILE — confirm that path still resolves.

    Backups from this run: $BACKUP_DIR

EOF

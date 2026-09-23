#!/usr/bin/env bash
#
# SwissCresta — white-label domain agent (HOST side).
#
# The admin-api container cannot touch host nginx/certbot, so it only
# marks a tenant domain custom_domain_status='provisioning' in Postgres.
# This agent (root cron, every minute) does the real work:
#
#   1. For every 'provisioning' row: write the tenant nginx blocks
#      (trader hosts → BRANDING_TRADER_UPSTREAM, admin.<domain> →
#      BRANDING_ADMIN_UPSTREAM), reload nginx, run certbot, then flip
#      the row to 'ready' (or 'failed' with the error).
#   2. Reconcile teardown: any tenant block in the tenants file whose
#      domain is no longer active in broker_profiles is removed and its
#      certificate deleted (this covers the dashboard's Disconnect).
#
# Install once with:  sudo ./scripts/install-wl-agent-cron.sh
# Logs: /var/log/swisscresta-wl-agent.log
set -euo pipefail

REPO_DIR="${SWISSCRESTA_DIR:-/opt/swisscresta}"
cd "$REPO_DIR"

# .env is a dotenv file, NOT a shell script — values like
# `SMTP_FROM=Name <mail@x>` blow up under `source` (the `<` is a bash
# redirect). Read only the keys we need, last occurrence wins, optional
# surrounding quotes and CR stripped.
env_get() {  # $1 key, $2 default
  local v
  v="$(grep -E "^${1}=" .env 2>/dev/null | tail -1 | cut -d'=' -f2- || true)"
  v="${v%$'\r'}"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "${v:-$2}"
}

TENANTS_FILE="$(env_get BRANDING_NGINX_TENANTS_FILE /etc/nginx/conf.d/swisscresta-tenants.conf)"
TRADER_UP="$(env_get BRANDING_TRADER_UPSTREAM 127.0.0.1:3012)"
ADMIN_UP="$(env_get BRANDING_ADMIN_UPSTREAM 127.0.0.1:3013)"
CERTBOT="$(env_get BRANDING_CERTBOT_BIN /usr/bin/certbot)"
NGINX="$(env_get BRANDING_NGINX_BIN /usr/sbin/nginx)"
CERTBOT_EMAIL="$(env_get BRANDING_CERTBOT_EMAIL "")"
# Phase 3: per-domain certbot cooldown (seconds). Let's Encrypt rate-limits
# failed authorisations (5/hour/account) and issued certs (50/domain/week), so
# never re-attempt the same domain more often than this even if it keeps getting
# re-queued (rapid Verify clicks, a stuck 'provisioning' row).
CERTBOT_COOLDOWN="$(env_get BRANDING_CERTBOT_COOLDOWN_SECS 600)"
POSTGRES_USER="$(env_get POSTGRES_USER swisscresta)"
POSTGRES_DB="$(env_get POSTGRES_DB swisscresta)"

# One agent at a time — a slow certbot run must not overlap the next tick.
exec 9>/var/lock/swisscresta-wl-agent.lock
flock -n 9 || exit 0

touch "$TENANTS_FILE"

psql_q() {
  docker compose exec -T postgres psql -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" -At -c "$1"
}

log() { echo "[$(date '+%F %T')] $*"; }

# H-INF-1: CERTBOT / NGINX come from .env and are executed (often as root), so a
# writable .env would otherwise be arbitrary code execution. Only run a binary
# from a fixed allow-list of expected system paths.
case "$CERTBOT" in
  /usr/bin/certbot|/usr/local/bin/certbot) ;;
  *) log "FATAL: BRANDING_CERTBOT_BIN not allow-listed: $CERTBOT"; exit 1 ;;
esac
case "$NGINX" in
  /usr/sbin/nginx|/usr/bin/nginx) ;;
  *) log "FATAL: BRANDING_NGINX_BIN not allow-listed: $NGINX"; exit 1 ;;
esac

write_block() {  # $1 domain  $2 app_subdomain
  local domain="$1" sub="$2" names admin_host certname
  admin_host="admin.${domain}"
  if [[ -n "$sub" ]]; then
    names="${sub}.${domain}"
    certname="${sub}.${domain}"
  else
    names="${domain} www.${domain}"
    certname="${domain}"
  fi
  # Idempotent: skip when the block already exists.
  grep -qF "# BEGIN swisscresta-tenant ${domain}" "$TENANTS_FILE" && return 0
  cat >> "$TENANTS_FILE" <<EOF

# BEGIN swisscresta-tenant ${domain}
# CERTNAME ${certname}
server {
    listen 80;
    listen [::]:80;
    server_name ${names};
    client_max_body_size 25m;
    location / {
        proxy_pass http://${TRADER_UP};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
server {
    listen 80;
    listen [::]:80;
    server_name ${admin_host};
    client_max_body_size 25m;
    location / {
        proxy_pass http://${ADMIN_UP};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
# END swisscresta-tenant ${domain}
EOF
}

remove_block() {  # $1 domain
  local domain="$1"
  sed -i "/# BEGIN swisscresta-tenant ${domain}\$/,/# END swisscresta-tenant ${domain}\$/d" "$TENANTS_FILE"
}

reload_nginx() {
  "$NGINX" -t >/dev/null 2>&1 && "$NGINX" -s reload
}

# ── 1. Provision pending domains ─────────────────────────────────────
pending="$(psql_q "SELECT custom_domain || '|' || COALESCE(app_subdomain,'') FROM broker_profiles WHERE custom_domain_status='provisioning' AND is_suspended=false;")"

for row in $pending; do
  domain="${row%%|*}"
  sub="${row#*|}"
  # Defense in depth: the backend validates domains, but never feed a
  # suspicious value to shell/SQL anyway.
  [[ "$domain" =~ ^[a-z0-9.-]+$ ]] || { log "SKIP invalid domain '$domain'"; continue; }
  [[ -z "$sub" || "$sub" =~ ^[a-z0-9-]+$ ]] || { log "SKIP invalid subdomain '$sub'"; continue; }
  log "provisioning ${domain} (sub='${sub}')"

  write_block "$domain" "$sub"
  if ! reload_nginx; then
    remove_block "$domain"
    reload_nginx || true
    psql_q "UPDATE broker_profiles SET custom_domain_status='failed', custom_domain_last_error='nginx config test failed — see /var/log/swisscresta-wl-agent.log' WHERE custom_domain='${domain}';" >/dev/null
    continue
  fi

  # Throttle: skip certbot for this domain if we attempted it within the
  # cooldown window, so a re-queued domain can't burn the Let's Encrypt
  # failed-authorisation budget.
  _cb_marker="/var/lock/swisscresta-certbot-$(printf '%s' "$domain" | tr -c 'a-z0-9.-' '_')"
  if [[ -f "$_cb_marker" ]]; then
    _cb_age=$(( $(date +%s) - $(stat -c %Y "$_cb_marker" 2>/dev/null || echo 0) ))
    if (( _cb_age < CERTBOT_COOLDOWN )); then
      log "THROTTLE ${domain}: cert attempted ${_cb_age}s ago (< ${CERTBOT_COOLDOWN}s) — skipping this tick"
      continue
    fi
  fi
  : > "$_cb_marker"

  cert_args=(-d "admin.${domain}")
  if [[ -n "$sub" ]]; then
    cert_args+=(-d "${sub}.${domain}")
  else
    cert_args+=(-d "${domain}" -d "www.${domain}")
  fi
  email_args=(--register-unsafely-without-email)
  [[ -n "$CERTBOT_EMAIL" ]] && email_args=(-m "$CERTBOT_EMAIL")

  if "$CERTBOT" --nginx --non-interactive --agree-tos --redirect \
       "${email_args[@]}" "${cert_args[@]}" >> /var/log/swisscresta-wl-agent.log 2>&1; then
    reload_nginx || true
    psql_q "UPDATE broker_profiles SET custom_domain_status='ready', custom_domain_last_error=NULL, custom_domain_provisioned_at=now() WHERE custom_domain='${domain}';" >/dev/null
    log "READY ${domain}"
  else
    psql_q "UPDATE broker_profiles SET custom_domain_status='failed', custom_domain_last_error='SSL issuance failed — check DNS is not proxied (grey cloud) and retry Verify. Details: /var/log/swisscresta-wl-agent.log' WHERE custom_domain='${domain}';" >/dev/null
    log "FAILED ${domain} (certbot)"
  fi
done

# ── 2. Reconcile teardown (Disconnect from the dashboard) ────────────
active="$(psql_q "SELECT custom_domain FROM broker_profiles WHERE custom_domain IS NOT NULL AND custom_domain_status IN ('provisioning','ready');")"
mapfile -t block_domains < <(grep -oP '^# BEGIN swisscresta-tenant \K.+$' "$TENANTS_FILE" || true)
for domain in "${block_domains[@]:-}"; do
  [[ -z "$domain" ]] && continue
  if ! grep -qxF "$domain" <<< "$active"; then
    log "teardown ${domain} (no longer active)"
    certname="$(sed -n "/# BEGIN swisscresta-tenant ${domain}\$/,/# END swisscresta-tenant ${domain}\$/p" "$TENANTS_FILE" | grep -oP '^# CERTNAME \K.+$' | head -1 || true)"
    remove_block "$domain"
    reload_nginx || true
    if [[ -n "${certname:-}" ]]; then
      "$CERTBOT" delete --non-interactive --cert-name "$certname" >> /var/log/swisscresta-wl-agent.log 2>&1 || true
    fi
  fi
done

exit 0

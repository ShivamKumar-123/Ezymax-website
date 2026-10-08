#!/usr/bin/env bash
# One-time setup of an Ubuntu server for Ezymex. Run as root:
#   bash provision.sh [super-admin email] [git url]
# Installs the build tools, Node + pnpm, PostgreSQL, a non-root `ezymex` user with Rust, one database role for the
# services (each creates its own database on first start; CREATEROLE lets the gateway create its tenant RLS role),
# the checkout at /home/ezymex/ezymex and its first .env.local. Then build, install and start:
#   sudo -iu ezymex /home/ezymex/ezymex/deploy/deploy.sh && bash /home/ezymex/ezymex/deploy/install.sh
set -euo pipefail
ADMIN_EMAIL=${1:-admin@ezymex.com}
REPO_URL=${2:-https://github.com/ShivamKumar-123/Ezymax-website.git}
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq build-essential pkg-config libssl-dev cmake clang git curl ca-certificates openssl postgresql nodejs npm >/dev/null
command -v pnpm >/dev/null || npm i -g -s pnpm@12.6.0
id ezymex >/dev/null 2>&1 || useradd -m -s /bin/bash ezymex
sudo -iu ezymex bash -c '[ -x ~/.cargo/bin/cargo ] || curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal -q'
systemctl enable --now postgresql >/dev/null 2>&1

[ -d /home/ezymex/ezymex/.git ] || sudo -iu ezymex git clone -q "$REPO_URL" /home/ezymex/ezymex

ENV_FILE=/home/ezymex/ezymex/.env.local
if [ ! -s "$ENV_FILE" ]; then
  PGPW=$(openssl rand -hex 24)
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'ezymex'" | grep -q 1; then
    sudo -u postgres psql -qc "ALTER ROLE ezymex WITH LOGIN CREATEDB CREATEROLE PASSWORD '$PGPW'"
  else
    sudo -u postgres psql -qc "CREATE ROLE ezymex WITH LOGIN CREATEDB CREATEROLE PASSWORD '$PGPW'"
  fi
  # upper + lower case, a digit and a symbol (the gateway's password rules)
  ADMIN_PW="Ez#$(openssl rand -hex 10)9"
  (umask 077; cat > "$ENV_FILE" <<EOF
# Ezymex services (read by every unit; deploy.sh adds the generated secrets and the per-service database URLs)
GATEWAY_DATABASE_URL=postgres://ezymex:$PGPW@127.0.0.1:5432/ezymex_core
DATABASE_URL=postgres://ezymex:$PGPW@127.0.0.1:5432/ezymex
SUPER_ADMIN_EMAIL=$ADMIN_EMAIL
SUPER_ADMIN_PASSWORD=$ADMIN_PW
SUPER_ADMIN_NAME=Ezymex Admin
# Live prices: the Infoway API key (https://infoway.io). Empty = no live feed yet.
INFOWAY_API_KEY=
EOF
  )
  chown ezymex:ezymex "$ENV_FILE"
  echo "Back Office super admin: $ADMIN_EMAIL / $ADMIN_PW  (shown once; change it after the first sign-in)"
fi
echo "Provisioned. Next: sudo -iu ezymex /home/ezymex/ezymex/deploy/deploy.sh && bash /home/ezymex/ezymex/deploy/install.sh"

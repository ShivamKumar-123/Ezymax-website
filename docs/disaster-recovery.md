# FXArtha — Disaster Recovery Runbook

**Goal:** rebuild a fully working FXArtha production environment on a fresh VPS in under 30 minutes from a known-good backup.

**Trigger:** the production VPS has been wiped, the disk has failed, the provider has deleted the instance, or the box is otherwise unrecoverable.

**Prerequisite:** at least one good backup file in your offsite store (Backblaze B2 / Cloudflare R2 / S3 / DigitalOcean Spaces) AND the contents of `.env` saved in your password manager. **Without both, this runbook will not save you.**

---

## 0. Pre-flight checklist

Confirm you have **all** of these before starting:

| Item | Where it should be | Notes |
|---|---|---|
| Latest `postgres-*.sql.gz` backup | offsite (B2/R2/S3) | `rclone ls b2:fxartha-backups/` should list it |
| Latest `uploads-*.tar.gz` backup | same | KYC docs + manual deposit screenshots |
| Latest `timescale-*.sql.gz` backup | same | Optional — market-data can be re-fetched |
| Full `.env` file contents | password manager (1Password / Bitwarden) | NOT in git, NOT in any backup blob |
| GitHub deploy key for `shivammacoss/fxartha` | password manager | Or a personal access token |
| DNS access | Cloudflare / registrar dashboard | Need to repoint A records to new IP |
| New VPS provisioned | any provider | Ubuntu 24.04, 4+ GB RAM, 80+ GB disk |
| New IP address | from the VPS provider | You'll point DNS at it later |
| `rclone` remote credentials | password manager | Same B2/S3 keys you used to push backups |
| 30 minutes uninterrupted | — | Don't start this if you're going to be pulled away |

If any item is missing, **stop and recover that first**. A half-finished restore can corrupt the bucket if you push a fresh backup over the only known-good copy.

---

## 1. Bootstrap the new VPS

Standard Ubuntu 24.04 setup. Run as `root` (or with `sudo`).

```bash
# Update + essential tools
apt update && apt upgrade -y
apt install -y curl ca-certificates gnupg ufw

# Firewall — only what FXArtha needs
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP (Let's Encrypt challenges)
ufw allow 443/tcp    # HTTPS
ufw --force enable

# Docker + compose v2
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version    # must be 2.x, not legacy docker-compose

# rclone for pulling the backup from offsite
curl https://rclone.org/install.sh | bash
rclone version
```

---

## 2. Restore offsite credentials

You need `rclone` to be able to read from the same bucket your old server was writing to.

```bash
rclone config
```

Recreate the remote interactively (use the same provider + bucket as the old server):
- name: `b2` (or whatever your `BACKUP_RCLONE_REMOTE` was set to)
- type: `Backblaze B2` (or your provider)
- paste the application key + key id from your password manager

Verify:
```bash
rclone ls b2:fxartha-backups/ | head
```
You should see the backup files listed. If not, fix `rclone config` before going further.

---

## 3. Clone the repo + restore secrets

```bash
mkdir -p /opt/fxartha
cd /opt/fxartha

# Either with a deploy key (preferred):
git clone git@github.com:shivammacoss/fxartha.git .

# Or with an HTTPS PAT:
# git clone https://YOUR_PAT@github.com/shivammacoss/fxartha.git .

# Restore the .env from your password manager.
# CRITICAL — without this, the gateway can't talk to Postgres, NOWPayments,
# Google OAuth, SMTP, or anything else.
nano .env     # paste the full saved contents
chmod 0600 .env
```

Verify the env file parses cleanly (no broken quoting):
```bash
set -a && source .env && set +a && echo "env loaded ok"
```

---

## 4. Pull backups from offsite

```bash
mkdir -p /opt/fxartha/backups
cd /opt/fxartha

# Latest postgres dump
rclone copy "b2:fxartha-backups/$(rclone ls b2:fxartha-backups/ | grep postgres- | sort -k2 | tail -1 | awk '{print $2}')" backups/

# Latest uploads tarball
rclone copy "b2:fxartha-backups/$(rclone ls b2:fxartha-backups/ | grep uploads- | sort -k2 | tail -1 | awk '{print $2}')" backups/

# Latest timescale (optional)
rclone copy "b2:fxartha-backups/$(rclone ls b2:fxartha-backups/ | grep timescale- | sort -k2 | tail -1 | awk '{print $2}')" backups/ 2>/dev/null || true

ls -lh backups/
```

Verify the postgres dump is non-empty + a valid gzip:
```bash
gunzip -t backups/postgres-*.sql.gz && echo "gzip OK"
gunzip -c backups/postgres-*.sql.gz | head -20    # should show CREATE ROLE / CREATE DATABASE
```

If gunzip fails, the file is corrupt — fall back to the next-newest dump.

---

## 5. Restore the database + uploads

Use the script that ships in the repo:

```bash
cd /opt/fxartha
chmod +x scripts/*.sh
set -a && source .env && set +a

scripts/restore.sh \
  backups/postgres-YYYY-MM-DD_HHMM.sql.gz \
  backups/uploads-YYYY-MM-DD_HHMM.tar.gz \
  backups/timescale-YYYY-MM-DD_HHMM.sql.gz   # omit if no timescale backup
```

The script will:
1. Bring up `postgres` (and `timescaledb` if a TS dump was passed) in isolation
2. Pipe the dump through `psql` with `ON_ERROR_STOP=1` so a single failed statement aborts the restore
3. Untar the uploads into `/opt/fxartha/uploads/`

Watch for any `ERROR:` lines from psql. Common ones:
- `role "fxartha" already exists` — harmless, the dump tried to create the role and Postgres started with it. Restore continues.
- `permission denied for schema public` — version skew between dumped and current Postgres. Force matching versions.
- `invalid byte sequence` — backup is corrupt. Try the previous dump.

---

## 6. Bring the rest of the stack up

```bash
cd /opt/fxartha
APP_VERSION=$(date +%s) docker compose \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build
```

This rebuilds gateway + trader-frontend + admin-frontend + admin-api + market-data + risk-engine. Takes ~3 min on a 4-core VPS.

Watch logs:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 gateway | grep -iE "started|error"
```

Expect: `Application startup complete.` and the engines starting (`SL/TP engine started`, `Staking accrual engine started`, etc.). No `traceback` lines.

---

## 7. Confirm the migrations match

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U fxartha -d fxartha -c "SELECT version_num FROM alembic_version;"
```

This should print the same revision the old server was running (latest at the time of writing: `0035`). If it's older, the dump was taken before a recent migration — bring it forward:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile migrate run --rm migrate
```

---

## 8. Repoint DNS

In your registrar (Cloudflare / Namecheap / etc.) update the A records:

| Hostname | New value |
|---|---|
| `fxartha.com` | new VPS IP |
| `trade.fxartha.com` | new VPS IP |
| `admin.fxartha.com` | new VPS IP |
| `api.fxartha.com` | new VPS IP |

TTL: 60s during a migration so changes propagate fast. Bump back to 3600s once stable.

If you use Caddy / Nginx with Let's Encrypt, certs will auto-provision on first HTTPS hit.

---

## 9. Smoke checks

From a separate browser / `curl`:

```bash
# Public health endpoint — no auth, no DB write
curl https://api.fxartha.com/api/v1/auth/platform-status
# → {"maintenance_mode": false, "allow_new_registrations": true, ...}
```

In a browser:
1. `https://trade.fxartha.com/auth/login` loads, dark theme, three sign-in buttons render
2. Sign in with a known existing account (you'll need their password — keep one test account's credentials in your password manager for this purpose)
3. Land on `/accounts` → trading account list shows the user's accounts with their balances unchanged
4. Open `/wallet` → main-wallet balance matches what it was before the disaster
5. Open `/profile` → KYC documents list still populated (the `uploads/` extraction worked)

---

## 10. Post-restore audit

Compare against the last admin reconciliation report:

```sql
-- Total platform liability (USD owed to all users)
SELECT SUM(main_wallet_balance) AS total_user_balances FROM users;

-- Outstanding withdrawal obligations
SELECT SUM(amount) AS pending_payouts FROM withdrawals WHERE status='pending';

-- Compare against NOWPayments dashboard merchant balance
-- (must be >= total_user_balances + pending_payouts)
```

If the totals match the last known-good admin report, you're done. If they don't, you've restored from an older dump than expected — investigate before letting users back in.

---

## 11. Reinstate backups on the new server

The new server has no cron yet. Set it up immediately:

```bash
cd /opt/fxartha
chmod +x scripts/*.sh
sudo ./scripts/install-backup-cron.sh
sudo ./scripts/backup.sh    # one-off run to confirm working
```

Verify:
```bash
sudo crontab -l | grep fxartha
ls -lh /opt/fxartha/backups/
rclone ls b2:fxartha-backups/ | tail -3
```

The new server's cron should be writing to the same B2 bucket the old one used.

---

## 12. Rotate compromised credentials (if disaster was a breach)

If the original server was compromised (not just lost), assume **everything** in `.env` is leaked:

1. **NOWPayments:** dashboard → Settings → API Keys → revoke + generate new + paste into `.env`
2. **NOWPayments IPN secret:** Settings → IPN → regenerate + paste
3. **JWT secrets:** generate new with `openssl rand -hex 32` for `JWT_SECRET`, `USER_JWT_SECRET`, `ADMIN_JWT_SECRET`. **All existing user sessions will be invalidated** — they'll need to sign in again. That's expected.
4. **Postgres password:** `ALTER USER fxartha WITH PASSWORD 'new_password';` and update `.env` to match
5. **SMTP password:** Hostinger control panel → email account → reset password
6. **Google OAuth client:** Google Cloud Console → Credentials → keep the same client id (it's public) but rotate the client secret if you use one
7. **WalletConnect Project ID:** OK to keep the same — public-facing, low risk
8. **Admin login:** force a password reset via the migration:
   ```bash
   HASH=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T gateway python -c "import bcrypt; print(bcrypt.hashpw(b'NEW_STRONG_PASSWORD', bcrypt.gensalt()).decode())" | tr -d '\r\n')
   docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres psql -U fxartha -d fxartha -c "UPDATE users SET password_hash='$HASH' WHERE email='admin@fxartha.com';"
   ```

After rotating: rebuild + restart so the new secrets propagate:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
```

---

## 13. Communicate with users

If downtime exceeded ~15 minutes, post a status note. Recommended copy:

> FXArtha experienced a brief outage at HH:MM UTC due to infrastructure maintenance. All trading data, balances, and account information have been restored from backup as of HH:MM UTC. No funds have been lost. We apologise for the disruption — please contact support@fxartha.com if you notice any inconsistency on your account.

Email this to all active users via the admin tools, post on whatever status channels you have.

---

## Time targets

| Step | Target |
|---|---|
| 1. VPS bootstrap | 5 min |
| 2. rclone config | 2 min |
| 3. Repo + .env | 3 min |
| 4. Pull backups | 2 min |
| 5. Restore | 4 min |
| 6. Stack build + up | 5 min |
| 7-9. DNS + smoke | 5 min |
| **Total** | **~26 min** |

If you're hitting >45 min on a real disaster, something in the runbook is stale — open a PR to fix.

---

## Practice this runbook BEFORE you need it

The single most-skipped step in any DR plan is the rehearsal. Schedule a calendar reminder for one Sunday a quarter to:

1. Spin up a $5 VPS at a different provider
2. Walk through this runbook end-to-end
3. Time it
4. Note anything that didn't work
5. Update this document
6. Tear down the test VPS

Untested backups are no backups.

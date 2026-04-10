# TrustEdge Production Deployment Guide
## trustedgefx.com — Hostinger VPS + Cloudflare + GoDaddy

### Architecture
```
Browser → Cloudflare CDN (SSL) → Nginx (Origin SSL) → Docker Containers
                                    │
                ┌───────────────────┼────────────────────┐
                │                   │                    │
        trustedgefx.com    admin.trustedgefx.com   api.trustedgefx.com
          :3010 (trader)     :3011 (admin)           :8000 (gateway+ws)
```

---

## PHASE 1: DNS (Cloudflare + GoDaddy)

You already have Cloudflare nameservers on GoDaddy. Now add DNS records in **Cloudflare Dashboard**:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `@` | `187.127.148.19` | Proxied (orange cloud) | Auto |
| A | `www` | `187.127.148.19` | Proxied (orange cloud) | Auto |
| A | `admin` | `187.127.148.19` | Proxied (orange cloud) | Auto |
| A | `api` | `187.127.148.19` | Proxied (orange cloud) | Auto |

### Cloudflare SSL Settings:
1. Go to **SSL/TLS → Overview** → Set mode to **Full (strict)**
2. Go to **SSL/TLS → Origin Server** → Click **Create Certificate**
   - Leave defaults (RSA 2048, *.trustedgefx.com + trustedgefx.com)
   - Validity: **15 years**
   - Click **Create**
   - **COPY the Origin Certificate** (PEM) → save as `origin.pem`
   - **COPY the Private Key** (PEM) → save as `origin-key.pem`
   - You CANNOT retrieve the private key later!

### Cloudflare Recommended Settings:
- **SSL/TLS → Edge Certificates** → Always Use HTTPS: **ON**
- **SSL/TLS → Edge Certificates** → Minimum TLS: **1.2**
- **Speed → Optimization** → Auto Minify: CSS, JS, HTML
- **Caching → Configuration** → Browser Cache TTL: **4 hours**
- **Network** → WebSockets: **ON** (required for price streaming)

---

## PHASE 2: Server Setup (SSH into VPS)

SSH into your Hostinger VPS:
```bash
ssh root@187.127.148.19
```

### Step 2.1 — System Update & Essential Packages

```bash
# Update system
apt update && apt upgrade -y

# Install essentials
apt install -y \
  curl wget git unzip nano htop \
  apt-transport-https ca-certificates \
  gnupg lsb-release software-properties-common \
  nginx \
  ufw fail2ban
```

### Step 2.2 — Install Docker & Docker Compose

```bash
# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repo
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version

# Enable Docker on boot
systemctl enable docker
systemctl start docker
```

### Step 2.3 — Install Node.js (for any build tasks)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
npm --version
```

### Step 2.4 — Configure Firewall (UFW)

```bash
# Reset and set defaults
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (important — don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP/HTTPS (Nginx)
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
ufw status verbose
```

> **DO NOT** open ports 3010, 3011, 5435, 5433, 6381, 8000, 8001, 9092.
> Nginx reverse-proxies to them on localhost. They must NOT be public.

### Step 2.5 — Configure Fail2ban

```bash
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = ssh
filter  = sshd
maxretry = 3

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled  = true
port     = http,https
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable fail2ban
systemctl restart fail2ban
```

---

## PHASE 3: SSL Certificates (Cloudflare Origin)

### Step 3.1 — Create SSL directory

```bash
mkdir -p /etc/ssl/cloudflare
```

### Step 3.2 — Place the certificates

Paste the Origin Certificate you copied from Cloudflare:
```bash
nano /etc/ssl/cloudflare/origin.pem
```
Paste the full certificate (including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`), save and exit.

Paste the Private Key:
```bash
nano /etc/ssl/cloudflare/origin-key.pem
```
Paste the full key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`), save and exit.

### Step 3.3 — Secure the files

```bash
chmod 600 /etc/ssl/cloudflare/origin-key.pem
chmod 644 /etc/ssl/cloudflare/origin.pem
chown root:root /etc/ssl/cloudflare/*
```

---

## PHASE 4: Clone & Configure Project

### Step 4.1 — Clone the repository

```bash
cd /root
git clone https://github.com/YOUR_USERNAME/trustedge.git
cd trustedge
```

> If private repo, set up SSH key or use a personal access token:
> ```bash
> git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/trustedge.git
> ```

### Step 4.2 — Create production .env

```bash
# Copy the template
cp deploy/.env.production .env
```

Now edit `.env` and **change ALL passwords and secrets**:
```bash
nano .env
```

**Generate secrets** (run each line, copy the output into .env):
```bash
# For JWT_SECRET
openssl rand -hex 32

# For USER_JWT_SECRET (different!)
openssl rand -hex 32

# For ADMIN_JWT_SECRET (different!)
openssl rand -hex 32

# For POSTGRES_PASSWORD
openssl rand -base64 24

# For TIMESCALE_PASSWORD
openssl rand -base64 24
```

**CRITICAL checklist for .env:**
- [ ] `POSTGRES_PASSWORD` — changed from default
- [ ] `TIMESCALE_PASSWORD` — changed from default
- [ ] `DATABASE_URL` — password matches POSTGRES_PASSWORD
- [ ] `TIMESCALE_URL` — password matches TIMESCALE_PASSWORD
- [ ] `JWT_SECRET` — random 64-char hex
- [ ] `USER_JWT_SECRET` — different random 64-char hex
- [ ] `ADMIN_JWT_SECRET` — different random 64-char hex
- [ ] `COOKIE_SECURE=true` — already set
- [ ] `CORS_ORIGINS` — has both domains
- [ ] `TRADER_APP_URL` — https://trustedgefx.com
- [ ] `INFOWAY_API_KEY` — your real key (or leave placeholder for simulated feed)

---

## PHASE 5: Nginx Configuration

### Step 5.1 — Remove default site

```bash
rm -f /etc/nginx/sites-enabled/default
```

### Step 5.2 — Copy the TrustEdge nginx config

```bash
cp /root/trustedge/deploy/nginx/trustedgefx.conf /etc/nginx/sites-available/trustedgefx.conf
ln -sf /etc/nginx/sites-available/trustedgefx.conf /etc/nginx/sites-enabled/trustedgefx.conf
```

### Step 5.3 — Optimize Nginx main config

```bash
nano /etc/nginx/nginx.conf
```

Find the `http` block and ensure these settings exist:
```nginx
http {
    # ... existing settings ...

    # WebSocket support
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    # Increase bucket size for long domain names
    server_names_hash_bucket_size 64;

    # Timeouts
    proxy_connect_timeout 10;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;

    # Buffer sizes
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # Don't send nginx version
    server_tokens off;
}
```

### Step 5.4 — Test & reload Nginx

```bash
nginx -t
```

If it says `syntax is ok` and `test is successful`:
```bash
systemctl enable nginx
systemctl restart nginx
```

> Nginx will show 502 errors until Docker containers are running — that's expected.

---

## PHASE 6: Build & Start Docker Stack

### Step 6.1 — Build all images

```bash
cd /root/trustedge

# Build with production compose file
# APP_VERSION tags the build so browsers get fresh JS
APP_VERSION=$(date +%Y%m%d-%H%M%S) \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

This takes 5-15 minutes depending on VPS specs. If you run low on memory (< 2GB RAM), add swap:
```bash
# Only if you get "killed" during build
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Step 6.2 — Start everything

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Step 6.3 — Verify all services are running

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

You should see all services as `running` or `healthy`:
```
trustedge-postgres-1          running (healthy)
trustedge-timescaledb-1       running (healthy)
trustedge-redis-1             running (healthy)
trustedge-zookeeper-1         running
trustedge-kafka-1             running (healthy)
trustedge-gateway-1           running
trustedge-admin-api-1         running
trustedge-market-data-1       running
trustedge-b-book-engine-1     running
trustedge-risk-engine-1       running
trustedge-trader-frontend-1   running
trustedge-admin-frontend-1    running
```

### Step 6.4 — Run database migrations

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile migrate run --rm migrate
```

### Step 6.5 — Check health endpoints

```bash
# Gateway
curl http://localhost:8000/health

# Admin API
curl http://localhost:8001/health

# Through Nginx (should work if Cloudflare DNS has propagated)
curl -k https://api.trustedgefx.com/health
```

### Step 6.6 — Check logs if anything is wrong

```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50

# Specific service
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs gateway --tail=100
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs trader-frontend --tail=100
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs admin-api --tail=100
```

---

## PHASE 7: Verification Checklist

Test each URL in your browser:

| URL | Expected |
|-----|----------|
| https://trustedgefx.com | Trader landing page |
| https://trustedgefx.com/auth/login | Login page |
| https://admin.trustedgefx.com | Admin login page |
| https://admin.trustedgefx.com/login | Admin login form |
| https://api.trustedgefx.com/health | `{"status":"ok","service":"gateway"}` |

**Test admin login:**
- Go to https://admin.trustedgefx.com
- Login: `admin@protrader.com` / `ProTraderAdmin2025!`
- **Change the password immediately after first login!**

**Test WebSocket (browser console):**
```javascript
const ws = new WebSocket('wss://api.trustedgefx.com/ws/prices');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => console.log('connected');
```

---

## PHASE 8: Post-Deploy Hardening

### 8.1 — Change default admin password
Login to admin panel and change from default immediately.

### 8.2 — Set up automatic Docker restarts
Already handled by `restart: always` in docker-compose.prod.yml.

### 8.3 — Set up log rotation

```bash
cat > /etc/logrotate.d/docker-containers << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    maxsize 100M
}
EOF
```

### 8.4 — Set up database backups (daily at 2 AM)

```bash
mkdir -p /root/backups

# Make backup script executable
chmod +x /root/trustedge/scripts/backup-db.sh

# Add cron job
crontab -e
```

Add this line:
```
0 2 * * * cd /root/trustedge && ./scripts/backup-db.sh /root/backups >> /var/log/trustedge-backup.log 2>&1
```

### 8.5 — Monitor disk space

```bash
# Check disk usage
df -h

# Docker can eat disk — prune unused images weekly
crontab -e
```

Add:
```
0 3 * * 0 docker system prune -af --volumes --filter "until=168h" >> /var/log/docker-prune.log 2>&1
```

---

## Quick Reference: Common Commands

```bash
# ── Navigate to project ──────────────────────────────────────
cd /root/trustedge
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# ── View status ──────────────────────────────────────────────
$COMPOSE ps
$COMPOSE logs --tail=50

# ── Restart a single service ─────────────────────────────────
$COMPOSE restart gateway
$COMPOSE restart trader-frontend

# ── Rebuild & redeploy trader frontend (after code changes) ──
git pull
APP_VERSION=$(date +%Y%m%d-%H%M%S) $COMPOSE build --no-cache trader-frontend
$COMPOSE up -d trader-frontend

# ── Rebuild & redeploy everything ────────────────────────────
git pull
APP_VERSION=$(date +%Y%m%d-%H%M%S) $COMPOSE build
$COMPOSE up -d

# ── Run migrations ───────────────────────────────────────────
$COMPOSE --profile migrate run --rm migrate

# ── View live logs ───────────────────────────────────────────
$COMPOSE logs -f gateway
$COMPOSE logs -f trader-frontend admin-frontend

# ── Enter a running container ────────────────────────────────
docker exec -it trustedge-gateway-1 bash
docker exec -it trustedge-postgres-1 psql -U protrader -d protrader

# ── Stop everything ──────────────────────────────────────────
$COMPOSE down

# ── Nuclear reset (WARNING: deletes all data!) ───────────────
# $COMPOSE down -v
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 502 Bad Gateway | Check `docker compose ps` — service may have crashed. Check logs. |
| WebSocket not connecting | Cloudflare dashboard → Network → WebSockets must be **ON** |
| Mixed content errors | Don't set `NEXT_PUBLIC_GATEWAY_URL` — use same-origin proxy |
| Admin login fails | Run migrations: `--profile migrate run --rm migrate` |
| CORS errors | Check `CORS_ORIGINS` in .env matches exactly (no trailing slash) |
| Slow builds / OOM killed | Add swap space (Phase 6.1) |
| CSS not updating | Hard refresh (Ctrl+Shift+R) or rebuild with new APP_VERSION |
| Database connection refused | Check that postgres is healthy: `docker compose ps postgres` |
| Cloudflare 525 SSL error | Verify origin.pem and origin-key.pem are correct in /etc/ssl/cloudflare/ |
| Cloudflare 521 Origin Down | Nginx not running or not listening on 443. Check: `systemctl status nginx` |

# Production deploy (VPS)

One Ubuntu VPS runs everything. Only Caddy (ports 80/443) and SSH are reachable from the internet.

| Host | Serves | Local port |
|---|---|---|
| app.kalkstrade.com | Client Area | 3000 |
| admin.kalkstrade.com | Back Office | 3001 |
| trade.kalkstrade.com | Kalks Trader | 3002 |
| api.kalkstrade.com | market-data (public quotes, candles, stream; `/v1/admin*` blocked) | 8081 |
| kalkstrade.com | website (repo kalks-markets/kalks-website, `deploy-website.sh`) | 3010 |
| (internal only) | gateway / auth | 8080 |
| (internal only) | trading engine (`/engine/stream` on trade./admin. proxies its ticket-authenticated WebSockets) | 8090 |
| (internal only) | wallet (USDT deposits / withdrawals, wallet ↔ trading; reached only by the app BFFs and internal services) | 8095 |
| (internal only) | IB / referral programme (referral tree, commissions, payout batches → wallet; reached only by the app BFFs) | 8096 |
| (internal only) | PostgreSQL | 5432 |

- `deploy.sh` pulls `main`, builds, installs the units in `systemd/` and the `Caddyfile`, restarts, and checks health.
- Secrets live only on the server: `~/kalks/.env.local` (services) and `apps/*/.env.production.local` (apps). They are generated there and never committed.
- KYC documents: `deploy.sh` generates `KYC_ENCRYPTION_KEY` (AES-256-GCM, `openssl rand -hex 32`) and sets `KYC_STORAGE_DIR=~/.kalks-data/kyc` (0700) in `~/kalks/.env.local` on first deploy. Back up the key together with the directory: files can't be decrypted without it. Never serve that directory; staff read documents only through the Back Office (`/api/admin/kyc/documents/{id}/file`). Caddy caps `/api/kyc/documents` uploads at 12 MB. Optional: `KYC_SLA_HOURS` (review target, default 24).
- Caddy reads `SITE_LOCK_USER` / `SITE_LOCK_HASH` from `/etc/caddy/kalks.env` for the pre-launch lock.
- Logs: `journalctl -u kalks-<name> -f`.

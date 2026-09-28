# Production deploy (VPS)

One Ubuntu VPS runs everything. Only Caddy (ports 80/443) and SSH are reachable from the internet.

| Host | Serves | Local port |
|---|---|---|
| app.kalkstrade.com | Client Area | 3000 |
| admin.kalkstrade.com | Back Office | 3001 |
| trade.kalkstrade.com | Kalks Trader | 3002 |
| api.kalkstrade.com | market-data (public quotes, candles, stream; `/v1/admin*` blocked) | 8081 |
| kalkstrade.com | website (separate repo) | 3010 |
| (internal only) | gateway / auth | 8080 |
| (internal only) | PostgreSQL | 5432 |

- `deploy.sh` pulls `main`, builds, installs the units in `systemd/` and the `Caddyfile`, restarts, and checks health.
- Secrets live only on the server: `~/kalks/.env.local` (services) and `apps/*/.env.production.local` (apps). They are generated there and never committed.
- Caddy reads `SITE_LOCK_USER` / `SITE_LOCK_HASH` from `/etc/caddy/kalks.env` for the pre-launch lock.
- Logs: `journalctl -u kalks-<name> -f`.

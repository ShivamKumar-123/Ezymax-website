# SwissCresta

A premium multi-page Forex brokerage website by SwissCresta, built with React, Vite, Tailwind CSS, and Framer Motion.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

- React 18 + Vite 5
- Tailwind CSS 3
- React Router DOM 6
- Framer Motion (scroll-linked hero animation)
- Lucide React (icons)
- Inter (Google Fonts)

## Event bus

There is no message broker in the deployment. Events that need to fan
out to multiple subscribers (real-time price ticks, position updates,
notifications) use **Redis pub/sub** — Redis is already in the stack.
Durable history (trade fills, audit log, deposits/withdrawals, webhook
events) is the source of truth and lives in **Postgres** as ordinary
tables.

The codebase used to ship Kafka + Zookeeper for an event log that no
consumer ever read. With zero users and zero consumers it was eating
~1.5 GB of RAM for nothing, so it was removed. The
`packages/common/src/kafka_client.produce_event` function is now a
no-op shim so existing call-sites still compile. When a real consumer
is needed (fraud engine, analytics pipeline, audit replayer), the
cheapest re-introduction is **Redis Streams** — `XADD trades * key val`
in place of the no-op. Real Kafka only earns its keep at multi-region,
multi-consumer scale.


## Monitoring (the 3am pager)

`scripts/health-watchdog.py` runs from root cron every 5 minutes and
emails `ADMIN_EMAIL` (override with `WATCHDOG_ALERT_EMAIL`) when
production breaks. It checks the failures that have actually happened
here: gateway/frontend reachability, every container Up, **live tick
freshness** (BTCUSD always; XAUUSD only while the forex market is open,
so weekends never page), nightly backup present and non-truncated, SSL
certs — platform and every white-label tenant — expiring inside 14 days,
and disk usage.

Alerts are state-based: one email when a check flips to failing, a
repeat at most every 6h while it stays broken, and a RECOVERED email
when it clears. Delivery reuses the platform's own SMTP credentials —
no extra service.

```bash
sudo ./scripts/install-watchdog-cron.sh                    # one-time
sudo python3 scripts/health-watchdog.py --test-email       # prove delivery
tail -f /var/log/swisscresta-watchdog.log
```

**Restore drills.** Verifying a dump *is* the backup — restore the
newest into a scratch database and compare row counts against live
(never into `swisscresta`):

```bash
CID=$(docker compose ps -q postgres)
NEW=$(ls -t backups/db/daily/*.dump | head -1)
docker cp "$NEW" $CID:/tmp/drill.dump
docker exec $CID psql -U swisscresta -d postgres -c 'CREATE DATABASE restore_drill;'
docker exec $CID pg_restore -U swisscresta -d restore_drill --no-owner --no-privileges /tmp/drill.dump
docker exec $CID psql -U swisscresta -d restore_drill -c 'SELECT count(*) FROM users;'
docker exec $CID psql -U swisscresta -d postgres -c 'DROP DATABASE restore_drill;'
```

## Backups & disaster recovery

Daily snapshots of Postgres, TimescaleDB, and the `uploads/` directory are
written to `/opt/swisscresta/backups/` and (optionally) mirrored to an offsite
`rclone` remote (Backblaze B2 / Cloudflare R2 / S3 / DO Spaces).

**One-time setup on a server:**
```bash
chmod +x scripts/*.sh
rclone config                                # configure your offsite remote once
./scripts/install-backup-cron.sh             # installs daily 03:00 UTC cron
```

**Manual on-demand snapshot:**
```bash
set -a && source .env && set +a
./scripts/backup.sh
```

**Restore from a known-good dump:**
```bash
./scripts/restore.sh \
  backups/postgres-2026-05-02_0300.sql.gz \
  backups/uploads-2026-05-02_0300.tar.gz
```

**Full disaster-recovery runbook (rebuild on a fresh VPS in ~30 min):** see
[`docs/disaster-recovery.md`](docs/disaster-recovery.md). Practice it once
a quarter on a throwaway VPS — untested backups are no backups.

Configure retention + offsite via the `BACKUP_*` vars in `.env` (see
`.env.example`). The `.env` itself is **not** part of the backup blob —
keep an encrypted copy in a password manager.

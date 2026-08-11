# SwissCresta

A premium multi-page Forex brokerage website by SwissCresta, built with React, Vite, Tailwind CSS, and Framer Motion.

## Monorepo layout

| Path | What it is |
|---|---|
| `backend/` | Python microservices (gateway, admin, b-book, risk, market-data) + shared package + contracts + migrations |
| `frontend/trader/` | Next.js trader web app (swisscresta.com / trade.swisscresta.com) |
| `frontend/admin/` | Next.js admin panel (admin.swisscresta.com) |
| `mobile/` | Expo / React Native APK (merged from the former `swisscresta_apk` repo, history preserved) |
| `deploy/`, `scripts/` | nginx config, backup/restore, server deploy tooling |

`deploy.sh` on the server only rebuilds services whose paths changed — commits
touching only `mobile/` deploy nothing on the VPS. Mobile releases ship
separately: JS-only changes via `cd mobile && npx eas-cli update --channel
production`; native changes need `eas build`. The old standalone
`swisscresta_apk` repo is deprecated — work on the app here.

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

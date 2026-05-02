# FXArtha

A premium multi-page Forex brokerage website by FXArtha, built with React, Vite, Tailwind CSS, and Framer Motion.

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

## Backups & disaster recovery

Daily snapshots of Postgres, TimescaleDB, and the `uploads/` directory are
written to `/opt/fxartha/backups/` and (optionally) mirrored to an offsite
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

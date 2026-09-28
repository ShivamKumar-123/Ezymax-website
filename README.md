# Kalks

White-label multi-asset trading platform: three Next.js apps (Client Area CRM, Back Office admin, Kalks Trader terminal) plus a Rust market-data service for live prices, candles and spreads.
Live builds (default) show only real data; `NEXT_PUBLIC_KALKS_MODE=demo` builds show the full mock showcase (see `packages/mock/src/mode.ts`).

## Run locally

Requires Node 22+ and pnpm.

```bash
pnpm install        # also copies shared assets into each app
pnpm dev            # starts all apps
```

| App | URL |
|---|---|
| Client Area | http://localhost:3000 (sign-in at `/login`) |
| Back Office | http://localhost:3001 (staff sign-in at `/login`) |
| Kalks Trader (trading room) | http://localhost:3002 (opened from any **Trade** button, or MT5-style login at `/login`) |

Run a single app with `pnpm dev:crm`, `pnpm dev:admin` or `pnpm dev:terminal` (or `pnpm --filter @kalks/<crm|admin|terminal> dev`). Build with `pnpm build`.

## Market data

The Rust market-data service serves prices, candles and spreads to every app. It needs Rust (cargo) and PostgreSQL 16 listening on port 5433.

```bash
cargo run -p market-data            # http://127.0.0.1:8081
```

It creates its database and runs migrations on first start. Provider keys (`INFOWAY_*`) are read from `.env.local` at the repo root; never commit that file. Details, endpoints and settings: [services/market-data/README.md](services/market-data/README.md).

## Sign-in (gateway)

The Rust gateway handles client and staff sign-in, sessions and the audit log. It uses PostgreSQL on port 5433 (database `kalks_core`, created and migrated on first start).

```bash
cargo run -p gateway                # http://127.0.0.1:8080 (only the apps call it, never the browser)
```

Its settings (`GATEWAY_*`, `SESSION_SECRET`, `SUPER_ADMIN_*`) live in `.env.local` at the repo root, and each app's `.env.local` holds `GATEWAY_URL` and `GATEWAY_INTERNAL_TOKEN`. The super-admin account is created once on first start. The Back Office reads clients, the audit log, staff and sessions through the gateway's staff-authenticated `/v1/admin/*` endpoints (`services/gateway/src/admin.rs`), and edits spread markups through market-data with `MARKET_DATA_URL` / `MARKET_DATA_ADMIN_TOKEN` in `apps/admin/.env.local` (same token as `MARKET_DATA_ADMIN_TOKEN` in the root `.env.local`; see `apps/admin/.env.example`). Email sending is not configured yet, so in development the sign-in codes appear on screen and in the gateway log.

## Layout

```
apps/crm        Client Area — Next.js 16 (port 3000)
apps/admin      Back Office — Next.js 16 (port 3001)
apps/terminal   Kalks Trader — standalone MT5/cTrader-style trading room (port 3002)
packages/ui     Design system: tokens, shell, charts, tables, effects
packages/mock   Mock data + price feed client (live from market-data, simulator fallback)
services/market-data  Rust market-data service (prices, candles, spreads) — :8081
services/gateway      Rust sign-in service (clients, staff, sessions, audit log) — :8080
config/         Instrument catalogue
brand/          Logo sources
scripts/        Asset sync
assets/         Shared assets: app, brand, coins, stocks, people, photos
docs/           Conventions, integrations list, website content PDF
.superdesign/   Design system spec + reference screenshots
```

## Docs

- `docs/CONVENTIONS.md`: how pages and components are built
- `docs/INTEGRATIONS.md`: every key and credential the Super Admin needs to go live
- `docs/Kalks-Website-Content.pdf`: full website copy and build spec for kalks.com

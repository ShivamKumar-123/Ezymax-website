# reports

The Ezymex statements, analytics and reports service: branded PDF account statements with CSV / Excel exports (D48, D50), client analytics (D91), broker reports (D120) and cohorts, LTV, funnel and scheduled reports (D145). It is a Rust service (axum 0.8, sqlx 0.9, PostgreSQL) on `127.0.0.1:8102`.

It never writes to another service. It mirrors what it needs into its own database `ezymex_reports` through the documented APIs of the trading engine, wallet, gateway and IB service, and computes everything from that mirror.

- [Run locally](#run-locally)
- [How it works](#how-it-works)
- [Definitions](#definitions)
- [API](#api)
- [Permissions](#permissions)
- [How the apps integrate](#how-the-apps-integrate)
- [Environment](#environment)
- [Tests](#tests)
- [Known gaps](#known-gaps)

## Run locally

You need PostgreSQL on `127.0.0.1:5433`, the gateway (`:8080`) and the trading engine (`:8090`). The wallet (`:8095`), IB service (`:8096`), prop service (`:8097`) and market-data (`:8081`, spread markups) are optional: their reports are empty until they answer.

```bash
cargo build -p reports
(cd services/reports && REPORTS_LOG_FORMAT=pretty nohup ../../target/debug/reports > ~/.ezymex-local/reports.log 2>&1 &)
curl -s localhost:8102/health
cargo test -p reports
```

It creates and migrates `ezymex_reports` on first start and reads `REPORTS_*` plus the other services' tokens from the repo-root `.env.local`.

## How it works

```
 gateway  /v1/internal/referrals/users ─┐ clients (country, IB, campaign, KYC, sign-up time)
 engine   /v1/admin/accounts ───────────┤ accounts + live metrics; when an account's event version changes:
          /v1/accounts/{login}/history ─┤   deals (incremental, 10 min overlap; a reversal re-reads all deals)
          /v1/accounts/{login}/ledger ──┤   ledger postings
          /v1/admin/groups ─────────────┤ group → spread group
 market-data /v1/admin/spreads ─────────┤ markups (spread cost / markup revenue estimates)
 wallet   /v1/admin/deposits|withdrawals┤ credited deposits, completed withdrawals, fees
          /v1/admin/adjustments         ┤ manual wallet deposits / withdrawals (external payments)
 IB       /v1/ib/admin/commissions ─────┘ partner cost lines
                         │ every REPORTS_SYNC_SECS (30 s); wallet / IB every 5th pass
                         ▼
 ezymex_reports: clients, accounts, deals, ledger, snapshots, wallet_*, ib_commissions, schedules, audit_log
```

- **Snapshots.** Each pass upserts today's row per account (`snapshots`, server day) from the engine's live balance and equity, so the last write of a day is its end-of-day value. The first sync of an account backfills past days from its ledger (`source = backfill`: equity = balance + credit + bonus, since past floating P&L is unknown). Days without a row carry the previous day forward.
- **Freshness.** Client statements and analytics first refresh that client's accounts from the engine (`GET /v1/accounts?user_id=`, then the incremental pull), so a trade made seconds ago is included. Broker reports read the mirror (at most one pass old); `POST /v1/admin/sync` runs a pass now.
- **Idempotent.** Every mirrored row is keyed by its source id; overlaps and retries never double count.
- **Scheduler.** Every minute it runs due schedules, builds the report for the previous server day / 7 days / calendar month, and emails it (XLSX or CSV attachment plus a totals summary) through SMTP. Without `SMTP_HOST` a run is recorded as `logged`.

## Definitions

Server time is GMT+3 during US DST and GMT+2 otherwise (MT5 convention). Periods are `[from, to)`; `YYYY-MM-DD` means the start of that server day.

**Statement (per account, account currency; cent = USC).**
- Opening balance = Σ balance postings before `from`; closing = opening + Σ postings in the period. The summary splits the postings by kind: deposits (`transfer_in`, `deposit`, demo funding), withdrawals (`transfer_out`, `withdrawal`), closed trade results (`trade_pnl` = price P&L + swap), commission, performance fees, option premiums (`option_premium`, "Option premium": paid −, received +), option settlements (`option_settlement`, "Option settlement": expiry payouts / charges and knock-out rebates), adjustments (everything else). Option premiums and settlements are trading cash, never deposits, withdrawals or adjustments. Credit and bonus are separate sub-ledgers.
- Net trading result (realised) = closed CFD trade results + realised option P&L (option exit deals: closes, expiries, knock-outs) + commission + performance fees. A premium paid for an option still open is cash, not a result.
- Sections: summary with trade statistics, closed trades (CFD exit deals), **Options** (O46, only when the period has option activity: premiums paid / received, settlements received / paid, option commission, realised option P&L and net, then every option deal with series, call / put, strike, expiry, event — bought / sold (open), closed, "Expired", "Knocked out", stop out —, contracts, premium per unit, the fixing of an expiry, cash, commission and realised P&L; reversed deals are listed as corrections), open positions and pending orders (live at generation time), balance operations (ledger with running balance), charges, totals. Deal reasons are labelled ("Stop loss", "Take profit", "Expired", "Knocked out", …). Option deals: volume = contracts (never lots), prices = premium per unit of the underlying; their commission is charged on every trade (`option.commissionCharged`).
- Reconciliation: the summary lines must add up to the balance change; the ledger's trade results must equal Σ(profit + swap) of the closed CFD deals, and the ledger's option premiums + settlements must equal Σ `option.cash` of the option deals (both skipped when a reversal happened in the period); for a period ending now, the closing balance must equal the engine's live balance. The PDF prints the result.
- Charges (D50): commission booked, swap paid / earned, performance fees; the spread cost (base spread + group markup per deal side) is an estimate shown for information, because it is already in the prices.

**Analytics (per account or all live accounts, USD).**
- Trade = exit deal, net = profit + swap − commission share. Win rate = wins ÷ trades (net = 0 counts as neither win nor loss). Profit factor = gross profit ÷ gross loss (`null` = no losses). Expectancy = net ÷ trades. Reward:risk = average win ÷ average loss. Holding time = exit − entry time.
- Return index (flows removed): `I₀ = 1`, `I_t = I_{t−1} × (E_t − F_t) ÷ E_{t−1}`, where `F_t` is the day's net deposits. Drawdown = `I_t ÷ max I − 1`. Sharpe = mean ÷ sample stdev of daily index returns × √252; Sortino uses downside deviation. Deposits and withdrawals never look like gains or drawdowns.
- Groupings: symbol, weekday and hour of the close (server time), server day of the close (`byDay`, the P&L calendar), session of the open (UTC: Asia 22–07, London 07–12, London/New York 12–16, New York 16–21).
- Behaviour: overtrading days (more than max(2 × median, median + 3) trades), revenge trades (opened ≤ 15 min after a losing close on the same account at the same size or larger), risk per losing trade (loss ÷ balance before the close), losers held > 1.5× longer than winners, stop-outs, share closed by SL / TP, best session.

**Broker reports (live accounts, prop groups excluded, USD).**
- B-book P&L = −client price P&L on B-book exits (options: −client realised option P&L on option exits, also shown as `optionsPnl`); swap = −client swap on exits; commission = entry-deal commission (options: each option deal's own commission, opens and closes); option contracts are reported as `optionContracts`, never as lots (lots, A-book %, activity and the AML "< 1 lot traded" rule); spread markup = group markup × volume per deal side (estimate); IB cost = IB commission lines (lot, split, rebate, CPA, clawback) created in the period, excluding rejected / void.
- Net revenue = B-book + swap + commission + A-book markup − IB cost. The B-book markup is inside the B-book P&L, so it is not added twice.
- Money in / out (option premiums and settlements are never money in or out) = wallet credited deposits and completed withdrawals, manual wallet deposits / withdrawals staff booked as external payments (Balance & credit reasons "Deposit (external payment received)" / "Withdrawal (paid externally)", table `wallet_manual`), plus deposits / withdrawals booked by staff on live accounts (engine kinds `deposit` / `withdrawal`). Every other manual adjustment (correction, compensation, bonus, fee, chargeback, other, credit) is never money in or out and never an FTD. FTD = a client's first deposit ever. Net deposits = deposits − withdrawals.
- Campaign (`clients.campaign`): the first-touch `utm_campaign` the client signed up with (gateway feed), else the IB partner campaign; `utm_source` / `utm_medium` are kept alongside.
- Funnel (clients who signed up in the period): registered → email verified → KYC verified → live account → funded → traded, by campaign and country.
- Cohorts: sign-up month; retention = share of the cohort with a live deal in month k; LTV = cumulative net deposits and broker revenue per client.
- AML list: single movements ≥ `large` (default 10 000), withdrawals within 72 h of a similar deposit with < 1 lot traded, open IB fraud flags.

## API

Every route except `GET /health` needs `X-Ezymex-Internal: $REPORTS_INTERNAL_TOKEN`. Tenant: `X-Ezymex-Tenant` (default `ezymex`, must be listed in `REPORTS_TENANTS`). JSON camelCase; money as JSON numbers. Errors: `{"error": {"code", "message", "field"?}}`. Query `from` / `to` accept `YYYY-MM-DD` (server day start) or RFC 3339; `to` is exclusive.

**Client routes** (`X-Ezymex-User-Id` = signed-in gateway user; other users' accounts return 404)

| Method & path | Query | Response |
|---|---|---|
| `GET /v1/me/analytics` | `login=all\|<login>`, `from`, `to` (default 90 days) | `{accounts, curve:{points[{day, balance, equity, flow, index, drawdown}], maxDrawdown, currentDrawdown, returnPct, sharpe, sortino, volatility}, stats, long, short, bySymbol, byWeekday, byDay[{key: YYYY-MM-DD, trades, wins, winRate, net, lots}], bySession, hourHeatmap[7][24], moneyFlow, charges, behaviour:{…, insights[{id, tone, title, stat, text, tip}]}}` |
| `GET /v1/me/accounts/{login}/months` | – | `{login, currency, months:[{month, from, to, net, deposits, withdrawals, trades}]}` newest first |
| `GET /v1/me/accounts/{login}/statement` | `from`, `to` (default 30 days), `format=pdf\|csv\|xlsx\|json`, `open=0`, `charges=0`, `deals=0` to leave sections out | the file (`Content-Disposition: attachment`) or the statement JSON |

**Staff routes** (`X-Ezymex-Staff-Id`, `X-Ezymex-Staff-Name` percent-encoded, `X-Ezymex-Staff-Role`, `X-Ezymex-Staff-Perms` = the caller's gateway permissions; only `reports.*` entries are read)

| Method & path | Permission | |
|---|---|---|
| `GET /v1/admin/status` | reports.read | mirror counts, last sync, SMTP / markups configured |
| `GET /v1/admin/pnl?from&to` | reports.read | `{totals, previous, activeTraders, book, daily[], bySymbol[], byGroup[], clients[]}` |
| `GET /v1/admin/deposits?from&to` | reports.read | `{totals, daily[], byCountry[], byIb[], byCampaign[], topDepositors[], ftdList[]}` |
| `GET /v1/admin/funnel?from&to` | reports.read | `{stages[], medianDaysToFtd, byCampaign[], byCountry[], daily[]}` |
| `GET /v1/admin/campaigns?from&to` | reports.read or marketing.read | UTM attribution of clients who signed up in the period: `{totals, items: {source, medium, campaign, signups, emailVerified, kycVerified, ftds, ftdAmount, deposits, withdrawals, net, conversion}[], bySource[]}`; no UTM = `(direct)` or `(IB link)` |
| `GET /v1/internal/client-facts` (X-Ezymex-Tenant) | internal token | `{items: {userId, firstDepositAt, firstLiveAccountAt, firstTradeAt}[]}` for growth journey triggers |
| `GET /v1/admin/cohorts?months=12` | reports.read | `{cohorts:[{cohort, clients, funded, retention[], ltv[]}], totals}` |
| `GET /v1/admin/activity?from&to` | reports.read | `{totals, daily[], byGroup[], topAccounts[]}` |
| `GET /v1/admin/partners?from&to` | reports.read | IB lines by kind, top IBs, IB / social / prop overviews |
| `GET /v1/admin/accounts/{login}/analytics?from&to` | reports.read | client analytics of one account (client 360) |
| `GET /v1/admin/export/{report}?from&to&format=csv\|xlsx` | reports.export | `report` = `pnl`, `deposits`, `funnel`, `cohorts`, `activity`, `partners`, `transactions`, `clients`, `trades`, `aml` (`&large=`). Audited |
| `GET /v1/admin/accounts/{login}/statement?from&to&format` | reports.export | any client's statement. Audited |
| `GET /v1/admin/schedules` | reports.read | `{items, runs (last 50), reports, email}` |
| `POST /v1/admin/schedules`, `PUT /v1/admin/schedules/{id}` | reports.export | `{name, report, format: xlsx\|csv, frequency: daily\|weekly\|monthly, weekday 1–7, monthDay 1–28, hour 0–23 (server time), recipients[1–20], enabled}` |
| `DELETE /v1/admin/schedules/{id}`, `POST /v1/admin/schedules/{id}/run` | reports.export | delete / send now |
| `POST /v1/admin/sync` | reports.read | run a mirror pass now |
| `GET /v1/admin/audit?limit` | reports.read | exports, statement downloads, schedule changes and runs |

## Permissions

The gateway RBAC already defines `reports.read` ("View reports") and `reports.export` ("Export reports"). Presets: platform owner / super admin / admin (all), finance (read + export), risk manager, compliance, sales, partner manager, marketing (read). The Back Office BFF (`apps/admin/app/api/reports`) checks the permission from the verified staff session and forwards the `reports.*` list in `X-Ezymex-Staff-Perms`; the service checks it again. Downloads and schedule changes need `reports.export`.

## How the apps integrate

| App | Integration |
|---|---|
| **Client Area** | `/api/reports/*` (`apps/crm/app/api/reports/[...path]/route.ts`) resolves the user from the session and calls the client routes. Pages: Portfolio → Analytics (`/portfolio/analytics`), Statements (`/portfolio/statements`: PDF / CSV / Excel for any period, monthly list), the account page's Analytics tab |
| **Back Office** | `/api/reports/*` → staff routes. Analytics → Broker P&L, Deposits & FTD, Funnel, Cohorts & LTV, Accounts & activity, Partners, Regulatory exports, Scheduled reports |

## Environment

| Variable | Default | |
|---|---|---|
| `REPORTS_BIND` | `127.0.0.1:8102` | |
| `REPORTS_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/ezymex_reports` | created and migrated on first start |
| `REPORTS_INTERNAL_TOKEN` | – | required when `REPORTS_ENV=production`; also in the CRM and admin env |
| `REPORTS_ENV` | `development` | |
| `REPORTS_TENANTS` | `ezymex` | tenants mirrored |
| `REPORTS_WORKERS` | `true` | mirror + scheduler (exactly one instance) |
| `REPORTS_SYNC_SECS` | `30` | |
| `REPORTS_LOG_FORMAT` | `json` | `json` or `pretty` |
| `REPORTS_COMPANY_NAME` / `_SITE` / `_SUPPORT_EMAIL` | `Ezymex` / `ezymex.com` / `support@ezymex.com` | statement footer |
| `TRADING_URL` / `TRADING_INTERNAL_TOKEN`, `WALLET_*`, `GATEWAY_*`, `IB_*`, `PROP_*` | local defaults | sources |
| `MARKET_DATA_URL` / `MARKET_DATA_ADMIN_TOKEN` | `http://127.0.0.1:8081` | spread markups |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `REPORTS_SMTP_FROM` | – / 587 / – / – / `Ezymex Reports <no-reply@ezymex.com>` | scheduled report emails (same relay as the gateway) |

Production runs `deploy/systemd/ezymex-reports.service`; `deploy/deploy.sh` builds it, generates `REPORTS_INTERNAL_TOKEN` once, derives `REPORTS_DATABASE_URL` (database `ezymex_reports`) from `GATEWAY_DATABASE_URL`, and writes `REPORTS_URL` / `REPORTS_INTERNAL_TOKEN` into the CRM and admin env.

## Tests

`cargo test -p reports`:

- **Metrics**: win rate, gross profit / loss, profit factor (and infinite PF), expectancy, reward:risk, average holding time (all / winners / losers), best / worst, streaks; drawdown and return with deposits and withdrawals removed; Sharpe, Sortino and volatility against a hand computation; carry-forward of missing days; revenge trades, risk per trade, overtrading; sessions; the P&L calendar's server days.
- **Statements**: summary totals and running balance reconcile with the ledger (deposits, trade results, commission, performance fees, bonus), charges, deal ↔ ledger checks, a missing trade result is detected, cent → USD conversion; options: own summary lines, the options section (premiums, settlements with the fixing, commission, realised P&L, counts), CFD-only closed trades, the option cash reconciliation (a missing settlement is detected), option trades in the statistics but never in lots, reason and ledger labels.
- **Options in files and the mirror**: the CSV / XLSX "Options summary" and "Options" tables and the PDF Options section (content streams decompressed and checked); `option_premium` / `option_settlement` are not money flows; broker revenue books option commission on every trade with no lots. `tests/options.rs` (throw-away `ezymex_reports_test_<pid>` database, skipped without PostgreSQL): the deal mirror keeps the `option` object, the statement, the monthly result (realised) and the P&L / activity reports end to end.
- **Files**: CSV quoting and formula-injection guard, XLSX container, PDF structure (every xref offset points at its object), Helvetica metrics and truncation, the logo paths.
- **Time and schedules**: DST offsets and server-day starts, next run times and report periods, recipient validation.

## Known gaps

- **PDF fonts.** Statements use the built-in Helvetica (WinAnsi); characters outside Latin-1 print as `?`. Embedding a Unicode TTF is the next step for non-Latin names.
- **Past equity.** Backfilled days know the balance only; floating P&L before the first snapshot is not reconstructed.
- **Spread estimates.** Current markups and base spreads are applied to past deals; crosses convert to USD at fixed approximate rates.
- **Engine feed.** Like the IB service, deals are pulled per account on version change; an ordered engine deal feed would make the mirror cheaper at scale.
- **Wallet fees** appear in client analytics (all accounts) but not in a single account's statement, since they are charged on the wallet.

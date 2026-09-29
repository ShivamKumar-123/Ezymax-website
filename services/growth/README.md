# growth

Kalks rewards and marketing (D29, D121, D135, D136, D144): loyalty points per lot with tiers and a redemption catalogue, cashback programmes, trading contests with live leaderboards and prizes, deposit / credit bonus campaigns with per-lot release, promo codes, targeted banners, and share P&L cards. It is a Rust service (axum 0.8, sqlx 0.9, PostgreSQL) on `127.0.0.1:8101`, database `kalks_growth`.

- [Run locally](#run-locally)
- [How it works](#how-it-works)
- [Rules](#rules)
- [API](#api)
- [Permissions](#permissions)
- [How the apps integrate](#how-the-apps-integrate)
- [Environment](#environment)
- [Tests](#tests)
- [Known gaps](#known-gaps)

## Run locally

PostgreSQL on `127.0.0.1:5433`, the gateway on `:8080`, the trading engine on `:8090` and the wallet on `:8095`. Without the wallet, cashback / prize / points payouts stay `pending` and are retried.

```bash
cargo build -p growth
(cd services/growth && GROWTH_LOG_FORMAT=pretty nohup ../../target/debug/growth > ~/.kalks-local/growth.log 2>&1 &)
curl -s localhost:8101/health
cargo test -p growth
```

On first start it creates `kalks_growth`, runs `migrations/`, and seeds tenant `kalks` with default settings, tiers (Bronze → Platinum), earning rules per asset class and a starter catalogue. It reads `GROWTH_*`, `GATEWAY_INTERNAL_TOKEN`, `TRADING_INTERNAL_TOKEN` and `WALLET_INTERNAL_TOKEN` from the repo-root `.env.local`.

## How it works

```
 gateway /v1/internal/referrals/users ──(every 30 s)──► profiles (name, country, KYC, sign-up date, referral code)
 engine  /v1/dealing/deals ──(close-time cursor + 2 min overlap, every 5 s)──► deals ─┬─► loyalty points (earn)
                                                                                     ├─► cashback accruals
                                                                                     ├─► bonus release per lot
                                                                                     └─► contest trades
 engine  /v1/accounts/{login}/ledger ──► bonus deposit trigger, removal on withdrawal, contest anti-cheat
 engine  POST /v1/admin/accounts/{login}/balance (bonus | credit | adjustment, reason code GRW-…) ◄── bonus grant / release / removal, credit prizes
 engine  POST /v1/accounts (demo) ◄── demo contest accounts
 wallet  POST /v1/wallets/transfers (refund = cashback, adjustment = prizes and points cashback) ◄── payouts
```

| Loop | Period | What it does |
|---|---|---|
| profiles | `GROWTH_SYNC_SECS` (30 s) | gateway users feed (keyset cursor) into `profiles` |
| deals | `GROWTH_DEALS_SECS` (5 s) | closing deals per tenant, each processed once (`deals.deal_id`) |
| bonus | 15 s | awaiting-deposit grants look for the qualifying deposit; posts pending grant / release / removal legs to the engine; expiry; removal on withdrawal |
| contests | `GROWTH_LEADERBOARD_SECS` (15 s) | start snapshots, live scores and ranks, anti-cheat flags, end freeze |
| payouts | 30 s | cashback payouts, prize and redemption wallet credits (idempotent keys, retried) |
| reversals | 10 min | reopened deals of the last 14 days: points reversed, unpaid cashback voided, contest trade removed |
| points expiry | hourly | points older than `pointsExpiryMonths` with no activity since are expired |

Every engine / wallet write carries an idempotency key derived from a row id (`growth:bonus:<event>:<leg>`, `growth:cashback:<payout>`, `growth:prize:<entry>`, `growth:redeem:<redemption>`), so a retry after a timeout never books twice. The engine answers a reused key with `409 duplicate_idempotency_key`, which counts as booked.

## Rules

| Area | Rule |
|---|---|
| Points (D135) | Per closed deal on a **live** account (demo when a rule says `accountType: "any"`), held ≥ `minHoldSeconds` (default 60 s), not a price correction. `points = floor(lots × pointsPerLot × tier multiplier)`. The first active rule that matches wins (priority ascending): symbol list, then asset class, then any; account groups filter (empty = all). Cent accounts: lots × 0.01 |
| Tiers | By points earned in the last 12 months (earn + bonus + promo). Multiplier applies to trading points only |
| Point value | `pointValue` USD per point (default 0.01) for display and the cost report |
| Expiry | Earned points expire after `pointsExpiryMonths` (default 12) without any earn |
| Redemption | Balance ≥ cost, tier ≥ `minTier`, stock > 0. `cashback` credits the wallet (`adjustment`), `bonus_credit` opens a bonus grant on a chosen live account with the item's release rate, `fee_discount` issues a voucher (see internal API). Points are deducted in the same transaction as the redemption row; a failed wallet credit is retried, never refunded silently |
| Cashback | Programme = USD per lot on matching symbols / asset classes / groups, live accounts only. Opt-in programmes need enrolment. `maxPerMonth` caps a client's monthly accrual. Accruals older than `cashbackHoldHours` (default 24; 0 in development) are paid to the wallet as one `refund` transfer per client |
| Bonus (D29) | `deposit` campaigns: bonus = min(deposit × pct / 100, cap), first qualifying `transfer_in` / `deposit` ≥ `minDeposit` on a live account after the claim (within `claimWindowDays`). `fixed` campaigns: a fixed amount on a chosen live account. The credit is posted to the engine's **bonus** sub-ledger (counts toward equity and margin, never withdrawable). Each closed lot releases `releasePerLot` USD: bonus −x and balance +x (`adjustment`), capped at the remaining amount. Lots required = amount ÷ releasePerLot. At `expiresAt` or on a withdrawal / transfer out (when `forfeitOnWithdrawal`), the unreleased remainder is removed (clamped to the account's bonus). One active grant per account |
| Promo codes (D144) | Kinds `bonus` (claims a campaign), `points`, `discount` (voucher). Active, inside the validity window, `uses < maxUses`, the client's uses < `perUserLimit`, segment rules (new users within `newUsersDays`, countries, KYC). Checked and counted under a row lock, so limits hold under concurrency. Blocked attempts are logged |
| Contests (D135) | `demo`: joining opens a dedicated demo account with `startingBalance` (credentials returned once). `live`: the client picks a live account (groups filter, `minEquity`). Scoring `return_pct` = (realised + floating) ÷ start equity × 100, `profit` = realised + floating, `lots` = lots closed. Only deals closed inside the window on the entered account count. Entrants with fewer than `minTrades` trades rank after everyone who qualifies. Ties: earlier join first |
| Anti-cheat | Flags (open for review): `balance_change` (deposit, withdrawal, transfer, refill or staff adjustment on the account during the contest; auto-disqualifies when `antiCheat.disqualifyOnBalanceChange`), `single_trade` (one trade > `maxSingleTradePct` of positive profit, with ≥ 3 trades), `short_holds` (> 50% of trades held < `minHoldSeconds`). Disqualified entries keep their row but get no rank and no prize |
| Prizes | Admin finalizes after the end (ranks frozen), then pays: `wallet` = wallet credit (`adjustment`), `credit` = engine `credit` on the entered live account (or the client's first live account) |
| Banners (D121) | Placement `dashboard` / `wallet` / `rewards` / `terminal`. Targeting: countries (ISO-2, empty = all), KYC statuses, account types (`live`, `demo`, `none` = no account), new users within N days. Active inside the window, highest priority first, dismissed ones hidden for that client |
| Share cards (D136) | Snapshot of one closed trade or a period on one account. Without `showAmounts` only the symbol, side, prices, % move / % return, trade count and win rate are stored; money amounts are stored only when the client opts in. Carries the client's referral code; the public page and image are at `/s/<code>` on the Client Area |

## API

Every route except `GET /health` needs `X-Kalks-Internal: $GROWTH_INTERNAL_TOKEN` and takes `X-Kalks-Tenant` (default `kalks`). JSON in and out, camelCase, money in USD as JSON numbers, times RFC 3339. Errors: `{"error": {"code", "message", "field"?}}` with 400 `bad_request`, 401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 409 (`limit_reached`, `already_joined`, `already_claimed`, `insufficient_points`, `out_of_stock`, `not_eligible`, `contest_closed`, `state`), 422 `validation` (+`field`), 503 `unavailable`.

### Client routes (Client Area BFF)

Headers: `X-Kalks-User-Id` (gateway user id, required), plus segment headers the BFF takes from the gateway session: `X-Kalks-Country`, `X-Kalks-Kyc` (`unverified|pending|verified|rejected`), `X-Kalks-Created-At` (RFC 3339), `X-Kalks-Name` (percent-encoded "First Last"), `X-Kalks-Referral-Code`. They also refresh the client's profile row.

| Method & path | Body / query | Response |
|---|---|---|
| `GET /v1/growth/me/rewards` | – | `Rewards` (below) |
| `GET /v1/growth/me/points?kind=&page=&limit=` | kind `earn|redeem|bonus|promo|expire|adjust|reversal` | `{items: PointsTx[], page, limit, total}` |
| `POST /v1/growth/me/redeem` | `{itemId, login?}` (login required for `bonus_credit`) | `{redemption: Redemption, balance}` |
| `GET /v1/growth/me/redemptions` | – | `{items: Redemption[]}` |
| `GET /v1/growth/me/vouchers` | – | `{items: Voucher[]}` |
| `GET /v1/growth/me/cashback` | – | `CashbackMe` |
| `POST /v1/growth/me/cashback/{programmeId}/enrol` | `{}` | `{enrolled: true}` |
| `GET /v1/growth/me/promotions` | – | `{campaigns: CampaignPublic[], grants: Grant[], promoHistory: PromoUse[]}` |
| `POST /v1/growth/me/bonuses/{campaignId}/claim` | `{login?}` (required for `fixed`) | `{grant: Grant}` |
| `POST /v1/growth/me/promo` | `{code, login?}` | `{result: {kind, message, grant?: Grant, points?: number, voucher?: Voucher}}` |
| `GET /v1/growth/me/contests` | – | `{items: ContestCard[], stats: {entered, prizesWon, prizeFinishes, bestRank|null, active}}` |
| `GET /v1/growth/me/contests/{id}` | – | `{contest: Contest, leaderboard: Standing[] (top 100), myEntry: Standing|null, entrants}` |
| `POST /v1/growth/me/contests/{id}/join` | `{login?}` (required for live) | `{entry: Standing, credentials?: {login, password, investorPassword}}` (demo only, shown once) |
| `GET /v1/growth/me/banners?placement=` | – | `{items: BannerView[]}` |
| `POST /v1/growth/me/banners/{id}/events` | `{kind: "impression"|"click"|"dismiss"}` | `{ok: true}` |
| `POST /v1/growth/me/shares` | `{kind: "trade", login, dealId, showAmounts}` or `{kind: "period", login, from, to, showAmounts}` | `{share: Share}` |
| `GET /v1/growth/me/shares` | – | `{items: Share[]}` |

Shapes:

```ts
Rewards = {
  points: { balance, lifetime, earnedThisMonth, lotsThisMonth, earned12m, expiringSoon: { points, at } | null },
  tier: { key, name, rank, multiplier, minPoints, perks: string[] },
  nextTier: { key, name, minPoints, pointsToGo } | null,
  tiers: Tier[],                      // {key, name, rank, minPoints, multiplier, perks[]}
  rules: EarnRule[],                  // {id, name, assetClass|null, symbols[], accountGroups[], accountType, pointsPerLot}
  pointValue, minHoldSeconds, pointsExpiryMonths,
  catalogue: CatalogueItem[],         // {id, name, description, kind, costPoints, value, minTier|null, stock|null, active, params}
  recent: PointsTx[],                 // last 10
  series: { day: "YYYY-MM-DD", points }[]   // last 30 days earned
}
PointsTx = { id, kind, points, description, login|null, dealId|null, createdAt }
Redemption = { id, itemId, itemName, kind, points, value, status: "pending"|"completed"|"failed", login|null, voucherCode|null, grantId|null, error|null, createdAt, completedAt|null }
Voucher = { id, code, kind: "fee_discount", pct, appliesTo: "any"|"prop"|"commission", status: "active"|"used"|"expired", expiresAt, usedAt|null, source }
CashbackMe = {
  programmes: { id, name, description, assetClasses[], symbols[], accountGroups[], usdPerLot, maxPerMonth|null, optIn, enrolled, startsAt, endsAt|null, lotsMonth, earnedMonth }[],
  totals: { accrued, paid, month, lifetime },   // accrued = not yet paid
  accruals: { id, programmeId, programme, dealId, login, symbol, lots, amount, status, createdAt }[],   // last 100
  payouts: { id, amount, status: "pending"|"paid"|"failed", createdAt, paidAt|null }[],
  series: { day, amount }[]                      // last 30 days
}
CampaignPublic = { id, name, description, terms, kind: "deposit"|"fixed", pct, cap, fixedAmount, minDeposit, releasePerLot, expiryDays, forfeitOnWithdrawal, claimWindowDays, startsAt, endsAt|null, eligible, reason|null, claimed }
Grant = { id, campaignId, campaign, status: "awaiting_deposit"|"pending"|"active"|"completed"|"forfeited"|"expired"|"cancelled"|"failed",
          source, login|null, depositAmount|null, amount, released, remaining, lotsTraded, lotsRequired, releasePerLot, progressPct,
          claimedAt, grantedAt|null, expiresAt|null, endedAt|null, endReason|null, claimDeadline|null }
PromoUse = { id, code, kind, status: "applied"|"blocked", reason|null, createdAt }
ContestCard = Contest & { myEntry: Standing|null }
Contest = { id, slug, name, description, kind: "demo"|"live", status: "draft"|"scheduled"|"running"|"ended"|"finalized"|"paid"|"cancelled",
            startsAt, endsAt, scoring: "return_pct"|"profit"|"lots", minTrades, maxEntrants|null, entrants, startingBalance|null,
            demoGroup|null, accountGroups[], kycRequired, minEquity|null, prizes: {rankFrom, rankTo, amount, payout: "wallet"|"credit"}[],
            prizePool, rules, antiCheat: {minHoldSeconds, maxSingleTradePct, disqualifyOnBalanceChange}, updatedAt }
Standing = { entryId, userId (own entry only, else null), name ("Arjun K."), country, login (own entry only, else null), rank|null,
             score, returnPct, profit, lots, trades, qualified, status: "active"|"disqualified", prize|null, prizeStatus, me: boolean, updatedAt }
BannerView = { id, title, body, ctaLabel|null, ctaUrl|null, imageUrl|null, tone: "ember"|"gold"|"neutral"|"up", placement, dismissible }
Share = { code, kind: "trade"|"period", login, showAmounts, createdAt, views, url: "/s/<code>", data: ShareData }
ShareData = { name, symbol|null, side|null, openPrice|null, closePrice|null, openTime|null, closeTime|null, movePct|null,
              returnPct|null, trades|null, winRate|null, lots|null, profit|null (only with showAmounts), currency, from|null, to|null,
              referralCode|null, brand: "Kalks" }
```

### Public routes (Client Area server only)

| `GET /v1/growth/public/shares/{code}` | – | `Share` (no login, no user id); counts a view unless `?view=0` |
|---|---|---|

### Internal routes (other services)

| Method & path | Body | Response |
|---|---|---|
| `POST /v1/growth/internal/vouchers/redeem` | `{userId, code, appliesTo, ref}` | `{pct, voucher}`; 404 unknown / 409 `used` / 409 `not_eligible` (other scope or expired). Idempotent on (code, ref) |
| `GET /v1/growth/internal/vouchers?user_id=` | – | `{items: Voucher[]}` active only |

### Back Office routes

Headers: `X-Kalks-Staff-Id`, `X-Kalks-Staff-Name` (percent-encoded), `X-Kalks-Staff-Role` and `X-Kalks-Staff-Perms`, set by the admin BFF after it verified the staff session. Writes are audited.

| Method & path | Perm | Body / query | Response |
|---|---|---|---|
| `GET /v1/growth/admin/overview` | read | – | `{loyalty:{members, pointsIssued30d, pointsRedeemed30d, liabilityPoints, liabilityUsd}, cashback:{accrued, paid30d}, bonus:{activeCampaigns, activeGrants, issued30d, released30d, forfeited30d, outstanding}, contests:{running, scheduled, entrants}, promos:{active, redemptions30d, blocked30d}, banners:{active, impressions30d, clicks30d}}` |
| `GET /v1/growth/admin/settings` · `PUT` | read · write | `Settings` `{pointValue, minHoldSeconds, pointsExpiryMonths, cashbackHoldHours, demoPoints}` | `Settings` |
| `GET /v1/growth/admin/tiers` · `PUT` | read · write | `{tiers: Tier[]}` (full replace, ranks 1..n, minPoints ascending) | `{tiers}` |
| `GET /v1/growth/admin/rules` · `POST` | read · write | `EarnRule` + `{active, priority}` | `{items}` / `{rule}` |
| `PATCH /v1/growth/admin/rules/{id}` | write | partial | `{rule}` |
| `GET /v1/growth/admin/catalogue` · `POST` | read · write | `CatalogueItem` | `{items}` / `{item}` |
| `PATCH /v1/growth/admin/catalogue/{id}` | write | partial | `{item}` |
| `GET /v1/growth/admin/redemptions?status=&page=&limit=` | read | – | `{items: (Redemption & {userId, name})[], total, page, limit}` |
| `POST /v1/growth/admin/redemptions/{id}/retry` | approve | `{}` | `{redemption}` |
| `GET /v1/growth/admin/members?q=&page=&limit=` | read | – | `{items: {userId, name, email, country, balance, lifetime, earned12m, tier, lastEarnAt}[], total}` |
| `POST /v1/growth/admin/points/adjust` | approve | `{userId, points (signed), note}` | `{balance}` |
| `GET /v1/growth/admin/cashback/programmes` · `POST` | read · write | `Programme` `{name, description, assetClasses[], symbols[], accountGroups[], usdPerLot, maxPerMonth|null, optIn, active, startsAt?, endsAt?}` | `{items: (Programme & {enrolled, accrued, paid, lots30d})[]}` / `{programme}` |
| `PATCH /v1/growth/admin/cashback/programmes/{id}` | write | partial | `{programme}` |
| `GET /v1/growth/admin/cashback/accruals?programme=&user=&status=&page=&limit=` | read | – | `{items, total}` |
| `GET /v1/growth/admin/cashback/payouts?status=&page=&limit=` | read | – | `{items: {id, userId, name, amount, status, attempts, error, createdAt, paidAt}[], total}` |
| `POST /v1/growth/admin/cashback/payouts/run` | approve | `{}` | `{created, amount}` (pays everything past the hold now) |
| `GET /v1/growth/admin/bonuses/campaigns` · `POST` | read · write | `Campaign` `{name, description, terms, kind, pct, cap, fixedAmount, minDeposit, releasePerLot, expiryDays, forfeitOnWithdrawal, claimWindowDays, accountGroups[], maxClaims|null, perUserLimit, newUsersDays|null, kycRequired, visibility: "public"|"code_only", status: "draft"|"active"|"paused"|"ended", startsAt?, endsAt?}` | `{items: (Campaign & {claims, active, issued, released, forfeited, outstanding})[]}` / `{campaign}` |
| `PATCH /v1/growth/admin/bonuses/campaigns/{id}` | write | partial | `{campaign}` |
| `GET /v1/growth/admin/bonuses/grants?campaign=&status=&user=&page=&limit=` | read | – | `{items: (Grant & {userId, name})[], total}` |
| `POST /v1/growth/admin/bonuses/grants` | approve | `{campaignId, userId, login, amount?, note}` | `{grant}` (manual grant; amount defaults to the campaign's fixed amount) |
| `POST /v1/growth/admin/bonuses/grants/{id}/cancel` | approve | `{note}` | `{grant}` (removes the unreleased remainder) |
| `GET /v1/growth/admin/promos` · `POST` | read · write | `Promo` `{code, description, kind: "bonus"|"points"|"discount", campaignId|null, points|null, discountPct|null, discountAppliesTo, maxUses|null, perUserLimit, newUsersDays|null, countries[], kycRequired, active, startsAt?, endsAt?}` | `{items: (Promo & {uses, blocked, lastUsedAt})[]}` / `{promo}` |
| `PATCH /v1/growth/admin/promos/{id}` | write | partial (not `code`) | `{promo}` |
| `GET /v1/growth/admin/promos/redemptions?promo=&status=&page=&limit=` | read | – | `{items: (PromoUse & {userId, name, promoId})[], total}` |
| `GET /v1/growth/admin/banners` · `POST` | read · write | `Banner` `{title, body, ctaLabel, ctaUrl, imageUrl, tone, placement, countries[], kyc[], accountTypes[], newUsersDays|null, priority, dismissible, active, startsAt?, endsAt?}` | `{items: (Banner & {impressions, clicks, dismissals, ctr})[]}` / `{banner}` |
| `PATCH /v1/growth/admin/banners/{id}` | write | partial | `{banner}` |
| `GET /v1/growth/admin/banners/preview?placement=&country=&kyc=&accountType=&signupDays=` | read | – | `{items: BannerView[], audience}` (what that segment sees; `audience` = profiles matching country/KYC/sign-up) |
| `GET /v1/growth/admin/contests` · `POST` | read · write | `Contest` input (`slug?`, name, description, kind, startsAt, endsAt, scoring, minTrades, maxEntrants, startingBalance, demoGroup, accountGroups, kycRequired, minEquity, prizes, rules, antiCheat, status: "draft"|"scheduled") | `{items: Contest[]}` / `{contest}` |
| `GET /v1/growth/admin/contests/{id}` | read | – | `{contest, leaderboard: (Standing & {userId, login, flags: string[], disqualifyReason})[], flags: Flag[]}` |
| `PATCH /v1/growth/admin/contests/{id}` | write | partial (timing, scoring and prizes only before the start) | `{contest}` |
| `POST /v1/growth/admin/contests/{id}/cancel` | write | `{note}` | `{contest}` |
| `POST /v1/growth/admin/contests/{id}/refresh` | write | `{}` | `{contest}` (recomputes scores now) |
| `POST /v1/growth/admin/contests/{id}/finalize` | write | `{}` | `{contest, leaderboard}` (after the end; ranks and prizes frozen) |
| `POST /v1/growth/admin/contests/{id}/pay` | approve | `{}` | `{paid, failed, amount}` |
| `POST /v1/growth/admin/contests/{id}/entries/{entryId}/disqualify` · `/reinstate` | write | `{reason}` | `{entry}` |
| `POST /v1/growth/admin/contests/{id}/flags/{flagId}/resolve` | write | `{action: "clear"|"disqualify", note}` | `{flag}` |
| `GET /v1/growth/admin/reports?from=&to=` | read | dates | `{from, to, totals: {bonusIssued, bonusReleased, bonusForfeited, cashbackPaid, cashbackAccrued, prizesPaid, pointsRedeemedUsd, redemptionCashPaid, promoRedemptions, total}, byCampaign: {id, name, issued, released, forfeited, claims}[], byProgramme: {id, name, accrued, paid, lots}[], byContest: {id, name, prizes, entrants}[], series: {day, bonus, cashback, prizes, points}[]}` (`total` = released bonus + cashback + prizes + redeemed points value; issued bonus is shown separately, it is not cash until released) |
| `GET /v1/growth/admin/audit?page=&limit=` | read | – | `{items: {id, at, actor, actorName, action, target, before, after, note}[], total}` |
| `POST /v1/growth/admin/run/{job}` | write | job `profiles|deals|bonus|contests|payouts|reversals|expiry` | `{ok, result}` |

## Permissions

The gateway RBAC (`services/gateway/src/rbac.rs`) defines `marketing.read`, `marketing.write` and `marketing.approve`. The Back Office BFF (`apps/admin/lib/marketing-perms.ts`) checks them per route and forwards the resolved list in `X-Kalks-Staff-Perms`; the service checks it again. Without that header (older sessions, other callers) the service falls back to these role lists:

| permission | allows | fallback roles |
|---|---|---|
| `marketing.read` | every GET | platform_owner, super_admin, admin, marketing, finance, compliance, support, risk_manager, partner_manager, viewer |
| `marketing.write` | campaigns, promos, banners, contests (create, edit, finalize, disqualify), rules, tiers, catalogue, programmes, settings, jobs | platform_owner, super_admin, admin, marketing |
| `marketing.approve` | money out: pay contest prizes, manual bonus grants and cancellations, points adjustments, run cashback payouts, retry redemptions | platform_owner, super_admin, admin, finance |

## How the apps integrate

| App | Integration |
|---|---|
| Client Area | BFF `app/api/growth/[[...path]]` → `/v1/growth/me/*` with the session user and segment headers. Pages: `/rewards` (contests), `/rewards/contests/[id]`, `/rewards/loyalty`, `/rewards/cashback`, `/rewards/promotions`. Banner slots (`components/growth/banner-slot.tsx`) on the dashboard and wallet. "Share P&L" on trade history. Public share page `/s/[code]` and PNG `/s/[code]/image` (next/og). |
| Back Office | BFF `app/api/marketing/[...path]` → `/v1/growth/admin/*` with permissions from `lib/marketing-perms.ts`. Pages under `/marketing`: bonuses, promo codes, banners, contests, rewards (rules, tiers, catalogue, redemptions), cashback, reports. |
| Other services | `POST /v1/growth/internal/vouchers/redeem` for fee-discount vouchers (prop checkout, commission rebates). |
| Notifications | Best effort `POST $NOTIFY_URL/v1/notify` `{userId, kind, title, body, link}` for bonus granted / released / forfeited, prize paid, redemption completed. Ignored when the service is absent. |

## Environment

| Variable | Default | |
|---|---|---|
| `GROWTH_BIND` | `127.0.0.1:8101` | |
| `GROWTH_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/kalks_growth` | created and migrated on first start |
| `GROWTH_INTERNAL_TOKEN` | – | required when `GROWTH_ENV=production` |
| `GROWTH_ENV` | `development` | |
| `GROWTH_WORKERS` | `true` | tests turn the loops off |
| `GROWTH_DEALS_SECS` / `GROWTH_SYNC_SECS` / `GROWTH_LEADERBOARD_SECS` | 5 / 30 / 15 | |
| `GROWTH_LOG_FORMAT` | `json` | or `pretty` |
| `GATEWAY_URL` / `GATEWAY_INTERNAL_TOKEN` | `http://127.0.0.1:8080` | profiles feed |
| `TRADING_URL` / `TRADING_INTERNAL_TOKEN` | `http://127.0.0.1:8090` | deals, accounts, ledgers, bonus / credit postings |
| `WALLET_URL` / `WALLET_INTERNAL_TOKEN` | `http://127.0.0.1:8095` | payouts |
| `NOTIFY_URL` | `http://127.0.0.1:8100` | optional |
| `INSTRUMENTS_FILE` | `config/instruments.json` | symbol → asset class |

Production runs `deploy/systemd/kalks-growth.service`. `deploy/deploy.sh` builds it, generates `GROWTH_INTERNAL_TOKEN` once, derives `GROWTH_DATABASE_URL` (database `kalks_growth`) from the gateway's, and writes `GROWTH_URL` / `GROWTH_INTERNAL_TOKEN` into the Client Area and Back Office env files.

## Tests

```bash
cargo test -p growth
```

- Unit (`src/calc.rs`): points per lot with rule matching, tier multiplier and cent lots; cashback with the monthly cap; bonus amount (pct + cap, min deposit) and release per lot (partial, capped, completion); promo eligibility (window, limits, per-user, segments); contest scoring, ranking (min trades, ties, disqualified) and prize allocation; anti-cheat flags.
- Integration (`tests/growth.rs`, throw-away database `kalks_growth_test_<pid>_<n>`, skipped without PostgreSQL; engine and wallet are mock HTTP servers): deal ingest → points / cashback / bonus release / contest trades once per deal; promo limits under 20 concurrent redemptions; bonus grant → release legs → completion; redemption → wallet credit with idempotent retry.

## Known gaps

- The engine has no deals-since-id feed (same gap as the IB service): the poller re-reads a 2-minute overlap and caches account type / group per login.
- Bonus release reversal: when the desk reopens a deal after its lots released bonus, the release stays (logged for review).
- Credit is not removed on stop-out by the engine; the bonus grant is capped at the account's actual bonus when removed.
- UTM campaign attribution and trigger journeys (D144) are not in this service yet; `/marketing/campaigns` and `/marketing/automation` stay demo-only.
- Wallet transfer kinds: cashback uses `refund`, prizes and points cashback use `adjustment` (no dedicated `cashback` / `prize` kind yet).

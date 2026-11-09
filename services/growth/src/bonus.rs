//! Bonus campaigns (D29): claims, the deposit trigger, engine postings (grant / release / remove), expiry and
//! removal on withdrawal.
//!
//! The credit lives on the engine's `bonus` sub-ledger (counts toward equity and margin, never withdrawable).
//! Every movement is a `bonus_events` row posted with an idempotency key; a release is two legs (bonus −x,
//! balance +x as an `adjustment`), tracked by `legs_done` so a crash between the legs resumes at the second.

use crate::audit::{self, Actor};
use crate::calc::{self, Limits, Segment};
use crate::clients::{self, EngineOutcome};
use crate::error::{ApiError, ApiResult};
use crate::model::opt_num;
use crate::money::{D, ZERO, num};
use crate::state::AppState;
use chrono::{DateTime, Duration, Utc};
use serde_json::{Value, json};
use sqlx::Row;

pub const REASON_GRANT: &str = "GRW-01 · Bonus credit";
pub const REASON_RELEASE: &str = "GRW-02 · Bonus release per lot";
pub const REASON_REMOVE: &str = "GRW-03 · Bonus removal";
pub const REASON_PRIZE: &str = "GRW-04 · Contest prize";

pub fn campaign_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "name": r.get::<String, _>("name"),
        "description": r.get::<String, _>("description"),
        "terms": r.get::<String, _>("terms"),
        "kind": r.get::<String, _>("kind"),
        "pct": num(r.get("pct")),
        "cap": num(r.get("cap")),
        "fixedAmount": num(r.get("fixed_amount")),
        "minDeposit": num(r.get("min_deposit")),
        "releasePerLot": num(r.get("release_per_lot")),
        "expiryDays": r.get::<i32, _>("expiry_days"),
        "forfeitOnWithdrawal": r.get::<bool, _>("forfeit_on_withdrawal"),
        "claimWindowDays": r.get::<i32, _>("claim_window_days"),
        "accountGroups": r.get::<Vec<String>, _>("account_groups"),
        "maxClaims": r.get::<Option<i32>, _>("max_claims"),
        "perUserLimit": r.get::<i32, _>("per_user_limit"),
        "newUsersDays": r.get::<Option<i32>, _>("new_users_days"),
        "kycRequired": r.get::<bool, _>("kyc_required"),
        "autoGrant": r.get::<bool, _>("auto_grant"),
        "visibility": r.get::<String, _>("visibility"),
        "status": r.get::<String, _>("status"),
        "startsAt": r.get::<DateTime<Utc>, _>("starts_at"),
        "endsAt": r.get::<Option<DateTime<Utc>>, _>("ends_at"),
        "deletedAt": r.get::<Option<DateTime<Utc>>, _>("deleted_at"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "updatedAt": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

/// `SELECT g.*, c.name AS campaign_name FROM bonus_grants g JOIN bonus_campaigns c …` row → Grant JSON.
pub fn grant_json(r: &sqlx::postgres::PgRow) -> Value {
    let amount: D = r.get("amount");
    let released: D = r.get("released");
    let removed: D = r.get("removed");
    let rpl: D = r.get("release_per_lot");
    let lots_required = calc::lots_required(amount, rpl);
    let progress = if amount > ZERO { crate::money::r2(released / amount * crate::money::HUNDRED) } else { ZERO };
    let status: String = r.get("status");
    let remaining = if matches!(status.as_str(), "active" | "pending") { amount - released - removed } else { ZERO };
    json!({
        "id": r.get::<i64, _>("id"),
        "campaignId": r.get::<i64, _>("campaign_id"),
        "campaign": r.get::<String, _>("campaign_name"),
        "status": status,
        "source": r.get::<String, _>("source"),
        "login": r.get::<Option<i64>, _>("login"),
        "depositAmount": opt_num(r.get("deposit_amount")),
        "amount": num(amount),
        "released": num(released),
        "removed": num(removed),
        "remaining": num(remaining.max(ZERO)),
        "lotsTraded": num(r.get("lots_traded")),
        "lotsRequired": num(lots_required),
        "releasePerLot": num(rpl),
        "progressPct": num(progress),
        "claimedAt": r.get::<DateTime<Utc>, _>("claimed_at"),
        "grantedAt": r.get::<Option<DateTime<Utc>>, _>("granted_at"),
        "expiresAt": r.get::<Option<DateTime<Utc>>, _>("expires_at"),
        "endedAt": r.get::<Option<DateTime<Utc>>, _>("ended_at"),
        "endReason": r.get::<Option<String>, _>("end_reason"),
        "claimDeadline": r.get::<Option<DateTime<Utc>>, _>("claim_deadline"),
    })
}

pub const GRANT_SELECT: &str = "SELECT g.*, c.name AS campaign_name FROM bonus_grants g JOIN bonus_campaigns c ON c.id = g.campaign_id";

pub async fn grant_by_id(st: &AppState, id: i64) -> anyhow::Result<Value> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("{GRANT_SELECT} WHERE g.id = $1"))).bind(id).fetch_one(&st.pool).await?;
    Ok(grant_json(&r))
}

pub fn limits_of(c: &sqlx::postgres::PgRow, claims: i64, user_claims: i64) -> Limits {
    Limits {
        active: c.get::<String, _>("status") == "active",
        starts_at: Some(c.get("starts_at")),
        ends_at: c.get("ends_at"),
        max_uses: c.get::<Option<i32>, _>("max_claims").map(i64::from),
        uses: claims,
        per_user_limit: c.get::<i32, _>("per_user_limit") as i64,
        user_uses: user_claims,
        new_users_days: c.get::<Option<i32>, _>("new_users_days").map(i64::from),
        countries: vec![],
        kyc_required: c.get("kyc_required"),
    }
}

/// Counts that limit a campaign: all claims except cancelled / failed ones.
pub async fn claim_counts(ex: &mut sqlx::PgConnection, campaign: i64, user: i64) -> anyhow::Result<(i64, i64)> {
    let (all, mine): (i64, i64) = sqlx::query_as(
        "SELECT count(*), count(*) FILTER (WHERE user_id = $2) FROM bonus_grants WHERE campaign_id = $1 AND status NOT IN ('cancelled','failed')",
    )
    .bind(campaign)
    .bind(user)
    .fetch_one(&mut *ex)
    .await?;
    Ok((all, mine))
}

/// A live account of the client that the campaign's groups allow.
pub async fn check_account(st: &AppState, tenant: &str, user_id: i64, login: i64, groups: &[String]) -> ApiResult<clients::Account> {
    let acc = clients::account(st, tenant, login).await.map_err(|e| ApiError::Unavailable(format!("The trading engine is unavailable ({e}).")))?.ok_or_else(|| crate::error::invalid("login", "Account not found."))?;
    if acc.user_id != user_id {
        return Err(crate::error::invalid("login", "Account not found."));
    }
    if acc.kind != "live" {
        return Err(crate::error::invalid("login", "Bonuses apply to live accounts only."));
    }
    if !groups.is_empty() && !groups.iter().any(|g| g.eq_ignore_ascii_case(&acc.group)) {
        return Err(crate::error::invalid("login", "This offer isn't available for that account type."));
    }
    Ok(acc)
}

pub struct ClaimOpts<'a> {
    pub source: &'a str,
    /// Claims through the claim button need a public campaign; promo codes may unlock code-only ones.
    pub require_public: bool,
    pub amount_override: Option<D>,
    pub note: Option<String>,
    pub skip_limits: bool,
}

/// Opens a grant inside `tx` (caller commits). Deposit campaigns wait for the deposit; fixed ones are queued
/// for posting at once on `login`.
pub async fn claim_in(tx: &mut sqlx::PgConnection, tenant: &str, user_id: i64, campaign_id: i64, account: Option<&clients::Account>, seg: &Segment, o: &ClaimOpts<'_>) -> ApiResult<i64> {
    let c = sqlx::query("SELECT * FROM bonus_campaigns WHERE id = $1 AND tenant = $2 AND deleted_at IS NULL FOR UPDATE").bind(campaign_id).bind(tenant).fetch_optional(&mut *tx).await?.ok_or(ApiError::NotFound)?;
    if o.require_public && c.get::<String, _>("visibility") != "public" {
        return Err(ApiError::NotFound);
    }
    if !o.skip_limits {
        let (all, mine) = claim_counts(tx, campaign_id, user_id).await?;
        if let Err((code, msg)) = calc::check_limits(&limits_of(&c, all, mine), seg, Utc::now()) {
            return Err(ApiError::Conflict { code: if code == "limit_reached" { "already_claimed" } else { "not_eligible" }, message: msg });
        }
    }
    let kind: String = c.get("kind");
    let rpl: D = c.get("release_per_lot");
    let expiry: i32 = c.get("expiry_days");
    let window: i32 = c.get("claim_window_days");
    let id: i64 = if kind == "deposit" {
        sqlx::query_scalar(
            "INSERT INTO bonus_grants (tenant, campaign_id, user_id, source, status, login, cent, release_per_lot, expiry_days, claim_deadline, note)
             VALUES ($1,$2,$3,$4,'awaiting_deposit',$5,$6,$7,$8,$9,$10) RETURNING id",
        )
        .bind(tenant)
        .bind(campaign_id)
        .bind(user_id)
        .bind(o.source)
        .bind(account.map(|a| a.login))
        .bind(account.is_some_and(|a| a.cent))
        .bind(rpl)
        .bind(expiry)
        .bind(Utc::now() + Duration::days(window.max(1) as i64))
        .bind(&o.note)
        .fetch_one(&mut *tx)
        .await?
    } else {
        let acc = account.ok_or_else(|| crate::error::invalid("login", "Choose the live account for the bonus."))?;
        let amount = o.amount_override.unwrap_or_else(|| c.get("fixed_amount"));
        if amount <= ZERO {
            return Err(crate::error::invalid("amount", "The bonus amount must be positive."));
        }
        queue_grant(tx, tenant, campaign_id, user_id, o.source, acc.login, acc.cent, amount, None, None, rpl, expiry, o.note.as_deref()).await?
    };
    Ok(id)
}

/// Inserts a `pending` grant on an account and its `grant` leg. 409 when the account already has a bonus.
#[allow(clippy::too_many_arguments)]
pub async fn queue_grant(tx: &mut sqlx::PgConnection, tenant: &str, campaign_id: i64, user_id: i64, source: &str, login: i64, cent: bool, amount: D, deposit: Option<D>, deposit_txn: Option<i64>, rpl: D, expiry_days: i32, note: Option<&str>) -> ApiResult<i64> {
    let busy: Option<i64> = sqlx::query_scalar("SELECT id FROM bonus_grants WHERE login = $1 AND status IN ('pending','active')").bind(login).fetch_optional(&mut *tx).await?;
    if busy.is_some() {
        return Err(ApiError::Conflict { code: "not_eligible", message: "That account already has an active bonus.".into() });
    }
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO bonus_grants (tenant, campaign_id, user_id, source, status, login, cent, deposit_amount, deposit_txn, amount, release_per_lot, expiry_days, note)
         VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
    )
    .bind(tenant)
    .bind(campaign_id)
    .bind(user_id)
    .bind(source)
    .bind(login)
    .bind(cent)
    .bind(deposit)
    .bind(deposit_txn)
    .bind(amount)
    .bind(rpl)
    .bind(expiry_days)
    .bind(note)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO bonus_events (grant_id, tenant, kind, amount, ref) VALUES ($1,$2,'grant',$3,'grant')").bind(id).bind(tenant).bind(amount).execute(&mut *tx).await?;
    Ok(id)
}

/// Queues removal of the unreleased remainder and ends the grant.
pub async fn end_grant(tx: &mut sqlx::PgConnection, grant_id: i64, status: &str, reason: &str) -> anyhow::Result<D> {
    let g = sqlx::query("SELECT tenant, status, amount, released, removed FROM bonus_grants WHERE id = $1 FOR UPDATE").bind(grant_id).fetch_one(&mut *tx).await?;
    let cur: String = g.get("status");
    if cur == "awaiting_deposit" {
        sqlx::query("UPDATE bonus_grants SET status = $2, ended_at = now(), end_reason = $3 WHERE id = $1").bind(grant_id).bind(status).bind(reason).execute(&mut *tx).await?;
        return Ok(ZERO);
    }
    if !matches!(cur.as_str(), "active" | "pending") {
        return Ok(ZERO);
    }
    let amount: D = g.get("amount");
    let remaining = (amount - g.get::<D, _>("released") - g.get::<D, _>("removed")).max(ZERO);
    if remaining > ZERO {
        let tenant: String = g.get("tenant");
        sqlx::query("INSERT INTO bonus_events (grant_id, tenant, kind, amount, ref) VALUES ($1,$2,'remove',$3,$4) ON CONFLICT DO NOTHING").bind(grant_id).bind(&tenant).bind(remaining).bind(reason).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE bonus_grants SET status = $2, removed = removed + $3, ended_at = now(), end_reason = $4 WHERE id = $1").bind(grant_id).bind(status).bind(remaining).bind(reason).execute(&mut *tx).await?;
    Ok(remaining)
}

/// Why a campaign cannot be `active` with these dates. A running campaign needs an end, because the lifecycle
/// worker is what closes it (the Back Office asks for the dates when a campaign is activated), and an end that
/// has already passed would close it on the next tick.
pub fn activation_problem(status: &str, ends: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Option<(&'static str, &'static str)> {
    if status != "active" {
        return None;
    }
    match ends {
        None => Some(("endsAt", "Set when the campaign ends. It closes itself at that time.")),
        Some(e) if e <= now => Some(("endsAt", "The end date has passed. Move it forward to run the campaign again.")),
        Some(_) => None,
    }
}

// ---------------------------------------------------------------- workers

/// Awaiting-deposit grants: find the first qualifying deposit after the claim, or expire the claim.
///
/// The deposit the grant pays on is a transfer into a trading account made after the claim. The money behind
/// it is checked against the wallet from the day the campaign opened, not from the claim: the usual order for
/// a new client is to pay into the wallet first, find the offer and press Claim, and only then move the money
/// to a trading account. Counting from the claim would see no money at all for that client and leave the
/// grant waiting for ever, with nothing on screen to say why. It is the same window the automatic grant uses.
pub async fn deposit_tick(st: &AppState) -> anyhow::Result<usize> {
    let rows = sqlx::query(
        "SELECT g.id, g.tenant, g.user_id, g.login, g.claimed_at, g.claim_deadline, c.starts_at, c.pct, c.cap, c.min_deposit, c.account_groups, c.release_per_lot, c.expiry_days
         FROM bonus_grants g JOIN bonus_campaigns c ON c.id = g.campaign_id
         WHERE g.status = 'awaiting_deposit' AND (g.ledger_checked IS NULL OR g.ledger_checked < now() - interval '10 seconds') ORDER BY g.id LIMIT 200",
    )
    .fetch_all(&st.pool)
    .await?;
    let mut n = 0;
    for g in rows {
        let id: i64 = g.get("id");
        let tenant: String = g.get("tenant");
        let user: i64 = g.get("user_id");
        let deadline: Option<DateTime<Utc>> = g.get("claim_deadline");
        if deadline.is_some_and(|d| Utc::now() > d) {
            let mut tx = st.pool.begin().await?;
            end_grant(&mut tx, id, "expired", "no_deposit").await?;
            tx.commit().await?;
            continue;
        }
        sqlx::query("UPDATE bonus_grants SET ledger_checked = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        let groups: Vec<String> = g.get("account_groups");
        let accounts = match g.get::<Option<i64>, _>("login") {
            Some(l) => clients::account(st, &tenant, l).await?.into_iter().collect::<Vec<_>>(),
            None => clients::accounts_of(st, &tenant, user, Some("live")).await?,
        };
        let claimed: DateTime<Utc> = g.get("claimed_at");
        let funded_since: DateTime<Utc> = g.get("starts_at");
        for acc in accounts.iter().filter(|a| a.kind == "live" && (groups.is_empty() || groups.iter().any(|x| x.eq_ignore_ascii_case(&a.group)))) {
            let ledger = clients::ledger(st, &tenant, acc.login, user, claimed).await?;
            let deposits: Vec<(i64, D)> = ledger
                .iter()
                .filter(|l| calc::is_deposit_kind(&l.kind) && l.sub_ledger == "balance" && l.amount > ZERO && l.at >= claimed)
                .map(|l| (l.txn, l.amount))
                .collect();
            // A trading account is funded by moving money out of the client's own wallet, so a transfer in is
            // not proof that any money came into the platform. The wallet is asked what the client has really
            // paid in since the campaign opened, and the offer pays on no more than that: otherwise a client
            // can shuttle the same balance between their two pockets and be paid for it every time.
            let Some(paid_in) = clients::wallet_deposited(st, &tenant, user, funded_since.min(claimed)).await else { continue };
            let backed: Vec<(i64, D)> = deposits.iter().map(|&(txn, amount)| (txn, amount.min(paid_in))).collect();
            let Some((dep_txn, dep_amount, bonus)) = calc::paying_deposit(&backed, g.get("pct"), g.get("cap"), g.get("min_deposit")) else { continue };
            let mut tx = st.pool.begin().await?;
            let still: Option<String> = sqlx::query_scalar("SELECT status FROM bonus_grants WHERE id = $1 FOR UPDATE").bind(id).fetch_one(&mut *tx).await?;
            if still.as_deref() != Some("awaiting_deposit") {
                break;
            }
            let busy: Option<i64> = sqlx::query_scalar("SELECT id FROM bonus_grants WHERE login = $1 AND status IN ('pending','active')").bind(acc.login).fetch_optional(&mut *tx).await?;
            if busy.is_some() {
                continue;
            }
            sqlx::query("UPDATE bonus_grants SET status = 'pending', login = $2, cent = $3, deposit_amount = $4, deposit_txn = $5, amount = $6 WHERE id = $1")
                .bind(id)
                .bind(acc.login)
                .bind(acc.cent)
                .bind(dep_amount)
                .bind(dep_txn)
                .bind(bonus)
                .execute(&mut *tx)
                .await?;
            sqlx::query("INSERT INTO bonus_events (grant_id, tenant, kind, amount, ref) VALUES ($1,$2,'grant',$3,'grant') ON CONFLICT DO NOTHING").bind(id).bind(&tenant).bind(bonus).execute(&mut *tx).await?;
            audit::record(&mut *tx, &tenant, &Actor::system(), "bonus.deposit_matched", Some(format!("grant:{id}")), None, Some(json!({"login": acc.login, "deposit": num(dep_amount), "bonus": num(bonus)})), None).await?;
            tx.commit().await?;
            n += 1;
            break;
        }
    }
    if n > 0 {
        st.wake.notify_one();
    }
    Ok(n)
}

/// Deposit campaigns the broker marked `auto_grant`: the offer the banner actually promises. The bonus is
/// granted on the first qualifying deposit a client makes while the campaign is running, without their having
/// to find the Promotions page and press Claim beforehand.
///
/// Three things are worth knowing about what "first deposit" means here.
///
/// It is the client's **first deposit ever**, and it has to land while the campaign is running. Both halves
/// matter and neither implies the other: a client who funded an account last year and tops up during the
/// campaign is not making a first deposit, and a genuine first deposit made before the campaign opened is
/// not this offer's to pay. The engine answers the first half, because only it can see the whole history.
///
/// Deposits are read from the engine's cursor feed, oldest first, so the work is the number of new deposits
/// and not the number of clients, and the cursor only moves past a deposit once it has been dealt with.
///
/// A client who already has a grant on the campaign - because they claimed it by hand - is skipped and left to
/// `deposit_tick`, so the two paths can never both pay for the same offer.
pub async fn auto_grant_tick(st: &AppState) -> anyhow::Result<usize> {
    let mut granted = 0;
    for tenant in crate::db::tenants(&st.pool).await? {
        let campaigns = sqlx::query(
            "SELECT * FROM bonus_campaigns WHERE tenant = $1 AND auto_grant AND kind = 'deposit' AND status = 'active' AND deleted_at IS NULL AND deleted_at IS NULL
               AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()) ORDER BY id",
        )
        .bind(&tenant)
        .fetch_all(&st.pool)
        .await?;
        if campaigns.is_empty() {
            continue;
        }
        let cursor: i64 = sqlx::query_scalar("SELECT after_txn FROM funding_cursor WHERE tenant = $1").bind(&tenant).fetch_optional(&st.pool).await?.unwrap_or(0);
        let feed = clients::funding(st, &tenant, cursor, 200).await?;
        if feed.is_empty() {
            continue;
        }
        // The cursor marks what has been *settled*, not merely what has been read. A deposit that qualifies
        // but for something that can still change - a client who paid before verifying, which is the usual
        // order for a new sign-up - holds it back, so the offer is still theirs when they verify. Everything
        // after it is still processed, so nobody waits behind them; only the mark stops moving.
        let mut seen = cursor;
        let mut held = false;
        for f in &feed {
            for c in &campaigns {
                match grant_for_deposit(st, &tenant, c, f).await {
                    Ok(Outcome::Granted) => granted += 1,
                    Ok(Outcome::Settled) => {}
                    Ok(Outcome::Waiting) => held = true,
                    // one client's problem must not stall the feed for everyone behind them, and an error is
                    // not a decision: the deposit is looked at again next time
                    Err(e) => {
                        held = true;
                        tracing::warn!(error = %e, txn = f.txn, user = f.user_id, "automatic bonus skipped");
                    }
                }
            }
            if !held {
                seen = f.txn;
            }
        }
        sqlx::query("INSERT INTO funding_cursor (tenant, after_txn) VALUES ($1,$2) ON CONFLICT (tenant) DO UPDATE SET after_txn = GREATEST(funding_cursor.after_txn, $2), updated_at = now()")
            .bind(&tenant)
            .bind(seen)
            .execute(&st.pool)
            .await?;
    }
    if granted > 0 {
        st.wake.notify_one();
    }
    Ok(granted)
}

/// Whether a deposit is one this campaign is offering to pay on: the client's first ever, landed inside the
/// campaign's own dates, on an account group the campaign covers.
///
/// `first_ever` and the dates are separate tests and the offer needs both. Dropping the first would pay an
/// existing client for topping up; dropping the second would pay for a first deposit made long before the
/// campaign opened.
pub fn deposit_in_scope(first_ever: bool, at: DateTime<Utc>, starts: DateTime<Utc>, ends: Option<DateTime<Utc>>, groups: &[String], group: &str) -> bool {
    first_ever && at >= starts && !ends.is_some_and(|e| at >= e) && (groups.is_empty() || groups.iter().any(|g| g.eq_ignore_ascii_case(group)))
}

/// What became of one deposit, which decides whether the cursor may move past it.
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    /// A bonus was queued.
    Granted,
    /// Nothing to do, and nothing that could change it: the wrong dates, not a first deposit, under the
    /// minimum, already granted, or the campaign's own limits reached.
    Settled,
    /// It would qualify, but for something that can still change - so far only a client who has not yet
    /// verified. Worth looking at again.
    Waiting,
}

/// One deposit against one campaign.
async fn grant_for_deposit(st: &AppState, tenant: &str, c: &sqlx::postgres::PgRow, f: &clients::Funding) -> anyhow::Result<Outcome> {
    let groups: Vec<String> = c.get("account_groups");
    if !deposit_in_scope(f.first_ever, f.at, c.get("starts_at"), c.get("ends_at"), &groups, &f.group) {
        return Ok(Outcome::Settled);
    }
    // The feed shows money arriving at a trading account, which is a transfer out of the client's own wallet
    // and says nothing about whether any money came into the platform. The wallet is asked what they have
    // really paid in since the campaign opened, and the offer pays on no more than that. Without this a client
    // can move the same balance from wallet to account and be paid a "first deposit" bonus on their own money.
    let starts: DateTime<Utc> = c.get("starts_at");
    let Some(paid_in) = clients::wallet_deposited(st, tenant, f.user_id, starts).await else {
        // the wallet is unreachable; not knowing is not the same as nothing, so look again next pass
        return Ok(Outcome::Waiting);
    };
    let Some(bonus) = calc::deposit_bonus(f.amount.min(paid_in), c.get("pct"), c.get("cap"), c.get("min_deposit")) else { return Ok(Outcome::Settled) };
    let seg = crate::profiles::get(st, tenant, f.user_id).await?.segment();
    let campaign_id: i64 = c.get("id");

    // Paying before verifying is the usual order for a new sign-up, and verification is the one gate here
    // that is a matter of time rather than of fact. So this deposit is left open: the client keeps the offer
    // if they verify while the campaign is still running, instead of losing it for having paid first.
    if c.get::<bool, _>("kyc_required") && seg.kyc != "verified" {
        return Ok(Outcome::Waiting);
    }

    let mut tx = st.pool.begin().await?;
    // the campaign row is taken for update so two deposits landing together cannot both pass the limit check
    sqlx::query("SELECT 1 FROM bonus_campaigns WHERE id = $1 FOR UPDATE").bind(campaign_id).fetch_optional(&mut *tx).await?;
    let (all, mine) = claim_counts(&mut tx, campaign_id, f.user_id).await?;
    if mine > 0 {
        return Ok(Outcome::Settled); // claimed by hand, or already granted: deposit_tick owns it
    }
    if calc::check_limits(&limits_of(c, all, mine), &seg, Utc::now()).is_err() {
        return Ok(Outcome::Settled);
    }
    let id = match queue_grant(&mut tx, tenant, campaign_id, f.user_id, "auto", f.login, f.cent, bonus, Some(f.amount.min(paid_in)), Some(f.txn), c.get("release_per_lot"), c.get("expiry_days"), None).await {
        Ok(id) => id,
        // the account already carries a bonus: not an error, just not this one's turn
        Err(ApiError::Conflict { .. }) => return Ok(Outcome::Settled),
        // ApiError is an HTTP shape and there is no request here, so it is reported rather than returned
        Err(ApiError::Internal(e)) => return Err(e),
        Err(e) => anyhow::bail!("queue grant for login {}: {e:?}", f.login),
    };
    audit::record(
        &mut *tx,
        tenant,
        &Actor::system(),
        "bonus.auto_granted",
        Some(format!("grant:{id}")),
        None,
        Some(json!({"login": f.login, "deposit": num(f.amount), "bonus": num(bonus), "txn": f.txn})),
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(Outcome::Granted)
}

/// Posts pending legs to the engine in id order per grant, round after round while legs keep booking (a
/// grant's later leg becomes eligible once the earlier one is booked).
pub async fn post_tick(st: &AppState) -> anyhow::Result<usize> {
    let mut total = 0;
    for _ in 0..20 {
        let n = post_round(st).await?;
        total += n;
        if n == 0 {
            break;
        }
    }
    Ok(total)
}

async fn post_round(st: &AppState) -> anyhow::Result<usize> {
    let rows = sqlx::query(
        "SELECT e.id, e.grant_id, e.tenant, e.kind, e.amount, e.legs_done, e.attempts, g.login, g.cent, g.user_id, g.expiry_days, c.name AS campaign
         FROM bonus_events e JOIN bonus_grants g ON g.id = e.grant_id JOIN bonus_campaigns c ON c.id = g.campaign_id
         WHERE e.status = 'pending' AND e.next_try_at <= now()
           AND NOT EXISTS (SELECT 1 FROM bonus_events p WHERE p.grant_id = e.grant_id AND p.id < e.id AND p.status <> 'booked')
         ORDER BY e.id LIMIT 100",
    )
    .fetch_all(&st.pool)
    .await?;
    let mut n = 0;
    for e in rows {
        let id: i64 = e.get("id");
        let grant: i64 = e.get("grant_id");
        let tenant: String = e.get("tenant");
        let kind: String = e.get("kind");
        let mut amount: D = e.get("amount");
        let Some(login) = e.get::<Option<i64>, _>("login") else { continue };
        let cent: bool = e.get("cent");
        let user: i64 = e.get("user_id");
        let campaign: String = e.get("campaign");
        let mut legs: i32 = e.get("legs_done");
        let outcome = match kind.as_str() {
            "grant" => clients::post_balance(st, &tenant, login, cent, "bonus", amount, &format!("growth:bonus:{id}:g"), REASON_GRANT, &format!("{campaign} (grant {grant})")).await,
            "release" => {
                let mut o = EngineOutcome::Booked;
                if legs == 0 {
                    o = clients::post_balance(st, &tenant, login, cent, "bonus", -amount, &format!("growth:bonus:{id}:b"), REASON_RELEASE, &format!("{campaign} (grant {grant}) released per lot")).await;
                    if matches!(o, EngineOutcome::Booked) {
                        legs = 1;
                        sqlx::query("UPDATE bonus_events SET legs_done = 1 WHERE id = $1").bind(id).execute(&st.pool).await?;
                    }
                }
                if legs == 1 {
                    o = clients::post_balance(st, &tenant, login, cent, "adjustment", amount, &format!("growth:bonus:{id}:a"), REASON_RELEASE, &format!("{campaign} (grant {grant}) released to balance")).await;
                }
                o
            }
            _ => {
                // never remove more than the account still holds (losses do not touch the bonus sub-ledger, but staff can)
                match clients::account(st, &tenant, login).await {
                    Ok(Some(acc)) => {
                        let held = acc.usd(acc.bonus).max(ZERO);
                        if held < amount {
                            amount = held;
                        }
                        if amount <= ZERO {
                            EngineOutcome::Booked
                        } else {
                            clients::post_balance(st, &tenant, login, cent, "bonus", -amount, &format!("growth:bonus:{id}:r"), REASON_REMOVE, &format!("{campaign} (grant {grant}) unreleased bonus removed")).await
                        }
                    }
                    Ok(None) => EngineOutcome::Fail("account not found".into()),
                    Err(e) => EngineOutcome::Retry(e.to_string()),
                }
            }
        };
        match outcome {
            EngineOutcome::Booked => {
                let mut tx = st.pool.begin().await?;
                sqlx::query("UPDATE bonus_events SET status = 'booked', booked_at = now(), amount = CASE WHEN $2 > 0 THEN $2 ELSE amount END, error = NULL WHERE id = $1").bind(id).bind(amount).execute(&mut *tx).await?;
                if kind == "grant" {
                    let exp = e.get::<i32, _>("expiry_days");
                    sqlx::query("UPDATE bonus_grants SET status = 'active', granted_at = now(), expires_at = now() + make_interval(days => $2) WHERE id = $1 AND status = 'pending'")
                        .bind(grant)
                        .bind(exp)
                        .execute(&mut *tx)
                        .await?;
                }
                tx.commit().await?;
                n += 1;
                match kind.as_str() {
                    "grant" => clients::notify(st, &tenant, user, "bonus.granted", format!("{campaign}: bonus credited"), format!("${} bonus is on account {login}.", amount.normalize()), "/rewards/promotions"),
                    "remove" => clients::notify(st, &tenant, user, "bonus.removed", format!("{campaign}: bonus ended"), format!("${} unreleased bonus was removed from account {login}.", amount.normalize()), "/rewards/promotions"),
                    _ => {}
                }
            }
            EngineOutcome::Retry(msg) => {
                let attempts: i32 = e.get::<i32, _>("attempts") + 1;
                let wait = 2i64.pow(attempts.min(6) as u32).min(60) * 15;
                sqlx::query("UPDATE bonus_events SET attempts = $2, error = $3, next_try_at = now() + make_interval(secs => $4) WHERE id = $1").bind(id).bind(attempts).bind(&msg).bind(wait as f64).execute(&st.pool).await?;
                tracing::warn!(event = id, error = %msg, "bonus leg will be retried");
            }
            EngineOutcome::Fail(msg) => {
                let mut tx = st.pool.begin().await?;
                sqlx::query("UPDATE bonus_events SET status = 'failed', error = $2 WHERE id = $1").bind(id).bind(&msg).execute(&mut *tx).await?;
                if kind == "grant" {
                    sqlx::query("UPDATE bonus_grants SET status = 'failed', ended_at = now(), end_reason = $2 WHERE id = $1").bind(grant).bind(&msg).execute(&mut *tx).await?;
                }
                audit::record(&mut *tx, &tenant, &Actor::system(), "bonus.leg_failed", Some(format!("event:{id}")), None, Some(json!({"kind": kind, "error": msg})), None).await?;
                tx.commit().await?;
                tracing::error!(event = id, error = %msg, "bonus leg failed; needs review");
            }
        }
    }
    Ok(n)
}

/// Campaigns whose end has passed, grant expiry, and removal on a withdrawal / transfer out while the bonus is
/// active.
pub async fn lifecycle_tick(st: &AppState) -> anyhow::Result<usize> {
    let mut n = 0;
    // a campaign closes itself when its end passes: no new claims; grants already open keep releasing per lot
    let ended = sqlx::query(
        "UPDATE bonus_campaigns SET status = 'ended', updated_at = now()
         WHERE status IN ('active', 'paused') AND ends_at IS NOT NULL AND ends_at <= now() AND deleted_at IS NULL RETURNING id, tenant, name, ends_at",
    )
    .fetch_all(&st.pool)
    .await?;
    for c in ended {
        let id: i64 = c.get("id");
        let tenant: String = c.get("tenant");
        audit::record(&st.pool, &tenant, &Actor::system(), "campaign.ended", Some(format!("campaign:{id}")), None, Some(json!({"name": c.get::<String, _>("name"), "endsAt": c.get::<DateTime<Utc>, _>("ends_at"), "status": "ended"})), Some("end date passed")).await?;
        n += 1;
    }
    let expired: Vec<i64> = sqlx::query_scalar("SELECT id FROM bonus_grants WHERE status = 'active' AND expires_at <= now()").fetch_all(&st.pool).await?;
    for id in expired {
        let mut tx = st.pool.begin().await?;
        end_grant(&mut tx, id, "expired", "expired").await?;
        tx.commit().await?;
        n += 1;
    }
    let rows = sqlx::query(
        "SELECT g.id, g.tenant, g.user_id, g.login, g.granted_at FROM bonus_grants g JOIN bonus_campaigns c ON c.id = g.campaign_id
         WHERE g.status = 'active' AND c.forfeit_on_withdrawal AND (g.ledger_checked IS NULL OR g.ledger_checked < now() - interval '20 seconds') ORDER BY g.id LIMIT 200",
    )
    .fetch_all(&st.pool)
    .await?;
    for g in rows {
        let id: i64 = g.get("id");
        let tenant: String = g.get("tenant");
        let (Some(login), Some(since)) = (g.get::<Option<i64>, _>("login"), g.get::<Option<DateTime<Utc>>, _>("granted_at")) else { continue };
        sqlx::query("UPDATE bonus_grants SET ledger_checked = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        let ledger = clients::ledger(st, &tenant, login, g.get("user_id"), since).await?;
        let out = ledger.iter().find(|l| calc::is_withdrawal_kind(&l.kind) && l.sub_ledger == "balance" && l.amount < ZERO && l.at >= since);
        if let Some(w) = out {
            let mut tx = st.pool.begin().await?;
            let removed = end_grant(&mut tx, id, "forfeited", "withdrawal").await?;
            audit::record(&mut *tx, &tenant, &Actor::system(), "bonus.forfeited", Some(format!("grant:{id}")), None, Some(json!({"login": login, "withdrawal": num(-w.amount), "removed": num(removed), "txn": w.txn})), None).await?;
            tx.commit().await?;
            n += 1;
        }
    }
    if n > 0 {
        st.wake.notify_one();
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn t(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn an_active_campaign_needs_an_end_that_is_still_ahead() {
        let now = t("2026-11-09T12:00:00Z");
        assert_eq!(activation_problem("active", None, now).map(|p| p.0), Some("endsAt"));
        assert!(activation_problem("active", Some(t("2026-11-09T04:42:00Z")), now).is_some(), "an end already behind us");
        assert!(activation_problem("active", Some(now), now).is_some(), "an end right now closes at once");
        assert!(activation_problem("active", Some(t("2026-11-30T00:00:00Z")), now).is_none());
        // a draft or paused campaign may keep an open end: it is not running
        assert!(activation_problem("paused", None, now).is_none());
        assert!(activation_problem("draft", Some(t("2026-01-01T00:00:00Z")), now).is_none());
        assert!(activation_problem("ended", None, now).is_none());
    }

    #[test]
    fn a_first_deposit_offer_needs_a_first_deposit_and_an_open_campaign() {
        let starts = t("2026-10-31T00:00:00Z");
        let ends = Some(t("2026-11-08T23:59:59Z"));
        let any: Vec<String> = vec![];
        let first = true;
        let again = false;

        // a client's first ever deposit, landed while the offer runs
        assert!(deposit_in_scope(first, t("2026-10-31T06:00:00Z"), starts, ends, &any, "standard"));
        assert!(deposit_in_scope(first, t("2026-11-08T23:00:00Z"), starts, ends, &any, "vip"));

        // an existing client topping up during the campaign is not making a first deposit, whatever the date
        assert!(!deposit_in_scope(again, t("2026-11-01T10:00:00Z"), starts, ends, &any, "standard"));

        // and a genuine first deposit from before the campaign opened is not this offer's to pay
        assert!(!deposit_in_scope(first, t("2026-10-30T23:59:00Z"), starts, ends, &any, "standard"));
        // nor is one after it closes
        assert!(!deposit_in_scope(first, t("2026-11-09T00:30:00Z"), starts, ends, &any, "standard"));

        // an open-ended campaign has no closing date to fail
        assert!(deposit_in_scope(first, t("2027-01-01T00:00:00Z"), starts, None, &any, "standard"));

        // named groups: only those accounts, and the name is matched however it was typed
        let only = vec!["VIP".to_string(), "pro".to_string()];
        assert!(deposit_in_scope(first, t("2026-11-01T00:00:00Z"), starts, ends, &only, "vip"));
        assert!(deposit_in_scope(first, t("2026-11-01T00:00:00Z"), starts, ends, &only, "PRO"));
        assert!(!deposit_in_scope(first, t("2026-11-01T00:00:00Z"), starts, ends, &only, "standard"));
    }

    #[test]
    fn the_bonus_is_a_percentage_under_a_cap_above_a_floor() {
        let d = |s: &str| D::from_str(s).unwrap();
        let (pct, cap, min) = (d("25"), d("1000"), d("100"));
        // 25% of a qualifying deposit
        assert_eq!(calc::deposit_bonus(d("1000"), pct, cap, min), Some(d("250")));
        // under the minimum there is no offer at all - not a smaller one
        assert_eq!(calc::deposit_bonus(d("99.99"), pct, cap, min), None);
        assert_eq!(calc::deposit_bonus(d("100"), pct, cap, min), Some(d("25")));
        // and the cap holds however large the deposit is
        assert_eq!(calc::deposit_bonus(d("100000"), pct, cap, min), Some(d("1000")));
    }
}

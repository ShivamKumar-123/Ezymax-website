//! Positions: subscribe (wallet debit, record-first), activation, the reconciler for unconfirmed debits and the
//! maturity worker that returns the principal to the wallet. There is no early withdrawal.
//!
//! Subscribe: client idempotency key → checks (plan on sale, limits, capacity, KYC verified, no wallet restriction,
//! terms + risk acknowledged) → position `pending_payment` → wallet debit `staking_subscribe` (key
//! `staking:subscribe:<id>`) → `active` from that moment, maturing at 00:00 server time on the same day
//! `term_months` later. A refused debit ends in `payment_failed`; an unknown outcome stays pending and is retried
//! by the reconciler with the same key, so the principal is never taken twice.

use crate::audit::{self, Actor};
use crate::error::{ApiError, ApiResult, invalid, rule};
use crate::gateway;
use crate::money::{D, ZERO, num, opt_num, r2, text};
use crate::notify;
use crate::period::{self, Period};
use crate::plans::{self, Plan};
use crate::state::AppState;
use crate::wallet::{self, Transfer, WalletOutcome};
use chrono::{DateTime, Duration, Utc};
use serde_json::{Value, json};
use sqlx::Row;

#[derive(Clone, Debug)]
pub struct Position {
    pub id: i64,
    pub tenant: String,
    pub user_id: i64,
    pub user_name: String,
    pub plan_id: i64,
    pub plan_name: String,
    pub plan_version: i32,
    pub plan_snapshot: Value,
    pub currency: String,
    pub term_months: i32,
    pub principal: D,
    pub status: String,
    pub terms_accepted_at: DateTime<Utc>,
    pub risk_ack_at: DateTime<Utc>,
    pub failure_reason: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub matures_at: Option<DateTime<Utc>>,
    pub matured_at: Option<DateTime<Utc>>,
    pub returns_paid: D,
    pub redeem_attempts: i32,
    pub redeem_error: Option<String>,
    pub redeem_next_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub fn from_row(r: &sqlx::postgres::PgRow) -> Position {
    Position {
        id: r.get("id"),
        tenant: r.get("tenant"),
        user_id: r.get("user_id"),
        user_name: r.get("user_name"),
        plan_id: r.get("plan_id"),
        plan_name: r.get("plan_name"),
        plan_version: r.get("plan_version"),
        plan_snapshot: r.get::<sqlx::types::Json<Value>, _>("plan_snapshot").0,
        currency: r.get("currency"),
        term_months: r.get("term_months"),
        principal: r.get("principal"),
        status: r.get("status"),
        terms_accepted_at: r.get("terms_accepted_at"),
        risk_ack_at: r.get("risk_ack_at"),
        failure_reason: r.get("failure_reason"),
        started_at: r.get("started_at"),
        matures_at: r.get("matures_at"),
        matured_at: r.get("matured_at"),
        returns_paid: r.get("returns_paid"),
        redeem_attempts: r.get("redeem_attempts"),
        redeem_error: r.get("redeem_error"),
        redeem_next_at: r.get("redeem_next_at"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

pub async fn get(st: &AppState, id: i64) -> ApiResult<Option<Position>> {
    Ok(sqlx::query("SELECT * FROM positions WHERE id = $1").bind(id).fetch_optional(&st.pool).await?.map(|r| from_row(&r)))
}

/// Client and admin view of a position. `last` = the latest paid month (period, rate, amount).
pub fn json(p: &Position, last: Option<(String, D, D)>, now: DateTime<Utc>) -> Value {
    let (total, elapsed) = match (p.started_at, p.matures_at) {
        (Some(s), Some(m)) => (period::term_days(s, m), period::days_elapsed(s, m, now)),
        _ => (0, 0),
    };
    json!({
        "id": p.id, "userId": p.user_id, "userName": p.user_name, "planId": p.plan_id, "planName": p.plan_name, "planVersion": p.plan_version,
        "currency": p.currency, "termMonths": p.term_months, "principal": num(p.principal), "status": p.status,
        "startedAt": p.started_at, "maturesAt": p.matures_at, "maturedAt": p.matured_at, "returnsPaid": num(p.returns_paid),
        "daysTotal": total, "daysElapsed": elapsed, "failureReason": p.failure_reason,
        "lastReturn": last.map(|(period, rate, amount)| json!({"period": period, "ratePct": num(rate), "amount": num(amount)})),
        "redeem": if p.redeem_attempts > 0 { json!({"attempts": p.redeem_attempts, "error": p.redeem_error, "nextAttemptAt": p.redeem_next_at}) } else { Value::Null },
        "termsAcceptedAt": p.terms_accepted_at, "riskAcknowledgedAt": p.risk_ack_at, "createdAt": p.created_at, "updatedAt": p.updated_at,
    })
}

/// The latest paid return per position.
pub async fn last_returns(st: &AppState, ids: &[i64]) -> ApiResult<std::collections::HashMap<i64, (String, D, D)>> {
    if ids.is_empty() {
        return Ok(Default::default());
    }
    let rows = sqlx::query(
        "SELECT DISTINCT ON (position_id) position_id, period, rate_pct, amount FROM settlement_lines
         WHERE position_id = ANY($1) AND status = 'paid' ORDER BY position_id, period DESC",
    )
    .bind(ids)
    .fetch_all(&st.pool)
    .await?;
    Ok(rows.iter().map(|r| (r.get::<i64, _>("position_id"), (r.get("period"), r.get("rate_pct"), r.get("amount")))).collect())
}

/* ------------------------------------------------------------------ */
/* Subscribe                                                           */
/* ------------------------------------------------------------------ */

pub struct Subscribe {
    pub plan_id: i64,
    pub amount: Option<D>,
    pub key: String,
    pub accept_terms: bool,
    pub accept_risk: bool,
}

pub async fn subscribe(st: &AppState, tenant: &str, user_id: i64, user_name: &str, req: Subscribe) -> ApiResult<Position> {
    let key = req.key.trim();
    if key.is_empty() || key.len() > 80 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(invalid("idempotencyKey", "idempotencyKey: 1–80 letters, digits, - or _"));
    }
    let full_key = format!("u{user_id}:{key}");
    // a retry of the same subscription continues it (never a second position)
    if let Some(r) = sqlx::query("SELECT * FROM positions WHERE tenant = $1 AND idempotency_key = $2").bind(tenant).bind(&full_key).fetch_optional(&st.pool).await? {
        let p = from_row(&r);
        if p.plan_id != req.plan_id || req.amount.is_some_and(|a| a != p.principal) {
            return Err(ApiError::Conflict { code: "idempotency_conflict", message: "This request key was already used for a different subscription.".into() });
        }
        return continue_subscribe(st, p).await;
    }
    if !req.accept_terms {
        return Err(rule("terms_required", "Accept the plan terms to subscribe."));
    }
    if !req.accept_risk {
        return Err(rule("risk_ack_required", "Confirm that you understand the risks: returns are not guaranteed and the amount is locked until the end of the term."));
    }
    let amount = req.amount.map(|a| a.normalize()).filter(|a| *a > ZERO).ok_or_else(|| invalid("amount", "Enter the amount to invest."))?;
    if amount.scale() > 2 {
        return Err(invalid("amount", "Use at most 2 decimals."));
    }
    let plan = plans::get(st, tenant, req.plan_id).await?;
    if plan.status != "active" {
        return Err(rule("plan_unavailable", "This plan isn't open for new subscriptions."));
    }
    if !st.cfg.currencies.contains(&plan.currency) {
        return Err(rule("plan_unavailable", "This plan's currency isn't held in the wallet."));
    }
    if amount < plan.min_amount {
        return Err(ApiError::Rule { code: "below_minimum", message: format!("The minimum for this plan is {} {}.", text(plan.min_amount), plan.currency) });
    }
    if plan.max_amount.is_some_and(|m| amount > m) {
        return Err(ApiError::Rule { code: "above_maximum", message: format!("The maximum per subscription is {} {}.", text(plan.max_amount.unwrap_or_default()), plan.currency) });
    }
    // KYC and wallet restrictions from the gateway: fail closed when it can't be asked
    let gw = gateway::user(st, tenant, user_id).await.map_err(|e| {
        tracing::warn!(error = %e, "gateway unavailable for the subscription checks");
        ApiError::Upstream { code: "unavailable", message: "Your account status can't be checked right now. Please try again shortly.".into() }
    })?;
    let Some(gw) = gw else { return Err(rule("account_unavailable", "Your account can't subscribe. Please contact support.")) };
    if gw.status != "active" {
        return Err(rule("account_unavailable", "Your account can't subscribe. Please contact support."));
    }
    if gw.kyc_status != "verified" {
        return Err(rule("kyc_required", "Verify your identity before you subscribe."));
    }
    if gw.blocked_by().is_some() {
        return Err(rule("wallet_restricted", "Wallet operations are restricted on your account. Please contact support."));
    }
    let name = if user_name.is_empty() { gw.name.clone() } else { user_name.to_string() };
    let p = open(st, tenant, user_id, &name, &plan, amount, &full_key).await?;
    audit::record(&st.pool, tenant, &Actor::user(user_id, &name), "position.subscribe", Some(format!("position:{}", p.id)), None, Some(json!({"plan": plan.id, "version": plan.version, "principal": num(amount), "currency": plan.currency})), None).await?;
    continue_subscribe(st, p).await
}

/// Inserts the pending position after the capacity and per-client checks, serialised per plan.
async fn open(st: &AppState, tenant: &str, user_id: i64, name: &str, plan: &Plan, amount: D, full_key: &str) -> ApiResult<Position> {
    let mut tx = st.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('staking-plan:' || $1::text))").bind(plan.id).execute(&mut *tx).await?;
    // the same key may have won the race while this request waited for the lock
    if let Some(r) = sqlx::query("SELECT * FROM positions WHERE tenant = $1 AND idempotency_key = $2").bind(tenant).bind(full_key).fetch_optional(&mut *tx).await? {
        return Ok(from_row(&r));
    }
    let (open_total, mine): (D, D) = sqlx::query_as(
        "SELECT COALESCE(sum(principal), 0), COALESCE(sum(principal) FILTER (WHERE user_id = $2), 0)
         FROM positions WHERE plan_id = $1 AND status IN ('pending_payment', 'active')",
    )
    .bind(plan.id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;
    if let Some(cap) = plan.capacity
        && open_total + amount > cap
    {
        let left = (cap - open_total).max(ZERO);
        return Err(ApiError::Rule {
            code: "capacity_reached",
            message: if left > ZERO { format!("Only {} {} of capacity is left in this plan.", text(left), plan.currency) } else { "This plan is full.".into() },
        });
    }
    if let Some(max) = plan.per_user_max
        && mine + amount > max
    {
        return Err(ApiError::Rule { code: "user_limit", message: format!("You can hold at most {} {} in this plan ({} already invested).", text(max), plan.currency, text(mine)) });
    }
    let now = Utc::now();
    let r = sqlx::query(
        "INSERT INTO positions (tenant, user_id, user_name, plan_id, plan_name, plan_version, plan_snapshot, currency, term_months, principal,
                                idempotency_key, terms_accepted_at, risk_ack_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *",
    )
    .bind(tenant)
    .bind(user_id)
    .bind(name.chars().take(120).collect::<String>())
    .bind(plan.id)
    .bind(&plan.name)
    .bind(plan.version)
    .bind(sqlx::types::Json(plans::snapshot(plan)))
    .bind(&plan.currency)
    .bind(plan.term_months)
    .bind(amount)
    .bind(full_key)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(from_row(&r))
}

pub fn subscribe_key(id: i64) -> String {
    format!("staking:subscribe:{id}")
}

/// Charges (if not yet charged) and activates a pending position. Safe to call repeatedly.
pub async fn continue_subscribe(st: &AppState, p: Position) -> ApiResult<Position> {
    match p.status.as_str() {
        "pending_payment" => {}
        "payment_failed" => return Err(rule("payment_failed", p.failure_reason.unwrap_or_else(|| "The wallet payment didn't go through.".into()))),
        _ => return Ok(p),
    }
    let key = subscribe_key(p.id);
    let note = format!("Staking: {} · {} months", p.plan_name, p.term_months);
    let out = st
        .wallet
        .transfer(
            &st.pool,
            Transfer { tenant: &p.tenant, key: &key, user_id: p.user_id, direction: "debit", kind: wallet::KIND_SUBSCRIBE, currency: &p.currency, amount: p.principal, reference: &format!("staking:position:{}", p.id), note: &note },
        )
        .await;
    match out {
        WalletOutcome::Done(_) => {
            let now = Utc::now();
            let matures = period::maturity(now, p.term_months);
            let n = sqlx::query("UPDATE positions SET status = 'active', started_at = $2, matures_at = $3, failure_reason = NULL, updated_at = now() WHERE id = $1 AND status = 'pending_payment'")
                .bind(p.id)
                .bind(now)
                .bind(matures)
                .execute(&st.pool)
                .await?
                .rows_affected();
            let fresh = get(st, p.id).await?.ok_or(ApiError::NotFound)?;
            if n > 0 {
                audit::record(&st.pool, &p.tenant, &Actor::system(), "position.activate", Some(format!("position:{}", p.id)), None, Some(json!({"principal": num(p.principal), "startedAt": now, "maturesAt": matures})), None).await?;
                notify::send(
                    st,
                    &p.tenant,
                    p.user_id,
                    "staking.subscribed",
                    format!("{}: subscription confirmed", p.plan_name),
                    format!("{} {} is locked until {}. Returns are paid monthly once the month's rate is approved.", text(p.principal), p.currency, matures.format("%d %b %Y")),
                    format!("staking:subscribed:{}", p.id),
                );
            }
            Ok(fresh)
        }
        WalletOutcome::Rejected { code, message } => {
            let reason = if code == "insufficient_funds" { format!("Your {} wallet balance is too low.", p.currency) } else { message };
            sqlx::query("UPDATE positions SET status = 'payment_failed', failure_reason = $2, updated_at = now() WHERE id = $1 AND status = 'pending_payment'").bind(p.id).bind(&reason).execute(&st.pool).await?;
            audit::record(&st.pool, &p.tenant, &Actor::system(), "position.payment_failed", Some(format!("position:{}", p.id)), None, Some(json!({"code": code, "reason": reason})), None).await?;
            Err(if code == "insufficient_funds" { rule("insufficient_funds", reason) } else { rule("payment_failed", reason) })
        }
        WalletOutcome::Unknown(m) => {
            tracing::warn!(position = p.id, error = %m, "wallet outcome unknown; the reconciler retries");
            sqlx::query("UPDATE positions SET updated_at = now() WHERE id = $1").bind(p.id).execute(&st.pool).await?;
            Err(ApiError::Upstream { code: "payment_pending", message: "The wallet didn't confirm the payment yet. It is retried automatically; nothing is charged twice.".into() })
        }
    }
}

/// Retries subscriptions left pending by a crash or an unavailable wallet. Returns how many it touched.
pub async fn reconcile(st: &AppState) -> anyhow::Result<usize> {
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM positions WHERE status = 'pending_payment' AND updated_at < now() - interval '15 seconds' ORDER BY id LIMIT 50").fetch_all(&st.pool).await?;
    for id in &ids {
        if let Some(p) = get(st, *id).await.map_err(|e| anyhow::anyhow!("{e:?}"))? {
            if let Err(e) = continue_subscribe(st, p).await {
                tracing::debug!(position = id, error = ?e, "reconcile subscription");
            }
        }
    }
    Ok(ids.len())
}

/* ------------------------------------------------------------------ */
/* Maturity                                                            */
/* ------------------------------------------------------------------ */

pub fn principal_key(id: i64) -> String {
    format!("staking:principal:{id}")
}

fn backoff_secs(attempts: i32) -> i64 {
    (30i64 << attempts.clamp(0, 7)).min(3600)
}

/// Returns the principal of every matured position to the wallet (`staking_redeem`, key
/// `staking:principal:<id>`). The last month's return is paid by that month's settlement. Returns (done, waiting).
pub async fn maturity_tick(st: &AppState) -> anyhow::Result<(usize, usize)> {
    // lease due positions so a concurrent tick skips them
    let due = sqlx::query(
        "UPDATE positions SET redeem_next_at = now() + interval '5 minutes' WHERE id IN (
             SELECT id FROM positions WHERE status = 'active' AND matures_at <= now() AND (redeem_next_at IS NULL OR redeem_next_at <= now())
             ORDER BY matures_at LIMIT 50 FOR UPDATE SKIP LOCKED)
         RETURNING *",
    )
    .fetch_all(&st.pool)
    .await?;
    let (mut done, mut waiting) = (0, 0);
    for r in &due {
        let p = from_row(r);
        let key = principal_key(p.id);
        let note = format!("Staking: {} matured, principal returned", p.plan_name);
        let out = st
            .wallet
            .transfer(
                &st.pool,
                Transfer { tenant: &p.tenant, key: &key, user_id: p.user_id, direction: "credit", kind: wallet::KIND_REDEEM, currency: &p.currency, amount: p.principal, reference: &format!("staking:position:{}", p.id), note: &note },
            )
            .await;
        match out {
            WalletOutcome::Done(v) => {
                let mut tx = st.pool.begin().await?;
                let n = sqlx::query("UPDATE positions SET status = 'matured', matured_at = now(), redeem_error = NULL, redeem_next_at = NULL, updated_at = now() WHERE id = $1 AND status = 'active'")
                    .bind(p.id)
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();
                if n == 0 {
                    continue;
                }
                audit::record(&mut *tx, &p.tenant, &Actor::system(), "position.matured", Some(format!("position:{}", p.id)), None, Some(json!({"principal": num(p.principal), "walletTxn": wallet::txn_of(&v)})), None).await?;
                tx.commit().await?;
                notify::send(
                    st,
                    &p.tenant,
                    p.user_id,
                    "staking.matured",
                    format!("{}: term complete", p.plan_name),
                    format!("Your principal of {} {} is back in your wallet. The final month's return is paid with that month's settlement.", text(p.principal), p.currency),
                    format!("staking:matured:{}", p.id),
                );
                done += 1;
            }
            WalletOutcome::Unknown(e) | WalletOutcome::Rejected { message: e, .. } => {
                let secs = backoff_secs(p.redeem_attempts);
                sqlx::query("UPDATE positions SET redeem_attempts = redeem_attempts + 1, redeem_error = $2, redeem_next_at = now() + make_interval(secs => $3), updated_at = now() WHERE id = $1")
                    .bind(p.id)
                    .bind(e.chars().take(500).collect::<String>())
                    .bind(secs as f64)
                    .execute(&st.pool)
                    .await?;
                if p.redeem_attempts == 0 {
                    audit::record(&st.pool, &p.tenant, &Actor::system(), "position.redeem_deferred", Some(format!("position:{}", p.id)), None, Some(json!({"error": e})), None).await?;
                }
                tracing::warn!(position = p.id, error = %e, "principal return deferred; will retry");
                waiting += 1;
            }
        }
    }
    Ok((done, waiting))
}

/* ------------------------------------------------------------------ */
/* Client portfolio                                                    */
/* ------------------------------------------------------------------ */

pub async fn of_user(st: &AppState, tenant: &str, user_id: i64) -> ApiResult<Vec<Position>> {
    let rows = sqlx::query("SELECT * FROM positions WHERE tenant = $1 AND user_id = $2 ORDER BY id DESC LIMIT 500").bind(tenant).bind(user_id).fetch_all(&st.pool).await?;
    Ok(rows.iter().map(from_row).collect())
}

/// Portfolio summary of one client: invested, returns, next payout and maturity, positions and monthly returns.
pub async fn portfolio(st: &AppState, tenant: &str, user_id: i64) -> ApiResult<Value> {
    let now = Utc::now();
    let list = of_user(st, tenant, user_id).await?;
    let ids: Vec<i64> = list.iter().map(|p| p.id).collect();
    let last = last_returns(st, &ids).await?;
    let invested: D = list.iter().filter(|p| p.status == "active").map(|p| p.principal).sum();
    let pending: D = list.iter().filter(|p| p.status == "pending_payment").map(|p| p.principal).sum();
    let returns_paid: D = list.iter().map(|p| p.returns_paid).sum();
    let next_maturity = list.iter().filter(|p| p.status == "active").min_by_key(|p| p.matures_at);
    let monthly = sqlx::query(
        "SELECT period, sum(amount) AS amount FROM settlement_lines WHERE tenant = $1 AND user_id = $2 AND status = 'paid'
         GROUP BY period ORDER BY period DESC LIMIT 12",
    )
    .bind(tenant)
    .bind(user_id)
    .fetch_all(&st.pool)
    .await?;
    let mut monthly: Vec<Value> = monthly.iter().map(|r| json!({"period": r.get::<String, _>("period"), "amount": num(r.get("amount"))})).collect();
    monthly.reverse();
    let year = format!("{}-", Period::of(now).year);
    let this_year: D = sqlx::query_scalar("SELECT COALESCE(sum(amount), 0) FROM settlement_lines WHERE tenant = $1 AND user_id = $2 AND status = 'paid' AND period LIKE $3")
        .bind(tenant)
        .bind(user_id)
        .bind(format!("{year}%"))
        .fetch_one(&st.pool)
        .await?;
    let current = Period::of(now);
    // the next month to be paid: last month while its return isn't credited yet, else the current one
    let prev = current.prev();
    let earned_prev = list.iter().any(|p| matches!(p.status.as_str(), "active" | "matured") && p.started_at.is_some_and(|s| s < prev.end()) && p.matures_at.is_some_and(|m| m > prev.start()));
    let paid_prev: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM settlement_lines WHERE tenant = $1 AND user_id = $2 AND period = $3 AND status = 'paid')")
        .bind(tenant)
        .bind(user_id)
        .bind(prev.to_string())
        .fetch_one(&st.pool)
        .await?;
    let next = if earned_prev && !paid_prev {
        Some(prev)
    } else if invested > ZERO {
        Some(current)
    } else {
        None
    };
    let currency = list.first().map(|p| p.currency.clone()).unwrap_or_else(|| st.cfg.currencies.first().cloned().unwrap_or_else(|| "USDT".into()));
    Ok(json!({
        "summary": {
            "currency": currency,
            "invested": num(r2(invested)),
            "pending": num(r2(pending)),
            "returnsPaid": num(r2(returns_paid)),
            "returnsThisYear": num(this_year),
            "activePositions": list.iter().filter(|p| p.status == "active").count(),
            // a month is paid after it closes and its settlement is approved; no amount is promised
            "nextPayout": next.map(|p| json!({"period": p.to_string(), "after": p.end()})),
            "nextMaturity": next_maturity.map(|p| json!({"positionId": p.id, "planName": p.plan_name, "date": p.matures_at, "principal": num(p.principal)})),
        },
        "positions": list.iter().map(|p| json(p, last.get(&p.id).cloned(), now)).collect::<Vec<_>>(),
        "monthly": monthly,
        "serverTime": now,
    }))
}

/// One position of a client with its monthly returns.
pub async fn detail(st: &AppState, p: &Position) -> ApiResult<Value> {
    let rows = sqlx::query("SELECT * FROM settlement_lines WHERE position_id = $1 AND status <> 'rejected' ORDER BY period DESC").bind(p.id).fetch_all(&st.pool).await?;
    let returns: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "period": r.get::<String, _>("period"), "ratePct": num(r.get("rate_pct")), "daysActive": r.get::<i32, _>("days_active"),
                "daysInMonth": r.get::<i32, _>("days_in_month"), "amount": num(r.get("amount")),
                // the client sees paid, or "processing" for anything approved but not credited yet
                "status": match r.get::<String, _>("status").as_str() { "paid" => "paid", "pending_approval" => "pending", _ => "processing" },
                "paidAt": r.get::<Option<DateTime<Utc>>, _>("paid_at"),
            })
        })
        .collect();
    let last = last_returns(st, &[p.id]).await?;
    Ok(json!({"position": json(p, last.get(&p.id).cloned(), Utc::now()), "terms": p.plan_snapshot, "returns": returns}))
}

/// The client's staking history: subscriptions, monthly returns and principal returns, newest first.
pub async fn history(st: &AppState, tenant: &str, user_id: i64, offset: i64, limit: i64) -> ApiResult<Value> {
    const EVENTS: &str = "
        SELECT 'subscribe' AS kind, p.started_at AS at, p.id AS position_id, p.plan_name, p.principal AS amount, p.currency, NULL::text AS period, NULL::numeric AS rate_pct, NULL::int AS days
          FROM positions p WHERE p.tenant = $1 AND p.user_id = $2 AND p.status IN ('active', 'matured')
        UNION ALL
        SELECT 'payment_failed', p.updated_at, p.id, p.plan_name, p.principal, p.currency, NULL, NULL, NULL
          FROM positions p WHERE p.tenant = $1 AND p.user_id = $2 AND p.status = 'payment_failed'
        UNION ALL
        SELECT 'principal', p.matured_at, p.id, p.plan_name, p.principal, p.currency, NULL, NULL, NULL
          FROM positions p WHERE p.tenant = $1 AND p.user_id = $2 AND p.status = 'matured'
        UNION ALL
        SELECT 'reward', l.paid_at, l.position_id, p.plan_name, l.amount, l.currency, l.period, l.rate_pct, l.days_active
          FROM settlement_lines l JOIN positions p ON p.id = l.position_id WHERE l.tenant = $1 AND l.user_id = $2 AND l.status = 'paid'";
    let total: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT count(*) FROM ({EVENTS}) e"))).bind(tenant).bind(user_id).fetch_one(&st.pool).await?;
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * FROM ({EVENTS}) e ORDER BY at DESC, position_id DESC OFFSET $3 LIMIT $4")))
        .bind(tenant)
        .bind(user_id)
        .bind(offset)
        .bind(limit)
        .fetch_all(&st.pool)
        .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "kind": r.get::<String, _>("kind"), "at": r.get::<Option<DateTime<Utc>>, _>("at"), "positionId": r.get::<i64, _>("position_id"),
                "planName": r.get::<String, _>("plan_name"), "amount": num(r.get("amount")), "currency": r.get::<String, _>("currency"),
                "period": r.get::<Option<String>, _>("period"), "ratePct": opt_num(r.get("rate_pct")), "days": r.get::<Option<i32>, _>("days"),
            })
        })
        .collect();
    Ok(json!({"items": items, "total": total}))
}

/// For the overview: positions maturing within `days`.
pub async fn maturing_within(st: &AppState, tenant: &str, days: i64) -> ApiResult<(i64, D)> {
    let until = Utc::now() + Duration::days(days);
    let (n, sum): (i64, D) = sqlx::query_as("SELECT count(*), COALESCE(sum(principal), 0) FROM positions WHERE tenant = $1 AND status = 'active' AND matures_at <= $2")
        .bind(tenant)
        .bind(until)
        .fetch_one(&st.pool)
        .await?;
    Ok((n, sum))
}

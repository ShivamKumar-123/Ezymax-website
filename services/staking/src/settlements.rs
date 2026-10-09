//! Monthly settlements (the pattern of the IB payout batches): once a server-time month is over and every plan with
//! earning positions has its rate, a staff member previews and creates the month's settlement; a different staff
//! member approves (four-eyes, also a database CHECK) or rejects it. Approved lines are credited to the clients'
//! wallets (`staking_reward`, key `staking:reward:<tenant>:<period>:<position>`); while the wallet is unreachable a
//! line stays `transfer_pending` and is retried with backoff. A refused line is `failed` until someone retries it.

use crate::audit::{self, Actor};
use crate::error::{ApiError, ApiResult, invalid, rule};
use crate::money::{D, ZERO, num, r2, text};
use crate::notify;
use crate::period::{self, Period};
use crate::state::AppState;
use crate::wallet::{self, Transfer, WalletOutcome};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::{PgConnection, Row};
use std::collections::{BTreeMap, BTreeSet, HashMap};

/// Lines shown in a preview (totals always cover every line).
const PREVIEW_LINES: usize = 500;

pub fn parse_period(s: &str) -> ApiResult<Period> {
    Period::parse(s).ok_or_else(|| invalid("period", "period must be a month, YYYY-MM."))
}

pub fn reward_key(tenant: &str, period: &str, position: i64) -> String {
    format!("staking:reward:{tenant}:{period}:{position}")
}

#[derive(Clone, Debug)]
pub struct LineDraft {
    pub position_id: i64,
    pub user_id: i64,
    pub user_name: String,
    pub plan_id: i64,
    pub plan_name: String,
    pub currency: String,
    pub principal: D,
    pub rate_pct: D,
    pub days_active: i64,
    pub days_in_month: i64,
    pub amount: D,
}

pub struct Computed {
    pub lines: Vec<LineDraft>,
    /// Plans with earning positions but no rate for the month: (id, name).
    pub missing: Vec<(i64, String)>,
    /// Positions that earn nothing this month (rate 0 %, or less than a cent).
    pub zero: usize,
    pub rates: BTreeMap<i64, (String, D)>,
}

/// Every position's return for `period` from the stored rates (nothing is written).
pub async fn compute(c: &mut PgConnection, tenant: &str, p: Period) -> ApiResult<Computed> {
    let rows = sqlx::query(
        "SELECT pos.id, pos.user_id, pos.user_name, pos.plan_id, pl.name AS plan_name, pos.currency, pos.principal, pos.started_at, pos.matures_at
         FROM positions pos JOIN plans pl ON pl.id = pos.plan_id
         WHERE pos.tenant = $1 AND pos.status IN ('active', 'matured') AND pos.started_at < $2 AND pos.matures_at > $3
         ORDER BY pos.id",
    )
    .bind(tenant)
    .bind(p.end())
    .bind(p.start())
    .fetch_all(&mut *c)
    .await?;
    let rate_rows = sqlx::query("SELECT plan_id, rate_pct FROM monthly_rates WHERE tenant = $1 AND period = $2").bind(tenant).bind(p.to_string()).fetch_all(&mut *c).await?;
    let rates: HashMap<i64, D> = rate_rows.iter().map(|r| (r.get("plan_id"), r.get("rate_pct"))).collect();
    let dim = p.days();
    let mut out = Computed { lines: Vec::new(), missing: Vec::new(), zero: 0, rates: BTreeMap::new() };
    let mut missing = BTreeMap::new();
    for r in &rows {
        let (plan_id, plan_name): (i64, String) = (r.get("plan_id"), r.get("plan_name"));
        let days = period::days_active(r.get("started_at"), r.get("matures_at"), p);
        if days <= 0 {
            continue;
        }
        let Some(rate) = rates.get(&plan_id).copied() else {
            missing.insert(plan_id, plan_name);
            continue;
        };
        out.rates.insert(plan_id, (plan_name.clone(), rate));
        let principal: D = r.get("principal");
        let amount = period::accrual(principal, rate, days, dim);
        if amount <= ZERO {
            out.zero += 1;
            continue;
        }
        out.lines.push(LineDraft {
            position_id: r.get("id"),
            user_id: r.get("user_id"),
            user_name: r.get("user_name"),
            plan_id,
            plan_name,
            currency: r.get("currency"),
            principal,
            rate_pct: rate,
            days_active: days,
            days_in_month: dim,
            amount,
        });
    }
    out.missing = missing.into_iter().collect();
    Ok(out)
}

fn plan_summary(lines: &[LineDraft], rates: &BTreeMap<i64, (String, D)>, missing: &[(i64, String)]) -> Vec<Value> {
    let mut by: BTreeMap<i64, (String, Option<D>, i64, D, D)> = BTreeMap::new();
    for (id, (name, rate)) in rates {
        by.insert(*id, (name.clone(), Some(*rate), 0, ZERO, ZERO));
    }
    for (id, name) in missing {
        by.entry(*id).or_insert((name.clone(), None, 0, ZERO, ZERO));
    }
    for l in lines {
        let e = by.entry(l.plan_id).or_insert((l.plan_name.clone(), Some(l.rate_pct), 0, ZERO, ZERO));
        e.2 += 1;
        e.3 += l.principal;
        e.4 += l.amount;
    }
    by.into_iter()
        .map(|(id, (name, rate, n, principal, amount))| json!({"planId": id, "name": name, "ratePct": rate.map(num), "lines": n, "principal": num(principal), "amount": num(r2(amount))}))
        .collect()
}

fn draft_json(l: &LineDraft) -> Value {
    json!({
        "positionId": l.position_id, "userId": l.user_id, "userName": l.user_name, "planId": l.plan_id, "planName": l.plan_name,
        "currency": l.currency, "principal": num(l.principal), "ratePct": num(l.rate_pct), "daysActive": l.days_active,
        "daysInMonth": l.days_in_month, "amount": num(l.amount),
    })
}

async fn existing(c: &mut PgConnection, tenant: &str, p: Period) -> ApiResult<Option<(i64, String)>> {
    Ok(sqlx::query_as("SELECT id, status FROM settlements WHERE tenant = $1 AND period = $2 AND status <> 'rejected'").bind(tenant).bind(p.to_string()).fetch_optional(&mut *c).await?)
}

/// What a settlement for `period` would pay, and what still blocks it.
pub async fn preview(st: &AppState, tenant: &str, p: Period) -> ApiResult<Value> {
    let mut c = st.pool.acquire().await?;
    let found = existing(&mut c, tenant, p).await?;
    let comp = compute(&mut c, tenant, p).await?;
    let closed = p.is_closed(Utc::now());
    let total: D = comp.lines.iter().map(|l| l.amount).sum();
    let principal: D = comp.lines.iter().map(|l| l.principal).sum();
    let investors = comp.lines.iter().map(|l| l.user_id).collect::<BTreeSet<_>>().len();
    let mut blockers = Vec::new();
    if !closed {
        blockers.push(json!({"code": "period_open", "message": format!("{p} isn't over yet in server time.")}));
    }
    if let Some((id, status)) = &found {
        blockers.push(json!({"code": "settlement_exists", "message": format!("Settlement #{id} for {p} is {status}.")}));
    }
    if !comp.missing.is_empty() {
        blockers.push(json!({"code": "rates_missing", "message": format!("Set the {p} rate for {}.", comp.missing.iter().map(|m| m.1.as_str()).collect::<Vec<_>>().join(", "))}));
    }
    if comp.lines.is_empty() && comp.missing.is_empty() {
        blockers.push(json!({"code": "nothing_to_settle", "message": "No position earns a return for this month."}));
    }
    Ok(json!({
        "period": p.to_string(), "closed": closed, "closesAt": p.end(), "daysInMonth": p.days(),
        "existing": found.as_ref().map(|(id, status)| json!({"id": id, "status": status})),
        "ratesMissing": comp.missing.iter().map(|(id, name)| json!({"planId": id, "name": name})).collect::<Vec<_>>(),
        "totals": {"lines": comp.lines.len(), "investors": investors, "principal": num(principal), "amount": num(r2(total)), "zeroLines": comp.zero},
        "plans": plan_summary(&comp.lines, &comp.rates, &comp.missing),
        "lines": comp.lines.iter().take(PREVIEW_LINES).map(draft_json).collect::<Vec<_>>(),
        "truncated": comp.lines.len() > PREVIEW_LINES,
        "blockers": blockers,
        "canCreate": closed && found.is_none() && comp.missing.is_empty() && !comp.lines.is_empty(),
    }))
}

/// Creates the settlement of a closed month for approval. Rates of the month are locked from now on.
pub async fn create(st: &AppState, tenant: &str, actor: &Actor, p: Period, why: &str) -> ApiResult<i64> {
    if !p.is_closed(Utc::now()) {
        return Err(rule("period_open", format!("{p} isn't over yet in server time. Settle it from {}.", p.end().format("%d %b %Y %H:%M UTC"))));
    }
    let mut tx = st.pool.begin().await?;
    // serialise with other settlements and rate changes of the same month
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('staking-period:' || $1 || ':' || $2))").bind(tenant).bind(p.to_string()).execute(&mut *tx).await?;
    if let Some((id, status)) = existing(&mut tx, tenant, p).await? {
        return Err(ApiError::Conflict { code: "settlement_exists", message: format!("Settlement #{id} for {p} is {status}.") });
    }
    let comp = compute(&mut tx, tenant, p).await?;
    if !comp.missing.is_empty() {
        return Err(rule("rates_missing", format!("Set the {p} rate for {} first.", comp.missing.iter().map(|m| m.1.as_str()).collect::<Vec<_>>().join(", "))));
    }
    if comp.lines.is_empty() {
        return Err(rule("nothing_to_settle", "No position earns a return for this month."));
    }
    let total: D = comp.lines.iter().map(|l| l.amount).sum();
    let principal: D = comp.lines.iter().map(|l| l.principal).sum();
    let investors = comp.lines.iter().map(|l| l.user_id).collect::<BTreeSet<_>>().len();
    let rates: serde_json::Map<String, Value> = comp.rates.iter().map(|(id, (name, rate))| (id.to_string(), json!({"name": name, "ratePct": num(*rate)}))).collect();
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO settlements (tenant, period, total, lines, investors, principal, rates, created_by, created_by_name, create_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    )
    .bind(tenant)
    .bind(p.to_string())
    .bind(total)
    .bind(comp.lines.len() as i32)
    .bind(investors as i32)
    .bind(principal)
    .bind(sqlx::types::Json(Value::Object(rates.clone())))
    .bind(&actor.id)
    .bind(actor.name.clone().unwrap_or_default())
    .bind(why)
    .fetch_one(&mut *tx)
    .await?;
    for l in &comp.lines {
        sqlx::query(
            "INSERT INTO settlement_lines (tenant, settlement_id, period, position_id, user_id, plan_id, currency, principal, rate_pct, days_active, days_in_month, amount, idempotency_key)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        )
        .bind(tenant)
        .bind(id)
        .bind(p.to_string())
        .bind(l.position_id)
        .bind(l.user_id)
        .bind(l.plan_id)
        .bind(&l.currency)
        .bind(l.principal)
        .bind(l.rate_pct)
        .bind(l.days_active as i32)
        .bind(l.days_in_month as i32)
        .bind(l.amount)
        .bind(reward_key(tenant, &p.to_string(), l.position_id))
        .execute(&mut *tx)
        .await?;
    }
    audit::record(
        &mut *tx,
        tenant,
        actor,
        "settlement.create",
        Some(format!("settlement:{id}")),
        None,
        Some(json!({"period": p.to_string(), "total": num(total), "lines": comp.lines.len(), "investors": investors, "rates": rates})),
        Some(why),
    )
    .await?;
    tx.commit().await?;
    tracing::info!(settlement = id, period = %p, %total, lines = comp.lines.len(), "staking settlement created");
    Ok(id)
}

async fn lock_status(c: &mut PgConnection, tenant: &str, id: i64) -> ApiResult<(String, String)> {
    sqlx::query_as("SELECT status, created_by FROM settlements WHERE id = $1 AND tenant = $2 FOR UPDATE").bind(id).bind(tenant).fetch_optional(&mut *c).await?.ok_or(ApiError::NotFound)
}

/// Approves a pending settlement. The approver must not be the staff member who created it.
pub async fn approve(st: &AppState, tenant: &str, id: i64, actor: &Actor, why: &str) -> ApiResult<()> {
    let mut tx = st.pool.begin().await?;
    let (status, created_by) = lock_status(&mut tx, tenant, id).await?;
    if status != "pending_approval" {
        return Err(ApiError::Conflict { code: "invalid_state", message: format!("This settlement is {status}.") });
    }
    if created_by == actor.id {
        return Err(ApiError::Forbidden("Four-eyes rule: a different staff member must approve the settlement you created.".into()));
    }
    sqlx::query("UPDATE settlements SET status = 'approved', decided_by = $2, decided_by_name = $3, decided_at = now(), decision_reason = $4 WHERE id = $1")
        .bind(id)
        .bind(&actor.id)
        .bind(actor.name.clone().unwrap_or_default())
        .bind(why)
        .execute(&mut *tx)
        .await?;
    let n = sqlx::query("UPDATE settlement_lines SET status = 'transfer_pending', next_attempt_at = now() WHERE settlement_id = $1 AND status = 'pending_approval'").bind(id).execute(&mut *tx).await?.rows_affected();
    audit::record(&mut *tx, tenant, actor, "settlement.approve", Some(format!("settlement:{id}")), Some(json!({"status": "pending_approval"})), Some(json!({"status": "approved", "lines": n})), Some(why)).await?;
    tx.commit().await?;
    st.wake.notify_one();
    Ok(())
}

/// Rejects a pending settlement: nothing is paid; the month can be settled again (e.g. after a rate is fixed).
pub async fn reject(st: &AppState, tenant: &str, id: i64, actor: &Actor, why: &str) -> ApiResult<()> {
    let mut tx = st.pool.begin().await?;
    let (status, _) = lock_status(&mut tx, tenant, id).await?;
    if status != "pending_approval" {
        return Err(ApiError::Conflict { code: "invalid_state", message: format!("This settlement is {status}.") });
    }
    sqlx::query("UPDATE settlements SET status = 'rejected', decided_by = $2, decided_by_name = $3, decided_at = now(), decision_reason = $4 WHERE id = $1")
        .bind(id)
        .bind(&actor.id)
        .bind(actor.name.clone().unwrap_or_default())
        .bind(why)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE settlement_lines SET status = 'rejected' WHERE settlement_id = $1").bind(id).execute(&mut *tx).await?;
    audit::record(&mut *tx, tenant, actor, "settlement.reject", Some(format!("settlement:{id}")), Some(json!({"status": "pending_approval"})), Some(json!({"status": "rejected"})), Some(why)).await?;
    tx.commit().await?;
    Ok(())
}

/// Puts the failed (and waiting) lines of an approved settlement back in the transfer queue.
pub async fn retry(st: &AppState, tenant: &str, id: i64, actor: &Actor, why: &str) -> ApiResult<u64> {
    let mut tx = st.pool.begin().await?;
    let (status, _) = lock_status(&mut tx, tenant, id).await?;
    if !matches!(status.as_str(), "approved" | "partially_paid") {
        return Err(ApiError::Conflict { code: "invalid_state", message: format!("This settlement is {status}.") });
    }
    let n = sqlx::query("UPDATE settlement_lines SET status = 'transfer_pending', next_attempt_at = now(), last_error = NULL WHERE settlement_id = $1 AND status IN ('failed', 'transfer_pending')")
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(rule("nothing_to_retry", "Every line of this settlement is already credited."));
    }
    sqlx::query("UPDATE settlements SET status = 'approved', completed_at = NULL WHERE id = $1 AND status = 'partially_paid'").bind(id).execute(&mut *tx).await?;
    audit::record(&mut *tx, tenant, actor, "settlement.retry", Some(format!("settlement:{id}")), None, Some(json!({"lines": n})), Some(why)).await?;
    tx.commit().await?;
    st.wake.notify_one();
    Ok(n)
}

fn backoff_secs(attempts: i32) -> i64 {
    (30i64 << attempts.clamp(0, 7)).min(3600)
}

/// Credits due lines to the wallets. Returns (paid, still pending, failed).
pub async fn transfer_tick(st: &AppState) -> anyhow::Result<(usize, usize, usize)> {
    // lease due lines (a concurrent tick skips them), so each one is sent by one caller at a time
    let due = sqlx::query(
        "UPDATE settlement_lines l SET next_attempt_at = now() + interval '5 minutes' FROM positions p
         WHERE p.id = l.position_id AND l.id IN (
             SELECT id FROM settlement_lines WHERE status = 'transfer_pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now())
             ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)
         RETURNING l.id, l.tenant, l.settlement_id, l.period, l.position_id, l.user_id, l.currency, l.amount, l.rate_pct, l.idempotency_key, l.attempts, p.plan_name",
    )
    .fetch_all(&st.pool)
    .await?;
    let (mut paid, mut pending, mut failed) = (0, 0, 0);
    let mut touched = BTreeSet::new();
    for l in &due {
        let (id, tenant, settlement, position, user): (i64, String, i64, i64, i64) = (l.get("id"), l.get("tenant"), l.get("settlement_id"), l.get("position_id"), l.get("user_id"));
        let (period, currency, plan): (String, String, String) = (l.get("period"), l.get("currency"), l.get("plan_name"));
        let (amount, rate): (D, D) = (l.get("amount"), l.get("rate_pct"));
        let key: String = l.get("idempotency_key");
        touched.insert(settlement);
        let note = format!("Staking return {period} · {plan} · {}%", rate.normalize());
        let out = st
            .wallet
            .transfer(&st.pool, Transfer { tenant: &tenant, key: &key, user_id: user, direction: "credit", kind: wallet::KIND_REWARD, currency: &currency, amount, reference: &format!("staking:settlement:{settlement}"), note: &note })
            .await;
        match out {
            WalletOutcome::Done(v) => {
                let mut tx = st.pool.begin().await?;
                let n = sqlx::query("UPDATE settlement_lines SET status = 'paid', paid_at = now(), wallet_txn = $2, attempts = attempts + 1, last_error = NULL WHERE id = $1 AND status = 'transfer_pending'")
                    .bind(id)
                    .bind(wallet::txn_of(&v))
                    .execute(&mut *tx)
                    .await?
                    .rows_affected();
                if n == 0 {
                    continue;
                }
                sqlx::query("UPDATE positions SET returns_paid = returns_paid + $2, updated_at = now() WHERE id = $1").bind(position).bind(amount).execute(&mut *tx).await?;
                tx.commit().await?;
                notify::send(
                    st,
                    &tenant,
                    user,
                    "staking.reward_paid",
                    format!("{plan}: {period} return credited"),
                    format!("{} {currency} was added to your wallet ({}% for {period}).", text(amount), rate.normalize()),
                    format!("staking:reward:{period}:{position}"),
                );
                paid += 1;
            }
            WalletOutcome::Unknown(e) => {
                let attempts: i32 = l.get("attempts");
                sqlx::query("UPDATE settlement_lines SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + make_interval(secs => $3) WHERE id = $1")
                    .bind(id)
                    .bind(e.chars().take(500).collect::<String>())
                    .bind(backoff_secs(attempts) as f64)
                    .execute(&st.pool)
                    .await?;
                tracing::warn!(line = id, error = %e, "staking return deferred; will retry");
                pending += 1;
            }
            WalletOutcome::Rejected { code, message } => {
                let e = format!("{code}: {message}");
                sqlx::query("UPDATE settlement_lines SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1 AND status = 'transfer_pending'").bind(id).bind(&e).execute(&st.pool).await?;
                audit::record(&st.pool, &tenant, &Actor::system(), "line.failed", Some(format!("line:{id}")), None, Some(json!({"settlement": settlement, "position": position, "error": e})), None).await?;
                tracing::error!(line = id, error = %e, "staking return refused by the wallet");
                failed += 1;
            }
        }
    }
    for s in touched {
        settle(st, s).await?;
    }
    Ok((paid, pending, failed))
}

/// Closes an approved settlement once no line waits for the wallet: paid, or partially paid when lines failed.
async fn settle(st: &AppState, id: i64) -> anyhow::Result<()> {
    let r = sqlx::query("SELECT count(*) FILTER (WHERE status = 'transfer_pending') AS open, count(*) FILTER (WHERE status = 'failed') AS failed FROM settlement_lines WHERE settlement_id = $1")
        .bind(id)
        .fetch_one(&st.pool)
        .await?;
    let (open, failed): (i64, i64) = (r.get("open"), r.get("failed"));
    if open > 0 {
        return Ok(());
    }
    let status = if failed > 0 { "partially_paid" } else { "paid" };
    let row: Option<String> = sqlx::query_scalar("UPDATE settlements SET status = $2, completed_at = now() WHERE id = $1 AND status = 'approved' RETURNING tenant").bind(id).bind(status).fetch_optional(&st.pool).await?;
    if let Some(tenant) = row {
        audit::record(&st.pool, &tenant, &Actor::system(), &format!("settlement.{status}"), Some(format!("settlement:{id}")), None, Some(json!({"failed": failed})), None).await?;
    }
    Ok(())
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

pub fn settlement_json(r: &sqlx::postgres::PgRow, transfers: Option<(i64, i64, i64)>) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "period": r.get::<String, _>("period"), "status": r.get::<String, _>("status"),
        "total": num(r.get("total")), "lines": r.get::<i32, _>("lines"), "investors": r.get::<i32, _>("investors"), "principal": num(r.get("principal")),
        "rates": r.get::<sqlx::types::Json<Value>, _>("rates").0,
        "createdById": r.get::<String, _>("created_by"), "createdBy": r.get::<String, _>("created_by_name"), "createReason": r.get::<String, _>("create_reason"),
        "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
        "decidedById": r.get::<Option<String>, _>("decided_by"), "decidedBy": r.get::<Option<String>, _>("decided_by_name"),
        "decidedAt": r.get::<Option<DateTime<Utc>>, _>("decided_at"), "decisionReason": r.get::<Option<String>, _>("decision_reason"),
        "completedAt": r.get::<Option<DateTime<Utc>>, _>("completed_at"),
        "transfers": transfers.map(|(paid, pending, failed)| json!({"paid": paid, "pending": pending, "failed": failed})),
    })
}

async fn transfers(st: &AppState, ids: &[i64]) -> ApiResult<HashMap<i64, (i64, i64, i64)>> {
    let rows = sqlx::query(
        "SELECT settlement_id, count(*) FILTER (WHERE status = 'paid') AS paid, count(*) FILTER (WHERE status = 'transfer_pending') AS pending,
                count(*) FILTER (WHERE status = 'failed') AS failed
         FROM settlement_lines WHERE settlement_id = ANY($1) GROUP BY settlement_id",
    )
    .bind(ids)
    .fetch_all(&st.pool)
    .await?;
    Ok(rows.iter().map(|r| (r.get::<i64, _>("settlement_id"), (r.get("paid"), r.get("pending"), r.get("failed")))).collect())
}

pub async fn list(st: &AppState, tenant: &str, status: Option<&str>, offset: i64, limit: i64) -> ApiResult<Value> {
    let rows = sqlx::query("SELECT * FROM settlements WHERE tenant = $1 AND ($2::text IS NULL OR status = $2) ORDER BY id DESC OFFSET $3 LIMIT $4")
        .bind(tenant)
        .bind(status)
        .bind(offset)
        .bind(limit)
        .fetch_all(&st.pool)
        .await?;
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM settlements WHERE tenant = $1 AND ($2::text IS NULL OR status = $2)").bind(tenant).bind(status).fetch_one(&st.pool).await?;
    let ids: Vec<i64> = rows.iter().map(|r| r.get("id")).collect();
    let t = transfers(st, &ids).await?;
    let items: Vec<Value> = rows.iter().map(|r| settlement_json(r, Some(t.get(&r.get::<i64, _>("id")).copied().unwrap_or_default()))).collect();
    Ok(json!({"items": items, "total": total}))
}

pub async fn detail(st: &AppState, tenant: &str, id: i64) -> ApiResult<Value> {
    let r = sqlx::query("SELECT * FROM settlements WHERE id = $1 AND tenant = $2").bind(id).bind(tenant).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    let t = transfers(st, &[id]).await?;
    let rows = sqlx::query(
        "SELECT l.*, p.user_name, p.plan_name FROM settlement_lines l JOIN positions p ON p.id = l.position_id WHERE l.settlement_id = $1 ORDER BY l.id",
    )
    .bind(id)
    .fetch_all(&st.pool)
    .await?;
    let mut plans: BTreeMap<i64, (String, D, i64, D, D)> = BTreeMap::new();
    let lines: Vec<Value> = rows
        .iter()
        .map(|l| {
            let (plan_id, amount, principal): (i64, D, D) = (l.get("plan_id"), l.get("amount"), l.get("principal"));
            let e = plans.entry(plan_id).or_insert((l.get("plan_name"), l.get("rate_pct"), 0, ZERO, ZERO));
            e.2 += 1;
            e.3 += principal;
            e.4 += amount;
            json!({
                "id": l.get::<i64, _>("id"), "positionId": l.get::<i64, _>("position_id"), "userId": l.get::<i64, _>("user_id"),
                "userName": l.get::<String, _>("user_name"), "planId": plan_id, "planName": l.get::<String, _>("plan_name"),
                "currency": l.get::<String, _>("currency"), "principal": num(principal), "ratePct": num(l.get("rate_pct")),
                "daysActive": l.get::<i32, _>("days_active"), "daysInMonth": l.get::<i32, _>("days_in_month"), "amount": num(amount),
                "status": l.get::<String, _>("status"), "attempts": l.get::<i32, _>("attempts"), "lastError": l.get::<Option<String>, _>("last_error"),
                "nextAttemptAt": l.get::<Option<DateTime<Utc>>, _>("next_attempt_at"), "walletTxn": l.get::<Option<String>, _>("wallet_txn"),
                "paidAt": l.get::<Option<DateTime<Utc>>, _>("paid_at"),
            })
        })
        .collect();
    let plans: Vec<Value> = plans
        .into_iter()
        .map(|(id, (name, rate, n, principal, amount))| json!({"planId": id, "name": name, "ratePct": num(rate), "lines": n, "principal": num(principal), "amount": num(r2(amount))}))
        .collect();
    Ok(json!({"settlement": settlement_json(&r, Some(t.get(&id).copied().unwrap_or_default())), "plans": plans, "lines": lines}))
}

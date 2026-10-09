//! Monthly rates: the admin sets each plan's return for a month once the month has started (never in advance),
//! within the plan's ceiling. A month's rates are locked while a settlement for it exists (reject it to change one).

use crate::audit::{self, Actor};
use crate::error::{ApiError, ApiResult, invalid, rule};
use crate::money::{D, HUNDRED, ZERO, num, r2, value_dec};
use crate::period::{self, Period};
use crate::plans;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::HashMap;

/// Every plan's rate for `p` next to the previous month's, with what the plan's positions earn per 1 % this month
/// (`basePerPct`), so the Back Office can preview a rate before saving it.
pub async fn month(st: &AppState, tenant: &str, p: Period) -> ApiResult<Value> {
    let now = Utc::now();
    let current = Period::of(now);
    let ps = p.to_string();
    let prev = p.prev().to_string();
    let plans = plans::list(st, tenant).await?;
    let rate_rows = sqlx::query("SELECT plan_id, period, rate_pct, set_by_name, set_at, note FROM monthly_rates WHERE tenant = $1 AND period IN ($2, $3)")
        .bind(tenant)
        .bind(&ps)
        .bind(&prev)
        .fetch_all(&st.pool)
        .await?;
    let mut rates: HashMap<(i64, String), &sqlx::postgres::PgRow> = HashMap::new();
    for r in &rate_rows {
        rates.insert((r.get("plan_id"), r.get("period")), r);
    }
    // what each plan's positions earn in the month per 1 % (start and maturity days in server time)
    let pos = sqlx::query("SELECT plan_id, principal, started_at, matures_at FROM positions WHERE tenant = $1 AND status IN ('active', 'matured') AND started_at < $2 AND matures_at > $3")
        .bind(tenant)
        .bind(p.end())
        .bind(p.start())
        .fetch_all(&st.pool)
        .await?;
    let mut base: HashMap<i64, (i64, D, D)> = HashMap::new();
    let dim = D::from(p.days());
    for r in &pos {
        let days = period::days_active(r.get("started_at"), r.get("matures_at"), p);
        if days <= 0 {
            continue;
        }
        let principal: D = r.get("principal");
        let e = base.entry(r.get("plan_id")).or_insert((0, ZERO, ZERO));
        e.0 += 1;
        e.1 += principal;
        e.2 += principal * D::from(days) / dim / HUNDRED;
    }
    let paid_prev = sqlx::query("SELECT plan_id, sum(amount) AS amount FROM settlement_lines WHERE tenant = $1 AND period = $2 AND status IN ('paid', 'transfer_pending', 'failed') GROUP BY plan_id")
        .bind(tenant)
        .bind(&prev)
        .fetch_all(&st.pool)
        .await?;
    let paid_prev: HashMap<i64, D> = paid_prev.iter().map(|r| (r.get("plan_id"), r.get("amount"))).collect();
    let settlement: Option<(i64, String)> = sqlx::query_as("SELECT id, status FROM settlements WHERE tenant = $1 AND period = $2 AND status <> 'rejected'").bind(tenant).bind(&ps).fetch_optional(&st.pool).await?;
    let rate_json = |r: &sqlx::postgres::PgRow| {
        json!({"ratePct": num(r.get("rate_pct")), "setBy": r.get::<String, _>("set_by_name"), "setAt": r.get::<DateTime<Utc>, _>("set_at"), "note": r.get::<Option<String>, _>("note")})
    };
    let items: Vec<Value> = plans
        .iter()
        // drafts never had clients; other plans are listed while they earn or can still be sold
        .filter(|pl| pl.status != "draft" || base.contains_key(&pl.id))
        .map(|pl| {
            let b = base.get(&pl.id).copied().unwrap_or((0, ZERO, ZERO));
            let cur = rates.get(&(pl.id, ps.clone())).map(|r| rate_json(r));
            let estimate = rates.get(&(pl.id, ps.clone())).map(|r| r2(b.2 * r.get::<D, _>("rate_pct")));
            json!({
                "plan": {"id": pl.id, "name": pl.name, "status": pl.status, "currency": pl.currency, "maxMonthlyRatePct": num(pl.max_monthly_rate_pct), "termMonths": pl.term_months},
                "rate": cur,
                "previous": rates.get(&(pl.id, prev.clone())).map(|r| rate_json(r)),
                "previousReturns": paid_prev.get(&pl.id).map(|d| num(*d)),
                "positions": b.0, "principal": num(b.1), "basePerPct": num(r2(b.2)),
                "estimate": estimate.map(num),
            })
        })
        .collect();
    Ok(json!({
        "period": ps, "previousPeriod": prev, "currentPeriod": current.to_string(), "closed": p.is_closed(now), "closesAt": p.end(),
        "editable": p <= current && settlement.is_none(), "future": p > current,
        "settlement": settlement.map(|(id, status)| json!({"id": id, "status": status})),
        "items": items,
    }))
}

/// Sets (or changes) one plan's rate for one month. `body`: {planId, period, ratePct, note?, reason}.
pub async fn set(st: &AppState, tenant: &str, actor: &Actor, body: &Value) -> ApiResult<Value> {
    let why = plans::reason(body)?;
    let plan_id = body["planId"].as_i64().ok_or_else(|| invalid("planId", "planId is required."))?;
    let p = Period::parse(body["period"].as_str().unwrap_or("")).ok_or_else(|| invalid("period", "period must be a month, YYYY-MM."))?;
    let rate = value_dec(&body["ratePct"]).ok_or_else(|| invalid("ratePct", "ratePct must be a number."))?.normalize();
    let note = body["note"].as_str().map(|s| s.trim().chars().take(300).collect::<String>()).filter(|s| !s.is_empty());
    let plan = plans::get(st, tenant, plan_id).await?;
    if p > Period::of(Utc::now()) {
        return Err(rule("future_period", format!("Rates are set month by month: {p} hasn't started yet.")));
    }
    if rate < ZERO || rate.scale() > 4 {
        return Err(invalid("ratePct", "The rate is a percentage of 0 or more, at most 4 decimals."));
    }
    if rate > plan.max_monthly_rate_pct {
        return Err(ApiError::Rule { code: "above_ceiling", message: format!("{} allows at most {}% a month.", plan.name, plan.max_monthly_rate_pct.normalize()) });
    }
    let mut tx = st.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('staking-period:' || $1 || ':' || $2))").bind(tenant).bind(p.to_string()).execute(&mut *tx).await?;
    let locked: Option<(i64, String)> = sqlx::query_as("SELECT id, status FROM settlements WHERE tenant = $1 AND period = $2 AND status <> 'rejected'").bind(tenant).bind(p.to_string()).fetch_optional(&mut *tx).await?;
    if let Some((id, status)) = locked {
        return Err(ApiError::Conflict { code: "period_locked", message: format!("Settlement #{id} for {p} is {status}: its rates are locked. Reject it first to change a rate.") });
    }
    let before: Option<D> = sqlx::query_scalar("SELECT rate_pct FROM monthly_rates WHERE tenant = $1 AND plan_id = $2 AND period = $3").bind(tenant).bind(plan_id).bind(p.to_string()).fetch_optional(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO monthly_rates (tenant, plan_id, period, rate_pct, set_by, set_by_name, note) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant, plan_id, period) DO UPDATE SET rate_pct = EXCLUDED.rate_pct, set_by = EXCLUDED.set_by, set_by_name = EXCLUDED.set_by_name,
             set_at = now(), note = EXCLUDED.note",
    )
    .bind(tenant)
    .bind(plan_id)
    .bind(p.to_string())
    .bind(rate)
    .bind(&actor.id)
    .bind(actor.name.clone().unwrap_or_default())
    .bind(&note)
    .execute(&mut *tx)
    .await?;
    audit::record(
        &mut *tx,
        tenant,
        actor,
        "rate.set",
        Some(format!("plan:{plan_id}:{p}")),
        before.map(|b| json!({"ratePct": num(b)})),
        Some(json!({"ratePct": num(rate), "period": p.to_string(), "plan": plan.name, "note": note})),
        Some(&why),
    )
    .await?;
    tx.commit().await?;
    Ok(json!({"planId": plan_id, "period": p.to_string(), "ratePct": num(rate)}))
}

/// The last `n` settled months per plan (approved or paid settlements): what clients see as past returns.
pub async fn settled_history(st: &AppState, tenant: &str, n: usize) -> ApiResult<HashMap<i64, Vec<(String, D)>>> {
    let rows = sqlx::query(
        "SELECT r.plan_id, r.period, r.rate_pct FROM monthly_rates r
         WHERE r.tenant = $1 AND EXISTS (SELECT 1 FROM settlements s WHERE s.tenant = r.tenant AND s.period = r.period AND s.status IN ('approved', 'paid', 'partially_paid'))
         ORDER BY r.period DESC",
    )
    .bind(tenant)
    .fetch_all(&st.pool)
    .await?;
    let mut out: HashMap<i64, Vec<(String, D)>> = HashMap::new();
    for r in &rows {
        let v = out.entry(r.get("plan_id")).or_default();
        if v.len() < n {
            v.push((r.get("period"), r.get("rate_pct")));
        }
    }
    Ok(out)
}

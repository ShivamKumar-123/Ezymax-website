//! Plans: what a client can subscribe to (currency, limits, capacity, term, risk text) and the admin's ceiling for
//! a month's rate. Edits never touch existing positions: each position keeps the plan as it was accepted.

use crate::audit::{self, Actor};
use crate::error::{ApiError, ApiResult, invalid, rule};
use crate::money::{D, HUNDRED, ZERO, num, opt_num, value_dec};
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::HashMap;

pub const STATUSES: &[&str] = &["draft", "active", "paused", "closed"];
/// Largest amount a plan limit may carry (sanity bound against typos).
const MAX_AMOUNT: i64 = 1_000_000_000;

#[derive(Clone, Debug)]
pub struct Plan {
    pub id: i64,
    pub tenant: String,
    pub name: String,
    pub currency: String,
    pub min_amount: D,
    pub max_amount: Option<D>,
    pub per_user_max: Option<D>,
    pub capacity: Option<D>,
    pub term_months: i32,
    pub status: String,
    pub max_monthly_rate_pct: D,
    pub description: String,
    pub risk_text: String,
    pub sort: i32,
    pub version: i32,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_by: String,
    pub updated_at: DateTime<Utc>,
}

pub fn from_row(r: &sqlx::postgres::PgRow) -> Plan {
    Plan {
        id: r.get("id"),
        tenant: r.get("tenant"),
        name: r.get("name"),
        currency: r.get("currency"),
        min_amount: r.get("min_amount"),
        max_amount: r.get("max_amount"),
        per_user_max: r.get("per_user_max"),
        capacity: r.get("capacity"),
        term_months: r.get("term_months"),
        status: r.get("status"),
        max_monthly_rate_pct: r.get("max_monthly_rate_pct"),
        description: r.get("description"),
        risk_text: r.get("risk_text"),
        sort: r.get("sort"),
        version: r.get("version"),
        created_by: r.get("created_by"),
        created_at: r.get("created_at"),
        updated_by: r.get("updated_by"),
        updated_at: r.get("updated_at"),
    }
}

pub async fn get(st: &AppState, tenant: &str, id: i64) -> ApiResult<Plan> {
    let r = sqlx::query("SELECT * FROM plans WHERE id = $1 AND tenant = $2").bind(id).bind(tenant).fetch_optional(&st.pool).await?.ok_or(ApiError::NotFound)?;
    Ok(from_row(&r))
}

pub async fn list(st: &AppState, tenant: &str) -> ApiResult<Vec<Plan>> {
    let rows = sqlx::query("SELECT * FROM plans WHERE tenant = $1 ORDER BY sort, id").bind(tenant).fetch_all(&st.pool).await?;
    Ok(rows.iter().map(from_row).collect())
}

/// The terms a client accepts (stored on the position).
pub fn snapshot(p: &Plan) -> Value {
    json!({
        "id": p.id, "name": p.name, "version": p.version, "currency": p.currency, "termMonths": p.term_months,
        "minAmount": num(p.min_amount), "maxAmount": opt_num(p.max_amount), "perUserMax": opt_num(p.per_user_max),
        "description": p.description, "riskText": p.risk_text,
    })
}

/// Open principal per plan (pending payment + active), for capacity and the admin lists.
#[derive(Clone, Copy, Default, Debug)]
pub struct Stats {
    pub active_principal: D,
    pub pending_principal: D,
    pub active_positions: i64,
    pub investors: i64,
    pub matured_positions: i64,
}

pub async fn stats(st: &AppState, tenant: &str) -> ApiResult<HashMap<i64, Stats>> {
    let rows = sqlx::query(
        "SELECT plan_id,
                COALESCE(sum(principal) FILTER (WHERE status = 'active'), 0) AS active_principal,
                COALESCE(sum(principal) FILTER (WHERE status = 'pending_payment'), 0) AS pending_principal,
                count(*) FILTER (WHERE status = 'active') AS active_positions,
                count(DISTINCT user_id) FILTER (WHERE status IN ('active', 'pending_payment')) AS investors,
                count(*) FILTER (WHERE status = 'matured') AS matured_positions
         FROM positions WHERE tenant = $1 GROUP BY plan_id",
    )
    .bind(tenant)
    .fetch_all(&st.pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| {
            (
                r.get::<i64, _>("plan_id"),
                Stats {
                    active_principal: r.get("active_principal"),
                    pending_principal: r.get("pending_principal"),
                    active_positions: r.get("active_positions"),
                    investors: r.get("investors"),
                    matured_positions: r.get("matured_positions"),
                },
            )
        })
        .collect())
}

pub fn admin_json(p: &Plan, s: Stats) -> Value {
    let open = s.active_principal + s.pending_principal;
    json!({
        "id": p.id, "name": p.name, "currency": p.currency, "status": p.status,
        "minAmount": num(p.min_amount), "maxAmount": opt_num(p.max_amount), "perUserMax": opt_num(p.per_user_max), "capacity": opt_num(p.capacity),
        "capacityLeft": p.capacity.map(|c| num((c - open).max(ZERO))),
        "termMonths": p.term_months, "maxMonthlyRatePct": num(p.max_monthly_rate_pct),
        "description": p.description, "riskText": p.risk_text, "sort": p.sort, "version": p.version,
        "createdBy": p.created_by, "createdAt": p.created_at, "updatedBy": p.updated_by, "updatedAt": p.updated_at,
        "stats": {
            "activePrincipal": num(s.active_principal), "pendingPrincipal": num(s.pending_principal),
            "activePositions": s.active_positions, "investors": s.investors, "maturedPositions": s.matured_positions,
        },
    })
}

/* ------------------------------------------------------------------ */
/* Editing                                                             */
/* ------------------------------------------------------------------ */

/// Text field: trimmed, control characters dropped (newlines kept), at most `max` chars.
fn text(v: &Value, max: usize) -> Option<String> {
    v.as_str().map(|s| s.trim().chars().filter(|c| !c.is_control() || *c == '\n').take(max).collect())
}

/// A required positive amount with at most 2 decimals.
fn amount(v: &Value, field: &'static str) -> ApiResult<D> {
    let d = value_dec(v).ok_or_else(|| invalid(field, format!("{field} must be a number.")))?;
    if d <= ZERO || d > D::from(MAX_AMOUNT) || d.normalize().scale() > 2 {
        return Err(invalid(field, format!("{field} must be above 0, at most 2 decimals.")));
    }
    Ok(d.normalize())
}

/// A nullable limit: missing → keep `base`, null → no limit.
fn limit(body: &Value, key: &'static str, base: Option<D>) -> ApiResult<Option<D>> {
    match body.get(key) {
        None => Ok(base),
        Some(Value::Null) => Ok(None),
        Some(v) => amount(v, key).map(Some),
    }
}

/// Applies a create (`base` None) or patch body and validates the result.
fn draft(base: Option<&Plan>, body: &Value, currencies: &[String]) -> ApiResult<Plan> {
    let now = Utc::now();
    let mut p = base.cloned().unwrap_or(Plan {
        id: 0,
        tenant: String::new(),
        name: String::new(),
        currency: currencies.first().cloned().unwrap_or_else(|| "USDT".into()),
        min_amount: ZERO,
        max_amount: None,
        per_user_max: None,
        capacity: None,
        term_months: 0,
        status: "draft".into(),
        max_monthly_rate_pct: ZERO,
        description: String::new(),
        risk_text: String::new(),
        sort: 0,
        version: 1,
        created_by: String::new(),
        created_at: now,
        updated_by: String::new(),
        updated_at: now,
    });
    if let Some(v) = body.get("name") {
        p.name = text(v, 80).ok_or_else(|| invalid("name", "name must be text."))?;
    }
    if p.name.chars().count() < 2 {
        return Err(invalid("name", "Give the plan a name (2–80 characters)."));
    }
    if let Some(v) = body.get("currency") {
        p.currency = v.as_str().map(|c| c.trim().to_uppercase()).unwrap_or_default();
    }
    if !currencies.contains(&p.currency) {
        return Err(invalid("currency", format!("The wallet holds {} only.", currencies.join(", "))));
    }
    match body.get("minAmount") {
        Some(v) => p.min_amount = amount(v, "minAmount")?,
        None if base.is_none() => return Err(invalid("minAmount", "minAmount is required.")),
        None => {}
    }
    p.max_amount = limit(body, "maxAmount", p.max_amount)?;
    p.per_user_max = limit(body, "perUserMax", p.per_user_max)?;
    p.capacity = limit(body, "capacity", p.capacity)?;
    for (field, v) in [("maxAmount", p.max_amount), ("perUserMax", p.per_user_max), ("capacity", p.capacity)] {
        if v.is_some_and(|v| v < p.min_amount) {
            return Err(invalid(field, format!("{field} can't be below the minimum amount.")));
        }
    }
    if let Some(v) = body.get("termMonths") {
        p.term_months = v.as_i64().filter(|n| (1..=60).contains(n)).ok_or_else(|| invalid("termMonths", "termMonths must be 1–60."))? as i32;
    }
    if p.term_months < 1 {
        return Err(invalid("termMonths", "termMonths is required (1–60)."));
    }
    if let Some(v) = body.get("maxMonthlyRatePct") {
        p.max_monthly_rate_pct = value_dec(v).ok_or_else(|| invalid("maxMonthlyRatePct", "maxMonthlyRatePct must be a number."))?.normalize();
    }
    if p.max_monthly_rate_pct <= ZERO || p.max_monthly_rate_pct > HUNDRED || p.max_monthly_rate_pct.scale() > 4 {
        return Err(invalid("maxMonthlyRatePct", "The monthly rate ceiling must be above 0% and at most 100% (4 decimals)."));
    }
    if let Some(v) = body.get("description") {
        p.description = text(v, 2000).unwrap_or_default();
    }
    if let Some(v) = body.get("riskText") {
        p.risk_text = text(v, 4000).unwrap_or_default();
    }
    if let Some(v) = body.get("sort") {
        p.sort = v.as_i64().map(|n| n.clamp(-10_000, 10_000) as i32).ok_or_else(|| invalid("sort", "sort must be a whole number."))?;
    }
    if let Some(v) = body.get("status") {
        p.status = v.as_str().filter(|s| STATUSES.contains(s)).ok_or_else(|| invalid("status", "status must be draft, active, paused or closed."))?.to_string();
    }
    if p.status == "active" && p.risk_text.chars().count() < 20 {
        return Err(invalid("riskText", "An active plan needs its risk disclosure (at least 20 characters)."));
    }
    Ok(p)
}

/// Admin writes carry a reason (3–500 characters), kept in the audit log.
pub fn reason(body: &Value) -> ApiResult<String> {
    let r = text(&body["reason"], 500).unwrap_or_default();
    if r.chars().count() < 3 {
        return Err(invalid("reason", "Give a reason (at least 3 characters). It is kept in the audit log."));
    }
    Ok(r)
}

pub async fn create(st: &AppState, tenant: &str, actor: &Actor, body: &Value) -> ApiResult<Plan> {
    let why = reason(body)?;
    let p = draft(None, body, &st.cfg.currencies)?;
    let mut tx = st.pool.begin().await?;
    let row = sqlx::query(
        "INSERT INTO plans (tenant, name, currency, min_amount, max_amount, per_user_max, capacity, term_months, status, max_monthly_rate_pct,
                            description, risk_text, sort, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *",
    )
    .bind(tenant)
    .bind(&p.name)
    .bind(&p.currency)
    .bind(p.min_amount)
    .bind(p.max_amount)
    .bind(p.per_user_max)
    .bind(p.capacity)
    .bind(p.term_months)
    .bind(&p.status)
    .bind(p.max_monthly_rate_pct)
    .bind(&p.description)
    .bind(&p.risk_text)
    .bind(p.sort)
    .bind(actor.label())
    .fetch_one(&mut *tx)
    .await?;
    let created = from_row(&row);
    audit::record(&mut *tx, tenant, actor, "plan.create", Some(format!("plan:{}", created.id)), None, Some(admin_json(&created, Stats::default())), Some(&why)).await?;
    tx.commit().await?;
    Ok(created)
}

pub async fn update(st: &AppState, tenant: &str, id: i64, actor: &Actor, body: &Value) -> ApiResult<Plan> {
    let why = reason(body)?;
    let mut tx = st.pool.begin().await?;
    let row = sqlx::query("SELECT * FROM plans WHERE id = $1 AND tenant = $2 FOR UPDATE").bind(id).bind(tenant).fetch_optional(&mut *tx).await?.ok_or(ApiError::NotFound)?;
    let before = from_row(&row);
    let after = draft(Some(&before), body, &st.cfg.currencies)?;
    let positions: i64 = sqlx::query_scalar("SELECT count(*) FROM positions WHERE plan_id = $1 AND status <> 'payment_failed'").bind(id).fetch_one(&mut *tx).await?;
    if positions > 0 && after.currency != before.currency {
        return Err(rule("plan_in_use", "Clients hold positions in this plan, so its currency can't change. Close it and create a new plan."));
    }
    if positions > 0 && after.status == "draft" && before.status != "draft" {
        return Err(rule("plan_in_use", "Clients hold positions in this plan: pause or close it instead of moving it back to draft."));
    }
    let row = sqlx::query(
        "UPDATE plans SET name = $2, currency = $3, min_amount = $4, max_amount = $5, per_user_max = $6, capacity = $7, term_months = $8, status = $9,
                          max_monthly_rate_pct = $10, description = $11, risk_text = $12, sort = $13, version = version + 1, updated_by = $14, updated_at = now()
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&after.name)
    .bind(&after.currency)
    .bind(after.min_amount)
    .bind(after.max_amount)
    .bind(after.per_user_max)
    .bind(after.capacity)
    .bind(after.term_months)
    .bind(&after.status)
    .bind(after.max_monthly_rate_pct)
    .bind(&after.description)
    .bind(&after.risk_text)
    .bind(after.sort)
    .bind(actor.label())
    .fetch_one(&mut *tx)
    .await?;
    let saved = from_row(&row);
    audit::record(&mut *tx, tenant, actor, "plan.update", Some(format!("plan:{id}")), Some(admin_json(&before, Stats::default())), Some(admin_json(&saved, Stats::default())), Some(&why)).await?;
    tx.commit().await?;
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cur() -> Vec<String> {
        vec!["USDT".into()]
    }

    #[test]
    fn validates_a_new_plan() {
        let ok = json!({"name": "Fixed 6M", "minAmount": 100, "maxAmount": "50000", "termMonths": 6, "maxMonthlyRatePct": 3, "riskText": "Returns are not guaranteed and may be zero."});
        let p = draft(None, &ok, &cur()).unwrap();
        assert_eq!((p.status.as_str(), p.currency.as_str(), p.term_months), ("draft", "USDT", 6));
        assert_eq!(p.max_amount, Some(D::from(50_000)));
        let bad = |patch: Value| {
            let mut b = ok.clone();
            for (k, v) in patch.as_object().unwrap() {
                b[k] = v.clone();
            }
            draft(None, &b, &cur()).is_err()
        };
        assert!(bad(json!({"currency": "BTC"})));
        assert!(bad(json!({"minAmount": 0})));
        assert!(bad(json!({"minAmount": "10.001"})));
        assert!(bad(json!({"maxAmount": 50})));
        assert!(bad(json!({"termMonths": 0})));
        assert!(bad(json!({"termMonths": 61})));
        assert!(bad(json!({"maxMonthlyRatePct": 0})));
        assert!(bad(json!({"maxMonthlyRatePct": 101})));
        assert!(bad(json!({"name": "x"})));
        assert!(bad(json!({"status": "live"})));
        // active needs the risk disclosure
        assert!(bad(json!({"status": "active", "riskText": "short"})));
        assert!(!bad(json!({"status": "active"})));
    }

    #[test]
    fn patch_keeps_and_clears_limits() {
        let base = draft(None, &json!({"name": "Plan", "minAmount": 100, "capacity": 1000000, "termMonths": 3, "maxMonthlyRatePct": 2}), &cur()).unwrap();
        let p = draft(Some(&base), &json!({"name": "Plan B"}), &cur()).unwrap();
        assert_eq!(p.capacity, Some(D::from(1_000_000)));
        let p = draft(Some(&base), &json!({"capacity": null}), &cur()).unwrap();
        assert_eq!(p.capacity, None);
        assert!(reason(&json!({"reason": "  "})).is_err());
        assert_eq!(reason(&json!({"reason": " New quarter "})).unwrap(), "New quarter");
    }
}

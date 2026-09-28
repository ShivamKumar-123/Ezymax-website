//! Challenge plans (D147): 1-step, 2-step and instant funding, with sizes, fees, leverage, phases and the
//! full rule set. The same JSON shape is the admin API, the client catalogue and the snapshot a challenge
//! keeps at purchase (running challenges never change rules when a plan is edited).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::error::{ApiError, ApiResult};
use crate::money::{D, ZERO, jnum};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanSize {
    #[serde(with = "jnum")]
    pub size: D,
    #[serde(with = "jnum")]
    pub fee: D,
    pub leverage: u32,
    #[serde(default = "yes")]
    pub enabled: bool,
}

fn yes() -> bool {
    true
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Phase {
    pub name: String,
    /// Profit target, % of the initial balance.
    #[serde(with = "jnum")]
    pub target: D,
    #[serde(default)]
    pub min_days: u32,
    /// Days; 0 = no time limit.
    #[serde(default)]
    pub time_limit: u32,
}

/// Banned strategies the heuristics detect (D148). Other labels may be listed on a plan for the rules
/// page, but only these codes are detected automatically.
pub const DETECTED_STRATEGIES: [&str; 5] = ["hft", "latency_arbitrage", "tick_scalping", "cross_account_copying", "cross_account_hedging"];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    /// Slug; taken from the path on PUT.
    #[serde(default)]
    pub id: String,
    pub name: String,
    /// "1-step" | "2-step" | "instant"
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default = "draft")]
    pub status: String,
    #[serde(default)]
    pub version: i32,
    /// Trading engine group the accounts are opened in.
    #[serde(default = "prop_group")]
    pub group: String,
    pub sizes: Vec<PlanSize>,
    #[serde(default)]
    pub phases: Vec<Phase>,
    /// Daily loss limit, % of the initial balance.
    #[serde(with = "jnum")]
    pub daily_loss: D,
    /// "balance": reference = balance at the daily reset; "equity": the higher of balance and equity then.
    pub daily_basis: String,
    /// Max drawdown, % of the initial balance.
    #[serde(rename = "maxDD", with = "jnum")]
    pub max_dd: D,
    /// "static" | "trailing"
    pub dd_type: String,
    /// Trailing drawdown stops trailing once its floor reaches the initial balance.
    #[serde(default = "yes")]
    pub trailing_lock: bool,
    /// Max share (%) of total profit made on one day; 0 = off.
    #[serde(with = "jnum", default)]
    pub consistency: D,
    pub news_trading: bool,
    /// Minutes before and after a high-impact event.
    #[serde(default)]
    pub news_window: i32,
    /// A news-window trade fails the account (otherwise it's a violation: the trade is closed and logged).
    #[serde(default)]
    pub news_breach_fails: bool,
    pub weekend_holding: bool,
    #[serde(default = "yes")]
    pub ea_allowed: bool,
    #[serde(default)]
    pub banned: Vec<String>,
    /// Trader profit split % on funded payouts.
    #[serde(with = "jnum")]
    pub split: D,
    #[serde(with = "jnum")]
    pub split_max: D,
    /// Scaling review period in months (0 = no scaling plan).
    #[serde(default)]
    pub scaling_every: i32,
    #[serde(with = "jnum", default)]
    pub scaling_increase: D,
    #[serde(with = "jnum", default)]
    pub scaling_profit: D,
    #[serde(with = "jnum", default)]
    pub scaling_cap: D,
    #[serde(default)]
    pub refund_fee: bool,
    /// "weekly" | "bi-weekly" | "monthly" | "on-demand"
    pub payout_freq: String,
    #[serde(default)]
    pub first_payout_days: i32,
    #[serde(with = "jnum", default)]
    pub min_payout: D,
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub updated_by: Option<String>,
}

fn draft() -> String {
    "draft".into()
}
fn prop_group() -> String {
    "prop".into()
}

impl Plan {
    pub fn size(&self, size: D) -> Option<&PlanSize> {
        self.sizes.iter().find(|s| s.size == size)
    }

    /// Days between funded payouts after the first one.
    pub fn payout_cycle_days(&self) -> i64 {
        match self.payout_freq.as_str() {
            "weekly" => 7,
            "bi-weekly" => 14,
            "monthly" => 30,
            _ => 0,
        }
    }

    pub fn bans(&self, code: &str) -> bool {
        self.banned.iter().any(|b| b == code)
    }

    /// Checks everything the evaluator relies on. Returns the first problem as a validation error.
    pub fn validate(&self) -> ApiResult<()> {
        let bad = |field: &'static str, m: &str| Err(ApiError::Validation { field, message: m.to_string() });
        if !(2..=48).contains(&self.id.len()) || !self.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') || self.id.starts_with('-') {
            return bad("id", "Plan id: 2–48 lowercase letters, digits or dashes");
        }
        if self.name.trim().is_empty() || self.name.len() > 80 {
            return bad("name", "Name is required (max 80 characters)");
        }
        let phases = match self.kind.as_str() {
            "1-step" => 1,
            "2-step" => 2,
            "instant" => 0,
            _ => return bad("type", "type must be 1-step, 2-step or instant"),
        };
        if self.phases.len() != phases {
            return bad("phases", &format!("A {} plan has {} evaluation phase(s)", self.kind, phases));
        }
        for p in &self.phases {
            if p.name.trim().is_empty() || p.name.len() > 40 {
                return bad("phases", "Every phase needs a name");
            }
            if p.target <= ZERO || p.target > D::from(100) {
                return bad("phases", "Profit targets must be between 0 and 100%");
            }
            if p.min_days > 60 || p.time_limit > 365 {
                return bad("phases", "Min days ≤ 60 and time limit ≤ 365 days");
            }
            if p.time_limit > 0 && p.time_limit < p.min_days {
                return bad("phases", "The time limit must be at least the minimum trading days");
            }
        }
        if !["draft", "active", "paused", "archived"].contains(&self.status.as_str()) {
            return bad("status", "status must be draft, active, paused or archived");
        }
        if self.group.is_empty() || self.group.len() > 40 {
            return bad("group", "Engine group is required");
        }
        if self.sizes.is_empty() || self.sizes.len() > 20 {
            return bad("sizes", "Add 1–20 account sizes");
        }
        let mut seen = vec![];
        for s in &self.sizes {
            if s.size < D::from(1000) || s.size > D::from(5_000_000) {
                return bad("sizes", "Account sizes must be between 1,000 and 5,000,000");
            }
            if s.fee < ZERO || s.fee > D::from(100_000) || s.fee.scale() > 2 {
                return bad("sizes", "Fees must be between 0 and 100,000 with at most 2 decimals");
            }
            if s.leverage == 0 || s.leverage > 1000 {
                return bad("sizes", "Leverage must be between 1 and 1000");
            }
            if seen.contains(&s.size) {
                return bad("sizes", "Each size can be listed once");
            }
            seen.push(s.size);
        }
        if self.daily_loss <= ZERO || self.daily_loss > D::from(50) {
            return bad("dailyLoss", "Daily loss must be between 0 and 50%");
        }
        if !["balance", "equity"].contains(&self.daily_basis.as_str()) {
            return bad("dailyBasis", "dailyBasis must be balance or equity");
        }
        if self.max_dd <= ZERO || self.max_dd > D::from(50) {
            return bad("maxDD", "Max drawdown must be between 0 and 50%");
        }
        if self.max_dd < self.daily_loss {
            return bad("maxDD", "Max drawdown can't be smaller than the daily loss limit");
        }
        if !["static", "trailing"].contains(&self.dd_type.as_str()) {
            return bad("ddType", "ddType must be static or trailing");
        }
        if self.consistency < ZERO || self.consistency > D::from(100) {
            return bad("consistency", "Consistency must be between 0 and 100% (0 = off)");
        }
        if !(0..=240).contains(&self.news_window) {
            return bad("newsWindow", "News window must be 0–240 minutes");
        }
        if self.split <= ZERO || self.split > D::from(100) || self.split_max < self.split || self.split_max > D::from(100) {
            return bad("split", "Split must be 1–100% and the max split at least the split");
        }
        if self.scaling_every < 0 || self.scaling_every > 24 || self.scaling_increase < ZERO || self.scaling_increase > D::from(100) || self.scaling_profit < ZERO || self.scaling_cap < ZERO {
            return bad("scalingEvery", "Invalid scaling plan");
        }
        if !["weekly", "bi-weekly", "monthly", "on-demand"].contains(&self.payout_freq.as_str()) {
            return bad("payoutFreq", "payoutFreq must be weekly, bi-weekly, monthly or on-demand");
        }
        if !(0..=365).contains(&self.first_payout_days) {
            return bad("firstPayoutDays", "First payout after 0–365 days");
        }
        if self.min_payout < ZERO {
            return bad("minPayout", "Minimum payout can't be negative");
        }
        if self.banned.len() > 20 || self.banned.iter().any(|b| b.is_empty() || b.len() > 60) {
            return bad("banned", "Invalid banned strategy list");
        }
        Ok(())
    }
}

const PLAN_COLS: &str = "id, name, kind, status, version, engine_group, phases, daily_loss_pct, daily_basis, max_dd_pct, dd_type, trailing_lock,
    consistency_pct, news_trading, news_window_min, news_breach_fails, weekend_holding, ea_allowed, banned, split_pct, split_max_pct,
    scaling_every_months, scaling_increase_pct, scaling_profit_pct, scaling_cap, refund_fee, payout_freq, first_payout_days, min_payout,
    updated_at, updated_by";

fn plan_from_row(r: &sqlx::postgres::PgRow, sizes: Vec<PlanSize>) -> Plan {
    let phases: sqlx::types::Json<Vec<Phase>> = r.get("phases");
    Plan {
        id: r.get("id"),
        name: r.get("name"),
        kind: r.get("kind"),
        status: r.get("status"),
        version: r.get("version"),
        group: r.get("engine_group"),
        sizes,
        phases: phases.0,
        daily_loss: r.get("daily_loss_pct"),
        daily_basis: r.get("daily_basis"),
        max_dd: r.get("max_dd_pct"),
        dd_type: r.get("dd_type"),
        trailing_lock: r.get("trailing_lock"),
        consistency: r.get("consistency_pct"),
        news_trading: r.get("news_trading"),
        news_window: r.get("news_window_min"),
        news_breach_fails: r.get("news_breach_fails"),
        weekend_holding: r.get("weekend_holding"),
        ea_allowed: r.get("ea_allowed"),
        banned: r.get("banned"),
        split: r.get("split_pct"),
        split_max: r.get("split_max_pct"),
        scaling_every: r.get("scaling_every_months"),
        scaling_increase: r.get("scaling_increase_pct"),
        scaling_profit: r.get("scaling_profit_pct"),
        scaling_cap: r.get("scaling_cap"),
        refund_fee: r.get("refund_fee"),
        payout_freq: r.get("payout_freq"),
        first_payout_days: r.get("first_payout_days"),
        min_payout: r.get("min_payout"),
        updated_at: r.get("updated_at"),
        updated_by: r.get("updated_by"),
    }
}

async fn sizes_of(pool: &PgPool, tenant: &str) -> ApiResult<Vec<(String, PlanSize)>> {
    let rows = sqlx::query("SELECT plan_id, size, fee, leverage, enabled FROM plan_sizes WHERE tenant = $1 ORDER BY plan_id, size")
        .bind(tenant)
        .fetch_all(pool)
        .await?;
    Ok(rows
        .iter()
        .map(|r| (r.get::<String, _>("plan_id"), PlanSize { size: r.get("size"), fee: r.get("fee"), leverage: r.get::<i32, _>("leverage") as u32, enabled: r.get("enabled") }))
        .collect())
}

pub async fn list(pool: &PgPool, tenant: &str, include_archived: bool) -> ApiResult<Vec<Plan>> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {PLAN_COLS} FROM plans WHERE tenant = $1 AND ($2 OR status <> 'archived') ORDER BY created_at, id"
    )))
    .bind(tenant)
    .bind(include_archived)
    .fetch_all(pool)
    .await?;
    let sizes = sizes_of(pool, tenant).await?;
    Ok(rows
        .iter()
        .map(|r| {
            let id: String = r.get("id");
            let s = sizes.iter().filter(|(p, _)| *p == id).map(|(_, s)| s.clone()).collect();
            plan_from_row(r, s)
        })
        .collect())
}

pub async fn get(pool: &PgPool, tenant: &str, id: &str) -> ApiResult<Plan> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {PLAN_COLS} FROM plans WHERE tenant = $1 AND id = $2")))
        .bind(tenant)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("Plan not found".into()))?;
    let sizes = sizes_of(pool, tenant).await?.into_iter().filter(|(p, _)| p == id).map(|(_, s)| s).collect();
    Ok(plan_from_row(&r, sizes))
}

/// Inserts or replaces a plan (and its sizes) in one transaction; the version is bumped on every save.
pub async fn save(pool: &PgPool, tenant: &str, p: &Plan, by: &str, create: bool) -> ApiResult<Plan> {
    let mut tx = pool.begin().await?;
    let exists: Option<i32> = sqlx::query_scalar("SELECT version FROM plans WHERE tenant = $1 AND id = $2 FOR UPDATE").bind(tenant).bind(&p.id).fetch_optional(&mut *tx).await?;
    match (create, exists) {
        (true, Some(_)) => return Err(ApiError::Conflict { code: "exists", message: "A plan with this id already exists".into() }),
        (false, None) => return Err(ApiError::NotFound("Plan not found".into())),
        _ => {}
    }
    let version = exists.map(|v| v + 1).unwrap_or(1);
    sqlx::query(
        "INSERT INTO plans (tenant, id, name, kind, status, version, engine_group, phases, daily_loss_pct, daily_basis, max_dd_pct, dd_type, trailing_lock,
            consistency_pct, news_trading, news_window_min, news_breach_fails, weekend_holding, ea_allowed, banned, split_pct, split_max_pct,
            scaling_every_months, scaling_increase_pct, scaling_profit_pct, scaling_cap, refund_fee, payout_freq, first_payout_days, min_payout, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30, now(), $31)
         ON CONFLICT (tenant, id) DO UPDATE SET name=$3, kind=$4, status=$5, version=$6, engine_group=$7, phases=$8, daily_loss_pct=$9, daily_basis=$10,
            max_dd_pct=$11, dd_type=$12, trailing_lock=$13, consistency_pct=$14, news_trading=$15, news_window_min=$16, news_breach_fails=$17,
            weekend_holding=$18, ea_allowed=$19, banned=$20, split_pct=$21, split_max_pct=$22, scaling_every_months=$23, scaling_increase_pct=$24,
            scaling_profit_pct=$25, scaling_cap=$26, refund_fee=$27, payout_freq=$28, first_payout_days=$29, min_payout=$30, updated_at=now(), updated_by=$31",
    )
    .bind(tenant)
    .bind(&p.id)
    .bind(p.name.trim())
    .bind(&p.kind)
    .bind(&p.status)
    .bind(version)
    .bind(&p.group)
    .bind(sqlx::types::Json(&p.phases))
    .bind(p.daily_loss)
    .bind(&p.daily_basis)
    .bind(p.max_dd)
    .bind(&p.dd_type)
    .bind(p.trailing_lock)
    .bind(p.consistency)
    .bind(p.news_trading)
    .bind(p.news_window)
    .bind(p.news_breach_fails)
    .bind(p.weekend_holding)
    .bind(p.ea_allowed)
    .bind(&p.banned)
    .bind(p.split)
    .bind(p.split_max)
    .bind(p.scaling_every)
    .bind(p.scaling_increase)
    .bind(p.scaling_profit)
    .bind(p.scaling_cap)
    .bind(p.refund_fee)
    .bind(&p.payout_freq)
    .bind(p.first_payout_days)
    .bind(p.min_payout)
    .bind(by)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM plan_sizes WHERE tenant = $1 AND plan_id = $2").bind(tenant).bind(&p.id).execute(&mut *tx).await?;
    for s in &p.sizes {
        sqlx::query("INSERT INTO plan_sizes (tenant, plan_id, size, fee, leverage, enabled) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(tenant)
            .bind(&p.id)
            .bind(s.size)
            .bind(s.fee)
            .bind(s.leverage as i32)
            .bind(s.enabled)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    get(pool, tenant, &p.id).await
}

pub async fn set_status(pool: &PgPool, tenant: &str, id: &str, status: &str, by: &str) -> ApiResult<Plan> {
    let n = sqlx::query("UPDATE plans SET status = $3, updated_at = now(), updated_by = $4 WHERE tenant = $1 AND id = $2")
        .bind(tenant)
        .bind(id)
        .bind(status)
        .bind(by)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(ApiError::NotFound("Plan not found".into()));
    }
    get(pool, tenant, id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn sample() -> Plan {
        serde_json::from_value(serde_json::json!({
            "id": "classic-2-step", "name": "Classic", "type": "2-step", "status": "active", "group": "prop",
            "sizes": [{"size": 10000, "fee": 89, "leverage": 100}],
            "phases": [{"name": "Phase 1", "target": 8, "minDays": 4}, {"name": "Phase 2", "target": 5, "minDays": 4}],
            "dailyLoss": 5, "dailyBasis": "balance", "maxDD": 10, "ddType": "static", "consistency": 0,
            "newsTrading": true, "newsWindow": 2, "weekendHolding": true, "split": 80, "splitMax": 90,
            "payoutFreq": "bi-weekly", "firstPayoutDays": 14, "minPayout": "50"
        }))
        .unwrap()
    }

    #[test]
    fn plan_json_round_trip_and_validation() {
        let p = sample();
        p.validate().unwrap();
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(v["maxDD"], serde_json::json!(10.0));
        assert_eq!(v["minPayout"], serde_json::json!(50.0));
        let back: Plan = serde_json::from_value(v).unwrap();
        assert_eq!(back, p);

        let mut bad = p.clone();
        bad.phases.pop();
        assert!(bad.validate().is_err(), "2-step needs two phases");
        let mut bad = p.clone();
        bad.max_dd = D::from(4);
        assert!(bad.validate().is_err(), "max DD below daily loss");
        let mut bad = p;
        bad.split_max = D::from(70);
        assert!(bad.validate().is_err());
    }
}

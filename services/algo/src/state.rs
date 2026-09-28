//! Shared state, request context extractors, settings and audit helpers.

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use axum::extract::FromRequestParts;
use axum::http::HeaderMap;
use axum::http::request::Parts;
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::sync::Notify;

use crate::clients::{Engine, MarketData, Wallet};
use crate::config::Config;
use crate::error::ApiError;
use crate::security::Limiter;
use crate::specs::Specs;

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub pool: PgPool,
    pub specs: Arc<Specs>,
    pub md: MarketData,
    pub engine: Arc<Engine>,
    pub wallet: Wallet,
    pub http: reqwest::Client,
    pub limiter: Arc<Limiter>,
    /// Cancel flags of running backtests.
    pub cancels: Arc<Mutex<HashMap<i64, Arc<AtomicBool>>>>,
    /// Wakes the runtime when deployments change.
    pub runtime_wake: Arc<Notify>,
    /// Wakes the backtest workers when a job is queued.
    pub jobs_wake: Arc<Notify>,
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

fn header(h: &HeaderMap, k: &str) -> Option<String> {
    h.get(k).and_then(|v| v.to_str().ok()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn pct_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = vec![];
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn tenant_of(h: &HeaderMap) -> Result<String, ApiError> {
    let t = header(h, "x-kalks-tenant").unwrap_or_else(|| "kalks".into());
    if t.len() > 40 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(ApiError::BadRequest("Invalid tenant.".into()));
    }
    Ok(t)
}

/// A signed-in client, forwarded by the CRM BFF after its own session check.
#[derive(Clone, Debug)]
pub struct User {
    pub tenant: String,
    pub id: i64,
    pub name: String,
}

impl<S: Send + Sync> FromRequestParts<S> for User {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let h = &parts.headers;
        let id = header(h, "x-kalks-user-id").and_then(|v| v.parse::<i64>().ok()).filter(|v| *v > 0).ok_or_else(|| ApiError::Unauthorized("User identity required.".into()))?;
        let name = header(h, "x-kalks-user-name").map(|n| pct_decode(&n)).map(|n| n.chars().take(60).collect()).unwrap_or_else(|| format!("Trader {id}"));
        Ok(User { tenant: tenant_of(h)?, id, name })
    }
}

/// A staff member, forwarded by the Back Office BFF after it verified the staff session and permission.
#[derive(Clone, Debug)]
pub struct Staff {
    pub tenant: String,
    pub id: i64,
    pub name: String,
    pub role: String,
}

impl Staff {
    pub fn actor(&self) -> String {
        format!("staff:{}", self.id)
    }
}

pub const STAFF_WRITE_ROLES: [&str; 5] = ["platform_owner", "super_admin", "admin", "risk_manager", "dealer"];
pub const STAFF_CONFIG_ROLES: [&str; 3] = ["platform_owner", "super_admin", "admin"];

impl<S: Send + Sync> FromRequestParts<S> for Staff {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let h = &parts.headers;
        let id = header(h, "x-kalks-staff-id").and_then(|v| v.parse::<i64>().ok()).ok_or_else(|| ApiError::Unauthorized("Staff identity required.".into()))?;
        let role = header(h, "x-kalks-staff-role").ok_or_else(|| ApiError::Unauthorized("Staff role required.".into()))?;
        let name = header(h, "x-kalks-staff-name").map(|n| pct_decode(&n)).unwrap_or_else(|| format!("Staff {id}"));
        Ok(Staff { tenant: tenant_of(h)?, id, name, role })
    }
}

impl Staff {
    pub fn require(&self, roles: &[&str]) -> Result<(), ApiError> {
        if roles.contains(&self.role.as_str()) { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this.".into())) }
    }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/// Tenant settings with defaults (edited in the Back Office).
pub fn default_settings() -> Value {
    json!({
        "globalKill": false,          // halts every strategy, webhook and API order of the tenant
        "platformCutPct": 20.0,       // marketplace fee kept by the platform
        "apiRatePerMin": 60,          // default per-key request limit
        "webhookRatePerMin": 30,      // per webhook URL
        "maxDeploymentsPerUser": 10,
        "minTrackTrades": 1,          // closed trades a deployment needs before its strategy can be published
        "aiPerHour": 30,
        "backtestsPerDay": 200,
    })
}

pub async fn settings(pool: &PgPool, tenant: &str) -> Value {
    let mut s = default_settings();
    let row: Option<Value> = sqlx::query_scalar("SELECT value FROM settings WHERE tenant_id = $1 AND key = 'algo'").bind(tenant).fetch_optional(pool).await.ok().flatten();
    if let (Some(Value::Object(o)), Some(d)) = (row, s.as_object_mut()) {
        for (k, v) in o {
            if d.contains_key(&k) {
                d.insert(k, v);
            }
        }
    }
    s
}

pub fn setting_f64(s: &Value, k: &str) -> f64 {
    s.get(k).and_then(Value::as_f64).unwrap_or(0.0)
}

pub async fn audit(pool: &PgPool, tenant: &str, actor: &str, action: &str, target: &str, data: Value) {
    let r = sqlx::query("INSERT INTO audit_log (tenant_id, actor, action, target, data) VALUES ($1,$2,$3,$4,$5)").bind(tenant).bind(actor).bind(action).bind(target).bind(data).execute(pool).await;
    if let Err(e) = r {
        tracing::warn!(error = %e, action, "audit write failed");
    }
}

/// Whether trading is halted for this user: (halted, reason).
pub async fn halted(pool: &PgPool, tenant: &str, user: i64) -> (bool, &'static str) {
    let s = settings(pool, tenant).await;
    if s.get("globalKill").and_then(Value::as_bool) == Some(true) {
        return (true, "platform kill switch is on");
    }
    let k: Option<bool> = sqlx::query_scalar("SELECT killed FROM user_controls WHERE tenant_id = $1 AND user_id = $2").bind(tenant).bind(user).fetch_optional(pool).await.ok().flatten();
    if k == Some(true) {
        return (true, "your kill switch is on");
    }
    (false, "")
}

#[cfg(test)]
mod tests {
    #[test]
    fn decodes_percent() {
        assert_eq!(super::pct_decode("Julia%20Novak"), "Julia Novak");
        assert_eq!(super::pct_decode("100%"), "100%");
    }
}

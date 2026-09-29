//! HTTP clients for the services this one reads: trading engine, wallet, gateway, IB, prop and market-data.
//! Staff routes are called as the system identity `reports-service` (role admin, read-only use).

use std::time::Duration;

use serde_json::Value;

use crate::config::Config;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Target {
    Engine,
    Wallet,
    Gateway,
    Ib,
    Prop,
    MarketData,
}

#[derive(Clone, Copy, Debug)]
pub enum As {
    /// System staff identity (Back Office read routes).
    Staff,
    /// A client (engine `/v1/accounts/*`, IB `/v1/ib/me`).
    User(i64),
    None,
}

pub struct Upstream {
    http: reqwest::Client,
    cfg: Config,
}

#[derive(Debug)]
pub struct UpErr {
    pub status: u16,
    pub message: String,
}

impl std::fmt::Display for UpErr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "upstream {}: {}", self.status, self.message)
    }
}
impl std::error::Error for UpErr {}

impl Upstream {
    pub fn new(cfg: &Config) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(30)).build().expect("http client");
        Self { http, cfg: cfg.clone() }
    }

    fn base(&self, t: Target) -> (&str, &str) {
        match t {
            Target::Engine => (&self.cfg.trading_url, &self.cfg.trading_token),
            Target::Wallet => (&self.cfg.wallet_url, &self.cfg.wallet_token),
            Target::Gateway => (&self.cfg.gateway_url, &self.cfg.gateway_token),
            Target::Ib => (&self.cfg.ib_url, &self.cfg.ib_token),
            Target::Prop => (&self.cfg.prop_url, &self.cfg.prop_token),
            Target::MarketData => (&self.cfg.market_data_url, &self.cfg.market_data_admin_token),
        }
    }

    pub fn configured(&self, t: Target) -> bool {
        match t {
            Target::Engine | Target::Gateway => true,
            _ => !self.base(t).1.is_empty() || self.cfg.dev_mode,
        }
    }

    pub async fn get(&self, t: Target, tenant: &str, who: As, path: &str) -> Result<Value, UpErr> {
        let (base, token) = self.base(t);
        let mut rb = self.http.get(format!("{base}{path}")).header("x-kalks-tenant", tenant);
        if t == Target::MarketData {
            rb = rb.header("authorization", format!("Bearer {token}"));
        } else {
            rb = rb.header("x-kalks-internal", token);
        }
        match who {
            As::Staff => {
                rb = rb.header("x-kalks-staff-id", "reports-service").header("x-kalks-staff-name", "Reports%20service").header("x-kalks-staff-role", "admin");
                if t == Target::Wallet {
                    rb = rb.header("x-kalks-service", "reports");
                }
            }
            As::User(id) => rb = rb.header("x-kalks-user-id", id.to_string()),
            As::None => {}
        }
        let res = rb.send().await.map_err(|e| UpErr { status: 503, message: e.to_string() })?;
        let status = res.status().as_u16();
        let text = res.text().await.unwrap_or_default();
        let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        if !(200..300).contains(&status) {
            let msg = v["error"]["message"].as_str().map(str::to_string).unwrap_or_else(|| text.chars().take(200).collect());
            return Err(UpErr { status, message: msg });
        }
        // wallet responses are wrapped in {"data": ...} for staff routes; unwrap when present
        Ok(v)
    }
}

/// Number from a JSON number or numeric string.
pub fn num(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        Value::String(s) => s.parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

/// Decimal from a JSON number (shortest text) or numeric string.
pub fn dec(v: &Value) -> rust_decimal::Decimal {
    use std::str::FromStr;
    match v {
        Value::Number(n) => rust_decimal::Decimal::from_str(&n.to_string()).or_else(|_| rust_decimal::Decimal::from_scientific(&n.to_string())).unwrap_or_default(),
        Value::String(s) => rust_decimal::Decimal::from_str(s).unwrap_or_default(),
        _ => rust_decimal::Decimal::ZERO,
    }
}

pub fn time(v: &Value) -> Option<chrono::DateTime<chrono::Utc>> {
    v.as_str().and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&chrono::Utc))
}

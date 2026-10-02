//! Client for the trading engine (services/trading, README "Admin account API", "Dealing desk API",
//! "Client Area API"). The prop service acts as a system staff member ("Prop risk engine", role admin) so
//! every change it makes is in the engine's own audit log with a PRP reason code.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use std::time::Duration;

use crate::money::{D, dec_of, num};

pub const STAFF_ID: &str = "prop-service";
pub const STAFF_NAME: &str = "Prop%20risk%20engine";
pub const STAFF_ROLE: &str = "admin";

#[derive(Clone)]
pub struct Engine {
    http: reqwest::Client,
    base: String,
    token: String,
}

#[derive(Debug)]
pub enum EngineError {
    /// The engine refused the request: HTTP status + error code + message.
    Refused(u16, String, String),
    Unavailable(String),
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::Refused(s, c, m) => write!(f, "engine refused ({s} {c}): {m}"),
            EngineError::Unavailable(m) => write!(f, "engine unavailable: {m}"),
        }
    }
}

impl EngineError {
    pub fn code(&self) -> &str {
        match self {
            EngineError::Refused(_, c, _) => c,
            EngineError::Unavailable(_) => "unavailable",
        }
    }
}

impl From<EngineError> for crate::error::ApiError {
    fn from(e: EngineError) -> Self {
        match e {
            EngineError::Refused(_, code, m) => crate::error::ApiError::Upstream { code: format!("engine_{code}"), message: m },
            EngineError::Unavailable(m) => crate::error::ApiError::Upstream { code: "engine_unavailable".into(), message: format!("The trading engine is unavailable: {m}") },
        }
    }
}

pub type EResult<T> = Result<T, EngineError>;

/// Open position as the prop evaluator needs it (DeskPosition subset).
#[derive(Clone, Debug)]
pub struct Pos {
    pub ticket: String,
    pub symbol: String,
    pub side: String,
    pub volume: D,
    pub open_time: DateTime<Utc>,
    pub profit: D,
    /// Kalks FX Options position (volume = contracts). The engine refuses options on prop groups; this is a
    /// defensive flag so contracts can never be counted as lots.
    pub option: bool,
}

/// Closing deal (DeskDeal subset).
#[derive(Clone, Debug)]
pub struct Deal {
    pub id: String,
    pub ticket: String,
    pub symbol: String,
    pub side: String,
    pub volume: D,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
    pub open_price: D,
    pub close_price: D,
    /// Net: price P&L + swap − commission.
    pub profit: D,
    /// Kalks FX Options deal (volume = contracts, never lots). Prop groups cannot trade options (engine gate).
    pub option: bool,
}

/// Engine option series code (`EURUSD-20261009-1.1650-C`): underlying, expiry date, strike, right.
pub fn is_option_series(symbol: &str) -> bool {
    let p: Vec<&str> = symbol.split('-').collect();
    p.len() == 4
        && !p[0].is_empty()
        && p[1].len() == 8
        && p[1].bytes().all(|b| b.is_ascii_digit())
        && !p[2].is_empty()
        && p[2].bytes().all(|b| b.is_ascii_digit() || b == b'.')
        && matches!(p[3], "C" | "P" | "c" | "p")
}

/// Whether an engine position / deal JSON is a Kalks FX Options one (`option` object, `instrument`, or the
/// series code).
pub fn is_option(v: &Value) -> bool {
    v["option"].is_object() || v["instrument"].as_str() == Some("option") || v["symbol"].as_str().is_some_and(is_option_series)
}

#[derive(Clone, Debug)]
pub struct AccountSnap {
    pub login: i64,
    pub user_id: i64,
    pub status: String,
    pub group: String,
    pub balance: D,
    pub equity: D,
    pub version: i64,
    pub positions: Vec<Pos>,
    pub orders: Vec<String>,
}

fn time_of(v: &Value) -> Option<DateTime<Utc>> {
    v.as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&Utc))
}

fn dec(v: &Value) -> D {
    dec_of(v).unwrap_or_default()
}

fn str_of(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

pub fn parse_deal(v: &Value) -> Option<Deal> {
    Some(Deal {
        id: str_of(&v["id"]),
        ticket: str_of(&v["ticket"]),
        symbol: v["symbol"].as_str()?.to_string(),
        side: v["side"].as_str().unwrap_or("buy").to_string(),
        volume: dec(&v["volume"]),
        open_time: time_of(&v["openTime"])?,
        close_time: time_of(&v["closeTime"])?,
        open_price: dec(&v["openPrice"]),
        close_price: dec(&v["closePrice"]),
        profit: dec(&v["profit"]),
        option: is_option(v),
    })
}

fn parse_pos(v: &Value) -> Option<Pos> {
    Some(Pos {
        ticket: str_of(&v["ticket"]),
        symbol: v["symbol"].as_str()?.to_string(),
        side: v["side"].as_str().unwrap_or("buy").to_string(),
        volume: dec(&v["volume"]),
        open_time: time_of(&v["openTime"])?,
        profit: dec(&v["profit"]),
        option: is_option(v),
    })
}

impl Engine {
    pub fn new(base: &str, token: &str) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().expect("http client");
        Engine { http, base: base.trim_end_matches('/').to_string(), token: token.to_string() }
    }

    async fn call(&self, method: reqwest::Method, path: &str, tenant: &str, user: Option<i64>, body: Option<Value>) -> EResult<Value> {
        let mut rq = self
            .http
            .request(method, format!("{}{}", self.base, path))
            .header("x-kalks-internal", &self.token)
            .header("x-kalks-tenant", tenant)
            .header("x-kalks-staff-id", STAFF_ID)
            .header("x-kalks-staff-name", STAFF_NAME)
            .header("x-kalks-staff-role", STAFF_ROLE)
            .header("user-agent", "kalks-prop/1");
        if let Some(u) = user {
            rq = rq.header("x-kalks-user-id", u.to_string());
        }
        if let Some(b) = body {
            rq = rq.json(&b);
        }
        let res = rq.send().await.map_err(|e| EngineError::Unavailable(e.to_string()))?;
        let status = res.status().as_u16();
        let v: Value = res.json().await.unwrap_or(Value::Null);
        if (200..300).contains(&status) {
            Ok(v)
        } else {
            let code = v["error"]["code"].as_str().unwrap_or("error").to_string();
            let msg = v["error"]["message"].as_str().unwrap_or("request failed").to_string();
            Err(EngineError::Refused(status, code, msg))
        }
    }

    /// Opens a live account for the trader in the plan's group (engine generates the passwords and returns
    /// them once).
    pub async fn open_account(&self, tenant: &str, user_id: i64, group: &str, leverage: u32, name: &str) -> EResult<(i64, Value)> {
        let v = self
            .call(reqwest::Method::POST, "/v1/accounts", tenant, Some(user_id), Some(json!({"userId": user_id, "type": "live", "group": group, "leverage": leverage, "name": name})))
            .await?;
        let login = v["account"]["login"].as_i64().ok_or_else(|| EngineError::Unavailable("no login in response".into()))?;
        Ok((login, v["credentials"].clone()))
    }

    /// Signed balance adjustment (simulated capital, payouts). Idempotent on `key`.
    pub async fn adjust(&self, tenant: &str, login: i64, amount: D, key: &str, reason: &str, note: &str) -> EResult<Value> {
        let r = self
            .call(
                reqwest::Method::POST,
                &format!("/v1/admin/accounts/{login}/balance"),
                tenant,
                None,
                Some(json!({"type": "adjustment", "amount": num(amount), "idempotencyKey": key, "reasonCode": reason, "note": note})),
            )
            .await;
        match r {
            // the same key was booked before (retry after a timeout): treat as done
            Err(EngineError::Refused(409, c, _)) if c == "duplicate_idempotency_key" => Ok(json!({"replayed": true})),
            r => r,
        }
    }

    pub async fn account(&self, tenant: &str, login: i64) -> EResult<AccountSnap> {
        let v = self.call(reqwest::Method::GET, &format!("/v1/admin/accounts/{login}"), tenant, None, None).await?;
        let a = &v["account"];
        Ok(AccountSnap {
            login,
            user_id: a["userId"].as_i64().unwrap_or(0),
            status: a["status"].as_str().unwrap_or("active").to_string(),
            group: a["group"].as_str().unwrap_or("").to_string(),
            balance: dec(&a["balance"]),
            equity: dec(&a["equity"]),
            version: a["version"].as_i64().unwrap_or(0),
            positions: v["positions"].as_array().map(|x| x.iter().filter_map(parse_pos).collect()).unwrap_or_default(),
            orders: v["orders"].as_array().map(|x| x.iter().map(|o| str_of(&o["ticket"])).collect()).unwrap_or_default(),
        })
    }

    /// Closing deals of an account since `from` (newest first from the engine; returned oldest first).
    pub async fn deals(&self, tenant: &str, login: i64, from: DateTime<Utc>) -> EResult<Vec<Deal>> {
        let from = from.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        let v = self.call(reqwest::Method::GET, &format!("/v1/dealing/deals?login={login}&from={}&limit=2000", urlenc(&from)), tenant, None, None).await?;
        let mut out: Vec<Deal> = v.as_array().map(|x| x.iter().filter(|d| !d["reversed"].as_bool().unwrap_or(false)).filter_map(parse_deal).collect()).unwrap_or_default();
        out.reverse();
        Ok(out)
    }

    pub async fn set_status(&self, tenant: &str, login: i64, status: &str, reason: &str, note: &str) -> EResult<()> {
        match self
            .call(reqwest::Method::POST, &format!("/v1/admin/accounts/{login}/status"), tenant, None, Some(json!({"status": status, "reasonCode": reason, "note": note})))
            .await
        {
            Ok(_) => Ok(()),
            Err(EngineError::Refused(_, c, _)) if c == "no_change" => Ok(()),
            Err(e) => Err(e),
        }
    }

    /// Closes every open position (forced dealer close) and cancels every pending order. Returns the number
    /// of positions still open afterwards (e.g. market closed).
    pub async fn close_all(&self, tenant: &str, login: i64, reason: &str, note: &str) -> EResult<usize> {
        let a = self.account(tenant, login).await?;
        if !a.orders.is_empty() {
            let _ = self
                .call(reqwest::Method::POST, "/v1/dealing/orders/cancel", tenant, None, Some(json!({"tickets": a.orders, "reasonCode": reason, "note": note})))
                .await;
        }
        if a.positions.is_empty() {
            return Ok(0);
        }
        let tickets: Vec<String> = a.positions.iter().map(|p| p.ticket.clone()).collect();
        let r = self
            .call(reqwest::Method::POST, "/v1/dealing/positions/bulk", tenant, None, Some(json!({"tickets": tickets, "op": "close", "force": true, "reasonCode": reason, "note": note})))
            .await?;
        let failed = r["data"]["failed"].as_array().map(|f| f.len()).or_else(|| r["failed"].as_array().map(|f| f.len())).unwrap_or(0);
        Ok(failed)
    }

    /// Closes one position (news-window violation).
    pub async fn close_position(&self, tenant: &str, ticket: &str, reason: &str, note: &str) -> EResult<()> {
        self.call(reqwest::Method::POST, &format!("/v1/dealing/positions/{ticket}/close"), tenant, None, Some(json!({"force": true, "reasonCode": reason, "note": note})))
            .await
            .map(|_| ())
    }

    /// Engine groups (admin view), for plan validation.
    pub async fn groups(&self, tenant: &str) -> EResult<Vec<Value>> {
        let v = self.call(reqwest::Method::GET, "/v1/admin/groups", tenant, None, None).await?;
        Ok(v["groups"].as_array().cloned().unwrap_or_default())
    }

    pub async fn health(&self) -> bool {
        self.http.get(format!("{}/health", self.base)).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

fn urlenc(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn option_deals_and_positions_are_flagged() {
        let deal = json!({"id": "2000001", "ticket": "1000001", "symbol": "EURUSD", "side": "buy", "volume": 1, "openTime": "2026-10-01T10:00:00Z",
                          "closeTime": "2026-10-01T11:00:00Z", "openPrice": 1.16, "closePrice": 1.17, "profit": 10, "option": null, "instrument": "cfd"});
        assert!(!parse_deal(&deal).unwrap().option);
        let mut o = deal.clone();
        o["symbol"] = json!("EURUSD-20261009-1.1650-C");
        o["option"] = json!({"series": "EURUSD-20261009-1.1650-C"});
        assert!(parse_deal(&o).unwrap().option);
        let mut o = deal.clone();
        o["instrument"] = json!("option");
        assert!(parse_deal(&o).unwrap().option);
        let pos = json!({"ticket": "1000002", "symbol": "USDJPY-20261009-150.00-P", "side": "sell", "volume": 3, "openTime": "2026-10-01T10:00:00Z", "profit": -4});
        assert!(parse_pos(&pos).unwrap().option);
        assert!(!is_option_series("BTC-USD") && !is_option_series("EURUSD"));
    }
}

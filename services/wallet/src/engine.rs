//! Trading engine client (services/trading): account ownership and the idempotent ledger transfer API
//! (`POST /v1/ledger/transfers`, `GET /v1/ledger/transfers/{key}`).

use async_trait::async_trait;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use crate::money::D;

#[derive(Clone, Debug)]
pub struct EngineAccount {
    pub login: i64,
    pub kind: String,
    pub status: String,
    pub currency: String,
    pub cent: bool,
    /// Engine group code (e.g. "standard", "prop").
    pub group: String,
}

#[derive(Debug, Clone)]
pub enum EngineError {
    /// A definite answer: the engine refused (4xx). Nothing was booked.
    Rejected { status: u16, code: String, message: String },
    /// No definite answer (network, timeout, 5xx): the transfer may or may not have happened.
    Unavailable(String),
}

#[derive(Clone, Debug)]
pub struct EngineTransfer {
    pub txn: Option<i64>,
    pub amount: Option<D>,
    pub currency: Option<String>,
}

#[async_trait]
pub trait Engine: Send + Sync {
    async fn accounts(&self, tenant: &str, user_id: i64) -> Result<Vec<EngineAccount>, EngineError>;
    /// `direction`: "in" (wallet → account) or "out" (account → wallet). `key` is sent as idempotencyKey.
    async fn transfer(&self, tenant: &str, key: &str, login: i64, amount: D, direction: &str, reference: &str) -> Result<EngineTransfer, EngineError>;
    /// The stored result for `key`, None when the engine has no transfer with this key.
    async fn transfer_status(&self, tenant: &str, key: &str) -> Result<Option<EngineTransfer>, EngineError>;
}

pub struct HttpEngine {
    http: reqwest::Client,
    base: String,
    token: String,
}

impl HttpEngine {
    pub fn new(base: String, token: String) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(15)).build().expect("http client");
        Self { http, base, token }
    }

    async fn send(&self, rb: reqwest::RequestBuilder, tenant: &str) -> Result<(u16, Value), EngineError> {
        let r = rb.header("x-kalks-internal", &self.token).header("x-kalks-tenant", tenant).header("user-agent", "kalks-wallet").send().await.map_err(|e| EngineError::Unavailable(e.without_url().to_string()))?;
        let status = r.status().as_u16();
        let v: Value = r.json().await.unwrap_or(Value::Null);
        Ok((status, v))
    }
}

fn parse_transfer(v: &Value) -> EngineTransfer {
    EngineTransfer {
        txn: v.get("txn").and_then(Value::as_i64),
        amount: v.get("amount").and_then(|a| crate::money::parse(&a.to_string().trim_matches('"').to_string())),
        currency: v.get("currency").and_then(Value::as_str).map(str::to_string),
    }
}

fn rejected(status: u16, v: &Value) -> EngineError {
    EngineError::Rejected {
        status,
        code: v.pointer("/error/code").and_then(Value::as_str).unwrap_or("engine_error").to_string(),
        message: v.pointer("/error/message").and_then(Value::as_str).unwrap_or("The trading engine refused the transfer").to_string(),
    }
}

#[async_trait]
impl Engine for HttpEngine {
    async fn accounts(&self, tenant: &str, user_id: i64) -> Result<Vec<EngineAccount>, EngineError> {
        let (status, v) = self.send(self.http.get(format!("{}/v1/accounts?user_id={user_id}", self.base)).header("x-kalks-user-id", user_id.to_string()), tenant).await?;
        if status != 200 {
            return Err(if status >= 500 { EngineError::Unavailable(format!("http {status}")) } else { rejected(status, &v) });
        }
        Ok(v.get("accounts")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(|x| {
                        Some(EngineAccount {
                            login: x.get("login")?.as_i64()?,
                            kind: x.get("type")?.as_str()?.to_string(),
                            status: x.get("status").and_then(Value::as_str).unwrap_or("active").to_string(),
                            currency: x.get("currency").and_then(Value::as_str).unwrap_or("USD").to_string(),
                            cent: x.get("cent").and_then(Value::as_bool).unwrap_or(false),
                            group: x.get("group").and_then(Value::as_str).unwrap_or("").to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    async fn transfer(&self, tenant: &str, key: &str, login: i64, amount: D, direction: &str, reference: &str) -> Result<EngineTransfer, EngineError> {
        let body = json!({"idempotencyKey": key, "login": login, "amount": crate::money::s(amount), "direction": direction, "ref": reference});
        let (status, v) = self.send(self.http.post(format!("{}/v1/ledger/transfers", self.base)).json(&body), tenant).await?;
        match status {
            200 => Ok(parse_transfer(&v)),
            s if s >= 500 || s == 429 => Err(EngineError::Unavailable(format!("http {s}"))),
            s => Err(rejected(s, &v)),
        }
    }

    async fn transfer_status(&self, tenant: &str, key: &str) -> Result<Option<EngineTransfer>, EngineError> {
        let (status, v) = self.send(self.http.get(format!("{}/v1/ledger/transfers/{key}", self.base)), tenant).await?;
        match status {
            200 => Ok(Some(parse_transfer(&v))),
            404 => Ok(None),
            s => Err(EngineError::Unavailable(format!("http {s}"))),
        }
    }
}

/* ------------------------------------------------------------------ */
/* Test double                                                         */
/* ------------------------------------------------------------------ */

/// Scriptable engine for tests. `mode` decides what `transfer` does:
/// "ok" books it, "reject" returns 422, "timeout_after" books it but answers Unavailable, "timeout_before"
/// answers Unavailable without booking.
#[derive(Default)]
pub struct MockEngine {
    pub accounts: Mutex<HashMap<i64, Vec<EngineAccount>>>,
    pub booked: Mutex<HashMap<String, (i64, D, String)>>,
    pub mode: Mutex<String>,
    pub calls: std::sync::atomic::AtomicU32,
}

impl MockEngine {
    pub fn with_account(self, user_id: i64, login: i64, kind: &str) -> Self {
        self.accounts.lock().unwrap().entry(user_id).or_default().push(EngineAccount { login, kind: kind.into(), status: "active".into(), currency: "USD".into(), cent: false, group: "standard".into() });
        self
    }
    pub fn set_mode(&self, m: &str) {
        *self.mode.lock().unwrap() = m.to_string();
    }
}

#[async_trait]
impl Engine for MockEngine {
    async fn accounts(&self, _tenant: &str, user_id: i64) -> Result<Vec<EngineAccount>, EngineError> {
        Ok(self.accounts.lock().unwrap().get(&user_id).cloned().unwrap_or_default())
    }
    async fn transfer(&self, _tenant: &str, key: &str, login: i64, amount: D, direction: &str, _reference: &str) -> Result<EngineTransfer, EngineError> {
        self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let mode = self.mode.lock().unwrap().clone();
        if let Some((l, a, d)) = self.booked.lock().unwrap().get(key).cloned() {
            if l != login || a != amount || d != direction {
                return Err(EngineError::Rejected { status: 409, code: "idempotency_conflict".into(), message: "conflict".into() });
            }
            return Ok(EngineTransfer { txn: Some(1), amount: Some(a), currency: Some("USD".into()) });
        }
        match mode.as_str() {
            "reject" => Err(EngineError::Rejected { status: 422, code: "insufficient_funds".into(), message: "Not enough free margin".into() }),
            "timeout_before" => Err(EngineError::Unavailable("timeout".into())),
            m => {
                self.booked.lock().unwrap().insert(key.to_string(), (login, amount, direction.to_string()));
                if m == "timeout_after" { Err(EngineError::Unavailable("timeout".into())) } else { Ok(EngineTransfer { txn: Some(1), amount: Some(amount), currency: Some("USD".into()) }) }
            }
        }
    }
    async fn transfer_status(&self, _tenant: &str, key: &str) -> Result<Option<EngineTransfer>, EngineError> {
        Ok(self.booked.lock().unwrap().get(key).map(|(_, a, _)| EngineTransfer { txn: Some(1), amount: Some(*a), currency: Some("USD".into()) }))
    }
}

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

/// Staff identity forwarded to the engine's Back Office routes (the engine checks the role / permissions again
/// and records the staff member in its audit).
#[derive(Clone, Debug, Default)]
pub struct StaffHeaders {
    pub id: String,
    pub name: String,
    pub role: String,
    pub perms: Option<Vec<String>>,
}

#[async_trait]
pub trait Engine: Send + Sync {
    async fn accounts(&self, tenant: &str, user_id: i64) -> Result<Vec<EngineAccount>, EngineError>;
    /// Full account views (balance, credit, equity, free margin, withdrawable…) of a user's accounts.
    async fn account_views(&self, _tenant: &str, _user_id: i64) -> Result<Vec<Value>, EngineError> {
        Err(EngineError::Unavailable("not supported".into()))
    }
    /// `POST /v1/admin/accounts/{login}/adjust` (manual balance / credit adjustment, or its dry run). Returns `data`.
    async fn adjust(&self, _tenant: &str, _login: i64, _body: Value, _staff: &StaffHeaders) -> Result<Value, EngineError> {
        Err(EngineError::Unavailable("not supported".into()))
    }
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
        let r = rb.header("x-ezymex-internal", &self.token).header("x-ezymex-tenant", tenant).header("user-agent", "ezymex-wallet").send().await.map_err(|e| EngineError::Unavailable(e.without_url().to_string()))?;
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
        let (status, v) = self.send(self.http.get(format!("{}/v1/accounts?user_id={user_id}", self.base)).header("x-ezymex-user-id", user_id.to_string()), tenant).await?;
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

    async fn account_views(&self, tenant: &str, user_id: i64) -> Result<Vec<Value>, EngineError> {
        let (status, v) = self.send(self.http.get(format!("{}/v1/accounts?user_id={user_id}", self.base)).header("x-ezymex-user-id", user_id.to_string()), tenant).await?;
        if status != 200 {
            return Err(if status >= 500 { EngineError::Unavailable(format!("http {status}")) } else { rejected(status, &v) });
        }
        Ok(v.get("accounts").and_then(Value::as_array).cloned().unwrap_or_default())
    }

    async fn adjust(&self, tenant: &str, login: i64, body: Value, staff: &StaffHeaders) -> Result<Value, EngineError> {
        let enc = |s: &str| s.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect::<String>();
        let mut rb = self
            .http
            .post(format!("{}/v1/admin/accounts/{login}/adjust", self.base))
            .header("x-ezymex-staff-id", &staff.id)
            .header("x-ezymex-staff-name", enc(&staff.name))
            .header("x-ezymex-staff-role", &staff.role)
            .json(&body);
        if let Some(p) = &staff.perms {
            rb = rb.header("x-ezymex-staff-perms", p.join(","));
        }
        let (status, v) = self.send(rb, tenant).await?;
        match status {
            200 => Ok(v.get("data").cloned().unwrap_or(Value::Null)),
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
    /// login → (balance, credit, margin) for manual adjustments.
    pub books: Mutex<HashMap<i64, (D, D, D)>>,
    /// adjustment key → (fingerprint, txn).
    pub adjusted: Mutex<HashMap<String, (Value, i64)>>,
    pub adjust_calls: std::sync::atomic::AtomicU32,
    /// Staff identities the adjust route saw (id, perms).
    pub adjust_staff: Mutex<Vec<(String, Option<Vec<String>>)>>,
}

impl MockEngine {
    pub fn with_account(self, user_id: i64, login: i64, kind: &str) -> Self {
        self.accounts.lock().unwrap().entry(user_id).or_default().push(EngineAccount { login, kind: kind.into(), status: "active".into(), currency: "USD".into(), cent: false, group: "standard".into() });
        self
    }
    pub fn set_mode(&self, m: &str) {
        *self.mode.lock().unwrap() = m.to_string();
    }
    /// Sets balance / credit / used margin of a mock account.
    pub fn set_book(&self, login: i64, balance: &str, credit: &str, margin: &str) {
        let p = |x: &str| crate::money::parse(x).unwrap();
        self.books.lock().unwrap().insert(login, (p(balance), p(credit), p(margin)));
    }
    pub fn book(&self, login: i64) -> (D, D, D) {
        self.books.lock().unwrap().get(&login).copied().unwrap_or_default()
    }
    fn view(&self, a: &EngineAccount) -> Value {
        let (b, c, m) = self.book(a.login);
        let free = b + c - m;
        let wd = b.min(free - c).max(D::ZERO);
        json!({"login": a.login, "type": a.kind, "status": a.status, "currency": a.currency, "cent": a.cent, "group": a.group, "groupName": a.group,
               "balance": crate::money::s(b), "credit": crate::money::s(c), "equity": crate::money::s(b + c), "margin": crate::money::s(m),
               "freeMargin": crate::money::s(free), "withdrawable": crate::money::s(wd)})
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
    async fn account_views(&self, _tenant: &str, user_id: i64) -> Result<Vec<Value>, EngineError> {
        let accs = self.accounts.lock().unwrap().get(&user_id).cloned().unwrap_or_default();
        Ok(accs.iter().map(|a| self.view(a)).collect())
    }
    /// The engine's rules in miniature: deduct ≤ withdrawable (force: ≤ balance), take credit ≤ credit and
    /// (unless force) ≤ free margin; idempotent on the key; "timeout_after" books then answers Unavailable.
    async fn adjust(&self, _tenant: &str, login: i64, body: Value, staff: &StaffHeaders) -> Result<Value, EngineError> {
        self.adjust_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        self.adjust_staff.lock().unwrap().push((staff.id.clone(), staff.perms.clone()));
        let rej = |code: &str, msg: &str| EngineError::Rejected { status: 422, code: code.into(), message: msg.into() };
        let amount = body["amount"].as_str().and_then(crate::money::parse).or_else(|| body["amount"].as_f64().and_then(|f| crate::money::parse(&f.to_string()))).unwrap_or_default();
        let (op, force, dry) = (body["op"].as_str().unwrap_or(""), body["force"].as_bool().unwrap_or(false), body["dryRun"].as_bool().unwrap_or(false));
        let key = body["idempotencyKey"].as_str().unwrap_or("").to_string();
        let fp = json!({"login": login, "op": op, "category": body["category"], "amount": crate::money::s(amount), "force": force});
        if !dry && let Some((f, txn)) = self.adjusted.lock().unwrap().get(&key).cloned() {
            if f != fp {
                return Err(EngineError::Rejected { status: 409, code: "idempotency_conflict".into(), message: "conflict".into() });
            }
            return Ok(json!({"txn": txn, "replayed": true, "login": login}));
        }
        if self.mode.lock().unwrap().as_str() == "timeout_before" && !dry {
            return Err(EngineError::Unavailable("timeout".into()));
        }
        let (b, c, m) = self.book(login);
        let snap = |b: D, c: D| {
            let free = b + c - m;
            json!({"balance": crate::money::s(b), "credit": crate::money::s(c), "equity": crate::money::s(b + c), "freeMargin": crate::money::s(free), "withdrawable": crate::money::s(b.min(free - c).max(D::ZERO)), "margin": crate::money::s(m)})
        };
        let wd = b.min(b - m).max(D::ZERO);
        let free = (b + c - m).max(D::ZERO);
        let res = match op {
            "add" => Ok((b + amount, c)),
            "deduct" if amount > wd && !force => Err(rej("insufficient_funds", &format!("Deducting {amount} exceeds the free funds: {wd} can be deducted"))),
            "deduct" if amount > b => Err(rej("negative_balance", "Negative balance protection")),
            "deduct" => Ok((b - amount, c)),
            "credit_in" => Ok((b, c + amount)),
            "credit_out" if amount > c => Err(rej("insufficient_credit", "more than the credit held")),
            "credit_out" if amount > free.min(c) && !force => Err(rej("insufficient_funds", "exceeds the free margin")),
            "credit_out" => Ok((b, c - amount)),
            _ => Err(rej("validation", "bad op")),
        };
        if dry {
            return Ok(match res {
                Ok((nb, nc)) => json!({"ok": true, "before": snap(b, c), "after": snap(nb, nc), "login": login}),
                Err(EngineError::Rejected { code, message, .. }) => json!({"ok": false, "before": snap(b, c), "error": {"code": code, "message": message}, "login": login}),
                Err(e) => return Err(e),
            });
        }
        let (nb, nc) = res?;
        self.books.lock().unwrap().insert(login, (nb, nc, m));
        let txn = 7000 + self.adjusted.lock().unwrap().len() as i64;
        self.adjusted.lock().unwrap().insert(key, (fp, txn));
        let kind = match (op, body["category"].as_str()) {
            ("add", Some("deposit")) => "deposit",
            ("deduct", Some("withdrawal")) => "withdrawal",
            ("credit_in" | "credit_out", _) => "credit",
            _ => "adjustment",
        };
        if self.mode.lock().unwrap().as_str() == "timeout_after" {
            return Err(EngineError::Unavailable("timeout".into()));
        }
        Ok(json!({"txn": txn, "kind": kind, "before": snap(b, c), "after": snap(nb, nc), "login": login, "replayed": false}))
    }
}

//! HTTP clients for the services ALGO depends on: market-data (candles, quotes), the trading engine
//! (documented APIs only: Client Area routes with X-Ezymex-User-Id, and terminal sessions obtained through
//! the one-time SSO flow, so every order goes through the same checks as a manual one) and the wallet.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};

use crate::error::ApiError;
use crate::indicators::Bar;

pub fn http() -> Client {
    Client::builder().timeout(Duration::from_secs(20)).connect_timeout(Duration::from_secs(5)).build().expect("http client")
}

/* ------------------------------------------------------------------ */
/* market-data                                                         */
/* ------------------------------------------------------------------ */

#[derive(Clone)]
pub struct MarketData {
    pub base: String,
    pub http: Client,
}

#[derive(Clone, Copy, Debug)]
pub struct Quote {
    pub bid: f64,
    pub ask: f64,
    pub t: i64,
}

impl MarketData {
    /// Up to `limit` (≤ 5000) bars ending at `to` (unix seconds, exclusive of later bars), ascending.
    pub async fn candles(&self, symbol: &str, tf: &str, limit: usize, to: Option<i64>) -> anyhow::Result<Vec<Bar>> {
        let mut url = format!("{}/v1/candles?symbol={symbol}&tf={tf}&limit={}", self.base, limit.clamp(1, 5000));
        if let Some(t) = to {
            url.push_str(&format!("&to={t}"));
        }
        let r = self.http.get(&url).send().await?;
        if !r.status().is_success() {
            anyhow::bail!("market-data candles {symbol} {tf}: HTTP {}", r.status());
        }
        let v: Value = r.json().await?;
        Ok(serde_json::from_value(v.get("bars").cloned().unwrap_or(Value::Array(vec![]))).unwrap_or_default())
    }

    /// Bars with open time in [from, to], paging backwards (at most `max` bars, the most recent kept).
    pub async fn range(&self, symbol: &str, tf: &str, from: i64, to: i64, max: usize) -> anyhow::Result<Vec<Bar>> {
        let mut out: Vec<Bar> = vec![];
        let mut cursor = to + 1;
        loop {
            let page = self.candles(symbol, tf, 5000, Some(cursor)).await?;
            let page: Vec<Bar> = page.into_iter().filter(|b| b.t < cursor).collect();
            if page.is_empty() {
                break;
            }
            let oldest = page[0].t;
            let mut chunk: Vec<Bar> = page.into_iter().filter(|b| b.t >= from && b.t <= to).collect();
            chunk.extend(out);
            out = chunk;
            if oldest <= from || out.len() >= max {
                break;
            }
            cursor = oldest;
        }
        if out.len() > max {
            out.drain(..out.len() - max);
        }
        out.dedup_by_key(|b| b.t);
        Ok(out)
    }

    pub async fn quotes(&self, symbols: &[String], group: &str) -> anyhow::Result<HashMap<String, Quote>> {
        let url = format!("{}/v1/quotes?symbols={}&group={group}", self.base, symbols.join(","));
        let v: Value = self.http.get(&url).send().await?.json().await?;
        let mut out = HashMap::new();
        if let Some(o) = v.as_object() {
            for (k, q) in o {
                if let (Some(b), Some(a)) = (q.get("bid").and_then(Value::as_f64), q.get("ask").and_then(Value::as_f64)) {
                    out.insert(k.clone(), Quote { bid: b, ask: a, t: q.get("t").and_then(Value::as_i64).unwrap_or(0) });
                }
            }
        }
        Ok(out)
    }

    /// First stored bar per (symbol, tf) (`/v1/history/status`).
    pub async fn history_status(&self) -> anyhow::Result<HashMap<(String, String), (i64, i64)>> {
        let v: Value = self.http.get(format!("{}/v1/history/status", self.base)).send().await?.json().await?;
        let mut out = HashMap::new();
        for r in v.as_array().cloned().unwrap_or_default() {
            let t = |k: &str| r.get(k).and_then(Value::as_str).and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok()).map(|d| d.timestamp());
            if let (Some(s), Some(tf), Some(a), Some(b)) = (r.get("symbol").and_then(Value::as_str), r.get("tf").and_then(Value::as_str), t("from"), t("to")) {
                out.insert((s.to_string(), tf.to_string()), (a, b));
            }
        }
        Ok(out)
    }
}

/* ------------------------------------------------------------------ */
/* trading engine                                                      */
/* ------------------------------------------------------------------ */

pub struct Engine {
    pub base: String,
    pub token: String,
    pub http: Client,
    sessions: Mutex<HashMap<(String, i64), (String, Instant)>>,
}

#[derive(Debug)]
pub struct EngineReply {
    pub status: StatusCode,
    pub body: Value,
}

impl EngineReply {
    pub fn ok(&self) -> bool {
        self.status.is_success()
    }
    pub fn code(&self) -> String {
        self.body.pointer("/error/code").and_then(Value::as_str).unwrap_or("error").to_string()
    }
    pub fn message(&self) -> String {
        self.body.pointer("/error/message").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| format!("engine HTTP {}", self.status))
    }
    /// Forwards an engine error to our caller with the same status and code.
    pub fn into_error(self) -> ApiError {
        let code: &'static str = match self.code().as_str() {
            "market_closed" => "market_closed",
            "no_money" => "no_money",
            "invalid_volume" => "invalid_volume",
            "invalid_sl" => "invalid_sl",
            "invalid_tp" => "invalid_tp",
            "invalid_price" => "invalid_price",
            "max_lot" => "max_lot",
            "close_only" => "close_only",
            "trading_disabled" => "trading_disabled",
            "account_status" => "account_status",
            "symbol_halted" => "symbol_halted",
            "no_price" => "no_price",
            "stale_price" => "stale_price",
            "requote" => "requote",
            "not_found" => "not_found",
            "validation" => "validation",
            "read_only" => "read_only",
            _ => "engine_error",
        };
        let st = if self.status.is_client_error() { self.status } else { StatusCode::BAD_GATEWAY };
        ApiError::coded(st, code, self.message())
    }
}

impl Engine {
    pub fn new(base: String, token: String, http: Client) -> Self {
        Self { base, token, http, sessions: Mutex::new(HashMap::new()) }
    }

    async fn send(&self, method: Method, path: &str, tenant: &str, user: Option<i64>, bearer: Option<&str>, body: Option<&Value>) -> anyhow::Result<EngineReply> {
        let mut rb = self.http.request(method, format!("{}{path}", self.base)).header("x-ezymex-internal", &self.token).header("x-ezymex-tenant", tenant).header("x-forwarded-for", "127.0.0.1").header("user-agent", "ezymex-algo");
        if let Some(u) = user {
            rb = rb.header("x-ezymex-user-id", u.to_string());
        }
        if let Some(b) = bearer {
            rb = rb.bearer_auth(b);
        }
        if let Some(b) = body {
            rb = rb.json(b);
        }
        let r = rb.send().await?;
        let status = r.status();
        let text = r.text().await.unwrap_or_default();
        let body = serde_json::from_str(&text).unwrap_or_else(|_| json!({"error": {"code": "engine_error", "message": text.chars().take(200).collect::<String>()}}));
        Ok(EngineReply { status, body })
    }

    /// Back Office route on behalf of a staff member (house accounts): the engine checks the role again and
    /// writes its own audit entries.
    pub async fn staff_call(&self, method: Method, path: &str, staff: &crate::state::Staff, body: Option<&Value>) -> anyhow::Result<EngineReply> {
        let mut rb = self
            .http
            .request(method, format!("{}{path}", self.base))
            .header("x-ezymex-internal", &self.token)
            .header("x-ezymex-tenant", &staff.tenant)
            .header("x-ezymex-staff-id", staff.id.to_string())
            .header("x-ezymex-staff-name", staff.name.bytes().map(|b| if b.is_ascii_alphanumeric() { (b as char).to_string() } else { format!("%{b:02X}") }).collect::<String>())
            .header("x-ezymex-staff-role", &staff.role)
            .header("x-forwarded-for", "127.0.0.1")
            .header("user-agent", "ezymex-algo");
        if let Some(b) = body {
            rb = rb.json(b);
        }
        let r = rb.send().await?;
        let status = r.status();
        let text = r.text().await.unwrap_or_default();
        let body = serde_json::from_str(&text).unwrap_or_else(|_| json!({"error": {"code": "engine_error", "message": text.chars().take(200).collect::<String>()}}));
        Ok(EngineReply { status, body })
    }

    /// Client Area route on behalf of `user` (the engine returns 404 for accounts the user doesn't own).
    pub async fn user_call(&self, method: Method, path: &str, tenant: &str, user: i64, body: Option<&Value>) -> anyhow::Result<EngineReply> {
        self.send(method, path, tenant, Some(user), None, body).await
    }

    pub async fn accounts(&self, tenant: &str, user: i64) -> anyhow::Result<Vec<Value>> {
        let r = self.user_call(Method::GET, "/v1/accounts", tenant, user, None).await?;
        if !r.ok() {
            anyhow::bail!("engine accounts: {}", r.message());
        }
        Ok(r.body.get("accounts").and_then(Value::as_array).cloned().unwrap_or_default())
    }

    /// The user's account (view) or `None` when it doesn't exist / isn't theirs.
    pub async fn account(&self, tenant: &str, user: i64, login: i64) -> anyhow::Result<Option<Value>> {
        let r = self.user_call(Method::GET, &format!("/v1/accounts/{login}"), tenant, user, None).await?;
        if r.status == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !r.ok() {
            anyhow::bail!("engine account {login}: {}", r.message());
        }
        Ok(Some(r.body))
    }

    pub async fn groups(&self, tenant: &str) -> anyhow::Result<Vec<Value>> {
        let r = self.send(Method::GET, "/v1/groups", tenant, None, None, None).await?;
        Ok(r.body.get("groups").and_then(Value::as_array).cloned().unwrap_or_default())
    }

    /// A terminal session for (tenant, login) through the one-time SSO flow; cached for 11 hours.
    async fn session(&self, tenant: &str, user: i64, login: i64, fresh: bool) -> anyhow::Result<Result<String, EngineReply>> {
        let key = (tenant.to_string(), login);
        if !fresh
            && let Some((t, at)) = self.sessions.lock().unwrap().get(&key)
            && at.elapsed() < Duration::from_secs(11 * 3600)
        {
            return Ok(Ok(t.clone()));
        }
        let r = self.user_call(Method::POST, &format!("/v1/accounts/{login}/sso"), tenant, user, Some(&json!({}))).await?;
        let Some(one_time) = r.body.get("token").and_then(Value::as_str).map(str::to_string) else { return Ok(Err(r)) };
        let s = self.send(Method::POST, "/v1/terminal/sso", tenant, None, None, Some(&json!({"token": one_time}))).await?;
        let Some(tok) = s.body.get("token").and_then(Value::as_str).map(str::to_string) else { return Ok(Err(s)) };
        self.sessions.lock().unwrap().insert(key, (tok.clone(), Instant::now()));
        Ok(Ok(tok))
    }

    /// Terminal API call on `login` (orders, closes, state) with a cached session; re-authenticates once on 401.
    pub async fn terminal(&self, tenant: &str, user: i64, login: i64, method: Method, path: &str, body: Option<&Value>) -> anyhow::Result<EngineReply> {
        for fresh in [false, true] {
            let tok = match self.session(tenant, user, login, fresh).await? {
                Ok(t) => t,
                Err(r) => return Ok(r),
            };
            let r = self.send(method.clone(), path, tenant, None, Some(&tok), body).await?;
            if r.status == StatusCode::UNAUTHORIZED && !fresh {
                self.sessions.lock().unwrap().remove(&(tenant.to_string(), login));
                continue;
            }
            return Ok(r);
        }
        unreachable!()
    }

    pub fn forget(&self, tenant: &str, login: i64) {
        self.sessions.lock().unwrap().remove(&(tenant.to_string(), login));
    }
}

/* ------------------------------------------------------------------ */
/* wallet                                                              */
/* ------------------------------------------------------------------ */

#[derive(Clone)]
pub struct Wallet {
    pub base: String,
    pub token: String,
    pub http: Client,
}

impl Wallet {
    pub fn configured(&self) -> bool {
        !self.base.is_empty()
    }

    /// `POST /v1/wallets/transfers` (services/wallet/README.md). Ok(body) on 200, Err((status, code, message)).
    pub async fn transfer(&self, tenant: &str, key: &str, user: i64, amount: &str, direction: &str, kind: &str, reference: &str, note: &str) -> anyhow::Result<Result<Value, (u16, String, String)>> {
        let body = json!({"idempotency_key": key, "user_id": user, "currency": "USDT", "amount": amount, "direction": direction, "kind": kind, "ref": reference, "note": note});
        let r = self
            .http
            .post(format!("{}/v1/wallets/transfers", self.base))
            .header("x-ezymex-internal", &self.token)
            .header("x-ezymex-tenant", tenant)
            .header("x-ezymex-service", "algo")
            .json(&body)
            .send()
            .await?;
        let status = r.status();
        let v: Value = r.json().await.unwrap_or(Value::Null);
        if status.is_success() {
            return Ok(Ok(v));
        }
        let code = v.pointer("/error/code").and_then(Value::as_str).unwrap_or("wallet_error").to_string();
        let msg = v.pointer("/error/message").and_then(Value::as_str).unwrap_or("Wallet transfer failed").to_string();
        Ok(Err((status.as_u16(), code, msg)))
    }
}

//! HTTP clients for the services growth depends on: gateway (profiles feed), trading engine (deals, accounts,
//! ledgers, history, bonus / credit / adjustment postings, demo contest accounts), wallet (cash rewards) and the
//! optional notifications service. All loopback, each with its own internal token.

use crate::money::{D, value_dec};
use crate::state::AppState;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

/// Query string from simple values: percent-encodes anything but unreserved characters and ':'.
pub fn qs(pairs: &[(&str, String)]) -> String {
    let enc = |v: &str| -> String {
        v.bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b':' => (b as char).to_string(),
                _ => format!("%{b:02X}"),
            })
            .collect()
    };
    pairs.iter().map(|(k, v)| format!("{k}={}", enc(v))).collect::<Vec<_>>().join("&")
}

fn int(v: &Value) -> Option<i64> {
    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
}

fn time(v: &Value) -> Option<DateTime<Utc>> {
    v.as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&Utc))
}

fn ts(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(chrono::SecondsFormat::Micros, true)
}

// ---------------------------------------------------------------- gateway

#[derive(Clone, Debug, Deserialize)]
pub struct GwUser {
    pub id: i64,
    pub tenant: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    #[serde(default)]
    pub country: String,
    #[serde(default)]
    pub referral_code: String,
    #[serde(default)]
    pub kyc_status: String,
    pub created_at: DateTime<Utc>,
    pub changed_at: DateTime<Utc>,
}

/// The gateway's referral users feed (every client, keyset by (changed_at, id)).
pub async fn gateway_users(st: &AppState, since: Option<&str>, after_id: i64, limit: i64) -> anyhow::Result<Vec<GwUser>> {
    let mut q: Vec<(&str, String)> = vec![("after_id", after_id.to_string()), ("limit", limit.to_string())];
    if let Some(s) = since {
        q.push(("since", s.to_string()));
    }
    let res = st.http.get(format!("{}/v1/internal/referrals/users?{}", st.cfg.gateway_url, qs(&q))).header("x-kalks-internal", &st.cfg.gateway_token).send().await?;
    if !res.status().is_success() {
        anyhow::bail!("gateway users feed returned {}", res.status());
    }
    #[derive(Deserialize)]
    struct R {
        items: Vec<GwUser>,
    }
    Ok(res.json::<R>().await?.items)
}

// ---------------------------------------------------------------- trading engine

/// Staff identity for engine admin calls. `finance` may post balance, credit and bonus.
fn engine_staff(st: &AppState, tenant: &str, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    rb.header("x-kalks-internal", &st.cfg.trading_token)
        .header("x-kalks-tenant", tenant)
        .header("x-kalks-staff-id", "growth-service")
        .header("x-kalks-staff-name", "Growth%20service")
        .header("x-kalks-staff-role", "finance")
}

fn engine_user(st: &AppState, tenant: &str, user_id: i64, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    rb.header("x-kalks-internal", &st.cfg.trading_token).header("x-kalks-tenant", tenant).header("x-kalks-user-id", user_id.to_string())
}

/// A closing deal from `GET /v1/dealing/deals` (DeskDeal).
#[derive(Clone, Debug)]
pub struct EngineDeal {
    pub id: i64,
    pub login: i64,
    pub user_id: i64,
    pub symbol: String,
    pub side: String,
    pub volume: D,
    pub profit: D,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
    pub kind: String,
    pub reversed: bool,
}

pub fn parse_deal(v: &Value) -> Option<EngineDeal> {
    Some(EngineDeal {
        id: int(&v["id"])?,
        login: int(&v["login"])?,
        user_id: int(&v["clientId"])?,
        symbol: v["symbol"].as_str()?.to_string(),
        side: v["side"].as_str().unwrap_or("").to_string(),
        volume: value_dec(&v["volume"])?,
        profit: value_dec(&v["profit"]).unwrap_or(D::ZERO),
        open_time: time(&v["openTime"])?,
        close_time: time(&v["closeTime"])?,
        kind: v["kind"].as_str().unwrap_or("close").to_string(),
        reversed: v["reversed"].as_bool().unwrap_or(false),
    })
}

/// Closing deals in `[from, to)`, newest first, at most `limit` (engine cap 2000).
pub async fn closing_deals(st: &AppState, tenant: &str, login: Option<i64>, from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>, limit: i64) -> anyhow::Result<Vec<EngineDeal>> {
    let mut q: Vec<(&str, String)> = vec![("limit", limit.to_string())];
    if let Some(l) = login {
        q.push(("login", l.to_string()));
    }
    if let Some(f) = from {
        q.push(("from", ts(f)));
    }
    if let Some(t) = to {
        q.push(("to", ts(t)));
    }
    let res = engine_staff(st, tenant, st.http.get(format!("{}/v1/dealing/deals?{}", st.cfg.trading_url, qs(&q)))).send().await?;
    if !res.status().is_success() {
        anyhow::bail!("engine deals returned {}", res.status());
    }
    let v: Value = res.json().await?;
    Ok(v.as_array().map(|a| a.iter().filter_map(parse_deal).collect()).unwrap_or_default())
}

#[derive(Clone, Debug)]
pub struct Account {
    pub login: i64,
    pub user_id: i64,
    pub kind: String,
    pub group: String,
    pub cent: bool,
    pub currency: String,
    pub status: String,
    pub balance: D,
    pub credit: D,
    pub bonus: D,
    pub equity: D,
}

impl Account {
    /// Account currency → USD (cent accounts report USC).
    pub fn usd(&self, v: D) -> D {
        if self.cent { v / crate::money::HUNDRED } else { v }
    }
    /// Unrealised P&L in USD: equity − balance − credit − bonus.
    pub fn floating_usd(&self) -> D {
        self.usd(self.equity - self.balance - self.credit - self.bonus)
    }
}

pub fn parse_account(a: &Value) -> Option<Account> {
    let d = |k: &str| value_dec(&a[k]).unwrap_or(D::ZERO);
    Some(Account {
        login: int(&a["login"])?,
        user_id: int(&a["userId"])?,
        kind: a["type"].as_str()?.to_string(),
        group: a["group"].as_str().unwrap_or("").to_string(),
        cent: a["cent"].as_bool().unwrap_or(false),
        currency: a["currency"].as_str().unwrap_or("USD").to_string(),
        status: a["status"].as_str().unwrap_or("active").to_string(),
        balance: d("balance"),
        credit: d("credit"),
        bonus: d("bonus"),
        equity: d("equity"),
    })
}

pub async fn account(st: &AppState, tenant: &str, login: i64) -> anyhow::Result<Option<Account>> {
    let res = engine_staff(st, tenant, st.http.get(format!("{}/v1/admin/accounts/{login}", st.cfg.trading_url))).send().await?;
    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !res.status().is_success() {
        anyhow::bail!("engine account {login} returned {}", res.status());
    }
    let v: Value = res.json().await?;
    Ok(parse_account(&v["account"]))
}

/// A client's accounts (`kind` = live | demo | None for both).
pub async fn accounts_of(st: &AppState, tenant: &str, user_id: i64, kind: Option<&str>) -> anyhow::Result<Vec<Account>> {
    let mut q: Vec<(&str, String)> = vec![("user_id", user_id.to_string()), ("limit", "100".into())];
    if let Some(k) = kind {
        q.push(("type", k.to_string()));
    }
    let res = engine_staff(st, tenant, st.http.get(format!("{}/v1/admin/accounts?{}", st.cfg.trading_url, qs(&q)))).send().await?;
    if !res.status().is_success() {
        anyhow::bail!("engine accounts of {user_id} returned {}", res.status());
    }
    let v: Value = res.json().await?;
    Ok(v["items"].as_array().map(|a| a.iter().filter_map(parse_account).filter(|a| a.user_id == user_id).collect()).unwrap_or_default())
}

#[derive(Clone, Debug)]
pub struct LedgerItem {
    pub txn: i64,
    pub kind: String,
    pub sub_ledger: String,
    /// USD (USC converted).
    pub amount: D,
    pub reason_code: Option<String>,
    pub at: DateTime<Utc>,
}

/// Ledger lines of an account since `from` (newest first, up to 1000).
pub async fn ledger(st: &AppState, tenant: &str, login: i64, user_id: i64, from: DateTime<Utc>) -> anyhow::Result<Vec<LedgerItem>> {
    let url = format!("{}/v1/accounts/{login}/ledger?{}", st.cfg.trading_url, qs(&[("from", ts(from)), ("limit", "1000".into())]));
    let res = engine_user(st, tenant, user_id, st.http.get(url)).send().await?;
    if !res.status().is_success() {
        anyhow::bail!("engine ledger {login} returned {}", res.status());
    }
    let v: Value = res.json().await?;
    Ok(v["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|it| {
            let mut amount = value_dec(&it["amount"])?;
            if it["currency"].as_str() == Some("USC") {
                amount /= crate::money::HUNDRED;
            }
            Some(LedgerItem {
                txn: int(&it["txn"])?,
                kind: it["kind"].as_str()?.to_string(),
                sub_ledger: it["subLedger"].as_str().unwrap_or("").to_string(),
                amount,
                reason_code: it["reasonCode"].as_str().map(str::to_string),
                at: time(&it["at"])?,
            })
        })
        .collect())
}

/// Closed deals (exit side) of an account in `[from, to)` from the client history API.
pub async fn history(st: &AppState, tenant: &str, login: i64, user_id: i64, from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>) -> anyhow::Result<Option<Vec<Value>>> {
    let mut q: Vec<(&str, String)> = vec![("limit", "1000".into())];
    if let Some(f) = from {
        q.push(("from", ts(f)));
    }
    if let Some(t) = to {
        q.push(("to", ts(t)));
    }
    let res = engine_user(st, tenant, user_id, st.http.get(format!("{}/v1/accounts/{login}/history?{}", st.cfg.trading_url, qs(&q)))).send().await?;
    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !res.status().is_success() {
        anyhow::bail!("engine history {login} returned {}", res.status());
    }
    let v: Value = res.json().await?;
    Ok(Some(v["deals"].as_array().cloned().unwrap_or_default()))
}

pub enum EngineOutcome {
    Booked,
    /// Network error, timeout, 5xx: retry with the same key.
    Retry(String),
    /// 4xx other than a duplicate key: needs a person.
    Fail(String),
}

/// `POST /v1/admin/accounts/{login}/balance` with an idempotency key. `amount` is USD; cent accounts get × 100.
pub async fn post_balance(st: &AppState, tenant: &str, login: i64, cent: bool, kind: &str, amount_usd: D, key: &str, reason_code: &str, note: &str) -> EngineOutcome {
    let amount = if cent { amount_usd * crate::money::HUNDRED } else { amount_usd };
    let body = json!({"type": kind, "amount": amount.normalize().to_string(), "idempotencyKey": key, "reasonCode": reason_code, "note": note});
    let res = engine_staff(st, tenant, st.http.post(format!("{}/v1/admin/accounts/{login}/balance", st.cfg.trading_url))).json(&body).send().await;
    match res {
        Err(e) => EngineOutcome::Retry(format!("engine unreachable: {e}")),
        Ok(r) if r.status().is_success() => EngineOutcome::Booked,
        Ok(r) => {
            let status = r.status();
            let v: Value = r.json().await.unwrap_or(Value::Null);
            let code = v["error"]["code"].as_str().unwrap_or("").to_string();
            let msg = format!("engine {}: {} {}", status.as_u16(), code, v["error"]["message"].as_str().unwrap_or("")).trim().to_string();
            if code == "duplicate_idempotency_key" {
                EngineOutcome::Booked
            } else if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                EngineOutcome::Retry(msg)
            } else {
                EngineOutcome::Fail(msg)
            }
        }
    }
}

/// Opens a demo account for a contest. Returns (account, credentials JSON).
pub async fn open_demo(st: &AppState, tenant: &str, user_id: i64, group: &str, balance: D, name: &str) -> Result<(Account, Value), String> {
    let body = json!({"userId": user_id, "type": "demo", "group": group, "initialBalance": balance.normalize().to_string(), "name": name});
    let res = engine_user(st, tenant, user_id, st.http.post(format!("{}/v1/accounts", st.cfg.trading_url))).json(&body).send().await.map_err(|e| format!("The trading engine is unavailable ({e})."))?;
    let status = res.status();
    let v: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(v["error"]["message"].as_str().unwrap_or("The contest account could not be opened.").to_string());
    }
    let acc = parse_account(&v["account"]).ok_or("Unexpected engine response.")?;
    Ok((acc, v["credentials"].clone()))
}

// ---------------------------------------------------------------- wallet

pub enum WalletOutcome {
    Credited { txn: String },
    Retry(String),
    Fail(String),
}

pub async fn wallet_credit(st: &AppState, tenant: &str, key: &str, user_id: i64, amount: D, kind: &str, reference: &str, note: &str) -> WalletOutcome {
    let body = json!({
        "idempotency_key": key, "user_id": user_id, "currency": "USDT", "amount": amount.normalize().to_string(),
        "direction": "credit", "kind": kind, "ref": reference, "note": note,
    });
    let res = st
        .http
        .post(format!("{}/v1/wallets/transfers", st.cfg.wallet_url))
        .header("x-kalks-internal", &st.cfg.wallet_token)
        .header("x-kalks-tenant", tenant)
        .header("x-kalks-service", "growth")
        .json(&body)
        .send()
        .await;
    match res {
        Err(e) => WalletOutcome::Retry(format!("wallet unreachable: {e}")),
        Ok(r) if r.status().is_success() => {
            let v: Value = r.json().await.unwrap_or(Value::Null);
            let txn = v["txn_id"].as_i64().map(|t| t.to_string()).or_else(|| v["txn_id"].as_str().map(str::to_string)).unwrap_or_default();
            WalletOutcome::Credited { txn }
        }
        Ok(r) => {
            let status = r.status();
            let v: Value = r.json().await.unwrap_or(Value::Null);
            let msg = format!("wallet {}: {} {}", status.as_u16(), v["error"]["code"].as_str().unwrap_or(""), v["error"]["message"].as_str().unwrap_or("")).trim().to_string();
            if status.is_server_error() || status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                WalletOutcome::Retry(msg)
            } else {
                WalletOutcome::Fail(msg)
            }
        }
    }
}

// ---------------------------------------------------------------- notifications (optional)

/// Best effort: the notifications service may not exist yet. Never fails the caller.
pub fn notify(st: &AppState, tenant: &str, user_id: i64, kind: &str, title: String, body: String, link: &str) {
    let st = st.clone();
    let payload = json!({"userId": user_id, "tenant": tenant, "kind": kind, "title": title, "body": body, "link": link, "source": "growth"});
    let tenant = tenant.to_string();
    tokio::spawn(async move {
        let r = st
            .http
            .post(format!("{}/v1/notify", st.cfg.notify_url))
            .header("x-kalks-internal", std::env::var("NOTIFY_INTERNAL_TOKEN").unwrap_or_default())
            .header("x-kalks-tenant", tenant)
            .timeout(std::time::Duration::from_secs(3))
            .json(&payload)
            .send()
            .await;
        if let Err(e) = r {
            tracing::debug!(error = %e, "notify skipped");
        }
    });
}

//! Calls to the other services (gateway, trading engine, wallet), all with their internal tokens. Everything
//! here is best effort: an unavailable service yields `None` / empty and never fails a support request.

use crate::state::AppState;
use serde_json::{Value, json};

fn gw(st: &AppState, tenant: &str, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    rb.header("x-kalks-internal", &st.cfg.gateway_token).header("x-kalks-tenant", tenant)
}

/// The engine's read-only staff identity for this service (like the IB service).
fn engine(st: &AppState, tenant: &str, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    rb.header("x-kalks-internal", &st.cfg.trading_token)
        .header("x-kalks-tenant", tenant)
        .header("x-kalks-staff-id", "support-service")
        .header("x-kalks-staff-name", "Support%20service")
        .header("x-kalks-staff-role", "viewer")
}

fn wallet(st: &AppState, tenant: &str, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    rb.header("x-kalks-internal", &st.cfg.wallet_token).header("x-kalks-tenant", tenant).header("x-kalks-service", "support")
}

async fn json_of(rb: reqwest::RequestBuilder) -> Option<Value> {
    let r = rb.timeout(std::time::Duration::from_secs(6)).send().await.ok()?;
    if !r.status().is_success() {
        return None;
    }
    r.json().await.ok()
}

/// `GET /v1/internal/users/{id}` on the gateway: `{id, email, name, country, kyc_status, status, created_at, …}`.
pub async fn user(st: &AppState, tenant: &str, id: i64) -> Option<Value> {
    let v = json_of(gw(st, tenant, st.http.get(format!("{}/v1/internal/users/{id}", st.cfg.gateway_url)))).await?;
    v.get("user").cloned()
}

pub async fn user_email(st: &AppState, tenant: &str, id: i64) -> Option<String> {
    user(st, tenant, id).await.and_then(|u| u["email"].as_str().map(str::to_string)).filter(|e| e.contains('@'))
}

/// A page of gateway users changed after `(since, after_id)` (the IB mirror endpoint).
pub async fn users_page(st: &AppState, since: &str, after_id: i64, limit: i64) -> anyhow::Result<Vec<Value>> {
    let url = format!("{}/v1/internal/referrals/users?since={}&after_id={after_id}&limit={limit}", st.cfg.gateway_url, urlenc(since));
    let r = gw(st, "kalks", st.http.get(url)).send().await?;
    if !r.status().is_success() {
        anyhow::bail!("gateway users returned {}", r.status());
    }
    let v: Value = r.json().await?;
    Ok(v["items"].as_array().cloned().unwrap_or_default())
}

pub fn urlenc(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// A client's trading accounts (engine account views).
pub async fn accounts(st: &AppState, tenant: &str, user_id: i64) -> Option<Vec<Value>> {
    let v = json_of(engine(st, tenant, st.http.get(format!("{}/v1/admin/accounts?user_id={user_id}&limit=50", st.cfg.trading_url)))).await?;
    v["items"].as_array().cloned()
}

/// A page of engine accounts (margin call adapter).
pub async fn accounts_page(st: &AppState, tenant: &str, page: i64) -> anyhow::Result<(Vec<Value>, i64)> {
    let url = format!("{}/v1/admin/accounts?type=live&page={page}&limit=200", st.cfg.trading_url);
    let r = engine(st, tenant, st.http.get(url)).send().await?;
    if !r.status().is_success() {
        anyhow::bail!("engine accounts returned {}", r.status());
    }
    let v: Value = r.json().await?;
    Ok((v["items"].as_array().cloned().unwrap_or_default(), v["total"].as_i64().unwrap_or(0)))
}

/// Closing deals since `from` (RFC 3339), newest first.
pub async fn deals_since(st: &AppState, tenant: &str, from: &str) -> anyhow::Result<Vec<Value>> {
    let url = format!("{}/v1/dealing/deals?from={}&limit=500", st.cfg.trading_url, urlenc(from));
    let r = engine(st, tenant, st.http.get(url)).send().await?;
    if !r.status().is_success() {
        anyhow::bail!("engine deals returned {}", r.status());
    }
    let v: Value = r.json().await?;
    Ok(v.as_array().cloned().unwrap_or_default())
}

/// Recent wallet activity of a client (deposits, withdrawals, transfers) through the wallet's client API.
pub async fn wallet_activity(st: &AppState, tenant: &str, user_id: i64, limit: i64) -> Option<Value> {
    json_of(wallet(st, tenant, st.http.get(format!("{}/v1/wallets/{user_id}/activity?page=1&limit={limit}&type=all", st.cfg.wallet_url)))).await
}

pub async fn wallet_overview(st: &AppState, tenant: &str, user_id: i64) -> Option<Value> {
    json_of(wallet(st, tenant, st.http.get(format!("{}/v1/wallets/{user_id}/overview", st.cfg.wallet_url)))).await
}

/// The Back Office user context panel: profile + KYC (gateway), accounts (engine), wallet activity.
pub async fn context(st: &AppState, tenant: &str, user_id: i64) -> Value {
    let (user, accounts, activity, overview) = tokio::join!(
        user(st, tenant, user_id),
        accounts(st, tenant, user_id),
        wallet_activity(st, tenant, user_id, 8),
        wallet_overview(st, tenant, user_id)
    );
    let accts: Vec<Value> = accounts
        .clone()
        .unwrap_or_default()
        .iter()
        .map(|a| {
            json!({
                "login": a["login"], "type": a["type"], "group": a["groupName"].as_str().or(a["group"].as_str()), "currency": a["currency"],
                "leverage": a["leverage"], "status": a["status"], "balance": a["balance"], "equity": a["equity"], "marginLevel": a["marginLevel"],
                "marginCall": a["marginCall"], "positions": a["positions"], "createdAt": a["createdAt"],
            })
        })
        .collect();
    let live: Vec<&Value> = accts.iter().filter(|a| a["type"] == "live").collect();
    let sum = |k: &str| live.iter().filter_map(|a| a[k].as_f64()).sum::<f64>();
    json!({
        "user": user,
        "accounts": accounts.as_ref().map(|_| accts.clone()),
        "accountsSummary": accounts.as_ref().map(|_| json!({"live": live.len(), "demo": accts.len() - live.len(), "liveBalance": sum("balance"), "liveEquity": sum("equity"), "marginCall": live.iter().any(|a| a["marginCall"] == true)})),
        "wallet": overview.map(|o| json!({"balances": o["balances"], "pendingDeposits": o["pending_deposits"], "openWithdrawals": o["open_withdrawals"]})),
        "walletActivity": activity.map(|a| a["items"].clone()),
    })
}

//! Polling adapters that turn other services' state into notifications, for producers that don't call
//! `POST /v1/notify` yet. Each one is idempotent (dedupe keys) and starts from "now" on its first run, so a
//! deploy never floods clients with history.
//!
//! | adapter  | source                                                       | notification types                          |
//! |----------|--------------------------------------------------------------|---------------------------------------------|
//! | trading  | engine `GET /v1/dealing/deals?from=` (closing deals)          | `trading.stop_out`, `trading.sl`, `trading.tp`, `trading.dealer_close` |
//! | margin   | engine `GET /v1/admin/accounts` (`marginCall` flag)           | `trading.margin_call`                        |
//! | kyc      | gateway `GET /v1/internal/referrals/users?since=` (kyc_status) | `kyc.verified`, `kyc.rejected` (in-app; the gateway emails decisions) |
//! | wallet   | wallet `GET /v1/wallets/{id}/notifications` for clients seen on the stream in the last 24 h | `wallet.deposit_credited`, `wallet.withdrawal_*`, … |

use crate::db;
use crate::notify::{self, EmailMode, NewNotification};
use crate::state::AppState;
use crate::upstream;
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn now_rfc() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Micros, true)
}

fn num(v: &Value) -> Option<f64> {
    v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
}

fn money(v: &Value) -> String {
    num(v).map(|x| format!("{x:.2}")).unwrap_or_else(|| "-".into())
}

pub async fn tenants(st: &AppState) -> Vec<String> {
    let mut t: Vec<String> = sqlx::query_scalar("SELECT DISTINCT tenant FROM conversations UNION SELECT DISTINCT tenant FROM notification_prefs").fetch_all(&st.pool).await.unwrap_or_default();
    if !t.iter().any(|x| x == "kalks") {
        t.push("kalks".into());
    }
    t
}

/// Stop-outs, SL / TP and dealer closes from the engine's closing deals.
pub async fn trading(st: &AppState, tenant: &str) -> anyhow::Result<usize> {
    let key = format!("adapter:deals:{tenant}");
    let Some(from) = db::cursor(&st.pool, &key).await? else {
        db::set_cursor(&st.pool, &key, &now_rfc()).await?;
        return Ok(0);
    };
    let deals = upstream::deals_since(st, tenant, &from).await?;
    let mut n = 0;
    let mut newest: Option<DateTime<Utc>> = DateTime::parse_from_rfc3339(&from).ok().map(|t| t.with_timezone(&Utc));
    for d in &deals {
        let close: Option<DateTime<Utc>> = d["closeTime"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&Utc));
        if let Some(c) = close
            && newest.is_none_or(|x| c > x)
        {
            newest = Some(c);
        }
        let Some(user) = d["clientId"].as_i64().or_else(|| d["clientId"].as_str().and_then(|s| s.parse().ok())) else { continue };
        let kind = d["kind"].as_str().unwrap_or("");
        let reason = d["reason"].as_str().unwrap_or("");
        let symbol = d["symbol"].as_str().unwrap_or("");
        let login = &d["login"];
        let (ty, sev, title) = if kind == "stop-out" || reason == "stop_out" {
            ("trading.stop_out", "critical", format!("Stop-out on account {login}: {symbol} closed"))
        } else if reason == "sl" {
            ("trading.sl", "warning", format!("Stop loss hit: {symbol}"))
        } else if reason == "tp" {
            ("trading.tp", "success", format!("Take profit hit: {symbol}"))
        } else if matches!(reason, "dealer" | "force") || kind == "force" {
            ("trading.dealer_close", "warning", format!("{symbol} position closed by the dealing desk"))
        } else {
            continue;
        };
        let body = format!("{} {} lot closed at {} on account {login}. Result: {} USD.", d["side"].as_str().unwrap_or("").to_uppercase(), money(&d["volume"]).trim_end_matches('0').trim_end_matches('.'), d["closePrice"], money(&d["profit"]));
        let nn = NewNotification::user(user, ty, title, body)
            .severity(sev)
            .source("trading")
            .link("/portfolio")
            .dedupe(format!("deal:{}", d["id"]))
            .data(json!({"login": login, "ticket": d["ticket"], "dealId": d["id"], "symbol": symbol, "profit": d["profit"]}));
        if !notify::deliver(st, tenant, nn).await?.duplicate {
            n += 1;
        }
    }
    if let Some(t) = newest {
        // re-read the last second next time (deals closing in the same instant); dedupe keys drop repeats
        db::set_cursor(&st.pool, &key, &(t - chrono::Duration::seconds(1)).to_rfc3339_opts(SecondsFormat::Micros, true)).await?;
    }
    Ok(n)
}

/// Margin calls: accounts whose `marginCall` flag turned on since the last run.
pub async fn margin(st: &AppState, tenant: &str) -> anyhow::Result<usize> {
    let key = format!("adapter:margin:{tenant}");
    let prev: Option<BTreeSet<i64>> = db::cursor(&st.pool, &key).await?.and_then(|s| serde_json::from_str(&s).ok());
    let mut now: BTreeSet<i64> = BTreeSet::new();
    let mut hits: Vec<Value> = Vec::new();
    for page in 1..=25 {
        let (items, total) = upstream::accounts_page(st, tenant, page).await?;
        for a in &items {
            if a["marginCall"] == true
                && let Some(login) = a["login"].as_i64()
            {
                now.insert(login);
                hits.push(a.clone());
            }
        }
        if items.is_empty() || page * 200 >= total {
            break;
        }
    }
    let mut n = 0;
    if let Some(prev) = &prev {
        for a in hits.iter().filter(|a| a["login"].as_i64().is_some_and(|l| !prev.contains(&l))) {
            let Some(user) = a["userId"].as_i64() else { continue };
            let login = &a["login"];
            let title = format!("Margin call on account {login}");
            let body = format!(
                "Your margin level is {}%, at or below the margin call level of {}%. Add funds or reduce positions: at {}% positions are closed automatically (stop-out).",
                money(&a["marginLevel"]),
                money(&a["marginCallLevel"]).trim_end_matches(".00"),
                money(&a["stopOutLevel"]).trim_end_matches(".00")
            );
            let nn = NewNotification::user(user, "trading.margin_call", title, body)
                .severity("critical")
                .source("trading")
                .link(format!("/accounts/{login}"))
                .dedupe(format!("margin:{login}:{}", Utc::now().format("%Y%m%d%H")))
                .data(json!({"login": login, "marginLevel": a["marginLevel"], "equity": a["equity"]}));
            if !notify::deliver(st, tenant, nn).await?.duplicate {
                n += 1;
            }
        }
    }
    db::set_cursor(&st.pool, &key, &serde_json::to_string(&now)?).await?;
    Ok(n)
}

/// KYC decisions from the gateway (users changed since the cursor).
pub async fn kyc(st: &AppState) -> anyhow::Result<usize> {
    let key = "adapter:kyc";
    let Some(cur) = db::cursor(&st.pool, key).await? else {
        db::set_cursor(&st.pool, key, &format!("{}|0", now_rfc())).await?;
        return Ok(0);
    };
    let (since, after) = cur.split_once('|').map(|(a, b)| (a.to_string(), b.parse::<i64>().unwrap_or(0))).unwrap_or((cur.clone(), 0));
    let items = upstream::users_page(st, &since, after, 500).await?;
    let mut n = 0;
    let mut last = (since.clone(), after);
    for u in &items {
        if let (Some(changed), Some(id)) = (u["changed_at"].as_str(), u["id"].as_i64()) {
            last = (changed.to_string(), id);
        }
        let Some(id) = u["id"].as_i64() else { continue };
        let tenant = u["tenant"].as_str().unwrap_or("kalks");
        let day = u["changed_at"].as_str().unwrap_or("").get(..10).unwrap_or("").to_string();
        let mut nn = match u["kyc_status"].as_str() {
            Some("verified") => NewNotification::user(id, "kyc.verified", "Your identity is verified", "You can now withdraw from your wallet. Your name and date of birth are locked.").severity("success").link("/profile/verification").dedupe("kyc:verified".to_string()),
            Some("rejected") => NewNotification::user(id, "kyc.rejected", "Identity verification needs attention", "We couldn't verify your documents. Open Verification to see why and upload new ones.").severity("warning").link("/profile/verification").dedupe(format!("kyc:rejected:{day}")),
            _ => continue,
        };
        nn.source = "gateway".into();
        // the gateway already emails every KYC decision
        nn.email = EmailMode::Never;
        if !notify::deliver(st, tenant, nn).await?.duplicate {
            n += 1;
        }
    }
    if !items.is_empty() {
        db::set_cursor(&st.pool, key, &format!("{}|{}", last.0, last.1)).await?;
    }
    Ok(n)
}

fn wallet_type(kind: &str) -> String {
    let k = kind.replace('.', "_");
    if k.starts_with("wallet_") { k.replacen("wallet_", "wallet.", 1) } else { format!("wallet.{k}") }
}

/// Wallet notifications of clients seen on the stream in the last 24 h, mirrored into the bell (+ email).
pub async fn wallet(st: &AppState) -> anyhow::Result<usize> {
    let mut n = 0;
    for (tenant, user) in st.hub.recent_users(std::time::Duration::from_secs(24 * 3600)) {
        let url = format!("{}/v1/wallets/{user}/notifications?limit=20", st.cfg.wallet_url);
        let r = st.http.get(url).header("x-kalks-internal", &st.cfg.wallet_token).header("x-kalks-tenant", &tenant).header("x-kalks-service", "support").send().await;
        let Ok(r) = r else { continue };
        if !r.status().is_success() {
            continue;
        }
        let v: Value = r.json().await.unwrap_or(Value::Null);
        let items = v["items"].as_array().cloned().unwrap_or_default();
        let key = format!("adapter:wallet:{tenant}:{user}");
        let max_id = items.iter().filter_map(|i| i["id"].as_i64()).max().unwrap_or(0);
        let Some(seen) = db::cursor(&st.pool, &key).await?.and_then(|s| s.parse::<i64>().ok()) else {
            db::set_cursor(&st.pool, &key, &max_id.to_string()).await?;
            continue;
        };
        for it in items.iter().rev().filter(|i| i["id"].as_i64().is_some_and(|id| id > seen)) {
            let kind = it["kind"].as_str().unwrap_or("wallet");
            let sev = if kind.contains("rejected") || kind.contains("failed") { "warning" } else if kind.contains("credited") || kind.contains("completed") { "success" } else { "info" };
            let link = if kind.starts_with("withdrawal") || kind.starts_with("deposit") { "/wallet/history" } else { "/wallet" };
            let nn = NewNotification::user(user, &wallet_type(kind), it["title"].as_str().unwrap_or("Wallet update"), it["body"].as_str().unwrap_or(""))
                .severity(sev)
                .source("wallet")
                .link(link)
                .dedupe(format!("wallet:n:{}", it["id"]))
                .data(it["data"].clone());
            if !notify::deliver(st, &tenant, nn).await?.duplicate {
                n += 1;
            }
        }
        if max_id > seen {
            db::set_cursor(&st.pool, &key, &max_id.to_string()).await?;
        }
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    #[test]
    fn maps_wallet_kinds() {
        assert_eq!(super::wallet_type("deposit.credited"), "wallet.deposit_credited");
        assert_eq!(super::wallet_type("wallet.credit"), "wallet.credit");
        assert_eq!(super::wallet_type("withdrawal.rejected"), "wallet.withdrawal_rejected");
    }
}

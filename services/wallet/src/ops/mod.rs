//! Business operations shared by the HTTP handlers, the background workers and the tests.

pub mod adjustments;
pub mod deposits;
pub mod manual;
pub mod oxapay;
pub mod trading;
pub mod transfers;
pub mod turnover;
pub mod withdrawals;

use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};

/// Records a client notification (D41) inside the caller's transaction. `notifier` pushes it to the support
/// service after the commit (bell, realtime, email per the client's preference).
pub async fn notify(tx: &mut Transaction<'_, Postgres>, tenant_id: i64, user_id: i64, kind: &str, title: &str, body: &str, data: Value) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO notifications (tenant_id, user_id, kind, title, body, data) VALUES ($1, $2, $3, $4, $5, $6)")
        .bind(tenant_id)
        .bind(user_id)
        .bind(kind)
        .bind(title)
        .bind(body)
        .bind(sqlx::types::Json(data))
        .execute(&mut **tx)
        .await?;
    crate::notifier::WAKE.notify_one();
    Ok(())
}

/// Label / value pairs for the facts strip of a notice's email (`data.facts`).
pub fn facts(pairs: &[(&str, String)]) -> Value {
    serde_json::json!(pairs.iter().filter(|(_, v)| !v.is_empty()).map(|(k, v)| serde_json::json!({"label": k, "value": v})).collect::<Vec<_>>())
}

/// A transaction hash short enough for a notice: the first ten and last six characters.
pub fn short_hash(h: &str) -> String {
    if h.len() > 20 { format!("{}...{}", &h[..10], &h[h.len() - 6..]) } else { h.to_string() }
}

/// The client's available wallet balance in `ccy`, as the notice's "Balance" fact (inside the caller's transaction,
/// so it is the balance the posting just produced).
pub async fn available(tx: &mut Transaction<'_, Postgres>, tenant_id: i64, user_id: i64, ccy: &str) -> String {
    let b: Option<crate::money::D> = sqlx::query_scalar("SELECT available FROM wallet_balances WHERE tenant_id = $1 AND user_id = $2 AND currency = $3")
        .bind(tenant_id)
        .bind(user_id)
        .bind(ccy)
        .fetch_optional(&mut **tx)
        .await
        .ok()
        .flatten();
    b.map(|b| format!("{} {ccy}", crate::money::s(b))).unwrap_or_default()
}

/// Remembers the client's IP for the withdrawal risk checklist (best effort).
pub async fn record_ip(pool: &PgPool, tenant_id: i64, user_id: i64, ip: Option<&str>) {
    let Some(ip) = ip.filter(|i| !i.is_empty() && *i != "unknown") else { return };
    let _ = sqlx::query(
        "INSERT INTO client_ips (tenant_id, user_id, ip) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, user_id, ip) DO UPDATE SET last_seen = now(), hits = client_ips.hits + 1",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(ip)
    .execute(pool)
    .await;
}

/// 12 random bytes as lower-case hex (ids of deposit intents).
pub fn random_id(prefix: &str) -> String {
    let mut b = [0u8; 12];
    getrandom::fill(&mut b).expect("OS randomness unavailable");
    format!("{prefix}{}", crate::chain::hex_encode(&b))
}

pub fn clean_text(v: Option<&str>, max: usize) -> Option<String> {
    v.map(|s| s.trim().chars().filter(|c| !c.is_control()).take(max).collect::<String>()).filter(|s| !s.is_empty())
}

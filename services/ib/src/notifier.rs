//! Tells partners when a commission payout lands in their wallet: `POST $SUPPORT_URL/v1/notify` with type
//! `ib.commission_paid` (bell in the Client Area and Kalks Trader, realtime, email per the `ib` preference).
//!
//! The `payouts` row is the outbox: it is marked paid in the transfer step's transaction and announced
//! afterwards by this pass (run after every transfer step), so a support outage never holds a payout back.
//! `dedupeKey = ib:payout:<id>:paid` makes retries safe. Failures back off (15 s doubling, capped at 1 h)
//! and give up after `MAX_ATTEMPTS`; 4xx answers are not retried.

use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;

use crate::money::D;
use crate::state::AppState;

pub const MAX_ATTEMPTS: i32 = 12;

pub fn dedupe_key(payout: i64) -> String {
    format!("ib:payout:{payout}:paid")
}

pub fn backoff_secs(attempts: i32) -> i64 {
    (15i64 << attempts.clamp(0, 12)).min(3600)
}

/// "1,234.50" style amount for the notification text.
pub fn usdt(amount: D) -> String {
    let s = format!("{:.2}", crate::money::r2(amount));
    let (int, frac) = s.split_once('.').unwrap_or((&s, "00"));
    let (sign, digits) = int.strip_prefix('-').map(|d| ("-", d)).unwrap_or(("", int));
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    format!("{sign}{out}.{frac}")
}

/// One pass over paid, not yet announced payouts. Returns (sent, failed).
pub async fn push_paid(st: &AppState) -> anyhow::Result<(usize, usize)> {
    if st.cfg.support_url.is_empty() {
        return Ok((0, 0));
    }
    let rows = sqlx::query(
        "SELECT p.id, p.tenant, p.batch_id, p.user_id, p.amount, p.lines, p.wallet_txn, p.notify_attempts, b.period_end
           FROM payouts p JOIN payout_batches b ON b.id = p.batch_id
          WHERE p.status = 'paid' AND p.notified_at IS NULL AND p.notify_attempts < $1 AND (p.notify_next_at IS NULL OR p.notify_next_at <= now())
          ORDER BY p.id LIMIT 100",
    )
    .bind(MAX_ATTEMPTS)
    .fetch_all(&st.pool)
    .await?;
    let (mut sent, mut failed) = (0, 0);
    for r in &rows {
        let id: i64 = r.get("id");
        let tenant: String = r.get("tenant");
        let amount: D = r.get("amount");
        let period_end: DateTime<Utc> = r.get("period_end");
        let body = json!({
            "type": "ib.commission_paid",
            "userId": r.get::<i64, _>("user_id"),
            "title": "Partner commission paid",
            "body": format!("{} USDT in partner commission for the period to {} was credited to your wallet.", usdt(amount), period_end.format("%d %b %Y")),
            "severity": "success",
            "link": "/partner/payouts",
            "data": {"payoutId": id, "batchId": r.get::<i64, _>("batch_id"), "amount": amount.to_string(), "lines": r.get::<i32, _>("lines"), "walletTxn": r.get::<Option<String>, _>("wallet_txn")},
            "dedupeKey": dedupe_key(id),
        });
        let res = st
            .http
            .post(format!("{}/v1/notify", st.cfg.support_url))
            .header("x-kalks-internal", &st.cfg.support_token)
            .header("x-kalks-tenant", &tenant)
            .header("x-kalks-service", "ib")
            .json(&body)
            .send()
            .await;
        let err = match res {
            Ok(r) if r.status().is_success() => None,
            Ok(r) if r.status().is_client_error() && r.status() != 408 && r.status() != 429 => {
                sqlx::query("UPDATE payouts SET notify_attempts = $2, notify_error = $3 WHERE id = $1").bind(id).bind(MAX_ATTEMPTS).bind(format!("HTTP {}", r.status())).execute(&st.pool).await?;
                tracing::error!(payout = id, status = %r.status(), "support notify refused the payout notification");
                failed += 1;
                continue;
            }
            Ok(r) => Some(format!("HTTP {}", r.status())),
            Err(e) => Some(if e.is_timeout() { "timeout".to_string() } else { "connection failed".to_string() }),
        };
        match err {
            None => {
                sqlx::query("UPDATE payouts SET notified_at = now(), notify_attempts = notify_attempts + 1, notify_error = NULL WHERE id = $1").bind(id).execute(&st.pool).await?;
                sent += 1;
            }
            Some(e) => {
                let attempts: i32 = r.get("notify_attempts");
                sqlx::query("UPDATE payouts SET notify_attempts = notify_attempts + 1, notify_error = $2, notify_next_at = now() + make_interval(secs => $3) WHERE id = $1")
                    .bind(id)
                    .bind(&e)
                    .bind(backoff_secs(attempts) as f64)
                    .execute(&st.pool)
                    .await?;
                tracing::warn!(payout = id, error = %e, "payout notification failed; will retry");
                failed += 1;
                break;
            }
        }
    }
    Ok((sent, failed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::money::dec;

    #[test]
    fn formats_amounts() {
        assert_eq!(usdt(dec("1234.5")), "1,234.50");
        assert_eq!(usdt(dec("12.345")), "12.35");
        assert_eq!(usdt(dec("999")), "999.00");
        assert_eq!(usdt(dec("1000000")), "1,000,000.00");
        assert_eq!(dedupe_key(9), "ib:payout:9:paid");
    }
}

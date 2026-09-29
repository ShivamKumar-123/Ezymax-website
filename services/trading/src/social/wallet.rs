//! Calls to the wallet service (services/wallet, `WALLET_URL`, default http://127.0.0.1:8095) with
//! `X-Kalks-Internal: WALLET_INTERNAL_TOKEN`:
//!
//! - `POST /v1/wallets/transfers` `{idempotency_key, user_id, currency:"USDT", amount, direction, kind, ref, note}`
//!   for PAMM invest (`pamm_invest`, debit), redemptions and refunds (`pamm_redeem`, credit) and fee payouts
//!   (`copy_fee`, credit);
//! - `POST /v1/wallets/{user_id}/to-trading` / `from-trading` `{idempotency_key, login, amount, currency}` for
//!   the money on a copy account.
//!
//! Every call is idempotent on its key. Credits the engine owes (redemptions, refunds, fee payouts) go through
//! the `wallet_outbox` table and are retried until the wallet confirms them. The client speaks plain HTTP/1.1
//! (the wallet is an internal service on the loopback / private network), so the engine needs no extra HTTP
//! dependency.

use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::money::D;

pub const DEBIT: &str = "debit";
pub const CREDIT: &str = "credit";

#[derive(Clone, Debug)]
pub struct WalletClient {
    /// host:port
    host: String,
    token: String,
    configured: bool,
}

#[derive(Debug, Clone)]
pub struct WalletError {
    /// HTTP status (0 = not reachable).
    pub status: u16,
    pub code: String,
    pub message: String,
}

impl WalletError {
    pub fn unavailable(msg: impl Into<String>) -> Self {
        Self { status: 0, code: "wallet_unavailable".into(), message: msg.into() }
    }
    /// The wallet answered and refused (not worth retrying).
    pub fn is_rejection(&self) -> bool {
        (400..500).contains(&self.status) && self.status != 408 && self.status != 429
    }
}

impl std::fmt::Display for WalletError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}: {}", self.status, self.code, self.message)
    }
}

impl WalletClient {
    pub fn new(url: &str, token: &str) -> Self {
        let host = url.trim().trim_end_matches('/').trim_start_matches("http://").to_string();
        Self { configured: !host.is_empty(), host, token: token.to_string() }
    }

    /// POST JSON to `path` on this internal service (also used for the IB service).
    pub async fn post(&self, tenant: &str, path: &str, body: &Value) -> Result<Value, WalletError> {
        if !self.configured {
            return Err(WalletError::unavailable("The wallet service is not configured"));
        }
        let payload = body.to_string();
        let req = format!(
            "POST {path} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nX-Kalks-Internal: {}\r\nX-Kalks-Tenant: {tenant}\r\nX-Kalks-Service: trading\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
            self.host,
            self.token,
            payload.len()
        );
        let io = async {
            let mut s = tokio::net::TcpStream::connect(&self.host).await?;
            s.write_all(req.as_bytes()).await?;
            let mut buf = Vec::new();
            s.read_to_end(&mut buf).await?;
            Ok::<_, std::io::Error>(buf)
        };
        let buf = match tokio::time::timeout(Duration::from_secs(15), io).await {
            Ok(Ok(b)) => b,
            Ok(Err(e)) => return Err(WalletError::unavailable(format!("The wallet service is unavailable ({e})"))),
            Err(_) => return Err(WalletError::unavailable("The wallet service did not answer in time")),
        };
        let (status, body) = parse_response(&buf).ok_or_else(|| WalletError::unavailable("Unreadable wallet response"))?;
        let v: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
        if (200..300).contains(&status) {
            return Ok(v);
        }
        let e = v.get("error").cloned().unwrap_or(Value::Null);
        Err(WalletError {
            status,
            code: e.get("code").and_then(Value::as_str).unwrap_or("wallet_error").to_string(),
            message: e.get("message").and_then(Value::as_str).unwrap_or("The wallet refused the transfer").to_string(),
        })
    }

    /// Debit / credit a user's USDT wallet for PAMM and copy-trading flows.
    #[allow(clippy::too_many_arguments)]
    pub async fn transfer(&self, tenant: &str, key: &str, user_id: i64, amount: D, direction: &str, kind: &str, reference: &str, note: &str) -> Result<Value, WalletError> {
        let body = json!({"idempotency_key": key, "user_id": user_id, "currency": "USDT", "amount": amount.normalize().to_string(),
                          "direction": direction, "kind": kind, "ref": reference, "note": note});
        self.post(tenant, "/v1/wallets/transfers", &body).await
    }

    /// Wallet → trading account (the wallet books its side and credits the account through the engine).
    pub async fn to_trading(&self, tenant: &str, key: &str, user_id: i64, login: i64, amount: D) -> Result<Value, WalletError> {
        let body = json!({"idempotency_key": key, "login": login, "amount": amount.normalize().to_string(), "currency": "USDT"});
        self.post(tenant, &format!("/v1/wallets/{user_id}/to-trading"), &body).await
    }

    /// Trading account → wallet.
    pub async fn from_trading(&self, tenant: &str, key: &str, user_id: i64, login: i64, amount: D) -> Result<Value, WalletError> {
        let body = json!({"idempotency_key": key, "login": login, "amount": amount.normalize().to_string(), "currency": "USDT"});
        self.post(tenant, &format!("/v1/wallets/{user_id}/from-trading"), &body).await
    }
}

fn parse_response(buf: &[u8]) -> Option<(u16, Vec<u8>)> {
    let split = buf.windows(4).position(|w| w == b"\r\n\r\n")?;
    let head = std::str::from_utf8(&buf[..split]).ok()?;
    let status: u16 = head.lines().next()?.split_whitespace().nth(1)?.parse().ok()?;
    let body = &buf[split + 4..];
    let chunked = head.lines().any(|l| l.to_ascii_lowercase().starts_with("transfer-encoding:") && l.to_ascii_lowercase().contains("chunked"));
    if !chunked {
        return Some((status, body.to_vec()));
    }
    let mut out = Vec::new();
    let mut rest = body;
    loop {
        let nl = rest.windows(2).position(|w| w == b"\r\n")?;
        let size = usize::from_str_radix(std::str::from_utf8(&rest[..nl]).ok()?.split(';').next()?.trim(), 16).ok()?;
        rest = &rest[nl + 2..];
        if size == 0 {
            break;
        }
        out.extend_from_slice(rest.get(..size)?);
        rest = rest.get(size + 2..).unwrap_or_default();
    }
    Some((status, out))
}

/* ------------------------------------------------------------------ */
/* Outbox: credits the engine owes, retried until done                 */
/* ------------------------------------------------------------------ */

#[allow(clippy::too_many_arguments)]
pub async fn enqueue<'e, E: sqlx::PgExecutor<'e>>(ex: E, tenant: i64, key: &str, user_id: i64, amount: D, direction: &str, kind: &str, reference: &str, note: &str) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO wallet_outbox (tenant_id, idempotency_key, user_id, amount, direction, kind, reference, note, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT (idempotency_key) DO NOTHING",
    )
    .bind(tenant)
    .bind(key)
    .bind(user_id)
    .bind(amount)
    .bind(direction)
    .bind(kind)
    .bind(reference)
    .bind(note)
    .execute(ex)
    .await?;
    Ok(())
}

/// Sends pending outbox rows; a fee payout that goes through marks its fee `paid`.
pub async fn flush(pool: &PgPool, wallet: &WalletClient, slug_of: impl Fn(i64) -> String) -> usize {
    let rows = match sqlx::query("SELECT id, tenant_id, idempotency_key, user_id, amount, direction, kind, reference, note, attempts FROM wallet_outbox WHERE status = 'pending' ORDER BY id LIMIT 50").fetch_all(pool).await {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "wallet outbox read failed");
            return 0;
        }
    };
    let mut sent = 0;
    for r in rows {
        let id: i64 = r.get("id");
        let tenant: i64 = r.get("tenant_id");
        let key: String = r.get("idempotency_key");
        let reference: String = r.get("reference");
        let attempts: i32 = r.get("attempts");
        let res = wallet.transfer(&slug_of(tenant), &key, r.get("user_id"), r.get("amount"), &r.get::<String, _>("direction"), &r.get::<String, _>("kind"), &reference, &r.get::<String, _>("note")).await;
        match res {
            Ok(_) => {
                sent += 1;
                let _ = sqlx::query("UPDATE wallet_outbox SET status = 'done', attempts = attempts + 1, done_at = now(), last_error = NULL WHERE id = $1").bind(id).execute(pool).await;
                if let Some(fee) = reference.strip_prefix("fee:").and_then(|f| f.parse::<i64>().ok()) {
                    let _ = sqlx::query("UPDATE social_fees SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = $1 AND status = 'approved'").bind(fee).execute(pool).await;
                }
                tracing::info!(key, "wallet outbox delivered");
            }
            Err(e) => {
                let give_up = e.is_rejection() || attempts + 1 >= 50;
                let _ = sqlx::query("UPDATE wallet_outbox SET attempts = attempts + 1, last_error = $2, status = CASE WHEN $3 THEN 'failed' ELSE status END WHERE id = $1")
                    .bind(id)
                    .bind(e.to_string())
                    .bind(give_up)
                    .execute(pool)
                    .await;
                if give_up {
                    if let Some(fee) = reference.strip_prefix("fee:").and_then(|f| f.parse::<i64>().ok()) {
                        let _ = sqlx::query("UPDATE social_fees SET status = 'failed', note = $2, updated_at = now() WHERE id = $1").bind(fee).bind(e.message.clone()).execute(pool).await;
                    }
                    tracing::error!(key, error = %e, "wallet outbox entry failed for good");
                } else {
                    tracing::debug!(key, error = %e, "wallet outbox retry later");
                }
            }
        }
    }
    sent
}

#[cfg(test)]
mod tests {
    #[test]
    fn parses_plain_and_chunked_responses() {
        let (s, b) = super::parse_response(b"HTTP/1.1 200 OK\r\ncontent-length: 11\r\n\r\n{\"ok\":true}").unwrap();
        assert_eq!((s, b.as_slice()), (200, &b"{\"ok\":true}"[..]));
        let (s, b) = super::parse_response(b"HTTP/1.1 422 Unprocessable\r\ntransfer-encoding: chunked\r\n\r\n5\r\n{\"a\":\r\n2\r\n1}\r\n0\r\n\r\n").unwrap();
        assert_eq!((s, b.as_slice()), (422, &b"{\"a\":1}"[..]));
    }
}

//! Wallet service client (services/wallet): `POST /v1/wallets/transfers` with
//! `{idempotency_key, user_id, currency, amount, direction, kind, ref, note}` and `X-Ezymex-Internal:
//! $WALLET_INTERNAL_TOKEN`. Every call is recorded in `wallet_ops` first and retried with the same key when the
//! outcome is unknown, so nothing is charged or paid twice (the pattern of services/prop).
//!
//! Kinds: `staking_subscribe` (debit of the principal), `staking_reward` (monthly return), `staking_redeem`
//! (principal back at maturity).

use crate::money::{D, num};
use serde_json::{Value, json};
use sqlx::PgPool;

pub const KIND_SUBSCRIBE: &str = "staking_subscribe";
pub const KIND_REWARD: &str = "staking_reward";
pub const KIND_REDEEM: &str = "staking_redeem";

#[derive(Clone)]
pub struct Wallet {
    http: reqwest::Client,
    base: String,
    token: String,
}

#[derive(Debug)]
pub enum WalletOutcome {
    Done(Value),
    /// The wallet refused (e.g. insufficient_funds): nothing was booked.
    Rejected { code: String, message: String },
    /// Network error / 5xx / 404 (route not deployed): unknown. Retry later with the same key.
    Unknown(String),
}

/// One wallet call.
pub struct Transfer<'a> {
    pub tenant: &'a str,
    pub key: &'a str,
    pub user_id: i64,
    pub direction: &'a str,
    pub kind: &'a str,
    pub currency: &'a str,
    pub amount: D,
    pub reference: &'a str,
    pub note: &'a str,
}

impl Wallet {
    pub fn new(http: reqwest::Client, base: &str, token: &str) -> Self {
        Wallet { http, base: base.trim_end_matches('/').to_string(), token: token.to_string() }
    }

    /// Books a wallet transfer once. `t.key` is the idempotency key (also the wallet_ops primary key).
    pub async fn transfer(&self, pool: &PgPool, t: Transfer<'_>) -> WalletOutcome {
        // record the intent first (idempotent), so a crash after the call is retried with the same key
        if let Err(e) = sqlx::query(
            "INSERT INTO wallet_ops (key, tenant, user_id, direction, kind, currency, amount, ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (key) DO NOTHING",
        )
        .bind(t.key)
        .bind(t.tenant)
        .bind(t.user_id)
        .bind(t.direction)
        .bind(t.kind)
        .bind(t.currency)
        .bind(t.amount)
        .bind(t.reference)
        .execute(pool)
        .await
        {
            return WalletOutcome::Unknown(format!("wallet_ops: {e}"));
        }
        let prior: Option<(String, Option<sqlx::types::Json<Value>>)> = sqlx::query_as("SELECT status, response FROM wallet_ops WHERE key = $1").bind(t.key).fetch_optional(pool).await.ok().flatten();
        if let Some((status, resp)) = &prior
            && status == "done"
        {
            return WalletOutcome::Done(resp.as_ref().map(|j| j.0.clone()).unwrap_or(Value::Null));
        }

        let body = json!({
            "idempotency_key": t.key, "user_id": t.user_id, "currency": t.currency, "amount": num(t.amount),
            "direction": t.direction, "kind": t.kind, "ref": t.reference, "note": t.note,
        });
        let res = self
            .http
            .post(format!("{}/v1/wallets/transfers", self.base))
            .header("x-ezymex-internal", &self.token)
            .header("x-ezymex-tenant", t.tenant)
            .header("x-ezymex-service", "staking")
            .json(&body)
            .send()
            .await;
        let outcome = match res {
            Err(e) => WalletOutcome::Unknown(format!("wallet unreachable: {}", e.without_url())),
            Ok(r) => {
                let status = r.status().as_u16();
                let v: Value = r.json().await.unwrap_or(Value::Null);
                if (200..300).contains(&status) {
                    WalletOutcome::Done(v)
                } else if status >= 500 || status == 429 || status == 404 {
                    // 404: the route isn't deployed yet; keep the operation pending
                    WalletOutcome::Unknown(format!("wallet HTTP {status}"))
                } else {
                    let code = v["error"]["code"].as_str().unwrap_or("rejected").to_string();
                    let message = v["error"]["message"].as_str().unwrap_or("The wallet refused the transfer").to_string();
                    WalletOutcome::Rejected { code, message }
                }
            }
        };
        let (status, resp) = match &outcome {
            WalletOutcome::Done(v) => ("done", v.clone()),
            WalletOutcome::Rejected { code, message } => ("rejected", json!({"code": code, "message": message})),
            WalletOutcome::Unknown(m) => ("pending", json!({"error": m})),
        };
        let _ = sqlx::query("UPDATE wallet_ops SET status = $2, response = $3, attempts = attempts + 1, updated_at = now() WHERE key = $1")
            .bind(t.key)
            .bind(status)
            .bind(sqlx::types::Json(resp))
            .execute(pool)
            .await;
        outcome
    }
}

/// The wallet transaction id of a booked transfer ("" when the response carries none).
pub fn txn_of(v: &Value) -> String {
    v["txn_id"].as_i64().map(|t| t.to_string()).or_else(|| v["txn_id"].as_str().map(str::to_string)).unwrap_or_default()
}

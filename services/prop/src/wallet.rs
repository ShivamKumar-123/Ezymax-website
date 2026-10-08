//! Wallet service client (services/wallet): `POST /v1/wallets/transfers` with
//! `{idempotency_key, user_id, currency:"USDT", amount, direction, kind, ref, note}` and
//! `X-Ezymex-Internal: $WALLET_INTERNAL_TOKEN`. Every call is recorded in `wallet_ops` first and retried with
//! the same key when the outcome is unknown, so nothing is charged or paid twice.

use serde_json::{Value, json};
use sqlx::PgPool;
use std::time::Duration;

use crate::money::{D, num};

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
    /// Network error / 5xx: unknown. Retry later with the same key.
    Unknown(String),
}

impl Wallet {
    pub fn new(base: &str, token: &str) -> Self {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(15)).build().expect("http client");
        Wallet { http, base: base.trim_end_matches('/').to_string(), token: token.to_string() }
    }

    /// Books a wallet transfer once. `key` is the idempotency key (also the wallet_ops primary key).
    #[allow(clippy::too_many_arguments)]
    pub async fn transfer(&self, pool: &PgPool, tenant: &str, key: &str, user_id: i64, direction: &str, kind: &str, amount: D, reference: &str, note: &str) -> WalletOutcome {
        // record intent (idempotent)
        let _ = sqlx::query(
            "INSERT INTO wallet_ops (key, tenant, user_id, direction, kind, amount, ref) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (key) DO NOTHING",
        )
        .bind(key)
        .bind(tenant)
        .bind(user_id)
        .bind(direction)
        .bind(kind)
        .bind(amount)
        .bind(reference)
        .execute(pool)
        .await;
        let prior: Option<(String, Option<sqlx::types::Json<Value>>)> =
            sqlx::query_as("SELECT status, response FROM wallet_ops WHERE key = $1").bind(key).fetch_optional(pool).await.ok().flatten();
        if let Some((status, resp)) = &prior {
            if status == "done" {
                return WalletOutcome::Done(resp.as_ref().map(|j| j.0.clone()).unwrap_or(Value::Null));
            }
        }

        let body = json!({
            "idempotency_key": key, "user_id": user_id, "currency": "USDT", "amount": num(amount),
            "direction": direction, "kind": kind, "ref": reference, "note": note,
        });
        let res = self
            .http
            .post(format!("{}/v1/wallets/transfers", self.base))
            .header("x-ezymex-internal", &self.token)
            .header("x-ezymex-tenant", tenant)
            .json(&body)
            .send()
            .await;
        let outcome = match res {
            Err(e) => WalletOutcome::Unknown(e.to_string()),
            Ok(r) => {
                let status = r.status().as_u16();
                let v: Value = r.json().await.unwrap_or(Value::Null);
                if (200..300).contains(&status) {
                    WalletOutcome::Done(v)
                } else if status >= 500 || status == 429 {
                    WalletOutcome::Unknown(format!("wallet HTTP {status}"))
                } else {
                    let code = v["error"]["code"].as_str().unwrap_or("rejected").to_string();
                    // a replay of a key the wallet already booked is a success
                    if status == 409 && (code == "duplicate" || code == "already_processed" || code == "duplicate_idempotency_key") {
                        WalletOutcome::Done(v)
                    } else {
                        let message = v["error"]["message"].as_str().unwrap_or("The wallet refused the transfer").to_string();
                        WalletOutcome::Rejected { code, message }
                    }
                }
            }
        };
        let (status, resp) = match &outcome {
            WalletOutcome::Done(v) => ("done", v.clone()),
            WalletOutcome::Rejected { code, message } => ("rejected", json!({"code": code, "message": message})),
            WalletOutcome::Unknown(m) => ("pending", json!({"error": m})),
        };
        let _ = sqlx::query("UPDATE wallet_ops SET status = $2, response = $3, attempts = attempts + 1, updated_at = now() WHERE key = $1")
            .bind(key)
            .bind(status)
            .bind(sqlx::types::Json(resp))
            .execute(pool)
            .await;
        outcome
    }
}

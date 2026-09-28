//! Wallet ↔ trading account transfers (for the wallet service, D3/D36). Idempotent on `idempotencyKey`:
//! repeating a request returns the original result; reusing a key for a different request is a 409.

use axum::Json;
use axum::extract::{Path, State};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{ApiError, ApiResult, AppState, Body, Ctx};
use crate::engine::funds::{self, Direction};
use crate::money::{D, de_dec, num, r2};
use crate::shard::{ExecError, Op};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferReq {
    idempotency_key: String,
    login: i64,
    /// USD (cent accounts are credited ×100 in USC).
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    /// `in` = wallet → trading account, `out` = trading account → wallet.
    direction: String,
    #[serde(default, rename = "ref")]
    reference: Option<String>,
}

async fn lookup(st: &AppState, tenant: i64, key: &str) -> ApiResult<Option<Value>> {
    let r = sqlx::query(
        "SELECT t.id, t.kind, t.login, t.reference, t.request, t.created_at,
                (SELECT amount FROM ledger_postings p WHERE p.txn_id = t.id AND p.account_code = 'acct:' || t.login || ':balance') AS amount,
                (SELECT currency FROM ledger_postings p WHERE p.txn_id = t.id AND p.account_code = 'acct:' || t.login || ':balance') AS currency
         FROM ledger_txns t WHERE t.tenant_id = $1 AND t.idempotency_key = $2",
    )
    .bind(tenant)
    .bind(key)
    .fetch_optional(&st.pool)
    .await?;
    Ok(r.map(|r| {
        json!({
            "txn": r.get::<i64, _>("id"),
            "kind": r.get::<String, _>("kind"),
            "login": r.get::<i64, _>("login"),
            "reference": r.get::<Option<String>, _>("reference"),
            "amount": crate::money::num_opt(r.get::<Option<D>, _>("amount").map(|a| a.abs())),
            "currency": r.get::<Option<String>, _>("currency"),
            "request": r.get::<Option<sqlx::types::Json<Value>>, _>("request").map(|j| j.0),
            "at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        })
    }))
}

fn replay(existing: Value, fingerprint: &Value) -> ApiResult<Json<Value>> {
    if existing.get("request") != Some(fingerprint) {
        return Err(ApiError::Conflict { code: "idempotency_conflict", message: "This idempotency key was used for a different transfer".into() });
    }
    let mut v = existing;
    v["status"] = json!("completed");
    v["replayed"] = json!(true);
    if let Some(o) = v.as_object_mut() {
        o.remove("request");
    }
    Ok(Json(v))
}

pub async fn transfer(State(st): State<AppState>, ctx: Ctx, Body(r): Body<TransferReq>) -> ApiResult<Json<Value>> {
    let key = r.idempotency_key.trim().to_string();
    if key.is_empty() || key.len() > 128 {
        return Err(ApiError::Validation { field: "idempotencyKey", message: "idempotencyKey must be 1–128 characters".into() });
    }
    let dir = match r.direction.as_str() {
        "in" => Direction::In,
        "out" => Direction::Out,
        _ => return Err(ApiError::Validation { field: "direction", message: "direction must be in or out".into() }),
    };
    let amount = r2(r.amount);
    if amount <= D::ZERO || amount != r.amount {
        return Err(ApiError::Validation { field: "amount", message: "amount must be above 0 with at most 2 decimals".into() });
    }
    let key = format!("transfer:{key}");
    let fingerprint = json!({"login": r.login, "amount": amount.to_string(), "direction": r.direction});
    if let Some(existing) = lookup(&st, ctx.tenant.tenant_id, &key).await? {
        return replay(existing, &fingerprint);
    }
    let meta = st.hub.meta(r.login).filter(|m| m.tenant_id == ctx.tenant.tenant_id).ok_or_else(|| ApiError::NotFound("Account not found".into()))?;
    let reference = r.reference.clone();
    let k2 = key.clone();
    let op: Op = Box::new(move |tx, env| {
        let (txn, credited) = funds::transfer(tx, env, dir, amount, &k2, reference)?;
        Ok(json!({"txn": txn, "amount": num(credited), "currency": tx.st.account.ccy(), "balance": num(tx.st.balance)}))
    });
    match st.hub.exec(r.login, "wallet", None, "", "", Some(fingerprint.clone()), op).await {
        Ok(done) => {
            let mut v = done.value;
            v["status"] = json!("completed");
            v["login"] = json!(r.login);
            v["userId"] = json!(meta.user_id);
            v["direction"] = json!(r.direction);
            v["replayed"] = json!(false);
            tracing::info!(login = r.login, direction = %r.direction, amount = %amount, "wallet transfer");
            Ok(Json(v))
        }
        // a concurrent request with the same key committed first
        Err(ExecError::Duplicate(_)) => match lookup(&st, ctx.tenant.tenant_id, &key).await? {
            Some(existing) => replay(existing, &fingerprint),
            None => Err(ApiError::Conflict { code: "idempotency_conflict", message: "Duplicate idempotency key".into() }),
        },
        Err(e) => Err(e.into()),
    }
}

pub async fn transfer_status(State(st): State<AppState>, ctx: Ctx, Path(key): Path<String>) -> ApiResult<Json<Value>> {
    let v = lookup(&st, ctx.tenant.tenant_id, &format!("transfer:{}", key.trim())).await?.ok_or_else(|| ApiError::NotFound("No transfer with this key".into()))?;
    Ok(Json(v))
}

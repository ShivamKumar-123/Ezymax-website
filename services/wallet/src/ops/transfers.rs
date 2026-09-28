//! `POST /v1/wallets/transfers`: credits / debits by other services (IB, prop, PAMM, copy) and Back Office
//! adjustments. Idempotent on the caller's key: same key + same body → the stored result; different body → 409.

use chrono::Utc;
use serde_json::{Value, json};
use sqlx::Row;

use super::{clean_text, notify};
use crate::error::{ApiError, ApiResult};
use crate::ledger::{self, Leg, NewTxn, PostError};
use crate::money::{D, WALLET_DP, check_amount, s};
use crate::state::AppState;

pub const KINDS: &[&str] = &["commission", "ib_payout", "prop_purchase", "prop_payout", "pamm_invest", "pamm_redeem", "copy_fee", "adjustment", "refund"];
pub const CURRENCIES: &[&str] = &["USDT"];

pub fn kind_label(kind: &str) -> &'static str {
    match kind {
        "commission" => "Commission",
        "ib_payout" => "Partner payout",
        "prop_purchase" => "Prop challenge purchase",
        "prop_payout" => "Prop payout",
        "pamm_invest" => "PAMM investment",
        "pamm_redeem" => "PAMM redemption",
        "copy_fee" => "Copy trading fee",
        "adjustment" => "Balance adjustment",
        "refund" => "Refund",
        "deposit" => "Deposit",
        "withdrawal" => "Withdrawal",
        _ => "Wallet transaction",
    }
}

#[derive(Clone, Debug)]
pub struct TransferReq {
    pub idempotency_key: String,
    pub user_id: i64,
    pub currency: String,
    pub amount: D,
    pub direction: String,
    pub kind: String,
    pub reference: Option<String>,
    pub note: Option<String>,
}

/// Validates and books a transfer. `key_ns` separates the key space (`ext` for services, `adj` for staff).
pub async fn transfer(st: &AppState, tenant_id: i64, actor: &str, key_ns: &str, r: TransferReq) -> ApiResult<Value> {
    let key = r.idempotency_key.trim();
    if key.is_empty() || key.len() > 128 {
        return Err(ApiError::validation("idempotency_key", "idempotency_key must be 1–128 characters"));
    }
    if r.user_id <= 0 {
        return Err(ApiError::validation("user_id", "user_id must be a positive integer"));
    }
    if !CURRENCIES.contains(&r.currency.as_str()) {
        return Err(ApiError::validation("currency", "currency must be USDT"));
    }
    if !KINDS.contains(&r.kind.as_str()) {
        return Err(ApiError::validation("kind", format!("kind must be one of {}", KINDS.join(", "))));
    }
    let credit = match r.direction.as_str() {
        "credit" => true,
        "debit" => false,
        _ => return Err(ApiError::validation("direction", "direction must be credit or debit")),
    };
    let amount = check_amount(r.amount, WALLET_DP).map_err(|m| ApiError::validation("amount", m))?;
    let reference = clean_text(r.reference.as_deref(), 128);
    let note = clean_text(r.note.as_deref(), 500);
    let full_key = format!("{key_ns}:{key}");
    let fingerprint = json!({
        "user_id": r.user_id, "currency": r.currency, "amount": s(amount), "direction": r.direction,
        "kind": r.kind, "ref": reference, "note": note,
    });
    if let Some(v) = replay(st, tenant_id, &full_key, &fingerprint).await? {
        return Ok(v);
    }

    let ccy = r.currency.clone();
    let signed = if credit { amount } else { -amount };
    let legs = vec![Leg::available(r.user_id, &ccy, signed), Leg::sys(&ccy, &r.kind, -signed)];
    let mut tx = st.pool.begin().await?;
    let (kind, direction, user_id) = (r.kind.clone(), r.direction.clone(), r.user_id);
    let (reference2, note2) = (reference.clone(), note.clone());
    let posted = ledger::post_with(
        &mut tx,
        NewTxn {
            tenant_id,
            key: full_key.clone(),
            kind: r.kind.clone(),
            user_id: Some(r.user_id),
            currency: ccy.clone(),
            reference: reference.clone(),
            note: note.clone(),
            actor: actor.to_string(),
            request: Some(fingerprint.clone()),
            legs,
        },
        |id, after| {
            let (a, l) = after.get(&user_id).copied().unwrap_or_default();
            Some(json!({
                "status": "completed", "txn_id": id, "user_id": user_id, "currency": ccy, "amount": s(amount),
                "direction": direction, "kind": kind, "ref": reference2, "note": note2,
                "balance": {"available": s(a), "locked": s(l)}, "created_at": Utc::now(),
            }))
        },
    )
    .await;
    match posted {
        Ok((id, _)) => {
            if credit {
                let label = kind_label(&r.kind);
                notify(&mut tx, tenant_id, r.user_id, "wallet.credit", &format!("{label} credited"), &format!("{} USDT was added to your wallet.", s(amount)), json!({"txn_id": id, "kind": r.kind})).await?;
            }
            tx.commit().await?;
            tracing::info!(tenant_id, user_id = r.user_id, kind = %r.kind, direction = %r.direction, amount = %amount, actor, "wallet transfer");
            let mut v = stored(st, tenant_id, &full_key).await?.map(|x| x.1).unwrap_or(Value::Null);
            v["replayed"] = json!(false);
            Ok(v)
        }
        Err(PostError::Duplicate) => {
            drop(tx);
            replay(st, tenant_id, &full_key, &fingerprint).await?.ok_or_else(|| ApiError::conflict("idempotency_conflict", "Duplicate idempotency key"))
        }
        Err(PostError::Insufficient) => {
            drop(tx);
            // a concurrent request with the same key may have won; otherwise a real shortfall
            match replay(st, tenant_id, &full_key, &fingerprint).await? {
                Some(v) => Ok(v),
                None => Err(ApiError::insufficient()),
            }
        }
        Err(e) => Err(e.into()),
    }
}

async fn stored(st: &AppState, tenant_id: i64, full_key: &str) -> ApiResult<Option<(Value, Value)>> {
    let r = sqlx::query("SELECT request, result FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(tenant_id).bind(full_key).fetch_optional(&st.pool).await?;
    Ok(r.map(|r| {
        (
            r.get::<Option<sqlx::types::Json<Value>>, _>("request").map(|j| j.0).unwrap_or(Value::Null),
            r.get::<Option<sqlx::types::Json<Value>>, _>("result").map(|j| j.0).unwrap_or(Value::Null),
        )
    }))
}

async fn replay(st: &AppState, tenant_id: i64, full_key: &str, fingerprint: &Value) -> ApiResult<Option<Value>> {
    match stored(st, tenant_id, full_key).await? {
        None => Ok(None),
        Some((req, _)) if &req != fingerprint => Err(ApiError::conflict("idempotency_conflict", "This idempotency key was used for a different transfer")),
        Some((_, mut res)) => {
            res["replayed"] = json!(true);
            Ok(Some(res))
        }
    }
}

/// `GET /v1/wallets/transfers/{key}`.
pub async fn lookup(st: &AppState, tenant_id: i64, key: &str) -> ApiResult<Value> {
    let (_, mut res) = stored(st, tenant_id, &format!("ext:{}", key.trim())).await?.ok_or_else(|| ApiError::not_found("Transfer"))?;
    res["replayed"] = json!(true);
    Ok(res)
}

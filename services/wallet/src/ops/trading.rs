//! Wallet <-> trading account transfers (D3, D24), two-phase safe:
//!
//! - to-trading: reserve in the wallet (available → locked) and record the transfer `pending` in one
//!   database transaction → engine `POST /v1/ledger/transfers direction=in` → commit (locked → sys:trading) on
//!   success, release (locked → available) on a definite engine rejection.
//! - from-trading: record `pending` → engine `direction=out` → credit the wallet on success.
//! - No definite engine answer (timeout / 5xx): the transfer stays `pending`; [`recover`] asks the engine for
//!   the key and settles, or re-sends the same idempotent request. Ledger keys are unique per step, so a step
//!   can never be booked twice.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::notify;
use crate::engine::{EngineError, EngineTransfer};
use crate::error::{ApiError, ApiResult};
use crate::ledger::{self, Leg, NewTxn, PostError};
use crate::money::{D, ENGINE_DP, check_amount, s, s_opt};
use crate::state::{AppState, Ctx};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Dir {
    ToTrading,
    FromTrading,
}

impl Dir {
    pub fn as_str(self) -> &'static str {
        match self {
            Dir::ToTrading => "to_trading",
            Dir::FromTrading => "from_trading",
        }
    }
    fn engine(self) -> &'static str {
        match self {
            Dir::ToTrading => "in",
            Dir::FromTrading => "out",
        }
    }
}

pub fn transfer_json(r: &PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"),
        "user_id": r.get::<i64, _>("user_id"),
        "login": r.get::<i64, _>("login"),
        "direction": r.get::<String, _>("direction"),
        "currency": r.get::<String, _>("currency"),
        "amount": s(r.get::<D, _>("amount")),
        "idempotency_key": r.get::<String, _>("idempotency_key"),
        "status": r.get::<String, _>("status"),
        "error_code": r.get::<Option<String>, _>("error_code"),
        "error_message": r.get::<Option<String>, _>("error_message"),
        "engine_amount": s_opt(r.get::<Option<D>, _>("engine_amount")),
        "engine_currency": r.get::<Option<String>, _>("engine_currency"),
        "created_at": r.get::<DateTime<Utc>, _>("created_at"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

pub async fn start(st: &AppState, ctx: &Ctx, user_id: i64, dir: Dir, login: i64, amount: D, key: &str) -> ApiResult<Value> {
    let tenant_id = ctx.tenant.id;
    let key = key.trim();
    if key.is_empty() || key.len() > 128 {
        return Err(ApiError::validation("idempotency_key", "idempotency_key must be 1–128 characters"));
    }
    let amount = check_amount(amount, ENGINE_DP).map_err(|m| ApiError::validation("amount", m))?;
    if let Some(r) = sqlx::query("SELECT * FROM trading_transfers WHERE tenant_id = $1 AND idempotency_key = $2").bind(tenant_id).bind(key).fetch_optional(&st.pool).await? {
        let same = r.get::<i64, _>("user_id") == user_id && r.get::<i64, _>("login") == login && r.get::<D, _>("amount") == amount && r.get::<String, _>("direction") == dir.as_str();
        if !same {
            return Err(ApiError::conflict("idempotency_conflict", "This idempotency key was used for a different transfer"));
        }
        if r.get::<String, _>("status") == "pending" {
            settle_pending(st, r.get("id")).await;
            let r = sqlx::query("SELECT * FROM trading_transfers WHERE id = $1").bind(r.get::<i64, _>("id")).fetch_one(&st.pool).await?;
            return Ok(transfer_json(&r));
        }
        return Ok(transfer_json(&r));
    }

    // D24: only the client's own live accounts
    let accounts = st.engine.accounts(&ctx.tenant.slug, user_id).await.map_err(|e| match e {
        EngineError::Unavailable(_) => ApiError::Coded { status: axum::http::StatusCode::SERVICE_UNAVAILABLE, code: "unavailable", message: "The trading service is unavailable. Please try again shortly.".into() },
        EngineError::Rejected { message, .. } => ApiError::Coded { status: axum::http::StatusCode::BAD_GATEWAY, code: "engine_error", message },
    })?;
    let acct = accounts.iter().find(|a| a.login == login).ok_or_else(|| ApiError::unprocessable("not_own_account", "This trading account doesn't belong to you"))?;
    if acct.kind != "live" {
        return Err(ApiError::unprocessable("not_own_account", "Transfers are only possible to and from live accounts"));
    }

    let mut tx = st.pool.begin().await?;
    let id: i64 = sqlx::query_scalar("SELECT nextval(pg_get_serial_sequence('trading_transfers', 'id'))").fetch_one(&mut *tx).await?;
    let engine_key = format!("wallet-{tenant_id}-tt{id}");
    let inserted = sqlx::query(
        "INSERT INTO trading_transfers (id, tenant_id, user_id, login, direction, amount, idempotency_key, engine_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') ON CONFLICT (tenant_id, idempotency_key) DO NOTHING",
    )
    .bind(id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(login)
    .bind(dir.as_str())
    .bind(amount)
    .bind(key)
    .bind(&engine_key)
    .execute(&mut *tx)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(ApiError::conflict("in_progress", "This transfer is already being processed"));
    }
    if dir == Dir::ToTrading {
        let reserve = ledger::post(
            &mut tx,
            NewTxn {
                tenant_id,
                key: format!("tt:{id}:reserve"),
                kind: "trading_reserve".into(),
                user_id: Some(user_id),
                currency: "USDT".into(),
                reference: Some(format!("#{login}")),
                note: Some(format!("Transfer to trading account #{login}")),
                actor: format!("user:{user_id}"),
                request: None,
                legs: vec![Leg::available(user_id, "USDT", -amount), Leg::locked(user_id, "USDT", amount)],
            },
        )
        .await;
        match reserve {
            Ok(t) => {
                sqlx::query("UPDATE trading_transfers SET reserve_txn_id = $2 WHERE id = $1").bind(id).bind(t).execute(&mut *tx).await?;
            }
            Err(PostError::Insufficient) => return Err(ApiError::insufficient()),
            Err(e) => return Err(e.into()),
        }
    }
    tx.commit().await?;

    let outcome = st.engine.transfer(&ctx.tenant.slug, &engine_key, login, amount, dir.engine(), &format!("wallet:tt{id}")).await;
    settle(st, id, outcome).await?;
    let r = sqlx::query("SELECT * FROM trading_transfers WHERE id = $1").bind(id).fetch_one(&st.pool).await?;
    let status: String = r.get("status");
    if status == "failed" {
        let code = r.get::<Option<String>, _>("error_code").unwrap_or_default();
        let msg = r.get::<Option<String>, _>("error_message").unwrap_or_else(|| "The transfer was refused".into());
        return Err(match code.as_str() {
            "insufficient_funds" | "no_money" => ApiError::unprocessable("insufficient_funds", format!("Not enough withdrawable funds on #{login}: {msg}")),
            _ => ApiError::unprocessable("engine_rejected", msg),
        });
    }
    Ok(transfer_json(&r))
}

/// Applies the engine's answer to a pending transfer. Idempotent; concurrent callers are serialised.
pub async fn settle(st: &AppState, id: i64, outcome: Result<EngineTransfer, EngineError>) -> anyhow::Result<()> {
    let _g = st.transfer_lock.lock().await;
    let mut tx = st.pool.begin().await?;
    let Some(r) = sqlx::query("SELECT * FROM trading_transfers WHERE id = $1 AND status = 'pending' FOR UPDATE").bind(id).fetch_optional(&mut *tx).await? else { return Ok(()) };
    let (tenant_id, user_id, login): (i64, i64, i64) = (r.get("tenant_id"), r.get("user_id"), r.get("login"));
    let amount: D = r.get("amount");
    let dir = if r.get::<String, _>("direction") == "to_trading" { Dir::ToTrading } else { Dir::FromTrading };
    match outcome {
        Ok(done) => {
            let (key, legs, note) = match dir {
                Dir::ToTrading => (format!("tt:{id}:commit"), vec![Leg::locked(user_id, "USDT", -amount), Leg::sys("USDT", "trading", amount)], format!("Transfer to trading account #{login}")),
                Dir::FromTrading => (format!("tt:{id}:credit"), vec![Leg::sys("USDT", "trading", -amount), Leg::available(user_id, "USDT", amount)], format!("Transfer from trading account #{login}")),
            };
            let t = ledger::post(
                &mut tx,
                NewTxn { tenant_id, key: key.clone(), kind: dir.as_str().into(), user_id: Some(user_id), currency: "USDT".into(), reference: Some(format!("#{login}")), note: Some(note), actor: format!("user:{user_id}"), request: None, legs },
            )
            .await;
            let t = match t {
                Ok(t) => t,
                Err(PostError::Duplicate) => sqlx::query_scalar("SELECT id FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(tenant_id).bind(&key).fetch_one(&st.pool).await?,
                Err(PostError::Insufficient) => anyhow::bail!("trading transfer {id}: reserved funds missing"),
                Err(PostError::Db(e)) => return Err(e),
            };
            sqlx::query("UPDATE trading_transfers SET status = 'completed', final_txn_id = $2, engine_txn = $3, engine_amount = $4, engine_currency = $5, attempts = attempts + 1, updated_at = now() WHERE id = $1")
                .bind(id)
                .bind(t)
                .bind(done.txn)
                .bind(done.amount)
                .bind(done.currency)
                .execute(&mut *tx)
                .await?;
            let (title, body) = match dir {
                Dir::ToTrading => ("Transfer completed", format!("{} USDT moved from your wallet to account #{login}.", s(amount))),
                Dir::FromTrading => ("Transfer completed", format!("{} USD moved from account #{login} to your wallet.", s(amount))),
            };
            notify(&mut tx, tenant_id, user_id, "transfer.completed", title, &body, json!({"transfer_id": id, "login": login, "direction": dir.as_str()})).await?;
            tx.commit().await?;
            tracing::info!(transfer = id, tenant_id, user_id, login, direction = dir.as_str(), amount = %amount, "trading transfer completed");
        }
        Err(EngineError::Rejected { status, code, message }) => {
            let mut final_txn = None;
            if dir == Dir::ToTrading {
                let key = format!("tt:{id}:release");
                let t = ledger::post(
                    &mut tx,
                    NewTxn {
                        tenant_id,
                        key: key.clone(),
                        kind: "trading_release".into(),
                        user_id: Some(user_id),
                        currency: "USDT".into(),
                        reference: Some(format!("#{login}")),
                        note: Some("Transfer refused by the trading engine".into()),
                        actor: "system".into(),
                        request: None,
                        legs: vec![Leg::locked(user_id, "USDT", -amount), Leg::available(user_id, "USDT", amount)],
                    },
                )
                .await;
                final_txn = match t {
                    Ok(t) => Some(t),
                    Err(PostError::Duplicate) => sqlx::query_scalar("SELECT id FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(tenant_id).bind(&key).fetch_optional(&st.pool).await?,
                    Err(PostError::Insufficient) => anyhow::bail!("trading transfer {id}: reserved funds missing"),
                    Err(PostError::Db(e)) => return Err(e),
                };
            }
            sqlx::query("UPDATE trading_transfers SET status = 'failed', error_code = $2, error_message = $3, final_txn_id = $4, attempts = attempts + 1, updated_at = now() WHERE id = $1")
                .bind(id)
                .bind(&code)
                .bind(message.chars().take(300).collect::<String>())
                .bind(final_txn)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            tracing::info!(transfer = id, status, %code, "trading transfer refused by the engine");
        }
        Err(EngineError::Unavailable(why)) => {
            sqlx::query("UPDATE trading_transfers SET attempts = attempts + 1, error_message = $2, updated_at = now() WHERE id = $1").bind(id).bind(format!("engine: {why}")).execute(&mut *tx).await?;
            tx.commit().await?;
            tracing::warn!(transfer = id, %why, "trading transfer outcome unknown; recovery will settle it");
        }
    }
    Ok(())
}

/// Settles one pending transfer: asks the engine for the key, re-sends the idempotent request if unknown.
pub async fn settle_pending(st: &AppState, id: i64) {
    let Ok(Some(r)) = sqlx::query("SELECT * FROM trading_transfers WHERE id = $1 AND status = 'pending'").bind(id).fetch_optional(&st.pool).await else { return };
    let tenant = st.tenants.slug_of(r.get("tenant_id")).unwrap_or_else(|| "kalks".into());
    let key: String = r.get("engine_key");
    let outcome = match st.engine.transfer_status(&tenant, &key).await {
        Ok(Some(done)) => Ok(done),
        Ok(None) => {
            let dir = if r.get::<String, _>("direction") == "to_trading" { "in" } else { "out" };
            st.engine.transfer(&tenant, &key, r.get("login"), r.get("amount"), dir, &format!("wallet:tt{id}")).await
        }
        Err(e) => Err(e),
    };
    if let Err(e) = settle(st, id, outcome).await {
        tracing::error!(transfer = id, error = %e, "settling a trading transfer failed");
    }
}

/// Recovery loop step: every transfer pending for more than `min_age_secs`.
pub async fn recover(st: &AppState, min_age_secs: i64) -> anyhow::Result<usize> {
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM trading_transfers WHERE status = 'pending' AND updated_at < now() - make_interval(secs => $1) ORDER BY id LIMIT 100")
        .bind(min_age_secs as f64)
        .fetch_all(&st.pool)
        .await?;
    for id in &ids {
        settle_pending(st, *id).await;
    }
    Ok(ids.len())
}

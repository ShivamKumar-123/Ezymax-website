//! Withdrawals (D11, D36): request (locks funds; KYC gate, limits, fees, post-deposit cooldown) → approve /
//! reject (staff) → paid → completed. The client can cancel while `requested`.
//!
//! Two ways out, picked by `method` and priced the same way (tenant flat + percentage fee, plus whatever the
//! destination itself costs):
//!
//! * `crypto` — USDT to the client's own wallet. Staff enter the payout hash and the watcher verifies on chain
//!   that a company address really sent the net amount, so `paid` is a claim the chain has to confirm.
//! * `upi` — INR to the client's own UPI ID, for clients who funded in rupees and have no wallet. There is no
//!   chain to ask, so staff pay out of band and record the bank reference: `paid` completes it then and there.
//!   The INR figure is frozen when the client asks (`payout_amount`), so a later rate change cannot move what
//!   they were promised.

use chrono::{DateTime, Duration, FixedOffset, TimeZone, Utc};
use serde_json::{Value, json};
use sqlx::postgres::PgRow;
use sqlx::{Postgres, Row, Transaction};

use super::{notify, record_ip};
use crate::audit::{self, Entry};
use crate::chain::{ChainId, TxStatus, confirmations};
use crate::error::{ApiError, ApiResult};
use crate::ledger::{self, Leg, NewTxn, PostError};
use crate::money::{D, ENGINE_DP, ceil_dp, check_amount, floor_dp, s, s_opt};
use crate::settings::{self, Limits};
use crate::state::{AppState, Ctx, StaffCtx};

/// A payout hash that is still not on chain after this long is rejected (the withdrawal returns to approved).
const PAYOUT_NOT_FOUND_HOURS: i64 = 6;

pub fn withdrawal_json(r: &PgRow) -> Value {
    // `chain` is NULL for every off-chain method, so there is nothing to fall back to and nothing to show.
    let chain = r.get::<Option<String>, _>("chain").and_then(|c| ChainId::parse(&c));
    let hash: Option<String> = r.get("payout_tx_hash");
    json!({
        "id": r.get::<i64, _>("id"),
        "user_id": r.get::<i64, _>("user_id"),
        "method": r.get::<String, _>("method"),
        "chain": chain.map(|c| c.as_str()),
        "network": chain.map(|c| c.network()),
        "currency": r.get::<String, _>("currency"),
        "to_address": r.get::<String, _>("to_address"),
        "amount": s(r.get::<D, _>("amount")),
        "fee": s(r.get::<D, _>("fee")),
        "net_amount": s(r.get::<D, _>("net_amount")),
        "status": r.get::<String, _>("status"),
        "kyc_status": r.get::<Option<String>, _>("kyc_status"),
        "reason": r.get::<Option<String>, _>("reason"),
        "review_note": r.get::<Option<String>, _>("review_note"),
        "reviewed_by": r.get::<Option<String>, _>("reviewed_by"),
        "reviewed_at": r.get::<Option<DateTime<Utc>>, _>("reviewed_at"),
        "payout_tx_hash": hash,
        "explorer_url": hash.as_deref().zip(chain).map(|(h, c)| c.explorer_tx(h)),
        "payout_reference": r.get::<Option<String>, _>("payout_reference"),
        "payout_currency": r.get::<Option<String>, _>("payout_currency"),
        "payout_amount": s_opt(r.get::<Option<D>, _>("payout_amount")),
        "payout_rate": s_opt(r.get::<Option<D>, _>("payout_rate")),
        "payout_error": r.get::<Option<String>, _>("payout_error"),
        "payout_sender_unverified": r.get::<bool, _>("payout_sender_unverified"),
        "payout_confirmations": r.get::<i32, _>("payout_confirmations"),
        "paid_by": r.get::<Option<String>, _>("paid_by"),
        "paid_at": r.get::<Option<DateTime<Utc>>, _>("paid_at"),
        "completed_at": r.get::<Option<DateTime<Utc>>, _>("completed_at"),
        "ip": r.get::<Option<String>, _>("ip"),
        "created_at": r.get::<DateTime<Utc>, _>("created_at"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at"),
    })
}

/// Client view (no staff identities / internal notes).
pub fn client_json(r: &PgRow) -> Value {
    let mut v = withdrawal_json(r);
    if let Some(o) = v.as_object_mut() {
        for k in ["reviewed_by", "paid_by", "review_note", "ip", "kyc_status", "payout_error"] {
            o.remove(k);
        }
    }
    v
}

/// Withdrawal fee: flat + percentage (rounded up to cents) + whatever the destination costs — a chain's network
/// fee, or an off-chain method's own flat fee.
pub fn fee_for(limits: &Limits, dest_fee: D, amount: D) -> D {
    limits.withdraw_fee_flat + ceil_dp(amount * limits.withdraw_fee_pct / D::ONE_HUNDRED, ENGINE_DP) + dest_fee
}

/// A UPI ID (`name@bank`), lower-cased, or `None` when it cannot be one. NPCI allows letters, digits, dot,
/// hyphen and underscore before the `@` and an alphanumeric handle after it; this refuses the rest rather than
/// letting staff chase a payment that was never going to arrive.
pub fn normalize_upi_id(raw: &str) -> Option<String> {
    let v = raw.trim().to_ascii_lowercase();
    if !(3..=255).contains(&v.len()) {
        return None;
    }
    let (local, psp) = v.split_once('@')?;
    if psp.contains('@') {
        return None;
    }
    let ok_local = (1..=191).contains(&local.len())
        && local.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        && local.starts_with(|c: char| c.is_ascii_alphanumeric());
    let ok_psp = (2..=64).contains(&psp.len()) && psp.chars().all(|c| c.is_ascii_alphanumeric()) && psp.starts_with(|c: char| c.is_ascii_alphabetic());
    (ok_local && ok_psp).then_some(v)
}

/// Start of the current server day (GMT+3) in UTC.
pub fn server_day_start(now: DateTime<Utc>) -> DateTime<Utc> {
    let tz = FixedOffset::east_opt(3 * 3600).expect("offset");
    let local = now.with_timezone(&tz).date_naive().and_hms_opt(0, 0, 0).expect("midnight");
    tz.from_local_datetime(&local).single().expect("unambiguous").with_timezone(&Utc)
}

/// Withdrawn today (not rejected / cancelled), for the daily limit.
pub async fn used_today(pool: &sqlx::PgPool, tenant_id: i64, user_id: i64) -> sqlx::Result<D> {
    let v: Option<D> = sqlx::query_scalar("SELECT sum(amount) FROM withdrawals WHERE tenant_id = $1 AND user_id = $2 AND status NOT IN ('rejected', 'cancelled') AND created_at >= $3")
        .bind(tenant_id)
        .bind(user_id)
        .bind(server_day_start(Utc::now()))
        .fetch_one(pool)
        .await?;
    Ok(v.unwrap_or_default())
}

/// Until when the post-deposit cooldown blocks withdrawals (None = not blocked).
pub async fn cooldown_until(pool: &sqlx::PgPool, tenant_id: i64, user_id: i64, hours: i32) -> sqlx::Result<Option<DateTime<Utc>>> {
    if hours <= 0 {
        return Ok(None);
    }
    let last: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT max(credited_at) FROM deposits WHERE tenant_id = $1 AND user_id = $2 AND status = 'credited'").bind(tenant_id).bind(user_id).fetch_one(pool).await?;
    Ok(last.map(|t| t + Duration::hours(hours as i64)).filter(|u| *u > Utc::now()))
}

pub struct RequestIn {
    pub user_id: i64,
    pub amount: D,
    /// `crypto` (the default, for older callers) or `upi`.
    pub method: String,
    /// Crypto only.
    pub chain: String,
    /// The client's wallet address, or their UPI ID.
    pub to_address: String,
    pub idempotency_key: Option<String>,
}

pub async fn request(st: &AppState, ctx: &Ctx, r: RequestIn) -> ApiResult<Value> {
    check_or_request(st, ctx, r, false).await
}

/// Runs every check of a withdrawal request (KYC, limits, cooldown, balance) without locking anything and
/// returns the fee / net amount: the CRM calls it before asking for the step-up code.
pub async fn quote(st: &AppState, ctx: &Ctx, r: RequestIn) -> ApiResult<Value> {
    check_or_request(st, ctx, r, true).await
}

async fn check_or_request(st: &AppState, ctx: &Ctx, r: RequestIn, dry_run: bool) -> ApiResult<Value> {
    let tenant_id = ctx.tenant.id;
    if r.user_id <= 0 {
        return Err(ApiError::validation("user_id", "user_id is required"));
    }
    let method = match r.method.trim().to_ascii_lowercase().as_str() {
        "" | "crypto" => "crypto",
        "upi" => "upi",
        _ => return Err(ApiError::validation("method", "method must be crypto or upi")),
    };
    let amount = check_amount(r.amount, ENGINE_DP).map_err(|m| ApiError::validation("amount", m))?;
    let key = r.idempotency_key.as_deref().map(str::trim).filter(|k| !k.is_empty()).map(str::to_string);
    if key.as_ref().is_some_and(|k| k.len() > 128) {
        return Err(ApiError::validation("idempotency_key", "idempotency_key must be at most 128 characters"));
    }
    // Where it goes, what the destination adds to the fee, and - off chain only - the method that prices it.
    let (chain, to, dest_fee, off_chain) = match method {
        "upi" => {
            let to = normalize_upi_id(&r.to_address).ok_or_else(|| ApiError::validation("to_address", "Enter your UPI ID, for example name@bank"))?;
            let m = settings::withdraw_method(&st.pool, tenant_id, "upi")
                .await?
                .filter(|m| m.usable())
                .ok_or_else(|| ApiError::unprocessable("method_disabled", "UPI withdrawals are not available right now"))?;
            (None, to, m.fee_flat, Some(m))
        }
        _ => {
            let chain = ChainId::parse(&r.chain).ok_or_else(|| ApiError::validation("chain", "chain must be bsc or tron"))?;
            let to = chain.normalize_address(&r.to_address).ok_or_else(|| {
                ApiError::validation("to_address", match chain {
                    ChainId::Bsc => "Enter a BNB Chain address (0x followed by 40 hexadecimal characters)",
                    ChainId::Tron => "Enter a valid TRON address (starts with T, 34 characters)",
                })
            })?;
            let cfg = settings::chain(&st.pool, tenant_id, chain).await?.filter(|c| c.withdrawals_enabled).ok_or_else(|| ApiError::unprocessable("chain_disabled", format!("Withdrawals on {} are not available", chain.network())))?;
            if settings::company_addresses(&st.pool, tenant_id, chain).await?.contains(&to) {
                return Err(ApiError::validation("to_address", "This is a Ezymex deposit address. Enter your own wallet address."));
            }
            (Some(chain), to, cfg.withdraw_fee, None)
        }
    };
    // The replay check compares the normalised destination, so it has to wait until we have one.
    if let Some(k) = key.as_ref().filter(|_| !dry_run)
        && let Some(w) = sqlx::query("SELECT * FROM withdrawals WHERE tenant_id = $1 AND idempotency_key = $2").bind(tenant_id).bind(k).fetch_optional(&st.pool).await?
    {
        let same = w.get::<i64, _>("user_id") == r.user_id
            && w.get::<D, _>("amount") == amount
            && w.get::<String, _>("method") == method
            && w.get::<String, _>("to_address") == to
            && w.get::<Option<String>, _>("chain").as_deref() == chain.map(|c| c.as_str());
        return if same { Ok(client_json(&w)) } else { Err(ApiError::conflict("idempotency_conflict", "This idempotency key was used for a different withdrawal")) };
    }
    let limits = settings::limits(&st.pool, tenant_id).await?;
    if amount < limits.withdraw_min {
        return Err(ApiError::unprocessable("below_minimum", format!("The minimum withdrawal is {} USDT", s(limits.withdraw_min))));
    }
    if amount > limits.withdraw_max {
        return Err(ApiError::unprocessable("above_maximum", format!("The maximum per withdrawal is {} USDT", s(limits.withdraw_max))));
    }
    if let Some(m) = &off_chain {
        if let Some(min) = m.min_amount.filter(|v| amount < *v) {
            return Err(ApiError::unprocessable("below_minimum", format!("The minimum {} withdrawal is {} USDT", m.method.to_uppercase(), s(min))));
        }
        if let Some(max) = m.max_amount.filter(|v| amount > *v) {
            return Err(ApiError::unprocessable("above_maximum", format!("The maximum {} withdrawal is {} USDT", m.method.to_uppercase(), s(max))));
        }
    }
    let fee = fee_for(&limits, dest_fee, amount);
    let net = amount - fee;
    // What the client is actually paid off chain, at today's rate. Floored to the currency's smallest unit, so
    // rounding never promises more than the broker will send.
    let quote = off_chain.as_ref().map(|m| {
        let rate = m.rate.unwrap_or(D::ONE);
        (m.currency.clone(), floor_dp(net * rate, 2), rate)
    });
    if net <= D::ZERO {
        return Err(ApiError::unprocessable("below_minimum", format!("The amount must be above the {} USDT fee", s(fee))));
    }

    // KYC gate (D6)
    let user = st.users.get(&ctx.tenant.slug, r.user_id).await.map_err(|e| {
        tracing::warn!(error = %e, "gateway unavailable for the KYC check");
        ApiError::Coded { status: axum::http::StatusCode::SERVICE_UNAVAILABLE, code: "unavailable", message: "Verification status is unavailable. Please try again shortly.".into() }
    })?;
    let user = user.ok_or_else(|| ApiError::not_found("Client"))?;
    if user.tenant_id != 0 && user.tenant_id != tenant_id {
        return Err(ApiError::not_found("Client"));
    }
    if user.status != "active" {
        return Err(ApiError::Coded { status: axum::http::StatusCode::FORBIDDEN, code: "account_disabled", message: "Your account can't withdraw. Contact support.".into() });
    }
    // withdrawals disabled in the Back Office (client restrictions)
    if user.restrictions.iter().any(|k| k == "withdrawals") {
        return Err(crate::users::restricted("withdrawals"));
    }
    if user.kyc_status != "verified" {
        return Err(ApiError::Coded { status: axum::http::StatusCode::FORBIDDEN, code: "kyc_required", message: "Verify your identity before your first withdrawal.".into() });
    }
    if let Some(until) = cooldown_until(&st.pool, tenant_id, r.user_id, limits.deposit_cooldown_hours).await? {
        return Err(ApiError::unprocessable("deposit_cooldown", format!("Withdrawals open {} hours after your last deposit, at {} UTC", limits.deposit_cooldown_hours, until.format("%Y-%m-%d %H:%M"))));
    }

    if dry_run {
        let used = used_today(&st.pool, tenant_id, r.user_id).await?;
        if used + amount > limits.withdraw_daily_max {
            return Err(ApiError::unprocessable("daily_limit", format!("This exceeds your daily withdrawal limit ({} of {} USDT used today)", s(used), s(limits.withdraw_daily_max))));
        }
        let available = ledger::balances(&st.pool, tenant_id, r.user_id).await?.into_iter().find(|b| b.0 == "USDT").map(|b| b.1).unwrap_or_default();
        if available < amount {
            return Err(ApiError::insufficient());
        }
        return Ok(json!({
            "method": method,
            "chain": chain.map(|c| c.as_str()), "network": chain.map(|c| c.network()),
            "to_address": to, "amount": s(amount), "fee": s(fee), "net_amount": s(net),
            "payout_currency": quote.as_ref().map(|q| q.0.clone()),
            "payout_amount": quote.as_ref().map(|q| s(q.1)),
            "payout_rate": quote.as_ref().map(|q| s(q.2)),
            "used_today": s(used), "daily_max": s(limits.withdraw_daily_max), "available": s(available),
        }));
    }
    let mut tx = st.pool.begin().await?;
    // serialise this user's requests (daily limit + balance) on the balance row
    sqlx::query("SELECT 1 FROM wallet_balances WHERE tenant_id = $1 AND user_id = $2 AND currency = 'USDT' FOR UPDATE").bind(tenant_id).bind(r.user_id).execute(&mut *tx).await?;
    let used: Option<D> = sqlx::query_scalar("SELECT sum(amount) FROM withdrawals WHERE tenant_id = $1 AND user_id = $2 AND status NOT IN ('rejected', 'cancelled') AND created_at >= $3")
        .bind(tenant_id)
        .bind(r.user_id)
        .bind(server_day_start(Utc::now()))
        .fetch_one(&mut *tx)
        .await?;
    let used = used.unwrap_or_default();
    if used + amount > limits.withdraw_daily_max {
        return Err(ApiError::unprocessable("daily_limit", format!("This exceeds your daily withdrawal limit ({} of {} USDT used today)", s(used), s(limits.withdraw_daily_max))));
    }
    let w = sqlx::query(
        "INSERT INTO withdrawals (tenant_id, user_id, idempotency_key, method, chain, to_address, amount, fee, net_amount, status, kyc_status, ip, user_agent,
                                  payout_currency, payout_amount, payout_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'requested', $10, $11, $12, $13, $14, $15)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING *",
    )
    .bind(tenant_id)
    .bind(r.user_id)
    .bind(&key)
    .bind(method)
    .bind(chain.map(|c| c.as_str()))
    .bind(&to)
    .bind(amount)
    .bind(fee)
    .bind(net)
    .bind(&user.kyc_status)
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .bind(quote.as_ref().map(|q| q.0.clone()))
    .bind(quote.as_ref().map(|q| q.1))
    .bind(quote.as_ref().map(|q| q.2))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::conflict("in_progress", "This withdrawal is already being processed"))?;
    let id: i64 = w.get("id");
    let lock = ledger::post(
        &mut tx,
        NewTxn {
            tenant_id,
            key: format!("wd:{id}:lock"),
            kind: "withdrawal_lock".into(),
            user_id: Some(r.user_id),
            currency: "USDT".into(),
            reference: Some(format!("W{id}")),
            note: Some(format!("Withdrawal to {to}")),
            actor: format!("user:{}", r.user_id),
            request: None,
            legs: vec![Leg::available(r.user_id, "USDT", -amount), Leg::locked(r.user_id, "USDT", amount)],
        },
    )
    .await;
    let lock = match lock {
        Ok(t) => t,
        Err(PostError::Insufficient) => return Err(ApiError::insufficient()),
        Err(e) => return Err(e.into()),
    };
    let w = sqlx::query("UPDATE withdrawals SET lock_txn_id = $2 WHERE id = $1 RETURNING *").bind(id).bind(lock).fetch_one(&mut *tx).await?;
    notify(&mut tx, tenant_id, r.user_id, "withdrawal.requested", "Withdrawal requested", &format!("Your withdrawal of {} USDT is waiting for review.", s(amount)), json!({"withdrawal_id": id})).await?;
    tx.commit().await?;
    record_ip(&st.pool, tenant_id, r.user_id, ctx.ip.as_deref()).await;
    tracing::info!(withdrawal = id, tenant_id, user_id = r.user_id, amount = %amount, method, chain = ?chain.map(|c| c.as_str()), "withdrawal requested");
    Ok(client_json(&w))
}

async fn unlock(tx: &mut Transaction<'_, Postgres>, w: &PgRow, why: &str, actor: &str) -> Result<i64, PostError> {
    let id: i64 = w.get("id");
    let user_id: i64 = w.get("user_id");
    let amount: D = w.get("amount");
    ledger::post(
        tx,
        NewTxn {
            tenant_id: w.get("tenant_id"),
            key: format!("wd:{id}:unlock"),
            kind: "withdrawal_unlock".into(),
            user_id: Some(user_id),
            currency: w.get("currency"),
            reference: Some(format!("W{id}")),
            note: Some(why.into()),
            actor: actor.into(),
            request: None,
            legs: vec![Leg::locked(user_id, "USDT", -amount), Leg::available(user_id, "USDT", amount)],
        },
    )
    .await
}

pub async fn cancel(st: &AppState, tenant_id: i64, user_id: i64, id: i64) -> ApiResult<Value> {
    let mut tx = st.pool.begin().await?;
    let w = sqlx::query("SELECT * FROM withdrawals WHERE id = $1 AND tenant_id = $2 AND user_id = $3 FOR UPDATE").bind(id).bind(tenant_id).bind(user_id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Withdrawal"))?;
    if w.get::<String, _>("status") != "requested" {
        return Err(ApiError::conflict("invalid_state", "Only a withdrawal waiting for review can be cancelled"));
    }
    let t = unlock(&mut tx, &w, "Cancelled by client", &format!("user:{user_id}")).await?;
    let w = sqlx::query("UPDATE withdrawals SET status = 'cancelled', final_txn_id = $2, updated_at = now() WHERE id = $1 RETURNING *").bind(id).bind(t).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(client_json(&w))
}

pub async fn approve(st: &AppState, s_ctx: &StaffCtx, id: i64, note: Option<&str>) -> ApiResult<Value> {
    let mut tx = st.pool.begin().await?;
    let w = sqlx::query("SELECT * FROM withdrawals WHERE id = $1 AND tenant_id = $2 FOR UPDATE").bind(id).bind(s_ctx.ctx.tenant.id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Withdrawal"))?;
    if w.get::<String, _>("status") != "requested" {
        return Err(ApiError::conflict("invalid_state", format!("A {} withdrawal can't be approved", w.get::<String, _>("status"))));
    }
    let note = super::clean_text(note, 500);
    let r = sqlx::query("UPDATE withdrawals SET status = 'approved', review_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now() WHERE id = $1 RETURNING *")
        .bind(id)
        .bind(&note)
        .bind(format!("{} ({})", s_ctx.staff.name, s_ctx.staff.tag()))
        .fetch_one(&mut *tx)
        .await?;
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.withdrawal.approved", target_kind: "withdrawal", target_id: id.to_string(), reason: note.as_deref(), before: Some(json!({"status": "requested"})), after: Some(json!({"status": "approved"})) }).await?;
    notify(&mut tx, s_ctx.ctx.tenant.id, r.get("user_id"), "withdrawal.approved", "Withdrawal approved", &format!("Your withdrawal of {} USDT was approved and will be sent shortly.", s(r.get::<D, _>("amount"))), json!({"withdrawal_id": id})).await?;
    tx.commit().await?;
    Ok(withdrawal_json(&r))
}

pub async fn reject(st: &AppState, s_ctx: &StaffCtx, id: i64, reason: &str) -> ApiResult<Value> {
    let reason = reason.trim();
    if reason.len() < 3 {
        return Err(ApiError::validation("reason", "Enter a reason for the client"));
    }
    let mut tx = st.pool.begin().await?;
    let w = sqlx::query("SELECT * FROM withdrawals WHERE id = $1 AND tenant_id = $2 FOR UPDATE").bind(id).bind(s_ctx.ctx.tenant.id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Withdrawal"))?;
    let status: String = w.get("status");
    if status != "requested" && status != "approved" {
        return Err(ApiError::conflict("invalid_state", format!("A {status} withdrawal can't be rejected")));
    }
    let t = unlock(&mut tx, &w, &format!("Rejected: {reason}"), &s_ctx.staff.tag()).await?;
    let r = sqlx::query("UPDATE withdrawals SET status = 'rejected', reason = $2, reviewed_by = $3, reviewed_at = now(), final_txn_id = $4, updated_at = now() WHERE id = $1 RETURNING *")
        .bind(id)
        .bind(reason)
        .bind(format!("{} ({})", s_ctx.staff.name, s_ctx.staff.tag()))
        .bind(t)
        .fetch_one(&mut *tx)
        .await?;
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.withdrawal.rejected", target_kind: "withdrawal", target_id: id.to_string(), reason: Some(reason), before: Some(json!({"status": status})), after: Some(json!({"status": "rejected"})) }).await?;
    notify(&mut tx, s_ctx.ctx.tenant.id, r.get("user_id"), "withdrawal.rejected", "Withdrawal rejected", &format!("Your withdrawal of {} USDT was rejected: {reason}. The funds are back in your wallet.", s(r.get::<D, _>("amount"))), json!({"withdrawal_id": id})).await?;
    tx.commit().await?;
    Ok(withdrawal_json(&r))
}

/// Staff sent the payout and record what identifies it: a chain hash, which the watcher then verifies, or - for
/// an off-chain method - the bank reference, which nobody can verify for us, so the withdrawal completes here.
pub async fn mark_paid(st: &AppState, s_ctx: &StaffCtx, id: i64, reference: &str) -> ApiResult<Value> {
    let mut tx = st.pool.begin().await?;
    let w = sqlx::query("SELECT * FROM withdrawals WHERE id = $1 AND tenant_id = $2 FOR UPDATE").bind(id).bind(s_ctx.ctx.tenant.id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Withdrawal"))?;
    let status: String = w.get("status");
    if status != "approved" {
        return Err(ApiError::conflict("invalid_state", format!("A {status} withdrawal can't be marked as paid; approve it first")));
    }
    if w.get::<String, _>("method") != "crypto" {
        return off_chain_paid(st, s_ctx, tx, w, reference).await;
    }
    let chain = w.get::<Option<String>, _>("chain").and_then(|c| ChainId::parse(&c)).ok_or_else(|| ApiError::conflict("invalid_state", "This withdrawal has no chain"))?;
    let hash = chain.normalize_hash(reference).ok_or_else(|| ApiError::validation("tx_hash", "Enter the payout transaction hash (64 hexadecimal characters)"))?;
    let used: Option<i64> = sqlx::query_scalar("SELECT id FROM withdrawals WHERE chain = $1 AND payout_tx_hash = $2 AND id <> $3").bind(chain.as_str()).bind(&hash).bind(id).fetch_optional(&mut *tx).await?;
    let is_deposit: Option<i64> = sqlx::query_scalar("SELECT id FROM deposits WHERE chain = $1 AND tx_hash = $2").bind(chain.as_str()).bind(&hash).fetch_optional(&mut *tx).await?;
    if used.is_some() || is_deposit.is_some() {
        return Err(ApiError::conflict("tx_already_used", "This transaction is already recorded for another deposit or withdrawal"));
    }
    let r = sqlx::query("UPDATE withdrawals SET status = 'paid', payout_tx_hash = $2, payout_error = NULL, payout_confirmations = 0, paid_by = $3, paid_at = now(), updated_at = now() WHERE id = $1 RETURNING *")
        .bind(id)
        .bind(&hash)
        .bind(format!("{} ({})", s_ctx.staff.name, s_ctx.staff.tag()))
        .fetch_one(&mut *tx)
        .await?;
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.withdrawal.paid", target_kind: "withdrawal", target_id: id.to_string(), reason: None, before: Some(json!({"status": status})), after: Some(json!({"status": "paid", "payout_tx_hash": hash})) }).await?;
    tx.commit().await?;
    if let Err(e) = verify_payout(st, id).await {
        tracing::warn!(withdrawal = id, error = %e, "payout check failed; the watcher retries");
    }
    let r2 = sqlx::query("SELECT * FROM withdrawals WHERE id = $1").bind(id).fetch_one(&st.pool).await?;
    let _ = r;
    Ok(withdrawal_json(&r2))
}

/// An off-chain payout (UPI): staff already sent the money, so all we can record is their reference. There is
/// nothing to verify against, which is exactly why the reference is required, has to be unique, and lands in the
/// audit log next to the name of whoever entered it.
async fn off_chain_paid(st: &AppState, s_ctx: &StaffCtx, mut tx: Transaction<'_, Postgres>, w: PgRow, reference: &str) -> ApiResult<Value> {
    let id: i64 = w.get("id");
    let method: String = w.get("method");
    let reference = reference.trim();
    if !(4..=64).contains(&reference.chars().count()) || !reference.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '/')) {
        return Err(ApiError::validation("reference", "Enter the payment reference (UTR), 4 to 64 letters or digits"));
    }
    let used: Option<i64> = sqlx::query_scalar("SELECT id FROM withdrawals WHERE tenant_id = $1 AND payout_reference = $2 AND id <> $3")
        .bind(s_ctx.ctx.tenant.id)
        .bind(reference)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    if used.is_some() {
        return Err(ApiError::conflict("reference_used", "This payment reference is already recorded for another withdrawal"));
    }
    sqlx::query("UPDATE withdrawals SET status = 'paid', payout_reference = $2, payout_error = NULL, paid_by = $3, paid_at = now(), updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(reference)
        .bind(format!("{} ({})", s_ctx.staff.name, s_ctx.staff.tag()))
        .execute(&mut *tx)
        .await?;
    audit::staff(&mut tx, s_ctx, Entry { action: "wallet.withdrawal.paid", target_kind: "withdrawal", target_id: id.to_string(), reason: None, before: Some(json!({"status": "approved"})), after: Some(json!({"status": "paid", "method": method, "payout_reference": reference})) }).await?;
    tx.commit().await?;
    // No chain to wait for: the money has left the broker's bank, so the ledger follows immediately.
    complete(st, id).await.map_err(ApiError::Internal)?;
    let r = sqlx::query("SELECT * FROM withdrawals WHERE id = $1").bind(id).fetch_one(&st.pool).await?;
    Ok(withdrawal_json(&r))
}

async fn payout_failed(st: &AppState, id: i64, reason: &str) -> anyhow::Result<()> {
    let mut tx = st.pool.begin().await?;
    let r = sqlx::query("UPDATE withdrawals SET status = 'approved', payout_error = $2, payout_tx_hash = NULL, payout_confirmations = 0, updated_at = now() WHERE id = $1 AND status = 'paid' RETURNING tenant_id")
        .bind(id)
        .bind(reason)
        .fetch_optional(&mut *tx)
        .await?;
    if let Some(r) = r {
        audit::system(&mut tx, r.get("tenant_id"), "wallet.withdrawal.payout_rejected", "withdrawal", id.to_string(), Some(json!({"reason": reason}))).await?;
    }
    tx.commit().await?;
    tracing::warn!(withdrawal = id, reason, "payout verification failed");
    Ok(())
}

/// Watcher step for a `paid` withdrawal: the payout must be a successful USDT transfer of exactly the net
/// amount from a company address to the client's address, with the chain's confirmations.
pub async fn verify_payout(st: &AppState, id: i64) -> anyhow::Result<()> {
    let Some(w) = sqlx::query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'paid'").bind(id).fetch_optional(&st.pool).await? else { return Ok(()) };
    let tenant_id: i64 = w.get("tenant_id");
    let Some(chain) = ChainId::parse(w.get::<String, _>("chain").as_str()) else { return Ok(()) };
    let Ok(client) = st.chain(chain) else { return Ok(()) };
    let Some(hash) = w.get::<Option<String>, _>("payout_tx_hash") else { return Ok(()) };
    let lookup = client.lookup(&hash).await?;
    match lookup.status {
        TxStatus::NotFound => {
            let paid_at: DateTime<Utc> = w.get::<Option<DateTime<Utc>>, _>("paid_at").unwrap_or_else(Utc::now);
            if Utc::now() - paid_at > Duration::hours(PAYOUT_NOT_FOUND_HOURS) {
                payout_failed(st, id, "The payout transaction was not found on chain").await?;
            }
            return Ok(());
        }
        TxStatus::Failed => return payout_failed(st, id, "The payout transaction failed on chain").await,
        TxStatus::Success => {}
    }
    let company = settings::company_addresses(&st.pool, tenant_id, chain).await?;
    let to: String = w.get("to_address");
    let net: D = w.get("net_amount");
    // Who sent it is a reconciliation question, not a "was the client paid" one. With no company address on
    // file that check can only ever say no, which would bounce every honest payout, so it is skipped and
    // recorded. Everything that protects the client - token, recipient, exact amount - still has to hold.
    let unchecked_sender = company.is_empty();
    let ok = lookup
        .transfers
        .iter()
        .any(|t| t.token == chain.usdt_contract() && (unchecked_sender || company.contains(&t.from)) && t.to == to && t.amount == net);
    if !ok {
        let from = if unchecked_sender { String::new() } else { " from a company address".into() };
        return payout_failed(st, id, &format!("The transaction does not send exactly {} USDT{from} to {to}", s(net))).await;
    }
    if unchecked_sender {
        sqlx::query("UPDATE withdrawals SET payout_sender_unverified = true WHERE id = $1").bind(id).execute(&st.pool).await?;
        tracing::warn!(withdrawal = id, %chain, "payout accepted without a company address to check the sender against");
    }
    let conf = confirmations(client.head().await?, lookup.block.unwrap_or_default());
    let required = settings::chain(&st.pool, tenant_id, chain).await?.map(|c| c.confirmations).unwrap_or(20);
    sqlx::query("UPDATE withdrawals SET payout_confirmations = $2, updated_at = now() WHERE id = $1 AND status = 'paid'").bind(id).bind(conf).execute(&st.pool).await?;
    if conf < required {
        return Ok(());
    }
    complete(st, id).await
}

async fn complete(st: &AppState, id: i64) -> anyhow::Result<()> {
    let mut tx = st.pool.begin().await?;
    let Some(w) = sqlx::query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'paid' FOR UPDATE").bind(id).fetch_optional(&mut *tx).await? else { return Ok(()) };
    let (tenant_id, user_id): (i64, i64) = (w.get("tenant_id"), w.get("user_id"));
    let (amount, fee, net): (D, D, D) = (w.get("amount"), w.get("fee"), w.get("net_amount"));
    let method: String = w.get("method");
    // the house account the money leaves by: one per chain, one per off-chain method
    let rail: String = w.get::<Option<String>, _>("chain").unwrap_or_else(|| method.clone());
    let ccy: String = w.get("currency");
    let t = match ledger::post(
        &mut tx,
        NewTxn {
            tenant_id,
            key: format!("wd:{id}:complete"),
            kind: "withdrawal".into(),
            user_id: Some(user_id),
            currency: ccy.clone(),
            reference: w.get::<Option<String>, _>("payout_tx_hash").or_else(|| w.get("payout_reference")),
            note: Some(format!("Withdrawal to {}", w.get::<String, _>("to_address"))),
            actor: "system".into(),
            request: None,
            legs: vec![Leg::locked(user_id, &ccy, -amount), Leg::sys(&ccy, &format!("withdrawal:{rail}"), net), Leg::sys(&ccy, "fees", fee)],
        },
    )
    .await
    {
        Ok(t) => t,
        Err(PostError::Duplicate) => sqlx::query_scalar("SELECT id FROM ledger_txns WHERE tenant_id = $1 AND idempotency_key = $2").bind(tenant_id).bind(format!("wd:{id}:complete")).fetch_one(&st.pool).await?,
        Err(PostError::Insufficient) => anyhow::bail!("withdrawal {id}: locked balance below the withdrawal amount"),
        Err(PostError::Db(e)) => return Err(e),
    };
    sqlx::query("UPDATE withdrawals SET status = 'completed', final_txn_id = $2, completed_at = now(), updated_at = now() WHERE id = $1").bind(id).bind(t).execute(&mut *tx).await?;
    // say what actually left: rupees to a UPI ID, or USDT to a wallet
    let sent = match (w.get::<Option<D>, _>("payout_amount"), w.get::<Option<String>, _>("payout_currency")) {
        (Some(a), Some(c)) => format!("{} {c} was sent to {}.", s(a), w.get::<String, _>("to_address")),
        _ => format!("{} USDT was sent to your wallet.", s(net)),
    };
    notify(&mut tx, tenant_id, user_id, "withdrawal.completed", "Withdrawal sent", &sent, json!({"withdrawal_id": id, "tx_hash": w.get::<Option<String>, _>("payout_tx_hash"), "reference": w.get::<Option<String>, _>("payout_reference")})).await?;
    tx.commit().await?;
    tracing::info!(withdrawal = id, tenant_id, user_id, net = %net, "withdrawal completed");
    Ok(())
}

/* ------------------------------------------------------------------ */
/* Risk checklist (D118)                                               */
/* ------------------------------------------------------------------ */

pub async fn risk(st: &AppState, tenant_slug: &str, w: &PgRow) -> ApiResult<Value> {
    let tenant_id: i64 = w.get("tenant_id");
    let user_id: i64 = w.get("user_id");
    let pool = &st.pool;
    let kyc = match st.users.get(tenant_slug, user_id).await {
        Ok(Some(u)) => json!({"status": u.kyc_status, "account_status": u.status, "email": u.email, "name": u.name, "ok": u.kyc_status == "verified" && u.status == "active"}),
        Ok(None) => json!({"status": null, "ok": false, "error": "Client not found in the gateway"}),
        Err(_) => json!({"status": null, "ok": false, "error": "Gateway unavailable"}),
    };
    let limits = settings::limits(pool, tenant_id).await?;
    let last_dep: Option<(DateTime<Utc>, D)> = sqlx::query_as("SELECT credited_at, amount FROM deposits WHERE tenant_id = $1 AND user_id = $2 AND status = 'credited' ORDER BY credited_at DESC LIMIT 1")
        .bind(tenant_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    let created: DateTime<Utc> = w.get("created_at");
    let recent = last_dep.map(|(t, _)| created - t < Duration::hours(limits.deposit_cooldown_hours.max(24) as i64)).unwrap_or(false);
    let totals = sqlx::query(
        "SELECT
            (SELECT COALESCE(sum(amount), 0) FROM deposits WHERE tenant_id = $1 AND user_id = $2 AND status = 'credited') AS deposited,
            (SELECT COALESCE(sum(amount), 0) FROM withdrawals WHERE tenant_id = $1 AND user_id = $2 AND status = 'completed') AS withdrawn,
            (SELECT COALESCE(sum(amount), 0) FROM trading_transfers WHERE tenant_id = $1 AND user_id = $2 AND status = 'completed' AND direction = 'to_trading') AS to_trading,
            (SELECT COALESCE(sum(amount), 0) FROM trading_transfers WHERE tenant_id = $1 AND user_id = $2 AND status = 'completed' AND direction = 'from_trading') AS from_trading",
    )
    .bind(tenant_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    let (dep, wd, to_t, from_t): (D, D, D, D) = (totals.get("deposited"), totals.get("withdrawn"), totals.get("to_trading"), totals.get("from_trading"));
    let ip: Option<String> = w.get("ip");
    let (ip_seen, ip_others): (bool, Vec<i64>) = match &ip {
        Some(ip) => {
            let seen: Option<i64> = sqlx::query_scalar("SELECT hits FROM client_ips WHERE tenant_id = $1 AND user_id = $2 AND ip = $3 AND first_seen < $4").bind(tenant_id).bind(user_id).bind(ip).bind(created).fetch_optional(pool).await?.map(|h: i32| h as i64);
            let others: Vec<i64> = sqlx::query_scalar("SELECT DISTINCT user_id FROM client_ips WHERE tenant_id = $1 AND ip = $2 AND user_id <> $3 LIMIT 10").bind(tenant_id).bind(ip).bind(user_id).fetch_all(pool).await?;
            (seen.is_some(), others)
        }
        None => (false, vec![]),
    };
    let to: String = w.get("to_address");
    let id: i64 = w.get("id");
    let addr_before: i64 = sqlx::query_scalar("SELECT count(*) FROM withdrawals WHERE tenant_id = $1 AND user_id = $2 AND to_address = $3 AND id <> $4 AND status = 'completed'").bind(tenant_id).bind(user_id).bind(&to).bind(id).fetch_one(pool).await?;
    let addr_others: Vec<i64> = sqlx::query_scalar(
        "SELECT DISTINCT user_id FROM (SELECT user_id FROM withdrawals WHERE tenant_id = $1 AND to_address = $2 AND user_id <> $3
                                       UNION SELECT user_id FROM deposits WHERE tenant_id = $1 AND from_address = $2 AND user_id IS NOT NULL AND user_id <> $3) x LIMIT 10",
    )
    .bind(tenant_id)
    .bind(&to)
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    let deposited_from: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM deposits WHERE tenant_id = $1 AND user_id = $2 AND from_address = $3)").bind(tenant_id).bind(user_id).bind(&to).fetch_one(pool).await?;
    let bal = ledger::balances(pool, tenant_id, user_id).await?;
    Ok(json!({
        "kyc": kyc,
        "recent_deposit": {
            "last_credited_at": last_dep.map(|x| x.0),
            "last_amount": last_dep.map(|x| s(x.1)),
            "cooldown_hours": limits.deposit_cooldown_hours,
            "ok": !recent,
        },
        "flows": {
            "deposited": s(dep), "withdrawn": s(wd), "to_trading": s(to_t), "from_trading": s(from_t),
            "trading_pnl": s(from_t - to_t),
            "ok": wd + w.get::<D, _>("amount") <= dep + (from_t - to_t).max(D::ZERO),
        },
        "ip": {"address": ip, "seen_before": ip_seen, "other_clients": ip_others, "ok": ip_others.is_empty()},
        "destination": {
            "address": to, "paid_before": addr_before, "used_for_deposits": deposited_from, "other_clients": addr_others,
            "ok": addr_others.is_empty(),
        },
        "balances": ledger::balances_json(&bal),
        "amount": s(w.get::<D, _>("amount")),
        "fee": s(w.get::<D, _>("fee")),
        "net_amount": s(w.get::<D, _>("net_amount")),
        "payout_confirmations": w.get::<i32, _>("payout_confirmations"),
        "payout_hash": s_opt(None),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn fees_and_server_day() {
        let l = Limits {
            withdraw_min: D::from(10),
            withdraw_max: D::from(1000),
            withdraw_daily_max: D::from(2000),
            withdraw_fee_flat: D::ONE,
            withdraw_fee_pct: D::from_str("0.5").unwrap(),
            deposit_cooldown_hours: 24,
            intent_ttl_minutes: 60,
        };
        // 1 flat + 0.5% of 101 = 0.505 → 0.51 (rounded up) + what the destination costs (0.5 network fee here)
        assert_eq!(fee_for(&l, D::from_str("0.5").unwrap(), D::from(101)), D::from_str("2.01").unwrap());
        // an off-chain method with no fee of its own is priced by the tenant's fee alone
        assert_eq!(fee_for(&l, D::ZERO, D::from(101)), D::from_str("1.51").unwrap());
        let now = DateTime::parse_from_rfc3339("2026-09-28T22:30:00Z").unwrap().with_timezone(&Utc);
        // 22:30 UTC is 01:30 GMT+3 on the 29th → day starts 2026-09-28T21:00Z
        assert_eq!(server_day_start(now).to_rfc3339(), "2026-09-28T21:00:00+00:00");
    }

    #[test]
    fn upi_ids_are_checked_before_staff_chase_a_payment() {
        for good in ["9876543210@ybl", "Priya.Shah@okaxis", "a_b-c@PAYTM", "x1@ok"] {
            assert_eq!(normalize_upi_id(good), Some(good.to_ascii_lowercase()), "{good}");
        }
        assert_eq!(normalize_upi_id("  9876543210@ybl  "), Some("9876543210@ybl".into()));
        for bad in [
            "9876543210",        // no handle
            "@ybl",              // no name
            "name@",             // no bank
            "a@b",               // handle too short
            "name@@ybl",         // two handles
            "name@ok axis",      // space
            "name@ok.axis",      // dot in the handle
            ".name@ybl",         // starts with a dot
            "name@1bl",          // handle starts with a digit
            "na me@ybl",
            "नाम@ybl",
        ] {
            assert_eq!(normalize_upi_id(bad), None, "{bad} should be refused");
        }
    }
}

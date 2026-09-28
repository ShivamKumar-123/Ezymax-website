//! Client / service routes: balances, the transfer contract, deposits, withdrawals, wallet <-> trading,
//! activity and notifications. The caller (CRM BFF or an internal service) resolves the user; the service
//! trusts `user_id` because only holders of the internal token reach it.

use axum::Json;
use axum::extract::{Path, State};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Q, ok, paging};
use crate::error::{ApiError, ApiResult};
use crate::ledger;
use crate::money::{D, de_dec, s};
use crate::ops::{self, deposits, trading, transfers, withdrawals};
use crate::settings;
use crate::state::{AppState, Ctx};

fn uid(v: i64) -> ApiResult<i64> {
    if v > 0 { Ok(v) } else { Err(ApiError::validation("user_id", "user_id must be a positive integer")) }
}

/* ---------------- config ---------------- */

pub async fn config(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let chains = settings::chains(&st.pool, ctx.tenant.id).await?;
    let limits = settings::limits(&st.pool, ctx.tenant.id).await?;
    Ok(ok(json!({
        "chains": chains.iter().filter(|c| st.chains.contains_key(&c.chain)).map(|c| c.public_json()).collect::<Vec<_>>(),
        "limits": limits.json(),
        "currencies": transfers::CURRENCIES,
    })))
}

/* ---------------- balances / ledger ---------------- */

pub async fn wallet(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let b = ledger::balances(&st.pool, ctx.tenant.id, user_id).await?;
    Ok(ok(json!({"user_id": user_id, "balances": ledger::balances_json(&b)})))
}

#[derive(Deserialize, Default)]
pub struct PageQ {
    page: Option<i64>,
    limit: Option<i64>,
    #[serde(rename = "type")]
    kind: Option<String>,
    user_id: Option<i64>,
    status: Option<String>,
}

pub async fn ledger(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Q(q): Q<PageQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let (page, limit, offset) = paging(q.page, q.limit, 50, 500);
    let rows = sqlx::query(
        "SELECT t.id, t.kind, t.currency, t.reference, t.note, t.created_at,
                COALESCE(sum(p.amount) FILTER (WHERE p.account_code LIKE '%:available'), 0) AS a,
                COALESCE(sum(p.amount) FILTER (WHERE p.account_code LIKE '%:locked'), 0) AS l,
                count(*) OVER () AS total
         FROM ledger_txns t JOIN ledger_postings p ON p.txn_id = t.id AND p.user_id = $2
         WHERE t.tenant_id = $1
         GROUP BY t.id ORDER BY t.id DESC LIMIT $3 OFFSET $4",
    )
    .bind(ctx.tenant.id)
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let (a, l): (D, D) = (r.get("a"), r.get("l"));
            json!({
                "txn_id": r.get::<i64, _>("id"),
                "kind": r.get::<String, _>("kind"),
                "currency": r.get::<String, _>("currency"),
                "amount": s(a + l),
                "available_delta": s(a),
                "locked_delta": s(l),
                "ref": r.get::<Option<String>, _>("reference"),
                "note": r.get::<Option<String>, _>("note"),
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect();
    Ok(ok(json!({"items": items, "page": page, "limit": limit, "total": total})))
}

/* ---------------- transfer contract ---------------- */

#[derive(Deserialize)]
pub struct TransferBody {
    #[serde(default)]
    idempotency_key: String,
    #[serde(default)]
    user_id: i64,
    #[serde(default)]
    currency: String,
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    #[serde(default)]
    direction: String,
    #[serde(default)]
    kind: String,
    #[serde(default, rename = "ref")]
    reference: Option<String>,
    #[serde(default)]
    note: Option<String>,
}

pub async fn transfer(State(st): State<AppState>, ctx: Ctx, Body(b): Body<TransferBody>) -> ApiResult<Json<Value>> {
    let r = transfers::TransferReq {
        idempotency_key: b.idempotency_key,
        user_id: b.user_id,
        currency: b.currency.trim().to_uppercase(),
        amount: b.amount,
        direction: b.direction.trim().to_lowercase(),
        kind: b.kind.trim().to_lowercase(),
        reference: b.reference,
        note: b.note,
    };
    Ok(ok(transfers::transfer(&st, ctx.tenant.id, &ctx.actor(), "ext", r).await?))
}

pub async fn transfer_lookup(State(st): State<AppState>, ctx: Ctx, Path(key): Path<String>) -> ApiResult<Json<Value>> {
    Ok(ok(transfers::lookup(&st, ctx.tenant.id, &key).await?))
}

/* ---------------- overview / activity ---------------- */

pub async fn overview(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let t = ctx.tenant.id;
    let b = ledger::balances(&st.pool, t, user_id).await?;
    let pending: Vec<Value> = sqlx::query("SELECT * FROM deposits WHERE tenant_id = $1 AND user_id = $2 AND status IN ('pending', 'confirming', 'review') ORDER BY id DESC LIMIT 10")
        .bind(t)
        .bind(user_id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(deposits::deposit_json)
        .collect();
    let open: Vec<Value> = sqlx::query("SELECT * FROM withdrawals WHERE tenant_id = $1 AND user_id = $2 AND status IN ('requested', 'approved', 'paid') ORDER BY id DESC LIMIT 10")
        .bind(t)
        .bind(user_id)
        .fetch_all(&st.pool)
        .await?
        .iter()
        .map(withdrawals::client_json)
        .collect();
    let limits = settings::limits(&st.pool, t).await?;
    let used = withdrawals::used_today(&st.pool, t, user_id).await?;
    let cooldown = withdrawals::cooldown_until(&st.pool, t, user_id, limits.deposit_cooldown_hours).await?;
    let unread: i64 = sqlx::query_scalar("SELECT count(*) FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL").bind(t).bind(user_id).fetch_one(&st.pool).await?;
    Ok(ok(json!({
        "user_id": user_id,
        "balances": ledger::balances_json(&b),
        "pending_deposits": pending,
        "open_withdrawals": open,
        "limits": {
            "used_today": s(used),
            "remaining_today": s((limits.withdraw_daily_max - used).max(D::ZERO)),
            "daily_max": s(limits.withdraw_daily_max),
            "cooldown_until": cooldown,
        },
        "notifications_unread": unread,
    })))
}

pub async fn activity(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Q(q): Q<PageQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 200);
    let kind = q.kind.as_deref().unwrap_or("all");
    if !matches!(kind, "all" | "deposit" | "withdrawal" | "transfer" | "other") {
        return Err(ApiError::BadRequest("type must be all, deposit, withdrawal, transfer or other".into()));
    }
    let kinds: Vec<String> = transfers::KINDS.iter().map(|k| k.to_string()).collect();
    let rows = sqlx::query(
        "SELECT *, count(*) OVER () AS total FROM (
            SELECT 'deposit' AS type, id::text AS id, status, COALESCE(amount, expected_amount) AS amount, currency, chain, tx_hash AS hash,
                   NULL::bigint AS login, 'in' AS dir, NULL::text AS kind, NULL::numeric AS fee, NULL::numeric AS net, NULL::text AS note, created_at, updated_at,
                   confirmations, required_confirmations, from_address AS address
              FROM deposits WHERE tenant_id = $1 AND user_id = $2
            UNION ALL
            SELECT 'withdrawal', id::text, status, amount, currency, chain, payout_tx_hash, NULL, 'out', NULL, fee, net_amount, reason, created_at, updated_at,
                   payout_confirmations, NULL, to_address
              FROM withdrawals WHERE tenant_id = $1 AND user_id = $2
            UNION ALL
            SELECT 'transfer', id::text, status, amount, currency, NULL, NULL, login, CASE WHEN direction = 'to_trading' THEN 'out' ELSE 'in' END, direction,
                   NULL, NULL, error_message, created_at, updated_at, NULL, NULL, NULL
              FROM trading_transfers WHERE tenant_id = $1 AND user_id = $2
            UNION ALL
            SELECT 'other', t.id::text, 'completed', abs(p.amount), t.currency, NULL, NULL, NULL, CASE WHEN p.amount > 0 THEN 'in' ELSE 'out' END, t.kind,
                   NULL, NULL, t.note, t.created_at, t.created_at, NULL, NULL, t.reference
              FROM ledger_txns t JOIN ledger_postings p ON p.txn_id = t.id AND p.user_id = $2 AND p.account_code LIKE '%:available'
             WHERE t.tenant_id = $1 AND t.kind = ANY($3)
         ) x WHERE ($4 = 'all' OR type = $4) ORDER BY created_at DESC, id DESC LIMIT $5 OFFSET $6",
    )
    .bind(ctx.tenant.id)
    .bind(user_id)
    .bind(&kinds)
    .bind(kind)
    .bind(limit)
    .bind(offset)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let chain = r.get::<Option<String>, _>("chain").and_then(|c| crate::chain::ChainId::parse(&c));
            let hash: Option<String> = r.get("hash");
            json!({
                "type": r.get::<String, _>("type"),
                "id": r.get::<String, _>("id"),
                "status": r.get::<String, _>("status"),
                "amount": crate::money::s_opt(r.get::<Option<D>, _>("amount")),
                "currency": r.get::<String, _>("currency"),
                "chain": chain.map(|c| c.as_str()),
                "network": chain.map(|c| c.network()),
                "tx_hash": hash,
                "explorer_url": match (chain, &hash) { (Some(c), Some(h)) => Some(c.explorer_tx(h)), _ => None },
                "login": r.get::<Option<i64>, _>("login"),
                "direction": r.get::<String, _>("dir"),
                "kind": r.get::<Option<String>, _>("kind"),
                "fee": crate::money::s_opt(r.get::<Option<D>, _>("fee")),
                "net_amount": crate::money::s_opt(r.get::<Option<D>, _>("net")),
                "note": r.get::<Option<String>, _>("note"),
                "address": r.get::<Option<String>, _>("address"),
                "confirmations": r.get::<Option<i32>, _>("confirmations"),
                "required_confirmations": r.get::<Option<i32>, _>("required_confirmations"),
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
                "updated_at": r.get::<DateTime<Utc>, _>("updated_at"),
            })
        })
        .collect();
    Ok(ok(json!({"items": items, "page": page, "limit": limit, "total": total})))
}

pub async fn notifications(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Q(q): Q<PageQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let (_, limit, _) = paging(None, q.limit, 20, 100);
    let rows = sqlx::query("SELECT * FROM notifications WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT $3").bind(ctx.tenant.id).bind(user_id).bind(limit).fetch_all(&st.pool).await?;
    let unread: i64 = sqlx::query_scalar("SELECT count(*) FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL").bind(ctx.tenant.id).bind(user_id).fetch_one(&st.pool).await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<i64, _>("id"), "kind": r.get::<String, _>("kind"), "title": r.get::<String, _>("title"), "body": r.get::<String, _>("body"),
                "data": r.get::<sqlx::types::Json<Value>, _>("data").0, "read": r.get::<Option<DateTime<Utc>>, _>("read_at").is_some(),
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
            })
        })
        .collect();
    Ok(ok(json!({"items": items, "unread": unread})))
}

#[derive(Deserialize, Default)]
pub struct ReadBody {
    #[serde(default)]
    ids: Option<Vec<i64>>,
}

pub async fn notifications_read(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Body(b): Body<ReadBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let n = sqlx::query("UPDATE notifications SET read_at = now() WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL AND ($3::bigint[] IS NULL OR id = ANY($3))")
        .bind(ctx.tenant.id)
        .bind(user_id)
        .bind(b.ids)
        .execute(&st.pool)
        .await?
        .rows_affected();
    Ok(ok(json!({"status": "ok", "marked": n})))
}

/* ---------------- deposits ---------------- */

#[derive(Deserialize)]
pub struct IntentBody {
    #[serde(default)]
    user_id: i64,
    #[serde(default)]
    chain: String,
    #[serde(deserialize_with = "de_dec")]
    amount: D,
}

pub async fn create_intent(State(st): State<AppState>, ctx: Ctx, Body(b): Body<IntentBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(b.user_id)?;
    ops::record_ip(&st.pool, ctx.tenant.id, user_id, ctx.ip.as_deref()).await;
    let intent = deposits::create_intent(&st, ctx.tenant.id, user_id, &b.chain, b.amount, ctx.ip.as_deref()).await?;
    Ok(ok(json!({"intent": intent})))
}

#[derive(Deserialize, Default)]
pub struct UserQ {
    user_id: Option<i64>,
}

pub async fn get_intent(State(st): State<AppState>, ctx: Ctx, Path(id): Path<String>, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    Ok(ok(deposits::get_intent(&st, ctx.tenant.id, q.user_id, &id).await?))
}

#[derive(Deserialize)]
pub struct SubmitBody {
    #[serde(default)]
    user_id: i64,
    #[serde(default)]
    intent_id: String,
    #[serde(default)]
    tx_hash: String,
}

pub async fn submit_deposit(State(st): State<AppState>, ctx: Ctx, Body(b): Body<SubmitBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(b.user_id)?;
    let d = deposits::submit(&st, ctx.tenant.id, user_id, &b.intent_id, &b.tx_hash).await?;
    // check right away; the watcher continues from here
    if let Some(id) = d.get("id").and_then(Value::as_i64) {
        let st2 = st.clone();
        tokio::spawn(async move {
            if let Err(e) = deposits::process(&st2, id).await {
                tracing::debug!(deposit = id, error = %e, "first deposit check failed");
            }
        });
    }
    Ok(ok(json!({"deposit": d})))
}

pub async fn list_deposits(State(st): State<AppState>, ctx: Ctx, Q(q): Q<PageQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(q.user_id.unwrap_or(0))?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 200);
    let rows = sqlx::query("SELECT *, count(*) OVER () AS total FROM deposits WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT $3 OFFSET $4")
        .bind(ctx.tenant.id)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&st.pool)
        .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    Ok(ok(json!({"items": rows.iter().map(deposits::deposit_json).collect::<Vec<_>>(), "page": page, "limit": limit, "total": total})))
}

pub async fn get_deposit(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    let r = sqlx::query("SELECT * FROM deposits WHERE tenant_id = $1 AND id = $2 AND ($3::bigint IS NULL OR user_id = $3)")
        .bind(ctx.tenant.id)
        .bind(id)
        .bind(q.user_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Deposit"))?;
    Ok(ok(json!({"deposit": deposits::deposit_json(&r)})))
}

/* ---------------- withdrawals ---------------- */

#[derive(Deserialize)]
pub struct WithdrawBody {
    #[serde(default)]
    user_id: i64,
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    #[serde(default)]
    chain: String,
    #[serde(default)]
    to_address: String,
    #[serde(default)]
    idempotency_key: Option<String>,
}

pub async fn request_withdrawal(State(st): State<AppState>, ctx: Ctx, Body(b): Body<WithdrawBody>) -> ApiResult<Json<Value>> {
    let w = withdrawals::request(&st, &ctx, withdrawals::RequestIn { user_id: b.user_id, amount: b.amount, chain: b.chain, to_address: b.to_address, idempotency_key: b.idempotency_key }).await?;
    Ok(ok(json!({"withdrawal": w})))
}

pub async fn list_withdrawals(State(st): State<AppState>, ctx: Ctx, Q(q): Q<PageQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(q.user_id.unwrap_or(0))?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 200);
    let rows = sqlx::query("SELECT *, count(*) OVER () AS total FROM withdrawals WHERE tenant_id = $1 AND user_id = $2 AND ($5::text IS NULL OR status = $5) ORDER BY id DESC LIMIT $3 OFFSET $4")
        .bind(ctx.tenant.id)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .bind(q.status.as_deref().filter(|s| *s != "all"))
        .fetch_all(&st.pool)
        .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    Ok(ok(json!({"items": rows.iter().map(withdrawals::client_json).collect::<Vec<_>>(), "page": page, "limit": limit, "total": total})))
}

pub async fn get_withdrawal(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    let r = sqlx::query("SELECT * FROM withdrawals WHERE tenant_id = $1 AND id = $2 AND ($3::bigint IS NULL OR user_id = $3)")
        .bind(ctx.tenant.id)
        .bind(id)
        .bind(q.user_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Withdrawal"))?;
    Ok(ok(json!({"withdrawal": withdrawals::client_json(&r)})))
}

#[derive(Deserialize)]
pub struct UserBody {
    #[serde(default)]
    user_id: i64,
}

pub async fn cancel_withdrawal(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Body(b): Body<UserBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(b.user_id)?;
    Ok(ok(json!({"withdrawal": withdrawals::cancel(&st, ctx.tenant.id, user_id, id).await?})))
}

/* ---------------- wallet <-> trading ---------------- */

#[derive(Deserialize)]
pub struct TradingBody {
    #[serde(default)]
    login: i64,
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    #[serde(default)]
    idempotency_key: String,
}

pub async fn to_trading(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Body(b): Body<TradingBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let t = trading::start(&st, &ctx, user_id, trading::Dir::ToTrading, b.login, b.amount, &b.idempotency_key).await?;
    Ok(ok(json!({"transfer": t})))
}

pub async fn from_trading(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Body(b): Body<TradingBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let t = trading::start(&st, &ctx, user_id, trading::Dir::FromTrading, b.login, b.amount, &b.idempotency_key).await?;
    Ok(ok(json!({"transfer": t})))
}

pub async fn trading_transfers(State(st): State<AppState>, ctx: Ctx, Path(user_id): Path<i64>, Q(q): Q<PageQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(user_id)?;
    let (page, limit, offset) = paging(q.page, q.limit, 25, 200);
    let rows = sqlx::query("SELECT *, count(*) OVER () AS total FROM trading_transfers WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT $3 OFFSET $4")
        .bind(ctx.tenant.id)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&st.pool)
        .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    Ok(ok(json!({"items": rows.iter().map(trading::transfer_json).collect::<Vec<_>>(), "page": page, "limit": limit, "total": total})))
}

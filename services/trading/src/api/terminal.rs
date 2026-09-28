//! Kalks Trader terminal API: MT5-style login per account (trading or investor password), SSO from the
//! CRM, account state, orders and positions. Investor sessions are view-only: every write is rejected here
//! on the server (D107), whatever the UI shows.

use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::time::Duration as StdDuration;

use super::{ApiError, ApiResult, AppState, Body, Ctx, parse_ticket};
use crate::auth;
use crate::engine::trade::{self, BulkFilter, CloseReq, OrderPatch, OrderReq, PlaceResult, PositionPatch};
use crate::model::{Expiry, OrderType, Side, Source, Status};
use crate::money::{D, de_dec, de_opt_dec, num};
use crate::rules::TenantConfig;
use crate::shard::Op;
use crate::views;

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

pub struct Session {
    pub login: i64,
    pub tenant_id: i64,
    pub read_only: bool,
}

impl Session {
    pub fn writable(&self) -> ApiResult<()> {
        if self.read_only { Err(ApiError::ReadOnly) } else { Ok(()) }
    }
}

pub async fn session(st: &AppState, ctx: &Ctx) -> ApiResult<Session> {
    let token = ctx.bearer.as_deref().ok_or(ApiError::Unauthorized)?;
    let h = st.keys.hash("terminal-session", token);
    let r = sqlx::query(
        "UPDATE terminal_sessions SET last_seen_at = now() WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
         RETURNING login, tenant_id, read_only",
    )
    .bind(&h)
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::Unauthorized)?;
    let s = Session { login: r.get("login"), tenant_id: r.get("tenant_id"), read_only: r.get("read_only") };
    if s.tenant_id != ctx.tenant.tenant_id {
        return Err(ApiError::Unauthorized);
    }
    Ok(s)
}

async fn create_session(st: &AppState, ctx: &Ctx, login: i64, read_only: bool, via: &str) -> ApiResult<Value> {
    let token = auth::random_token(32);
    let expires: DateTime<Utc> = Utc::now() + Duration::hours(st.cfg.session_ttl_hours);
    sqlx::query("INSERT INTO terminal_sessions (tenant_id, login, token_hash, read_only, via, ip, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(ctx.tenant.tenant_id)
        .bind(login)
        .bind(st.keys.hash("terminal-session", &token))
        .bind(read_only)
        .bind(via)
        .bind(&ctx.ip)
        .bind(&ctx.user_agent)
        .bind(expires)
        .execute(&st.pool)
        .await?;
    sqlx::query("UPDATE accounts SET last_activity_at = now() WHERE login = $1").bind(login).execute(&st.pool).await?;
    let account = account_view(st, login).await;
    tracing::info!(login, read_only, via, ip = %ctx.ip, "terminal login");
    Ok(json!({"token": token, "expiresAt": expires, "readOnly": read_only, "account": account}))
}

pub async fn account_view(st: &AppState, login: i64) -> Value {
    st.hub.read(login, Box::new(|x| x.map(|(s, env)| views::account_json(env, s)).unwrap_or(Value::Null))).await
}

#[derive(Deserialize)]
pub struct LoginReq {
    login: i64,
    password: String,
}

pub async fn login(State(st): State<AppState>, ctx: Ctx, Body(r): Body<LoginReq>) -> ApiResult<Json<Value>> {
    st.limiter.hit(&format!("tlogin:ip:{}", ctx.ip), 30, StdDuration::from_secs(300)).map_err(ApiError::RateLimited)?;
    st.limiter.hit(&format!("tlogin:login:{}", r.login), 10, StdDuration::from_secs(900)).map_err(ApiError::RateLimited)?;
    if r.password.is_empty() || r.password.len() > 128 {
        return Err(ApiError::Unauthorized);
    }
    let row = sqlx::query(
        "SELECT c.trading_hash, c.investor_hash, c.locked_until, a.status FROM account_credentials c JOIN accounts a ON a.login = c.login
         WHERE c.login = $1 AND c.tenant_id = $2",
    )
    .bind(r.login)
    .bind(ctx.tenant.tenant_id)
    .fetch_optional(&st.pool)
    .await?;
    let Some(row) = row else {
        let pw = r.password.clone();
        let _ = tokio::task::spawn_blocking(move || auth::verify_password(&pw, auth::dummy_hash())).await;
        return Err(invalid_credentials());
    };
    if let Some(until) = row.get::<Option<DateTime<Utc>>, _>("locked_until")
        && until > Utc::now()
    {
        return Err(ApiError::Conflict { code: "locked", message: format!("Too many failed attempts. Try again after {}.", until.format("%H:%M UTC")) });
    }
    let (th, ih): (String, String) = (row.get("trading_hash"), row.get("investor_hash"));
    let pw = r.password.clone();
    let (is_trading, is_investor) = tokio::task::spawn_blocking(move || {
        let t = auth::verify_password(&pw, &th);
        (t, !t && auth::verify_password(&pw, &ih))
    })
    .await?;
    if !is_trading && !is_investor {
        sqlx::query(
            "UPDATE account_credentials SET failed_logins = failed_logins + 1,
                locked_until = CASE WHEN failed_logins + 1 >= 10 THEN now() + interval '15 minutes' ELSE locked_until END WHERE login = $1",
        )
        .bind(r.login)
        .execute(&st.pool)
        .await?;
        return Err(invalid_credentials());
    }
    if row.get::<String, _>("status") == Status::Expired.as_str() {
        return Err(ApiError::Forbidden("This demo account has expired.".into()));
    }
    sqlx::query("UPDATE account_credentials SET failed_logins = 0, locked_until = NULL WHERE login = $1").bind(r.login).execute(&st.pool).await?;
    st.limiter.clear(&format!("tlogin:login:{}", r.login));
    Ok(Json(create_session(&st, &ctx, r.login, is_investor, if is_investor { "investor_password" } else { "password" }).await?))
}

fn invalid_credentials() -> ApiError {
    ApiError::Conflict { code: "invalid_credentials", message: "Incorrect login or password.".into() }
}

#[derive(Deserialize)]
pub struct SsoReq {
    token: String,
}

/// Redeems a one-time SSO token minted by `POST /v1/accounts/{login}/sso` (CRM "Trade" button).
pub async fn sso(State(st): State<AppState>, ctx: Ctx, Body(r): Body<SsoReq>) -> ApiResult<Json<Value>> {
    st.limiter.hit(&format!("tsso:ip:{}", ctx.ip), 60, StdDuration::from_secs(300)).map_err(ApiError::RateLimited)?;
    let row = sqlx::query("UPDATE sso_tokens SET used_at = now() WHERE token_hash = $1 AND tenant_id = $2 AND used_at IS NULL AND expires_at > now() RETURNING login")
        .bind(st.keys.hash("sso", r.token.trim()))
        .bind(ctx.tenant.tenant_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::Unauthorized)?;
    Ok(Json(create_session(&st, &ctx, row.get("login"), false, "sso").await?))
}

pub async fn logout(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    if let Some(t) = ctx.bearer.as_deref() {
        sqlx::query("UPDATE terminal_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL").bind(st.keys.hash("terminal-session", t)).execute(&st.pool).await?;
    }
    Ok(Json(json!({"status": "ok"})))
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateQ {
    history_limit: Option<i64>,
}

pub async fn state(State(st): State<AppState>, ctx: Ctx, Query(q): Query<StateQ>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    let mut v = st
        .hub
        .read(
            s.login,
            Box::new(|x| match x {
                Some((a, env)) => json!({
                    "account": views::account_json(env, a),
                    "positions": a.positions.values().map(|p| views::position_json(env, a, p)).collect::<Vec<_>>(),
                    "orders": a.orders.values().map(views::order_json).collect::<Vec<_>>(),
                }),
                None => Value::Null,
            }),
        )
        .await;
    if v.is_null() {
        return Err(ApiError::NotFound("Account not found".into()));
    }
    let limit = q.history_limit.unwrap_or(50).clamp(0, 500);
    let (deals, _) = deals_page(&st, s.login, None, None, 0, limit).await?;
    v["history"] = json!({"deals": deals});
    v["readOnly"] = json!(s.read_only);
    v["serverTime"] = json!(Utc::now());
    Ok(Json(v))
}

#[derive(Deserialize)]
pub struct PageQ {
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Parses `2026-09-01` or an RFC 3339 instant.
pub fn parse_time(s: &Option<String>) -> ApiResult<Option<DateTime<Utc>>> {
    let Some(s) = s.as_deref().map(str::trim).filter(|s| !s.is_empty()) else { return Ok(None) };
    if let Ok(t) = DateTime::parse_from_rfc3339(s) {
        return Ok(Some(t.with_timezone(&Utc)));
    }
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Ok(Some(d.and_hms_opt(0, 0, 0).unwrap().and_utc()));
    }
    Err(ApiError::BadRequest(format!("Invalid date {s}")))
}

/// Deals of an account, newest first. Returns (items, total).
pub async fn deals_page(st: &AppState, login: i64, from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>, offset: i64, limit: i64) -> ApiResult<(Vec<Value>, i64)> {
    let rows = sqlx::query(
        "SELECT data, reversed, count(*) OVER () AS total FROM deals WHERE login = $1 AND ($2::timestamptz IS NULL OR time >= $2) AND ($3::timestamptz IS NULL OR time < $3)
         ORDER BY time DESC, id DESC OFFSET $4 LIMIT $5",
    )
    .bind(login)
    .bind(from)
    .bind(to)
    .bind(offset)
    .bind(limit)
    .fetch_all(&st.pool)
    .await?;
    let total = rows.first().map(|r| r.get::<i64, _>("total")).unwrap_or(0);
    let items = rows
        .iter()
        .map(|r| {
            let d: sqlx::types::Json<crate::model::Deal> = r.get("data");
            let mut v = views::deal_json(&d.0);
            v["reversed"] = json!(r.get::<bool, _>("reversed"));
            v
        })
        .collect();
    Ok((items, total))
}

pub async fn history(State(st): State<AppState>, ctx: Ctx, Query(q): Query<PageQ>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    Ok(Json(super::accounts::history_json(&st, s.login, &q).await?))
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OrderBody {
    pub symbol: String,
    pub side: String,
    #[serde(rename = "type", default)]
    pub kind: Option<String>,
    #[serde(deserialize_with = "de_dec")]
    pub volume: D,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub price: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub stop_limit: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub sl: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub tp: Option<D>,
    #[serde(default)]
    pub trailing_points: Option<i64>,
    #[serde(default)]
    pub expiry: Option<String>,
    #[serde(default)]
    pub expiry_at: Option<String>,
    #[serde(default)]
    pub deviation_points: Option<i64>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub requested_price: Option<D>,
    #[serde(default)]
    pub oco_with: Option<i64>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub client_order_id: Option<String>,
}

pub fn parse_side(s: &str) -> ApiResult<Side> {
    match s.to_ascii_lowercase().as_str() {
        "buy" => Ok(Side::Buy),
        "sell" => Ok(Side::Sell),
        _ => Err(ApiError::Validation { field: "side", message: "side must be buy or sell".into() }),
    }
}

pub fn parse_kind(s: Option<&str>) -> ApiResult<OrderType> {
    match s.unwrap_or("market").to_ascii_lowercase().replace('-', "_").as_str() {
        "market" => Ok(OrderType::Market),
        "limit" => Ok(OrderType::Limit),
        "stop" => Ok(OrderType::Stop),
        "stop_limit" => Ok(OrderType::StopLimit),
        _ => Err(ApiError::Validation { field: "type", message: "type must be market, limit, stop or stop_limit".into() }),
    }
}

/// `GTC` | `Today` | `Date` (+ `expiryAt`) | a date / RFC 3339 instant (= Date).
pub fn parse_expiry(expiry: Option<&str>, at: Option<&str>) -> ApiResult<(Expiry, Option<DateTime<Utc>>)> {
    let e = expiry.map(str::trim).unwrap_or("GTC");
    match e.to_ascii_lowercase().as_str() {
        "" | "gtc" => Ok((Expiry::Gtc, None)),
        "today" | "day" => Ok((Expiry::Today, None)),
        "date" | "specified" => {
            let t = parse_time(&at.map(str::to_string))?.ok_or(ApiError::Validation { field: "expiryAt", message: "expiryAt is required".into() })?;
            Ok((Expiry::Date, Some(t)))
        }
        _ => {
            // a bare date means "until the end of that server day"
            if let Ok(d) = NaiveDate::parse_from_str(e, "%Y-%m-%d") {
                return Ok((Expiry::Date, Some(crate::specs::server_midnight(d.succ_opt().unwrap()))));
            }
            let t = parse_time(&Some(e.to_string()))?.ok_or(ApiError::Validation { field: "expiry", message: "Invalid expiry".into() })?;
            Ok((Expiry::Date, Some(t)))
        }
    }
}

pub fn order_req(b: &OrderBody, default_source: Source) -> ApiResult<OrderReq> {
    let (expiry, expiry_at) = parse_expiry(b.expiry.as_deref(), b.expiry_at.as_deref())?;
    let source = match b.source.as_deref() {
        None | Some("") => default_source,
        Some(s) => Source::parse_client(s).ok_or(ApiError::Validation { field: "source", message: "unknown source".into() })?,
    };
    Ok(OrderReq {
        symbol: b.symbol.trim().to_uppercase(),
        side: parse_side(&b.side)?,
        kind: parse_kind(b.kind.as_deref())?,
        volume: b.volume,
        price: b.price,
        stop_limit: b.stop_limit,
        sl: b.sl,
        tp: b.tp,
        trailing_points: b.trailing_points,
        expiry,
        expiry_at,
        deviation_points: b.deviation_points,
        requested_price: b.requested_price,
        oco_with: b.oco_with,
        source,
        platform: b.platform.clone().unwrap_or_else(|| "Web".into()).chars().take(32).collect(),
        comment: b.comment.clone().unwrap_or_default().chars().take(128).collect(),
        client_order_id: b.client_order_id.clone(),
        book: None,
        dealer: None,
    })
}

pub fn place_json(r: &PlaceResult) -> Value {
    match r {
        PlaceResult::Filled { order_ticket, position_ticket, price, book, deals } => json!({"status": "filled", "orderTicket": order_ticket, "positionTicket": position_ticket, "price": num(*price), "book": book.as_str(), "deals": deals}),
        PlaceResult::Pending { ticket, price, book } => json!({"status": "placed", "ticket": ticket, "price": num(*price), "book": book.map(|b| b.as_str())}),
        PlaceResult::Duplicate { ticket } => json!({"status": "duplicate", "ticket": ticket}),
    }
}

/// D115 execution delay (dealer control, capped, only when the tenant allows it).
pub async fn exec_delay(st: &AppState, tenant: &TenantConfig, login: i64) -> u32 {
    if !tenant.policy.exec_delay_enabled {
        return 0;
    }
    let d = st.hub.meta(login).map(|m| m.exec_delay_ms).unwrap_or(0).min(tenant.policy.exec_delay_cap_ms).min(500);
    if d > 0 {
        tokio::time::sleep(StdDuration::from_millis(d as u64)).await;
    }
    d
}

fn with_notes(mut v: Value, notes: &[crate::engine::Note]) -> Value {
    if !notes.is_empty() {
        v["notifications"] = json!(notes.iter().map(|n| json!({"kind": n.kind, "message": n.message, "data": n.data})).collect::<Vec<_>>());
    }
    v
}

async fn run(st: &AppState, s: &Session, op: Op) -> ApiResult<Value> {
    let done = st.hub.exec(s.login, "client", None, "", "", None, op).await?;
    Ok(with_notes(done.value, &done.notes))
}

pub async fn place(State(st): State<AppState>, ctx: Ctx, Body(b): Body<OrderBody>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let req = order_req(&b, Source::Manual)?;
    let delay = if req.kind == OrderType::Market { exec_delay(&st, &ctx.tenant, s.login).await } else { 0 };
    let op: Op = Box::new(move |tx, env| trade::place_order(tx, env, req).map(|r| place_json(&r)));
    let mut v = run(&st, &s, op).await?;
    if delay > 0 {
        v["delayMs"] = json!(delay);
    }
    Ok(Json(v))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrderPatchBody {
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub price: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub stop_limit: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub volume: Option<D>,
    #[serde(default, deserialize_with = "crate::money::patch_dec")]
    pub sl: Option<Option<D>>,
    #[serde(default, deserialize_with = "crate::money::patch_dec")]
    pub tp: Option<Option<D>>,
    #[serde(default, deserialize_with = "patch_i64")]
    pub trailing_points: Option<Option<i64>>,
    #[serde(default)]
    pub expiry: Option<String>,
    #[serde(default)]
    pub expiry_at: Option<String>,
}

pub fn patch_i64<'de, De: serde::Deserializer<'de>>(d: De) -> Result<Option<Option<i64>>, De::Error> {
    Ok(Some(Option::<i64>::deserialize(d)?.filter(|v| *v != 0)))
}

pub fn order_patch(b: &OrderPatchBody) -> ApiResult<OrderPatch> {
    let (expiry, expiry_at) = match &b.expiry {
        Some(e) => {
            let (x, at) = parse_expiry(Some(e), b.expiry_at.as_deref())?;
            (Some(x), at)
        }
        None => (None, None),
    };
    Ok(OrderPatch { price: b.price, stop_limit: b.stop_limit, volume: b.volume, sl: b.sl, tp: b.tp, trailing_points: b.trailing_points, expiry, expiry_at })
}

pub async fn modify_order(State(st): State<AppState>, ctx: Ctx, Path(ticket): Path<String>, Body(b): Body<OrderPatchBody>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let ticket = parse_ticket(&ticket)?;
    let patch = order_patch(&b)?;
    let op: Op = Box::new(move |tx, env| trade::modify_order(tx, env, ticket, patch, None).map(|(_, o)| json!({"order": views::order_json(&o)})));
    Ok(Json(run(&st, &s, op).await?))
}

pub async fn cancel_order(State(st): State<AppState>, ctx: Ctx, Path(ticket): Path<String>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let ticket = parse_ticket(&ticket)?;
    let op: Op = Box::new(move |tx, env| trade::cancel_order(tx, env, ticket, "cancelled by client").map(|o| json!({"status": "cancelled", "ticket": o.ticket})));
    Ok(Json(run(&st, &s, op).await?))
}

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CloseBody {
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub volume: Option<D>,
    #[serde(default)]
    pub deviation_points: Option<i64>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub requested_price: Option<D>,
}

pub async fn close_position(State(st): State<AppState>, ctx: Ctx, Path(ticket): Path<String>, body: Option<Json<CloseBody>>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let ticket = parse_ticket(&ticket)?;
    let b = body.map(|b| b.0).unwrap_or_default();
    let delay = exec_delay(&st, &ctx.tenant, s.login).await;
    let req = CloseReq { volume: b.volume, deviation_points: b.deviation_points, requested_price: b.requested_price, ..Default::default() };
    let op: Op = Box::new(move |tx, env| trade::close_position(tx, env, ticket, req).map(|(deal, profit)| json!({"status": "closed", "dealId": deal, "profit": num(profit)})));
    let mut v = run(&st, &s, op).await?;
    if delay > 0 {
        v["delayMs"] = json!(delay);
    }
    Ok(Json(v))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PositionPatchBody {
    #[serde(default, deserialize_with = "crate::money::patch_dec")]
    pub sl: Option<Option<D>>,
    #[serde(default, deserialize_with = "crate::money::patch_dec")]
    pub tp: Option<Option<D>>,
    #[serde(default, deserialize_with = "patch_i64")]
    pub trailing_points: Option<Option<i64>>,
}

pub async fn modify_position(State(st): State<AppState>, ctx: Ctx, Path(ticket): Path<String>, Body(b): Body<PositionPatchBody>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let ticket = parse_ticket(&ticket)?;
    let patch = PositionPatch { sl: b.sl, tp: b.tp, trailing_points: b.trailing_points };
    let op: Op = Box::new(move |tx, env| trade::modify_position(tx, env, ticket, patch, None).map(|(_, p)| json!({"position": views::position_json(env, &tx.st, &p)})));
    Ok(Json(run(&st, &s, op).await?))
}

#[derive(Deserialize)]
pub struct CloseByBody {
    ticket: i64,
    by: i64,
}

pub async fn close_by(State(st): State<AppState>, ctx: Ctx, Body(b): Body<CloseByBody>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let op: Op = Box::new(move |tx, env| trade::close_by(tx, env, b.ticket, b.by).map(|deals| json!({"status": "closed", "deals": deals})));
    Ok(Json(run(&st, &s, op).await?))
}

#[derive(Deserialize)]
pub struct BulkBody {
    filter: String,
    #[serde(default)]
    symbol: Option<String>,
}

pub async fn bulk_close(State(st): State<AppState>, ctx: Ctx, Body(b): Body<BulkBody>) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    s.writable()?;
    let filter = match b.filter.as_str() {
        "all" => BulkFilter::All,
        "profitable" => BulkFilter::Profitable,
        "losing" => BulkFilter::Losing,
        "pending" => BulkFilter::Pending,
        "buys" => BulkFilter::Buys,
        "sells" => BulkFilter::Sells,
        _ => return Err(ApiError::Validation { field: "filter", message: "filter must be all, profitable, losing, pending, buys or sells".into() }),
    };
    let symbol = b.symbol.map(|x| x.to_uppercase());
    let op: Op = Box::new(move |tx, env| {
        let out = trade::bulk_close(tx, env, filter, symbol.as_deref());
        Ok(json!({"done": out.done, "failed": out.failed.iter().map(|(t, e)| json!({"ticket": t, "error": e})).collect::<Vec<_>>(), "profit": num(out.profit)}))
    });
    Ok(Json(run(&st, &s, op).await?))
}

/// One-time ticket for `GET /v1/terminal/stream?ticket=` (valid 30 s).
pub async fn stream_ticket(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let s = session(&st, &ctx).await?;
    let t = st.tickets.issue(&st.keys, auth::StreamGrant::Account { tenant_id: s.tenant_id, login: s.login, read_only: s.read_only });
    Ok(Json(json!({"ticket": t, "expiresIn": 30})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn investor_sessions_are_read_only() {
        let inv = Session { login: 1, tenant_id: 1, read_only: true };
        assert!(matches!(inv.writable(), Err(ApiError::ReadOnly)));
        let tr = Session { login: 1, tenant_id: 1, read_only: false };
        assert!(tr.writable().is_ok());
    }

    #[test]
    fn parses_order_bodies() {
        assert_eq!(parse_kind(Some("stop-limit")).unwrap(), OrderType::StopLimit);
        assert!(parse_kind(Some("iceberg")).is_err());
        assert_eq!(parse_expiry(Some("Today"), None).unwrap().0, Expiry::Today);
        let (e, at) = parse_expiry(Some("2026-09-30"), None).unwrap();
        assert_eq!(e, Expiry::Date);
        assert_eq!(at.unwrap().to_rfc3339(), "2026-09-30T21:00:00+00:00"); // end of that server day
        let b: OrderBody = serde_json::from_str(r#"{"symbol":"eurusd","side":"buy","volume":"0.10","sl":1.1,"source":"api"}"#).unwrap();
        let r = order_req(&b, Source::Manual).unwrap();
        assert_eq!((r.symbol.as_str(), r.volume.to_string().as_str(), r.source), ("EURUSD", "0.10", Source::Api));
        let bad: OrderBody = serde_json::from_str(r#"{"symbol":"EURUSD","side":"buy","volume":1,"source":"dealer"}"#).unwrap();
        assert!(order_req(&bad, Source::Manual).is_err()); // clients cannot claim the dealer source
    }

    #[test]
    fn patch_semantics() {
        let p: PositionPatchBody = serde_json::from_str(r#"{"sl":null,"tp":1.2}"#).unwrap();
        assert_eq!(p.sl, Some(None));
        assert_eq!(p.tp, Some(Some(D::from_str_exact("1.2").unwrap())));
        assert_eq!(p.trailing_points, None);
    }
}

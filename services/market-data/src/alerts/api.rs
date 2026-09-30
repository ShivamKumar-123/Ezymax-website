//! Internal HTTP API for price alerts: the Client Area BFF (`/api/mobile/alerts…`) calls it for the signed-in client.
//! The public edge never serves `/v1/internal/*`.
//!
//! Every route needs `X-Kalks-Internal: $MARKET_DATA_INTERNAL_TOKEN` and `X-Kalks-User-Id` (the client the BFF
//! resolved from the session); `X-Kalks-Tenant` scopes everything (default `kalks`). Every query is scoped by tenant
//! and user, so a client only ever sees and changes its own alerts. Errors: `{"error": {"code", "message", "field"?}}`.
//!
//! | Method & path | Body | Response |
//! |---|---|---|
//! | `GET /v1/internal/alerts?symbol=` | – | `{items, limit, live}`: live alerts (newest first), then finished ones |
//! | `POST /v1/internal/alerts` | `{symbol, condition, value, basis?, group?, repeat?, expiresAt?, note?}` | 201 `{alert}` |
//! | `PATCH /v1/internal/alerts/{id}` | `{condition?, value?, basis?, group?, repeat?, expiresAt? (null = never), note?, active?}` | `{alert}` |
//! | `DELETE /v1/internal/alerts/{id}` | – | `{ok}` |
//! | `GET /v1/internal/alerts/history?before=&limit=&symbol=` | – | `{items, next}` (newest first) |
//! | `DELETE /v1/internal/alerts/history` | – | `{ok, cleared}` (hidden from the history; delivery is unaffected) |
//!
//! Codes: `validation` (422, with `field`), `level_reached` (409: the price is already past the level),
//! `no_price` (409), `limit` (409: `ALERTS_MAX_PER_USER` live alerts), `not_found` (404), `unauthorized` (401),
//! `unavailable` (503: the internal token is not configured).

use axum::extract::{Path, Query, Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch};
use axum::{Json, Router};
use chrono::{DateTime, Duration as Span, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::Arc;

use super::rules::{self, Basis, Cond, Refusal};
use super::store::{self, ALERT_COLS, AlertRow, EVENT_COLS};
use super::Alerts;
use crate::instruments::Instrument;

pub const DEFAULT_TENANT: &str = "kalks";
pub const DEFAULT_GROUP: &str = "standard";
/// Longest expiry a client can set.
const MAX_EXPIRY_DAYS: i64 = 366;

pub fn router(alerts: Arc<Alerts>) -> Router {
    Router::new()
        .route("/v1/internal/alerts", get(list).post(create))
        .route("/v1/internal/alerts/history", get(history).delete(clear_history))
        .route("/v1/internal/alerts/{id}", patch(update).delete(remove))
        // `route_layer`, not `layer`: the token check runs only on these routes. As a `layer` it also wrapped the
        // router's fallback, and main.rs merges this router with the public one, so every unknown path of the
        // service (public at api.<domain>) answered 401 "Internal token required." (503 without a token) instead of 404.
        .route_layer(middleware::from_fn_with_state(alerts.clone(), internal_only))
        .with_state(alerts)
}

/* ------------------------------------------------------------------ */
/* Errors and request context                                          */
/* ------------------------------------------------------------------ */

#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
    field: Option<&'static str>,
}

impl ApiError {
    fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self { status, code, message: message.into(), field: None }
    }
    fn invalid(field: &'static str, message: impl Into<String>) -> Self {
        Self { status: StatusCode::UNPROCESSABLE_ENTITY, code: "validation", message: message.into(), field: Some(field) }
    }
    fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", "Alert not found.")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut e = json!({"code": self.code, "message": self.message});
        if let Some(f) = self.field {
            e["field"] = json!(f);
        }
        (self.status, Json(json!({ "error": e }))).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        tracing::error!(error = %e, "price alerts internal error");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal", "Something went wrong. Please try again.")
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        anyhow::Error::from(e).into()
    }
}

type R<T = Json<Value>> = Result<T, ApiError>;

async fn internal_only(State(a): State<Arc<Alerts>>, req: Request, next: Next) -> Response {
    if a.cfg.internal_token.is_empty() {
        return ApiError::new(StatusCode::SERVICE_UNAVAILABLE, "unavailable", "Price alerts are not available right now.").into_response();
    }
    let got = req.headers().get("x-kalks-internal").map(|v| v.as_bytes()).unwrap_or(b"");
    if !rules::same_secret(got, a.cfg.internal_token.as_bytes()) {
        return ApiError::new(StatusCode::UNAUTHORIZED, "unauthorized", "Internal token required.").into_response();
    }
    next.run(req).await
}

/// The client the BFF acts for.
struct Owner {
    tenant: String,
    user: i64,
}

fn owner(h: &HeaderMap) -> R<Owner> {
    let t = h.get("x-kalks-tenant").and_then(|v| v.to_str().ok()).unwrap_or(DEFAULT_TENANT).trim().to_ascii_lowercase();
    let tenant = if !t.is_empty() && t.len() <= 64 && t.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_') { t } else { DEFAULT_TENANT.to_string() };
    let user = h
        .get("x-kalks-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<i64>().ok())
        .filter(|v| *v > 0)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "unauthorized", "Missing user."))?;
    Ok(Owner { tenant, user })
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

fn str_field<'a>(b: &'a Value, k: &'static str) -> R<Option<&'a str>> {
    match b.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => Ok(Some(s.as_str())),
        Some(_) => Err(ApiError::invalid(k, format!("{k} must be text."))),
    }
}

fn num_field(b: &Value, k: &'static str) -> R<Option<f64>> {
    match b.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(n)) => n.as_f64().filter(|v| v.is_finite()).map(Some).ok_or_else(|| ApiError::invalid(k, "Enter a number.")),
        Some(Value::String(s)) => s.trim().parse::<f64>().ok().filter(|v| v.is_finite()).map(Some).ok_or_else(|| ApiError::invalid(k, "Enter a number.")),
        Some(_) => Err(ApiError::invalid(k, "Enter a number.")),
    }
}

fn bool_field(b: &Value, k: &'static str) -> R<Option<bool>> {
    match b.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(v)) => Ok(Some(*v)),
        Some(_) => Err(ApiError::invalid(k, format!("{k} must be true or false."))),
    }
}

fn cond_field(b: &Value) -> R<Option<Cond>> {
    str_field(b, "condition")?.map(|s| Cond::parse(s.trim()).ok_or_else(|| ApiError::invalid("condition", "Choose above, below, up by % or down by %."))).transpose()
}

fn basis_field(b: &Value) -> R<Option<Basis>> {
    str_field(b, "basis")?.map(|s| Basis::parse(s.trim()).ok_or_else(|| ApiError::invalid("basis", "Choose the bid or the ask."))).transpose()
}

fn group_field(b: &Value) -> R<Option<String>> {
    str_field(b, "group")?.map(|s| rules::clean_group(s).ok_or_else(|| ApiError::invalid("group", "Unknown account group."))).transpose()
}

/// `expiresAt`: absent = unchanged (None), null = never (Some(None)), else an instant at least a minute and at most
/// a year ahead.
fn expiry_field(b: &Value) -> R<Option<Option<DateTime<Utc>>>> {
    match b.get("expiresAt") {
        None => Ok(None),
        Some(Value::Null) => Ok(Some(None)),
        Some(Value::String(s)) => {
            let t = DateTime::parse_from_rfc3339(s.trim()).map_err(|_| ApiError::invalid("expiresAt", "Choose when the alert expires."))?.with_timezone(&Utc);
            let now = Utc::now();
            if t < now + Span::seconds(60) {
                return Err(ApiError::invalid("expiresAt", "Choose an expiry in the future."));
            }
            if t > now + Span::days(MAX_EXPIRY_DAYS) {
                return Err(ApiError::invalid("expiresAt", "An alert can run for a year at most."));
            }
            Ok(Some(Some(t)))
        }
        Some(_) => Err(ApiError::invalid("expiresAt", "Choose when the alert expires.")),
    }
}

/// The price an alert on `symbol` is judged on right now (the group's bid or ask).
fn price_now(a: &Alerts, inst: &Instrument, group: &str, basis: Basis) -> Option<f64> {
    let q = a.market.spreads.apply(group, inst, a.market.quote(&inst.symbol)?);
    let p = match basis {
        Basis::Bid => q.bid,
        Basis::Ask => q.ask,
    };
    (p > 0.0).then_some(p)
}

/// The value as stored: a level on the symbol's digits, a move on two decimals.
fn normalize(cond: Cond, value: f64, inst: &Instrument) -> f64 {
    if cond.is_level() { inst.round(value) } else { (value * 100.0).round() / 100.0 }
}

/// Checks `value` against the market and gives the (reference, target) the alert starts from. `strict` = the level
/// must not be reached yet (a live alert); a paused one is only checked for a usable value.
fn arm(a: &Alerts, inst: &Instrument, cond: Cond, value: f64, basis: Basis, group: &str, strict: bool) -> R<(Option<f64>, f64)> {
    let price = price_now(a, inst, group, basis).ok_or_else(|| ApiError::new(StatusCode::CONFLICT, "no_price", format!("There is no price for {} yet. Try again in a moment.", inst.symbol)))?;
    match rules::check(cond, value, price, inst) {
        Ok(()) => {}
        Err(Refusal::Invalid(msg)) => return Err(ApiError::invalid("value", msg)),
        Err(Refusal::TooFar) => return Err(ApiError::invalid("value", format!("That level is too far from the market ({} {}).", basis.as_str(), rules::px(price, inst.digits)))),
        Err(Refusal::Reached) if strict => {
            let (side, pick) = if cond == Cond::Above { ("above", "a higher") } else { ("below", "a lower") };
            return Err(ApiError {
                status: StatusCode::CONFLICT,
                code: "level_reached",
                message: format!("{} is already {side} {} ({} {}). Choose {pick} level.", inst.symbol, rules::px(inst.round(value), inst.digits), basis.as_str(), rules::px(price, inst.digits)),
                field: Some("value"),
            });
        }
        Err(Refusal::Reached) => {}
    }
    let reference = (!cond.is_level()).then_some(price);
    let target = rules::target_of(cond, value, price, inst);
    // a move too small for the symbol's price step would fire at once
    if !cond.is_level() && ((cond == Cond::ChangeUp && target <= price) || (cond == Cond::ChangeDown && target >= price)) {
        return Err(ApiError::invalid("value", "That move is smaller than the symbol's price step. Choose a bigger one."));
    }
    Ok((reference, target))
}

fn is_live(status: &str) -> bool {
    status == "active" || status == "paused"
}

/// Serializes changes to one client's alerts (the live-alert limit).
async fn lock_owner(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, o: &Owner) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))").bind(format!("price_alerts:{}:{}", o.tenant, o.user)).execute(&mut **tx).await?;
    Ok(())
}

async fn live_count(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, o: &Owner, except: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT count(*) FROM price_alerts WHERE tenant = $1 AND user_id = $2 AND status IN ('active', 'paused') AND id <> $3").bind(&o.tenant).bind(o.user).bind(except).fetch_one(&mut **tx).await
}

fn limit_error(max: i64) -> ApiError {
    ApiError::new(StatusCode::CONFLICT, "limit", format!("You can have up to {max} alerts. Delete one to add another."))
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
struct ListQ {
    symbol: Option<String>,
}

async fn list(State(a): State<Arc<Alerts>>, h: HeaderMap, Query(q): Query<ListQ>) -> R {
    let o = owner(&h)?;
    let symbol = q.symbol.map(|s| s.trim().to_ascii_uppercase()).filter(|s| !s.is_empty());
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {ALERT_COLS} FROM price_alerts WHERE tenant = $1 AND user_id = $2 AND ($3::text IS NULL OR symbol = $3)
         ORDER BY (status IN ('active', 'paused')) DESC, CASE WHEN status IN ('active', 'paused') THEN id ELSE 0 END DESC, updated_at DESC
         LIMIT 200"
    )))
    .bind(&o.tenant)
    .bind(o.user)
    .bind(symbol)
    .fetch_all(a.pool())
    .await?;
    let items = rows.iter().map(|r| AlertRow::from_row(r).map(|x| x.json())).collect::<anyhow::Result<Vec<_>>>()?;
    let live: i64 = sqlx::query_scalar("SELECT count(*) FROM price_alerts WHERE tenant = $1 AND user_id = $2 AND status IN ('active', 'paused')").bind(&o.tenant).bind(o.user).fetch_one(a.pool()).await?;
    Ok(Json(json!({"items": items, "limit": a.cfg.max_per_user, "live": live})))
}

async fn create(State(a): State<Arc<Alerts>>, h: HeaderMap, Json(b): Json<Value>) -> R<(StatusCode, Json<Value>)> {
    let o = owner(&h)?;
    let symbol = str_field(&b, "symbol")?.map(|s| s.trim().to_ascii_uppercase()).unwrap_or_default();
    let inst = a.market.cat.get(&symbol).ok_or_else(|| ApiError::invalid("symbol", "Choose a symbol."))?.clone();
    let cond = cond_field(&b)?.ok_or_else(|| ApiError::invalid("condition", "Choose above, below, up by % or down by %."))?;
    let raw = num_field(&b, "value")?.ok_or_else(|| ApiError::invalid("value", if cond.is_level() { "Enter a price." } else { "Enter a percentage." }))?;
    let value = normalize(cond, raw, &inst);
    let basis = basis_field(&b)?.unwrap_or(Basis::Bid);
    let group = group_field(&b)?.unwrap_or_else(|| DEFAULT_GROUP.to_string());
    let repeat = bool_field(&b, "repeat")?.unwrap_or(false);
    let expires = expiry_field(&b)?.flatten();
    let note = rules::clean_note(str_field(&b, "note")?.unwrap_or(""));
    let (reference, target) = arm(&a, &inst, cond, value, basis, &group, true)?;

    let mut tx = a.pool().begin().await?;
    lock_owner(&mut tx, &o).await?;
    if live_count(&mut tx, &o, 0).await? >= a.cfg.max_per_user {
        return Err(limit_error(a.cfg.max_per_user));
    }
    let row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "INSERT INTO price_alerts (tenant, user_id, symbol, spread_group, condition, value, basis, reference, target, repeat, note, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING {ALERT_COLS}"
    )))
    .bind(&o.tenant)
    .bind(o.user)
    .bind(&inst.symbol)
    .bind(&group)
    .bind(cond.as_str())
    .bind(value)
    .bind(basis.as_str())
    .bind(reference)
    .bind(target)
    .bind(repeat)
    .bind(&note)
    .bind(expires)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    let alert = AlertRow::from_row(&row)?;
    a.set_live(&alert.symbol, alert.id, alert.live());
    tracing::info!(alert = alert.id, symbol = %alert.symbol, condition = cond.as_str(), target, "price alert set");
    Ok((StatusCode::CREATED, Json(json!({"alert": alert.json()}))))
}

async fn update(State(a): State<Arc<Alerts>>, h: HeaderMap, Path(id): Path<i64>, Json(b): Json<Value>) -> R {
    let o = owner(&h)?;
    let cond_in = cond_field(&b)?;
    let value_in = num_field(&b, "value")?;
    let basis_in = basis_field(&b)?;
    let group_in = group_field(&b)?;
    let repeat_in = bool_field(&b, "repeat")?;
    let expiry_in = expiry_field(&b)?;
    let note_in = str_field(&b, "note")?.map(rules::clean_note);
    let active_in = bool_field(&b, "active")?;

    let mut tx = a.pool().begin().await?;
    lock_owner(&mut tx, &o).await?;
    let row = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {ALERT_COLS} FROM price_alerts WHERE id = $1 AND tenant = $2 AND user_id = $3 FOR UPDATE")))
        .bind(id)
        .bind(&o.tenant)
        .bind(o.user)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let cur = AlertRow::from_row(&row)?;
    let inst = a.market.cat.get(&cur.symbol).ok_or_else(|| ApiError::new(StatusCode::CONFLICT, "unavailable", "This symbol is no longer available."))?.clone();

    let mut next = cur.clone();
    if let Some(c) = cond_in {
        next.cond = c;
    }
    if let Some(v) = value_in {
        next.value = normalize(next.cond, v, &inst);
    } else if next.cond.is_level() != cur.cond.is_level() {
        return Err(ApiError::invalid("value", if next.cond.is_level() { "Enter a price." } else { "Enter a percentage." }));
    }
    if let Some(bs) = basis_in {
        next.basis = bs;
    }
    if let Some(g) = group_in {
        next.group = g;
    }
    if let Some(r) = repeat_in {
        next.repeat = r;
    }
    if let Some(e) = expiry_in {
        next.expires_at = e;
    }
    if let Some(n) = note_in {
        next.note = n;
    }
    let setup_changed = next.cond != cur.cond || next.value != cur.value || next.basis != cur.basis || next.group != cur.group;
    // live after this change? `active` decides; without it an alert keeps its state
    let wants_live = active_in.unwrap_or(cur.status == "active");
    if wants_live {
        let rearm = setup_changed || cur.status != "active";
        if !is_live(&cur.status) && live_count(&mut tx, &o, cur.id).await? >= a.cfg.max_per_user {
            return Err(limit_error(a.cfg.max_per_user));
        }
        if next.expires_at.is_some_and(|e| e < Utc::now() + Span::seconds(60)) {
            return Err(ApiError::invalid("expiresAt", "Choose an expiry in the future."));
        }
        if rearm {
            let (reference, target) = arm(&a, &inst, next.cond, next.value, next.basis, &next.group, true)?;
            next.reference = reference;
            next.target = target;
            next.armed = true;
        }
        next.status = "active".into();
    } else {
        if setup_changed {
            // judged against the market again when resumed
            let (reference, target) = arm(&a, &inst, next.cond, next.value, next.basis, &next.group, false)?;
            next.reference = reference;
            next.target = target;
            next.armed = true;
        }
        if is_live(&cur.status) {
            next.status = "paused".into();
        }
    }
    let row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "UPDATE price_alerts SET condition = $2, value = $3, basis = $4, spread_group = $5, reference = $6, target = $7, repeat = $8, armed = $9,
                status = $10, note = $11, expires_at = $12, rev = rev + 1, updated_at = now()
         WHERE id = $1 RETURNING {ALERT_COLS}"
    )))
    .bind(cur.id)
    .bind(next.cond.as_str())
    .bind(next.value)
    .bind(next.basis.as_str())
    .bind(&next.group)
    .bind(next.reference)
    .bind(next.target)
    .bind(next.repeat)
    .bind(next.armed)
    .bind(&next.status)
    .bind(&next.note)
    .bind(next.expires_at)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    let alert = AlertRow::from_row(&row)?;
    a.set_live(&alert.symbol, alert.id, alert.live());
    Ok(Json(json!({"alert": alert.json()})))
}

async fn remove(State(a): State<Arc<Alerts>>, h: HeaderMap, Path(id): Path<i64>) -> R {
    let o = owner(&h)?;
    let row = sqlx::query("DELETE FROM price_alerts WHERE id = $1 AND tenant = $2 AND user_id = $3 RETURNING symbol")
        .bind(id)
        .bind(&o.tenant)
        .bind(o.user)
        .fetch_optional(a.pool())
        .await?
        .ok_or_else(ApiError::not_found)?;
    a.set_live(&row.get::<String, _>("symbol"), id, None);
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
struct HistoryQ {
    before: Option<i64>,
    limit: Option<i64>,
    symbol: Option<String>,
}

async fn history(State(a): State<Arc<Alerts>>, h: HeaderMap, Query(q): Query<HistoryQ>) -> R {
    let o = owner(&h)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let symbol = q.symbol.map(|s| s.trim().to_ascii_uppercase()).filter(|s| !s.is_empty());
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {EVENT_COLS} FROM price_alert_events
         WHERE tenant = $1 AND user_id = $2 AND NOT cleared AND ($3::bigint IS NULL OR id < $3) AND ($4::text IS NULL OR symbol = $4)
         ORDER BY id DESC LIMIT $5"
    )))
    .bind(&o.tenant)
    .bind(o.user)
    .bind(q.before)
    .bind(symbol)
    .bind(limit)
    .fetch_all(a.pool())
    .await?;
    let items = rows.iter().map(store::event_json).collect::<anyhow::Result<Vec<_>>>()?;
    let next = if rows.len() as i64 == limit { rows.last().map(|r| r.get::<i64, _>("id")) } else { None };
    Ok(Json(json!({"items": items, "next": next})))
}

async fn clear_history(State(a): State<Arc<Alerts>>, h: HeaderMap) -> R {
    let o = owner(&h)?;
    let n = sqlx::query("UPDATE price_alert_events SET cleared = TRUE WHERE tenant = $1 AND user_id = $2 AND NOT cleared").bind(&o.tenant).bind(o.user).execute(a.pool()).await?.rows_affected();
    Ok(Json(json!({"ok": true, "cleared": n})))
}

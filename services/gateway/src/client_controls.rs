//! Client controls for the Back Office: who is online, per-client restrictions, and staff sessions opened as
//! the client ("log in as client").
//!
//! **Presence.** `users.last_active_at` moves forward (at most every 30 s) with the client's own Client Area
//! requests and heartbeat (`identity::resolve_session_any`) and with the trading engine's reports of live Kalks
//! Trader connections (`POST /v1/internal/presence/trader`, every 15 s, table `client_presence`). A client is
//! Online when active in the last 2 minutes, Away up to 15 minutes, Offline after that. View-only logins and
//! staff sessions never count as the client being online.
//!
//! **Restrictions** (`client_restrictions`, one open row per client and kind, with a reason, an optional expiry and
//! the staff author; lifting or expiry closes the row, so the table is also the history). Kinds: `login` (sign-in
//! blocked: the account is suspended, every session ends), `trading`, `close_only`, `deposits`, `withdrawals`,
//! `transfers` (wallet <-> trading account), `ib` (IB commissions and payouts), `social` (copy trading, PAMM, MAM)
//! and `freeze` (every restriction except sign-in). The owning services enforce them: the gateway (sign-in),
//! the trading engine (`GET /v1/internal/restrictions`, cached and pushed) and the wallet (per request, through
//! `GET /v1/internal/users/{id}`). `login` needs `clients.block`, every other kind `clients.restrict`.
//!
//! **Staff sessions.** `POST /v1/admin/users/{id}/impersonate` (`clients.impersonate`, a reason) returns a one-time
//! 60 s ticket; the Client Area redeems it (`POST /v1/auth/impersonate/redeem`) for a 30-minute session of the
//! client bound to the staff member's own Back Office session. Read-only by default: every change is refused
//! (`identity::resolve_session`, and the Client Area proxy for the other services). `full` needs
//! `clients.impersonate_full`, which only the Super Admin (and the Platform Owner) holds, plus a confirmation.
//! Start, end, every action and every refused change are audited with the staff id; the client's sign-in
//! history shows "Staff access by <broker> support". The client's password is never needed or shown.
//!
//! Routes:
//! * `GET  /v1/admin/presence`                                 Online now / Away lists and counts (`clients.read`)
//! * `GET  /v1/admin/users/{id}/controls`                      presence + devices, restrictions, history, staff sessions
//! * `PUT  /v1/admin/users/{id}/restrictions/{kind}`           `{reason, expires_at?}` set or replace
//! * `POST /v1/admin/users/{id}/restrictions/{kind}/lift`      `{reason}`
//! * `POST /v1/admin/restrictions/bulk`                        `{user_ids[], kind, action: set|lift, reason, expires_at?}`
//! * `POST /v1/admin/users/{id}/impersonate`                   `{reason, mode: read_only|full, confirm?}` → `{ticket}`
//! * `POST /v1/admin/users/{id}/impersonate/trader`            `{login, reason, mode, confirm?}` (the BFF then asks the engine for SSO)
//! * `POST /v1/admin/impersonations/{session_id}/end`          ends a staff session from the Back Office
//! * `POST /v1/auth/impersonate/redeem`                        `{ticket}` → `{session}` (Client Area BFF)
//! * `POST /v1/auth/heartbeat`                                 open Client Area tab (presence) → `{restrictions}`
//! * `POST /v1/auth/impersonation/event`                       `{kind: action|write_refused|page_view, method, path}` (staff sessions only)
//! * `GET  /v1/internal/restrictions`                          every active restriction (trading engine cache)
//! * `POST /v1/internal/presence/trader`                       `{items[], ended[]}` (trading engine)
//! * `POST /v1/internal/impersonation/ended`                   `{staff_id, user_id, login}` (Kalks Trader BFF)

use axum::Json;
use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::BTreeMap;

use crate::admin::{Staff, require_key};
use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::crypto;
use crate::error::{ApiError, ApiResult};
use crate::identity::{self, Impersonation, Kind, SessionRef};
use crate::state::{AppState, Ctx};

// ---------- presence ----------

/// Active in the last 2 minutes.
pub const ONLINE_SECS: i64 = 120;
/// Idle for 2–15 minutes.
pub const AWAY_SECS: i64 = 15 * 60;
/// A Kalks Trader connection is live while the engine reported it in the last 60 s (it reports every 15 s).
pub const TRADER_LIVE_SECS: i64 = 60;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Presence {
    Online,
    Away,
    Offline,
}

impl Presence {
    pub fn as_str(self) -> &'static str {
        match self {
            Presence::Online => "online",
            Presence::Away => "away",
            Presence::Offline => "offline",
        }
    }
}

/// Online / Away / Offline from the client's last activity.
pub fn presence(last_active: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Presence {
    match last_active {
        Some(t) if now - t < Duration::seconds(ONLINE_SECS) => Presence::Online,
        Some(t) if now - t < Duration::seconds(AWAY_SECS) => Presence::Away,
        _ => Presence::Offline,
    }
}

// ---------- restrictions ----------

pub const KINDS: &[&str] = &["login", "trading", "close_only", "deposits", "withdrawals", "transfers", "ib", "social", "freeze"];

/// What `freeze` stands for: every restriction except sign-in (the client can still sign in and see the notice).
pub const FREEZE: &[&str] = &["trading", "deposits", "withdrawals", "transfers", "ib", "social"];

pub fn kind(raw: &str) -> Option<&'static str> {
    KINDS.iter().copied().find(|k| *k == raw.trim())
}

pub fn label(kind: &str) -> &'static str {
    match kind {
        "login" => "Sign-in blocked",
        "trading" => "Trading disabled",
        "close_only" => "Close-only",
        "deposits" => "Deposits disabled",
        "withdrawals" => "Withdrawals disabled",
        "transfers" => "Transfers disabled",
        "ib" => "IB commissions and payouts disabled",
        "social" => "Copy trading, PAMM and MAM disabled",
        "freeze" => "Account frozen",
        _ => "Restricted",
    }
}

/// The permission a staff member needs to set or lift a restriction of `kind`.
pub fn perm_for(kind: &str) -> &'static str {
    if kind == "login" { "clients.block" } else { "clients.restrict" }
}

/// Effective restrictions: `freeze` expanded; per kind the longest expiry wins (`None` = until lifted).
pub fn expand(active: &[(String, Option<DateTime<Utc>>)]) -> BTreeMap<&'static str, Option<DateTime<Utc>>> {
    let mut out: BTreeMap<&'static str, Option<DateTime<Utc>>> = BTreeMap::new();
    let mut put = |k: &'static str, exp: Option<DateTime<Utc>>| {
        let e = out.entry(k).or_insert(exp);
        *e = match (*e, exp) {
            (None, _) | (_, None) => None,
            (Some(a), Some(b)) => Some(a.max(b)),
        };
    };
    for (k, exp) in active {
        match k.as_str() {
            "freeze" => FREEZE.iter().for_each(|f| put(f, *exp)),
            other => {
                if let Some(k) = kind(other) {
                    put(k, *exp);
                }
            }
        }
    }
    out
}

/// Reason: 3–500 characters, no control characters except new lines.
pub fn clean_reason(raw: &str) -> ApiResult<String> {
    let r: String = raw.trim().chars().filter(|c| !c.is_control() || *c == '\n').take(500).collect();
    if r.chars().count() < 3 {
        return Err(ApiError::Validation { field: "reason", message: "Give a reason (at least 3 characters)." });
    }
    Ok(r)
}

/// Optional expiry: at least a minute ahead, at most 5 years.
pub fn clean_expiry(v: Option<DateTime<Utc>>, now: DateTime<Utc>) -> ApiResult<Option<DateTime<Utc>>> {
    match v {
        Some(t) if t <= now + Duration::minutes(1) => Err(ApiError::Validation { field: "expires_at", message: "The expiry must be in the future." }),
        Some(t) if t > now + Duration::days(5 * 366) => Err(ApiError::Validation { field: "expires_at", message: "Choose an expiry within 5 years." }),
        other => Ok(other),
    }
}

/// Active (open, unexpired) restriction kinds of a client with their expiry.
pub async fn active_kinds(pool: &sqlx::PgPool, user_id: i64) -> ApiResult<Vec<(String, Option<DateTime<Utc>>)>> {
    Ok(sqlx::query_as("SELECT kind, expires_at FROM client_restrictions WHERE user_id = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()) ORDER BY kind")
        .bind(user_id)
        .fetch_all(pool)
        .await?)
}

/// Effective restriction kinds of a client (freeze expanded), for the wallet and the Client Area.
pub async fn effective_kinds(pool: &sqlx::PgPool, user_id: i64) -> ApiResult<Vec<String>> {
    Ok(expand(&active_kinds(pool, user_id).await?).into_keys().map(String::from).collect())
}

/// What the client sees: `{restrictions: [{kind, expires_at}], restricted: [effective kinds]}`.
pub async fn client_view(pool: &sqlx::PgPool, user_id: i64) -> ApiResult<Value> {
    let active = active_kinds(pool, user_id).await?;
    let restricted: Vec<&str> = expand(&active).into_keys().collect();
    Ok(json!({
        "restrictions": active.iter().map(|(k, e)| json!({ "kind": k, "label": label(k), "expires_at": e })).collect::<Vec<_>>(),
        "restricted": restricted,
    }))
}

// ---------- errors ----------

pub fn account_suspended() -> ApiError {
    ApiError::Coded { status: StatusCode::FORBIDDEN, code: "account_suspended", message: "This account is suspended. Contact support." }
}

/// Sign-in refused for a client that is not active.
pub fn inactive_error(status: &str) -> ApiError {
    if status == "blocked" { account_suspended() } else { ApiError::AccountDisabled }
}

pub fn staff_read_only() -> ApiError {
    ApiError::Coded { status: StatusCode::FORBIDDEN, code: "staff_read_only", message: "This is a read-only staff session. Changes are not allowed." }
}

// ---------- staff sessions (impersonation) ----------

/// Staff session tokens (read-only / full), so the Client Area proxy can hold them before any lookup. The gateway
/// never trusts the prefix: `sessions.impersonator_*` decides.
pub const READ_ONLY_PREFIX: &str = "i.";
pub const FULL_PREFIX: &str = "s.";
pub const STAFF_SESSION_MINUTES: i64 = 30;
const TICKET_SECS: i64 = 60;

/// The staff member behind a staff session is still signed in to the Back Office and active.
pub async fn staff_session_live(st: &AppState, staff_id: i64, staff_session_id: i64) -> ApiResult<bool> {
    let ok: Option<bool> = sqlx::query_scalar(
        "SELECT s.status = 'active' AND se.revoked_at IS NULL AND se.expires_at > now() AND se.subject_kind = 'staff' AND se.subject_id = s.id
         FROM staff s JOIN sessions se ON se.id = $2 WHERE s.id = $1",
    )
    .bind(staff_id)
    .bind(staff_session_id)
    .fetch_optional(&st.pool)
    .await?;
    Ok(ok == Some(true))
}

fn staff_entry<'a>(tenant_id: i64, staff_id: i64, user_id: i64, action: &'a str, meta: Value) -> Entry<'a> {
    Entry { tenant_id, actor_kind: "staff", actor_id: Some(staff_id), action, target: Some(("user", user_id)), meta }
}

/// A change attempted in a read-only staff session (audited, then refused by the caller).
pub async fn write_refused(st: &AppState, ctx: &Ctx, s: &SessionRef, imp: &Impersonation) {
    audit::record(&st.pool, ctx, staff_entry(s.tenant_id, imp.staff_id, s.subject_id, "client.impersonation_write_refused", json!({ "session_id": s.session_id, "via": "gateway" }))).await;
}

/// `/v1/auth/me` extras: the client's restrictions and, for a staff session, who opened it.
pub async fn me_extras(st: &AppState, s: &SessionRef) -> ApiResult<(Value, Value)> {
    let view = client_view(&st.pool, s.subject_id).await?;
    let imp = match &s.impersonation {
        Some(i) => {
            let r = sqlx::query("SELECT se.created_at, se.expires_at, se.impersonation_reason, st.name FROM sessions se JOIN staff st ON st.id = se.impersonator_id WHERE se.id = $1")
                .bind(s.session_id)
                .fetch_one(&st.pool)
                .await?;
            json!({
                "mode": if i.read_only { "read_only" } else { "full" },
                "staff": { "id": i.staff_id, "name": r.get::<String, _>("name") },
                "reason": r.get::<Option<String>, _>("impersonation_reason"),
                "started_at": r.get::<DateTime<Utc>, _>("created_at"),
                "expires_at": r.get::<DateTime<Utc>, _>("expires_at"),
            })
        }
        None => Value::Null,
    };
    Ok((view, imp))
}

/// Audit entry for signing out a staff session (Client Area "End" or logout).
pub async fn logout_entry(st: &AppState, token: &str) -> ApiResult<Option<(i64, i64, i64, i64)>> {
    let r = sqlx::query("SELECT id, tenant_id, subject_id, impersonator_id FROM sessions WHERE token_hash = $1 AND impersonator_id IS NOT NULL")
        .bind(st.keys.hash("session", token))
        .fetch_optional(&st.pool)
        .await?;
    Ok(r.map(|r| (r.get("id"), r.get("tenant_id"), r.get("subject_id"), r.get("impersonator_id"))))
}

#[derive(Deserialize)]
pub struct ImpersonateReq {
    #[serde(default)]
    reason: String,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    confirm: bool,
    #[serde(default)]
    login: Option<i64>,
}

/// Checks the staff member may open a staff session of `mode` as client `id`. Returns (read_only, reason, client name).
async fn impersonation_allowed(st: &AppState, me: &Staff, id: i64, r: &ImpersonateReq) -> ApiResult<(bool, String, String)> {
    let reason: String = r.reason.trim().chars().filter(|c| !c.is_control()).take(300).collect();
    if reason.chars().count() < 3 {
        return Err(ApiError::Validation { field: "reason", message: "Give a reason (at least 3 characters), e.g. the ticket number." });
    }
    let read_only = match r.mode.as_deref().unwrap_or("read_only") {
        "read_only" => true,
        "full" => false,
        _ => return Err(ApiError::Validation { field: "mode", message: "Choose read-only or full access." }),
    };
    if !read_only {
        // full access: Super Admin (and Platform Owner) only, with an explicit confirmation
        if !me.can("clients.impersonate_full") || !(me.role == "super_admin" || me.is_owner()) {
            return Err(ApiError::Forbidden);
        }
        if !r.confirm {
            return Err(ApiError::Validation { field: "confirm", message: "Confirm that you will act as the client with full access." });
        }
    }
    let row = sqlx::query("SELECT status, first_name || ' ' || last_name AS name, is_house FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(me.tenant_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    if row.get::<bool, _>("is_house") {
        return Err(ApiError::BadRequest("House accounts have no Client Area."));
    }
    match row.get::<String, _>("status").as_str() {
        "active" => {}
        "blocked" => return Err(ApiError::BadRequest("This client's sign-in is blocked. Lift the block to open a staff session.")),
        _ => return Err(ApiError::BadRequest("This client's account is closed.")),
    }
    identity::limit(st, format!("impersonate:staff:{}", me.id), 30, 60 * 60)?;
    Ok((read_only, reason, row.get("name")))
}

/// `POST /v1/admin/users/{id}/impersonate`: one-time ticket (60 s) for the Client Area.
pub async fn impersonate(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<ImpersonateReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "clients.impersonate").await?;
    let (read_only, reason, name) = impersonation_allowed(&st, &me, id, &r).await?;
    let ticket = crypto::random_token(32);
    sqlx::query(
        "INSERT INTO impersonation_tickets (token_hash, tenant_id, user_id, staff_id, staff_session_id, mode, reason, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    )
    .bind(st.keys.hash("impersonation", &ticket))
    .bind(me.tenant_id)
    .bind(id)
    .bind(me.id)
    .bind(me.session_id)
    .bind(if read_only { "read_only" } else { "full" })
    .bind(&reason)
    .bind(Utc::now() + Duration::seconds(TICKET_SECS))
    .execute(&st.pool)
    .await?;
    Ok(Json(json!({ "ticket": ticket, "expires_in": TICKET_SECS, "mode": if read_only { "read_only" } else { "full" }, "client": { "id": id, "name": name }, "minutes": STAFF_SESSION_MINUTES })))
}

#[derive(Deserialize)]
pub struct RedeemReq {
    #[serde(default)]
    ticket: String,
}

/// `POST /v1/auth/impersonate/redeem`: the Client Area exchanges the ticket for a 30-minute staff session.
pub async fn redeem(State(st): State<AppState>, ctx: Ctx, req: Result<Json<RedeemReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    identity::limit(&st, format!("impersonate-redeem:ip:{}", ctx.ip), 30, 10 * 60)?;
    let t = r.ticket.trim();
    if t.is_empty() || t.len() > 128 {
        return Err(ApiError::Unauthorized);
    }
    let row = sqlx::query(
        "UPDATE impersonation_tickets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         RETURNING tenant_id, user_id, staff_id, staff_session_id, mode, reason",
    )
    .bind(st.keys.hash("impersonation", t))
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::Coded { status: StatusCode::UNAUTHORIZED, code: "ticket_expired", message: "This staff link has expired or was already used. Start again from the Back Office." })?;
    let (tenant_id, user_id, staff_id, staff_session): (i64, i64, i64, i64) = (row.get("tenant_id"), row.get("user_id"), row.get("staff_id"), row.get("staff_session_id"));
    let mode: String = row.get("mode");
    let reason: String = row.get("reason");
    if !staff_session_live(&st, staff_id, staff_session).await? {
        return Err(ApiError::Unauthorized);
    }
    let status: String = sqlx::query_scalar("SELECT status FROM users WHERE id = $1").bind(user_id).fetch_one(&st.pool).await?;
    if status != "active" {
        return Err(inactive_error(&status));
    }
    let read_only = mode == "read_only";
    let token = format!("{}{}", if read_only { READ_ONLY_PREFIX } else { FULL_PREFIX }, crypto::random_token(32));
    let expires_at = Utc::now() + Duration::minutes(STAFF_SESSION_MINUTES);
    let country = identity::COUNTRY.try_with(|c| c.clone()).ok().flatten();
    let session_id: i64 = sqlx::query_scalar(
        "INSERT INTO sessions (tenant_id, subject_kind, subject_id, token_hash, ip, user_agent, expires_at, country,
                               impersonator_id, impersonator_session_id, impersonation_mode, impersonation_reason)
         VALUES ($1,'user',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(st.keys.hash("session", &token))
    .bind(&ctx.ip)
    .bind(&ctx.user_agent)
    .bind(expires_at)
    .bind(country)
    .bind(staff_id)
    .bind(staff_session)
    .bind(&mode)
    .bind(&reason)
    .fetch_one(&st.pool)
    .await?;
    audit::record(&st.pool, &ctx, staff_entry(tenant_id, staff_id, user_id, "client.impersonation_started", json!({
        "session_id": session_id, "mode": mode, "reason": reason, "app": "client_area", "expires_at": expires_at,
    })))
    .await;
    Ok(Json(json!({ "status": "ok", "session": { "token": token, "expires_at": expires_at }, "mode": mode })))
}

/// `POST /v1/admin/users/{id}/impersonate/trader`: permission check + audit before the Back Office BFF asks the
/// trading engine for a Kalks Trader session of one of the client's accounts in the same mode.
pub async fn impersonate_trader(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<ImpersonateReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "clients.impersonate").await?;
    let login = r.login.filter(|l| (1..=9_999_999_999).contains(l)).ok_or(ApiError::Validation { field: "login", message: "Choose a trading account." })?;
    let (read_only, reason, name) = impersonation_allowed(&st, &me, id, &r).await?;
    let staff_name: String = sqlx::query_scalar("SELECT name FROM staff WHERE id = $1").bind(me.id).fetch_one(&st.pool).await?;
    audit::record(&st.pool, &ctx, staff_entry(me.tenant_id, me.id, id, "client.impersonation_started", json!({
        "mode": if read_only { "read_only" } else { "full" }, "reason": reason, "app": "trader", "login": login, "minutes": STAFF_SESSION_MINUTES,
    })))
    .await;
    Ok(Json(json!({
        "read_only": read_only, "minutes": STAFF_SESSION_MINUTES, "login": login, "reason": reason,
        "staff": { "id": me.id, "name": staff_name }, "client": { "id": id, "name": name },
    })))
}

/// `POST /v1/admin/impersonations/{session_id}/end`: ends a staff session (own, or any with `sessions.revoke`).
pub async fn end_impersonation(State(st): State<AppState>, ctx: Ctx, Path(sid): Path<i64>) -> ApiResult<Json<Value>> {
    let me = require_key(&st, &ctx, "clients.impersonate").await?;
    let row = sqlx::query("SELECT subject_id, impersonator_id FROM sessions WHERE id = $1 AND tenant_id = $2 AND impersonator_id IS NOT NULL AND revoked_at IS NULL")
        .bind(sid)
        .bind(me.tenant_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    let (user_id, staff_id): (i64, i64) = (row.get("subject_id"), row.get("impersonator_id"));
    if staff_id != me.id && !me.can("sessions.revoke") {
        return Err(ApiError::Forbidden);
    }
    sqlx::query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL").bind(sid).execute(&st.pool).await?;
    audit::record(&st.pool, &ctx, staff_entry(me.tenant_id, staff_id, user_id, "client.impersonation_ended", json!({ "session_id": sid, "via": "back_office", "ended_by": me.id }))).await;
    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Deserialize)]
pub struct EventReq {
    #[serde(default)]
    kind: String,
    #[serde(default)]
    method: String,
    #[serde(default)]
    path: String,
    status: Option<u16>,
}

/// `POST /v1/auth/impersonation/event`: what a staff member did in a staff session (the Client Area proxy reports
/// every change it passes on or refuses; page views at most once per page every 5 minutes).
pub async fn event(State(st): State<AppState>, ctx: Ctx, req: Result<Json<EventReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let s = identity::resolve_session_any(&st, &ctx, Kind::User).await?;
    let Some(imp) = s.impersonation.clone() else { return Ok(Json(json!({ "status": "ignored" }))) };
    let path: String = r.path.trim().chars().take(160).collect();
    if !path.starts_with('/') || !path.chars().all(|c| c.is_ascii_graphic()) {
        return Err(ApiError::Validation { field: "path", message: "Invalid path." });
    }
    let method: String = r.method.trim().to_ascii_uppercase().chars().filter(|c| c.is_ascii_alphabetic()).take(8).collect();
    let action = match r.kind.as_str() {
        "action" => "client.impersonation_action",
        "write_refused" => "client.impersonation_write_refused",
        "page_view" => "client.impersonation_page_view",
        _ => return Err(ApiError::Validation { field: "kind", message: "Unknown event." }),
    };
    identity::limit(&st, format!("impersonation-event:{}", s.session_id), 600, 30 * 60)?;
    if action == "client.impersonation_page_view" && st.limiter.hit(&format!("impersonation-view:{}:{path}", s.session_id), 1, std::time::Duration::from_secs(300)).is_err() {
        return Ok(Json(json!({ "status": "ok" })));
    }
    audit::record(&st.pool, &ctx, staff_entry(s.tenant_id, imp.staff_id, s.subject_id, action, json!({
        "session_id": s.session_id, "mode": if imp.read_only { "read_only" } else { "full" }, "method": method, "path": path, "status": r.status, "app": "client_area",
    })))
    .await;
    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Deserialize)]
pub struct TraderEndedReq {
    staff_id: i64,
    user_id: i64,
    login: Option<i64>,
    #[serde(default)]
    via: Option<String>,
}

/// `POST /v1/internal/impersonation/ended`: a Kalks Trader staff session was ended (terminal BFF).
pub async fn trader_ended(State(st): State<AppState>, ctx: Ctx, req: Result<Json<TraderEndedReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let tenant: Option<i64> = sqlx::query_scalar("SELECT u.tenant_id FROM users u JOIN staff s ON s.tenant_id = u.tenant_id AND s.id = $2 WHERE u.id = $1")
        .bind(r.user_id)
        .bind(r.staff_id)
        .fetch_optional(&st.pool)
        .await?;
    let tenant = tenant.ok_or(ApiError::NotFound)?;
    let via: String = r.via.unwrap_or_else(|| "ended".into()).chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_').take(24).collect();
    audit::record(&st.pool, &ctx, staff_entry(tenant, r.staff_id, r.user_id, "client.impersonation_ended", json!({ "app": "trader", "login": r.login, "via": via }))).await;
    Ok(Json(json!({ "status": "ok" })))
}

// ---------- heartbeat ----------

/// `POST /v1/auth/heartbeat`: an open Client Area tab. Moves the session (and the client's presence) forward and
/// returns the client's current restrictions, so the banner follows changes without a reload.
pub async fn heartbeat(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let s = identity::resolve_session_any(&st, &ctx, Kind::User).await?;
    let mut v = client_view(&st.pool, s.subject_id).await?;
    v["status"] = json!("ok");
    v["expires_at"] = json!(s.expires_at);
    Ok(Json(v))
}

// ---------- Back Office: presence ----------

/// `GET /v1/admin/presence`: clients online now and away (last 15 minutes), with the apps they are in.
pub async fn presence_list(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    let me = require_key(&st, &ctx, "clients.read").await?;
    let mut tx = crate::domains::tenant_tx(&st.pool, me.tenant_id).await?;
    let rows = sqlx::query(
        "SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email, u.country, u.last_active_at,
                ca.since AS ca_since, ca.ip AS ca_ip, ca.country AS ca_country, ca.user_agent AS ca_ua,
                tr.since AS tr_since, tr.ip AS tr_ip, tr.country AS tr_country, tr.login AS tr_login,
                (SELECT array_agg(DISTINCT r.kind) FROM client_restrictions r WHERE r.user_id = u.id AND r.lifted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > now())) AS restrictions
         FROM users u
         LEFT JOIN LATERAL (
             SELECT min(se.created_at) OVER () AS since, se.ip, se.country, se.user_agent FROM sessions se
              WHERE se.subject_kind = 'user' AND se.subject_id = u.id AND se.viewer_id IS NULL AND se.impersonator_id IS NULL
                AND se.revoked_at IS NULL AND se.expires_at > now() AND se.last_seen_at > now() - make_interval(secs => $2)
              ORDER BY se.last_seen_at DESC LIMIT 1) ca ON true
         LEFT JOIN LATERAL (
             SELECT min(p.since) OVER () AS since, p.ip, p.country, p.login FROM client_presence p
              WHERE p.user_id = u.id AND p.ended_at IS NULL AND p.last_active > now() - make_interval(secs => $3)
              ORDER BY p.last_active DESC LIMIT 1) tr ON true
         WHERE u.tenant_id = $1 AND NOT u.is_house AND u.last_active_at > now() - make_interval(secs => $2)
         ORDER BY u.last_active_at DESC LIMIT 300",
    )
    .bind(me.tenant_id)
    .bind(AWAY_SECS as f64)
    .bind(TRADER_LIVE_SECS as f64)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let now = Utc::now();
    let mut online = 0;
    let mut away = 0;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let last: Option<DateTime<Utc>> = r.get("last_active_at");
            let p = presence(last, now);
            match p {
                Presence::Online => online += 1,
                Presence::Away => away += 1,
                Presence::Offline => {}
            }
            let ca_since: Option<DateTime<Utc>> = r.get("ca_since");
            let tr_since: Option<DateTime<Utc>> = r.get("tr_since");
            let mut apps = Vec::new();
            if ca_since.is_some() {
                apps.push("client_area");
            }
            if tr_since.is_some() {
                apps.push("trader");
            }
            let since = [ca_since, tr_since].into_iter().flatten().min();
            json!({
                "id": r.get::<i64, _>("id"),
                "name": r.get::<String, _>("name"),
                "email": r.get::<String, _>("email"),
                "country": r.get::<String, _>("country").trim().to_lowercase(),
                "presence": p.as_str(),
                "last_active_at": last,
                "apps": apps,
                "since": since,
                "ip": r.get::<Option<String>, _>("ca_ip").or_else(|| r.get::<Option<String>, _>("tr_ip")),
                "location": r.get::<Option<String>, _>("ca_country").or_else(|| r.get::<Option<String>, _>("tr_country")),
                "user_agent": r.get::<Option<String>, _>("ca_ua"),
                "trader_login": r.get::<Option<i64>, _>("tr_login"),
                "restrictions": r.get::<Option<Vec<String>>, _>("restrictions").unwrap_or_default(),
            })
        })
        .collect();
    Ok(Json(json!({ "online": online, "away": away, "items": items, "generated_at": now, "online_secs": ONLINE_SECS, "away_secs": AWAY_SECS })))
}

// ---------- Back Office: one client's controls ----------

async fn client_in_tenant(st: &AppState, me: &Staff, id: i64) -> ApiResult<(String, String)> {
    let r = sqlx::query("SELECT status, first_name || ' ' || last_name AS name FROM users WHERE id = $1 AND tenant_id = $2 AND NOT is_house")
        .bind(id)
        .bind(me.tenant_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok((r.get("status"), r.get("name")))
}

/// `GET /v1/admin/users/{id}/controls`
pub async fn controls(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    let me = require_key(&st, &ctx, "clients.read").await?;
    client_in_tenant(&st, &me, id).await?;
    Ok(Json(controls_json(&st, &me, id).await?))
}

async fn controls_json(st: &AppState, me: &Staff, id: i64) -> ApiResult<Value> {
    let now = Utc::now();
    let mut tx = crate::domains::tenant_tx(&st.pool, me.tenant_id).await?;
    let (status, last_active): (String, Option<DateTime<Utc>>) = sqlx::query_as("SELECT status, last_active_at FROM users WHERE id = $1").bind(id).fetch_one(&mut *tx).await?;
    let sessions = sqlx::query(
        "SELECT se.id, se.ip, se.country, se.user_agent, se.created_at, se.last_seen_at, se.expires_at, se.viewer_id, cv.label AS viewer_label,
                se.impersonator_id, sf.name AS staff_name, se.impersonation_mode, se.impersonation_reason
         FROM sessions se
         LEFT JOIN client_viewers cv ON cv.id = se.viewer_id
         LEFT JOIN staff sf ON sf.id = se.impersonator_id
         WHERE se.subject_kind = 'user' AND se.subject_id = $1 AND se.revoked_at IS NULL AND se.expires_at > now()
           AND se.last_seen_at > now() - make_interval(mins => (SELECT t.client_idle_minutes FROM tenants t WHERE t.id = se.tenant_id))
         ORDER BY se.last_seen_at DESC LIMIT 50",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let trader = sqlx::query(
        "SELECT conn_key, login, ip, country, user_agent, since, last_active FROM client_presence
         WHERE user_id = $1 AND ended_at IS NULL AND last_active > now() - make_interval(secs => $2) ORDER BY since",
    )
    .bind(id)
    .bind(TRADER_LIVE_SECS as f64)
    .fetch_all(&mut *tx)
    .await?;
    let last_trader: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT max(last_active) FROM client_presence WHERE user_id = $1").bind(id).fetch_one(&mut *tx).await?;
    let history = sqlx::query(
        "SELECT r.id, r.kind, r.reason, r.expires_at, r.created_at, r.lifted_at, r.lift_reason, r.created_by, r.lifted_by,
                c.name AS created_by_name, l.name AS lifted_by_name
         FROM client_restrictions r LEFT JOIN staff c ON c.id = r.created_by LEFT JOIN staff l ON l.id = r.lifted_by
         WHERE r.user_id = $1 ORDER BY r.created_at DESC, r.id DESC LIMIT 100",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let mut devices: Vec<Value> = Vec::new();
    let mut staff_sessions: Vec<Value> = Vec::new();
    for r in &sessions {
        let seen: DateTime<Utc> = r.get("last_seen_at");
        let viewer: Option<i64> = r.get("viewer_id");
        let staff: Option<i64> = r.get("impersonator_id");
        let d = json!({
            "id": r.get::<i64, _>("id"),
            "app": "client_area",
            "kind": if staff.is_some() { "staff" } else if viewer.is_some() { "viewer" } else { "client" },
            "ip": r.get::<Option<String>, _>("ip"),
            "country": r.get::<Option<String>, _>("country"),
            "user_agent": r.get::<Option<String>, _>("user_agent"),
            "since": r.get::<DateTime<Utc>, _>("created_at"),
            "last_active_at": seen,
            "presence": presence(Some(seen), now).as_str(),
            "viewer": viewer.map(|v| json!({ "id": v, "label": r.get::<Option<String>, _>("viewer_label") })),
            "staff": staff.map(|s| json!({ "id": s, "name": r.get::<Option<String>, _>("staff_name") })),
        });
        if staff.is_some() {
            staff_sessions.push(json!({
                "session_id": r.get::<i64, _>("id"),
                "staff": { "id": staff, "name": r.get::<Option<String>, _>("staff_name") },
                "mode": r.get::<Option<String>, _>("impersonation_mode"),
                "reason": r.get::<Option<String>, _>("impersonation_reason"),
                "started_at": r.get::<DateTime<Utc>, _>("created_at"),
                "expires_at": r.get::<DateTime<Utc>, _>("expires_at"),
                "mine": staff == Some(me.id),
            }));
        }
        devices.push(d);
    }
    for r in &trader {
        devices.push(json!({
            "id": r.get::<String, _>("conn_key"),
            "app": "trader",
            "kind": "client",
            "login": r.get::<Option<i64>, _>("login"),
            "ip": r.get::<Option<String>, _>("ip"),
            "country": r.get::<Option<String>, _>("country"),
            "user_agent": r.get::<Option<String>, _>("user_agent"),
            "since": r.get::<DateTime<Utc>, _>("since"),
            "last_active_at": r.get::<DateTime<Utc>, _>("last_active"),
            "presence": "online",
        }));
    }
    let hist: Vec<Value> = history
        .iter()
        .map(|r| {
            let lifted: Option<DateTime<Utc>> = r.get("lifted_at");
            let expires: Option<DateTime<Utc>> = r.get("expires_at");
            let state = match (lifted, expires) {
                (Some(_), _) => r.get::<Option<String>, _>("lift_reason").filter(|x| x == "Expired").map(|_| "expired").unwrap_or("lifted"),
                (None, Some(e)) if e <= now => "expired",
                _ => "active",
            };
            let k: String = r.get("kind");
            json!({
                "id": r.get::<i64, _>("id"),
                "kind": k,
                "label": label(&k),
                "reason": r.get::<String, _>("reason"),
                "expires_at": expires,
                "created_at": r.get::<DateTime<Utc>, _>("created_at"),
                "created_by": r.get::<Option<i64>, _>("created_by").map(|i| json!({ "id": i, "name": r.get::<Option<String>, _>("created_by_name") })),
                "lifted_at": lifted,
                "lifted_by": r.get::<Option<i64>, _>("lifted_by").map(|i| json!({ "id": i, "name": r.get::<Option<String>, _>("lifted_by_name") })),
                "lift_reason": r.get::<Option<String>, _>("lift_reason"),
                "state": state,
            })
        })
        .collect();
    let active: Vec<Value> = hist.iter().filter(|h| h["state"] == "active").cloned().collect();
    let active_kinds: Vec<(String, Option<DateTime<Utc>>)> = active
        .iter()
        .map(|h| (h["kind"].as_str().unwrap_or_default().to_string(), h["expires_at"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|t| t.with_timezone(&Utc))))
        .collect();
    let apps: Vec<&str> = {
        let mut a = Vec::new();
        if devices.iter().any(|d| d["app"] == "client_area" && d["kind"] == "client" && d["presence"] != "offline") {
            a.push("client_area");
        }
        if !trader.is_empty() {
            a.push("trader");
        }
        a
    };
    Ok(json!({
        "status": status,
        "presence": {
            "state": presence(last_active, now).as_str(),
            "last_active_at": last_active,
            "last_trader_at": last_trader,
            "apps": apps,
            "devices": devices,
        },
        "restrictions": active,
        "effective": expand(&active_kinds).into_keys().collect::<Vec<_>>(),
        "history": hist,
        "staff_sessions": staff_sessions,
        "kinds": KINDS.iter().map(|k| json!({ "kind": k, "label": label(k), "permission": perm_for(k) })).collect::<Vec<_>>(),
        "freeze_covers": FREEZE,
        "can": {
            "restrict": me.can("clients.restrict"),
            "block": me.can("clients.block"),
            "impersonate": me.can("clients.impersonate"),
            "impersonate_full": me.can("clients.impersonate_full") && (me.role == "super_admin" || me.is_owner()),
        },
        "staff_session_minutes": STAFF_SESSION_MINUTES,
        "generated_at": now,
    }))
}

#[derive(Deserialize, Default)]
pub struct SetReq {
    #[serde(default)]
    reason: String,
    expires_at: Option<DateTime<Utc>>,
}

/// Outcome of setting / lifting one restriction.
pub struct Changed {
    pub sessions_ended: u64,
    pub replaced: bool,
}

/// Sets (or replaces) restriction `kind` on client `id` in one transaction: closes an expired or current open row,
/// inserts the new one and, for a sign-in block, suspends the client and ends every session (the client's own,
/// view-only logins and staff sessions).
pub async fn set_restriction(st: &AppState, ctx: &Ctx, me: &Staff, id: i64, kind: &'static str, reason: &str, expires_at: Option<DateTime<Utc>>) -> ApiResult<Changed> {
    let mut tx = st.pool.begin().await?;
    sqlx::query("UPDATE client_restrictions SET lifted_at = expires_at, lift_reason = 'Expired' WHERE user_id = $1 AND kind = $2 AND lifted_at IS NULL AND expires_at <= now()")
        .bind(id)
        .bind(kind)
        .execute(&mut *tx)
        .await?;
    let replaced = sqlx::query("UPDATE client_restrictions SET lifted_at = now(), lifted_by = $3, lift_reason = 'Replaced' WHERE user_id = $1 AND kind = $2 AND lifted_at IS NULL")
        .bind(id)
        .bind(kind)
        .bind(me.id)
        .execute(&mut *tx)
        .await?
        .rows_affected()
        > 0;
    sqlx::query("INSERT INTO client_restrictions (tenant_id, user_id, kind, reason, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(me.tenant_id)
        .bind(id)
        .bind(kind)
        .bind(reason)
        .bind(expires_at)
        .bind(me.id)
        .execute(&mut *tx)
        .await?;
    let mut ended = 0;
    if kind == "login" {
        sqlx::query("UPDATE users SET status = 'blocked', updated_at = now() WHERE id = $1 AND status = 'active'").bind(id).execute(&mut *tx).await?;
        ended = sqlx::query("UPDATE sessions SET revoked_at = now() WHERE subject_kind = 'user' AND subject_id = $1 AND revoked_at IS NULL")
            .bind(id)
            .execute(&mut *tx)
            .await?
            .rows_affected();
    }
    tx.commit().await?;
    if kind == "login" {
        // a blocked client's phones stop receiving pushes (queued after the commit: it never fails the block)
        crate::push_revoke::client_signed_out(&st.pool, me.tenant_id, id).await;
    }
    audit::record(&st.pool, ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "client.restriction_set",
        target: Some(("user", id)),
        meta: json!({ "kind": kind, "label": label(kind), "reason": reason, "expires_at": expires_at, "replaced": replaced, "sessions_ended": ended }),
    })
    .await;
    Ok(Changed { sessions_ended: ended, replaced })
}

/// Lifts restriction `kind`; `Ok(None)` when it wasn't active. A lifted sign-in block re-activates the client.
pub async fn lift_restriction(st: &AppState, ctx: &Ctx, me: &Staff, id: i64, kind: &'static str, reason: &str) -> ApiResult<Option<Changed>> {
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query(
        "UPDATE client_restrictions SET lifted_at = now(), lifted_by = $3, lift_reason = $4
         WHERE user_id = $1 AND kind = $2 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(id)
    .bind(kind)
    .bind(me.id)
    .bind(reason)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    // an expired row still open is closed as expired
    sqlx::query("UPDATE client_restrictions SET lifted_at = expires_at, lift_reason = 'Expired' WHERE user_id = $1 AND kind = $2 AND lifted_at IS NULL AND expires_at <= now()")
        .bind(id)
        .bind(kind)
        .execute(&mut *tx)
        .await?;
    if kind == "login" {
        sqlx::query("UPDATE users SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'blocked'").bind(id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    if n == 0 {
        return Ok(None);
    }
    audit::record(&st.pool, ctx, Entry {
        tenant_id: me.tenant_id,
        actor_kind: "staff",
        actor_id: Some(me.id),
        action: "client.restriction_lifted",
        target: Some(("user", id)),
        meta: json!({ "kind": kind, "label": label(kind), "reason": reason }),
    })
    .await;
    Ok(Some(Changed { sessions_ended: 0, replaced: false }))
}

fn parse_kind(raw: &str) -> ApiResult<&'static str> {
    kind(raw).ok_or(ApiError::Validation { field: "kind", message: "Unknown restriction." })
}

/// `PUT /v1/admin/users/{id}/restrictions/{kind}` `{reason, expires_at?}`
pub async fn put_restriction(State(st): State<AppState>, ctx: Ctx, Path((id, kind)): Path<(i64, String)>, req: Result<Json<SetReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let kind = parse_kind(&kind)?;
    let me = require_key(&st, &ctx, perm_for(kind)).await?;
    let reason = clean_reason(&r.reason)?;
    let expires_at = clean_expiry(r.expires_at, Utc::now())?;
    let (status, _) = client_in_tenant(&st, &me, id).await?;
    if status == "closed" {
        return Err(ApiError::BadRequest("This client's account is closed."));
    }
    identity::limit(&st, format!("restrict:staff:{}", me.id), 300, 60 * 60)?;
    let c = set_restriction(&st, &ctx, &me, id, kind, &reason, expires_at).await?;
    let mut v = controls_json(&st, &me, id).await?;
    v["result"] = json!({ "kind": kind, "sessions_ended": c.sessions_ended, "replaced": c.replaced });
    Ok(Json(v))
}

#[derive(Deserialize, Default)]
pub struct LiftReq {
    #[serde(default)]
    reason: String,
}

/// `POST /v1/admin/users/{id}/restrictions/{kind}/lift` `{reason}`
pub async fn lift(State(st): State<AppState>, ctx: Ctx, Path((id, kind)): Path<(i64, String)>, req: Result<Json<LiftReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let kind = parse_kind(&kind)?;
    let me = require_key(&st, &ctx, perm_for(kind)).await?;
    let reason = clean_reason(&r.reason)?;
    client_in_tenant(&st, &me, id).await?;
    lift_restriction(&st, &ctx, &me, id, kind, &reason).await?.ok_or(ApiError::BadRequest("This restriction isn't active."))?;
    let mut v = controls_json(&st, &me, id).await?;
    v["result"] = json!({ "kind": kind, "lifted": true });
    Ok(Json(v))
}

#[derive(Deserialize)]
pub struct BulkReq {
    #[serde(default)]
    user_ids: Vec<i64>,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    action: String,
    #[serde(default)]
    reason: String,
    expires_at: Option<DateTime<Utc>>,
}

pub const BULK_MAX: usize = 200;

/// `POST /v1/admin/restrictions/bulk`: the same restriction set on (or lifted from) up to 200 clients of the list.
pub async fn bulk(State(st): State<AppState>, ctx: Ctx, req: Result<Json<BulkReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let kind = parse_kind(&r.kind)?;
    let me = require_key(&st, &ctx, perm_for(kind)).await?;
    let set = match r.action.as_str() {
        "set" => true,
        "lift" => false,
        _ => return Err(ApiError::Validation { field: "action", message: "Choose set or lift." }),
    };
    let reason = clean_reason(&r.reason)?;
    let expires_at = if set { clean_expiry(r.expires_at, Utc::now())? } else { None };
    let mut ids: Vec<i64> = r.user_ids.iter().copied().filter(|i| *i > 0).collect();
    ids.sort_unstable();
    ids.dedup();
    if ids.is_empty() || ids.len() > BULK_MAX {
        return Err(ApiError::Validation { field: "user_ids", message: "Select 1–200 clients." });
    }
    identity::limit(&st, format!("restrict-bulk:staff:{}", me.id), 30, 60 * 60)?;
    let known: Vec<(i64, String)> = sqlx::query_as("SELECT id, status FROM users WHERE tenant_id = $1 AND id = ANY($2) AND NOT is_house")
        .bind(me.tenant_id)
        .bind(&ids)
        .fetch_all(&st.pool)
        .await?;
    let mut done = Vec::new();
    let mut skipped = Vec::new();
    let mut ended = 0u64;
    for id in &ids {
        match known.iter().find(|(k, _)| k == id) {
            None => skipped.push(json!({ "id": id, "reason": "not_found" })),
            Some((_, status)) if set && status == "closed" => skipped.push(json!({ "id": id, "reason": "closed" })),
            Some(_) if set => {
                ended += set_restriction(&st, &ctx, &me, *id, kind, &reason, expires_at).await?.sessions_ended;
                done.push(*id);
            }
            Some(_) => match lift_restriction(&st, &ctx, &me, *id, kind, &reason).await? {
                Some(_) => done.push(*id),
                None => skipped.push(json!({ "id": id, "reason": "not_active" })),
            },
        }
    }
    Ok(Json(json!({ "kind": kind, "action": r.action, "done": done, "skipped": skipped, "sessions_ended": ended })))
}

// ---------- internal (services) ----------

#[derive(Deserialize, Default)]
pub struct InternalQ {
    user_id: Option<i64>,
}

/// `GET /v1/internal/restrictions[?user_id=]`: every active restriction, freeze expanded, for the trading engine's
/// cache (it reloads this every few seconds and gets pushes from the Back Office BFF).
pub async fn internal_list(State(st): State<AppState>, q: Result<Query<InternalQ>, QueryRejection>) -> ApiResult<Json<Value>> {
    let Query(q) = q.map_err(|_| ApiError::BadRequest("Invalid query."))?;
    let rows: Vec<(i64, i64, String, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT user_id, tenant_id, kind, expires_at FROM client_restrictions
         WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now()) AND ($1::bigint IS NULL OR user_id = $1)
         ORDER BY user_id",
    )
    .bind(q.user_id)
    .fetch_all(&st.pool)
    .await?;
    let mut by_user: BTreeMap<(i64, i64), Vec<(String, Option<DateTime<Utc>>)>> = BTreeMap::new();
    for (u, t, k, e) in rows {
        by_user.entry((u, t)).or_default().push((k, e));
    }
    let items: Vec<Value> = by_user
        .iter()
        .map(|((u, t), ks)| {
            let eff = expand(ks);
            json!({
                "user_id": u,
                "tenant_id": t,
                "kinds": eff.iter().map(|(k, e)| json!({ "kind": k, "expires_at": e })).collect::<Vec<_>>(),
                "frozen": ks.iter().any(|(k, _)| k == "freeze"),
            })
        })
        .collect();
    Ok(Json(json!({ "items": items, "generated_at": Utc::now() })))
}

#[derive(Deserialize)]
pub struct TraderConn {
    conn: String,
    user_id: i64,
    login: Option<i64>,
    ip: Option<String>,
    country: Option<String>,
    user_agent: Option<String>,
    since: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct TraderReport {
    #[serde(default)]
    items: Vec<TraderConn>,
    #[serde(default)]
    ended: Vec<String>,
}

/// `POST /v1/internal/presence/trader`: live Kalks Trader connections (the client's own sessions only; staff
/// sessions are never reported) and the ones that closed since the last report.
pub async fn trader_report(State(st): State<AppState>, req: Result<Json<TraderReport>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    if r.items.len() > 50_000 || r.ended.len() > 50_000 {
        return Err(ApiError::BadRequest("Report too large."));
    }
    let clip = |v: &Option<String>, n: usize| v.as_deref().map(|s| s.chars().filter(|c| !c.is_control()).take(n).collect::<String>());
    let items: Vec<&TraderConn> = r.items.iter().filter(|c| !c.conn.is_empty() && c.conn.len() <= 80 && c.user_id > 0).collect();
    let conns: Vec<String> = items.iter().map(|c| c.conn.clone()).collect();
    let users: Vec<i64> = items.iter().map(|c| c.user_id).collect();
    let logins: Vec<Option<i64>> = items.iter().map(|c| c.login).collect();
    let ips: Vec<Option<String>> = items.iter().map(|c| clip(&c.ip, 64)).collect();
    let countries: Vec<Option<String>> = items.iter().map(|c| identity::clean_country(c.country.as_deref())).collect();
    let uas: Vec<Option<String>> = items.iter().map(|c| clip(&c.user_agent, 400)).collect();
    let since: Vec<DateTime<Utc>> = items.iter().map(|c| c.since).collect();
    let mut tx = st.pool.begin().await?;
    let live = if conns.is_empty() {
        0
    } else {
        let n = sqlx::query(
            "INSERT INTO client_presence (conn_key, tenant_id, user_id, login, ip, country, user_agent, since, last_active)
             SELECT x.conn, u.tenant_id, u.id, x.login, x.ip, x.country, x.ua, x.since, now()
             FROM unnest($1::text[], $2::bigint[], $3::bigint[], $4::text[], $5::text[], $6::text[], $7::timestamptz[]) AS x(conn, user_id, login, ip, country, ua, since)
             JOIN users u ON u.id = x.user_id
             ON CONFLICT (conn_key) DO UPDATE SET last_active = now(), ended_at = NULL, ip = EXCLUDED.ip, country = EXCLUDED.country, user_agent = EXCLUDED.user_agent",
        )
        .bind(&conns)
        .bind(&users)
        .bind(&logins)
        .bind(&ips)
        .bind(&countries)
        .bind(&uas)
        .bind(&since)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        sqlx::query("UPDATE users SET last_active_at = now() WHERE id = ANY($1)").bind(&users).execute(&mut *tx).await?;
        n
    };
    let ended = if r.ended.is_empty() {
        0
    } else {
        let gone: Vec<i64> = sqlx::query_scalar("UPDATE client_presence SET ended_at = now(), last_active = now() WHERE conn_key = ANY($1) AND ended_at IS NULL RETURNING user_id")
            .bind(&r.ended)
            .fetch_all(&mut *tx)
            .await?;
        // the moment the client closed Kalks Trader is their last activity there
        sqlx::query("UPDATE users SET last_active_at = now() WHERE id = ANY($1)").bind(&gone).execute(&mut *tx).await?;
        gone.len()
    };
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok", "live": live, "ended": ended })))
}

// ---------- housekeeping ----------

/// Every 30 s: expired restrictions are closed (a lifted sign-in block re-activates the client), expired staff
/// sessions are ended and audited, stale Kalks Trader connections (engine gone) are closed, old rows purged.
pub async fn sweep(st: &AppState) -> anyhow::Result<()> {
    let ctx = Ctx { ip: "system".into(), user_agent: String::new(), device: None, tenant_slug: String::new(), bearer: None };
    let expired: Vec<(i64, i64, String, String)> = sqlx::query_as(
        "UPDATE client_restrictions SET lifted_at = expires_at, lift_reason = 'Expired'
         WHERE lifted_at IS NULL AND expires_at <= now() RETURNING tenant_id, user_id, kind, reason",
    )
    .fetch_all(&st.pool)
    .await?;
    for (tenant, user, kind, reason) in &expired {
        if kind == "login" {
            sqlx::query(
                "UPDATE users SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'blocked'
                   AND NOT EXISTS (SELECT 1 FROM client_restrictions r WHERE r.user_id = $1 AND r.kind = 'login' AND r.lifted_at IS NULL)",
            )
            .bind(user)
            .execute(&st.pool)
            .await?;
        }
        audit::record(&st.pool, &ctx, Entry { tenant_id: *tenant, actor_kind: "system", actor_id: None, action: "client.restriction_expired", target: Some(("user", *user)), meta: json!({ "kind": kind, "label": label(kind), "reason": reason }) }).await;
    }
    let ended: Vec<(i64, i64, i64, i64)> = sqlx::query_as(
        "UPDATE sessions SET revoked_at = expires_at WHERE impersonator_id IS NOT NULL AND revoked_at IS NULL AND expires_at <= now()
         RETURNING id, tenant_id, subject_id, impersonator_id",
    )
    .fetch_all(&st.pool)
    .await?;
    for (sid, tenant, user, staff) in &ended {
        audit::record(&st.pool, &ctx, staff_entry(*tenant, *staff, *user, "client.impersonation_ended", json!({ "session_id": sid, "via": "expired", "app": "client_area" }))).await;
    }
    sqlx::query("UPDATE client_presence SET ended_at = last_active WHERE ended_at IS NULL AND last_active < now() - interval '5 minutes'").execute(&st.pool).await?;
    sqlx::query("DELETE FROM client_presence WHERE ended_at < now() - interval '30 days'").execute(&st.pool).await?;
    sqlx::query("DELETE FROM impersonation_tickets WHERE expires_at < now() - interval '1 day'").execute(&st.pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests;

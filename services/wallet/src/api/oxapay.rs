//! OxaPay crypto checkout routes (see `ops::oxapay`).
//!
//! | Route | Who | Permission |
//! |---|---|---|
//! | `POST /v1/oxapay/invoices` · `GET /v1/oxapay/invoices?user_id=` | client | – |
//! | `GET /v1/oxapay/invoices/{id}?user_id=&poll=` · `POST …/{id}/cancel` | client | – |
//! | `POST /v1/oxapay/callback` | OxaPay, through the Client Area BFF | the `HMAC` header |
//! | `GET /v1/admin/oxapay/invoices` · `POST …/{id}/recheck` | staff | finance.read |
//!
//! The callback sits behind the same `X-Ezymex-Internal` guard as everything else: it reaches us through the
//! Client Area's public BFF route, which adds that header and passes OxaPay's bytes through untouched. The
//! body must stay byte-for-byte what OxaPay signed, so this handler takes `Bytes` and never a parsed `Json`.

use axum::Json;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{Body, Q, ok};
use crate::error::{ApiError, ApiResult};
use crate::ops::oxapay;
use crate::state::{AppState, Ctx, ROLES_READ, StaffCtx};

fn uid(v: Option<i64>) -> ApiResult<i64> {
    v.filter(|v| *v > 0).ok_or_else(|| ApiError::validation("user_id", "user_id must be a positive integer"))
}

fn can_read(s_ctx: &StaffCtx) -> ApiResult<()> {
    if s_ctx.has_perm("finance.read", ROLES_READ) { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this (finance.read)".into())) }
}

/* ---------------- client ---------------- */

pub async fn create(State(st): State<AppState>, ctx: Ctx, Body(n): Body<oxapay::NewInvoice>) -> ApiResult<Json<Value>> {
    Ok(ok(json!({"checkout": oxapay::create(&st, &ctx, n).await?})))
}

#[derive(Deserialize, Default)]
pub struct UserQ {
    user_id: Option<i64>,
    page: Option<i64>,
    limit: Option<i64>,
    /// `1` asks OxaPay before answering (the page the client lands on after paying).
    poll: Option<String>,
}

pub async fn list(State(st): State<AppState>, ctx: Ctx, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    Ok(ok(oxapay::list(&st, &ctx, uid(q.user_id)?, q.page, q.limit).await?))
}

pub async fn get(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    let poll = q.poll.as_deref().is_some_and(|p| p == "1" || p.eq_ignore_ascii_case("true"));
    Ok(ok(json!({"checkout": oxapay::get(&st, &ctx, uid(q.user_id)?, id, poll).await?})))
}

#[derive(Deserialize)]
pub struct CancelBody {
    user_id: i64,
}

pub async fn cancel(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Body(b): Body<CancelBody>) -> ApiResult<Json<Value>> {
    Ok(ok(json!({"checkout": oxapay::cancel(&st, &ctx, uid(Some(b.user_id))?, id).await?})))
}

/* ---------------- OxaPay ---------------- */

/// OxaPay's payment notification. It must answer `200 ok`: anything else is a failed delivery and OxaPay
/// retries (5 attempts, up to about 3.5 hours), which is exactly what we want for a transient fault.
pub async fn callback(State(st): State<AppState>, headers: HeaderMap, raw: Bytes) -> Response {
    let sig = headers.get("hmac").and_then(|v| v.to_str().ok());
    match oxapay::callback(&st, &raw, sig).await {
        Ok(()) => (axum::http::StatusCode::OK, "ok").into_response(),
        Err(e) => {
            tracing::warn!(code = e.code(), "oxapay callback rejected");
            e.into_response()
        }
    }
}

/* ---------------- Back Office ---------------- */

pub async fn admin_list(State(st): State<AppState>, s_ctx: StaffCtx, Q(q): Q<oxapay::AdminQuery>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    Ok(ok(oxapay::admin_list(&st, &s_ctx, q).await?))
}

pub async fn admin_recheck(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    Ok(ok(json!({"checkout": oxapay::admin_recheck(&st, &s_ctx, id).await?})))
}

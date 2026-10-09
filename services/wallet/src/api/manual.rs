//! Manual payments routes (see `ops::manual`): the client side (CRM BFF, `user_id` from the session) and the Back
//! Office (staff identity headers from the admin BFF; permissions from `X-Ezymex-Staff-Perms`, else the role).
//!
//! | Route | Who | Permission |
//! |---|---|---|
//! | `GET /v1/manual/methods` | client | – |
//! | `POST /v1/manual/proofs?user_id=` (raw image) | client | – |
//! | `POST /v1/manual/deposits` · `GET /v1/manual/deposits?user_id=` · `GET …/{id}?user_id=` · `POST …/{id}/cancel` | client | – |
//! | `GET /v1/manual/media/{id}?user_id=` | client | QR images; screenshots of their own |
//! | `GET /v1/admin/manual/methods` · `GET /v1/admin/manual/deposits` · `GET …/{id}` · `GET /v1/admin/manual/media/{id}` | staff | finance.read |
//! | `POST /v1/admin/manual/methods` · `PUT …/{id}` · `POST …/{id}/delete` · `POST /v1/admin/manual/media` | staff | finance.settings |
//! | `POST /v1/admin/manual/deposits/{id}/approve` · `…/reject` | staff | finance.approve |
//! | `GET /v1/admin/manual/deposits/export` (CSV) | staff | finance.export |

use axum::Json;
use axum::body::Bytes;
use axum::extract::rejection::BytesRejection;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{Body, Q, ok, paging};
use crate::audit::{self, Entry};
use crate::error::{ApiError, ApiResult};
use crate::media::{self, Reader};
use crate::money::{D, de_dec, de_opt_dec};
use crate::ops::{self, manual};
use crate::state::{AppState, Ctx, ROLES_APPROVE, ROLES_READ, ROLES_SETTINGS, ROLES_WRITE, StaffCtx};

fn uid(v: Option<i64>) -> ApiResult<i64> {
    v.filter(|v| *v > 0).ok_or_else(|| ApiError::validation("user_id", "user_id must be a positive integer"))
}

fn image_body(st: &AppState, body: Result<Bytes, BytesRejection>) -> ApiResult<Bytes> {
    body.map_err(|e| if e.status() == StatusCode::PAYLOAD_TOO_LARGE { media::too_large(st.cfg.max_media_bytes) } else { ApiError::BadRequest("Send the image as the request body.".into()) })
}

fn inm(h: &HeaderMap) -> Option<&str> {
    h.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()).filter(|v| v.len() <= 100)
}

/* ---------------- client ---------------- */

pub async fn methods(State(st): State<AppState>, ctx: Ctx) -> ApiResult<Json<Value>> {
    Ok(ok(json!({"methods": manual::active_methods(&st, ctx.tenant.id).await?, "max_pending": manual::MAX_PENDING})))
}

#[derive(Deserialize, Default)]
pub struct UserQ {
    user_id: Option<i64>,
    page: Option<i64>,
    limit: Option<i64>,
    status: Option<String>,
}

pub async fn upload_proof(State(st): State<AppState>, ctx: Ctx, Q(q): Q<UserQ>, body: Result<Bytes, BytesRejection>) -> ApiResult<Json<Value>> {
    let user_id = uid(q.user_id)?;
    let bytes = image_body(&st, body)?;
    let recent: i64 = sqlx::query_scalar("SELECT count(*) FROM payment_media WHERE tenant_id = $1 AND user_id = $2 AND created_at > now() - interval '1 hour'").bind(ctx.tenant.id).bind(user_id).fetch_one(&st.pool).await?;
    if recent >= 30 {
        return Err(ApiError::Coded { status: StatusCode::TOO_MANY_REQUESTS, code: "rate_limited", message: "Too many uploads. Please try again later.".into() });
    }
    let m = media::store(&st, ctx.tenant.id, "proof", &format!("user:{user_id}"), Some(user_id), &bytes).await?;
    Ok(ok(json!({"media": m})))
}

#[derive(Deserialize)]
pub struct CreateBody {
    #[serde(default)]
    user_id: i64,
    #[serde(default)]
    method_id: i64,
    #[serde(deserialize_with = "de_dec")]
    amount: D,
    #[serde(default)]
    reference: String,
    #[serde(default)]
    proof_media_id: Option<String>,
    #[serde(default)]
    note: Option<String>,
    #[serde(default)]
    idempotency_key: String,
}

pub async fn create_deposit(State(st): State<AppState>, ctx: Ctx, Body(b): Body<CreateBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(Some(b.user_id))?;
    ops::record_ip(&st.pool, ctx.tenant.id, user_id, ctx.ip.as_deref()).await;
    let d = manual::create(
        &st,
        &ctx,
        manual::NewRequest { user_id, method_id: b.method_id, amount: b.amount, reference: b.reference, proof_media_id: b.proof_media_id, client_note: b.note, idempotency_key: b.idempotency_key },
    )
    .await?;
    Ok(ok(json!({"deposit": d})))
}

pub async fn list_deposits(State(st): State<AppState>, ctx: Ctx, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(q.user_id)?;
    let (page, limit, offset) = paging(q.page, q.limit, 20, 100);
    let status = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty() && *s != "all");
    let (items, total) = manual::list_for_client(&st, ctx.tenant.id, user_id, status, limit, offset).await?;
    let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM manual_deposits WHERE tenant_id = $1 AND user_id = $2 AND status = 'pending'").bind(ctx.tenant.id).bind(user_id).fetch_one(&st.pool).await?;
    Ok(ok(json!({"items": items, "page": page, "limit": limit, "total": total, "pending": pending, "max_pending": manual::MAX_PENDING})))
}

pub async fn get_deposit(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Q(q): Q<UserQ>) -> ApiResult<Json<Value>> {
    let user_id = uid(q.user_id)?;
    Ok(ok(json!({"deposit": manual::get_for_client(&st, ctx.tenant.id, user_id, id).await?})))
}

#[derive(Deserialize)]
pub struct UserBody {
    #[serde(default)]
    user_id: i64,
}

pub async fn cancel_deposit(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, Body(b): Body<UserBody>) -> ApiResult<Json<Value>> {
    let user_id = uid(Some(b.user_id))?;
    Ok(ok(json!({"deposit": manual::cancel(&st, &ctx, user_id, id).await?})))
}

pub async fn client_media(State(st): State<AppState>, ctx: Ctx, Path(id): Path<String>, Q(q): Q<UserQ>, headers: HeaderMap) -> ApiResult<Response> {
    let user_id = uid(q.user_id)?;
    media::read(&st, ctx.tenant.id, &id, Reader::Client(user_id), inm(&headers)).await
}

/* ---------------- Back Office ---------------- */

fn can_read(s_ctx: &StaffCtx) -> ApiResult<()> {
    if s_ctx.has_perm("finance.read", ROLES_READ) { Ok(()) } else { Err(ApiError::Forbidden("Your role doesn't allow this (finance.read)".into())) }
}

pub async fn admin_methods(State(st): State<AppState>, s_ctx: StaffCtx) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    let t = s_ctx.ctx.tenant.id;
    Ok(ok(json!({"methods": manual::all_methods(&st, t).await?, "networks": manual::NETWORKS, "counts": manual::counts(&st, t).await?})))
}

#[derive(Deserialize, Default)]
pub struct MethodBody {
    #[serde(default)]
    kind: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    sort_order: i32,
    #[serde(default)]
    currency: String,
    #[serde(default, deserialize_with = "de_opt_dec")]
    rate: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    min_amount: Option<D>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    max_amount: Option<D>,
    #[serde(default)]
    details: Value,
    #[serde(default)]
    evm: Option<Value>,
    #[serde(default)]
    qr_media_id: Option<String>,
    #[serde(default)]
    instructions: String,
    #[serde(default)]
    version: Option<i32>,
}

impl MethodBody {
    fn input(self) -> ApiResult<manual::MethodInput> {
        Ok(manual::MethodInput {
            kind: self.kind,
            name: self.name,
            status: self.status,
            sort_order: self.sort_order,
            currency: self.currency,
            rate: self.rate.ok_or_else(|| ApiError::validation("rate", "Enter the rate (units of the currency per 1 USDT)"))?,
            min_amount: self.min_amount.unwrap_or(D::ZERO),
            max_amount: self.max_amount,
            details: if self.details.is_object() { self.details } else { json!({}) },
            evm: self.evm,
            qr_media_id: self.qr_media_id,
            instructions: self.instructions,
        })
    }
}

pub async fn create_method(State(st): State<AppState>, s_ctx: StaffCtx, Body(b): Body<MethodBody>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.settings", ROLES_SETTINGS)?;
    Ok(ok(json!({"method": manual::create_method(&st, &s_ctx, b.input()?).await?})))
}

pub async fn update_method(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<MethodBody>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.settings", ROLES_SETTINGS)?;
    let version = b.version.ok_or_else(|| ApiError::validation("version", "version is required (the one you loaded)"))?;
    Ok(ok(json!({"method": manual::update_method(&st, &s_ctx, id, version, b.input()?).await?})))
}

#[derive(Deserialize, Default)]
pub struct ReasonBody {
    #[serde(default)]
    reason: Option<String>,
}

pub async fn delete_method(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<ReasonBody>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.settings", ROLES_SETTINGS)?;
    let reason = ops::clean_text(b.reason.as_deref(), 500);
    Ok(ok(manual::delete_method(&st, &s_ctx, id, reason.as_deref()).await?))
}

pub async fn upload_qr(State(st): State<AppState>, s_ctx: StaffCtx, body: Result<Bytes, BytesRejection>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.settings", ROLES_SETTINGS)?;
    let bytes = image_body(&st, body)?;
    let m = media::store(&st, s_ctx.ctx.tenant.id, "qr", &s_ctx.staff.tag(), None, &bytes).await?;
    let mut tx = st.pool.begin().await?;
    audit::staff(&mut tx, &s_ctx, Entry { action: "wallet.manual.qr.uploaded", target_kind: "payment_media", target_id: m["id"].as_str().unwrap_or_default().to_string(), reason: None, before: None, after: Some(m.clone()) }).await?;
    tx.commit().await?;
    Ok(ok(json!({"media": m})))
}

pub async fn admin_media(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<String>, headers: HeaderMap) -> ApiResult<Response> {
    can_read(&s_ctx)?;
    media::read(&st, s_ctx.ctx.tenant.id, &id, Reader::Staff, inm(&headers)).await
}

#[derive(Deserialize, Default)]
pub struct ListQ {
    status: Option<String>,
    kind: Option<String>,
    method_id: Option<i64>,
    user_id: Option<i64>,
    q: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

impl ListQ {
    fn filter(&self) -> manual::AdminFilter {
        let opt = |v: &Option<String>| v.as_deref().map(str::trim).filter(|s| !s.is_empty() && *s != "all").map(str::to_string);
        manual::AdminFilter { status: opt(&self.status), kind: opt(&self.kind), method_id: self.method_id, user_id: self.user_id, q: opt(&self.q) }
    }
}

pub async fn admin_deposits(State(st): State<AppState>, s_ctx: StaffCtx, Q(q): Q<ListQ>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    let (page, limit, offset) = paging(q.page, q.limit, 50, 200);
    let mut v = manual::admin_list(&st, s_ctx.ctx.tenant.id, &q.filter(), limit, offset).await?;
    v["page"] = json!(page);
    v["limit"] = json!(limit);
    Ok(ok(v))
}

pub async fn admin_deposit(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    can_read(&s_ctx)?;
    Ok(ok(json!({"deposit": manual::admin_get(&st, s_ctx.ctx.tenant.id, id).await?})))
}

#[derive(Deserialize, Default)]
pub struct ApproveBody {
    #[serde(default, deserialize_with = "de_opt_dec")]
    credit_amount: Option<D>,
    #[serde(default)]
    note: Option<String>,
}

pub async fn approve(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<ApproveBody>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.approve", ROLES_APPROVE)?;
    Ok(ok(json!({"deposit": manual::approve(&st, &s_ctx, id, b.credit_amount, b.note).await?})))
}

pub async fn reject(State(st): State<AppState>, s_ctx: StaffCtx, Path(id): Path<i64>, Body(b): Body<ReasonBody>) -> ApiResult<Json<Value>> {
    s_ctx.require_perm("finance.approve", ROLES_APPROVE)?;
    Ok(ok(json!({"deposit": manual::reject(&st, &s_ctx, id, b.reason.as_deref().unwrap_or("")).await?})))
}

pub async fn export(State(st): State<AppState>, s_ctx: StaffCtx, Q(q): Q<ListQ>) -> ApiResult<Response> {
    s_ctx.require_perm("finance.export", ROLES_WRITE)?;
    let csv = manual::export_csv(&st, &s_ctx, &q.filter()).await?;
    let name = format!("manual-deposits-{}.csv", chrono::Utc::now().format("%Y-%m-%d"));
    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{name}\"")),
            (header::CACHE_CONTROL, "no-store".to_string()),
        ],
        csv,
    )
        .into_response())
}

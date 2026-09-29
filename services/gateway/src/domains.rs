//! Tenant domains and host → tenant resolution (D1, D113).
//!
//! Each broker is served on its own hosts, one app per host kind: `website`, `app` (Client Area), `trade`
//! (Kalks Trader) and `admin` (Back Office), stored in `tenant_domains` (`tenants.domains` is a mirror of the
//! active rows for older readers).
//!
//! **Resolution precedence** (`Ctx`, see state.rs). The apps' BFFs call the gateway server-side and forward the
//! browser's host in `X-Kalks-Host` (only the BFFs can reach /v1: loopback + internal token):
//! 1. `X-Kalks-Host` is an active `tenant_domains` row → that tenant. The host wins over any explicit
//!    `X-Kalks-Tenant`, so a broker's domain can never be steered to another tenant by a stale header.
//! 2. otherwise an explicit `X-Kalks-Tenant` slug (the BFF's configured tenant, `kalks` by default);
//! 3. otherwise the default tenant `kalks`. Unknown hosts (localhost in development, the server IP) therefore
//!    get Kalks; in production Caddy only routes configured or `domain-check`-approved hosts to the apps.
//!
//! Lookups are cached per process for `CACHE_TTL` (negative results too); owner changes clear the cache.

use axum::Json;
use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{ConnectInfo, Path, Query, Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use crate::admin::require_key;
use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::error::{ApiError, ApiResult, field};
use crate::state::{AppState, Ctx};

pub const DEFAULT_TENANT: &str = "kalks";
pub const KINDS: &[&str] = &["website", "app", "trade", "admin"];
pub const MAX_DOMAINS: i64 = 20;
const CACHE_TTL: Duration = Duration::from_secs(30);
const CACHE_MAX: usize = 4096;

/// A browser host (`App.Broker.com:443.`) → `app.broker.com`. None for anything that isn't a DNS name.
pub fn normalize_host(raw: &str) -> Option<String> {
    let h = raw.trim().to_lowercase();
    let h = match h.rsplit_once(':') {
        Some((name, port)) if !name.contains(':') && port.chars().all(|c| c.is_ascii_digit()) => name.to_string(),
        _ => h,
    };
    let h = h.trim_end_matches('.').to_string();
    let ok = (1..=253).contains(&h.len())
        && h.split('.').all(|l| !l.is_empty() && l.len() <= 63 && l.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'));
    ok.then_some(h)
}

/// The app a domain most likely serves, from its first label (used for plain domain lists).
pub fn infer_kind(domain: &str) -> &'static str {
    match domain.split('.').next().unwrap_or("") {
        "app" | "my" | "client" | "portal" => "app",
        "trade" | "trader" | "webtrader" => "trade",
        "admin" | "backoffice" | "bo" => "admin",
        _ => "website",
    }
}

pub fn clean_kind(raw: &str) -> Result<&'static str, &'static str> {
    KINDS.iter().copied().find(|k| *k == raw.trim()).ok_or("Choose website, app, trade or admin.")
}

// ---------- cache ----------

type CacheKey = (String, String);
static CACHE: LazyLock<Mutex<HashMap<CacheKey, (Instant, Option<(String, String)>)>>> = LazyLock::new(Default::default);

/// Drops every cached lookup (after an owner change to domains or a tenant).
pub fn invalidate() {
    if let Ok(mut c) = CACHE.lock() {
        c.clear();
    }
}

/// (tenant slug, domain kind) of an active domain, cached. Database errors resolve to None (logged).
pub async fn lookup(st: &AppState, host: &str) -> Option<(String, String)> {
    let host = normalize_host(host)?;
    let key = (st.cfg.database_url.clone(), host.clone());
    if let Ok(c) = CACHE.lock()
        && let Some((at, v)) = c.get(&key)
        && at.elapsed() < CACHE_TTL
    {
        return v.clone();
    }
    let row = sqlx::query("SELECT t.slug, d.kind FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.domain = $1 AND d.status = 'active'")
        .bind(&host)
        .fetch_optional(&st.pool)
        .await;
    let v = match row {
        Ok(r) => r.map(|r| (r.get::<String, _>("slug"), r.get::<String, _>("kind"))),
        Err(e) => {
            tracing::error!(error = %e, "tenant domain lookup failed");
            return None;
        }
    };
    if let Ok(mut c) = CACHE.lock() {
        if c.len() >= CACHE_MAX {
            c.clear();
        }
        c.insert(key, (Instant::now(), v.clone()));
    }
    v
}

/// How the tenant of a request was chosen (see the module docs for the precedence).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Host,
    Header,
    Default,
}

impl Source {
    pub fn as_str(self) -> &'static str {
        match self {
            Source::Host => "host",
            Source::Header => "header",
            Source::Default => "default",
        }
    }
}

/// Only plausible slugs are taken from `X-Kalks-Tenant`.
fn explicit_slug(raw: Option<&str>) -> Option<String> {
    raw.map(|s| s.trim().to_lowercase()).filter(|s| (1..=32).contains(&s.len()) && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'))
}

pub async fn resolve(st: &AppState, host: Option<&str>, explicit: Option<&str>) -> (String, Source) {
    if let Some(h) = host
        && let Some((slug, _)) = lookup(st, h).await
    {
        return (slug, Source::Host);
    }
    match explicit_slug(explicit) {
        Some(s) => (s, Source::Header),
        None => (DEFAULT_TENANT.to_string(), Source::Default),
    }
}

fn header<'a>(h: &'a HeaderMap, name: &str) -> Option<&'a str> {
    h.get(name).and_then(|v| v.to_str().ok()).map(str::trim).filter(|v| !v.is_empty())
}

pub async fn resolve_headers(st: &AppState, h: &HeaderMap) -> (String, Source) {
    resolve(st, header(h, "x-kalks-host"), header(h, "x-kalks-tenant")).await
}

// ---------- row-level security scope ----------

/// A transaction scoped to one tenant: `app.tenant_id` is set and the connection switches to the
/// `kalks_tenant` role (RLS enforced, see the tenant_domains_rls migration). Queries through it can only
/// see and write rows of `tenant_id`. Drop to roll back, `commit()` to keep writes.
pub async fn tenant_tx(pool: &PgPool, tenant_id: i64) -> ApiResult<Transaction<'static, Postgres>> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT kalks_enter_tenant($1)").bind(tenant_id).execute(&mut *tx).await?;
    Ok(tx)
}

// ---------- storage ----------

/// Rewrites the `tenants.domains` mirror from the active rows.
async fn sync_mirror(tx: &mut Transaction<'_, Postgres>, tenant_id: i64) -> ApiResult<()> {
    sqlx::query(
        "UPDATE tenants SET domains = COALESCE((SELECT array_agg(domain ORDER BY CASE kind WHEN 'website' THEN 0 WHEN 'app' THEN 1 WHEN 'trade' THEN 2 ELSE 3 END, domain)
                FROM tenant_domains WHERE tenant_id = $1 AND status = 'active'), '{}'), updated_at = now() WHERE id = $1",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One domain already belongs to another tenant → the conflicting domain.
pub async fn taken(pool: &PgPool, domains: &[String], except_tenant: Option<i64>) -> ApiResult<Option<String>> {
    Ok(sqlx::query_scalar("SELECT domain FROM tenant_domains WHERE domain = ANY($1) AND ($2::bigint IS NULL OR tenant_id <> $2) LIMIT 1")
        .bind(domains)
        .bind(except_tenant)
        .fetch_optional(pool)
        .await?)
}

/// Replaces a tenant's domains from a plain list (create / edit tenant with `domains: [..]`): new domains get a
/// kind from their first label, existing rows keep their kind and status, missing ones are removed.
pub async fn replace_all(pool: &PgPool, tenant_id: i64, domains: &[String], by: Option<i64>) -> ApiResult<()> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM tenant_domains WHERE tenant_id = $1 AND NOT (domain = ANY($2))").bind(tenant_id).bind(domains).execute(&mut *tx).await?;
    for d in domains {
        sqlx::query("INSERT INTO tenant_domains (tenant_id, domain, kind, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (domain) DO NOTHING")
            .bind(tenant_id)
            .bind(d)
            .bind(infer_kind(d))
            .bind(by)
            .execute(&mut *tx)
            .await?;
    }
    sync_mirror(&mut tx, tenant_id).await?;
    tx.commit().await?;
    invalidate();
    Ok(())
}

fn record_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "domain": r.get::<String, _>("domain"), "kind": r.get::<String, _>("kind"), "status": r.get::<String, _>("status"),
        "verified_at": r.get::<Option<DateTime<Utc>>, _>("verified_at"), "dns_checked_at": r.get::<Option<DateTime<Utc>>, _>("dns_checked_at"),
        "dns_addresses": r.get::<Vec<String>, _>("dns_addresses"), "created_at": r.get::<DateTime<Utc>, _>("created_at"),
    })
}

const RECORD_COLS: &str = "id, domain, kind, status, verified_at, dns_checked_at, dns_addresses, created_at";

pub async fn records(pool: &PgPool, tenant_id: i64) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT {RECORD_COLS} FROM tenant_domains WHERE tenant_id = $1
         ORDER BY CASE kind WHEN 'website' THEN 0 WHEN 'app' THEN 1 WHEN 'trade' THEN 2 ELSE 3 END, domain"
    )))
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(record_json).collect())
}

/// Active domains grouped by kind, e.g. `{ "app": ["app.broker.com"], "website": [..], .. }`.
pub async fn by_kind(pool: &PgPool, tenant_id: i64) -> ApiResult<Map<String, Value>> {
    let rows = sqlx::query("SELECT domain, kind FROM tenant_domains WHERE tenant_id = $1 AND status = 'active' ORDER BY id").bind(tenant_id).fetch_all(pool).await?;
    let mut out: Map<String, Value> = KINDS.iter().map(|k| (k.to_string(), json!([]))).collect();
    for r in &rows {
        if let Some(Value::Array(a)) = out.get_mut(r.get::<&str, _>("kind")) {
            a.push(json!(r.get::<String, _>("domain")));
        }
    }
    Ok(out)
}

/// The public brand of a tenant: what the apps need to render its login pages and shell.
pub async fn branding(st: &AppState, tenant_id: i64) -> ApiResult<Value> {
    let t = sqlx::query("SELECT slug, name, legal_name, status, brand, contact_email FROM tenants WHERE id = $1").bind(tenant_id).fetch_one(&st.pool).await?;
    let slug: String = t.get("slug");
    let brand = t.get::<sqlx::types::Json<Value>, _>("brand").0;
    let s = |k: &str| brand.get(k).and_then(Value::as_str).map(str::to_string);
    let support = t.get::<Option<String>, _>("contact_email").or_else(|| (slug == DEFAULT_TENANT && !st.cfg.support_email.is_empty()).then(|| st.cfg.support_email.clone()));
    let domains = by_kind(&st.pool, tenant_id).await?;
    let urls: Map<String, Value> = domains
        .iter()
        .map(|(k, v)| (k.clone(), v.as_array().and_then(|a| a.first()).and_then(Value::as_str).map_or(Value::Null, |d| json!(format!("https://{d}")))))
        .collect();
    Ok(json!({
        "slug": slug,
        "name": t.get::<String, _>("name"),
        "legal_name": t.get::<Option<String>, _>("legal_name"),
        "status": t.get::<String, _>("status"),
        "default": slug == DEFAULT_TENANT,
        "logo_url": s("logo_url"),
        "primary": s("primary"),
        "accent": s("accent"),
        "support_email": support,
        "domains": domains,
        "urls": urls,
    }))
}

// ---------- public: GET /v1/public/tenant-config (internal token) ----------

/// tenancy.rs `public_config` for the request's tenant, plus `resolved_by` (host / header / default).
pub async fn tenant_config(State(st): State<AppState>, ctx: Ctx, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let Json(mut v) = crate::tenancy::public_config(State(st.clone()), ctx).await?;
    v["resolved_by"] = json!(resolve_headers(&st, &headers).await.1.as_str());
    Ok(Json(v))
}

// ---------- public: GET /v1/public/tenant-by-host?host= (internal token) ----------

#[derive(Deserialize)]
pub struct HostQuery {
    host: Option<String>,
}

pub async fn tenant_by_host(State(st): State<AppState>, q: Result<Query<HostQuery>, QueryRejection>) -> ApiResult<Json<Value>> {
    let Query(q) = q.map_err(|_| ApiError::BadRequest("host is required."))?;
    let host = q.host.as_deref().and_then(normalize_host).ok_or(ApiError::BadRequest("host is required."))?;
    let (slug, kind) = lookup(&st, &host).await.ok_or(ApiError::Coded { status: StatusCode::NOT_FOUND, code: "unknown_host", message: "No broker is served on this host." })?;
    let id: i64 = sqlx::query_scalar("SELECT id FROM tenants WHERE slug = $1").bind(&slug).fetch_one(&st.pool).await?;
    Ok(Json(json!({ "host": host, "kind": kind, "tenant": branding(&st, id).await? })))
}

// ---------- Caddy on-demand TLS: GET /v1/public/domain-check?domain= ----------

#[derive(Deserialize)]
pub struct DomainQuery {
    domain: Option<String>,
}

/// Caddy's `on_demand_tls { ask }` hook: 200 only for an active domain of an active tenant, else 404.
/// No internal token (Caddy can't send one), so it answers only direct loopback connections (no proxy
/// headers) and says nothing beyond yes / no.
pub async fn domain_check(State(st): State<AppState>, q: Query<DomainQuery>, req: Request) -> Response {
    let loopback = req.extensions().get::<ConnectInfo<SocketAddr>>().is_some_and(|c| c.0.ip().is_loopback());
    let proxied = ["x-forwarded-for", "forwarded", "x-real-ip"].iter().any(|h| req.headers().contains_key(*h));
    if !loopback || proxied {
        return StatusCode::FORBIDDEN.into_response();
    }
    let Some(domain) = q.domain.as_deref().and_then(normalize_host) else { return StatusCode::NOT_FOUND.into_response() };
    let ok: Result<Option<i64>, _> = sqlx::query_scalar(
        "SELECT d.id FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.domain = $1 AND d.status = 'active' AND t.status = 'active'",
    )
    .bind(&domain)
    .fetch_optional(&st.pool)
    .await;
    match ok {
        Ok(Some(_)) => StatusCode::OK.into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => {
            tracing::error!(error = %e, "domain check failed");
            StatusCode::SERVICE_UNAVAILABLE.into_response()
        }
    }
}

// ---------- Platform Owner: /v1/owner/tenants/{id}/domains ----------

fn owner_entry<'a>(me: &crate::admin::Staff, action: &'a str, tenant: i64, meta: Value) -> Entry<'a> {
    Entry { tenant_id: me.tenant_id, actor_kind: "staff", actor_id: Some(me.id), action, target: Some(("tenant", tenant)), meta }
}

async fn tenant_exists(st: &AppState, id: i64) -> ApiResult<()> {
    let n: Option<i64> = sqlx::query_scalar("SELECT id FROM tenants WHERE id = $1").bind(id).fetch_optional(&st.pool).await?;
    n.map(|_| ()).ok_or(ApiError::NotFound)
}

pub async fn owner_list(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>) -> ApiResult<Json<Value>> {
    require_key(&st, &ctx, "owner.tenants").await?;
    tenant_exists(&st, id).await?;
    Ok(Json(json!({ "items": records(&st.pool, id).await?, "kinds": KINDS })))
}

#[derive(Deserialize)]
pub struct AddReq {
    #[serde(default)]
    domain: String,
    #[serde(default)]
    kind: String,
}

pub async fn owner_add(State(st): State<AppState>, ctx: Ctx, Path(id): Path<i64>, req: Result<Json<AddReq>, JsonRejection>) -> ApiResult<(StatusCode, Json<Value>)> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "owner.tenants").await?;
    tenant_exists(&st, id).await?;
    let domain = crate::owner::clean_domain(&r.domain).map_err(field("domain"))?;
    let kind = if r.kind.trim().is_empty() { infer_kind(&domain) } else { clean_kind(&r.kind).map_err(field("kind"))? };
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM tenant_domains WHERE tenant_id = $1").bind(id).fetch_one(&st.pool).await?;
    if n >= MAX_DOMAINS {
        return Err(ApiError::Validation { field: "domain", message: "Up to 20 domains per broker." });
    }
    let mut tx = st.pool.begin().await?;
    let row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "INSERT INTO tenant_domains (tenant_id, domain, kind, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (domain) DO NOTHING RETURNING {RECORD_COLS}"
    )))
    .bind(id)
    .bind(&domain)
    .bind(kind)
    .bind(me.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::Coded { status: StatusCode::CONFLICT, code: "domain_taken", message: "This domain is already in use." })?;
    sync_mirror(&mut tx, id).await?;
    tx.commit().await?;
    invalidate();
    audit::record(&st.pool, &ctx, owner_entry(&me, "owner.domain_added", id, json!({"domain": domain, "kind": kind}))).await;
    Ok((StatusCode::CREATED, Json(json!({ "domain": record_json(&row) }))))
}

#[derive(Deserialize)]
pub struct UpdateReq {
    kind: Option<String>,
    status: Option<String>,
}

async fn domain_row(st: &AppState, tenant: i64, domain_id: i64) -> ApiResult<sqlx::postgres::PgRow> {
    sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {RECORD_COLS} FROM tenant_domains WHERE id = $1 AND tenant_id = $2")))
        .bind(domain_id)
        .bind(tenant)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)
}

pub async fn owner_update(State(st): State<AppState>, ctx: Ctx, Path((id, domain_id)): Path<(i64, i64)>, req: Result<Json<UpdateReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let me = require_key(&st, &ctx, "owner.tenants").await?;
    let before = domain_row(&st, id, domain_id).await?;
    let kind = r.kind.as_deref().map(clean_kind).transpose().map_err(field("kind"))?;
    let status = match r.status.as_deref().map(str::trim) {
        None => None,
        Some(s @ ("active" | "disabled")) => Some(s.to_string()),
        Some(_) => return Err(ApiError::Validation { field: "status", message: "Status is active or disabled." }),
    };
    let mut tx = st.pool.begin().await?;
    let row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "UPDATE tenant_domains SET kind = COALESCE($3, kind), status = COALESCE($4, status), updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING {RECORD_COLS}"
    )))
    .bind(domain_id)
    .bind(id)
    .bind(kind)
    .bind(&status)
    .fetch_one(&mut *tx)
    .await?;
    sync_mirror(&mut tx, id).await?;
    tx.commit().await?;
    invalidate();
    audit::record(&st.pool, &ctx, owner_entry(&me, "owner.domain_updated", id, json!({
        "domain": before.get::<String, _>("domain"),
        "before": {"kind": before.get::<String, _>("kind"), "status": before.get::<String, _>("status")},
        "after": {"kind": row.get::<String, _>("kind"), "status": row.get::<String, _>("status")},
    })))
    .await;
    Ok(Json(json!({ "domain": record_json(&row) })))
}

pub async fn owner_delete(State(st): State<AppState>, ctx: Ctx, Path((id, domain_id)): Path<(i64, i64)>) -> ApiResult<Json<Value>> {
    let me = require_key(&st, &ctx, "owner.tenants").await?;
    let before = domain_row(&st, id, domain_id).await?;
    let mut tx = st.pool.begin().await?;
    sqlx::query("DELETE FROM tenant_domains WHERE id = $1 AND tenant_id = $2").bind(domain_id).bind(id).execute(&mut *tx).await?;
    sync_mirror(&mut tx, id).await?;
    tx.commit().await?;
    invalidate();
    audit::record(&st.pool, &ctx, owner_entry(&me, "owner.domain_removed", id, json!({"domain": before.get::<String, _>("domain"), "kind": before.get::<String, _>("kind")}))).await;
    Ok(Json(json!({ "status": "ok" })))
}

/// Resolves the domain's DNS now. With `GATEWAY_PUBLIC_IPS` (comma-separated server addresses) set, the
/// domain is verified only when it points at one of them; otherwise any answer verifies it.
pub async fn owner_check(State(st): State<AppState>, ctx: Ctx, Path((id, domain_id)): Path<(i64, i64)>) -> ApiResult<Json<Value>> {
    let me = require_key(&st, &ctx, "owner.tenants").await?;
    let before = domain_row(&st, id, domain_id).await?;
    let domain: String = before.get("domain");
    let addrs: Vec<String> = match tokio::time::timeout(Duration::from_secs(4), tokio::net::lookup_host((domain.as_str(), 443))).await {
        Ok(Ok(it)) => {
            let mut v: Vec<String> = it.map(|a| a.ip().to_string()).collect();
            v.sort();
            v.dedup();
            v
        }
        _ => Vec::new(),
    };
    let expected: Vec<String> = std::env::var("GATEWAY_PUBLIC_IPS").unwrap_or_default().split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let points_here = !addrs.is_empty() && (expected.is_empty() || addrs.iter().any(|a| expected.contains(a)));
    let row = sqlx::query(sqlx::AssertSqlSafe(format!(
        "UPDATE tenant_domains SET dns_checked_at = now(), dns_addresses = $3, verified_at = CASE WHEN $4 THEN COALESCE(verified_at, now()) ELSE NULL END, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 RETURNING {RECORD_COLS}"
    )))
    .bind(domain_id)
    .bind(id)
    .bind(&addrs)
    .bind(points_here)
    .fetch_one(&st.pool)
    .await?;
    audit::record(&st.pool, &ctx, owner_entry(&me, "owner.domain_checked", id, json!({"domain": domain, "addresses": addrs, "verified": points_here}))).await;
    Ok(Json(json!({ "domain": record_json(&row), "resolves": !addrs.is_empty(), "verified": points_here, "expected": expected })))
}

#[cfg(test)]
mod tests;

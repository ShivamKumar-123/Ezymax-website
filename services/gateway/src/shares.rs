//! Trade share links: /v1/shares (owner, via the terminal BFF) and /v1/public/shares (read-only projection).
//!
//! A share is created from Kalks Trader with a snapshot of the selected trades. Creation returns a short public
//! `code` (12 chars base62, ~71 bits) and a secret manage `key` (only its HMAC is stored). The key is required to
//! refresh the snapshot, revoke the link or read owner stats. The public read returns whitelisted fields only.

use axum::Json;
use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;
use std::collections::HashSet;

use crate::audit::{self, Entry};
use crate::client_auth::body;
use crate::crypto;
use crate::error::{ApiError, ApiResult, field};
use crate::identity;
use crate::state::{AppState, Ctx};

pub const CODE_LEN: usize = 12;
pub const MAX_TRADES: usize = 100;
const MAX_ACTIVE_PER_LOGIN: i64 = 200;
const BASE62: &[u8; 62] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SOURCES: [&str; 5] = ["manual", "copy", "api", "strategy", "ai"];
const STATUSES: [&str; 4] = ["open", "closed", "pending", "cancelled"];
const ORDER_TYPES: [&str; 4] = ["market", "limit", "stop", "stop-limit"];
const EXPIRY_HOURS: [i64; 3] = [24, 168, 720];

// ---------- codes, keys, masking ----------

/// Uniform base62 code (rejection sampling: bytes >= 248 are discarded to avoid modulo bias).
pub fn new_code() -> String {
    let mut out = String::with_capacity(CODE_LEN);
    while out.len() < CODE_LEN {
        for b in crypto::random_bytes::<32>() {
            if b < 248 && out.len() < CODE_LEN {
                out.push(BASE62[(b % 62) as usize] as char);
            }
        }
    }
    out
}

pub fn is_code(s: &str) -> bool {
    s.len() == CODE_LEN && s.bytes().all(|b| b.is_ascii_alphanumeric())
}

/// `80412337` -> `804•••337`.
pub fn mask_login(login: &str) -> String {
    let c: Vec<char> = login.chars().collect();
    if c.len() <= 6 {
        return "•••".into();
    }
    format!("{}•••{}", c[..3].iter().collect::<String>(), c[c.len() - 3..].iter().collect::<String>())
}

fn key_hash(st: &AppState, key: &str) -> Vec<u8> {
    st.keys.hash("trade-share", key)
}

fn share_key(h: &HeaderMap) -> ApiResult<String> {
    h.get("x-share-key")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|k| (20..=64).contains(&k.len()) && k.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'))
        .map(str::to_string)
        .ok_or(ApiError::NotFound)
}

// ---------- trade snapshots ----------

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Trade {
    pub ticket: String,
    /// Pending order this position was filled from (lets a shared pending order become its position).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    pub symbol: String,
    pub side: String,
    pub volume: f64,
    pub open_price: f64,
    pub open_time: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sl: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tp: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub close_price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub close_time: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profit: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pips: Option<f64>,
    pub status: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

fn ticket_ok(t: &str) -> bool {
    (1..=20).contains(&t.len()) && t.bytes().all(|b| b.is_ascii_digit())
}

fn price_ok(v: f64) -> bool {
    v.is_finite() && v > 0.0 && v < 1e9
}

fn iso(raw: &str) -> Result<String, &'static str> {
    let t = DateTime::parse_from_rfc3339(raw.trim()).map_err(|_| "Trade times must be ISO-8601.")?;
    let t = t.with_timezone(&Utc);
    if t.timestamp() < 946_684_800 || t > Utc::now() + Duration::days(2) {
        return Err("Trade time is out of range.");
    }
    Ok(t.to_rfc3339_opts(SecondsFormat::Millis, true))
}

/// Validates and normalises one snapshot row.
pub fn check_trade(mut t: Trade) -> Result<Trade, &'static str> {
    if !ticket_ok(&t.ticket) || t.order.as_deref().is_some_and(|o| !ticket_ok(o)) {
        return Err("Invalid ticket.");
    }
    t.symbol = t.symbol.trim().to_uppercase();
    if !(2..=16).contains(&t.symbol.len()) || !t.symbol.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_') {
        return Err("Invalid symbol.");
    }
    if t.side != "buy" && t.side != "sell" {
        return Err("Side must be buy or sell.");
    }
    if !(t.volume.is_finite() && t.volume > 0.0 && t.volume <= 10_000.0) {
        return Err("Invalid volume.");
    }
    if !price_ok(t.open_price) || [t.sl, t.tp, t.close_price].iter().flatten().any(|v| !price_ok(*v)) {
        return Err("Invalid price.");
    }
    if [t.profit, t.pips].iter().flatten().any(|v| !v.is_finite() || v.abs() > 1e10) {
        return Err("Invalid result.");
    }
    if !STATUSES.contains(&t.status.as_str()) {
        return Err("Invalid status.");
    }
    if !SOURCES.contains(&t.source.as_str()) {
        return Err("Invalid source.");
    }
    if t.order_type.as_deref().is_some_and(|o| !ORDER_TYPES.contains(&o)) {
        return Err("Invalid order type.");
    }
    if let Some(r) = &t.reason
        && (r.len() > 20 || !r.bytes().all(|b| b.is_ascii_alphanumeric() || b == b' ' || b == b'-' || b == b'_'))
    {
        return Err("Invalid close reason.");
    }
    t.open_time = iso(&t.open_time)?;
    t.close_time = t.close_time.as_deref().map(iso).transpose()?;
    match t.status.as_str() {
        "closed" => {
            if t.close_price.is_none() || t.close_time.is_none() {
                return Err("A closed trade needs its close price and time.");
            }
        }
        _ => {
            t.close_price = None;
            if t.status != "cancelled" {
                t.close_time = None;
            }
            if t.status != "open" {
                t.profit = None;
                t.pips = None;
            }
        }
    }
    Ok(t)
}

pub fn check_trades(list: Vec<Trade>) -> ApiResult<Vec<Trade>> {
    let bad = field("trades");
    if list.is_empty() {
        return Err(bad("Choose at least one trade."));
    }
    if list.len() > MAX_TRADES {
        return Err(bad("A link can hold at most 100 trades."));
    }
    let mut seen = HashSet::new();
    let mut out = Vec::with_capacity(list.len());
    for t in list {
        let t = check_trade(t).map_err(&bad)?;
        if !seen.insert((t.ticket.clone(), t.status.clone(), t.close_time.clone())) {
            return Err(bad("Duplicate trade in the snapshot."));
        }
        out.push(t);
    }
    Ok(out)
}

/// Every updated row must belong to a ticket that was shared (or be the fill of a shared pending order).
pub fn allowed(tickets: &[String], trades: &[Trade]) -> bool {
    trades.iter().all(|t| tickets.contains(&t.ticket) || t.order.as_ref().is_some_and(|o| tickets.contains(o)))
}

/// Public projection of one trade: money P&L only when the owner opted in.
pub fn public_trade(t: &Trade, show_amounts: bool) -> Value {
    let mut v = serde_json::to_value(t).unwrap_or(Value::Null);
    if let Some(o) = v.as_object_mut() {
        o.remove("order");
        if !show_amounts {
            o.remove("profit");
        }
    }
    v
}

fn clean_title(raw: &str) -> Result<String, &'static str> {
    let v = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if v.is_empty() {
        return Ok("My trades".into());
    }
    if v.chars().count() > 80 {
        return Err("Keep the title under 80 characters.");
    }
    if v.chars().any(|c| c.is_control() || c == '<' || c == '>') {
        return Err("The title contains characters that aren't allowed.");
    }
    Ok(v)
}

fn clean_label(raw: Option<&str>) -> Result<Option<String>, &'static str> {
    match raw.map(str::trim).filter(|v| !v.is_empty()) {
        None => Ok(None),
        Some(v) if v.len() <= 40 && v.chars().all(|c| c.is_ascii_alphanumeric() || " -·/".contains(c)) => Ok(Some(v.to_string())),
        Some(_) => Err("Invalid account label."),
    }
}

// ---------- handlers ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReq {
    #[serde(default)]
    login: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    account_label: Option<String>,
    #[serde(default)]
    show_amounts: bool,
    #[serde(default)]
    expires_in_hours: Option<i64>,
    #[serde(default)]
    trades: Vec<Trade>,
}

/// POST /v1/shares -> { code, key, expires_at }
pub async fn create(State(st): State<AppState>, ctx: Ctx, req: Result<Json<CreateReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let tenant_id = identity::tenant_id(&st.pool, &ctx.tenant_slug).await?;
    crate::tenancy::require_feature(&st, tenant_id, "trade_sharing").await?;
    let login = r.login.trim().to_string();
    if !(5..=12).contains(&login.len()) || !login.bytes().all(|b| b.is_ascii_digit()) {
        return Err(ApiError::Validation { field: "login", message: "Invalid trading account." });
    }
    identity::limit(&st, format!("share:create:ip:{}", ctx.ip), 60, 3600)?;
    identity::limit(&st, format!("share:create:login:{tenant_id}:{login}"), 20, 3600)?;
    let title = clean_title(&r.title).map_err(field("title"))?;
    let label = clean_label(r.account_label.as_deref()).map_err(field("accountLabel"))?;
    let expires_at = match r.expires_in_hours {
        None | Some(0) => None,
        Some(h) if EXPIRY_HOURS.contains(&h) => Some(Utc::now() + Duration::hours(h)),
        Some(_) => return Err(ApiError::Validation { field: "expiresInHours", message: "Choose never, 24 hours, 7 days or 30 days." }),
    };
    let trades = check_trades(r.trades)?;
    let mut tickets: Vec<String> = trades.iter().map(|t| t.ticket.clone()).collect();
    tickets.sort();
    tickets.dedup();

    let active: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM trade_shares WHERE tenant_id = $1 AND login = $2 AND NOT revoked AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(tenant_id)
    .bind(&login)
    .fetch_one(&st.pool)
    .await?;
    if active >= MAX_ACTIVE_PER_LOGIN {
        return Err(ApiError::BadRequest("Too many active share links on this account. Revoke some first."));
    }

    let key = crypto::random_token(24);
    let mut row = None;
    for _ in 0..4 {
        let code = new_code();
        let r = sqlx::query(
            "INSERT INTO trade_shares (tenant_id, code, key_hash, login, account_label, title, show_amounts, tickets, trades, expires_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (code) DO NOTHING RETURNING id, code, created_at",
        )
        .bind(tenant_id)
        .bind(&code)
        .bind(key_hash(&st, &key))
        .bind(&login)
        .bind(&label)
        .bind(&title)
        .bind(r.show_amounts)
        .bind(&tickets)
        .bind(sqlx::types::Json(&trades))
        .bind(expires_at)
        .fetch_optional(&st.pool)
        .await?;
        if r.is_some() {
            row = r;
            break;
        }
    }
    let row = row.ok_or_else(|| anyhow::anyhow!("could not allocate a unique share code"))?;
    let id: i64 = row.get("id");
    let code: String = row.get("code");
    audit::record(
        &st.pool,
        &ctx,
        Entry {
            tenant_id,
            actor_kind: "anonymous",
            actor_id: None,
            action: "share.created",
            target: Some(("trade_share", id)),
            meta: json!({"login": login, "code": code, "trades": trades.len(), "show_amounts": r.show_amounts, "expires_at": expires_at}),
        },
    )
    .await;
    tracing::info!(id, trades = trades.len(), "trade share created");
    Ok(Json(json!({ "code": code, "key": key, "created_at": row.get::<DateTime<Utc>, _>("created_at"), "expires_at": expires_at })))
}

struct Owned {
    id: i64,
    tenant_id: i64,
    login: String,
    tickets: Vec<String>,
    revoked: bool,
    expired: bool,
}

/// Loads a share and checks the manage key. Unknown code and wrong key look the same (404).
async fn owned(st: &AppState, ctx: &Ctx, code: &str, h: &HeaderMap) -> ApiResult<Owned> {
    if !is_code(code) {
        return Err(ApiError::NotFound);
    }
    let key = share_key(h)?;
    identity::limit(st, format!("share:owner:ip:{}", ctx.ip), 600, 60)?;
    let r = sqlx::query(
        "SELECT id, tenant_id, key_hash, login, tickets, revoked, (expires_at IS NOT NULL AND expires_at <= now()) AS expired
         FROM trade_shares WHERE code = $1",
    )
    .bind(code)
    .fetch_optional(&st.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    let stored: Vec<u8> = r.get("key_hash");
    if !crypto::ct_eq(&stored, &key_hash(st, &key)) {
        return Err(ApiError::NotFound);
    }
    Ok(Owned { id: r.get("id"), tenant_id: r.get("tenant_id"), login: r.get("login"), tickets: r.get("tickets"), revoked: r.get("revoked"), expired: r.get("expired") })
}

#[derive(Deserialize)]
pub struct UpdateReq {
    #[serde(default)]
    trades: Vec<Trade>,
}

/// PATCH /v1/shares/:code/trades — replace the snapshot (only rows of the shared tickets).
pub async fn update_trades(State(st): State<AppState>, ctx: Ctx, Path(code): Path<String>, headers: HeaderMap, req: Result<Json<UpdateReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    let s = owned(&st, &ctx, &code, &headers).await?;
    if s.revoked || s.expired {
        return Err(ApiError::NotFound);
    }
    identity::limit(&st, format!("share:update:{code}"), 120, 60)?;
    let trades = check_trades(r.trades)?;
    if !allowed(&s.tickets, &trades) {
        return Err(ApiError::Validation { field: "trades", message: "Only the trades in this link can be updated." });
    }
    sqlx::query("UPDATE trade_shares SET trades = $2, updated_at = now() WHERE id = $1").bind(s.id).bind(sqlx::types::Json(&trades)).execute(&st.pool).await?;
    Ok(Json(json!({ "status": "ok", "trades": trades.len() })))
}

/// POST /v1/shares/:code/revoke
pub async fn revoke(State(st): State<AppState>, ctx: Ctx, Path(code): Path<String>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let s = owned(&st, &ctx, &code, &headers).await?;
    if !s.revoked {
        sqlx::query("UPDATE trade_shares SET revoked = true, revoked_at = now(), updated_at = now() WHERE id = $1").bind(s.id).execute(&st.pool).await?;
        audit::record(
            &st.pool,
            &ctx,
            Entry { tenant_id: s.tenant_id, actor_kind: "anonymous", actor_id: None, action: "share.revoked", target: Some(("trade_share", s.id)), meta: json!({"login": s.login, "code": code}) },
        )
        .await;
    }
    Ok(Json(json!({ "status": "ok", "revoked": true })))
}

#[derive(Deserialize)]
pub struct LookupItem {
    #[serde(default)]
    code: String,
    #[serde(default)]
    key: String,
}

#[derive(Deserialize)]
pub struct LookupReq {
    #[serde(default)]
    items: Vec<LookupItem>,
}

/// POST /v1/shares/lookup — owner stats for links whose code + key match (others are silently skipped).
pub async fn lookup(State(st): State<AppState>, ctx: Ctx, req: Result<Json<LookupReq>, JsonRejection>) -> ApiResult<Json<Value>> {
    let r = body(req)?;
    if r.items.len() > 50 {
        return Err(ApiError::BadRequest("At most 50 links per lookup."));
    }
    identity::limit(&st, format!("share:lookup:ip:{}", ctx.ip), 120, 60)?;
    let items: Vec<&LookupItem> = r.items.iter().filter(|i| is_code(&i.code) && (20..=64).contains(&i.key.len())).collect();
    let codes: Vec<String> = items.iter().map(|i| i.code.clone()).collect();
    let rows = sqlx::query(
        "SELECT code, key_hash, title, view_count, revoked, created_at, updated_at, expires_at, jsonb_array_length(trades) AS n,
                (expires_at IS NOT NULL AND expires_at <= now()) AS expired
         FROM trade_shares WHERE code = ANY($1)",
    )
    .bind(&codes)
    .fetch_all(&st.pool)
    .await?;
    let mut out = Vec::new();
    for row in rows {
        let code: String = row.get("code");
        let Some(item) = items.iter().find(|i| i.code == code) else { continue };
        let stored: Vec<u8> = row.get("key_hash");
        if !crypto::ct_eq(&stored, &key_hash(&st, &item.key)) {
            continue;
        }
        out.push(json!({
            "code": code,
            "title": row.get::<String, _>("title"),
            "views": row.get::<i64, _>("view_count"),
            "revoked": row.get::<bool, _>("revoked"),
            "expired": row.get::<bool, _>("expired"),
            "trades": row.get::<i32, _>("n"),
            "created_at": row.get::<DateTime<Utc>, _>("created_at"),
            "updated_at": row.get::<DateTime<Utc>, _>("updated_at"),
            "expires_at": row.get::<Option<DateTime<Utc>>, _>("expires_at"),
        }));
    }
    Ok(Json(json!({ "items": out })))
}

#[derive(Deserialize)]
pub struct PublicQuery {
    #[serde(default)]
    view: Option<u8>,
}

/// GET /v1/public/shares/:code[?view=1] — whitelisted public data; `view=1` counts a page view.
pub async fn public(State(st): State<AppState>, ctx: Ctx, Path(code): Path<String>, Query(q): Query<PublicQuery>) -> ApiResult<Json<Value>> {
    identity::limit(&st, format!("share:public:ip:{}", ctx.ip), 300, 60)?;
    if !is_code(&code) {
        return Err(ApiError::NotFound);
    }
    let count = q.view == Some(1);
    let sql = if count {
        "UPDATE trade_shares s SET view_count = view_count + 1 FROM tenants t
         WHERE s.code = $1 AND t.id = s.tenant_id AND NOT s.revoked AND (s.expires_at IS NULL OR s.expires_at > now())
         RETURNING s.login, s.account_label, s.title, s.show_amounts, s.trades, s.view_count, s.created_at, s.updated_at, s.expires_at, t.name AS broker"
    } else {
        "SELECT s.login, s.account_label, s.title, s.show_amounts, s.trades, s.view_count, s.created_at, s.updated_at, s.expires_at, t.name AS broker
         FROM trade_shares s JOIN tenants t ON t.id = s.tenant_id
         WHERE s.code = $1 AND NOT s.revoked AND (s.expires_at IS NULL OR s.expires_at > now())"
    };
    let Some(r) = sqlx::query(sql).bind(&code).fetch_optional(&st.pool).await? else {
        // misses are what enumeration looks like: throttle them hard per IP
        identity::limit(&st, format!("share:miss:ip:{}", ctx.ip), 40, 600)?;
        return Err(ApiError::NotFound);
    };
    let show: bool = r.get("show_amounts");
    let trades: sqlx::types::Json<Vec<Trade>> = r.get("trades");
    let login: String = r.get("login");
    Ok(Json(json!({
        "code": code,
        "title": r.get::<String, _>("title"),
        "alias": mask_login(&login),
        "account": r.get::<Option<String>, _>("account_label"),
        "broker": r.get::<String, _>("broker"),
        "show_amounts": show,
        "views": r.get::<i64, _>("view_count"),
        "created_at": r.get::<DateTime<Utc>, _>("created_at"),
        "updated_at": r.get::<DateTime<Utc>, _>("updated_at"),
        "expires_at": r.get::<Option<DateTime<Utc>>, _>("expires_at"),
        "trades": trades.0.iter().map(|t| public_trade(t, show)).collect::<Vec<_>>(),
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trade(ticket: &str, status: &str) -> Trade {
        Trade {
            ticket: ticket.into(),
            order: None,
            symbol: "btcusd".into(),
            side: "buy".into(),
            volume: 0.5,
            open_price: 64000.0,
            open_time: "2026-09-24T08:44:12Z".into(),
            sl: Some(63000.0),
            tp: None,
            close_price: if status == "closed" { Some(64500.0) } else { None },
            close_time: if status == "closed" { Some("2026-09-24T10:00:00Z".into()) } else { None },
            profit: Some(250.0),
            pips: Some(500.0),
            status: status.into(),
            source: "manual".into(),
            order_type: None,
            reason: None,
        }
    }

    #[test]
    fn codes_are_base62_and_unique() {
        let mut seen = HashSet::new();
        for _ in 0..2000 {
            let c = new_code();
            assert_eq!(c.len(), CODE_LEN);
            assert!(is_code(&c));
            assert!(seen.insert(c));
        }
        assert!(!is_code("short"));
        assert!(!is_code("abcdefghij-_"));
        assert!(!is_code("abcdefghijklm"));
    }

    #[test]
    fn logins_are_masked() {
        assert_eq!(mask_login("80412337"), "804•••337");
        assert_eq!(mask_login("123"), "•••");
    }

    #[test]
    fn trade_validation() {
        let t = check_trade(trade("49434418", "open")).unwrap();
        assert_eq!(t.symbol, "BTCUSD");
        assert_eq!(t.open_time, "2026-09-24T08:44:12.000Z");
        assert!(check_trade(trade("49434418", "closed")).is_ok());

        let mut bad = trade("12a", "open");
        assert!(check_trade(bad.clone()).is_err());
        bad = trade("1", "weird");
        assert!(check_trade(bad).is_err());
        let mut t = trade("1", "open");
        t.volume = f64::NAN;
        assert!(check_trade(t).is_err());
        let mut t = trade("1", "open");
        t.symbol = "<script>".into();
        assert!(check_trade(t).is_err());
        let mut t = trade("1", "closed");
        t.close_price = None;
        assert!(check_trade(t).is_err());
        let mut t = trade("1", "open");
        t.open_time = "yesterday".into();
        assert!(check_trade(t).is_err());
        let mut t = trade("1", "open");
        t.source = "hack".into();
        assert!(check_trade(t).is_err());
        // pending rows drop result fields
        let p = check_trade(trade("1", "pending")).unwrap();
        assert_eq!(p.profit, None);
        assert_eq!(p.pips, None);
    }

    #[test]
    fn snapshot_limits() {
        assert!(check_trades(vec![]).is_err());
        let many: Vec<Trade> = (0..101).map(|i| trade(&format!("{}", 1000 + i), "open")).collect();
        assert!(check_trades(many).is_err());
        let hundred: Vec<Trade> = (0..100).map(|i| trade(&format!("{}", 1000 + i), "open")).collect();
        assert_eq!(check_trades(hundred).unwrap().len(), 100);
        assert!(check_trades(vec![trade("1", "open"), trade("1", "open")]).is_err());
        // an open remainder plus its closed partial is fine
        assert!(check_trades(vec![trade("1", "open"), trade("1", "closed")]).is_ok());
    }

    #[test]
    fn updates_only_touch_shared_tickets() {
        let tickets = vec!["100".to_string(), "200".to_string()];
        assert!(allowed(&tickets, &[trade("100", "open"), trade("200", "closed")]));
        assert!(!allowed(&tickets, &[trade("300", "open")]));
        let mut filled = trade("301", "open");
        filled.order = Some("200".into());
        assert!(allowed(&tickets, &[filled]));
    }

    #[test]
    fn public_projection_hides_money_unless_allowed() {
        let mut t = trade("1", "closed");
        t.order = Some("9".into());
        let hidden = public_trade(&t, false);
        assert!(hidden.get("profit").is_none());
        assert!(hidden.get("order").is_none());
        assert_eq!(hidden["pips"], json!(500.0));
        assert_eq!(public_trade(&t, true)["profit"], json!(250.0));
    }

    #[test]
    fn titles_and_labels() {
        assert_eq!(clean_title("  Gold   week ").unwrap(), "Gold week");
        assert_eq!(clean_title("").unwrap(), "My trades");
        assert!(clean_title("<b>x</b>").is_err());
        assert!(clean_title(&"x".repeat(81)).is_err());
        assert_eq!(clean_label(Some("Pro · hedging")).unwrap(), Some("Pro · hedging".into()));
        assert!(clean_label(Some("balance: $100,000")).is_err());
    }
}

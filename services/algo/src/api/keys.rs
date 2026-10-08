//! Public API keys management (D78): per trading account, scopes read / trade (never withdraw), IP
//! whitelist, expiry, per-key rate limit. The secret is shown once and never stored (see `secret_for`).

use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Res, i, s};
use crate::error::ApiError;
use crate::security::{hmac_b64, random_token};
use crate::state::{AppState, User, audit};

/// The key's secret: HMAC(ALGO_KEY_SECRET, key_id:salt). Only the salt is stored.
pub fn secret_for(master: &str, key_id: &str, salt: &str) -> String {
    format!("ks_{}", hmac_b64(master.as_bytes(), format!("api-key:{key_id}:{salt}").as_bytes()))
}

fn valid_ip_entry(e: &str) -> bool {
    let (ip, bits) = e.split_once('/').map(|(a, b)| (a, Some(b))).unwrap_or((e, None));
    ip.parse::<std::net::IpAddr>().is_ok() && bits.is_none_or(|b| b.parse::<u32>().is_ok_and(|b| b <= 32) && ip.contains('.'))
}

pub fn key_view(r: &sqlx::postgres::PgRow) -> Value {
    let expires: Option<chrono::DateTime<chrono::Utc>> = r.get("expires_at");
    let status: String = r.get("status");
    let expired = expires.is_some_and(|e| e < chrono::Utc::now());
    json!({
        "id": r.get::<i64, _>("id"), "name": r.get::<String, _>("name"), "keyId": r.get::<String, _>("key_id"), "login": r.get::<i64, _>("login"), "accountType": r.get::<String, _>("account_type"),
        "scopes": r.get::<Vec<String>, _>("scopes"), "ipWhitelist": r.get::<Vec<String>, _>("ip_whitelist"), "ratePerMin": r.get::<Option<i32>, _>("rate_per_min"),
        "expiresAt": expires, "status": if status == "active" && expired { "expired".to_string() } else { status },
        "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "lastUsedAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_used_at"),
        "lastIp": r.get::<Option<String>, _>("last_ip"), "revokedAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("revoked_at"), "revokedBy": r.get::<Option<String>, _>("revoked_by"),
    })
}

pub async fn list(State(st): State<AppState>, u: User) -> Res {
    let rows = sqlx::query("SELECT * FROM api_keys WHERE tenant_id = $1 AND user_id = $2 ORDER BY id DESC").bind(&u.tenant).bind(u.id).fetch_all(&st.pool).await?;
    let usage = sqlx::query(
        "SELECT count(*) AS n, count(*) FILTER (WHERE r.status >= 400) AS errors, count(*) FILTER (WHERE r.status = 429) AS limited,
                COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.ms), 0)::float8 AS p50, COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY r.ms), 0)::float8 AS p99,
                count(*) FILTER (WHERE r.method <> 'GET' AND r.status < 400) AS orders
         FROM api_requests r JOIN api_keys k ON k.id = r.key_id WHERE k.tenant_id = $1 AND k.user_id = $2 AND r.at > now() - interval '1 day'",
    )
    .bind(&u.tenant)
    .bind(u.id)
    .fetch_one(&st.pool)
    .await?;
    let hourly = sqlx::query("SELECT date_trunc('hour', r.at) AS h, count(*) AS n FROM api_requests r JOIN api_keys k ON k.id = r.key_id WHERE k.tenant_id = $1 AND k.user_id = $2 AND r.at > now() - interval '1 day' GROUP BY 1 ORDER BY 1")
        .bind(&u.tenant)
        .bind(u.id)
        .fetch_all(&st.pool)
        .await?;
    Ok(Json(json!({
        "items": rows.iter().map(key_view).collect::<Vec<_>>(),
        "usage": {"requests24h": usage.get::<i64, _>("n"), "errors24h": usage.get::<i64, _>("errors"), "rateLimited24h": usage.get::<i64, _>("limited"), "p50": usage.get::<f64, _>("p50"), "p99": usage.get::<f64, _>("p99"), "writes24h": usage.get::<i64, _>("orders"),
                  "hourly": hourly.iter().map(|h| json!({"t": h.get::<chrono::DateTime<chrono::Utc>, _>("h"), "n": h.get::<i64, _>("n")})).collect::<Vec<_>>()},
        "baseUrl": format!("{}/public/v1", st.cfg.public_url),
    })))
}

pub async fn create(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM api_keys WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'").bind(&u.tenant).bind(u.id).fetch_one(&st.pool).await?;
    if n >= 20 {
        return Err(ApiError::conflict("limit", "You can have up to 20 active API keys."));
    }
    let login = i(&v, "login").ok_or_else(|| ApiError::validation("login", "Choose the trading account this key can use."))?;
    let acct = st.engine.account(&u.tenant, u.id, login).await.map_err(|_| ApiError::unavailable("Trading service is unavailable."))?.ok_or_else(|| ApiError::not_found("Trading account"))?;
    let kind = acct.pointer("/account/type").and_then(Value::as_str).unwrap_or("demo").to_string();
    let mut scopes: Vec<String> = v.get("scopes").and_then(Value::as_array).map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect()).unwrap_or_else(|| vec!["read".into()]);
    scopes.sort();
    scopes.dedup();
    if scopes.is_empty() || scopes.iter().any(|s| s != "read" && s != "trade") {
        return Err(ApiError::validation("scopes", "Scopes are read and/or trade (withdrawals are never possible through the API)."));
    }
    let ips: Vec<String> = v.get("ipWhitelist").and_then(Value::as_array).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.trim().to_string())).filter(|s| !s.is_empty()).collect()).unwrap_or_default();
    if ips.len() > 20 || ips.iter().any(|e| !valid_ip_entry(e)) {
        return Err(ApiError::validation("ipWhitelist", "Use up to 20 IP addresses or IPv4 ranges such as 203.0.113.0/24."));
    }
    if scopes.contains(&"trade".to_string()) && kind == "live" && ips.is_empty() && v.get("allowAnyIp") != Some(&Value::Bool(true)) {
        return Err(ApiError::validation("ipWhitelist", "Trading keys for live accounts need an IP whitelist."));
    }
    let expires = match (i(&v, "expiresInDays"), s(&v, "expiresAt")) {
        (Some(d), _) if (1..=3650).contains(&d) => Some(chrono::Utc::now() + chrono::Duration::days(d)),
        (_, Some(t)) => Some(chrono::DateTime::parse_from_rfc3339(t).map_err(|_| ApiError::validation("expiresAt", "Use an ISO date"))?.with_timezone(&chrono::Utc)),
        _ => None,
    };
    if expires.is_some_and(|e| e < chrono::Utc::now()) {
        return Err(ApiError::validation("expiresAt", "The expiry must be in the future."));
    }
    let rate = i(&v, "ratePerMin").map(|r| r.clamp(1, 600) as i32);
    let name = s(&v, "name").unwrap_or("API key").chars().take(60).collect::<String>();
    let key_id = format!("kk_{}", random_token(12));
    let salt = random_token(16);
    let id: i64 = sqlx::query_scalar("INSERT INTO api_keys (tenant_id, user_id, login, account_type, name, key_id, salt, scopes, ip_whitelist, rate_per_min, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id")
        .bind(&u.tenant)
        .bind(u.id)
        .bind(login)
        .bind(&kind)
        .bind(&name)
        .bind(&key_id)
        .bind(&salt)
        .bind(&scopes)
        .bind(&ips)
        .bind(rate)
        .bind(expires)
        .fetch_one(&st.pool)
        .await?;
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "apikey.create", &format!("apikey:{id}"), json!({"login": login, "scopes": scopes, "ips": ips.len()})).await;
    Ok(Json(json!({"id": id, "name": name, "keyId": key_id, "secret": secret_for(&st.cfg.key_secret, &key_id, &salt), "login": login, "scopes": scopes, "expiresAt": expires,
                   "note": "The secret is shown once. Store it in a secrets manager; Ezymex can't show it again."})))
}

async fn own(st: &AppState, u: &User, id: i64) -> Result<sqlx::postgres::PgRow, ApiError> {
    sqlx::query("SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2 AND user_id = $3").bind(id).bind(&u.tenant).bind(u.id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("API key"))
}

pub async fn update(State(st): State<AppState>, u: User, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    let r = own(&st, &u, id).await?;
    if r.get::<String, _>("status") != "active" {
        return Err(ApiError::conflict("revoked", "This key is revoked."));
    }
    if let Some(n) = s(&v, "name") {
        sqlx::query("UPDATE api_keys SET name = $2 WHERE id = $1").bind(id).bind(n.chars().take(60).collect::<String>()).execute(&st.pool).await?;
    }
    if let Some(a) = v.get("ipWhitelist").and_then(Value::as_array) {
        let ips: Vec<String> = a.iter().filter_map(|x| x.as_str().map(|s| s.trim().to_string())).filter(|s| !s.is_empty()).collect();
        if ips.len() > 20 || ips.iter().any(|e| !valid_ip_entry(e)) {
            return Err(ApiError::validation("ipWhitelist", "Use up to 20 IP addresses or IPv4 ranges."));
        }
        sqlx::query("UPDATE api_keys SET ip_whitelist = $2 WHERE id = $1").bind(id).bind(&ips).execute(&st.pool).await?;
    }
    Ok(Json(json!({"status": "ok"})))
}

pub async fn revoke(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    own(&st, &u, id).await?;
    sqlx::query("UPDATE api_keys SET status = 'revoked', revoked_at = now(), revoked_by = $2 WHERE id = $1 AND status = 'active'").bind(id).bind(format!("user:{}", u.id)).execute(&st.pool).await?;
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "apikey.revoke", &format!("apikey:{id}"), json!({})).await;
    Ok(Json(json!({"status": "revoked"})))
}

pub async fn activity(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    own(&st, &u, id).await?;
    let rows = sqlx::query("SELECT at, method, path, status, ip, ms FROM api_requests WHERE key_id = $1 ORDER BY id DESC LIMIT 200").bind(id).fetch_all(&st.pool).await?;
    Ok(Json(json!({"items": rows.iter().map(|r| json!({"at": r.get::<chrono::DateTime<chrono::Utc>, _>("at"), "method": r.get::<String, _>("method"), "path": r.get::<String, _>("path"), "status": r.get::<i32, _>("status"), "ip": r.get::<Option<String>, _>("ip"), "ms": r.get::<i32, _>("ms")})).collect::<Vec<_>>()})))
}

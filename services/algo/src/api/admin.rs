//! Back Office API: overview, strategies and deployments, kill switches (deployment / user / platform),
//! marketplace moderation, API keys, webhook activity, subscriptions, settings (platform cut, limits), audit.
//! The admin BFF checks algo.read / algo.write first; roles are checked again here.

use axum::Json;
use axum::extract::{Path, Query, State};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Res, b, s};
use crate::error::ApiError;
use crate::state::{AppState, STAFF_CONFIG_ROLES, STAFF_WRITE_ROLES, Staff, audit as write_audit, default_settings, settings};

fn note(v: &Value) -> Result<String, ApiError> {
    s(v, "note").map(|n| n.chars().take(500).collect()).ok_or_else(|| ApiError::validation("note", "Add a note for the audit log."))
}

pub async fn overview(State(st): State<AppState>, sf: Staff) -> Res {
    let t = &sf.tenant;
    let one = |sql: &'static str| {
        let (pool, t) = (st.pool.clone(), t.clone());
        async move { sqlx::query_scalar::<_, i64>(sql).bind(t).fetch_one(&pool).await.unwrap_or(0) }
    };
    let s = settings(&st.pool, t).await;
    let revenue = sqlx::query("SELECT COALESCE(sum(amount),0)::float8 AS gross, COALESCE(sum(platform_fee),0)::float8 AS fees FROM subscription_payments WHERE tenant_id = $1 AND status = 'completed' AND created_at > now() - interval '30 days'").bind(t).fetch_one(&st.pool).await?;
    let sources = sqlx::query(
        "SELECT 'strategy' AS source, count(*) AS n FROM deployment_positions WHERE tenant_id = $1 AND opened_at > now() - interval '1 day'
         UNION ALL SELECT 'webhook', count(*) FROM webhook_events WHERE tenant_id = $1 AND received_at > now() - interval '1 day' AND status IN ('accepted','partial')
         UNION ALL SELECT 'api', count(*) FROM api_requests WHERE tenant_id = $1 AND at > now() - interval '1 day' AND method <> 'GET' AND status < 400",
    )
    .bind(t)
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({
        "strategies": one("SELECT count(*) FROM strategies WHERE tenant_id = $1 AND status = 'active'").await,
        "deploymentsRunning": one("SELECT count(*) FROM deployments WHERE tenant_id = $1 AND status = 'running'").await,
        "deploymentsLive": one("SELECT count(*) FROM deployments WHERE tenant_id = $1 AND status IN ('running','paused') AND account_type = 'live'").await,
        "openPositions": one("SELECT count(*) FROM deployment_positions WHERE tenant_id = $1 AND closed_at IS NULL").await,
        "backtests24h": one("SELECT count(*) FROM backtests WHERE tenant_id = $1 AND created_at > now() - interval '1 day'").await,
        "backtestsQueued": one("SELECT count(*) FROM backtests WHERE tenant_id = $1 AND status IN ('queued','running')").await,
        "webhookEvents24h": one("SELECT count(*) FROM webhook_events WHERE tenant_id = $1 AND received_at > now() - interval '1 day'").await,
        "webhookRejected24h": one("SELECT count(*) FROM webhook_events WHERE tenant_id = $1 AND received_at > now() - interval '1 day' AND status NOT IN ('accepted','partial')").await,
        "apiKeysActive": one("SELECT count(*) FROM api_keys WHERE tenant_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > now())").await,
        "apiRequests24h": one("SELECT count(*) FROM api_requests WHERE tenant_id = $1 AND at > now() - interval '1 day'").await,
        "listingsPending": one("SELECT count(*) FROM listings WHERE tenant_id = $1 AND status = 'pending'").await,
        "listingsApproved": one("SELECT count(*) FROM listings WHERE tenant_id = $1 AND status = 'approved'").await,
        "subscriptionsActive": one("SELECT count(*) FROM subscriptions WHERE tenant_id = $1 AND status = 'active'").await,
        "usersKilled": one("SELECT count(*) FROM user_controls WHERE tenant_id = $1 AND killed").await,
        "aiRequests24h": one("SELECT count(*) FROM ai_requests WHERE tenant_id = $1 AND at > now() - interval '1 day'").await,
        "revenue30d": {"gross": revenue.get::<f64, _>("gross"), "platformFees": revenue.get::<f64, _>("fees")},
        "ordersBySource24h": sources.iter().map(|r| json!({"source": r.get::<String, _>("source"), "count": r.get::<i64, _>("n")})).collect::<Vec<_>>(),
        "globalKill": s.get("globalKill").and_then(Value::as_bool).unwrap_or(false),
        "settings": s,
    })))
}

#[derive(Deserialize)]
pub struct ListQ {
    q: Option<String>,
    status: Option<String>,
    user_id: Option<i64>,
    limit: Option<i64>,
}

pub async fn strategies(State(st): State<AppState>, sf: Staff, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query(
        "SELECT s.*, (SELECT count(*) FROM deployments d WHERE d.strategy_id = s.id AND d.status IN ('running','paused')) AS running,
                (SELECT count(*) FROM backtests b WHERE b.strategy_id = s.id) AS backtests
         FROM strategies s WHERE s.tenant_id = $1 AND ($2::text IS NULL OR s.name ILIKE '%' || $2 || '%' OR s.symbol ILIKE $2) AND ($3::bigint IS NULL OR s.user_id = $3)
         ORDER BY s.updated_at DESC LIMIT $4",
    )
    .bind(&sf.tenant)
    .bind(q.q.as_deref().filter(|x| !x.is_empty()))
    .bind(q.user_id)
    .bind(q.limit.unwrap_or(200).clamp(1, 500))
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({"items": rows.iter().map(|r| json!({
        "id": r.get::<i64, _>("id"), "userId": r.get::<i64, _>("user_id"), "name": r.get::<String, _>("name"), "symbol": r.get::<String, _>("symbol"), "timeframe": r.get::<String, _>("timeframe"),
        "kind": r.get::<String, _>("kind"), "origin": r.get::<String, _>("origin"), "status": r.get::<String, _>("status"), "version": r.get::<i32, _>("latest_version"),
        "running": r.get::<i64, _>("running"), "backtests": r.get::<i64, _>("backtests"), "updatedAt": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
    })).collect::<Vec<_>>()})))
}

pub async fn deployments(State(st): State<AppState>, sf: Staff, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query(
        "SELECT d.*, s.name AS strategy_name, s.symbol, s.timeframe, v.version,
                (SELECT count(*) FROM deployment_positions p WHERE p.deployment_id = d.id AND p.closed_at IS NULL) AS open_positions
         FROM deployments d JOIN strategies s ON s.id = d.strategy_id JOIN strategy_versions v ON v.id = d.version_id
         WHERE d.tenant_id = $1 AND ($2::text IS NULL OR d.status = $2 OR ($2 = 'active' AND d.status IN ('running','paused'))) AND ($3::bigint IS NULL OR d.user_id = $3)
         ORDER BY d.id DESC LIMIT $4",
    )
    .bind(&sf.tenant)
    .bind(q.status.as_deref().filter(|x| !x.is_empty()))
    .bind(q.user_id)
    .bind(q.limit.unwrap_or(200).clamp(1, 500))
    .fetch_all(&st.pool)
    .await?;
    let logs = sqlx::query("SELECT l.deployment_id, l.at, l.level, l.kind, l.message FROM deployment_logs l WHERE l.tenant_id = $1 AND l.level IN ('warn','error') ORDER BY l.id DESC LIMIT 50").bind(&sf.tenant).fetch_all(&st.pool).await?;
    Ok(Json(json!({
        "items": rows.iter().map(crate::api::deployments::view).collect::<Vec<_>>(),
        "alerts": logs.iter().map(|l| json!({"deploymentId": l.get::<i64, _>("deployment_id"), "at": l.get::<chrono::DateTime<chrono::Utc>, _>("at"), "level": l.get::<String, _>("level"), "kind": l.get::<String, _>("kind"), "message": l.get::<String, _>("message")})).collect::<Vec<_>>(),
    })))
}

pub async fn kill_deployment(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&STAFF_WRITE_ROLES)?;
    let n = note(&v)?;
    let r = sqlx::query("SELECT status FROM deployments WHERE id = $1 AND tenant_id = $2").bind(id).bind(&sf.tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Deployment"))?;
    if !matches!(r.get::<String, _>("status").as_str(), "running" | "paused") {
        return Err(ApiError::conflict("state", "The deployment is not running."));
    }
    let (c, f) = crate::api::deployments::stop(&st, id, "killed", &format!("kill switch by {} ({n})", sf.name), b(&v, "closePositions").unwrap_or(true)).await?;
    write_audit(&st.pool, &sf.tenant, &sf.actor(), "deployment.kill", &format!("deployment:{id}"), json!({"note": n, "closed": c, "failed": f})).await;
    Ok(Json(json!({"status": "killed", "closed": c, "failed": f})))
}

pub async fn kill_user(State(st): State<AppState>, sf: Staff, Path(user): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&STAFF_WRITE_ROLES)?;
    let n = note(&v)?;
    let killed = b(&v, "killed").unwrap_or(true);
    let out = crate::api::deployments::set_user_kill(&st, &sf.tenant, user, killed, b(&v, "closePositions").unwrap_or(false), &sf.actor(), &format!("staff {}: {n}", sf.name)).await?;
    Ok(Json(out))
}

pub async fn get_settings(State(st): State<AppState>, sf: Staff) -> Res {
    Ok(Json(json!({"settings": settings(&st.pool, &sf.tenant).await, "defaults": default_settings()})))
}

pub async fn put_settings(State(st): State<AppState>, sf: Staff, Body(v): Body<Value>) -> Res {
    sf.require(&STAFF_CONFIG_ROLES)?;
    let n = note(&v)?;
    let mut cur = settings(&st.pool, &sf.tenant).await;
    let before = cur.clone();
    let input = v.get("settings").cloned().unwrap_or(json!({}));
    let num = |k: &str, lo: f64, hi: f64| -> Result<Option<f64>, ApiError> {
        match input.get(k) {
            None => Ok(None),
            Some(x) => x.as_f64().filter(|x| *x >= lo && *x <= hi).map(Some).ok_or_else(|| ApiError::validation("settings", format!("{k} must be between {lo} and {hi}"))),
        }
    };
    for (k, lo, hi) in [("platformCutPct", 0.0, 90.0), ("apiRatePerMin", 1.0, 6000.0), ("webhookRatePerMin", 1.0, 600.0), ("maxDeploymentsPerUser", 0.0, 500.0), ("minTrackTrades", 0.0, 1000.0), ("aiPerHour", 0.0, 1000.0), ("backtestsPerDay", 0.0, 10000.0)] {
        if let Some(x) = num(k, lo, hi)? {
            cur[k] = if k == "platformCutPct" { json!(x) } else { json!(x.round() as i64) };
        }
    }
    let kill_on = input.get("globalKill").and_then(Value::as_bool);
    if let Some(g) = kill_on {
        cur["globalKill"] = json!(g);
    }
    sqlx::query("INSERT INTO settings (tenant_id, key, value, updated_by) VALUES ($1, 'algo', $2, $3) ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2, updated_at = now(), updated_by = $3")
        .bind(&sf.tenant)
        .bind(&cur)
        .bind(sf.actor())
        .execute(&st.pool)
        .await?;
    let mut stopped = json!(null);
    if kill_on == Some(true) && b(&v, "closePositions").unwrap_or(false) {
        // platform kill with close: kill every running deployment and close its positions
        let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM deployments WHERE tenant_id = $1 AND status IN ('running','paused')").bind(&sf.tenant).fetch_all(&st.pool).await?;
        let (mut c, mut f) = (0, 0);
        for id in &ids {
            let (a, b) = crate::api::deployments::stop(&st, *id, "killed", &format!("platform kill switch by {}", sf.name), true).await?;
            c += a;
            f += b;
        }
        stopped = json!({"deployments": ids.len(), "closed": c, "failed": f});
    }
    st.runtime_wake.notify_waiters();
    write_audit(&st.pool, &sf.tenant, &sf.actor(), "settings.update", "algo", json!({"note": n, "before": before, "after": cur, "stopped": stopped})).await;
    Ok(Json(json!({"settings": cur, "stopped": stopped})))
}

pub async fn listings(State(st): State<AppState>, sf: Staff, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query("SELECT * FROM listings WHERE tenant_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY (status = 'pending') DESC, id DESC LIMIT 300")
        .bind(&sf.tenant)
        .bind(q.status.as_deref().filter(|x| !x.is_empty()))
        .fetch_all(&st.pool)
        .await?;
    let mut items = vec![];
    for r in &rows {
        let tr = crate::api::market::track_record(&st, r.get("track_deployment_id")).await?;
        items.push(json!({
            "id": r.get::<i64, _>("id"), "title": r.get::<String, _>("title"), "description": r.get::<String, _>("description"), "author": r.get::<String, _>("author_name"),
            "authorUserId": r.get::<i64, _>("author_user_id"), "symbol": r.get::<String, _>("symbol"), "timeframe": r.get::<String, _>("timeframe"),
            "priceMonthly": r.get::<Decimal, _>("price_monthly").to_f64(), "status": r.get::<String, _>("status"), "moderationNote": r.get::<Option<String>, _>("moderation_note"),
            "moderatedBy": r.get::<Option<String>, _>("moderated_by"), "subscribers": r.get::<i32, _>("subscribers"), "rating": r.get::<f32, _>("rating_avg"),
            "allowClone": r.get::<bool, _>("allow_clone"), "strategyId": r.get::<i64, _>("strategy_id"), "versionId": r.get::<i64, _>("version_id"),
            "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "track": {"trades": tr["trades"], "winRate": tr["winRate"], "returnPct": tr["returnPct"], "maxDrawdownPct": tr["maxDrawdownPct"], "days": tr["days"], "accountType": tr["accountType"]},
        }));
    }
    Ok(Json(json!({"items": items})))
}

pub async fn moderate(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&STAFF_WRITE_ROLES)?;
    let n = note(&v)?;
    let status = s(&v, "status").filter(|x| ["approved", "rejected", "suspended"].contains(x)).ok_or_else(|| ApiError::validation("status", "status must be approved, rejected or suspended"))?;
    let r = sqlx::query("UPDATE listings SET status = $3, moderation_note = $4, moderated_by = $5, moderated_at = now(), updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id").bind(id).bind(&sf.tenant).bind(status).bind(&n).bind(&sf.name).fetch_optional(&st.pool).await?;
    if r.is_none() {
        return Err(ApiError::not_found("Listing"));
    }
    write_audit(&st.pool, &sf.tenant, &sf.actor(), &format!("listing.{status}"), &format!("listing:{id}"), json!({"note": n})).await;
    Ok(Json(json!({"status": status})))
}

pub async fn keys(State(st): State<AppState>, sf: Staff, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query(
        "SELECT k.*, (SELECT count(*) FROM api_requests r WHERE r.key_id = k.id AND r.at > now() - interval '1 day') AS requests_24h FROM api_keys k
         WHERE k.tenant_id = $1 AND ($2::bigint IS NULL OR k.user_id = $2) AND ($3::text IS NULL OR k.status = $3) ORDER BY k.id DESC LIMIT 500",
    )
    .bind(&sf.tenant)
    .bind(q.user_id)
    .bind(q.status.as_deref().filter(|x| !x.is_empty()))
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({"items": rows.iter().map(|r| {
        let mut v = crate::api::keys::key_view(r);
        v["userId"] = json!(r.get::<i64, _>("user_id"));
        v["requests24h"] = json!(r.get::<i64, _>("requests_24h"));
        v
    }).collect::<Vec<_>>()})))
}

pub async fn revoke_key(State(st): State<AppState>, sf: Staff, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    sf.require(&STAFF_WRITE_ROLES)?;
    let n = note(&v)?;
    let r = sqlx::query("UPDATE api_keys SET status = 'revoked', revoked_at = now(), revoked_by = $3 WHERE id = $1 AND tenant_id = $2 AND status = 'active' RETURNING id").bind(id).bind(&sf.tenant).bind(format!("{} ({})", sf.actor(), sf.name)).fetch_optional(&st.pool).await?;
    if r.is_none() {
        return Err(ApiError::conflict("state", "Key not found or already revoked."));
    }
    write_audit(&st.pool, &sf.tenant, &sf.actor(), "apikey.revoke", &format!("apikey:{id}"), json!({"note": n})).await;
    Ok(Json(json!({"status": "revoked"})))
}

pub async fn webhook_events(State(st): State<AppState>, sf: Staff, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query(
        "SELECT e.id, e.webhook_id, e.user_id, e.received_at, e.ip, e.payload, e.status, e.error, e.results, w.name FROM webhook_events e JOIN webhooks w ON w.id = e.webhook_id
         WHERE e.tenant_id = $1 AND ($2::text IS NULL OR e.status = $2) AND ($3::bigint IS NULL OR e.user_id = $3) ORDER BY e.id DESC LIMIT $4",
    )
    .bind(&sf.tenant)
    .bind(q.status.as_deref().filter(|x| !x.is_empty()))
    .bind(q.user_id)
    .bind(q.limit.unwrap_or(200).clamp(1, 1000))
    .fetch_all(&st.pool)
    .await?;
    let hooks = sqlx::query("SELECT w.id, w.user_id, w.name, w.status, w.last_used_at, (SELECT count(*) FROM webhook_routes r WHERE r.webhook_id = w.id) AS routes FROM webhooks w WHERE w.tenant_id = $1 ORDER BY w.id DESC LIMIT 500").bind(&sf.tenant).fetch_all(&st.pool).await?;
    Ok(Json(json!({
        "events": rows.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "webhookId": r.get::<i64, _>("webhook_id"), "webhook": r.get::<String, _>("name"), "userId": r.get::<i64, _>("user_id"), "receivedAt": r.get::<chrono::DateTime<chrono::Utc>, _>("received_at"), "ip": r.get::<Option<String>, _>("ip"), "payload": r.get::<Option<Value>, _>("payload"), "status": r.get::<String, _>("status"), "error": r.get::<Option<String>, _>("error"), "results": r.get::<Value, _>("results")})).collect::<Vec<_>>(),
        "webhooks": hooks.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "userId": r.get::<i64, _>("user_id"), "name": r.get::<String, _>("name"), "status": r.get::<String, _>("status"), "routes": r.get::<i64, _>("routes"), "lastUsedAt": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_used_at")})).collect::<Vec<_>>(),
    })))
}

pub async fn subscriptions(State(st): State<AppState>, sf: Staff) -> Res {
    let rows = sqlx::query(
        "SELECT p.id, p.subscription_id, p.amount::float8 AS amount, p.platform_fee::float8 AS fee, p.author_amount::float8 AS author, p.cut_pct::float8 AS cut, p.status, p.error, p.created_at, s.user_id, l.title, l.author_name
         FROM subscription_payments p JOIN subscriptions s ON s.id = p.subscription_id JOIN listings l ON l.id = s.listing_id WHERE p.tenant_id = $1 ORDER BY p.id DESC LIMIT 300",
    )
    .bind(&sf.tenant)
    .fetch_all(&st.pool)
    .await?;
    let subs = sqlx::query("SELECT s.id, s.user_id, s.mode, s.status, s.price::float8 AS price, s.period_end, s.created_at, l.title FROM subscriptions s JOIN listings l ON l.id = s.listing_id WHERE s.tenant_id = $1 ORDER BY s.id DESC LIMIT 300").bind(&sf.tenant).fetch_all(&st.pool).await?;
    Ok(Json(json!({
        "payments": rows.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "subscriptionId": r.get::<i64, _>("subscription_id"), "userId": r.get::<i64, _>("user_id"), "title": r.get::<String, _>("title"), "author": r.get::<String, _>("author_name"), "amount": r.get::<f64, _>("amount"), "platformFee": r.get::<f64, _>("fee"), "authorAmount": r.get::<f64, _>("author"), "cutPct": r.get::<f64, _>("cut"), "status": r.get::<String, _>("status"), "error": r.get::<Option<String>, _>("error"), "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at")})).collect::<Vec<_>>(),
        "subscriptions": subs.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "userId": r.get::<i64, _>("user_id"), "title": r.get::<String, _>("title"), "mode": r.get::<String, _>("mode"), "status": r.get::<String, _>("status"), "price": r.get::<f64, _>("price"), "periodEnd": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("period_end"), "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at")})).collect::<Vec<_>>(),
    })))
}

pub async fn audit(State(st): State<AppState>, sf: Staff, Query(q): Query<ListQ>) -> Res {
    let rows = sqlx::query("SELECT id, at, actor, action, target, data FROM audit_log WHERE tenant_id = $1 ORDER BY id DESC LIMIT $2").bind(&sf.tenant).bind(q.limit.unwrap_or(200).clamp(1, 1000)).fetch_all(&st.pool).await?;
    Ok(Json(json!({"items": rows.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "at": r.get::<chrono::DateTime<chrono::Utc>, _>("at"), "actor": r.get::<String, _>("actor"), "action": r.get::<String, _>("action"), "target": r.get::<Option<String>, _>("target"), "data": r.get::<Value, _>("data")})).collect::<Vec<_>>()})))
}

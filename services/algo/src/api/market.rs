//! Strategy marketplace (D83): publish a strategy version with a verified runtime track record, free or a
//! monthly price in USDT; subscribers either copy it (the version runs on their own account) or, when
//! the author allows it, clone the spec into their own strategies. Paid subscriptions are charged from the
//! subscriber's wallet and the author is credited the price minus the platform cut (wallet transfers,
//! kind `adjustment`, idempotent keys `algo:sub:<id>:<period>:debit|credit`). Listings are moderated.

use axum::Json;
use axum::extract::{Path, Query, State};
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Res, b, f, i, s};
use crate::error::ApiError;
use crate::state::{AppState, User, audit, setting_f64, settings};
use crate::strategy::{build, insert, load_version, own_version};

/// Verified track record of a deployment, computed from the engine's closed deals (never user input).
pub async fn track_record(st: &AppState, dep: i64) -> Result<Value, ApiError> {
    let d = sqlx::query("SELECT account_type, login, created_at, stopped_at, status, start_balance::float8 AS sb FROM deployments WHERE id = $1").bind(dep).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Deployment"))?;
    let rows = sqlx::query("SELECT day, realized::float8 AS r, trades, wins FROM deployment_daily WHERE deployment_id = $1 ORDER BY day").bind(dep).fetch_all(&st.pool).await?;
    let start = d.get::<Option<f64>, _>("sb").filter(|v| *v > 0.0).unwrap_or(10_000.0);
    let (mut eq, mut peak, mut dd) = (start, start, 0.0f64);
    let mut curve = vec![];
    let (mut trades, mut wins, mut net) = (0i64, 0i64, 0.0f64);
    for r in &rows {
        let x: f64 = r.get("r");
        eq += x;
        net += x;
        trades += r.get::<i32, _>("trades") as i64;
        wins += r.get::<i32, _>("wins") as i64;
        peak = peak.max(eq);
        dd = dd.max((peak - eq) / peak * 100.0);
        curve.push(json!({"day": r.get::<chrono::NaiveDate, _>("day"), "realized": (x * 100.0).round() / 100.0, "equity": (eq * 100.0).round() / 100.0}));
    }
    let started: chrono::DateTime<chrono::Utc> = d.get("created_at");
    let end = d.get::<Option<chrono::DateTime<chrono::Utc>>, _>("stopped_at").unwrap_or_else(chrono::Utc::now);
    Ok(json!({
        "verified": true,
        "source": "Kalks runtime (closed deals on the trading engine)",
        "accountType": d.get::<String, _>("account_type"),
        "deploymentId": dep,
        "deploymentStatus": d.get::<String, _>("status"),
        "since": started,
        "days": ((end - started).num_hours() as f64 / 24.0 * 10.0).round() / 10.0,
        "trades": trades, "wins": wins,
        "winRate": if trades > 0 { (wins as f64 / trades as f64 * 1000.0).round() / 10.0 } else { 0.0 },
        "netProfit": (net * 100.0).round() / 100.0,
        "returnPct": (net / start * 10000.0).round() / 100.0,
        "maxDrawdownPct": (dd * 100.0).round() / 100.0,
        "startBalance": start,
        "curve": curve,
    }))
}

fn listing_view(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": r.get::<i64, _>("id"), "title": r.get::<String, _>("title"), "description": r.get::<String, _>("description"),
        "author": r.get::<String, _>("author_name"), "authorUserId": r.get::<i64, _>("author_user_id"),
        "symbol": r.get::<String, _>("symbol"), "timeframe": r.get::<String, _>("timeframe"),
        "priceMonthly": r.get::<Decimal, _>("price_monthly").to_f64(), "currency": r.get::<String, _>("currency"), "allowClone": r.get::<bool, _>("allow_clone"),
        "status": r.get::<String, _>("status"), "moderationNote": r.get::<Option<String>, _>("moderation_note"),
        "rating": r.get::<f32, _>("rating_avg"), "ratings": r.get::<i32, _>("rating_count"), "subscribers": r.get::<i32, _>("subscribers"),
        "strategyId": r.get::<i64, _>("strategy_id"), "versionId": r.get::<i64, _>("version_id"), "trackDeploymentId": r.get::<i64, _>("track_deployment_id"),
        "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "updatedAt": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
    })
}

#[derive(Deserialize)]
pub struct BrowseQ {
    q: Option<String>,
    sort: Option<String>,
    symbol: Option<String>,
    price: Option<String>,
}

pub async fn browse(State(st): State<AppState>, u: User, Query(q): Query<BrowseQ>) -> Res {
    let order = match q.sort.as_deref() {
        Some("rating") => "l.rating_avg DESC, l.rating_count DESC",
        Some("subscribers") => "l.subscribers DESC",
        Some("price") => "l.price_monthly ASC",
        _ => "l.updated_at DESC",
    };
    let sql = format!(
        "SELECT l.* FROM listings l WHERE l.tenant_id = $1 AND l.status = 'approved'
           AND ($2::text IS NULL OR l.title ILIKE '%' || $2 || '%' OR l.description ILIKE '%' || $2 || '%' OR l.author_name ILIKE '%' || $2 || '%')
           AND ($3::text IS NULL OR l.symbol = $3)
           AND ($4::text IS NULL OR ($4 = 'free' AND l.price_monthly = 0) OR ($4 = 'paid' AND l.price_monthly > 0))
         ORDER BY {order} LIMIT 100"
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(&u.tenant)
        .bind(q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(|s| s.chars().take(60).collect::<String>()))
        .bind(q.symbol.as_deref().filter(|s| !s.is_empty()).map(str::to_uppercase))
        .bind(q.price.as_deref().filter(|s| *s == "free" || *s == "paid"))
        .fetch_all(&st.pool)
        .await?;
    let mut items = vec![];
    for r in &rows {
        let mut v = listing_view(r);
        let tr = track_record(&st, r.get("track_deployment_id")).await?;
        v["track"] = json!({"returnPct": tr["returnPct"], "winRate": tr["winRate"], "trades": tr["trades"], "maxDrawdownPct": tr["maxDrawdownPct"], "days": tr["days"], "accountType": tr["accountType"], "curve": tr["curve"].as_array().map(|c| c.iter().map(|p| p["equity"].clone()).collect::<Vec<_>>())});
        items.push(v);
    }
    let subs: Vec<i64> = sqlx::query_scalar("SELECT listing_id FROM subscriptions WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'").bind(&u.tenant).bind(u.id).fetch_all(&st.pool).await?;
    let cut = setting_f64(&settings(&st.pool, &u.tenant).await, "platformCutPct");
    Ok(Json(json!({"items": items, "subscribed": subs, "platformCutPct": cut})))
}

pub async fn listing(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    let r = sqlx::query("SELECT * FROM listings WHERE id = $1 AND tenant_id = $2").bind(id).bind(&u.tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Listing"))?;
    let author = r.get::<i64, _>("author_user_id") == u.id;
    if r.get::<String, _>("status") != "approved" && !author {
        return Err(ApiError::not_found("Listing"));
    }
    let mut v = listing_view(&r);
    v["track"] = track_record(&st, r.get("track_deployment_id")).await?;
    let ver = load_version(&st.pool, &u.tenant, r.get("version_id")).await?;
    if let Some(ver) = ver
        && let Ok(p) = ver.program(&st.specs)
    {
        let sp = &p.spec;
        // subscribers see the rules only when they may clone; everyone sees risk settings
        v["risk"] = json!({"sizing": sp.sizing, "maxLots": sp.max_lots, "sl": sp.sl, "tp": sp.tp, "trailing": sp.trailing, "sessions": sp.sessions, "days": sp.days, "maxTradesPerDay": sp.max_trades_per_day, "maxDailyLoss": sp.max_daily_loss, "oneAtATime": sp.one_at_a_time});
        v["kind"] = json!(ver.kind);
        if author || r.get::<bool, _>("allow_clone") {
            v["summary"] = crate::strategy::summary(&p);
        }
    }
    let reviews = sqlx::query("SELECT id, user_name, rating, comment, created_at, user_id FROM reviews WHERE listing_id = $1 AND status = 'visible' ORDER BY id DESC LIMIT 50").bind(id).fetch_all(&st.pool).await?;
    v["reviews"] = json!(reviews.iter().map(|x| json!({"id": x.get::<i64, _>("id"), "user": x.get::<String, _>("user_name"), "rating": x.get::<i32, _>("rating"), "comment": x.get::<String, _>("comment"), "createdAt": x.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "mine": x.get::<i64, _>("user_id") == u.id})).collect::<Vec<_>>());
    let sub = sqlx::query("SELECT id, mode, status, login, deployment_id, cloned_strategy_id, period_end, auto_renew FROM subscriptions WHERE listing_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT 1").bind(id).bind(u.id).fetch_optional(&st.pool).await?;
    v["subscription"] = sub.map(|x| json!({"id": x.get::<i64, _>("id"), "mode": x.get::<String, _>("mode"), "status": x.get::<String, _>("status"), "login": x.get::<Option<i64>, _>("login"), "deploymentId": x.get::<Option<i64>, _>("deployment_id"), "clonedStrategyId": x.get::<Option<i64>, _>("cloned_strategy_id"), "periodEnd": x.get::<Option<chrono::DateTime<chrono::Utc>>, _>("period_end"), "autoRenew": x.get::<bool, _>("auto_renew")})).unwrap_or(Value::Null);
    v["isAuthor"] = json!(author);
    v["platformCutPct"] = json!(setting_f64(&settings(&st.pool, &u.tenant).await, "platformCutPct"));
    Ok(Json(v))
}

fn price(v: &Value) -> Result<Decimal, ApiError> {
    let p = f(v, "priceMonthly").unwrap_or(0.0);
    if !(0.0..=10_000.0).contains(&p) {
        return Err(ApiError::validation("priceMonthly", "Price must be between 0 (free) and 10,000 USDT a month."));
    }
    Ok(Decimal::from_f64(p).unwrap_or_default().round_dp(2))
}

pub async fn publish(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    let sid = i(&v, "strategyId").ok_or_else(|| ApiError::validation("strategyId", "Choose a strategy."))?;
    let ver = own_version(&st.pool, &u.tenant, u.id, sid, i(&v, "versionId")).await?.ok_or_else(|| ApiError::not_found("Strategy"))?;
    if !ver.valid {
        return Err(ApiError::unprocessable("invalid_strategy", "Only a valid strategy version can be published."));
    }
    let dep = i(&v, "deploymentId").ok_or_else(|| ApiError::validation("deploymentId", "Choose the deployment whose results verify this strategy."))?;
    let d = sqlx::query("SELECT strategy_id, user_id, subscription_id FROM deployments WHERE id = $1 AND tenant_id = $2").bind(dep).bind(&u.tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Deployment"))?;
    if d.get::<i64, _>("user_id") != u.id || d.get::<i64, _>("strategy_id") != sid || d.get::<Option<i64>, _>("subscription_id").is_some() {
        return Err(ApiError::validation("deploymentId", "The track record must come from your own deployment of this strategy."));
    }
    let tr = track_record(&st, dep).await?;
    let min = settings(&st.pool, &u.tenant).await.get("minTrackTrades").and_then(Value::as_i64).unwrap_or(1);
    if tr["trades"].as_i64().unwrap_or(0) < min {
        return Err(ApiError::unprocessable("track_record", format!("The deployment needs at least {min} closed trade(s) before the strategy can be published.")));
    }
    let exists: i64 = sqlx::query_scalar("SELECT count(*) FROM listings WHERE strategy_id = $1 AND status IN ('pending','approved')").bind(sid).fetch_one(&st.pool).await?;
    if exists > 0 {
        return Err(ApiError::conflict("exists", "This strategy already has a listing. Edit it instead."));
    }
    let title = s(&v, "title").unwrap_or(&ver.name).chars().take(80).collect::<String>();
    let desc = s(&v, "description").unwrap_or("").chars().take(4000).collect::<String>();
    if desc.chars().count() < 20 {
        return Err(ApiError::validation("description", "Describe the strategy in at least 20 characters (idea, markets, risk)."));
    }
    let p = ver.program(&st.specs).map_err(|m| ApiError::unprocessable("invalid_strategy", m))?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO listings (tenant_id, author_user_id, author_name, strategy_id, version_id, track_deployment_id, title, description, symbol, timeframe, price_monthly, allow_clone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
    )
    .bind(&u.tenant)
    .bind(u.id)
    .bind(&u.name)
    .bind(sid)
    .bind(ver.id)
    .bind(dep)
    .bind(&title)
    .bind(&desc)
    .bind(&p.spec.symbol)
    .bind(&p.spec.timeframe)
    .bind(price(&v)?)
    .bind(b(&v, "allowClone").unwrap_or(false))
    .fetch_one(&st.pool)
    .await?;
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "listing.publish", &format!("listing:{id}"), json!({"strategy": sid, "version": ver.id})).await;
    Ok(Json(json!({"id": id, "status": "pending", "message": "Submitted for review. It appears in the marketplace once approved."})))
}

pub async fn edit(State(st): State<AppState>, u: User, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    let r = sqlx::query("SELECT author_user_id, status FROM listings WHERE id = $1 AND tenant_id = $2").bind(id).bind(&u.tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Listing"))?;
    if r.get::<i64, _>("author_user_id") != u.id {
        return Err(ApiError::not_found("Listing"));
    }
    if let Some(t) = s(&v, "title") {
        sqlx::query("UPDATE listings SET title = $2, updated_at = now() WHERE id = $1").bind(id).bind(t.chars().take(80).collect::<String>()).execute(&st.pool).await?;
    }
    if let Some(d) = s(&v, "description") {
        sqlx::query("UPDATE listings SET description = $2, updated_at = now() WHERE id = $1").bind(id).bind(d.chars().take(4000).collect::<String>()).execute(&st.pool).await?;
    }
    if v.get("priceMonthly").is_some() {
        // a new price applies to new subscriptions and renewals
        sqlx::query("UPDATE listings SET price_monthly = $2, updated_at = now() WHERE id = $1").bind(id).bind(price(&v)?).execute(&st.pool).await?;
    }
    if let Some(c) = b(&v, "allowClone") {
        sqlx::query("UPDATE listings SET allow_clone = $2, updated_at = now() WHERE id = $1").bind(id).bind(c).execute(&st.pool).await?;
    }
    match s(&v, "status") {
        Some("unlisted") => {
            sqlx::query("UPDATE listings SET status = 'unlisted', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        }
        Some("pending") if r.get::<String, _>("status") == "unlisted" => {
            sqlx::query("UPDATE listings SET status = 'pending', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        }
        Some(_) => return Err(ApiError::validation("status", "Authors can unlist a listing or resubmit it for review.")),
        None => {}
    }
    Ok(Json(json!({"status": "ok"})))
}

/// Charges one period: subscriber debit, author credit (price − platform cut). Idempotent per period.
pub async fn charge(st: &AppState, tenant: &str, sub: i64, subscriber: i64, author: i64, amount: Decimal, period_start: chrono::DateTime<chrono::Utc>, title: &str) -> Result<(), ApiError> {
    let cut = Decimal::from_f64(setting_f64(&settings(&st.pool, tenant).await, "platformCutPct").clamp(0.0, 100.0)).unwrap_or_default();
    let fee = (amount * cut / Decimal::from(100)).round_dp(2);
    let author_amount = amount - fee;
    let period = period_start.format("%Y%m%d").to_string();
    let period_end = period_start + chrono::Duration::days(30);
    let fail = |code: &'static str, msg: String| ApiError::unprocessable(code, msg);
    if st.wallet.token.is_empty() && !st.cfg.dev_mode {
        return Err(ApiError::unavailable("Payments are not configured (wallet service)."));
    }
    let debit = st
        .wallet
        .transfer(tenant, &format!("algo:sub:{sub}:{period}:debit"), subscriber, &amount.to_string(), "debit", "adjustment", &format!("algo-sub-{sub}"), &format!("Strategy subscription: {title}"))
        .await
        .map_err(|_| ApiError::unavailable("The wallet service is unavailable. Try again shortly."))?;
    if let Err((status, code, msg)) = debit {
        let _ = sqlx::query("INSERT INTO subscription_payments (tenant_id, subscription_id, amount, platform_fee, author_amount, cut_pct, period_start, period_end, status, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'failed',$9)")
            .bind(tenant)
            .bind(sub)
            .bind(amount)
            .bind(fee)
            .bind(author_amount)
            .bind(cut)
            .bind(period_start)
            .bind(period_end)
            .bind(format!("{code}: {msg}"))
            .execute(&st.pool)
            .await;
        return Err(if code == "insufficient_funds" { fail("insufficient_funds", format!("Your wallet balance is below {amount} USDT. Deposit USDT to subscribe.")) } else { ApiError::coded(axum::http::StatusCode::from_u16(status).unwrap_or(axum::http::StatusCode::BAD_GATEWAY), "wallet_error", msg) });
    }
    if author_amount > Decimal::ZERO {
        // a failed author credit is logged (same idempotency key if it is re-sent); see README known gaps
        let credit = st
            .wallet
            .transfer(tenant, &format!("algo:sub:{sub}:{period}:credit"), author, &author_amount.to_string(), "credit", "adjustment", &format!("algo-sub-{sub}"), &format!("Strategy subscription revenue: {title} (platform fee {fee})"))
            .await;
        if !matches!(credit, Ok(Ok(_))) {
            tracing::warn!(sub, "author credit failed; will be retried");
        }
    }
    sqlx::query("INSERT INTO subscription_payments (tenant_id, subscription_id, amount, platform_fee, author_amount, cut_pct, period_start, period_end, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed')")
        .bind(tenant)
        .bind(sub)
        .bind(amount)
        .bind(fee)
        .bind(author_amount)
        .bind(cut)
        .bind(period_start)
        .bind(period_end)
        .execute(&st.pool)
        .await?;
    Ok(())
}

pub async fn subscribe(State(st): State<AppState>, u: User, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    let l = sqlx::query("SELECT * FROM listings WHERE id = $1 AND tenant_id = $2 AND status = 'approved'").bind(id).bind(&u.tenant).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Listing"))?;
    let author: i64 = l.get("author_user_id");
    if author == u.id {
        return Err(ApiError::conflict("own_listing", "You can't subscribe to your own strategy."));
    }
    let active: i64 = sqlx::query_scalar("SELECT count(*) FROM subscriptions WHERE listing_id = $1 AND user_id = $2 AND status = 'active'").bind(id).bind(u.id).fetch_one(&st.pool).await?;
    if active > 0 {
        return Err(ApiError::conflict("subscribed", "You already subscribe to this strategy."));
    }
    let mode = s(&v, "mode").unwrap_or("copy");
    if mode != "copy" && mode != "clone" {
        return Err(ApiError::validation("mode", "mode must be copy or clone"));
    }
    if mode == "clone" && !l.get::<bool, _>("allow_clone") {
        return Err(ApiError::unprocessable("clone_not_allowed", "The author doesn't allow cloning this strategy; copy it to your account instead."));
    }
    let login = if mode == "copy" { Some(i(&v, "login").ok_or_else(|| ApiError::validation("login", "Choose the account the strategy runs on."))?) } else { None };
    if let Some(login) = login {
        st.engine.account(&u.tenant, u.id, login).await.map_err(|_| ApiError::unavailable("Trading service is unavailable."))?.ok_or_else(|| ApiError::not_found("Trading account"))?;
    }
    let amount: Decimal = l.get("price_monthly");
    let title: String = l.get("title");
    let now = chrono::Utc::now();
    let sub: i64 = sqlx::query_scalar("INSERT INTO subscriptions (tenant_id, listing_id, user_id, mode, login, price, period_start, period_end, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'past_due') RETURNING id")
        .bind(&u.tenant)
        .bind(id)
        .bind(u.id)
        .bind(mode)
        .bind(login)
        .bind(amount)
        .bind(now)
        .bind(if amount > Decimal::ZERO { Some(now + chrono::Duration::days(30)) } else { None })
        .fetch_one(&st.pool)
        .await?;
    if amount > Decimal::ZERO
        && let Err(e) = charge(&st, &u.tenant, sub, u.id, author, amount, now, &title).await
    {
        sqlx::query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = now(), auto_renew = FALSE WHERE id = $1").bind(sub).execute(&st.pool).await?;
        return Err(e);
    }
    let vid: i64 = l.get("version_id");
    let (mut dep, mut cloned) = (None, None);
    let result: Result<(), ApiError> = async {
        if let Some(login) = login {
            dep = Some(crate::api::deployments::start(&st, &u, vid, login, crate::api::deployments::clean_risk(&v), Some(sub)).await?);
        } else {
            let ver = load_version(&st.pool, &u.tenant, vid).await?.ok_or_else(|| ApiError::not_found("Strategy version"))?;
            let sym = ver.spec.get("symbol").and_then(Value::as_str).unwrap_or("EURUSD").to_string();
            let tf = ver.spec.get("timeframe").and_then(Value::as_str).unwrap_or("H1").to_string();
            let bl = build(&ver.kind, Some(&ver.spec), ver.source.as_deref(), &sym, &tf, &st.specs).map_err(|m| ApiError::unprocessable("invalid_strategy", m))?;
            cloned = Some(insert(&st.pool, &u.tenant, u.id, &format!("{title} (marketplace)"), "marketplace", Some(id), &bl, Some(&format!("Cloned from marketplace listing #{id}")), None).await?.0);
        }
        Ok(())
    }
    .await;
    if let Err(e) = result {
        // refund a paid first period when the copy could not start
        if amount > Decimal::ZERO {
            let _ = st.wallet.transfer(&u.tenant, &format!("algo:sub:{sub}:refund"), u.id, &amount.to_string(), "credit", "refund", &format!("algo-sub-{sub}"), &format!("Refund: {title} could not start")).await;
        }
        sqlx::query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = now(), auto_renew = FALSE WHERE id = $1").bind(sub).execute(&st.pool).await?;
        return Err(e);
    }
    sqlx::query("UPDATE subscriptions SET status = 'active', deployment_id = $2, cloned_strategy_id = $3 WHERE id = $1").bind(sub).bind(dep).bind(cloned).execute(&st.pool).await?;
    sqlx::query("UPDATE listings SET subscribers = (SELECT count(*) FROM subscriptions WHERE listing_id = $1 AND status = 'active') WHERE id = $1").bind(id).execute(&st.pool).await?;
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "subscription.create", &format!("subscription:{sub}"), json!({"listing": id, "mode": mode, "amount": amount.to_string()})).await;
    Ok(Json(json!({"id": sub, "status": "active", "mode": mode, "deploymentId": dep, "clonedStrategyId": cloned, "charged": amount.to_f64()})))
}

pub async fn subscriptions(State(st): State<AppState>, u: User) -> Res {
    let rows = sqlx::query(
        "SELECT s.*, l.title, l.author_name, l.symbol, l.timeframe, d.status AS dep_status FROM subscriptions s JOIN listings l ON l.id = s.listing_id LEFT JOIN deployments d ON d.id = s.deployment_id
         WHERE s.tenant_id = $1 AND s.user_id = $2 ORDER BY s.id DESC",
    )
    .bind(&u.tenant)
    .bind(u.id)
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({"items": rows.iter().map(|r| json!({
        "id": r.get::<i64, _>("id"), "listingId": r.get::<i64, _>("listing_id"), "title": r.get::<String, _>("title"), "author": r.get::<String, _>("author_name"),
        "symbol": r.get::<String, _>("symbol"), "timeframe": r.get::<String, _>("timeframe"), "mode": r.get::<String, _>("mode"), "status": r.get::<String, _>("status"),
        "login": r.get::<Option<i64>, _>("login"), "deploymentId": r.get::<Option<i64>, _>("deployment_id"), "deploymentStatus": r.get::<Option<String>, _>("dep_status"),
        "clonedStrategyId": r.get::<Option<i64>, _>("cloned_strategy_id"), "price": r.get::<Decimal, _>("price").to_f64(), "autoRenew": r.get::<bool, _>("auto_renew"),
        "periodEnd": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("period_end"), "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
    })).collect::<Vec<_>>()})))
}

pub async fn cancel(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    let r = sqlx::query("SELECT status, price, deployment_id, listing_id FROM subscriptions WHERE id = $1 AND tenant_id = $2 AND user_id = $3").bind(id).bind(&u.tenant).bind(u.id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Subscription"))?;
    if r.get::<String, _>("status") != "active" {
        return Err(ApiError::conflict("inactive", "This subscription is not active."));
    }
    let paid = r.get::<Decimal, _>("price") > Decimal::ZERO;
    if paid {
        // paid: runs until the end of the period, no renewal
        sqlx::query("UPDATE subscriptions SET auto_renew = FALSE, cancelled_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
    } else {
        sqlx::query("UPDATE subscriptions SET status = 'cancelled', auto_renew = FALSE, cancelled_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        if let Some(d) = r.get::<Option<i64>, _>("deployment_id") {
            crate::api::deployments::stop(&st, d, "stopped", "subscription cancelled", false).await?;
        }
        sqlx::query("UPDATE listings SET subscribers = (SELECT count(*) FROM subscriptions WHERE listing_id = $1 AND status = 'active') WHERE id = $1").bind(r.get::<i64, _>("listing_id")).execute(&st.pool).await?;
    }
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "subscription.cancel", &format!("subscription:{id}"), json!({})).await;
    Ok(Json(json!({"status": if paid { "cancels at period end" } else { "cancelled" }})))
}

pub async fn review(State(st): State<AppState>, u: User, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    let subscribed: i64 = sqlx::query_scalar("SELECT count(*) FROM subscriptions WHERE listing_id = $1 AND user_id = $2 AND status IN ('active','cancelled','expired')").bind(id).bind(u.id).fetch_one(&st.pool).await?;
    if subscribed == 0 {
        return Err(ApiError::Forbidden("Only subscribers can review a strategy.".into()));
    }
    let rating = i(&v, "rating").filter(|r| (1..=5).contains(r)).ok_or_else(|| ApiError::validation("rating", "Rate from 1 to 5."))?;
    let comment = s(&v, "comment").unwrap_or("").chars().take(1000).collect::<String>();
    sqlx::query("INSERT INTO reviews (tenant_id, listing_id, user_id, user_name, rating, comment) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (listing_id, user_id) DO UPDATE SET rating = $5, comment = $6, created_at = now()")
        .bind(&u.tenant)
        .bind(id)
        .bind(u.id)
        .bind(&u.name)
        .bind(rating as i32)
        .bind(&comment)
        .execute(&st.pool)
        .await?;
    sqlx::query("UPDATE listings SET rating_avg = COALESCE((SELECT avg(rating) FROM reviews WHERE listing_id = $1 AND status = 'visible'), 0), rating_count = (SELECT count(*) FROM reviews WHERE listing_id = $1 AND status = 'visible') WHERE id = $1")
        .bind(id)
        .execute(&st.pool)
        .await?;
    Ok(Json(json!({"status": "ok"})))
}

/// The author's listings, subscribers and earnings.
pub async fn mine(State(st): State<AppState>, u: User) -> Res {
    let rows = sqlx::query("SELECT * FROM listings WHERE tenant_id = $1 AND author_user_id = $2 ORDER BY id DESC").bind(&u.tenant).bind(u.id).fetch_all(&st.pool).await?;
    let earn = sqlx::query(
        "SELECT COALESCE(sum(p.author_amount), 0)::float8 AS earned, COALESCE(sum(p.platform_fee), 0)::float8 AS fees, count(*) AS payments FROM subscription_payments p JOIN subscriptions s ON s.id = p.subscription_id JOIN listings l ON l.id = s.listing_id WHERE l.author_user_id = $1 AND l.tenant_id = $2 AND p.status = 'completed'",
    )
    .bind(u.id)
    .bind(&u.tenant)
    .fetch_one(&st.pool)
    .await?;
    Ok(Json(json!({"items": rows.iter().map(listing_view).collect::<Vec<_>>(), "earned": earn.get::<f64, _>("earned"), "platformFees": earn.get::<f64, _>("fees"), "payments": earn.get::<i64, _>("payments")})))
}

/// Renewal loop: charges due paid subscriptions, expires cancelled ones at the period end.
pub fn spawn_renewals(st: AppState) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
            let due = sqlx::query("SELECT s.id, s.tenant_id, s.user_id, s.auto_renew, s.period_end, s.deployment_id, l.price_monthly, l.author_user_id, l.title, l.status AS lstatus, s.listing_id FROM subscriptions s JOIN listings l ON l.id = s.listing_id WHERE s.status = 'active' AND s.period_end IS NOT NULL AND s.period_end <= now()")
                .fetch_all(&st.pool)
                .await
                .unwrap_or_default();
            for r in due {
                let (sub, tenant): (i64, String) = (r.get("id"), r.get("tenant_id"));
                let renew = r.get::<bool, _>("auto_renew") && r.get::<String, _>("lstatus") == "approved";
                let pe: chrono::DateTime<chrono::Utc> = r.get("period_end");
                let ok = renew && charge(&st, &tenant, sub, r.get("user_id"), r.get("author_user_id"), r.get("price_monthly"), pe, &r.get::<String, _>("title")).await.is_ok();
                if ok {
                    let _ = sqlx::query("UPDATE subscriptions SET period_start = $2, period_end = $3, price = $4 WHERE id = $1").bind(sub).bind(pe).bind(pe + chrono::Duration::days(30)).bind(r.get::<Decimal, _>("price_monthly")).execute(&st.pool).await;
                } else {
                    let status = if renew { "past_due" } else { "expired" };
                    let _ = sqlx::query("UPDATE subscriptions SET status = $2 WHERE id = $1").bind(sub).bind(status).execute(&st.pool).await;
                    if let Some(d) = r.get::<Option<i64>, _>("deployment_id") {
                        let _ = crate::api::deployments::stop(&st, d, "stopped", &format!("subscription {status}"), false).await;
                    }
                    let _ = sqlx::query("UPDATE listings SET subscribers = (SELECT count(*) FROM subscriptions WHERE listing_id = $1 AND status = 'active') WHERE id = $1").bind(r.get::<i64, _>("listing_id")).execute(&st.pool).await;
                }
            }
        }
    });
}

//! Strategies and versions, validation, the builder catalogue and the AI assistant.

use axum::Json;
use axum::extract::{Path, State};
use serde_json::{Value, json};
use sqlx::Row;

use super::{Body, Res, s};
use crate::error::ApiError;
use crate::spec::{DISTANCE_MODES, OPERATORS, PATTERNS, PRICE_FIELDS, TRAIL_MODES, ind_defaults};
use crate::specs::TIMEFRAMES;
use crate::state::{AppState, User, audit};
use crate::strategy::{build, insert, insert_version, summary};

const MAX_STRATEGIES: i64 = 100;

/// Catalogue for the builder: symbols, indicators with defaults, operators, DSL reference.
pub async fn meta(State(st): State<AppState>) -> Res {
    let symbols: Vec<Value> = st
        .specs
        .all()
        .map(|s| json!({"symbol": s.symbol, "assetClass": s.asset_class, "digits": s.digits, "point": s.point, "pipSize": s.pip_size, "lotMin": s.lot_min, "lotMax": s.lot_max, "lotStep": s.lot_step, "session": crate::specs::session_key(&s.session), "core": s.core}))
        .collect();
    let labels = [
        ("sma", "SMA", "Simple moving average"),
        ("ema", "EMA", "Exponential moving average"),
        ("wma", "WMA", "Weighted moving average"),
        ("rsi", "RSI", "Relative strength index"),
        ("macd", "MACD line", "MACD (fast EMA − slow EMA)"),
        ("macd_signal", "MACD signal", "Signal line of the MACD"),
        ("macd_hist", "MACD histogram", "MACD − signal"),
        ("bb_upper", "Bollinger upper", "Upper Bollinger band"),
        ("bb_middle", "Bollinger middle", "Bollinger basis (SMA)"),
        ("bb_lower", "Bollinger lower", "Lower Bollinger band"),
        ("atr", "ATR", "Average true range (Wilder)"),
        ("stoch_k", "Stochastic %K", "Stochastic oscillator %K"),
        ("stoch_d", "Stochastic %D", "Stochastic oscillator %D"),
        ("highest", "Highest high", "Highest high of the N bars before this one"),
        ("lowest", "Lowest low", "Lowest low of the N bars before this one"),
        ("cci", "CCI", "Commodity channel index (typical price)"),
        ("willr", "Williams %R", "Williams percent range"),
        ("adx", "ADX", "Average directional index"),
        ("plus_di", "+DI", "Positive directional indicator"),
        ("minus_di", "−DI", "Negative directional indicator"),
        ("momentum", "Momentum", "Price / price N bars ago × 100"),
        ("roc", "ROC", "Rate of change %"),
        ("stddev", "Std deviation", "Standard deviation of price"),
    ];
    let indicators: Vec<Value> = labels
        .iter()
        .map(|(k, l, d)| {
            let (p, p2, p3, m) = ind_defaults(k).unwrap_or((14, 0, 0, 0.0));
            let price_scale = ["sma", "ema", "wma", "bb_upper", "bb_middle", "bb_lower", "highest", "lowest"].contains(k);
            json!({"key": k, "label": l, "description": d, "period": p, "period2": p2, "period3": p3, "mult": m, "priceScale": price_scale})
        })
        .collect();
    let functions = [
        ("sma(src, n) · ema · wma · rma", "moving averages of any series"),
        ("rsi(src, n) · cci(n) · willr(n) · momentum(src, n) · roc(src, n)", "oscillators"),
        ("macd(src, fast, slow, signal) · macd_signal(…) · macd_hist(…)", "MACD"),
        ("bb_upper(src, n, dev) · bb_middle · bb_lower · stddev(src, n)", "Bollinger bands"),
        ("atr(n) · adx(n) · plus_di(n) · minus_di(n) · stoch_k(n, d) · stoch_d(n, d)", "bar-based indicators"),
        ("highest(n) · lowest(n) · highest(src, n)", "extremes of the N previous bars"),
        ("crosses_above(a, b) · crosses_below(a, b) · crosses(a, b)", "crossings on this bar"),
        ("change(src, n) · abs · min · max · sqrt · round(x, d) · nz(x, default)", "maths"),
        ("htf(\"H4\", expr)", "evaluate on a higher timeframe (last closed bar)"),
        ("bullish() · bearish() · bullish_engulfing() · bearish_engulfing() · hammer() · shooting_star() · doji() · inside_bar()", "candle patterns (1 / 0)"),
        ("open high low close volume hl2 hlc3 ohlc4 · hour minute weekday", "bar fields (server time)"),
        ("x[1]", "value 1 bar ago (up to 1000)"),
        ("a if cond else b · and · or · not · < > <= >= == !=", "logic"),
    ];
    let settings = [
        ("name(\"…\") · symbol(\"EURUSD\") · timeframe(\"H1\")", "identity"),
        ("lots(0.1) · risk(1.0) · max_lots(1)", "sizing (risk = % of balance, needs a stop loss)"),
        ("stop_loss(pips=20 | points= | price= | percent= | atr=2, period=14 | level=)", "stop loss"),
        ("take_profit(… | rr=2)", "take profit (rr = multiple of the stop)"),
        ("trailing(pips=15 | points= | atr=1.5, period=14) · breakeven(trigger=150, offset=10)", "stop management (points)"),
        ("session(\"08:00\", \"17:00\") · days(1, 2, 3, 4, 5) · close_outside_session(true)", "trading window (server time)"),
        ("max_trades_per_day(3) · max_daily_loss(200) · one_at_a_time(true)", "limits"),
    ];
    Ok(Json(json!({
        "symbols": symbols,
        "timeframes": TIMEFRAMES,
        "indicators": indicators,
        "priceFields": PRICE_FIELDS,
        "patterns": &PATTERNS[1..],
        "operators": OPERATORS,
        "distanceModes": DISTANCE_MODES,
        "trailModes": TRAIL_MODES,
        "dsl": {
            "signals": ["buy", "sell", "exit_buy", "exit_sell"],
            "functions": functions.iter().map(|(a, b)| json!({"syntax": a, "text": b})).collect::<Vec<_>>(),
            "settings": settings.iter().map(|(a, b)| json!({"syntax": a, "text": b})).collect::<Vec<_>>(),
            "limits": {"sourceChars": crate::dsl::parse::MAX_SOURCE, "statements": crate::dsl::parse::MAX_STATEMENTS, "depth": crate::dsl::parse::MAX_DEPTH, "nodes": crate::dsl::MAX_NODES, "period": crate::dsl::MAX_PERIOD},
            "example": EXAMPLE_DSL,
        },
        "ai": {"configured": !st.cfg.anthropic_key.is_empty(), "model": st.cfg.ai_model},
        "publicUrl": st.cfg.public_url,
    })))
}

pub const EXAMPLE_DSL: &str = r#"# EMA trend with an H4 filter
name("EMA trend H1")
symbol("EURUSD")
timeframe("H1")
lots(0.10)
stop_loss(atr=2, period=14)
take_profit(rr=2)
breakeven(trigger=150, offset=10)
max_trades_per_day(3)

fast = ema(close, 20)
slow = ema(close, 50)
trend_up = htf("H4", close > ema(close, 50))

buy = crosses_above(fast, slow) and rsi(close, 14) < 70 and trend_up
sell = crosses_below(fast, slow) and rsi(close, 14) > 30 and not trend_up
exit_buy = close < slow
exit_sell = close > slow
"#;

fn payload(st: &AppState, v: &Value) -> Result<crate::strategy::Built, ApiError> {
    let kind = s(v, "kind").unwrap_or("visual");
    let symbol = s(v, "symbol").or_else(|| v.pointer("/spec/symbol").and_then(Value::as_str)).unwrap_or("EURUSD").to_uppercase();
    let tf = s(v, "timeframe").or_else(|| v.pointer("/spec/timeframe").and_then(Value::as_str)).unwrap_or("H1").to_string();
    let mut b = build(kind, v.get("spec"), v.get("source").and_then(Value::as_str), &symbol, &tf, &st.specs).map_err(|m| ApiError::validation("kind", m))?;
    // the strategy's name is the default name of its spec (a code name("…") or a spec name wins)
    let named = if kind == "code" { v.get("source").and_then(Value::as_str).is_some_and(|src| src.contains("name(")) } else { v.pointer("/spec/name").and_then(Value::as_str).is_some_and(|n| !n.trim().is_empty()) };
    if !named && let Some(n) = s(v, "name") {
        let n: String = n.chars().take(48).collect();
        b.spec.name = n.clone();
        b.program.spec.name = n;
    }
    Ok(b)
}

/// The strategy's display name: a code program's own name("…") wins over the editor's name field.
fn display_name(v: &Value, b: &crate::strategy::Built) -> Option<String> {
    if b.kind == "code" && b.source.as_deref().is_some_and(|src| src.contains("name(")) {
        return Some(b.spec.name.clone());
    }
    s(v, "name").map(|n| n.chars().take(60).collect::<String>())
}

pub async fn validate(State(st): State<AppState>, _u: User, Body(v): Body<Value>) -> Res {
    Ok(Json(payload(&st, &v)?.view()))
}

pub async fn ai(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    Ok(Json(crate::ai::generate(&st, &u, &v).await?))
}

pub async fn list(State(st): State<AppState>, u: User) -> Res {
    let rows = sqlx::query(
        "SELECT s.id, s.name, s.symbol, s.timeframe, s.kind, s.origin, s.status, s.latest_version, s.created_at, s.updated_at, v.id AS version_id, v.valid, v.spec, v.source,
                (SELECT count(*) FROM deployments d WHERE d.strategy_id = s.id AND d.user_id = s.user_id AND d.status IN ('running','paused')) AS running,
                (SELECT b.summary FROM backtests b WHERE b.strategy_id = s.id AND b.status = 'done' ORDER BY b.id DESC LIMIT 1) AS last_backtest,
                (SELECT count(*) FROM listings l WHERE l.strategy_id = s.id AND l.status IN ('pending','approved')) AS listed
         FROM strategies s JOIN strategy_versions v ON v.strategy_id = s.id AND v.version = s.latest_version
         WHERE s.tenant_id = $1 AND s.user_id = $2 AND s.status = 'active' ORDER BY s.updated_at DESC LIMIT 200",
    )
    .bind(&u.tenant)
    .bind(u.id)
    .fetch_all(&st.pool)
    .await?;
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            let spec: Value = r.get("spec");
            let kind: String = r.get("kind");
            let prog = crate::strategy::build(&kind, Some(&spec), r.get::<Option<String>, _>("source").as_deref(), r.get::<String, _>("symbol").as_str(), r.get::<String, _>("timeframe").as_str(), &st.specs).ok();
            json!({
                "id": r.get::<i64, _>("id"), "name": r.get::<String, _>("name"), "symbol": r.get::<String, _>("symbol"), "timeframe": r.get::<String, _>("timeframe"),
                "kind": kind, "origin": r.get::<String, _>("origin"), "version": r.get::<i32, _>("latest_version"), "versionId": r.get::<i64, _>("version_id"),
                "valid": r.get::<bool, _>("valid"), "running": r.get::<i64, _>("running"), "listed": r.get::<i64, _>("listed") > 0,
                "lastBacktest": r.get::<Option<Value>, _>("last_backtest"),
                "summary": prog.map(|p| summary(&p.program)).unwrap_or(Value::Null),
                "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "updatedAt": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            })
        })
        .collect();
    Ok(Json(json!({"items": items})))
}

pub async fn create(State(st): State<AppState>, u: User, Body(v): Body<Value>) -> Res {
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM strategies WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'").bind(&u.tenant).bind(u.id).fetch_one(&st.pool).await?;
    if count >= MAX_STRATEGIES {
        return Err(ApiError::conflict("limit", format!("You can keep up to {MAX_STRATEGIES} strategies. Archive one first.")));
    }
    let b = payload(&st, &v)?;
    let name = display_name(&v, &b).unwrap_or_else(|| b.spec.name.clone());
    let origin = match s(&v, "origin") {
        Some("ai") => "ai",
        Some("template") => "template",
        _ => "manual",
    };
    let (sid, vid) = insert(&st.pool, &u.tenant, u.id, &name, origin, None, &b, s(&v, "note"), s(&v, "prompt")).await?;
    audit(&st.pool, &u.tenant, &format!("user:{}", u.id), "strategy.create", &format!("strategy:{sid}"), json!({"kind": b.kind, "valid": b.valid()})).await;
    let mut out = b.view();
    out["id"] = json!(sid);
    out["versionId"] = json!(vid);
    out["version"] = json!(1);
    out["name"] = json!(name);
    Ok(Json(out))
}

async fn owned(st: &AppState, u: &User, id: i64) -> Result<sqlx::postgres::PgRow, ApiError> {
    sqlx::query("SELECT * FROM strategies WHERE id = $1 AND tenant_id = $2 AND user_id = $3").bind(id).bind(&u.tenant).bind(u.id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Strategy"))
}

fn version_view(st: &AppState, r: &sqlx::postgres::PgRow) -> Value {
    let spec: Value = r.get("spec");
    let kind: String = r.get("kind");
    let source: Option<String> = r.get("source");
    let built = build(&kind, Some(&spec), source.as_deref(), spec.get("symbol").and_then(Value::as_str).unwrap_or("EURUSD"), spec.get("timeframe").and_then(Value::as_str).unwrap_or("H1"), &st.specs).ok();
    let mut v = built.map(|b| b.view()).unwrap_or_else(|| json!({"spec": spec, "source": source, "kind": kind}));
    v["id"] = json!(r.get::<i64, _>("id"));
    v["version"] = json!(r.get::<i32, _>("version"));
    v["note"] = json!(r.get::<Option<String>, _>("note"));
    v["prompt"] = json!(r.get::<Option<String>, _>("prompt"));
    v["createdAt"] = json!(r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"));
    v
}

pub async fn detail(State(st): State<AppState>, u: User, Path(id): Path<i64>) -> Res {
    let s = owned(&st, &u, id).await?;
    let versions = sqlx::query("SELECT id, version, kind, valid, note, created_at FROM strategy_versions WHERE strategy_id = $1 ORDER BY version DESC LIMIT 100").bind(id).fetch_all(&st.pool).await?;
    let latest = sqlx::query("SELECT * FROM strategy_versions WHERE strategy_id = $1 AND version = $2").bind(id).bind(s.get::<i32, _>("latest_version")).fetch_one(&st.pool).await?;
    let deployments = crate::api::deployments::rows_for(&st, &u.tenant, "d.user_id = $2 AND d.strategy_id = $3", u.id, Some(id)).await?;
    let backtests = sqlx::query("SELECT id, version_id, params, status, progress, summary, error, created_at, finished_at FROM backtests WHERE strategy_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT 20")
        .bind(id)
        .bind(u.id)
        .fetch_all(&st.pool)
        .await?;
    Ok(Json(json!({
        "id": id, "name": s.get::<String, _>("name"), "symbol": s.get::<String, _>("symbol"), "timeframe": s.get::<String, _>("timeframe"), "kind": s.get::<String, _>("kind"),
        "origin": s.get::<String, _>("origin"), "status": s.get::<String, _>("status"), "latestVersion": s.get::<i32, _>("latest_version"),
        "createdAt": s.get::<chrono::DateTime<chrono::Utc>, _>("created_at"), "updatedAt": s.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
        "current": version_view(&st, &latest),
        "versions": versions.iter().map(|r| json!({"id": r.get::<i64, _>("id"), "version": r.get::<i32, _>("version"), "kind": r.get::<String, _>("kind"), "valid": r.get::<bool, _>("valid"), "note": r.get::<Option<String>, _>("note"), "createdAt": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at")})).collect::<Vec<_>>(),
        "deployments": deployments,
        "backtests": backtests.iter().map(crate::api::backtests::row_view).collect::<Vec<_>>(),
    })))
}

pub async fn version(State(st): State<AppState>, u: User, Path((id, vid)): Path<(i64, i64)>) -> Res {
    owned(&st, &u, id).await?;
    let r = sqlx::query("SELECT * FROM strategy_versions WHERE id = $1 AND strategy_id = $2").bind(vid).bind(id).fetch_optional(&st.pool).await?.ok_or_else(|| ApiError::not_found("Version"))?;
    Ok(Json(version_view(&st, &r)))
}

pub async fn new_version(State(st): State<AppState>, u: User, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    let s0 = owned(&st, &u, id).await?;
    if s0.get::<String, _>("status") != "active" {
        return Err(ApiError::conflict("archived", "This strategy is archived."));
    }
    let b = payload(&st, &v)?;
    let mut tx = st.pool.begin().await?;
    let next: i32 = sqlx::query_scalar("UPDATE strategies SET latest_version = latest_version + 1, updated_at = now(), symbol = $2, timeframe = $3, kind = $4, name = COALESCE($5, name) WHERE id = $1 RETURNING latest_version")
        .bind(id)
        .bind(&b.spec.symbol)
        .bind(&b.spec.timeframe)
        .bind(b.kind)
        .bind(display_name(&v, &b))
        .fetch_one(&mut *tx)
        .await?;
    if next > 500 {
        return Err(ApiError::conflict("limit", "This strategy has too many versions. Create a new strategy."));
    }
    let vid = insert_version(&mut tx, &u.tenant, id, next, &b, s(&v, "note"), s(&v, "prompt")).await?;
    tx.commit().await?;
    let mut out = b.view();
    out["id"] = json!(id);
    out["versionId"] = json!(vid);
    out["version"] = json!(next);
    Ok(Json(out))
}

pub async fn update(State(st): State<AppState>, u: User, Path(id): Path<i64>, Body(v): Body<Value>) -> Res {
    owned(&st, &u, id).await?;
    if let Some(name) = s(&v, "name") {
        sqlx::query("UPDATE strategies SET name = $2, updated_at = now() WHERE id = $1").bind(id).bind(name.chars().take(60).collect::<String>()).execute(&st.pool).await?;
    }
    match s(&v, "status") {
        Some("archived") => {
            let running: i64 = sqlx::query_scalar("SELECT count(*) FROM deployments WHERE strategy_id = $1 AND user_id = $2 AND status IN ('running','paused')").bind(id).bind(u.id).fetch_one(&st.pool).await?;
            if running > 0 {
                return Err(ApiError::conflict("running", "Stop the strategy's deployments before archiving it."));
            }
            sqlx::query("UPDATE strategies SET status = 'archived', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        }
        Some("active") => {
            sqlx::query("UPDATE strategies SET status = 'active', updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
        }
        Some(_) => return Err(ApiError::validation("status", "status must be active or archived")),
        None => {}
    }
    Ok(Json(json!({"status": "ok"})))
}

//! House accounts (README "House accounts"): platform-owned accounts that populate copy trading and the
//! strategy marketplace at launch. Each one is real end to end:
//!
//! 1. a gateway **house user** (`is_house`, no login) owns
//! 2. a **live trading account** in a normal live group, funded with ledger kind `house_capital` (never a
//!    client deposit), registered as an **approved house master** (`is_house`, "House strategy" label);
//! 3. one of the **presets** below is stored as that user's strategy and **backtested** (the report is only
//!    ever shown labelled as a backtest);
//! 4. the strategy is **deployed** on the account through the normal runtime (same order path, same checks
//!    as any client's deployment), and
//! 5. published as a free **marketplace listing** flagged `is_house`, whose track record is the deployment's
//!    closed deals only.
//!
//! Nothing here writes trades, equity, followers or history: the leaderboard, the profile and the listing
//! show only what the account actually does from the moment it is provisioned.
//!
//! Switches: a per-account `enabled` switch and `visible` flag plus a tenant master switch. Effective state:
//! `on = master && enabled`. Off = the deployment is paused (no new entries; open positions keep their
//! SL/TP, or are closed on request), the master is hidden from the leaderboard and the listing is unlisted.
//! On = the deployment runs, and the master / listing are shown when `visible`.

use serde_json::{Value, json};
use sqlx::Row as _;

use crate::api::deployments;
use crate::error::ApiError;
use crate::runtime;
use crate::state::{AppState, Staff, User, audit};
use crate::strategy::{build, insert};

/// Daily loss limit of every preset, as a % of the starting capital (written into the strategy as
/// `max_daily_loss(<amount>)`, in the account currency).
pub const DAILY_LOSS_PCT: f64 = 2.0;
pub const DEFAULT_CAPITAL: f64 = 10_000.0;
/// House account group: a normal live hedging group (the engine refuses copy / PAMM / prop / cent groups).
pub const GROUP: &str = "standard";

pub struct Preset {
    pub key: &'static str,
    pub nickname: &'static str,
    /// Short strategy label shown on the master card.
    pub strategy: &'static str,
    pub symbol: &'static str,
    pub timeframe: &'static str,
    pub description: &'static str,
    /// DSL source; `{DAILY_LOSS}` is replaced by DAILY_LOSS_PCT of the capital.
    pub source: &'static str,
    /// Backtest range in days (capped by the backtester's per-timeframe limit and the history available).
    pub backtest_days: i64,
}

pub const PRESETS: &[Preset] = &[
    Preset {
        key: "gold-ema-trend",
        nickname: "Gold Trend H1",
        strategy: "EMA trend · XAUUSD H1",
        symbol: "XAUUSD",
        timeframe: "H1",
        description: "Trend following on gold. Enters when the 21 EMA crosses the 55 EMA while ADX(14) is above 20, exits on the opposite cross. Stop 2 × ATR(14), target 2R, 0.5% of balance risked per trade, one position at a time, at most 2 entries and a 2% loss per day.",
        source: r#"name("Gold EMA Trend H1")
symbol("XAUUSD")
timeframe("H1")
risk(0.5)
max_lots(5)
stop_loss(atr=2, period=14)
take_profit(rr=2)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

fast = ema(close, 21)
slow = ema(close, 55)
trending = adx(14) > 20
buy = crosses_above(fast, slow) and trending
sell = crosses_below(fast, slow) and trending
exit_buy = crosses_below(fast, slow)
exit_sell = crosses_above(fast, slow)
"#,
        backtest_days: 365,
    },
    Preset {
        key: "eurusd-rsi-reversion",
        nickname: "EURUSD Reversion M15",
        strategy: "RSI mean reversion · EURUSD M15",
        symbol: "EURUSD",
        timeframe: "M15",
        description: "Mean reversion with the trend. Buys when RSI(14) climbs back above 30 while price is above the 200 EMA, sells when RSI falls back below 70 under the 200 EMA; exits when RSI returns to the middle. Stop 1.5 × ATR(14), target 1.5R, 0.4% risk per trade, weekdays 09:00–21:00 server time, 2% daily loss limit.",
        source: r#"name("EURUSD RSI Reversion M15")
symbol("EURUSD")
timeframe("M15")
risk(0.4)
max_lots(5)
stop_loss(atr=1.5, period=14)
take_profit(rr=1.5)
session("09:00", "21:00")
days(1, 2, 3, 4, 5)
max_trades_per_day(4)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

r = rsi(close, 14)
trend = ema(close, 200)
buy = crosses_above(r, 30) and close > trend
sell = crosses_below(r, 70) and close < trend
exit_buy = r > 55
exit_sell = r < 45
"#,
        backtest_days: 180,
    },
    Preset {
        key: "btc-donchian-breakout",
        nickname: "BTC Breakout H4",
        strategy: "Donchian breakout · BTCUSD H4",
        symbol: "BTCUSD",
        timeframe: "H4",
        description: "Classic 20-bar Donchian channel breakout on Bitcoin. Buys a close above the 20-bar high, sells a close below the 20-bar low, exits on the opposite 10-bar extreme. Stop 2.5 × ATR(14) with a 3 × ATR trailing stop, 0.5% risk per trade, 2% daily loss limit.",
        source: r#"name("BTC Donchian Breakout H4")
symbol("BTCUSD")
timeframe("H4")
risk(0.5)
max_lots(2)
stop_loss(atr=2.5, period=14)
trailing(atr=3, period=14)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

buy = close > highest(20)
sell = close < lowest(20)
exit_buy = close < lowest(10)
exit_sell = close > highest(10)
"#,
        backtest_days: 730,
    },
    Preset {
        key: "nas100-macd-momentum",
        nickname: "NAS100 Momentum H1",
        strategy: "MACD momentum · NAS100 H1",
        symbol: "NAS100",
        timeframe: "H1",
        description: "Momentum on the Nasdaq 100 during the US session. Enters on a MACD(12,26,9) signal-line cross on the same side of zero as the MACD and of the 100 EMA; exits on the opposite cross. Stop 2 × ATR(14), target 2R, 0.5% risk per trade, 16:00–23:00 server time, 2% daily loss limit.",
        source: r#"name("NAS100 MACD Momentum H1")
symbol("NAS100")
timeframe("H1")
risk(0.5)
max_lots(10)
stop_loss(atr=2, period=14)
take_profit(rr=2)
session("16:00", "23:00")
days(1, 2, 3, 4, 5)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

m = macd(close, 12, 26, 9)
sig = macd_signal(close, 12, 26, 9)
buy = crosses_above(m, sig) and m > 0 and close > ema(close, 100)
sell = crosses_below(m, sig) and m < 0 and close < ema(close, 100)
exit_buy = crosses_below(m, sig)
exit_sell = crosses_above(m, sig)
"#,
        backtest_days: 365,
    },
    Preset {
        key: "gbpusd-bollinger-reversion",
        nickname: "GBPUSD Band Reversion",
        strategy: "Bollinger reversion · GBPUSD M30",
        symbol: "GBPUSD",
        timeframe: "M30",
        description: "Range trading on cable. Buys when price closes back inside the lower Bollinger band (20, 2) with RSI(14) below 40, sells back inside the upper band with RSI above 60, only while ADX(14) is below 22 (no strong trend); exits at the middle band. Stop 2 × ATR(14), target 1.5R, at most 2 entries a day, 0.4% risk per trade, 2% daily loss limit.",
        source: r#"name("GBPUSD Bollinger Reversion M30")
symbol("GBPUSD")
timeframe("M30")
risk(0.4)
max_lots(5)
stop_loss(atr=2, period=14)
take_profit(rr=1.5)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

upper = bb_upper(close, 20, 2)
lower = bb_lower(close, 20, 2)
mid = bb_middle(close, 20, 2)
r = rsi(close, 14)
ranging = adx(14) < 22
buy = crosses_above(close, lower) and r < 40 and ranging
sell = crosses_below(close, upper) and r > 60 and ranging
exit_buy = close > mid
exit_sell = close < mid
"#,
        backtest_days: 365,
    },
    Preset {
        key: "usdjpy-atr-trend",
        nickname: "USDJPY ATR Trend",
        strategy: "ATR trailing trend · USDJPY H1",
        symbol: "USDJPY",
        timeframe: "H1",
        description: "Trend following on USDJPY. Trades 10/30 EMA crosses only in the direction of the 50/200 EMA trend and lets winners run with a 2.5 × ATR(14) trailing stop (initial stop 2.5 × ATR, no fixed target). 0.5% risk per trade, 2% daily loss limit.",
        source: r#"name("USDJPY ATR Trailing Trend H1")
symbol("USDJPY")
timeframe("H1")
risk(0.5)
max_lots(5)
stop_loss(atr=2.5, period=14)
trailing(atr=2.5, period=14)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

up = ema(close, 50) > ema(close, 200)
down = ema(close, 50) < ema(close, 200)
buy = up and crosses_above(ema(close, 10), ema(close, 30))
sell = down and crosses_below(ema(close, 10), ema(close, 30))
"#,
        backtest_days: 365,
    },
    Preset {
        key: "eurusd-london-breakout",
        nickname: "London Breakout",
        strategy: "London open breakout · EURUSD M15",
        symbol: "EURUSD",
        timeframe: "M15",
        description: "Trades the break of the pre-London range. Between 10:00 and 13:00 server time it buys a close above the high of the previous 6 hours (24 bars) or sells a close below its low; one trade a day, closed at 19:00 if still open. Stop 2 × ATR(14), target 2R, 0.4% risk per trade, 2% daily loss limit.",
        source: r#"name("EURUSD London Breakout M15")
symbol("EURUSD")
timeframe("M15")
risk(0.4)
max_lots(5)
stop_loss(atr=2, period=14)
take_profit(rr=2)
session("10:00", "19:00")
close_outside_session(true)
days(1, 2, 3, 4, 5)
max_trades_per_day(1)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

opening = hour >= 10 and hour < 13
buy = opening and close > highest(24)
sell = opening and close < lowest(24)
"#,
        backtest_days: 180,
    },
    Preset {
        key: "eth-ema-pullback",
        nickname: "ETH Trend Pullback",
        strategy: "Pullback to EMA · ETHUSD H1",
        symbol: "ETHUSD",
        timeframe: "H1",
        description: "Buys pullbacks in an Ethereum uptrend (20 EMA above 50 EMA, price above 200 EMA) when a bullish candle dips to the 20 EMA and closes above it; the mirror image for downtrends. Exits on a close through the 50 EMA. Stop 2 × ATR(14), target 2R, 0.5% risk per trade, 2% daily loss limit.",
        source: r#"name("ETH Pullback to EMA H1")
symbol("ETHUSD")
timeframe("H1")
risk(0.5)
max_lots(20)
stop_loss(atr=2, period=14)
take_profit(rr=2)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

e20 = ema(close, 20)
up = e20 > ema(close, 50) and close > ema(close, 200)
down = e20 < ema(close, 50) and close < ema(close, 200)
buy = up and low <= e20 and close > e20 and bullish()
sell = down and high >= e20 and close < e20 and bearish()
exit_buy = close < ema(close, 50)
exit_sell = close > ema(close, 50)
"#,
        backtest_days: 365,
    },
    Preset {
        key: "audusd-stochastic-range",
        nickname: "AUDUSD Range Stoch",
        strategy: "Stochastic range · AUDUSD M15",
        symbol: "AUDUSD",
        timeframe: "M15",
        description: "Range strategy on AUDUSD. With ADX(14) below 20, buys a Stochastic(14,3) %K/%D cross up from below 20 and sells a cross down from above 80; exits at the opposite extreme. Stop 1.5 × ATR(14), target 1.5R, at most 2 entries a day, 0.3% risk per trade, weekdays 02:00–20:00 server time, 2% daily loss limit.",
        source: r#"name("AUDUSD Stochastic Range M15")
symbol("AUDUSD")
timeframe("M15")
risk(0.3)
max_lots(5)
stop_loss(atr=1.5, period=14)
take_profit(rr=1.5)
session("02:00", "20:00")
days(1, 2, 3, 4, 5)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

k = stoch_k(14, 3)
d = stoch_d(14, 3)
ranging = adx(14) < 20
buy = crosses_above(k, d) and k < 20 and ranging
sell = crosses_below(k, d) and k > 80 and ranging
exit_buy = k > 80
exit_sell = k < 20
"#,
        backtest_days: 180,
    },
    Preset {
        key: "us30-dual-timeframe",
        nickname: "US30 Dual Trend",
        strategy: "Dual-timeframe trend · US30 H1",
        symbol: "US30",
        timeframe: "H1",
        description: "Dow Jones trend strategy on two timeframes: the H4 20/50 EMA trend sets the direction, an H1 close back through the 20 EMA with RSI(14) on the same side of 50 times the entry; exits when the H4 trend flips. Stop 2 × ATR(14), target 2R, 0.5% risk per trade, 16:00–23:00 server time, 2% daily loss limit.",
        source: r#"name("US30 Dual-Timeframe Trend H1")
symbol("US30")
timeframe("H1")
risk(0.5)
max_lots(5)
stop_loss(atr=2, period=14)
take_profit(rr=2)
session("16:00", "23:00")
days(1, 2, 3, 4, 5)
max_trades_per_day(2)
max_daily_loss({DAILY_LOSS})
one_at_a_time(true)

h4_up = htf("H4", ema(close, 20) > ema(close, 50))
h4_down = htf("H4", ema(close, 20) < ema(close, 50))
e20 = ema(close, 20)
buy = h4_up and crosses_above(close, e20) and rsi(close, 14) > 50
sell = h4_down and crosses_below(close, e20) and rsi(close, 14) < 50
exit_buy = h4_down
exit_sell = h4_up
"#,
        backtest_days: 365,
    },
];

pub fn preset(key: &str) -> Option<&'static Preset> {
    PRESETS.iter().find(|p| p.key == key)
}

/// The preset's DSL with the daily loss limit sized to the capital.
pub fn source_for(p: &Preset, capital: f64) -> String {
    let loss = (capital * DAILY_LOSS_PCT / 100.0).round().max(1.0);
    p.source.replace("{DAILY_LOSS}", &format!("{loss}"))
}

pub fn preset_json(p: &Preset) -> Value {
    json!({"key": p.key, "nickname": p.nickname, "strategy": p.strategy, "symbol": p.symbol, "timeframe": p.timeframe, "description": p.description,
           "source": source_for(p, DEFAULT_CAPITAL), "dailyLossPct": DAILY_LOSS_PCT, "backtestDays": p.backtest_days})
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug)]
pub struct Row {
    pub id: i64,
    pub tenant: String,
    pub preset: String,
    pub nickname: String,
    pub capital: f64,
    pub user_id: Option<i64>,
    pub login: Option<i64>,
    pub master_id: Option<i64>,
    pub strategy_id: Option<i64>,
    pub version_id: Option<i64>,
    pub backtest_id: Option<i64>,
    pub deployment_id: Option<i64>,
    pub listing_id: Option<i64>,
    pub enabled: bool,
    pub visible: bool,
    pub applied_hidden: Option<bool>,
    pub status: String,
    pub error: Option<String>,
    pub created_by: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

const COLS: &str = "id, tenant_id, preset, nickname, capital::float8 AS capital, user_id, login, master_id, strategy_id, version_id, backtest_id, deployment_id, listing_id,
                    enabled, visible, applied_hidden, status, error, created_by, created_at";

fn row_from(r: &sqlx::postgres::PgRow) -> Row {
    Row {
        id: r.get("id"),
        tenant: r.get("tenant_id"),
        preset: r.get("preset"),
        nickname: r.get("nickname"),
        capital: r.get("capital"),
        user_id: r.get("user_id"),
        login: r.get("login"),
        master_id: r.get("master_id"),
        strategy_id: r.get("strategy_id"),
        version_id: r.get("version_id"),
        backtest_id: r.get("backtest_id"),
        deployment_id: r.get("deployment_id"),
        listing_id: r.get("listing_id"),
        enabled: r.get("enabled"),
        visible: r.get("visible"),
        applied_hidden: r.get("applied_hidden"),
        status: r.get("status"),
        error: r.get("error"),
        created_by: r.get("created_by"),
        created_at: r.get("created_at"),
    }
}

pub async fn load(st: &AppState, tenant: &str, id: i64) -> Result<Row, ApiError> {
    let r = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {COLS} FROM house_accounts WHERE id = $1 AND tenant_id = $2")))
        .bind(id)
        .bind(tenant)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("House account"))?;
    Ok(row_from(&r))
}

pub async fn list(st: &AppState, tenant: &str) -> Result<Vec<Row>, ApiError> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {COLS} FROM house_accounts WHERE tenant_id = $1 AND status <> 'retired' ORDER BY id")))
        .bind(tenant)
        .fetch_all(&st.pool)
        .await?;
    Ok(rows.iter().map(row_from).collect())
}

pub async fn master_switch(st: &AppState, tenant: &str) -> bool {
    sqlx::query_scalar::<_, bool>("SELECT enabled FROM house_settings WHERE tenant_id = $1").bind(tenant).fetch_optional(&st.pool).await.ok().flatten().unwrap_or(true)
}

async fn set(st: &AppState, id: i64, col: &'static str, v: Option<i64>) -> Result<(), ApiError> {
    sqlx::query(sqlx::AssertSqlSafe(format!("UPDATE house_accounts SET {col} = $2, updated_at = now() WHERE id = $1"))).bind(id).bind(v).execute(&st.pool).await?;
    Ok(())
}

/* ------------------------------------------------------------------ */
/* Provisioning                                                        */
/* ------------------------------------------------------------------ */

/// Creates the row for a preset (status `provisioning`); `advance` does the work.
pub async fn create(st: &AppState, staff: &Staff, p: &Preset, capital: f64) -> Result<i64, ApiError> {
    let taken: i64 = sqlx::query_scalar("SELECT count(*) FROM house_accounts WHERE tenant_id = $1 AND preset = $2 AND status <> 'retired'").bind(&staff.tenant).bind(p.key).fetch_one(&st.pool).await?;
    if taken > 0 {
        return Err(ApiError::conflict("exists", format!("{} is already provisioned.", p.nickname)));
    }
    let id: i64 = sqlx::query_scalar("INSERT INTO house_accounts (tenant_id, preset, nickname, capital, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id")
        .bind(&staff.tenant)
        .bind(p.key)
        .bind(p.nickname)
        .bind(rust_decimal::Decimal::from_f64_retain(capital).map(|d| d.round_dp(2)).unwrap_or_default())
        .bind(format!("{} (staff:{})", staff.name, staff.id))
        .fetch_one(&st.pool)
        .await?;
    audit(&st.pool, &staff.tenant, &staff.actor(), "house.create", &format!("house:{id}"), json!({"preset": p.key, "capital": capital})).await;
    Ok(id)
}

fn msg(e: ApiError) -> String {
    match e {
        ApiError::BadRequest(m) | ApiError::Unauthorized(m) | ApiError::Forbidden(m) | ApiError::NotFound(m) => m,
        ApiError::Validation { message, .. } | ApiError::Coded { message, .. } => message,
        ApiError::RateLimited(_) => "rate limited".into(),
        ApiError::Internal(e) => e.to_string(),
    }
}

async fn gateway_user(st: &AppState, tenant: &str, key: &str, nickname: &str) -> Result<i64, String> {
    let r = st
        .http
        .post(format!("{}/v1/internal/house-users", st.cfg.gateway_url))
        .header("x-kalks-internal", &st.cfg.gateway_token)
        .header("x-kalks-tenant", tenant)
        .header("x-forwarded-for", "127.0.0.1")
        .header("user-agent", "kalks-algo")
        .json(&json!({"key": key, "nickname": nickname}))
        .send()
        .await
        .map_err(|e| format!("gateway unreachable: {e}"))?;
    let status = r.status();
    let v: Value = r.json().await.unwrap_or(Value::Null);
    v.pointer("/user/id").and_then(Value::as_i64).ok_or_else(|| format!("gateway HTTP {status}: {}", v.pointer("/error/message").or_else(|| v.get("message")).and_then(Value::as_str).unwrap_or("house user not created")))
}

/// Runs every provisioning step that is still missing (idempotent: a failed provisioning resumes where it
/// stopped). Marks the row `active` or `failed` with the error.
pub async fn advance(st: &AppState, staff: &Staff, id: i64, note: &str) -> Result<Row, ApiError> {
    let res = steps(st, staff, id, note).await;
    match res {
        Ok(()) => {
            sqlx::query("UPDATE house_accounts SET status = 'active', error = NULL, updated_at = now() WHERE id = $1").bind(id).execute(&st.pool).await?;
            audit(&st.pool, &staff.tenant, &staff.actor(), "house.provisioned", &format!("house:{id}"), json!({"note": note})).await;
            apply(st, staff, id, false, note).await?;
            load(st, &staff.tenant, id).await
        }
        Err(msg) => {
            sqlx::query("UPDATE house_accounts SET status = 'failed', error = $2, updated_at = now() WHERE id = $1").bind(id).bind(&msg).execute(&st.pool).await?;
            audit(&st.pool, &staff.tenant, &staff.actor(), "house.failed", &format!("house:{id}"), json!({"error": msg})).await;
            tracing::warn!(house = id, error = %msg, "house account provisioning failed");
            Err(ApiError::unprocessable("provisioning_failed", msg))
        }
    }
}

async fn steps(st: &AppState, staff: &Staff, id: i64, note: &str) -> Result<(), String> {
    let e = msg;
    let r = load(st, &staff.tenant, id).await.map_err(e)?;
    let p = preset(&r.preset).ok_or("unknown preset")?;
    let tenant = r.tenant.clone();

    // 1. house user (gateway)
    let user = match r.user_id {
        Some(u) => u,
        None => {
            let u = gateway_user(st, &tenant, &format!("{}-{}", r.preset, r.id), &r.nickname).await?;
            set(st, id, "user_id", Some(u)).await.map_err(e)?;
            u
        }
    };

    // 2. live account + house capital + approved house master (engine)
    let (login, master) = match (r.login, r.master_id) {
        (Some(l), Some(m)) => (l, m),
        _ => {
            let body = json!({"userId": user, "nickname": r.nickname, "strategy": p.strategy, "description": p.description, "group": GROUP, "capital": r.capital,
                              "perfFeePct": 0, "feePeriod": "monthly", "key": format!("h{}", r.id), "note": format!("House account {}: {note}", r.preset)});
            let rep = st.engine.staff_call(reqwest::Method::POST, "/v1/social/admin/house", staff, Some(&body)).await.map_err(|x| format!("trading engine unreachable: {x}"))?;
            if !rep.ok() {
                return Err(format!("trading engine: {}", rep.message()));
            }
            let login = rep.body.get("login").and_then(Value::as_i64).ok_or("engine returned no login")?;
            let master = rep.body.pointer("/master/id").and_then(Value::as_i64).ok_or("engine returned no master")?;
            sqlx::query("UPDATE house_accounts SET login = $2, master_id = $3, applied_hidden = $4, updated_at = now() WHERE id = $1")
                .bind(id)
                .bind(login)
                .bind(master)
                .bind(rep.body.pointer("/master/hidden").and_then(Value::as_bool).unwrap_or(false))
                .execute(&st.pool)
                .await
                .map_err(|x| x.to_string())?;
            (login, master)
        }
    };
    let _ = master;

    // 3. the strategy (the preset, sized to the capital), owned by the house user
    let (sid, vid) = match (r.strategy_id, r.version_id) {
        (Some(s), Some(v)) => (s, v),
        _ => {
            let src = source_for(p, r.capital);
            let b = build("code", None, Some(&src), p.symbol, p.timeframe, &st.specs)?;
            if !b.valid() {
                return Err(format!("preset {} does not compile: {:?}", p.key, b.errors));
            }
            let name = b.spec.name.clone();
            let (s, v) = insert(&st.pool, &tenant, user, &name, "template", None, &b, Some(&format!("House account preset {}", p.key)), None).await.map_err(|x| x.to_string())?;
            sqlx::query("UPDATE house_accounts SET strategy_id = $2, version_id = $3, updated_at = now() WHERE id = $1").bind(id).bind(s).bind(v).execute(&st.pool).await.map_err(|x| x.to_string())?;
            (s, v)
        }
    };

    // 4. the backtest (queued; the workers run it — shown only as a labelled backtest)
    if r.backtest_id.is_none() {
        let tf = p.timeframe;
        let to = chrono::Utc::now().timestamp();
        let from = to - p.backtest_days.min(crate::backtest::jobs::max_days(tf)) * 86400;
        let params = json!({"from": from, "to": to, "initialBalance": r.capital, "symbol": p.symbol, "timeframe": tf, "login": login});
        let bt: i64 = sqlx::query_scalar("INSERT INTO backtests (tenant_id, user_id, strategy_id, version_id, params) VALUES ($1,$2,$3,$4,$5) RETURNING id")
            .bind(&tenant)
            .bind(user)
            .bind(sid)
            .bind(vid)
            .bind(&params)
            .fetch_one(&st.pool)
            .await
            .map_err(|x| x.to_string())?;
        set(st, id, "backtest_id", Some(bt)).await.map_err(e)?;
        st.jobs_wake.notify_waiters();
    }

    // 5. the deployment on the live account (the normal runtime path)
    let dep = match r.deployment_id {
        Some(d) => d,
        None => {
            let u = User { tenant: tenant.clone(), id: user, name: r.nickname.clone() };
            let d = deployments::start(st, &u, vid, login, json!({}), None).await.map_err(e)?;
            set(st, id, "deployment_id", Some(d)).await.map_err(e)?;
            runtime::log(st, d, "info", "info", &format!("House account \"{}\" (operated by the broker). Track record = this deployment's own closed deals.", r.nickname)).await;
            d
        }
    };

    // 6. the marketplace listing (free, house-labelled, auto-approved; the track record is the deployment's)
    if r.listing_id.is_none() {
        let bt: Option<i64> = sqlx::query_scalar("SELECT backtest_id FROM house_accounts WHERE id = $1").bind(id).fetch_one(&st.pool).await.map_err(|x| x.to_string())?;
        let title = sqlx::query_scalar::<_, String>("SELECT name FROM strategies WHERE id = $1").bind(sid).fetch_one(&st.pool).await.map_err(|x| x.to_string())?;
        let lid: i64 = sqlx::query_scalar(
            "INSERT INTO listings (tenant_id, author_user_id, author_name, strategy_id, version_id, track_deployment_id, title, description, symbol, timeframe, price_monthly, allow_clone,
                                   status, moderation_note, moderated_by, moderated_at, is_house, backtest_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,true,'unlisted','House account: operated by the broker','house',now(),true,$11) RETURNING id",
        )
        .bind(&tenant)
        .bind(user)
        .bind(&r.nickname)
        .bind(sid)
        .bind(vid)
        .bind(dep)
        .bind(&title)
        .bind(p.description)
        .bind(p.symbol)
        .bind(p.timeframe)
        .bind(bt)
        .fetch_one(&st.pool)
        .await
        .map_err(|x| x.to_string())?;
        set(st, id, "listing_id", Some(lid)).await.map_err(e)?;
    }
    Ok(())
}

/* ------------------------------------------------------------------ */
/* Switches                                                            */
/* ------------------------------------------------------------------ */

/// Brings the deployment, the master's leaderboard visibility and the listing in line with the switches.
/// Returns what changed.
pub async fn apply(st: &AppState, staff: &Staff, id: i64, close_positions: bool, note: &str) -> Result<Value, ApiError> {
    let r = load(st, &staff.tenant, id).await?;
    if r.status != "active" {
        return Ok(json!({"skipped": r.status}));
    }
    let on = master_switch(st, &r.tenant).await && r.enabled;
    let mut out = json!({"on": on});
    if let Some(dep) = r.deployment_id {
        let status: String = sqlx::query_scalar("SELECT status FROM deployments WHERE id = $1").bind(dep).fetch_one(&st.pool).await?;
        if on && status == "paused" {
            sqlx::query("UPDATE deployments SET status = 'running' WHERE id = $1").bind(dep).execute(&st.pool).await?;
            runtime::log(st, dep, "info", "info", &format!("Resumed: house account switched on by {}", staff.name)).await;
            out["deployment"] = json!("running");
        } else if !on && status == "running" {
            sqlx::query("UPDATE deployments SET status = 'paused' WHERE id = $1").bind(dep).execute(&st.pool).await?;
            runtime::log(st, dep, "info", "info", &format!("Paused: house account switched off by {} (no new entries)", staff.name)).await;
            out["deployment"] = json!("paused");
        } else {
            out["deployment"] = json!(status);
        }
        if !on && close_positions && let Some(d) = deployments::dep_of(st, dep).await? {
            let (c, f) = runtime::close_tracked(st, &d, None, "House account switched off").await;
            out["closed"] = json!(c);
            out["failedToClose"] = json!(f);
        }
        st.runtime_wake.notify_waiters();
    }
    let hide = !(on && r.visible);
    if let Some(m) = r.master_id
        && r.applied_hidden != Some(hide)
    {
        let body = json!({"action": if hide { "hide" } else { "unhide" }, "note": format!("House account {}: {note}", r.preset)});
        let rep = st.engine.staff_call(reqwest::Method::POST, &format!("/v1/social/admin/masters/{m}/status"), staff, Some(&body)).await.map_err(|_| ApiError::unavailable("Trading service is unavailable."))?;
        if !rep.ok() {
            return Err(rep.into_error());
        }
        sqlx::query("UPDATE house_accounts SET applied_hidden = $2, updated_at = now() WHERE id = $1").bind(id).bind(hide).execute(&st.pool).await?;
        out["leaderboard"] = json!(if hide { "hidden" } else { "shown" });
    }
    if let Some(l) = r.listing_id {
        sqlx::query("UPDATE listings SET status = $2, updated_at = now() WHERE id = $1 AND status IN ('approved','unlisted')").bind(l).bind(if hide { "unlisted" } else { "approved" }).execute(&st.pool).await?;
        out["listing"] = json!(if hide { "unlisted" } else { "approved" });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::specs::Specs;

    #[test]
    fn ten_distinct_presets_compile_with_risk_controls() {
        let specs = Specs::repo();
        assert!(PRESETS.len() >= 10);
        let mut keys = std::collections::HashSet::new();
        let mut names = std::collections::HashSet::new();
        let mut markets = std::collections::HashSet::new();
        for p in PRESETS {
            assert!(keys.insert(p.key), "duplicate key {}", p.key);
            assert!(names.insert(p.nickname.to_lowercase()), "duplicate nickname {}", p.nickname);
            assert!(markets.insert((p.symbol, p.timeframe, p.strategy)), "duplicate market {}", p.key);
            let n = p.nickname.chars().count();
            assert!((3..=32).contains(&n) && p.nickname.chars().all(|c| c.is_alphanumeric() || " ._-".contains(c)), "nickname {} is not a valid master nickname", p.nickname);
            let src = source_for(p, 10_000.0);
            assert!(!src.contains('{'), "unfilled placeholder in {}", p.key);
            let b = build("code", None, Some(&src), p.symbol, p.timeframe, &specs).unwrap();
            assert!(b.valid(), "{} does not compile: {:?}", p.key, b.errors);
            let s = &b.spec;
            assert_eq!(s.symbol, p.symbol, "{}", p.key);
            assert_eq!(s.timeframe, p.timeframe, "{}", p.key);
            assert_eq!(s.sizing.mode, "risk", "{} must size by risk %", p.key);
            assert!(s.sizing.risk_pct > 0.0 && s.sizing.risk_pct <= 1.0, "{} risk {}", p.key, s.sizing.risk_pct);
            assert_ne!(s.sl.mode, "none", "{} needs a stop loss", p.key);
            assert_eq!(s.max_daily_loss, 200.0, "{}: 2% of 10,000", p.key);
            assert!(s.one_at_a_time && s.max_trades_per_day > 0 && s.max_lots > 0.0, "{}", p.key);
            assert!(p.description.len() > 60);
            assert!(b.program.signals().iter().any(|(k, n)| *k == "buy" && n.is_some()) && b.program.signals().iter().any(|(k, n)| *k == "sell" && n.is_some()), "{} needs buy and sell rules", p.key);
        }
    }

    #[test]
    fn daily_loss_follows_the_capital() {
        let p = preset("gold-ema-trend").unwrap();
        assert!(source_for(p, 25_000.0).contains("max_daily_loss(500)"));
        assert!(source_for(p, 100.0).contains("max_daily_loss(2)"));
    }
}

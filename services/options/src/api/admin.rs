//! Back Office routes (internal token + `X-Kalks-Staff`; the admin BFF checks `options.read` /
//! `options.config` / `options.dealing` / `options.settle`). Every write is audited and bumps the snapshot
//! version. Platform data (underlyings, rates, holidays, surfaces, module switches, fixings, listing) can
//! only be changed from tenant `kalks`; brokers tune their own spreads / fees / limits / controls (O42).

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use chrono::{DateTime, NaiveDate, Utc};
use optmath::calendar::{Cut, ExpiryKind};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{ApiError, R, staff, tenant};
use crate::model::{GroupSettings, MmSettings, PLATFORM_TENANT, Pillar, build_surface, fee_rule_violation, is_multiple};
use crate::{AppState, jobs, store};

struct Staff {
    tenant: String,
    actor: String,
}

impl Staff {
    fn platform(&self) -> bool {
        self.tenant == PLATFORM_TENANT
    }
    fn require_platform(&self) -> R<()> {
        if self.platform() { Ok(()) } else { Err(ApiError::forbidden("Only Kalks staff can change platform-wide options data.")) }
    }
}

fn who(h: &HeaderMap) -> R<Staff> {
    Ok(Staff { tenant: tenant(h), actor: staff(h)? })
}

fn need_reason(r: &Option<String>) -> R<String> {
    let r = r.as_deref().map(str::trim).unwrap_or("");
    if r.len() < 3 {
        return Err(ApiError::bad("A reason is required."));
    }
    Ok(r.chars().take(500).collect())
}

fn opt_reason(r: &Option<String>) -> String {
    r.as_deref().map(str::trim).unwrap_or("").chars().take(500).collect()
}

/// Turns a CHECK / FK violation into a 422.
fn db_err(e: sqlx::Error) -> ApiError {
    if let Some(d) = e.as_database_error() {
        match d.code().as_deref() {
            Some("23514") => return ApiError::bad(format!("Value out of range ({}).", d.constraint().unwrap_or("check"))),
            Some("23503") => return ApiError::bad("Unknown reference."),
            _ => {}
        }
    }
    e.into()
}

async fn finish(st: &AppState, mut tx: sqlx::Transaction<'_, sqlx::Postgres>) -> R<i64> {
    let v = store::bump(&mut tx).await?;
    tx.commit().await?;
    st.reload(true).await?;
    Ok(v)
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

/// `GET /v1/admin/options/overview`.
pub async fn overview(State(st): State<AppState>, h: HeaderMap) -> R {
    let s = who(&h)?;
    let rd = st.refdata().await;
    let jobs: serde_json::Map<String, Value> = st.jobs.lock().unwrap().iter().map(|(k, v)| (k.to_string(), json!(v))).collect();
    Ok(Json(json!({
        "version": rd.version,
        "tenant": rd.tenant(&s.tenant),
        "underlyings": rd.underlyings.iter().filter(|u| u.enabled).count(),
        "expiries": rd.expiries.iter().filter(|e| e.status == "listed").count(),
        "series": rd.series.iter().filter(|x| x.status == "active").count(),
        "awaitingFixing": rd.expiries.iter().filter(|e| e.status == "fixing").count(),
        "controls": rd.controls.len(),
        "feedConnected": st.spots.connected(),
        "bookFeed": st.books.status(),
        "jobs": jobs,
    })))
}

/* ------------------------------------------------------------------ */
/* Underlyings                                                         */
/* ------------------------------------------------------------------ */

pub async fn underlyings(State(st): State<AppState>, h: HeaderMap) -> R {
    who(&h)?;
    let rd = st.refdata().await;
    let spots = st.spots.all().await;
    let list: Vec<Value> = rd
        .underlyings
        .iter()
        .map(|u| {
            let mut v = json!(u);
            v["calendarCodes"] = json!(u.calendar_codes());
            v["spot"] = json!(spots.get(&u.symbol));
            v["surfaceVersion"] = json!(rd.surfaces.get(&u.symbol).map(|s| s.version));
            v["realizedVol"] = json!(rd.realized.get(&u.symbol));
            v
        })
        .collect();
    Ok(Json(json!({"underlyings": list})))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UnderlyingPatch {
    name: Option<String>,
    calendars: Option<Vec<String>>,
    contract_size: Option<f64>,
    digits: Option<i32>,
    pip_size: Option<f64>,
    strike_step: Option<f64>,
    strikes_each_side: Option<i32>,
    extend_threshold: Option<i32>,
    expiry_kinds: Option<Vec<String>>,
    daily_count: Option<i32>,
    weekly_count: Option<i32>,
    monthly_count: Option<i32>,
    cut_time: Option<String>,
    cut_zone: Option<String>,
    twap_minutes: Option<i32>,
    no_open_minutes: Option<i32>,
    close_only_minutes: Option<i32>,
    delta_convention: Option<String>,
    weekend_vol_weight: Option<f64>,
    holiday_vol_weight: Option<f64>,
    price_scan: Option<f64>,
    vol_scan: Option<f64>,
    extreme_multiple: Option<f64>,
    extreme_cover: Option<f64>,
    min_contracts: Option<f64>,
    max_contracts: Option<f64>,
    contract_step: Option<f64>,
    barriers_enabled: Option<bool>,
    enabled: Option<bool>,
    sort: Option<i32>,
    notes: Option<String>,
    // order book (docs/OPTIONS-EXCHANGE.md §2, §5, §6, §8)
    premium_tick: Option<f64>,
    market_band_pct: Option<f64>,
    limit_band_pct: Option<f64>,
    band_min_ticks: Option<i32>,
    liq_band_pct: Option<f64>,
    liq_fee_pct: Option<f64>,
    rfq_quote_ttl_secs: Option<i32>,
    mark_min_qty: Option<f64>,
    mark_max_spread_mult: Option<f64>,
    reason: Option<String>,
}

/// Order-book and contract-size checks of an underlying (§2, §5, §6, §8). Bands and liquidation are percent.
pub fn validate_book_fields(u: &crate::model::Underlying) -> Result<(), String> {
    let fin = |x: f64| x.is_finite();
    if !(fin(u.premium_tick) && u.premium_tick > 0.0 && u.premium_tick < 1000.0) {
        return Err("premiumTick must be a positive price per unit in the quote currency (EURUSD 0.00001).".into());
    }
    if !(fin(u.market_band_pct) && u.market_band_pct > 0.0 && u.market_band_pct <= 100.0) || !(fin(u.limit_band_pct) && u.limit_band_pct > 0.0 && u.limit_band_pct <= 100.0) {
        return Err("marketBandPct and limitBandPct are percentages above 0 and at most 100.".into());
    }
    if !(0..=100_000).contains(&u.band_min_ticks) {
        return Err("bandMinTicks must be a whole number of ticks, 0 or more.".into());
    }
    if !(fin(u.liq_band_pct) && (0.0..=50.0).contains(&u.liq_band_pct)) || !(fin(u.liq_fee_pct) && (0.0..=50.0).contains(&u.liq_fee_pct)) {
        return Err("liqBandPct and liqFeePct are percentages between 0 and 50.".into());
    }
    if !(1..=60).contains(&u.rfq_quote_ttl_secs) {
        return Err("rfqQuoteTtlSecs must be between 1 and 60 seconds.".into());
    }
    if !(fin(u.mark_min_qty) && u.mark_min_qty >= 0.0) {
        return Err("markMinQty must be 0 or more contracts.".into());
    }
    if !(fin(u.mark_max_spread_mult) && (1.0..=100.0).contains(&u.mark_max_spread_mult)) {
        return Err("markMaxSpreadMult must be between 1 and 100 (× the model spread).".into());
    }
    if !(fin(u.contract_step) && u.contract_step > 0.0) {
        return Err("contractStep must be positive.".into());
    }
    if !(fin(u.min_contracts) && u.min_contracts > 0.0) || !(fin(u.max_contracts) && u.max_contracts > 0.0) {
        return Err("minContracts and maxContracts must be positive.".into());
    }
    if u.min_contracts > u.max_contracts {
        return Err("minContracts must not exceed maxContracts.".into());
    }
    if !is_multiple(u.min_contracts, u.contract_step) || !is_multiple(u.max_contracts, u.contract_step) {
        return Err("minContracts and maxContracts must be whole multiples of contractStep.".into());
    }
    Ok(())
}

/// `PUT /v1/admin/options/underlyings/{symbol}` (platform): partial update. New cut / TWAP / cycle settings
/// apply to expiries listed afterwards; listed expiries keep their cut.
pub async fn underlying_put(State(st): State<AppState>, h: HeaderMap, Path(symbol): Path<String>, Json(p): Json<UnderlyingPatch>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let rd = st.refdata().await;
    let cur = rd.underlying(&symbol).ok_or_else(|| ApiError::not_found("Underlying"))?.clone();
    let mut u = cur.clone();
    macro_rules! set {
        ($($f:ident),*) => { $( if let Some(v) = p.$f.clone() { u.$f = v; } )* };
    }
    set!(name, calendars, contract_size, digits, pip_size, strike_step, strikes_each_side, extend_threshold, expiry_kinds, daily_count, weekly_count, monthly_count);
    set!(cut_time, cut_zone, twap_minutes, no_open_minutes, close_only_minutes, delta_convention, weekend_vol_weight, holiday_vol_weight);
    set!(price_scan, vol_scan, extreme_multiple, extreme_cover, min_contracts, max_contracts, contract_step, barriers_enabled, enabled, sort, notes);
    set!(premium_tick, market_band_pct, limit_band_pct, band_min_ticks, liq_band_pct, liq_fee_pct, rfq_quote_ttl_secs, mark_min_qty, mark_max_spread_mult);
    u.calendars = u.calendars.iter().map(|c| c.trim().to_ascii_uppercase()).filter(|c| !c.is_empty()).collect();
    if u.calendars.is_empty() || u.calendars.iter().any(|c| c.len() > 8 || !c.chars().all(|x| x.is_ascii_alphanumeric())) {
        return Err(ApiError::bad("calendars must be a non-empty list of calendar codes (e.g. EUR, USD)."));
    }
    let Some(cut) = Cut::parse(&u.cut_time, &u.cut_zone) else {
        return Err(ApiError::bad("cutTime must be HH:MM and cutZone one of America/New_York, Europe/London, Asia/Tokyo, UTC."));
    };
    u.cut_time = cut.time_str();
    u.cut_zone = cut.zone.name().into();
    if u.expiry_kinds.iter().any(|k| ExpiryKind::parse(k).is_none()) {
        return Err(ApiError::bad("expiryKinds must be daily, weekly and/or monthly."));
    }
    if u.no_open_minutes < u.close_only_minutes {
        return Err(ApiError::bad("noOpenMinutes must be at least closeOnlyMinutes."));
    }
    validate_book_fields(&u).map_err(ApiError::bad)?;
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "UPDATE underlyings SET name=$2, calendars=$3, contract_size=$4, digits=$5, pip_size=$6, strike_step=$7, strikes_each_side=$8, extend_threshold=$9,
            expiry_kinds=$10, daily_count=$11, weekly_count=$12, monthly_count=$13, cut_time=$14, cut_zone=$15, twap_minutes=$16, no_open_minutes=$17,
            close_only_minutes=$18, delta_convention=$19, weekend_vol_weight=$20, holiday_vol_weight=$21, price_scan=$22, vol_scan=$23,
            extreme_multiple=$24, extreme_cover=$25, min_contracts=$26, max_contracts=$27, contract_step=$28, barriers_enabled=$29, enabled=$30,
            sort=$31, notes=$32, updated_at=now(), updated_by=$33, premium_tick=$34, market_band_pct=$35, limit_band_pct=$36, band_min_ticks=$37,
            liq_band_pct=$38, liq_fee_pct=$39, rfq_quote_ttl_secs=$40, mark_min_qty=$41, mark_max_spread_mult=$42 WHERE symbol=$1",
    )
    .bind(&u.symbol)
    .bind(&u.name)
    .bind(&u.calendars)
    .bind(u.contract_size)
    .bind(u.digits)
    .bind(u.pip_size)
    .bind(u.strike_step)
    .bind(u.strikes_each_side)
    .bind(u.extend_threshold)
    .bind(&u.expiry_kinds)
    .bind(u.daily_count)
    .bind(u.weekly_count)
    .bind(u.monthly_count)
    .bind(&u.cut_time)
    .bind(&u.cut_zone)
    .bind(u.twap_minutes)
    .bind(u.no_open_minutes)
    .bind(u.close_only_minutes)
    .bind(&u.delta_convention)
    .bind(u.weekend_vol_weight)
    .bind(u.holiday_vol_weight)
    .bind(u.price_scan)
    .bind(u.vol_scan)
    .bind(u.extreme_multiple)
    .bind(u.extreme_cover)
    .bind(u.min_contracts)
    .bind(u.max_contracts)
    .bind(u.contract_step)
    .bind(u.barriers_enabled)
    .bind(u.enabled)
    .bind(u.sort)
    .bind(&u.notes)
    .bind(&s.actor)
    .bind(u.premium_tick)
    .bind(u.market_band_pct)
    .bind(u.limit_band_pct)
    .bind(u.band_min_ticks)
    .bind(u.liq_band_pct)
    .bind(u.liq_fee_pct)
    .bind(u.rfq_quote_ttl_secs)
    .bind(u.mark_min_qty)
    .bind(u.mark_max_spread_mult)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;
    store::audit(&mut tx, &s.tenant, &s.actor, "underlying.update", &u.symbol, Some(json!(cur)), Some(json!(u)), &opt_reason(&p.reason)).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"underlying": st.refdata().await.underlying(&symbol), "version": v})))
}

/* ------------------------------------------------------------------ */
/* Rates                                                               */
/* ------------------------------------------------------------------ */

pub async fn rates(State(st): State<AppState>, h: HeaderMap) -> R {
    who(&h)?;
    let rd = st.refdata().await;
    Ok(Json(json!({"rates": rd.rates.values().collect::<Vec<_>>()})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RatePut {
    rate: f64,
    kind: Option<String>,
    source: Option<String>,
    as_of: Option<NaiveDate>,
    reason: Option<String>,
}

/// `PUT /v1/admin/options/rates/{ccy} {rate (decimal, 0.0425 = 4.25%), kind?, source?, asOf?, reason}` (platform).
pub async fn rate_put(State(st): State<AppState>, h: HeaderMap, Path(ccy): Path<String>, Json(p): Json<RatePut>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let reason = need_reason(&p.reason)?;
    let ccy = ccy.trim().to_ascii_uppercase();
    if ccy.len() < 3 || ccy.len() > 4 || !ccy.chars().all(|c| c.is_ascii_alphabetic()) {
        return Err(ApiError::bad("Currency code must be 3-4 letters."));
    }
    if !(p.rate.is_finite() && p.rate > -0.2 && p.rate < 0.5) {
        return Err(ApiError::bad("rate is a decimal (0.0425 = 4.25%) between -0.2 and 0.5."));
    }
    let kind = p.kind.clone().unwrap_or_else(|| if matches!(ccy.as_str(), "XAU" | "XAG") { "lease".into() } else { "policy".into() });
    let as_of = p.as_of.unwrap_or_else(|| Utc::now().date_naive());
    let rd = st.refdata().await;
    let prev = rd.rates.get(&ccy).cloned();
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "INSERT INTO rates (ccy, rate, kind, source, as_of, updated_at, updated_by) VALUES ($1,$2,$3,$4,$5,now(),$6)
         ON CONFLICT (ccy) DO UPDATE SET rate = EXCLUDED.rate, kind = EXCLUDED.kind, source = EXCLUDED.source, as_of = EXCLUDED.as_of, updated_at = now(), updated_by = EXCLUDED.updated_by",
    )
    .bind(&ccy)
    .bind(p.rate)
    .bind(&kind)
    .bind(p.source.clone().or_else(|| prev.as_ref().map(|r| r.source.clone())).unwrap_or_default())
    .bind(as_of)
    .bind(&s.actor)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;
    sqlx::query("INSERT INTO rate_history (ccy, rate, prev_rate, as_of, reason, changed_by) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(&ccy)
        .bind(p.rate)
        .bind(prev.as_ref().map(|r| r.rate))
        .bind(as_of)
        .bind(&reason)
        .bind(&s.actor)
        .execute(&mut *tx)
        .await?;
    store::audit(&mut tx, &s.tenant, &s.actor, "rate.update", &ccy, prev.map(|r| json!(r)), Some(json!({"rate": p.rate, "kind": kind, "asOf": as_of})), &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"rate": st.refdata().await.rates.get(&ccy), "version": v})))
}

pub async fn rate_history(State(st): State<AppState>, h: HeaderMap, Path(ccy): Path<String>) -> R {
    who(&h)?;
    let rows = sqlx::query("SELECT rate, prev_rate, as_of, reason, changed_by, changed_at FROM rate_history WHERE ccy = $1 ORDER BY changed_at DESC LIMIT 200")
        .bind(ccy.to_ascii_uppercase())
        .fetch_all(&st.pool)
        .await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"rate": r.get::<f64, _>("rate"), "prevRate": r.get::<Option<f64>, _>("prev_rate"), "asOf": r.get::<NaiveDate, _>("as_of"),
                   "reason": r.get::<String, _>("reason"), "changedBy": r.get::<String, _>("changed_by"), "changedAt": r.get::<DateTime<Utc>, _>("changed_at")})
        })
        .collect();
    Ok(Json(json!({"ccy": ccy.to_ascii_uppercase(), "history": list})))
}

/* ------------------------------------------------------------------ */
/* Holidays                                                            */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
pub struct HolQ {
    calendar: Option<String>,
    year: Option<i32>,
}

/// `GET /v1/admin/options/holidays?calendar=&year=` (inactive rows included) -> `{calendars[], holidays[]}`.
pub async fn holidays(State(st): State<AppState>, h: HeaderMap, Query(q): Query<HolQ>) -> R {
    who(&h)?;
    let rows = sqlx::query(
        "SELECT calendar, day, name, source, active, updated_at, updated_by FROM holidays
          WHERE ($1::text IS NULL OR calendar = $1) AND ($2::int IS NULL OR extract(year FROM day)::int = $2) ORDER BY calendar, day",
    )
    .bind(q.calendar.as_ref().map(|c| c.to_ascii_uppercase()))
    .bind(q.year)
    .fetch_all(&st.pool)
    .await?;
    let cals: Vec<String> = sqlx::query_scalar("SELECT DISTINCT calendar FROM holidays ORDER BY 1").fetch_all(&st.pool).await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"calendar": r.get::<String, _>("calendar"), "day": r.get::<NaiveDate, _>("day"), "name": r.get::<String, _>("name"),
                   "source": r.get::<String, _>("source"), "active": r.get::<bool, _>("active"), "updatedAt": r.get::<DateTime<Utc>, _>("updated_at"),
                   "updatedBy": r.get::<String, _>("updated_by")})
        })
        .collect();
    Ok(Json(json!({"calendars": cals, "holidays": list})))
}

#[derive(Deserialize)]
pub struct HolPut {
    name: String,
    active: Option<bool>,
    reason: Option<String>,
}

fn parse_day(s: &str) -> R<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| ApiError::bad("Day must be YYYY-MM-DD."))
}

fn calendar_code(c: &str) -> R<String> {
    let c = c.trim().to_ascii_uppercase();
    if c.is_empty() || c.len() > 8 || !c.chars().all(|x| x.is_ascii_alphanumeric()) {
        return Err(ApiError::bad("Calendar code must be 1-8 letters/digits."));
    }
    Ok(c)
}

/// `PUT /v1/admin/options/holidays/{calendar}/{day} {name, active?, reason?}` (platform): add or edit.
pub async fn holiday_put(State(st): State<AppState>, h: HeaderMap, Path((cal, day)): Path<(String, String)>, Json(p): Json<HolPut>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let (cal, day) = (calendar_code(&cal)?, parse_day(&day)?);
    let name: String = p.name.trim().chars().take(120).collect();
    if name.is_empty() {
        return Err(ApiError::bad("Name is required."));
    }
    let mut tx = st.pool.begin().await?;
    let prev = sqlx::query("SELECT name, active, source FROM holidays WHERE calendar = $1 AND day = $2").bind(&cal).bind(day).fetch_optional(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO holidays (calendar, day, name, source, active, updated_at, updated_by) VALUES ($1,$2,$3,'admin',$4,now(),$5)
         ON CONFLICT (calendar, day) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now(), updated_by = EXCLUDED.updated_by",
    )
    .bind(&cal)
    .bind(day)
    .bind(&name)
    .bind(p.active.unwrap_or(true))
    .bind(&s.actor)
    .execute(&mut *tx)
    .await?;
    let before = prev.map(|r| json!({"name": r.get::<String, _>("name"), "active": r.get::<bool, _>("active"), "source": r.get::<String, _>("source")}));
    store::audit(&mut tx, &s.tenant, &s.actor, "holiday.upsert", &format!("{cal}:{day}"), before, Some(json!({"name": name, "active": p.active.unwrap_or(true)})), &opt_reason(&p.reason)).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"ok": true, "version": v})))
}

#[derive(Deserialize)]
pub struct ReasonQ {
    reason: Option<String>,
}

/// `DELETE /v1/admin/options/holidays/{calendar}/{day}?reason=` (platform): disables the date (kept so the
/// seed does not add it back).
pub async fn holiday_delete(State(st): State<AppState>, h: HeaderMap, Path((cal, day)): Path<(String, String)>, Query(q): Query<ReasonQ>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let reason = need_reason(&q.reason)?;
    let (cal, day) = (calendar_code(&cal)?, parse_day(&day)?);
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query("UPDATE holidays SET active = false, updated_at = now(), updated_by = $3 WHERE calendar = $1 AND day = $2 AND active")
        .bind(&cal)
        .bind(day)
        .bind(&s.actor)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(ApiError::not_found("Active holiday"));
    }
    store::audit(&mut tx, &s.tenant, &s.actor, "holiday.disable", &format!("{cal}:{day}"), None, None, &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"ok": true, "version": v})))
}

/* ------------------------------------------------------------------ */
/* Vol surfaces                                                        */
/* ------------------------------------------------------------------ */

/// `GET /v1/admin/options/surfaces/{symbol}` -> `{current, versions[], realized[]}`.
pub async fn surface_get(State(st): State<AppState>, h: HeaderMap, Path(symbol): Path<String>) -> R {
    who(&h)?;
    let symbol = symbol.to_ascii_uppercase();
    let rd = st.refdata().await;
    rd.underlying(&symbol).ok_or_else(|| ApiError::not_found("Underlying"))?;
    let versions = sqlx::query("SELECT version, blend_weight, reason, published_by, published_at FROM vol_surfaces WHERE symbol = $1 ORDER BY version DESC LIMIT 100")
        .bind(&symbol)
        .fetch_all(&st.pool)
        .await?;
    let rv = sqlx::query("SELECT estimator, window_bars, value, bars, computed_at FROM realized_vol WHERE symbol = $1 ORDER BY estimator, window_bars")
        .bind(&symbol)
        .fetch_all(&st.pool)
        .await?;
    Ok(Json(json!({
        "symbol": symbol,
        "current": rd.surfaces.get(&symbol),
        "versions": versions.iter().map(|r| json!({"version": r.get::<i32, _>("version"), "blendWeight": r.get::<f64, _>("blend_weight"), "reason": r.get::<String, _>("reason"),
            "publishedBy": r.get::<String, _>("published_by"), "publishedAt": r.get::<DateTime<Utc>, _>("published_at")})).collect::<Vec<_>>(),
        "realized": rv.iter().map(|r| json!({"estimator": r.get::<String, _>("estimator"), "windowBars": r.get::<i32, _>("window_bars"), "value": r.get::<f64, _>("value"),
            "bars": r.get::<i32, _>("bars"), "computedAt": r.get::<DateTime<Utc>, _>("computed_at")})).collect::<Vec<_>>(),
        "realizedUsed": rd.realized.get(&symbol),
    })))
}

pub async fn surface_version(State(st): State<AppState>, h: HeaderMap, Path((symbol, version)): Path<(String, i32)>) -> R {
    who(&h)?;
    let r = sqlx::query("SELECT version, blend_weight, pillars, reason, published_by, published_at FROM vol_surfaces WHERE symbol = $1 AND version = $2")
        .bind(symbol.to_ascii_uppercase())
        .bind(version)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Surface version"))?;
    Ok(Json(json!({"symbol": symbol.to_ascii_uppercase(), "version": r.get::<i32, _>("version"), "blendWeight": r.get::<f64, _>("blend_weight"),
        "pillars": r.get::<Value, _>("pillars"), "reason": r.get::<String, _>("reason"), "publishedBy": r.get::<String, _>("published_by"),
        "publishedAt": r.get::<DateTime<Utc>, _>("published_at")})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfacePost {
    pillars: Vec<Pillar>,
    blend_weight: Option<f64>,
    reason: Option<String>,
}

/// `POST /v1/admin/options/surfaces/{symbol} {pillars[{tenor, days, atm, rr25, bf25, rr10?, bf10?}], blendWeight?, reason}`
/// (platform): validates (positive wing vols, no calendar arbitrage) and publishes version + 1.
pub async fn surface_publish(State(st): State<AppState>, h: HeaderMap, Path(symbol): Path<String>, Json(p): Json<SurfacePost>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let reason = need_reason(&p.reason)?;
    let symbol = symbol.to_ascii_uppercase();
    let rd = st.refdata().await;
    rd.underlying(&symbol).ok_or_else(|| ApiError::not_found("Underlying"))?;
    if p.pillars.is_empty() || p.pillars.len() > 24 {
        return Err(ApiError::bad("Give 1 to 24 pillars."));
    }
    build_surface(&p.pillars).map_err(ApiError::bad)?;
    let blend = p.blend_weight.or_else(|| rd.surfaces.get(&symbol).map(|x| x.blend_weight)).unwrap_or(0.7);
    if !(0.0..=1.0).contains(&blend) {
        return Err(ApiError::bad("blendWeight must be between 0 and 1."));
    }
    let mut pillars = p.pillars.clone();
    pillars.sort_by(|a, b| a.days.total_cmp(&b.days));
    let mut tx = st.pool.begin().await?;
    let next: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) + 1 FROM vol_surfaces WHERE symbol = $1").bind(&symbol).fetch_one(&mut *tx).await?;
    sqlx::query("INSERT INTO vol_surfaces (symbol, version, blend_weight, pillars, reason, published_by) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(&symbol)
        .bind(next)
        .bind(blend)
        .bind(json!(pillars))
        .bind(&reason)
        .bind(&s.actor)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    let before = rd.surfaces.get(&symbol).map(|x| json!({"version": x.version, "blendWeight": x.blend_weight, "pillars": x.pillars}));
    store::audit(&mut tx, &s.tenant, &s.actor, "surface.publish", &symbol, before, Some(json!({"version": next, "blendWeight": blend, "pillars": pillars})), &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"symbol": symbol, "version": next, "snapshotVersion": v})))
}

/* ------------------------------------------------------------------ */
/* Tenants (module switches)                                           */
/* ------------------------------------------------------------------ */

/// `GET /v1/admin/options/tenants`: every broker for Kalks staff, the own row for a broker.
pub async fn tenants(State(st): State<AppState>, h: HeaderMap) -> R {
    let s = who(&h)?;
    let rd = st.refdata().await;
    let list: Vec<Value> = if s.platform() {
        let mut v: Vec<_> = rd.tenants.values().collect();
        v.sort_by(|a, b| a.tenant.cmp(&b.tenant));
        v.into_iter().map(|t| json!(t)).collect()
    } else {
        vec![json!(rd.tenant(&s.tenant))]
    };
    Ok(Json(json!({"tenants": list})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantPut {
    enabled_demo: Option<bool>,
    enabled_live: Option<bool>,
    public_chain: Option<bool>,
    /// Allowed underlyings; empty list = all.
    underlyings: Option<Vec<String>>,
    reason: Option<String>,
}

/// `PUT /v1/admin/options/tenants/{tenant} {enabledDemo?, enabledLive?, publicChain?, underlyings?, reason}`
/// (Kalks staff only: the Owner enables Options per broker).
pub async fn tenant_put(State(st): State<AppState>, h: HeaderMap, Path(t): Path<String>, Json(p): Json<TenantPut>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let reason = need_reason(&p.reason)?;
    let t = t.trim().to_ascii_lowercase();
    if !super::is_slug(&t) {
        return Err(ApiError::bad("Tenant must be a broker slug."));
    }
    let rd = st.refdata().await;
    let cur = rd.tenant(&t);
    let unders = match p.underlyings {
        Some(v) if v.is_empty() => None,
        Some(v) => {
            let v: Vec<String> = v.iter().map(|x| x.trim().to_ascii_uppercase()).collect();
            if let Some(bad) = v.iter().find(|x| rd.underlying(x).is_none()) {
                return Err(ApiError::bad(format!("Unknown underlying {bad}.")));
            }
            Some(v)
        }
        None => cur.underlyings.clone(),
    };
    let (demo, live, public) = (p.enabled_demo.unwrap_or(cur.enabled_demo), p.enabled_live.unwrap_or(cur.enabled_live), p.public_chain.unwrap_or(cur.public_chain));
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant, enabled_demo, enabled_live, public_chain, underlyings, updated_at, updated_by) VALUES ($1,$2,$3,$4,$5,now(),$6)
         ON CONFLICT (tenant) DO UPDATE SET enabled_demo = EXCLUDED.enabled_demo, enabled_live = EXCLUDED.enabled_live, public_chain = EXCLUDED.public_chain,
           underlyings = EXCLUDED.underlyings, updated_at = now(), updated_by = EXCLUDED.updated_by",
    )
    .bind(&t)
    .bind(demo)
    .bind(live)
    .bind(public)
    .bind(&unders)
    .bind(&s.actor)
    .execute(&mut *tx)
    .await?;
    if live && !cur.enabled_live {
        tracing::warn!(tenant = %t, by = %s.actor, "options enabled for LIVE accounts");
    }
    store::audit(&mut tx, &s.tenant, &s.actor, "tenant.update", &t, Some(json!(cur)), Some(json!({"enabledDemo": demo, "enabledLive": live, "publicChain": public, "underlyings": unders})), &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"tenant": st.refdata().await.tenant(&t), "version": v})))
}

/* ------------------------------------------------------------------ */
/* Group settings                                                      */
/* ------------------------------------------------------------------ */

pub async fn groups(State(st): State<AppState>, h: HeaderMap) -> R {
    let s = who(&h)?;
    let rd = st.refdata().await;
    let rows: Vec<&GroupSettings> = rd.groups.iter().filter(|g| g.tenant == s.tenant).collect();
    Ok(Json(json!({"groups": rows, "default": rd.group(&s.tenant, "*", "*")})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GroupPut {
    vol_spread: Option<f64>,
    min_spread_usd: Option<f64>,
    commission_per_contract: Option<f64>,
    commission_cap_pct: Option<f64>,
    max_contracts_per_client: Option<f64>,
    weekend_margin_pct: Option<f64>,
    enabled: Option<bool>,
    /// Order book (§7): USD per contract, negative = maker rebate.
    maker_fee_per_contract: Option<f64>,
    /// Order book (§7): USD per contract, ≥ 0.
    taker_fee_per_contract: Option<f64>,
    reason: Option<String>,
}

/// Label of a group row in messages.
fn row_label(g: &GroupSettings) -> String {
    format!("{} · {}", if g.group_code == "*" { "all groups" } else { &g.group_code }, if g.symbol == "*" { "all underlyings" } else { &g.symbol })
}

/// §7 over a broker's rows with `edited` in place (and the default it falls back to when it has no `*, *` row).
fn fee_check(rd: &crate::model::RefData, tenant: &str, edited: &GroupSettings) -> R<()> {
    let mut rows: Vec<GroupSettings> = rd.groups.iter().filter(|g| g.tenant == tenant && !(g.group_code == edited.group_code && g.symbol == edited.symbol)).cloned().collect();
    rows.push(edited.clone());
    if !rows.iter().any(|g| g.group_code == "*" && g.symbol == "*") {
        rows.push(rd.group(tenant, "*", "*"));
    }
    let eff: Vec<(String, f64, f64)> = rows.iter().map(|g| {
        let (m, t) = g.book_fees();
        (row_label(g), m, t)
    }).collect();
    match fee_rule_violation(&eff) {
        Some(msg) => Err(ApiError::bad(format!("Fees: {msg}"))),
        None => Ok(()),
    }
}

fn key_part(s: &str) -> R<String> {
    let s = s.trim();
    if s == "*" {
        return Ok("*".into());
    }
    if s.is_empty() || s.len() > 64 || !s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err(ApiError::bad("Group / symbol must be '*' or a code."));
    }
    Ok(s.into())
}

/// `PUT /v1/admin/options/groups/{group}/{symbol}` (`*` = any): spreads, fees and limits for this tenant.
/// A new row starts from the currently effective settings.
pub async fn group_put(State(st): State<AppState>, h: HeaderMap, Path((group, symbol)): Path<(String, String)>, Json(p): Json<GroupPut>) -> R {
    let s = who(&h)?;
    let (group, symbol) = (key_part(&group)?, key_part(&symbol)?.to_ascii_uppercase().replace("*", "*"));
    let rd = st.refdata().await;
    if symbol != "*" && rd.underlying(&symbol).is_none() {
        return Err(ApiError::bad("Unknown underlying."));
    }
    let cur = rd.groups.iter().find(|g| g.tenant == s.tenant && g.group_code == group && g.symbol == symbol).cloned();
    let base = cur.clone().unwrap_or_else(|| rd.group(&s.tenant, &group, if symbol == "*" { "" } else { &symbol }));
    let g = GroupSettings {
        tenant: s.tenant.clone(),
        group_code: group.clone(),
        symbol: symbol.clone(),
        vol_spread: p.vol_spread.unwrap_or(base.vol_spread),
        min_spread_usd: p.min_spread_usd.unwrap_or(base.min_spread_usd),
        commission_per_contract: p.commission_per_contract.unwrap_or(base.commission_per_contract),
        commission_cap_pct: p.commission_cap_pct.unwrap_or(base.commission_cap_pct),
        max_contracts_per_client: p.max_contracts_per_client.unwrap_or(base.max_contracts_per_client),
        weekend_margin_pct: p.weekend_margin_pct.unwrap_or(base.weekend_margin_pct),
        enabled: p.enabled.unwrap_or(base.enabled),
        updated_at: Utc::now(),
        updated_by: s.actor.clone(),
        maker_fee_per_contract: p.maker_fee_per_contract.or(base.maker_fee_per_contract),
        taker_fee_per_contract: p.taker_fee_per_contract.or(base.taker_fee_per_contract),
    };
    if let Some(m) = g.maker_fee_per_contract
        && !(m.is_finite() && (-1000.0..=1000.0).contains(&m))
    {
        return Err(ApiError::bad("makerFeePerContract must be between -1000 and 1000 USD per contract (negative = rebate)."));
    }
    if let Some(t) = g.taker_fee_per_contract
        && !(t.is_finite() && (0.0..=1000.0).contains(&t))
    {
        return Err(ApiError::bad("takerFeePerContract must be between 0 and 1000 USD per contract."));
    }
    fee_check(&rd, &s.tenant, &g)?;
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "INSERT INTO group_settings (tenant, group_code, symbol, vol_spread, min_spread_usd, commission_per_contract, commission_cap_pct,
            max_contracts_per_client, weekend_margin_pct, enabled, updated_at, updated_by, maker_fee_per_contract, taker_fee_per_contract)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12,$13)
         ON CONFLICT (tenant, group_code, symbol) DO UPDATE SET vol_spread = EXCLUDED.vol_spread, min_spread_usd = EXCLUDED.min_spread_usd,
            commission_per_contract = EXCLUDED.commission_per_contract, commission_cap_pct = EXCLUDED.commission_cap_pct,
            max_contracts_per_client = EXCLUDED.max_contracts_per_client, weekend_margin_pct = EXCLUDED.weekend_margin_pct, enabled = EXCLUDED.enabled,
            updated_at = now(), updated_by = EXCLUDED.updated_by, maker_fee_per_contract = EXCLUDED.maker_fee_per_contract,
            taker_fee_per_contract = EXCLUDED.taker_fee_per_contract",
    )
    .bind(&g.tenant)
    .bind(&g.group_code)
    .bind(&g.symbol)
    .bind(g.vol_spread)
    .bind(g.min_spread_usd)
    .bind(g.commission_per_contract)
    .bind(g.commission_cap_pct)
    .bind(g.max_contracts_per_client)
    .bind(g.weekend_margin_pct)
    .bind(g.enabled)
    .bind(&s.actor)
    .bind(g.maker_fee_per_contract)
    .bind(g.taker_fee_per_contract)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;
    store::audit(&mut tx, &s.tenant, &s.actor, "group.upsert", &format!("{group}/{symbol}"), cur.map(|c| json!(c)), Some(json!(g)), &opt_reason(&p.reason)).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"group": g, "version": v})))
}

pub async fn group_delete(State(st): State<AppState>, h: HeaderMap, Path((group, symbol)): Path<(String, String)>, Query(q): Query<ReasonQ>) -> R {
    let s = who(&h)?;
    let (group, symbol) = (key_part(&group)?, key_part(&symbol)?.to_ascii_uppercase());
    if group == "*" && symbol == "*" {
        return Err(ApiError::bad("The tenant default row can be edited but not deleted."));
    }
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query("DELETE FROM group_settings WHERE tenant = $1 AND group_code = $2 AND symbol = $3").bind(&s.tenant).bind(&group).bind(&symbol).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(ApiError::not_found("Group settings"));
    }
    store::audit(&mut tx, &s.tenant, &s.actor, "group.delete", &format!("{group}/{symbol}"), None, None, &opt_reason(&q.reason)).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"ok": true, "version": v})))
}

/* ------------------------------------------------------------------ */
/* Dealer controls                                                     */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
pub struct ControlsQ {
    all: Option<bool>,
}

/// `GET /v1/admin/options/controls?all=` (active only unless `all=true`): this tenant's and the platform-wide ones.
pub async fn controls(State(st): State<AppState>, h: HeaderMap, Query(q): Query<ControlsQ>) -> R {
    let s = who(&h)?;
    let rows = sqlx::query(
        "SELECT id, tenant, scope, target, mode, manual_vol, frozen_spot, reason, active, expires_at, created_by, created_at, cleared_by, cleared_at, clear_reason
           FROM controls WHERE ($1 OR tenant = $2 OR tenant = '*') AND ($3 OR (active AND (expires_at IS NULL OR expires_at > now()))) ORDER BY id DESC LIMIT 500",
    )
    .bind(s.platform())
    .bind(&s.tenant)
    .bind(q.all.unwrap_or(false))
    .fetch_all(&st.pool)
    .await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"id": r.get::<i64, _>("id"), "tenant": r.get::<String, _>("tenant"), "scope": r.get::<String, _>("scope"), "target": r.get::<String, _>("target"),
                   "mode": r.get::<String, _>("mode"), "manualVol": r.get::<Option<f64>, _>("manual_vol"), "frozenSpot": r.get::<Option<f64>, _>("frozen_spot"),
                   "reason": r.get::<String, _>("reason"), "active": r.get::<bool, _>("active"), "expiresAt": r.get::<Option<DateTime<Utc>>, _>("expires_at"),
                   "createdBy": r.get::<String, _>("created_by"), "createdAt": r.get::<DateTime<Utc>, _>("created_at"),
                   "clearedBy": r.get::<Option<String>, _>("cleared_by"), "clearedAt": r.get::<Option<DateTime<Utc>>, _>("cleared_at"),
                   "clearReason": r.get::<Option<String>, _>("clear_reason")})
        })
        .collect();
    Ok(Json(json!({"controls": list})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlPost {
    tenant: Option<String>,
    scope: String,
    target: Option<String>,
    mode: String,
    manual_vol: Option<f64>,
    frozen_spot: Option<f64>,
    expires_at: Option<DateTime<Utc>>,
    reason: Option<String>,
}

/// `POST /v1/admin/options/controls {tenant? ('*' Kalks only), scope, target, mode, manualVol?, frozenSpot?, expiresAt?, reason}`.
/// A freeze without `frozenSpot` freezes at the current mid.
pub async fn control_add(State(st): State<AppState>, h: HeaderMap, Json(p): Json<ControlPost>) -> R {
    let s = who(&h)?;
    let reason = need_reason(&p.reason)?;
    let t = p.tenant.as_deref().map(|x| x.trim().to_ascii_lowercase()).unwrap_or_else(|| s.tenant.clone());
    if t != s.tenant && !s.platform() {
        return Err(ApiError::forbidden("Brokers can only set controls for themselves."));
    }
    if t != "*" && !super::is_slug(&t) {
        return Err(ApiError::bad("Tenant must be '*' or a broker slug."));
    }
    let rd = st.refdata().await;
    let scope = p.scope.trim().to_ascii_lowercase();
    let mode = p.mode.trim().to_ascii_lowercase();
    let target = p.target.as_deref().map(str::trim).unwrap_or("*").to_string();
    let symbol = match scope.as_str() {
        "all" => {
            if target != "*" {
                return Err(ApiError::bad("scope 'all' takes target '*'."));
            }
            None
        }
        "underlying" => Some(rd.underlying(&target).ok_or_else(|| ApiError::bad("Unknown underlying."))?.symbol.clone()),
        "expiry" => {
            let (sym, d) = target.split_once(':').ok_or_else(|| ApiError::bad("Expiry target is SYMBOL:YYYY-MM-DD."))?;
            let e = rd.expiry(&sym.to_ascii_uppercase(), parse_day(d)?).ok_or_else(|| ApiError::bad("Unknown expiry."))?;
            Some(e.symbol.clone())
        }
        "series" => Some(rd.series.iter().find(|x| x.code == target).ok_or_else(|| ApiError::bad("Unknown series."))?.symbol.clone()),
        _ => return Err(ApiError::bad("scope must be all, underlying, expiry or series.")),
    };
    let target = match scope.as_str() {
        "underlying" => symbol.clone().unwrap_or_default(),
        "expiry" => target.to_ascii_uppercase(),
        _ => target,
    };
    let (mut manual_vol, mut frozen) = (None, None);
    match mode.as_str() {
        "halt" | "close_only" => {}
        "manual_vol" => {
            if scope == "all" || scope == "series" {
                return Err(ApiError::bad("manual_vol applies to an underlying or an expiry."));
            }
            manual_vol = Some(p.manual_vol.filter(|v| *v > 0.001 && *v < 5.0).ok_or_else(|| ApiError::bad("manualVol is a decimal ATM vol (0.09 = 9%)."))?);
        }
        "freeze" => {
            if scope == "all" || scope == "series" {
                return Err(ApiError::bad("freeze applies to an underlying or an expiry."));
            }
            let sym = symbol.clone().unwrap_or_default();
            frozen = match p.frozen_spot {
                Some(x) if x > 0.0 => Some(x),
                Some(_) => return Err(ApiError::bad("frozenSpot must be positive.")),
                None => Some(st.spots.get(&sym).await.map(|x| x.mid).ok_or_else(|| ApiError::bad("No live price to freeze at; give frozenSpot."))?),
            };
        }
        _ => return Err(ApiError::bad("mode must be halt, close_only, freeze or manual_vol.")),
    }
    if p.expires_at.is_some_and(|e| e <= Utc::now()) {
        return Err(ApiError::bad("expiresAt must be in the future."));
    }
    let mut tx = st.pool.begin().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO controls (tenant, scope, target, mode, manual_vol, frozen_spot, reason, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    )
    .bind(&t)
    .bind(&scope)
    .bind(&target)
    .bind(&mode)
    .bind(manual_vol)
    .bind(frozen)
    .bind(&reason)
    .bind(p.expires_at)
    .bind(&s.actor)
    .fetch_one(&mut *tx)
    .await
    .map_err(db_err)?;
    let after = json!({"id": id, "tenant": t, "scope": scope, "target": target, "mode": mode, "manualVol": manual_vol, "frozenSpot": frozen, "expiresAt": p.expires_at});
    store::audit(&mut tx, &s.tenant, &s.actor, "control.add", &format!("{scope}:{target}"), None, Some(after.clone()), &reason).await?;
    let v = finish(&st, tx).await?;
    tracing::warn!(id, tenant = %t, %scope, %target, %mode, by = %s.actor, "dealer control set");
    Ok(Json(json!({"control": after, "version": v})))
}

/// `DELETE /v1/admin/options/controls/{id}?reason=`.
pub async fn control_clear(State(st): State<AppState>, h: HeaderMap, Path(id): Path<i64>, Query(q): Query<ReasonQ>) -> R {
    let s = who(&h)?;
    let reason = need_reason(&q.reason)?;
    let mut tx = st.pool.begin().await?;
    let row = sqlx::query("SELECT tenant FROM controls WHERE id = $1 AND active").bind(id).fetch_optional(&mut *tx).await?.ok_or_else(|| ApiError::not_found("Active control"))?;
    let t: String = row.get("tenant");
    if t != s.tenant && !s.platform() {
        return Err(ApiError::forbidden("This control belongs to Kalks or another broker."));
    }
    sqlx::query("UPDATE controls SET active = false, cleared_by = $2, cleared_at = now(), clear_reason = $3 WHERE id = $1").bind(id).bind(&s.actor).bind(&reason).execute(&mut *tx).await?;
    store::audit(&mut tx, &s.tenant, &s.actor, "control.clear", &id.to_string(), None, None, &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"ok": true, "version": v})))
}

/* ------------------------------------------------------------------ */
/* Client limits                                                       */
/* ------------------------------------------------------------------ */

pub async fn limits(State(st): State<AppState>, h: HeaderMap) -> R {
    let s = who(&h)?;
    let rd = st.refdata().await;
    Ok(Json(json!({"limits": rd.limits.iter().filter(|l| l.tenant == s.tenant).collect::<Vec<_>>()})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LimitPut {
    max_contracts: Option<f64>,
    max_short_contracts: Option<f64>,
    close_only: Option<bool>,
    blocked: Option<bool>,
    reason: Option<String>,
}

/// `PUT /v1/admin/options/limits/{userId} {maxContracts?, maxShortContracts?, closeOnly?, blocked?, reason}`.
pub async fn limit_put(State(st): State<AppState>, h: HeaderMap, Path(user): Path<i64>, Json(p): Json<LimitPut>) -> R {
    let s = who(&h)?;
    let reason = need_reason(&p.reason)?;
    if user <= 0 {
        return Err(ApiError::bad("Unknown client."));
    }
    let rd = st.refdata().await;
    let cur = rd.limits.iter().find(|l| l.tenant == s.tenant && l.user_id == user).cloned();
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "INSERT INTO client_limits (tenant, user_id, max_contracts, max_short_contracts, close_only, blocked, reason, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8)
         ON CONFLICT (tenant, user_id) DO UPDATE SET max_contracts = EXCLUDED.max_contracts, max_short_contracts = EXCLUDED.max_short_contracts,
           close_only = EXCLUDED.close_only, blocked = EXCLUDED.blocked, reason = EXCLUDED.reason, updated_at = now(), updated_by = EXCLUDED.updated_by",
    )
    .bind(&s.tenant)
    .bind(user)
    .bind(p.max_contracts.or(cur.as_ref().and_then(|c| c.max_contracts)))
    .bind(p.max_short_contracts.or(cur.as_ref().and_then(|c| c.max_short_contracts)))
    .bind(p.close_only.or(cur.as_ref().map(|c| c.close_only)).unwrap_or(false))
    .bind(p.blocked.or(cur.as_ref().map(|c| c.blocked)).unwrap_or(false))
    .bind(&reason)
    .bind(&s.actor)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;
    store::audit(&mut tx, &s.tenant, &s.actor, "limit.upsert", &user.to_string(), cur.map(|c| json!(c)), None, &reason).await?;
    let v = finish(&st, tx).await?;
    let rd = st.refdata().await;
    Ok(Json(json!({"limit": rd.limits.iter().find(|l| l.tenant == s.tenant && l.user_id == user), "version": v})))
}

pub async fn limit_delete(State(st): State<AppState>, h: HeaderMap, Path(user): Path<i64>, Query(q): Query<ReasonQ>) -> R {
    let s = who(&h)?;
    let reason = need_reason(&q.reason)?;
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query("DELETE FROM client_limits WHERE tenant = $1 AND user_id = $2").bind(&s.tenant).bind(user).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(ApiError::not_found("Client limit"));
    }
    store::audit(&mut tx, &s.tenant, &s.actor, "limit.delete", &user.to_string(), None, None, &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"ok": true, "version": v})))
}

/* ------------------------------------------------------------------ */
/* Kalks market maker settings (docs/OPTIONS-EXCHANGE.md §4)           */
/* ------------------------------------------------------------------ */

/// `GET /v1/admin/options/mm-settings` -> `{settings[], defaults}`: every row for Kalks staff; the platform (`*`) rows
/// and the broker's own rows for a broker.
pub async fn mm_settings(State(st): State<AppState>, h: HeaderMap) -> R {
    let s = who(&h)?;
    let rd = st.refdata().await;
    let rows: Vec<&MmSettings> = rd.mm.iter().filter(|r| s.platform() || r.tenant == "*" || r.tenant == s.tenant).collect();
    Ok(Json(json!({"settings": rows, "defaults": MmSettings::builtin()})))
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MmPut {
    enabled: Option<bool>,
    #[serde(rename = "spreadVol0dte")]
    spread_vol_0dte: Option<f64>,
    #[serde(rename = "spreadVol7d")]
    spread_vol_7d: Option<f64>,
    #[serde(rename = "spreadVol30d")]
    spread_vol_30d: Option<f64>,
    spread_vol_long: Option<f64>,
    min_spread_ticks: Option<f64>,
    skew_vol: Option<f64>,
    skew_ticks_per_contract: Option<f64>,
    base_size: Option<f64>,
    max_net_delta: Option<f64>,
    max_gamma: Option<f64>,
    max_vega: Option<f64>,
    max_contracts_per_series: Option<f64>,
    reason: Option<String>,
}

/// The `(tenant, kind, underlying)` key of an `mm_settings` row (`*` = any), checked against the caller.
fn mm_key(s: &Staff, rd: &crate::model::RefData, tenant: &str, kind: &str, underlying: &str) -> R<(String, String, String)> {
    let t = tenant.trim().to_ascii_lowercase();
    if t != "*" && !super::is_slug(&t) {
        return Err(ApiError::bad("Tenant must be '*' or a broker slug."));
    }
    let k = kind.trim().to_ascii_lowercase();
    if !matches!(k.as_str(), "*" | "live" | "demo") {
        return Err(ApiError::bad("Kind must be live, demo or '*'."));
    }
    let u = underlying.trim().to_ascii_uppercase();
    if u != "*" && rd.underlying(&u).is_none() {
        return Err(ApiError::bad("Unknown underlying."));
    }
    if !s.platform() && t != s.tenant {
        return Err(ApiError::forbidden("The market maker is Kalks's: a broker only tunes its own rows."));
    }
    Ok((t, k, u))
}

/// Range checks of an `mm_settings` row.
pub fn validate_mm(m: &MmSettings) -> Result<(), String> {
    for (name, v) in [("spreadVol0dte", m.spread_vol_0dte), ("spreadVol7d", m.spread_vol_7d), ("spreadVol30d", m.spread_vol_30d), ("spreadVolLong", m.spread_vol_long)] {
        if !(v.is_finite() && (0.0..=0.2).contains(&v)) {
            return Err(format!("{name} is a decimal vol between 0 and 0.2 (0.004 = 0.40 vol points)."));
        }
    }
    if !(1..=100_000).contains(&m.min_spread_ticks) {
        return Err("minSpreadTicks must be a whole number of ticks, at least 1.".into());
    }
    if !(m.skew_vol.is_finite() && (0.0..=0.2).contains(&m.skew_vol)) {
        return Err("skewVol is a decimal vol between 0 and 0.2.".into());
    }
    if !(m.skew_ticks_per_contract.is_finite() && (0.0..=1000.0).contains(&m.skew_ticks_per_contract)) {
        return Err("skewTicksPerContract must be between 0 and 1000.".into());
    }
    if !(m.base_size.is_finite() && m.base_size >= 1.0 && m.base_size <= 1_000_000.0 && m.base_size.fract() == 0.0) {
        return Err("baseSize must be a whole number of contracts, at least 1.".into());
    }
    for (name, v) in [("maxNetDelta", m.max_net_delta), ("maxGamma", m.max_gamma), ("maxVega", m.max_vega), ("maxContractsPerSeries", m.max_contracts_per_series)] {
        if !(v.is_finite() && v > 0.0) {
            return Err(format!("{name} must be above 0."));
        }
    }
    Ok(())
}

/// `PUT /v1/admin/options/mm-settings/{tenant}/{kind}/{underlying} {…fields, enabled?, reason}`: upsert one row; a new
/// row starts from the settings that apply to that key today. Kalks staff any row, a broker only its own.
pub async fn mm_put(State(st): State<AppState>, h: HeaderMap, Path((tenant, kind, underlying)): Path<(String, String, String)>, Json(p): Json<MmPut>) -> R {
    let s = who(&h)?;
    let reason = need_reason(&p.reason)?;
    let rd = st.refdata().await;
    let (t, k, u) = mm_key(&s, &rd, &tenant, &kind, &underlying)?;
    let cur = rd.mm.iter().find(|r| r.tenant == t && r.kind == k && r.underlying == u).cloned();
    let base = cur.clone().unwrap_or_else(|| rd.mm_for(&t, if k == "*" { "live" } else { &k }, &u));
    let ticks = match p.min_spread_ticks {
        Some(x) if !(x.is_finite() && x.fract() == 0.0 && (1.0..=100_000.0).contains(&x)) => return Err(ApiError::bad("minSpreadTicks must be a whole number of ticks, at least 1.")),
        Some(x) => x as i32,
        None => base.min_spread_ticks,
    };
    let m = MmSettings {
        tenant: t.clone(),
        kind: k.clone(),
        underlying: u.clone(),
        enabled: p.enabled.unwrap_or(base.enabled),
        spread_vol_0dte: p.spread_vol_0dte.unwrap_or(base.spread_vol_0dte),
        spread_vol_7d: p.spread_vol_7d.unwrap_or(base.spread_vol_7d),
        spread_vol_30d: p.spread_vol_30d.unwrap_or(base.spread_vol_30d),
        spread_vol_long: p.spread_vol_long.unwrap_or(base.spread_vol_long),
        min_spread_ticks: ticks,
        skew_vol: p.skew_vol.unwrap_or(base.skew_vol),
        skew_ticks_per_contract: p.skew_ticks_per_contract.unwrap_or(base.skew_ticks_per_contract),
        base_size: p.base_size.unwrap_or(base.base_size),
        max_net_delta: p.max_net_delta.unwrap_or(base.max_net_delta),
        max_gamma: p.max_gamma.unwrap_or(base.max_gamma),
        max_vega: p.max_vega.unwrap_or(base.max_vega),
        max_contracts_per_series: p.max_contracts_per_series.unwrap_or(base.max_contracts_per_series),
        updated_at: Utc::now(),
        updated_by: s.actor.clone(),
    };
    validate_mm(&m).map_err(ApiError::bad)?;
    let mut tx = st.pool.begin().await?;
    sqlx::query(
        "INSERT INTO mm_settings (tenant, kind, underlying, enabled, spread_vol_0dte, spread_vol_7d, spread_vol_30d, spread_vol_long, min_spread_ticks,
            skew_vol, skew_ticks_per_contract, base_size, max_net_delta, max_gamma, max_vega, max_contracts_per_series, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now(),$17)
         ON CONFLICT (tenant, kind, underlying) DO UPDATE SET enabled = EXCLUDED.enabled, spread_vol_0dte = EXCLUDED.spread_vol_0dte,
            spread_vol_7d = EXCLUDED.spread_vol_7d, spread_vol_30d = EXCLUDED.spread_vol_30d, spread_vol_long = EXCLUDED.spread_vol_long,
            min_spread_ticks = EXCLUDED.min_spread_ticks, skew_vol = EXCLUDED.skew_vol, skew_ticks_per_contract = EXCLUDED.skew_ticks_per_contract,
            base_size = EXCLUDED.base_size, max_net_delta = EXCLUDED.max_net_delta, max_gamma = EXCLUDED.max_gamma, max_vega = EXCLUDED.max_vega,
            max_contracts_per_series = EXCLUDED.max_contracts_per_series, updated_at = now(), updated_by = EXCLUDED.updated_by",
    )
    .bind(&m.tenant)
    .bind(&m.kind)
    .bind(&m.underlying)
    .bind(m.enabled)
    .bind(m.spread_vol_0dte)
    .bind(m.spread_vol_7d)
    .bind(m.spread_vol_30d)
    .bind(m.spread_vol_long)
    .bind(m.min_spread_ticks)
    .bind(m.skew_vol)
    .bind(m.skew_ticks_per_contract)
    .bind(m.base_size)
    .bind(m.max_net_delta)
    .bind(m.max_gamma)
    .bind(m.max_vega)
    .bind(m.max_contracts_per_series)
    .bind(&s.actor)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;
    store::audit(&mut tx, &s.tenant, &s.actor, "mm_settings.upsert", &format!("{t}/{k}/{u}"), cur.map(|c| json!(c)), Some(json!(m)), &reason).await?;
    let v = finish(&st, tx).await?;
    let rd = st.refdata().await;
    Ok(Json(json!({"settings": rd.mm.iter().find(|r| r.tenant == t && r.kind == k && r.underlying == u), "version": v})))
}

/// `DELETE /v1/admin/options/mm-settings/{tenant}/{kind}/{underlying}?reason=` (the `*, *, *` default stays).
pub async fn mm_delete(State(st): State<AppState>, h: HeaderMap, Path((tenant, kind, underlying)): Path<(String, String, String)>, Query(q): Query<ReasonQ>) -> R {
    let s = who(&h)?;
    let reason = need_reason(&q.reason)?;
    let rd = st.refdata().await;
    let (t, k, u) = mm_key(&s, &rd, &tenant, &kind, &underlying)?;
    if t == "*" && k == "*" && u == "*" {
        return Err(ApiError::bad("The default row (*, *, *) can be edited but not deleted."));
    }
    let before = rd.mm.iter().find(|r| r.tenant == t && r.kind == k && r.underlying == u).cloned();
    let mut tx = st.pool.begin().await?;
    let n = sqlx::query("DELETE FROM mm_settings WHERE tenant = $1 AND kind = $2 AND underlying = $3").bind(&t).bind(&k).bind(&u).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(ApiError::not_found("Market-maker settings"));
    }
    store::audit(&mut tx, &s.tenant, &s.actor, "mm_settings.delete", &format!("{t}/{k}/{u}"), before.map(|b| json!(b)), None, &reason).await?;
    let v = finish(&st, tx).await?;
    Ok(Json(json!({"ok": true, "version": v})))
}

/* ------------------------------------------------------------------ */
/* Expiries, fixings, listing                                          */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
pub struct ExpQ {
    u: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

/// `GET /v1/admin/options/expiries?u=&status=&limit=` (settlement monitor).
pub async fn expiries(State(st): State<AppState>, h: HeaderMap, Query(q): Query<ExpQ>) -> R {
    who(&h)?;
    let rows = sqlx::query(
        "SELECT e.id, e.symbol, e.expiry_date, e.kinds, e.cut_at, e.twap_start, e.status, e.fixing, e.fixing_source, e.fixing_run, e.fixing_samples,
                e.fixing_expected, e.fixing_coverage, e.fixing_max_gap_ms, e.fixed_at, e.fixing_error,
                (SELECT count(*) FROM series s WHERE s.expiry_id = e.id) AS series,
                (SELECT count(*) FROM twap_samples t WHERE t.expiry_id = e.id) AS samples_so_far
           FROM expiries e WHERE ($1::text IS NULL OR e.symbol = $1) AND ($2::text IS NULL OR e.status = $2)
          ORDER BY e.cut_at DESC LIMIT $3",
    )
    .bind(q.u.as_ref().map(|s| s.to_ascii_uppercase()))
    .bind(q.status.as_deref())
    .bind(q.limit.unwrap_or(200).clamp(1, 1000))
    .fetch_all(&st.pool)
    .await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"id": r.get::<i64, _>("id"), "symbol": r.get::<String, _>("symbol"), "date": r.get::<NaiveDate, _>("expiry_date"),
                   "kinds": r.get::<Vec<String>, _>("kinds"), "cutAt": r.get::<DateTime<Utc>, _>("cut_at"), "twapStart": r.get::<DateTime<Utc>, _>("twap_start"),
                   "status": r.get::<String, _>("status"), "fixing": r.get::<Option<f64>, _>("fixing"), "source": r.get::<Option<String>, _>("fixing_source"),
                   "run": r.get::<i32, _>("fixing_run"), "samples": r.get::<Option<i32>, _>("fixing_samples"), "expected": r.get::<Option<i32>, _>("fixing_expected"),
                   "coverage": r.get::<Option<f64>, _>("fixing_coverage"), "maxGapMs": r.get::<Option<i64>, _>("fixing_max_gap_ms"),
                   "fixedAt": r.get::<Option<DateTime<Utc>>, _>("fixed_at"), "error": r.get::<Option<String>, _>("fixing_error"),
                   "series": r.get::<i64, _>("series"), "samplesSoFar": r.get::<i64, _>("samples_so_far")})
        })
        .collect();
    Ok(Json(json!({"expiries": list})))
}

#[derive(Deserialize)]
pub struct RefixPost {
    /// Manual fixing price; omitted = recompute from the stored samples / M1 candles.
    price: Option<f64>,
    reason: Option<String>,
}

/// Re-fixing is allowed this long after the first fixing (O39).
pub const REFIX_WINDOW_MINUTES: i64 = 60;

/// `POST /v1/admin/options/expiries/{id}/refix {price?, reason}` (Kalks, within 1 h of the first fixing).
pub async fn refix(State(st): State<AppState>, h: HeaderMap, Path(id): Path<i64>, Json(p): Json<RefixPost>) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let reason = need_reason(&p.reason)?;
    let r = sqlx::query("SELECT symbol, status, cut_at, twap_start, fixing_run, fixing FROM expiries WHERE id = $1")
        .bind(id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Expiry"))?;
    let (symbol, status, cut_at, start, run, prev): (String, String, DateTime<Utc>, DateTime<Utc>, i32, Option<f64>) =
        (r.get("symbol"), r.get("status"), r.get("cut_at"), r.get("twap_start"), r.get("fixing_run"), r.get("fixing"));
    if status != "fixed" {
        return Err(ApiError::bad("Only a fixed expiry can be re-fixed."));
    }
    let first: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT min(created_at) FROM fixings WHERE expiry_id = $1").bind(id).fetch_one(&st.pool).await?;
    if first.is_some_and(|f| Utc::now() - f > chrono::Duration::minutes(REFIX_WINDOW_MINUTES)) {
        return Err(ApiError::bad("The re-fixing window (1 hour after the first fixing) has closed."));
    }
    match p.price {
        Some(px) => {
            if !(px.is_finite() && px > 0.0) {
                return Err(ApiError::bad("price must be positive."));
            }
            let mut tx = st.pool.begin().await?;
            sqlx::query(
                "INSERT INTO fixings (expiry_id, run, price, source, samples, expected, coverage, max_gap_ms, window_start, window_end, reason, created_by)
                 VALUES ($1,$2,$3,'manual',0,0,0,0,$4,$5,$6,$7)",
            )
            .bind(id)
            .bind(run + 1)
            .bind(px)
            .bind(start)
            .bind(cut_at)
            .bind(&reason)
            .bind(&s.actor)
            .execute(&mut *tx)
            .await?;
            sqlx::query("UPDATE expiries SET fixing = $2, fixing_source = 'manual', fixing_run = $3, fixed_at = now() WHERE id = $1").bind(id).bind(px).bind(run + 1).execute(&mut *tx).await?;
            store::audit(&mut tx, &s.tenant, &s.actor, "fixing.manual", &format!("{symbol}:{}", cut_at.date_naive()), Some(json!({"price": prev, "run": run})), Some(json!({"price": px, "run": run + 1})), &reason).await?;
            finish(&st, tx).await?;
        }
        None => {
            if !jobs::fix_expiry(&st, id, &symbol, start, cut_at, run + 1, &s.actor, &reason).await? {
                return Err(ApiError::bad("Not enough data to recompute the fixing."));
            }
            st.reload(true).await?;
        }
    }
    let rd = st.refdata().await;
    Ok(Json(json!({"expiry": rd.expiries.iter().find(|e| e.id == id)})))
}

/// `POST /v1/admin/options/listing/run` (Kalks): runs the listing job now.
pub async fn listing_run(State(st): State<AppState>, h: HeaderMap) -> R {
    let s = who(&h)?;
    s.require_platform()?;
    let rep = jobs::list_series(&st).await?;
    Ok(Json(json!({"report": rep, "version": st.refdata().await.version})))
}

#[derive(Deserialize)]
pub struct AuditQ {
    limit: Option<i64>,
    before: Option<i64>,
    all: Option<bool>,
}

/// `GET /v1/admin/options/audit?limit=&before=&all=` (`all` = every tenant, Kalks only).
pub async fn audit(State(st): State<AppState>, h: HeaderMap, Query(q): Query<AuditQ>) -> R {
    let s = who(&h)?;
    let all = q.all.unwrap_or(false) && s.platform();
    let rows = sqlx::query(
        "SELECT id, tenant, actor, action, target, before, after, reason, at FROM audit_log
          WHERE ($1 OR tenant = $2) AND ($3::bigint IS NULL OR id < $3) ORDER BY id DESC LIMIT $4",
    )
    .bind(all)
    .bind(&s.tenant)
    .bind(q.before)
    .bind(q.limit.unwrap_or(100).clamp(1, 500))
    .fetch_all(&st.pool)
    .await?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({"id": r.get::<i64, _>("id"), "tenant": r.get::<String, _>("tenant"), "actor": r.get::<String, _>("actor"), "action": r.get::<String, _>("action"),
                   "target": r.get::<String, _>("target"), "before": r.get::<Option<Value>, _>("before"), "after": r.get::<Option<Value>, _>("after"),
                   "reason": r.get::<String, _>("reason"), "at": r.get::<DateTime<Utc>, _>("at")})
        })
        .collect();
    let next = list.last().and_then(|x| x["id"].as_i64());
    Ok(Json(json!({"audit": list, "next": next})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mm_ranges() {
        let ok = MmSettings::builtin();
        assert_eq!(validate_mm(&ok), Ok(()));
        assert!(validate_mm(&MmSettings { spread_vol_7d: 0.5, ..ok.clone() }).unwrap_err().contains("spreadVol7d"));
        assert!(validate_mm(&MmSettings { base_size: 2.5, ..ok.clone() }).unwrap_err().contains("baseSize"));
        assert!(validate_mm(&MmSettings { min_spread_ticks: 0, ..ok.clone() }).unwrap_err().contains("minSpreadTicks"));
        assert!(validate_mm(&MmSettings { max_vega: 0.0, ..ok.clone() }).unwrap_err().contains("maxVega"));
    }
}

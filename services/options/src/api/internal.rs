//! Engine-facing routes: the versioned snapshot, fixings and service status.

use std::sync::Arc;

use axum::Json;
use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::{ApiError, R};
use crate::AppState;
use crate::model::RefData;

/// Pricing conventions the engine must follow to reproduce our numbers (also in the README).
fn conventions() -> Value {
    json!({
        "time": "tCal = ACT/365 from now to cutAt (carry and discounting); tVol = optmath VolClock(weekendVolWeight, holidayVolWeight).vol_years(now, cutAt, union of the holidays of calendarCodes); price with optmath::price(kind, S, K, tCal, r, b, effective_vol(sigma, tVol, tCal))",
        "rates": "gk: r = rates[quoteCcy], b = rates[quoteCcy] - rates[baseCcy]; bs: same with rates[baseCcy] = lease rate q; black76: r = rates[quoteCcy], b = 0 and S = the underlying mid as the forward. Rates are annual decimals used as continuous rates.",
        "vol": "quotes = VolSurface(pillars with t = days/365).quotes_at(tCal); atm = blendWeight * quotes.atm + (1 - blendWeight) * realizedVol (surface only when there is no realized vol); a manual_vol control replaces atm; smile = Smile::new(quotes, S, tVol, r', r' - b', deltaConvention) with (r', b') = rates_in_vol_time(r, b, tCal, tVol); sigma(K) = smile.vol_at_strike(K)",
        "spread": "bid at sigma - volSpread (floored at max(0.25 sigma, 0.001)), ask at sigma + volSpread; if ask - bid < minSpreadUsd / (contractSize * usdPerQuote) both sides are set to mark -/+ half of it; bid floored at 0",
        "groupResolution": "group_settings for the tenant: (group, symbol) > (group, *) > (*, symbol) > (*, *) > tenant kalks (*, *)",
        "commission": "min(commissionPerContract * contracts, commissionCapPct / 100 * premiumUsd)",
        "tradeState": "closed from cutAt - closeOnlyMinutes; close_only from cutAt - noOpenMinutes or a close_only control; halted by a halt control; controls match tenant or '*', scope all / underlying (symbol) / expiry ('SYMBOL:YYYY-MM-DD') / series (code)",
        "moduleSwitch": "tenants[].enabledDemo / enabledLive gate demo / live accounts; a tenant without a row is OFF",
        "scenarioMargin": "optmath::scenario::scenario_grid with ScanParams { price_range: priceScan, vol_range: volScan, extreme_multiple, extreme_cover, dt = one business day }",
        "settlement": "expiries[].fixing (status fixed) is the settlement price; fixings re-run only via the Back Office within the window (fixingRun increments)",
        "orderBook": "per underlying: premiumTick (quote currency per unit), marketBandPct / limitBandPct (percent of the mark) + bandMinTicks, minContracts / contractStep / maxContracts per order, liqBandPct / liqFeePct (percent), rfqQuoteTtlSecs; barriers are RFQ only, Kalks-quoted (not on the book)",
        "mark": "mark = optmath::mark::clamp_mark(model mid, model ask - model bid, best bid, best ask, markMinQty, markMaxSpreadMult): clamp(model, bid, ask) when both sides hold >= markMinQty contracts and the book spread <= markMaxSpreadMult x the model spread; one side only: max(model, bid) / min(model, ask); otherwise the model mid",
        "bookFees": "groups[].makerFeePerContract (negative = rebate) / takerFeePerContract in USD per contract (null = commissionPerContract); fee = sign x min(|rate| x contracts, commissionCapPct / 100 x premiumUsd); admin rule over a broker's rows: min(taker) >= max(|maker rebate|)",
        "marketMaker": "mm[]: the most specific row for (tenant, kind, underlying) wins (tenant 4, kind 2, underlying 1; '*' matches any); spreadVol0dte / 7d / 30d / Long are decimal vols each side of the smile vol per tenor bucket; minSpreadTicks; skewVol; skewTicksPerContract; baseSize contracts; maxNetDelta (delta-weighted contracts), maxGamma (contract-delta per 1 % spot), maxVega (USD per vol point), maxContractsPerSeries; enabled",
    })
}

pub fn build_snapshot(rd: &RefData, stale_after: u64) -> Value {
    let holidays: serde_json::Map<String, Value> =
        rd.holidays.iter().map(|(cal, days)| (cal.clone(), json!(days.iter().map(|h| h.day).collect::<Vec<NaiveDate>>()))).collect();
    let underlyings: Vec<Value> = rd
        .underlyings
        .iter()
        .map(|u| {
            let mut v = json!(u);
            v["calendarCodes"] = json!(u.calendar_codes());
            v
        })
        .collect();
    json!({
        "version": rd.version,
        "generatedAt": Utc::now(),
        "loadedAt": rd.loaded_at,
        "staleAfterSecs": stale_after,
        "conventions": conventions(),
        "underlyings": underlyings,
        "rates": rd.rates.values().collect::<Vec<_>>(),
        "holidays": holidays,
        "surfaces": rd.surfaces.values().collect::<Vec<_>>(),
        "realizedVol": rd.realized.values().collect::<Vec<_>>(),
        "expiries": rd.expiries,
        "series": rd.series,
        "tenants": rd.tenants.values().collect::<Vec<_>>(),
        "groups": rd.groups,
        "controls": rd.controls,
        "clientLimits": rd.limits,
        "mm": rd.mm,
    })
}

/// `GET /v1/internal/options/snapshot` with ETag `"opt-<version>"`; `If-None-Match` -> 304.
pub async fn snapshot(State(st): State<AppState>, h: HeaderMap) -> Result<Response, ApiError> {
    let rd = st.refdata().await;
    let etag = format!("\"opt-{}\"", rd.version);
    if h.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()).is_some_and(|v| v.split(',').any(|x| x.trim() == etag)) {
        return Ok((StatusCode::NOT_MODIFIED, [(header::ETAG, etag)]).into_response());
    }
    let cached = st.snapshot_cache.lock().unwrap().as_ref().filter(|(v, _)| *v == rd.version).map(|(_, b)| b.clone());
    let bytes = match cached {
        Some(b) => b,
        None => {
            let b = Arc::new(serde_json::to_vec(&build_snapshot(&rd, st.cfg.snapshot_stale_secs)).map_err(anyhow::Error::from)?);
            *st.snapshot_cache.lock().unwrap() = Some((rd.version, b.clone()));
            b
        }
    };
    let mut res = Response::new(Body::from((*bytes).clone()));
    res.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    res.headers_mut().insert(header::ETAG, HeaderValue::from_str(&etag).unwrap());
    res.headers_mut().insert("x-options-version", HeaderValue::from(rd.version));
    Ok(res)
}

#[derive(Deserialize)]
pub struct FixQ {
    expiry: Option<String>,
    u: Option<String>,
}

/// `GET /v1/internal/options/fixings?expiry=YYYY-MM-DD&u=` -> `{fixings[{expiryId, symbol, date, cutAt, status, fixing, runs[]}]}`.
pub async fn fixings(State(st): State<AppState>, Query(q): Query<FixQ>) -> R {
    let date = match q.expiry.as_deref() {
        Some(s) => Some(NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| ApiError::bad("expiry must be YYYY-MM-DD."))?),
        None => None,
    };
    if date.is_none() && q.u.is_none() {
        return Err(ApiError::bad("Give expiry and/or u."));
    }
    let rows = sqlx::query(
        "SELECT e.id, e.symbol, e.expiry_date, e.cut_at, e.twap_start, e.status, e.fixing, e.fixing_source, e.fixing_run, e.fixing_samples,
                e.fixing_expected, e.fixing_coverage, e.fixing_max_gap_ms, e.fixed_at, e.fixing_error
           FROM expiries e WHERE ($1::date IS NULL OR e.expiry_date = $1) AND ($2::text IS NULL OR e.symbol = $2)
          ORDER BY e.expiry_date DESC, e.symbol LIMIT 500",
    )
    .bind(date)
    .bind(q.u.as_ref().map(|s| s.to_ascii_uppercase()))
    .fetch_all(&st.pool)
    .await?;
    let ids: Vec<i64> = rows.iter().map(|r| r.get("id")).collect();
    let runs = sqlx::query(
        "SELECT expiry_id, run, price, source, samples, expected, coverage, max_gap_ms, window_start, window_end, reason, created_by, created_at
           FROM fixings WHERE expiry_id = ANY($1) ORDER BY expiry_id, run",
    )
    .bind(&ids)
    .fetch_all(&st.pool)
    .await?;
    let out: Vec<Value> = rows
        .iter()
        .map(|r| {
            let id: i64 = r.get("id");
            let rs: Vec<Value> = runs
                .iter()
                .filter(|x| x.get::<i64, _>("expiry_id") == id)
                .map(|x| {
                    json!({
                        "run": x.get::<i32, _>("run"), "price": x.get::<f64, _>("price"), "source": x.get::<String, _>("source"),
                        "samples": x.get::<i32, _>("samples"), "expected": x.get::<i32, _>("expected"), "coverage": x.get::<f64, _>("coverage"),
                        "maxGapMs": x.get::<i64, _>("max_gap_ms"), "windowStart": x.get::<chrono::DateTime<Utc>, _>("window_start"),
                        "windowEnd": x.get::<chrono::DateTime<Utc>, _>("window_end"), "reason": x.get::<String, _>("reason"),
                        "createdBy": x.get::<String, _>("created_by"), "createdAt": x.get::<chrono::DateTime<Utc>, _>("created_at"),
                    })
                })
                .collect();
            json!({
                "expiryId": id,
                "symbol": r.get::<String, _>("symbol"),
                "date": r.get::<NaiveDate, _>("expiry_date"),
                "cutAt": r.get::<chrono::DateTime<Utc>, _>("cut_at"),
                "twapStart": r.get::<chrono::DateTime<Utc>, _>("twap_start"),
                "status": r.get::<String, _>("status"),
                "fixing": r.get::<Option<f64>, _>("fixing"),
                "source": r.get::<Option<String>, _>("fixing_source"),
                "run": r.get::<i32, _>("fixing_run"),
                "samples": r.get::<Option<i32>, _>("fixing_samples"),
                "expected": r.get::<Option<i32>, _>("fixing_expected"),
                "coverage": r.get::<Option<f64>, _>("fixing_coverage"),
                "maxGapMs": r.get::<Option<i64>, _>("fixing_max_gap_ms"),
                "fixedAt": r.get::<Option<chrono::DateTime<Utc>>, _>("fixed_at"),
                "error": r.get::<Option<String>, _>("fixing_error"),
                "runs": rs,
            })
        })
        .collect();
    Ok(Json(json!({"fixings": out})))
}

/// `GET /v1/internal/options/status`: version, feed, spots age, job heartbeats.
pub async fn status(State(st): State<AppState>) -> R {
    let rd = st.refdata().await;
    let spots = st.spots.all().await;
    let now = crate::feed::now_ms();
    let spot_age: serde_json::Map<String, Value> = spots.iter().map(|(k, s)| (k.clone(), json!({"mid": s.mid, "ageMs": now - s.recv}))).collect();
    let jobs: serde_json::Map<String, Value> = st.jobs.lock().unwrap().iter().map(|(k, v)| (k.to_string(), json!(v))).collect();
    Ok(Json(json!({
        "version": rd.version,
        "loadedAt": rd.loaded_at,
        "feedConnected": st.spots.connected(),
        "spots": spot_age,
        "jobs": jobs,
        "expiries": rd.expiries.iter().filter(|e| e.status == "listed").count(),
        "series": rd.series.iter().filter(|s| s.status == "active").count(),
        "workers": st.cfg.workers,
        "bookFeed": st.books.status(),
    })))
}

//! Client reads (Kalks Trader / Client Area BFFs with the internal token) and the public chain.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{ApiError, R, enabled_tenant};
use crate::model::{Expiry, PLATFORM_TENANT, RefData, TenantSettings, Underlying};
use crate::{AppState, pricing};

fn visible<'a>(rd: &'a RefData, t: &TenantSettings, symbol: &str) -> R<&'a Underlying> {
    rd.underlying(symbol).filter(|u| u.enabled && t.allows(&u.symbol)).ok_or_else(|| ApiError::not_found("Underlying"))
}

/// Listed expiries of an underlying, soonest first (cut still ahead).
pub fn open_expiries<'a>(rd: &'a RefData, symbol: &'a str) -> impl Iterator<Item = &'a Expiry> + 'a {
    let now = Utc::now();
    rd.expiries.iter().filter(move |e| e.symbol == symbol && e.status == "listed" && e.cut_at > now)
}

fn pick_expiry<'a>(rd: &'a RefData, symbol: &'a str, expiry: Option<&str>) -> R<&'a Expiry> {
    match expiry {
        Some(s) => {
            let d = NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").map_err(|_| ApiError::bad("expiry must be YYYY-MM-DD."))?;
            rd.expiry(symbol, d).ok_or_else(|| ApiError::not_found("Expiry"))
        }
        None => open_expiries(rd, symbol).min_by_key(|e| e.cut_at).ok_or_else(|| ApiError::not_found("Open expiry")),
    }
}

fn underlying_json(rd: &RefData, u: &Underlying) -> Value {
    let next = open_expiries(rd, &u.symbol).min_by_key(|e| e.cut_at);
    json!({
        "symbol": u.symbol,
        "name": u.name,
        "assetClass": u.asset_class,
        "model": u.model,
        "baseCcy": u.base_ccy,
        "quoteCcy": u.quote_ccy,
        "contractSize": u.contract_size,
        "contractUnit": u.contract_unit,
        "digits": u.digits,
        "pipSize": u.pip_size,
        "strikeStep": u.strike_step,
        "cut": {"time": u.cut_time, "zone": u.cut_zone},
        "twapMinutes": u.twap_minutes,
        "noOpenMinutes": u.no_open_minutes,
        "closeOnlyMinutes": u.close_only_minutes,
        "minContracts": u.min_contracts,
        "maxContracts": u.max_contracts,
        "contractStep": u.contract_step,
        "barriers": u.barriers_enabled,
        "expiryKinds": u.expiry_kinds,
        "nextExpiry": next.map(|e| json!({"date": e.expiry_date, "cutAt": e.cut_at})),
        "atmVol": rd.surfaces.get(&u.symbol).and_then(|s| s.surface.as_ref()).map(|s| s.atm_vol(7.0 / 365.0)),
        "realizedVol": rd.realized.get(&u.symbol).map(|r| r.value),
    })
}

/// `GET /v1/options/underlyings` -> `{underlyings[], version}`.
pub async fn underlyings(State(st): State<AppState>, h: HeaderMap) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let list: Vec<Value> = rd.underlyings.iter().filter(|u| u.enabled && t.allows(&u.symbol)).map(|u| underlying_json(&rd, u)).collect();
    Ok(Json(json!({"underlyings": list, "version": rd.version})))
}

#[derive(Deserialize)]
pub struct UQ {
    u: String,
}

/// `GET /v1/options/expiries?u=` -> `{underlying, expiries[{id, date, kinds, cutAt, twapStart, status, series, state}]}`.
pub async fn expiries(State(st): State<AppState>, h: HeaderMap, Query(q): Query<UQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let u = visible(&rd, &t, &q.u)?;
    let now = Utc::now();
    let list: Vec<Value> = open_expiries(&rd, &u.symbol)
        .map(|e| {
            json!({
                "id": e.id,
                "date": e.expiry_date,
                "kinds": e.kinds,
                "cutAt": e.cut_at,
                "twapStart": e.twap_start,
                "status": e.status,
                "state": rd.trade_state(&t.tenant, u, e, None, now),
                "series": rd.series_of(e.id).count(),
                "secondsToCut": (e.cut_at - now).num_seconds(),
            })
        })
        .collect();
    Ok(Json(json!({"underlying": u.symbol, "expiries": list, "version": rd.version})))
}

#[derive(Deserialize)]
pub struct ChainQ {
    u: String,
    expiry: Option<String>,
    group: Option<String>,
}

pub fn group_param(g: Option<&str>) -> String {
    g.map(str::trim).filter(|g| !g.is_empty() && g.len() <= 64).unwrap_or("*").to_string()
}

pub async fn build_chain(st: &AppState, rd: &RefData, u: &Underlying, e: &Expiry, tenant: &str, group: &str) -> (Value, Vec<pricing::ChainRow>) {
    let spot = st.spots.get(&u.symbol).await;
    let usd = st.spots.usd_per(&u.quote_ccy).await;
    pricing::chain(&pricing::ChainInput { rd, u, e, spot, usd_per_quote: usd, tenant, group, now: Utc::now() })
}

/// `GET /v1/options/chain?u=&expiry=&group=` -> header + `rows[{strike, strikeLabel, call{..}, put{..}}]`.
pub async fn chain(State(st): State<AppState>, h: HeaderMap, Query(q): Query<ChainQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let u = visible(&rd, &t, &q.u)?;
    let e = pick_expiry(&rd, &u.symbol, q.expiry.as_deref())?;
    let (mut head, rows) = build_chain(&st, &rd, u, e, &t.tenant, &group_param(q.group.as_deref())).await;
    head["rows"] = json!(rows);
    Ok(Json(head))
}

#[derive(Deserialize)]
pub struct GroupQ {
    group: Option<String>,
}

/// `GET /v1/options/series/{code}?group=` -> `{series, expiry, quote|null, error?}`.
pub async fn series(State(st): State<AppState>, h: HeaderMap, Path(code): Path<String>, Query(q): Query<GroupQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let s = rd.series.iter().find(|s| s.code == code).ok_or_else(|| ApiError::not_found("Series"))?;
    let u = visible(&rd, &t, &s.symbol)?;
    let e = rd.expiries.iter().find(|e| e.id == s.expiry_id).ok_or_else(|| ApiError::not_found("Expiry"))?;
    let spot = st.spots.get(&u.symbol).await;
    let usd = st.spots.usd_per(&u.quote_ccy).await;
    let now = Utc::now();
    let group = group_param(q.group.as_deref());
    let mut out = json!({
        "series": s,
        "expiry": {"id": e.id, "date": e.expiry_date, "cutAt": e.cut_at, "status": e.status, "fixing": e.fixing, "fixingSource": e.fixing_source},
        "underlying": u.symbol,
        "contractSize": u.contract_size,
        "spot": spot,
        "quote": null,
    });
    match pricing::context(&rd, u, e, spot.map(|s| s.mid), usd, now.timestamp_millis(), Some(&t.tenant)) {
        Ok(ctx) => {
            let gs = rd.group(&t.tenant, &group, &u.symbol);
            out["quote"] = json!(pricing::quote(&ctx, u, s, &gs, rd.trade_state(&t.tenant, u, e, Some(&s.code), now)));
        }
        Err(err) => out["error"] = json!({"code": "no_price", "message": err.to_string()}),
    }
    Ok(Json(out))
}

#[derive(Deserialize)]
pub struct SmileQ {
    u: String,
    expiry: Option<String>,
}

/// `GET /v1/options/smile?u=&expiry=` -> `{underlying, expiry, atmVol, quotes, points[{strike, vol}], pillars[...], termStructure[...]}`.
pub async fn smile(State(st): State<AppState>, h: HeaderMap, Query(q): Query<SmileQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let u = visible(&rd, &t, &q.u)?;
    let e = pick_expiry(&rd, &u.symbol, q.expiry.as_deref())?;
    let spot = st.spots.get(&u.symbol).await;
    let usd = st.spots.usd_per(&u.quote_ccy).await;
    let ctx = pricing::context(&rd, u, e, spot.map(|s| s.mid), usd, Utc::now().timestamp_millis(), Some(&t.tenant))
        .map_err(|err| ApiError::new(axum::http::StatusCode::SERVICE_UNAVAILABLE, "no_price", err.to_string()))?;
    let mut strikes: Vec<f64> = rd.series_of(e.id).filter(|s| s.kind == "call").map(|s| s.strike).collect();
    strikes.sort_by(f64::total_cmp);
    let term: Vec<Value> = rd
        .surfaces
        .get(&u.symbol)
        .map(|s| s.pillars.iter().map(|p| json!({"tenor": p.tenor, "days": p.days, "atm": p.atm, "rr25": p.rr25, "bf25": p.bf25, "rr10": p.rr10, "bf10": p.bf10})).collect())
        .unwrap_or_default();
    let mut out = pricing::smile_points(&ctx, &strikes);
    out["underlying"] = json!(u.symbol);
    out["expiry"] = json!(e.expiry_date);
    out["atmVol"] = json!(ctx.atm_vol);
    out["inputs"] = json!(ctx);
    out["termStructure"] = json!(term);
    Ok(Json(out))
}

/// `GET /v1/public/options/chain/{u}?expiry=`: guest chain (default group, platform tenant), cached 1 s.
/// 404 unless tenant `kalks` has `public_chain` on.
#[derive(Deserialize)]
pub struct ExpiryQ {
    expiry: Option<String>,
}

pub async fn public_chain(State(st): State<AppState>, Path(u): Path<String>, Query(q): Query<ExpiryQ>) -> R {
    let rd = st.refdata().await;
    let t = rd.tenant(PLATFORM_TENANT);
    if !t.public_chain {
        return Err(ApiError::disabled());
    }
    let sym = u.to_ascii_uppercase();
    let key = format!("{sym}|{}", q.expiry.as_deref().unwrap_or(""));
    if let Some((at, v)) = st.public_cache.lock().unwrap().get(&key)
        && at.elapsed() < Duration::from_secs(1)
    {
        return Ok(Json((**v).clone()));
    }
    let und = visible(&rd, &t, &sym)?;
    let e = pick_expiry(&rd, &und.symbol, q.expiry.as_deref())?;
    let (mut head, rows) = build_chain(&st, &rd, und, e, PLATFORM_TENANT, "*").await;
    if let Some(o) = head.as_object_mut() {
        o.remove("modelInputs");
        o.remove("group");
    }
    head["rows"] = json!(rows);
    head["expiries"] = json!(open_expiries(&rd, &und.symbol).map(|e| json!({"date": e.expiry_date, "kinds": e.kinds, "cutAt": e.cut_at})).collect::<Vec<_>>());
    let v = Arc::new(head);
    st.public_cache.lock().unwrap().insert(key, (Instant::now(), v.clone()));
    Ok(Json((*v).clone()))
}

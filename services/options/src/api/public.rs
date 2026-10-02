//! Client reads (Kalks Trader / Client Area BFFs with the internal token) and the public chain.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{ApiError, R, account_kind, enabled_tenant};
use crate::book_feed::Kind;
use crate::candles::{self, UsdConv};
use crate::model::{BARRIER_LABEL, BARRIER_VENUE, Expiry, PLATFORM_TENANT, RefData, TenantSettings, Underlying};
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

fn underlying_json(rd: &RefData, u: &Underlying, book_live: bool) -> Value {
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
        // order book (docs/OPTIONS-EXCHANGE.md §2, §5, §6)
        "orderBook": book_live,
        "premiumTick": u.premium_tick,
        "marketBandPct": u.market_band_pct,
        "limitBandPct": u.limit_band_pct,
        "bandMinTicks": u.band_min_ticks,
        "liqBandPct": u.liq_band_pct,
        "liqFeePct": u.liq_fee_pct,
        "rfqQuoteTtlSecs": u.rfq_quote_ttl_secs,
        "markMinQty": u.mark_min_qty,
        "markMaxSpreadMult": u.mark_max_spread_mult,
        "barrierVenue": BARRIER_VENUE,
        "barrierLabel": BARRIER_LABEL,
    })
}

/// `GET /v1/options/underlyings` -> `{underlyings[], version}`.
pub async fn underlyings(State(st): State<AppState>, h: HeaderMap) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let live = st.books.active(&t.tenant, account_kind(&h));
    let list: Vec<Value> = rd.underlyings.iter().filter(|u| u.enabled && t.allows(&u.symbol)).map(|u| underlying_json(&rd, u, live)).collect();
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

/// The tenant's live book for an account kind as pricing input: tops and previous EOD marks of `codes` (`None` while
/// the book is not live: house model quotes).
pub fn book_data(st: &AppState, tenant: &str, kind: Kind, codes: &[&str]) -> Option<(std::collections::HashMap<String, pricing::BookTop>, std::collections::HashMap<String, f64>)> {
    if !st.books.active(tenant, kind) {
        return None;
    }
    Some((st.books.tops(tenant, kind, codes.iter().copied()), st.books.prev_close(codes.iter().copied())))
}

/// A chain for (tenant, group) with the tenant's order book for `kind` merged in when it is live.
pub async fn build_chain(st: &AppState, rd: &RefData, u: &Underlying, e: &Expiry, tenant: &str, group: &str, kind: Kind) -> (Value, Vec<pricing::ChainRow>) {
    let spot = st.spots.get(&u.symbol).await;
    let usd = st.spots.usd_per(&u.quote_ccy).await;
    let codes: Vec<&str> = rd.series_of(e.id).map(|s| s.code.as_str()).collect();
    let data = book_data(st, tenant, kind, &codes);
    let book = data.as_ref().map(|(tops, prev_close)| pricing::BookIn { tops, prev_close });
    let (mut head, rows) = pricing::chain(&pricing::ChainInput { rd, u, e, spot, usd_per_quote: usd, tenant, group, now: Utc::now(), book });
    head["book"]["kind"] = json!(kind.as_str());
    (head, rows)
}

/// `GET /v1/options/chain?u=&expiry=&group=` -> header + `rows[{strike, strikeLabel, call{..}, put{..}}]`.
pub async fn chain(State(st): State<AppState>, h: HeaderMap, Query(q): Query<ChainQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let u = visible(&rd, &t, &q.u)?;
    let e = pick_expiry(&rd, &u.symbol, q.expiry.as_deref())?;
    let (mut head, rows) = build_chain(&st, &rd, u, e, &t.tenant, &group_param(q.group.as_deref()), account_kind(&h)).await;
    head["rows"] = json!(rows);
    Ok(Json(head))
}

#[derive(Deserialize)]
pub struct GroupQ {
    group: Option<String>,
}

/// A barrier series code `SYMBOL-YYYYMMDD-STRIKE-C|P-{UO|DO|UI|DI}{level}` → (vanilla code, barrier kind, level).
pub fn split_barrier(code: &str) -> Option<(&str, &str, f64)> {
    let mut dashes = code.match_indices('-').map(|(i, _)| i);
    let cut = dashes.nth(3)?;
    let (base, suffix) = (&code[..cut], &code[cut + 1..]);
    let kind = suffix.get(..2)?;
    if !matches!(kind, "UO" | "DO" | "UI" | "DI") {
        return None;
    }
    let level: f64 = suffix[2..].parse().ok().filter(|x: &f64| x.is_finite() && *x > 0.0)?;
    Some((base, kind, level))
}

/// `GET /v1/options/series/{code}?group=` -> `{series, expiry, venue, quote|null, error?}`. A vanilla series trades on
/// the order book once it is live (`venue: "book"`, the quote carries the book), else at house prices. A barrier code
/// (`…-C-UO1.1800`) answers its vanilla series with `venue: "rfq"`, `kalksQuoted: true` and the label: barriers are
/// RFQ only, quoted by Kalks (docs/OPTIONS-EXCHANGE.md §5), never on the book.
pub async fn series(State(st): State<AppState>, h: HeaderMap, Path(code): Path<String>, Query(q): Query<GroupQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let barrier = split_barrier(&code);
    let base = barrier.map(|b| b.0).unwrap_or(&code);
    let s = rd.series.iter().find(|s| s.code == base).ok_or_else(|| ApiError::not_found("Series"))?;
    let u = visible(&rd, &t, &s.symbol)?;
    let e = rd.expiries.iter().find(|e| e.id == s.expiry_id).ok_or_else(|| ApiError::not_found("Expiry"))?;
    let kind = account_kind(&h);
    let spot = st.spots.get(&u.symbol).await;
    let usd = st.spots.usd_per(&u.quote_ccy).await;
    let now = Utc::now();
    let group = group_param(q.group.as_deref());
    let book = if barrier.is_none() { book_data(&st, &t.tenant, kind, &[s.code.as_str()]) } else { None };
    let mut out = json!({
        "series": s,
        "expiry": {"id": e.id, "date": e.expiry_date, "cutAt": e.cut_at, "status": e.status, "fixing": e.fixing, "fixingSource": e.fixing_source},
        "underlying": u.symbol,
        "contractSize": u.contract_size,
        "spot": spot,
        "venue": if barrier.is_some() { BARRIER_VENUE } else if book.is_some() { "book" } else { "house" },
        "quote": null,
    });
    if let Some((_, kind_code, level)) = barrier {
        out["code"] = json!(code);
        out["barrier"] = json!({"kind": kind_code, "level": level});
        out["kalksQuoted"] = json!(true);
        out["orderBook"] = json!(false);
        out["label"] = json!(BARRIER_LABEL);
        out["barriersEnabled"] = json!(u.barriers_enabled);
        return Ok(Json(out));
    }
    match pricing::context(&rd, u, e, spot.map(|s| s.mid), usd, now.timestamp_millis(), Some(&t.tenant)) {
        Ok(ctx) => {
            let gs = rd.group(&t.tenant, &group, &u.symbol);
            let state = rd.trade_state(&t.tenant, u, e, Some(&s.code), now);
            out["quote"] = match &book {
                Some((tops, prev)) => json!(pricing::quote_book(&ctx, u, s, &gs, state, tops.get(&s.code), prev.get(&s.code).copied())),
                None => json!(pricing::quote(&ctx, u, s, &gs, state)),
            };
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
        .map_err(no_price)?;
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
    let (mut head, rows) = build_chain(&st, &rd, und, e, PLATFORM_TENANT, "*", Kind::Live).await;
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

#[derive(Deserialize)]
pub struct CandlesQ {
    series: Option<String>,
    tf: Option<String>,
    limit: Option<String>,
    to: Option<String>,
    barrier: Option<String>,
    level: Option<String>,
    rebate: Option<String>,
    #[serde(rename = "knockedAt")]
    knocked_at: Option<String>,
}

fn num<T: std::str::FromStr>(v: Option<&str>, name: &str) -> R<Option<T>> {
    match v.map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(None),
        Some(s) => s.parse().map(Some).map_err(|_| ApiError::bad(format!("{name} must be a number."))),
    }
}

fn no_price(e: pricing::PriceError) -> ApiError {
    ApiError::new(StatusCode::SERVICE_UNAVAILABLE, "no_price", e.to_string())
}

/// `GET /v1/options/candles?series=&tf=&limit=&to=` (+ optional `barrier=UO|DO|UI|DI&level=&rebate=&knockedAt=`):
/// premium candles of one series in USD per contract (model mid), see README "Premium candles". History is cached
/// 30 s; the latest candle is recomputed on every call with the live mid.
pub async fn candles(State(st): State<AppState>, h: HeaderMap, Query(q): Query<CandlesQ>) -> R {
    let rd = st.refdata().await;
    let t = enabled_tenant(&rd, &h)?;
    let code = q.series.as_deref().map(str::trim).filter(|s| !s.is_empty()).ok_or_else(|| ApiError::bad("series is required."))?;
    let (tf_min, tf_name) = q.tf.as_deref().and_then(candles::parse_tf).ok_or_else(|| ApiError::bad("tf must be one of 1, 5, 15, 30, 60, 240, 1440 (minutes)."))?;
    let limit = num::<i64>(q.limit.as_deref(), "limit")?.map(|l| l.clamp(1, candles::MAX_LIMIT as i64) as usize).unwrap_or(candles::DEFAULT_LIMIT);
    let to = num::<i64>(q.to.as_deref(), "to")?;
    let barrier = match q.barrier.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => None,
        Some(b) => {
            let kind = candles::Barrier::parse_kind(b).ok_or_else(|| ApiError::bad("barrier must be UO, DO, UI or DI."))?;
            let level = num::<f64>(q.level.as_deref(), "level")?.filter(|x| x.is_finite() && *x > 0.0).ok_or_else(|| ApiError::bad("level must be a positive price."))?;
            let rebate = num::<f64>(q.rebate.as_deref(), "rebate")?.unwrap_or(0.0);
            if !(rebate.is_finite() && rebate >= 0.0) {
                return Err(ApiError::bad("rebate must be zero or more (per unit, quote currency)."));
            }
            let knocked_at_ms = num::<i64>(q.knocked_at.as_deref(), "knockedAt")?.map(|s| s.saturating_mul(1000));
            Some(candles::Barrier { kind, level, rebate, knocked_at_ms })
        }
    };
    let s = rd.series.iter().find(|s| s.code == code).ok_or_else(|| ApiError::not_found("Series"))?;
    let u = visible(&rd, &t, &s.symbol)?;
    let e = rd.expiries.iter().find(|e| e.id == s.expiry_id).ok_or_else(|| ApiError::not_found("Expiry"))?;

    let now = Utc::now();
    let (now_ms, now_s) = (now.timestamp_millis(), now.timestamp());
    let cut_s = e.cut_at.timestamp();
    let tf_secs = tf_min * 60;
    let listed_s = match st.candles.listed(&s.code) {
        Some(x) => x,
        None => {
            let at: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT created_at FROM series WHERE code = $1").bind(&s.code).fetch_optional(&st.pool).await?;
            let x = at.map(|a| a.timestamp()).unwrap_or(now_s);
            st.candles.put_listed(&s.code, x);
            x
        }
    };
    let from = candles::window_start(listed_s, cut_s, candles::tenor_days(u, &e.kinds), now_s);
    // The latest page (no `to`, or `to` in the future) carries the forming bar and the live mid until the cut.
    let live_page = to.is_none_or(|x| x >= now_s);
    let md_to = if live_page { (now_s >= cut_s + tf_secs).then_some(cut_s) } else { to.map(|x| x.min(cut_s)) };

    let usd = if u.quote_ccy == "USD" {
        UsdConv::Fixed(1.0)
    } else if u.symbol == format!("USD{}", u.quote_ccy) {
        UsdConv::InverseSpot
    } else {
        let live = st.spots.usd_per(&u.quote_ccy).await.filter(|x| x.is_finite() && *x > 0.0);
        UsdConv::Fixed(live.ok_or_else(|| no_price(pricing::PriceError::NoUsdRate(u.quote_ccy.clone())))?)
    };
    let (manual_vol, _) = rd.overrides(Some(&t.tenant), &u.symbol, &e.key());
    let model = pricing::Model::new(&rd, u, e, manual_vol).map_err(no_price)?;
    let kind = if s.kind == "call" { optmath::OptionType::Call } else { optmath::OptionType::Put };
    let spec = candles::Spec { kind, strike: s.strike, contract_size: u.contract_size, fixing: e.fixing, barrier, usd, digits: u.digits };

    let key = format!("{}|{}|{tf_min}|{limit}|{md_to:?}|{barrier:?}|{}", t.tenant, s.code, rd.version);
    let computed = match st.candles.computed(&key) {
        Some(c) => c,
        None => {
            let mut bars: Vec<candles::Bar> = if md_to.is_some_and(|x| x + tf_secs <= from) {
                vec![]
            } else {
                let all = candles::fetch_bars(&st, &u.symbol, tf_name, limit, md_to).await.map_err(|err| {
                    tracing::debug!(symbol = %u.symbol, tf = tf_name, error = %err, "underlying candles unavailable");
                    ApiError::new(StatusCode::SERVICE_UNAVAILABLE, "candles_unavailable", "Underlying candles are unavailable right now. Please try again.")
                })?;
                all.iter().filter(|b| b.t + tf_secs > from && b.t < cut_s && md_to.is_none_or(|x| b.t <= x)).copied().collect()
            };
            let tail = bars.pop();
            let (head, knocked) = candles::premium_candles(&model, &spec, &bars, tf_secs, now_ms, false);
            let c = Arc::new(candles::Computed { head, tail, knocked });
            st.candles.put_computed(key, c.clone());
            c
        }
    };
    // The latest candle: always recomputed (decay to now), with the live mid on the latest page.
    let mut tail: Vec<candles::Bar> = computed.tail.into_iter().collect();
    let spot = st.spots.get(&u.symbol).await;
    if live_page
        && now_s < cut_s
        && let Some(sp) = spot
    {
        let tick_s = if sp.t > 0 { (sp.t / 1000).min(now_s) } else { now_s };
        candles::overlay_live(&mut tail, tf_secs, sp.mid, tick_s);
    }
    let (tail, _) = candles::premium_candles(&model, &spec, &tail, tf_secs, now_ms, computed.knocked);
    let mut out: Vec<candles::Candle> = computed.head.iter().copied().chain(tail).collect();
    if out.len() > limit {
        out.drain(..out.len() - limit);
    }
    let usd_per_unit = match usd {
        UsdConv::Fixed(x) => Some(x),
        UsdConv::InverseSpot => spot.map(|s| s.mid).or(out.last().map(|c| c.u)).map(|s| 1.0 / s),
    };
    Ok(Json(json!({
        "series": s.code,
        "underlying": u.symbol,
        "right": s.kind,
        "strike": s.strike,
        "expiryAt": e.cut_at,
        "expiryTs": cut_s,
        "status": e.status,
        "fixing": e.fixing,
        "tf": tf_min,
        "contractSize": u.contract_size,
        "quoteCcy": u.quote_ccy,
        "usdPerUnit": usd_per_unit,
        "unit": "usd_per_contract",
        "price": "mid",
        "from": from,
        "barrier": barrier.map(|b| json!({"kind": b.code(), "level": b.level, "rebate": b.rebate, "knockedAt": b.knocked_at_ms.map(|x| x / 1000)})),
        "candles": out,
    })))
}

#[cfg(test)]
mod tests {
    use super::split_barrier;

    #[test]
    fn barrier_codes() {
        assert_eq!(split_barrier("EURUSD-20261009-1.1650-C-UO1.1800"), Some(("EURUSD-20261009-1.1650-C", "UO", 1.18)));
        assert_eq!(split_barrier("XAUUSD-20261030-4000-P-DI3800"), Some(("XAUUSD-20261030-4000-P", "DI", 3800.0)));
        assert_eq!(split_barrier("EURUSD-20261009-1.1650-C"), None);
        assert_eq!(split_barrier("EURUSD-20261009-1.1650-C-XX1.2"), None);
        assert_eq!(split_barrier("EURUSD-20261009-1.1650-C-UO"), None);
    }
}

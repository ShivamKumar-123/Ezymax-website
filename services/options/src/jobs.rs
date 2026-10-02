//! Background jobs (all idempotent; a restart resumes where it left off):
//!
//! | job | every | does |
//! |-----|-------|------|
//! | reference-data watch | 2 s | reloads `RefData` when `meta.version` moved |
//! | listing | 30 s | lists expiries per calendar, strikes from the live mid, extends ladders near an edge |
//! | TWAP sampler | 1 s | raw mid per expiry inside `[cut - twap_minutes, cut)`, flushed every 5 s |
//! | fixing | 2 s | at the cut: status `fixing`, TWAP (or M1 fallback) -> `fixed`, fixings run row |
//! | realized vol | 15 min | Yang-Zhang / Garman-Klass / close / EWMA from D1 candles |
//! | EOD marks | 60 s | after 17:00 New York on weekdays, model marks of every active series |

use std::collections::{BTreeMap, HashMap};
use std::time::Duration;

use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use optmath::calendar::{ExpiryKind, next_expiries};
use optmath::ladder::{extension, format_strike, tick_to_strike};
use optmath::realized::{Ohlc, close_to_close, ewma, garman_klass, yang_zhang};
use optmath::twap::{twap, twap_bars};
use optmath::{Date, Zone};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;

use crate::feed::now_ms;
use crate::model::{RefData, series_code};
use crate::{AppState, feed, pricing, store};

pub fn spawn_all(st: AppState) {
    tokio::spawn(feed::run(st.clone()));
    tokio::spawn(every(st.clone(), "refdata", Duration::from_secs(2), Duration::from_secs(2), |st| async move {
        st.reload(false).await.map(|_| ())
    }));
    tokio::spawn(every(st.clone(), "listing", Duration::from_secs(5), Duration::from_secs(30), |st| async move { list_series(&st).await.map(|_| ()) }));
    tokio::spawn(twap_sampler(st.clone()));
    tokio::spawn(every(st.clone(), "fixing", Duration::from_secs(3), Duration::from_secs(2), |st| async move { run_fixings(&st).await.map(|_| ()) }));
    tokio::spawn(every(st.clone(), "realized_vol", Duration::from_secs(10), Duration::from_secs(900), |st| async move {
        realized_vol(&st).await.map(|_| ())
    }));
    tokio::spawn(every(st.clone(), "marks_eod", Duration::from_secs(30), Duration::from_secs(60), |st| async move { eod_marks(&st).await.map(|_| ()) }));
    // the engine's order book market data (docs/OPTIONS-EXCHANGE.md §10)
    if st.cfg.book_feed {
        crate::book_feed::spawn(st.clone());
    }
}

async fn every<F, Fut>(st: AppState, name: &'static str, first: Duration, period: Duration, f: F)
where
    F: Fn(AppState) -> Fut,
    Fut: std::future::Future<Output = anyhow::Result<()>>,
{
    tokio::time::sleep(first).await;
    let mut tick = tokio::time::interval(period);
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    let mut failing = false;
    loop {
        tick.tick().await;
        match f(st.clone()).await {
            Ok(()) => {
                if failing {
                    tracing::info!(job = name, "job recovered");
                }
                failing = false;
                st.job_ran(name);
            }
            Err(e) => {
                if !failing {
                    tracing::warn!(job = name, error = %e, "job failed");
                }
                failing = true;
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/* Listing                                                             */
/* ------------------------------------------------------------------ */

#[derive(Debug, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListingReport {
    pub expiries_added: usize,
    pub series_added: usize,
    pub skipped_no_price: Vec<String>,
}

fn naive(d: Date) -> NaiveDate {
    let (y, m, dd) = d.ymd();
    NaiveDate::from_ymd_opt(y, m, dd).expect("valid date")
}

fn utc_ms(ms: i64) -> DateTime<Utc> {
    Utc.timestamp_millis_opt(ms).single().unwrap_or_else(Utc::now)
}

/// Expiry dates (with their cycles) an underlying should have listed now.
pub fn wanted_expiries(rd: &RefData, u: &crate::model::Underlying, now: i64) -> BTreeMap<Date, Vec<String>> {
    let cal = rd.pair_calendar(&u.symbol);
    let cut = u.cut();
    let today = cut.zone.local_date(now);
    let mut want: BTreeMap<Date, Vec<String>> = BTreeMap::new();
    for k in &u.expiry_kinds {
        let Some(kind) = ExpiryKind::parse(k) else { continue };
        let count = match kind {
            ExpiryKind::Daily => u.daily_count,
            ExpiryKind::Weekly => u.weekly_count,
            ExpiryKind::Monthly => u.monthly_count,
        }
        .max(0) as usize;
        if count == 0 {
            continue;
        }
        // Not yet closed: the cut minus the final no-trading minute is still ahead.
        let open = |d: &Date| cut.instant_ms(*d) - u.close_only_minutes as i64 * 60_000 > now;
        for d in next_expiries(kind, today, count + 1, &cal).into_iter().filter(open).take(count) {
            want.entry(d).or_default().push(kind.as_str().to_string());
        }
    }
    want
}

/// Strikes each side for an expiry: at least the configured count, enough to cover about 2.5 standard
/// deviations to expiry, at most 40.
pub fn strikes_each_side(u: &crate::model::Underlying, spot: f64, atm_vol: f64, t_cal: f64) -> u32 {
    let sd_steps = 2.5 * atm_vol * t_cal.max(0.0).sqrt() * spot / u.strike_step;
    (sd_steps.ceil() as i64).clamp(u.strikes_each_side as i64, 40) as u32
}

/// Lists missing expiries and strikes. Safe to run any time (admin "regenerate" calls it too).
pub async fn list_series(st: &AppState) -> anyhow::Result<ListingReport> {
    let _g = st.listing.lock().await;
    let rd = st.refdata().await;
    let now = now_ms();
    let mut rep = ListingReport::default();
    let mut tx = st.pool.begin().await?;
    for u in rd.underlyings.iter().filter(|u| u.enabled) {
        let cut = u.cut();
        for (d, kinds) in wanted_expiries(&rd, u, now) {
            let cut_ms = cut.instant_ms(d);
            let start_ms = cut_ms - u.twap_minutes as i64 * 60_000;
            let r = sqlx::query(
                "INSERT INTO expiries (symbol, expiry_date, kinds, cut_at, twap_start) VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (symbol, expiry_date) DO UPDATE SET kinds = ARRAY(SELECT DISTINCT k FROM unnest(expiries.kinds || EXCLUDED.kinds) k ORDER BY k)
                   WHERE expiries.status = 'listed' AND NOT (expiries.kinds @> EXCLUDED.kinds)
                 RETURNING (xmax = 0) AS inserted",
            )
            .bind(&u.symbol)
            .bind(naive(d))
            .bind(&kinds)
            .bind(utc_ms(cut_ms))
            .bind(utc_ms(start_ms))
            .fetch_optional(&mut *tx)
            .await?;
            if r.is_some_and(|r| r.get::<bool, _>("inserted")) {
                rep.expiries_added += 1;
            }
        }
    }
    // Strikes for every open expiry of an enabled underlying.
    let open = sqlx::query("SELECT e.id, e.symbol, e.expiry_date, e.cut_at FROM expiries e JOIN underlyings u ON u.symbol = e.symbol WHERE u.enabled AND e.status = 'listed' AND e.cut_at > now()")
        .fetch_all(&mut *tx)
        .await?;
    let ids: Vec<i64> = open.iter().map(|r| r.get("id")).collect();
    let mut listed: HashMap<i64, Vec<i64>> = HashMap::new();
    for r in sqlx::query("SELECT expiry_id, strike_ticks FROM series WHERE kind = 'call' AND expiry_id = ANY($1)").bind(&ids).fetch_all(&mut *tx).await? {
        listed.entry(r.get("expiry_id")).or_default().push(r.get("strike_ticks"));
    }
    let spots = st.spots.all().await;
    for r in &open {
        let (id, symbol, date, cut_at): (i64, String, NaiveDate, DateTime<Utc>) = (r.get("id"), r.get("symbol"), r.get("expiry_date"), r.get("cut_at"));
        let Some(u) = rd.underlying(&symbol) else { continue };
        let Some(spot) = spots.get(&symbol).map(|s| s.mid) else {
            if !rep.skipped_no_price.contains(&symbol) {
                rep.skipped_no_price.push(symbol.clone());
            }
            continue;
        };
        let t_cal = optmath::calendar_years(now, cut_at.timestamp_millis());
        let atm = rd
            .surfaces
            .get(&symbol)
            .and_then(|s| s.surface.as_ref())
            .map(|s| s.atm_vol(t_cal.max(1.0 / 365.0)))
            .or_else(|| rd.realized.get(&symbol).map(|r| r.value))
            .unwrap_or(0.1);
        let have = listed.get(&id).cloned().unwrap_or_default();
        let add = extension(&have, spot, u.strike_step, strikes_each_side(u, spot, atm, t_cal), u.extend_threshold.max(0) as u32);
        let origin = if have.is_empty() { "listing" } else { "extension" };
        for ticks in add {
            let strike = tick_to_strike(ticks, u.strike_step);
            let label = format_strike(ticks, u.strike_step);
            for kind in ["call", "put"] {
                let n = sqlx::query(
                    "INSERT INTO series (code, symbol, expiry_id, strike, strike_ticks, kind, origin) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
                )
                .bind(series_code(&symbol, date, &label, kind))
                .bind(&symbol)
                .bind(id)
                .bind(strike)
                .bind(ticks)
                .bind(kind)
                .bind(origin)
                .execute(&mut *tx)
                .await?
                .rows_affected();
                rep.series_added += n as usize;
            }
        }
    }
    if rep.expiries_added + rep.series_added > 0 {
        store::bump(&mut tx).await?;
        tx.commit().await?;
        tracing::info!(expiries = rep.expiries_added, series = rep.series_added, "options listed");
        st.reload(true).await?;
    } else {
        tx.commit().await?;
    }
    Ok(rep)
}

/* ------------------------------------------------------------------ */
/* TWAP sampler                                                        */
/* ------------------------------------------------------------------ */

/// Samples once per second; a sample needs a live mid (stream connected and quote at most 60 s old, or a
/// REST quote at most 2 s old). Missing seconds are gaps, accounted for at the fixing.
async fn twap_sampler(st: AppState) {
    let mut tick = tokio::time::interval(Duration::from_secs(1));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut buf: Vec<(i64, DateTime<Utc>, f64)> = Vec::new();
    let mut last_flush = std::time::Instant::now();
    loop {
        tick.tick().await;
        let rd = st.refdata().await;
        let now = Utc::now();
        let sec = utc_ms(now.timestamp_millis() / 1000 * 1000);
        for e in rd.expiries.iter().filter(|e| e.status == "listed" && e.twap_start <= now && now < e.cut_at) {
            if let Some(s) = st.spots.get(&e.symbol).await {
                let age = now_ms() - s.recv;
                if (st.spots.connected() && age <= 60_000) || age <= 2_000 {
                    buf.push((e.id, sec, s.mid));
                }
            }
        }
        if !buf.is_empty() && last_flush.elapsed() >= Duration::from_secs(5) {
            if let Err(e) = flush_samples(&st, &buf).await {
                tracing::warn!(error = %e, samples = buf.len(), "TWAP samples not stored yet; retrying");
                if buf.len() > 50_000 {
                    buf.drain(..buf.len() - 50_000);
                }
            } else {
                buf.clear();
                st.job_ran("twap_sampler");
            }
            last_flush = std::time::Instant::now();
        }
    }
}

pub async fn flush_samples(st: &AppState, buf: &[(i64, DateTime<Utc>, f64)]) -> anyhow::Result<()> {
    let ids: Vec<i64> = buf.iter().map(|x| x.0).collect();
    let ts: Vec<DateTime<Utc>> = buf.iter().map(|x| x.1).collect();
    let mids: Vec<f64> = buf.iter().map(|x| x.2).collect();
    sqlx::query("INSERT INTO twap_samples (expiry_id, t, mid) SELECT * FROM unnest($1::bigint[], $2::timestamptz[], $3::float8[]) ON CONFLICT DO NOTHING")
        .bind(&ids)
        .bind(&ts)
        .bind(&mids)
        .execute(&st.pool)
        .await?;
    Ok(())
}

/* ------------------------------------------------------------------ */
/* Fixing                                                              */
/* ------------------------------------------------------------------ */

#[derive(Deserialize)]
struct Bar {
    t: i64,
    o: f64,
    h: f64,
    l: f64,
    c: f64,
}

/// M1 bars with open time in `[start, end)` from market-data.
async fn m1_bars(st: &AppState, symbol: &str, start: DateTime<Utc>, end: DateTime<Utc>) -> anyhow::Result<Vec<(i64, Ohlc)>> {
    let minutes = ((end - start).num_minutes() + 5).clamp(1, 600);
    let to = end.timestamp() - 60;
    let url = format!("{}/v1/candles?symbol={symbol}&tf=M1&limit={minutes}&to={to}", st.cfg.market_data_url);
    let v: serde_json::Value = st.http.get(&url).send().await?.error_for_status()?.json().await?;
    let bars: Vec<Bar> = serde_json::from_value(v["bars"].clone()).unwrap_or_default();
    Ok(bars
        .into_iter()
        .filter(|b| b.t >= start.timestamp() && b.t < end.timestamp())
        .map(|b| (b.t * 1000, Ohlc::new(b.o, b.h, b.l, b.c)))
        .collect())
}

/// The TWAP sampler writes its buffer every 5 s: the automatic fixing waits this long after the cut so the
/// window's last seconds are stored before the TWAP is computed (fixing right at the cut missed up to 5 s of
/// samples, 2 of 900 in a 15-minute window on 2026-10-02).
pub const FIXING_GRACE_SECS: i64 = 8;

/// Fixes every expiry whose cut has passed (by `FIXING_GRACE_SECS`). Returns the number fixed.
pub async fn run_fixings(st: &AppState) -> anyhow::Result<usize> {
    // the status flips to `fixing` at the cut (no more trading); the TWAP is computed after the grace
    let closing = sqlx::query("SELECT id FROM expiries WHERE status = 'listed' AND cut_at <= now()").fetch_all(&st.pool).await?;
    if !closing.is_empty() {
        let ids: Vec<i64> = closing.iter().map(|r| r.get("id")).collect();
        let mut tx = st.pool.begin().await?;
        sqlx::query("UPDATE expiries SET status = 'fixing' WHERE id = ANY($1) AND status = 'listed'").bind(&ids).execute(&mut *tx).await?;
        sqlx::query("UPDATE series SET status = 'expired' WHERE expiry_id = ANY($1) AND status = 'active'").bind(&ids).execute(&mut *tx).await?;
        store::bump(&mut tx).await?;
        tx.commit().await?;
        st.reload(true).await?;
    }
    let due = sqlx::query("SELECT id, symbol, expiry_date, cut_at, twap_start, status, fixing_run FROM expiries WHERE status IN ('listed', 'fixing') AND cut_at <= now() - make_interval(secs => $1) ORDER BY cut_at")
        .bind(FIXING_GRACE_SECS as f64)
        .fetch_all(&st.pool)
        .await?;
    let mut fixed = 0;
    for r in due {
        let (id, symbol, cut_at, start, status, run): (i64, String, DateTime<Utc>, DateTime<Utc>, String, i32) =
            (r.get("id"), r.get("symbol"), r.get("cut_at"), r.get("twap_start"), r.get("status"), r.get("fixing_run"));
        if status == "listed" {
            let mut tx = st.pool.begin().await?;
            sqlx::query("UPDATE expiries SET status = 'fixing' WHERE id = $1 AND status = 'listed'").bind(id).execute(&mut *tx).await?;
            sqlx::query("UPDATE series SET status = 'expired' WHERE expiry_id = $1 AND status = 'active'").bind(id).execute(&mut *tx).await?;
            store::bump(&mut tx).await?;
            tx.commit().await?;
        }
        if fix_expiry(st, id, &symbol, start, cut_at, run + 1, "system", "").await? {
            fixed += 1;
        }
    }
    if fixed > 0 {
        st.reload(true).await?;
    }
    Ok(fixed)
}

/// Computes and stores one fixing run. `false` = not enough data yet (retried later).
#[allow(clippy::too_many_arguments)]
pub async fn fix_expiry(st: &AppState, id: i64, symbol: &str, start: DateTime<Utc>, cut_at: DateTime<Utc>, run: i32, actor: &str, reason: &str) -> anyhow::Result<bool> {
    let rows = sqlx::query("SELECT (extract(epoch FROM t) * 1000)::bigint AS ms, mid FROM twap_samples WHERE expiry_id = $1 AND t >= $2 AND t < $3")
        .bind(id)
        .bind(start)
        .bind(cut_at)
        .fetch_all(&st.pool)
        .await?;
    let samples: Vec<(i64, f64)> = rows.iter().map(|r| (r.get("ms"), r.get("mid"))).collect();
    let (s_ms, e_ms) = (start.timestamp_millis(), cut_at.timestamp_millis());
    let tw = twap(&samples, s_ms, e_ms, 1000, None);
    let since_cut = Utc::now() - cut_at;
    let good_twap = tw.filter(|t| t.coverage >= st.cfg.min_twap_coverage);
    let (res, source) = match good_twap {
        Some(t) => (t, "twap"),
        None => {
            // Give market-data time to close the last M1 bar before falling back.
            if since_cut < chrono::Duration::seconds(90) {
                return Ok(false);
            }
            let bars = match m1_bars(st, symbol, start, cut_at).await {
                Ok(b) => b,
                Err(e) => {
                    tracing::warn!(%symbol, error = %e, "M1 fallback unavailable");
                    vec![]
                }
            };
            match (twap_bars(&bars, s_ms, e_ms, 60_000), tw) {
                (Some(b), Some(t)) if t.coverage >= b.coverage => (t, "twap"),
                (Some(b), _) => (b, "m1"),
                (None, Some(t)) if t.samples > 0 => (t, "twap"),
                _ => {
                    let msg = format!("no TWAP samples and no M1 candles for {symbol} in the fixing window");
                    let first: bool = sqlx::query_scalar("UPDATE expiries SET fixing_error = $2 WHERE id = $1 AND fixing_error IS DISTINCT FROM $2 RETURNING true")
                        .bind(id)
                        .bind(&msg)
                        .fetch_optional(&st.pool)
                        .await?
                        .unwrap_or(false);
                    if first {
                        tracing::error!(%symbol, expiry_id = id, "{msg}; retrying");
                    }
                    return Ok(false);
                }
            }
        }
    };
    let u = st.refdata().await.underlying(symbol).map(|u| u.digits).unwrap_or(5);
    let p = 10f64.powi(u + 1);
    let price = (res.value * p).round() / p;
    let mut tx = st.pool.begin().await?;
    let inserted = sqlx::query(
        "INSERT INTO fixings (expiry_id, run, price, source, samples, expected, coverage, max_gap_ms, window_start, window_end, reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (expiry_id, run) DO NOTHING",
    )
    .bind(id)
    .bind(run)
    .bind(price)
    .bind(source)
    .bind(res.samples as i32)
    .bind(res.expected as i32)
    .bind(res.coverage)
    .bind(res.max_gap_ms)
    .bind(start)
    .bind(cut_at)
    .bind(reason)
    .bind(actor)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if inserted == 0 {
        return Ok(false);
    }
    sqlx::query(
        "UPDATE expiries SET status = 'fixed', fixing = $2, fixing_source = $3, fixing_run = $4, fixing_samples = $5, fixing_expected = $6,
           fixing_coverage = $7, fixing_max_gap_ms = $8, fixed_at = now(), fixing_error = NULL WHERE id = $1",
    )
    .bind(id)
    .bind(price)
    .bind(source)
    .bind(run)
    .bind(res.samples as i32)
    .bind(res.expected as i32)
    .bind(res.coverage)
    .bind(res.max_gap_ms)
    .execute(&mut *tx)
    .await?;
    store::bump(&mut tx).await?;
    let after = json!({"price": price, "source": source, "run": run, "samples": res.samples, "expected": res.expected, "coverage": res.coverage, "maxGapMs": res.max_gap_ms});
    store::audit(&mut tx, "kalks", actor, "fixing", &format!("{symbol}:{}", cut_at.date_naive()), None, Some(after), reason).await?;
    tx.commit().await?;
    tracing::info!(%symbol, expiry_id = id, price, source, samples = res.samples, coverage = res.coverage, run, "expiry fixed");
    Ok(true)
}

/* ------------------------------------------------------------------ */
/* Realized vol                                                        */
/* ------------------------------------------------------------------ */

/// Annualisation for daily bars (5-day weeks, matching the vol clock).
pub const PERIODS_PER_YEAR: f64 = 260.0;

pub struct RvSet {
    pub yz20: Option<f64>,
    pub yz60: Option<f64>,
    pub gk20: Option<f64>,
    pub cc20: Option<f64>,
    pub ewma: Option<f64>,
    pub bars: usize,
}

/// Estimators over clean daily bars (oldest first).
pub fn estimate(bars: &[Ohlc]) -> RvSet {
    let tail = |n: usize| &bars[bars.len().saturating_sub(n)..];
    let closes: Vec<f64> = bars.iter().map(|b| b.c).collect();
    RvSet {
        yz20: yang_zhang(tail(21), PERIODS_PER_YEAR),
        yz60: yang_zhang(tail(61), PERIODS_PER_YEAR),
        gk20: garman_klass(tail(20), PERIODS_PER_YEAR),
        cc20: close_to_close(tail(21), PERIODS_PER_YEAR),
        ewma: ewma(&closes, 0.94, PERIODS_PER_YEAR),
        bars: bars.len(),
    }
}

pub async fn realized_vol(st: &AppState) -> anyhow::Result<usize> {
    let rd = st.refdata().await;
    let now = Utc::now();
    let day = Zone::NewYork.local_date(now.timestamp_millis());
    let mut written = 0;
    let mut errors = 0;
    for u in rd.underlyings.iter().filter(|u| u.enabled) {
        let url = format!("{}/v1/candles?symbol={}&tf=D1&limit=90", st.cfg.market_data_url, u.symbol);
        let bars: Vec<Bar> = match st.http.get(&url).send().await.and_then(|r| r.error_for_status()) {
            Ok(r) => serde_json::from_value(r.json::<serde_json::Value>().await?["bars"].clone()).unwrap_or_default(),
            Err(e) => {
                errors += 1;
                tracing::debug!(symbol = %u.symbol, error = %e, "candles unavailable");
                continue;
            }
        };
        // Drop the forming bar, flat (no-trade) bars and bad data.
        let clean: Vec<Ohlc> = bars
            .iter()
            .filter(|b| b.t + 86_400 <= now.timestamp())
            .map(|b| Ohlc::new(b.o, b.h, b.l, b.c))
            .filter(|b| b.is_valid() && b.h > b.l)
            .collect();
        let set = estimate(&clean);
        let rows = [("yang_zhang", 20, set.yz20), ("yang_zhang", 60, set.yz60), ("garman_klass", 20, set.gk20), ("close", 20, set.cc20), ("ewma", 0, set.ewma)];
        let mut tx = st.pool.begin().await?;
        for (est, win, val) in rows {
            let Some(v) = val.filter(|v| v.is_finite() && *v > 0.0) else { continue };
            sqlx::query(
                "INSERT INTO realized_vol (symbol, tf, estimator, window_bars, value, bars, computed_at) VALUES ($1,'D1',$2,$3,$4,$5,now())
                 ON CONFLICT (symbol, tf, estimator, window_bars) DO UPDATE SET value = EXCLUDED.value, bars = EXCLUDED.bars, computed_at = now()",
            )
            .bind(&u.symbol)
            .bind(est)
            .bind(win)
            .bind(v)
            .bind(set.bars as i32)
            .execute(&mut *tx)
            .await?;
            sqlx::query(
                "INSERT INTO realized_vol_history (symbol, day, estimator, window_bars, value) VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (symbol, day, estimator, window_bars) DO UPDATE SET value = EXCLUDED.value",
            )
            .bind(&u.symbol)
            .bind(naive(day))
            .bind(est)
            .bind(win)
            .bind(v)
            .execute(&mut *tx)
            .await?;
            written += 1;
        }
        tx.commit().await?;
    }
    if written > 0 {
        let mut tx = st.pool.begin().await?;
        store::bump(&mut tx).await?;
        tx.commit().await?;
        st.reload(true).await?;
    }
    if written == 0 && errors > 0 {
        anyhow::bail!("market-data candles unavailable for every underlying");
    }
    Ok(written)
}

/* ------------------------------------------------------------------ */
/* End-of-day marks                                                    */
/* ------------------------------------------------------------------ */

/// After 17:00 New York on a weekday, stores the model marks of every active series once per day.
pub async fn eod_marks(st: &AppState) -> anyhow::Result<usize> {
    let now = Utc::now();
    let ms = now.timestamp_millis();
    let z = Zone::NewYork;
    let day = z.local_date(ms);
    if day.weekday().is_weekend() || z.local_minute_of_day(ms) < 17 * 60 {
        return Ok(0);
    }
    let done: Option<i32> = sqlx::query_scalar("SELECT 1 FROM marks_eod WHERE day = $1 LIMIT 1").bind(naive(day)).fetch_optional(&st.pool).await?;
    if done.is_some() {
        return Ok(0);
    }
    let rd = st.refdata().await;
    let mut n = 0;
    let mut tx = st.pool.begin().await?;
    for e in rd.expiries.iter().filter(|e| e.status == "listed") {
        let Some(u) = rd.underlying(&e.symbol) else { continue };
        let Some(spot) = st.spots.get(&e.symbol).await else { continue };
        let usd = st.spots.usd_per(&u.quote_ccy).await;
        let Ok(ctx) = pricing::context(&rd, u, e, Some(spot.mid), usd, ms, None) else { continue };
        let gs = rd.group(crate::model::PLATFORM_TENANT, "*", &u.symbol);
        for s in rd.series_of(e.id).filter(|s| s.status == "active") {
            let q = pricing::quote(&ctx, u, s, &gs, crate::model::TradeState::Open);
            sqlx::query(
                "INSERT INTO marks_eod (day, series_code, spot, vol, mark, mark_usd, delta, gamma, vega, theta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
            )
            .bind(naive(day))
            .bind(&s.code)
            .bind(ctx.spot)
            .bind(q.iv)
            .bind(q.mark)
            .bind(q.mark_usd)
            .bind(q.delta)
            .bind(q.gamma)
            .bind(q.vega)
            .bind(q.theta)
            .execute(&mut *tx)
            .await?;
            n += 1;
        }
    }
    tx.commit().await?;
    if n > 0 {
        tracing::info!(day = %day, marks = n, "end-of-day marks stored");
    }
    Ok(n)
}

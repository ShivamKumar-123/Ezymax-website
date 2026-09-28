//! History backfill from the provider, rate-limited and resumable.
//!
//! Phase 1 (quick): latest 500 bars of M1, M5, M15, M30, H1 and D1 for every symbol, so charts work immediately.
//! Phase 2 (deep): page back to the configured depth per timeframe, remembering progress in `backfill_state`.
//! H4 and D1 are then aggregated from our H1 bars at New York close (W1/MN from D1). Before our H1 coverage,
//! provider daily bars (UTC days) are used for D1, labelled with the matching server day.

use chrono::{DateTime, Duration, NaiveDate, TimeZone, Utc};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::db::{self, Bar, Source};
use crate::instruments::Instrument;
use crate::state::Market;
use crate::timeframes::Tf;

struct Provider {
    http: reqwest::Client,
    base: String,
    key: String,
    gap: std::time::Duration,
    last: Mutex<tokio::time::Instant>,
}

impl Provider {
    async fn throttle(&self) {
        let mut last = self.last.lock().await;
        let next = *last + self.gap;
        let now = tokio::time::Instant::now();
        if next > now {
            tokio::time::sleep_until(next).await;
        }
        *last = tokio::time::Instant::now();
    }

    /// Up to 500 bars ending at `before` (or the latest when None), ascending.
    async fn klines(&self, inst: &Instrument, kline: i32, before: Option<DateTime<Utc>>) -> anyhow::Result<Vec<Bar>> {
        self.throttle().await;
        let mut body = json!({"klineType": kline, "klineNum": 500, "codes": inst.provider.code});
        if let Some(b) = before {
            body["timestamp"] = json!(b.timestamp());
        }
        let url = format!("{}/{}/v2/batch_kline", self.base, inst.provider.market);
        let v: Value = self.http.post(&url).header("apiKey", &self.key).json(&body).send().await?.json().await?;
        let ret = v["ret"].as_i64().unwrap_or(0);
        if ret != 200 {
            anyhow::bail!("provider ret {ret}: {}", v["msg"].as_str().unwrap_or(""));
        }
        let mut out = parse_bars(&v["data"][0]["respList"]);
        out.sort_by_key(|b| b.t);
        out.dedup_by_key(|b| b.t);
        Ok(out)
    }

    /// Latest `n` bars for every code of one provider market in a single request.
    async fn latest_batch(&self, market: &str, codes: &[String], kline: i32, n: i32) -> anyhow::Result<Vec<(String, Vec<Bar>)>> {
        self.throttle().await;
        let body = json!({"klineType": kline, "klineNum": n, "codes": codes.join(",")});
        let url = format!("{}/{}/v2/batch_kline", self.base, market);
        let v: Value = self.http.post(&url).header("apiKey", &self.key).json(&body).send().await?.json().await?;
        let ret = v["ret"].as_i64().unwrap_or(0);
        if ret != 200 {
            anyhow::bail!("provider ret {ret}: {}", v["msg"].as_str().unwrap_or(""));
        }
        Ok(v["data"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|d| Some((d["s"].as_str()?.to_string(), parse_bars(&d["respList"]))))
            .collect())
    }
}

fn parse_bars(list: &Value) -> Vec<Bar> {
    let p = |x: &Value| x.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| x.as_f64()).unwrap_or(0.0);
    list.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|r| {
                    let t = r["t"].as_str().and_then(|s| s.parse::<i64>().ok()).or_else(|| r["t"].as_i64())?;
                    Some(Bar { t: Utc.timestamp_opt(t, 0).single()?, o: p(&r["o"]), h: p(&r["h"]), l: p(&r["l"]), c: p(&r["c"]), v: p(&r["v"]) })
                })
                .filter(|b| b.o > 0.0 && b.h >= b.l)
                .collect()
        })
        .unwrap_or_default()
}

pub fn spawn(cfg: &Config, market: Arc<Market>) {
    let provider = Arc::new(Provider {
        http: reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build().expect("http client"),
        base: cfg.infoway_rest.clone(),
        key: cfg.infoway_key.clone(),
        gap: std::time::Duration::from_secs_f64(1.0 / cfg.provider_rps.max(0.1)),
        last: Mutex::new(tokio::time::Instant::now() - std::time::Duration::from_secs(5)),
    });
    {
        let (pv, mk) = (provider.clone(), market.clone());
        tokio::spawn(async move { reconcile_loop(&pv, &mk).await });
    }
    let cfg = cfg.clone();
    tokio::spawn(async move {
        if let Err(e) = run(&cfg, &provider, &market).await {
            tracing::error!(error = %e, "backfill stopped");
        }
    });
}

const DIRECT: [Tf; 5] = [Tf::M1, Tf::M5, Tf::M15, Tf::M30, Tf::H1];

async fn run(cfg: &Config, pv: &Provider, mk: &Arc<Market>) -> anyhow::Result<()> {
    let list = mk.cat.list.clone();
    // ---- phase 1: latest bars everywhere ----
    for inst in &list {
        for tf in DIRECT {
            match pv.klines(inst, tf.provider_kline().unwrap(), None).await {
                Ok(bars) if !bars.is_empty() => {
                    store_final(mk, inst, tf, &bars).await?;
                    seed_current(mk, inst, tf, &bars);
                }
                Ok(_) => tracing::warn!(symbol = %inst.symbol, tf = tf.name(), "provider returned no history"),
                Err(e) => tracing::warn!(symbol = %inst.symbol, tf = tf.name(), error = %e, "history request failed"),
            }
        }
        aggregate_higher(mk, inst, None).await?;
        daily_before_h1(pv, mk, inst, None).await?;
        tracing::info!(symbol = %inst.symbol, "quick backfill done");
    }
    tracing::info!("phase 1 complete — charts available for all symbols");

    // ---- phase 2: deep history, resumable ----
    let now = Utc::now();
    for (minutes, days) in cfg.backfill_days {
        let tf = Tf::from_minutes(minutes).unwrap();
        for inst in &list {
            deep(pv, mk, inst, tf, now - Duration::days(days)).await?;
        }
    }
    let from = NaiveDate::parse_from_str(&cfg.backfill_daily_from, "%Y-%m-%d").unwrap_or(NaiveDate::from_ymd_opt(2012, 1, 1).unwrap());
    let from = Utc.from_utc_datetime(&from.and_hms_opt(0, 0, 0).unwrap());
    for inst in &list {
        daily_before_h1(pv, mk, inst, Some(from)).await?;
    }
    tracing::info!("phase 2 complete — full history stored");
    Ok(())
}

async fn store(mk: &Market, inst: &Instrument, tf: Tf, bars: &[Bar], src: Source) -> anyhow::Result<()> {
    let rows: Vec<(String, i32, Bar)> = bars.iter().map(|b| (inst.symbol.clone(), tf.minutes(), *b)).collect();
    db::upsert_bars(&mk.pool, &rows, src).await
}

/// Provider bars that have closed are final (Reconciled); only the one still forming merges with live data.
async fn store_final(mk: &Market, inst: &Instrument, tf: Tf, bars: &[Bar]) -> anyhow::Result<()> {
    let current = tf.bucket(Utc::now());
    let (closed, forming): (Vec<Bar>, Vec<Bar>) = bars.iter().partition(|b| b.t < current);
    store(mk, inst, tf, &closed, Source::Reconciled).await?;
    store(mk, inst, tf, &forming, Source::Provider).await
}

/// If the provider's newest bar is the one still forming, seed our live builder with its true open/high/low.
fn seed_current(mk: &Market, inst: &Instrument, tf: Tf, bars: &[Bar]) {
    if let Some(last) = bars.last() {
        if last.t == tf.bucket(Utc::now()) {
            mk.seed_forming(&inst.symbol, tf, *last);
        }
    }
}

async fn deep(pv: &Provider, mk: &Arc<Market>, inst: &Instrument, tf: Tf, target: DateTime<Utc>) -> anyhow::Result<()> {
    let key_tf = tf.minutes();
    let done: Option<bool> = sqlx::query_scalar("SELECT done FROM backfill_state WHERE symbol = $1 AND tf = $2 AND target_t <= $3")
        .bind(&inst.symbol)
        .bind(key_tf)
        .bind(target)
        .fetch_optional(&mk.pool)
        .await?;
    if done == Some(true) {
        return Ok(());
    }
    loop {
        let Some(oldest) = db::oldest_bar(&mk.pool, &inst.symbol, key_tf).await? else { break };
        if oldest <= target {
            break;
        }
        let bars = match pv.klines(inst, tf.provider_kline().unwrap(), Some(oldest - Duration::seconds(1))).await {
            Ok(b) => b,
            Err(e) => {
                tracing::warn!(symbol = %inst.symbol, tf = tf.name(), error = %e, "deep history stopped (plan limit or no more data)");
                break;
            }
        };
        let older: Vec<Bar> = bars.into_iter().filter(|b| b.t < oldest).collect();
        if older.is_empty() {
            break;
        }
        store_final(mk, inst, tf, &older).await?;
        if tf == Tf::H1 {
            aggregate_higher(mk, inst, Some(older[0].t)).await?;
        }
    }
    sqlx::query(
        "INSERT INTO backfill_state (symbol, tf, oldest_t, target_t, done, updated_at) VALUES ($1,$2,(SELECT min(t) FROM candles WHERE symbol=$1 AND tf=$2),$3,TRUE,now())
         ON CONFLICT (symbol, tf) DO UPDATE SET oldest_t = EXCLUDED.oldest_t, target_t = EXCLUDED.target_t, done = TRUE, updated_at = now()",
    )
    .bind(&inst.symbol)
    .bind(key_tf)
    .bind(target)
    .execute(&mk.pool)
    .await?;
    tracing::info!(symbol = %inst.symbol, tf = tf.name(), "deep history complete");
    Ok(())
}

/// Aggregate `src` bars into `dst` buckets. Buckets starting before the oldest source bar are skipped (incomplete).
fn aggregate(src: &[Bar], dst: Tf, src_oldest: DateTime<Utc>) -> Vec<Bar> {
    let mut map: BTreeMap<DateTime<Utc>, Bar> = BTreeMap::new();
    for b in src {
        let k = dst.bucket(b.t);
        if k < src_oldest {
            continue;
        }
        map.entry(k)
            .and_modify(|a| {
                a.h = a.h.max(b.h);
                a.l = a.l.min(b.l);
                a.c = b.c;
                a.v += b.v;
            })
            .or_insert(Bar { t: k, ..*b });
    }
    map.into_values().collect()
}

/// H4 & D1 from H1, then W1 & MN from D1 — for bars at or after `from` (None = everything).
async fn aggregate_higher(mk: &Market, inst: &Instrument, from: Option<DateTime<Utc>>) -> anyhow::Result<()> {
    let Some(h1_oldest) = db::oldest_bar(&mk.pool, &inst.symbol, Tf::H1.minutes()).await? else { return Ok(()) };
    let start = from.map(|f| Tf::W1.bucket(f)).unwrap_or(h1_oldest).max(h1_oldest);
    let h1 = db::load_bars(&mk.pool, &inst.symbol, Tf::H1.minutes(), None, Some(start - Duration::days(35)), 1_000_000).await?;
    for dst in [Tf::H4, Tf::D1] {
        let bars = aggregate(&h1, dst, h1_oldest);
        store(mk, inst, dst, &bars, Source::Aggregated).await?;
        seed_current(mk, inst, dst, &bars);
    }
    let Some(d1_oldest) = db::oldest_bar(&mk.pool, &inst.symbol, Tf::D1.minutes()).await? else { return Ok(()) };
    let d1 = db::load_bars(&mk.pool, &inst.symbol, Tf::D1.minutes(), None, Some(Tf::MN.bucket(start) - Duration::days(1)), 1_000_000).await?;
    for dst in [Tf::W1, Tf::MN] {
        let bars = aggregate(&d1, dst, d1_oldest);
        store(mk, inst, dst, &bars, Source::Aggregated).await?;
        seed_current(mk, inst, dst, &bars);
    }
    Ok(())
}

/// Provider daily history for days older than our H1 coverage (labelled with the matching server day).
async fn daily_before_h1(pv: &Provider, mk: &Market, inst: &Instrument, until: Option<DateTime<Utc>>) -> anyhow::Result<()> {
    let Some(h1_oldest) = db::oldest_bar(&mk.pool, &inst.symbol, Tf::H1.minutes()).await? else { return Ok(()) };
    let first_full_day = Tf::D1.bucket(h1_oldest) + Duration::days(1);
    let mut before: Option<DateTime<Utc>> = None;
    loop {
        let bars = match pv.klines(inst, 8, before).await {
            Ok(b) => b,
            Err(e) => {
                tracing::warn!(symbol = %inst.symbol, error = %e, "daily history stopped");
                break;
            }
        };
        if bars.is_empty() {
            break;
        }
        let oldest = bars[0].t;
        // UTC day D → server day D (bucket containing D 12:00 UTC)
        let shifted: Vec<Bar> = bars.iter().map(|b| Bar { t: Tf::D1.bucket(b.t + Duration::hours(12)), ..*b }).filter(|b| b.t < first_full_day).collect();
        store(mk, inst, Tf::D1, &shifted, Source::Provider).await?;
        match until {
            Some(u) if oldest > u && before != Some(oldest) => before = Some(oldest - Duration::seconds(1)),
            _ => break,
        }
    }
    // weekly/monthly over the whole daily range
    let Some(d1_oldest) = db::oldest_bar(&mk.pool, &inst.symbol, Tf::D1.minutes()).await? else { return Ok(()) };
    let d1 = db::load_bars(&mk.pool, &inst.symbol, Tf::D1.minutes(), None, None, 1_000_000).await?;
    for dst in [Tf::W1, Tf::MN] {
        let bars = aggregate(&d1, dst, d1_oldest);
        store(mk, inst, dst, &bars, Source::Aggregated).await?;
    }
    Ok(())
}

/// Every closed bar is replaced by the provider's final OHLC, so each candle is identical to the market
/// source (live ticks can arrive late or be missed). Runs 4s and again 40s after every minute boundary
/// (in case the provider finalises late): M1 each minute, M5/M15/M30/H1 when they close, then
/// H4/D1/W1/MN rebuilt from the corrected bars.
async fn reconcile_loop(pv: &Provider, mk: &Arc<Market>) {
    let markets: Vec<(String, Vec<String>)> = mk.cat.markets().into_iter().map(|m| { let c = mk.cat.codes_for(&m); (m, c) }).collect();
    loop {
        let now = Utc::now();
        let minute = Tf::M1.bucket(now);
        let (boundary, at) = if now < minute + Duration::seconds(40) { (minute, minute + Duration::seconds(40)) } else { (minute + Duration::minutes(1), minute + Duration::seconds(64)) };
        let (boundary, at) = if now < minute + Duration::seconds(4) { (minute, minute + Duration::seconds(4)) } else { (boundary, at) };
        tokio::time::sleep((at - now).to_std().unwrap_or_default()).await;
        for tf in DIRECT.into_iter().filter(|tf| tf.bucket(boundary) == boundary) {
            for (market, codes) in &markets {
                if codes.is_empty() {
                    continue;
                }
                match pv.latest_batch(market, codes, tf.provider_kline().unwrap(), 3).await {
                    Ok(list) => {
                        for (code, bars) in list {
                            let Some(inst) = mk.cat.from_provider(market, &code) else { continue };
                            let closed: Vec<Bar> = bars.into_iter().filter(|b| b.t < boundary).collect();
                            if let Err(e) = store(mk, inst, tf, &closed, Source::Reconciled).await {
                                tracing::warn!(error = %e, "reconcile store failed");
                            }
                            for b in &closed {
                                mk.absorb_closed(&inst.symbol, tf, *b);
                            }
                            if tf == Tf::H1 {
                                if let Err(e) = reconcile_higher(mk, inst, boundary).await {
                                    tracing::warn!(symbol = %inst.symbol, error = %e, "higher-timeframe reconcile failed");
                                }
                            }
                        }
                    }
                    Err(e) => tracing::warn!(%market, tf = tf.name(), error = %e, "reconcile request failed"),
                }
            }
        }
    }
}

/// After an H1 close at `end`: any H4/D1 bucket that just closed is rebuilt from the reconciled H1 bars,
/// and any W1/MN bucket that just closed from the D1 bars — all marked final.
async fn reconcile_higher(mk: &Market, inst: &Instrument, end: DateTime<Utc>) -> anyhow::Result<()> {
    for (dst, src) in [(Tf::H4, Tf::H1), (Tf::D1, Tf::H1), (Tf::W1, Tf::D1), (Tf::MN, Tf::D1)] {
        if dst.bucket(end) != end {
            continue;
        }
        let start = dst.bucket(end - Duration::seconds(1));
        let Some(src_oldest) = db::oldest_bar(&mk.pool, &inst.symbol, src.minutes()).await? else { continue };
        let bars = db::load_bars(&mk.pool, &inst.symbol, src.minutes(), Some(end - Duration::seconds(1)), Some(start), 10_000).await?;
        let agg: Vec<Bar> = aggregate(&bars, dst, src_oldest).into_iter().filter(|b| b.t == start).collect();
        store(mk, inst, dst, &agg, Source::Reconciled).await?;
    }
    Ok(())
}

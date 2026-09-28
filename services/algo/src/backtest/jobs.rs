//! Backtest job queue: jobs are rows in `backtests` (so a restart re-queues what was running), claimed with
//! `FOR UPDATE SKIP LOCKED` by `ALGO_BACKTEST_WORKERS` workers. Each job loads history from market-data,
//! runs the simulation on a blocking thread with a CPU-time budget, and stores the report.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use sqlx::Row;

use super::sim::{self, Config, Data};
use crate::dsl::eval::Frame;
use crate::indicators::Bar;
use crate::specs::{server_offset_secs, tf_secs, ts};
use crate::state::AppState;
use crate::strategy::load_version;

/// Longest range per strategy timeframe (days) and the bar cap for one job.
pub fn max_days(tf: &str) -> i64 {
    match tf {
        "M1" => 60,
        "M5" => 365,
        "M15" => 730,
        "M30" => 1095,
        "H1" => 1826,
        "H4" => 3653,
        _ => 7305,
    }
}
pub const MAX_BARS: usize = 400_000;

pub fn spawn(st: AppState) {
    let n = st.cfg.backtest_workers;
    tokio::spawn({
        let st = st.clone();
        async move {
            let r = sqlx::query("UPDATE backtests SET status = 'queued', progress = 0, stage = 'requeued after restart' WHERE status = 'running'").execute(&st.pool).await;
            if let Ok(r) = r
                && r.rows_affected() > 0
            {
                tracing::info!(jobs = r.rows_affected(), "re-queued interrupted backtests");
            }
            st.jobs_wake.notify_waiters();
        }
    });
    for w in 0..n {
        let st = st.clone();
        tokio::spawn(async move {
            loop {
                match claim(&st).await {
                    Ok(Some(id)) => {
                        let started = Instant::now();
                        if let Err(e) = run(&st, id).await {
                            tracing::warn!(job = id, error = %e, "backtest failed");
                            let _ = sqlx::query("UPDATE backtests SET status = 'failed', error = $2, finished_at = now(), cpu_ms = $3 WHERE id = $1 AND status = 'running'")
                                .bind(id)
                                .bind(e.to_string())
                                .bind(started.elapsed().as_millis() as i64)
                                .execute(&st.pool)
                                .await;
                        }
                        st.cancels.lock().unwrap().remove(&id);
                    }
                    Ok(None) => {
                        let _ = tokio::time::timeout(Duration::from_secs(3), st.jobs_wake.notified()).await;
                    }
                    Err(e) => {
                        tracing::warn!(worker = w, error = %e, "backtest queue");
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                }
            }
        });
    }
}

async fn claim(st: &AppState) -> anyhow::Result<Option<i64>> {
    Ok(sqlx::query_scalar(
        "UPDATE backtests SET status = 'running', started_at = now(), stage = 'loading data', progress = 0
         WHERE id = (SELECT id FROM backtests WHERE status = 'queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id",
    )
    .fetch_optional(&st.pool)
    .await?)
}

async fn stage(st: &AppState, id: i64, s: &str, p: f32) {
    let _ = sqlx::query("UPDATE backtests SET stage = $2, progress = $3 WHERE id = $1").bind(id).bind(s).bind(p).execute(&st.pool).await;
}

/// Aggregates lower-timeframe bars into `tf` buckets (M1–H1 on UTC boundaries, H4 / D1 at New York close).
pub fn aggregate(bars: &[Bar], tf: &str) -> Vec<Bar> {
    let secs = tf_secs(tf).unwrap_or(3600);
    let bucket = |t: i64| -> i64 {
        if matches!(tf, "H4" | "D1") {
            let off = server_offset_secs(ts(t));
            (t + off).div_euclid(secs) * secs - off
        } else {
            t.div_euclid(secs) * secs
        }
    };
    let mut out: Vec<Bar> = vec![];
    for b in bars {
        let k = bucket(b.t);
        match out.last_mut() {
            Some(x) if x.t == k => {
                x.h = x.h.max(b.h);
                x.l = x.l.min(b.l);
                x.c = b.c;
                x.v += b.v;
            }
            _ => out.push(Bar { t: k, ..*b }),
        }
    }
    out
}

const LOWER: [&str; 6] = ["H4", "H1", "M30", "M15", "M5", "M1"];

/// History for [from, to] in `tf`, filling a missing older part from lower timeframes when possible.
async fn load(st: &AppState, symbol: &str, tf: &str, from: i64, to: i64) -> anyhow::Result<(Vec<Bar>, Vec<Value>)> {
    let secs = tf_secs(tf).unwrap_or(3600);
    let mut bars = st.md.range(symbol, tf, from, to, MAX_BARS).await?;
    let mut coverage = vec![];
    if let Some(first) = bars.first().map(|b| b.t) {
        coverage.push(json!({"tf": tf, "source": "native", "from": first, "to": bars.last().map(|b| b.t)}));
    }
    let mut first = bars.first().map(|b| b.t).unwrap_or(to + 1);
    if first > from + secs * 2 && !matches!(tf, "W1" | "MN") {
        for lower in LOWER.iter().filter(|l| tf_secs(l).unwrap_or(0) < secs && secs % tf_secs(l).unwrap_or(1) == 0) {
            if first <= from + secs * 2 {
                break;
            }
            let lb = st.md.range(symbol, lower, from, first - 1, MAX_BARS).await?;
            if lb.is_empty() {
                continue;
            }
            let mut agg = aggregate(&lb, tf);
            agg.retain(|b| b.t < first);
            // the last bucket may be partial at the seam: drop it unless complete
            if let Some(last) = agg.last()
                && last.t + secs > first
            {
                agg.pop();
            }
            if agg.is_empty() {
                continue;
            }
            coverage.insert(0, json!({"tf": tf, "source": format!("built from {lower}"), "from": agg[0].t, "to": agg.last().map(|b| b.t)}));
            first = agg[0].t;
            agg.extend(bars);
            bars = agg;
        }
    }
    Ok((bars, coverage))
}

struct Costs {
    spread: f64,
    commission: f64,
    swaps: bool,
    quote_usd: f64,
    usd_base: bool,
    group: String,
    spread_source: &'static str,
}

async fn costs(st: &AppState, tenant: &str, user: i64, p: &Value, sp: &crate::specs::Spec) -> anyhow::Result<Costs> {
    let groups = st.engine.groups(tenant).await.unwrap_or_default();
    let mut group_code = p.get("group").and_then(Value::as_str).unwrap_or("standard").to_string();
    if let Some(login) = p.get("login").and_then(Value::as_i64)
        && let Ok(Some(a)) = st.engine.account(tenant, user, login).await
        && let Some(g) = a.pointer("/account/group").and_then(Value::as_str)
    {
        group_code = g.to_string();
    }
    let g = groups.iter().find(|g| g.get("code").and_then(Value::as_str) == Some(&group_code)).cloned().unwrap_or(json!({}));
    let spread_group = g.get("spreadGroup").and_then(Value::as_str).unwrap_or("standard").to_string();
    let mut syms = vec![sp.symbol.clone()];
    let pair = if sp.quote_ccy != "USD" && !sp.symbol.starts_with("USD") { st.specs.usd_pair(&sp.quote_ccy) } else { None };
    if let Some((s, _)) = &pair {
        syms.push(s.clone());
    }
    let quotes = st.md.quotes(&syms, &spread_group).await.unwrap_or_default();
    let (spread, spread_source) = match p.get("spreadPoints").and_then(Value::as_f64) {
        Some(pts) if pts >= 0.0 => (pts * sp.point, "fixed"),
        _ => match quotes.get(&sp.symbol) {
            Some(q) if q.ask > q.bid => (q.ask - q.bid, "group quote"),
            _ => (sp.base_spread, "catalogue"),
        },
    };
    let commission = match p.get("commissionPerLot").and_then(Value::as_f64) {
        Some(c) if c >= 0.0 => c,
        _ => sp.commission_per_lot.unwrap_or_else(|| g.get("commissionPerLot").and_then(Value::as_f64).unwrap_or(0.0)),
    };
    let quote_usd = match &pair {
        Some((s, direct)) => match quotes.get(s) {
            Some(q) if q.bid > 0.0 => {
                let mid = (q.bid + q.ask) / 2.0;
                if *direct { mid } else { 1.0 / mid }
            }
            _ => 1.0,
        },
        None => 1.0,
    };
    Ok(Costs {
        spread,
        commission,
        swaps: p.get("swaps").and_then(Value::as_bool).unwrap_or(true) && g.get("swapFree").and_then(Value::as_bool) != Some(true),
        quote_usd,
        usd_base: sp.quote_ccy != "USD" && sp.symbol.starts_with("USD"),
        group: group_code,
        spread_source,
    })
}

async fn run(st: &AppState, id: i64) -> anyhow::Result<()> {
    let started = Instant::now();
    let row = sqlx::query("SELECT tenant_id, user_id, version_id, params FROM backtests WHERE id = $1").bind(id).fetch_one(&st.pool).await?;
    let tenant: String = row.get("tenant_id");
    let user: i64 = row.get("user_id");
    let p: Value = row.get("params");
    let v = load_version(&st.pool, &tenant, row.get("version_id")).await?.ok_or_else(|| anyhow::anyhow!("strategy version not found"))?;
    let prog = v.program(&st.specs).map_err(anyhow::Error::msg)?;
    let sp = st.specs.get(&prog.spec.symbol).cloned().ok_or_else(|| anyhow::anyhow!("unknown symbol"))?;
    let from = p.get("from").and_then(Value::as_i64).unwrap_or(0);
    let to = p.get("to").and_then(Value::as_i64).unwrap_or(0);
    let tf = prog.spec.timeframe.clone();
    let secs = tf_secs(&tf).unwrap_or(3600);
    let warm = (prog.lookback as i64 + 50) * secs;
    // weekends / sessions: ask for more calendar time than the bar count needs
    let warm_from = from - warm * 2;

    stage(st, id, "loading history", 0.02).await;
    let (bars, mut coverage) = load(st, &sp.symbol, &tf, warm_from, to).await?;
    let tested = bars.iter().filter(|b| b.t >= from).count();
    if tested < 10 {
        anyhow::bail!("Not enough {tf} history for {} in this range ({tested} bars). Choose a later start date.", sp.symbol);
    }
    let mut others = HashMap::new();
    for htf in &prog.timeframes {
        let hs = tf_secs(htf).unwrap_or(3600);
        let (hb, cov) = load(st, &sp.symbol, htf, from - (prog.lookback as i64 + 50) * hs * 2, to).await?;
        coverage.extend(cov);
        others.insert(htf.clone(), Frame::new(htf, hb));
    }
    stage(st, id, "loading M1 for the intrabar model", 0.08).await;
    let m1 = if secs > 60 { st.md.range(&sp.symbol, "M1", from, to + secs, 200_000).await.unwrap_or_default() } else { vec![] };
    let c = costs(st, &tenant, user, &p, &sp).await?;
    let initial = p.get("initialBalance").and_then(Value::as_f64).unwrap_or(10_000.0);
    let cfg = Config {
        initial_balance: initial,
        from,
        to,
        spread: c.spread,
        commission_per_lot: c.commission,
        swaps: c.swaps,
        quote_usd_rate: c.quote_usd,
        usd_base: c.usd_base,
        deadline: Some(Instant::now() + Duration::from_secs(st.cfg.backtest_secs)),
    };
    let m1_from = m1.first().map(|b| b.t);
    let data = Data { base: Frame::new(&tf, bars), others, m1 };
    stage(st, id, "simulating", 0.12).await;

    let cancel = Arc::new(AtomicBool::new(false));
    st.cancels.lock().unwrap().insert(id, cancel.clone());
    let progress = Arc::new(AtomicU32::new(0));
    let done = Arc::new(AtomicBool::new(false));
    // progress flusher
    {
        let (st, progress, done) = (st.clone(), progress.clone(), done.clone());
        tokio::spawn(async move {
            while !done.load(Ordering::Relaxed) {
                tokio::time::sleep(Duration::from_millis(700)).await;
                let p = progress.load(Ordering::Relaxed) as f32 / 1000.0;
                let _ = sqlx::query("UPDATE backtests SET progress = $2 WHERE id = $1 AND status = 'running'").bind(id).bind(0.12 + p * 0.85).execute(&st.pool).await;
            }
        });
    }
    let (prog2, sp2, cancel2, progress2) = (prog.clone(), sp.clone(), cancel.clone(), progress.clone());
    let out = tokio::task::spawn_blocking(move || {
        let r = sim::run(&prog2, &sp2, &cfg, &data, &|f| progress2.store((f * 1000.0) as u32, Ordering::Relaxed), &cancel2);
        (r, data.m1.len())
    })
    .await?;
    done.store(true, Ordering::Relaxed);
    let (out, m1_len) = out;
    let out = match out {
        Ok(o) => o,
        Err(sim::SimError::Cancelled) => {
            sqlx::query("UPDATE backtests SET status = 'cancelled', finished_at = now(), stage = 'cancelled' WHERE id = $1").bind(id).execute(&st.pool).await?;
            return Ok(());
        }
        Err(sim::SimError::Timeout) => anyhow::bail!("The backtest exceeded its {} s CPU budget. Shorten the range or simplify the strategy.", st.cfg.backtest_secs),
        Err(sim::SimError::Eval(e)) => anyhow::bail!("Strategy error: {e}"),
    };
    let model = if out.intrabar_m1_bars > 0 {
        format!("M1 OHLC intrabar where M1 history exists ({} of {} bars with positions)", out.intrabar_m1_bars, out.bars_in_market)
    } else if secs == 60 {
        "M1 bars (OHLC)".to_string()
    } else {
        format!("{tf} bar OHLC (no M1 history for the range)")
    };
    let cov = json!({
        "requested": {"from": from, "to": to},
        "segments": coverage,
        "m1From": m1_from,
        "m1Bars": m1_len,
        "costs": {"group": c.group, "spread": c.spread, "spreadPoints": (c.spread / sp.point * 10.0).round() / 10.0, "spreadSource": c.spread_source, "commissionPerLot": c.commission, "swaps": c.swaps, "quoteToUsd": c.quote_usd, "usdBase": c.usd_base},
    });
    let mut report = super::report(&out, initial, &model, cov);
    if let Some(first) = out.first_bar
        && first > from + 7 * 86400
        && let Some(notes) = report["notes"].as_array_mut()
    {
        notes.insert(0, json!(format!("{tf} history for {} starts on {}: the test covers {} to {} instead of the full requested range.", sp.symbol, ts(first).format("%Y-%m-%d"), ts(first).format("%Y-%m-%d"), ts(out.last_bar.unwrap_or(to)).format("%Y-%m-%d"))));
    }
    let m = &report["metrics"];
    let summary = json!({
        "netProfit": m["netProfit"], "returnPct": m["returnPct"], "trades": m["trades"], "winRate": m["winRate"], "profitFactor": m["profitFactor"],
        "maxDrawdownPct": m["maxDrawdownPct"], "sharpe": m["sharpe"], "symbol": sp.symbol, "timeframe": tf, "firstBar": out.first_bar, "lastBar": out.last_bar,
    });
    sqlx::query("UPDATE backtests SET status = 'done', progress = 1, stage = 'done', report = $2, summary = $3, finished_at = now(), cpu_ms = $4 WHERE id = $1")
        .bind(id)
        .bind(report)
        .bind(summary)
        .bind(started.elapsed().as_millis() as i64)
        .execute(&st.pool)
        .await?;
    tracing::info!(job = id, symbol = %sp.symbol, tf = %tf, trades = out.trades.len(), ms = started.elapsed().as_millis() as u64, "backtest done");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregates_m15_to_h1_and_d1_at_ny_close() {
        let t0 = 1_789_948_800; // Mon 2026-09-21 00:00 UTC
        let m15: Vec<Bar> = (0..8).map(|i| Bar { t: t0 + i * 900, o: i as f64, h: i as f64 + 1.0, l: i as f64 - 1.0, c: i as f64 + 0.5, v: 1.0 }).collect();
        let h1 = aggregate(&m15, "H1");
        assert_eq!(h1.len(), 2);
        assert_eq!((h1[0].t, h1[0].o, h1[0].h, h1[0].l, h1[0].c, h1[0].v), (t0, 0.0, 4.0, -1.0, 3.5, 4.0));
        // D1 buckets start at 21:00 UTC during US DST (server midnight GMT+3)
        let h: Vec<Bar> = (0..30).map(|i| Bar { t: t0 + i * 3600, o: 1.0, h: 1.0, l: 1.0, c: 1.0, v: 0.0 }).collect();
        let d1 = aggregate(&h, "D1");
        assert_eq!(d1[1].t, t0 + 21 * 3600);
    }
}

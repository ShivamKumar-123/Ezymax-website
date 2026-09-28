//! Backtest report (D86): metrics, equity / drawdown curve, monthly returns.

use chrono::Datelike;
use serde::Serialize;
use serde_json::{Value, json};

use super::sim::{EquityPoint, Output, Trade};

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub initial_balance: f64,
    pub final_balance: f64,
    pub net_profit: f64,
    pub return_pct: f64,
    pub cagr_pct: Option<f64>,
    pub gross_profit: f64,
    pub gross_loss: f64,
    pub profit_factor: Option<f64>,
    pub trades: usize,
    pub wins: usize,
    pub losses: usize,
    pub win_rate: f64,
    pub long_trades: usize,
    pub long_win_rate: f64,
    pub short_trades: usize,
    pub short_win_rate: f64,
    pub avg_win: f64,
    pub avg_loss: f64,
    pub largest_win: f64,
    pub largest_loss: f64,
    pub expectancy: f64,
    pub payoff_ratio: Option<f64>,
    pub max_consecutive_wins: usize,
    pub max_consecutive_losses: usize,
    pub max_drawdown: f64,
    pub max_drawdown_pct: f64,
    pub recovery_factor: Option<f64>,
    pub sharpe: Option<f64>,
    pub sortino: Option<f64>,
    pub avg_bars_held: f64,
    pub exposure_pct: f64,
    pub total_commission: f64,
    pub total_swap: f64,
    pub spread_cost: f64,
    pub bars_tested: usize,
}

fn r2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

pub fn compute(o: &Output, initial: f64) -> Metrics {
    let t: &[Trade] = &o.trades;
    let wins: Vec<&Trade> = t.iter().filter(|x| x.net > 0.0).collect();
    let losses: Vec<&Trade> = t.iter().filter(|x| x.net <= 0.0).collect();
    let gp: f64 = wins.iter().map(|x| x.net).sum();
    let gl: f64 = losses.iter().map(|x| x.net).sum();
    let net = o.final_balance - initial;
    let side = |s: &str| {
        let v: Vec<&Trade> = t.iter().filter(|x| x.side == s).collect();
        let w = v.iter().filter(|x| x.net > 0.0).count();
        (v.len(), if v.is_empty() { 0.0 } else { w as f64 / v.len() as f64 * 100.0 })
    };
    let (lt, lwr) = side("buy");
    let (st, swr) = side("sell");
    let (mut cw, mut cl, mut mcw, mut mcl) = (0, 0, 0, 0);
    for x in t {
        if x.net > 0.0 {
            cw += 1;
            cl = 0;
        } else {
            cl += 1;
            cw = 0;
        }
        mcw = mcw.max(cw);
        mcl = mcl.max(cl);
    }
    let (dd, dd_pct) = drawdown(&o.equity, initial);
    // daily returns → Sharpe / Sortino (annualised with 252 trading days)
    let mut rets = vec![];
    let mut prev = initial;
    for (_, e) in &o.daily {
        if prev > 0.0 {
            rets.push(e / prev - 1.0);
        }
        prev = *e;
    }
    let (sharpe, sortino) = if rets.len() >= 5 {
        let mean = rets.iter().sum::<f64>() / rets.len() as f64;
        let sd = (rets.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / (rets.len() - 1) as f64).sqrt();
        let down: Vec<f64> = rets.iter().filter(|r| **r < 0.0).copied().collect();
        let dsd = (down.iter().map(|r| r.powi(2)).sum::<f64>() / rets.len() as f64).sqrt();
        (if sd > 0.0 { Some(r2(mean / sd * 252f64.sqrt())) } else { None }, if dsd > 0.0 { Some(r2(mean / dsd * 252f64.sqrt())) } else { None })
    } else {
        (None, None)
    };
    let years = match (o.first_bar, o.last_bar) {
        (Some(a), Some(b)) if b > a => (b - a) as f64 / (365.25 * 86400.0),
        _ => 0.0,
    };
    let cagr = if years >= 0.25 && o.final_balance > 0.0 && initial > 0.0 { Some(r2(((o.final_balance / initial).powf(1.0 / years) - 1.0) * 100.0)) } else { None };
    Metrics {
        initial_balance: initial,
        final_balance: o.final_balance,
        net_profit: r2(net),
        return_pct: if initial > 0.0 { r2(net / initial * 100.0) } else { 0.0 },
        cagr_pct: cagr,
        gross_profit: r2(gp),
        gross_loss: r2(gl),
        profit_factor: if gl < 0.0 { Some(r2(gp / -gl)) } else { None },
        trades: t.len(),
        wins: wins.len(),
        losses: losses.len(),
        win_rate: if t.is_empty() { 0.0 } else { r2(wins.len() as f64 / t.len() as f64 * 100.0) },
        long_trades: lt,
        long_win_rate: r2(lwr),
        short_trades: st,
        short_win_rate: r2(swr),
        avg_win: if wins.is_empty() { 0.0 } else { r2(gp / wins.len() as f64) },
        avg_loss: if losses.is_empty() { 0.0 } else { r2(gl / losses.len() as f64) },
        largest_win: r2(t.iter().map(|x| x.net).fold(0.0, f64::max)),
        largest_loss: r2(t.iter().map(|x| x.net).fold(0.0, f64::min)),
        expectancy: if t.is_empty() { 0.0 } else { r2(t.iter().map(|x| x.net).sum::<f64>() / t.len() as f64) },
        payoff_ratio: if !wins.is_empty() && !losses.is_empty() && gl < 0.0 { Some(r2((gp / wins.len() as f64) / (-gl / losses.len() as f64))) } else { None },
        max_consecutive_wins: mcw,
        max_consecutive_losses: mcl,
        max_drawdown: r2(dd),
        max_drawdown_pct: r2(dd_pct),
        recovery_factor: if dd > 0.0 { Some(r2(net / dd)) } else { None },
        sharpe,
        sortino,
        avg_bars_held: if t.is_empty() { 0.0 } else { r2(t.iter().map(|x| x.bars as f64).sum::<f64>() / t.len() as f64) },
        exposure_pct: if o.bars_tested == 0 { 0.0 } else { r2(o.bars_in_market as f64 / o.bars_tested as f64 * 100.0) },
        total_commission: r2(t.iter().map(|x| x.commission).sum()),
        total_swap: r2(t.iter().map(|x| x.swap).sum()),
        spread_cost: r2(o.spread_cost),
        bars_tested: o.bars_tested,
    }
}

/// Max peak-to-trough drop of equity (absolute and % of the peak).
pub fn drawdown(eq: &[EquityPoint], initial: f64) -> (f64, f64) {
    let mut peak = initial;
    let (mut dd, mut pct) = (0.0f64, 0.0f64);
    for p in eq {
        peak = peak.max(p.equity);
        let d = peak - p.equity;
        if d > dd {
            dd = d;
        }
        if peak > 0.0 {
            pct = pct.max(d / peak * 100.0);
        }
    }
    (dd, pct)
}

/// Equity + drawdown curve, down-sampled to at most `max` points (keeps each bucket's lowest equity so
/// the drawdown is not hidden).
pub fn curve(eq: &[EquityPoint], initial: f64, max: usize) -> Vec<Value> {
    let mut peak = initial;
    let full: Vec<(i64, f64, f64, f64)> = eq
        .iter()
        .map(|p| {
            peak = peak.max(p.equity);
            (p.t, p.balance, p.equity, if peak > 0.0 { r2((p.equity - peak) / peak * 100.0) } else { 0.0 })
        })
        .collect();
    if full.len() <= max {
        return full.iter().map(|(t, b, e, d)| json!({"t": t, "balance": b, "equity": e, "dd": d})).collect();
    }
    let step = full.len().div_ceil(max);
    let mut out: Vec<Value> = full
        .chunks(step)
        .map(|c| {
            let low = c.iter().min_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal)).unwrap();
            let last = c.last().unwrap();
            json!({"t": last.0, "balance": last.1, "equity": low.2.min(last.2), "dd": c.iter().map(|x| x.3).fold(0.0, f64::min)})
        })
        .collect();
    if let (Some(last), Some(v)) = (full.last(), out.last_mut()) {
        *v = json!({"t": last.0, "balance": last.1, "equity": last.2, "dd": last.3});
    }
    out
}

/// Monthly returns (% of the equity at the start of the month), per year, from server-day equity.
pub fn monthly(daily: &[(chrono::NaiveDate, f64)], initial: f64) -> Vec<Value> {
    use std::collections::BTreeMap;
    let mut month_end: BTreeMap<(i32, u32), f64> = BTreeMap::new();
    for (d, e) in daily {
        month_end.insert((d.year(), d.month()), *e);
    }
    let mut years: BTreeMap<i32, (Vec<Option<f64>>, f64, f64)> = BTreeMap::new();
    let mut prev = initial;
    for ((y, m), e) in &month_end {
        let entry = years.entry(*y).or_insert_with(|| (vec![None; 12], prev, prev));
        entry.0[(*m - 1) as usize] = Some(if prev > 0.0 { r2((e / prev - 1.0) * 100.0) } else { 0.0 });
        entry.2 = *e;
        prev = *e;
    }
    years
        .into_iter()
        .map(|(y, (months, start, end))| json!({"year": y, "months": months, "total": if start > 0.0 { r2((end / start - 1.0) * 100.0) } else { 0.0 }}))
        .collect()
}

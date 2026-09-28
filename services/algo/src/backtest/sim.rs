//! Backtest simulation (D80, D86).
//!
//! Model:
//! - Signals are evaluated on each CLOSED bar of the strategy timeframe (same evaluator as the runtime).
//!   A signal on bar i is executed at the open of bar i+1 (the runtime sends its market order right after
//!   the close), exits before entries.
//! - Bars are the raw mid price (market-data candles are built from the provider's raw price). The bid is
//!   bar − spread/2 and the ask bar + spread/2: buys fill at the ask and close at the bid, sells the reverse.
//!   The spread is the account group's current spread for the symbol (or the catalogue base spread).
//! - SL / TP / trailing / breakeven are simulated inside each bar along an OHLC path (bullish bar
//!   O→L→H→C, bearish O→H→L→C). When M1 history covers the bar, the path runs through every M1 bar
//!   (MT5 "1 minute OHLC" model); otherwise through the bar's own OHLC. A level already passed at the open
//!   of a path segment (a gap) fills at that open price, otherwise at the level.
//! - Commission: the group's round-turn commission per lot (or the symbol override), charged at entry,
//!   like the engine. Swaps: points per lot at every server-midnight rollover the position is open, with
//!   the triple day and weekend rules from trading-specs.json; skipped for swap-free groups.
//! - P&L converts from the quote currency to USD at the exit price (USD-base pairs) or at a fixed rate
//!   taken from current quotes (crosses, non-USD indices).
//! - Not modelled: margin / stop-out (the test stops if equity reaches 0), slippage, partial fills,
//!   requotes, tick-level spread widening.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use chrono::{Datelike, NaiveDate};
use serde::Serialize;

use crate::dsl::Program;
use crate::dsl::eval::{Evaluator, Frame, Signals};
use crate::indicators::{self as ind, Bar};
use crate::spec::Distance;
use crate::specs::{Spec, server_date, server_time, ts};

#[derive(Clone, Debug)]
pub struct Config {
    pub initial_balance: f64,
    /// First bar (unix seconds) that may trade; earlier bars only warm the indicators up.
    pub from: i64,
    pub to: i64,
    /// Spread in price units.
    pub spread: f64,
    /// Round-turn commission per lot (USD).
    pub commission_per_lot: f64,
    pub swaps: bool,
    /// Quote currency → USD rate for pairs that do not have USD on either side (1 for USD-quoted).
    pub quote_usd_rate: f64,
    /// The symbol's base currency is USD (USDJPY): convert at 1 / price.
    pub usd_base: bool,
    pub deadline: Option<Instant>,
}

pub struct Data {
    pub base: Frame,
    pub others: HashMap<String, Frame>,
    /// M1 bars for the intrabar model (may cover only part of the range).
    pub m1: Vec<Bar>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Trade {
    pub id: usize,
    pub side: &'static str,
    pub volume: f64,
    pub open_time: i64,
    pub open_price: f64,
    pub close_time: i64,
    pub close_price: f64,
    pub sl: Option<f64>,
    pub tp: Option<f64>,
    /// Price P&L in USD.
    pub profit: f64,
    pub commission: f64,
    pub swap: f64,
    /// profit + swap − commission.
    pub net: f64,
    pub reason: &'static str,
    pub bars: usize,
    /// Worst / best open P&L while the trade was open (USD, price P&L only).
    pub mae: f64,
    pub mfe: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct EquityPoint {
    pub t: i64,
    pub balance: f64,
    pub equity: f64,
}

#[derive(Clone, Debug)]
struct Pos {
    id: usize,
    dir: f64,
    volume: f64,
    open_time: i64,
    open: f64,
    sl: Option<f64>,
    tp: Option<f64>,
    trail: Option<f64>,
    be_done: bool,
    commission: f64,
    swap: f64,
    open_bar: usize,
    mae: f64,
    mfe: f64,
}

#[derive(Clone, Debug)]
enum Action {
    Close(Option<f64>, &'static str), // side filter (dir), reason
    Open(f64, usize),                 // dir, signal bar index
}

pub struct Output {
    pub trades: Vec<Trade>,
    pub equity: Vec<EquityPoint>,
    /// Equity at each server day end (for Sharpe / monthly returns).
    pub daily: Vec<(NaiveDate, f64)>,
    pub final_balance: f64,
    pub bars_tested: usize,
    pub bars_in_market: usize,
    pub intrabar_m1_bars: usize,
    pub signals: [usize; 4],
    pub skipped: HashMap<&'static str, usize>,
    pub spread_cost: f64,
    pub notes: Vec<String>,
    pub first_bar: Option<i64>,
    pub last_bar: Option<i64>,
}

#[derive(Debug)]
pub enum SimError {
    Eval(String),
    Cancelled,
    Timeout,
}

fn in_session(spec: &crate::spec::StrategySpec, t: i64) -> bool {
    let st = server_time(ts(t));
    let wd = st.weekday().num_days_from_sunday() as i64;
    if !spec.days.is_empty() && !spec.days.contains(&wd) {
        return false;
    }
    if spec.sessions.is_empty() {
        return true;
    }
    let mins = (st.timestamp().rem_euclid(86400) / 60) as i64;
    let m = |h: &str| h[..2].parse::<i64>().unwrap_or(0) * 60 + h[3..5].parse::<i64>().unwrap_or(0);
    spec.sessions.iter().any(|w| {
        let (a, b) = (m(&w.start), m(&w.end));
        if a <= b { mins >= a && mins < b } else { mins >= a || mins < b }
    })
}

pub fn run(p: &Program, sp: &Spec, cfg: &Config, data: &Data, progress: &dyn Fn(f64), cancel: &AtomicBool) -> Result<Output, SimError> {
    let spec = &p.spec;
    let bars = &data.base.bars;
    let secs = data.base.secs;
    let n = bars.len();
    let mut ev = Evaluator::new(&data.base, &data.others, cfg.deadline);
    let sig: Signals = ev.run(p).map_err(|e| match e {
        crate::dsl::eval::EvalError::Timeout => SimError::Timeout,
        e => SimError::Eval(e.to_string()),
    })?;
    let atr_cache: HashMap<i64, Vec<f64>> = [spec.sl.atr_period, spec.tp.atr_period, spec.trailing.atr_period].iter().map(|n| (*n, ind::atr(bars, (*n).max(1) as usize))).collect();

    let conv = |price: f64| if cfg.usd_base { if price > 0.0 { 1.0 / price } else { 0.0 } } else { cfg.quote_usd_rate };
    let money = |dist: f64, vol: f64, price: f64| dist * vol * sp.contract_size * conv(price);

    let mut out = Output {
        trades: vec![],
        equity: vec![],
        daily: vec![],
        final_balance: cfg.initial_balance,
        bars_tested: 0,
        bars_in_market: 0,
        intrabar_m1_bars: 0,
        signals: [0; 4],
        skipped: HashMap::new(),
        spread_cost: 0.0,
        notes: vec![],
        first_bar: None,
        last_bar: None,
    };
    let mut balance = cfg.initial_balance;
    let mut open: Vec<Pos> = vec![];
    let mut pending: Vec<Action> = vec![];
    let mut next_id = 1usize;
    let mut day: Option<NaiveDate> = None;
    let (mut trades_today, mut day_realized) = (0i64, 0.0f64);
    let mut m1_ptr = 0usize;
    let pt = sp.point;
    let spread = cfg.spread;
    let half = spread / 2.0;
    let mut blown = false;
    let start = bars.iter().position(|b| b.t >= cfg.from).unwrap_or(n);
    let total = n.saturating_sub(start).max(1);
    let mut last_close_day: Option<NaiveDate> = None;

    let close_pos = |pos: &Pos, price: f64, t: i64, reason: &'static str, i: usize, balance: &mut f64, out: &mut Output| -> f64 {
        let profit = money((price - pos.open) * pos.dir, pos.volume, price);
        let profit = (profit * 100.0).round() / 100.0;
        let net = profit + pos.swap - pos.commission;
        *balance += profit + pos.swap;
        out.trades.push(Trade {
            id: pos.id,
            side: if pos.dir > 0.0 { "buy" } else { "sell" },
            volume: pos.volume,
            open_time: pos.open_time,
            open_price: sp.round_price(pos.open),
            close_time: t,
            close_price: sp.round_price(price),
            sl: pos.sl.map(|v| sp.round_price(v)),
            tp: pos.tp.map(|v| sp.round_price(v)),
            profit,
            commission: pos.commission,
            swap: (pos.swap * 100.0).round() / 100.0,
            net: (net * 100.0).round() / 100.0,
            reason,
            bars: i.saturating_sub(pos.open_bar) + 1,
            mae: (pos.mae * 100.0).round() / 100.0,
            mfe: (pos.mfe * 100.0).round() / 100.0,
        });
        net
    };

    for i in start..n {
        if cancel.load(Ordering::Relaxed) {
            return Err(SimError::Cancelled);
        }
        if (i - start) % 512 == 0 {
            progress((i - start) as f64 / total as f64);
            if cfg.deadline.is_some_and(|d| Instant::now() > d) {
                return Err(SimError::Timeout);
            }
        }
        let b = bars[i];
        if b.t > cfg.to {
            break;
        }
        out.bars_tested += 1;
        out.first_bar.get_or_insert(b.t);
        out.last_bar = Some(b.t);
        let bar_close_t = b.t + secs;

        // server day roll (daily counters) at the bar's open
        let d_open = server_date(ts(b.t));
        if day != Some(d_open) {
            day = Some(d_open);
            trades_today = 0;
            day_realized = 0.0;
        }

        // 1. pending actions at this bar's open
        let acts = std::mem::take(&mut pending);
        for a in &acts {
            if let Action::Close(dir, reason) = a {
                let mut keep = vec![];
                for pos in open.drain(..) {
                    if dir.is_none_or(|d| d == pos.dir) {
                        let px = if pos.dir > 0.0 { b.o - half } else { b.o + half };
                        let net = close_pos(&pos, px, b.t, reason, i, &mut balance, &mut out);
                        day_realized += net;
                    } else {
                        keep.push(pos);
                    }
                }
                open = keep;
            }
        }
        for a in &acts {
            if let Action::Open(dir, sig_i) = a {
                let entry = if *dir > 0.0 { b.o + half } else { b.o - half };
                let atr_at = |n: i64| atr_cache.get(&n).and_then(|a| a.get(*sig_i)).copied().unwrap_or(f64::NAN);
                let dist = |d: &Distance, sl_dist: Option<f64>| -> Option<f64> {
                    match d.mode.as_str() {
                        "points" => Some(d.value * pt),
                        "pips" => Some(d.value * sp.pip_size),
                        "price" => Some(d.value),
                        "percent" => Some(entry * d.value / 100.0),
                        "atr" => Some(d.value * atr_at(d.atr_period)),
                        "level" => Some((entry - d.value).abs()),
                        "rr" => sl_dist.map(|s| s * d.value),
                        _ => None,
                    }
                };
                let sl_d = dist(&spec.sl, None);
                let tp_d = dist(&spec.tp, sl_d);
                if sl_d.is_some_and(|v| !(v > 0.0)) || tp_d.is_some_and(|v| !(v > 0.0)) {
                    *out.skipped.entry("stop distance not ready").or_default() += 1;
                    continue;
                }
                if spec.sl.mode == "level" && (if *dir > 0.0 { spec.sl.value >= entry } else { spec.sl.value <= entry }) {
                    *out.skipped.entry("SL level on the wrong side").or_default() += 1;
                    continue;
                }
                let mut vol = spec.sizing.lots;
                if spec.sizing.mode == "risk" {
                    let Some(sd) = sl_d else { continue };
                    let per_lot = money(sd, 1.0, entry);
                    vol = if per_lot > 0.0 { balance * spec.sizing.risk_pct / 100.0 / per_lot } else { 0.0 };
                }
                vol = vol.min(spec.max_lots);
                let Some(vol) = sp.floor_volume(vol) else {
                    *out.skipped.entry("volume below the minimum lot").or_default() += 1;
                    continue;
                };
                let trail = match spec.trailing.mode.as_str() {
                    "points" => Some(spec.trailing.value * pt),
                    "pips" => Some(spec.trailing.value * sp.pip_size),
                    "atr" => Some(spec.trailing.value * atr_at(spec.trailing.atr_period)).filter(|v| *v > 0.0),
                    _ => None,
                };
                let commission = (cfg.commission_per_lot * vol * 100.0).round() / 100.0;
                balance -= commission;
                out.spread_cost += money(spread, vol, entry);
                open.push(Pos {
                    id: next_id,
                    dir: *dir,
                    volume: vol,
                    open_time: b.t,
                    open: entry,
                    sl: sl_d.map(|d| sp.round_price(entry - dir * d)),
                    tp: tp_d.map(|d| sp.round_price(entry + dir * d)),
                    trail,
                    be_done: false,
                    commission,
                    swap: 0.0,
                    open_bar: i,
                    mae: 0.0,
                    mfe: 0.0,
                });
                next_id += 1;
                trades_today += 1;
            }
        }

        // 2. intrabar path: SL / TP / trailing / breakeven
        if !open.is_empty() {
            out.bars_in_market += 1;
            while m1_ptr < data.m1.len() && data.m1[m1_ptr].t < b.t {
                m1_ptr += 1;
            }
            let mut segs: Vec<Bar> = vec![];
            let mut k = m1_ptr;
            if secs > 60 {
                while k < data.m1.len() && data.m1[k].t < bar_close_t {
                    segs.push(data.m1[k]);
                    k += 1;
                }
            }
            if segs.is_empty() {
                segs.push(b);
            } else {
                out.intrabar_m1_bars += 1;
            }
            for seg in &segs {
                let path = if seg.c >= seg.o { [seg.o, seg.l, seg.h, seg.c] } else { [seg.o, seg.h, seg.l, seg.c] };
                for (pi, mid) in path.iter().enumerate() {
                    let mut still = vec![];
                    for mut pos in open.drain(..) {
                        let px = if pos.dir > 0.0 { mid - half } else { mid + half };
                        let gap = pi == 0;
                        let pl = money((px - pos.open) * pos.dir, pos.volume, px);
                        pos.mae = pos.mae.min(pl);
                        pos.mfe = pos.mfe.max(pl);
                        let hit_sl = pos.sl.is_some_and(|s| if pos.dir > 0.0 { px <= s } else { px >= s });
                        let hit_tp = pos.tp.is_some_and(|t| if pos.dir > 0.0 { px >= t } else { px <= t });
                        if hit_sl {
                            let fill = if gap { px } else { pos.sl.unwrap() };
                            let net = close_pos(&pos, fill, seg.t, "sl", i, &mut balance, &mut out);
                            day_realized += net;
                            continue;
                        }
                        if hit_tp {
                            let fill = if gap { px } else { pos.tp.unwrap() };
                            let net = close_pos(&pos, fill, seg.t, "tp", i, &mut balance, &mut out);
                            day_realized += net;
                            continue;
                        }
                        let profit_d = (px - pos.open) * pos.dir;
                        let be = spec.trailing.breakeven_trigger;
                        if be > 0.0 && !pos.be_done && profit_d >= be * pt {
                            pos.be_done = true;
                            let cand = sp.round_price(pos.open + pos.dir * spec.trailing.breakeven_offset * pt);
                            if pos.sl.is_none_or(|s| if pos.dir > 0.0 { cand > s } else { cand < s }) {
                                pos.sl = Some(cand);
                            }
                        }
                        if let Some(tr) = pos.trail
                            && profit_d >= tr
                        {
                            let cand = sp.round_price(px - pos.dir * tr);
                            if pos.sl.is_none_or(|s| if pos.dir > 0.0 { cand > s } else { cand < s }) {
                                pos.sl = Some(cand);
                            }
                        }
                        still.push(pos);
                    }
                    open = still;
                    if open.is_empty() {
                        break;
                    }
                }
                if open.is_empty() {
                    break;
                }
            }
        }

        // 3. swaps at every rollover passed during this bar
        let d_close = server_date(ts(bar_close_t));
        if cfg.swaps && !open.is_empty() {
            let mut d = server_date(ts(b.t));
            while d < d_close {
                let mult = sp.swap_multiplier(d);
                if mult > 0.0 {
                    for pos in open.iter_mut() {
                        let pts = if pos.dir > 0.0 { sp.swap_long } else { sp.swap_short };
                        pos.swap += pts * pt * sp.contract_size * pos.volume * conv(b.c) * mult;
                    }
                }
                d = d.succ_opt().unwrap();
            }
        }

        // 4. mark to market at the close
        let floating: f64 = open.iter().map(|pos| money(((if pos.dir > 0.0 { b.c - half } else { b.c + half }) - pos.open) * pos.dir, pos.volume, b.c) + pos.swap).sum();
        let equity = balance + floating;
        out.equity.push(EquityPoint { t: bar_close_t, balance: (balance * 100.0).round() / 100.0, equity: (equity * 100.0).round() / 100.0 });
        if last_close_day.is_some_and(|d| d != d_close) {
            out.daily.push((last_close_day.unwrap(), equity));
        }
        last_close_day = Some(d_close);
        if equity <= 0.0 {
            blown = true;
            for pos in std::mem::take(&mut open) {
                let px = if pos.dir > 0.0 { b.c - half } else { b.c + half };
                close_pos(&pos, px, bar_close_t, "stop_out", i, &mut balance, &mut out);
            }
            out.notes.push(format!("Equity reached zero on {}: the test stopped (margin and stop-out are not modelled).", ts(bar_close_t).format("%Y-%m-%d %H:%M")));
            break;
        }

        // 5. signals on the closed bar → actions at the next open
        if i + 1 >= n || bars[i + 1].t > cfg.to {
            continue;
        }
        let [buy, sell, xb, xs] = sig.at(i);
        for (k, on) in [buy, sell, xb, xs].into_iter().enumerate() {
            if on {
                out.signals[k] += 1;
            }
        }
        if xb && open.iter().any(|p| p.dir > 0.0) {
            pending.push(Action::Close(Some(1.0), "exit_rule"));
        }
        if xs && open.iter().any(|p| p.dir < 0.0) {
            pending.push(Action::Close(Some(-1.0), "exit_rule"));
        }
        let sess = in_session(spec, bar_close_t);
        if spec.close_outside_session && !sess && !open.is_empty() {
            pending.push(Action::Close(None, "session"));
        }
        if !(buy || sell) {
            continue;
        }
        let mut skip = |why: &'static str| *out.skipped.entry(why).or_default() += 1;
        if buy && sell {
            skip("buy and sell on the same bar");
            continue;
        }
        if !sess {
            skip("outside trading window");
            continue;
        }
        if !sp.is_open(ts(bars[i + 1].t)) {
            skip("market closed");
            continue;
        }
        if spec.max_trades_per_day > 0 && trades_today >= spec.max_trades_per_day {
            skip("daily trade limit");
            continue;
        }
        if spec.max_daily_loss > 0.0 && day_realized + floating <= -spec.max_daily_loss {
            skip("max daily loss");
            continue;
        }
        let closing_all = pending.iter().any(|a| matches!(a, Action::Close(None, _)));
        let remaining = if closing_all { 0 } else { open.iter().filter(|p| !pending.iter().any(|a| matches!(a, Action::Close(Some(d), _) if *d == p.dir))).count() };
        if spec.one_at_a_time && remaining > 0 {
            skip("position already open");
            continue;
        }
        if remaining >= 20 {
            skip("20 open positions");
            continue;
        }
        pending.push(Action::Open(if buy { 1.0 } else { -1.0 }, i));
    }
    // close what is still open at the last bar's close
    if !blown && let Some(last) = out.last_bar.and_then(|t| bars.iter().position(|b| b.t == t)) {
        let b = bars[last];
        for pos in std::mem::take(&mut open) {
            let px = if pos.dir > 0.0 { b.c - half } else { b.c + half };
            close_pos(&pos, px, b.t + secs, "end_of_test", last, &mut balance, &mut out);
        }
        if let Some(e) = out.equity.last_mut() {
            e.balance = (balance * 100.0).round() / 100.0;
            e.equity = e.balance;
        }
    }
    if let Some(d) = last_close_day {
        out.daily.push((d, balance));
    }
    out.final_balance = (balance * 100.0).round() / 100.0;
    progress(1.0);
    Ok(out)
}

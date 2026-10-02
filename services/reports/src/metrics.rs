//! Pure analytics maths (D91): trade statistics, equity curve index, drawdown, Sharpe / Sortino, groupings and
//! behaviour insights. No IO; every input is already in USD.

use std::collections::BTreeMap;

use chrono::{DateTime, Datelike, NaiveDate, Timelike, Utc};
use serde::Serialize;

use crate::time;

/// One closed trade (an exit deal): net = profit + swap − commission.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Trade {
    pub login: i64,
    pub deal: i64,
    pub ticket: i64,
    pub symbol: String,
    /// Position side: buy = long.
    pub side: String,
    pub volume: f64,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
    pub open_price: f64,
    pub close_price: f64,
    pub profit: f64,
    pub swap: f64,
    pub commission: f64,
    pub net: f64,
    pub reason: String,
    /// Account balance (USD) just before this trade was closed; 0 = unknown.
    pub balance_before: f64,
    /// Kalks FX Options trade: `volume` is contracts (never added to lots), prices are premiums per unit.
    pub option: bool,
}

impl Trade {
    /// Lots of the trade: CFD volume; option contracts are not lots.
    pub fn lots(&self) -> f64 {
        if self.option { 0.0 } else { self.volume }
    }
}

impl Trade {
    pub fn hold_secs(&self) -> f64 {
        (self.close_time - self.open_time).num_milliseconds().max(0) as f64 / 1000.0
    }
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TradeStats {
    pub trades: usize,
    pub wins: usize,
    pub losses: usize,
    pub win_rate: f64,
    pub gross_profit: f64,
    pub gross_loss: f64,
    pub net: f64,
    pub avg_win: f64,
    pub avg_loss: f64,
    /// Gross profit ÷ gross loss; `None` when there are no losses (infinite).
    pub profit_factor: Option<f64>,
    pub expectancy: f64,
    /// Average win ÷ average loss.
    pub reward_risk: Option<f64>,
    pub best: Option<Trade>,
    pub worst: Option<Trade>,
    pub avg_hold_secs: f64,
    pub avg_hold_win_secs: f64,
    pub avg_hold_loss_secs: f64,
    pub lots: f64,
    pub commission: f64,
    pub swap: f64,
    pub profit: f64,
    pub max_consec_wins: usize,
    pub max_consec_losses: usize,
}

fn mean(v: &[f64]) -> f64 {
    if v.is_empty() { 0.0 } else { v.iter().sum::<f64>() / v.len() as f64 }
}

pub fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

/// A trade with net > 0 is a win, < 0 a loss; exactly 0 counts as neither (but is a trade).
pub fn trade_stats(trades: &[Trade]) -> TradeStats {
    let mut s = TradeStats { trades: trades.len(), ..Default::default() };
    if trades.is_empty() {
        return s;
    }
    let mut sorted: Vec<&Trade> = trades.iter().collect();
    sorted.sort_by_key(|t| (t.close_time, t.deal));
    let (mut wins, mut losses, mut hold_w, mut hold_l, mut hold) = (vec![], vec![], vec![], vec![], vec![]);
    let (mut cw, mut cl) = (0usize, 0usize);
    for t in &sorted {
        hold.push(t.hold_secs());
        s.lots += t.lots();
        s.commission += t.commission;
        s.swap += t.swap;
        s.profit += t.profit;
        s.net += t.net;
        if t.net > 0.0 {
            wins.push(t.net);
            hold_w.push(t.hold_secs());
            cw += 1;
            cl = 0;
        } else if t.net < 0.0 {
            losses.push(-t.net);
            hold_l.push(t.hold_secs());
            cl += 1;
            cw = 0;
        } else {
            cw = 0;
            cl = 0;
        }
        s.max_consec_wins = s.max_consec_wins.max(cw);
        s.max_consec_losses = s.max_consec_losses.max(cl);
        if s.best.as_ref().is_none_or(|b| t.net > b.net) {
            s.best = Some((*t).clone());
        }
        if s.worst.as_ref().is_none_or(|w| t.net < w.net) {
            s.worst = Some((*t).clone());
        }
    }
    s.wins = wins.len();
    s.losses = losses.len();
    s.win_rate = s.wins as f64 / s.trades as f64 * 100.0;
    s.gross_profit = wins.iter().sum();
    s.gross_loss = losses.iter().sum();
    s.avg_win = mean(&wins);
    s.avg_loss = mean(&losses);
    s.profit_factor = if s.gross_loss > 0.0 { Some(s.gross_profit / s.gross_loss) } else { None };
    s.reward_risk = if s.avg_loss > 0.0 { Some(s.avg_win / s.avg_loss) } else { None };
    s.expectancy = s.net / s.trades as f64;
    s.avg_hold_secs = mean(&hold);
    s.avg_hold_win_secs = mean(&hold_w);
    s.avg_hold_loss_secs = mean(&hold_l);
    s
}

/* ------------------------------------------------------------------ */
/* Curves                                                              */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CurvePoint {
    pub day: NaiveDate,
    pub balance: f64,
    pub equity: f64,
    /// Net external money that day (deposits − withdrawals).
    pub flow: f64,
    /// Time-weighted return index (flows removed), starts at 1.
    pub index: f64,
    /// Drawdown from the index peak, % (≤ 0).
    pub drawdown: f64,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurveStats {
    /// Largest drawdown, % (≤ 0).
    pub max_drawdown: f64,
    pub current_drawdown: f64,
    /// Time-weighted return over the curve, %.
    pub return_pct: f64,
    pub sharpe: Option<f64>,
    pub sortino: Option<f64>,
    pub volatility: Option<f64>,
}

/// Builds the index and drawdown for daily (balance, equity, flow) rows in day order. A day's flow counts as
/// arriving at the start of the day: `I_t = I_{t−1} × (E_t − F_t) ÷ E_{t−1}`.
pub fn curve(days: &[(NaiveDate, f64, f64, f64)]) -> (Vec<CurvePoint>, CurveStats) {
    let mut out = Vec::with_capacity(days.len());
    let (mut idx, mut peak) = (1.0f64, 1.0f64);
    let mut prev_eq: Option<f64> = None;
    let mut rets = vec![];
    for &(day, balance, equity, flow) in days {
        if let Some(pe) = prev_eq
            && pe > 0.0
        {
            let r = ((equity - flow) / pe).max(0.0);
            if r.is_finite() {
                rets.push(r - 1.0);
                idx *= r;
            }
        }
        peak = peak.max(idx);
        let dd = if peak > 0.0 { (idx / peak - 1.0) * 100.0 } else { 0.0 };
        out.push(CurvePoint { day, balance, equity, flow, index: idx, drawdown: dd });
        prev_eq = Some(equity);
    }
    let mut st = CurveStats { max_drawdown: out.iter().map(|p| p.drawdown).fold(0.0, f64::min), current_drawdown: out.last().map(|p| p.drawdown).unwrap_or(0.0), ..Default::default() };
    st.return_pct = (out.last().map(|p| p.index).unwrap_or(1.0) - 1.0) * 100.0;
    if rets.len() >= 2 {
        let m = mean(&rets);
        let var = rets.iter().map(|r| (r - m).powi(2)).sum::<f64>() / (rets.len() - 1) as f64;
        let sd = var.sqrt();
        if sd > 0.0 {
            st.sharpe = Some(m / sd * 252f64.sqrt());
            st.volatility = Some(sd * 252f64.sqrt() * 100.0);
        }
        let downside: Vec<f64> = rets.iter().map(|r| r.min(0.0)).collect();
        let dd = (downside.iter().map(|r| r * r).sum::<f64>() / (rets.len() - 1) as f64).sqrt();
        if dd > 0.0 {
            st.sortino = Some(m / dd * 252f64.sqrt());
        }
    }
    (out, st)
}

/// Fills calendar gaps by carrying the previous day forward (flow 0) from `from` to `to` inclusive.
pub fn fill_days(rows: &BTreeMap<NaiveDate, (f64, f64, f64)>, from: NaiveDate, to: NaiveDate) -> Vec<(NaiveDate, f64, f64, f64)> {
    let mut out = vec![];
    let mut last: Option<(f64, f64)> = rows.range(..from).next_back().map(|(_, v)| (v.0, v.1));
    let mut d = from;
    while d <= to {
        if let Some(v) = rows.get(&d) {
            out.push((d, v.0, v.1, v.2));
            last = Some((v.0, v.1));
        } else if let Some((b, e)) = last {
            out.push((d, b, e, 0.0));
        }
        d = d.succ_opt().unwrap();
    }
    out
}

/* ------------------------------------------------------------------ */
/* Groupings                                                           */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub key: String,
    pub trades: usize,
    pub wins: usize,
    pub net: f64,
    pub lots: f64,
    pub win_rate: f64,
}

pub fn group_by<F: Fn(&Trade) -> String>(trades: &[Trade], key: F) -> Vec<Group> {
    let mut m: BTreeMap<String, Group> = BTreeMap::new();
    for t in trades {
        let k = key(t);
        let g = m.entry(k.clone()).or_insert_with(|| Group { key: k, ..Default::default() });
        g.trades += 1;
        g.net += t.net;
        g.lots += t.lots();
        if t.net > 0.0 {
            g.wins += 1;
        }
    }
    m.into_values()
        .map(|mut g| {
            g.win_rate = g.wins as f64 / g.trades.max(1) as f64 * 100.0;
            g
        })
        .collect()
}

/// Net P&L per server day of the close (the P&L calendar), oldest first (`key` = `YYYY-MM-DD`).
pub fn by_close_day(trades: &[Trade]) -> Vec<Group> {
    group_by(trades, |t| time::server_day(t.close_time).to_string())
}

/// Trading session of an open time (UTC hours): Asia 22–07, London 07–12, London/New York overlap 12–16,
/// New York 16–21, late 21–22.
pub fn session_of(t: DateTime<Utc>) -> &'static str {
    match t.hour() {
        7..=11 => "London",
        12..=15 => "London / New York",
        16..=20 => "New York",
        21 => "Late New York",
        _ => "Asia",
    }
}

pub const SESSIONS: &[(&str, &str)] = &[("Asia", "22:00–07:00 UTC"), ("London", "07:00–12:00 UTC"), ("London / New York", "12:00–16:00 UTC"), ("New York", "16:00–21:00 UTC"), ("Late New York", "21:00–22:00 UTC")];

/// Net P&L per (server weekday 0 = Monday, server hour) of the close time.
pub fn hour_heatmap(trades: &[Trade]) -> Vec<Vec<f64>> {
    let mut m = vec![vec![0.0; 24]; 7];
    for t in trades {
        let s = time::server_naive(t.close_time);
        m[s.weekday().num_days_from_monday() as usize][s.hour() as usize] += t.net;
    }
    m.iter().map(|r| r.iter().map(|x| round2(*x)).collect()).collect()
}

/* ------------------------------------------------------------------ */
/* Behaviour insights                                                  */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Insight {
    pub id: &'static str,
    /// up (good habit), down (costly), warn, info
    pub tone: &'static str,
    pub title: String,
    pub stat: String,
    pub text: String,
    pub tip: String,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Behaviour {
    pub overtrading_days: usize,
    pub normal_day_median_trades: f64,
    pub overtrading_net: f64,
    pub revenge_trades: usize,
    pub revenge_net: f64,
    pub revenge_win_rate: f64,
    /// Average loss as % of the balance before the trade.
    pub avg_risk_pct: f64,
    pub max_risk_pct: f64,
    pub trades_over_2pct: usize,
    pub stop_outs: usize,
    pub closed_by_sl: usize,
    pub closed_by_tp: usize,
    pub insights: Vec<Insight>,
}

fn money(x: f64) -> String {
    let s = format!("{:.2}", x.abs());
    let (int, frac) = s.split_once('.').unwrap();
    let mut g = String::new();
    for (i, c) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            g.push(',');
        }
        g.push(c);
    }
    format!("{}${g}.{frac}", if x < 0.0 { "-" } else { "" })
}

fn dur(secs: f64) -> String {
    let m = (secs / 60.0).round() as i64;
    if m >= 1440 {
        format!("{}d {}h", m / 1440, (m % 1440) / 60)
    } else if m >= 60 {
        format!("{}h {}m", m / 60, m % 60)
    } else {
        format!("{m}m")
    }
}

/// Revenge window: a trade opened this soon after a losing close on the same account.
pub const REVENGE_SECS: i64 = 15 * 60;

pub fn behaviour(trades: &[Trade]) -> Behaviour {
    let mut b = Behaviour::default();
    if trades.is_empty() {
        return b;
    }
    // overtrading: server days with more than twice the median trade count (and at least 3 more)
    let mut per_day: BTreeMap<NaiveDate, (usize, f64)> = BTreeMap::new();
    for t in trades {
        let e = per_day.entry(time::server_day(t.open_time)).or_default();
        e.0 += 1;
        e.1 += t.net;
    }
    let mut counts: Vec<usize> = per_day.values().map(|v| v.0).collect();
    counts.sort_unstable();
    let median = if counts.len() % 2 == 1 { counts[counts.len() / 2] as f64 } else { (counts[counts.len() / 2 - 1] + counts[counts.len() / 2]) as f64 / 2.0 };
    b.normal_day_median_trades = median;
    let limit = (median * 2.0).max(median + 3.0);
    for (n, net) in per_day.values() {
        if *n as f64 > limit {
            b.overtrading_days += 1;
            b.overtrading_net += net;
        }
    }
    // revenge trades: opened within 15 min after a losing close on the same account, at least as large
    let mut by_close: Vec<&Trade> = trades.iter().collect();
    by_close.sort_by_key(|t| t.close_time);
    let (mut rv_n, mut rv_w) = (0usize, 0usize);
    for t in trades {
        let prior = by_close.iter().rev().find(|p| p.login == t.login && p.close_time <= t.open_time && p.deal != t.deal);
        if let Some(p) = prior
            && p.net < 0.0
            && (t.open_time - p.close_time).num_seconds() <= REVENGE_SECS
            && t.option == p.option
            && t.volume >= p.volume
        {
            rv_n += 1;
            b.revenge_net += t.net;
            if t.net > 0.0 {
                rv_w += 1;
            }
        }
    }
    b.revenge_trades = rv_n;
    b.revenge_win_rate = if rv_n > 0 { rv_w as f64 / rv_n as f64 * 100.0 } else { 0.0 };
    // risk per trade: losses as % of the balance before the close
    let risks: Vec<f64> = trades.iter().filter(|t| t.net < 0.0 && t.balance_before > 0.0).map(|t| -t.net / t.balance_before * 100.0).collect();
    b.avg_risk_pct = mean(&risks);
    b.max_risk_pct = risks.iter().cloned().fold(0.0, f64::max);
    b.trades_over_2pct = risks.iter().filter(|r| **r > 2.0).count();
    b.stop_outs = trades.iter().filter(|t| t.reason == "stop_out").count();
    b.closed_by_sl = trades.iter().filter(|t| t.reason == "sl").count();
    b.closed_by_tp = trades.iter().filter(|t| t.reason == "tp").count();

    let s = trade_stats(trades);
    let mut ins = vec![];
    if b.overtrading_days > 0 {
        ins.push(Insight {
            id: "overtrading",
            tone: if b.overtrading_net < 0.0 { "down" } else { "warn" },
            title: format!("Overtrading on {} day{}", b.overtrading_days, if b.overtrading_days == 1 { "" } else { "s" }),
            stat: money(b.overtrading_net),
            text: format!("On these days you placed more than {:.0} trades (your typical day is {:.0}). Net result on those days: {}.", limit, median, money(b.overtrading_net)),
            tip: format!("Set a daily cap of {:.0} trades.", (median * 1.5).ceil().max(3.0)),
        });
    }
    if rv_n > 0 {
        ins.push(Insight {
            id: "revenge",
            tone: if b.revenge_net < 0.0 { "down" } else { "warn" },
            title: format!("{rv_n} possible revenge trade{}", if rv_n == 1 { "" } else { "s" }),
            stat: money(b.revenge_net),
            text: format!("Trades opened within 15 minutes of a losing close, at the same size or larger. They won {:.0}% of the time for {} in total.", b.revenge_win_rate, money(b.revenge_net)),
            tip: "Pause for 15 minutes after a loss before the next trade.".into(),
        });
    }
    if !risks.is_empty() {
        let tone = if b.max_risk_pct > 5.0 { "down" } else if b.avg_risk_pct > 2.0 { "warn" } else { "up" };
        ins.push(Insight {
            id: "risk",
            tone,
            title: "Risk per losing trade".into(),
            stat: format!("{:.1}%", b.avg_risk_pct),
            text: format!("A losing trade cost {:.2}% of your balance on average, {:.2}% at most. {} loss{} exceeded 2%.", b.avg_risk_pct, b.max_risk_pct, b.trades_over_2pct, if b.trades_over_2pct == 1 { "" } else { "es" }),
            tip: "Size positions so a stop-loss costs at most 1–2% of the balance.".into(),
        });
    }
    if s.wins > 0 && s.losses > 0 && s.avg_hold_loss_secs > 1.5 * s.avg_hold_win_secs && s.avg_hold_loss_secs > 120.0 {
        ins.push(Insight {
            id: "hold_losers",
            tone: "warn",
            title: "Losers are held longer than winners".into(),
            stat: format!("{:.1}x", s.avg_hold_loss_secs / s.avg_hold_win_secs.max(1.0)),
            text: format!("Losing trades stay open {} on average, winners {}.", dur(s.avg_hold_loss_secs), dur(s.avg_hold_win_secs)),
            tip: "Place a stop-loss when you open the trade and leave it in place.".into(),
        });
    }
    if b.stop_outs > 0 {
        ins.push(Insight {
            id: "stop_out",
            tone: "down",
            title: format!("{} stop-out close{}", b.stop_outs, if b.stop_outs == 1 { "" } else { "s" }),
            stat: b.stop_outs.to_string(),
            text: "Positions were closed by the margin stop-out, not by your own stop-loss.".into(),
            tip: "Keep the margin level above the margin call level with smaller positions.".into(),
        });
    }
    let managed = b.closed_by_sl + b.closed_by_tp;
    if s.trades >= 5 {
        let pct = managed as f64 / s.trades as f64 * 100.0;
        ins.push(Insight {
            id: "sl_tp",
            tone: if pct >= 50.0 { "up" } else { "info" },
            title: "Trades closed by stop-loss or take-profit".into(),
            stat: format!("{pct:.0}%"),
            text: format!("{} by take-profit, {} by stop-loss, the rest closed by hand or by the desk.", b.closed_by_tp, b.closed_by_sl),
            tip: "Planned exits keep results consistent.".into(),
        });
    }
    let sessions = group_by(trades, |t| session_of(t.open_time).to_string());
    if sessions.len() >= 2
        && let (Some(best), Some(worst)) = (sessions.iter().max_by(|a, b| a.net.total_cmp(&b.net)), sessions.iter().min_by(|a, b| a.net.total_cmp(&b.net)))
        && best.net > 0.0
    {
        ins.push(Insight {
            id: "session",
            tone: "up",
            title: format!("Best session: {}", best.key),
            stat: money(best.net),
            text: format!("{} trades with a {:.0}% win rate. Weakest: {} ({}).", best.trades, best.win_rate, worst.key, money(worst.net)),
            tip: format!("Focus on the {} session.", best.key),
        });
    }
    b.insights = ins;
    b
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn t(deal: i64, net: f64, open_min: i64, hold_min: i64) -> Trade {
        let open = Utc.with_ymd_and_hms(2026, 9, 1, 8, 0, 0).unwrap() + chrono::Duration::minutes(open_min);
        Trade {
            login: 1,
            deal,
            ticket: deal,
            symbol: "EURUSD".into(),
            side: "buy".into(),
            volume: 0.1,
            open_time: open,
            close_time: open + chrono::Duration::minutes(hold_min),
            open_price: 1.1,
            close_price: 1.1,
            profit: net,
            swap: 0.0,
            commission: 0.0,
            net,
            reason: "client".into(),
            balance_before: 1000.0,
            option: false,
        }
    }

    #[test]
    fn win_rate_profit_factor_expectancy_hold() {
        let trades = vec![t(1, 100.0, 0, 30), t(2, -50.0, 60, 90), t(3, 50.0, 200, 30), t(4, -25.0, 300, 60), t(5, 0.0, 400, 10)];
        let s = trade_stats(&trades);
        assert_eq!(s.trades, 5);
        assert_eq!((s.wins, s.losses), (2, 2));
        assert!((s.win_rate - 40.0).abs() < 1e-9);
        assert!((s.gross_profit - 150.0).abs() < 1e-9);
        assert!((s.gross_loss - 75.0).abs() < 1e-9);
        assert!((s.profit_factor.unwrap() - 2.0).abs() < 1e-9);
        assert!((s.expectancy - 15.0).abs() < 1e-9);
        assert!((s.reward_risk.unwrap() - 2.0).abs() < 1e-9);
        assert!((s.avg_hold_secs - 44.0 * 60.0).abs() < 1e-9);
        assert!((s.avg_hold_win_secs - 30.0 * 60.0).abs() < 1e-9);
        assert!((s.avg_hold_loss_secs - 75.0 * 60.0).abs() < 1e-9);
        assert_eq!(s.best.unwrap().deal, 1);
        assert_eq!(s.worst.unwrap().deal, 2);
        assert!((s.lots - 0.5).abs() < 1e-9);
        // no losses: profit factor is infinite (None)
        assert!(trade_stats(&[t(1, 10.0, 0, 1)]).profit_factor.is_none());
    }

    #[test]
    fn consecutive_streaks() {
        let trades = vec![t(1, 1.0, 0, 1), t(2, 1.0, 5, 1), t(3, -1.0, 10, 1), t(4, -1.0, 15, 1), t(5, -1.0, 20, 1), t(6, 1.0, 25, 1)];
        let s = trade_stats(&trades);
        assert_eq!((s.max_consec_wins, s.max_consec_losses), (2, 3));
    }

    fn d(n: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 9, n).unwrap()
    }

    #[test]
    fn drawdown_ignores_deposits_and_withdrawals() {
        // 1000 → 1100 (+10%) → deposit 1000 arrives with equity 2100 (0%) → 1890 (−10%) → withdraw 890, equity 1000 (0%) → 1100
        let rows = vec![(d(1), 1000.0, 1000.0, 1000.0), (d(2), 1100.0, 1100.0, 0.0), (d(3), 2100.0, 2100.0, 1000.0), (d(4), 1890.0, 1890.0, 0.0), (d(5), 1000.0, 1000.0, -890.0), (d(6), 1100.0, 1100.0, 0.0)];
        let (pts, st) = curve(&rows);
        assert!((pts[1].index - 1.1).abs() < 1e-9);
        assert!((pts[2].index - 1.1).abs() < 1e-9);
        assert!((pts[3].index - 0.99).abs() < 1e-9);
        assert!((pts[4].index - 0.99).abs() < 1e-9);
        assert!((st.max_drawdown - (-10.0)).abs() < 1e-9);
        assert!((pts[5].index - 1.089).abs() < 1e-9);
        assert!((st.return_pct - 8.9).abs() < 1e-9);
    }

    #[test]
    fn sharpe_and_volatility() {
        // alternating +2% / −1% daily returns: mean 0.5%, sample sd ≈ 1.6432%
        let mut rows = vec![];
        let mut e = 1000.0;
        for i in 0..11 {
            rows.push((d(i + 1), e, e, 0.0));
            e *= if i % 2 == 0 { 1.02 } else { 0.99 };
        }
        let (_, st) = curve(&rows);
        let rets: Vec<f64> = (0..10).map(|i| if i % 2 == 0 { 0.02 } else { -0.01 }).collect();
        let m = rets.iter().sum::<f64>() / 10.0;
        let sd = (rets.iter().map(|r| (r - m).powi(2)).sum::<f64>() / 9.0).sqrt();
        assert!((st.sharpe.unwrap() - m / sd * 252f64.sqrt()).abs() < 1e-9);
        assert!((st.volatility.unwrap() - sd * 252f64.sqrt() * 100.0).abs() < 1e-9);
        assert!(st.sortino.unwrap() > st.sharpe.unwrap());
        // flat curve: no Sharpe
        let (_, flat) = curve(&[(d(1), 1.0, 1.0, 0.0), (d(2), 1.0, 1.0, 0.0), (d(3), 1.0, 1.0, 0.0)]);
        assert!(flat.sharpe.is_none());
    }

    #[test]
    fn fill_days_carries_forward() {
        let mut m = BTreeMap::new();
        m.insert(d(1), (100.0, 100.0, 100.0));
        m.insert(d(4), (120.0, 125.0, 0.0));
        let v = fill_days(&m, d(2), d(5));
        assert_eq!(v, vec![(d(2), 100.0, 100.0, 0.0), (d(3), 100.0, 100.0, 0.0), (d(4), 120.0, 125.0, 0.0), (d(5), 120.0, 125.0, 0.0)]);
    }

    #[test]
    fn revenge_and_risk() {
        let mut a = t(1, -50.0, 0, 10); // loses, closes at 08:10
        a.volume = 0.1;
        let mut b = t(2, -20.0, 15, 10); // opened 5 min later, same size: revenge
        b.volume = 0.2;
        let c = t(3, 30.0, 120, 10); // much later
        let bh = behaviour(&[a, b, c]);
        assert_eq!(bh.revenge_trades, 1);
        assert!((bh.revenge_net + 20.0).abs() < 1e-9);
        assert!((bh.avg_risk_pct - 3.5).abs() < 1e-9); // (5% + 2%) / 2
        assert!((bh.max_risk_pct - 5.0).abs() < 1e-9);
        assert_eq!(bh.trades_over_2pct, 1);
        assert!(bh.insights.iter().any(|i| i.id == "revenge"));
    }

    #[test]
    fn overtrading_day() {
        let mut trades = vec![];
        let mut id = 0;
        for day in 0..5 {
            let n = if day == 4 { 10 } else { 2 };
            for k in 0..n {
                id += 1;
                trades.push(t(id, if day == 4 { -5.0 } else { 5.0 }, day * 1440 + k * 30, 5));
            }
        }
        let bh = behaviour(&trades);
        assert_eq!(bh.overtrading_days, 1);
        assert!((bh.overtrading_net + 50.0).abs() < 1e-9);
    }

    #[test]
    fn pnl_calendar_groups_by_server_day_of_the_close() {
        // server time is GMT+3 in September: a close at 22:30 UTC on 1 Sep is already 2 Sep on the server
        let at = |d: u32, h: u32, m: u32| Utc.with_ymd_and_hms(2026, 9, d, h, m, 0).unwrap();
        let mut a = t(1, 40.0, 0, 30);
        a.close_time = at(1, 20, 0);
        let mut b = t(2, -15.0, 0, 30);
        b.close_time = at(1, 22, 30);
        let mut c = t(3, 5.0, 0, 30);
        c.close_time = at(2, 9, 0);
        let mut e = t(4, 12.5, 0, 30);
        e.close_time = at(10, 12, 0);
        let days = by_close_day(&[e, c, b, a]);
        let keys: Vec<&str> = days.iter().map(|g| g.key.as_str()).collect();
        assert_eq!(keys, vec!["2026-09-01", "2026-09-02", "2026-09-10"]);
        assert_eq!((days[0].trades, days[0].wins), (1, 1));
        assert!((days[0].net - 40.0).abs() < 1e-9);
        assert_eq!((days[1].trades, days[1].wins), (2, 1));
        assert!((days[1].net + 10.0).abs() < 1e-9);
        assert!((days[1].win_rate - 50.0).abs() < 1e-9);
        assert!((days[2].net - 12.5).abs() < 1e-9);
        assert!(by_close_day(&[]).is_empty());
    }

    #[test]
    fn sessions_by_utc_hour() {
        assert_eq!(session_of(Utc.with_ymd_and_hms(2026, 9, 1, 3, 0, 0).unwrap()), "Asia");
        assert_eq!(session_of(Utc.with_ymd_and_hms(2026, 9, 1, 8, 0, 0).unwrap()), "London");
        assert_eq!(session_of(Utc.with_ymd_and_hms(2026, 9, 1, 13, 0, 0).unwrap()), "London / New York");
        assert_eq!(session_of(Utc.with_ymd_and_hms(2026, 9, 1, 17, 0, 0).unwrap()), "New York");
    }
}

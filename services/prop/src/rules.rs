//! Rule math (D148), pure and deterministic: no IO, no clock. The evaluator feeds it one observation of an
//! account (balance, equity, trading days, per-day closed P&L) and persists the returned tracker.
//!
//! Definitions (all limits are a % of the phase's initial balance):
//! - **Daily loss.** Reference = balance at the last daily reset (17:00 New York, 00:00 server time), or for the
//!   `equity` basis the higher of balance and equity at that reset. Breach when equity ≤ reference − limit.
//! - **Max drawdown, static.** Breach when equity ≤ initial − limit.
//! - **Max drawdown, trailing.** The floor trails the highest balance/equity seen (high-water mark) by the limit;
//!   with `trailingLock` it stops once the floor reaches the initial balance. Breach when equity ≤ floor.
//! - **Profit target.** Closed balance and equity are both ≥ initial + target.
//! - **Pass** = target + minimum trading days + consistency. A consistency miss never fails the account; it
//!   only holds the pass (keep trading until the best day is ≤ the allowed share of total profit).
//! - **Time limit.** Not passed by `started + timeLimit days` → breach.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Serialize;

use crate::money::{D, ZERO, jnum, jnum_opt, pct_of};
use crate::plans::Plan;
use crate::time::server_date;

/// What the evaluator keeps between observations (persisted on phase_accounts).
#[derive(Clone, Debug, PartialEq, Default)]
pub struct Tracker {
    pub day: Option<NaiveDate>,
    pub day_start_balance: D,
    pub day_start_equity: D,
    /// High-water mark of balance/equity (trailing drawdown).
    pub hwm: D,
    pub min_equity: D,
    /// Highest daily-loss warning already sent today (0, 50, 75, 90).
    pub warn_level: i32,
}

impl Tracker {
    pub fn start(initial: D) -> Self {
        Tracker { day: None, day_start_balance: initial, day_start_equity: initial, hwm: initial, min_equity: initial, warn_level: 0 }
    }

    /// Shifts every money reference by `delta` (payout withdrawals, rejected-payout re-credits, scaling).
    pub fn rebase(&mut self, delta: D) {
        self.day_start_balance += delta;
        self.day_start_equity += delta;
        self.hwm += delta;
        self.min_equity += delta;
    }
}

/// One look at the account.
#[derive(Clone, Debug)]
pub struct Obs {
    pub at: DateTime<Utc>,
    pub balance: D,
    pub equity: D,
    pub open_positions: usize,
    /// Distinct server days with at least one position opened.
    pub trading_days: u32,
    /// Net closed P&L per server day (profit + swap − commission), for consistency.
    pub day_profits: Vec<(NaiveDate, D)>,
}

impl Obs {
    fn closed_on(&self, day: NaiveDate) -> D {
        self.day_profits.iter().filter(|(d, _)| *d == day).map(|(_, p)| *p).sum()
    }
}

/// Phase terms from the purchased plan.
#[derive(Clone, Debug)]
pub struct Terms {
    pub initial: D,
    /// None on a funded account.
    pub target_pct: Option<D>,
    pub min_days: u32,
    pub time_limit_days: u32,
    pub started_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Verdict {
    Ok,
    Pass,
    Breach {
        rule: &'static str,
        message: String,
        #[serde(with = "jnum")]
        threshold: D,
    },
}

/// Everything the live rule dashboard shows (serialized to the API as-is).
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Eval {
    pub day: NaiveDate,
    #[serde(with = "jnum")]
    pub daily_limit: D,
    #[serde(with = "jnum")]
    pub daily_ref: D,
    #[serde(with = "jnum")]
    pub daily_floor: D,
    #[serde(with = "jnum")]
    pub daily_used: D,
    #[serde(with = "jnum")]
    pub dd_limit: D,
    #[serde(with = "jnum")]
    pub dd_floor: D,
    #[serde(with = "jnum")]
    pub dd_used: D,
    #[serde(with = "jnum")]
    pub hwm: D,
    #[serde(with = "jnum")]
    pub profit: D,
    #[serde(with = "jnum_opt")]
    pub target_amount: Option<D>,
    pub target_reached: bool,
    pub trading_days: u32,
    pub min_days: u32,
    pub days_ok: bool,
    #[serde(with = "jnum_opt")]
    pub best_day: Option<D>,
    #[serde(with = "jnum_opt")]
    pub consistency_limit: Option<D>,
    pub consistency_ok: bool,
    pub deadline: Option<DateTime<Utc>>,
    pub verdict: Verdict,
    /// A daily-loss warning level newly crossed (50 / 75 / 90).
    pub warn: Option<i32>,
}

/// Daily-loss reference for a new trading day. `closed_today` reconstructs the balance at the reset when the
/// first observation of the day comes late (service restart): balance then = balance now − closes since.
pub fn day_reference(plan: &Plan, start_balance: D, start_equity: D) -> D {
    if plan.daily_basis == "equity" { start_balance.max(start_equity) } else { start_balance }
}

/// Max-drawdown floor for the current high-water mark.
pub fn dd_floor(plan: &Plan, initial: D, hwm: D) -> D {
    let limit = pct_of(initial, plan.max_dd);
    if plan.dd_type == "trailing" {
        let f = hwm - limit;
        if plan.trailing_lock { f.min(initial) } else { f }
    } else {
        initial - limit
    }
}

/// Consistency: best single-day profit must be ≤ `consistency`% of the total profit. Returns (best day, allowed).
pub fn consistency(plan: &Plan, profit: D, day_profits: &[(NaiveDate, D)]) -> (Option<D>, Option<D>, bool) {
    let best = day_profits.iter().map(|(_, p)| *p).fold(None, |m: Option<D>, p| Some(m.map_or(p, |m| m.max(p))));
    if plan.consistency <= ZERO {
        return (best, None, true);
    }
    if profit <= ZERO {
        return (best, Some(ZERO), true);
    }
    let allowed = pct_of(profit, plan.consistency);
    (best, Some(allowed), best.map_or(true, |b| b <= allowed))
}

/// Evaluates one observation and advances the tracker.
pub fn evaluate(plan: &Plan, t: &Terms, tr: &mut Tracker, o: &Obs) -> Eval {
    let today = server_date(o.at);
    if tr.day != Some(today) {
        // new trading day: balance at the reset = balance now − closes since the reset
        let closed = o.closed_on(today);
        tr.day = Some(today);
        tr.day_start_balance = o.balance - closed;
        tr.day_start_equity = o.equity - closed;
        tr.warn_level = 0;
    }
    tr.hwm = tr.hwm.max(o.equity).max(o.balance);
    tr.min_equity = tr.min_equity.min(o.equity);

    let daily_limit = pct_of(t.initial, plan.daily_loss);
    let daily_ref = day_reference(plan, tr.day_start_balance, tr.day_start_equity);
    let daily_floor = daily_ref - daily_limit;
    let daily_used = (daily_ref - o.equity).max(ZERO);

    let dd_limit = pct_of(t.initial, plan.max_dd);
    let floor = dd_floor(plan, t.initial, tr.hwm);
    let dd_used = (floor + dd_limit - o.equity).max(ZERO);

    let profit = o.balance - t.initial;
    let target_amount = t.target_pct.map(|p| pct_of(t.initial, p));
    let target_reached = target_amount.is_some_and(|a| profit >= a && o.equity - t.initial >= a);
    let days_ok = o.trading_days >= t.min_days;
    let (best_day, consistency_limit, consistency_ok) = consistency(plan, profit, &o.day_profits);
    let deadline = (t.time_limit_days > 0).then(|| t.started_at + Duration::days(t.time_limit_days as i64));

    let mut warn = None;
    if daily_limit > ZERO {
        let pct = daily_used * D::from(100) / daily_limit;
        let level = if pct >= D::from(90) { 90 } else if pct >= D::from(75) { 75 } else if pct >= D::from(50) { 50 } else { 0 };
        if level > tr.warn_level {
            tr.warn_level = level;
            warn = Some(level);
        }
    }

    let verdict = if o.equity <= daily_floor {
        Verdict::Breach { rule: "daily_loss", message: format!("Daily loss limit reached: equity {:.2} ≤ {:.2} (reference {:.2} − limit {:.2})", o.equity, daily_floor, daily_ref, daily_limit), threshold: daily_floor }
    } else if o.equity <= floor {
        Verdict::Breach { rule: "max_drawdown", message: format!("Maximum drawdown reached: equity {:.2} ≤ {:.2} ({} drawdown)", o.equity, floor, plan.dd_type), threshold: floor }
    } else if target_reached && days_ok && consistency_ok {
        Verdict::Pass
    } else if deadline.is_some_and(|d| o.at > d) {
        Verdict::Breach { rule: "time_limit", message: "The time limit ended before the objectives were met".into(), threshold: ZERO }
    } else {
        Verdict::Ok
    };

    Eval {
        day: today,
        daily_limit,
        daily_ref,
        daily_floor,
        daily_used,
        dd_limit,
        dd_floor: floor,
        dd_used,
        hwm: tr.hwm,
        profit,
        target_amount,
        target_reached,
        trading_days: o.trading_days,
        min_days: t.min_days,
        days_ok,
        best_day,
        consistency_limit,
        consistency_ok,
        deadline,
        verdict,
        warn,
    }
}

/// Currencies an instrument is exposed to, for the news-window rule.
pub fn symbol_currencies(symbol: &str) -> Vec<String> {
    let s = symbol.to_ascii_uppercase();
    match s.as_str() {
        "US30" | "NAS100" | "SPX500" | "USOIL" | "UKOIL" => return vec!["USD".into()],
        "GER40" => return vec!["EUR".into()],
        "UK100" => return vec!["GBP".into()],
        "JP225" => return vec!["JPY".into()],
        _ => {}
    }
    if s.len() == 6 && s.chars().all(|c| c.is_ascii_alphabetic()) {
        return vec![s[..3].to_string(), s[3..].to_string()];
    }
    // US stocks and anything else quoted in dollars
    vec!["USD".into()]
}

#[derive(Clone, Debug)]
pub struct NewsEvent {
    pub id: i64,
    pub at: DateTime<Utc>,
    pub title: String,
    pub currency: String,
    pub symbols: Vec<String>,
}

/// A trade time (open or close) on a symbol inside a news window.
pub fn news_hit<'a>(events: &'a [NewsEvent], symbol: &str, at: DateTime<Utc>, window_min: i64) -> Option<&'a NewsEvent> {
    let ccys = symbol_currencies(symbol);
    events.iter().find(|e| {
        let affects = if e.symbols.is_empty() { ccys.contains(&e.currency) } else { e.symbols.iter().any(|s| s.eq_ignore_ascii_case(symbol)) };
        affects && at >= e.at - Duration::minutes(window_min) && at <= e.at + Duration::minutes(window_min)
    })
}

/// Payout eligibility date for a funded account.
pub fn payout_eligible_from(plan: &Plan, funded_at: DateTime<Utc>, last_payout: Option<DateTime<Utc>>) -> DateTime<Utc> {
    match last_payout {
        None => funded_at + Duration::days(plan.first_payout_days as i64),
        Some(p) => p + Duration::days(plan.payout_cycle_days()),
    }
}

/// Split of a payout: (trader share, firm share), cents, trader rounded down so the sum never exceeds profit.
pub fn split(profit: D, split_pct: D) -> (D, D) {
    let trader = (profit * split_pct / D::from(100)).round_dp_with_strategy(2, rust_decimal::RoundingStrategy::ToZero);
    (trader, profit - trader)
}

/// Scaling plan (D149): after `scalingEvery` months funded (since the last scale-up), with total payout profit
/// in that period ≥ `scalingProfit`% of the account, the account grows by `scalingIncrease`% (capped) and the
/// split moves to the plan's max split. Returns the new size, if due.
pub fn scaling_due(plan: &Plan, size: D, since: DateTime<Utc>, now: DateTime<Utc>, profit_in_period: D) -> Option<D> {
    if plan.scaling_every <= 0 || plan.scaling_increase <= ZERO {
        return None;
    }
    if now < since + Duration::days(30 * plan.scaling_every as i64) {
        return None;
    }
    if profit_in_period < pct_of(size, plan.scaling_profit) {
        return None;
    }
    let mut next = crate::money::r2(size + pct_of(size, plan.scaling_increase));
    if plan.scaling_cap > ZERO {
        next = next.min(plan.scaling_cap);
    }
    (next > size).then_some(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn d(s: &str) -> D {
        D::from_str(s).unwrap()
    }
    fn at(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }
    fn plan(dd: &str, basis: &str) -> Plan {
        serde_json::from_value(serde_json::json!({
            "id": "t", "name": "T", "type": "2-step", "status": "active",
            "sizes": [{"size": 100000, "fee": 499, "leverage": 100}],
            "phases": [{"name": "Phase 1", "target": 8, "minDays": 3}, {"name": "Phase 2", "target": 5, "minDays": 3}],
            "dailyLoss": 5, "dailyBasis": basis, "maxDD": 10, "ddType": dd, "consistency": 0,
            "newsTrading": true, "weekendHolding": true, "split": 80, "splitMax": 90, "payoutFreq": "bi-weekly", "firstPayoutDays": 14
        }))
        .unwrap()
    }
    fn terms() -> Terms {
        Terms { initial: d("100000"), target_pct: Some(d("8")), min_days: 3, time_limit_days: 0, started_at: at("2026-09-01T10:00:00Z") }
    }
    fn obs(t: &str, bal: &str, eq: &str) -> Obs {
        Obs { at: at(t), balance: d(bal), equity: d(eq), open_positions: 0, trading_days: 1, day_profits: vec![] }
    }

    #[test]
    fn daily_loss_balance_basis() {
        let p = plan("static", "balance");
        let mut tr = Tracker::start(d("100000"));
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "100000", "96000"));
        assert_eq!(e.daily_ref, d("100000"));
        assert_eq!(e.daily_floor, d("95000"));
        assert_eq!(e.daily_used, d("4000"));
        assert_eq!(e.verdict, Verdict::Ok);
        assert_eq!(e.warn, Some(75));
        // exactly at the floor is a breach
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:01Z", "100000", "95000"));
        assert!(matches!(e.verdict, Verdict::Breach { rule: "daily_loss", .. }));
    }

    #[test]
    fn daily_loss_equity_basis_uses_higher_of_balance_and_equity_at_reset() {
        let p = plan("static", "equity");
        let mut tr = Tracker::start(d("100000"));
        // first look of the day: floating +3000
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "100000", "103000"));
        assert_eq!(e.daily_ref, d("103000"));
        assert_eq!(e.daily_floor, d("98000"));
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T11:00:00Z", "100000", "98000"));
        assert!(matches!(e.verdict, Verdict::Breach { rule: "daily_loss", .. }));
        // same numbers on the balance basis: reference 100000, floor 95000 → fine
        let pb = plan("static", "balance");
        let mut tr = Tracker::start(d("100000"));
        evaluate(&pb, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "100000", "103000"));
        let e = evaluate(&pb, &terms(), &mut tr, &obs("2026-09-02T11:00:00Z", "100000", "98000"));
        assert_eq!(e.verdict, Verdict::Ok);
    }

    #[test]
    fn daily_reset_at_ny_close_with_dst() {
        let p = plan("static", "balance");
        let mut tr = Tracker::start(d("100000"));
        // summer: day ends 21:00 UTC. Lose 4000 (closed) on 2 Sep
        let mut o = obs("2026-09-02T20:59:00Z", "96000", "96000");
        o.day_profits = vec![(NaiveDate::from_ymd_opt(2026, 9, 2).unwrap(), d("-4000"))];
        let e = evaluate(&p, &terms(), &mut tr, &o);
        assert_eq!(e.day, NaiveDate::from_ymd_opt(2026, 9, 2).unwrap());
        assert_eq!(tr.day_start_balance, d("100000"), "first look reconstructs the balance at the reset");
        assert_eq!(e.daily_used, d("4000"));
        // 21:00 UTC = 00:00 server: new day, reference = 96000
        let mut o2 = obs("2026-09-02T21:00:30Z", "96000", "96000");
        o2.day_profits = o.day_profits.clone();
        let e = evaluate(&p, &terms(), &mut tr, &o2);
        assert_eq!(e.day, NaiveDate::from_ymd_opt(2026, 9, 3).unwrap());
        assert_eq!(e.daily_ref, d("96000"));
        assert_eq!(e.daily_used, ZERO);
        assert_eq!(tr.warn_level, 0);
        // winter: same wall-clock UTC 21:30 is still the old day (reset at 22:00 UTC)
        let mut tr = Tracker::start(d("100000"));
        evaluate(&p, &terms(), &mut tr, &obs("2026-12-02T21:30:00Z", "100000", "100000"));
        assert_eq!(tr.day, Some(NaiveDate::from_ymd_opt(2026, 12, 2).unwrap()));
        evaluate(&p, &terms(), &mut tr, &obs("2026-12-02T22:00:00Z", "100000", "100000"));
        assert_eq!(tr.day, Some(NaiveDate::from_ymd_opt(2026, 12, 3).unwrap()));
    }

    #[test]
    fn static_drawdown() {
        let p = plan("static", "balance");
        let mut tr = Tracker::start(d("100000"));
        // two days of 4% losses each: daily fine, overall 92000 → above 90000
        evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "96000", "96000"));
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-03T10:00:00Z", "92000", "92000"));
        assert_eq!(e.dd_floor, d("90000"));
        assert_eq!(e.dd_used, d("8000"));
        assert_eq!(e.verdict, Verdict::Ok);
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-04T10:00:00Z", "92000", "89999.99"));
        assert!(matches!(e.verdict, Verdict::Breach { rule: "max_drawdown", .. }));
    }

    #[test]
    fn trailing_drawdown_follows_peak_and_locks_at_initial() {
        let p = plan("trailing", "balance");
        let mut tr = Tracker::start(d("100000"));
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "100000", "100000"));
        assert_eq!(e.dd_floor, d("90000"));
        // peak equity 104000 → floor 94000
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T11:00:00Z", "100000", "104000"));
        assert_eq!(e.hwm, d("104000"));
        assert_eq!(e.dd_floor, d("94000"));
        // equity falls back: floor stays at 94000 (the peak doesn't come down)
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-03T11:00:00Z", "99000", "99000"));
        assert_eq!(e.dd_floor, d("94000"));
        assert_eq!(e.dd_used, d("5000"));
        // peak 115000 → floor would be 105000 but locks at the initial balance
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-04T11:00:00Z", "115000", "115000"));
        assert_eq!(e.dd_floor, d("100000"));
        // without the lock it keeps trailing
        let mut unlocked = p.clone();
        unlocked.trailing_lock = false;
        assert_eq!(dd_floor(&unlocked, d("100000"), d("115000")), d("105000"));
        // a fall to the trailing floor breaches even though equity is above the static floor
        let mut tr = Tracker::start(d("100000"));
        evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "100000", "106000"));
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-05T10:00:00Z", "96000", "96000"));
        assert_eq!(e.dd_floor, d("96000"));
        assert!(matches!(e.verdict, Verdict::Breach { rule: "max_drawdown", .. }));
    }

    #[test]
    fn profit_target_needs_min_days_and_consistency() {
        let mut p = plan("static", "balance");
        let mut tr = Tracker::start(d("100000"));
        let mut o = obs("2026-09-05T10:00:00Z", "108500", "108500");
        o.trading_days = 2;
        let e = evaluate(&p, &terms(), &mut tr, &o);
        assert!(e.target_reached);
        assert!(!e.days_ok);
        assert_eq!(e.verdict, Verdict::Ok);
        o.trading_days = 3;
        assert_eq!(evaluate(&p, &terms(), &mut tr, &o).verdict, Verdict::Pass);
        // equity below the target (floating loss) holds the pass
        let mut o2 = o.clone();
        o2.equity = d("107000");
        assert_eq!(evaluate(&p, &terms(), &mut tr, &o2).verdict, Verdict::Ok);

        // consistency 40%: one 6000 day out of 8500 total = 70% → held, not failed
        p.consistency = d("40");
        o.day_profits = vec![(NaiveDate::from_ymd_opt(2026, 9, 2).unwrap(), d("6000")), (NaiveDate::from_ymd_opt(2026, 9, 3).unwrap(), d("2500"))];
        let e = evaluate(&p, &terms(), &mut tr, &o);
        assert_eq!(e.best_day, Some(d("6000")));
        assert_eq!(e.consistency_limit, Some(d("3400")));
        assert!(!e.consistency_ok);
        assert_eq!(e.verdict, Verdict::Ok);
        // more profit spread over later days → best day 6000 ≤ 40% of 16000
        o.balance = d("116000");
        o.equity = d("116000");
        o.day_profits.push((NaiveDate::from_ymd_opt(2026, 9, 4).unwrap(), d("4000")));
        o.day_profits.push((NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(), d("3500")));
        let e = evaluate(&p, &terms(), &mut tr, &o);
        assert!(e.consistency_ok);
        assert_eq!(e.verdict, Verdict::Pass);
    }

    #[test]
    fn time_limit_breach() {
        let p = plan("static", "balance");
        let mut t = terms();
        t.time_limit_days = 30;
        let mut tr = Tracker::start(d("100000"));
        let e = evaluate(&p, &t, &mut tr, &obs("2026-09-30T10:00:00Z", "101000", "101000"));
        assert_eq!(e.verdict, Verdict::Ok);
        assert_eq!(e.deadline, Some(at("2026-10-01T10:00:00Z")));
        let e = evaluate(&p, &t, &mut tr, &obs("2026-10-01T10:00:01Z", "101000", "101000"));
        assert!(matches!(e.verdict, Verdict::Breach { rule: "time_limit", .. }));
    }

    #[test]
    fn funded_accounts_never_pass() {
        let p = plan("static", "balance");
        let mut t = terms();
        t.target_pct = None;
        let mut tr = Tracker::start(d("100000"));
        let mut o = obs("2026-09-05T10:00:00Z", "150000", "150000");
        o.trading_days = 10;
        let e = evaluate(&p, &t, &mut tr, &o);
        assert_eq!(e.verdict, Verdict::Ok);
        assert_eq!(e.profit, d("50000"));
    }

    #[test]
    fn rebase_after_payout_keeps_room() {
        let p = plan("trailing", "balance");
        let mut tr = Tracker::start(d("100000"));
        evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T10:00:00Z", "106000", "106000"));
        // payout of 6000 withdrawn: balance back to 100000; references move with it
        tr.rebase(d("-6000"));
        let e = evaluate(&p, &terms(), &mut tr, &obs("2026-09-02T11:00:00Z", "100000", "100000"));
        assert_eq!(e.verdict, Verdict::Ok);
        assert_eq!(e.daily_used, ZERO);
        assert_eq!(e.dd_floor, d("90000"));
    }

    #[test]
    fn payout_split_and_schedule() {
        assert_eq!(split(d("1234.57"), d("80")), (d("987.65"), d("246.92")));
        assert_eq!(split(d("1000"), d("90")), (d("900.00"), d("100.00")));
        let (a, b) = split(d("0.01"), d("80"));
        assert_eq!(a + b, d("0.01"));
        let p = plan("static", "balance");
        let funded = at("2026-09-01T00:00:00Z");
        assert_eq!(payout_eligible_from(&p, funded, None), at("2026-09-15T00:00:00Z"));
        assert_eq!(payout_eligible_from(&p, funded, Some(at("2026-09-20T00:00:00Z"))), at("2026-10-04T00:00:00Z"));
    }

    #[test]
    fn scaling_plan() {
        let mut p = plan("static", "balance");
        p.scaling_every = 4;
        p.scaling_increase = d("25");
        p.scaling_profit = d("10");
        p.scaling_cap = d("120000");
        let since = at("2026-01-01T00:00:00Z");
        assert_eq!(scaling_due(&p, d("100000"), since, at("2026-03-01T00:00:00Z"), d("20000")), None, "too early");
        assert_eq!(scaling_due(&p, d("100000"), since, at("2026-06-01T00:00:00Z"), d("9000")), None, "not enough profit");
        assert_eq!(scaling_due(&p, d("100000"), since, at("2026-06-01T00:00:00Z"), d("10000")), Some(d("120000")), "capped");
        p.scaling_cap = ZERO;
        assert_eq!(scaling_due(&p, d("100000"), since, at("2026-06-01T00:00:00Z"), d("10000")), Some(d("125000")));
    }

    #[test]
    fn news_window_matching() {
        let ev = vec![NewsEvent { id: 1, at: at("2026-09-10T12:30:00Z"), title: "US CPI".into(), currency: "USD".into(), symbols: vec![] }];
        assert!(news_hit(&ev, "EURUSD", at("2026-09-10T12:28:00Z"), 2).is_some());
        assert!(news_hit(&ev, "EURUSD", at("2026-09-10T12:27:59Z"), 2).is_none());
        assert!(news_hit(&ev, "US30", at("2026-09-10T12:31:00Z"), 2).is_some());
        assert!(news_hit(&ev, "GER40", at("2026-09-10T12:30:00Z"), 2).is_none());
        assert!(news_hit(&ev, "AAPL", at("2026-09-10T12:30:00Z"), 2).is_some());
        let ev2 = vec![NewsEvent { id: 2, at: at("2026-09-10T12:30:00Z"), title: "ECB".into(), currency: "EUR".into(), symbols: vec!["EURUSD".into()] }];
        assert!(news_hit(&ev2, "EURUSD", at("2026-09-10T12:30:00Z"), 2).is_some());
        assert!(news_hit(&ev2, "GER40", at("2026-09-10T12:30:00Z"), 2).is_none(), "explicit symbol list wins");
    }
}

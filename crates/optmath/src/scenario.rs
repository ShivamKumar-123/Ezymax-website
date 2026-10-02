//! SPAN-style scenario grid: the worst loss of a set of option and linear positions on one underlying over
//! the 16 standard scenarios.
//!
//! | # | price move (x R) | vol | weight |
//! |---|------------------|-----|--------|
//! | 1, 2 | 0 | up, down | 1 |
//! | 3-6 | +1/3, -1/3 | up, down | 1 |
//! | 7-10 | +2/3, -2/3 | up, down | 1 |
//! | 11-14 | +1, -1 | up, down | 1 |
//! | 15, 16 | +extreme, -extreme (default 3 R) | unchanged | `extreme_cover` (35%) |
//!
//! `R` is the price scan range as a fraction of spot, the vol scan is an absolute vol shift, and every
//! scenario is valued after `dt_cal` / `dt_vol` (one business day). Loss = weight x (value now - value in
//! the scenario); the result is the largest loss (0 if every scenario gains).
//!
//! Positions are signed quantities in **units of the underlying** (contracts x contract size): option
//! values are per unit in the quote currency, a linear position (spot, CFD, future) is worth `qty x S`.

use crate::barrier::{BarrierType, barrier_price};
use crate::bsm::{OptionType, price};
use crate::volclock::effective_vol;

/// What a position is.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Instrument {
    Vanilla { kind: OptionType, strike: f64 },
    Barrier { kind: OptionType, strike: f64, barrier: f64, barrier_type: BarrierType, rebate: f64 },
    /// Spot / CFD / future exposure.
    Linear,
}

/// One position. `t_cal` / `t_vol` / `vol` are ignored for [`Instrument::Linear`].
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RiskPosition {
    pub instrument: Instrument,
    /// Signed units of the underlying (+ long).
    pub qty: f64,
    /// Time to expiry now: calendar years (carry) and vol-clock years (variance).
    pub t_cal: f64,
    pub t_vol: f64,
    /// Vol at the option's strike now.
    pub vol: f64,
}

/// Market state of the underlying: spot (forward for Black-76), discount rate `r`, carry `b`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Market {
    pub spot: f64,
    pub r: f64,
    pub b: f64,
}

/// Scan parameters.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ScanParams {
    /// Price scan range R as a fraction of spot (e.g. 0.03).
    pub price_range: f64,
    /// Absolute vol shift (e.g. 0.04 = 4 vol points).
    pub vol_range: f64,
    /// Extreme move as a multiple of R (CME: 3).
    pub extreme_multiple: f64,
    /// Share of the extreme-move loss counted (CME: 0.35).
    pub extreme_cover: f64,
    /// Time step applied in every scenario: calendar years and vol-clock years (one business day).
    pub dt_cal: f64,
    pub dt_vol: f64,
    /// Vol floor after the down shift.
    pub min_vol: f64,
}

impl Default for ScanParams {
    fn default() -> Self {
        ScanParams {
            price_range: 0.03,
            vol_range: 0.04,
            extreme_multiple: 3.0,
            extreme_cover: 0.35,
            dt_cal: 1.0 / 365.0,
            dt_vol: 1.0 / 260.0,
            min_vol: 0.005,
        }
    }
}

/// Scenario definition: (price move in units of R, vol direction -1/0/+1, extreme?).
pub const SCENARIOS: [(f64, f64, bool); 16] = [
    (0.0, 1.0, false),
    (0.0, -1.0, false),
    (1.0 / 3.0, 1.0, false),
    (1.0 / 3.0, -1.0, false),
    (-1.0 / 3.0, 1.0, false),
    (-1.0 / 3.0, -1.0, false),
    (2.0 / 3.0, 1.0, false),
    (2.0 / 3.0, -1.0, false),
    (-2.0 / 3.0, 1.0, false),
    (-2.0 / 3.0, -1.0, false),
    (1.0, 1.0, false),
    (1.0, -1.0, false),
    (-1.0, 1.0, false),
    (-1.0, -1.0, false),
    (1.0, 0.0, true),
    (-1.0, 0.0, true),
];

/// Grid output. `pnl[i]` is the unweighted value change, `losses[i]` the weighted loss (positive = loss).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GridResult {
    pub base_value: f64,
    pub pnl: [f64; 16],
    pub losses: [f64; 16],
    /// `max(0, max losses)`.
    pub worst_loss: f64,
    /// Index of the worst scenario (0-based), `None` when nothing loses.
    pub worst_scenario: Option<usize>,
}

/// Value per unit of one instrument (Linear: the price itself).
pub fn unit_value(ins: &Instrument, s: f64, m: &Market, t_cal: f64, t_vol: f64, vol: f64) -> f64 {
    match *ins {
        Instrument::Linear => s,
        Instrument::Vanilla { kind, strike } => {
            if t_cal <= 0.0 || t_vol <= 0.0 {
                return (kind.sign() * (s - strike)).max(0.0);
            }
            price(kind, s, strike, t_cal, m.r, m.b, effective_vol(vol, t_vol, t_cal))
        }
        Instrument::Barrier { kind, strike, barrier, barrier_type, rebate } => {
            let t = t_cal.max(0.0);
            let sig = if t_cal > 0.0 && t_vol > 0.0 { effective_vol(vol, t_vol, t_cal) } else { 0.0 };
            if t == 0.0 || sig == 0.0 {
                let breached = if barrier_type.is_down() { s <= barrier } else { s >= barrier };
                let intrinsic = (kind.sign() * (s - strike)).max(0.0);
                return match (barrier_type.is_in(), breached) {
                    (true, true) | (false, false) => intrinsic,
                    _ => rebate,
                };
            }
            barrier_price(kind, barrier_type, s, strike, barrier, rebate, t, m.r, m.b, sig)
        }
    }
}

/// Value of a portfolio at spot `s`, vol shift `dv`, after `dt_cal` / `dt_vol`.
fn portfolio_value(pos: &[RiskPosition], m: &Market, s: f64, dv: f64, dt_cal: f64, dt_vol: f64, min_vol: f64) -> f64 {
    pos.iter()
        .map(|p| {
            let vol = (p.vol + dv).max(min_vol);
            p.qty * unit_value(&p.instrument, s, m, (p.t_cal - dt_cal).max(0.0), (p.t_vol - dt_vol).max(0.0), vol)
        })
        .sum()
}

/// Runs the 16 scenarios.
pub fn scenario_grid(positions: &[RiskPosition], m: Market, p: &ScanParams) -> GridResult {
    let base_value = portfolio_value(positions, &m, m.spot, 0.0, 0.0, 0.0, p.min_vol);
    let mut pnl = [0.0; 16];
    let mut losses = [0.0; 16];
    for (i, &(mv, vd, extreme)) in SCENARIOS.iter().enumerate() {
        let mult = if extreme { mv * p.extreme_multiple } else { mv };
        let s = (m.spot * (1.0 + mult * p.price_range)).max(m.spot * 1e-6);
        let v = portfolio_value(positions, &m, s, vd * p.vol_range, p.dt_cal, p.dt_vol, p.min_vol);
        pnl[i] = v - base_value;
        let w = if extreme { p.extreme_cover } else { 1.0 };
        losses[i] = -w * pnl[i];
    }
    let (mut worst, mut idx) = (0.0, None);
    for (i, l) in losses.iter().enumerate() {
        if *l > worst {
            worst = *l;
            idx = Some(i);
        }
    }
    GridResult { base_value, pnl, losses, worst_loss: worst, worst_scenario: idx }
}

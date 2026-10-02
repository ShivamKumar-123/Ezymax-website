//! Payoff at expiry of a multi-leg position, with breakevens and max profit / loss (strategy builder).
//!
//! Vanilla and linear legs only: the payoff is piecewise linear in the expiry price `S >= 0` with kinks at
//! the strikes, so breakevens and extremes are exact. Barrier legs are path-dependent and are not handled.

/// What a leg is.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LegKind {
    Call { strike: f64 },
    Put { strike: f64 },
    /// Spot / CFD: P&L = qty x (S - price).
    Linear,
}

/// One leg: signed quantity in units of the underlying (+ long). `price` is the premium per unit paid
/// (long) or received (short) for options, the entry price for a linear leg.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Leg {
    pub kind: LegKind,
    pub qty: f64,
    pub price: f64,
}

/// P&L of all legs if the underlying expires at `s`.
pub fn payoff(legs: &[Leg], s: f64) -> f64 {
    legs.iter()
        .map(|l| match l.kind {
            LegKind::Call { strike } => l.qty * ((s - strike).max(0.0) - l.price),
            LegKind::Put { strike } => l.qty * ((strike - s).max(0.0) - l.price),
            LegKind::Linear => l.qty * (s - l.price),
        })
        .sum()
}

/// Payoff shape.
#[derive(Clone, Debug, PartialEq)]
pub struct PayoffSummary {
    /// Expiry prices where the P&L is zero, ascending.
    pub breakevens: Vec<f64>,
    /// `None` = unlimited.
    pub max_profit: Option<f64>,
    /// Largest loss as a positive number; `None` = unlimited. 0 when the position can't lose.
    pub max_loss: Option<f64>,
    /// Strikes (kinks), ascending.
    pub kinks: Vec<f64>,
}

/// Slope of the payoff above every strike.
fn final_slope(legs: &[Leg]) -> f64 {
    legs.iter()
        .map(|l| match l.kind {
            LegKind::Call { .. } | LegKind::Linear => l.qty,
            LegKind::Put { .. } => 0.0,
        })
        .sum()
}

pub fn summarize(legs: &[Leg]) -> PayoffSummary {
    let mut kinks: Vec<f64> = legs
        .iter()
        .filter_map(|l| match l.kind {
            LegKind::Call { strike } | LegKind::Put { strike } if strike.is_finite() && strike > 0.0 => Some(strike),
            _ => None,
        })
        .collect();
    kinks.sort_by(f64::total_cmp);
    kinks.dedup();
    let mut xs = vec![0.0];
    xs.extend(kinks.iter().copied());
    let ys: Vec<f64> = xs.iter().map(|&x| payoff(legs, x)).collect();
    let slope = final_slope(legs);
    let eps = 1e-12 * ys.iter().fold(1.0f64, |a, y| a.max(y.abs()));

    let mut be: Vec<f64> = Vec::new();
    let mut push = |x: f64| {
        if be.last().is_none_or(|l: &f64| (x - l).abs() > 1e-12 * x.abs().max(1.0)) {
            be.push(x);
        }
    };
    for i in 0..xs.len() {
        if ys[i].abs() <= eps && xs[i] > 0.0 {
            push(xs[i]);
        }
        if i + 1 < xs.len() {
            let (y0, y1) = (ys[i], ys[i + 1]);
            if (y0 < -eps && y1 > eps) || (y0 > eps && y1 < -eps) {
                push(xs[i] + (xs[i + 1] - xs[i]) * (-y0) / (y1 - y0));
            }
        }
    }
    let (xl, yl) = (*xs.last().unwrap(), *ys.last().unwrap());
    if slope != 0.0 && ((yl < -eps && slope > 0.0) || (yl > eps && slope < 0.0)) {
        push(xl - yl / slope);
    }

    let max_y = ys.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let min_y = ys.iter().copied().fold(f64::INFINITY, f64::min);
    let max_profit = if slope > 0.0 { None } else { Some(max_y) };
    let max_loss = if slope < 0.0 { None } else { Some((-min_y).max(0.0)) };
    PayoffSummary { breakevens: be, max_profit, max_loss, kinks }
}

//! Strike ladder: strikes are integer multiples ("ticks") of an admin step, so equality and ordering are
//! exact and a strike prints the same everywhere.
//!
//! * [`ladder`]: ATM (spot rounded to the nearest step) plus/minus `each_side` steps.
//! * [`extension`]: when spot comes within `threshold` steps of the lowest or highest listed strike, the
//!   strikes needed to restore `each_side` steps on that side. Listed strikes are never removed (they may
//!   carry open interest).

/// Decimals needed to print `step` exactly (0.0025 -> 4, 0.5 -> 1, 5 -> 0), at most 10.
pub fn step_decimals(step: f64) -> u32 {
    let mut d = 0;
    while d < 10 {
        let scaled = step * 10f64.powi(d as i32);
        if (scaled - scaled.round()).abs() < 1e-9 * scaled.abs().max(1.0) {
            return d;
        }
        d += 1;
    }
    d
}

/// Nearest tick of a price.
pub fn strike_ticks(price: f64, step: f64) -> i64 {
    if !(price.is_finite() && step.is_finite() && step > 0.0) {
        return 0;
    }
    (price / step).round() as i64
}

/// Strike of a tick, rounded to the step's decimals (no floating-point noise).
pub fn tick_to_strike(ticks: i64, step: f64) -> f64 {
    let d = step_decimals(step);
    let p = 10f64.powi(d as i32);
    ((ticks as f64 * step) * p).round() / p
}

/// Strike formatted with the step's decimals, e.g. `1.1650`.
pub fn format_strike(ticks: i64, step: f64) -> String {
    format!("{:.*}", step_decimals(step) as usize, tick_to_strike(ticks, step))
}

/// ATM +- `each_side` ticks around `center`, ascending, positive strikes only.
pub fn ladder(center: f64, step: f64, each_side: u32) -> Vec<i64> {
    let atm = strike_ticks(center, step);
    if atm <= 0 {
        return Vec::new();
    }
    let n = each_side as i64;
    ((atm - n)..=(atm + n)).filter(|&t| t > 0).collect()
}

/// New ticks to list so that `spot` has at least `each_side` strikes on each side again, when it is within
/// `threshold` steps of an edge. `listed` may be unsorted. Empty `listed` = the full [`ladder`].
pub fn extension(listed: &[i64], spot: f64, step: f64, each_side: u32, threshold: u32) -> Vec<i64> {
    let atm = strike_ticks(spot, step);
    if atm <= 0 {
        return Vec::new();
    }
    let (Some(&lo), Some(&hi)) = (listed.iter().min(), listed.iter().max()) else { return ladder(spot, step, each_side) };
    let (n, th) = (each_side as i64, threshold as i64);
    let mut out = Vec::new();
    if atm + th >= hi {
        out.extend((hi + 1)..=(atm + n));
    }
    if atm - th <= lo {
        out.extend(((atm - n).max(1))..lo);
    }
    out.sort_unstable();
    out.dedup();
    out
}

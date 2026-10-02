//! Implied volatility: safeguarded Newton-Raphson on vega with a bisection
//! fallback inside a bracket that always contains the root.

use crate::bsm::{OptionType, d1_d2, price};
use crate::normal::norm_pdf;

/// Why an implied vol could not be found.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum IvError {
    /// Non-finite or non-positive inputs, or `t <= 0`.
    InvalidInput,
    /// Price below the no-arbitrage lower bound (discounted intrinsic).
    BelowIntrinsic,
    /// Price at or above the upper bound (discounted forward for a call,
    /// discounted strike for a put).
    AboveMaximum,
    /// The solver did not converge (should not happen for valid inputs).
    NoConvergence,
}

impl std::fmt::Display for IvError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            IvError::InvalidInput => "invalid input",
            IvError::BelowIntrinsic => "price below intrinsic value",
            IvError::AboveMaximum => "price above the no-arbitrage maximum",
            IvError::NoConvergence => "implied vol solver did not converge",
        };
        f.write_str(s)
    }
}

impl std::error::Error for IvError {}

/// Lowest vol the solver reports (a price at intrinsic returns this).
pub const MIN_VOL: f64 = 1e-8;
/// Highest vol the solver searches.
pub const MAX_VOL: f64 = 20.0;

/// Implied volatility of a European option under generalized BSM
/// (same `s, k, t, r, b` conventions as [`crate::bsm::price`]).
///
/// Converges to `|model - target| <= 1e-14 * max(1, target)` or a vol bracket
/// narrower than 1e-15. A target equal to the discounted intrinsic value
/// returns [`MIN_VOL`].
pub fn implied_vol(kind: OptionType, target: f64, s: f64, k: f64, t: f64, r: f64, b: f64) -> Result<f64, IvError> {
    if !(target.is_finite() && s.is_finite() && k.is_finite() && t.is_finite() && r.is_finite() && b.is_finite())
        || s <= 0.0
        || k <= 0.0
        || t <= 0.0
    {
        return Err(IvError::InvalidInput);
    }
    let fwd_pv = s * ((b - r) * t).exp();
    let strike_pv = k * (-r * t).exp();
    let w = kind.sign();
    let lower = (w * (fwd_pv - strike_pv)).max(0.0);
    let upper = match kind {
        OptionType::Call => fwd_pv,
        OptionType::Put => strike_pv,
    };
    let tol = 1e-14 * target.max(1.0);
    if target < lower - tol {
        return Err(IvError::BelowIntrinsic);
    }
    if target >= upper {
        return Err(IvError::AboveMaximum);
    }
    if target <= lower + tol {
        return Ok(MIN_VOL);
    }

    let f = |sig: f64| price(kind, s, k, t, r, b, sig) - target;
    let vega = |sig: f64| {
        let (d1, _) = d1_d2(s, k, t, b, sig);
        fwd_pv * norm_pdf(d1) * t.sqrt()
    };

    let (mut lo, mut hi) = (MIN_VOL, MAX_VOL);
    if f(hi) < 0.0 {
        return Err(IvError::AboveMaximum);
    }

    // Start at the vol that maximises vega, sqrt(2|ln(F/K)| / t), which keeps
    // Newton on the convex side for most inputs (Manaster-Koehler style).
    let fwd = s * (b * t).exp();
    let mut sig = (2.0 * (fwd / k).ln().abs() / t).sqrt().clamp(0.05, 2.0);
    if sig.is_nan() {
        sig = 0.2;
    }

    for _ in 0..200 {
        let diff = f(sig);
        if diff.abs() <= tol {
            return Ok(sig);
        }
        if diff > 0.0 {
            hi = sig;
        } else {
            lo = sig;
        }
        if hi - lo < 1e-15 {
            return Ok(0.5 * (lo + hi));
        }
        let v = vega(sig);
        let newton = sig - diff / v;
        sig = if v > 1e-300 && newton > lo && newton < hi {
            newton
        } else {
            0.5 * (lo + hi)
        };
    }
    Err(IvError::NoConvergence)
}

/// Garman-Kohlhagen implied vol (`b = rd - rf`).
pub fn gk_implied_vol(kind: OptionType, target: f64, spot: f64, k: f64, t: f64, rd: f64, rf: f64) -> Result<f64, IvError> {
    implied_vol(kind, target, spot, k, t, rd, rd - rf)
}

/// Black-76 implied vol (`b = 0`, `f` is the forward).
pub fn black76_implied_vol(kind: OptionType, target: f64, f: f64, k: f64, t: f64, r: f64) -> Result<f64, IvError> {
    implied_vol(kind, target, f, k, t, r, 0.0)
}

/// Black-Scholes implied vol with dividend / lease yield `q`.
pub fn bs_implied_vol(kind: OptionType, target: f64, s: f64, k: f64, t: f64, r: f64, q: f64) -> Result<f64, IvError> {
    implied_vol(kind, target, s, k, t, r, r - q)
}

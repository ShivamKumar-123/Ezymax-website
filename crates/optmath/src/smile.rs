//! FX volatility smile for one tenor, built from the market quotes ATM,
//! 25-delta risk reversal / butterfly and (optionally) 10-delta RR / BF.
//!
//! Conventions:
//! * Pillar vols use the simple (smile) strangle approximation:
//!   `vol(xD call) = ATM + BFx + RRx / 2`, `vol(xD put) = ATM + BFx - RRx / 2`.
//! * ATM is delta-neutral straddle (DNS): call delta = -put delta, i.e.
//!   `d1 = 0`, strike `F * exp(sigma^2 t / 2)`.
//! * Deltas are non-premium-adjusted, quoted as spot (`e^{-rf t} N(d1)`) or
//!   forward (`N(d1)`) delta, see [`DeltaConvention`]. Premium-adjusted
//!   deltas (e.g. USD/JPY market convention) are not modelled.
//! * Interpolation is monotone cubic (Fritsch-Carlson) in forward call delta
//!   `N(d1)` in (0, 1), flat extrapolation beyond the 10D (or 25D) pillars.
//!   Fritsch-Carlson never overshoots the pillar vols, so the smile stays
//!   within [min pillar, max pillar].
//! * Strike to vol is a fixed point `sigma = smile(N(d1(K, sigma)))`, solved
//!   by iteration with a bisection fallback (the fixed point always exists
//!   because the smile is bounded by the pillar vols).

use crate::normal::{norm_cdf, norm_inv};

/// How the quoted pillar deltas are measured.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
pub enum DeltaConvention {
    /// Spot delta `e^{-rf t} N(d1)` (FX market standard up to 1Y).
    #[default]
    Spot,
    /// Forward delta `N(d1)`.
    Forward,
}

/// Market quotes for one tenor (vols as decimals, e.g. 0.085).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SmileQuotes {
    pub atm: f64,
    pub rr25: f64,
    pub bf25: f64,
    /// Optional 10-delta wings; both must be present to be used.
    pub rr10: Option<f64>,
    pub bf10: Option<f64>,
}

/// Errors when building a smile.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SmileError {
    /// Non-finite inputs, `t <= 0`, `spot <= 0`, or a delta outside (0, 1).
    InvalidInput,
    /// A pillar vol came out zero or negative.
    NonPositiveVol,
    /// Pillar deltas are not strictly ordered (e.g. 10D/25D collide after
    /// the spot-delta adjustment for a very long tenor).
    BadDeltaOrder,
}

impl std::fmt::Display for SmileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            SmileError::InvalidInput => "invalid smile input",
            SmileError::NonPositiveVol => "a smile pillar vol is not positive",
            SmileError::BadDeltaOrder => "smile pillar deltas are not strictly ordered",
        })
    }
}

impl std::error::Error for SmileError {}

/// One tenor's smile, ready to evaluate by delta or by strike.
#[derive(Clone, Debug, PartialEq)]
pub struct Smile {
    /// Expiry in years.
    pub t: f64,
    /// Forward `spot * e^{(rd - rf) t}`.
    pub forward: f64,
    /// Pillars as (forward call delta N(d1), vol), ascending in delta.
    pillars: Vec<(f64, f64)>,
    /// Fritsch-Carlson node slopes.
    slopes: Vec<f64>,
}

impl Smile {
    /// Builds the smile for FX spot `spot`, domestic rate `rd`, foreign rate
    /// `rf` (continuous, annual) and expiry `t` years.
    pub fn new(
        quotes: SmileQuotes,
        spot: f64,
        t: f64,
        rd: f64,
        rf: f64,
        convention: DeltaConvention,
    ) -> Result<Smile, SmileError> {
        let finite = [quotes.atm, quotes.rr25, quotes.bf25, spot, t, rd, rf].iter().all(|x| x.is_finite());
        if !finite || spot <= 0.0 || t <= 0.0 {
            return Err(SmileError::InvalidInput);
        }
        // Converts a quoted |delta| for the call wing into forward call delta
        // N(d1), and for the put wing into N(d1) = 1 - N(-d1).
        let scale = match convention {
            DeltaConvention::Spot => (rf * t).exp(),
            DeltaConvention::Forward => 1.0,
        };
        let call_nd1 = |d: f64| d * scale;
        let put_nd1 = |d: f64| 1.0 - d * scale;

        let mut pillars = Vec::with_capacity(5);
        let wing10 = match (quotes.rr10, quotes.bf10) {
            (Some(rr), Some(bf)) if rr.is_finite() && bf.is_finite() => Some((rr, bf)),
            (None, None) | (Some(_), None) | (None, Some(_)) => None,
            _ => return Err(SmileError::InvalidInput),
        };
        if let Some((rr, bf)) = wing10 {
            pillars.push((call_nd1(0.1), quotes.atm + bf + 0.5 * rr));
        }
        pillars.push((call_nd1(0.25), quotes.atm + quotes.bf25 + 0.5 * quotes.rr25));
        pillars.push((0.5, quotes.atm));
        pillars.push((put_nd1(0.25), quotes.atm + quotes.bf25 - 0.5 * quotes.rr25));
        if let Some((rr, bf)) = wing10 {
            pillars.push((put_nd1(0.1), quotes.atm + bf - 0.5 * rr));
        }
        if pillars.iter().any(|&(_, v)| v.is_nan() || v <= 0.0) {
            return Err(SmileError::NonPositiveVol);
        }
        if pillars.iter().any(|&(d, _)| !(d > 0.0 && d < 1.0)) || pillars.windows(2).any(|w| w[1].0 <= w[0].0) {
            return Err(SmileError::BadDeltaOrder);
        }
        let slopes = fritsch_carlson_slopes(&pillars);
        Ok(Smile { t, forward: spot * ((rd - rf) * t).exp(), pillars, slopes })
    }

    /// Pillars as (forward call delta N(d1), vol), ascending in delta.
    pub fn pillars(&self) -> &[(f64, f64)] {
        &self.pillars
    }

    /// Vol at forward call delta `N(d1)` in (0, 1). Flat beyond the outer pillars.
    pub fn vol_at_call_delta(&self, nd1: f64) -> f64 {
        let p = &self.pillars;
        let n = p.len();
        if nd1 <= p[0].0 {
            return p[0].1;
        }
        if nd1 >= p[n - 1].0 {
            return p[n - 1].1;
        }
        let i = p.windows(2).position(|w| nd1 <= w[1].0).unwrap_or(n - 2);
        let (x0, y0) = p[i];
        let (x1, y1) = p[i + 1];
        let h = x1 - x0;
        let s = (nd1 - x0) / h;
        let h00 = (1.0 + 2.0 * s) * (1.0 - s) * (1.0 - s);
        let h10 = s * (1.0 - s) * (1.0 - s);
        let h01 = s * s * (3.0 - 2.0 * s);
        let h11 = s * s * (s - 1.0);
        h00 * y0 + h10 * h * self.slopes[i] + h01 * y1 + h11 * h * self.slopes[i + 1]
    }

    /// Vol for strike `k`: solves `sigma = vol_at_call_delta(N(d1(k, sigma)))`.
    pub fn vol_at_strike(&self, k: f64) -> f64 {
        if !(k > 0.0 && k.is_finite()) {
            return f64::NAN;
        }
        let sqrt_t = self.t.sqrt();
        let ln_fk = (self.forward / k).ln();
        let g = |sig: f64| {
            let d1 = ln_fk / (sig * sqrt_t) + 0.5 * sig * sqrt_t;
            self.vol_at_call_delta(norm_cdf(d1))
        };
        let mut sig = self.pillars[self.pillars.len() / 2].1;
        for _ in 0..50 {
            let next = g(sig);
            if (next - sig).abs() < 1e-14 {
                return next;
            }
            sig = next;
        }
        // Bisection on g(sigma) - sigma over the pillar range (sign change guaranteed).
        let (mut lo, mut hi) = self
            .pillars
            .iter()
            .fold((f64::INFINITY, f64::NEG_INFINITY), |(lo, hi), &(_, v)| (lo.min(v), hi.max(v)));
        if hi - lo < 1e-15 {
            return lo;
        }
        for _ in 0..200 {
            let mid = 0.5 * (lo + hi);
            if g(mid) - mid > 0.0 {
                lo = mid;
            } else {
                hi = mid;
            }
            if hi - lo < 1e-15 {
                break;
            }
        }
        0.5 * (lo + hi)
    }

    /// Strike whose forward call delta `N(d1)` is `nd1`, using the smile vol
    /// at that delta: `K = F exp(-N^-1(nd1) sigma sqrt(t) + sigma^2 t / 2)`.
    pub fn strike_at_call_delta(&self, nd1: f64) -> f64 {
        if !(nd1 > 0.0 && nd1 < 1.0) {
            return f64::NAN;
        }
        let sig = self.vol_at_call_delta(nd1);
        let v = sig * self.t.sqrt();
        self.forward * (-norm_inv(nd1) * v + 0.5 * v * v).exp()
    }

    /// DNS ATM strike `F exp(sigma_atm^2 t / 2)`.
    pub fn atm_strike(&self) -> f64 {
        self.strike_at_call_delta(0.5)
    }
}

/// Fritsch-Carlson monotone cubic Hermite slopes.
fn fritsch_carlson_slopes(p: &[(f64, f64)]) -> Vec<f64> {
    let n = p.len();
    let secant: Vec<f64> = p.windows(2).map(|w| (w[1].1 - w[0].1) / (w[1].0 - w[0].0)).collect();
    let mut m = vec![0.0; n];
    m[0] = secant[0];
    m[n - 1] = secant[n - 2];
    for i in 1..n - 1 {
        m[i] = if secant[i - 1] * secant[i] <= 0.0 { 0.0 } else { 0.5 * (secant[i - 1] + secant[i]) };
    }
    for i in 0..n - 1 {
        if secant[i] == 0.0 {
            m[i] = 0.0;
            m[i + 1] = 0.0;
            continue;
        }
        let a = m[i] / secant[i];
        let b = m[i + 1] / secant[i];
        let r = a * a + b * b;
        if r > 9.0 {
            let tau = 3.0 / r.sqrt();
            m[i] = tau * a * secant[i];
            m[i + 1] = tau * b * secant[i];
        }
    }
    m
}

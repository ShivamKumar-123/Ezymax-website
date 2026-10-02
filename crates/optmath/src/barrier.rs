//! Reiner-Rubinstein (1991) single-barrier options with continuous
//! monitoring and a cash rebate, as given in Haug, "The Complete Guide to
//! Option Pricing Formulas", 2nd ed., section 4.17.1.
//!
//! Rebate conventions (Haug): a knock-out pays the rebate **when the barrier
//! is hit**; a knock-in that never knocks in pays the rebate **at expiry**.

use crate::bsm::{self, OptionType};
use crate::normal::norm_cdf;

/// Barrier direction and effect.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum BarrierType {
    DownIn,
    UpIn,
    DownOut,
    UpOut,
}

impl BarrierType {
    #[inline]
    pub fn is_down(self) -> bool {
        matches!(self, BarrierType::DownIn | BarrierType::DownOut)
    }
    #[inline]
    pub fn is_in(self) -> bool {
        matches!(self, BarrierType::DownIn | BarrierType::UpIn)
    }
}

/// Price of a continuously monitored single-barrier option.
///
/// `s` spot, `k` strike, `h` barrier, `rebate` cash rebate, `t` years, `r`
/// discount rate, `b` cost of carry (`rd - rf` for FX), `sigma` vol.
///
/// If the barrier is already breached (`s <= h` for down, `s >= h` for up),
/// a knock-out is worth the rebate (paid now) and a knock-in is the vanilla.
/// At `t == 0` an unbreached knock-out is the intrinsic value and a knock-in
/// is the rebate. Invalid inputs return NaN.
///
/// Limitation: a knock-out **with a non-zero rebate** returns NaN when
/// `mu^2 + 2r/sigma^2 < 0` (negative rates with low vol), where the closed
/// form for the rebate-at-hit term does not apply. Without a rebate every
/// rate sign is supported.
#[allow(clippy::too_many_arguments)]
pub fn barrier_price(
    kind: OptionType,
    barrier: BarrierType,
    s: f64,
    k: f64,
    h: f64,
    rebate: f64,
    t: f64,
    r: f64,
    b: f64,
    sigma: f64,
) -> f64 {
    let finite = [s, k, h, rebate, t, r, b, sigma].iter().all(|x| x.is_finite());
    if !finite || s <= 0.0 || k <= 0.0 || h <= 0.0 || t < 0.0 || sigma < 0.0 || rebate < 0.0 {
        return f64::NAN;
    }
    let breached = if barrier.is_down() { s <= h } else { s >= h };
    if breached {
        return if barrier.is_in() { bsm::price(kind, s, k, t, r, b, sigma) } else { rebate };
    }
    if t == 0.0 {
        return if barrier.is_in() { rebate } else { bsm::price(kind, s, k, 0.0, r, b, sigma) };
    }
    if sigma == 0.0 {
        // Deterministic path: the barrier is touched iff the forward path crosses it.
        let s_t = s * (b * t).exp();
        let hits = if barrier.is_down() { s_t <= h } else { s_t >= h };
        let vanilla = bsm::price(kind, s, k, t, r, b, 0.0);
        let df = (-r * t).exp();
        return match (barrier.is_in(), hits) {
            (true, true) => vanilla,
            (true, false) => rebate * df,
            (false, false) => vanilla,
            // Hit time tau solves s e^{b tau} = h.
            (false, true) => {
                let tau = if b != 0.0 { (h / s).ln() / b } else { 0.0 };
                rebate * (-r * tau).exp()
            }
        };
    }

    let phi = kind.sign();
    let eta = if barrier.is_down() { 1.0 } else { -1.0 };
    let v = sigma * t.sqrt();
    let sig2 = sigma * sigma;
    let mu = (b - 0.5 * sig2) / sig2;
    // lambda is only needed for the rebate-at-hit term; with negative rates
    // and low vol the discriminant can go negative (see `rebate_at_hit`).
    let lambda = (mu * mu + 2.0 * r / sig2).sqrt();
    let carry_df = ((b - r) * t).exp();
    let df = (-r * t).exp();
    let hs = h / s;

    let x1 = (s / k).ln() / v + (1.0 + mu) * v;
    let x2 = (s / h).ln() / v + (1.0 + mu) * v;
    let y1 = (h * h / (s * k)).ln() / v + (1.0 + mu) * v;
    let y2 = (h / s).ln() / v + (1.0 + mu) * v;
    let z = (h / s).ln() / v + lambda * v;

    let a = phi * s * carry_df * norm_cdf(phi * x1) - phi * k * df * norm_cdf(phi * x1 - phi * v);
    let bb = phi * s * carry_df * norm_cdf(phi * x2) - phi * k * df * norm_cdf(phi * x2 - phi * v);
    let c = phi * s * carry_df * hs.powf(2.0 * (mu + 1.0)) * norm_cdf(eta * y1)
        - phi * k * df * hs.powf(2.0 * mu) * norm_cdf(eta * y1 - eta * v);
    let d = phi * s * carry_df * hs.powf(2.0 * (mu + 1.0)) * norm_cdf(eta * y2)
        - phi * k * df * hs.powf(2.0 * mu) * norm_cdf(eta * y2 - eta * v);
    let e = rebate * df * (norm_cdf(eta * x2 - eta * v) - hs.powf(2.0 * mu) * norm_cdf(eta * y2 - eta * v));
    let f = if rebate == 0.0 {
        0.0
    } else {
        rebate
            * (hs.powf(mu + lambda) * norm_cdf(eta * z)
                + hs.powf(mu - lambda) * norm_cdf(eta * z - 2.0 * eta * lambda * v))
    };

    let above = k >= h;
    use BarrierType::*;
    use OptionType::*;
    match (kind, barrier, above) {
        (Call, DownIn, true) => c + e,
        (Call, DownIn, false) => a - bb + d + e,
        (Call, UpIn, true) => a + e,
        (Call, UpIn, false) => bb - c + d + e,
        (Put, DownIn, true) => bb - c + d + e,
        (Put, DownIn, false) => a + e,
        (Put, UpIn, true) => a - bb + d + e,
        (Put, UpIn, false) => c + e,
        (Call, DownOut, true) => a - c + f,
        (Call, DownOut, false) => bb - d + f,
        (Call, UpOut, true) => f,
        (Call, UpOut, false) => a - bb + c - d + f,
        (Put, DownOut, true) => a - bb + c - d + f,
        (Put, DownOut, false) => f,
        (Put, UpOut, true) => bb - d + f,
        (Put, UpOut, false) => a - c + f,
    }
}

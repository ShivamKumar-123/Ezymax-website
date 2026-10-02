//! Generalized Black-Scholes-Merton with cost of carry `b` (Haug, ch. 1).
//!
//! | model              | carry `b`   | underlying `s` |
//! |--------------------|-------------|----------------|
//! | Black-Scholes      | `r - q`     | spot           |
//! | Garman-Kohlhagen   | `rd - rf`   | FX spot        |
//! | Black-76 (futures) | `0`         | forward        |
//!
//! Conventions: rates and vol are annualised and continuously compounded,
//! `t` is in years. Theta is per year (divide by 365 or by your business-day
//! count for a daily figure), vega and rho are per 1.0 change (divide by 100
//! for "per vol point" / "per 1%").

use crate::normal::{norm_cdf, norm_pdf};

/// Call or put.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum OptionType {
    Call,
    Put,
}

impl OptionType {
    /// +1 for a call, -1 for a put.
    #[inline]
    pub fn sign(self) -> f64 {
        match self {
            OptionType::Call => 1.0,
            OptionType::Put => -1.0,
        }
    }
}

/// Price and first-order sensitivities of a European option.
///
/// * `delta` = dV/dS, `gamma` = d2V/dS2, `vega` = dV/dsigma.
/// * `theta` = -dV/dT (value change as calendar time passes), per year.
/// * `rho` = dV/dr (domestic / risk-free rate).
/// * `phi` = dV/dq (foreign rate for FX, dividend yield for equities and
///   metals); also called rho-foreign. For Black-76 it is 0.
///
/// For the generalized [`greeks`] function (inputs `r` and `b`), `rho` is taken
/// with `q = r - b` held fixed and `phi` with `r` held fixed (so `phi = -dV/db`).
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct Greeks {
    pub price: f64,
    pub delta: f64,
    pub gamma: f64,
    pub vega: f64,
    pub theta: f64,
    pub rho: f64,
    pub phi: f64,
}

#[inline]
fn valid(s: f64, k: f64, t: f64, sigma: f64, r: f64, b: f64) -> bool {
    s.is_finite()
        && k.is_finite()
        && s > 0.0
        && k > 0.0
        && t.is_finite()
        && t >= 0.0
        && sigma.is_finite()
        && sigma >= 0.0
        && r.is_finite()
        && b.is_finite()
}

/// d1 and d2 of the generalized BSM formula. Requires `sigma * sqrt(t) > 0`.
#[inline]
pub fn d1_d2(s: f64, k: f64, t: f64, b: f64, sigma: f64) -> (f64, f64) {
    let v = sigma * t.sqrt();
    let d1 = ((s / k).ln() + (b + 0.5 * sigma * sigma) * t) / v;
    (d1, d1 - v)
}

/// Generalized BSM price.
///
/// `s` spot (or forward for b = 0), `k` strike, `t` years, `r` discount rate,
/// `b` cost of carry, `sigma` vol. With `t == 0` or `sigma == 0` the result is
/// the discounted intrinsic value of the forward. Invalid inputs (non-positive
/// spot/strike, negative time/vol, non-finite values) return NaN.
pub fn price(kind: OptionType, s: f64, k: f64, t: f64, r: f64, b: f64, sigma: f64) -> f64 {
    if !valid(s, k, t, sigma, r, b) {
        return f64::NAN;
    }
    let phi = kind.sign();
    let carry_df = ((b - r) * t).exp();
    let df = (-r * t).exp();
    if t == 0.0 || sigma == 0.0 {
        return (phi * (s * carry_df - k * df)).max(0.0);
    }
    let (d1, d2) = d1_d2(s, k, t, b, sigma);
    phi * (s * carry_df * norm_cdf(phi * d1) - k * df * norm_cdf(phi * d2))
}

/// Generalized BSM price plus closed-form Greeks (see [`Greeks`] for the
/// meaning of `rho` and `phi`).
///
/// At `t == 0` or `sigma == 0` the price is the discounted intrinsic value,
/// delta is the step (`e^{(b-r)t}` or 0), and the other Greeks are 0.
pub fn greeks(kind: OptionType, s: f64, k: f64, t: f64, r: f64, b: f64, sigma: f64) -> Greeks {
    if !valid(s, k, t, sigma, r, b) {
        let n = f64::NAN;
        return Greeks { price: n, delta: n, gamma: n, vega: n, theta: n, rho: n, phi: n };
    }
    let w = kind.sign();
    let carry_df = ((b - r) * t).exp();
    let df = (-r * t).exp();
    if t == 0.0 || sigma == 0.0 {
        let intrinsic = w * (s * carry_df - k * df);
        let itm = intrinsic > 0.0;
        return Greeks {
            price: intrinsic.max(0.0),
            delta: if itm { w * carry_df } else { 0.0 },
            ..Greeks::default()
        };
    }
    let sqrt_t = t.sqrt();
    let (d1, d2) = d1_d2(s, k, t, b, sigma);
    let nd1 = norm_cdf(w * d1);
    let nd2 = norm_cdf(w * d2);
    let pdf1 = norm_pdf(d1);
    let fwd_pv = s * carry_df; // S e^{(b-r)T}
    let strike_pv = k * df; // K e^{-rT}

    let price = w * (fwd_pv * nd1 - strike_pv * nd2);
    let delta = w * carry_df * nd1;
    let gamma = carry_df * pdf1 / (s * sigma * sqrt_t);
    let vega = fwd_pv * pdf1 * sqrt_t;
    let theta = -fwd_pv * pdf1 * sigma / (2.0 * sqrt_t) - w * (b - r) * fwd_pv * nd1 - w * r * strike_pv * nd2;
    // dV/dr with q fixed: only the strike discounting depends on r.
    let rho = w * t * strike_pv * nd2;
    // dV/dq with r fixed (b = r - q falls): the forward term.
    let phi = -w * t * fwd_pv * nd1;
    Greeks { price, delta, gamma, vega, theta, rho, phi }
}

// ---------------------------------------------------------------- models

/// Garman-Kohlhagen FX option price (`b = rd - rf`). Premium is in domestic
/// (quote) currency per unit of foreign (base) currency.
pub fn gk_price(kind: OptionType, spot: f64, k: f64, t: f64, rd: f64, rf: f64, sigma: f64) -> f64 {
    price(kind, spot, k, t, rd, rd - rf, sigma)
}

/// Garman-Kohlhagen Greeks: `rho` = dV/drd, `phi` = dV/drf (rho foreign),
/// `delta` is the spot delta `e^{-rf t} N(d1)`.
pub fn gk_greeks(kind: OptionType, spot: f64, k: f64, t: f64, rd: f64, rf: f64, sigma: f64) -> Greeks {
    greeks(kind, spot, k, t, rd, rd - rf, sigma)
}

/// Black-Scholes(-Merton) price with continuous dividend / lease yield `q`
/// (`b = r - q`; `q = 0` is plain Black-Scholes).
pub fn bs_price(kind: OptionType, s: f64, k: f64, t: f64, r: f64, q: f64, sigma: f64) -> f64 {
    price(kind, s, k, t, r, r - q, sigma)
}

/// Black-Scholes(-Merton) Greeks: `rho` = dV/dr, `phi` = dV/dq.
pub fn bs_greeks(kind: OptionType, s: f64, k: f64, t: f64, r: f64, q: f64, sigma: f64) -> Greeks {
    greeks(kind, s, k, t, r, r - q, sigma)
}

/// Black-76 price of an option on a forward / future `f` (`b = 0`).
pub fn black76_price(kind: OptionType, f: f64, k: f64, t: f64, r: f64, sigma: f64) -> f64 {
    price(kind, f, k, t, r, 0.0, sigma)
}

/// Black-76 Greeks with respect to the forward: `delta` = dV/dF, `gamma` =
/// d2V/dF2, `rho` = dV/dr with F fixed (= -t * V), `phi` = 0.
pub fn black76_greeks(kind: OptionType, f: f64, k: f64, t: f64, r: f64, sigma: f64) -> Greeks {
    let mut g = greeks(kind, f, k, t, r, 0.0, sigma);
    g.rho = -t * g.price;
    g.phi = 0.0;
    g
}

/// Forward price `s * e^{b t}`.
#[inline]
pub fn forward(s: f64, t: f64, b: f64) -> f64 {
    s * (b * t).exp()
}

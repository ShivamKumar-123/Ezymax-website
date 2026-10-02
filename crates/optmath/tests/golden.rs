//! Golden values from Haug, "The Complete Guide to Option Pricing Formulas"
//! (2nd ed.), plus parity, finite-difference, round-trip and smile checks.

use optmath::OptionType::{Call, Put};
use optmath::*;

fn close(got: f64, want: f64, tol: f64, what: &str) {
    assert!((got - want).abs() <= tol, "{what}: got {got:.10}, want {want} (tol {tol:e})");
}

// ------------------------------------------------------------ vanilla golden

#[test]
fn haug_garman_kohlhagen() {
    // Haug's GK example is the call (0.0291); the put follows from parity.
    close(gk_price(Call, 1.56, 1.6, 0.5, 0.06, 0.08, 0.12), 0.0291, 5e-5, "GK call");
    close(gk_price(Put, 1.56, 1.6, 0.5, 0.06, 0.08, 0.12), 0.083, 5e-5, "GK put");
}

#[test]
fn haug_black76_call() {
    close(black76_price(Call, 19.0, 19.0, 0.75, 0.1, 0.28), 1.7011, 5e-5, "Black-76 call");
}

#[test]
fn haug_black_scholes_call() {
    close(bs_price(Call, 60.0, 65.0, 0.25, 0.08, 0.0, 0.3), 2.1334, 5e-5, "BS call");
}

#[test]
fn haug_generalized_and_merton() {
    // Generalized BSM put, b = 0.05.
    close(price(Put, 75.0, 70.0, 0.5, 0.1, 0.05, 0.35), 4.087, 5e-5, "GBSM put");
    // Merton (1973) put with dividend yield q = 0.05.
    close(bs_price(Put, 100.0, 95.0, 0.5, 0.1, 0.05, 0.2), 2.4648, 5e-5, "Merton put");
}

#[test]
fn haug_greek_examples() {
    // Delta: futures option (b = 0).
    close(greeks(Call, 105.0, 100.0, 0.5, 0.1, 0.0, 0.36).delta, 0.5946, 5e-5, "delta call");
    close(greeks(Put, 105.0, 100.0, 0.5, 0.1, 0.0, 0.36).delta, -0.3566, 5e-5, "delta put");
    // Gamma: S=55, K=60, b=r=0.10.
    close(greeks(Call, 55.0, 60.0, 0.75, 0.1, 0.1, 0.3).gamma, 0.0278, 5e-5, "gamma");
    // Theta: index put S=430, K=405, T=1/12, r=0.07, b=0.02.
    close(greeks(Put, 430.0, 405.0, 0.0833, 0.07, 0.02, 0.2).theta, -31.1924, 5e-4, "theta put");
    // Rho: S=72, K=75, T=1, b=r=0.09.
    close(greeks(Call, 72.0, 75.0, 1.0, 0.09, 0.09, 0.19).rho, 38.7325, 5e-4, "rho call");
}

// ------------------------------------------------------------ parity

#[test]
fn put_call_parity() {
    for &s in &[0.8, 1.0, 1.3] {
        for &k in &[0.7, 1.0, 1.4] {
            for &t in &[1.0 / 365.0, 0.25, 2.0] {
                for &(r, b) in &[(0.05, 0.02), (0.01, -0.03), (0.0, 0.0), (-0.005, 0.01)] {
                    for &sig in &[0.05, 0.2, 0.8] {
                        let c = price(Call, s, k, t, r, b, sig);
                        let p = price(Put, s, k, t, r, b, sig);
                        let rhs = s * ((b - r) * t).exp() - k * (-r * t).exp();
                        close(c - p, rhs, 1e-14, "parity");
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------------ greeks vs FD

fn central(f: impl Fn(f64) -> f64, x: f64, h: f64) -> f64 {
    (f(x + h) - f(x - h)) / (2.0 * h)
}

fn rel_close(got: f64, fd: f64, what: &str) {
    let tol = 1e-6 * fd.abs().max(1.0);
    assert!((got - fd).abs() <= tol, "{what}: closed form {got}, finite difference {fd}");
}

#[test]
fn gk_greeks_match_finite_differences() {
    for kind in [Call, Put] {
        for &(s, k, t, rd, rf, sig) in &[
            (1.1, 1.12, 0.25, 0.045, 0.03, 0.08),
            (150.0, 140.0, 0.08, 0.001, 0.05, 0.12),
            (1.27, 1.2, 1.5, 0.05, 0.04, 0.1),
            (0.65, 0.66, 3.0 / 365.0, 0.04, 0.045, 0.15),
        ] {
            let g = gk_greeks(kind, s, k, t, rd, rf, sig);
            close(g.price, gk_price(kind, s, k, t, rd, rf, sig), 1e-15, "price");
            let hs = s * sig * t.sqrt() * 1e-3;
            rel_close(g.delta, central(|x| gk_price(kind, x, k, t, rd, rf, sig), s, hs), "delta");
            rel_close(g.gamma, central(|x| gk_greeks(kind, x, k, t, rd, rf, sig).delta, s, hs), "gamma");
            rel_close(g.vega, central(|x| gk_price(kind, s, k, t, rd, rf, x), sig, 1e-5), "vega");
            rel_close(g.theta, -central(|x| gk_price(kind, s, k, x, rd, rf, sig), t, 1e-6 * t), "theta");
            rel_close(g.rho, central(|x| gk_price(kind, s, k, t, x, rf, sig), rd, 1e-6), "rho");
            rel_close(g.phi, central(|x| gk_price(kind, s, k, t, rd, x, sig), rf, 1e-6), "phi");
        }
    }
}

#[test]
fn bs_and_black76_greeks_match_finite_differences() {
    for kind in [Call, Put] {
        let (s, k, t, r, q, sig) = (2350.0, 2400.0, 0.1, 0.045, 0.01, 0.16);
        let g = bs_greeks(kind, s, k, t, r, q, sig);
        rel_close(g.delta, central(|x| bs_price(kind, x, k, t, r, q, sig), s, 0.01), "bs delta");
        rel_close(g.gamma, central(|x| bs_greeks(kind, x, k, t, r, q, sig).delta, s, 0.01), "bs gamma");
        rel_close(g.vega, central(|x| bs_price(kind, s, k, t, r, q, x), sig, 1e-5), "bs vega");
        rel_close(g.theta, -central(|x| bs_price(kind, s, k, x, r, q, sig), t, 1e-7), "bs theta");
        rel_close(g.rho, central(|x| bs_price(kind, s, k, t, x, q, sig), r, 1e-6), "bs rho");
        rel_close(g.phi, central(|x| bs_price(kind, s, k, t, r, x, sig), q, 1e-6), "bs phi");

        let (f, k, t, r, sig) = (78.5, 80.0, 0.3, 0.05, 0.35);
        let g = black76_greeks(kind, f, k, t, r, sig);
        rel_close(g.delta, central(|x| black76_price(kind, x, k, t, r, sig), f, 1e-3), "b76 delta");
        rel_close(g.gamma, central(|x| black76_greeks(kind, x, k, t, r, sig).delta, f, 1e-3), "b76 gamma");
        rel_close(g.vega, central(|x| black76_price(kind, f, k, t, r, x), sig, 1e-5), "b76 vega");
        rel_close(g.theta, -central(|x| black76_price(kind, f, k, x, r, sig), t, 1e-7), "b76 theta");
        rel_close(g.rho, central(|x| black76_price(kind, f, k, t, x, sig), r, 1e-6), "b76 rho");
        assert_eq!(g.phi, 0.0);
    }
}

#[test]
fn degenerate_inputs() {
    // Expired: intrinsic.
    close(gk_price(Call, 1.1, 1.05, 0.0, 0.05, 0.03, 0.1), 0.05, 1e-15, "expired call");
    close(gk_price(Put, 1.1, 1.05, 0.0, 0.05, 0.03, 0.1), 0.0, 0.0, "expired put");
    // Zero vol: discounted forward intrinsic.
    let want = 100.0 * (-0.01f64).exp() - 90.0 * (-0.05f64).exp();
    close(price(Call, 100.0, 90.0, 1.0, 0.05, 0.04, 0.0), want, 1e-12, "zero vol");
    assert!(price(Call, -1.0, 90.0, 1.0, 0.05, 0.04, 0.2).is_nan());
    assert!(price(Call, 100.0, 90.0, -1.0, 0.05, 0.04, 0.2).is_nan());
    assert!(greeks(Put, 100.0, 0.0, 1.0, 0.05, 0.04, 0.2).delta.is_nan());
}

// ------------------------------------------------------------ implied vol

#[test]
fn implied_vol_round_trip() {
    for kind in [Call, Put] {
        for &k in &[0.5, 0.8, 0.95, 1.0, 1.05, 1.25, 2.0] {
            for &t in &[1.0 / 365.0, 7.0 / 365.0, 0.25, 1.0, 5.0] {
                for &sig in &[0.02, 0.08, 0.25, 0.6, 1.5] {
                    let (s, r, b) = (1.0, 0.04, 0.015);
                    let p = price(kind, s, k, t, r, b, sig);
                    // Skip prices that carry no vol information in f64.
                    let intrinsic = (kind.sign() * (s * ((b - r) * t).exp() - k * (-r * t).exp())).max(0.0);
                    if p - intrinsic < 1e-12 {
                        continue;
                    }
                    let iv = implied_vol(kind, p, s, k, t, r, b).unwrap();
                    let back = price(kind, s, k, t, r, b, iv);
                    assert!((back - p).abs() <= 1e-13, "{kind:?} k={k} t={t} sig={sig}: repriced {back} vs {p}");
                    // Vol itself recovered where vega is meaningful.
                    let vega = greeks(kind, s, k, t, r, b, sig).vega;
                    if vega > 1e-4 {
                        assert!((iv - sig).abs() < 1e-8, "{kind:?} k={k} t={t} sig={sig}: iv {iv}");
                    }
                }
            }
        }
    }
}

#[test]
fn implied_vol_model_wrappers_and_errors() {
    let p = gk_price(Put, 1.56, 1.6, 0.5, 0.06, 0.08, 0.12);
    close(gk_implied_vol(Put, p, 1.56, 1.6, 0.5, 0.06, 0.08).unwrap(), 0.12, 1e-12, "gk iv");
    let p = black76_price(Call, 19.0, 19.0, 0.75, 0.1, 0.28);
    close(black76_implied_vol(Call, p, 19.0, 19.0, 0.75, 0.1).unwrap(), 0.28, 1e-12, "b76 iv");
    let p = bs_price(Call, 60.0, 65.0, 0.25, 0.08, 0.0, 0.3);
    close(bs_implied_vol(Call, p, 60.0, 65.0, 0.25, 0.08, 0.0).unwrap(), 0.3, 1e-12, "bs iv");

    assert_eq!(implied_vol(Call, 0.01, 100.0, 90.0, 1.0, 0.0, 0.0), Err(IvError::BelowIntrinsic));
    assert_eq!(implied_vol(Call, 100.0, 100.0, 90.0, 1.0, 0.0, 0.0), Err(IvError::AboveMaximum));
    assert_eq!(implied_vol(Put, 1.0, 100.0, 90.0, 0.0, 0.0, 0.0), Err(IvError::InvalidInput));
    assert_eq!(implied_vol(Call, 10.0, 100.0, 90.0, 1.0, 0.0, 0.0), Ok(iv::MIN_VOL));
}

// ------------------------------------------------------------ barriers

#[test]
fn haug_down_and_out_call_with_rebate() {
    let v = barrier_price(Call, BarrierType::DownOut, 100.0, 90.0, 95.0, 3.0, 0.5, 0.08, 0.04, 0.25);
    close(v, 9.0246, 5e-5, "down-and-out call");
}

#[test]
fn haug_barrier_table() {
    // Haug table 4-13: S=100, rebate=3, T=0.5, r=0.08, b=0.04, sigma=0.25.
    use BarrierType::*;
    let cases = [
        (Call, DownOut, 90.0, 95.0, 9.0246),
        (Call, DownOut, 100.0, 95.0, 6.7924),
        (Call, DownOut, 110.0, 95.0, 4.8759),
        (Call, DownOut, 90.0, 100.0, 3.0),
        (Call, UpOut, 90.0, 105.0, 2.6789),
        (Call, UpOut, 100.0, 105.0, 2.358),
        (Call, UpOut, 110.0, 105.0, 2.3453),
        (Call, DownIn, 90.0, 95.0, 7.7627),
        (Call, DownIn, 100.0, 95.0, 4.0109),
        (Call, DownIn, 110.0, 95.0, 2.0576),
        (Call, UpIn, 90.0, 105.0, 14.1112),
        (Call, UpIn, 100.0, 105.0, 8.4482),
        (Call, UpIn, 110.0, 105.0, 4.591),
        (Put, DownIn, 90.0, 95.0, 2.9586),
        (Put, DownIn, 100.0, 95.0, 6.5677),
        (Put, DownIn, 110.0, 95.0, 11.9752),
        (Put, UpOut, 90.0, 105.0, 3.776),
        (Put, UpOut, 100.0, 105.0, 5.4932),
        (Put, UpOut, 110.0, 105.0, 7.5187),
    ];
    for (kind, bt, k, h, want) in cases {
        let v = barrier_price(kind, bt, 100.0, k, h, 3.0, 0.5, 0.08, 0.04, 0.25);
        close(v, want, 5e-5, &format!("{kind:?} {bt:?} K={k} H={h}"));
    }
}

#[test]
fn barrier_in_plus_out_equals_vanilla() {
    use BarrierType::*;
    for kind in [Call, Put] {
        for &k in &[80.0, 95.0, 100.0, 105.0, 120.0] {
            for &(r, b) in &[(0.08, 0.04), (0.02, -0.01), (0.05, 0.05), (-0.0075, -0.0375)] {
                for &sig in &[0.05, 0.1, 0.3] {
                    let vanilla = price(kind, 100.0, k, 0.75, r, b, sig);
                    for &(h, down) in &[(90.0, true), (98.0, true), (102.0, false), (115.0, false)] {
                        let (bin, bout) = if down { (DownIn, DownOut) } else { (UpIn, UpOut) };
                        let vin = barrier_price(kind, bin, 100.0, k, h, 0.0, 0.75, r, b, sig);
                        let vout = barrier_price(kind, bout, 100.0, k, h, 0.0, 0.75, r, b, sig);
                        assert!(vin >= -1e-12 && vout >= -1e-12, "negative barrier value");
                        close(vin + vout, vanilla, 1e-10, &format!("{kind:?} K={k} H={h} r={r} b={b} sig={sig}"));
                    }
                }
            }
        }
    }
}

#[test]
fn barrier_breached_and_expired() {
    use BarrierType::*;
    let vanilla = price(Call, 94.0, 90.0, 0.5, 0.08, 0.04, 0.25);
    close(barrier_price(Call, DownOut, 94.0, 90.0, 95.0, 3.0, 0.5, 0.08, 0.04, 0.25), 3.0, 0.0, "knocked out");
    close(barrier_price(Call, DownIn, 94.0, 90.0, 95.0, 3.0, 0.5, 0.08, 0.04, 0.25), vanilla, 0.0, "knocked in");
    close(barrier_price(Put, UpOut, 100.0, 110.0, 105.0, 0.0, 0.0, 0.08, 0.04, 0.25), 10.0, 1e-12, "expired out");
    close(barrier_price(Put, UpIn, 100.0, 110.0, 105.0, 2.0, 0.0, 0.08, 0.04, 0.25), 2.0, 0.0, "expired in");
    // Knock-out converges to the vanilla as the barrier moves away.
    let far = barrier_price(Call, DownOut, 100.0, 100.0, 1.0, 0.0, 0.5, 0.08, 0.04, 0.25);
    close(far, price(Call, 100.0, 100.0, 0.5, 0.08, 0.04, 0.25), 1e-10, "far barrier");
}

// ------------------------------------------------------------ smile

fn eurusd_smile(conv: DeltaConvention) -> (Smile, f64, f64, f64, f64) {
    let (spot, t, rd, rf) = (1.1, 0.25, 0.045, 0.03);
    let q = SmileQuotes { atm: 0.08, rr25: -0.006, bf25: 0.002, rr10: Some(-0.011), bf10: Some(0.007) };
    (Smile::new(q, spot, t, rd, rf, conv).unwrap(), spot, t, rd, rf)
}

#[test]
fn smile_pillars_from_rr_bf() {
    let (smile, ..) = eurusd_smile(DeltaConvention::Forward);
    let vols: Vec<f64> = smile.pillars().iter().map(|p| p.1).collect();
    let want = [0.08 + 0.007 - 0.0055, 0.08 + 0.002 - 0.003, 0.08, 0.08 + 0.002 + 0.003, 0.08 + 0.007 + 0.0055];
    for (g, w) in vols.iter().zip(want) {
        close(*g, w, 1e-15, "pillar vol");
    }
    let deltas: Vec<f64> = smile.pillars().iter().map(|p| p.0).collect();
    assert_eq!(deltas, [0.1, 0.25, 0.5, 0.75, 0.9]);
    // Interpolation reproduces the pillars and stays within their range.
    for &(d, v) in smile.pillars() {
        close(smile.vol_at_call_delta(d), v, 1e-15, "node");
    }
    let (lo, hi) = (vols.iter().cloned().fold(1.0, f64::min), vols.iter().cloned().fold(0.0, f64::max));
    for i in 1..1000 {
        let v = smile.vol_at_call_delta(i as f64 / 1000.0);
        assert!((lo - 1e-15..=hi + 1e-15).contains(&v), "overshoot at {i}: {v}");
    }
}

#[test]
fn smile_strike_vol_consistency() {
    for conv in [DeltaConvention::Spot, DeltaConvention::Forward] {
        let (smile, spot, t, rd, rf) = eurusd_smile(conv);
        // ATM DNS strike carries ATM vol and has call delta = -put delta.
        let k_atm = smile.atm_strike();
        let v_atm = smile.vol_at_strike(k_atm);
        close(v_atm, 0.08, 1e-12, "atm vol");
        let c = gk_greeks(Call, spot, k_atm, t, rd, rf, v_atm).delta;
        let p = gk_greeks(Put, spot, k_atm, t, rd, rf, v_atm).delta;
        close(c + p, 0.0, 1e-12, "DNS");

        // The 25D call strike, priced at the smile vol, has the quoted delta.
        let scale = if conv == DeltaConvention::Spot { (-rf * t).exp() } else { 1.0 };
        for &(nd1, quoted, kind) in &[
            (smile.pillars()[1].0, 0.25, Call),
            (smile.pillars()[3].0, -0.25, Put),
            (smile.pillars()[0].0, 0.1, Call),
            (smile.pillars()[4].0, -0.1, Put),
        ] {
            let k = smile.strike_at_call_delta(nd1);
            let v = smile.vol_at_strike(k);
            close(v, smile.vol_at_call_delta(nd1), 1e-12, "pillar strike vol");
            let fwd_delta = gk_greeks(kind, spot, k, t, rd, rf, v).delta * (rf * t).exp();
            close(fwd_delta * scale, quoted, 1e-10, "pillar delta");
        }
        // Strike -> vol across a wide range is finite and inside the pillar range.
        for i in 0..=200 {
            let k = spot * (0.8 + 0.4 * i as f64 / 200.0);
            let v = smile.vol_at_strike(k);
            assert!(v.is_finite() && (0.078..=0.093).contains(&v), "K={k} vol={v}");
        }
    }
}

#[test]
fn smile_without_10d_and_errors() {
    let q = SmileQuotes { atm: 0.15, rr25: 0.01, bf25: 0.003, rr10: None, bf10: None };
    let s = Smile::new(q, 2400.0, 7.0 / 365.0, 0.045, 0.0, DeltaConvention::Forward).unwrap();
    assert_eq!(s.pillars().len(), 3);
    close(s.vol_at_call_delta(0.01), 0.15 + 0.003 + 0.005, 1e-15, "flat extrapolation");
    let bad = SmileQuotes { atm: 0.01, rr25: 0.0, bf25: -0.02, rr10: None, bf10: None };
    assert_eq!(Smile::new(bad, 1.0, 0.5, 0.0, 0.0, DeltaConvention::Spot), Err(SmileError::NonPositiveVol));
    assert_eq!(Smile::new(q, 1.0, 0.0, 0.0, 0.0, DeltaConvention::Spot), Err(SmileError::InvalidInput));
}

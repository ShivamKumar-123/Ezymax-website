//! Term structure, realized vol, strike ladder, TWAP, scenario grid and payoff.

use optmath::OptionType::{Call, Put};
use optmath::ladder::{extension, format_strike, ladder, step_decimals, strike_ticks, tick_to_strike};
use optmath::payoff::{Leg, LegKind, payoff, summarize};
use optmath::realized::{Ohlc, close_to_close, ewma, garman_klass, rogers_satchell, yang_zhang};
use optmath::scenario::{Instrument, Market, RiskPosition, ScanParams, scenario_grid};
use optmath::term::{SurfaceError, TenorQuotes, VolSurface, calendar_violations};
use optmath::twap::{twap, twap_bars};
use optmath::*;
use proptest::prelude::*;

fn q(atm: f64, rr25: f64, bf25: f64) -> SmileQuotes {
    SmileQuotes { atm, rr25, bf25, rr10: None, bf10: None }
}

fn tq(days: f64, quotes: SmileQuotes) -> TenorQuotes {
    TenorQuotes { t: days / 365.0, quotes }
}

// ------------------------------------------------------------ term structure

#[test]
fn term_structure_interpolates_total_variance() {
    let s = VolSurface::new(vec![tq(7.0, q(0.10, -0.01, 0.002)), tq(30.0, q(0.09, -0.006, 0.003)), tq(91.0, q(0.085, -0.004, 0.004))]).unwrap();
    let (t1, t2) = (7.0 / 365.0, 30.0 / 365.0);
    // At the pillars.
    assert!((s.atm_vol(t1) - 0.10).abs() < 1e-14);
    assert!((s.atm_vol(t2) - 0.09).abs() < 1e-14);
    // Halfway in time = halfway in total variance.
    let tm = 0.5 * (t1 + t2);
    let w = 0.5 * (0.01 * t1 + 0.0081 * t2);
    assert!((s.total_variance(tm) - w).abs() < 1e-15);
    assert!((s.atm_vol(tm) - (w / tm).sqrt()).abs() < 1e-14);
    // Flat vol outside, RR / BF linear in time.
    assert!((s.atm_vol(1.0 / 365.0) - 0.10).abs() < 1e-14);
    assert!((s.atm_vol(2.0) - 0.085).abs() < 1e-14);
    let qm = s.quotes_at(tm);
    assert!((qm.rr25 - (-0.008)).abs() < 1e-14 && (qm.bf25 - 0.0025).abs() < 1e-14);
    assert_eq!(qm.rr10, None);
}

#[test]
fn calendar_arbitrage_is_rejected() {
    // 1W 12% then 1M 5%: ATM total variance falls.
    let bad = vec![tq(7.0, q(0.12, 0.0, 0.0)), tq(30.0, q(0.05, 0.0, 0.0))];
    match VolSurface::new(bad.clone()) {
        Err(SurfaceError::CalendarArbitrage(v)) => {
            assert!(v.iter().any(|x| x.what == "ATM" && x.index == 1));
            assert!(SurfaceError::CalendarArbitrage(v).to_string().contains("calendar arbitrage"));
        }
        other => panic!("expected calendar arbitrage, got {other:?}"),
    }
    assert!(!calendar_violations(&bad).is_empty());
    // Wing-only violation: ATM fine, the 25D put wing collapses.
    let wing = vec![tq(7.0, q(0.08, -0.08, 0.02)), tq(8.0, q(0.08, 0.0, 0.0))];
    assert!(matches!(VolSurface::new(wing), Err(SurfaceError::CalendarArbitrage(_))));
    assert_eq!(VolSurface::new(vec![]), Err(SurfaceError::Empty));
    assert_eq!(VolSurface::new(vec![tq(30.0, q(0.1, 0.0, 0.0)), tq(7.0, q(0.1, 0.0, 0.0))]), Err(SurfaceError::NotIncreasing(1)));
    assert_eq!(VolSurface::new(vec![tq(7.0, q(-0.1, 0.0, 0.0))]), Err(SurfaceError::InvalidPillar(0)));
}

proptest! {
    #[test]
    fn clean_surfaces_have_increasing_total_variance(v1 in 0.03f64..0.3, bumps in proptest::collection::vec(0.0f64..0.02, 4), t in 0.0005f64..1.5, dt in 0.0001f64..0.5) {
        // Non-decreasing ATM vols guarantee non-decreasing total variance.
        let days = [1.0, 7.0, 30.0, 91.0, 182.0];
        let mut atm = v1;
        let mut pillars = vec![];
        for (i, dd) in days.iter().enumerate() {
            if i > 0 { atm += bumps[i - 1]; }
            pillars.push(tq(*dd, q(atm, 0.0, 0.001)));
        }
        let s = VolSurface::new(pillars).unwrap();
        prop_assert!(s.total_variance(t + dt) >= s.total_variance(t) - 1e-15);
        let v = s.atm_vol(t);
        prop_assert!(v > 0.0 && v.is_finite());
    }
}

// ------------------------------------------------------------ realized vol

/// Deterministic generator (SplitMix64 + Box-Muller).
struct Rng(u64);
impl Rng {
    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn uniform(&mut self) -> f64 {
        ((self.next_u64() >> 11) as f64 + 0.5) / (1u64 << 53) as f64
    }
    fn normal(&mut self) -> f64 {
        let (u1, u2) = (self.uniform(), self.uniform());
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

/// GBM bars: `steps` sub-steps per bar, annual vol `sigma`, `ppy` bars per year, overnight gap share `gap`.
fn gbm_bars(n: usize, sigma: f64, ppy: f64, steps: usize, gap: f64, seed: u64) -> Vec<Ohlc> {
    let mut rng = Rng(seed);
    let var_bar = sigma * sigma / ppy;
    let sd_gap = (var_bar * gap).sqrt();
    let sd_step = (var_bar * (1.0 - gap) / steps as f64).sqrt();
    let mut px = 100.0f64;
    let mut out = Vec::with_capacity(n);
    for _ in 0..n {
        px *= (sd_gap * rng.normal() - 0.5 * sd_gap * sd_gap).exp();
        let o = px;
        let (mut h, mut l) = (px, px);
        for _ in 0..steps {
            px *= (sd_step * rng.normal() - 0.5 * sd_step * sd_step).exp();
            h = h.max(px);
            l = l.min(px);
        }
        out.push(Ohlc::new(o, h, l, px));
    }
    out
}

#[test]
fn garman_klass_golden_flat_bars() {
    // o = c, h/l fixed: variance per bar = 0.5 ln(H/L)^2.
    let bars = vec![Ohlc::new(100.0, 101.0, 99.0, 100.0); 20];
    let want = (0.5 * (101.0f64 / 99.0).ln().powi(2) * 260.0).sqrt();
    assert!((garman_klass(&bars, 260.0).unwrap() - want).abs() < 1e-14);
    // Rogers-Satchell for the same bars: ln(H/C)ln(H/O) + ln(L/C)ln(L/O) = ln(1.01)^2 + ln(0.99)^2.
    let rs = ((1.01f64.ln().powi(2) + 0.99f64.ln().powi(2)) * 260.0).sqrt();
    assert!((rogers_satchell(&bars, 260.0).unwrap() - rs).abs() < 1e-14);
    // No movement between bars: close-to-close is 0.
    assert_eq!(close_to_close(&bars, 260.0), Some(0.0));
}

#[test]
fn estimators_recover_simulated_vol() {
    let sigma = 0.12;
    let bars = gbm_bars(6000, sigma, 260.0, 300, 0.0, 7);
    for (name, v) in [
        ("close", close_to_close(&bars, 260.0).unwrap()),
        ("gk", garman_klass(&bars, 260.0).unwrap()),
        ("rs", rogers_satchell(&bars, 260.0).unwrap()),
        ("yz", yang_zhang(&bars, 260.0).unwrap()),
    ] {
        assert!((v / sigma - 1.0).abs() < 0.06, "{name}: {v}");
    }
    // With a 30% overnight gap share, only Yang-Zhang (and close-to-close) see the full variance.
    let gappy = gbm_bars(6000, sigma, 260.0, 300, 0.3, 11);
    let yz = yang_zhang(&gappy, 260.0).unwrap();
    let gk = garman_klass(&gappy, 260.0).unwrap();
    assert!((yz / sigma - 1.0).abs() < 0.06, "yz {yz}");
    assert!(gk < 0.9 * sigma, "gk should miss the gaps: {gk}");
}

#[test]
fn ewma_and_invalid_inputs() {
    // Alternating +-1% returns: every squared return is the same, so EWMA = that return.
    let mut closes = vec![100.0];
    for i in 0..50 {
        let last = *closes.last().unwrap();
        closes.push(if i % 2 == 0 { last * 0.01f64.exp() } else { last * (-0.01f64).exp() });
    }
    let v = ewma(&closes, 0.94, 260.0).unwrap();
    assert!((v - 0.01 * 260f64.sqrt()).abs() < 1e-12, "{v}");
    assert_eq!(ewma(&closes[..2], 0.94, 260.0), None);
    assert_eq!(ewma(&closes, 1.0, 260.0), None);
    let bad = vec![Ohlc::new(100.0, 99.0, 98.0, 100.0); 5]; // high below open
    assert_eq!(yang_zhang(&bad, 260.0), None);
    assert_eq!(garman_klass(&[], 260.0), None);
}

proptest! {
    #[test]
    fn realized_vol_is_scale_invariant(seed in 0u64..1000, k in 0.01f64..1000.0) {
        let bars = gbm_bars(60, 0.2, 260.0, 20, 0.2, seed);
        let scaled: Vec<Ohlc> = bars.iter().map(|b| Ohlc::new(b.o * k, b.h * k, b.l * k, b.c * k)).collect();
        for (a, b) in [
            (yang_zhang(&bars, 260.0), yang_zhang(&scaled, 260.0)),
            (garman_klass(&bars, 260.0), garman_klass(&scaled, 260.0)),
            (close_to_close(&bars, 260.0), close_to_close(&scaled, 260.0)),
        ] {
            let (a, b) = (a.unwrap(), b.unwrap());
            prop_assert!((a - b).abs() < 1e-9 * a.max(1e-12));
        }
    }
}

// ------------------------------------------------------------ strike ladder

#[test]
fn ladder_golden() {
    assert_eq!(step_decimals(0.0025), 4);
    assert_eq!(step_decimals(0.5), 1);
    assert_eq!(step_decimals(25.0), 0);
    assert_eq!(step_decimals(0.05), 2);
    let l = ladder(1.16537, 0.0025, 3);
    assert_eq!(l, vec![463, 464, 465, 466, 467, 468, 469]);
    assert_eq!(format_strike(466, 0.0025), "1.1650");
    assert_eq!(tick_to_strike(466, 0.0025), 1.165);
    assert_eq!(format_strike(295, 0.5), "147.5");
    assert_eq!(format_strike(106, 25.0), "2650");
    assert_eq!(strike_ticks(147.26, 0.5), 295);
    // Spot drifts up to 2 strikes from the top: three new strikes restore 3 above ATM.
    let listed: Vec<i64> = (463..=469).collect();
    assert_eq!(extension(&listed, 0.0025 * 467.0, 0.0025, 3, 2), vec![470]);
    assert_eq!(extension(&listed, 0.0025 * 469.0, 0.0025, 3, 2), vec![470, 471, 472]);
    assert!(extension(&listed, 0.0025 * 466.0, 0.0025, 3, 2).is_empty());
    assert_eq!(extension(&listed, 0.0025 * 463.0, 0.0025, 3, 2), vec![460, 461, 462]);
    assert_eq!(extension(&[], 1.16537, 0.0025, 1, 1), vec![465, 466, 467]);
    // never below a positive strike
    assert!(ladder(0.001, 0.0025, 5).is_empty() || ladder(0.001, 0.0025, 5).iter().all(|t| *t > 0));
}

proptest! {
    #[test]
    fn extension_restores_the_ladder(atm0 in 100i64..1000, moves in -40i64..40, n in 2u32..15, th_frac in 0u32..100) {
        let th = th_frac % n;
        let step = 0.0025;
        let listed: Vec<i64> = ladder(atm0 as f64 * step, step, n);
        let spot = (atm0 + moves) as f64 * step;
        let add = extension(&listed, spot, step, n, th);
        prop_assert!(add.iter().all(|t| !listed.contains(t) && *t > 0));
        let mut all = listed.clone();
        all.extend(add.iter().copied());
        all.sort_unstable();
        // contiguous, and when an edge was within the threshold, n strikes on that side again
        prop_assert!(all.windows(2).all(|w| w[1] == w[0] + 1));
        let atm = atm0 + moves;
        let (lo, hi) = (*all.first().unwrap(), *all.last().unwrap());
        prop_assert!(hi - atm > th as i64 || hi - atm >= n as i64);
        prop_assert!(atm - lo > th as i64 || atm - lo >= n as i64 || lo == 1);
    }
}

// ------------------------------------------------------------ TWAP

#[test]
fn twap_constant_ramp_and_gaps() {
    let (start, end) = (0i64, 1_800_000i64); // 30 minutes
    let flat: Vec<(i64, f64)> = (0..1800).map(|i| (i * 1000, 1.17)).collect();
    let r = twap(&flat, start, end, 1000, None).unwrap();
    assert!((r.value - 1.17).abs() < 1e-15);
    assert_eq!((r.samples, r.expected, r.covered_slots, r.max_gap_ms), (1800, 1800, 1800, 1000));
    assert!((r.coverage - 1.0).abs() < 1e-15);

    // Linear ramp 0..1799 sampled each second: step-function TWAP = mean of the samples.
    let ramp: Vec<(i64, f64)> = (0..1800).map(|i| (i * 1000, 100.0 + i as f64)).collect();
    let r = twap(&ramp, start, end, 1000, None).unwrap();
    assert!((r.value - (100.0 + 1799.0 / 2.0)).abs() < 1e-9);

    // A 10-minute feed gap holds the last price; coverage and the longest gap report it.
    let gappy: Vec<(i64, f64)> = (0..1800).filter(|i| !(600..1200).contains(i)).map(|i| (i * 1000, if i < 600 { 1.0 } else { 2.0 })).collect();
    let r = twap(&gappy, start, end, 1000, None).unwrap();
    // 600 s at 1.0, then 1.0 held through the gap (600 s), then 600 s at 2.0.
    assert!((r.value - (1200.0 * 1.0 + 600.0 * 2.0) / 1800.0).abs() < 1e-12, "{}", r.value);
    assert_eq!(r.samples, 1200);
    assert!((r.coverage - 1200.0 / 1800.0).abs() < 1e-12);
    assert_eq!(r.max_gap_ms, 601_000);

    // Late first sample: prior mid fills the head, else it is back-filled.
    let late = vec![(900_000, 2.0)];
    let with_prior = twap(&late, start, end, 1000, Some(1.0)).unwrap();
    assert!((with_prior.value - 1.5).abs() < 1e-12 && with_prior.backfilled_ms == 0);
    let backfilled = twap(&late, start, end, 1000, None).unwrap();
    assert!((backfilled.value - 2.0).abs() < 1e-12 && backfilled.backfilled_ms == 900_000);
    // Samples outside the window are ignored; nothing usable -> None, prior only -> prior with coverage 0.
    assert_eq!(twap(&[(end, 5.0)], start, end, 1000, None), None);
    let p = twap(&[], start, end, 1000, Some(1.25)).unwrap();
    assert_eq!((p.value, p.coverage), (1.25, 0.0));
}

#[test]
fn twap_from_m1_bars() {
    let bar = |t: i64, px: f64| (t * 60_000, Ohlc::new(px, px + 0.002, px - 0.002, px));
    let bars: Vec<(i64, Ohlc)> = (0..30).filter(|i| *i != 10).map(|i| bar(i, 1.0 + i as f64 * 0.001)).collect();
    let r = twap_bars(&bars, 0, 1_800_000, 60_000).unwrap();
    let want = bars.iter().map(|(_, b)| (b.o + b.h + b.l + b.c) / 4.0).sum::<f64>() / 29.0;
    assert!((r.value - want).abs() < 1e-12);
    assert_eq!((r.samples, r.expected, r.max_gap_ms), (29, 30, 60_000));
    assert!(twap_bars(&[], 0, 1_800_000, 60_000).is_none());
}

proptest! {
    #[test]
    fn twap_lies_within_sample_range(pxs in proptest::collection::vec(0.5f64..2.0, 1..200), gaps in proptest::collection::vec(1i64..30_000, 200)) {
        let mut t = 0;
        let mut s = vec![];
        for (i, p) in pxs.iter().enumerate() {
            s.push((t, *p));
            t += gaps[i];
        }
        let end = t + 1;
        let r = twap(&s, 0, end, 1000, None).unwrap();
        let lo = pxs.iter().copied().fold(f64::INFINITY, f64::min);
        let hi = pxs.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        prop_assert!(r.value >= lo - 1e-12 && r.value <= hi + 1e-12);
        prop_assert!(r.coverage > 0.0 && r.coverage <= 1.0);
    }
}

// ------------------------------------------------------------ scenario grid

fn no_time() -> ScanParams {
    ScanParams { dt_cal: 0.0, dt_vol: 0.0, ..ScanParams::default() }
}

#[test]
fn linear_position_worst_loss_is_the_extreme_move() {
    let m = Market { spot: 1.17, r: 0.04, b: 0.02 };
    let pos = [RiskPosition { instrument: Instrument::Linear, qty: 100_000.0, t_cal: 0.0, t_vol: 0.0, vol: 0.0 }];
    let p = ScanParams::default();
    let g = scenario_grid(&pos, m, &p);
    // max(R, 0.35 x 3R) = 1.05 R on the down side.
    let want = 100_000.0 * 1.17 * 0.03 * 1.05;
    assert!((g.worst_loss - want).abs() < 1e-6, "{}", g.worst_loss);
    assert_eq!(g.worst_scenario, Some(15));
    assert_eq!(scenario_grid(&[], m, &p).worst_loss, 0.0);
}

#[test]
fn long_option_never_loses_more_than_its_value() {
    let m = Market { spot: 2650.0, r: 0.04, b: 0.035 };
    let pos = [RiskPosition { instrument: Instrument::Vanilla { kind: Call, strike: 2700.0 }, qty: 1.0, t_cal: 7.0 / 365.0, t_vol: 5.0 / 260.0, vol: 0.18 }];
    let g = scenario_grid(&pos, m, &ScanParams { price_range: 0.06, ..ScanParams::default() });
    assert!(g.worst_loss > 0.0 && g.worst_loss <= g.base_value + 1e-9, "{} vs {}", g.worst_loss, g.base_value);
}

#[test]
fn expiring_and_barrier_positions_are_valued() {
    let m = Market { spot: 100.0, r: 0.03, b: 0.01 };
    // Expires within the one-day step: valued at intrinsic in every scenario.
    let pos = [RiskPosition { instrument: Instrument::Vanilla { kind: Put, strike: 100.0 }, qty: -1.0, t_cal: 0.5 / 365.0, t_vol: 0.5 / 260.0, vol: 0.2 }];
    let g = scenario_grid(&pos, m, &ScanParams::default());
    // short ATM put, extreme down move 9%: loss 0.35 x 9 minus the premium, or full -3% scenario
    assert!(g.worst_loss > 2.0 && g.worst_loss < 3.5, "{}", g.worst_loss);
    // A down-and-out call knocked out in the down scenarios is worth its rebate.
    let ko = [RiskPosition {
        instrument: Instrument::Barrier { kind: Call, strike: 100.0, barrier: 98.0, barrier_type: BarrierType::DownOut, rebate: 0.0 },
        qty: 1.0,
        t_cal: 0.1,
        t_vol: 0.1,
        vol: 0.2,
    }];
    let g = scenario_grid(&ko, m, &no_time());
    assert!((g.losses[12] - g.base_value).abs() < 1e-9, "full loss when knocked out: {:?}", g.losses);
}

proptest! {
    #[test]
    fn scenario_pnl_is_antisymmetric(k in 0.9f64..1.1, qty in -5.0f64..5.0, lin in -3.0f64..3.0, t in 0.003f64..0.5, vol in 0.04f64..0.4) {
        let m = Market { spot: 1.0, r: 0.03, b: 0.01 };
        let book = |sgn: f64| vec![
            RiskPosition { instrument: Instrument::Vanilla { kind: Call, strike: k }, qty: sgn * qty, t_cal: t, t_vol: t * 0.8, vol },
            RiskPosition { instrument: Instrument::Linear, qty: sgn * lin, t_cal: 0.0, t_vol: 0.0, vol: 0.0 },
        ];
        let p = ScanParams::default();
        let a = scenario_grid(&book(1.0), m, &p);
        let b = scenario_grid(&book(-1.0), m, &p);
        for i in 0..16 {
            prop_assert!((a.pnl[i] + b.pnl[i]).abs() < 1e-12);
        }
        prop_assert!(a.worst_loss >= 0.0);
    }

    #[test]
    fn synthetic_forward_hedged_has_no_risk(k in 0.8f64..1.2, t in 0.01f64..1.0, vol in 0.04f64..0.5) {
        // long call - short put = forward; hedge with -e^{(b-r)t} units of spot: flat in every scenario (no time step).
        let m = Market { spot: 1.0, r: 0.03, b: 0.01 };
        let fwd_units = ((m.b - m.r) * t).exp();
        let pos = [
            RiskPosition { instrument: Instrument::Vanilla { kind: Call, strike: k }, qty: 1.0, t_cal: t, t_vol: t, vol },
            RiskPosition { instrument: Instrument::Vanilla { kind: Put, strike: k }, qty: -1.0, t_cal: t, t_vol: t, vol },
            RiskPosition { instrument: Instrument::Linear, qty: -fwd_units, t_cal: 0.0, t_vol: 0.0, vol: 0.0 },
        ];
        let g = scenario_grid(&pos, m, &no_time());
        prop_assert!(g.worst_loss < 1e-12, "{}", g.worst_loss);
    }
}

// ------------------------------------------------------------ payoff

#[test]
fn payoff_shapes() {
    let long_call = [Leg { kind: LegKind::Call { strike: 1.17 }, qty: 10_000.0, price: 0.004 }];
    let s = summarize(&long_call);
    assert_eq!(s.breakevens.len(), 1);
    assert!((s.breakevens[0] - 1.174).abs() < 1e-12);
    assert_eq!(s.max_profit, None);
    assert!((s.max_loss.unwrap() - 40.0).abs() < 1e-9);

    let short_put = [Leg { kind: LegKind::Put { strike: 2650.0 }, qty: -1.0, price: 22.0 }];
    let s = summarize(&short_put);
    assert_eq!(s.breakevens, vec![2628.0]);
    assert_eq!(s.max_profit, Some(22.0));
    assert!((s.max_loss.unwrap() - 2628.0).abs() < 1e-9);

    // Long straddle: two breakevens, unlimited upside.
    let straddle = [
        Leg { kind: LegKind::Call { strike: 100.0 }, qty: 1.0, price: 3.0 },
        Leg { kind: LegKind::Put { strike: 100.0 }, qty: 1.0, price: 2.5 },
    ];
    let s = summarize(&straddle);
    assert_eq!(s.breakevens, vec![94.5, 105.5]);
    assert_eq!((s.max_profit, s.max_loss), (None, Some(5.5)));

    // Iron condor 90/95/105/110 for a 2.0 credit: max profit 2, max loss 3.
    let condor = [
        Leg { kind: LegKind::Put { strike: 90.0 }, qty: 1.0, price: 0.5 },
        Leg { kind: LegKind::Put { strike: 95.0 }, qty: -1.0, price: 1.5 },
        Leg { kind: LegKind::Call { strike: 105.0 }, qty: -1.0, price: 1.5 },
        Leg { kind: LegKind::Call { strike: 110.0 }, qty: 1.0, price: 0.5 },
    ];
    let s = summarize(&condor);
    assert_eq!(s.breakevens, vec![93.0, 107.0]);
    assert!((s.max_profit.unwrap() - 2.0).abs() < 1e-12 && (s.max_loss.unwrap() - 3.0).abs() < 1e-12);
    assert_eq!(s.kinks, vec![90.0, 95.0, 105.0, 110.0]);

    // Covered call: long spot at 100, short 105 call for 2: capped upside, loss bounded at S = 0.
    let covered = [Leg { kind: LegKind::Linear, qty: 1.0, price: 100.0 }, Leg { kind: LegKind::Call { strike: 105.0 }, qty: -1.0, price: 2.0 }];
    let s = summarize(&covered);
    assert_eq!(s.breakevens, vec![98.0]);
    assert_eq!((s.max_profit, s.max_loss), (Some(7.0), Some(98.0)));
    assert!((payoff(&covered, 120.0) - 7.0).abs() < 1e-12);
}

proptest! {
    #[test]
    fn breakevens_are_zeros_and_extremes_bound_the_payoff(
        legs in proptest::collection::vec((0u8..3, 50.0f64..150.0, -3.0f64..3.0, 0.0f64..10.0), 1..5),
        probe in 0.0f64..400.0,
    ) {
        let legs: Vec<Leg> = legs.into_iter().map(|(k, strike, qty, price)| Leg {
            kind: match k { 0 => LegKind::Call { strike }, 1 => LegKind::Put { strike }, _ => LegKind::Linear },
            qty,
            price: if k == 2 { strike } else { price },
        }).collect();
        let s = summarize(&legs);
        let scale = legs.iter().map(|l| l.qty.abs() * 200.0).sum::<f64>().max(1.0);
        for b in &s.breakevens {
            prop_assert!(payoff(&legs, *b).abs() < 1e-9 * scale, "payoff at {b} = {}", payoff(&legs, *b));
        }
        let y = payoff(&legs, probe);
        if let Some(mp) = s.max_profit { prop_assert!(y <= mp + 1e-9 * scale); }
        if let Some(ml) = s.max_loss { prop_assert!(-y <= ml + 1e-9 * scale); }
    }
}

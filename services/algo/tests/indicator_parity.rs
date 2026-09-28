//! Parity: the Rust indicators must match the terminal's TypeScript indicators on the same bars.
//! Fixture: tests/fixtures/indicators.json, regenerated with `node services/algo/tools/gen-parity.mjs`.

use algo::indicators::{self as ind, Bar};
use serde_json::Value;

fn close_enough(a: f64, b: f64) -> bool {
    (a - b).abs() <= 1e-9 * (1.0 + a.abs().max(b.abs()))
}

#[test]
fn indicators_match_typescript() {
    let fx: Value = serde_json::from_str(include_str!("fixtures/indicators.json")).unwrap();
    let bars: Vec<Bar> = serde_json::from_value(fx["bars"].clone()).unwrap();
    let close = ind::field(&bars, "close");
    let hlc3 = ind::field(&bars, "hlc3");
    let m = ind::macd(&close, 12, 26, 9);
    let bb = ind::bollinger(&close, 20, 2.0);
    let (k, d) = ind::stochastic(&bars, 14, 3);
    let adx = ind::adx(&bars, 14, 14);
    let mut ours: Vec<(String, Vec<f64>)> = vec![
        ("sma_20".into(), ind::sma(&close, 20)),
        ("ema_20".into(), ind::ema(&close, 20)),
        ("ema_50".into(), ind::ema(&close, 50)),
        ("rsi_14".into(), ind::rsi(&close, 14)),
        ("macd_line".into(), m.line),
        ("macd_signal".into(), m.signal),
        ("macd_hist".into(), m.hist),
        ("bb_mid".into(), bb.mid),
        ("bb_up".into(), bb.up),
        ("bb_lo".into(), bb.lo),
        ("atr_14".into(), ind::atr(&bars, 14)),
        ("stoch_k_14_3".into(), k),
        ("stoch_d_14_3".into(), d),
        ("highest_20".into(), ind::rolling(&ind::field(&bars, "high"), 20, true)),
        ("lowest_20".into(), ind::rolling(&ind::field(&bars, "low"), 20, false)),
        ("wma_20".into(), ind::wma(&close, 20)),
        ("cci_20".into(), ind::cci(&hlc3, 20)),
        ("willr_14".into(), ind::willr(&bars, 14)),
        ("momentum_14".into(), ind::momentum(&close, 14)),
        ("roc_14".into(), ind::roc(&close, 14)),
        ("stddev_20".into(), ind::stddev(&close, 20)),
        ("adx_14".into(), adx.adx),
        ("pdi_14".into(), adx.pdi),
        ("mdi_14".into(), adx.mdi),
    ];
    for p in ind::PATTERNS {
        ours.push((format!("pattern_{p}"), ind::pattern(&bars, p)));
    }
    let series = fx["series"].as_object().unwrap();
    assert_eq!(ours.len(), series.len(), "every fixture series is checked");
    for (name, got) in ours {
        let want = series.get(&name).unwrap_or_else(|| panic!("fixture has no {name}")).as_array().unwrap();
        assert_eq!(want.len(), got.len(), "{name} length");
        let mut values = 0;
        for (i, (w, g)) in want.iter().zip(&got).enumerate() {
            match w.as_f64() {
                None => assert!(g.is_nan(), "{name}[{i}]: TS is warming up (NaN) but Rust gave {g}"),
                Some(w) => {
                    values += 1;
                    assert!(close_enough(w, *g), "{name}[{i}]: TS {w} vs Rust {g}");
                }
            }
        }
        assert!(values > 300, "{name}: only {values} values compared");
    }
}

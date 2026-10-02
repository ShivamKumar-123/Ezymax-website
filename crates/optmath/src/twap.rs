//! Time-weighted average price for expiry fixings, with gap accounting.
//!
//! The fixing is the time average over `[start, end)` of the step function "last sample at or before t"
//! (a feed gap holds the previous mid). Before the first sample the `prior` mid (last one before the
//! window) is used, or else the first sample is back-filled (`backfilled_ms` says for how long).
//!
//! Gap accounting: the window is cut into `interval` slots (1 s for Kalks). `coverage` is the share of
//! slots holding at least one sample and `max_gap_ms` the longest stretch without a sample (window edges
//! included). The caller decides when coverage is too low and falls back to bars ([`twap_bars`]).

use crate::realized::Ohlc;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Twap {
    pub value: f64,
    /// Samples (or bars) inside the window.
    pub samples: usize,
    /// Slots (or bars) a complete feed would give.
    pub expected: usize,
    pub covered_slots: usize,
    /// `covered_slots / expected` in [0, 1].
    pub coverage: f64,
    pub max_gap_ms: i64,
    /// Time at the start of the window priced with the first sample (no prior).
    pub backfilled_ms: i64,
}

/// TWAP of `(t_ms, price)` samples over `[start_ms, end_ms)`. `None` without any usable price.
pub fn twap(samples: &[(i64, f64)], start_ms: i64, end_ms: i64, interval_ms: i64, prior: Option<f64>) -> Option<Twap> {
    if end_ms <= start_ms || interval_ms <= 0 {
        return None;
    }
    let mut s: Vec<(i64, f64)> =
        samples.iter().copied().filter(|(t, p)| *t >= start_ms && *t < end_ms && p.is_finite() && *p > 0.0).collect();
    s.sort_by_key(|x| x.0);
    let prior = prior.filter(|p| p.is_finite() && *p > 0.0);
    let span = (end_ms - start_ms) as f64;
    let expected = ((end_ms - start_ms + interval_ms - 1) / interval_ms) as usize;
    if s.is_empty() {
        let p = prior?;
        return Some(Twap { value: p, samples: 0, expected, covered_slots: 0, coverage: 0.0, max_gap_ms: end_ms - start_ms, backfilled_ms: 0 });
    }
    let mut acc = 0.0;
    let (first_t, first_p) = s[0];
    let (head_price, backfilled_ms) = match prior {
        Some(p) => (p, 0),
        None => (first_p, first_t - start_ms),
    };
    acc += head_price * (first_t - start_ms) as f64;
    let mut max_gap = first_t - start_ms;
    for w in s.windows(2) {
        acc += w[0].1 * (w[1].0 - w[0].0) as f64;
        max_gap = max_gap.max(w[1].0 - w[0].0);
    }
    let (last_t, last_p) = *s.last().unwrap();
    acc += last_p * (end_ms - last_t) as f64;
    max_gap = max_gap.max(end_ms - last_t);
    let mut slots: Vec<i64> = s.iter().map(|(t, _)| (t - start_ms) / interval_ms).collect();
    slots.dedup();
    let covered = slots.len();
    Some(Twap {
        value: acc / span,
        samples: s.len(),
        expected,
        covered_slots: covered,
        coverage: covered as f64 / expected as f64,
        max_gap_ms: max_gap,
        backfilled_ms,
    })
}

/// Fallback TWAP from bars (e.g. M1): each bar's typical price `(O + H + L + C) / 4` weighted by its
/// overlap with `[start_ms, end_ms)`. `bars` are `(open time ms, bar)`, each `bar_ms` long.
pub fn twap_bars(bars: &[(i64, Ohlc)], start_ms: i64, end_ms: i64, bar_ms: i64) -> Option<Twap> {
    if end_ms <= start_ms || bar_ms <= 0 {
        return None;
    }
    let expected = ((end_ms - start_ms + bar_ms - 1) / bar_ms) as usize;
    let mut acc = 0.0;
    let mut weight = 0.0;
    let mut used: Vec<i64> = Vec::new();
    for (t, b) in bars {
        let overlap = ((t + bar_ms).min(end_ms) - (*t).max(start_ms)).max(0);
        if overlap == 0 || !b.is_valid() {
            continue;
        }
        acc += (b.o + b.h + b.l + b.c) / 4.0 * overlap as f64;
        weight += overlap as f64;
        used.push(*t);
    }
    if weight <= 0.0 {
        return None;
    }
    used.sort_unstable();
    used.dedup();
    // Longest stretch of the window not covered by a bar.
    let mut max_gap = 0;
    let mut cursor = start_ms;
    for t in &used {
        max_gap = max_gap.max((*t).max(start_ms) - cursor);
        cursor = cursor.max((t + bar_ms).min(end_ms));
    }
    max_gap = max_gap.max(end_ms - cursor);
    let covered = used.len().min(expected);
    Some(Twap {
        value: acc / weight,
        samples: used.len(),
        expected,
        covered_slots: covered,
        coverage: covered as f64 / expected as f64,
        max_gap_ms: max_gap,
        backfilled_ms: 0,
    })
}

//! Realized volatility estimators over OHLC bars, annualized with `periods_per_year` (260 for FX daily
//! bars, matching the business-time clock; 260 * 24 for hourly bars).
//!
//! | estimator        | uses           | notes |
//! |------------------|----------------|-------|
//! | [`close_to_close`] | closes       | sample stdev of log returns (n - 1) |
//! | [`garman_klass`]   | OHLC per bar | no drift, ignores opening gaps |
//! | [`rogers_satchell`]| OHLC per bar | drift-independent, ignores opening gaps |
//! | [`yang_zhang`]     | OHLC + previous close | gap-aware (weekend / overnight), minimum-variance mix |
//! | [`ewma`]           | closes       | RiskMetrics `sigma^2 = lambda sigma^2 + (1 - lambda) r^2` |
//!
//! Every estimator returns `None` when there are too few bars or a bar is invalid (non-positive or
//! non-finite prices, `high < max(open, close)` or `low > min(open, close)`): clean the data first.

/// One bar.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ohlc {
    pub o: f64,
    pub h: f64,
    pub l: f64,
    pub c: f64,
}

impl Ohlc {
    pub fn new(o: f64, h: f64, l: f64, c: f64) -> Self {
        Ohlc { o, h, l, c }
    }

    /// Positive, finite and internally consistent.
    pub fn is_valid(&self) -> bool {
        [self.o, self.h, self.l, self.c].iter().all(|x| x.is_finite() && *x > 0.0)
            && self.h >= self.o.max(self.c)
            && self.l <= self.o.min(self.c)
    }
}

fn all_valid(bars: &[Ohlc]) -> bool {
    bars.iter().all(Ohlc::is_valid)
}

fn annualize(var_per_period: f64, periods_per_year: f64) -> Option<f64> {
    (var_per_period.is_finite() && var_per_period >= 0.0 && periods_per_year > 0.0).then(|| (var_per_period * periods_per_year).sqrt())
}

fn sample_var(x: &[f64]) -> f64 {
    let n = x.len() as f64;
    let mean = x.iter().sum::<f64>() / n;
    x.iter().map(|v| (v - mean) * (v - mean)).sum::<f64>() / (n - 1.0)
}

/// Close-to-close vol from the closes of `bars` (needs 3 bars).
pub fn close_to_close(bars: &[Ohlc], periods_per_year: f64) -> Option<f64> {
    if bars.len() < 3 || !all_valid(bars) {
        return None;
    }
    let r: Vec<f64> = bars.windows(2).map(|w| (w[1].c / w[0].c).ln()).collect();
    annualize(sample_var(&r), periods_per_year)
}

/// Garman-Klass (1980): `0.5 ln(H/L)^2 - (2 ln 2 - 1) ln(C/O)^2` per bar (needs 1 bar).
pub fn garman_klass(bars: &[Ohlc], periods_per_year: f64) -> Option<f64> {
    if bars.is_empty() || !all_valid(bars) {
        return None;
    }
    let k = 2.0 * std::f64::consts::LN_2 - 1.0;
    let v = bars
        .iter()
        .map(|b| {
            let hl = (b.h / b.l).ln();
            let co = (b.c / b.o).ln();
            0.5 * hl * hl - k * co * co
        })
        .sum::<f64>()
        / bars.len() as f64;
    annualize(v.max(0.0), periods_per_year)
}

fn rs_term(b: &Ohlc) -> f64 {
    (b.h / b.c).ln() * (b.h / b.o).ln() + (b.l / b.c).ln() * (b.l / b.o).ln()
}

/// Rogers-Satchell (1991) per-bar variance mean (needs 1 bar).
pub fn rogers_satchell(bars: &[Ohlc], periods_per_year: f64) -> Option<f64> {
    if bars.is_empty() || !all_valid(bars) {
        return None;
    }
    annualize(bars.iter().map(rs_term).sum::<f64>() / bars.len() as f64, periods_per_year)
}

/// Yang-Zhang (2000): `sigma_o^2 + k sigma_c^2 + (1 - k) sigma_rs^2` over the `n = bars.len() - 1`
/// periods that have a previous close, `k = 0.34 / (1.34 + (n + 1) / (n - 1))`. Needs 3 bars.
pub fn yang_zhang(bars: &[Ohlc], periods_per_year: f64) -> Option<f64> {
    if bars.len() < 3 || !all_valid(bars) {
        return None;
    }
    let n = (bars.len() - 1) as f64;
    let overnight: Vec<f64> = bars.windows(2).map(|w| (w[1].o / w[0].c).ln()).collect();
    let open_close: Vec<f64> = bars[1..].iter().map(|b| (b.c / b.o).ln()).collect();
    let rs = bars[1..].iter().map(rs_term).sum::<f64>() / n;
    let k = 0.34 / (1.34 + (n + 1.0) / (n - 1.0));
    let v = sample_var(&overnight) + k * sample_var(&open_close) + (1.0 - k) * rs;
    annualize(v.max(0.0), periods_per_year)
}

/// EWMA vol of the close-to-close log returns of `closes`, decay `lambda` (0.94 = RiskMetrics daily).
/// Seeded with the mean squared return of the first `min(n, 10)` returns. Needs 3 closes.
pub fn ewma(closes: &[f64], lambda: f64, periods_per_year: f64) -> Option<f64> {
    if closes.len() < 3 || !(0.0..1.0).contains(&lambda) || closes.iter().any(|c| !(c.is_finite() && *c > 0.0)) {
        return None;
    }
    let r: Vec<f64> = closes.windows(2).map(|w| (w[1] / w[0]).ln()).collect();
    let seed_n = r.len().min(10);
    let mut var = r[..seed_n].iter().map(|x| x * x).sum::<f64>() / seed_n as f64;
    for x in &r[seed_n..] {
        var = lambda * var + (1.0 - lambda) * x * x;
    }
    annualize(var, periods_per_year)
}

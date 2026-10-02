//! Volatility term structure: smile quotes (ATM, 25D/10D RR and BF) per tenor, interpolated across
//! tenors, with a calendar-arbitrage check.
//!
//! * ATM is interpolated **linearly in total variance** `w(t) = sigma^2 t` between pillars, with flat vol
//!   before the first and after the last pillar.
//! * RR and BF are interpolated linearly in `t` (flat outside). 10D wings are only produced when both
//!   neighbouring pillars quote them.
//! * Calendar arbitrage: total variance must not decrease with tenor. It is checked for ATM and for each
//!   wing pillar vol at fixed delta (25D/10D call and put: `ATM + BF +- RR/2`), the usual approximation.
//! * Pillar time `t` is in years; the caller decides the time measure (Kalks indexes pillars by calendar
//!   tenor and prices with the business-time [`crate::volclock::VolClock`]).

use crate::smile::SmileQuotes;

/// Quotes of one tenor.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TenorQuotes {
    pub t: f64,
    pub quotes: SmileQuotes,
}

/// One calendar-arbitrage violation: `what`'s total variance falls from pillar `index - 1` to `index`.
#[derive(Clone, Debug, PartialEq)]
pub struct CalendarViolation {
    pub index: usize,
    pub what: &'static str,
    pub w_prev: f64,
    pub w_next: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub enum SurfaceError {
    Empty,
    /// A pillar has a non-finite value, `t <= 0`, or a non-positive pillar vol.
    InvalidPillar(usize),
    /// Pillar times are not strictly increasing.
    NotIncreasing(usize),
    CalendarArbitrage(Vec<CalendarViolation>),
}

impl std::fmt::Display for SurfaceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SurfaceError::Empty => write!(f, "the surface has no pillars"),
            SurfaceError::InvalidPillar(i) => write!(f, "pillar {i} is invalid (t <= 0, non-finite, or a wing vol <= 0)"),
            SurfaceError::NotIncreasing(i) => write!(f, "pillar {i} is not after the previous one"),
            SurfaceError::CalendarArbitrage(v) => {
                write!(f, "calendar arbitrage: ")?;
                for (n, x) in v.iter().enumerate() {
                    if n > 0 {
                        write!(f, "; ")?;
                    }
                    write!(f, "{} total variance falls at pillar {} ({:.6} -> {:.6})", x.what, x.index, x.w_prev, x.w_next)?;
                }
                Ok(())
            }
        }
    }
}

impl std::error::Error for SurfaceError {}

/// Pillar vols at fixed delta: (label, vol) for ATM and each quoted wing.
fn wing_vols(q: &SmileQuotes) -> Vec<(&'static str, f64)> {
    let mut v = vec![
        ("ATM", q.atm),
        ("25D call", q.atm + q.bf25 + 0.5 * q.rr25),
        ("25D put", q.atm + q.bf25 - 0.5 * q.rr25),
    ];
    if let (Some(rr), Some(bf)) = (q.rr10, q.bf10) {
        v.push(("10D call", q.atm + bf + 0.5 * rr));
        v.push(("10D put", q.atm + bf - 0.5 * rr));
    }
    v
}

/// All calendar-arbitrage violations of time-sorted pillars (empty = clean).
pub fn calendar_violations(pillars: &[TenorQuotes]) -> Vec<CalendarViolation> {
    let mut out = Vec::new();
    for i in 1..pillars.len() {
        let (a, b) = (&pillars[i - 1], &pillars[i]);
        let wa = wing_vols(&a.quotes);
        let wb = wing_vols(&b.quotes);
        for (what, va) in &wa {
            if let Some((_, vb)) = wb.iter().find(|(w, _)| w == what) {
                let (w0, w1) = (va * va * a.t, vb * vb * b.t);
                // Tolerance for rounding of quoted vols.
                if w1 < w0 - 1e-12 {
                    out.push(CalendarViolation { index: i, what, w_prev: w0, w_next: w1 });
                }
            }
        }
    }
    out
}

/// A term structure of smile quotes.
#[derive(Clone, Debug, PartialEq)]
pub struct VolSurface {
    pillars: Vec<TenorQuotes>,
}

impl VolSurface {
    /// Validates and builds the surface (pillars must be sorted by `t`).
    pub fn new(pillars: Vec<TenorQuotes>) -> Result<VolSurface, SurfaceError> {
        if pillars.is_empty() {
            return Err(SurfaceError::Empty);
        }
        for (i, p) in pillars.iter().enumerate() {
            let q = &p.quotes;
            let finite = [p.t, q.atm, q.rr25, q.bf25].iter().all(|x| x.is_finite())
                && q.rr10.is_none_or(f64::is_finite)
                && q.bf10.is_none_or(f64::is_finite);
            if !finite || p.t <= 0.0 || wing_vols(q).iter().any(|(_, v)| *v <= 0.0) {
                return Err(SurfaceError::InvalidPillar(i));
            }
            if i > 0 && p.t <= pillars[i - 1].t {
                return Err(SurfaceError::NotIncreasing(i));
            }
        }
        let v = calendar_violations(&pillars);
        if !v.is_empty() {
            return Err(SurfaceError::CalendarArbitrage(v));
        }
        Ok(VolSurface { pillars })
    }

    pub fn pillars(&self) -> &[TenorQuotes] {
        &self.pillars
    }

    /// Bracketing pillars and the linear weight of the upper one; `None` weight = flat extrapolation.
    fn bracket(&self, t: f64) -> (usize, usize, f64) {
        let p = &self.pillars;
        let n = p.len();
        if t <= p[0].t {
            return (0, 0, 0.0);
        }
        if t >= p[n - 1].t {
            return (n - 1, n - 1, 0.0);
        }
        let i = p.windows(2).position(|w| t <= w[1].t).unwrap_or(n - 2);
        (i, i + 1, (t - p[i].t) / (p[i + 1].t - p[i].t))
    }

    /// ATM total variance at `t`.
    pub fn total_variance(&self, t: f64) -> f64 {
        if t <= 0.0 {
            return 0.0;
        }
        let (i, j, x) = self.bracket(t);
        if i == j {
            let s = self.pillars[i].quotes.atm;
            return s * s * t;
        }
        let (a, b) = (&self.pillars[i], &self.pillars[j]);
        let wa = a.quotes.atm * a.quotes.atm * a.t;
        let wb = b.quotes.atm * b.quotes.atm * b.t;
        wa + (wb - wa) * x
    }

    /// ATM vol at `t` (from total variance).
    pub fn atm_vol(&self, t: f64) -> f64 {
        if t <= 0.0 {
            return self.pillars[0].quotes.atm;
        }
        (self.total_variance(t) / t).sqrt()
    }

    /// Interpolated smile quotes at `t`.
    pub fn quotes_at(&self, t: f64) -> SmileQuotes {
        let (i, j, x) = self.bracket(t);
        let (a, b) = (&self.pillars[i].quotes, &self.pillars[j].quotes);
        let lin = |u: f64, v: f64| u + (v - u) * x;
        let wing = |u: Option<f64>, v: Option<f64>| match (u, v) {
            (Some(u), Some(v)) => Some(lin(u, v)),
            _ => None,
        };
        let (rr10, bf10) = match (wing(a.rr10, b.rr10), wing(a.bf10, b.bf10)) {
            (Some(r), Some(f)) => (Some(r), Some(f)),
            _ => (None, None),
        };
        SmileQuotes { atm: self.atm_vol(t), rr25: lin(a.rr25, b.rr25), bf25: lin(a.bf25, b.bf25), rr10, bf10 }
    }
}

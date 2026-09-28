//! Indicator maths, ported from the terminal (`apps/terminal/lib/indicators.ts` and
//! `apps/terminal/lib/ai-trader/series.ts`) so a strategy evaluates the same numbers in the browser, the
//! backtester and the 24/7 runtime. Every output is aligned with its input and holds NaN while warming up.
//! `tests/indicator_parity.rs` checks each function against values produced by the TypeScript code.

/// OHLCV bar; `t` = bar open time (unix seconds, UTC).
#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Bar {
    pub t: i64,
    pub o: f64,
    pub h: f64,
    pub l: f64,
    pub c: f64,
    #[serde(default)]
    pub v: f64,
}

pub type Series = Vec<f64>;

fn nan(n: usize) -> Series {
    vec![f64::NAN; n]
}

/// Window SMA at `i` (NaN inside the window propagates), `smaAt` in indicators.ts.
pub fn sma_at(x: &[f64], i: usize, n: usize) -> f64 {
    if n == 0 || i + 1 < n {
        return f64::NAN;
    }
    let mut s = 0.0;
    for v in &x[i + 1 - n..=i] {
        s += v;
    }
    s / n as f64
}

/// Recursive average seeded with the SMA of the first full window (`emaAt`): EMA alpha 2/(n+1), Wilder 1/n.
fn ema_at(x: &[f64], out: &[f64], i: usize, n: usize, alpha: f64) -> f64 {
    let prev = if i > 0 { out[i - 1] } else { f64::NAN };
    if prev.is_nan() {
        return sma_at(x, i, n);
    }
    prev + alpha * (x[i] - prev)
}

pub fn sma(x: &[f64], n: usize) -> Series {
    (0..x.len()).map(|i| sma_at(x, i, n)).collect()
}

pub fn ema(x: &[f64], n: usize) -> Series {
    let mut out = nan(x.len());
    let a = 2.0 / (n as f64 + 1.0);
    for i in 0..x.len() {
        out[i] = ema_at(x, &out, i, n, a);
    }
    out
}

/// Wilder / SMMA (RMA).
pub fn rma(x: &[f64], n: usize) -> Series {
    let mut out = nan(x.len());
    let a = 1.0 / n as f64;
    for i in 0..x.len() {
        out[i] = ema_at(x, &out, i, n, a);
    }
    out
}

pub fn wma(x: &[f64], n: usize) -> Series {
    (0..x.len())
        .map(|i| {
            if n == 0 || i + 1 < n {
                return f64::NAN;
            }
            let (mut s, mut w) = (0.0, 0.0);
            for k in 0..n {
                let wt = (n - k) as f64;
                s += x[i - k] * wt;
                w += wt;
            }
            s / w
        })
        .collect()
}

/// Population standard deviation around the SMA (`stdevAt`).
pub fn stddev(x: &[f64], n: usize) -> Series {
    (0..x.len())
        .map(|i| {
            let m = sma_at(x, i, n);
            if m.is_nan() {
                return f64::NAN;
            }
            let s: f64 = x[i + 1 - n..=i].iter().map(|v| (v - m).powi(2)).sum();
            (s / n as f64).sqrt()
        })
        .collect()
}

/// Runs `f` on the tail that starts at the first finite value (the legacy helpers assume no leading NaN).
fn on_tail(x: &[f64], f: impl Fn(&[f64]) -> Series) -> Series {
    match x.iter().position(|v| v.is_finite()) {
        None => nan(x.len()),
        Some(0) => f(x),
        Some(s) => {
            let mut out = nan(s);
            out.extend(f(&x[s..]));
            out
        }
    }
}

/// Wilder RSI (legacy `rsi` in indicators.ts).
pub fn rsi(x: &[f64], n: usize) -> Series {
    on_tail(x, |v| {
        let mut out = nan(v.len());
        if n == 0 {
            return out;
        }
        let (mut g, mut l) = (0.0f64, 0.0f64);
        let nf = n as f64;
        for i in 1..v.len() {
            let d = v[i] - v[i - 1];
            let up = d.max(0.0);
            let dn = (-d).max(0.0);
            if i <= n {
                g += up;
                l += dn;
                if i == n {
                    g /= nf;
                    l /= nf;
                    out[i] = if l == 0.0 { 100.0 } else { 100.0 - 100.0 / (1.0 + g / l) };
                }
            } else {
                g = (g * (nf - 1.0) + up) / nf;
                l = (l * (nf - 1.0) + dn) / nf;
                out[i] = if l == 0.0 { 100.0 } else { 100.0 - 100.0 / (1.0 + g / l) };
            }
        }
        out
    })
}

pub struct Macd {
    pub line: Series,
    pub signal: Series,
    pub hist: Series,
}

/// MACD (legacy `macd`): EMA(fast) − EMA(slow), signal = EMA of the line from its first value.
pub fn macd(x: &[f64], fast: usize, slow: usize, signal: usize) -> Macd {
    let f = ema(x, fast);
    let s = ema(x, slow);
    let line: Series = f.iter().zip(&s).map(|(a, b)| a - b).collect();
    let sig = on_tail(&line, |v| ema(v, signal));
    let hist = line.iter().zip(&sig).map(|(a, b)| a - b).collect();
    Macd { line, signal: sig, hist }
}

pub struct Bands {
    pub mid: Series,
    pub up: Series,
    pub lo: Series,
}

pub fn bollinger(x: &[f64], n: usize, mult: f64) -> Bands {
    let mid = sma(x, n);
    let sd = stddev(x, n);
    let up = mid.iter().zip(&sd).map(|(m, s)| m + mult * s).collect();
    let lo = mid.iter().zip(&sd).map(|(m, s)| m - mult * s).collect();
    Bands { mid, up, lo }
}

fn true_range(b: &[Bar], i: usize) -> f64 {
    let x = b[i];
    if i == 0 {
        return x.h - x.l;
    }
    let pc = b[i - 1].c;
    (x.h - x.l).max((x.h - pc).abs()).max((x.l - pc).abs())
}

/// Wilder ATR (`atr` in series.ts).
pub fn atr(b: &[Bar], n: usize) -> Series {
    let mut out = nan(b.len());
    if n == 0 {
        return out;
    }
    let (mut prev, mut sum) = (f64::NAN, 0.0);
    for i in 0..b.len() {
        let tr = true_range(b, i);
        if i < n {
            sum += tr;
            if i == n - 1 {
                prev = sum / n as f64;
                out[i] = prev;
            }
        } else {
            prev = (prev * (n as f64 - 1.0) + tr) / n as f64;
            out[i] = prev;
        }
    }
    out
}

/// Stochastic %K / %D (`stochastic` in series.ts).
pub fn stochastic(b: &[Bar], n: usize, d: usize) -> (Series, Series) {
    let mut k = nan(b.len());
    if n == 0 {
        return (k.clone(), k);
    }
    for i in n.saturating_sub(1)..b.len() {
        let (mut hi, mut lo) = (f64::NEG_INFINITY, f64::INFINITY);
        for x in &b[i + 1 - n..=i] {
            hi = hi.max(x.h);
            lo = lo.min(x.l);
        }
        k[i] = if hi == lo { 50.0 } else { (b[i].c - lo) / (hi - lo) * 100.0 };
    }
    let dd = on_tail(&k, |v| sma(v, d.max(1)));
    (k, dd)
}

/// Highest high / lowest low of the N bars BEFORE the current one (`rolling` in series.ts), or of any
/// series when `src` is given.
pub fn rolling(src: &[f64], n: usize, hi: bool) -> Series {
    let mut out = nan(src.len());
    if n == 0 {
        return out;
    }
    for i in n..src.len() {
        let mut v = if hi { f64::NEG_INFINITY } else { f64::INFINITY };
        for x in &src[i - n..i] {
            v = if hi { v.max(*x) } else { v.min(*x) };
        }
        out[i] = v;
    }
    out
}

fn hh(b: &[Bar], i: usize, n: usize) -> f64 {
    if i + 1 < n {
        return f64::NAN;
    }
    b[i + 1 - n..=i].iter().fold(f64::NEG_INFINITY, |m, x| m.max(x.h))
}
fn ll(b: &[Bar], i: usize, n: usize) -> f64 {
    if i + 1 < n {
        return f64::NAN;
    }
    b[i + 1 - n..=i].iter().fold(f64::INFINITY, |m, x| m.min(x.l))
}

/// Commodity Channel Index over a source series (default typical price).
pub fn cci(x: &[f64], n: usize) -> Series {
    (0..x.len())
        .map(|i| {
            let ma = sma_at(x, i, n);
            if ma.is_nan() {
                return f64::NAN;
            }
            let md: f64 = x[i + 1 - n..=i].iter().map(|v| (v - ma).abs()).sum::<f64>() / n as f64;
            if md == 0.0 { 0.0 } else { (x[i] - ma) / (0.015 * md) }
        })
        .collect()
}

/// Williams' %R.
pub fn willr(b: &[Bar], n: usize) -> Series {
    (0..b.len())
        .map(|i| {
            let (h, l) = (hh(b, i, n), ll(b, i, n));
            if h.is_nan() {
                f64::NAN
            } else if h == l {
                -50.0
            } else {
                -100.0 * (h - b[i].c) / (h - l)
            }
        })
        .collect()
}

/// MT5 momentum (price / price N bars ago × 100).
pub fn momentum(x: &[f64], n: usize) -> Series {
    (0..x.len()).map(|i| if i < n { f64::NAN } else { x[i] / x[i - n] * 100.0 }).collect()
}

/// Rate of change in percent.
pub fn roc(x: &[f64], n: usize) -> Series {
    (0..x.len()).map(|i| if i < n { f64::NAN } else { (x[i] - x[i - n]) / x[i - n] * 100.0 }).collect()
}

pub struct Adx {
    pub adx: Series,
    pub pdi: Series,
    pub mdi: Series,
}

/// Wilder ADX with +DI / −DI (the `adx` kernel in indicators.ts).
pub fn adx(b: &[Bar], n: usize, smooth: usize) -> Adx {
    let len = b.len();
    let (mut tr, mut pdm, mut mdm) = (nan(len), nan(len), nan(len));
    let (mut str_, mut sp, mut sm) = (nan(len), nan(len), nan(len));
    let (mut dx, mut pdi, mut mdi, mut adx) = (nan(len), nan(len), nan(len), nan(len));
    let (a, a2) = (1.0 / n as f64, 1.0 / smooth as f64);
    for i in 1..len {
        let up = b[i].h - b[i - 1].h;
        let dn = b[i - 1].l - b[i].l;
        pdm[i] = if up > dn && up > 0.0 { up } else { 0.0 };
        mdm[i] = if dn > up && dn > 0.0 { dn } else { 0.0 };
        tr[i] = true_range(b, i);
        str_[i] = ema_at(&tr, &str_, i, n, a);
        sp[i] = ema_at(&pdm, &sp, i, n, a);
        sm[i] = ema_at(&mdm, &sm, i, n, a);
        // JS truthiness: 0 and NaN are both falsy
        let ok = str_[i] != 0.0 && !str_[i].is_nan();
        pdi[i] = if ok { 100.0 * sp[i] / str_[i] } else { f64::NAN };
        mdi[i] = if ok { 100.0 * sm[i] / str_[i] } else { f64::NAN };
        let sum = pdi[i] + mdi[i];
        dx[i] = if sum.is_nan() { f64::NAN } else if sum == 0.0 { 0.0 } else { 100.0 * (pdi[i] - mdi[i]).abs() / sum };
        adx[i] = ema_at(&dx, &adx, i, smooth, a2);
    }
    Adx { adx, pdi, mdi }
}

/// Candle patterns (`pattern` in series.ts): 1 when present, 0 otherwise.
pub fn pattern(b: &[Bar], p: &str) -> Series {
    (0..b.len())
        .map(|i| {
            let x = b[i];
            let prev = if i > 0 { Some(b[i - 1]) } else { None };
            let body = (x.c - x.o).abs();
            let range = if x.h - x.l == 0.0 { 1e-12 } else { x.h - x.l };
            let upper = x.h - x.o.max(x.c);
            let lower = x.o.min(x.c) - x.l;
            let yes = match p {
                "bullish" => x.c > x.o,
                "bearish" => x.c < x.o,
                "bullish_engulfing" => prev.is_some_and(|q| q.c < q.o && x.c > x.o && x.c >= q.o && x.o <= q.c),
                "bearish_engulfing" => prev.is_some_and(|q| q.c > q.o && x.c < x.o && x.c <= q.o && x.o >= q.c),
                "hammer" => lower >= body * 2.0 && upper <= body * 0.6 && body / range < 0.4,
                "shooting_star" => upper >= body * 2.0 && lower <= body * 0.6 && body / range < 0.4,
                "doji" => body / range <= 0.1,
                "inside_bar" => prev.is_some_and(|q| x.h <= q.h && x.l >= q.l),
                _ => false,
            };
            if yes { 1.0 } else { 0.0 }
        })
        .collect()
}

pub const PATTERNS: [&str; 8] = ["bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar"];

/// Price field series.
pub fn field(b: &[Bar], f: &str) -> Series {
    b.iter()
        .map(|x| match f {
            "open" => x.o,
            "high" => x.h,
            "low" => x.l,
            "hl2" => (x.h + x.l) / 2.0,
            "hlc3" => (x.h + x.l + x.c) / 3.0,
            "ohlc4" => (x.o + x.h + x.l + x.c) / 4.0,
            "volume" => x.v,
            _ => x.c,
        })
        .collect()
}

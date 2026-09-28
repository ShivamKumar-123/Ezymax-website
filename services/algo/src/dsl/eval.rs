//! Vectorised evaluator: every node becomes a series aligned with a timeframe's bars (or a constant).
//! The same code serves the backtester (one pass over the whole history) and the runtime (a pass over
//! the latest bars, reading the last value), so a live strategy fires exactly where its backtest did.

use std::collections::HashMap;
use std::rc::Rc;
use std::time::Instant;

use super::{Field, Node, Program};
use crate::indicators as ind;
use crate::indicators::Bar;
use crate::specs::{server_time, ts};
use chrono::{Datelike, Timelike};

/// Closed bars of one timeframe.
#[derive(Clone, Debug)]
pub struct Frame {
    pub tf: String,
    pub secs: i64,
    pub bars: Vec<Bar>,
}

impl Frame {
    pub fn new(tf: &str, bars: Vec<Bar>) -> Self {
        Frame { tf: tf.to_string(), secs: crate::specs::tf_secs(tf).unwrap_or(60), bars }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum EvalError {
    Timeout,
    Missing(String),
}

impl std::fmt::Display for EvalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EvalError::Timeout => write!(f, "evaluation exceeded its time budget"),
            EvalError::Missing(tf) => write!(f, "no {tf} history available for htf()"),
        }
    }
}

#[derive(Clone)]
enum V {
    C(f64),
    S(Rc<Vec<f64>>),
}

impl V {
    fn at(&self, i: usize) -> f64 {
        match self {
            V::C(v) => *v,
            V::S(s) => s[i],
        }
    }
    fn series(&self, n: usize) -> Rc<Vec<f64>> {
        match self {
            V::C(v) => Rc::new(vec![*v; n]),
            V::S(s) => s.clone(),
        }
    }
}

pub fn bin_scalar(op: &str, a: f64, b: f64) -> Option<f64> {
    if a.is_nan() || b.is_nan() {
        return Some(f64::NAN);
    }
    let t = |x: bool| if x { 1.0 } else { 0.0 };
    Some(match op {
        "+" => a + b,
        "-" => a - b,
        "*" => a * b,
        "/" => {
            if b == 0.0 {
                f64::NAN
            } else {
                a / b
            }
        }
        "%" => {
            if b == 0.0 {
                f64::NAN
            } else {
                a.rem_euclid(b)
            }
        }
        "<" => t(a < b),
        ">" => t(a > b),
        "<=" => t(a <= b),
        ">=" => t(a >= b),
        "==" => t(a == b),
        "!=" => t(a != b),
        "and" => t(a != 0.0 && b != 0.0),
        "or" => t(a != 0.0 || b != 0.0),
        _ => return None,
    })
}

/// Signal values per closed bar of the strategy timeframe (NaN = not ready, 0 = false, otherwise true).
#[derive(Debug, Clone, Default)]
pub struct Signals {
    pub buy: Vec<f64>,
    pub sell: Vec<f64>,
    pub exit_buy: Vec<f64>,
    pub exit_sell: Vec<f64>,
}

pub fn truthy(v: f64) -> bool {
    !v.is_nan() && v != 0.0
}

impl Signals {
    pub fn at(&self, i: usize) -> [bool; 4] {
        let g = |s: &Vec<f64>| s.get(i).copied().is_some_and(truthy);
        [g(&self.buy), g(&self.sell), g(&self.exit_buy), g(&self.exit_sell)]
    }
    /// Whether every defined entry signal had a value on bar i (warm-up finished).
    pub fn ready(&self, i: usize) -> bool {
        [&self.buy, &self.sell].iter().all(|s| s.is_empty() || s.get(i).is_some_and(|v| !v.is_nan()))
    }
}

pub struct Evaluator<'a> {
    base: &'a Frame,
    others: &'a HashMap<String, Frame>,
    deadline: Option<Instant>,
    memo: HashMap<(String, String), Rc<Vec<f64>>>,
    pub nodes_evaluated: usize,
}

impl<'a> Evaluator<'a> {
    pub fn new(base: &'a Frame, others: &'a HashMap<String, Frame>, deadline: Option<Instant>) -> Self {
        Self { base, others, deadline, memo: HashMap::new(), nodes_evaluated: 0 }
    }

    pub fn run(&mut self, p: &Program) -> Result<Signals, EvalError> {
        let n = self.base.bars.len();
        let mut out = Signals::default();
        for (name, node) in p.signals() {
            let Some(node) = node else { continue };
            let base = self.base;
            let s = self.eval(node, base)?.series(n);
            let v = s.as_ref().clone();
            match name {
                "buy" => out.buy = v,
                "sell" => out.sell = v,
                "exit_buy" => out.exit_buy = v,
                _ => out.exit_sell = v,
            }
        }
        Ok(out)
    }

    /// Evaluates one node over the base timeframe (tests, debugging).
    pub fn series(&mut self, node: &Node) -> Result<Vec<f64>, EvalError> {
        let base = self.base;
        Ok(self.eval(node, base)?.series(base.bars.len()).as_ref().clone())
    }

    fn eval(&mut self, node: &Node, fr: &'a Frame) -> Result<V, EvalError> {
        self.nodes_evaluated += 1;
        if let Some(d) = self.deadline
            && self.nodes_evaluated % 16 == 0
            && Instant::now() > d
        {
            return Err(EvalError::Timeout);
        }
        if let Node::Const(v) = node {
            return Ok(V::C(*v));
        }
        let key = (fr.tf.clone(), node.key());
        if let Some(hit) = self.memo.get(&key) {
            return Ok(V::S(hit.clone()));
        }
        let n = fr.bars.len();
        let b = &fr.bars;
        let s: Vec<f64> = match node {
            Node::Const(_) => unreachable!(),
            Node::Field(f) => match f {
                Field::Hour | Field::Minute | Field::Weekday => b
                    .iter()
                    .map(|x| {
                        let t = server_time(ts(x.t));
                        (match f {
                            Field::Hour => t.hour(),
                            Field::Minute => t.minute(),
                            _ => t.weekday().num_days_from_sunday(),
                        }) as f64
                    })
                    .collect(),
                f => ind::field(b, f.name()),
            },
            Node::Neg(a) => {
                let a = self.eval(a, fr)?;
                (0..n).map(|i| -a.at(i)).collect()
            }
            Node::Not(a) => {
                let a = self.eval(a, fr)?;
                (0..n)
                    .map(|i| {
                        let v = a.at(i);
                        if v.is_nan() {
                            f64::NAN
                        } else if v == 0.0 {
                            1.0
                        } else {
                            0.0
                        }
                    })
                    .collect()
            }
            Node::Bin(op, a, c) => {
                let (a, c) = (self.eval(a, fr)?, self.eval(c, fr)?);
                (0..n).map(|i| bin_scalar(op, a.at(i), c.at(i)).unwrap_or(f64::NAN)).collect()
            }
            Node::Cond(a, c, e) => {
                let (a, c, e) = (self.eval(a, fr)?, self.eval(c, fr)?, self.eval(e, fr)?);
                (0..n)
                    .map(|i| {
                        let cv = c.at(i);
                        if cv.is_nan() {
                            f64::NAN
                        } else if cv != 0.0 {
                            a.at(i)
                        } else {
                            e.at(i)
                        }
                    })
                    .collect()
            }
            Node::Shift(a, k) => {
                let a = self.eval(a, fr)?;
                (0..n).map(|i| if i >= *k { a.at(i - k) } else { f64::NAN }).collect()
            }
            Node::Cross(kind, a, c) => {
                let (a, c) = (self.eval(a, fr)?, self.eval(c, fr)?);
                (0..n)
                    .map(|i| {
                        if i == 0 {
                            return f64::NAN;
                        }
                        let (l, r, lp, rp) = (a.at(i), c.at(i), a.at(i - 1), c.at(i - 1));
                        if l.is_nan() || r.is_nan() || lp.is_nan() || rp.is_nan() {
                            return f64::NAN;
                        }
                        let up = lp <= rp && l > r;
                        let dn = lp >= rp && l < r;
                        let hit = match *kind {
                            "crosses_above" => up,
                            "crosses_below" => dn,
                            _ => up || dn,
                        };
                        if hit { 1.0 } else { 0.0 }
                    })
                    .collect()
            }
            Node::Math(f, args) => {
                let vals: Vec<V> = args.iter().map(|a| self.eval(a, fr)).collect::<Result<_, _>>()?;
                (0..n)
                    .map(|i| {
                        let x = vals[0].at(i);
                        match *f {
                            "abs" => x.abs(),
                            "sqrt" => {
                                if x < 0.0 {
                                    f64::NAN
                                } else {
                                    x.sqrt()
                                }
                            }
                            "nz" => {
                                if x.is_nan() {
                                    vals.get(1).map(|d| d.at(i)).unwrap_or(0.0)
                                } else {
                                    x
                                }
                            }
                            "min" => {
                                let y = vals[1].at(i);
                                if x.is_nan() || y.is_nan() { f64::NAN } else { x.min(y) }
                            }
                            "max" => {
                                let y = vals[1].at(i);
                                if x.is_nan() || y.is_nan() { f64::NAN } else { x.max(y) }
                            }
                            _ => {
                                let d = vals.get(1).map(|d| d.at(i)).unwrap_or(0.0).clamp(0.0, 10.0);
                                let m = 10f64.powi(d as i32);
                                (x * m).round() / m
                            }
                        }
                    })
                    .collect()
            }
            Node::Pattern(p) => ind::pattern(b, p),
            Node::Ind(name, src, p, m) => {
                let src = match src {
                    Some(s) => Some(self.eval(s, fr)?.series(n)),
                    None => None,
                };
                let sv = || src.clone().unwrap_or_else(|| Rc::new(ind::field(b, "close")));
                match *name {
                    "sma" => ind::sma(&sv(), p[0]),
                    "ema" => ind::ema(&sv(), p[0]),
                    "wma" => ind::wma(&sv(), p[0]),
                    "rma" => ind::rma(&sv(), p[0]),
                    "rsi" => ind::rsi(&sv(), p[0]),
                    "stddev" => ind::stddev(&sv(), p[0]),
                    "momentum" => ind::momentum(&sv(), p[0]),
                    "roc" => ind::roc(&sv(), p[0]),
                    "change" => {
                        let x = sv();
                        (0..n).map(|i| if i >= p[0] { x[i] - x[i - p[0]] } else { f64::NAN }).collect()
                    }
                    "cci" => ind::cci(&src.clone().unwrap_or_else(|| Rc::new(ind::field(b, "hlc3"))), p[0]),
                    "macd" => ind::macd(&sv(), p[0], p[1], p[2]).line,
                    "macd_signal" => ind::macd(&sv(), p[0], p[1], p[2]).signal,
                    "macd_hist" => ind::macd(&sv(), p[0], p[1], p[2]).hist,
                    "bb_upper" => ind::bollinger(&sv(), p[0], *m).up,
                    "bb_middle" => ind::bollinger(&sv(), p[0], *m).mid,
                    "bb_lower" => ind::bollinger(&sv(), p[0], *m).lo,
                    "atr" => ind::atr(b, p[0]),
                    "willr" => ind::willr(b, p[0]),
                    "adx" => ind::adx(b, p[0], p[1]).adx,
                    "plus_di" => ind::adx(b, p[0], p[1]).pdi,
                    "minus_di" => ind::adx(b, p[0], p[1]).mdi,
                    "stoch_k" => ind::stochastic(b, p[0], p[1]).0,
                    "stoch_d" => ind::stochastic(b, p[0], p[1]).1,
                    "highest" => match &src {
                        Some(s) => ind::rolling(s, p[0], true),
                        None => ind::rolling(&ind::field(b, "high"), p[0], true),
                    },
                    "lowest" => match &src {
                        Some(s) => ind::rolling(s, p[0], false),
                        None => ind::rolling(&ind::field(b, "low"), p[0], false),
                    },
                    _ => vec![f64::NAN; n],
                }
            }
            Node::Htf(tf, e) => {
                let Some(other) = self.others.get(*tf) else { return Err(EvalError::Missing(tf.to_string())) };
                let hs = self.eval(e, other)?.series(other.bars.len());
                align(fr, other, &hs)
            }
        };
        let rc = Rc::new(s);
        self.memo.insert(key, rc.clone());
        Ok(V::S(rc))
    }
}

/// For each bar of `base`, the value of `hs` on the last `other` bar that had closed when the base bar
/// closed (no look-ahead).
pub fn align(base: &Frame, other: &Frame, hs: &[f64]) -> Vec<f64> {
    let mut out = vec![f64::NAN; base.bars.len()];
    let mut j = 0usize;
    let mut last: Option<usize> = None;
    for (i, b) in base.bars.iter().enumerate() {
        let close = b.t + base.secs;
        while j < other.bars.len() && other.bars[j].t + other.secs <= close {
            last = Some(j);
            j += 1;
        }
        if let Some(k) = last {
            out[i] = hs[k];
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dsl::compile;
    use crate::specs::Specs;

    fn bars(closes: &[f64], secs: i64) -> Vec<Bar> {
        closes.iter().enumerate().map(|(i, c)| Bar { t: 1_700_000_000 + i as i64 * secs, o: *c, h: c + 1.0, l: c - 1.0, c: *c, v: 0.0 }).collect()
    }

    #[test]
    fn crosses_and_nan_propagation() {
        let specs = Specs::repo();
        let c = compile("buy = crosses_above(close, 10)\nsell = close[1] > 100\nexit_buy = sma(close, 3) > 0 and close > 11", "EURUSD", "H1", &specs);
        assert!(c.errors.is_empty(), "{:?}", c.errors);
        let base = Frame::new("H1", bars(&[9.0, 9.5, 10.5, 11.0, 9.0, 12.0], 3600));
        let others = HashMap::new();
        let s = Evaluator::new(&base, &others, None).run(&c.program).unwrap();
        let b: Vec<bool> = s.buy.iter().map(|v| truthy(*v)).collect();
        assert_eq!(b, vec![false, false, true, false, false, true]);
        assert!(s.buy[0].is_nan());
        assert!(s.sell[0].is_nan() && s.sell[1] == 0.0);
        assert!(s.exit_buy[1].is_nan() && s.exit_buy[2] == 0.0 && s.exit_buy[5] == 1.0);
    }

    #[test]
    fn htf_uses_only_closed_bars() {
        let specs = Specs::repo();
        let c = compile("buy = htf(\"H4\", close) > 0", "EURUSD", "H1", &specs);
        assert!(c.errors.is_empty(), "{:?}", c.errors);
        let t0 = 1_700_006_400i64; // divisible by 4h
        let base = Frame::new("H1", (0..8).map(|i| Bar { t: t0 + i * 3600, o: 1.0, h: 1.0, l: 1.0, c: 1.0, v: 0.0 }).collect());
        let h4 = Frame::new("H4", vec![Bar { t: t0, o: 5.0, h: 5.0, l: 5.0, c: 5.0, v: 0.0 }, Bar { t: t0 + 14400, o: 7.0, h: 7.0, l: 7.0, c: 7.0, v: 0.0 }]);
        let node = crate::dsl::Node::Htf("H4", Box::new(crate::dsl::Node::Field(Field::Close)));
        let others: HashMap<String, Frame> = [("H4".to_string(), h4)].into();
        let v = Evaluator::new(&base, &others, None).series(&node).unwrap();
        // the first H4 bar closes with the 4th H1 bar; the second with the 8th
        assert!(v[..3].iter().all(|x| x.is_nan()));
        assert_eq!(&v[3..], &[5.0, 5.0, 5.0, 5.0, 7.0]);
        let _ = c;
    }

    #[test]
    fn deadline_aborts() {
        let specs = Specs::repo();
        let mut src = String::new();
        for i in 0..150 {
            src.push_str(&format!("v{i} = ema(close, {})\n", i + 2));
        }
        src.push_str("buy = ");
        src.push_str(&(0..150).map(|i| format!("v{i}")).collect::<Vec<_>>().join(" + "));
        src.push_str(" > 0\n");
        let c = compile(&src, "EURUSD", "H1", &specs);
        assert!(c.errors.is_empty(), "{:?}", c.errors);
        let base = Frame::new("H1", bars(&vec![1.0; 20000], 3600));
        let others = HashMap::new();
        let r = Evaluator::new(&base, &others, Some(Instant::now())).run(&c.program);
        assert_eq!(r.unwrap_err(), EvalError::Timeout);
    }
}

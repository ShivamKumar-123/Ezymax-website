//! Ezymex strategy language (D82): a small, safe, Python-like expression language interpreted in a sandbox.
//!
//! ```text
//! # settings (calls)                       # signals (assignments)
//! name("EMA trend")                        fast = ema(close, 20)
//! symbol("EURUSD")                         slow = ema(close, 50)
//! timeframe("H1")                          buy  = crosses_above(fast, slow) and rsi(close, 14) < 70
//! lots(0.10)            # or risk(1.0)     sell = crosses_below(fast, slow) and htf("H4", close < ema(close, 50))
//! stop_loss(atr=2, period=14)              exit_buy = close < slow
//! take_profit(rr=2)                        exit_sell = close > slow
//! trailing(pips=15); breakeven(trigger=150, offset=10)
//! session("08:00", "17:00"); days(1, 2, 3, 4, 5); max_trades_per_day(3); max_daily_loss(200)
//! ```
//!
//! Semantics: every expression is a series aligned with the strategy timeframe's closed bars. `buy`,
//! `sell`, `exit_buy`, `exit_sell` are evaluated on each closed bar; a signal fires when its value is
//! true (non-zero) on that bar. Comparisons and arithmetic propagate "not ready" (NaN) while indicators
//! warm up, so nothing fires before every input has a value. `x[n]` is the value n bars ago. `htf(tf, e)`
//! evaluates `e` on a higher timeframe and uses the last bar of that timeframe that had closed.
//!
//! Sandbox limits: no loops, function definitions, imports, attribute access or I/O (the grammar has
//! none); names must be defined before use and only once (so no recursion); at most 20 000 characters,
//! 200 statements, nesting depth 48, 4 000 expression nodes after inlining, periods 1–1000, history index
//! 0–1000, 8 `htf` timeframes, and an evaluation deadline enforced by the caller (backtests and the
//! runtime pass a time budget; exceeding it aborts with an error).

pub mod eval;
pub mod parse;

use std::collections::{BTreeSet, HashMap};

use parse::{DslError, Expr, Stmt, err};

use crate::spec::{Condition, Distance, Operand, RuleSet, SessionWindow, StrategySpec, Trailing, default_spec, trim_num};
use crate::specs::{Specs, TIMEFRAMES, tf_secs};

pub const MAX_NODES: usize = 4000;
pub const MAX_PERIOD: usize = 1000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Field {
    Open,
    High,
    Low,
    Close,
    Volume,
    Hl2,
    Hlc3,
    Ohlc4,
    Hour,
    Minute,
    Weekday,
}

impl Field {
    pub fn parse(s: &str) -> Option<Field> {
        Some(match s {
            "open" => Field::Open,
            "high" => Field::High,
            "low" => Field::Low,
            "close" => Field::Close,
            "volume" => Field::Volume,
            "hl2" => Field::Hl2,
            "hlc3" => Field::Hlc3,
            "ohlc4" => Field::Ohlc4,
            "hour" => Field::Hour,
            "minute" => Field::Minute,
            "weekday" => Field::Weekday,
            _ => return None,
        })
    }
    pub fn name(self) -> &'static str {
        match self {
            Field::Open => "open",
            Field::High => "high",
            Field::Low => "low",
            Field::Close => "close",
            Field::Volume => "volume",
            Field::Hl2 => "hl2",
            Field::Hlc3 => "hlc3",
            Field::Ohlc4 => "ohlc4",
            Field::Hour => "hour",
            Field::Minute => "minute",
            Field::Weekday => "weekday",
        }
    }
}

/// Indicators computed from a source series.
pub const SRC_FNS: [&str; 11] = ["sma", "ema", "wma", "rma", "rsi", "stddev", "momentum", "roc", "change", "cci", "highest"];
/// Indicators computed from the bars (OHLC).
pub const BAR_FNS: [&str; 8] = ["atr", "willr", "adx", "plus_di", "minus_di", "stoch_k", "stoch_d", "lowest"];

/// Resolved expression tree.
#[derive(Clone, Debug, PartialEq)]
pub enum Node {
    Const(f64),
    Field(Field),
    Neg(Box<Node>),
    Not(Box<Node>),
    Bin(&'static str, Box<Node>, Box<Node>),
    Cond(Box<Node>, Box<Node>, Box<Node>),
    Shift(Box<Node>, usize),
    /// indicator name, source (for source indicators), integer params, multiplier
    Ind(&'static str, Option<Box<Node>>, [usize; 3], f64),
    Cross(&'static str, Box<Node>, Box<Node>),
    Math(&'static str, Vec<Node>),
    Pattern(&'static str),
    Htf(&'static str, Box<Node>),
}

impl Node {
    /// Canonical text (memoisation key and the code view).
    pub fn key(&self) -> String {
        match self {
            Node::Const(v) => trim_num(*v),
            Node::Field(f) => f.name().into(),
            Node::Neg(a) => format!("-({})", a.key()),
            Node::Not(a) => format!("not ({})", a.key()),
            Node::Bin(op, a, b) => format!("({} {op} {})", a.key(), b.key()),
            Node::Cond(a, c, b) => format!("({} if {} else {})", a.key(), c.key(), b.key()),
            Node::Shift(a, n) => format!("({})[{n}]", a.key()),
            Node::Ind(name, src, p, m) => {
                let mut parts = vec![];
                if let Some(s) = src {
                    parts.push(s.key());
                }
                let np = match *name {
                    "macd" | "macd_signal" | "macd_hist" => 3,
                    "stoch_k" | "stoch_d" | "adx" | "plus_di" | "minus_di" => 2,
                    _ => 1,
                };
                parts.extend(p.iter().take(np).map(|x| x.to_string()));
                if name.starts_with("bb_") {
                    parts.push(trim_num(*m));
                }
                format!("{name}({})", parts.join(", "))
            }
            Node::Cross(k, a, b) => format!("{k}({}, {})", a.key(), b.key()),
            Node::Math(f, a) => format!("{f}({})", a.iter().map(Node::key).collect::<Vec<_>>().join(", ")),
            Node::Pattern(p) => format!("{p}()"),
            Node::Htf(tf, e) => format!("htf(\"{tf}\", {})", e.key()),
        }
    }

    /// Pretty text for the code view (drops redundant outer parentheses).
    pub fn code(&self) -> String {
        let k = self.key();
        if k.starts_with('(') && k.ends_with(')') && balanced_outer(&k) { k[1..k.len() - 1].to_string() } else { k }
    }

    fn walk(&self, f: &mut impl FnMut(&Node)) {
        f(self);
        match self {
            Node::Neg(a) | Node::Not(a) | Node::Shift(a, _) | Node::Htf(_, a) => a.walk(f),
            Node::Bin(_, a, b) | Node::Cross(_, a, b) => {
                a.walk(f);
                b.walk(f);
            }
            Node::Cond(a, b, c) => {
                a.walk(f);
                b.walk(f);
                c.walk(f);
            }
            Node::Ind(_, s, _, _) => {
                if let Some(s) = s {
                    s.walk(f)
                }
            }
            Node::Math(_, a) => a.iter().for_each(|x| x.walk(f)),
            _ => {}
        }
    }
}

fn balanced_outer(s: &str) -> bool {
    let mut d = 0i32;
    for (i, c) in s.char_indices() {
        match c {
            '(' => d += 1,
            ')' => {
                d -= 1;
                if d == 0 && i != s.len() - 1 {
                    return false;
                }
            }
            _ => {}
        }
    }
    true
}

/// A strategy ready to evaluate: settings plus the four signal expressions.
#[derive(Clone, Debug)]
pub struct Program {
    pub spec: StrategySpec,
    pub buy: Option<Node>,
    pub sell: Option<Node>,
    pub exit_buy: Option<Node>,
    pub exit_sell: Option<Node>,
    /// Other timeframes used through `htf` (or a visual condition's timeframe).
    pub timeframes: BTreeSet<String>,
    /// Longest look-back in bars (for history fetches / warm-up).
    pub lookback: usize,
}

impl Program {
    pub fn signals(&self) -> [(&'static str, Option<&Node>); 4] {
        [("buy", self.buy.as_ref()), ("sell", self.sell.as_ref()), ("exit_buy", self.exit_buy.as_ref()), ("exit_sell", self.exit_sell.as_ref())]
    }

    fn finish(mut self) -> Self {
        let mut tfs = BTreeSet::new();
        let mut look = 0usize;
        for n in [&self.buy, &self.sell, &self.exit_buy, &self.exit_sell].into_iter().flatten() {
            n.walk(&mut |x| match x {
                Node::Htf(tf, _) => {
                    tfs.insert(tf.to_string());
                }
                Node::Ind(name, _, p, _) => {
                    let need = match *name {
                        "macd" | "macd_signal" | "macd_hist" => p[1] + p[2],
                        "ema" | "rma" | "rsi" | "atr" => p[0] * 3,
                        "adx" | "plus_di" | "minus_di" => p[0] * 3 + p[1] * 2,
                        "stoch_k" | "stoch_d" => p[0] + p[1],
                        _ => p[0] + 1,
                    };
                    look = look.max(need);
                }
                Node::Shift(_, n) => look = look.max(*n + 1),
                _ => {}
            });
        }
        // ATR-based distances
        for d in [self.spec.sl.atr_period, self.spec.tp.atr_period, self.spec.trailing.atr_period] {
            look = look.max(d as usize * 3);
        }
        tfs.remove(&self.spec.timeframe);
        self.timeframes = tfs;
        self.lookback = look.max(3);
        self
    }

    /// Code view of the program (a visual strategy shown as DSL, or the normalised form of code).
    pub fn to_dsl(&self) -> String {
        let s = &self.spec;
        let mut out = vec![
            format!("# {} ({} {})", s.name, s.symbol, s.timeframe),
            format!("name(\"{}\")", s.name.replace('"', "'")),
            format!("symbol(\"{}\")", s.symbol),
            format!("timeframe(\"{}\")", s.timeframe),
        ];
        if s.sizing.mode == "risk" {
            out.push(format!("risk({})", trim_num(s.sizing.risk_pct)));
        } else {
            out.push(format!("lots({})", trim_num(s.sizing.lots)));
        }
        out.push(format!("max_lots({})", trim_num(s.max_lots)));
        let dist = |d: &Distance| {
            if d.mode == "atr" { format!("atr={}, period={}", trim_num(d.value), d.atr_period) } else { format!("{}={}", d.mode, trim_num(d.value)) }
        };
        if s.sl.mode != "none" {
            out.push(format!("stop_loss({})", dist(&s.sl)));
        }
        if s.tp.mode != "none" {
            out.push(format!("take_profit({})", dist(&s.tp)));
        }
        let t = &s.trailing;
        if t.mode != "none" {
            out.push(if t.mode == "atr" { format!("trailing(atr={}, period={})", trim_num(t.value), t.atr_period) } else { format!("trailing({}={})", t.mode, trim_num(t.value)) });
        }
        if t.breakeven_trigger > 0.0 {
            out.push(format!("breakeven(trigger={}, offset={})", trim_num(t.breakeven_trigger), trim_num(t.breakeven_offset)));
        }
        for w in &s.sessions {
            out.push(format!("session(\"{}\", \"{}\")", w.start, w.end));
        }
        if !s.days.is_empty() {
            out.push(format!("days({})", s.days.iter().map(|d| d.to_string()).collect::<Vec<_>>().join(", ")));
        }
        if s.close_outside_session {
            out.push("close_outside_session(true)".into());
        }
        if s.max_trades_per_day > 0 {
            out.push(format!("max_trades_per_day({})", s.max_trades_per_day));
        }
        if s.max_daily_loss > 0.0 {
            out.push(format!("max_daily_loss({})", trim_num(s.max_daily_loss)));
        }
        if !s.one_at_a_time {
            out.push("one_at_a_time(false)".into());
        }
        out.push(String::new());
        for (name, n) in self.signals() {
            if let Some(n) = n {
                out.push(format!("{name} = {}", n.code()));
            }
        }
        out.join("\n") + "\n"
    }
}

/* ------------------------------------------------------------------ */
/* Visual spec → program                                               */
/* ------------------------------------------------------------------ */

fn operand_node(o: &Operand) -> Node {
    let p = |v: i64| v.max(1) as usize;
    match o.kind.as_str() {
        "value" => Node::Const(o.value),
        "price" => Node::Field(Field::parse(&o.field).unwrap_or(Field::Close)),
        "candle" => Node::Pattern(static_str(&o.pattern, &crate::indicators::PATTERNS).unwrap_or("bullish")),
        _ => {
            let src = || Some(Box::new(Node::Field(Field::parse(&o.field).unwrap_or(Field::Close))));
            let name = static_str(&o.indicator, &ALL_INDICATORS).unwrap_or("sma");
            match name {
                "sma" | "ema" | "wma" | "rsi" | "momentum" | "roc" | "stddev" => Node::Ind(name, src(), [p(o.period), 0, 0], 0.0),
                "cci" => Node::Ind("cci", Some(Box::new(Node::Field(if o.field == "close" { Field::Hlc3 } else { Field::parse(&o.field).unwrap_or(Field::Hlc3) }))), [p(o.period), 0, 0], 0.0),
                "macd" | "macd_signal" | "macd_hist" => Node::Ind(name, src(), [p(o.period), p(o.period2), p(o.period3)], 0.0),
                "bb_upper" | "bb_middle" | "bb_lower" => Node::Ind(name, src(), [p(o.period), 0, 0], if o.mult > 0.0 { o.mult } else { 2.0 }),
                "stoch_k" | "stoch_d" => Node::Ind(name, None, [p(o.period), if o.period2 > 0 { o.period2 as usize } else { 3 }, 0], 0.0),
                "adx" | "plus_di" | "minus_di" => Node::Ind(name, None, [p(o.period), if o.period2 > 0 { o.period2 as usize } else { p(o.period) }, 0], 0.0),
                "highest" | "lowest" => Node::Ind(name, None, [p(o.period), 0, 0], 0.0),
                other => Node::Ind(other, None, [p(o.period), 0, 0], 0.0),
            }
        }
    }
}

pub const ALL_INDICATORS: [&str; 25] = [
    "sma", "ema", "wma", "rma", "rsi", "stddev", "momentum", "roc", "change", "cci", "highest", "lowest", "atr", "willr", "adx", "plus_di", "minus_di",
    "stoch_k", "stoch_d", "macd", "macd_signal", "macd_hist", "bb_upper", "bb_middle", "bb_lower",
];

fn static_str(s: &str, list: &[&'static str]) -> Option<&'static str> {
    list.iter().find(|x| **x == s).copied()
}

fn condition_node(c: &Condition, base_tf: &str) -> Node {
    let (l, r) = (operand_node(&c.left), operand_node(&c.right));
    let n = match c.op.as_str() {
        "crosses_above" => Node::Cross("crosses_above", Box::new(l), Box::new(r)),
        "crosses_below" => Node::Cross("crosses_below", Box::new(l), Box::new(r)),
        op => Node::Bin(
            match op {
                "gt" => ">",
                "lt" => "<",
                "gte" => ">=",
                _ => "<=",
            },
            Box::new(l),
            Box::new(r),
        ),
    };
    if c.timeframe != "same" && c.timeframe != base_tf {
        let tf = TIMEFRAMES.iter().find(|t| **t == c.timeframe).copied().unwrap_or("H1");
        Node::Htf(tf, Box::new(n))
    } else {
        n
    }
}

fn fold(nodes: Vec<Node>, op: &'static str) -> Option<Node> {
    nodes.into_iter().reduce(|a, b| Node::Bin(op, Box::new(a), Box::new(b)))
}

fn ruleset_node(rs: &RuleSet, base_tf: &str) -> Option<Node> {
    if !rs.has_rules() {
        return None;
    }
    let groups: Vec<Node> = rs
        .groups
        .iter()
        .filter_map(|g| fold(g.conditions.iter().map(|c| condition_node(c, base_tf)).collect(), if g.logic == "any" { "or" } else { "and" }))
        .collect();
    fold(groups, if rs.logic == "any" { "or" } else { "and" })
}

/// Compiles a validated visual spec into a program (same evaluator as code strategies).
pub fn from_spec(spec: &StrategySpec) -> Program {
    Program {
        spec: spec.clone(),
        buy: ruleset_node(&spec.long, &spec.timeframe),
        sell: ruleset_node(&spec.short, &spec.timeframe),
        exit_buy: ruleset_node(&spec.exit_long, &spec.timeframe),
        exit_sell: ruleset_node(&spec.exit_short, &spec.timeframe),
        timeframes: BTreeSet::new(),
        lookback: 0,
    }
    .finish()
}

/* ------------------------------------------------------------------ */
/* DSL source → program                                                */
/* ------------------------------------------------------------------ */

pub struct Compiled {
    pub program: Program,
    pub errors: Vec<DslError>,
    pub warnings: Vec<String>,
}

const SIGNALS: [(&str, &str); 8] = [
    ("buy", "buy"),
    ("long", "buy"),
    ("sell", "sell"),
    ("short", "sell"),
    ("exit_buy", "exit_buy"),
    ("exit_long", "exit_buy"),
    ("exit_sell", "exit_sell"),
    ("exit_short", "exit_sell"),
];

struct Cx<'a> {
    vars: HashMap<String, Node>,
    base_tf: String,
    in_htf: bool,
    htfs: &'a mut BTreeSet<String>,
}

fn int_param(e: &Node, what: &str, line: usize, col: usize) -> Result<usize, DslError> {
    match e {
        Node::Const(v) if v.fract() == 0.0 && *v >= 1.0 && *v <= MAX_PERIOD as f64 => Ok(*v as usize),
        Node::Const(v) => err(line, col, format!("{what} must be a whole number from 1 to {MAX_PERIOD} (got {})", trim_num(*v))),
        _ => err(line, col, format!("{what} must be a constant number")),
    }
}

fn num_param(e: &Node, what: &str, line: usize, col: usize) -> Result<f64, DslError> {
    match e {
        Node::Const(v) => Ok(*v),
        _ => err(line, col, format!("{what} must be a constant number")),
    }
}

impl Cx<'_> {
    fn resolve(&mut self, e: &Expr) -> Result<Node, DslError> {
        Ok(match e {
            Expr::Num(v) => Node::Const(*v),
            Expr::Str(s) => return err(0, 0, format!("a string (\"{s}\") can only be used as a setting or an htf timeframe")),
            Expr::Ident(name, line, col) => {
                if let Some(f) = Field::parse(name) {
                    return Ok(Node::Field(f));
                }
                match self.vars.get(name) {
                    Some(n) => n.clone(),
                    None if crate::indicators::PATTERNS.contains(&name.as_str()) || ALL_INDICATORS.contains(&name.as_str()) => {
                        return err(*line, *col, format!("'{name}' is a function: write {name}(…)"));
                    }
                    None => return err(*line, *col, format!("unknown name '{name}' (define it before using it)")),
                }
            }
            Expr::Neg(a) => match self.resolve(a)? {
                Node::Const(v) => Node::Const(-v),
                n => Node::Neg(Box::new(n)),
            },
            Expr::Not(a) => Node::Not(Box::new(self.resolve(a)?)),
            Expr::Bin(op, a, b) => {
                let (a, b) = (self.resolve(a)?, self.resolve(b)?);
                if let (Node::Const(x), Node::Const(y)) = (&a, &b)
                    && let Some(v) = eval::bin_scalar(op, *x, *y)
                {
                    return Ok(Node::Const(v));
                }
                Node::Bin(op, Box::new(a), Box::new(b))
            }
            Expr::Cond(a, c, b) => Node::Cond(Box::new(self.resolve(a)?), Box::new(self.resolve(c)?), Box::new(self.resolve(b)?)),
            Expr::Index(a, n) => {
                let a = self.resolve(a)?;
                if *n == 0 { a } else { Node::Shift(Box::new(a), *n) }
            }
            Expr::Call(name, args, kw, line, col) => self.call(name, args, kw, *line, *col)?,
        })
    }

    fn call(&mut self, name: &str, args: &[Expr], kw: &[(String, Expr)], line: usize, col: usize) -> Result<Node, DslError> {
        if !kw.is_empty() {
            return err(line, col, format!("{name}() takes positional arguments only"));
        }
        let fail = |m: String| err::<Node>(line, col, m);
        let fixed = |n: usize| -> Result<(), DslError> {
            if args.len() != n { err(line, col, format!("{name}() takes {n} argument{}", if n == 1 { "" } else { "s" })) } else { Ok(()) }
        };
        if name == "htf" {
            if self.in_htf {
                return fail("htf() cannot be nested".into());
            }
            fixed(2)?;
            let Expr::Str(tf) = &args[0] else { return fail("htf() needs a timeframe string first, e.g. htf(\"H4\", close > ema(close, 50))".into()) };
            let Some(tf) = TIMEFRAMES.iter().find(|t| **t == tf.as_str()).copied() else { return fail(format!("unknown timeframe \"{tf}\"")) };
            if tf_secs(tf) < tf_secs(&self.base_tf) {
                return fail(format!("htf() needs a timeframe at or above the strategy timeframe {}", self.base_tf));
            }
            self.in_htf = true;
            let inner = self.resolve(&args[1]);
            self.in_htf = false;
            let inner = inner?;
            if tf == self.base_tf {
                return Ok(inner);
            }
            self.htfs.insert(tf.to_string());
            if self.htfs.len() > 8 {
                return fail("at most 8 timeframes can be used with htf()".into());
            }
            return Ok(Node::Htf(tf, Box::new(inner)));
        }
        let r: Vec<Node> = args.iter().map(|a| self.resolve(a)).collect::<Result<_, _>>()?;
        if let Some(p) = crate::indicators::PATTERNS.iter().find(|p| **p == name) {
            fixed(0)?;
            return Ok(Node::Pattern(p));
        }
        let is_series = |n: &Node| !matches!(n, Node::Const(_));
        match name {
            "crosses_above" | "crosses_below" | "crosses" => {
                fixed(2)?;
                let k = match name {
                    "crosses_above" => "crosses_above",
                    "crosses_below" => "crosses_below",
                    _ => "crosses",
                };
                Ok(Node::Cross(k, Box::new(r[0].clone()), Box::new(r[1].clone())))
            }
            "abs" | "sqrt" | "nz" | "min" | "max" | "round" => {
                let (lo, hi) = match name {
                    "abs" | "sqrt" => (1, 1),
                    "nz" | "round" => (1, 2),
                    _ => (2, 2),
                };
                if r.len() < lo || r.len() > hi {
                    return fail(format!("{name}() takes {lo}{} argument(s)", if hi > lo { format!("–{hi}") } else { String::new() }));
                }
                let f = ["abs", "sqrt", "nz", "min", "max", "round"].into_iter().find(|f| *f == name).unwrap();
                Ok(Node::Math(f, r))
            }
            "sma" | "ema" | "wma" | "rma" | "rsi" | "stddev" | "momentum" | "roc" | "change" | "cci" => {
                let f = ["sma", "ema", "wma", "rma", "rsi", "stddev", "momentum", "roc", "change", "cci"].into_iter().find(|f| *f == name).unwrap();
                let default_src = if f == "cci" { Field::Hlc3 } else { Field::Close };
                let default_n = match f {
                    "change" => 1,
                    "rsi" | "momentum" | "roc" => 14,
                    _ => 20,
                };
                let (src, n) = match r.as_slice() {
                    [] => (Node::Field(default_src), default_n),
                    [a] if !is_series(a) => (Node::Field(default_src), int_param(a, "period", line, col)?),
                    [a] => (a.clone(), default_n),
                    [a, b] => (a.clone(), int_param(b, "period", line, col)?),
                    _ => return fail(format!("{name}() takes (source, period)")),
                };
                Ok(Node::Ind(f, Some(Box::new(src)), [n, 0, 0], 0.0))
            }
            "highest" | "lowest" => {
                let f = if name == "highest" { "highest" } else { "lowest" };
                match r.as_slice() {
                    [a] if !is_series(a) => Ok(Node::Ind(f, None, [int_param(a, "period", line, col)?, 0, 0], 0.0)),
                    [a, b] => Ok(Node::Ind(f, Some(Box::new(a.clone())), [int_param(b, "period", line, col)?, 0, 0], 0.0)),
                    [] => Ok(Node::Ind(f, None, [20, 0, 0], 0.0)),
                    _ => fail(format!("{name}() takes (period) or (source, period)")),
                }
            }
            "atr" | "willr" => {
                let f = if name == "atr" { "atr" } else { "willr" };
                let n = match r.as_slice() {
                    [] => 14,
                    [a] => int_param(a, "period", line, col)?,
                    _ => return fail(format!("{name}() takes (period)")),
                };
                Ok(Node::Ind(f, None, [n, 0, 0], 0.0))
            }
            "adx" | "plus_di" | "minus_di" | "stoch_k" | "stoch_d" => {
                let f = ["adx", "plus_di", "minus_di", "stoch_k", "stoch_d"].into_iter().find(|f| *f == name).unwrap();
                let stoch = f.starts_with("stoch");
                let n = match r.first() {
                    Some(a) => int_param(a, "period", line, col)?,
                    None => 14,
                };
                let n2 = match r.get(1) {
                    Some(a) => int_param(a, if stoch { "%D period" } else { "ADX smoothing" }, line, col)?,
                    None if stoch => 3,
                    None => n,
                };
                if r.len() > 2 {
                    return fail(format!("{name}() takes at most 2 arguments"));
                }
                Ok(Node::Ind(f, None, [n, n2, 0], 0.0))
            }
            "macd" | "macd_signal" | "macd_hist" => {
                let f = ["macd", "macd_signal", "macd_hist"].into_iter().find(|f| *f == name).unwrap();
                let (src, rest) = match r.first() {
                    Some(a) if is_series(a) => (a.clone(), &r[1..]),
                    _ => (Node::Field(Field::Close), &r[..]),
                };
                let mut p = [12usize, 26, 9];
                if !rest.is_empty() && rest.len() != 3 {
                    return fail(format!("{name}() takes (source, fast, slow, signal)"));
                }
                for (i, a) in rest.iter().enumerate() {
                    p[i] = int_param(a, "period", line, col)?;
                }
                Ok(Node::Ind(f, Some(Box::new(src)), p, 0.0))
            }
            "bb_upper" | "bb_middle" | "bb_lower" => {
                let f = ["bb_upper", "bb_middle", "bb_lower"].into_iter().find(|f| *f == name).unwrap();
                let (src, rest) = match r.first() {
                    Some(a) if is_series(a) => (a.clone(), &r[1..]),
                    _ => (Node::Field(Field::Close), &r[..]),
                };
                let n = match rest.first() {
                    Some(a) => int_param(a, "period", line, col)?,
                    None => 20,
                };
                let m = match rest.get(1) {
                    Some(a) => num_param(a, "deviation", line, col)?,
                    None => 2.0,
                };
                if rest.len() > 2 || !(m > 0.0 && m <= 10.0) {
                    return fail(format!("{name}() takes (source, period, deviations 0–10)"));
                }
                Ok(Node::Ind(f, Some(Box::new(src)), [n, 0, 0], m))
            }
            _ => fail(format!("unknown function '{name}'")),
        }
    }
}

fn str_arg(args: &[Expr], i: usize) -> Option<&str> {
    match args.get(i) {
        Some(Expr::Str(s)) => Some(s),
        _ => None,
    }
}

fn num_arg(e: &Expr) -> Option<f64> {
    match e {
        Expr::Num(v) => Some(*v),
        Expr::Neg(a) => num_arg(a).map(|v| -v),
        _ => None,
    }
}

/// Compiles DSL source. `symbol` / `timeframe` are defaults a program may override with settings calls.
pub fn compile(src: &str, symbol: &str, timeframe: &str, specs: &Specs) -> Compiled {
    let mut errors = vec![];
    let mut warnings = vec![];
    let mut spec = default_spec(symbol, timeframe);
    spec.name = "Code strategy".into();
    let stmts = match parse::parse(src) {
        Ok(s) => s,
        Err(e) => return Compiled { program: from_spec(&spec), errors: vec![e], warnings },
    };
    // pass 1: settings (symbol / timeframe first, they decide what the expressions mean)
    let mut risk_set = false;
    let mut max_lots_set = false;
    let mut sessions: Vec<SessionWindow> = vec![];
    for st in &stmts {
        let Stmt::Call(name, args, kw, line, col) = st else { continue };
        let (line, col) = (*line, *col);
        let bad = |m: String| DslError { line, col, message: m };
        let one_num = || -> Result<f64, DslError> {
            if args.len() != 1 || !kw.is_empty() {
                return Err(bad(format!("{name}() takes one number")));
            }
            num_arg(&args[0]).ok_or_else(|| bad(format!("{name}() takes one number")))
        };
        let one_bool = || -> Result<bool, DslError> { one_num().map(|v| v != 0.0) };
        let res: Result<(), DslError> = (|| {
            match name.as_str() {
                "name" => spec.name = str_arg(args, 0).ok_or_else(|| bad("name() takes a string".into()))?.chars().take(48).collect(),
                "symbol" => {
                    let s = str_arg(args, 0).ok_or_else(|| bad("symbol() takes a string".into()))?.to_uppercase();
                    if specs.get(&s).is_none() {
                        return Err(bad(format!("unknown symbol \"{s}\"")));
                    }
                    spec.symbol = s;
                }
                "timeframe" => {
                    let t = str_arg(args, 0).ok_or_else(|| bad("timeframe() takes a string".into()))?;
                    if !TIMEFRAMES.contains(&t) {
                        return Err(bad(format!("unknown timeframe \"{t}\" (use M1 M5 M15 M30 H1 H4 D1 W1 MN)")));
                    }
                    spec.timeframe = t.to_string();
                }
                "lots" => {
                    spec.sizing.mode = "lots".into();
                    spec.sizing.lots = one_num()?;
                }
                "risk" => {
                    spec.sizing.mode = "risk".into();
                    spec.sizing.risk_pct = one_num()?;
                    risk_set = true;
                }
                "max_lots" => {
                    spec.max_lots = one_num()?;
                    max_lots_set = true;
                }
                "stop_loss" | "take_profit" => {
                    let is_tp = name == "take_profit";
                    let mut d = Distance { mode: "none".into(), value: 0.0, atr_period: 14 };
                    for (k, v) in kw {
                        let v = num_arg(v).ok_or_else(|| bad(format!("{k} must be a number")))?;
                        match k.as_str() {
                            "points" | "pips" | "price" | "percent" | "atr" | "level" => {
                                if d.mode != "none" {
                                    return Err(bad(format!("{name}() takes one distance (points, pips, price, percent, atr, level{})", if is_tp { " or rr" } else { "" })));
                                }
                                d.mode = k.clone();
                                d.value = v;
                            }
                            "rr" if is_tp => {
                                d.mode = "rr".into();
                                d.value = v;
                            }
                            "period" => d.atr_period = v as i64,
                            _ => return Err(bad(format!("unknown argument '{k}' for {name}()"))),
                        }
                    }
                    if d.mode == "none" || !args.is_empty() {
                        return Err(bad(format!("write {name}(pips=20), {name}(atr=2, period=14){}", if is_tp { " or take_profit(rr=2)" } else { "" })));
                    }
                    if is_tp { spec.tp = d } else { spec.sl = d }
                }
                "trailing" => {
                    let mut t = Trailing { mode: "none".into(), value: 0.0, atr_period: 14, ..spec.trailing.clone() };
                    for (k, v) in kw {
                        let v = num_arg(v).ok_or_else(|| bad(format!("{k} must be a number")))?;
                        match k.as_str() {
                            "points" | "pips" | "atr" => {
                                t.mode = k.clone();
                                t.value = v;
                            }
                            "period" => t.atr_period = v as i64,
                            _ => return Err(bad(format!("unknown argument '{k}' for trailing() (points, pips, atr, period)"))),
                        }
                    }
                    if t.mode == "none" {
                        return Err(bad("write trailing(pips=15) or trailing(atr=1.5, period=14)".into()));
                    }
                    spec.trailing = t;
                }
                "breakeven" => {
                    for (k, v) in kw {
                        let v = num_arg(v).ok_or_else(|| bad(format!("{k} must be a number")))?;
                        match k.as_str() {
                            "trigger" => spec.trailing.breakeven_trigger = v.abs(),
                            "offset" => spec.trailing.breakeven_offset = v,
                            _ => return Err(bad(format!("unknown argument '{k}' for breakeven() (trigger, offset in points)"))),
                        }
                    }
                    if spec.trailing.breakeven_trigger <= 0.0 {
                        return Err(bad("write breakeven(trigger=150, offset=10) (points)".into()));
                    }
                }
                "session" => {
                    let (a, b) = (str_arg(args, 0), str_arg(args, 1));
                    let ok = |t: &str| {
                        let p: Vec<&str> = t.split(':').collect();
                        p.len() == 2 && p[0].parse::<u32>().is_ok_and(|h| h < 24) && p[1].len() == 2 && p[1].parse::<u32>().is_ok_and(|m| m < 60)
                    };
                    match (a, b) {
                        (Some(a), Some(b)) if ok(a) && ok(b) && args.len() == 2 => sessions.push(SessionWindow { start: format!("{:0>5}", a), end: format!("{:0>5}", b) }),
                        _ => return Err(bad("write session(\"08:00\", \"17:00\") in server time".into())),
                    }
                }
                "days" => {
                    let mut d = vec![];
                    for a in args {
                        let v = num_arg(a).filter(|v| v.fract() == 0.0 && (0.0..=6.0).contains(v)).ok_or_else(|| bad("days() takes weekdays 0 (Sunday) to 6 (Saturday)".into()))?;
                        d.push(v as i64);
                    }
                    d.sort();
                    d.dedup();
                    spec.days = d;
                }
                "close_outside_session" => spec.close_outside_session = one_bool()?,
                "one_at_a_time" => spec.one_at_a_time = one_bool()?,
                "max_trades_per_day" => spec.max_trades_per_day = one_num()?.max(0.0) as i64,
                "max_daily_loss" => spec.max_daily_loss = one_num()?.abs(),
                other => {
                    let known = ALL_INDICATORS.contains(&other) || crate::indicators::PATTERNS.contains(&other) || ["crosses_above", "crosses_below", "htf"].contains(&other);
                    return Err(bad(if known { format!("{other}(…) on its own does nothing: assign it, e.g. x = {other}(…)") } else { format!("unknown setting '{other}'") }));
                }
            }
            Ok(())
        })();
        if let Err(e) = res {
            errors.push(e);
        }
    }
    spec.sessions = sessions;
    if !max_lots_set {
        spec.max_lots = 0.0; // = the lot size (or 1 lot for risk sizing), like the visual builder
    }
    if !risk_set && spec.sizing.mode == "risk" {
        spec.sizing.mode = "lots".into();
    }
    // pass 2: expressions, in order (a name must be defined before use, and only once)
    let mut htfs = BTreeSet::new();
    let mut cx = Cx { vars: HashMap::new(), base_tf: spec.timeframe.clone(), in_htf: false, htfs: &mut htfs };
    let mut sig: HashMap<&str, Node> = HashMap::new();
    for st in &stmts {
        let Stmt::Assign(name, e, line, col) = st else { continue };
        if Field::parse(name).is_some() || ALL_INDICATORS.contains(&name.as_str()) || ["htf", "crosses_above", "crosses_below", "abs", "min", "max"].contains(&name.as_str()) {
            errors.push(DslError { line: *line, col: *col, message: format!("'{name}' is a built-in name and cannot be assigned") });
            continue;
        }
        if cx.vars.contains_key(name) {
            errors.push(DslError { line: *line, col: *col, message: format!("'{name}' is already defined") });
            continue;
        }
        match cx.resolve(e) {
            Ok(n) => {
                let size = count(&n);
                if size > MAX_NODES {
                    errors.push(DslError { line: *line, col: *col, message: format!("expression is too large ({size} nodes after expanding names, max {MAX_NODES})") });
                    continue;
                }
                if let Some((_, canon)) = SIGNALS.iter().find(|(k, _)| *k == name) {
                    if sig.contains_key(canon) {
                        errors.push(DslError { line: *line, col: *col, message: format!("signal '{canon}' is defined twice") });
                    }
                    sig.insert(canon, n.clone());
                }
                cx.vars.insert(name.clone(), n);
            }
            Err(mut e) => {
                if e.line == 0 {
                    e.line = *line;
                    e.col = *col;
                }
                errors.push(e);
            }
        }
    }
    let total: usize = sig.values().map(count).sum();
    if total > MAX_NODES {
        errors.push(DslError { line: 1, col: 1, message: format!("program is too large ({total} nodes, max {MAX_NODES})") });
    }
    if !sig.contains_key("buy") && !sig.contains_key("sell") {
        errors.push(DslError { line: 1, col: 1, message: "no entry signal: assign buy = … and/or sell = …".into() });
    }
    let c = specs.get(&spec.symbol).cloned();
    let mut setting_errors = vec![];
    crate::spec::check_settings(&mut spec, c.as_ref(), &mut setting_errors, &mut warnings);
    errors.extend(setting_errors.into_iter().map(|m| DslError { line: 1, col: 1, message: m }));
    let program = Program {
        spec,
        buy: sig.remove("buy"),
        sell: sig.remove("sell"),
        exit_buy: sig.remove("exit_buy"),
        exit_sell: sig.remove("exit_sell"),
        timeframes: BTreeSet::new(),
        lookback: 0,
    }
    .finish();
    Compiled { program, errors, warnings }
}

fn count(n: &Node) -> usize {
    let mut c = 0;
    n.walk(&mut |_| c += 1);
    c
}

#[cfg(test)]
mod tests {
    use super::*;

    const SRC: &str = r#"
name("EMA trend")
symbol("EURUSD")
timeframe("H1")
lots(0.1)
stop_loss(atr=2, period=14)
take_profit(rr=2)
trailing(pips=15)
breakeven(trigger=150, offset=10)
session("08:00", "17:00")
days(1, 2, 3, 4, 5)
max_trades_per_day(3)
fast = ema(close, 20)
slow = ema(close, 50)
buy = crosses_above(fast, slow) and rsi(14) < 70 and htf("H4", close > sma(close, 50))
sell = crosses_below(fast, slow)
exit_buy = close < slow
"#;

    #[test]
    fn compiles_settings_and_signals() {
        let specs = Specs::repo();
        let c = compile(SRC, "XAUUSD", "M5", &specs);
        assert!(c.errors.is_empty(), "{:?}", c.errors);
        let p = c.program;
        assert_eq!((p.spec.symbol.as_str(), p.spec.timeframe.as_str()), ("EURUSD", "H1"));
        assert_eq!(p.spec.sl.mode, "atr");
        assert_eq!(p.spec.tp.mode, "rr");
        assert_eq!(p.spec.sessions.len(), 1);
        assert_eq!(p.timeframes.iter().cloned().collect::<Vec<_>>(), vec!["H4".to_string()]);
        assert!(p.buy.is_some() && p.sell.is_some() && p.exit_buy.is_some() && p.exit_sell.is_none());
        // round trip through the code view
        let again = compile(&p.to_dsl(), "EURUSD", "H1", &specs);
        assert!(again.errors.is_empty(), "{:?}\n{}", again.errors, p.to_dsl());
        assert_eq!(again.program.buy.as_ref().unwrap().key(), p.buy.as_ref().unwrap().key());
    }

    #[test]
    fn reports_semantic_errors_with_lines() {
        let specs = Specs::repo();
        let c = compile("x = foo(1)\nbuy = y > 1\nsell = ema(close, 0) > 1\nbuy2 = close\nhigh = 1\nbuy = htf(\"M1\", close > 1)", "EURUSD", "H1", &specs);
        let msgs: Vec<String> = c.errors.iter().map(|e| format!("{}:{}", e.line, e.message)).collect();
        assert!(msgs.iter().any(|m| m.starts_with("1:unknown function 'foo'")), "{msgs:?}");
        assert!(msgs.iter().any(|m| m.starts_with("2:unknown name 'y'")), "{msgs:?}");
        assert!(msgs.iter().any(|m| m.starts_with("3:period must be a whole number")), "{msgs:?}");
        assert!(msgs.iter().any(|m| m.contains("built-in name")), "{msgs:?}");
        assert!(msgs.iter().any(|m| m.contains("at or above the strategy timeframe")), "{msgs:?}");
    }

    #[test]
    fn exponential_inlining_is_capped() {
        let specs = Specs::repo();
        let mut src = String::from("a0 = close\n");
        for i in 1..20 {
            src.push_str(&format!("a{i} = a{} + a{}\n", i - 1, i - 1));
        }
        src.push_str("buy = a19 > 0\n");
        let c = compile(&src, "EURUSD", "H1", &specs);
        assert!(c.errors.iter().any(|e| e.message.contains("too large")), "{:?}", c.errors);
    }

    #[test]
    fn visual_spec_compiles_to_same_tree() {
        let specs = Specs::repo();
        let v = crate::spec::validate(
            &serde_json::json!({"symbol":"EURUSD","timeframe":"H1","sizing":{"mode":"lots","lots":0.1},
              "long":{"logic":"all","groups":[{"logic":"all","conditions":[
                {"left":{"kind":"indicator","indicator":"ema","period":20},"op":"crosses_above","right":{"kind":"indicator","indicator":"ema","period":50},"timeframe":"same"},
                {"left":{"kind":"indicator","indicator":"rsi","period":14},"op":"lt","right":{"kind":"value","value":70},"timeframe":"H4"}]}]}}),
            &specs,
        );
        assert!(v.errors.is_empty(), "{:?}", v.errors);
        let p = from_spec(&v.spec);
        assert_eq!(p.buy.as_ref().unwrap().code(), "crosses_above(ema(close, 20), ema(close, 50)) and htf(\"H4\", (rsi(close, 14) < 70))");
        assert!(p.timeframes.contains("H4"));
        let code = compile(&p.to_dsl(), "EURUSD", "H1", &specs);
        assert!(code.errors.is_empty(), "{:?}", code.errors);
        assert_eq!(code.program.buy.unwrap().key(), p.buy.unwrap().key());
    }
}

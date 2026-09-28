//! Strategy spec: the visual builder's JSON shape. It is the terminal AI Trader schema
//! (`apps/terminal/lib/ai-trader/schema.ts`) extended with more indicators (wma, cci, willr, adx, +DI/−DI,
//! momentum, roc, stddev) and the ohlc4 price field. `validate` is a port of `validateSpec`: it normalises
//! anything (editor state, model output) into a spec and returns blocking errors and warnings.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::specs::{Specs, TIMEFRAMES};

pub const PRICE_FIELDS: [&str; 7] = ["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"];
pub const INDICATORS: [&str; 23] = [
    "none", "sma", "ema", "wma", "rsi", "macd", "macd_signal", "macd_hist", "bb_upper", "bb_middle", "bb_lower", "atr", "stoch_k", "stoch_d", "highest",
    "lowest", "cci", "willr", "adx", "plus_di", "minus_di", "momentum", "roc",
];
pub const EXTRA_INDICATORS: [&str; 1] = ["stddev"];
pub const PATTERNS: [&str; 9] = ["none", "bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar"];
pub const OPERATORS: [&str; 6] = ["gt", "lt", "gte", "lte", "crosses_above", "crosses_below"];
pub const OPERAND_KINDS: [&str; 4] = ["price", "indicator", "value", "candle"];
pub const DISTANCE_MODES: [&str; 8] = ["none", "points", "pips", "price", "percent", "atr", "level", "rr"];
pub const TRAIL_MODES: [&str; 4] = ["none", "points", "pips", "atr"];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Operand {
    pub kind: String,
    pub field: String,
    pub indicator: String,
    pub period: i64,
    pub period2: i64,
    pub period3: i64,
    pub mult: f64,
    pub value: f64,
    pub pattern: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Condition {
    pub left: Operand,
    pub op: String,
    pub right: Operand,
    pub timeframe: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RuleGroup {
    pub logic: String,
    pub conditions: Vec<Condition>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RuleSet {
    pub logic: String,
    pub groups: Vec<RuleGroup>,
}

impl RuleSet {
    pub fn empty() -> Self {
        RuleSet { logic: "all".into(), groups: vec![] }
    }
    pub fn has_rules(&self) -> bool {
        self.groups.iter().any(|g| !g.conditions.is_empty())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Distance {
    pub mode: String,
    pub value: f64,
    pub atr_period: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Trailing {
    pub mode: String,
    pub value: f64,
    pub atr_period: i64,
    pub breakeven_trigger: f64,
    pub breakeven_offset: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SessionWindow {
    pub start: String,
    pub end: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Sizing {
    pub mode: String,
    pub lots: f64,
    pub risk_pct: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StrategySpec {
    pub name: String,
    pub symbol: String,
    pub timeframe: String,
    pub long: RuleSet,
    pub short: RuleSet,
    pub exit_long: RuleSet,
    pub exit_short: RuleSet,
    pub exit_intrabar: bool,
    pub sizing: Sizing,
    pub max_lots: f64,
    pub sl: Distance,
    pub tp: Distance,
    pub trailing: Trailing,
    pub sessions: Vec<SessionWindow>,
    pub days: Vec<i64>,
    pub close_outside_session: bool,
    pub max_trades_per_day: i64,
    pub max_daily_loss: f64,
    pub one_at_a_time: bool,
}

pub fn default_spec(symbol: &str, timeframe: &str) -> StrategySpec {
    let dist = || Distance { mode: "none".into(), value: 0.0, atr_period: 14 };
    StrategySpec {
        name: format!("{symbol} {timeframe} strategy"),
        symbol: symbol.into(),
        timeframe: timeframe.into(),
        long: RuleSet::empty(),
        short: RuleSet::empty(),
        exit_long: RuleSet::empty(),
        exit_short: RuleSet::empty(),
        exit_intrabar: false,
        sizing: Sizing { mode: "lots".into(), lots: 0.01, risk_pct: 0.0 },
        max_lots: 0.01,
        sl: dist(),
        tp: dist(),
        trailing: Trailing { mode: "none".into(), value: 0.0, atr_period: 14, breakeven_trigger: 0.0, breakeven_offset: 0.0 },
        sessions: vec![],
        days: vec![],
        close_outside_session: false,
        max_trades_per_day: 0,
        max_daily_loss: 0.0,
        one_at_a_time: true,
    }
}

/// Default periods per indicator: (period, period2, period3, mult).
pub fn ind_defaults(ind: &str) -> Option<(i64, i64, i64, f64)> {
    Some(match ind {
        "sma" | "ema" | "wma" | "highest" | "lowest" | "cci" | "stddev" => (20, 0, 0, 0.0),
        "rsi" | "atr" | "willr" | "momentum" | "roc" => (14, 0, 0, 0.0),
        "adx" | "plus_di" | "minus_di" => (14, 14, 0, 0.0),
        "macd" | "macd_signal" | "macd_hist" => (12, 26, 9, 0.0),
        "bb_upper" | "bb_middle" | "bb_lower" => (20, 0, 0, 2.0),
        "stoch_k" | "stoch_d" => (14, 3, 0, 0.0),
        _ => return None,
    })
}

/// Longest period any operand may use (bounds warm-up and evaluation cost).
pub const MAX_PERIOD: i64 = 1000;

/* ------------------------------------------------------------------ */
/* Validation (port of validateSpec)                                   */
/* ------------------------------------------------------------------ */

fn s<'a>(v: &'a Value, k: &str) -> Option<&'a str> {
    v.get(k).and_then(Value::as_str)
}
fn num(v: Option<&Value>, d: f64) -> f64 {
    match v {
        Some(Value::Number(n)) => n.as_f64().filter(|f| f.is_finite()).unwrap_or(d),
        Some(Value::String(t)) if !t.trim().is_empty() => t.trim().parse::<f64>().ok().filter(|f| f.is_finite()).unwrap_or(d),
        _ => d,
    }
}
fn one_of(v: Option<&str>, list: &[&str], d: &str) -> String {
    match v {
        Some(x) if list.contains(&x) => x.to_string(),
        _ => d.to_string(),
    }
}
fn is_hhmm(t: &str) -> bool {
    let p: Vec<&str> = t.split(':').collect();
    p.len() == 2 && p[1].len() == 2 && !p[0].is_empty() && p[0].len() <= 2 && p[0].parse::<u32>().is_ok_and(|h| h < 24) && p[1].parse::<u32>().is_ok_and(|m| m < 60)
}
fn pad(t: &str) -> String {
    let (h, m) = t.split_once(':').unwrap_or(("0", "00"));
    format!("{:0>2}:{}", h, m)
}

fn clean_operand(x: Option<&Value>, path: &str, errors: &mut Vec<String>) -> Operand {
    let empty = Value::Object(Default::default());
    let o = match x {
        Some(v @ Value::Object(_)) => v,
        _ => {
            errors.push(format!("{path}: operand missing"));
            &empty
        }
    };
    let all_ind: Vec<&str> = INDICATORS.iter().chain(EXTRA_INDICATORS.iter()).copied().collect();
    let kind = one_of(s(o, "kind"), &OPERAND_KINDS, "value");
    let mut out = Operand {
        kind: kind.clone(),
        field: one_of(s(o, "field"), &PRICE_FIELDS, "close"),
        indicator: one_of(s(o, "indicator"), &all_ind, "none"),
        period: num(o.get("period"), 0.0).round() as i64,
        period2: num(o.get("period2"), 0.0).round() as i64,
        period3: num(o.get("period3"), 0.0).round() as i64,
        mult: num(o.get("mult"), 0.0),
        value: num(o.get("value"), 0.0),
        pattern: one_of(s(o, "pattern"), &PATTERNS, "none"),
    };
    if kind == "indicator" {
        if out.indicator == "none" {
            errors.push(format!("{path}: indicator not specified"));
        }
        if let Some((p, p2, p3, m)) = ind_defaults(&out.indicator) {
            if out.period <= 0 {
                out.period = p;
            }
            if out.period2 <= 0 && p2 > 0 {
                out.period2 = p2;
            }
            if out.period3 <= 0 && p3 > 0 {
                out.period3 = p3;
            }
            if out.mult <= 0.0 && m > 0.0 {
                out.mult = m;
            }
        }
        if out.period > MAX_PERIOD || out.period2 > MAX_PERIOD || out.period3 > MAX_PERIOD {
            errors.push(format!("{path}: period too long (max {MAX_PERIOD})"));
        }
    }
    if kind == "candle" && out.pattern == "none" {
        errors.push(format!("{path}: candle pattern not specified"));
    }
    out
}

fn clean_ruleset(x: Option<&Value>, path: &str, errors: &mut Vec<String>) -> RuleSet {
    let Some(o @ Value::Object(_)) = x else { return RuleSet::empty() };
    let groups = o.get("groups").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut tfs: Vec<&str> = TIMEFRAMES.to_vec();
    tfs.push("same");
    let mut out = vec![];
    for (gi, g) in groups.iter().enumerate().filter(|(_, g)| g.is_object()) {
        let conds = g.get("conditions").and_then(Value::as_array).cloned().unwrap_or_default();
        let mut cs = vec![];
        for (ci, c) in conds.iter().enumerate().filter(|(_, c)| c.is_object()) {
            let p = format!("{path}.groups[{gi}].conditions[{ci}]");
            let op_raw = s(c, "op");
            if !op_raw.is_some_and(|o| OPERATORS.contains(&o)) {
                errors.push(format!("{p}.op: unknown operator \"{}\"", op_raw.unwrap_or("")));
            }
            cs.push(Condition {
                left: clean_operand(c.get("left"), &format!("{p}.left"), errors),
                op: one_of(op_raw, &OPERATORS, "gt"),
                right: clean_operand(c.get("right"), &format!("{p}.right"), errors),
                timeframe: one_of(s(c, "timeframe"), &tfs, "same"),
            });
        }
        if !cs.is_empty() {
            out.push(RuleGroup { logic: one_of(s(g, "logic"), &["all", "any"], "all"), conditions: cs });
        }
    }
    RuleSet { logic: one_of(s(o, "logic"), &["all", "any"], "all"), groups: out }
}

fn clean_distance(x: Option<&Value>, allow_rr: bool) -> Distance {
    let empty = Value::Null;
    let o = x.unwrap_or(&empty);
    let mode = one_of(s(o, "mode"), &DISTANCE_MODES, "none");
    Distance {
        mode: if !allow_rr && mode == "rr" { "none".into() } else { mode },
        value: num(o.get("value"), 0.0).abs(),
        atr_period: match num(o.get("atrPeriod"), 14.0).round() as i64 {
            0 => 14,
            p => p.clamp(1, MAX_PERIOD),
        },
    }
}

pub struct Validated {
    pub spec: StrategySpec,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Normalise + validate. `errors` block saving a deployable version; `warnings` are informational.
pub fn validate(x: &Value, specs: &Specs) -> Validated {
    let mut errors = vec![];
    let mut warnings = vec![];
    let empty = Value::Object(Default::default());
    let o = if x.is_object() { x } else {
        errors.push("Strategy is not an object".into());
        &empty
    };
    let raw_sym: String = s(o, "symbol").unwrap_or("").to_uppercase().chars().filter(|c| c.is_ascii_alphanumeric() || *c == '.').collect();
    let known = specs.get(&raw_sym).is_some();
    if !known {
        errors.push(if raw_sym.is_empty() { "Symbol is missing".into() } else { format!("Unknown symbol \"{raw_sym}\"") });
    }
    let symbol = if known { raw_sym } else { "EURUSD".to_string() };
    let tf_raw = s(o, "timeframe");
    if !tf_raw.is_some_and(|t| TIMEFRAMES.contains(&t)) {
        errors.push(format!("Unknown timeframe \"{}\"", tf_raw.unwrap_or("")));
    }
    let timeframe = one_of(tf_raw, &TIMEFRAMES, "H1");
    let d = default_spec(&symbol, &timeframe);
    let sz = o.get("sizing").unwrap_or(&empty);
    let tr = o.get("trailing").unwrap_or(&empty);
    let mut sessions = vec![];
    for w in o.get("sessions").and_then(Value::as_array).cloned().unwrap_or_default() {
        let (a, b) = (w.get("start").and_then(Value::as_str).unwrap_or("").to_string(), w.get("end").and_then(Value::as_str).unwrap_or("").to_string());
        if is_hhmm(&a) && is_hhmm(&b) {
            sessions.push(SessionWindow { start: pad(&a), end: pad(&b) });
        } else {
            errors.push(format!("Invalid session window {a}–{b}"));
        }
    }
    let mut days: Vec<i64> = o.get("days").and_then(Value::as_array).cloned().unwrap_or_default().iter().map(|v| num(Some(v), -1.0).round() as i64).filter(|v| (0..=6).contains(v)).collect();
    days.sort();
    days.dedup();
    let name = s(o, "name").map(str::trim).filter(|n| !n.is_empty()).map(|n| n.chars().take(48).collect()).unwrap_or(d.name.clone());
    let mut spec = StrategySpec {
        name,
        symbol: symbol.clone(),
        timeframe,
        long: clean_ruleset(o.get("long"), "long", &mut errors),
        short: clean_ruleset(o.get("short"), "short", &mut errors),
        exit_long: clean_ruleset(o.get("exitLong"), "exitLong", &mut errors),
        exit_short: clean_ruleset(o.get("exitShort"), "exitShort", &mut errors),
        exit_intrabar: o.get("exitIntrabar") == Some(&Value::Bool(true)),
        sizing: Sizing { mode: one_of(s(sz, "mode"), &["lots", "risk"], "lots"), lots: num(sz.get("lots"), 0.0).abs(), risk_pct: num(sz.get("riskPct"), 0.0).abs() },
        max_lots: num(o.get("maxLots"), 0.0).abs(),
        sl: clean_distance(o.get("sl"), false),
        tp: clean_distance(o.get("tp"), true),
        trailing: Trailing {
            mode: one_of(s(tr, "mode"), &TRAIL_MODES, "none"),
            value: num(tr.get("value"), 0.0).abs(),
            atr_period: match num(tr.get("atrPeriod"), 14.0).round() as i64 {
                0 => 14,
                p => p.clamp(1, MAX_PERIOD),
            },
            breakeven_trigger: num(tr.get("breakevenTrigger"), 0.0).abs(),
            breakeven_offset: num(tr.get("breakevenOffset"), 0.0),
        },
        sessions,
        days,
        close_outside_session: o.get("closeOutsideSession") == Some(&Value::Bool(true)),
        max_trades_per_day: num(o.get("maxTradesPerDay"), 0.0).round().max(0.0) as i64,
        max_daily_loss: num(o.get("maxDailyLoss"), 0.0).abs(),
        one_at_a_time: o.get("oneAtATime") != Some(&Value::Bool(false)),
    };
    let c = specs.get(&symbol).cloned();
    check_settings(&mut spec, c.as_ref(), &mut errors, &mut warnings);
    if !spec.long.has_rules() && !spec.short.has_rules() {
        errors.push("No entry rule: add a buy or sell condition".into());
    }
    Validated { spec, errors, warnings }
}

/// Settings checks shared by visual specs and DSL programs.
pub fn check_settings(spec: &mut StrategySpec, c: Option<&crate::specs::Spec>, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    let (min_v, max_v) = c.map(|c| (c.lot_min, c.lot_max)).unwrap_or((0.01, 100.0));
    if spec.sizing.mode == "lots" {
        if !(spec.sizing.lots >= min_v) {
            errors.push(format!("Volume must be at least {min_v} lot"));
        }
        spec.sizing.lots = (spec.sizing.lots * 100.0).round() / 100.0;
    } else {
        if !(spec.sizing.risk_pct > 0.0) {
            errors.push("Risk % must be above 0".into());
        }
        if spec.sizing.risk_pct > 5.0 {
            errors.push("Risk above 5% per trade is not allowed".into());
        }
        if spec.sl.mode == "none" {
            errors.push("Risk-based sizing needs a stop loss".into());
        }
    }
    if !(spec.max_lots > 0.0) {
        spec.max_lots = if spec.sizing.mode == "lots" { spec.sizing.lots } else { 1.0 };
    }
    spec.max_lots = (spec.max_lots.min(max_v) * 100.0).round() / 100.0;
    if spec.sizing.mode == "lots" && spec.sizing.lots > spec.max_lots {
        warnings.push(format!("Volume {} is above the cap; orders are capped at {}", spec.sizing.lots, spec.max_lots));
    }
    if spec.tp.mode == "rr" && spec.sl.mode == "none" {
        errors.push("Take profit as R multiple needs a stop loss".into());
    }
    for (k, dist) in [("Stop loss", &spec.sl), ("Take profit", &spec.tp)] {
        if dist.mode != "none" && !(dist.value > 0.0) {
            errors.push(format!("{k} value must be above 0"));
        }
    }
    if spec.trailing.mode != "none" && !(spec.trailing.value > 0.0) {
        errors.push("Trailing distance must be above 0".into());
    }
    if spec.sl.mode == "none" {
        warnings.push("No stop loss: positions are unprotected".into());
    }
    if spec.max_trades_per_day == 0 {
        warnings.push("No daily trade limit".into());
    }
    if spec.sl.mode == "level" || spec.tp.mode == "level" {
        warnings.push("Absolute SL/TP levels are reused for every trade".into());
    }
}

/* ------------------------------------------------------------------ */
/* Human-readable description (describe.ts, condensed)                 */
/* ------------------------------------------------------------------ */

pub fn describe_operand(o: &Operand) -> String {
    match o.kind.as_str() {
        "value" => trim_num(o.value),
        "price" => o.field.clone(),
        "candle" => o.pattern.replace('_', " "),
        _ => match o.indicator.as_str() {
            "macd" | "macd_signal" | "macd_hist" => format!("{}({},{},{})", o.indicator.to_uppercase(), o.period, o.period2, o.period3),
            "bb_upper" | "bb_middle" | "bb_lower" => format!("{}({},{})", o.indicator.to_uppercase(), o.period, trim_num(o.mult)),
            "stoch_k" | "stoch_d" | "adx" | "plus_di" | "minus_di" => format!("{}({},{})", o.indicator.to_uppercase(), o.period, o.period2),
            i => {
                let src = if o.field != "close" && !["atr", "highest", "lowest", "willr", "adx"].contains(&i) { format!(" of {}", o.field) } else { String::new() };
                format!("{}({}){src}", i.to_uppercase(), o.period)
            }
        },
    }
}

pub fn trim_num(v: f64) -> String {
    let s = format!("{v:.8}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

pub fn describe_condition(c: &Condition) -> String {
    let op = match c.op.as_str() {
        "gt" => ">",
        "lt" => "<",
        "gte" => ">=",
        "lte" => "<=",
        "crosses_above" => "crosses above",
        _ => "crosses below",
    };
    let tf = if c.timeframe != "same" { format!(" [{}]", c.timeframe) } else { String::new() };
    if c.left.kind == "candle" {
        return format!("{} candle{tf}", describe_operand(&c.left));
    }
    format!("{} {op} {}{tf}", describe_operand(&c.left), describe_operand(&c.right))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_and_fills_defaults() {
        let specs = Specs::repo();
        let v = validate(
            &json!({"name":"EMA", "symbol":"eurusd", "timeframe":"H1",
                "long":{"logic":"all","groups":[{"logic":"all","conditions":[{"left":{"kind":"indicator","indicator":"ema","period":0},"op":"crosses_above","right":{"kind":"indicator","indicator":"ema","period":50},"timeframe":"same"}]}]},
                "sizing":{"mode":"lots","lots":0.1}, "sl":{"mode":"pips","value":20}, "tp":{"mode":"rr","value":2}}),
            &specs,
        );
        assert!(v.errors.is_empty(), "{:?}", v.errors);
        assert_eq!(v.spec.symbol, "EURUSD");
        assert_eq!(v.spec.long.groups[0].conditions[0].left.period, 20);
        assert_eq!(v.spec.max_lots, 0.1);
        assert_eq!(describe_condition(&v.spec.long.groups[0].conditions[0]), "EMA(20) crosses above EMA(50)");
    }

    #[test]
    fn rejects_bad_input() {
        let specs = Specs::repo();
        let v = validate(&json!({"symbol":"NOPE","timeframe":"H7","sizing":{"mode":"risk","riskPct":9}}), &specs);
        assert!(v.errors.iter().any(|e| e.contains("Unknown symbol")));
        assert!(v.errors.iter().any(|e| e.contains("Unknown timeframe")));
        assert!(v.errors.iter().any(|e| e.contains("Risk above 5%")));
        assert!(v.errors.iter().any(|e| e.contains("No entry rule")));
    }
}

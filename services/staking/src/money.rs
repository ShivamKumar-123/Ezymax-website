//! Money helpers (as in the growth and IB services). Every amount and rate is a `rust_decimal::Decimal`; floats
//! appear only at the JSON edge and are converted through their shortest decimal text.

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Deserializer};
use std::str::FromStr;

pub type D = Decimal;
pub const ZERO: D = Decimal::ZERO;
pub const HUNDRED: D = Decimal::ONE_HUNDRED;

/// Cents, half away from zero (statement convention).
pub fn r2(d: D) -> D {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn from_f64(f: f64) -> Option<D> {
    if !f.is_finite() {
        return None;
    }
    Decimal::from_str(&format!("{f}")).ok().map(|d| d.normalize())
}

pub fn dec(s: &str) -> D {
    Decimal::from_str(s).expect("decimal literal")
}

/// Decimal → JSON number (API output).
pub fn num(d: D) -> serde_json::Value {
    let d = d.normalize();
    match d.to_f64().and_then(serde_json::Number::from_f64) {
        Some(n) => serde_json::Value::Number(n),
        None => serde_json::Value::String(d.to_string()),
    }
}

pub fn opt_num(d: Option<D>) -> serde_json::Value {
    d.map(num).unwrap_or(serde_json::Value::Null)
}

/// Decimal from a JSON number or numeric string.
pub fn value_dec(v: &serde_json::Value) -> Option<D> {
    match v {
        serde_json::Value::Number(n) => n.as_f64().and_then(from_f64),
        serde_json::Value::String(s) => Decimal::from_str(s.trim()).ok(),
        _ => None,
    }
}

/// Optional decimal: missing or null → None.
pub fn de_opt_dec<'de, De: Deserializer<'de>>(d: De) -> Result<Option<D>, De::Error> {
    let v = Option::<serde_json::Value>::deserialize(d)?;
    match v {
        None | Some(serde_json::Value::Null) => Ok(None),
        Some(x) => value_dec(&x).map(Some).ok_or_else(|| serde::de::Error::custom("invalid number")),
    }
}

/// "1,250.00" style text for notifications.
pub fn text(d: D) -> String {
    let s = format!("{:.2}", r2(d));
    let (int, frac) = s.split_once('.').unwrap_or((&s, "00"));
    let (sign, digits) = int.strip_prefix('-').map(|d| ("-", d)).unwrap_or(("", int));
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    format!("{sign}{out}.{frac}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounding_and_parsing() {
        assert_eq!(r2(dec("1.005")).to_string(), "1.01");
        assert_eq!(r2(dec("-1.005")).to_string(), "-1.01");
        assert_eq!(from_f64(0.1).unwrap().to_string(), "0.1");
        assert_eq!(value_dec(&serde_json::json!("12.5")).unwrap(), dec("12.5"));
        assert_eq!(value_dec(&serde_json::json!(0.07)).unwrap(), dec("0.07"));
        assert_eq!(text(dec("1250")), "1,250.00");
        assert_eq!(text(dec("1234567.891")), "1,234,567.89");
        assert_eq!(text(dec("12.5")), "12.50");
    }
}

//! Money helpers (shared with the IB service). Every amount, rate and volume is a `rust_decimal::Decimal`; floats appear only at the JSON
//! edge and are converted through their shortest decimal text.

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

/// Lots are kept to 4 decimals (cent accounts: 0.01 cent lot × 0.01 = 0.0001 standard lot).
pub fn r4(d: D) -> D {
    d.round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero)
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

/// Decimal from a JSON number or numeric string.
pub fn de_dec<'de, De: Deserializer<'de>>(d: De) -> Result<D, De::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum N {
        F(f64),
        S(String),
    }
    match N::deserialize(d)? {
        N::F(f) => from_f64(f).ok_or_else(|| serde::de::Error::custom("invalid number")),
        N::S(s) => Decimal::from_str(s.trim()).map_err(|_| serde::de::Error::custom("invalid number")),
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

pub fn value_dec(v: &serde_json::Value) -> Option<D> {
    match v {
        serde_json::Value::Number(n) => n.as_f64().and_then(from_f64),
        serde_json::Value::String(s) => Decimal::from_str(s.trim()).ok(),
        _ => None,
    }
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
    }
}

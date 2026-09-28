//! Money and number helpers. Money never touches floats inside the engine: every amount, price and
//! volume is a `rust_decimal::Decimal`. Floats appear only at the JSON edge (market-data quotes in,
//! API numbers out) and are converted through their shortest decimal text, never through binary maths.

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Deserializer};
use std::str::FromStr;

pub type D = Decimal;

pub const ZERO: D = Decimal::ZERO;
pub const ONE: D = Decimal::ONE;
pub const HUNDRED: D = Decimal::ONE_HUNDRED;

/// Rounds money to cents of the account currency (half away from zero, the broker statement convention).
pub fn r2(d: D) -> D {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn rdp(d: D, dp: u32) -> D {
    d.round_dp_with_strategy(dp, RoundingStrategy::MidpointAwayFromZero)
}

/// f64 (from JSON) → Decimal via its shortest round-trip text (`0.1` stays `0.1`).
/// Rust's `Display` for f64 never uses exponent notation, so the text always parses.
pub fn from_f64(f: f64) -> Option<D> {
    if !f.is_finite() {
        return None;
    }
    Decimal::from_str(&format!("{f}")).ok().map(|d| d.normalize())
}

/// Decimal → JSON number (API output). Exact for every value with ≤ 15 significant digits.
pub fn num(d: D) -> serde_json::Value {
    let d = d.normalize();
    match d.to_f64().and_then(serde_json::Number::from_f64) {
        Some(n) => serde_json::Value::Number(n),
        None => serde_json::Value::String(d.to_string()),
    }
}

pub fn num_opt(d: Option<D>) -> serde_json::Value {
    d.map(num).unwrap_or(serde_json::Value::Null)
}

/// Deserializes a decimal from a JSON number or a numeric string.
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

pub fn de_opt_dec<'de, De: Deserializer<'de>>(d: De) -> Result<Option<D>, De::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum N {
        F(f64),
        S(String),
    }
    match Option::<N>::deserialize(d)? {
        None => Ok(None),
        Some(N::F(f)) => from_f64(f).map(Some).ok_or_else(|| serde::de::Error::custom("invalid number")),
        Some(N::S(s)) if s.trim().is_empty() => Ok(None),
        Some(N::S(s)) => Decimal::from_str(s.trim()).map(Some).map_err(|_| serde::de::Error::custom("invalid number")),
    }
}

/// PATCH semantics: field absent → `None` (keep), `null` → `Some(None)` (clear), value → `Some(Some(v))`.
/// Use with `#[serde(default, deserialize_with = "patch_dec")]`.
pub fn patch_dec<'de, De: Deserializer<'de>>(d: De) -> Result<Option<Option<D>>, De::Error> {
    de_opt_dec(d).map(|v| Some(v.filter(|x| !x.is_zero())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn float_text_round_trip() {
        assert_eq!(from_f64(0.1).unwrap().to_string(), "0.1");
        assert_eq!(from_f64(1.13591).unwrap().to_string(), "1.13591");
        assert_eq!(from_f64(83458.06).unwrap().to_string(), "83458.06");
        assert_eq!(from_f64(1e-5).unwrap().to_string(), "0.00001");
        assert!(from_f64(f64::NAN).is_none());
    }

    #[test]
    fn rounding_is_half_away_from_zero() {
        assert_eq!(r2(D::from_str("1.005").unwrap()).to_string(), "1.01");
        assert_eq!(r2(D::from_str("-1.005").unwrap()).to_string(), "-1.01");
        assert_eq!(r2(D::from_str("2.004").unwrap()).to_string(), "2.00");
    }

    #[test]
    fn json_numbers() {
        assert_eq!(num(D::from_str("1.10").unwrap()).to_string(), "1.1");
        assert_eq!(num(D::from_str("-0.07").unwrap()).to_string(), "-0.07");
    }
}

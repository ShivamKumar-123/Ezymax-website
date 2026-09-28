//! Money helpers. Amounts are `rust_decimal::Decimal`, never floats. JSON input accepts a decimal string or a
//! number (converted through its shortest text form); JSON output is always a decimal string.

use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Deserializer};
use std::str::FromStr;

pub type D = Decimal;

/// Max decimals of a wallet amount (USDT on TRON has 6; BEP20's 18 are truncated to 6 when credited).
pub const WALLET_DP: u32 = 6;
/// The trading engine books cents.
pub const ENGINE_DP: u32 = 2;
/// Upper bound for any single amount (sanity limit).
pub fn max_amount() -> D {
    D::from(1_000_000_000_000i64)
}

/// Decimal → canonical string ("125.5", "0").
pub fn s(d: D) -> String {
    let n = d.normalize();
    if n.is_zero() { "0".into() } else { n.to_string() }
}

pub fn s_opt(d: Option<D>) -> serde_json::Value {
    d.map(|v| serde_json::Value::String(s(v))).unwrap_or(serde_json::Value::Null)
}

pub fn parse(text: &str) -> Option<D> {
    let t = text.trim();
    if t.is_empty() || t.len() > 40 || t.starts_with('+') || t.contains(['e', 'E']) {
        return None;
    }
    D::from_str(t).ok()
}

/// A positive amount with at most `dp` decimals and below the sanity limit.
pub fn check_amount(d: D, dp: u32) -> Result<D, String> {
    if d <= D::ZERO {
        return Err("Amount must be above 0".into());
    }
    if d.normalize().scale() > dp {
        return Err(format!("Amount can have at most {dp} decimals"));
    }
    if d > max_amount() {
        return Err("Amount is too large".into());
    }
    Ok(d.normalize())
}

/// Rounds down (toward zero) to `dp` decimals.
pub fn floor_dp(d: D, dp: u32) -> D {
    d.round_dp_with_strategy(dp, RoundingStrategy::ToZero)
}

/// Rounds up (away from zero) to `dp` decimals: fees never round in the client's favour by accident.
pub fn ceil_dp(d: D, dp: u32) -> D {
    d.round_dp_with_strategy(dp, RoundingStrategy::AwayFromZero)
}

/// An integer token amount (`value` in the token's smallest unit) → decimal with `decimals` places.
pub fn from_units(units: u128, decimals: u32) -> Option<D> {
    let i = i128::try_from(units).ok()?;
    D::try_from_i128_with_scale(i, decimals).ok().map(|d| d.normalize())
}

/// Parses a decimal from a JSON string or number.
pub fn de_dec<'de, De: Deserializer<'de>>(d: De) -> Result<D, De::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum N {
        S(String),
        F(serde_json::Number),
    }
    let text = match N::deserialize(d)? {
        N::S(s) => s,
        N::F(n) => n.to_string(),
    };
    parse(&text).ok_or_else(|| serde::de::Error::custom("invalid decimal amount"))
}

pub fn de_opt_dec<'de, De: Deserializer<'de>>(d: De) -> Result<Option<D>, De::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum N {
        S(String),
        F(serde_json::Number),
    }
    match Option::<N>::deserialize(d)? {
        None => Ok(None),
        Some(N::S(s)) if s.trim().is_empty() => Ok(None),
        Some(N::S(s)) => parse(&s).map(Some).ok_or_else(|| serde::de::Error::custom("invalid decimal amount")),
        Some(N::F(n)) => parse(&n.to_string()).map(Some).ok_or_else(|| serde::de::Error::custom("invalid decimal amount")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(x: &str) -> D {
        D::from_str(x).unwrap()
    }

    #[test]
    fn parsing_and_scale() {
        assert_eq!(parse("10.50"), Some(d("10.5")));
        assert_eq!(parse(" 7 "), Some(d("7")));
        assert!(parse("1e3").is_none());
        assert!(parse("+1").is_none());
        assert!(parse("abc").is_none());
        assert!(check_amount(d("0"), 6).is_err());
        assert!(check_amount(d("-1"), 6).is_err());
        assert!(check_amount(d("1.1234567"), 6).is_err());
        assert_eq!(check_amount(d("1.123456"), 6).unwrap(), d("1.123456"));
        assert_eq!(check_amount(d("1.500"), 2).unwrap(), d("1.5"));
        assert!(check_amount(d("1.001"), 2).is_err());
    }

    #[test]
    fn strings_out() {
        assert_eq!(s(d("125.500000")), "125.5");
        assert_eq!(s(d("0.000")), "0");
        assert_eq!(s(d("-3.10")), "-3.1");
    }

    #[test]
    fn token_units() {
        // 12.5 USDT on BEP20 (18 decimals) and TRC20 (6 decimals)
        assert_eq!(from_units(12_500_000_000_000_000_000, 18), Some(d("12.5")));
        assert_eq!(from_units(938_500_000, 6), Some(d("938.5")));
        assert_eq!(from_units(1, 18), Some(d("0.000000000000000001")));
        assert_eq!(floor_dp(d("1.2345678"), 6), d("1.234567"));
        assert_eq!(ceil_dp(d("1.0000001"), 6), d("1.000001"));
    }

    #[test]
    fn json_amounts() {
        #[derive(serde::Deserialize)]
        struct A {
            #[serde(deserialize_with = "de_dec")]
            a: D,
        }
        let x: A = serde_json::from_str(r#"{"a":"12.34"}"#).unwrap();
        assert_eq!(x.a, d("12.34"));
        let y: A = serde_json::from_str(r#"{"a":0.1}"#).unwrap();
        assert_eq!(y.a, d("0.1"));
        assert!(serde_json::from_str::<A>(r#"{"a":"1e9"}"#).is_err());
    }
}

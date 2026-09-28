//! Money helpers. Every amount is a `rust_decimal::Decimal`; floats only appear at the JSON edge and are
//! converted through their shortest decimal text (same convention as the trading engine).

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Deserializer};
use std::str::FromStr;

pub type D = Decimal;
pub const ZERO: D = Decimal::ZERO;
pub const HUNDRED: D = Decimal::ONE_HUNDRED;

/// Cents, half away from zero.
pub fn r2(d: D) -> D {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

pub fn from_f64(f: f64) -> Option<D> {
    if !f.is_finite() {
        return None;
    }
    Decimal::from_str(&format!("{f}")).ok().map(|d| d.normalize())
}

/// Decimal → JSON number.
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

/// JSON value (number or numeric string) → Decimal.
pub fn dec_of(v: &serde_json::Value) -> Option<D> {
    match v {
        serde_json::Value::Number(n) => n.as_f64().and_then(from_f64),
        serde_json::Value::String(s) => Decimal::from_str(s.trim()).ok(),
        _ => None,
    }
}

/// `pct` percent of `base`.
pub fn pct_of(base: D, pct: D) -> D {
    base * pct / HUNDRED
}

pub fn de_dec<'de, De: Deserializer<'de>>(d: De) -> Result<D, De::Error> {
    let v = serde_json::Value::deserialize(d)?;
    dec_of(&v).ok_or_else(|| serde::de::Error::custom("invalid number"))
}

pub fn de_opt_dec<'de, De: Deserializer<'de>>(d: De) -> Result<Option<D>, De::Error> {
    let v = Option::<serde_json::Value>::deserialize(d)?;
    match v {
        None | Some(serde_json::Value::Null) => Ok(None),
        Some(v) => dec_of(&v).map(Some).ok_or_else(|| serde::de::Error::custom("invalid number")),
    }
}

/// Serializes a Decimal as a JSON number (for snapshots and API structs).
pub fn ser_dec<S: serde::Serializer>(d: &D, s: S) -> Result<S::Ok, S::Error> {
    serde::Serialize::serialize(&num(*d), s)
}

pub fn ser_opt_dec<S: serde::Serializer>(d: &Option<D>, s: S) -> Result<S::Ok, S::Error> {
    serde::Serialize::serialize(&num_opt(*d), s)
}

/// `#[serde(with = "crate::money::jnum")]`: Decimal as a JSON number (accepts numeric strings too).
pub mod jnum {
    use super::D;
    pub fn serialize<S: serde::Serializer>(d: &D, s: S) -> Result<S::Ok, S::Error> {
        super::ser_dec(d, s)
    }
    pub fn deserialize<'de, De: serde::Deserializer<'de>>(d: De) -> Result<D, De::Error> {
        super::de_dec(d)
    }
}

/// Optional variant of [`jnum`].
pub mod jnum_opt {
    use super::D;
    pub fn serialize<S: serde::Serializer>(d: &Option<D>, s: S) -> Result<S::Ok, S::Error> {
        super::ser_opt_dec(d, s)
    }
    pub fn deserialize<'de, De: serde::Deserializer<'de>>(d: De) -> Result<Option<D>, De::Error> {
        super::de_opt_dec(d)
    }
}

//! Instrument catalogue controls stored in the engine's database: Back Office overrides of the spec templates
//! (`symbol_templates`) and the live-trading switch for catalogue instruments (`symbol_live`). See specs.rs for
//! how they apply. Changing either rebuilds the specs and swaps them in (`SpecsCell`); the core instruments are
//! never affected.

use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::collections::BTreeSet;
use std::sync::Arc;

use crate::shard::Hub;
use crate::specs::{Overrides, RawSpec, Specs};

/// Reads the Back Office overrides. A template override that no longer parses is skipped (and logged), never
/// fatal: the file template still applies.
pub async fn load_overrides(pool: &PgPool) -> anyhow::Result<Overrides> {
    let mut ov = Overrides::default();
    for r in sqlx::query("SELECT key, spec FROM symbol_templates").fetch_all(pool).await? {
        let key: String = r.get("key");
        let spec: sqlx::types::Json<Value> = r.get("spec");
        match serde_json::from_value::<RawSpec>(spec.0) {
            Ok(s) => {
                ov.templates.insert(key, s);
            }
            Err(e) => tracing::error!(template = %key, error = %e, "template override ignored: it does not parse"),
        }
    }
    for r in sqlx::query("SELECT scope, key, enabled FROM symbol_live").fetch_all(pool).await? {
        let (scope, key, on): (String, String, bool) = (r.get("scope"), r.get("key"), r.get("enabled"));
        match scope.as_str() {
            "class" => {
                ov.live_classes.insert(key, on);
            }
            "symbol" => {
                ov.live_symbols.insert(key, on);
            }
            _ => {}
        }
    }
    Ok(ov)
}

/// Rebuilds the engine's specs from the database overrides and swaps them in.
pub async fn reload(hub: &Hub, pool: &PgPool) -> anyhow::Result<Arc<Specs>> {
    let ov = load_overrides(pool).await?;
    let next = hub.shared.specs.load().with_overrides(ov)?;
    hub.shared.specs.store(next);
    Ok(hub.shared.specs.load())
}

/// Symbols the engine needs streamed: every symbol with a position or pending order, plus the pairs that convert
/// their profit currency to USD (P&L and margin need those prices too).
pub fn hold_set(specs: &Specs, held: &BTreeSet<String>) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    for s in held {
        let Some(spec) = specs.get(s) else { continue };
        out.insert(s.clone());
        if spec.quote_ccy != "USD"
            && let Some((pair, _)) = specs.usd_pair(&spec.quote_ccy)
        {
            out.insert(pair);
        }
    }
    out
}

/// Open positions and pending orders (all brokers, live and demo) on any of `symbols`: `{symbol: count}`.
pub async fn open_interest(hub: &Hub, symbols: &BTreeSet<String>) -> serde_json::Map<String, Value> {
    let want = Arc::new(symbols.clone());
    let mut counts: std::collections::BTreeMap<String, u64> = Default::default();
    for t in hub.shared.registry.all() {
        let w = want.clone();
        let rows = hub
            .scan(
                t.tenant_id,
                Arc::new(move |st, _| {
                    st.positions.values().filter(|p| p.option.is_none()).map(|p| &p.symbol).chain(st.orders.values().filter(|o| o.option.is_none()).map(|o| &o.symbol)).filter(|s| w.contains(*s)).map(|s| json!(s)).collect()
                }),
            )
            .await;
        for r in rows {
            if let Some(s) = r.as_str() {
                *counts.entry(s.to_string()).or_default() += 1;
            }
        }
    }
    counts.into_iter().map(|(k, v)| (k, json!(v))).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hold_set_adds_conversion_pairs() {
        let specs = crate::specs::test_specs();
        let held: BTreeSet<String> = ["USDJPY", "GBPJPY", "EURUSD", "NOPE"].iter().map(|s| s.to_string()).collect();
        let h = hold_set(&specs, &held);
        // GBPJPY's profit is in JPY: USDJPY converts it; EURUSD is already USD
        assert_eq!(h, ["EURUSD", "GBPJPY", "USDJPY"].iter().map(|s| s.to_string()).collect());
    }
}

//! Contract specs (config/instruments.json + config/trading-specs.json) for the informational spread cost
//! (D50) and the broker's spread markup revenue estimate (D120).

use std::collections::HashMap;
use std::sync::RwLock;

use serde_json::Value;

#[derive(Clone, Debug)]
pub struct Spec {
    pub symbol: String,
    pub asset_class: String,
    pub digits: u32,
    pub contract_size: f64,
    pub base_spread: f64,
    pub quote_ccy: String,
    pub base_ccy: String,
}

impl Spec {
    pub fn point(&self) -> f64 {
        10f64.powi(-(self.digits as i32))
    }

    /// USD value of one unit of the quote currency, at `price` for USD-based pairs (approximate for crosses).
    /// `rates`: USD per unit of other currencies from market-data (catalogue currencies the fixed table lacks).
    pub fn quote_to_usd(&self, price: f64, rates: &HashMap<String, f64>) -> f64 {
        if self.quote_ccy == "USD" {
            1.0
        } else if self.base_ccy == "USD" && price > 0.0 {
            1.0 / price
        } else {
            match self.quote_ccy.as_str() {
                "JPY" => 1.0 / 150.0,
                "EUR" => 1.1,
                "GBP" => 1.3,
                "CHF" => 1.2,
                "CAD" => 0.73,
                "AUD" => 0.66,
                "INR" => 1.0 / 84.0,
                // unknown currency without a rate: no estimate rather than a wrong one
                other => rates.get(other).copied().unwrap_or(0.0),
            }
        }
    }
}

#[derive(Default)]
pub struct Specs {
    pub by_symbol: HashMap<String, Spec>,
    /// Spread markups from market-data: (spread group, symbol or "*") → points.
    pub markups: RwLock<HashMap<(String, String), f64>>,
    /// Engine group code → market-data spread group.
    pub spread_groups: RwLock<HashMap<String, String>>,
    /// USD per unit of currency, from market-data raw quotes (`set_rates`).
    pub rates: RwLock<HashMap<String, f64>>,
}

impl Specs {
    pub fn load(instruments: &str, specs: &str) -> anyhow::Result<Self> {
        let inst: Vec<Value> = serde_json::from_str(&std::fs::read_to_string(instruments)?)?;
        let sp: Value = serde_json::from_str(&std::fs::read_to_string(specs)?)?;
        let mut by_symbol = HashMap::new();
        for i in inst {
            let symbol = i["symbol"].as_str().unwrap_or_default().to_string();
            let class = i["asset_class"].as_str().unwrap_or("forex").to_string();
            // core instruments: symbol over class; provider catalogue rows (`"tier": "catalogue"`): symbol over the
            // row's own currencies over its template (same layering as the trading engine)
            let catalogue = i["tier"] == "catalogue";
            let template = i["template"].as_str().unwrap_or(&class).to_string();
            let c = if catalogue { &sp["templates"][&template] } else { &sp["classes"][&class] };
            let o = &sp["symbols"][&symbol];
            let row = |k: &str| if catalogue { i.get(k).filter(|v| !v.is_null()).cloned() } else { None };
            let pick = |k: &str| o.get(k).filter(|v| !v.is_null()).cloned().or_else(|| row(k)).or_else(|| c.get(k).cloned()).unwrap_or(Value::Null);
            by_symbol.insert(
                symbol.clone(),
                Spec {
                    asset_class: class,
                    digits: i["digits"].as_u64().unwrap_or(5) as u32,
                    contract_size: pick("contract_size").as_f64().unwrap_or(1.0),
                    base_spread: i["base_spread"].as_f64().unwrap_or(0.0),
                    quote_ccy: pick("quote_ccy").as_str().unwrap_or("USD").to_string(),
                    base_ccy: pick("base_ccy").as_str().unwrap_or("").to_string(),
                    symbol,
                },
            );
        }
        Ok(Self { by_symbol, markups: Default::default(), spread_groups: Default::default(), rates: Default::default() })
    }

    pub fn get(&self, symbol: &str) -> Option<&Spec> {
        self.by_symbol.get(symbol)
    }

    pub fn set_markups(&self, rows: &[Value]) {
        let mut m = HashMap::new();
        for r in rows {
            let g = r["group_code"].as_str().unwrap_or_default().to_string();
            let s = r["symbol"].as_str().unwrap_or_default().to_string();
            m.insert((g, s), r["markup_points"].as_f64().unwrap_or(0.0));
        }
        *self.markups.write().unwrap() = m;
    }

    pub fn set_groups(&self, groups: &[Value]) {
        let mut m = HashMap::new();
        for g in groups {
            if let (Some(c), Some(s)) = (g["code"].as_str(), g["spreadGroup"].as_str()) {
                m.insert(c.to_string(), s.to_string());
            }
        }
        *self.spread_groups.write().unwrap() = m;
    }

    /// USD rates of every currency with a `XXXUSD` / `USDXXX` quote in market-data's `/v1/quotes` (mid prices).
    pub fn set_rates(&self, quotes: &serde_json::Map<String, Value>) {
        let mut m = HashMap::new();
        for (sym, q) in quotes {
            let (Some(b), Some(a)) = (q["bid"].as_f64(), q["ask"].as_f64()) else { continue };
            let mid = (a + b) / 2.0;
            if mid <= 0.0 || sym.len() != 6 {
                continue;
            }
            if let Some(c) = sym.strip_suffix("USD") {
                m.entry(c.to_string()).or_insert(mid);
            } else if let Some(c) = sym.strip_prefix("USD") {
                m.entry(c.to_string()).or_insert(1.0 / mid);
            }
        }
        *self.rates.write().unwrap() = m;
    }

    pub fn spread_group(&self, group: &str) -> String {
        self.spread_groups.read().unwrap().get(group).cloned().unwrap_or_else(|| group.to_string())
    }

    pub fn markup_points(&self, spread_group: &str, symbol: &str) -> f64 {
        let m = self.markups.read().unwrap();
        m.get(&(spread_group.to_string(), symbol.to_string())).or_else(|| m.get(&(spread_group.to_string(), "*".to_string()))).copied().unwrap_or(0.0)
    }

    /// Half the round-turn spread cost of one side of a trade, in USD: volume × contract × spread × conversion / 2.
    /// `spread_price` is in price units. Unknown symbols cost 0.
    pub fn half_spread_usd(&self, symbol: &str, volume: f64, price: f64, spread_price: f64) -> f64 {
        match self.get(symbol) {
            Some(s) => volume * s.contract_size * spread_price * s.quote_to_usd(price, &self.rates.read().unwrap()) / 2.0,
            None => 0.0,
        }
    }

    /// Client spread cost of one deal side (base spread + group markup), USD, informational.
    pub fn deal_spread_cost_usd(&self, spread_group: &str, symbol: &str, volume: f64, price: f64) -> f64 {
        match self.get(symbol) {
            Some(s) => self.half_spread_usd(symbol, volume, price, s.base_spread + self.markup_points(spread_group, symbol) * s.point()),
            None => 0.0,
        }
    }

    /// Broker markup revenue of one deal side, USD.
    pub fn deal_markup_usd(&self, spread_group: &str, symbol: &str, volume: f64, price: f64) -> f64 {
        match self.get(symbol) {
            Some(s) => self.half_spread_usd(symbol, volume, price, self.markup_points(spread_group, symbol) * s.point()),
            None => 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo() -> Specs {
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config");
        Specs::load(&format!("{root}/instruments.json"), &format!("{root}/trading-specs.json")).unwrap()
    }

    #[test]
    fn catalogue_specs_load_and_core_costs_are_unchanged() {
        let s = repo();
        assert!(s.by_symbol.len() > 1000);
        let old_root = concat!(env!("CARGO_MANIFEST_DIR"), "/../trading/tests/fixtures");
        let old = Specs::load(&format!("{old_root}/instruments-core-2026-10-07.json"), &format!("{old_root}/trading-specs-core-2026-10-07.json")).unwrap();
        assert_eq!(old.by_symbol.len(), 28);
        for (sym, o) in &old.by_symbol {
            let n = s.get(sym).unwrap();
            assert_eq!(format!("{o:?}"), format!("{n:?}"), "{sym} changed");
            // same informational spread cost as before
            assert_eq!(old.deal_spread_cost_usd("standard", sym, 1.0, 1.1), s.deal_spread_cost_usd("standard", sym, 1.0, 1.1));
        }
        // catalogue rows: template contract size, the row's currencies
        let msft = s.get("MSFT").unwrap();
        assert_eq!((msft.contract_size, msft.quote_ccy.as_str()), (1.0, "USD"));
        let hk = s.get("00700.HK").unwrap();
        assert_eq!((hk.contract_size, hk.quote_ccy.as_str()), (100.0, "HKD"));
        let fx = s.get("AUDCAD").unwrap();
        assert_eq!((fx.contract_size, fx.quote_ccy.as_str(), fx.base_ccy.as_str()), (100000.0, "CAD", "AUD"));
    }

    #[test]
    fn catalogue_currencies_convert_with_market_rates_or_not_at_all() {
        let s = repo();
        // HKD has no fixed estimate: without a market-data rate the cost is not estimated (never taken as USD)
        assert_eq!(s.half_spread_usd("00700.HK", 1.0, 420.0, 0.2), 0.0);
        let quotes = serde_json::json!({"USDHKD": {"bid": 7.80, "ask": 7.80}, "NZDUSD": {"bid": 0.58, "ask": 0.58}, "EURUSD": {"bid": 1.2, "ask": 1.2}});
        s.set_rates(quotes.as_object().unwrap());
        let hkd = s.half_spread_usd("00700.HK", 1.0, 420.0, 0.2);
        assert!((hkd - 100.0 * 0.2 / 7.8 / 2.0).abs() < 1e-9, "{hkd}");
        // the fixed table still wins for the core currencies (EUR stays 1.1)
        assert_eq!(s.get("GER40").unwrap().quote_to_usd(20000.0, &s.rates.read().unwrap()), 1.1);
    }
}

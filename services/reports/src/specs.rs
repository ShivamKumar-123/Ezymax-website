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
    pub fn quote_to_usd(&self, price: f64) -> f64 {
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
                _ => 1.0,
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
}

impl Specs {
    pub fn load(instruments: &str, specs: &str) -> anyhow::Result<Self> {
        let inst: Vec<Value> = serde_json::from_str(&std::fs::read_to_string(instruments)?)?;
        let sp: Value = serde_json::from_str(&std::fs::read_to_string(specs)?)?;
        let mut by_symbol = HashMap::new();
        for i in inst {
            let symbol = i["symbol"].as_str().unwrap_or_default().to_string();
            let class = i["asset_class"].as_str().unwrap_or("forex").to_string();
            let c = &sp["classes"][&class];
            let o = &sp["symbols"][&symbol];
            let pick = |k: &str| o.get(k).filter(|v| !v.is_null()).or_else(|| c.get(k)).cloned().unwrap_or(Value::Null);
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
        Ok(Self { by_symbol, markups: Default::default(), spread_groups: Default::default() })
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
            Some(s) => volume * s.contract_size * spread_price * s.quote_to_usd(price) / 2.0,
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

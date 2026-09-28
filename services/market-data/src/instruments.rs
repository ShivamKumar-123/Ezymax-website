use chrono::{DateTime, Datelike, Duration, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};

use crate::timeframes::server_offset_secs;
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Provider {
    pub market: String, // common | crypto | stock
    pub code: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Instrument {
    pub symbol: String,
    pub asset_class: String,
    pub digits: u32,
    pub base_spread: f64,
    pub provider: Provider,
    /// Trading session filter. `us_equity` = 09:30–16:00 New York, Mon–Fri (extended-hours trades are
    /// ignored so bars match the exchange's regular-session candles). None = every tick counts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session: Option<String>,
}

impl Instrument {
    pub fn point(&self) -> f64 {
        10f64.powi(-(self.digits as i32))
    }
    pub fn in_session(&self, ts: DateTime<Utc>) -> bool {
        match self.session.as_deref() {
            Some("us_equity") => {
                // New York = server time (GMT+2/+3) − 7h, same DST switch
                let ny = ts + Duration::seconds(server_offset_secs(ts)) - Duration::hours(7);
                let mins = ny.hour() * 60 + ny.minute();
                !matches!(ny.weekday(), Weekday::Sat | Weekday::Sun) && (570..960).contains(&mins)
            }
            // 24/7 markets
            _ if self.asset_class == "crypto" => true,
            // FX, metals, indices, energies: closed over the weekend (Saturday and Sunday server time, i.e.
            // New York Friday 17:00 → Sunday 17:00). Stray provider quotes in that window are not market prices.
            _ => {
                let server = ts + Duration::seconds(server_offset_secs(ts));
                !matches!(server.weekday(), Weekday::Sat | Weekday::Sun)
            }
        }
    }

    pub fn round_bar(&self, b: crate::db::Bar) -> crate::db::Bar {
        crate::db::Bar { o: self.round(b.o), h: self.round(b.h), l: self.round(b.l), c: self.round(b.c), ..b }
    }

    pub fn round(&self, p: f64) -> f64 {
        let f = 10f64.powi(self.digits as i32);
        (p * f).round() / f
    }
}

/// Instrument catalogue with lookups in both directions (Kalks symbol ↔ provider market+code).
#[derive(Clone, Debug)]
pub struct Catalogue {
    pub list: Vec<Instrument>,
    by_symbol: HashMap<String, usize>,
    by_provider: HashMap<(String, String), usize>,
}

impl Catalogue {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let raw = std::fs::read_to_string(path).map_err(|e| anyhow::anyhow!("reading {path}: {e}"))?;
        let list: Vec<Instrument> = serde_json::from_str(&raw)?;
        let by_symbol = list.iter().enumerate().map(|(i, x)| (x.symbol.clone(), i)).collect();
        let by_provider = list.iter().enumerate().map(|(i, x)| ((x.provider.market.clone(), x.provider.code.clone()), i)).collect();
        Ok(Self { list, by_symbol, by_provider })
    }
    pub fn get(&self, symbol: &str) -> Option<&Instrument> {
        self.by_symbol.get(symbol).map(|&i| &self.list[i])
    }
    pub fn from_provider(&self, market: &str, code: &str) -> Option<&Instrument> {
        self.by_provider.get(&(market.to_string(), code.to_string())).map(|&i| &self.list[i])
    }
    pub fn markets(&self) -> Vec<String> {
        let mut m: Vec<String> = self.list.iter().map(|x| x.provider.market.clone()).collect();
        m.sort();
        m.dedup();
        m
    }
    pub fn codes_for(&self, market: &str) -> Vec<String> {
        self.list.iter().filter(|x| x.provider.market == market).map(|x| x.provider.code.clone()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn stock() -> Instrument {
        Instrument {
            symbol: "AAPL".into(),
            asset_class: "stocks".into(),
            digits: 2,
            base_spread: 0.06,
            provider: Provider { market: "stock".into(), code: "AAPL.US".into() },
            session: Some("us_equity".into()),
        }
    }

    #[test]
    fn us_equity_session() {
        let s = stock();
        // September (EDT, UTC−4): regular session 13:30–20:00 UTC
        assert!(!s.in_session(Utc.with_ymd_and_hms(2026, 9, 24, 13, 29, 59).unwrap()));
        assert!(s.in_session(Utc.with_ymd_and_hms(2026, 9, 24, 13, 30, 0).unwrap()));
        assert!(s.in_session(Utc.with_ymd_and_hms(2026, 9, 24, 19, 59, 59).unwrap()));
        assert!(!s.in_session(Utc.with_ymd_and_hms(2026, 9, 24, 20, 0, 0).unwrap()));
        // January (EST, UTC−5): 14:30–21:00 UTC
        assert!(!s.in_session(Utc.with_ymd_and_hms(2026, 1, 14, 14, 0, 0).unwrap()));
        assert!(s.in_session(Utc.with_ymd_and_hms(2026, 1, 14, 20, 30, 0).unwrap()));
        // weekend
        assert!(!s.in_session(Utc.with_ymd_and_hms(2026, 9, 26, 15, 0, 0).unwrap()));
    }

    #[test]
    fn fx_weekend_close() {
        let fx = Instrument { symbol: "EURUSD".into(), asset_class: "forex".into(), digits: 5, base_spread: 0.0001, provider: Provider { market: "common".into(), code: "EURUSD".into() }, session: None };
        // September (server GMT+3): Friday 20:59 UTC trades, Friday 21:00 UTC (Sat 00:00 server) is closed
        assert!(fx.in_session(Utc.with_ymd_and_hms(2026, 9, 25, 20, 59, 59).unwrap()));
        assert!(!fx.in_session(Utc.with_ymd_and_hms(2026, 9, 25, 21, 0, 0).unwrap()));
        assert!(!fx.in_session(Utc.with_ymd_and_hms(2026, 9, 26, 9, 0, 0).unwrap()));
        assert!(!fx.in_session(Utc.with_ymd_and_hms(2026, 9, 27, 20, 59, 0).unwrap()));
        // reopens Sunday 21:00 UTC (Monday 00:00 server)
        assert!(fx.in_session(Utc.with_ymd_and_hms(2026, 9, 27, 21, 0, 0).unwrap()));
        // January (server GMT+2): reopens Sunday 22:00 UTC
        assert!(!fx.in_session(Utc.with_ymd_and_hms(2026, 1, 11, 21, 30, 0).unwrap()));
        assert!(fx.in_session(Utc.with_ymd_and_hms(2026, 1, 11, 22, 0, 0).unwrap()));
        let btc = Instrument { asset_class: "crypto".into(), ..fx };
        assert!(btc.in_session(Utc.with_ymd_and_hms(2026, 9, 26, 9, 0, 0).unwrap()));
    }
}

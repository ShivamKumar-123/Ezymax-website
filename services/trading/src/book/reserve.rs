//! Order margin (docs/OPTIONS-EXCHANGE.md §3) and the account side of working book orders.
//!
//! * **Buy:** `left × limit × contractSize × usdPerQuote × (1 + 2 % FX buffer if the quote currency is not USD)`
//!   plus the worst-case fee. Checked against free cash (and against the balance when it closes a short).
//! * **Sell:** opening qty = the standalone scenario margin of that qty (optmath grid, no offsets) plus the fee;
//!   closing qty = the fee only.
//! * **Per series:** max(Σ buy reserves, Σ sell reserves). `Metrics::order_reserve` is the sum over series.
//! * **Release:** pro rata on fills (`qty × reserve_per_step`), the rest when the order is done.
//!
//! `BookState` lives in `AccountState.book` (`#[serde(skip)]`, in memory). Working orders and their
//! reservations are rebuilt from `book_orders` at start; the applied-fill set is derived from the event stream
//! (deals carry `option.fill`), so a re-dispatched fill is recognised after a restart.

use chrono::{DateTime, Utc};
use std::collections::{BTreeMap, BTreeSet, VecDeque};

use super::types::{OrderExt, Steps, Ticks, Tif};
use crate::model::Side;
use crate::money::{D, ZERO};

/// FX buffer on buy reserves when the premium currency is not USD.
pub fn fx_buffer() -> D {
    D::new(2, 2)
}

/// Rounds a per-step reserve up to 1e-8 (the reserve is never below the exact amount).
pub fn ceil8(x: D) -> D {
    x.round_dp_with_strategy(8, rust_decimal::RoundingStrategy::AwayFromZero)
}

/// Per-step reserve of a buy (account currency): premium at the limit (+ FX buffer) + worst-case fee.
pub fn buy_per_step(price: D, step: D, contract_size: D, usd_per_quote: D, quote_is_usd: bool, usd_factor: D, fee_per_contract: D) -> D {
    let buffer = if quote_is_usd { D::ONE } else { D::ONE + fx_buffer() };
    let premium = price * step * contract_size * usd_per_quote * buffer;
    ceil8((premium + fee_per_contract.max(ZERO) * step) * usd_factor)
}

/// Per-step reserve of a sell: (fee on every step + margin of the opening steps) spread over the order.
/// `opening_margin` is already in the account currency.
pub fn sell_per_step(qty: Steps, step: D, usd_factor: D, fee_per_contract: D, opening_margin: D) -> D {
    if qty <= 0 {
        return ZERO;
    }
    let fee = fee_per_contract.max(ZERO) * step * D::from(qty) * usd_factor;
    ceil8((fee + opening_margin.max(ZERO)) / D::from(qty))
}

/// A working book order as the account sees it.
#[derive(Clone, Debug, PartialEq)]
pub struct Working {
    pub id: i64,
    pub underlying: String,
    pub series: String,
    pub side: Side,
    pub px: Ticks,
    /// Premium per unit (quote currency) = px × tick.
    pub price: D,
    /// Premium tick of the series.
    pub tick: D,
    pub qty: Steps,
    pub left: Steps,
    /// Contracts per step.
    pub step: D,
    pub reserve_per_step: D,
    /// Extra reserve held while an amend is in flight: (token, amount).
    pub hold: Option<(u64, D)>,
    pub tif: Tif,
    pub flags: u8,
    pub expire_ms: Option<i64>,
    pub ext: OrderExt,
    /// Steps that open new exposure (the no-open rule and the limits apply to these).
    pub opening: Steps,
    pub created: DateTime<Utc>,
}

impl Working {
    /// What this order holds now (account currency).
    pub fn reserved(&self) -> D {
        D::from(self.left.max(0)) * self.reserve_per_step + self.hold.map(|h| h.1).unwrap_or(ZERO)
    }

    /// The terminal view of a working order (quantities in contracts, prices premium per unit).
    pub fn json(&self) -> serde_json::Value {
        use crate::money::{num, r2};
        serde_json::json!({
            "id": self.id, "series": self.series, "underlying": self.underlying, "side": self.side.as_str(), "type": self.ext.kind,
            "qty": num(D::from(self.qty) * self.step), "filled": num(D::from(self.qty - self.left) * self.step), "left": num(D::from(self.left) * self.step),
            "price": num(self.price), "tif": self.tif.as_str(), "flags": super::types::flag_names(self.flags), "reserved": num(r2(self.reserved())),
            "expireAt": self.expire_ms.and_then(chrono::DateTime::from_timestamp_millis), "createdAt": self.created, "clientOrderId": self.ext.client_order_id,
            "status": if self.left < self.qty { "partially_filled" } else { "working" },
        })
    }
}

impl BookState {
    /// `{type: "book_orders", orders, reserved}` for the terminal stream (market-maker quotes left out).
    pub fn frame(&self) -> serde_json::Value {
        let orders: Vec<serde_json::Value> = self.orders.values().filter(|w| w.flags & super::types::EPHEMERAL == 0).map(Working::json).collect();
        serde_json::json!({"type": "book_orders", "orders": orders, "reserved": crate::money::num(crate::money::r2(self.reserve()))})
    }
}

/// The account's book state.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct BookState {
    pub orders: BTreeMap<i64, Working>,
    /// Fill applications booked on this account (`{fillId}:{role}`), derived from the deals in the event stream.
    pub applied: BTreeSet<String>,
    applied_fifo: VecDeque<String>,
    /// clientOrderId → order id of book orders.
    pub client_ids: BTreeMap<String, i64>,
}

/// How many applied-fill keys an account remembers in memory (older ones are caught by the ledger's unique
/// idempotency keys).
pub const APPLIED_MEMORY: usize = 100_000;

impl BookState {
    pub fn is_idle(&self) -> bool {
        self.orders.is_empty()
    }

    /// Reserve of one series: max(Σ buys, Σ sells).
    pub fn series_reserve(&self, series: &str) -> D {
        let (mut b, mut s) = (ZERO, ZERO);
        for o in self.orders.values().filter(|o| o.series == series) {
            match o.side {
                Side::Buy => b += o.reserved(),
                Side::Sell => s += o.reserved(),
            }
        }
        b.max(s)
    }

    /// `order_reserve` of the account: Σ over series.
    pub fn reserve(&self) -> D {
        let series: BTreeSet<&str> = self.orders.values().map(|o| o.series.as_str()).collect();
        series.into_iter().map(|s| self.series_reserve(s)).sum()
    }

    pub fn remember_fill(&mut self, key: String) {
        if self.applied.insert(key.clone()) {
            self.applied_fifo.push_back(key);
            while self.applied_fifo.len() > APPLIED_MEMORY {
                if let Some(old) = self.applied_fifo.pop_front() {
                    self.applied.remove(&old);
                }
            }
        }
    }

    /// Working steps on `side` in `series` (other orders' claims on closing capacity).
    pub fn working(&self, series: &str, side: Side) -> Steps {
        self.orders.values().filter(|o| o.series == series && o.side == side).map(|o| o.left).sum()
    }

    pub fn count_series(&self, series: &str) -> usize {
        self.orders.values().filter(|o| o.series == series).count()
    }

    /// Working opening steps of the account (limits count them as if filled).
    pub fn opening_contracts(&self) -> (D, D) {
        let (mut l, mut s) = (ZERO, ZERO);
        for o in self.orders.values() {
            let c = D::from(o.opening.min(o.left).max(0)) * o.step;
            match o.side {
                Side::Buy => l += c,
                Side::Sell => s += c,
            }
        }
        (l, s)
    }
}

pub fn fill_key(fill_id: &str, role: &str) -> String {
    format!("{fill_id}:{role}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn d(s: &str) -> D {
        D::from_str(s).unwrap()
    }

    fn w(id: i64, series: &str, side: Side, left: Steps, rps: &str) -> Working {
        Working {
            id,
            underlying: "EURUSD".into(),
            series: series.into(),
            side,
            px: 100,
            price: d("0.001"),
            tick: d("0.00001"),
            qty: left,
            left,
            step: D::ONE,
            reserve_per_step: d(rps),
            hold: None,
            tif: Tif::Gtc,
            flags: 0,
            expire_ms: None,
            ext: OrderExt::default(),
            opening: left,
            created: Utc::now(),
        }
    }

    #[test]
    fn per_series_reserve_is_the_larger_side_and_zero_when_idle() {
        let mut b = BookState::default();
        assert_eq!(b.reserve(), ZERO);
        b.orders.insert(1, w(1, "A", Side::Buy, 2, "10"));
        b.orders.insert(2, w(2, "A", Side::Buy, 1, "10"));
        b.orders.insert(3, w(3, "A", Side::Sell, 5, "7"));
        b.orders.insert(4, w(4, "B", Side::Sell, 1, "3"));
        // A: max(30, 35) = 35; B: 3
        assert_eq!(b.reserve(), d("38"));
        b.orders.get_mut(&3).unwrap().hold = Some((1, d("5")));
        assert_eq!(b.series_reserve("A"), d("40"));
        b.orders.clear();
        assert_eq!(b.reserve(), ZERO);
    }

    #[test]
    fn buy_reserve_has_the_fx_buffer_and_fee() {
        // 0.0052 × 1 × 10 000 × 1 = 52 + 0.25 fee
        assert_eq!(buy_per_step(d("0.0052"), D::ONE, d("10000"), D::ONE, true, D::ONE, d("0.25")), d("52.25"));
        // JPY premium: 0.5 JPY × 10 000 × (1/150) × 1.02 = 34 + 0.25
        let r = buy_per_step(d("0.5"), D::ONE, d("10000"), D::ONE / d("150"), false, D::ONE, d("0.25"));
        assert!(r >= d("34.25") && r < d("34.2500001"), "{r}");
        // cent account: × 100
        assert_eq!(buy_per_step(d("0.0052"), D::ONE, d("10000"), D::ONE, true, d("100"), d("0.25")), d("5225"));
        assert_eq!(sell_per_step(4, D::ONE, D::ONE, d("0.25"), d("199")), d("50"));
    }

    #[test]
    fn applied_memory_is_bounded() {
        let mut b = BookState::default();
        for i in 0..(APPLIED_MEMORY + 10) {
            b.remember_fill(format!("f{i}"));
        }
        assert_eq!(b.applied.len(), APPLIED_MEMORY);
        assert!(!b.applied.contains("f0") && b.applied.contains(&format!("f{}", APPLIED_MEMORY + 9)));
    }
}

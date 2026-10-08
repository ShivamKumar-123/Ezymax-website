//! Depth of market for the Ezymex Trader ladder (D97).
//!
//! * **Feed** (`src = "feed"`): when the provider's depth stream carries several priced levels with sizes (and
//!   they are fresh), the ladder shows them, moved outwards by the account group's spread markup exactly like
//!   the top of book is.
//! * **Indicative** (`src = "indicative"`): otherwise (FX and metals only carry the top of book) the ladder is
//!   built here from the live bid/ask with the group's markup already applied. Levels step out by half the
//!   instrument's typical spread; sizes follow a fixed liquidity profile per asset class (thin at the touch,
//!   deeper further out), scaled down when the raw spread is wider than typical. The same quote always gives
//!   the same ladder: nothing is random, and it moves only when the price does. Clients label it Indicative.

use serde::Serialize;

use crate::instruments::Instrument;
use crate::state::Quote;

pub const DEFAULT_LEVELS: usize = 10;
pub const MAX_LEVELS: usize = 20;
/// Provider depth older than this (vs. the quote) is not shown.
pub const FEED_MAX_AGE_MS: i64 = 5_000;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct FeedDepth {
    /// best first: bids descending, asks ascending; (price, size in the provider's units)
    pub bids: Vec<(f64, f64)>,
    pub asks: Vec<(f64, f64)>,
    pub t: i64,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Depth {
    pub src: &'static str,
    /// best first; (price, lots)
    pub bids: Vec<(f64, f64)>,
    pub asks: Vec<(f64, f64)>,
    pub t: i64,
}

/// Lots available at each level (best first) for a normal spread.
fn profile(asset_class: &str) -> &'static [f64] {
    match asset_class {
        "forex" => &[1.0, 2.0, 3.0, 5.0, 5.0, 8.0, 10.0, 10.0, 15.0, 20.0, 20.0, 25.0, 25.0, 30.0, 30.0, 40.0, 40.0, 50.0, 50.0, 50.0],
        "metals" => &[0.5, 1.0, 1.0, 2.0, 3.0, 3.0, 5.0, 5.0, 8.0, 10.0, 10.0, 12.0, 15.0, 15.0, 20.0, 20.0, 25.0, 25.0, 30.0, 30.0],
        "indices" => &[1.0, 2.0, 2.0, 3.0, 5.0, 5.0, 8.0, 10.0, 10.0, 15.0, 15.0, 20.0, 20.0, 25.0, 25.0, 30.0, 30.0, 40.0, 40.0, 50.0],
        "energies" => &[1.0, 1.0, 2.0, 3.0, 3.0, 5.0, 5.0, 8.0, 10.0, 10.0, 12.0, 15.0, 15.0, 20.0, 20.0, 25.0, 25.0, 30.0, 30.0, 30.0],
        "crypto" => &[0.2, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 4.0, 5.0, 5.0, 6.0, 6.0, 8.0, 8.0, 10.0, 10.0, 10.0],
        _ => &[5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0, 60.0, 80.0, 80.0, 100.0, 100.0, 120.0, 120.0, 150.0, 150.0, 200.0, 200.0, 200.0],
    }
}

/// Price distance between indicative levels: half the typical spread, at least one point.
pub fn step(inst: &Instrument) -> f64 {
    let pt = inst.point();
    let points = ((inst.base_spread / 2.0) / pt).round().max(1.0);
    inst.round(points * pt)
}

/// 1 at a normal spread, down to 0.25 when the raw spread is four times wider (thin, fast market).
pub fn liquidity(inst: &Instrument, raw: &Quote) -> f64 {
    let s = raw.ask - raw.bid;
    if s <= 0.0 || inst.base_spread <= 0.0 {
        return 1.0;
    }
    (inst.base_spread / s).clamp(0.25, 1.0)
}

fn lots(v: f64) -> f64 {
    ((v * 100.0).round() / 100.0).max(0.01)
}

/// The ladder for one symbol. `raw` = the provider quote, `client` = the same quote with the group's spread
/// markup applied (what the account trades at), `feed` = provider depth when there is any.
pub fn build(inst: &Instrument, raw: &Quote, client: &Quote, feed: Option<&FeedDepth>, levels: usize) -> Depth {
    let levels = levels.clamp(1, MAX_LEVELS);
    if let Some(f) = feed.filter(|f| f.bids.len() > 1 && f.asks.len() > 1 && (raw.t - f.t).abs() <= FEED_MAX_AGE_MS) {
        // the group's markup moves the whole book outwards, the same distance it moves the touch
        let (db, da) = (raw.bid - client.bid, client.ask - raw.ask);
        let bids = f.bids.iter().take(levels).map(|&(p, s)| (inst.round(p - db), s)).collect();
        let asks = f.asks.iter().take(levels).map(|&(p, s)| (inst.round(p + da), s)).collect();
        return Depth { src: "feed", bids, asks, t: f.t.max(client.t) };
    }
    let st = step(inst);
    let k = liquidity(inst, raw);
    let prof = profile(&inst.asset_class);
    let size = |i: usize| lots(prof[i.min(prof.len() - 1)] * k);
    let bids = (0..levels).map(|i| (inst.round(client.bid - st * i as f64), size(i))).collect();
    let asks = (0..levels).map(|i| (inst.round(client.ask + st * i as f64), size(i))).collect();
    Depth { src: "indicative", bids, asks, t: client.t }
}

/// WebSocket frame: `{"type":"depth","s","src","t","b":[[price,lots],…],"a":[…]}`.
pub fn frame(symbol: &str, d: &Depth) -> String {
    let side = |v: &[(f64, f64)]| v.iter().map(|(p, s)| format!("[{p},{s}]")).collect::<Vec<_>>().join(",");
    format!(r#"{{"type":"depth","s":"{symbol}","src":"{}","t":{},"b":[{}],"a":[{}]}}"#, d.src, d.t, side(&d.bids), side(&d.asks))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instruments::Provider;

    fn inst(symbol: &str, class: &str, digits: u32, spread: f64) -> Instrument {
        Instrument { symbol: symbol.into(), asset_class: class.into(), digits, base_spread: spread, provider: Provider { market: "common".into(), code: symbol.into() }, ..Default::default() }
    }
    fn q(bid: f64, ask: f64, t: i64) -> Quote {
        Quote { bid, ask, last: (bid + ask) / 2.0, t, book_t: 0, recv: 0, delayed: false }
    }

    #[test]
    fn indicative_ladder_starts_at_the_client_quote() {
        let eur = inst("EURUSD", "forex", 5, 0.00008);
        let raw = q(1.08000, 1.08008, 1);
        let client = q(1.07995, 1.08013, 1); // group markup applied
        let d = build(&eur, &raw, &client, None, 10);
        assert_eq!(d.src, "indicative");
        assert_eq!(d.bids.len(), 10);
        assert_eq!(d.asks.len(), 10);
        assert_eq!(d.bids[0].0, 1.07995);
        assert_eq!(d.asks[0].0, 1.08013);
        // 4-point steps outwards, strictly monotonic, never crossing
        assert_eq!(step(&eur), 0.00004);
        assert_eq!(d.bids[1].0, 1.07991);
        assert_eq!(d.asks[1].0, 1.08017);
        assert!(d.bids.windows(2).all(|w| w[0].0 > w[1].0));
        assert!(d.asks.windows(2).all(|w| w[0].0 < w[1].0));
        assert!(d.bids[0].0 < d.asks[0].0);
        // thin at the touch, deeper further out; symmetric
        assert_eq!(d.bids[0].1, 1.0);
        assert_eq!(d.bids[9].1, 20.0);
        assert_eq!(d.bids.iter().map(|b| b.1).collect::<Vec<_>>(), d.asks.iter().map(|a| a.1).collect::<Vec<_>>());
    }

    #[test]
    fn deterministic_and_moves_with_the_price() {
        let gold = inst("XAUUSD", "metals", 2, 0.18);
        let a = build(&gold, &q(2650.10, 2650.28, 5), &q(2650.10, 2650.28, 5), None, 10);
        let b = build(&gold, &q(2650.10, 2650.28, 5), &q(2650.10, 2650.28, 5), None, 10);
        assert_eq!(a, b);
        let c = build(&gold, &q(2651.10, 2651.28, 6), &q(2651.10, 2651.28, 6), None, 10);
        assert_eq!(c.bids[0].0, 2651.10);
        assert_eq!(c.bids.iter().map(|x| x.1).collect::<Vec<_>>(), a.bids.iter().map(|x| x.1).collect::<Vec<_>>());
        assert_eq!(step(&gold), 0.09);
    }

    #[test]
    fn wide_spread_thins_the_book() {
        let eur = inst("EURUSD", "forex", 5, 0.00008);
        let wide = q(1.08000, 1.08032, 1); // 4x the typical spread
        let d = build(&eur, &wide, &wide, None, 3);
        assert_eq!(d.bids.iter().map(|x| x.1).collect::<Vec<_>>(), vec![0.25, 0.5, 0.75]);
        assert_eq!(liquidity(&eur, &q(1.0, 1.0, 0)), 1.0);
    }

    #[test]
    fn feed_depth_is_used_when_fresh_and_moved_by_the_markup() {
        let btc = inst("BTCUSD", "crypto", 2, 18.0);
        let raw = q(60000.0, 60010.0, 1_000);
        let client = q(59995.0, 60015.0, 1_000);
        let feed = FeedDepth { bids: vec![(60000.0, 1.2), (59999.0, 0.4), (59990.0, 3.0)], asks: vec![(60010.0, 0.8), (60011.5, 2.0)], t: 900 };
        let d = build(&btc, &raw, &client, Some(&feed), 10);
        assert_eq!(d.src, "feed");
        assert_eq!(d.bids, vec![(59995.0, 1.2), (59994.0, 0.4), (59985.0, 3.0)]);
        assert_eq!(d.asks, vec![(60015.0, 0.8), (60016.5, 2.0)]);
        // stale or single-level provider depth falls back to the indicative ladder
        let stale = FeedDepth { t: -10_000, ..feed.clone() };
        assert_eq!(build(&btc, &raw, &client, Some(&stale), 10).src, "indicative");
        let top_only = FeedDepth { bids: vec![(60000.0, 1.0)], asks: vec![(60010.0, 1.0)], t: 1_000 };
        assert_eq!(build(&btc, &raw, &client, Some(&top_only), 10).src, "indicative");
    }

    #[test]
    fn frame_shape() {
        let d = Depth { src: "indicative", bids: vec![(1.1, 1.0)], asks: vec![(1.2, 2.5)], t: 7 };
        let v: serde_json::Value = serde_json::from_str(&frame("EURUSD", &d)).unwrap();
        assert_eq!(v["type"], "depth");
        assert_eq!(v["s"], "EURUSD");
        assert_eq!(v["src"], "indicative");
        assert_eq!(v["b"][0][0], 1.1);
        assert_eq!(v["a"][0][1], 2.5);
    }
}

//! On-demand provider subscriptions within the plan's symbol limit.
//!
//! The catalogue lists every instrument the provider carries (1,000+), but the plan streams only a limited number
//! of symbols at once. Each symbol is streamed while someone needs it:
//!
//! * **hold**: the trading engine's open positions and pending orders, plus the conversion pairs their P&L needs
//!   (`{"op":"hold"}` on the stream). Stop-outs, SL / TP and margin depend on these prices, so they come first.
//! * **always**: the configured always-on set (`MARKET_DATA_ALWAYS_ON`, default: the core instruments).
//! * **focus**: a chart (`bars`) or a depth ladder (`depth`) is open on the symbol.
//! * **watch**: a quote subscription (watchlists, order tickets). `"passive": true` subscriptions (the trading
//!   engine's own feed, relays) receive whatever is streamed without creating demand.
//!
//! Demand is reference-counted per client connection, so a symbol stays wanted while any client wants it. A symbol
//! nobody wants any more stays subscribed for a grace period (users flip between charts), then is released. When
//! demand exceeds the plan, slots go by tier (hold > always > focus > watch > grace), then by the number of
//! clients, then to symbols already streaming (no churn at the limit), then to the most recently wanted.
//!
//! This module is pure bookkeeping (no IO), so it is unit-tested directly; `spawn` runs the planner that turns it
//! into per-market subscription sets for `ingest.rs`.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::instruments::Catalogue;

/// Why a symbol is streamed. Ordered: a higher tier wins a slot first.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    /// Nobody wants it, but it was released less than the grace period ago.
    Grace,
    Watch,
    Focus,
    Always,
    Hold,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct Refs {
    watch: u32,
    focus: u32,
    hold: u32,
}

impl Refs {
    fn total(&self) -> u32 {
        self.watch + self.focus + self.hold
    }
    fn slot(&mut self, t: Tier) -> Option<&mut u32> {
        match t {
            Tier::Watch => Some(&mut self.watch),
            Tier::Focus => Some(&mut self.focus),
            Tier::Hold => Some(&mut self.hold),
            Tier::Always | Tier::Grace => None,
        }
    }
    fn tier(&self) -> Option<Tier> {
        if self.hold > 0 {
            Some(Tier::Hold)
        } else if self.focus > 0 {
            Some(Tier::Focus)
        } else if self.watch > 0 {
            Some(Tier::Watch)
        } else {
            None
        }
    }
}

/// Plan limits. 0 = unlimited.
#[derive(Clone, Debug, Serialize)]
pub struct Limits {
    /// Symbols per provider market (one WebSocket each). Markets not listed use `default_per_market`.
    pub per_market: BTreeMap<String, usize>,
    pub default_per_market: usize,
    /// Symbols over all markets together.
    pub total: usize,
    #[serde(serialize_with = "secs")]
    pub grace: Duration,
    /// Markets that may stream at all (None = every market). Symbols of other markets get delayed prices only.
    pub streamable: Option<BTreeSet<String>>,
}

fn secs<S: serde::Serializer>(d: &Duration, s: S) -> Result<S::Ok, S::Error> {
    s.serialize_u64(d.as_secs())
}

impl Limits {
    pub fn for_market(&self, market: &str) -> usize {
        self.per_market.get(market).copied().unwrap_or(self.default_per_market)
    }
}

impl Default for Limits {
    fn default() -> Self {
        Self { per_market: BTreeMap::new(), default_per_market: 0, total: 0, grace: Duration::from_secs(300), streamable: None }
    }
}

/// The symbols to stream, per provider market, plus the demand that did not fit.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct Plan {
    /// market → Ezymex symbols
    pub markets: BTreeMap<String, BTreeSet<String>>,
    /// wanted (tier above grace) but over the plan limit
    pub dropped: Vec<(String, Tier)>,
}

impl Plan {
    pub fn symbols(&self) -> BTreeSet<String> {
        self.markets.values().flatten().cloned().collect()
    }
    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.markets.values().map(BTreeSet::len).sum()
    }
}

#[derive(Debug)]
pub struct Demand {
    refs: HashMap<String, Refs>,
    always: BTreeSet<String>,
    last_wanted: HashMap<String, Instant>,
    /// when a streamed symbol lost its last reference
    idle_since: HashMap<String, Instant>,
    pub limits: Limits,
}

impl Demand {
    pub fn new(always: impl IntoIterator<Item = String>, limits: Limits) -> Self {
        Self { refs: HashMap::new(), always: always.into_iter().collect(), last_wanted: HashMap::new(), idle_since: HashMap::new(), limits }
    }

    /// One more reference of `tier` on `symbol` (`Watch`, `Focus` or `Hold`).
    pub fn add(&mut self, symbol: &str, tier: Tier, now: Instant) {
        let r = self.refs.entry(symbol.to_string()).or_default();
        if let Some(n) = r.slot(tier) {
            *n += 1;
            self.last_wanted.insert(symbol.to_string(), now);
            self.idle_since.remove(symbol);
        }
    }

    /// Drops one reference (never below zero). The symbol enters its grace period when nothing references it.
    pub fn remove(&mut self, symbol: &str, tier: Tier, now: Instant) {
        let Some(r) = self.refs.get_mut(symbol) else { return };
        if let Some(n) = r.slot(tier) {
            *n = n.saturating_sub(1);
        }
        if r.total() == 0 {
            self.refs.remove(symbol);
            self.idle_since.insert(symbol.to_string(), now);
        }
    }

    /// Current tier of a symbol (None = not wanted and not in grace).
    pub fn tier(&self, symbol: &str, now: Instant) -> Option<Tier> {
        let refs = self.refs.get(symbol).and_then(Refs::tier);
        let always = self.always.contains(symbol).then_some(Tier::Always);
        let grace = self.idle_since.get(symbol).filter(|t| now.duration_since(**t) < self.limits.grace).map(|_| Tier::Grace);
        refs.max(always).or(grace)
    }

    /// References on `symbol` from every client.
    pub fn count(&self, symbol: &str) -> u32 {
        self.refs.get(symbol).map(Refs::total).unwrap_or(0)
    }

    /// Wanted symbols with their tier (for status pages).
    pub fn wanted(&self, now: Instant) -> BTreeMap<String, Tier> {
        let mut out = BTreeMap::new();
        for s in self.refs.keys().chain(self.always.iter()).chain(self.idle_since.keys()) {
            if let Some(t) = self.tier(s, now) {
                out.insert(s.clone(), t);
            }
        }
        out
    }

    /// Which symbols to stream now. `streaming` = what is subscribed at the provider right now (grace periods
    /// and the no-churn tie-break use it). Symbols missing from the catalogue are ignored.
    pub fn plan(&mut self, cat: &Catalogue, streaming: &BTreeSet<String>, now: Instant) -> Plan {
        // forget grace periods that ended
        let grace = self.limits.grace;
        self.idle_since.retain(|_, t| now.duration_since(*t) < grace);
        // a streamed symbol without demand that never had any (e.g. the always-on set shrank) enters grace now
        for s in streaming {
            if self.refs.get(s).is_none_or(|r| r.total() == 0) && !self.always.contains(s) && !self.idle_since.contains_key(s) && !self.last_wanted.contains_key(s) {
                self.idle_since.insert(s.clone(), now);
            }
        }
        let mut cands: Vec<(Tier, u32, bool, Option<Instant>, &str, &str)> = Vec::new();
        let names: BTreeSet<&String> = self.refs.keys().chain(self.always.iter()).chain(self.idle_since.keys()).collect();
        for s in names {
            let Some(tier) = self.tier(s, now) else { continue };
            // grace only keeps a symbol that is still subscribed; it never starts a new subscription
            if tier == Tier::Grace && !streaming.contains(s) {
                continue;
            }
            let Some(inst) = cat.get(s) else { continue };
            cands.push((tier, self.count(s), streaming.contains(s), self.last_wanted.get(s).copied(), s.as_str(), inst.provider.market.as_str()));
        }
        // best first: tier, clients, already streaming, most recently wanted, then name (deterministic)
        cands.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)).then(b.2.cmp(&a.2)).then(b.3.cmp(&a.3)).then(a.4.cmp(b.4)));
        let mut plan = Plan::default();
        let mut per: BTreeMap<&str, usize> = BTreeMap::new();
        let mut total = 0usize;
        for (tier, _, _, _, sym, market) in cands {
            if self.limits.streamable.as_ref().is_some_and(|m| !m.contains(market)) {
                if tier > Tier::Grace {
                    plan.dropped.push((sym.to_string(), tier));
                }
                continue;
            }
            let cap = self.limits.for_market(market);
            let used = per.entry(market).or_default();
            let fits = (cap == 0 || *used < cap) && (self.limits.total == 0 || total < self.limits.total);
            if fits {
                *used += 1;
                total += 1;
                plan.markets.entry(market.to_string()).or_default().insert(sym.to_string());
            } else if tier > Tier::Grace {
                plan.dropped.push((sym.to_string(), tier));
            }
        }
        // the provider rejects an empty subscription list: keep markets with nothing to stream out of the plan
        plan.markets.retain(|_, v| !v.is_empty());
        // forget recency of symbols nobody has wanted for a long time (bounded memory)
        let keep = grace * 4;
        self.last_wanted.retain(|s, t| self.refs.contains_key(s) || now.duration_since(*t) < keep);
        plan
    }
}

/// A client's references, released when the connection ends (Drop), however it ends.
pub struct ClientDemand {
    shared: Arc<std::sync::Mutex<Demand>>,
    notify: Arc<tokio::sync::Notify>,
    held: HashMap<(String, Tier), u32>,
}

impl ClientDemand {
    pub fn new(shared: Arc<std::sync::Mutex<Demand>>, notify: Arc<tokio::sync::Notify>) -> Self {
        Self { shared, notify, held: HashMap::new() }
    }

    /// Adds `symbol` at `tier` for this client unless it already holds it (one reference per client and tier).
    pub fn add(&mut self, symbol: &str, tier: Tier) {
        let n = self.held.entry((symbol.to_string(), tier)).or_default();
        *n += 1;
        if *n == 1 {
            self.shared.lock().unwrap().add(symbol, tier, Instant::now());
            self.notify.notify_one();
        }
    }

    /// Releases one use; the client's reference goes when its last use does.
    pub fn remove(&mut self, symbol: &str, tier: Tier) {
        let key = (symbol.to_string(), tier);
        let Some(n) = self.held.get_mut(&key) else { return };
        *n -= 1;
        if *n == 0 {
            self.held.remove(&key);
            self.shared.lock().unwrap().remove(symbol, tier, Instant::now());
            self.notify.notify_one();
        }
    }

    pub fn holds(&self, symbol: &str, tier: Tier) -> bool {
        self.held.contains_key(&(symbol.to_string(), tier))
    }

    /// Replaces this client's whole set at `tier` (the trading engine's `hold`).
    pub fn replace(&mut self, tier: Tier, symbols: &BTreeSet<String>) {
        let current: Vec<String> = self.held.keys().filter(|(_, t)| *t == tier).map(|(s, _)| s.clone()).collect();
        for s in current {
            if !symbols.contains(&s) {
                self.held.remove(&(s.clone(), tier));
                self.shared.lock().unwrap().remove(&s, tier, Instant::now());
            }
        }
        for s in symbols {
            if !self.held.contains_key(&(s.clone(), tier)) {
                self.held.insert((s.clone(), tier), 1);
                self.shared.lock().unwrap().add(s, tier, Instant::now());
            }
        }
        self.notify.notify_one();
    }
}

impl Drop for ClientDemand {
    fn drop(&mut self) {
        if self.held.is_empty() {
            return;
        }
        let now = Instant::now();
        if let Ok(mut d) = self.shared.lock() {
            for (s, t) in self.held.keys() {
                d.remove(s, *t, now);
            }
        }
        self.notify.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instruments::{Instrument, Provider};

    fn inst(symbol: &str, market: &str) -> Instrument {
        Instrument {
            symbol: symbol.into(),
            asset_class: "forex".into(),
            digits: 5,
            base_spread: 0.0001,
            provider: Provider { market: market.into(), code: symbol.into() },
            session: None,
            ..Default::default()
        }
    }

    fn cat() -> Catalogue {
        let mut v = vec![inst("EURUSD", "common"), inst("GBPUSD", "common"), inst("AUDDKK", "common"), inst("AUDHUF", "common"), inst("AUDNOK", "common")];
        v.push(inst("BTCUSD", "crypto"));
        v.push(inst("ETHUSD", "crypto"));
        Catalogue::from_list(v).unwrap()
    }

    fn limits(per_market: usize, total: usize) -> Limits {
        Limits { per_market: BTreeMap::new(), default_per_market: per_market, total, grace: Duration::from_secs(60), streamable: None }
    }

    fn set(v: &[&str]) -> BTreeSet<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn reference_counting_and_grace() {
        let c = cat();
        let t0 = Instant::now();
        let mut d = Demand::new(Vec::<String>::new(), limits(0, 0));
        d.add("AUDDKK", Tier::Watch, t0);
        d.add("AUDDKK", Tier::Watch, t0);
        let p = d.plan(&c, &BTreeSet::new(), t0);
        assert_eq!(p.symbols(), set(&["AUDDKK"]));
        // one of two clients leaves: still wanted
        d.remove("AUDDKK", Tier::Watch, t0);
        assert_eq!(d.count("AUDDKK"), 1);
        assert_eq!(d.plan(&c, &p.symbols(), t0).symbols(), set(&["AUDDKK"]));
        // the last one leaves: kept for the grace period, then released
        let t1 = t0 + Duration::from_secs(5);
        d.remove("AUDDKK", Tier::Watch, t1);
        assert_eq!(d.tier("AUDDKK", t1), Some(Tier::Grace));
        assert_eq!(d.plan(&c, &set(&["AUDDKK"]), t1 + Duration::from_secs(59)).symbols(), set(&["AUDDKK"]));
        assert!(d.plan(&c, &set(&["AUDDKK"]), t1 + Duration::from_secs(61)).symbols().is_empty());
        // removing more than was added never underflows
        d.remove("AUDDKK", Tier::Watch, t1);
        assert_eq!(d.count("AUDDKK"), 0);
    }

    #[test]
    fn grace_never_starts_a_subscription() {
        let c = cat();
        let t0 = Instant::now();
        let mut d = Demand::new(Vec::<String>::new(), limits(0, 0));
        d.add("AUDNOK", Tier::Watch, t0);
        d.remove("AUDNOK", Tier::Watch, t0);
        // not streaming (e.g. it never got a slot): grace does not subscribe it
        assert!(d.plan(&c, &BTreeSet::new(), t0).symbols().is_empty());
    }

    #[test]
    fn plan_limits_go_by_tier_then_clients() {
        let c = cat();
        let t0 = Instant::now();
        // two symbols per market, three overall
        let mut d = Demand::new(vec!["EURUSD".to_string()], limits(2, 3));
        d.add("AUDDKK", Tier::Watch, t0);
        d.add("AUDHUF", Tier::Watch, t0);
        d.add("AUDHUF", Tier::Watch, t0);
        d.add("AUDNOK", Tier::Hold, t0);
        d.add("BTCUSD", Tier::Focus, t0);
        let p = d.plan(&c, &BTreeSet::new(), t0);
        // common: hold AUDNOK, always EURUSD (2 of 2); crypto: BTCUSD; total 3
        assert_eq!(p.markets["common"], set(&["AUDNOK", "EURUSD"]));
        assert_eq!(p.markets["crypto"], set(&["BTCUSD"]));
        assert_eq!(p.len(), 3);
        let dropped: BTreeSet<String> = p.dropped.iter().map(|(s, _)| s.clone()).collect();
        assert_eq!(dropped, set(&["AUDDKK", "AUDHUF"]));
        // the hold goes away: the watched symbol with more clients takes the slot
        d.remove("AUDNOK", Tier::Hold, t0);
        let p = d.plan(&c, &p.symbols(), t0);
        assert_eq!(p.markets["common"], set(&["AUDHUF", "EURUSD"]));
    }

    #[test]
    fn hold_beats_everything_and_streaming_symbols_keep_their_slot_on_ties() {
        let c = cat();
        let t0 = Instant::now();
        let mut d = Demand::new(vec!["EURUSD".to_string(), "GBPUSD".to_string()], limits(2, 0));
        d.add("AUDDKK", Tier::Hold, t0);
        let p = d.plan(&c, &BTreeSet::new(), t0);
        // a held position outranks the always-on set
        assert!(p.markets["common"].contains("AUDDKK"));
        assert_eq!(p.markets["common"].len(), 2);
        assert_eq!(p.dropped.len(), 1);
        // equal watchers: the one already streaming keeps its slot (no churn)
        let mut d = Demand::new(Vec::<String>::new(), limits(1, 0));
        d.add("AUDHUF", Tier::Watch, t0);
        let first = d.plan(&c, &BTreeSet::new(), t0);
        assert_eq!(first.symbols(), set(&["AUDHUF"]));
        d.add("AUDNOK", Tier::Watch, t0 + Duration::from_secs(1));
        assert_eq!(d.plan(&c, &first.symbols(), t0 + Duration::from_secs(1)).symbols(), set(&["AUDHUF"]));
    }

    #[test]
    fn markets_that_may_not_stream_get_no_slot() {
        let c = cat();
        let t0 = Instant::now();
        let mut d = Demand::new(Vec::<String>::new(), Limits { streamable: Some(set(&["common"])), ..limits(0, 0) });
        d.add("BTCUSD", Tier::Hold, t0);
        d.add("AUDDKK", Tier::Watch, t0);
        let p = d.plan(&c, &BTreeSet::new(), t0);
        assert_eq!(p.symbols(), set(&["AUDDKK"]));
        assert_eq!(p.dropped, vec![("BTCUSD".to_string(), Tier::Hold)]);
    }

    #[test]
    fn unknown_symbols_and_empty_markets_are_ignored() {
        let c = cat();
        let t0 = Instant::now();
        let mut d = Demand::new(vec!["NOPE".to_string()], limits(0, 0));
        d.add("ALSO-NOPE", Tier::Watch, t0);
        let p = d.plan(&c, &BTreeSet::new(), t0);
        assert!(p.markets.is_empty());
        assert!(p.dropped.is_empty());
    }

    #[test]
    fn client_demand_is_released_on_drop() {
        let shared = Arc::new(std::sync::Mutex::new(Demand::new(Vec::<String>::new(), limits(0, 0))));
        let notify = Arc::new(tokio::sync::Notify::new());
        {
            let mut a = ClientDemand::new(shared.clone(), notify.clone());
            let mut b = ClientDemand::new(shared.clone(), notify.clone());
            // the same client watching twice (e.g. two widgets) is one reference
            a.add("AUDDKK", Tier::Watch);
            a.add("AUDDKK", Tier::Watch);
            b.add("AUDDKK", Tier::Watch);
            a.add("AUDDKK", Tier::Focus);
            assert_eq!(shared.lock().unwrap().count("AUDDKK"), 3);
            a.remove("AUDDKK", Tier::Watch);
            assert_eq!(shared.lock().unwrap().count("AUDDKK"), 3, "a still uses it once");
            a.replace(Tier::Hold, &set(&["BTCUSD", "ETHUSD"]));
            a.replace(Tier::Hold, &set(&["ETHUSD"]));
            assert_eq!(shared.lock().unwrap().count("BTCUSD"), 0);
            assert_eq!(shared.lock().unwrap().count("ETHUSD"), 1);
        }
        let d = shared.lock().unwrap();
        assert_eq!(d.count("AUDDKK"), 0);
        assert_eq!(d.count("ETHUSD"), 0);
        assert_eq!(d.tier("AUDDKK", Instant::now()), Some(Tier::Grace));
    }
}

//! Order book market data (docs/OPTIONS-EXCHANGE.md §6, §10).
//!
//! * `Top`: best bid / ask per (tenant, kind, series) plus a version counter. The actor publishes into it after
//!   every commit; `engine::options::mark_of` clamps the model mark inside it (`optmath::mark::clamp_mark`).
//! * Views: 10 levels per side, last trade, open interest (Σ longs) and the day's volume per series, for the
//!   internal snapshot route and order previews.
//! * Feed: `top` and `depth` frames for changed series at most every 250 ms (≤ 4/s per series) and `trade`
//!   frames as they happen, on a broadcast channel the internal WebSocket (`api/book_feed.rs`) forwards.

use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;

use super::types::{BookKey, Fill, SeriesBook, SeriesState, UnderlyingBooks};
use crate::model::AccountKind;
use crate::money::{D, num, num_opt};

/// Levels per side in depth views and frames.
pub const DEPTH: usize = 10;

/// Top of book of one series (premium per unit and contracts).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TopQuote {
    pub bid: Option<(D, D)>,
    pub ask: Option<(D, D)>,
}

/// One price level: (premium, contracts, orders).
pub type Level = (D, D, usize);

/// Everything public about one series' book.
#[derive(Clone, Debug, PartialEq)]
pub struct SeriesView {
    pub series: String,
    pub underlying: String,
    pub expiry: chrono::NaiveDate,
    pub state: SeriesState,
    pub bids: Vec<Level>,
    pub asks: Vec<Level>,
    pub last: Option<(D, D)>,
    pub oi: D,
    pub vol: D,
    pub seq: u64,
}

impl SeriesView {
    pub fn of(sb: &SeriesBook, seq: u64) -> Self {
        let (b, a) = sb.depth(DEPTH);
        let px = |t: i64| sb.spec.price(t);
        let q = |s: i64| sb.spec.contracts(s);
        SeriesView {
            series: sb.series.clone(),
            underlying: sb.spec.terms.underlying.clone(),
            expiry: sb.spec.terms.expiry,
            state: sb.state,
            bids: b.into_iter().map(|(p, s, n)| (px(p), q(s), n)).collect(),
            asks: a.into_iter().map(|(p, s, n)| (px(p), q(s), n)).collect(),
            last: sb.last.map(|(p, s)| (px(p), q(s))),
            oi: q(sb.oi()),
            vol: q(sb.vol_day.1),
            seq,
        }
    }
    pub fn top(&self) -> TopQuote {
        TopQuote { bid: self.bids.first().map(|l| (l.0, l.1)), ask: self.asks.first().map(|l| (l.0, l.1)) }
    }
    pub fn levels_json(levels: &[Level]) -> Value {
        json!(levels.iter().map(|(p, q, n)| json!({"price": num(*p), "qty": num(*q), "orders": n})).collect::<Vec<_>>())
    }
    pub fn json(&self) -> Value {
        json!({
            "series": self.series, "underlying": self.underlying, "expiry": self.expiry.to_string(), "state": self.state.as_str(),
            "bids": Self::levels_json(&self.bids), "asks": Self::levels_json(&self.asks),
            "last": num_opt(self.last.map(|l| l.0)), "lastQty": num_opt(self.last.map(|l| l.1)),
            "oi": num(self.oi), "vol": num(self.vol), "seq": self.seq,
        })
    }
}

type TopKey = (String, AccountKind, String);

pub struct Top {
    tops: RwLock<HashMap<TopKey, TopQuote>>,
    views: RwLock<HashMap<BookKey, BTreeMap<String, SeriesView>>>,
    slugs: RwLock<HashMap<i64, String>>,
    version: AtomicU64,
    dirty: Mutex<BTreeSet<(BookKey, String)>>,
    feed: broadcast::Sender<Arc<str>>,
}

impl Default for Top {
    fn default() -> Self {
        Top { tops: Default::default(), views: Default::default(), slugs: Default::default(), version: AtomicU64::new(0), dirty: Default::default(), feed: broadcast::channel(8192).0 }
    }
}

impl Top {
    pub fn version(&self) -> u64 {
        self.version.load(Ordering::SeqCst)
    }

    pub fn get(&self, tenant_slug: &str, kind: AccountKind, series: &str) -> Option<TopQuote> {
        self.tops.read().unwrap().get(&(tenant_slug.to_string(), kind, series.to_string())).copied().filter(|t| t.bid.is_some() || t.ask.is_some())
    }

    pub fn slug(&self, tenant_id: i64) -> Option<String> {
        self.slugs.read().unwrap().get(&tenant_id).cloned()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Arc<str>> {
        self.feed.subscribe()
    }

    /// Views of one book.
    pub fn views(&self, key: &BookKey) -> Vec<SeriesView> {
        self.views.read().unwrap().get(key).map(|m| m.values().cloned().collect()).unwrap_or_default()
    }

    pub fn view(&self, key: &BookKey, series: &str) -> Option<SeriesView> {
        self.views.read().unwrap().get(key).and_then(|m| m.get(series).cloned())
    }

    /// Every book key with a view.
    pub fn keys(&self) -> Vec<BookKey> {
        let mut v: Vec<BookKey> = self.views.read().unwrap().keys().cloned().collect();
        v.sort();
        v
    }

    /// Publishes the state of `series` (all of them when `None`) after a commit.
    pub fn publish(&self, slug: &str, books: &UnderlyingBooks, series: Option<&BTreeSet<String>>) {
        self.slugs.write().unwrap().insert(books.key.tenant_id, slug.to_string());
        let names: Vec<String> = match series {
            Some(s) => s.iter().cloned().collect(),
            None => books.series.keys().cloned().collect(),
        };
        if names.is_empty() {
            return;
        }
        let mut views = self.views.write().unwrap();
        let mut tops = self.tops.write().unwrap();
        let mut dirty = self.dirty.lock().unwrap();
        let m = views.entry(books.key.clone()).or_default();
        for s in names {
            let tk = (slug.to_string(), books.key.kind, s.clone());
            match books.book(&s) {
                Some(sb) => {
                    let v = SeriesView::of(sb, books.seq);
                    tops.insert(tk, v.top());
                    m.insert(s.clone(), v);
                }
                None => {
                    tops.remove(&tk);
                    m.remove(&s);
                }
            }
            dirty.insert((books.key.clone(), s));
        }
        self.version.fetch_add(1, Ordering::SeqCst);
    }

    /// `trade` frames, sent at once.
    pub fn trades(&self, slug: &str, key: &BookKey, fills: &[Fill]) {
        if self.feed.receiver_count() == 0 {
            return;
        }
        for f in fills {
            let _ = self.feed.send(Arc::from(trade_json(slug, key, f).to_string()));
        }
    }

    /// The throttled part of the feed: `top` + `depth` frames of the series that changed since the last call.
    /// `mark` gives the series' mark (model clamped inside the book) when it can be priced.
    pub fn flush(&self, mark: &dyn Fn(&str, AccountKind, &str) -> Option<D>) {
        let dirty: Vec<(BookKey, String)> = std::mem::take(&mut *self.dirty.lock().unwrap()).into_iter().collect();
        if dirty.is_empty() || self.feed.receiver_count() == 0 {
            return;
        }
        for (key, s) in dirty {
            let Some(slug) = self.slug(key.tenant_id) else { continue };
            let v = self.view(&key, &s);
            for f in frames(&slug, &key, &s, v.as_ref(), mark(&slug, key.kind, &s)) {
                let _ = self.feed.send(Arc::from(f.to_string()));
            }
        }
    }

    /// Frames a new subscriber gets first: `depth` + `top` of every series of every book (optionally one
    /// tenant / kind).
    pub fn initial(&self, tenant: Option<&str>, kind: Option<AccountKind>, mark: &dyn Fn(&str, AccountKind, &str) -> Option<D>) -> Vec<Value> {
        let mut out = Vec::new();
        for key in self.keys() {
            let Some(slug) = self.slug(key.tenant_id) else { continue };
            if tenant.is_some_and(|t| t != slug) || kind.is_some_and(|k| k != key.kind) {
                continue;
            }
            for v in self.views(&key) {
                out.extend(frames(&slug, &key, &v.series, Some(&v), mark(&slug, key.kind, &v.series)));
            }
        }
        out
    }
}

pub fn trade_json(slug: &str, key: &BookKey, f: &Fill) -> Value {
    json!({
        "type": "trade", "tenant": slug, "kind": key.kind.as_str(), "underlying": key.underlying, "series": f.series,
        "fillId": f.id, "price": num(f.spec.price(f.px)), "qty": num(f.spec.contracts(f.qty)), "side": f.aggressor().as_str(),
        "tradeKind": f.kind.as_str(), "combo": f.combo, "at": chrono::DateTime::from_timestamp_millis(f.at), "seq": f.seq,
    })
}

/// `top` and `depth` frames of one series (a removed series sends an empty book).
pub fn frames(slug: &str, key: &BookKey, series: &str, v: Option<&SeriesView>, mark: Option<D>) -> Vec<Value> {
    let base = |t: &str| json!({"type": t, "tenant": slug, "kind": key.kind.as_str(), "underlying": key.underlying, "series": series});
    let mut top = base("top");
    let mut depth = base("depth");
    match v {
        Some(v) => {
            let t = v.top();
            for (k, x) in [
                ("bid", num_opt(t.bid.map(|b| b.0))),
                ("bidQty", num_opt(t.bid.map(|b| b.1))),
                ("ask", num_opt(t.ask.map(|a| a.0))),
                ("askQty", num_opt(t.ask.map(|a| a.1))),
                ("last", num_opt(v.last.map(|l| l.0))),
                ("lastQty", num_opt(v.last.map(|l| l.1))),
                ("mark", num_opt(mark)),
                ("oi", num(v.oi)),
                ("vol", num(v.vol)),
                ("state", json!(v.state.as_str())),
                ("seq", json!(v.seq)),
            ] {
                top[k] = x;
            }
            depth["bids"] = SeriesView::levels_json(&v.bids);
            depth["asks"] = SeriesView::levels_json(&v.asks);
            depth["seq"] = json!(v.seq);
        }
        None => {
            for k in ["bid", "bidQty", "ask", "askQty", "last", "lastQty", "mark"] {
                top[k] = Value::Null;
            }
            top["oi"] = json!(0);
            top["vol"] = json!(0);
            top["state"] = json!("closed");
            depth["bids"] = json!([]);
            depth["asks"] = json!([]);
        }
    }
    vec![depth, top]
}

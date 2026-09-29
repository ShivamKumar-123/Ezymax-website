//! In-memory market state: latest quote per symbol, the forming bar of every timeframe,
//! a broadcast channel for subscribers, and a 1-second flusher that persists bars and ticks.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::broadcast;

use crate::db::{self, Bar, Source};
use crate::depth::FeedDepth;
use crate::instruments::Catalogue;
use crate::spreads::Spreads;
use crate::timeframes::Tf;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Quote {
    pub bid: f64,
    pub ask: f64,
    pub last: f64,
    /// provider event time, ms since epoch
    pub t: i64,
    /// last depth (top-of-book) update, ms — 0 if this symbol has no book stream
    #[serde(skip)]
    pub book_t: i64,
    /// when this service received the update (ms, local clock) — lets clients measure our added latency
    #[serde(skip)]
    pub recv: i64,
}

#[derive(Clone, Debug)]
pub enum Event {
    Quote { symbol: String, quote: Quote },
    Bar { symbol: String, tf: Tf, bar: Bar },
}

#[derive(Default)]
struct Pending {
    bars: HashMap<(String, Tf), Bar>,
    ticks: Vec<(String, DateTime<Utc>, Option<f64>, Option<f64>, Option<f64>)>,
}

pub struct Market {
    pub cat: Catalogue,
    pub pool: PgPool,
    pub spreads: Spreads,
    quotes: RwLock<HashMap<String, Quote>>,
    /// provider depth (several priced levels) per symbol, when the feed carries it
    depth: RwLock<HashMap<String, FeedDepth>>,
    forming: RwLock<HashMap<(String, Tf), Bar>>,
    pending: Mutex<Pending>,
    pub tx: broadcast::Sender<Event>,
    pub store_ticks: bool,
    stats: Mutex<Stats>,
}

#[derive(Default, Clone, Serialize)]
pub struct Stats {
    pub ticks_total: u64,
    pub ticks_last_min: u64,
    pub connected_markets: HashSet<String>,
    pub last_tick_ms: HashMap<String, i64>,
}

impl Market {
    pub fn new(cat: Catalogue, pool: PgPool, spreads: Spreads, store_ticks: bool) -> Arc<Self> {
        let (tx, _) = broadcast::channel(8192);
        Arc::new(Self {
            cat,
            pool,
            spreads,
            quotes: RwLock::new(HashMap::new()),
            depth: RwLock::new(HashMap::new()),
            forming: RwLock::new(HashMap::new()),
            pending: Mutex::new(Pending::default()),
            tx,
            store_ticks,
            stats: Mutex::new(Stats::default()),
        })
    }

    pub fn quote(&self, symbol: &str) -> Option<Quote> {
        self.quotes.read().unwrap().get(symbol).copied()
    }

    pub fn feed_depth(&self, symbol: &str) -> Option<FeedDepth> {
        self.depth.read().unwrap().get(symbol).cloned()
    }

    /// Several priced levels from the provider's depth stream (raw prices, best first). The top of book still
    /// goes through `on_book`; this only keeps the ladder for the depth-of-market view.
    pub fn on_depth(&self, symbol: &str, bids: Vec<(f64, f64)>, asks: Vec<(f64, f64)>, t: i64) {
        let Some(inst) = self.cat.get(symbol) else { return };
        let clean = |v: Vec<(f64, f64)>| v.into_iter().filter(|(p, s)| *p > 0.0 && *s > 0.0 && p.is_finite() && s.is_finite()).map(|(p, s)| (inst.round(p), s)).take(crate::depth::MAX_LEVELS).collect::<Vec<_>>();
        let (bids, asks) = (clean(bids), clean(asks));
        if bids.len() < 2 || asks.len() < 2 {
            return;
        }
        self.depth.write().unwrap().insert(symbol.to_string(), FeedDepth { bids, asks, t });
    }

    pub fn forming(&self, symbol: &str, tf: Tf) -> Option<Bar> {
        self.forming.read().unwrap().get(&(symbol.to_string(), tf)).copied()
    }

    pub fn stats(&self) -> Stats {
        self.stats.lock().unwrap().clone()
    }

    pub fn set_connected(&self, market: &str, up: bool) {
        let mut s = self.stats.lock().unwrap();
        if up {
            s.connected_markets.insert(market.to_string());
        } else {
            s.connected_markets.remove(market);
        }
    }

    /// Seed a forming bar from the database (e.g. after restart or provider backfill of the current bar).
    pub fn seed_forming(&self, symbol: &str, tf: Tf, bar: Bar) {
        let mut f = self.forming.write().unwrap();
        let key = (symbol.to_string(), tf);
        match f.get_mut(&key) {
            Some(cur) if cur.t == bar.t => {
                cur.o = bar.o;
                cur.h = cur.h.max(bar.h);
                cur.l = cur.l.min(bar.l);
            }
            Some(cur) if cur.t > bar.t => {}
            _ => {
                f.insert(key, bar);
            }
        }
    }

    /// After a restart: restore every timeframe's latest bar and the last price from the database, so quotes,
    /// day stats and charts are right immediately — including while the market is closed (weekend close).
    pub async fn restore(&self) -> anyhow::Result<()> {
        for inst in &self.cat.list {
            for tf in Tf::ALL {
                if let Some(bar) = db::load_bars(&self.pool, &inst.symbol, tf.minutes(), None, None, 1).await?.pop() {
                    self.seed_forming(&inst.symbol, tf, bar);
                    if tf == Tf::M1 {
                        let half = inst.base_spread / 2.0;
                        let t = bar.t.timestamp_millis() + 59_999;
                        self.quotes.write().unwrap().entry(inst.symbol.clone()).or_insert(Quote {
                            bid: inst.round(bar.c - half),
                            ask: inst.round(bar.c + half),
                            last: inst.round(bar.c),
                            t,
                            book_t: 0,
                            recv: 0,
                        });
                    }
                }
            }
        }
        Ok(())
    }

    /// Top-of-book update from the provider depth stream.
    pub fn on_book(&self, symbol: &str, bid: f64, ask: f64, t: i64) {
        let Some(inst) = self.cat.get(symbol) else { return };
        let (bid, ask) = (inst.round(bid), inst.round(ask));
        if !inst.in_session(DateTime::<Utc>::from_timestamp_millis(t).unwrap_or_else(Utc::now)) {
            return;
        }
        let recv = Utc::now().timestamp_millis();
        let q = {
            let mut qs = self.quotes.write().unwrap();
            let e = qs.entry(symbol.to_string()).or_insert(Quote { bid: 0.0, ask: 0.0, last: inst.round((bid + ask) / 2.0), t, book_t: t, recv });
            e.book_t = t;
            if e.bid == bid && e.ask == ask {
                return; // same top of book (depth snapshots repeat it): nothing to push
            }
            e.bid = bid;
            e.ask = ask;
            e.t = e.t.max(t);
            e.recv = recv;
            *e
        };
        let _ = self.tx.send(Event::Quote { symbol: symbol.to_string(), quote: q });
    }

    /// Trade/price tick from the provider: updates the quote (if no book yet) and every timeframe's bar.
    pub fn on_trade(&self, symbol: &str, price: f64, volume: f64, t_ms: i64) {
        let Some(inst) = self.cat.get(symbol) else { return };
        let price = inst.round(price); // the provider can send more decimals than the symbol's digits
        let ts = DateTime::<Utc>::from_timestamp_millis(t_ms).unwrap_or_else(Utc::now);
        if !inst.in_session(ts) {
            return; // outside the trading session: quote stays at the last session price
        }
        let recv = Utc::now().timestamp_millis();
        let (q, quote_changed) = {
            let mut qs = self.quotes.write().unwrap();
            let half = inst.base_spread / 2.0;
            let e = qs.entry(symbol.to_string()).or_insert(Quote { bid: 0.0, ask: 0.0, last: 0.0, t: t_ms, book_t: 0, recv });
            let before = (e.bid, e.ask, e.last);
            e.last = price;
            // depth snapshots arrive far less often than trades: when the book is older than 1s, or a trade prints
            // outside it, re-centre bid/ask on the trade price keeping the book's spread width
            if t_ms - e.book_t > 1_000 || price < e.bid || price > e.ask {
                let half = if e.book_t > 0 && e.ask > e.bid { (e.ask - e.bid) / 2.0 } else { half };
                e.bid = inst.round(price - half);
                e.ask = inst.round(price + half);
            }
            e.t = e.t.max(t_ms);
            let changed = before != (e.bid, e.ask, e.last);
            if changed {
                e.recv = recv;
            }
            (*e, changed)
        };

        let mut changed = Vec::with_capacity(Tf::ALL.len());
        {
            let mut forming = self.forming.write().unwrap();
            let mut pending = self.pending.lock().unwrap();
            for tf in Tf::ALL {
                let start = tf.bucket(ts);
                let key = (symbol.to_string(), tf);
                let bar = match forming.get_mut(&key) {
                    Some(b) if b.t == start => {
                        b.h = b.h.max(price);
                        b.l = b.l.min(price);
                        b.c = price;
                        b.v += volume;
                        *b
                    }
                    Some(b) if b.t > start => continue, // late tick for an already-closed bar
                    _ => {
                        let nb = Bar { t: start, o: price, h: price, l: price, c: price, v: volume };
                        forming.insert(key.clone(), nb);
                        nb
                    }
                };
                pending.bars.insert(key, bar);
                changed.push((tf, bar));
            }
            if self.store_ticks {
                pending.ticks.push((symbol.to_string(), ts, Some(q.bid), Some(q.ask), Some(price)));
            }
        }
        {
            let mut s = self.stats.lock().unwrap();
            s.ticks_total += 1;
            s.ticks_last_min += 1;
            s.last_tick_ms.insert(symbol.to_string(), t_ms);
        }
        // quotes go out immediately on every change (no batching); unchanged prices only move the bars' volume
        if quote_changed {
            let _ = self.tx.send(Event::Quote { symbol: symbol.to_string(), quote: q });
        }
        for (tf, bar) in changed {
            let _ = self.tx.send(Event::Bar { symbol: symbol.to_string(), tf, bar });
        }
    }

    /// A closed `src` bar was corrected to the provider's final values: widen every higher timeframe's
    /// forming bar that contains it, so H1/H4/D1… keep the same extremes the provider has.
    pub fn absorb_closed(&self, symbol: &str, src: Tf, bar: Bar) {
        let mut changed = Vec::new();
        {
            let mut forming = self.forming.write().unwrap();
            let mut pending = self.pending.lock().unwrap();
            for tf in Tf::ALL.into_iter().filter(|t| *t > src) {
                let key = (symbol.to_string(), tf);
                let Some(b) = forming.get_mut(&key) else { continue };
                if b.t != tf.bucket(bar.t) || (bar.h <= b.h && bar.l >= b.l) {
                    continue;
                }
                b.h = b.h.max(bar.h);
                b.l = b.l.min(bar.l);
                pending.bars.insert(key, *b);
                changed.push((tf, *b));
            }
        }
        for (tf, bar) in changed {
            let _ = self.tx.send(Event::Bar { symbol: symbol.to_string(), tf, bar });
        }
    }

    /// Persist changed bars and archived ticks. Called every second.
    pub async fn flush(&self) -> anyhow::Result<()> {
        let (bars, ticks) = {
            let mut p = self.pending.lock().unwrap();
            (std::mem::take(&mut p.bars), std::mem::take(&mut p.ticks))
        };
        let rows: Vec<(String, i32, Bar)> = bars.into_iter().map(|((s, tf), b)| (s, tf.minutes(), b)).collect();
        db::upsert_bars(&self.pool, &rows, Source::Live).await?;
        db::insert_ticks(&self.pool, &ticks).await?;
        Ok(())
    }

    pub fn reset_minute_counter(&self) -> u64 {
        let mut s = self.stats.lock().unwrap();
        std::mem::take(&mut s.ticks_last_min)
    }
}

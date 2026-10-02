//! Order book types (docs/OPTIONS-EXCHANGE.md §1). Prices are integer ticks of the underlying's `premiumTick`,
//! quantities integer steps of its `contractStep`, so matching never touches decimals. Money (premium, USD rate,
//! reserves) is `Decimal` and only passes through.
//!
//! Everything here is plain data: `matching::apply` is the only code that changes an `UnderlyingBooks`.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::Arc;

use crate::model::{AccountKind, OptionTerms, Side};
use crate::money::D;

/// Price in premium ticks (quote currency per unit = ticks × `premiumTick`).
pub type Ticks = i64;
/// Quantity in contract steps (contracts = steps × `contractStep`).
pub type Steps = i64;

/// One book actor: (tenant, account kind, underlying). Demo and live never match; every tenant has its own book.
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct BookKey {
    pub tenant_id: i64,
    pub kind: AccountKind,
    pub underlying: String,
}

impl BookKey {
    pub fn new(tenant_id: i64, kind: AccountKind, underlying: &str) -> Self {
        BookKey { tenant_id, kind, underlying: underlying.to_string() }
    }
    /// `L` (live) / `D` (demo): part of fill ids.
    pub fn kind_char(&self) -> char {
        match self.kind {
            AccountKind::Live => 'L',
            AccountKind::Demo => 'D',
        }
    }
    pub fn label(&self) -> String {
        format!("{}/{}/{}", self.tenant_id, self.kind.as_str(), self.underlying)
    }
}

/// Time in force.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Tif {
    Gtc,
    /// Good till `expire_ms`.
    Gtd,
    Ioc,
    Fok,
}

impl Tif {
    pub fn as_str(self) -> &'static str {
        match self {
            Tif::Gtc => "gtc",
            Tif::Gtd => "gtd",
            Tif::Ioc => "ioc",
            Tif::Fok => "fok",
        }
    }
    pub fn parse(s: &str) -> Option<Tif> {
        Some(match s.trim().to_ascii_lowercase().as_str() {
            "gtc" | "" => Tif::Gtc,
            "gtd" => Tif::Gtd,
            "ioc" => Tif::Ioc,
            "fok" => Tif::Fok,
            _ => return None,
        })
    }
    /// Can an order of this tif rest in the book?
    pub fn rests(self) -> bool {
        matches!(self, Tif::Gtc | Tif::Gtd)
    }
}

/// Order flags.
pub const POST_ONLY: u8 = 1;
pub const REDUCE_ONLY: u8 = 2;
/// Market-maker quote: not persisted in `book_orders`, journaled in `book_quote_journal`, gone after a restart.
pub const EPHEMERAL: u8 = 4;
/// A liquidation order (docs §8): its fills print as `liquidation` on the tape. Matching treats it like any order.
pub const LIQUIDATION: u8 = 8;

pub fn flag_names(f: u8) -> Vec<&'static str> {
    let mut v = Vec::new();
    if f & POST_ONLY != 0 {
        v.push("post_only");
    }
    if f & REDUCE_ONLY != 0 {
        v.push("reduce_only");
    }
    if f & EPHEMERAL != 0 {
        v.push("ephemeral");
    }
    if f & LIQUIDATION != 0 {
        v.push("liquidation");
    }
    v
}

/// Facts the account shard stamps on an order at entry. The actor stores and returns them (fills carry the full
/// order) but never reads them: matching depends on price, time, side, quantity, flags and `stp` only.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct OrderExt {
    /// USD per contract (maker < 0 = rebate), stamped from the account's group at entry.
    pub fee_maker: D,
    pub fee_taker: D,
    /// Fee cap, % of the premium.
    pub fee_cap_pct: D,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_order_id: Option<String>,
    /// `client`, `stop`, `sl:<ticket>`, `tp:<ticket>`, `close:<ticket>`, `mm`.
    pub origin: String,
    /// Source tag (`manual`, `api`, …).
    pub source: String,
    /// Account currency of the reserve (`USD` / `USC`).
    pub ccy: String,
    /// Entry time (ms).
    pub created_ms: i64,
    /// Original order type (`limit` / `market`).
    pub kind: String,
    /// Steps of the order that opened new exposure at entry (limits, no-open rule).
    #[serde(default)]
    pub opening: Steps,
    /// Contracts per step (0 = 1): order history renders contracts without the series.
    #[serde(default)]
    pub step: D,
}

impl OrderExt {
    pub fn contracts(&self, steps: Steps) -> D {
        D::from(steps) * if self.step > D::ZERO { self.step } else { D::ONE }
    }
}

/// A working order in the book (and its last state in fills / removals).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Resting {
    /// The engine ticket (unique across the engine).
    pub id: i64,
    pub login: i64,
    /// Self-trade prevention key: the account owner's user id.
    pub stp: i64,
    pub side: Side,
    pub px: Ticks,
    /// Order quantity (after amends).
    pub qty: Steps,
    /// Still working.
    pub left: Steps,
    pub filled: Steps,
    /// Σ px × qty of its fills (ticks × steps): average price = notional / filled.
    pub notional: i64,
    /// Time priority (the seq of the command that placed it, or of the amend that lost priority).
    pub prio: u64,
    pub tif: Tif,
    pub flags: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expire_ms: Option<i64>,
    /// Account currency reserved per step (released pro rata on fills).
    pub reserve_per_step: D,
    pub ext: OrderExt,
}

impl Resting {
    pub fn post_only(&self) -> bool {
        self.flags & POST_ONLY != 0
    }
    pub fn reduce_only(&self) -> bool {
        self.flags & REDUCE_ONLY != 0
    }
    pub fn ephemeral(&self) -> bool {
        self.flags & EPHEMERAL != 0
    }
}

/// Contract and units of a series (stamped by the shard on the first order, fixed for the book's life).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SeriesSpec {
    pub terms: OptionTerms,
    /// Premium tick (quote currency per unit).
    pub tick: D,
    /// Contracts per step.
    pub step: D,
}

impl SeriesSpec {
    pub fn price(&self, px: Ticks) -> D {
        D::from(px) * self.tick
    }
    pub fn contracts(&self, q: Steps) -> D {
        D::from(q) * self.step
    }
    /// Same contract and units (a changed tick or step would change the meaning of resting prices).
    pub fn compatible(&self, o: &SeriesSpec) -> bool {
        self.tick == o.tick && self.step == o.step && self.terms.series == o.terms.series && self.terms.contract_size == o.terms.contract_size && self.terms.strike == o.terms.strike && self.terms.right == o.terms.right && self.terms.expiry_at == o.terms.expiry_at
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SeriesState {
    Open,
    /// Cancels (and amends that reduce) only.
    CancelOnly,
    /// Expired: nothing works any more.
    Closed,
}

impl SeriesState {
    pub fn as_str(self) -> &'static str {
        match self {
            SeriesState::Open => "open",
            SeriesState::CancelOnly => "cancel_only",
            SeriesState::Closed => "closed",
        }
    }
}

/// One series' book: price levels (FIFO per level), the orders, positions per login (book venue, steps, signed),
/// last trade and the day's volume.
#[derive(Clone, Debug, PartialEq)]
pub struct SeriesBook {
    pub series: String,
    pub spec: SeriesSpec,
    pub bids: BTreeMap<Reverse<Ticks>, VecDeque<i64>>,
    pub asks: BTreeMap<Ticks, VecDeque<i64>>,
    pub orders: BTreeMap<i64, Resting>,
    pub state: SeriesState,
    pub last: Option<(Ticks, Steps)>,
    /// (server day as days since 1970-01-01, steps traded that day).
    pub vol_day: (i64, Steps),
    pub pos: BTreeMap<i64, Steps>,
}

impl SeriesBook {
    pub fn new(series: &str, spec: SeriesSpec) -> Self {
        SeriesBook { series: series.to_string(), spec, bids: BTreeMap::new(), asks: BTreeMap::new(), orders: BTreeMap::new(), state: SeriesState::Open, last: None, vol_day: (0, 0), pos: BTreeMap::new() }
    }

    /// Rebuilds the levels from orders (price, then priority).
    pub fn from_parts(series: &str, spec: SeriesSpec, state: SeriesState, orders: Vec<Resting>, pos: BTreeMap<i64, Steps>, last: Option<(Ticks, Steps)>, vol_day: (i64, Steps)) -> Self {
        let mut b = SeriesBook { state, pos, last, vol_day, ..SeriesBook::new(series, spec) };
        let mut os = orders;
        os.sort_by_key(|o| (o.prio, o.id));
        for o in os {
            b.insert(o);
        }
        b
    }

    /// Appends an order at the back of its level.
    pub fn insert(&mut self, o: Resting) {
        match o.side {
            Side::Buy => self.bids.entry(Reverse(o.px)).or_default().push_back(o.id),
            Side::Sell => self.asks.entry(o.px).or_default().push_back(o.id),
        }
        self.orders.insert(o.id, o);
    }

    /// Removes an order from its level; returns it.
    pub fn remove(&mut self, id: i64) -> Option<Resting> {
        let o = self.orders.remove(&id)?;
        match o.side {
            Side::Buy => {
                if let Some(q) = self.bids.get_mut(&Reverse(o.px)) {
                    q.retain(|x| *x != id);
                    if q.is_empty() {
                        self.bids.remove(&Reverse(o.px));
                    }
                }
            }
            Side::Sell => {
                if let Some(q) = self.asks.get_mut(&o.px) {
                    q.retain(|x| *x != id);
                    if q.is_empty() {
                        self.asks.remove(&o.px);
                    }
                }
            }
        }
        Some(o)
    }

    pub fn best_bid(&self) -> Option<Ticks> {
        self.bids.keys().next().map(|r| r.0)
    }
    pub fn best_ask(&self) -> Option<Ticks> {
        self.asks.keys().next().copied()
    }

    /// Quantity (steps) resting at a price on a side.
    pub fn level_qty(&self, side: Side, px: Ticks) -> Steps {
        let ids = match side {
            Side::Buy => self.bids.get(&Reverse(px)),
            Side::Sell => self.asks.get(&px),
        };
        ids.map(|q| q.iter().filter_map(|id| self.orders.get(id)).map(|o| o.left).sum()).unwrap_or(0)
    }

    /// Up to `n` levels per side: (price, qty, orders).
    pub fn depth(&self, n: usize) -> (Vec<(Ticks, Steps, usize)>, Vec<(Ticks, Steps, usize)>) {
        let lv = |ids: &VecDeque<i64>| (ids.iter().filter_map(|id| self.orders.get(id)).map(|o| o.left).sum::<Steps>(), ids.len());
        let bids = self.bids.iter().take(n).map(|(p, ids)| (p.0, lv(ids).0, lv(ids).1)).collect();
        let asks = self.asks.iter().take(n).map(|(p, ids)| (*p, lv(ids).0, lv(ids).1)).collect();
        (bids, asks)
    }

    /// Open interest: Σ long positions (steps).
    pub fn oi(&self) -> Steps {
        self.pos.values().filter(|v| **v > 0).sum()
    }

    pub fn position(&self, login: i64) -> Steps {
        self.pos.get(&login).copied().unwrap_or(0)
    }
}

/// Everything one actor owns: the books of every series of one underlying (copy-on-write per series, so a
/// batch can be rolled back by dropping its working copy).
#[derive(Clone, Debug)]
pub struct UnderlyingBooks {
    pub key: BookKey,
    /// Last command sequence number.
    pub seq: u64,
    pub series: BTreeMap<String, Arc<SeriesBook>>,
    /// Firm combo-RFQ quotes by quote id (docs §5): registered by `RfqQuote`, consumed by `RfqAccept`, pruned once
    /// past their validity, gone after a restart (like market-maker quotes).
    pub rfqs: BTreeMap<i64, RfqQuoteIn>,
}

impl UnderlyingBooks {
    pub fn new(key: BookKey) -> Self {
        UnderlyingBooks { key, seq: 0, series: BTreeMap::new(), rfqs: BTreeMap::new() }
    }
    pub fn book(&self, series: &str) -> Option<&SeriesBook> {
        self.series.get(series).map(|b| b.as_ref())
    }
    /// Every resting order of `login` (series, id).
    pub fn orders_of(&self, login: i64) -> Vec<(String, i64)> {
        let mut v = Vec::new();
        for (s, b) in &self.series {
            for o in b.orders.values().filter(|o| o.login == login) {
                v.push((s.clone(), o.id));
            }
        }
        v
    }
    /// Order ids due for GTD expiry at `now_ms`.
    pub fn due_expiry(&self, now_ms: i64) -> bool {
        self.series.values().any(|b| b.orders.values().any(|o| o.expire_ms.is_some_and(|e| e <= now_ms)))
    }
    /// Expiry dates with a series not closed yet.
    pub fn open_expiries(&self) -> BTreeSet<NaiveDate> {
        self.series.values().filter(|b| b.state != SeriesState::Closed).map(|b| b.spec.terms.expiry).collect()
    }
    pub fn resting(&self) -> usize {
        self.series.values().map(|b| b.orders.len()).sum()
    }
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

/// One market-maker quote side (mass quote).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct QuoteIn {
    pub series: String,
    pub spec: SeriesSpec,
    pub id: i64,
    pub side: Side,
    pub px: Ticks,
    pub qty: Steps,
    pub reserve_per_step: D,
    pub ext: OrderExt,
}

/// One leg of a combo RFQ: the strategy as built (`side`, whole `ratio`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RfqLeg {
    pub series: String,
    pub spec: SeriesSpec,
    pub side: Side,
    pub ratio: i64,
}

/// A firm quote on a combo RFQ (docs §5): net per combo unit in ticks (`bid` = the responder buys the strategy as
/// built, `ask` = it sells it), the legs' theoretical prices in ticks (the leg-price split), valid until
/// `valid_until` (ms). `qty` = combo units in steps; every leg trades `ratio × qty` steps.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RfqQuoteIn {
    pub rfq: i64,
    pub quote: i64,
    /// The requesting account (only it may accept) and its owner (self-trade prevention).
    pub requester: i64,
    pub requester_stp: i64,
    /// The responder (maker of every leg).
    pub login: i64,
    pub stp: i64,
    pub legs: Vec<RfqLeg>,
    pub qty: Steps,
    #[serde(default)]
    pub reduce_only: bool,
    pub bid: Option<Ticks>,
    pub ask: Option<Ticks>,
    pub theos: Vec<Ticks>,
    pub valid_until: i64,
    pub usd_per_quote: D,
}

/// The legs' net per combo unit (ticks) for leg prices `px` (the strategy as built: buy legs +, sell legs −).
pub fn rfq_net(legs: &[RfqLeg], px: &[Ticks]) -> i64 {
    legs.iter().zip(px).map(|(l, p)| if l.side == Side::Buy { l.ratio * p } else { -l.ratio * p }).sum()
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HaltScope {
    All,
    Series(String),
    Expiry(NaiveDate),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HaltMode {
    /// Cancel every resting order in scope and accept cancels only.
    Halt,
    /// Keep resting orders, accept cancels only.
    CancelOnly,
    /// Back to open.
    Resume,
}

/// Every input of the book. Time always comes in the command (`at`, Unix ms): `matching::apply` has no clock.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Cmd {
    /// A new order (limit / market-as-IOC / stop that fired). `usd_per_quote` prices the fills it takes.
    New { series: String, spec: SeriesSpec, order: Resting, usd_per_quote: D, at: i64 },
    Cancel { series: String, id: i64, login: i64, reason: String, at: i64 },
    /// Every order of `login` (optionally one series / one expiry; `ephemeral_only` = its MM quotes only).
    CancelAll {
        login: i64,
        #[serde(default)]
        series: Option<String>,
        #[serde(default)]
        expiry: Option<NaiveDate>,
        #[serde(default)]
        ephemeral_only: bool,
        reason: String,
        at: i64,
    },
    /// New total quantity and / or price. Reducing qty keeps priority; a price change or an increase loses it.
    Amend { series: String, id: i64, login: i64, px: Option<Ticks>, qty: Option<Steps>, reserve_per_step: D, token: u64, usd_per_quote: D, at: i64 },
    /// Market-maker quotes: replaces `login`'s ephemeral quotes in `series` with `quotes` (post-only, ephemeral).
    MassQuote { login: i64, stp: i64, series: Vec<String>, quotes: Vec<QuoteIn>, at: i64 },
    /// Combo RFQ (docs §5): a responder's firm quote (replaces its earlier quote on the same RFQ).
    RfqQuote { quote: RfqQuoteIn, at: i64 },
    /// The requester accepts a quote: every leg fills at once (one journal entry) or nothing does. `side` = buy
    /// the strategy as built (at the ask) or sell it (at the bid); `orders` = the requester's leg orders (its
    /// reservations), one per leg in leg order, each on the side it trades.
    RfqAccept { rfq: i64, quote: i64, login: i64, stp: i64, side: Side, limit_net: Ticks, orders: Vec<Resting>, at: i64 },
    /// A fill busted by the desk (four-eyes): the positions it moved move back. The accounts reverse it too.
    Bust { fill: Fill, reason: String, at: i64 },
    /// Liquidation backstop (docs §8): `login` (liquidated, reduce-only) trades `qty` at `px` against `counterparty`.
    Backstop { series: String, spec: SeriesSpec, login: i64, stp: i64, side: Side, qty: Steps, px: Ticks, counterparty: i64, counter_stp: i64, usd_per_quote: D, at: i64 },
    Halt { scope: HaltScope, mode: HaltMode, reason: String, at: i64 },
    /// Session open (weekend gap): cancel resting buys above `hi` / sells below `lo` per series.
    OpenCheck { bands: BTreeMap<String, (Ticks, Ticks)>, at: i64 },
    /// Cut − closeOnlyMinutes: cancel every order of the expiry and close its series; `purge` (after settlement)
    /// also drops the series' positions.
    Expire { expiry: NaiveDate, purge: bool, at: i64 },
    /// Novation: book positions for `entries` (login, signed steps; Σ = 0).
    Seed { series: String, spec: SeriesSpec, entries: Vec<(i64, Steps)>, at: i64 },
    /// GTD expiry.
    Timer { at: i64 },
    /// Start-up: ephemeral (MM) orders did not survive the restart.
    RestartCancel { at: i64 },
}

impl Cmd {
    pub fn kind(&self) -> &'static str {
        match self {
            Cmd::New { .. } => "new",
            Cmd::Cancel { .. } => "cancel",
            Cmd::CancelAll { .. } => "cancel_all",
            Cmd::Amend { .. } => "amend",
            Cmd::MassQuote { .. } => "mass_quote",
            Cmd::RfqQuote { .. } => "rfq_quote",
            Cmd::RfqAccept { .. } => "rfq_accept",
            Cmd::Bust { .. } => "bust",
            Cmd::Backstop { .. } => "backstop",
            Cmd::Halt { .. } => "halt",
            Cmd::OpenCheck { .. } => "open_check",
            Cmd::Expire { .. } => "expire",
            Cmd::Seed { .. } => "seed",
            Cmd::Timer { .. } => "timer",
            Cmd::RestartCancel { .. } => "restart_cancel",
        }
    }
    pub fn at(&self) -> i64 {
        match self {
            Cmd::New { at, .. }
            | Cmd::Cancel { at, .. }
            | Cmd::CancelAll { at, .. }
            | Cmd::Amend { at, .. }
            | Cmd::MassQuote { at, .. }
            | Cmd::RfqQuote { at, .. }
            | Cmd::RfqAccept { at, .. }
            | Cmd::Bust { at, .. }
            | Cmd::Backstop { at, .. }
            | Cmd::Halt { at, .. }
            | Cmd::OpenCheck { at, .. }
            | Cmd::Expire { at, .. }
            | Cmd::Seed { at, .. }
            | Cmd::Timer { at }
            | Cmd::RestartCancel { at } => *at,
        }
    }
    /// Ephemeral commands go to `book_quote_journal` instead of `book_journal`.
    pub fn ephemeral(&self) -> bool {
        matches!(self, Cmd::MassQuote { .. })
    }
    /// (login, order id, client order id) for the journal's lookup columns.
    pub fn order_ref(&self) -> (Option<i64>, Option<i64>, Option<String>) {
        match self {
            Cmd::New { order, .. } => (Some(order.login), Some(order.id), order.ext.client_order_id.clone()),
            Cmd::Cancel { id, login, .. } | Cmd::Amend { id, login, .. } => (Some(*login), Some(*id), None),
            Cmd::CancelAll { login, .. } | Cmd::MassQuote { login, .. } | Cmd::Backstop { login, .. } | Cmd::RfqAccept { login, .. } => (Some(*login), None, None),
            Cmd::RfqQuote { quote, .. } => (Some(quote.login), None, None),
            _ => (None, None, None),
        }
    }
}

/* ------------------------------------------------------------------ */
/* Outputs                                                             */
/* ------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FillKind {
    Book,
    Rfq,
    Liquidation,
    Backstop,
    Novation,
}

impl FillKind {
    pub fn as_str(self) -> &'static str {
        match self {
            FillKind::Book => "book",
            FillKind::Rfq => "rfq",
            FillKind::Liquidation => "liquidation",
            FillKind::Backstop => "backstop",
            FillKind::Novation => "novation",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Maker,
    Taker,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Role::Maker => "maker",
            Role::Taker => "taker",
        }
    }
}

/// One side of a fill: the account, its direction, and the full order state before this fill (None for
/// fills without an order: backstop counterparty, liquidated account).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Party {
    pub login: i64,
    pub stp: i64,
    pub side: Side,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<Resting>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Fill {
    /// `{UNDERLYING}.{L|D}{seq}.{n}`: unique per tenant, part of the ledger keys `fill:{id}:{login}:prem|fee|rebate`.
    pub id: String,
    pub seq: u64,
    pub series: String,
    /// Trade price (the resting order's).
    pub px: Ticks,
    pub qty: Steps,
    pub maker: Party,
    pub taker: Party,
    pub kind: FillKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub combo: Option<i64>,
    pub usd_per_quote: D,
    /// px × tick × qty × step × contractSize × usdPerQuote, rounded once to cents: what the buyer pays and the
    /// seller receives through the clearing account.
    pub premium_usd: D,
    pub at: i64,
    pub spec: SeriesSpec,
}

impl Fill {
    pub fn party(&self, role: Role) -> &Party {
        match role {
            Role::Maker => &self.maker,
            Role::Taker => &self.taker,
        }
    }
    /// The buyer's side of the trade print (the aggressor is the taker).
    pub fn aggressor(&self) -> Side {
        self.taker.side
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DoneStatus {
    Filled,
    Cancelled,
    Expired,
    Rejected,
    /// A market-maker quote replaced by a newer one.
    Replaced,
}

impl DoneStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            DoneStatus::Filled => "filled",
            DoneStatus::Cancelled => "cancelled",
            DoneStatus::Expired => "expired",
            DoneStatus::Rejected => "rejected",
            DoneStatus::Replaced => "replaced",
        }
    }
}

/// An order left the book (or never entered it): the shard releases what it still reserves.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Done {
    pub id: i64,
    pub login: i64,
    pub series: String,
    pub status: DoneStatus,
    pub reason: String,
    /// Final state.
    pub order: Resting,
}

/// An amend took effect: the shard updates its working order and drops the amend's extra hold (`token`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Amended {
    pub id: i64,
    pub login: i64,
    pub series: String,
    pub px: Ticks,
    pub qty: Steps,
    pub left: Steps,
    pub reserve_per_step: D,
    pub token: u64,
}

/// What one command did.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Out {
    pub seq: u64,
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fills: Vec<Fill>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub done: Vec<Done>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub amended: Vec<Amended>,
    /// Orders now resting because of this command.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rested: Vec<i64>,
    /// Series whose book, state or positions changed.
    #[serde(default, skip_serializing_if = "BTreeSet::is_empty")]
    pub touched: BTreeSet<String>,
    /// Fills busted by this command (the accounts reverse them).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub busted: Vec<Fill>,
}

impl Out {
    pub fn reject(seq: u64, code: &str, message: impl Into<String>) -> Out {
        Out { seq, ok: false, code: Some(code.to_string()), message: Some(message.into()), ..Default::default() }
    }
}

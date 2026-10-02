//! The options order book on the account side (pure: reads `Env`, changes the account through `Tx`;
//! docs/OPTIONS-EXCHANGE.md §1–§3).
//!
//! * `enter`: the gates of a new book order (module, client, account, session — the no-open rule applies to the
//!   opening quantity only and liquidity providers are exempt until cut − 1 min —, contract limits including
//!   working opening quantity, tick, price band, the closing / opening split), then the reservation (§3), kept in
//!   `AccountState.book` (in memory; `tx.book_dirty`). Returns the `Cmd::New` for the book actor.
//! * `apply_fill`: books one side of a fill and never refuses (the money was reserved). Idempotent per
//!   (fill, role). Premium through the expiry's clearing account (`house:options_clearing.{U}.{YYYYMMDD}:USD`,
//!   cent accounts via `house:fx`), the fee / rebate, FIFO netting against the account's book positions in the
//!   series, the rest opens or adds to one netted book position; then the pro-rata release and the margin check.
//! * `apply_done` / `apply_amended` / `release_hold`: removals and amends.
//! * Stops (`stop_market` / `stop_limit`, trigger on the mark or the underlying) are account `Order`s; when one
//!   fires it goes through `enter` and is sent to its book after the commit (`tx.book_send`). Premium SL / TP of
//!   a book position becomes a reduce-only market order on the mark.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use std::collections::BTreeMap;

use super::options::{self as eopt, fallback_margin, free_cash, mark_of, snapshot};
use super::trade::gate;
use super::{Env, Reject, Tx, metrics, risk};
use crate::book::reserve::{self, Working, fill_key};
use crate::book::types::*;
use crate::book::{BookKey, Outgoing};
use crate::model::{
    Account, AccountKind, Book, BookStop, Deal, DealEntry, DealOption, DealReason, Expiry, FillRef, LedgerTxn, OptLeg, OptRight, OptionOrder, OptionTerms, Order, OrderStatus, OrderType, Position, Posting, RouteEvent, Side, Source,
    StopSource, Trigger, TriggerOp, TxnKind, Venue, acct_code, house_code,
};
use crate::money::{D, HUNDRED, ONE, ZERO, num, r2, rdp};
use crate::options::snapshot::{OptSnapshot, Underlying};
use crate::options::{ScenLeg, TradeState, dec, f};
use crate::state::Event;

/// Working orders per series and per account (docs §2).
pub const MAX_PER_SERIES: usize = 50;
pub const MAX_PER_ACCOUNT: usize = 200;

fn rej(code: &'static str, message: impl Into<String>) -> Reject {
    Reject::new(code, message)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReqKind {
    Limit,
    /// An IOC limit at the band, stamped here.
    Market,
}

/// A book order request (terminal, stops, closes, SL / TP, market maker).
#[derive(Clone, Debug)]
pub struct BookReq {
    pub series: String,
    pub side: Side,
    pub kind: ReqKind,
    /// Contracts.
    pub qty: D,
    /// Premium per unit (limit).
    pub price: Option<D>,
    pub tif: Tif,
    pub expire_at: Option<DateTime<Utc>>,
    pub post_only: bool,
    pub reduce_only: bool,
    pub client_order_id: Option<String>,
    pub source: Source,
    /// Suitability confirmed (the client accepted the options intro; needed to open, live and demo).
    pub eligible: bool,
    /// Open option contracts (long, short) on the client's other accounts.
    pub others: (D, D),
    /// `client`, `stop`, `sl:<ticket>`, `tp:<ticket>`, `close:<ticket>`, `mm`.
    pub origin: String,
    /// Pre-assigned id (a fired stop keeps its ticket so the book recognises a resubmission).
    pub id: Option<i64>,
    /// Liquidity-provider account (no-open exemption until cut − 1 min).
    pub lp: bool,
    /// Ephemeral market-maker quote.
    pub ephemeral: bool,
}

impl BookReq {
    pub fn limit(series: &str, side: Side, qty: D, price: D) -> Self {
        BookReq {
            series: series.into(),
            side,
            kind: ReqKind::Limit,
            qty,
            price: Some(price),
            tif: Tif::Gtc,
            expire_at: None,
            post_only: false,
            reduce_only: false,
            client_order_id: None,
            source: Source::Manual,
            eligible: true,
            others: (ZERO, ZERO),
            origin: "client".into(),
            id: None,
            lp: false,
            ephemeral: false,
        }
    }
    pub fn market(series: &str, side: Side, qty: D) -> Self {
        BookReq { kind: ReqKind::Market, price: None, tif: Tif::Ioc, ..Self::limit(series, side, qty, ZERO) }
    }
}

#[derive(Clone, Debug)]
pub enum Entered {
    New { key: BookKey, cmd: Cmd, id: i64 },
    /// Same clientOrderId as an earlier order.
    Duplicate { key: Option<BookKey>, id: i64 },
}

impl Entered {
    pub fn id(&self) -> i64 {
        match self {
            Entered::New { id, .. } | Entered::Duplicate { id, .. } => *id,
        }
    }
}

/* ------------------------------------------------------------------ */
/* Series facts                                                        */
/* ------------------------------------------------------------------ */

/// The contract of a listed vanilla series from the snapshot.
pub fn terms_of(snap: &OptSnapshot, series: &str) -> Result<(OptionTerms, Underlying), Reject> {
    let s = snap.series.get(series.trim()).ok_or_else(|| rej("unknown_series", format!("Unknown option series {series}")))?;
    let e = snap.expiry_by_id(s.expiry_id).ok_or_else(|| rej("unknown_series", format!("Unknown expiry of {}", s.code)))?;
    let u = snap.underlying(&s.symbol).ok_or_else(|| rej("options_disabled", format!("{} options are not available", s.symbol)))?;
    let right = OptRight::parse(&s.kind).ok_or_else(|| rej("unknown_series", format!("Unknown option type {}", s.kind)))?;
    let terms = OptionTerms { series: s.code.clone(), underlying: s.symbol.clone(), right, strike: dec(s.strike), expiry: e.expiry_date, expiry_at: e.cut_at, contract_size: dec(u.contract_size), quote_ccy: u.quote_ccy.clone(), barrier: None };
    Ok((terms, u.clone()))
}

/// (tick, step) of an underlying.
pub fn units(u: &Underlying) -> (D, D) {
    let tick = dec(u.tick());
    let step = dec(u.contract_step);
    (tick, if step > ZERO { step } else { ONE })
}

/// `x / unit` when it is a whole number ≥ 1.
pub fn whole(x: D, unit: D) -> Option<i64> {
    if unit <= ZERO || x <= ZERO {
        return None;
    }
    let q = x / unit;
    if !q.fract().is_zero() {
        return None;
    }
    rust_decimal::prelude::ToPrimitive::to_i64(&q).filter(|v| *v >= 1)
}

fn floor_ticks(x: D, tick: D) -> i64 {
    rust_decimal::prelude::ToPrimitive::to_i64(&(x / tick).floor()).unwrap_or(0)
}

fn ceil_ticks(x: D, tick: D) -> i64 {
    rust_decimal::prelude::ToPrimitive::to_i64(&(x / tick).ceil()).unwrap_or(i64::MAX / 4)
}

/// Aggressive-limit band in ticks around the mark: (lowest sell, highest buy). A buy must be ≤
/// mark × (1 + limitBandPct) + bandMinTicks, a sell ≥ the mirror (at least 1 tick).
pub fn limit_band(mark: D, tick: D, u: &Underlying) -> (Ticks, Ticks) {
    let pct = dec(u.limit_band()) / HUNDRED;
    let k = u.band_ticks();
    let hi = floor_ticks(mark * (ONE + pct), tick) + k;
    let lo = (ceil_ticks(mark * (ONE - pct).max(ZERO), tick) - k).max(1);
    (lo, hi)
}

/// The IOC limit a market order becomes: buy max(mark × (1 + marketBandPct), mark + bandMinTicks), sell mirrored
/// (at least 1 tick). See the README for why this is max(), not min().
pub fn market_px(mark: D, tick: D, u: &Underlying, side: Side) -> Ticks {
    let pct = dec(u.market_band()) / HUNDRED;
    let k = u.band_ticks();
    match side {
        Side::Buy => ceil_ticks(mark * (ONE + pct), tick).max(ceil_ticks(mark, tick) + k),
        Side::Sell => floor_ticks(mark * (ONE - pct).max(ZERO), tick).min(floor_ticks(mark, tick) - k).max(1),
    }
}

/// Net book position (contracts, signed) of the account in a series.
pub fn book_net(st: &crate::state::AccountState, series: &str) -> D {
    st.positions.values().filter(|p| p.on_book() && p.symbol == series && p.option.as_ref().is_some_and(|t| t.barrier.is_none())).map(|p| p.volume * p.side.sign()).sum()
}

/// The clearing account of an expiry (`house:options_clearing.{UNDERLYING}.{YYYYMMDD}`, USD).
pub fn clearing_name(t: &OptionTerms) -> String {
    format!("options_clearing.{}.{}", t.underlying, t.expiry.format("%Y%m%d"))
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

/// Gates, price, reservation; stores the working order. The caller sends the returned command to the book.
pub fn enter(tx: &mut Tx, env: &Env, req: BookReq) -> Result<Entered, Reject> {
    if let Some(c) = &req.client_order_id {
        if c.is_empty() || c.len() > 64 {
            return Err(rej("invalid_client_order_id", "clientOrderId must be 1–64 characters"));
        }
        if let Some(id) = tx.st.book.client_ids.get(c) {
            return Ok(Entered::Duplicate { key: None, id: *id });
        }
    }
    let acc = tx.st.account.clone();
    let snap = snapshot(env)?;
    let (terms, u) = terms_of(&snap, &req.series)?;
    if snap.series.get(&terms.series).is_some_and(|s| s.status != "active") {
        return Err(rej("series_halted", format!("{} is not open for trading", terms.series)));
    }
    let (tick, step) = units(&u);
    if tick <= ZERO {
        return Err(rej("options_disabled", format!("{} has no premium tick", u.symbol)));
    }
    eopt::contracts_gate(&u, req.qty)?;
    let steps = whole(req.qty, step).ok_or_else(|| rej("invalid_volume", format!("Contracts must be a multiple of {}", step.normalize())))?;
    if req.post_only && (req.kind == ReqKind::Market || !req.tif.rests()) {
        return Err(rej("invalid_order", "Post-only orders must be GTC / GTD limit orders"));
    }
    if req.tif == Tif::Gtd && req.expire_at.is_none_or(|e| e <= env.now) {
        return Err(rej("invalid_expiry", "Give a future expireAt for a GTD order"));
    }
    // closing / opening split against the book position and the working orders on the same side
    let net = book_net(&tx.st, &terms.series);
    let working_same = D::from(tx.st.book.working(&terms.series, req.side)) * step;
    let reducible = match req.side {
        Side::Sell => net.max(ZERO),
        Side::Buy => (-net).max(ZERO),
    };
    if req.reduce_only && reducible <= ZERO {
        return Err(rej("reduce_only", format!("There is no {} position in {} to reduce", if req.side == Side::Sell { "long" } else { "short" }, terms.series)));
    }
    let closing = req.qty.min((reducible - working_same).max(ZERO));
    let opening_c = if req.reduce_only { ZERO } else { req.qty - closing };
    let opening = whole(opening_c, step).unwrap_or(0);
    let opens = opening > 0;
    // gates
    eopt::module_gate(env, &tx.st, &snap, &u.symbol)?;
    eopt::client_gate(env, &tx.st, &snap, opens)?;
    gate(env, &tx.st, &u.symbol, opens, ZERO, None)?;
    if opens && !req.eligible {
        return Err(rej("not_eligible", eopt::NOT_ELIGIBLE));
    }
    if opens && env.options.stale(env.now) {
        return Err(rej("stale_prices", "Option prices are stale: you can only close positions until they are back"));
    }
    let q = env.options.price(&env.tenant.slug, &env.group.code, &terms, env.now).map_err(|_| rej("no_price", format!("There is no price for {} right now", terms.series)))?;
    if let Some(spec) = env.specs.get(&u.symbol)
        && !spec.is_open(env.now)
    {
        return Err(rej("market_closed", format!("The {} market is closed", u.symbol)));
    }
    let close_only_min = u.close_only_minutes.max(0) as i64;
    let no_open_min = u.no_open_minutes.max(0) as i64;
    if q.state == TradeState::Closed || env.now >= terms.expiry_at - chrono::Duration::minutes(close_only_min) {
        return Err(rej("cutoff", format!("Trading in {} has ended (expiry cut {})", terms.series, terms.expiry_at.format("%Y-%m-%d %H:%M UTC"))));
    }
    let key_e = terms.expiry_key();
    if q.state == TradeState::Halted {
        let why = snap.control_reason(&env.tenant.slug, &u.symbol, &key_e, Some(&terms.series), "halt", env.now).map(|r| format!(": {r}")).unwrap_or_default();
        return Err(rej("series_halted", format!("{} is halted{why}", terms.series)));
    }
    if opens {
        let control_close_only = snap.control_reason(&env.tenant.slug, &u.symbol, &key_e, Some(&terms.series), "close_only", env.now).is_some()
            || snap.controls.iter().any(|c| c.mode == "close_only" && c.active && c.expires_at.is_none_or(|e| e > env.now) && (c.tenant == "*" || c.tenant == env.tenant.slug) && match c.scope.as_str() {
                "all" => true,
                "underlying" => c.target == u.symbol,
                "expiry" => c.target == key_e,
                "series" => c.target == terms.series,
                _ => false,
            });
        if control_close_only {
            return Err(rej("close_only", format!("{} is close-only", terms.series)));
        }
        let lp_until = terms.expiry_at - chrono::Duration::minutes(1);
        let in_window = env.now >= terms.expiry_at - chrono::Duration::minutes(no_open_min);
        if in_window && !(req.lp && env.now < lp_until) {
            return Err(rej("cutoff", format!("No new positions in the last {no_open_min} minutes before the cut ({})", terms.expiry_at.format("%H:%M UTC"))));
        }
        if env.max_quote_age_ms > 0 && q.spot_ms > 0 && env.now.timestamp_millis() - q.spot_ms > env.max_quote_age_ms {
            return Err(rej("stale_prices", "The underlying price is stale: options trading is paused"));
        }
    }
    if tx.st.book.count_series(&terms.series) >= MAX_PER_SERIES {
        return Err(rej("too_many_orders", format!("At most {MAX_PER_SERIES} working orders per series")));
    }
    // market-maker quotes (ephemeral, replaced per series) are not counted against the per-account cap: the MM
    // quotes the full chain both sides
    if !req.ephemeral && tx.st.book.orders.values().filter(|w| w.flags & EPHEMERAL == 0).count() >= MAX_PER_ACCOUNT {
        return Err(rej("too_many_orders", format!("At most {MAX_PER_ACCOUNT} working book orders per account")));
    }
    // per-client contract limits, counting working opening quantity as if filled
    if opens {
        let (mut long, mut short) = req.others;
        for p in tx.st.positions.values().filter(|p| p.option.is_some()) {
            if p.side == Side::Buy { long += p.volume } else { short += p.volume }
        }
        let (wl, ws) = tx.st.book.opening_contracts();
        let add = D::from(opening) * step;
        let gs = snap.group(&env.tenant.slug, &env.group.code, &u.symbol);
        let cl = snap.client_limit(&env.tenant.slug, acc.user_id);
        let mut max_total = dec(gs.max_contracts_per_client).max(ZERO);
        if let Some(m) = cl.and_then(|l| l.max_contracts).map(dec).filter(|m| *m >= ZERO) {
            max_total = if max_total > ZERO { max_total.min(m) } else { m };
        }
        let total = long + short + wl + ws + add;
        if (max_total > ZERO || cl.and_then(|l| l.max_contracts).is_some()) && total > max_total {
            return Err(rej("limit_contracts", format!("Your options limit is {} open contracts (you hold {}, working {})", max_total.normalize(), (long + short).normalize(), (wl + ws).normalize())));
        }
        if req.side == Side::Sell
            && let Some(ms) = cl.and_then(|l| l.max_short_contracts).map(dec)
            && short + ws + add > ms
        {
            return Err(rej("limit_contracts", format!("Your limit for sold options is {} contracts (you have sold {})", ms.normalize(), short.normalize())));
        }
    }
    // price: tick, band (aggressive side), market = IOC at the band
    let mark = mark_of(env, &acc, &terms).map(|m| m.mark).filter(|m| *m > ZERO);
    let (px, tif) = match req.kind {
        ReqKind::Market => {
            let m = mark.ok_or_else(|| rej("no_price", format!("There is no mark for {} right now", terms.series)))?;
            (market_px(m, tick, &u, req.side), Tif::Ioc)
        }
        ReqKind::Limit => {
            let price = req.price.filter(|p| *p > ZERO).ok_or_else(|| rej("invalid_price", "Enter a limit price above 0"))?;
            let px = whole(price, tick).ok_or_else(|| rej("invalid_price", format!("The price must be a multiple of the premium tick {}", tick.normalize())))?;
            let m = mark.ok_or_else(|| rej("no_price", format!("There is no mark for {} right now", terms.series)))?;
            let (lo, hi) = limit_band(m, tick, &u);
            if (req.side == Side::Buy && px > hi) || (req.side == Side::Sell && px < lo) {
                let bound = if req.side == Side::Buy { D::from(hi) * tick } else { D::from(lo) * tick };
                return Err(rej("price_out_of_band", format!("A {} at {} is too far from the mark {} (limit {})", req.side.as_str(), price.normalize(), m.normalize(), bound.normalize())));
            }
            (px, req.tif)
        }
    };
    let price = D::from(px) * tick;
    let usdq = eopt::usd_per_quote(env, &acc, &terms.quote_ccy).ok_or_else(|| rej("stale_prices", format!("There is no USD rate for {} right now", terms.quote_ccy)))?;
    // fees stamped now (maker < 0 = rebate)
    let gs = snap.group(&env.tenant.slug, &env.group.code, &u.symbol);
    let (maker, taker) = gs.book_fees();
    let (fee_maker, fee_taker) = (dec(maker), dec(taker));
    let fee_wc = fee_maker.max(fee_taker).max(ZERO);
    let factor = acc.usd_factor();
    // reserve (§3)
    let rps = match req.side {
        Side::Buy => reserve::buy_per_step(price, step, terms.contract_size, usdq, terms.quote_ccy == "USD", factor, fee_wc),
        Side::Sell => {
            let margin = if opening > 0 { opening_margin(env, &acc, &terms, &u, D::from(opening) * step) } else { ZERO };
            reserve::sell_per_step(steps, step, factor, fee_wc, margin)
        }
    };
    let id = req.id.unwrap_or_else(|| env.ids.ticket());
    if tx.st.book.orders.contains_key(&id) {
        return Ok(Entered::Duplicate { key: None, id });
    }
    let m0 = metrics(env, &tx.st);
    let before = tx.st.book.series_reserve(&terms.series);
    let mut flags = 0u8;
    if req.post_only {
        flags |= POST_ONLY;
    }
    if req.reduce_only {
        flags |= REDUCE_ONLY;
    }
    if req.ephemeral {
        flags |= EPHEMERAL | POST_ONLY;
    }
    let ext = OrderExt {
        fee_maker,
        fee_taker,
        fee_cap_pct: dec(gs.commission_cap_pct.max(0.0)),
        client_order_id: req.client_order_id.clone(),
        origin: req.origin.clone(),
        source: req.source.as_str().into(),
        ccy: acc.ccy().into(),
        created_ms: env.now.timestamp_millis(),
        kind: if req.kind == ReqKind::Market { "market".into() } else { "limit".into() },
        opening,
        step,
    };
    let w = Working {
        id,
        underlying: u.symbol.clone(),
        series: terms.series.clone(),
        side: req.side,
        px,
        price,
        tick,
        qty: steps,
        left: steps,
        step,
        reserve_per_step: rps,
        hold: None,
        tif,
        flags,
        expire_ms: req.expire_at.map(|t| t.timestamp_millis()),
        ext: ext.clone(),
        opening,
        created: env.now,
    };
    tx.st.book.orders.insert(id, w);
    let inc = (tx.st.book.series_reserve(&terms.series) - before).max(ZERO);
    let ccy = acc.ccy();
    match req.side {
        Side::Buy => {
            let limit = if opens { free_cash(&m0) } else { (m0.balance - m0.order_reserve).max(ZERO) };
            if inc > limit {
                return Err(rej("insufficient_cash", format!("Not enough cash: {} {ccy} needed for this order, {} {ccy} available (credit and bonus can't pay premiums)", r2(inc).normalize(), r2(limit).normalize())));
            }
        }
        Side::Sell if opens => {
            let own = m0.equity - m0.credit - m0.bonus - m0.margin - m0.order_reserve;
            if inc > own {
                return Err(rej("insufficient_margin", format!("Not enough margin from your own funds: {} {ccy} needed for this order, {} {ccy} free", r2(inc).normalize(), r2(own.max(ZERO)).normalize())));
            }
        }
        Side::Sell => {
            let limit = (m0.balance - m0.order_reserve).max(ZERO);
            if inc > limit {
                return Err(rej("insufficient_cash", format!("Not enough cash for the fee: {} {ccy} needed", r2(inc).normalize())));
            }
        }
    }
    if let Some(c) = &req.client_order_id {
        tx.st.book.client_ids.insert(c.clone(), id);
    }
    tx.book_dirty = true;
    let key = BookKey::new(acc.tenant_id, acc.kind, &u.symbol);
    let order = Resting {
        id,
        login: acc.login,
        stp: acc.user_id,
        side: req.side,
        px,
        qty: steps,
        left: steps,
        filled: 0,
        notional: 0,
        prio: 0,
        tif,
        flags,
        expire_ms: req.expire_at.map(|t| t.timestamp_millis()),
        reserve_per_step: rps,
        ext,
    };
    let spec = SeriesSpec { terms: terms.clone(), tick, step };
    Ok(Entered::New { key, cmd: Cmd::New { series: terms.series.clone(), spec, order, usd_per_quote: usdq, at: env.now.timestamp_millis() }, id })
}

/// One mass-quote line: (series, bid (price, contracts), ask (price, contracts)).
pub type QuoteLine = (String, Option<(D, D)>, Option<(D, D)>);

/// Market-maker mass quote: every side goes through `enter` (same gates and reservations as any order; post-only,
/// ephemeral). Returns per book the series to replace with the quotes accepted, and the sides refused.
#[allow(clippy::type_complexity)]
pub fn enter_mass(tx: &mut Tx, env: &Env, lines: Vec<QuoteLine>) -> Result<(BTreeMap<BookKey, (Vec<String>, Vec<QuoteIn>)>, Vec<Value>), Reject> {
    let snap = snapshot(env)?;
    let acc = tx.st.account.clone();
    let mut books: BTreeMap<BookKey, (Vec<String>, Vec<QuoteIn>)> = BTreeMap::new();
    let mut refused = Vec::new();
    for (series, bid, ask) in lines {
        let Ok((terms, _)) = terms_of(&snap, &series) else {
            refused.push(json!({"series": series, "code": "unknown_series"}));
            continue;
        };
        let key = BookKey::new(acc.tenant_id, acc.kind, &terms.underlying);
        let e = books.entry(key).or_default();
        if !e.0.contains(&terms.series) {
            e.0.push(terms.series.clone());
        }
        for (side, q) in [(Side::Buy, bid), (Side::Sell, ask)] {
            let Some((price, qty)) = q else { continue };
            let mut req = BookReq::limit(&terms.series, side, qty, price);
            req.ephemeral = true;
            req.post_only = true;
            req.origin = "mm".into();
            req.source = Source::Strategy;
            req.lp = true;
            match try_enter(tx, env, req) {
                Ok(Entered::New { cmd: Cmd::New { series, spec, order, .. }, .. }) => {
                    e.1.push(QuoteIn { series, spec, id: order.id, side, px: order.px, qty: order.qty, reserve_per_step: order.reserve_per_step, ext: order.ext });
                }
                Ok(_) => {}
                Err(x) => refused.push(json!({"series": terms.series, "side": side.as_str(), "code": x.code, "message": x.message})),
            }
        }
    }
    Ok((books, refused))
}

/// Standalone scenario margin of `contracts` sold (no offsets), with the weekend add-on, in the account currency.
pub fn opening_margin(env: &Env, acc: &Account, terms: &OptionTerms, u: &Underlying, contracts: D) -> D {
    let legs = [ScenLeg { terms: terms.clone(), contracts: -contracts }];
    let m = match env.options.scenario(&env.tenant.slug, &u.symbol, &legs, 0.0, env.now) {
        Some(sc) if sc.options_only.is_finite() => dec(sc.options_only) * dec(sc.usd_per_quote) * acc.usd_factor(),
        _ => fallback_margin(env, acc, &legs),
    };
    let add_on = if crate::options::weekend_margin(env.now) {
        env.options.snapshot().map(|s| dec(s.group(&env.tenant.slug, &env.group.code, &u.symbol).weekend_margin_pct.max(0.0))).unwrap_or(ZERO)
    } else {
        ZERO
    };
    m.max(ZERO) * (ONE + add_on / HUNDRED)
}

/// What an amend would reserve: (new reserve per step, extra hold now). Increases are checked against the
/// account's free funds; a decrease holds nothing extra (the book releases it when the amend applies).
pub fn prepare_amend(tx: &mut Tx, env: &Env, id: i64, price: Option<D>, qty: Option<D>, token: u64) -> Result<(BookKey, Cmd), Reject> {
    let w = tx.st.book.orders.get(&id).cloned().ok_or_else(|| rej("not_found", format!("Order #{id} is not working")))?;
    if w.flags & EPHEMERAL != 0 {
        return Err(rej("invalid_order", "Market-maker quotes are replaced with a new mass quote"));
    }
    if w.hold.is_some() {
        return Err(rej("amend_pending", format!("Order #{id} has an amend in progress")));
    }
    let acc = tx.st.account.clone();
    let snap = snapshot(env)?;
    let (terms, u) = terms_of(&snap, &w.series)?;
    let new_px = match price {
        None => w.px,
        Some(p) => whole(p, w.tick).ok_or_else(|| rej("invalid_price", format!("The price must be a multiple of the premium tick {}", w.tick.normalize())))?,
    };
    let filled = w.qty - w.left;
    let new_qty = match qty {
        None => w.qty,
        Some(q) => {
            eopt::contracts_gate(&u, q)?;
            whole(q, w.step).ok_or_else(|| rej("invalid_volume", format!("Contracts must be a multiple of {}", w.step.normalize())))? + 0
        }
    };
    if new_qty <= filled {
        return Err(rej("invalid_volume", format!("{} contracts of #{id} are already filled: cancel the rest instead", (D::from(filled) * w.step).normalize())));
    }
    if new_px == w.px && new_qty == w.qty {
        return Err(rej("no_change", "Nothing changed"));
    }
    let increases = new_px != w.px || new_qty > w.qty;
    if increases {
        // a price change can make the order aggressive: the band applies like on entry
        let mark = mark_of(env, &acc, &terms).map(|m| m.mark).filter(|m| *m > ZERO).ok_or_else(|| rej("no_price", format!("There is no mark for {} right now", terms.series)))?;
        let (lo, hi) = limit_band(mark, w.tick, &u);
        if (w.side == Side::Buy && new_px > hi) || (w.side == Side::Sell && new_px < lo) {
            return Err(rej("price_out_of_band", "The new price is too far from the mark"));
        }
    }
    let usdq = eopt::usd_per_quote(env, &acc, &terms.quote_ccy).ok_or_else(|| rej("stale_prices", format!("There is no USD rate for {} right now", terms.quote_ccy)))?;
    let fee_wc = w.ext.fee_maker.max(w.ext.fee_taker).max(ZERO);
    let new_left = new_qty - filled;
    let new_rps = match w.side {
        Side::Buy => reserve::buy_per_step(D::from(new_px) * w.tick, w.step, terms.contract_size, usdq, terms.quote_ccy == "USD", acc.usd_factor(), fee_wc),
        Side::Sell => {
            let opening = (w.opening + (new_qty - w.qty).max(0)).min(new_left);
            let margin = if opening > 0 { opening_margin(env, &acc, &terms, &u, D::from(opening) * w.step) } else { ZERO };
            reserve::sell_per_step(new_left, w.step, acc.usd_factor(), fee_wc, margin)
        }
    };
    let now_reserved = w.reserved();
    let then_reserved = D::from(new_left) * new_rps;
    let extra = (then_reserved - now_reserved).max(ZERO);
    if extra > ZERO {
        let m0 = metrics(env, &tx.st);
        let before = tx.st.book.series_reserve(&w.series);
        tx.st.book.orders.get_mut(&id).unwrap().hold = Some((token, extra));
        let inc = (tx.st.book.series_reserve(&w.series) - before).max(ZERO);
        let limit = match w.side {
            Side::Buy => free_cash(&m0),
            Side::Sell => m0.equity - m0.credit - m0.bonus - m0.margin - m0.order_reserve,
        };
        if inc > limit {
            return Err(rej(if w.side == Side::Buy { "insufficient_cash" } else { "insufficient_margin" }, format!("Not enough free funds for the larger order ({} {} needed)", r2(inc).normalize(), acc.ccy())));
        }
        tx.book_dirty = true;
    }
    let key = BookKey::new(acc.tenant_id, acc.kind, &w.underlying);
    let cmd = Cmd::Amend {
        series: w.series.clone(),
        id,
        login: acc.login,
        px: (new_px != w.px).then_some(new_px),
        qty: (new_qty != w.qty).then_some(new_qty),
        reserve_per_step: new_rps,
        token,
        usd_per_quote: usdq,
        at: env.now.timestamp_millis(),
    };
    Ok((key, cmd))
}

/* ------------------------------------------------------------------ */
/* Outbox items                                                        */
/* ------------------------------------------------------------------ */

fn reason_for(role: Role, kind: FillKind, origin: &str) -> DealReason {
    match kind {
        FillKind::Backstop | FillKind::Liquidation => return DealReason::StopOut,
        FillKind::Novation => return DealReason::Novation,
        _ => {}
    }
    if origin.starts_with("sl:") {
        DealReason::Sl
    } else if origin.starts_with("tp:") {
        DealReason::Tp
    } else if origin == "stop" || role == Role::Maker {
        DealReason::PendingFill
    } else {
        DealReason::Client
    }
}

/// Splits `total` over `parts` pro rata by weight (cents), the remainder on the last part, so the parts sum exactly.
fn split(total: D, weights: &[D]) -> Vec<D> {
    let sum: D = weights.iter().copied().sum();
    if weights.is_empty() {
        return vec![];
    }
    if sum.is_zero() {
        let mut v = vec![ZERO; weights.len()];
        *v.last_mut().unwrap() = total;
        return v;
    }
    let mut out = Vec::with_capacity(weights.len());
    let mut used = ZERO;
    for (i, w) in weights.iter().enumerate() {
        if i + 1 == weights.len() {
            out.push(total - used);
        } else {
            let x = r2(total * *w / sum);
            used += x;
            out.push(x);
        }
    }
    out
}

/// One side of a fill on this account. Never refuses for money (it was reserved); idempotent per (fill, role).
pub fn apply_fill(tx: &mut Tx, env: &Env, fill: &Fill, role: Role) -> Result<Value, Reject> {
    let party = fill.party(role).clone();
    let login = tx.st.account.login;
    if party.login != login {
        return Err(rej("wrong_account", format!("Fill {} {} is for {}, not {login}", fill.id, role.as_str(), party.login)));
    }
    let fkey = fill_key(&fill.id, role.as_str());
    if tx.st.book.applied.contains(&fkey) {
        return Ok(json!({"fillId": fill.id, "role": role.as_str(), "duplicate": true}));
    }
    let acc = tx.st.account.clone();
    let factor = acc.usd_factor();
    let terms = fill.spec.terms.clone();
    let contracts = fill.spec.contracts(fill.qty);
    let price = fill.spec.price(fill.px);
    let side = party.side;
    let sign = if side == Side::Buy { -ONE } else { ONE };
    let p_usd = fill.premium_usd;
    let p_acct = r2(p_usd * factor);
    let ccy = acc.ccy();
    // premium through the expiry's clearing account (USD); cent accounts via house:fx
    let clearing = house_code(&clearing_name(&terms), "USD");
    let prem_txn = if p_usd.is_zero() {
        None
    } else {
        let mut postings = vec![Posting { account: acct_code(login, "balance"), ccy: ccy.into(), amount: sign * p_acct }];
        if acc.cent {
            postings.push(Posting { account: house_code("fx", "USC"), ccy: "USC".into(), amount: -sign * p_acct });
            postings.push(Posting { account: house_code("fx", "USD"), ccy: "USD".into(), amount: sign * p_usd });
        }
        postings.push(Posting { account: clearing.clone(), ccy: "USD".into(), amount: -sign * p_usd });
        let txn = LedgerTxn {
            id: env.ids.txn(),
            tenant_id: acc.tenant_id,
            idempotency_key: format!("fill:{}:{login}:prem", fill.id),
            kind: TxnKind::OptionPremium,
            login,
            reference: Some(format!("fill:{}", fill.id)),
            reason_code: None,
            note: Some(format!("{} {} {} at {} (order book, {})", side.as_str(), contracts.normalize(), terms.series, price.normalize(), role.as_str())),
            at: env.now,
            postings,
        };
        assert!(txn.is_balanced(), "unbalanced fill premium");
        let id = txn.id;
        tx.emit(Event::Ledger { txn });
        Some(id)
    };
    // fee (taker / maker) or maker rebate, capped at cap % of the premium
    let ext = party.order.as_ref().map(|o| o.ext.clone()).unwrap_or_default();
    let rate = match role {
        Role::Maker => ext.fee_maker,
        Role::Taker => ext.fee_taker,
    };
    let fee_usd = (rate.abs() * contracts).min(ext.fee_cap_pct.max(ZERO) / HUNDRED * p_usd.abs());
    let fee_amt = r2(fee_usd * factor);
    let (fee, rebate) = if rate >= ZERO { (fee_amt, ZERO) } else { (ZERO, fee_amt) };
    if fee > ZERO {
        tx.post(env, TxnKind::Commission, format!("fill:{}:{login}:fee", fill.id), "balance", "commission", -fee, Some(format!("fill:{}", fill.id)), None, Some(format!("order book {} fee", role.as_str())));
    }
    if rebate > ZERO {
        tx.post(env, TxnKind::OptionRebate, format!("fill:{}:{login}:rebate", fill.id), "balance", "options_rebates", rebate, Some(format!("fill:{}", fill.id)), None, Some("order book maker rebate".into()));
    }
    let order_id = party.order.as_ref().map(|o| o.id);
    let fref = FillRef { id: fill.id.clone(), role: role.as_str().into(), kind: fill.kind.as_str().into(), combo: fill.combo, order: order_id };
    let reason = reason_for(role, fill.kind, &ext.origin);
    let source = Source::parse_client(&ext.source).unwrap_or(if ext.origin == "mm" { Source::Strategy } else { Source::Manual });
    // FIFO netting against this account's book positions in the series
    let mut book_pos: Vec<Position> = tx.st.positions.values().filter(|p| p.on_book() && p.symbol == fill.series && p.option.as_ref().is_some_and(|t| t.barrier.is_none())).cloned().collect();
    book_pos.sort_by_key(|p| (p.open_time, p.ticket));
    let mut left = contracts;
    let mut closes: Vec<(Position, D)> = Vec::new();
    for p in book_pos.iter().filter(|p| p.side != side) {
        if left <= ZERO {
            break;
        }
        let v = left.min(p.volume);
        closes.push((p.clone(), v));
        left -= v;
    }
    let open_qty = left;
    let mut weights: Vec<D> = closes.iter().map(|c| c.1).collect();
    if open_qty > ZERO {
        weights.push(open_qty);
    }
    let cash_parts = split(sign * p_acct, &weights);
    let fee_parts = split(fee, &weights);
    let rebate_parts = split(rebate, &weights);
    let mut deals = Vec::new();
    let mut ticket_out = None;
    for (i, (p, v)) in closes.iter().enumerate() {
        let full = *v >= p.volume;
        let frac = if full { ONE } else { *v / p.volume };
        let basis = if full { p.premium } else { r2(p.premium * frac) };
        let entry_comm = if full { p.commission } else { r2(p.commission * frac) };
        let deal_id = env.ids.deal();
        let cash = cash_parts[i];
        let profit = cash + basis;
        let snapshot = Position { volume: *v, premium: basis, commission: entry_comm, ..p.clone() };
        let deal = Deal {
            id: deal_id,
            login,
            position_ticket: p.ticket,
            order_ticket: order_id,
            symbol: p.symbol.clone(),
            side,
            position_side: p.side,
            entry: DealEntry::Out,
            volume: *v,
            price,
            profit,
            swap: ZERO,
            commission: entry_comm + fee_parts[i],
            reason,
            book: p.book,
            time: env.now,
            open_price: p.open_price,
            open_time: p.open_time,
            source,
            comment: format!("book fill {}", fill.id),
            price_correction: false,
            ledger_txn: prem_txn,
            staff: None,
            reason_code: None,
            snapshot: Some(Box::new(snapshot)),
            client_order_id: None,
            partial: !full,
            option: Some(DealOption { terms: terms.clone(), cash, usd_per_quote: fill.usd_per_quote, spot: None, fixing: None, run: None, combo_id: p.combo_id, charged: fee_parts[i], fill: Some(fref.clone()), rebate: rebate_parts[i] }),
        };
        let rest = if full { None } else { Some(Position { volume: p.volume - *v, premium: p.premium - basis, commission: p.commission - entry_comm, ..p.clone() }) };
        tx.emit(Event::PositionClosed { deal, position: rest });
        deals.push(json!({"dealId": deal_id, "ticket": p.ticket, "entry": "out", "contracts": num(*v), "profit": num(profit)}));
        ticket_out = Some(p.ticket);
    }
    if open_qty > ZERO {
        let i = closes.len();
        let cash = cash_parts[i];
        let fee_i = fee_parts[i];
        let deal_id = env.ids.deal();
        // adds to the newest same-side book position, else opens one
        let same = book_pos.iter().filter(|p| p.side == side && tx.st.positions.contains_key(&p.ticket)).max_by_key(|p| p.ticket).cloned();
        let (pos, ev_open) = match same {
            Some(p) => {
                let vol = p.volume + open_qty;
                let vwap = rdp((p.open_price * p.volume + price * open_qty) / vol, 12);
                (Position { volume: vol, open_price: vwap, premium: p.premium + cash, commission: p.commission + fee_i, ..p }, false)
            }
            None => {
                let ticket = env.ids.ticket();
                (
                    Position {
                        ticket,
                        login,
                        symbol: terms.series.clone(),
                        side,
                        volume: open_qty,
                        open_price: price,
                        open_time: env.now,
                        sl: None,
                        tp: None,
                        trailing: None,
                        swap: ZERO,
                        commission: fee_i,
                        source,
                        platform: "Order book".into(),
                        comment: String::new(),
                        book: Book::B,
                        order_ticket: order_id.unwrap_or(ticket),
                        parent_ticket: None,
                        child_tickets: vec![],
                        book_since: env.now,
                        book_price: price,
                        book_carry_a: ZERO,
                        book_carry_b: ZERO,
                        route_history: vec![RouteEvent { at: env.now, kind: "open".into(), from: None, to: Book::B, volume: open_qty, price, staff: "Options order book".into(), reason: "Matched on the options order book".into(), related_ticket: None }],
                        price_corrected: false,
                        last_swap_day: None,
                        client_order_id: None,
                        reversed_from: None,
                        option: Some(terms.clone()),
                        combo_id: fill.combo,
                        premium: cash,
                        venue: Some(Venue::Book),
                    },
                    true,
                )
            }
        };
        let deal = Deal {
            id: deal_id,
            login,
            position_ticket: pos.ticket,
            order_ticket: order_id,
            symbol: terms.series.clone(),
            side,
            position_side: side,
            entry: DealEntry::In,
            volume: open_qty,
            price,
            profit: ZERO,
            swap: ZERO,
            commission: fee_i,
            reason,
            book: Book::B,
            time: env.now,
            open_price: price,
            open_time: env.now,
            source,
            comment: format!("book fill {}", fill.id),
            price_correction: false,
            ledger_txn: prem_txn,
            staff: None,
            reason_code: None,
            snapshot: None,
            client_order_id: None,
            partial: false,
            option: Some(DealOption { terms: terms.clone(), cash, usd_per_quote: fill.usd_per_quote, spot: None, fixing: None, run: None, combo_id: fill.combo, charged: fee_i, fill: Some(fref.clone()), rebate: rebate_parts[i] }),
        };
        ticket_out = Some(pos.ticket);
        deals.push(json!({"dealId": deal_id, "ticket": pos.ticket, "entry": "in", "contracts": num(open_qty)}));
        if ev_open {
            tx.emit(Event::PositionOpened { position: pos, deal: Some(deal) });
        } else {
            tx.emit(Event::PositionUpdated { position: pos, change: "book fill".into(), deal: Some(deal) });
        }
    }
    // the fill is booked (the deals carry option.fill, so replay knows it too)
    debug_assert!(tx.st.book.applied.contains(&fkey));
    // release pro rata: the order's working quantity is at most what the book says is left after this fill
    if let Some(o) = &party.order
        && let Some(w) = tx.st.book.orders.get_mut(&o.id)
    {
        w.left = w.left.min((o.left - fill.qty).max(0));
        tx.book_dirty = true;
    }
    tx.note(
        "fill",
        format!("Order book: {} {} {} at {} ({})", if side == Side::Buy { "bought" } else { "sold" }, contracts.normalize(), terms.series, price.normalize(), role.as_str()),
        json!({"fillId": fill.id, "orderId": order_id, "role": role.as_str(), "series": terms.series, "price": num(price), "contracts": num(contracts), "fee": num(fee), "rebate": num(rebate), "positionTicket": ticket_out, "options": true, "book": true}),
    );
    risk::check_margin(tx, env);
    Ok(json!({"fillId": fill.id, "role": role.as_str(), "positionTicket": ticket_out, "fee": num(fee), "rebate": num(rebate), "premium": num(p_acct), "deals": deals}))
}

/// An order left the book: release what it still reserves.
pub fn apply_done(tx: &mut Tx, _env: &Env, d: &Done) -> Result<Value, Reject> {
    let removed = tx.st.book.orders.remove(&d.id);
    if removed.is_some() {
        tx.book_dirty = true;
    }
    if removed.is_some() && d.order.flags & EPHEMERAL == 0 {
        let kind = match d.status {
            DoneStatus::Filled => "order_filled",
            DoneStatus::Expired => "order_expired",
            DoneStatus::Rejected => "order_rejected",
            _ => "order_cancelled",
        };
        let msg = match d.status {
            DoneStatus::Filled => format!("Book order #{} filled", d.id),
            DoneStatus::Rejected => format!("Book order #{} was rejected ({})", d.id, d.reason),
            _ => format!("Book order #{} {} ({})", d.id, d.status.as_str(), d.reason),
        };
        tx.note(kind, msg, json!({"orderId": d.id, "series": d.series, "status": d.status.as_str(), "reason": d.reason, "filled": d.order.filled, "book": true, "options": true}));
    }
    Ok(json!({"orderId": d.id, "status": d.status.as_str(), "released": removed.is_some()}))
}

pub fn apply_amended(tx: &mut Tx, _env: &Env, a: &Amended) -> Result<Value, Reject> {
    if let Some(w) = tx.st.book.orders.get_mut(&a.id) {
        w.px = a.px;
        w.price = D::from(a.px) * w.tick;
        w.qty = a.qty;
        w.left = a.left;
        w.reserve_per_step = a.reserve_per_step;
        if w.hold.is_some_and(|h| h.0 == a.token) {
            w.hold = None;
        }
        tx.book_dirty = true;
    }
    Ok(json!({"orderId": a.id, "amended": true}))
}

pub fn release_hold(tx: &mut Tx, id: i64, token: u64) -> Result<Value, Reject> {
    if let Some(w) = tx.st.book.orders.get_mut(&id)
        && w.hold.is_some_and(|h| h.0 == token)
    {
        w.hold = None;
        tx.book_dirty = true;
    }
    Ok(json!({"orderId": id, "released": true}))
}

/// Crash recovery: working orders (with their reservations) from the book, and recent clientOrderIds.
pub fn restore(tx: &mut Tx, orders: &[Value], client_ids: &[(String, i64)]) -> Result<Value, Reject> {
    let mut n = 0;
    for x in orders {
        let Ok(o) = serde_json::from_value::<Resting>(x["order"].clone()) else { continue };
        let (Some(series), Some(underlying)) = (x["series"].as_str(), x["underlying"].as_str()) else { continue };
        let step: D = x["step"].as_str().and_then(|s| s.parse().ok()).unwrap_or(ONE);
        let tick: D = x["tick"].as_str().and_then(|s| s.parse().ok()).unwrap_or(ZERO);
        let w = Working {
            id: o.id,
            underlying: underlying.into(),
            series: series.into(),
            side: o.side,
            px: o.px,
            price: D::from(o.px) * tick,
            tick,
            qty: o.qty,
            left: o.left,
            step,
            reserve_per_step: o.reserve_per_step,
            hold: None,
            tif: o.tif,
            flags: o.flags,
            expire_ms: o.expire_ms,
            opening: o.ext.opening,
            created: DateTime::from_timestamp_millis(o.ext.created_ms).unwrap_or_default(),
            ext: o.ext,
        };
        tx.st.book.orders.insert(w.id, w);
        n += 1;
    }
    for (c, id) in client_ids {
        tx.st.book.client_ids.insert(c.clone(), *id);
    }
    tx.book_dirty = true;
    Ok(json!({"orders": n}))
}

/* ------------------------------------------------------------------ */
/* Stops, SL / TP, closes                                              */
/* ------------------------------------------------------------------ */

/// A stop request.
#[derive(Clone, Debug)]
pub struct StopReq {
    pub book: BookReq,
    pub source: StopSource,
    pub op: TriggerOp,
    pub trigger: D,
}

/// Places a `stop_market` / `stop_limit` as an account order (nothing is reserved until it fires).
pub fn place_stop(tx: &mut Tx, env: &Env, r: StopReq) -> Result<Order, Reject> {
    let req = &r.book;
    if let Some(c) = &req.client_order_id {
        if c.is_empty() || c.len() > 64 {
            return Err(rej("invalid_client_order_id", "clientOrderId must be 1–64 characters"));
        }
        if tx.st.client_ids.contains_key(c) || tx.st.book.client_ids.contains_key(c) {
            let t = tx.st.client_ids.get(c).or_else(|| tx.st.book.client_ids.get(c)).copied().unwrap_or(0);
            return Err(Reject::new("duplicate", format!("clientOrderId {c} was already used (order #{t})")));
        }
    }
    if r.trigger <= ZERO {
        return Err(rej("invalid_trigger", "Enter the trigger price"));
    }
    let snap = snapshot(env)?;
    let (terms, u) = terms_of(&snap, &req.series)?;
    let (tick, step) = units(&u);
    eopt::contracts_gate(&u, req.qty)?;
    whole(req.qty, step).ok_or_else(|| rej("invalid_volume", format!("Contracts must be a multiple of {}", step.normalize())))?;
    eopt::module_gate(env, &tx.st, &snap, &u.symbol)?;
    gate(env, &tx.st, &u.symbol, !req.reduce_only, ZERO, None)?;
    if req.kind == ReqKind::Limit {
        let p = req.price.filter(|p| *p > ZERO).ok_or_else(|| rej("invalid_price", "Enter the limit price of the stop-limit"))?;
        whole(p, tick).ok_or_else(|| rej("invalid_price", format!("The price must be a multiple of the premium tick {}", tick.normalize())))?;
    }
    if r.source == StopSource::Mark {
        whole(r.trigger, tick).ok_or_else(|| rej("invalid_trigger", format!("A mark trigger must be a multiple of the premium tick {}", tick.normalize())))?;
    }
    if req.reduce_only && book_net(&tx.st, &terms.series) * req.side.sign() >= ZERO {
        return Err(rej("reduce_only", format!("There is no {} position in {} to reduce", if req.side == Side::Sell { "long" } else { "short" }, terms.series)));
    }
    let close_only_min = u.close_only_minutes.max(0) as i64;
    let last = terms.expiry_at - chrono::Duration::minutes(close_only_min);
    if env.now >= last {
        return Err(rej("cutoff", format!("Trading in {} has ended", terms.series)));
    }
    let expiry_at = req.expire_at.map(|e| e.min(last)).unwrap_or(last);
    let ticket = env.ids.ticket();
    let order = Order {
        ticket,
        login: tx.st.account.login,
        symbol: terms.series.clone(),
        side: req.side,
        kind: if req.kind == ReqKind::Market { OrderType::Stop } else { OrderType::StopLimit },
        volume: req.qty,
        price: r.trigger,
        stop_limit: req.price.filter(|_| req.kind == ReqKind::Limit),
        sl: None,
        tp: None,
        trailing: None,
        expiry: Expiry::Date,
        expiry_at: Some(expiry_at),
        oco: None,
        source: req.source,
        platform: "Order book".into(),
        comment: String::new(),
        book: None,
        placed_at: env.now,
        triggered: false,
        client_order_id: req.client_order_id.clone(),
        option: Some(OptionOrder {
            legs: vec![OptLeg { terms: terms.clone(), side: req.side, contracts: req.qty }],
            limit_premium: req.price.filter(|_| req.kind == ReqKind::Limit),
            book: Some(BookStop { source: r.source, op: r.op, trigger: r.trigger, tif: if req.kind == ReqKind::Market { "ioc".into() } else { req.tif.as_str().into() }, post_only: req.post_only, reduce_only: req.reduce_only, expire_at: req.expire_at }),
        }),
        combo_id: None,
        trigger: (r.source == StopSource::Underlying).then(|| Trigger { symbol: u.symbol.clone(), op: r.op, price: r.trigger }),
    };
    tx.emit(Event::OrderPlaced { order: order.clone() });
    tx.note("order_placed", format!("Book stop #{ticket} placed: {} {} {} when the {} is {} {}", req.side.as_str(), req.qty.normalize(), terms.series, r.source.as_str(), r.op.as_str(), r.trigger.normalize()), json!({"ticket": ticket, "book": true, "options": true}));
    Ok(order)
}

/// The book order a stop becomes.
fn stop_req(o: &Order, st: &crate::state::AccountState) -> Option<BookReq> {
    let oo = o.option.as_ref()?;
    let bs = oo.book.as_ref()?;
    let tif = Tif::parse(&bs.tif).unwrap_or(Tif::Ioc);
    let kind = if o.kind == OrderType::StopLimit { ReqKind::Limit } else { ReqKind::Market };
    let _ = st;
    Some(BookReq {
        series: o.symbol.clone(),
        side: o.side,
        kind,
        qty: o.volume,
        price: if kind == ReqKind::Limit { oo.limit_premium } else { None },
        tif: if kind == ReqKind::Market { Tif::Ioc } else { tif },
        expire_at: if tif == Tif::Gtd { bs.expire_at } else { None },
        post_only: bs.post_only && kind == ReqKind::Limit && tif.rests(),
        reduce_only: bs.reduce_only,
        client_order_id: None,
        source: o.source,
        eligible: true,
        others: (ZERO, ZERO),
        origin: "stop".into(),
        id: Some(o.ticket),
        lp: false,
        ephemeral: false,
    })
}

/// Refusals that keep a stop waiting (the market may allow it later).
fn transient(code: &str) -> bool {
    matches!(code, "market_closed" | "series_halted" | "stale_prices" | "no_price" | "options_disabled" | "trading_disabled" | "account_status" | "symbol_halted")
}

/// Runs `enter` on a scratch copy and keeps it only on success.
fn try_enter(tx: &mut Tx, env: &Env, req: BookReq) -> Result<Entered, Reject> {
    let mut x = Tx::new(&tx.st);
    let e = enter(&mut x, env, req)?;
    tx.st.book = x.st.book;
    tx.book_dirty |= x.book_dirty;
    Ok(e)
}

/// Book stops on `underlying` (or every underlying): fire the ones whose trigger is met.
pub fn eval_stops(tx: &mut Tx, env: &Env, underlying: Option<&str>) {
    let due: Vec<Order> = tx
        .st
        .orders
        .values()
        .filter(|o| o.option.as_ref().is_some_and(|oo| oo.book.is_some() && underlying.is_none_or(|u| oo.legs.iter().any(|l| l.terms.underlying == u))))
        .filter(|o| o.expiry_at.is_none_or(|a| a > env.now))
        .cloned()
        .collect();
    for o in due {
        let oo = o.option.as_ref().unwrap();
        let bs = oo.book.as_ref().unwrap();
        let terms = &oo.legs[0].terms;
        let px = match bs.source {
            StopSource::Underlying => eopt::spot_of(env, &tx.st.account, &terms.underlying),
            StopSource::Mark => mark_of(env, &tx.st.account, terms).map(|m| m.mark),
        };
        let Some(px) = px else { continue };
        if !bs.op.fired(px, bs.trigger) {
            continue;
        }
        let Some(req) = stop_req(&o, &tx.st) else { continue };
        match try_enter(tx, env, req) {
            Ok(Entered::New { key, cmd, .. }) => {
                tx.emit(Event::OrderRemoved { ticket: o.ticket, status: OrderStatus::Filled, reason: "book_stop_fired".into(), at: env.now, fill_price: None, position_ticket: None });
                tx.note("order_triggered", format!("Book stop #{}: the {} is {} {} — sent to the order book", o.ticket, bs.source.as_str(), bs.op.as_str(), bs.trigger.normalize()), json!({"ticket": o.ticket, "book": true, "options": true}));
                tx.book_send.push(Outgoing { key, cmd, login: tx.st.account.login });
            }
            Ok(Entered::Duplicate { .. }) => {}
            Err(e) if transient(e.code) => {}
            Err(e) => {
                tx.emit(Event::OrderRemoved { ticket: o.ticket, status: OrderStatus::Rejected, reason: e.message.clone(), at: env.now, fill_price: None, position_ticket: None });
                tx.note("order_rejected", format!("Book stop #{} fired but could not be placed: {}", o.ticket, e.message), json!({"ticket": o.ticket, "code": e.code, "book": true, "options": true}));
            }
        }
    }
}

/// Crash recovery: a stop that fired (and was removed) but never reached its book is entered again.
pub fn refire_stop(tx: &mut Tx, env: &Env, o: &Order) -> Result<Value, Reject> {
    if tx.st.book.orders.contains_key(&o.ticket) {
        return Ok(json!({"ticket": o.ticket, "already": true}));
    }
    let req = stop_req(o, &tx.st).ok_or_else(|| rej("not_found", "not a book stop"))?;
    match try_enter(tx, env, req) {
        Ok(Entered::New { key, cmd, .. }) => {
            tx.book_send.push(Outgoing { key, cmd, login: tx.st.account.login });
            Ok(json!({"ticket": o.ticket, "resubmitted": true}))
        }
        Ok(Entered::Duplicate { .. }) => Ok(json!({"ticket": o.ticket, "already": true})),
        Err(e) => {
            tx.note("order_rejected", format!("Book stop #{} could not be placed after a restart: {}", o.ticket, e.message), json!({"ticket": o.ticket, "code": e.code, "book": true, "options": true}));
            Ok(json!({"ticket": o.ticket, "rejected": e.code}))
        }
    }
}

/// Premium SL / TP of book positions on `underlying`: a reduce-only market order when the mark reaches it (one
/// at a time per position; kept until the position is closed or the level is no longer met).
pub fn book_sltp(tx: &mut Tx, env: &Env, underlying: &str) {
    let due: Vec<Position> = tx.st.positions.values().filter(|p| p.on_book() && (p.sl.is_some() || p.tp.is_some()) && p.option.as_ref().is_some_and(|t| t.underlying == underlying)).cloned().collect();
    for p in due {
        let t = p.option.clone().unwrap();
        let Some(m) = mark_of(env, &tx.st.account, &t).map(|m| m.mark) else { continue };
        let hit = match p.side {
            Side::Buy => (p.sl.is_some_and(|s| m <= s), p.tp.is_some_and(|s| m >= s)),
            Side::Sell => (p.sl.is_some_and(|s| m >= s), p.tp.is_some_and(|s| m <= s)),
        };
        let origin = match hit {
            (true, _) => format!("sl:{}", p.ticket),
            (_, true) => format!("tp:{}", p.ticket),
            _ => continue,
        };
        if tx.st.book.orders.values().any(|w| w.ext.origin == origin) {
            continue; // one in flight
        }
        let mut req = BookReq::market(&p.symbol, p.side.opposite(), p.volume);
        req.reduce_only = true;
        req.origin = origin;
        req.source = Source::System;
        match try_enter(tx, env, req) {
            Ok(Entered::New { key, cmd, .. }) => tx.book_send.push(Outgoing { key, cmd, login: tx.st.account.login }),
            Ok(_) => {}
            Err(e) => tracing::debug!(ticket = p.ticket, code = e.code, "book SL / TP not sent"),
        }
    }
}

/// Closing a book position = a reduce-only market IOC (`POST /v1/terminal/positions/{ticket}/close`).
pub fn close_request(st: &crate::state::AccountState, ticket: i64, volume: Option<D>) -> Result<BookReq, Reject> {
    let p = st.positions.get(&ticket).ok_or_else(|| rej("not_found", format!("Position #{ticket} not found")))?;
    if !p.on_book() {
        return Err(rej("not_book", format!("#{ticket} is not an order-book position")));
    }
    let v = volume.unwrap_or(p.volume);
    if v <= ZERO || v > p.volume {
        return Err(rej("invalid_volume", format!("Contracts must be between 0 and {}", p.volume.normalize())));
    }
    let mut req = BookReq::market(&p.symbol, p.side.opposite(), v);
    req.reduce_only = true;
    req.origin = format!("close:{ticket}");
    Ok(req)
}

/* ------------------------------------------------------------------ */
/* Marks for the feed and the open check                               */
/* ------------------------------------------------------------------ */

/// The public mark of a series in a book (model at the tenant's default group, clamped inside the book).
pub fn series_mark(hub: &crate::shard::Hub, slug: &str, kind: AccountKind, series: &str, now: DateTime<Utc>) -> Option<D> {
    let opts = &hub.shared.options;
    let snap = crate::options::OptionPricing::snapshot(opts.as_ref())?;
    let (terms, u) = terms_of(&snap, series).ok()?;
    let q = crate::options::OptionPricing::mark(opts.as_ref(), slug, "*", &terms, now)?;
    Some(clamp(q.mark, q.ask - q.bid, crate::options::OptionPricing::book_top(opts.as_ref(), slug, kind, series), &u))
}

/// The book clamp of a model mark (docs §6).
pub fn clamp(model: D, model_spread: D, top: Option<crate::book::md::TopQuote>, u: &Underlying) -> D {
    let Some(top) = top else { return model };
    let side = |x: Option<(D, D)>| x.map(|(p, q)| optmath::mark::BookSide { price: f(p), qty: f(q) });
    let (_, src) = optmath::mark::clamp_mark(f(model), f(model_spread), side(top.bid), side(top.ask), u.mark_min(), u.mark_spread_mult());
    match src {
        optmath::mark::MarkSource::Model => model,
        optmath::mark::MarkSource::Bid => top.bid.map(|b| b.0).unwrap_or(model),
        optmath::mark::MarkSource::Ask => top.ask.map(|a| a.0).unwrap_or(model),
    }
}

/// Bands (lo, hi ticks) of every series of a book against its current mark (session open check).
pub async fn open_bands(hub: &crate::shard::Hub, h: &crate::book::actor::Handle, now: DateTime<Utc>) -> BTreeMap<String, (Ticks, Ticks)> {
    let v = h.read(Box::new(|b| json!(b.series.iter().filter(|(_, sb)| !sb.orders.is_empty()).map(|(s, sb)| json!([s, sb.spec.tick.to_string()])).collect::<Vec<_>>()))).await.unwrap_or(Value::Null);
    let Some(slug) = hub.shared.registry.get(h.key.tenant_id).map(|t| t.slug.clone()) else { return BTreeMap::new() };
    let snap = crate::options::OptionPricing::snapshot(hub.shared.options.as_ref());
    let mut out = BTreeMap::new();
    for x in v.as_array().cloned().unwrap_or_default() {
        let (Some(s), Some(tick)) = (x[0].as_str(), x[1].as_str().and_then(|t| t.parse::<D>().ok())) else { continue };
        let Some(u) = snap.as_ref().and_then(|sn| terms_of(sn, s).ok()).map(|x| x.1) else { continue };
        if let Some(m) = series_mark(hub, &slug, h.key.kind, s, now) {
            out.insert(s.to_string(), limit_band(m, tick, &u));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_sums_exactly() {
        let w = [D::from(1), D::from(1), D::from(1)];
        let v = split(D::new(10000, 2), &w);
        assert_eq!(v.iter().copied().sum::<D>(), D::new(10000, 2));
        assert_eq!(v, vec![D::new(3333, 2), D::new(3333, 2), D::new(3334, 2)]);
        assert_eq!(split(D::new(-7, 2), &[D::from(2), D::from(5)]).iter().copied().sum::<D>(), D::new(-7, 2));
    }
}

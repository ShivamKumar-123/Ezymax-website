//! Combo RFQ (docs/OPTIONS-EXCHANGE.md §5): a multi-leg request for quote with atomic, all-or-nothing fills.
//!
//! 1. **Request** `{legs[{series, side, ratio}], qty, reduceOnly?}`: 1–8 listed vanilla series of ONE underlying,
//!    each once, whole ratios; it lives 30 s. Responders see it without its side.
//! 2. **Quote**: the Kalks market maker always answers (`mm::rfq_price`): net bid / ask per combo unit from the
//!    summed theos ± a combo spread, firm for the underlying's `rfqQuoteTtlSecs` (5 s). It reserves for its worst
//!    side (`rfq_hold`), then the quote is journaled (`Cmd::RfqQuote`). A lapsed quote is replaced on the next read.
//! 3. **Accept** `{quoteId, side, limitNet}`: the requester's legs go through `enter` (gates, limits, a reservation
//!    per leg at its split price), then `Cmd::RfqAccept` fills every leg in ONE journal entry, or none. Leg prices:
//!    the theos scaled to sum to the net, rounded to ticks, the remainder on the largest leg, no leg below 0
//!    (`matching::rfq_split`). Each account gets ONE outbox item holding all its legs (atomic per account). The
//!    tape shows the legs (kind `rfq`, same combo id) plus one `combo` print; outright books are not touched.
//!
//! Barrier legs are not listed: a strategy with a barrier leg is Kalks-quoted through the house ticket.
//! External responders (`rfq_responders`) come later: best price wins, ties go to the earliest quote.

use chrono::DateTime;
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::sync::Mutex;

use super::types::*;
use super::{BookKey, entry, matching};
use crate::engine::options_book::{self as ob, BookReq, RfqLegReq};
use crate::model::{AccountKind, OptionTerms, Side};
use crate::money::{D, ZERO, num};
use crate::shard::{ExecError, Hub};

/// An RFQ is open this long.
pub const RFQ_LIFE_MS: i64 = 30_000;
pub const MAX_LEGS: usize = 8;
pub const RESPONDER_MM: &str = "kalks-mm";

#[derive(Clone, Debug)]
pub struct Leg {
    pub series: String,
    pub side: Side,
    pub ratio: i64,
    pub terms: OptionTerms,
    pub spec: SeriesSpec,
}

/// A live quote as the requester sees it.
#[derive(Clone, Debug)]
pub struct QuoteView {
    pub id: i64,
    pub responder: String,
    pub login: i64,
    pub bid: Option<Ticks>,
    pub ask: Option<Ticks>,
    pub theos: Vec<Ticks>,
    pub valid_until: i64,
    pub usd_per_quote: D,
}

#[derive(Clone, Debug)]
pub struct Rfq {
    pub id: i64,
    pub tenant_id: i64,
    pub kind: AccountKind,
    pub underlying: String,
    pub login: i64,
    pub stp: i64,
    pub legs: Vec<Leg>,
    /// Combo units (contracts) and steps.
    pub qty: D,
    pub qty_steps: Steps,
    pub reduce_only: bool,
    pub created_ms: i64,
    pub expires_ms: i64,
    /// open | filled | cancelled | expired
    pub status: String,
    pub quote: Option<QuoteView>,
    pub combo: Option<i64>,
    pub note: Option<String>,
}

impl Rfq {
    pub fn key(&self) -> BookKey {
        BookKey::new(self.tenant_id, self.kind, &self.underlying)
    }
    pub fn tick(&self) -> D {
        self.legs.first().map(|l| l.spec.tick).unwrap_or(ZERO)
    }
    pub fn json(&self) -> Value {
        json!({
            "id": self.id.to_string(), "expiresAt": DateTime::from_timestamp_millis(self.expires_ms), "qty": num(self.qty), "status": self.status,
            "underlying": self.underlying, "reduceOnly": self.reduce_only, "comboId": self.combo.map(|c| c.to_string()),
            "legs": self.legs.iter().map(|l| json!({"series": l.series, "side": l.side.as_str(), "ratio": l.ratio})).collect::<Vec<_>>(),
        })
    }
    pub fn quotes_json(&self, now_ms: i64) -> Value {
        let tick = self.tick();
        json!(self.quote.iter().filter(|q| q.valid_until > now_ms && self.status == "open").map(|q| json!({
            "quoteId": q.id.to_string(), "responder": q.responder, "bid": q.bid.map(|b| num(D::from(b) * tick)), "ask": q.ask.map(|a| num(D::from(a) * tick)),
            "qty": num(self.qty), "validUntil": DateTime::from_timestamp_millis(q.valid_until),
        })).collect::<Vec<_>>())
    }
}

#[derive(Default)]
pub struct Registry {
    pub open: Mutex<BTreeMap<i64, Rfq>>,
}

impl Registry {
    pub fn get(&self, id: i64) -> Option<Rfq> {
        self.open.lock().unwrap().get(&id).cloned()
    }
    fn put(&self, r: Rfq) {
        let mut m = self.open.lock().unwrap();
        // forget finished requests after a minute
        let cut = r.created_ms - 60_000;
        m.retain(|_, x| x.status == "open" || x.expires_ms > cut);
        m.insert(r.id, r);
    }
    pub fn list(&self, tenant_id: i64, kind: Option<AccountKind>) -> Vec<Rfq> {
        self.open.lock().unwrap().values().filter(|r| r.tenant_id == tenant_id && kind.is_none_or(|k| r.kind == k)).cloned().collect()
    }
}

#[derive(Debug)]
pub enum RfqError {
    Exec(ExecError),
    Code(&'static str, String),
    NotFound,
}

impl From<ExecError> for RfqError {
    fn from(e: ExecError) -> Self {
        RfqError::Exec(e)
    }
}

/// A leg of a request: (series, side, ratio).
pub type LegIn = (String, Side, i64);

/// Opens an RFQ for `login` and asks the market maker for a quote at once.
#[allow(clippy::too_many_arguments)]
pub async fn open(hub: &Hub, pool: &sqlx::PgPool, tenant_id: i64, kind: AccountKind, login: i64, stp: i64, legs_in: Vec<LegIn>, qty: D, reduce_only: bool) -> Result<Rfq, RfqError> {
    if legs_in.is_empty() || legs_in.len() > MAX_LEGS {
        return Err(RfqError::Code("validation", format!("Give 1 to {MAX_LEGS} legs")));
    }
    let mut seen = std::collections::BTreeSet::new();
    for (s, _, r) in &legs_in {
        if !seen.insert(s.clone()) {
            return Err(RfqError::Code("validation", "Each series may appear once".into()));
        }
        if !(1..=100).contains(r) {
            return Err(RfqError::Code("validation", "Ratios are whole numbers from 1 to 100".into()));
        }
    }
    let snap = crate::options::OptionPricing::snapshot(hub.shared.options.as_ref()).ok_or_else(|| RfqError::Code("options_disabled", "Kalks FX Options are not available right now".into()))?;
    let mut legs = Vec::new();
    for (series, side, ratio) in legs_in {
        if snap.series.get(&series).is_none() && series.split('-').count() > 4 {
            return Err(RfqError::Code("kalks_quoted", format!("{series} is a barrier: barrier strategies are Kalks-quoted (not order book), use the strategy ticket")));
        }
        let (terms, u) = ob::terms_of(&snap, &series).map_err(|r| RfqError::Code(r.code, r.message))?;
        let (tick, step) = ob::units(&u);
        legs.push(Leg { series: terms.series.clone(), side, ratio, spec: SeriesSpec { terms: terms.clone(), tick, step }, terms });
    }
    let underlying = legs[0].terms.underlying.clone();
    if legs.iter().any(|l| l.terms.underlying != underlying) {
        return Err(RfqError::Code("rfq_underlyings", "Every leg of a combo must be on the same underlying".into()));
    }
    let step = legs[0].spec.step;
    let qty_steps = ob::whole(qty, step).ok_or_else(|| RfqError::Code("invalid_volume", format!("The size must be a multiple of {}", step.normalize())))?;
    let now_ms = hub.shared.clock.now().timestamp_millis();
    let r = Rfq {
        id: hub.shared.ids.ticket(),
        tenant_id,
        kind,
        underlying,
        login,
        stp,
        legs,
        qty,
        qty_steps,
        reduce_only,
        created_ms: now_ms,
        expires_ms: now_ms + RFQ_LIFE_MS,
        status: "open".into(),
        quote: None,
        combo: None,
        note: None,
    };
    let _ = sqlx::query("INSERT INTO book_rfqs (id, tenant_id, kind, underlying, login, legs, qty, status, expires_at, data) VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9)")
        .bind(r.id)
        .bind(tenant_id)
        .bind(kind.as_str())
        .bind(&r.underlying)
        .bind(login)
        .bind(sqlx::types::Json(r.json()["legs"].clone()))
        .bind(qty)
        .bind(DateTime::from_timestamp_millis(r.expires_ms))
        .bind(sqlx::types::Json(json!({"reduceOnly": reduce_only})))
        .execute(pool)
        .await;
    hub.shared.books.rfqs.put(r.clone());
    let r = refresh(hub, r.id).await.unwrap_or(r);
    Ok(r)
}

/// The RFQ with a live quote: a lapsed (or missing) one is replaced by a new market-maker quote.
pub async fn refresh(hub: &Hub, id: i64) -> Option<Rfq> {
    let books = &hub.shared.books;
    let mut r = books.rfqs.get(id)?;
    let now = hub.shared.clock.now();
    let now_ms = now.timestamp_millis();
    if r.status == "open" && now_ms >= r.expires_ms {
        r.status = "expired".into();
        books.rfqs.put(r.clone());
        return Some(r);
    }
    if r.status != "open" || r.quote.as_ref().is_some_and(|q| q.valid_until > now_ms + 300) {
        return Some(r);
    }
    match mm_quote(hub, &r).await {
        Ok(q) => r.quote = Some(q),
        Err(e) => {
            r.quote = None;
            r.note = Some(e);
        }
    }
    books.rfqs.put(r.clone());
    Some(r)
}

/// The Kalks market maker's firm quote on `r`: priced, held on its account, journaled in the book.
async fn mm_quote(hub: &Hub, r: &Rfq) -> Result<QuoteView, String> {
    let books = &hub.shared.books;
    let login = books.mm.login(r.tenant_id, r.kind).ok_or("The market maker is not running")?;
    let mm_stp = hub.meta(login).map(|m| m.user_id).unwrap_or(0);
    let slug = hub.shared.registry.get(r.tenant_id).map(|t| t.slug.clone()).ok_or("unknown tenant")?;
    let now = hub.shared.clock.now();
    let legs: Vec<(OptionTerms, Side, i64)> = r.legs.iter().map(|l| (l.terms.clone(), l.side, l.ratio)).collect();
    let (theos, bid, ask) = super::mm::rfq_price(hub, &slug, r.kind, &legs, now).ok_or("The market maker cannot price this strategy right now")?;
    let snap = crate::options::OptionPricing::snapshot(hub.shared.options.as_ref()).ok_or("no snapshot")?;
    let u = snap.underlying(&r.underlying).ok_or("unknown underlying")?;
    let ttl = u.rfq_quote_ttl_secs.clamp(1, 60) * 1000;
    let usdq = crate::options::OptionPricing::usd_per(hub.shared.options.as_ref(), &u.quote_ccy).and_then(crate::money::from_f64).ok_or("no USD rate")?;
    let now_ms = now.timestamp_millis();
    let valid_until = (now_ms + ttl).min(r.expires_ms);
    let quote_id = hub.shared.ids.ticket();
    // the market maker reserves for its worst side: the leg prices at its bid and at its ask
    let tick = r.tick();
    let rl: Vec<RfqLeg> = r.legs.iter().map(|l| RfqLeg { series: l.series.clone(), spec: l.spec.clone(), side: l.side, ratio: l.ratio }).collect();
    let px_bid = bid.map(|b| matching::rfq_split(&rl, &theos, b, Side::Sell)).unwrap_or_else(|| theos.clone());
    let px_ask = ask.map(|a| matching::rfq_split(&rl, &theos, a, Side::Buy)).unwrap_or_else(|| theos.clone());
    let worst: Vec<D> = px_bid.iter().zip(&px_ask).map(|(a, b)| D::from((*a).max(*b)) * tick).collect();
    let hold_legs: Vec<(OptionTerms, Side, D)> = r.legs.iter().map(|l| (l.terms.clone(), l.side, l.spec.contracts(l.ratio * r.qty_steps))).collect();
    let op: crate::shard::Op = Box::new(move |tx, env| ob::rfq_hold(tx, env, quote_id, &hold_legs, &worst, usdq, valid_until + 2_000).map(|a| json!(a.to_string())));
    hub.exec(login, "system:options-mm", None, "", "", None, op).await.map_err(|e| format!("The market maker cannot hold this quote: {e:?}"))?;
    let q = RfqQuoteIn { rfq: r.id, quote: quote_id, requester: r.login, requester_stp: r.stp, login, stp: mm_stp, legs: rl, qty: r.qty_steps, reduce_only: r.reduce_only, bid, ask, theos: theos.clone(), valid_until, usd_per_quote: usdq };
    let res = entry::call(hub, login, &r.key(), Cmd::RfqQuote { quote: q, at: now_ms }).await;
    let ok = matches!(&res, Ok((o, _, _)) if o.ok);
    if !ok {
        let release: crate::shard::Op = Box::new(move |tx, _| ob::release_rfq_holds(tx, now_ms, Some(quote_id)));
        let _ = hub.exec(login, "system:options-mm", None, "", "", None, release).await;
        let why = match res {
            Ok((o, _, _)) => o.message.unwrap_or_default(),
            Err(e) => format!("{e:?}"),
        };
        return Err(format!("The quote could not be placed: {why}"));
    }
    Ok(QuoteView { id: quote_id, responder: RESPONDER_MM.into(), login, bid, ask, theos, valid_until, usd_per_quote: usdq })
}

/// What an accept did.
#[derive(Debug)]
pub struct Accepted {
    pub out: Out,
    pub applied: Vec<super::outbox::Applied>,
    pub settled: bool,
    pub net: Ticks,
    pub rfq: Rfq,
}

/// Accepts quote `quote_id` of RFQ `id` for its requester: buy (`side` = buy, at the ask) or sell the strategy as
/// built, at a net no worse than `limit_net` (per unit, quote currency).
pub async fn accept(hub: &Hub, id: i64, login: i64, actor: &str, quote_id: i64, side: Side, limit_net: D, base: BookReq) -> Result<Accepted, RfqError> {
    let books = &hub.shared.books;
    let r = books.rfqs.get(id).filter(|r| r.login == login).ok_or(RfqError::NotFound)?;
    let now_ms = hub.shared.clock.now().timestamp_millis();
    if r.status != "open" || now_ms >= r.expires_ms {
        return Err(RfqError::Code("rfq_expired", "This request has expired. Ask for a new quote.".into()));
    }
    let q = r.quote.clone().filter(|q| q.id == quote_id).ok_or_else(|| RfqError::Code("quote_expired", "The quote has expired. Accept the new one.".into()))?;
    if q.valid_until <= now_ms {
        return Err(RfqError::Code("quote_expired", "The quote has expired. Accept the new one.".into()));
    }
    let tick = r.tick();
    let net = if side == Side::Buy { q.ask } else { q.bid }.ok_or_else(|| RfqError::Code("no_price", "No price on that side.".into()))?;
    let limit_ticks = {
        let t = limit_net / tick;
        let t = if side == Side::Buy { t.floor() } else { t.ceil() };
        rust_decimal::prelude::ToPrimitive::to_i64(&t).unwrap_or(0)
    };
    if (side == Side::Buy && net > limit_ticks) || (side == Side::Sell && net < limit_ticks) {
        return Err(RfqError::Code("price_moved", "The price moved past your limit.".into()));
    }
    // the requester's legs at their split prices: gates and reservations through `enter`
    let rl: Vec<RfqLeg> = r.legs.iter().map(|l| RfqLeg { series: l.series.clone(), spec: l.spec.clone(), side: l.side, ratio: l.ratio }).collect();
    let px = matching::rfq_split(&rl, &q.theos, net, side);
    let legs: Vec<RfqLegReq> = r
        .legs
        .iter()
        .zip(&px)
        .map(|(l, p)| RfqLegReq { series: l.series.clone(), side: if side == Side::Buy { l.side } else { l.side.opposite() }, contracts: l.spec.contracts(l.ratio * r.qty_steps), price: D::from(*p) * tick })
        .collect();
    let mut base = base;
    base.reduce_only = base.reduce_only || r.reduce_only;
    base.origin = format!("rfq:{}", r.id);
    let (key, orders, _) = entry::exec_typed(hub, login, actor, move |tx, env| ob::rfq_legs(tx, env, &legs, &base)).await?;
    let cmd = Cmd::RfqAccept { rfq: r.id, quote: quote_id, login, stp: r.stp, side, limit_net: limit_ticks, orders, at: hub.shared.clock.now().timestamp_millis() };
    let (out, applied, settled) = entry::call(hub, login, &key, cmd).await.map_err(|e| match e {
        entry::SubmitError::Exec(x) => RfqError::Exec(x),
        entry::SubmitError::Book(m) => RfqError::Code("book_unavailable", m),
    })?;
    let mut r2 = r.clone();
    if out.ok {
        r2.status = "filled".into();
        r2.combo = Some(r.id);
    } else if out.code.as_deref() == Some("quote_expired") {
        r2.quote = None;
    }
    books.rfqs.put(r2.clone());
    Ok(Accepted { out, applied, settled, net, rfq: r2 })
}

pub fn cancel(hub: &Hub, id: i64, login: i64) -> Result<Rfq, RfqError> {
    let books = &hub.shared.books;
    let mut r = books.rfqs.get(id).filter(|r| r.login == login).ok_or(RfqError::NotFound)?;
    if r.status == "open" {
        r.status = "cancelled".into();
        r.quote = None;
        books.rfqs.put(r.clone());
    }
    Ok(r)
}

/// Records the outcome of an RFQ in `book_rfqs`.
pub async fn record(pool: &sqlx::PgPool, r: &Rfq, data: Value) {
    let _ = sqlx::query("UPDATE book_rfqs SET status = $2, data = coalesce(data, '{}'::jsonb) || $3, updated_at = now() WHERE id = $1")
        .bind(r.id)
        .bind(&r.status)
        .bind(sqlx::types::Json(data))
        .execute(pool)
        .await;
}

/// Sweeps expired requests (scheduler, every second).
pub fn sweep(hub: &Hub) {
    let now_ms = hub.shared.clock.now().timestamp_millis();
    let mut m = hub.shared.books.rfqs.open.lock().unwrap();
    for r in m.values_mut() {
        if r.status == "open" && now_ms >= r.expires_ms {
            r.status = "expired".into();
            r.quote = None;
        }
    }
    m.retain(|_, r| r.status == "open" || now_ms - r.expires_ms < 120_000);
}

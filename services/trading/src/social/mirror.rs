//! Follower side of copy trading (D73): turns one committed master event into actions on the follower's copy
//! account. It runs inside the follower's shard (the single writer) as one transaction. Each step is an
//! attempt on a nested transaction, so one failed step (for example no margin for an open) never undoes the
//! steps before it.
//!
//! Links between master and follower tickets are not stored separately: every mirrored open carries a
//! client order id derived from the master ticket (`cp<sub>:<ticket>` for positions, `co<sub>:<ticket>` for
//! pending orders) and every mirrored exit a step key (`cx<sub>:<master event version>`). The follower state
//! remembers these ids (the engine's duplicate-submission guard), so the links replay with the follower's own
//! event stream and a repeated master event is never executed twice.
//!
//! MAM (multi-account manager) reuses the same follower logic on the client's own account: `MirrorCfg::mam`
//! switches the key prefixes (`mp`, `mo`, `mx`), the source tag (`mam`) and takes the volume of every open
//! from the allocation the copier computed across all linked accounts for that master event.

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;

use super::math::{self, Sizing};
use crate::engine::trade::{self, CloseMeta, DealerCtx, OrderPatch, OrderReq, PlaceResult, PositionPatch, apply_nbp, close_part, gate, market_open};
use crate::engine::{Env, Reject, Tx, dealing, metrics};
use crate::model::{DealEntry, DealReason, Mode, OrderStatus, Side, Source};
use crate::money::{D, ZERO};
use crate::state::{AccountState, Event};

/// Opens older than this during catch-up after a restart are not copied (closes still are).
pub const STALE_OPEN_SECS: i64 = 60;

#[derive(Clone, Debug)]
pub struct MirrorCfg {
    pub sub_id: i64,
    pub sizing: Sizing,
    pub max_lot: Option<D>,
    /// Upper-case symbols never copied.
    pub excluded: Vec<String>,
    /// Master nickname (messages and comments).
    pub master: String,
    /// False while paused or the master is suspended: only exits, SL/TP changes and cancels are mirrored.
    pub opens: bool,
    /// Replaying missed master events after a restart.
    pub catch_up: bool,
    /// Master equity (USD) when the master's transaction committed.
    pub master_equity_usd: D,
    /// MAM link instead of a copy subscription (`sub_id` is then the link id).
    pub mam: Option<MamCfg>,
    /// A9: the follower's own stop loss in pips on every copied trade (the tighter of it and the master's SL).
    pub auto_sl_pips: Option<D>,
}

/// MAM: the volume of each opening master event (by its stream version), already allocated across the
/// linked accounts; Err = skipped for this account with the reason.
#[derive(Clone, Debug, Default)]
pub struct MamCfg {
    pub volumes: HashMap<i64, Result<D, String>>,
}

impl MirrorCfg {
    fn keys(&self) -> Keys {
        if self.mam.is_some() { MAM_KEYS } else { COPY_KEYS }
    }
    fn source(&self) -> Source {
        if self.mam.is_some() { Source::Mam } else { Source::Copy }
    }
    fn label(&self) -> &'static str {
        if self.mam.is_some() { "mam" } else { "copy" }
    }
    fn platform(&self) -> &'static str {
        if self.mam.is_some() { "MAM" } else { "Copy" }
    }
    fn paused(&self) -> &'static str {
        if self.mam.is_some() { "the manager's account is frozen" } else { "copying is paused" }
    }
    /// Volume of a new open / pending order: the MAM allocation, or the copy sizing.
    fn open_size(&self, version: i64, master_vol: D, follower_eq: D, spec: &crate::specs::Spec) -> Result<D, String> {
        match &self.mam {
            Some(m) => m.volumes.get(&version).cloned().unwrap_or_else(|| Err("no allocation for this trade".into())),
            None => math::open_volume(&self.sizing, master_vol, self.master_equity_usd, follower_eq, spec, self.max_lot).ok_or_else(|| "below the minimum lot for your sizing".to_string()),
        }
    }
}

/// Client order id prefixes of mirrored opens, pending orders and exits.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Keys {
    pub open: &'static str,
    pub order: &'static str,
    pub step: &'static str,
}
pub const COPY_KEYS: Keys = Keys { open: "cp", order: "co", step: "cx" };
pub const MAM_KEYS: Keys = Keys { open: "mp", order: "mo", step: "mx" };

impl Keys {
    pub fn open(&self, sub: i64, t: i64) -> String {
        format!("{}{sub}:{t}", self.open)
    }
    pub fn order(&self, sub: i64, t: i64) -> String {
        format!("{}{sub}:{t}", self.order)
    }
    pub fn step(&self, sub: i64, version: i64) -> String {
        format!("{}{sub}:{version}", self.step)
    }
    /// The follower position following master position `t`.
    pub fn linked_position(&self, st: &AccountState, sub: i64, t: i64) -> Option<i64> {
        [self.open(sub, t), self.order(sub, t)].iter().filter_map(|k| st.client_ids.get(k)).find(|f| st.positions.contains_key(f)).copied()
    }
    /// The follower pending order following master order `t`.
    pub fn linked_order(&self, st: &AccountState, sub: i64, t: i64) -> Option<i64> {
        st.client_ids.get(&self.order(sub, t)).filter(|f| st.orders.contains_key(f)).copied()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LogEntry {
    pub action: &'static str,
    pub master_ticket: Option<i64>,
    pub follower_ticket: Option<i64>,
    pub volume: Option<D>,
    /// done | skipped | failed
    pub status: &'static str,
    pub message: String,
    /// A10 execution report: the master's and the follower's fill price, the slippage in pips (positive = worse
    /// for the follower) and the delay from the master's fill to the follower's (ms). Opens and closes only.
    pub master_price: Option<D>,
    pub follower_price: Option<D>,
    pub slippage_pips: Option<D>,
    pub delay_ms: Option<i64>,
}

impl LogEntry {
    pub fn new(action: &'static str, master: Option<i64>, status: &'static str, message: impl Into<String>) -> Self {
        Self { action, master_ticket: master, follower_ticket: None, volume: None, status, message: message.into(), master_price: None, follower_price: None, slippage_pips: None, delay_ms: None }
    }
    fn done(action: &'static str, master: i64, follower: Option<i64>, volume: Option<D>, message: impl Into<String>) -> Self {
        Self { follower_ticket: follower, volume, ..Self::new(action, Some(master), "done", message) }
    }
    /// Adds the execution figures of a fill: `buy` = the follower bought (an open of a buy, a close of a sell).
    fn priced(mut self, master: D, follower: D, buy: bool, pip: D) -> Self {
        self.master_price = Some(master);
        self.follower_price = Some(follower);
        if pip > ZERO {
            let diff = if buy { follower - master } else { master - follower };
            self.slippage_pips = Some(crate::money::rdp(diff / pip, 2));
        }
        self
    }
}

/// A9: the stop loss of a copied trade entered at `price`: the master's SL, tightened by the follower's own
/// `pips` from the entry (buy: the higher of the two; sell: the lower). Without pips the master's SL is kept.
pub fn auto_sl(side: Side, price: D, master_sl: Option<D>, pips: Option<D>, spec: &crate::specs::Spec) -> Option<D> {
    let Some(p) = pips.filter(|p| *p > ZERO) else { return master_sl };
    let dist = p * spec.pip_size;
    let own = spec.round_price(match side {
        Side::Buy => price - dist,
        Side::Sell => price + dist,
    });
    if own <= ZERO {
        return master_sl;
    }
    Some(match (master_sl, side) {
        (None, _) => own,
        (Some(m), Side::Buy) => m.max(own),
        (Some(m), Side::Sell) => m.min(own),
    })
}

pub fn open_key(sub: i64, master_ticket: i64) -> String {
    COPY_KEYS.open(sub, master_ticket)
}
pub fn order_key(sub: i64, master_ticket: i64) -> String {
    COPY_KEYS.order(sub, master_ticket)
}
/// Key of the (at most one) exit a master event causes; `version` is the master event's stream version.
pub fn step_key(sub: i64, version: i64) -> String {
    COPY_KEYS.step(sub, version)
}

/// The follower position copying master position `t`.
pub fn linked_position(st: &AccountState, sub: i64, t: i64) -> Option<i64> {
    COPY_KEYS.linked_position(st, sub, t)
}

/// The follower pending order copying master order `t`.
pub fn linked_order(st: &AccountState, sub: i64, t: i64) -> Option<i64> {
    COPY_KEYS.linked_order(st, sub, t)
}

/// Runs `f` on a copy of the transaction and keeps its events only if it succeeds.
fn attempt<T>(tx: &mut Tx, f: impl FnOnce(&mut Tx) -> Result<T, Reject>) -> Result<T, Reject> {
    let mut a = Tx::new(&tx.st);
    let out = f(&mut a)?;
    for e in a.events {
        tx.emit(e);
    }
    tx.notes.extend(a.notes);
    tx.audit.extend(a.audit);
    Ok(out)
}

fn equity_usd(tx: &Tx, env: &Env) -> D {
    metrics(env, &tx.st).equity / tx.st.account.usd_factor()
}

fn sltp_reject(e: &Reject) -> bool {
    matches!(e.code, "invalid_sl" | "invalid_tp" | "invalid_trailing")
}

/// Market close of `volume` lots of a follower position, source `copy`, with an idempotency key on the deal.
pub fn copy_close(tx: &mut Tx, env: &Env, ticket: i64, volume: D, key: String, comment: String) -> Result<(i64, D), Reject> {
    close_as(tx, env, ticket, volume, key, comment, Source::Copy)
}

/// Market close of `volume` lots of a follower position with the given source tag (`copy` or `mam`).
pub fn close_as(tx: &mut Tx, env: &Env, ticket: i64, volume: D, key: String, comment: String, source: Source) -> Result<(i64, D), Reject> {
    let p = tx.st.positions.get(&ticket).cloned().ok_or_else(|| Reject::new("not_found", format!("Position #{ticket} not found")))?;
    let spec = env.spec(&p.symbol)?.clone();
    gate(env, &tx.st, &p.symbol, false, ZERO, None)?;
    market_open(env, &spec)?;
    let q = env.live_quote(&tx.st.account, &p.symbol)?;
    let px = q.close_price(p.side);
    let meta = CloseMeta { reason: DealReason::Client, entry: DealEntry::Out, source, comment, staff: None, reason_code: None, price_correction: false, order_ticket: None, client_order_id: Some(key) };
    let out = close_part(tx, env, ticket, volume.min(p.volume), px, meta)?;
    let what = if volume < p.volume { "partially closed" } else { "closed" };
    tx.note("close", format!("#{ticket} {} {} {} {what} at {} ({})", p.side.as_str(), volume.min(p.volume).normalize(), p.symbol, px.normalize(), source.as_str()), json!({"ticket": ticket, "dealId": out.0, "profit": crate::money::num(out.1)}));
    apply_nbp(tx, env);
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
fn copy_open(tx: &mut Tx, env: &Env, cfg: &MirrorCfg, key: String, master_ticket: i64, master_price: Option<D>, symbol: &str, side: Side, volume: D, sl: Option<D>, tp: Option<D>, trailing: Option<i64>) -> LogEntry {
    let spec = env.spec(symbol).ok().cloned();
    let quote = env.live_quote(&tx.st.account, symbol).ok().map(|q| q.open_price(side));
    // A9: the follower's own stop loss, from the price the copy is about to fill at
    let sl = match (&spec, quote) {
        (Some(sp), Some(px)) if cfg.auto_sl_pips.is_some() => auto_sl(side, px, sl, cfg.auto_sl_pips, sp),
        _ => sl,
    };
    let mut req = OrderReq::market(symbol, side, volume);
    req.sl = sl;
    req.tp = tp;
    req.trailing_points = trailing;
    req.source = cfg.source();
    req.platform = cfg.platform().into();
    req.comment = format!("{} #{master_ticket}", cfg.label());
    req.client_order_id = Some(key);
    let first = attempt(tx, |t| trade::place_order(t, env, req.clone()));
    let (res, note) = match first {
        Err(e) if sltp_reject(&e) && (sl.is_some() || tp.is_some() || trailing.is_some()) => {
            let bare = OrderReq { sl: None, tp: None, trailing_points: None, ..req };
            (attempt(tx, |t| trade::place_order(t, env, bare)), format!(" without SL/TP ({})", e.message))
        }
        other => (other, String::new()),
    };
    match res {
        Ok(PlaceResult::Filled { position_ticket, price, .. }) => {
            let e = LogEntry::done("open", master_ticket, position_ticket, Some(volume), format!("{} {} {symbol} at {}{note}", side.as_str(), volume.normalize(), price.normalize()));
            match (master_price, &spec) {
                (Some(mp), Some(sp)) => e.priced(mp, price, side == Side::Buy, sp.pip_size),
                _ => e,
            }
        }
        Ok(PlaceResult::Duplicate { ticket }) => LogEntry { follower_ticket: Some(ticket), ..LogEntry::new("open", Some(master_ticket), "skipped", "already copied") },
        Ok(PlaceResult::Pending { .. }) => LogEntry::new("open", Some(master_ticket), "failed", "unexpected pending result"),
        Err(e) => LogEntry { volume: Some(volume), ..LogEntry::new("open", Some(master_ticket), "failed", format!("{}: {}", e.code, e.message)) },
    }
}

#[allow(clippy::too_many_arguments)]
fn close_linked(tx: &mut Tx, env: &Env, cfg: &MirrorCfg, f: i64, volume: D, key: String, master_ticket: i64, master_price: Option<D>, action: &'static str) -> LogEntry {
    if tx.st.client_ids.contains_key(&key) {
        return LogEntry { follower_ticket: Some(f), ..LogEntry::new(action, Some(master_ticket), "skipped", "already done") };
    }
    let comment = format!("{} #{master_ticket} {}", cfg.label(), cfg.master).chars().take(64).collect();
    let source = cfg.source();
    // the price close_as fills at (same quote, same transaction)
    let fill = tx.st.positions.get(&f).and_then(|p| env.live_quote(&tx.st.account, &p.symbol).ok().map(|q| (q.close_price(p.side), p.side, env.spec(&p.symbol).map(|s| s.pip_size).unwrap_or(ZERO))));
    match attempt(tx, |t| close_as(t, env, f, volume, key, comment, source)) {
        Ok((_, profit)) => {
            let e = LogEntry::done(action, master_ticket, Some(f), Some(volume), format!("profit {}", profit.normalize()));
            match (master_price, fill) {
                (Some(mp), Some((px, side, pip))) => e.priced(mp, px, side == Side::Sell, pip),
                _ => e,
            }
        }
        Err(e) => LogEntry { follower_ticket: Some(f), volume: Some(volume), ..LogEntry::new(action, Some(master_ticket), "failed", format!("{}: {}", e.code, e.message)) },
    }
}

/// Mirrors one master event (`version` = its stream version, `at` = its commit time) onto the follower.
pub fn mirror(tx: &mut Tx, env: &Env, cfg: &MirrorCfg, version: i64, at: DateTime<Utc>, ev: &Event) -> Vec<LogEntry> {
    let sub = cfg.sub_id;
    let k = cfg.keys();
    let stale = cfg.catch_up && env.now - at > Duration::seconds(STALE_OPEN_SECS);
    let excluded = |sym: &str| cfg.excluded.iter().any(|s| s.eq_ignore_ascii_case(sym));
    let mut out = Vec::new();
    match ev {
        /* ---------- opens (market fills and pending fills) ---------- */
        Event::PositionOpened { position: p, deal: Some(_) } if p.option.is_some() => {
            out.push(LogEntry::new("open", Some(p.ticket), "skipped", format!("{}: options are not copied", p.symbol)));
        }
        Event::PositionOpened { position: p, deal: Some(d) } => {
            if tx.st.client_ids.contains_key(&k.open(sub, p.ticket)) {
                return out; // already copied
            }
            // the master's pending order filled: replace a still-pending copy of it by a market fill
            if let Some(ot) = d.order_ticket
                && let Some(&f) = tx.st.client_ids.get(&k.order(sub, ot))
            {
                if tx.st.orders.contains_key(&f) {
                    match attempt(tx, |t| trade::cancel_order(t, env, f, &format!("{}: master order filled", cfg.label()))) {
                        Ok(_) => out.push(LogEntry { follower_ticket: Some(f), ..LogEntry::new("cancel", Some(ot), "done", "pending copy replaced by a market fill") }),
                        Err(e) => out.push(LogEntry::new("cancel", Some(ot), "failed", e.message)),
                    }
                } else if tx.st.positions.contains_key(&f) {
                    out.push(LogEntry { follower_ticket: Some(f), ..LogEntry::new("open", Some(p.ticket), "done", "pending copy already filled") });
                    return out;
                }
            }
            if excluded(&p.symbol) {
                out.push(LogEntry::new("open", Some(p.ticket), "skipped", format!("{} is excluded", p.symbol)));
                return out;
            }
            if !cfg.opens {
                out.push(LogEntry::new("open", Some(p.ticket), "skipped", cfg.paused()));
                return out;
            }
            if stale {
                out.push(LogEntry::new("open", Some(p.ticket), "skipped", "missed while the engine was down (older than 60 s)"));
                return out;
            }
            let Ok(spec) = env.spec(&p.symbol).cloned() else { return out };
            let fe = equity_usd(tx, env);
            match cfg.open_size(version, p.volume, fe, &spec) {
                Err(why) => out.push(LogEntry::new("open", Some(p.ticket), "skipped", why)),
                Ok(v) => {
                    let e = copy_open(tx, env, cfg, k.open(sub, p.ticket), p.ticket, Some(d.price), &p.symbol, p.side, v, p.sl, p.tp, p.trailing.as_ref().map(|t| t.distance_points));
                    out.push(e);
                }
            }
        }
        Event::PositionOpened { deal: None, .. } => {} // book split child: not a trade

        /* ---------- volume added (netting add, dealer add) ---------- */
        Event::PositionUpdated { position: np, deal: Some(d), change } if change == "volume_added" && d.entry == DealEntry::In => {
            if excluded(&np.symbol) {
                return out;
            }
            let key = k.step(sub, version);
            if tx.st.client_ids.contains_key(&key) {
                return out;
            }
            if !cfg.opens {
                out.push(LogEntry::new("add", Some(np.ticket), "skipped", cfg.paused()));
                return out;
            }
            if stale {
                out.push(LogEntry::new("add", Some(np.ticket), "skipped", "missed while the engine was down"));
                return out;
            }
            let Ok(spec) = env.spec(&np.symbol).cloned() else { return out };
            let fe = equity_usd(tx, env);
            match k.linked_position(&tx.st, sub, np.ticket) {
                None => {
                    // not copied yet (e.g. the first open was below the minimum lot): follow the whole position
                    // (MAM: the allocation of this event covers the added volume)
                    match cfg.open_size(version, np.volume, fe, &spec) {
                        Err(why) => out.push(LogEntry::new("add", Some(np.ticket), "skipped", why)),
                        Ok(v) => out.push(copy_open(tx, env, cfg, k.open(sub, np.ticket), np.ticket, Some(d.price), &np.symbol, np.side, v, np.sl, np.tp, None)),
                    }
                }
                Some(f) => {
                    let fv = tx.st.positions[&f].volume;
                    let size = match &cfg.mam {
                        Some(_) => cfg.open_size(version, d.volume, fe, &spec).ok(),
                        None => math::add_volume(&cfg.sizing, d.volume, np.volume - d.volume, fv, cfg.master_equity_usd, fe, &spec, cfg.max_lot),
                    };
                    let Some(v) = size else {
                        out.push(LogEntry::new("add", Some(np.ticket), "skipped", "below the minimum lot for your sizing"));
                        return out;
                    };
                    let res = if tx.st.account.mode == Mode::Netting {
                        let mut req = OrderReq::market(&np.symbol, np.side, v);
                        req.source = cfg.source();
                        req.platform = cfg.platform().into();
                        req.comment = format!("{} add #{}", cfg.label(), np.ticket);
                        req.client_order_id = Some(key);
                        attempt(tx, |t| trade::place_order(t, env, req)).map(|_| ())
                    } else {
                        let dealer = if cfg.mam.is_some() { DealerCtx { staff: "MAM".into(), reason_code: "MAM".into(), force: false } } else { DealerCtx { staff: "Copy trading".into(), reason_code: "COPY".into(), force: false } };
                        attempt(tx, |t| dealing::add_volume(t, env, f, v, &dealer)).map(|_| ())
                    };
                    out.push(match res {
                        Ok(()) => LogEntry::done("add", np.ticket, Some(f), Some(v), "volume added"),
                        Err(e) => LogEntry { follower_ticket: Some(f), volume: Some(v), ..LogEntry::new("add", Some(np.ticket), "failed", e.message) },
                    });
                }
            }
        }

        /* ---------- SL / TP / trailing ---------- */
        Event::PositionUpdated { position: np, deal: None, change } if change == "modified" => {
            let Some(f) = k.linked_position(&tx.st, sub, np.ticket) else { return out };
            let fp = &tx.st.positions[&f];
            let tr = np.trailing.as_ref().map(|t| t.distance_points);
            // A9: the follower's own SL (from its entry) still caps the master's new SL
            let sl = match env.spec(&fp.symbol) {
                Ok(sp) if cfg.auto_sl_pips.is_some() => auto_sl(fp.side, fp.open_price, np.sl, cfg.auto_sl_pips, sp),
                _ => np.sl,
            };
            if fp.sl == sl && fp.tp == np.tp && fp.trailing.as_ref().map(|t| t.distance_points) == tr {
                return out;
            }
            let patch = PositionPatch { sl: Some(sl), tp: Some(np.tp), trailing_points: Some(tr) };
            out.push(match attempt(tx, |t| trade::modify_position(t, env, f, patch, None)) {
                Ok(_) => LogEntry::done("modify", np.ticket, Some(f), None, format!("SL {} TP {}", sl.map(|v| v.normalize().to_string()).unwrap_or("–".into()), np.tp.map(|v| v.normalize().to_string()).unwrap_or("–".into()))),
                Err(e) if e.code == "no_change" => return out,
                Err(e) => LogEntry { follower_ticket: Some(f), ..LogEntry::new("modify", Some(np.ticket), "failed", e.message) },
            });
        }

        /* ---------- closes ---------- */
        Event::PositionClosed { deal: d, .. } if d.option.is_some() => {} // options are never copied, so never linked
        Event::PositionClosed { deal: d, position: rest } => {
            let Some(f) = k.linked_position(&tx.st, sub, d.position_ticket) else { return out };
            let fv = tx.st.positions[&f].volume;
            let Ok(spec) = env.spec(&d.symbol).cloned() else { return out };
            let (vol, action) = match rest {
                None => (Some(fv), "close"),
                Some(r) => (math::close_volume(fv, d.volume, r.volume, &spec), "partial_close"),
            };
            match vol {
                None => out.push(LogEntry { follower_ticket: Some(f), ..LogEntry::new("partial_close", Some(d.position_ticket), "skipped", "the closed share rounds to less than one lot step") }),
                Some(v) => out.push(close_linked(tx, env, cfg, f, v, k.step(sub, version), d.position_ticket, Some(d.price), if v >= fv { "close" } else { action })),
            }
        }
        Event::PositionRemoved { ticket, .. } => {
            if let Some(f) = k.linked_position(&tx.st, sub, *ticket) {
                let fv = tx.st.positions[&f].volume;
                out.push(close_linked(tx, env, cfg, f, fv, k.step(sub, version), *ticket, None, "close"));
            }
        }

        /* ---------- pending orders ---------- */
        Event::OrderPlaced { order: o } if o.option.is_some() => {
            out.push(LogEntry::new("order", Some(o.ticket), "skipped", "options orders are not copied"));
        }
        Event::OrderPlaced { order: o } => {
            let key = k.order(sub, o.ticket);
            if tx.st.client_ids.contains_key(&key) {
                return out;
            }
            if excluded(&o.symbol) {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", format!("{} is excluded", o.symbol)));
                return out;
            }
            if !cfg.opens {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", cfg.paused()));
                return out;
            }
            if stale {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", "missed while the engine was down"));
                return out;
            }
            let Ok(spec) = env.spec(&o.symbol).cloned() else { return out };
            let fe = equity_usd(tx, env);
            let v = match cfg.open_size(version, o.volume, fe, &spec) {
                Ok(v) => v,
                Err(why) => {
                    out.push(LogEntry::new("order", Some(o.ticket), "skipped", why));
                    return out;
                }
            };
            let req = OrderReq {
                symbol: o.symbol.clone(),
                side: o.side,
                kind: o.kind,
                volume: v,
                price: Some(o.price),
                stop_limit: o.stop_limit,
                sl: auto_sl(o.side, o.price, o.sl, cfg.auto_sl_pips, &spec),
                tp: o.tp,
                trailing_points: o.trailing.as_ref().map(|t| t.distance_points),
                expiry: o.expiry,
                expiry_at: o.expiry_at,
                deviation_points: None,
                requested_price: None,
                oco_with: o.oco.and_then(|p| k.linked_order(&tx.st, sub, p)),
                source: cfg.source(),
                platform: cfg.platform().into(),
                comment: format!("{} #{}", cfg.label(), o.ticket),
                client_order_id: Some(key),
                book: None,
                dealer: None,
            };
            let first = attempt(tx, |t| trade::place_order(t, env, req.clone()));
            let res = match first {
                Err(e) if sltp_reject(&e) => attempt(tx, |t| trade::place_order(t, env, OrderReq { sl: None, tp: None, trailing_points: None, ..req })),
                other => other,
            };
            out.push(match res {
                Ok(PlaceResult::Pending { ticket, price, .. }) => LogEntry::done("order", o.ticket, Some(ticket), Some(v), format!("{} {} {} {} at {}", o.kind.as_str(), o.side.as_str(), v.normalize(), o.symbol, price.normalize())),
                Ok(PlaceResult::Duplicate { .. }) => return out,
                Ok(PlaceResult::Filled { .. }) => LogEntry::new("order", Some(o.ticket), "failed", "unexpected fill"),
                Err(e) => LogEntry { volume: Some(v), ..LogEntry::new("order", Some(o.ticket), "failed", format!("{}: {}", e.code, e.message)) },
            });
        }
        Event::OrderUpdated { order: o, change } if change == "modified" => {
            let Some(f) = k.linked_order(&tx.st, sub, o.ticket) else { return out };
            let fo = tx.st.orders[&f].clone();
            let Ok(spec) = env.spec(&o.symbol).cloned() else { return out };
            // MAM: the allocated volume of a pending order is kept (price, SL/TP and expiry follow)
            let volume = if cfg.mam.is_some() || cfg.sizing.mode == math::SizingMode::FixedLot {
                None
            } else {
                math::open_volume(&cfg.sizing, o.volume, cfg.master_equity_usd, equity_usd(tx, env), &spec, cfg.max_lot).filter(|v| *v != fo.volume)
            };
            let osl = auto_sl(o.side, o.price, o.sl, cfg.auto_sl_pips, &spec);
            let patch = OrderPatch {
                price: (o.price != fo.price).then_some(o.price),
                stop_limit: o.stop_limit.filter(|l| Some(*l) != fo.stop_limit),
                volume,
                sl: (osl != fo.sl).then_some(osl),
                tp: (o.tp != fo.tp).then_some(o.tp),
                trailing_points: (o.trailing != fo.trailing).then(|| o.trailing.as_ref().map(|t| t.distance_points)),
                expiry: (o.expiry != fo.expiry || o.expiry_at != fo.expiry_at).then_some(o.expiry),
                expiry_at: o.expiry_at,
            };
            out.push(match attempt(tx, |t| trade::modify_order(t, env, f, patch, None)) {
                Ok(_) => LogEntry::done("modify_order", o.ticket, Some(f), volume, "order modified"),
                Err(e) if e.code == "no_change" => return out,
                Err(e) => LogEntry { follower_ticket: Some(f), ..LogEntry::new("modify_order", Some(o.ticket), "failed", e.message) },
            });
        }
        Event::OrderRemoved { ticket, status, .. } if *status != OrderStatus::Filled => {
            if let Some(f) = k.linked_order(&tx.st, sub, *ticket) {
                out.push(match attempt(tx, |t| trade::cancel_order(t, env, f, &format!("{}: master order removed", cfg.label()))) {
                    Ok(_) => LogEntry::done("cancel", *ticket, Some(f), None, format!("master order {}", status.as_str())),
                    Err(e) => LogEntry { follower_ticket: Some(f), ..LogEntry::new("cancel", Some(*ticket), "failed", e.message) },
                });
            } else if let Some(&f) = tx.st.client_ids.get(&k.order(sub, *ticket))
                && tx.st.positions.contains_key(&f)
            {
                // the copy filled on its own but the master's order never did: close it to stay in line
                let fv = tx.st.positions[&f].volume;
                out.push(close_linked(tx, env, cfg, f, fv, k.step(sub, version), *ticket, None, "close"));
            }
        }
        _ => {}
    }
    let delay = (env.now - at).num_milliseconds().max(0);
    for e in out.iter_mut().filter(|e| e.status == "done" && e.master_price.is_some()) {
        e.delay_ms = Some(delay);
    }
    out
}

/// Cancels every pending order and closes every position of a copy account (stop copying, equity stop,
/// emergency stop). Returns (closed tickets, failures).
pub fn close_all(tx: &mut Tx, env: &Env, sub: i64, reason: &str) -> (Vec<i64>, Vec<(i64, String)>) {
    let mut done = Vec::new();
    let mut failed = Vec::new();
    let orders: Vec<i64> = tx.st.orders.keys().copied().collect();
    for t in orders {
        match attempt(tx, |x| trade::cancel_order(x, env, t, reason)) {
            Ok(_) => done.push(t),
            Err(e) => failed.push((t, e.message)),
        }
    }
    let positions: Vec<(i64, D, bool)> = tx.st.positions.values().map(|p| (p.ticket, p.volume, p.option.is_some())).collect();
    for (t, v, is_option) in positions {
        if is_option {
            let c = crate::engine::options::OptClose { comment: format!("copy stopped: {reason}").chars().take(64).collect(), ..crate::engine::options::OptClose::client() };
            match attempt(tx, |x| crate::engine::options::close(x, env, t, c)) {
                Ok(_) => done.push(t),
                Err(e) => failed.push((t, e.message)),
            }
            continue;
        }
        let key = format!("cs{sub}:{t}:{}", tx.st.version);
        match attempt(tx, |x| copy_close(x, env, t, v, key, format!("copy stopped: {reason}").chars().take(64).collect())) {
            Ok(_) => done.push(t),
            Err(e) => failed.push((t, e.message)),
        }
    }
    (done, failed)
}

/// Cancels the pending orders and closes the positions a MAM link placed on a client account (source `mam`);
/// the client's own trades are never touched. Returns (closed tickets, failures).
pub fn close_mam(tx: &mut Tx, env: &Env, link: i64, reason: &str) -> (Vec<i64>, Vec<(i64, String)>) {
    let mut done = Vec::new();
    let mut failed = Vec::new();
    let orders: Vec<i64> = tx.st.orders.values().filter(|o| o.source == Source::Mam).map(|o| o.ticket).collect();
    for t in orders {
        match attempt(tx, |x| trade::cancel_order(x, env, t, reason)) {
            Ok(_) => done.push(t),
            Err(e) => failed.push((t, e.message)),
        }
    }
    let positions: Vec<(i64, D)> = tx.st.positions.values().filter(|p| p.source == Source::Mam).map(|p| (p.ticket, p.volume)).collect();
    for (t, v) in positions {
        let key = format!("ms{link}:{t}:{}", tx.st.version);
        match attempt(tx, |x| close_as(x, env, t, v, key, format!("mam stopped: {reason}").chars().take(64).collect(), Source::Mam)) {
            Ok(_) => done.push(t),
            Err(e) => failed.push((t, e.message)),
        }
    }
    (done, failed)
}

/// Follower protection (D70): Some(reason) when the equity stop or the max drawdown is hit.
pub fn breach(equity: D, peak: D, equity_stop: Option<D>, max_dd_pct: Option<D>) -> Option<&'static str> {
    if let Some(s) = equity_stop.filter(|s| *s > ZERO)
        && equity <= s
    {
        return Some("equity_stop");
    }
    if let Some(dd) = max_dd_pct.filter(|d| *d > ZERO)
        && peak > ZERO
        && equity <= peak * (D::ONE_HUNDRED - dd) / D::ONE_HUNDRED
    {
        return Some("max_dd");
    }
    None
}

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

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use serde_json::json;

use super::math::{self, Sizing};
use crate::engine::trade::{self, CloseMeta, DealerCtx, OrderPatch, OrderReq, PlaceResult, PositionPatch, apply_nbp, close_part, gate, market_open};
use crate::engine::{Env, Reject, Tx, dealing, metrics};
use crate::model::{DealEntry, DealReason, Mode, OrderStatus, Source};
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
}

impl LogEntry {
    fn new(action: &'static str, master: Option<i64>, status: &'static str, message: impl Into<String>) -> Self {
        Self { action, master_ticket: master, follower_ticket: None, volume: None, status, message: message.into() }
    }
    fn done(action: &'static str, master: i64, follower: Option<i64>, volume: Option<D>, message: impl Into<String>) -> Self {
        Self { action, master_ticket: Some(master), follower_ticket: follower, volume, status: "done", message: message.into() }
    }
}

pub fn open_key(sub: i64, master_ticket: i64) -> String {
    format!("cp{sub}:{master_ticket}")
}
pub fn order_key(sub: i64, master_ticket: i64) -> String {
    format!("co{sub}:{master_ticket}")
}
/// Key of the (at most one) exit a master event causes; `version` is the master event's stream version.
pub fn step_key(sub: i64, version: i64) -> String {
    format!("cx{sub}:{version}")
}

/// The follower position copying master position `t`.
pub fn linked_position(st: &AccountState, sub: i64, t: i64) -> Option<i64> {
    [open_key(sub, t), order_key(sub, t)].iter().filter_map(|k| st.client_ids.get(k)).find(|f| st.positions.contains_key(f)).copied()
}

/// The follower pending order copying master order `t`.
pub fn linked_order(st: &AccountState, sub: i64, t: i64) -> Option<i64> {
    st.client_ids.get(&order_key(sub, t)).filter(|f| st.orders.contains_key(f)).copied()
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
    let p = tx.st.positions.get(&ticket).cloned().ok_or_else(|| Reject::new("not_found", format!("Position #{ticket} not found")))?;
    let spec = env.spec(&p.symbol)?.clone();
    gate(env, &tx.st, &p.symbol, false, ZERO, None)?;
    market_open(env, &spec)?;
    let q = env.live_quote(&tx.st.account, &p.symbol)?;
    let px = q.close_price(p.side);
    let meta = CloseMeta { reason: DealReason::Client, entry: DealEntry::Out, source: Source::Copy, comment, staff: None, reason_code: None, price_correction: false, order_ticket: None, client_order_id: Some(key) };
    let out = close_part(tx, env, ticket, volume.min(p.volume), px, meta)?;
    let what = if volume < p.volume { "partially closed" } else { "closed" };
    tx.note("close", format!("#{ticket} {} {} {} {what} at {} (copy)", p.side.as_str(), volume.min(p.volume).normalize(), p.symbol, px.normalize()), json!({"ticket": ticket, "dealId": out.0, "profit": crate::money::num(out.1)}));
    apply_nbp(tx, env);
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
fn copy_open(tx: &mut Tx, env: &Env, key: String, master_ticket: i64, symbol: &str, side: crate::model::Side, volume: D, sl: Option<D>, tp: Option<D>, trailing: Option<i64>) -> LogEntry {
    let mut req = OrderReq::market(symbol, side, volume);
    req.sl = sl;
    req.tp = tp;
    req.trailing_points = trailing;
    req.source = Source::Copy;
    req.platform = "Copy".into();
    req.comment = format!("copy #{master_ticket}");
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
        Ok(PlaceResult::Filled { position_ticket, price, .. }) => LogEntry::done("open", master_ticket, position_ticket, Some(volume), format!("{} {} {symbol} at {}{note}", side.as_str(), volume.normalize(), price.normalize())),
        Ok(PlaceResult::Duplicate { ticket }) => LogEntry { follower_ticket: Some(ticket), ..LogEntry::new("open", Some(master_ticket), "skipped", "already copied") },
        Ok(PlaceResult::Pending { .. }) => LogEntry::new("open", Some(master_ticket), "failed", "unexpected pending result"),
        Err(e) => LogEntry { volume: Some(volume), ..LogEntry::new("open", Some(master_ticket), "failed", format!("{}: {}", e.code, e.message)) },
    }
}

fn close_linked(tx: &mut Tx, env: &Env, cfg: &MirrorCfg, f: i64, volume: D, key: String, master_ticket: i64, action: &'static str) -> LogEntry {
    if tx.st.client_ids.contains_key(&key) {
        return LogEntry { follower_ticket: Some(f), ..LogEntry::new(action, Some(master_ticket), "skipped", "already done") };
    }
    let comment = format!("copy #{master_ticket} {}", cfg.master).chars().take(64).collect();
    match attempt(tx, |t| copy_close(t, env, f, volume, key, comment)) {
        Ok((_, profit)) => LogEntry::done(action, master_ticket, Some(f), Some(volume), format!("profit {}", profit.normalize())),
        Err(e) => LogEntry { follower_ticket: Some(f), volume: Some(volume), ..LogEntry::new(action, Some(master_ticket), "failed", format!("{}: {}", e.code, e.message)) },
    }
}

/// Mirrors one master event (`version` = its stream version, `at` = its commit time) onto the follower.
pub fn mirror(tx: &mut Tx, env: &Env, cfg: &MirrorCfg, version: i64, at: DateTime<Utc>, ev: &Event) -> Vec<LogEntry> {
    let sub = cfg.sub_id;
    let stale = cfg.catch_up && env.now - at > Duration::seconds(STALE_OPEN_SECS);
    let excluded = |sym: &str| cfg.excluded.iter().any(|s| s.eq_ignore_ascii_case(sym));
    let mut out = Vec::new();
    match ev {
        /* ---------- opens (market fills and pending fills) ---------- */
        Event::PositionOpened { position: p, deal: Some(d) } => {
            if tx.st.client_ids.contains_key(&open_key(sub, p.ticket)) {
                return out; // already copied
            }
            // the master's pending order filled: replace a still-pending copy of it by a market fill
            if let Some(ot) = d.order_ticket
                && let Some(&f) = tx.st.client_ids.get(&order_key(sub, ot))
            {
                if tx.st.orders.contains_key(&f) {
                    match attempt(tx, |t| trade::cancel_order(t, env, f, "copy: master order filled")) {
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
                out.push(LogEntry::new("open", Some(p.ticket), "skipped", "copying is paused"));
                return out;
            }
            if stale {
                out.push(LogEntry::new("open", Some(p.ticket), "skipped", "missed while the engine was down (older than 60 s)"));
                return out;
            }
            let Ok(spec) = env.spec(&p.symbol).cloned() else { return out };
            let fe = equity_usd(tx, env);
            match math::open_volume(&cfg.sizing, p.volume, cfg.master_equity_usd, fe, &spec, cfg.max_lot) {
                None => out.push(LogEntry::new("open", Some(p.ticket), "skipped", "below the minimum lot for your sizing")),
                Some(v) => {
                    let e = copy_open(tx, env, open_key(sub, p.ticket), p.ticket, &p.symbol, p.side, v, p.sl, p.tp, p.trailing.as_ref().map(|t| t.distance_points));
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
            let key = step_key(sub, version);
            if tx.st.client_ids.contains_key(&key) {
                return out;
            }
            if !cfg.opens {
                out.push(LogEntry::new("add", Some(np.ticket), "skipped", "copying is paused"));
                return out;
            }
            if stale {
                out.push(LogEntry::new("add", Some(np.ticket), "skipped", "missed while the engine was down"));
                return out;
            }
            let Ok(spec) = env.spec(&np.symbol).cloned() else { return out };
            let fe = equity_usd(tx, env);
            match linked_position(&tx.st, sub, np.ticket) {
                None => {
                    // not copied yet (e.g. the first open was below the minimum lot): follow the whole position
                    match math::open_volume(&cfg.sizing, np.volume, cfg.master_equity_usd, fe, &spec, cfg.max_lot) {
                        None => out.push(LogEntry::new("add", Some(np.ticket), "skipped", "below the minimum lot for your sizing")),
                        Some(v) => out.push(copy_open(tx, env, open_key(sub, np.ticket), np.ticket, &np.symbol, np.side, v, np.sl, np.tp, None)),
                    }
                }
                Some(f) => {
                    let fv = tx.st.positions[&f].volume;
                    let Some(v) = math::add_volume(&cfg.sizing, d.volume, np.volume - d.volume, fv, cfg.master_equity_usd, fe, &spec, cfg.max_lot) else {
                        out.push(LogEntry::new("add", Some(np.ticket), "skipped", "below the minimum lot for your sizing"));
                        return out;
                    };
                    let res = if tx.st.account.mode == Mode::Netting {
                        let mut req = OrderReq::market(&np.symbol, np.side, v);
                        req.source = Source::Copy;
                        req.platform = "Copy".into();
                        req.comment = format!("copy add #{}", np.ticket);
                        req.client_order_id = Some(key);
                        attempt(tx, |t| trade::place_order(t, env, req)).map(|_| ())
                    } else {
                        let dealer = DealerCtx { staff: "Copy trading".into(), reason_code: "COPY".into(), force: false };
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
            let Some(f) = linked_position(&tx.st, sub, np.ticket) else { return out };
            let fp = &tx.st.positions[&f];
            let tr = np.trailing.as_ref().map(|t| t.distance_points);
            if fp.sl == np.sl && fp.tp == np.tp && fp.trailing.as_ref().map(|t| t.distance_points) == tr {
                return out;
            }
            let patch = PositionPatch { sl: Some(np.sl), tp: Some(np.tp), trailing_points: Some(tr) };
            out.push(match attempt(tx, |t| trade::modify_position(t, env, f, patch, None)) {
                Ok(_) => LogEntry::done("modify", np.ticket, Some(f), None, format!("SL {} TP {}", np.sl.map(|v| v.normalize().to_string()).unwrap_or("–".into()), np.tp.map(|v| v.normalize().to_string()).unwrap_or("–".into()))),
                Err(e) if e.code == "no_change" => return out,
                Err(e) => LogEntry { follower_ticket: Some(f), ..LogEntry::new("modify", Some(np.ticket), "failed", e.message) },
            });
        }

        /* ---------- closes ---------- */
        Event::PositionClosed { deal: d, position: rest } => {
            let Some(f) = linked_position(&tx.st, sub, d.position_ticket) else { return out };
            let fv = tx.st.positions[&f].volume;
            let Ok(spec) = env.spec(&d.symbol).cloned() else { return out };
            let (vol, action) = match rest {
                None => (Some(fv), "close"),
                Some(r) => (math::close_volume(fv, d.volume, r.volume, &spec), "partial_close"),
            };
            match vol {
                None => out.push(LogEntry { follower_ticket: Some(f), ..LogEntry::new("partial_close", Some(d.position_ticket), "skipped", "the closed share rounds to less than one lot step") }),
                Some(v) => out.push(close_linked(tx, env, cfg, f, v, step_key(sub, version), d.position_ticket, if v >= fv { "close" } else { action })),
            }
        }
        Event::PositionRemoved { ticket, .. } => {
            if let Some(f) = linked_position(&tx.st, sub, *ticket) {
                let fv = tx.st.positions[&f].volume;
                out.push(close_linked(tx, env, cfg, f, fv, step_key(sub, version), *ticket, "close"));
            }
        }

        /* ---------- pending orders ---------- */
        Event::OrderPlaced { order: o } => {
            let key = order_key(sub, o.ticket);
            if tx.st.client_ids.contains_key(&key) {
                return out;
            }
            if excluded(&o.symbol) {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", format!("{} is excluded", o.symbol)));
                return out;
            }
            if !cfg.opens {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", "copying is paused"));
                return out;
            }
            if stale {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", "missed while the engine was down"));
                return out;
            }
            let Ok(spec) = env.spec(&o.symbol).cloned() else { return out };
            let fe = equity_usd(tx, env);
            let Some(v) = math::open_volume(&cfg.sizing, o.volume, cfg.master_equity_usd, fe, &spec, cfg.max_lot) else {
                out.push(LogEntry::new("order", Some(o.ticket), "skipped", "below the minimum lot for your sizing"));
                return out;
            };
            let req = OrderReq {
                symbol: o.symbol.clone(),
                side: o.side,
                kind: o.kind,
                volume: v,
                price: Some(o.price),
                stop_limit: o.stop_limit,
                sl: o.sl,
                tp: o.tp,
                trailing_points: o.trailing.as_ref().map(|t| t.distance_points),
                expiry: o.expiry,
                expiry_at: o.expiry_at,
                deviation_points: None,
                requested_price: None,
                oco_with: o.oco.and_then(|p| linked_order(&tx.st, sub, p)),
                source: Source::Copy,
                platform: "Copy".into(),
                comment: format!("copy #{}", o.ticket),
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
            let Some(f) = linked_order(&tx.st, sub, o.ticket) else { return out };
            let fo = tx.st.orders[&f].clone();
            let Ok(spec) = env.spec(&o.symbol).cloned() else { return out };
            let volume = if cfg.sizing.mode == math::SizingMode::FixedLot {
                None
            } else {
                math::open_volume(&cfg.sizing, o.volume, cfg.master_equity_usd, equity_usd(tx, env), &spec, cfg.max_lot).filter(|v| *v != fo.volume)
            };
            let patch = OrderPatch {
                price: (o.price != fo.price).then_some(o.price),
                stop_limit: o.stop_limit.filter(|l| Some(*l) != fo.stop_limit),
                volume,
                sl: (o.sl != fo.sl).then_some(o.sl),
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
            if let Some(f) = linked_order(&tx.st, sub, *ticket) {
                out.push(match attempt(tx, |t| trade::cancel_order(t, env, f, "copy: master order removed")) {
                    Ok(_) => LogEntry::done("cancel", *ticket, Some(f), None, format!("master order {}", status.as_str())),
                    Err(e) => LogEntry { follower_ticket: Some(f), ..LogEntry::new("cancel", Some(*ticket), "failed", e.message) },
                });
            } else if let Some(&f) = tx.st.client_ids.get(&order_key(sub, *ticket))
                && tx.st.positions.contains_key(&f)
            {
                // the copy filled on its own but the master's order never did: close it to stay in line
                let fv = tx.st.positions[&f].volume;
                out.push(close_linked(tx, env, cfg, f, fv, step_key(sub, version), *ticket, "close"));
            }
        }
        _ => {}
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
    let positions: Vec<(i64, D)> = tx.st.positions.values().map(|p| (p.ticket, p.volume)).collect();
    for (t, v) in positions {
        let key = format!("cs{sub}:{t}:{}", tx.st.version);
        match attempt(tx, |x| copy_close(x, env, t, v, key, format!("copy stopped: {reason}").chars().take(64).collect())) {
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

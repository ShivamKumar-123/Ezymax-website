//! Stock corporate actions on one account: splits and cash dividends (src/corporate.rs schedules them, the Back
//! Office approves them).
//!
//! * **Split** `from`-for-`to` (4-for-1: from 1, to 4; factor k = to / from): every position and pending order on the
//!   symbol that existed at `apply_at` gets volume × k and prices ÷ k (the open price exactly, SL / TP / order prices
//!   rounded to the symbol's digits, trailing distances ÷ k), so the position's value and its P&L at any price are
//!   unchanged by the split. No cash moves.
//! * **Dividend** of `amount` per share in `currency`: every position held at `apply_at` (the previous close) is
//!   adjusted in cash through the ledger (`dividend`, `house:dividends`): a long is credited the dividend less the
//!   withholding, a short is debited the gross dividend, per share (lots × contract size), converted to the account
//!   currency. Shown in statements as "Dividend adjustment".
//!
//! Applying is idempotent: a `CorporateAction` event marks the action done for the account first (its stream is the
//! guard, so a re-run after a crash skips the account), and dividend entries carry the idempotency key
//! `corp:{action}:{ticket}`. Everything is ordinary events, so replay rebuilds the result exactly.
//!
//! Between `apply_at` and the account's application (the scheduler runs at once, while the market is closed; this
//! guards a late run), trading the symbol is refused and the account's margin is not stop-out checked, so a
//! post-split price never meets a pre-split position.

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use std::sync::RwLock;

use super::{Env, Reject, Tx, risk};
use crate::model::{Order, Position, Side, Trailing, TxnKind};
use crate::money::{D, HUNDRED, ZERO, num, r2};
use crate::state::{AccountState, Event};

#[derive(Clone, Debug, PartialEq)]
pub enum CorpKind {
    /// `from` old shares become `to` new shares.
    Split { from: D, to: D },
    /// Gross cash per share; longs receive it less `withholding_pct` (0–100).
    Dividend { amount: D, currency: String, withholding_pct: D },
}

#[derive(Clone, Debug, PartialEq)]
pub struct CorpAction {
    pub id: i64,
    pub symbol: String,
    pub ex_date: NaiveDate,
    /// 00:00 of the ex-date in the exchange's time zone: positions and orders that existed then are adjusted.
    pub apply_at: DateTime<Utc>,
    pub kind: CorpKind,
}

impl CorpAction {
    pub fn kind_str(&self) -> &'static str {
        match self.kind {
            CorpKind::Split { .. } => "split",
            CorpKind::Dividend { .. } => "dividend",
        }
    }

    /// Split factor (new shares per old share); 1 for a dividend.
    pub fn factor(&self) -> D {
        match &self.kind {
            CorpKind::Split { from, to } => *to / *from,
            CorpKind::Dividend { .. } => D::ONE,
        }
    }

    /// "4-for-1 split" / "dividend 0.26 USD".
    pub fn label(&self) -> String {
        match &self.kind {
            CorpKind::Split { from, to } => format!("{}-for-{} split", to.normalize(), from.normalize()),
            CorpKind::Dividend { amount, currency, .. } => format!("dividend {} {currency}", amount.normalize()),
        }
    }
}

/// Approved actions whose `apply_at` has passed, per symbol, until every account has them (shared by the shards).
#[derive(Default, Debug)]
pub struct CorpDue(RwLock<BTreeMap<String, Vec<(i64, DateTime<Utc>)>>>);

impl CorpDue {
    pub fn set(&self, due: BTreeMap<String, Vec<(i64, DateTime<Utc>)>>) {
        *self.0.write().unwrap() = due;
    }

    /// The action on `symbol` that is due but not yet applied to this account.
    pub fn pending_for(&self, st: &AccountState, symbol: &str, now: DateTime<Utc>) -> Option<i64> {
        self.0.read().unwrap().get(symbol)?.iter().find(|(id, at)| *at <= now && !st.corp_actions.contains(id)).map(|(id, _)| *id)
    }

    /// Does any symbol this account holds wait for an action?
    pub fn any_pending(&self, st: &AccountState, now: DateTime<Utc>) -> bool {
        let due = self.0.read().unwrap();
        if due.is_empty() {
            return false;
        }
        st.symbols().iter().any(|s| due.get(s).is_some_and(|v| v.iter().any(|(id, at)| *at <= now && !st.corp_actions.contains(id))))
    }
}

fn div_round(env: &Env, symbol: &str, v: Option<D>, k: D) -> Option<D> {
    v.map(|x| match env.specs.get(symbol) {
        Some(s) => s.round_price(x / k),
        None => x / k,
    })
}

fn trail(t: &Option<Trailing>, k: D) -> Option<Trailing> {
    use rust_decimal::prelude::ToPrimitive;
    t.as_ref().map(|t| Trailing {
        distance_points: (D::from(t.distance_points) / k).round().to_i64().unwrap_or(t.distance_points).max(1),
        step_points: (D::from(t.step_points) / k).round().to_i64().unwrap_or(t.step_points).max(1),
    })
}

/// The split result of one position (P&L at any price unchanged: volume × k, prices ÷ k).
pub fn split_position(env: &Env, p: &Position, k: D) -> Position {
    Position {
        volume: p.volume * k,
        open_price: p.open_price / k,
        sl: div_round(env, &p.symbol, p.sl, k),
        tp: div_round(env, &p.symbol, p.tp, k),
        trailing: trail(&p.trailing, k),
        book_price: p.book_price / k,
        ..p.clone()
    }
}

pub fn split_order(env: &Env, o: &Order, k: D) -> Order {
    Order {
        volume: o.volume * k,
        price: div_round(env, &o.symbol, Some(o.price), k).unwrap_or(o.price),
        stop_limit: div_round(env, &o.symbol, o.stop_limit, k),
        sl: div_round(env, &o.symbol, o.sl, k),
        tp: div_round(env, &o.symbol, o.tp, k),
        trailing: trail(&o.trailing, k),
        ..o.clone()
    }
}

/// Cash of one position's dividend in the dividend currency (long: net of withholding; short: minus the gross).
pub fn dividend_cash(env: &Env, p: &Position, amount: D, withholding_pct: D) -> D {
    let size = env.specs.get(&p.symbol).map(|s| s.contract_size).unwrap_or(D::ONE);
    let gross = amount * p.volume * size;
    match p.side {
        Side::Buy => gross * (HUNDRED - withholding_pct) / HUNDRED,
        Side::Sell => -gross,
    }
}

/// Positions and pending orders the action applies to on this account.
fn eligible<'a>(st: &'a AccountState, a: &CorpAction) -> (Vec<&'a Position>, Vec<&'a Order>) {
    let pos = st.positions.values().filter(|p| p.symbol == a.symbol && p.option.is_none() && p.open_time < a.apply_at).collect();
    let ord = match a.kind {
        CorpKind::Split { .. } => st.orders.values().filter(|o| o.symbol == a.symbol && o.option.is_none() && o.placed_at < a.apply_at).collect(),
        CorpKind::Dividend { .. } => Vec::new(),
    };
    (pos, ord)
}

/// What applying `a` would do to this account (Back Office preview), without changing anything.
pub fn preview(env: &Env, st: &AccountState, a: &CorpAction) -> Value {
    let (pos, ord) = eligible(st, a);
    let k = a.factor();
    let acc = &st.account;
    let positions: Vec<Value> = pos
        .iter()
        .map(|p| match &a.kind {
            CorpKind::Split { .. } => {
                let n = split_position(env, p, k);
                json!({"ticket": p.ticket, "side": p.side.as_str(), "volume": num(p.volume), "openPrice": num(p.open_price), "newVolume": num(n.volume), "newOpenPrice": num(n.open_price)})
            }
            CorpKind::Dividend { amount, currency, withholding_pct } => {
                let cash = dividend_cash(env, p, *amount, *withholding_pct);
                let acct = env.to_usd(acc, currency, cash, (&a.symbol, ZERO)).map(|u| r2(u * acc.usd_factor()));
                json!({"ticket": p.ticket, "side": p.side.as_str(), "volume": num(p.volume), "cash": num(r2(cash)), "currency": currency, "accountAmount": acct.map(num)})
            }
        })
        .collect();
    let orders: Vec<Value> = ord.iter().map(|o| json!({"ticket": o.ticket, "volume": num(o.volume), "price": num(o.price), "newVolume": num(o.volume * k), "newPrice": num(split_order(env, o, k).price)})).collect();
    json!({"login": acc.login, "kind": acc.kind.as_str(), "applied": st.corp_actions.contains(&a.id), "positions": positions, "orders": orders})
}

/// Applies `a` to the account in `tx` (once: a second call is a no-op). Returns what changed.
pub fn apply(tx: &mut Tx, env: &Env, a: &CorpAction) -> Result<Value, Reject> {
    if tx.st.corp_actions.contains(&a.id) {
        return Ok(json!({"skipped": "already applied"}));
    }
    let (pos, ord): (Vec<Position>, Vec<Order>) = {
        let (p, o) = eligible(&tx.st, a);
        (p.into_iter().cloned().collect(), o.into_iter().cloned().collect())
    };
    let acc = tx.st.account.clone();
    let k = a.factor();
    let mut out_pos = Vec::new();
    let mut out_ord = Vec::new();
    let mut cash_total = ZERO;
    // dividends: every amount converts before anything is booked (all or nothing for the account)
    let mut bookings = Vec::new();
    if let CorpKind::Dividend { amount, currency, withholding_pct } = &a.kind {
        for p in &pos {
            let cash = dividend_cash(env, p, *amount, *withholding_pct);
            let usd = env
                .to_usd(&acc, currency, cash, (&a.symbol, ZERO))
                .ok_or_else(|| Reject::new("no_conversion", format!("No {currency}/USD price to book the {} dividend", a.symbol)))?;
            bookings.push((p.clone(), cash, r2(usd * acc.usd_factor())));
        }
    }
    let detail = json!({"label": a.label(), "factor": num(k), "positions": pos.len(), "orders": ord.len()});
    tx.emit(Event::CorporateAction { id: a.id, symbol: a.symbol.clone(), kind: a.kind_str().into(), ex_date: a.ex_date, detail });
    match &a.kind {
        CorpKind::Split { .. } => {
            for p in &pos {
                let np = split_position(env, p, k);
                out_pos.push(json!({"ticket": p.ticket, "volume": [num(p.volume), num(np.volume)], "openPrice": [num(p.open_price), num(np.open_price)]}));
                tx.emit(Event::PositionUpdated { position: np, change: format!("split {} (corporate action #{})", a.label(), a.id), deal: None });
            }
            for o in &ord {
                let no = split_order(env, o, k);
                out_ord.push(json!({"ticket": o.ticket, "volume": [num(o.volume), num(no.volume)], "price": [num(o.price), num(no.price)]}));
                tx.emit(Event::OrderUpdated { order: no, change: format!("split {} (corporate action #{})", a.label(), a.id) });
            }
            if !pos.is_empty() || !ord.is_empty() {
                tx.note(
                    "corporate_action",
                    format!("{}: {} on {} — position and order sizes × {}, prices ÷ {} (value unchanged)", a.symbol, a.label(), a.ex_date, k.normalize(), k.normalize()),
                    json!({"actionId": a.id, "symbol": a.symbol, "kind": "split", "factor": num(k)}),
                );
            }
        }
        CorpKind::Dividend { amount, currency, withholding_pct } => {
            for (p, cash, amt) in bookings {
                let shares = p.volume * env.specs.get(&a.symbol).map(|s| s.contract_size).unwrap_or(D::ONE);
                let note = if p.side == Side::Buy {
                    format!("Dividend adjustment {} ex {}: {} {currency} × {} shares, {}% withheld", a.symbol, a.ex_date, amount.normalize(), shares.normalize(), withholding_pct.normalize())
                } else {
                    format!("Dividend adjustment {} ex {} (short): {} {currency} × {} shares", a.symbol, a.ex_date, amount.normalize(), shares.normalize())
                };
                tx.post(env, TxnKind::Dividend, format!("corp:{}:{}", a.id, p.ticket), "balance", "dividends", amt, Some(format!("corp:{}", a.id)), Some("DIV".into()), Some(note));
                cash_total += amt;
                out_pos.push(json!({"ticket": p.ticket, "side": p.side.as_str(), "cash": num(r2(cash)), "currency": currency, "amount": num(amt)}));
            }
            if !out_pos.is_empty() {
                tx.note(
                    "dividend",
                    format!("{} dividend adjustment: {} {}", a.symbol, cash_total.normalize(), acc.ccy()),
                    json!({"actionId": a.id, "symbol": a.symbol, "amount": num(cash_total)}),
                );
            }
            // a short's debit lowers the equity: the usual margin call / stop-out rules apply
            risk::check_margin(tx, env);
        }
    }
    Ok(json!({"actionId": a.id, "positions": out_pos, "orders": out_ord, "cash": num(cash_total)}))
}

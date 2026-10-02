//! Event-sourced account state.
//!
//! Every change to an account is an `Event`. The engine never mutates `AccountState` directly: it emits
//! events and `AccountState::apply` folds them in. The same `apply` runs when the service starts and
//! replays the `events` table, so the rebuilt state is identical to the state before the restart.
//! Events carry every computed value (fill prices, P&L, ledger legs, ids), so replay needs no market data.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

use crate::model::{Account, Deal, LedgerTxn, Order, OrderStatus, Position};
use crate::money::{D, ZERO};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    AccountOpened { account: Account },
    /// Leverage, group, status, dealer controls, route override or name changed (full new value).
    AccountUpdated { account: Account, change: String },
    /// A double-entry transaction touching this account's balance / credit / bonus.
    Ledger { txn: LedgerTxn },
    OrderPlaced { order: Order },
    /// Modified, stop-limit triggered, OCO linked (full new value).
    OrderUpdated { order: Order, change: String },
    OrderRemoved { ticket: i64, status: OrderStatus, reason: String, at: DateTime<Utc>, fill_price: Option<D>, position_ticket: Option<i64> },
    /// New position with its entry deal (None for a split child, which has no market deal).
    PositionOpened { position: Position, deal: Option<Deal> },
    /// SL/TP/trailing, swap, volume added (with entry deal), price correction, charges, book transfer.
    PositionUpdated { position: Position, change: String, deal: Option<Deal> },
    /// Full or partial close. `position` is what remains (None = fully closed).
    PositionClosed { deal: Deal, position: Option<Position> },
    /// Voided (removed without P&L).
    PositionRemoved { ticket: i64, reason: String },
    DealReversed { deal_id: i64 },
    MarginCall { entered: bool, level: Option<D> },
    StopOut { level: Option<D> },
    RefillCounted { day: NaiveDate },
}

impl Event {
    pub fn kind(&self) -> &'static str {
        match self {
            Event::AccountOpened { .. } => "account_opened",
            Event::AccountUpdated { .. } => "account_updated",
            Event::Ledger { .. } => "ledger",
            Event::OrderPlaced { .. } => "order_placed",
            Event::OrderUpdated { .. } => "order_updated",
            Event::OrderRemoved { .. } => "order_removed",
            Event::PositionOpened { .. } => "position_opened",
            Event::PositionUpdated { .. } => "position_updated",
            Event::PositionClosed { .. } => "position_closed",
            Event::PositionRemoved { .. } => "position_removed",
            Event::DealReversed { .. } => "deal_reversed",
            Event::MarginCall { .. } => "margin_call",
            Event::StopOut { .. } => "stop_out",
            Event::RefillCounted { .. } => "refill_counted",
        }
    }
}

/// An event as stored: position in the account's stream plus provenance.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Recorded {
    pub login: i64,
    pub version: i64,
    pub at: DateTime<Utc>,
    /// Who caused it: `client`, `investor`, `staff:<id>`, `system`, `wallet`.
    pub actor: String,
    pub event: Event,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AccountState {
    pub account: Account,
    pub balance: D,
    pub credit: D,
    pub bonus: D,
    pub positions: BTreeMap<i64, Position>,
    pub orders: BTreeMap<i64, Order>,
    /// Number of events applied (the stream version).
    pub version: i64,
    pub margin_call: bool,
    pub refill_day: Option<NaiveDate>,
    pub refills: u32,
    pub reversed_deals: BTreeSet<i64>,
    /// client_order_id → ticket (duplicate-submission guard).
    pub client_ids: BTreeMap<String, i64>,
    /// Option expiry payouts of the last hours (booked at, amount; a re-run's take-back negative): they stay out of
    /// the withdrawable amount for `SETTLEMENT_HOLD_SECS` (the settlement re-run window). Derived from the ledger
    /// events only, so replay rebuilds it exactly.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub holds: Vec<(DateTime<Utc>, D)>,
}

/// How long option settlement proceeds stay out of the withdrawable amount (the settlement re-run window).
pub const SETTLEMENT_HOLD_SECS: i64 = 3600;

impl AccountState {
    pub fn new(account: Account) -> Self {
        Self {
            account,
            balance: ZERO,
            credit: ZERO,
            bonus: ZERO,
            positions: BTreeMap::new(),
            orders: BTreeMap::new(),
            version: 1,
            margin_call: false,
            refill_day: None,
            refills: 0,
            reversed_deals: BTreeSet::new(),
            client_ids: BTreeMap::new(),
            holds: Vec::new(),
        }
    }

    /// Rebuilds a state from its full event stream.
    pub fn replay<'a>(events: impl IntoIterator<Item = &'a Event>) -> anyhow::Result<Option<Self>> {
        let mut st: Option<Self> = None;
        for ev in events {
            match (&mut st, ev) {
                (None, Event::AccountOpened { account }) => st = Some(Self::new(account.clone())),
                (None, _) => anyhow::bail!("event stream does not start with account_opened"),
                (Some(s), e) => s.apply(e),
            }
        }
        Ok(st)
    }

    pub fn login(&self) -> i64 {
        self.account.login
    }

    pub fn apply(&mut self, ev: &Event) {
        self.version += 1;
        let login = self.account.login;
        match ev {
            Event::AccountOpened { account } => self.account = account.clone(),
            Event::AccountUpdated { account, .. } => self.account = account.clone(),
            Event::Ledger { txn } => {
                let bal = txn.effect(login, "balance");
                self.balance += bal;
                self.credit += txn.effect(login, "credit");
                self.bonus += txn.effect(login, "bonus");
                // held: settlement payouts credited (settle:) less the payouts a re-run took back (settle-rev:);
                // charges of short settlements and the refunds of reversed charges are never held
                let held = (txn.idempotency_key.starts_with("settle:") && bal > ZERO) || (txn.idempotency_key.starts_with("settle-rev:") && bal < ZERO);
                if held {
                    // keep only what can still be inside the hold window (by event time: deterministic on replay)
                    let horizon = txn.at - chrono::Duration::seconds(2 * SETTLEMENT_HOLD_SECS);
                    self.holds.retain(|(at, _)| *at > horizon);
                    self.holds.push((txn.at, bal));
                }
            }
            Event::OrderPlaced { order } => {
                if let Some(c) = &order.client_order_id {
                    self.client_ids.insert(c.clone(), order.ticket);
                }
                self.orders.insert(order.ticket, order.clone());
            }
            Event::OrderUpdated { order, .. } => {
                self.orders.insert(order.ticket, order.clone());
            }
            Event::OrderRemoved { ticket, .. } => {
                self.orders.remove(ticket);
            }
            Event::PositionOpened { position, deal } => {
                self.remember(deal.as_ref());
                self.positions.insert(position.ticket, position.clone());
            }
            Event::PositionUpdated { position, deal, .. } => {
                self.remember(deal.as_ref());
                self.positions.insert(position.ticket, position.clone());
            }
            Event::PositionClosed { deal, position } => match position {
                Some(p) => {
                    self.remember(Some(deal));
                    self.positions.insert(p.ticket, p.clone());
                }
                None => {
                    self.remember(Some(deal));
                    self.positions.remove(&deal.position_ticket);
                }
            },
            Event::PositionRemoved { ticket, .. } => {
                self.positions.remove(ticket);
            }
            Event::DealReversed { deal_id } => {
                self.reversed_deals.insert(*deal_id);
            }
            Event::MarginCall { entered, .. } => self.margin_call = *entered,
            Event::StopOut { .. } => {}
            Event::RefillCounted { day } => {
                if self.refill_day != Some(*day) {
                    self.refill_day = Some(*day);
                    self.refills = 0;
                }
                self.refills += 1;
            }
        }
    }

    fn remember(&mut self, deal: Option<&Deal>) {
        if let Some(d) = deal
            && let Some(c) = &d.client_order_id
        {
            self.client_ids.entry(c.clone()).or_insert(d.order_ticket.unwrap_or(d.position_ticket));
        }
    }

    pub fn position_for(&self, symbol: &str) -> Option<&Position> {
        self.positions.values().find(|p| p.symbol == symbol)
    }

    /// CFD symbols with a position or pending order (option series are not CFD symbols: see `option_keys`).
    pub fn symbols(&self) -> BTreeSet<String> {
        self.positions.values().filter(|p| p.option.is_none()).map(|p| p.symbol.clone()).chain(self.orders.values().filter(|o| o.option.is_none()).map(|o| o.symbol.clone())).collect()
    }

    /// Raw-feed symbols this account's options depend on: underlyings of option positions and orders, and the
    /// symbols of order triggers.
    pub fn option_keys(&self) -> BTreeSet<String> {
        let mut out: BTreeSet<String> = self.positions.values().filter_map(|p| p.option.as_ref().map(|o| o.underlying.clone())).collect();
        for o in self.orders.values() {
            if let Some(oo) = &o.option {
                out.extend(oo.legs.iter().map(|l| l.terms.underlying.clone()));
            }
            if let Some(t) = &o.trigger {
                out.insert(t.symbol.clone());
            }
        }
        out
    }

    /// Settlement proceeds still inside the hold window at `now` (never negative).
    pub fn held(&self, now: DateTime<Utc>) -> D {
        let from = now - chrono::Duration::seconds(SETTLEMENT_HOLD_SECS);
        self.holds.iter().filter(|(at, _)| *at > from).map(|(_, v)| *v).sum::<D>().max(ZERO)
    }

    pub fn has_options(&self) -> bool {
        self.positions.values().any(|p| p.option.is_some()) || self.orders.values().any(|o| o.option.is_some())
    }
}

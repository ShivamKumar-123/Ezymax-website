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
}

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
                self.balance += txn.effect(login, "balance");
                self.credit += txn.effect(login, "credit");
                self.bonus += txn.effect(login, "bonus");
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

    pub fn symbols(&self) -> BTreeSet<String> {
        self.positions.values().map(|p| p.symbol.clone()).chain(self.orders.values().map(|o| o.symbol.clone())).collect()
    }
}

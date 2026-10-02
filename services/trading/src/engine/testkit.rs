//! Test fixtures: in-memory quotes, a tenant with groups, account factory, and an `Engine` harness that
//! applies transactions the way the shard does (minus the database).

use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

use super::{Env, Ids, Quote, Quotes, Tx};
use crate::model::{Account, AccountKind, Book, Controls, DemoCfg, Mode, Status};
use crate::money::D;
use crate::rules::{Group, TenantConfig, TenantPolicy};
use crate::specs::Specs;
use crate::state::{AccountState, Event};

pub fn d(s: &str) -> D {
    D::from_str(s).unwrap()
}

pub fn t(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}

#[derive(Default)]
pub struct MapQuotes(pub Mutex<HashMap<String, Quote>>);

impl Quotes for MapQuotes {
    fn get(&self, _group: &str, symbol: &str) -> Option<Quote> {
        self.0.lock().unwrap().get(symbol).copied()
    }
}

pub fn group(code: &str, mode: Mode, cent: bool) -> Group {
    Group {
        tenant_id: 1,
        code: code.into(),
        name: code.into(),
        mode,
        cent,
        account_types: "both".into(),
        leverages: vec![50, 100, 200, 500],
        default_leverage: 100,
        margin_call_pct: d("100"),
        stop_out_pct: d("50"),
        hedged_margin_pct: d("50"),
        min_deposit: d("0"),
        swap_free: false,
        commission_per_lot: d("0"),
        route: Book::B,
        spread_group: "standard".into(),
        max_accounts_per_user: 5,
        demo_initial_balance: d("10000"),
        demo_refills_per_day: 2,
        demo_expiry_days: 10,
        enabled: true,
    }
}

pub struct Kit {
    pub specs: Specs,
    pub tenant: TenantConfig,
    pub quotes: MapQuotes,
    pub ids: Ids,
    pub now: DateTime<Utc>,
    pub restrictions: crate::controls::Restrictions,
}

impl Kit {
    pub fn new() -> Self {
        let mut tenant = TenantConfig { tenant_id: 1, slug: "kalks".into(), policy: TenantPolicy::default(), ..Default::default() };
        for g in [group("hedge", Mode::Hedging, false), group("net", Mode::Netting, false), group("cent", Mode::Hedging, true)] {
            tenant.groups.insert(g.code.clone(), g);
        }
        let mut free = group("free", Mode::Hedging, false);
        free.swap_free = true;
        tenant.groups.insert("free".into(), free);
        let mut ecn = group("ecn", Mode::Hedging, false);
        ecn.commission_per_lot = d("7");
        tenant.groups.insert("ecn".into(), ecn);
        // Monday 2026-09-28 12:00 UTC: FX open
        Self { specs: crate::specs::test_specs(), tenant, quotes: MapQuotes::default(), ids: Ids::new(1000, 5000, 9000), now: t("2026-09-28T12:00:00Z"), restrictions: Default::default() }
    }

    pub fn quote(&self, symbol: &str, bid: &str, ask: &str) {
        self.quotes.0.lock().unwrap().insert(symbol.into(), Quote { bid: d(bid), ask: d(ask), t_ms: self.now.timestamp_millis() });
    }

    pub fn env<'a>(&'a self, st: &AccountState) -> Env<'a> {
        Env { specs: &self.specs, tenant: &self.tenant, group: &self.tenant.groups[&st.account.group], quotes: &self.quotes, ids: &self.ids, now: self.now, max_quote_age_ms: 0, restrictions: Some(&self.restrictions) }
    }

    pub fn account(&self, login: i64, group: &str, kind: AccountKind) -> Account {
        let g = &self.tenant.groups[group];
        Account {
            tenant_id: 1,
            login,
            user_id: 7,
            kind,
            group: group.into(),
            mode: g.mode,
            cent: g.cent,
            leverage: 100,
            status: Status::Active,
            name: "Test".into(),
            route_override: None,
            controls: Controls::default(),
            demo: (kind == AccountKind::Demo).then(|| DemoCfg { initial_balance: g.demo_initial_balance, refills_per_day: g.demo_refills_per_day, expiry_days: 10 }),
            created_at: self.now,
            lifecycle: None,
        }
    }
}

/// An account plus its full event log, mutated only through committed transactions.
pub struct Harness {
    pub st: AccountState,
    pub log: Vec<Event>,
}

impl Harness {
    /// Live account funded with `balance` (USD) through a wallet transfer.
    pub fn live(kit: &Kit, group: &str, balance: &str) -> Self {
        let acc = kit.account(10_000_001, group, AccountKind::Live);
        let st0 = AccountState::new(acc.clone());
        let tx = super::funds::open_account(&kit.env(&st0), acc);
        let mut h = Harness { st: tx.st.clone(), log: tx.events.clone() };
        if balance != "0" {
            h.run(kit, |tx, env| super::funds::transfer(tx, env, super::funds::Direction::In, d(balance), "fund-1", None).map(|_| ())).unwrap();
        }
        h
    }

    pub fn demo(kit: &Kit, group: &str) -> Self {
        let acc = kit.account(50_000_001, group, AccountKind::Demo);
        let st0 = AccountState::new(acc.clone());
        let tx = super::funds::open_account(&kit.env(&st0), acc);
        Harness { st: tx.st.clone(), log: tx.events.clone() }
    }

    /// Runs `f` in a transaction and commits it on success.
    pub fn run<T>(&mut self, kit: &Kit, f: impl FnOnce(&mut Tx, &Env) -> Result<T, super::Reject>) -> Result<T, super::Reject> {
        let env = kit.env(&self.st);
        let mut tx = Tx::new(&self.st);
        let out = f(&mut tx, &env)?;
        self.commit(tx);
        Ok(out)
    }

    pub fn commit(&mut self, tx: Tx) {
        for e in &tx.events {
            if let Event::Ledger { txn } = e {
                assert!(txn.is_balanced(), "unbalanced txn {txn:?}");
            }
        }
        self.log.extend(tx.events);
        self.st = tx.st;
    }

    pub fn tick(&mut self, kit: &Kit, symbol: &str) {
        let env = kit.env(&self.st);
        let mut tx = Tx::new(&self.st);
        super::risk::on_tick(&mut tx, &env, symbol);
        self.commit(tx);
    }

    /// Replaying the log must give exactly the current state.
    pub fn assert_replay(&self) {
        let replayed = AccountState::replay(self.log.iter()).unwrap().unwrap();
        assert_eq!(replayed, self.st, "replay diverged");
    }

    /// Σ postings on the client balance ledger account == balance.
    pub fn assert_ledger(&self) {
        let login = self.st.account.login;
        let mut bal = D::ZERO;
        for e in &self.log {
            if let Event::Ledger { txn } = e {
                assert!(txn.is_balanced());
                bal += txn.effect(login, "balance");
            }
        }
        assert_eq!(bal, self.st.balance);
    }
}

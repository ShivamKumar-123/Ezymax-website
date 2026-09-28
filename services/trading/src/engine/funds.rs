//! Money in and out of an account (wallet transfers, staff adjustments, demo funding) and account settings.

use serde_json::json;

use super::{Env, Reject, Tx, metrics};
use crate::model::{Account, AccountKind, Book, Controls, TxnKind, acct_code, house_code};
use crate::money::{D, ZERO, num, r2};
use crate::specs::server_date;
use crate::state::{AccountState, Event};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    /// Wallet → trading account.
    In,
    /// Trading account → wallet.
    Out,
}

/// Opens an account: the `account_opened` event plus the initial demo balance.
pub fn open_account(env: &Env, account: Account) -> Tx {
    let st = AccountState::new(account.clone());
    let mut tx = Tx { st, events: vec![Event::AccountOpened { account: account.clone() }], notes: vec![], audit: vec![] };
    if let Some(d) = &account.demo {
        let amt = d.initial_balance * account.usd_factor();
        tx.post(env, TxnKind::DemoInitial, format!("demo-initial:{}", account.login), "balance", "demo_funding", amt, None, None, None);
    }
    tx
}

/// Wallet ↔ trading account transfer (D3/D36). `amount_usd` is in USD; cent accounts receive USC (×100).
/// Double entry per currency: the wallet clearing account (USD) against the client balance, with an FX pair
/// of legs for cent accounts so every currency nets to 0.
pub fn transfer(tx: &mut Tx, env: &Env, dir: Direction, amount_usd: D, idem: &str, reference: Option<String>) -> Result<(i64, D), Reject> {
    let acc = tx.st.account.clone();
    if acc.kind == AccountKind::Demo {
        return Err(Reject::new("demo_account", "Transfers are only possible for live accounts"));
    }
    let usd = r2(amount_usd);
    if usd <= ZERO {
        return Err(Reject::new("invalid_amount", "Amount must be above 0"));
    }
    let amt = r2(usd * acc.usd_factor());
    if dir == Direction::Out {
        let w = metrics(env, &tx.st).withdrawable();
        if amt > w {
            return Err(Reject::new("insufficient_funds", format!("Not enough free funds: {} {} available", r2(w).normalize(), acc.ccy())));
        }
    } else if acc.status == crate::model::Status::Expired {
        return Err(Reject::new("account_status", "Account is expired"));
    }
    let s = if dir == Direction::In { D::ONE } else { -D::ONE };
    let ccy = acc.ccy();
    let mut postings = vec![crate::model::Posting { account: acct_code(acc.login, "balance"), ccy: ccy.into(), amount: s * amt }];
    if acc.cent {
        postings.push(crate::model::Posting { account: house_code("fx", "USC"), ccy: "USC".into(), amount: -s * amt });
        postings.push(crate::model::Posting { account: house_code("fx", "USD"), ccy: "USD".into(), amount: s * usd });
    }
    postings.push(crate::model::Posting { account: house_code("wallet_clearing", "USD"), ccy: "USD".into(), amount: -s * usd });
    let txn = crate::model::LedgerTxn {
        id: env.ids.txn(),
        tenant_id: acc.tenant_id,
        idempotency_key: idem.to_string(),
        kind: if dir == Direction::In { TxnKind::TransferIn } else { TxnKind::TransferOut },
        login: acc.login,
        reference,
        reason_code: None,
        note: None,
        at: env.now,
        postings,
    };
    assert!(txn.is_balanced());
    let id = txn.id;
    tx.emit(Event::Ledger { txn });
    tx.note("balance", format!("{} {} {}", if dir == Direction::In { "Deposit" } else { "Withdrawal" }, amt.normalize(), ccy), json!({"amount": num(s * amt), "txn": id}));
    Ok((id, amt))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdjustKind {
    Deposit,
    Withdrawal,
    Adjustment,
    Credit,
    Bonus,
}

impl AdjustKind {
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "deposit" => Self::Deposit,
            "withdrawal" => Self::Withdrawal,
            "adjustment" | "balance" => Self::Adjustment,
            "credit" => Self::Credit,
            "bonus" => Self::Bonus,
            _ => return None,
        })
    }
}

/// Staff balance / credit / bonus change with a reason (D117/D118). `amount` is signed, account currency.
pub fn adjust(tx: &mut Tx, env: &Env, kind: AdjustKind, amount: D, idem: &str, reason_code: &str, note: &str) -> Result<i64, Reject> {
    let amount = r2(amount);
    if amount.is_zero() {
        return Err(Reject::new("invalid_amount", "Amount must not be 0"));
    }
    let m = metrics(env, &tx.st);
    let (sub, house, tk, amt) = match kind {
        AdjustKind::Deposit => ("balance", "external", TxnKind::Deposit, amount.abs()),
        AdjustKind::Withdrawal => {
            if amount.abs() > m.withdrawable() {
                return Err(Reject::new("insufficient_funds", format!("Not enough free funds: {} available", r2(m.withdrawable()).normalize())));
            }
            ("balance", "external", TxnKind::Withdrawal, -amount.abs())
        }
        AdjustKind::Adjustment => ("balance", "adjustments", TxnKind::Adjustment, amount),
        AdjustKind::Credit => {
            if tx.st.credit + amount < ZERO {
                return Err(Reject::new("invalid_amount", format!("Credit cannot go below 0 (current {})", tx.st.credit.normalize())));
            }
            ("credit", "credit_issued", TxnKind::Credit, amount)
        }
        AdjustKind::Bonus => {
            if tx.st.bonus + amount < ZERO {
                return Err(Reject::new("invalid_amount", format!("Bonus cannot go below 0 (current {})", tx.st.bonus.normalize())));
            }
            ("bonus", "bonus_issued", TxnKind::Bonus, amount)
        }
    };
    let id = tx.post(env, tk, idem.to_string(), sub, house, amt, None, Some(reason_code.to_string()), Some(note.to_string())).expect("non-zero amount");
    tx.note("balance", format!("{} {} {}", tk.as_str(), amt.normalize(), tx.st.account.ccy()), json!({"amount": num(amt), "kind": sub, "txn": id}));
    Ok(id)
}

/// D8: user-triggered refill back to the initial demo balance, capped at N per server day.
pub fn demo_refill(tx: &mut Tx, env: &Env) -> Result<D, Reject> {
    let acc = tx.st.account.clone();
    let d = acc.demo.clone().ok_or_else(|| Reject::new("not_demo", "Refill is only available on demo accounts"))?;
    if acc.status == crate::model::Status::Expired {
        return Err(Reject::new("account_status", "This demo account has expired"));
    }
    let day = server_date(env.now);
    let used = if tx.st.refill_day == Some(day) { tx.st.refills } else { 0 };
    if used >= d.refills_per_day {
        return Err(Reject::new("refill_limit", format!("Refill limit reached ({} per day)", d.refills_per_day)));
    }
    let target = d.initial_balance * acc.usd_factor();
    let amt = r2(target - tx.st.balance);
    if amt <= ZERO {
        return Err(Reject::new("refill_not_needed", "Balance is already at or above the initial demo balance"));
    }
    tx.emit(Event::RefillCounted { day });
    tx.post(env, TxnKind::DemoRefill, format!("demo-refill:{}:{}:{}", acc.login, day, used + 1), "balance", "demo_funding", amt, None, None, None);
    Ok(amt)
}

/// D15: leverage from the group list, only while flat.
pub fn change_leverage(tx: &mut Tx, env: &Env, leverage: u32, staff: bool) -> Result<(u32, u32), Reject> {
    if !env.group.leverages.contains(&leverage) {
        return Err(Reject::new("invalid_leverage", format!("Leverage 1:{leverage} is not offered in this group")));
    }
    if !tx.st.positions.is_empty() && !staff {
        return Err(Reject::new("positions_open", "Leverage can only be changed when there are no open positions"));
    }
    let from = tx.st.account.leverage;
    if from == leverage {
        return Err(Reject::new("no_change", "Nothing changed"));
    }
    let mut a = tx.st.account.clone();
    a.leverage = leverage;
    tx.emit(Event::AccountUpdated { account: a, change: format!("leverage 1:{from} → 1:{leverage}") });
    Ok((from, leverage))
}

/// Moves the account to another group. Mode (netting/hedging) can only change while flat, and the cent flag
/// never changes (the ledger currency is fixed at opening).
pub fn change_group(tx: &mut Tx, new: &crate::rules::Group) -> Result<(String, String), Reject> {
    let a0 = tx.st.account.clone();
    if new.code == a0.group {
        return Err(Reject::new("no_change", "Nothing changed"));
    }
    if new.cent != a0.cent {
        return Err(Reject::new("invalid_group", "An account cannot move between cent and standard currency groups"));
    }
    if !new.allows(a0.kind.as_str()) {
        return Err(Reject::new("invalid_group", format!("Group {} does not accept {} accounts", new.name, a0.kind.as_str())));
    }
    let flat = tx.st.positions.is_empty() && tx.st.orders.is_empty();
    let mode_changes = (new.mode == crate::model::Mode::Netting) != (a0.mode == crate::model::Mode::Netting);
    if mode_changes && !flat {
        return Err(Reject::new("positions_open", "Close all positions and orders before switching between netting and hedging"));
    }
    let mut a = a0.clone();
    a.group = new.code.clone();
    a.mode = new.mode;
    if !new.leverages.contains(&a.leverage) {
        if !tx.st.positions.is_empty() {
            return Err(Reject::new("invalid_leverage", format!("Leverage 1:{} is not offered in {}; close positions first", a.leverage, new.name)));
        }
        a.leverage = new.default_leverage;
    }
    tx.emit(Event::AccountUpdated { account: a, change: format!("group {} → {}", a0.group, new.code) });
    Ok((a0.group, new.code.clone()))
}

pub fn set_status(tx: &mut Tx, status: crate::model::Status) -> Result<(), Reject> {
    if tx.st.account.status == status {
        return Err(Reject::new("no_change", "Nothing changed"));
    }
    let mut a = tx.st.account.clone();
    let from = a.status;
    a.status = status;
    tx.emit(Event::AccountUpdated { account: a, change: format!("status {} → {}", from.as_str(), status.as_str()) });
    Ok(())
}

pub fn set_controls(tx: &mut Tx, controls: Controls) -> Result<Controls, Reject> {
    let before = tx.st.account.controls.clone();
    let mut a = tx.st.account.clone();
    a.controls = controls;
    tx.emit(Event::AccountUpdated { account: a, change: "dealer controls".into() });
    Ok(before)
}

pub fn set_route(tx: &mut Tx, book: Option<Book>) -> Result<Option<Book>, Reject> {
    let before = tx.st.account.route_override;
    if before == book {
        return Err(Reject::new("no_change", "Nothing changed"));
    }
    let mut a = tx.st.account.clone();
    a.route_override = book;
    tx.emit(Event::AccountUpdated { account: a, change: format!("route {:?} → {:?}", before, book) });
    Ok(before)
}

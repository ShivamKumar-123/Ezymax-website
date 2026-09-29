//! Account statements (D48, D50): MT5-style sections built from the mirrored ledger and deals, plus the
//! account's open positions and pending orders read live from the engine at generation time.
//!
//! Money is `rust_decimal` in the account currency (USC for cent accounts). The ledger is the source of truth:
//! opening balance = Σ balance postings before `from`, closing = opening + Σ postings in [from, to). The
//! reconciliation block checks the ledger against the deals (trade results and commissions) and, for a period
//! that ends now, the closing balance against the engine's live balance.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::Serialize;
use serde_json::Value;
use sqlx::Row;

use crate::error::{ApiError, ApiResult};
use crate::metrics::{self, Trade, TradeStats};
use crate::state::App;
use crate::upstream::{As, Target, dec, num, time as jtime};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub login: i64,
    pub user_id: i64,
    pub kind: String,
    pub group: String,
    pub group_name: String,
    pub currency: String,
    pub cent: bool,
    pub leverage: i32,
    pub mode: String,
    pub name: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerRow {
    pub at: DateTime<Utc>,
    pub txn: i64,
    pub kind: String,
    pub label: String,
    pub sub_ledger: String,
    pub amount: Decimal,
    /// Running balance after this row (balance sub-ledger only; credit / bonus rows repeat it).
    pub balance: Decimal,
    pub reference: Option<String>,
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DealRow {
    pub id: i64,
    pub position_ticket: i64,
    pub symbol: String,
    pub side: String,
    pub position_side: String,
    pub entry: String,
    pub volume: Decimal,
    pub price: Decimal,
    pub profit: Decimal,
    pub swap: Decimal,
    pub commission: Decimal,
    pub reason: String,
    pub time: DateTime<Utc>,
    pub open_price: Option<Decimal>,
    pub open_time: Option<DateTime<Utc>>,
    pub comment: String,
    pub reversed: bool,
}

impl DealRow {
    pub fn is_exit(&self) -> bool {
        self.entry != "in"
    }
    pub fn net(&self) -> Decimal {
        self.profit + self.swap - self.commission
    }
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub opening_balance: Decimal,
    pub deposits: Decimal,
    pub withdrawals: Decimal,
    /// Closed trade results as booked (price P&L + swap).
    pub trade_results: Decimal,
    pub commission: Decimal,
    pub performance_fees: Decimal,
    pub adjustments: Decimal,
    pub closing_balance: Decimal,
    /// Credit + bonus movements in the period and the closing credit + bonus.
    pub credit_movement: Decimal,
    pub closing_credit: Decimal,
    /// Trading result after charges: trade results + commission + performance fees.
    pub net_pnl: Decimal,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Charges {
    pub commission: Decimal,
    pub swap_paid: Decimal,
    pub swap_earned: Decimal,
    pub performance_fees: Decimal,
    /// Informational: base spread + group markup of every deal side (already in the prices).
    pub spread_estimate: Decimal,
    /// Commission + swap paid + performance fees (spread excluded, it is in the prices).
    pub total: Decimal,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reconciliation {
    pub ledger_trade_results: Decimal,
    pub deal_trade_results: Decimal,
    pub ledger_commission: Decimal,
    pub deal_commission: Decimal,
    pub ledger_balance_change: Decimal,
    pub summary_balance_change: Decimal,
    /// Engine live balance when the period ends now; None otherwise.
    pub engine_balance: Option<Decimal>,
    pub ok: bool,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Statement {
    pub account: AccountInfo,
    pub client_name: String,
    pub client_email: String,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub generated_at: DateTime<Utc>,
    pub summary: Summary,
    pub charges: Charges,
    pub reconciliation: Reconciliation,
    /// Closed positions (exit deals) in the period, oldest first.
    pub trades: Vec<DealRow>,
    /// Every deal (entries and exits), oldest first.
    pub deals: Vec<DealRow>,
    pub ledger: Vec<LedgerRow>,
    pub positions: Vec<Value>,
    pub orders: Vec<Value>,
    pub equity: Option<Decimal>,
    pub margin: Option<Decimal>,
    pub floating: Option<Decimal>,
    pub free_margin: Option<Decimal>,
    pub stats: TradeStats,
}

pub fn kind_label(kind: &str) -> &'static str {
    match kind {
        "transfer_in" => "Deposit from wallet",
        "transfer_out" => "Withdrawal to wallet",
        "deposit" => "Deposit",
        "withdrawal" => "Withdrawal",
        "trade_pnl" => "Trade result",
        "commission" => "Commission",
        "swap" => "Swap",
        "adjustment" => "Adjustment",
        "credit" => "Credit",
        "bonus" => "Bonus",
        "nbp" => "Negative balance protection",
        "reversal" => "Reversal",
        "demo_initial" => "Initial demo balance",
        "demo_refill" => "Demo refill",
        "perf_fee" => "Performance fee",
        _ => "Other",
    }
}

pub struct Input {
    pub account: AccountInfo,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub opening_balance: Decimal,
    pub opening_credit: Decimal,
    /// (at, txn, sub_ledger, kind, amount, reference, note) in [from, to), in time order
    pub ledger: Vec<(DateTime<Utc>, i64, String, String, Decimal, Option<String>, Option<String>)>,
    /// deals in [from, to), in time order
    pub deals: Vec<DealRow>,
    /// Spread cost estimate per deal id (account currency), informational.
    pub spread: Decimal,
}

/// Builds the statement from already-loaded rows (pure; tested).
pub fn build(inp: Input) -> (Summary, Charges, Reconciliation, Vec<LedgerRow>, Vec<DealRow>, Vec<DealRow>) {
    let mut s = Summary { opening_balance: inp.opening_balance, ..Default::default() };
    let mut bal = inp.opening_balance;
    let mut credit = inp.opening_credit;
    let mut rows = vec![];
    let mut ledger_trade = Decimal::ZERO;
    let mut ledger_comm = Decimal::ZERO;
    for (at, txn, sub, kind, amount, reference, note) in inp.ledger {
        if sub == "balance" {
            bal += amount;
            match kind.as_str() {
                "transfer_in" | "deposit" | "demo_initial" | "demo_refill" => s.deposits += amount,
                "transfer_out" | "withdrawal" => s.withdrawals += amount,
                "trade_pnl" => {
                    s.trade_results += amount;
                    ledger_trade += amount;
                }
                "commission" => {
                    s.commission += amount;
                    ledger_comm += amount;
                }
                "perf_fee" => s.performance_fees += amount,
                _ => s.adjustments += amount,
            }
        } else {
            credit += amount;
            s.credit_movement += amount;
        }
        rows.push(LedgerRow { at, txn, label: kind_label(&kind).to_string(), kind, sub_ledger: sub, amount, balance: bal, reference, note });
    }
    s.closing_balance = bal;
    s.closing_credit = credit;
    s.net_pnl = s.trade_results + s.commission + s.performance_fees;

    let trades: Vec<DealRow> = inp.deals.iter().filter(|d| d.is_exit() && !d.reversed).cloned().collect();
    let mut c = Charges { spread_estimate: inp.spread, ..Default::default() };
    for d in &trades {
        if d.swap < Decimal::ZERO {
            c.swap_paid += -d.swap;
        } else {
            c.swap_earned += d.swap;
        }
    }
    c.commission = -s.commission;
    c.performance_fees = -s.performance_fees;
    c.total = c.commission + c.swap_paid + c.performance_fees;

    let deal_trade: Decimal = trades.iter().map(|d| d.profit + d.swap).sum();
    let deal_comm: Decimal = inp.deals.iter().filter(|d| d.entry == "in").map(|d| d.commission).sum();
    let summary_change = s.deposits + s.withdrawals + s.trade_results + s.commission + s.performance_fees + s.adjustments;
    let mut r = Reconciliation {
        ledger_trade_results: ledger_trade,
        deal_trade_results: deal_trade,
        ledger_commission: -ledger_comm,
        deal_commission: deal_comm,
        ledger_balance_change: s.closing_balance - s.opening_balance,
        summary_balance_change: summary_change,
        engine_balance: None,
        ok: true,
        notes: vec![],
    };
    if r.ledger_balance_change != r.summary_balance_change {
        r.ok = false;
        r.notes.push("The summary lines do not add up to the balance change.".into());
    }
    // reversed deals are booked back by a reversal (adjustment), so compare only when none happened
    let reversals = rows.iter().any(|x| x.kind == "reversal");
    if !reversals && (r.ledger_trade_results - r.deal_trade_results).abs() > Decimal::new(1, 2) {
        r.ok = false;
        r.notes.push(format!("Trade results in the ledger ({}) differ from the closed deals ({}).", r.ledger_trade_results, r.deal_trade_results));
    }
    if !reversals && (r.ledger_commission - r.deal_commission).abs() > Decimal::new(1, 2) {
        r.notes.push(format!("Commission booked ({}) differs from the entry deals ({}): refunds or desk adjustments.", r.ledger_commission, r.deal_commission));
    }
    (s, c, r, rows, trades, inp.deals)
}

/// Closed deals as analytics trades, converted to USD (cent ÷ 100).
pub fn to_trades(login: i64, deals: &[DealRow], cent: bool, balance_at: impl Fn(DateTime<Utc>) -> f64) -> Vec<Trade> {
    let k = if cent { 0.01 } else { 1.0 };
    deals
        .iter()
        .filter(|d| d.is_exit() && !d.reversed)
        .map(|d| {
            let f = |x: Decimal| x.to_f64().unwrap_or(0.0) * k;
            Trade {
                login,
                deal: d.id,
                ticket: d.position_ticket,
                symbol: d.symbol.clone(),
                side: d.position_side.clone(),
                volume: d.volume.to_f64().unwrap_or(0.0),
                open_time: d.open_time.unwrap_or(d.time),
                close_time: d.time,
                open_price: d.open_price.and_then(|x| x.to_f64()).unwrap_or(0.0),
                close_price: d.price.to_f64().unwrap_or(0.0),
                profit: f(d.profit),
                swap: f(d.swap),
                commission: f(d.commission),
                net: f(d.net()),
                reason: d.reason.clone(),
                balance_before: balance_at(d.time) * k,
            }
        })
        .collect()
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

pub async fn account_info(app: &App, tenant: &str, login: i64) -> ApiResult<AccountInfo> {
    let r = sqlx::query("SELECT * FROM accounts WHERE tenant = $1 AND login = $2")
        .bind(tenant)
        .bind(login)
        .fetch_optional(&app.pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("Account not found.".into()))?;
    Ok(AccountInfo {
        login,
        user_id: r.get("user_id"),
        kind: r.get("kind"),
        group: r.get("group_code"),
        group_name: r.get("group_name"),
        currency: r.get("currency"),
        cent: r.get("cent"),
        leverage: r.get("leverage"),
        mode: r.get("mode"),
        name: r.get("name"),
        status: r.get("status"),
        created_at: r.get("created_at"),
    })
}

pub async fn load_deals(app: &App, tenant: &str, login: i64, from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>) -> ApiResult<Vec<DealRow>> {
    let rows = sqlx::query(
        "SELECT * FROM deals WHERE tenant = $1 AND login = $2 AND ($3::timestamptz IS NULL OR time >= $3) AND ($4::timestamptz IS NULL OR time < $4) ORDER BY time, id",
    )
    .bind(tenant)
    .bind(login)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| DealRow {
            id: r.get("id"),
            position_ticket: r.get("position_ticket"),
            symbol: r.get("symbol"),
            side: r.get("side"),
            position_side: r.get("position_side"),
            entry: r.get("entry"),
            volume: r.get("volume"),
            price: r.get("price"),
            profit: r.get("profit"),
            swap: r.get("swap"),
            commission: r.get("commission"),
            reason: r.get("reason"),
            time: r.get("time"),
            open_price: r.get("open_price"),
            open_time: r.get("open_time"),
            comment: r.get("comment"),
            reversed: r.get("reversed"),
        })
        .collect())
}

/// Generates the statement for [from, to). The caller has refreshed the account from the engine.
pub async fn generate(app: &App, tenant: &str, login: i64, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<Statement> {
    if to <= from {
        return Err(ApiError::Validation { field: "to", message: "The end of the period must be after its start.".into() });
    }
    let account = account_info(app, tenant, login).await?;
    let opening = sqlx::query(
        "SELECT COALESCE(sum(amount) FILTER (WHERE sub_ledger = 'balance'), 0) AS bal, COALESCE(sum(amount) FILTER (WHERE sub_ledger <> 'balance'), 0) AS other
         FROM ledger WHERE tenant = $1 AND login = $2 AND at < $3",
    )
    .bind(tenant)
    .bind(login)
    .bind(from)
    .fetch_one(&app.pool)
    .await?;
    let ledger = sqlx::query("SELECT at, txn, sub_ledger, kind, amount, reference, note FROM ledger WHERE tenant = $1 AND login = $2 AND at >= $3 AND at < $4 ORDER BY at, txn, sub_ledger")
        .bind(tenant)
        .bind(login)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?
        .iter()
        .map(|r| (r.get("at"), r.get("txn"), r.get("sub_ledger"), r.get("kind"), r.get("amount"), r.get("reference"), r.get("note")))
        .collect();
    let deals = load_deals(app, tenant, login, Some(from), Some(to)).await?;
    let sg = app.specs.spread_group(&account.group);
    let k = if account.cent { 100.0 } else { 1.0 };
    let spread: f64 = deals.iter().filter(|d| !d.reversed).map(|d| app.specs.deal_spread_cost_usd(&sg, &d.symbol, d.volume.to_f64().unwrap_or(0.0), d.price.to_f64().unwrap_or(0.0)) * k).sum();
    let (summary, charges, mut recon, ledger_rows, trades, deals) = build(Input {
        account: account.clone(),
        from,
        to,
        opening_balance: opening.get("bal"),
        opening_credit: opening.get("other"),
        ledger,
        deals,
        spread: Decimal::from_f64_retain(spread).unwrap_or_default().round_dp(2),
    });

    // live part: open positions, pending orders, equity (as at generation time)
    let now = Utc::now();
    let (mut positions, mut orders) = (vec![], vec![]);
    let (mut equity, mut margin, mut floating, mut free) = (None, None, None, None);
    if let Ok(v) = app.up.get(Target::Engine, tenant, As::User(account.user_id), &format!("/v1/accounts/{login}?user_id={}", account.user_id)).await {
        positions = v["positions"].as_array().cloned().unwrap_or_default();
        orders = v["orders"].as_array().cloned().unwrap_or_default();
        let a = &v["account"];
        equity = Some(dec(&a["equity"]));
        margin = Some(dec(&a["margin"]));
        floating = Some(dec(&a["profit"]));
        free = Some(dec(&a["freeMargin"]));
        if to >= now - chrono::Duration::minutes(1) {
            let live = dec(&a["balance"]);
            recon.engine_balance = Some(live);
            if live != summary.closing_balance {
                recon.ok = false;
                recon.notes.push(format!("The closing balance ({}) differs from the engine's live balance ({live}).", summary.closing_balance));
            }
        }
    }
    let tr = to_trades(login, &trades, account.cent, |_| 0.0);
    let (name, email): (Option<String>, Option<String>) = sqlx::query_as("SELECT trim(first_name || ' ' || last_name), email FROM clients WHERE tenant = $1 AND user_id = $2")
        .bind(tenant)
        .bind(account.user_id)
        .fetch_optional(&app.pool)
        .await?
        .map(|(a, b): (String, String)| (Some(a), Some(b)))
        .unwrap_or((None, None));
    let _ = num; // (kept for callers using the upstream helpers)
    Ok(Statement {
        client_name: name.filter(|n| !n.is_empty()).unwrap_or_else(|| account.name.clone()),
        client_email: email.unwrap_or_default(),
        account,
        from,
        to,
        generated_at: now,
        summary,
        charges,
        reconciliation: recon,
        stats: metrics::trade_stats(&tr),
        trades,
        deals,
        ledger: ledger_rows,
        positions,
        orders,
        equity,
        margin,
        floating,
        free_margin: free,
    })
}

pub fn opt_time(v: &Value) -> Option<DateTime<Utc>> {
    jtime(v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::str::FromStr;

    fn d(s: &str) -> Decimal {
        Decimal::from_str(s).unwrap()
    }
    fn t(h: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 9, 10, h, 0, 0).unwrap()
    }
    fn deal(id: i64, entry: &str, profit: &str, swap: &str, comm: &str, h: u32) -> DealRow {
        DealRow {
            id,
            position_ticket: 100 + id,
            symbol: "EURUSD".into(),
            side: if entry == "in" { "buy".into() } else { "sell".into() },
            position_side: "buy".into(),
            entry: entry.into(),
            volume: d("1"),
            price: d("1.1"),
            profit: d(profit),
            swap: d(swap),
            commission: d(comm),
            reason: "client".into(),
            time: t(h),
            open_price: Some(d("1.09")),
            open_time: Some(t(h.saturating_sub(1))),
            comment: String::new(),
            reversed: false,
        }
    }
    fn acct() -> AccountInfo {
        AccountInfo {
            login: 10000001,
            user_id: 1,
            kind: "live".into(),
            group: "ecn".into(),
            group_name: "ECN".into(),
            currency: "USD".into(),
            cent: false,
            leverage: 500,
            mode: "hedging".into(),
            name: "Test".into(),
            status: "active".into(),
            created_at: t(0),
        }
    }

    #[test]
    fn totals_reconcile_with_ledger() {
        let l = |h, txn, sub: &str, kind: &str, amt: &str| (t(h), txn, sub.to_string(), kind.to_string(), d(amt), None, None);
        let inp = Input {
            account: acct(),
            from: t(0),
            to: t(23),
            opening_balance: d("1000"),
            opening_credit: d("0"),
            ledger: vec![
                l(1, 1, "balance", "transfer_in", "500"),
                l(2, 2, "balance", "commission", "-7"),
                l(4, 3, "balance", "trade_pnl", "118.20"),
                l(5, 4, "balance", "commission", "-7"),
                l(7, 5, "balance", "trade_pnl", "-50.55"),
                l(8, 6, "bonus", "bonus", "25"),
                l(9, 7, "balance", "transfer_out", "-200"),
                l(10, 8, "balance", "perf_fee", "-3.10"),
            ],
            deals: vec![deal(1, "in", "0", "0", "7", 2), deal(2, "out", "120", "-1.80", "7", 4), deal(3, "in", "0", "0", "7", 5), deal(4, "out", "-50", "-0.55", "7", 7)],
            spread: d("3.20"),
        };
        let (s, c, r, rows, trades, _) = build(inp);
        assert_eq!(s.deposits, d("500"));
        assert_eq!(s.withdrawals, d("-200"));
        assert_eq!(s.trade_results, d("67.65"));
        assert_eq!(s.commission, d("-14"));
        assert_eq!(s.performance_fees, d("-3.10"));
        assert_eq!(s.closing_balance, d("1350.55"));
        assert_eq!(s.closing_balance, s.opening_balance + s.deposits + s.withdrawals + s.trade_results + s.commission + s.performance_fees + s.adjustments);
        assert_eq!(s.closing_credit, d("25"));
        assert_eq!(s.net_pnl, d("50.55"));
        assert_eq!(c.commission, d("14"));
        assert_eq!(c.swap_paid, d("2.35"));
        assert_eq!(c.total, d("19.45"));
        assert!(r.ok, "{:?}", r.notes);
        assert_eq!(r.deal_trade_results, r.ledger_trade_results);
        assert_eq!(r.deal_commission, r.ledger_commission);
        assert_eq!(trades.len(), 2);
        assert_eq!(rows.last().unwrap().balance, d("1350.55"));
        // bonus rows keep the running balance
        assert_eq!(rows[5].balance, d("1553.65"));
    }

    #[test]
    fn detects_missing_trade_result() {
        let inp = Input {
            account: acct(),
            from: t(0),
            to: t(23),
            opening_balance: d("100"),
            opening_credit: d("0"),
            ledger: vec![],
            deals: vec![deal(2, "out", "10", "0", "0", 4)],
            spread: d("0"),
        };
        let (_, _, r, ..) = build(inp);
        assert!(!r.ok);
    }

    #[test]
    fn trades_in_usd_for_cent() {
        let mut dl = deal(2, "out", "1000", "-10", "0", 4);
        dl.volume = d("0.5");
        let tr = to_trades(1, &[dl], true, |_| 5000.0);
        assert_eq!(tr.len(), 1);
        assert!((tr[0].net - 9.9).abs() < 1e-9);
        assert!((tr[0].balance_before - 50.0).abs() < 1e-9);
        assert!((tr[0].hold_secs() - 3600.0).abs() < 1e-9);
    }
}

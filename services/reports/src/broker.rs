//! Broker reports (D120, D145): book P&L and revenue, deposits / FTDs, funnel, cohorts and LTV, accounts and
//! activity, partner programmes, regulatory exports. Live accounts only; amounts in USD (cent ÷ 100).
//!
//! Revenue model (per closed exit deal / entry deal):
//! - **B-book P&L** = −(client price P&L) on B-book exits.
//! - **Swap** = −(client swap) on exits (all books: the engine executes every trade internally).
//! - **Commission** = entry-deal commission (the booked charge). Kalks FX Options charge commission on every
//!   trade (open and close; none on expiry / knock-out): each option deal's own `commissionCharged`.
//! - **Options** (B-book, the house is the counterparty): broker P&L = −(client realised option P&L) on option
//!   exits (closes, expiries, knock-outs). Premiums and settlements are trading cash, never money in / out, and
//!   option contracts are never counted as lots.
//! - **Spread markup** = group markup × volume per deal side (estimate). It is part of the B-book P&L already,
//!   so net revenue adds it only for A-book volume.
//! - **IB cost** = IB commission lines (lot, split, rebate, CPA, clawback) created in the period, excluding
//!   rejected / void lines.
//! - **Net** = B-book + swap + commission + A-book markup − IB cost.

use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{DateTime, Duration, NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use sqlx::Row;

use crate::error::ApiResult;
use crate::export::{Cell, Table};
use crate::metrics::round2;
use crate::state::App;
use crate::time;
use crate::upstream::{As, Target};

fn f(d: Decimal) -> f64 {
    d.to_f64().unwrap_or(0.0)
}

#[derive(Clone, Debug)]
pub struct D {
    pub time: DateTime<Utc>,
    pub login: i64,
    pub user_id: i64,
    pub group: String,
    pub symbol: String,
    pub entry: String,
    /// lots (cent accounts count 0.01 per lot)
    pub lots: f64,
    pub price: f64,
    pub volume: f64,
    /// USD
    pub profit: f64,
    pub swap: f64,
    pub commission: f64,
    pub book: String,
    /// Kalks FX Options deal: `volume` is contracts (`lots` = 0), `charged` its own commission.
    pub option: bool,
    /// USD commission this deal charged: the entry deal's commission for CFDs, `commissionCharged` for options.
    pub charged: f64,
}

pub async fn deals(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<Vec<D>> {
    let rows = sqlx::query(
        "SELECT d.time, d.login, a.user_id, a.group_code, a.cent, d.symbol, d.entry, d.volume, d.price, d.profit, d.swap, d.commission, d.book, d.option
         FROM deals d JOIN accounts a ON a.tenant = d.tenant AND a.login = d.login
         WHERE d.tenant = $1 AND a.kind = 'live' AND a.group_code NOT LIKE 'prop%' AND NOT d.reversed AND d.time >= $2 AND d.time < $3 ORDER BY d.time",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
            let vol = f(r.get("volume"));
            let symbol: String = r.get("symbol");
            let opt: Option<sqlx::types::Json<Value>> = r.try_get("option").ok().flatten();
            let option = opt.is_some() || crate::statement::is_option_series(&symbol);
            let entry: String = r.get("entry");
            let commission = f(r.get("commission")) * k;
            let charged = if option { opt.as_ref().map(|o| crate::upstream::num(&o.0["commissionCharged"])).unwrap_or(0.0) * k } else if entry == "in" { commission } else { 0.0 };
            D {
                time: r.get("time"),
                login: r.get("login"),
                user_id: r.get("user_id"),
                group: r.get("group_code"),
                symbol,
                entry,
                lots: if option { 0.0 } else { vol * k },
                volume: vol,
                price: f(r.get("price")),
                profit: f(r.get("profit")) * k,
                swap: f(r.get("swap")) * k,
                commission,
                book: r.get("book"),
                option,
                charged,
            }
        })
        .collect())
}

#[derive(Clone, Debug, Default)]
pub struct Rev {
    pub bbook: f64,
    pub abook_client: f64,
    pub swap: f64,
    pub commission: f64,
    pub spread: f64,
    pub spread_a: f64,
    pub ib_cost: f64,
    pub lots: f64,
    pub lots_a: f64,
    pub trades: usize,
    /// Option contracts opened (never lots).
    pub contracts: f64,
    /// The house's realised P&L on option exits (part of `bbook`).
    pub options_pnl: f64,
}

impl Rev {
    pub fn add(&mut self, app: &App, d: &D) {
        if d.option {
            self.add_option(d);
            return;
        }
        let markup = app.specs.deal_markup_usd(&app.specs.spread_group(&d.group), &d.symbol, d.volume, d.price) * if d.lots < d.volume { 0.01 } else { 1.0 };
        self.spread += markup;
        if d.book == "A" {
            self.spread_a += markup;
        }
        if d.entry == "in" {
            self.commission += d.commission;
            self.lots += d.lots;
            if d.book == "A" {
                self.lots_a += d.lots;
            }
        } else {
            self.trades += 1;
            self.swap -= d.swap;
            if d.book == "A" {
                self.abook_client += d.profit;
            } else {
                self.bbook -= d.profit;
            }
        }
    }
    /// A Kalks FX Options deal: commission on every trade, the house's P&L on exits; no lots, no CFD markup.
    pub fn add_option(&mut self, d: &D) {
        self.commission += d.charged;
        self.contracts += if d.entry == "in" { d.volume } else { 0.0 };
        if d.entry != "in" {
            self.trades += 1;
            self.options_pnl -= d.profit;
            self.bbook -= d.profit;
        }
    }
    pub fn fees(&self) -> f64 {
        self.commission + self.swap + self.spread_a
    }
    pub fn net(&self) -> f64 {
        self.bbook + self.swap + self.commission + self.spread_a - self.ib_cost
    }
    pub fn json(&self) -> Value {
        json!({
            "bbook": round2(self.bbook), "swap": round2(self.swap), "commission": round2(self.commission), "spread": round2(self.spread),
            "spreadA": round2(self.spread_a), "ibCost": round2(self.ib_cost), "net": round2(self.net()), "lots": round2(self.lots),
            "lotsA": round2(self.lots_a), "trades": self.trades, "abookClientPnl": round2(self.abook_client),
            "optionContracts": round2(self.contracts), "optionsPnl": round2(self.options_pnl),
        })
    }
}

async fn ib_cost(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<Vec<(DateTime<Utc>, f64, Option<i64>, Option<String>)>> {
    let rows = sqlx::query("SELECT created_at, amount, login, symbol FROM ib_commissions WHERE tenant = $1 AND created_at >= $2 AND created_at < $3 AND status NOT IN ('rejected','void')")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?;
    Ok(rows.iter().map(|r| (r.get("created_at"), f(r.get("amount")), r.get("login"), r.get("symbol"))).collect())
}

async fn names(app: &App, tenant: &str) -> ApiResult<HashMap<i64, (String, String, String)>> {
    let rows = sqlx::query("SELECT user_id, trim(first_name || ' ' || last_name) AS n, email, country FROM clients WHERE tenant = $1").bind(tenant).fetch_all(&app.pool).await?;
    Ok(rows.iter().map(|r| (r.get("user_id"), (r.get("n"), r.get("email"), r.get("country")))).collect())
}

fn days(from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<NaiveDate> {
    let (mut d, end) = (time::server_day(from), time::server_day(to - Duration::seconds(1)));
    let mut v = vec![];
    while d <= end && v.len() < 3700 {
        v.push(d);
        d = d.succ_opt().unwrap();
    }
    v
}

/* ------------------------------------------------------------------ */
/* Broker P&L + revenue                                                */
/* ------------------------------------------------------------------ */

pub async fn pnl(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<(Value, Vec<Table>)> {
    let ds = deals(app, tenant, from, to).await?;
    let ib = ib_cost(app, tenant, from, to).await?;
    let (mut total, mut by_day, mut by_sym, mut by_group, mut by_user) = (Rev::default(), BTreeMap::<NaiveDate, Rev>::new(), BTreeMap::<String, Rev>::new(), BTreeMap::<String, Rev>::new(), HashMap::<i64, (Rev, HashSet<i64>)>::new());
    for d in &ds {
        total.add(app, d);
        by_day.entry(time::server_day(d.time)).or_default().add(app, d);
        by_sym.entry(d.symbol.clone()).or_default().add(app, d);
        by_group.entry(d.group.clone()).or_default().add(app, d);
        let u = by_user.entry(d.user_id).or_default();
        u.0.add(app, d);
        u.1.insert(d.login);
    }
    let login_group: HashMap<i64, String> = ds.iter().map(|d| (d.login, d.group.clone())).collect();
    for (at, amt, login, sym) in &ib {
        total.ib_cost += amt;
        by_day.entry(time::server_day(*at)).or_default().ib_cost += amt;
        if let Some(s) = sym {
            by_sym.entry(s.clone()).or_default().ib_cost += amt;
        }
        if let Some(g) = login.and_then(|l| login_group.get(&l)) {
            by_group.entry(g.clone()).or_default().ib_cost += amt;
        }
    }
    // previous period of the same length
    let len = to - from;
    let prev_ds = deals(app, tenant, from - len, from).await?;
    let mut prev = Rev::default();
    for d in &prev_ds {
        prev.add(app, d);
    }
    prev.ib_cost = ib_cost(app, tenant, from - len, from).await?.iter().map(|x| x.1).sum();

    let group_accounts: HashMap<String, i64> = sqlx::query("SELECT group_code, count(*) AS n FROM accounts WHERE tenant = $1 AND kind = 'live' GROUP BY 1")
        .bind(tenant)
        .fetch_all(&app.pool)
        .await?
        .iter()
        .map(|r| (r.get("group_code"), r.get("n")))
        .collect();
    let nm = names(app, tenant).await?;
    let daily: Vec<Value> = days(from, to)
        .into_iter()
        .map(|d| {
            let r = by_day.get(&d).cloned().unwrap_or_default();
            let mut v = r.json();
            v["date"] = json!(d);
            v
        })
        .collect();
    let symbols: Vec<Value> = by_sym
        .iter()
        .map(|(s, r)| {
            let mut v = r.json();
            v["symbol"] = json!(s);
            v["bookAPct"] = json!(if r.lots > 0.0 { round2(r.lots_a / r.lots * 100.0) } else { 0.0 });
            v
        })
        .collect();
    let groups: Vec<Value> = by_group
        .iter()
        .map(|(g, r)| {
            let mut v = r.json();
            v["group"] = json!(g);
            v["accounts"] = json!(group_accounts.get(g).copied().unwrap_or(0));
            v["fees"] = json!(round2(r.fees()));
            v
        })
        .collect();
    let mut clients: Vec<Value> = by_user
        .iter()
        .map(|(u, (r, logins))| {
            let (n, e, c) = nm.get(u).cloned().unwrap_or_default();
            json!({"userId": u, "name": n, "email": e, "country": c, "logins": logins.iter().collect::<Vec<_>>(), "lots": round2(r.lots), "trades": r.trades,
                   "brokerPnl": round2(r.bbook + r.swap + r.commission + r.spread_a), "bbook": round2(r.bbook), "bookAPct": if r.lots > 0.0 { round2(r.lots_a / r.lots * 100.0) } else { 0.0 }})
        })
        .collect();
    clients.sort_by(|a, b| a["brokerPnl"].as_f64().unwrap_or(0.0).total_cmp(&b["brokerPnl"].as_f64().unwrap_or(0.0)));
    let active = by_user.len();
    let json = json!({
        "from": from, "to": to, "currency": "USD",
        "totals": total.json(), "previous": prev.json(),
        "activeTraders": active,
        "book": {"aLots": round2(total.lots_a), "bLots": round2(total.lots - total.lots_a), "bbookPnl": round2(total.bbook), "abookClientPnl": round2(total.abook_client), "spreadA": round2(total.spread_a), "spreadB": round2(total.spread - total.spread_a)},
        "daily": daily, "bySymbol": symbols, "byGroup": groups, "clients": clients,
    });

    let mut t1 = Table::new("Daily", &["Date", "Lots", "Trades", "B-book P&L", "Swap", "Commission", "Spread markup", "A-book markup", "IB cost", "Net revenue"]);
    for d in json["daily"].as_array().unwrap() {
        t1.rows.push(vec![
            Cell::text(d["date"].as_str().unwrap_or("")),
            Cell::Num(d["lots"].as_f64().unwrap_or(0.0), 2),
            Cell::Int(d["trades"].as_i64().unwrap_or(0)),
            Cell::Num(d["bbook"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(d["swap"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(d["commission"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(d["spread"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(d["spreadA"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(d["ibCost"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(d["net"].as_f64().unwrap_or(0.0), 2),
        ]);
    }
    let rev_row = |key: &str, v: &Value| {
        vec![
            Cell::text(v[key].as_str().unwrap_or("")),
            Cell::Num(v["lots"].as_f64().unwrap_or(0.0), 2),
            Cell::Int(v["trades"].as_i64().unwrap_or(0)),
            Cell::Num(v["bbook"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(v["swap"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(v["commission"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(v["spread"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(v["ibCost"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(v["net"].as_f64().unwrap_or(0.0), 2),
        ]
    };
    let mut t2 = Table::new("By symbol", &["Symbol", "Lots", "Trades", "B-book P&L", "Swap", "Commission", "Spread markup", "IB cost", "Net revenue"]);
    t2.rows = symbols.iter().map(|v| rev_row("symbol", v)).collect();
    let mut t3 = Table::new("By group", &["Group", "Lots", "Trades", "B-book P&L", "Swap", "Commission", "Spread markup", "IB cost", "Net revenue"]);
    t3.rows = groups.iter().map(|v| rev_row("group", v)).collect();
    let mut t4 = Table::new("Clients", &["User", "Name", "Country", "Lots", "Trades", "Broker P&L", "A-book %"]);
    t4.rows = clients
        .iter()
        .map(|c| {
            vec![
                Cell::Int(c["userId"].as_i64().unwrap_or(0)),
                Cell::text(c["name"].as_str().unwrap_or("")),
                Cell::text(c["country"].as_str().unwrap_or("")),
                Cell::Num(c["lots"].as_f64().unwrap_or(0.0), 2),
                Cell::Int(c["trades"].as_i64().unwrap_or(0)),
                Cell::Num(c["brokerPnl"].as_f64().unwrap_or(0.0), 2),
                Cell::Num(c["bookAPct"].as_f64().unwrap_or(0.0), 2),
            ]
        })
        .collect();
    Ok((json, vec![t1, t2, t3, t4]))
}

/* ------------------------------------------------------------------ */
/* Money in / out, FTDs                                                */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug)]
pub struct Money {
    pub at: DateTime<Utc>,
    pub user_id: i64,
    /// + deposit, − withdrawal (USD)
    pub amount: f64,
    pub fee: f64,
    pub source: &'static str,
    pub reference: String,
}

/// Every real-money movement: wallet deposits (credited) and withdrawals (completed), manual wallet deposits /
/// withdrawals staff booked as external payments (`wallet_manual`), plus deposits / withdrawals staff booked
/// directly on live trading accounts. Other manual adjustments (corrections, compensation, bonus, credit…) are
/// never money in or out. `to = None` = up to now.
pub async fn money(app: &App, tenant: &str, from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>) -> ApiResult<Vec<Money>> {
    let mut v = vec![];
    for r in sqlx::query("SELECT id, user_id, amount, chain, credited_at FROM wallet_deposits WHERE tenant = $1 AND status = 'credited' AND user_id IS NOT NULL AND ($2::timestamptz IS NULL OR credited_at >= $2) AND ($3::timestamptz IS NULL OR credited_at < $3)")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?
    {
        v.push(Money { at: r.get("credited_at"), user_id: r.get("user_id"), amount: f(r.get("amount")), fee: 0.0, source: "wallet", reference: format!("deposit #{} {}", r.get::<i64, _>("id"), r.get::<String, _>("chain")) });
    }
    for r in sqlx::query("SELECT id, user_id, amount, fee, chain, completed_at FROM wallet_withdrawals WHERE tenant = $1 AND status = 'completed' AND ($2::timestamptz IS NULL OR completed_at >= $2) AND ($3::timestamptz IS NULL OR completed_at < $3)")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?
    {
        v.push(Money { at: r.get("completed_at"), user_id: r.get("user_id"), amount: -f(r.get("amount")), fee: f(r.get("fee")), source: "wallet", reference: format!("withdrawal #{} {}", r.get::<i64, _>("id"), r.get::<String, _>("chain")) });
    }
    for r in sqlx::query("SELECT id, user_id, kind, amount, applied_at FROM wallet_manual WHERE tenant = $1 AND ($2::timestamptz IS NULL OR applied_at >= $2) AND ($3::timestamptz IS NULL OR applied_at < $3)")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?
    {
        let sign = if r.get::<String, _>("kind") == "withdrawal" { -1.0 } else { 1.0 };
        v.push(Money { at: r.get("applied_at"), user_id: r.get("user_id"), amount: sign * f(r.get("amount")), fee: 0.0, source: "wallet", reference: format!("manual {} ADJ-{}", r.get::<String, _>("kind"), r.get::<i64, _>("id")) });
    }
    for r in sqlx::query(
        "SELECT l.at, a.user_id, l.amount, a.cent, l.txn, l.login FROM ledger l JOIN accounts a ON a.tenant = l.tenant AND a.login = l.login
         WHERE l.tenant = $1 AND a.kind = 'live' AND l.sub_ledger = 'balance' AND l.kind IN ('deposit','withdrawal') AND ($2::timestamptz IS NULL OR l.at >= $2) AND ($3::timestamptz IS NULL OR l.at < $3)",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?
    {
        let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
        v.push(Money { at: r.get("at"), user_id: r.get("user_id"), amount: f(r.get("amount")) * k, fee: 0.0, source: "desk", reference: format!("#{} txn {}", r.get::<i64, _>("login"), r.get::<i64, _>("txn")) });
    }
    v.sort_by_key(|m| m.at);
    Ok(v)
}

/// First deposit per user (all time).
pub async fn ftds(app: &App, tenant: &str) -> ApiResult<HashMap<i64, (DateTime<Utc>, f64)>> {
    let mut m: HashMap<i64, (DateTime<Utc>, f64)> = HashMap::new();
    for x in money(app, tenant, None, None).await? {
        if x.amount > 0.0 {
            m.entry(x.user_id).and_modify(|e| if x.at < e.0 { *e = (x.at, x.amount) }).or_insert((x.at, x.amount));
        }
    }
    Ok(m)
}

#[derive(Clone, Debug, Default)]
struct Agg {
    deposits: f64,
    withdrawals: f64,
    ftds: usize,
    ftd_amount: f64,
    depositors: HashSet<i64>,
    signups: usize,
}

impl Agg {
    fn json(&self, key: &str, label: &str) -> Value {
        json!({key: label, "deposits": round2(self.deposits), "withdrawals": round2(self.withdrawals), "net": round2(self.deposits + self.withdrawals),
               "ftds": self.ftds, "ftdAmount": round2(self.ftd_amount), "depositors": self.depositors.len(), "signups": self.signups})
    }
}

pub async fn deposits(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<(Value, Vec<Table>)> {
    let mv = money(app, tenant, Some(from), Some(to)).await?;
    let first = ftds(app, tenant).await?;
    let clients = sqlx::query("SELECT user_id, trim(first_name || ' ' || last_name) AS n, country, referred_by, campaign, created_at FROM clients WHERE tenant = $1").bind(tenant).fetch_all(&app.pool).await?;
    let mut info: HashMap<i64, (String, String, Option<i64>, Option<String>)> = HashMap::new();
    let mut signups_in: Vec<i64> = vec![];
    for r in &clients {
        let id: i64 = r.get("user_id");
        let created: DateTime<Utc> = r.get("created_at");
        if created >= from && created < to {
            signups_in.push(id);
        }
        info.insert(id, (r.get("n"), r.get("country"), r.get("referred_by"), r.get("campaign")));
    }
    let name_of = |id: i64| info.get(&id).map(|x| x.0.clone()).unwrap_or_default();
    let (mut total, mut by_day, mut by_country, mut by_ib, mut by_campaign) = (Agg::default(), BTreeMap::<NaiveDate, Agg>::new(), BTreeMap::<String, Agg>::new(), BTreeMap::<String, Agg>::new(), BTreeMap::<String, Agg>::new());
    let keys = |u: i64| {
        let i = info.get(&u);
        let country = i.map(|x| x.1.clone()).filter(|c| !c.is_empty()).unwrap_or_else(|| "--".into());
        let ib = i.and_then(|x| x.2).map(|p| format!("{p}")).unwrap_or_else(|| "direct".into());
        let camp = i.and_then(|x| x.3.clone()).unwrap_or_else(|| "(none)".into());
        (country, ib, camp)
    };
    let mut fees = 0.0;
    for m in &mv {
        let (c, ib, camp) = keys(m.user_id);
        let is_ftd = m.amount > 0.0 && first.get(&m.user_id).is_some_and(|(at, _)| *at == m.at);
        fees += m.fee;
        for a in [&mut total, by_day.entry(time::server_day(m.at)).or_default(), by_country.entry(c).or_default(), by_ib.entry(ib).or_default(), by_campaign.entry(camp).or_default()] {
            if m.amount > 0.0 {
                a.deposits += m.amount;
                a.depositors.insert(m.user_id);
            } else {
                a.withdrawals += m.amount;
            }
            if is_ftd {
                a.ftds += 1;
                a.ftd_amount += m.amount;
            }
        }
    }
    for u in &signups_in {
        let (c, ib, camp) = keys(*u);
        total.signups += 1;
        by_country.entry(c).or_default().signups += 1;
        by_ib.entry(ib).or_default().signups += 1;
        by_campaign.entry(camp).or_default().signups += 1;
    }
    let ib_rows: Vec<Value> = by_ib
        .iter()
        .map(|(k, a)| {
            let mut v = a.json("ib", k);
            v["ibName"] = json!(k.parse::<i64>().ok().map(name_of).unwrap_or_else(|| "Direct (no IB)".into()));
            v
        })
        .collect();
    let daily: Vec<Value> = days(from, to).into_iter().map(|d| by_day.get(&d).cloned().unwrap_or_default().json("date", &d.to_string())).collect();
    let mut top: HashMap<i64, f64> = HashMap::new();
    for m in mv.iter().filter(|m| m.amount > 0.0) {
        *top.entry(m.user_id).or_default() += m.amount;
    }
    let mut top: Vec<(i64, f64)> = top.into_iter().collect();
    top.sort_by(|a, b| b.1.total_cmp(&a.1));
    let ftd_list: Vec<Value> = first
        .iter()
        .filter(|(_, (at, _))| *at >= from && *at < to)
        .map(|(u, (at, amt))| {
            let (c, _, camp) = keys(*u);
            json!({"userId": u, "name": name_of(*u), "country": c, "campaign": camp, "at": at, "amount": round2(*amt)})
        })
        .collect();
    let json = json!({
        "from": from, "to": to, "currency": "USD",
        "totals": {"deposits": round2(total.deposits), "withdrawals": round2(total.withdrawals), "net": round2(total.deposits + total.withdrawals), "ftds": total.ftds, "ftdAmount": round2(total.ftd_amount), "depositors": total.depositors.len(), "signups": total.signups, "withdrawalFees": round2(fees),
                   "avgFtd": if total.ftds > 0 { round2(total.ftd_amount / total.ftds as f64) } else { 0.0 }},
        "daily": daily,
        "byCountry": by_country.iter().map(|(k, a)| a.json("country", k)).collect::<Vec<_>>(),
        "byIb": ib_rows,
        "byCampaign": by_campaign.iter().map(|(k, a)| a.json("campaign", k)).collect::<Vec<_>>(),
        "topDepositors": top.iter().take(20).map(|(u, a)| json!({"userId": u, "name": name_of(*u), "amount": round2(*a)})).collect::<Vec<_>>(),
        "ftdList": ftd_list,
    });
    let agg_table = |name: &str, key: &str, rows: &Value| {
        let mut t = Table::new(name, &[key, "Deposits", "Withdrawals", "Net deposits", "FTDs", "FTD amount", "Depositors", "Sign-ups"]);
        for r in rows.as_array().unwrap() {
            t.rows.push(vec![
                Cell::text(r[&key.to_lowercase()].as_str().or(r["ibName"].as_str()).unwrap_or("")),
                Cell::Num(r["deposits"].as_f64().unwrap_or(0.0), 2),
                Cell::Num(r["withdrawals"].as_f64().unwrap_or(0.0), 2),
                Cell::Num(r["net"].as_f64().unwrap_or(0.0), 2),
                Cell::Int(r["ftds"].as_i64().unwrap_or(0)),
                Cell::Num(r["ftdAmount"].as_f64().unwrap_or(0.0), 2),
                Cell::Int(r["depositors"].as_i64().unwrap_or(0)),
                Cell::Int(r["signups"].as_i64().unwrap_or(0)),
            ]);
        }
        t
    };
    let tables = vec![agg_table("Daily", "Date", &json["daily"]), agg_table("By country", "Country", &json["byCountry"]), agg_table("By IB", "IB", &json["byIb"]), agg_table("By campaign", "Campaign", &json["byCampaign"])];
    Ok((json, tables))
}

/* ------------------------------------------------------------------ */
/* Funnel + cohorts / LTV                                              */
/* ------------------------------------------------------------------ */

async fn first_trades(app: &App, tenant: &str) -> ApiResult<HashMap<i64, DateTime<Utc>>> {
    let rows = sqlx::query("SELECT a.user_id, min(d.time) AS t FROM deals d JOIN accounts a ON a.tenant = d.tenant AND a.login = d.login WHERE d.tenant = $1 AND a.kind = 'live' GROUP BY 1")
        .bind(tenant)
        .fetch_all(&app.pool)
        .await?;
    Ok(rows.iter().map(|r| (r.get("user_id"), r.get("t"))).collect())
}

pub async fn funnel(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<(Value, Vec<Table>)> {
    let first = ftds(app, tenant).await?;
    let traded = first_trades(app, tenant).await?;
    let live: HashSet<i64> = sqlx::query_scalar("SELECT DISTINCT user_id FROM accounts WHERE tenant = $1 AND kind = 'live'").bind(tenant).fetch_all(&app.pool).await?.into_iter().collect();
    let rows = sqlx::query("SELECT user_id, country, campaign, referred_by, email_verified, kyc_status, created_at FROM clients WHERE tenant = $1 AND created_at >= $2 AND created_at < $3")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?;
    const STAGES: [&str; 6] = ["registered", "emailVerified", "kycVerified", "liveAccount", "funded", "traded"];
    let mut total = [0usize; 6];
    let mut by_campaign: BTreeMap<String, [usize; 6]> = BTreeMap::new();
    let mut by_country: BTreeMap<String, [usize; 6]> = BTreeMap::new();
    let mut by_day: BTreeMap<NaiveDate, [usize; 6]> = BTreeMap::new();
    let mut ftd_days = vec![];
    for r in &rows {
        let u: i64 = r.get("user_id");
        let created: DateTime<Utc> = r.get("created_at");
        let flags = [true, r.get::<bool, _>("email_verified"), r.get::<String, _>("kyc_status") == "verified", live.contains(&u), first.contains_key(&u), traded.contains_key(&u)];
        if let Some((at, _)) = first.get(&u) {
            ftd_days.push((*at - created).num_hours() as f64 / 24.0);
        }
        let camp = r.get::<Option<String>, _>("campaign").unwrap_or_else(|| if r.get::<Option<i64>, _>("referred_by").is_some() { "(IB link)".into() } else { "(direct)".into() });
        let country = r.get::<String, _>("country");
        for arr in [&mut total, by_campaign.entry(camp).or_default(), by_country.entry(if country.is_empty() { "--".into() } else { country }).or_default(), by_day.entry(time::server_day(created)).or_default()] {
            for (i, f) in flags.iter().enumerate() {
                if *f {
                    arr[i] += 1;
                }
            }
        }
    }
    let stage_json = |a: &[usize; 6]| {
        let mut o = serde_json::Map::new();
        for (i, s) in STAGES.iter().enumerate() {
            o.insert(s.to_string(), json!(a[i]));
        }
        o.insert("conversion".into(), json!(if a[0] > 0 { round2(a[4] as f64 / a[0] as f64 * 100.0) } else { 0.0 }));
        Value::Object(o)
    };
    ftd_days.sort_by(|a, b| a.total_cmp(b));
    let median_days = if ftd_days.is_empty() { None } else { Some(round2(ftd_days[ftd_days.len() / 2])) };
    let json = json!({
        "from": from, "to": to,
        "stages": STAGES.iter().enumerate().map(|(i, s)| json!({"key": s, "count": total[i], "pct": if total[0] > 0 { round2(total[i] as f64 / total[0] as f64 * 100.0) } else { 0.0 }})).collect::<Vec<_>>(),
        "medianDaysToFtd": median_days,
        "byCampaign": by_campaign.iter().map(|(k, a)| { let mut v = stage_json(a); v["campaign"] = json!(k); v }).collect::<Vec<_>>(),
        "byCountry": by_country.iter().map(|(k, a)| { let mut v = stage_json(a); v["country"] = json!(k); v }).collect::<Vec<_>>(),
        "daily": days(from, to).iter().map(|d| { let mut v = stage_json(&by_day.get(d).cloned().unwrap_or_default()); v["date"] = json!(d); v }).collect::<Vec<_>>(),
    });
    let mk = |name: &str, key: &str, rows: &Value| {
        let mut t = Table::new(name, &[key, "Registered", "Email verified", "KYC verified", "Live account", "Funded", "Traded", "Conversion %"]);
        for r in rows.as_array().unwrap() {
            let mut row = vec![Cell::text(r[&key.to_lowercase()].as_str().unwrap_or(""))];
            row.extend(STAGES.iter().map(|s| Cell::Int(r[*s].as_i64().unwrap_or(0))));
            row.push(Cell::Num(r["conversion"].as_f64().unwrap_or(0.0), 2));
            t.rows.push(row);
        }
        t
    };
    let tables = vec![mk("By campaign", "Campaign", &json["byCampaign"]), mk("By country", "Country", &json["byCountry"]), mk("Daily", "Date", &json["daily"])];
    Ok((json, tables))
}

pub async fn cohorts(app: &App, tenant: &str, months: i32) -> ApiResult<(Value, Vec<Table>)> {
    let months = months.clamp(1, 24);
    let this = time::month_start(time::server_day(Utc::now()));
    let first_month = time::add_months(this, -(months - 1));
    let start = time::day_start(first_month);
    let clients = sqlx::query("SELECT user_id, created_at FROM clients WHERE tenant = $1 AND created_at >= $2").bind(tenant).bind(start).fetch_all(&app.pool).await?;
    let month_of = |t: DateTime<Utc>| time::month_start(time::server_day(t));
    let idx = |m: NaiveDate| ((m.format("%Y").to_string().parse::<i32>().unwrap() * 12 + m.format("%m").to_string().parse::<i32>().unwrap()) - (first_month.format("%Y").to_string().parse::<i32>().unwrap() * 12 + first_month.format("%m").to_string().parse::<i32>().unwrap())) as usize;
    let mut cohort_of: HashMap<i64, usize> = HashMap::new();
    let mut size = vec![0usize; months as usize];
    for r in &clients {
        let c = idx(month_of(r.get("created_at")));
        if c < months as usize {
            cohort_of.insert(r.get("user_id"), c);
            size[c] += 1;
        }
    }
    let n = months as usize;
    let mut active = vec![vec![HashSet::<i64>::new(); n]; n];
    let mut revenue = vec![vec![0.0f64; n]; n];
    let mut net_dep = vec![vec![0.0f64; n]; n];
    let mut funded = vec![HashSet::<i64>::new(); n];
    for d in deals(app, tenant, start, Utc::now()).await? {
        if let Some(&c) = cohort_of.get(&d.user_id) {
            let k = idx(month_of(d.time));
            if k >= c && k < n {
                active[c][k - c].insert(d.user_id);
                let mut r = Rev::default();
                r.add(app, &d);
                revenue[c][k - c] += r.bbook + r.swap + r.commission + r.spread_a;
            }
        }
    }
    for m in money(app, tenant, Some(start), None).await? {
        if let Some(&c) = cohort_of.get(&m.user_id) {
            let k = idx(month_of(m.at));
            if k >= c && k < n {
                net_dep[c][k - c] += m.amount;
                if m.amount > 0.0 {
                    funded[c].insert(m.user_id);
                }
            }
        }
    }
    let mut rows = vec![];
    let mut table = Table::new("Cohorts", &["Cohort", "Clients", "Funded", "M0 active %", "M1 active %", "M2 active %", "M3 active %", "LTV net deposits", "LTV revenue", "Revenue per client"]);
    for c in 0..n {
        let span = n - c;
        let cm = time::add_months(first_month, c as i32);
        let retention: Vec<f64> = (0..span).map(|k| if size[c] > 0 { round2(active[c][k].len() as f64 / size[c] as f64 * 100.0) } else { 0.0 }).collect();
        let mut cum_rev = 0.0;
        let mut cum_dep = 0.0;
        let ltv: Vec<Value> = (0..span)
            .map(|k| {
                cum_rev += revenue[c][k];
                cum_dep += net_dep[c][k];
                json!({"month": k, "revenue": round2(cum_rev), "netDeposits": round2(cum_dep), "revenuePerClient": if size[c] > 0 { round2(cum_rev / size[c] as f64) } else { 0.0 }})
            })
            .collect();
        rows.push(json!({"cohort": cm.format("%Y-%m").to_string(), "clients": size[c], "funded": funded[c].len(), "retention": retention, "ltv": ltv}));
        let pct = |k: usize| retention.get(k).map(|x| Cell::Num(*x, 2)).unwrap_or(Cell::Empty);
        table.rows.push(vec![
            Cell::text(cm.format("%Y-%m").to_string()),
            Cell::Int(size[c] as i64),
            Cell::Int(funded[c].len() as i64),
            pct(0),
            pct(1),
            pct(2),
            pct(3),
            Cell::Num(round2(cum_dep), 2),
            Cell::Num(round2(cum_rev), 2),
            Cell::Num(if size[c] > 0 { round2(cum_rev / size[c] as f64) } else { 0.0 }, 2),
        ]);
    }
    let total_clients: usize = size.iter().sum();
    let total_rev: f64 = revenue.iter().flatten().sum();
    let total_dep: f64 = net_dep.iter().flatten().sum();
    Ok((
        json!({"months": months, "cohorts": rows, "totals": {"clients": total_clients, "revenue": round2(total_rev), "netDeposits": round2(total_dep), "ltvRevenue": if total_clients > 0 { round2(total_rev / total_clients as f64) } else { 0.0 }, "ltvNetDeposits": if total_clients > 0 { round2(total_dep / total_clients as f64) } else { 0.0 }}}),
        vec![table],
    ))
}

/* ------------------------------------------------------------------ */
/* Accounts & activity                                                 */
/* ------------------------------------------------------------------ */

pub async fn activity(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<(Value, Vec<Table>)> {
    let accts = sqlx::query("SELECT login, user_id, kind, group_code, cent, balance, equity, positions, created_at, status FROM accounts WHERE tenant = $1").bind(tenant).fetch_all(&app.pool).await?;
    let all_deals = sqlx::query(
        "SELECT d.login, d.time, d.entry, d.volume, d.symbol, (d.option IS NOT NULL) AS is_option, a.cent, a.kind FROM deals d JOIN accounts a ON a.tenant = d.tenant AND a.login = d.login WHERE d.tenant = $1 AND d.time >= $2 AND d.time < $3 AND NOT d.reversed",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?;
    let mut by_day: BTreeMap<NaiveDate, (usize, usize, HashSet<i64>, usize, f64, HashSet<i64>)> = BTreeMap::new();
    let mut per_login: HashMap<i64, (usize, f64, DateTime<Utc>)> = HashMap::new();
    for r in &accts {
        let created: DateTime<Utc> = r.get("created_at");
        if created >= from && created < to {
            let e = by_day.entry(time::server_day(created)).or_default();
            if r.get::<String, _>("kind") == "live" { e.0 += 1 } else { e.1 += 1 }
        }
    }
    for r in &all_deals {
        let t: DateTime<Utc> = r.get("time");
        let login: i64 = r.get("login");
        let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
        // option contracts are not lots
        let option = r.get::<bool, _>("is_option") || crate::statement::is_option_series(&r.get::<String, _>("symbol"));
        let lots = if option { 0.0 } else { f(r.get("volume")) * k };
        let live = r.get::<String, _>("kind") == "live";
        let e = by_day.entry(time::server_day(t)).or_default();
        if live {
            e.2.insert(login);
        } else {
            e.5.insert(login);
        }
        if r.get::<String, _>("entry") == "in" {
            if live {
                e.3 += 1;
                e.4 += lots;
            }
            let p = per_login.entry(login).or_insert((0, 0.0, t));
            p.0 += 1;
            p.1 += lots;
            p.2 = p.2.max(t);
        }
    }
    let live: Vec<_> = accts.iter().filter(|r| r.get::<String, _>("kind") == "live").collect();
    let funded = live.iter().filter(|r| r.get::<Decimal, _>("balance") > Decimal::ZERO).count();
    let with_pos = live.iter().filter(|r| r.get::<i32, _>("positions") > 0).count();
    let active_live: HashSet<i64> = all_deals.iter().filter(|r| r.get::<String, _>("kind") == "live").map(|r| r.get("login")).collect();
    let mut by_group: BTreeMap<String, (usize, usize, f64)> = BTreeMap::new();
    for r in &live {
        let e = by_group.entry(r.get("group_code")).or_default();
        e.0 += 1;
        if r.get::<Decimal, _>("balance") > Decimal::ZERO {
            e.1 += 1;
        }
        let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
        e.2 += f(r.get("equity")) * k;
    }
    let mut top: Vec<Value> = per_login
        .iter()
        .filter_map(|(l, (n, lots, last))| {
            let a = accts.iter().find(|r| r.get::<i64, _>("login") == *l)?;
            Some(json!({"login": l, "userId": a.get::<i64, _>("user_id"), "type": a.get::<String, _>("kind"), "group": a.get::<String, _>("group_code"), "trades": n, "lots": round2(*lots), "lastTrade": last}))
        })
        .collect();
    top.sort_by(|a, b| b["lots"].as_f64().unwrap_or(0.0).total_cmp(&a["lots"].as_f64().unwrap_or(0.0)));
    let daily: Vec<Value> = days(from, to)
        .iter()
        .map(|d| {
            let e = by_day.get(d).cloned().unwrap_or_default();
            json!({"date": d, "liveOpened": e.0, "demoOpened": e.1, "activeLive": e.2.len(), "activeDemo": e.5.len(), "trades": e.3, "lots": round2(e.4)})
        })
        .collect();
    let json = json!({
        "from": from, "to": to,
        "totals": {"live": live.len(), "demo": accts.len() - live.len(), "funded": funded, "withPositions": with_pos, "activeLive": active_live.len(),
                   "liveEquity": round2(live.iter().map(|r| f(r.get("equity")) * if r.get::<bool, _>("cent") { 0.01 } else { 1.0 }).sum())},
        "daily": daily,
        "byGroup": by_group.iter().map(|(g, (n, fu, eq))| json!({"group": g, "accounts": n, "funded": fu, "equity": round2(*eq)})).collect::<Vec<_>>(),
        "topAccounts": top.iter().take(50).collect::<Vec<_>>(),
    });
    let mut t = Table::new("Daily activity", &["Date", "Live opened", "Demo opened", "Active live", "Active demo", "Trades (live)", "Lots (live)"]);
    for d in json["daily"].as_array().unwrap() {
        t.rows.push(vec![
            Cell::text(d["date"].as_str().unwrap_or("")),
            Cell::Int(d["liveOpened"].as_i64().unwrap_or(0)),
            Cell::Int(d["demoOpened"].as_i64().unwrap_or(0)),
            Cell::Int(d["activeLive"].as_i64().unwrap_or(0)),
            Cell::Int(d["activeDemo"].as_i64().unwrap_or(0)),
            Cell::Int(d["trades"].as_i64().unwrap_or(0)),
            Cell::Num(d["lots"].as_f64().unwrap_or(0.0), 2),
        ]);
    }
    let mut t2 = Table::new("Accounts", &["Login", "User", "Type", "Group", "Trades", "Lots", "Last trade"]);
    for a in &top {
        t2.rows.push(vec![
            Cell::Int(a["login"].as_i64().unwrap_or(0)),
            Cell::Int(a["userId"].as_i64().unwrap_or(0)),
            Cell::text(a["type"].as_str().unwrap_or("")),
            Cell::text(a["group"].as_str().unwrap_or("")),
            Cell::Int(a["trades"].as_i64().unwrap_or(0)),
            Cell::Num(a["lots"].as_f64().unwrap_or(0.0), 2),
            Cell::text(a["lastTrade"].as_str().unwrap_or("")),
        ]);
    }
    Ok((json, vec![t, t2]))
}

/* ------------------------------------------------------------------ */
/* Partners (IB / PAMM / copy / prop)                                  */
/* ------------------------------------------------------------------ */

pub async fn partners(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<(Value, Vec<Table>)> {
    let rows = sqlx::query(
        "SELECT kind, status, count(*) AS n, COALESCE(sum(amount), 0) AS amt, COALESCE(sum(lots), 0) AS lots FROM ib_commissions WHERE tenant = $1 AND created_at >= $2 AND created_at < $3 GROUP BY 1, 2",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?;
    let by_kind: Vec<Value> = rows.iter().map(|r| json!({"kind": r.get::<String, _>("kind"), "status": r.get::<String, _>("status"), "lines": r.get::<i64, _>("n"), "amount": round2(f(r.get("amt"))), "lots": round2(f(r.get("lots")))})).collect();
    let top = sqlx::query(
        "SELECT k.beneficiary_id, trim(c.first_name || ' ' || c.last_name) AS n, c.country, count(DISTINCT k.client_id) AS clients, sum(k.amount) AS amt, sum(k.lots) FILTER (WHERE k.kind = 'lot') AS lots
         FROM ib_commissions k LEFT JOIN clients c ON c.tenant = k.tenant AND c.user_id = k.beneficiary_id
         WHERE k.tenant = $1 AND k.created_at >= $2 AND k.created_at < $3 AND k.status NOT IN ('rejected','void') GROUP BY 1, 2, 3 ORDER BY amt DESC LIMIT 50",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?;
    let top_ibs: Vec<Value> = top
        .iter()
        .map(|r| json!({"userId": r.get::<i64, _>("beneficiary_id"), "name": r.get::<Option<String>, _>("n"), "country": r.get::<Option<String>, _>("country"), "clients": r.get::<i64, _>("clients"), "amount": round2(f(r.get("amt"))), "lots": round2(r.get::<Option<Decimal>, _>("lots").map(f).unwrap_or(0.0))}))
        .collect();
    let referred: i64 = sqlx::query_scalar("SELECT count(*) FROM clients WHERE tenant = $1 AND referred_by IS NOT NULL AND created_at >= $2 AND created_at < $3").bind(tenant).bind(from).bind(to).fetch_one(&app.pool).await?;
    let ib_overview = app.up.get(Target::Ib, tenant, As::Staff, "/v1/ib/admin/overview").await.ok();
    let prop = app.up.get(Target::Prop, tenant, As::Staff, "/v1/admin/overview").await.ok();
    let social = app.up.get(Target::Engine, tenant, As::Staff, "/v1/social/admin/overview").await.ok();
    let fees = app.up.get(Target::Engine, tenant, As::Staff, "/v1/social/admin/fees").await.ok();
    let json = json!({
        "from": from, "to": to,
        "ib": {"byKind": by_kind, "topIbs": top_ibs, "referredSignups": referred, "overview": ib_overview},
        "social": {"overview": social, "feeTotals": fees.as_ref().map(|f| f["totals"].clone())},
        "prop": prop,
    });
    let mut t = Table::new("IB commissions", &["Kind", "Status", "Lines", "Amount", "Lots"]);
    for r in &by_kind {
        t.rows.push(vec![Cell::text(r["kind"].as_str().unwrap_or("")), Cell::text(r["status"].as_str().unwrap_or("")), Cell::Int(r["lines"].as_i64().unwrap_or(0)), Cell::Num(r["amount"].as_f64().unwrap_or(0.0), 2), Cell::Num(r["lots"].as_f64().unwrap_or(0.0), 2)]);
    }
    let mut t2 = Table::new("Top IBs", &["User", "Name", "Country", "Clients", "Commission", "Lots"]);
    for r in &top_ibs {
        t2.rows.push(vec![
            Cell::Int(r["userId"].as_i64().unwrap_or(0)),
            Cell::text(r["name"].as_str().unwrap_or("")),
            Cell::text(r["country"].as_str().unwrap_or("")),
            Cell::Int(r["clients"].as_i64().unwrap_or(0)),
            Cell::Num(r["amount"].as_f64().unwrap_or(0.0), 2),
            Cell::Num(r["lots"].as_f64().unwrap_or(0.0), 2),
        ]);
    }
    Ok((json, vec![t, t2]))
}

/* ------------------------------------------------------------------ */
/* Regulatory exports                                                  */
/* ------------------------------------------------------------------ */

/// Money movements (wallet + desk + account transfers), with the client's identity and country.
pub async fn transactions(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<Vec<Table>> {
    let nm = names(app, tenant).await?;
    let mut t = Table::new("Transactions", &["Time (server)", "Source", "Type", "User", "Client", "Country", "Account", "Amount", "Currency", "Status", "Reference"]);
    for r in sqlx::query("SELECT * FROM wallet_deposits WHERE tenant = $1 AND created_at >= $2 AND created_at < $3 ORDER BY created_at").bind(tenant).bind(from).bind(to).fetch_all(&app.pool).await? {
        let u: Option<i64> = r.get("user_id");
        let (n, _, c) = u.and_then(|u| nm.get(&u).cloned()).unwrap_or_default();
        t.rows.push(vec![
            Cell::Time(r.get::<Option<DateTime<Utc>>, _>("credited_at").unwrap_or(r.get("created_at"))),
            Cell::text("wallet"),
            Cell::text("deposit"),
            u.map(Cell::Int).unwrap_or(Cell::Empty),
            Cell::text(n),
            Cell::text(c),
            Cell::Empty,
            Cell::Num(f(r.get("amount")), 2),
            Cell::text(r.get::<String, _>("currency")),
            Cell::text(r.get::<String, _>("status")),
            Cell::text(format!("#{} {}", r.get::<i64, _>("id"), r.get::<String, _>("chain"))),
        ]);
    }
    for r in sqlx::query("SELECT * FROM wallet_withdrawals WHERE tenant = $1 AND created_at >= $2 AND created_at < $3 ORDER BY created_at").bind(tenant).bind(from).bind(to).fetch_all(&app.pool).await? {
        let u: i64 = r.get("user_id");
        let (n, _, c) = nm.get(&u).cloned().unwrap_or_default();
        t.rows.push(vec![
            Cell::Time(r.get::<Option<DateTime<Utc>>, _>("completed_at").unwrap_or(r.get("created_at"))),
            Cell::text("wallet"),
            Cell::text("withdrawal"),
            Cell::Int(u),
            Cell::text(n),
            Cell::text(c),
            Cell::Empty,
            Cell::Num(-f(r.get("amount")), 2),
            Cell::text(r.get::<String, _>("currency")),
            Cell::text(r.get::<String, _>("status")),
            Cell::text(format!("#{} {} fee {}", r.get::<i64, _>("id"), r.get::<String, _>("chain"), f(r.get("fee")))),
        ]);
    }
    for r in sqlx::query(
        "SELECT l.*, a.user_id FROM ledger l JOIN accounts a ON a.tenant = l.tenant AND a.login = l.login
         WHERE l.tenant = $1 AND a.kind = 'live' AND l.kind IN ('transfer_in','transfer_out','deposit','withdrawal','adjustment','credit','bonus','nbp','perf_fee') AND l.at >= $2 AND l.at < $3 ORDER BY l.at",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?
    {
        let u: i64 = r.get("user_id");
        let (n, _, c) = nm.get(&u).cloned().unwrap_or_default();
        t.rows.push(vec![
            Cell::Time(r.get("at")),
            Cell::text("trading"),
            Cell::text(r.get::<String, _>("kind")),
            Cell::Int(u),
            Cell::text(n),
            Cell::text(c),
            Cell::Int(r.get("login")),
            Cell::Num(f(r.get("amount")), 2),
            Cell::text(r.get::<String, _>("currency")),
            Cell::text("booked"),
            Cell::text(format!("txn {} {}", r.get::<i64, _>("txn"), r.get::<Option<String>, _>("reason_code").unwrap_or_default())),
        ]);
    }
    Ok(vec![t])
}

pub async fn client_list(app: &App, tenant: &str) -> ApiResult<Vec<Table>> {
    let first = ftds(app, tenant).await?;
    let mut totals: HashMap<i64, (f64, f64)> = HashMap::new();
    for m in money(app, tenant, None, None).await? {
        let e = totals.entry(m.user_id).or_default();
        if m.amount > 0.0 { e.0 += m.amount } else { e.1 += m.amount }
    }
    let accts: HashMap<i64, (i64, i64)> = sqlx::query("SELECT user_id, count(*) FILTER (WHERE kind = 'live') AS l, count(*) FILTER (WHERE kind = 'demo') AS d FROM accounts WHERE tenant = $1 GROUP BY 1")
        .bind(tenant)
        .fetch_all(&app.pool)
        .await?
        .iter()
        .map(|r| (r.get("user_id"), (r.get("l"), r.get("d"))))
        .collect();
    let mut t = Table::new("Clients", &["User", "First name", "Last name", "Email", "Country", "Registered", "Email verified", "KYC", "Status", "Referred by", "Campaign", "Live accounts", "Demo accounts", "First deposit", "Deposits", "Withdrawals", "Net deposits"]);
    for r in sqlx::query("SELECT * FROM clients WHERE tenant = $1 ORDER BY user_id").bind(tenant).fetch_all(&app.pool).await? {
        let u: i64 = r.get("user_id");
        let (dep, wd) = totals.get(&u).cloned().unwrap_or_default();
        let (l, d) = accts.get(&u).cloned().unwrap_or_default();
        t.rows.push(vec![
            Cell::Int(u),
            Cell::text(r.get::<String, _>("first_name")),
            Cell::text(r.get::<String, _>("last_name")),
            Cell::text(r.get::<String, _>("email")),
            Cell::text(r.get::<String, _>("country")),
            Cell::Time(r.get("created_at")),
            Cell::text(if r.get::<bool, _>("email_verified") { "yes" } else { "no" }),
            Cell::text(r.get::<String, _>("kyc_status")),
            Cell::text(r.get::<String, _>("status")),
            r.get::<Option<i64>, _>("referred_by").map(Cell::Int).unwrap_or(Cell::Empty),
            Cell::text(r.get::<Option<String>, _>("campaign").unwrap_or_default()),
            Cell::Int(l),
            Cell::Int(d),
            first.get(&u).map(|x| Cell::Time(x.0)).unwrap_or(Cell::Empty),
            Cell::Num(round2(dep), 2),
            Cell::Num(round2(wd), 2),
            Cell::Num(round2(dep + wd), 2),
        ]);
    }
    Ok(vec![t])
}

pub async fn trades_export(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<Vec<Table>> {
    let nm = names(app, tenant).await?;
    let mut t = Table::new("Deals", &["Time (server)", "Deal", "Account", "User", "Client", "Country", "Group", "Symbol", "Direction", "Entry", "Volume", "Price", "Profit", "Swap", "Commission", "Book", "Reason", "Source", "Instrument"]);
    for r in sqlx::query(
        "SELECT d.*, a.user_id, a.group_code FROM deals d JOIN accounts a ON a.tenant = d.tenant AND a.login = d.login WHERE d.tenant = $1 AND a.kind = 'live' AND d.time >= $2 AND d.time < $3 ORDER BY d.time, d.id",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?
    {
        let u: i64 = r.get("user_id");
        let (n, _, c) = nm.get(&u).cloned().unwrap_or_default();
        t.rows.push(vec![
            Cell::Time(r.get("time")),
            Cell::Int(r.get("id")),
            Cell::Int(r.get("login")),
            Cell::Int(u),
            Cell::text(n),
            Cell::text(c),
            Cell::text(r.get::<String, _>("group_code")),
            Cell::text(r.get::<String, _>("symbol")),
            Cell::text(r.get::<String, _>("side")),
            Cell::text(r.get::<String, _>("entry")),
            Cell::Num(f(r.get("volume")), 2),
            Cell::Num(f(r.get("price")), 5),
            Cell::Num(f(r.get("profit")), 2),
            Cell::Num(f(r.get("swap")), 2),
            Cell::Num(f(r.get("commission")), 2),
            Cell::text(r.get::<String, _>("book")),
            Cell::text(r.get::<String, _>("reason")),
            Cell::text(if r.get::<bool, _>("reversed") { "reversed".to_string() } else { r.get::<String, _>("source") }),
            // option deals: volume = contracts, price = premium per unit
            Cell::text(if r.try_get::<Option<sqlx::types::Json<Value>>, _>("option").ok().flatten().is_some() || crate::statement::is_option_series(&r.get::<String, _>("symbol")) { "option" } else { "cfd" }),
        ]);
    }
    Ok(vec![t])
}

/// AML review list: large single movements, fast in-and-out (a withdrawal within 72 h of a deposit of a similar
/// amount with little trading), plus the open IB fraud flags from the IB service.
pub async fn aml(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>, large: f64) -> ApiResult<Vec<Table>> {
    let nm = names(app, tenant).await?;
    let mv = money(app, tenant, Some(from - Duration::days(3)), Some(to)).await?;
    let lots: HashMap<i64, f64> = deals(app, tenant, from - Duration::days(3), to).await?.iter().filter(|d| d.entry == "in").fold(HashMap::new(), |mut m, d| {
        *m.entry(d.user_id).or_default() += d.lots;
        m
    });
    let mut t = Table::new("AML flags", &["Time (server)", "Rule", "User", "Client", "Country", "Amount", "Detail"]);
    for m in mv.iter().filter(|m| m.at >= from) {
        let (n, _, c) = nm.get(&m.user_id).cloned().unwrap_or_default();
        if m.amount.abs() >= large {
            t.rows.push(vec![Cell::Time(m.at), Cell::text("large_transaction"), Cell::Int(m.user_id), Cell::text(n.clone()), Cell::text(c.clone()), Cell::Num(m.amount, 2), Cell::text(format!("{} {}", m.source, m.reference))]);
        }
        if m.amount < 0.0 {
            let dep = mv.iter().find(|d| d.user_id == m.user_id && d.amount > 0.0 && d.at <= m.at && m.at - d.at <= Duration::hours(72) && (-m.amount) >= d.amount * 0.8);
            if let Some(d) = dep
                && lots.get(&m.user_id).copied().unwrap_or(0.0) < 1.0
            {
                t.rows.push(vec![
                    Cell::Time(m.at),
                    Cell::text("in_and_out"),
                    Cell::Int(m.user_id),
                    Cell::text(n),
                    Cell::text(c),
                    Cell::Num(m.amount, 2),
                    Cell::text(format!("deposit {:.2} at {} withdrawn within 72 h, {:.2} lots traded", d.amount, time::fmt_server(d.at), lots.get(&m.user_id).copied().unwrap_or(0.0))),
                ]);
            }
        }
    }
    if let Ok(v) = app.up.get(Target::Ib, tenant, As::Staff, "/v1/ib/admin/flags?status=open").await {
        let items = v["items"].as_array().or(v["flags"].as_array()).cloned().unwrap_or_default();
        for fl in items {
            t.rows.push(vec![
                fl["createdAt"].as_str().and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|x| Cell::Time(x.with_timezone(&Utc))).unwrap_or(Cell::Empty),
                Cell::text(format!("ib_{}", fl["kind"].as_str().unwrap_or("flag"))),
                fl["userId"].as_i64().or(fl["memberId"].as_i64()).map(Cell::Int).unwrap_or(Cell::Empty),
                Cell::text(fl["name"].as_str().unwrap_or("")),
                Cell::Empty,
                Cell::Empty,
                Cell::text(fl["summary"].as_str().or(fl["detail"].as_str()).unwrap_or("")),
            ]);
        }
    }
    Ok(vec![t])
}

/// Sync health for the Back Office.
pub async fn status(app: &App, tenant: &str) -> ApiResult<Value> {
    let r = sqlx::query(
        "SELECT (SELECT count(*) FROM accounts WHERE tenant = $1) AS accounts, (SELECT count(*) FROM deals WHERE tenant = $1) AS deals,
                (SELECT count(*) FROM ledger WHERE tenant = $1) AS ledger, (SELECT count(*) FROM clients WHERE tenant = $1) AS clients,
                (SELECT count(*) FROM snapshots WHERE tenant = $1) AS snapshots, (SELECT max(seen_at) FROM accounts WHERE tenant = $1) AS last_sync,
                (SELECT count(*) FROM accounts WHERE tenant = $1 AND synced_version <> version) AS pending",
    )
    .bind(tenant)
    .fetch_one(&app.pool)
    .await?;
    Ok(json!({
        "accounts": r.get::<i64, _>("accounts"), "deals": r.get::<i64, _>("deals"), "ledger": r.get::<i64, _>("ledger"), "clients": r.get::<i64, _>("clients"),
        "snapshots": r.get::<i64, _>("snapshots"), "lastSync": r.get::<Option<DateTime<Utc>>, _>("last_sync"), "pendingAccounts": r.get::<i64, _>("pending"),
        "smtp": app.mailer.is_some(), "markups": !app.specs.markups.read().unwrap().is_empty(),
    }))
}

/* ------------------------------------------------------------------ */
/* UTM campaign attribution (D144)                                     */
/* ------------------------------------------------------------------ */

#[derive(Default, Clone)]
struct CampAgg {
    signups: usize,
    verified: usize,
    kyc: usize,
    ftds: usize,
    ftd_amount: f64,
    deposits: f64,
    withdrawals: f64,
}

impl CampAgg {
    fn json(&self) -> Value {
        json!({"signups": self.signups, "emailVerified": self.verified, "kycVerified": self.kyc, "ftds": self.ftds, "ftdAmount": round2(self.ftd_amount),
               "deposits": round2(self.deposits), "withdrawals": round2(self.withdrawals), "net": round2(self.deposits + self.withdrawals),
               "conversion": if self.signups > 0 { round2(self.ftds as f64 / self.signups as f64 * 100.0) } else { 0.0 }})
    }
}

/// Sign-ups in `[from, to)` grouped by first-touch utm source / medium / campaign, with their conversion to a
/// first deposit and the money they moved in the same window. Clients without UTM are "(direct)" or "(IB link)".
pub async fn campaigns(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>) -> ApiResult<Value> {
    let first = ftds(app, tenant).await?;
    let rows = sqlx::query("SELECT user_id, utm_source, utm_medium, campaign, referred_by, email_verified, kyc_status FROM clients WHERE tenant = $1 AND created_at >= $2 AND created_at < $3")
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&app.pool)
        .await?;
    let mut key_of: HashMap<i64, (String, String, String)> = HashMap::new();
    let mut groups: BTreeMap<(String, String, String), CampAgg> = BTreeMap::new();
    let mut sources: BTreeMap<String, CampAgg> = BTreeMap::new();
    let mut total = CampAgg::default();
    for r in &rows {
        let u: i64 = r.get("user_id");
        let ib = r.get::<Option<i64>, _>("referred_by").is_some();
        let src = r.get::<Option<String>, _>("utm_source").unwrap_or_else(|| if ib { "(IB link)".into() } else { "(direct)".into() });
        let med = r.get::<Option<String>, _>("utm_medium").unwrap_or_default();
        let camp = r.get::<Option<String>, _>("campaign").unwrap_or_default();
        let k = (src.clone(), med, camp);
        key_of.insert(u, k.clone());
        let ftd = first.get(&u).filter(|(at, _)| *at >= from);
        for a in [&mut total, groups.entry(k).or_default(), sources.entry(src).or_default()] {
            a.signups += 1;
            a.verified += r.get::<bool, _>("email_verified") as usize;
            a.kyc += (r.get::<String, _>("kyc_status") == "verified") as usize;
            if let Some((_, amt)) = ftd {
                a.ftds += 1;
                a.ftd_amount += amt;
            }
        }
    }
    for m in money(app, tenant, Some(from), Some(to)).await? {
        let Some(k) = key_of.get(&m.user_id) else { continue };
        let src = k.0.clone();
        for a in [&mut total, groups.entry(k.clone()).or_default(), sources.entry(src).or_default()] {
            if m.amount > 0.0 { a.deposits += m.amount } else { a.withdrawals += m.amount }
        }
    }
    let mut items: Vec<Value> = groups
        .iter()
        .map(|((s, m, c), a)| {
            let mut v = a.json();
            v["source"] = json!(s);
            v["medium"] = json!(m);
            v["campaign"] = json!(c);
            v
        })
        .collect();
    items.sort_by(|a, b| b["signups"].as_u64().cmp(&a["signups"].as_u64()));
    Ok(json!({
        "from": from, "to": to, "currency": "USD",
        "totals": total.json(),
        "items": items,
        "bySource": sources.iter().map(|(s, a)| { let mut v = a.json(); v["source"] = json!(s); v }).collect::<Vec<_>>(),
    }))
}

/// Lifecycle facts per client for marketing journeys (growth service): first deposit, first live account,
/// first live trade. Only clients with at least one fact are listed.
pub async fn client_facts(app: &App, tenant: &str) -> ApiResult<Value> {
    let first = ftds(app, tenant).await?;
    let traded = first_trades(app, tenant).await?;
    let accounts: HashMap<i64, DateTime<Utc>> = sqlx::query("SELECT user_id, min(created_at) AS t FROM accounts WHERE tenant = $1 AND kind = 'live' GROUP BY 1")
        .bind(tenant)
        .fetch_all(&app.pool)
        .await?
        .iter()
        .map(|r| (r.get("user_id"), r.get("t")))
        .collect();
    let mut ids: Vec<i64> = first.keys().chain(traded.keys()).chain(accounts.keys()).copied().collect();
    ids.sort_unstable();
    ids.dedup();
    let items: Vec<Value> = ids
        .iter()
        .map(|u| json!({"userId": u, "firstDepositAt": first.get(u).map(|x| x.0), "firstLiveAccountAt": accounts.get(u), "firstTradeAt": traded.get(u)}))
        .collect();
    Ok(json!({"tenant": tenant, "items": items}))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn deal(entry: &str, option: bool, volume: f64, profit: f64, commission: f64, charged: f64) -> D {
        D {
            time: Utc::now(),
            login: 1,
            user_id: 1,
            group: "standard".into(),
            symbol: if option { "EURUSD-20261009-1.1650-C".into() } else { "EURUSD".into() },
            entry: entry.into(),
            lots: if option { 0.0 } else { volume },
            price: 0.0052,
            volume,
            profit,
            swap: 0.0,
            commission,
            book: "B".into(),
            option,
            charged,
        }
    }

    #[test]
    fn option_deals_book_commission_on_every_trade_and_never_lots() {
        let mut r = Rev::default();
        // open 2 contracts (commission 0.50), close them for a client profit of 8 (commission 0.50 on the close;
        // the exit deal's `commission` also carries the entry share, which must not be counted twice)
        r.add_option(&deal("in", true, 2.0, 0.0, 0.5, 0.5));
        r.add_option(&deal("out", true, 2.0, 8.0, 1.0, 0.5));
        // a short that expired worthless: the client keeps the premium (profit 50), no commission on expiry
        r.add_option(&deal("out", true, 1.0, 50.0, 0.25, 0.0));
        assert_eq!((r.commission, r.lots, r.contracts, r.trades), (1.0, 0.0, 2.0, 2));
        assert_eq!((r.bbook, r.options_pnl), (-58.0, -58.0));
        assert_eq!(r.net(), -57.0);
        assert_eq!(r.swap, 0.0);
    }
}

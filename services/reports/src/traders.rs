//! Trader analytics (Analytics → Traders): who wins and who loses against the broker over a period, by day, week
//! or month. Live accounts only (prop groups excluded), amounts in USD (cent ÷ 100), server time.
//!
//! - **Population**: clients with at least one closed trade (exit deal) in `[from, to)`.
//! - **Realised net** per trade = profit + swap − commission share (same as client analytics). Segments use the
//!   realised net of the period: profitable (> +5 USD), losing (< −5 USD), break-even (within ±5 USD).
//! - **Floating** = live floating P&L (price P&L + swap) of the client's open positions, from the engine.
//! - **Return %** = realised net ÷ (equity at the start of the period + money moved into the accounts during it).
//! - **Flags**: consistently profitable (profitable in at least ⅔ of the last M ≤ 6 periods, M ≥ 3), scalping
//!   (median holding time < 2 minutes over ≥ 5 trades), very high win rate (≥ 80 % over ≥ 10 trades), large size
//!   vs equity (average trade notional ≥ 25 × equity). A profitable client with a persistent edge (consistent,
//!   scalping, or high win rate with profit factor ≥ 1.5) gets the A-book routing hint; a profitable client
//!   trading very large against equity gets "review"; everyone else "B".
//! - **Broker revenue** per client and per period = the Broker P&L report's revenue (B-book + swap + commission +
//!   A-book markup; IB cost is deducted in the totals and the time series).

use std::collections::{BTreeMap, BTreeSet, HashMap};

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use sqlx::Row;

use crate::broker::{self, Rev};
use crate::error::{ApiError, ApiResult};
use crate::export::{Cell, Table};
use crate::metrics::round2;
use crate::state::App;
use crate::time;

/// Realised net within ±this many USD is break-even.
pub const BREAK_EVEN_USD: f64 = 5.0;
/// Median holding time below this (seconds) flags scalping.
pub const SCALP_SECS: f64 = 120.0;
pub const SCALP_MIN_TRADES: usize = 5;
pub const HIGH_WIN_RATE: f64 = 80.0;
pub const HIGH_WIN_MIN_TRADES: usize = 10;
/// Average trade notional ÷ equity at or above this flags large size.
pub const LARGE_SIZE_X: f64 = 25.0;
/// Consistency looks at the last this many periods of the range.
pub const CONSISTENCY_WINDOW: usize = 6;

fn f(d: Decimal) -> f64 {
    d.to_f64().unwrap_or(0.0)
}

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

/// Granularity of the time series: server days, ISO weeks (Monday) or calendar months.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Gran {
    Day,
    Week,
    Month,
}

impl Gran {
    pub fn parse(s: Option<&str>) -> ApiResult<Option<Gran>> {
        match s.map(str::trim).filter(|s| !s.is_empty()) {
            None => Ok(None),
            Some("day" | "daily") => Ok(Some(Gran::Day)),
            Some("week" | "weekly") => Ok(Some(Gran::Week)),
            Some("month" | "monthly") => Ok(Some(Gran::Month)),
            Some(_) => Err(ApiError::Validation { field: "period", message: "Period must be day, week or month.".into() }),
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Gran::Day => "day",
            Gran::Week => "week",
            Gran::Month => "month",
        }
    }
    /// The bucket a server day belongs to (its first day).
    pub fn start(self, d: NaiveDate) -> NaiveDate {
        match self {
            Gran::Day => d,
            Gran::Week => d - Duration::days(d.weekday().num_days_from_monday() as i64),
            Gran::Month => time::month_start(d),
        }
    }
    pub fn next(self, start: NaiveDate) -> NaiveDate {
        match self {
            Gran::Day => start + Duration::days(1),
            Gran::Week => start + Duration::days(7),
            Gran::Month => time::add_months(start, 1),
        }
    }
    /// Granularity that suits a span (scheduled reports and exports without `period`).
    pub fn auto(from: DateTime<Utc>, to: DateTime<Utc>) -> Gran {
        let days = (to - from).num_days();
        if days <= 31 {
            Gran::Day
        } else if days <= 120 {
            Gran::Week
        } else {
            Gran::Month
        }
    }
    /// Default range ending at `now`: the last 30 days / 12 weeks / 12 months, aligned to the bucket starts.
    pub fn default_from(self, now: DateTime<Utc>) -> DateTime<Utc> {
        let today = time::server_day(now);
        let first = match self {
            Gran::Day => today - Duration::days(29),
            Gran::Week => self.start(today) - Duration::days(7 * 11),
            Gran::Month => time::add_months(time::month_start(today), -11),
        };
        time::day_start(first)
    }
}

/// Most buckets one report may have (≈ 13 months of days, 5 years of weeks).
pub const MAX_BUCKETS: usize = 400;

/// `[from, to)` and the granularity of a traders request: an explicit `from` wins; otherwise the default range of
/// the granularity (30 days / 12 weeks / 12 months up to `to` or now). Without `period` the span picks it.
pub fn range(from: Option<DateTime<Utc>>, to: Option<DateTime<Utc>>, g: Option<Gran>) -> ApiResult<(DateTime<Utc>, DateTime<Utc>, Gran)> {
    let to = to.unwrap_or_else(Utc::now);
    let from = from.unwrap_or_else(|| g.unwrap_or(Gran::Day).default_from(to - Duration::seconds(1)));
    if from >= to {
        return Err(ApiError::Validation { field: "from", message: "The start must be before the end.".into() });
    }
    let g = g.unwrap_or_else(|| Gran::auto(from, to));
    if buckets(g, from, to).len() > MAX_BUCKETS {
        return Err(ApiError::Validation { field: "period", message: format!("Too many {}s in this range: choose a shorter range or a longer period.", g.as_str()) });
    }
    Ok((from, to, g))
}

/// Bucket starts covering `[from, to)`.
pub fn buckets(g: Gran, from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<NaiveDate> {
    let last = time::server_day(to - Duration::seconds(1));
    let mut b = g.start(time::server_day(from));
    let mut v = vec![];
    while b <= last && v.len() < 4000 {
        v.push(b);
        b = g.next(b);
    }
    v
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/// One closed trade (exit deal), USD.
#[derive(Clone, Debug)]
pub struct TRow {
    pub login: i64,
    pub user_id: i64,
    pub group: String,
    pub book: String,
    pub symbol: String,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
    pub net: f64,
    /// Lots (cent accounts count 0.01 per lot; option contracts are not lots).
    pub lots: f64,
    /// USD notional of the trade at the close (0 when the symbol has no spec).
    pub notional: f64,
}

impl TRow {
    pub fn hold_secs(&self) -> f64 {
        (self.close_time - self.open_time).num_milliseconds().max(0) as f64 / 1000.0
    }
}

#[derive(Clone, Debug, Default)]
pub struct ClientInfo {
    pub name: String,
    pub email: String,
    pub country: String,
}

/// Live state of an account (USD).
#[derive(Clone, Debug, Default)]
pub struct LiveAcct {
    pub equity: f64,
    pub floating: f64,
}

#[derive(Clone, Debug, Default)]
pub struct Input {
    pub trades: Vec<TRow>,
    pub clients: HashMap<i64, ClientInfo>,
    /// login → live equity / floating
    pub live: HashMap<i64, LiveAcct>,
    pub floating_source: String,
    /// user → return base (equity at the start + money moved in)
    pub base: HashMap<i64, f64>,
    /// user → broker revenue in the range (before IB cost)
    pub revenue: HashMap<i64, f64>,
    /// bucket start → broker net revenue (after IB cost)
    pub revenue_by_bucket: HashMap<NaiveDate, f64>,
    /// totals of the Broker P&L revenue model for the range
    pub rev_total: Rev,
    pub groups: Vec<String>,
    pub countries: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct Filters {
    pub group: Option<String>,
    pub country: Option<String>,
    pub book: Option<String>,
}

impl Filters {
    pub fn validate(&mut self) -> ApiResult<()> {
        let clean = |v: &mut Option<String>| {
            *v = v.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty() && s != "all");
        };
        clean(&mut self.group);
        clean(&mut self.country);
        clean(&mut self.book);
        if self.group.as_ref().is_some_and(|g| g.len() > 64) {
            return Err(ApiError::Validation { field: "group", message: "Invalid group.".into() });
        }
        if let Some(c) = &mut self.country {
            if c.len() != 2 || !c.chars().all(|x| x.is_ascii_alphabetic()) {
                return Err(ApiError::Validation { field: "country", message: "Country must be a 2-letter code.".into() });
            }
            *c = c.to_uppercase();
        }
        if let Some(b) = &mut self.book {
            *b = b.to_uppercase();
            if b != "A" && b != "B" {
                return Err(ApiError::Validation { field: "book", message: "Book must be A or B.".into() });
            }
        }
        Ok(())
    }
    fn json(&self) -> Value {
        json!({"group": self.group, "country": self.country, "book": self.book})
    }
}

/// Live equity and floating P&L per live login, from the engine (the mirror when the engine does not answer).
pub async fn live_accounts(app: &App, tenant: &str) -> (HashMap<i64, LiveAcct>, &'static str) {
    if let Ok(items) = crate::risk::engine_accounts(app, tenant).await {
        let m = items
            .iter()
            .filter_map(|a| {
                let k = if a["cent"].as_bool().unwrap_or(false) || a["currency"].as_str() == Some("USC") { 0.01 } else { 1.0 };
                Some((a["login"].as_i64()?, LiveAcct { equity: crate::upstream::num(&a["equity"]) * k, floating: (crate::upstream::num(&a["profit"]) + crate::upstream::num(&a["swap"])) * k }))
            })
            .collect();
        return (m, "engine");
    }
    let rows = sqlx::query("SELECT login, cent, equity, profit FROM accounts WHERE tenant = $1 AND kind = 'live'").bind(tenant).fetch_all(&app.pool).await.unwrap_or_default();
    let m = rows
        .iter()
        .map(|r| {
            let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
            (r.get::<i64, _>("login"), LiveAcct { equity: f(r.get("equity")) * k, floating: f(r.get("profit")) * k })
        })
        .collect();
    (m, "mirror")
}

pub async fn load(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>, g: Gran, flt: &Filters) -> ApiResult<Input> {
    let nm = broker::names(app, tenant).await?;
    let clients: HashMap<i64, ClientInfo> = nm.into_iter().map(|(u, (n, e, c))| (u, ClientInfo { name: n, email: e, country: c.to_uppercase() })).collect();
    let country_ok = |u: i64| flt.country.as_ref().is_none_or(|c| clients.get(&u).is_some_and(|x| &x.country == c));

    let rows = sqlx::query(
        "SELECT d.login, a.user_id, a.group_code, a.cent, d.symbol, d.volume, d.price, d.profit, d.swap, d.commission, d.book, d.time, d.open_time, (d.option IS NOT NULL) AS is_option
         FROM deals d JOIN accounts a ON a.tenant = d.tenant AND a.login = d.login
         WHERE d.tenant = $1 AND a.kind = 'live' AND a.group_code NOT LIKE 'prop%' AND NOT d.reversed AND d.entry <> 'in'
           AND d.time >= $2 AND d.time < $3 AND ($4::text IS NULL OR a.group_code = $4) AND ($5::text IS NULL OR d.book = $5)
         ORDER BY d.time",
    )
    .bind(tenant)
    .bind(from)
    .bind(to)
    .bind(&flt.group)
    .bind(&flt.book)
    .fetch_all(&app.pool)
    .await?;
    let rates = app.specs.rates.read().unwrap().clone();
    let mut trades = Vec::with_capacity(rows.len());
    for r in &rows {
        let user_id: i64 = r.get("user_id");
        if !country_ok(user_id) {
            continue;
        }
        let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
        let symbol: String = r.get("symbol");
        let option = r.get::<bool, _>("is_option") || crate::statement::is_option_series(&symbol);
        let vol = f(r.get("volume"));
        let price = f(r.get("price"));
        let lots = if option { 0.0 } else { vol * k };
        let notional = if option { 0.0 } else { app.specs.get(&symbol).map(|s| lots * s.contract_size * price * s.quote_to_usd(price, &rates)).unwrap_or(0.0) };
        let close: DateTime<Utc> = r.get("time");
        trades.push(TRow {
            login: r.get("login"),
            user_id,
            group: r.get("group_code"),
            book: r.get("book"),
            symbol,
            open_time: r.get::<Option<DateTime<Utc>>, _>("open_time").unwrap_or(close),
            close_time: close,
            net: (f(r.get("profit")) + f(r.get("swap")) - f(r.get("commission"))) * k,
            lots,
            notional,
        });
    }
    let users: BTreeSet<i64> = trades.iter().map(|t| t.user_id).collect();
    let login_set: BTreeSet<i64> = trades.iter().map(|t| t.login).collect();
    let logins: Vec<i64> = login_set.iter().copied().collect();

    // return base: equity at the end of the day before the period + money moved into the accounts during it
    let mut base: HashMap<i64, f64> = HashMap::new();
    let start_day = time::server_day(from);
    for r in sqlx::query(
        "SELECT DISTINCT ON (s.login) s.login, a.user_id, a.cent, s.equity FROM snapshots s JOIN accounts a ON a.tenant = s.tenant AND a.login = s.login
         WHERE s.tenant = $1 AND s.login = ANY($2) AND s.day < $3 ORDER BY s.login, s.day DESC",
    )
    .bind(tenant)
    .bind(&logins)
    .bind(start_day)
    .fetch_all(&app.pool)
    .await?
    {
        let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
        *base.entry(r.get("user_id")).or_default() += f(r.get("equity")).max(0.0) * k;
    }
    for r in sqlx::query(
        "SELECT a.user_id, a.cent, sum(l.amount) AS amt FROM ledger l JOIN accounts a ON a.tenant = l.tenant AND a.login = l.login
         WHERE l.tenant = $1 AND l.login = ANY($2) AND l.sub_ledger = 'balance' AND l.kind IN ('transfer_in','deposit') AND l.at >= $3 AND l.at < $4 GROUP BY 1, 2",
    )
    .bind(tenant)
    .bind(&logins)
    .bind(from)
    .bind(to)
    .fetch_all(&app.pool)
    .await?
    {
        let k = if r.get::<bool, _>("cent") { 0.01 } else { 1.0 };
        *base.entry(r.get("user_id")).or_default() += r.get::<Option<Decimal>, _>("amt").map(f).unwrap_or(0.0).max(0.0) * k;
    }

    // broker revenue (Broker P&L model) per client and per bucket
    let mut revenue: HashMap<i64, f64> = HashMap::new();
    let mut revenue_by_bucket: HashMap<NaiveDate, f64> = HashMap::new();
    let mut rev_total = Rev::default();
    let mut login_user: HashMap<i64, i64> = HashMap::new();
    for d in broker::deals(app, tenant, from, to).await? {
        if flt.group.as_ref().is_some_and(|x| x != &d.group) || flt.book.as_ref().is_some_and(|x| x != &d.book) || !country_ok(d.user_id) {
            continue;
        }
        login_user.insert(d.login, d.user_id);
        let mut r = Rev::default();
        r.add(app, &d);
        rev_total.add(app, &d);
        let gross = r.bbook + r.swap + r.commission + r.spread_a;
        *revenue.entry(d.user_id).or_default() += gross;
        *revenue_by_bucket.entry(g.start(time::server_day(d.time))).or_default() += gross;
    }
    let filtered = flt.group.is_some() || flt.book.is_some() || flt.country.is_some();
    for (at, amt, login, _) in broker::ib_cost(app, tenant, from, to).await? {
        // with a filter, only lines of the filtered clients' accounts count
        if filtered && !login.is_some_and(|l| login_user.contains_key(&l)) {
            continue;
        }
        rev_total.ib_cost += amt;
        *revenue_by_bucket.entry(g.start(time::server_day(at))).or_default() -= amt;
    }

    let (mut live, source) = live_accounts(app, tenant).await;
    live.retain(|l, _| login_set.contains(l));
    let groups: Vec<String> = sqlx::query_scalar("SELECT DISTINCT group_code FROM accounts WHERE tenant = $1 AND kind = 'live' AND group_code NOT LIKE 'prop%' ORDER BY 1").bind(tenant).fetch_all(&app.pool).await?;
    let countries: Vec<String> = sqlx::query_scalar("SELECT DISTINCT upper(c.country) FROM clients c JOIN accounts a ON a.tenant = c.tenant AND a.user_id = c.user_id WHERE c.tenant = $1 AND a.kind = 'live' AND c.country <> '' ORDER BY 1")
        .bind(tenant)
        .fetch_all(&app.pool)
        .await?;
    let clients = clients.into_iter().filter(|(u, _)| users.contains(u)).collect();
    Ok(Input { trades, clients, live, floating_source: source.to_string(), base, revenue, revenue_by_bucket, rev_total, groups, countries })
}

/* ------------------------------------------------------------------ */
/* Maths                                                               */
/* ------------------------------------------------------------------ */

pub fn segment(net: f64) -> &'static str {
    if net > BREAK_EVEN_USD {
        "profitable"
    } else if net < -BREAK_EVEN_USD {
        "losing"
    } else {
        "breakEven"
    }
}

pub fn median(v: &mut [f64]) -> f64 {
    if v.is_empty() {
        return 0.0;
    }
    v.sort_by(|a, b| a.total_cmp(b));
    let n = v.len();
    if n % 2 == 1 { v[n / 2] } else { (v[n / 2 - 1] + v[n / 2]) / 2.0 }
}

/// Realised-net distribution buckets: (key, label, lower, upper); a bound belongs to the bucket nearer zero.
pub const DISTRIBUTION: &[(&str, &str, f64, f64)] = &[
    ("lt10k", "Below −$10K", f64::NEG_INFINITY, -10_000.0),
    ("10k1k", "−$10K to −$1K", -10_000.0, -1_000.0),
    ("1k100", "−$1K to −$100", -1_000.0, -100.0),
    ("100be", "−$100 to −$5", -100.0, -BREAK_EVEN_USD),
    ("be", "Break-even (±$5)", -BREAK_EVEN_USD, BREAK_EVEN_USD),
    ("be100", "$5 to $100", BREAK_EVEN_USD, 100.0),
    ("100_1k", "$100 to $1K", 100.0, 1_000.0),
    ("1k_10k", "$1K to $10K", 1_000.0, 10_000.0),
    ("gt10k", "Above $10K", 10_000.0, f64::INFINITY),
];

pub fn distribution_bucket(net: f64) -> usize {
    if net.abs() <= BREAK_EVEN_USD {
        return 4;
    }
    // symmetric around zero: gains (lo, hi], losses [lo, hi)
    DISTRIBUTION.iter().position(|(_, _, lo, hi)| if net > 0.0 { net > *lo && net <= *hi } else { net >= *lo && net < *hi }).unwrap_or(if net > 0.0 { DISTRIBUTION.len() - 1 } else { 0 })
}

#[derive(Clone, Debug, Default)]
pub struct Agg {
    pub trades: usize,
    pub wins: usize,
    pub losses: usize,
    pub gross_profit: f64,
    pub gross_loss: f64,
    pub net: f64,
    pub lots: f64,
    pub lots_a: f64,
    pub notional: f64,
    pub holds: Vec<f64>,
    pub logins: BTreeSet<i64>,
    pub groups: BTreeSet<String>,
    pub by_bucket: BTreeMap<NaiveDate, f64>,
}

impl Agg {
    pub fn add(&mut self, t: &TRow, bucket: NaiveDate) {
        self.trades += 1;
        if t.net > 0.0 {
            self.wins += 1;
            self.gross_profit += t.net;
        } else if t.net < 0.0 {
            self.losses += 1;
            self.gross_loss -= t.net;
        }
        self.net += t.net;
        self.lots += t.lots;
        if t.book == "A" {
            self.lots_a += t.lots;
        }
        self.notional += t.notional;
        self.holds.push(t.hold_secs());
        self.logins.insert(t.login);
        self.groups.insert(t.group.clone());
        *self.by_bucket.entry(bucket).or_default() += t.net;
    }
    pub fn win_rate(&self) -> f64 {
        if self.trades == 0 { 0.0 } else { self.wins as f64 / self.trades as f64 * 100.0 }
    }
    /// Gross profit ÷ gross loss; None = no losses.
    pub fn profit_factor(&self) -> Option<f64> {
        if self.gross_loss > 0.0 { Some(self.gross_profit / self.gross_loss) } else { None }
    }
    pub fn avg_hold(&self) -> f64 {
        if self.holds.is_empty() { 0.0 } else { self.holds.iter().sum::<f64>() / self.holds.len() as f64 }
    }
    pub fn median_hold(&self) -> f64 {
        median(&mut self.holds.clone())
    }
    pub fn book(&self) -> &'static str {
        if self.lots <= 0.0 || self.lots_a <= 0.0 {
            "B"
        } else if self.lots_a >= self.lots - 1e-9 {
            "A"
        } else {
            "mixed"
        }
    }
    pub fn book_a_pct(&self) -> f64 {
        if self.lots > 0.0 { round2(self.lots_a / self.lots * 100.0) } else { 0.0 }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Flags {
    pub consistent: bool,
    pub consistent_n: usize,
    pub consistent_m: usize,
    pub scalper: bool,
    pub high_win_rate: bool,
    pub large_size: bool,
    pub size_x: Option<f64>,
    pub hint: &'static str,
    pub reasons: Vec<String>,
}

/// Flags and the routing hint of one client. `window` = the last bucket starts of the range (oldest first).
pub fn flags(a: &Agg, window: &[NaiveDate], equity: f64) -> Flags {
    let m = window.len().min(CONSISTENCY_WINDOW);
    let last = &window[window.len() - m..];
    let n = last.iter().filter(|b| a.by_bucket.get(b).copied().unwrap_or(0.0) > BREAK_EVEN_USD).count();
    let consistent = m >= 3 && n * 3 >= m * 2 && n >= 3;
    let mh = a.median_hold();
    let scalper = a.trades >= SCALP_MIN_TRADES && mh < SCALP_SECS;
    let high_win_rate = a.trades >= HIGH_WIN_MIN_TRADES && a.win_rate() >= HIGH_WIN_RATE;
    let size_x = if equity > 0.0 && a.trades > 0 { Some(a.notional / a.trades as f64 / equity) } else { None };
    let large_size = size_x.is_some_and(|x| x >= LARGE_SIZE_X);
    let profitable = a.net > BREAK_EVEN_USD;
    let edge_pf = a.profit_factor().is_none_or(|p| p >= 1.5);
    let mut reasons = vec![];
    if consistent {
        reasons.push(format!("Profitable in {n} of the last {m} periods"));
    }
    if scalper {
        reasons.push(format!("Median holding time {}", hold_label(mh)));
    }
    if high_win_rate {
        reasons.push(format!("Win rate {:.0}% over {} trades", a.win_rate(), a.trades));
    }
    if large_size && let Some(x) = size_x {
        reasons.push(format!("Average trade {x:.0}× equity"));
    }
    let hint = if profitable && (consistent || scalper || (high_win_rate && edge_pf)) {
        "A"
    } else if profitable && large_size {
        "review"
    } else {
        "B"
    };
    Flags { consistent, consistent_n: n, consistent_m: m, scalper, high_win_rate, large_size, size_x, hint, reasons }
}

pub fn hold_label(secs: f64) -> String {
    if secs < 60.0 {
        format!("{secs:.0} s")
    } else if secs < 3600.0 {
        format!("{:.1} min", secs / 60.0)
    } else if secs < 86_400.0 {
        format!("{:.1} h", secs / 3600.0)
    } else {
        format!("{:.1} d", secs / 86_400.0)
    }
}

fn opt2(v: Option<f64>) -> Value {
    v.filter(|x| x.is_finite()).map(|x| json!(round2(x))).unwrap_or(Value::Null)
}

/// The report from loaded inputs (pure).
pub fn analyse(inp: &Input, g: Gran, from: DateTime<Utc>, to: DateTime<Utc>, flt: &Filters) -> Value {
    let bks = buckets(g, from, to);
    let mut by_user: HashMap<i64, Agg> = HashMap::new();
    let mut by_login: HashMap<i64, Agg> = HashMap::new();
    let mut all = Agg::default();
    for t in &inp.trades {
        let b = g.start(time::server_day(t.close_time));
        by_user.entry(t.user_id).or_default().add(t, b);
        by_login.entry(t.login).or_default().add(t, b);
        all.add(t, b);
    }
    let live = |l: i64| inp.live.get(&l).cloned().unwrap_or_default();

    // per client
    let mut clients: Vec<Value> = Vec::with_capacity(by_user.len());
    let mut seg: BTreeMap<&str, (usize, f64, f64, usize, f64, f64)> = BTreeMap::new(); // clients, net, lots, trades, revenue, floating
    let mut dist = vec![(0usize, 0.0f64); DISTRIBUTION.len()];
    let mut floating_total = 0.0;
    for (u, a) in &by_user {
        let info = inp.clients.get(u).cloned().unwrap_or_default();
        let floating: f64 = a.logins.iter().map(|l| live(*l).floating).sum();
        let equity: f64 = a.logins.iter().map(|l| live(*l).equity).sum();
        floating_total += floating;
        let base = inp.base.get(u).copied().unwrap_or(0.0);
        let fl = flags(a, &bks, if equity > 0.0 { equity } else { base });
        let s = segment(a.net);
        let revenue = inp.revenue.get(u).copied().unwrap_or(0.0);
        let e = seg.entry(s).or_default();
        e.0 += 1;
        e.1 += a.net;
        e.2 += a.lots;
        e.3 += a.trades;
        e.4 += revenue;
        e.5 += floating;
        let di = distribution_bucket(a.net);
        dist[di].0 += 1;
        dist[di].1 += a.net;
        let accounts: Vec<Value> = a
            .logins
            .iter()
            .map(|l| {
                let x = by_login.get(l).cloned().unwrap_or_default();
                let lv = live(*l);
                json!({"login": l, "group": x.groups.iter().next(), "net": round2(x.net), "trades": x.trades, "winRate": round2(x.win_rate()), "lots": round2(x.lots),
                       "floating": round2(lv.floating), "equity": round2(lv.equity), "book": x.book(), "bookAPct": x.book_a_pct()})
            })
            .collect();
        clients.push(json!({
            "userId": u, "name": info.name, "email": info.email, "country": info.country,
            "logins": a.logins.iter().collect::<Vec<_>>(), "groups": a.groups.iter().collect::<Vec<_>>(), "accounts": accounts,
            "net": round2(a.net), "floating": round2(floating), "total": round2(a.net + floating), "equity": round2(equity),
            "trades": a.trades, "wins": a.wins, "losses": a.losses, "winRate": round2(a.win_rate()), "profitFactor": opt2(a.profit_factor()),
            "grossProfit": round2(a.gross_profit), "grossLoss": round2(a.gross_loss),
            "avgHoldSecs": round2(a.avg_hold()), "medianHoldSecs": round2(a.median_hold()),
            "lots": round2(a.lots), "notional": round2(a.notional),
            "returnPct": if base > 0.0 { json!(round2(a.net / base * 100.0)) } else { Value::Null },
            "book": a.book(), "bookAPct": a.book_a_pct(), "brokerRevenue": round2(revenue),
            "segment": s,
            "consistency": {"profitable": fl.consistent_n, "of": fl.consistent_m},
            "flags": {"consistent": fl.consistent, "scalper": fl.scalper, "highWinRate": fl.high_win_rate, "largeSize": fl.large_size},
            "sizeToEquity": opt2(fl.size_x),
            "routeHint": fl.hint, "reasons": fl.reasons,
        }));
    }
    clients.sort_by(|a, b| b["net"].as_f64().unwrap_or(0.0).total_cmp(&a["net"].as_f64().unwrap_or(0.0)).then(a["userId"].as_i64().cmp(&b["userId"].as_i64())));
    let n = clients.len();
    let pct = |x: usize| if n > 0 { round2(x as f64 / n as f64 * 100.0) } else { 0.0 };
    let segments: Vec<Value> = ["profitable", "breakEven", "losing"]
        .iter()
        .map(|k| {
            let e = seg.get(k).cloned().unwrap_or_default();
            json!({"key": k, "clients": e.0, "pctClients": pct(e.0), "net": round2(e.1), "lots": round2(e.2),
                   "pctVolume": if all.lots > 0.0 { round2(e.2 / all.lots * 100.0) } else { 0.0 }, "trades": e.3,
                   "brokerRevenue": round2(e.4), "floating": round2(e.5)})
        })
        .collect();
    let seg_count = |k: &str| seg.get(k).map(|e| e.0).unwrap_or(0);

    // time series: (profitable, losing, break-even, client net, trades, lots) per bucket
    let mut per_bucket: HashMap<NaiveDate, (usize, usize, usize, f64, usize, f64)> = HashMap::new();
    for a in by_user.values() {
        for (b, x) in &a.by_bucket {
            let e = per_bucket.entry(*b).or_default();
            e.3 += x;
            match segment(*x) {
                "profitable" => e.0 += 1,
                "losing" => e.1 += 1,
                _ => e.2 += 1,
            }
        }
    }
    for t in &inp.trades {
        let e = per_bucket.entry(g.start(time::server_day(t.close_time))).or_default();
        e.4 += 1;
        e.5 += t.lots;
    }
    let series: Vec<Value> = bks
        .iter()
        .map(|b| {
            let (p, l, be, net, trades, lots) = per_bucket.get(b).cloned().unwrap_or_default();
            json!({"start": b, "end": g.next(*b), "traders": p + l + be, "profitable": p, "losing": l, "breakEven": be,
                   "clientNet": round2(net), "brokerRevenue": round2(inp.revenue_by_bucket.get(b).copied().unwrap_or(0.0)), "trades": trades, "lots": round2(lots)})
        })
        .collect();

    let distribution: Vec<Value> = DISTRIBUTION
        .iter()
        .enumerate()
        .map(|(i, (k, label, lo, hi))| json!({"key": k, "label": label, "min": if lo.is_finite() { json!(lo) } else { Value::Null }, "max": if hi.is_finite() { json!(hi) } else { Value::Null }, "clients": dist[i].0, "net": round2(dist[i].1)}))
        .collect();
    let top_winners: Vec<Value> = clients.iter().filter(|c| c["net"].as_f64().unwrap_or(0.0) > BREAK_EVEN_USD).take(10).cloned().collect();
    let mut top_losers: Vec<Value> = clients.iter().rev().filter(|c| c["net"].as_f64().unwrap_or(0.0) < -BREAK_EVEN_USD).take(10).cloned().collect();
    top_losers.sort_by(|a, b| a["net"].as_f64().unwrap_or(0.0).total_cmp(&b["net"].as_f64().unwrap_or(0.0)));
    let flagged = |k: &str| clients.iter().filter(|c| c["flags"][k].as_bool().unwrap_or(false)).count();
    let hints = |k: &str| clients.iter().filter(|c| c["routeHint"] == k).count();
    let mut holds = all.holds.clone();
    json!({
        "from": from, "to": to, "period": g.as_str(), "currency": "USD", "filters": flt.json(),
        "options": {"groups": inp.groups, "countries": inp.countries},
        "floatingSource": inp.floating_source,
        "definitions": {"breakEvenUsd": BREAK_EVEN_USD, "scalpSecs": SCALP_SECS, "highWinRate": HIGH_WIN_RATE, "largeSizeX": LARGE_SIZE_X, "consistencyWindow": CONSISTENCY_WINDOW},
        "totals": {
            "traders": n, "profitable": seg_count("profitable"), "losing": seg_count("losing"), "breakEven": seg_count("breakEven"),
            "profitablePct": pct(seg_count("profitable")), "losingPct": pct(seg_count("losing")), "breakEvenPct": pct(seg_count("breakEven")),
            "clientNet": round2(all.net), "clientFloating": round2(floating_total),
            "brokerRevenue": round2(inp.rev_total.net()), "bbook": round2(inp.rev_total.bbook), "ibCost": round2(inp.rev_total.ib_cost),
            "trades": all.trades, "lots": round2(all.lots), "notional": round2(all.notional),
            "winRate": round2(all.win_rate()), "profitFactor": opt2(all.profit_factor()),
            "avgHoldSecs": round2(all.avg_hold()), "medianHoldSecs": round2(median(&mut holds)),
            "flagged": {"consistent": flagged("consistent"), "scalper": flagged("scalper"), "highWinRate": flagged("highWinRate"), "largeSize": flagged("largeSize")},
            "hints": {"A": hints("A"), "review": hints("review"), "B": hints("B")},
        },
        "segments": segments,
        "series": series,
        "distribution": distribution,
        "topWinners": top_winners,
        "topLosers": top_losers,
        "clients": clients,
    })
}

pub async fn report(app: &App, tenant: &str, from: DateTime<Utc>, to: DateTime<Utc>, g: Gran, flt: &Filters) -> ApiResult<(Value, Vec<Table>)> {
    let inp = load(app, tenant, from, to, g, flt).await?;
    let v = analyse(&inp, g, from, to, flt);
    let t = tables(&v);
    Ok((v, t))
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

fn n2(v: &Value) -> Cell {
    v.as_f64().map(|x| Cell::Num(x, 2)).unwrap_or(Cell::Empty)
}

fn seg_label(k: &str) -> &'static str {
    match k {
        "profitable" => "Profitable",
        "losing" => "Losing",
        _ => "Break-even",
    }
}

pub fn tables(v: &Value) -> Vec<Table> {
    let mut t1 = Table::new("Segments", &["Segment", "Clients", "% of clients", "Realised net", "Floating", "Lots", "% of volume", "Trades", "Broker revenue"]);
    for s in v["segments"].as_array().into_iter().flatten() {
        t1.rows.push(vec![
            Cell::text(seg_label(s["key"].as_str().unwrap_or(""))),
            Cell::Int(s["clients"].as_i64().unwrap_or(0)),
            n2(&s["pctClients"]),
            n2(&s["net"]),
            n2(&s["floating"]),
            n2(&s["lots"]),
            n2(&s["pctVolume"]),
            Cell::Int(s["trades"].as_i64().unwrap_or(0)),
            n2(&s["brokerRevenue"]),
        ]);
    }
    let mut t2 = Table::new("Periods", &["Period start", "Traders", "Profitable", "Losing", "Break-even", "Client net", "Broker revenue", "Trades", "Lots"]);
    for s in v["series"].as_array().into_iter().flatten() {
        t2.rows.push(vec![
            Cell::text(s["start"].as_str().unwrap_or("")),
            Cell::Int(s["traders"].as_i64().unwrap_or(0)),
            Cell::Int(s["profitable"].as_i64().unwrap_or(0)),
            Cell::Int(s["losing"].as_i64().unwrap_or(0)),
            Cell::Int(s["breakEven"].as_i64().unwrap_or(0)),
            n2(&s["clientNet"]),
            n2(&s["brokerRevenue"]),
            Cell::Int(s["trades"].as_i64().unwrap_or(0)),
            n2(&s["lots"]),
        ]);
    }
    let mut t3 = Table::new(
        "Clients",
        &["User", "Name", "Country", "Accounts", "Segment", "Realised net", "Floating", "Return %", "Trades", "Win rate %", "Profit factor", "Avg hold (s)", "Median hold (s)", "Lots", "Notional", "Book", "A-book %", "Broker revenue", "Consistent", "Scalping", "High win rate", "Large size", "Routing hint", "Why"],
    );
    let yes = |b: &Value| Cell::text(if b.as_bool().unwrap_or(false) { "yes" } else { "" });
    for c in v["clients"].as_array().into_iter().flatten() {
        t3.rows.push(vec![
            Cell::Int(c["userId"].as_i64().unwrap_or(0)),
            Cell::text(c["name"].as_str().unwrap_or("")),
            Cell::text(c["country"].as_str().unwrap_or("")),
            Cell::text(c["logins"].as_array().map(|l| l.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" ")).unwrap_or_default()),
            Cell::text(seg_label(c["segment"].as_str().unwrap_or(""))),
            n2(&c["net"]),
            n2(&c["floating"]),
            n2(&c["returnPct"]),
            Cell::Int(c["trades"].as_i64().unwrap_or(0)),
            n2(&c["winRate"]),
            n2(&c["profitFactor"]),
            n2(&c["avgHoldSecs"]),
            n2(&c["medianHoldSecs"]),
            n2(&c["lots"]),
            n2(&c["notional"]),
            Cell::text(c["book"].as_str().unwrap_or("")),
            n2(&c["bookAPct"]),
            n2(&c["brokerRevenue"]),
            yes(&c["flags"]["consistent"]),
            yes(&c["flags"]["scalper"]),
            yes(&c["flags"]["highWinRate"]),
            yes(&c["flags"]["largeSize"]),
            Cell::text(match c["routeHint"].as_str() {
                Some("A") => "A-book",
                Some("review") => "Review",
                _ => "B-book",
            }),
            Cell::text(c["reasons"].as_array().map(|r| r.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("; ")).unwrap_or_default()),
        ]);
    }
    let mut t4 = Table::new("Distribution", &["Realised net", "Clients", "Net"]);
    for d in v["distribution"].as_array().into_iter().flatten() {
        t4.rows.push(vec![Cell::text(d["label"].as_str().unwrap_or("")), Cell::Int(d["clients"].as_i64().unwrap_or(0)), n2(&d["net"])]);
    }
    vec![t1, t2, t3, t4]
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    fn trade(user: i64, login: i64, close: DateTime<Utc>, hold_secs: i64, net: f64, lots: f64, book: &str) -> TRow {
        TRow { login, user_id: user, group: "standard".into(), book: book.into(), symbol: "EURUSD".into(), open_time: close - Duration::seconds(hold_secs), close_time: close, net, lots, notional: lots * 116_000.0 }
    }

    #[test]
    fn buckets_follow_server_days_weeks_and_months() {
        // 2026-10-08 is a Thursday; server time GMT+3
        let d = day(2026, 10, 8);
        assert_eq!(Gran::Week.start(d), day(2026, 10, 5));
        assert_eq!(Gran::Month.start(d), day(2026, 10, 1));
        assert_eq!(Gran::Month.next(day(2026, 12, 1)), day(2027, 1, 1));
        let from = time::day_start(day(2026, 9, 28));
        let to = time::day_start(day(2026, 10, 12));
        assert_eq!(buckets(Gran::Week, from, to), vec![day(2026, 9, 28), day(2026, 10, 5)]);
        assert_eq!(buckets(Gran::Day, from, to).len(), 14);
        assert_eq!(buckets(Gran::Month, from, to), vec![day(2026, 9, 1), day(2026, 10, 1)]);
        // 22:30 UTC on 30 Sep is already 1 Oct server time
        assert_eq!(Gran::Month.start(time::server_day(Utc.with_ymd_and_hms(2026, 9, 30, 22, 30, 0).unwrap())), day(2026, 10, 1));
        let now = Utc.with_ymd_and_hms(2026, 10, 9, 12, 0, 0).unwrap();
        assert_eq!(Gran::Day.default_from(now), time::day_start(day(2026, 9, 10)));
        assert_eq!(Gran::Week.default_from(now), time::day_start(day(2026, 7, 20)));
        assert_eq!(Gran::Month.default_from(now), time::day_start(day(2025, 11, 1)));
        assert_eq!(Gran::auto(from, to), Gran::Day);
        assert_eq!(Gran::auto(from - Duration::days(60), to), Gran::Week);
        assert_eq!(Gran::auto(from - Duration::days(300), to), Gran::Month);
        assert!(Gran::parse(Some("quarter")).is_err());
        assert_eq!(Gran::parse(Some("weekly")).unwrap(), Some(Gran::Week));
    }

    #[test]
    fn segments_and_distribution_use_the_break_even_band() {
        assert_eq!(segment(5.0), "breakEven");
        assert_eq!(segment(-5.0), "breakEven");
        assert_eq!(segment(5.01), "profitable");
        assert_eq!(segment(-5.01), "losing");
        assert_eq!(DISTRIBUTION[distribution_bucket(0.0)].0, "be");
        assert_eq!(DISTRIBUTION[distribution_bucket(-5.0)].0, "be");
        assert_eq!(DISTRIBUTION[distribution_bucket(-5.5)].0, "100be");
        assert_eq!(DISTRIBUTION[distribution_bucket(-100.0)].0, "100be");
        assert_eq!(DISTRIBUTION[distribution_bucket(-100.5)].0, "1k100");
        assert_eq!(DISTRIBUTION[distribution_bucket(-25_000.0)].0, "lt10k");
        assert_eq!(DISTRIBUTION[distribution_bucket(100.0)].0, "be100");
        assert_eq!(DISTRIBUTION[distribution_bucket(10_000.01)].0, "gt10k");
        assert_eq!(median(&mut [5.0, 1.0, 3.0]), 3.0);
        assert_eq!(median(&mut [4.0, 1.0, 3.0, 2.0]), 2.5);
        assert_eq!(median(&mut []), 0.0);
    }

    #[test]
    fn flags_and_routing_hints() {
        let weeks: Vec<NaiveDate> = (0..6).map(|i| day(2026, 8, 31) + Duration::days(7 * i)).collect();
        let at = |w: usize| time::day_start(weeks[w]) + Duration::hours(12);
        // consistent: profitable in 4 of the last 6 weeks, slow trades, modest size
        let mut a = Agg::default();
        for (w, net) in [(0, 50.0), (1, 40.0), (2, -20.0), (3, 30.0), (4, -10.0), (5, 25.0)] {
            let t = trade(1, 11, at(w), 3 * 3600, net, 0.1, "B");
            a.add(&t, Gran::Week.start(time::server_day(t.close_time)));
        }
        let fl = flags(&a, &weeks, 10_000.0);
        assert!(fl.consistent && !fl.scalper && !fl.high_win_rate && !fl.large_size, "{fl:?}");
        assert_eq!((fl.consistent_n, fl.consistent_m, fl.hint), (4, 6, "A"));
        // 3 of 6 is not consistent; profitable but no edge → B
        let mut b = Agg::default();
        for (w, net) in [(0, 50.0), (1, -40.0), (2, 20.0), (3, -1.0), (4, -10.0), (5, 25.0)] {
            let t = trade(2, 12, at(w), 3 * 3600, net, 0.1, "B");
            b.add(&t, Gran::Week.start(time::server_day(t.close_time)));
        }
        let fl = flags(&b, &weeks, 10_000.0);
        assert!(!fl.consistent);
        assert_eq!(fl.hint, "B");
        // too few periods in the range: never consistent
        assert!(!flags(&a, &weeks[..2], 10_000.0).consistent);
        // scalper: median hold < 2 min over ≥ 5 trades, profitable → A
        let mut s = Agg::default();
        for i in 0..6 {
            let t = trade(3, 13, at(5) + Duration::minutes(i), if i == 5 { 3600 } else { 45 }, 8.0, 1.0, "B");
            s.add(&t, weeks[5]);
        }
        let fl = flags(&s, &weeks, 50_000.0);
        assert!(fl.scalper && fl.median_hold_ok(), "{fl:?}");
        assert_eq!(fl.hint, "A");
        // high win rate with profit factor ≥ 1.5 → A; with a poor profit factor it is not an edge
        let mut h = Agg::default();
        for i in 0..10 {
            let t = trade(4, 14, at(5) + Duration::minutes(i * 10), 1800, if i < 9 { 10.0 } else { -20.0 }, 0.1, "B");
            h.add(&t, weeks[5]);
        }
        let fl = flags(&h, &weeks, 10_000.0);
        assert!(fl.high_win_rate && (h.profit_factor().unwrap() - 4.5).abs() < 1e-9);
        assert_eq!(fl.hint, "A");
        let mut h2 = Agg::default();
        for i in 0..10 {
            let t = trade(5, 15, at(5) + Duration::minutes(i * 10), 1800, if i < 9 { 10.0 } else { -80.0 }, 0.1, "B");
            h2.add(&t, weeks[5]);
        }
        assert_eq!(flags(&h2, &weeks, 10_000.0).hint, "B");
        // large size vs equity (1 lot ≈ $116K on a $2K account = 58×), profitable without an edge → review
        let mut l = Agg::default();
        for i in 0..2 {
            let t = trade(6, 16, at(5) + Duration::hours(i), 7200, 60.0, 1.0, "A");
            l.add(&t, weeks[5]);
        }
        let fl = flags(&l, &weeks, 2_000.0);
        assert!(fl.large_size && (fl.size_x.unwrap() - 58.0).abs() < 1e-9);
        assert_eq!(fl.hint, "review");
        assert_eq!((l.book(), l.book_a_pct()), ("A", 100.0));
        // losing clients always stay B
        let mut x = Agg::default();
        for i in 0..6 {
            let t = trade(7, 17, at(5) + Duration::minutes(i), 30, -8.0, 1.0, "B");
            x.add(&t, weeks[5]);
        }
        assert_eq!(flags(&x, &weeks, 1_000.0).hint, "B");
    }

    impl Flags {
        fn median_hold_ok(&self) -> bool {
            self.reasons.iter().any(|r| r.starts_with("Median holding time"))
        }
    }

    #[test]
    fn analyse_segments_series_and_top_lists() {
        let from = time::day_start(day(2026, 10, 5));
        let to = time::day_start(day(2026, 10, 8));
        let d0 = from + Duration::hours(10);
        let d1 = d0 + Duration::days(1);
        let mut inp = Input::default();
        inp.trades = vec![
            trade(1, 101, d0, 600, 120.0, 1.0, "B"),
            trade(1, 101, d1, 600, 30.0, 1.0, "B"),
            trade(2, 102, d0, 600, -300.0, 2.0, "B"),
            trade(2, 103, d1, 60, 100.0, 1.0, "A"),
            trade(3, 104, d1, 600, 2.0, 1.0, "B"),
        ];
        inp.clients.insert(1, ClientInfo { name: "Ana".into(), email: "a@x.io".into(), country: "AE".into() });
        inp.live.insert(101, LiveAcct { equity: 5_000.0, floating: -40.0 });
        inp.live.insert(102, LiveAcct { equity: 1_000.0, floating: 15.0 });
        inp.base.insert(1, 3_000.0);
        inp.revenue.insert(2, 250.0);
        inp.revenue_by_bucket.insert(day(2026, 10, 5), 180.0);
        let v = analyse(&inp, Gran::Day, from, to, &Filters::default());
        let t = &v["totals"];
        assert_eq!((t["traders"].as_u64(), t["profitable"].as_u64(), t["losing"].as_u64(), t["breakEven"].as_u64()), (Some(3), Some(1), Some(1), Some(1)));
        assert_eq!(t["clientNet"].as_f64(), Some(-48.0));
        assert_eq!(t["clientFloating"].as_f64(), Some(-25.0));
        assert_eq!(t["profitablePct"].as_f64(), Some(33.33));
        let seg: Vec<&Value> = v["segments"].as_array().unwrap().iter().collect();
        assert_eq!((seg[0]["key"].as_str(), seg[0]["net"].as_f64(), seg[0]["pctVolume"].as_f64()), (Some("profitable"), Some(150.0), Some(33.33)));
        assert_eq!(seg[2]["brokerRevenue"].as_f64(), Some(250.0));
        // per client: realised, floating, return on the base, book mix
        let c1 = v["clients"].as_array().unwrap().iter().find(|c| c["userId"] == 1).unwrap();
        assert_eq!((c1["net"].as_f64(), c1["floating"].as_f64(), c1["total"].as_f64(), c1["returnPct"].as_f64()), (Some(150.0), Some(-40.0), Some(110.0), Some(5.0)));
        assert_eq!(c1["name"], "Ana");
        let c2 = v["clients"].as_array().unwrap().iter().find(|c| c["userId"] == 2).unwrap();
        assert_eq!((c2["book"].as_str(), c2["bookAPct"].as_f64(), c2["accounts"].as_array().unwrap().len()), (Some("mixed"), Some(33.33), 2));
        assert!(c2["returnPct"].is_null());
        // daily series: day 1 one winner, one loser; day 2 two winners and one break-even
        let s = v["series"].as_array().unwrap();
        assert_eq!(s.len(), 3);
        assert_eq!((s[0]["profitable"].as_u64(), s[0]["losing"].as_u64(), s[0]["clientNet"].as_f64(), s[0]["brokerRevenue"].as_f64()), (Some(1), Some(1), Some(-180.0), Some(180.0)));
        assert_eq!((s[1]["profitable"].as_u64(), s[1]["breakEven"].as_u64(), s[1]["trades"].as_u64()), (Some(2), Some(1), Some(3)));
        assert_eq!(s[2]["traders"].as_u64(), Some(0));
        assert_eq!(v["topWinners"].as_array().unwrap().len(), 1);
        assert_eq!(v["topLosers"][0]["userId"], 2);
        let dist: u64 = v["distribution"].as_array().unwrap().iter().map(|d| d["clients"].as_u64().unwrap()).sum();
        assert_eq!(dist, 3);
        let files = tables(&v);
        assert_eq!(files.len(), 4);
        assert_eq!(files[2].rows.len(), 3);
    }

    #[test]
    fn filters_are_validated() {
        let mut f = Filters { group: Some(" all ".into()), country: Some("ae".into()), book: Some("b".into()) };
        f.validate().unwrap();
        assert_eq!((f.group, f.country.as_deref(), f.book.as_deref()), (None, Some("AE"), Some("B")));
        assert!(Filters { book: Some("C".into()), ..Default::default() }.validate().is_err());
        assert!(Filters { country: Some("UAE".into()), ..Default::default() }.validate().is_err());
    }
}

//! Broker risk (Analytics → Broker risk): a live snapshot of client exposure from the trading engine, the broker's
//! B-book floating P&L, concentration, margin levels, credit and negative balances, capital strength, and what-if
//! price scenarios on every open position. Live accounts only (prop groups excluded), USD (USC ÷ 100).
//!
//! Sources: engine `GET /v1/admin/accounts?type=live` (balance, credit, bonus, equity, margin, margin level, margin
//! call / stop-out levels per group) and `GET /v1/dealing/positions` (side, volume, open / current price, floating
//! profit, swap, route A/B, option terms and Greeks). Contract sizes, asset classes and quote currencies come from
//! the instrument specs; the USD value of a quote unit is taken from the engine's own floating profit of the
//! position (exact, the engine's conversion) and falls back to the specs / market-data rates.
//!
//! Scenarios are instantaneous gaps: every position is revalued at the shocked price (CFDs exactly; options with
//! the delta-gamma approximation around the underlying), margins scale with the positions' notional, and an
//! account is stopped out at the shocked price when its margin level falls to the group's stop-out level or below.
//! Per account: `uncollectible` = client losses beyond the client's own money (credit and bonus consumed, then
//! negative equity, which negative balance protection writes off). Broker impact = B-book P&L (−client P&L on
//! B-book positions) − the change in uncollectible losses (on every book: an A-book loss the client cannot pay is
//! still owed to the liquidity provider).

use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use crate::broker;
use crate::db::{self, Actor};
use crate::error::{ApiError, ApiResult};
use crate::export::{Cell, Table};
use crate::metrics::round2;
use crate::specs::Specs;
use crate::state::App;
use crate::upstream::{As, Target, UpErr, num};

/// Margin level (%) at or below which an account is listed as at risk (or its group's margin call level if higher).
pub const AT_RISK_LEVEL: f64 = 150.0;
/// Asset classes a shock may target.
pub const CLASSES: &[&str] = &["forex", "indices", "stocks", "crypto", "metals", "energies"];

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

/// A live account (USD).
#[derive(Clone, Debug, Default)]
pub struct Acct {
    pub login: i64,
    pub user_id: i64,
    pub group: String,
    pub balance: f64,
    /// credit + bonus (the broker's money in the account)
    pub credit: f64,
    pub equity: f64,
    pub margin: f64,
    /// floating P&L of the open positions (price P&L + swap; options mark vs premium)
    pub floating: f64,
    pub margin_level: Option<f64>,
    pub margin_call: f64,
    pub stop_out: f64,
    pub positions: i64,
}

#[derive(Clone, Debug, Default)]
pub struct Opt {
    /// position delta / gamma in units of the underlying per unit of premium (× contracts × side)
    pub delta: f64,
    pub gamma: f64,
    pub contract_size: f64,
    pub spot: f64,
}

/// An open position (USD).
#[derive(Clone, Debug, Default)]
pub struct Pos {
    pub ticket: i64,
    pub login: i64,
    pub symbol: String,
    /// the symbol a shock applies to (the underlying for options)
    pub underlying: String,
    pub class: String,
    /// +1 buy, −1 sell
    pub sign: f64,
    pub volume: f64,
    pub contract: f64,
    pub price: f64,
    /// USD per unit of the quote currency at `price`
    pub conv: f64,
    /// USD-based pair quoted in another currency (USDJPY…): the conversion is 1 ÷ price
    pub usd_base: bool,
    pub book: String,
    /// client floating P&L incl. swap
    pub floating: f64,
    pub option: Option<Opt>,
}

impl Pos {
    /// USD notional (CFDs; options: delta-equivalent).
    pub fn notional(&self) -> f64 {
        match &self.option {
            Some(o) => (o.delta * o.contract_size * o.spot * self.conv).abs(),
            None => self.volume * self.contract * self.price * self.conv,
        }
    }
    /// Signed USD notional (long +, short −).
    pub fn signed(&self) -> f64 {
        match &self.option {
            Some(o) => o.delta * o.contract_size * o.spot * self.conv,
            None => self.sign * self.notional(),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct Snapshot {
    pub as_of: DateTime<Utc>,
    pub accounts: Vec<Acct>,
    pub positions: Vec<Pos>,
    /// user → (name, country)
    pub names: HashMap<i64, (String, String)>,
}

fn usd_k(v: &Value) -> f64 {
    if v["cent"].as_bool().unwrap_or(false) || v["currency"].as_str() == Some("USC") { 0.01 } else { 1.0 }
}

fn id(v: &Value) -> Option<i64> {
    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
}

/// An engine account view (`/v1/admin/accounts` item).
pub fn acct_from(v: &Value) -> Option<Acct> {
    let k = usd_k(v);
    Some(Acct {
        login: id(&v["login"])?,
        user_id: id(&v["userId"]).unwrap_or(0),
        group: v["group"].as_str().unwrap_or("").to_string(),
        balance: num(&v["balance"]) * k,
        credit: (num(&v["credit"]) + num(&v["bonus"])) * k,
        equity: num(&v["equity"]) * k,
        margin: num(&v["margin"]) * k,
        floating: (num(&v["profit"]) + num(&v["swap"])) * k,
        margin_level: if v["marginLevel"].is_null() { None } else { Some(num(&v["marginLevel"])) },
        margin_call: num(&v["marginCallLevel"]),
        stop_out: num(&v["stopOutLevel"]),
        positions: v["positions"].as_i64().unwrap_or(0),
    })
}

/// An engine desk position (`/v1/dealing/positions` item).
pub fn pos_from(v: &Value, specs: &Specs, rates: &HashMap<String, f64>) -> Option<Pos> {
    let k = usd_k(v);
    let symbol = v["symbol"].as_str()?.to_string();
    let sign = if v["side"].as_str() == Some("sell") { -1.0 } else { 1.0 };
    let volume = num(&v["volume"]);
    let open = num(&v["openPrice"]);
    let price = Some(num(&v["currentPrice"])).filter(|p| *p > 0.0 && !v["currentPrice"].is_null()).unwrap_or(open);
    let profit = num(&v["profit"]) * k;
    let mut p = Pos {
        ticket: id(&v["ticket"]).unwrap_or(0),
        login: id(&v["login"])?,
        symbol: symbol.clone(),
        underlying: symbol.clone(),
        sign,
        volume,
        price,
        book: v["route"].as_str().unwrap_or("B").to_uppercase(),
        floating: profit + num(&v["swap"]) * k,
        ..Default::default()
    };
    if v["option"].is_object() {
        let o = &v["option"];
        let und = o["underlying"].as_str().unwrap_or("").to_string();
        let spec = specs.get(&und);
        let spot = Some(num(&v["underlyingPrice"])).filter(|s| *s > 0.0).unwrap_or(0.0);
        let quote = o["quoteCurrency"].as_str().unwrap_or("");
        p.conv = if quote == "USD" || quote.is_empty() && und.ends_with("USD") { 1.0 } else { spec.map(|s| s.quote_to_usd(spot, rates)).unwrap_or(0.0) };
        p.class = spec.map(|s| s.asset_class.clone()).unwrap_or_else(|| "forex".into());
        p.contract = Some(num(&o["contractSize"])).filter(|c| *c > 0.0).unwrap_or(1.0);
        p.option = Some(Opt { delta: num(&v["greeks"]["delta"]), gamma: num(&v["greeks"]["gamma"]), contract_size: p.contract, spot });
        p.underlying = und;
        return Some(p);
    }
    let spec = specs.get(&symbol);
    p.contract = spec.map(|s| s.contract_size).unwrap_or(1.0);
    p.class = spec.map(|s| s.asset_class.clone()).unwrap_or_else(|| "other".into());
    p.usd_base = spec.is_some_and(|s| s.base_ccy == "USD" && s.quote_ccy != "USD");
    let table = spec.map(|s| s.quote_to_usd(price, rates)).unwrap_or(if symbol.ends_with("USD") { 1.0 } else { 0.0 });
    // the engine's own conversion, implied by its floating profit (price P&L only, account currency → USD)
    let move_q = sign * volume * p.contract * (price - open);
    let implied = if profit.abs() >= 0.01 && move_q.abs() > 0.0 { profit / move_q } else { 0.0 };
    let plausible = implied.is_finite() && implied > 0.0 && (table <= 0.0 || (implied / table > 0.5 && implied / table < 2.0)) && profit.abs() >= 1.0;
    p.conv = if p.usd_base && price > 0.0 { 1.0 / price } else if plausible { implied } else { table };
    Some(p)
}

/// Every live account of the tenant from the engine (all pages).
pub async fn engine_accounts(app: &App, tenant: &str) -> Result<Vec<Value>, UpErr> {
    let mut out = vec![];
    for page in 1..=200 {
        let v = app.up.get(Target::Engine, tenant, As::Staff, &format!("/v1/admin/accounts?type=live&limit=500&page={page}")).await?;
        let items = v["items"].as_array().cloned().unwrap_or_default();
        let n = items.len();
        out.extend(items);
        let total = v["total"].as_i64().unwrap_or(0);
        if n < 500 || (page * 500) as i64 >= total {
            break;
        }
    }
    Ok(out)
}

pub async fn snapshot(app: &App, tenant: &str) -> ApiResult<Snapshot> {
    let up = |e: UpErr| ApiError::Upstream { code: "engine_unavailable".into(), message: format!("The trading engine did not answer ({e}). Try again shortly.") };
    let accounts: Vec<Acct> = engine_accounts(app, tenant).await.map_err(up)?.iter().filter_map(acct_from).filter(|a| !a.group.starts_with("prop")).collect();
    let live: HashSet<i64> = accounts.iter().map(|a| a.login).collect();
    let raw = app.up.get(Target::Engine, tenant, As::Staff, "/v1/dealing/positions").await.map_err(up)?;
    let rates = app.specs.rates.read().unwrap().clone();
    let positions = raw.as_array().map(Vec::as_slice).unwrap_or(&[]).iter().filter_map(|p| pos_from(p, &app.specs, &rates)).filter(|p| live.contains(&p.login)).collect();
    let names = broker::names(app, tenant).await?.into_iter().map(|(u, (n, _, c))| (u, (n, c.to_uppercase()))).collect();
    Ok(Snapshot { as_of: Utc::now(), accounts, positions, names })
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Shock {
    /// symbol | assetClass | all
    pub scope: String,
    #[serde(default)]
    pub target: String,
    /// price change, % (−90 … +200)
    pub pct: f64,
}

impl Shock {
    pub fn all(pct: f64) -> Self {
        Shock { scope: "all".into(), target: String::new(), pct }
    }
    pub fn class(c: &str, pct: f64) -> Self {
        Shock { scope: "assetClass".into(), target: c.into(), pct }
    }
    pub fn json(&self) -> Value {
        json!({"scope": self.scope, "target": if self.scope == "all" { Value::Null } else { json!(self.target) }, "pct": self.pct})
    }
}

pub fn validate_shocks(shocks: &mut [Shock]) -> ApiResult<()> {
    if shocks.is_empty() || shocks.len() > 50 {
        return Err(ApiError::Validation { field: "shocks", message: "Add 1 to 50 price shocks.".into() });
    }
    for s in shocks.iter_mut() {
        s.target = s.target.trim().to_string();
        if !s.pct.is_finite() || !(-90.0..=200.0).contains(&s.pct) {
            return Err(ApiError::Validation { field: "pct", message: "A shock must be between −90 % and +200 %.".into() });
        }
        match s.scope.as_str() {
            "all" => s.target.clear(),
            "assetClass" | "class" => {
                s.scope = "assetClass".into();
                s.target = s.target.to_lowercase();
                if !CLASSES.contains(&s.target.as_str()) {
                    return Err(ApiError::Validation { field: "target", message: format!("Asset class must be one of {}.", CLASSES.join(", ")) });
                }
            }
            "symbol" => {
                s.target = s.target.to_uppercase();
                if s.target.is_empty() || s.target.len() > 32 || !s.target.chars().all(|c| c.is_ascii_alphanumeric() || ".-_#".contains(c)) {
                    return Err(ApiError::Validation { field: "target", message: "Invalid symbol.".into() });
                }
            }
            _ => return Err(ApiError::Validation { field: "scope", message: "Scope must be symbol, assetClass or all.".into() }),
        }
    }
    Ok(())
}

/// Shock for a symbol: a symbol shock wins over its asset class, which wins over "all".
pub fn pct_for(shocks: &[Shock], symbol: &str, class: &str) -> f64 {
    let find = |scope: &str, t: &str| shocks.iter().rev().find(|s| s.scope == scope && (scope == "all" || s.target.eq_ignore_ascii_case(t))).map(|s| s.pct);
    find("symbol", symbol).or_else(|| find("assetClass", class)).or_else(|| find("all", "")).unwrap_or(0.0)
}

/// Client P&L change (USD) of a position when its (underlying) price moves by `pct` %.
pub fn position_delta(p: &Pos, pct: f64) -> f64 {
    if pct == 0.0 {
        return 0.0;
    }
    match &p.option {
        Some(o) => {
            let ds = o.spot * pct / 100.0;
            (o.delta * ds + 0.5 * o.gamma * ds * ds) * o.contract_size * p.conv
        }
        None => {
            let p1 = p.price * (1.0 + pct / 100.0);
            let dq = p.sign * p.volume * p.contract * (p1 - p.price);
            if p.usd_base && p1 > 0.0 { dq / p1 } else { dq * p.conv }
        }
    }
}

/// CFD notional after the move (USD-based pairs keep their USD notional).
fn notional_after(p: &Pos, pct: f64) -> f64 {
    if p.usd_base { p.notional() } else { p.notional() * (1.0 + pct / 100.0) }
}

#[derive(Clone, Debug, Default)]
pub struct AcctOut {
    pub login: i64,
    pub user_id: i64,
    pub group: String,
    pub positions: usize,
    pub d_client: f64,
    pub d_a: f64,
    pub d_b: f64,
    pub equity_before: f64,
    pub equity_after: f64,
    pub margin_before: f64,
    pub margin_after: f64,
    pub level_before: Option<f64>,
    pub level_after: Option<f64>,
    pub stop_out_level: f64,
    pub stop_out: bool,
    pub margin_call: bool,
    pub negative_after: f64,
    pub negative_new: f64,
    pub credit_used: f64,
    pub uncollectible: f64,
    pub broker_impact: f64,
}

#[derive(Clone, Debug, Default)]
pub struct SymOut {
    pub class: String,
    pub pct: f64,
    pub positions: usize,
    pub client: f64,
    pub bbook: f64,
}

#[derive(Clone, Debug, Default)]
pub struct Outcome {
    pub accounts: Vec<AcctOut>,
    pub by_symbol: BTreeMap<String, SymOut>,
}

impl Outcome {
    pub fn sum(&self, f: impl Fn(&AcctOut) -> f64) -> f64 {
        self.accounts.iter().map(f).sum()
    }
    pub fn broker_impact(&self) -> f64 {
        self.sum(|a| a.broker_impact)
    }
    pub fn stop_outs(&self) -> usize {
        self.accounts.iter().filter(|a| a.stop_out).count()
    }
    pub fn margin_calls(&self) -> usize {
        self.accounts.iter().filter(|a| a.margin_call).count()
    }
    pub fn totals(&self) -> Value {
        json!({
            "accounts": self.accounts.len(),
            "affected": self.accounts.iter().filter(|a| a.d_client.abs() >= 0.01).count(),
            "positions": self.accounts.iter().map(|a| a.positions).sum::<usize>(),
            "clientPnl": round2(self.sum(|a| a.d_client)), "clientPnlA": round2(self.sum(|a| a.d_a)), "clientPnlB": round2(self.sum(|a| a.d_b)),
            "bbookPnl": round2(-self.sum(|a| a.d_b)), "uncollectible": round2(self.sum(|a| a.uncollectible)),
            "brokerImpact": round2(self.broker_impact()),
            "stopOuts": self.stop_outs(), "marginCalls": self.margin_calls(),
            "negativeAccounts": self.accounts.iter().filter(|a| a.equity_after < 0.0).count(),
            "negativeBalance": round2(self.sum(|a| a.negative_after)), "negativeBalanceNew": round2(self.sum(|a| a.negative_new)),
            "creditUsed": round2(self.sum(|a| a.credit_used)),
            "equityBefore": round2(self.sum(|a| a.equity_before)), "equityAfter": round2(self.sum(|a| a.equity_after)),
        })
    }
}

/// Revalues every open position at the shocked prices (pure).
pub fn run(snap: &Snapshot, shocks: &[Shock]) -> Outcome {
    let mut per: HashMap<i64, Vec<&Pos>> = HashMap::new();
    for p in &snap.positions {
        per.entry(p.login).or_default().push(p);
    }
    let mut out = Outcome::default();
    for a in &snap.accounts {
        let Some(ps) = per.get(&a.login) else { continue };
        let mut o = AcctOut { login: a.login, user_id: a.user_id, group: a.group.clone(), positions: ps.len(), equity_before: a.equity, margin_before: a.margin, level_before: a.margin_level, stop_out_level: a.stop_out, ..Default::default() };
        let (mut n0, mut n1) = (0.0, 0.0);
        for p in ps {
            let pct = pct_for(shocks, &p.underlying, &p.class);
            let d = position_delta(p, pct);
            o.d_client += d;
            if p.book == "A" {
                o.d_a += d;
            } else {
                o.d_b += d;
            }
            if p.option.is_none() {
                n0 += p.notional();
                n1 += notional_after(p, pct);
            }
            let s = out.by_symbol.entry(p.underlying.clone()).or_insert_with(|| SymOut { class: p.class.clone(), pct, ..Default::default() });
            s.positions += 1;
            s.client += d;
            if p.book != "A" {
                s.bbook -= d;
            }
        }
        o.equity_after = a.equity + o.d_client;
        o.margin_after = if n0 > 0.0 { a.margin * n1 / n0 } else { a.margin };
        o.level_after = if o.margin_after > 0.0 { Some(o.equity_after / o.margin_after * 100.0) } else { None };
        o.stop_out = o.level_after.is_some_and(|l| l <= a.stop_out) || (o.equity_after <= 0.0 && o.margin_after > 0.0);
        o.margin_call = !o.stop_out && o.level_after.is_some_and(|l| l <= a.margin_call);
        let own0 = a.equity - a.credit;
        let own1 = own0 + o.d_client;
        let unc = |own: f64| (-own).max(0.0);
        let credit_used = |own: f64| a.credit.max(0.0).min((-own).max(0.0));
        o.uncollectible = unc(own1) - unc(own0);
        o.credit_used = credit_used(own1) - credit_used(own0);
        o.negative_after = (-o.equity_after).max(0.0);
        o.negative_new = o.negative_after - (-a.equity).max(0.0);
        o.broker_impact = -o.d_b - o.uncollectible;
        out.accounts.push(o);
    }
    out
}

pub const PRESETS: &[(&str, &str)] = &[("pm1", "±1 % on every symbol"), ("pm3", "±3 % on every symbol"), ("pm5", "±5 % on every symbol"), ("flash", "Flash crash")];

/// The legs of a preset: ±N % runs both directions (the worse one counts); the flash crash is one leg
/// (crypto −20 %, stocks −10 %, indices −7 %, energies −8 %, metals −4 %, forex −2 % base vs quote).
pub fn preset_legs(name: &str) -> Option<Vec<(&'static str, Vec<Shock>)>> {
    let pm = |x: f64| vec![("up", vec![Shock::all(x)]), ("down", vec![Shock::all(-x)])];
    Some(match name {
        "pm1" => pm(1.0),
        "pm3" => pm(3.0),
        "pm5" => pm(5.0),
        "flash" => vec![("down", vec![Shock::class("crypto", -20.0), Shock::class("stocks", -10.0), Shock::class("indices", -7.0), Shock::class("energies", -8.0), Shock::class("metals", -4.0), Shock::class("forex", -2.0)])],
        _ => return None,
    })
}

pub fn preset_label(name: &str) -> &'static str {
    PRESETS.iter().find(|(k, _)| *k == name).map(|(_, l)| *l).unwrap_or("Custom")
}

/// Runs every leg and keeps the worst for the broker: (direction, shocks, outcome, all legs).
pub fn worst_leg(snap: &Snapshot, legs: Vec<(&'static str, Vec<Shock>)>) -> (&'static str, Vec<Shock>, Outcome, Vec<Value>) {
    let mut best: Option<(&'static str, Vec<Shock>, Outcome)> = None;
    let mut summary = vec![];
    for (dir, shocks) in legs {
        let o = run(snap, &shocks);
        summary.push(json!({"direction": dir, "shocks": shocks.iter().map(Shock::json).collect::<Vec<_>>(), "brokerImpact": round2(o.broker_impact()), "clientPnl": round2(o.sum(|a| a.d_client)), "stopOuts": o.stop_outs()}));
        if best.as_ref().is_none_or(|b| o.broker_impact() < b.2.broker_impact()) {
            best = Some((dir, shocks, o));
        }
    }
    let (d, s, o) = best.unwrap_or(("down", vec![], Outcome::default()));
    (d, s, o, summary)
}

/// Capital strength: coverage = capital ÷ worst preset loss. strong ≥ 2×, adequate ≥ 1×, weak < 1×; "unset"
/// without a capital figure; strong (no coverage ratio) when no preset loses money.
pub fn strength(capital: Option<f64>, worst_impact: f64) -> (&'static str, Option<f64>) {
    let Some(c) = capital.filter(|c| *c > 0.0) else { return ("unset", None) };
    let loss = (-worst_impact).max(0.0);
    if loss < 0.01 {
        return ("strong", None);
    }
    let cov = c / loss;
    (if cov >= 2.0 { "strong" } else if cov >= 1.0 { "adequate" } else { "weak" }, Some(cov))
}

/* ------------------------------------------------------------------ */
/* Broker capital setting                                              */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapitalIn {
    pub amount: f64,
    #[serde(default)]
    pub reason: String,
}

pub async fn capital(app: &App, tenant: &str) -> ApiResult<Value> {
    let r = sqlx::query("SELECT value, updated_by, updated_at FROM settings WHERE tenant = $1 AND key = 'broker_capital'").bind(tenant).fetch_optional(&app.pool).await?;
    Ok(match r {
        Some(r) => {
            let v: sqlx::types::Json<Value> = r.get("value");
            json!({"amount": v.0["amount"], "currency": "USD", "reason": v.0["reason"], "updatedBy": r.get::<String, _>("updated_by"), "updatedAt": r.get::<DateTime<Utc>, _>("updated_at")})
        }
        None => json!({"amount": null, "currency": "USD", "reason": null, "updatedBy": null, "updatedAt": null}),
    })
}

pub async fn set_capital(app: &App, tenant: &str, actor: &Actor, mut body: CapitalIn) -> ApiResult<Value> {
    body.reason = body.reason.trim().chars().take(500).collect();
    if !body.amount.is_finite() || body.amount < 0.0 || body.amount > 1e12 {
        return Err(ApiError::Validation { field: "amount", message: "Broker capital must be between 0 and 1 000 000 000 000 USD.".into() });
    }
    if body.reason.chars().count() < 3 {
        return Err(ApiError::Validation { field: "reason", message: "Give a reason for the change.".into() });
    }
    let before = capital(app, tenant).await?;
    let value = json!({"amount": round2(body.amount), "reason": body.reason});
    sqlx::query(
        "INSERT INTO settings (tenant, key, value, updated_by, updated_at) VALUES ($1, 'broker_capital', $2, $3, now())
         ON CONFLICT (tenant, key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()",
    )
    .bind(tenant)
    .bind(sqlx::types::Json(&value))
    .bind(&actor.name)
    .execute(&app.pool)
    .await?;
    db::audit(&app.pool, tenant, actor, "settings.capital", Some("broker_capital"), Some(json!({"before": before["amount"], "after": round2(body.amount), "reason": body.reason}))).await;
    capital(app, tenant).await
}

/* ------------------------------------------------------------------ */
/* Live risk report                                                    */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug, Default)]
struct Expo {
    class: String,
    long_lots: f64,
    short_lots: f64,
    long_usd: f64,
    short_usd: f64,
    b_gross: f64,
    b_net: f64,
    client: f64,
    bbook: f64,
    positions: usize,
    logins: HashSet<i64>,
}

impl Expo {
    fn add(&mut self, p: &Pos) {
        let n = p.notional();
        if p.sign > 0.0 {
            self.long_lots += p.volume;
            self.long_usd += n;
        } else {
            self.short_lots += p.volume;
            self.short_usd += n;
        }
        if p.book != "A" {
            self.b_gross += n;
            self.b_net += p.signed();
            self.bbook -= p.floating;
        }
        self.client += p.floating;
        self.positions += 1;
        self.logins.insert(p.login);
    }
    fn json(&self, key: &str, name: &str) -> Value {
        let gross = self.long_usd + self.short_usd;
        json!({key: name, "class": self.class, "longLots": round2(self.long_lots), "shortLots": round2(self.short_lots), "netLots": round2(self.long_lots - self.short_lots),
               "longUsd": round2(self.long_usd), "shortUsd": round2(self.short_usd), "netUsd": round2(self.long_usd - self.short_usd), "grossUsd": round2(gross),
               "bbookNetUsd": round2(self.b_net), "bbookSharePct": if gross > 0.0 { round2(self.b_gross / gross * 100.0) } else { 0.0 },
               "clientFloating": round2(self.client), "bbookFloating": round2(self.bbook), "positions": self.positions, "accounts": self.logins.len()})
    }
}

pub const LEVEL_BUCKETS: &[(&str, &str, f64, f64)] = &[
    ("healthy", "200 % and above", 200.0, f64::INFINITY),
    ("watch", "100–200 %", 100.0, 200.0),
    ("nearStopOut", "50–100 % (near stop-out)", 50.0, 100.0),
    ("critical", "Below 50 %", f64::NEG_INFINITY, 50.0),
];

pub fn level_bucket(level: f64) -> usize {
    LEVEL_BUCKETS.iter().position(|(_, _, lo, hi)| level >= *lo && level < *hi).unwrap_or(3)
}

fn name_of(snap: &Snapshot, user: i64) -> (String, String) {
    snap.names.get(&user).cloned().unwrap_or_default()
}

fn acct_row(snap: &Snapshot, a: &Acct) -> Value {
    let (n, c) = name_of(snap, a.user_id);
    json!({"login": a.login, "userId": a.user_id, "name": n, "country": c, "group": a.group, "balance": round2(a.balance), "credit": round2(a.credit),
           "equity": round2(a.equity), "margin": round2(a.margin), "marginLevel": a.margin_level.map(round2), "marginCallLevel": a.margin_call,
           "stopOutLevel": a.stop_out, "floating": round2(a.floating), "positions": a.positions,
           // further client loss (USD) that triggers the stop-out
           "lossToStopOut": if a.margin > 0.0 { json!(round2((a.equity - a.stop_out / 100.0 * a.margin).max(0.0))) } else { Value::Null }})
}

/// The live risk report (pure, given the snapshot and the capital setting).
pub fn report_json(snap: &Snapshot, capital: &Value) -> Value {
    // exposure
    let (mut by_sym, mut by_class) = (BTreeMap::<String, Expo>::new(), BTreeMap::<String, Expo>::new());
    let mut options = Expo { class: "options".into(), ..Default::default() };
    let mut per_login: HashMap<i64, (f64, f64, f64)> = HashMap::new(); // gross, net, B floating (broker)
    for p in &snap.positions {
        if p.option.is_some() {
            options.add(p);
        } else {
            by_sym.entry(p.symbol.clone()).or_insert_with(|| Expo { class: p.class.clone(), ..Default::default() }).add(p);
            by_class.entry(p.class.clone()).or_insert_with(|| Expo { class: p.class.clone(), ..Default::default() }).add(p);
        }
        let e = per_login.entry(p.login).or_default();
        e.0 += p.notional();
        e.1 += p.signed();
        if p.book != "A" {
            e.2 -= p.floating;
        }
    }
    let mut symbols: Vec<Value> = by_sym.iter().map(|(s, e)| e.json("symbol", s)).collect();
    symbols.sort_by(|a, b| b["grossUsd"].as_f64().unwrap_or(0.0).total_cmp(&a["grossUsd"].as_f64().unwrap_or(0.0)));
    let mut classes: Vec<Value> = by_class.iter().map(|(c, e)| e.json("class", c)).collect();
    classes.sort_by(|a, b| b["grossUsd"].as_f64().unwrap_or(0.0).total_cmp(&a["grossUsd"].as_f64().unwrap_or(0.0)));
    let gross: f64 = by_sym.values().map(|e| e.long_usd + e.short_usd).sum();
    let long: f64 = by_sym.values().map(|e| e.long_usd).sum();
    let short: f64 = by_sym.values().map(|e| e.short_usd).sum();
    let b_gross: f64 = by_sym.values().map(|e| e.b_gross).sum();
    let bbook_floating: f64 = snap.positions.iter().filter(|p| p.book != "A").map(|p| -p.floating).sum();
    let abook_floating: f64 = snap.positions.iter().filter(|p| p.book == "A").map(|p| p.floating).sum();

    // concentration
    let accts: HashMap<i64, &Acct> = snap.accounts.iter().map(|a| (a.login, a)).collect();
    let mut by_gross: Vec<(i64, (f64, f64, f64))> = per_login.iter().map(|(l, v)| (*l, *v)).collect();
    by_gross.sort_by(|a, b| b.1.0.total_cmp(&a.1.0).then(a.0.cmp(&b.0)));
    let acct_gross: f64 = by_gross.iter().map(|x| x.1.0).sum();
    let top_gross: f64 = by_gross.iter().take(10).map(|x| x.1.0).sum();
    let mut by_float: Vec<f64> = per_login.values().map(|v| v.2.abs()).collect();
    by_float.sort_by(|a, b| b.total_cmp(a));
    let float_abs: f64 = by_float.iter().sum();
    let top_float: f64 = by_float.iter().take(10).sum();
    let top_accounts: Vec<Value> = by_gross
        .iter()
        .take(10)
        .map(|(l, (g, n, bf))| {
            let a = accts.get(l).copied().cloned().unwrap_or_default();
            let mut v = acct_row(snap, &a);
            v["grossUsd"] = json!(round2(*g));
            v["netUsd"] = json!(round2(*n));
            v["sharePct"] = json!(if acct_gross > 0.0 { round2(g / acct_gross * 100.0) } else { 0.0 });
            v["bbookFloating"] = json!(round2(*bf));
            v
        })
        .collect();

    // margin levels, accounts at risk
    let mut levels = vec![(0usize, 0.0f64, 0.0f64); LEVEL_BUCKETS.len()];
    let mut at_risk: Vec<&Acct> = vec![];
    for a in &snap.accounts {
        if a.margin <= 0.0 {
            continue;
        }
        let l = a.margin_level.unwrap_or(a.equity / a.margin * 100.0);
        let i = level_bucket(l);
        levels[i].0 += 1;
        levels[i].1 += a.equity;
        levels[i].2 += a.floating;
        if l <= AT_RISK_LEVEL.max(a.margin_call) {
            at_risk.push(a);
        }
    }
    at_risk.sort_by(|a, b| a.margin_level.unwrap_or(0.0).total_cmp(&b.margin_level.unwrap_or(0.0)).then(a.login.cmp(&b.login)));
    let with_margin = snap.accounts.iter().filter(|a| a.margin > 0.0).count();

    // credit and negative balances
    let credit: f64 = snap.accounts.iter().map(|a| a.credit).sum();
    let in_use = |a: &Acct| a.credit.max(0.0).min((a.credit - a.equity).max(0.0));
    let credit_in_use: f64 = snap.accounts.iter().map(in_use).sum();

    // totals
    let sum = |f: fn(&Acct) -> f64| snap.accounts.iter().map(f).sum::<f64>();
    let (eq, mg) = (sum(|a| a.equity), sum(|a| a.margin));

    // capital strength over the presets
    let cap = capital["amount"].as_f64();
    let mut presets = vec![];
    let mut worst: Option<Value> = None;
    for (k, label) in PRESETS {
        let (dir, _, o, _) = worst_leg(snap, preset_legs(k).unwrap());
        let impact = o.broker_impact();
        let row = json!({"preset": k, "label": label, "direction": dir, "brokerImpact": round2(impact), "clientPnl": round2(o.sum(|a| a.d_client)),
                         "stopOuts": o.stop_outs(), "marginCalls": o.margin_calls(), "negativeBalance": round2(o.sum(|a| a.negative_after)),
                         "capitalAfter": cap.map(|c| round2(c + impact))});
        if worst.as_ref().is_none_or(|w| impact < w["brokerImpact"].as_f64().unwrap_or(0.0)) {
            worst = Some(row.clone());
        }
        presets.push(row);
    }
    let worst_impact = worst.as_ref().and_then(|w| w["brokerImpact"].as_f64()).unwrap_or(0.0);
    let (status, coverage) = strength(cap, worst_impact);
    let mut capital_out = capital.clone();
    capital_out["status"] = json!(status);
    capital_out["coverage"] = json!(coverage.map(round2));
    capital_out["worst"] = worst.unwrap_or(Value::Null);
    capital_out["capitalAfterWorst"] = json!(cap.map(|c| round2(c + worst_impact)));
    capital_out["bbookFloatingPct"] = json!(cap.filter(|c| *c > 0.0).map(|c| round2(bbook_floating / c * 100.0)));
    capital_out["presets"] = json!(presets);

    json!({
        "asOf": snap.as_of, "currency": "USD", "source": "engine",
        "totals": {
            "accounts": snap.accounts.len(), "withPositions": snap.accounts.iter().filter(|a| a.positions > 0).count(), "positions": snap.positions.len(),
            "balance": round2(sum(|a| a.balance)), "credit": round2(credit), "equity": round2(eq), "margin": round2(mg), "freeMargin": round2(eq - mg),
            "marginLevel": if mg > 0.0 { json!(round2(eq / mg * 100.0)) } else { Value::Null },
            "clientFloating": round2(sum(|a| a.floating)), "bbookFloating": round2(bbook_floating), "abookClientFloating": round2(abook_floating),
            "grossUsd": round2(gross), "longUsd": round2(long), "shortUsd": round2(short), "netUsd": round2(long - short),
            "bbookGrossUsd": round2(b_gross), "bbookSharePct": if gross > 0.0 { round2(b_gross / gross * 100.0) } else { 0.0 },
            "atRisk": at_risk.len(),
        },
        "bySymbol": symbols,
        "byClass": classes,
        "options": options.json("class", "options"),
        "concentration": {
            "grossUsd": round2(acct_gross), "accounts": per_login.len(),
            "top10GrossPct": if acct_gross > 0.0 { round2(top_gross / acct_gross * 100.0) } else { 0.0 },
            "top10FloatingPct": if float_abs > 0.0 { round2(top_float / float_abs * 100.0) } else { 0.0 },
            "topSymbolPct": symbols.first().and_then(|s| s["grossUsd"].as_f64()).filter(|_| gross > 0.0).map(|g| round2(g / gross * 100.0)).unwrap_or(0.0),
            "topAccounts": top_accounts,
        },
        "marginLevels": {
            "accounts": with_margin,
            "buckets": LEVEL_BUCKETS.iter().enumerate().map(|(i, (k, label, _, _))| json!({"key": k, "label": label, "accounts": levels[i].0, "equity": round2(levels[i].1), "floating": round2(levels[i].2)})).collect::<Vec<_>>(),
        },
        "atRisk": at_risk.iter().take(200).map(|a| acct_row(snap, a)).collect::<Vec<_>>(),
        "credit": {
            "credit": round2(credit), "accounts": snap.accounts.iter().filter(|a| a.credit > 0.0).count(),
            "inUse": round2(credit_in_use), "inUseAccounts": snap.accounts.iter().filter(|a| in_use(a) > 0.0).count(),
            "negativeBalance": round2(snap.accounts.iter().map(|a| (-a.balance).max(0.0)).sum::<f64>()), "negativeBalanceAccounts": snap.accounts.iter().filter(|a| a.balance < 0.0).count(),
            "negativeEquity": round2(snap.accounts.iter().map(|a| (-a.equity).max(0.0)).sum::<f64>()), "negativeEquityAccounts": snap.accounts.iter().filter(|a| a.equity < 0.0).count(),
        },
        "capital": capital_out,
    })
}

pub async fn report(app: &App, tenant: &str) -> ApiResult<(Value, Vec<Table>)> {
    let snap = snapshot(app, tenant).await?;
    let cap = capital(app, tenant).await?;
    let v = report_json(&snap, &cap);
    let t = tables(&v);
    Ok((v, t))
}

/// `POST /v1/admin/scenarios` body.
#[derive(Clone, Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioIn {
    pub preset: Option<String>,
    pub shocks: Option<Vec<Shock>>,
    /// accounts listed (default 50, max 500)
    pub top: Option<usize>,
}

/// The scenario result (pure, given the snapshot and capital).
pub fn scenario_json(snap: &Snapshot, body: ScenarioIn, capital: Option<f64>) -> ApiResult<Value> {
    let (preset, legs) = match (body.preset.as_deref().map(str::trim).filter(|s| !s.is_empty()), body.shocks) {
        (Some(_), Some(_)) => return Err(ApiError::Validation { field: "preset", message: "Send a preset or custom shocks, not both.".into() }),
        (Some(p), None) => (Some(p.to_string()), preset_legs(p).ok_or_else(|| ApiError::Validation { field: "preset", message: "Preset must be pm1, pm3, pm5 or flash.".into() })?),
        (None, Some(mut s)) => {
            validate_shocks(&mut s)?;
            (None, vec![("custom", s)])
        }
        (None, None) => return Err(ApiError::Validation { field: "shocks", message: "Choose a preset or add price shocks.".into() }),
    };
    let (dir, shocks, o, legs) = worst_leg(snap, legs);
    let impact = o.broker_impact();
    let mut totals = o.totals();
    totals["capital"] = json!(capital);
    totals["capitalAfter"] = json!(capital.map(|c| round2(c + impact)));
    totals["capitalAfterPct"] = json!(capital.filter(|c| *c > 0.0).map(|c| round2((c + impact) / c * 100.0)));
    totals["coverage"] = json!(strength(capital, impact).1.map(round2));
    let mut by_symbol: Vec<Value> = o
        .by_symbol
        .iter()
        .filter(|(_, s)| s.pct != 0.0)
        .map(|(sym, s)| json!({"symbol": sym, "class": s.class, "pct": s.pct, "positions": s.positions, "clientPnl": round2(s.client), "bbookPnl": round2(s.bbook)}))
        .collect();
    by_symbol.sort_by(|a, b| a["bbookPnl"].as_f64().unwrap_or(0.0).total_cmp(&b["bbookPnl"].as_f64().unwrap_or(0.0)));
    let mut accts: Vec<&AcctOut> = o.accounts.iter().filter(|a| a.d_client.abs() >= 0.01).collect();
    accts.sort_by(|a, b| b.stop_out.cmp(&a.stop_out).then(a.d_client.total_cmp(&b.d_client).then(a.login.cmp(&b.login))));
    let top = body.top.unwrap_or(50).clamp(1, 500);
    let rows: Vec<Value> = accts
        .iter()
        .take(top)
        .map(|a| {
            let (n, c) = name_of(snap, a.user_id);
            json!({"login": a.login, "userId": a.user_id, "name": n, "country": c, "group": a.group, "positions": a.positions,
                   "clientPnl": round2(a.d_client), "brokerImpact": round2(a.broker_impact), "equityBefore": round2(a.equity_before), "equityAfter": round2(a.equity_after),
                   "marginLevelBefore": a.level_before.map(round2), "marginLevelAfter": a.level_after.map(round2), "stopOutLevel": a.stop_out_level,
                   "stopOut": a.stop_out, "marginCall": a.margin_call, "negativeBalance": round2(a.negative_after), "creditUsed": round2(a.credit_used)})
        })
        .collect();
    Ok(json!({
        "asOf": snap.as_of, "currency": "USD",
        "preset": preset, "label": preset.as_deref().map(preset_label).unwrap_or("Custom"),
        "direction": dir, "shocks": shocks.iter().map(Shock::json).collect::<Vec<_>>(), "legs": legs,
        "totals": totals, "bySymbol": by_symbol, "accounts": rows,
    }))
}

pub async fn scenario(app: &App, tenant: &str, body: ScenarioIn) -> ApiResult<Value> {
    let snap = snapshot(app, tenant).await?;
    let cap = capital(app, tenant).await?["amount"].as_f64();
    scenario_json(&snap, body, cap)
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

fn n2(v: &Value) -> Cell {
    v.as_f64().map(|x| Cell::Num(x, 2)).unwrap_or(Cell::Empty)
}

pub fn tables(v: &Value) -> Vec<Table> {
    let t = &v["totals"];
    let c = &v["capital"];
    let mut s = Table::new("Summary", &["Item", "Value"]);
    let rows: Vec<(&str, Cell)> = vec![
        ("As of", Cell::text(v["asOf"].as_str().unwrap_or(""))),
        ("Live accounts", Cell::Int(t["accounts"].as_i64().unwrap_or(0))),
        ("Accounts with positions", Cell::Int(t["withPositions"].as_i64().unwrap_or(0))),
        ("Open positions", Cell::Int(t["positions"].as_i64().unwrap_or(0))),
        ("Client balance (USD)", n2(&t["balance"])),
        ("Client credit and bonus (USD)", n2(&t["credit"])),
        ("Client equity (USD)", n2(&t["equity"])),
        ("Margin in use (USD)", n2(&t["margin"])),
        ("Client floating P&L (USD)", n2(&t["clientFloating"])),
        ("Broker B-book floating P&L (USD)", n2(&t["bbookFloating"])),
        ("Gross exposure (USD)", n2(&t["grossUsd"])),
        ("Net client exposure (USD)", n2(&t["netUsd"])),
        ("B-book share of exposure (%)", n2(&t["bbookSharePct"])),
        ("Top 10 accounts' share of exposure (%)", n2(&v["concentration"]["top10GrossPct"])),
        ("Accounts at risk", Cell::Int(t["atRisk"].as_i64().unwrap_or(0))),
        ("Credit in use (USD)", n2(&v["credit"]["inUse"])),
        ("Negative equity (USD)", n2(&v["credit"]["negativeEquity"])),
        ("Broker capital (USD)", n2(&c["amount"])),
        ("Worst preset scenario (USD)", n2(&c["worst"]["brokerImpact"])),
        ("Capital coverage (×)", n2(&c["coverage"])),
        ("Capital strength", Cell::text(c["status"].as_str().unwrap_or(""))),
    ];
    s.rows = rows.into_iter().map(|(k, v)| vec![Cell::text(k), v]).collect();
    let expo_headers = ["Long lots", "Short lots", "Net lots", "Long USD", "Short USD", "Net USD", "Gross USD", "B-book share %", "Client floating", "B-book floating", "Positions", "Accounts"];
    let expo_row = |key: &str, r: &Value| {
        let mut row = vec![Cell::text(r[key].as_str().unwrap_or(""))];
        if key == "symbol" {
            row.push(Cell::text(r["class"].as_str().unwrap_or("")));
        }
        for k in ["longLots", "shortLots", "netLots", "longUsd", "shortUsd", "netUsd", "grossUsd", "bbookSharePct", "clientFloating", "bbookFloating"] {
            row.push(n2(&r[k]));
        }
        row.push(Cell::Int(r["positions"].as_i64().unwrap_or(0)));
        row.push(Cell::Int(r["accounts"].as_i64().unwrap_or(0)));
        row
    };
    let mut h1 = vec!["Symbol", "Class"];
    h1.extend(expo_headers);
    let mut t1 = Table::new("By symbol", &h1);
    t1.rows = v["bySymbol"].as_array().into_iter().flatten().map(|r| expo_row("symbol", r)).collect();
    let mut h2 = vec!["Asset class"];
    h2.extend(expo_headers);
    let mut t2 = Table::new("By asset class", &h2);
    t2.rows = v["byClass"].as_array().into_iter().flatten().map(|r| expo_row("class", r)).collect();
    let mut t3 = Table::new("Margin levels", &["Margin level", "Accounts", "Equity", "Floating"]);
    t3.rows = v["marginLevels"]["buckets"].as_array().into_iter().flatten().map(|b| vec![Cell::text(b["label"].as_str().unwrap_or("")), Cell::Int(b["accounts"].as_i64().unwrap_or(0)), n2(&b["equity"]), n2(&b["floating"])]).collect();
    let acct_headers = ["Login", "User", "Name", "Country", "Group", "Balance", "Credit", "Equity", "Margin", "Margin level %", "Stop-out %", "Floating", "Loss to stop-out"];
    let acct_cells = |a: &Value| {
        vec![
            Cell::Int(a["login"].as_i64().unwrap_or(0)),
            Cell::Int(a["userId"].as_i64().unwrap_or(0)),
            Cell::text(a["name"].as_str().unwrap_or("")),
            Cell::text(a["country"].as_str().unwrap_or("")),
            Cell::text(a["group"].as_str().unwrap_or("")),
            n2(&a["balance"]),
            n2(&a["credit"]),
            n2(&a["equity"]),
            n2(&a["margin"]),
            n2(&a["marginLevel"]),
            n2(&a["stopOutLevel"]),
            n2(&a["floating"]),
            n2(&a["lossToStopOut"]),
        ]
    };
    let mut t4 = Table::new("Accounts at risk", &acct_headers);
    t4.rows = v["atRisk"].as_array().into_iter().flatten().map(acct_cells).collect();
    let mut t5 = Table::new("Scenarios", &["Scenario", "Direction", "Broker impact", "Client P&L", "Stop-outs", "Margin calls", "Negative balance", "Capital after"]);
    t5.rows = c["presets"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|p| {
            vec![
                Cell::text(p["label"].as_str().unwrap_or("")),
                Cell::text(p["direction"].as_str().unwrap_or("")),
                n2(&p["brokerImpact"]),
                n2(&p["clientPnl"]),
                Cell::Int(p["stopOuts"].as_i64().unwrap_or(0)),
                Cell::Int(p["marginCalls"].as_i64().unwrap_or(0)),
                n2(&p["negativeBalance"]),
                n2(&p["capitalAfter"]),
            ]
        })
        .collect();
    let mut h6: Vec<&str> = acct_headers.to_vec();
    h6.extend(["Gross USD", "Net USD", "Share %", "B-book floating"]);
    let mut t6 = Table::new("Concentration", &h6);
    t6.rows = v["concentration"]["topAccounts"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|a| {
            let mut r = acct_cells(a);
            r.extend([n2(&a["grossUsd"]), n2(&a["netUsd"]), n2(&a["sharePct"]), n2(&a["bbookFloating"])]);
            r
        })
        .collect();
    vec![s, t1, t2, t3, t4, t5, t6]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn specs() -> Specs {
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config");
        Specs::load(&format!("{root}/instruments.json"), &format!("{root}/trading-specs.json")).unwrap()
    }

    fn acct(login: i64, balance: f64, credit: f64, equity: f64, margin: f64) -> Acct {
        Acct { login, user_id: login - 1000, group: "standard".into(), balance, credit, equity, margin, floating: equity - balance - credit, margin_level: if margin > 0.0 { Some(equity / margin * 100.0) } else { None }, margin_call: 100.0, stop_out: 50.0, positions: 1 }
    }

    fn eurusd(login: i64, sign: f64, lots: f64, book: &str) -> Pos {
        Pos { ticket: login * 10, login, symbol: "EURUSD".into(), underlying: "EURUSD".into(), class: "forex".into(), sign, volume: lots, contract: 100_000.0, price: 1.16, conv: 1.0, book: book.into(), ..Default::default() }
    }

    #[test]
    fn parses_engine_views_with_the_engines_conversion() {
        let s = specs();
        let rates = HashMap::new();
        // a cent account: amounts in USC → USD
        let a = acct_from(&json!({"login": 80412337, "userId": 7, "group": "cent", "cent": true, "currency": "USC", "balance": 100000, "credit": 5000, "bonus": 0,
            "equity": 104000, "margin": 52000, "profit": -800, "swap": -200, "marginLevel": 200.0, "marginCallLevel": 100, "stopOutLevel": 50, "positions": 2})).unwrap();
        assert_eq!((a.balance, a.credit, a.equity, a.margin, a.floating, a.margin_level), (1000.0, 50.0, 1040.0, 520.0, -10.0, Some(200.0)));
        // EURJPY: the engine's profit implies the JPY → USD rate (the fixed table says 1/150)
        let p = pos_from(&json!({"ticket": "55", "login": "80412337", "symbol": "EURJPY", "side": "buy", "volume": 1.0, "openPrice": 170.0, "currentPrice": 171.0,
            "profit": 680.0, "swap": -3.0, "route": "B", "currency": "USD"}), &s, &rates).unwrap();
        assert!((p.conv - 0.0068).abs() < 1e-12, "{}", p.conv);
        assert_eq!((p.class.as_str(), p.contract, p.floating, p.usd_base), ("forex", 100_000.0, 677.0, false));
        assert!((p.notional() - 100_000.0 * 171.0 * 0.0068).abs() < 1e-6);
        // too small a move to imply: falls back to the table
        let q = pos_from(&json!({"ticket": 56, "login": 1, "symbol": "EURJPY", "side": "sell", "volume": 0.01, "openPrice": 171.0, "currentPrice": 171.001, "profit": 0.0, "swap": 0, "route": "A"}), &s, &rates).unwrap();
        assert!((q.conv - 1.0 / 150.0).abs() < 1e-12);
        assert_eq!((q.sign, q.book.as_str()), (-1.0, "A"));
        // USD-based pair: 1 ÷ price, exact under a shock
        let j = pos_from(&json!({"ticket": 57, "login": 1, "symbol": "USDJPY", "side": "buy", "volume": 1.0, "openPrice": 150.0, "currentPrice": 150.0, "profit": 0, "swap": 0, "route": "B"}), &s, &rates).unwrap();
        assert!(j.usd_base);
        assert!((j.notional() - 100_000.0).abs() < 1e-6);
        // +1 %: 100 000 × (151.5 − 150) ÷ 151.5 = 990.10 USD
        assert!((position_delta(&j, 1.0) - 100_000.0 * 1.5 / 151.5).abs() < 1e-6);
        // an option: delta-gamma on the underlying
        let o = pos_from(&json!({"ticket": 58, "login": 1, "symbol": "EURUSD-20261009-1.1650-C", "side": "buy", "volume": 2.0, "openPrice": 0.0052, "currentPrice": 0.0060,
            "profit": 16.0, "swap": 0, "route": "B", "option": {"underlying": "EURUSD", "contractSize": 10000, "quoteCurrency": "USD"}, "greeks": {"delta": 1.2, "gamma": 30.0}, "underlyingPrice": 1.17}), &s, &rates).unwrap();
        assert_eq!((o.underlying.as_str(), o.class.as_str(), o.conv), ("EURUSD", "forex", 1.0));
        let ds = 1.17 * 0.01;
        assert!((position_delta(&o, 1.0) - (1.2 * ds + 0.5 * 30.0 * ds * ds) * 10_000.0).abs() < 1e-9);
    }

    #[test]
    fn shocks_resolve_most_specific_first_and_validate() {
        let sh = vec![Shock::all(-1.0), Shock::class("crypto", -10.0), Shock { scope: "symbol".into(), target: "BTCUSD".into(), pct: -20.0 }];
        assert_eq!(pct_for(&sh, "BTCUSD", "crypto"), -20.0);
        assert_eq!(pct_for(&sh, "ETHUSD", "crypto"), -10.0);
        assert_eq!(pct_for(&sh, "EURUSD", "forex"), -1.0);
        assert_eq!(pct_for(&[Shock::class("crypto", 5.0)], "EURUSD", "forex"), 0.0);
        let mut ok = vec![Shock { scope: "class".into(), target: "Crypto".into(), pct: -15.0 }, Shock { scope: "symbol".into(), target: "xauusd".into(), pct: 3.0 }];
        validate_shocks(&mut ok).unwrap();
        assert_eq!((ok[0].scope.as_str(), ok[0].target.as_str(), ok[1].target.as_str()), ("assetClass", "crypto", "XAUUSD"));
        for bad in [Shock::all(-95.0), Shock::class("bonds", 1.0), Shock { scope: "sector".into(), target: "x".into(), pct: 1.0 }, Shock { scope: "symbol".into(), target: "".into(), pct: 1.0 }, Shock::all(f64::NAN)] {
            assert!(validate_shocks(&mut [bad.clone()]).is_err(), "{bad:?}");
        }
        assert!(validate_shocks(&mut []).is_err());
    }

    #[test]
    fn scenario_revalues_accounts_stop_outs_and_uncollectible_losses() {
        // A: long 1 lot B-book, $2 000 equity of which $500 credit, margin $232 (1:500)
        // B: short 2 lots A-book, $50 000 equity
        // C: long 10 lots B-book, $3 000 equity (no credit) → wiped out by −3 %
        let snap = Snapshot {
            accounts: vec![acct(1001, 1500.0, 500.0, 2000.0, 232.0), acct(1002, 50_000.0, 0.0, 50_000.0, 464.0), acct(1003, 3000.0, 0.0, 3000.0, 2320.0), acct(1004, 900.0, 0.0, 900.0, 0.0)],
            positions: vec![eurusd(1001, 1.0, 1.0, "B"), eurusd(1002, -1.0, 2.0, "A"), eurusd(1003, 1.0, 10.0, "B")],
            ..Default::default()
        };
        let o = run(&snap, &[Shock::all(-3.0)]);
        assert_eq!(o.accounts.len(), 3, "accounts without positions are not revalued");
        let a = &o.accounts[0];
        // 1 lot × 100 000 × 1.16 × −3 % = −3 480 → equity −1 480: own money (1 500) gone, credit 500 used, −1 480 written off
        assert!((a.d_client + 3480.0).abs() < 1e-6, "{}", a.d_client);
        assert!((a.equity_after + 1480.0).abs() < 1e-6);
        assert!(a.stop_out);
        assert!((a.uncollectible - 1980.0).abs() < 1e-6 && (a.credit_used - 500.0).abs() < 1e-6 && (a.negative_after - 1480.0).abs() < 1e-6);
        // the broker books +3 480 on the B-book but only 1 500 is real money
        assert!((a.broker_impact - 1500.0).abs() < 1e-6, "{}", a.broker_impact);
        // margin scales with the notional
        assert!((a.margin_after - 232.0 * 0.97).abs() < 1e-9);
        let b = &o.accounts[1];
        // the A-book short wins 6 960: no B-book P&L, nothing uncollectible
        assert!((b.d_a - 6960.0).abs() < 1e-6 && b.d_b == 0.0 && b.broker_impact == 0.0 && !b.stop_out);
        let c = &o.accounts[2];
        assert!((c.d_client + 34_800.0).abs() < 1e-6 && c.stop_out);
        assert!((c.broker_impact - 3000.0).abs() < 1e-6);
        assert!((o.broker_impact() - 4500.0).abs() < 1e-6);
        assert_eq!((o.stop_outs(), o.margin_calls()), (2, 0));
        let t = o.totals();
        assert_eq!((t["bbookPnl"].as_f64(), t["negativeAccounts"].as_u64(), t["clientPnlA"].as_f64()), (Some(38_280.0), Some(2), Some(6960.0)));
        // +1 %: A wins 1 160 (no stop-out), the broker pays it on the B-book
        let up = run(&snap, &[Shock::all(1.0)]);
        assert!((up.accounts[0].broker_impact + 1160.0).abs() < 1e-6 && !up.accounts[0].stop_out);
        // margin call without stop-out: C at −0.1 % → equity 1 840, margin 2 317.68 → 79.4 % (call 100 %, stop-out 50 %)
        let small = run(&snap, &[Shock::all(-0.1)]);
        let c1 = &small.accounts[2];
        assert!((c1.equity_after - 1840.0).abs() < 1e-6);
        assert!(c1.margin_call && !c1.stop_out, "{c1:?}");
        // the preset picks the worse direction for the broker
        let (dir, shocks, w, legs) = worst_leg(&snap, preset_legs("pm3").unwrap());
        assert_eq!((dir, shocks, legs.len()), ("up", vec![Shock::all(3.0)], 2));
        assert!(w.broker_impact() < 0.0);
    }

    #[test]
    fn capital_strength_thresholds() {
        assert_eq!(strength(None, -1000.0), ("unset", None));
        assert_eq!(strength(Some(0.0), -1000.0), ("unset", None));
        assert_eq!(strength(Some(1000.0), 500.0), ("strong", None));
        assert_eq!(strength(Some(5000.0), -2000.0), ("strong", Some(2.5)));
        assert_eq!(strength(Some(1500.0), -1000.0), ("adequate", Some(1.5)));
        assert_eq!(strength(Some(500.0), -1000.0), ("weak", Some(0.5)));
        assert_eq!(LEVEL_BUCKETS[level_bucket(200.0)].0, "healthy");
        assert_eq!(LEVEL_BUCKETS[level_bucket(199.9)].0, "watch");
        assert_eq!(LEVEL_BUCKETS[level_bucket(100.0)].0, "watch");
        assert_eq!(LEVEL_BUCKETS[level_bucket(99.0)].0, "nearStopOut");
        assert_eq!(LEVEL_BUCKETS[level_bucket(50.0)].0, "nearStopOut");
        assert_eq!(LEVEL_BUCKETS[level_bucket(12.0)].0, "critical");
        assert_eq!(LEVEL_BUCKETS[level_bucket(-40.0)].0, "critical");
    }

    #[test]
    fn report_exposure_concentration_and_capital() {
        let mut snap = Snapshot {
            accounts: vec![acct(1001, 1500.0, 500.0, 2000.0, 232.0), acct(1002, 50_000.0, 0.0, 50_000.0, 464.0), acct(1003, 3000.0, 0.0, 2600.0, 2320.0)],
            positions: vec![eurusd(1001, 1.0, 1.0, "B"), eurusd(1002, -1.0, 2.0, "A"), eurusd(1003, 1.0, 10.0, "B")],
            ..Default::default()
        };
        snap.positions[2].floating = -400.0;
        snap.names.insert(3, ("Lena Hoffmann".into(), "DE".into()));
        let v = report_json(&snap, &json!({"amount": 20_000.0, "currency": "USD"}));
        let t = &v["totals"];
        // 13 lots × 116 000: long 11, short 2
        assert_eq!((t["grossUsd"].as_f64(), t["netUsd"].as_f64(), t["bbookFloating"].as_f64()), (Some(1_508_000.0), Some(1_044_000.0), Some(400.0)));
        assert_eq!(t["bbookSharePct"].as_f64(), Some(84.62));
        let s = &v["bySymbol"][0];
        assert_eq!((s["symbol"].as_str(), s["netLots"].as_f64(), s["bbookNetUsd"].as_f64(), s["accounts"].as_u64()), (Some("EURUSD"), Some(9.0), Some(1_276_000.0), Some(3)));
        assert_eq!(v["byClass"][0]["class"], "forex");
        assert_eq!(v["concentration"]["top10GrossPct"].as_f64(), Some(100.0));
        assert_eq!(v["concentration"]["topAccounts"][0]["login"], 1003);
        assert_eq!(v["concentration"]["topAccounts"][0]["name"], "Lena Hoffmann");
        // margin levels: 862 % and 10 776 % healthy, 1003 at 112 % → watch and at risk
        let b = v["marginLevels"]["buckets"].as_array().unwrap();
        assert_eq!((b[0]["accounts"].as_u64(), b[1]["accounts"].as_u64()), (Some(2), Some(1)));
        assert_eq!(v["atRisk"].as_array().unwrap().len(), 1);
        assert_eq!(v["atRisk"][0]["lossToStopOut"].as_f64(), Some(1440.0));
        assert_eq!(v["credit"]["credit"].as_f64(), Some(500.0));
        // capital: four presets, worst = the larger loss, coverage = capital ÷ loss
        let c = &v["capital"];
        assert_eq!(c["presets"].as_array().unwrap().len(), 4);
        let worst = c["worst"]["brokerImpact"].as_f64().unwrap();
        assert!(worst < 0.0);
        assert!(c["presets"].as_array().unwrap().iter().all(|p| p["brokerImpact"].as_f64().unwrap() >= worst));
        assert_eq!(c["coverage"].as_f64(), Some(round2(20_000.0 / -worst)));
        assert_eq!(tables(&v).len(), 7);
    }

    #[test]
    fn scenario_json_validates_the_request() {
        let snap = Snapshot { accounts: vec![acct(1001, 1500.0, 500.0, 2000.0, 232.0)], positions: vec![eurusd(1001, 1.0, 1.0, "B")], ..Default::default() };
        assert!(scenario_json(&snap, ScenarioIn::default(), None).is_err());
        assert!(scenario_json(&snap, ScenarioIn { preset: Some("pm2".into()), ..Default::default() }, None).is_err());
        assert!(scenario_json(&snap, ScenarioIn { preset: Some("pm1".into()), shocks: Some(vec![Shock::all(1.0)]), top: None }, None).is_err());
        let v = scenario_json(&snap, ScenarioIn { shocks: Some(vec![Shock { scope: "symbol".into(), target: "eurusd".into(), pct: -2.0 }]), ..Default::default() }, Some(10_000.0)).unwrap();
        assert_eq!((v["label"].as_str(), v["direction"].as_str()), (Some("Custom"), Some("custom")));
        // −2 %: client −2 320 on the B-book; own money 1 500 → broker gets 1 500, capital 11 500
        assert_eq!((v["totals"]["brokerImpact"].as_f64(), v["totals"]["capitalAfter"].as_f64(), v["totals"]["stopOuts"].as_u64()), (Some(1500.0), Some(11_500.0), Some(1)));
        assert_eq!(v["accounts"][0]["login"], 1001);
        assert_eq!(v["bySymbol"][0]["bbookPnl"].as_f64(), Some(2320.0));
        let f = scenario_json(&snap, ScenarioIn { preset: Some("flash".into()), ..Default::default() }, Some(10_000.0)).unwrap();
        assert_eq!((f["label"].as_str(), f["legs"].as_array().unwrap().len()), (Some("Flash crash"), 1));
    }
}

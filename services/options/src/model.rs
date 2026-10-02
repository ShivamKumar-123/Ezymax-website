//! Reference data as loaded from the database into memory (`RefData`), versioned by `meta.version`.
//! Pricing, the API and the engine snapshot all read the same `Arc<RefData>`; it is reloaded whenever the
//! version changes (every write bumps it).

use std::collections::{BTreeMap, HashMap};

use chrono::{DateTime, NaiveDate, Utc};
use optmath::calendar::{Cut, HolidayCalendar};
use optmath::term::{TenorQuotes, VolSurface};
use optmath::{Date, SmileQuotes, VolClock};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

pub const PLATFORM_TENANT: &str = "kalks";

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Underlying {
    pub symbol: String,
    pub name: String,
    pub asset_class: String,
    pub model: String,
    pub base_ccy: String,
    pub quote_ccy: String,
    pub calendars: Vec<String>,
    pub contract_size: f64,
    pub contract_unit: String,
    pub digits: i32,
    pub pip_size: f64,
    pub strike_step: f64,
    pub strikes_each_side: i32,
    pub extend_threshold: i32,
    pub expiry_kinds: Vec<String>,
    pub daily_count: i32,
    pub weekly_count: i32,
    pub monthly_count: i32,
    pub cut_time: String,
    pub cut_zone: String,
    pub twap_minutes: i32,
    pub no_open_minutes: i32,
    pub close_only_minutes: i32,
    pub delta_convention: String,
    pub weekend_vol_weight: f64,
    pub holiday_vol_weight: f64,
    pub price_scan: f64,
    pub vol_scan: f64,
    pub extreme_multiple: f64,
    pub extreme_cover: f64,
    pub min_contracts: f64,
    pub max_contracts: f64,
    pub contract_step: f64,
    pub barriers_enabled: bool,
    pub enabled: bool,
    pub sort: i32,
    pub notes: String,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
    /* ---- order book (docs/OPTIONS-EXCHANGE.md §2, §5, §6, §8) ---- */
    /// Premium tick, quote currency per unit (default FX pip / 10, XAU 0.01, other metals and oil 0.001).
    pub premium_tick: f64,
    /// Market orders: IOC limit at mark × (1 ± this %), at least `band_min_ticks` away.
    pub market_band_pct: f64,
    /// Aggressive limits: within mark × (1 ± this %) + `band_min_ticks`.
    pub limit_band_pct: f64,
    pub band_min_ticks: i32,
    /// Liquidation: reduce-only IOC at mark × (1 ∓ this %).
    pub liq_band_pct: f64,
    /// Liquidation backstop: the MM takes the rest at mark ∓ max(this % × mark, 1 tick).
    pub liq_fee_pct: f64,
    /// Combo RFQ: how long an MM quote stays firm.
    pub rfq_quote_ttl_secs: i32,
    /// Mark clamp: both book sides need at least this many contracts…
    pub mark_min_qty: f64,
    /// …and the book spread at most this × the model spread.
    pub mark_max_spread_mult: f64,
}

/// Barrier options are not listed on the order book: RFQ only, quoted by Kalks at the model price ± spread (§5).
pub const BARRIER_VENUE: &str = "rfq";
pub const BARRIER_LABEL: &str = "Kalks-quoted (RFQ only)";

/// §2 default premium tick: FX pip / 10, XAU 0.01, other metals and oil 0.001 (same rule as the migration's
/// `default_premium_tick`).
pub fn default_premium_tick(asset_class: &str, symbol: &str, pip_size: f64) -> f64 {
    if asset_class == "forex" {
        (pip_size / 10.0 * 1e10).round() / 1e10
    } else if symbol.starts_with("XAU") {
        0.01
    } else {
        0.001
    }
}

/// `x` is a whole multiple of `step` (within float noise).
pub fn is_multiple(x: f64, step: f64) -> bool {
    if !(x.is_finite() && step.is_finite() && step > 0.0) {
        return false;
    }
    let n = x / step;
    (n - n.round()).abs() < 1e-6
}

impl Underlying {
    pub fn cut(&self) -> Cut {
        Cut::parse(&self.cut_time, &self.cut_zone).unwrap_or(Cut::NY10)
    }
    pub fn clock(&self) -> VolClock {
        VolClock::new(self.weekend_vol_weight, self.holiday_vol_weight)
    }
    /// Calendars that must all be open on an expiry: the configured ones plus USD (New York).
    pub fn calendar_codes(&self) -> Vec<String> {
        let mut v = self.calendars.clone();
        if !v.iter().any(|c| c == "USD") {
            v.push("USD".into());
        }
        v.sort();
        v.dedup();
        v
    }
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Rate {
    pub ccy: String,
    pub rate: f64,
    pub kind: String,
    pub source: String,
    pub as_of: NaiveDate,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Holiday {
    pub calendar: String,
    pub day: NaiveDate,
    pub name: String,
    pub source: String,
    pub active: bool,
}

/// One tenor of a published surface (vols as decimals).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Pillar {
    pub tenor: String,
    pub days: f64,
    pub atm: f64,
    pub rr25: f64,
    pub bf25: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rr10: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bf10: Option<f64>,
}

/// Validates pillars into an optmath surface (calendar-arbitrage free, sorted by days).
pub fn build_surface(pillars: &[Pillar]) -> Result<VolSurface, String> {
    let mut p = pillars.to_vec();
    p.sort_by(|a, b| a.days.total_cmp(&b.days));
    for x in &p {
        if !(x.days > 0.0 && x.days <= 3660.0) {
            return Err(format!("tenor {}: days must be in (0, 3660]", x.tenor));
        }
        if !(x.atm > 0.001 && x.atm < 3.0) {
            return Err(format!("tenor {}: ATM vol must be a decimal between 0.001 and 3 (e.g. 0.085)", x.tenor));
        }
        if x.rr10.is_some() != x.bf10.is_some() {
            return Err(format!("tenor {}: give both RR10 and BF10 or neither", x.tenor));
        }
    }
    VolSurface::new(
        p.iter()
            .map(|x| TenorQuotes { t: x.days / 365.0, quotes: SmileQuotes { atm: x.atm, rr25: x.rr25, bf25: x.bf25, rr10: x.rr10, bf10: x.bf10 } })
            .collect(),
    )
    .map_err(|e| e.to_string())
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Surface {
    pub symbol: String,
    pub version: i32,
    pub blend_weight: f64,
    pub pillars: Vec<Pillar>,
    pub reason: String,
    pub published_by: String,
    pub published_at: DateTime<Utc>,
    #[serde(skip)]
    pub surface: Option<VolSurface>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Realized {
    pub symbol: String,
    pub estimator: String,
    pub tf: String,
    pub window_bars: i32,
    pub value: f64,
    pub computed_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TenantSettings {
    pub tenant: String,
    pub enabled_demo: bool,
    pub enabled_live: bool,
    pub public_chain: bool,
    pub underlyings: Option<Vec<String>>,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
}

impl TenantSettings {
    pub fn off(tenant: &str) -> Self {
        TenantSettings {
            tenant: tenant.into(),
            enabled_demo: false,
            enabled_live: false,
            public_chain: false,
            underlyings: None,
            updated_at: DateTime::<Utc>::UNIX_EPOCH,
            updated_by: String::new(),
        }
    }
    pub fn any_enabled(&self) -> bool {
        self.enabled_demo || self.enabled_live
    }
    pub fn allows(&self, symbol: &str) -> bool {
        self.underlyings.as_ref().is_none_or(|u| u.iter().any(|s| s == symbol))
    }
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GroupSettings {
    pub tenant: String,
    pub group_code: String,
    pub symbol: String,
    pub vol_spread: f64,
    pub min_spread_usd: f64,
    pub commission_per_contract: f64,
    pub commission_cap_pct: f64,
    pub max_contracts_per_client: f64,
    pub weekend_margin_pct: f64,
    pub enabled: bool,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
    /// Order book (§7): USD per contract, negative = a rebate to the resting side. `None` = this row's
    /// `commission_per_contract` (the engine's fallback).
    pub maker_fee_per_contract: Option<f64>,
    /// Order book (§7): USD per contract, ≥ 0. `None` = `commission_per_contract`.
    pub taker_fee_per_contract: Option<f64>,
}

/// Platform default order-book fees per contract (USD): a 0.05 maker rebate and a 0.25 taker fee.
pub const DEFAULT_MAKER_FEE: f64 = -0.05;
pub const DEFAULT_TAKER_FEE: f64 = 0.25;

impl GroupSettings {
    /// Built-in defaults when a tenant has no row at all.
    pub fn builtin(tenant: &str) -> Self {
        GroupSettings {
            tenant: tenant.into(),
            group_code: "*".into(),
            symbol: "*".into(),
            vol_spread: 0.004,
            min_spread_usd: 0.5,
            commission_per_contract: 0.25,
            commission_cap_pct: 10.0,
            max_contracts_per_client: 200.0,
            weekend_margin_pct: 25.0,
            enabled: true,
            updated_at: DateTime::<Utc>::UNIX_EPOCH,
            updated_by: "builtin".into(),
            maker_fee_per_contract: Some(DEFAULT_MAKER_FEE),
            taker_fee_per_contract: Some(DEFAULT_TAKER_FEE),
        }
    }

    /// Effective (maker, taker) order-book fee per contract in USD, exactly as the engine reads the snapshot: a
    /// missing value is the row's commission per contract; the taker fee is never negative.
    pub fn book_fees(&self) -> (f64, f64) {
        let base = self.commission_per_contract.max(0.0);
        let f = |x: Option<f64>| x.filter(|v| v.is_finite()).unwrap_or(base);
        (f(self.maker_fee_per_contract), f(self.taker_fee_per_contract).max(0.0))
    }
}

/// §7 admin rule over one broker's rows (`(label, maker, taker)` effective fees): the lowest taker fee must cover the
/// largest maker rebate, `min(taker) ≥ max(|maker rebate|)`, so a match between two clients never costs the house.
/// `None` when the rule holds.
pub fn fee_rule_violation(rows: &[(String, f64, f64)]) -> Option<String> {
    let min_taker = rows.iter().min_by(|a, b| a.2.total_cmp(&b.2))?;
    let max_rebate = rows.iter().filter(|r| r.1 < 0.0).max_by(|a, b| (-a.1).total_cmp(&-b.1))?;
    if min_taker.2 + 1e-9 >= -max_rebate.1 {
        return None;
    }
    Some(format!(
        "The lowest taker fee ({:.2} USD, {}) must be at least the largest maker rebate ({:.2} USD, {}): min(taker) ≥ max(|maker rebate|).",
        min_taker.2, min_taker.0, -max_rebate.1, max_rebate.0
    ))
}

/// The Kalks market maker's quoting parameters for (tenant or `*`, account kind `live|demo|*`, underlying or `*`)
/// (docs/OPTIONS-EXCHANGE.md §4). Spreads are decimal vols each side of the smile vol per tenor bucket.
#[derive(Clone, Debug, Serialize, FromRow, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MmSettings {
    pub tenant: String,
    pub kind: String,
    pub underlying: String,
    pub enabled: bool,
    /// 0DTE (expiring today).
    #[serde(rename = "spreadVol0dte")]
    pub spread_vol_0dte: f64,
    /// Up to 7 days.
    #[serde(rename = "spreadVol7d")]
    pub spread_vol_7d: f64,
    /// Up to 30 days.
    #[serde(rename = "spreadVol30d")]
    pub spread_vol_30d: f64,
    /// Longer.
    pub spread_vol_long: f64,
    /// Bid and ask at least this many premium ticks apart.
    pub min_spread_ticks: i32,
    /// Vol skew by −skewVol × (net vega of the expiry / maxVega).
    pub skew_vol: f64,
    /// Price shifted by −skewTicksPerContract × inventory (contracts).
    pub skew_ticks_per_contract: f64,
    /// Contracts per quote side before moneyness / limit scaling.
    pub base_size: f64,
    /// Delta-weighted contracts.
    pub max_net_delta: f64,
    /// Contract-delta change per 1 % spot move.
    pub max_gamma: f64,
    /// USD per vol point.
    pub max_vega: f64,
    pub max_contracts_per_series: f64,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
}

impl MmSettings {
    /// The migration's `*, *, *` defaults (used when the table is empty).
    pub fn builtin() -> Self {
        MmSettings {
            tenant: "*".into(),
            kind: "*".into(),
            underlying: "*".into(),
            enabled: true,
            spread_vol_0dte: 0.008,
            spread_vol_7d: 0.005,
            spread_vol_30d: 0.004,
            spread_vol_long: 0.0035,
            min_spread_ticks: 2,
            skew_vol: 0.002,
            skew_ticks_per_contract: 0.05,
            base_size: 10.0,
            max_net_delta: 500.0,
            max_gamma: 150.0,
            max_vega: 25_000.0,
            max_contracts_per_series: 2_000.0,
            updated_at: DateTime::<Utc>::UNIX_EPOCH,
            updated_by: "builtin".into(),
        }
    }

    /// Specificity of this row for (tenant, kind, underlying): tenant 4, kind 2, underlying 1; `None` when it does
    /// not apply.
    pub fn score(&self, tenant: &str, kind: &str, underlying: &str) -> Option<u8> {
        let t = if self.tenant == tenant { 4 } else if self.tenant == "*" { 0 } else { return None };
        let k = if self.kind == kind { 2 } else if self.kind == "*" { 0 } else { return None };
        let u = if self.underlying == underlying { 1 } else if self.underlying == "*" { 0 } else { return None };
        Some(t + k + u)
    }
}

/// The most specific `mm_settings` row for (tenant, kind, underlying), else the built-in defaults.
pub fn resolve_mm(rows: &[MmSettings], tenant: &str, kind: &str, underlying: &str) -> MmSettings {
    rows.iter().filter_map(|r| r.score(tenant, kind, underlying).map(|s| (s, r))).max_by_key(|(s, _)| *s).map(|(_, r)| r.clone()).unwrap_or_else(MmSettings::builtin)
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Control {
    pub id: i64,
    pub tenant: String,
    pub scope: String,
    pub target: String,
    pub mode: String,
    pub manual_vol: Option<f64>,
    pub frozen_spot: Option<f64>,
    pub reason: String,
    pub active: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

impl Control {
    fn applies(&self, tenant: Option<&str>, symbol: &str, expiry_key: &str, code: Option<&str>) -> bool {
        let tenant_ok = self.tenant == "*" || tenant.is_none_or(|t| t == self.tenant);
        tenant_ok
            && match self.scope.as_str() {
                "all" => true,
                "underlying" => self.target == symbol,
                "expiry" => self.target == expiry_key,
                "series" => code.is_some_and(|c| c == self.target),
                _ => false,
            }
    }
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ClientLimit {
    pub tenant: String,
    pub user_id: i64,
    pub max_contracts: Option<f64>,
    pub max_short_contracts: Option<f64>,
    pub close_only: bool,
    pub blocked: bool,
    pub reason: String,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Expiry {
    pub id: i64,
    pub symbol: String,
    pub expiry_date: NaiveDate,
    pub kinds: Vec<String>,
    pub cut_at: DateTime<Utc>,
    pub twap_start: DateTime<Utc>,
    pub status: String,
    pub fixing: Option<f64>,
    pub fixing_source: Option<String>,
    pub fixing_run: i32,
    pub fixing_samples: Option<i32>,
    pub fixing_expected: Option<i32>,
    pub fixing_coverage: Option<f64>,
    pub fixing_max_gap_ms: Option<i64>,
    pub fixed_at: Option<DateTime<Utc>>,
    pub fixing_error: Option<String>,
}

impl Expiry {
    /// `SYMBOL:YYYY-MM-DD`, the control target of an expiry.
    pub fn key(&self) -> String {
        format!("{}:{}", self.symbol, self.expiry_date)
    }
}

#[derive(Clone, Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Series {
    pub code: String,
    pub symbol: String,
    pub expiry_id: i64,
    pub strike: f64,
    pub strike_ticks: i64,
    pub kind: String,
    pub status: String,
}

/// `EURUSD-20261009-1.1650-C`.
pub fn series_code(symbol: &str, date: NaiveDate, strike: &str, kind: &str) -> String {
    format!("{symbol}-{}-{strike}-{}", date.format("%Y%m%d"), if kind == "call" { "C" } else { "P" })
}

pub fn to_date(d: NaiveDate) -> Date {
    Date::parse(&d.to_string()).expect("valid date")
}

/// Everything the pricer needs, immutable once loaded.
#[derive(Debug, Default)]
pub struct RefData {
    pub version: i64,
    pub loaded_at: Option<DateTime<Utc>>,
    pub underlyings: Vec<Underlying>,
    pub rates: BTreeMap<String, Rate>,
    pub holidays: BTreeMap<String, Vec<Holiday>>,
    pub calendars: HashMap<String, HolidayCalendar>,
    /// Pair calendar per underlying (union of its calendars + USD).
    pub pair_calendars: HashMap<String, HolidayCalendar>,
    pub surfaces: HashMap<String, Surface>,
    /// Preferred realized vol per symbol (Yang-Zhang 20 D1 bars, else the next estimator).
    pub realized: HashMap<String, Realized>,
    pub tenants: HashMap<String, TenantSettings>,
    pub groups: Vec<GroupSettings>,
    pub controls: Vec<Control>,
    pub limits: Vec<ClientLimit>,
    pub expiries: Vec<Expiry>,
    pub series: Vec<Series>,
    /// Kalks market maker quoting parameters (§4), every row.
    pub mm: Vec<MmSettings>,
}

/// Effective dealing state of a series for one tenant.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TradeState {
    Open,
    CloseOnly,
    Halted,
    Closed,
}

impl RefData {
    pub fn underlying(&self, symbol: &str) -> Option<&Underlying> {
        self.underlyings.iter().find(|u| u.symbol.eq_ignore_ascii_case(symbol))
    }

    pub fn rate(&self, ccy: &str) -> f64 {
        self.rates.get(ccy).map(|r| r.rate).unwrap_or(0.0)
    }

    pub fn pair_calendar(&self, symbol: &str) -> HolidayCalendar {
        self.pair_calendars.get(symbol).cloned().unwrap_or_default()
    }

    pub fn tenant(&self, tenant: &str) -> TenantSettings {
        self.tenants.get(tenant).cloned().unwrap_or_else(|| TenantSettings::off(tenant))
    }

    /// Most specific group settings: (group, symbol) > (group, *) > (*, symbol) > (*, *) > built-in.
    pub fn group(&self, tenant: &str, group: &str, symbol: &str) -> GroupSettings {
        let rank = |g: &GroupSettings| -> Option<u8> {
            if g.tenant != tenant {
                return None;
            }
            match (g.group_code == group, g.group_code == "*", g.symbol == symbol, g.symbol == "*") {
                (true, _, true, _) => Some(0),
                (true, _, _, true) => Some(1),
                (_, true, true, _) => Some(2),
                (_, true, _, true) => Some(3),
                _ => None,
            }
        };
        self.groups.iter().filter_map(|g| rank(g).map(|r| (r, g))).min_by_key(|(r, _)| *r).map(|(_, g)| g.clone()).unwrap_or_else(|| {
            if tenant != PLATFORM_TENANT { self.group(PLATFORM_TENANT, "*", symbol) } else { GroupSettings::builtin(tenant) }
        })
    }

    /// Active controls that apply (tenant `None` = platform view: every tenant's controls).
    pub fn controls_for<'a>(&'a self, tenant: Option<&'a str>, symbol: &'a str, expiry_key: &'a str, code: Option<&'a str>) -> impl Iterator<Item = &'a Control> + 'a {
        let now = Utc::now();
        self.controls.iter().filter(move |c| c.active && c.expires_at.is_none_or(|e| e > now) && c.applies(tenant, symbol, expiry_key, code))
    }

    /// Dealing state of a series from controls and the time to the cut.
    pub fn trade_state(&self, tenant: &str, u: &Underlying, e: &Expiry, code: Option<&str>, now: DateTime<Utc>) -> TradeState {
        if e.status != "listed" || now >= e.cut_at - chrono::Duration::minutes(u.close_only_minutes as i64) {
            return TradeState::Closed;
        }
        let key = e.key();
        let mut st = TradeState::Open;
        for c in self.controls_for(Some(tenant), &u.symbol, &key, code) {
            match c.mode.as_str() {
                "halt" => return TradeState::Halted,
                "close_only" => st = TradeState::CloseOnly,
                _ => {}
            }
        }
        if now >= e.cut_at - chrono::Duration::minutes(u.no_open_minutes as i64) {
            st = TradeState::CloseOnly;
        }
        st
    }

    /// Manual ATM vol / frozen spot overrides for an expiry (most recent control wins).
    pub fn overrides(&self, tenant: Option<&str>, symbol: &str, expiry_key: &str) -> (Option<f64>, Option<f64>) {
        let mut vol: Option<(i64, f64)> = None;
        let mut spot: Option<(i64, f64)> = None;
        for c in self.controls_for(tenant, symbol, expiry_key, None) {
            if c.mode == "manual_vol"
                && let Some(v) = c.manual_vol
                && vol.is_none_or(|(id, _)| c.id > id)
            {
                vol = Some((c.id, v));
            }
            if c.mode == "freeze"
                && let Some(s) = c.frozen_spot
                && spot.is_none_or(|(id, _)| c.id > id)
            {
                spot = Some((c.id, s));
            }
        }
        (vol.map(|x| x.1), spot.map(|x| x.1))
    }

    pub fn expiry(&self, symbol: &str, date: NaiveDate) -> Option<&Expiry> {
        self.expiries.iter().find(|e| e.symbol == symbol && e.expiry_date == date)
    }

    pub fn series_of(&self, expiry_id: i64) -> impl Iterator<Item = &Series> {
        self.series.iter().filter(move |s| s.expiry_id == expiry_id)
    }

    /// The market maker's settings for (tenant, kind, underlying) (most specific row wins).
    pub fn mm_for(&self, tenant: &str, kind: &str, underlying: &str) -> MmSettings {
        resolve_mm(&self.mm, tenant, kind, underlying)
    }
}

/// Loads everything (one consistent read inside a REPEATABLE READ transaction).
pub async fn load(pool: &PgPool) -> anyhow::Result<RefData> {
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY").execute(&mut *tx).await?;
    let version: i64 = sqlx::query_scalar("SELECT value FROM meta WHERE key = 'version'").fetch_one(&mut *tx).await?;
    let underlyings: Vec<Underlying> = sqlx::query_as("SELECT * FROM underlyings ORDER BY sort, symbol").fetch_all(&mut *tx).await?;
    let rates: Vec<Rate> = sqlx::query_as("SELECT ccy, rate, kind, source, as_of, updated_at, updated_by FROM rates").fetch_all(&mut *tx).await?;
    let holidays: Vec<Holiday> =
        sqlx::query_as("SELECT calendar, day, name, source, active FROM holidays WHERE active ORDER BY calendar, day").fetch_all(&mut *tx).await?;
    let surf_rows = sqlx::query_as::<_, (String, i32, f64, serde_json::Value, String, String, DateTime<Utc>)>(
        "SELECT DISTINCT ON (symbol) symbol, version, blend_weight, pillars, reason, published_by, published_at
           FROM vol_surfaces ORDER BY symbol, version DESC",
    )
    .fetch_all(&mut *tx)
    .await?;
    let rv_rows = sqlx::query_as::<_, (String, String, String, i32, f64, DateTime<Utc>)>(
        "SELECT symbol, estimator, tf, window_bars, value, computed_at FROM realized_vol WHERE tf = 'D1'",
    )
    .fetch_all(&mut *tx)
    .await?;
    let tenants: Vec<TenantSettings> = sqlx::query_as("SELECT * FROM tenant_settings").fetch_all(&mut *tx).await?;
    let groups: Vec<GroupSettings> = sqlx::query_as("SELECT * FROM group_settings ORDER BY tenant, group_code, symbol").fetch_all(&mut *tx).await?;
    let controls: Vec<Control> = sqlx::query_as(
        "SELECT id, tenant, scope, target, mode, manual_vol, frozen_spot, reason, active, expires_at, created_by, created_at
           FROM controls WHERE active AND (expires_at IS NULL OR expires_at > now()) ORDER BY id",
    )
    .fetch_all(&mut *tx)
    .await?;
    let limits: Vec<ClientLimit> = sqlx::query_as("SELECT * FROM client_limits ORDER BY tenant, user_id").fetch_all(&mut *tx).await?;
    let mm: Vec<MmSettings> = sqlx::query_as(
        "SELECT tenant, kind, underlying, enabled, spread_vol_0dte, spread_vol_7d, spread_vol_30d, spread_vol_long, min_spread_ticks, skew_vol,
                skew_ticks_per_contract, base_size, max_net_delta, max_gamma, max_vega, max_contracts_per_series, updated_at, updated_by
           FROM mm_settings ORDER BY tenant, kind, underlying",
    )
    .fetch_all(&mut *tx)
    .await?;
    let expiries: Vec<Expiry> = sqlx::query_as(
        "SELECT id, symbol, expiry_date, kinds, cut_at, twap_start, status, fixing, fixing_source, fixing_run, fixing_samples,
                fixing_expected, fixing_coverage, fixing_max_gap_ms, fixed_at, fixing_error
           FROM expiries WHERE status IN ('listed', 'fixing') OR cut_at > now() - interval '7 days' ORDER BY symbol, expiry_date",
    )
    .fetch_all(&mut *tx)
    .await?;
    let ids: Vec<i64> = expiries.iter().map(|e| e.id).collect();
    let series: Vec<Series> = sqlx::query_as(
        "SELECT code, symbol, expiry_id, strike, strike_ticks, kind, status FROM series WHERE expiry_id = ANY($1) ORDER BY expiry_id, strike_ticks, kind",
    )
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let mut rd = RefData { version, loaded_at: Some(Utc::now()), ..Default::default() };
    for r in rates {
        rd.rates.insert(r.ccy.clone(), r);
    }
    for h in holidays {
        rd.calendars.entry(h.calendar.clone()).or_default().insert(to_date(h.day));
        rd.holidays.entry(h.calendar.clone()).or_default().push(h);
    }
    for u in &underlyings {
        let codes = u.calendar_codes();
        let cal = HolidayCalendar::union(codes.iter().filter_map(|c| rd.calendars.get(c)));
        rd.pair_calendars.insert(u.symbol.clone(), cal);
    }
    rd.underlyings = underlyings;
    for (symbol, version, blend_weight, pillars, reason, published_by, published_at) in surf_rows {
        let pillars: Vec<Pillar> = serde_json::from_value(pillars).unwrap_or_default();
        let surface = match build_surface(&pillars) {
            Ok(s) => Some(s),
            Err(e) => {
                tracing::error!(%symbol, version, error = %e, "stored vol surface is invalid; pricing falls back to realized vol");
                None
            }
        };
        rd.surfaces.insert(symbol.clone(), Surface { symbol, version, blend_weight, pillars, reason, published_by, published_at, surface });
    }
    // Preference: Yang-Zhang 20 > Garman-Klass 20 > EWMA > close 20.
    let pref = |e: &str, w: i32| match (e, w) {
        ("yang_zhang", 20) => 0,
        ("garman_klass", 20) => 1,
        ("ewma", _) => 2,
        ("close", 20) => 3,
        _ => 9,
    };
    for (symbol, estimator, tf, window_bars, value, computed_at) in rv_rows {
        let p = pref(&estimator, window_bars);
        if p == 9 || !(value > 0.0 && value < 5.0) {
            continue;
        }
        let better = rd.realized.get(&symbol).is_none_or(|cur| p < pref(&cur.estimator, cur.window_bars));
        if better {
            rd.realized.insert(symbol.clone(), Realized { symbol, estimator, tf, window_bars, value, computed_at });
        }
    }
    for t in tenants {
        rd.tenants.insert(t.tenant.clone(), t);
    }
    rd.groups = groups;
    rd.controls = controls;
    rd.limits = limits;
    rd.expiries = expiries;
    rd.series = series;
    rd.mm = mm;
    Ok(rd)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn g(code: &str, maker: Option<f64>, taker: Option<f64>, commission: f64) -> GroupSettings {
        GroupSettings { group_code: code.into(), maker_fee_per_contract: maker, taker_fee_per_contract: taker, commission_per_contract: commission, ..GroupSettings::builtin("kalks") }
    }

    #[test]
    fn book_fees_fall_back_like_the_engine() {
        assert_eq!(g("*", Some(-0.05), Some(0.25), 0.25).book_fees(), (-0.05, 0.25));
        assert_eq!(g("vip", None, None, 0.1).book_fees(), (0.1, 0.1), "no fee set = the commission on both sides");
        assert_eq!(g("x", Some(0.02), Some(-1.0), 0.1).book_fees(), (0.02, 0.0), "a taker fee is never negative");
    }

    #[test]
    fn fee_rule_min_taker_covers_max_rebate() {
        let rows = |v: &[GroupSettings]| v.iter().map(|g| (g.group_code.clone(), g.book_fees().0, g.book_fees().1)).collect::<Vec<_>>();
        assert_eq!(fee_rule_violation(&rows(&[g("*", Some(-0.05), Some(0.25), 0.25)])), None);
        assert_eq!(fee_rule_violation(&rows(&[g("*", Some(-0.25), Some(0.25), 0.25)])), None, "equal is fine");
        // a cheap taker row elsewhere breaks a rebate
        let bad = rows(&[g("*", Some(-0.05), Some(0.25), 0.25), g("vip", Some(0.0), Some(0.03), 0.1)]);
        let msg = fee_rule_violation(&bad).unwrap();
        assert!(msg.contains("0.03") && msg.contains("vip") && msg.contains("0.05"), "{msg}");
        // a row without fees falls back to its commission as taker
        assert!(fee_rule_violation(&rows(&[g("*", Some(-0.2), Some(0.25), 0.25), g("cheap", None, None, 0.1)])).is_some());
        // no rebate anywhere: nothing to cover
        assert_eq!(fee_rule_violation(&rows(&[g("*", Some(0.1), Some(0.0), 0.0)])), None);
        assert_eq!(fee_rule_violation(&[]), None);
    }

    #[test]
    fn mm_settings_most_specific_row_wins() {
        let row = |t: &str, k: &str, u: &str, base: f64| MmSettings { tenant: t.into(), kind: k.into(), underlying: u.into(), base_size: base, ..MmSettings::builtin() };
        let rows = vec![row("*", "*", "*", 10.0), row("*", "demo", "*", 25.0), row("*", "*", "UKOIL", 5.0), row("kalks", "live", "XAUUSD", 3.0), row("other", "*", "*", 7.0)];
        assert_eq!(resolve_mm(&rows, "kalks", "live", "EURUSD").base_size, 10.0);
        assert_eq!(resolve_mm(&rows, "kalks", "demo", "EURUSD").base_size, 25.0);
        assert_eq!(resolve_mm(&rows, "kalks", "live", "UKOIL").base_size, 5.0);
        assert_eq!(resolve_mm(&rows, "kalks", "demo", "UKOIL").base_size, 25.0, "kind (2) outranks underlying (1)");
        assert_eq!(resolve_mm(&rows, "kalks", "live", "XAUUSD").base_size, 3.0);
        assert_eq!(resolve_mm(&rows, "other", "demo", "UKOIL").base_size, 7.0, "tenant (4) outranks the rest");
        assert_eq!(resolve_mm(&[], "kalks", "live", "EURUSD"), MmSettings::builtin());
        let j = serde_json::to_value(MmSettings::builtin()).unwrap();
        for k in ["spreadVol0dte", "spreadVol7d", "spreadVol30d", "spreadVolLong", "minSpreadTicks", "skewVol", "skewTicksPerContract", "baseSize", "maxNetDelta", "maxGamma", "maxVega", "maxContractsPerSeries", "enabled", "tenant", "kind", "underlying"] {
            assert!(j.get(k).is_some(), "{k}: {j}");
        }
    }

    #[test]
    fn premium_tick_defaults_and_steps() {
        assert_eq!(default_premium_tick("forex", "EURUSD", 0.0001), 0.00001);
        assert_eq!(default_premium_tick("forex", "USDJPY", 0.01), 0.001);
        assert_eq!(default_premium_tick("metals", "XAUUSD", 0.01), 0.01);
        assert_eq!(default_premium_tick("metals", "XAGUSD", 0.001), 0.001);
        assert_eq!(default_premium_tick("energies", "USOIL", 0.01), 0.001);
        assert!(is_multiple(10.0, 1.0) && is_multiple(0.3, 0.1) && !is_multiple(1.5, 1.0) && !is_multiple(1.0, 0.0));
    }
}

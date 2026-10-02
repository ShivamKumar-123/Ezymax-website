//! The options service snapshot (`GET /v1/internal/options/snapshot`, services/options/README.md) parsed into
//! lookup tables, plus the dealing rules the engine applies from it: module switches, group settings, controls,
//! client limits and the trade state of a series. Everything here is pure (no IO, no clock).

use chrono::{DateTime, NaiveDate, Utc};
use optmath::calendar::HolidayCalendar;
use optmath::term::{TenorQuotes, VolSurface};
use optmath::{Date, SmileQuotes, VolClock};
use serde::Deserialize;
use std::collections::HashMap;

/// Platform tenant: its settings are the fallback of every broker (group resolution).
pub const PLATFORM_TENANT: &str = "kalks";

fn d300() -> u64 {
    300
}
fn d15() -> i32 {
    15
}
fn d1() -> i32 {
    1
}
fn d_one() -> f64 {
    1.0
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Underlying {
    pub symbol: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_ccy: String,
    #[serde(default)]
    pub quote_ccy: String,
    #[serde(default)]
    pub calendar_codes: Vec<String>,
    #[serde(default)]
    pub calendars: Vec<String>,
    pub contract_size: f64,
    #[serde(default)]
    pub contract_unit: String,
    #[serde(default)]
    pub digits: i32,
    #[serde(default)]
    pub pip_size: f64,
    #[serde(default)]
    pub strike_step: f64,
    #[serde(default)]
    pub cut_time: String,
    #[serde(default)]
    pub cut_zone: String,
    #[serde(default = "d15")]
    pub no_open_minutes: i32,
    #[serde(default = "d1")]
    pub close_only_minutes: i32,
    #[serde(default)]
    pub delta_convention: String,
    #[serde(default)]
    pub weekend_vol_weight: f64,
    #[serde(default)]
    pub holiday_vol_weight: f64,
    #[serde(default)]
    pub price_scan: f64,
    #[serde(default)]
    pub vol_scan: f64,
    #[serde(default)]
    pub extreme_multiple: f64,
    #[serde(default)]
    pub extreme_cover: f64,
    #[serde(default = "d_one")]
    pub min_contracts: f64,
    #[serde(default)]
    pub max_contracts: f64,
    #[serde(default = "d_one")]
    pub contract_step: f64,
    #[serde(default)]
    pub barriers_enabled: bool,
    #[serde(default)]
    pub enabled: bool,
}

impl Underlying {
    pub fn clock(&self) -> VolClock {
        VolClock::new(self.weekend_vol_weight, self.holiday_vol_weight)
    }
    /// Calendars that must all be open on an expiry (the snapshot's `calendarCodes`, else the configured
    /// calendars plus USD).
    pub fn codes(&self) -> Vec<String> {
        let mut v = if self.calendar_codes.is_empty() { self.calendars.clone() } else { self.calendar_codes.clone() };
        if !v.iter().any(|c| c == "USD") {
            v.push("USD".into());
        }
        v.sort();
        v.dedup();
        v
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rate {
    pub ccy: String,
    pub rate: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pillar {
    #[serde(default)]
    pub tenor: String,
    pub days: f64,
    pub atm: f64,
    #[serde(default)]
    pub rr25: f64,
    #[serde(default)]
    pub bf25: f64,
    #[serde(default)]
    pub rr10: Option<f64>,
    #[serde(default)]
    pub bf10: Option<f64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Surface {
    pub symbol: String,
    #[serde(default)]
    pub version: i32,
    #[serde(default)]
    pub blend_weight: f64,
    #[serde(default)]
    pub pillars: Vec<Pillar>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Realized {
    pub symbol: String,
    pub value: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Expiry {
    pub id: i64,
    pub symbol: String,
    pub expiry_date: NaiveDate,
    pub cut_at: DateTime<Utc>,
    #[serde(default)]
    pub twap_start: Option<DateTime<Utc>>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub fixing: Option<f64>,
    #[serde(default)]
    pub fixing_source: Option<String>,
    #[serde(default)]
    pub fixing_run: i32,
    #[serde(default)]
    pub fixed_at: Option<DateTime<Utc>>,
}

impl Expiry {
    pub fn key(&self) -> String {
        format!("{}:{}", self.symbol, self.expiry_date)
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Series {
    pub code: String,
    pub symbol: String,
    pub expiry_id: i64,
    pub strike: f64,
    #[serde(default)]
    pub strike_ticks: i64,
    pub kind: String,
    #[serde(default)]
    pub status: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantSettings {
    pub tenant: String,
    #[serde(default)]
    pub enabled_demo: bool,
    #[serde(default)]
    pub enabled_live: bool,
    #[serde(default)]
    pub underlyings: Option<Vec<String>>,
}

impl TenantSettings {
    pub fn allows(&self, symbol: &str) -> bool {
        self.underlyings.as_ref().is_none_or(|u| u.iter().any(|s| s == symbol))
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupSettings {
    pub tenant: String,
    pub group_code: String,
    pub symbol: String,
    #[serde(default)]
    pub vol_spread: f64,
    #[serde(default)]
    pub min_spread_usd: f64,
    #[serde(default)]
    pub commission_per_contract: f64,
    #[serde(default)]
    pub commission_cap_pct: f64,
    #[serde(default)]
    pub max_contracts_per_client: f64,
    #[serde(default)]
    pub weekend_margin_pct: f64,
    #[serde(default = "yes")]
    pub enabled: bool,
}

fn yes() -> bool {
    true
}

impl GroupSettings {
    /// The options service's built-in defaults (a tenant without any row).
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
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Control {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub tenant: String,
    pub scope: String,
    #[serde(default)]
    pub target: String,
    pub mode: String,
    #[serde(default)]
    pub manual_vol: Option<f64>,
    #[serde(default)]
    pub frozen_spot: Option<f64>,
    #[serde(default)]
    pub reason: String,
    #[serde(default = "yes")]
    pub active: bool,
    #[serde(default)]
    pub expires_at: Option<DateTime<Utc>>,
}

impl Control {
    fn applies(&self, tenant: &str, symbol: &str, expiry_key: &str, code: Option<&str>, now: DateTime<Utc>) -> bool {
        self.active
            && self.expires_at.is_none_or(|e| e > now)
            && (self.tenant == "*" || self.tenant == tenant)
            && match self.scope.as_str() {
                "all" => true,
                "underlying" => self.target == symbol,
                "expiry" => self.target == expiry_key,
                "series" => code.is_some_and(|c| c == self.target),
                _ => false,
            }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientLimit {
    pub tenant: String,
    pub user_id: i64,
    #[serde(default)]
    pub max_contracts: Option<f64>,
    #[serde(default)]
    pub max_short_contracts: Option<f64>,
    #[serde(default)]
    pub close_only: bool,
    #[serde(default)]
    pub blocked: bool,
    #[serde(default)]
    pub reason: String,
}

/// The snapshot as sent by the options service.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawSnapshot {
    pub version: i64,
    #[serde(default)]
    pub generated_at: Option<DateTime<Utc>>,
    #[serde(default = "d300")]
    pub stale_after_secs: u64,
    #[serde(default)]
    pub underlyings: Vec<Underlying>,
    #[serde(default)]
    pub rates: Vec<Rate>,
    #[serde(default)]
    pub holidays: HashMap<String, Vec<NaiveDate>>,
    #[serde(default)]
    pub surfaces: Vec<Surface>,
    #[serde(default)]
    pub realized_vol: Vec<Realized>,
    #[serde(default)]
    pub expiries: Vec<Expiry>,
    #[serde(default)]
    pub series: Vec<Series>,
    #[serde(default)]
    pub tenants: Vec<TenantSettings>,
    #[serde(default)]
    pub groups: Vec<GroupSettings>,
    #[serde(default)]
    pub controls: Vec<Control>,
    #[serde(default)]
    pub client_limits: Vec<ClientLimit>,
}

/// Effective dealing state of a series for one tenant (same rules as the options service).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TradeState {
    Open,
    CloseOnly,
    Halted,
    /// From `cutAt - closeOnlyMinutes`, or the expiry is no longer listed.
    Closed,
}

impl TradeState {
    pub fn as_str(self) -> &'static str {
        match self {
            TradeState::Open => "open",
            TradeState::CloseOnly => "close_only",
            TradeState::Halted => "halted",
            TradeState::Closed => "closed",
        }
    }
}

/// A vol surface ready to interpolate (None when the stored pillars do not validate).
#[derive(Clone, Debug)]
pub struct SurfaceIn {
    pub blend_weight: f64,
    pub surface: Option<VolSurface>,
}

/// The parsed snapshot: lookup tables over the raw lists.
#[derive(Clone, Debug)]
pub struct OptSnapshot {
    pub version: i64,
    pub stale_after_secs: u64,
    pub underlyings: HashMap<String, Underlying>,
    pub rates: HashMap<String, f64>,
    /// Pair calendar per underlying (union of its calendar codes).
    pub pair_calendars: HashMap<String, HolidayCalendar>,
    pub surfaces: HashMap<String, SurfaceIn>,
    pub realized: HashMap<String, f64>,
    pub expiries: Vec<Expiry>,
    /// (symbol, date) → index in `expiries`.
    expiry_idx: HashMap<(String, NaiveDate), usize>,
    expiry_by_id: HashMap<i64, usize>,
    pub series: HashMap<String, Series>,
    pub tenants: HashMap<String, TenantSettings>,
    pub groups: Vec<GroupSettings>,
    pub controls: Vec<Control>,
    pub limits: Vec<ClientLimit>,
}

fn to_date(d: NaiveDate) -> Option<Date> {
    Date::parse(&d.to_string())
}

/// Same validation as the options service (`build_surface`): sorted by days, t = days / 365.
pub fn build_surface(pillars: &[Pillar]) -> Option<VolSurface> {
    let mut p = pillars.to_vec();
    p.sort_by(|a, b| a.days.total_cmp(&b.days));
    if p.is_empty() || p.iter().any(|x| !(x.days > 0.0 && x.atm > 0.001 && x.atm < 3.0) || x.rr10.is_some() != x.bf10.is_some()) {
        return None;
    }
    VolSurface::new(p.iter().map(|x| TenorQuotes { t: x.days / 365.0, quotes: SmileQuotes { atm: x.atm, rr25: x.rr25, bf25: x.bf25, rr10: x.rr10, bf10: x.bf10 } }).collect()).ok()
}

impl OptSnapshot {
    pub fn parse(raw: RawSnapshot) -> OptSnapshot {
        let mut cals: HashMap<String, HolidayCalendar> = HashMap::new();
        for (cal, days) in &raw.holidays {
            cals.insert(cal.clone(), HolidayCalendar::new(days.iter().filter_map(|d| to_date(*d))));
        }
        let mut pair_calendars = HashMap::new();
        for u in &raw.underlyings {
            let codes = u.codes();
            pair_calendars.insert(u.symbol.clone(), HolidayCalendar::union(codes.iter().filter_map(|c| cals.get(c))));
        }
        let surfaces = raw.surfaces.iter().map(|s| (s.symbol.clone(), SurfaceIn { blend_weight: s.blend_weight, surface: build_surface(&s.pillars) })).collect();
        let realized = raw.realized_vol.iter().filter(|r| r.value > 0.0 && r.value < 5.0).map(|r| (r.symbol.clone(), r.value)).collect();
        let expiry_idx = raw.expiries.iter().enumerate().map(|(i, e)| ((e.symbol.clone(), e.expiry_date), i)).collect();
        let expiry_by_id = raw.expiries.iter().enumerate().map(|(i, e)| (e.id, i)).collect();
        OptSnapshot {
            version: raw.version,
            stale_after_secs: raw.stale_after_secs.max(1),
            underlyings: raw.underlyings.into_iter().map(|u| (u.symbol.clone(), u)).collect(),
            rates: raw.rates.into_iter().map(|r| (r.ccy, r.rate)).collect(),
            pair_calendars,
            surfaces,
            realized,
            expiries: raw.expiries,
            expiry_idx,
            expiry_by_id,
            series: raw.series.into_iter().map(|s| (s.code.clone(), s)).collect(),
            tenants: raw.tenants.into_iter().map(|t| (t.tenant.clone(), t)).collect(),
            groups: raw.groups,
            controls: raw.controls,
            limits: raw.client_limits,
        }
    }

    pub fn from_json(v: serde_json::Value) -> anyhow::Result<OptSnapshot> {
        Ok(Self::parse(serde_json::from_value(v)?))
    }

    pub fn underlying(&self, symbol: &str) -> Option<&Underlying> {
        self.underlyings.get(symbol)
    }

    pub fn rate(&self, ccy: &str) -> f64 {
        self.rates.get(ccy).copied().unwrap_or(0.0)
    }

    pub fn pair_calendar(&self, symbol: &str) -> HolidayCalendar {
        self.pair_calendars.get(symbol).cloned().unwrap_or_default()
    }

    pub fn expiry(&self, symbol: &str, date: NaiveDate) -> Option<&Expiry> {
        self.expiry_idx.get(&(symbol.to_string(), date)).map(|i| &self.expiries[*i])
    }

    pub fn expiry_by_id(&self, id: i64) -> Option<&Expiry> {
        self.expiry_by_id.get(&id).map(|i| &self.expiries[*i])
    }

    /// Module switch for an account kind (a tenant without a row is OFF).
    pub fn enabled(&self, tenant: &str, live: bool) -> bool {
        self.tenants.get(tenant).is_some_and(|t| if live { t.enabled_live } else { t.enabled_demo })
    }

    pub fn tenant_allows(&self, tenant: &str, symbol: &str) -> bool {
        self.tenants.get(tenant).is_some_and(|t| t.allows(symbol))
    }

    /// Group settings: (group, symbol) > (group, *) > (*, symbol) > (*, *) > tenant kalks (*, *) > built-in.
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

    pub fn client_limit(&self, tenant: &str, user_id: i64) -> Option<&ClientLimit> {
        self.limits.iter().find(|l| l.tenant == tenant && l.user_id == user_id)
    }

    fn controls_for<'a>(&'a self, tenant: &'a str, symbol: &'a str, expiry_key: &'a str, code: Option<&'a str>, now: DateTime<Utc>) -> impl Iterator<Item = &'a Control> + 'a {
        self.controls.iter().filter(move |c| c.applies(tenant, symbol, expiry_key, code, now))
    }

    /// Dealing state of a series: closed from the cut minus `closeOnlyMinutes` (or when the expiry is not listed),
    /// halted / close-only by a control, close-only from the cut minus `noOpenMinutes`.
    pub fn trade_state(&self, tenant: &str, u: &Underlying, expiry: NaiveDate, cut_at: DateTime<Utc>, code: Option<&str>, now: DateTime<Utc>) -> TradeState {
        let listed = self.expiry(&u.symbol, expiry).is_some_and(|e| e.status == "listed");
        if !listed || now >= cut_at - chrono::Duration::minutes(u.close_only_minutes.max(0) as i64) {
            return TradeState::Closed;
        }
        let key = format!("{}:{expiry}", u.symbol);
        let mut st = TradeState::Open;
        for c in self.controls_for(tenant, &u.symbol, &key, code, now) {
            match c.mode.as_str() {
                "halt" => return TradeState::Halted,
                "close_only" => st = TradeState::CloseOnly,
                _ => {}
            }
        }
        if now >= cut_at - chrono::Duration::minutes(u.no_open_minutes.max(0) as i64) {
            st = TradeState::CloseOnly;
        }
        st
    }

    /// The reason text of the control that halts / restricts a series (for messages).
    pub fn control_reason(&self, tenant: &str, symbol: &str, expiry_key: &str, code: Option<&str>, mode: &str, now: DateTime<Utc>) -> Option<String> {
        self.controls_for(tenant, symbol, expiry_key, code, now).filter(|c| c.mode == mode).map(|c| c.reason.clone()).find(|r| !r.trim().is_empty())
    }

    /// Manual ATM vol / frozen spot for an expiry (the most recent control wins).
    pub fn overrides(&self, tenant: &str, symbol: &str, expiry_key: &str, now: DateTime<Utc>) -> (Option<f64>, Option<f64>) {
        let mut vol: Option<(i64, f64)> = None;
        let mut spot: Option<(i64, f64)> = None;
        for c in self.controls_for(tenant, symbol, expiry_key, None, now) {
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn snap() -> OptSnapshot {
        OptSnapshot::from_json(json!({
            "version": 3, "staleAfterSecs": 120,
            "underlyings": [{"symbol": "EURUSD", "model": "gk", "baseCcy": "EUR", "quoteCcy": "USD", "calendarCodes": ["EUR", "USD"], "contractSize": 10000,
                             "digits": 5, "pipSize": 0.0001, "cutTime": "10:00", "cutZone": "America/New_York", "noOpenMinutes": 15, "closeOnlyMinutes": 1,
                             "enabled": true}],
            "holidays": {"USD": ["2026-12-25"], "EUR": ["2026-12-25", "2026-12-26"]},
            "expiries": [{"id": 1, "symbol": "EURUSD", "expiryDate": "2026-10-09", "cutAt": "2026-10-09T14:00:00Z", "status": "listed"}],
            "tenants": [{"tenant": "kalks", "enabledDemo": true, "enabledLive": false}],
            "groups": [{"tenant": "kalks", "groupCode": "*", "symbol": "*", "volSpread": 0.004, "minSpreadUsd": 0.5, "commissionPerContract": 0.25, "commissionCapPct": 10},
                       {"tenant": "kalks", "groupCode": "vip", "symbol": "*", "volSpread": 0.002}],
            "controls": [{"id": 5, "tenant": "*", "scope": "expiry", "target": "EURUSD:2026-10-09", "mode": "manual_vol", "manualVol": 0.09},
                         {"id": 6, "tenant": "other", "scope": "all", "mode": "halt"}],
        }))
        .unwrap()
    }

    fn t(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn module_switch_group_resolution_and_trade_state() {
        let s = snap();
        assert!(s.enabled("kalks", false) && !s.enabled("kalks", true) && !s.enabled("broker2", false));
        assert_eq!(s.group("kalks", "vip", "EURUSD").vol_spread, 0.002);
        assert_eq!(s.group("kalks", "standard", "EURUSD").vol_spread, 0.004);
        // another broker without rows falls back to the platform's (*, *)
        assert_eq!(s.group("broker2", "standard", "EURUSD").commission_cap_pct, 10.0);
        assert_eq!(s.pair_calendar("EURUSD").len(), 2);
        let u = s.underlying("EURUSD").unwrap();
        let cut = t("2026-10-09T14:00:00Z");
        let d = NaiveDate::from_ymd_opt(2026, 10, 9).unwrap();
        assert_eq!(s.trade_state("kalks", u, d, cut, None, t("2026-10-09T13:44:00Z")), TradeState::Open);
        assert_eq!(s.trade_state("kalks", u, d, cut, None, t("2026-10-09T13:45:00Z")), TradeState::CloseOnly);
        assert_eq!(s.trade_state("kalks", u, d, cut, None, t("2026-10-09T13:59:00Z")), TradeState::Closed);
        // the halt is for another broker only
        assert_eq!(s.trade_state("other", u, d, cut, None, t("2026-10-09T10:00:00Z")), TradeState::Halted);
        assert_eq!(s.overrides("kalks", "EURUSD", "EURUSD:2026-10-09", t("2026-10-09T10:00:00Z")).0, Some(0.09));
        // unknown expiry = closed
        assert_eq!(s.trade_state("kalks", u, NaiveDate::from_ymd_opt(2026, 10, 16).unwrap(), cut, None, t("2026-10-09T10:00:00Z")), TradeState::Closed);
    }
}

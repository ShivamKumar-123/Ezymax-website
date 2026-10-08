//! Pure programme maths (no IO): deal qualification, multi-tier commission lines with rebates and sub-IB
//! splits, level evaluation, wash-trade matching and payout periods. Everything here is unit tested.

use crate::model::{Level, Settings};
use crate::money::{D, HUNDRED, ZERO, r2, r4};
use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Utc};

/// A closed deal as the programme sees it.
#[derive(Clone, Debug)]
pub struct DealFacts {
    /// `live` | `demo`
    pub account_kind: String,
    pub group: String,
    pub cent: bool,
    /// Engine deal kind: close | partial | force | stop-out | price-correction
    pub kind: String,
    pub reversed: bool,
    /// CFD: lots. Option deal: contracts.
    pub volume: D,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
    /// Ezymex FX Options deal (O34): volume is contracts, paid per contract at the level's options rate.
    pub option: bool,
}

/// Standard lots of a deal (cent accounts scaled by `cent_lot_factor`). Option contracts are never lots: an
/// option deal has 0 lots, so it never adds to lot statistics or the lot-based level-upgrade volume.
pub fn std_lots(f: &DealFacts, s: &Settings) -> D {
    if f.option {
        return ZERO;
    }
    r4(if f.cent { f.volume * s.cent_lot_factor } else { f.volume })
}

/// Option contracts of a deal (0 for CFDs). A contract has the same USD notional on a cent account (only the
/// premium is booked in USC), so contracts are never scaled.
pub fn contracts(f: &DealFacts) -> D {
    if f.option { r4(f.volume) } else { ZERO }
}

/// What the commission is paid on: standard lots (CFD per-lot rates) or contracts (the options rate).
pub fn commission_units(f: &DealFacts, s: &Settings) -> D {
    if f.option { contracts(f) } else { std_lots(f, s) }
}

/// Why a deal does not earn commission, or `None` when it qualifies on its own facts.
/// (Client-side checks — referrer, self-referral — are done by the caller.)
/// Trading-engine system groups whose deals never earn commission, whatever the settings say: `mam` is the
/// MAM master account of a multi-account manager. Its block trades are allocated onto the linked client
/// accounts and those deals are counted for the clients; counting the block as well would pay the volume twice.
/// `pamm` is a PAMM fund account: the engine pushes each closed fund deal split by unit share per investor
/// (source `pamm`), so the fund account's own deal is not counted either.
pub const SYSTEM_EXCLUDED_GROUPS: &[&str] = &["mam", "pamm"];

pub fn disqualify(f: &DealFacts, s: &Settings) -> Option<&'static str> {
    if f.account_kind != "live" {
        return Some("demo");
    }
    if SYSTEM_EXCLUDED_GROUPS.iter().any(|g| g.eq_ignore_ascii_case(&f.group)) {
        return Some(if f.group.eq_ignore_ascii_case("pamm") { "pamm_fund" } else { "mam_master" });
    }
    if s.excluded_groups.iter().any(|g| g.eq_ignore_ascii_case(&f.group)) {
        return Some("excluded_group");
    }
    if f.reversed {
        return Some("reversed");
    }
    if f.kind == "price-correction" {
        return Some("price_correction");
    }
    if f.volume <= ZERO {
        return Some("no_volume");
    }
    if (f.close_time - f.open_time).num_seconds() < s.min_trade_seconds {
        return Some("short_duration");
    }
    None
}

/// One upline IB for a deal: tier 1 = the client's direct IB.
#[derive(Clone, Debug)]
pub struct Upline {
    pub user_id: i64,
    pub level_key: String,
    /// USD per lot for the deal's symbol group at this IB's level.
    pub rate: D,
    pub rebate_pct: D,
    pub split_pct: D,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Copy)]
pub enum LineKind {
    Lot,
    Split,
    Rebate,
}

impl LineKind {
    pub fn as_str(self) -> &'static str {
        match self {
            LineKind::Lot => "lot",
            LineKind::Split => "split",
            LineKind::Rebate => "rebate",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Line {
    pub beneficiary: i64,
    pub kind: LineKind,
    /// Tier the amount was earned at (a split carries the tier of the IB that gave it).
    pub tier: i32,
    pub level_key: Option<String>,
    pub rate: D,
    pub share_pct: D,
    pub amount: D,
}

/// Multi-tier commission for one qualifying deal (D54, D55, D60).
///
/// - Tier *k* IB earns `lots × rate(level of that IB, symbol group) × tiers[k]%`, rounded to cents.
/// - Sub-IB split: an IB at tier *k ≥ 2* passes `split_pct` of its own tier amount to the IB directly below it
///   in this chain (tier *k − 1*). It can only give from what it earns ("within its own rate").
/// - Rebate: the tier-1 IB returns `rebate_pct` of its tier-1 amount to the trading client.
/// - Percentages are capped by the programme maximums. Suspended IBs earn nothing and give nothing.
///
/// The sum of all lines always equals the sum of the rounded tier amounts: splits and rebates only move money
/// between lines.
pub fn commission_lines(client_id: i64, lots: D, chain: &[Upline], tiers: &[D], max_rebate_pct: D, max_split_pct: D) -> Vec<Line> {
    let n = chain.len().min(tiers.len());
    let mut kept: Vec<D> = (0..n).map(|i| if chain[i].active { r2(lots * chain[i].rate * tiers[i] / HUNDRED) } else { ZERO }).collect();
    let mut out = Vec::new();
    // splits, from the top of the chain down
    for i in (1..n).rev() {
        let pct = chain[i].split_pct.clamp(ZERO, max_split_pct);
        if pct <= ZERO || kept[i] <= ZERO || !chain[i - 1].active {
            continue;
        }
        let s = r2(kept[i] * pct / HUNDRED);
        if s <= ZERO {
            continue;
        }
        kept[i] -= s;
        out.push(Line { beneficiary: chain[i - 1].user_id, kind: LineKind::Split, tier: (i + 1) as i32, level_key: Some(chain[i].level_key.clone()), rate: chain[i].rate, share_pct: pct, amount: s });
    }
    // client rebate from the tier-1 amount
    if n > 0 && chain[0].active && kept[0] > ZERO {
        let pct = chain[0].rebate_pct.clamp(ZERO, max_rebate_pct);
        let r = r2(kept[0] * pct / HUNDRED);
        if r > ZERO {
            kept[0] -= r;
            out.push(Line { beneficiary: client_id, kind: LineKind::Rebate, tier: 1, level_key: Some(chain[0].level_key.clone()), rate: chain[0].rate, share_pct: pct, amount: r });
        }
    }
    for i in 0..n {
        if kept[i] > ZERO {
            out.push(Line { beneficiary: chain[i].user_id, kind: LineKind::Lot, tier: (i + 1) as i32, level_key: Some(chain[i].level_key.clone()), rate: chain[i].rate, share_pct: tiers[i], amount: kept[i] });
        }
    }
    out.sort_by_key(|l| (l.tier, l.kind != LineKind::Lot));
    out
}

/// The highest level whose targets are both met (levels in any order; rank 1 always qualifies).
pub fn eligible_level<'a>(levels: &'a [Level], active_clients: i64, lots: D) -> Option<&'a Level> {
    levels
        .iter()
        .filter(|l| l.rank == 1 || (active_clients >= l.min_active_clients as i64 && lots >= l.min_monthly_lots))
        .max_by_key(|l| l.rank)
}

/// The level after `current` (by rank), if any.
pub fn next_level<'a>(levels: &'a [Level], current: &str) -> Option<&'a Level> {
    let rank = levels.iter().find(|l| l.key == current).map(|l| l.rank).unwrap_or(1);
    levels.iter().filter(|l| l.rank > rank).min_by_key(|l| l.rank)
}

/// Monthly evaluation outcome for one IB.
pub fn evaluate_level(levels: &[Level], current: &str, locked: bool, allow_demotion: bool, active_clients: i64, lots: D) -> Option<String> {
    if locked {
        return None;
    }
    let target = eligible_level(levels, active_clients, lots)?;
    let cur_rank = levels.iter().find(|l| l.key == current).map(|l| l.rank).unwrap_or(0);
    if target.rank > cur_rank || (allow_demotion && target.rank < cur_rank) || cur_rank == 0 {
        (target.key != current).then(|| target.key.clone())
    } else {
        None
    }
}

/// A trade of another client in the same network, for wash-trade matching.
#[derive(Clone, Debug)]
pub struct TradeLite {
    pub user_id: i64,
    pub side: String,
    pub volume: D,
    pub open_time: DateTime<Utc>,
    pub close_time: DateTime<Utc>,
}

/// Opposite side, similar volume, opened and closed within the window of each other: a mirrored pair.
pub fn is_wash_pair(a: &TradeLite, b: &TradeLite, window_secs: i64, tolerance_pct: D) -> bool {
    if a.user_id == b.user_id || a.side == b.side {
        return false;
    }
    let near = |x: DateTime<Utc>, y: DateTime<Utc>| (x - y).num_seconds().abs() <= window_secs;
    if !near(a.open_time, b.open_time) || !near(a.close_time, b.close_time) {
        return false;
    }
    let big = a.volume.max(b.volume);
    big > ZERO && (a.volume - b.volume).abs() * HUNDRED / big <= tolerance_pct
}

/// Closing instant of the payout period that contains `now` has passed: returns the most recent period end
/// at or before `now` (UTC midnight) and the period start.
pub fn last_period(schedule: &str, weekday: u32, month_day: u32, now: DateTime<Utc>) -> (DateTime<Utc>, DateTime<Utc>) {
    let midnight = |d: NaiveDate| Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap());
    let today = now.date_naive();
    match schedule {
        "daily" => {
            let end = midnight(today);
            (end - Duration::days(1), end)
        }
        "monthly" => {
            let this = NaiveDate::from_ymd_opt(today.year(), today.month(), month_day).unwrap();
            let end_d = if this <= today { this } else { shift_month(this, -1) };
            (midnight(shift_month(end_d, -1)), midnight(end_d))
        }
        _ => {
            let wd = today.weekday().number_from_monday();
            let back = (wd + 7 - weekday) % 7;
            let end = midnight(today - Duration::days(back as i64));
            (end - Duration::days(7), end)
        }
    }
}

fn shift_month(d: NaiveDate, by: i32) -> NaiveDate {
    let m0 = d.year() * 12 + d.month0() as i32 + by;
    NaiveDate::from_ymd_opt(m0.div_euclid(12), m0.rem_euclid(12) as u32 + 1, d.day().min(28)).unwrap()
}

/// First instant of the calendar month containing `t`, and of the next month.
pub fn month_bounds(t: DateTime<Utc>) -> (DateTime<Utc>, DateTime<Utc>) {
    let d = NaiveDate::from_ymd_opt(t.year(), t.month(), 1).unwrap();
    let start = Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap());
    let next = Utc.from_utc_datetime(&shift_month(d, 1).and_hms_opt(0, 0, 0).unwrap());
    (start, next)
}

/// Payout retry backoff: 1, 2, 4 … minutes, capped at an hour.
pub fn backoff_secs(attempts: i32) -> i64 {
    60 * (1i64 << attempts.clamp(0, 6)).min(60)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::default_levels;
    use crate::money::dec;

    fn up(id: i64, rate: &str, rebate: &str, split: &str) -> Upline {
        Upline { user_id: id, level_key: "bronze".into(), rate: dec(rate), rebate_pct: dec(rebate), split_pct: dec(split), active: true }
    }
    fn tiers() -> Vec<D> {
        vec![dec("100"), dec("20"), dec("10")]
    }
    fn total(ls: &[Line]) -> D {
        ls.iter().map(|l| l.amount).sum()
    }
    fn amount(ls: &[Line], who: i64, k: LineKind) -> D {
        ls.iter().filter(|l| l.beneficiary == who && l.kind == k).map(|l| l.amount).sum()
    }

    #[test]
    fn single_tier_per_lot() {
        let ls = commission_lines(9, dec("2.5"), &[up(1, "8", "0", "0")], &tiers(), dec("50"), dec("50"));
        assert_eq!(ls.len(), 1);
        assert_eq!(ls[0].amount, dec("20"));
        assert_eq!(ls[0].tier, 1);
        assert_eq!(ls[0].kind, LineKind::Lot);
    }

    #[test]
    fn three_tiers_with_shares() {
        // XAUUSD 1.5 lots: IB1 silver $10, IB2 gold $12, IB3 bronze $8
        let chain = [up(1, "10", "0", "0"), up(2, "12", "0", "0"), up(3, "8", "0", "0"), up(4, "99", "0", "0")];
        let ls = commission_lines(9, dec("1.5"), &chain, &tiers(), dec("50"), dec("50"));
        assert_eq!(amount(&ls, 1, LineKind::Lot), dec("15"));
        assert_eq!(amount(&ls, 2, LineKind::Lot), dec("3.6")); // 1.5 × 12 × 20%
        assert_eq!(amount(&ls, 3, LineKind::Lot), dec("1.2")); // 1.5 × 8 × 10%
        assert!(ls.iter().all(|l| l.beneficiary != 4), "only N tiers are paid");
    }

    #[test]
    fn rebate_and_split_stay_within_own_amount() {
        // IB1 rebates 15% to the client; IB2 splits 25% of its tier-2 amount to IB1.
        let chain = [up(1, "10", "15", "0"), up(2, "10", "0", "25")];
        let ls = commission_lines(9, dec("10"), &chain, &tiers(), dec("50"), dec("50"));
        // tier1 = 100, tier2 = 20
        assert_eq!(amount(&ls, 9, LineKind::Rebate), dec("15"));
        assert_eq!(amount(&ls, 1, LineKind::Lot), dec("85"));
        assert_eq!(amount(&ls, 1, LineKind::Split), dec("5"));
        assert_eq!(amount(&ls, 2, LineKind::Lot), dec("15"));
        assert_eq!(total(&ls), dec("120"));
    }

    #[test]
    fn percentages_are_capped() {
        let chain = [up(1, "10", "90", "0"), up(2, "10", "0", "100")];
        let ls = commission_lines(9, dec("1"), &chain, &tiers(), dec("50"), dec("40"));
        assert_eq!(amount(&ls, 9, LineKind::Rebate), dec("5"));
        assert_eq!(amount(&ls, 1, LineKind::Split), dec("0.8"));
        assert_eq!(amount(&ls, 2, LineKind::Lot), dec("1.2"));
    }

    #[test]
    fn suspended_ib_earns_nothing_and_rounding_is_conserved() {
        let mut chain = vec![up(1, "7", "33.33", "0"), up(2, "9", "0", "33.33"), up(3, "13.5", "0", "0")];
        chain[2].active = false;
        let ls = commission_lines(9, dec("0.37"), &chain, &tiers(), dec("50"), dec("50"));
        assert!(ls.iter().all(|l| l.beneficiary != 3));
        let gross = r2(dec("0.37") * dec("7")) + r2(dec("0.37") * dec("9") * dec("0.2"));
        assert_eq!(total(&ls), gross);
        assert!(ls.iter().all(|l| l.amount > ZERO));
    }

    #[test]
    fn tiny_deals_round_to_nothing() {
        let ls = commission_lines(9, dec("0.0001"), &[up(1, "5", "10", "0")], &tiers(), dec("50"), dec("50"));
        assert!(ls.is_empty());
    }

    fn facts(kind: &str, secs: i64) -> DealFacts {
        let t = Utc::now();
        DealFacts { account_kind: kind.into(), group: "standard".into(), cent: false, kind: "close".into(), reversed: false, volume: dec("1"), open_time: t - Duration::seconds(secs), close_time: t, option: false }
    }

    #[test]
    fn anti_abuse_filters() {
        let s = Settings::default();
        assert_eq!(disqualify(&facts("live", 600), &s), None);
        assert_eq!(disqualify(&facts("demo", 600), &s), Some("demo"));
        assert_eq!(disqualify(&facts("live", 119), &s), Some("short_duration"));
        assert_eq!(disqualify(&facts("live", 120), &s), None);
        let mut f = facts("live", 600);
        f.group = "PROP".into();
        assert_eq!(disqualify(&f, &s), Some("excluded_group"));
        // a MAM master account never earns: its volume is counted on the linked client accounts
        let mam = DealFacts { group: "mam".into(), ..f.clone() };
        assert_eq!(disqualify(&mam, &s), Some("mam_master"));
        // a PAMM fund account never earns on its own deals: the engine pushes them per investor
        let fund = DealFacts { group: "pamm".into(), ..f.clone() };
        assert_eq!(disqualify(&fund, &s), Some("pamm_fund"));
        let mut f = facts("live", 600);
        f.reversed = true;
        assert_eq!(disqualify(&f, &s), Some("reversed"));
        let mut f = facts("live", 600);
        f.kind = "price-correction".into();
        assert_eq!(disqualify(&f, &s), Some("price_correction"));
    }

    #[test]
    fn cent_lots_are_scaled() {
        let s = Settings::default();
        let mut f = facts("live", 600);
        f.cent = true;
        f.volume = dec("2");
        assert_eq!(std_lots(&f, &s), dec("0.02"));
    }

    #[test]
    fn option_deals_are_paid_per_contract_never_per_lot() {
        let s = Settings::default();
        let mut f = facts("live", 600);
        f.option = true;
        f.volume = dec("7");
        // contracts are never lots (level upgrades, lot statistics), and never scaled on cent accounts
        assert_eq!((std_lots(&f, &s), contracts(&f), commission_units(&f, &s)), (ZERO, dec("7"), dec("7")));
        f.cent = true;
        assert_eq!((std_lots(&f, &s), contracts(&f)), (ZERO, dec("7")));
        // the same filters apply as to CFD deals
        assert_eq!(disqualify(&f, &s), None);
        f.reversed = true;
        assert_eq!(disqualify(&f, &s), Some("reversed"));
        // CFD: lots, no contracts
        let c = facts("live", 600);
        assert_eq!((std_lots(&c, &s), contracts(&c), commission_units(&c, &s)), (dec("1"), ZERO, dec("1")));
        // 7 contracts at $1.50 per contract: tier 1 100% → 10.50, tier 2 20% → 2.10 (per-contract rate × tier %)
        let chain = [up(1, "1.5", "0", "0"), up(2, "1.5", "0", "0")];
        let ls = commission_lines(9, dec("7"), &chain, &tiers(), dec("50"), dec("50"));
        assert_eq!((amount(&ls, 1, LineKind::Lot), amount(&ls, 2, LineKind::Lot)), (dec("10.5"), dec("2.1")));
        // the default options rate (0) pays nothing at all
        let ls = commission_lines(9, dec("7"), &[up(1, "0", "10", "0"), up(2, "0", "0", "25")], &tiers(), dec("50"), dec("50"));
        assert!(ls.is_empty());
    }

    #[test]
    fn level_evaluation() {
        let lv = default_levels();
        assert_eq!(eligible_level(&lv, 0, ZERO).unwrap().key, "bronze");
        assert_eq!(eligible_level(&lv, 10, dec("200")).unwrap().key, "silver");
        assert_eq!(eligible_level(&lv, 60, dec("999")).unwrap().key, "silver", "both targets are needed");
        assert_eq!(eligible_level(&lv, 60, dec("1000")).unwrap().key, "gold");
        assert_eq!(evaluate_level(&lv, "bronze", false, false, 12, dec("250")).as_deref(), Some("silver"));
        assert_eq!(evaluate_level(&lv, "gold", false, false, 0, ZERO), None, "no demotion by default");
        assert_eq!(evaluate_level(&lv, "gold", false, true, 0, ZERO).as_deref(), Some("bronze"));
        assert_eq!(evaluate_level(&lv, "bronze", true, false, 999, dec("99999")), None, "admin lock");
        assert_eq!(next_level(&lv, "silver").unwrap().key, "gold");
        assert!(next_level(&lv, "diamond").is_none());
    }

    #[test]
    fn wash_pairs() {
        let t = Utc::now();
        let a = TradeLite { user_id: 1, side: "buy".into(), volume: dec("1"), open_time: t, close_time: t + Duration::seconds(300) };
        let mut b = TradeLite { user_id: 2, side: "sell".into(), volume: dec("0.95"), open_time: t + Duration::seconds(20), close_time: t + Duration::seconds(310) };
        assert!(is_wash_pair(&a, &b, 60, dec("10")));
        b.volume = dec("0.5");
        assert!(!is_wash_pair(&a, &b, 60, dec("10")));
        b.volume = dec("1");
        b.side = "buy".into();
        assert!(!is_wash_pair(&a, &b, 60, dec("10")));
        b.side = "sell".into();
        b.close_time = t + Duration::seconds(900);
        assert!(!is_wash_pair(&a, &b, 60, dec("10")));
    }

    #[test]
    fn payout_periods() {
        let now = Utc.with_ymd_and_hms(2026, 9, 30, 15, 0, 0).unwrap(); // Wednesday
        let (s, e) = last_period("weekly", 1, 1, now);
        assert_eq!(e, Utc.with_ymd_and_hms(2026, 9, 28, 0, 0, 0).unwrap());
        assert_eq!(s, Utc.with_ymd_and_hms(2026, 9, 21, 0, 0, 0).unwrap());
        let (s, e) = last_period("daily", 1, 1, now);
        assert_eq!((s, e), (Utc.with_ymd_and_hms(2026, 9, 29, 0, 0, 0).unwrap(), Utc.with_ymd_and_hms(2026, 9, 30, 0, 0, 0).unwrap()));
        let (s, e) = last_period("monthly", 1, 1, now);
        assert_eq!((s, e), (Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap(), Utc.with_ymd_and_hms(2026, 9, 1, 0, 0, 0).unwrap()));
        let jan = Utc.with_ymd_and_hms(2027, 1, 3, 0, 0, 0).unwrap();
        assert_eq!(last_period("monthly", 1, 5, jan).1, Utc.with_ymd_and_hms(2026, 12, 5, 0, 0, 0).unwrap());
        let (a, b) = month_bounds(Utc.with_ymd_and_hms(2026, 12, 14, 3, 0, 0).unwrap());
        assert_eq!((a, b), (Utc.with_ymd_and_hms(2026, 12, 1, 0, 0, 0).unwrap(), Utc.with_ymd_and_hms(2027, 1, 1, 0, 0, 0).unwrap()));
        assert_eq!(backoff_secs(0), 60);
        assert_eq!(backoff_secs(10), 3600);
    }
}

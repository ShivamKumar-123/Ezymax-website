//! Pure reward maths: points, tiers, cashback, bonus amounts and release, promo / campaign eligibility,
//! contest scoring, ranking, prizes and anti-cheat flags. No I/O; everything here is unit-tested.

use crate::model::{AntiCheat, EarnRule, Prize, Tier};
use crate::money::{D, HUNDRED, ZERO, r2, r4};
use chrono::{DateTime, Duration, Utc};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};

/// Standard lots for a deal volume (cent accounts trade cent lots: × 0.01).
pub fn lots(volume: D, cent: bool) -> D {
    r4(if cent { volume / HUNDRED } else { volume })
}

// ---------------------------------------------------------------- points

fn specificity(r: &EarnRule) -> i32 {
    if !r.symbols.is_empty() {
        0
    } else if r.asset_class.is_some() {
        1
    } else {
        2
    }
}

/// The earning rule for a deal: active, account type and group match, then symbol list, asset class, or any.
/// Lower priority first; at equal priority the more specific rule wins.
pub fn match_rule<'a>(rules: &'a [EarnRule], symbol: &str, asset_class: Option<&str>, group: &str, account_kind: &str) -> Option<&'a EarnRule> {
    let mut cands: Vec<&EarnRule> = rules
        .iter()
        .filter(|r| r.active)
        .filter(|r| r.account_type == "any" || r.account_type == account_kind)
        .filter(|r| r.account_groups.is_empty() || r.account_groups.iter().any(|g| g.eq_ignore_ascii_case(group)))
        .filter(|r| {
            if !r.symbols.is_empty() {
                r.symbols.iter().any(|s| s.eq_ignore_ascii_case(symbol))
            } else if let Some(ac) = &r.asset_class {
                asset_class.is_some_and(|a| a.eq_ignore_ascii_case(ac))
            } else {
                true
            }
        })
        .collect();
    cands.sort_by_key(|r| (r.priority, specificity(r), r.id));
    cands.into_iter().next()
}

/// Points for `lots` at `per_lot` with the tier multiplier, rounded down to whole points.
pub fn points_for(lots: D, per_lot: D, multiplier: D) -> i64 {
    (lots * per_lot * multiplier).floor().to_i64().unwrap_or(0).max(0)
}

/// The highest tier whose threshold is reached (tiers in any order; the lowest tier when none is).
pub fn tier_for(tiers: &[Tier], earned_12m: i64) -> Option<&Tier> {
    tiers.iter().filter(|t| t.min_points <= earned_12m).max_by_key(|t| t.rank).or_else(|| tiers.iter().min_by_key(|t| t.rank))
}

pub fn next_tier<'a>(tiers: &'a [Tier], current: &Tier) -> Option<&'a Tier> {
    tiers.iter().filter(|t| t.rank > current.rank).min_by_key(|t| t.rank)
}

// ---------------------------------------------------------------- cashback

/// Cashback for a deal: lots × rate, capped so the client's month total never exceeds `max_per_month`.
pub fn cashback_amount(lots: D, usd_per_lot: D, month_so_far: D, max_per_month: Option<D>) -> D {
    let raw = r2(lots * usd_per_lot);
    match max_per_month {
        Some(cap) => r2(raw.min((cap - month_so_far).max(ZERO))),
        None => raw,
    }
}

// ---------------------------------------------------------------- bonus (D29)

/// Deposit bonus: deposit × pct, capped; None below the minimum deposit or when it rounds to zero.
pub fn deposit_bonus(deposit: D, pct: D, cap: D, min_deposit: D) -> Option<D> {
    if deposit <= ZERO || deposit < min_deposit {
        return None;
    }
    let mut b = r2(deposit * pct / HUNDRED);
    if cap > ZERO {
        b = b.min(cap);
    }
    (b > ZERO).then_some(b)
}

/// Lots to trade to release the whole bonus.
pub fn lots_required(amount: D, release_per_lot: D) -> D {
    if release_per_lot <= ZERO { ZERO } else { r4(amount / release_per_lot) }
}

/// Amount released by `lots`, capped at what is still unreleased.
pub fn release_for(lots: D, release_per_lot: D, remaining: D) -> D {
    if remaining <= ZERO || lots <= ZERO {
        return ZERO;
    }
    r2(lots * release_per_lot).min(remaining)
}

// ---------------------------------------------------------------- eligibility (promo codes, campaigns)

/// Who is asking: the client's segment.
#[derive(Clone, Debug, Default)]
pub struct Segment {
    pub country: String,
    pub kyc: String,
    pub signed_up_at: Option<DateTime<Utc>>,
}

/// The checks shared by promo codes and bonus campaigns.
#[derive(Clone, Debug, Default)]
pub struct Limits {
    pub active: bool,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i64>,
    pub uses: i64,
    pub per_user_limit: i64,
    pub user_uses: i64,
    pub new_users_days: Option<i64>,
    pub countries: Vec<String>,
    pub kyc_required: bool,
}

/// `Err((code, message))` when the client may not use it now.
pub fn check_limits(l: &Limits, seg: &Segment, now: DateTime<Utc>) -> Result<(), (&'static str, String)> {
    if !l.active {
        return Err(("not_eligible", "This offer is not active.".into()));
    }
    if l.starts_at.is_some_and(|s| now < s) {
        return Err(("not_eligible", "This offer has not started yet.".into()));
    }
    if l.ends_at.is_some_and(|e| now >= e) {
        return Err(("not_eligible", "This offer has ended.".into()));
    }
    if l.max_uses.is_some_and(|m| l.uses >= m) {
        return Err(("limit_reached", "This offer has been fully claimed.".into()));
    }
    if l.per_user_limit > 0 && l.user_uses >= l.per_user_limit {
        return Err(("limit_reached", "You have already used this offer.".into()));
    }
    if let Some(days) = l.new_users_days {
        let fresh = seg.signed_up_at.is_some_and(|t| now - t <= Duration::days(days));
        if !fresh {
            return Err(("not_eligible", format!("This offer is for clients who joined in the last {days} days.")));
        }
    }
    if !l.countries.is_empty() && !l.countries.iter().any(|c| c.eq_ignore_ascii_case(&seg.country)) {
        return Err(("not_eligible", "This offer isn't available in your country.".into()));
    }
    if l.kyc_required && seg.kyc != "verified" {
        return Err(("not_eligible", "Verify your identity to use this offer.".into()));
    }
    Ok(())
}

// ---------------------------------------------------------------- contests (D135)

/// (score, return %) for a contest scoring mode.
pub fn contest_score(scoring: &str, realised: D, floating: D, lots: D, start_equity: Option<D>) -> (D, D) {
    let pnl = realised + floating;
    let ret = match start_equity {
        Some(s) if s > ZERO => r2(pnl / s * HUNDRED),
        _ => ZERO,
    };
    let score = match scoring {
        "profit" => r2(pnl),
        "lots" => r4(lots),
        _ => ret,
    };
    (score, ret)
}

#[derive(Clone, Debug)]
pub struct RankInput {
    pub entry_id: i64,
    pub score: D,
    pub trades: i64,
    pub disqualified: bool,
    pub joined_at: DateTime<Utc>,
}

/// Ranks: qualified entries (≥ min trades, not disqualified) by score desc then earlier join, then the
/// unqualified ones in the same order. Disqualified entries get no rank. Returns (entry id, rank, qualified).
pub fn rank(entries: &[RankInput], min_trades: i64) -> Vec<(i64, Option<i32>, bool)> {
    let mut v: Vec<&RankInput> = entries.iter().filter(|e| !e.disqualified).collect();
    v.sort_by(|a, b| {
        let qa = a.trades >= min_trades;
        let qb = b.trades >= min_trades;
        qb.cmp(&qa).then(b.score.cmp(&a.score)).then(a.joined_at.cmp(&b.joined_at)).then(a.entry_id.cmp(&b.entry_id))
    });
    let mut out: Vec<(i64, Option<i32>, bool)> = v.iter().enumerate().map(|(i, e)| (e.entry_id, Some(i as i32 + 1), e.trades >= min_trades)).collect();
    out.extend(entries.iter().filter(|e| e.disqualified).map(|e| (e.entry_id, None, false)));
    out
}

/// Prizes for final ranks: only qualified entries win; a rank without a qualified entry pays nothing.
pub fn allocate_prizes(prizes: &[Prize], ranks: &[(i64, Option<i32>, bool)]) -> Vec<(i64, D, String)> {
    ranks
        .iter()
        .filter_map(|(id, r, q)| {
            let r = (*r)?;
            if !q {
                return None;
            }
            prizes.iter().find(|p| r >= p.rank_from && r <= p.rank_to).map(|p| (*id, p.amount, p.payout.clone()))
        })
        .collect()
}

/// Anti-cheat flags from an entry's closed trades: (profit, hold seconds).
pub fn trade_flags(trades: &[(D, i64)], ac: &AntiCheat) -> Vec<(&'static str, Value)> {
    let mut out = vec![];
    if trades.len() >= 3 {
        let positive: D = trades.iter().map(|t| t.0).filter(|p| *p > ZERO).sum();
        let best = trades.iter().map(|t| t.0).max().unwrap_or(ZERO);
        if positive > ZERO && best > ZERO {
            let share = r2(best / positive * HUNDRED);
            if share > ac.max_single_trade_pct {
                out.push(("single_trade", json!({"sharePct": crate::money::num(share), "trade": crate::money::num(best), "positiveProfit": crate::money::num(positive)})));
            }
        }
    }
    if ac.min_hold_seconds > 0 && trades.len() >= 4 {
        let short = trades.iter().filter(|t| t.1 < ac.min_hold_seconds).count();
        if short * 2 > trades.len() {
            out.push(("short_holds", json!({"short": short, "trades": trades.len(), "minHoldSeconds": ac.min_hold_seconds})));
        }
    }
    out
}

/// Ledger kinds that change a contest account's balance other than by trading. An allow-list: trading flows
/// (`trade_pnl`, `commission`, `swap`, and the Kalks FX Options `option_premium` / `option_settlement`, which
/// are premiums paid / received and expiry payouts, never deposits or withdrawals) are not balance changes.
pub fn is_balance_change(kind: &str) -> bool {
    matches!(kind, "transfer_in" | "transfer_out" | "deposit" | "withdrawal" | "demo_refill" | "adjustment" | "credit" | "bonus")
}

/// Money that came into the account (deposit-matched bonuses). Option premiums received and option
/// settlements are trading proceeds, never deposits.
pub fn is_deposit_kind(kind: &str) -> bool {
    matches!(kind, "transfer_in" | "deposit")
}

/// Money that left the account (bonus forfeiture on withdrawal). An option premium paid is a trade, never a
/// withdrawal.
pub fn is_withdrawal_kind(kind: &str) -> bool {
    matches!(kind, "transfer_out" | "withdrawal")
}

/// Engine option series code (`EURUSD-20261009-1.1650-C`): underlying, expiry date, strike, right.
pub fn is_option_series(symbol: &str) -> bool {
    let p: Vec<&str> = symbol.split('-').collect();
    p.len() == 4
        && !p[0].is_empty()
        && p[1].len() == 8
        && p[1].bytes().all(|b| b.is_ascii_digit())
        && !p[2].is_empty()
        && p[2].bytes().all(|b| b.is_ascii_digit() || b == b'.')
        && matches!(p[3], "C" | "P" | "c" | "p")
}

/// Whether an engine deal JSON (dealing feed or client history) is a Kalks FX Options deal: the `option`
/// object or `instrument: "option"`, with the series code as a fallback.
pub fn is_option_deal(v: &Value) -> bool {
    v["option"].is_object() || v["instrument"].as_str() == Some("option") || v["symbol"].as_str().is_some_and(is_option_series)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::default_tiers;
    use crate::money::dec;

    fn rule(id: i64, class: Option<&str>, symbols: &[&str], groups: &[&str], kind: &str, per: &str, prio: i32) -> EarnRule {
        EarnRule {
            id,
            name: format!("r{id}"),
            asset_class: class.map(str::to_string),
            symbols: symbols.iter().map(|s| s.to_string()).collect(),
            account_groups: groups.iter().map(|s| s.to_string()).collect(),
            account_type: kind.into(),
            points_per_lot: dec(per),
            priority: prio,
            active: true,
        }
    }

    #[test]
    fn points_rules_and_math() {
        let rules = vec![
            rule(1, Some("forex"), &[], &[], "live", "10", 100),
            rule(2, None, &["XAUUSD"], &[], "live", "20", 100),
            rule(3, Some("metals"), &[], &[], "live", "15", 100),
            rule(4, Some("forex"), &[], &["vip"], "live", "12", 50),
            rule(5, None, &[], &[], "any", "1", 1000),
        ];
        assert_eq!(match_rule(&rules, "EURUSD", Some("forex"), "standard", "live").unwrap().id, 1);
        assert_eq!(match_rule(&rules, "EURUSD", Some("forex"), "vip", "live").unwrap().id, 4, "lower priority first");
        assert_eq!(match_rule(&rules, "XAUUSD", Some("metals"), "standard", "live").unwrap().id, 2, "symbol list beats asset class");
        assert_eq!(match_rule(&rules, "XAGUSD", Some("metals"), "standard", "live").unwrap().id, 3);
        assert_eq!(match_rule(&rules, "EURUSD", Some("forex"), "standard", "demo").unwrap().id, 5, "only the any-type rule covers demo");
        let mut off = rules.clone();
        off[4].active = false;
        assert!(match_rule(&off, "EURUSD", Some("forex"), "standard", "demo").is_none());

        // 2.5 lots × 10 pts × Gold 1.25 = 31.25 → 31
        assert_eq!(points_for(dec("2.5"), dec("10"), dec("1.25")), 31);
        // cent account: 150 cent lots = 1.5 lots
        assert_eq!(lots(dec("150"), true), dec("1.5"));
        assert_eq!(points_for(lots(dec("150"), true), dec("10"), D::ONE), 15);
        assert_eq!(points_for(dec("0.01"), dec("10"), D::ONE), 0);
    }

    #[test]
    fn tiers_resolve() {
        let t = default_tiers();
        assert_eq!(tier_for(&t, 0).unwrap().key, "bronze");
        assert_eq!(tier_for(&t, 4_999).unwrap().key, "bronze");
        assert_eq!(tier_for(&t, 5_000).unwrap().key, "silver");
        assert_eq!(tier_for(&t, 60_000).unwrap().key, "platinum");
        let g = tier_for(&t, 20_000).unwrap();
        assert_eq!(next_tier(&t, g).unwrap().key, "platinum");
        assert!(next_tier(&t, tier_for(&t, 60_000).unwrap()).is_none());
    }

    #[test]
    fn cashback_caps_by_month() {
        assert_eq!(cashback_amount(dec("3"), dec("2.5"), ZERO, None), dec("7.5"));
        assert_eq!(cashback_amount(dec("3"), dec("2.5"), dec("95"), Some(dec("100"))), dec("5"));
        assert_eq!(cashback_amount(dec("3"), dec("2.5"), dec("100"), Some(dec("100"))), ZERO);
        assert_eq!(cashback_amount(dec("0.013"), dec("3"), ZERO, None), dec("0.04"));
    }

    #[test]
    fn bonus_amount_and_release() {
        // 30 % of 1000 = 300, capped at 250
        assert_eq!(deposit_bonus(dec("1000"), dec("30"), dec("250"), dec("100")), Some(dec("250")));
        assert_eq!(deposit_bonus(dec("500"), dec("30"), dec("250"), dec("100")), Some(dec("150")));
        assert_eq!(deposit_bonus(dec("50"), dec("30"), dec("250"), dec("100")), None, "below minimum deposit");
        assert_eq!(deposit_bonus(dec("500"), dec("30"), ZERO, ZERO), Some(dec("150")), "cap 0 = uncapped");
        // $150 bonus releasing $5 per lot needs 30 lots
        assert_eq!(lots_required(dec("150"), dec("5")), dec("30"));
        assert_eq!(release_for(dec("2"), dec("5"), dec("150")), dec("10"));
        assert_eq!(release_for(dec("0.37"), dec("5"), dec("150")), dec("1.85"));
        // the last lots release only what is left
        assert_eq!(release_for(dec("4"), dec("5"), dec("12.5")), dec("12.5"));
        assert_eq!(release_for(dec("4"), dec("5"), ZERO), ZERO);
    }

    #[test]
    fn promo_limits() {
        let now = Utc::now();
        let seg = Segment { country: "IN".into(), kyc: "verified".into(), signed_up_at: Some(now - Duration::days(3)) };
        let base = Limits { active: true, per_user_limit: 1, ..Default::default() };
        assert!(check_limits(&base, &seg, now).is_ok());
        assert_eq!(check_limits(&Limits { active: false, ..base.clone() }, &seg, now).unwrap_err().0, "not_eligible");
        assert_eq!(check_limits(&Limits { max_uses: Some(10), uses: 10, ..base.clone() }, &seg, now).unwrap_err().0, "limit_reached");
        assert!(check_limits(&Limits { max_uses: Some(10), uses: 9, ..base.clone() }, &seg, now).is_ok());
        assert_eq!(check_limits(&Limits { user_uses: 1, ..base.clone() }, &seg, now).unwrap_err().0, "limit_reached");
        assert!(check_limits(&Limits { per_user_limit: 0, user_uses: 5, ..base.clone() }, &seg, now).is_ok(), "0 = unlimited per user");
        assert!(check_limits(&Limits { starts_at: Some(now + Duration::hours(1)), ..base.clone() }, &seg, now).is_err());
        assert!(check_limits(&Limits { ends_at: Some(now), ..base.clone() }, &seg, now).is_err());
        assert!(check_limits(&Limits { new_users_days: Some(7), ..base.clone() }, &seg, now).is_ok());
        assert!(check_limits(&Limits { new_users_days: Some(2), ..base.clone() }, &seg, now).is_err());
        assert!(check_limits(&Limits { countries: vec!["ae".into(), "in".into()], ..base.clone() }, &seg, now).is_ok());
        assert!(check_limits(&Limits { countries: vec!["AE".into()], ..base.clone() }, &seg, now).is_err());
        let unverified = Segment { kyc: "pending".into(), ..seg.clone() };
        assert!(check_limits(&Limits { kyc_required: true, ..base.clone() }, &unverified, now).is_err());
    }

    #[test]
    fn contest_scoring_ranking_prizes() {
        assert_eq!(contest_score("return_pct", dec("150"), dec("-50"), dec("3"), Some(dec("1000"))), (dec("10"), dec("10")));
        assert_eq!(contest_score("profit", dec("150"), dec("-50"), dec("3"), Some(dec("1000"))).0, dec("100"));
        assert_eq!(contest_score("lots", dec("150"), dec("-50"), dec("3.25"), Some(dec("1000"))).0, dec("3.25"));
        assert_eq!(contest_score("return_pct", dec("10"), ZERO, ZERO, None).0, ZERO);

        let t0 = Utc::now();
        let e = |id, score: &str, trades, dq, mins| RankInput { entry_id: id, score: dec(score), trades, disqualified: dq, joined_at: t0 + Duration::minutes(mins) };
        let entries = vec![e(1, "5", 10, false, 0), e(2, "50", 1, false, 1), e(3, "12", 4, false, 2), e(4, "99", 9, true, 3), e(5, "12", 6, false, 1)];
        let r = rank(&entries, 3);
        // qualified: 5 (12, earlier join) , 3 (12), 1 (5); then 2 (unqualified); 4 disqualified
        assert_eq!(r, vec![(5, Some(1), true), (3, Some(2), true), (1, Some(3), true), (2, Some(4), false), (4, None, false)]);
        let prizes = vec![
            Prize { rank_from: 1, rank_to: 1, amount: dec("500"), payout: "wallet".into() },
            Prize { rank_from: 2, rank_to: 4, amount: dec("100"), payout: "credit".into() },
        ];
        let p = allocate_prizes(&prizes, &r);
        assert_eq!(p, vec![(5, dec("500"), "wallet".into()), (3, dec("100"), "credit".into()), (1, dec("100"), "credit".into())]);
    }

    #[test]
    fn anti_cheat_flags() {
        let ac = AntiCheat::default();
        let one_big = vec![(dec("900"), 600), (dec("50"), 600), (dec("20"), 600), (dec("-10"), 600)];
        let f = trade_flags(&one_big, &ac);
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].0, "single_trade");
        let spread = vec![(dec("100"), 600), (dec("90"), 600), (dec("80"), 600)];
        assert!(trade_flags(&spread, &ac).is_empty());
        let scalps = vec![(dec("10"), 5), (dec("10"), 3), (dec("10"), 10), (dec("10"), 900)];
        assert_eq!(trade_flags(&scalps, &ac)[0].0, "short_holds");
        assert!(is_balance_change("demo_refill") && is_balance_change("transfer_in") && !is_balance_change("trade_pnl") && !is_balance_change("commission"));
        // option premiums and settlements are trading flows: never a contest balance change, deposit or withdrawal
        for k in ["option_premium", "option_settlement"] {
            assert!(!is_balance_change(k) && !is_deposit_kind(k) && !is_withdrawal_kind(k), "{k}");
        }
        assert!(is_deposit_kind("transfer_in") && is_deposit_kind("deposit") && !is_deposit_kind("trade_pnl"));
        assert!(is_withdrawal_kind("transfer_out") && is_withdrawal_kind("withdrawal") && !is_withdrawal_kind("commission"));
        assert!(is_option_series("EURUSD-20261009-1.1650-C") && is_option_series("XAUUSD-20261231-2650-P"));
        assert!(!is_option_series("EURUSD") && !is_option_series("BTC-USD") && !is_option_series("EURUSD-20261009-1.1650-Z"));
        assert!(is_option_deal(&json!({"symbol": "EURUSD", "option": {"series": "x"}})));
        assert!(is_option_deal(&json!({"symbol": "EURUSD", "instrument": "option"})));
        assert!(is_option_deal(&json!({"symbol": "USDJPY-20261009-150.00-P"})));
        assert!(!is_option_deal(&json!({"symbol": "EURUSD", "option": null, "instrument": "cfd"})));
    }
}

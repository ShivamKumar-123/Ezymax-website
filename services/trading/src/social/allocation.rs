//! Pure MAM maths: how a manager's block trade is split across the linked client accounts, and the MAM fees
//! (performance fee above a per-account high-water mark, pro-rata management fee). No IO; covered by the tests
//! at the bottom.
//!
//! Allocation methods (per manager):
//! - `equity`: each account gets `block × equity_i ÷ Σ equity` (accounts with equity ≤ 0 get nothing and do
//!   not count in the sum);
//! - `balance`: the same with balances;
//! - `multiplier`: `block × multiplier_i`;
//! - `percent`: `block × percent_i ÷ 100`.
//!
//! Every volume is then capped at the account's max lot and the symbol's max lot and rounded DOWN to the
//! symbol's lot step (an allocation never exceeds what the method gives). A result below the symbol's minimum
//! lot is skipped for that account. For the proportional methods, what rounding leaves over is reported as
//! `unallocated` (it is not redistributed: that would give some accounts more than their share).

use chrono::{DateTime, Utc};
use serde::Serialize;

use super::math::clamp_volume;
use crate::money::{D, HUNDRED, ZERO, r2};
use crate::specs::Spec;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Method {
    Equity,
    Balance,
    Multiplier,
    Percent,
}

impl Method {
    pub fn as_str(self) -> &'static str {
        match self {
            Method::Equity => "equity",
            Method::Balance => "balance",
            Method::Multiplier => "multiplier",
            Method::Percent => "percent",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "equity" => Method::Equity,
            "balance" => Method::Balance,
            "multiplier" => Method::Multiplier,
            "percent" => Method::Percent,
            _ => return None,
        })
    }
    /// The block is split between the accounts (the shares sum to 100 %).
    pub fn proportional(self) -> bool {
        matches!(self, Method::Equity | Method::Balance)
    }
    /// Valid per-account value for the method (multiplier 0.01–100, percent 0.01–1000).
    pub fn valid_value(self, v: D) -> bool {
        match self {
            Method::Multiplier => v >= D::new(1, 2) && v <= D::from(100),
            Method::Percent => v >= D::new(1, 2) && v <= D::from(1000),
            _ => v > ZERO,
        }
    }
}

/// One linked account at allocation time (money in USD).
#[derive(Clone, Debug, PartialEq)]
pub struct Slot {
    pub link: i64,
    pub equity: D,
    pub balance: D,
    /// Multiplier or percent (ignored by the proportional methods).
    pub value: D,
    pub max_lot: Option<D>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Alloc {
    pub link: i64,
    /// Share of the block (proportional methods, 0–1) or the account's multiplier / percent.
    pub basis: D,
    /// Unrounded volume the method gives.
    pub raw: D,
    /// Volume to trade (None = skipped, see `reason`).
    pub volume: Option<D>,
    /// `below_min_lot`, `no_equity`, `max_lot` (capped, still traded), `symbol_max_lot` (capped).
    pub reason: Option<&'static str>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Plan {
    pub allocs: Vec<Alloc>,
    /// Σ volumes traded.
    pub allocated: D,
    /// Proportional methods: block − allocated (rounding and skipped accounts); zero otherwise.
    pub unallocated: D,
}

/// Splits a block of `block` lots across `slots` for a symbol with `spec`.
pub fn allocate(method: Method, block: D, slots: &[Slot], spec: &Spec) -> Plan {
    let weight = |s: &Slot| match method {
        Method::Equity => s.equity.max(ZERO),
        Method::Balance => s.balance.max(ZERO),
        _ => ZERO,
    };
    let total: D = slots.iter().map(weight).sum();
    let mut allocs = Vec::with_capacity(slots.len());
    for s in slots {
        let (basis, raw) = match method {
            Method::Equity | Method::Balance => {
                let w = weight(s);
                if w <= ZERO || total <= ZERO || block <= ZERO {
                    allocs.push(Alloc { link: s.link, basis: ZERO, raw: ZERO, volume: None, reason: Some("no_equity") });
                    continue;
                }
                (w / total, block * w / total)
            }
            Method::Multiplier => (s.value, block * s.value),
            Method::Percent => (s.value, block * s.value / HUNDRED),
        };
        let volume = clamp_volume(raw, spec, s.max_lot);
        let account_cap = s.max_lot.filter(|m| *m > ZERO && raw > *m && *m <= spec.lot_max).is_some();
        let reason = match volume {
            None => Some("below_min_lot"),
            Some(_) if account_cap => Some("max_lot"),
            Some(_) if raw > spec.lot_max => Some("symbol_max_lot"),
            Some(_) => None,
        };
        allocs.push(Alloc { link: s.link, basis: basis.round_dp(8).normalize(), raw: raw.round_dp(8).normalize(), volume, reason });
    }
    let allocated: D = allocs.iter().filter_map(|a| a.volume).sum();
    let unallocated = if method.proportional() { (block - allocated).max(ZERO) } else { ZERO };
    Plan { allocs, allocated: allocated.normalize(), unallocated: unallocated.normalize() }
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
/* ------------------------------------------------------------------ */

/// Performance fee on the cumulative MAM result `result` (USD, closed + floating, since the link) above the
/// high-water mark `hwm`: `fee = pct × max(0, result − hwm)`, new HWM = max(hwm, result). The fee itself is
/// not a MAM trade, so it does not lower the result: the next period pays only on new gains.
pub fn perf_fee(pct: D, hwm: D, result: D) -> (D, D) {
    let gain = result - hwm;
    let fee = if gain > ZERO && pct > ZERO { r2(gain * pct / HUNDRED) } else { ZERO };
    (fee, if result > hwm { result } else { hwm })
}

/// Management fee: `pct` % a year of `equity`, pro rata for the time between `from` and `to` (365-day year).
pub fn mgmt_fee(pct: D, equity: D, from: DateTime<Utc>, to: DateTime<Utc>) -> D {
    if pct <= ZERO || equity <= ZERO || to <= from {
        return ZERO;
    }
    let secs = D::from((to - from).num_seconds());
    r2(equity * pct / HUNDRED * secs / D::from(365 * 86_400))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::testkit::d;

    fn spec(sym: &str) -> Spec {
        crate::specs::test_specs().get(sym).unwrap().clone()
    }

    fn slot(link: i64, equity: &str, balance: &str, value: &str, max_lot: Option<&str>) -> Slot {
        Slot { link, equity: d(equity), balance: d(balance), value: d(value), max_lot: max_lot.map(d) }
    }

    fn vols(p: &Plan) -> Vec<Option<D>> {
        p.allocs.iter().map(|a| a.volume).collect()
    }

    #[test]
    fn equity_and_balance_proportion() {
        let eu = spec("EURUSD"); // min 0.01, step 0.01
        let s = [slot(1, "5000", "4000", "1", None), slot(2, "3000", "3000", "1", None), slot(3, "2000", "3000", "1", None)];
        let p = allocate(Method::Equity, d("1"), &s, &eu);
        assert_eq!(vols(&p), vec![Some(d("0.5")), Some(d("0.3")), Some(d("0.2"))]);
        assert_eq!((p.allocated, p.unallocated), (d("1"), ZERO));
        assert_eq!(p.allocs[0].basis, d("0.5"));
        // balance: 4 000 / 10 000, 3 000 / 10 000 each
        let b = allocate(Method::Balance, d("1"), &s, &eu);
        assert_eq!(vols(&b), vec![Some(d("0.4")), Some(d("0.3")), Some(d("0.3"))]);
    }

    #[test]
    fn rounds_down_to_the_lot_step_and_reports_the_remainder() {
        let eu = spec("EURUSD");
        // 0.10 over three equal accounts: 0.0333… each → 0.03, 0.01 left unallocated
        let s = [slot(1, "1000", "1000", "1", None), slot(2, "1000", "1000", "1", None), slot(3, "1000", "1000", "1", None)];
        let p = allocate(Method::Equity, d("0.1"), &s, &eu);
        assert_eq!(vols(&p), vec![Some(d("0.03")); 3]);
        assert_eq!((p.allocated, p.unallocated), (d("0.09"), d("0.01")));
        assert_eq!(p.allocs[0].raw, d("0.03333333"));
        // 1.00 split 2/3 : 1/3 → 0.66 + 0.33 (never rounded up to 0.67)
        let q = allocate(Method::Equity, d("1"), &[slot(1, "2000", "0", "1", None), slot(2, "1000", "0", "1", None)], &eu);
        assert_eq!(vols(&q), vec![Some(d("0.66")), Some(d("0.33"))]);
        assert_eq!(q.unallocated, d("0.01"));
    }

    #[test]
    fn minimum_lot_zero_equity_and_caps() {
        let eu = spec("EURUSD");
        // 0.05 lot: the small account's share is 0.0045 → below the 0.01 minimum → skipped
        let s = [slot(1, "10000", "0", "1", None), slot(2, "1000", "0", "1", None)];
        let p = allocate(Method::Equity, d("0.05"), &s, &eu);
        assert_eq!(vols(&p), vec![Some(d("0.04")), None]);
        assert_eq!(p.allocs[1].reason, Some("below_min_lot"));
        // an account without equity gets nothing and does not dilute the others
        let z = allocate(Method::Equity, d("1"), &[slot(1, "0", "0", "1", None), slot(2, "-50", "0", "1", None), slot(3, "800", "0", "1", None)], &eu);
        assert_eq!(vols(&z), vec![None, None, Some(d("1"))]);
        assert_eq!(z.allocs[0].reason, Some("no_equity"));
        // max lot per account caps it (and says so)
        let c = allocate(Method::Equity, d("2"), &[slot(1, "5000", "0", "1", Some("0.5")), slot(2, "5000", "0", "1", None)], &eu);
        assert_eq!(vols(&c), vec![Some(d("0.5")), Some(d("1"))]);
        assert_eq!(c.allocs[0].reason, Some("max_lot"));
        assert_eq!(c.unallocated, d("0.5"));
        // symbol max lot
        let big = allocate(Method::Multiplier, d("80"), &[slot(1, "1", "1", "2", None)], &eu);
        assert_eq!(vols(&big), vec![Some(eu.lot_max)]);
        assert_eq!(big.allocs[0].reason, Some("symbol_max_lot"));
        // a symbol with a 0.10 minimum and a 0.10 step
        let coarse = Spec { lot_min: d("0.1"), lot_step: d("0.1"), ..eu.clone() };
        let r = allocate(Method::Equity, d("1"), &[slot(1, "6500", "0", "1", None), slot(2, "3500", "0", "1", None)], &coarse);
        assert_eq!(vols(&r), vec![Some(d("0.6")), Some(d("0.3"))]);
        assert_eq!(r.unallocated, d("0.1"));
        let tiny = allocate(Method::Equity, d("0.3"), &[slot(1, "7000", "0", "1", None), slot(2, "3000", "0", "1", None)], &coarse);
        assert_eq!(vols(&tiny), vec![Some(d("0.2")), None], "0.21 → 0.2; 0.09 is below the 0.1 minimum");
    }

    #[test]
    fn multiplier_and_percent() {
        let eu = spec("EURUSD");
        let m = allocate(Method::Multiplier, d("0.3"), &[slot(1, "1", "1", "1.5", None), slot(2, "1", "1", "0.5", None), slot(3, "1", "1", "0.01", None)], &eu);
        assert_eq!(vols(&m), vec![Some(d("0.45")), Some(d("0.15")), None]);
        assert_eq!(m.unallocated, ZERO, "not a split: nothing is left over");
        // 50 % of 0.33 = 0.165 → 0.16; 150 % of 0.33 = 0.495 → 0.49
        let p = allocate(Method::Percent, d("0.33"), &[slot(1, "1", "1", "50", None), slot(2, "1", "1", "150", None)], &eu);
        assert_eq!(vols(&p), vec![Some(d("0.16")), Some(d("0.49"))]);
        assert!(Method::Percent.valid_value(d("100")) && !Method::Percent.valid_value(d("0")) && !Method::Multiplier.valid_value(d("101")));
    }

    #[test]
    fn fees() {
        // +300 result, 20 % → 60; HWM 300
        assert_eq!(perf_fee(d("20"), ZERO, d("300")), (d("60.00"), d("300")));
        // falls to 100: no fee, HWM stays 300; recovers to 450: fee on 150 only
        assert_eq!(perf_fee(d("20"), d("300"), d("100")), (ZERO, d("300")));
        assert_eq!(perf_fee(d("20"), d("300"), d("450")), (d("30.00"), d("450")));
        // a loss from the start never pays
        assert_eq!(perf_fee(d("20"), ZERO, d("-40")), (ZERO, ZERO));
        // management fee: 2 % a year of 10 000 for 30 days = 16.44
        let t0 = chrono::DateTime::parse_from_rfc3339("2026-09-01T00:00:00Z").unwrap().with_timezone(&Utc);
        assert_eq!(mgmt_fee(d("2"), d("10000"), t0, t0 + chrono::Duration::days(30)), d("16.44"));
        assert_eq!(mgmt_fee(d("2"), d("10000"), t0, t0 + chrono::Duration::days(365)), d("200.00"));
        assert_eq!(mgmt_fee(ZERO, d("10000"), t0, t0 + chrono::Duration::days(30)), ZERO);
    }
}

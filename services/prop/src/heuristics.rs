//! Banned-strategy heuristics (D148). They only flag an account for review by the risk desk; a reviewer
//! confirms (which can fail the account) or clears the flag. Thresholds are deliberately conservative.
//!
//! | kind | signal |
//! |---|---|
//! | `tick_scalping` | ≥ 10 closed trades and ≥ 50% of them held under 60 s |
//! | `hft` | ≥ 10 trades opened inside any 60 s window, or ≥ 200 trades opened on one server day |
//! | `latency_arbitrage` | ≥ 10 trades held under 120 s with a win rate ≥ 90% (fills on stale quotes win almost always) |
//! | `cross_account_copying` | ≥ 3 same-side opens on the same symbol within 2 s on two different prop accounts |
//! | `cross_account_hedging` | ≥ 3 opposite-side opens on the same symbol within 2 s on two different prop accounts |

use chrono::{DateTime, Duration, Utc};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashMap};

use crate::money::{D, ZERO};
use crate::time::server_date;

#[derive(Clone, Debug)]
pub struct Trade {
    pub ticket: String,
    pub symbol: String,
    pub side: String,
    pub open_time: DateTime<Utc>,
    pub close_time: Option<DateTime<Utc>>,
    pub profit: Option<D>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Flag {
    pub kind: &'static str,
    pub score: D,
    pub summary: String,
    pub evidence: Value,
    pub related_login: Option<i64>,
}

pub const SCALP_SECS: i64 = 60;
pub const LATENCY_SECS: i64 = 120;
pub const MIN_TRADES: usize = 10;

fn pct(n: usize, of: usize) -> D {
    if of == 0 { ZERO } else { (D::from(n as i64) * D::from(100) / D::from(of as i64)).round_dp(1) }
}

/// Single-account heuristics over the trades of one phase account (closed and open).
pub fn account_flags(trades: &[Trade]) -> Vec<Flag> {
    let mut out = vec![];
    let closed: Vec<&Trade> = trades.iter().filter(|t| t.close_time.is_some()).collect();
    let hold = |t: &Trade| (t.close_time.unwrap() - t.open_time).num_seconds();

    let short: Vec<&&Trade> = closed.iter().filter(|t| hold(t) < SCALP_SECS).collect();
    if closed.len() >= MIN_TRADES && short.len() * 2 >= closed.len() {
        out.push(Flag {
            kind: "tick_scalping",
            score: pct(short.len(), closed.len()),
            summary: format!("{} of {} closed trades held under {SCALP_SECS} s", short.len(), closed.len()),
            evidence: json!({"shortTrades": short.len(), "closedTrades": closed.len(), "tickets": short.iter().take(20).map(|t| t.ticket.clone()).collect::<Vec<_>>()}),
            related_login: None,
        });
    }

    let fast: Vec<&&Trade> = closed.iter().filter(|t| hold(t) < LATENCY_SECS).collect();
    if fast.len() >= MIN_TRADES {
        let wins = fast.iter().filter(|t| t.profit.unwrap_or(ZERO) > ZERO).count();
        if wins * 10 >= fast.len() * 9 {
            let avg = fast.iter().map(|t| hold(t)).sum::<i64>() / fast.len() as i64;
            out.push(Flag {
                kind: "latency_arbitrage",
                score: pct(wins, fast.len()),
                summary: format!("{wins} of {} trades under {LATENCY_SECS} s were winners (avg hold {avg} s)", fast.len()),
                evidence: json!({"fastTrades": fast.len(), "wins": wins, "avgHoldSecs": avg, "tickets": fast.iter().take(20).map(|t| t.ticket.clone()).collect::<Vec<_>>()}),
                related_login: None,
            });
        }
    }

    let mut opens: Vec<DateTime<Utc>> = trades.iter().map(|t| t.open_time).collect();
    opens.sort();
    let (mut best, mut best_at, mut j) = (0usize, None, 0usize);
    for i in 0..opens.len() {
        while opens[i] - opens[j] >= Duration::seconds(60) {
            j += 1;
        }
        if i + 1 - j > best {
            best = i + 1 - j;
            best_at = Some(opens[j]);
        }
    }
    let mut per_day: BTreeMap<chrono::NaiveDate, usize> = BTreeMap::new();
    for t in &opens {
        *per_day.entry(server_date(*t)).or_default() += 1;
    }
    let busiest = per_day.iter().max_by_key(|(_, n)| **n).map(|(d, n)| (*d, *n));
    if best >= 10 || busiest.is_some_and(|(_, n)| n >= 200) {
        out.push(Flag {
            kind: "hft",
            score: D::from(best.max(busiest.map(|b| b.1).unwrap_or(0)) as i64),
            summary: format!("{best} trades opened within 60 s; busiest day {} trades", busiest.map(|b| b.1).unwrap_or(0)),
            evidence: json!({"maxPerMinute": best, "windowStart": best_at, "busiestDay": busiest.map(|b| b.0), "busiestDayTrades": busiest.map(|b| b.1)}),
            related_login: None,
        });
    }
    out
}

/// An open on one prop account, for the cross-account check.
#[derive(Clone, Debug)]
pub struct OpenEvent {
    pub login: i64,
    pub user_id: i64,
    pub ticket: String,
    pub symbol: String,
    pub side: String,
    pub at: DateTime<Utc>,
}

pub const PAIR_SECS: i64 = 2;
pub const PAIR_MIN: usize = 3;

/// Cross-account copying / hedging across all active prop accounts. Returns (login, flag) for both sides of
/// each suspicious pair.
pub fn cross_account_flags(events: &[OpenEvent]) -> Vec<(i64, Flag)> {
    let mut by_symbol: HashMap<&str, Vec<&OpenEvent>> = HashMap::new();
    for e in events {
        by_symbol.entry(e.symbol.as_str()).or_default().push(e);
    }
    // (login a, login b, same side?) → matched ticket pairs
    let mut pairs: BTreeMap<(i64, i64, bool), Vec<(String, String)>> = BTreeMap::new();
    for list in by_symbol.values_mut() {
        list.sort_by_key(|e| e.at);
        for i in 0..list.len() {
            for j in (i + 1)..list.len() {
                let (a, b) = (list[i], list[j]);
                if b.at - a.at > Duration::seconds(PAIR_SECS) {
                    break;
                }
                if a.login == b.login {
                    continue;
                }
                let same = a.side == b.side;
                let (x, y) = if a.login < b.login { (a, b) } else { (b, a) };
                pairs.entry((x.login, y.login, same)).or_default().push((x.ticket.clone(), y.ticket.clone()));
            }
        }
    }
    let users: HashMap<i64, i64> = events.iter().map(|e| (e.login, e.user_id)).collect();
    let mut out = vec![];
    for ((a, b, same), matched) in pairs {
        if matched.len() < PAIR_MIN {
            continue;
        }
        let kind = if same { "cross_account_copying" } else { "cross_account_hedging" };
        let same_user = users.get(&a) == users.get(&b);
        for (me, other) in [(a, b), (b, a)] {
            out.push((
                me,
                Flag {
                    kind,
                    score: D::from(matched.len() as i64),
                    summary: format!(
                        "{} {} opens within {PAIR_SECS} s of account #{other}{}",
                        matched.len(),
                        if same { "same-direction" } else { "opposite-direction" },
                        if same_user { " (same client)" } else { "" }
                    ),
                    evidence: json!({"pairs": matched.iter().take(20).map(|(x, y)| json!([x, y])).collect::<Vec<_>>(), "matches": matched.len(), "sameClient": same_user}),
                    related_login: Some(other),
                },
            ));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t0() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-09-10T10:00:00Z").unwrap().with_timezone(&Utc)
    }
    fn trade(i: i64, hold: i64, profit: i64) -> Trade {
        let open = t0() + Duration::minutes(i * 5);
        Trade { ticket: format!("{}", 1000 + i), symbol: "EURUSD".into(), side: "buy".into(), open_time: open, close_time: Some(open + Duration::seconds(hold)), profit: Some(D::from(profit)) }
    }

    #[test]
    fn tick_scalping_and_latency_arbitrage() {
        let trades: Vec<Trade> = (0..12).map(|i| trade(i, 20, 5)).collect();
        let f = account_flags(&trades);
        let kinds: Vec<_> = f.iter().map(|x| x.kind).collect();
        assert!(kinds.contains(&"tick_scalping"));
        assert!(kinds.contains(&"latency_arbitrage"));
        assert!(!kinds.contains(&"hft"));
        // same short holds but half losers: scalping yes, latency arbitrage no
        let trades: Vec<Trade> = (0..12).map(|i| trade(i, 20, if i % 2 == 0 { 5 } else { -5 })).collect();
        let kinds: Vec<_> = account_flags(&trades).iter().map(|x| x.kind).collect();
        assert_eq!(kinds, vec!["tick_scalping"]);
        // normal swing trades: nothing
        let trades: Vec<Trade> = (0..30).map(|i| trade(i, 3600, 5)).collect();
        assert!(account_flags(&trades).is_empty());
        // too few trades: nothing
        let trades: Vec<Trade> = (0..5).map(|i| trade(i, 5, 5)).collect();
        assert!(account_flags(&trades).is_empty());
    }

    #[test]
    fn hft_burst() {
        let trades: Vec<Trade> = (0..10)
            .map(|i| {
                let open = t0() + Duration::seconds(i * 5);
                Trade { ticket: i.to_string(), symbol: "EURUSD".into(), side: "buy".into(), open_time: open, close_time: None, profit: None }
            })
            .collect();
        let f = account_flags(&trades);
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].kind, "hft");
        assert_eq!(f[0].score, D::from(10));
    }

    #[test]
    fn cross_account_pairs() {
        let mut ev = vec![];
        for i in 0..3 {
            let at = t0() + Duration::minutes(i * 10);
            ev.push(OpenEvent { login: 10000001, user_id: 1, ticket: format!("a{i}"), symbol: "XAUUSD".into(), side: "buy".into(), at });
            ev.push(OpenEvent { login: 10000002, user_id: 2, ticket: format!("b{i}"), symbol: "XAUUSD".into(), side: "sell".into(), at: at + Duration::seconds(1) });
            // copier on a third account, 1.5 s later, same side as the first
            ev.push(OpenEvent { login: 10000003, user_id: 3, ticket: format!("c{i}"), symbol: "XAUUSD".into(), side: "buy".into(), at: at + Duration::milliseconds(1500) });
        }
        // unrelated trade far away
        ev.push(OpenEvent { login: 10000004, user_id: 4, ticket: "d".into(), symbol: "XAUUSD".into(), side: "buy".into(), at: t0() + Duration::hours(5) });
        let f = cross_account_flags(&ev);
        let has = |login: i64, kind: &str, other: i64| f.iter().any(|(l, x)| *l == login && x.kind == kind && x.related_login == Some(other));
        assert!(has(10000001, "cross_account_hedging", 10000002));
        assert!(has(10000002, "cross_account_hedging", 10000001));
        assert!(has(10000001, "cross_account_copying", 10000003));
        assert!(has(10000003, "cross_account_copying", 10000001));
        assert!(has(10000002, "cross_account_hedging", 10000003));
        assert!(!f.iter().any(|(l, _)| *l == 10000004));
        // two matches only: below the threshold
        let few: Vec<OpenEvent> = ev.iter().filter(|e| !e.ticket.ends_with('2')).cloned().collect();
        assert!(cross_account_flags(&few).is_empty());
    }
}

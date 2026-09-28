//! Backtester: simulation (`sim`), report metrics (`metrics`) and the job queue (`jobs`).

pub mod jobs;
pub mod metrics;
pub mod sim;

use serde_json::{Value, json};

/// Report JSON stored with a finished backtest (D86).
pub fn report(out: &sim::Output, initial: f64, model: &str, coverage: Value) -> Value {
    let m = metrics::compute(out, initial);
    let mut trades = out.trades.clone();
    let truncated = trades.len() > 5000;
    trades.truncate(5000);
    let mut skipped: Vec<(&&str, &usize)> = out.skipped.iter().collect();
    skipped.sort_by(|a, b| b.1.cmp(a.1));
    json!({
        "metrics": m,
        "equity": metrics::curve(&out.equity, initial, 1500),
        "monthly": metrics::monthly(&out.daily, initial),
        "trades": trades,
        "tradesTruncated": truncated,
        "signals": {"buy": out.signals[0], "sell": out.signals[1], "exitBuy": out.signals[2], "exitSell": out.signals[3]},
        "skipped": skipped.into_iter().map(|(k, v)| json!({"reason": k, "count": v})).collect::<Vec<_>>(),
        "model": model,
        "intrabarM1Bars": out.intrabar_m1_bars,
        "coverage": coverage,
        "notes": out.notes,
        "firstBar": out.first_bar,
        "lastBar": out.last_bar,
    })
}

#[cfg(test)]
mod tests {
    use super::sim::{Config, Data, run};
    use crate::dsl::compile;
    use crate::dsl::eval::Frame;
    use crate::indicators::Bar;
    use crate::specs::Specs;
    use std::collections::HashMap;
    use std::sync::atomic::AtomicBool;

    // Monday 2026-09-21 00:00 UTC
    const T0: i64 = 1_789_948_800;

    fn bar(i: i64, o: f64, h: f64, l: f64, c: f64) -> Bar {
        Bar { t: T0 + i * 3600, o, h, l, c, v: 0.0 }
    }

    fn cfg() -> Config {
        Config { initial_balance: 10_000.0, from: T0, to: T0 + 400 * 3600, spread: 0.0002, commission_per_lot: 7.0, swaps: true, quote_usd_rate: 1.0, usd_base: false, deadline: None }
    }

    fn prog(src: &str) -> crate::dsl::Program {
        let c = compile(src, "EURUSD", "H1", &Specs::repo());
        assert!(c.errors.is_empty(), "{:?}", c.errors);
        c.program
    }

    #[test]
    fn take_profit_trade_and_metrics() {
        let specs = Specs::repo();
        let sp = specs.get("EURUSD").unwrap();
        let p = prog("lots(1)\ntake_profit(price=0.001)\nbuy = crosses_above(close, 1.1000)\n");
        let bars = vec![
            bar(0, 1.0990, 1.0995, 1.0985, 1.0990),
            bar(1, 1.0990, 1.1010, 1.0989, 1.1005), // cross → buy at next open
            bar(2, 1.1006, 1.1010, 1.1000, 1.1008), // entry at the ask 1.1006 + 0.0001 = 1.1007, TP 1.1017
            bar(3, 1.1008, 1.1030, 1.1007, 1.1025), // TP hit
            bar(4, 1.1025, 1.1026, 1.1020, 1.1022),
        ];
        let data = Data { base: Frame::new("H1", bars), others: HashMap::new(), m1: vec![] };
        let out = run(&p, sp, &cfg(), &data, &|_| {}, &AtomicBool::new(false)).unwrap();
        assert_eq!(out.trades.len(), 1);
        let t = &out.trades[0];
        assert_eq!((t.side, t.open_price, t.close_price, t.reason), ("buy", 1.1007, 1.1017, "tp"));
        assert_eq!(t.profit, 100.0);
        assert_eq!(t.commission, 7.0);
        assert_eq!(t.net, 93.0);
        let m = super::metrics::compute(&out, 10_000.0);
        assert_eq!(m.net_profit, 93.0);
        assert_eq!((m.trades, m.wins, m.win_rate), (1, 1, 100.0));
        assert_eq!(m.profit_factor, None);
        assert_eq!(m.spread_cost, 20.0);
    }

    #[test]
    fn m1_path_decides_sl_vs_tp_and_gaps_fill_at_open() {
        let specs = Specs::repo();
        let sp = specs.get("EURUSD").unwrap();
        let p = prog("lots(1)\nstop_loss(price=0.0010)\ntake_profit(price=0.0010)\nbuy = crosses_above(close, 1.1000)\n");
        let bars = vec![bar(0, 1.0990, 1.0995, 1.0985, 1.0990), bar(1, 1.0990, 1.1010, 1.0989, 1.1005), bar(2, 1.1009, 1.1030, 1.0990, 1.1000), bar(3, 1.1000, 1.1001, 1.0999, 1.1000)];
        // entry 1.1010 (ask) at bar 2's open; SL 1.1000, TP 1.1020 (bid). The H1 bar alone is bearish (O→H→L→C: TP first),
        // but its M1 bars go down first: the SL is hit.
        let m1 = vec![
            Bar { t: T0 + 2 * 3600, o: 1.1009, h: 1.1012, l: 1.0995, c: 1.0996, v: 0.0 },
            Bar { t: T0 + 2 * 3600 + 60, o: 1.0996, h: 1.1030, l: 1.0990, c: 1.1000, v: 0.0 },
        ];
        let no_m1 = Data { base: Frame::new("H1", bars.clone()), others: HashMap::new(), m1: vec![] };
        let out = run(&p, sp, &cfg(), &no_m1, &|_| {}, &AtomicBool::new(false)).unwrap();
        assert_eq!(out.trades[0].reason, "tp");
        let with_m1 = Data { base: Frame::new("H1", bars.clone()), others: HashMap::new(), m1 };
        let out = run(&p, sp, &cfg(), &with_m1, &|_| {}, &AtomicBool::new(false)).unwrap();
        assert_eq!((out.trades[0].reason, out.trades[0].close_price), ("sl", 1.1));
        assert_eq!(out.intrabar_m1_bars, 1);
        // gap through the stop: filled at the gapped open, not at the level
        let gap_bars = vec![bar(0, 1.0990, 1.0995, 1.0985, 1.0990), bar(1, 1.0990, 1.1010, 1.0989, 1.1005), bar(2, 1.1009, 1.1012, 1.1008, 1.1010), bar(3, 1.0980, 1.0985, 1.0970, 1.0975)];
        let out = run(&p, sp, &cfg(), &Data { base: Frame::new("H1", gap_bars), others: HashMap::new(), m1: vec![] }, &|_| {}, &AtomicBool::new(false)).unwrap();
        assert_eq!((out.trades[0].reason, out.trades[0].close_price), ("sl", 1.0979));
    }

    #[test]
    fn swaps_triple_wednesday_and_trailing() {
        let specs = Specs::repo();
        let sp = specs.get("EURUSD").unwrap();
        let p = prog("lots(1)\nbuy = crosses_above(close, 1.1000)\nexit_buy = close > 1.2\n");
        // flat bars from Monday 00:00 UTC for 4 days: rollovers after Mon, Tue, Wed (x3) server days
        let mut bars = vec![bar(0, 1.0990, 1.0995, 1.0985, 1.0990), bar(1, 1.0990, 1.1010, 1.0989, 1.1005)];
        for i in 2..96 {
            bars.push(bar(i, 1.1005, 1.1006, 1.1004, 1.1005));
        }
        let out = run(&p, sp, &cfg(), &Data { base: Frame::new("H1", bars), others: HashMap::new(), m1: vec![] }, &|_| {}, &AtomicBool::new(false)).unwrap();
        let t = &out.trades[0];
        assert_eq!(t.reason, "end_of_test");
        // bars span Mon 00:00 → Thu 23:00 UTC = server Mon 03:00 → Fri 02:00: rollovers ending Mon, Tue, Wed(x3), Thu = 6 nights
        let per_night = -7.2 * 0.00001 * 100_000.0;
        assert!((t.swap - per_night * 6.0).abs() < 0.011, "swap {}", t.swap);

        let p = prog("lots(1)\ntrailing(points=200)\nbuy = crosses_above(close, 1.1000)\n");
        let bars = vec![
            bar(0, 1.0990, 1.0995, 1.0985, 1.0990),
            bar(1, 1.0990, 1.1010, 1.0989, 1.1005),
            bar(2, 1.1005, 1.1050, 1.1005, 1.1050), // entry 1.1006; runs to 1.1050 → SL trails to 1.1030
            bar(3, 1.1050, 1.1051, 1.1020, 1.1025), // falls through 1.1030
        ];
        let out = run(&p, sp, &cfg(), &Data { base: Frame::new("H1", bars), others: HashMap::new(), m1: vec![] }, &|_| {}, &AtomicBool::new(false)).unwrap();
        assert_eq!((out.trades[0].reason, out.trades[0].close_price), ("sl", 1.103)); // bar 3 first ticks up to 1.1051 (bid 1.1050)
    }

    #[test]
    fn filters_limits_and_drawdown() {
        let specs = Specs::repo();
        let sp = specs.get("EURUSD").unwrap();
        // always-true signal, one position at a time, max 2 trades a day, SL hit every bar
        let p = prog("lots(1)\nstop_loss(points=5)\nmax_trades_per_day(2)\nbuy = close > 0\n");
        let bars: Vec<Bar> = (0..10).map(|i| bar(i, 1.1000, 1.1001, 1.0980, 1.0990)).collect();
        let out = run(&p, sp, &cfg(), &Data { base: Frame::new("H1", bars), others: HashMap::new(), m1: vec![] }, &|_| {}, &AtomicBool::new(false)).unwrap();
        assert_eq!(out.trades.len(), 2);
        assert!(out.skipped.get("daily trade limit").copied().unwrap_or(0) > 0);
        let m = super::metrics::compute(&out, 10_000.0);
        assert_eq!(m.max_consecutive_losses, 2);
        assert!(m.max_drawdown > 0.0 && m.max_drawdown_pct > 0.0);
        let eq = vec![
            super::sim::EquityPoint { t: 1, balance: 0.0, equity: 11_000.0 },
            super::sim::EquityPoint { t: 2, balance: 0.0, equity: 8_800.0 },
            super::sim::EquityPoint { t: 3, balance: 0.0, equity: 12_000.0 },
        ];
        assert_eq!(super::metrics::drawdown(&eq, 10_000.0), (2200.0, 20.0));
    }

    #[test]
    fn monthly_returns_and_sharpe() {
        use chrono::NaiveDate;
        let d = |m, day| NaiveDate::from_ymd_opt(2026, m, day).unwrap();
        let daily = vec![(d(1, 31), 11_000.0), (d(2, 28), 9_900.0), (d(3, 31), 9_900.0)];
        let rows = super::metrics::monthly(&daily, 10_000.0);
        assert_eq!(rows[0]["months"][0], 10.0);
        assert_eq!(rows[0]["months"][1], -10.0);
        assert_eq!(rows[0]["months"][2], 0.0);
        assert_eq!(rows[0]["total"], -1.0);
    }
}

// Algo module pure logic: strategy rules in words (English catalog), stops / sizes / hours / limits, the service's
// notes, backtest periods per timeframe, money and ratio formatting, trade durations, structural sharing of polled
// answers, and the chart's downsampling (drawdowns and peaks survive).
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/algo-lib.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { createT } from "@kalks/i18n/core";
import { createFormatter } from "@kalks/i18n/format";
import type { Condition, Operand, RuleSet, StrategySpec } from "../src/features/algo/api.ts";
import { downsample, isoMinute } from "../src/features/algo/components/chart/types.ts";
import { ccyOf, held, int, money, moneyTone, num, pct, rangeShort, ratio, realizedOf, stageText, toUsd, usd, winRateOf } from "../src/features/algo/format.ts";
import { share } from "../src/features/algo/share.ts";
import { conditionText, defaultPeriod, distanceText, limitsText, maxDays, noteText, operandText, periodRange, periodsFor, riskRows, ruleLines, sizeText, specSignals, summarySignals, trailingText, windowText } from "../src/features/algo/spec.ts";

const t = createT("en");
const f = createFormatter("en");
const op = (p: Partial<Operand> & { kind: Operand["kind"] }): Operand => ({ field: "close", indicator: "none", period: 0, period2: 0, period3: 0, mult: 0, value: 0, pattern: "none", ...p });
const cond = (left: Operand, o: string, right: Operand, timeframe = "same"): Condition => ({ left, op: o, right, timeframe });
const EMPTY: RuleSet = { logic: "all", groups: [] };

const SPEC: StrategySpec = {
  name: "EMA trend",
  symbol: "EURUSD",
  timeframe: "H1",
  long: { logic: "all", groups: [{ logic: "all", conditions: [cond(op({ kind: "indicator", indicator: "ema", period: 20 }), "crosses_above", op({ kind: "indicator", indicator: "ema", period: 50 })), cond(op({ kind: "indicator", indicator: "rsi", period: 14 }), "lt", op({ kind: "value", value: 70 }))] }] },
  short: { logic: "all", groups: [{ logic: "all", conditions: [cond(op({ kind: "indicator", indicator: "ema", period: 20 }), "crosses_below", op({ kind: "indicator", indicator: "ema", period: 50 }))] }] },
  exitLong: EMPTY,
  exitShort: EMPTY,
  exitIntrabar: false,
  sizing: { mode: "lots", lots: 0.1, riskPct: 1 },
  maxLots: 0.1,
  sl: { mode: "atr", value: 2, atrPeriod: 14 },
  tp: { mode: "rr", value: 2, atrPeriod: 14 },
  trailing: { mode: "none", value: 0, atrPeriod: 14, breakevenTrigger: 0, breakevenOffset: 0 },
  sessions: [{ start: "08:00", end: "20:00" }],
  days: [5, 1, 2, 3, 4],
  closeOutsideSession: false,
  maxTradesPerDay: 3,
  maxDailyLoss: 200,
  oneAtATime: true,
};
const weekday = (d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]!;

test("operands: indicator defaults filled in, ADX smoothing only when it differs, the source named when not the close", () => {
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "ema", period: 21 })), "EMA(21)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "rsi" })), "RSI(14)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "macd_signal" })), "MACD signal(12, 26, 9)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "bb_lower", period: 20, mult: 2.5 })), "Lower Bollinger(20, 2.5)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "adx", period: 14, period2: 14 })), "ADX(14)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "plus_di", period: 14, period2: 20 })), "+DI(14, 20)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "sma", period: 50, field: "hl2" })), "SMA(50) · Median price");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "atr", period: 14, field: "high" })), "ATR(14)");
  assert.equal(operandText(t, op({ kind: "price", field: "open" })), "Open");
  assert.equal(operandText(t, op({ kind: "value", value: 1.2345 })), "1.2345");
  assert.equal(operandText(t, op({ kind: "candle", pattern: "shooting_star" })), "Shooting star");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "vwap_x", period: 9 })), "VWAP_X(9)");
});

test("conditions: crossings in words, comparisons as symbols, another timeframe named, a candle pattern alone", () => {
  assert.equal(conditionText(t, cond(op({ kind: "indicator", indicator: "ema", period: 20 }), "crosses_above", op({ kind: "indicator", indicator: "ema", period: 50 }))), "EMA(20) crosses above EMA(50)");
  assert.equal(conditionText(t, cond(op({ kind: "price" }), "gt", op({ kind: "indicator", indicator: "ema", period: 50 }), "H4")), "Close > EMA(50) on H4");
  assert.equal(conditionText(t, cond(op({ kind: "indicator", indicator: "rsi" }), "gte", op({ kind: "value", value: 30 }))), "RSI(14) ≥ 30");
  assert.equal(conditionText(t, cond(op({ kind: "candle", pattern: "doji" }), "gte", op({ kind: "value", value: 1 }))), "Doji");
  assert.equal(conditionText(t, cond(op({ kind: "candle", pattern: "hammer" }), "gt", op({ kind: "value", value: 0 }), "H4")), "Hammer on H4");
});

test("rule sets: conditions join with their group's logic, groups with the set's", () => {
  const rs: RuleSet = {
    logic: "any",
    groups: [
      { logic: "all", conditions: [cond(op({ kind: "indicator", indicator: "rsi" }), "lt", op({ kind: "value", value: 30 })), cond(op({ kind: "price" }), "gt", op({ kind: "indicator", indicator: "sma", period: 200 }))] },
      { logic: "any", conditions: [cond(op({ kind: "candle", pattern: "hammer" }), "gte", op({ kind: "value", value: 1 })), cond(op({ kind: "candle", pattern: "doji" }), "gte", op({ kind: "value", value: 1 }))] },
    ],
  };
  assert.deepEqual(
    ruleLines(t, rs).map((l) => [l.joiner, l.text]),
    [
      [null, "RSI(14) < 30"],
      ["and", "Close > SMA(200)"],
      ["or", "Hammer"],
      ["or", "Doji"],
    ],
  );
  assert.deepEqual(ruleLines(t, EMPTY), []);
  assert.deepEqual(ruleLines(t, null), []);
});

test("a spec's signals keep only the ones with rules, in buy / sell / exit order", () => {
  const sig = specSignals(t, SPEC);
  assert.deepEqual(
    sig.map((s) => [s.key, s.lines.length]),
    [
      ["buy", 2],
      ["sell", 1],
    ],
  );
  const sum = summarySignals({ sell: "crosses_below(a, b)", exit_buy: "close < b", buy: "  " });
  assert.deepEqual(
    sum.map((s) => s.key),
    ["sell", "exit_buy"],
  );
  assert.deepEqual(summarySignals(null), []);
});

test("stops, targets, trailing, size, hours and limits in words", () => {
  assert.equal(distanceText(t, { mode: "atr", value: 2, atrPeriod: 14 }), "2 × ATR(14)");
  assert.equal(distanceText(t, { mode: "rr", value: 1.5, atrPeriod: 14 }), "1.5R");
  assert.equal(distanceText(t, { mode: "pips", value: 20, atrPeriod: 0 }), "20 pips");
  assert.equal(distanceText(t, { mode: "none", value: 0, atrPeriod: 0 }), null);
  assert.equal(trailingText(t, { mode: "atr", value: 3, atrPeriod: 14, breakevenTrigger: 150, breakevenOffset: 10 }), "3 × ATR(14) · breakeven at 150 points (+10)");
  assert.equal(trailingText(t, SPEC.trailing), null);
  assert.equal(sizeText(t, SPEC), "0.1 lot");
  assert.equal(sizeText(t, { ...SPEC, sizing: { mode: "risk", lots: 0, riskPct: 0.5 }, maxLots: 5 }), "0.5% risk per trade · max 5 lot");
  assert.equal(windowText(t, SPEC, weekday), "08:00–20:00 · Mon Tue Wed Thu Fri");
  assert.equal(windowText(t, { ...SPEC, sessions: [], days: [] }, weekday), "Around the clock");
  assert.equal(limitsText(t, SPEC, (v) => `$${v}`), "3 trades a day · Stops for the day at a $200 loss · One position at a time");
  assert.equal(limitsText(t, { maxTradesPerDay: 0, maxDailyLoss: 0, oneAtATime: false }, (v) => `$${v}`), "No daily limits");
  const rows = riskRows(t, SPEC, (v) => `$${v}`, weekday);
  assert.deepEqual(
    rows.map((r) => r.label),
    ["Size", "Stop loss", "Take profit", "Trailing", "Trading hours", "Limits"],
  );
  // a listing's risk without a trailing object or hours still reads
  assert.deepEqual(
    riskRows(t, { sizing: SPEC.sizing, sl: SPEC.sl }, (v) => `$${v}`, weekday).map((r) => r.label),
    ["Size", "Stop loss", "Limits"],
  );
});

test("the service's notes read in the catalog's words; unknown notes keep their wording", () => {
  assert.equal(noteText(t, "No daily trade limit"), "No daily trade limit");
  assert.equal(noteText(t, "Take profit as R multiple needs a stop loss"), "A take profit in R needs a stop loss");
  assert.equal(noteText(t, "Something new"), "Something new");
});

test("backtest periods never exceed what the service allows for the timeframe", () => {
  assert.equal(maxDays("M1"), 60);
  assert.equal(maxDays("H1"), 1826);
  assert.equal(maxDays("D1"), 7305);
  assert.deepEqual(
    periodsFor("M1").map((p) => p.key),
    ["p1m"],
  );
  assert.deepEqual(
    periodsFor("M5").map((p) => p.key),
    ["p1m", "p3m", "p6m", "p1y"],
  );
  assert.deepEqual(
    periodsFor("H4").map((p) => p.key),
    ["p1m", "p3m", "p6m", "p1y", "p2y", "p5y"],
  );
  for (const tf of ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]) assert.ok(periodsFor(tf).some((p) => p.key === defaultPeriod(tf)), tf);
  const [from, to] = periodRange("p3m", Date.UTC(2026, 8, 30));
  assert.equal(to - from, 91 * 86400);
});

test("money, percentages and ratios: Latin digits, a real minus sign, no -0.00", () => {
  assert.equal(usd(1234.5), "$1,234.50");
  assert.equal(usd(-211.13, true), "−$211.13");
  assert.equal(usd(43.87, true), "+$43.87");
  assert.equal(usd(-0.001, true), "$0.00");
  assert.equal(usd(10000, false, 0), "$10,000");
  assert.equal(pct(-2.1134), "−2.11%");
  assert.equal(pct(24.14, 1, false), "24.1%");
  assert.equal(ratio(0.564), "0.56");
  assert.equal(ratio(-1.614), "−1.61");
  assert.equal(ratio(null), "—");
  assert.equal(int(15899), "15,899");
  assert.equal(num(0.1), "0.1");
  assert.equal(moneyTone(0), "secondary");
  assert.equal(moneyTone(-3), "down");
  assert.equal(realizedOf({ stats: { realized: 12.5 } }), 12.5);
  assert.equal(winRateOf({ stats: { trades: 4, wins: 1 } }), 25);
  assert.equal(winRateOf({ stats: {} }), null);
});

test("account money in its own currency: a cent account's P&L is USC, totals add up in USD", () => {
  assert.equal(ccyOf({ cent: true, currency: "USC" }), "USC");
  assert.equal(ccyOf({ cent: false, currency: "USC" }), "USC");
  assert.equal(ccyOf({ cent: false, currency: "USD" }), "USD");
  assert.equal(ccyOf(undefined), "USD");
  assert.equal(money(-60, "USC", true), "−¢60.00");
  assert.equal(money(1_000_000, "USC", false, 0), "¢1,000,000");
  assert.equal(money(-0.6, "USD", true), "−$0.60");
  // the Algo home's total: −0.60 USD on a standard account and −60 USC on a cent account are −1.20 USD, not −60.60
  assert.equal(toUsd(-0.6, "USD") + toUsd(-60, "USC"), -1.2);
});

test("trade durations and ranges, compact", () => {
  assert.equal(held(t, 45 * 60), "45m");
  assert.equal(held(t, 5 * 3600), "5h");
  assert.equal(held(t, 5 * 3600 + 20 * 60), "5h 20m");
  assert.equal(held(t, 3 * 86400 + 14 * 3600), "3d 14h");
  assert.equal(held(t, 2 * 86400), "2d");
  assert.match(rangeShort(f, Date.UTC(2026, 2, 30) / 1000, Date.UTC(2026, 8, 29) / 1000), /^30 Mar – 29 Sep/);
  assert.match(rangeShort(f, Date.UTC(2024, 9, 1) / 1000, Date.UTC(2026, 8, 29) / 1000), /^Oct 24 – Sept? 26$/);
  assert.equal(stageText(t, "loading M1 bars", "running"), "Loading minute bars");
  assert.equal(stageText(t, "simulating 40%", "running"), "Simulating trades");
  assert.equal(stageText(t, null, "queued"), "Waiting for a free worker");
});

test("structural sharing keeps unchanged parts identical (rows skip their render)", () => {
  const prev = { items: [{ id: 1, stats: { trades: 2 } }, { id: 2, stats: { trades: 0 } }], at: "x" };
  const same = share(prev, JSON.parse(JSON.stringify(prev)));
  assert.equal(same, prev);
  const next = share(prev, { items: [{ id: 1, stats: { trades: 3 } }, { id: 2, stats: { trades: 0 } }], at: "x" });
  assert.notEqual(next, prev);
  assert.notEqual(next.items[0], prev.items[0]);
  assert.equal(next.items[1], prev.items[1]);
  assert.deepEqual(share(undefined, [1, 2]), [1, 2]);
});

test("chart downsampling keeps the first, the last, the lows and the highs, in time order", () => {
  const values = Array.from({ length: 1500 }, (_, i) => 10000 + Math.sin(i / 20) * 100 - (i === 777 ? 900 : 0) + (i === 1200 ? 500 : 0));
  const idx = downsample(values, 100);
  assert.ok(idx.length <= 2 * 100 + 2, `${idx.length} points`);
  assert.equal(idx[0], 0);
  assert.equal(idx.at(-1), 1499);
  assert.ok(idx.includes(777), "the deepest drawdown survives");
  assert.ok(idx.includes(1200), "the highest peak survives");
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i]! > idx[i - 1]!, "time order");
  assert.deepEqual(downsample([1, 2, 3], 100), [0, 1, 2]);
  assert.equal(isoMinute(Date.UTC(2026, 3, 2, 11, 0)), "2026-04-02 14:00");
});

// AI Trader and support chat pure logic: strategy rules in words (English catalog), stops / sizes / limits, the
// service's notes, backtest periods per timeframe, the spec fingerprint, and where the support stream is opened.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/ai-lib.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { createT } from "@kalks/i18n/core";
import { conditionText, defaultPeriod, distanceText, limitsText, maxDays, noteText, openRefinements, operandText, periodsFor, ruleLines, sizeText, specKey, trailingText, windowText } from "../src/features/ai/spec.ts";
import type { Condition, Operand, RuleSet, StrategySpec } from "../src/features/ai/api.ts";
import { runningDeployment, withoutFailed } from "../src/features/ai/conversation.ts";
import type { AiMessage } from "../src/features/ai/thread.ts";
import type { Conversation, Message } from "../src/features/support/api.ts";
import { answeredAfter, mergeConversation } from "../src/features/support/merge.ts";
import { streamBase } from "../src/features/support/url.ts";

const t = createT("en");
const op = (p: Partial<Operand> & { kind: Operand["kind"] }): Operand => ({ field: "close", indicator: "none", period: 0, period2: 0, period3: 0, mult: 0, value: 0, pattern: "none", ...p });
const cond = (left: Operand, o: string, right: Operand, timeframe = "same"): Condition => ({ left, op: o, right, timeframe });

const SPEC: StrategySpec = {
  name: "EMA trend",
  symbol: "EURUSD",
  timeframe: "H1",
  long: { logic: "any", groups: [{ logic: "all", conditions: [cond(op({ kind: "indicator", indicator: "ema", period: 20 }), "crosses_above", op({ kind: "indicator", indicator: "ema", period: 50 })), cond(op({ kind: "indicator", indicator: "rsi", period: 14 }), "lt", op({ kind: "value", value: 70 }))] }] },
  short: { logic: "any", groups: [] },
  exitLong: { logic: "any", groups: [] },
  exitShort: { logic: "any", groups: [] },
  exitIntrabar: false,
  sizing: { mode: "lots", lots: 0.1, riskPct: 0 },
  maxLots: 0.1,
  sl: { mode: "pips", value: 25, atrPeriod: 14 },
  tp: { mode: "rr", value: 2, atrPeriod: 14 },
  trailing: { mode: "none", value: 0, atrPeriod: 14, breakevenTrigger: 0, breakevenOffset: 0 },
  sessions: [],
  days: [],
  closeOutsideSession: false,
  maxTradesPerDay: 0,
  maxDailyLoss: 0,
  oneAtATime: true,
};

test("operands read like a trader writes them (defaults filled, ADX smoothing only when it differs)", () => {
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "ema", period: 21 })), "EMA(21)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "rsi" })), "RSI(14)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "macd" })), "MACD(12, 26, 9)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "bb_upper", period: 20, mult: 2.5 })), "Upper Bollinger(20, 2.5)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "adx", period: 14, period2: 14 })), "ADX(14)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "adx", period: 14, period2: 20 })), "ADX(14, 20)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "highest", period: 20 })), "Highest high(20)");
  assert.equal(operandText(t, op({ kind: "indicator", indicator: "ema", period: 20, field: "high" })), "EMA(20) · High");
  assert.equal(operandText(t, op({ kind: "price", field: "close" })), "Close");
  assert.equal(operandText(t, op({ kind: "value", value: 1.23450 })), "1.2345");
  assert.equal(operandText(t, op({ kind: "candle", pattern: "bullish_engulfing" })), "Bullish engulfing");
});

test("conditions: crossings in words, comparisons as symbols, another timeframe named, a candle pattern alone", () => {
  assert.equal(conditionText(t, cond(op({ kind: "indicator", indicator: "ema", period: 20 }), "crosses_above", op({ kind: "indicator", indicator: "ema", period: 50 }))), "EMA(20) crosses above EMA(50)");
  assert.equal(conditionText(t, cond(op({ kind: "price" }), "gt", op({ kind: "indicator", indicator: "ema", period: 50 }), "H4")), "Close > EMA(50) on H4");
  assert.equal(conditionText(t, cond(op({ kind: "candle", pattern: "hammer" }), "gte", op({ kind: "value", value: 1 }))), "Hammer");
  assert.equal(conditionText(t, cond(op({ kind: "indicator", indicator: "rsi" }), "lte", op({ kind: "value", value: 30 }))), "RSI(14) ≤ 30");
});

test("rule sets become lines joined by and / or, following the group and set logic", () => {
  const two: RuleSet = {
    logic: "any",
    groups: [
      { logic: "all", conditions: [cond(op({ kind: "price" }), "gt", op({ kind: "value", value: 1 })), cond(op({ kind: "price" }), "lt", op({ kind: "value", value: 2 }))] },
      { logic: "any", conditions: [cond(op({ kind: "price" }), "gt", op({ kind: "value", value: 3 })), cond(op({ kind: "price" }), "gt", op({ kind: "value", value: 4 }))] },
    ],
  };
  assert.deepEqual(
    ruleLines(t, two).map((l) => l.joiner),
    [null, "and", "or", "or"],
  );
  assert.deepEqual(ruleLines(t, { logic: "all", groups: [] }), []);
  assert.deepEqual(ruleLines(t, undefined), []);
});

test("stops, targets, trailing, size and limits in plain words", () => {
  assert.equal(distanceText(t, { mode: "pips", value: 25, atrPeriod: 14 }), "25 pips");
  assert.equal(distanceText(t, { mode: "atr", value: 1.5, atrPeriod: 14 }), "1.5 × ATR(14)");
  assert.equal(distanceText(t, { mode: "rr", value: 2, atrPeriod: 14 }), "2R");
  assert.equal(distanceText(t, { mode: "percent", value: 2, atrPeriod: 14 }), "2%");
  assert.equal(distanceText(t, { mode: "none", value: 0, atrPeriod: 14 }), null);
  assert.equal(trailingText(t, { mode: "pips", value: 15, atrPeriod: 14, breakevenTrigger: 200, breakevenOffset: 10 }), "15 pips · breakeven after 200 points");
  assert.equal(trailingText(t, SPEC.trailing), null);
  assert.equal(sizeText(t, SPEC), "0.1 lots");
  assert.equal(sizeText(t, { ...SPEC, sizing: { mode: "risk", lots: 0, riskPct: 1 }, maxLots: 1 }), "1% risk · max 1 lots");
  assert.equal(limitsText(t, { ...SPEC, maxTradesPerDay: 3, maxDailyLoss: 200 }, (v) => `$${v}`), "3 trades a day · stops for the day after a $200 loss · one position at a time");
  assert.equal(limitsText(t, { ...SPEC, oneAtATime: false }, String), "No limits");
  assert.equal(windowText(t, { ...SPEC, sessions: [{ start: "08:00", end: "17:00" }], days: [1, 2, 3, 4, 5] }, (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]!), "08:00–17:00 · Mon Tue Wed Thu Fri");
  assert.equal(windowText(t, SPEC, String), "All day");
});

test("the service's notes are translated when known, kept otherwise", () => {
  assert.equal(noteText(t, "No daily trade limit"), "No daily trade limit");
  assert.equal(noteText(t, "Risk-based sizing needs a stop loss"), "Risk-based size needs a stop loss");
  assert.equal(noteText(t, "Volume must be at least 0.01 lot"), "The size must be at least 0.01 lots");
  assert.equal(noteText(t, "Something new from the server"), "Something new from the server");
});

test("backtest periods never exceed the service's range per timeframe", () => {
  assert.equal(maxDays("M1"), 60);
  assert.deepEqual(periodsFor("M1").map((p) => p.key), ["p1m"]);
  assert.deepEqual(periodsFor("M5").map((p) => p.key), ["p1m", "p3m", "p6m", "p1y"]);
  assert.ok(periodsFor("H1").every((p) => p.days <= maxDays("H1")));
  assert.equal(periodsFor("D1").length, 6);
  for (const tf of ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]) assert.ok(periodsFor(tf).some((p) => p.key === defaultPeriod(tf)), tf);
});

test("the spec fingerprint ignores key order and changes with any value", () => {
  const reverse = (v: unknown): unknown => (Array.isArray(v) ? v.map(reverse) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverse(x)])) : v);
  const reordered = reverse(SPEC) as StrategySpec;
  assert.notDeepEqual(Object.keys(reordered), Object.keys(SPEC));
  assert.equal(specKey(SPEC), specKey(reordered));
  assert.notEqual(specKey(SPEC), specKey({ ...SPEC, sl: { ...SPEC.sl, value: 26 } }));
  assert.notEqual(specKey(SPEC), specKey({ ...SPEC, name: "EMA trend 2" }));
});

test("the support stream: the ticket's public URL, else the Client Area host (edge / dev relay), never loopback for a phone", () => {
  assert.equal(streamBase(null, "https://app.kalkstrade.com"), "wss://app.kalkstrade.com/support/stream");
  assert.equal(streamBase("wss://chat.broker.com/support/stream", "https://app.broker.com"), "wss://chat.broker.com/support/stream");
  assert.equal(streamBase("ws://127.0.0.1:8100/v1/stream", "http://192.168.1.20:8790"), "ws://192.168.1.20:8790/support/stream");
  assert.equal(streamBase("ws://127.0.0.1:8100/v1/stream", "http://localhost:8798"), "ws://127.0.0.1:8100/v1/stream");
  assert.equal(streamBase("ws://localhost:8100/v1/stream", "https://app.kalkstrade.com/"), "wss://app.kalkstrade.com/support/stream");
});

test("refinement pills: only what the draft doesn't have yet", () => {
  // SPEC: fixed lots, no trailing stop, all day, no daily trade cap, buy rules only ("buys only" is already true)
  assert.deepEqual(openRefinements(SPEC), ["trailing", "session", "risk", "limit"]);
  const full: StrategySpec = {
    ...SPEC,
    trailing: { ...SPEC.trailing, mode: "pips", value: 15 },
    sessions: [{ start: "08:00", end: "17:00" }],
    sizing: { mode: "risk", lots: 0, riskPct: 1 },
    maxTradesPerDay: 3,
  };
  assert.deepEqual(openRefinements(full), []);
  // with sell rules, "buys only" is worth offering
  assert.deepEqual(openRefinements({ ...full, short: SPEC.long }), ["longOnly"]);
  // a trailing mode without a distance is not a trailing stop
  assert.deepEqual(openRefinements({ ...full, trailing: { ...SPEC.trailing, mode: "pips", value: 0 } }), ["trailing"]);
});

test("asking again after an error replaces that exchange; other messages stay", () => {
  const msgs: AiMessage[] = [
    { id: "u1", kind: "user", at: 1, text: "EMA cross" },
    { id: "d1", kind: "notice", at: 2, text: "Stopped" },
    { id: "u2", kind: "user", at: 3, text: "RSI dip" },
    { id: "e2", kind: "error", at: 4, text: "Can't reach Kalks", prompt: "RSI dip" },
  ];
  assert.deepEqual(withoutFailed(msgs, "e2").map((m) => m.id), ["u1", "d1"]);
  // the error answered something else (e.g. the app was closed mid-request): only the error goes
  const other: AiMessage[] = [msgs[0]!, { id: "e1", kind: "error", at: 2, text: "Interrupted", prompt: "a different prompt" }];
  assert.deepEqual(withoutFailed(other, "e1").map((m) => m.id), ["u1"]);
  assert.equal(withoutFailed(msgs, undefined), msgs);
  assert.equal(withoutFailed(msgs, "u1"), msgs, "only an error bubble is removed");
});

test("a Deploy retried after a lost answer finds the deployment that runs that version on that account", () => {
  const items = [
    { id: 1, versionId: 9, login: 50000001, status: "stopped" },
    { id: 2, versionId: 9, login: 50000002, status: "running" },
    { id: 3, versionId: 9, login: 50000001, status: "paused" },
  ];
  assert.equal(runningDeployment(items, 9, 50000001), 3);
  assert.equal(runningDeployment(items, 9, 50000002), 2);
  assert.equal(runningDeployment(items, 8, 50000001), null);
});

test("support: an HTTP answer never rolls back a later state the stream delivered", () => {
  const conv = (id: number, status: Conversation["status"]): Conversation => ({ id, subject: "", status, assigneeName: null, handedOverAt: null, clientUnread: 0, csat: null, resolvedAt: null, createdAt: "", lastMessageAt: "", preview: "" });
  // the bot handed over (stream) before the answer to the client's message (still "bot") arrived
  assert.equal(mergeConversation(conv(1, "waiting"), conv(1, "bot")).status, "waiting");
  assert.equal(mergeConversation(conv(1, "bot"), conv(1, "waiting")).status, "waiting");
  assert.equal(mergeConversation(conv(1, "assigned"), conv(1, "resolved")).status, "resolved");
  // a new conversation (after an ended one) always wins
  assert.equal(mergeConversation(conv(1, "resolved"), conv(2, "bot")).id, 2);
  assert.equal(mergeConversation(null, conv(2, "bot")).id, 2);
  const msg = (id: number, author: Message["author"]): Message => ({ id, conversationId: 1, author, authorName: null, body: "", attachment: null, meta: {}, createdAt: "" });
  assert.equal(answeredAfter([msg(10, "client")], 10), false);
  assert.equal(answeredAfter([msg(10, "client"), msg(11, "bot")], 10), true);
  assert.equal(answeredAfter([msg(9, "bot"), msg(10, "client")], 10), false, "an earlier answer doesn't count");
});

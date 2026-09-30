// Prop feature pure logic (src/features/prop/lib.ts): the live rule maths the gauges run on the UI thread (the same
// definitions as services/prop/src/rules.rs), the 17:00 New York reset clock and how a purchase answer is read.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/prop-lib.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { clamp01, dailyShare, dailyUsedOf, ddFloorOf, ddShare, ddUsedOf, endedPurchase, hms, isFinalRefusal, isSoftError, nextNyClose, targetShare, type LiveParams } from "../src/features/prop/lib.ts";

const base: LiveParams = { initial: 100_000, dailyRef: 100_000, dailyLimit: 5_000, ddLimit: 10_000, hwm: 100_000, trailing: false, lock: false, target: 8_000 };

test("daily loss is measured from the reset reference on equity, never below zero", () => {
  assert.equal(dailyUsedOf(base, 96_000), 4_000);
  assert.equal(dailyShare(base, 96_000), 0.8);
  assert.equal(dailyShare(base, 95_000), 1, "at the floor the limit is used up");
  assert.equal(dailyShare(base, 90_000), 1, "past the floor it stays full");
  assert.equal(dailyUsedOf(base, 101_000), 0, "a winning day uses nothing");
  // equity basis: the reference is the higher of balance and equity at the reset (the evaluator's dailyRef)
  assert.equal(dailyUsedOf({ ...base, dailyRef: 103_000 }, 100_000), 3_000);
  assert.equal(dailyShare({ ...base, dailyLimit: 0 }, 50_000), 0, "no limit, no gauge");
});

test("static drawdown floor is the initial balance minus the limit, whatever the peak", () => {
  assert.equal(ddFloorOf(base, 120_000, 120_000), 90_000);
  assert.equal(ddUsedOf(base, 95_000, 100_000), 5_000);
  assert.equal(ddShare(base, 95_000, 100_000), 0.5);
  assert.equal(ddShare(base, 89_000, 100_000), 1);
});

test("trailing drawdown follows the high-water mark of balance and equity, and locks at the start when set", () => {
  const trailing = { ...base, trailing: true };
  assert.equal(ddFloorOf(trailing, 104_000, 102_000), 94_000, "the floor rises with a new equity peak");
  assert.equal(ddFloorOf(trailing, 99_000, 103_000), 93_000, "a balance peak counts too");
  assert.equal(ddFloorOf({ ...trailing, hwm: 106_000 }, 101_000, 101_000), 96_000, "the evaluator's peak is kept");
  assert.equal(ddUsedOf({ ...trailing, hwm: 106_000 }, 101_000, 101_000), 5_000, "used = drop from the peak");
  const locked = { ...trailing, lock: true };
  assert.equal(ddFloorOf(locked, 115_000, 115_000), 100_000, "with the lock the floor stops at the initial balance");
  assert.equal(ddFloorOf(locked, 104_000, 104_000), 94_000, "below the lock it still trails");
  assert.equal(ddShare({ ...locked, hwm: 115_000 }, 100_000, 100_000), 1, "equity at the locked floor is a breach");
});

test("the profit target counts closed profit (balance) and is clamped to 0–1", () => {
  assert.equal(targetShare(base, 104_000), 0.5);
  assert.equal(targetShare(base, 99_000), 0, "a loss is no progress");
  assert.equal(targetShare(base, 120_000), 1);
  assert.equal(targetShare({ ...base, target: 0 }, 120_000), 0, "funded accounts have no target");
  assert.equal(clamp01(Number.NaN), 0);
  assert.equal(clamp01(1.4), 1);
});

test("the daily reset is 17:00 New York: 21:00 UTC in daylight time, 22:00 UTC otherwise", () => {
  const at = (iso: string) => nextNyClose(new Date(iso)).toISOString();
  assert.equal(at("2026-07-15T12:00:00Z"), "2026-07-15T21:00:00.000Z");
  assert.equal(at("2026-07-15T21:00:00Z"), "2026-07-16T21:00:00.000Z", "at the close, the next one");
  assert.equal(at("2026-01-15T21:30:00Z"), "2026-01-15T22:00:00.000Z", "winter: 22:00 UTC, still ahead at 21:30");
  assert.equal(at("2026-01-15T23:00:00Z"), "2026-01-16T22:00:00.000Z");
});

test("the day after a daylight-time switch gets its own hour", () => {
  const at = (iso: string) => nextNyClose(new Date(iso)).toISOString();
  // daylight time ends on Sunday 1 November 2026: the Sunday close is 22:00 UTC (it was computed as 21:00)
  assert.equal(at("2026-10-31T21:30:00Z"), "2026-11-01T22:00:00.000Z");
  // it starts on Sunday 8 March 2026: the Sunday close is 21:00 UTC (it was computed as 22:00)
  assert.equal(at("2026-03-07T22:30:00Z"), "2026-03-08T21:00:00.000Z");
});

test("countdowns read hh:mm:ss", () => {
  assert.equal(hms(5 * 3_600_000 + 12 * 60_000 + 33_000), "05:12:33");
  assert.equal(hms(-5), "00:00:00");
  assert.equal(hms(null), "--:--:--");
});

test("a purchase retry reuses its idempotency key only when the outcome is unknown", () => {
  // final refusals: a new key, or the retry replays the refused purchase (payment_failed for ever)
  assert.equal(isFinalRefusal({ code: "insufficient_funds", status: 422 }), true);
  assert.equal(isFinalRefusal({ code: "plan_unavailable", status: 422 }), true);
  assert.equal(isFinalRefusal({ code: "account_unavailable", status: 422 }), true);
  assert.equal(isFinalRefusal({ code: "idempotency_conflict", status: 409 }), true);
  assert.equal(isFinalRefusal({ code: "staff_read_only", status: 403 }), true);
  // unknown outcomes: the same key, so the fee is never charged twice
  assert.equal(isFinalRefusal({ code: "payment_pending", status: 502 }), false);
  assert.equal(isFinalRefusal({ code: "provisioning", status: 502 }), false);
  assert.equal(isFinalRefusal({ code: "engine_unavailable", status: 502 }), false);
  assert.equal(isFinalRefusal({ code: "network", status: 0 }), false);
  assert.equal(isFinalRefusal({ code: "network" }), false);
  assert.equal(isSoftError("wallet_pending"), true);
  assert.equal(isSoftError("insufficient_funds"), false);
});

test("an answer carrying an ended challenge is an error, never a new purchase", () => {
  assert.equal(endedPurchase("closed"), "account_unavailable");
  assert.equal(endedPurchase("payment_failed"), "payment_failed");
  assert.equal(endedPurchase("failed"), "payment_failed");
  for (const live of ["active", "funded", "provisioning", "pending_payment", undefined]) assert.equal(endedPurchase(live), null);
});

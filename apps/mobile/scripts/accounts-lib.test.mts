// Accounts feature pure logic: the Client Area's open-account rules, password rule, demo balances, margin level health,
// number sizing and structural sharing of polled answers.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/accounts-lib.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  canTrade,
  curOf,
  demoBalancesFor,
  demoFull,
  fitMono,
  fmtLevel,
  groupColor,
  groupMoney,
  lev,
  levelTone,
  money,
  notFunded,
  offers,
  passwordOk,
  PASSWORD_RULES,
  refillsLeft,
  toUsd,
  usedIn,
} from "../src/features/accounts/format.ts";
import { share } from "../src/features/accounts/share.ts";
import type { Account, Group } from "../src/features/accounts/types.ts";

const group = (g: Partial<Group> = {}): Group => ({
  code: "standard",
  name: "Standard",
  mode: "hedging",
  cent: false,
  accountTypes: "both",
  leverages: [50, 100, 500],
  defaultLeverage: 100,
  marginCallPct: 100,
  stopOutPct: 50,
  minDeposit: 0,
  swapFree: false,
  commissionPerLot: 0,
  maxAccountsPerUser: 2,
  demoInitialBalance: 10000,
  demoRefillsPerDay: 3,
  demoExpiryDays: 10,
  enabled: true,
  ...g,
});

const account = (a: Partial<Account> = {}): Account => ({
  login: 50000001,
  type: "live",
  group: "standard",
  groupName: "Standard",
  mode: "hedging",
  cent: false,
  currency: "USD",
  leverage: 100,
  leverages: [50, 100, 500],
  status: "active",
  name: "",
  marginCall: false,
  marginCallLevel: 100,
  stopOutLevel: 50,
  positions: 0,
  orders: 0,
  balance: 0,
  credit: 0,
  bonus: 0,
  profit: 0,
  swap: 0,
  equity: 0,
  margin: 0,
  freeMargin: 0,
  marginLevel: null,
  createdAt: "2026-09-30T00:00:00Z",
  ...a,
});

test("open-account offers: enabled, never prop-challenge groups, only the kinds a group allows", () => {
  assert.equal(offers(group(), "live"), true);
  assert.equal(offers(group(), "demo"), true);
  assert.equal(offers(group({ enabled: false }), "live"), false);
  assert.equal(offers(group({ code: "prop-100k" }), "live"), false);
  assert.equal(offers(group({ code: "PROP" }), "demo"), false);
  assert.equal(offers(group({ accountTypes: "live" }), "demo"), false);
  assert.equal(offers(group({ accountTypes: "demo" }), "demo"), true);
});

test("the per-type account limit counts only accounts of that kind in that group", () => {
  const list = [account({ login: 1 }), account({ login: 2, type: "demo" }), account({ login: 3, group: "pro" }), account({ login: 4 })];
  assert.equal(usedIn(list, group(), "live"), 2);
  assert.equal(usedIn(list, group(), "demo"), 1);
  assert.equal(usedIn(list, group({ code: "pro" }), "live"), 1);
});

test("trading password rule: 8–64 characters with a letter and a digit (same as the BFF and the engine)", () => {
  for (const ok of ["Trade2026x", "abcdefg1", "Пароль2026", "a".repeat(63) + "1"]) assert.equal(passwordOk(ok), true, ok);
  for (const bad of ["short1", "12345678", "abcdefgh", "a".repeat(64) + "1", ""]) assert.equal(passwordOk(bad), false, bad);
  assert.deepEqual(
    PASSWORD_RULES.map((r) => r.test("abc")),
    [false, true, false],
  );
});

test("demo balances include the type's default, stay within the engine's 100–1,000,000 and are sorted", () => {
  assert.deepEqual(demoBalancesFor(group({ demoInitialBalance: 7500 })), [1000, 5000, 7500, 10000, 25000, 50000, 100000]);
  assert.deepEqual(demoBalancesFor(group({ demoInitialBalance: 10000 })), [1000, 5000, 10000, 25000, 50000, 100000]);
  assert.ok(demoBalancesFor(group({ demoInitialBalance: 5_000_000 })).every((b) => b <= 1_000_000));
});

test("cent accounts count in USC (USD × 100)", () => {
  const cent = account({ cent: true, currency: "USC" });
  assert.equal(curOf(cent), "USC");
  assert.equal(curOf(account()), "USD");
  assert.equal(toUsd(cent, 123456), 1234.56);
  assert.equal(toUsd(account(), 12.5), 12.5);
  assert.equal(groupMoney(10000, group({ cent: true })), "¢1,000,000");
  assert.equal(groupMoney(10000, group()), "$10,000");
  assert.equal(money(1234.5, account()), "$1,234.50");
  assert.equal(money(-5, cent, { signed: true }), "−¢5.00");
});

test("margin level: no margin used shows a dash; health thresholds 500 % and 200 %", () => {
  assert.equal(fmtLevel(account({ margin: 0, marginLevel: null })), "—");
  assert.equal(levelTone(account({ margin: 0, marginLevel: null })), null);
  assert.equal(fmtLevel(account({ margin: 80, marginLevel: 1250.4 })), "1,250%");
  assert.equal(levelTone(account({ margin: 80, marginLevel: 1250 })), "ok");
  assert.equal(levelTone(account({ margin: 80, marginLevel: 451 })), "warn");
  assert.equal(levelTone(account({ margin: 80, marginLevel: 150 })), "risk");
});

test("demo refills: left today, full at the starting amount; trading blocked when disabled or expired", () => {
  const demo = account({ type: "demo", balance: 9000, demo: { initialBalance: 10000, refillsPerDay: 3, refillsUsedToday: 1, expiryDays: 10 } });
  assert.equal(refillsLeft(demo), 2);
  assert.equal(refillsLeft(account()), 0);
  assert.equal(demoFull(demo), false);
  assert.equal(demoFull({ ...demo, balance: 10000 }), true);
  assert.equal(canTrade(account({ status: "close_only" })), true);
  assert.equal(canTrade(account({ status: "disabled" })), false);
  assert.equal(canTrade(account({ status: "expired" })), false);
  assert.equal(notFunded(account()), true);
  assert.equal(notFunded(account({ type: "demo" })), false);
});

test("leverage and figure sizing", () => {
  assert.equal(lev(500), "1:500");
  assert.equal(lev(1000), "1:1,000");
  assert.equal(fitMono("$0.00", 302, 42), 42);
  const big = fitMono("¢1,000,000.00", 302, 42, 24);
  assert.ok(big < 42 && big >= 24);
  assert.ok(big * 0.6 * "¢1,000,000.00".length <= 302);
  assert.equal(fitMono("x".repeat(200), 100, 42, 18), 18);
});

test("account types keep their colour wherever they are listed", () => {
  const all = [group({ code: "cent" }), group({ code: "ecn" }), group({ code: "pro" })];
  assert.equal(groupColor("ecn", all), groupColor("ecn", all));
  assert.notEqual(groupColor("cent", all), groupColor("ecn", all));
  assert.equal(typeof groupColor("unknown", all), "string");
});

test("structural sharing keeps unchanged objects and the whole answer when nothing changed", () => {
  const prev = { accounts: [account({ login: 1, equity: 10 }), account({ login: 2, equity: 20 })] };
  const same = JSON.parse(JSON.stringify(prev));
  assert.equal(share(prev, same), prev);
  const next = JSON.parse(JSON.stringify(prev));
  next.accounts[1].equity = 21;
  const out = share(prev, next);
  assert.notEqual(out, prev);
  assert.equal(out.accounts[0], prev.accounts[0], "unchanged account keeps its identity");
  assert.notEqual(out.accounts[1], prev.accounts[1]);
  assert.equal(out.accounts[1].equity, 21);
  assert.deepEqual(share(undefined, next), next);
});

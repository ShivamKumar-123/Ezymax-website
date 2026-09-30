// Core pure logic: the account the app opens on, structural sharing of cached answers (selectors), the Trade tab's
// news / calendar links, and the figures of the P&L share card.
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/core-lib.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { share } from "../src/lib/structural.ts";
import { isProgrammeAccount, noTradingAccount, pickDefault } from "../src/features/trading/pick.ts";
import { calendarCurrency, matchSymbol, symbolCurrencies } from "../src/features/trade/currencies.ts";
import { movePct, netOf, positionSide, referralLink, shareFileName, shareTrade } from "../src/features/portfolio/share/pnl.ts";

type Acc = { login: number; type: "live" | "demo"; group: string; status: string };
const acc = (login: number, type: "live" | "demo", group: string, status = "active"): Acc => ({ login, type, group, status });

test("programme accounts: prop*, copy, copy-netting, pamm and mam groups (any case); other groups are standard", () => {
  for (const g of ["prop", "prop-100k", "PROP_50K", "copy", "copy-netting", "Copy-Netting", "pamm", "mam", "mam.pro"]) assert.equal(isProgrammeAccount({ group: g }), true, g);
  for (const g of ["standard", "pro-netting", "ecn", "copycat", "mamba", "pammy", "cent", ""]) assert.equal(isProgrammeAccount({ group: g }), false, g);
});

test("the default account: a standard live one, else a standard demo one; never prop, copy, PAMM or MAM", () => {
  assert.equal(pickDefault([acc(1, "live", "prop-100k"), acc(2, "demo", "standard")]), 2);
  assert.equal(pickDefault([acc(1, "live", "copy"), acc(2, "live", "pamm"), acc(3, "live", "mam"), acc(4, "live", "copy-netting"), acc(5, "demo", "prop")]), null);
  assert.equal(pickDefault([acc(1, "demo", "standard"), acc(2, "live", "standard")]), 2, "live before demo");
  assert.equal(pickDefault([acc(1, "live", "standard", "disabled"), acc(2, "demo", "standard")]), 2, "an active account before a disabled one");
  assert.equal(pickDefault([acc(1, "live", "standard", "close_only"), acc(2, "live", "prop")]), 1, "a standard account in any status before a programme one");
  assert.equal(pickDefault([acc(7, "demo", "standard", "expired")]), 7);
  assert.equal(pickDefault([]), null);
  assert.equal(pickDefault([{ login: 9, type: "live", group: "ecn", status: "" }]), 9, "no status counts as active");
});

test("nothing to trade on: no account, or only programme accounts and none chosen", () => {
  assert.equal(noTradingAccount(undefined, null), false, "not known yet");
  assert.equal(noTradingAccount([], null), true);
  assert.equal(noTradingAccount([{ group: "prop-10k" }], null), true);
  assert.equal(noTradingAccount([{ group: "prop-10k" }], 5001), false, "a prop account chosen on purpose (Open in Trade)");
  assert.equal(noTradingAccount([{ group: "standard" }], null), false, "the default is about to be picked");
});

test("structural sharing: unchanged parts keep their identity, changed parts are new", () => {
  const prev = {
    accounts: [
      { login: 1, equity: 100, group: "a" },
      { login: 2, equity: 50, group: "b" },
    ],
    at: "x",
  };
  const same = JSON.parse(JSON.stringify(prev));
  assert.equal(share(prev, same), prev, "a deep-equal answer is the previous object");
  const next = {
    accounts: [
      { login: 1, equity: 101, group: "a" },
      { login: 2, equity: 50, group: "b" },
    ],
    at: "x",
  };
  const out = share(prev, next);
  assert.notEqual(out, prev);
  assert.notEqual(out.accounts[0], prev.accounts[0], "the changed account is new");
  assert.equal(out.accounts[1], prev.accounts[1], "the unchanged account keeps its identity");
  assert.deepEqual(out, next);
  // keys added, removed or renamed are changes
  assert.notEqual(share({ a: 1 }, { a: 1, b: 2 }), { a: 1 });
  const ab = { a: 1, b: 2 };
  assert.notEqual(share(ab, { a: 1 }), ab);
  assert.notEqual(share(ab, { a: 1, c: 2 }), ab);
  // arrays of different lengths, primitives, undefined
  const arr = [1, 2];
  assert.notEqual(share(arr, [1, 2, 3]), arr);
  assert.equal(share(arr, [1, 2]), arr);
  assert.equal(share("a", "a"), "a");
  assert.equal(share(undefined, undefined), undefined);
  assert.equal(share(null, 3), 3);
  assert.ok(Number.isNaN(share(NaN, NaN)));
  // anything that isn't plain JSON counts as changed unless it's the same object
  const d1 = new Date(0);
  const d2 = new Date(0);
  assert.equal(share(d1, d2), d2);
  assert.equal(share(d1, d1), d1);
});

test("symbol currencies follow the prop service's news-window rule; the calendar opens on a covered one", () => {
  const covered = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];
  assert.deepEqual(symbolCurrencies("EURUSD"), ["EUR", "USD"]);
  assert.deepEqual(symbolCurrencies("eurusd"), ["EUR", "USD"]);
  assert.deepEqual(symbolCurrencies("GER40"), ["EUR"]);
  assert.deepEqual(symbolCurrencies("AAPL"), ["USD"]);
  assert.equal(calendarCurrency("EURUSD", covered), "EUR", "the base currency");
  assert.equal(calendarCurrency("USDJPY", covered), "USD");
  assert.equal(calendarCurrency("GBPJPY", covered), "GBP");
  assert.equal(calendarCurrency("XAUUSD", covered), "USD", "gold: the quote currency");
  assert.equal(calendarCurrency("BTCUSD", covered), "USD");
  assert.equal(calendarCurrency("USDINR", covered), "USD", "a currency the calendar doesn't cover is skipped");
  assert.equal(calendarCurrency("UK100", covered), "GBP");
  assert.equal(calendarCurrency("JP225", covered), "JPY");
  assert.equal(calendarCurrency("NAS100", covered), "USD");
  assert.equal(calendarCurrency("TSLA", covered), "USD");
});

test("a Trade link's symbol: the catalogue's spelling, or null when it isn't a symbol the catalogue has", () => {
  const known = ["EURUSD", "XAUUSD", "US30", "EURUSDm"];
  assert.equal(matchSymbol("XAUUSD", known), "XAUUSD");
  assert.equal(matchSymbol("xauusd", known), "XAUUSD");
  assert.equal(matchSymbol(" EURUSD ", known), "EURUSD");
  assert.equal(matchSymbol("EURUSDm", known), "EURUSDm", "an exact match wins over a case-insensitive one");
  assert.equal(matchSymbol("GBPUSD", known), null);
  assert.equal(matchSymbol("EUR/USD", known), null);
  assert.equal(matchSymbol("<script>", known), null);
  assert.equal(matchSymbol(undefined, known), null);
  assert.equal(matchSymbol(["EURUSD"], known), null);
  assert.equal(matchSymbol("GBPUSD", []), "GBPUSD", "before the catalogue loads, a well-formed symbol is taken as it is");
});

test("P&L card: the move in the trade's direction, the net result, the position's side", () => {
  assert.equal(movePct("buy", 1.1, 1.111)?.toFixed(4), "1.0000");
  assert.equal(movePct("sell", 1.1, 1.089)?.toFixed(4), "1.0000", "a sell gains when the price falls");
  assert.equal(movePct("sell", 100, 110), -10);
  assert.equal(movePct("buy", null, 1.1), null);
  assert.equal(movePct("buy", 0, 1.1), null);
  assert.equal(netOf({ profit: 10, swap: -1, commission: -2 }), 7, "commission is a charge whatever its sign");
  assert.equal(netOf({ profit: 10, swap: -1, commission: 2 }), 7);
  assert.equal(positionSide({ side: "sell" }), "buy", "a closing sell belongs to a buy");
  assert.equal(positionSide({ side: "sell", positionSide: "sell" }), "sell", "the engine's positionSide wins");
});

test("P&L card: never a balance, account number or volume; file name and referral link are well-formed", () => {
  const deal = { id: 1, login: 50000001, positionTicket: 9, orderTicket: null, symbol: "EURUSD", side: "sell" as const, positionSide: "buy" as const, entry: "out" as const, volume: 3.5, price: 1.105, profit: 150, swap: -2, commission: -3, reason: "client", time: "2026-09-30T10:00:00Z", openPrice: 1.1 };
  const t = shareTrade(deal, "USD", 5);
  assert.deepEqual(Object.keys(t).sort(), ["close", "currency", "digits", "net", "open", "pct", "side", "symbol", "time"]);
  assert.equal(t.side, "buy");
  assert.equal(t.net, 145);
  assert.ok(t.pct !== null && Math.abs(t.pct - 0.4545) < 0.001);
  assert.equal(JSON.stringify(t).includes("50000001"), false, "no account number");
  assert.equal(JSON.stringify(t).includes("3.5"), false, "no volume");
  assert.equal(shareTrade({ ...deal, openPrice: undefined }, "USD", 5).pct, null);
  assert.equal(shareFileName(t), "kalks-eurusd-2026-09-30.png");
  assert.equal(shareFileName({ symbol: "US.30/x", time: "bad" }), "kalks-us-30-x-trade.png");
  assert.equal(referralLink("https://app.kalkstrade.com", "ABC123"), "https://app.kalkstrade.com/r/ABC123");
  assert.equal(referralLink("https://app.kalkstrade.com/", "ABC123"), "https://app.kalkstrade.com/r/ABC123");
  assert.equal(referralLink("http://localhost:8911", "ABC123"), "http://localhost:8911/r/ABC123");
  assert.equal(referralLink("http://evil.example", "ABC123"), null, "only https (or local development)");
  assert.equal(referralLink("https://app.kalkstrade.com/path", "ABC123"), null);
  assert.equal(referralLink("https://app.kalkstrade.com", "AB C"), null);
  assert.equal(referralLink(undefined, "ABC123"), null);
  assert.equal(referralLink("https://app.kalkstrade.com", undefined), null);
});

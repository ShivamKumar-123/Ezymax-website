// Partner (IB) and rewards pure logic: week buckets, durations, commission lines, the campaign slug rule of
// services/ib, the QR code PNG (decoded back module by module), points and contest scores, and the English catalog
// covering every server code the screens put into words (reason codes read from the IB service's own source).
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/partner-lib.test.mts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { crc32, inflateSync } from "node:zlib";
import qrcode from "qrcode-generator";
import { createT } from "@kalks/i18n/core";
import { campaignLink, commissionLine, held, kindLabel, lastWeeks, minHold, rateText, reasonLabel, referralLink, shortUrl, SLUG_RE, slugOf, statusLabel } from "../src/features/partner/lib.ts";
import { QUIET, qrPath, qrPng } from "../src/features/partner/qr.ts";
import type { CommissionRow } from "../src/features/partner/types.ts";
import { bandLabel, canJoin, isFull, itemValue, MESSAGES, ownRoute, prizeFor, prizeZone, pts, rewardsTextWith, scoreText, scoreTone, tradesHint } from "../src/features/rewards/lib.ts";
import type { Contest } from "../src/features/rewards/types.ts";

const t = createT("en");
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const rust = (p: string) => readFileSync(join(repo, p), "utf8");

const line = (p: Partial<CommissionRow>): CommissionRow => ({
  id: 1,
  kind: "lot",
  status: "pending",
  amount: 2.5,
  tier: 1,
  rate: 5,
  sharePct: 100,
  lots: 0.5,
  symbol: "EURUSD",
  symbolGroup: "fx-major",
  dealId: 2000332,
  source: "engine",
  levelKey: "bronze",
  client: { id: 197, name: "Rahul Mehta", country: "in" },
  createdAt: "2026-09-30T04:00:00Z",
  availableAt: "2026-09-30T04:00:00Z",
  batchId: null,
  note: null,
  ...p,
});

test("lastWeeks: 12 Monday buckets (UTC) ending this week, quiet weeks at 0, amounts summed per week", () => {
  const now = Date.parse("2026-09-30T05:00:00Z"); // a Wednesday
  const w = lastWeeks([{ week: "2026-09-28T00:00:00Z", amount: 217.6 }, { week: "2026-09-14T00:00:00Z", amount: 5 }, { week: "2026-09-14T00:00:00Z", amount: 1.5 }], 12, now);
  assert.equal(w.length, 12);
  assert.equal(w.at(-1)!.key, "2026-09-28T00:00:00.000Z");
  assert.equal(w.at(-1)!.value, 217.6);
  assert.equal(w.at(-3)!.value, 6.5);
  assert.equal(w[0]!.key, "2026-07-13T00:00:00.000Z");
  assert.equal(w.filter((x) => x.value === 0).length, 10);
  // Sunday late evening still belongs to the week that started on the Monday before
  const sunday = lastWeeks([], 2, Date.parse("2026-10-04T23:59:59Z"));
  assert.deepEqual(sunday.map((x) => x.key), ["2026-09-21T00:00:00.000Z", "2026-09-28T00:00:00.000Z"]);
  const monday = lastWeeks([], 1, Date.parse("2026-10-05T00:00:00Z"));
  assert.equal(monday[0]!.key, "2026-10-05T00:00:00.000Z");
  // an unparseable week from the server is ignored, not NaN
  assert.equal(lastWeeks([{ week: "soon", amount: 3 }], 3, now).reduce((s, x) => s + x.value, 0), 0);
});

test("held: minutes never round up, seconds under ten minutes (a 1m 50s trade never reads 2m)", () => {
  const cases: [number, string][] = [
    [45, "45s"],
    [60, "1m"],
    [100, "1m 40s"],
    [110, "1m 50s"],
    [120, "2m"],
    [599, "9m 59s"],
    [600, "10m"],
    [659, "10m"],
    [3_700, "1h 2m"],
    [90_000, "1d 1h"],
  ];
  for (const [s, want] of cases) assert.equal(held(t, s * 1000), want, `${s}s`);
  assert.equal(held(t, -5000), "0s");
  assert.equal(minHold(t, 120), "2 min");
  assert.equal(minHold(t, 90), "1.5 min");
  assert.equal(minHold(t, 45), "45 sec");
});

test("commission lines in words: lot (with and without the tier), split, rebate, CPA, and the rate paid", () => {
  assert.equal(commissionLine(t, line({})), "EURUSD · 0.50 lot · L1");
  assert.equal(commissionLine(t, line({ tier: 2 }), true), "EURUSD · 0.50 lot");
  assert.equal(commissionLine(t, line({ kind: "split", tier: 2, symbol: "XAUUSD" })), "Sub-IB split · XAUUSD · L2");
  assert.equal(commissionLine(t, line({ kind: "rebate", lots: 1.5 })), "Rebate · EURUSD · 1.50 lot");
  assert.equal(commissionLine(t, line({ kind: "cpa", symbol: null, lots: 0 })), "CPA bonus");
  assert.equal(commissionLine(t, line({ kind: "adjustment" })), "Adjustment");
  assert.equal(rateText(t, line({})), "$5");
  assert.equal(rateText(t, line({ tier: 2, rate: 8, sharePct: 20 })), "$8 × 20%");
  assert.equal(rateText(t, line({ kind: "split", sharePct: 12.5 })), "12.5% of the sub-IB amount");
  assert.equal(rateText(t, line({ kind: "cpa" })), "Fixed");
  assert.equal(kindLabel(t, "something_new"), "something new", "an unknown kind is humanised, never a raw key");
  assert.equal(statusLabel(t, "void"), "Void");
});

test("every reason the IB service gives for a deal that earned nothing has words", () => {
  const src = rust("services/ib/src/calc.rs") + rust("services/ib/src/deals.rs");
  const codes = new Set<string>();
  // disqualify(): return Some("demo") …; the client checks: .then_some("no_referrer") …; the system groups
  for (const m of src.matchAll(/(?:return Some|then_some)\("([a-z_]+)"\)|\.map\(\|_\| "([a-z_]+)"\)/g)) codes.add((m[1] ?? m[2])!);
  for (const m of src.matchAll(/\{ "(pamm_fund)" \} else \{ "(mam_master)" \}/g)) (codes.add(m[1]!), codes.add(m[2]!));
  for (const c of ["demo", "excluded_group", "reversed", "price_correction", "no_volume", "short_duration", "unknown_client", "no_referrer", "before_signup", "self_referral", "no_symbol_group", "mam_master", "pamm_fund"]) assert.ok(codes.has(c), `the IB source still gives "${c}"`);
  for (const c of codes) {
    assert.ok(t.has(`mobilePartner.reason.${c}`), `mobilePartner.reason.${c}`);
    assert.notEqual(reasonLabel(t, c), c.replace(/_/g, " "));
  }
  assert.equal(reasonLabel(t, null), "Not eligible");
});

test("the server enums the partner screens show all have words", () => {
  for (const k of ["lot", "split", "rebate", "cpa", "clawback", "adjustment"]) assert.ok(t.has(`mobilePartner.kind.${k}`), k);
  for (const s of ["pending", "approved", "paid", "rejected", "void"]) assert.ok(t.has(`mobilePartner.status.${s}`), s);
  for (const s of ["awaiting_approval", "processing", "paid", "rejected"]) assert.ok(t.has(`mobilePartner.payout.status.${s}`), s);
  for (const s of ["daily", "weekly", "monthly"]) assert.ok(t.has(`mobilePartner.schedule.${s}`), s);
  for (const s of ["active", "funded", "registered"]) assert.ok(t.has(`mobilePartner.clientStatus.${s}`), s);
  for (const c of ["viewer_read_only", "viewer_scope", "staff_read_only", "module_disabled", "maintenance", "not_ready", "unavailable", "limit", "exists", "forbidden"]) assert.ok(t.has(`mobilePartner.error.${c}`), c);
});

test("campaign slugs follow the IB service's rule (services/ib slugify and clean_slug)", () => {
  assert.equal(slugOf("  Diwali Gold -- Promo! "), "diwali-gold-promo", "the IB service's own test vector");
  assert.equal(slugOf("YouTube September"), "youtube-september");
  assert.equal(slugOf("Été 2026 / Paris"), "t-2026-paris");
  assert.equal(slugOf("!!!"), "");
  const long = slugOf("a".repeat(39) + " bcd");
  assert.equal(long, "a".repeat(39), "cut at 40 characters, no trailing dash");
  assert.ok(SLUG_RE.test("gold_webinar-2"));
  assert.ok(!SLUG_RE.test("gold webinar"));
  assert.ok(!SLUG_RE.test("x".repeat(41)));
});

test("referral and campaign links: /r/CODE[/slug] on the Client Area, whatever the base's trailing slash", () => {
  assert.equal(referralLink("https://app.kalkstrade.com/", "PRIYA9756"), "https://app.kalkstrade.com/r/PRIYA9756");
  assert.equal(campaignLink("https://app.kalkstrade.com", "PRIYA9756", "telegram-group"), "https://app.kalkstrade.com/r/PRIYA9756/telegram-group");
  assert.equal(campaignLink("https://app.kalkstrade.com", "PRIYA9756", ""), "https://app.kalkstrade.com/r/PRIYA9756");
  assert.equal(shortUrl("https://app.kalkstrade.com/r/X"), "app.kalkstrade.com/r/X");
});

/** Reads a PNG back: chunks with their CRCs checked, the IHDR, and the inflated scanlines. */
function readPng(png: Uint8Array) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: { type: string; data: Uint8Array }[] = [];
  for (let o = 8; o < png.length; ) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    assert.equal(dv.getUint32(o + 8 + len), crc32(png.subarray(o + 4, o + 8 + len)), `${type} CRC`);
    chunks.push({ type, data });
    o += 12 + len;
  }
  assert.deepEqual(chunks.map((c) => c.type), ["IHDR", "IDAT", "IEND"]);
  const ih = new DataView(chunks[0]!.data.buffer, chunks[0]!.data.byteOffset, 13);
  return { width: ih.getUint32(0), height: ih.getUint32(4), depth: chunks[0]!.data[8], colour: chunks[0]!.data[9], raw: inflateSync(chunks[1]!.data) };
}

test("the QR code PNG is a valid 1-bit image whose pixels are exactly the code's modules", () => {
  const url = "https://app.kalkstrade.com/r/PRIYA9756/telegram-group";
  const scale = 6;
  const png = qrPng(url, scale)!;
  const img = readPng(png);
  const ref = qrcode(0, "Q");
  ref.addData(url, "Byte");
  ref.make();
  const n = ref.getModuleCount();
  const px = (n + QUIET * 2) * scale;
  assert.equal(img.width, px);
  assert.equal(img.height, px);
  assert.equal(img.depth, 1);
  assert.equal(img.colour, 0);
  const rowBytes = Math.ceil(px / 8) + 1;
  assert.equal(img.raw.length, rowBytes * px);
  const dark = (x: number, y: number) => {
    const row = y * rowBytes;
    assert.equal(img.raw[row], 0, "filter byte: none");
    return ((img.raw[row + 1 + (x >>> 3)]! >>> (7 - (x & 7))) & 1) === 0;
  };
  for (let r = -QUIET; r < n + QUIET; r++)
    for (let c = -QUIET; c < n + QUIET; c++) {
      const want = r >= 0 && c >= 0 && r < n && c < n && ref.isDark(r, c);
      // the centre pixel of every module, and its corners
      const x0 = (c + QUIET) * scale;
      const y0 = (r + QUIET) * scale;
      for (const [dx, dy] of [[scale >> 1, scale >> 1], [0, 0], [scale - 1, scale - 1]] as const) assert.equal(dark(x0 + dx, y0 + dy), want, `module ${r},${c}`);
    }
  // the on-screen path draws the same dark modules
  const path = qrPath(url)!;
  assert.equal(path.size, n + QUIET * 2);
  let modules = 0;
  for (const m of path.d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    assert.equal(m[3], m[4]);
    for (let k = 0; k < Number(m[3]); k++) {
      assert.ok(ref.isDark(Number(m[2]) - QUIET, Number(m[1]) - QUIET + k));
      modules++;
    }
  }
  let expected = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (ref.isDark(r, c)) expected++;
  assert.equal(modules, expected);
});

const contest = (p: Partial<Contest>): Contest => ({
  id: 3,
  slug: "october-gold-rush",
  name: "October Gold Rush",
  description: "",
  kind: "live",
  status: "running",
  startsAt: "2026-09-28T00:00:00Z",
  endsAt: "2026-10-03T00:00:00Z",
  scoring: "return_pct",
  minTrades: 3,
  maxEntrants: 500,
  entrants: 1,
  startingBalance: null,
  demoGroup: null,
  accountGroups: [],
  kycRequired: false,
  minEquity: null,
  prizes: [
    { rankFrom: 1, rankTo: 1, amount: 1000, payout: "wallet" },
    { rankFrom: 2, rankTo: 5, amount: 250, payout: "credit" },
  ],
  prizePool: 2000,
  rules: "",
  antiCheat: { minHoldSeconds: 60, maxSingleTradePct: 80, disqualifyOnBalanceChange: true },
  updatedAt: "2026-09-30T00:00:00Z",
  ...p,
});

test("points and contest scores: true minus, the contest's unit, green / red only for money scores", () => {
  assert.equal(pts(12480), "12,480");
  assert.equal(pts(-2500), "−2,500");
  assert.equal(pts(0.4), "0");
  const s = { returnPct: -3.456, profit: 1234.5, lots: 12.5 };
  assert.equal(scoreText(t, contest({}), s), "−3.46%");
  assert.equal(scoreText(t, contest({ scoring: "profit" }), s), "+$1,234.50");
  assert.equal(scoreText(t, contest({ scoring: "lots" }), s), "12.50 lots");
  assert.equal(scoreTone(contest({}), s), "down");
  assert.equal(scoreTone(contest({ scoring: "profit" }), s), "up");
  assert.equal(scoreTone(contest({ scoring: "lots" }), s), null, "lots are not money");
});

test("prize bands, the prize zone, and who may still join", () => {
  const c = contest({});
  assert.equal(prizeFor(c, 1), 1000);
  assert.equal(prizeFor(c, 4), 250);
  assert.equal(prizeFor(c, 6), null);
  assert.equal(prizeFor(c, null), null);
  assert.equal(prizeZone(c), 5);
  assert.equal(bandLabel(c.prizes[1]!), "#2–5");
  assert.equal(bandLabel(c.prizes[0]!), "#1");
  assert.ok(canJoin(c));
  assert.ok(!canJoin(contest({ entrants: 500 })) && isFull(contest({ entrants: 500 })));
  assert.ok(!canJoin(contest({ status: "ended" })));
  assert.ok(canJoin(contest({ status: "scheduled", maxEntrants: null })));
  assert.equal(tradesHint(t, c, { trades: 1, qualified: false }), "2 more trades to rank");
  assert.equal(tradesHint(t, c, { trades: 2, qualified: false }), "1 more trade to rank");
  assert.equal(tradesHint(t, c, { trades: 3, qualified: false }), "Ranks from the next refresh");
  assert.equal(tradesHint(t, c, { trades: 5, qualified: true }), null);
});

test("what a reward gives, in words", () => {
  assert.equal(itemValue(t, { kind: "cashback", value: 10 }), "$10 to your wallet");
  assert.equal(itemValue(t, { kind: "bonus_credit", value: 100 }), "$100 trading bonus");
  assert.equal(itemValue(t, { kind: "fee_discount", value: 20 }), "20% off");
  assert.equal(itemValue(t, { kind: "cashback", value: 12.5 }), "$12.50 to your wallet");
});

test("the growth service's sentences map to words, and every mapped sentence still exists in its source", () => {
  const all = readAll(join(repo, "services/growth/src"));
  for (const [sentence, key] of Object.entries(MESSAGES)) {
    assert.ok(t.has(`mobileRewards.error.${key}`), `mobileRewards.error.${key}`);
    assert.ok(all.includes(sentence.replace(/\.$/, "")), `the growth service still says "${sentence}"`);
  }
  assert.equal(rewardsTextWith(t, "This reward needs the Gold tier."), "This reward needs the Gold tier.");
  assert.equal(rewardsTextWith(t, "You need 1200 more points."), "You need 1,200 more points.");
  assert.equal(rewardsTextWith(t, "Something new from the server."), "Something new from the server.");
  assert.equal(rewardsTextWith(t, null), "");
});

test("a banner or notification link opens the partner / rewards screen at the same path; anything else is left to the link map", () => {
  assert.equal(ownRoute("/rewards/loyalty"), "/rewards/loyalty");
  assert.equal(ownRoute("/rewards/contests/october-gold-rush?utm=x#top"), "/rewards/contests/october-gold-rush");
  assert.equal(ownRoute("/partner/payouts/"), "/partner/payouts");
  assert.equal(ownRoute("/partner/network"), null, "the web's network tree has no app screen");
  assert.equal(ownRoute("/rewards"), null, "the hub itself goes through the platform's map");
  assert.equal(ownRoute("https://evil.example/rewards/loyalty"), null);
  assert.equal(ownRoute("/rewards/contests/../../wallet"), null);
  assert.equal(ownRoute("//rewards/loyalty"), null);
});

/** Every .rs file under a directory, concatenated. */
function readAll(dir: string): string {
  let out = "";
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out += readAll(p);
    else if (f.endsWith(".rs")) out += readFileSync(p, "utf8");
  }
  return out;
}

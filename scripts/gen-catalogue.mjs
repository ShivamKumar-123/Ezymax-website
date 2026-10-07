// Generates the provider-catalogue rows of config/instruments.json (and the HKEX exchange calendar) from the
// Infoway snapshot config/provider/infoway-snapshot.json (scripts/infoway-snapshot.py).
//
// WHY: Kalks carries far more instruments than its 28 hand-maintained core ones: every FX pair, metal, energy,
// index and spot crypto the provider prices, plus the most traded US, Hong Kong and Japanese stocks and ETFs.
// Generating the rows keeps them consistent (digits, typical spread, session, holiday calendar, spec template,
// currencies) and reviewable in git; every service reads the same file, so nothing needs the provider at startup.
//
// RULES
//   Core rows (no "tier") are copied byte for byte and never changed; a provider code a core row uses is skipped.
//   forex     every provider pair whose profit currency converts to USD with a provider price (USD pair in the core or
//             catalogue), keeping only the market-convention direction when both directions exist (EURGBP, not
//             GBPEUR). Pairs with HKD, SGD, CNH, CNY, MYR, TWD, THB, TRY or RUB use the "forex-exotic" template.
//   metals    every provider metal (gold / platinum / palladium: "metals", silver: "metals-silver", base metals:
//             "metals-base"), London + New York calendar (XAU / XAG).
//   energies  every provider energy, NYMEX calendar (OIL).
//   indices   every index with a price and a convertible currency; the calendar of its home exchange where Kalks
//             has one (NYSE, HKEX, JPY, EUR, CHF, AUD, CAD).
//   crypto    spot USDT pairs as XXXUSD; stablecoins and tokenized stocks are left out. Templates by price (contract
//             sizes 1 / 1,000 / 1,000,000 coins), so a lot means a sensible amount of money.
//   stocks    main-board listings with a price, ranked by recent daily turnover: US top 800 (NYSE / Nasdaq / NYSE
//             American, ETFs included; warrants, units and rights left out), Hong Kong top 150, Tokyo top 150.
//             Sessions: us_equity / hk_equity / jp_equity with the NYSE / HKEX / JPY holiday calendars.
//   digits    from the price (forex 2-5, crypto 2-8, stocks US 2 / HK 3 / JP 1); typical spread = a fixed share of
//             the price per class (at least one point). Both are indicative: live quotes carry the real spread.
//
// USAGE
//   node scripts/gen-catalogue.mjs           rewrite config/instruments.json + config/holidays/exchanges/HKEX.json
//   node scripts/gen-catalogue.mjs --check   exit 1 when either file differs from what the snapshot generates
//   Options: --us N  --hk N  --jp N  (stocks per exchange; defaults 800 / 150 / 150)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, "config", "provider", "infoway-snapshot.json");
const INSTRUMENTS = join(ROOT, "config", "instruments.json");
const HKEX_FILE = join(ROOT, "config", "holidays", "exchanges", "HKEX.json");
const GENERATED_BY = "scripts/gen-catalogue.mjs";

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const CHECK = args.includes("--check");
const TOP = { STOCK_US: opt("--us", 800), STOCK_HK: opt("--hk", 150), STOCK_JP: opt("--jp", 150) };

const EXOTIC = new Set(["HKD", "SGD", "CNH", "CNY", "MYR", "TWD", "THB", "TRY", "RUB"]);
// market convention: the earlier currency is the base
const RANK = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "SGD", "HKD", "CNH", "CNY", "MYR", "TWD", "THB", "TRY", "RUB", "JPY"];
const STABLE = new Set(["USDC", "FDUSD", "TUSD", "BUSD", "DAI", "USDE", "USD1", "PYUSD", "FRAX", "EUR", "U"]);
// index profit currencies (the provider's currency field is missing or wrong for several CFDs)
const INDEX_CCY = {
  AEX: "EUR", AUS200: "AUD", CN50: "USD", DJT: "USD", DJU: "USD", DXY: "USD", ESP35: "EUR", EUSTX50: "EUR", FRA40: "EUR",
  GER30: "EUR", HK50: "HKD", HSHCI: "HKD", HSII: "HKD", HSTECH: "HKD", IBOV: "BRL", KOSDAQ: "KRW", KOSPI: "KRW",
  KOSPI200: "KRW", NBI: "USD", NI225: "JPY", NIFTY: "INR", REIT: "USD", SA40: "ZAR", SENSEX: "INR", SG20: "SGD",
  SG30SGD: "SGD", SISE: "USD", SIXE: "USD", SMI: "CHF", SOX: "USD", STI: "SGD", SWISS20: "CHF", TAIEX: "USD", TSX: "CAD",
  US2000: "USD", VIX: "USD", VXN: "USD",
};
const INDEX_CALENDAR = {
  DJT: "NYSE", DJU: "NYSE", NBI: "NYSE", REIT: "NYSE", SISE: "NYSE", SIXE: "NYSE", SOX: "NYSE", US2000: "NYSE", VIX: "NYSE", VXN: "NYSE",
  HK50: "HKEX", HSHCI: "HKEX", HSII: "HKEX", HSTECH: "HKEX", NI225: "JPY", AEX: "EUR", ESP35: "EUR", EUSTX50: "EUR", FRA40: "EUR",
  SMI: "CHF", SWISS20: "CHF", AUS200: "AUD", TSX: "CAD",
};
// the same series as a core index under its older name
const INDEX_SKIP = new Set(["GER30"]);
const BASE_METALS = new Set(["XCUUSD", "XALUSD", "XNIUSD", "XPBUSD", "ZINCSPOT"]);
// duplicate copper series ("Copper Spot" next to the copper CFD)
const METAL_SKIP = new Set(["XCUUSD_S"]);

const BAD_STOCK_NAME = /\b(warrants?|wts|units?|rights?|subordinate|preferred|pfd|depositary shares? rep|notes? due)\b|\bC\/WTS\b|\(S\/R\b/i;

/* ----------------------------------------------------------------- helpers */

const log10 = (x) => Math.log10(x);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x, d) => Number(x.toFixed(d));

function digitsFor(cls, row) {
  const p = row.close;
  switch (cls) {
    case "forex":
      return clamp(5 - Math.floor(log10(p)), 2, 5);
    case "metals":
      return p >= 1000 ? 2 : p >= 10 ? 3 : 4;
    case "energies":
      return p >= 10 ? 2 : 3;
    case "indices":
      return p >= 1000 ? 1 : p >= 100 ? 2 : 3;
    case "crypto":
      return clamp(4 - Math.floor(log10(p)), 2, 8);
    case "stocks":
      return row.type === "STOCK_HK" ? 3 : row.type === "STOCK_JP" ? 1 : 2;
  }
  throw new Error(`no digits rule for ${cls}`);
}

/** Typical raw spread as a share of the price, per template. */
const SPREAD = { forex: 0.00015, "forex-exotic": 0.0002, metals: 0.0004, "metals-silver": 0.0006, "metals-base": 0.0008, energies: 0.0008, indices: 0.0003, crypto: 0.0015, "crypto-1k": 0.002, "crypto-1m": 0.003, "stocks-us": 0.0005, "stocks-hk": 0.002, "stocks-jp": 0.001 };

function spreadFor(template, price, digits) {
  const pt = 10 ** -digits;
  return round(Math.max(pt, Math.round((price * SPREAD[template]) / pt) * pt), digits);
}

/* ----------------------------------------------------------------- inputs */

const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const original = readFileSync(INSTRUMENTS, "utf8");
const all = JSON.parse(original);
const core = all.filter((r) => r.tier !== "catalogue");
const coreSymbols = new Set(core.map((r) => r.symbol));
const coreCodes = new Set(core.map((r) => `${r.provider.market}/${r.provider.code}`));
const providerCodes = new Set(snap.rows.map((r) => `${r.market}/${r.code}`));

const out = [];
const skipped = [];
const add = (row, why) => {
  if (why) skipped.push(`${row.code}: ${why}`);
};

// currencies convertible to USD: USD, core pairs the provider prices, catalogue FX pairs with a USD side
const fxRows = snap.rows.filter((r) => r.type === "FOREX" && r.close > 0);
const usdPair = new Set(["USD"]);
for (const r of core.filter((r) => r.asset_class === "forex" && providerCodes.has(`${r.provider.market}/${r.provider.code}`))) {
  const s = r.symbol;
  if (s.startsWith("USD")) usdPair.add(s.slice(3));
  if (s.endsWith("USD")) usdPair.add(s.slice(0, 3));
}
for (const r of fxRows) {
  if (r.code.startsWith("USD")) usdPair.add(r.code.slice(3, 6));
  if (r.code.endsWith("USD")) usdPair.add(r.code.slice(0, 3));
}

const row = (r, cls, template, extra) => {
  const digits = digitsFor(cls, r);
  return {
    symbol: extra.symbol ?? r.code,
    asset_class: cls,
    digits,
    base_spread: spreadFor(template, r.close, digits),
    provider: { market: r.market, code: r.code },
    session: extra.session ?? (cls === "crypto" ? "24x7" : "fx"),
    tier: "catalogue",
    name: r.name || r.code,
    ...(extra.base ? { base_ccy: extra.base } : {}),
    quote_ccy: extra.quote,
    ...(r.exchange && cls === "stocks" ? { exchange: r.exchange } : {}),
    ...(extra.calendar ? { calendar: extra.calendar } : {}),
    template,
    ...(extra.pip ? { pip_size: extra.pip } : {}),
  };
};

/* ----------------------------------------------------------------- forex */

const fxCodes = new Set(fxRows.map((r) => r.code));
for (const r of fxRows) {
  const [b, q] = [r.code.slice(0, 3), r.code.slice(3, 6)];
  if (r.code.length !== 6) add(r, "not a currency pair");
  else if (coreCodes.has(`common/${r.code}`) || coreSymbols.has(r.code)) add(r, "core instrument");
  else if (fxCodes.has(q + b) && RANK.indexOf(b) > RANK.indexOf(q) && RANK.includes(q)) add(r, `inverse of ${q + b}`);
  else if (!usdPair.has(q)) add(r, `no ${q}/USD price to convert profits`);
  else {
    const template = EXOTIC.has(b) || EXOTIC.has(q) ? "forex-exotic" : "forex";
    const digits = digitsFor("forex", r);
    const pip = digits === 5 || digits === 3 ? round(10 ** -(digits - 1), digits) : round(10 ** -digits, digits);
    out.push(row(r, "forex", template, { base: b, quote: q, pip }));
  }
}

/* ----------------------------------------------------------------- metals, energies */

for (const r of snap.rows.filter((r) => r.type === "METAL")) {
  if (coreCodes.has(`common/${r.code}`)) add(r, "core instrument");
  else if (METAL_SKIP.has(r.code)) add(r, "duplicate series");
  else if (!(r.close > 0)) add(r, "no price");
  else {
    const quote = r.code === "ZINCSPOT" ? "USD" : r.code.slice(3, 6);
    if (!usdPair.has(quote)) {
      add(r, `no ${quote}/USD price`);
      continue;
    }
    const template = BASE_METALS.has(r.code) ? "metals-base" : r.code.startsWith("XAG") ? "metals-silver" : "metals";
    out.push(row(r, "metals", template, { quote, base: r.code === "ZINCSPOT" ? undefined : r.code.slice(0, 3), calendar: r.code.startsWith("XAG") ? "XAG" : "XAU" }));
  }
}
for (const r of snap.rows.filter((r) => r.type === "ENERGY")) {
  if (coreCodes.has(`common/${r.code}`)) add(r, "core instrument");
  else if (!(r.close > 0)) add(r, "no price");
  else out.push(row(r, "energies", "energies", { quote: "USD", calendar: "OIL" }));
}

/* ----------------------------------------------------------------- indices */

for (const r of snap.rows.filter((r) => r.type === "INDICES")) {
  const quote = INDEX_CCY[r.code] ?? r.ccy;
  if (coreCodes.has(`common/${r.code}`)) add(r, "core instrument");
  else if (INDEX_SKIP.has(r.code)) add(r, "same series as a core index");
  else if (!(r.close > 0)) add(r, "no price from the provider");
  else if (!quote || !usdPair.has(quote)) add(r, `no ${quote ?? "?"}/USD price to convert profits`);
  else out.push(row(r, "indices", "indices", { symbol: r.code.replace(/[^A-Z0-9.]/g, "."), quote, calendar: INDEX_CALENDAR[r.code] }));
}

/* ----------------------------------------------------------------- crypto */

const usStocks = new Map(snap.rows.filter((r) => r.type === "STOCK_US").map((r) => [r.code.replace(/\.US$/, ""), r]));
const firstWord = (s) => (s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] ?? "";
for (const r of snap.rows.filter((r) => r.type === "CRYPTO")) {
  const base = r.code.endsWith("USDT") ? r.code.slice(0, -4) : null;
  const tokenized = base && base.endsWith("B") && usStocks.has(base.slice(0, -1)) && firstWord(usStocks.get(base.slice(0, -1)).name) === firstWord(r.name);
  if (!/^[A-Z0-9]+$/.test(r.code)) add(r, "not an ASCII code");
  else if (!base) add(r, "not quoted in USDT");
  else if (coreCodes.has(`crypto/${r.code}`)) add(r, "core instrument");
  else if (STABLE.has(base)) add(r, "stablecoin");
  else if (tokenized || /\bETF\b/.test(r.name)) add(r, "tokenized stock / ETF");
  else if (!(r.close > 0)) add(r, "no price");
  else {
    const template = r.close >= 50 ? "crypto" : r.close >= 0.05 ? "crypto-1k" : "crypto-1m";
    out.push(row(r, "crypto", template, { symbol: `${base}USD`, base, quote: "USD" }));
  }
}

/* ----------------------------------------------------------------- stocks */

const STOCKS = {
  // plain ticker, except one-letter tickers (C, F, T, V...), which keep ".US" (symbols are at least 2 characters)
  STOCK_US: { template: "stocks-us", session: "us_equity", calendar: "NYSE", symbol: (c) => (c.length > 4 ? c.replace(/\.US$/, "") : c) },
  STOCK_HK: { template: "stocks-hk", session: "hk_equity", calendar: "HKEX", symbol: (c) => c },
  STOCK_JP: { template: "stocks-jp", session: "jp_equity", calendar: "JPY", symbol: (c) => c },
};
for (const [type, cfg] of Object.entries(STOCKS)) {
  const list = snap.rows
    .filter((r) => r.type === type && r.close > 0)
    .filter((r) => {
      if (coreCodes.has(`${r.market}/${r.code}`)) return add(r, "core instrument"), false;
      if (BAD_STOCK_NAME.test(r.name)) return add(r, "warrant / unit / right / preferred"), false;
      const ccy = r.ccy || "USD";
      if (!usdPair.has(ccy)) return add(r, `no ${ccy}/USD price`), false;
      return true;
    })
    .sort((a, b) => b.turnover - a.turnover || a.code.localeCompare(b.code))
    .slice(0, TOP[type]);
  for (const r of list) out.push(row(r, "stocks", cfg.template, { symbol: cfg.symbol(r.code), session: cfg.session, calendar: cfg.calendar, quote: r.ccy || "USD" }));
}

/* ----------------------------------------------------------------- checks */

const ORDER = ["forex", "metals", "energies", "indices", "crypto", "stocks"];
out.sort((a, b) => ORDER.indexOf(a.asset_class) - ORDER.indexOf(b.asset_class) || a.symbol.localeCompare(b.symbol));
const seen = new Map(core.map((r) => [r.symbol, "core"]));
const codes = new Set(core.map((r) => `${r.provider.market}/${r.provider.code}`));
for (const r of out) {
  if (!/^[A-Z0-9.]{2,20}$/.test(r.symbol)) throw new Error(`bad symbol ${r.symbol} (${r.provider.code})`);
  if (seen.has(r.symbol)) throw new Error(`symbol ${r.symbol} twice (${seen.get(r.symbol)} and ${r.provider.code})`);
  const k = `${r.provider.market}/${r.provider.code}`;
  if (codes.has(k)) throw new Error(`provider code ${k} twice`);
  seen.set(r.symbol, r.provider.code);
  codes.add(k);
  if (!(r.base_spread > 0) || !Number.isInteger(r.digits)) throw new Error(`bad digits / spread for ${r.symbol}`);
  if (!usdPair.has(r.quote_ccy)) throw new Error(`${r.symbol}: ${r.quote_ccy} does not convert to USD`);
}

/* ----------------------------------------------------------------- render */

// core rows: the file's own text up to the first catalogue row (never re-serialised, so it stays byte-identical)
const lines = original.split("\n");
const firstCat = lines.findIndex((l) => l.startsWith('  {"symbol"'));
let coreText = (firstCat >= 0 ? lines.slice(0, firstCat) : lines.slice(0, lines.lastIndexOf("]"))).join("\n").replace(/,\s*$/, "").replace(/\s+$/, "");
if (JSON.stringify(JSON.parse(`${coreText}\n]`)) !== JSON.stringify(core)) throw new Error("core rows could not be isolated unchanged");
const text = `${coreText},\n${out.map((r) => `  ${JSON.stringify(r)}`).join(",\n")}\n]\n`;
const check = JSON.parse(text);
if (JSON.stringify(check.slice(0, core.length)) !== JSON.stringify(core)) throw new Error("core rows changed");

// HKEX calendar from the provider's trading days (weekdays that are not trading days; half days close at 12:00)
const hk = snap.tradingDays?.HK ?? {};
const holidays = [];
const early = [];
const years = [];
for (const [y, d] of Object.entries(hk)) {
  const trade = new Set(d.tradeDays);
  const half = new Set(d.halfDays);
  const all = [];
  for (let t = Date.UTC(+y, 0, 1); new Date(t).getUTCFullYear() === +y; t += 86_400_000) {
    const wd = new Date(t).getUTCDay();
    const iso = new Date(t).toISOString().slice(0, 10);
    const key = iso.replaceAll("-", "");
    if (wd === 0 || wd === 6) continue;
    if (half.has(key)) early.push({ date: iso, close: "12:00" });
    else if (!trade.has(key)) all.push(iso);
  }
  // a year the provider has not published yet lists every weekday as a trading day: leave it out
  if (all.length === 0 && half.size === 0) continue;
  years.push(+y);
  holidays.push(...all.map((date) => ({ date })));
}
const hkText =
  JSON.stringify(
    {
      calendar: "HKEX",
      description: "Hong Kong Exchanges (HK stocks and HK indices): exchange holidays and half days",
      rules: "Weekdays that are not trading days in the provider's HKEX calendar (Infoway /common/basic/markets/trading_days) are holidays; its half trading days close at 12:00 Hong Kong time. Years the provider has not published yet are left out: until they are added, HK sessions there follow the regular hours. Review each year.",
      generatedBy: GENERATED_BY,
      years,
      holidays,
      earlyCloses: early,
    },
    null,
    2,
  ) + "\n";

if (CHECK) {
  const stale = [];
  if (readFileSync(INSTRUMENTS, "utf8") !== text) stale.push("config/instruments.json");
  let hkOld = "";
  try {
    hkOld = readFileSync(HKEX_FILE, "utf8");
  } catch {}
  if (hkOld !== hkText) stale.push("config/holidays/exchanges/HKEX.json");
  for (const s of stale) console.error(`out of date: ${s}`);
  if (stale.length) process.exit(1);
  console.log(`catalogue up to date: ${core.length} core + ${out.length} catalogue instruments`);
} else {
  writeFileSync(INSTRUMENTS, text);
  mkdirSync(dirname(HKEX_FILE), { recursive: true });
  writeFileSync(HKEX_FILE, hkText);
  const byClass = {};
  for (const r of out) byClass[`${r.asset_class}/${r.template}`] = (byClass[`${r.asset_class}/${r.template}`] ?? 0) + 1;
  console.log(`snapshot ${snap.fetchedAt} (${snap.plan?.packageName ?? "?"} plan)`);
  console.log(`provider universe: ${Object.entries(snap.providerCounts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`catalogue: ${out.length} instruments + ${core.length} core = ${out.length + core.length}`);
  for (const [k, v] of Object.entries(byClass).sort()) console.log(`  ${k.padEnd(26)} ${v}`);
  console.log(`left out (not stocks below the turnover cut): ${skipped.length}`);
  for (const s of skipped.filter((s) => !s.includes("warrant"))) console.log(`  ${s}`);
  console.log(`HKEX calendar: ${holidays.length} holidays, ${early.length} half days (${years.join(", ")})`);
}

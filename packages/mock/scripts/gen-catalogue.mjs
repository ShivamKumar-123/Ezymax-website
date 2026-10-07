#!/usr/bin/env node
// Generates packages/mock/src/catalogue.generated.ts: the provider catalogue instruments (config/instruments.json rows with
// "tier": "catalogue") as the apps' instrument list sees them, priced from the provider snapshot's last daily close
// (config/provider/infoway-snapshot.json), with their default live-trading switch ("live" / "live_off"), plus the
// effective trading specs of every instrument (config/trading-specs.json: contract size, lots, leverage, swaps). The 28
// core instruments themselves stay hand-maintained in src/symbols.ts.
//
//   node packages/mock/scripts/gen-catalogue.mjs           # rewrite the generated file
//   node packages/mock/scripts/gen-catalogue.mjs --check   # exit 1 when the file is out of date
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const out = join(here, "..", "src", "catalogue.generated.ts");

const instruments = JSON.parse(readFileSync(join(root, "config", "instruments.json"), "utf8"));
const specsFile = JSON.parse(readFileSync(join(root, "config", "trading-specs.json"), "utf8"));
const snapshot = JSON.parse(readFileSync(join(root, "config", "provider", "infoway-snapshot.json"), "utf8"));
const byCode = new Map(snapshot.rows.map((r) => [`${r.market}|${r.code}`, r]));
const byCodeAny = new Map(snapshot.rows.map((r) => [r.code, r]));
const coinsDir = join(root, "apps", "terminal", "public", "assets", "coins");
const coins = new Set(existsSync(coinsDir) ? readdirSync(coinsDir).map((f) => f.replace(/\.svg$/, "")) : []);

// currency → flag (flag-icons country code)
const CCY = { USD: "us", EUR: "eu", GBP: "gb", JPY: "jp", AUD: "au", CAD: "ca", CHF: "ch", NZD: "nz", CNH: "cn", CNY: "cn", HKD: "hk", SGD: "sg", MYR: "my", THB: "th", TRY: "tr", TWD: "tw", RUB: "ru", SEK: "se", NOK: "no", DKK: "dk", ZAR: "za", MXN: "mx", PLN: "pl", HUF: "hu", CZK: "cz", INR: "in", ILS: "il", KRW: "kr", BRL: "br", IDR: "id", PHP: "ph" };
// index → flag of its market (quote currency otherwise)
const INDEX = { AEX: "nl", AUS200: "au", CN50: "cn", DJT: "us", DJU: "us", DXY: "us", ESP35: "es", EUSTX50: "eu", FRA40: "fr", HK50: "hk", HSHCI: "hk", HSII: "hk", HSTECH: "hk", NBI: "us", NI225: "jp", REIT: "us", SG20: "sg", SG30SGD: "sg", SMI: "ch", SOX: "us", STI: "sg", SWISS20: "ch", TAIEX: "tw", TSX: "ca", US2000: "us", VIX: "us", VXN: "us" };
const METAL_TEXT = { XPT: "Pt", XPD: "Pd", XCU: "Cu", XAL: "Al", XNI: "Ni", XPB: "Pb" };

/** Avatar: "p:<base>:<quote>" flags, "c:<coin>" logo, "f:<country>", "m:gold|silver", "e:<text>". */
function icon(x) {
  const s = x.symbol;
  switch (x.asset_class) {
    case "forex": {
      const b = CCY[x.base_ccy], q = CCY[x.quote_ccy];
      return b && q ? `p:${b}:${q}` : `e:${s.slice(0, 3)}`;
    }
    case "metals":
      if (s.startsWith("XAU")) return "m:gold";
      if (s.startsWith("XAG")) return "m:silver";
      return `e:${METAL_TEXT[s.slice(0, 3)] ?? s.slice(0, 2)}`;
    case "energies":
      return `e:${s === "NGAS" ? "NG" : s.slice(0, 3)}`;
    case "indices": {
      const c = INDEX[s] ?? CCY[x.quote_ccy];
      return c ? `f:${c}` : `e:${s.slice(0, 3)}`;
    }
    case "crypto": {
      const base = (x.base_ccy ?? s.replace(/USD$/, "")).toLowerCase();
      return coins.has(base) ? `c:${base}` : `e:${base.replace(/^\d+/, "").slice(0, 3).toUpperCase()}`;
    }
    default: {
      // stocks: the ticker without the market suffix (HK codes without leading zeros)
      const t = s.split(".")[0].replace(/^0+(?=\d)/, "");
      return `e:${t.slice(0, 4)}`;
    }
  }
}

/**
 * The effective trading spec, layered like the engine (services/trading/src/specs.rs): core = symbol overrides over the
 * asset class; catalogue = symbol overrides over the row's own fields (contract size…) over its template.
 */
const FIELDS = ["contract_size", "lot_min", "lot_max", "lot_step", "max_leverage", "swap_mode", "swap_long", "swap_short", "triple_swap_day", "swap_days", "stops_level_points"];
function specOf(x) {
  const core = x.tier !== "catalogue";
  const base = core ? (specsFile.classes[x.asset_class] ?? {}) : specsFile.templates[x.template ?? x.asset_class];
  if (!base) throw new Error(`${x.symbol}: no template ${x.template ?? x.asset_class} in trading-specs.json`);
  const row = core ? {} : Object.fromEntries(["contract_size"].filter((k) => x[k] !== undefined).map((k) => [k, x[k]]));
  const sym = specsFile.symbols[x.symbol] ?? {};
  const out = {};
  for (const f of FIELDS) out[f] = sym[f] !== undefined ? sym[f] : row[f] !== undefined ? row[f] : base[f];
  return out;
}
const DAY = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
/** [contract size, lot min, lot max, lot step, max leverage, swap long, swap short, swap in % a year (1) or points (0), triple-swap day, swap days, stops level points] */
function specRow(x) {
  const p = specOf(x);
  return [p.contract_size ?? 1, p.lot_min ?? 0.01, p.lot_max ?? 100, p.lot_step ?? 0.01, p.max_leverage ?? 100, p.swap_long ?? 0, p.swap_short ?? 0, p.swap_mode === "percent" ? 1 : 0, p.triple_swap_day ? (DAY[p.triple_swap_day] ?? p.triple_swap_day) : "", p.swap_days ?? "mon-fri", p.stops_level_points ?? 0];
}

// a stable, small day change for the demo's reference prices (live builds take the real one from market-data)
function change(symbol) {
  let h = 2166136261;
  for (const c of symbol) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.round((((h >>> 0) % 4001) / 1000 - 2) * 100) / 100;
}

const rows = [];
for (const x of instruments) {
  if (x.tier !== "catalogue") continue;
  const snap = byCode.get(`${x.provider.market}|${x.provider.code}`) ?? byCodeAny.get(x.provider.code);
  if (!snap?.close) throw new Error(`no snapshot close for ${x.symbol} (${x.provider.market}/${x.provider.code})`);
  const price = +Number(snap.close).toFixed(x.digits);
  // live trading default from the row (the engine applies Back Office switches on top): "live": true, unless kept off
  const live = x.live === true && !x.live_off ? 1 : 0;
  rows.push([x.symbol, x.name ?? x.symbol, x.asset_class, x.digits, x.base_spread, price, change(x.symbol), specOf(x).contract_size ?? 1, x.session ?? "", x.quote_ccy ?? "", x.base_ccy ?? "", x.exchange ?? "", icon(x), live, x.live_off ?? ""]);
}
const specs = instruments.map((x) => [x.symbol, ...specRow(x)]);

const header = `// GENERATED by packages/mock/scripts/gen-catalogue.mjs from config/instruments.json (tier "catalogue") and the
// provider snapshot config/provider/infoway-snapshot.json (fetched ${snapshot.fetchedAt}). Do not edit by hand.
// [symbol, name, assetClass, digits, spread, reference price (last daily close), demo day change %, contract size,
//  session, quote ccy, base ccy, exchange, avatar, live trading by default (1/0), reason it is kept off live ("" if not)]
export type CatalogueRow = readonly [string, string, string, number, number, number, number, number, string, string, string, string, string, number, string];
// [symbol, contract size, lot min, lot max, lot step, max leverage, swap long, swap short, swap in % a year (1) or
//  points per lot (0), triple-swap day ("" = none), swap days, stops level points] for every instrument (core too)
export type SpecRow = readonly [string, number, number, number, number, number, number, number, number, string, string, number];

export const CATALOGUE_ROWS: readonly CatalogueRow[] = [
`;
const body = rows.map((r) => `  ${JSON.stringify(r)},`).join("\n");
const specBody = specs.map((r) => `  ${JSON.stringify(r)},`).join("\n");
const text = `${header}${body}\n];\n\nexport const SPEC_ROWS: readonly SpecRow[] = [\n${specBody}\n];\n`;
if (process.argv.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur !== text) {
    console.error("catalogue.generated.ts is out of date: run node packages/mock/scripts/gen-catalogue.mjs");
    process.exit(1);
  }
  console.log(`catalogue.generated.ts is up to date (${rows.length} instruments)`);
} else {
  writeFileSync(out, text);
  console.log(`wrote ${out} (${rows.length} instruments, ${(text.length / 1024).toFixed(0)} KB)`);
}

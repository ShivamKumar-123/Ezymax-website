// Regenerates tests/fixtures/indicators.json: reference values computed by the terminal's TypeScript
// indicators (apps/terminal/lib/indicators.ts + lib/ai-trader/series.ts) for a fixed sample series.
// The Rust port (src/indicators.rs) is checked against it in tests/indicator_parity.rs.
//
//   node services/algo/tools/gen-parity.mjs        (Node 22.6+ with type stripping)
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const dir = mkdtempSync(join(tmpdir(), "kalks-parity-"));
const ind = readFileSync(join(root, "apps/terminal/lib/indicators.ts"), "utf8");
const ser = readFileSync(join(root, "apps/terminal/lib/ai-trader/series.ts"), "utf8")
  .replace(/^import type .*$/gm, "")
  .replace('from "../indicators"', 'from "./indicators.ts"')
  .replace(/^import type \{[^}]*\} from "\.\/schema";$/m, "");
writeFileSync(join(dir, "indicators.ts"), ind);
writeFileSync(join(dir, "series.ts"), ser);
const I = await import(pathToFileURL(join(dir, "indicators.ts")).href);
const S = await import(pathToFileURL(join(dir, "series.ts")).href);

// deterministic random walk (mulberry32)
let seed = 20260928;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const bars = [];
let p = 1.1;
for (let i = 0; i < 400; i++) {
  const o = p;
  const c = +(o + (rnd() - 0.5) * 0.004).toFixed(5);
  const h = +(Math.max(o, c) + rnd() * 0.0015).toFixed(5);
  const l = +(Math.min(o, c) - rnd() * 0.0015).toFixed(5);
  if (i % 37 === 5) bars.push({ time: 1700000000 + i * 3600, open: o, high: o, low: o, close: o, volume: 1 }); // flat bar
  else bars.push({ time: 1700000000 + i * 3600, open: o, high: h, low: l, close: c, volume: Math.round(rnd() * 1000) });
  p = c;
}
const close = bars.map((b) => b.close);
const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
const clean = (a) => a.map((v) => (Number.isFinite(v) ? v : null));
const out = {};
const put = (k, v) => (out[k] = clean(v));
put("sma_20", I.sma(close, 20));
put("ema_20", I.ema(close, 20));
put("ema_50", I.ema(close, 50));
put("rsi_14", I.rsi(close, 14));
const m = I.macd(close, 12, 26, 9);
put("macd_line", m.line);
put("macd_signal", m.signal);
put("macd_hist", m.hist);
const bb = I.bollinger(close, 20, 2);
put("bb_mid", bb.mid);
put("bb_up", bb.up);
put("bb_lo", bb.lo);
const candles = bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
put("atr_14", S.atr(candles, 14));
const cache = new Map();
const op = (indicator, period, extra = {}) => S.operandSeries(candles, { kind: "indicator", field: "close", indicator, period, period2: 0, period3: 0, mult: 0, value: 0, pattern: "none", ...extra }, cache);
put("stoch_k_14_3", op("stoch_k", 14, { period2: 3 }));
put("stoch_d_14_3", op("stoch_d", 14, { period2: 3 }));
put("highest_20", op("highest", 20));
put("lowest_20", op("lowest", 20));
for (const pat of ["bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar"]) {
  put(`pattern_${pat}`, S.operandSeries(candles, { kind: "candle", field: "close", indicator: "none", period: 0, period2: 0, period3: 0, mult: 0, value: 0, pattern: pat }, cache));
}
put("wma_20", I.calcIndicator("wma", candles, { period: 20 }).ma);
put("cci_20", I.calcIndicator("cci", candles, { period: 20, source: "hlc3" }).cci);
put("willr_14", I.calcIndicator("willr", candles, { period: 14 }).wr);
put("momentum_14", I.calcIndicator("momentum", candles, { period: 14 }).mom);
put("roc_14", I.calcIndicator("roc", candles, { period: 14 }).roc);
put("stddev_20", I.calcIndicator("stddev", candles, { period: 20 }).sd);
const adx = I.calcIndicator("adx", candles, { period: 14, smooth: 14 });
put("adx_14", adx.adx);
put("pdi_14", adx.pdi);
put("mdi_14", adx.mdi);
void hlc3;

const fixture = { generated: "services/algo/tools/gen-parity.mjs", bars: bars.map((b) => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })), series: out };
writeFileSync(join(here, "../tests/fixtures/indicators.json"), JSON.stringify(fixture));
console.log(`wrote ${Object.keys(out).length} series x ${bars.length} bars`);

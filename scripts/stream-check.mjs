// Live stream check of the catalogue: subscribes to every forex / metals / energies / indices / crypto catalogue
// symbol on a Kalks market-data stream (a client like any browser: no provider key) for N seconds and writes
// config/provider/stream-check.json: live ticks, median raw spread and last mid per symbol.
//
// scripts/gen-catalogue.mjs reads it: the typical spread (base_spread) comes from the measured spread, and a symbol
// that did not tick, or ticked rarely with a very wide spread, is kept off live trading (with the reason in the row).
//
// USAGE  node scripts/stream-check.mjs [seconds=100] [stream=wss://api.kalkstrade.com/v1/stream]
// Run it while the markets are open (a weekday, US session); Asian cash indices are closed then (their exchange
// sessions handle that).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const secs = Number(process.argv[2] || 100);
const url = process.argv[3] || "wss://api.kalkstrade.com/v1/stream";
const CLASSES = ["forex", "metals", "energies", "indices", "crypto"];
const cat = JSON.parse(readFileSync(join(ROOT, "config", "instruments.json"), "utf8")).filter((r) => r.tier === "catalogue" && CLASSES.includes(r.asset_class));
const stats = Object.fromEntries(cat.map((r) => [r.symbol, { live: 0, spreads: [], mid: null }]));

const ws = new WebSocket(`${url}?group=raw`);
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
ws.send(JSON.stringify({ op: "subscribe", symbols: Object.keys(stats) }));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  const s = m.type === "quote" && !m.d ? stats[m.s] : null;
  if (!s) return;
  s.live++;
  s.spreads.push(m.a - m.b);
  s.mid = (m.a + m.b) / 2;
};
const started = new Date().toISOString().slice(0, 16) + "Z";
await new Promise((r) => setTimeout(r, secs * 1000));
ws.close();

const out = { checkedAt: started, source: `${url} (group raw), ${secs} s`, generatedBy: "scripts/stream-check.mjs", symbols: {} };
for (const [k, s] of Object.entries(stats).sort()) {
  const sp = s.spreads.sort((a, b) => a - b);
  out.symbols[k] = { ticks: s.live, spread: sp.length ? sp[Math.floor(sp.length / 2)] : null, mid: s.mid };
}
writeFileSync(join(ROOT, "config", "provider", "stream-check.json"), JSON.stringify(out, null, 0).replace(/,"(?=[A-Z0-9.]+":\{)/g, ',\n"') + "\n");
console.log(`${Object.values(out.symbols).filter((x) => x.ticks > 1).length} of ${cat.length} symbols ticked`);
process.exit(0);

// Test catalogue for the Instruments panel: `?stress=1500` (or localStorage "kalks.stress" = "1500") adds that many
// generated markets to the list, each with its own simulated price, so the virtualised list can be checked at the size
// the real catalogue is growing to (1,000+ instruments). Generated rows are list-only: they don't open charts or orders.
// The simulated prices tick only for rows that are listening (the rows on screen), like the real feed's simulator.
import { INSTRUMENTS, INSTRUMENT_MAP, type AssetClass, type Instrument, type Quote } from "@kalks/mock";

const MAX = 5000;

function readCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const q = new URLSearchParams(window.location.search).get("stress");
    if (q !== null) sessionStorage.setItem("kalks.stress", q);
    const raw = q ?? sessionStorage.getItem("kalks.stress") ?? localStorage.getItem("kalks.stress");
    const n = Math.floor(Number(raw ?? 0));
    return Number.isFinite(n) && n > 0 ? Math.min(MAX, n) : 0;
  } catch {
    return 0;
  }
}

/** extra asset classes the growing catalogue may bring; the panel's filter must cope with classes it doesn't know */
const EXTRA_CLASSES = ["etfs", "bonds", "futures"];

function generate(n: number): Instrument[] {
  const out: Instrument[] = [];
  for (let i = 0; i < n; i++) {
    const base = INSTRUMENTS[i % INSTRUMENTS.length]!;
    const assetClass = (i % 10 === 9 ? EXTRA_CLASSES[i % EXTRA_CLASSES.length] : base.assetClass) as AssetClass;
    const k = 0.6 + ((i * 7919) % 1000) / 1000;
    out.push({ ...base, symbol: `${base.symbol}.T${String(i + 1).padStart(4, "0")}`, name: `${base.name} (test ${i + 1})`, assetClass, price: base.price * k, spread: base.spread * k, change: ((i * 37) % 600) / 100 - 3 });
  }
  return out;
}

export const STRESS_COUNT = readCount();
export const STRESS_INSTRUMENTS: Instrument[] = STRESS_COUNT ? generate(STRESS_COUNT) : [];
const STRESS_MAP = new Map(STRESS_INSTRUMENTS.map((i) => [i.symbol, i]));
// test mode only: let price formatting (digits) and avatars find the generated markets; INSTRUMENTS stays unchanged
for (const i of STRESS_INSTRUMENTS) (INSTRUMENT_MAP as Record<string, Instrument>)[i.symbol] = i;
export const isStressSymbol = (s: string) => STRESS_MAP.has(s);

/* ---------------- simulated prices for the generated markets ---------------- */

type Listener = (q: Quote) => void;
const quotes = new Map<string, Quote>();
const listeners = new Map<string, Set<Listener>>();
let timer: ReturnType<typeof setInterval> | null = null;

function make(inst: Instrument, mid: number, dir: -1 | 0 | 1): Quote {
  const half = inst.spread / 2;
  return { symbol: inst.symbol, bid: mid - half, ask: mid + half, last: mid, change: inst.change + ((mid - inst.price) / inst.price) * 100, dir, time: Date.now() };
}

export function stressQuote(symbol: string): Quote {
  let q = quotes.get(symbol);
  if (!q) {
    const inst = STRESS_MAP.get(symbol);
    q = inst ? make(inst, inst.price, 0) : { symbol, bid: 0, ask: 0, last: 0, change: 0, dir: 0, time: 0 };
    quotes.set(symbol, q);
  }
  return q;
}

function tick() {
  for (const [symbol, subs] of listeners) {
    if (!subs.size || Math.random() > 0.5) continue;
    const inst = STRESS_MAP.get(symbol);
    if (!inst) continue;
    const prev = stressQuote(symbol);
    const mid = (prev.bid + prev.ask) / 2;
    const next = mid * (1 + (Math.random() - 0.5) * 0.0006);
    const q = make(inst, next, next > mid ? 1 : next < mid ? -1 : 0);
    quotes.set(symbol, q);
    subs.forEach((fn) => fn(q));
  }
}

export function subscribeStress(symbol: string, fn: Listener): () => void {
  if (!listeners.has(symbol)) listeners.set(symbol, new Set());
  listeners.get(symbol)!.add(fn);
  timer ??= setInterval(tick, 450);
  return () => {
    listeners.get(symbol)?.delete(fn);
    if (![...listeners.values()].some((s) => s.size) && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

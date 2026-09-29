// Instrument catalogue from market-data (/v1/instruments) plus display names. Names are reference data (the
// same as the web apps show), never prices. Cached on the device.
import { kv } from "@/lib/kv";
import { loadConfig } from "./config";

export type Segment = "forex" | "metals" | "indices" | "energies" | "crypto" | "stocks";
export const SEGMENTS: Segment[] = ["forex", "metals", "indices", "energies", "crypto", "stocks"];

export type Instrument = { symbol: string; segment: Segment; digits: number; name: string };

const NAMES: Record<string, string> = {
  EURUSD: "Euro vs US Dollar",
  GBPUSD: "Pound vs US Dollar",
  USDJPY: "US Dollar vs Yen",
  AUDUSD: "Aussie vs US Dollar",
  USDCAD: "US Dollar vs Loonie",
  USDCHF: "US Dollar vs Franc",
  GBPJPY: "Pound vs Yen",
  EURJPY: "Euro vs Yen",
  USDINR: "US Dollar vs Rupee",
  XAUUSD: "Gold",
  XAGUSD: "Silver",
  US30: "Dow Jones 30",
  NAS100: "Nasdaq 100",
  SPX500: "S&P 500",
  GER40: "Germany 40",
  UK100: "FTSE 100",
  JP225: "Nikkei 225",
  USOIL: "WTI Crude Oil",
  UKOIL: "Brent Crude Oil",
  BTCUSD: "Bitcoin",
  ETHUSD: "Ethereum",
  SOLUSD: "Solana",
  XRPUSD: "Ripple",
  AAPL: "Apple",
  TSLA: "Tesla",
  NVDA: "NVIDIA",
  META: "Meta Platforms",
  NFLX: "Netflix",
};

const KEY = "kalks.instruments";
let list: Instrument[] = kv.getJSON<Instrument[]>(KEY) ?? [];
let bySymbol = new Map(list.map((i) => [i.symbol, i]));
const subs = new Set<() => void>();

const toSegment = (c: string): Segment => (SEGMENTS.includes(c as Segment) ? (c as Segment) : "forex");

export function instruments(): Instrument[] {
  return list;
}
export function instrument(symbol: string): Instrument {
  return bySymbol.get(symbol) ?? { symbol, segment: "forex", digits: 5, name: NAMES[symbol] ?? symbol };
}
export function onInstruments(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

let loading: Promise<Instrument[]> | null = null;
export function loadInstruments(): Promise<Instrument[]> {
  if (loading) return loading;
  loading = (async () => {
    const cfg = await loadConfig();
    if (!cfg) return list;
    try {
      const res = await fetch(`${cfg.marketData.http}/v1/instruments`);
      if (!res.ok) return list;
      const raw = (await res.json()) as { symbol: string; asset_class: string; digits: number }[];
      const next = raw.map((r) => ({ symbol: r.symbol, segment: toSegment(r.asset_class), digits: r.digits, name: NAMES[r.symbol] ?? r.symbol }));
      if (next.length) {
        list = next;
        bySymbol = new Map(list.map((i) => [i.symbol, i]));
        kv.setJSON(KEY, list);
        subs.forEach((f) => f());
      }
    } catch {}
    return list;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

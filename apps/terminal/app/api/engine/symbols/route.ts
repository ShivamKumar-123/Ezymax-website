/**
 * GET /api/engine/symbols: the live-trading switch of the catalogue markets, `{ live: [...], off: [...] }` (core
 * instruments always trade live and are not listed). Read from the trading engine's `/v1/symbols` (no session needed:
 * this is public product information) and cached for a minute. The terminal hides markets that are off from live
 * accounts and guests (lib/scope.ts); the engine still refuses them (`symbol_demo_only`).
 */
import { engine, reply } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

let cached: { at: number; body: { live: string[]; off: string[] } } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < 60_000) return reply(200, cached.body, { headers: { "cache-control": "public, max-age=60" } });
  const r = await engine<{ symbols?: { symbol?: string; liveTrading?: boolean }[] }>("/v1/symbols?tier=catalogue");
  if (r.status !== 200 || !Array.isArray(r.data.symbols)) return reply(503, { error: { code: "unavailable", message: "The trade server is unavailable." } });
  const live: string[] = [];
  const off: string[] = [];
  for (const s of r.data.symbols) if (typeof s.symbol === "string") (s.liveTrading ? live : off).push(s.symbol);
  cached = { at: Date.now(), body: { live, off } };
  return reply(200, cached.body, { headers: { "cache-control": "public, max-age=60" } });
}

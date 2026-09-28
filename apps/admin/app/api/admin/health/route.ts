import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/bff";
import { marketData } from "@/lib/market-data";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";

const TRADING_URL = (process.env.TRADING_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");
type TrHealth = { status?: string; db?: boolean; feedConnected?: boolean; accountsLoaded?: number; lagMs?: number; commitErrors?: number; lp?: { connected?: boolean; name?: string } };

type MdHealth = { ok?: boolean; provider_streams?: string[]; symbols_ticking?: number; stale_over_60s?: string[]; ticks_total?: number };

// System health for the Command Center: gateway, market-data and trading-engine /health, probed server-side.
export async function GET(req: NextRequest) {
  const who = await requireStaff(req);
  if (who instanceof NextResponse) return who;

  const t0 = Date.now();
  const gw = await fetch(`${GATEWAY_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) })
    .then(async (r) => ({ status: r.status, data: (await r.json().catch(() => null)) as { status?: string; db?: boolean } | null }))
    .catch(() => ({ status: 503, data: null }));
  const gwMs = Date.now() - t0;
  const md = await marketData<MdHealth>("/health", { timeoutMs: 4000 });
  const t1 = Date.now();
  const tr = await fetch(`${TRADING_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) })
    .then(async (r) => ({ status: r.status, data: (await r.json().catch(() => null)) as TrHealth | null }))
    .catch(() => ({ status: 503, data: null as TrHealth | null }));
  const trMs = Date.now() - t1;

  return NextResponse.json(
    {
      checked_at: new Date().toISOString(),
      services: [
        {
          key: "gateway",
          name: "Gateway",
          detail: "Sign-in, sessions, audit log",
          ok: gw.status === 200 && gw.data?.status === "ok",
          reachable: gw.status !== 503 || gw.data !== null,
          latency_ms: gwMs,
          facts: gw.data ? { database: gw.data.db ? "connected" : "down" } : {},
        },
        {
          key: "market-data",
          name: "Market data",
          detail: "Prices, candles, spreads",
          ok: md.status === 200 && md.data?.ok === true,
          reachable: md.data !== null,
          latency_ms: md.ms,
          facts: md.data
            ? {
                streams: (md.data.provider_streams ?? []).join(", ") || "none",
                ticking: String(md.data.symbols_ticking ?? 0),
                stale: (md.data.stale_over_60s ?? []).join(", ") || "none",
              }
            : {},
        },
        {
          key: "trading",
          name: "Trading engine",
          detail: "Accounts, orders, positions, ledger, dealing",
          ok: tr.status === 200 && tr.data?.status === "ok" && tr.data.db === true && tr.data.feedConnected === true,
          reachable: tr.data !== null,
          latency_ms: trMs,
          facts: tr.data
            ? {
                database: tr.data.db ? "connected" : "down",
                prices: tr.data.feedConnected ? "connected" : "down",
                accounts: String(tr.data.accountsLoaded ?? 0),
                lag: `${tr.data.lagMs ?? 0} ms`,
                LP: tr.data.lp?.connected ? (tr.data.lp.name ?? "connected") : "not connected",
              }
            : {},
        },
      ],
    },
    { headers: { "cache-control": "no-store" } },
  );
}

// Server-only client for the market-data service's admin API (services/market-data).
// MARKET_DATA_ADMIN_TOKEN never leaves the server: the browser talks to /api/admin/spreads only.

const MARKET_DATA_URL = (process.env.MARKET_DATA_URL ?? "http://127.0.0.1:8081").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.MARKET_DATA_ADMIN_TOKEN ?? "";

export type Markup = { group_code: string; symbol: string; markup_points: number; min_spread_points: number };
export type MdInstrument = { symbol: string; asset_class: string; digits: number; base_spread: number };
export type MdQuote = { bid: number; ask: number; t: number };

export const marketDataConfigured = () => ADMIN_TOKEN.length > 0;

export async function marketData<T>(path: string, init: { method?: "GET" | "PUT"; body?: unknown; admin?: boolean; timeoutMs?: number } = {}): Promise<{ status: number; data: T | null; ms: number }> {
  const headers: Record<string, string> = {};
  if (init.admin) headers.authorization = `Bearer ${ADMIN_TOKEN}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const t0 = Date.now();
  try {
    const res = await fetch(`${MARKET_DATA_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 5000),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, data, ms: Date.now() - t0 };
  } catch {
    return { status: 503, data: null, ms: Date.now() - t0 };
  }
}

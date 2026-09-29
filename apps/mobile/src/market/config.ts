// Public service locations for this broker, from GET /api/mobile/config (cached on the device so a cold start
// can open the price stream before the network answers).
import { apiGet } from "@/lib/api";
import { kv } from "@/lib/kv";

export type MarketConfig = { marketData: { http: string; ws: string }; engineStream: string; terminalUrl: string; clientAreaUrl: string };

const KEY = "kalks.config";
let current: MarketConfig | null = kv.getJSON<MarketConfig>(KEY);
let loading: Promise<MarketConfig | null> | null = null;

export function cachedConfig(): MarketConfig | null {
  return current;
}

/** The config (cached one at once when present; refreshed in the background). */
export function loadConfig(): Promise<MarketConfig | null> {
  if (!loading) {
    loading = apiGet<MarketConfig>("config", { auth: false, timeoutMs: 8000 }).then((r) => {
      loading = null;
      if (r.ok && r.data.marketData?.http) {
        current = r.data;
        kv.setJSON(KEY, r.data);
      }
      return current;
    });
  }
  return current ? Promise.resolve(current) : loading;
}

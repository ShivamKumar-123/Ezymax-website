import ApiService from '../services/ApiService';

const TTL_MS = 60_000;
const cache = new Map();
const inflight = new Map();

export async function getSparkData(symbol) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym) return [];

  const now = Date.now();
  const hit = cache.get(sym);
  if (hit && (now - hit.ts) < TTL_MS) return hit.data;

  if (inflight.has(sym)) return inflight.get(sym);

  const p = (async () => {
    try {
      const bars = await ApiService.getBars(sym, { resolution: '60', limit: 24 });
      const points = Array.isArray(bars) ? bars.map((b) => Number(b?.close ?? b?.c ?? 0)).filter(Number.isFinite) : [];
      cache.set(sym, { ts: Date.now(), data: points });
      return points;
    } catch (_) {
      cache.set(sym, { ts: Date.now(), data: [] });
      return [];
    } finally {
      inflight.delete(sym);
    }
  })();
  inflight.set(sym, p);
  return p;
}

export function clearSparkCache() {
  cache.clear();
}

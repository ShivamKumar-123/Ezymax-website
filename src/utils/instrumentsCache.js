import ApiService from '../services/ApiService';

const TTL_MS = 5 * 60_000;
let cache = null;
let inflight = null;

export async function getInstruments() {
  const now = Date.now();
  if (cache && (now - cache.ts) < TTL_MS) return cache.list;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await ApiService.getInstruments();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
      cache = { ts: Date.now(), list };
      return list;
    } catch (_) {
      if (cache) return cache.list;
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearInstrumentsCache() {
  cache = null;
}

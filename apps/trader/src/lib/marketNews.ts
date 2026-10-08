/**
 * Live market news for the homepage ticker, from the platform's own news service (services/news in the Ezymex repo):
 * headlines it aggregates from official sources (central-bank feeds and others) and the economic calendar it reads
 * from ForexFactory's public weekly export. The service is internal: only this server talks to it, with
 * NEWS_INTERNAL_TOKEN; the browser gets the sanitised list below and nothing else.
 */

export type NewsTickerItem = {
  kind: 'news' | 'event';
  title: string;
  /** News: the publisher (e.g. "Federal Reserve"). Events: the currency (e.g. "USD"). */
  source: string;
  /** News: the article on the publisher's site. Events: the Client Area calendar. */
  url: string;
  /** ISO time: published (news) or scheduled (events). */
  at: string;
  /** Events: 1 low, 2 medium, 3 high. News: null. */
  impact: 1 | 2 | 3 | null;
  currencies: string[];
  symbols: string[];
};

export type MarketNews = { ok: boolean; items: NewsTickerItem[]; updatedAt: string };

const MAX_NEWS = 14;
const MAX_EVENTS = 6;

/* ── Sanitiser (pure; unit-tested) ──────────────────────────────────────────── */

function text(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // strip tags and control characters, collapse whitespace
  const clean = v
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

function httpUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function isoTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function codes(v: unknown, pattern: RegExp, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const c = x.trim().toUpperCase();
    if (pattern.test(c) && !out.includes(c)) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

const CCY = /^[A-Z]{3}$/;
const SYMBOL = /^[A-Z0-9.]{2,12}$/;

/**
 * Turn the service's responses into ticker items.
 * @param news     body of GET /v1/news  ({pinned[], items[], next})
 * @param calendar body of GET /v1/calendar ({events[]}) or GET /v1/calendar/next ({event})
 * @param calendarUrl where event items link (the Client Area calendar)
 */
export function sanitiseMarketNews(news: unknown, calendar: unknown, calendarUrl: string, now = Date.now()): NewsTickerItem[] {
  const items: NewsTickerItem[] = [];
  const seen = new Set<string>();

  const n = (news && typeof news === 'object' ? news : {}) as { pinned?: unknown; items?: unknown };
  const stories = [...(Array.isArray(n.pinned) ? n.pinned : []), ...(Array.isArray(n.items) ? n.items : [])];
  for (const raw of stories) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = text(r.title, 140);
    const url = httpUrl(r.link);
    const at = isoTime(r.publishedAt);
    if (!title || !url || !at || Date.parse(at) > now + 5 * 60_000) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const src = (r.source && typeof r.source === 'object' ? r.source : {}) as Record<string, unknown>;
    items.push({
      kind: 'news',
      title,
      source: text(src.name, 40) || new URL(url).hostname.replace(/^www\./, ''),
      url,
      at,
      impact: null,
      currencies: codes(r.currencies, CCY, 4),
      symbols: codes(r.symbols, SYMBOL, 4),
    });
  }
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const newsItems = items.slice(0, MAX_NEWS);

  const c = (calendar && typeof calendar === 'object' ? calendar : {}) as { events?: unknown; event?: unknown };
  const rawEvents = Array.isArray(c.events) ? c.events : c.event ? [c.event] : [];
  const events: NewsTickerItem[] = [];
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = text(r.title, 90);
    const at = isoTime(r.startsAt);
    const impact = typeof r.impact === 'number' && [1, 2, 3].includes(r.impact) ? (r.impact as 1 | 2 | 3) : null;
    if (!title || !at || r.allDay === true || Date.parse(at) <= now || impact === null) continue;
    const ccy = typeof r.currency === 'string' && CCY.test(r.currency.toUpperCase()) ? r.currency.toUpperCase() : '';
    events.push({
      kind: 'event',
      title,
      source: ccy,
      url: calendarUrl,
      at,
      impact,
      currencies: ccy ? [ccy] : [],
      symbols: codes(r.symbols, SYMBOL, 4),
    });
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  // Upcoming high-impact events lead, then the latest headlines.
  return [...events.slice(0, MAX_EVENTS), ...newsItems];
}

/* ── Formatting helpers (shared by the ticker) ─────────────────────────────── */

export function impactLabel(i: 1 | 2 | 3 | null): string {
  return i === 3 ? 'HIGH' : i === 2 ? 'MED' : i === 1 ? 'LOW' : '';
}

/** "in 2h 15m", "in 3d 4h", "12m ago", "just now". */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const mins = Math.round(Math.abs(diff) / 60_000);
  if (mins < 1) return diff >= 0 ? 'now' : 'just now';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `in ${span}` : `${span} ago`;
}

/* ── Server fetch ──────────────────────────────────────────────────────────── */

/** Server only. Never throws: an unreachable or unconfigured service gives {ok: false, items: []}. */
export async function getMarketNews(calendarUrl: string): Promise<MarketNews> {
  const base = (process.env.NEWS_URL || 'http://127.0.0.1:8103').replace(/\/+$/, '');
  const headers = { 'x-ezymex-internal': process.env.NEWS_INTERNAL_TOKEN || '', 'x-ezymex-tenant': 'ezymex' };
  const now = new Date();
  const to = new Date(now.getTime() + 4 * 86_400_000);
  const get = async (path: string) => {
    try {
      const res = await fetch(base + path, { headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
      return res.ok ? ((await res.json()) as unknown) : null;
    } catch {
      return null;
    }
  };
  const [news, calendar] = await Promise.all([
    get('/v1/news?limit=20'),
    get(`/v1/calendar?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}&impact=3`),
  ]);
  // The full calendar answered nothing usable: ask for just the next high-impact event.
  const cal = calendar && Array.isArray((calendar as { events?: unknown }).events) ? calendar : await get('/v1/calendar/next?impact=3');
  const items = sanitiseMarketNews(news, cal, calendarUrl, now.getTime());
  return { ok: news !== null || cal !== null, items, updatedAt: now.toISOString() };
}

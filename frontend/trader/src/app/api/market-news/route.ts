import { NextResponse } from 'next/server';

/**
 * GET /api/market-news?q=<query>&limit=8
 *
 * Server-side proxy for Google News RSS (no API key, updated continuously),
 * returning a compact JSON list the dashboard's Global-markets panel renders
 * natively. Fetched server-side to avoid CORS, cached 10 minutes per query.
 *
 * To switch providers later (Finnhub / NewsAPI / a licensed feed), only this
 * file changes — the client contract `{ items: NewsItem[] }` stays the same.
 */
export const dynamic = 'force-dynamic';

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; items: NewsItem[] }>();

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1] ? decode(m[1]) : '';
};

function parseRss(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1] ?? '';
    const source = tag(block, 'source');
    let title = tag(block, 'title');
    // Google News appends " - Source" to titles; strip it when it matches.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const link = tag(block, 'link');
    const pub = tag(block, 'pubDate');
    const ts = Date.parse(pub);
    if (!title || !link) continue;
    items.push({
      title,
      link,
      source: source || 'Google News',
      publishedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString(),
    });
  }
  return items;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || 'stock market').slice(0, 120);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 8), 1), 20);
  const key = `${q}|${limit}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ items: hit.items, cached: true });
  }

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (SwissCresta dashboard news)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const items = parseRss(await res.text(), limit);
    cache.set(key, { at: Date.now(), items });
    return NextResponse.json({ items, cached: false });
  } catch (err) {
    // Serve stale cache on upstream failure rather than an empty panel.
    if (hit) return NextResponse.json({ items: hit.items, cached: true, stale: true });
    return NextResponse.json(
      { items: [], error: err instanceof Error ? err.message : 'news fetch failed' },
      { status: 502 },
    );
  }
}

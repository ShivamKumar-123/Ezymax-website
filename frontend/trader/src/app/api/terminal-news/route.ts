import { NextResponse } from 'next/server';

/**
 * GET /api/terminal-news?topic=all|forex|crypto|commodities|markets&limit=30
 *
 * Server-side aggregator for the trading-terminal news panel. Pulls several
 * public RSS feeds that ship a cover image per story (FXStreet, Investing.com,
 * Cointelegraph, CoinDesk), normalises them to one shape, dedups,
 * sorts newest-first and caches 10 minutes per topic. Feeds that fail are
 * skipped so one flaky provider never blanks the panel; on a total failure the
 * last good payload is served stale.
 *
 * Client contract: `{ items: TerminalNewsItem[], updatedAt: ISO }`.
 */
export const dynamic = 'force-dynamic';

export interface TerminalNewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  topic: Topic;
  publishedAt: string; // ISO
  image: string | null;
  summary: string;
}

type Topic = 'forex' | 'crypto' | 'commodities' | 'markets';
type TopicFilter = Topic | 'all';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 SwissCresta-terminal';

const FEEDS: { url: string; source: string; topic: Topic }[] = [
  { url: 'https://www.fxstreet.com/rss/news', source: 'FXStreet', topic: 'forex' },
  { url: 'https://www.investing.com/rss/news_1.rss', source: 'Investing.com', topic: 'forex' },
  { url: 'https://www.investing.com/rss/news_11.rss', source: 'Investing.com', topic: 'commodities' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', topic: 'crypto' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss', source: 'CoinDesk', topic: 'crypto' },
  { url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com', topic: 'markets' },
  { url: 'https://www.investing.com/rss/news_95.rss', source: 'Investing.com', topic: 'markets' },
];

const CACHE_TTL_MS = 10 * 60 * 1000;
const feedCache = new Map<string, { at: number; items: TerminalNewsItem[] }>();

const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1] ? decodeEntities(m[1]) : '';
};

const attr = (block: string, tagName: string, attrName: string) => {
  const m = block.match(new RegExp(`<${tagName}\\b[^>]*\\b${attrName}=["']([^"']+)["']`, 'i'));
  return m?.[1] ? decodeEntities(m[1]) : '';
};

function extractImage(block: string): string | null {
  const candidates = [
    attr(block, 'media:content', 'url'),
    attr(block, 'media:thumbnail', 'url'),
    attr(block, 'enclosure', 'url'),
  ];
  const desc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '';
  const inDesc = decodeEntities(desc).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (inDesc) candidates.push(inDesc);
  const enclosureType = attr(block, 'enclosure', 'type');
  for (const c of candidates) {
    if (!c) continue;
    if (!/^https?:\/\//i.test(c)) continue;
    // Skip enclosures that are clearly not images (audio/video podcasts).
    if (c === candidates[2] && enclosureType && !enclosureType.startsWith('image/')) continue;
    return c;
  }
  return null;
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  let ts = Date.parse(raw);
  // Investing.com: "2026-08-22 05:12:11" (GMT, no zone marker).
  if (!Number.isFinite(ts) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) ts = Date.parse(raw.replace(' ', 'T') + 'Z');
  return Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString();
}

function parseFeed(xml: string, source: string, topic: Topic): TerminalNewsItem[] {
  const items: TerminalNewsItem[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1] ?? '';
    const title = stripTags(tag(block, 'title'));
    const link = tag(block, 'link') || attr(block, 'link', 'href') || tag(block, 'guid');
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const summary = stripTags(tag(block, 'description')).slice(0, 220);
    items.push({
      id: `${source}:${link}`,
      title,
      link: link.replace(/[?&]utm_[^&]+/g, '').replace(/\?$/, ''),
      source,
      topic,
      publishedAt: parseDate(tag(block, 'pubDate') || tag(block, 'dc:date') || tag(block, 'published')),
      image: extractImage(block),
      summary,
    });
  }
  return items;
}

async function loadFeed(feed: (typeof FEEDS)[number]): Promise<TerminalNewsItem[]> {
  const hit = feedCache.get(feed.url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
      signal: AbortSignal.timeout(9000),
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const items = parseFeed(await res.text(), feed.source, feed.topic);
    if (items.length > 0) feedCache.set(feed.url, { at: Date.now(), items });
    return items.length > 0 ? items : hit?.items ?? [];
  } catch {
    return hit?.items ?? []; // stale-if-error, else skip this provider
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicParam = (searchParams.get('topic') || 'all') as TopicFilter;
  const topic: TopicFilter = ['all', 'forex', 'crypto', 'commodities', 'markets'].includes(topicParam) ? topicParam : 'all';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 30), 1), 60);

  const feeds = FEEDS.filter((f) => topic === 'all' || f.topic === topic);
  const results = await Promise.all(feeds.map(loadFeed));

  const seen = new Set<string>();
  const items = results
    .flat()
    .filter((it) => {
      const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(key) || seen.has(it.link)) return false;
      seen.add(key);
      seen.add(it.link);
      return true;
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  // Keep the mix balanced for "all": no single provider hogs the top of the list.
  const perSourceCap = topic === 'all' ? Math.max(6, Math.ceil(limit / 3)) : limit;
  const counts = new Map<string, number>();
  const balanced = items.filter((it) => {
    const k = `${it.source}|${it.topic}`;
    const n = counts.get(k) ?? 0;
    if (n >= perSourceCap) return false;
    counts.set(k, n + 1);
    return true;
  }).slice(0, limit);

  return NextResponse.json(
    { items: balanced, updatedAt: new Date().toISOString(), sources: feeds.map((f) => f.source).filter((v, i, a) => a.indexOf(v) === i) },
    { headers: { 'Cache-Control': 'private, max-age=120' } },
  );
}

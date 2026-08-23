import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

/**
 * GET /api/economic-calendar
 *
 * Forex Factory's published weekly calendar (the same data as
 * forexfactory.com/calendar, served by FF's CDN as JSON). Proxied server-side
 * to avoid CORS. FF's CDN rate-limits aggressively (HTTP 429), so the last
 * good copy is cached both in memory AND on disk — a dev reload / redeploy
 * never forces a refetch, and a 429 serves the cached week instead of a blank
 * panel. Fresh fetch at most once an hour.
 */
export const dynamic = 'force-dynamic';

export interface CalendarEvent {
  title: string;
  country: string; // currency code: USD, EUR, GBP…
  date: string; // ISO with offset, as published
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  forecast: string;
  previous: string;
  actual?: string;
}

const SOURCE = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CACHE_TTL_MS = 60 * 60 * 1000;
const RETRY_BACKOFF_MS = 10 * 60 * 1000; // after an upstream failure, don't hammer again for 10 min
const DISK_CACHE = path.join(os.tmpdir(), 'swisscresta-ff-calendar.json');

type CacheShape = { at: number; events: CalendarEvent[] };
let memCache: CacheShape | null = null;
let lastFailureAt = 0;

async function readDisk(): Promise<CacheShape | null> {
  try {
    const raw = await fs.readFile(DISK_CACHE, 'utf8');
    const parsed = JSON.parse(raw) as CacheShape;
    return Array.isArray(parsed?.events) && typeof parsed.at === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeDisk(c: CacheShape) {
  try { await fs.writeFile(DISK_CACHE, JSON.stringify(c), 'utf8'); } catch { /* read-only fs etc. */ }
}

function normalise(raw: unknown): CalendarEvent[] {
  return (Array.isArray(raw) ? (raw as Partial<CalendarEvent>[]) : [])
    .filter((e) => e && typeof e.title === 'string' && typeof e.date === 'string')
    .map((e) => ({
      title: e.title as string,
      country: String(e.country ?? ''),
      date: e.date as string,
      impact: (['High', 'Medium', 'Low', 'Holiday'].includes(String(e.impact)) ? e.impact : 'Low') as CalendarEvent['impact'],
      forecast: String(e.forecast ?? ''),
      previous: String(e.previous ?? ''),
      actual: e.actual != null && e.actual !== '' ? String(e.actual) : undefined,
    }));
}

export async function GET() {
  const cached = memCache ?? (memCache = await readDisk());
  const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
  const backingOff = Date.now() - lastFailureAt < RETRY_BACKOFF_MS;

  if (cached && (fresh || backingOff)) {
    return NextResponse.json({ events: cached.events, cached: true, stale: !fresh, updatedAt: new Date(cached.at).toISOString() });
  }

  try {
    const res = await fetch(SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (SwissCresta terminal calendar)' },
      signal: AbortSignal.timeout(9000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const events = normalise(await res.json());
    if (events.length === 0) throw new Error('upstream returned no events');
    memCache = { at: Date.now(), events };
    void writeDisk(memCache);
    return NextResponse.json({ events, cached: false, updatedAt: new Date(memCache.at).toISOString() });
  } catch (err) {
    lastFailureAt = Date.now();
    if (cached) {
      return NextResponse.json({ events: cached.events, cached: true, stale: true, updatedAt: new Date(cached.at).toISOString() });
    }
    return NextResponse.json({ events: [], error: err instanceof Error ? err.message : 'calendar fetch failed' }, { status: 502 });
  }
}

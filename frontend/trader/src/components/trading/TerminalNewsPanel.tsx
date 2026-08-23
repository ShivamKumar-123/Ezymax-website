'use client';

// Trading-terminal news panel — native, themed (no third-party iframe).
//   • News tab: image cards aggregated from FXStreet / Investing.com /
//     Cointelegraph / CoinDesk via /api/terminal-news, with
//     topic chips (All · Forex · Crypto · Commodities · Markets).
//   • Calendar tab: this week's Forex Factory economic calendar via
//     /api/economic-calendar, grouped by day with impact colours.
// Opens stories in a new tab. Refreshes every 5 minutes while mounted.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CalendarDays, ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import type { TerminalNewsItem } from '@/app/api/terminal-news/route';
import type { CalendarEvent } from '@/app/api/economic-calendar/route';

type Topic = 'all' | 'forex' | 'crypto' | 'commodities' | 'markets';
const TOPICS: { id: Topic; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'forex', label: 'Forex' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'markets', label: 'Markets' },
];

const CCY_FLAG: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳',
};

function topicForSymbol(sym: string | null | undefined): Topic {
  const u = (sym || '').toUpperCase();
  if (/^(BTC|ETH|SOL|XRP|LTC|DOG|ADA|BNB|DOT|LNK|AVAX|MATIC|TRX)/.test(u)) return 'crypto';
  if (/^(XAU|XAG|USOIL|UKOIL|NATGAS|BRENT|WTI)/.test(u)) return 'commodities';
  if (/^(US30|US500|NAS100|UK100|GER40|JPN225|AUS200|EU50|FRA40|SPX|NDX|DJI)/.test(u)) return 'markets';
  return 'forex';
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - Date.parse(iso));
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function NewsCard({ item }: { item: TerminalNewsItem }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-xl p-2 transition-colors hover:bg-bg-hover"
    >
      <div className="relative h-[64px] w-[88px] shrink-0 overflow-hidden rounded-lg" style={{ background: 'var(--bg-card-nested)' }}>
        {item.image && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-tertiary/60">
            <Newspaper size={20} strokeWidth={1.6} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary group-hover:text-accent">{item.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <span className="font-medium text-text-secondary">{item.source}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(item.publishedAt)}</span>
          <ExternalLink size={11} className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-70" aria-hidden />
        </p>
      </div>
    </a>
  );
}

function SkeletonRows({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-1 p-1.5" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex gap-3 p-2">
          <div className="h-[64px] w-[88px] shrink-0 rounded-lg crx-pulse" style={{ background: 'var(--bg-card-nested)' }} />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-11/12 rounded crx-pulse" style={{ background: 'var(--bg-card-nested)' }} />
            <div className="h-3 w-3/4 rounded crx-pulse" style={{ background: 'var(--bg-card-nested)' }} />
            <div className="h-2.5 w-1/3 rounded crx-pulse" style={{ background: 'var(--bg-card-nested)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const IMPACT_STYLE: Record<CalendarEvent['impact'], { dot: string; label: string }> = {
  High: { dot: 'bg-[#E5484D]', label: 'High' },
  Medium: { dot: 'bg-accent', label: 'Med' },
  Low: { dot: 'bg-amber-300', label: 'Low' },
  Holiday: { dot: 'bg-text-tertiary', label: 'Hol' },
};

function CalendarList({ events, loading }: { events: CalendarEvent[]; loading: boolean }) {
  const [impact, setImpact] = useState<'all' | 'high' | 'medium'>('medium');
  const filtered = useMemo(() => {
    const list = events.filter((e) =>
      impact === 'all' ? true : impact === 'high' ? e.impact === 'High' : e.impact === 'High' || e.impact === 'Medium',
    );
    return [...list].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  }, [events, impact]);

  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const key = new Date(e.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const now = Date.now();
  const todayKey = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const todayRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || groups.length === 0) return;
    if (todayRef.current) { todayRef.current.scrollIntoView({ block: 'start' }); scrolledRef.current = true; }
  }, [groups]);

  return (
    <>
      <div className="shrink-0 flex items-center gap-1.5 px-3 pb-2">
        {([['medium', 'Med + High'], ['high', 'High only'], ['all', 'All']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setImpact(id)}
            className={clsx(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              impact === id ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border-primary text-text-tertiary hover:text-text-primary',
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-text-tertiary">Forex Factory · local time</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1.5 pb-3">
        {loading && events.length === 0 ? (
          <SkeletonRows n={7} />
        ) : groups.length === 0 ? (
          <p className="px-3 py-10 text-center text-[12px] text-text-tertiary">No events for this filter.</p>
        ) : (
          groups.map(([day, list]) => (
            <div key={day} className="mb-2" ref={day === todayKey ? todayRef : undefined}>
              <div className={clsx('sticky top-0 z-10 flex items-center gap-2 px-1.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] bg-bg-base', day === todayKey ? 'text-accent' : 'text-text-tertiary')}>
                {day}{day === todayKey ? ' · Today' : ''}
              </div>
              {list.map((e, i) => {
                const ts = Date.parse(e.date);
                const past = ts < now;
                const style = IMPACT_STYLE[e.impact];
                return (
                  <div key={`${e.title}-${i}`} className={clsx('grid grid-cols-[44px_26px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-bg-hover', past && 'opacity-60')}>
                    <span className="text-[11px] tabular-nums text-text-secondary">
                      {Number.isFinite(ts) ? new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                    </span>
                    <span className="text-[14px] leading-none" title={e.country} aria-label={e.country}>{CCY_FLAG[e.country] ?? e.country}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} title={`${style.label} impact`} aria-hidden />
                        <span className="truncate text-[12px] font-medium text-text-primary">{e.title}</span>
                      </span>
                      <span className="block text-[10px] text-text-tertiary">{e.country} · {style.label} impact</span>
                    </span>
                    <span className="grid grid-cols-3 gap-x-2 text-right text-[10px] tabular-nums">
                      {[['A', e.actual ?? ''], ['F', e.forecast], ['P', e.previous]].map(([k, v]) => (
                        <span key={k} className="flex flex-col items-end">
                          <span className="text-text-tertiary">{k}</span>
                          <span className={clsx('font-semibold', v ? 'text-text-primary' : 'text-text-tertiary')}>{v || '–'}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function TerminalNewsPanelInner({ className }: { className?: string }) {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const [tab, setTab] = useState<'news' | 'calendar'>('news');
  const [topic, setTopic] = useState<Topic>(() => topicForSymbol(selectedSymbol));
  const [items, setItems] = useState<TerminalNewsItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingCal, setLoadingCal] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = useCallback(async (t: Topic) => {
    setLoadingNews(true);
    try {
      const res = await fetch(`/api/terminal-news?topic=${t}&limit=30`, { cache: 'no-store' });
      const data = (await res.json()) as { items?: TerminalNewsItem[]; error?: string };
      setItems(data.items ?? []);
      setNewsError(data.items && data.items.length > 0 ? null : data.error ?? 'No stories right now');
      setUpdatedAt(Date.now());
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const loadCalendar = useCallback(async () => {
    setLoadingCal(true);
    try {
      const res = await fetch('/api/economic-calendar', { cache: 'no-store' });
      const data = (await res.json()) as { events?: CalendarEvent[] };
      setEvents(data.events ?? []);
    } catch {
      /* keep whatever we had */
    } finally {
      setLoadingCal(false);
    }
  }, []);

  useEffect(() => { void loadNews(topic); }, [topic, loadNews]);
  useEffect(() => { void loadCalendar(); }, [loadCalendar]);
  useEffect(() => {
    const id = setInterval(() => { void loadNews(topic); void loadCalendar(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [topic, loadNews, loadCalendar]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadNews(topic), loadCalendar()]);
    setRefreshing(false);
  };

  return (
    <div className={clsx('flex h-full min-h-0 w-full flex-col bg-bg-base', className)}>
      {/* Tabs: News | Calendar — same orange-underline language as the Markets rail */}
      <div className="shrink-0 flex items-center gap-5 px-3 pt-1">
        {([['news', 'News', Newspaper], ['calendar', 'Calendar', CalendarDays]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              'relative flex items-center gap-1.5 pb-2 pt-1.5 text-[14px] transition-colors',
              tab === id ? 'font-bold text-text-primary' : 'font-medium text-text-tertiary hover:text-text-secondary',
            )}
          >
            <Icon size={15} strokeWidth={2} />
            {label}
            <span className={clsx('absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-accent transition-opacity', tab === id ? 'opacity-100' : 'opacity-0')} aria-hidden />
          </button>
        ))}
        <button
          type="button"
          onClick={() => { void refresh(); }}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          aria-label="Refresh"
          title={updatedAt ? `Updated ${timeAgo(new Date(updatedAt).toISOString())}` : 'Refresh'}
        >
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin')} />
        </button>
      </div>

      {tab === 'news' ? (
        <>
          <div className="shrink-0 flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopic(t.id)}
                className={clsx(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  topic === t.id ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border-primary text-text-tertiary hover:text-text-primary',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1.5 pb-3">
            {loadingNews && items.length === 0 ? (
              <SkeletonRows />
            ) : items.length === 0 ? (
              <div className="px-3 py-12 text-center">
                <Newspaper size={22} className="mx-auto text-text-tertiary/60" />
                <p className="mt-2 text-[12px] text-text-tertiary">{newsError ?? 'No stories right now'}</p>
                <button type="button" onClick={() => { void refresh(); }} className="mt-3 rounded-full border border-border-primary px-3 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary">Try again</button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {items.map((it) => <NewsCard key={it.id} item={it} />)}
              </div>
            )}
          </div>
        </>
      ) : (
        <CalendarList events={events} loading={loadingCal} />
      )}
    </div>
  );
}

export default memo(TerminalNewsPanelInner);

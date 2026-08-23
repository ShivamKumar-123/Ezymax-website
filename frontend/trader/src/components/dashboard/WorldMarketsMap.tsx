'use client';

/**
 * WorldMarketsMap — dot-matrix world map with the major financial centres
 * marked. Each marker is LIVE: it knows whether that exchange is open right
 * now (local session hours), pulses while open, and tapping it loads the
 * TradingView news timeline for that market's benchmark index.
 *
 * Theme-aware: dots use the foreground token at low opacity (grey on cream,
 * soft white on Vantablack); markers are brand orange; the news iframe
 * follows the warm theme's light/dark toggle.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Clock, ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { useWarmTheme } from '@/stores/warmThemeStore';
import { DOT_COLS, DOT_ROWS, LAT_BOTTOM, LAT_TOP, WORLD_DOT_ROWS } from './worldDots';

interface Market {
  id: string;
  city: string;
  exchange: string;
  lat: number;
  lon: number;
  /** TradingView symbol whose news feed represents this market. */
  tv: string;
  tz: string;
  /** Local session hours, 24h "HH:MM". */
  open: string;
  close: string;
  /** News search query for this market (Google News via /api/market-news). */
  news: string;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

const MARKETS: readonly Market[] = [
  { id: 'nyc', city: 'New York', exchange: 'NYSE · Nasdaq', lat: 40.71, lon: -74.0, tv: 'NASDAQ:NDX', tz: 'America/New_York', open: '09:30', close: '16:00', news: 'Wall Street stocks Nasdaq S&P 500' },
  { id: 'chi', city: 'Chicago', exchange: 'CME', lat: 41.88, lon: -87.63, tv: 'CME_MINI:ES1!', tz: 'America/Chicago', open: '08:30', close: '15:00', news: 'CME futures S&P 500 E-mini' },
  { id: 'tor', city: 'Toronto', exchange: 'TSX', lat: 43.65, lon: -79.38, tv: 'TSX:TSX', tz: 'America/Toronto', open: '09:30', close: '16:00', news: 'TSX Toronto stocks' },
  { id: 'sao', city: 'São Paulo', exchange: 'B3', lat: -23.55, lon: -46.63, tv: 'BMFBOVESPA:IBOV', tz: 'America/Sao_Paulo', open: '10:00', close: '17:00', news: 'Ibovespa B3 Brazil stocks' },
  { id: 'lon', city: 'London', exchange: 'LSE', lat: 51.5, lon: -0.12, tv: 'TVC:UKX', tz: 'Europe/London', open: '08:00', close: '16:30', news: 'FTSE 100 London stocks' },
  { id: 'par', city: 'Paris', exchange: 'Euronext', lat: 48.85, lon: 2.35, tv: 'EURONEXT:PX1', tz: 'Europe/Paris', open: '09:00', close: '17:30', news: 'CAC 40 Paris stocks' },
  { id: 'fra', city: 'Frankfurt', exchange: 'Xetra', lat: 50.11, lon: 8.68, tv: 'XETR:DAX', tz: 'Europe/Berlin', open: '09:00', close: '17:30', news: 'DAX Frankfurt stocks' },
  { id: 'zrh', city: 'Zurich', exchange: 'SIX', lat: 47.37, lon: 8.54, tv: 'SIX:SMI', tz: 'Europe/Zurich', open: '09:00', close: '17:30', news: 'SMI Swiss stocks Zurich' },
  { id: 'mad', city: 'Madrid', exchange: 'BME', lat: 40.42, lon: -3.7, tv: 'BME:IBC', tz: 'Europe/Madrid', open: '09:00', close: '17:30', news: 'IBEX 35 Madrid stocks' },
  { id: 'jnb', city: 'Johannesburg', exchange: 'JSE', lat: -26.2, lon: 28.04, tv: 'JSE:J203', tz: 'Africa/Johannesburg', open: '09:00', close: '17:00', news: 'JSE Johannesburg stocks' },
  { id: 'dxb', city: 'Dubai', exchange: 'DFM', lat: 25.2, lon: 55.27, tv: 'DFM:DFMGI', tz: 'Asia/Dubai', open: '10:00', close: '14:00', news: 'Dubai DFM stocks' },
  { id: 'bom', city: 'Mumbai', exchange: 'NSE', lat: 19.08, lon: 72.88, tv: 'NSE:NIFTY', tz: 'Asia/Kolkata', open: '09:15', close: '15:30', news: 'Nifty Sensex India stocks' },
  { id: 'sin', city: 'Singapore', exchange: 'SGX', lat: 1.35, lon: 103.82, tv: 'TVC:STI', tz: 'Asia/Singapore', open: '09:00', close: '17:00', news: 'Straits Times Index Singapore stocks' },
  { id: 'hkg', city: 'Hong Kong', exchange: 'HKEX', lat: 22.32, lon: 114.17, tv: 'HSI:HSI', tz: 'Asia/Hong_Kong', open: '09:30', close: '16:00', news: 'Hang Seng Hong Kong stocks' },
  { id: 'sha', city: 'Shanghai', exchange: 'SSE', lat: 31.23, lon: 121.47, tv: 'SSE:000001', tz: 'Asia/Shanghai', open: '09:30', close: '15:00', news: 'Shanghai Composite China stocks' },
  { id: 'sel', city: 'Seoul', exchange: 'KRX', lat: 37.57, lon: 126.98, tv: 'KRX:KOSPI', tz: 'Asia/Seoul', open: '09:00', close: '15:30', news: 'KOSPI Seoul stocks' },
  { id: 'tyo', city: 'Tokyo', exchange: 'JPX', lat: 35.68, lon: 139.69, tv: 'TVC:NI225', tz: 'Asia/Tokyo', open: '09:00', close: '15:30', news: 'Nikkei Tokyo stocks' },
  { id: 'syd', city: 'Sydney', exchange: 'ASX', lat: -33.87, lon: 151.21, tv: 'ASX:XJO', tz: 'Australia/Sydney', open: '10:00', close: '16:00', news: 'ASX 200 Australia stocks' },
];

/* SVG coordinate space: 10 units per grid cell. */
const CELL = 10;
const VB_W = DOT_COLS * CELL;
const VB_H = DOT_ROWS * CELL;
const DOT_R = 2.7;

const project = (lat: number, lon: number) => ({
  x: ((lon + 180) / 360) * VB_W,
  y: ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * VB_H,
});

/** Local wall-clock for a market: weekday index (0=Sun) + minutes since midnight. */
function localNow(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hh = Number(get('hour')) % 24;
  const mm = Number(get('minute'));
  return { weekday: wd, minutes: hh * 60 + mm, label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function isOpen(m: Market, now: Date) {
  const { weekday, minutes } = localNow(m.tz, now);
  if (weekday === 0 || weekday === 6) return false;
  return minutes >= toMin(m.open) && minutes < toMin(m.close);
}

function timeAgo(iso: string, now: Date) {
  const diff = Math.max(0, now.getTime() - Date.parse(iso));
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

export default function WorldMarketsMap() {
  const dark = useWarmTheme((s) => s.dark);
  const [selectedId, setSelectedId] = useState<string>('nyc');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Clock ticks once a minute so open/closed status stays live.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Live news for the selected market (native list, no iframe) ──
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshNews = useCallback(() => setRefreshKey((k) => k + 1), []);

  // All land dots as ONE path (thousands of tiny circles as arcs) — far
  // cheaper for the browser than thousands of <circle> elements.
  const dotsPath = useMemo(() => {
    const parts: string[] = [];
    const r = DOT_R;
    for (let row = 0; row < DOT_ROWS; row++) {
      const line = WORLD_DOT_ROWS[row] ?? '';
      for (let col = 0; col < DOT_COLS; col++) {
        if (line[col] !== '1') continue;
        const cx = col * CELL + CELL / 2;
        const cy = row * CELL + CELL / 2;
        parts.push(`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`);
      }
    }
    return parts.join('');
  }, []);

  const selected = MARKETS.find((m) => m.id === selectedId) ?? MARKETS[0]!;

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    setNewsError(false);
    fetch(`/api/market-news?q=${encodeURIComponent(selected.news)}&limit=8`)
      .then((r) => r.json())
      .then((d: { items?: NewsItem[]; error?: string }) => {
        if (cancelled) return;
        setNews(d.items ?? []);
        if (d.error) setNewsError(true);
      })
      .catch(() => { if (!cancelled) setNewsError(true); })
      .finally(() => { if (!cancelled) setNewsLoading(false); });
    return () => { cancelled = true; };
  }, [selected.news, refreshKey]);
  const openCount = now ? MARKETS.filter((m) => isOpen(m, now)).length : 0;
  const selectedOpen = now ? isOpen(selected, now) : false;
  const selectedClock = now ? localNow(selected.tz, now).label : '--:--';

  return (
    <div className="rounded-[24px] p-4 md:p-5" style={{ background: 'var(--bg-card)' }}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-bold text-text-primary">Global markets</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Live session status by financial centre — tap a marker for that market&apos;s news.
          </p>
        </div>
        <p className="text-xs text-text-secondary">
          <span className="inline-block h-2 w-2 rounded-full bg-crx-yellow align-middle mr-1.5" aria-hidden />
          <span className="font-semibold text-text-primary tabular-nums">{openCount}</span> of {MARKETS.length} markets open
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ── Map ── */}
        <div className="min-w-0">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-auto w-full"
            role="img"
            aria-label="World map of major financial centres"
          >
            <path d={dotsPath} fill="var(--text-primary)" opacity={dark ? 0.22 : 0.16} />

            {MARKETS.map((m) => {
              const { x, y } = project(m.lat, m.lon);
              const open = now ? isOpen(m, now) : false;
              const active = m.id === selectedId;
              const labelled = active || m.id === hoverId;
              return (
                <g
                  key={m.id}
                  transform={`translate(${x} ${y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(m.id)}
                  onMouseEnter={() => setHoverId(m.id)}
                  onMouseLeave={() => setHoverId(null)}
                  role="button"
                  aria-label={`${m.city} — ${m.exchange}, ${open ? 'open' : 'closed'}`}
                >
                  {/* wide invisible hit area for touch */}
                  <circle r={22} fill="transparent" />
                  {open && <circle r={9} className="crx-pulse" fill="var(--crx-yellow)" />}
                  <circle r={active ? 12 : 10} fill="var(--crx-yellow)" opacity={open ? 0.28 : 0.14} />
                  <circle r={active ? 5.5 : 4.5} fill="var(--crx-yellow)" opacity={open ? 1 : 0.55} />
                  {active && <circle r={14} fill="none" stroke="var(--crx-yellow)" strokeWidth={1.5} opacity={0.8} />}
                  {labelled && (
                    <text
                      y={-20}
                      textAnchor="middle"
                      fontSize={15}
                      fontWeight={600}
                      fill="var(--text-primary)"
                      className="pointer-events-none select-none"
                    >
                      {m.city}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── Selected market: status + live news feed ── */}
        <div className="flex min-w-0 flex-col rounded-2xl p-4" style={{ background: 'var(--bg-card-nested)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">{selected.city}</p>
              <p className="text-xs text-text-secondary">{selected.exchange}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-text-secondary tabular-nums">
                <Clock size={12} strokeWidth={2} /> {selectedClock}
              </span>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                  selectedOpen ? 'bg-crx-yellow text-white' : 'bg-bg-active text-text-secondary',
                )}
              >
                {selectedOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
              <Newspaper size={12} strokeWidth={2} /> Live market news
            </span>
            <button
              type="button"
              onClick={refreshNews}
              aria-label="Refresh news"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <RefreshCw size={13} strokeWidth={2} className={newsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <ul className="mt-2 flex-1 divide-y divide-border-secondary xl:max-h-[440px] xl:overflow-y-auto">
            {newsLoading && news.length === 0 &&
              Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="py-3">
                  <div className="h-3.5 w-11/12 rounded bg-bg-active" />
                  <div className="mt-2 h-3.5 w-2/3 rounded bg-bg-active" />
                  <div className="mt-2 h-2.5 w-1/3 rounded bg-bg-active opacity-70" />
                </li>
              ))}
            {!newsLoading && news.length === 0 && (
              <li className="py-8 text-center text-xs text-text-tertiary">
                {newsError ? 'News is temporarily unavailable.' : 'No recent stories for this market.'}
              </li>
            )}
            {news.map((n) => (
              <li key={n.link}>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 py-3 transition-colors hover:bg-bg-hover -mx-2 px-2 rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-text-primary line-clamp-2">{n.title}</p>
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      <span className="font-medium text-text-secondary">{n.source}</span>
                      <span aria-hidden> · </span>
                      {now ? timeAgo(n.publishedAt, now) : ''}
                    </p>
                  </div>
                  <ExternalLink size={13} strokeWidth={2} className="mt-1 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-text-tertiary">Headlines via Google News · refreshes every 10 min</p>
        </div>
      </div>
    </div>
  );
}

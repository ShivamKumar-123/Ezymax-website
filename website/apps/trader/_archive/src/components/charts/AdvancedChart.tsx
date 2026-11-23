'use client';

import { BrandLogo } from '@/components/BrandLogo';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';

/**
 * AdvancedChart — embed of TradingView's free public Advanced Chart
 * widget. Used both inside the trading terminal and on the standalone
 * /advanced-chart page.
 *
 * Was the licensed Charting Library (broker integration, custom
 * datafeed, position lines on chart). That stack is removed in favour
 * of the free widget because:
 *   • No license fee or build-side files required.
 *   • All 100+ indicators + drawing tools enabled out of the box.
 *   • Symbol search across global markets without extra plumbing.
 *
 * Trade-offs we accept by switching:
 *   • Chart data is TradingView's public feed (OANDA / FX / BINANCE /
 *     TVC), not the broker's bid/ask. Fills can differ from chart
 *     prices by the broker's spread — this is normal for embed widgets
 *     and clearly disclosed in the trading terminal's price chip.
 *   • No order placement / position lines drawn on the chart. Orders
 *     stay in the OrderPanel; positions in the PositionsPanel below.
 *
 * Symbol resolution: we map the trading store's `selectedSymbol` (e.g.
 * "XAUUSD") through SYMBOL_PREFIX to the widget's full prefixed symbol
 * ("OANDA:XAUUSD"). Anything unmapped falls back to "FX:<sym>" which
 * covers FX majors; if that fails the widget shows a friendly error
 * panel inside its own iframe.
 */

interface TVWidgetCtor {
  new (config: Record<string, unknown>): { remove?: () => void };
}

declare global {
  interface Window {
    TradingView?: { widget?: TVWidgetCtor };
  }
}

// Prefer OANDA for commodities/indices, Binance for crypto, FX: for
// majors. Anything not in this map falls through to FX:.
const SYMBOL_PREFIX: Record<string, string> = {
  // Commodities + spot metals
  XAUUSD: 'OANDA:XAUUSD', XAGUSD: 'OANDA:XAGUSD',
  USOIL: 'TVC:USOIL', UKOIL: 'TVC:UKOIL', NGAS: 'TVC:NATGAS', NATGAS: 'TVC:NATGAS',
  // Indices
  SPX500: 'TVC:SPX', SPX: 'TVC:SPX', US500: 'TVC:SPX',
  NAS100: 'TVC:NDX', NDX: 'TVC:NDX', US100: 'TVC:NDX',
  US30: 'TVC:DJI', DJI: 'TVC:DJI',
  GER30: 'TVC:DEU30', GER40: 'TVC:DEU30', DAX: 'TVC:DEU30', DE40: 'TVC:DEU30',
  UK100: 'TVC:UKX', FTSE: 'TVC:UKX',
  NI225: 'TVC:NI225', JPN225: 'TVC:NI225',
  // Crypto — broker uses USD pairs, TV uses USDT spot on Binance.
  BTCUSD: 'BINANCE:BTCUSDT', BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT', ETHUSDT: 'BINANCE:ETHUSDT',
  BNBUSD: 'BINANCE:BNBUSDT', BNBUSDT: 'BINANCE:BNBUSDT',
  SOLUSD: 'BINANCE:SOLUSDT', SOLUSDT: 'BINANCE:SOLUSDT',
  XRPUSD: 'BINANCE:XRPUSDT', XRPUSDT: 'BINANCE:XRPUSDT',
  ADAUSD: 'BINANCE:ADAUSDT', DOGEUSD: 'BINANCE:DOGEUSDT', DOGUSD: 'BINANCE:DOGEUSDT',
  LTCUSD: 'BINANCE:LTCUSDT', BCHUSD: 'BINANCE:BCHUSDT',
  DOTUSD: 'BINANCE:DOTUSDT', LNKUSD: 'BINANCE:LINKUSDT', LINKUSD: 'BINANCE:LINKUSDT',
};

function resolveTvSymbol(sym: string | null | undefined): string {
  const s = (sym || '').toUpperCase();
  if (!s) return 'OANDA:XAUUSD';
  if (s.includes(':')) return s; // already a TV-prefixed symbol
  if (SYMBOL_PREFIX[s]) return SYMBOL_PREFIX[s];
  // Only fall back to the FX: feed for forex-shaped symbols (6 letters, e.g.
  // EURUSD). Applying FX: to an index/crypto-shaped symbol that slipped past
  // the map (e.g. "GER40") yields an invalid TradingView symbol and a blank
  // chart — for those, hand the bare symbol to TradingView's own resolver,
  // which finds a sensible match far more often than "FX:GER40" would.
  if (/^[A-Z]{6}$/.test(s)) return `FX:${s}`;
  return s;
}

// Legacy IANA aliases → canonical names. Some browsers still report
// the pre-rename city ("Asia/Calcutta") and TradingView only honours
// the canonical form ("Asia/Kolkata"), so without this map the clock
// silently falls back to UTC. Confirmed culprit on the user's machine
// 2026-06-01: console returned 'Asia/Calcutta'.
const TZ_ALIAS: Record<string, string> = {
  'Asia/Calcutta':   'Asia/Kolkata',
  'Asia/Saigon':     'Asia/Ho_Chi_Minh',
  'Asia/Katmandu':   'Asia/Kathmandu',
  'Asia/Rangoon':    'Asia/Yangon',
  'Asia/Chongqing':  'Asia/Shanghai',
  'Asia/Harbin':     'Asia/Shanghai',
  'Asia/Macao':      'Asia/Macau',
  'Asia/Dacca':      'Asia/Dhaka',
  'Europe/Kiev':     'Europe/Kyiv',
  'Europe/Nicosia':  'Asia/Nicosia',
  'America/Buenos_Aires':  'America/Argentina/Buenos_Aires',
  'Australia/South':       'Australia/Adelaide',
  'Australia/North':       'Australia/Darwin',
  'Australia/Queensland':  'Australia/Brisbane',
  'Pacific/Ponape':  'Pacific/Pohnpei',
  'Pacific/Truk':    'Pacific/Chuuk',
};

// Full TradingView-style timezone list with UTC-offset labels.
// Mirrors what the full TradingView site shows under right-click →
// "Time zone" so the user lands on a familiar picker. Each entry is
// {value: IANA, label: "(UTC±H[:MM]) City"}. The user's choice
// persists in localStorage so it survives reloads.
const TZ_OPTIONS: { value: string; label: string }[] = [
  { value: '__auto',                  label: 'Auto (your local time)' },
  // Americas — west to east
  { value: 'Pacific/Honolulu',        label: '(UTC-10) Honolulu' },
  { value: 'America/Anchorage',       label: '(UTC-8) Anchorage' },
  { value: 'America/Juneau',          label: '(UTC-8) Juneau' },
  { value: 'America/Los_Angeles',     label: '(UTC-7) Los Angeles' },
  { value: 'America/Phoenix',         label: '(UTC-7) Phoenix' },
  { value: 'America/Vancouver',       label: '(UTC-7) Vancouver' },
  { value: 'America/Denver',          label: '(UTC-6) Denver' },
  { value: 'America/Mexico_City',     label: '(UTC-6) Mexico City' },
  { value: 'America/El_Salvador',     label: '(UTC-6) San Salvador' },
  { value: 'America/Bogota',          label: '(UTC-5) Bogota' },
  { value: 'America/Chicago',         label: '(UTC-5) Chicago' },
  { value: 'America/Lima',            label: '(UTC-5) Lima' },
  { value: 'America/Caracas',         label: '(UTC-4) Caracas' },
  { value: 'America/New_York',        label: '(UTC-4) New York' },
  { value: 'America/Santiago',        label: '(UTC-4) Santiago' },
  { value: 'America/Toronto',         label: '(UTC-4) Toronto' },
  { value: 'America/Argentina/Buenos_Aires', label: '(UTC-3) Buenos Aires' },
  { value: 'America/Sao_Paulo',       label: '(UTC-3) São Paulo' },
  // UTC anchor
  { value: 'Etc/UTC',                 label: 'UTC' },
  // Europe / Africa
  { value: 'Atlantic/Reykjavik',      label: '(UTC+0) Reykjavik' },
  { value: 'Europe/London',           label: '(UTC+1) London' },
  { value: 'Europe/Dublin',           label: '(UTC+1) Dublin' },
  { value: 'Europe/Lisbon',           label: '(UTC+1) Lisbon' },
  { value: 'Africa/Cairo',            label: '(UTC+2) Cairo' },
  { value: 'Africa/Johannesburg',     label: '(UTC+2) Johannesburg' },
  { value: 'Africa/Lagos',            label: '(UTC+1) Lagos' },
  { value: 'Europe/Amsterdam',        label: '(UTC+2) Amsterdam' },
  { value: 'Europe/Berlin',           label: '(UTC+2) Berlin' },
  { value: 'Europe/Brussels',         label: '(UTC+2) Brussels' },
  { value: 'Europe/Frankfurt',        label: '(UTC+2) Frankfurt' },
  { value: 'Europe/Madrid',           label: '(UTC+2) Madrid' },
  { value: 'Europe/Paris',            label: '(UTC+2) Paris' },
  { value: 'Europe/Rome',             label: '(UTC+2) Rome' },
  { value: 'Europe/Stockholm',        label: '(UTC+2) Stockholm' },
  { value: 'Europe/Warsaw',           label: '(UTC+2) Warsaw' },
  { value: 'Europe/Zurich',           label: '(UTC+2) Zurich' },
  { value: 'Europe/Athens',           label: '(UTC+3) Athens' },
  { value: 'Europe/Helsinki',         label: '(UTC+3) Helsinki' },
  { value: 'Europe/Istanbul',         label: '(UTC+3) Istanbul' },
  { value: 'Europe/Kyiv',             label: '(UTC+3) Kyiv' },
  { value: 'Europe/Moscow',           label: '(UTC+3) Moscow' },
  // Middle East / South Asia
  { value: 'Asia/Bahrain',            label: '(UTC+3) Bahrain' },
  { value: 'Asia/Qatar',              label: '(UTC+3) Doha' },
  { value: 'Asia/Kuwait',             label: '(UTC+3) Kuwait' },
  { value: 'Asia/Riyadh',             label: '(UTC+3) Riyadh' },
  { value: 'Asia/Tehran',             label: '(UTC+3:30) Tehran' },
  { value: 'Asia/Dubai',              label: '(UTC+4) Dubai' },
  { value: 'Asia/Muscat',             label: '(UTC+4) Muscat' },
  { value: 'Asia/Yerevan',            label: '(UTC+4) Yerevan' },
  { value: 'Asia/Kabul',              label: '(UTC+4:30) Kabul' },
  { value: 'Asia/Karachi',            label: '(UTC+5) Karachi' },
  { value: 'Asia/Tashkent',           label: '(UTC+5) Tashkent' },
  { value: 'Asia/Kolkata',            label: '(UTC+5:30) Mumbai / Delhi' },
  { value: 'Asia/Colombo',            label: '(UTC+5:30) Colombo' },
  { value: 'Asia/Kathmandu',          label: '(UTC+5:45) Kathmandu' },
  { value: 'Asia/Almaty',             label: '(UTC+6) Almaty' },
  { value: 'Asia/Dhaka',              label: '(UTC+6) Dhaka' },
  { value: 'Asia/Yangon',             label: '(UTC+6:30) Yangon' },
  // East Asia / SE Asia / Oceania
  { value: 'Asia/Bangkok',            label: '(UTC+7) Bangkok' },
  { value: 'Asia/Jakarta',            label: '(UTC+7) Jakarta' },
  { value: 'Asia/Ho_Chi_Minh',        label: '(UTC+7) Ho Chi Minh' },
  { value: 'Asia/Hong_Kong',          label: '(UTC+8) Hong Kong' },
  { value: 'Asia/Kuala_Lumpur',       label: '(UTC+8) Kuala Lumpur' },
  { value: 'Asia/Manila',             label: '(UTC+8) Manila' },
  { value: 'Asia/Shanghai',           label: '(UTC+8) Shanghai' },
  { value: 'Asia/Singapore',          label: '(UTC+8) Singapore' },
  { value: 'Asia/Taipei',             label: '(UTC+8) Taipei' },
  { value: 'Australia/Perth',         label: '(UTC+8) Perth' },
  { value: 'Asia/Seoul',              label: '(UTC+9) Seoul' },
  { value: 'Asia/Tokyo',              label: '(UTC+9) Tokyo' },
  { value: 'Australia/Adelaide',      label: '(UTC+9:30) Adelaide' },
  { value: 'Australia/Darwin',        label: '(UTC+9:30) Darwin' },
  { value: 'Australia/Brisbane',      label: '(UTC+10) Brisbane' },
  { value: 'Australia/Sydney',        label: '(UTC+10) Sydney' },
  { value: 'Pacific/Auckland',        label: '(UTC+12) Auckland' },
];
const TZ_STORAGE_KEY = 'trader.chart.tz';

export default function AdvancedChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);

  const tvSymbol = useMemo(() => resolveTvSymbol(selectedSymbol), [selectedSymbol]);
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';

  // User-picked timezone — '__auto' means follow Intl.DateTimeFormat
  // resolution; any other value is a fixed IANA name. Persists in
  // localStorage so the choice survives reloads.
  const [userTz, setUserTz] = useState<string>('__auto');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(TZ_STORAGE_KEY);
      if (stored) setUserTz(stored);
    } catch { /* private mode — keep default */ }
  }, []);
  const persistTz = (value: string) => {
    setUserTz(value);
    setTzMenuOpen(false);
    try { window.localStorage.setItem(TZ_STORAGE_KEY, value); } catch { /* ignore */ }
  };
  const [tzMenuOpen, setTzMenuOpen] = useState(false);

  // Fullscreen toggle — the embed widget has no fullscreen button of
  // its own, so we drive the browser Fullscreen API on our wrapper.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen().catch(() => {});
    }
  };

  // Re-mount the widget when the resolved symbol or theme changes.
  // The embed script reads its config from the <script> tag content
  // and renders into a sibling div, so the cleanest re-render path
  // is to wipe + re-inject. Same approach used on /advanced-chart.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    inner.style.width = '100%';
    container.appendChild(inner);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    // Use the viewer's own timezone so the chart clock matches their
    // wall-clock instead of always showing UTC (the embed widget locks
    // the clock to whatever `timezone` we pass).
    //
    // Fallback chain:
    //   1. Browser's resolved IANA zone, normalized through TZ_ALIAS
    //      so legacy names (Asia/Calcutta, Asia/Saigon, ...) map to
    //      the canonical TradingView expects (Asia/Kolkata, ...).
    //      Client report 2026-06-01: browser returned 'Asia/Calcutta',
    //      widget didn't recognise it, clock stuck on UTC.
    //   2. Asia/Kolkata fallback when the browser hands us a literal
    //      'UTC' / 'Etc/UTC' / 'Etc/GMT'.
    //   3. Etc/UTC as a last resort if anything throws.
    let viewerTz = 'Asia/Kolkata';
    if (userTz && userTz !== '__auto') {
      // User explicitly picked a timezone from the chart picker —
      // honour that over the browser's resolved zone.
      viewerTz = userTz;
    } else {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== 'UTC' && tz !== 'Etc/UTC' && tz !== 'Etc/GMT') {
          viewerTz = TZ_ALIAS[tz] || tz;
        }
      } catch { /* keep IST default */ }
    }

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '5',
      timezone: viewerTz,
      theme: tvTheme,
      style: '1',                 // candles
      locale: 'en',
      enable_publishing: false,
      // Symbol change LOCKED inside the chart — the widget is a sealed
      // iframe, so a switch made from its own search box never reaches
      // our trading store; the order panel keeps the OLD selection and
      // the next BUY/SELL goes to the wrong instrument. Client report
      // 2026-06-01: "trade me kuch bhi buy/sell kar raha hu, order
      // gold pe hi lag raha hai" while the chart was on BTCUSD. The
      // order panel's MARKETS button is now the only symbol picker —
      // it updates the store, chart re-renders via tvSymbol prop, and
      // every order goes to the same symbol the user is looking at.
      allow_symbol_change: false,
      hide_side_toolbar: false,   // expose drawing tools
      withdateranges: true,
      hide_volume: false,
      details: false,
      studies: [],
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      try { container.innerHTML = ''; } catch { /* noop */ }
    };
  }, [tvSymbol, tvTheme, userTz]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-[200px] min-w-0 bg-bg-base"
    >
      {/* Brand watermark — Vantage-broker-style faint logo centred on
          the chart canvas. Sits ABOVE the TradingView iframe so it shows
          through the iframe's coloured background, with pointer-events
          disabled on the whole subtree so every drag / hover / drawing
          tool click still reaches the chart underneath.
          Theme-aware swap mirrors the pattern in 979362e: dark raster
          on dark mode, white-bg variant on light mode. Lower opacity
          on dark to keep it subtle on the dark candles; higher on
          light because the light variant is intentionally faint. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center select-none"
      >
        <BrandLogo
          decorative
          className="pointer-events-none w-[40%] max-w-[480px] min-w-[200px] object-contain opacity-[0.10] dark:opacity-[0.07]"
        />
      </div>

      {/* Timezone picker — click to open dropdown of common timezones.
          Selection persists in localStorage and forces the widget to
          rebuild (useEffect deps include userTz). Shows the active
          zone label so the user always knows what timezone the chart
          clock is in. Client report 2026-06-01: "us par click karunga
          to multiple options dikhenge?". */}
      <div className="absolute top-2 right-12 z-20">
        <button
          type="button"
          onClick={() => setTzMenuOpen((v) => !v)}
          title="Change chart timezone"
          className="px-2 py-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white/80 hover:text-white backdrop-blur-sm transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
        >
          <span>🕐</span>
          <span className="hidden sm:inline">
            {userTz === '__auto'
              ? 'Auto'
              : (TZ_OPTIONS.find((o) => o.value === userTz)?.label.split(' — ')[0] || userTz.split('/').pop())}
          </span>
        </button>
        {tzMenuOpen && (
          <>
            {/* Click-away catcher */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setTzMenuOpen(false)}
            />
            <div className="absolute right-0 mt-1 z-20 w-64 max-h-[28rem] overflow-y-auto rounded-md bg-bg-secondary border border-border-primary shadow-xl">
              <div className="sticky top-0 px-3 py-2 bg-bg-secondary border-b border-border-primary text-[10px] uppercase tracking-wider text-text-tertiary font-bold">
                Chart Timezone
              </div>
              {TZ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => persistTz(opt.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover border-b border-border-primary/30 last:border-0 ${
                    userTz === opt.value ? 'text-accent font-semibold bg-accent/5' : 'text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute top-2 right-2 z-20 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white/80 hover:text-white backdrop-blur-sm transition-colors"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-full min-h-[200px] min-w-0"
        data-tv-chart-root
      />
    </div>
  );
}

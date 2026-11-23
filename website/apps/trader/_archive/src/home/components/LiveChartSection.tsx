'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';

/** Initial chart state — first instrument loaded into the live chart on mount. */
const DEFAULT_SYMBOL   = 'EUR/USD';
const DEFAULT_TV       = 'FX:EURUSD';

/* TradingView symbol mapping for every directory item below. */
const INSTRUMENT_MAP: Record<string, string> = {
  // Indices
  'US30':         'OANDA:US30USD',
  'US100':        'OANDA:NAS100USD',
  'US500':        'OANDA:SPX500USD',
  // Commodities
  'Gold':         'OANDA:XAUUSD',
  'Silver':       'OANDA:XAGUSD',
  'Copper':       'OANDA:XCUUSD',
  'Crude Oil':    'OANDA:WTICOUSD',
  'Brent Oil':    'OANDA:BCOUSD',
  'Wheat':        'CBOT:ZW1!',
  'Corn':         'CBOT:ZC1!',
  'Natural Gas':  'BLACKBULL:NGAS',
  'Gasoline':     'NYMEX:RB1!',
  'Heating Oil':  'NYMEX:HO1!',
  // Stocks
  'Tesla':        'NASDAQ:TSLA',
  'AT&T':         'NYSE:T',
  'Google':       'NASDAQ:GOOGL',
  'Netflix':      'NASDAQ:NFLX',
  'Nvidia':       'NASDAQ:NVDA',
  'Amazon':       'NASDAQ:AMZN',
  'Apple':        'NASDAQ:AAPL',
  'Meta':         'NASDAQ:META',
  // Forex — Major
  'AUD/USD':      'FX:AUDUSD',
  'EUR/USD':      'FX:EURUSD',
  'GBP/USD':      'FX:GBPUSD',
  'NZD/USD':      'FX:NZDUSD',
  'USD/CAD':      'FX:USDCAD',
  'USD/CHF':      'FX:USDCHF',
  'USD/JPY':      'FX:USDJPY',
  // Forex — Minor
  'AUD/CAD':      'FX:AUDCAD',
  'AUD/CHF':      'FX:AUDCHF',
  'AUD/JPY':      'FX:AUDJPY',
  'AUD/NZD':      'FX:AUDNZD',
  'CAD/CHF':      'FX:CADCHF',
  'CAD/JPY':      'FX:CADJPY',
  'CHF/JPY':      'FX:CHFJPY',
  'EUR/AUD':      'FX:EURAUD',
  'EUR/CAD':      'FX:EURCAD',
  'EUR/CHF':      'FX:EURCHF',
  'EUR/GBP':      'FX:EURGBP',
  'EUR/JPY':      'FX:EURJPY',
  'EUR/NZD':      'FX:EURNZD',
  'GBP/AUD':      'FX:GBPAUD',
  'GBP/CAD':      'FX:GBPCAD',
  'GBP/CHF':      'FX:GBPCHF',
  'GBP/JPY':      'FX:GBPJPY',
  'GBP/NZD':      'FX:GBPNZD',
  'NZD/CAD':      'FX:NZDCAD',
  'NZD/CHF':      'FX:NZDCHF',
  'NZD/JPY':      'FX:NZDJPY',
};

interface Column {
  heading: string;
  viewAllHref: string;
  items: string[];
}

const COLUMNS: Column[] = [
  {
    heading: 'Forex Major',
    viewAllHref: '/trading/forex',
    items: ['AUD/USD', 'EUR/USD', 'GBP/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF', 'USD/JPY'],
  },
  {
    heading: 'Forex Minor',
    viewAllHref: '/trading/forex',
    items: [
      'AUD/CAD', 'AUD/CHF', 'AUD/JPY', 'AUD/NZD', 'CAD/CHF', 'CAD/JPY', 'CHF/JPY',
      'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/GBP', 'EUR/JPY', 'EUR/NZD',
      'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'GBP/JPY', 'GBP/NZD',
      'NZD/CAD', 'NZD/CHF', 'NZD/JPY',
    ],
  },
  {
    heading: 'Indices',
    viewAllHref: '/trading/indices',
    items: ['US30', 'US100', 'US500'],
  },
  {
    heading: 'Commodities',
    viewAllHref: '/trading/commodities',
    items: ['Gold', 'Silver', 'Copper', 'Crude Oil', 'Brent Oil', 'Wheat', 'Corn', 'Natural Gas', 'Gasoline', 'Heating Oil'],
  },
  {
    heading: 'Stocks',
    viewAllHref: '/markets',
    items: ['Tesla', 'AT&T', 'Google', 'Netflix', 'Nvidia', 'Amazon', 'Apple', 'Meta'],
  },
];

export function LiveChartSection() {
  // Active chart state — populated by clicking an item in the instrument directory.
  const [activeSymbol, setActiveSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [activeTv,     setActiveTv]     = useState<string>(DEFAULT_TV);
  const chartRef = useRef<HTMLDivElement>(null);

  const selectInstrument = (label: string) => {
    const tv = INSTRUMENT_MAP[label];
    if (!tv) return;
    setActiveSymbol(label);
    setActiveTv(tv);
    // Smooth-scroll to the chart card after a short delay so the user sees the update.
    requestAnimationFrame(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <section className="relative py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-[1200px] px-[var(--gutter)] text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
          <span className="size-1.5 rounded-full bg-primary" />
          Real-Time Data
        </div>
        <h2 className="mt-5 font-display uppercase text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[0.95] text-foreground">
          Markets at Your Fingertips
        </h2>
        <p className="mt-5 text-foreground/65 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
          Pick any instrument below — the live chart updates instantly. Professional-grade charts. Zero delay. Always on.
        </p>

        {/* Instrument directory (now ABOVE the chart) */}
        <InstrumentDirectory
          activeLabel={activeSymbol}
          onSelect={selectInstrument}
        />

        {/* Live chart card */}
        <div ref={chartRef} className="mt-10 scroll-mt-32">
          <Link
            href="/trading/terminal"
            className="block rounded-3xl p-4 sm:p-8 text-left group transition-transform hover:scale-[1.005]"
            aria-label={`Open ${activeSymbol} on the trading terminal`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl sm:text-3xl text-foreground">{activeSymbol}</span>
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/25 text-primary font-body">
                  <span className="relative inline-flex items-center justify-center">
                    <span className="absolute size-1.5 rounded-full bg-primary opacity-75 animate-ping" />
                    <span className="relative size-1.5 rounded-full bg-primary" />
                  </span>
                  LIVE
                </span>
              </div>
            </div>

            <div className="aspect-[16/8] sm:aspect-[16/7] rounded-2xl overflow-hidden">
              <TradingViewChart symbol={activeTv} />
            </div>

            <div className="mt-4 flex items-center justify-end text-xs text-foreground/55 group-hover:text-primary transition-colors">
              Open in Terminal <ArrowUpRight className="ml-1 size-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Instrument directory — 5 columns of clickable symbols.
   ───────────────────────────────────────────────────────────────────── */

function InstrumentDirectory({
  activeLabel,
  onSelect,
}: {
  activeLabel: string;
  onSelect: (label: string) => void;
}) {
  // Track which category dropdown is open. -1 means all collapsed.
  const [openIdx, setOpenIdx] = useState<number>(-1);
  const closeTimer = useRef<number | null>(null);

  /** Cancel any pending close (called when re-entering the dropdown area). */
  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  /** Schedule a close — small delay so the user can move from the button to
   *  the floating panel without it disappearing. */
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenIdx(-1), 180);
  };

  return (
    <div className="mt-12 sm:mt-16 text-left">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display uppercase text-base sm:text-lg tracking-[0.18em] text-foreground/55">
          Browse Instruments
        </h3>
        <span className="hidden sm:inline-flex items-center text-[11px] uppercase tracking-[0.16em] text-foreground/40 gap-1">
          Hover or tap to expand
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 items-start">
        {COLUMNS.map((col, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={col.heading}
              className="flex flex-col"
              /* Pointer-aware hover: mouse only. Touch devices skip these
                 so the click handler isn't fighting a phantom hover that
                 mobile browsers emulate on tap (which caused the dropdown
                 to open then instantly close). */
              onPointerEnter={(e) => {
                if (e.pointerType !== 'mouse') return;
                cancelClose();
                setOpenIdx(i);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== 'mouse') return;
                scheduleClose();
              }}
            >
              {/* Category trigger */}
              <button
                type="button"
                onClick={(e) => {
                  const next = openIdx === i ? -1 : i;
                  setOpenIdx(next);
                  // On mobile, scroll the newly-opened panel into view so the
                  // user doesn't have to hunt for it after tapping.
                  if (next !== -1) {
                    const btn = e.currentTarget;
                    requestAnimationFrame(() => {
                      btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }
                }}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={`Show ${col.heading} instruments`}
                /* Chrome/Edge form-helper extensions inject `fdprocessedid`
                   onto these buttons after first paint, which triggers a
                   React hydration-mismatch warning. The button is
                   functionally unaffected — suppress the warning. */
                suppressHydrationWarning
                className={`w-full liquid-glass rounded-2xl px-4 py-4 flex items-center justify-between gap-2 transition-colors ${
                  isOpen ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-foreground/[0.05]'
                }`}
              >
                <span
                  className="font-display uppercase text-sm sm:text-base tracking-tight"
                  style={{ color: 'var(--mk-text)' }}
                >
                  {col.heading}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: isOpen ? 'var(--mk-accent)' : 'var(--mk-text-muted)' }}
                  aria-hidden
                />
              </button>

              {/* Inline dropdown — appears directly below the button in the
                  normal document flow. Pushes the chart down rather than
                  overlaying it. Per client request: items render right
                  underneath the category card, no floating panel. */}
              {isOpen && (
                <div
                  className="mt-2 liquid-glass-strong rounded-2xl p-3 [backdrop-filter:blur(28px)]"
                  style={{ border: '1px solid var(--mk-line)', background: '#ffffff', boxShadow: '0 18px 44px rgba(11,11,12,0.14)' }}
                  role="menu"
                >
                  <ul className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
                    {col.items.map((item) => {
                      const isActive = activeLabel === item;
                      return (
                        <li key={item} role="none">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSelect(item);
                              setOpenIdx(-1);
                            }}
                            className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-[hsl(var(--muted))] font-semibold'
                                : 'hover:bg-[hsl(var(--muted))]'
                            }`}
                            style={{ color: isActive ? 'var(--mk-accent)' : 'var(--mk-text)' }}
                            aria-pressed={isActive}
                            aria-label={`Load ${item} live chart`}
                          >
                            {item}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

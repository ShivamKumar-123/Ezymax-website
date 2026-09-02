'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTradingStore, InstrumentInfo } from '@/stores/tradingStore';
import { tradingTerminalUrl } from '@/lib/tradingNav';
import { clsx } from 'clsx';
import MobileOrderSheet from '@/components/trading/MobileOrderSheet';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';
import api from '@/lib/api/client';
import { ArrowUpDown, ChevronRight, Search, Settings, Star, TrendingUp } from 'lucide-react';
import AnimatedPrice from '@/components/ui/AnimatedPrice';

type Trend = 'up' | 'down' | 'neutral';

const TERMINAL_GROUPS = ['FOREX', 'CRYPTO', 'INDICES', 'METALS', 'COMMODITIES', 'STOCKS'] as const;
type TerminalGroup = (typeof TERMINAL_GROUPS)[number];


function terminalGroup(symbol: string, instruments: InstrumentInfo[]): TerminalGroup {
  const u = symbol.toUpperCase();
  if (u === 'XAUUSD' || u === 'XAGUSD') return 'METALS';
  if (u === 'USOIL') return 'COMMODITIES';
  const m = SYMBOL_META[symbol];
  const inst = instruments.find((i) => i.symbol === symbol);
  const seg = String(inst?.segment || m?.segment || '').toLowerCase();
  if (seg.includes('crypto')) return 'CRYPTO';
  if (seg.includes('indices') || seg.includes('index')) return 'INDICES';
  if (seg.includes('commodit')) return 'COMMODITIES';
  if (seg.includes('metal')) return 'METALS';
  if (seg.includes('stock') || seg.includes('equit')) return 'STOCKS';
  if (seg.includes('forex') || seg.includes('fx')) return 'FOREX';
  // Fallback: check SYMBOL_META
  if (m?.segment === 'Crypto') return 'CRYPTO';
  if (m?.segment === 'Indices') return 'INDICES';
  if (m?.segment === 'Commodities') return 'COMMODITIES';
  return 'FOREX';
}


/** True if `query` appears in symbol, backend display_name, or SYMBOL_META.display.
    Lets users find XAUUSD/XAGUSD by typing 'gold'/'silver' etc. */
function matchesSearch(
  symbol: string,
  query: string,
  instruments: InstrumentInfo[],
  meta: Record<string, { display: string; segment: string }>,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (symbol.toLowerCase().includes(q)) return true;
  const inst = instruments.find((i) => i.symbol === symbol);
  if (inst?.display_name && inst.display_name.toLowerCase().includes(q)) return true;
  const m = meta[symbol];
  if (m?.display && m.display.toLowerCase().includes(q)) return true;
  return false;
}

const SYMBOL_META: Record<string, { display: string; segment: string }> = {
  EURUSD: { display: 'EUR/USD', segment: 'Forex' },
  GBPUSD: { display: 'GBP/USD', segment: 'Forex' },
  USDJPY: { display: 'USD/JPY', segment: 'Forex' },
  AUDUSD: { display: 'AUD/USD', segment: 'Forex' },
  USDCAD: { display: 'USD/CAD', segment: 'Forex' },
  USDCHF: { display: 'USD/CHF', segment: 'Forex' },
  NZDUSD: { display: 'NZD/USD', segment: 'Forex' },
  EURGBP: { display: 'EUR/GBP', segment: 'Forex' },
  EURJPY: { display: 'EUR/JPY', segment: 'Forex' },
  GBPJPY: { display: 'GBP/JPY', segment: 'Forex' },
  EURCHF: { display: 'EUR/CHF', segment: 'Forex' },
  GBPCHF: { display: 'GBP/CHF', segment: 'Forex' },
  AUDJPY: { display: 'AUD/JPY', segment: 'Forex' },
  AUDNZD: { display: 'AUD/NZD', segment: 'Forex' },
  AUDCAD: { display: 'AUD/CAD', segment: 'Forex' },
  AUDCHF: { display: 'AUD/CHF', segment: 'Forex' },
  CADJPY: { display: 'CAD/JPY', segment: 'Forex' },
  NZDJPY: { display: 'NZD/JPY', segment: 'Forex' },
  USDHKD: { display: 'USD/HKD', segment: 'Forex' },
  XAUUSD: { display: 'Gold', segment: 'Commodities' },
  XAGUSD: { display: 'Silver', segment: 'Commodities' },
  USOIL: { display: 'Crude Oil', segment: 'Commodities' },
  US30: { display: 'Dow Jones', segment: 'Indices' },
  NAS100: { display: 'NASDAQ', segment: 'Indices' },
  US500: { display: 'S&P 500', segment: 'Indices' },
  UK100: { display: 'FTSE 100', segment: 'Indices' },
  GER40: { display: 'DAX 40', segment: 'Indices' },
  BTCUSD: { display: 'Bitcoin', segment: 'Crypto' },
  ETHUSD: { display: 'Ethereum', segment: 'Crypto' },
  LTCUSD: { display: 'Litecoin', segment: 'Crypto' },
  XRPUSD: { display: 'Ripple', segment: 'Crypto' },
  SOLUSD: { display: 'Solana', segment: 'Crypto' },
  DOGUSD: { display: 'Dogecoin', segment: 'Crypto' },
  DOGEUSD: { display: 'Dogecoin', segment: 'Crypto' },
};

function getDigits(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'NZDJPY'].includes(symbol)) return 3;
  if (symbol === 'XRPUSD') return 4;
  if (['XAUUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'LTCUSD', 'SOLUSD', 'DOGUSD', 'DOGEUSD'].includes(symbol))
    return 2;
  if (['US30', 'US500', 'NAS100', 'UK100', 'GER40'].includes(symbol)) return 1;
  return 5;
}

/** Pip size from trading catalog when loaded; else legacy estimate from display digits (imperfect for some symbols). */
function pipSizeForSymbol(symbol: string, instruments: InstrumentInfo[]): number | undefined {
  const p = instruments.find((i) => i.symbol === symbol)?.pip_size;
  if (p != null && p > 0 && Number.isFinite(p)) return p;
  return undefined;
}

/** Spread in pips — matches admin/backend: (ask − bid) / pip_size. */
function spreadInPips(symbol: string, bid: number, ask: number, instruments: InstrumentInfo[]): number {
  const width = ask - bid;
  const pip = pipSizeForSymbol(symbol, instruments);
  if (pip != null) {
    return Math.round(width / pip);
  }
  const digits = getDigits(symbol);
  return Math.round(width * Math.pow(10, digits - 1));
}

type WatchlistProps = {
  /** Desktop terminal: dark rail between chart and order (matches crucial-ui screenshots). */
  variant?: 'default' | 'terminalRail';
  /** Full-screen markets mode: chevron + row pick return to order panel (mutually exclusive UI). */
  onExitMarkets?: () => void;
};

export default function Watchlist({ variant = 'default', onExitMarkets }: WatchlistProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  // Narrow selectors: still tracks `prices` (this list renders live ticks) but
  // no longer re-renders on positions/accounts/etc. Actions are stable refs.
  const watchlist = useTradingStore((s) => s.watchlist);
  const prices = useTradingStore((s) => s.prices);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const addToWatchlist = useTradingStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useTradingStore((s) => s.removeFromWatchlist);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('Starred');
  const [bidFlash, setBidFlash] = useState<Record<string, Trend>>({});
  const [askFlash, setAskFlash] = useState<Record<string, Trend>>({});
  const [activeOrderSymbol, setActiveOrderSymbol] = useState<string | null>(null);
  /** Terminal rail (Markets panel): category tab, %change sort, display prefs. */
  const [railTab, setRailTab] = useState<'Watchlist' | TerminalGroup>('Watchlist');
  const [sortPct, setSortPct] = useState<'none' | 'desc' | 'asc'>('none');
  const [railSettingsOpen, setRailSettingsOpen] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [showSpread, setShowSpread] = useState(true);
  /** Real day-open per symbol from the 1D bars store — drives the %change column. */
  const [dayOpen, setDayOpen] = useState<Record<string, number>>({});
  const dayOpenRequested = useRef<Set<string>>(new Set());

  const prevTickRef = useRef<Record<string, { bid: number; ask: number }>>({});
  const sessionOpenRef = useRef<Record<string, number>>({});
  const dayLowRef = useRef<Record<string, number>>({});
  const dayHighRef = useRef<Record<string, number>>({});
  const lastTimeRef = useRef<Record<string, string>>({});


  useEffect(() => {
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      if (!(symbol in sessionOpenRef.current)) {
        sessionOpenRef.current[symbol] = tick.bid;
        dayLowRef.current[symbol] = tick.bid;
        dayHighRef.current[symbol] = tick.bid;
      } else {
        /* `symbol in dayLowRef.current` check above guarantees the entry exists. */
        if (tick.bid < dayLowRef.current[symbol]!) dayLowRef.current[symbol] = tick.bid;
        if (tick.bid > dayHighRef.current[symbol]!) dayHighRef.current[symbol] = tick.bid;
      }
      lastTimeRef.current[symbol] = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
  }, [prices, watchlist]);

  useEffect(() => {
    const nextBid: Record<string, Trend> = {};
    const nextAsk: Record<string, Trend> = {};
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      const prev = prevTickRef.current[symbol];
      if (prev) {
        if (tick.bid > prev.bid) nextBid[symbol] = 'up';
        else if (tick.bid < prev.bid) nextBid[symbol] = 'down';
        if (tick.ask > prev.ask) nextAsk[symbol] = 'up';
        else if (tick.ask < prev.ask) nextAsk[symbol] = 'down';
      }
      prevTickRef.current[symbol] = { bid: tick.bid, ask: tick.ask };
    }
    if (Object.keys(nextBid).length === 0 && Object.keys(nextAsk).length === 0) return;
    setBidFlash((p) => ({ ...p, ...nextBid }));
    setAskFlash((p) => ({ ...p, ...nextAsk }));
    const t = setTimeout(() => {
      setBidFlash((p) => {
        const n = { ...p };
        for (const k of Object.keys(nextBid)) delete n[k];
        return n;
      });
      setAskFlash((p) => {
        const n = { ...p };
        for (const k of Object.keys(nextAsk)) delete n[k];
        return n;
      });
    }, 220);
    return () => clearTimeout(t);
  }, [prices, watchlist]);

  /** All instruments that have live prices — watchlist + instruments store, filtered. */
  const priceKeys = Object.keys(prices);
  const priceCount = priceKeys.length;
  const allSymbols = useMemo(() => {
    const syms = new Set(watchlist);
    for (const inst of instruments) {
      syms.add(inst.symbol);
    }
    // Only show symbols that have a live price tick
    return Array.from(syms).filter((s) => prices[s] != null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist, instruments, priceCount]);

  // Fetch the current daily candle's open for every listed symbol (once per
  // symbol, small batches) so %change is a true day move, not session-relative.
  useEffect(() => {
    if (variant !== 'terminalRail') return;
    const pending = allSymbols.filter((sym) => !dayOpenRequested.current.has(sym));
    if (pending.length === 0) return;
    pending.forEach((sym) => dayOpenRequested.current.add(sym));
    let cancelled = false;
    (async () => {
      for (let i = 0; i < pending.length; i += 6) {
        const chunk = pending.slice(i, i + 6);
        const rows = await Promise.all(chunk.map((sym) =>
          api.get<{ bars?: { time: number; open: number }[] } | { time: number; open: number }[]>(`/instruments/${sym}/bars`, { resolution: '1D' })
            .then((res) => {
              const bars = Array.isArray(res) ? res : res?.bars ?? [];
              return [sym, bars.length > 0 ? Number(bars[bars.length - 1]!.open) : NaN] as const;
            })
            .catch(() => [sym, NaN] as const),
        ));
        if (cancelled) return;
        setDayOpen((prev) => {
          const next = { ...prev };
          for (const [sym, open] of rows) if (Number.isFinite(open) && open > 0) next[sym] = open;
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [variant, allSymbols]);


  const handleRowClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (onExitMarkets) {
      onExitMarkets();
      return;
    }
    const acc = urlParams.get('account');
    if (pathname?.startsWith('/trading/terminal') && acc) {
      setActiveOrderSymbol(symbol);
    } else {
      router.push('/trading');
    }
  };

  const rail =
    variant === 'terminalRail'
      ? 'border-0 bg-bg-base'
      : 'border-r border-border-primary bg-bg-primary';

  return (
    <div className={clsx('h-full min-h-0 flex flex-col', rail)}>
      {pathname?.startsWith('/trading/terminal') && activeAccount ? (
        <div className="sm:hidden shrink-0 px-3 pt-2 pb-1 border-b border-border-glass bg-bg-secondary/30">
          <ActiveAccountBadge account={activeAccount} variant="compact" />
        </div>
      ) : null}
      {variant === 'terminalRail' ? (
        <>
          {/* ── Title + settings ── */}
          <div className="shrink-0 flex items-center justify-between px-3 pt-2.5 pb-1">
            <h2 className="text-[17px] font-bold leading-none text-text-primary">Market</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setRailSettingsOpen((o) => !o)}
                className={clsx('flex h-8 w-8 items-center justify-center rounded-full transition-colors', railSettingsOpen ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary')}
                aria-label="Market list settings"
                aria-expanded={railSettingsOpen}
              >
                <Settings size={18} strokeWidth={1.8} />
              </button>
              {railSettingsOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close settings" onClick={() => setRailSettingsOpen(false)} />
                  <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-border-primary bg-bg-secondary p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
                    {([
                      ['Show instrument names', showNames, () => setShowNames((v) => !v)],
                      ['Show spread', showSpread, () => setShowSpread((v) => !v)],
                    ] as const).map(([label, on, toggle]) => (
                      <button key={label} type="button" onClick={toggle} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-text-primary hover:bg-bg-hover">
                        {label}
                        <span className={clsx('relative h-4 w-7 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-border-primary')} aria-hidden>
                          <span className={clsx('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform', on ? 'left-3.5' : 'left-0.5')} />
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Search ── */}
          <div className="shrink-0 px-3 pt-1.5 pb-2">
            <label htmlFor="terminal-instrument-search" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2" style={{ background: 'var(--bg-card-nested)' }}>
              <Search size={16} strokeWidth={2} className="shrink-0 text-text-tertiary" />
              <input
                id="terminal-instrument-search"
                type="text"
                data-terminal-symbol-search
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search instruments"
                className="ticket-input w-full min-w-0 bg-transparent p-0 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none border-0 shadow-none focus:ring-0"
              />
            </label>
          </div>

          {/* ── Category tabs ── */}
          <div className="relative shrink-0 px-3">
            <div className="flex gap-5 overflow-x-auto no-scrollbar scrollbar-none pr-6">
              {(['Watchlist', ...TERMINAL_GROUPS] as const)
                .filter((g) => g === 'Watchlist' || allSymbols.some((sym) => terminalGroup(sym, instruments) === g))
                .map((g) => {
                  const label = g === 'Watchlist' ? 'Watchlist' : g === 'STOCKS' ? 'Shares' : g.charAt(0) + g.slice(1).toLowerCase();
                  const active = railTab === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setRailTab(g)}
                      className={clsx(
                        'relative shrink-0 whitespace-nowrap pb-2 pt-1 text-[14px] transition-colors',
                        active ? 'font-bold text-text-primary' : 'font-medium text-text-tertiary hover:text-text-secondary',
                      )}
                    >
                      {label}
                      <span className={clsx('absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-accent transition-opacity', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    </button>
                  );
                })}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-bg-base via-bg-base/90 to-transparent pr-2 text-text-secondary" aria-hidden>
              <ChevronRight size={18} strokeWidth={2} />
            </div>
          </div>

          {/* ── Column header ── */}
          <div className="shrink-0 grid grid-cols-[minmax(0,1fr)_76px_28px_76px_66px] items-center gap-1.5 px-3 pt-2.5 pb-1.5 text-[12px] text-text-tertiary">
            <span>Symbol</span>
            <span className="text-right">Sell</span>
            <span />
            <span className="text-right">Buy</span>
            <button
              type="button"
              onClick={() => setSortPct((m) => (m === 'none' ? 'desc' : m === 'desc' ? 'asc' : 'none'))}
              className={clsx('flex items-center justify-end gap-0.5 hover:text-text-primary', sortPct !== 'none' && 'text-text-primary')}
              aria-label="Sort by % change"
            >
              %change <ArrowUpDown size={12} className={clsx(sortPct === 'asc' && 'rotate-180')} />
            </button>
          </div>

          {/* ── Rows ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y px-1.5 pb-2">
            {(() => {
              const rows = allSymbols
                .filter((sym) => matchesSearch(sym, search, instruments, SYMBOL_META))
                .filter((sym) => (railTab === 'Watchlist' ? watchlist.includes(sym) : terminalGroup(sym, instruments) === railTab))
                .map((sym) => {
                  const tick = prices[sym];
                  const open = dayOpen[sym] ?? sessionOpenRef.current[sym];
                  const pct = tick && open && open > 0 ? ((tick.bid - open) / open) * 100 : NaN;
                  return { sym, tick, pct };
                });
              if (sortPct !== 'none') {
                rows.sort((a, b) => {
                  const x = Number.isFinite(a.pct) ? a.pct : -Infinity;
                  const y = Number.isFinite(b.pct) ? b.pct : -Infinity;
                  return sortPct === 'desc' ? y - x : x - y;
                });
              }
              if (rows.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <Star size={22} className="text-text-tertiary/60" />
                    <p className="text-[13px] font-medium text-text-tertiary">
                      {railTab === 'Watchlist' ? 'No favourites yet — tap ☆ on any instrument' : 'No instruments found'}
                    </p>
                  </div>
                );
              }
              return rows.map(({ sym, tick, pct }) => {
                const digits = getDigits(sym);
                const sel = sym === selectedSymbol;
                const fav = watchlist.includes(sym);
                const inst = instruments.find((i) => i.symbol === sym);
                const name = SYMBOL_META[sym]?.display ?? (inst?.display_name && inst.display_name !== sym ? inst.display_name : '');
                const bf = bidFlash[sym];
                const af = askFlash[sym];
                const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
                const tint = (f?: Trend) => (f === 'up' ? 'text-buy' : f === 'down' ? 'text-sell' : 'text-text-primary');
                return (
                  <div
                    key={sym}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(sym)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(sym); } }}
                    className={clsx(
                      'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_76px_28px_76px_66px] items-center gap-1.5 rounded-xl px-1.5 py-2 text-left transition-colors',
                      sel ? 'bg-bg-hover' : 'hover:bg-bg-hover/60',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (fav) removeFromWatchlist(sym); else addToWatchlist(sym); }}
                        className="shrink-0 rounded-md p-0.5 text-text-tertiary/70 hover:text-amber-400"
                        aria-label={fav ? 'Remove from watchlist' : 'Add to watchlist'}
                        aria-pressed={fav}
                      >
                        <Star size={15} strokeWidth={2} className={clsx(fav && 'fill-amber-400 text-amber-400')} />
                      </button>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold leading-tight text-text-primary">{sym}</span>
                        {showNames && name ? <span className="block truncate text-[11px] leading-tight text-text-tertiary">{name}</span> : null}
                      </span>
                    </span>
                    <AnimatedPrice value={tick?.bid} digits={digits} className={clsx('text-right text-[13px] font-medium tabular-nums', tint(bf))} />
                    <span className="text-center text-[11px] tabular-nums text-text-tertiary">
                      {showSpread && tick ? Math.abs(spreadInPips(sym, tick.bid, tick.ask, instruments)) : ''}
                    </span>
                    <AnimatedPrice value={tick?.ask} digits={digits} className={clsx('text-right text-[13px] font-medium tabular-nums', tint(af))} />
                    <span className={clsx('text-right text-[12px] font-semibold tabular-nums', !Number.isFinite(pct) ? 'text-text-tertiary' : pct >= 0 ? 'text-emerald-500' : 'text-[#E5484D]')}>
                      {Number.isFinite(pct) ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </>
      ) : (
        <>
          {/* ── Search bar with Go button ── */}
          <div className="px-3 pt-3 pb-2 shrink-0 border-b border-border-glass bg-bg-secondary">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (e.target.value.trim()) setSegment('All');
                  }}
                  placeholder="Search symbols..."
                  className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-border-glass bg-bg-primary text-text-primary placeholder:text-text-tertiary outline-none focus:border-buy/50 focus:ring-1 focus:ring-buy/20"
                />
              </div>
              <button
                type="button"
                onClick={() => { /* search triggers on change already */ }}
                className="shrink-0 px-4 py-2.5 rounded-xl bg-buy text-white text-sm font-bold hover:bg-buy-light active:scale-95 transition-all"
              >
                Go
              </button>
            </div>
          </div>

          {/* ── Category tabs — horizontal scroll ── */}
          <div className="shrink-0 border-b border-border-glass bg-bg-secondary">
            <div className="flex overflow-x-auto no-scrollbar scrollbar-none">
              {(['Starred', 'All', ...TERMINAL_GROUPS] as const).map((tab) => {
                const label = tab === 'Starred' ? '★ Favourites' : tab === 'All' ? 'All' : tab;
                const active = segment === (tab === 'Starred' ? 'Starred' : tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSegment(tab === 'Starred' ? 'Starred' : tab)}
                    className={clsx(
                      'shrink-0 px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors border-b-2',
                      active
                        ? 'text-buy border-buy'
                        : 'text-text-tertiary border-transparent hover:text-text-primary',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Results label ── */}
          {search.trim() !== '' && (
            <div className="px-4 py-2 shrink-0 bg-bg-secondary/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Search Results</span>
            </div>
          )}

          {/* ── Instrument list ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y bg-bg-primary no-scrollbar scrollbar-none">
            {(() => {
              // Filter symbols by search + segment
              const displaySymbols = allSymbols.filter((s: string) => {
                if (!matchesSearch(s, search, instruments, SYMBOL_META)) return false;
                if (segment === 'Starred') return watchlist.includes(s);
                if (segment !== 'All') {
                  const g = terminalGroup(s, instruments);
                  if (g !== segment) return false;
                }
                return true;
              });

              if (displaySymbols.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <svg className="w-10 h-10 text-text-tertiary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm text-text-tertiary font-medium">
                      {segment === 'Starred' ? 'No favourites yet' : 'No instruments found'}
                    </p>
                  </div>
                );
              }

              return displaySymbols.map((symbol: string) => {
                const tick = prices[symbol];
                const digits = getDigits(symbol);
                const meta = SYMBOL_META[symbol];
                const sel = symbol === selectedSymbol;
                const isWatchlisted = watchlist.includes(symbol);
                const displayName = meta?.display || symbol;
                const segLabel = meta?.segment || terminalGroup(symbol, instruments);
                const sessionOpen = sessionOpenRef.current[symbol] ?? tick?.bid ?? 0;
                const isUp = tick ? tick.bid >= sessionOpen : true;

                const toggleFav = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isWatchlisted) removeFromWatchlist(symbol);
                  else addToWatchlist(symbol);
                };

                const openChart = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedSymbol(symbol);
                  const acc = urlParams.get('account');
                  if (acc) {
                    router.push(tradingTerminalUrl(acc, { view: 'chart' }));
                  } else {
                    router.push('/trading');
                  }
                };

                return (
                  <div
                    key={symbol}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3.5 border-b border-border-glass/40 transition-colors',
                      sel ? 'bg-buy/[0.06]' : 'hover:bg-bg-hover active:bg-buy/5',
                    )}
                  >
                    {/* Star toggle — persisted favourite */}
                    <button
                      type="button"
                      onClick={toggleFav}
                      className="shrink-0 p-1 -ml-1 rounded-md hover:bg-bg-hover transition-colors"
                      aria-label={isWatchlisted ? 'Remove from favourites' : 'Add to favourites'}
                      aria-pressed={isWatchlisted}
                    >
                      <Star
                        size={18}
                        strokeWidth={2}
                        className={clsx(isWatchlisted ? 'text-amber-400 fill-amber-400' : 'text-text-tertiary')}
                      />
                    </button>

                    {/* Tapping the label/body opens the mobile order sheet */}
                    <button
                      type="button"
                      onClick={() => handleRowClick(symbol)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-text-primary font-mono tracking-wide">{symbol}</span>
                      </div>
                      <p className="text-[11px] text-text-tertiary mt-0.5 truncate uppercase tracking-wide">
                        {segLabel}{displayName !== symbol ? ` – ${displayName}` : ''}
                      </p>
                    </button>

                    {/* Price + pip change */}
                    {tick ? (
                      <button
                        type="button"
                        onClick={() => handleRowClick(symbol)}
                        className="shrink-0 text-right"
                      >
                        <AnimatedPrice value={tick.bid} digits={digits} className="block text-sm font-mono font-bold tabular-nums text-text-primary" />
                        <span className={clsx('block text-[10px] font-bold tabular-nums', isUp ? 'text-buy' : 'text-sell')}>
                          {isUp ? '▲' : '▼'} {Math.abs(spreadInPips(symbol, tick.bid, tick.ask, instruments))} pip
                        </span>
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-text-tertiary">—</span>
                    )}

                    {/* Chart icon — opens full chart for this symbol */}
                    <button
                      type="button"
                      onClick={openChart}
                      className="shrink-0 p-1.5 rounded-md text-text-tertiary hover:text-buy hover:bg-bg-hover transition-colors"
                      aria-label="Open chart"
                      title="Open chart"
                    >
                      <TrendingUp size={18} strokeWidth={2} />
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}

      {activeOrderSymbol && (
        <MobileOrderSheet
          symbol={activeOrderSymbol}
          onClose={() => setActiveOrderSymbol(null)}
          onGoToChart={() => {
            setSelectedSymbol(activeOrderSymbol);
            const acc = urlParams.get('account');
            if (acc) {
              router.push(tradingTerminalUrl(acc, { view: 'chart' }));
            }
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTradingStore, InstrumentInfo } from '@/stores/tradingStore';
import { tradingTerminalUrl } from '@/lib/tradingNav';
import { clsx } from 'clsx';
import MobileOrderSheet from '@/components/trading/MobileOrderSheet';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';
import { useUIStore } from '@/stores/uiStore';
import { BellOff, ChevronUp } from 'lucide-react';

type Trend = 'up' | 'down' | 'neutral';

const TERMINAL_GROUPS = ['FOREX', 'CRYPTO', 'INDICES', 'METALS', 'COMMODITIES', 'STOCKS'] as const;
type TerminalGroup = (typeof TERMINAL_GROUPS)[number];

const SYMBOL_EMOJI: Record<string, string> = {
  BTCUSD: '₿',
  ETHUSD: 'Ξ',
  LTCUSD: 'Ł',
  XRPUSD: '✕',
  SOLUSD: '◎',
  DOGUSD: '🐕',
  DOGEUSD: '🐕',
  EURUSD: '🇪🇺',
  GBPUSD: '🇬🇧',
  USDJPY: '¥',
  AUDUSD: 'A$',
  USDCAD: 'C$',
  NZDUSD: '🇳🇿',
  XAUUSD: '🥇',
  XAGUSD: '🥈',
  USOIL: '🛢',
  US30: '📊',
  US500: '📊',
  NAS100: '📊',
  UK100: '📊',
  GER40: '📊',
};

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

const SEGMENTS = ['All', 'Forex', 'Crypto', 'Indices', 'Commodities', 'Metals', 'Stocks'];

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

/** Session move in pips (same units as spread when catalog pip_size exists). */
function sessionPipChange(
  symbol: string,
  bid: number,
  sessionOpen: number,
  instruments: InstrumentInfo[],
): number {
  const pip = pipSizeForSymbol(symbol, instruments);
  if (pip != null) {
    return Math.round((bid - sessionOpen) / pip);
  }
  const digits = getDigits(symbol);
  return Math.round((bid - sessionOpen) * Math.pow(10, digits - 1));
}

/** Single-line tabular price: same font size throughout; last digit slightly bolder for tick resolution. */
function PriceCell({
  value,
  digits,
  flash,
  tone,
}: {
  value: number;
  digits: number;
  flash?: Trend;
  tone: 'bid' | 'ask';
}) {
  const s = value.toFixed(digits);
  const dot = s.indexOf('.');
  const color =
    flash === 'up'
      ? 'text-buy'
      : flash === 'down'
        ? 'text-sell'
        : tone === 'bid'
          ? 'text-sell/95'
          : 'text-buy/95';

  if (dot === -1 || digits === 0) {
    return (
      <span className={clsx('tabular-nums text-[13px] sm:text-sm font-semibold tracking-tight', color)}>
        {s}
      </span>
    );
  }
  const dec = s.slice(dot + 1);
  if (dec.length <= 1) {
    return (
      <span className={clsx('tabular-nums text-[13px] sm:text-sm font-semibold tracking-tight', color)}>
        {s}
      </span>
    );
  }
  const head = s.slice(0, -1);
  const last = s.slice(-1);
  return (
    <span className={clsx('tabular-nums text-[13px] sm:text-sm tracking-tight', color)}>
      <span className="font-medium opacity-95">{head}</span>
      <span className="font-bold">{last}</span>
    </span>
  );
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
  const terminalMarketsOpen = useUIStore((s) => s.terminalMarketsOpen);
  const { watchlist, prices, selectedSymbol, setSelectedSymbol, instruments, activeAccount } = useTradingStore();
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('All');
  const [bidFlash, setBidFlash] = useState<Record<string, Trend>>({});
  const [askFlash, setAskFlash] = useState<Record<string, Trend>>({});
  const [activeOrderSymbol, setActiveOrderSymbol] = useState<string | null>(null);
  /** Terminal rail: collapse search + categorized list (header strip stays). */
  const [railListExpanded, setRailListExpanded] = useState(true);

  const prevTickRef = useRef<Record<string, { bid: number; ask: number }>>({});
  const sessionOpenRef = useRef<Record<string, number>>({});
  const dayLowRef = useRef<Record<string, number>>({});
  const dayHighRef = useRef<Record<string, number>>({});
  const lastTimeRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (variant === 'terminalRail' && terminalMarketsOpen) {
      setRailListExpanded(true);
    }
  }, [variant, terminalMarketsOpen]);

  useEffect(() => {
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      if (!(symbol in sessionOpenRef.current)) {
        sessionOpenRef.current[symbol] = tick.bid;
        dayLowRef.current[symbol] = tick.bid;
        dayHighRef.current[symbol] = tick.bid;
      } else {
        if (tick.bid < dayLowRef.current[symbol]) dayLowRef.current[symbol] = tick.bid;
        if (tick.bid > dayHighRef.current[symbol]) dayHighRef.current[symbol] = tick.bid;
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

  const filtered = allSymbols.filter((s: string) => {
    if (search && !s.toLowerCase().includes(search.toLowerCase())) return false;
    if (segment === 'Starred') return watchlist.includes(s);
    if (segment !== 'All') {
      const meta = SYMBOL_META[s];
      const inst = instruments.find((i) => i.symbol === s);
      const seg = (inst?.segment || meta?.segment || '').toLowerCase();
      const segLow = segment.toLowerCase();
      if (segLow === 'metals') return s === 'XAUUSD' || s === 'XAGUSD' || seg.includes('metal');
      if (!seg.includes(segLow) && !seg.startsWith(segLow.slice(0, 5))) return false;
    }
    return true;
  });

  const filteredTerminal = allSymbols.filter((s: string) => {
    if (search && !s.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groupedTerminal = (() => {
    const buckets: Record<TerminalGroup, string[]> = {
      FOREX: [],
      CRYPTO: [],
      INDICES: [],
      METALS: [],
      COMMODITIES: [],
      STOCKS: [],
    };
    for (const s of filteredTerminal) {
      buckets[terminalGroup(s, instruments)].push(s);
    }
    return buckets;
  })();

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
      ? 'border-0 bg-[#0a0a0a]'
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
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 bg-[#151820] border-b border-[#252a35]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-amber-400 to-blue-500"
                aria-hidden
              />
              <span className="text-sm font-bold text-white font-mono truncate">{selectedSymbol}</span>
              <span className="text-base leading-none shrink-0" aria-hidden>
                {SYMBOL_EMOJI[selectedSymbol] || '●'}
              </span>
              <BellOff className="w-3.5 h-3.5 text-[#555] shrink-0" aria-hidden />
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#252a35] text-[#888] shrink-0">
                DB
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onExitMarkets) {
                  onExitMarkets();
                } else {
                  setRailListExpanded((e) => !e);
                }
              }}
              className="shrink-0 p-1 rounded-md text-[#2962FF] hover:bg-[#2962FF]/10 transition-colors"
              aria-expanded={onExitMarkets ? true : railListExpanded}
              aria-label={onExitMarkets ? 'Back to trade panel' : railListExpanded ? 'Collapse symbol list' : 'Expand symbol list'}
            >
              <ChevronUp
                className={clsx(
                  'w-5 h-5 transition-transform duration-200',
                  !onExitMarkets && !railListExpanded && 'rotate-180',
                )}
              />
            </button>
          </div>
          {onExitMarkets || railListExpanded ? (
            <>
              <div className="p-3 shrink-0 border-b border-[#1a1a1a]">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 text-[#666]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    data-terminal-symbol-search
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search symbols…"
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-[#1e1e1e] bg-[#111] text-white placeholder:text-[#555] outline-none focus:border-[#2962FF]/50 focus:ring-1 focus:ring-[#2962FF]/20"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y">
                {TERMINAL_GROUPS.map((group) => {
                  const syms = groupedTerminal[group];
                  if (syms.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5c6370] border-t border-[#222831] first:border-t-0 bg-[#0c0d12]">
                        {group}
                      </div>
                      {syms.map((symbol) => {
                        const tick = prices[symbol];
                        const digits = getDigits(symbol);
                        const sel = symbol === selectedSymbol;
                        return (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() => handleRowClick(symbol)}
                            className={clsx(
                              'w-full flex items-center justify-between gap-2 pl-0 pr-3 py-2.5 text-left border-l-[3px] transition-colors',
                              sel
                                ? 'border-l-[#2962FF] bg-[#1a2438]'
                                : 'border-l-transparent hover:bg-[#14181f]',
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 pl-3">
                              <div
                                className="w-6 h-6 rounded-full shrink-0 bg-gradient-to-br from-amber-400/90 to-blue-500/90"
                                aria-hidden
                              />
                              <span className="text-sm font-bold text-white font-mono">{symbol}</span>
                              <span className="text-sm leading-none opacity-90 shrink-0">
                                {SYMBOL_EMOJI[symbol] || '·'}
                              </span>
                            </div>
                            <div className="flex gap-4 shrink-0">
                              <div className="flex flex-col items-end gap-0.5">
                                {tick ? (
                                  <span className="text-xs font-mono font-semibold tabular-nums text-[#ef5350]">
                                    {tick.bid.toFixed(digits)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-[#555]">—</span>
                                )}
                                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#555]">
                                  Bid
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                {tick ? (
                                  <span className="text-xs font-mono font-semibold tabular-nums text-[#00e676]">
                                    {tick.ask.toFixed(digits)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-[#555]">—</span>
                                )}
                                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#555]">
                                  Ask
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          {/* Search */}
          <div className="p-3 shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 text-text-secondary"
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search instruments..."
                className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-hide no-scrollbar shrink-0 border-b border-border-primary">
            {['All', 'Starred', ...SEGMENTS.slice(1)].map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => setSegment(seg)}
                className={clsx(
                  'px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap border',
                  segment === seg
                    ? 'bg-buy text-white border-buy shadow-lg shadow-buy/20'
                    : 'bg-bg-secondary text-text-tertiary border-border-glass hover:text-text-secondary hover:border-text-tertiary/30',
                )}
              >
                {seg}
              </button>
            ))}
          </div>

          {/* Column labels */}
          <div className="shrink-0 px-3 py-1.5 bg-bg-secondary/60">
            <div className="flex items-center justify-between">
              <div className="min-w-0 shrink" />
              <div className="grid grid-cols-2 gap-2 w-[10.5rem] min-[400px]:w-[11.5rem] shrink-0 text-[10px] font-extrabold uppercase tracking-widest">
                <span className="text-right text-sell/80">BID</span>
                <span className="text-right text-buy/80">ASK</span>
              </div>
            </div>
          </div>

          {/* Instruments */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y">
            {filtered.map((symbol) => {
              const tick = prices[symbol];
              const digits = getDigits(symbol);

              const sessionOpen = sessionOpenRef.current[symbol];
              const dayLow = dayLowRef.current[symbol];
              const dayHigh = dayHighRef.current[symbol];
              const lastTime = lastTimeRef.current[symbol];

              const delta =
                tick && sessionOpen != null ? tick.bid - sessionOpen : null;
              const pipChange =
                tick && sessionOpen != null
                  ? sessionPipChange(symbol, tick.bid, sessionOpen, instruments)
                  : null;
              const pctRaw =
                tick && sessionOpen != null && sessionOpen !== 0
                  ? ((tick.bid - sessionOpen) / sessionOpen) * 100
                  : null;
              const pctChange =
                pctRaw != null && Math.abs(pctRaw) < 0.005 ? 0 : pctRaw;
              const spread =
                tick != null ? spreadInPips(symbol, tick.bid, tick.ask, instruments) : null;

              const bFlash = bidFlash[symbol];
              const aFlash = askFlash[symbol];

              const minMove = tick ? Math.pow(10, -digits) : 0;
              const changeColor =
                delta == null || Math.abs(delta) < minMove * 0.25
                  ? 'text-text-tertiary'
                  : delta > 0
                    ? 'text-buy'
                    : 'text-sell';

              return (
                <div
                  key={symbol}
                  onClick={() => handleRowClick(symbol)}
                  className={clsx(
                    'cursor-pointer transition-colors px-3 py-2.5 border-l-2 border-b border-b-border-primary/40 hover:bg-bg-hover/30 active:bg-buy/5 border-l-transparent hover:border-l-buy/40',
                    symbol === selectedSymbol && 'border-l-buy bg-buy/5',
                  )}
                >
                  <div className="flex flex-col gap-2 min-[340px]:flex-row min-[340px]:items-start min-[340px]:justify-between min-[340px]:gap-3">
                    <div className="min-w-0 flex flex-col gap-1 shrink">
                      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0">
                        {pipChange != null && (
                          <span className={clsx('text-[12px] font-mono tabular-nums leading-none', changeColor)}>
                            {pipChange > 0 ? '+' : ''}
                            {pipChange} pips
                          </span>
                        )}
                        {pctChange != null && (
                          <span
                            className={clsx('text-[12px] font-mono font-semibold tabular-nums leading-none', changeColor)}
                          >
                            {pctChange > 0 ? '+' : ''}
                            {pctChange.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      <div className="text-[17px] sm:text-lg font-extrabold tracking-tight leading-tight text-text-primary">
                        {symbol}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-text-secondary">
                        {lastTime && <span>{lastTime}</span>}
                        {spread != null && (
                          <span className="flex items-center gap-1 text-text-tertiary">
                            <span className="text-[10px] font-sans font-semibold not-italic">Spr</span>
                            <span className="tabular-nums text-text-secondary">{spread}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 w-full min-[340px]:w-[10.5rem] min-[400px]:w-[11.5rem] shrink-0 grid grid-cols-2 gap-2">
                      <div className="text-right min-w-0 transition-colors duration-150">
                        {tick ? (
                          <PriceCell value={tick.bid} digits={digits} flash={bFlash} tone="bid" />
                        ) : (
                          <span className="text-[13px] text-text-tertiary font-mono">—</span>
                        )}
                      </div>
                      <div className="text-right min-w-0 transition-colors duration-150">
                        {tick ? (
                          <PriceCell value={tick.ask} digits={digits} flash={aFlash} tone="ask" />
                        ) : (
                          <span className="text-[13px] text-text-tertiary font-mono">—</span>
                        )}
                      </div>
                      {tick && dayLow != null && dayHigh != null && (
                        <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                          <div className="text-right min-w-0 flex items-baseline justify-end gap-1">
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-text-tertiary/70">L</span>
                            <span className="tabular-nums text-[11px] font-mono font-medium text-text-tertiary">
                              {dayLow.toFixed(digits)}
                            </span>
                          </div>
                          <div className="text-right min-w-0 flex items-baseline justify-end gap-1">
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-text-tertiary/70">H</span>
                            <span className="tabular-nums text-[11px] font-mono font-medium text-text-tertiary">
                              {dayHigh.toFixed(digits)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

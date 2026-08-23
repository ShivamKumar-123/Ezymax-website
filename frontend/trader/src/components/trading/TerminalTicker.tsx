'use client';

// Top-row "watchlist ticker" for the trading terminal — a USER-PICKED set
// of symbols (not a fixed list) with live mid price, percentage change since
// first paint, and a 30-tick sparkline drawn straight from the WebSocket
// feed already streaming into `useTradingStore.prices`. No extra API call.
//
// • "+" opens a picker over every instrument in the catalog; pick to add.
// • Each chip has a ✕ (on hover) to remove it.
// • The list persists per browser in localStorage (`crx-terminal-ticker`).
// • Click a chip to switch the active symbol (drives chart + order panel).

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Plus, Search, X } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';

const STORAGE_KEY = 'crx-terminal-ticker';
const DEFAULT_SYMBOLS = ['BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD'];
const SPARK_POINTS = 30;

/** Known display names / icons — anything else is derived from the symbol. */
const SYMBOL_META: Record<string, { label: string; flag?: string; digits: number }> = {
  EURUSD: { label: 'EUR/USD', flag: '🇪🇺', digits: 5 },
  GBPUSD: { label: 'GBP/USD', flag: '🇬🇧', digits: 5 },
  XAUUSD: { label: 'XAU/USD', flag: '🥇', digits: 2 },
  XAGUSD: { label: 'XAG/USD', flag: '🥈', digits: 3 },
  USDJPY: { label: 'USD/JPY', flag: '🇯🇵', digits: 3 },
  BTCUSD: { label: 'BTC/USD', flag: '₿', digits: 2 },
  ETHUSD: { label: 'ETH/USD', flag: 'Ξ', digits: 2 },
  SOLUSD: { label: 'SOL/USD', flag: '◎', digits: 2 },
  XRPUSD: { label: 'XRP/USD', flag: '✕', digits: 4 },
  LTCUSD: { label: 'LTC/USD', flag: 'Ł', digits: 2 },
  USOIL: { label: 'US OIL', flag: '🛢️', digits: 2 },
  US30: { label: 'US 30', flag: '📊', digits: 1 },
  US500: { label: 'US 500', flag: '📊', digits: 1 },
  NAS100: { label: 'NAS 100', flag: '📊', digits: 1 },
  UK100: { label: 'UK 100', flag: '🇬🇧', digits: 1 },
  GER40: { label: 'GER 40', flag: '🇩🇪', digits: 1 },
};

const CCY_FLAG: Record<string, string> = {
  EUR: '🇪🇺', GBP: '🇬🇧', USD: '🇺🇸', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿',
  HKD: '🇭🇰', SGD: '🇸🇬', XAU: '🥇', XAG: '🥈', BTC: '₿', ETH: 'Ξ', SOL: '◎', XRP: '✕', LTC: 'Ł', DOG: '🐕', DOGE: '🐕',
};

function metaFor(sym: string, instDigits?: number): { label: string; flag: string; digits: number } {
  const known = SYMBOL_META[sym];
  if (known) return { label: known.label, flag: known.flag ?? '·', digits: instDigits ?? known.digits };
  const isPair = /^[A-Z]{6}$/.test(sym);
  const base = isPair ? sym.slice(0, 3) : sym.slice(0, 3);
  return {
    label: isPair ? `${sym.slice(0, 3)}/${sym.slice(3)}` : sym,
    flag: CCY_FLAG[base] ?? '·',
    digits: instDigits ?? (isPair && sym.endsWith('JPY') ? 3 : isPair ? 5 : 2),
  };
}

function readStored(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : null;
  } catch {
    return null;
  }
}

function writeStored(list: string[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* private mode etc. */ }
}

function formatPrice(p: number | undefined, digits: number): string {
  if (!Number.isFinite(p)) return '—';
  return (p as number).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Tiny SVG sparkline. Normalises the buffer into the viewBox so the
 *  shape always fills the width without a leading flat region. */
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) {
    return <svg viewBox="0 0 60 20" className="w-16 h-5 opacity-30"><line x1="0" y1="10" x2="60" y2="10" stroke="currentColor" strokeWidth="1" /></svg>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 60;
      const y = 18 - ((v - min) / range) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 60 20" className="w-16 h-5">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TerminalTickerInner({ rightSlot }: { rightSlot?: ReactNode }) {
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);

  // User's strip. Hydrated from localStorage after mount (SSR-safe).
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  useEffect(() => {
    const stored = readStored();
    if (stored) setSymbols(stored);
  }, []);
  const updateSymbols = (next: string[]) => { setSymbols(next); writeStored(next); };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (pickerOpen) searchRef.current?.focus(); }, [pickerOpen]);

  // Per-symbol rolling mid-price buffer + "first seen" anchor for % change.
  const buffersRef = useRef<Record<string, number[]>>({});
  const anchorRef = useRef<Record<string, number>>({});
  const [tick, setTick] = useState(0); // trigger rerender when buffer mutates

  useEffect(() => {
    let dirty = false;
    for (const sym of symbols) {
      const p = prices[sym];
      if (!p) continue;
      const mid = (p.bid + p.ask) / 2;
      if (!Number.isFinite(mid)) continue;
      const buf = buffersRef.current[sym] || (buffersRef.current[sym] = []);
      const last = buf[buf.length - 1];
      if (last !== mid) {
        buf.push(mid);
        if (buf.length > SPARK_POINTS) buf.shift();
        if (anchorRef.current[sym] == null) anchorRef.current[sym] = mid;
        dirty = true;
      }
    }
    if (dirty) setTick((t) => t + 1);
  }, [prices, symbols]);

  const tiles = useMemo(() => {
    return symbols.map((sym) => {
      const buf = buffersRef.current[sym] || [];
      const inst = instruments.find((i) => i.symbol === sym);
      const meta = metaFor(sym, inst?.digits);
      const tick = prices[sym];
      const mid = tick ? (tick.bid + tick.ask) / 2 : undefined;
      const anchor = anchorRef.current[sym];
      const pct =
        mid != null && anchor != null && anchor !== 0
          ? ((mid - anchor) / anchor) * 100
          : 0;
      const positive = pct >= 0;
      return { sym, meta, mid, pct, positive, buf };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, tick, symbols, instruments]);

  // Picker candidates: full catalog (plus anything already quoted) minus the
  // symbols already on the strip, filtered by the search box.
  const candidates = useMemo(() => {
    const seen = new Set(symbols);
    const all = new Map<string, string>();
    for (const inst of instruments) all.set(inst.symbol, inst.display_name || '');
    for (const sym of Object.keys(prices)) if (!all.has(sym)) all.set(sym, '');
    const q = query.trim().toLowerCase();
    return Array.from(all.entries())
      .filter(([sym]) => !seen.has(sym))
      .filter(([sym, name]) => !q || sym.toLowerCase().includes(q) || name.toLowerCase().includes(q) || metaFor(sym).label.toLowerCase().includes(q))
      .sort(([a], [b]) => (prices[a] ? 0 : 1) - (prices[b] ? 0 : 1) || a.localeCompare(b))
      .slice(0, 60);
  }, [instruments, prices, symbols, query]);

  return (
    <div className="w-full border-b border-border-primary bg-bg-base flex items-center">
      <div className="flex-1 min-w-0 flex items-center overflow-x-auto no-scrollbar gap-2 px-2 py-1.5">
        {tiles.map(({ sym, meta, mid, pct, positive, buf }) => {
          const isSelected = selectedSymbol === sym;
          return (
            <div
              key={sym}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedSymbol(sym)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSymbol(sym); } }}
              className={clsx(
                'group relative shrink-0 flex cursor-pointer items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors',
                'min-w-[180px]',
                isSelected
                  ? 'bg-accent/10 border-accent/40'
                  : 'bg-bg-secondary border-border-primary hover:border-accent/30',
              )}
            >
              <span className="text-base leading-none text-text-primary" aria-hidden>
                {meta.flag}
              </span>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                  {meta.label}
                </span>
                <span className="text-sm font-mono font-bold text-text-primary tabular-nums">
                  {formatPrice(mid, meta.digits)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5 ml-auto">
                <span
                  className={clsx(
                    'text-[10px] font-bold font-mono tabular-nums whitespace-nowrap',
                    positive ? 'text-green-400' : 'text-red-400',
                  )}
                >
                  {positive ? '+' : ''}
                  {pct.toFixed(2)}%
                </span>
                <Sparkline data={buf} positive={positive} />
              </div>
              {/* Remove — appears on hover/focus so the chip stays clean. */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updateSymbols(symbols.filter((s) => s !== sym)); }}
                className="absolute -right-1.5 -top-1.5 hidden h-[18px] w-[18px] items-center justify-center rounded-full border border-border-primary bg-bg-secondary text-text-tertiary shadow-sm hover:text-text-primary group-hover:flex group-focus-within:flex"
                aria-label={`Remove ${meta.label} from ticker`}
                title="Remove"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}

      </div>
      {/* Add instrument — pinned outside the scroll row so it's always visible
          and its popover isn't clipped by overflow. */}
      <div className="relative shrink-0 pr-1">
          <button
            type="button"
            onClick={() => { setPickerOpen((o) => !o); setQuery(''); }}
            className={clsx(
              'flex h-[46px] w-[46px] items-center justify-center rounded-lg border border-dashed transition-colors',
              pickerOpen
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-border-primary text-text-tertiary hover:border-accent/50 hover:text-accent',
            )}
            aria-label="Add instrument to ticker"
            aria-expanded={pickerOpen}
            title="Add instrument"
          >
            <Plus size={18} strokeWidth={2.25} />
          </button>
          {pickerOpen && (
            <>
              <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-[52px] z-50 w-[300px] rounded-2xl border border-border-primary bg-bg-secondary p-2 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.7)]">
                <label htmlFor="ticker-add-search" className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-card-nested)' }}>
                  <Search size={14} className="shrink-0 text-text-tertiary" />
                  <input
                    id="ticker-add-search"
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search instruments"
                    className="ticket-input w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-text-primary shadow-none outline-none placeholder:text-text-tertiary focus:ring-0"
                  />
                </label>
                <div className="mt-1.5 max-h-[300px] overflow-y-auto overscroll-contain">
                  {candidates.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[12px] text-text-tertiary">No instruments found</p>
                  ) : (
                    candidates.map(([sym, name]) => {
                      const m = metaFor(sym);
                      const live = prices[sym] != null;
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => { updateSymbols([...symbols, sym]); setPickerOpen(false); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-bg-hover"
                        >
                          <span className="w-5 text-center text-[15px] leading-none text-text-primary" aria-hidden>{m.flag}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold leading-tight text-text-primary">{m.label}</span>
                            {name && name !== sym ? <span className="block truncate text-[11px] leading-tight text-text-tertiary">{name}</span> : null}
                          </span>
                          {!live && <span className="text-[10px] font-medium text-text-tertiary">no feed</span>}
                          <Plus size={14} className="shrink-0 text-accent" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      {rightSlot ? (
        <div className="shrink-0 flex items-center gap-2 px-2">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}

export default memo(TerminalTickerInner);

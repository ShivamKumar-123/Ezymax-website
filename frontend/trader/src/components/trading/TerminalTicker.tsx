'use client';

// Top-row "watchlist ticker" for the trading terminal — six headline
// symbols with live mid price, percentage change since first paint, and
// a 30-tick sparkline drawn straight from the WebSocket feed already
// streaming into `useTradingStore.prices`. No extra API call.
//
// Click a tile to switch the active symbol (drives chart + order panel).

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';

const SYMBOLS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'BTCUSD', 'USOIL'] as const;
const SPARK_POINTS = 30;

const SYMBOL_META: Record<string, { label: string; flag?: string; digits: number }> = {
  EURUSD: { label: 'EUR/USD', flag: '🇪🇺', digits: 5 },
  GBPUSD: { label: 'GBP/USD', flag: '🇬🇧', digits: 5 },
  XAUUSD: { label: 'XAU/USD', flag: '🥇', digits: 2 },
  USDJPY: { label: 'USD/JPY', flag: '🇯🇵', digits: 3 },
  BTCUSD: { label: 'BTC/USD', flag: '₿',   digits: 2 },
  USOIL:  { label: 'US OIL',  flag: '🛢️', digits: 2 },
};

function formatPrice(p: number | undefined, digits: number): string {
  if (!Number.isFinite(p)) return '—';
  return (p as number).toFixed(digits);
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

function TerminalTickerInner() {
  const prices = useTradingStore((s) => s.prices);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);

  // Per-symbol rolling mid-price buffer + "first seen" anchor for % change.
  const buffersRef = useRef<Record<string, number[]>>({});
  const anchorRef = useRef<Record<string, number>>({});
  const [tick, setTick] = useState(0); // trigger rerender when buffer mutates

  useEffect(() => {
    let dirty = false;
    for (const sym of SYMBOLS) {
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
  }, [prices]);

  const tiles = useMemo(() => {
    return SYMBOLS.map((sym) => {
      const buf = buffersRef.current[sym] || [];
      const meta = SYMBOL_META[sym];
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
  }, [prices, tick]);

  return (
    <div className="w-full border-b border-border-primary bg-bg-base">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-2 py-1.5">
        {tiles.map(({ sym, meta, mid, pct, positive, buf }) => {
          const isSelected = selectedSymbol === sym;
          return (
            <button
              key={sym}
              type="button"
              onClick={() => setSelectedSymbol(sym)}
              className={clsx(
                'shrink-0 flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors',
                'min-w-[180px]',
                isSelected
                  ? 'bg-accent/10 border-accent/40'
                  : 'bg-bg-secondary border-border-primary hover:border-accent/30',
              )}
            >
              <span className="text-base leading-none" aria-hidden>
                {meta?.flag || '·'}
              </span>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                  {meta?.label || sym}
                </span>
                <span className="text-sm font-mono font-bold text-text-primary tabular-nums">
                  {formatPrice(mid, meta?.digits ?? 5)}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TerminalTickerInner);

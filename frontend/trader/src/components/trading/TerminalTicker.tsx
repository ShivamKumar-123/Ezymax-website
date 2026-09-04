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
import { AnimatedPrice } from '@/components/trading/AnimatedPrice';
import { TOUR_TARGETS } from '@/components/Onboarding/tourTargets';

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

/** Tiny SVG sparkline with a soft area fill. Normalises the buffer into the
 *  viewBox so the shape always fills the width without a leading flat region.
 *  `id` must be unique per tile — the gradient is referenced by url(#…). */
function Sparkline({ data, positive, id }: { data: number[]; positive: boolean; id: string }) {
  if (data.length < 2) {
    return (
      <svg viewBox="0 0 60 20" className="h-5 w-16 shrink-0 opacity-25" aria-hidden>
        <line x1="0" y1="10" x2="60" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const coords = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 60;
    const y = 18 - ((v - min) / range) * 16;
    return [x, y] as const;
  });
  const points = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const stroke = positive ? '#22c55e' : '#ef4444';
  const [lastX, lastY] = coords[coords.length - 1];
  const gid = `spark-${id}`;

  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16 shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,20 ${points} 60,20`} fill={`url(#${gid})`} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Leading dot — makes the "live" end of the line readable at a glance */}
      <circle cx={lastX} cy={lastY} r="1.8" fill={stroke} />
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
      <div data-tour={TOUR_TARGETS.INSTRUMENTS_TICKER} className="flex overflow-x-auto no-scrollbar gap-2 px-2 py-2">
        {tiles.map(({ sym, meta, mid, pct, positive, buf }) => {
          const isSelected = selectedSymbol === sym;
          const digits = meta?.digits ?? 5;
          return (
            <button
              key={sym}
              type="button"
              onClick={() => setSelectedSymbol(sym)}
              aria-pressed={isSelected}
              title={`${meta?.label || sym} — ${formatPrice(mid, digits)}`}
              className={clsx(
                'group relative shrink-0 w-[196px] overflow-hidden rounded-xl border px-3 py-2 text-left',
                'transition-all duration-200',
                isSelected
                  ? 'border-accent/50 bg-accent/[0.07] shadow-[0_0_18px_-8px_rgba(204,255,0,0.9)]'
                  : 'border-border-primary bg-bg-secondary hover:border-accent/30 hover:bg-bg-hover',
              )}
            >
              {/* Accent rail marks the active symbol without stealing width */}
              {isSelected && (
                <span aria-hidden className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-[#ccff00]" />
              )}

              {/* Row 1 — icon + name on the left, change pill pinned right.
                  min-w-0 + truncate on the name means a long label shortens
                  instead of pushing the pill out of the card. */}
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg-base text-[11px] leading-none ring-1 ring-border-primary"
                >
                  {meta?.flag || '·'}
                </span>
                <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
                  {meta?.label || sym}
                </span>
                <span
                  className={clsx(
                    'ml-auto shrink-0 rounded-full px-1.5 py-px font-mono text-[9px] font-bold tabular-nums',
                    positive
                      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                  )}
                >
                  {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                </span>
              </div>

              {/* Row 2 — price on its own baseline, sparkline in a fixed lane */}
              <div className="mt-1 flex items-end justify-between gap-2">
                {Number.isFinite(mid) ? (
                  <AnimatedPrice
                    value={mid as number}
                    digits={digits}
                    className="min-w-0 truncate font-mono text-[15px] font-bold leading-none tabular-nums text-text-primary"
                  />
                ) : (
                  <span className="font-mono text-[15px] font-bold leading-none text-text-tertiary">—</span>
                )}
                <Sparkline data={buf} positive={positive} id={sym} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TerminalTickerInner);

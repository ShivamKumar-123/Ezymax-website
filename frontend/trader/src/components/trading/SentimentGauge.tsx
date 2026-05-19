'use client';

// Half-circle "buy vs sell" sentiment gauge for the selected symbol.
// Plain SVG — no chart library. Driven by GET /positions/sentiment which
// aggregates open positions across all live traders by side.
//
// The needle's angle is mapped 0% buy → -90° (full left, all sell) and
// 100% buy → +90° (full right, all buy). 50/50 = vertical needle.
// Refreshes every 6 s; pauses when document is hidden so we don't burn
// requests in a background tab.

import { memo, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import api from '@/lib/api/client';

interface SentimentData {
  symbol: string;
  buy_pct: number;
  sell_pct: number;
  total_traders: number;
}

interface Props {
  symbol: string;
  className?: string;
}

const REFRESH_MS = 6000;

function SentimentGaugeInner({ symbol, className }: Props) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    let timer: number | null = null;

    const fetchOnce = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const r = await api.get<SentimentData>('/positions/sentiment', { symbol });
        if (cancelled) return;
        setData(r);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setLoading(false);
      }
    };

    void fetchOnce();
    timer = window.setInterval(fetchOnce, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
    };
  }, [symbol]);

  const buy = data?.buy_pct ?? 50;
  const sell = data?.sell_pct ?? 50;
  // Needle angle in degrees relative to vertical: 50/50 → 0, all buy → +90, all sell → -90.
  const angle = (buy - 50) * 1.8;

  return (
    <div
      className={clsx(
        'rounded-xl border border-border-primary bg-bg-secondary p-3 flex flex-col gap-2',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">
          Market Sentiment
        </span>
        <span className="text-[10px] text-text-tertiary font-mono">
          {data?.symbol || symbol}
        </span>
      </div>

      <div className="relative h-[78px]">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background half-arc, split into 3 zones */}
          <defs>
            <linearGradient id="sent-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#sent-grad)"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Tick marks at 25/50/75% */}
          {[0.25, 0.5, 0.75].map((t) => {
            const a = -Math.PI + t * Math.PI;
            const x1 = 100 + Math.cos(a) * 72;
            const y1 = 100 + Math.sin(a) * 72;
            const x2 = 100 + Math.cos(a) * 88;
            const y2 = 100 + Math.sin(a) * 88;
            return (
              <line
                key={t}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1.5"
              />
            );
          })}
          {/* Needle */}
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px', transition: 'transform 600ms ease-out' }}>
            <line x1="100" y1="100" x2="100" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="100" r="6" fill="#d6a93d" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] font-bold mt-0.5">
        <div className="flex flex-col items-start leading-tight">
          <span className="text-green-400 tabular-nums">{buy.toFixed(0)}%</span>
          <span className="text-[9px] uppercase tracking-wide text-text-tertiary font-medium">Buy</span>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-medium">
          {loading
            ? '…'
            : data?.total_traders
              ? `${data.total_traders} ${data.total_traders === 1 ? 'trader' : 'traders'}`
              : 'no positions'}
        </span>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-red-400 tabular-nums">{sell.toFixed(0)}%</span>
          <span className="text-[9px] uppercase tracking-wide text-text-tertiary font-medium">Sell</span>
        </div>
      </div>
    </div>
  );
}

export default memo(SentimentGaugeInner);

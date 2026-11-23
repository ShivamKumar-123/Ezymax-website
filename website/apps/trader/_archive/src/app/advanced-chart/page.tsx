'use client';

/**
 * Advanced Chart — embed of TradingView's free public Advanced Chart
 * widget. Renders into a div via the widget loader script; uses
 * TradingView's public feeds (FX:, OANDA:, BINANCE:, etc.) so it has
 * no broker-side cost and no licence requirement. The trading
 * terminal at /trading/terminal continues to use the Charting Library
 * with our own bid/ask feed — this page is a research / analysis view.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { CandlestickChart, ExternalLink } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

interface SymbolEntry {
  /** Short label shown in the picker. */
  label: string;
  /** Pretty group used to organise the dropdown. */
  group: string;
  /** Full TradingView symbol with exchange prefix. */
  tv: string;
}

// Curated list of symbols. Each entry maps a friendly name to the
// public-feed prefix the TV widget uses. Keeping this hand-rolled (vs
// pulling from /instruments) means the picker shows symbols TV actually
// has data for — exotic broker-only symbols won't render in the widget.
const SYMBOLS: SymbolEntry[] = [
  // Forex majors
  { label: 'EUR / USD', group: 'Forex',       tv: 'FX:EURUSD' },
  { label: 'GBP / USD', group: 'Forex',       tv: 'FX:GBPUSD' },
  { label: 'USD / JPY', group: 'Forex',       tv: 'FX:USDJPY' },
  { label: 'USD / CHF', group: 'Forex',       tv: 'FX:USDCHF' },
  { label: 'AUD / USD', group: 'Forex',       tv: 'FX:AUDUSD' },
  { label: 'USD / CAD', group: 'Forex',       tv: 'FX:USDCAD' },
  { label: 'NZD / USD', group: 'Forex',       tv: 'FX:NZDUSD' },
  { label: 'EUR / GBP', group: 'Forex',       tv: 'FX:EURGBP' },
  { label: 'EUR / JPY', group: 'Forex',       tv: 'FX:EURJPY' },
  { label: 'GBP / JPY', group: 'Forex',       tv: 'FX:GBPJPY' },
  // Commodities
  { label: 'Gold (XAU/USD)',   group: 'Commodities', tv: 'OANDA:XAUUSD' },
  { label: 'Silver (XAG/USD)', group: 'Commodities', tv: 'OANDA:XAGUSD' },
  { label: 'Brent Crude',      group: 'Commodities', tv: 'TVC:UKOIL' },
  { label: 'WTI Crude',        group: 'Commodities', tv: 'TVC:USOIL' },
  { label: 'Natural Gas',      group: 'Commodities', tv: 'TVC:NATGAS' },
  // Indices
  { label: 'S&P 500',  group: 'Indices', tv: 'TVC:SPX' },
  { label: 'Nasdaq',   group: 'Indices', tv: 'TVC:NDX' },
  { label: 'Dow Jones',group: 'Indices', tv: 'TVC:DJI' },
  { label: 'DAX',      group: 'Indices', tv: 'TVC:DEU30' },
  { label: 'FTSE 100', group: 'Indices', tv: 'TVC:UKX' },
  { label: 'Nikkei',   group: 'Indices', tv: 'TVC:NI225' },
  // Crypto
  { label: 'BTC / USDT', group: 'Crypto', tv: 'BINANCE:BTCUSDT' },
  { label: 'ETH / USDT', group: 'Crypto', tv: 'BINANCE:ETHUSDT' },
  { label: 'BNB / USDT', group: 'Crypto', tv: 'BINANCE:BNBUSDT' },
  { label: 'SOL / USDT', group: 'Crypto', tv: 'BINANCE:SOLUSDT' },
  { label: 'XRP / USDT', group: 'Crypto', tv: 'BINANCE:XRPUSDT' },
];

const TF_OPTIONS = [
  { label: '1m',  interval: '1'   },
  { label: '5m',  interval: '5'   },
  { label: '15m', interval: '15'  },
  { label: '30m', interval: '30'  },
  { label: '1h',  interval: '60'  },
  { label: '4h',  interval: '240' },
  { label: '1D',  interval: 'D'   },
  { label: '1W',  interval: 'W'   },
];

export default function AdvancedChartPage() {
  const [tvSymbol, setTvSymbol] = useState<string>('OANDA:XAUUSD');
  const [interval, setInterval] = useState<string>('60');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Re-mount the widget when symbol or TF changes — the embed script
  // doesn't expose a stable .setSymbol() across versions, so the
  // simplest robust path is to clear the container and re-inject.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wipe previous embed if any.
    container.innerHTML = '';

    // Create a child div the widget mounts into. TV's script reads
    // its config from the script tag's text content.
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    inner.style.width = '100%';
    container.appendChild(inner);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',                 // candles
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false, // we drive symbol from our picker
      hide_side_toolbar: false,   // drawing tools visible
      withdateranges: true,
      hide_volume: false,
      details: true,
      hotlist: false,
      calendar: false,
      studies: [],
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      // Cleanup on next render — drop the script + inner div so the
      // widget script doesn't accumulate DOM nodes / listeners.
      try { container.innerHTML = ''; } catch { /* noop */ }
    };
  }, [tvSymbol, interval]);

  const grouped = useMemo(() => {
    const m = new Map<string, SymbolEntry[]>();
    for (const s of SYMBOLS) {
      const arr = m.get(s.group) || [];
      arr.push(s);
      m.set(s.group, arr);
    }
    return Array.from(m.entries());
  }, []);

  return (
    <DashboardShell>
      <div className="flex flex-col h-full">
        <div className="px-4 sm:px-6 pt-4 pb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <CandlestickChart size={20} className="text-accent" />
                Advanced Chart
              </h1>
              <p className="text-xs text-text-tertiary mt-0.5">
                Professional charting with 100+ indicators &amp; drawing tools. Public feed —
                use the <a href="/trading/terminal" className="text-accent hover:underline">trading terminal</a> for
                broker prices &amp; order placement.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xxs text-text-tertiary uppercase">Symbol</label>
              <select
                value={tvSymbol}
                onChange={(e) => setTvSymbol(e.target.value)}
                className="px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded-md text-text-primary"
              >
                {grouped.map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((s) => (
                      <option key={s.tv} value={s.tv}>{s.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xxs text-text-tertiary uppercase">Timeframe</label>
              <div className="flex flex-wrap gap-1 bg-bg-secondary border border-border-primary rounded-md p-0.5">
                {TF_OPTIONS.map((tf) => (
                  <button
                    key={tf.interval}
                    onClick={() => setInterval(tf.interval)}
                    className={clsx(
                      'px-2.5 py-1 rounded text-[11px] font-semibold transition-colors',
                      interval === tf.interval
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
              title="Open in TradingView"
            >
              <ExternalLink size={12} /> Full screen
            </a>
          </div>
        </div>

        <div className="flex-1 px-4 sm:px-6 pb-6 min-h-[480px]">
          <div
            className="w-full h-full min-h-[480px] rounded-xl overflow-hidden border border-border-primary bg-bg-secondary"
          >
            <div ref={containerRef} className="tradingview-widget-container w-full h-full" />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

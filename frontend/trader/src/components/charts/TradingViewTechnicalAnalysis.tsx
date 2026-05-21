'use client';

import { useMemo, memo } from 'react';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { toTradingViewSymbol } from '@/lib/tradingViewSymbols';

/**
 * TradingView's free Technical Analysis widget — shows STRONG BUY /
 * BUY / NEUTRAL / SELL / STRONG SELL based on consensus of moving
 * averages + oscillators (RSI, MACD, Stochastic, etc) for the
 * selected symbol. Complements the in-house Market Sentiment gauge:
 *   - Sentiment gauge  → what *our* traders are doing (flow signal)
 *   - This widget      → what *the chart math* is saying (TA signal)
 * Same iframe + JSON-fragment pattern as TradingViewChart so the
 * embed survives React Strict Mode and Next.js HMR cleanly.
 */
const TA_EMBED = 'https://www.tradingview-widget.com/embed-widget/technical-analysis/';

function buildEmbedUrl(symbol: string, theme: 'dark' | 'light'): string {
  const tvSymbol = toTradingViewSymbol(symbol);
  const settings: Record<string, string | number | boolean> = {
    interval: '15m',
    width: 380,
    isTransparent: false,
    height: 420,
    symbol: tvSymbol,
    showIntervalTabs: true,
    displayMode: 'single',
    locale: 'en',
    colorTheme: theme,
  };
  const u = new URL(TA_EMBED);
  u.searchParams.set('locale', 'en');
  u.hash = JSON.stringify(settings);
  return u.toString();
}

function TradingViewTechnicalAnalysisInner({ className }: { className?: string }) {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';

  const src = useMemo(
    () => buildEmbedUrl(selectedSymbol ?? 'EURUSD', tvTheme),
    [selectedSymbol, tvTheme],
  );

  return (
    <div
      className={clsx(
        'rounded-xl border border-border-primary bg-bg-secondary overflow-hidden flex flex-col',
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">
          Technical Consensus
        </span>
        <span className="text-[10px] text-text-tertiary font-mono">
          {selectedSymbol || 'EURUSD'}
        </span>
      </div>
      <div className="flex-1 min-h-[260px]">
        <iframe
          key={src}
          title={`Technical analysis ${selectedSymbol || 'EURUSD'}`}
          src={src}
          className="w-full h-full border-0"
          allow="clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

export default memo(TradingViewTechnicalAnalysisInner);

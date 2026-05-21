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
  // TradingView's TA widget renders its own "Technical Analysis for
  // <symbol>" header, interval tabs and gauge, so we don't add a
  // duplicate header on our side. `isTransparent: true` lets our
  // surface colour bleed through and removes the double-padding look.
  const settings: Record<string, string | number | boolean> = {
    interval: '15m',
    width: 340,
    isTransparent: true,
    height: 100,
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

  // The iframe's content height is fixed by TradingView (~410 px for
  // single-display TA). Giving the wrapper that exact height (no
  // overflow) is what kills the scrollbar — anything less and the
  // gauge + "Strong sell / Strong buy" labels overflow.
  return (
    <div
      className={clsx(
        'rounded-xl border border-border-primary bg-bg-secondary overflow-hidden flex',
        className,
      )}
      style={{ height: 410 }}
    >
      <iframe
        key={src}
        title={`Technical analysis ${selectedSymbol || 'EURUSD'}`}
        src={src}
        className="w-full h-full border-0 block"
        allow="clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
        scrolling="no"
      />
    </div>
  );
}

export default memo(TradingViewTechnicalAnalysisInner);

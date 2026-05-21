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
  // `isTransparent: false` makes the widget render its own opaque
  // surface (white in light, dark in dark). That's what we want — our
  // wrapper bg was producing a double-card look in light mode and a
  // visible seam between the widget's internal padding and our border.
  const settings: Record<string, string | number | boolean> = {
    interval: '15m',
    width: 340,
    isTransparent: false,
    height: 470,
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

  // 470 px matches the TV TA widget's natural single-display height
  // with interval tabs. Less than this clips the "Sell · Neutral ·
  // Buy" row that appears below the gauge in some themes/locales.
  return (
    <div
      className={clsx(
        'rounded-xl overflow-hidden flex',
        className,
      )}
      style={{ height: 470 }}
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

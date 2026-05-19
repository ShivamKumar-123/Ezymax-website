'use client';

import { useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { toTradingViewSymbol } from '@/lib/tradingViewSymbols';

/**
 * Modern Advanced Chart embed iframe (`tradingview-widget.com/embed-widget/
 * advanced-chart/`) — same pattern as TradingViewNewsTimeline /
 * TradingViewEventsCalendar. Settings are encoded as a JSON fragment.
 *
 * Why not the script-based `embed-widget-advanced-chart.js` pattern: it
 * breaks under React Strict Mode (double mount). On cleanup React removes
 * the host node while TradingView still touches `iframe.contentWindow` →
 * console error + blank chart. Direct iframe with `key={src}` sidesteps
 * the issue cleanly.
 *
 * Width/height MUST be numeric pixels. `'100%'` inside the JSON fragment
 * triggers `URIError: URI malformed` inside TradingView's bootstrap
 * (`%"` is not a valid percent-encoded sequence). CSS sizes the iframe.
 */
const ADVANCED_CHART_EMBED = 'https://www.tradingview-widget.com/embed-widget/advanced-chart/';

function buildWidgetEmbedUrl(
  symbol: string,
  theme: 'dark' | 'light',
  interval: string,
): string {
  const tvSymbol = toTradingViewSymbol(symbol);
  const settings: Record<string, string | number | boolean | unknown[]> = {
    autosize: true,
    width: 1400,
    height: 900,
    symbol: tvSymbol,
    interval,
    timezone: 'Etc/UTC',
    theme,
    style: '1',
    locale: 'en',
    // Drawing toolbar (left rail) — always visible. A toggle was tried
    // but flipping this flag at runtime broke the iframe render on the
    // free embed; the cost of the reload + the blank-state risk wasn't
    // worth the cosmetic win.
    hide_side_toolbar: false,
    allow_symbol_change: true,
    enable_publishing: false,
    save_image: true,
    details: true,
    hotlist: true,
    calendar: true,
    studies: [],
  };
  const u = new URL(ADVANCED_CHART_EMBED);
  u.searchParams.set('locale', 'en');
  u.hash = JSON.stringify(settings);
  return u.toString();
}

function TradingViewChartInner() {
  const pathname = usePathname();
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);
  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const interval = onTradingTerminal ? '5' : '15';

  const src = useMemo(
    () => buildWidgetEmbedUrl(selectedSymbol ?? 'EURUSD', tvTheme, interval),
    [selectedSymbol, tvTheme, interval],
  );

  const surface = tvTheme === 'light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';

  return (
    <div className={clsx('w-full h-full min-h-[200px] min-w-0', surface)} data-tv-chart-root>
      <iframe
        key={src}
        title={`Chart ${selectedSymbol || 'EURUSD'}`}
        src={src}
        className={clsx('h-full w-full min-h-[200px] border-0', surface)}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

export default memo(TradingViewChartInner);

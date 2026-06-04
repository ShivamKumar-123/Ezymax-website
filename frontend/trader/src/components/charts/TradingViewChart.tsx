'use client';

import { useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { toTradingViewSymbol } from '@/lib/tradingViewSymbols';
import { getDigits } from '@/lib/utils';

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
  // Live broker tick for the active symbol — drives the overlay below
  // so the user always sees the executable price, not just the chart's
  // reference price from an external exchange.
  const tick = useTradingStore(
    (s) => s.prices[(selectedSymbol ?? 'EURUSD').toUpperCase()],
  );
  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const interval = onTradingTerminal ? '5' : '15';

  const src = useMemo(
    () => buildWidgetEmbedUrl(selectedSymbol ?? 'EURUSD', tvTheme, interval),
    [selectedSymbol, tvTheme, interval],
  );

  const surface = tvTheme === 'light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';
  const digits = getDigits(selectedSymbol ?? 'EURUSD');
  const fmt = (n: number | undefined | null) =>
    n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);

  return (
    <div className={clsx('relative w-full h-full min-h-[200px] min-w-0', surface)} data-tv-chart-root>
      <iframe
        key={src}
        title={`Chart ${selectedSymbol || 'EURUSD'}`}
        src={src}
        className={clsx('h-full w-full min-h-[200px] border-0', surface)}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {/* Broker-quote overlay. The embedded TradingView chart pulls
        * candle data from public exchanges (BINANCE for crypto, OANDA
        * for metals, FX:* for forex) — those prices can diverge from
        * the broker's executable quote by spread + LP latency. This
        * overlay anchors the user to the ACTUAL price their orders
        * will fill against, so a $200 gap between Binance candles
        * and the broker's BTC quote doesn't look like a bug. The
        * overlay is `pointer-events-none` so it doesn't block chart
        * interactions underneath. */}
      <div
        className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-2 rounded-md border border-border-primary/70 bg-bg-secondary/95 px-2.5 py-1 text-[11px] shadow-md backdrop-blur"
        aria-label="Broker quote — actual execution price"
      >
        <span className="text-text-tertiary uppercase tracking-wider">Broker</span>
        <span className="text-sell font-mono tabular-nums">
          Bid {fmt(tick?.bid)}
        </span>
        <span className="text-text-tertiary">·</span>
        <span className="text-buy font-mono tabular-nums">
          Ask {fmt(tick?.ask)}
        </span>
      </div>
    </div>
  );
}

export default memo(TradingViewChartInner);

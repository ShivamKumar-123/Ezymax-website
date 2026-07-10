'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';

/**
 * Advanced chart — embeds the shared `/chart` page (TradingView Charting
 * Library fed by OUR backend), the same page the mobile app's WebView loads.
 *
 * The iframe src is built ONCE with the initial symbol; subsequent symbol
 * changes are sent via postMessage so the ~26 MB library isn't reloaded on
 * every switch. The chart page listens for `{type:'setSymbol'}`.
 */
function TradingViewChartInner() {
  const pathname = usePathname();
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const theme: 'dark' | 'light' = 'light'; // app chart is light-only
  const interval = onTradingTerminal ? '5' : '15';

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Capture the first symbol so the src (and thus the heavy library load) is
  // stable; later switches go through postMessage.
  const initialSymbol = useRef(selectedSymbol ?? 'EURUSD').current;

  const src = useMemo(
    () => `/chart?symbol=${encodeURIComponent(initialSymbol)}&interval=${interval}&theme=${theme}`,
    [initialSymbol, interval, theme],
  );

  // Push symbol changes into the embedded chart. Retry a couple of times in
  // case the chart is still booting when the symbol first changes.
  useEffect(() => {
    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const post = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'setSymbol', symbol: sym },
          window.location.origin,
        );
      } catch {
        /* ignore */
      }
    };
    post();
    const t1 = setTimeout(post, 800);
    const t2 = setTimeout(post, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selectedSymbol]);

  return (
    <div className={clsx('w-full h-full min-h-[200px] min-w-0 bg-bg-base')} data-tv-chart-root>
      <iframe
        ref={iframeRef}
        title={`Chart ${selectedSymbol || 'EURUSD'}`}
        src={src}
        className="h-full w-full min-h-[200px] border-0 bg-bg-base"
        allow="clipboard-write; fullscreen"
      />
    </div>
  );
}

export default memo(TradingViewChartInner);

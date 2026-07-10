'use client';

/**
 * Shared advanced-chart page (TradingView Charting Library).
 *
 * Rendered chrome-free so it can be embedded identically by:
 *   • the web trading terminal (in-page), and
 *   • the mobile app's WebView (CHART_URL points here).
 *
 * Query params:
 *   ?symbol=EURUSD   active symbol (default EURUSD)
 *   ?interval=60     TradingView resolution: 1|5|15|30|60|240|1D (default 60)
 *   ?theme=dark|light (default dark)
 *
 * Data comes from our own backend via createDatafeed() — the candles match
 * the prices users actually trade on, not TradingView's feed.
 */

import { useEffect, useRef, useState } from 'react';
import { createDatafeed, type DatafeedInstrument } from '@/lib/chart/datafeed';

// The Charting Library attaches itself to window.TradingView at runtime.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TradingView?: any;
  }
}

const LIBRARY_SRC = '/charting_library/charting_library.standalone.js';

function loadLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('no document'));
    if (window.TradingView) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIBRARY_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('library load error')));
      return;
    }
    const s = document.createElement('script');
    s.src = LIBRARY_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load charting library'));
    document.head.appendChild(s);
  });
}

export default function ChartPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  // Read theme once at render (SSR-safe) so the container background matches
  // before the widget paints — no dark flash on the light web terminal.
  const [theme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('theme') === 'light'
      ? 'light'
      : 'dark',
  );

  useEffect(() => {
    let disposed = false;
    const params = new URLSearchParams(window.location.search);
    const symbol = (params.get('symbol') || 'EURUSD').toUpperCase();
    const interval = params.get('interval') || '60';

    (async () => {
      const datafeed = createDatafeed({});

      // Best-effort: load the instrument catalog so symbol resolution gets the
      // right price scale (digits) and search works. Falls back to heuristics.
      try {
        const r = await fetch('/api/v1/instruments/', { credentials: 'include' });
        if (r.ok) {
          const list = await r.json();
          if (Array.isArray(list)) {
            datafeed.setInstruments(
              list
                .map((i: Record<string, unknown>): DatafeedInstrument => ({
                  symbol: String(i.symbol || ''),
                  digits: typeof i.digits === 'number' ? i.digits : undefined,
                  segment: typeof i.segment === 'string' ? i.segment : undefined,
                }))
                .filter((i: DatafeedInstrument) => i.symbol),
            );
          }
        }
      } catch {
        /* ignore — resolveSymbol falls back to digit heuristics */
      }

      try {
        await loadLibrary();
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#888;font-family:system-ui">Chart failed to load</div>';
        }
        return;
      }
      if (disposed || !containerRef.current || !window.TradingView) return;

      const dark = theme === 'dark';
      widgetRef.current = new window.TradingView.widget({
        symbol,
        interval,
        container: containerRef.current,
        datafeed,
        library_path: '/charting_library/',
        locale: 'en',
        timezone: 'Etc/UTC',
        theme,
        autosize: true,
        fullscreen: false,
        toolbar_bg: dark ? '#0b0e11' : '#ffffff',
        loading_screen: { backgroundColor: dark ? '#0b0e11' : '#ffffff' },
        disabled_features: [
          'use_localstorage_for_settings',
          'symbol_search_hot_key',
        ],
        enabled_features: ['hide_left_toolbar_by_default'],
        overrides: dark
          ? {
              'paneProperties.background': '#0b0e11',
              'paneProperties.backgroundType': 'solid',
              'scalesProperties.textColor': '#b7bdc6',
            }
          : {},
      });
    })();

    // Let an embedder (the web terminal iframe) switch symbol / resolution
    // without reloading the whole 26 MB library. Same-origin only.
    const onMessage = (e: MessageEvent) => {
      if (typeof window !== 'undefined' && e.origin && e.origin !== window.location.origin) return;
      const m = e.data as { type?: string; symbol?: string; resolution?: string };
      const w = widgetRef.current;
      if (!m || !w || typeof w.onChartReady !== 'function') return;
      if (m.type === 'setSymbol' && m.symbol) {
        w.onChartReady(() => { try { w.chart().setSymbol(String(m.symbol).toUpperCase()); } catch { /* ignore */ } });
      } else if (m.type === 'setResolution' && m.resolution) {
        w.onChartReady(() => { try { w.chart().setResolution(String(m.resolution)); } catch { /* ignore */ } });
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      disposed = true;
      window.removeEventListener('message', onMessage);
      try {
        widgetRef.current?.remove?.();
      } catch {
        /* ignore */
      }
      widgetRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, background: theme === 'light' ? '#ffffff' : '#0b0e11' }}
    />
  );
}

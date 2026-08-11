'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { getDigits } from '@/lib/utils';
import { createDatafeed } from '@/lib/charting/datafeed';
import { createBroker, BROKER_CONFIG } from '@/lib/charting/broker';

/**
 * Self-hosted TradingView Advanced Charts (charting_library). Replaces the old
 * third-party iframe embed: candles + live quotes now come from OUR backend
 * (see lib/charting/datafeed) so the chart matches the broker's executable
 * price. The library lives in `public/charting_library-master/charting_library`.
 */
const LIB_PATH = '/charting_library-master/charting_library/';
const LIB_SCRIPT = `${LIB_PATH}charting_library.standalone.js`;

// Load the UMD standalone bundle once; it sets `window.TradingView`.
let scriptPromise: Promise<void> | null = null;
function loadLibrary(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).TradingView?.widget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIB_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('charting_library failed to load')));
      // If it already loaded before this component mounted.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).TradingView?.widget) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = LIB_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // allow a retry on next mount
      reject(new Error('charting_library failed to load'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function buildOverrides(theme: 'dark' | 'light'): Record<string, string> {
  const up = '#ccff00';
  const down = '#ff4d4d';
  const candle = {
    'mainSeriesProperties.candleStyle.upColor': up,
    'mainSeriesProperties.candleStyle.downColor': down,
    'mainSeriesProperties.candleStyle.borderUpColor': up,
    'mainSeriesProperties.candleStyle.borderDownColor': down,
    'mainSeriesProperties.candleStyle.wickUpColor': up,
    'mainSeriesProperties.candleStyle.wickDownColor': down,
  };
  if (theme === 'light') return candle;
  return {
    ...candle,
    'paneProperties.background': '#0e0e0e',
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.04)',
    'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.04)',
    'scalesProperties.textColor': '#8a8a8a',
    'scalesProperties.lineColor': 'rgba(255,255,255,0.08)',
  };
}

function AdvancedChartInner() {
  const pathname = usePathname();
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);
  const tick = useTradingStore((s) => s.prices[(selectedSymbol ?? 'EURUSD').toUpperCase()]);

  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const interval = onTradingTerminal ? '5' : '15';

  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadChart = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Keep latest symbol/theme in refs so the create-effect (which must NOT
  // recreate on every symbol change) reads fresh values.
  const symbolRef = useRef(selectedSymbol);
  const themeRef = useRef(tvTheme);
  symbolRef.current = selectedSymbol;
  themeRef.current = tvTheme;

  // ── Create / destroy the widget (only on manual reload) ──
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let widget: any = null;
    setStatus('loading');

    loadLibrary()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const startTheme = themeRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const TV = (window as any).TradingView;
        widget = new TV.widget({
          container: containerRef.current,
          library_path: LIB_PATH,
          datafeed: createDatafeed(),
          symbol: (symbolRef.current ?? 'EURUSD').toUpperCase(),
          interval,
          locale: 'en',
          theme: startTheme,
          autosize: true,
          timezone: 'Etc/UTC',
          fullscreen: false,
          debug: false,
          disabled_features: [
            'use_localstorage_for_settings',
            'header_symbol_search',
            'symbol_search_hot_key',
            'header_compare',
            'popup_hints',
            // We keep our own right-side order panel + bottom positions table,
            // so hide TV's built-in account-manager panel. The broker still
            // draws the on-chart position/SL/TP LINES — that's what we want.
            'trading_account_manager',
          ],
          enabled_features: ['side_toolbar_in_fullscreen_mode', 'hide_left_toolbar_by_default'],
          loading_screen: {
            backgroundColor: startTheme === 'light' ? '#ffffff' : '#0e0e0e',
            foregroundColor: '#ccff00',
          },
          overrides: buildOverrides(startTheme),
          custom_font_family: "'Inter', sans-serif",
          // ── Trading Terminal broker ──────────────────────────────────────
          // Renders each open position as an entry line (live P&L + ✕ close)
          // with draggable STOP-LOSS / TAKE-PROFIT lines. Dragging a bracket
          // line calls PUT /positions/{id} on our backend; a rejected level
          // snaps back. See lib/charting/broker.ts.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          broker_factory: (h: any) => createBroker(h),
          broker_config: BROKER_CONFIG,
        });
        widget.onChartReady(() => {
          if (cancelled) return;
          widgetRef.current = widget;
          setStatus('ready');
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      try {
        widget?.remove?.();
      } catch {
        /* widget already gone */
      }
      widgetRef.current = null;
    };
    // interval is constant per page; symbol/theme handled via refs + effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadNonce]);

  // ── Sync symbol changes into the live widget without recreating it ──
  useEffect(() => {
    if (status !== 'ready' || !widgetRef.current || !selectedSymbol) return;
    try {
      widgetRef.current.activeChart().setSymbol(selectedSymbol.toUpperCase());
    } catch {
      /* chart not ready yet */
    }
  }, [selectedSymbol, status]);

  // ── Sync theme changes into the live widget ──
  useEffect(() => {
    if (status !== 'ready' || !widgetRef.current) return;
    try {
      widgetRef.current.changeTheme?.(tvTheme);
      widgetRef.current.applyOverrides?.(buildOverrides(tvTheme));
    } catch {
      /* older lib without changeTheme — reload picks it up */
    }
  }, [tvTheme, status]);

  const surface = tvTheme === 'light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';
  const digits = getDigits(selectedSymbol ?? 'EURUSD');
  const fmt = (n: number | undefined | null) =>
    n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);

  return (
    <div className={clsx('relative w-full h-full min-h-[200px] min-w-0', surface)} data-tv-chart-root>
      {/* The library renders its own iframe into this container. */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading / error states */}
      {status !== 'ready' && (
        <div className={clsx('absolute inset-0 z-20 flex flex-col items-center justify-center gap-3', surface)}>
          {status === 'loading' ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ccff00]/30 border-t-[#ccff00]" />
              <p className="text-xs text-text-tertiary">Loading advanced chart…</p>
            </>
          ) : (
            <>
              <TriangleAlert className="h-7 w-7 text-[#ccff00]" />
              <p className="text-xs text-text-secondary">Chart failed to load.</p>
              <button
                type="button"
                onClick={reloadChart}
                className="rounded-lg bg-[#ccff00] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] hover:bg-[#a6d600] transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {/* Manual remount — recovers a stalled datafeed without reloading the page. */}
      <button
        type="button"
        onClick={reloadChart}
        title="Reload chart"
        aria-label="Reload chart"
        className="absolute bottom-10 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-border-primary/70 bg-bg-secondary/95 px-2 py-1 text-[11px] text-text-secondary shadow-md backdrop-blur hover:text-text-primary hover:border-border-primary transition-fast"
      >
        <RotateCw className="w-3 h-3" aria-hidden />
        <span>Reload</span>
      </button>

      {/* Broker-quote overlay — the actual executable bid/ask (the chart plots
          our broker candles, but this anchors the user to the live tick). */}
      <div
        className="pointer-events-none absolute top-14 right-3 z-10 flex items-center gap-2 rounded-md border border-border-primary/70 bg-bg-secondary/95 px-2.5 py-1 text-[11px] shadow-md backdrop-blur"
        aria-label="Broker quote — actual execution price"
      >
        <span className="text-text-tertiary uppercase tracking-wider">Broker</span>
        <span className="text-sell font-mono tabular-nums">Bid {fmt(tick?.bid)}</span>
        <span className="text-text-tertiary">·</span>
        <span className="text-buy font-mono tabular-nums">Ask {fmt(tick?.ask)}</span>
      </div>
    </div>
  );
}

export default memo(AdvancedChartInner);

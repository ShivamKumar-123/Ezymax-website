'use client';

/**
 * Advanced chart for the web terminal — the self-hosted TradingView Charting
 * Library mounted INLINE (no iframe), fed by OUR backend via createDatafeed().
 *
 * We render inline rather than embedding the /chart page in an iframe because
 * some browsers block same-origin iframes (X-Frame-Options / tracking
 * prevention → "This content is blocked"). Inline mounting sidesteps all
 * framing rules. The /chart page still exists for the mobile app's WebView,
 * which loads it as a top-level URL (no framing involved).
 *
 * Symbol changes call widget.setSymbol() so the ~26 MB library isn't reloaded.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { createDatafeed, type DatafeedInstrument } from '@/lib/chart/datafeed';
import { loadChartLibrary } from '@/lib/chart/loadChartLibrary';
import { api } from '@/lib/api/client';
import toast from 'react-hot-toast';

const CONTAINER_ID = 'sc_tv_terminal_chart';

function TradingViewChartInner({ onRequestFullscreen }: { onRequestFullscreen?: () => void }) {
  const pathname = usePathname();
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const interval = onTradingTerminal ? '5' : '15';

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const initialSymbol = useRef(selectedSymbol ?? 'EURUSD').current;
  // Latest fullscreen callback, held in a ref so the []-deps mount effect that
  // wires the toolbar button always calls the current one (no stale closure).
  const fsCbRef = useRef(onRequestFullscreen);
  fsCbRef.current = onRequestFullscreen;

  // On-chart SL/TP: open positions on the charted symbol render as draggable
  // lines (entry with a close ✕, plus SL/TP lines you drag to modify).
  const positions = useTradingStore((s) => s.positions);
  const [chartReady, setChartReady] = useState(false);
  // positionId → { pos, sl, tp, posCreating, slCreating, tpCreating }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linesRef = useRef<Map<string, any>>(new Map());
  const syncBusyRef = useRef(false);

  // Mount the widget once.
  useEffect(() => {
    let disposed = false;

    (async () => {
      const datafeed = createDatafeed({
        // BID-shift: feed the chart the same half-spread the order panel uses,
        // so the chart's last price == panel BID == a buy position's current
        // price (MT4/MT5 convention). Read live from the store at call time.
        getHalfSpread: (sym: string) => {
          const p = useTradingStore.getState().prices[sym.toUpperCase()];
          if (!p) return 0;
          const hs = (Number(p.ask) - Number(p.bid)) / 2;
          return Number.isFinite(hs) && hs > 0 ? hs : 0;
        },
      });
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
        /* resolveSymbol falls back to heuristics */
      }

      try {
        await loadChartLibrary();
      } catch {
        return;
      }
      if (disposed || !containerRef.current || !window.TradingView) return;

      widgetRef.current = new window.TradingView.widget({
        symbol: initialSymbol,
        interval,
        // This library version wants the container's element ID (string), not
        // the DOM node — passing the node silently fails to mount.
        container: CONTAINER_ID,
        container_id: CONTAINER_ID,
        datafeed,
        library_path: '/charting_library/',
        locale: 'en',
        timezone: 'Etc/UTC',
        theme: 'light',
        autosize: true,
        fullscreen: false,
        toolbar_bg: '#ffffff',
        loading_screen: { backgroundColor: '#ffffff' },
        disabled_features: ['use_localstorage_for_settings', 'symbol_search_hot_key'],
        enabled_features: ['hide_left_toolbar_by_default'],
      });
      try {
        widgetRef.current.onChartReady(() => {
          readyRef.current = true;
          setChartReady(true);
        });
      } catch {
        /* ignore */
      }

      // Add the Full-screen toggle INTO the chart's own top toolbar (via the
      // library's createButton API) rather than overlaying an absolutely
      // positioned button on top of the toolbar — the overlay was covering the
      // chart's own top-right buttons. Only when a handler is supplied.
      if (fsCbRef.current && typeof widgetRef.current.headerReady === 'function') {
        widgetRef.current
          .headerReady()
          .then(() => {
            try {
              const btn: HTMLElement = widgetRef.current.createButton();
              btn.textContent = '⛶ Full screen';
              btn.title = 'Expand chart to full screen';
              btn.style.cursor = 'pointer';
              btn.addEventListener('click', () => fsCbRef.current?.());
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      }
    })();

    return () => {
      disposed = true;
      try {
        widgetRef.current?.remove?.();
      } catch {
        /* ignore */
      }
      widgetRef.current = null;
      readyRef.current = false;
      linesRef.current.clear();
      setChartReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch symbol without reloading the library.
  useEffect(() => {
    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const w = widgetRef.current;
    if (!w || typeof w.onChartReady !== 'function') return;
    try {
      w.onChartReady(() => {
        try {
          w.chart().setSymbol(sym);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }, [selectedSymbol]);

  // Close a position from its on-chart line's ✕.
  const closePos = useCallback(async (id: string) => {
    try {
      await api.post(`/positions/${id}/close`, {});
    } catch {
      /* the positions poll will keep the line until it actually closes */
    }
  }, []);

  // Persist a dragged SL/TP. Reads the CURRENT position from the store so the
  // untouched leg isn't sent stale. On rejection (e.g. SL on the wrong side of
  // entry) the line snaps back to the stored value.
  const applySLTP = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (id: string, which: 'sl' | 'tp', price: number, line: any) => {
      const cur = useTradingStore.getState().positions.find((x) => x.id === id);
      const body: Record<string, number> = {};
      body[which === 'sl' ? 'stop_loss' : 'take_profit'] = price;
      const otherKey = which === 'sl' ? 'take_profit' : 'stop_loss';
      const otherVal = which === 'sl' ? cur?.take_profit : cur?.stop_loss;
      if (otherVal != null) body[otherKey] = Number(otherVal);
      try {
        await api.put(`/positions/${id}`, body);
      } catch (e) {
        // Surface the server's reason (e.g. "would trigger instantly") and snap
        // the line back to the stored level — never leave an unaccepted level drawn.
        toast.error(e instanceof Error ? e.message : `Failed to update ${which.toUpperCase()}`);
        const back = which === 'sl' ? cur?.stop_loss : cur?.take_profit;
        try {
          if (back != null && line) line.setPrice(Number(back));
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  // Reconcile chart lines with the open positions on the charted symbol.
  // Creates lines once (guarded), then just updates price/text/P&L thereafter.
  const syncLines = useCallback(async () => {
    const w = widgetRef.current;
    if (!w || syncBusyRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try {
      chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart();
    } catch {
      return;
    }
    if (!chart || typeof chart.createOrderLine !== 'function') return;

    syncBusyRef.current = true;
    try {
      const state = useTradingStore.getState();
      const sym = (state.selectedSymbol ?? 'EURUSD').toUpperCase();
      const rel = (state.positions || []).filter(
        (p) => String(p.symbol).toUpperCase() === sym,
      );
      const relIds = new Set(rel.map((p) => p.id));
      const map = linesRef.current;

      // Drop lines whose position closed or is off the charted symbol.
      for (const [id, set] of Array.from(map.entries())) {
        if (!relIds.has(id)) {
          for (const k of ['pos', 'sl', 'tp'] as const) {
            try { set[k]?.remove(); } catch { /* ignore */ }
          }
          map.delete(id);
        }
      }

      for (const p of rel) {
        let set = map.get(p.id);
        if (!set) { set = {}; map.set(p.id, set); }
        const profit = Number(p.profit ?? 0);
        const pnl = `${profit >= 0 ? '+' : '-'}$${Math.abs(profit).toFixed(2)}`;
        const posColor = profit >= 0 ? '#16a34a' : '#dc2626';

        // Entry / position line — close ✕ closes the position.
        if (set.pos) {
          try {
            set.pos.setPrice(Number(p.open_price))
              .setText(`${p.side.toUpperCase()} ${pnl}`)
              .setQuantity(String(p.lots));
            set.pos.setLineColor(posColor); set.pos.setBodyTextColor(posColor);
          } catch { /* ignore */ }
        } else if (!set.posCreating) {
          set.posCreating = true;
          try {
            const line = await chart.createPositionLine();
            line.setText(`${p.side.toUpperCase()} ${pnl}`)
              .setPrice(Number(p.open_price))
              .setQuantity(String(p.lots));
            try { line.setLineColor(posColor); line.setBodyTextColor(posColor); } catch { /* ignore */ }
            line.onClose(() => { void closePos(p.id); });
            set.pos = line;
          } catch { /* ignore */ }
          set.posCreating = false;
        }

        // SL / TP draggable lines. Non-cancellable here (removal stays in the
        // order panel) because the modify endpoint can't distinguish clear from
        // no-op via a null. Copied (MAM) positions get NO editable SL/TP lines —
        // the master strategy controls those and the server rejects edits.
        const isCopy = p.trade_type === 'copy_trade';
        const legs: Array<['sl' | 'tp', number | undefined, string, string]> = [
          ['sl', p.stop_loss, 'SL', '#dc2626'],
          ['tp', p.take_profit, 'TP', '#16a34a'],
        ];
        for (const [leg, value, label, color] of legs) {
          const creatingKey = leg === 'sl' ? 'slCreating' : 'tpCreating';
          if (value != null && !isCopy) {
            if (set[leg]) {
              try { set[leg].setPrice(Number(value)); } catch { /* ignore */ }
            } else if (!set[creatingKey]) {
              set[creatingKey] = true;
              try {
                const line = await chart.createOrderLine();
                line.setText(label).setPrice(Number(value)).setQuantity(String(p.lots));
                try {
                  line.setCancellable(false);
                  line.setLineColor(color); line.setBodyTextColor(color);
                  line.setBodyBorderColor(color); line.setQuantityBackgroundColor(color);
                } catch { /* ignore */ }
                line.onMove(() => {
                  try { void applySLTP(p.id, leg, line.getPrice(), line); } catch { /* ignore */ }
                });
                set[leg] = line;
              } catch { /* ignore */ }
              set[creatingKey] = false;
            }
          } else if (set[leg]) {
            try { set[leg].remove(); } catch { /* ignore */ }
            set[leg] = undefined;
          }
        }
      }
    } finally {
      syncBusyRef.current = false;
    }
  }, [applySLTP, closePos]);

  useEffect(() => {
    if (!chartReady) return;
    void syncLines();
  }, [positions, selectedSymbol, chartReady, syncLines]);

  return (
    <div className={clsx('w-full h-full min-h-[200px] min-w-0 bg-bg-base')} data-tv-chart-root>
      <div id={CONTAINER_ID} ref={containerRef} className="h-full w-full min-h-[200px]" />
    </div>
  );
}

export default memo(TradingViewChartInner);

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

  // entity id → which (position, leg) it draws, so the global drawing_event
  // handler knows what a dragged shape maps to.
  const entityMapRef = useRef<Map<string, { positionId: string; leg: 'sl' | 'tp' }>>(new Map());
  // Debounce timers per entity so a drag fires ONE modify (on release), not one
  // per mouse-move frame.
  const dragTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const syncWarnedRef = useRef(false);

  // Persist an SL/TP change. Reads the CURRENT position from the store so the
  // untouched leg isn't sent stale. Returns whether the server accepted it.
  const applySLTP = useCallback(
    async (id: string, which: 'sl' | 'tp', price: number): Promise<boolean> => {
      const cur = useTradingStore.getState().positions.find((x) => x.id === id);
      const body: Record<string, number> = {};
      body[which === 'sl' ? 'stop_loss' : 'take_profit'] = price;
      const otherVal = which === 'sl' ? cur?.take_profit : cur?.stop_loss;
      if (otherVal != null) body[which === 'sl' ? 'take_profit' : 'stop_loss'] = Number(otherVal);
      try {
        await api.put(`/positions/${id}`, body);
        return true;
      } catch (e) {
        // Surface the server's reason (e.g. "would trigger instantly").
        toast.error(e instanceof Error ? e.message : `Failed to update ${which.toUpperCase()}`);
        return false;
      }
    },
    [],
  );

  // Reconcile chart lines with open positions on the charted symbol. Advanced
  // Charts has no order-line API, so we draw horizontal-line SHAPES: a locked
  // entry line + draggable SL/TP lines. Created once, then only their price is
  // updated; removed when the position closes or the symbol changes.
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
    if (!chart || typeof chart.createShape !== 'function') {
      if (!syncWarnedRef.current) {
        syncWarnedRef.current = true;
        // eslint-disable-next-line no-console
        console.warn('[SwissCresta chart] createShape unavailable — SL/TP lines cannot render on this build.');
      }
      return;
    }

    syncBusyRef.current = true;
    try {
      const state = useTradingStore.getState();
      const sym = (state.selectedSymbol ?? 'EURUSD').toUpperCase();
      const rel = (state.positions || []).filter(
        (p) => String(p.symbol).toUpperCase() === sym,
      );
      const relIds = new Set(rel.map((p) => p.id));
      const map = linesRef.current;
      // Anchor the horizontal lines at a time that's DEFINITELY on-screen
      // (visible-range start), not "now" — on a closed market "now" can sit past
      // the last bar and some builds reject an off-range time. Horizontal lines
      // span full width regardless, so the exact time only needs to be valid.
      let anchorTime = Math.floor(Date.now() / 1000);
      try {
        const vr = chart.getVisibleRange?.();
        if (vr && Number.isFinite(vr.from)) anchorTime = Math.floor(vr.from);
      } catch { /* keep now */ }

      const removeEntity = (entityId?: string) => {
        if (entityId == null) return;
        try { chart.removeEntity(entityId); } catch { /* ignore */ }
        entityMapRef.current.delete(String(entityId));
      };

      // Drop lines whose position closed or is off the charted symbol.
      for (const [id, set] of Array.from(map.entries())) {
        if (!relIds.has(id)) {
          removeEntity(set.entry?.id);
          removeEntity(set.sl?.id);
          removeEntity(set.tp?.id);
          map.delete(id);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ensure = async (set: any, leg: 'entry' | 'sl' | 'tp', price: number, label: string, color: string, locked: boolean) => {
        const existing = set[leg];
        if (existing) {
          if (Math.abs(Number(existing.price) - price) > 1e-9) {
            try { chart.getShapeById(existing.id).setPoints([{ time: anchorTime, price }]); } catch { /* ignore */ }
            existing.price = price;
          }
          return;
        }
        const creatingKey = `${leg}Creating`;
        if (set[creatingKey]) return;
        set[creatingKey] = true;
        try {
          const id = await chart.createShape(
            { time: anchorTime, price },
            {
              shape: 'horizontal_line',
              text: label,
              lock: locked,
              disableSelection: locked,
              disableSave: true,
              disableUndo: true,
              overrides: {
                linecolor: color, linewidth: leg === 'entry' ? 1 : 2, linestyle: leg === 'entry' ? 2 : 0,
                showLabel: true, textcolor: color, horzLabelsAlign: 'right', showPrice: true, bold: true,
              },
            },
          );
          const sid = String(id);
          set[leg] = { id: sid, price };
          if (leg !== 'entry') entityMapRef.current.set(sid, { positionId: set.__pid, leg });
        } catch { /* ignore */ }
        set[creatingKey] = false;
      };

      for (const p of rel) {
        let set = map.get(p.id);
        if (!set) { set = { __pid: p.id }; map.set(p.id, set); }
        const isCopy = p.trade_type === 'copy_trade';

        // Entry reference line (locked, dashed grey).
        await ensure(set, 'entry', Number(p.open_price), `${p.side.toUpperCase()} ${p.lots}`, '#64748b', true);

        // Draggable SL / TP. Copied (MAM) positions get none — master-controlled.
        if (!isCopy && p.stop_loss != null) {
          await ensure(set, 'sl', Number(p.stop_loss), 'SL', '#dc2626', false);
        } else { removeEntity(set.sl?.id); set.sl = undefined; }
        if (!isCopy && p.take_profit != null) {
          await ensure(set, 'tp', Number(p.take_profit), 'TP', '#16a34a', false);
        } else { removeEntity(set.tp?.id); set.tp = undefined; }
      }
    } finally {
      syncBusyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!chartReady) return;
    void syncLines();
  }, [positions, selectedSymbol, chartReady, syncLines]);

  // Global drag handler: when a user drags an SL/TP shape, persist the new level
  // (debounced to the drag's end) and snap back on rejection.
  useEffect(() => {
    if (!chartReady) return;
    const w = widgetRef.current;
    if (!w || typeof w.subscribe !== 'function') return;
    const handler = (sourceId: unknown, type: string) => {
      if (type !== 'move' && type !== 'points_changed') return;
      const eid = String(sourceId);
      const meta = entityMapRef.current.get(eid);
      if (!meta) return;
      const timers = dragTimersRef.current;
      const prev = timers.get(eid);
      if (prev) clearTimeout(prev);
      timers.set(eid, setTimeout(() => {
        timers.delete(eid);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let chart: any;
        try { chart = w.activeChart(); } catch { return; }
        let price: number | undefined;
        try { price = chart.getShapeById(eid).getPoints()?.[0]?.price; } catch { return; }
        if (price == null || !Number.isFinite(price)) return;
        const newPrice = Number(price);
        void (async () => {
          const ok = await applySLTP(meta.positionId, meta.leg, newPrice);
          const set = linesRef.current.get(meta.positionId);
          if (ok) {
            if (set && set[meta.leg]) set[meta.leg].price = newPrice;
          } else {
            const cur = useTradingStore.getState().positions.find((x) => x.id === meta.positionId);
            const back = meta.leg === 'sl' ? cur?.stop_loss : cur?.take_profit;
            if (back != null) {
              try { chart.getShapeById(eid).setPoints([{ time: Math.floor(Date.now() / 1000), price: Number(back) }]); } catch { /* ignore */ }
              if (set && set[meta.leg]) set[meta.leg].price = Number(back);
            }
          }
        })();
      }, 450));
    };
    w.subscribe('drawing_event', handler);
    return () => { try { w.unsubscribe('drawing_event', handler); } catch { /* ignore */ } };
  }, [chartReady, applySLTP]);

  return (
    <div className={clsx('w-full h-full min-h-[200px] min-w-0 bg-bg-base')} data-tv-chart-root>
      <div id={CONTAINER_ID} ref={containerRef} className="h-full w-full min-h-[200px]" />
    </div>
  );
}

export default memo(TradingViewChartInner);

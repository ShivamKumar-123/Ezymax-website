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
 *
 * On-chart trading lines (SwisDex-style):
 *  - Each open position draws a locked ENTRY (execution) line coloured by side
 *    (BUY blue / SELL red) whose label carries the LIVE P&L (+$ and %) coloured
 *    by profit/loss/breakeven, plus locked dashed SL (amber) / TP (teal) lines
 *    labelled `SL <price>  +$<projected P&L at that level>`.
 *  - Pending orders draw a dashed entry (BUY blue / SELL purple) + SL/TP.
 *  - An HTML overlay pins an [SL] [TP] [✕] button group to each entry line:
 *    drag SL/TP up/down to set (dashed preview line + shaded zone + price/P&L
 *    label follows the cursor), or plain-click to type a price. ✕ closes at
 *    market. Committing always confirms first via the in-app dialog.
 *  - Persistent shaded zones fill entry→SL (red) and entry→TP (teal).
 *  - A stale-price watchdog greys the entry lines when the feed stalls.
 * All bracket edits go through PUT /positions/{id} with ONLY the changed leg
 * (the backend partial-update leaves the other leg untouched).
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore, type ChartExitsDraft } from '@/stores/tradingStore';
import { createDatafeed, type DatafeedInstrument } from '@/lib/chart/datafeed';
import { loadChartLibrary } from '@/lib/chart/loadChartLibrary';
import { netPnl } from '@/lib/pnl';
import toast from 'react-hot-toast';
import { ChartTradeWidget } from '@/components/charts/ChartTradeWidget';


// A freshly-opened MARKET position shows optimistically with a temporary id
// ("optim-…") until the server row arrives with a real UUID. SL/TP/close must
// NOT run against that temp id — the backend rejects it ("Input should be a
// valid UUID"). Only real UUIDs get on-chart SL/TP controls.
function isRealPositionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
}

// tradingStore.refreshPositions matches a fresh optimistic row to its server
// twin almost immediately (well under a second, typically), but keeps
// DISPLAYING it under the fake "optim-…" id for a full 5s afterwards purely
// to avoid a list-remount flicker — see FRESH_OPTIM_WINDOW_MS there. Gating
// SL/TP/close readiness on that DISPLAYED id (as isRealPositionId(id) alone
// does) blocks every chart interaction for that whole 5s even though the
// real position, and its real id, already exist. resolvePositionId reads the
// side-channel map the store fills in as soon as the match is found, so
// readiness checks below track actual server confirmation, not the cosmetic
// display delay. This must NEVER replace the id handed to setChartExitsDraft
// / setChartCloseRequest / closePositionFromChart — those need the row's
// DISPLAYED id, because that is the only id `positions.find` in
// ChartExitsPanel can look the row up by while it's still "fresh".
function readyPositionId(id: string): string {
  return useTradingStore.getState().resolvePositionId(id);
}

// Stale-price thresholds (ms): how long without a tick before a position
// line's P&L is treated as stale. Crypto trades 24/7 (short), forex/metals
// are quiet at weekends (long so we don't spam "stale" when no ticks are
// expected), otherwise a normal live-market threshold.
const STALE_MS = { crypto: 3000, normal: 5000, weekendClosed: 60000 };
const STALE_COLOR = '#6b7280';

// Chart line colours — blue/red industry standard. Blue = anything BUY-related
// (BUY entry, profit); Red = anything SELL-related (SELL entry, loss).
const CHART_BUY_COLOR = '#3b82f6';   // blue — BUY position entry line
const CHART_SELL_COLOR = '#ef4444';  // red  — SELL position entry line
const PROFIT_COLOR = '#3b82f6';      // blue — entry-line P&L label when in profit
const LOSS_COLOR = '#ef4444';        // red  — entry-line P&L label when in loss
const BREAKEVEN_COLOR = '#9ca3af';   // gray — entry-line P&L label near break-even
const SL_COLOR = '#f59e0b';          // amber — stop-loss line
const TP_COLOR = '#14b8a6';          // teal  — take-profit line
const PENDING_BUY_COLOR = '#3b82f6'; // blue   — pending BUY entry line
const PENDING_SELL_COLOR = '#a855f7';// purple — pending SELL entry line

// Pane/scale colours per theme. BOTH themes get explicit values (light used
// to rely on the library defaults): a layout restored via `saved_data`
// carries the colours it was autosaved with, so a session saved in dark
// mode painted the light-mode chart black. These are (re-)asserted after
// every restore — see the changeTheme/applyOverrides call in onChartReady.
const CHART_THEME_OVERRIDES: Record<'dark' | 'light', Record<string, string>> = {
  dark: {
    'paneProperties.background': '#000000',
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': '#131313',
    'paneProperties.horzGridProperties.color': '#131313',
    'scalesProperties.textColor': '#9a9a9a',
    'scalesProperties.lineColor': '#1f1f1f',
  },
  light: {
    'paneProperties.background': '#ffffff',
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': '#f2f3f5',
    'paneProperties.horzGridProperties.color': '#f2f3f5',
    'scalesProperties.textColor': '#6b7280',
    'scalesProperties.lineColor': '#e6e8ec',
  },
};

// ── Chart layout persistence ───────────────────────────────────────────────
// The widget is created with `use_localstorage_for_settings` disabled and
// nothing ever called widget.save(), so studies (indicators), drawings, the
// interval and the chart style were all rebuilt from defaults on every mount:
// a reload silently wiped whatever the user had set up.
//
// The layout is saved to localStorage and handed back via `saved_data`. Our
// own position / order overlays are NOT included — every createShape call
// passes `disableSave: true` — so a restored layout brings back the user's
// indicators without resurrecting stale position lines.
const LAYOUT_KEY = 'sc:chart:layout:v1';

/** Last saved layout, or undefined when there is nothing usable stored. */
function readSavedLayout(): Record<string, unknown> | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    // A truncated or hand-edited entry must not take the chart down with it.
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function writeSavedLayout(state: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota exceeded — persistence is a convenience, never a
    // reason to break the chart.
  }
}

/** Shown over the pane when the selected symbol has no live tick. */
function NoFeedNotice({ symbol }: { symbol: string }) {
  const tick = useTradingStore((st) => st.prices[symbol.toUpperCase()]);
  const quotedKey = useTradingStore((st) => Object.keys(st.prices).join(','));
  const setSelectedSymbol = useTradingStore((st) => st.setSelectedSymbol);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    setWaited(false);
    const t = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(t);
  }, [symbol]);
  if (tick || !waited) return null;
  const alt = quotedKey.split(',').filter(Boolean).find((q) => q !== symbol.toUpperCase());
  return (
    <div className="pointer-events-none absolute inset-0 z-[20] flex items-center justify-center">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-border-primary bg-bg-glass-heavy px-5 py-4 text-center shadow-xl backdrop-blur">
        <p className="text-sm font-semibold text-text-primary">No live feed for {symbol}</p>
        <p className="mt-1 text-xs text-text-secondary">
          This instrument isn&apos;t quoted on this environment yet — the chart stays empty until a
          price feed is connected for it.
        </p>
        {alt && (
          <button
            type="button"
            onClick={() => setSelectedSymbol(alt)}
            className="mt-3 inline-flex items-center rounded-full bg-crx-charcoal px-4 py-1.5 text-xs font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover transition-colors"
          >
            Switch to {alt} (live)
          </button>
        )}
      </div>
    </div>
  );
}

function TradingViewChartInner({
  onRequestFullscreen,
  theme = 'light',
  intervalOverride,
  showTradeWidget = true,
}: {
  onRequestFullscreen?: () => void;
  theme?: 'light' | 'dark';
  intervalOverride?: string;
  showTradeWidget?: boolean;
}) {
  // Unique per instance — the terminal mounts this chart in more than one place
  // (mobile + desktop layouts); a shared DOM id would make two widgets fight
  // over the same container. Stable across renders via useRef.
  const CONTAINER_ID = useRef('sc_tv_terminal_' + Math.random().toString(36).slice(2, 10)).current;
  const pathname = usePathname();
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const interval = intervalOverride || (onTradingTerminal ? '5' : '15');

  const containerRef = useRef<HTMLDivElement>(null);
  // Overlay layer above the chart for the [SL]/[TP]/✕ buttons + shaded zones.
  const overlayRef = useRef<HTMLDivElement>(null);
  // Set once the widget exists; lets the unmount path flush a pending save.
  const persistRef = useRef<(() => void) | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const initialSymbol = useRef(selectedSymbol ?? 'EURUSD').current;
  // Latest fullscreen callback, held in a ref so the []-deps mount effect that
  // wires the toolbar button always calls the current one (no stale closure).
  const fsCbRef = useRef(onRequestFullscreen);
  fsCbRef.current = onRequestFullscreen;

  const positions = useTradingStore((s) => s.positions);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);
  const [chartReady, setChartReady] = useState(false);
  // Pending-order line key -> { id, price, creating, text, color }.
  // Keys: ord-<id> (entry), ord-<id>-sl, ord-<id>-tp. Position lines live in
  // the native-drag effect below, not here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linesRef = useRef<Map<string, any>>(new Map());


  // Mount the widget once.
  useEffect(() => {
    let disposed = false;
    let cleanupPersist: (() => void) | null = null;

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

      const savedLayout = readSavedLayout();

      widgetRef.current = new window.TradingView.widget({
        symbol: initialSymbol,
        interval,
        // This library version wants the container's element ID (string), not
        // the DOM node — passing the node silently fails to mount.
        container: CONTAINER_ID,
        container_id: CONTAINER_ID,
        datafeed,
        library_path: '/charting_library/',
        custom_css_url: theme === 'dark' ? '/chart-theme.css' : '/chart-theme-light.css',
        locale: 'en',
        timezone: 'Etc/UTC',
        theme,
        autosize: true,
        fullscreen: false,
        toolbar_bg: theme === 'dark' ? '#000000' : '#ffffff',
        loading_screen: { backgroundColor: theme === 'dark' ? '#000000' : '#ffffff' },
        disabled_features: ['use_localstorage_for_settings', 'symbol_search_hot_key'],
        enabled_features: ['hide_left_toolbar_by_default'],
        // Restore the user's indicators / drawings / interval, and ask the
        // library to tell us (via onAutoSaveNeeded) whenever they change.
        // The symbol effect below re-asserts the selected symbol on mount, so
        // a layout saved under a different symbol cannot hijack the view.
        ...(savedLayout ? { saved_data: savedLayout } : {}),
        auto_save_delay: 2,
        overrides: CHART_THEME_OVERRIDES[theme],
      });
      // Persist on every library-signalled change, plus on the way out: a
      // fast reload can beat the 2s autosave debounce, which is exactly the
      // case the user hits when they add an indicator and immediately refresh.
      const persist = () => {
        const w = widgetRef.current;
        if (!w || !readyRef.current) return;
        try {
          w.save?.((state: unknown) => writeSavedLayout(state));
        } catch {
          /* older builds without save() — nothing to persist */
        }
      };
      persistRef.current = persist;
      const onPageHide = () => persist();
      // Only on the way OUT — visibilitychange also fires on re-show, and
      // saving then would just rewrite what we already stored.
      const onVisibility = () => { if (document.visibilityState === 'hidden') persist(); };
      window.addEventListener('pagehide', onPageHide);
      document.addEventListener('visibilitychange', onVisibility);
      cleanupPersist = () => {
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibility);
      };

      try {
        widgetRef.current.onChartReady(() => {
          readyRef.current = true;
          setChartReady(true);
          // A restored layout brings back the colours it was autosaved with,
          // and those beat both the `theme` and the constructor `overrides`
          // — a session last used in dark mode painted the light chart
          // black. Re-assert the active theme ON TOP of the restore:
          // changeTheme resets the built-in palette where the build supports
          // it, applyOverrides then pins our exact pane/scale colours.
          if (savedLayout) {
            const reassert = () => {
              try { widgetRef.current?.applyOverrides?.(CHART_THEME_OVERRIDES[theme]); } catch { /* ignore */ }
            };
            try {
              const p = widgetRef.current.changeTheme?.(theme);
              if (p && typeof p.then === 'function') p.then(reassert, reassert);
              else reassert();
            } catch { reassert(); }
          }
          // Indicator added/removed, drawing edited, interval or style
          // changed — the library debounces these by auto_save_delay.
          try {
            widgetRef.current.subscribe?.('onAutoSaveNeeded', persist);
          } catch {
            /* feature unavailable — pagehide still covers the common case */
          }
          // Pin a small FIXED right margin (~3 bars) so the latest candle hugs
          // the right edge like MT5 — the library's default wide future
          // whitespace reads as a "candle gap" (sibling-platform client
          // report). Best-effort: the TimeScale API shape varies by version.
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ts = (widgetRef.current as any).activeChart?.().getTimeScale?.();
            ts?.usePercentageRightOffset?.().setValue(false);
            ts?.defaultRightOffset?.().setValue(3);
            ts?.setRightOffset?.(3);
          } catch { /* ignore */ }
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
      // Flush before teardown, otherwise navigating away loses the last edit.
      try { persistRef.current?.(); } catch { /* ignore */ }
      try { cleanupPersist?.(); } catch { /* ignore */ }
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
  }, [theme]);

  // Switch symbol without reloading the library. Position/order lines are
  // symbol-specific overlays — remove the shapes and drop our refs so the
  // reconcile effect re-creates them for the new symbol.
  useEffect(() => {
    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const w = widgetRef.current;
    if (!w || typeof w.onChartReady !== 'function') return;
    try {
      w.onChartReady(() => {
        try {
          const chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart();
          for (const [, entry] of linesRef.current) {
            try { if (entry && entry.id != null) chart?.removeEntity(entry.id); } catch { /* ignore */ }
          }
          linesRef.current.clear();
          chart.setSymbol(sym);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }, [selectedSymbol]);

  // Re-shift the whole series when the admin changes the spread live.
  //
  // The chart draws MID bars shifted to a BID basis by subtracting the current
  // half-spread (datafeed `toBid`), but that shift is only applied as each bar
  // is produced — already-drawn history and the forming candle keep the OLD
  // offset. `ask − bid` is otherwise rock-steady per symbol (the backend
  // tick-quantises it), so a real jump in the half-spread means an admin
  // spread edit just landed on /ws/prices. When that happens we force the
  // datafeed to re-request bars (`resetData`) so the ENTIRE series is re-shifted
  // with the new offset — no seam between old and new bars, and the last price
  // tracks the new bid immediately (matching the order panel + P&L, which are
  // already live off the same tick).
  useEffect(() => {
    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const halfSpreadFrom = (p: { bid: number; ask: number } | undefined): number | null => {
      if (!p) return null;
      const hs = (Number(p.ask) - Number(p.bid)) / 2;
      return Number.isFinite(hs) && hs > 0 ? hs : null;
    };
    const inst = useTradingStore
      .getState()
      .instruments.find((i) => String(i.symbol).toUpperCase() === sym);
    const digits = typeof inst?.digits === 'number' ? inst.digits : 5;
    // Below half a display tick: filters float round-trip jitter, but well
    // under the ≥½-tick move a real spread change produces.
    const eps = Math.pow(10, -digits) * 0.25;
    let last = halfSpreadFrom(useTradingStore.getState().prices[sym]);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const resetChart = () => {
      const w = widgetRef.current;
      if (!w || !readyRef.current) return;
      try {
        const chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart?.();
        // Re-requests getBars for the visible range → toBid re-runs with the
        // fresh half-spread. The realtime subscribeBars stays connected.
        chart?.resetData?.();
      } catch {
        /* ignore */
      }
    };

    const unsub = useTradingStore.subscribe((state) => {
      const hs = halfSpreadFrom(state.prices[sym]);
      if (hs == null) return;
      if (last == null) { last = hs; return; }
      if (Math.abs(hs - last) > eps) {
        last = hs;
        // A spread edit is one discrete jump; debounce coalesces any burst
        // and lets the new bid/ask settle before the (heavier) reset.
        if (timer) clearTimeout(timer);
        timer = setTimeout(resetChart, 250);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [selectedSymbol]);

  // Projected P&L (account currency) if this position were closed at `price`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computePnlAt = useCallback((pos: any, price: number): number => {
    const sym = String(pos.symbol).toUpperCase();
    const inst = useTradingStore.getState().instruments.find((i) => String(i.symbol).toUpperCase() === sym);
    const cs = Number(inst?.contract_size) || 100000;
    const pnl = pos.side === 'buy'
      ? (price - Number(pos.open_price)) * Number(pos.lots) * cs
      : (Number(pos.open_price) - price) * Number(pos.lots) * cs;
    const base = String(inst?.base_currency || sym.slice(0, 3)).toUpperCase();
    const quote = String(inst?.quote_currency || sym.slice(3, 6)).toUpperCase();
    if (!quote || quote === 'USD') return pnl;             // USD-quoted → already USD
    if (base === 'USD' && price) return pnl / price;       // USD base (USDJPY…)
    const prices = useTradingStore.getState().prices;
    const usdQ = prices[`USD${quote}`];
    if (usdQ?.bid) return pnl / usdQ.bid;
    const qUsd = prices[`${quote}USD`];
    if (qUsd?.bid) return pnl * qUsd.bid;
    return pnl;
  }, []);

  // Reconcile PENDING-ORDER lines whenever pending orders change: each order
  // gets its entry (BUY blue / SELL purple, dashed) + SL/TP lines. Open
  // positions are NOT drawn here — they live in the native-drag effect below.
  //
  // Drawn with createShape('horizontal_line') — the CORE Charting Library API
  // (Advanced Charts has no order-line API). Shapes span the FULL chart width
  // and stay pinned to the price scale through zoom / scroll / timeframe
  // changes; they're created once, moved with setPoints when a price (e.g.
  // SL/TP) changes, and removed when the order fills or is cancelled. The
  // lines are LOCKED — pending orders are edited from the Orders panel.
  useEffect(() => {
    const w = widgetRef.current;
    if (!chartReady || !w) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart(); } catch { return; }
    if (!chart?.createShape) return;

    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const myPending = (pendingOrders || []).filter((o) => String(o.symbol).toUpperCase() === sym);
    const inst = useTradingStore.getState().instruments.find(
      (i) => String(i.symbol).toUpperCase() === sym,
    );
    const digits = inst?.digits ?? 2;
    const fp = (n: number) => Number(n).toFixed(digits);

    type Desired = { key: string; price: number; color: string; text: string };
    const desired: Desired[] = [];
    for (const o of myPending) {
      const pColor = o.side === 'buy' ? PENDING_BUY_COLOR : PENDING_SELL_COLOR;
      desired.push({ key: `ord-${o.id}`, price: Number(o.price), color: pColor,
        text: `${String(o.order_type || '').toUpperCase()} ${o.side.toUpperCase()} ${fp(Number(o.price))}` });
      if (o.stop_loss != null && Number(o.stop_loss) > 0)
        desired.push({ key: `ord-${o.id}-sl`, price: Number(o.stop_loss), color: SL_COLOR, text: `SL ${fp(Number(o.stop_loss))}` });
      if (o.take_profit != null && Number(o.take_profit) > 0)
        desired.push({ key: `ord-${o.id}-tp`, price: Number(o.take_profit), color: TP_COLOR, text: `TP ${fp(Number(o.take_profit))}` });
    }

    const shapeOpts = (text: string, color: string) => ({
      shape: 'horizontal_line',
      text,
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: color, linestyle: 2, linewidth: 1,
        showLabel: true, textcolor: color, fontsize: 11, bold: true,
        horzLabelsAlign: 'right', vertLabelsAlign: 'middle', showPrice: true,
      },
    });

    // Anchor the horizontal lines at a time that's DEFINITELY on-screen
    // (visible-range start), not "now" — on a closed market "now" can sit past
    // the last bar and some builds reject an off-range time. Horizontal lines
    // span full width regardless, so the exact time only needs to be valid.
    let anchorTime = Math.floor(Date.now() / 1000);
    try {
      const vr = chart.getVisibleRange?.();
      if (vr && Number.isFinite(vr.from)) anchorTime = Math.floor(vr.from);
    } catch { /* keep now */ }
    const wanted = new Set(desired.map((d) => d.key));

    for (const d of desired) {
      const existing = linesRef.current.get(d.key);
      if (!existing) {
        // createShape is ASYNC (Promise<EntityId>). Reserve the key with a
        // 'creating' entry so a re-render mid-create doesn't spawn a duplicate.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry: any = { id: null, price: d.price, creating: true, text: d.text, color: d.color };
        linesRef.current.set(d.key, entry);
        Promise.resolve(chart.createShape({ time: anchorTime, price: d.price }, shapeOpts(d.text, d.color)))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((id: any) => {
            if (linesRef.current.get(d.key) === entry) { entry.id = id; entry.creating = false; }
            else { try { chart.removeEntity(id); } catch { /* closed mid-create */ } }
          })
          .catch(() => { if (linesRef.current.get(d.key) === entry) linesRef.current.delete(d.key); });
      } else if (existing.id != null) {
        // Price moved (order modified) → slide the existing line, no recreate.
        if (existing.price !== d.price) {
          try { chart.getShapeById(existing.id)?.setPoints([{ time: anchorTime, price: d.price }]); } catch { /* ignore */ }
          existing.price = d.price;
        }
        if (d.text !== existing.text || d.color !== existing.color) {
          try {
            chart.getShapeById(existing.id)?.setProperties({ text: d.text, linecolor: d.color, textcolor: d.color });
          } catch { /* keep last-known label on error */ }
          existing.text = d.text;
          existing.color = d.color;
        }
      }
    }

    // Remove lines whose order / SL / TP is gone (or symbol changed).
    for (const [key, entry] of linesRef.current) {
      if (!wanted.has(key)) {
        if (entry && entry.id != null) { try { chart.removeEntity(entry.id); } catch { /* ignore */ } }
        linesRef.current.delete(key);
      }
    }
  }, [pendingOrders, selectedSymbol, chartReady]);

  // Stale-price watchdog. The reconcile above only runs when `positions`
  // changes — i.e. on a tick — so if the feed stalls it simply STOPS and the
  // last P&L freezes silently. This 1s interval independently detects "no tick
  // for the selected symbol in > threshold" and greys the position entry
  // lines. Recovery is automatic: the next tick re-runs the reconcile, which
  // restores the live P&L label + colour.
  useEffect(() => {
    const w = widgetRef.current;
    if (!chartReady || !w) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart(); } catch { return; }
    if (!chart?.getShapeById) return;
    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const inst = useTradingStore.getState().instruments.find(
      (i) => String(i.symbol).toUpperCase() === sym,
    );
    const isCrypto = String(inst?.segment || '').toLowerCase() === 'crypto'
      || /BTC|ETH|USDT|XRP|SOL|LTC|DOGE|BNB/.test(sym);
    const day = new Date().getUTCDay(); // 0 Sun … 6 Sat
    const isWeekend = day === 0 || day === 6;
    const threshold = isCrypto
      ? STALE_MS.crypto
      : (isWeekend ? STALE_MS.weekendClosed : STALE_MS.normal);

    // Track last-tick receive time for THIS symbol via the existing store
    // stream. prices[sym] gets a fresh object reference on every tick.
    let lastPrice = useTradingStore.getState().prices[sym];
    let lastTickAt = Date.now();
    const unsub = useTradingStore.subscribe((state) => {
      const p = state.prices[sym];
      if (p !== lastPrice) { lastPrice = p; lastTickAt = Date.now(); }
    });

    let stale = false;
    const intervalId = setInterval(() => {
      const isStale = Date.now() - lastTickAt > threshold;
      if (isStale === stale) return;          // only act on a transition
      stale = isStale;
      if (!isStale) return;                    // recovery handled by the reconcile
      // Position ENTRY lines carry the live P&L; SL/TP and pending-order
      // labels are static, so leave them untouched.
      for (const e of nativeRef.current) e.setStale();
    }, 1000);

    return () => { clearInterval(intervalId); try { unsub(); } catch { /* ignore */ } };
  }, [chartReady, selectedSymbol]);

  const closePositionFromChart = useCallback((positionId: string) => {
    // Readiness is checked against the RESOLVED id (server may have already
    // confirmed the fill) — `positionId` itself is left untouched below, so
    // ChartExitsPanel's `positions.find` still locates the row under
    // whatever id the store currently displays it as.
    if (!isRealPositionId(readyPositionId(positionId))) { toast('Order still finalizing…'); return; }
    // Review happens in the terminal sidebar (ChartExitsPanel), not a modal.
    const st = useTradingStore.getState();
    st.setChartExitsDraft(null);
    st.setChartCloseRequest(positionId);
  }, []);

  // Stable key of the open positions on this symbol — the button overlay
  // rebuilds only when the position SET changes, not every tick.
  const symU = (selectedSymbol ?? 'EURUSD').toUpperCase();
  const positionsKey = positions
    .filter((p) => String(p.symbol).toUpperCase() === symU)
    .map((p) => `${p.id}:${p.side}:${p.lots}:${p.trade_type === 'copy_trade' ? 'c' : ''}`)
    .join('|');

  // ── Position lines with NATIVE drag (Charting Library drawings) ────────────
  // This build is the Charting Library (createOrderLine/createPositionLine
  // are Trading-Platform-only), so each position is drawn as horizontal_line
  // DRAWINGS: the entry line is locked, while TP / SL lines are UNLOCKED —
  // the library itself handles the drag (smooth, pixel-exact, touch-friendly);
  // we listen to `drawing_event` (points_changed/move) and update the label
  // live (price + projected net P&L). When the drag settles the level lands in
  // `chartExitsDraft` and the terminal sidebar shows the Exits review
  // (Confirm → PUT, Discard → `chartLinesResetNonce` re-syncs the lines).
  //
  // A TradingView-style chip row rides the entry line — [TP] [SL] [qty]
  // [P&L] [✕] — passive HTML positioned each frame from the price scale.
  // TP / SL create a draggable level at a sensible default distance (or
  // open the review if one exists); ✕ opens the close review. Bracket lines
  // exist only while a level exists (no ghost lines cluttering the axis).
  // Shaded entry→TP / entry→SL zones are passive overlay divs.
  const resetNonce = useTradingStore((s) => s.chartLinesResetNonce);
  const nativeRef = useRef<{ setStale: () => void }[]>([]);
  useEffect(() => {
    const w = widgetRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!chartReady || !w || !overlay || !container) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart(); } catch { return; }
    if (!chart?.createShape) return;

    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const inst = useTradingStore.getState().instruments.find((i) => String(i.symbol).toUpperCase() === sym);
    const digits = inst?.digits ?? 2;
    const eps = Number(inst?.pip_size) > 0 ? Number(inst?.pip_size) / 2 : Math.pow(10, -digits) / 2;
    const myPos = useTradingStore.getState().positions.filter((p) => String(p.symbol).toUpperCase() === sym);
    let anchorTime = Math.floor(Date.now() / 1000);
    try { const vr = chart.getVisibleRange?.(); if (vr && Number.isFinite(vr.from)) anchorTime = Math.floor(vr.from); } catch { /* keep now */ }

    const fmtPnl = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
    const pnlColor = (pnl: number) => (Math.abs(pnl) < 0.10 ? BREAKEVEN_COLOR : pnl > 0 ? PROFIT_COLOR : LOSS_COLOR);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const netAt = (p: any, price: number) => {
      const g = computePnlAt(p, price);
      return Number.isFinite(g) ? g - (Number(p.commission) || 0) + (Number(p.swap) || 0) : NaN;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entryText = (p: any) => `${String(p.side).toUpperCase()} ${Number(p.lots)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safe = <T,>(fn: () => T): T | undefined => { try { return fn(); } catch { return undefined; } };

    type Bracket = { kind: 'tp' | 'sl'; id: string | null; price: number | null; zone: HTMLDivElement; draftTimer: number | null; creating: boolean; lastTarget: number | null | undefined; dragging: boolean; labelRaf: number; lastLabel: string };
    type Entry = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p: any; entry: number; entryId: string | null; tp: Bracket | null; sl: Bracket | null;
      chips: HTMLDivElement; pnlChip: HTMLSpanElement; tpBtn: HTMLButtonElement | null; slBtn: HTMLButtonElement | null;
    };
    const entries: Entry[] = [];
    const dragCleanups: (() => void)[] = [];
    const byShape = new Map<string, { e: Entry; b: Bracket | null }>(); // shape id → owner
    let disposed = false;

    // createShape rejects ("Cannot create … shape") while the symbol's data
    // is still loading (we run right after a symbol switch). Retry briefly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createLine = async (price: number, opts: any): Promise<string | null> => {
      for (let attempt = 0; attempt < 12; attempt++) {
        if (disposed) return null;
        try {
          const id = await chart.createShape({ time: anchorTime, price }, opts);
          return id != null ? String(id) : null;
        } catch (err) {
          if (attempt === 11) { console.warn('[chart-lines] createShape failed', opts?.text, err); return null; }
          await new Promise((r) => setTimeout(r, 350));
          try { const vr = chart.getVisibleRange?.(); if (vr && Number.isFinite(vr.from)) anchorTime = Math.floor(vr.from); } catch { /* keep */ }
        }
      }
      return null;
    };
    const mkZone = (rgba: string) => {
      const z = document.createElement('div');
      z.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;background:${rgba};pointer-events:none;visibility:hidden;z-index:4;`;
      overlay.appendChild(z);
      return z;
    };
    const bracketProps = (e: Entry, b: Bracket, price: number) => {
      const color = b.kind === 'tp' ? TP_COLOR : SL_COLOR;
      const n = netAt(e.p, price);
      return {
        linecolor: color, linestyle: 2, linewidth: 1, showLabel: true, bold: true, fontsize: 11,
        textcolor: color, text: `${b.kind.toUpperCase()} ${price.toFixed(digits)}${Number.isFinite(n) ? `  ${fmtPnl(n)}` : ''}`, showPrice: true,
        horzLabelsAlign: 'right', vertLabelsAlign: 'middle',
      };
    };
    /** Make sure a bracket LINE exists at `price` (create lazily, else move). */
    const ensureBracket = async (e: Entry, b: Bracket, price: number) => {
      b.price = price;
      if (b.id) {
        // ONE shape lookup per call, and only repaint the label when its
        // rendered text actually changed — this runs once per frame for the
        // life of a drag, and a redundant setProperties forces the library
        // through a full drawing re-render for nothing.
        const shape = safe(() => chart.getShapeById(b.id));
        safe(() => shape?.setPoints([{ time: anchorTime, price }]));
        const props = bracketProps(e, b, price);
        if (props.text !== b.lastLabel) {
          b.lastLabel = props.text;
          safe(() => shape?.setProperties(props));
        }
        return;
      }
      if (b.creating) return;
      b.creating = true;
      const props = bracketProps(e, b, price);
      const id = await createLine(price, {
        shape: 'horizontal_line', text: props.text,
        lock: false, disableSelection: false, disableSave: true, disableUndo: true,
        overrides: props,
      });
      b.creating = false;
      if (disposed || b.price == null) { if (id) safe(() => chart.removeEntity(id)); return; }
      b.id = id;
      b.lastLabel = props.text;
      if (id) byShape.set(id, { e, b });
      // Level may have moved while the shape was being created.
      if (Math.abs(b.price - price) > eps) safe(() => chart.getShapeById(id)?.setPoints([{ time: anchorTime, price: b.price! }]));
    };
    const dropBracket = (b: Bracket) => {
      b.price = null;
      b.lastLabel = '';
      if (b.id) { byShape.delete(b.id); safe(() => chart.removeEntity(b.id)); b.id = null; }
      b.zone.style.visibility = 'hidden';
    };
    const setDraftLevel = (e: Entry, b: Bracket, value: number | null | undefined) => {
      const st = useTradingStore.getState();
      st.setChartCloseRequest(null);
      const prev = st.chartExitsDraft?.positionId === e.p.id ? st.chartExitsDraft : null;
      const next: ChartExitsDraft = { positionId: String(e.p.id), takeProfit: prev?.takeProfit, stopLoss: prev?.stopLoss };
      if (b.kind === 'tp') next.takeProfit = value; else next.stopLoss = value;
      st.setChartExitsDraft(next);
    };
    /** Paint one TP/SL chip. `on` = a level exists for it right now. */
    const styleLevelChip = (btn: HTMLButtonElement | null, on: boolean, color: string, title: string) => {
      if (!btn) return;
      btn.style.background = on ? color : 'rgba(12,14,20,0.92)';
      btn.style.color = on ? '#08131a' : color;
      btn.style.borderColor = color;
      btn.style.boxShadow = on
        ? `0 1px 5px rgba(0,0,0,.6), 0 0 0 1px ${color}55`
        : '0 1px 5px rgba(0,0,0,.6)';
      btn.title = title;
    };
    const refreshChips = (e: Entry) => {
      const pnl = netPnl(e.p);
      e.pnlChip.textContent = fmtPnl(pnl);
      e.pnlChip.style.color = pnlColor(pnl);
      const tpOn = !!e.tp?.price, slOn = !!e.sl?.price;
      styleLevelChip(e.tpBtn, tpOn, TP_COLOR, tpOn ? 'Drag to move take profit' : 'Drag down/up to set take profit — or click to add one');
      styleLevelChip(e.slBtn, slOn, SL_COLOR, slOn ? 'Drag to move stop loss' : 'Drag down/up to set stop loss — or click to add one');
    };

    // ── Geometry (passive: zones + chip row positioning) ──
    type Geo = { top: number; bottom: number; h: number; log: boolean };
    const geom = (): Geo | null => {
      try {
        const pane = chart.getPanes?.()[0];
        const ps = pane?.getMainSourcePriceScale?.();
        if (!ps) return null;
        const mode = ps.getMode?.() ?? 0;
        if (mode !== 0 && mode !== 1) return null;
        const range = ps.getVisiblePriceRange?.();
        const h = pane?.getHeight?.() || 0;
        if (!range || !(h > 0) || !(range.to > range.from)) return null;
        if (mode === 1 && !(range.from > 0)) return null;
        return { top: Number(range.to), bottom: Number(range.from), h: Number(h), log: mode === 1 };
      } catch { return null; }
    };
    const paneY = (price: number, g: Geo): number => {
      if (g.log) { if (!(price > 0)) return NaN; const lt = Math.log(g.top), lb = Math.log(g.bottom); return (g.h * (lt - Math.log(price))) / (lt - lb); }
      return (g.h * (g.top - price)) / (g.top - g.bottom);
    };
    /**
     * Price at `y`, measured RELATIVE to a known (price, y) pair rather than
     * to the top of the pane. Only the scale is needed, so this keeps working
     * when paneTop() cannot find the pane — the case where an absolute
     * mapping silently produced no drag at all.
     */
    const priceFromAnchor = (y: number, anchorY: number, anchorPrice: number, g: Geo): number => {
      const dy = y - anchorY;
      if (g.log) {
        if (!(anchorPrice > 0)) return NaN;
        const span = Math.log(g.top) - Math.log(g.bottom);
        return Math.exp(Math.log(anchorPrice) - (dy * span) / g.h);
      }
      return anchorPrice - (dy * (g.top - g.bottom)) / g.h;
    };
    const paneTop = (paneH: number): number | null => {
      try {
        const rootRect = container.getBoundingClientRect();
        let best: number | null = null; let bestDiff = 40;
        const scan = (root: ParentNode, extraTop: number) => {
          root.querySelectorAll('canvas').forEach((c) => {
            const r = (c as HTMLCanvasElement).getBoundingClientRect();
            if (r.width < 100) return;
            const diff = Math.abs(r.height - paneH);
            if (diff < bestDiff) { bestDiff = diff; best = r.top + extraTop - rootRect.top; }
          });
        };
        scan(container, 0);
        if (best == null) {
          container.querySelectorAll('iframe').forEach((f) => {
            try { const doc = (f as HTMLIFrameElement).contentDocument; if (doc) scan(doc, (f as HTMLIFrameElement).getBoundingClientRect().top); } catch { /* cross-origin */ }
          });
        }
        return best;
      } catch { return null; }
    };
    // paneTop() forces layout (getBoundingClientRect on every chart canvas)
    // and the rAF loop below wants it EVERY frame — competing with the
    // chart's own redraws, exactly while a drag has the main thread busiest.
    // The offset only moves on layout changes, so serve it from a cache
    // keyed on the pane/container dimensions with a short TTL: worst case a
    // rare un-resized layout shift misplaces chips for a quarter second.
    let ptCache: { v: number | null; at: number; h: number; cw: number; ch: number } | null = null;
    const paneTopCached = (paneH: number): number | null => {
      const cw = container.clientWidth, ch = container.clientHeight;
      const t = performance.now();
      if (ptCache && ptCache.h === paneH && ptCache.cw === cw && ptCache.ch === ch && t - ptCache.at < 250) return ptCache.v;
      const v = paneTop(paneH);
      ptCache = { v, at: t, h: paneH, cw, ch };
      return v;
    };
    // Dev-only handle so UI tests can map prices → pixels.
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __scChart?: unknown }).__scChart = { geom, paneY, paneTop: () => { const g = geom(); return g ? paneTop(g.h) : null; }, container };
    }
    /** Default distance for a freshly added level: ~12% of the visible range. */
    const defaultLevel = (e: Entry, kind: 'tp' | 'sl'): number => {
      const g = geom();
      const span = g ? (g.top - g.bottom) * 0.12 : e.entry * 0.005;
      const up = (e.p.side === 'buy') === (kind === 'tp');
      return up ? e.entry + span : e.entry - span;
    };

    const mkChip = (txt: string, bg: string, fg: string, title: string, onClick?: () => void) => {
      const el = document.createElement(onClick ? 'button' : 'span');
      if (onClick) (el as HTMLButtonElement).type = 'button';
      el.textContent = txt;
      el.title = title;
      el.style.cssText =
        `display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;height:20px;min-width:22px;padding:0 7px;border:1px solid transparent;border-radius:5px;`
        + `font:700 10.5px -apple-system,Segoe UI,Roboto,sans-serif;line-height:1;letter-spacing:.02em;white-space:nowrap;`
        + `background:${bg};color:${fg};box-shadow:0 1px 4px rgba(0,0,0,.55);pointer-events:auto;${onClick ? 'cursor:pointer;' : ''}`;
      if (onClick) {
        el.onmouseenter = () => { el.style.filter = 'brightness(1.15)'; };
        el.onmouseleave = () => { el.style.filter = 'none'; };
        (el as HTMLButtonElement).onclick = (ev) => { ev.stopPropagation(); ev.preventDefault(); onClick(); };
        (el as HTMLButtonElement).onpointerdown = (ev) => ev.stopPropagation();
      }
      return el;
    };

    /** Commit a dragged level: onto the entry line = clear it, else set it. */
    const commitLevel = (e: Entry, b: Bracket, price: number) => {
      if (!isRealPositionId(readyPositionId(e.p.id))) { toast('Order still finalizing…'); return; }
      if (Math.abs(price - e.entry) <= eps) {
        const wasSet = b.kind === 'tp' ? Number(e.p.take_profit) > 0 : Number(e.p.stop_loss) > 0;
        dropBracket(b);
        b.lastTarget = null;
        setDraftLevel(e, b, wasSet ? null : undefined);
      } else {
        b.lastTarget = price;
        setDraftLevel(e, b, price);
      }
      refreshChips(e);
    };

    /**
     * Vertical drag on a TP/SL chip. Pointer Events + capture so the gesture
     * survives the pointer leaving the 22px chip (it always does) and works
     * with touch and pen, not just mouse.
     */
    const attachLevelDrag = (e: Entry, b: Bracket, btn: HTMLButtonElement, onTap: () => void) => {
      const DRAG_THRESHOLD = 3; // px — below this it is a tap, not a drag
      let pressed = false, moved = false, startY = 0, handled = false;
      // The chart's panes live inside an IFRAME (paneTop() scans for it).
      // Without pointer capture, the moment the cursor leaves the chip's
      // small hit pad it is over that iframe, and every pointer event then
      // dispatches inside the IFRAME's document — the parent window hears
      // nothing and the gesture dies silently. A slow drag survived (the
      // 3px threshold was crossed while still over the hit pad); a natural
      // quick flick jumped straight onto the iframe and was dead — the
      // "takes five attempts to grab" report. setPointerCapture retargets
      // the whole gesture to the chip; the shield is the fallback when
      // capture is unavailable, and also keeps the iframe from reacting
      // to the pointer mid-drag.
      let pointerId = -1;
      let shield: HTMLDivElement | null = null;
      const mountShield = () => {
        if (shield) return;
        shield = document.createElement('div');
        shield.style.cssText = 'position:fixed;inset:0;z-index:2147483000;cursor:ns-resize;background:transparent;touch-action:none;';
        document.body.appendChild(shield);
      };
      // Largest vertical travel this gesture, tracked even when the drag
      // could not be mapped to a price — see the release handler.
      let maxDelta = 0;
      // GRAB OFFSET. The anchor is the exact pixel pressed paired with the
      // level's CURRENT price, so the level moves relative to where it was
      // rather than teleporting under the cursor. Anchoring on the chip's
      // centre and the entry price (as this did) jumped twice: once by
      // however far off-centre the press landed in the hit pad, and again —
      // by the whole entry-to-level distance — when re-dragging a level that
      // already sat somewhere else.
      let anchorY = 0, anchorPrice = 0;
      // Latest pointer position; the chart writes happen once per frame from
      // rAF, not once per pointermove. A high-polling mouse fires several
      // moves per frame, and each one used to do a geom() read plus two
      // getShapeById lookups, setPoints, setProperties and a P&L recompute.
      let lastClientY = 0;
      let rafId = 0;
      // The chip only needs restyling the first time a level appears.
      let chipLit = false;
      // Scale captured at press time. geom() reads the live chart and returns
      // null while the pane is mid-rescale; falling back to the captured
      // value keeps a gesture alive instead of dropping it, which is what
      // made the grab feel like it only caught on the third or fourth try.
      let g0: Geo | null = null;

      btn.style.cursor = 'ns-resize';
      // Stop the browser turning the gesture into a scroll/pan on touch, and
      // stop a fast drag from selecting the chip's label text.
      btn.style.touchAction = 'none';
      btn.style.userSelect = 'none';
      btn.style.webkitUserSelect = 'none';

      // The chip itself is only 20px tall and drifts vertically as the chart
      // rescales, so pressing it exactly is fiddly — especially on touch.
      // A transparent child stretches the press target to ~36x(w+12) without
      // changing the chip's layout or appearance; events on it bubble to the
      // button just the same.
      btn.style.position = 'relative';
      const hit = document.createElement('span');
      hit.style.cssText = 'position:absolute;left:-6px;right:-6px;top:-8px;bottom:-8px;border-radius:9px;';
      hit.setAttribute('aria-hidden', 'true');
      btn.appendChild(hit);

      // Move/up are bound on WINDOW for the life of the gesture rather than on
      // the chip. A 22px chip is left within the first few pixels of any drag,
      // so element-bound listeners only survive via setPointerCapture — and if
      // capture is unavailable or the pane's own handlers get in the way, the
      // gesture dies silently. Window listeners need neither.
      /** Price under the last pointer sample, unrounded. */
      const priceAtPointer = (): number | null => {
        // Prefer the live scale, but never abandon the gesture because a
        // single sample came back null.
        const g = geom() ?? g0;
        if (!g || !(anchorPrice > 0)) return null;
        g0 = g;
        const price = priceFromAnchor(lastClientY, anchorY, anchorPrice, g);
        return Number.isFinite(price) && price > 0 ? price : null;
      };

      // One chart write per frame, regardless of pointer rate.
      const flush = () => {
        rafId = 0;
        if (!pressed) return;
        const price = priceAtPointer();
        if (price == null) return;
        // Re-anchor on the pair just computed, so the NEXT delta is measured
        // from here with whatever scale is live then. With a single fixed
        // press-time anchor, an auto-scale rescale mid-drag (every tick can
        // rescale the pane on a moving market) remapped the WHOLE travelled
        // distance with the new scale — the line jumped away from the
        // pointer the instant the range changed. Per-frame deltas are a
        // pixel or two, so a rescale between frames is imperceptible.
        anchorY = lastClientY;
        anchorPrice = price;
        // RAW price — deliberately NOT rounded to `digits` here. Snapping the
        // visual position to the tick grid mid-drag is what made the line
        // feel sticky: it only stepped once the cursor had travelled a whole
        // tick. Rounding happens once, on release, for the committed value.
        void ensureBracket(e, b, price);
        if (!chipLit) { refreshChips(e); chipLit = true; }
      };

      const onMove = (ev: PointerEvent) => {
        if (!pressed) return;
        const delta = Math.abs(ev.clientY - startY);
        if (delta > maxDelta) maxDelta = delta;
        if (!moved && delta < DRAG_THRESHOLD) return;
        if (!isRealPositionId(readyPositionId(e.p.id))) return;
        moved = true;
        b.dragging = true;
        mountShield();
        ev.preventDefault();
        // We own the pointer for the rest of this gesture: stop the event
        // here (window, capture phase) so the chart's own crosshair
        // tracking and hover hit-testing don't also run on every move —
        // that per-event library work alongside our redraws is what read
        // as stutter.
        ev.stopPropagation();
        // Cheap: record and coalesce. All chart work happens in `flush`.
        lastClientY = ev.clientY;
        if (!rafId) rafId = window.requestAnimationFrame(flush);
      };

      const detach = () => {
        if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
        if (shield) { shield.remove(); shield = null; }
        if (pointerId >= 0) { try { btn.releasePointerCapture(pointerId); } catch { /* already released */ } pointerId = -1; }
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
      };

      function onUp(ev: PointerEvent) {
        if (!pressed) return;
        pressed = false;
        detach();
        const wasDrag = moved;
        b.dragging = false;
        // Swallow the click this pointer sequence is about to synthesise.
        handled = true;
        window.setTimeout(() => { handled = false; }, 400);
        if (!wasDrag) {
          // Real vertical travel that never became a drag must NOT fall
          // through to the tap: that plants a level at the default distance,
          // nowhere near the pointer, which reads as the drag misfiring.
          // The only way to get here with travel ≥ threshold is the
          // readiness gate in onMove — so say that, instead of a silent
          // dead gesture the user retries three times before giving up on.
          if (maxDelta >= DRAG_THRESHOLD) {
            if (!isRealPositionId(readyPositionId(e.p.id))) toast('Order still finalizing…');
            return;
          }
          onTap();
          return;
        }
        ev.preventDefault();
        // The release ends OUR gesture — don't let the chart also treat it
        // as a click/selection on whatever sits under the cursor.
        ev.stopPropagation();
        // Land on the pointer's RELEASE position rather than the last move
        // sample the rAF loop happened to render, then snap to the tick grid
        // ONCE.
        lastClientY = ev.clientY;
        const raw = priceAtPointer() ?? b.price;
        if (raw == null) return;
        const settled = Number(raw.toFixed(digits));
        void ensureBracket(e, b, settled);
        commitLevel(e, b, settled);
      }

      function onCancel() {
        const wasDrag = moved;
        pressed = false; moved = false; b.dragging = false;
        detach();
        // A cancelled gesture (OS gesture / tab switch mid-drag) must not
        // leave the preview line at a level that was never drafted — the
        // store sync skips it (lastTarget unchanged), so it would sit there
        // looking committed while nothing saves. Snap back to the last
        // committed target, or remove a preview that never had one.
        if (!wasDrag) return;
        const back = b.lastTarget ?? null;
        if (back != null) void ensureBracket(e, b, back);
        else if (b.id || b.price != null) dropBracket(b);
        refreshChips(e);
      }

      btn.onpointerdown = (ev) => {
        // Keep the press off the chart, or the pane pans under the drag.
        ev.stopPropagation();
        ev.preventDefault();
        pressed = true; moved = false; startY = ev.clientY; maxDelta = 0;
        chipLit = false;
        // Anchor on the EXACT pixel pressed, paired with the level's current
        // price — that pairing is the grab offset. Pressing anywhere in the
        // hit pad, or grabbing a level that already sits far from the entry
        // line, now moves it from where it is instead of snapping it to the
        // cursor. A level that does not exist yet starts at the entry line,
        // which is where the chip itself sits.
        anchorY = ev.clientY;
        lastClientY = ev.clientY;
        anchorPrice = b.price != null && b.price > 0 ? b.price : e.entry;
        g0 = geom();
        // Capture from the very first sample: even the pre-threshold moves
        // must reach US, not the chart iframe, or a fast flick never
        // crosses the threshold at all.
        pointerId = ev.pointerId;
        try { btn.setPointerCapture(ev.pointerId); } catch { /* window listeners + shield still cover it */ }
        // pointermove is not passive by default, but say so explicitly: the
        // handler calls preventDefault and must never be silently ignored.
        window.addEventListener('pointermove', onMove, { capture: true, passive: false });
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onCancel, true);
      };

      // Click fallback. Pointer events are the primary path, but if they are
      // swallowed by whatever is layered over the pane, a plain click is the
      // one thing that has always worked — setting a level must never depend
      // solely on pointerup firing. `handled` stops a completed pointer
      // gesture from firing the action a second time.
      btn.onclick = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (handled || moved) return;
        pressed = false;
        detach();
        onTap();
      };

      // Torn down with the overlay; listeners are only ever attached for the
      // duration of a gesture, so a stray teardown mid-drag cannot leak them.
      dragCleanups.push(detach);
    };

    (async () => {
      for (const p of myPos) {
        const side = String(p.side).toUpperCase();
        const sideColor = side === 'BUY' ? CHART_BUY_COLOR : CHART_SELL_COLOR;
        const entry = Number(p.open_price) || 0;
        const isCopy = p.trade_type === 'copy_trade';

        // Chip row (HTML, passive positioning) — built first so it shows instantly.
        const chips = document.createElement('div');
        chips.style.cssText = 'position:absolute;display:flex;gap:4px;align-items:center;transform:translateY(-50%);pointer-events:auto;visibility:hidden;z-index:6;';
        const e: Entry = { p, entry, entryId: null, tp: null, sl: null, chips, pnlChip: document.createElement('span'), tpBtn: null, slBtn: null };
        if (!isCopy) {
          e.tp = { kind: 'tp', id: null, price: null, zone: mkZone('rgba(20,184,166,0.11)'), draftTimer: null, creating: false, lastTarget: undefined, dragging: false, labelRaf: 0, lastLabel: '' };
          e.sl = { kind: 'sl', id: null, price: null, zone: mkZone('rgba(239,68,68,0.11)'), draftTimer: null, creating: false, lastTarget: undefined, dragging: false, labelRaf: 0, lastLabel: '' };
          const tpTap = () => {
            if (!isRealPositionId(readyPositionId(p.id))) { toast('Order still finalizing…'); return; }
            const st = useTradingStore.getState();
            const d = st.chartExitsDraft?.positionId === p.id ? st.chartExitsDraft : null;
            const existing = d?.takeProfit !== undefined ? d.takeProfit : (Number(e.p.take_profit) > 0 ? Number(e.p.take_profit) : null);
            if (existing != null) { st.setChartCloseRequest(null); st.setChartExitsDraft({ positionId: String(p.id), takeProfit: d?.takeProfit, stopLoss: d?.stopLoss }); return; }
            setDraftLevel(e, e.tp!, defaultLevel(e, 'tp'));
          };
          const slTap = () => {
            if (!isRealPositionId(readyPositionId(p.id))) { toast('Order still finalizing…'); return; }
            const st = useTradingStore.getState();
            const d = st.chartExitsDraft?.positionId === p.id ? st.chartExitsDraft : null;
            const existing = d?.stopLoss !== undefined ? d.stopLoss : (Number(e.p.stop_loss) > 0 ? Number(e.p.stop_loss) : null);
            if (existing != null) { st.setChartCloseRequest(null); st.setChartExitsDraft({ positionId: String(p.id), takeProfit: d?.takeProfit, stopLoss: d?.stopLoss }); return; }
            setDraftLevel(e, e.sl!, defaultLevel(e, 'sl'));
          };
          e.tpBtn = mkChip('TP', 'rgba(12,14,20,0.92)', TP_COLOR, 'Add take profit', tpTap) as HTMLButtonElement;
          e.slBtn = mkChip('SL', 'rgba(12,14,20,0.92)', SL_COLOR, 'Add stop loss', slTap) as HTMLButtonElement;
          attachLevelDrag(e, e.tp!, e.tpBtn, tpTap);
          attachLevelDrag(e, e.sl!, e.slBtn, slTap);
          chips.appendChild(e.tpBtn); chips.appendChild(e.slBtn);
        }
        chips.appendChild(mkChip(String(Number(p.lots)), sideColor, '#fff', `${side} ${Number(p.lots)} lots @ ${entry.toFixed(digits)}`));
        e.pnlChip = mkChip('…', 'rgba(10,10,10,0.92)', '#f5f5f5', 'Open P&L (net)') as HTMLSpanElement;
        e.pnlChip.style.border = `1px solid ${sideColor}`;
        chips.appendChild(e.pnlChip);
        chips.appendChild(mkChip('✕', 'rgba(10,10,10,0.92)', '#f5f5f5', `Close ${side} ${Number(p.lots)} ${sym} at market`, () => closePositionFromChart(p.id)));
        overlay.appendChild(chips);
        refreshChips(e);
        entries.push(e);

        // Entry line — locked (not draggable); click also opens the close review.
        const entryId = await createLine(entry, {
          shape: 'horizontal_line', text: entryText(p),
          lock: true, disableSelection: false, disableSave: true, disableUndo: true,
          overrides: { linecolor: sideColor, linestyle: 0, linewidth: 2, showLabel: true, textcolor: sideColor, fontsize: 11, bold: true, horzLabelsAlign: 'left', vertLabelsAlign: 'middle', showPrice: true },
        });
        if (disposed) { if (entryId) safe(() => chart.removeEntity(entryId)); return; }
        e.entryId = entryId;
        if (e.entryId) byShape.set(e.entryId, { e, b: null });

        // Existing levels → lines.
        if (e.tp) { const v = Number(p.take_profit) > 0 ? Number(p.take_profit) : null; e.tp.lastTarget = v; if (v != null) await ensureBracket(e, e.tp, v); }
        if (e.sl) { const v = Number(p.stop_loss) > 0 ? Number(p.stop_loss) : null; e.sl.lastTarget = v; if (v != null) await ensureBracket(e, e.sl, v); }
        refreshChips(e);
      }
      nativeRef.current = entries.map((x) => ({
        setStale: () => { if (x.entryId) safe(() => chart.getShapeById(x.entryId)?.setProperties({ linecolor: STALE_COLOR, textcolor: STALE_COLOR })); },
      }));
    })();

    // Drag handling — the library moves the drawing; we react to its events.
    const onDrawing = (id: unknown, type: unknown) => {
      const owner = byShape.get(String(id));
      if (!owner) return;
      const { e, b } = owner;
      const t = String(type);
      if (!b) {
        // closePositionFromChart owns the readiness check (and its toast) —
        // duplicating it here with the unresolved id would silently swallow
        // a click during the optimistic window instead of opening the
        // review or explaining why not.
        if (t === 'click') closePositionFromChart(e.p.id);
        return;
      }
      if (t !== 'points_changed' && t !== 'move') return;
      const pts = safe(() => chart.getShapeById(b.id)?.getPoints?.());
      const px = Number(pts?.[0]?.price);
      if (!(px > 0)) return;
      // Live label while dragging; the draft lands once the drag settles.
      b.price = px;
      // Claim the line for the whole gesture, not just the 220ms settle
      // window. The store sync skips dragging brackets, and between two drag
      // events `draftTimer` can fire and leave the line unguarded — a sync
      // landing in that gap calls setPoints and snaps the line out from under
      // the pointer. Cleared once the level has settled below.
      b.dragging = true;
      // Label repaint once per FRAME, not once per event: a high-polling
      // mouse fires several 'move' events per frame, and a setProperties on
      // each one made the library's own line drag stutter under our feet.
      if (!b.labelRaf) {
        b.labelRaf = window.requestAnimationFrame(() => {
          b.labelRaf = 0;
          if (b.price == null || !b.id) return;
          const props = bracketProps(e, b, b.price);
          if (props.text !== b.lastLabel) {
            b.lastLabel = props.text;
            safe(() => chart.getShapeById(b.id)?.setProperties(props));
          }
        });
      }
      if (b.draftTimer) window.clearTimeout(b.draftTimer);
      b.draftTimer = window.setTimeout(() => {
        b.draftTimer = null;
        b.dragging = false;
        if (!isRealPositionId(readyPositionId(e.p.id))) { toast('Order still finalizing…'); return; }
        if (Math.abs(px - e.entry) <= eps) {
          // Dropped onto the entry line = remove the level.
          const wasSet = b.kind === 'tp' ? Number(e.p.take_profit) > 0 : Number(e.p.stop_loss) > 0;
          dropBracket(b);
          b.lastTarget = null;
          setDraftLevel(e, b, wasSet ? null : undefined);
        } else {
          b.lastTarget = px;
          setDraftLevel(e, b, px);
        }
        refreshChips(e);
      }, 220);
    };
    try { w.subscribe('drawing_event', onDrawing); } catch { /* older builds */ }

    // Sync from the store without recreating entry lines: live P&L chip,
    // server SL/TP after a confirmed PUT / refresh, levels typed in the
    // sidebar (draft) → create / move / drop bracket lines.
    let lastSync = 0;
    let syncTimer: number | null = null;
    const applySync = (st: ReturnType<typeof useTradingStore.getState>) => {
      lastSync = Date.now();
      for (const e of entries) {
        const lp = st.positions.find((x) => x.id === e.p.id);
        if (!lp) continue;
        e.p = lp;
        const d = st.chartExitsDraft?.positionId === lp.id ? st.chartExitsDraft : null;
        for (const b of [e.tp, e.sl]) {
          if (!b || b.draftTimer || b.dragging) continue; // mid-drag — leave it alone
          const dv = d ? (b.kind === 'tp' ? d.takeProfit : d.stopLoss) : undefined;
          const sv = b.kind === 'tp' ? lp.take_profit : lp.stop_loss;
          const target = dv !== undefined ? dv : (sv != null && Number(sv) > 0 ? Number(sv) : null);
          const same = (target == null && b.lastTarget == null) || (target != null && b.lastTarget != null && Math.abs(target - b.lastTarget) <= eps);
          if (same) continue; // nothing new from the store → never touch a line the user may be dragging
          b.lastTarget = target;
          if (target == null) { if (b.price != null || b.id) dropBracket(b); }
          else void ensureBracket(e, b, target);
        }
        refreshChips(e);
      }
    };
    const unsub = useTradingStore.subscribe((st) => {
      const wait = 250 - (Date.now() - lastSync);
      if (wait <= 0) { applySync(st); return; }
      // Coalesce onto the trailing edge so the newest state still lands.
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        applySync(useTradingStore.getState());
      }, wait);
    });

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (entries.length === 0) return;
      const g = geom();
      const top = g ? paneTopCached(g.h) : null;
      const h = container.clientHeight || 0;
      const rightPx = Math.min(96, Math.max(8, container.clientWidth - 120));
      for (const e of entries) {
        if (!g || top == null) {
          // Fallback: show chips at a default position if geometry fails
          e.chips.style.top = '50%';
          e.chips.style.right = `${rightPx}px`;
          e.chips.style.visibility = 'visible';
          for (const b of [e.tp, e.sl]) if (b) b.zone.style.visibility = 'hidden';
          continue;
        }
        const ey = paneY(e.entry, g) + top;
        if (ey > 8 && ey < h - 8) { e.chips.style.top = `${ey}px`; e.chips.style.right = `${rightPx}px`; e.chips.style.visibility = 'visible'; }
        else e.chips.style.visibility = 'hidden';
        for (const b of [e.tp, e.sl]) {
          if (!b) continue;
          if (b.price == null) { b.zone.style.visibility = 'hidden'; continue; }
          const zy = paneY(b.price, g) + top;
          const zTop = Math.min(ey, zy), ht = Math.abs(ey - zy);
          if (!(ht >= 1)) { b.zone.style.visibility = 'hidden'; continue; }
          b.zone.style.top = `${zTop}px`; b.zone.style.height = `${ht}px`; b.zone.style.visibility = 'visible';
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      try { w.unsubscribe('drawing_event', onDrawing); } catch { /* ignore */ }
      try { unsub(); } catch { /* ignore */ }
      for (const fn of dragCleanups) { try { fn(); } catch { /* ignore */ } }
      if (syncTimer) { window.clearTimeout(syncTimer); syncTimer = null; }
      for (const e of entries) {
        if (e.entryId) safe(() => chart.removeEntity(e.entryId));
        safe(() => overlay.removeChild(e.chips));
        for (const b of [e.tp, e.sl]) {
          if (!b) continue;
          if (b.draftTimer) window.clearTimeout(b.draftTimer);
          if (b.labelRaf) window.cancelAnimationFrame(b.labelRaf);
          if (b.id) safe(() => chart.removeEntity(b.id));
          safe(() => overlay.removeChild(b.zone));
        }
      }
      nativeRef.current = [];
    };
  }, [chartReady, selectedSymbol, positionsKey, resetNonce, computePnlAt, closePositionFromChart]);

  return (
    <div className={clsx('relative w-full h-full min-h-[200px] min-w-0 bg-bg-base')} data-tv-chart-root>
      <div id={CONTAINER_ID} ref={containerRef} className="h-full w-full min-h-[200px]" />

      {/* No live quote for this instrument on this environment — say so
          instead of a silent empty pane, and offer the first symbol that IS
          quoted. In production every instrument is fed, so this never shows. */}
      <NoFeedNotice symbol={selectedSymbol ?? 'EURUSD'} />

      {/* Loader until the chart is ready (covers the library load). */}
      {!chartReady && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: theme === 'dark' ? '#000000' : '#ffffff' }}
        >
          <div
            className="animate-spin"
            style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(242,106,31,0.25)', borderTopColor: '#f26a1f' }}
          />
        </div>
      )}

      {/* On-chart quick-trade: live SELL / BUY prices + spread; places a market
          order on the active account. Sits BELOW the chart's symbol legend /
          OHLC row so it doesn't cover them. Hidden on the mobile /chart WebView
          (the app has its own native trade panel). */}
      {showTradeWidget && (
        <div className="absolute top-[92px] left-2 z-30 pointer-events-none">
          <ChartTradeWidget />
        </div>
      )}

      {/* Overlay layer for the per-position [SL] [TP] [✕] button groups, the
          persistent entry→SL / entry→TP shaded zones, and the drag previews —
          all positioned imperatively by the rAF loop above. */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-30 overflow-hidden" />

    </div>
  );
}

export default memo(TradingViewChartInner);

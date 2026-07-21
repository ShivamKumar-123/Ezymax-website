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
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { createDatafeed, type DatafeedInstrument } from '@/lib/chart/datafeed';
import { loadChartLibrary } from '@/lib/chart/loadChartLibrary';
import { api } from '@/lib/api/client';
import { netPnl } from '@/lib/pnl';
import toast from 'react-hot-toast';
import { ChartTradeWidget } from '@/components/charts/ChartTradeWidget';

// Tell the React Native app (when this runs inside its WebView) that an SL/TP
// drag is in progress, so it can freeze the surrounding ScrollView — otherwise
// the page scrolls instead of the line dragging. No-op in a normal browser.
function postDragToNative(active: boolean) {
  try {
    (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } })
      .ReactNativeWebView?.postMessage(JSON.stringify({ type: 'chart:drag', active }));
  } catch { /* ignore */ }
}

// A freshly-opened MARKET position shows optimistically with a temporary id
// ("optim-…") until the server row arrives with a real UUID. SL/TP/close must
// NOT run against that temp id — the backend rejects it ("Input should be a
// valid UUID"). Only real UUIDs get on-chart SL/TP controls.
function isRealPositionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
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

// Where the on-chart [SL] [TP] [✕] group sits, measured from the chart's RIGHT
// edge: just left of each line's right-axis label so the buttons read as part
// of the line's pill instead of hiding behind the left drawing toolbar.
const CLOSE_BTN_RIGHT_PX = 268;

// In-app dialog replacing window.confirm / window.prompt for the on-chart
// trade buttons (close ✕, SL/TP drag + type-a-price). `input` switches it to
// prompt mode (type-a-price).
type ChartDialog = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  input?: { defaultValue: string; placeholder: string };
  onConfirm: (value?: string) => void;
} | null;

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
  // line key -> { id, price, creating, text, color, textColor, pnl, propAt }.
  // Keys: <posId> (entry), <posId>-sl, <posId>-tp, ord-<id>, ord-<id>-sl/-tp.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linesRef = useRef<Map<string, any>>(new Map());

  const [dialog, setDialog] = useState<ChartDialog>(null);
  const [dialogValue, setDialogValue] = useState('');
  const openDialog = useCallback((d: NonNullable<ChartDialog>) => {
    setDialogValue(d.input?.defaultValue ?? '');
    setDialog(d);
  }, []);
  // Live handle for the imperative overlay (built in a []-ish effect below).
  const openDialogRef = useRef(openDialog);
  openDialogRef.current = openDialog;

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
        theme,
        autosize: true,
        fullscreen: false,
        toolbar_bg: theme === 'dark' ? '#0b0e11' : '#ffffff',
        loading_screen: { backgroundColor: theme === 'dark' ? '#0b0e11' : '#ffffff' },
        disabled_features: ['use_localstorage_for_settings', 'symbol_search_hot_key'],
        enabled_features: ['hide_left_toolbar_by_default'],
        overrides: theme === 'dark'
          ? { 'paneProperties.background': '#0b0e11', 'paneProperties.backgroundType': 'solid', 'scalesProperties.textColor': '#b7bdc6' }
          : {},
      });
      try {
        widgetRef.current.onChartReady(() => {
          readyRef.current = true;
          setChartReady(true);
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

  // Reconcile chart lines whenever positions / pending orders change. Each open
  // position gets an ENTRY line whose LINE colour is fixed by side (BUY blue /
  // SELL red) and whose LABEL shows the LIVE P&L coloured by profit/loss
  // (blue/red/gray), throttled to 500ms; plus SL (amber) / TP (teal) labelled
  // with the projected P&L at that level. Each pending order gets its entry
  // (BUY blue / SELL purple, dashed) + SL/TP.
  //
  // Drawn with createShape('horizontal_line') — the CORE Charting Library API
  // (Advanced Charts has no order-line API). Shapes span the FULL chart width
  // and stay pinned to the price scale through zoom / scroll / timeframe
  // changes; they're created once, moved with setPoints when a price (e.g.
  // SL/TP) changes, and removed when the position/order closes. The lines are
  // LOCKED — SL/TP is edited via the [SL]/[TP] buttons on the entry line (drag
  // or click-to-type), never by dragging the line shape itself.
  useEffect(() => {
    const w = widgetRef.current;
    if (!chartReady || !w) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart(); } catch { return; }
    if (!chart?.createShape) return;

    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
    const myPos = positions.filter((p) => String(p.symbol).toUpperCase() === sym);
    const myPending = (pendingOrders || []).filter((o) => String(o.symbol).toUpperCase() === sym);
    const inst = useTradingStore.getState().instruments.find(
      (i) => String(i.symbol).toUpperCase() === sym,
    );
    const digits = inst?.digits ?? 2;
    const cs = Number(inst?.contract_size) || 100000;
    const fp = (n: number) => Number(n).toFixed(digits);

    // P&L → LABEL colour: blue in profit, red in loss, gray near break-even.
    const pnlColor = (pnl: number) =>
      Math.abs(pnl) < 0.10 ? BREAKEVEN_COLOR : pnl > 0 ? PROFIT_COLOR : LOSS_COLOR;

    // `color` is the LINE colour, `textColor` the LABEL colour. For position
    // entry lines they differ: the line is fixed by side (BUY blue / SELL red)
    // while the label tracks P&L (profit blue / loss red / gray). SL/TP/pending
    // omit textColor → it falls back to the line colour.
    type Desired = { key: string; price: number; color: string; textColor?: string; text: string; dashed: boolean; pnl?: number };
    const desired: Desired[] = [];

    // ── Open positions: entry line labelled with LIVE P&L, coloured by P&L
    //    state (not side). p.profit is the SAME value the positions table uses
    //    → single source of truth, so the line can never disagree with the
    //    table. SL (amber) / TP (teal) with projected P&L at the level. ──
    for (const p of myPos) {
      // NET P&L (profit − commission + swap; swap is negative for a charge) —
      // the same figure the positions table and the mobile app show, so the
      // chart label can never disagree with them by the fee amount.
      const pnl = netPnl(p);
      const lots = Number(p.lots || 0);
      const entry = Number(p.open_price || 0);
      const notional = entry * lots * cs;
      const pct = notional > 0 ? (pnl / notional) * 100 : 0;
      const pnlStr = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
      const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
      // Line colour by SIDE (BUY blue / SELL red); label colour by P&L.
      const sideColor = p.side.toUpperCase() === 'BUY' ? CHART_BUY_COLOR : CHART_SELL_COLOR;
      desired.push({
        key: p.id, price: entry, color: sideColor, textColor: pnlColor(pnl),
        // Live P&L rendered as the TV shape's OWN label — TradingView pins it
        // exactly on the entry price (right axis), so it can never drift.
        text: `${p.side.toUpperCase()} ${lots}  ${pnlStr} (${pctStr})`,
        dashed: false, pnl,
      });
      // SL/TP labels PROJECT the realized outcome if price reaches that level,
      // so they must show NET P&L — computePnlAt returns gross, but the close
      // books net = profit − commission + swap (lib/pnl netPnl; swap stored
      // negative for charges). Without this a TP label reads e.g. +$2.06 while
      // the trade realizes +$2.01 after a $0.06 commission (sibling-platform
      // client: "TP amount doesn't match what I get").
      const netAt = (gross: number) => gross - (Number(p.commission) || 0) + (Number(p.swap) || 0);
      if (p.stop_loss != null && Number(p.stop_loss) > 0) {
        const slp = Number(p.stop_loss);
        const r = computePnlAt(p, slp);
        const net = Number.isFinite(r) ? netAt(r) : NaN;
        const pl = Number.isFinite(net) ? `  ${net >= 0 ? '+' : '−'}$${Math.abs(net).toFixed(2)}` : '';
        desired.push({ key: `${p.id}-sl`, price: slp, color: SL_COLOR, text: `SL ${fp(slp)}${pl}`, dashed: true });
      }
      if (p.take_profit != null && Number(p.take_profit) > 0) {
        const tpp = Number(p.take_profit);
        const r = computePnlAt(p, tpp);
        const net = Number.isFinite(r) ? netAt(r) : NaN;
        const pl = Number.isFinite(net) ? `  ${net >= 0 ? '+' : '−'}$${Math.abs(net).toFixed(2)}` : '';
        desired.push({ key: `${p.id}-tp`, price: tpp, color: TP_COLOR, text: `TP ${fp(tpp)}${pl}`, dashed: true });
      }
    }

    // ── Pending orders (limit/stop): entry + SL + TP. ──
    for (const o of myPending) {
      const pColor = o.side === 'buy' ? PENDING_BUY_COLOR : PENDING_SELL_COLOR;
      desired.push({ key: `ord-${o.id}`, price: Number(o.price), color: pColor,
        text: `${String(o.order_type || '').toUpperCase()} ${o.side.toUpperCase()} ${fp(Number(o.price))}`, dashed: true });
      if (o.stop_loss != null && Number(o.stop_loss) > 0)
        desired.push({ key: `ord-${o.id}-sl`, price: Number(o.stop_loss), color: SL_COLOR, text: `SL ${fp(Number(o.stop_loss))}`, dashed: true });
      if (o.take_profit != null && Number(o.take_profit) > 0)
        desired.push({ key: `ord-${o.id}-tp`, price: Number(o.take_profit), color: TP_COLOR, text: `TP ${fp(Number(o.take_profit))}`, dashed: true });
    }

    const shapeOpts = (text: string, lineColor: string, textColor: string, dashed: boolean) => ({
      shape: 'horizontal_line',
      text,
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: lineColor, linestyle: dashed ? 2 : 0, linewidth: dashed ? 1 : 2,
        showLabel: true, textcolor: textColor, fontsize: 11, bold: true,
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
    const now = Date.now();
    // Throttle the live-P&L label refresh: 500ms normally, 1000ms once 10+
    // positions are open, so streaming ticks never thrash the chart.
    const throttleMs = myPos.length >= 10 ? 1000 : 500;
    const wanted = new Set(desired.map((d) => d.key));

    for (const d of desired) {
      const existing = linesRef.current.get(d.key);
      if (!existing) {
        // createShape is ASYNC (Promise<EntityId>). Reserve the key with a
        // 'creating' entry so a re-render mid-create doesn't spawn a duplicate.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry: any = { id: null, price: d.price, creating: true, text: d.text, color: d.color, textColor: d.textColor ?? d.color, pnl: d.pnl ?? null, propAt: now };
        linesRef.current.set(d.key, entry);
        Promise.resolve(chart.createShape({ time: anchorTime, price: d.price }, shapeOpts(d.text, d.color, d.textColor ?? d.color, d.dashed)))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((id: any) => {
            if (linesRef.current.get(d.key) === entry) { entry.id = id; entry.creating = false; }
            else { try { chart.removeEntity(id); } catch { /* closed mid-create */ } }
          })
          .catch(() => { if (linesRef.current.get(d.key) === entry) linesRef.current.delete(d.key); });
      } else if (existing.id != null) {
        // Price moved (SL/TP edited) → slide the existing line, no recreate.
        if (existing.price !== d.price) {
          try { chart.getShapeById(existing.id)?.setPoints([{ time: anchorTime, price: d.price }]); } catch { /* ignore */ }
          existing.price = d.price;
        }
        // Live label + colour refresh. For P&L lines (entry): throttle AND
        // only when P&L moved > $0.01 or the profit/loss colour flipped — so we
        // don't setProperties on every micro-tick. SL/TP/order labels are
        // static, so they update immediately when they actually change.
        const nextTextColor = d.textColor ?? d.color;
        if (d.text !== existing.text || d.color !== existing.color || nextTextColor !== existing.textColor) {
          const isPnl = d.pnl != null;
          const throttleOk = !isPnl || (now - (existing.propAt || 0) >= throttleMs);
          // For entry lines the LINE colour is fixed by side, so the P&L flip
          // shows up in the LABEL colour — trigger on that too.
          const worthIt = !isPnl
            || d.color !== existing.color
            || nextTextColor !== existing.textColor
            || Math.abs((d.pnl as number) - (existing.pnl ?? 0)) > 0.01;
          if (throttleOk && worthIt) {
            try {
              chart.getShapeById(existing.id)?.setProperties({
                text: d.text, linecolor: d.color, textcolor: nextTextColor,
              });
            } catch { /* keep last-known label on error */ }
            existing.text = d.text;
            existing.color = d.color;
            existing.textColor = nextTextColor;
            existing.pnl = d.pnl ?? existing.pnl;
            existing.propAt = now;
          }
        }
      }
    }

    // Remove lines whose position / order / SL / TP is gone (or symbol changed).
    for (const [key, entry] of linesRef.current) {
      if (!wanted.has(key)) {
        if (entry && entry.id != null) { try { chart.removeEntity(entry.id); } catch { /* ignore */ } }
        linesRef.current.delete(key);
      }
    }
  }, [positions, pendingOrders, selectedSymbol, chartReady, computePnlAt]);

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
      const now = Date.now();
      // Position ENTRY lines (carry live P&L; entry.pnl != null). SL/TP and
      // pending-order labels are static, so leave them untouched.
      for (const [, entry] of linesRef.current) {
        if (!entry || entry.id == null || entry.pnl == null) continue;
        try {
          chart.getShapeById(entry.id)?.setProperties({
            linecolor: STALE_COLOR, textcolor: STALE_COLOR,
          });
        } catch { /* ignore */ }
        entry.color = STALE_COLOR;
        entry.textColor = STALE_COLOR;
        entry.propAt = now; // so the reconcile's throttle lets recovery through
      }
    }, 1000);

    return () => { clearInterval(intervalId); try { unsub(); } catch { /* ignore */ } };
  }, [chartReady, selectedSymbol]);

  const closePositionFromChart = useCallback((positionId: string) => {
    // The temp `optim-…` id isn't a real position yet — don't POST it (the
    // backend UUID check would 422). This window is ~1 tick; the real id lands
    // and the button works.
    if (!isRealPositionId(positionId)) { toast('Order still finalizing…'); return; }
    const st = useTradingStore.getState();
    const p = st.positions.find((x) => x.id === positionId);
    if (!p) return;
    const side = String(p.side).toUpperCase();
    const sym = String(p.symbol).toUpperCase();
    openDialogRef.current({
      title: 'Close position',
      body: `Close ${side} ${Number(p.lots)} ${sym} at market?`,
      confirmLabel: 'Close position',
      danger: true,
      onConfirm: () => {
        try { useTradingStore.getState().removePosition(positionId); } catch { /* ignore */ }
        void (async () => {
          try {
            const res = await api.post<{ profit?: number; close_price?: number }>(
              `/positions/${positionId}/close`, {}, { timeoutMs: 8000 },
            );
            const pnl = Number(res?.profit ?? 0);
            toast.success(`Closed @ ${res?.close_price ?? ''} | ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Close failed');
          } finally {
            Promise.all([
              useTradingStore.getState().refreshPositions(),
              useTradingStore.getState().refreshAccount(),
            ]).catch(() => {});
          }
        })();
      },
    });
  }, []);

  // Stable key of the open positions on this symbol — the button overlay
  // rebuilds only when the position SET changes, not every tick.
  const symU = (selectedSymbol ?? 'EURUSD').toUpperCase();
  const positionsKey = positions
    .filter((p) => String(p.symbol).toUpperCase() === symU)
    .map((p) => `${p.id}:${p.side}:${p.lots}:${p.trade_type === 'copy_trade' ? 'c' : ''}`)
    .join('|');

  // ── On-chart [SL] [TP] [✕] button group per position ────────────────────────
  // P&L is a native TV shape label (always pinned to the exact price). The
  // buttons MUST be clickable HTML — price→pixel comes from the pane's price
  // scale (getVisiblePriceRange + pane height, re-read every frame so it
  // follows zoom/pan live) plus the pane's top offset, measured EXACTLY from
  // the DOM (the chart mounts inline, so the pane canvas is reachable) with a
  // crosshair-calibrated fallback. A rAF loop repositions the group and the
  // persistent entry→SL / entry→TP shaded zones every frame.
  //
  // Drag an [SL]/[TP] button up/down to set that bracket — a dashed preview
  // line + shaded zone + price/projected-P&L label follow the cursor; release
  // opens the confirm dialog. A plain click opens the type-a-price dialog.
  useEffect(() => {
    const w = widgetRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!chartReady || !w || !overlay || !container) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = typeof w.activeChart === 'function' ? w.activeChart() : w.chart(); } catch { return; }
    if (!chart) return;

    const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();

    type Geo = { top: number; bottom: number; h: number; log: boolean };
    const geom = (): Geo | null => {
      try {
        const pane = chart.getPanes?.()[0];
        const ps = pane?.getMainSourcePriceScale?.();
        if (!ps) return null;
        const mode = ps.getMode?.() ?? 0;            // 0 linear, 1 log
        if (mode !== 0 && mode !== 1) return null;
        const range = ps.getVisiblePriceRange?.();
        const h = pane?.getHeight?.() || 0;
        if (!range || !(h > 0) || !(range.to > range.from)) return null;
        if (mode === 1 && !(range.from > 0)) return null;
        return { top: Number(range.to), bottom: Number(range.from), h: Number(h), log: mode === 1 };
      } catch { return null; }
    };
    const paneY = (price: number, g: Geo): number => {
      if (g.log) {
        if (!(price > 0)) return NaN;
        const lt = Math.log(g.top), lb = Math.log(g.bottom);
        return (g.h * (lt - Math.log(price))) / (lt - lb);
      }
      return (g.h * (g.top - price)) / (g.top - g.bottom);
    };

    // Pane-top offset (container-Y of the pane's top edge). Preferred source:
    // measure the price-pane canvas straight from the DOM — exact, no drift,
    // and works for touch (no crosshair needed). Fallback: rolling-median
    // crosshair calibration (candidate = mouseY - paneY(price)).
    let calibOffset: number | null = null;
    let lastMouseY: number | null = null;
    const calibSamples: number[] = [];
    const measurePaneTop = (paneH: number): number | null => {
      try {
        const rootRect = container.getBoundingClientRect();
        let best: number | null = null;
        let bestDiff = 40;
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
          // The library may render inside its own SAME-ORIGIN iframe (mobile
          // builds) — canvases there aren't reachable from the container.
          // Scan the iframe document, converting its viewport coords to ours.
          container.querySelectorAll('iframe').forEach((f) => {
            try {
              const doc = (f as HTMLIFrameElement).contentDocument;
              if (doc) scan(doc, (f as HTMLIFrameElement).getBoundingClientRect().top);
            } catch { /* cross-origin — skip */ }
          });
        }
        return best;
      } catch { return null; }
    };
    const paneTopOf = (g: Geo): number => {
      const m = measurePaneTop(g.h);
      if (m != null) { calibOffset = m; return m; }
      if (calibOffset != null) return calibOffset;
      // Rough estimate before any measurement/calibration exists (pane fills
      // the container above the ~46px time axis). Slightly off is fine — the
      // buttons must APPEAR immediately; the first real sample snaps them
      // into exact place.
      return container.clientHeight - g.h - 46;
    };
    const onMouseMove = (e: MouseEvent) => {
      lastMouseY = e.clientY - container.getBoundingClientRect().top;
    };
    container.addEventListener('mousemove', onMouseMove);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onCross = (params: any) => {
      const price = params?.price;
      if (price == null) return;
      // Prefer the crosshair event's own offsetY (exact, works even when the
      // library swallows container mouse events); fall back to the tracked
      // container mouseY.
      const my = typeof params?.offsetY === 'number' ? params.offsetY : lastMouseY;
      if (my == null) return;
      const g = geom();
      if (!g) return;
      const py = paneY(Number(price), g);
      if (!Number.isFinite(py)) return;
      const candidate = my - py;
      // Rolling MEDIAN of the last 15 samples — rejects the per-move
      // mouseY/price mismatch that would make the offset jitter.
      calibSamples.push(candidate);
      while (calibSamples.length > 15) calibSamples.shift();
      const sorted = [...calibSamples].sort((a, b) => a - b);
      calibOffset = sorted[Math.floor(sorted.length / 2)] ?? candidate;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let crossSub: any = null;
    try { crossSub = chart.crossHairMoved?.(); crossSub?.subscribe?.(null, onCross); } catch { /* ignore */ }

    // Inverse of paneY: container-Y → price (drives the drag-to-set gesture).
    const priceForY = (containerY: number): number | null => {
      const g = geom();
      if (!g) return null;
      const top = paneTopOf(g);
      if (top == null) return null;
      const py = containerY - top; // pane-relative Y
      if (g.log) {
        const lt = Math.log(g.top), lb = Math.log(g.bottom);
        return Math.exp(lt - (py / g.h) * (lt - lb));
      }
      return g.top - (py / g.h) * (g.top - g.bottom);
    };

    const digits = (useTradingStore.getState().instruments.find(
      (i) => String(i.symbol).toUpperCase() === sym,
    )?.digits) ?? 2;

    // Set / clear a position's stop-loss or take-profit from the chart via the
    // type-a-price dialog. Sends ONLY the bracket being changed — the backend
    // does a partial update, so the OTHER bracket is never affected (the
    // button's captured `p` is a stale closure: it only rebuilds on
    // id/side/lots change, NOT on SL/TP change, so re-sending its copy of the
    // other bracket would revert it).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setBracket = (p: any, kind: 'sl' | 'tp') => {
      if (!isRealPositionId(p.id)) { toast('Order still finalizing…'); return; }
      const label = kind === 'sl' ? 'Stop Loss' : 'Take Profit';
      const t = useTradingStore.getState().prices[sym];
      const cur = kind === 'sl' ? p.stop_loss : p.take_profit;
      const dflt = Number(cur) || (t ? (p.side === 'buy' ? t.bid : t.ask) : Number(p.open_price)) || 0;
      openDialogRef.current({
        title: `${label} — ${String(p.side).toUpperCase()} ${p.lots} ${sym}`,
        body: 'Enter the price. Leave blank to remove.',
        confirmLabel: 'Save',
        input: { defaultValue: dflt ? dflt.toFixed(digits) : '', placeholder: 'Price' },
        onConfirm: (raw) => {
          const trimmed = (raw ?? '').trim();
          const val = trimmed === '' ? null : parseFloat(trimmed);
          if (val !== null && !(val > 0)) { toast.error('Invalid price'); return; }
          void (async () => {
            try {
              await api.put(`/positions/${p.id}`,
                kind === 'sl' ? { stop_loss: val } : { take_profit: val });
              toast.success(val === null ? `${label} removed` : `${label} set @ ${val}`);
              await useTradingStore.getState().refreshPositions();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : `Failed to set ${label}`);
            }
          })();
        },
      });
    };

    const mkBtn = (txt: string, bg: string, title: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.title = title;
      b.style.cssText =
        `display:flex;align-items:center;justify-content:center;height:18px;min-width:18px;`
        + `padding:0 ${txt.length > 1 ? '5' : '0'}px;border:0;border-radius:3px;cursor:pointer;`
        + `font-size:10px;font-weight:700;line-height:1;color:#fff;pointer-events:auto;`
        + `background:${bg};box-shadow:0 1px 3px rgba(0,0,0,.55);`;
      b.onmouseenter = () => { b.style.filter = 'brightness(1.15)'; };
      b.onmouseleave = () => { b.style.filter = 'none'; };
      b.onclick = (e) => { e.stopPropagation(); onClick(); };
      return b;
    };

    // Draggable SL/TP button: press & drag up/down → a dashed preview line
    // (+ shaded zone + price/P&L label) follows the cursor → release → confirm
    // → PUT. A plain click (no drag) falls back to the type-a-price prompt.
    // Pointer capture makes the same gesture work for mouse AND touch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mkDragBtn = (txt: string, bg: string, title: string, p: any, kind: 'sl' | 'tp'): HTMLButtonElement => {
      const color = kind === 'sl' ? SL_COLOR : TP_COLOR;
      const zoneBg = kind === 'sl' ? 'rgba(239,68,68,0.13)' : 'rgba(20,184,166,0.13)';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.title = `${title} — drag up/down to set, or click to type`;
      b.style.cssText =
        `display:flex;align-items:center;justify-content:center;height:18px;min-width:18px;`
        + `padding:0 5px;border:0;border-radius:3px;cursor:ns-resize;touch-action:none;`
        + `font-size:10px;font-weight:700;line-height:1;color:#fff;pointer-events:auto;`
        + `background:${bg};box-shadow:0 1px 3px rgba(0,0,0,.55);`;
      b.onmouseenter = () => { b.style.filter = 'brightness(1.15)'; };
      b.onmouseleave = () => { b.style.filter = 'none'; };
      b.onpointerdown = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!isRealPositionId(p.id)) { toast('Order still finalizing…'); return; }
        // Capture the pointer to the button: the drag follows the cursor and
        // won't "let go" even if it leaves the button — released on pointerup.
        try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        postDragToNative(true); // freeze the app's ScrollView during the drag
        const startY = e.clientY;
        let moved = false;
        // Preview: shaded zone (entry → cursor) + dashed line + price label.
        const zone = document.createElement('div');
        zone.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;background:${zoneBg};pointer-events:none;z-index:6;`;
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;border-top:1px dashed ${color};pointer-events:none;z-index:7;`;
        const lbl = document.createElement('div');
        lbl.style.cssText = `position:absolute;right:2px;top:0;transform:translateY(-50%);background:${color};`
          + `color:#fff;font:700 10px system-ui;padding:1px 6px;border-radius:3px;pointer-events:none;z-index:8;white-space:nowrap;`;
        overlay.appendChild(zone); overlay.appendChild(line); overlay.appendChild(lbl);
        const entryY = (): number | null => {
          const g = geom();
          if (!g) return null;
          const top = paneTopOf(g);
          if (top == null) return null;
          return paneY(Number(p.open_price) || 0, g) + top;
        };
        const cleanup = () => { for (const el of [zone, line, lbl]) { try { overlay.removeChild(el); } catch { /* ignore */ } } };
        b.onpointermove = (ev) => {
          if (Math.abs(ev.clientY - startY) > 3) moved = true;
          const r = container.getBoundingClientRect();
          const cy = ev.clientY - r.top;
          const price = priceForY(cy);
          line.style.top = `${cy}px`;
          lbl.style.top = `${cy}px`;
          // Show the target price AND the projected NET P&L at that price
          // (gross − commission + swap; matches the static SL/TP labels and
          // the amount the close actually books).
          let ptxt = `${kind === 'sl' ? 'SL' : 'TP'} ${price ? price.toFixed(digits) : '—'}`;
          if (price) {
            const rr = computePnlAt(p, price);
            const netRR = Number.isFinite(rr) ? rr - (Number(p.commission) || 0) + (Number(p.swap) || 0) : NaN;
            if (Number.isFinite(netRR)) ptxt += `  ${netRR >= 0 ? '+' : '−'}$${Math.abs(netRR).toFixed(2)}`;
          }
          lbl.textContent = ptxt;
          const ey = entryY();
          if (ey != null) { zone.style.top = `${Math.min(ey, cy)}px`; zone.style.height = `${Math.abs(ey - cy)}px`; }
        };
        const endDrag = (ev: PointerEvent, cancelled: boolean) => {
          b.onpointermove = null; b.onpointerup = null; b.onpointercancel = null;
          try { b.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
          cleanup();
          postDragToNative(false); // re-enable the app's ScrollView
          if (cancelled) return;
          if (!moved) { setBracket(p, kind); return; } // plain click → type-a-price
          const r = container.getBoundingClientRect();
          const price = priceForY(ev.clientY - r.top);
          if (!price || !(price > 0)) { toast.error('Could not read price'); return; }
          const label = kind === 'sl' ? 'Stop Loss' : 'Take Profit';
          const projGross = computePnlAt(p, price);
          const proj = Number.isFinite(projGross)
            ? projGross - (Number(p.commission) || 0) + (Number(p.swap) || 0)
            : NaN;
          const projTxt = Number.isFinite(proj) ? ` → ${proj >= 0 ? 'profit' : 'loss'} ${proj >= 0 ? '+' : '−'}$${Math.abs(proj).toFixed(2)}` : '';
          const applyBracket = async () => {
            try {
              // Only the dragged bracket — the backend partial-update keeps
              // the other intact (see setBracket note; `p` is a stale closure).
              await api.put(`/positions/${p.id}`,
                kind === 'sl' ? { stop_loss: price } : { take_profit: price });
              toast.success(`${label} set @ ${price.toFixed(digits)}`);
              await useTradingStore.getState().refreshPositions();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : `Failed to set ${label}`);
            }
          };
          openDialogRef.current({
            title: `Set ${label} @ ${price.toFixed(digits)}`,
            body: `${String(p.side).toUpperCase()} ${p.lots} ${sym}${projTxt}`,
            confirmLabel: `Set ${kind.toUpperCase()}`,
            onConfirm: () => { void applyBracket(); },
          });
        };
        b.onpointerup = (ev) => endDrag(ev, false);
        b.onpointercancel = (ev) => endDrag(ev, true);
      };
      return b;
    };

    // One button GROUP per open position: [SL] [TP] [✕], pinned to the entry
    // line. Copied (MAM) positions get only ✕ — SL/TP is master-controlled.
    const myPos = useTradingStore.getState().positions.filter(
      (p) => String(p.symbol).toUpperCase() === sym,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const btns: { p: any; entry: number; el: HTMLDivElement; slZone: HTMLDivElement; tpZone: HTMLDivElement }[] = [];
    for (const p of myPos) {
      const side = String(p.side).toUpperCase();
      const sideColor = side === 'BUY' ? CHART_BUY_COLOR : CHART_SELL_COLOR;
      const isCopy = p.trade_type === 'copy_trade';
      // Clamp the right offset on narrow (mobile) charts so the ~70px-wide
      // group never slides off the left edge; desktop keeps the Swisdex 268px.
      const rightPx = Math.min(CLOSE_BTN_RIGHT_PX, Math.max(8, container.clientWidth - 78));
      const root = document.createElement('div');
      root.style.cssText =
        `position:absolute;right:${rightPx}px;transform:translateY(-50%);`
        + `display:flex;align-items:center;gap:3px;pointer-events:none;visibility:hidden;z-index:6;`;
      if (!isCopy) {
        root.appendChild(mkDragBtn('SL', 'rgba(245,158,11,0.97)', `Stop loss ${side} ${p.lots} ${sym}`, p, 'sl'));
        root.appendChild(mkDragBtn('TP', 'rgba(20,184,166,0.97)', `Take profit ${side} ${p.lots} ${sym}`, p, 'tp'));
      }
      root.appendChild(mkBtn('✕', sideColor, `Close ${side} ${p.lots} ${sym} at market`, () => {
        closePositionFromChart(p.id);
      }));
      // Persistent shaded zones (entry → SL red, entry → TP teal), positioned
      // in the sync loop from the LIVE bracket prices. Below the buttons (z 4).
      const slZone = document.createElement('div');
      slZone.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;background:rgba(239,68,68,0.10);pointer-events:none;visibility:hidden;z-index:4;`;
      const tpZone = document.createElement('div');
      tpZone.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;background:rgba(20,184,166,0.10);pointer-events:none;visibility:hidden;z-index:4;`;
      overlay.appendChild(slZone); overlay.appendChild(tpZone);
      overlay.appendChild(root);
      btns.push({ p, entry: Number(p.open_price) || 0, el: root, slZone, tpZone });
    }

    let raf = 0;
    const sync = () => {
      raf = requestAnimationFrame(sync);
      if (btns.length === 0) return;
      // Re-read the price scale EVERY frame so the buttons/zones follow live
      // through zoom/pan; the DOM-measured pane top stays exact throughout.
      const g = geom();
      const top = g ? paneTopOf(g) : null;
      if (!g || top == null) {
        for (const b of btns) { b.el.style.visibility = 'hidden'; b.slZone.style.visibility = 'hidden'; b.tpZone.style.visibility = 'hidden'; }
        return;
      }
      const h = container.clientHeight || g.h;
      const live = useTradingStore.getState().positions;
      const drawZone = (el: HTMLDivElement, entryY: number, price: unknown) => {
        const pr = Number(price);
        if (!(pr > 0)) { el.style.visibility = 'hidden'; return; }
        const zy = paneY(pr, g) + top;
        const zTop = Math.min(entryY, zy), ht = Math.abs(entryY - zy);
        if (ht < 1) { el.style.visibility = 'hidden'; return; }
        el.style.top = `${zTop}px`; el.style.height = `${ht}px`; el.style.visibility = 'visible';
      };
      for (const b of btns) {
        const y = paneY(b.entry, g) + top;
        if (!(y > 8) || y > h - 8) { b.el.style.visibility = 'hidden'; }
        else { b.el.style.top = `${y}px`; b.el.style.visibility = 'visible'; }
        const lp = live.find((x) => x.id === b.p.id);
        drawZone(b.slZone, y, lp?.stop_loss);
        drawZone(b.tpZone, y, lp?.take_profit);
      }
    };
    raf = requestAnimationFrame(sync);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('mousemove', onMouseMove);
      try { crossSub?.unsubscribe?.(null, onCross); } catch { /* ignore */ }
      for (const b of btns) { for (const el of [b.el, b.slZone, b.tpZone]) { try { overlay.removeChild(el); } catch { /* ignore */ } } }
    };
  }, [chartReady, selectedSymbol, positionsKey, computePnlAt, closePositionFromChart]);

  return (
    <div className={clsx('relative w-full h-full min-h-[200px] min-w-0 bg-bg-base')} data-tv-chart-root>
      <div id={CONTAINER_ID} ref={containerRef} className="h-full w-full min-h-[200px]" />

      {/* Loader until the chart is ready (covers the library load). */}
      {!chartReady && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: theme === 'dark' ? '#0b0e11' : '#ffffff' }}
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
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" />

      {/* In-app dialog for the on-chart trade buttons: close ✕ confirmation,
          SL/TP drag confirmation (with projected P&L), and type-a-price. */}
      {dialog &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 p-0" style={{ zIndex: 2147483646, isolation: 'isolate' }}>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Dismiss"
              className="absolute inset-0 z-0 m-0 h-full w-full cursor-default border-0 bg-black/60 p-0 backdrop-blur-sm"
              onClick={() => setDialog(null)}
            />
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
              <div
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-[300px] rounded-xl border p-3.5 shadow-2xl overflow-hidden pointer-events-auto bg-bg-secondary border-border-primary"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold pr-2 text-text-primary">{dialog.title}</h3>
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors bg-bg-hover text-text-tertiary hover:text-text-primary"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-text-secondary mb-3">{dialog.body}</p>
                {dialog.input && (
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    value={dialogValue}
                    onChange={(e) => setDialogValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const d = dialog; setDialog(null); d.onConfirm(dialogValue);
                      } else if (e.key === 'Escape') { setDialog(null); }
                    }}
                    placeholder={dialog.input.placeholder}
                    className="w-full mb-3 px-3 py-2 rounded-lg border border-border-primary bg-bg-input font-mono text-sm text-text-primary outline-none focus:border-accent/50"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="flex-1 py-2.5 font-bold rounded-lg text-sm active:scale-[0.98] transition-all bg-bg-hover text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { const d = dialog; setDialog(null); d.onConfirm(dialogValue); }}
                    className={`flex-1 py-2.5 text-white font-bold rounded-lg shadow-lg active:scale-[0.98] transition-all text-sm ${dialog.danger ? 'bg-sell shadow-sell/20' : 'bg-buy shadow-buy/20'}`}
                  >
                    {dialog.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default memo(TradingViewChartInner);

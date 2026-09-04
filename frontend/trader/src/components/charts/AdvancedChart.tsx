'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { TriangleAlert } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import api from '@/lib/api/client';
import { getDigits } from '@/lib/utils';
import { AnimatedPrice } from '@/components/trading/AnimatedPrice';
import { createDatafeed } from '@/lib/charting/datafeed';

// On-chart line + overlay colours.
const CHART_BUY_COLOR = '#3b82f6';   // blue — BUY entry line / close button
const CHART_SELL_COLOR = '#ef4444';  // red  — SELL entry line / close button
const SL_COLOR = '#f59e0b';          // amber
const TP_COLOR = '#14b8a6';          // teal
// Where the [SL][TP][✕] button group sits, from the chart's RIGHT edge — clear
// of the right-axis price/P&L label.
const CLOSE_BTN_RIGHT_PX = 268;

/** Projected P&L if the position were closed at `price` (account currency,
 *  mirrors the store's tick math — accurate enough for the SL/TP preview). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function projPnl(p: any, price: number, instruments: any[], sym: string): number {
  const inst = instruments.find((i) => String(i.symbol).toUpperCase() === sym);
  const cs = Number(inst?.contract_size) || 100000;
  let pnl = p.side === 'buy'
    ? (price - Number(p.open_price)) * Number(p.lots) * cs
    : (Number(p.open_price) - price) * Number(p.lots) * cs;
  const base = (inst?.base_currency || (sym.length >= 6 ? sym.slice(0, 3) : '')).toUpperCase();
  const quote = (inst?.quote_currency || (sym.length >= 6 ? sym.slice(3, 6) : '')).toUpperCase();
  if (quote && quote !== 'USD' && base === 'USD' && price) pnl = pnl / price;
  return pnl;
}

type ChartDialog = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  input?: { defaultValue: string; placeholder: string };
  onConfirm: (value: string) => void;
};

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

function AdvancedChartInner({ onRequestFullscreen }: { onRequestFullscreen?: () => void }) {
  const pathname = usePathname();
  // Kept in a ref so adding the toolbar button doesn't depend on prop identity
  // (the widget is created once; re-creating it to pick up a new callback
  // would tear down the whole chart).
  const fullscreenCbRef = useRef<(() => void) | undefined>(onRequestFullscreen);
  fullscreenCbRef.current = onRequestFullscreen;
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);
  const tick = useTradingStore((s) => s.prices[(selectedSymbol ?? 'EURUSD').toUpperCase()]);
  // Open positions drive the on-chart entry / SL / TP lines (drawn as shapes).
  const positions = useTradingStore((s) => s.positions);

  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';
  const interval = onTradingTerminal ? '5' : '15';

  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  // key -> { id, price, text, color, textColor, creating } for each drawn line.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linesRef = useRef<Map<string, any>>(new Map());
  // HTML overlay layer that hosts the [SL][TP][✕] button groups + shaded zones.
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadChart = useCallback(() => setReloadNonce((n) => n + 1), []);
  // Held in a ref so the toolbar button created once in onChartReady always
  // calls the current closure without re-creating the widget.
  const reloadChartRef = useRef(reloadChart);
  reloadChartRef.current = reloadChart;

  // Small confirm/input modal used by the on-chart SL/TP/close buttons.
  const [dialog, setDialog] = useState<ChartDialog | null>(null);
  const [dialogValue, setDialogValue] = useState('');
  const openDialog = useCallback((d: ChartDialog) => {
    setDialogValue(d.input?.defaultValue ?? '');
    setDialog(d);
  }, []);

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
        });
        widget.onChartReady(() => {
          if (cancelled) return;
          widgetRef.current = widget;
          setStatus('ready');

          // "Full screen" lives INSIDE the chart's own header, next to
          // Indicators — a floating overlay button sat on top of TV's toolbar
          // instead. createButton is the library's supported way in.
          try {
            const btn = widget.createButton?.();
            if (btn) {
              btn.setAttribute('title', 'Expand chart to full screen');
              btn.style.cursor = 'pointer';
              btn.innerHTML =
                '<span style="display:inline-flex;align-items:center;gap:5px">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>' +
                '<path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>' +
                'Full screen</span>';
              btn.addEventListener('click', () => fullscreenCbRef.current?.());
            }

            // Reload — remounts the widget to recover a stalled datafeed.
            const rl = widget.createButton?.();
            if (rl) {
              rl.setAttribute('title', 'Reload chart');
              rl.style.cursor = 'pointer';
              rl.innerHTML =
                '<span style="display:inline-flex;align-items:center;gap:5px">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' +
                'Reload</span>';
              rl.addEventListener('click', () => reloadChartRef.current?.());
            }
          } catch {
            /* createButton unavailable — the rail's chart-focus button still works */
          }
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
      linesRef.current.clear(); // shapes died with the widget
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

  // ── On-chart position / SL / TP lines ──────────────────────────────────
  // Drawn with createShape('horizontal_line') — the CORE Charting Library API.
  // createPositionLine / the Trading-Terminal broker render NOTHING in this
  // standalone build, so shapes are how the lines actually appear. A position
  // shows: a solid entry line (BUY blue / SELL red) labelled with its LIVE P&L,
  // a dashed amber SL line, and a dashed teal TP line. Lines are created once,
  // slid with setPoints when a price changes, and removed when the position
  // closes / the symbol changes. They are static (not drag-to-modify) — SL/TP
  // is edited from the order panel; p.profit is the same value the positions
  // table uses, so the label can never disagree with it.
  useEffect(() => {
    if (status !== 'ready') return;
    const w = widgetRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = w?.activeChart?.(); } catch { return; }
    if (!chart?.createShape) return;

    const sym = (selectedSymbol || '').toUpperCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insts: any[] = useTradingStore.getState().instruments || [];
    const inst = insts.find((i) => String(i.symbol).toUpperCase() === sym);
    const digitsN = inst?.digits ?? getDigits(sym);
    const cs = Number(inst?.contract_size) || 100000;
    const fp = (n: number) => Number(n).toFixed(digitsN);
    const myPos = positions.filter((p) => (p.symbol || '').toUpperCase() === sym);

    type Desired = { key: string; price: number; color: string; textColor?: string; text: string; dashed: boolean };
    const desired: Desired[] = [];
    for (const p of myPos) {
      const pnl = Number(p.profit || 0);
      const lots = Number(p.lots || 0);
      const entry = Number(p.open_price || 0);
      const notional = entry * lots * cs;
      const pct = notional > 0 ? (pnl / notional) * 100 : 0;
      const pnlStr = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
      const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
      const sideColor = p.side.toUpperCase() === 'BUY' ? '#3b82f6' : '#ef4444';
      const pnlColor = Math.abs(pnl) < 0.1 ? '#9ca3af' : pnl > 0 ? '#22c55e' : '#ef4444';
      desired.push({
        key: p.id, price: entry, color: sideColor, textColor: pnlColor,
        text: `${p.side.toUpperCase()} ${lots}  ${pnlStr} (${pctStr})`, dashed: false,
      });
      if (p.stop_loss && Number(p.stop_loss) > 0)
        desired.push({ key: `${p.id}-sl`, price: Number(p.stop_loss), color: '#f59e0b', text: `SL ${fp(Number(p.stop_loss))}`, dashed: true });
      if (p.take_profit && Number(p.take_profit) > 0)
        desired.push({ key: `${p.id}-tp`, price: Number(p.take_profit), color: '#14b8a6', text: `TP ${fp(Number(p.take_profit))}`, dashed: true });
    }

    const shapeOpts = (text: string, lineColor: string, textColor: string, dashed: boolean) => ({
      shape: 'horizontal_line', text,
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: lineColor, linestyle: dashed ? 2 : 0, linewidth: dashed ? 1 : 2,
        showLabel: true, textcolor: textColor, fontsize: 11, bold: true,
        horzLabelsAlign: 'right', vertLabelsAlign: 'middle',
      },
    });

    const t = Math.floor(Date.now() / 1000);
    const wanted = new Set(desired.map((d) => d.key));
    for (const d of desired) {
      const existing = linesRef.current.get(d.key);
      if (!existing) {
        // createShape is async — reserve the key so a re-render mid-create
        // doesn't spawn a duplicate line.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec: any = { id: null, price: d.price, creating: true, text: d.text, color: d.color, textColor: d.textColor ?? d.color };
        linesRef.current.set(d.key, rec);
        chart.createShape({ time: t, price: d.price }, shapeOpts(d.text, d.color, d.textColor ?? d.color, d.dashed))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((id: any) => {
            if (linesRef.current.get(d.key) === rec) { rec.id = id; rec.creating = false; }
            else { try { chart.removeEntity(id); } catch { /* closed mid-create */ } }
          })
          .catch(() => { if (linesRef.current.get(d.key) === rec) linesRef.current.delete(d.key); });
      } else if (existing.id != null) {
        if (existing.price !== d.price) {
          try { chart.getShapeById(existing.id)?.setPoints([{ time: t, price: d.price }]); } catch { /* noop */ }
          existing.price = d.price;
        }
        const nextTextColor = d.textColor ?? d.color;
        if (d.text !== existing.text || d.color !== existing.color || nextTextColor !== existing.textColor) {
          try {
            chart.getShapeById(existing.id)?.setProperties({ text: d.text, linecolor: d.color, textcolor: nextTextColor });
          } catch { /* keep last-known label */ }
          existing.text = d.text; existing.color = d.color; existing.textColor = nextTextColor;
        }
      }
    }
    // Remove lines whose position / SL / TP is gone (or the symbol changed).
    for (const [key, rec] of linesRef.current) {
      if (!wanted.has(key)) {
        if (rec && rec.id != null) { try { chart.removeEntity(rec.id); } catch { /* noop */ } }
        linesRef.current.delete(key);
      }
    }
  }, [positions, selectedSymbol, status]);

  // Stable key of the open positions on this symbol — the button overlay rebuilds
  // only when the position SET changes, not on every tick.
  const symU = (selectedSymbol || '').toUpperCase();
  const positionsKey = positions
    .filter((p) => (p.symbol || '').toUpperCase() === symU)
    .map((p) => `${p.id}:${p.side}:${p.lots}`)
    .join('|');

  // ── On-chart [SL] [TP] [✕] buttons per position ─────────────────────────
  // The lines above are drawn as native shapes; the interactive controls are an
  // HTML overlay pinned to the entry line. This build has no priceToCoordinate,
  // so price→pixel is CALIBRATED: the scale from the price-scale range + pane
  // height (updates every frame → follows zoom/pan), and the constant vertical
  // offset from TradingView's own crosshair samples. SL/TP buttons are drag-to-
  // set (drag up/down → dashed preview → release → confirm) or click-to-type;
  // ✕ closes at market. All calls target the position's server UUID.
  useEffect(() => {
    if (status !== 'ready') return;
    const w = widgetRef.current;
    const overlay = overlayRef.current;
    if (!w?.activeChart || !overlay) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.crossHairMoved) return;

    const sym = (selectedSymbol || '').toUpperCase();

    type Geo = { top: number; bottom: number; h: number; log: boolean };
    const geom = (): Geo | null => {
      try {
        const pane = chart.getPanes?.()[0];
        const ps = pane?.getMainSourcePriceScale?.();
        if (!ps) return null;
        const mode = ps.getMode?.() ?? 0; // 0 linear, 1 log
        if (mode !== 0 && mode !== 1) return null;
        const range = ps.getVisiblePriceRange?.();
        const h = pane?.getHeight?.() || 0;
        if (!range || !(h > 0) || !(range.to > range.from)) return null;
        if (mode === 1 && !(range.from > 0)) return null;
        return { top: range.to, bottom: range.from, h, log: mode === 1 };
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
    let calibOffset: number | null = null; // container-Y of the pane's top edge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onCross = (p: any) => {
      if (!p || typeof p.price !== 'number' || typeof p.offsetY !== 'number') return;
      const g = geom();
      if (!g) return;
      const py = paneY(p.price, g);
      if (Number.isFinite(py)) calibOffset = p.offsetY - py;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let crossSub: any = null;
    try { crossSub = chart.crossHairMoved(); crossSub?.subscribe?.(null, onCross); } catch { /* noop */ }

    const priceForY = (containerY: number): number | null => {
      const g = geom();
      if (!g || calibOffset == null) return null;
      const py = containerY - calibOffset;
      if (g.log) {
        const lt = Math.log(g.top), lb = Math.log(g.bottom);
        return Math.exp(lt - (py / g.h) * (lt - lb));
      }
      return g.top - (py / g.h) * (g.top - g.bottom);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insts: any[] = useTradingStore.getState().instruments || [];
    const digits = insts.find((i) => String(i.symbol).toUpperCase() === sym)?.digits ?? getDigits(sym);

    // Resolve the position's server UUID LIVE from the store at click time. The
    // captured `p` can be a stale optimistic copy (positionsKey keys on the
    // stable optim id, which doesn't change when server_id later lands), so
    // reading p.server_id directly showed "position not ready" forever.
    const resolveSid = (pid: string): string | null =>
      useTradingStore.getState().positions.find((x) => x.id === pid)?.server_id ?? null;

    // Set / clear a bracket by typing a price. Sends ONLY the changed bracket —
    // the backend partial-update leaves the other untouched.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setBracket = (p: any, kind: 'sl' | 'tp') => {
      const sid = resolveSid(p.id);
      if (!sid) { toast.error('Position not ready yet'); return; }
      const label = kind === 'sl' ? 'Stop Loss' : 'Take Profit';
      const tk = useTradingStore.getState().prices[sym];
      const cur = kind === 'sl' ? p.stop_loss : p.take_profit;
      const dflt = Number(cur) || (tk ? (p.side === 'buy' ? tk.bid : tk.ask) : Number(p.open_price)) || 0;
      openDialog({
        title: `${label} — ${String(p.side).toUpperCase()} ${p.lots} ${sym}`,
        body: 'Enter the price. Leave blank to remove.',
        confirmLabel: 'Save',
        input: { defaultValue: dflt ? dflt.toFixed(digits) : '', placeholder: 'Price' },
        onConfirm: (raw) => {
          const trimmed = (raw ?? '').trim();
          const val = trimmed === '' ? null : parseFloat(trimmed);
          if (val !== null && !(val > 0)) { toast.error('Invalid price'); return; }
          (async () => {
            try {
              const res = await api.put<{ closed?: boolean }>(`/positions/${sid}`, kind === 'sl' ? { stop_loss: val } : { take_profit: val });
              toast.success(res?.closed ? 'Order closed at current market price' : (val === null ? `${label} removed` : `${label} set @ ${val}`));
              // Wrong-side SL/TP closes the position server-side in this same
              // request — drop the row now so it doesn't linger until the poll.
              if (res?.closed) { try { useTradingStore.getState().removePosition(p.id); } catch { /* noop */ } }
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
        + `padding:0 5px;border:0;border-radius:3px;cursor:ns-resize;`
        + `font-size:10px;font-weight:700;line-height:1;color:#fff;pointer-events:auto;`
        + `background:${bg};box-shadow:0 1px 3px rgba(0,0,0,.55);`;
      b.onmouseenter = () => { b.style.filter = 'brightness(1.15)'; };
      b.onmouseleave = () => { b.style.filter = 'none'; };
      b.onpointerdown = (e) => {
        e.preventDefault(); e.stopPropagation();
        try { b.setPointerCapture(e.pointerId); } catch { /* noop */ }
        const startY = e.clientY;
        let moved = false;
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
          if (!g || calibOffset == null) return null;
          return paneY(Number(p.open_price) || 0, g) + calibOffset;
        };
        const cleanup = () => { for (const el of [zone, line, lbl]) { try { overlay.removeChild(el); } catch { /* noop */ } } };
        b.onpointermove = (ev) => {
          if (Math.abs(ev.clientY - startY) > 3) moved = true;
          const r = containerRef.current?.getBoundingClientRect();
          if (!r) return;
          const cy = ev.clientY - r.top;
          const price = priceForY(cy);
          line.style.top = `${cy}px`;
          lbl.style.top = `${cy}px`;
          let ptxt = `${kind === 'sl' ? 'SL' : 'TP'} ${price ? price.toFixed(digits) : '—'}`;
          if (price) {
            const pnl = projPnl(p, price, insts, sym);
            ptxt += `  ${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(2)}`;
          }
          lbl.textContent = ptxt;
          const ey = entryY();
          if (ey != null) { zone.style.top = `${Math.min(ey, cy)}px`; zone.style.height = `${Math.abs(ey - cy)}px`; }
        };
        b.onpointerup = (ev) => {
          b.onpointermove = null; b.onpointerup = null;
          try { b.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
          cleanup();
          if (!moved) { setBracket(p, kind); return; } // plain click → type a price
          const r = containerRef.current?.getBoundingClientRect();
          const price = r ? priceForY(ev.clientY - r.top) : null;
          if (!price || !(price > 0)) { toast.error('Could not read price'); return; }
          const sid = resolveSid(p.id);
          if (!sid) { toast.error('Position not ready yet'); return; }
          const label = kind === 'sl' ? 'Stop Loss' : 'Take Profit';
          // Drag-and-drop = the gesture IS the confirmation — apply immediately,
          // no popup. (A plain click still opens the type-a-price dialog above.)
          (async () => {
            try {
              const res = await api.put<{ closed?: boolean }>(`/positions/${sid}`, kind === 'sl' ? { stop_loss: price } : { take_profit: price });
              toast.success(res?.closed ? 'Order closed at current market price' : `${label} set @ ${price.toFixed(digits)}`);
              if (res?.closed) { try { useTradingStore.getState().removePosition(p.id); } catch { /* noop */ } }
              await useTradingStore.getState().refreshPositions();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : `Failed to set ${label}`);
            }
          })();
        };
      };
      return b;
    };

    const myPos = useTradingStore.getState().positions.filter(
      (p) => (p.symbol || '').toUpperCase() === sym,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Each control is its OWN wrapper so it can sit on a DIFFERENT price line:
    // SL rides the stop-loss line, TP rides the take-profit line, ✕ stays on the
    // entry line. When a bracket isn't set yet, its button falls back next to ✕
    // on the entry line as a [SL][TP][✕] row (so you can set it).
    const mkWrap = (): HTMLDivElement => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;transform:translateY(-50%);display:flex;align-items:center;pointer-events:none;visibility:hidden;z-index:6;`;
      return d;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const btns: { p: any; entry: number; slWrap: HTMLDivElement; tpWrap: HTMLDivElement; closeWrap: HTMLDivElement; slZone: HTMLDivElement; tpZone: HTMLDivElement }[] = [];
    for (const p of myPos) {
      const side = String(p.side).toUpperCase();
      const sideColor = side === 'BUY' ? CHART_BUY_COLOR : CHART_SELL_COLOR;
      const slWrap = mkWrap();
      slWrap.appendChild(mkDragBtn('SL', 'rgba(245,158,11,0.97)', `Stop loss ${side} ${p.lots} ${sym}`, p, 'sl'));
      const tpWrap = mkWrap();
      tpWrap.appendChild(mkDragBtn('TP', 'rgba(20,184,166,0.97)', `Take profit ${side} ${p.lots} ${sym}`, p, 'tp'));
      const closeWrap = mkWrap();
      closeWrap.appendChild(mkBtn('✕', sideColor, `Close ${side} ${p.lots} ${sym} at market`, () => {
        const sid = resolveSid(p.id);
        if (!sid) { toast.error('Position not ready yet'); return; }
        openDialog({
          title: 'Close position',
          body: `Close ${side} ${Number(p.lots)} ${sym} at market?`,
          confirmLabel: 'Close position',
          danger: true,
          onConfirm: () => {
            closeWrap.style.visibility = 'hidden';
            try { useTradingStore.getState().removePosition(p.id); } catch { /* noop */ }
            (async () => {
              try {
                const res = await api.post<{ profit?: number; close_price?: number }>(
                  `/positions/${sid}/close`, {}, { timeoutMs: 8000 },
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
      }));
      const slZone = document.createElement('div');
      slZone.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;background:rgba(239,68,68,0.10);pointer-events:none;visibility:hidden;z-index:4;`;
      const tpZone = document.createElement('div');
      tpZone.style.cssText = `position:absolute;left:0;right:0;top:0;height:0;background:rgba(20,184,166,0.10);pointer-events:none;visibility:hidden;z-index:4;`;
      overlay.appendChild(slZone); overlay.appendChild(tpZone);
      overlay.appendChild(slWrap); overlay.appendChild(tpWrap); overlay.appendChild(closeWrap);
      btns.push({ p, entry: Number(p.open_price) || 0, slWrap, tpWrap, closeWrap, slZone, tpZone });
    }
    if (btns.length === 0) {
      try { crossSub?.unsubscribe?.(null, onCross); } catch { /* noop */ }
      return () => {};
    }

    let raf = 0;
    const sync = () => {
      raf = requestAnimationFrame(sync);
      const g = geom();
      if (!g || calibOffset == null) {
        for (const b of btns) { for (const el of [b.slWrap, b.tpWrap, b.closeWrap, b.slZone, b.tpZone]) el.style.visibility = 'hidden'; }
        return;
      }
      const off = calibOffset;
      const h = containerRef.current?.clientHeight || g.h;
      // CLOSE_BTN_RIGHT_PX keeps the row clear of TradingView's own line
      // label on a desktop chart, but it is wider than a phone chart: the
      // SL button sits at R+52 and is ~26px wide, so at 268 the whole row
      // fell off the left edge of a ~340px pane and overflow-hidden ate it.
      // Clamp R to whatever actually fits, recomputed each frame so a
      // resize or rotation is picked up.
      const cw = containerRef.current?.clientWidth || 0;
      const R = cw > 0 ? Math.max(8, Math.min(CLOSE_BTN_RIGHT_PX, cw - 86)) : CLOSE_BTN_RIGHT_PX;
      const live = useTradingStore.getState().positions;
      const place = (el: HTMLDivElement, y: number, rightPx: number) => {
        if (!(y > 8) || y > h - 8) { el.style.visibility = 'hidden'; return; }
        el.style.top = `${y}px`; el.style.right = `${rightPx}px`; el.style.visibility = 'visible';
      };
      const drawZone = (el: HTMLDivElement, entryYpx: number, price: unknown) => {
        const pr = Number(price);
        if (!(pr > 0)) { el.style.visibility = 'hidden'; return; }
        const zy = paneY(pr, g) + off;
        const top = Math.min(entryYpx, zy), ht = Math.abs(entryYpx - zy);
        if (ht < 1) { el.style.visibility = 'hidden'; return; }
        el.style.top = `${top}px`; el.style.height = `${ht}px`; el.style.visibility = 'visible';
      };
      for (const b of btns) {
        const lp = live.find((x) => x.id === b.p.id);
        const entryY = paneY(b.entry, g) + off;
        const slP = Number(lp?.stop_loss);
        const tpP = Number(lp?.take_profit);
        const slSet = slP > 0;
        const tpSet = tpP > 0;
        // ✕ pinned to the entry line. SL/TP ride their own lines when set; when
        // unset they tuck next to ✕ on the entry line (row [SL][TP][✕]).
        place(b.closeWrap, entryY, R);
        place(b.slWrap, slSet ? paneY(slP, g) + off : entryY, slSet ? R : R + 52);
        place(b.tpWrap, tpSet ? paneY(tpP, g) + off : entryY, tpSet ? R : R + 26);
        drawZone(b.slZone, entryY, lp?.stop_loss);
        drawZone(b.tpZone, entryY, lp?.take_profit);
      }
    };
    raf = requestAnimationFrame(sync);

    return () => {
      cancelAnimationFrame(raf);
      try { crossSub?.unsubscribe?.(null, onCross); } catch { /* noop */ }
      for (const b of btns) { for (const el of [b.slWrap, b.tpWrap, b.closeWrap, b.slZone, b.tpZone]) { try { overlay.removeChild(el); } catch { /* noop */ } } }
    };
  }, [status, selectedSymbol, positionsKey, openDialog]);

  const surface = tvTheme === 'light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';
  const digits = getDigits(selectedSymbol ?? 'EURUSD');
  const fmt = (n: number | undefined | null) =>
    n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);

  return (
    <div className={clsx('relative w-full h-full min-h-[200px] min-w-0', surface)} data-tv-chart-root>
      {/* The library renders its own iframe into this container. */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* FXArtha logo watermark — faint, centered, non-interactive. Sits over
          the chart canvas but under the SL/TP overlay (DOM order). */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <img
          src="/images/fxartha_icon.png"
          alt=""
          aria-hidden
          draggable={false}
          className="w-40 h-40 md:w-56 md:h-56 object-contain opacity-[0.06] select-none"
        />
      </div>

      {/* HTML overlay for the on-chart [SL][TP][✕] buttons + shaded zones. */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

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

      {/* The manual "Reload" button no longer floats over the chart — it moved
          into the chart's own header via createButton (see onChartReady), so
          the recovery path for a stalled datafeed is still one click away
          without a pill sitting on the candles. */}

      {/* Broker-quote overlay — the actual executable bid/ask (the chart plots
          our broker candles, but this anchors the user to the live tick). */}
      {/* right-20 keeps this clear of the price scale: the axis and its
          current-price label occupy roughly the right 70px, so at right-3 the
          two overlapped whenever price sat near the top of the range. */}
      <div
        /* Hidden below md (768px — the same width the terminal switches to its
           phone layout at). The pill is ~240px wide, so on a phone-width chart
           it lands straight on top of the OHLC legend; and the phone layout
           already shows this exact bid/ask on its SELL / BUY bar, so nothing
           is lost by dropping it there. */
        className="pointer-events-none absolute top-14 right-20 z-10 hidden md:flex items-center gap-2 rounded-md border border-border-primary/70 bg-bg-secondary/95 px-2.5 py-1 text-[11px] shadow-md backdrop-blur"
        aria-label="Broker quote — actual execution price"
      >
        <span className="text-text-tertiary uppercase tracking-wider">Broker</span>
        <span className="text-sell font-mono tabular-nums">Bid {tick?.bid != null ? <AnimatedPrice value={tick.bid} digits={digits} flash={false} /> : fmt(tick?.bid)}</span>
        <span className="text-text-tertiary">·</span>
        <span className="text-buy font-mono tabular-nums">Ask {tick?.ask != null ? <AnimatedPrice value={tick.ask} digits={digits} flash={false} /> : fmt(tick?.ask)}</span>
      </div>

      {/* Confirm / input modal for the on-chart SL / TP / close buttons. */}
      {dialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 p-0" style={{ zIndex: 2147483646, isolation: 'isolate' }}>
          <button
            type="button" tabIndex={-1} aria-label="Dismiss"
            className="absolute inset-0 z-0 m-0 h-full w-full cursor-default border-0 bg-black/60 p-0 backdrop-blur-sm"
            onClick={() => setDialog(null)}
          />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <div
              role="dialog" aria-modal="true"
              className="relative w-full max-w-[300px] rounded-xl border p-3.5 shadow-2xl overflow-hidden pointer-events-auto bg-card border-border-primary"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold pr-2 text-text-primary">{dialog.title}</h3>
                <button
                  type="button" onClick={() => setDialog(null)} aria-label="Close"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors bg-bg-hover text-text-tertiary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-text-secondary mb-3">{dialog.body}</p>
              {dialog.input && (
                <input
                  autoFocus type="number" step="any" value={dialogValue}
                  onChange={(e) => setDialogValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { const d = dialog; setDialog(null); d.onConfirm(dialogValue); }
                    else if (e.key === 'Escape') { setDialog(null); }
                  }}
                  placeholder={dialog.input.placeholder}
                  className="w-full mb-3 px-3 py-2 rounded-lg border border-border-primary bg-bg-secondary font-mono text-sm text-text-primary outline-none focus:border-[#ccff00]/50"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button" onClick={() => setDialog(null)}
                  className="flex-1 py-2.5 font-bold rounded-lg text-sm active:scale-[0.98] transition-all bg-bg-hover text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { const d = dialog; setDialog(null); d.onConfirm(dialogValue); }}
                  className={clsx(
                    'flex-1 py-2.5 text-white font-bold rounded-lg shadow-lg active:scale-[0.98] transition-all text-sm',
                    dialog.danger ? 'bg-sell shadow-sell/20' : 'bg-buy shadow-buy/20',
                  )}
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

export default memo(AdvancedChartInner);

"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { LineStyle, type IPriceLine, type UTCTimestamp } from "lightweight-charts";
import { toast } from "@/lib/notify";
import { ArrowDownRight, ArrowUpRight, Bell, Camera, CandlestickChart, Crosshair, Layers, Minus, Plus, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { getInstrument, instrumentSpec, priceFeed } from "@ezymex/mock";
import { cn, useQuote } from "@ezymex/ui";
import { usePositionProfit, useTerminal, type Anchor, type ChartTab, type Drawing } from "@/lib/store";
import { CHART_TYPES, TF_SECONDS, TIMEFRAMES, accMoney, fmtPrice, fmtVol, pointSize, profitAt, roundPrice, type PendingOrder, type TPosition } from "@/lib/trading";
import { useContextMenu, type MenuItem } from "@/components/ui/menu";
import { INDICATOR_CATEGORIES, INDICATOR_LIST } from "@/lib/indicators";
import { chartRegistry, pendingRanges, useChartEngine, type ChartHandle, type LegendData } from "./engine";
import { IndicatorLegendRow } from "./indicators/legend";
import { addIndicator, openIndicatorList, openIndicatorSettings, removeIndicator, toggleIndicator } from "./indicators/state";
import { OneClickPanel } from "./one-click";
import { clearDrawings, drawPrefs, editDrawings, setDrawPrefs, useDrawPrefs } from "./drawings";
import { openRegister } from "@/lib/guest";
import { useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";

/* ------------------------------------------------------------------ */
/* Trade lines                                                         */
/* ------------------------------------------------------------------ */

export type LineKind = "pos" | "sl" | "tp" | "pending" | "alert";
export interface TLine {
  id: string;
  kind: LineKind;
  price: number;
  ref: string;
  side?: "buy" | "sell";
  label: string;
  draggable: boolean;
  closable?: boolean;
  /** SL / TP lines: whose stop it is, an open position's or a pending order's */
  owner?: "pos" | "pnd";
  /** position / order chips: the S and T handles, shown while that stop isn't set (drag one out to set it) */
  stops?: { sl: boolean; tp: boolean };
}

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Position / SL / TP / pending / alert lines for one symbol. A position line doesn't move: its SL and TP come out of the
 * S and T handles on its chip (MT5 / TradingView style). Pending orders move, have S / T too and show their SL / TP.
 */
export function useTradeLines(symbol: string): TLine[] {
  const T = useTerminal();
  const positions = T.positions.filter((p) => p.symbol === symbol);
  const pendings = T.pendings.filter((p) => p.symbol === symbol);
  const alerts = T.alerts.filter((a) => a.symbol === symbol && a.active);
  const ro = T.readOnly;
  const t = useT();
  return React.useMemo(() => {
    const out: TLine[] = [];
    for (const p of positions) {
      out.push({ id: `pos:${p.ticket}`, kind: "pos", price: p.openPrice, ref: p.ticket, side: p.side, label: t(p.side === "buy" ? "chart.line.buy" : "chart.line.sell", { lot: fmtVol(p.volume) }), draggable: false, closable: !ro, stops: ro ? undefined : { sl: p.sl === undefined, tp: p.tp === undefined } });
      if (p.sl !== undefined) out.push({ id: `sl:${p.ticket}`, kind: "sl", price: p.sl, ref: p.ticket, side: p.side, owner: "pos", label: "SL", draggable: !ro, closable: !ro });
      if (p.tp !== undefined) out.push({ id: `tp:${p.ticket}`, kind: "tp", price: p.tp, ref: p.ticket, side: p.side, owner: "pos", label: "TP", draggable: !ro, closable: !ro });
    }
    for (const o of pendings) {
      out.push({ id: `pnd:${o.ticket}`, kind: "pending", price: o.price, ref: o.ticket, side: o.side, label: t(PENDING_LABEL[`${o.side}:${o.type}`] ?? "chart.line.buyLimit", { lot: fmtVol(o.volume) }), draggable: !ro, closable: !ro, stops: ro ? undefined : { sl: o.sl === undefined, tp: o.tp === undefined } });
      if (o.sl !== undefined) out.push({ id: `psl:${o.ticket}`, kind: "sl", price: o.sl, ref: o.ticket, side: o.side, owner: "pnd", label: "SL", draggable: !ro, closable: !ro });
      if (o.tp !== undefined) out.push({ id: `ptp:${o.ticket}`, kind: "tp", price: o.tp, ref: o.ticket, side: o.side, owner: "pnd", label: "TP", draggable: !ro, closable: !ro });
    }
    for (const a of alerts) out.push({ id: `alr:${a.id}`, kind: "alert", price: a.price, ref: a.id, label: t("chart.line.alert"), draggable: true, closable: true });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions.map((p) => [p.ticket, p.openPrice, p.sl, p.tp, p.volume, p.side])), JSON.stringify(pendings.map((p) => [p.ticket, p.price, p.volume, p.side, p.type, p.sl, p.tp])), JSON.stringify(alerts.map((a) => [a.id, a.price])), ro, t]);
}

const PENDING_LABEL: Record<string, MessageKey> = {
  "buy:limit": "chart.line.buyLimit",
  "sell:limit": "chart.line.sellLimit",
  "buy:stop": "chart.line.buyStop",
  "sell:stop": "chart.line.sellStop",
  "buy:stop-limit": "chart.line.buyStopLimit",
  "sell:stop-limit": "chart.line.sellStopLimit",
};

/**
 * Which side of the price a stop must sit on, the trade engine's check_sltp: a buy's stop loss below and its take profit
 * above, a sell's the other way round, at least `gap` (the symbol's stops level) away. `ref` is the price it is checked
 * against (see stopRef). Returns the message key and the nearest allowed price, or null when the stop is fine.
 */
export function stopProblem(which: "sl" | "tp", side: "buy" | "sell", ref: number, price: number, gap = 0): { key: MessageKey; at: number } | null {
  if ((which === "sl") === (side === "buy")) {
    const at = ref - gap;
    return price <= at && price < ref ? null : { key: which === "sl" ? "chart.line.bad.slBelow" : "chart.line.bad.tpBelow", at };
  }
  const at = ref + gap;
  return price >= at && price > ref ? null : { key: which === "sl" ? "chart.line.bad.slAbove" : "chart.line.bad.tpAbove", at };
}

/** The price an SL / TP is checked against: an open position's closing price now (Bid for a buy, Ask for a sell), a
 *  pending order's entry (its stop-limit price, else its price). */
function stopRef(l: TLine, q: { bid: number; ask: number }, pendings: PendingOrder[]): number | null {
  if (l.owner === "pnd") {
    const o = pendings.find((x) => x.ticket === l.ref);
    return o ? o.stopLimit ?? o.price : null;
  }
  return l.side === "buy" ? q.bid : q.ask;
}

/** The symbol's minimum stop distance (stops level, in price). */
const stopGap = (symbol: string) => (instrumentSpec(symbol)?.stopsLevelPoints ?? 0) * pointSize(symbol);

/** Money at `price` for an SL / TP line: the position's P&L there (with its swap and commission so far), or a pending
 *  order's, counted from the order price. */
function stopMoney(l: TLine, price: number, positions: TPosition[], pendings: PendingOrder[]): number | null {
  if (l.owner === "pnd") {
    const o = pendings.find((x) => x.ticket === l.ref);
    return o ? profitAt({ symbol: o.symbol, side: o.side, volume: o.volume, openPrice: o.price }, price) : null;
  }
  const p = positions.find((x) => x.ticket === l.ref);
  return p ? profitAt(p, price) + p.swap - p.commission : null;
}

/* ------------------------------------------------------------------ */
/* Drawings                                                            */
/* ------------------------------------------------------------------ */

/** A drawing in progress (the ruler's last measurement stays on screen, `done`, until the next click on the chart). */
type Draft = { kind: "trend" | "rect" | "fib" | "ruler"; a: Anchor; b: Anchor; clickMode?: boolean; done?: boolean } | { kind: "brush"; pts: Anchor[] };
type Shape = Drawing | ({ id: string } & Draft);

/** A drawing moved by `dl` bars and `dp` in price. */
function shiftDrawing(d: Drawing, dl: number, dp: number, round: (p: number) => number): Drawing {
  const s = (a: Anchor) => ({ l: a.l + dl, p: a.p + dp });
  switch (d.kind) {
    case "hline":
      return { ...d, price: round(d.price + dp) };
    case "brush":
      return { ...d, pts: d.pts.map(s) };
    case "text":
      return { ...d, a: s(d.a) };
    default:
      return { ...d, a: s(d.a), b: s(d.b) };
  }
}

/** "3d 4h", "2h 15m", "45m": a time span for the ruler. */
function fmtSpan(sec: number) {
  const m = Math.round(Math.abs(sec) / 60);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return d ? `${d}d${h ? ` ${h}h` : ""}` : h ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
}

/* ------------------------------------------------------------------ */

export interface ChartViewProps {
  tab: ChartTab;
  active: boolean;
  onActivate: () => void;
  compact?: boolean;
  hideOneClick?: boolean;
  /** draw the accent frame of the active chart (default: when active); off with a single chart on screen */
  highlight?: boolean;
}

interface LineDrag {
  id: string;
  price: number;
  /** an SL / TP being dragged out of a chip's S or T handle: the line it becomes when dropped */
  create?: TLine;
  /** pointer start and whether it really moved (a click on S / T without a drag sets nothing) */
  y0?: number;
  moved?: boolean;
}

export function ChartView({ tab, active, onActivate, compact, hideOneClick, highlight = active }: ChartViewProps) {
  const T = useTerminal();
  const t = useT();
  const { resolvedTheme } = useTheme();
  const wrap = React.useRef<HTMLDivElement>(null);
  const el = React.useRef<HTMLDivElement>(null);
  // legend values change on every tick: they live in a small store read by the legend leaves; ChartView only
  // keeps the legend's shape (which indicator rows exist), which changes when indicators do
  const legendStore = React.useMemo(createLegendStore, []);
  const [shape, setShape] = React.useState<LegendShape>(EMPTY_SHAPE);
  const onLegend = React.useCallback(
    (l: LegendData) => {
      legendStore.set(l);
      setShape((s) => sameShape(s, l) ? s : shapeOf(l));
    },
    [legendStore],
  );
  const [legendOpen, setLegendOpen] = React.useState(false);
  // No quote subscription here: a tick must not re-render the chart overlays. Leaf components (OneClickPanel,
  // PositionChipPnl, StopDragTag) subscribe themselves; handlers read the current quote when they run.
  const quoteNow = () => priceFeed().quote(tab.symbol);
  const inst = getInstrument(tab.symbol);
  const acc = T.account;
  const tool = active ? T.drawTool : "cursor";
  const drawing = tool === "hline" || tool === "trend" || tool === "rect" || tool === "fib" || tool === "brush" || tool === "text" || tool === "ruler";
  const prefs = useDrawPrefs();
  const engine = useChartEngine(el, {
    symbol: tab.symbol,
    tf: tab.tf,
    type: tab.type,
    indicators: tab.indicators,
    theme: resolvedTheme,
    crosshair: tool === "crosshair" || drawing,
    onLegend,
  });
  const cm = useContextMenu(236);

  /* ---------------- registry for toolbar actions ---------------- */
  React.useEffect(() => {
    if (!engine) return;
    const handle: ChartHandle = {
      zoom: (d) => {
        if (!engine.alive.current) return;
        const ts = engine.chart.timeScale();
        const cur = ts.options().barSpacing;
        ts.applyOptions({ barSpacing: Math.max(2, Math.min(40, d > 0 ? cur * 1.3 : cur / 1.3)) });
      },
      fit: () => {
        if (!engine.alive.current) return;
        engine.chart.timeScale().applyOptions({ barSpacing: 7, rightOffset: 12 });
        engine.chart.timeScale().scrollToRealTime();
        engine.chart.priceScale("right").applyOptions({ autoScale: true });
      },
      screenshot: () => {
        const canvas = engine.chart.takeScreenshot(true, false);
        canvas.toBlob((b) => {
          if (!b) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = `${tab.symbol}_${tab.tf}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
        toast.success(t("chart.screenshot.saved"), { description: `${tab.symbol}, ${tab.tf} · ${canvas.width}×${canvas.height} PNG` });
      },
      setRange: (seconds) => {
        if (!engine.alive.current) return;
        const data = engine.bars.current;
        if (!data.length) return;
        // calendar time back from the latest bar (weekends included, as a date range should); older bars than the
        // history holds just start the view at the first bar (live builds then page in older history)
        const to = data[data.length - 1]!.time;
        const from = Math.max(data[0]!.time, to - seconds);
        engine.chart.priceScale("right").applyOptions({ autoScale: true });
        engine.chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
      },
    };
    chartRegistry.set(tab.id, handle);
    // a range preset that switched the timeframe: apply it once this (rebuilt) chart has its first view
    let raf = 0;
    const pending = pendingRanges.get(tab.id);
    if (pending !== undefined && engine.tf === tab.tf) {
      pendingRanges.delete(tab.id);
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => handle.setRange(pending))));
    }
    return () => {
      cancelAnimationFrame(raf);
      chartRegistry.delete(tab.id);
    };
  }, [engine, tab.id, tab.symbol, tab.tf, t]);

  /* ---------------- lines from store ---------------- */
  const ro = T.readOnly;
  const tradeLines = useTradeLines(tab.symbol);
  // an SL / TP dropped from a chip's S / T: the new line shows at once, not when the trade server answers
  const [fresh, setFresh] = React.useState<TLine | null>(null);
  const [drag, setDrag] = React.useState<LineDrag | null>(null);
  const dragRef = React.useRef(drag);
  dragRef.current = drag;
  const dragCreate = drag?.create ?? null;
  const lines = React.useMemo(() => {
    let out = tradeLines;
    for (const x of [fresh, dragCreate]) if (x && !out.some((l) => l.id === x.id)) out = [...out, x];
    return out;
  }, [tradeLines, fresh, dragCreate]);

  // a dropped SL / TP / pending line stays where it was dropped until the trade server has answered
  const [hold, setHold] = React.useState<{ id: string; price: number } | null>(null);
  const holdRef = React.useRef(hold);
  holdRef.current = hold;
  const settle = (id: string, price: number, p: Promise<boolean>) => {
    setHold({ id, price });
    void p.finally(() => setHold((h) => (h?.id === id && h.price === price ? null : h)));
  };

  /** Why an SL / TP at `price` would be rejected (translated), or null. */
  const badStop = (l: TLine, price: number) => {
    if ((l.kind !== "sl" && l.kind !== "tp") || !l.side) return null;
    const ref = stopRef(l, quoteNow(), T.pendings);
    const bad = ref === null ? null : stopProblem(l.kind, l.side, ref, price, stopGap(tab.symbol));
    return bad ? t(bad.key, { price: fmtPrice(tab.symbol, bad.at) }) : null;
  };
  const dragLine = drag ? lines.find((l) => l.id === drag.id) ?? null : null;
  const dragStop = dragLine && (dragLine.kind === "sl" || dragLine.kind === "tp") ? dragLine : null;
  const dragBad = drag && dragStop ? badStop(dragStop, drag.price) : null;

  const priceLines = React.useRef<{ owner: unknown; map: Map<string, IPriceLine> }>({ owner: null, map: new Map() });

  // sync price lines (axis labels + lines drawn by the chart)
  React.useEffect(() => {
    if (!engine || !engine.alive.current) return;
    if (priceLines.current.owner !== engine.chart) priceLines.current = { owner: engine.chart, map: new Map() }; // same chart survives theme recolours
    const c = engine.palette;
    const map = priceLines.current.map;
    // BUY blue, SELL red; SL red, TP green, pending gold, alerts amber; a stop dragged to the wrong side goes grey
    const colorOf = (l: TLine) => (dragBad && l.id === dragRef.current?.id ? c.fg3 : l.kind === "sl" ? c.down : l.kind === "tp" ? c.up : l.kind === "pending" ? c.gold : l.kind === "alert" ? c.warn : l.side === "buy" ? c.buy : c.down);
    const want = new Map<string, { price: number; color: string; style: LineStyle; width: 1 | 2; title: string }>();
    for (const l of lines) want.set(l.id, { price: l.price, color: colorOf(l), style: l.kind === "pos" ? LineStyle.Solid : l.kind === "alert" ? LineStyle.SparseDotted : LineStyle.Dashed, width: 1, title: "" });
    if (!prefs.hidden) for (const d of tab.drawings) if (d.kind === "hline") want.set(`hl:${d.id}`, { price: d.price, color: T.selectedDrawing === d.id ? c.ember : c.fg2, style: LineStyle.Solid, width: 1, title: "" });
    for (const [id, pl] of map) {
      if (!want.has(id)) {
        try {
          engine.main.removePriceLine(pl);
        } catch {
          /* chart rebuilt */
        }
        map.delete(id);
      }
    }
    for (const [id, w] of want) {
      const price = dragRef.current?.id === id ? dragRef.current.price : holdRef.current?.id === id ? holdRef.current.price : w.price;
      const opts = { price, color: w.color, lineWidth: w.width, lineStyle: w.style, axisLabelVisible: true, title: w.title, axisLabelColor: w.color, axisLabelTextColor: id.startsWith("hl:") ? (c.dark ? "#0a0a0d" : "#fff") : "#fff" };
      const ex = map.get(id);
      if (ex) ex.applyOptions(opts);
      else map.set(id, engine.main.createPriceLine(opts));
    }
  }, [engine, lines, tab.drawings, T.selectedDrawing, drag, hold, dragBad, prefs.hidden]);

  /* ---------------- geometry loop for HTML overlays ---------------- */
  const [geo, setGeo] = React.useState<{ ys: Record<string, number | null>; psw: number; w: number; h: number; dr: Record<string, number[] | null>; pt: number[] }>({ ys: {}, psw: 68, w: 0, h: 0, dr: {}, pt: [] });
  const linesRef = React.useRef(lines);
  linesRef.current = lines;
  const drawingsRef = React.useRef(tab.drawings);
  drawingsRef.current = tab.drawings;
  const hiddenRef = React.useRef(prefs.hidden);
  hiddenRef.current = prefs.hidden;
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  // a drawing being moved (selected, then dragged): its offset in bars and price, applied on release
  const [move, setMove] = React.useState<{ id: string; a0: Anchor; x0: number; y0: number; moved: boolean; dl: number; dp: number } | null>(null);
  const moveRef = React.useRef(move);
  moveRef.current = move;
  React.useEffect(() => {
    if (!engine) return;
    let raf = 0;
    // flat list of every number the overlays depend on: a frame where none changed costs no React render
    let prev: (number | string | null)[] = [];
    const sig: (number | string | null)[] = [];
    // DOM sizes are read when they change (ResizeObserver), never per frame: reading layout in the frame loop
    // forced a synchronous layout per chart per frame while ticks were mutating the page
    let w = el.current?.clientWidth ?? 0;
    let pt: number[] = [0];
    let observed: HTMLElement[] = [];
    const measure = () => {
      w = el.current?.clientWidth ?? 0;
      const panes = engine.chart.panes();
      if (panes.length > 1) {
        // pane tops (px from the chart's top) for the oscillator sub-window legends
        const top0 = el.current?.getBoundingClientRect().top ?? 0;
        pt = panes.map((p) => Math.round((p.getHTMLElement()?.getBoundingClientRect().top ?? top0) - top0));
      } else pt = [0];
    };
    const ro = new ResizeObserver(measure);
    const observe = () => {
      ro.disconnect();
      observed = engine.chart.panes().map((p) => p.getHTMLElement()).filter((x): x is HTMLElement => !!x);
      if (el.current) ro.observe(el.current);
      observed.forEach((x) => ro.observe(x));
      measure();
    };
    observe();
    const loop = () => {
      if (!engine.alive.current) return;
      const ys: Record<string, number | null> = {};
      const d = dragRef.current;
      const hd = holdRef.current;
      for (const l of linesRef.current) ys[l.id] = engine.main.priceToCoordinate(d?.id === l.id ? d.price : hd?.id === l.id ? hd.price : l.price);
      const ts = engine.chart.timeScale();
      const dr: Record<string, number[] | null> = {};
      const all: Shape[] = hiddenRef.current ? [] : [...drawingsRef.current];
      if (draftRef.current) all.push({ id: "__draft", ...draftRef.current });
      const mv = moveRef.current;
      for (const x of all) {
        const dl = mv?.id === x.id ? mv.dl : 0;
        const dp = mv?.id === x.id ? mv.dp : 0;
        const pts: Anchor[] = x.kind === "hline" ? [] : x.kind === "brush" ? x.pts : x.kind === "text" ? [x.a] : [x.a, x.b];
        if (x.kind === "hline") {
          const y = engine.main.priceToCoordinate((d?.id === `hl:${x.id}` ? d.price : x.price) + dp);
          dr[x.id] = y === null ? null : [y];
          continue;
        }
        const g: number[] = [];
        for (const a of pts) {
          const px = ts.logicalToCoordinate((a.l + dl) as never);
          const py = engine.main.priceToCoordinate(a.p + dp);
          if (px === null || py === null) break;
          g.push(px, py);
        }
        dr[x.id] = g.length === pts.length * 2 ? g : null;
      }
      const psw = engine.chart.priceScale("right").width();
      const pane0 = engine.chart.panes()[0];
      const h = pane0 ? pane0.getHeight() : 0;
      // oscillator panes added or removed: watch the new pane elements (re-measures)
      if (engine.chart.panes().length !== observed.length) observe();
      sig.length = 0;
      sig.push(psw, w, h, pt.length, ...pt);
      for (const k in ys) sig.push(k, ys[k]!);
      for (const k in dr) {
        sig.push(k);
        const g = dr[k];
        if (g) sig.push(g.length, ...g);
        else sig.push(null);
      }
      let same = sig.length === prev.length;
      for (let i = 0; same && i < sig.length; i++) same = sig[i] === prev[i];
      if (!same) {
        prev = sig.slice();
        setGeo({ ys, psw, w, h, dr, pt });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine]);

  /* ---------------- helpers ---------------- */
  const localY = (clientY: number) => clientY - (el.current?.getBoundingClientRect().top ?? 0);
  const localX = (clientX: number) => clientX - (el.current?.getBoundingClientRect().left ?? 0);
  const priceAt = (clientY: number) => {
    if (!engine) return null;
    const p = engine.main.coordinateToPrice(localY(clientY));
    return p === null ? null : roundPrice(tab.symbol, p);
  };
  const anchorAt = (clientX: number, clientY: number): Anchor | null => {
    if (!engine) return null;
    const l = engine.chart.timeScale().coordinateToLogical(localX(clientX));
    const p = engine.main.coordinateToPrice(localY(clientY));
    return l === null || p === null ? null : { l, p };
  };
  /** Magnet on: the point jumps to the bar under it and the nearest of its open, high, low and close. */
  const snap = (a: Anchor): Anchor => {
    if (!drawPrefs().magnet || !engine) return a;
    const i = Math.round(a.l);
    const bar = engine.bars.current[i];
    if (!bar) return a;
    let best = bar.open;
    for (const v of [bar.high, bar.low, bar.close]) if (Math.abs(v - a.p) < Math.abs(best - a.p)) best = v;
    return { l: i, p: best };
  };

  const hitLine = (clientY: number) => {
    const y = localY(clientY);
    let best: { id: string; d: number } | null = null;
    for (const l of linesRef.current) {
      if (!l.draggable) continue;
      const ly = geo.ys[l.id];
      if (ly == null) continue;
      const d = Math.abs(ly - y);
      if (d < 5 && (!best || d < best.d)) best = { id: l.id, d };
    }
    // horizontal lines move by dragging them too, unless drawings are locked or hidden
    if (!prefs.locked && !prefs.hidden)
      for (const d of tab.drawings) {
        if (d.kind !== "hline") continue;
        const ly = geo.dr[d.id]?.[0];
        if (ly == null) continue;
        const dd = Math.abs(ly - y);
        if (dd < 5 && (!best || dd < best.d)) best = { id: `hl:${d.id}`, d: dd };
      }
    return best?.id ?? null;
  };

  const [hover, setHover] = React.useState(false);

  const startDrag = (id: string) => {
    const l = linesRef.current.find((x) => x.id === id);
    const hl = id.startsWith("hl:") ? tab.drawings.find((d) => `hl:${d.id}` === id) : null;
    const price = l?.price ?? (hl && hl.kind === "hline" ? hl.price : null);
    if (price === null || price === undefined || !engine) return;
    engine.chart.applyOptions({ handleScroll: false, handleScale: false });
    setDrag({ id, price });
    if (hl) T.selectDrawing(hl.id);
  };

  /** Drag an SL / TP out of a position's or order's S / T handle: a new line follows the pointer from the chip's price. */
  const startStop = (l: TLine, which: "sl" | "tp", clientY: number) => {
    if (!engine || !l.side) return;
    const owner = l.kind === "pos" ? "pos" : "pnd";
    const id = `${owner === "pos" ? "" : "p"}${which}:${l.ref}`;
    const create: TLine = { id, kind: which, price: l.price, ref: l.ref, side: l.side, owner, label: which === "sl" ? "SL" : "TP", draggable: false, closable: false };
    engine.chart.applyOptions({ handleScroll: false, handleScale: false });
    setDrag({ id, price: l.price, create, y0: clientY, moved: false });
  };

  React.useEffect(() => {
    if (!drag || !engine) return;
    const move = (e: PointerEvent) => {
      const p = engine.main.coordinateToPrice(localY(e.clientY));
      if (p !== null) setDrag((d) => (d ? { ...d, price: roundPrice(tab.symbol, p), moved: d.moved || Math.abs(e.clientY - (d.y0 ?? e.clientY)) > 3 } : d));
    };
    const end = (commit: boolean) => () => {
      const d = dragRef.current;
      engine.chart.applyOptions({ handleScroll: true, handleScale: true });
      setDrag(null);
      if (d && commit) commitDrag(d);
    };
    const up = end(true);
    const cancel = end(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, engine]);

  const commitDrag = (d: LineDrag) => {
    const { id, price } = d;
    const [kind, ref] = id.split(":") as [string, string];
    if (kind === "hl") {
      editDrawings(T, tab.id, (ds) => ds.map((x) => (x.id === ref && x.kind === "hline" ? { ...x, price } : x)));
      return;
    }
    const l = d.create ?? linesRef.current.find((x) => x.id === id);
    if (!l) return;
    if (d.create && !d.moved) {
      // a click on S / T: say how it works instead of setting a stop at the entry price
      toast(t(l.kind === "sl" ? "chart.line.dragSl" : "chart.line.dragTp"), { id: "stop-hint" });
      return;
    }
    if (!d.create && Math.abs(price - l.price) < 1 / 10 ** inst.digits) return;
    if (l.kind === "sl" || l.kind === "tp") {
      // the wrong side of the price: the trade server would reject it, so nothing is sent
      const bad = badStop(l, price);
      if (bad) return void toast.warning(bad, { description: t("chart.line.bad.notSent"), id: "stop-bad" });
      const patch = l.kind === "sl" ? { sl: price } : { tp: price };
      const req = l.owner === "pnd" ? T.modifyPending(l.ref, patch) : T.modifyPosition(l.ref, patch);
      if (!d.create) return settle(id, price, req);
      setFresh({ ...l, price });
      settle(id, price, req.finally(() => setFresh((f) => (f?.id === id ? null : f))));
    } else if (l.kind === "pending") settle(id, price, T.modifyPending(l.ref, { price }));
    else if (l.kind === "alert") T.updateAlert(l.ref, { price });
  };

  /** × on a chip: close the position, remove the stop, cancel the order, delete the alert. */
  const removeLine = (l: TLine) => {
    if (l.kind === "pos") T.closePosition(l.ref);
    else if (l.kind === "sl" || l.kind === "tp") {
      const patch = l.kind === "sl" ? { sl: null } : { tp: null };
      if (l.owner === "pnd") T.modifyPending(l.ref, patch);
      else T.modifyPosition(l.ref, patch);
    } else if (l.kind === "pending") T.cancelPending(l.ref);
    else if (l.kind === "alert") T.removeAlert(l.ref);
  };

  /* ---------------- moving a drawing ---------------- */
  React.useEffect(() => {
    if (!move?.id || !engine) return;
    const mv = (e: PointerEvent) => {
      const a = anchorAt(e.clientX, e.clientY);
      if (a) setMove((m) => (m ? { ...m, moved: m.moved || Math.hypot(e.clientX - m.x0, e.clientY - m.y0) > 3, dl: a.l - m.a0.l, dp: a.p - m.a0.p } : m));
    };
    const up = () => {
      const m = moveRef.current;
      setMove(null);
      if (m?.moved) editDrawings(T, tab.id, (ds) => ds.map((x) => (x.id === m.id ? shiftDrawing(x, m.dl, m.dp, (p) => roundPrice(tab.symbol, p)) : x)));
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.id, engine]);

  /* ---------------- drawing tools ---------------- */
  const addDrawing = (d: Drawing) => {
    editDrawings(T, tab.id, (ds) => [...ds, d]);
    T.setDrawTool("cursor");
    T.selectDrawing(d.id);
  };
  // the text tool's input, at a point of the chart (a new note, or `id` when editing one)
  const [textEdit, setTextEdit] = React.useState<{ a: Anchor; id?: string; value: string } | null>(null);
  const textRef = React.useRef(textEdit);
  textRef.current = textEdit;
  const commitText = () => {
    const e = textRef.current;
    if (!e) return;
    textRef.current = null;
    setTextEdit(null);
    const text = e.value.trim();
    if (e.id) editDrawings(T, tab.id, (ds) => (text ? ds.map((d) => (d.id === e.id && d.kind === "text" ? (d.text === text ? d : { ...d, text }) : d)) : ds.filter((d) => d.id !== e.id)));
    else if (text) addDrawing({ id: uid(), kind: "text", a: e.a, text });
    if (T.drawTool === "text") T.setDrawTool("cursor");
  };
  const brushLast = React.useRef<{ x: number; y: number } | null>(null);
  const onDrawDown = (e: React.PointerEvent) => {
    if (!drawing) return;
    e.stopPropagation();
    e.preventDefault();
    const raw = anchorAt(e.clientX, e.clientY);
    if (!raw) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (tool === "brush") {
      brushLast.current = { x: e.clientX, y: e.clientY };
      setDraft({ kind: "brush", pts: [raw] });
      return;
    }
    const a = snap(raw);
    if (tool === "hline") {
      const price = roundPrice(tab.symbol, a.p);
      addDrawing({ id: uid(), kind: "hline", price });
      toast.success(t("chart.draw.hlineAdded"), { description: t("chart.draw.hlineAddedText", { symbol: tab.symbol, price: fmtPrice(tab.symbol, price) }) });
      return;
    }
    if (tool === "text") {
      if (textRef.current) return commitText();
      setTextEdit({ a, value: "" });
      return;
    }
    if (draft && draft.kind !== "brush" && draft.clickMode) {
      finishDraft({ ...draft, b: a });
      return;
    }
    if (tool === "trend" || tool === "rect" || tool === "fib" || tool === "ruler") setDraft({ kind: tool, a, b: a });
  };
  const onDrawMove = (e: React.PointerEvent) => {
    const d = draftRef.current;
    if (!d || (d.kind === "ruler" && d.done)) return;
    const raw = anchorAt(e.clientX, e.clientY);
    if (!raw) return;
    if (d.kind === "brush") {
      // a point every few pixels keeps strokes smooth and small
      const last = brushLast.current;
      if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 3) return;
      brushLast.current = { x: e.clientX, y: e.clientY };
      setDraft((x) => (x && x.kind === "brush" ? { ...x, pts: [...x.pts, raw] } : x));
      return;
    }
    const b = snap(raw);
    setDraft((x) => (x && x.kind !== "brush" ? { ...x, b } : x));
  };
  const onDrawUp = () => {
    const d = draftRef.current;
    if (!d) return;
    if (d.kind === "brush") {
      setDraft(null);
      if (d.pts.length > 1) addDrawing({ id: uid(), kind: "brush", pts: d.pts });
      return;
    }
    if (d.clickMode || d.done) return;
    const g = geo.dr["__draft"];
    const moved = g ? Math.hypot(g[2]! - g[0]!, g[3]! - g[1]!) > 6 : false;
    if (moved) finishDraft(d);
    else setDraft({ ...d, clickMode: true });
  };
  const finishDraft = (d: Extract<Draft, { a: Anchor }>) => {
    if (d.kind === "ruler") {
      // a measurement isn't saved: it stays on screen until the next click on the chart
      setDraft({ ...d, clickMode: false, done: true });
      T.setDrawTool("cursor");
      return;
    }
    setDraft(null);
    addDrawing({ id: uid(), kind: d.kind, a: d.a, b: d.b });
  };
  React.useEffect(() => {
    if (!drawing) setDraft((d) => (d && d.kind === "ruler" && d.done ? d : null));
    if (tool !== "text") commitText();
    // drawing again shows the drawings again
    if (drawing && drawPrefs().hidden) setDrawPrefs({ hidden: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, tool]);

  /* ---------------- context menu ---------------- */
  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    onActivate();
    const q = quoteNow();
    const price = priceAt(e.clientY);
    const p = price ?? q.bid;
    const ps = fmtPrice(tab.symbol, p);
    const below = p < q.bid;
    const place = (side: "buy" | "sell", type: "limit" | "stop") => {
      if (T.ws.oneClick) T.placeOrder({ symbol: tab.symbol, side, type, volume: T.ws.lot, price: p });
      else T.openNewOrder({ symbol: tab.symbol, side, type, price: p });
    };
    const trade: MenuItem[] = T.guest
      ? [
          { header: t("trader.guest.title") },
          { label: t("chart.menu.openAccount"), icon: <ShoppingCart />, onSelect: openRegister },
        ]
      : ro
      ? [{ header: t("chart.menu.readOnly") }]
      : [
          { label: t("chart.menu.buyLimitAt", { lot: fmtVol(T.ws.lot), price: ps }), icon: <ArrowUpRight />, tone: "up", disabled: !below, onSelect: () => place("buy", "limit") },
          { label: t("chart.menu.sellLimitAt", { lot: fmtVol(T.ws.lot), price: ps }), icon: <ArrowDownRight />, tone: "down", disabled: below, onSelect: () => place("sell", "limit") },
          { label: t("chart.menu.buyStopAt", { lot: fmtVol(T.ws.lot), price: ps }), icon: <ArrowUpRight />, tone: "up", disabled: below, onSelect: () => place("buy", "stop") },
          { label: t("chart.menu.sellStopAt", { lot: fmtVol(T.ws.lot), price: ps }), icon: <ArrowDownRight />, tone: "down", disabled: !below, onSelect: () => place("sell", "stop") },
          "sep",
          { label: t("chart.menu.newOrder"), icon: <ShoppingCart />, hint: "F9", onSelect: () => T.openNewOrder({ symbol: tab.symbol }) },
        ];
    cm.open(
      e,
      [
        ...trade,
        "sep",
        { label: t("chart.menu.alertAt", { price: ps }), icon: <Bell />, onSelect: () => T.addAlert({ symbol: tab.symbol, cond: p >= q.bid ? "above" : "below", price: p }) },
        {
          label: t("chart.menu.addHline"),
          icon: <Minus />,
          onSelect: () => {
            const id = uid();
            editDrawings(T, tab.id, (ds) => [...ds, { id, kind: "hline", price: p }]);
            if (drawPrefs().hidden) setDrawPrefs({ hidden: false });
            T.selectDrawing(id);
          },
        },
        "sep",
        { label: t("chart.menu.timeframes"), icon: <CandlestickChart />, items: TIMEFRAMES.map((tf) => ({ label: tf, checked: tab.tf === tf, onSelect: () => T.updateTab(tab.id, { tf, drawings: tab.tf === tf ? tab.drawings : [] }) })) },
        { label: t("chart.menu.chartType"), icon: <Layers />, items: CHART_TYPES.map((ct) => ({ label: t(`trader.chartType.${ct}`), checked: tab.type === ct, onSelect: () => T.updateTab(tab.id, { type: ct }) })) },
        {
          label: t("chart.menu.indicators"),
          icon: <SlidersHorizontal />,
          items: [
            { label: t("chart.menu.indicatorsList"), hint: "Ctrl+I", onSelect: () => openIndicatorList(tab.id) },
            "sep",
            ...INDICATOR_CATEGORIES.map((cat) => ({
              label: t.dyn(`market.nav.category.${cat.replace(/\s+/g, "").replace(/^./, (c) => c.toLowerCase())}`, cat),
              items: INDICATOR_LIST.filter((d) => d.category === cat).map((d) => ({ label: d.name, onSelect: () => addIndicator(T, tab.id, d.type) })),
            })),
            "sep",
            { label: t("chart.menu.removeAllIndicators"), danger: true, disabled: !tab.indicators.length, onSelect: () => T.updateTab(tab.id, { indicators: [] }) },
          ],
        },
        { label: t("chart.menu.crosshair"), icon: <Crosshair />, hint: "Ctrl+F", onSelect: () => T.setDrawTool(T.drawTool === "crosshair" ? "cursor" : "crosshair") },
        "sep",
        { label: t("chart.menu.zoomIn"), icon: <Plus />, hint: "+", onSelect: () => chartRegistry.get(tab.id)?.zoom(1) },
        { label: t("chart.menu.zoomOut"), icon: <Minus />, hint: "−", onSelect: () => chartRegistry.get(tab.id)?.zoom(-1) },
        { label: t("chart.menu.saveAsPicture"), icon: <Camera />, onSelect: () => chartRegistry.get(tab.id)?.screenshot() },
        { label: t("chart.menu.deleteAllObjects"), danger: true, icon: <X />, disabled: !tab.drawings.length, onSelect: () => clearDrawings(T, tab.id) },
      ],
      <span>
        {tab.symbol}, {tab.tf} · <span className="text-fg-2">{ps}</span>
      </span>,
    );
  };

  /* ---------------- render ---------------- */
  const chipRight = geo.psw + 6;
  const allMainRows = shape.main;
  // keep the overlay legend inside the main pane: extra rows fold into "+N more"
  const maxRows = Math.max(1, Math.floor(((geo.h || 400) - (ro || hideOneClick ? 40 : 96)) / 16));
  const folded = !legendOpen && allMainRows.length > maxRows;
  const mainRows = folded ? allMainRows.slice(0, maxRows - 1) : allMainRows;
  const paneRows = shape.panes;
  const indAction = (a: "toggle", uid: string) => {
    const x = tab.indicators.find((i) => i.uid === uid);
    if (x && a === "toggle") toggleIndicator(T, tab.id, x);
  };
  const shapeById = (id: string): Shape | null => (id === "__draft" ? (draft ? { id, ...draft } : null) : tab.drawings.find((x) => x.id === id) ?? null);
  const hint: MessageKey | null = !drawing
    ? null
    : tool === "hline"
    ? "chart.draw.hline"
    : draft && draft.kind !== "brush" && draft.clickMode
    ? "chart.draw.secondPoint"
    : ({ fib: "chart.draw.fib", rect: "chart.draw.rect", trend: "chart.draw.trend", brush: "chart.draw.brush", text: "chart.draw.text", ruler: "chart.draw.ruler" } as const)[tool];
  const textAt = textEdit && engine ? { x: engine.chart.timeScale().logicalToCoordinate(textEdit.a.l as never), y: engine.main.priceToCoordinate(textEdit.a.p) } : null;

  return (
    <div
      ref={wrap}
      onPointerDown={onActivate}
      onContextMenu={onContext}
      className={cn("relative h-full min-h-0 w-full select-none overflow-hidden rounded-[8px] border bg-[var(--t-chart-bg)]", highlight ? "border-ember/70 shadow-[0_0_0_1px_color-mix(in_oklab,var(--k-ember)_25%,transparent)]" : "border-line", (hover || (drag && !drag.create)) && "cursor-ns-resize")}
      onPointerDownCapture={(e) => {
        // the ruler's last measurement goes away with the next click on the chart
        if (!drawing && draftRef.current?.kind === "ruler") setDraft(null);
        if (drawing || e.button !== 0) return;
        // chips handle their own pointer (S / T handles, ×, dragging the chip): never steal it for the line under them
        if ((e.target as Element).closest("[data-line-chip],[data-stop-handle]")) return;
        // a drawing under the pointer is the more precise target: it selects / moves rather than the trade line near it
        if ((e.target as Element).closest("[data-drawing]:not([data-hline])")) return;
        const id = hitLine(e.clientY);
        if (!id) {
          if (T.selectedDrawing && !(e.target as Element).closest("[data-drawing]")) T.selectDrawing(null);
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        onActivate();
        startDrag(id);
      }}
      onPointerMove={(e) => !drag && !drawing && setHover(!!hitLine(e.clientY))}
      onPointerLeave={() => setHover(false)}
      data-chart={tab.id}
    >
      <div ref={el} className="absolute inset-0" />

      {/* drawings */}
      <svg className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-hidden" style={{ width: geo.w, height: geo.h || "100%" }}>
        {Object.entries(geo.dr).map(([id, g]) => {
          if (!g) return null;
          const d = shapeById(id);
          if (!d) return null;
          const sel = T.selectedDrawing === id;
          const col = sel ? "var(--k-ember)" : "var(--k-gold)";
          const selectProps = {
            "data-drawing": id,
            style: { pointerEvents: drawing ? "none" : "stroke", cursor: prefs.locked ? "pointer" : "move" } as React.CSSProperties,
            onPointerDown: (e: React.PointerEvent) => {
              e.stopPropagation();
              T.selectDrawing(id);
              if (e.button !== 0 || prefs.locked || d.kind === "hline") return;
              const a0 = anchorAt(e.clientX, e.clientY);
              if (a0) setMove({ id, a0, x0: e.clientX, y0: e.clientY, moved: false, dl: 0, dp: 0 });
            },
          };
          // areas (rectangle, Fibonacci, text) select anywhere inside, lines on their stroke
          const areaProps = { ...selectProps, style: { ...selectProps.style, pointerEvents: drawing ? "none" : "all" } as React.CSSProperties };
          if (d.kind === "hline") {
            return <line key={id} data-hline x1={0} x2={geo.w - geo.psw} y1={g[0]} y2={g[0]} stroke="transparent" strokeWidth={10} {...selectProps} />;
          }
          if (d.kind === "brush") {
            const points = g.reduce<string[]>((s, v, i) => (i % 2 ? (s[s.length - 1] += `,${v}`, s) : [...s, String(v)]), []).join(" ");
            return (
              <g key={id}>
                <polyline points={points} fill="none" stroke={col} strokeWidth={sel ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={points} fill="none" stroke="transparent" strokeWidth={10} {...selectProps} />
              </g>
            );
          }
          if (d.kind === "text") {
            const [x, y] = g as [number, number];
            const w = Math.max(16, d.text.length * 7.2 + 8);
            return (
              <g key={id}>
                {sel && <rect x={x - 4} y={y - 15} width={w} height={21} rx={4} fill="none" stroke={col} strokeDasharray="3 2" />}
                <text x={x} y={y} fontSize={12.5} fill={col} stroke="var(--t-chart-bg)" strokeWidth={3} style={{ paintOrder: "stroke" }} fontFamily="var(--font-geist-sans)" fontWeight={500}>
                  {d.text}
                </text>
                <rect x={x - 4} y={y - 15} width={w} height={21} fill="transparent" {...areaProps} onDoubleClick={() => !prefs.locked && setTextEdit({ a: d.a, id, value: d.text })} />
              </g>
            );
          }
          const [x1, y1, x2, y2] = g as [number, number, number, number];
          if (d.kind === "ruler") {
            const dp = d.b.p - d.a.p;
            const bars = Math.round(d.b.l - d.a.l);
            const up = dp >= 0;
            const c = up ? "var(--t-buy)" : "var(--k-down)";
            const l1 = `${up ? "+" : "−"}${fmtPrice(tab.symbol, Math.abs(dp))} (${up ? "+" : "−"}${Math.abs((dp / d.a.p) * 100).toFixed(2)}%)`;
            const l2 = `${t("chart.ruler.bars", { count: Math.abs(bars) })}, ${fmtSpan(bars * TF_SECONDS[tab.tf])}`;
            const bw = Math.max(l1.length, l2.length) * 6.4 + 14;
            const bx = Math.min(Math.max(4, (x1 + x2) / 2 - bw / 2), geo.w - geo.psw - bw - 4);
            const by = up ? Math.max(4, Math.min(y1, y2) - 40) : Math.min((geo.h || 400) - 40, Math.max(y1, y2) + 6);
            return (
              <g key={id}>
                <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill={c} fillOpacity={0.14} stroke={c} strokeOpacity={0.6} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={1} strokeDasharray="3 3" />
                <rect x={bx} y={by} width={bw} height={34} rx={5} fill={c} />
                <text x={bx + bw / 2} y={by + 14} textAnchor="middle" fontSize={10.5} fill="#fff" fontFamily="var(--font-geist-mono)">
                  {l1}
                </text>
                <text x={bx + bw / 2} y={by + 27} textAnchor="middle" fontSize={10.5} fill="#fff" fillOpacity={0.9} fontFamily="var(--font-geist-mono)">
                  {l2}
                </text>
              </g>
            );
          }
          if (d.kind === "trend")
            return (
              <g key={id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={sel ? 2 : 1.5} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={10} {...selectProps} />
                {sel && [[x1, y1], [x2, y2]].map(([a, b], i) => <rect key={i} x={a! - 3.5} y={b! - 3.5} width={7} height={7} fill="var(--t-chart-bg)" stroke={col} />)}
              </g>
            );
          if (d.kind === "rect")
            return (
              <g key={id}>
                <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill={col} fillOpacity={sel ? 0.1 : 0.08} stroke={col} strokeWidth={1} />
                <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="transparent" stroke="transparent" strokeWidth={8} {...areaProps} />
              </g>
            );
          // fibonacci retracement
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const xa = Math.min(x1, x2);
          const xb = Math.max(x1, x2, xa + 40);
          const pa = d.a.p;
          const pb = d.b.p;
          return (
            <g key={id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeDasharray="3 3" strokeWidth={1} />
              {levels.map((lv) => {
                const y = y2 + (y1 - y2) * lv;
                return (
                  <g key={lv}>
                    <line x1={xa} x2={xb} y1={y} y2={y} stroke={col} strokeOpacity={lv === 0 || lv === 1 ? 0.9 : 0.55} strokeWidth={1} />
                    <text x={xa + 3} y={y - 3} fontSize={9.5} fill={col} fontFamily="var(--font-geist-mono)">
                      {(lv * 100).toFixed(1)}% · {fmtPrice(tab.symbol, pb + (pa - pb) * lv)}
                    </text>
                  </g>
                );
              })}
              <rect x={xa} y={Math.min(y1, y2)} width={xb - xa} height={Math.abs(y2 - y1)} fill="transparent" {...areaProps} />
            </g>
          );
        })}
      </svg>

      {/* drawing capture layer */}
      {drawing && active && (
        <div className="absolute inset-0 z-[3] cursor-crosshair touch-none" style={{ right: geo.psw }} onPointerDown={onDrawDown} onPointerMove={onDrawMove} onPointerUp={onDrawUp} />
      )}

      {/* the text tool's input */}
      {textEdit && textAt && textAt.x !== null && textAt.y !== null && (
        <input
          autoFocus
          value={textEdit.value}
          placeholder={t("chart.draw.textPlaceholder")}
          aria-label={t("chart.tool.text")}
          onChange={(e) => setTextEdit((x) => (x ? { ...x, value: e.target.value } : x))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitText();
            if (e.key === "Escape") {
              textRef.current = null;
              setTextEdit(null);
              T.setDrawTool("cursor");
            }
          }}
          onBlur={commitText}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute z-[7] h-6 w-[200px] -translate-y-[17px] rounded-[5px] border border-ember/60 bg-panel-2 px-1.5 text-[12.5px] text-fg shadow-[var(--t-shadow-pop)] outline-none"
          style={{ left: textAt.x - 6, top: textAt.y }}
        />
      )}

      {/* trade line chips */}
      <div className="pointer-events-none absolute inset-0 z-[4]">
        {chipRows(lines, geo.ys, geo.h).map((row) => (
          // chips closer than a chip's height (two positions opened at the same price, SL next to a pending
          // order…) share one row, side by side from the price scale leftwards, instead of covering each other
          <div key={row.lines[0]!.id} className="absolute flex -translate-y-1/2 flex-row-reverse items-center gap-1" style={{ top: row.y, right: chipRight }}>
            {row.lines.map((l) => {
              const isDrag = drag?.id === l.id;
              const price = isDrag ? drag.price : hold?.id === l.id ? hold.price : l.price;
              const money = l.kind === "sl" || l.kind === "tp" ? stopMoney(l, price, T.positions, T.pendings) : null;
              const bad = isDrag && !!dragBad;
              const livePos = l.kind === "pos" ? T.positions.find((x) => x.ticket === l.ref) : undefined;
              // TradingView-style label: one box framed in the line's colour, a solid tag (side + lot, SL, TP, order type)
              // then the money, the TP / SL handles and ×
              const frame = bad
                ? "border-line-top"
                : l.kind === "sl" || (l.kind === "pos" && l.side === "sell")
                ? "border-down"
                : l.kind === "tp"
                ? "border-up"
                : l.kind === "pending"
                ? "border-gold"
                : l.kind === "alert"
                ? "border-warn"
                : "border-buy";
              const tag = bad
                ? "bg-surface-3 text-fg-2"
                : l.kind === "sl" || (l.kind === "pos" && l.side === "sell")
                ? "bg-down text-white"
                : l.kind === "tp"
                ? "bg-up text-white"
                : l.kind === "pending"
                ? "bg-[color-mix(in_oklab,var(--k-gold)_88%,black)] text-[#1a1204]"
                : l.kind === "alert"
                ? "bg-warn text-[#1a1204]"
                : "bg-buy text-white";
              const handles = (["tp", "sl"] as const).filter((w) => l.stops?.[w]);
              return (
                <div
                  key={l.id}
                  data-line-chip
                  className={cn("pointer-events-auto flex h-5 shrink-0 items-stretch overflow-hidden rounded-[3px] border bg-panel-2 font-sans text-[11px] font-semibold leading-none text-fg shadow-[0_2px_8px_rgba(0,0,0,0.35)]", frame, l.draggable && "cursor-ns-resize")}
                  style={row.lines.length > 1 ? { transform: `translateY(${(geo.ys[l.id] ?? row.y) - row.y}px)` } : undefined}
                  onPointerDown={(e) => {
                    if (!l.draggable || e.button !== 0) return;
                    e.stopPropagation();
                    e.preventDefault();
                    onActivate();
                    startDrag(l.id);
                  }}
                  onDoubleClick={() => (l.kind === "pos" ? T.setUi({ positionDialog: l.ref }) : l.kind === "pending" && !ro ? T.setUi({ pendingDialog: l.ref }) : undefined)}
                  title={bad ? dragBad! : l.kind === "pos" ? (ro ? undefined : t("chart.line.posTip")) : l.kind === "pending" && !ro ? t("chart.line.pendingTip") : l.draggable ? t("chart.line.dragTitle") : undefined}
                >
                  <span className={cn("flex items-center px-1.5", tag)}>
                    {l.label}
                    {isDrag && l.kind !== "pos" && <span className="k-num ml-1 opacity-80">{fmtPrice(tab.symbol, price)}</span>}
                  </span>
                  {livePos && <PositionChipPnl p={livePos} />}
                  {money !== null && <span className="k-num flex items-center px-1.5">{accMoney(acc, money, { signed: true })}</span>}
                  {handles.length > 0 && (
                    <span className="flex items-stretch">
                      {handles.map((w) => (
                        <button
                          key={w}
                          type="button"
                          data-stop-handle={w}
                          aria-label={t(w === "sl" ? "chart.line.dragSl" : "chart.line.dragTp")}
                          title={t(w === "sl" ? "chart.line.dragSl" : "chart.line.dragTp")}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            e.preventDefault();
                            onActivate();
                            startStop(l, w, e.clientY);
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className={cn("flex cursor-ns-resize touch-none items-center border-l border-line px-1.5 text-[10.5px] font-bold leading-none transition-colors", w === "sl" ? "text-down hover:bg-down hover:text-white" : "text-up hover:bg-up hover:text-white")}
                        >
                          {w === "sl" ? "SL" : "TP"}
                        </button>
                      ))}
                    </span>
                  )}
                  {l.closable && (
                    <button
                      aria-label={t("chart.line.remove", { label: l.label })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLine(l);
                      }}
                      className="grid h-full w-5 place-items-center border-l border-line text-fg-3 transition-colors hover:bg-down hover:text-white"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {/* while an SL / TP is dragged: the price, the money there, and why it can't go there */}
        {drag && dragStop && geo.ys[drag.id] != null && <StopDragTag line={dragStop} price={drag.price} symbol={tab.symbol} top={geo.ys[drag.id]!} />}
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute left-2 top-1.5 z-[5] max-w-[calc(100%-90px)]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] leading-4 text-fg-3">
          <span className="font-sans text-[11.5px] font-semibold text-fg">
            {tab.symbol}, {tab.tf}
          </span>
          {!compact && <span className="font-sans text-fg-3">{inst.name}</span>}
          <LegendOhlc store={legendStore} digits={inst.digits} compact={compact} />
        </div>
        {mainRows.length > 0 && (
          <div className="mt-0.5 flex flex-col items-start">
            {mainRows.map((uid) => (
              <LiveLegendRow key={uid} store={legendStore} uid={uid} onToggle={() => indAction("toggle", uid)} onSettings={() => openIndicatorSettings(tab.id, uid)} onRemove={() => removeIndicator(T, tab.id, uid)} />
            ))}
            {(folded || legendOpen) && allMainRows.length > maxRows && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setLegendOpen((v) => !v)}
                className="pointer-events-auto h-4 rounded-[3px] px-0.5 font-mono text-[10px] leading-4 text-fg-3 hover:text-fg"
                aria-expanded={legendOpen}
              >
                {legendOpen ? t("chart.legend.showLess") : t("chart.legend.more", { count: allMainRows.length - mainRows.length })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* sub-window legends (one per oscillator pane) */}
      {paneRows.map((r) =>
        geo.pt[r.pane] === undefined ? null : (
          <div key={r.uid} className="pointer-events-none absolute left-2 z-[5] max-w-[calc(100%-90px)]" style={{ top: geo.pt[r.pane]! + 3 }}>
            <LiveLegendRow store={legendStore} uid={r.uid} onToggle={() => indAction("toggle", r.uid)} onSettings={() => openIndicatorSettings(tab.id, r.uid)} onRemove={() => removeIndicator(T, tab.id, r.uid)} />
          </div>
        ),
      )}

      {/* one-click trading panel */}
      {!ro && !hideOneClick && (
        <OneClickPanel symbol={tab.symbol} compact={compact} top={24 + (mainRows.length ? (mainRows.length + (allMainRows.length > maxRows ? 1 : 0)) * 16 + 2 : 0)} />
      )}

      {hint && active && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-[6] -translate-x-1/2 rounded-[5px] border border-ember/40 bg-panel-2/95 px-2 py-0.5 text-[10.5px] text-fg-2">{t(hint)}</div>
      )}
      {cm.node}
    </div>
  );
}

/** Visible trade-line chips grouped into rows: lines less than one chip height apart share a row. */
function chipRows(lines: TLine[], ys: Record<string, number | null>, h: number) {
  const vis = lines.filter((l) => {
    const y = ys[l.id];
    return y != null && y >= 4 && y <= h - 4;
  });
  vis.sort((a, b) => ys[a.id]! - ys[b.id]!);
  const rows: { y: number; lines: TLine[] }[] = [];
  for (const l of vis) {
    const y = ys[l.id]!;
    const last = rows[rows.length - 1];
    if (last && y - last.y < 19) last.lines.push(l);
    else rows.push({ y, lines: [l] });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Per-tick leaves (the only parts of a chart that re-render on a tick) */
/* ------------------------------------------------------------------ */

/** Latest legend values of one chart (the bar under the crosshair, else the forming bar), outside React state. */
function createLegendStore() {
  let v: LegendData | null = null;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (l: LegendData) => {
      v = l;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
}
type LegendStore = ReturnType<typeof createLegendStore>;
interface LegendShape {
  main: string[];
  panes: { uid: string; pane: number }[];
}
const EMPTY_SHAPE: LegendShape = { main: [], panes: [] };
const shapeOf = (l: LegendData): LegendShape => ({ main: l.ind.filter((r) => r.pane <= 0).map((r) => r.uid), panes: l.ind.filter((r) => r.pane > 0).map((r) => ({ uid: r.uid, pane: r.pane })) });
function sameShape(s: LegendShape, l: LegendData) {
  let mi = 0;
  let pi = 0;
  for (const r of l.ind) {
    if (r.pane <= 0) {
      if (s.main[mi++] !== r.uid) return false;
    } else {
      const p = s.panes[pi++];
      if (!p || p.uid !== r.uid || p.pane !== r.pane) return false;
    }
  }
  return mi === s.main.length && pi === s.panes.length;
}

function LegendOhlc({ store, digits, compact }: { store: LegendStore; digits: number; compact?: boolean }) {
  const legend = React.useSyncExternalStore(store.subscribe, store.get, () => null);
  if (!legend) return null;
  const up = legend.c >= legend.o;
  return (
    <>
      {(["o", "h", "l", "c"] as const).map((k) => (
        <span key={k} className="k-num">
          {k.toUpperCase()}
          {/* the candle's colours: rising blue, falling red */}
          <span className={cn("ml-1", up ? "text-buy" : "text-down")}>{legend[k].toFixed(digits)}</span>
        </span>
      ))}
      {!compact && <span className={cn("k-num", legend.chg >= 0 ? "text-up" : "text-down")}>{legend.chg >= 0 ? "+" : ""}{legend.chg.toFixed(2)}%</span>}
    </>
  );
}

function LiveLegendRow({ store, uid, ...actions }: { store: LegendStore; uid: string; onToggle: () => void; onSettings: () => void; onRemove: () => void }) {
  const row = React.useSyncExternalStore(store.subscribe, () => store.get()?.ind.find((r) => r.uid === uid), () => undefined);
  return row ? <IndicatorLegendRow row={row} {...actions} /> : null;
}

/** Floating P&L on a position line chip: the engine's value (equity frames) or computed from the quote. */
function PositionChipPnl({ p }: { p: TPosition }) {
  const T = useTerminal();
  const pnl = usePositionProfit(p);
  return <span className={cn("k-num flex items-center px-1.5", pnl >= 0 ? "text-up" : "text-down")}>{accMoney(T.account, pnl, { signed: true })}</span>;
}

/**
 * The tag beside an SL / TP being dragged: "SL 1.08420 · −12.40", in the stop's colour, or grey with the reason when
 * the stop is on the wrong side of the price (checked against the live quote, so it follows the market while held).
 */
function StopDragTag({ line, price, symbol, top }: { line: TLine; price: number; symbol: string; top: number }) {
  const T = useTerminal();
  const t = useT();
  const q = useQuote(symbol);
  const ref = stopRef(line, q, T.pendings);
  const bad = ref === null || !line.side || (line.kind !== "sl" && line.kind !== "tp") ? null : stopProblem(line.kind, line.side, ref, price, stopGap(symbol));
  const money = stopMoney(line, price, T.positions, T.pendings);
  return (
    <div
      role="status"
      className={cn("pointer-events-none absolute left-3 flex h-5 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-1.5 font-mono text-[10.5px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]", bad ? "border border-line-top bg-surface-3 text-fg-2" : line.kind === "sl" ? "bg-down text-white" : "bg-up text-white")}
      style={{ top }}
    >
      <span className="font-semibold">{line.label}</span>
      <span>{fmtPrice(symbol, price)}</span>
      {money !== null && <span className="k-num">· {accMoney(T.account, money, { signed: true })}</span>}
      {bad && <span className="font-sans font-medium text-warn">· {t(bad.key, { price: fmtPrice(symbol, bad.at) })}</span>}
    </div>
  );
}

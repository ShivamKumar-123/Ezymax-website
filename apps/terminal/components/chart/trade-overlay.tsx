"use client";

// Trading on the chart (docs/TERMINAL-DESIGN.md §2.5 and Part 7): position, pending-order, SL / TP and alert lines with
// their chips (side and lot, P&L, the TP / SL handles, ×), dragging pending orders, stops and alerts, wrong-side stop
// checks, and the one-click Sell · lot · Buy box. Both chart engines use it: our lightweight-charts ChartView (its own
// pointer handling, price lines) and the TradingView chart through TradeOverlay below, which sits over the library's
// frame and gets the plot's geometry from a ChartCoords adapter.
import * as React from "react";
import { X } from "lucide-react";
import { toast } from "@/lib/notify";
import { getInstrument, instrumentSpec, priceFeed } from "@ezymex/mock";
import { cn, useQuote } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import { usePositionProfit, useTerminal } from "@/lib/store";
import { accMoney, fmtPrice, fmtVol, pointSize, profitAt, roundPrice, type PendingOrder, type TPosition } from "@/lib/trading";
import { OneClickPanel } from "./one-click";
import type { Palette } from "./engine";

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

const PENDING_LABEL: Record<string, MessageKey> = {
  "buy:limit": "chart.line.buyLimit",
  "sell:limit": "chart.line.sellLimit",
  "buy:stop": "chart.line.buyStop",
  "sell:stop": "chart.line.sellStop",
  "buy:stop-limit": "chart.line.buyStopLimit",
  "sell:stop-limit": "chart.line.sellStopLimit",
};

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

/** A line's colour: BUY blue, SELL red; SL red, TP green, pending gold, alerts amber; a stop dragged to the wrong side
 *  goes grey. */
export function lineColor(l: TLine, c: Palette, bad = false): string {
  return bad ? c.fg3 : l.kind === "sl" ? c.down : l.kind === "tp" ? c.up : l.kind === "pending" ? c.gold : l.kind === "alert" ? c.warn : l.side === "buy" ? c.buy : c.down;
}

/** A line being dragged. */
export interface LineDrag {
  id: string;
  price: number;
  /** an SL / TP being dragged out of a chip's S or T handle: the line it becomes when dropped */
  create?: TLine;
  /** pointer start and whether it really moved (a click on S / T without a drag sets nothing) */
  y0?: number;
  moved?: boolean;
}

/**
 * The trade lines of one chart and what happens to them: the drag in progress, an SL / TP dropped from a handle shown at
 * once (`fresh`), a dropped price held until the trade server answers (`hold`), the wrong-side check, and the actions.
 */
export function useTradeLineState(symbol: string) {
  const T = useTerminal();
  const t = useT();
  const tradeLines = useTradeLines(symbol);
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
  const linesRef = React.useRef(lines);
  linesRef.current = lines;

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
    const ref = stopRef(l, priceFeed().quote(symbol), T.pendings);
    const bad = ref === null ? null : stopProblem(l.kind, l.side, ref, price, stopGap(symbol));
    return bad ? t(bad.key, { price: fmtPrice(symbol, bad.at) }) : null;
  };
  const dragLine = drag ? lines.find((l) => l.id === drag.id) ?? null : null;
  const dragStop = dragLine && (dragLine.kind === "sl" || dragLine.kind === "tp") ? dragLine : null;
  const dragBad = drag && dragStop ? badStop(dragStop, drag.price) : null;

  /** The drag for an SL / TP pulled out of a position's or order's S / T handle: a new line from the chip's price. */
  const stopDrag = (l: TLine, which: "sl" | "tp", clientY: number): LineDrag | null => {
    if (!l.side) return null;
    const owner = l.kind === "pos" ? "pos" : "pnd";
    const id = `${owner === "pos" ? "" : "p"}${which}:${l.ref}`;
    const create: TLine = { id, kind: which, price: l.price, ref: l.ref, side: l.side, owner, label: which === "sl" ? "SL" : "TP", draggable: false, closable: false };
    return { id, price: l.price, create, y0: clientY, moved: false };
  };

  /** A finished drag of a trade line: SL / TP (checked first), pending price, alert. False for ids that aren't trade
   *  lines (a chart's own lines, e.g. horizontal-line drawings). */
  const commitTrade = (d: LineDrag): boolean => {
    const { id, price } = d;
    const l = d.create ?? linesRef.current.find((x) => x.id === id);
    if (!l) return false;
    if (d.create && !d.moved) {
      // a click on S / T: say how it works instead of setting a stop at the entry price
      toast(t(l.kind === "sl" ? "chart.line.dragSl" : "chart.line.dragTp"), { id: "stop-hint" });
      return true;
    }
    if (!d.create && Math.abs(price - l.price) < 1 / 10 ** getInstrument(symbol).digits) return true;
    if (l.kind === "sl" || l.kind === "tp") {
      // the wrong side of the price: the trade server would reject it, so nothing is sent
      const bad = badStop(l, price);
      if (bad) {
        toast.warning(bad, { description: t("chart.line.bad.notSent"), id: "stop-bad" });
        return true;
      }
      const patch = l.kind === "sl" ? { sl: price } : { tp: price };
      const req = l.owner === "pnd" ? T.modifyPending(l.ref, patch) : T.modifyPosition(l.ref, patch);
      if (!d.create) {
        settle(id, price, req);
        return true;
      }
      setFresh({ ...l, price });
      settle(id, price, req.finally(() => setFresh((f) => (f?.id === id ? null : f))));
    } else if (l.kind === "pending") settle(id, price, T.modifyPending(l.ref, { price }));
    else if (l.kind === "alert") T.updateAlert(l.ref, { price });
    return true;
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

  /** Where a line is drawn now: the dragged price, the held price, else its own. */
  const priceOf = (l: TLine) => (dragRef.current?.id === l.id ? dragRef.current.price : holdRef.current?.id === l.id ? holdRef.current.price : l.price);

  return { lines, linesRef, drag, setDrag, dragRef, hold, holdRef, dragStop, dragBad, stopDrag, commitTrade, removeLine, priceOf };
}

/** Visible trade-line chips grouped into rows: lines less than one chip height apart share a row. */
function chipRows(lines: TLine[], ys: Record<string, number | null>, min: number, max: number) {
  const vis = lines.filter((l) => {
    const y = ys[l.id];
    return y != null && y >= min + 4 && y <= max - 4;
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
/* Chips                                                               */
/* ------------------------------------------------------------------ */

export interface TradeChipsProps {
  symbol: string;
  lines: TLine[];
  /** y of each line (px from the top of the positioned parent), null when off the plot */
  ys: Record<string, number | null>;
  /** the plot's top and bottom (px): chips outside it are hidden */
  top: number;
  bottom: number;
  /** distance of the chips from the parent's right edge (the price scale plus a gap) */
  right: number;
  /** where the drag tag starts (px from the parent's left) */
  tagLeft: number;
  drag: LineDrag | null;
  hold: { id: string; price: number } | null;
  dragStop: TLine | null;
  dragBad: string | null;
  /** pointer down on a draggable chip */
  onLineDown: (l: TLine, e: React.PointerEvent) => void;
  /** pointer down on a chip's TP / SL handle */
  onStopDown: (l: TLine, which: "sl" | "tp", e: React.PointerEvent) => void;
  onRemove: (l: TLine) => void;
}

/** The chips at the right edge of the plot, one per trade line, and the tag beside a stop being dragged. */
export function TradeChips({ symbol, lines, ys, top, bottom, right, tagLeft, drag, hold, dragStop, dragBad, onLineDown, onStopDown, onRemove }: TradeChipsProps) {
  const T = useTerminal();
  const t = useT();
  const ro = T.readOnly;
  return (
    <>
      {chipRows(lines, ys, top, bottom).map((row) => (
        // chips closer than a chip's height (two positions opened at the same price, SL next to a pending
        // order…) share one row, side by side from the price scale leftwards, instead of covering each other
        <div key={row.lines[0]!.id} className="absolute flex -translate-y-1/2 flex-row-reverse items-center gap-1" style={{ top: row.y, right }}>
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
                className={cn("pointer-events-auto flex h-5 shrink-0 items-stretch overflow-hidden rounded-[3px] border bg-panel-2 font-sans text-[11px] font-semibold leading-none text-fg shadow-[0_2px_8px_rgba(0,0,0,0.35)]", frame, l.draggable && "cursor-ns-resize touch-none")}
                style={row.lines.length > 1 ? { transform: `translateY(${(ys[l.id] ?? row.y) - row.y}px)` } : undefined}
                onPointerDown={(e) => {
                  if (!l.draggable || e.button !== 0) return;
                  e.stopPropagation();
                  e.preventDefault();
                  onLineDown(l, e);
                }}
                onDoubleClick={() => (l.kind === "pos" ? T.setUi({ positionDialog: l.ref }) : l.kind === "pending" && !ro ? T.setUi({ pendingDialog: l.ref }) : undefined)}
                title={bad ? dragBad! : l.kind === "pos" ? (ro ? undefined : t("chart.line.posTip")) : l.kind === "pending" && !ro ? t("chart.line.pendingTip") : l.draggable ? t("chart.line.dragTitle") : undefined}
              >
                <span className={cn("flex items-center px-1.5", tag)}>
                  {l.label}
                  {isDrag && l.kind !== "pos" && <span className="k-num ml-1 opacity-80">{fmtPrice(symbol, price)}</span>}
                </span>
                {livePos && <PositionChipPnl p={livePos} />}
                {money !== null && <span className="k-num flex items-center px-1.5">{accMoney(T.account, money, { signed: true })}</span>}
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
                          onStopDown(l, w, e);
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
                      onRemove(l);
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
      {drag && dragStop && ys[drag.id] != null && <StopDragTag line={dragStop} price={drag.price} symbol={symbol} top={ys[drag.id]!} left={tagLeft} />}
    </>
  );
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
function StopDragTag({ line, price, symbol, top, left }: { line: TLine; price: number; symbol: string; top: number; left: number }) {
  const T = useTerminal();
  const t = useT();
  const q = useQuote(symbol);
  const ref = stopRef(line, q, T.pendings);
  const bad = ref === null || !line.side || (line.kind !== "sl" && line.kind !== "tp") ? null : stopProblem(line.kind, line.side, ref, price, stopGap(symbol));
  const money = stopMoney(line, price, T.positions, T.pendings);
  return (
    <div
      role="status"
      className={cn("pointer-events-none absolute flex h-5 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-1.5 font-mono text-[10.5px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]", bad ? "border border-line-top bg-surface-3 text-fg-2" : line.kind === "sl" ? "bg-down text-white" : "bg-up text-white")}
      style={{ top, left }}
    >
      <span className="font-semibold">{line.label}</span>
      <span>{fmtPrice(symbol, price)}</span>
      {money !== null && <span className="k-num">· {accMoney(T.account, money, { signed: true })}</span>}
      {bad && <span className="font-sans font-medium text-warn">· {t(bad.key, { price: fmtPrice(symbol, bad.at) })}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The overlay over a TradingView chart                                */
/* ------------------------------------------------------------------ */

/** The plot of a chart in the overlay's pixels (the overlay covers the chart's frame exactly). */
export interface PlotFrame {
  top: number;
  left: number;
  width: number;
  height: number;
  /** width of the price scale at the plot's right (chips sit just left of it) */
  scaleWidth: number;
  priceToY: (price: number) => number | null;
  yToPrice: (y: number) => number | null;
}

/** Geometry of a chart engine for the overlay, polled every animation frame; null while lines can't be placed (not
 *  ready, a percentage or indexed scale). */
export interface ChartCoords {
  frame(): PlotFrame | null;
}

/** A trade line as the chart should draw it (in the library, so it shows in screenshots too). */
export interface DrawnLine {
  id: string;
  price: number;
  line: TLine;
  /** a stop dragged to the wrong side */
  bad: boolean;
}

export interface TradeOverlayProps {
  symbol: string;
  coords: ChartCoords;
  onActivate: () => void;
  /** the lines to draw, whenever they change (prices included, while dragging too) */
  onLines: (lines: DrawnLine[]) => void;
  /** where the one-click box sits (px from the overlay's top; left = the plot's left), or null for none */
  oneClick: { top: number; compact?: boolean } | null;
  /** the chart's own menu or dialog is open: the overlay steps aside */
  hidden?: boolean;
}

const SAME = (a: (number | string | null)[], b: (number | string | null)[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Chips, handles and the one-click box over a chart that lives in its own frame (TradingView): pointer events over the
 * frame never reach the page, so draggable lines get a thin grab strip of ours, and a drag covers the whole chart with a
 * shield that keeps the pointer until it is released.
 */
export function TradeOverlay({ symbol, coords, onActivate, onLines, oneClick, hidden }: TradeOverlayProps) {
  const st = useTradeLineState(symbol);
  const { lines, linesRef, drag, setDrag, dragRef, hold, dragStop, dragBad } = st;
  const box = React.useRef<HTMLDivElement>(null);
  const [geo, setGeo] = React.useState<{ f: Omit<PlotFrame, "priceToY" | "yToPrice"> | null; ys: Record<string, number | null> }>({ f: null, ys: {} });
  const frameRef = React.useRef<PlotFrame | null>(null);

  // geometry: one React render only when a number the overlay depends on changed
  React.useEffect(() => {
    let raf = 0;
    let prev: (number | string | null)[] = [];
    const sig: (number | string | null)[] = [];
    const loop = () => {
      const f = coords.frame();
      frameRef.current = f;
      const ys: Record<string, number | null> = {};
      sig.length = 0;
      if (f) {
        sig.push(f.top, f.left, f.width, f.height, f.scaleWidth);
        for (const l of linesRef.current) {
          const y = f.priceToY(st.priceOf(l));
          ys[l.id] = y === null ? null : Math.round(y * 2) / 2;
          sig.push(l.id, ys[l.id]!);
        }
      }
      if (!SAME(sig, prev)) {
        prev = sig.slice();
        setGeo({ f: f && { top: f.top, left: f.left, width: f.width, height: f.height, scaleWidth: f.scaleWidth }, ys });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  // the lines the chart draws: every change of the set or a price (dragged, held)
  const drawn = React.useMemo(() => lines.map((l): DrawnLine => ({ id: l.id, price: drag?.id === l.id ? drag.price : hold?.id === l.id ? hold.price : l.price, line: l, bad: !!dragBad && drag?.id === l.id })), [lines, drag, hold, dragBad]);
  const onLinesRef = React.useRef(onLines);
  onLinesRef.current = onLines;
  React.useEffect(() => onLinesRef.current(drawn), [drawn]);

  const localY = (clientY: number) => clientY - (box.current?.getBoundingClientRect().top ?? 0);
  const priceAt = (clientY: number) => {
    const p = frameRef.current?.yToPrice(localY(clientY));
    return p == null ? null : roundPrice(symbol, p);
  };

  const startDrag = (l: TLine) => {
    onActivate();
    setDrag({ id: l.id, price: l.price });
  };
  const startStop = (l: TLine, which: "sl" | "tp", clientY: number) => {
    onActivate();
    const d = st.stopDrag(l, which, clientY);
    if (d) setDrag(d);
  };

  // the drag: the shield holds the pointer; release commits, cancel drops
  React.useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = priceAt(e.clientY);
      if (p !== null) setDrag((d) => (d ? { ...d, price: p, moved: d.moved || Math.abs(e.clientY - (d.y0 ?? e.clientY)) > 3 } : d));
    };
    const end = (commit: boolean) => () => {
      const d = dragRef.current;
      setDrag(null);
      if (d && commit) st.commitTrade(d);
    };
    const up = end(true);
    const cancel = end(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const f = geo.f;
  return (
    <div ref={box} className={cn("pointer-events-none absolute inset-0 z-[4] overflow-hidden", hidden && !drag && "invisible")}>
      {f && (
        <>
          {/* grab strips over the lines that move (the chart's frame would swallow the pointer) */}
          {lines.map((l) => {
            const y = geo.ys[l.id];
            if (!l.draggable || y == null || y < f.top || y > f.top + f.height || drag) return null;
            return (
              <div
                key={l.id}
                data-line-grab={l.id}
                className="pointer-events-auto absolute h-[9px] -translate-y-1/2 cursor-ns-resize touch-none"
                style={{ top: y, left: f.left, width: f.width }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  startDrag(l);
                }}
              />
            );
          })}
          <TradeChips
            symbol={symbol}
            lines={lines}
            ys={geo.ys}
            top={f.top}
            bottom={f.top + f.height}
            right={f.scaleWidth + 6}
            tagLeft={f.left + 12}
            drag={drag}
            hold={hold}
            dragStop={dragStop}
            dragBad={dragBad}
            onLineDown={(l) => startDrag(l)}
            onStopDown={(l, w, e) => startStop(l, w, e.clientY)}
            onRemove={st.removeLine}
          />
          {oneClick && <OneClickPanel symbol={symbol} compact={oneClick.compact} top={oneClick.top} left={f.left + 8} className="pointer-events-auto" />}
        </>
      )}
      {/* while dragging: the whole chart keeps the pointer (pointer events over the frame never reach the page) */}
      {drag && <div className="pointer-events-auto absolute inset-0 z-[9] cursor-ns-resize touch-none" aria-hidden />}
    </div>
  );
}

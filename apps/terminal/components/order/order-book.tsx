"use client";

// The order book card (docs/TERMINAL-DESIGN.md §2.2, §2.4 Order book): asks on top in red, bids below in green, depth
// bars growing from the right (by level or cumulative), a centred spread row with the mid price, its arrow and the
// spread, a view switch (both / bids / asks), price grouping, a subtle flash on changed levels and the buy/sell ratio
// bar. A click on a level fills the order form with a limit order at that price (one-click on: sends it at once).
// BookView is presentational: CFD depth (CfdOrderBook) and the options book feed it the same way.
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, Rows3, PanelTopClose, PanelBottomClose, SlidersHorizontal } from "lucide-react";
import { IS_DEMO, getInstrument, priceFeed, type DepthBook } from "@ezymex/mock";
import { cn, useQuote } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { useMarketOpen } from "@/lib/market-hours";
import { fmtPrice, fmtVol, pipSize, serverTime } from "@/lib/trading";
import { DropMenu } from "@/components/ui/menu";
import { Tip } from "@/components/ui/kit";

export interface BookLevel {
  price: number;
  size: number | null;
  /** the trader's own resting size at this price */
  mine?: number;
}
export type BookViewMode = "both" | "bids" | "asks";

interface Row extends BookLevel {
  total: number | null;
}

const cum = (levels: BookLevel[]): Row[] => {
  let t = 0;
  let sized = true;
  return levels.map((l) => {
    if (l.size === null) sized = false;
    t += l.size ?? 0;
    return { ...l, total: sized ? t : null };
  });
};

/** One level: price, size, running total, the depth bar behind it; flashes softly when its size changes. */
const LevelRow = React.memo(function LevelRow({ l, side, max, cumulative, fmtP, fmtS, onPick, title }: { l: Row; side: "ask" | "bid"; max: number; cumulative: boolean; fmtP: (p: number) => string; fmtS: (s: number) => string; onPick?: () => void; title?: string }) {
  const prev = React.useRef(l.size);
  const [flash, setFlash] = React.useState<"up" | "down" | null>(null);
  React.useEffect(() => {
    if (prev.current !== null && l.size !== null && prev.current !== l.size) {
      setFlash(side === "bid" ? "up" : "down");
      const id = setTimeout(() => setFlash(null), 600);
      prev.current = l.size;
      return () => clearTimeout(id);
    }
    prev.current = l.size;
  }, [l.size, side]);
  const v = cumulative ? l.total : l.size;
  const w = v !== null && max > 0 ? Math.min(100, (v / max) * 100) : 0;
  const ask = side === "ask";
  return (
    <div
      role={onPick ? "button" : undefined}
      tabIndex={onPick ? 0 : undefined}
      onClick={onPick}
      onKeyDown={(e) => onPick && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick())}
      title={title}
      className={cn("group relative grid h-[22px] shrink-0 grid-cols-[1fr_0.9fr_0.9fr] items-center px-3 font-mono text-[12px]", onPick && "cursor-pointer hover:bg-surface-3/60", flash === "up" && "t-flash-up", flash === "down" && "t-flash-down")}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-px end-0 rounded-s-[3px] transition-[width] duration-300 ease-out"
        style={{ width: `${w}%`, background: `linear-gradient(to left, color-mix(in oklab, var(${ask ? "--k-down" : "--k-up"}) var(--t-depth), transparent), color-mix(in oklab, var(${ask ? "--k-down" : "--k-up"}) 5%, transparent))` }}
      />
      <span className={cn("k-num relative font-medium", ask ? "text-down" : "text-up")}>
        {fmtP(l.price)}
        {l.mine ? <span className="ms-1 inline-block size-1.5 rounded-full bg-ember align-middle" /> : null}
      </span>
      <span className="k-num relative text-end text-fg">{l.size === null ? "—" : fmtS(l.size)}</span>
      <span className="k-num relative text-end text-fg-3">{l.total === null ? "—" : fmtS(l.total)}</span>
    </div>
  );
});

export function BookView({
  asks,
  bids,
  fmtP,
  fmtS,
  mid,
  spread,
  note,
  onPick,
  pickTitle,
  groups,
  group,
  onGroup,
  sizeLabel,
  className,
}: {
  asks: BookLevel[];
  bids: BookLevel[];
  fmtP: (p: number) => string;
  fmtS: (s: number) => string;
  mid: { text: string; dir: 1 | -1 | 0 } | null;
  spread: string | null;
  note?: React.ReactNode;
  /** a click on a level: which side of the book it is on and its price */
  onPick?: (level: "ask" | "bid", price: number) => void;
  pickTitle?: (level: "ask" | "bid", price: string) => string;
  groups?: { value: number; label: string }[];
  group?: number;
  onGroup?: (g: number) => void;
  sizeLabel?: string;
  className?: string;
}) {
  const t = useT();
  const [view, setView] = React.useState<BookViewMode>("both");
  const [cumulative, setCumulative] = React.useState(true);
  const a = cum(asks);
  const b = cum(bids);
  const max = cumulative ? Math.max(a[a.length - 1]?.total ?? 0, b[b.length - 1]?.total ?? 0) : Math.max(0, ...asks.map((x) => x.size ?? 0), ...bids.map((x) => x.size ?? 0));
  const sumA = asks.reduce((s, x) => s + (x.size ?? 0), 0);
  const sumB = bids.reduce((s, x) => s + (x.size ?? 0), 0);
  const bidPct = sumA + sumB > 0 ? (sumB / (sumA + sumB)) * 100 : 50;
  const sized = asks.some((x) => x.size !== null) || bids.some((x) => x.size !== null);
  const head = "text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3";
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* controls */}
      <div className="flex h-8 shrink-0 items-center gap-1 px-2">
        <div role="radiogroup" aria-label={t("desk.ob.view")} className="flex items-center gap-0.5 rounded-[7px] border border-line bg-panel-2 p-0.5">
          {(
            [
              ["both", <Rows3 key="b" />, t("desk.ob.viewBoth")],
              ["bids", <PanelTopClose key="i" />, t("desk.ob.viewBids")],
              ["asks", <PanelBottomClose key="a" />, t("desk.ob.viewAsks")],
            ] as const
          ).map(([v, icon, label]) => (
            <Tip key={v} content={label} side="bottom">
              <button type="button" role="radio" aria-checked={view === v} aria-label={label} onClick={() => setView(v)} className={cn("grid size-5 place-items-center rounded-[5px] [&_svg]:size-3.5", view === v ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg")}>
                {icon}
              </button>
            </Tip>
          ))}
        </div>
        {note && <span className="min-w-0 truncate ps-1 text-[11px] text-fg-3">{note}</span>}
        <DropMenu
          align="end"
          width={220}
          items={[
            ...(groups?.length ? [{ header: t("desk.ob.group") }, ...groups.map((g) => ({ label: g.label, checked: g.value === group, keepOpen: false, onSelect: () => onGroup?.(g.value) }))] : []),
            ...(groups?.length ? (["sep"] as const) : []),
            { label: t("desk.ob.cumulative"), checked: cumulative, onSelect: () => setCumulative(!cumulative) },
          ]}
          trigger={({ toggle, open }) =>
            groups?.length ? (
              <Tip content={t("desk.ob.group")} side="bottom">
                <button type="button" onClick={toggle} aria-expanded={open} className={cn("ms-auto flex h-6 items-center gap-1 rounded-[6px] border border-line bg-panel-2 px-1.5 font-mono text-[11.5px] text-fg-2 hover:text-fg", open && "text-fg")}>
                  {groups.find((g) => g.value === group)?.label ?? "—"}
                  <ChevronDown className="size-3 text-fg-3" />
                </button>
              </Tip>
            ) : (
              <Tip content={t("desk.ob.settings")} side="bottom">
                <button type="button" onClick={toggle} aria-expanded={open} aria-label={t("desk.ob.settings")} className={cn("ms-auto grid size-6 place-items-center rounded-[6px] border border-line bg-panel-2 text-fg-2 hover:text-fg", open && "text-fg")}>
                  <SlidersHorizontal className="size-3.5" />
                </button>
              </Tip>
            )
          }
        />
      </div>
      <div className={cn("grid h-6 shrink-0 grid-cols-[1fr_0.9fr_0.9fr] items-center border-b border-line px-3", head)}>
        <span>{t("order.dom.price")}</span>
        <span className="text-end">{sizeLabel ?? t("trader.opt.depth.size")}</span>
        <span className="text-end">{t("trader.opt.depth.cum")}</span>
      </div>
      {/* asks: worst at the top, best next to the spread */}
      {view !== "bids" && (
        <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden py-0.5 [mask-image:linear-gradient(to_bottom,transparent,#000_20px)]">
          {[...a].reverse().map((l) => (
            <LevelRow key={`a${l.price}`} l={l} side="ask" max={max} cumulative={cumulative} fmtP={fmtP} fmtS={fmtS} onPick={onPick ? () => onPick("ask", l.price) : undefined} title={pickTitle?.("ask", fmtP(l.price))} />
          ))}
        </div>
      )}
      <div className="flex h-9 shrink-0 items-center gap-2 border-y border-line bg-panel-2/70 px-3">
        <span className={cn("k-num flex items-center gap-1 font-mono text-[15px] font-semibold", mid?.dir === 1 ? "text-up" : mid?.dir === -1 ? "text-down" : "text-fg")}>
          {mid?.dir === 1 ? <ArrowUp className="size-3.5" /> : mid?.dir === -1 ? <ArrowDown className="size-3.5" /> : null}
          {mid?.text ?? "—"}
        </span>
        {spread && (
          <span className="ms-auto text-[11.5px] text-fg-3">
            {t("order.dom.spread")} <span className="k-num font-mono text-fg-2">{spread}</span>
          </span>
        )}
      </div>
      {view !== "asks" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-0.5 [mask-image:linear-gradient(to_top,transparent,#000_20px)]">
          {b.map((l) => (
            <LevelRow key={`b${l.price}`} l={l} side="bid" max={max} cumulative={cumulative} fmtP={fmtP} fmtS={fmtS} onPick={onPick ? () => onPick("bid", l.price) : undefined} title={pickTitle?.("bid", fmtP(l.price))} />
          ))}
        </div>
      )}
      {/* buy / sell ratio */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-t border-line px-3 font-mono text-[11.5px]" title={sized ? undefined : t("order.dom.unavailable")}>
        <span className="flex items-center gap-1 text-up">
          <span className="rounded-[4px] bg-up-soft px-1 font-sans text-[10.5px] font-semibold">B</span>
          {sized ? `${bidPct.toFixed(0)}%` : "—"}
        </span>
        <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span className="h-full rounded-s-full bg-up transition-[width] duration-500" style={{ width: `${sized ? bidPct : 50}%` }} />
          <span className="h-full flex-1 rounded-e-full bg-down" />
        </span>
        <span className="flex items-center gap-1 text-down">
          {sized ? `${(100 - bidPct).toFixed(0)}%` : "—"}
          <span className="rounded-[4px] bg-down-soft px-1 font-sans text-[10.5px] font-semibold">S</span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CFD depth                                                           */
/* ------------------------------------------------------------------ */

/** The market-data depth stream for `symbol` (null until the first book, or while the service is unreachable). */
export function useDepth(symbol: string): DepthBook | null {
  const [book, setBook] = React.useState<DepthBook | null>(null);
  React.useEffect(() => {
    setBook(null);
    return priceFeed().subscribeDepth(symbol, setBook);
  }, [symbol]);
  return book?.symbol === symbol ? book : null;
}

/** Deterministic pseudo sizes for the demo build's indicative ladder (never used in live builds). */
// keyed by the level's price, so a level keeps its size while the market moves (no flashing on every tick)
const demoSize = (symbol: string, price: number, step: number) => {
  let h = 2166136261;
  for (const c of `${symbol}:${Math.round(price / step)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.round((2 + ((h >>> 0) % 1000) / 60) * 10) / 10;
};

const LEVELS = 14;

/** CFD depth of the active symbol in the order-book card; a click fills the order form (one-click on: sends a limit). */
export function CfdOrderBook({ symbol }: { symbol: string }) {
  const T = useTerminal();
  const t = useT();
  const book = useDepth(symbol);
  const q = useQuote(symbol);
  const open = useMarketOpen(symbol);
  const inst = getInstrument(symbol);
  const pip = pipSize(inst);
  const base = inst.assetClass === "crypto" && pip === 1 ? 5 : inst.assetClass === "indices" ? 0.5 : inst.symbol === "XAUUSD" ? 0.1 : pip / 2;
  const [mult, setMult] = React.useState(1);
  React.useEffect(() => {
    setMult(1);
  }, [symbol]);
  const step = base * mult;
  const mine = new Set(T.pendings.filter((p) => p.symbol === symbol).map((p) => fmtPrice(symbol, p.price)));
  const round = (p: number, up: boolean) => (up ? Math.ceil(p / step - 1e-9) : Math.floor(p / step + 1e-9)) * step;
  const group = (levels: [number, number][], up: boolean): BookLevel[] => {
    const m = new Map<string, BookLevel>();
    for (const [px, size] of levels) {
      const g = round(px, up);
      const k = fmtPrice(symbol, g);
      const cur = m.get(k);
      if (cur) cur.size = (cur.size ?? 0) + size;
      else m.set(k, { price: +g.toFixed(inst.digits), size, mine: mine.has(k) ? 1 : 0 });
    }
    return [...m.values()].slice(0, LEVELS);
  };
  let asks: BookLevel[];
  let bids: BookLevel[];
  let note: React.ReactNode = null;
  if (book) {
    asks = group(book.asks, true);
    bids = group(book.bids, false);
    note = book.src === "feed" ? t("order.dom.feed") : <Tip content={t("order.dom.indicativeTitle")}><span tabIndex={0}>{t("order.dom.indicative")}</span></Tip>;
  } else {
    // no depth stream: price levels from the live bid/ask (sizes only in the demo build, labelled)
    const a0 = round(q.ask, true);
    const b0 = round(q.bid, false);
    asks = Array.from({ length: LEVELS }, (_, i) => ({ price: +(a0 + i * step).toFixed(inst.digits), size: IS_DEMO ? demoSize(symbol, a0 + i * step, step) : null, mine: mine.has(fmtPrice(symbol, a0 + i * step)) ? 1 : 0 }));
    bids = Array.from({ length: LEVELS }, (_, i) => ({ price: +(b0 - i * step).toFixed(inst.digits), size: IS_DEMO ? demoSize(symbol, b0 - i * step, step) : null, mine: mine.has(fmtPrice(symbol, b0 - i * step)) ? 1 : 0 }));
    note = IS_DEMO ? <Tip content={t("order.dom.indicativeTitle")}><span tabIndex={0}>{t("desk.ob.demoNote")}</span></Tip> : t("order.dom.unavailable");
  }
  const spreadPts = Math.round((q.ask - q.bid) * 10 ** inst.digits);
  const pick = (level: "ask" | "bid", price: number) => {
    if (T.readOnly || T.guest || !open) return;
    // the DOM convention: a bid level rests a buy limit there, an ask level a sell limit
    const s = level === "bid" ? "buy" : "sell";
    if (T.ws.oneClick) void T.placeOrder({ symbol, side: s, type: "limit", volume: T.ws.lot, price });
    else T.openNewOrder({ symbol, side: s, type: "limit", price });
  };
  return (
    <BookView
      asks={asks}
      bids={bids}
      fmtP={(p) => fmtPrice(symbol, p)}
      fmtS={(s) => fmtVol(s)}
      mid={{ text: fmtPrice(symbol, (q.bid + q.ask) / 2), dir: q.dir }}
      spread={`${spreadPts}`}
      note={note}
      onPick={T.readOnly || T.guest ? undefined : pick}
      pickTitle={(level, price) => (level === "ask" ? t("order.dom.sellLimitAt", { price }) : t("order.dom.buyLimitAt", { price }))}
      groups={[1, 2, 5, 10].map((m) => ({ value: m, label: String(+(base * m).toFixed(inst.digits)) }))}
      group={mult}
      onGroup={setMult}
      sizeLabel={t("desk.ob.lots")}
    />
  );
}

/** Recent price ticks of the symbol (CFD "Ticks" tab): time, bid, ask, direction. */
export function TickTape({ symbol }: { symbol: string }) {
  const t = useT();
  const [rows, setRows] = React.useState<{ t: number; bid: number; ask: number; dir: 1 | -1 | 0 }[]>([]);
  React.useEffect(() => {
    setRows([]);
    const feed = priceFeed();
    let last = 0;
    return feed.subscribe([symbol], (q) => {
      if (q.bid === last) return;
      const dir = last === 0 ? 0 : q.bid > last ? 1 : -1;
      last = q.bid;
      setRows((r) => [{ t: Date.now(), bid: q.bid, ask: q.ask, dir: dir as 1 | -1 | 0 }, ...r].slice(0, 60));
    });
  }, [symbol]);
  const head = "sticky top-0 z-[1] h-6 bg-panel px-3 text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3";
  return (
    <div className="t-scroll h-full min-h-0 overflow-y-auto">
      <div className={cn("grid grid-cols-[1fr_1fr_1fr] items-center border-b border-line", head)}>
        <span>{t("trader.opt.tape.time")}</span>
        <span className="text-end">{t("desk.ob.bid")}</span>
        <span className="text-end">{t("desk.ob.ask")}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.t + ":" + i} className={cn("grid h-[22px] grid-cols-[1fr_1fr_1fr] items-center px-3 font-mono text-[12px]", i === 0 && "animate-[t-fade_.5s_ease-out]")}>
          <span className="text-fg-3">{serverTime(new Date(r.t)).time}</span>
          <span className={cn("k-num text-end", r.dir === 1 ? "text-up" : r.dir === -1 ? "text-down" : "text-fg")}>{fmtPrice(symbol, r.bid)}</span>
          <span className="k-num text-end text-fg-2">{fmtPrice(symbol, r.ask)}</span>
        </div>
      ))}
      {!rows.length && <div className="px-3 py-6 text-center text-[12px] text-fg-3">{t("desk.ob.waiting")}</div>}
    </div>
  );
}


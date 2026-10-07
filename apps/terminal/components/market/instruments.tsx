"use client";

// Instruments: the first tab of the right-hand column (docs/TERMINAL-DESIGN.md §2.2), like MT5 web's "Search symbol"
// list: search, an asset-class filter with ★ Favourites, then Symbol · Bid · Ask · Daily change. Built for a catalogue of
// 1,000+ markets:
//   - virtualised: only the rows on screen (plus a few) are rendered, so only they listen to prices;
//   - fast search (symbol first, then name) over the whole catalogue, ↑ ↓ Enter from the search box;
//   - asset classes come from the catalogue itself, so new classes appear without a code change.
// The network subscription of the price feed (packages/mock) still covers the whole catalogue; see the doc §3.5.
// A row opens its market on the chart; Bid / Ask open the order form with that side; double-click = New order;
// ⋯ / right-click = the row menu; hovering shows the day range. `?stress=1500` adds generated test markets.
import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "@/lib/notify";
import { BarChart2, Clock3, Eye, EyeOff, FileText, Info, LayoutGrid, List, MoreHorizontal, Search, ShoppingCart, Star, TrendingUp, X } from "lucide-react";
import { ALL_INSTRUMENTS, ASSET_CLASS_LABEL, getInstrument, liveTradable, type Instrument, type Quote } from "@kalks/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import type { T as Translate } from "@kalks/i18n";
import { useTerminal, type Segment } from "@/lib/store";
import { getRange, useMarketClock } from "@/lib/market";
import { fmtPrice } from "@/lib/trading";
import { EmptyState, Segmented } from "@/components/ui/kit";
import { useContextMenu, type MenuItem } from "@/components/ui/menu";
import { STRESS_COUNT, STRESS_INSTRUMENTS, isStressSymbol, stressQuote, subscribeStress } from "@/lib/stress-instruments";
import { showSide } from "@/components/shell/commands";

const ROW = 32;
const CARD = 124;
const OVERSCAN = 8;
/** known asset classes first, in this order; anything new the catalogue brings follows alphabetically */
const ORDER = ["forex", "metals", "indices", "energies", "crypto", "stocks"];

const classLabel = (c: string, t: Translate) => t.dyn(`market.segment.${c}`, (ASSET_CLASS_LABEL as Record<string, string>)[c] ?? c.charAt(0).toUpperCase() + c.slice(1));

/** The whole list the panel can show: the catalogue (and generated test markets with `?stress=`). */
function useCatalogue(): Instrument[] {
  // the 28 core instruments and the provider catalogue (1,400+); in live builds the feed drops markets it has no price for
  return React.useMemo(() => (STRESS_COUNT ? [...ALL_INSTRUMENTS, ...STRESS_INSTRUMENTS] : ALL_INSTRUMENTS), []);
}

/** One row's quote: the live feed, or the simulated price of a generated test market. Rows mount only while visible. */
function useRowQuote(symbol: string): Quote {
  const stress = isStressSymbol(symbol);
  const live = useQuote(stress ? "" : symbol);
  const [sq, setSq] = React.useState<Quote | null>(() => (stress ? stressQuote(symbol) : null));
  React.useEffect(() => {
    if (!stress) return;
    let raf = 0;
    const off = subscribeStress(symbol, () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), setSq(stressQuote(symbol))));
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [symbol, stress]);
  return stress && sq ? sq : live;
}

/** Search rank: symbol prefix, then symbol contains, then name contains; -1 = no match. */
function rank(i: Instrument, q: string): number {
  if (!q) return 0;
  const s = i.symbol.toLowerCase();
  if (s.startsWith(q)) return 0;
  if (s.includes(q)) return 1;
  return i.name.toLowerCase().includes(q) ? 2 : -1;
}

export function InstrumentsPanel() {
  const T = useTerminal();
  const t = useT();
  const all = useCatalogue();
  const [q, setQ] = React.useState("");
  const [cursor, setCursor] = React.useState(-1);
  const view = T.ws.mwTab === "details" ? "cards" : "list";
  const seg = T.ws.mwSegment as string;
  const favs = T.ws.favourites;
  const hidden = T.ws.hidden;
  const cm = useContextMenu(256);
  const [hover, setHover] = React.useState<{ symbol: string; rect: DOMRect } | null>(null);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => void (hoverTimer.current && clearTimeout(hoverTimer.current)), []);

  const base = React.useMemo(() => (hidden.length ? all.filter((i) => !hidden.includes(i.symbol)) : all), [all, hidden]);
  // asset classes with their counts, taken before the text search so they stay put while typing
  const classes = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const i of base) m.set(i.assetClass, (m.get(i.assetClass) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  }, [base]);
  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const inSeg = (i: Instrument) => seg === "all" || (seg === "favourites" ? favs.includes(i.symbol) : i.assetClass === seg);
    const out: { i: Instrument; r: number; c: number }[] = [];
    for (const i of base) {
      if (!inSeg(i)) continue;
      const r = rank(i, needle);
      if (r < 0) continue;
      out.push({ i, r, c: ORDER.indexOf(i.assetClass) + 1 || 99 });
    }
    // searching: best match first; browsing: by asset class (catalogue order inside a class)
    out.sort((a, b) => (needle ? a.r - b.r : 0) || a.c - b.c);
    return out.map((x) => x.i);
  }, [base, q, seg, favs]);
  React.useEffect(() => {
    setCursor(-1);
  }, [q, seg]);

  const liveAccount = !T.guest && T.account.type === "live";
  // stable handlers (the terminal context changes on every tick): rows re-render only when their own props change
  const Tref = React.useRef(T);
  Tref.current = T;
  const toggleFav = React.useCallback((symbol: string) => Tref.current.setWs((w) => ({ favourites: w.favourites.includes(symbol) ? w.favourites.filter((s) => s !== symbol) : [...w.favourites, symbol] })), []);
  const open = React.useCallback((symbol: string) => !isStressSymbol(symbol) && Tref.current.openSymbol(symbol), []);
  const order = React.useCallback((symbol: string, side?: "buy" | "sell") => !isStressSymbol(symbol) && !Tref.current.readOnly && Tref.current.openNewOrder({ symbol, side, type: "market" }), []);

  const menuFor = (symbol: string): MenuItem[] => {
    const fav = favs.includes(symbol);
    return [
      { label: t("market.menu.newOrder"), icon: <ShoppingCart />, hint: "F9", disabled: T.readOnly, onSelect: () => T.openNewOrder({ symbol }) },
      { label: t("market.menu.chartWindow"), icon: <BarChart2 />, onSelect: () => T.addTab(symbol) },
      { label: t("market.menu.openInActive"), icon: <TrendingUp />, onSelect: () => T.openSymbol(symbol) },
      ...(T.guest ? [] : ([{ label: t("market.menu.depth"), icon: <FileText />, onSelect: () => (T.openSymbol(symbol), showSide(T, "book")) }] as MenuItem[])),
      "sep",
      { label: t("market.menu.specification"), icon: <Info />, onSelect: () => T.setUi({ spec: symbol }) },
      { label: fav ? t("market.menu.removeFavourite") : t("market.menu.addFavourite"), icon: <Star />, onSelect: () => toggleFav(symbol) },
      "sep",
      {
        label: t("market.menu.hide"),
        icon: <EyeOff />,
        onSelect: () => {
          T.setWs((w) => ({ hidden: [...w.hidden, symbol] }));
          toast(t("market.toast.hidden", { symbol }), { description: t("market.toast.hiddenDesc") });
        },
      },
      { label: t("market.menu.showAll"), icon: <Eye />, disabled: !hidden.length, onSelect: () => T.setWs({ hidden: [] }) },
    ];
  };
  const menuRef = React.useRef({ cm, menuFor });
  menuRef.current = { cm, menuFor };
  const onContext = React.useCallback((symbol: string, e: React.MouseEvent | { clientX: number; clientY: number }) => !isStressSymbol(symbol) && menuRef.current.cm.open(e, menuRef.current.menuFor(symbol), symbol), []);
  const onHover = React.useCallback((symbol: string, rect: DOMRect | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!rect || isStressSymbol(symbol)) return setHover(null);
    hoverTimer.current = setTimeout(() => setHover({ symbol, rect }), 450);
  }, []);

  // virtual list
  const item = view === "cards" ? CARD : ROW;
  const box = React.useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = React.useState({ top: 0, h: 600 });
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScroll({ top: el.scrollTop, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, list.length === 0]);
  const raf = React.useRef(0);
  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = box.current;
      if (el) setScroll({ top: el.scrollTop, h: el.clientHeight });
    });
  };
  React.useEffect(() => () => cancelAnimationFrame(raf.current), []);
  React.useEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [q, seg]);
  const first = Math.max(0, Math.floor(scroll.top / item) - OVERSCAN);
  const last = Math.min(list.length, Math.ceil((scroll.top + scroll.h) / item) + OVERSCAN);

  const moveCursor = (d: number) => {
    if (!list.length) return;
    const next = Math.max(0, Math.min(list.length - 1, cursor + d));
    setCursor(next);
    const el = box.current;
    if (!el) return;
    const top = next * item;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + item > el.scrollTop + el.clientHeight) el.scrollTop = top + item - el.clientHeight;
  };

  return (
    <div data-tour="markets" className="@container flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-1.5 px-2 pb-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-line bg-panel-2 px-2.5 focus-within:border-ember/60">
            <Search className="size-4 shrink-0 text-fg-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQ("");
                else if (e.key === "ArrowDown") (e.preventDefault(), moveCursor(1));
                else if (e.key === "ArrowUp") (e.preventDefault(), moveCursor(-1));
                else if (e.key === "Enter" && list.length) open(list[Math.max(0, cursor)]!.symbol);
              }}
              placeholder={t("desk.side.search")}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3"
              aria-label={t("desk.side.search")}
              role="combobox"
              aria-expanded
              aria-controls="k-instruments"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label={t("market.clear")} className="grid size-6 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <Segmented
            size="sm"
            stretch={false}
            label={t("desk.panel.markets")}
            value={view}
            onChange={(v) => T.setWs({ mwTab: v === "cards" ? "details" : "symbols" })}
            options={[
              { value: "list", label: <span className="sr-only">{t("desk.mk.viewList")}</span>, icon: <List />, tip: t("desk.mk.viewList") },
              { value: "cards", label: <span className="sr-only">{t("desk.mk.viewCards")}</span>, icon: <LayoutGrid />, tip: t("desk.mk.viewCards") },
            ]}
            className="[&_button]:px-1.5"
          />
        </div>
        <ClassChips value={seg} onChange={(s) => T.setWs({ mwSegment: s as Segment })} classes={classes} favCount={favs.length} total={base.length} />
      </div>

      {list.length === 0 ? (
        <div className="min-h-0 flex-1">
          {seg === "favourites" && !favs.length && !q ? <EmptyState icon={<Star />} title={t("desk.mk.empty.fav")} text={t("desk.mk.empty.favText")} /> : <EmptyState icon={<Search />} title={t("desk.mk.empty.search", { q: q || "…" })} text={t("desk.mk.empty.searchText")} />}
        </div>
      ) : (
        <>
          {view === "list" && (
            <div role="row" className="grid h-7 shrink-0 grid-cols-[minmax(0,1fr)_72px_72px_52px] items-center gap-x-1 border-y border-line bg-panel ps-3 pe-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
              <span role="columnheader">{t("desk.side.col.symbol")}</span>
              <span role="columnheader" className="text-end">
                {t("desk.ob.bid")}
              </span>
              <span role="columnheader" className="text-end">
                {t("desk.ob.ask")}
              </span>
              <span role="columnheader" className="text-end" title={t("desk.side.col.changeTip")}>
                {t("desk.side.col.change")}
              </span>
            </div>
          )}
          <div ref={box} onScroll={onScroll} onMouseLeave={() => onHover("", null)} className="t-scroll relative min-h-0 flex-1 overflow-y-auto" id="k-instruments" role="grid" aria-label={t("desk.side.instruments")} aria-rowcount={list.length}>
            <div style={{ height: list.length * item }} className="relative">
              {list.slice(first, last).map((i, k) => {
                const n = first + k;
                const p = { symbol: i.symbol, top: n * item, active: T.activeSymbol === i.symbol, cursor: n === cursor, fav: favs.includes(i.symbol), demoOnly: liveAccount && !liveTradable(i.symbol), onFav: toggleFav, onOpen: open, onOrder: order, onContext, onHover, index: n };
                return view === "cards" ? <InstrumentCard key={i.symbol} {...p} /> : <InstrumentRow key={i.symbol} {...p} />;
              })}
            </div>
          </div>
        </>
      )}
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-t border-line px-3 text-[11.5px] text-fg-3">
        <span className="k-num">{t("desk.mk.count", { shown: list.length.toLocaleString("en-US"), total: all.length.toLocaleString("en-US") })}</span>
        {hidden.length > 0 && (
          <button onClick={() => T.setWs({ hidden: [] })} className="rounded-[6px] px-1.5 py-0.5 font-medium text-accent-text hover:bg-ember-soft">
            {t("desk.mk.showHidden", { count: hidden.length })}
          </button>
        )}
      </div>
      {hover && <RangeTip symbol={hover.symbol} rect={hover.rect} />}
      {cm.node}
    </div>
  );
}

/** ★ Favourites, All, then every asset class of the catalogue: one row that scrolls sideways. */
function ClassChips({ value, onChange, classes, favCount, total }: { value: string; onChange: (s: string) => void; classes: [string, number][]; favCount: number; total: number }) {
  const t = useT();
  const items: { v: string; label: React.ReactNode; title: string }[] = [
    { v: "favourites", label: <Star className={cn("size-3.5", value === "favourites" && "fill-current")} />, title: `${t("market.segment.favourites")} · ${favCount}` },
    { v: "all", label: t("common.all"), title: `${t("common.all")} · ${total}` },
    ...classes.map(([c, n]) => ({ v: c, label: classLabel(c, t), title: `${classLabel(c, t)} · ${n}` })),
  ];
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <div ref={ref} role="tablist" aria-label={t("market.segmentAria")} className="flex items-center gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-16px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((x) => (
        <button
          key={x.v}
          role="tab"
          aria-selected={value === x.v}
          title={x.title}
          aria-label={x.v === "favourites" ? x.title : undefined}
          onClick={() => onChange(x.v)}
          onKeyDown={(e) => {
            const i = items.findIndex((y) => y.v === value);
            if (e.key === "ArrowRight") onChange(items[Math.min(items.length - 1, i + 1)]!.v);
            if (e.key === "ArrowLeft") onChange(items[Math.max(0, i - 1)]!.v);
          }}
          className={cn(
            "flex h-6 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
            value === x.v ? (x.v === "favourites" ? "border-gold/50 bg-gold/15 text-gold" : "border-transparent bg-surface-3 text-fg") : "border-line text-fg-2 hover:bg-surface-3/60 hover:text-fg",
          )}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}

type RowProps = {
  symbol: string;
  index: number;
  top: number;
  active: boolean;
  cursor: boolean;
  fav: boolean;
  /** live account, catalogue market not enabled for live trading */
  demoOnly: boolean;
  onFav: (s: string) => void;
  onOpen: (s: string) => void;
  onOrder: (s: string, side?: "buy" | "sell") => void;
  onContext: (s: string, e: React.MouseEvent | { clientX: number; clientY: number }) => void;
  onHover: (s: string, r: DOMRect | null) => void;
};

const InstrumentRow = React.memo(function InstrumentRow({ symbol, index, top, active, cursor, fav, demoOnly, onFav, onOpen, onOrder, onContext, onHover }: RowProps) {
  const t = useT();
  const q = useRowQuote(symbol);
  // a delayed snapshot (not streaming): shown, never traded on; opening the chart starts the live stream
  const delayed = !!q.delayed;
  const blockedTip = delayed ? t("desk.side.delayedTip") : demoOnly ? t("desk.side.demoOnlyTip") : null;
  const price = (side: "sell" | "buy") => (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(symbol);
    onOrder(symbol, side);
  };
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      aria-selected={active}
      onClick={() => onOpen(symbol)}
      onDoubleClick={() => onOrder(symbol)}
      onContextMenu={(e) => onContext(symbol, e)}
      onMouseEnter={(e) => onHover(symbol, e.currentTarget.getBoundingClientRect())}
      style={{ transform: `translateY(${top}px)`, height: ROW }}
      className={cn("group absolute inset-x-0 top-0 grid cursor-pointer grid-cols-[minmax(0,1fr)_72px_72px_52px] items-center gap-x-1 ps-1 pe-2.5 transition-colors", active ? "bg-ember-soft/45" : cursor ? "bg-surface-3/70" : "hover:bg-surface-3/40")}
    >
      {active && <span className="absolute inset-y-1 start-0 w-[2px] rounded-full bg-ember" aria-hidden />}
      <span role="gridcell" className="relative flex min-w-0 items-center gap-1.5 ps-2">
        <SymbolAvatar symbol={symbol} size={16} />
        <span className="truncate text-[13px] font-medium text-fg">{symbol}</span>
        {fav && <Star className="size-3 shrink-0 fill-gold text-gold" aria-hidden />}
        {demoOnly && (
          <span title={t("desk.side.demoOnlyTip")} className="shrink-0 rounded-[4px] border border-line px-1 text-[9.5px] font-semibold uppercase leading-[14px] tracking-[0.04em] text-fg-3">
            {t("desk.side.demoOnly")}
          </span>
        )}
        {delayed && <Clock3 className="size-3 shrink-0 text-warn" aria-label={t("desk.side.delayed")} />}
        {/* hover: ☆ and ⋯ over the end of the cell */}
        <span className="absolute end-0 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-[7px] bg-panel opacity-0 shadow-[0_0_0_3px_var(--t-panel)] focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => (e.stopPropagation(), onFav(symbol))}
            aria-pressed={fav}
            aria-label={fav ? t("desk.mk.favRemove", { symbol }) : t("desk.mk.favAdd", { symbol })}
            title={fav ? t("desk.mk.favRemove", { symbol }) : t("desk.mk.favAdd", { symbol })}
            className={cn("grid size-6 place-items-center rounded-[6px] hover:bg-surface-3", fav ? "text-gold" : "text-fg-3 hover:text-fg")}
          >
            <Star className={cn("size-3.5", fav && "fill-gold")} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              onContext(symbol, { clientX: r.right, clientY: r.bottom + 2 });
            }}
            aria-label={t("desk.mk.more", { symbol })}
            className="grid size-6 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </span>
      </span>
      <span role="gridcell">
        <button type="button" onClick={price("sell")} disabled={!!blockedTip} title={blockedTip ?? t("desk.mk.sellTip", { symbol })} className={cn("flex h-6 w-full items-center justify-end rounded-[6px] px-1 transition-colors enabled:hover:bg-down-soft disabled:cursor-default", delayed && "opacity-60")}>
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="justify-end text-[12.5px]" />
        </button>
      </span>
      <span role="gridcell">
        <button type="button" onClick={price("buy")} disabled={!!blockedTip} title={blockedTip ?? t("desk.mk.buyTip", { symbol })} className={cn("flex h-6 w-full items-center justify-end rounded-[6px] px-1 transition-colors enabled:hover:bg-up-soft disabled:cursor-default", delayed && "opacity-60")}>
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} className="justify-end text-[12.5px]" />
        </button>
      </span>
      <span role="gridcell" dir="ltr" className={cn("k-num text-end font-mono text-[12px]", q.change >= 0 ? "text-up" : "text-down")}>
        {q.change >= 0 ? "+" : ""}
        {q.change.toFixed(2)}%
      </span>
    </div>
  );
});

const InstrumentCard = React.memo(function InstrumentCard({ symbol, top, active, fav, demoOnly, onFav, onOpen, onOrder, onContext }: RowProps) {
  useMarketClock();
  const t = useT();
  const q = useRowQuote(symbol);
  const blockedTip = q.delayed ? t("desk.side.delayedTip") : demoOnly ? t("desk.side.demoOnlyTip") : undefined;
  const stress = isStressSymbol(symbol);
  const r = stress ? { low: q.bid * 0.99, high: q.ask * 1.01 } : getRange(symbol);
  const inst = getInstrument(symbol);
  const pct = Math.max(0, Math.min(100, ((q.bid - r.low) / Math.max(1e-9, r.high - r.low)) * 100));
  return (
    <div style={{ transform: `translateY(${top}px)`, height: CARD }} className="absolute inset-x-0 top-0 px-2 pb-2">
      <div onClick={() => onOpen(symbol)} onContextMenu={(e) => onContext(symbol, e)} className={cn("h-full cursor-pointer rounded-[10px] border p-2.5 transition-colors", active ? "border-ember/45 bg-ember-soft/40" : "border-line bg-panel-2/60 hover:bg-surface-2")}>
        <div className="flex items-center gap-2">
          <SymbolAvatar symbol={symbol} size={18} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[13px] font-semibold">{symbol}</span>
            <span className="block truncate text-[11.5px] text-fg-3">{inst.name}</span>
          </span>
          <span dir="ltr" className={cn("k-num ms-auto font-mono text-[12px]", q.change >= 0 ? "text-up" : "text-down")}>
            {q.change >= 0 ? "+" : ""}
            {q.change.toFixed(2)}%
          </span>
          <button type="button" onClick={(e) => (e.stopPropagation(), onFav(symbol))} aria-pressed={fav} aria-label={fav ? t("desk.mk.favRemove", { symbol }) : t("desk.mk.favAdd", { symbol })} className={cn("grid size-7 place-items-center rounded-[7px] hover:bg-surface-3", fav ? "text-gold" : "text-fg-3")}>
            <Star className={cn("size-4", fav && "fill-gold")} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" disabled={!!blockedTip} title={blockedTip} onClick={(e) => (e.stopPropagation(), onOpen(symbol), onOrder(symbol, "sell"))} className="rounded-[8px] bg-down-soft px-2 py-1 text-start enabled:hover:brightness-110 disabled:opacity-60">
            <div className="text-[11px] font-semibold text-down">{t("desk.mk.col.sell")}</div>
            <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[14px]" />
          </button>
          <button type="button" disabled={!!blockedTip} title={blockedTip} onClick={(e) => (e.stopPropagation(), onOpen(symbol), onOrder(symbol, "buy"))} className="rounded-[8px] bg-up-soft px-2 py-1 text-end enabled:hover:brightness-110 disabled:opacity-60">
            <div className="text-[11px] font-semibold text-up">{t("desk.mk.col.buy")}</div>
            <PriceText symbol={symbol} value={q.ask} dir={q.dir} className="justify-end text-[14px]" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10.5px] text-fg-3">
          <span dir="ltr">{fmtPrice(symbol, r.low)}</span>
          <span className="relative h-1 flex-1 rounded-full bg-surface-3">
            <span className="absolute inset-y-0 start-0 rounded-full bg-fg-3/70" style={{ width: `${pct}%` }} />
          </span>
          <span dir="ltr">{fmtPrice(symbol, r.high)}</span>
        </div>
      </div>
    </div>
  );
});

/** Day range card on hover (after 450 ms). */
function RangeTip({ symbol, rect }: { symbol: string; rect: DOMRect }) {
  useMarketClock();
  const t = useT();
  const q = useQuote(symbol);
  const r = getRange(symbol);
  const inst = getInstrument(symbol);
  const pct = Math.max(0, Math.min(100, ((q.bid - r.low) / Math.max(1e-9, r.high - r.low)) * 100));
  const spread = Math.round((q.ask - q.bid) * 10 ** inst.digits);
  if (typeof document === "undefined") return null;
  // the column is on the right: the card opens to its left
  const left = rect.left - 256 >= 12 ? rect.left - 256 : Math.min(window.innerWidth - 260, rect.right + 8);
  return createPortal(
    <div className="t-pop pointer-events-none fixed z-[60] w-[248px] rounded-[12px] border border-line-top bg-panel-2 p-3 shadow-[var(--t-shadow-pop)]" style={{ left, top: Math.max(12, Math.min(rect.top - 6, window.innerHeight - 150)) }}>
      <div className="flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold text-fg">
          <SymbolAvatar symbol={symbol} size={16} /> {symbol}
        </span>
        <span className="truncate ps-2 text-[12px] text-fg-3">{inst.name}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between font-mono text-[11.5px] text-fg-3">
        <span>
          {t("market.tip.low")} <span dir="ltr" className="text-fg-2">{fmtPrice(symbol, r.low)}</span>
        </span>
        <span>
          {t("market.tip.high")} <span dir="ltr" className="text-fg-2">{fmtPrice(symbol, r.high)}</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-gradient-to-r from-down/50 via-surface-3 to-up/50">
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel-2 bg-fg" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1 font-mono text-[11.5px]">
        <span className="text-fg-3">
          {t("market.tip.spread")} <span className="text-fg-2">{spread}</span>
        </span>
        <span className={cn("text-end", q.change >= 0 ? "text-up" : "text-down")}>
          <span dir="ltr">
            {q.change >= 0 ? "+" : ""}
            {q.change.toFixed(2)}%
          </span>
        </span>
      </div>
    </div>,
    document.body,
  );
}

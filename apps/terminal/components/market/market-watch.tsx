"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BarChart2, ChevronsLeft, Eye, EyeOff, FileText, Info, Search, ShoppingCart, Star, TrendingUp } from "lucide-react";
import { INSTRUMENTS, getInstrument, type AssetClass } from "@kalks/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { getRange, useMarketClock } from "@/lib/market";
import { fmtPrice, serverTime } from "@/lib/trading";
import { PanelHeader, PanelTabs } from "@/components/ui/panel";
import { TIcon } from "@/components/ui/primitives";
import { useContextMenu, type MenuItem } from "@/components/ui/menu";

const ORDER: AssetClass[] = ["forex", "metals", "indices", "energies", "crypto", "stocks"];

function MwClock() {
  useMarketClock();
  const [t, setT] = React.useState("--:--:--");
  React.useEffect(() => {
    const f = () => setT(serverTime().time);
    f();
    const i = setInterval(f, 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="k-num font-mono text-[10.5px] font-normal normal-case tracking-normal text-fg-3">{t}</span>;
}

export function MarketWatch({ onCollapse }: { onCollapse?: () => void }) {
  const T = useTerminal();
  const [q, setQ] = React.useState("");
  const tab = T.ws.mwTab;
  const cm = useContextMenu(220);
  const [hover, setHover] = React.useState<{ symbol: string; rect: DOMRect } | null>(null);

  const list = INSTRUMENTS.filter((i) => !T.ws.hidden.includes(i.symbol))
    .filter((i) => (tab === "favourites" ? T.ws.favourites.includes(i.symbol) : true))
    .filter((i) => !q || i.symbol.toLowerCase().includes(q.toLowerCase()) || i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ORDER.indexOf(a.assetClass) - ORDER.indexOf(b.assetClass));

  const menuFor = (symbol: string): MenuItem[] => {
    const fav = T.ws.favourites.includes(symbol);
    return [
      { label: "New Order", icon: <ShoppingCart />, hint: "F9", disabled: T.readOnly, onSelect: () => T.openNewOrder({ symbol }) },
      { label: "Chart Window", icon: <BarChart2 />, onSelect: () => T.addTab(symbol) },
      { label: "Open in active chart", icon: <TrendingUp />, onSelect: () => T.openSymbol(symbol) },
      { label: "Depth of Market", icon: <FileText />, hint: "Alt+B", onSelect: () => (T.openSymbol(symbol), T.setWs({ rightTab: "depth" }), T.togglePanel("right", true)) },
      "sep",
      { label: "Specification", icon: <Info />, onSelect: () => T.setUi({ spec: symbol }) },
      { label: fav ? "Remove from Favourites" : "Add to Favourites", icon: <Star />, onSelect: () => T.setWs((w) => ({ favourites: fav ? w.favourites.filter((s) => s !== symbol) : [...w.favourites, symbol] })) },
      "sep",
      {
        label: "Hide",
        icon: <EyeOff />,
        hint: "Del",
        onSelect: () => {
          T.setWs((w) => ({ hidden: [...w.hidden, symbol] }));
          toast(`${symbol} hidden from Market Watch`, { description: "Show all symbols from the context menu." });
        },
      },
      { label: "Show All", icon: <Eye />, disabled: !T.ws.hidden.length, onSelect: () => T.setWs({ hidden: [] }) },
    ];
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader icon={<BarChart2 />} title={<span className="flex items-center gap-2">Market Watch <MwClock /></span>}>
        {onCollapse && (
          <TIcon label="Collapse" onClick={onCollapse}>
            <ChevronsLeft />
          </TIcon>
        )}
      </PanelHeader>
      <div className="flex h-8 shrink-0 items-stretch justify-between gap-2 border-b border-line px-1">
        <PanelTabs
          value={tab}
          onChange={(v) => T.setWs({ mwTab: v })}
          tabs={[
            { value: "symbols", label: "Symbols" },
            { value: "details", label: "Details" },
            { value: "favourites", label: "Favourites", count: T.ws.favourites.length },
          ]}
        />
      </div>
      <div className="shrink-0 border-b border-line p-1.5">
        <label className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line bg-surface-2 px-2 focus-within:border-ember/50">
          <Search className="size-3.5 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-fg-3" aria-label="Search Market Watch" />
          {q && (
            <button onClick={() => setQ("")} className="text-[10px] text-fg-3 hover:text-fg">
              Clear
            </button>
          )}
        </label>
      </div>

      {tab === "details" ? (
        <div className="t-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
          {list.map((i) => (
            <DetailCard key={i.symbol} symbol={i.symbol} active={T.activeSymbol === i.symbol} onOpen={() => T.openSymbol(i.symbol)} onContext={(e) => cm.open(e, menuFor(i.symbol), i.symbol)} />
          ))}
        </div>
      ) : (
        <div className="t-scroll min-h-0 flex-1 overflow-y-auto" onMouseLeave={() => setHover(null)}>
          <table className="w-full table-fixed border-separate border-spacing-0">
            <colgroup>
              <col />
              <col className="w-[68px]" />
              <col className="w-[68px]" />
              <col className="w-[26px]" />
              <col className="w-[44px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="sticky top-0 z-[1] h-6 border-b border-line bg-panel-2 pl-2 text-left text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3">Symbol</th>
                <th className="sticky top-0 z-[1] h-6 border-b border-line bg-panel-2 pr-1.5 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3">Bid</th>
                <th className="sticky top-0 z-[1] h-6 border-b border-line bg-panel-2 pr-1.5 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3">Ask</th>
                <th className="sticky top-0 z-[1] h-6 border-b border-line bg-panel-2 pr-1 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3" title="Spread, points">Sp</th>
                <th className="sticky top-0 z-[1] h-6 border-b border-line bg-panel-2 pr-2 text-right text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3">Chg%</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <MwRow
                  key={i.symbol}
                  symbol={i.symbol}
                  active={T.activeSymbol === i.symbol}
                  fav={T.ws.favourites.includes(i.symbol)}
                  onOpen={() => {
                    T.openSymbol(i.symbol);
                    toast(`${i.symbol} opened in active chart`, { description: `${T.activeTab.tf} · ${i.name}` });
                  }}
                  onContext={(e) => cm.open(e, menuFor(i.symbol), i.symbol)}
                  onHover={(rect) => setHover(rect ? { symbol: i.symbol, rect } : null)}
                />
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="p-4 text-center text-[12px] text-fg-3">{tab === "favourites" ? "No favourites yet. Right-click a symbol to add it." : "No symbols match."}</div>}
        </div>
      )}
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-line px-2 font-mono text-[10px] text-fg-3">
        <span>
          {list.length} / {INSTRUMENTS.length} symbols
        </span>
        <span className="truncate pl-2">dbl-click: chart</span>
      </div>
      {hover && <RangeTip symbol={hover.symbol} rect={hover.rect} />}
      {cm.node}
    </div>
  );
}

const MwRow = React.memo(function MwRow({
  symbol,
  active,
  fav,
  onOpen,
  onContext,
  onHover,
}: {
  symbol: string;
  active: boolean;
  fav: boolean;
  onOpen: () => void;
  onContext: (e: React.MouseEvent) => void;
  onHover: (r: DOMRect | null) => void;
}) {
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  const spread = Math.round((q.ask - q.bid) * 10 ** inst.digits);
  return (
    <tr
      onDoubleClick={onOpen}
      onContextMenu={onContext}
      onMouseEnter={(e) => onHover(e.currentTarget.getBoundingClientRect())}
      className={cn("group h-[28px] cursor-default text-[12px]", active ? "bg-ember-soft/60" : "hover:bg-surface-2")}
      title={`${inst.name} · spread ${spread}`}
    >
      <td className={cn("border-b border-line/50 pl-2", active && "shadow-[inset_2px_0_0_var(--k-ember)]")}>
        <span className="flex min-w-0 items-center gap-1.5">
          <SymbolAvatar symbol={symbol} size={12} />
          <span className={cn("truncate text-[11.5px] font-medium", active ? "text-fg" : "text-fg-2 group-hover:text-fg")}>{symbol}</span>
        </span>
      </td>
      <td className="border-b border-line/50 pr-1.5 text-right">
        <PriceText symbol={symbol} value={q.bid} dir={q.dir} pulse className="justify-end px-0.5 text-[10.5px]" />
      </td>
      <td className="border-b border-line/50 pr-1.5 text-right">
        <PriceText symbol={symbol} value={q.ask} dir={q.dir} pulse className="justify-end px-0.5 text-[10.5px]" />
      </td>
      <td className="k-num border-b border-line/50 pr-1 text-right font-mono text-[10px] text-fg-3">{spread}</td>
      <td className={cn("k-num border-b border-line/50 pr-2 text-right font-mono text-[10.5px]", q.change >= 0 ? "text-up" : "text-down")}>
        {q.change >= 0 ? "+" : ""}
        {q.change.toFixed(2)}
      </td>
    </tr>
  );
});

function RangeTip({ symbol, rect }: { symbol: string; rect: DOMRect }) {
  useMarketClock();
  const q = useQuote(symbol);
  const r = getRange(symbol);
  const inst = getInstrument(symbol);
  const pct = Math.max(0, Math.min(100, ((q.bid - r.low) / Math.max(1e-9, r.high - r.low)) * 100));
  const spread = Math.round((q.ask - q.bid) * 10 ** inst.digits);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed z-[60] w-[228px] rounded-[8px] border border-line-top bg-panel-2 p-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)] t-pop" style={{ left: rect.right + 8, top: Math.min(rect.top - 6, window.innerHeight - 120) }}>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="flex items-center gap-1.5 font-medium text-fg">
          <SymbolAvatar symbol={symbol} size={14} /> {symbol}
        </span>
        <span className="text-[10.5px] text-fg-3">{inst.name}</span>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] text-fg-3">
        <span>L {fmtPrice(symbol, r.low)}</span>
        <span>H {fmtPrice(symbol, r.high)}</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-gradient-to-r from-down/50 via-surface-3 to-up/50">
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel-2 bg-fg" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10.5px]">
        <span className="text-fg-3">
          Sprd <span className="text-fg-2">{spread}</span>
        </span>
        <span className="text-center text-fg-3">
          Rng <span className="text-fg-2">{((r.high - r.low) / (inst.assetClass === "forex" ? (inst.digits === 3 ? 0.01 : 0.0001) : 1)).toFixed(inst.assetClass === "forex" ? 0 : 1)}</span>
        </span>
        <span className={cn("text-right", q.change >= 0 ? "text-up" : "text-down")}>{q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}%</span>
      </div>
    </div>,
    document.body,
  );
}

function DetailCard({ symbol, active, onOpen, onContext }: { symbol: string; active: boolean; onOpen: () => void; onContext: (e: React.MouseEvent) => void }) {
  useMarketClock();
  const q = useQuote(symbol);
  const r = getRange(symbol);
  const inst = getInstrument(symbol);
  const pct = Math.max(0, Math.min(100, ((q.bid - r.low) / Math.max(1e-9, r.high - r.low)) * 100));
  return (
    <div onDoubleClick={onOpen} onContextMenu={onContext} className={cn("cursor-default rounded-[6px] border p-2 transition-colors", active ? "border-ember/40 bg-ember-soft/40" : "border-line bg-surface-2/50 hover:bg-surface-2")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium">
          <SymbolAvatar symbol={symbol} size={15} />
          {symbol}
        </span>
        <span className={cn("k-num font-mono text-[11px]", q.change >= 0 ? "text-up" : "text-down")}>
          {q.change >= 0 ? "+" : ""}
          {q.change.toFixed(2)}%
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="rounded-[4px] bg-down-soft px-1.5 py-1">
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-down">Bid</div>
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[14px]" />
        </div>
        <div className="rounded-[4px] bg-up-soft px-1.5 py-1 text-right">
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-up">Ask</div>
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} className="justify-end text-[14px]" />
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] text-fg-3">
        <span>{fmtPrice(symbol, r.low)}</span>
        <span className="relative h-1 flex-1 rounded-full bg-surface-3">
          <span className="absolute inset-y-0 left-0 rounded-full bg-fg-3/60" style={{ width: `${pct}%` }} />
        </span>
        <span>{fmtPrice(symbol, r.high)}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-fg-3">{inst.name}</div>
    </div>
  );
}

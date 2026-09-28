"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "@/lib/notify";
import { BarChart2, CornerDownLeft, Info, Keyboard, Search, ShoppingCart, Star } from "lucide-react";
import { ASSET_CLASS_LABEL, INSTRUMENTS } from "@kalks/mock";
import { LogoMark, PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { Kbd } from "./kbd";
import { TDialog } from "@/components/ui/primitives";
import { SymbolInfo } from "@/components/order/right-panel";
import { SegmentChips, inSegment } from "@/components/market/segments";
import type { Segment } from "@/lib/store";

/* ------------------------------------------------------------------ */
/* Symbol search (Ctrl/⌘ K)                                            */
/* ------------------------------------------------------------------ */

export function SymbolSearch() {
  const T = useTerminal();
  const open = T.ui.search;
  const [q, setQ] = React.useState("");
  const cls = T.ws.searchSegment;
  const setCls = (s: Segment) => T.setWs({ searchSegment: s });
  const [idx, setIdx] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const close = React.useCallback(() => T.setUi({ search: false }), [T]);
  React.useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  const list = INSTRUMENTS.filter((i) => inSegment(i, cls, T.ws.favourites) && (!q || i.symbol.toLowerCase().includes(q.toLowerCase()) || i.name.toLowerCase().includes(q.toLowerCase())));
  const pick = (s: string, mode: "chart" | "tab" | "trade" = "chart") => {
    if (mode === "trade") T.openNewOrder({ symbol: s });
    else T.openSymbol(s, mode === "tab");
    close();
    if (mode !== "trade") toast(`${s} ${mode === "tab" ? "opened in a new chart" : "opened in active chart"}`);
  };
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-start justify-center p-3 pt-[12vh]" role="dialog" aria-modal aria-label="Symbol search">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onMouseDown={close} />
      <div
        className="t-pop relative w-full max-w-[600px] overflow-hidden rounded-[10px] border border-line-top bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "ArrowDown") (e.preventDefault(), setIdx((i) => Math.min(list.length - 1, i + 1)));
          if (e.key === "ArrowUp") (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
          if (e.key === "Enter" && list[idx]) pick(list[idx]!.symbol, e.altKey ? "tab" : e.shiftKey ? "trade" : "chart");
        }}
      >
        <div className="flex h-11 items-center gap-2.5 border-b border-line px-3.5">
          <Search className="size-4 text-fg-3" />
          <input ref={input} value={q} onChange={(e) => (setQ(e.target.value), setIdx(0))} placeholder="Search symbols, e.g. XAU, EUR, Nasdaq…" className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3" aria-label="Search symbols" />
          <Kbd>Esc</Kbd>
        </div>
        <div className="border-b border-line px-2 py-1.5">
          <SegmentChips instruments={INSTRUMENTS} value={cls} onChange={(s) => (setCls(s), setIdx(0))} favourites={T.ws.favourites} size="md" label="Symbol search segment" />
        </div>
        <div className="t-scroll max-h-[48vh] overflow-y-auto p-1">
          {list.map((i, n) => (
            <SearchRow key={i.symbol} symbol={i.symbol} active={n === idx} fav={T.ws.favourites.includes(i.symbol)} onHover={() => setIdx(n)} onPick={(m) => pick(i.symbol, m)} />
          ))}
          {!list.length && <div className="p-6 text-center text-[12.5px] text-fg-3">{q ? <>No symbols match “{q}”</> : cls === "favourites" ? "No favourites yet. Right-click a symbol in Market Watch to add it." : "No symbols in this segment."}</div>}
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-panel-2 px-3.5 py-2 text-[10.5px] text-fg-3">
          <span className="flex items-center gap-1">
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open in chart
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Alt ↵</Kbd> new chart
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⇧ ↵</Kbd> new order
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SearchRow({ symbol, active, fav, onHover, onPick }: { symbol: string; active: boolean; fav: boolean; onHover: () => void; onPick: (m: "chart" | "tab" | "trade") => void }) {
  const q = useQuote(symbol);
  const inst = INSTRUMENTS.find((i) => i.symbol === symbol)!;
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div ref={ref} onMouseMove={onHover} onClick={() => onPick("chart")} className={cn("group flex h-10 cursor-default items-center gap-3 rounded-[6px] px-2.5", active ? "bg-surface-3" : "")}>
      <SymbolAvatar symbol={symbol} size={20} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium">
          {symbol}
          {fav && <Star className="size-2.5 fill-gold text-gold" />}
        </div>
        <div className="truncate text-[11px] text-fg-3">
          {inst.name} · {ASSET_CLASS_LABEL[inst.assetClass]}
        </div>
      </div>
      <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[12px]" />
      <span className={cn("k-num w-14 text-right font-mono text-[11px]", q.change >= 0 ? "text-up" : "text-down")}>
        {q.change >= 0 ? "+" : ""}
        {q.change.toFixed(2)}%
      </span>
      <span className={cn("flex gap-1", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <button title="New chart" onClick={(e) => (e.stopPropagation(), onPick("tab"))} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-2 hover:text-fg">
          <BarChart2 className="size-3.5" />
        </button>
        <button title="New order" onClick={(e) => (e.stopPropagation(), onPick("trade"))} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-2 hover:text-fg">
          <ShoppingCart className="size-3.5" />
        </button>
        <CornerDownLeft className="my-auto size-3.5 text-fg-3" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts                                                  */
/* ------------------------------------------------------------------ */

export const SHORTCUTS: [string, string][] = [
  ["F9", "New order"],
  ["F10", "Toggle one-click trading"],
  ["Ctrl / ⌘ + K", "Symbol search"],
  ["Alt + 1 … 4", "Layout: 1 chart · 2 side-by-side · 2 stacked · 4 grid"],
  ["Ctrl + M", "Show / hide Market Watch"],
  ["Ctrl + T", "Show / hide Toolbox"],
  ["Ctrl + D", "Show / hide Order / DOM panel"],
  ["Ctrl + F", "Crosshair"],
  ["Ctrl + I", "Indicators list"],
  ["Delete", "Remove the selected drawing"],
  ["+ / −", "Zoom the active chart"],
  ["Esc", "Close dialog · cancel drawing"],
  ["F1", "This help"],
  ["F11", "Fullscreen"],
];

export function ShortcutsDialog() {
  const T = useTerminal();
  return (
    <TDialog open={T.ui.shortcuts} onClose={() => T.setUi({ shortcuts: false })} width={520} icon={<Keyboard />} title="Keyboard shortcuts">
      <div className="p-2">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-[5px] px-2.5 py-1.5 text-[12.5px] hover:bg-surface-2">
            <span className="text-fg-2">{v}</span>
            <span className="flex gap-1">
              {k.split(" + ").map((x) => (
                <Kbd key={x}>{x}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </TDialog>
  );
}

export function SpecDialog() {
  const T = useTerminal();
  const s = T.ui.spec;
  return (
    <TDialog open={!!s} onClose={() => T.setUi({ spec: null })} width={420} icon={<Info />} title={`Specification · ${s ?? ""}`}>
      {s && <SymbolInfo symbol={s} />}
    </TDialog>
  );
}

export function AboutDialog() {
  const T = useTerminal();
  return (
    <TDialog open={T.ui.about} onClose={() => T.setUi({ about: false })} width={420} icon={<Info />} title="About Kalks Trader">
      <div className="space-y-3 p-5 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-[14px] border border-line-top bg-surface-3 shadow-[0_0_30px_-8px_rgba(255,90,31,0.6)]">
          <LogoMark size={26} className="text-fg" />
        </div>
        <div>
          <div className="text-[16px] font-semibold">Kalks Trader</div>
          <div className="font-mono text-[11px] text-fg-3">Version 5.0 · build 5120 · Web x64</div>
        </div>
        <p className="text-[12px] leading-relaxed text-fg-3">Multi-asset trading room for Kalks Global Markets. Quotes stream from the Kalks price gateway; server time is GMT+3.</p>
        <div className="font-mono text-[10.5px] text-fg-3">© 2026 Kalks Global Markets Ltd</div>
      </div>
    </TDialog>
  );
}

"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { ASSET_CLASS_LABEL, type Instrument } from "@ezymex/mock";
import { cn } from "@ezymex/ui";
import type { Segment } from "@/lib/store";
import { useT } from "@ezymex/i18n/react";
import type { T as Translate } from "@ezymex/i18n";

export type { Segment };

export const SEGMENTS: readonly Segment[] = ["all", "forex", "metals", "indices", "energies", "crypto", "stocks", "favourites"];

export function segmentLabel(s: Segment, t?: Translate) {
  if (t) return s === "all" ? t("common.all") : t.dyn(`market.segment.${s}`, s === "favourites" ? "Favourites" : ASSET_CLASS_LABEL[s]);
  return s === "all" ? "All" : s === "favourites" ? "Favourites" : ASSET_CLASS_LABEL[s];
}

export function inSegment(i: Instrument, s: Segment, favourites: readonly string[]) {
  return s === "all" || (s === "favourites" ? favourites.includes(i.symbol) : i.assetClass === s);
}

/**
 * Asset-class filter chips with counts (MT5 "Symbols" groups, cTrader watchlist tabs). A horizontally
 * scrollable tablist so it fits the narrow Market Watch; ←/→/Home/End move between segments.
 * Empty asset classes are left out; All and Favourites always show.
 */
export function SegmentChips({
  instruments,
  value,
  onChange,
  favourites,
  withFavourites = true,
  size = "sm",
  className,
  label,
  wrap = false,
  favouritesFirst = false,
}: {
  instruments: readonly Instrument[];
  value: Segment;
  onChange: (s: Segment) => void;
  favourites: readonly string[];
  withFavourites?: boolean;
  size?: "sm" | "md";
  className?: string;
  label?: string;
  /** wrap onto more lines instead of scrolling sideways (desktop Markets panel) */
  wrap?: boolean;
  /** ★ Favourites as the first chip */
  favouritesFirst?: boolean;
}) {
  const t = useT();
  const counts = React.useMemo(() => {
    const m = new Map<Segment, number>();
    for (const s of SEGMENTS) m.set(s, instruments.filter((i) => inSegment(i, s, favourites)).length);
    return m;
  }, [instruments, favourites]);
  const order = favouritesFirst ? (["favourites", ...SEGMENTS.filter((s) => s !== "favourites")] as Segment[]) : SEGMENTS;
  const shown = order.filter((s) => (s === "favourites" ? withFavourites : s === "all" || (counts.get(s) ?? 0) > 0 || s === value));
  const refs = React.useRef(new Map<Segment, HTMLButtonElement>());
  // fade the edge(s) that hide more chips, so a narrow panel shows it scrolls
  const box = React.useRef<HTMLDivElement>(null);
  const [edge, setEdge] = React.useState({ l: false, r: false });
  const measure = React.useCallback(() => {
    const el = box.current;
    if (!el) return;
    const l = el.scrollLeft > 2;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const current = shown.includes(value) ? value : "all";

  // keep the selected chip visible in the scroller
  React.useEffect(() => {
    const el = box.current;
    const chip = refs.current.get(current);
    if (el && chip) {
      const left = chip.offsetLeft - el.offsetLeft;
      if (left < el.scrollLeft) el.scrollLeft = left - 8;
      else if (left + chip.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = left + chip.offsetWidth - el.clientWidth + 8;
    }
    measure();
  }, [current, measure]);

  const move = (e: React.KeyboardEvent) => {
    const i = shown.indexOf(current);
    const next = e.key === "ArrowRight" ? shown[(i + 1) % shown.length] : e.key === "ArrowLeft" ? shown[(i - 1 + shown.length) % shown.length] : e.key === "Home" ? shown[0] : e.key === "End" ? shown[shown.length - 1] : undefined;
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(next);
    refs.current.get(next)?.focus();
  };

  return (
    <div
      ref={box}
      role="tablist"
      aria-label={label ?? t("market.segment.aria")}
      onKeyDown={move}
      onScroll={measure}
      style={!wrap && (edge.l || edge.r) ? { maskImage: `linear-gradient(to right, ${edge.l ? "transparent, black 18px" : "black"}, ${edge.r ? "black calc(100% - 22px), transparent" : "black"})` } : undefined}
      className={cn("flex min-w-0 items-center", wrap ? "flex-wrap gap-1" : "gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {shown.map((s) => {
        const on = s === current;
        const n = counts.get(s) ?? 0;
        return (
          <button
            key={s}
            ref={(el) => {
              if (el) refs.current.set(s, el);
              else refs.current.delete(s);
            }}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(s)}
            title={t("market.segment.title", { label: segmentLabel(s, t), count: n })}
            className={cn(
              "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/40",
              size === "md" ? "h-7 rounded-full border px-2.5 text-[12.5px]" : "h-[22px] px-1.5 text-[11px]",
              wrap && "h-[26px] px-[9px] text-[12px]",
              on ? (size === "md" ? "border-ember/45 bg-ember-soft text-accent-text" : "bg-ember-soft text-ember") : size === "md" ? "border-line text-fg-2 hover:bg-surface-3 hover:text-fg" : "text-fg-3 hover:bg-surface-3 hover:text-fg-2",
            )}
          >
            {s === "favourites" ? <Star className={cn(size === "md" ? "size-3.5" : "size-3", on && "fill-current")} aria-hidden /> : segmentLabel(s, t)}
            {s === "favourites" && <span className="sr-only">{t("market.segment.favourites")}</span>}
            {(!wrap || s === "favourites") && <span className={cn("k-num font-mono", size === "md" ? "text-[11px]" : "text-[9.5px]", on ? "opacity-80" : "text-fg-3")}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

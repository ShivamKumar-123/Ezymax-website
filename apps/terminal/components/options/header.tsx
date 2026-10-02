"use client";

// Underlying figures of the options workspace (spot from the CFD feed, daily change, ATM IV, realized vol, contract,
// cut countdown) and the expiry strip of the public chain page (every listed expiry as a chip).
import * as React from "react";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { PriceText, cn, useQuote } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { atmIndex } from "@/lib/options/math";
import { underlyingOf, useOpt } from "@/lib/options-store";
import { OptAvatar, StateBadge } from "./bits";
import { ExpiryChips } from "./expiry-bar";
import { pct } from "./format";

/** Spot of an underlying: the CFD feed when the terminal lists it, else the chain's spot. */
export function SpotPrice({ symbol, className, fallback }: { symbol: string; className?: string; fallback?: number | null }) {
  if (!INSTRUMENT_MAP[symbol]) return <span className={cn("k-num font-mono", className)}>{fallback ? fallback.toFixed(5) : "—"}</span>;
  return <FeedPrice symbol={symbol} className={className} />;
}
export function FeedPrice({ symbol, className }: { symbol: string; className?: string }) {
  const q = useQuote(symbol);
  return <PriceText symbol={symbol} value={(q.bid + q.ask) / 2 || q.bid} dir={q.dir} className={className} />;
}
export function FeedChange({ symbol, className }: { symbol: string; className?: string }) {
  const q = useQuote(symbol);
  if (!INSTRUMENT_MAP[symbol] || !q.bid) return null;
  return (
    <span dir="ltr" className={cn("k-num font-mono text-[10.5px]", q.change >= 0 ? "text-up" : "text-down", className)}>
      {q.change >= 0 ? "+" : ""}
      {q.change.toFixed(2)}%
    </span>
  );
}

function Stat({ label, children, title, className }: { label: string; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span className={cn("shrink-0 items-baseline gap-1.5 whitespace-nowrap border-s border-line ps-3", className ?? "flex")} title={title}>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-fg-3">{label}</span>
      <span className="font-mono text-[11.5px] text-fg-2">{children}</span>
    </span>
  );
}

/** One line of the underlying's figures (the centre panel's tab row; wraps out of view on narrow panels). */
export function UnderlyingStats({ className }: { className?: string }) {
  const t = useT();
  const u = useOpt((s) => s.u);
  const cur = useOpt((s) => underlyingOf(s));
  const chain = useOpt((s) => (s.chain?.underlying === s.u ? s.chain : null));
  const atmRow = chain?.rows.length ? chain.rows[atmIndex(chain)] : undefined;
  const atmIv = atmRow?.call?.iv ?? cur?.atmVol ?? null;
  // volatility figures are for experienced traders: shown with the Pro columns
  const pro = useOpt((s) => s.prefs.colPreset === "pro" || s.prefs.cols.some((c) => c === "iv" || c === "delta" || c === "vega"));
  return (
    <div className={cn("@container flex min-w-0 items-center gap-3 overflow-hidden", className)}>
      <span className="flex shrink-0 items-center gap-2">
        <OptAvatar symbol={u} size={16} />
        <span className="text-[13px] font-semibold text-fg">{u}</span>
        <SpotPrice symbol={u} className="text-[13px]" fallback={chain?.spot?.mid} />
        <FeedChange symbol={u} />
      </span>
      {chain && (
        <Stat label={t("trader.opt.contract")} className="hidden @[380px]:flex">
          {chain.contractSize.toLocaleString("en-US")} <span className="font-sans text-[10.5px] text-fg-3">{chain.contractUnit}</span>
        </Stat>
      )}
      {pro && (
        <Stat label={t("trader.opt.atmIv")} title={t("trader.opt.atmIvHint")} className="hidden @[520px]:flex">
          {pct(atmIv)}
        </Stat>
      )}
      {pro && cur?.realizedVol !== undefined && cur?.realizedVol !== null && (
        <Stat label={t("trader.opt.rv")} title={t("trader.opt.rvHint")} className="hidden @[640px]:flex">
          {pct(cur.realizedVol)}
        </Stat>
      )}
      {chain && <StateBadge state={chain.state} />}
    </div>
  );
}

/** Every listed expiry as a chip (the public option chain page). */
export function ExpiryStrip({ className }: { className?: string }) {
  const t = useT();
  return (
    <div className={cn("flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-line bg-panel ps-2.5 pe-1", className)}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{t("trader.opt.exp.label")}</span>
      <ExpiryChips />
    </div>
  );
}

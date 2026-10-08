"use client";

// Small shared pieces of the order-book screens: the units of a series (USD per contract for one unit of premium, the
// premium tick), the "Book" badge, order status chips, quantities and prices in USD per contract.
import * as React from "react";
import { BookOpenText } from "lucide-react";
import { OPTION_SPEC, parseSeriesCode } from "@ezymex/mock/options";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { usdPerUnitOf } from "@/lib/options/math";
import { premiumTickOf, usdPerUnitOfQuote } from "@/lib/options/normalize";
import { underlyingOf, useOpt, useSeriesQuote } from "@/lib/options-store";
import type { BookOrderStatus } from "@/lib/options/types";
import { usd } from "./format";

export interface SeriesUnits {
  /** USD per contract for one unit of premium */
  k: number;
  /** premium tick, quote currency per unit */
  tick: number;
  /** the tick in USD per contract */
  tickUsd: number;
}

/** Units of a series: from its quote, else the chain on screen, else the contract size (USD-quoted underlyings). */
export function useSeriesUnits(code: string | null | undefined): SeriesUnits {
  const q = useSeriesQuote(code);
  const p = code ? parseSeriesCode(code) : null;
  const chainK = useOpt((s) => (p && s.chain?.underlying === p.underlying ? usdPerUnitOf(s.chain) : 0));
  const under = useOpt((s) => (p ? underlyingOf(s, p.underlying) : undefined));
  const chainBook = useOpt((s) => (p && s.chain?.underlying === p.underlying ? (s.chain.book ?? null) : null));
  const spec = p ? OPTION_SPEC[p.underlying] : undefined;
  const k = usdPerUnitOfQuote(q) || chainK || (spec?.quoteCcy === "USD" ? spec.contractSize : 0);
  const tick = p ? premiumTickOf(p.underlying, under, chainBook) : 0.00001;
  return React.useMemo(() => ({ k, tick, tickUsd: Math.round(tick * k * 1e6) / 1e6 }), [k, tick]);
}

/** A per-unit premium as USD per contract text ("—" when unknown). */
export const usdOfUnit = (v: number | null | undefined, k: number) => (v === null || v === undefined || !(k > 0) ? "—" : usd(v * k));

export const qty = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

/** "Book": prices on screen are the order book (clients and the Ezymex market maker), not house prices. */
export function BookBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span title={t("trader.opt.book.badgeHint")} className={cn("inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[4px] border border-info/35 bg-info-soft px-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-info", className)}>
      <BookOpenText className="size-3" /> {t("trader.opt.book.badge")}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  working: "border-info/30 bg-info-soft text-info",
  pending: "border-info/30 bg-info-soft text-info",
  partially_filled: "border-gold/35 bg-gold-soft text-gold",
  filled: "border-up/30 bg-up-soft text-up",
  cancelled: "border-line bg-surface-3 text-fg-3",
  expired: "border-line bg-surface-3 text-fg-3",
  rejected: "border-down/30 bg-down-soft text-down",
};

export function OrderStatusChip({ status, className }: { status: BookOrderStatus; className?: string }) {
  const t = useT();
  return <span className={cn("inline-flex h-[17px] shrink-0 items-center rounded-[4px] border px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.05em]", STATUS_TONE[status] ?? STATUS_TONE.cancelled, className)}>{t.dyn(`trader.opt.ord.status.${status}`, status.replace(/_/g, " "))}</span>;
}

/** Order type label: Limit · Market · Stop market · Stop limit. */
export function useTypeLabel() {
  const t = useT();
  return React.useCallback((type: string) => t.dyn(`trader.opt.ord.type.${type}`, type.replace(/_/g, " ")), [t]);
}

/** Barrier legs and positions are priced by Ezymex, not traded on the order book (§5). */
export function EzymexQuotedTag({ className }: { className?: string }) {
  const t = useT();
  return (
    <span title={t("trader.opt.rfq.ezymexQuotedHint")} className={cn("inline-flex h-[16px] shrink-0 items-center rounded-[3px] border border-gold/35 bg-gold-soft px-1 text-[9px] font-semibold text-gold", className)}>
      {t("trader.opt.rfq.ezymexQuoted")}
    </span>
  );
}

/** A series code with a barrier suffix (`…-C-UO1.1800`) or an option with a barrier: Ezymex-quoted. */
export const isBarrierSeries = (code: string) => /^[A-Z0-9]{3,12}-\d{8}-[0-9.]+-[CP]-[A-Z0-9._]+$/.test(code);

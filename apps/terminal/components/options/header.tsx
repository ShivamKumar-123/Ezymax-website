"use client";

// Underlying figures of the options workspace (spot from the CFD feed, daily change, ATM IV, realized vol, contract,
// cut countdown) and the expiry strip of the public chain page (every listed expiry as a chip).
import * as React from "react";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { PriceText, cn, useQuote } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { atmIndex } from "@/lib/options/math";
import { opt, underlyingOf, useOpt } from "@/lib/options-store";
import type { OptionExpiry } from "@/lib/options/types";
import { KindBadges, OptAvatar, StateBadge } from "./bits";
import { dte, expiryLabel, pct } from "./format";

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
    <span className={cn("shrink-0 items-baseline gap-1.5 whitespace-nowrap", className ?? "flex")} title={title}>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-fg-3">{label}</span>
      <span className="font-mono text-[11.5px] text-fg">{children}</span>
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
  return (
    <div className={cn("@container flex min-w-0 items-center gap-3 overflow-hidden", className)}>
      <span className="flex shrink-0 items-center gap-1.5">
        <OptAvatar symbol={u} size={14} />
        <span className="text-[12px] font-semibold text-fg">{u}</span>
        <SpotPrice symbol={u} className="text-[12.5px]" fallback={chain?.spot?.mid} />
        <FeedChange symbol={u} />
      </span>
      <Stat label={t("trader.opt.atmIv")} title={t("trader.opt.atmIvHint")} className="hidden @[300px]:flex">
        {pct(atmIv)}
      </Stat>
      {cur?.realizedVol !== undefined && cur?.realizedVol !== null && (
        <Stat label={t("trader.opt.rv")} title={t("trader.opt.rvHint")} className="hidden @[460px]:flex">
          {pct(cur.realizedVol)}
        </Stat>
      )}
      {chain && (
        <Stat label={t("trader.opt.contract")} className="hidden @[620px]:flex">
          {chain.contractSize.toLocaleString("en-US")} <span className="font-sans text-[10.5px] text-fg-3">{chain.contractUnit}</span>
        </Stat>
      )}
      {chain && <StateBadge state={chain.state} />}
    </div>
  );
}

function ExpiryChip({ e, active, locale }: { e: OptionExpiry; active: boolean; locale: string }) {
  const t = useT();
  const days = dte(e);
  const hours = (Date.parse(e.cutAt) - Date.now()) / 3_600_000;
  return (
    <button
      onClick={() => opt.selectExpiry(e.date)}
      aria-pressed={active}
      title={t("trader.opt.expiryTitle", { date: e.date, time: new Date(e.cutAt).toISOString().slice(11, 16) })}
      className={cn("relative flex h-[30px] shrink-0 items-center gap-1.5 rounded-[6px] border px-2 text-[11.5px] transition-colors", active ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2/60 text-fg-2 hover:border-fg-3/40 hover:text-fg")}
    >
      <span className="font-medium">{expiryLabel(e.date, locale)}</span>
      <span className={cn("k-num rounded-[4px] px-1 font-mono text-[10px]", days === 0 ? "bg-warn-soft text-warn" : active ? "bg-ember/15 text-ember" : "bg-surface-3 text-fg-3")}>{days === 0 ? (hours > 0 ? `${Math.max(1, Math.round(hours))}h` : "0D") : `${days}D`}</span>
      <KindBadges kinds={e.kinds} />
      {e.state !== "open" && <span className={cn("size-1.5 rounded-full", e.state === "halted" ? "bg-down" : "bg-warn")} />}
    </button>
  );
}

/** Every listed expiry as a chip (the public option chain page). */
export function ExpiryStrip({ className }: { className?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const list = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [expiry]);
  return (
    <div className={cn("flex h-10 shrink-0 items-center gap-2 rounded-[8px] border border-line bg-panel ps-2.5 pe-1", className)}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{t("trader.opt.expiries")}</span>
      <div ref={ref} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {list.map((e) => (
          <ExpiryChip key={e.date} e={e} active={e.date === expiry} locale={locale} />
        ))}
        {!list.length && <span className="text-[11.5px] text-fg-3">{t("trader.opt.loadingExpiries")}</span>}
      </div>
      <span className="hidden shrink-0 items-center gap-2 pe-1.5 text-[10px] text-fg-3 xl:flex">
        <KindBadges kinds={["daily"]} /> {t("trader.opt.kind.daily")}
        <KindBadges kinds={["weekly"]} /> {t("trader.opt.kind.weekly")}
        <KindBadges kinds={["monthly"]} /> {t("trader.opt.kind.monthly")}
      </span>
    </div>
  );
}

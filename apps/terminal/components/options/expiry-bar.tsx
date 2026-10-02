"use client";

// Expiry picker of the options workspace: every open expiry of the underlying as a chip ("Today", "Tomorrow",
// "Fri, Oct 9", with the time left to its cut and a small W / M for weekly and monthly expiries), in one row that
// scrolls sideways (arrows on desktop, a swipe on phones); the chosen one stays in view. Picking the nearest
// expiry of a kind keeps following that kind: after its cut the store rolls it to the next date of the same kind.
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { expiryOpen, opt, useOpt } from "@/lib/options-store";
import type { OptionExpiry } from "@/lib/options/types";
import { StateBadge, useNow } from "./bits";
import { Explain } from "./explain";
import { countdown, cutWhen, expiryLabel } from "./format";

/** "3d 4h" a few days out, "5h 10m" on the day of the cut. */
function untilText(cutMs: number, now: number) {
  const left = cutMs - now;
  if (left >= 86_400_000) {
    const d = Math.floor(left / 86_400_000);
    const h = Math.floor((left % 86_400_000) / 3_600_000);
    return d >= 3 ? `${d}d` : `${d}d ${h}h`;
  }
  return countdown(cutMs, now);
}

function Chip({ e, active, now, compact }: { e: OptionExpiry; active: boolean; now: number; compact?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const cut = Date.parse(e.cutAt);
  const today = new Date(now).toISOString().slice(0, 10);
  const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10);
  const label = e.date === today ? t("trader.opt.guide.today") : e.date === tomorrow ? t("trader.opt.guide.tomorrow") : expiryLabel(e.date, locale);
  const soon = cut - now < 3_600_000;
  const tag = e.kinds.includes("monthly") ? "M" : e.kinds.includes("weekly") ? "W" : null;
  return (
    <button
      onClick={() => opt.selectExpiry(e.date)}
      aria-pressed={active}
      title={`${cutWhen(cut, locale)}${tag ? ` · ${t(tag === "M" ? "trader.opt.kind.monthly" : "trader.opt.kind.weekly")}` : ""}`}
      className={cn(
        "relative flex shrink-0 flex-col items-start justify-center rounded-[9px] border text-start transition-[background-color,border-color,color] duration-150",
        compact ? "h-[40px] min-w-[84px] px-2.5" : "h-[36px] min-w-[92px] px-2.5",
        active ? "border-ember bg-ember-soft text-fg shadow-[inset_0_0_0_1px_var(--k-ember)]" : "border-line bg-surface-2/60 text-fg-2 hover:border-fg-3/40 hover:text-fg",
      )}
    >
      <span className="flex w-full items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold leading-none">
        {label}
        {tag && <span className={cn("rounded-[3px] px-[3px] font-mono text-[8.5px] font-bold leading-[12px]", tag === "M" ? "bg-gold-soft text-gold" : "bg-info-soft text-info")}>{tag}</span>}
        {e.state !== "open" && <span className={cn("size-1.5 rounded-full", e.state === "halted" ? "bg-down" : "bg-warn")} />}
      </span>
      <span className={cn("k-num mt-[4px] whitespace-nowrap font-mono text-[10px] leading-none", soon ? "text-warn" : active ? "text-ember" : "text-fg-3")}>{untilText(cut, now)}</span>
    </button>
  );
}

/** Every open expiry as chips in a sideways-scrolling row (desktop: arrows at the ends). */
export function ExpiryChips({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const list = useOpt((s) => s.expiries);
  const expiry = useOpt((s) => s.expiry);
  const now = useNow();
  const open = list.filter((e) => expiryOpen(e, now) || e.date === expiry).sort((a, b) => Date.parse(a.cutAt) - Date.parse(b.cutAt));
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });
  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, open.length]);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [expiry]);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  if (!open.length)
    return (
      <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)} aria-busy>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("shrink-0 animate-pulse rounded-[9px] bg-surface-2", compact ? "h-[40px] w-[84px]" : "h-[36px] w-[92px]")} />
        ))}
        <span className="sr-only">{t("trader.opt.loadingExpiries")}</span>
      </div>
    );
  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      {!compact && edges.start && (
        <button onClick={() => scroll(-1)} aria-label={t("trader.opt.exp.earlier")} className="absolute start-0 top-1/2 z-[2] grid size-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel text-fg-2 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.6)] hover:text-fg">
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div
        ref={ref}
        onScroll={measure}
        role="tablist"
        aria-label={t("trader.opt.col.expiry")}
        className={cn("flex min-w-0 items-center gap-1.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", edges.start && "[mask-image:linear-gradient(90deg,transparent,black_28px)]", edges.end && "[mask-image:linear-gradient(90deg,black_calc(100%-28px),transparent)]", edges.start && edges.end && "[mask-image:linear-gradient(90deg,transparent,black_28px,black_calc(100%-28px),transparent)]")}
      >
        {open.map((e) => (
          <Chip key={e.date} e={e} active={e.date === expiry} now={now} compact={compact} />
        ))}
      </div>
      {!compact && edges.end && (
        <button onClick={() => scroll(1)} aria-label={t("trader.opt.exp.later")} className="absolute end-0 top-1/2 z-[2] grid size-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel text-fg-2 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.6)] hover:text-fg">
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

/** The expiry row of the workspace: "Expires" + the chips + the chosen expiry's cut in UTC. */
export function ExpiryBar({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const chain = useOpt((s) => (s.chain && s.chain.expiry === s.expiry ? s.chain : null));
  return (
    <div className={cn("flex shrink-0 items-center gap-2 border-b border-line", compact ? "h-[52px] px-2" : "h-[48px] px-2.5", className)}>
      {!compact && (
        <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
          {t("trader.opt.exp.label")}
          <Explain topic="expiry" size={11} />
        </span>
      )}
      <ExpiryChips compact={compact} />
      {!compact && chain && (
        <span className="ms-1 hidden shrink-0 flex-col items-end leading-tight 2xl:flex" title={t("trader.opt.cutHint", { time: chain.cut.time })}>
          <span className="flex items-center gap-1.5 text-[10px] text-fg-3">
            <StateBadge state={chain.state} />
            {t("trader.opt.exp.cut")}
          </span>
          <span className="font-mono text-[11px] text-fg-2">{cutWhen(chain.cutAt, locale)}</span>
        </span>
      )}
    </div>
  );
}

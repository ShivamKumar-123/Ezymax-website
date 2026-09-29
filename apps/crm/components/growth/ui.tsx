"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, RotateCw } from "lucide-react";
import { Avatar, Button, Card, Chip, EmptyState, Flag, PageHeader, Skeleton, cn, type ChipTone } from "@kalks/ui";
import { accountTitle, fmtAmount, curOf, useAccounts, type EngineAccount } from "@/components/trading/api";
import { KindBadge } from "@/components/trading/ui";
import type { GrowthApiError } from "./api";

/* ------------------------------------------------------------------ */
/* Load states                                                         */
/* ------------------------------------------------------------------ */

export function LoadError({ error, onRetry, title = "Rewards are unavailable" }: { error: GrowthApiError; onRetry: () => void; title?: string }) {
  return (
    <Card>
      <EmptyState
        illustration="satellite_antenna"
        title={title}
        text={error.message || "We couldn't reach the rewards service. Please try again in a moment."}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        }
      />
    </Card>
  );
}

/** Page shell used while the first load is in flight or failed. */
export function PageFallback({
  title,
  subtitle,
  error,
  onRetry,
  rows,
  top,
}: {
  title: string;
  subtitle: string;
  error: GrowthApiError | null;
  onRetry: () => void;
  rows: { cols: string; h: string; n: number }[];
  top?: React.ReactNode;
}) {
  return (
    <div className="pb-16">
      <PageHeader title={title} subtitle={subtitle} />
      {top}
      {error ? <LoadError error={error} onRetry={onRetry} /> : <SkeletonGrid rows={rows} />}
    </div>
  );
}

export function SkeletonGrid({ rows }: { rows: { cols: string; h: string; n: number }[] }) {
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={i} className={cn("grid grid-cols-1 gap-4", r.cols)}>
          {Array.from({ length: r.n }, (_, j) => (
            <Skeleton key={j} className={cn("w-full rounded-[20px]", r.h)} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Quiet inline empty state for a card body. */
export function CardEmpty({ title, text, className, children }: { title: string; text?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[16px] border border-dashed border-line px-5 py-8 text-center", className)}>
      <div className="text-[13.5px] font-medium text-fg-2">{title}</div>
      {text && <div className="mt-1 max-w-sm text-[12.5px] leading-snug text-fg-3">{text}</div>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function SectionTitle({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[19px] font-medium tracking-tight">{title}</h2>
        {text && <p className="text-[13px] text-fg-3">{text}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

type Tone = { label: string; tone: ChipTone };

const STATUS: Record<string, Tone> = {
  // generic
  pending: { label: "Pending", tone: "warn" },
  completed: { label: "Completed", tone: "up" },
  failed: { label: "Failed", tone: "down" },
  paid: { label: "Paid", tone: "up" },
  accrued: { label: "Accrued", tone: "info" },
  void: { label: "Void", tone: "neutral" },
  voided: { label: "Void", tone: "neutral" },
  // vouchers
  active: { label: "Active", tone: "up" },
  used: { label: "Used", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  // grants
  awaiting_deposit: { label: "Awaiting deposit", tone: "warn" },
  forfeited: { label: "Forfeited", tone: "down" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  // promo
  applied: { label: "Applied", tone: "up" },
  blocked: { label: "Blocked", tone: "down" },
  // contests
  scheduled: { label: "Upcoming", tone: "info" },
  running: { label: "Live", tone: "ember" },
  ended: { label: "Ended", tone: "neutral" },
  finalized: { label: "Results final", tone: "gold" },
  disqualified: { label: "Disqualified", tone: "down" },
};

export function GrowthStatus({ status, dot = true }: { status: string; dot?: boolean }) {
  const s = STATUS[status] ?? { label: status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), tone: "neutral" as const };
  return (
    <Chip size="sm" dot={dot} tone={s.tone}>
      {s.label}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Ranks and people                                                    */
/* ------------------------------------------------------------------ */

export function RankBadge({ rank, size = 30 }: { rank: number | null; size?: number }) {
  if (!rank)
    return (
      <span className="grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-[11px] text-fg-3" style={{ width: size, height: size }}>
        —
      </span>
    );
  const medal = rank === 1 ? "border-gold/50 bg-gold-soft text-gold" : rank === 2 ? "border-white/25 bg-white/10 text-fg" : rank === 3 ? "border-[#d98b4a]/45 bg-[#d98b4a]/15 text-[#e8a06a]" : "border-line bg-surface-3 text-fg-2";
  return (
    <span className={cn("k-num grid shrink-0 place-items-center rounded-full border font-semibold", medal)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}>
      {rank}
    </span>
  );
}

export function PersonCell({ name, country, sub, me }: { name: string; country?: string | null; sub?: React.ReactNode; me?: boolean }) {
  const initials = name.replace(/[^\p{L}\s]/gu, "").trim() || "?";
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="relative shrink-0">
        <Avatar name={initials} size={32} />
        {country && <Flag country={country.toLowerCase()} className="absolute -bottom-0.5 -right-1 size-3.5 ring-2 ring-surface" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-fg">
          <span className="truncate">{name}</span>
          {me && (
            <Chip size="sm" tone="ember">
              You
            </Chip>
          )}
        </span>
        {sub && <span className="block truncate text-[11.5px] text-fg-3">{sub}</span>}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tier orb (static)                                                   */
/* ------------------------------------------------------------------ */

const TIER_STYLE: Record<string, string> = {
  bronze: "bg-[radial-gradient(circle_at_30%_25%,#ffd9b8,#d98b4a_45%,#8a4b1f)]",
  silver: "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#c7ccd4_45%,#7a818c)]",
  gold: "bg-[radial-gradient(circle_at_30%_25%,#fff3c4,#e9b949_45%,#9c6f14)]",
  platinum: "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#b9c6cf_40%,#55636e)]",
  diamond: "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#9fe3f5_40%,#2b7f97)]",
};

export function TierOrb({ tier, name, size = 40, className }: { tier: string; name?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full font-bold uppercase text-black/70", TIER_STYLE[tier.toLowerCase()] ?? "bg-[radial-gradient(circle_at_30%_25%,#ffd9b8,#ff8a3d_45%,#b8330f)]", className)}
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {(name ?? tier)[0]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Day bars (30-day series)                                            */
/* ------------------------------------------------------------------ */

/** Static column chart: one bar per day, the hovered (or last) day is highlighted with its value. */
export function DayBars({ data, format, height = 200, label }: { data: { label: string; value: number }[]; format: (v: number) => string; height?: number; label: (i: number) => string }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const sel = hover ?? data.length - 1;
  const cur = data[sel];
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-[12.5px]">
        <span className="text-fg-3">{cur ? label(sel) : ""}</span>
        <span className="k-num font-medium text-fg">{cur ? format(cur.value) : ""}</span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(d.value > 0 ? 4 : 1.5, (d.value / max) * 100) : 1.5;
          return (
            <div key={d.label} className="flex h-full min-w-0 flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)}>
              <div className={cn("w-full rounded-t-[4px] transition-colors", i === sel ? "bg-ember" : d.value > 0 ? "bg-surface-3 hover:bg-fg-3/40" : "bg-surface-3/60")} style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-fg-3">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live account picker (contest entry, bonus claim, bonus-credit reward) */
/* ------------------------------------------------------------------ */

export function LiveAccountPicker({ value, onChange, filter, hint }: { value: number | null; onChange: (login: number) => void; filter?: (a: EngineAccount) => boolean; hint?: string }) {
  const { data, error, loading, reload } = useAccounts(0);
  const live = (data?.accounts ?? []).filter((a) => a.type === "live" && (!filter || filter(a)));
  React.useEffect(() => {
    if (value === null && live.length === 1) onChange(live[0]!.login);
  }, [value, live, onChange]);

  if (loading) return <Skeleton className="h-[62px] w-full rounded-[14px]" />;
  if (error && !data)
    return (
      <CardEmpty title="Accounts are unavailable" text={error.message}>
        <Button size="xs" variant="surface" onClick={reload}>
          <RotateCw /> Try again
        </Button>
      </CardEmpty>
    );
  if (live.length === 0)
    return (
      <CardEmpty title="No eligible live account" text={hint ?? "Open a live trading account first."}>
        <Link href="/accounts/new">
          <Button size="xs" variant="surface">
            <Plus /> Open live account
          </Button>
        </Link>
      </CardEmpty>
    );
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label="Live account">
      {live.map((a) => {
        const on = a.login === value;
        return (
          <button
            key={a.login}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`account-option-${a.login}`}
            onClick={() => onChange(a.login)}
            className={cn("k-row flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors", on ? "border-ember/50 bg-ember-soft" : "hover:border-[var(--k-border-top)]")}
          >
            <KindBadge type={a.type} />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[13px] font-medium">#{a.login}</span>
              <span className="block truncate text-[11px] text-fg-3">{accountTitle(a)}</span>
            </span>
            <span className="k-num text-[12.5px] text-fg-2">{fmtAmount(a.equity, curOf(a))}</span>
            <span className={cn("grid size-4 place-items-center rounded-full border", on ? "border-ember" : "border-line")}>{on && <span className="size-2 rounded-full bg-ember" />}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Copy as CopyIcon, Landmark, Users } from "lucide-react";
import { Avatar, Button, Chip, Delta, Flag, Sparkline, Tooltip, cn, formatCompact } from "@kalks/ui";
import { masterSpark, riskLabel, riskTone, type Master, type MasterProgram } from "@kalks/mock/social";

/** System risk score 1–10 as a compact badge with a 10-tick meter. */
export function RiskBadge({ risk, showLabel = false, className }: { risk: number; showLabel?: boolean; className?: string }) {
  const tone = riskTone(risk);
  const color = tone === "up" ? "bg-up" : tone === "warn" ? "bg-warn" : "bg-down";
  return (
    <Tooltip content={`System risk score ${risk}/10 · ${riskLabel(risk)} risk`}>
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-semibold k-num",
          tone === "up" ? "border-up/25 bg-up-soft text-up" : tone === "warn" ? "border-warn/25 bg-warn-soft text-warn" : "border-down/25 bg-down-soft text-down",
          className,
        )}
      >
        <span className="flex items-end gap-[1.5px]">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("w-[2px] rounded-full", i < risk ? color : "bg-fg-3/30")} style={{ height: 4 + i * 0.7 }} />
          ))}
        </span>
        {risk}
        {showLabel && <span className="font-medium opacity-80">{riskLabel(risk)}</span>}
      </span>
    </Tooltip>
  );
}

export function ProgramTags({ program, size = "sm" }: { program: MasterProgram; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-1">
      {(program === "copy" || program === "both") && (
        <Chip size={size} tone="ember">
          <CopyIcon className="size-3" /> Copy
        </Chip>
      )}
      {(program === "pamm" || program === "both") && (
        <Chip size={size} tone="gold">
          <Landmark className="size-3" /> PAMM
        </Chip>
      )}
    </span>
  );
}

export function MasterIdentity({ m, size = 40, sub }: { m: Master; size?: number; sub?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar src={m.person.photo} name={m.person.name} size={size} verified={m.verified} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate text-[14px] font-medium text-fg">
          {m.person.name}
          <Flag country={m.person.country} className="size-3.5" />
        </span>
        <span className="block truncate text-[12px] text-fg-3">{sub ?? m.strategy}</span>
      </span>
    </span>
  );
}

export function formatAge(days: number) {
  const y = Math.floor(days / 365);
  const mo = Math.floor((days % 365) / 30.4);
  return y > 0 ? `${y}y ${mo}m` : `${mo}m`;
}

/** Featured master card (carousel / grid). */
export function MasterCard({ m, onCopy, onInvest, className }: { m: Master; onCopy?: () => void; onInvest?: () => void; className?: string }) {
  const spark = React.useMemo(() => masterSpark(m, 48), [m]);
  return (
    <div className={cn("k-card group flex h-full flex-col overflow-hidden transition-colors hover:border-[var(--k-border-top)]", className)}>
      <Link href={`/social/masters/${m.id}`} className="block px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar src={m.person.photo} name={m.person.name} size={52} />
              {m.verified && (
                <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-surface ring-2 ring-surface">
                  <BadgeCheck className="size-4 text-ember" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate text-[15px] font-medium">
                {m.person.name}
                <Flag country={m.person.country} className="size-3.5" />
              </div>
              <div className="truncate text-[12.5px] text-fg-3">{m.strategy}</div>
            </div>
          </div>
          <RiskBadge risk={m.risk} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Return · 1Y</div>
            <div className={cn("k-num mt-1 text-[26px] font-semibold leading-none tracking-tight", m.return1y >= 0 ? "text-up" : "text-down")}>
              {m.return1y >= 0 ? "+" : ""}
              {m.return1y.toFixed(1)}%
            </div>
          </div>
          <Sparkline data={spark} width={120} height={44} tone={m.return3m >= 0 ? "up" : "down"} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
          <div className="k-row px-2.5 py-2">
            <div className="text-fg-3">Max DD</div>
            <div className="k-num mt-0.5 font-medium text-down">-{m.maxDD.toFixed(1)}%</div>
          </div>
          <div className="k-row px-2.5 py-2">
            <div className="text-fg-3">AUM</div>
            <div className="k-num mt-0.5 font-medium">${formatCompact(m.aum)}</div>
          </div>
          <div className="k-row px-2.5 py-2">
            <div className="flex items-center gap-1 text-fg-3">
              <Users className="size-3" /> Followers
            </div>
            <div className="k-num mt-0.5 font-medium">{m.followers.toLocaleString()}</div>
          </div>
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-2 px-5 pb-5 pt-4">
        <ProgramTags program={m.program} />
        <div className="flex items-center gap-1.5">
          {onInvest && (m.program === "pamm" || m.program === "both") && (
            <Button size="xs" variant="surface" onClick={onInvest}>
              Invest
            </Button>
          )}
          {onCopy && (m.program === "copy" || m.program === "both") && (
            <Button size="xs" variant="ember" onClick={onCopy}>
              Copy
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReturnText({ value, className }: { value: number; className?: string }) {
  return <Delta value={value} decimals={1} className={className} />;
}

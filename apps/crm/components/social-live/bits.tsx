"use client";

import * as React from "react";
import { Building2, Copy as CopyIcon, Info, Landmark, RotateCw } from "lucide-react";
import { Avatar, Button, Card, Chip, EmptyState, Skeleton, Tooltip, cn } from "@kalks/ui";
import { pct, riskLabel, riskTone, toneOf, type Program } from "./api";

/** System risk score 1–10 (D72) as a compact badge with a 10-tick meter. */
export function RiskBadge({ risk, showLabel = false, className }: { risk: number; showLabel?: boolean; className?: string }) {
  const r = Math.max(1, Math.min(10, Math.round(risk || 1)));
  const tone = riskTone(r);
  const color = tone === "up" ? "bg-up" : tone === "warn" ? "bg-warn" : "bg-down";
  return (
    <Tooltip content={`System risk score ${r}/10 · ${riskLabel(r)} risk (from max drawdown and volatility)`}>
      <span
        className={cn(
          "k-num inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-semibold",
          tone === "up" ? "border-up/25 bg-up-soft text-up" : tone === "warn" ? "border-warn/25 bg-warn-soft text-warn" : "border-down/25 bg-down-soft text-down",
          className,
        )}
      >
        <span className="flex items-end gap-[1.5px]">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("w-[2px] rounded-full", i < r ? color : "bg-fg-3/30")} style={{ height: 4 + i * 0.7 }} />
          ))}
        </span>
        {r}
        {showLabel && <span className="font-medium opacity-80">{riskLabel(r)}</span>}
      </span>
    </Tooltip>
  );
}

/** Disclosure label of a house account (a broker-operated account running an automated strategy). */
export const HOUSE_DISCLOSURE =
  "House strategy operated by Kalks: a broker-owned live account running an automated strategy. Its statistics are only its own live trades since it started; nothing is simulated or backfilled.";

export function HouseBadge({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <Tooltip content={HOUSE_DISCLOSURE}>
      <span className={cn("inline-flex", className)}>
        <Chip size={size} tone="info">
          <Building2 className="size-3" /> House strategy · Operated by Kalks
        </Chip>
      </span>
    </Tooltip>
  );
}

export function ProgramTags({ program, size = "sm" }: { program: Program; size?: "sm" | "md" }) {
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

/** Masters are shown by nickname only: an initials avatar, never a photo or personal name. */
export function MasterIdentity({ nickname, sub, size = 40 }: { nickname: string; sub?: React.ReactNode; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={nickname || "Master"} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-fg">{nickname}</span>
        {sub !== undefined && <span className="block truncate text-[12px] text-fg-3">{sub}</span>}
      </span>
    </span>
  );
}

export function Pct({ value, decimals = 2, className }: { value: number | null | undefined; decimals?: number; className?: string }) {
  return <span className={cn("k-num", toneOf(value), className)}>{pct(value, decimals)}</span>;
}

export function InfoBox({ children, tone = "neutral", icon, className }: { children: React.ReactNode; tone?: "neutral" | "gold" | "warn" | "down" | "up"; icon?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[14px] border px-4 py-3 text-[12.5px] leading-relaxed",
        tone === "neutral" && "border-line bg-surface-2 text-fg-3",
        tone === "gold" && "border-gold/25 bg-gold-soft text-fg-2",
        tone === "warn" && "border-warn/30 bg-warn-soft text-fg-2",
        tone === "down" && "border-down/30 bg-down-soft text-fg-2",
        tone === "up" && "border-up/30 bg-up-soft text-fg-2",
        className,
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", tone === "gold" && "text-gold", tone === "warn" && "text-warn", tone === "down" && "text-down", tone === "up" && "text-up")}>{icon ?? <Info />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SocialError({ onRetry, message, title = "Copy trading is unavailable" }: { onRetry: () => void; message?: string; title?: string }) {
  return (
    <Card>
      <EmptyState
        illustration="satellite_antenna"
        title={title}
        text={message ?? "We couldn't reach the service. Your accounts and funds are safe; please try again in a moment."}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        }
      />
    </Card>
  );
}

export function BlockSkeleton({ n = 3, h = 120 }: { n?: number; h?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ height: h }}>
          <Skeleton className="size-full rounded-[18px]" />
        </div>
      ))}
    </div>
  );
}

/** Small label / value tile used across the social pages (k-row style). */
export function Tile({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("k-row min-w-0 px-3 py-2.5", className)}>
      <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-0.5 truncate text-[14px] font-medium">{children}</div>
    </div>
  );
}

/** Controlled numeric input state: keeps the raw text so users can clear and retype. */
export function useNumber(initial: number | null) {
  const [raw, setRaw] = React.useState(initial === null ? "" : String(initial));
  const value = raw.trim() === "" ? null : Number(raw);
  return { raw, setRaw, value: value !== null && Number.isFinite(value) ? value : null, set: (v: number | null) => setRaw(v === null ? "" : String(v)) };
}

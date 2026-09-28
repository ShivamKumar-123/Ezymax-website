"use client";

import * as React from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Chip, CoinIcon, Tooltip, cn, formatNumber, type ChipTone } from "@kalks/ui";
import type { FinCheck, FinNetwork } from "@kalks/mock/admin-finance";

export const usd = (v: number, dec = 2) => `${v < 0 ? "-" : ""}$${formatNumber(Math.abs(v), dec)}`;
export const num = (v: number, dec = 2) => formatNumber(v, dec);

export function fmtDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

const NET_COIN: Record<FinNetwork, string> = { TRC20: "trx", ERC20: "eth", BEP20: "bnb", BTC: "btc", SOL: "sol" };

export function NetworkChip({ network, className }: { network: FinNetwork; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface-2 pl-1 pr-2 text-[11px] font-medium text-fg-2", className)}>
      <CoinIcon coin={NET_COIN[network]} size={16} />
      {network}
    </span>
  );
}

export function CoinAmount({ amount, asset, usdValue, className, sub }: { amount: number; asset: string; usdValue?: number; className?: string; sub?: React.ReactNode }) {
  const coin = asset.toLowerCase() === "usd" ? null : asset.toLowerCase() === "usdc" ? "usdt" : asset.toLowerCase();
  const dec = asset === "BTC" || asset === "ETH" ? 6 : asset === "TRX" ? 0 : 2;
  return (
    <span className={cn("inline-flex items-center justify-end gap-2", className)}>
      <span className="text-right">
        <span className="k-num block text-[13.5px] font-medium text-fg">
          {amount < 0 ? "-" : ""}
          {formatNumber(Math.abs(amount), dec)} <span className="text-[11px] font-normal text-fg-3">{asset}</span>
        </span>
        {(sub || (usdValue !== undefined && asset !== "USDT" && asset !== "USD")) && <span className="k-num block text-[11px] text-fg-3">{sub ?? `≈ ${usd(usdValue!)}`}</span>}
      </span>
      {coin && <CoinIcon coin={coin} size={20} />}
    </span>
  );
}

/** Confirmation progress: N/required with segmented bar. */
export function ConfProgress({ conf, required, className }: { conf: number; required: number; className?: string }) {
  const done = conf >= required;
  const segs = Math.min(required, 20);
  const filled = Math.round((Math.min(conf, required) / required) * segs);
  return (
    <div className={cn("w-32", className)}>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className={cn("k-num font-medium", done ? "text-up" : "text-ember")}>
          {done ? (conf > 999 ? "999+" : conf) : conf}/{required}
        </span>
        <span className="text-fg-3">{done ? "final" : `~${Math.max(1, (required - conf) * 3)}s`}</span>
      </div>
      <div className="flex h-1.5 gap-[2px]">
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className={cn("flex-1 rounded-full transition-colors duration-500", i < filled ? (done ? "bg-up" : "bg-ember") : "bg-surface-3")} />
        ))}
      </div>
    </div>
  );
}

const CHECK_META: Record<string, string> = {
  kyc: "KYC",
  bonus: "Bonus",
  recentDeposit: "Recent deposit",
  ipMatch: "IP / device",
  pnl: "P&L profile",
};

export function CheckDot({ state, label, detail }: { state: FinCheck; label: string; detail?: string }) {
  const tone = state === "ok" ? "border-up/25 bg-up-soft text-up" : state === "warn" ? "border-warn/30 bg-warn-soft text-warn" : "border-down/30 bg-down-soft text-down";
  return (
    <Tooltip
      content={
        <span className="flex items-center gap-1.5">
          {label}: <span className={state === "ok" ? "text-up" : state === "warn" ? "text-warn" : "text-down"}>{state === "ok" ? "passed" : state === "warn" ? "review" : "failed"}</span>
          {detail && <span className="text-fg-3">· {detail}</span>}
        </span>
      }
    >
      <span className={cn("grid size-[22px] place-items-center rounded-full border", tone)}>
        {state === "ok" ? <Check className="size-3" strokeWidth={3} /> : state === "warn" ? <AlertTriangle className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={3} />}
      </span>
    </Tooltip>
  );
}

export function CheckRow({ checks }: { checks: Record<string, FinCheck> }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Object.entries(checks).map(([k, v]) => (
        <CheckDot key={k} state={v} label={CHECK_META[k] ?? k} />
      ))}
    </span>
  );
}
export { CHECK_META };

/** Label/value line used inside drawers. */
export function Line({ k, v, mono, tone }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean; tone?: ChipTone }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="text-fg-3">{k}</span>
      <span className={cn("k-num min-w-0 truncate text-right font-medium", mono && "font-mono text-[12px]", tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-fg")}>{v}</span>
    </div>
  );
}

export function LiveDot({ tone = "up" }: { tone?: "up" | "ember" | "warn" }) {
  const c = tone === "up" ? "bg-up" : tone === "ember" ? "bg-ember" : "bg-warn";
  return (
    <span className="relative inline-flex size-2">
      <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", c)} />
      <span className={cn("relative size-2 rounded-full", c)} />
    </span>
  );
}

export function TonePill({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  return (
    <Chip size="sm" tone={tone}>
      {children}
    </Chip>
  );
}

/** Horizontal share bar list (network split etc). */
export function ShareBars({ items }: { items: { label: React.ReactNode; value: number; sub?: string; tone?: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2 text-fg-2">{it.label}</span>
            <span className="k-num shrink-0 font-medium text-fg">
              {it.sub && <span className="mr-2 font-normal text-fg-3">{it.sub}</span>}
              {it.value.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cn("h-full rounded-full", it.tone ?? "bg-ember")} style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

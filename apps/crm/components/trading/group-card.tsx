"use client";

import { Check } from "lucide-react";
import { Chip, cn } from "@kalks/ui";
import { modeLabel, type EngineGroup } from "./api";

const PHOTO: Record<string, string> = {
  standard: "finance",
  pro: "trading-screen",
  "pro-netting": "charts",
  ecn: "analytics",
  cent: "money",
  vip: "skyscrapers",
  prop: "trader",
};

export const groupPhoto = (g: Pick<EngineGroup, "code">) => `/assets/photos/${PHOTO[g.code] ?? "stock-market"}.jpg`;

/** Pricing model from the group's commercial terms. */
export const spreadType = (g: Pick<EngineGroup, "commissionPerLot">) => (g.commissionPerLot > 0 ? "Raw spread + commission" : "All-in spread, no commission");

export const commissionText = (g: Pick<EngineGroup, "commissionPerLot">) => (g.commissionPerLot > 0 ? `$${g.commissionPerLot.toFixed(2).replace(/\.00$/, "")} / lot` : "None");

export const maxLeverage = (g: Pick<EngineGroup, "leverages">) => (g.leverages.length ? Math.max(...g.leverages) : 0);

export function groupFeatures(g: EngineGroup) {
  return [
    spreadType(g),
    `${modeLabel(g.mode)}: ${g.mode === "hedging" ? "several buy and sell positions per symbol" : "one net position per symbol"}`,
    `Margin call ${g.marginCallPct}% · stop out ${g.stopOutPct}%`,
    g.cent ? "Balances in US cents (USC = USD × 100)" : g.swapFree ? "Swap-free (no overnight swaps)" : "Negative balance protection",
  ];
}

export function EngineGroupCard({
  g,
  selected,
  onSelect,
  used,
  kind,
  compact,
}: {
  g: EngineGroup;
  selected?: boolean;
  onSelect?: () => void;
  /** accounts of this kind the client already holds in the group (D23) */
  used?: number;
  kind?: "live" | "demo";
  compact?: boolean;
}) {
  const full = used !== undefined && used >= g.maxAccountsPerUser;
  const Comp = onSelect ? "button" : "div";
  return (
    <Comp
      type={onSelect ? "button" : undefined}
      onClick={full ? undefined : onSelect}
      disabled={onSelect ? full : undefined}
      aria-pressed={onSelect ? !!selected : undefined}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border text-left transition-colors duration-200",
        selected ? "border-ember/60 bg-surface shadow-[0_0_0_4px_rgba(255,90,31,0.12)]" : "k-card hover:border-[var(--k-border-top)]",
        full && "cursor-not-allowed opacity-55",
      )}
    >
      <div className={cn("relative overflow-hidden", compact ? "h-20" : "h-28")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={groupPhoto(g)} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] via-black/40 to-black/10" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[19px] font-semibold tracking-tight text-white">{g.name}</div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/75">
              {modeLabel(g.mode)}
              {g.cent && <span className="text-gold"> · USC cent</span>}
            </div>
          </div>
          {selected && (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ember text-white">
              <Check className="size-4" />
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <p className="text-[12.5px] leading-snug text-fg-2">{spreadType(g)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Spec label="Commission" value={commissionText(g)} />
          <Spec label="Min deposit" value={g.minDeposit > 0 ? `$${g.minDeposit.toLocaleString("en-US")}` : "None"} />
          <Spec label="Max leverage" value={`1:${maxLeverage(g).toLocaleString("en-US")}`} />
          <Spec label="Stop out" value={`${g.stopOutPct}%`} />
        </div>
        {!compact && (
          <ul className="mt-3 space-y-1.5">
            {groupFeatures(g).slice(1).map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-fg-2">
                <Check className="mt-0.5 size-3 shrink-0 text-gold" /> {f}
              </li>
            ))}
          </ul>
        )}
        {used !== undefined && (
          <div className="mt-auto pt-3">
            <Chip size="sm" tone={full ? "warn" : "neutral"}>
              {full ? `Limit reached · ${g.maxAccountsPerUser} ${kind ?? ""} accounts` : `${used} of ${g.maxAccountsPerUser} ${kind ?? ""} accounts used`}
            </Chip>
          </div>
        )}
      </div>
    </Comp>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-0.5 truncate text-[13px] font-semibold text-fg">{value}</div>
    </div>
  );
}

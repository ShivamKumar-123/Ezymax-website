"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@kalks/ui";
import type { ACCOUNT_GROUPS } from "@kalks/mock";

export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export const GROUP_FEATURES: Record<string, string[]> = {
  standard: ["All-in spreads, no commission", "Hedging or netting", "Stop out 20%"],
  pro: ["Raw-feel spreads from 0.3", "Instant execution", "Priority support"],
  ecn: ["Raw spreads from 0.0 pips", "Market execution, deep liquidity", "Best for EAs & scalping"],
  cent: ["Balances in USC (×100)", "Micro risk, real fills", "Hedging only"],
};

export function GroupCard({ g, selected, onSelect, compact }: { g: AccountGroup; selected?: boolean; onSelect?: () => void; compact?: boolean }) {
  const Comp = onSelect ? "button" : "div";
  return (
    <Comp
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border text-left transition-all duration-300",
        selected ? "border-ember/60 bg-surface shadow-[0_0_0_4px_rgba(255,90,31,0.12),0_20px_50px_-20px_rgba(255,90,31,0.45)]" : "k-card hover:-translate-y-0.5 hover:border-[var(--k-border-top)]",
      )}
    >
      <div className={cn("relative overflow-hidden", compact ? "h-24" : "h-32")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.photo} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] via-black/40 to-black/10" />
        {g.popular && (
          <div className="absolute right-[-52px] top-[20px] w-[190px] rotate-45 bg-gradient-to-r from-[#ff7a2f] to-[#e8431a] py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg">
            Most popular
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <div className="text-[20px] font-semibold tracking-tight text-white">{g.name}</div>
            {g.cent && <div className="text-[11px] font-medium uppercase tracking-wider text-gold">USC · cent</div>}
          </div>
          {selected && (
            <span className="grid size-7 place-items-center rounded-full bg-ember text-white shadow-[0_0_20px_rgba(255,90,31,0.7)]">
              <Check className="size-4" />
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <p className="text-[12.5px] leading-snug text-fg-2">{g.tagline}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Spec label="Spread from" value={`${g.spreadFrom} pips`} />
          <Spec label="Commission" value={g.commission === "None" ? "None" : "$3.5/lot"} />
          <Spec label="Min deposit" value={`$${g.minDeposit}`} />
          <Spec label="Max leverage" value={`1:${Math.max(...g.leverage).toLocaleString()}`} />
        </div>
        {!compact && (
          <ul className="mt-3 space-y-1.5">
            {GROUP_FEATURES[g.id]?.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12.5px] text-fg-2">
                <Sparkles className="size-3 text-gold" /> {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Comp>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-0.5 text-[13px] font-semibold text-fg">{value}</div>
    </div>
  );
}

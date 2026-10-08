"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import type { ACCOUNT_GROUPS } from "@ezymex/mock";
import { productOf } from "@/components/trading/api";

export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export const GROUP_FEATURES: Record<string, MessageKey[]> = {
  standard: ["accounts.mockFeature.standard.0", "accounts.mockFeature.standard.1", "accounts.mockFeature.standard.2"],
  pro: ["accounts.mockFeature.pro.0", "accounts.mockFeature.pro.1", "accounts.mockFeature.pro.2"],
  ecn: ["accounts.mockFeature.ecn.0", "accounts.mockFeature.ecn.1", "accounts.mockFeature.ecn.2"],
  cent: ["accounts.mockFeature.cent.0", "accounts.mockFeature.cent.1", "accounts.mockFeature.cent.2"],
  options: ["accounts.product.optionsPoint1", "accounts.product.optionsPoint2", "accounts.product.optionsPoint3"],
};

export function GroupCard({ g, selected, onSelect, compact }: { g: AccountGroup; selected?: boolean; onSelect?: () => void; compact?: boolean }) {
  const t = useT();
  // Options account types: what they trade instead of spreads and leverage (option margin ignores it)
  const options = productOf(g) === "options";
  const Comp = onSelect ? "button" : "div";
  return (
    <Comp
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border text-start transition-all duration-300",
        selected ? "border-ember/60 bg-surface shadow-[0_0_0_4px_color-mix(in_oklab,var(--k-ember)_12%,transparent),0_20px_50px_-20px_color-mix(in_oklab,var(--k-ember)_45%,transparent)]" : "k-card hover:-translate-y-0.5 hover:border-[var(--k-border-top)]",
      )}
    >
      <div className={cn("relative overflow-hidden", compact ? "h-24" : "h-32")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.photo} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--k-surface)] via-black/40 to-black/10" />
        {g.popular && (
          <div className="absolute right-[-52px] top-[20px] w-[190px] rotate-45 bg-gradient-to-r from-[var(--k-ember-2)] to-[color-mix(in_oklab,var(--k-ember)_78%,#000)] py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg">
            {t("accounts.groupCard.mostPopular")}
          </div>
        )}
        <div className="absolute bottom-3 start-4 end-4 flex items-end justify-between">
          <div>
            <div className="text-[20px] font-semibold tracking-tight text-white">{g.name}</div>
            {g.cent && <div className="text-[11px] font-medium uppercase tracking-wider text-gold">{t("accounts.groupCard.uscCent")}</div>}          </div>
          {selected && (
            <span className="grid size-7 place-items-center rounded-full bg-ember text-white shadow-[0_0_20px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]">
              <Check className="size-4" />
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <p className="text-[12.5px] leading-snug text-fg-2">{g.tagline}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {options ? (
            <>
              <Spec label={t("accounts.label.product")} value={t("accounts.product.options")} />
              <Spec label={t("accounts.label.commission")} value={`${g.commission.split(" /")[0]} ${t("accounts.opt.perContract")}`} />
              <Spec label={t("accounts.label.minDeposit")} value={`$${g.minDeposit}`} />
              <Spec label={t("accounts.label.positionMode")} value={t("accounts.mode.hedging")} />
            </>
          ) : (
            <>
              <Spec label={t("accounts.label.spreadFrom")} value={t("accounts.unit.pips", { value: g.spreadFrom })} />
              <Spec label={t("accounts.label.commission")} value={g.commission === "None" ? t("common.none") : t("accounts.unit.perLotCompact", { amount: "$3.5" })} />
              <Spec label={t("accounts.label.minDeposit")} value={`$${g.minDeposit}`} />
              <Spec label={t("accounts.label.maxLeverage")} value={`1:${Math.max(...g.leverage).toLocaleString()}`} />
            </>
          )}
        </div>
        {!compact && (
          <ul className="mt-3 space-y-1.5">
            {GROUP_FEATURES[g.id]?.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12.5px] text-fg-2">
                <Sparkles className="size-3 text-gold" /> {t(f)}
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
      <div className="text-[11px] text-fg-3">{label}</div>
      <div className="k-num mt-0.5 text-[13px] font-semibold text-fg">{value}</div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Copy, History, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Icon3D, PageHeader, Reveal, SpotlightCard, cn } from "@ezymex/ui";
import { PLANS, type CommissionPlan } from "@ezymex/mock/admin-partners";
import { auditToast, useReason } from "@/components/config/kit";
import { fmtDT, fmtInt } from "@/components/partners/common";
import { CpaCard, RateMatrix, TiersCard } from "@/components/partners/plan-editor";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveProgrammeSettings } from "@/components/partners-live/settings";

const KIND: Record<CommissionPlan["kind"], { label: string; tone: "ember" | "gold" | "info"; icon: string }> = {
  ib: { label: "Rebate", tone: "ember", icon: "handshake" },
  hybrid: { label: "Rebate + CPA", tone: "gold", icon: "gem_stone" },
  cpa: { label: "CPA", tone: "info", icon: "money_bag" },
};

function DemoCommissionPlans() {
  const [published, setPublished] = React.useState<CommissionPlan[]>(PLANS);
  const [drafts, setDrafts] = React.useState<CommissionPlan[]>(PLANS);
  const [sel, setSel] = React.useState(PLANS[0]!.id);
  const reason = useReason();
  const plan = drafts.find((p) => p.id === sel)!;
  const base = published.find((p) => p.id === sel)!;
  const dirty = JSON.stringify(plan) !== JSON.stringify(base);
  const update = (p: CommissionPlan) => setDrafts((ds) => ds.map((d) => (d.id === p.id ? p : d)));

  return (
    <div className="pb-16">
      <PageHeader
        title="Commission plans"
        subtitle="Per-lot rebates by symbol group and level, multi-tier splits and CPA qualification"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success(`${plan.name} version history`, { description: `v14 by ${plan.updatedBy} · ${fmtDT(plan.updated)}` })}>
              <History /> History
            </Button>
            <Button variant="surface" onClick={() => toast.success(`${plan.name} duplicated`, { description: `"${plan.name} (copy)" created as draft · 0 partners` })}>
              <Copy /> Duplicate
            </Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => update(base)}>
              <RotateCcw /> Discard
            </Button>
            <Button
              variant="ember"
              disabled={!dirty}
              onClick={() =>
                reason.ask({
                  title: `Publish ${plan.name}`,
                  description: `Applies to ${fmtInt(plan.partners)} partners from the next accrual (00:00 GMT+3). Already-accrued commissions are not recalculated.`,
                  reasons: ["Quarterly rate review", "Competitive adjustment", "Margin protection", "New symbol group launch", "Correction"],
                  confirmLabel: "Publish plan",
                  onConfirm: (r) => {
                    setPublished((ps) => ps.map((p) => (p.id === plan.id ? plan : p)));
                    auditToast(`${plan.name} published`, r);
                  },
                })
              }
            >
              <Save /> Publish changes
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {drafts.map((p, i) => {
          const k = KIND[p.kind];
          const on = p.id === sel;
          const edited = JSON.stringify(p) !== JSON.stringify(published.find((x) => x.id === p.id));
          return (
            <Reveal key={p.id} delay={i * 0.05}>
              <button type="button" onClick={() => setSel(p.id)} className="block h-full w-full text-left">
                <SpotlightCard hot={on} className={cn("relative h-full px-5 py-4 transition-colors", !on && "hover:border-fg-3/40")}>
                  <Icon3D name={k.icon} size={44} className="absolute right-4 top-4" />
                  <div className="flex items-center gap-2">
                    <Chip size="sm" tone={k.tone}>{k.label}</Chip>
                    {edited && <Chip size="sm" tone="warn" dot>Draft</Chip>}
                  </div>
                  <div className="mt-3 text-[16px] font-medium">{p.name}</div>
                  <div className="mt-1 line-clamp-1 pr-10 text-[12px] text-fg-3">{p.description}</div>
                  <div className="mt-3 flex items-center justify-between text-[12px] text-fg-3">
                    <span><span className="k-num font-medium text-fg">{fmtInt(p.partners)}</span> partners · {p.tiers.length} tier{p.tiers.length > 1 ? "s" : ""}</span>
                    <span className="font-mono">{p.id}</span>
                  </div>
                </SpotlightCard>
              </button>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <Reveal delay={0.1} className="2xl:col-span-8">
          <RateMatrix plan={plan} base={base} onChange={update} />
        </Reveal>
        <Reveal delay={0.15} className="2xl:col-span-4">
          <TiersCard plan={plan} onChange={update} />
        </Reveal>
      </div>

      <div className="mt-4">
        <Reveal delay={0.1}>
          <CpaCard plan={plan} onChange={update} />
        </Reveal>
      </div>

      <div className="mt-4 text-[12px] text-fg-3">
        Last published by {base.updatedBy} · {fmtDT(base.updated)} GMT+3 · every publish is versioned and can be rolled back from History.
      </div>
      {reason.node}
    </div>
  );
}

export default function CommissionPlansPage() {
  return IS_DEMO ? <DemoCommissionPlans /> : <LiveProgrammeSettings />;
}

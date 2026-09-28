"use client";

import * as React from "react";
import { Copy, History, Plus, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, PageHeader, Reveal } from "@kalks/ui";
import { auditToast, useReason } from "@/components/config/kit";
import { PLANS, type PropPlan } from "@/components/prop/data";
import { PlanCard } from "@/components/prop/plan-card";
import { FundedTermsCard, ModelCard, RiskCard, SizesCard, TradingRulesCard, defaultPhases } from "@/components/prop/plan-editor";
import { ChangeSummary, PlanPreview, diffPlan } from "@/components/prop/plan-preview";

const clone = (p: PropPlan): PropPlan => JSON.parse(JSON.stringify(p));

export default function PlanBuilderPage() {
  const [plans, setPlans] = React.useState<PropPlan[]>(() => PLANS.map(clone));
  const [selId, setSelId] = React.useState(PLANS[0].id);
  const [drafts, setDrafts] = React.useState<Record<string, PropPlan>>({});
  const reason = useReason();

  const saved = plans.find((p) => p.id === selId) ?? plans[0];
  const draft = drafts[saved.id] ?? saved;
  const changes = React.useMemo(() => diffPlan(saved, draft), [saved, draft]);

  const patch = React.useCallback(
    (p: Partial<PropPlan>) => setDrafts((d) => ({ ...d, [saved.id]: { ...(d[saved.id] ?? clone(saved)), ...p } })),
    [saved],
  );
  const commit = (next: PropPlan) => {
    setPlans((ps) => ps.map((p) => (p.id === next.id ? next : p)));
    setDrafts((d) => {
      const { [next.id]: _, ...rest } = d;
      return rest;
    });
  };

  const saveDraft = () => {
    commit({ ...draft, updated: "24 Sep 2026" });
    auditToast(`${draft.name} saved`, `${changes.length} change${changes.length === 1 ? "" : "s"} · not yet live`);
  };
  const publish = () =>
    reason.ask({
      title: `Publish ${draft.name}`,
      description: `Version ${draft.version + 1} goes live in the client store immediately. Existing ${draft.active.toLocaleString()} accounts keep their purchased rules.`,
      reasons: ["Pricing update", "Rule change approved by risk committee", "New plan launch", "Promotional campaign", "Regulatory / compliance"],
      confirmLabel: "Publish plan",
      body: changes.length ? (
        <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">{changes.length} changes</div>
          {changes.slice(0, 5).map((c) => (
            <div key={c} className="k-num truncate">
              · {c}
            </div>
          ))}
          {changes.length > 5 && <div className="text-fg-3">+{changes.length - 5} more</div>}
        </div>
      ) : undefined,
      onConfirm: (r) => {
        commit({ ...draft, status: "active", version: draft.version + 1, updated: "24 Sep 2026" });
        auditToast(`${draft.name} v${draft.version + 1} published`, r);
      },
    });

  const newPlan = () => {
    const id = `plan-${Date.now()}`;
    const base = clone(PLANS[1]);
    const p: PropPlan = { ...base, id, name: "New 1-Step plan", status: "draft", version: 0, updated: "24 Sep 2026", active: 0, sold30d: 0, passRate: 0, revenue30d: 0, trend: base.trend.map(() => 0), phases: defaultPhases("1-step") };
    setPlans((ps) => [...ps, p]);
    setSelId(id);
    toast.success("Draft plan created", { description: "Configure sizes and rules, then publish." });
  };
  const duplicate = (src: PropPlan) => {
    const id = `${src.id}-copy-${Date.now()}`;
    setPlans((ps) => [...ps, { ...clone(src), id, name: `${src.name} (copy)`, status: "draft", version: 0, active: 0, sold30d: 0, revenue30d: 0, updated: "24 Sep 2026", trend: src.trend.map(() => 0) }]);
    setSelId(id);
    toast.success(`${src.name} duplicated`, { description: "Saved as draft" });
  };
  const toggleStatus = (p: PropPlan) =>
    reason.ask({
      title: `${p.status === "active" ? "Pause" : "Resume"} sales · ${p.name}`,
      description: p.status === "active" ? "The plan disappears from the store. Running challenges are unaffected." : "The plan becomes purchasable again.",
      reasons: p.status === "active" ? ["Pricing review", "Liquidity / exposure limit", "Abuse wave detected", "Seasonal pause"] : ["Review complete", "Campaign start"],
      confirmLabel: p.status === "active" ? "Pause sales" : "Resume sales",
      tone: p.status === "active" ? "sell" : "ember",
      onConfirm: (r) => {
        setPlans((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: x.status === "active" ? "paused" : "active" } : x)));
        auditToast(`${p.name} ${p.status === "active" ? "paused" : "resumed"}`, r);
      },
    });
  const archive = (p: PropPlan) =>
    reason.ask({
      title: `Archive ${p.name}`,
      description: p.active ? `${p.active.toLocaleString()} running accounts will finish under current rules.` : "Draft will be removed from the catalogue.",
      reasons: ["Replaced by new plan", "Not profitable", "Created by mistake"],
      confirmLabel: "Archive",
      tone: "sell",
      onConfirm: (r) => {
        setPlans((ps) => (ps.length > 1 ? ps.filter((x) => x.id !== p.id) : ps));
        if (selId === p.id) setSelId(plans.find((x) => x.id !== p.id)?.id ?? selId);
        auditToast(`${p.name} archived`, r);
      },
    });

  return (
    <div className="pb-24">
      <PageHeader
        title="Plan builder"
        subtitle="Design challenge models, pricing and rule sets. Changes apply to new purchases only."
        actions={
          <>
            <Button size="sm" variant="surface" onClick={() => toast("Version history", { description: `${saved.name}: v${saved.version} live since ${saved.updated} · 6 earlier versions in audit log` })}>
              <History /> History
            </Button>
            <Button size="sm" variant="surface" onClick={() => duplicate(saved)}>
              <Copy /> Duplicate
            </Button>
            <Button size="sm" variant="ember" onClick={newPlan}>
              <Plus /> New plan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <PlanCard plan={drafts[p.id] ?? p} selected={p.id === selId} dirty={!!drafts[p.id] && diffPlan(p, drafts[p.id]).length > 0} onSelect={() => setSelId(p.id)} onDuplicate={() => duplicate(p)} onToggleStatus={() => toggleStatus(p)} onArchive={() => archive(p)} />
          </Reveal>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-fg-2">
          Editing <span className="font-medium text-fg">{draft.name}</span>
          <Chip size="sm">v{saved.version}</Chip>
          {changes.length > 0 && (
            <Chip size="sm" tone="warn" dot>
              {changes.length} unsaved
            </Chip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="surface" disabled={!changes.length} onClick={saveDraft}>
            <Save /> Save draft
          </Button>
          <Button size="sm" variant="ember" onClick={publish}>
            <Send /> Publish
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Reveal delay={0.05}>
            <ModelCard plan={draft} patch={patch} />
          </Reveal>
          <Reveal delay={0.1}>
            <SizesCard plan={draft} patch={patch} />
          </Reveal>
          <Reveal delay={0.15}>
            <RiskCard plan={draft} patch={patch} />
          </Reveal>
          <Reveal delay={0.2}>
            <TradingRulesCard plan={draft} patch={patch} />
          </Reveal>
          <Reveal delay={0.25}>
            <FundedTermsCard plan={draft} patch={patch} />
          </Reveal>
        </div>
        <div className="xl:col-span-4">
          <div className="space-y-4 xl:sticky xl:top-24">
            <Reveal delay={0.1}>
              <PlanPreview key={draft.id} plan={draft} />
            </Reveal>
            <Reveal delay={0.15}>
              <ChangeSummary
                changes={changes}
                plan={saved}
                onSave={saveDraft}
                onPublish={publish}
                onDiscard={() => {
                  setDrafts((d) => {
                    const { [saved.id]: _, ...rest } = d;
                    return rest;
                  });
                  toast("Changes discarded");
                }}
              />
            </Reveal>
          </div>
        </div>
      </div>
      {reason.node}
    </div>
  );
}

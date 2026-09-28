"use client";

import * as React from "react";
import { Archive, Copy, MoreHorizontal, Pause, Play, Plus, RotateCcw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, DialogClose, IconButton, Menu, PageHeader, Reveal, Segmented, Skeleton, cn } from "@kalks/ui";
import { MiniField, TextInput } from "@/components/config/kit";
import { ago, useApi, useNow } from "@/components/live/kit";
import { PlanTypeChip, PropError, PropStatus, ReadOnlyNote, int, pct, propWrite, reasonText, usd, useAction, usePropCan, usdK, type EngineGroup, type Plan, type PlanRow, type PlanStatus, type PlanType } from "./kit";
import { FundedTermsCard, ModelCard, PlanPreview, RiskCard, SizesCard, TradingRulesCard, defaultPhases, diffPlan, planIssues, type FieldError } from "./plan-editor";

const SAVE_REASONS = ["Pricing update", "Rule change approved by risk", "New plan launch", "Promotional campaign", "Regulatory / compliance", "Correction"];
const STATUS_REASONS: Record<PlanStatus, string[]> = {
  active: ["New plan launch", "Review complete", "Campaign start"],
  paused: ["Pricing review", "Exposure limit", "Abuse detected", "Seasonal pause"],
  archived: ["Replaced by a new plan", "Not profitable", "Created by mistake"],
  draft: ["Rework before relaunch"],
};

const strip = (p: PlanRow): Plan => {
  const { stats: _s, ...rest } = p;
  return JSON.parse(JSON.stringify(rest)) as Plan;
};

export function LivePlanBuilder() {
  const now = useNow();
  const canWrite = usePropCan("prop.write");
  const { data, error, reload } = useApi<{ plans: PlanRow[] }>("/api/prop/plans");
  const groupsQ = useApi<{ groups: EngineGroup[] }>("/api/prop/engine-groups");
  const groups = groupsQ.data?.groups ?? [];
  const [showArchived, setShowArchived] = React.useState(false);
  const [selId, setSelId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, Plan>>({});
  /** unsaved new plans (key = local key) */
  const [fresh, setFresh] = React.useState<Record<string, Plan>>({});
  const [fieldErr, setFieldErr] = React.useState<FieldError>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const act = useAction();

  const plans = data?.plans ?? [];
  const visible = plans.filter((p) => showArchived || p.status !== "archived");
  React.useEffect(() => {
    if (!selId && visible[0]) setSelId(visible[0].id);
  }, [selId, visible]);
  React.useEffect(() => setFieldErr(null), [selId]);

  const freshKey = selId && fresh[selId] ? selId : null;
  const savedRow = plans.find((p) => p.id === selId) ?? null;
  const saved = savedRow ? strip(savedRow) : null;
  const draft: Plan | null = freshKey ? fresh[freshKey]! : saved ? (drafts[saved.id] ?? saved) : null;
  const changes = React.useMemo(() => (draft ? diffPlan(saved, draft) : []), [saved, draft]);
  const dirty = !!freshKey || (!!saved && !!drafts[saved.id] && changes.length > 0);
  const issues = draft ? planIssues(draft, groups) : [];

  const patch = React.useCallback(
    (p: Partial<Plan>) => {
      setFieldErr(null);
      if (freshKey) setFresh((f) => ({ ...f, [freshKey]: { ...f[freshKey]!, ...p } }));
      else if (saved) setDrafts((d) => ({ ...d, [saved.id]: { ...(d[saved.id] ?? saved), ...p } }));
    },
    [freshKey, saved],
  );
  const discard = () => {
    if (freshKey) {
      setFresh(({ [freshKey]: _, ...rest }) => rest);
      setSelId(visible[0]?.id ?? null);
    } else if (saved) setDrafts(({ [saved.id]: _, ...rest }) => rest);
    setFieldErr(null);
  };

  const save = () => {
    if (!draft) return;
    const isNew = !!freshKey;
    act.ask({
      title: isNew ? `Create ${draft.name || draft.id}` : `Save ${draft.name}`,
      description: isNew ? "The plan is created as a draft. Publish it to put it on sale." : `Saves version ${(saved?.version ?? 0) + 1}. Running challenges keep the rules they bought.`,
      reasons: SAVE_REASONS,
      note: "optional",
      confirmLabel: isNew ? "Create plan" : "Save plan",
      body: (
        <div className="rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">
            {changes.length} change{changes.length === 1 ? "" : "s"}
          </div>
          {changes.slice(0, 6).map((c) => (
            <div key={c} className="k-num truncate">
              · {c}
            </div>
          ))}
          {changes.length > 6 && <div className="text-fg-3">+{changes.length - 6} more</div>}
        </div>
      ),
      run: async (v) => {
        const { updatedAt: _u, updatedBy: _b, ...body } = draft;
        const res = isNew ? await propWrite<{ plan: Plan }>("plans", { ...body, status: "draft", reason: reasonText(v) }) : await propWrite<{ plan: Plan }>(`plans/${encodeURIComponent(draft.id)}`, { ...body, status: saved?.status ?? draft.status, reason: reasonText(v) }, "PUT");
        if (!res.ok && res.error.field) setFieldErr({ field: res.error.field, message: res.error.message });
        return res;
      },
      success: isNew ? `${draft.name || draft.id} created` : `${draft.name} saved`,
      onDone: () => {
        if (freshKey) {
          setFresh(({ [freshKey]: _, ...rest }) => rest);
          setSelId(draft.id);
        } else setDrafts(({ [draft.id]: _, ...rest }) => rest);
        reload();
      },
    });
  };

  const setStatus = (p: PlanRow, status: PlanStatus) => {
    const verb = { active: p.status === "paused" ? "Resume sales" : "Publish", paused: "Pause sales", archived: "Archive", draft: "Move to draft" }[status];
    act.ask({
      title: `${verb} · ${p.name}`,
      description:
        status === "active"
          ? "The plan is on sale in the client store immediately."
          : status === "paused"
            ? "The plan disappears from the store. Running challenges are unaffected."
            : status === "archived"
              ? `The plan is retired. ${int(p.stats?.active ?? 0)} running challenges finish under the rules they bought.`
              : "The plan leaves the store and can be edited before relaunch.",
      reasons: STATUS_REASONS[status],
      note: "optional",
      confirmLabel: verb,
      confirmVariant: status === "active" ? "buy" : status === "archived" || status === "paused" ? "sell" : "ember",
      run: (v) => propWrite(`plans/${encodeURIComponent(p.id)}/status`, { status, reason: reasonText(v) }),
      success: `${p.name}: ${status}`,
      onDone: reload,
    });
  };

  const duplicate = (src: Plan) => {
    let id = `${src.id}-copy`.slice(0, 48);
    let n = 2;
    while (plans.some((p) => p.id === id) || fresh[id]) id = `${src.id.slice(0, 44)}-c${n++}`;
    setFresh((f) => ({ ...f, [id]: { ...JSON.parse(JSON.stringify(src)), id, name: `${src.name} (copy)`, status: "draft", version: 0 } }));
    setSelId(id);
  };

  const create = (id: string, name: string, type: PlanType) => {
    const base = plans.find((p) => p.type === type) ?? plans[0];
    const tpl: Plan = base
      ? { ...strip(base), id, name, type, status: "draft", version: 0, phases: base.type === type ? strip(base).phases : defaultPhases(type) }
      : {
          id,
          name,
          type,
          status: "draft",
          version: 0,
          group: groups.find((g) => g.code === "prop")?.code ?? groups[0]?.code ?? "prop",
          sizes: [10000, 25000, 50000, 100000].map((size) => ({ size, fee: Math.round(size * 0.009), leverage: 100, enabled: true })),
          phases: defaultPhases(type),
          dailyLoss: 5,
          dailyBasis: "balance",
          maxDD: 10,
          ddType: "static",
          trailingLock: true,
          consistency: 0,
          newsTrading: true,
          newsWindow: 2,
          newsBreachFails: false,
          weekendHolding: true,
          eaAllowed: true,
          banned: ["hft", "latency_arbitrage", "tick_scalping", "cross_account_copying", "cross_account_hedging"],
          split: 80,
          splitMax: 90,
          scalingEvery: 4,
          scalingIncrease: 25,
          scalingProfit: 10,
          scalingCap: 2000000,
          refundFee: true,
          payoutFreq: "bi-weekly",
          firstPayoutDays: 14,
          minPayout: 50,
        };
    setFresh((f) => ({ ...f, [id]: tpl }));
    setSelId(id);
    setNewOpen(false);
  };

  if (error && !data) return <Shell canWrite={canWrite} onNew={() => setNewOpen(true)}><PropError error={error} onRetry={reload} /></Shell>;

  const freshList = Object.values(fresh);
  return (
    <Shell
      canWrite={canWrite}
      onNew={() => setNewOpen(true)}
      extra={
        <Segmented size="sm" value={showArchived ? "all" : "live"} onChange={(v) => setShowArchived(v === "all")} options={[{ value: "live", label: "Current" }, { value: "all", label: "Include archived" }]} />
      }
    >
      {!data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[190px] rounded-[20px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.04}>
              <LivePlanCard plan={p} selected={p.id === selId} dirty={!!drafts[p.id] && diffPlan(strip(p), drafts[p.id]!).length > 0} canWrite={canWrite} now={now} onSelect={() => setSelId(p.id)} onDuplicate={() => duplicate(strip(p))} onStatus={(s) => setStatus(p, s)} />
            </Reveal>
          ))}
          {freshList.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelId(p.id)}
              className={cn("k-card flex h-full flex-col p-5 text-left transition-colors", selId === p.id ? "border-ember/50" : "hover:border-[var(--k-border-top)]")}
            >
              <span className="flex items-center gap-2">
                <PlanTypeChip type={p.type} />
                <Chip size="sm" tone="warn">
                  Not saved
                </Chip>
              </span>
              <span className="mt-3 truncate text-[16px] font-medium tracking-tight">{p.name || "Untitled plan"}</span>
              <span className="mt-0.5 font-mono text-[12px] text-fg-3">{p.id}</span>
            </button>
          ))}
          {visible.length === 0 && freshList.length === 0 && <div className="rounded-[20px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-fg-3 sm:col-span-2 xl:col-span-4">No plans yet.</div>}
        </div>
      )}

      {draft && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
              Editing <span className="font-medium text-fg">{draft.name || draft.id}</span>
              {saved ? <Chip size="sm">v{saved.version}</Chip> : <Chip size="sm" tone="warn">New</Chip>}
              {saved && <PropStatus status={saved.status} />}
              {dirty && (
                <Chip size="sm" tone="warn" dot>
                  {freshKey ? "Not saved" : `${changes.length} unsaved`}
                </Chip>
              )}
              {!canWrite && <ReadOnlyNote what="edit plans" />}
            </div>
            {canWrite && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={!dirty} onClick={discard}>
                  <RotateCcw /> Discard
                </Button>
                <Button size="sm" variant="ember" disabled={!dirty || issues.length > 0} onClick={save}>
                  <Save /> {freshKey ? "Create plan" : "Save"}
                </Button>
                {saved && savedRow && saved.status !== "active" && saved.status !== "archived" && (
                  <Button size="sm" variant="surface" disabled={dirty} onClick={() => setStatus(savedRow, "active")} title={dirty ? "Save or discard your changes first" : undefined}>
                    <Send /> Publish
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <fieldset disabled={!canWrite} className="min-w-0 space-y-4 xl:col-span-8">
              <ModelCard plan={draft} patch={patch} groups={groups} isNew={!!freshKey} error={fieldErr} />
              <SizesCard plan={draft} patch={patch} groups={groups} error={fieldErr} />
              <RiskCard plan={draft} patch={patch} error={fieldErr} />
              <TradingRulesCard plan={draft} patch={patch} error={fieldErr} />
              <FundedTermsCard plan={draft} patch={patch} error={fieldErr} />
            </fieldset>
            <div className="xl:col-span-4">
              <div className="space-y-4 xl:sticky xl:top-24">
                <PlanPreview key={draft.id} plan={draft} groups={groups} />
                <Card>
                  <CardHeader title="Pending changes" subtitle={saved ? `v${saved.version} → v${saved.version + 1} · new purchases only` : "New plan · saved as draft"} action={<Chip tone={dirty ? "warn" : "neutral"}>{dirty ? changes.length : 0}</Chip>} />
                  <div className="px-4 pb-5 pt-3 sm:px-6">
                    {dirty ? (
                      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                        {changes.map((c) => (
                          <li key={c} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" />
                            <span className="k-num">{c}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-[12px] border border-dashed border-line px-3 py-3 text-center text-[12.5px] text-fg-3">No unsaved edits. Running challenges keep the rules they bought.</div>
                    )}
                    {issues.length > 0 && (
                      <div className="mt-3 space-y-1 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2.5 text-[12.5px] text-fg">
                        {issues.map((x) => (
                          <div key={x}>· {x}</div>
                        ))}
                      </div>
                    )}
                    {saved?.updatedAt && (
                      <div className="mt-3 text-[11.5px] text-fg-3">
                        Last saved {ago(saved.updatedAt, now)}
                        {saved.updatedBy ? ` by ${saved.updatedBy}` : ""}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </>
      )}

      <NewPlanDialog open={newOpen} onOpenChange={setNewOpen} taken={[...plans.map((p) => p.id), ...Object.keys(fresh)]} onCreate={create} />
      {act.node}
    </Shell>
  );
}

function Shell({ children, canWrite, onNew, extra }: { children: React.ReactNode; canWrite: boolean; onNew: () => void; extra?: React.ReactNode }) {
  return (
    <div className="pb-24">
      <PageHeader
        title="Plan builder"
        subtitle="Challenge models, pricing and rule sets. Every save bumps the version; running challenges keep the rules they bought."
        actions={
          <>
            {extra}
            {canWrite && (
              <Button size="sm" variant="ember" onClick={onNew}>
                <Plus /> New plan
              </Button>
            )}
          </>
        }
      />
      {children}
    </div>
  );
}

function LivePlanCard({ plan, selected, dirty, canWrite, now, onSelect, onDuplicate, onStatus }: { plan: PlanRow; selected: boolean; dirty: boolean; canWrite: boolean; now: number; onSelect: () => void; onDuplicate: () => void; onStatus: (s: PlanStatus) => void }) {
  const enabled = plan.sizes.filter((s) => s.enabled);
  const from = enabled.length ? Math.min(...enabled.map((s) => s.fee)) : null;
  const items = [
    { label: "Duplicate plan", icon: <Copy />, onSelect: onDuplicate },
    ...(plan.status === "draft" || plan.status === "paused" ? [{ label: plan.status === "paused" ? "Resume sales" : "Publish", icon: <Play />, onSelect: () => onStatus("active") }] : []),
    ...(plan.status === "active" ? [{ label: "Pause sales", icon: <Pause />, onSelect: () => onStatus("paused") }] : []),
    ...(plan.status === "archived" ? [{ label: "Move to draft", icon: <RotateCcw />, onSelect: () => onStatus("draft") }] : []),
    ...(plan.status !== "archived" ? ["sep" as const, { label: "Archive plan", icon: <Archive />, danger: true, onSelect: () => onStatus("archived") }] : []),
  ];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn("k-card relative flex h-full cursor-pointer flex-col p-5 text-left outline-none transition-colors", selected ? "border-ember/50 shadow-[0_0_0_1px_var(--k-ember)]" : "hover:border-[var(--k-border-top)]", plan.status === "archived" && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <PlanTypeChip type={plan.type} />
            <PropStatus status={plan.status} />
            {dirty && (
              <Chip size="sm" tone="warn">
                Unsaved
              </Chip>
            )}
          </div>
          <div className="mt-3 truncate text-[16px] font-medium tracking-tight">{plan.name}</div>
          <div className="k-num mt-0.5 truncate text-[12px] text-fg-3">
            v{plan.version} · {plan.group} · {plan.updatedAt ? `updated ${ago(plan.updatedAt, now)}` : plan.id}
          </div>
        </div>
        {canWrite && (
          <span onClick={(e) => e.stopPropagation()}>
            <Menu
              trigger={
                <IconButton size="sm" aria-label="Plan actions">
                  <MoreHorizontal />
                </IconButton>
              }
              items={items}
            />
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1">
        {enabled.map((s) => (
          <span key={s.size} className="k-num rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">
            {usdK(s.size)}
          </span>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-4 gap-2 pt-4">
        <Stat label="From" value={from === null ? "—" : usd(from, 0)} />
        <Stat label="Active" value={int(plan.stats?.active)} />
        <Stat label="Sold 30d" value={int(plan.stats?.sold30d)} sub={usd(plan.stats?.revenue30d, 0)} />
        <Stat label="Pass" value={plan.stats?.passRate === null || plan.stats?.passRate === undefined ? "—" : pct(plan.stats.passRate, 0)} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-0.5 truncate text-[14px] font-semibold">{value}</div>
      {sub && <div className="k-num truncate text-[10.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

function NewPlanDialog({ open, onOpenChange, taken, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; taken: string[]; onCreate: (id: string, name: string, type: PlanType) => void }) {
  const [name, setName] = React.useState("");
  const [id, setId] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [type, setType] = React.useState<PlanType>("1-step");
  React.useEffect(() => {
    if (open) {
      setName("");
      setId("");
      setTouched(false);
      setType("1-step");
    }
  }, [open]);
  const slug = touched ? id : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const bad = !/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug) ? "2–48 lowercase letters, digits or dashes" : taken.includes(slug) ? "This id is already used" : null;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New plan"
      description="Starts from the rules of an existing plan of the same type. Nothing is saved until you create it."
      width={480}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="ember" size="sm" disabled={!!bad || !name.trim()} onClick={() => onCreate(slug, name.trim(), type)}>
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MiniField label="Plan name">
          <TextInput value={name} onChange={setName} placeholder="Kalks Rapid 1-Step" />
        </MiniField>
        <MiniField label="Plan id" hint={bad ? <span className="text-down">{bad}</span> : "Used in links and reports"}>
          <TextInput
            mono
            value={slug}
            onChange={(v) => {
              setTouched(true);
              setId(v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48));
            }}
          />
        </MiniField>
        <MiniField label="Challenge type">
          <Segmented size="md" value={type} onChange={setType} options={[{ value: "1-step", label: "1-Step" }, { value: "2-step", label: "2-Step" }, { value: "instant", label: "Instant" }]} />
        </MiniField>
      </div>
    </Dialog>
  );
}

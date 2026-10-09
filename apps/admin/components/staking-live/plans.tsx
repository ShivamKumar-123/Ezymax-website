"use client";

import * as React from "react";
import { Lock, Plus, RefreshCw } from "lucide-react";
import { Button, Card, DataTable, Dialog, PageHeader, Progress, Reveal, cn, type Column } from "@ezymex/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { TableSkeleton, ago, useApi, useNow, when } from "@/components/live/kit";
import { S, stakingSend, type Plan, type PlanStatus, type PlansDoc } from "./api";
import { Amount, EmptyNote, Note, PLAN_STATUS, ReadOnlyNote, StakingError, StatusPill, amt, money, amtK, int, pct, usePerms, useReasonAction, useUrlParam } from "./kit";

/* ------------------------------------------------------------------ */
/* Form model                                                           */
/* ------------------------------------------------------------------ */

type Form = {
  name: string;
  status: PlanStatus;
  currency: string;
  termMonths: string;
  minAmount: string;
  maxAmount: string;
  perUserMax: string;
  capacity: string;
  maxMonthlyRatePct: string;
  sort: string;
  description: string;
  riskText: string;
};

type Key = keyof Form;

const LABEL: Record<Key, string> = {
  name: "Name",
  status: "Status",
  currency: "Currency",
  termMonths: "Term",
  minAmount: "Minimum",
  maxAmount: "Maximum per subscription",
  perUserMax: "Maximum per client",
  capacity: "Total capacity",
  maxMonthlyRatePct: "Monthly rate ceiling",
  sort: "Sort order",
  description: "Description",
  riskText: "Risk disclosure",
};

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function fromPlan(p: Plan): Form {
  return {
    name: p.name,
    status: p.status,
    currency: p.currency,
    termMonths: String(p.termMonths),
    minAmount: s(p.minAmount),
    maxAmount: s(p.maxAmount),
    perUserMax: s(p.perUserMax),
    capacity: s(p.capacity),
    maxMonthlyRatePct: s(p.maxMonthlyRatePct),
    sort: String(p.sort),
    description: p.description,
    riskText: p.riskText,
  };
}

const blank = (currency: string): Form => ({
  name: "",
  status: "draft",
  currency,
  termMonths: "6",
  minAmount: "100",
  maxAmount: "",
  perUserMax: "",
  capacity: "",
  maxMonthlyRatePct: "",
  sort: "0",
  description: "",
  riskText: "",
});

const clean = (v: string) => v.replace(/[,\s]/g, "");
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const RATE = /^\d+(\.\d{1,4})?$/;

/** Client-side checks mirroring services/staking/src/plans.rs `draft`. */
function validate(f: Form): Partial<Record<Key, string>> {
  const e: Partial<Record<Key, string>> = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 80) e.name = "2–80 characters.";
  const min = clean(f.minAmount);
  if (!AMOUNT.test(min) || Number(min) <= 0 || Number(min) > 1e9) e.minAmount = "Above 0, at most 2 decimals.";
  for (const k of ["maxAmount", "perUserMax", "capacity"] as const) {
    const v = clean(f[k]);
    if (!v) continue;
    if (!AMOUNT.test(v) || Number(v) <= 0 || Number(v) > 1e9) e[k] = "Above 0, at most 2 decimals, or empty for no limit.";
    else if (!e.minAmount && Number(v) < Number(min)) e[k] = "Can't be below the minimum.";
  }
  const term = clean(f.termMonths);
  if (!/^\d+$/.test(term) || Number(term) < 1 || Number(term) > 60) e.termMonths = "Whole months, 1–60.";
  const rate = clean(f.maxMonthlyRatePct);
  if (!RATE.test(rate) || Number(rate) <= 0 || Number(rate) > 100) e.maxMonthlyRatePct = "Above 0 % and at most 100 %, 4 decimals.";
  const sort = clean(f.sort);
  if (sort && !/^-?\d+$/.test(sort)) e.sort = "A whole number.";
  if (f.description.length > 2000) e.description = "At most 2,000 characters.";
  if (f.riskText.length > 4000) e.riskText = "At most 4,000 characters.";
  if (f.status === "active" && f.riskText.trim().length < 20) e.riskText = "A plan on sale needs its risk disclosure (at least 20 characters).";
  return e;
}

/** The JSON value the service expects for a form field. */
function value(f: Form, k: Key): unknown {
  switch (k) {
    case "minAmount":
    case "termMonths":
    case "maxMonthlyRatePct":
      return Number(clean(f[k]));
    case "maxAmount":
    case "perUserMax":
    case "capacity":
      return clean(f[k]) ? Number(clean(f[k])) : null;
    case "sort":
      return clean(f.sort) ? Number(clean(f.sort)) : 0;
    case "name":
    case "description":
    case "riskText":
      return f[k].trim();
    default:
      return f[k];
  }
}

const KEYS = Object.keys(LABEL) as Key[];

function show(k: Key, v: unknown, currency: string) {
  if (v === null || v === undefined || v === "") return k === "maxAmount" || k === "perUserMax" || k === "capacity" ? "No limit" : "—";
  if (k === "minAmount" || k === "maxAmount" || k === "perUserMax" || k === "capacity") return amt(Number(v), currency);
  if (k === "maxMonthlyRatePct") return `${pct(Number(v))} a month`;
  if (k === "termMonths") return `${v} month${Number(v) === 1 ? "" : "s"}`;
  if (k === "status") return PLAN_STATUS[v as PlanStatus]?.label ?? String(v);
  const t = String(v);
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

function Txt({ value, onChange, placeholder, suffix, disabled, invalid, inputMode, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; suffix?: React.ReactNode; disabled?: boolean; invalid?: boolean; inputMode?: "decimal" | "numeric" | "text"; mono?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-[12px] border bg-surface-2 px-3 text-[13.5px] transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10",
        invalid ? "border-down/50" : "border-line",
        disabled && "opacity-60",
      )}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        className={cn("h-full w-full min-w-0 bg-transparent text-fg outline-none placeholder:text-fg-3 disabled:cursor-not-allowed", inputMode && inputMode !== "text" && "k-num", mono && "font-mono")}
      />
      {suffix && <span className="shrink-0 text-[11.5px] text-fg-3">{suffix}</span>}
    </div>
  );
}

function Area({ value, onChange, placeholder, rows = 4, disabled, invalid, max }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean; invalid?: boolean; max: number }) {
  return (
    <textarea
      value={value}
      rows={rows}
      maxLength={max}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full resize-y rounded-[12px] border bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10 disabled:cursor-not-allowed disabled:opacity-60",
        invalid ? "border-down/50" : "border-line",
      )}
    />
  );
}

function F({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-fg-2">
        {label}
        {hint && <span className="text-right font-normal text-fg-3">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-[11.5px] text-down">{error}</span>}
    </div>
  );
}

const STATUS_HELP: Record<PlanStatus, string> = {
  draft: "Hidden from clients",
  active: "On sale in the Client Area",
  paused: "Visible, not sold; positions keep earning",
  closed: "Not sold; positions run to maturity",
};

function StatusPicker({ value, onChange, disabled, lockDraft }: { value: PlanStatus; onChange: (v: PlanStatus) => void; disabled?: boolean; lockDraft?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(["draft", "active", "paused", "closed"] as const).map((k) => {
        const on = value === k;
        const off = disabled || (lockDraft && k === "draft" && value !== "draft");
        return (
          <button
            key={k}
            type="button"
            disabled={off}
            onClick={() => onChange(k)}
            title={lockDraft && k === "draft" ? "Clients hold positions in this plan: pause or close it instead." : STATUS_HELP[k]}
            className={cn(
              "rounded-[12px] border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              on ? "border-ember/40 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3",
            )}
          >
            <span className={cn("block text-[12.5px] font-medium", on ? "text-ember" : "text-fg")}>{PLAN_STATUS[k].label}</span>
            <span className="mt-0.5 block text-[10.5px] leading-snug text-fg-3">{STATUS_HELP[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

function PlanEditor({ plan, isNew, currencies, canWrite, onClose, onSaved }: { plan: Plan | null; isNew: boolean; currencies: string[]; canWrite: boolean; onClose: () => void; onSaved: (p: Plan) => void }) {
  const now = useNow();
  const act = useReasonAction();
  const open = isNew || !!plan;
  const base = React.useMemo(() => (plan ? fromPlan(plan) : blank(currencies[0] ?? "USDT")), [plan, currencies]);
  const [f, setF] = React.useState<Form>(base);
  const [serverErr, setServerErr] = React.useState<{ field?: string; message: string } | null>(null);
  React.useEffect(() => {
    setF(base);
    setServerErr(null);
  }, [base, open]);

  const set = <K extends Key>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    if (serverErr?.field === k) setServerErr(null);
  };
  const errs = validate(f);
  const err = (k: Key) => errs[k] ?? (serverErr?.field === k ? serverErr.message : undefined);
  const changed = KEYS.filter((k) => JSON.stringify(value(f, k)) !== JSON.stringify(value(base, k)));
  const invalid = Object.keys(errs).length > 0;
  const held = plan ? plan.stats.activePositions + plan.stats.maturedPositions + (plan.stats.pendingPrincipal > 0 ? 1 : 0) > 0 : false;
  const ro = !canWrite;
  const cur = f.currency || "USDT";

  const save = () => {
    if (invalid || (!isNew && changed.length === 0)) return;
    const body: Record<string, unknown> = {};
    for (const k of isNew ? KEYS : changed) body[k] = value(f, k);
    act.ask<{ plan: Plan }>({
      title: isNew ? `Create “${f.name.trim()}”` : `Save changes to “${plan!.name}”`,
      description: isNew
        ? f.status === "active"
          ? "The plan goes on sale in the Client Area as soon as it is created."
          : `The plan is created as ${PLAN_STATUS[f.status].label.toLowerCase()}; clients can't subscribe until it is on sale.`
        : "Changes apply to new subscriptions only. Existing positions keep the terms their clients accepted.",
      body: (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12.5px]">
          {(isNew ? KEYS.filter((k) => k !== "description" && k !== "riskText") : changed).map((k) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-fg-3">{LABEL[k]}</span>
              <span className="k-num text-right text-fg">
                {!isNew && <span className="text-fg-3 line-through decoration-fg-3/50">{show(k, value(base, k), plan?.currency ?? cur)}</span>}
                {!isNew && " → "}
                {show(k, value(f, k), cur)}
              </span>
            </div>
          ))}
        </div>
      ),
      confirmLabel: isNew ? "Create plan" : "Save changes",
      placeholder: isNew ? "Why is this plan being created? Kept in the staking audit log." : "Why is this plan changing? Kept in the staking audit log.",
      run: async (reason) => {
        const r = await stakingSend<{ plan: Plan }>(isNew ? "plans" : `plans/${plan!.id}`, { ...body, reason }, isNew ? "POST" : "PATCH");
        if (!r.ok && r.error.field && r.error.field !== "reason") setServerErr({ field: r.error.field, message: r.error.message });
        else if (!r.ok) setServerErr({ message: r.error.message });
        return r;
      },
      success: (r) => (isNew ? `${r.plan.name} created` : `${r.plan.name} saved`),
      successDetail: (r) => `Version ${r.plan.version} · ${PLAN_STATUS[r.plan.status].label} · recorded in the staking audit log`,
      onDone: (r) => onSaved(r.plan),
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        side="right"
        title={isNew ? "New plan" : (plan?.name ?? "")}
        description={plan ? `Plan #${plan.id} · version ${plan.version} · updated ${ago(plan.updatedAt, now)}` : "Term, limits, the monthly rate ceiling and what clients read before subscribing."}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11.5px] text-fg-3">
              {ro ? "View only" : invalid ? "Fix the highlighted fields" : !isNew && changed.length === 0 ? "No changes" : !isNew ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {ro ? "Close" : "Cancel"}
            </Button>
            {!ro && (
              <Button variant="ember" size="sm" disabled={invalid || (!isNew && changed.length === 0)} onClick={save}>
                {isNew ? "Create plan" : "Save changes"}
              </Button>
            )}
          </div>
        }
      >
        <div>
          {ro && (
            <div className="mb-4">
              <ReadOnlyNote what="edit plans" />
            </div>
          )}
          {serverErr && !serverErr.field && (
            <Note tone="down" className="mb-4">
              {serverErr.message}
            </Note>
          )}
          {plan && (
            <Section title="Activity">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Active principal" value={money(plan.stats.activePrincipal, plan.currency)} tone="gold" sub={plan.stats.pendingPrincipal > 0 ? `+ ${amt(plan.stats.pendingPrincipal, plan.currency)} pending` : undefined} />
                <MiniStat label="Investors" value={int(plan.stats.investors)} sub={`${int(plan.stats.activePositions)} active · ${int(plan.stats.maturedPositions)} matured`} />
              </div>
              {held && (
                <Note className="mt-3" icon={<Lock />}>
                  Clients hold positions in this plan, so its currency is fixed and it can't go back to draft. Each position keeps the plan version its client accepted.
                </Note>
              )}
            </Section>
          )}

          <Section title="Plan">
            <div className="space-y-3">
              <F label="Name" hint={`${f.name.trim().length}/80`} error={err("name")}>
                <Txt value={f.name} onChange={(v) => set("name", v)} placeholder="Fixed 6 months" disabled={ro} invalid={!!err("name")} />
              </F>
              <F label="Status" error={err("status")}>
                <StatusPicker value={f.status} onChange={(v) => set("status", v)} disabled={ro} lockDraft={held} />
              </F>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <F label="Currency" hint={held ? "Fixed" : undefined} error={err("currency")}>
                  <div className="relative">
                    <select
                      value={f.currency}
                      disabled={ro || held || currencies.length <= 1}
                      onChange={(e) => set("currency", e.target.value)}
                      className="h-10 w-full cursor-pointer appearance-none rounded-[12px] border border-line bg-surface-2 px-3 text-[13.5px] text-fg outline-none focus:border-ember/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {(currencies.includes(f.currency) ? currencies : [f.currency, ...currencies]).map((c) => (
                        <option key={c} value={c} className="bg-surface text-fg">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </F>
                <F label="Term" error={err("termMonths")}>
                  <Txt value={f.termMonths} onChange={(v) => set("termMonths", v)} suffix="months" inputMode="numeric" disabled={ro} invalid={!!err("termMonths")} />
                </F>
                <F label="Sort order" hint="Lower first" error={err("sort")}>
                  <Txt value={f.sort} onChange={(v) => set("sort", v)} inputMode="numeric" disabled={ro} invalid={!!err("sort")} />
                </F>
              </div>
            </div>
          </Section>

          <Section title="Limits" hint="Checked when a client subscribes. Leave a limit empty for none.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <F label="Minimum" error={err("minAmount")}>
                <Txt value={f.minAmount} onChange={(v) => set("minAmount", v)} suffix={cur} inputMode="decimal" disabled={ro} invalid={!!err("minAmount")} />
              </F>
              <F label="Maximum per subscription" error={err("maxAmount")}>
                <Txt value={f.maxAmount} onChange={(v) => set("maxAmount", v)} suffix={cur} placeholder="No limit" inputMode="decimal" disabled={ro} invalid={!!err("maxAmount")} />
              </F>
              <F label="Maximum per client" hint="All open positions" error={err("perUserMax")}>
                <Txt value={f.perUserMax} onChange={(v) => set("perUserMax", v)} suffix={cur} placeholder="No limit" inputMode="decimal" disabled={ro} invalid={!!err("perUserMax")} />
              </F>
              <F label="Total capacity" hint="Every client together" error={err("capacity")}>
                <Txt value={f.capacity} onChange={(v) => set("capacity", v)} suffix={cur} placeholder="No limit" inputMode="decimal" disabled={ro} invalid={!!err("capacity")} />
              </F>
            </div>
            {plan && plan.capacity !== null && (
              <div className="mt-3">
                <Progress value={((plan.capacity - (plan.capacityLeft ?? 0)) / plan.capacity) * 100} tone={(plan.capacityLeft ?? 0) <= 0 ? "down" : "gold"} />
                <div className="mt-1 text-[11.5px] text-fg-3">
                  {amt(plan.capacityLeft ?? 0, plan.currency)} left of {amt(plan.capacity, plan.currency)} (active and pending principal counted)
                </div>
              </div>
            )}
          </Section>

          <Section title="Monthly rate ceiling" hint="The highest return staff can set for one month. Never shown to clients.">
            <F label="Ceiling" error={err("maxMonthlyRatePct")} className="sm:max-w-60">
              <Txt value={f.maxMonthlyRatePct} onChange={(v) => set("maxMonthlyRatePct", v)} suffix="% a month" placeholder="2.5" inputMode="decimal" disabled={ro} invalid={!!err("maxMonthlyRatePct")} />
            </F>
          </Section>

          <Section title="What clients read" hint="Shown in the Client Area and stored with every position as the accepted terms.">
            <div className="space-y-3">
              <F label="Description" hint={`${int(f.description.length)}/2,000`} error={err("description")}>
                <Area value={f.description} onChange={(v) => set("description", v)} max={2000} rows={3} placeholder="Lock USDT for the term and receive a monthly return set by the broker each month." disabled={ro} invalid={!!err("description")} />
              </F>
              <F label="Risk disclosure" hint={<span className={f.status === "active" && f.riskText.trim().length < 20 ? "text-down" : undefined}>{int(f.riskText.length)}/4,000{f.status === "active" ? " · required on sale" : ""}</span>} error={err("riskText")}>
                <Area
                  value={f.riskText}
                  onChange={(v) => set("riskText", v)}
                  max={4000}
                  rows={6}
                  placeholder="Returns are not guaranteed and may be zero. Funds stay locked until maturity; there is no early withdrawal. Past returns do not predict future returns."
                  disabled={ro}
                  invalid={!!err("riskText")}
                />
              </F>
            </div>
          </Section>

          {plan && (
            <Section title="History">
              <div className="space-y-1 text-[12px] text-fg-3">
                <div>
                  Created by <span className="text-fg-2">{plan.createdBy}</span> {when(plan.createdAt)}
                </div>
                <div>
                  Last changed by <span className="text-fg-2">{plan.updatedBy}</span> {when(plan.updatedAt)} · version {plan.version}
                </div>
              </div>
            </Section>
          )}
        </div>
      </Dialog>
      {act.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveStakingPlans() {
  const now = useNow();
  const perms = usePerms();
  const { data, error, loading, reload } = useApi<PlansDoc>(S("plans"));
  const [sel, setSel] = useUrlParam("plan");
  const plans = data?.plans ?? [];
  const isNew = sel === "new";
  const plan = sel && /^\d+$/.test(sel) ? (plans.find((p) => p.id === Number(sel)) ?? null) : null;

  const onSale = plans.filter((p) => p.status === "active").length;
  const principal = plans.reduce((a, p) => a + p.stats.activePrincipal + p.stats.pendingPrincipal, 0);
  const active = plans.reduce((a, p) => a + p.stats.activePositions, 0);
  const cur = data?.currencies[0] ?? "USDT";

  const cols: Column<Plan>[] = [
    {
      key: "n",
      header: "Plan",
      sort: (p) => p.name.toLowerCase(),
      csv: (p) => p.name,
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block max-w-56 truncate text-[13px] font-medium">{p.name}</span>
          <span className="block font-mono text-[11px] text-fg-3">
            #{p.id} · v{p.version} · {p.termMonths} mo
          </span>
        </span>
      ),
    },
    { key: "s", header: "Status", csv: (p) => p.status, cell: (p) => <StatusPill map={PLAN_STATUS} status={p.status} /> },
    {
      key: "l",
      header: "Limits",
      hideOn: "md",
      csv: (p) => `${p.minAmount}-${p.maxAmount ?? ""}`,
      cell: (p) => (
        <span className="k-num block whitespace-nowrap text-[12px] text-fg-2">
          {amtK(p.minAmount)} – {p.maxAmount === null ? "no max" : amtK(p.maxAmount)}
          <span className="block text-[10.5px] text-fg-3">{p.perUserMax === null ? "No per-client limit" : `${amtK(p.perUserMax)} per client`}</span>
        </span>
      ),
    },
    {
      key: "r",
      header: "Ceiling",
      align: "right",
      sort: (p) => p.maxMonthlyRatePct,
      csv: (p) => p.maxMonthlyRatePct,
      cell: (p) => (
        <span className="k-num whitespace-nowrap text-[12.5px]">
          {pct(p.maxMonthlyRatePct)}
          <span className="block text-[10.5px] text-fg-3">a month</span>
        </span>
      ),
    },
    {
      key: "p",
      header: "Principal",
      align: "right",
      sort: (p) => p.stats.activePrincipal,
      csv: (p) => p.stats.activePrincipal,
      cell: (p) => (
        <span className="block">
          <Amount value={p.stats.activePrincipal} currency={p.currency} className="text-[13px] font-medium" />
          <span className="block text-[10.5px] text-fg-3">{p.stats.pendingPrincipal > 0 ? `+ ${amtK(p.stats.pendingPrincipal)} pending` : `${int(p.stats.activePositions)} active`}</span>
        </span>
      ),
    },
    { key: "i", header: "Investors", align: "right", hideOn: "sm", sort: (p) => p.stats.investors, csv: (p) => p.stats.investors, cell: (p) => <span className="k-num">{int(p.stats.investors)}</span> },
    {
      key: "c",
      header: "Capacity",
      hideOn: "lg",
      csv: (p) => p.capacity ?? "",
      cell: (p) =>
        p.capacity === null ? (
          <span className="text-[12px] text-fg-3">Unlimited</span>
        ) : (
          <span className="block w-32">
            <Progress value={((p.capacity - (p.capacityLeft ?? 0)) / p.capacity) * 100} tone={(p.capacityLeft ?? 0) <= 0 ? "down" : "gold"} />
            <span className="k-num mt-1 block text-[10.5px] text-fg-3">{amtK(p.capacityLeft ?? 0)} left of {amtK(p.capacity)}</span>
          </span>
        ),
    },
    {
      key: "u",
      header: "Updated",
      align: "right",
      hideOn: "xl",
      sort: (p) => p.updatedAt,
      csv: (p) => p.updatedAt,
      cell: (p) => (
        <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={when(p.updatedAt)}>
          {ago(p.updatedAt, now)}
          <span className="block max-w-36 truncate">{p.updatedBy}</span>
        </span>
      ),
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Staking plans"
        subtitle="What clients can subscribe to: term, limits, capacity, the monthly rate ceiling and the risk disclosure."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="edit plans" />}
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <Button variant="ember" onClick={() => setSel("new")} disabled={!data}>
                <Plus /> New plan
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="On sale" value={data ? int(onSale) : "—"} sub={data ? `${int(plans.length)} plan${plans.length === 1 ? "" : "s"} in total` : undefined} tone={onSale ? "up" : undefined} />
        <MiniStat label="Open principal" value={data ? money(principal, cur) : "—"} sub="Active and awaiting payment" tone="gold" />
        <MiniStat label="Active positions" value={data ? int(active) : "—"} sub="Across every plan" />
        <MiniStat label="Paused or closed" value={data ? int(plans.filter((p) => p.status === "paused" || p.status === "closed").length) : "—"} sub="Positions run to maturity" />
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4 p-4 sm:p-6">
          {error && !data ? (
            <StakingError error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <DataTable
                columns={cols}
                rows={plans}
                pageSize={25}
                dense
                rowKey={(p) => String(p.id)}
                onRowClick={(p) => setSel(String(p.id))}
                search={(p) => `${p.name} ${p.id} ${p.status}`}
                searchPlaceholder="Plan name or id…"
                exportName="staking-plans"
                empty={
                  <EmptyNote
                    className="mt-3"
                    title="No staking plans yet"
                    text="Create a plan with its term, limits, rate ceiling and risk disclosure. It stays hidden from clients until you put it on sale."
                    action={
                      perms.write ? (
                        <Button variant="ember" size="sm" onClick={() => setSel("new")}>
                          <Plus /> New plan
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
            </div>
          )}
        </Card>
      </Reveal>

      <PlanEditor
        plan={plan}
        isNew={isNew && perms.write}
        currencies={data?.currencies ?? ["USDT"]}
        canWrite={perms.write}
        onClose={() => setSel(null)}
        onSaved={() => {
          reload();
          setSel(null);
        }}
      />
    </div>
  );
}

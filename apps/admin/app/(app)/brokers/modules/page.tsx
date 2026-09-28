"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Boxes, Layers, Plus, RotateCcw, Save, Search, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  IconButton,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Toggle,
  Tooltip,
  cn,
  formatNumber,
} from "@kalks/ui";
import { BRK_MODULES, BRK_OVERRIDES, BRK_PLANS, BRK_TENANTS, brkTenant, type BrkModuleKey, type BrkOverride } from "@kalks/mock/admin-platform-brokers";
import { PEOPLE } from "@kalks/mock/people";
import { PlanChip, TenantLogo, timeAgo } from "@/components/brokers/kit";
import { MODULE_ICON } from "@/components/brokers/module-icons";

type PlanKey = "starter" | "growth" | "enterprise";
type Matrix = Record<BrkModuleKey, Record<PlanKey, boolean>>;
const initialMatrix = () => Object.fromEntries(BRK_MODULES.map((m) => [m.key, { ...m.plans }])) as Matrix;

export default function ModulesPage() {
  const [matrix, setMatrix] = React.useState<Matrix>(initialMatrix);
  const [prices, setPrices] = React.useState<Record<string, number>>(() => Object.fromEntries(BRK_MODULES.map((m) => [m.key, m.addOn])));
  const base = React.useMemo(initialMatrix, []);
  const dirty = BRK_MODULES.reduce((n, m) => n + (["starter", "growth", "enterprise"] as PlanKey[]).filter((p) => matrix[m.key][p] !== base[m.key][p]).length, 0) + BRK_MODULES.filter((m) => prices[m.key] !== m.addOn).length;
  const planCount = (p: PlanKey) => BRK_MODULES.filter((m) => matrix[m.key][p]).length;
  const tenantsOn = (p: PlanKey) => BRK_TENANTS.filter((t) => t.plan === p).length;
  const addOnMrr = BRK_OVERRIDES.filter((o) => o.state === "on").reduce((s, o) => s + o.price, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Modules & plans"
        subtitle="What each plan includes, add-on pricing, and per-tenant overrides"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Plan comparison exported", { description: "plans-matrix-2026-09.pdf" })}>
              Export matrix
            </Button>
            <Button variant="ember" onClick={() => toast.message("New module", { description: "Modules are registered by engineering via the module registry — request sent to #platform." })}>
              <Plus /> Register module
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Modules" icon={<Boxes />} value={<span className="k-num">{BRK_MODULES.length}</span>} chip={`${BRK_MODULES.filter((m) => m.core).length} core · ${BRK_MODULES.filter((m) => !m.core).length} optional`} delay={0} />
        <KpiCard label="Plans" icon={<Layers />} value={<span className="k-num">3</span>} footer={<div className="flex gap-1.5">{BRK_PLANS.map((p) => <PlanChip key={p.key} plan={p.key} size="sm" />)}</div>} delay={0.05} />
        <KpiCard label="Add-on MRR" icon={<Wand2 />} hot illustration="package" value={<Money value={addOnMrr} decimals={0} />} chip={`${BRK_OVERRIDES.filter((o) => o.state === "on").length} paid add-ons`} chipTone="gold" delay={0.1} />
        <KpiCard label="Tenant overrides" icon={<SlidersHorizontal />} value={<span className="k-num">{BRK_OVERRIDES.length}</span>} chip={`${new Set(BRK_OVERRIDES.map((o) => o.tenantId)).size} tenants customised`} delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="Plan × module matrix"
            subtitle="Toggle what each plan includes. Modules outside a plan can be sold as add-ons."
            action={
              <AnimatePresence>
                {dirty > 0 && (
                  <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <Chip tone="warn" dot>
                      {dirty} unsaved
                    </Chip>
                    <Button size="sm" variant="ghost" onClick={() => { setMatrix(initialMatrix()); setPrices(Object.fromEntries(BRK_MODULES.map((m) => [m.key, m.addOn]))); toast.message("Changes discarded"); }}>
                      <RotateCcw /> Discard
                    </Button>
                    <Button size="sm" variant="ember" onClick={() => toast.success("Plan matrix published", { description: `${dirty} changes · applies to ${BRK_TENANTS.length - 1} tenants at next billing cycle` })}>
                      <Save /> Publish
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            }
          />
          <div className="mt-2 overflow-x-auto px-4 pb-6 pt-3 sm:px-6">
            <div className="min-w-[860px]">
              {/* plan headers */}
              <div className="grid grid-cols-[minmax(280px,1fr)_130px_repeat(3,150px)] items-end gap-3 px-[17px]">
                <div className="k-label pb-3">Module</div>
                <div className="k-label pb-3 text-right">Add-on / mo</div>
                {BRK_PLANS.map((p) => (
                  <div key={p.key} className={cn("relative rounded-t-[16px] border border-b-0 border-line px-4 pb-3 pt-4 text-center", p.key === "enterprise" ? "bg-[linear-gradient(180deg,rgba(233,185,73,.14),transparent)]" : p.key === "growth" ? "bg-[linear-gradient(180deg,rgba(56,189,248,.10),transparent)]" : "bg-surface-2/60")}>
                    {p.key === "growth" && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-info px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-bg">Most sold</span>}
                    <div className="text-[14px] font-medium">{p.name}</div>
                    <div className="k-num mt-1 text-lg font-semibold">
                      ${formatNumber(p.licence, 0)}
                      <span className="text-[11px] font-normal text-fg-3">/mo</span>
                    </div>
                    <div className="k-num mt-0.5 text-[11px] text-fg-3">
                      ${formatNumber(p.setupFee / 1000, 0)}K setup · {p.revShare}% rev
                    </div>
                    <div className="k-num mt-2 text-[11px] text-fg-2">
                      {planCount(p.key)} modules · {tenantsOn(p.key)} tenants
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-[16px] border border-line">
                {BRK_MODULES.map((m, i) => {
                  const Icon = MODULE_ICON[m.key];
                  return (
                    <div key={m.key} className={cn("grid grid-cols-[minmax(280px,1fr)_130px_repeat(3,150px)] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60", i > 0 && "border-t border-line")}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-fg-2">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-medium">{m.name}</span>
                            {m.core && <Chip size="sm">Core</Chip>}
                            <span className="k-num text-[11px] text-fg-3">{m.tenants} tenants</span>
                          </div>
                          <div className="truncate text-[12px] text-fg-3">{m.description}</div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        {m.core ? (
                          <span className="text-[12px] text-fg-3">Always on</span>
                        ) : (
                          <label className="flex h-8 w-[104px] items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] focus-within:border-ember/50">
                            <span className="text-fg-3">$</span>
                            <input className="k-num w-full min-w-0 bg-transparent text-right outline-none" value={formatNumber(prices[m.key] ?? 0, 0)} onChange={(e) => setPrices((p) => ({ ...p, [m.key]: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 }))} />
                          </label>
                        )}
                      </div>
                      {(["starter", "growth", "enterprise"] as PlanKey[]).map((p) => {
                        const changed = matrix[m.key][p] !== base[m.key][p];
                        return (
                          <div key={p} className="relative flex items-center justify-center gap-2">
                            {m.core ? (
                              <Chip size="sm" tone="up">Included</Chip>
                            ) : (
                              <>
                                <Toggle checked={matrix[m.key][p]} onChange={(v) => setMatrix((mx) => ({ ...mx, [m.key]: { ...mx[m.key], [p]: v } }))} label={`${m.name} in ${p}`} />
                                <span className={cn("w-14 text-left text-[11px]", matrix[m.key][p] ? "text-up" : "text-fg-3")}>{matrix[m.key][p] ? "Included" : "Add-on"}</span>
                              </>
                            )}
                            {changed && <span className="absolute right-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-warn" />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <TenantOverrides />
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type OState = "default" | "on" | "off";

function TenantOverrides() {
  const tenants = BRK_TENANTS.filter((t) => t.plan !== "owner");
  const [tid, setTid] = React.useState("tnt_004");
  const [q, setQ] = React.useState("");
  const [ov, setOv] = React.useState<BrkOverride[]>(BRK_OVERRIDES);
  const t = brkTenant(tid);
  const plan = t.plan as PlanKey;
  const stateOf = (k: BrkModuleKey): OState => ov.find((o) => o.tenantId === tid && o.module === k)?.state ?? "default";
  const setState = (k: BrkModuleKey, s: OState) => {
    setOv((xs) => {
      const rest = xs.filter((o) => !(o.tenantId === tid && o.module === k));
      if (s === "default") return rest;
      const m = BRK_MODULES.find((x) => x.key === k)!;
      return [{ tenantId: tid, module: k, state: s, reason: s === "on" ? "Paid add-on" : "Disabled by platform owner", by: PEOPLE[4]!, at: "2026-09-24T09:00:00Z", price: s === "on" && !m.plans[plan] ? m.addOn : 0 }, ...rest];
    });
    const m = BRK_MODULES.find((x) => x.key === k)!;
    toast.success(`${m.name} · ${s === "default" ? "reset to plan default" : s === "on" ? "forced on" : "forced off"}`, { description: `${t.name}${s === "on" && !m.plans[plan] ? ` · +$${formatNumber(m.addOn, 0)}/mo added to next invoice` : ""}` });
  };
  const list = tenants.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
  const tOverrides = ov.filter((o) => o.tenantId === tid);

  return (
    <Card>
      <CardHeader title="Per-tenant overrides" subtitle="Force a module on (add-on) or off (regulatory, commercial) regardless of plan" />
      <div className="mt-4 grid grid-cols-1 gap-5 px-4 pb-6 sm:px-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
            <Search className="size-3.5 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find tenant…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
          </div>
          <div className="space-y-1.5">
            {list.map((x) => {
              const n = ov.filter((o) => o.tenantId === x.id).length;
              return (
                <button key={x.id} type="button" onClick={() => setTid(x.id)} className={cn("flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors", x.id === tid ? "border-ember/35 bg-ember-soft" : "border-transparent hover:bg-surface-2")}>
                  <TenantLogo color={x.color} mark={x.mark} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{x.name}</span>
                    <span className="block text-[11.5px] capitalize text-fg-3">{x.plan}</span>
                  </span>
                  {n > 0 && <Chip size="sm" tone="ember">{n}</Chip>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] border border-line p-4" style={{ background: `linear-gradient(110deg, ${t.color}1f, transparent 55%)` }}>
            <TenantLogo color={t.color} mark={t.mark} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{t.name}</div>
              <div className="font-mono text-[12px] text-fg-3">{t.domain}</div>
            </div>
            <PlanChip plan={t.plan} />
            <Chip tone={tOverrides.length ? "ember" : "neutral"}>{tOverrides.length} overrides</Chip>
            <Button size="sm" variant="ghost" onClick={() => { setOv((xs) => xs.filter((o) => o.tenantId !== tid)); toast.success(`${t.name} reset to ${plan} defaults`); }}>
              <RotateCcw /> Reset all
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            {BRK_MODULES.filter((m) => !m.core).map((m) => {
              const Icon = MODULE_ICON[m.key];
              const s = stateOf(m.key);
              const effective = s === "default" ? m.plans[plan] : s === "on";
              const o = tOverrides.find((x) => x.module === m.key);
              return (
                <div key={m.key} className={cn("k-row flex items-center gap-3 px-3.5 py-3", s !== "default" && "border-ember/30")}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", effective ? "border-up/30 bg-up-soft text-up" : "border-line bg-surface-3 text-fg-3")}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <span className="truncate">{m.name}</span>
                      <span className={cn("text-[11px] font-normal", effective ? "text-up" : "text-fg-3")}>{effective ? "on" : "off"}</span>
                    </div>
                    <div className="truncate text-[11.5px] text-fg-3">
                      {o ? o.reason : m.plans[plan] ? `Included in ${plan}` : `Add-on · $${formatNumber(m.addOn, 0)}/mo`}
                    </div>
                  </div>
                  <Segmented
                    size="xs"
                    value={s}
                    onChange={(v) => setState(m.key, v)}
                    options={[
                      { value: "default", label: "Plan" },
                      { value: "on", label: "On" },
                      { value: "off", label: "Off" },
                    ]}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="k-label mb-2.5">All active overrides · {ov.length}</div>
            <div className="overflow-x-auto rounded-[14px] border border-line">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.05em] text-fg-3">
                    <th className="px-4 py-2.5 font-medium">Tenant</th>
                    <th className="px-4 py-2.5 font-medium">Module</th>
                    <th className="px-4 py-2.5 font-medium">State</th>
                    <th className="px-4 py-2.5 font-medium">Reason</th>
                    <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    <th className="px-4 py-2.5 font-medium">By</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {ov.map((o) => {
                    const ot = brkTenant(o.tenantId);
                    return (
                      <tr key={o.tenantId + o.module} className="border-t border-line hover:bg-surface-2/60">
                        <td className="px-4 py-2.5">
                          <button className="flex items-center gap-2" onClick={() => setTid(o.tenantId)}>
                            <TenantLogo color={ot.color} mark={ot.mark} size={22} /> {ot.name}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">{BRK_MODULES.find((m) => m.key === o.module)!.name}</td>
                        <td className="px-4 py-2.5">
                          <Chip size="sm" tone={o.state === "on" ? "up" : "down"}>
                            Forced {o.state}
                          </Chip>
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-fg-2">{o.reason}</td>
                        <td className="k-num px-4 py-2.5 text-right">{o.price ? `$${formatNumber(o.price, 0)}` : <span className="text-fg-3">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2 text-fg-3">
                            <Avatar src={o.by.photo} name={o.by.name} size={20} /> {timeAgo(o.at)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <Tooltip content="Remove override">
                            <IconButton size="sm" aria-label="Remove override" onClick={() => { setOv((xs) => xs.filter((x) => x !== o)); toast.success("Override removed", { description: `${ot.name} · back to plan default` }); }}>
                              <Trash2 />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

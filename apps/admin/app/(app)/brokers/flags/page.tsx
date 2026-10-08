"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveFlags } from "@/components/owner/platform";

import * as React from "react";
import { Activity, ChevronDown, FlaskConical, Flag as FlagIcon, History, Plus, Rocket, Search, ShieldAlert, Timer } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, Segmented, Toggle, Tooltip, type ChipTone, cn } from "@ezymex/ui";
import { FLG_ENVS, FLG_EVENTS, FLG_FLAGS, FLG_TENANTS, type FlgEnv, type FlgFlag } from "@ezymex/mock/admin-flags";
import { RangeSlider, TenantLogo, TenantMini, timeAgo } from "@/components/brokers/kit";
import { NewFlagDialog } from "@/components/brokers/new-flag-dialog";

const TYPE_META: Record<FlgFlag["type"], { tone: ChipTone; label: string; icon: React.ReactNode }> = {
  release: { tone: "info", label: "Release", icon: <Rocket className="size-3" /> },
  experiment: { tone: "gold", label: "Experiment", icon: <FlaskConical className="size-3" /> },
  ops: { tone: "ember", label: "Ops", icon: <ShieldAlert className="size-3" /> },
};
const fmtEvals = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v));
type Filter = "all" | FlgFlag["type"] | "stale";

function statusOf(f: FlgFlag): { tone: ChipTone; label: string } {
  if (!f.enabled) return { tone: "neutral", label: "Off" };
  const vals = FLG_TENANTS.filter((t) => t.status !== "suspended").map((t) => f.tenants[t.id] ?? 0);
  if (vals.every((v) => v === 100)) return { tone: "up", label: "On · 100%" };
  if (vals.every((v) => v === 0)) return { tone: "warn", label: "On · no tenants" };
  return { tone: "ember", label: "Partial rollout" };
}

function FlagsPage() {
  const [flags, setFlags] = React.useState<FlgFlag[]>(FLG_FLAGS);
  const [expanded, setExpanded] = React.useState<string | null>(FLG_FLAGS[0]!.key);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const upd = (key: string, fn: (f: FlgFlag) => FlgFlag) => setFlags((fs) => fs.map((f) => (f.key === key ? { ...fn(f), changedAt: "2026-09-24T09:00:00Z" } : f)));

  const setEnabled = (f: FlgFlag, v: boolean) => {
    if (f.key === "ops.withdrawals_kill_switch" && v) toast.warning("Kill switch armed", { description: "All outgoing withdrawals are now paused platform-wide." });
    else toast.success(`${f.key} ${v ? "enabled" : "disabled"} in production`);
    upd(f.key, (x) => ({ ...x, enabled: v, envs: { ...x.envs, prod: v } }));
  };
  const setEnv = (f: FlgFlag, e: FlgEnv, v: boolean) => {
    upd(f.key, (x) => ({ ...x, envs: { ...x.envs, [e]: v }, enabled: e === "prod" ? v : x.enabled }));
    toast.success(`${f.key} · ${FLG_ENVS.find((x) => x.key === e)!.label} ${v ? "on" : "off"}`);
  };
  const setDefault = (f: FlgFlag, v: number) =>
    upd(f.key, (x) => ({ ...x, rollout: v, tenants: Object.fromEntries(Object.entries(x.tenants).map(([t, r]) => [t, r === x.rollout ? v : r])) }));
  const setTenant = (f: FlgFlag, tid: string, v: number) => upd(f.key, (x) => ({ ...x, tenants: { ...x.tenants, [tid]: v } }));

  const list = flags.filter((f) => {
    if (filter === "stale" ? !f.stale : filter !== "all" && f.type !== filter) return false;
    if (q && !`${f.key} ${f.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const prodOn = flags.filter((f) => f.enabled).length;
  const experiments = flags.filter((f) => f.type === "experiment" && f.enabled).length;
  const stale = flags.filter((f) => f.stale).length;
  const evals = flags.reduce((s, f) => s + f.evaluations24h, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Feature flags"
        subtitle="Ship safely across every white-label tenant: per-environment switches, per-tenant rollout percentages and emergency kill switches."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Flag audit log", { description: `${FLG_EVENTS.length} changes in the last 7 days · all signed with staff ID` })}>
              <History /> Audit log
            </Button>
            <Button variant="ember" shimmer onClick={() => setOpen(true)}>
              <Plus /> New flag
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Flags" icon={<FlagIcon />} value={<span className="k-num">{flags.length}</span>} chip={`${prodOn} on in production`} chipTone="up" />
        <KpiCard label="Experiments live" icon={<FlaskConical />} value={<span className="k-num">{experiments}</span>} chip="A/B split by client ID hash" chipTone="gold" delay={0.05} />
        <KpiCard label="Evaluations · 24h" icon={<Activity />} value={<span className="k-num">{fmtEvals(evals)}</span>} chip="p99 0.4 ms · edge cached" delay={0.1} />
        <KpiCard label="Stale flags" icon={<Timer />} value={<span className="k-num">{stale}</span>} hot illustration="hourglass_not_done" footer={<Chip tone="warn">100% for 90+ days · clean up</Chip>} delay={0.15} />
      </div>

      {/* ---------------- Flags ---------------- */}
      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-medium tracking-tight">Flags</h2>
          <p className="text-[13px] text-fg-3">Expand a flag to set rollout per tenant</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
            <Search className="size-3.5 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flags…" className="w-40 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
          </div>
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: <>All <span className="text-fg-3">{flags.length}</span></> },
              { value: "release", label: "Release" },
              { value: "experiment", label: "Experiment" },
              { value: "ops", label: "Ops" },
              { value: "stale", label: "Stale" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-2.5">
        {list.map((f, i) => {
          const st = statusOf(f);
          const isOpen = expanded === f.key;
          const tenantsOn = Object.values(f.tenants).filter((v) => v > 0).length;
          return (
            <Reveal key={f.key} delay={Math.min(i * 0.03, 0.2)}>
              <div className={cn("k-card overflow-hidden transition-[border-color]", isOpen && "border-[var(--k-border-top)]")}>
                <div className="grid grid-cols-1 items-center gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_auto_minmax(200px,0.9fr)_auto]">
                  <div className="flex min-w-0 items-start gap-3">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : f.key)} className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-3 hover:text-fg" aria-label="Toggle tenant rollout">
                      <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[13.5px] font-semibold">{f.key}</span>
                        <Chip size="sm" tone={TYPE_META[f.type].tone}>
                          {TYPE_META[f.type].icon}
                          {TYPE_META[f.type].label}
                        </Chip>
                        {f.stale && (
                          <Chip size="sm" tone="warn">
                            Stale
                          </Chip>
                        )}
                        <Chip size="sm" tone={st.tone} dot>
                          {st.label}
                        </Chip>
                      </div>
                      <p className="mt-1 truncate text-[12.5px] text-fg-3">{f.description}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-fg-3">
                        <Avatar src={f.owner.photo} name={f.owner.name} size={18} />
                        {f.owner.name.split(" ")[0]} · {timeAgo(f.changedAt)} · <span className="k-num">{fmtEvals(f.evaluations24h)}</span> evals/24h · {tenantsOn}/{FLG_TENANTS.length} tenants
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {FLG_ENVS.map((e) => (
                      <Tooltip key={e.key} content={`${e.label}: ${f.envs[e.key] ? "on" : "off"}`}>
                        <button
                          type="button"
                          onClick={() => setEnv(f, e.key, !f.envs[e.key])}
                          className={cn(
                            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium uppercase tracking-wide",
                            f.envs[e.key] ? (e.key === "prod" ? "border-up/35 bg-up-soft text-up" : "border-line bg-surface-3 text-fg") : "border-dashed border-line text-fg-3",
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", f.envs[e.key] ? "bg-current" : "bg-fg-3/50")} />
                          {e.key}
                        </button>
                      </Tooltip>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1.5 flex justify-between text-[11.5px]">
                      <span className="text-fg-3">Default rollout</span>
                      <span className="k-num text-fg">{f.rollout}%</span>
                    </div>
                    <RangeSlider value={f.rollout} onChange={(v) => setDefault(f, v)} disabled={!f.enabled} />
                  </div>

                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="text-[11.5px] text-fg-3">Prod</span>
                    <Toggle checked={f.enabled} onChange={(v) => setEnabled(f, v)} label={`${f.key} production`} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-line bg-black/15 px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="k-label">Per-tenant rollout</span>
                      <div className="flex gap-1.5">
                        <Button size="xs" variant="surface" onClick={() => (upd(f.key, (x) => ({ ...x, tenants: Object.fromEntries(Object.keys(x.tenants).map((t) => [t, 100])) })), toast.success(`${f.key} → 100% on all tenants`))}>
                          All 100%
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => (upd(f.key, (x) => ({ ...x, tenants: Object.fromEntries(Object.keys(x.tenants).map((t) => [t, x.rollout])) })), toast.success("Tenant overrides reset to default"))}>
                          Reset to default
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {FLG_TENANTS.map((t) => {
                        const v = f.tenants[t.id] ?? 0;
                        const custom = v !== f.rollout;
                        return (
                          <div key={t.id} className={cn("k-row px-3.5 py-2.5", !f.enabled && "opacity-50")}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <TenantMini id={t.id} />
                              <span className="flex items-center gap-1.5">
                                {custom && (
                                  <Chip size="sm" tone="gold">
                                    Override
                                  </Chip>
                                )}
                                <span className={cn("k-num w-10 text-right text-[12.5px] font-medium", v === 0 ? "text-fg-3" : v === 100 ? "text-up" : "text-ember")}>{v}%</span>
                              </span>
                            </div>
                            <RangeSlider value={v} onChange={(x) => setTenant(f, t.id, x)} disabled={!f.enabled || t.status === "suspended"} />
                            {t.status === "suspended" && <div className="mt-1 text-[10.5px] text-down">Tenant suspended</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
        {list.length === 0 && <Card className="py-14 text-center text-sm text-fg-3">No flags match.</Card>}
      </div>

      {/* ---------------- Matrix ---------------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 2xl:col-span-9">
          <Card>
            <CardHeader title="Tenants × flags" subtitle="Click a cell to switch a flag on (100%) or off for one tenant · partial rollouts show their %" />
            <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[12px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-[190px] bg-surface pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-fg-3">Tenant</th>
                    {flags.map((f) => (
                      <th key={f.key} className="h-[120px] w-[64px] px-1 pb-2 align-bottom">
                        <Tooltip content={f.key}>
                          <span className="mx-auto block w-4 cursor-default whitespace-nowrap font-mono text-[11px] font-normal text-fg-2 [writing-mode:vertical-rl] rotate-180">{f.key.split(".")[1]}</span>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FLG_TENANTS.map((t) => (
                    <tr key={t.id}>
                      <td className="sticky left-0 z-10 border-t border-line bg-surface py-1.5 pr-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <TenantLogo color={t.color} mark={t.mark} size={24} />
                          <span className="truncate text-[12.5px]">{t.name}</span>
                        </span>
                      </td>
                      {flags.map((f) => {
                        const v = f.tenants[t.id] ?? 0;
                        const on = f.enabled && v > 0;
                        const partial = on && v < 100;
                        return (
                          <td key={f.key} className="border-t border-line px-1 py-1.5 text-center">
                            <button
                              type="button"
                              disabled={!f.enabled}
                              onClick={() => {
                                setTenant(f, t.id, v > 0 ? 0 : 100);
                                toast.success(`${f.key.split(".")[1]} ${v > 0 ? "off" : "on"} for ${t.name}`);
                              }}
                              className={cn(
                                "k-num mx-auto grid h-7 w-12 place-items-center rounded-[8px] border text-[10.5px] font-medium transition-all disabled:cursor-not-allowed",
                                !f.enabled ? "border-dashed border-line text-fg-3/60" : partial ? "border-ember/40 bg-ember-soft text-ember" : on ? "border-up/35 bg-up-soft text-up hover:brightness-125" : "border-line bg-surface-2 text-fg-3 hover:text-fg",
                              )}
                              aria-label={`${f.key} for ${t.name}`}
                            >
                              {!f.enabled ? "—" : partial ? `${v}%` : on ? "ON" : "OFF"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-up" /> On
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-ember" /> Partial %
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-surface-3" /> Off for tenant
                </span>
                <span className="flex items-center gap-1.5">— Off in production</span>
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="2xl:col-span-3">
          <Card className="h-full">
            <CardHeader title="Recent changes" subtitle="Last 7 days" icon={<History />} />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {FLG_EVENTS.map((e) => (
                <div key={e.flag + e.at} className="flex gap-3">
                  <Avatar src={e.by.photo} name={e.by.name} size={30} />
                  <div className="min-w-0 flex-1 border-b border-line pb-2">
                    <div className="truncate font-mono text-[11.5px] text-fg">{e.flag}</div>
                    <div className={cn("text-[12.5px]", e.tone === "up" ? "text-up" : e.tone === "down" ? "text-down" : e.tone === "gold" ? "text-gold" : "text-ember")}>{e.action}</div>
                    <div className="text-[11px] text-fg-3">
                      {e.by.name} · {timeAgo(e.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <NewFlagDialog open={open} onOpenChange={setOpen} onCreate={(f) => setFlags((fs) => [f, ...fs])} />
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <FlagsPage /> : <LiveFlags />;
}

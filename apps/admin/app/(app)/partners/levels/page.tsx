"use client";

import * as React from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Pencil, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Icon3D, PageHeader, Reveal, Segmented, SpotlightCard, Toggle, cn } from "@kalks/ui";
import { LEVELS, PARTNERS, type LevelKey, type PartnerLevel } from "@kalks/mock/admin-partners";
import { NumInput, Select, SettingRow, auditToast, useReason } from "@/components/config/kit";
import { LEVEL_COLOR, LevelChip, fmtInt } from "@/components/partners/common";
import { LevelEditDialog } from "@/components/partners/level-dialog";

function LevelCard({ l, idx, total, onEdit }: { l: PartnerLevel; idx: number; total: number; onEdit: () => void }) {
  const top = l.key === "diamond";
  const rows: [string, string][] = [
    ["Active clients", l.criteria.activeClients ? `≥ ${fmtInt(l.criteria.activeClients)}` : "—"],
    ["Monthly lots", l.criteria.monthlyLots ? `≥ ${fmtInt(l.criteria.monthlyLots)}` : "—"],
    ["Net deposits", l.criteria.minNetDeposits ? `≥ $${fmtInt(l.criteria.minNetDeposits)}` : "—"],
    ["Window", `${l.criteria.windowDays} days`],
  ];
  const perks: [string, React.ReactNode][] = [
    ["Rate multiplier", <span key="m" className="k-num font-semibold" style={{ color: LEVEL_COLOR[l.key] }}>×{l.benefits.rateMultiplier.toFixed(2)}</span>],
    ["Payouts", l.benefits.payoutFrequency],
    ["Dedicated manager", l.benefits.dedicatedManager ? <Check key="c" className="ml-auto size-4 text-up" /> : <X key="x" className="ml-auto size-4 text-fg-3" />],
    ["Marketing budget", l.benefits.marketingBudget ? `$${fmtInt(l.benefits.marketingBudget)}/mo` : "—"],
    ["Custom landing", l.benefits.customLanding ? <Check key="c" className="ml-auto size-4 text-up" /> : <X key="x" className="ml-auto size-4 text-fg-3" />],
  ];
  return (
    <SpotlightCard hot={top} className="relative flex h-full flex-col">
      <div className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${LEVEL_COLOR[l.key]}, transparent)` }} />
      <div className="flex items-start justify-between px-5 pt-5">
        <div>
          <div className="k-label">Level {idx + 1}</div>
          <div className="mt-1 text-[22px] font-medium tracking-tight" style={{ color: top || l.key === "gold" ? LEVEL_COLOR[l.key] : undefined }}>{l.name}</div>
          <div className="mt-1 text-[12.5px] text-fg-3">
            <span className="k-num font-medium text-fg">{fmtInt(l.partners)}</span> partners · {((l.partners / total) * 100).toFixed(1)}%
          </div>
        </div>
        <Icon3D name={l.icon} size={64} />
      </div>
      <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, (l.partners / LEVELS[0]!.partners) * 100)}%`, background: LEVEL_COLOR[l.key] }} />
      </div>
      <div className="px-5 pt-4">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Criteria</div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1 text-[12.5px]">
            <span className="text-fg-3">{k}</span>
            <span className="k-num text-fg">{v}</span>
          </div>
        ))}
      </div>
      <div className="mx-5 my-3 h-px bg-line" />
      <div className="flex-1 px-5">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Benefits</div>
        {perks.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1 text-[12.5px]">
            <span className="text-fg-3">{k}</span>
            <span className="k-num text-fg">{v}</span>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5 pt-4">
        <Button size="sm" variant={top ? "ember" : "surface"} className="w-full" onClick={onEdit}>
          <Pencil /> Edit level
        </Button>
      </div>
    </SpotlightCard>
  );
}

function RulesCard() {
  const [auto, setAuto] = React.useState(true);
  const [demote, setDemote] = React.useState(true);
  const [sched, setSched] = React.useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [grace, setGrace] = React.useState(7);
  const [misses, setMisses] = React.useState(2);
  const [maxDrop, setMaxDrop] = React.useState<"1" | "2" | "any">("1");
  const [notify, setNotify] = React.useState(true);
  const [lock, setLock] = React.useState(90);
  return (
    <Card className="h-full">
      <CardHeader
        title="Auto-promotion & demotion"
        subtitle="Evaluation engine for partner levels"
        action={
          <Button size="sm" variant="ember" onClick={() => auditToast("Level rules saved", `${sched} evaluation · ${grace}d grace · demote after ${misses} misses`)}>
            Save rules
          </Button>
        }
      />
      <div className="divide-y divide-line px-4 pb-4 pt-2 sm:px-6">
        <SettingRow label="Auto-promote" hint="Promote as soon as all criteria are met at evaluation"><Toggle checked={auto} onChange={setAuto} label="Auto-promote" /></SettingRow>
        <SettingRow label="Auto-demote" hint="Demote after consecutive missed windows"><Toggle checked={demote} onChange={setDemote} label="Auto-demote" /></SettingRow>
        <SettingRow label="Evaluation schedule">
          <Segmented size="xs" value={sched} onChange={setSched} options={[{ value: "monthly", label: "Monthly" }, { value: "biweekly", label: "Bi-weekly" }, { value: "weekly", label: "Weekly" }]} />
        </SettingRow>
        <SettingRow label="Missed windows before demotion"><NumInput size="sm" className="w-28" value={misses} onChange={setMisses} min={1} max={6} stepper /></SettingRow>
        <SettingRow label="Demotion grace period" hint="Partner is warned and keeps benefits meanwhile"><NumInput size="sm" className="w-28" value={grace} onChange={setGrace} min={0} max={60} suffix="days" /></SettingRow>
        <SettingRow label="Max levels dropped per run"><Select size="sm" className="w-28" value={maxDrop} onChange={setMaxDrop} options={[{ value: "1", label: "1 level" }, { value: "2", label: "2 levels" }, { value: "any", label: "Any" }]} /></SettingRow>
        <SettingRow label="Manual override lock" hint="Skip auto-evaluation after a manual change"><NumInput size="sm" className="w-28" value={lock} onChange={setLock} min={0} max={365} suffix="days" /></SettingRow>
        <SettingRow label="Notify partner" hint="Email + portal notification on level change"><Toggle checked={notify} onChange={setNotify} label="Notify" /></SettingRow>
      </div>
    </Card>
  );
}

type Change = { id: string; name: string; photo?: string; from: LevelKey; to: LevelKey; why: string; state: "queued" | "held" | "applied" };

function UpcomingCard() {
  const reason = useReason();
  const [items, setItems] = React.useState<Change[]>(() => {
    const order = LEVELS.map((l) => l.key);
    return PARTNERS.filter((_, i) => i % 4 === 2).slice(0, 8).map((p, i) => {
      const k = order.indexOf(p.level);
      const up = i % 3 !== 2 && k < order.length - 1;
      const to = up ? order[k + 1]! : order[Math.max(0, k - 1)]!;
      return { id: p.id, name: p.name, photo: p.photo, from: p.level, to: to === p.level ? order[k + 1]! : to, why: up ? `Met ${LEVELS[k + 1]!.name} criteria 2 windows running` : "Lots below threshold 2 consecutive windows", state: "queued" };
    });
  });
  const [filter, setFilter] = React.useState<"all" | "up" | "down">("all");
  const order = LEVELS.map((l) => l.key);
  const isUp = (c: Change) => order.indexOf(c.to) > order.indexOf(c.from);
  const view = items.filter((c) => filter === "all" || (filter === "up") === isUp(c));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Next evaluation · 01 Oct"
        subtitle={`${items.filter(isUp).length} promotions · ${items.filter((c) => !isUp(c)).length} demotions queued`}
        action={
          <>
            <Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "up", label: "Up" }, { value: "down", label: "Down" }]} />
            <Button
              size="sm"
              variant="surface"
              onClick={() =>
                reason.ask({
                  title: "Run evaluation now",
                  description: "Applies all queued (non-held) level changes immediately instead of on 01 Oct.",
                  reasons: ["Month-end close brought forward", "Campaign launch", "Correction run"],
                  confirmLabel: "Run now",
                  onConfirm: (r) => {
                    setItems((xs) => xs.map((x) => (x.state === "queued" ? { ...x, state: "applied" } : x)));
                    auditToast("Level evaluation executed", r);
                  },
                })
              }
            >
              <Play /> Run now
            </Button>
          </>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {view.map((c) => (
          <div key={c.id} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", c.state !== "queued" && "opacity-60")}>
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", isUp(c) ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{isUp(c) ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}</span>
            <Avatar src={c.photo} name={c.name} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{c.name}</div>
              <div className="truncate text-[11.5px] text-fg-3">{c.why}</div>
            </div>
            <span className="hidden items-center gap-1.5 sm:flex">
              <LevelChip level={c.from} />
              <ArrowRight className="size-3 text-fg-3" />
              <LevelChip level={c.to} />
            </span>
            {c.state === "queued" ? (
              <Button size="xs" variant="ghost" onClick={() => { setItems((xs) => xs.map((x) => (x.id === c.id ? { ...x, state: "held" } : x))); toast.success(`${c.name} held at ${LEVELS.find((l) => l.key === c.from)!.name}`, { description: "Excluded from the 01 Oct run" }); }}>
                Hold
              </Button>
            ) : (
              <Chip size="sm" tone={c.state === "applied" ? "up" : "warn"}>{c.state === "applied" ? "Applied" : "Held"}</Chip>
            )}
          </div>
        ))}
      </div>
      {reason.node}
    </Card>
  );
}

export default function LevelsPage() {
  const [levels, setLevels] = React.useState(LEVELS);
  const [edit, setEdit] = React.useState<PartnerLevel | null>(null);
  const total = levels.reduce((s, l) => s + l.partners, 0);
  return (
    <div className="pb-16">
      <PageHeader
        title="Partner levels"
        subtitle="Bronze → Diamond ladder based on active clients and monthly lots"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Level simulation ready", { description: "Raising Gold to 700 lots would demote 14 partners" })}>
              Simulate thresholds
            </Button>
            <Button variant="ember" onClick={() => setEdit(levels[2]!)}>
              <Pencil /> Edit levels
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {levels.map((l, i) => (
          <Reveal key={l.key} delay={i * 0.05}>
            <LevelCard l={l} idx={i} total={total} onEdit={() => setEdit(l)} />
          </Reveal>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-5">
          <RulesCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-7">
          <UpcomingCard />
        </Reveal>
      </div>
      <LevelEditDialog level={edit} open={!!edit} onOpenChange={(o) => !o && setEdit(null)} onSave={(l) => setLevels((ls) => ls.map((x) => (x.key === l.key ? l : x)))} />
    </div>
  );
}

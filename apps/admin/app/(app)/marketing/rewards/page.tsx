"use client";

import * as React from "react";
import { BookOpen, Check, Coins, Gift, Pencil, Plus, RotateCcw, Users, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Dialog,
  DialogClose,
  Field,
  Icon3D,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  StatusChip,
  Toggle,
  cn,
  type Column,
} from "@kalks/ui";
import { MKT_CATALOGUE, MKT_POINT_RULES, MKT_REDEMPTIONS, MKT_REWARDS_KPIS, MKT_TIERS, type MktRedemption, type MktRewardItem, type MktTier } from "@kalks/mock/admin-growth-marketing";
import { NumField, SectionLabel, fmtDateTime, fmtInt, fmtK } from "@/components/marketing/kit";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveRewards } from "@/components/marketing/live/rewards";

const ITEM = Object.fromEntries(MKT_CATALOGUE.map((c) => [c.id, c]));

function DemoRewardsPage() {
  const [addOpen, setAddOpen] = React.useState(false);
  const k = MKT_REWARDS_KPIS;
  return (
    <div className="pb-16">
      <PageHeader
        title="Rewards & loyalty"
        subtitle="Points rules, tiers and the redemption catalogue clients see under Contests & Rewards."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Points ledger", { description: "48.2M points issued · 21.9M redeemed in the last 30 days" })}>
              <BookOpen /> Points ledger
            </Button>
            <Button variant="ember" shimmer onClick={() => setAddOpen(true)}>
              <Plus /> Add reward
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Loyalty members" icon={<Users />} value={<span className="k-num">{fmtInt(k.members)}</span>} chip="+2,318 this month" chipTone="up" />
        <KpiCard label="Points issued · 30d" icon={<Coins />} value={<span className="k-num">{fmtK(k.pointsIssued30d)}</span>} chip="72% from trading" delay={0.05} />
        <KpiCard label="Points redeemed · 30d" icon={<Gift />} value={<span className="k-num">{fmtK(k.pointsRedeemed30d)}</span>} chip={`${((k.pointsRedeemed30d / k.pointsIssued30d) * 100).toFixed(1)}% burn rate`} chipTone="gold" delay={0.1} />
        <KpiCard label="Points liability" value={<Money value={k.liability} decimals={0} />} hot illustration="gem_stone" footer={<Chip tone="warn">1 pt ≈ $0.0085</Chip>} delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <RulesCard />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <TiersCard />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <CatalogueCard onAdd={() => setAddOpen(true)} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <RedemptionLog />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <TopRedeemed />
        </Reveal>
      </div>

      <AddRewardDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RulesCard() {
  const [rules, setRules] = React.useState(MKT_POINT_RULES);
  const dirty = rules.some((r, i) => r.points !== MKT_POINT_RULES[i]!.points || r.enabled !== MKT_POINT_RULES[i]!.enabled);
  const groups = ["Trading", "Funding", "Engagement"] as const;
  const upd = (id: string, patch: Partial<(typeof rules)[number]>) => setRules((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <Card className="h-full">
      <CardHeader
        title="Earning rules"
        subtitle="Points credited per action · tier multipliers apply on top"
        action={
          <>
            {dirty && (
              <Button size="sm" variant="ghost" onClick={() => setRules(MKT_POINT_RULES)}>
                <RotateCcw /> Reset
              </Button>
            )}
            <Button size="sm" variant={dirty ? "ember" : "surface"} onClick={() => toast.success(dirty ? "Earning rules saved" : "No changes to save", { description: dirty ? "Applies to activity from 00:00 GMT+3 tomorrow" : undefined })}>
              <Check /> Save
            </Button>
          </>
        }
      />
      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 px-4 pb-6 sm:px-6 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className={cn(g === "Trading" && "lg:row-span-2")}>
            <SectionLabel>{g === "Trading" ? "Trading · per lot by asset class" : g}</SectionLabel>
            <div className="space-y-1.5">
              {rules
                .filter((r) => r.group === g)
                .map((r) => (
                  <div key={r.id} className={cn("k-row flex items-center gap-3 px-3 py-2 transition-opacity", !r.enabled && "opacity-50")}>
                    <Icon3D name={r.icon} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{r.label}</div>
                      <div className="truncate text-[11px] text-fg-3"><span className="text-fg-2">{r.unit}</span> · {r.hint}</div>
                    </div>
                    <NumField value={r.points} onChange={(v) => upd(r.id, { points: v })} suffix="pts" className="h-8 w-[92px] rounded-[10px] px-2 text-[13px]" />
                    <Toggle checked={r.enabled} onChange={(v) => upd(r.id, { enabled: v })} label={r.label} />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function tierGradient(t: MktTier) {
  return { background: `radial-gradient(circle at 30% 25%, #ffffffcc, ${t.color} 45%, #00000080 110%)` };
}

function TiersCard() {
  const [tiers, setTiers] = React.useState(MKT_TIERS);
  const total = tiers.reduce((s, t) => s + t.members, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Tiers" subtitle="Lifetime points thresholds and multipliers" action={<Button size="sm" variant="surface" onClick={() => toast.success("Tier thresholds saved", { description: "Clients are re-tiered nightly at 00:30 GMT+3" })}>Save</Button>} />
      <div className="mt-5 px-6">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {tiers.map((t) => (
            <motion.div key={t.name} initial={{ width: 0 }} animate={{ width: `${Math.max(3, (t.members / total) * 100)}%` }} transition={{ duration: 0.8 }} style={{ background: t.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-fg-3">
          <span>Member distribution</span>
          <span className="k-num">{fmtInt(total)} members</span>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-2 px-4 pb-6 sm:px-6">
        {tiers.map((t, i) => (
          <div key={t.name} className="k-row px-3.5 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-black/70 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)]" style={tierGradient(t)}>
                {t.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  {t.name}
                  <Chip size="sm" tone="gold">{t.multiplier.toFixed(2)}x</Chip>
                </div>
                <div className="k-num text-[11.5px] text-fg-3">{fmtInt(t.members)} members · {((t.members / total) * 100).toFixed(1)}%</div>
              </div>
              <div className="w-[120px]">
                <NumField value={t.threshold} onChange={(v) => setTiers((x) => x.map((y, j) => (j === i ? { ...y, threshold: v } : y)))} suffix="pts" className="h-8 rounded-[10px] px-2 text-[13px]" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 pl-12">
              {t.perks.map((p) => (
                <span key={p} className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-fg-2">
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const CATS = ["All", "Cash", "Trading", "Education", "Gadgets", "Experiences"] as const;

function CatalogueCard({ onAdd }: { onAdd: () => void }) {
  const [cat, setCat] = React.useState<(typeof CATS)[number]>("All");
  const items = MKT_CATALOGUE.filter((c) => cat === "All" || c.category === cat);
  return (
    <Card>
      <CardHeader title="Rewards catalogue" subtitle={`${MKT_CATALOGUE.length} items · ${MKT_CATALOGUE.filter((c) => c.active).length} live in the Client Area`} action={<><Segmented size="xs" value={cat} onChange={setCat} options={CATS} /><Button size="sm" variant="surface" onClick={onAdd}><Plus /> Add</Button></>} />
      <div className="mt-5 grid grid-cols-2 gap-3 px-4 pb-6 sm:px-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((it, i) => (
          <motion.div key={it.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <RewardTile it={it} />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function RewardTile({ it }: { it: MktRewardItem }) {
  const [on, setOn] = React.useState(it.active);
  const left = it.stock === null ? null : it.stock - it.redemptions;
  return (
    <div className={cn("k-row group relative flex h-full flex-col overflow-hidden p-3.5 transition-all hover:border-[var(--k-border-top)]", !on && "opacity-60")}>
      <div className="flex items-start justify-between">
        <Chip size="sm" tone={it.tier === "Platinum" ? "solid" : it.tier === "Gold" ? "gold" : it.tier === "Silver" ? "neutral" : "ember"}>
          {it.tier}+
        </Chip>
        <Toggle checked={on} onChange={(v) => { setOn(v); toast.success(v ? `${it.name} is live` : `${it.name} hidden from catalogue`); }} label={it.name} />
      </div>
      <div className="relative mx-auto my-3 grid size-24 place-items-center">
        <Icon3D name={it.icon} size={72} />
      </div>
      <div className="line-clamp-2 min-h-[36px] text-[13.5px] font-medium leading-snug">{it.name}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="k-num text-[17px] font-semibold text-gold">{fmtInt(it.cost)}</span>
        <span className="text-[11px] text-fg-3">pts</span>
      </div>
      <div className="mt-2.5">
        <div className="mb-1 flex justify-between text-[11px] text-fg-3">
          <span className="k-num">{fmtInt(it.redemptions)} redeemed</span>
          <span className={cn("k-num", left !== null && left < 5 && "text-warn")}>{left === null ? "Unlimited" : `${left} left`}</span>
        </div>
        <Progress value={it.stock === null ? 100 : (it.redemptions / it.stock) * 100} tone={it.stock === null ? "gold" : left !== null && left < 5 ? "warn" : "ember"} className={cn(it.stock === null && "opacity-30")} />
      </div>
      <button type="button" onClick={() => toast.info(`Editing ${it.name}`, { description: `${fmtInt(it.cost)} pts · ${it.category}` })} className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-full border border-line bg-surface text-fg-3 opacity-0 transition-opacity hover:text-fg group-hover:opacity-100" aria-label="Edit reward">
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RedemptionLog() {
  const [rows, setRows] = React.useState(MKT_REDEMPTIONS);
  const act = (id: string, status: MktRedemption["status"]) => {
    setRows((x) => x.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success(status === "completed" ? `${id} approved` : `${id} rejected`, { description: status === "completed" ? "Reward fulfilment queued" : "Points refunded to client" });
  };
  const cols: Column<MktRedemption>[] = [
    {
      key: "client",
      header: "Client",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={r.person.photo} name={r.person.name} size={30} />
          <div>
            <div className="text-[13px] font-medium">{r.person.name}</div>
            <div className="font-mono text-[11px] text-fg-3">{r.login}</div>
          </div>
        </div>
      ),
      sort: (r) => r.person.name,
    },
    {
      key: "item",
      header: "Reward",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Icon3D name={ITEM[r.itemId]!.icon} size={24} />
          <span className="truncate text-[13px]">{ITEM[r.itemId]!.name}</span>
        </div>
      ),
    },
    { key: "pts", header: "Points", align: "right", cell: (r) => <span className="k-num font-medium text-gold">-{fmtInt(r.points)}</span>, sort: (r) => r.points },
    { key: "tier", header: "Tier", hideOn: "md", cell: (r) => <Chip size="sm">{r.tier}</Chip> },
    { key: "at", header: "Time", hideOn: "md", align: "right", cell: (r) => <span className="k-num text-[12px] text-fg-3">{fmtDateTime(r.at)}</span>, sort: (r) => r.at },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <div className="flex justify-end gap-1">
            <Button size="xs" variant="up-outline" onClick={(e) => { e.stopPropagation(); act(r.id, "completed"); }}>
              <Check /> Approve
            </Button>
            <Button size="xs" variant="down-outline" onClick={(e) => { e.stopPropagation(); act(r.id, "rejected"); }} aria-label="Reject">
              <X />
            </Button>
          </div>
        ) : (
          <StatusChip status={r.status} />
        ),
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Redemption log" subtitle="Physical items and cash require approval" action={<Chip tone="warn" dot>{rows.filter((r) => r.status === "pending").length} pending</Chip>} />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        <DataTable columns={cols} rows={rows} pageSize={7} dense rowKey={(r) => r.id} search={(r) => `${r.person.name} ${r.login} ${ITEM[r.itemId]!.name}`} exportName="redemptions" />
      </div>
    </Card>
  );
}

function TopRedeemed() {
  const top = [...MKT_CATALOGUE].sort((a, b) => b.redemptions * b.cost - a.redemptions * a.cost).slice(0, 8);
  const max = top[0]!.redemptions * top[0]!.cost;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Points burned by reward" subtitle="All-time" />
      <div className="mt-4 flex-1 space-y-3 px-4 pb-6 sm:px-6">
        {top.map((it, i) => {
          const v = it.redemptions * it.cost;
          return (
            <div key={it.id} className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
                <Icon3D name={it.icon} size={26} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-[12.5px]">
                  <span className="truncate font-medium">{it.name}</span>
                  <span className="k-num text-fg-2">{fmtK(v)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-ember to-gold" initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.06 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-4 mb-5 flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold-soft px-4 py-3 sm:mx-6">
        <Icon3D name="light_bulb" size={30} />
        <p className="text-[12px] text-fg-2">Cash rewards drive 61% of burn. Consider raising the $50 credit cost to 5,500 pts.</p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const ICONS = ["wrapped_gift", "gem_stone", "crown", "money_bag", "laptop", "graduation_cap", "trophy", "mobile_phone", "books", "rocket", "satellite_antenna", "dollar_banknote"];

function AddRewardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [icon, setIcon] = React.useState("wrapped_gift");
  const [name, setName] = React.useState("");
  const [cost, setCost] = React.useState(5000);
  const [stock, setStock] = React.useState(100);
  const [tier, setTier] = React.useState<MktTier["name"]>("Bronze");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title="Add reward"
      description="Appears in the client catalogue once published."
      footer={
        <>
          <DialogClose asChild>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant="ember"
            onClick={() => {
              toast.success(`${name || "New reward"} added to catalogue`, { description: `${fmtInt(cost)} pts · ${stock} in stock · ${tier}+` });
              onOpenChange(false);
            }}
          >
            Publish reward
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <SectionLabel>Illustration</SectionLabel>
          <div className="grid grid-cols-6 gap-2">
            {ICONS.map((n) => (
              <button key={n} type="button" onClick={() => setIcon(n)} className={cn("k-row grid aspect-square place-items-center transition-all", icon === n && "border-ember/60 bg-ember-soft")}>
                <Icon3D name={n} size={34} />
              </button>
            ))}
          </div>
        </div>
        <Field label="Reward name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AirPods Pro" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost">
            <NumField value={cost} onChange={setCost} suffix="pts" />
          </Field>
          <Field label="Stock">
            <NumField value={stock} onChange={setStock} suffix="units" />
          </Field>
        </div>
        <div>
          <SectionLabel>Minimum tier</SectionLabel>
          <Segmented value={tier} onChange={setTier} options={["Bronze", "Silver", "Gold", "Platinum"] as const} />
        </div>
      </div>
    </Dialog>
  );
}

export default function RewardsPage() {
  return IS_DEMO ? <DemoRewardsPage /> : <LiveRewards />;
}

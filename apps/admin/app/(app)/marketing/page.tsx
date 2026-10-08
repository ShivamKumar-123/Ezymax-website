"use client";

import * as React from "react";
import { Gift, HandCoins, Percent, Plus, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Donut,
  Flag,
  KpiCard,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  StatusChip,
  type Column,
  cn,
} from "@ezymex/ui";
import { MKT_BONUS_CAMPAIGNS, MKT_BONUS_FLOW, MKT_BONUS_GRANTS, MKT_BONUS_KPIS, type MktBonusCampaign, type MktBonusGrant } from "@ezymex/mock/admin-growth-marketing";
import { BonusCampaignCard } from "@/components/marketing/bonus-campaign-card";
import { BonusEditor } from "@/components/marketing/bonus-editor";
import { ComboChart } from "@/components/marketing/charts";
import { MiniStat, daysFromToday, fmtDate, fmtDateTime, fmtK } from "@/components/marketing/kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveBonuses } from "@/components/marketing/live/bonuses";

const CAMPAIGN_NAME = Object.fromEntries(MKT_BONUS_CAMPAIGNS.map((c) => [c.id, c.name]));
type Filter = "all" | "active" | "paused" | "scheduled";

function DemoBonusesPage() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editing, setEditing] = React.useState<MktBonusCampaign | null>(null);
  const [open, setOpen] = React.useState(false);
  const openEditor = (c: MktBonusCampaign | null) => {
    setEditing(c);
    setOpen(true);
  };
  const list = MKT_BONUS_CAMPAIGNS.filter((c) => filter === "all" || c.status === filter);
  const k = MKT_BONUS_KPIS;

  return (
    <div className="pb-16">
      <PageHeader
        title="Bonuses"
        subtitle="Non-withdrawable credit campaigns with lot-based release and expiry."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Bonus policy", { description: "Max 1 active credit per account · abuse checks on device, IP and payment method" })}>
              <ShieldCheck /> Abuse rules
            </Button>
            <Button variant="ember" shimmer onClick={() => openEditor(null)}>
              <Plus /> New campaign
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active campaigns" icon={<Gift />} value={<span className="k-num">{k.activeCampaigns}</span>} chip={`${MKT_BONUS_CAMPAIGNS.length} total · 1 scheduled`} />
        <KpiCard label="Credit issued" icon={<HandCoins />} value={<Money value={k.creditIssued} decimals={0} />} chip="+12.4% vs last 30d" chipTone="up" delay={0.05} />
        <KpiCard label="Released to balance" icon={<TrendingUp />} value={<Money value={k.released} decimals={0} />} chip={`${((k.released / k.creditIssued) * 100).toFixed(1)}% of issued`} chipTone="gold" delay={0.1} />
        <KpiCard
          label="Bonus → active trader"
          icon={<Percent />}
          value={<span className="k-num">{k.conversionPct}%</span>}
          hot
          illustration="wrapped_gift"
          footer={<Chip tone="up">+4.1 pts QoQ</Chip>}
          delay={0.15}
        />
      </div>

      <Reveal delay={0.1} className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-medium tracking-tight">Campaigns</h2>
            <p className="text-[13px] text-fg-3">Outstanding credit <span className="k-num text-fg-2">${fmtK(k.creditOutstanding)}</span> · forfeited 30d <span className="k-num text-fg-2">${fmtK(k.forfeited30d)}</span></p>
          </div>
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: <>All <span className="text-fg-3">{MKT_BONUS_CAMPAIGNS.length}</span></> },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "scheduled", label: "Scheduled" },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => (
            <Reveal key={c.id} delay={0.04 * i}>
              <BonusCampaignCard c={c} onEdit={openEditor} />
            </Reveal>
          ))}
        </div>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <GrantsCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <FlowCard />
        </Reveal>
      </div>

      <BonusEditor open={open} onOpenChange={setOpen} campaign={editing} />
    </div>
  );
}

function GrantsCard() {
  const [tab, setTab] = React.useState<"all" | "active" | "completed" | "forfeited">("all");
  const rows = MKT_BONUS_GRANTS.filter((g) => tab === "all" || g.status === tab);
  const cols: Column<MktBonusGrant>[] = [
    {
      key: "client",
      header: "Client",
      cell: (g) => (
        <div className="flex items-center gap-3">
          <Avatar src={g.person.photo} name={g.person.name} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
              {g.person.name} <Flag country={g.person.country} className="size-3.5" />
            </div>
            <div className="font-mono text-[11.5px] text-fg-3">{g.login}</div>
          </div>
        </div>
      ),
      sort: (g) => g.person.name,
    },
    { key: "campaign", header: "Campaign", cell: (g) => <div className="max-w-[160px]"><div className="truncate whitespace-nowrap text-[12.5px] text-fg-2">{CAMPAIGN_NAME[g.campaignId]}</div><div className="k-num text-[11px] text-fg-3">{fmtDateTime(g.grantedAt)}</div></div>, hideOn: "lg" },
    { key: "deposit", header: "Deposit", align: "right", cell: (g) => (g.deposit ? <Money value={g.deposit} countUp={false} /> : <span className="text-fg-3">—</span>), sort: (g) => g.deposit },
    { key: "credit", header: "Credit", align: "right", cell: (g) => <Money value={g.credit} countUp={false} className="text-gold" />, sort: (g) => g.credit },
    {
      key: "released",
      header: "Released",
      width: "180px",
      cell: (g) => (
        <div className="min-w-[140px]">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="k-num text-fg-3">
              {g.lotsTraded.toFixed(1)} / {g.lotsRequired.toFixed(1)} lots
            </span>
            <span className={cn("k-num font-medium", g.releasedPct >= 100 ? "text-up" : "text-fg-2")}>{g.releasedPct.toFixed(0)}%</span>
          </div>
          <Progress value={g.releasedPct} tone={g.releasedPct >= 100 ? "up" : g.status === "forfeited" ? "down" : "gold"} />
        </div>
      ),
      sort: (g) => g.releasedPct,
    },
    {
      key: "expires",
      header: "Expires",
      align: "right",
      cell: (g) => {
        const days = daysFromToday(g.expiresAt);
        return g.status === "active" ? (
          <div>
            <div className="k-num text-[13px]">{fmtDate(g.expiresAt)}</div>
            <div className={cn("k-num text-[11px]", days < 14 ? "text-warn" : "text-fg-3")}>in {days} days</div>
          </div>
        ) : (
          <StatusChip status={g.status === "forfeited" ? "failed" : "completed"} label={g.status === "forfeited" ? "Forfeited" : "Released"} />
        );
      },
      sort: (g) => g.expiresAt,
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Recent bonus grants" subtitle="Credit granted in the last 10 days · server time GMT+3" />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        <DataTable
          columns={cols}
          rows={rows}
          pageSize={7}
          dense
          rowKey={(g) => g.id}
          search={(g) => `${g.person.name} ${g.login} ${CAMPAIGN_NAME[g.campaignId]}`}
          searchPlaceholder="Client, login, campaign…"
          exportName="bonus-grants"
          onRowClick={(g) => toast.info(`${g.id} · ${g.person.name}`, { description: `${g.lotsTraded.toFixed(1)} of ${g.lotsRequired.toFixed(1)} lots traded` })}
          toolbar={
            <Segmented
              size="xs"
              value={tab}
              onChange={setTab}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Releasing" },
                { value: "completed", label: "Released" },
                { value: "forfeited", label: "Forfeited" },
              ]}
            />
          }
        />
      </div>
    </Card>
  );
}

function FlowCard() {
  const split = MKT_BONUS_CAMPAIGNS.filter((c) => c.creditIssued > 0).map((c) => ({ label: c.name, value: c.creditIssued }));
  const colors = ["#ff5a1f", "#e9b949", "#22c55e", "#38bdf8", "#ff8a3d"];
  const total = split.reduce((s, x) => s + x.value, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Credit flow" subtitle="Issued vs released · 30 days" icon={<Sparkles />} />
      <div className="px-4 pt-4 sm:px-6">
        <ComboChart
          data={MKT_BONUS_FLOW.map((d) => ({ label: d.label, a: d.issued, b: d.released }))}
          aLabel="Issued"
          bLabel="Released"
          height={230}
          labelEvery={7}
          format={(v) => `$${fmtK(Math.round(v))}`}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 px-4 sm:px-6">
        <MiniStat label="Avg credit" value="$412" />
        <MiniStat label="Avg release" value="23 days" />
        <MiniStat label="Abuse blocked" value="186" tone="down" />
      </div>
      <div className="mt-5 flex flex-1 items-center gap-5 border-t border-line px-6 py-5">
        <Donut
          data={split.map((s, i) => ({ ...s, color: colors[i] }))}
          size={128}
          thickness={14}
          center={
            <div>
              <div className="k-num text-[15px] font-semibold">${fmtK(total)}</div>
              <div className="text-[10.5px] text-fg-3">issued</div>
            </div>
          }
        />
        <div className="min-w-0 flex-1 space-y-2">
          {split.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2 text-[12px]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colors[i] }} />
              <span className="min-w-0 flex-1 truncate text-fg-2">{s.label}</span>
              <span className="k-num text-fg">{((s.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function BonusesPage() {
  return IS_DEMO ? <DemoBonusesPage /> : <LiveBonuses />;
}

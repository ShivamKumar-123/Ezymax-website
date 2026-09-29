"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Crown, Handshake, MoreHorizontal, Percent, Trophy, Users, Wallet } from "lucide-react";
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
  IconButton,
  KpiCard,
  Menu,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  cn,
  formatNumber,
  type Column,
} from "@kalks/ui";
import { ANL_IB_MONTHLY, ANL_IB_TIERS, ANL_PARTNERS, type AnlPartner, type AnlTier } from "@kalks/mock/admin-growth-analytics";
import { StackedBars, compactMoney } from "@/components/analytics/stacked-bars";
import { ExportActions } from "@/components/analytics/common";
import { Meter } from "@/components/analytics/meter";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePartners } from "@/components/reports/live-growth";

const TIER_TONE: Record<AnlTier, "ember" | "gold" | "up" | "info" | "neutral"> = { Elite: "ember", Platinum: "gold", Gold: "up", Silver: "info", Starter: "neutral" };

const BY_REV = [...ANL_PARTNERS].sort((a, b) => b.revenue - a.revenue);

const MEDAL = ["var(--k-gold)", "#c7ccd4", "#c77b3a"];

function Podium() {
  const top = BY_REV.slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-3">
      {top.map((p, i) => (
        <div key={p.code} className={cn("k-row relative flex flex-col items-center overflow-hidden px-3 pb-4 pt-5 text-center", i === 0 && "border-gold/30")}>
          {i === 0 && <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(233,185,73,0.22),transparent)]" />}
          <div className="relative">
            <Avatar src={p.person.photo} name={p.person.name} size={i === 0 ? 56 : 48} />
            <span className="k-num absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-[10px] font-bold text-[#1a1204] ring-2 ring-surface-2" style={{ background: MEDAL[i] }}>
              {i + 1}
            </span>
          </div>
          <div className="relative mt-2.5 w-full truncate text-[13px] font-medium">{p.person.name}</div>
          <div className="font-mono text-[10.5px] text-fg-3">{p.code}</div>
          <Money value={p.revenue} decimals={0} className="relative mt-2 text-[16px] font-semibold" />
          <div className="k-num text-[11px] text-up">ROI {p.roi}%</div>
        </div>
      ))}
    </div>
  );
}

function DemoPartnerReportsPage() {
  const [period, setPeriod] = React.useState<"12M" | "6M">("12M");
  const months = period === "12M" ? ANL_IB_MONTHLY : ANL_IB_MONTHLY.slice(-6);
  const commission = months.reduce((s, m) => s + m.commission + m.cpa, 0);
  const revenue = months.reduce((s, m) => s + m.revenue, 0);
  const net = revenue - commission;
  const maxRev = Math.max(...ANL_PARTNERS.map((p) => p.revenue));

  const cols: Column<AnlPartner>[] = [
    { key: "rank", header: "#", width: "44px", cell: (_, i) => <span className="k-num text-[12px] text-fg-3">{i + 1}</span> },
    {
      key: "ib",
      header: "Partner",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Avatar src={p.person.photo} name={p.person.name} size={34} verified={p.tier === "Elite" || p.tier === "Platinum"} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13.5px] font-medium"><span className="truncate">{p.person.name}</span><Flag country={p.person.country} className="size-3.5" /></div>
            <div className="whitespace-nowrap text-[11px] text-fg-3"><span className="font-mono">{p.code}</span>{p.subIbs ? ` · ${p.subIbs} sub-IBs` : ""}</div>
          </div>
        </div>
      ),
    },
    { key: "tier", header: "Tier", cell: (p) => <Chip size="sm" tone={TIER_TONE[p.tier]}>{p.tier === "Elite" && <Crown className="size-3" />}{p.tier}</Chip> },
    { key: "clients", header: "Clients", align: "right", sort: (p) => p.clients, cell: (p) => <span className="k-num">{formatNumber(p.clients, 0)}</span>, hideOn: "md" },
    { key: "ftds", header: "FTDs", align: "right", sort: (p) => p.ftds, cell: (p) => <span className="k-num">{formatNumber(p.ftds, 0)}</span> },
    { key: "lots", header: "Volume (lots)", align: "right", sort: (p) => p.lots, cell: (p) => <span className="k-num">{formatNumber(p.lots, 0)}</span> },
    { key: "comm", header: "Commission paid", align: "right", sort: (p) => p.commission, cell: (p) => <Money value={p.commission} decimals={0} countUp={false} className="text-fg-2" /> },
    {
      key: "rev",
      header: "Net revenue",
      align: "right",
      sort: (p) => p.revenue,
      cell: (p) => (
        <div className="flex items-center justify-end gap-2.5">
          <div className="hidden w-16 2xl:block"><Meter value={p.revenue} max={maxRev} tone="mix" height={4} /></div>
          <Money value={p.revenue} decimals={0} countUp={false} className="font-semibold" />
        </div>
      ),
    },
    { key: "roi", header: "ROI", align: "right", sort: (p) => p.roi, cell: (p) => <span className={cn("k-num font-semibold", p.roi >= 200 ? "text-up" : p.roi >= 120 ? "text-fg" : "text-warn")}>{p.roi}%</span> },
    { key: "trend", header: "12M lots", cell: (p) => <Sparkline data={p.trend} width={72} height={24} tone="gold" />, hideOn: "lg" },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (p) => (
        <Menu
          trigger={
            <IconButton size="sm" aria-label="Actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Open partner profile", icon: <Users />, href: "/partners/list" },
            { label: "Download statement", icon: <Wallet />, onSelect: () => toast.success(`Statement for ${p.code} exported`, { description: "Sep 2026 · XLSX" }) },
            { label: "Promote tier", icon: <Crown />, onSelect: () => toast.success(`${p.person.name} promoted`, { description: `${p.tier} → next tier from 1 Oct 2026` }) },
            "sep",
            { label: "Flag for review", danger: true, onSelect: () => toast.warning(`${p.code} flagged`, { description: "Sent to Partners › Fraud flags" }) },
          ]}
        />
      ),
    },
  ];

  const tierTotal = ANL_IB_TIERS.reduce((s, t) => s + t.partners, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Partner reports"
        subtitle="IB performance, commission cost vs revenue and ROI · commissions settled daily in USDT"
        actions={
          <>
            <Segmented value={period} onChange={setPeriod} options={["6M", "12M"] as const} />
            <ExportActions name="Partner report" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active partners" icon={<Handshake />} value={<span className="k-num">{formatNumber(tierTotal, 0)}</span>} chip="+86 this month" chipTone="up" href="/partners/list" />
        <KpiCard label="Commission + CPA paid" icon={<Wallet />} value={<Money value={commission} decimals={0} />} footer={<span className="text-[11.5px] text-fg-3">{period} · incl. CPA {compactMoney(months.reduce((s, m) => s + m.cpa, 0))}</span>} href="/finance/payouts" delay={0.05} />
        <KpiCard label="Net revenue to broker" icon={<BarChart3 />} value={<Money value={net} decimals={0} />} hot illustration="handshake" chip={`${((revenue / commission) * 100).toFixed(0)}% ROI`} chipTone="gold" delay={0.1} />
        <KpiCard label="IB share of FTDs" icon={<Percent />} value={<span className="k-num">41.6%</span>} chip="1,366 of 3,284 · 30D" chipTone="ember" href="/analytics/funnel" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Commission vs revenue" subtitle="Monthly · revenue from IB-referred clients above zero, payouts below · line = net" icon={<BarChart3 />} />
            <div className="px-4 pb-5 pt-5 sm:px-6">
              <StackedBars
                height={392}
                data={months.map((m) => ({ label: m.month, title: `${m.month} ${["Oct", "Nov", "Dec"].includes(m.month) ? 2025 : 2026}`, values: { revenue: m.revenue, commission: -m.commission, cpa: -m.cpa } }))}
                series={[
                  { key: "revenue", label: "Gross revenue", color: "var(--k-gold)" },
                  { key: "commission", label: "Lot commission", color: "var(--k-ember)" },
                  { key: "cpa", label: "CPA bonuses", color: "color-mix(in oklab, var(--k-down) 70%, var(--k-surface-3))" },
                ]}
                line={{ key: "net", label: "Net to broker", color: "var(--k-up)", values: months.map((m) => m.revenue - m.commission - m.cpa) }}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Tier breakdown" subtitle="Share of IB-driven revenue" icon={<Trophy />} action={<Link href="/partners/levels"><Button size="sm" variant="surface">Levels</Button></Link>} />
            <div className="flex items-center gap-5 px-6 pt-5">
              <Donut
                size={150}
                thickness={12}
                data={ANL_IB_TIERS.map((t) => ({ label: t.tier, value: t.share, color: t.color }))}
                center={
                  <div>
                    <div className="k-num text-[18px] font-semibold leading-none">14</div>
                    <div className="mt-1 text-[9.5px] uppercase tracking-wider text-fg-3">Elite</div>
                  </div>
                }
              />
              <p className="text-[12.5px] leading-relaxed text-fg-3">
                <span className="text-fg">Elite + Platinum</span> partners are <span className="k-num text-fg">3.3%</span> of the network but drive <span className="k-num text-gold">61.9%</span> of revenue.
              </p>
            </div>
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {ANL_IB_TIERS.map((t, i) => (
                <div key={t.tier} className="k-row px-3.5 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 rounded-[3px]" style={{ background: t.color }} />
                    <span className="flex-1 text-[13px] font-medium">{t.tier}</span>
                    <span className="k-num text-[11.5px] text-fg-3">{formatNumber(t.partners, 0)} IBs</span>
                    <span className="k-num w-12 text-right text-[13px] font-semibold">{t.share}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Meter value={t.share} max={ANL_IB_TIERS[0]!.share} tone={(["ember", "gold", "up", "info", "mix"] as const)[i]} height={3} delay={i * 0.05} />
                    <span className="shrink-0 text-[10.5px] text-fg-3">{t.rate}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="IB leaderboard" subtitle="Ranked by net revenue to broker · clients, FTDs, volume, commission paid and ROI" icon={<Trophy />} />
          <div className="mt-5 grid grid-cols-1 gap-4 px-4 sm:px-6 xl:grid-cols-[3fr_2fr]">
            <Podium />
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Avg commission / lot", "$7.42", "All tiers, Sep 2026"],
                ["Avg revenue / lot", "$21.18", "IB-referred clients"],
                ["Median payback / FTD", "38 days", "Commission + CPA"],
                ["Negative-ROI partners", "23", "Review in Fraud flags"],
              ].map(([k, v, sub]) => (
                <div key={k} className="k-row flex flex-col justify-center px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
                  <div className="k-num mt-1 text-[20px] font-semibold">{v}</div>
                  <div className="text-[11.5px] text-fg-3">{sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 px-4 pb-5 sm:px-6">
            <DataTable columns={cols} rows={BY_REV} pageSize={8} dense search={(p) => `${p.person.name} ${p.code} ${p.tier}`} exportName="ib-leaderboard" rowKey={(p) => p.code} />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/** Live builds: the reports service (/api/reports). Demo builds: mock data. */
export default function PartnerReportsPage() {
  return IS_DEMO ? <DemoPartnerReportsPage /> : <LivePartners />;
}

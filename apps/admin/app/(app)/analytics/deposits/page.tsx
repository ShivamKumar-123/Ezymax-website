"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, Globe2, Handshake, Landmark, Megaphone, PiggyBank, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  CHART_COLORS,
  Card,
  CardHeader,
  Chip,
  CoinIcon,
  DataTable,
  Delta,
  Donut,
  Flag,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  StatusChip,
  WorldMap,
  cn,
  formatNumber,
  type Column,
} from "@kalks/ui";
import { ANL_DEP_CAMPAIGNS, ANL_DEP_COUNTRIES, ANL_DEP_DAILY, ANL_DEP_IBS, ANL_DEP_METHODS, type AnlCampaign } from "@kalks/mock/admin-growth-analytics";
import { StackedBars, compactMoney } from "@/components/analytics/stacked-bars";
import { ExportActions, dayLabel, weekday } from "@/components/analytics/common";
import { Meter } from "@/components/analytics/meter";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveDeposits } from "@/components/reports/live-growth";

const RANGES = ["7D", "30D", "90D"] as const;
type R = (typeof RANGES)[number];
const DAYS: Record<R, number> = { "7D": 7, "30D": 30, "90D": 90 };

const METHOD_ICON: Record<string, React.ReactNode> = {
  "Bank wire": <Landmark />,
  "Cards (Visa/MC)": <CreditCard />,
  "Local (UPI/PIX)": <Smartphone />,
  "Skrill / Neteller": <Wallet />,
};

const CH_TONE = { Google: "info", Meta: "ember", Affiliate: "gold", Telegram: "info", Email: "neutral", IB: "up" } as const;

function totals(rows: typeof ANL_DEP_DAILY) {
  return rows.reduce((a, d) => ({ dep: a.dep + d.deposits, wd: a.wd + d.withdrawals, ftds: a.ftds + d.ftds }), { dep: 0, wd: 0, ftds: 0 });
}

function FlowChart({ rows }: { rows: typeof ANL_DEP_DAILY }) {
  const data = rows.map((d) => ({ label: dayLabel(d.date), title: `${weekday(d.date)}, ${dayLabel(d.date, true)}`, values: { deposits: d.deposits, withdrawals: -d.withdrawals } }));
  return (
    <StackedBars
      data={data}
      height={372}
      series={[
        { key: "deposits", label: "Deposits", color: "var(--k-up)" },
        { key: "withdrawals", label: "Withdrawals", color: "var(--k-down)" },
      ]}
      line={{ key: "net", label: "Net deposits", color: "var(--k-gold)", values: rows.map((d) => d.deposits - d.withdrawals) }}
    />
  );
}

function CountriesCard({ k }: { k: number }) {
  const rows = [...ANL_DEP_COUNTRIES].sort((a, b) => b.deposits - a.deposits);
  const max = rows[0]!.deposits;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return (
    <Card className="h-full">
      <CardHeader title="FTDs & deposits by country" subtitle="Pins = first-time depositors · hover for detail" icon={<Globe2 />} action={<Link href="/settings/countries"><Button size="sm" variant="surface">Countries</Button></Link>} />
      <div className="grid grid-cols-1 gap-4 px-4 pb-5 pt-3 sm:px-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex items-center">
          {mounted ? <WorldMap
            pins={rows.map((r) => ({ country: r.country, count: Math.round(r.ftds * k), label: r.name }))}
            heat={Object.fromEntries(rows.slice(0, 6).map((r) => [r.country, (r.deposits - r.withdrawals) / max]))}
            onPin={(p) => toast(`${p.label}`, { description: `${p.count} FTDs in period` })}
          /> : <div className="aspect-[960/470] w-full" />}
        </div>
        <div className="space-y-1.5">
          {rows.slice(0, 8).map((r, i) => (
            <div key={r.country} className="k-row flex items-center gap-3 px-3 py-2">
              <Flag country={r.country} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate font-medium">{r.name}</span>
                  <Money value={r.deposits * k} decimals={0} countUp={false} className="text-[12.5px] font-medium" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Meter value={r.deposits} max={max} tone={i < 3 ? "mix" : "ember"} height={3} delay={i * 0.04} />
                  <span className="k-num w-14 shrink-0 text-right text-[10.5px] text-fg-3">{Math.round(r.ftds * k)} FTD</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function IbCard({ k }: { k: number }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="By introducing broker" subtitle="FTDs and deposits from IB-referred clients" icon={<Handshake />} action={<Link href="/analytics/partners"><Button size="sm" variant="surface">Partners</Button></Link>} />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {ANL_DEP_IBS.slice(0, 7).map((ib, i) => (
          <Link key={ib.code} href="/partners/list" className="k-row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-3/60">
            <span className="k-num w-4 text-center text-[11px] text-fg-3">{i + 1}</span>
            <Avatar src={ib.person.photo} name={ib.person.name} size={34} verified={i < 3} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">{ib.person.name}<Flag country={ib.person.country} className="size-3.5" /></div>
              <div className="font-mono text-[11px] text-fg-3">{ib.code}</div>
            </div>
            <Sparkline data={ib.trend} width={56} height={22} tone="gold" className="hidden sm:block" />
            <div className="w-24 text-right">
              <Money value={ib.deposits * k} decimals={0} countUp={false} className="text-[13px] font-semibold" />
              <div className="k-num text-[11px] text-fg-3">{Math.round(ib.ftds * k)} FTDs</div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function MethodsCard({ total }: { total: number }) {
  const data = ANL_DEP_METHODS.map((m, i) => ({ label: m.label, value: m.value, color: i === 0 ? "#22c55e" : CHART_COLORS[(i + (i >= 2 ? 1 : 0)) % CHART_COLORS.length] }));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Deposit methods" subtitle="Share of deposit volume" icon={<Banknote />} action={<Link href="/settings/payments"><Button size="sm" variant="surface">Methods</Button></Link>} />
      <div className="flex justify-center py-5">
        <Donut
          data={data}
          size={176}
          thickness={18}
          center={
            <div>
              <div className="k-num text-[24px] font-semibold leading-none">{ANL_DEP_METHODS[0]!.value}%</div>
              <div className="mt-1 text-[11px] text-fg-3">USDT · TRC20</div>
            </div>
          }
        />
      </div>
      <div className="flex-1 space-y-1 px-4 pb-5 sm:px-6">
        {ANL_DEP_METHODS.map((m, i) => (
          <div key={m.label} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-2">
            <span className="size-2 rounded-full" style={{ background: data[i]!.color }} />
            {m.coin ? <CoinIcon coin={m.coin === "usdt" ? "usdt" : m.coin} size={20} /> : <span className="grid size-5 place-items-center text-fg-3 [&_svg]:size-4">{METHOD_ICON[m.label]}</span>}
            <span className="flex-1 truncate text-[12.5px]">{m.label}</span>
            <Money value={(total * m.value) / 100} decimals={0} countUp={false} className="text-[12px] text-fg-3" />
            <span className={cn("k-num w-12 text-right text-[12.5px] font-medium", i === 0 && "text-up")}>{m.value}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DemoDepositsAnalyticsPage() {
  const [range, setRange] = React.useState<R>("30D");
  const n = DAYS[range];
  const rows = ANL_DEP_DAILY.slice(-n);
  const prevRows = range === "90D" ? ANL_DEP_DAILY.slice(0, 45) : ANL_DEP_DAILY.slice(-n * 2, -n);
  const t = totals(rows);
  const p = totals(prevRows);
  const pScale = range === "90D" ? 2 : 1;
  const k = t.ftds / ANL_DEP_COUNTRIES.reduce((s, c) => s + c.ftds, 0);
  const net = t.dep - t.wd;

  const cols: Column<AnlCampaign>[] = [
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{c.name}</div>
          <div className="font-mono text-[11px] text-fg-3">{c.id}</div>
        </div>
      ),
    },
    { key: "ch", header: "Channel", cell: (c) => <Chip size="sm" tone={CH_TONE[c.channel]}>{c.channel}</Chip> },
    { key: "st", header: "Status", cell: (c) => <StatusChip status={c.status} />, hideOn: "lg" },
    { key: "ftds", header: "FTDs", align: "right", sort: (c) => c.ftds, cell: (c) => <span className="k-num font-medium">{formatNumber(c.ftds, 0)}</span> },
    { key: "dep", header: "Deposits", align: "right", sort: (c) => c.deposits, cell: (c) => <Money value={c.deposits} decimals={0} countUp={false} /> },
    { key: "spend", header: "Spend", align: "right", sort: (c) => c.spend, cell: (c) => <Money value={c.spend} decimals={0} countUp={false} className="text-fg-2" />, hideOn: "lg" },
    { key: "cpa", header: "Cost / FTD", align: "right", sort: (c) => c.spend / c.ftds, cell: (c) => <span className="k-num text-fg-2">${(c.spend / c.ftds).toFixed(0)}</span>, hideOn: "lg" },
    {
      key: "roas",
      header: "Deposit ROAS",
      align: "right",
      sort: (c) => c.deposits / c.spend,
      cell: (c) => {
        const roas = c.deposits / c.spend;
        return (
          <div className="flex items-center justify-end gap-2.5">
            <div className="hidden w-16 2xl:block"><Meter value={Math.min(roas, 40)} max={40} tone={roas > 15 ? "up" : "gold"} height={4} /></div>
            <span className={cn("k-num w-12 font-semibold", roas > 15 ? "text-up" : "text-fg")}>{roas.toFixed(1)}×</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Deposits analytics"
        subtitle="FTDs and money-in by country, IB and campaign · USD equivalent · GMT+3"
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <ExportActions name="Deposits analytics" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Net deposits" icon={<PiggyBank />} value={<Money value={net} decimals={0} />} hot illustration="money_bag" footer={<Delta value={((net - (p.dep - p.wd) / pScale) / ((p.dep - p.wd) / pScale)) * 100} chip />} />
        <KpiCard label="Deposits" icon={<ArrowDownLeft />} value={<Money value={t.dep} decimals={0} />} footer={<Delta value={((t.dep - p.dep / pScale) / (p.dep / pScale)) * 100} chip />} href="/finance" delay={0.05} />
        <KpiCard label="Withdrawals" icon={<ArrowUpRight />} value={<Money value={t.wd} decimals={0} />} footer={<span className="k-num text-[11.5px] text-fg-3">{((t.wd / t.dep) * 100).toFixed(1)}% of deposits</span>} href="/finance/withdrawals" delay={0.1} />
        <KpiCard
          label="First-time deposits"
          icon={<Wallet />}
          value={<span className="k-num">{formatNumber(t.ftds, 0)}</span>}
          footer={<span className="flex items-center gap-2 text-[11.5px] text-fg-3">Avg FTD <Money value={412.6} countUp={false} className="font-medium text-fg" /></span>}
          href="/analytics/funnel"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Deposits vs withdrawals" subtitle={`Daily · ${range} · line = net deposits`} icon={<Landmark />} action={<Chip tone={net > 0 ? "up" : "down"} dot>Net {compactMoney(net)}</Chip>} />
            <div className="px-4 pb-5 pt-5 sm:px-6">
              <FlowChart rows={rows} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <MethodsCard total={t.dep} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <CountriesCard k={k} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-4">
          <IbCard k={k} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-8">
        <Card className="h-full">
          <CardHeader
            title="By campaign"
            subtitle="Attributed FTDs and deposits · 30-day attribution window"
            icon={<Megaphone />}
            action={<Link href="/marketing/campaigns"><Button size="sm" variant="surface">Campaigns</Button></Link>}
          />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            <DataTable columns={cols} rows={ANL_DEP_CAMPAIGNS} search={(c) => `${c.name} ${c.id} ${c.channel}`} exportName="deposits-by-campaign" rowKey={(c) => c.id} dense onRowClick={(c) => toast(c.name, { description: `${c.ftds} FTDs · ${compactMoney(c.deposits)} deposited` })} />
          </div>
        </Card>
      </Reveal>
      </div>
    </div>
  );
}

/** Live builds: the reports service (/api/reports). Demo builds: mock data. */
export default function DepositsAnalyticsPage() {
  return IS_DEMO ? <DemoDepositsAnalyticsPage /> : <LiveDeposits />;
}

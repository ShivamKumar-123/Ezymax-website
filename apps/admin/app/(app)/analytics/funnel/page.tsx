"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Clock, Filter, Globe2, Handshake, Leaf, Link2, Megaphone, Search, Send, Target, TrendingUp, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, Chip, Delta, Flag, KpiCard, Money, PageHeader, Reveal, Segmented, cn, formatNumber } from "@kalks/ui";
import { ANL_FUNNEL_30D, ANL_FUNNEL_COUNTRIES, ANL_FUNNEL_DAILY, ANL_FUNNEL_PREV, ANL_FUNNEL_SOURCES, ANL_FUNNEL_STAGES, ANL_TIME_TO_FTD, type AnlFunnelRow } from "@kalks/mock/admin-growth-analytics";
import { FunnelViz } from "@/components/analytics/funnel";
import { LineChart } from "@/components/analytics/line-chart";
import { ExportActions, dayLabel } from "@/components/analytics/common";
import { Meter, heat } from "@/components/analytics/meter";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveFunnel } from "@/components/reports/live-growth";

const RANGES = ["7D", "30D", "90D"] as const;
type R = (typeof RANGES)[number];
const SCALE: Record<R, number> = { "7D": 0.228, "30D": 1, "90D": 2.86 };

const SOURCE_ICON: Record<string, React.ReactNode> = {
  google: <Search />,
  meta: <Megaphone />,
  ib: <Handshake />,
  organic: <Leaf />,
  affiliates: <Link2 />,
  telegram: <Send />,
};

const STEPS = [
  { key: "signup", from: "visit", label: "Visit → Sign-up" },
  { key: "kyc", from: "signup", label: "Sign-up → KYC" },
  { key: "ftd", from: "kyc", label: "KYC → FTD" },
  { key: "active", from: "ftd", label: "FTD → Active" },
] as const;

function CountryTable({ scale }: { scale: number }) {
  const [sort, setSort] = React.useState<"ftd" | "conv">("ftd");
  const rows = [...ANL_FUNNEL_COUNTRIES].sort((a, b) => (sort === "ftd" ? b.ftd - a.ftd : b.ftd / b.visit - a.ftd / a.visit));
  const rates = STEPS.map((s) => ANL_FUNNEL_COUNTRIES.map((r) => r[s.key] / r[s.from]));
  const lo = rates.map((a) => Math.min(...a));
  const hi = rates.map((a) => Math.max(...a));
  return (
    <Card className="h-full">
      <CardHeader
        title="Conversion by country"
        subtitle="Step conversion heat — brighter is better"
        icon={<Globe2 />}
        action={<Segmented size="xs" value={sort} onChange={setSort} options={[{ value: "ftd", label: "By FTDs" }, { value: "conv", label: "By conversion" }]} />}
      />
      <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
              <th className="rounded-l-[14px] border-y border-l border-line bg-surface-2 py-2.5 pl-4 text-left font-medium">Country</th>
              <th className="border-y border-line bg-surface-2 px-2 text-right font-medium">Visits</th>
              {STEPS.map((s) => (
                <th key={s.key} className="border-y border-line bg-surface-2 px-2 text-center font-medium">{s.label.replace(" → ", "→")}</th>
              ))}
              <th className="rounded-r-[14px] border-y border-r border-line bg-surface-2 pr-4 text-right font-medium">FTDs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <motion.tr key={r.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.02 }} className="group">
                <td className="py-1 pl-4">
                  <span className="flex items-center gap-2.5">
                    <Flag country={r.country!} />
                    <span className="font-medium">{r.label}</span>
                  </span>
                </td>
                <td className="k-num px-2 text-right text-fg-2">{formatNumber(r.visit * scale, 0)}</td>
                {STEPS.map((s, si) => {
                  const v = r[s.key] / r[s.from];
                  const t = (v - lo[si]!) / (hi[si]! - lo[si]! || 1);
                  return (
                    <td key={s.key} className="px-1 py-0.5">
                      <div
                        className={cn("k-num mx-auto grid h-8 max-w-[92px] place-items-center rounded-[10px] text-[12px] font-medium transition-transform group-hover:scale-[1.03]", t > 0.55 ? "text-[#1a1204]" : "text-fg")}
                        style={{ background: heat(t) }}
                      >
                        {(v * 100).toFixed(1)}%
                      </div>
                    </td>
                  );
                })}
                <td className="k-num pr-4 text-right font-semibold">{formatNumber(r.ftd * scale, 0)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SourceRows({ scale }: { scale: number }) {
  const rows = [...ANL_FUNNEL_SOURCES].sort((a, b) => b.ftd - a.ftd);
  const maxFtd = Math.max(...rows.map((r) => r.ftd));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="By acquisition source" subtitle="FTDs, visit→FTD rate and cost per FTD" icon={<Target />} action={<Chip tone="ember" dot>UTM · last-click</Chip>} />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {rows.map((r: AnlFunnelRow, i) => {
          const cpa = r.spend ? r.spend / r.ftd : 0;
          return (
            <button key={r.key} type="button" onClick={() => toast(`${r.label} drill-down`, { description: `${formatNumber(r.ftd * scale, 0)} FTDs · filters applied to cohort view` })} className="k-row block w-full px-4 py-3 text-left transition-colors hover:bg-surface-3/60">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-line [&_svg]:size-4", i === 0 ? "bg-ember-soft text-ember" : "bg-surface-3 text-fg-2")}>{SOURCE_ICON[r.key]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{r.label}</div>
                  <div className="k-num text-[11.5px] text-fg-3">
                    {formatNumber(r.visit * scale, 0)} visits · {((r.ftd / r.visit) * 100).toFixed(2)}% → FTD
                  </div>
                </div>
                <div className="text-right">
                  <div className="k-num text-[15px] font-semibold">{formatNumber(r.ftd * scale, 0)}</div>
                  <div className="k-num text-[11px] text-fg-3">{cpa ? `$${cpa.toFixed(0)} CPA` : "Commission-based"}</div>
                </div>
              </div>
              <Meter value={r.ftd} max={maxFtd} tone={i === 0 ? "mix" : "ember"} height={4} className="mt-2.5" delay={i * 0.05} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function TimeToFtd({ scale }: { scale: number }) {
  const total = ANL_TIME_TO_FTD.reduce((s, b) => s + b.count, 0);
  const max = Math.max(...ANL_TIME_TO_FTD.map((b) => b.count));
  const [hover, setHover] = React.useState<number | null>(null);
  let acc = 0;
  const within24 = ANL_TIME_TO_FTD.slice(0, 3).reduce((s, b) => s + b.count, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Time to first deposit" subtitle="From sign-up · last 30 days" icon={<Clock />} action={<Chip tone="gold">Median 19h</Chip>} />
      <div className="flex flex-1 items-end gap-2.5 px-6 pt-8" style={{ minHeight: 220 }}>
        {ANL_TIME_TO_FTD.map((b, i) => {
          acc += b.count;
          const on = hover === i;
          return (
            <div key={b.bucket} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={cn("k-num mb-1.5 text-[11px] transition-colors", on ? "text-fg" : "text-fg-3")}>{((b.count / total) * 100).toFixed(0)}%</div>
              <motion.div
                className={cn("w-full max-w-12 rounded-[10px] border", i < 3 ? "border-ember/40 bg-gradient-to-b from-[#ff8a3d] to-[#b8330f]" : "border-line bg-gradient-to-b from-surface-3 to-surface-2", on && "shadow-[0_0_30px_-6px_rgba(255,90,31,0.7)]")}
                initial={{ height: 0 }}
                animate={{ height: `${(b.count / max) * 150}px` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
              {on && (
                <div className="absolute -top-2 z-10 whitespace-nowrap rounded-full border border-line bg-surface-3 px-2.5 py-1 text-[11px] shadow-lg k-num">
                  {formatNumber(b.count * scale, 0)} FTDs · cum {((acc / total) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2.5 px-6 pt-2">
        {ANL_TIME_TO_FTD.map((b) => (
          <span key={b.bucket} className="k-num flex-1 text-center text-[10.5px] text-fg-3">{b.bucket}</span>
        ))}
      </div>
      <div className="mx-6 mb-6 mt-4 grid grid-cols-2 gap-3">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Within 24h</div>
          <div className="k-num mt-1 text-[16px] font-medium text-up">{((within24 / total) * 100).toFixed(1)}%</div>
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">After 14 days</div>
          <div className="k-num mt-1 text-[16px] font-medium text-fg">{(((ANL_TIME_TO_FTD[6]!.count + ANL_TIME_TO_FTD[7]!.count) / total) * 100).toFixed(1)}%</div>
        </div>
      </div>
    </Card>
  );
}

function DemoFunnelPage() {
  const [range, setRange] = React.useState<R>("30D");
  const k = SCALE[range];
  const cur = ANL_FUNNEL_30D;
  const prev = ANL_FUNNEL_PREV;
  const stages = ANL_FUNNEL_STAGES.map((s) => ({ key: s.key, label: s.label, hint: s.hint, value: Math.round(cur[s.key] * k), prev: Math.round(prev[s.key] * k) }));
  const spend = ANL_FUNNEL_SOURCES.reduce((s, r) => s + (r.spend ?? 0), 0);
  const cac = spend / cur.ftd;
  const rate = (cur.ftd / cur.visit) * 100;
  const prevRate = (prev.ftd / prev.visit) * 100;

  return (
    <div className="pb-16">
      <PageHeader
        title="Acquisition funnel"
        subtitle="Visit → sign-up → KYC → first deposit → active · all brands · attribution last-click"
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <ExportActions name="Acquisition funnel" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sign-ups" icon={<UserPlus />} value={<span className="k-num">{formatNumber(stages[1]!.value, 0)}</span>} footer={<Delta value={((cur.signup - prev.signup) / prev.signup) * 100} chip />} href="/clients/leads" />
        <KpiCard label="First deposits" icon={<TrendingUp />} value={<span className="k-num">{formatNumber(stages[3]!.value, 0)}</span>} footer={<Delta value={((cur.ftd - prev.ftd) / prev.ftd) * 100} chip />} href="/analytics/deposits" delay={0.05} />
        <KpiCard label="Visit → FTD" icon={<Filter />} value={<span className="k-num">{rate.toFixed(2)}%</span>} footer={<Delta value={rate - prevRate} suffix=" pp" chip />} delay={0.1} />
        <KpiCard label="Blended CAC" icon={<Users />} value={<Money value={cac} />} hot illustration="rocket" footer={<Chip tone="gold">Paid only ${(spend / (cur.ftd - ANL_FUNNEL_SOURCES[2]!.ftd)).toFixed(0)}</Chip>} delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="Conversion funnel"
            subtitle={`${range} · change vs previous period shown under each stage`}
            icon={<Filter />}
            action={<Chip tone="up" dot>KYC auto-approve 71%</Chip>}
          />
          <div className="overflow-x-auto px-4 pb-6 pt-6 sm:px-6">
            <div className="min-w-[720px]">
              <FunnelViz stages={stages} />
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <CountryTable scale={k} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <SourceRows scale={k} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Daily sign-ups vs FTDs" subtitle="Last 30 days · GMT+3" icon={<UserPlus />} />
            <div className="px-4 pb-5 pt-5 sm:px-6">
              <LineChart
                height={250}
                format={(v) => formatNumber(v, 0)}
                labels={ANL_FUNNEL_DAILY.map((d) => dayLabel(d.date))}
                series={[
                  { key: "signup", label: "Sign-ups", color: "var(--k-gold)", values: ANL_FUNNEL_DAILY.map((d) => d.signup), area: true },
                  { key: "ftd", label: "First deposits", color: "var(--k-ember)", values: ANL_FUNNEL_DAILY.map((d) => d.ftd), area: true, width: 2.4 },
                ]}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <TimeToFtd scale={k} />
        </Reveal>
      </div>
    </div>
  );
}

/** Live builds: the reports service (/api/reports). Demo builds: mock data. */
export default function FunnelPage() {
  return IS_DEMO ? <DemoFunnelPage /> : <LiveFunnel />;
}

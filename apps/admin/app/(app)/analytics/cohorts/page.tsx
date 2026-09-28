"use client";

import * as React from "react";
import { Coins, Grid3x3, Hourglass, LineChart as LineIcon, Scale, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, KpiCard, Money, PageHeader, Reveal, Segmented, cn, formatNumber } from "@kalks/ui";
import { ANL_COHORTS } from "@kalks/mock/admin-growth-analytics";
import { CohortHeatmap } from "@/components/analytics/cohort-heatmap";
import { LineChart } from "@/components/analytics/line-chart";
import { ExportActions } from "@/components/analytics/common";
import { Meter } from "@/components/analytics/meter";

const MONTHS = 12;

function weighted(fn: (m: number, c: (typeof ANL_COHORTS)[number]) => number) {
  return Array.from({ length: MONTHS }, (_, m) => {
    const have = ANL_COHORTS.filter((c) => c.ltv.length > m);
    const w = have.reduce((s, c) => s + c.ftds, 0);
    return w ? have.reduce((s, c) => s + fn(m, c) * c.ftds, 0) / w : null;
  });
}

const AVG_LTV = weighted((m, c) => c.ltv[m]!);
const TOTAL_FTDS = ANL_COHORTS.reduce((s, c) => s + c.ftds, 0);
const AVG_CAC = ANL_COHORTS.reduce((s, c) => s + c.cac * c.ftds, 0) / TOTAL_FTDS;
const LTV12 = AVG_LTV[MONTHS - 1]!;
const PAYBACK = AVG_LTV.findIndex((v) => v !== null && v >= AVG_CAC);
const ARPU = (AVG_LTV[5]! - AVG_LTV[4]!) / (weighted((m, c) => c.retention[m]!)[5]! / 100);

const RAMP = (i: number) => `color-mix(in oklab, var(--k-gold) ${Math.round((i / 11) * 100)}%, var(--k-ember))`;

export default function CohortsPage() {
  const [mode, setMode] = React.useState<"retention" | "ltv">("retention");
  const [lines, setLines] = React.useState<"all" | "quarters">("quarters");
  const labels = Array.from({ length: MONTHS }, (_, m) => `M${m}`);
  const shown = ANL_COHORTS.filter((_, i) => lines === "all" || i % 3 === 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Cohorts & LTV"
        subtitle="Monthly FTD cohorts Oct 2025 – Sep 2026 · retention = traded in month · LTV = cumulative net revenue per FTD"
        actions={<ExportActions name="Cohort retention" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="12-month LTV" icon={<Wallet />} value={<Money value={LTV12} decimals={0} />} hot illustration="gem_stone" footer={<Chip tone="gold">Oct 2025 cohort basis</Chip>} />
        <KpiCard label="Blended CAC" icon={<Coins />} value={<Money value={AVG_CAC} decimals={0} />} chip="−4.2% vs H1" chipTone="up" href="/analytics/funnel" delay={0.05} />
        <KpiCard label="LTV : CAC" icon={<Scale />} value={<span className="k-num">{(LTV12 / AVG_CAC).toFixed(2)}×</span>} chip="Target ≥ 3.0×" chipTone={LTV12 / AVG_CAC >= 3 ? "up" : "warn"} delay={0.1} />
        <KpiCard
          label="ARPU · CAC payback"
          icon={<Hourglass />}
          value={<Money value={ARPU} />}
          footer={
            <span className="flex items-center gap-2 text-[11.5px] text-fg-3">
              per active / month · payback <Chip size="sm" tone="up">Month {PAYBACK}</Chip>
            </span>
          }
          delay={0.15}
        />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="Cohort retention"
            subtitle={mode === "retention" ? "Share of each FTD cohort still trading N months later" : "Cumulative net revenue per FTD, N months after first deposit"}
            icon={<Grid3x3 />}
            action={
              <Segmented
                size="xs"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "retention", label: "Retention %" },
                  { value: "ltv", label: "LTV $" },
                ]}
              />
            }
          />
          <div className="px-4 pb-6 pt-5 sm:px-6">
            <CohortHeatmap cohorts={ANL_COHORTS} mode={mode} />
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="LTV curves"
              subtitle="Cumulative net revenue per FTD · dashed = blended CAC"
              icon={<LineIcon />}
              action={<Segmented size="xs" value={lines} onChange={setLines} options={[{ value: "quarters", label: "Quarterly" }, { value: "all", label: "All cohorts" }]} />}
            />
            <div className="px-4 pb-5 pt-5 sm:px-6">
              <LineChart
                height={440}
                labels={labels}
                format={(v) => `$${formatNumber(v, 0)}`}
                series={[
                  { key: "avg", label: "Weighted avg", color: "var(--k-fg)", values: AVG_LTV, width: 3, area: true },
                  { key: "cac", label: "CAC", color: "var(--k-down)", values: labels.map(() => Math.round(AVG_CAC)), dashed: true, width: 1.5 },
                  ...shown.map((c) => ({ key: c.key, label: c.month, color: RAMP(ANL_COHORTS.indexOf(c)), values: c.ltv, width: 1.6, muted: lines === "all" })),
                ]}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Cohort quality" subtitle="M3 retention · LTV to date vs CAC" icon={<Users />} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {[...ANL_COHORTS].reverse().slice(1, 7).map((c) => {
                const ltv = c.ltv[c.ltv.length - 1]!;
                const paid = ltv >= c.cac;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toast(`${c.month} cohort`, { description: `${formatNumber(c.ftds, 0)} FTDs · LTV $${formatNumber(ltv, 0)} · CAC $${c.cac}` })}
                    className="k-row block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-3/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium">{c.month}</div>
                        <div className="k-num text-[11.5px] text-fg-3">
                          {formatNumber(c.ftds, 0)} FTDs · M3 {c.retention[3] !== undefined ? `${c.retention[3]!.toFixed(1)}%` : "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="k-num text-[14px] font-semibold">${formatNumber(ltv, 0)}</div>
                        <Chip size="sm" tone={paid ? "up" : "warn"}>{paid ? "Paid back" : `${Math.round((ltv / c.cac) * 100)}% of CAC`}</Chip>
                      </div>
                    </div>
                    <Meter value={Math.min(ltv, c.cac)} max={c.cac} tone={paid ? "up" : "gold"} height={4} className="mt-2" />
                  </button>
                );
              })}
            </div>
            <div className="px-6 pb-6">
              <Button variant="surface" size="sm" className={cn("w-full")} onClick={() => toast.success("Cohort definitions saved", { description: "Active = ≥ 1 closed trade in calendar month (GMT+3)" })}>
                Edit cohort definition
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

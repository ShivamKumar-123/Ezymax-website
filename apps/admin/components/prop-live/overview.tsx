"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Award, CalendarClock, CircleDollarSign, Layers, Percent, ShieldAlert, Trophy, XCircle } from "lucide-react";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, Skeleton, cn } from "@kalks/ui";
import { useApi } from "@/components/live/kit";
import { PropError, PlanTypeChip, int, pct, ruleLabel, usd, usdK, type Overview, type PlanRow } from "./kit";

export function LivePropOverview() {
  const { data, error, reload } = useApi<Overview>("/api/prop/overview", { refreshMs: 15_000 });
  const plans = useApi<{ plans: PlanRow[] }>("/api/prop/plans");

  return (
    <div className="pb-24">
      <PageHeader
        title="Prop Firm"
        subtitle="Evaluation pipeline, funded traders and the fee vs payout book. Live from the prop service."
        actions={
          <>
            <Link href="/prop/payouts">
              <Button variant="surface" size="sm">
                <CircleDollarSign /> Payout queue
                {data && data.payoutsPending > 0 && (
                  <Chip size="sm" tone="warn">
                    {data.payoutsPending}
                  </Chip>
                )}
              </Button>
            </Link>
            <Link href="/prop/plans">
              <Button variant="ember" size="sm">
                <Layers /> Plan builder
              </Button>
            </Link>
          </>
        }
      />

      {error && !data ? (
        <PropError error={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-[20px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Active challenges" icon={<Activity />} value={<span className="k-num">{int(data.activeChallenges)}</span>} chip={`${int(data.sold30d)} sold in 30 days`} href="/prop/challenges" />
            <KpiCard label="Pass rate" icon={<Percent />} value={<span className="k-num">{data.passRate === null ? "—" : pct(data.passRate)}</span>} chip={`${int(data.failed)} failed`} chipTone={data.failed ? "down" : "neutral"} href="/prop/challenges" delay={0.04} />
            <KpiCard label="Funded traders" icon={<Trophy />} value={<span className="k-num">{int(data.funded)}</span>} chip={`${usdK(data.fundedCapital)} simulated capital`} chipTone="gold" href="/prop/funded" delay={0.08} />
            <KpiCard
              label="Fees vs paid · 30d"
              icon={<CircleDollarSign />}
              value={<span className="k-num">{usd(data.fees30d, 0)}</span>}
              footer={
                <div className="flex items-center gap-1.5">
                  <Chip size="sm" tone="gold">
                    Paid {usd(data.paid30d, 0)}
                  </Chip>
                  {data.fees30d > 0 && <Chip size="sm">{((data.paid30d / data.fees30d) * 100).toFixed(0)}% ratio</Chip>}
                </div>
              }
              delay={0.12}
            />
            <KpiCard label="Payouts pending" icon={<CircleDollarSign />} value={<span className={cn("k-num", data.payoutsPending > 0 && "text-warn")}>{int(data.payoutsPending)}</span>} chip={usd(data.payoutsPendingAmount)} chipTone={data.payoutsPending ? "warn" : "neutral"} href="/prop/payouts" delay={0.04} />
            <KpiCard label="Open strategy flags" icon={<ShieldAlert />} value={<span className={cn("k-num", data.flagsOpen > 0 && "text-warn")}>{int(data.flagsOpen)}</span>} chip="Banned-strategy review" chipTone={data.flagsOpen ? "warn" : "neutral"} href="/prop/violations" delay={0.08} />
            <KpiCard label="Breaches · 24h" icon={<XCircle />} value={<span className={cn("k-num", data.breaches24h > 0 && "text-down")}>{int(data.breaches24h)}</span>} chip="Accounts failed by a hard rule" chipTone={data.breaches24h ? "down" : "neutral"} href="/prop/violations" delay={0.12} />
            <KpiCard label="Net fees · 30d" icon={<Percent />} value={<span className={cn("k-num", data.fees30d - data.paid30d < 0 && "text-down")}>{usd(data.fees30d - data.paid30d, 0)}</span>} chip="Fees collected less payouts" delay={0.16} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.05} className="xl:col-span-5">
              <BreachReasons reasons={data.breachReasons} />
            </Reveal>
            <Reveal delay={0.1} className="xl:col-span-7">
              <PlanStrip plans={plans.data?.plans ?? null} />
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-4">
            <Card>
              <CardHeader title="Desks" subtitle="Where the day-to-day work happens" />
              <div className="grid grid-cols-1 gap-2 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
                {[
                  { href: "/prop/challenges", icon: Activity, title: "Challenges", text: "Live rule state of every account, manual pass / fail" },
                  { href: "/prop/violations", icon: ShieldAlert, title: "Violations", text: "Breaches log and banned-strategy review" },
                  { href: "/prop/certificates", icon: Award, title: "Certificates", text: "Pass, funded and payout certificates, revoke" },
                  { href: "/prop/news", icon: CalendarClock, title: "News calendar", text: "High-impact events for the news-window rule" },
                ].map((d) => (
                  <Link key={d.href} href={d.href} className="k-row flex items-start gap-3 px-4 py-3.5 transition-colors hover:border-[var(--k-border-top)]">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">
                      <d.icon />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium">{d.title}</span>
                      <span className="block text-[12px] text-fg-3">{d.text}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}

function BreachReasons({ reasons }: { reasons: Overview["breachReasons"] }) {
  const total = reasons.reduce((s, r) => s + r.count, 0);
  return (
    <Card className="h-full">
      <CardHeader title="Breach reasons" subtitle="Hard-rule failures · last 30 days" action={<Chip>{int(total)}</Chip>} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {reasons.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-fg-3">No breaches in the last 30 days.</div>
        ) : (
          <div className="space-y-3">
            {reasons.map((r) => {
              const share = total ? (r.count / total) * 100 : 0;
              return (
                <div key={r.rule}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-fg-2">{ruleLabel(r.rule)}</span>
                    <span className="k-num text-fg">
                      {int(r.count)} <span className="text-fg-3">· {share.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-down/80" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function PlanStrip({ plans }: { plans: PlanRow[] | null }) {
  return (
    <Card className="h-full">
      <CardHeader title="Plans" subtitle="Sales and outcomes per plan · 30 days" action={<Link href="/prop/plans" className="text-[12.5px] text-fg-3 hover:text-fg">Open plan builder</Link>} />
      <div className="overflow-x-auto px-4 pb-6 pt-4 sm:px-6">
        {!plans ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <table className="w-full min-w-[520px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                <th className="pb-2 font-medium">Plan</th>
                <th className="pb-2 text-right font-medium">Active</th>
                <th className="pb-2 text-right font-medium">Sold 30d</th>
                <th className="pb-2 text-right font-medium">Revenue 30d</th>
                <th className="pb-2 text-right font-medium">Pass rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plans
                .filter((p) => p.status !== "archived")
                .map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <PlanTypeChip type={p.type} />
                        <span className="truncate">{p.name}</span>
                        {p.status !== "active" && <span className="text-[11px] capitalize text-fg-3">{p.status}</span>}
                      </span>
                    </td>
                    <td className="k-num py-2.5 text-right">{int(p.stats?.active)}</td>
                    <td className="k-num py-2.5 text-right">{int(p.stats?.sold30d)}</td>
                    <td className="k-num py-2.5 text-right">{usd(p.stats?.revenue30d, 0)}</td>
                    <td className="k-num py-2.5 text-right">{p.stats?.passRate === null || p.stats?.passRate === undefined ? "—" : pct(p.stats.passRate)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

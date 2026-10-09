"use client";

// /staking: how staking works, the risk disclosure and the plans on sale. A plan shows its limits, the client's own
// room and past settled monthly rates (never a rate for the current or a future month).

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, HandCoins, Lock, PieChart, PiggyBank, Undo2 } from "lucide-react";
import { AnimIcon, Button, Card, CardHeader, Chip, EmptyState, PageHeader, Reveal, Skeleton, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { useStaking, type Plan, type PlansDoc } from "./api";
import { LoadError, RiskNote, useStakingFormat } from "./ui";
import { SubscribeDialog } from "./subscribe";

function HowItWorks() {
  const t = useT();
  const steps = [
    { icon: PiggyBank, tone: "ember" as const, title: t("staking.how.step1.title"), text: t("staking.how.step1.text") },
    { icon: Lock, tone: "gold" as const, title: t("staking.how.step2.title"), text: t("staking.how.step2.text") },
    { icon: HandCoins, tone: "up" as const, title: t("staking.how.step3.title"), text: t("staking.how.step3.text") },
    { icon: Undo2, tone: "info" as const, title: t("staking.how.step4.title"), text: t("staking.how.step4.text") },
  ];
  return (
    <Card>
      <CardHeader title={t("staking.how.title")} />
      <div className="grid grid-cols-1 gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        {steps.map((s, i) => (
          <div key={i} className="k-row flex items-start gap-3 p-4">
            <AnimIcon icon={s.icon} tone={s.tone} size={40} />
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium">
                <span className="me-1.5 text-fg-3">{i + 1}.</span>
                {s.title}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlanCard({ plan, onSubscribe }: { plan: Plan; onSubscribe: () => void }) {
  const t = useT();
  const fx = useStakingFormat();
  const money = (v: number | null) => (v === null ? t("staking.plan.noLimit") : fx.amount(v, plan.currency));
  const paused = plan.status === "paused";
  const full = !paused && (plan.full || (plan.maxNow !== null && plan.maxNow < plan.minAmount));
  const rows: [string, string][] = [
    [t("staking.plan.minimum"), money(plan.minAmount)],
    [t("staking.plan.maximum"), money(plan.maxAmount)],
  ];
  if (plan.capacityLeft !== null) rows.push([t("staking.plan.capacityLeft"), money(plan.capacityLeft)]);
  if (plan.maxNow !== null && plan.perUserMax !== null) rows.push([t("staking.plan.room"), money(Math.max(0, plan.maxNow))]);
  if (plan.invested > 0) rows.push([t("staking.plan.invested"), money(plan.invested)]);
  return (
    <div className={cn("k-card flex h-full flex-col p-5", (paused || full) && "opacity-90")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold tracking-tight">{plan.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone="ember">
              <CalendarClock className="size-3" /> {t("staking.plan.term", { count: plan.termMonths })}
            </Chip>
            <Chip size="sm" tone="neutral">
              {plan.currency}
            </Chip>
            {paused && (
              <Chip size="sm" tone="warn" dot>
                {t("staking.plan.paused")}
              </Chip>
            )}
            {full && (
              <Chip size="sm" tone="down" dot>
                {t("staking.plan.full")}
              </Chip>
            )}
          </div>
        </div>
        <AnimIcon icon={PiggyBank} tone="gold" size={44} />
      </div>
      {plan.description && <p className="mt-3 text-[12.5px] leading-relaxed text-fg-2">{plan.description}</p>}
      <dl className="mt-4 divide-y divide-line rounded-[12px] border border-line bg-surface-2/50 px-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
            <dt className="text-fg-3">{k}</dt>
            <dd className="k-num text-end font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <div className="text-[11.5px] text-fg-3">{t("staking.plan.pastReturns")}</div>
        {plan.recentRates.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {plan.recentRates.map((r) => (
              <span key={r.period} className="k-num rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-fg-2">
                {fx.month(r.period)} · <span className="font-medium text-fg">{fx.rate(r.ratePct)}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-[12.5px] text-fg-2">{t("staking.plan.noPastReturns")}</div>
        )}
        <p className="mt-1.5 text-[11px] text-fg-3">{t("staking.plan.pastNote")}</p>
      </div>
      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-fg-3">
          <HandCoins className="size-3.5" /> {t("staking.plan.paidMonthly")}
        </div>
        <Button variant="ember" className="w-full" disabled={paused || full} onClick={onSubscribe} title={paused ? t("staking.plan.pausedText") : full ? t("staking.plan.fullText") : undefined}>
          {t("staking.plan.subscribe")} <ArrowRight className="rtl:-scale-x-100" />
        </Button>
        {(paused || full) && <p className="mt-2 text-center text-[11.5px] text-fg-3">{paused ? t("staking.plan.pausedText") : t("staking.plan.fullText")}</p>}
      </div>
    </div>
  );
}

export function StakingPlans() {
  const t = useT();
  const { data, error, reload } = useStaking<PlansDoc>("plans");
  const [selected, setSelected] = React.useState<Plan | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="pb-16">
      <PageHeader
        title={t("staking.plans.title")}
        subtitle={t("staking.plans.subtitle")}
        actions={
          <Link href="/staking/portfolio">
            <Button variant="surface">
              <PieChart /> {t("staking.plans.myStaking")}
            </Button>
          </Link>
        }
      />
      <div className="space-y-4">
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal delay={0.05}>
          <RiskNote />
        </Reveal>
        {error && !data ? (
          <LoadError error={error} onRetry={reload} title={t("staking.plans.loadError")} />
        ) : !data ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[420px] w-full rounded-[24px]" />
            ))}
          </div>
        ) : data.plans.length === 0 ? (
          <Card>
            <EmptyState art="emptyPosition" title={t("staking.plans.emptyTitle")} text={t("staking.plans.emptyText")} />
          </Card>
        ) : (
          <Reveal delay={0.1}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  onSubscribe={() => {
                    setSelected(p);
                    setOpen(true);
                  }}
                />
              ))}
            </div>
          </Reveal>
        )}
      </div>
      {selected && <SubscribeDialog plan={selected} open={open} onOpenChange={setOpen} onDone={reload} />}
    </div>
  );
}

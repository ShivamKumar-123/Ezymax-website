"use client";

// /staking/portfolio: invested, returns paid, next payout and maturity; monthly returns; positions with a detail
// drawer (monthly returns of the position and the terms the client accepted).

import * as React from "react";
import Link from "next/link";
import { CalendarClock, HandCoins, Lock, PiggyBank, Wallet } from "lucide-react";
import { Button, Card, CardHeader, CapsuleBars, DataTable, Dialog, EmptyState, KpiCard, PageHeader, Progress, Reveal, Skeleton, type Column } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { useStaking, type Portfolio, type Position, type PositionDetail } from "./api";
import { LoadError, PositionStatusChip, RiskNote, Rows, useStakingFormat } from "./ui";

function PositionDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const t = useT();
  const fx = useStakingFormat();
  const { data, error } = useStaking<PositionDetail>(id !== null ? `positions/${id}` : null);
  const d = data && data.position.id === id ? data : null;
  const p = d?.position;
  const money = (v: number) => fx.amount(v, p?.currency);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()} side="right" title={p ? t("staking.position.title", { plan: p.planName, id: p.id }) : `#${id ?? ""}`} description={p ? t("staking.plan.term", { count: p.termMonths }) : undefined}>
      {error && !d ? (
        <p className="text-[13px] text-down">{error.message}</p>
      ) : !d || !p ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <PositionStatusChip status={p.status} />
            <span className="k-num text-[20px] font-semibold">{money(p.principal)}</span>
          </div>
          {p.status === "payment_failed" && <p className="rounded-[12px] border border-down/25 bg-down-soft px-3.5 py-2.5 text-[12.5px]">{t("staking.position.failed", { reason: p.failureReason ?? "—" })}</p>}
          {p.status === "pending_payment" && <p className="rounded-[12px] border border-info/25 bg-info-soft px-3.5 py-2.5 text-[12.5px]">{t("staking.position.pendingText")}</p>}
          {p.startedAt && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-fg-3">
                <span>{t("staking.term.progress", { elapsed: p.daysElapsed, total: p.daysTotal })}</span>
                <span>{p.status === "matured" ? t("staking.term.matured", { date: fx.date(p.maturedAt ?? p.maturesAt) }) : t("staking.term.matures", { date: fx.date(p.maturesAt) })}</span>
              </div>
              <Progress value={p.daysTotal ? (p.daysElapsed / p.daysTotal) * 100 : 0} tone={p.status === "matured" ? "up" : "gold"} className="h-2" />
            </div>
          )}
          <Rows
            rows={[
              [t("staking.position.started"), fx.date(p.startedAt)],
              [p.status === "matured" ? t("staking.position.matured") : t("staking.position.matures"), fx.date(p.maturedAt ?? p.maturesAt)],
              [t("staking.col.returnsPaid"), <span key="r" className="text-up">{money(p.returnsPaid)}</span>],
            ]}
          />
          {p.status === "active" && (
            <div className="flex items-center gap-2 text-[12px] text-fg-3">
              <Lock className="size-3.5 text-gold" /> {t("staking.position.locked")}
            </div>
          )}
          <div>
            <div className="k-label mb-2">{t("staking.position.returns")}</div>
            {d.returns.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">{t("staking.position.noReturns")}</p>
            ) : (
              <div className="overflow-x-auto rounded-[14px] border border-line">
                <table className="w-full min-w-[420px] text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-start text-[11px] text-fg-3">
                      <th className="px-3 py-2 text-start font-medium">{t("staking.col.month")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("staking.col.rate")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("staking.col.days")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("staking.col.amount")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("staking.col.status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {d.returns.map((r) => (
                      <tr key={r.period}>
                        <td className="px-3 py-2">{fx.month(r.period)}</td>
                        <td className="k-num px-3 py-2 text-end">{fx.rate(r.ratePct)}</td>
                        <td className="k-num px-3 py-2 text-end text-fg-3">
                          {r.daysActive}/{r.daysInMonth}
                        </td>
                        <td className="k-num px-3 py-2 text-end font-medium text-up">{money(r.amount)}</td>
                        <td className="px-3 py-2 text-end text-fg-3">{t.dyn(`staking.return.${r.status}`, r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <div className="k-label mb-2">{t("staking.position.terms")}</div>
            <p className="mb-2 text-[12px] text-fg-3">{t("staking.position.acceptedAt", { date: fx.dateTime(p.termsAcceptedAt) })}</p>
            {d.terms.description && <p className="mb-3 text-[12.5px] text-fg-2">{d.terms.description}</p>}
            <RiskNote planText={d.terms.riskText} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Monthly returns as capsules: each month keeps room for its label, so a long history scrolls sideways on a phone,
 * opened at the latest month. The scroller clips, so the padding leaves room for the value tip above the tallest
 * month and beside the first and last one. */
function MonthlyBars({ data, format }: { data: { label: string; value: number }[]; format: (v: number) => string }) {
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = getComputedStyle(el).direction === "rtl" ? -el.scrollWidth : el.scrollWidth;
  }, [data.length]);
  return (
    <div ref={scroller} className="-mx-4 overflow-x-auto sm:-mx-6">
      <div className="px-8 pt-8 sm:px-10" style={{ minWidth: data.length * 56 + 64 }}>
        <CapsuleBars height={200} data={data} format={format} />
      </div>
    </div>
  );
}

export function StakingPortfolio() {
  const t = useT();
  const fx = useStakingFormat();
  const { data, error, reload } = useStaking<Portfolio>("portfolio", 60_000);
  const [sel, setSel] = React.useState<number | null>(null);

  if (error && !data) {
    return (
      <div className="pb-16">
        <PageHeader title={t("staking.portfolio.title")} subtitle={t("staking.portfolio.subtitle")} />
        <LoadError error={error} onRetry={reload} />
      </div>
    );
  }

  const s = data?.summary;
  const money = (v: number) => fx.amount(v, s?.currency);
  const cols: Column<Position>[] = [
    {
      key: "plan",
      header: t("staking.col.plan"),
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block truncate text-[13px] font-medium">{p.planName}</span>
          <span className="block font-mono text-[11px] text-fg-3">#{p.id}</span>
        </span>
      ),
      csv: (p) => p.planName,
    },
    { key: "principal", header: t("staking.col.principal"), align: "right", cell: (p) => <span className="k-num font-medium">{money(p.principal)}</span>, sort: (p) => p.principal, csv: (p) => p.principal },
    {
      key: "term",
      header: t("staking.col.term"),
      hideOn: "md",
      cell: (p) =>
        p.startedAt ? (
          <span className="block w-40">
            <Progress value={p.daysTotal ? (p.daysElapsed / p.daysTotal) * 100 : 0} tone={p.status === "matured" ? "up" : "gold"} className="h-1.5" />
            <span className="mt-1 block text-[11px] text-fg-3">{p.status === "matured" ? t("staking.term.matured", { date: fx.date(p.maturedAt ?? p.maturesAt) }) : t("staking.term.matures", { date: fx.date(p.maturesAt) })}</span>
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
      sort: (p) => p.maturesAt ?? "",
    },
    { key: "paid", header: t("staking.col.returnsPaid"), align: "right", cell: (p) => <span className="k-num text-up">{money(p.returnsPaid)}</span>, sort: (p) => p.returnsPaid, csv: (p) => p.returnsPaid },
    {
      key: "last",
      header: t("staking.col.lastReturn"),
      hideOn: "lg",
      cell: (p) => <span className="k-num text-[12px] text-fg-2">{p.lastReturn ? t("staking.lastReturn.value", { month: fx.month(p.lastReturn.period), rate: fx.rate(p.lastReturn.ratePct), amount: money(p.lastReturn.amount) }) : t("staking.lastReturn.none")}</span>,
    },
    { key: "status", header: t("staking.col.status"), cell: (p) => <PositionStatusChip status={p.status} />, csv: (p) => p.status },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title={t("staking.portfolio.title")}
        subtitle={t("staking.portfolio.subtitle")}
        actions={
          <Link href="/staking">
            <Button variant="ember">
              <PiggyBank /> {t("staking.portfolio.browsePlans")}
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] w-full rounded-[24px]" />)
        ) : (
          <>
            <KpiCard
              label={t("staking.kpi.invested")}
              value={money(s.invested)}
              icon={<Wallet />}
              chip={t("staking.kpi.active", { count: s.activePositions })}
              chipTone="ember"
              footer={s.pending > 0 ? <span className="text-[12px] text-fg-3">{t("staking.kpi.pending", { amount: money(s.pending) })}</span> : undefined}
              hot
            />
            <KpiCard label={t("staking.kpi.returnsPaid")} value={money(s.returnsPaid)} icon={<HandCoins />} chip={t("staking.kpi.thisYear", { amount: money(s.returnsThisYear) })} chipTone="up" delay={0.05} />
            <KpiCard
              label={t("staking.kpi.nextPayout")}
              value={s.nextPayout ? t("staking.kpi.nextPayoutValue", { month: fx.month(s.nextPayout.period) }) : t("staking.kpi.none")}
              icon={<CalendarClock />}
              footer={s.nextPayout ? <span className="text-[12px] text-fg-3">{t("staking.kpi.nextPayoutText", { month: fx.month(s.nextPayout.period) })}</span> : undefined}
              delay={0.1}
            />
            <KpiCard
              label={t("staking.kpi.nextMaturity")}
              value={s.nextMaturity ? fx.date(s.nextMaturity.date) : t("staking.kpi.none")}
              icon={<Lock />}
              chipTone="gold"
              chip={s.nextMaturity?.planName}
              footer={s.nextMaturity ? <span className="text-[12px] text-fg-3">{t("staking.kpi.nextMaturityText", { amount: money(s.nextMaturity.principal) })}</span> : undefined}
              delay={0.15}
            />
          </>
        )}
      </div>

      <Reveal delay={0.1}>
        <Card className="mt-4">
          <CardHeader title={t("staking.monthly.title")} subtitle={t("staking.monthly.subtitle")} />
          <div className="px-4 pb-5 sm:px-6">
            {!data ? (
              <Skeleton className="h-[200px] w-full" />
            ) : data.monthly.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-fg-3">{t("staking.monthly.empty")}</p>
            ) : (
              <MonthlyBars data={data.monthly.map((m) => ({ label: fx.month(m.period), value: m.amount }))} format={(v) => money(v)} />
            )}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="mt-4">
          <CardHeader title={t("staking.positions.title")} />
          <div className="px-4 pb-5 sm:px-6">
            {!data ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <DataTable
                columns={cols}
                rows={data.positions}
                pageSize={10}
                rowKey={(p) => String(p.id)}
                onRowClick={(p) => setSel(p.id)}
                exportName="staking-positions"
                empty={
                  <EmptyState
                    art="emptyPosition"
                    title={t("staking.positions.emptyTitle")}
                    text={t("staking.positions.emptyText")}
                    action={
                      <Link href="/staking">
                        <Button variant="ember">
                          <PiggyBank /> {t("staking.portfolio.browsePlans")}
                        </Button>
                      </Link>
                    }
                  />
                }
              />
            )}
          </div>
        </Card>
      </Reveal>
      <PositionDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}

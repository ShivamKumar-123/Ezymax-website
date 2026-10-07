"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Check, Clock, Loader2, Receipt, Rocket, ShieldAlert, Trophy, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, EmptyState, KpiCard, Money, PageHeader, Reveal, Skeleton, cn, type Column } from "@/components/kit";
import { useT } from "@kalks/i18n/react";
import {
  blockerText,
  fmtDate,
  fmtDateTime,
  payoutFreqLabel,
  propApi,
  sizeLabel,
  usd,
  usePropPoll,
  type Challenge,
  type FundedAccount,
  type Payout,
} from "./api";
import { ErrorNote, LoadError, PropTradeButton, Tile } from "./ui";

type PayoutsData = { payouts: Payout[]; funded: FundedAccount[]; kycStatus: string };

const PAYOUT_STATUS = {
  pending: { labelKey: "prop.payoutStatus.pending", tone: "warn" },
  approved: { labelKey: "prop.payoutStatus.approved", tone: "info" },
  paid: { labelKey: "prop.payoutStatus.paid", tone: "up" },
  rejected: { labelKey: "prop.payoutStatus.rejected", tone: "down" },
  failed: { labelKey: "prop.payoutStatus.failed", tone: "down" },
} as const satisfies Record<Payout["status"], { labelKey: string; tone: "warn" | "info" | "up" | "down" }>;

/* ------------------------------------------------------------------ */
/* KYC                                                                 */
/* ------------------------------------------------------------------ */

function KycBanner({ status }: { status: string }) {
  const t = useT();
  if (status === "verified")
    return (
      <div className="flex items-center gap-3 rounded-[16px] border border-up/25 bg-up-soft px-4 py-3 text-up">
        <BadgeCheck className="size-[18px] shrink-0" />
        <div className="text-[13.5px] font-medium">{t("prop.kyc.verified")}</div>
      </div>
    );
  const text =
    status === "pending"
      ? t("prop.kyc.pendingText")
      : status === "rejected"
        ? t("prop.kyc.rejectedText")
        : t("prop.kyc.requiredText");
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-warn/30 bg-warn-soft px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3 text-warn">
        <ShieldAlert className="mt-0.5 size-[18px] shrink-0" />
        <div>
          <div className="text-[13.5px] font-medium">{status === "pending" ? t("prop.kyc.pendingTitle") : t("prop.kyc.requiredTitle")}</div>
          <div className="mt-0.5 text-[12.5px] text-fg-2">{text}</div>
        </div>
      </div>
      {status !== "pending" && (
        <Link href="/profile/verification" className="shrink-0">
          <Button size="sm" variant="surface">
            {t("prop.errorLink.verify")} <ArrowRight className="rtl:-scale-x-100" />
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funded account + quote                                              */
/* ------------------------------------------------------------------ */

function RequestDialog({ f, open, onOpenChange, onDone }: { f: FundedAccount; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  React.useEffect(() => {
    if (open) setErr(null);
  }, [open]);
  const q = f.quote;
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await propApi<{ payout: Payout }>(`challenges/${f.challengeId}/payouts`, { body: {} });
      toast.success(t("prop.request.toastTitle"), { description: t("prop.request.toastText", { amount: usd(r.payout.total) }) });
      onOpenChange(false);
      onDone();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("prop.requestPayout")}
      description={`${f.planName} · ${sizeLabel(f.size)}${f.login ? ` · #${f.login}` : ""}`}
      width={500}
      footer={
        <>
          <Button variant="surface" disabled={busy} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" /> : <Banknote />} {t("prop.request.submit", { amount: usd(q.total) })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="divide-y divide-line rounded-[14px] border border-line px-4 text-[13px]">
          {[
            [t("prop.request.profit"), usd(q.profit)],
            [t("prop.request.share", { pct: q.split }), usd(q.traderAmount)],
            ...(q.feeRefund > 0 ? [[t("prop.request.feeRefund"), usd(q.feeRefund)]] : []),
            [t("prop.request.total"), <span key="t" className="text-up">{usd(q.total)}</span>],
          ].map(([k, v], i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-fg-3">{k}</dt>
              <dd className="k-num font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12.5px] text-fg-3">
          {t("prop.request.note")}
        </p>
        <ErrorNote error={err} />
      </div>
    </Dialog>
  );
}

function FundedCard({ f, plan, kyc, onDone }: { f: FundedAccount; plan: Challenge["plan"] | null; kyc: string; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const q = f.quote;
  const blockers = q.blockers ?? [];
  return (
    <Card>
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="gold" size="sm" className="font-semibold tracking-wider">
              {t("prop.fundedBadge")}
            </Chip>
            <Chip size="sm">{f.planName}</Chip>
          </div>
          <div className="mt-3 text-[22px] font-semibold tracking-tight">{t("prop.sizeAccount", { size: sizeLabel(f.size) })}</div>
          {f.login && (
            <div dir="ltr" className="mt-1 flex items-center gap-1 font-mono text-[12px] text-fg-2">
              #{f.login} · Kalks-Live
              <CopyButton value={String(f.login)} label={t("prop.cred.login")} />
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Tile label={t("common.balance")} value={usd(f.balance)} />
            <Tile label={t("common.equity")} value={usd(f.equity)} />
            <Tile label={t("prop.funded.eligibleFrom")} value={q.eligibleFrom ? fmtDate(q.eligibleFrom) : "—"} />
            <Tile label={t("prop.funded.minPayout")} value={usd(q.minPayout, 0)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/prop/mine?id=${f.challengeId}`}>
              <Button size="sm" variant="surface">
                {t("prop.funded.rulesDashboard")} <ArrowUpRight className="rtl:-scale-x-100" />
              </Button>
            </Link>
            <PropTradeButton login={f.login} />
          </div>
        </div>

        <div className="min-w-0 rounded-[18px] border border-line bg-surface-2/50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-medium">{t("prop.funded.quote")}</div>
            <Chip size="sm" tone={q.eligible ? "up" : "neutral"}>
              {q.eligible ? t("prop.funded.eligibleNow") : t("prop.funded.notEligible")}
            </Chip>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <Money value={q.total} countUp={false} className="text-[34px] font-semibold tracking-[-0.02em]" />
            <span className="text-[12.5px] text-fg-3">{t("prop.funded.toWallet")}</span>
          </div>
          <dl className="mt-3 divide-y divide-line text-[13px]">
            {[
              [t("prop.profit"), usd(q.profit)],
              [t("prop.funded.yourSplit"), `${q.split}% · ${usd(q.traderAmount)}`],
              [t("prop.funded.firmShare"), usd(q.firmAmount)],
              [t("prop.feeRefund"), q.feeRefund > 0 ? usd(q.feeRefund) : f.refundFee ? (f.feeRefunded ? t("prop.funded.alreadyRefunded") : t("prop.funded.withFirstPayout")) : t("prop.funded.notRefundable")],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-fg-3">{k}</dt>
                <dd className="k-num text-end font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {blockers.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {blockers.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                  <Clock className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                  <span>
                    {blockerText(b)}
                    {b === "not_yet_eligible" && q.eligibleFrom ? ` ${t("prop.funded.opens", { date: fmtDateTime(q.eligibleFrom) })}` : ""}
                    {b === "below_minimum" ? ` ${t("prop.funded.minimum", { amount: usd(q.minPayout, 0) })}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* the prop service refuses a payout request until the identity is verified (kyc_required) */}
          {kyc !== "verified" && q.eligible && <p className="mt-3 text-[12px] text-warn">{t("prop.funded.kycNote")}</p>}
          <Button variant="gold" className="mt-4 w-full" disabled={!q.eligible || kyc !== "verified"} onClick={() => setOpen(true)}>
            <Banknote /> {t("prop.requestPayout")}
          </Button>
          {plan && (
            <div className="mt-3 text-[11.5px] text-fg-3">
              {t("prop.funded.cycle", { freq: payoutFreqLabel(plan.payoutFreq), days: t("prop.days", { count: plan.firstPayoutDays }) })}
            </div>
          )}
        </div>
      </div>
      <RequestDialog f={f} open={open} onOpenChange={setOpen} onDone={onDone} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Scaling plan                                                        */
/* ------------------------------------------------------------------ */

function ScalingCard({ plan, size }: { plan: Challenge["plan"]; size: number }) {
  const t = useT();
  const steps: number[] = [];
  let s = size;
  for (let i = 0; i < 5 && s < plan.scalingCap; i++) {
    s = Math.min(plan.scalingCap, Math.round(s * (1 + plan.scalingIncrease / 100)));
    steps.push(s);
  }
  return (
    <Card className="h-full">
      <CardHeader title={t("prop.scaling.title")} subtitle={t("prop.scaling.subtitle", { plan: plan.name })} icon={<Rocket />} />
      <div className="space-y-4 px-4 pb-6 pt-4 sm:px-6">
        <p className="text-[13px] text-fg-2">
          {t("prop.scaling.text", { profit: plan.scalingProfit, months: t("prop.months", { count: plan.scalingEvery }), increase: plan.scalingIncrease, cap: usd(plan.scalingCap, 0), split: plan.split, max: plan.splitMax })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="k-row px-3 py-2 text-[13px] font-semibold">{sizeLabel(size)}</span>
          {steps.map((x) => (
            <React.Fragment key={x}>
              <ArrowRight className="size-3.5 text-fg-3 rtl:-scale-x-100" />
              <span className="k-row px-3 py-2 text-[13px] font-medium text-fg-2">{sizeLabel(x)}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label={t("prop.scaling.reviewEvery")} value={t("prop.scaling.monthsShort", { n: plan.scalingEvery })} />
          <Tile label={t("prop.scaling.profitNeeded")} value={`${plan.scalingProfit}%`} />
          <Tile label={t("prop.scaling.increase")} value={`+${plan.scalingIncrease}%`} />
          <Tile label={t("prop.scaling.cap")} value={sizeLabel(plan.scalingCap)} />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

function History({ rows }: { rows: Payout[] }) {
  const t = useT();
  const cols: Column<Payout>[] = [
    { key: "req", header: t("prop.history.requested"), cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.requestedAt)}</span>, sort: (r) => r.requestedAt, csv: (r) => r.requestedAt },
    {
      key: "acct",
      header: t("prop.history.account"),
      cell: (r) => (
        <span>
          <span className="block text-[13px] font-medium">
            {r.planName} · {sizeLabel(r.size)}
          </span>
          {r.login && <span className="block font-mono text-[11px] text-fg-3">#{r.login}</span>}
        </span>
      ),
      csv: (r) => `${r.planName} ${r.size}`,
    },
    { key: "profit", header: t("prop.profit"), align: "right", hideOn: "md", cell: (r) => <span className="k-num">{usd(r.profit)}</span>, sort: (r) => r.profit, csv: (r) => r.profit },
    { key: "split", header: t("prop.history.split"), align: "right", hideOn: "lg", cell: (r) => <span className="k-num text-fg-2">{r.split}%</span>, csv: (r) => r.split },
    { key: "refund", header: t("prop.feeRefund"), align: "right", hideOn: "lg", cell: (r) => <span className="k-num text-fg-2">{r.feeRefund > 0 ? usd(r.feeRefund) : "—"}</span>, csv: (r) => r.feeRefund },
    { key: "total", header: t("prop.history.toWallet"), align: "right", cell: (r) => <span className="k-num font-semibold">{usd(r.total)}</span>, sort: (r) => r.total, csv: (r) => r.total },
    {
      key: "status",
      header: t("common.status"),
      align: "right",
      cell: (r) => {
        const m = PAYOUT_STATUS[r.status];
        const s = m ? { label: t(m.labelKey), tone: m.tone } : { label: r.status, tone: "info" as const };
        return (
          <span className="inline-flex flex-col items-end gap-0.5">
            <Chip size="sm" tone={s.tone}>
              {s.label}
            </Chip>
            {r.note && (r.status === "rejected" || r.status === "failed") && <span className="max-w-[220px] truncate text-[11px] text-fg-3">{r.note}</span>}
          </span>
        );
      },
      csv: (r) => r.status,
    },
  ];
  return (
    <Card>
      <CardHeader title={t("prop.history.title")} subtitle={t("prop.history.subtitle")} icon={<Receipt />} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        <DataTable
          columns={cols}
          rows={rows}
          pageSize={10}
          exportName="prop-payouts"
          rowKey={(r) => String(r.id)}
          empty={<div className="py-8 text-center text-[13px] text-fg-3">{t("prop.history.empty")}</div>}
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LivePropPayouts() {
  const t = useT();
  const { data, error, loading, reload } = usePropPoll<PayoutsData>("payouts", 15_000);
  const ch = usePropPoll<{ challenges: Challenge[] }>("challenges", 0);
  const planOf = (id: number) => ch.data?.challenges.find((c) => c.id === id)?.plan ?? null;
  const payouts = data?.payouts ?? [];
  const funded = data?.funded ?? [];
  const paid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.total, 0);
  const pending = payouts.filter((p) => p.status === "pending" || p.status === "approved").reduce((s, p) => s + p.total, 0);
  const available = funded.filter((f) => f.quote.eligible).reduce((s, f) => s + f.quote.total, 0);
  const firstFunded = funded[0] ?? null;
  const scalingPlan = firstFunded ? planOf(firstFunded.challengeId) : null;

  return (
    <div className="pb-24">
      <PageHeader
        title={t("prop.payouts.title")}
        subtitle={t("prop.payouts.subtitle")}
        actions={
          <Link href="/prop/mine">
            <Button variant="surface" size="lg">
              <Trophy /> {t("prop.myChallenges")}
            </Button>
          </Link>
        }
      />

      {error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[60px] w-full rounded-[16px]" />
          <Skeleton className="h-[300px] w-full rounded-[20px]" />
        </div>
      ) : (
        <>
          <KycBanner status={data!.kycStatus} />

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label={t("prop.payouts.available")} icon={<Wallet />} value={<Money value={available} countUp={false} />} chip={t("prop.payouts.eligibleCount", { eligible: funded.filter((f) => f.quote.eligible).length, count: funded.length })} />
            <KpiCard label={t("prop.payoutStatus.pending")} icon={<Clock />} value={<Money value={pending} countUp={false} />} chip={t("prop.payouts.requests", { count: payouts.filter((p) => p.status === "pending" || p.status === "approved").length })} chipTone="warn" delay={0.03} />
            <KpiCard label={t("prop.payouts.paidToDate")} icon={<Check />} value={<Money value={paid} countUp={false} />} chip={t("prop.payouts.payoutsCount", { count: payouts.filter((p) => p.status === "paid").length })} chipTone="up" delay={0.06} />
          </div>

          <div className="mt-4 space-y-4">
            {funded.length === 0 ? (
              <Card>
                <EmptyState
                  art="propPassed"
                  title={t("prop.payouts.emptyTitle")}
                  text={t("prop.payouts.emptyText")}
                  action={
                    <Link href="/prop/mine">
                      <Button variant="surface">
                        {t("prop.myChallenges")} <ArrowRight className="rtl:-scale-x-100" />
                      </Button>
                    </Link>
                  }
                />
              </Card>
            ) : (
              funded.map((f) => (
                <Reveal key={f.challengeId}>
                  <FundedCard f={f} plan={planOf(f.challengeId)} kyc={data!.kycStatus} onDone={reload} />
                </Reveal>
              ))
            )}
          </div>

          <div className={cn("mt-4 grid grid-cols-1 gap-4", scalingPlan && "xl:grid-cols-12")}>
            <div className={cn(scalingPlan && "xl:col-span-8")}>
              <History rows={payouts} />
            </div>
            {scalingPlan && firstFunded && (
              <div className="xl:col-span-4">
                <ScalingCard plan={scalingPlan} size={firstFunded.size} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

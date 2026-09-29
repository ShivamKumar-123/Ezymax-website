"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Award,
  Banknote,
  CalendarCheck,
  CalendarDays,
  CandlestickChart,
  CircleDollarSign,
  Clock,
  Coins,
  Gauge as GaugeIcon,
  History,
  Info,
  LineChart,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, EmptyState, Gauge, KpiCard, Money, PageHeader, Progress, Reveal, Segmented, Skeleton, Stepper, SymbolAvatar, cn, type Column } from "@kalks/ui";
import type { T } from "@kalks/i18n";
import { Trans, useT } from "@kalks/i18n/react";
import {
  CHALLENGE_STATUS,
  bannedLabel,
  challengeStatusLabel,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  planSteps,
  ruleLabel,
  sizeLabel,
  stageLabel,
  stepIndex,
  usd,
  usePropPoll,
  type Challenge,
  type ChallengeDetail,
  type EquityPoint,
  type LiveRules,
  type PhaseAccount,
  type RuleEvent,
  type Trade,
} from "./api";
import { PropEquityLine, type ChartLine } from "./equity-chart";
import { LoadError, PropTradeButton, RuleTile, Tile, daysLeft, hms, signedUsd, useCountdown, type RuleState } from "./ui";

/* ------------------------------------------------------------------ */
/* Derived rule view (falls back to plan terms before the first check)  */
/* ------------------------------------------------------------------ */

type View = LiveRules & { initial: number; live: boolean };

function viewOf(c: Challenge, a: PhaseAccount): View {
  const init = a.initialBalance;
  const r = a.rules;
  const eq = a.equity ?? r?.equity ?? init;
  const bal = a.balance ?? r?.balance ?? init;
  if (r) return { ...r, equity: eq, balance: bal, initial: init, live: true };
  const dl = (init * c.plan.dailyLoss) / 100;
  const dd = (init * c.plan.maxDD) / 100;
  return {
    day: "",
    dailyLimit: dl,
    dailyRef: init,
    dailyFloor: init - dl,
    dailyUsed: 0,
    ddLimit: dd,
    ddFloor: init - dd,
    ddUsed: 0,
    hwm: init,
    profit: eq - init,
    targetAmount: a.targetPct !== null ? (init * a.targetPct) / 100 : null,
    targetReached: false,
    tradingDays: a.tradingDays,
    minDays: a.minDays,
    daysOk: a.tradingDays >= a.minDays,
    bestDay: null,
    consistencyLimit: null,
    consistencyOk: true,
    deadline: a.timeLimitDays ? new Date(new Date(a.startedAt).getTime() + a.timeLimitDays * 86_400_000).toISOString() : null,
    verdict: { kind: "ok" },
    warn: null,
    nextReset: "",
    weekendWindow: false,
    equity: eq,
    balance: bal,
    at: "",
    initial: init,
    live: false,
  };
}

const ratio = (a: number, b: number) => (b > 0 ? Math.max(0, (a / b) * 100) : 0);
const loadTone = (p: number) => (p >= 90 ? "down" : p >= 50 ? "warn" : "up") as "down" | "warn" | "up";

/* ------------------------------------------------------------------ */
/* Selector                                                            */
/* ------------------------------------------------------------------ */

function progressOf(c: Challenge) {
  const a = c.current;
  if (!a) return 0;
  const v = viewOf(c, a);
  if (a.funded || !v.targetAmount) return ratio(Math.max(0, v.profit), (a.initialBalance * c.plan.maxDD) / 100);
  return ratio(Math.max(0, v.profit), v.targetAmount);
}

function Selector({ list, value, onChange }: { list: Challenge[]; value: number; onChange: (id: number) => void }) {
  const t = useT();
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {list.map((c) => {
        const on = c.id === value;
        const st = CHALLENGE_STATUS[c.status] ?? { tone: "neutral" as const };
        const a = c.current;
        const v = a ? viewOf(c, a) : null;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={on}
            className={cn("min-w-[260px] flex-1 snap-start rounded-[18px] border p-4 text-start transition-colors", on ? "border-ember/40 bg-ember-soft" : "border-line bg-surface hover:border-[var(--k-border-top)] hover:bg-surface-2")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[17px] font-semibold tracking-tight">{sizeLabel(c.size)}</div>
                <div className="whitespace-nowrap text-[11.5px] text-fg-3">
                  {c.planName}
                  {a?.login ? <span className="font-mono"> · #{a.login}</span> : null}
                </div>
              </div>
              <Chip size="sm" tone={st.tone}>
                {stageLabel(c)}
              </Chip>
            </div>
            {v && (
              <>
                <div className="mt-3.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-fg-3">{a!.funded ? t("prop.profit") : t("prop.rule.profitTarget")}</span>
                  <span className="k-num font-medium text-fg">
                    {usd(v.profit, 0)}
                    {!a!.funded && v.targetAmount ? <span className="text-fg-3"> / {usd(v.targetAmount, 0)}</span> : null}
                  </span>
                </div>
                <Progress value={progressOf(c)} tone={c.status === "failed" ? "down" : c.status === "funded" ? "gold" : "ember"} className="mt-1.5" />
              </>
            )}
          </button>
        );
      })}
      <Link href="/prop" className="grid min-w-[150px] place-items-center rounded-[18px] border border-dashed border-line px-4 text-center text-[13px] text-fg-3 transition-colors hover:border-ember/40 hover:text-ember">
        <span className="flex flex-col items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full border border-line">
            <Plus className="size-4" />
          </span>
          {t("prop.mine.newChallenge")}
        </span>
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview + daily reset                                              */
/* ------------------------------------------------------------------ */

function tradable(c: Challenge, a: PhaseAccount) {
  return a.status === "active" && (c.status === "active" || c.status === "funded") && c.current?.id === a.id;
}

function accountStateChip(t: T, c: Challenge, a: PhaseAccount) {
  if (tradable(c, a)) return <Chip size="sm" tone="up">{t("prop.account.enabled")}</Chip>;
  if (a.status === "passed") return <Chip size="sm" tone="up">{t("prop.account.passed")}</Chip>;
  if (a.status === "failed") return <Chip size="sm" tone="down">{t("prop.account.failed")}</Chip>;
  if (a.status === "provisioning") return <Chip size="sm" tone="info">{t("prop.account.opening")}</Chip>;
  return <Chip size="sm">{t("prop.status.closed")}</Chip>;
}

function Overview({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: View }) {
  const t = useT();
  const steps = planSteps(c.plan);
  const deadline = v.deadline;
  return (
    <Card className="h-full">
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" tone={CHALLENGE_STATUS[c.status]?.tone ?? "neutral"}>
              {challengeStatusLabel(c.status)}
            </Chip>
            <Chip size="sm">{a.phase}</Chip>
          </div>
          <div className="mt-3 text-[20px] font-medium tracking-tight">
            {c.planName} · {sizeLabel(c.size)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { i: <Coins />, l: t("prop.mine.initialBalance"), v: usd(a.initialBalance, 0) },
              { i: <GaugeIcon />, l: t("prop.mine.drawdown"), v: `${t.dyn(`prop.ddType.${c.plan.ddType}`, c.plan.ddType)} ${c.plan.maxDD}%` },
              { i: <CandlestickChart />, l: t("prop.leverage"), v: `1:${c.leverage}` },
              { i: <Coins />, l: t("prop.history.split"), v: `${c.split}%` },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1.5 ps-1.5 pe-3.5">
                <span className="grid size-7 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{x.i}</span>
                <span>
                  <span className="block text-[9.5px] leading-none text-fg-3">{x.l}</span>
                  <span className="k-num text-[12.5px] font-medium">{x.v}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="k-label mb-3 mt-6">{t("prop.mine.progress")}</div>
          <Stepper steps={steps} current={stepIndex(c)} />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <CalendarDays className="size-4 text-fg-3" />
              <div>
                <div className="text-[10.5px] text-fg-3">{t("prop.mine.phaseStarted")}</div>
                <div className="text-[13px] font-medium">{fmtDate(a.startedAt)}</div>
              </div>
            </div>
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <CalendarCheck className="size-4 text-fg-3" />
              <div>
                <div className="text-[10.5px] text-fg-3">{a.endedAt ? t("prop.mine.ended") : t("prop.mine.deadline")}</div>
                <div className="text-[13px] font-medium">{a.endedAt ? fmtDate(a.endedAt) : deadline ? fmtDate(deadline) : t("prop.noTimeLimit")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-[18px] border border-line bg-surface-2/50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-medium">{t("prop.mine.tradingAccount")}</div>
            {accountStateChip(t, c, a)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[11px] text-fg-3">{t("prop.cred.login")}</div>
              <div className="flex h-10 items-center gap-1 rounded-[12px] border border-line bg-surface-2 ps-3 pe-1.5">
                <span dir="ltr" className="min-w-0 flex-1 truncate text-start font-mono text-[13px]">{a.login ?? "—"}</span>
                {a.login && <CopyButton value={String(a.login)} label={t("prop.cred.login")} />}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-fg-3">{t("prop.cred.server")}</div>
              <div className="flex h-10 items-center rounded-[12px] border border-line bg-surface-2 px-3 text-[13px]">Kalks-Live</div>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-fg-3">
            {tradable(c, a)
              ? t("prop.account.tradableText")
              : a.status === "passed"
                ? t("prop.account.passedText")
                : a.status === "failed"
                  ? t("prop.account.failedText")
                  : t("prop.account.unavailableText")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PropTradeButton login={a.login} disabled={!tradable(c, a)} reason={t("prop.account.onlyActive")} />
            <Link href="/support">
              <Button size="sm" variant="surface">
                {t("prop.mine.support")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ResetCard({ v, active }: { v: View; active: boolean }) {
  const t = useT();
  const ms = useCountdown(v.nextReset || null);
  const left = Math.max(0, v.dailyLimit - v.dailyUsed);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("prop.reset.title")} subtitle={t("prop.reset.subtitle")} icon={<Timer />} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <div className="text-[13px] text-fg-2">{active ? t("prop.reset.todayIn") : t("prop.reset.nextIn")}</div>
        <div dir="ltr" className="k-num mt-2 font-mono text-[40px] font-semibold tracking-tight">{hms(ms)}</div>
        <div className="mt-1 text-[11.5px] text-fg-3">{t("prop.reset.note")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        <Tile label={t("prop.reset.permitted")} value={usd(v.dailyLimit)} />
        <Tile label={t("prop.reset.remaining")} value={<span className={left <= 0 ? "text-down" : "text-up"}>{usd(left)}</span>} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Banners                                                             */
/* ------------------------------------------------------------------ */

function Banner({ tone, icon, title, text, action }: { tone: "down" | "warn" | "info" | "up" | "gold"; icon: React.ReactNode; title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode }) {
  const cls = {
    down: "border-down/30 bg-down-soft text-down",
    warn: "border-warn/30 bg-warn-soft text-warn",
    info: "border-info/25 bg-info-soft text-info",
    up: "border-up/25 bg-up-soft text-up",
    gold: "border-gold/30 bg-gold-soft text-gold",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-[16px] border px-4 py-3 sm:flex-row sm:items-center", cls)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 shrink-0 [&_svg]:size-[18px]">{icon}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">{title}</div>
          {text && <div className="mt-0.5 text-[12.5px] text-fg-2">{text}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 ps-7 sm:ps-0">{action}</div>}
    </div>
  );
}

function Banners({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: View }) {
  const t = useT();
  const items: React.ReactNode[] = [];
  const cert = c.certificates.find((x) => !x.revoked && x.kind === "pass" && x.phase === a.phase) ?? (a.funded ? c.certificates.find((x) => !x.revoked && x.kind === "funded") : undefined);
  if (c.status === "pending_payment" || c.status === "provisioning")
    items.push(<Banner key="prov" tone="info" icon={<Info />} title={t("prop.banner.openingTitle")} text={t("prop.banner.openingText")} />);
  if (c.status === "payment_failed") items.push(<Banner key="pf" tone="down" icon={<AlertTriangle />} title={t("prop.status.paymentFailed")} text={c.failureReason ?? t("prop.error.paymentFailed")} />);
  if (a.status === "failed")
    items.push(
      <Banner
        key="fail"
        tone="down"
        icon={<ShieldAlert />}
        title={a.endedAt ? t("prop.banner.failedOn", { phase: a.phase, date: fmtDateTime(a.endedAt) }) : t("prop.banner.failed", { phase: a.phase })}
        text={t("prop.banner.failedText", { reason: a.endReason ?? c.failureReason ?? t("prop.banner.ruleBreached") })}
        action={
          <Link href="/prop">
            <Button size="sm" variant="surface">
              {t("prop.banner.startNew")}
            </Button>
          </Link>
        }
      />,
    );
  if (a.status === "passed")
    items.push(
      <Banner
        key="pass"
        tone="up"
        icon={<ShieldCheck />}
        title={a.endedAt ? t("prop.banner.passedOn", { phase: a.phase, date: fmtDate(a.endedAt) }) : t("prop.banner.passed", { phase: a.phase })}
        text={c.current && c.current.id !== a.id ? (c.current.login ? t("prop.banner.nextOpenLogin", { phase: c.current.phase, login: c.current.login }) : t("prop.banner.nextOpen", { phase: c.current.phase })) : t("prop.banner.nextOpening")}
        action={
          cert ? (
            <a href={`/verify/${cert.code}`} target="_blank" rel="noopener">
              <Button size="sm" variant="surface">
                <Award /> {t("prop.verify.row.certificate")}
              </Button>
            </a>
          ) : undefined
        }
      />,
    );
  if (tradable(c, a) && v.live && v.dailyLimit > 0 && v.dailyUsed / v.dailyLimit >= 0.5)
    items.push(
      <Banner
        key="warn"
        tone="warn"
        icon={<AlertTriangle />}
        title={t("prop.banner.lossUsed", { pct: Math.round((v.dailyUsed / v.dailyLimit) * 100) })}
        text={t("prop.banner.lossUsedText", { floor: usd(v.dailyFloor), left: usd(Math.max(0, v.dailyLimit - v.dailyUsed)) })}
      />,
    );
  if (tradable(c, a) && v.weekendWindow && !c.plan.weekendHolding)
    items.push(<Banner key="wk" tone="info" icon={<Info />} title={t("prop.banner.weekendTitle")} text={t("prop.banner.weekendText")} />);
  if (a.funded && a.status === "active" && c.payout)
    items.push(
      <Banner
        key="pay"
        tone="gold"
        icon={<Banknote />}
        title={c.payout.eligible ? t("prop.banner.payoutAvailable", { amount: usd(c.payout.total) }) : t("prop.mine.payouts")}
        text={c.payout.eligible ? t("prop.banner.payoutProfit", { profit: usd(c.payout.profit), pct: c.payout.split }) : c.payout.eligibleFrom ? t("prop.banner.payoutNext", { date: fmtDate(c.payout.eligibleFrom) }) : t("prop.banner.payoutLater")}
        action={
          <Link href="/prop/payouts">
            <Button size="sm" variant="gold">
              {t("prop.mine.payouts")}
            </Button>
          </Link>
        }
      />,
    );
  if (!items.length) return null;
  return <div className="mt-4 space-y-2">{items}</div>;
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

function Rules({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: View }) {
  const t = useT();
  const ended = a.status !== "active";
  const failedRule = a.status === "failed" ? (a.endReason ?? "").toLowerCase() : "";
  const dailyPct = ratio(v.dailyUsed, v.dailyLimit);
  const ddPct = ratio(v.ddUsed, v.ddLimit);
  const tPct = v.targetAmount ? ratio(Math.max(0, v.profit), v.targetAmount) : 0;
  const now = Date.now();
  const left = daysLeft(v.deadline, now);
  const cons = c.plan.consistency > 0;
  const st = (breached: boolean, met: boolean): RuleState => (breached ? "failed" : met ? "passed" : ended ? "off" : "ok");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <RuleTile
        icon={<GaugeIcon />}
        title={t("prop.dailyLossLimit")}
        state={st(failedRule.includes("daily"), false)}
        progress={dailyPct}
        tone={loadTone(dailyPct)}
        left={<Trans k="prop.tile.used" vars={{ v: usd(v.dailyUsed), max: usd(v.dailyLimit) }} tags={{ v: (x) => <span className="k-num text-fg">{x}</span> }} />}
        right={`${dailyPct.toFixed(1)}%`}
        rows={[
          [t("prop.tile.limit"), `${c.plan.dailyLoss}% · ${usd(v.dailyLimit)}`],
          [t("prop.tile.reference"), `${usd(v.dailyRef)} · ${t.dyn(`prop.basis.${c.plan.dailyBasis}`, c.plan.dailyBasis)}`],
          [t("prop.tile.breachLevel"), usd(v.dailyFloor), "down"],
        ]}
      />
      <RuleTile
        icon={<ShieldAlert />}
        title={t("prop.rule.maxDrawdown")}
        state={st(failedRule.includes("drawdown"), false)}
        progress={ddPct}
        tone={loadTone(ddPct)}
        left={<Trans k="prop.tile.used" vars={{ v: usd(v.ddUsed), max: usd(v.ddLimit) }} tags={{ v: (x) => <span className="k-num text-fg">{x}</span> }} />}
        right={`${ddPct.toFixed(1)}%`}
        rows={[
          [t("common.type"), c.plan.ddType === "trailing" ? (c.plan.trailingLock ? t("prop.tile.trailingLocks") : t("prop.tile.trailing")) : t("prop.tile.static")],
          [t("prop.tile.hwm"), usd(v.hwm)],
          [t("prop.tile.breachLevel"), usd(v.ddFloor), "down"],
        ]}
      />
      {a.funded ? (
        <RuleTile
          icon={<Wallet />}
          title={t("prop.verify.kind.payout")}
          state={c.payout?.eligible ? "passed" : ended ? "off" : "ok"}
          rows={[
            [t("prop.profit"), signedUsd(v.profit), v.profit >= 0 ? "up" : "down"],
            [t("prop.funded.yourSplit"), `${c.split}%`],
            [t("prop.funded.eligibleFrom"), c.payout?.eligibleFrom ? fmtDate(c.payout.eligibleFrom) : "—"],
          ]}
          footer={
            <Link href="/prop/payouts" className="block">
              <Button size="sm" variant="gold" className="w-full">
                {t("prop.mine.payouts")}
              </Button>
            </Link>
          }
        />
      ) : (
        <RuleTile
          icon={<Target />}
          title={t("prop.rule.profitTarget")}
          state={st(false, v.targetReached || a.status === "passed")}
          progress={tPct}
          tone={v.targetReached ? "up" : "ember"}
          left={<Trans k="prop.tile.of" vars={{ v: usd(v.profit), max: usd(v.targetAmount ?? 0) }} tags={{ v: (x) => <span className="k-num text-fg">{x}</span> }} />}
          right={`${Math.min(100, tPct).toFixed(1)}%`}
          rows={[
            [t("prop.tile.target"), `${a.targetPct ?? 0}% · ${usd(v.targetAmount ?? 0)}`],
            [t("prop.tile.mustReach"), usd(v.initial + (v.targetAmount ?? 0))],
            [v.profit >= (v.targetAmount ?? 0) ? t("prop.tile.exceededBy") : t("prop.tile.leftToTarget"), usd(Math.abs((v.targetAmount ?? 0) - v.profit))],
          ]}
        />
      )}
      <RuleTile
        icon={<CalendarDays />}
        title={t("prop.tile.tradingDays")}
        state={v.minDays === 0 ? "off" : st(false, v.daysOk)}
        progress={v.minDays ? ratio(Math.min(v.tradingDays, v.minDays), v.minDays) : 100}
        tone={v.daysOk ? "up" : "ember"}
        left={<Trans k="prop.tile.daysOf" vars={{ v: v.tradingDays, min: v.minDays }} tags={{ v: (x) => <span className="k-num text-fg">{x}</span> }} />}
        right={v.daysOk ? t("prop.ruleState.passed") : t("prop.tile.toGo", { n: Math.max(0, v.minDays - v.tradingDays) })}
        rows={[
          [t("prop.tile.minimum"), v.minDays ? t("prop.days", { count: v.minDays }) : t("prop.none")],
          [t("prop.tile.traded"), t("prop.days", { count: v.tradingDays }), v.daysOk ? "up" : undefined],
          [t("prop.tile.countsWhen"), t("prop.tile.countsWhenText")],
        ]}
      />
      <RuleTile
        icon={<Clock />}
        title={t("prop.rule.timeLimit")}
        state={v.deadline ? st(failedRule.includes("time"), false) : "off"}
        progress={v.deadline && a.timeLimitDays ? ratio(a.timeLimitDays * 86_400_000 - (left ?? 0), a.timeLimitDays * 86_400_000) : undefined}
        tone="ember"
        left={v.deadline ? t("prop.tile.timeUsed") : undefined}
        right={left !== null ? t("prop.tile.timeLeft", { d: Math.floor(left / 86_400_000), h: Math.floor((left % 86_400_000) / 3_600_000) }) : undefined}
        rows={[
          [t("prop.rule.timeLimit"), a.timeLimitDays ? t("prop.days", { count: a.timeLimitDays }) : t("prop.noTimeLimit")],
          [t("prop.tile.started"), fmtDate(a.startedAt)],
          [t("prop.mine.deadline"), v.deadline ? fmtDateTime(v.deadline) : "—"],
        ]}
      />
      <RuleTile
        icon={<LineChart />}
        title={t("prop.rule.consistency")}
        state={cons ? st(false, v.consistencyOk && v.profit > 0) : "off"}
        progress={cons && v.consistencyLimit ? ratio(Math.max(0, v.bestDay ?? 0), v.consistencyLimit) : undefined}
        tone={v.consistencyOk ? "up" : "warn"}
        left={cons ? t("prop.tile.bestVsLimit") : undefined}
        right={cons && v.consistencyLimit ? `${usd(v.bestDay ?? 0, 0)} / ${usd(v.consistencyLimit, 0)}` : undefined}
        rows={
          cons
            ? [
                [t("prop.compare.rule"), t("prop.rules.consistencyValue", { pct: c.plan.consistency })],
                [t("prop.tile.bestDay"), usd(v.bestDay ?? 0)],
                [t("common.status"), v.consistencyOk ? t("prop.tile.withinLimit") : t("prop.tile.holdsPass"), v.consistencyOk ? "up" : "warn"],
              ]
            : [
                [t("prop.compare.rule"), t("prop.tile.noConsistency")],
                [t("prop.newsTrading"), c.plan.newsTrading ? t("prop.allowed") : t("prop.tile.newsBlocked", { min: c.plan.newsWindow })],
                [t("prop.rule.weekendHolding"), c.plan.weekendHolding ? t("prop.allowed") : t("prop.tile.weekendClosed")],
              ]
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Equity + drawdown                                                   */
/* ------------------------------------------------------------------ */

function EquityCard({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: View }) {
  const t = useT();
  const eq = usePropPoll<{ points: EquityPoint[]; initialBalance: number }>(`challenges/${c.id}/equity?phase=${a.phaseIndex}&limit=2000`, tradable(c, a) ? 30_000 : 0);
  const [mode, setMode] = React.useState<"Equity" | "Balance">("Equity");
  const data = React.useMemo(() => {
    const pts = (eq.data?.points ?? []).map((p) => ({ t: new Date(p.at).getTime(), v: mode === "Equity" ? p.equity : p.balance }));
    // extend with the latest live value so the chart is current between samples
    if (tradable(c, a) && pts.length) pts.push({ t: Date.now(), v: mode === "Equity" ? v.equity : v.balance });
    return pts.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((x, y) => x.t - y.t);
  }, [eq.data, mode, v.equity, v.balance, c, a]);
  const lines: ChartLine[] = [
    { value: v.ddFloor, label: `${t("prop.rule.maxDrawdown")} ${usd(v.ddFloor, 0)}`, tone: "down" },
    { value: v.initial, label: t("prop.chart.startingBalance"), tone: "muted" },
  ];
  if (v.dailyFloor > v.ddFloor && tradable(c, a)) lines.push({ value: v.dailyFloor, label: `${t("prop.rule.dailyLoss")} ${usd(v.dailyFloor, 0)}`, tone: "warn" });
  if (!a.funded && v.targetAmount) lines.push({ value: v.initial + v.targetAmount, label: `${t("prop.rule.profitTarget")} ${usd(v.initial + v.targetAmount, 0)}`, tone: "gold" });
  const shown = mode === "Equity" ? v.equity : v.balance;
  const diff = shown - v.initial;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-3 px-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="k-label">{mode === "Equity" ? t("prop.chart.accountEquity") : t("prop.chart.accountBalance")}</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} countUp={false} className="text-[30px] font-semibold tracking-tight" />
            <Chip tone={diff >= 0 ? "up" : "down"}>
              {signedUsd(diff)} ({((diff / (v.initial || 1)) * 100).toFixed(2)}%)
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">{t("prop.chart.since", { date: fmtDate(a.startedAt) })}</div>
        </div>
        <Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "Equity" as const, label: t("common.equity") }, { value: "Balance" as const, label: t("common.balance") }]} />
      </div>
      <div className="px-3 pb-4 pt-3 sm:px-4">{eq.loading ? <Skeleton className="h-[300px] w-full rounded-[14px]" /> : <PropEquityLine data={data} lines={lines} height={300} />}</div>
    </Card>
  );
}

function DrawdownCard({ c, v }: { c: ChallengeDetail; v: View }) {
  const t = useT();
  const p = ratio(v.ddUsed, v.ddLimit);
  const tone = p < 50 ? "up" : p < 75 ? "warn" : "down";
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("prop.mine.drawdown")}
        subtitle={t("prop.dd.subtitle", { type: c.plan.ddType === "trailing" ? t("prop.tile.trailing") : t("prop.tile.static"), pct: c.plan.maxDD })}
        action={
          <Chip tone={tone}>
            {tone === "up" ? t("prop.dd.safe") : tone === "warn" ? t("prop.dd.caution") : t("prop.dd.danger")}
          </Chip>
        }
      />
      <div className="flex flex-1 items-center justify-center py-3">
        <Gauge value={Math.min(100, p)} max={100} display={`${p.toFixed(1)}%`} label={t("prop.dd.used")} sublabel={<span className="text-fg-3">{t("prop.dd.ofLimit", { used: usd(v.ddUsed, 0), limit: usd(v.ddLimit, 0) })}</span>} size={210} />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        <Tile label={t("prop.dd.breachLevel")} value={usd(v.ddFloor, 0)} tone="down" />
        <Tile label={t("prop.dd.roomLeft")} value={usd(Math.max(0, v.equity - v.ddFloor), 0)} tone="up" />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Objectives, events, trades                                          */
/* ------------------------------------------------------------------ */

function Objectives({ a }: { a: PhaseAccount }) {
  const t = useT();
  const s = a.stats;
  const stats: { l: string; v: string; t?: "up" | "down" }[] = [
    { l: t("prop.stats.trades"), v: String(s?.trades ?? 0) },
    { l: t("prop.stats.openNow"), v: String(s?.open ?? a.openPositions ?? 0) },
    { l: t("prop.stats.winRate"), v: s?.winRate !== null && s?.winRate !== undefined ? `${s.winRate}%` : "—" },
    { l: t("prop.stats.avgWin"), v: usd(s?.avgWin ?? 0), t: "up" },
    { l: t("prop.stats.avgLoss"), v: usd(s?.avgLoss ?? 0), t: "down" },
    { l: t("prop.stats.profitFactor"), v: s?.profitFactor !== null && s?.profitFactor !== undefined ? s.profitFactor.toFixed(2) : "—" },
    { l: t("prop.stats.lots"), v: (s?.lots ?? 0).toFixed(2) },
  ];
  return (
    <Card>
      <CardHeader title={t("prop.stats.title")} subtitle={s?.bestDay ? t("prop.stats.bestDay", { date: fmtDate(s.bestDay.day), amount: usd(s.bestDay.profit) }) : t("prop.stats.subtitle")} icon={<LineChart />} />
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-4 sm:px-6 xl:grid-cols-7">
        {stats.map((x) => (
          <Tile key={x.l} label={x.l} value={x.v} tone={x.t} />
        ))}
      </div>
    </Card>
  );
}

const SEV: Record<string, { tone: "down" | "warn" | "info" | "up" | "neutral" }> = {
  breach: { tone: "down" },
  violation: { tone: "warn" },
  warning: { tone: "warn" },
  info: { tone: "info" },
};

function Events({ events }: { events: RuleEvent[] }) {
  const t = useT();
  return (
    <Card className="h-full">
      <CardHeader title={t("prop.events.title")} subtitle={t("prop.events.subtitle")} icon={<ShieldAlert />} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        {events.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-3">{t("prop.events.empty")}</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const s = { label: SEV[e.severity] ? t.dyn(`prop.severity.${e.severity}`, e.severity) : e.severity, tone: SEV[e.severity]?.tone ?? ("neutral" as const) };
              const kind = e.rule === "banned_strategy" && e.details && typeof e.details === "object" && "kind" in e.details ? bannedLabel(String((e.details as { kind: unknown }).kind)) : null;
              return (
                <li key={e.id} className="k-row flex items-start gap-3 px-3.5 py-3">
                  <Chip size="sm" tone={s.tone} className="mt-0.5">
                    {s.label}
                  </Chip>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">
                      {ruleLabel(e.rule)}
                      {kind ? ` · ${kind}` : ""}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-fg-2">{e.message}</div>
                    <div className="mt-1 text-[11px] text-fg-3">
                      {fmtDateTime(e.at)}
                      {e.login ? ` · #${e.login}` : ""}
                      {e.equity !== null ? ` · ${t("prop.events.equity", { amount: usd(e.equity) })}` : ""}
                      {e.threshold !== null ? ` · ${t("prop.events.limit", { amount: usd(e.threshold) })}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Trades({ c, a }: { c: ChallengeDetail; a: PhaseAccount }) {
  const t = useT();
  const tq = usePropPoll<{ trades: Trade[] }>(`challenges/${c.id}/trades?phase=${a.phaseIndex}`, tradable(c, a) ? 15_000 : 0);
  const rows = tq.data?.trades ?? [];
  const net = rows.reduce((s, r) => s + r.profit, 0);
  const cols: Column<Trade>[] = [
    {
      key: "sym",
      header: t("prop.trades.symbol"),
      cell: (r) => (
        <span className="flex items-center gap-3">
          <SymbolAvatar symbol={r.symbol} size={24} />
          <span>
            <span className="block text-[13px] font-medium">{r.symbol}</span>
            <span className="block font-mono text-[11px] text-fg-3">#{r.ticket}</span>
          </span>
        </span>
      ),
      csv: (r) => r.symbol,
    },
    { key: "side", header: t("common.type"), cell: (r) => <Chip size="sm" tone={r.side === "buy" ? "up" : "down"}>{r.side === "buy" ? t("prop.trades.buy") : t("prop.trades.sell")}</Chip>, csv: (r) => r.side },
    { key: "vol", header: t("prop.trades.lots"), align: "right", cell: (r) => <span className="k-num">{r.volume.toFixed(2)}</span>, sort: (r) => r.volume },
    { key: "open", header: t("prop.trades.openTime"), cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.openTime)}</span>, hideOn: "md", sort: (r) => r.openTime, csv: (r) => r.openTime },
    { key: "close", header: t("prop.trades.closeTime"), cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.closeTime)}</span>, hideOn: "lg", sort: (r) => r.closeTime, csv: (r) => r.closeTime },
    { key: "op", header: t("prop.trades.open"), align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{r.openPrice}</span>, hideOn: "lg", csv: (r) => r.openPrice },
    { key: "cp", header: t("prop.trades.close"), align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{r.closePrice}</span>, hideOn: "lg", csv: (r) => r.closePrice },
    { key: "dur", header: t("prop.trades.duration"), align: "right", cell: (r) => <span className="text-fg-3">{fmtDuration(r.durationSecs)}</span>, hideOn: "md", sort: (r) => r.durationSecs, csv: (r) => r.durationSecs },
    { key: "pnl", header: t("prop.profit"), align: "right", sort: (r) => r.profit, csv: (r) => r.profit, cell: (r) => <span className={cn("k-num font-semibold", r.profit >= 0 ? "text-up" : "text-down")}>{signedUsd(r.profit)}</span> },
  ];
  return (
    <Card>
      <CardHeader title={t("prop.trades.title")} subtitle={tq.loading ? t("common.loading") : t("prop.trades.subtitle", { count: rows.length, net: signedUsd(net) })} icon={<History />} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {tq.loading ? (
          <Skeleton className="h-40 w-full rounded-[14px]" />
        ) : tq.error && !tq.data ? (
          <div className="py-8 text-center text-[13px] text-fg-3">{tq.error.message}</div>
        ) : (
          <DataTable
            columns={cols}
            rows={rows}
            pageSize={10}
            search={(r) => `${r.symbol} ${r.ticket}`}
            exportName={a.login ? `prop-${a.login}-trades` : "prop-trades"}
            rowKey={(r) => String(r.ticket)}
            empty={<div className="py-8 text-center text-[13px] text-fg-3">{t("prop.trades.empty")}</div>}
          />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function sortChallenges(list: Challenge[]) {
  const rank = (c: Challenge) => (c.status === "active" ? 0 : c.status === "funded" ? 0 : c.status === "provisioning" || c.status === "pending_payment" ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || b.id - a.id);
}

function Dashboard({ id }: { id: number }) {
  const t = useT();
  const { data: c, error, reload } = usePropPoll<ChallengeDetail>(`challenges/${id}`, 2000);
  const [phaseIdx, setPhaseIdx] = React.useState<number | null>(null);
  React.useEffect(() => setPhaseIdx(null), [id]);

  if (error && !c) return <div className="mt-4"><LoadError error={error} onRetry={reload} title={t("prop.mine.loadError")} /></div>;
  if (!c || c.id !== id)
    return (
      <div className="mt-4 space-y-4">
        <Skeleton className="h-[300px] w-full rounded-[20px]" />
        <Skeleton className="h-[220px] w-full rounded-[20px]" />
      </div>
    );

  const a = (phaseIdx !== null ? c.phases.find((p) => p.phaseIndex === phaseIdx) : null) ?? c.current ?? c.phases[c.phases.length - 1];
  if (!a)
    return (
      <Card className="mt-4">
        <EmptyState illustration="hourglass_not_done" title={t("prop.banner.openingTitle")} text={c.status === "payment_failed" ? c.failureReason ?? t("prop.mine.paymentFailedText") : t("prop.mine.openingText")} />
      </Card>
    );
  const v = viewOf(c, a);
  const today = v.equity - v.dailyRef;
  const live = tradable(c, a);

  return (
    <>
      {c.phases.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] text-fg-3">{t("prop.mine.phase")}</span>
          <Segmented
            size="xs"
            value={String(a.phaseIndex)}
            onChange={(x) => setPhaseIdx(Number(x))}
            options={c.phases.map((p) => ({ value: String(p.phaseIndex), label: <>{p.phase} <span className="text-fg-3">{p.status === "active" ? `· ${t("prop.mine.live")}` : `· ${t.dyn(`prop.phaseStatus.${p.status}`, p.status)}`}</span></> }))}
          />
        </div>
      )}

      <Banners c={c} a={a} v={v} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Overview c={c} a={a} v={v} />
        </div>
        <div className="xl:col-span-4">
          <ResetCard v={v} active={live} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("common.balance")} icon={<Wallet />} value={<Money value={v.balance} countUp={false} />} chip={t("prop.kpi.vsStart", { pct: `${v.balance >= v.initial ? "+" : ""}${(((v.balance - v.initial) / (v.initial || 1)) * 100).toFixed(2)}` })} chipTone={v.balance >= v.initial ? "up" : "down"} />
        <KpiCard label={t("common.equity")} icon={<LineChart />} value={<Money value={v.equity} countUp={false} />} chip={t("prop.kpi.floating", { amount: signedUsd(v.equity - v.balance) })} chipTone={v.equity >= v.balance ? "up" : "down"} delay={0.03} />
        <KpiCard label={t("prop.profit")} icon={<TrendingUp />} value={<Money value={v.profit} signed tone="auto" countUp={false} />} chip={a.funded ? t("prop.kpi.yours", { pct: c.split }) : v.targetAmount ? t("prop.kpi.ofTarget", { pct: Math.min(999, ratio(Math.max(0, v.profit), v.targetAmount)).toFixed(0) }) : "—"} chipTone={a.funded ? "gold" : "ember"} delay={0.06} />
        <KpiCard label={t("prop.kpi.todayPl")} icon={<CircleDollarSign />} value={<Money value={live ? today : 0} signed tone="auto" countUp={false} />} chip={`${t("prop.kpi.open", { count: a.openPositions })} · ${t("prop.kpi.tradingDays", { count: v.tradingDays })}`} delay={0.09} />
      </div>

      <div className="mt-4">
        <Rules c={c} a={a} v={v} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <EquityCard key={`${c.id}-${a.phaseIndex}`} c={c} a={a} v={v} />
        </div>
        <div className="xl:col-span-4">
          <DrawdownCard c={c} v={v} />
        </div>
      </div>

      <div className="mt-4">
        <Objectives a={a} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <Events events={c.events.filter((e) => e.accountId === a.id)} />
        </div>
        <div className="xl:col-span-7">
          <Trades key={`${c.id}-${a.phaseIndex}`} c={c} a={a} />
        </div>
      </div>
    </>
  );
}

function Inner() {
  const t = useT();
  const sp = useSearchParams();
  const router = useRouter();
  const { data, error, loading, reload } = usePropPoll<{ challenges: Challenge[] }>("challenges", 10_000);
  const list = React.useMemo(() => sortChallenges(data?.challenges ?? []), [data]);
  const q = Number(sp.get("id"));
  const id = list.some((c) => c.id === q) ? q : list[0]?.id ?? null;
  const select = (x: number) => router.replace(`/prop/mine?id=${x}`, { scroll: false });

  return (
    <div className="pb-24">
      <PageHeader
        title={t("prop.myChallenges")}
        subtitle={t("prop.mine.subtitle")}
        actions={
          <>
            <Link href="/prop/payouts">
              <Button variant="surface" size="lg">
                <Banknote /> {t("prop.mine.payouts")}
              </Button>
            </Link>
            <Link href="/prop">
              <Button variant="ember" size="lg">
                <Plus /> {t("prop.mine.newChallenge")}
              </Button>
            </Link>
          </>
        }
      />

      {error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : loading ? (
        <div className="flex gap-3">
          <Skeleton className="h-[120px] min-w-[260px] flex-1 rounded-[18px]" />
          <Skeleton className="h-[120px] min-w-[260px] flex-1 rounded-[18px]" />
        </div>
      ) : list.length === 0 || id === null ? (
        <Card>
          <EmptyState
            illustration="trophy"
            title={t("prop.mine.emptyTitle")}
            text={t("prop.mine.emptyText")}
            action={
              <Link href="/prop">
                <Button variant="ember">
                  {t("prop.browseChallenges")} <Target />
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Reveal>
            <Selector list={list} value={id} onChange={select} />
          </Reveal>
          <Dashboard id={id} />
        </>
      )}
    </div>
  );
}

export function LivePropMine() {
  return (
    <React.Suspense fallback={null}>
      <Inner />
    </React.Suspense>
  );
}

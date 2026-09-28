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
import {
  CHALLENGE_STATUS,
  bannedLabel,
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
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {list.map((c) => {
        const on = c.id === value;
        const st = CHALLENGE_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
        const a = c.current;
        const v = a ? viewOf(c, a) : null;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={on}
            className={cn("min-w-[260px] flex-1 snap-start rounded-[18px] border p-4 text-left transition-colors", on ? "border-ember/40 bg-ember-soft" : "border-line bg-surface hover:border-[var(--k-border-top)] hover:bg-surface-2")}
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
                  <span className="text-fg-3">{a!.funded ? "Profit" : "Profit target"}</span>
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
          New challenge
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

function accountStateChip(c: Challenge, a: PhaseAccount) {
  if (tradable(c, a)) return <Chip size="sm" tone="up">Trading enabled</Chip>;
  if (a.status === "passed") return <Chip size="sm" tone="up">Passed · read-only</Chip>;
  if (a.status === "failed") return <Chip size="sm" tone="down">Failed · disabled</Chip>;
  if (a.status === "provisioning") return <Chip size="sm" tone="info">Opening</Chip>;
  return <Chip size="sm">Closed</Chip>;
}

function Overview({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: View }) {
  const steps = planSteps(c.plan);
  const deadline = v.deadline;
  return (
    <Card className="h-full">
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" tone={CHALLENGE_STATUS[c.status]?.tone ?? "neutral"}>
              {CHALLENGE_STATUS[c.status]?.label ?? c.status}
            </Chip>
            <Chip size="sm">{a.phase}</Chip>
          </div>
          <div className="mt-3 text-[20px] font-medium tracking-tight">
            {c.planName} · {sizeLabel(c.size)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { i: <Coins />, l: "Initial balance", v: usd(a.initialBalance, 0) },
              { i: <GaugeIcon />, l: "Drawdown", v: `${c.plan.ddType} ${c.plan.maxDD}%` },
              { i: <CandlestickChart />, l: "Leverage", v: `1:${c.leverage}` },
              { i: <Coins />, l: "Split", v: `${c.split}%` },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1.5 pl-1.5 pr-3.5">
                <span className="grid size-7 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{x.i}</span>
                <span>
                  <span className="block text-[9.5px] leading-none text-fg-3">{x.l}</span>
                  <span className="k-num text-[12.5px] font-medium">{x.v}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="k-label mb-3 mt-6">Challenge progress</div>
          <Stepper steps={steps} current={stepIndex(c)} />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <CalendarDays className="size-4 text-fg-3" />
              <div>
                <div className="text-[10.5px] text-fg-3">Phase started</div>
                <div className="text-[13px] font-medium">{fmtDate(a.startedAt)}</div>
              </div>
            </div>
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <CalendarCheck className="size-4 text-fg-3" />
              <div>
                <div className="text-[10.5px] text-fg-3">{a.endedAt ? "Ended" : "Deadline"}</div>
                <div className="text-[13px] font-medium">{a.endedAt ? fmtDate(a.endedAt) : deadline ? fmtDate(deadline) : "No time limit"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-[18px] border border-line bg-surface-2/50 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-medium">Trading account</div>
            {accountStateChip(c, a)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[11px] text-fg-3">Login</div>
              <div className="flex h-10 items-center gap-1 rounded-[12px] border border-line bg-surface-2 pl-3 pr-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{a.login ?? "—"}</span>
                {a.login && <CopyButton value={String(a.login)} label="Login" />}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-fg-3">Server</div>
              <div className="flex h-10 items-center rounded-[12px] border border-line bg-surface-2 px-3 text-[13px]">Kalks-Live</div>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-fg-3">
            {tradable(c, a)
              ? "Trade opens Kalks Trader signed in to this account. Passwords were shown once at purchase."
              : a.status === "passed"
                ? "This phase is complete. The account is read-only; trade on your next phase."
                : a.status === "failed"
                  ? "Trading on this account is disabled."
                  : "Trading isn't available on this account."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PropTradeButton login={a.login} disabled={!tradable(c, a)} reason="Only the active phase can be traded" />
            <Link href="/support">
              <Button size="sm" variant="surface">
                Support
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ResetCard({ v, active }: { v: View; active: boolean }) {
  const ms = useCountdown(v.nextReset || null);
  const left = Math.max(0, v.dailyLimit - v.dailyUsed);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Daily reset" subtitle="The trading day resets at 17:00 New York" icon={<Timer />} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <div className="text-[13px] text-fg-2">{active ? "Today's loss limit resets in" : "Next reset in"}</div>
        <div className="k-num mt-2 font-mono text-[40px] font-semibold tracking-tight">{hms(ms)}</div>
        <div className="mt-1 text-[11.5px] text-fg-3">resets 17:00 New York (00:00 server time)</div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        <Tile label="Permitted today" value={usd(v.dailyLimit)} />
        <Tile label="Remaining" value={<span className={left <= 0 ? "text-down" : "text-up"}>{usd(left)}</span>} />
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
      {action && <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">{action}</div>}
    </div>
  );
}

function Banners({ c, a, v }: { c: ChallengeDetail; a: PhaseAccount; v: View }) {
  const items: React.ReactNode[] = [];
  const cert = c.certificates.find((x) => !x.revoked && x.kind === "pass" && x.phase === a.phase) ?? (a.funded ? c.certificates.find((x) => !x.revoked && x.kind === "funded") : undefined);
  if (c.status === "pending_payment" || c.status === "provisioning")
    items.push(<Banner key="prov" tone="info" icon={<Info />} title="Your account is being opened" text="The payment is confirmed or being confirmed and the trading account is being set up. This page updates on its own." />);
  if (c.status === "payment_failed") items.push(<Banner key="pf" tone="down" icon={<AlertTriangle />} title="Payment failed" text={c.failureReason ?? "The wallet payment didn't go through. You haven't been charged."} />);
  if (a.status === "failed")
    items.push(
      <Banner
        key="fail"
        tone="down"
        icon={<ShieldAlert />}
        title={`${a.phase} failed${a.endedAt ? ` on ${fmtDateTime(a.endedAt)}` : ""}`}
        text={`${a.endReason ?? c.failureReason ?? "A rule was breached"}. All positions were closed and the account is disabled.`}
        action={
          <Link href="/prop">
            <Button size="sm" variant="surface">
              Start a new challenge
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
        title={`${a.phase} passed${a.endedAt ? ` on ${fmtDate(a.endedAt)}` : ""}`}
        text={c.current && c.current.id !== a.id ? `Your ${c.current.phase} account is open${c.current.login ? ` (#${c.current.login})` : ""}.` : "The next account is being opened."}
        action={
          cert ? (
            <a href={`/verify/${cert.code}`} target="_blank" rel="noopener">
              <Button size="sm" variant="surface">
                <Award /> Certificate
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
        title={`${Math.round((v.dailyUsed / v.dailyLimit) * 100)}% of today's loss limit used`}
        text={`Equity at or below ${usd(v.dailyFloor)} fails the account and closes all positions. Remaining today: ${usd(Math.max(0, v.dailyLimit - v.dailyUsed))}.`}
      />,
    );
  if (tradable(c, a) && v.weekendWindow && !c.plan.weekendHolding)
    items.push(<Banner key="wk" tone="info" icon={<Info />} title="Weekend close" text="This plan doesn't allow holding over the weekend: open positions are closed at Friday 16:45 New York." />);
  if (a.funded && a.status === "active" && c.payout)
    items.push(
      <Banner
        key="pay"
        tone="gold"
        icon={<Banknote />}
        title={c.payout.eligible ? `Payout available: ${usd(c.payout.total)}` : "Payouts"}
        text={c.payout.eligible ? `Profit ${usd(c.payout.profit)} at a ${c.payout.split}% split.` : c.payout.eligibleFrom ? `Next payout window from ${fmtDate(c.payout.eligibleFrom)}.` : "Request a payout once you have eligible profit."}
        action={
          <Link href="/prop/payouts">
            <Button size="sm" variant="gold">
              Payouts
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
        title="Daily loss limit"
        state={st(failedRule.includes("daily"), false)}
        progress={dailyPct}
        tone={loadTone(dailyPct)}
        left={<>Used <span className="k-num text-fg">{usd(v.dailyUsed)}</span> of {usd(v.dailyLimit)}</>}
        right={`${dailyPct.toFixed(1)}%`}
        rows={[
          ["Limit", `${c.plan.dailyLoss}% · ${usd(v.dailyLimit)}`],
          ["Reference at reset", `${usd(v.dailyRef)} · ${c.plan.dailyBasis}`],
          ["Breach level (equity)", usd(v.dailyFloor), "down"],
        ]}
      />
      <RuleTile
        icon={<ShieldAlert />}
        title="Max drawdown"
        state={st(failedRule.includes("drawdown"), false)}
        progress={ddPct}
        tone={loadTone(ddPct)}
        left={<>Used <span className="k-num text-fg">{usd(v.ddUsed)}</span> of {usd(v.ddLimit)}</>}
        right={`${ddPct.toFixed(1)}%`}
        rows={[
          ["Type", c.plan.ddType === "trailing" ? `Trailing${c.plan.trailingLock ? ", locks at start" : ""}` : "Static"],
          ["High-water mark", usd(v.hwm)],
          ["Breach level (equity)", usd(v.ddFloor), "down"],
        ]}
      />
      {a.funded ? (
        <RuleTile
          icon={<Wallet />}
          title="Payout"
          state={c.payout?.eligible ? "passed" : ended ? "off" : "ok"}
          rows={[
            ["Profit", signedUsd(v.profit), v.profit >= 0 ? "up" : "down"],
            ["Your split", `${c.split}%`],
            ["Eligible from", c.payout?.eligibleFrom ? fmtDate(c.payout.eligibleFrom) : "—"],
          ]}
          footer={
            <Link href="/prop/payouts" className="block">
              <Button size="sm" variant="gold" className="w-full">
                Payouts
              </Button>
            </Link>
          }
        />
      ) : (
        <RuleTile
          icon={<Target />}
          title="Profit target"
          state={st(false, v.targetReached || a.status === "passed")}
          progress={tPct}
          tone={v.targetReached ? "up" : "ember"}
          left={<><span className="k-num text-fg">{usd(v.profit)}</span> of {usd(v.targetAmount ?? 0)}</>}
          right={`${Math.min(100, tPct).toFixed(1)}%`}
          rows={[
            ["Target", `${a.targetPct ?? 0}% · ${usd(v.targetAmount ?? 0)}`],
            ["Balance and equity must reach", usd(v.initial + (v.targetAmount ?? 0))],
            [v.profit >= (v.targetAmount ?? 0) ? "Exceeded by" : "Left to target", usd(Math.abs((v.targetAmount ?? 0) - v.profit))],
          ]}
        />
      )}
      <RuleTile
        icon={<CalendarDays />}
        title="Trading days"
        state={v.minDays === 0 ? "off" : st(false, v.daysOk)}
        progress={v.minDays ? ratio(Math.min(v.tradingDays, v.minDays), v.minDays) : 100}
        tone={v.daysOk ? "up" : "ember"}
        left={<><span className="k-num text-fg">{v.tradingDays}</span> of {v.minDays} minimum</>}
        right={v.daysOk ? "Met" : `${Math.max(0, v.minDays - v.tradingDays)} to go`}
        rows={[
          ["Minimum", v.minDays ? `${v.minDays} days` : "None"],
          ["Traded", `${v.tradingDays} days`, v.daysOk ? "up" : undefined],
          ["Counts when", "A position is opened that day"],
        ]}
      />
      <RuleTile
        icon={<Clock />}
        title="Time limit"
        state={v.deadline ? st(failedRule.includes("time"), false) : "off"}
        progress={v.deadline && a.timeLimitDays ? ratio(a.timeLimitDays * 86_400_000 - (left ?? 0), a.timeLimitDays * 86_400_000) : undefined}
        tone="ember"
        left={v.deadline ? "Time used" : undefined}
        right={left !== null ? `${Math.floor(left / 86_400_000)}d ${Math.floor((left % 86_400_000) / 3_600_000)}h left` : undefined}
        rows={[
          ["Time limit", a.timeLimitDays ? `${a.timeLimitDays} days` : "No time limit"],
          ["Started", fmtDate(a.startedAt)],
          ["Deadline", v.deadline ? fmtDateTime(v.deadline) : "—"],
        ]}
      />
      <RuleTile
        icon={<LineChart />}
        title="Consistency"
        state={cons ? st(false, v.consistencyOk && v.profit > 0) : "off"}
        progress={cons && v.consistencyLimit ? ratio(Math.max(0, v.bestDay ?? 0), v.consistencyLimit) : undefined}
        tone={v.consistencyOk ? "up" : "warn"}
        left={cons ? "Best day vs limit" : undefined}
        right={cons && v.consistencyLimit ? `${usd(v.bestDay ?? 0, 0)} / ${usd(v.consistencyLimit, 0)}` : undefined}
        rows={
          cons
            ? [
                ["Rule", `Best day ≤ ${c.plan.consistency}% of total profit`],
                ["Best day", usd(v.bestDay ?? 0)],
                ["Status", v.consistencyOk ? "Within the limit" : "Holds the pass until more profit is made", v.consistencyOk ? "up" : "warn"],
              ]
            : [
                ["Rule", "This plan has no consistency rule"],
                ["News trading", c.plan.newsTrading ? "Allowed" : `Blocked ±${c.plan.newsWindow} min`],
                ["Weekend holding", c.plan.weekendHolding ? "Allowed" : "Closed Friday 16:45 NY"],
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
  const eq = usePropPoll<{ points: EquityPoint[]; initialBalance: number }>(`challenges/${c.id}/equity?phase=${a.phaseIndex}&limit=2000`, tradable(c, a) ? 30_000 : 0);
  const [mode, setMode] = React.useState<"Equity" | "Balance">("Equity");
  const data = React.useMemo(() => {
    const pts = (eq.data?.points ?? []).map((p) => ({ t: new Date(p.at).getTime(), v: mode === "Equity" ? p.equity : p.balance }));
    // extend with the latest live value so the chart is current between samples
    if (tradable(c, a) && pts.length) pts.push({ t: Date.now(), v: mode === "Equity" ? v.equity : v.balance });
    return pts.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((x, y) => x.t - y.t);
  }, [eq.data, mode, v.equity, v.balance, c, a]);
  const lines: ChartLine[] = [
    { value: v.ddFloor, label: `Max drawdown ${usd(v.ddFloor, 0)}`, tone: "down" },
    { value: v.initial, label: "Starting balance", tone: "muted" },
  ];
  if (v.dailyFloor > v.ddFloor && tradable(c, a)) lines.push({ value: v.dailyFloor, label: `Daily loss ${usd(v.dailyFloor, 0)}`, tone: "warn" });
  if (!a.funded && v.targetAmount) lines.push({ value: v.initial + v.targetAmount, label: `Profit target ${usd(v.initial + v.targetAmount, 0)}`, tone: "gold" });
  const shown = mode === "Equity" ? v.equity : v.balance;
  const diff = shown - v.initial;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-3 px-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="k-label">Account {mode.toLowerCase()}</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} countUp={false} className="text-[30px] font-semibold tracking-tight" />
            <Chip tone={diff >= 0 ? "up" : "down"}>
              {signedUsd(diff)} ({((diff / (v.initial || 1)) * 100).toFixed(2)}%)
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">Since {fmtDate(a.startedAt)}</div>
        </div>
        <Segmented size="xs" value={mode} onChange={setMode} options={["Equity", "Balance"] as const} />
      </div>
      <div className="px-3 pb-4 pt-3 sm:px-4">{eq.loading ? <Skeleton className="h-[300px] w-full rounded-[14px]" /> : <PropEquityLine data={data} lines={lines} height={300} />}</div>
    </Card>
  );
}

function DrawdownCard({ c, v }: { c: ChallengeDetail; v: View }) {
  const p = ratio(v.ddUsed, v.ddLimit);
  const tone = p < 50 ? "up" : p < 75 ? "warn" : "down";
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Drawdown"
        subtitle={`${c.plan.ddType === "trailing" ? "Trailing" : "Static"} · ${c.plan.maxDD}% of the starting balance`}
        action={
          <Chip tone={tone}>
            {tone === "up" ? "Safe" : tone === "warn" ? "Caution" : "Danger"}
          </Chip>
        }
      />
      <div className="flex flex-1 items-center justify-center py-3">
        <Gauge value={Math.min(100, p)} max={100} display={`${p.toFixed(1)}%`} label="Max drawdown used" sublabel={<span className="text-fg-3">{usd(v.ddUsed, 0)} of {usd(v.ddLimit, 0)}</span>} size={210} />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        <Tile label="Breach level" value={usd(v.ddFloor, 0)} tone="down" />
        <Tile label="Room left" value={usd(Math.max(0, v.equity - v.ddFloor), 0)} tone="up" />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Objectives, events, trades                                          */
/* ------------------------------------------------------------------ */

function Objectives({ a }: { a: PhaseAccount }) {
  const s = a.stats;
  const stats: { l: string; v: string; t?: "up" | "down" }[] = [
    { l: "Trades", v: String(s?.trades ?? 0) },
    { l: "Open now", v: String(s?.open ?? a.openPositions ?? 0) },
    { l: "Win rate", v: s?.winRate !== null && s?.winRate !== undefined ? `${s.winRate}%` : "—" },
    { l: "Avg. win", v: usd(s?.avgWin ?? 0), t: "up" },
    { l: "Avg. loss", v: usd(s?.avgLoss ?? 0), t: "down" },
    { l: "Profit factor", v: s?.profitFactor !== null && s?.profitFactor !== undefined ? s.profitFactor.toFixed(2) : "—" },
    { l: "Lots traded", v: (s?.lots ?? 0).toFixed(2) },
  ];
  return (
    <Card>
      <CardHeader title="Trading statistics" subtitle={s?.bestDay ? `Best day ${fmtDate(s.bestDay.day)}: ${usd(s.bestDay.profit)}` : "Updated with every closed trade"} icon={<LineChart />} />
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-4 sm:px-6 xl:grid-cols-7">
        {stats.map((x) => (
          <Tile key={x.l} label={x.l} value={x.v} tone={x.t} />
        ))}
      </div>
    </Card>
  );
}

const SEV: Record<string, { label: string; tone: "down" | "warn" | "info" | "up" | "neutral" }> = {
  breach: { label: "Breach", tone: "down" },
  violation: { label: "Violation", tone: "warn" },
  warning: { label: "Warning", tone: "warn" },
  info: { label: "Info", tone: "info" },
};

function Events({ events }: { events: RuleEvent[] }) {
  return (
    <Card className="h-full">
      <CardHeader title="Rule events" subtitle="Breaches, violations and warnings on this challenge" icon={<ShieldAlert />} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        {events.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-3">No rule events. Warnings appear here at 50%, 75% and 90% of today&apos;s loss limit.</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => {
              const s = SEV[e.severity] ?? { label: e.severity, tone: "neutral" as const };
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
                      {e.equity !== null ? ` · equity ${usd(e.equity)}` : ""}
                      {e.threshold !== null ? ` · limit ${usd(e.threshold)}` : ""}
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
  const t = usePropPoll<{ trades: Trade[] }>(`challenges/${c.id}/trades?phase=${a.phaseIndex}`, tradable(c, a) ? 15_000 : 0);
  const rows = t.data?.trades ?? [];
  const net = rows.reduce((s, r) => s + r.profit, 0);
  const cols: Column<Trade>[] = [
    {
      key: "sym",
      header: "Symbol",
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
    { key: "side", header: "Type", cell: (r) => <Chip size="sm" tone={r.side === "buy" ? "up" : "down"}>{r.side.toUpperCase()}</Chip>, csv: (r) => r.side },
    { key: "vol", header: "Lots", align: "right", cell: (r) => <span className="k-num">{r.volume.toFixed(2)}</span>, sort: (r) => r.volume },
    { key: "open", header: "Open time", cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.openTime)}</span>, hideOn: "md", sort: (r) => r.openTime, csv: (r) => r.openTime },
    { key: "close", header: "Close time", cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.closeTime)}</span>, hideOn: "lg", sort: (r) => r.closeTime, csv: (r) => r.closeTime },
    { key: "op", header: "Open", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{r.openPrice}</span>, hideOn: "lg", csv: (r) => r.openPrice },
    { key: "cp", header: "Close", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{r.closePrice}</span>, hideOn: "lg", csv: (r) => r.closePrice },
    { key: "dur", header: "Duration", align: "right", cell: (r) => <span className="text-fg-3">{fmtDuration(r.durationSecs)}</span>, hideOn: "md", sort: (r) => r.durationSecs, csv: (r) => r.durationSecs },
    { key: "pnl", header: "Profit", align: "right", sort: (r) => r.profit, csv: (r) => r.profit, cell: (r) => <span className={cn("k-num font-semibold", r.profit >= 0 ? "text-up" : "text-down")}>{signedUsd(r.profit)}</span> },
  ];
  return (
    <Card>
      <CardHeader title="Trade history" subtitle={t.loading ? "Loading…" : `${rows.length} closed trade${rows.length === 1 ? "" : "s"} · net ${signedUsd(net)}`} icon={<History />} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {t.loading ? (
          <Skeleton className="h-40 w-full rounded-[14px]" />
        ) : t.error && !t.data ? (
          <div className="py-8 text-center text-[13px] text-fg-3">{t.error.message}</div>
        ) : (
          <DataTable
            columns={cols}
            rows={rows}
            pageSize={10}
            search={(r) => `${r.symbol} ${r.ticket}`}
            exportName={a.login ? `prop-${a.login}-trades` : "prop-trades"}
            rowKey={(r) => String(r.ticket)}
            empty={<div className="py-8 text-center text-[13px] text-fg-3">No closed trades yet on this account.</div>}
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
  const { data: c, error, reload } = usePropPoll<ChallengeDetail>(`challenges/${id}`, 2000);
  const [phaseIdx, setPhaseIdx] = React.useState<number | null>(null);
  React.useEffect(() => setPhaseIdx(null), [id]);

  if (error && !c) return <div className="mt-4"><LoadError error={error} onRetry={reload} title="This challenge couldn't be loaded" /></div>;
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
        <EmptyState illustration="hourglass_not_done" title="Your account is being opened" text={c.status === "payment_failed" ? c.failureReason ?? "The payment failed. You haven't been charged." : "This usually takes a few seconds. This page updates on its own."} />
      </Card>
    );
  const v = viewOf(c, a);
  const today = v.equity - v.dailyRef;
  const live = tradable(c, a);

  return (
    <>
      {c.phases.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] text-fg-3">Phase</span>
          <Segmented
            size="xs"
            value={String(a.phaseIndex)}
            onChange={(x) => setPhaseIdx(Number(x))}
            options={c.phases.map((p) => ({ value: String(p.phaseIndex), label: <>{p.phase} <span className="text-fg-3">{p.status === "active" ? "· live" : `· ${p.status}`}</span></> }))}
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
        <KpiCard label="Balance" icon={<Wallet />} value={<Money value={v.balance} countUp={false} />} chip={`${v.balance >= v.initial ? "+" : ""}${(((v.balance - v.initial) / (v.initial || 1)) * 100).toFixed(2)}% vs start`} chipTone={v.balance >= v.initial ? "up" : "down"} />
        <KpiCard label="Equity" icon={<LineChart />} value={<Money value={v.equity} countUp={false} />} chip={`Floating ${signedUsd(v.equity - v.balance)}`} chipTone={v.equity >= v.balance ? "up" : "down"} delay={0.03} />
        <KpiCard label="Profit" icon={<TrendingUp />} value={<Money value={v.profit} signed tone="auto" countUp={false} />} chip={a.funded ? `${c.split}% yours` : v.targetAmount ? `${Math.min(999, ratio(Math.max(0, v.profit), v.targetAmount)).toFixed(0)}% of target` : "—"} chipTone={a.funded ? "gold" : "ember"} delay={0.06} />
        <KpiCard label="Today's P/L" icon={<CircleDollarSign />} value={<Money value={live ? today : 0} signed tone="auto" countUp={false} />} chip={`${a.openPositions} open · ${v.tradingDays} trading day${v.tradingDays === 1 ? "" : "s"}`} delay={0.09} />
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
        title="My challenges"
        subtitle="Live rule tracking for every evaluation and funded account."
        actions={
          <>
            <Link href="/prop/payouts">
              <Button variant="surface" size="lg">
                <Banknote /> Payouts
              </Button>
            </Link>
            <Link href="/prop">
              <Button variant="ember" size="lg">
                <Plus /> New challenge
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
            title="No challenges yet"
            text="Buy a challenge to get a funded-style account with live rule tracking. Pass the evaluation and trade for a share of the profit."
            action={
              <Link href="/prop">
                <Button variant="ember">
                  Browse challenges <Target />
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

"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CalendarDays,
  CandlestickChart,
  CircleDollarSign,
  Coins,
  Gauge as GaugeIcon,
  Headset,
  Info,
  KeyRound,
  LineChart,
  Plus,
  ShieldCheck,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  Gauge,
  Icon3D,
  KpiCard,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Stepper,
  SymbolCell,
  cn,
  formatDateTime,
  formatMoney,
  formatNumber,
  type Column,
} from "@/components/kit";
import { ME, getInstrument } from "@ezymex/mock";
import { MY_CHALLENGES, OPEN_PROP_POSITION, PROP_MODELS, propEquityPath, propTrades, type MyChallenge, type PropTrade, type RuleState } from "@ezymex/mock/prop";
import { CountUp, CredentialField, ResetCountdown, RuleCard, RuleRow } from "@/components/prop/prop-ui";
import { PropEquityChart, type PropLine } from "@/components/prop/prop-equity-chart";
import { IS_DEMO as DEMO_BUILD } from "@ezymex/mock/mode";
import { LivePropMine } from "@/components/prop-live/mine";
import { TERMINAL_URL } from "@/lib/live";

const k = (n: number) => `$${n / 1000}k`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function stageTone(c: MyChallenge) {
  return c.status === "funded" ? "gold" : c.status === "passed" ? "up" : "ember";
}

/* ------------------------------------------------------------------ */
/* Challenge selector                                                  */
/* ------------------------------------------------------------------ */

function Selector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {MY_CHALLENGES.map((c) => {
        const on = c.id === value;
        const m = PROP_MODELS.find((x) => x.id === c.model)!;
        const pct = c.status === "funded" ? (c.profit / (c.size * 0.1)) * 100 : (c.profit / c.target) * 100;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              "relative min-w-[260px] flex-1 snap-start overflow-hidden rounded-[18px] border p-4 text-left transition-all",
              on ? "k-hot-card border-ember/40 shadow-[0_12px_40px_-20px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]" : "border-line bg-surface hover:border-[var(--k-border-top)] hover:bg-surface-2",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <Icon3D name={c.status === "funded" ? "gem_stone" : c.status === "passed" ? "1st_place_medal" : "trophy"} size={38} />
                <div>
                  <div className="text-[17px] font-semibold tracking-tight">{k(c.size)}</div>
                  <div className="whitespace-nowrap text-[11.5px] text-fg-3">
                    {m.name.replace(" Challenge", "")} · <span className="font-mono">#{c.login}</span>
                  </div>
                </div>
              </div>
              <Chip size="sm" tone={stageTone(c)} dot>
                {c.status === "active" ? `${c.stage} · Active` : c.status === "passed" ? `${c.stage} · Passed` : "Funded"}
              </Chip>
            </div>
            <div className="mt-3.5 flex items-center justify-between text-[11.5px]">
              <span className="text-fg-3">{c.status === "funded" ? "Cycle profit" : "Profit target"}</span>
              <span className="k-num font-medium text-fg">
                {formatMoney(c.profit, "USD", 0)}
                {c.status !== "funded" && <span className="text-fg-3"> / {formatMoney(c.target, "USD", 0)}</span>}
              </span>
            </div>
            <Progress value={pct} tone={c.status === "passed" ? "up" : c.status === "funded" ? "gold" : "ember"} className="mt-1.5" />
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
/* Overview (ref 2 top-left)                                           */
/* ------------------------------------------------------------------ */

function Overview({ c }: { c: MyChallenge }) {
  const m = PROP_MODELS.find((x) => x.id === c.model)!;
  const steps = c.model === "1-step" ? ["Evaluation", "Funded"] : ["Phase 1", "Phase 2", "Funded"];
  const current = c.model === "1-step" ? (c.status === "funded" ? 1 : 0) : c.status === "passed" ? c.stageIndex + 1 : c.stageIndex;
  return (
    <Card className="h-full">
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar src={ME.photo} name={ME.name} size={48} verified />
              <div>
                <div className="text-[17px] font-medium tracking-tight">{ME.name}</div>
                <div className="text-[12.5px] text-fg-3">
                  {c.status === "funded" ? "You're trading a funded (simulated) account" : c.status === "passed" ? "Phase 2 passed — funded account in review" : `Currently in ${c.stage} evaluation`}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 font-mono text-[12px]">
              {c.login}
              <CopyButton value={c.login} label="Login" />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { i: <Coins />, l: "Initial balance", v: formatMoney(c.size, "USD", 0) },
              { i: <Target />, l: "Plan", v: m.name.replace(" Challenge", "") },
              { i: <GaugeIcon />, l: "Drawdown", v: `${m.ddType} ${m.maxDD}%` },
              { i: <CandlestickChart />, l: "Leverage", v: m.leverage },
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
          <Stepper steps={steps} current={current} />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <CalendarDays className="size-4 text-fg-3" />
              <div>
                <div className="text-[10.5px] text-fg-3">Start date</div>
                <div className="text-[13px] font-medium">{fmtDate(c.startDate)}</div>
              </div>
            </div>
            <div className="k-row flex items-center gap-3 px-3.5 py-2.5">
              <CalendarCheck className="size-4 text-fg-3" />
              <div>
                <div className="text-[10.5px] text-fg-3">{c.endDate ? "Completed" : "End date"}</div>
                <div className="text-[13px] font-medium">{c.endDate ? fmtDate(c.endDate) : "No time limit"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-[18px] border border-line bg-surface-2/50 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[14px] font-medium">
              <KeyRound className="size-4 text-fg-3" /> Account details
            </div>
            <Chip size="sm" tone={c.status === "passed" ? "neutral" : "up"} dot>
              {c.status === "passed" ? "Read-only" : "Trading enabled"}
            </Chip>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CredentialField label="Login" value={c.login} />
            <CredentialField label="MT5 server" value={c.server} mono={false} />
            <CredentialField label="Investor password" value={c.investorPassword} secret />
            <CredentialField label="Master password" value={c.masterPassword} secret />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?login=${c.login}`}>
              <Button size="sm" variant="ember">
                <CandlestickChart /> Open WebTrader
              </Button>
            </Link>
            <Button size="sm" variant="surface" onClick={() => toast.success("Password reset link sent", { description: `Check ${ME.email}` })}>
              Reset password
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast("MT5 config downloaded", { description: `${c.server}.ini` })}>
              MT5 setup
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Countdown card                                                      */
/* ------------------------------------------------------------------ */

function CountdownCard({ c }: { c: MyChallenge }) {
  const left = c.dailyLimit - c.dailyUsed;
  if (c.status === "passed")
    return (
      <Card hot className="relative flex h-full flex-col items-center justify-center overflow-hidden p-6 text-center">
        <Icon3D name="party_popper" size={84} />
        <div className="mt-3 text-[18px] font-medium">Phase 2 passed</div>
        <p className="mt-1 max-w-xs text-[13px] text-fg-2">Our risk desk is reviewing your trades. Your $25k funded account will be issued within 24 hours.</p>
        <div className="mt-4 w-full max-w-xs space-y-2 text-left">
          {[
            ["Trade review", "done"],
            ["KYC check", "done"],
            ["Funded contract", "pending"],
          ].map(([t, s]) => (
            <div key={t} className="flex items-center justify-between rounded-[12px] border border-white/10 light:border-line bg-black/20 light:bg-white/70 px-3.5 py-2 text-[12.5px]">
              {t}
              <Chip size="sm" tone={s === "done" ? "up" : "warn"} dot>
                {s === "done" ? "Done" : "Sign now"}
              </Chip>
            </div>
          ))}
        </div>
        <Button variant="ember" className="mt-4" onClick={() => toast.success("Funded trader agreement signed", { description: "Your account credentials will arrive by email." })}>
          Sign agreement <ArrowRight />
        </Button>
      </Card>
    );
  return (
    <Card className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,color-mix(in_oklab,var(--k-ember)_22%,transparent),transparent)]" />
      <div className="relative flex items-center justify-between px-6 pt-5">
        <div className="flex items-center gap-2 text-[14px] font-medium">
          <Timer className="size-4 text-fg-3" /> Daily reset
        </div>
        <Chip size="sm" tone="info">
          GMT+3
        </Chip>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-5 text-center">
        <Icon3D name="hourglass_not_done" size={52} className="mb-4" />
        <div className="text-[14px] font-medium">Today&apos;s permitted loss will reset in</div>
        <ResetCountdown className="mt-4" />
        <div className="mt-3 text-[11.5px] text-fg-3">Countdown timezone: GMT+3</div>
      </div>
      <div className="relative grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        <div className="k-row px-3.5 py-2.5">
          <div className="text-[10.5px] text-fg-3">Permitted today</div>
          <Money value={c.dailyLimit} className="text-[15px] font-medium" />
        </div>
        <div className="k-row px-3.5 py-2.5">
          <div className="text-[10.5px] text-fg-3">Remaining</div>
          <Money value={left} className="text-[15px] font-medium text-up" />
        </div>
        <Link href="/support" className="col-span-2">
          <Button variant="surface" size="sm" className="w-full">
            <Headset /> Prop support · 24/5
          </Button>
        </Link>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Banners                                                             */
/* ------------------------------------------------------------------ */

function Banners({ c }: { c: MyChallenge }) {
  const [hidden, setHidden] = React.useState<string[]>([]);
  const items: { id: string; tone: "warn" | "info" | "up" | "gold"; icon: React.ReactNode; title: React.ReactNode; text: React.ReactNode; action?: React.ReactNode }[] = [];
  if (c.status === "active") {
    const pct = Math.round(((c.dailyUsed + OPEN_PROP_POSITION.lossIfSl) / c.dailyLimit) * 100);
    items.push({
      id: "risk",
      tone: "warn",
      icon: <AlertTriangle />,
      title: `You're at ${pct}% of today's loss limit if your XAUUSD stop is hit`,
      text: (
        <>
          Open BUY {OPEN_PROP_POSITION.volume} XAUUSD @ {formatNumber(OPEN_PROP_POSITION.openPrice)} · SL {formatNumber(OPEN_PROP_POSITION.sl)} would realise -{formatMoney(OPEN_PROP_POSITION.lossIfSl)}. At 100% the account fails and all positions close.
        </>
      ),
      action: (
        <Button size="sm" variant="surface" onClick={() => toast.success("Stop loss moved to 2,646.20", { description: "Risk at SL now 62% of today's limit" })}>
          Tighten SL
        </Button>
      ),
    });
    items.push({
      id: "news",
      tone: "info",
      icon: <Info />,
      title: "News window today: US Core PCE at 15:30 (GMT+3)",
      text: "No new XAUUSD, EURUSD or US30 trades from 15:28 to 15:32. The 2-Step allows holding through news during evaluation; funded accounts don't.",
      action: (
        <Link href="/calendar">
          <Button size="sm" variant="ghost">
            Calendar <ArrowUpRight />
          </Button>
        </Link>
      ),
    });
  } else if (c.status === "passed") {
    items.push({ id: "passed", tone: "up", icon: <ShieldCheck />, title: "All objectives met on 18 Sep 2026", text: "Profit target reached with 7 trading days and no rule breaches. Your certificate is ready on the Payouts page.", action: <Link href="/prop/payouts"><Button size="sm" variant="surface">View certificate</Button></Link> });
  } else {
    items.push({
      id: "funded",
      tone: "gold",
      icon: <Banknote />,
      title: "Payout available: you can withdraw your 80% share now",
      text: `Cycle profit ${formatMoney(c.profit)} → your share ${formatMoney(c.profit * 0.8)}. Requests go to the risk desk and land in your wallet, usually within 8 hours.`,
      action: (
        <Link href="/prop/payouts">
          <Button size="sm" variant="gold">
            Go to payouts <ArrowRight />
          </Button>
        </Link>
      ),
    });
  }
  const tone = {
    warn: "border-warn/30 bg-warn-soft text-warn",
    info: "border-info/25 bg-info-soft text-info",
    up: "border-up/25 bg-up-soft text-up",
    gold: "border-gold/30 bg-gold-soft text-gold",
  };
  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {items
          .filter((b) => !hidden.includes(b.id))
          .map((b) => (
            <motion.div key={b.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className={cn("flex flex-col gap-3 rounded-[16px] border px-4 py-3 sm:flex-row sm:items-center", tone[b.tone])}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 shrink-0 [&_svg]:size-[18px]">{b.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{b.title}</div>
                    <div className="mt-0.5 text-[12.5px] text-fg-2">{b.text}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                  {b.action}
                  <button type="button" aria-label="Dismiss" onClick={() => setHidden((h) => [...h, b.id])} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

function Rules({ c }: { c: MyChallenge }) {
  const passed = c.status === "passed";
  const dailyState: RuleState = passed ? "passed" : "ongoing";
  const dailyPct = (c.dailyUsed / c.dailyLimit) * 100;
  const floor = c.size - c.maxLoss;
  const daysState: RuleState = c.daysTraded >= c.minDays ? "passed" : "ongoing";
  const targetState: RuleState = c.status === "funded" ? "ongoing" : c.profit >= c.target ? "passed" : "ongoing";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Reveal delay={0.05}>
        <RuleCard
          icon={<TrendingDown />}
          title="Daily loss limit"
          state={dailyState}
          progress={dailyPct}
          progressTone={dailyPct > 75 ? "down" : dailyPct > 50 ? "warn" : "up"}
          progressLabel={
            <>
              <span>
                Used <span className="k-num text-fg">{formatMoney(c.dailyUsed, "USD", 0)}</span> / {formatMoney(c.dailyLimit, "USD", 0)}
              </span>
              <span className="k-num">{dailyPct.toFixed(1)}%</span>
            </>
          }
        >
          <RuleRow icon={<GaugeIcon />} label="Max daily loss" value={formatMoney(c.dailyLimit)} />
          <RuleRow icon={<TrendingDown />} label="Daily loss till now" value={formatMoney(c.dailyUsed)} tone={c.dailyUsed > 0 ? "down" : undefined} />
          <RuleRow icon={<ShieldCheck />} label="Today's permitted loss" value={formatMoney(c.dailyLimit - c.dailyUsed)} />
        </RuleCard>
      </Reveal>
      <Reveal delay={0.1}>
        <RuleCard
          icon={<GaugeIcon />}
          title="Max loss limit"
          state={passed ? "passed" : "ongoing"}
          progress={(c.maxLossUsed / c.maxLoss) * 100}
          progressTone="gold"
          progressLabel={
            <>
              <span>
                Peak DD <span className="k-num text-fg">{formatMoney(c.maxLossUsed, "USD", 0)}</span> / {formatMoney(c.maxLoss, "USD", 0)}
              </span>
              <span className="k-num">{((c.maxLossUsed / c.maxLoss) * 100).toFixed(1)}%</span>
            </>
          }
        >
          <RuleRow icon={<GaugeIcon />} label="Max loss limit" value={formatMoney(c.maxLoss)} />
          <RuleRow icon={<TrendingDown />} label="Equity floor (breach level)" value={formatMoney(floor)} tone="down" />
          <RuleRow icon={<ShieldCheck />} label="Buffer to floor" value={formatMoney(c.equity - floor)} tone="up" />
        </RuleCard>
      </Reveal>
      <Reveal delay={0.15}>
        <RuleCard
          icon={<CalendarDays />}
          title="Min trading days"
          state={daysState}
          progress={(Math.min(c.daysTraded, c.minDays) / c.minDays) * 100}
          progressTone={daysState === "passed" ? "up" : "ember"}
          progressLabel={
            <>
              <span>
                <span className="k-num text-fg">{Math.min(c.daysTraded, c.minDays)}</span> of {c.minDays} days
              </span>
              <span className="flex gap-1">
                {Array.from({ length: c.minDays }, (_, i) => (
                  <span key={i} className={cn("h-1.5 w-3 rounded-full", i < c.daysTraded ? "bg-up" : "bg-surface-3")} />
                ))}
              </span>
            </>
          }
        >
          <RuleRow icon={<CalendarDays />} label="Minimum" value={`${c.minDays} days`} />
          <RuleRow icon={<CalendarCheck />} label="Current result" value={`${c.daysTraded} days`} tone={daysState === "passed" ? "up" : undefined} />
          <RuleRow icon={<Info />} label="Counts when" value="1+ closed trade / day" />
        </RuleCard>
      </Reveal>
      <Reveal delay={0.2}>
        {c.status === "funded" ? (
          <RuleCard
            icon={<Wallet />}
            title="Payout eligibility"
            state="passed"
            progress={100}
            progressTone="gold"
            progressLabel={
              <>
                <span>Cycle profit {formatMoney(c.profit, "USD", 0)}</span>
                <span className="k-num text-gold">80% yours</span>
              </>
            }
          >
            <RuleRow icon={<CircleDollarSign />} label="Your share (80%)" value={formatMoney(c.profit * 0.8)} tone="up" />
            <RuleRow icon={<CalendarCheck />} label="Eligible from" value="24 Sep 2026" />
            <Link href="/prop/payouts" className="block">
              <Button variant="gold" size="md" className="w-full">
                Request payout <ArrowRight />
              </Button>
            </Link>
          </RuleCard>
        ) : (
          <RuleCard
            icon={<Target />}
            title="Profit target"
            state={targetState}
            progress={(c.profit / c.target) * 100}
            progressTone={targetState === "passed" ? "up" : "ember"}
            progressLabel={
              <>
                <span>
                  <span className="k-num text-fg">{formatMoney(c.profit, "USD", 0)}</span> / {formatMoney(c.target, "USD", 0)}
                </span>
                <span className="k-num">{Math.min(100, (c.profit / c.target) * 100).toFixed(1)}%</span>
              </>
            }
          >
            <RuleRow icon={<Target />} label="Minimum" value={formatMoney(c.target)} />
            <RuleRow icon={<TrendingUp />} label="Current result" value={formatMoney(c.profit)} tone="up" />
            <RuleRow icon={<ArrowUpRight />} label={targetState === "passed" ? "Exceeded by" : "Left to target"} value={formatMoney(Math.abs(c.target - c.profit))} />
          </RuleCard>
        )}
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Equity chart + drawdown gauge                                       */
/* ------------------------------------------------------------------ */

function EquityCard({ c }: { c: MyChallenge }) {
  const data = React.useMemo(() => propEquityPath(c), [c]);
  const [range, setRange] = React.useState<"Equity" | "Balance">("Equity");
  const lines: PropLine[] = [
    { value: c.size - c.maxLoss, label: `Max loss ${formatMoney(c.size - c.maxLoss, "USD", 0)}`, tone: "down" },
    { value: c.size, label: "Starting balance", tone: "muted" },
  ];
  if (c.status !== "funded") lines.push({ value: c.size + c.target, label: `Profit target ${formatMoney(c.size + c.target, "USD", 0)}`, tone: "gold" });
  const shown = range === "Equity" ? c.equity : c.balance;
  const diff = shown - c.size;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-3 px-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="k-label">Account {range.toLowerCase()}</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} className="text-[32px] font-semibold tracking-tight" />
            <Chip tone={diff >= 0 ? "up" : "down"}>
              {diff >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(diff))} ({((diff / c.size) * 100).toFixed(2)}%)
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">Since {fmtDate(c.startDate)} · hover the chart for details</div>
        </div>
        <Segmented size="xs" value={range} onChange={setRange} options={["Equity", "Balance"] as const} />
      </div>
      <div className="px-3 pb-4 pt-3 sm:px-4">
        <PropEquityChart key={c.id} data={data} lines={lines} height={300} />
      </div>
    </Card>
  );
}

function DrawdownCard({ c }: { c: MyChallenge }) {
  const pct = (c.maxLossUsed / c.maxLoss) * 100;
  const m = PROP_MODELS.find((x) => x.id === c.model)!;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Drawdown" subtitle={`${m.ddType} · ${m.maxDD}% of initial balance`} action={<Chip tone={pct < 50 ? "up" : pct < 75 ? "warn" : "down"} dot>{pct < 50 ? "Safe" : pct < 75 ? "Caution" : "Danger"}</Chip>} />
      <div className="flex flex-1 items-center justify-center py-3">
        <Gauge value={pct} max={100} display={`${pct.toFixed(1)}%`} label="Max DD used" sublabel={<span className="text-fg-3">peak {formatMoney(c.maxLossUsed, "USD", 0)}</span>} size={210} />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        <div className="k-row px-3.5 py-2.5">
          <div className="text-[11.5px] text-fg-3">Current DD</div>
          <div className="k-num mt-0.5 text-[15px] font-medium">{c.equity >= c.size ? "0.00%" : `${(((c.size - c.equity) / c.size) * 100).toFixed(2)}%`}</div>
        </div>
        <div className="k-row px-3.5 py-2.5">
          <div className="text-[11.5px] text-fg-3">Room left</div>
          <Money value={c.equity - (c.size - c.maxLoss)} decimals={0} className="mt-0.5 block text-[15px] font-medium text-up" />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Objectives + history                                                */
/* ------------------------------------------------------------------ */

function Objectives({ c }: { c: MyChallenge }) {
  const m = PROP_MODELS.find((x) => x.id === c.model)!;
  const consLimit = m.id === "instant" ? 20 : m.id === "1-step" ? 40 : 45;
  const stats = [
    { l: "Trades", v: <CountUp value={c.trades} /> },
    { l: "Win rate", v: <CountUp value={c.winRate} decimals={1} suffix="%" />, t: "up" },
    { l: "Avg. win", v: <Money value={c.avgWin} />, t: "up" },
    { l: "Avg. loss", v: <Money value={c.avgLoss} />, t: "down" },
    { l: "Profit factor", v: <CountUp value={c.profitFactor} decimals={2} /> },
    { l: "Lots traded", v: <CountUp value={c.lots} decimals={2} /> },
    { l: "Best day / profit", v: <CountUp value={c.bestDayPct} decimals={1} suffix="%" />, sub: `limit ${consLimit}%` },
  ];
  return (
    <Card>
      <CardHeader title="Trading objectives" subtitle="Performance on this account" icon={<LineChart />} action={<Chip tone={c.bestDayPct < consLimit ? "up" : "down"} dot>Consistency OK</Chip>} />
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-4 sm:px-6 xl:grid-cols-7">
        {stats.map((s) => (
          <div key={s.l} className="k-row px-3.5 py-3">
            <div className="truncate text-[11.5px] text-fg-3">{s.l}</div>
            <div className={cn("mt-1 text-[18px] font-semibold tracking-tight", s.t === "up" && "text-up", s.t === "down" && "text-down")}>{s.v}</div>
            {s.sub && <div className="text-[10.5px] text-fg-3">{s.sub}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function History({ c }: { c: MyChallenge }) {
  const rows = React.useMemo(() => propTrades(c), [c]);
  const [side, setSide] = React.useState<"all" | "buy" | "sell">("all");
  const view = side === "all" ? rows : rows.filter((r) => r.side === side);
  const cols: Column<PropTrade>[] = [
    { key: "sym", header: "Symbol", cell: (r) => <SymbolCell symbol={r.symbol} size={24} sub={<span className="font-mono">#{r.ticket}</span>} /> },
    {
      key: "side",
      header: "Type",
      cell: (r) => (
        <Chip size="sm" tone={r.side === "buy" ? "up" : "down"}>
          {r.side.toUpperCase()}
        </Chip>
      ),
    },
    { key: "vol", header: "Lots", align: "right", cell: (r) => <span className="k-num">{r.volume.toFixed(2)}</span>, sort: (r) => r.volume },
    { key: "open", header: "Open time", cell: (r) => <span className="k-num text-fg-2">{formatDateTime(r.openTime)}</span>, hideOn: "md", sort: (r) => r.openTime },
    { key: "op", header: "Open price", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatNumber(r.openPrice, getInstrument(r.symbol).digits)}</span>, hideOn: "lg" },
    { key: "cp", header: "Close price", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatNumber(r.closePrice, getInstrument(r.symbol).digits)}</span>, hideOn: "lg" },
    { key: "dur", header: "Duration", align: "right", cell: (r) => <span className="text-fg-3">{r.duration}</span>, hideOn: "md" },
    {
      key: "pnl",
      header: "Profit",
      align: "right",
      sort: (r) => r.profit,
      cell: (r) => <span className={cn("k-num font-semibold", r.profit >= 0 ? "text-up" : "text-down")}>{r.profit >= 0 ? "+" : "-"}{formatMoney(Math.abs(r.profit))}</span>,
    },
  ];
  return (
    <Card>
      <CardHeader title="Trade history" subtitle={`${rows.length} closed trades · net ${formatMoney(c.profit)}`} icon={<CandlestickChart />} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        <DataTable
          columns={cols}
          rows={view}
          pageSize={8}
          search={(r) => `${r.symbol} ${r.ticket}`}
          exportName={`prop-${c.login}-trades`}
          rowKey={(r) => r.ticket}
          toolbar={<Segmented size="xs" value={side} onChange={setSide} options={[{ value: "all", label: "All" }, { value: "buy", label: "Buy" }, { value: "sell", label: "Sell" }]} />}
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DemoMyChallengesPage() {
  const [id, setId] = React.useState(MY_CHALLENGES[0]!.id);
  const c = MY_CHALLENGES.find((x) => x.id === id)!;
  const today = c.equity - c.dayStart;
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
              <Button variant="ember" size="lg" shimmer>
                <Plus /> New challenge
              </Button>
            </Link>
          </>
        }
      />

      <Reveal>
        <Selector value={id} onChange={setId} />
      </Reveal>

      <AnimatePresence mode="wait">
        <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.05} className="xl:col-span-8">
              <Overview c={c} />
            </Reveal>
            <Reveal delay={0.1} className="xl:col-span-4">
              <CountdownCard c={c} />
            </Reveal>
          </div>

          <div className="mt-4">
            <Banners c={c} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Balance" icon={<Wallet />} value={<Money value={c.balance} />} hot chip={`+${((c.balance / c.size - 1) * 100).toFixed(2)}%`} chipTone="up" />
            <KpiCard label="Equity" icon={<LineChart />} value={<Money value={c.equity} />} chip={`Floating ${c.equity - c.balance >= 0 ? "+" : "-"}${formatMoney(Math.abs(c.equity - c.balance))}`} chipTone={c.equity >= c.balance ? "up" : "down"} delay={0.05} />
            <KpiCard label="Total profit" icon={<TrendingUp />} value={<Money value={c.profit} signed tone="up" />} chip={c.status === "funded" ? "80% yours" : `${((c.profit / c.target) * 100).toFixed(0)}% of target`} chipTone={c.status === "funded" ? "gold" : "ember"} delay={0.1} />
            <KpiCard label="Today's P/L" icon={<CircleDollarSign />} value={<Money value={today} signed tone={today < 0 ? "down" : today > 0 ? "up" : undefined} />} chip={`${c.trades} trades · ${c.daysTraded} days`} delay={0.15} />
          </div>

          <div className="mt-4">
            <Rules c={c} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.05} className="xl:col-span-8">
              <EquityCard c={c} />
            </Reveal>
            <Reveal delay={0.1} className="xl:col-span-4">
              <DrawdownCard c={c} />
            </Reveal>
          </div>

          <Reveal delay={0.05} className="mt-4 block">
            <Objectives c={c} />
          </Reveal>

          <Reveal delay={0.05} className="mt-4 block">
            <History c={c} />
          </Reveal>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Live builds: plans, challenges and payouts from the prop service (via /api/prop). Demo builds: mock data. */
export default function MyChallengesPage() {
  return DEMO_BUILD ? <DemoMyChallengesPage /> : <LivePropMine />;
}

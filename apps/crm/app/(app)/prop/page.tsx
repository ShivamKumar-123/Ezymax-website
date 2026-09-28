"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  Clock,
  Gauge as GaugeIcon,
  Layers,
  Minus,
  Percent,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  Trophy,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Flag, Icon3D, Money, PageHeader, Reveal, Segmented, Starfield, cn, formatMoney } from "@kalks/ui";
import { WALLET } from "@kalks/mock";
import { BANNED_STRATEGIES, PROP_FAQ, PROP_MODELS, PROP_SIZES, PROP_STATS, RECENT_PAYOUTS, type PropModelId, type PropSize } from "@kalks/mock/prop";
import { BuyChallengeDialog } from "@/components/prop/buy-dialog";
import { Accordion, CountUp } from "@/components/prop/prop-ui";

const MODEL_ICON: Record<PropModelId, React.ReactNode> = {
  "1-step": <Target className="size-3.5" />,
  "2-step": <Layers className="size-3.5" />,
  instant: <Zap className="size-3.5" />,
};

const k = (n: number) => `$${n >= 1000 ? `${n / 1000}k` : n}`;

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <Card className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/photos/trading-screen.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-45 md:w-3/5" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/20 md:via-bg/80" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_0%,rgba(255,90,31,0.28),transparent_60%)]" />
      <Starfield density={50} />
      <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-2xl">
          <Chip tone="gold" className="mb-4">
            <Sparkles className="size-3.5" /> Kalks Prop · simulated capital, real payouts
          </Chip>
          <h2 className="text-[28px] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
            Trade up to <span className="bg-gradient-to-r from-[#ffb36b] to-[#ff5a1f] bg-clip-text text-transparent">$200,000</span>.
            <br className="hidden sm:block" /> Keep up to 90% of the profit.
          </h2>
          <p className="mt-3 max-w-lg text-[14.5px] text-fg-2">Pass a 1-Step or 2-Step evaluation, or start funded instantly. Rules run live on the server, so you always know exactly where you stand.</p>
          <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Paid to traders", v: <CountUp value={PROP_STATS.paidOut / 1e6} decimals={1} prefix="$" suffix="M" /> },
              { l: "Funded traders", v: <CountUp value={PROP_STATS.fundedTraders} /> },
              { l: "Avg. payout time", v: <CountUp value={PROP_STATS.avgPayoutHours} decimals={1} suffix="h" /> },
              { l: "Largest payout", v: <Money value={PROP_STATS.largestPayout} decimals={0} /> },
            ].map((s) => (
              <div key={s.l} className="rounded-[14px] border border-line bg-surface/60 px-3.5 py-3 backdrop-blur">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{s.l}</div>
                <div className="mt-1 text-[19px] font-semibold tracking-tight">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative hidden justify-self-center lg:block">
          <Icon3D name="trophy" size={190} />
        </div>
      </div>
      <div className="relative flex items-center gap-4 overflow-hidden border-t border-line bg-surface/50 px-6 py-3 backdrop-blur">
        <span className="flex shrink-0 items-center gap-2 text-[11.5px] font-medium text-fg-2">
          <span className="size-1.5 animate-pulse rounded-full bg-up" /> Latest payouts
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <motion.div className="flex w-max gap-6" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
            {[...RECENT_PAYOUTS, ...RECENT_PAYOUTS].map((p, i) => (
              <span key={i} className="flex shrink-0 items-center gap-2 text-[12.5px]">
                <Avatar src={p.photo} name={p.name} size={22} />
                <Flag country={p.country} className="size-3.5" />
                <span className="text-fg-2">{p.name}</span>
                <span className="k-num font-semibold text-up">+{formatMoney(p.amount)}</span>
                <span className="text-fg-3">· {k(p.size)} · {p.hoursAgo}h ago</span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function PhaseTrack({ modelId }: { modelId: PropModelId }) {
  const m = PROP_MODELS.find((x) => x.id === modelId)!;
  const steps = [...m.phases.filter((p) => p.name !== "Funded"), { name: "Funded", target: null }];
  return (
    <div className="flex items-stretch gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s.name}>
          <motion.div
            key={modelId + s.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn("k-row flex-1 px-3.5 py-3", s.name === "Funded" && "border-gold/30 bg-gold-soft")}
          >
            <div className="flex items-center gap-2 text-[11px] text-fg-3">
              <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-semibold", s.name === "Funded" ? "bg-gold text-[#1a1204]" : "bg-surface-3 text-fg-2")}>{i + 1}</span>
              {s.name}
            </div>
            <div className="k-num mt-1.5 text-[15px] font-semibold">{s.target ? `${s.target}% target` : s.name === "Funded" ? `${m.split} split` : "No target"}</div>
            <div className="mt-0.5 text-[11px] text-fg-3">{s.name === "Funded" ? `Payout after ${m.firstPayout}` : `Min ${m.minDays} trading days`}</div>
          </motion.div>
          {i < steps.length - 1 && (
            <div className="hidden items-center sm:flex">
              <ArrowRight className="size-4 text-fg-3" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Configurator({ modelId, setModelId, size, setSize }: { modelId: PropModelId; setModelId: (m: PropModelId) => void; size: PropSize; setSize: (s: PropSize) => void }) {
  const m = PROP_MODELS.find((x) => x.id === modelId)!;
  return (
    <Card className="h-full">
      <CardHeader title="Choose your challenge" subtitle="Pick a model and account size — prices update instantly" icon={<Trophy />} />
      <div className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="md"
            value={modelId}
            onChange={setModelId}
            options={PROP_MODELS.map((x) => ({
              value: x.id,
              label: (
                <>
                  {MODEL_ICON[x.id]}
                  {x.id === "1-step" ? "1-Step" : x.id === "2-step" ? "2-Step" : "Instant"}
                </>
              ),
            }))}
          />
          {m.popular && (
            <Chip tone="ember" dot>
              Most popular
            </Chip>
          )}
        </div>
        <motion.p key={modelId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13.5px] text-fg-2">
          {m.tagline}
        </motion.p>

        <div>
          <div className="k-label mb-2.5">Account size</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {PROP_SIZES.map((s) => {
              const on = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn(
                    "relative overflow-hidden rounded-[14px] border px-3 py-3 text-left transition-all",
                    on ? "border-ember/50 bg-ember-soft shadow-[0_0_0_3px_rgba(255,90,31,0.10),0_10px_30px_-12px_rgba(255,90,31,0.5)]" : "border-line bg-surface-2 hover:border-fg-3/40 hover:bg-surface-3",
                  )}
                >
                  {s === 100000 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-gold" />}
                  <div className={cn("k-num text-[17px] font-semibold tracking-tight", on ? "text-fg" : "text-fg")}>{k(s)}</div>
                  <div className={cn("k-num mt-0.5 text-[11.5px]", on ? "text-ember" : "text-fg-3")}>{formatMoney(m.fees[s], "USD", 0)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="k-label mb-2.5">Your path</div>
          <PhaseTrack modelId={modelId} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { i: <TrendingDown />, l: "Daily loss", v: `${m.dailyLoss}%`, s: formatMoney((size * m.dailyLoss) / 100, "USD", 0) },
            { i: <GaugeIcon />, l: "Max drawdown", v: `${m.maxDD}%`, s: `${m.ddType} · ${formatMoney((size * m.maxDD) / 100, "USD", 0)}` },
            { i: <CalendarDays />, l: "Min days", v: `${m.minDays}`, s: m.timeLimit + " time" },
            { i: <Percent />, l: "Profit split", v: m.split, s: `Scales to ${m.splitMax}` },
          ].map((x) => (
            <div key={x.l} className="k-row px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px] text-fg-3 [&_svg]:size-3.5">
                {x.i}
                {x.l}
              </div>
              <div className="k-num mt-1 text-[18px] font-semibold">{x.v}</div>
              <div className="truncate text-[11px] text-fg-3">{x.s}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="k-label mb-2.5">Included with every challenge</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { n: "chart_increasing", t: "MT5 + Kalks WebTrader", d: "Forex, metals, indices & crypto CFDs" },
              { n: "shield", t: "Live rules dashboard", d: "Countdown, warnings & breach reports" },
              { n: "robot", t: "EAs & AI Coach", d: "Automate your edge, get daily feedback" },
              { n: "money_with_wings", t: "Payouts to your wallet", d: "USDT on TRC20, approved in ~7h" },
            ].map((x) => (
              <div key={x.t} className="flex items-center gap-3 rounded-[14px] border border-dashed border-line px-3 py-2.5">
                <Icon3D name={x.n} size={34} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{x.t}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PlanCard({ modelId, size }: { modelId: PropModelId; size: PropSize }) {
  const m = PROP_MODELS.find((x) => x.id === modelId)!;
  const fee = m.fees[size];
  const est = size * 0.06 * (parseInt(m.split) / 100);
  const rows: [string, React.ReactNode][] = [
    ...m.phases.map((p): [string, React.ReactNode] => [p.name === "Funded" ? "Profit target" : `${p.name} target`, p.target ? `${p.target}% · ${formatMoney((size * p.target) / 100, "USD", 0)}` : "None"]),
    ["Daily loss limit", `${m.dailyLoss}% · ${m.dailyLossBasis.toLowerCase()}`],
    ["Max drawdown", `${m.maxDD}% ${m.ddType.toLowerCase()}`],
    ["Min trading days", `${m.minDays} days`],
    ["Leverage", m.leverage],
    ["Profit split", `${m.split} → ${m.splitMax}`],
    ["Fee refund", m.refundable ? <span className="text-up">100% on 1st payout</span> : <span className="text-fg-3">Non-refundable</span>],
  ];
  return (
    <Card hot className="relative flex h-full flex-col overflow-hidden">
      <Starfield density={40} />
      <div className="relative flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="k-label">{m.name}</div>
            <div className="mt-1 text-[13px] text-fg-2">{k(size)} simulated account</div>
          </div>
          <Icon3D name={modelId === "instant" ? "rocket" : modelId === "1-step" ? "1st_place_medal" : "trophy"} size={56} className="-mr-1 -mt-1" />
        </div>
        <motion.div key={`${modelId}${size}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-baseline gap-2">
          <Money value={fee} decimals={0} className="text-[44px] font-semibold leading-none tracking-[-0.03em]" />
          <span className="text-[13px] text-fg-3">one-time · USDT</span>
        </motion.div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {m.refundable && (
            <Chip size="sm" tone="gold">
              Refundable
            </Chip>
          )}
          <Chip size="sm">{m.leverage} leverage</Chip>
          <Chip size="sm">No time limit</Chip>
        </div>
        <dl className="mt-5 divide-y divide-white/[0.06] text-[13px]">
          {rows.map(([key, v]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-fg-2">{key}</dt>
              <dd className="k-num text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-[12px] text-fg-2">
          At 6% a month on {k(size)} you&apos;d take home <span className="k-num font-semibold text-up">{formatMoney(est, "USD", 0)}</span> per month at {m.split}.
        </div>
        <div className="mt-auto pt-5">
          <BuyChallengeDialog
            model={m}
            size={size}
            trigger={
              <Button variant="ember" size="xl" shimmer className="w-full">
                Buy challenge · {formatMoney(fee, "USD", 0)} <ArrowRight />
              </Button>
            }
          />
          <div className="mt-2.5 text-center text-[11.5px] text-fg-3">
            Paid from wallet · balance <span className="k-num text-fg-2">{formatMoney(WALLET.assets[0]!.balance)} USDT</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function Yes({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg">
      <Check className="size-3.5 text-up" />
      {children}
    </span>
  );
}

function CompareTable({ modelId, size, onPick }: { modelId: PropModelId; size: PropSize; onPick: (m: PropModelId) => void }) {
  const rows: { label: string; icon: React.ReactNode; cell: (m: (typeof PROP_MODELS)[number]) => React.ReactNode }[] = [
    { label: `Fee (${k(size)})`, icon: <Sparkles />, cell: (m) => <span className="k-num font-semibold">{formatMoney(m.fees[size], "USD", 0)}</span> },
    { label: "Profit target", icon: <Target />, cell: (m) => m.phases.map((p) => (p.target ? `${p.target}%` : "—")).join(" / ") },
    { label: "Daily loss limit", icon: <TrendingDown />, cell: (m) => <span>{m.dailyLoss}% <span className="text-fg-3">· {m.dailyLossBasis}</span></span> },
    { label: "Max drawdown", icon: <GaugeIcon />, cell: (m) => <span>{m.maxDD}% <span className="text-fg-3">· {m.ddType}</span></span> },
    { label: "Min trading days", icon: <CalendarDays />, cell: (m) => `${m.minDays} days` },
    { label: "Time limit", icon: <Clock />, cell: (m) => m.timeLimit },
    { label: "Leverage", icon: <Layers />, cell: (m) => m.leverage },
    { label: "Profit split", icon: <Percent />, cell: (m) => `${m.split} → ${m.splitMax}` },
    { label: "Fee refund", icon: <Check />, cell: (m) => (m.refundable ? <Yes>1st payout</Yes> : <span className="inline-flex items-center gap-1.5 text-fg-3"><Minus className="size-3.5" /> No</span>) },
    { label: "Consistency rule", icon: <ShieldAlert />, cell: (m) => m.consistency },
    { label: "News trading", icon: <Zap />, cell: (m) => m.news },
    { label: "Weekend holding", icon: <CalendarDays />, cell: (m) => m.weekend },
    { label: "Expert Advisors", icon: <Sparkles />, cell: (m) => <Yes>{m.ea}</Yes> },
    { label: "Banned strategies", icon: <Ban />, cell: () => <span className="text-down">Latency arb · tick scalping · hedging · HFT</span> },
    { label: "First payout", icon: <Clock />, cell: (m) => `${m.firstPayout} · ${m.payoutCycle.toLowerCase()}` },
  ];
  return (
    <Card id="rules">
      <CardHeader title="Compare the rules" subtitle="All three models side by side · enforced live on every tick" icon={<Layers />} action={<Chip tone="info" className="hidden sm:inline-flex">Server time GMT+3</Chip>} />
      <div className="overflow-x-auto px-4 pb-6 pt-4 sm:px-6">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="w-[22%] pb-3 text-left text-[11.5px] font-medium uppercase tracking-wider text-fg-3">Rule</th>
              {PROP_MODELS.map((m) => {
                const on = m.id === modelId;
                return (
                  <th key={m.id} className="w-[26%] px-1.5 pb-3 align-bottom">
                    <button
                      type="button"
                      onClick={() => onPick(m.id)}
                      className={cn("flex w-full items-center justify-between gap-2 rounded-t-[16px] border border-b-0 px-4 py-3 text-left transition-colors", on ? "border-ember/40 bg-ember-soft" : "border-line bg-surface-2 hover:bg-surface-3")}
                    >
                      <span>
                        <span className="flex items-center gap-1.5 text-[14px] font-medium text-fg">
                          {MODEL_ICON[m.id]} {m.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-fg-3">from {formatMoney(m.fees[5000], "USD", 0)}</span>
                      </span>
                      {on ? <Chip size="sm" tone="ember">Selected</Chip> : m.popular ? <Chip size="sm" tone="gold">Popular</Chip> : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label} className="group">
                <td className="border-t border-line py-3 pr-3 text-fg-2">
                  <span className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-fg-3">
                    {r.icon}
                    {r.label}
                  </span>
                </td>
                {PROP_MODELS.map((m) => {
                  const on = m.id === modelId;
                  return (
                    <td key={m.id} className="px-1.5 py-0">
                      <div
                        className={cn(
                          "h-full border-x border-t px-4 py-3 transition-colors",
                          on ? "border-x-ember/40 border-t-ember/15 bg-ember-soft/60" : "border-x-line border-t-line group-hover:bg-surface-2/60",
                          ri === rows.length - 1 && "rounded-b-[16px] border-b",
                          ri === rows.length - 1 && (on ? "border-b-ember/40" : "border-b-line"),
                        )}
                      >
                        {r.cell(m)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function RulesEngineCard() {
  return (
    <Card className="h-full">
      <CardHeader title="How the rules engine works" subtitle="Checked on every tick, 24/5" icon={<ShieldAlert />} />
      <div className="space-y-2 px-4 pb-4 pt-4 sm:px-6">
        {[
          { t: "Live monitoring", d: "Daily loss and drawdown are recalculated on every price tick, with floating P/L included.", c: "bg-info" },
          { t: "Early warnings", d: "Push and email alerts at 50%, 75% and 90% of any loss limit.", c: "bg-warn" },
          { t: "Breach → auto-fail", d: "If a limit is breached, all positions close at market and the account is disabled.", c: "bg-down" },
          { t: "Breach report", d: "A timestamped report with the tick, equity and position that triggered the breach.", c: "bg-fg-3" },
        ].map((x) => (
          <div key={x.t} className="k-row relative overflow-hidden py-3 pl-5 pr-4">
            <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", x.c)} />
            <div className="text-[13.5px] font-medium">{x.t}</div>
            <div className="mt-0.5 text-[12.5px] text-fg-3">{x.d}</div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-6 sm:px-6">
        <div className="k-label mb-2.5 flex items-center gap-2 text-down">
          <Ban className="size-3.5" /> Banned strategies
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BANNED_STRATEGIES.map((b) => (
            <div key={b.name} className="rounded-[14px] border border-down/20 bg-down-soft px-3.5 py-2.5">
              <div className="text-[13px] font-medium text-fg">{b.name}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-fg-3">{b.text}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export default function PropStorePage() {
  const [modelId, setModelId] = React.useState<PropModelId>("2-step");
  const [size, setSize] = React.useState<PropSize>(50000);
  return (
    <div className="pb-24">
      <PageHeader
        title="Prop challenges"
        subtitle="Prove your edge on simulated capital and get paid up to 90% of the profit."
        actions={
          <>
            <Link href="/prop/mine">
              <Button variant="surface" size="lg">
                <Trophy /> My challenges <Chip size="sm" tone="ember">3</Chip>
              </Button>
            </Link>
            <Button variant="ember" size="lg" shimmer onClick={() => document.getElementById("configure")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Start a challenge <ArrowUpRight />
            </Button>
          </>
        }
      />

      <Reveal>
        <Hero />
      </Reveal>

      <div id="configure" className="mt-4 grid scroll-mt-24 grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Configurator modelId={modelId} setModelId={setModelId} size={size} setSize={setSize} />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <PlanCard modelId={modelId} size={size} />
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4 block">
        <CompareTable modelId={modelId} size={size} onPick={setModelId} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader
              title="Frequently asked questions"
              subtitle="Everything about challenges, rules and payouts"
              icon={<Sparkles />}
              action={
                <Link href="/support" className="hidden sm:block">
                  <Button size="sm" variant="surface">
                    Ask support
                  </Button>
                </Link>
              }
            />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <Accordion items={PROP_FAQ} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <RulesEngineCard />
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4 block">
        <Card className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/photos/skyscrapers.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-transparent" />
          <div className="relative flex flex-col gap-5 p-7 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Icon3D name="gem_stone" size={64} className="hidden sm:block" />
              <div>
                <h3 className="text-xl font-medium tracking-tight">Already funded? Scale to $2,000,000.</h3>
                <p className="mt-1 text-sm text-fg-2">Hit 10% over 4 months and your account grows 25%, with your split rising to 90%.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/prop/payouts">
                <Button variant="gold" size="lg">
                  Scaling plan <ArrowRight />
                </Button>
              </Link>
              <Button variant="surface" size="lg" onClick={() => toast.success("Reminder set", { description: "We'll email you when the next promo code drops." })}>
                Notify me of promos
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

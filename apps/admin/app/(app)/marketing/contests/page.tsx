"use client";

import * as React from "react";
import { AlertTriangle, CalendarRange, FileText, Plus, Trophy, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  Flag,
  Icon3D,
  KpiCard,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Sparkline,
  StatusChip,
  cn,
} from "@kalks/ui";
import { MKT_CONTESTS, MKT_LEADERBOARD, type MktContest } from "@kalks/mock/admin-growth-marketing";
import { ContestWizard, rankIcon } from "@/components/marketing/contest-wizard";
import { daysFromToday, fmtDate, fmtInt, fmtK } from "@/components/marketing/kit";

type F = "all" | "running" | "scheduled" | "completed";

export default function ContestsPage() {
  const [wizard, setWizard] = React.useState(false);
  const [sel, setSel] = React.useState<MktContest>(MKT_CONTESTS[0]!);
  const [f, setF] = React.useState<F>("all");
  const running = MKT_CONTESTS.filter((c) => c.status === "running");
  const list = MKT_CONTESTS.filter((c) => f === "all" || c.status === f);

  return (
    <div className="pb-16">
      <PageHeader
        title="Contests"
        subtitle="Demo and live trading competitions with prize pools and live leaderboards."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Contest T&Cs v3.2", { description: "Last updated 12 Sep 2026 by Compliance" })}>
              <FileText /> Terms
            </Button>
            <Button variant="ember" shimmer onClick={() => setWizard(true)}>
              <Plus /> New contest
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Running contests" icon={<Trophy />} value={<span className="k-num">{running.length}</span>} chip={`${MKT_CONTESTS.filter((c) => c.status === "scheduled").length} scheduled`} />
        <KpiCard label="Entrants (running)" icon={<Users />} value={<span className="k-num">{fmtInt(running.reduce((s, c) => s + c.entrants, 0))}</span>} chip="+1,284 this week" chipTone="up" delay={0.05} />
        <KpiCard label="Live prize pools" icon={<Wallet />} value={<Money value={running.reduce((s, c) => s + c.prizePool, 0)} decimals={0} />} chip="Funded from marketing budget" delay={0.1} />
        <KpiCard label="Entrant → FTD" value={<span className="k-num">23.8%</span>} hot illustration="trophy" footer={<Chip tone="up">$1.42M deposits attributed</Chip>} delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="All contests"
              subtitle="Click a contest to see prizes and leaderboard"
              action={<Segmented size="xs" value={f} onChange={setF} options={[{ value: "all", label: "All" }, { value: "running", label: "Running" }, { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }]} />}
            />
            <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
              {list.map((c) => {
                const on = c.id === sel.id;
                const left = daysFromToday(c.end);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSel(c)}
                    className={cn("k-row relative flex w-full flex-wrap items-center gap-4 px-3 py-3 text-left transition-all hover:bg-surface-3/60 sm:flex-nowrap", on && "border-ember/40 bg-ember-soft/40 shadow-[0_0_30px_-14px_rgba(255,90,31,0.8)]")}
                  >
                    {on && <motion.span layoutId="ct-sel" className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-ember" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photo} alt="" className="h-12 w-16 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{c.name}</span>
                        <Chip size="sm" tone={c.type === "live" ? "ember" : "gold"}>
                          {c.type.toUpperCase()}
                        </Chip>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-fg-3">
                        <CalendarRange className="size-3.5 shrink-0" /> {fmtDate(c.start, false)} – {fmtDate(c.end)} · {c.metric} · {c.instruments}
                      </div>
                    </div>
                    <div className="hidden w-36 md:block">
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="k-num text-fg-2">{fmtInt(c.entrants)}</span>
                        <span className="k-num text-fg-3">/ {fmtK(c.capacity)}</span>
                      </div>
                      <Progress value={(c.entrants / c.capacity) * 100} tone={c.type === "live" ? "ember" : "gold"} />
                    </div>
                    <div className="w-24 text-right">
                      <Money value={c.prizePool} decimals={0} countUp={false} className="text-[14px] font-semibold text-gold" />
                      <div className="text-[11px] text-fg-3">prize pool</div>
                    </div>
                    <div className="w-28 text-right">
                      <StatusChip status={c.status} label={c.status === "scheduled" ? "Scheduled" : undefined} />
                      <div className="k-num mt-1 text-[11px] text-fg-3">{c.status === "running" ? `${left}d left` : c.status === "scheduled" ? `starts in ${daysFromToday(c.start)}d` : c.status === "completed" ? "Paid out" : "Not published"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <PrizeCard c={sel} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <LeaderboardCard c={sel} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <IntegrityCard />
        </Reveal>
      </div>

      <ContestWizard open={wizard} onOpenChange={setWizard} />
    </div>
  );
}

function PrizeCard({ c }: { c: MktContest }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative h-36 shrink-0 overflow-hidden rounded-t-[20px]">
        <motion.img key={c.photo} src={c.photo} alt="" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 0.75, scale: 1 }} transition={{ duration: 0.6 }} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
        <div className="absolute inset-x-6 bottom-4">
          <Chip size="sm" tone={c.type === "live" ? "ember" : "gold"}>
            {c.type === "live" ? "LIVE ACCOUNTS" : "DEMO ACCOUNTS"}
          </Chip>
          <div className="mt-1.5 text-[19px] font-medium tracking-tight">{c.name}</div>
        </div>
        <Icon3D name="trophy" size={72} className="absolute right-4 top-4" />
      </div>
      <div className="flex items-center justify-between px-6 pt-4">
        <span className="k-label">Prize table</span>
        <Money value={c.prizePool} decimals={0} countUp={false} className="text-[15px] font-semibold text-gold" />
      </div>
      <div className="mt-3 flex-1 space-y-2 px-4 pb-4 sm:px-6">
        {c.prizes.map((p, i) => {
          const ic = rankIcon(i);
          return (
            <motion.div key={`${c.id}-${p.rank}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={cn("k-row flex items-center gap-3 px-3 py-2", i === 0 && "border-gold/30 bg-gold-soft")}>
              <Icon3D name={ic.name} size={i < 3 ? 32 : 26} className={ic.cls} />
              <span className="flex-1 text-[13.5px] font-medium">{p.rank}</span>
              <span className="text-right">
                <Money value={p.prize} decimals={0} countUp={false} className={cn("text-[14px] font-semibold", i === 0 && "text-gold")} />
                {p.label && <span className="ml-1 text-[11px] text-fg-3">{p.label}</span>}
              </span>
            </motion.div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-line px-6 py-4 text-center">
        <div>
          <div className="k-num text-[15px] font-medium">{fmtInt(c.entrants)}</div>
          <div className="text-[11px] text-fg-3">entrants</div>
        </div>
        <div>
          <div className="k-num text-[15px] font-medium">{c.minDeposit ? `$${fmtInt(c.minDeposit)}` : "Free"}</div>
          <div className="text-[11px] text-fg-3">min deposit</div>
        </div>
        <div>
          <div className="text-[15px] font-medium">{c.metric}</div>
          <div className="text-[11px] text-fg-3">ranking</div>
        </div>
      </div>
    </Card>
  );
}

function LeaderboardCard({ c }: { c: MktContest }) {
  const top = MKT_LEADERBOARD.slice(0, 3);
  const podium = [top[1]!, top[0]!, top[2]!];
  const heights = ["h-20", "h-28", "h-16"];
  return (
    <Card className="h-full">
      <CardHeader
        title="Leaderboard preview"
        subtitle={`${c.name} · updated 13:30 GMT+3`}
        action={
          <Button size="sm" variant="surface" onClick={() => toast.success("Leaderboard snapshot exported", { description: `${c.name} · top 100` })}>
            Export
          </Button>
        }
      />
      <div className="mt-2 grid grid-cols-1 gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col justify-center">
        <div className="flex items-end justify-center gap-3 border-b border-line pt-4">
          {podium.map((l, i) => {
            const rank = l.rank - 1;
            const ic = rankIcon(rank);
            return (
              <div key={l.login} className="flex w-[82px] flex-col items-center">
                <div className="relative">
                  <Avatar src={l.person.photo} name={l.person.name} size={rank === 0 ? 60 : 48} className={cn("rounded-full", rank === 0 && "ring-2 ring-gold/70 shadow-[0_0_30px_-4px_rgba(233,185,73,0.6)] rounded-full")} />
                  <Icon3D name={ic.name} size={26} className={cn("absolute -bottom-2 -right-2", ic.cls)} />
                </div>
                <div className="mt-3 w-full truncate text-center text-[12px] font-medium">{l.person.name.split(" ")[0]}</div>
                <div className="k-num text-[12px] font-semibold text-up">+{l.gainPct.toFixed(1)}%</div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className={cn("mt-2 grid w-full place-items-start justify-center rounded-t-xl border border-b-0 pt-2", heights[i], rank === 0 ? "border-gold/30 bg-gradient-to-b from-gold/25 to-transparent" : "border-line bg-gradient-to-b from-surface-3 to-transparent")}
                >
                  <span className={cn("k-num text-[20px] font-semibold", rank === 0 ? "text-gold" : "text-fg-2")}>{l.rank}</span>
                </motion.div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[["Avg gain", "+38.4%"], ["Qualified", "1,211"], ["Volume", "84.2k lots"]].map(([k, v]) => (
            <div key={k} className="k-row px-2 py-2">
              <div className="k-num text-[13px] font-medium">{v}</div>
              <div className="text-[10.5px] text-fg-3">{k}</div>
            </div>
          ))}
        </div>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
                <th className="pb-2 text-left font-medium">#</th>
                <th className="pb-2 text-left font-medium">Trader</th>
                <th className="pb-2 text-right font-medium">Gain</th>
                <th className="pb-2 text-right font-medium">Equity</th>
                <th className="hidden pb-2 text-right font-medium md:table-cell">Trades</th>
                <th className="pb-2 text-right font-medium">Curve</th>
              </tr>
            </thead>
            <tbody>
              {MKT_LEADERBOARD.slice(0, 8).map((l) => (
                <tr key={l.login} className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2/60" onClick={() => toast.info(`${l.person.name} · ${l.login}`, { description: `Win rate ${l.winRate}% · ${l.trades} trades` })}>
                  <td className="py-2 pr-2">
                    <span className={cn("k-num grid size-6 place-items-center rounded-full text-[11px] font-semibold", l.rank <= 3 ? "bg-gold-soft text-gold" : "bg-surface-3 text-fg-2")}>{l.rank}</span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={l.person.photo} name={l.person.name} size={28} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-medium">
                          {l.person.name} <Flag country={l.person.country} className="size-3.5" />
                        </div>
                        <div className="font-mono text-[11px] text-fg-3">{l.login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="k-num py-2 text-right font-semibold text-up">+{l.gainPct.toFixed(2)}%</td>
                  <td className="py-2 text-right">
                    <Money value={l.equity} countUp={false} />
                  </td>
                  <td className="k-num hidden py-2 text-right text-fg-2 md:table-cell">{l.trades}</td>
                  <td className="py-2 text-right">
                    <Sparkline data={l.spark} width={70} height={22} tone="up" className="ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function IntegrityCard() {
  const flags = [
    { p: MKT_LEADERBOARD[4]!, rule: "Opposite positions with linked account", sev: "down" as const },
    { p: MKT_LEADERBOARD[7]!, rule: "62% of trades held under 60 seconds", sev: "warn" as const },
    { p: MKT_LEADERBOARD[10]!, rule: "Same device as entrant 80412337", sev: "down" as const },
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Integrity checks" subtitle="Flagged entrants awaiting review" icon={<AlertTriangle />} action={<Chip tone="down" dot>{flags.length}</Chip>} />
      <div className="mt-4 flex-1 space-y-2 px-4 sm:px-6">
        {flags.map((x) => (
          <div key={x.p.login} className="k-row relative overflow-hidden px-4 py-3 pl-5">
            <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", x.sev === "down" ? "bg-down" : "bg-warn")} />
            <div className="flex items-center gap-2.5">
              <Avatar src={x.p.person.photo} name={x.p.person.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{x.p.person.name}</div>
                <div className="font-mono text-[11px] text-fg-3">{x.p.login} · rank #{x.p.rank}</div>
              </div>
            </div>
            <div className="mt-2 text-[12.5px] text-fg-2">{x.rule}</div>
            <div className="mt-2.5 flex gap-1.5">
              <Button size="xs" variant="down-outline" onClick={() => toast.warning(`${x.p.person.name} disqualified`, { description: "Entrant notified · logged to audit trail" })}>
                Disqualify
              </Button>
              <Button size="xs" variant="surface" onClick={() => toast.success(`${x.p.person.name} cleared`)}>
                Clear flag
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-5 pt-3 sm:px-6">
        <div className="text-[11.5px] text-fg-3">Auto-checks run every 15 minutes on all running contests.</div>
      </div>
    </Card>
  );
}

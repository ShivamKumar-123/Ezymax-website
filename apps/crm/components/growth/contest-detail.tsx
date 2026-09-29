"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, ListChecks, ShieldAlert, Timer, Trophy, Users } from "lucide-react";
import { Button, Card, CardHeader, Chip, KeyValue, Money, PageHeader, Reveal, cn } from "@kalks/ui";
import { TERMINAL_URL } from "@/lib/live";
import { Countdown } from "@/components/rewards/countdown";
import { bandLabel, fmtDate, fmtDateTime, fmtLots, fmtPct, fmtUsd, prizeZone, scoringLabel, useGrowth, type ContestDetail } from "./api";
import { JoinContestButton, Leaderboard, canJoin, isPast, isRunning, isUpcoming, kindChip, scoreText, tradesHint } from "./contests";
import { CardEmpty, GrowthStatus, PageFallback, RankBadge } from "./ui";

function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="k-row px-3.5 py-3">
      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 text-[18px] font-semibold leading-none", className)}>{value}</div>
    </div>
  );
}

function MyEntry({ d }: { d: ContestDetail }) {
  const c = d.contest;
  const me = d.myEntry;
  if (!me)
    return (
      <Card className="h-full">
        <CardHeader title="Your entry" subtitle="You haven't joined this contest" />
        <div className="px-4 pb-6 pt-4 sm:px-6">
          <CardEmpty title={canJoin(c) ? "Join to start ranking" : isPast(c) ? "This contest has ended" : "Entries are closed"} text={canJoin(c) ? "Your rank, score and trades appear here after you join." : undefined} />
        </div>
      </Card>
    );
  const dq = me.status === "disqualified";
  const hint = tradesHint(c, me);
  const zone = prizeZone(c);
  const good = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "");
  return (
    <Card className="h-full" data-testid="contest-my-entry">
      <CardHeader
        title="Your entry"
        subtitle={me.login ? `Account #${me.login} · updated ${fmtDateTime(me.updatedAt)}` : `Updated ${fmtDateTime(me.updatedAt)}`}
        action={dq ? <GrowthStatus status="disqualified" /> : me.rank && zone && me.rank <= zone ? <Chip tone="gold">Prize zone</Chip> : null}
      />
      <div className="space-y-3 px-4 pb-6 pt-4 sm:px-6">
        {dq && (
          <div className="flex items-start gap-3 rounded-[14px] border border-down/30 bg-down-soft px-4 py-3 text-[12.5px] text-down" data-testid="contest-disqualified">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>This entry was disqualified by the contest review and is not ranked or eligible for a prize. Contact support if you think this is a mistake.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Rank" value={dq ? "—" : me.rank ? `#${me.rank}` : "—"} />
          <Stat label={scoringLabel(c.scoring)} value={scoreText(c, me)} className={c.scoring === "lots" ? "" : good(c.scoring === "profit" ? me.profit : me.returnPct)} />
          <Stat label="Return" value={fmtPct(+me.returnPct.toFixed(2), true)} className={good(me.returnPct)} />
          <Stat label="Profit" value={fmtUsd(me.profit)} className={good(me.profit)} />
          <Stat label="Trades" value={me.trades} />
          <Stat label="Lots" value={fmtLots(me.lots)} />
        </div>
        {hint && !dq && (
          <div className="flex items-center justify-between rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12.5px] text-warn" data-testid="contest-trades-hint">
            <span>{hint}. Entries below the minimum rank after everyone who qualifies.</span>
          </div>
        )}
        {me.prize ? (
          <div className="flex items-center justify-between rounded-[12px] border border-gold/25 bg-gold-soft px-3 py-2 text-[12.5px] text-gold">
            <span>
              Prize {fmtUsd(me.prize, 0)}
              {me.prizeStatus ? ` · ${me.prizeStatus.replace(/_/g, " ")}` : ""}
            </span>
            <Trophy className="size-3.5 shrink-0" />
          </div>
        ) : null}
        {isRunning(c) && !dq && (
          <a href={TERMINAL_URL} target="_blank" rel="noopener" className="block">
            <Button variant="surface" className="w-full">
              Trade in Kalks Trader <ArrowUpRight />
            </Button>
          </a>
        )}
      </div>
    </Card>
  );
}

function Rules({ d }: { d: ContestDetail }) {
  const c = d.contest;
  const lines = c.rules
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  const auto = [
    `Ranked by ${scoringLabel(c.scoring).toLowerCase()}${c.scoring === "return_pct" ? " (realised + floating P&L ÷ starting equity)" : c.scoring === "profit" ? " (realised + floating P&L)" : " (lots closed)"}.`,
    "Only deals closed inside the contest window on the entered account count.",
    c.minTrades > 0 ? `At least ${c.minTrades} trade${c.minTrades === 1 ? "" : "s"} to rank; entries below that rank after everyone who qualifies.` : null,
    "Ties go to the earlier entry.",
    c.antiCheat.disqualifyOnBalanceChange ? "Deposits, withdrawals, transfers or adjustments on the account during the contest disqualify the entry." : "Balance changes on the account during the contest are reviewed.",
    c.antiCheat.minHoldSeconds > 0 ? `Trades held under ${c.antiCheat.minHoldSeconds} s are reviewed.` : null,
    c.antiCheat.maxSingleTradePct > 0 ? `One trade may not exceed ${c.antiCheat.maxSingleTradePct}% of total profit.` : null,
  ].filter((x): x is string => !!x);
  return (
    <Card className="h-full">
      <CardHeader title="Rules" subtitle="Read before you trade" icon={<ListChecks />} />
      <ul className="space-y-2 px-4 pb-4 pt-4 sm:px-6">
        {[...lines, ...auto].map((r, i) => (
          <li key={i} className="k-row flex items-start gap-2.5 px-3.5 py-2.5 text-[13px] text-fg-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-up" />
            {r}
          </li>
        ))}
      </ul>
      <div className="px-4 pb-5 sm:px-6">
        <KeyValue
          rows={[
            ["Type", c.kind === "demo" ? `Demo${c.startingBalance ? ` · ${fmtUsd(c.startingBalance, 0)} starting balance` : ""}` : "Live account"],
            ["Window", `${fmtDateTime(c.startsAt)} – ${fmtDateTime(c.endsAt)}`],
            ...(c.accountGroups.length ? ([["Account types", c.accountGroups.join(", ")]] as [string, string][]) : []),
            ...(c.minEquity ? ([["Minimum equity", fmtUsd(c.minEquity, 0)]] as [string, string][]) : []),
            ["Verification", c.kycRequired ? "Verified clients only" : "Not required"],
            ["Seats", c.maxEntrants ? `${d.entrants.toLocaleString("en-US")} / ${c.maxEntrants.toLocaleString("en-US")}` : `${d.entrants.toLocaleString("en-US")} joined · unlimited`],
          ]}
        />
      </div>
    </Card>
  );
}

function PrizesTable({ d }: { d: ContestDetail }) {
  const c = d.contest;
  return (
    <Card className="h-full">
      <CardHeader title="Prizes" subtitle={`Pool ${fmtUsd(c.prizePool, 0)} · paid after the results are final`} icon={<Trophy />} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {c.prizes.length === 0 ? (
          <CardEmpty title="No cash prizes" text="This contest is for ranking only." />
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.05em] text-fg-3">
                  <th className="px-4 py-2.5 text-left font-medium">Rank</th>
                  <th className="px-4 py-2.5 text-right font-medium">Prize</th>
                  <th className="px-4 py-2.5 text-right font-medium">Paid as</th>
                </tr>
              </thead>
              <tbody>
                {c.prizes.map((p) => (
                  <tr key={`${p.rankFrom}-${p.rankTo}`} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <RankBadge rank={p.rankFrom} size={22} />
                        <span className="k-num font-medium">{bandLabel(p)}</span>
                      </span>
                    </td>
                    <td className="k-num px-4 py-2.5 text-right font-semibold text-gold">
                      {fmtUsd(p.amount, 0)}
                      {p.rankTo > p.rankFrom ? <span className="font-normal text-fg-3"> each</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right text-fg-2">{p.payout === "credit" ? "Trading credit" : "Wallet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

export function LiveContestDetail({ id }: { id: string }) {
  const { data, error, reload } = useGrowth<ContestDetail>(`contests/${encodeURIComponent(id)}`, 15_000);
  const back = (
    <Link href="/rewards" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg">
      <ArrowLeft className="size-3.5" /> All contests
    </Link>
  );
  if (!data)
    return (
      <div>
        {back}
        <PageFallback title="Contest" subtitle="Rules, prizes and the leaderboard" error={error} onRetry={reload} rows={[{ cols: "", h: "h-[220px]", n: 1 }, { cols: "xl:grid-cols-2", h: "h-[320px]", n: 2 }]} />
      </div>
    );
  const c = data.contest;
  const running = isRunning(c);
  return (
    <div className="pb-16">
      {back}
      <PageHeader title={c.name} subtitle={c.description || `${c.kind === "demo" ? "Demo" : "Live"} contest · ranked by ${scoringLabel(c.scoring).toLowerCase()}`} />

      <Reveal>
        <Card hot className="overflow-hidden">
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <GrowthStatus status={c.status} />
                {kindChip(c)}
                <Chip>
                  {fmtDate(c.startsAt, false)} – {fmtDate(c.endsAt)}
                </Chip>
                <Chip>
                  <Users className="size-3" /> {data.entrants.toLocaleString("en-US")} joined
                </Chip>
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
                <div>
                  <div className="k-label">Prize pool</div>
                  <Money value={c.prizePool} decimals={0} countUp={false} className="mt-1.5 block text-[40px] font-semibold leading-none tracking-tight text-gold" />
                </div>
                {(running || isUpcoming(c)) && (
                  <div>
                    <div className="k-label mb-2 flex items-center gap-1.5">
                      <Timer className="size-3.5" /> {running ? "Ends in" : "Starts in"}
                    </div>
                    <Countdown to={running ? c.endsAt : c.startsAt} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {data.myEntry ? (
                <Button variant="up-outline" size="lg" disabled className="disabled:opacity-100">
                  <Check /> Joined{data.myEntry.login ? ` · #${data.myEntry.login}` : ""}
                </Button>
              ) : canJoin(c) ? (
                <JoinContestButton c={c} onJoined={reload} />
              ) : (
                <Button variant="surface" size="lg" disabled>
                  {isPast(c) ? "Contest ended" : "Entries closed"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-5">
          <MyEntry d={data} />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-7">
          <PrizesTable d={data} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Leaderboard d={data} title={running ? "Live leaderboard" : "Leaderboard"} podium={false} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Rules d={data} />
        </Reveal>
      </div>
    </div>
  );
}

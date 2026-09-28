"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronUp, Crown, Minus, Timer, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Delta, Dialog, DialogClose, Flag, Icon3D, KeyValue, Money, Segmented, Sparkline, Starfield, cn, formatMoney } from "@kalks/ui";
import { ACTIVE_CONTEST, LEADERBOARD, PAST_CONTESTS, UPCOMING_CONTESTS, type Contest, type LeaderRow } from "@kalks/mock/rewards";
import { Countdown } from "./countdown";

const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));

/* ------------------------------------------------------------------ */
/* Rank medal                                                          */
/* ------------------------------------------------------------------ */

export function RankBadge({ rank, size = 30 }: { rank: number; size?: number }) {
  if (rank === 1) return <Icon3D name="1st_place_medal" size={size + 4} className="-my-1" />;
  if (rank === 2 || rank === 3)
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-[12px] font-bold text-black/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_14px_-6px_rgba(0,0,0,0.6)]",
          rank === 2 ? "bg-[radial-gradient(circle_at_30%_25%,#ffffff,#c7ccd4_45%,#7a818c)]" : "bg-[radial-gradient(circle_at_30%_25%,#ffd9b8,#d98b4a_45%,#8a4b1f)]",
        )}
        style={{ width: size, height: size }}
      >
        {rank}
      </span>
    );
  return (
    <span className="k-num grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-[12px] font-semibold text-fg-2" style={{ width: size, height: size }}>
      {rank}
    </span>
  );
}

function RankMove({ v }: { v: number }) {
  if (v === 0) return <Minus className="size-3 text-fg-3" />;
  return (
    <span className={cn("k-num inline-flex items-center text-[10.5px] font-medium", v > 0 ? "text-up" : "text-down")}>
      {v > 0 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      {Math.abs(v)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export function ContestHero() {
  const c = ACTIVE_CONTEST;
  const [joined, setJoined] = React.useState(c.joined);
  const total = Date.parse(c.endsAt) - Date.parse(c.startsAt);
  const elapsed = Date.parse("2026-09-24T16:00:00Z") - Date.parse(c.startsAt);
  const pctTime = (elapsed / total) * 100;
  const pctRank = 100 - (c.myRank / c.participants) * 100;
  return (
    <Card className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="absolute inset-0 size-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(255,90,31,0.28),transparent_60%)]" />
      <Starfield density={50} />
      <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-7 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="ember" dot>
              <span className="animate-pulse">Live now</span>
            </Chip>
            <Chip tone="gold">
              <Crown className="size-3" /> Live contest · free entry
            </Chip>
            <Chip>
              {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)}
            </Chip>
          </div>
          <h2 className="mt-4 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[36px]">{c.name}</h2>
          <p className="mt-1.5 max-w-lg text-[14px] text-fg-2">{c.tagline}</p>

          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
            <div>
              <div className="k-label">Prize pool</div>
              <Money value={c.prizePool} decimals={0} className="mt-1.5 block text-[40px] font-semibold leading-none tracking-tight text-gold sm:text-[46px]" />
            </div>
            <div>
              <div className="k-label mb-2 flex items-center gap-1.5">
                <Timer className="size-3.5" /> Ends in
              </div>
              <Countdown to={c.endsAt} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {joined ? (
              <Button
                variant="up-outline"
                size="lg"
                onClick={() => {
                  setJoined(false);
                  toast("You left Autumn Gold Rush", { description: "Your contest account #70220418 has been archived." });
                }}
              >
                <Check /> Joined · account #70220418
              </Button>
            ) : (
              <Button
                variant="ember"
                size="lg"
                shimmer
                onClick={() => {
                  setJoined(true);
                  toast.success("You're in! Contest account #70220418 created", { description: "$1,000 starting balance · Kalks-Contest01" });
                }}
              >
                Join contest <ArrowUpRight />
              </Button>
            )}
            <Link target="_blank" rel="noopener" href="/trade?account=70220418">
              <Button variant="surface" size="lg">
                Trade contest account
              </Button>
            </Link>
            <RulesDialog />
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className="rounded-[18px] border border-white/10 bg-black/40 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={LEADERBOARD.at(-1)!.person.photo} name="Arjun Mehta" size={44} verified />
                <div>
                  <div className="text-[14px] font-medium">Your standing</div>
                  <div className="text-[12px] text-fg-3">Top {(100 - pctRank).toFixed(1)}% of traders</div>
                </div>
              </div>
              <Chip tone="up">
                <ChevronUp className="size-3" /> 5 today
              </Chip>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="k-row px-3 py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Rank</div>
                <div className="k-num mt-1 text-[19px] font-semibold leading-none sm:text-[22px]">
                  #{c.myRank}
                  <span className="mt-1 block text-[10.5px] font-normal text-fg-3 sm:ml-1 sm:mt-0 sm:inline">of {c.participants.toLocaleString()}</span>
                </div>
              </div>
              <div className="k-row px-3 py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Gain</div>
                <div className="k-num mt-1 text-[17px] font-semibold leading-none text-up sm:text-[22px]">+{c.myGainPct}%</div>
              </div>
              <div className="k-row px-3 py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Equity</div>
                <Money value={c.myEquity} className="mt-1 block text-[15px] font-semibold leading-none sm:text-[18px]" />
              </div>
            </div>
            <div className="mt-4">
              <Sparkline data={LEADERBOARD.at(-1)!.curve} width={400} height={56} tone="gold" className="w-full" />
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <div>
                <div className="mb-1.5 flex justify-between text-fg-3">
                  <span>Contest progress</span>
                  <span className="k-num text-fg-2">Day 18 of 28</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#e8431a]" style={{ width: `${pctTime}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[12px] border border-gold/25 bg-gold-soft px-3 py-2 text-gold">
                <span>+16.72% more gain puts you in the prize zone (#10 · $800)</span>
                <Trophy className="size-3.5 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RulesDialog() {
  const c = ACTIVE_CONTEST;
  return (
    <Dialog
      title="Autumn Gold Rush · rules & prizes"
      description="Live contest · server time GMT+3"
      trigger={
        <Button variant="ghost" size="lg">
          Rules & prizes
        </Button>
      }
      footer={
        <DialogClose asChild>
          <Button variant="ember" onClick={() => toast.success("Rules accepted")}>
            Got it
          </Button>
        </DialogClose>
      }
    >
      <ul className="space-y-2">
        {c.rules.map((r) => (
          <li key={r} className="k-row flex items-start gap-2.5 px-3.5 py-2.5 text-[13px] text-fg-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-up" />
            {r}
          </li>
        ))}
      </ul>
      <div className="k-label mb-2 mt-5">Prize table</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {c.prizes.map((p, i) => (
          <div key={i} className="k-row flex items-center gap-2 px-3 py-2">
            <RankBadge rank={i + 1} size={20} />
            <span className="k-num text-[13px] font-medium">${p.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <KeyValue className="mt-4" rows={[["Instruments", c.instruments], ["Minimum deposit to claim", `$${c.minDeposit}`], ["Payout", "To USDT wallet within 3 business days"]]} />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

function LeaderRowView({ r, i }: { r: LeaderRow; i: number }) {
  const top = r.rank <= 3;
  return (
    <div
      className={cn(
        "k-row grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-3/60 sm:grid-cols-[40px_minmax(0,1.6fr)_90px_110px_90px_90px] sm:px-4",
        top && "border-gold/20 bg-[linear-gradient(90deg,rgba(233,185,73,0.10),transparent_60%)]",
        r.isMe && "border-ember/40 bg-[linear-gradient(90deg,rgba(255,90,31,0.16),transparent_70%)] shadow-[0_0_30px_-12px_rgba(255,90,31,0.6)]",
      )}
      style={{ animationDelay: `${i * 30}ms` }}
    >
      <div className="flex justify-center">
        <RankBadge rank={r.rank} />
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar src={r.person.photo} name={r.person.name} size={34} />
          <Flag country={r.person.country} className="absolute -bottom-1 -right-1 size-3.5 ring-2 ring-surface-2" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
            <span className="truncate">{r.isMe ? "You · Arjun M." : r.person.name}</span>
            {r.isMe && (
              <Chip size="sm" tone="ember">
                You
              </Chip>
            )}
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-fg-3">
            <span className="k-num">{r.trades} trades</span>
            <span className="hidden sm:inline">·</span>
            <span className="k-num hidden sm:inline">{r.winRate}% win</span>
            <RankMove v={r.change} />
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        <Sparkline data={r.curve} width={84} height={26} tone={top ? "gold" : r.isMe ? "ember" : "up"} />
      </div>
      <div className="text-right sm:text-right">
        <Delta value={r.gainPct} className="text-[14px]" />
        <Money value={r.equity} countUp={false} className="block text-[11px] text-fg-3 sm:hidden" />
      </div>
      <Money value={r.equity} countUp={false} className="hidden text-right text-[13px] text-fg-2 sm:block" />
      <div className="hidden text-right sm:block">
        {r.prize ? (
          <span className={cn("k-num text-[13.5px] font-semibold", top ? "text-gold" : "text-fg")}>${r.prize.toLocaleString()}</span>
        ) : (
          <span className="text-[12px] text-fg-3">—</span>
        )}
      </div>
    </div>
  );
}

export function Leaderboard() {
  const [scope, setScope] = React.useState<"global" | "country" | "friends">("global");
  const rows = LEADERBOARD.filter((r) => !r.isMe);
  const me = LEADERBOARD.find((r) => r.isMe)!;
  const shown = scope === "global" ? rows.slice(0, 10) : scope === "country" ? rows.filter((r) => ["in", "ae", "sg", "gb", "de"].includes(r.person.country)).slice(0, 6) : rows.slice(3, 8);
  const podium = rows.slice(0, 3);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Live leaderboard"
        subtitle={
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-up" /> Updated every 60s · 2,318 traders
          </span>
        }
        action={<Segmented size="xs" className="hidden sm:inline-flex" value={scope} onChange={setScope} options={[{ value: "global", label: "Global" }, { value: "country", label: "Region" }, { value: "friends", label: "Friends" }]} />}
      />
      <div className="mt-3 px-4 sm:hidden">
        <Segmented size="xs" value={scope} onChange={setScope} options={[{ value: "global", label: "Global" }, { value: "country", label: "Region" }, { value: "friends", label: "Friends" }]} />
      </div>

      {/* Podium */}
      <div className="mt-5 grid grid-cols-3 items-end gap-2 px-4 sm:gap-3 sm:px-6">
        {[podium[1]!, podium[0]!, podium[2]!].map((r) => {
          const first = r.rank === 1;
          return (
            <div
              key={r.rank}
              className={cn(
                "relative flex flex-col items-center rounded-[18px] border px-2 pb-4 text-center",
                first ? "border-gold/30 bg-[linear-gradient(180deg,rgba(233,185,73,0.16),rgba(233,185,73,0.02))] pt-5" : "border-line bg-surface-2 pt-4",
              )}
            >
              {first && <Icon3D name="trophy" size={40} className="absolute -top-5 right-2 hidden sm:block" />}
              <div className="relative">
                <Avatar src={r.person.photo} name={r.person.name} size={first ? 60 : 48} className={first ? "ring-2 ring-gold/60 rounded-full" : ""} />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <RankBadge rank={r.rank} size={22} />
                </span>
              </div>
              <div className="mt-4 flex max-w-full items-center gap-1.5 text-[12.5px] font-medium">
                <Flag country={r.person.country} className="size-3.5" />
                <span className="truncate">{r.person.name.split(" ")[0]}</span>
              </div>
              <Delta value={r.gainPct} className={cn("mt-1", first ? "text-[17px]" : "text-[14px]")} />
              <div className={cn("k-num mt-1 text-[12px] font-semibold", first ? "text-gold" : "text-fg-2")}>${r.prize.toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 hidden grid-cols-[40px_minmax(0,1.6fr)_90px_110px_90px_90px] gap-3 px-8 text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3 sm:grid">
        <span className="text-center">#</span>
        <span>Trader</span>
        <span>Equity curve</span>
        <span className="text-right">Gain</span>
        <span className="text-right">Equity</span>
        <span className="text-right">Prize</span>
      </div>
      <div className="mt-2 flex-1 space-y-1.5 px-4 sm:px-6">
        {shown.map((r, i) => (
          <LeaderRowView key={r.rank} r={r} i={i} />
        ))}
      </div>
      <div className="mt-2 px-4 sm:px-6">
        <div className="flex items-center gap-2 py-1.5 text-[11px] text-fg-3">
          <span className="h-px flex-1 bg-line" /> Prize zone ends at #10 <span className="h-px flex-1 bg-line" />
        </div>
      </div>
      <div className="space-y-1.5 px-4 pb-5 sm:px-6">
        {scope === "global" && rows.slice(10, 13).map((r, i) => <LeaderRowView key={r.rank} r={r} i={i} />)}
        <LeaderRowView r={me} i={0} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Prize distribution                                                  */
/* ------------------------------------------------------------------ */

export function PrizeCard() {
  const c = ACTIVE_CONTEST;
  const max = c.prizes[0]!;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Prize distribution" subtitle="Top 10 paid in USDT" action={<Icon3D name="money_bag" size={36} />} />
      <div className="mt-4 flex-1 space-y-1.5 px-4 pb-4 sm:px-6">
        {c.prizes.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6">
              <RankBadge rank={i + 1} size={20} />
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", i === 0 ? "bg-gradient-to-r from-[#c9971f] to-[#f3cf6b]" : i < 3 ? "bg-gold/35" : "bg-surface-3")}
                style={{ width: `${Math.max(12, (p / max) * 100)}%` }}
              />
              <span className={cn("k-num relative flex h-full items-center px-3 text-[12px] font-semibold", i === 0 ? "text-[#1a1204]" : "text-fg")}>${p.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line px-4 py-4 sm:px-6">
        <div className="k-row px-3 py-2.5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Ranks 11–100</div>
          <div className="k-num mt-0.5 text-[13px] font-medium">$95 each</div>
        </div>
        <div className="k-row px-3 py-2.5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Everyone</div>
          <div className="k-num mt-0.5 text-[13px] font-medium">+500 pts</div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Upcoming / past                                                     */
/* ------------------------------------------------------------------ */

function ContestPhoto({ c, children }: { c: Contest; children?: React.ReactNode }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-t-[20px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
      <div className="absolute left-4 top-4 flex gap-1.5">
        <Chip tone={c.kind === "live" ? "ember" : "gold"} className="bg-black/60 backdrop-blur-md">
          {c.kind === "live" ? "LIVE" : "DEMO"}
        </Chip>
        {!c.winner && (c.entryFee ? <Chip className="bg-black/60 backdrop-blur-md">Entry ${c.entryFee}</Chip> : <Chip tone="up" className="bg-black/60 backdrop-blur-md">Free entry</Chip>)}
        {c.winner && <Chip className="bg-black/60 backdrop-blur-md">Ended</Chip>}
      </div>
      {children}
    </div>
  );
}

export function UpcomingContests() {
  const [reg, setReg] = React.useState<Record<string, boolean>>({});
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {UPCOMING_CONTESTS.map((c) => {
        const fill = c.maxParticipants ? (c.participants / c.maxParticipants) * 100 : null;
        return (
          <Card key={c.id} className="group flex flex-col overflow-hidden">
            <ContestPhoto c={c}>
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-fg-2">Prize pool</div>
                  <div className="k-num text-[24px] font-semibold leading-tight text-gold">${c.prizePool.toLocaleString()}</div>
                </div>
                <Chip>
                  <Timer className="size-3" /> <Countdown to={c.startsAt} compact className="text-[11px]" />
                </Chip>
              </div>
            </ContestPhoto>
            <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
              <div className="text-[16px] font-medium tracking-tight">{c.name}</div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">{c.tagline}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                <div className="k-row flex items-center gap-2 px-3 py-2">
                  <CalendarDays className="size-3.5 text-fg-3" />
                  <span className="k-num">
                    {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)}
                  </span>
                </div>
                <div className="k-row flex items-center gap-2 px-3 py-2">
                  <Users className="size-3.5 text-fg-3" />
                  <span className="k-num">{c.participants.toLocaleString()} joined</span>
                </div>
              </div>
              <div className="mt-2 truncate text-[11.5px] text-fg-3">{c.instruments}{c.minDeposit ? ` · min deposit $${c.minDeposit}` : ""}</div>
              {fill !== null && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-fg-3">
                    <span>Seats</span>
                    <span className="k-num">
                      {c.participants.toLocaleString()} / {c.maxParticipants!.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-ember" style={{ width: `${fill}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-auto flex items-center gap-2 pt-4">
                <Button
                  size="sm"
                  variant={reg[c.id] ? "up-outline" : "ember"}
                  className="flex-1"
                  onClick={() => {
                    setReg((s) => ({ ...s, [c.id]: !s[c.id] }));
                    if (reg[c.id]) toast(`Registration for ${c.name} cancelled`);
                    else toast.success(`Registered for ${c.name}`, { description: `We'll open your ${c.kind} contest account on ${fmtDate(c.startsAt)}.${c.entryFee ? ` $${c.entryFee} will be charged from your wallet.` : ""}` });
                  }}
                >
                  {reg[c.id] ? (
                    <>
                      <Check /> Registered
                    </>
                  ) : (
                    "Register"
                  )}
                </Button>
                <Button size="sm" variant="surface" onClick={() => toast("Reminder set", { description: `We'll notify you 1 hour before ${c.name} starts.` })}>
                  Remind me
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function PastContests() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PAST_CONTESTS.map((c) => (
        <Card key={c.id} className="group flex flex-col overflow-hidden">
          <ContestPhoto c={c}>
            <div className="absolute bottom-3 left-4">
              <div className="text-[15px] font-medium">{c.name}</div>
              <div className="k-num text-[11.5px] text-fg-2">
                {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)} · {c.participants.toLocaleString()} traders
              </div>
            </div>
          </ContestPhoto>
          <div className="px-4 pb-4 pt-3">
            <div className="k-row flex items-center gap-3 px-3 py-2.5">
              <div className="relative">
                <Avatar src={c.winner!.photo} name={c.winner!.name} size={36} />
                <Icon3D name="1st_place_medal" size={18} className="absolute -bottom-1 -right-1.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  <Flag country={c.winner!.country} className="size-3.5" />
                  <span className="truncate">{c.winner!.name}</span>
                </div>
                <div className="text-[11px] text-fg-3">Winner · +{c.winner!.gainPct}%</div>
              </div>
              <div className="k-num text-right text-[13px] font-semibold text-gold">${c.prizes[0]!.toLocaleString()}</div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-fg-3">
                Pool <span className="k-num text-fg-2">{formatMoney(c.prizePool, "USD", 0)}</span>
              </span>
              <button className="inline-flex items-center gap-1 text-fg-2 hover:text-fg" onClick={() => toast(`${c.name} · final standings`, { description: "Your result: #212 of " + c.participants.toLocaleString() + " · +8.4%" })}>
                Results <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

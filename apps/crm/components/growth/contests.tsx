"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays, Check, ChevronRight, Gift, Loader2, Medal, ShieldAlert, Timer, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, DialogClose, Flag, Icon3D, KeyValue, KpiCard, Money, PageHeader, Reveal, cn, type Column } from "@kalks/ui";
import { TERMINAL_URL } from "@/lib/live";
import { Countdown } from "@/components/rewards/countdown";
import { BannerSlot } from "./banner-slot";
import {
  bandLabel,
  errorToast,
  fmtDate,
  fmtLots,
  fmtPct,
  fmtPoints,
  fmtUsd,
  growthApi,
  prizeFor,
  prizeZone,
  scoringLabel,
  useGrowth,
  type CashbackMe,
  type Contest,
  type ContestCard,
  type ContestDetail,
  type ContestsResp,
  type JoinResult,
  type Rewards,
  type Standing,
} from "./api";
import { CardEmpty, GrowthStatus, LiveAccountPicker, PageFallback, RankBadge, SectionTitle } from "./ui";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const isRunning = (c: Pick<Contest, "status">) => c.status === "running";
export const isUpcoming = (c: Pick<Contest, "status">) => c.status === "scheduled";
export const isPast = (c: Pick<Contest, "status">) => ["ended", "finalized", "paid", "cancelled"].includes(c.status);
export const canJoin = (c: Pick<Contest, "status" | "maxEntrants" | "entrants">) => (isRunning(c) || isUpcoming(c)) && (c.maxEntrants === null || c.entrants < c.maxEntrants);

/** Main score of a standing in the contest's scoring unit. */
export function scoreText(c: Pick<Contest, "scoring">, s: Pick<Standing, "returnPct" | "profit" | "lots" | "score">) {
  if (c.scoring === "profit") return fmtUsd(s.profit);
  if (c.scoring === "lots") return `${fmtLots(s.lots)} lots`;
  return fmtPct(+s.returnPct.toFixed(2), true);
}

const scoreTone = (c: Pick<Contest, "scoring">, s: Pick<Standing, "returnPct" | "profit">) => {
  if (c.scoring === "lots") return "text-fg";
  const v = c.scoring === "profit" ? s.profit : s.returnPct;
  return v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg";
};

export function kindChip(c: Pick<Contest, "kind">) {
  return c.kind === "live" ? (
    <Chip tone="ember" size="sm" className="font-semibold tracking-wider">
      LIVE
    </Chip>
  ) : (
    <Chip tone="gold" size="sm" className="font-semibold tracking-wider">
      DEMO
    </Chip>
  );
}

/** "Needs 3 more trades to rank" when an entry is below the contest's minimum. */
export function tradesHint(c: Pick<Contest, "minTrades">, s: Pick<Standing, "trades" | "qualified">) {
  if (s.qualified || c.minTrades <= 0) return null;
  const n = Math.max(0, c.minTrades - s.trades);
  return n > 0 ? `Needs ${n} more trade${n === 1 ? "" : "s"} to rank` : "Qualifies at the next update";
}

/* ------------------------------------------------------------------ */
/* Join flow                                                           */
/* ------------------------------------------------------------------ */

function Credentials({ c, creds }: { c: Contest; creds: NonNullable<JoinResult["credentials"]> }) {
  return (
    <div className="space-y-3" data-testid="contest-credentials">
      <div className="flex items-start gap-3 rounded-[14px] border border-warn/25 bg-warn-soft px-4 py-3 text-[12.5px] text-warn">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>Save these details now. The passwords are shown only once; you can reset them later from the account page.</span>
      </div>
      <div className="divide-y divide-line rounded-[14px] border border-line bg-surface-2">
        {(
          [
            ["Login", String(creds.login)],
            ["Password", creds.password],
            ["Investor password", creds.investorPassword],
            ["Server", "Kalks-Demo"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-36 shrink-0 text-[12.5px] text-fg-3">{k}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[13.5px]" data-testid={`credential-${k.toLowerCase().replace(/\s+/g, "-")}`}>
              {v}
            </span>
            <CopyButton value={v} label={k} />
          </div>
        ))}
      </div>
      <p className="text-[12px] text-fg-3">
        Contest account for {c.name}
        {c.startingBalance ? ` · ${fmtUsd(c.startingBalance, 0)} starting balance` : ""}. Only trades on this account count.
      </p>
    </div>
  );
}

export function JoinContestButton({ c, onJoined, size = "lg", className }: { c: Contest; onJoined: () => void; size?: "sm" | "lg"; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [login, setLogin] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [creds, setCreds] = React.useState<JoinResult["credentials"] | null>(null);
  const live = c.kind === "live";

  const join = async () => {
    if (live && !login) return;
    setBusy(true);
    try {
      const r = await growthApi<JoinResult>(`contests/${c.id}/join`, { body: live ? { login } : {} });
      onJoined();
      if (r.credentials) setCreds(r.credentials);
      else {
        setOpen(false);
        toast.success(`You joined ${c.name}`, { description: live ? `Trades on #${login} count from ${fmtDate(c.startsAt)}.` : "Your contest account is ready." });
      }
    } catch (e) {
      errorToast("Couldn't join the contest", e);
    } finally {
      setBusy(false);
    }
  };

  const groupsOk = (g: string) => c.accountGroups.length === 0 || c.accountGroups.includes(g);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setCreds(null);
          setLogin(null);
        }
      }}
      width={500}
      trigger={
        <Button variant="ember" size={size} className={className} data-testid="contest-join">
          {isUpcoming(c) ? "Register" : "Join contest"} <ArrowUpRight />
        </Button>
      }
      title={creds ? "Your contest account" : `Join ${c.name}`}
      description={creds ? "Demo contest account created" : live ? "Pick the live account you will trade in this contest." : "A dedicated demo account is opened for this contest."}
      footer={
        creds ? (
          <>
            <DialogClose asChild>
              <Button variant="ghost">Done</Button>
            </DialogClose>
            <a href={TERMINAL_URL} target="_blank" rel="noopener" data-testid="contest-open-terminal">
              <Button variant="ember">
                Open in Kalks Trader <ArrowUpRight />
              </Button>
            </a>
          </>
        ) : (
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="ember" disabled={busy || (live && !login)} onClick={join} data-testid="contest-join-confirm">
              {busy && <Loader2 className="animate-spin" />} Confirm entry
            </Button>
          </>
        )
      }
    >
      {creds ? (
        <Credentials c={c} creds={creds} />
      ) : (
        <div className="space-y-4">
          <KeyValue
            rows={[
              ["Runs", `${fmtDate(c.startsAt)} – ${fmtDate(c.endsAt)}`],
              ["Ranked by", scoringLabel(c.scoring)],
              ["Prize pool", fmtUsd(c.prizePool, 0)],
              ...(c.minTrades > 0 ? ([["Minimum trades", String(c.minTrades)]] as [string, string][]) : []),
              ...(!live && c.startingBalance ? ([["Starting balance", fmtUsd(c.startingBalance, 0)]] as [string, string][]) : []),
              ...(live && c.minEquity ? ([["Minimum equity", fmtUsd(c.minEquity, 0)]] as [string, string][]) : []),
            ]}
          />
          {live && (
            <div>
              <div className="k-label mb-2">Live account</div>
              <LiveAccountPicker
                value={login}
                onChange={setLogin}
                filter={(a) => groupsOk(a.group) && (c.minEquity === null || a.equity >= c.minEquity)}
                hint={c.minEquity ? `This contest needs a live account with at least ${fmtUsd(c.minEquity, 0)} equity${c.accountGroups.length ? ` in ${c.accountGroups.join(", ")}` : ""}.` : undefined}
              />
              {c.antiCheat.disqualifyOnBalanceChange && <p className="mt-2 text-[12px] text-fg-3">Deposits, withdrawals and transfers on this account during the contest disqualify the entry.</p>}
            </div>
          )}
          {c.kycRequired && <p className="text-[12px] text-fg-3">This contest is open to verified clients only.</p>}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

const ROW_GRID = "grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[40px_minmax(0,1.6fr)_70px_110px_100px_90px]";

function StandingRow({ c, s }: { c: Contest; s: Standing }) {
  const top = s.rank !== null && s.rank <= 3;
  const dq = s.status === "disqualified";
  const prize = s.prize ?? prizeFor(c, s.rank);
  const hint = tradesHint(c, s);
  return (
    <div
      className={cn(
        "k-row px-3 py-2.5 sm:px-4",
        ROW_GRID,
        top && !s.me && "border-gold/20 bg-gold-soft/40",
        s.me && "border-ember/40 bg-ember-soft",
        (dq || !s.qualified) && !s.me && "opacity-60",
      )}
      data-testid={s.me ? "leaderboard-row-me" : "leaderboard-row"}
    >
      <div className="flex justify-center">
        <RankBadge rank={dq ? null : s.rank} />
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <Avatar name={s.name.replace(/[^\p{L}\s]/gu, "").trim() || "?"} size={34} />
          {s.country && <Flag country={s.country.toLowerCase()} className="absolute -bottom-1 -right-1 size-3.5 ring-2 ring-surface-2" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
            <span className="truncate">{s.me ? `You · ${s.name}` : s.name}</span>
            {s.me && (
              <Chip size="sm" tone="ember">
                You
              </Chip>
            )}
            {dq && <GrowthStatus status="disqualified" dot={false} />}
          </div>
          <div className="truncate text-[11.5px] text-fg-3">
            <span className="k-num">{s.trades} trades</span>
            {hint && <span className="text-warn"> · {hint}</span>}
            {s.me && s.login && <span className="font-mono"> · #{s.login}</span>}
          </div>
        </div>
      </div>
      <div className="k-num hidden text-right text-[12.5px] text-fg-2 sm:block">{fmtLots(s.lots)}</div>
      <div className="text-right">
        <span className={cn("k-num text-[14px] font-semibold", scoreTone(c, s))}>{scoreText(c, s)}</span>
        <span className="k-num block text-[11px] text-fg-3 sm:hidden">{prize ? fmtUsd(prize, 0) : ""}</span>
      </div>
      <div className={cn("k-num hidden text-right text-[13px] sm:block", s.profit > 0 ? "text-up" : s.profit < 0 ? "text-down" : "text-fg-2")}>{fmtUsd(s.profit)}</div>
      <div className="hidden text-right sm:block">{prize && !dq ? <span className={cn("k-num text-[13.5px] font-semibold", top ? "text-gold" : "text-fg")}>{fmtUsd(prize, 0)}</span> : <span className="text-[12px] text-fg-3">—</span>}</div>
    </div>
  );
}

function Podium({ c, rows }: { c: Contest; rows: Standing[] }) {
  const ranked = rows.filter((r) => r.rank !== null && r.status !== "disqualified");
  if (ranked.length < 3) return null;
  const [first, second, third] = ranked;
  return (
    <div className="mt-5 grid grid-cols-3 items-end gap-2 px-4 sm:gap-3 sm:px-6">
      {[second!, first!, third!].map((r) => {
        const one = r === first;
        const prize = r.prize ?? prizeFor(c, r.rank);
        return (
          <div key={String(r.entryId)} className={cn("flex flex-col items-center rounded-[18px] border px-2 pb-4 text-center", one ? "border-gold/30 bg-gold-soft/60 pt-5" : "border-line bg-surface-2 pt-4")}>
            <div className="relative">
              <Avatar name={r.name.replace(/[^\p{L}\s]/gu, "").trim() || "?"} size={one ? 56 : 46} />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <RankBadge rank={r.rank} size={22} />
              </span>
            </div>
            <div className="mt-4 flex max-w-full items-center gap-1.5 text-[12.5px] font-medium">
              {r.country && <Flag country={r.country.toLowerCase()} className="size-3.5" />}
              <span className="truncate">{r.me ? "You" : r.name}</span>
            </div>
            <div className={cn("k-num mt-1 font-semibold", one ? "text-[17px]" : "text-[14px]", scoreTone(c, r))}>{scoreText(c, r)}</div>
            {prize ? <div className={cn("k-num mt-0.5 text-[12px] font-semibold", one ? "text-gold" : "text-fg-2")}>{fmtUsd(prize, 0)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export function Leaderboard({ d, limit, title = "Live leaderboard", podium = true }: { d: ContestDetail; limit?: number; title?: string; podium?: boolean }) {
  const c = d.contest;
  const all = d.leaderboard;
  const shown = limit ? all.slice(0, limit) : all;
  const me = d.myEntry;
  const meShown = !!me && shown.some((s) => s.me);
  const zone = prizeZone(c);
  const lastRankShown = shown.reduce((m, s) => Math.max(m, s.rank ?? 0), 0);
  return (
    <Card className="flex h-full flex-col" data-testid="contest-leaderboard">
      <CardHeader
        title={title}
        subtitle={
          <span>
            {isRunning(c) ? "Updates every 15 s" : c.status === "scheduled" ? "Starts " + fmtDate(c.startsAt) : "Final standings"} · {d.entrants.toLocaleString("en-US")} trader{d.entrants === 1 ? "" : "s"} · ranked by {scoringLabel(c.scoring).toLowerCase()}
          </span>
        }
        action={
          limit ? (
            <Link href={`/rewards/contests/${c.id}`}>
              <Button size="sm" variant="surface">
                Full standings <ChevronRight />
              </Button>
            </Link>
          ) : undefined
        }
      />
      {all.length === 0 ? (
        <div className="px-4 pb-6 pt-4 sm:px-6">
          <CardEmpty title="No entries yet" text={isUpcoming(c) ? "Register now; the leaderboard opens when the contest starts." : "Be the first to join. Rankings appear after the first closed trade."} />
        </div>
      ) : (
        <>
          {podium && <Podium c={c} rows={all} />}
          <div className={cn("mt-5 hidden gap-3 px-8 text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3 sm:grid", ROW_GRID)}>
            <span className="text-center">#</span>
            <span>Trader</span>
            <span className="text-right">Lots</span>
            <span className="text-right">{scoringLabel(c.scoring)}</span>
            <span className="text-right">Profit</span>
            <span className="text-right">Prize</span>
          </div>
          <div className="mt-2 flex-1 space-y-1.5 px-4 pb-2 sm:px-6">
            {shown.map((s, i) => (
              <React.Fragment key={String(s.entryId)}>
                <StandingRow c={c} s={s} />
                {zone > 0 && s.rank === zone && i < shown.length - 1 && (
                  <div className="flex items-center gap-2 py-1.5 text-[11px] text-fg-3">
                    <span className="h-px flex-1 bg-line" /> Prize zone ends at #{zone} <span className="h-px flex-1 bg-line" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          {me && !meShown && (
            <div className="space-y-1.5 px-4 pb-2 sm:px-6">
              <div className="flex items-center gap-2 py-1.5 text-[11px] text-fg-3">
                <span className="h-px flex-1 bg-line" /> {zone > lastRankShown ? `Prize zone to #${zone}` : "Your position"} <span className="h-px flex-1 bg-line" />
              </div>
              <StandingRow c={c} s={me} />
            </div>
          )}
          <div className="pb-4" />
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Prize card                                                          */
/* ------------------------------------------------------------------ */

export function PrizeCard({ c }: { c: Contest }) {
  const max = Math.max(1, ...c.prizes.map((p) => p.amount));
  const wallet = c.prizes.every((p) => p.payout === "wallet");
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Prize distribution" subtitle={wallet ? "Paid to your wallet after the results are final" : "Wallet or trading credit per band"} action={<Icon3D name="money_bag" size={36} />} />
      <div className="mt-4 flex-1 space-y-1.5 px-4 pb-5 sm:px-6">
        {c.prizes.length === 0 && <CardEmpty title="No cash prizes" text="This contest is for ranking only." />}
        {c.prizes.map((p, i) => (
          <div key={`${p.rankFrom}-${p.rankTo}`} className="flex items-center gap-3">
            <span className="k-num w-14 shrink-0 text-[12px] font-medium text-fg-2">{bandLabel(p)}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("absolute inset-y-0 left-0 rounded-full", i === 0 ? "bg-gold" : i < 3 ? "bg-gold/35" : "bg-surface-3")} style={{ width: `${Math.max(14, (p.amount / max) * 100)}%` }} />
              <span className={cn("k-num relative flex h-full items-center px-3 text-[12px] font-semibold", i === 0 ? "text-[#1a1204]" : "text-fg")}>
                {fmtUsd(p.amount, 0)}
                {p.rankTo > p.rankFrom ? " each" : ""}
              </span>
            </div>
            {!wallet && <span className="w-12 text-right text-[10.5px] uppercase tracking-wider text-fg-3">{p.payout}</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line px-4 py-4 sm:px-6">
        <div className="k-row px-3 py-2.5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Prize pool</div>
          <div className="k-num mt-0.5 text-[13px] font-medium text-gold">{fmtUsd(c.prizePool, 0)}</div>
        </div>
        <div className="k-row px-3 py-2.5">
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Minimum trades</div>
          <div className="k-num mt-0.5 text-[13px] font-medium">{c.minTrades || "None"}</div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Hero (featured running / next contest)                              */
/* ------------------------------------------------------------------ */

function ContestHero({ c, d, onJoined }: { c: ContestCard; d: ContestDetail | null; onJoined: () => void }) {
  const running = isRunning(c);
  const me = d?.myEntry ?? c.myEntry;
  const start = Date.parse(c.startsAt);
  const end = Date.parse(c.endsAt);
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const pctTime = now === null ? 0 : Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
  const dayN = now === null ? 0 : Math.max(1, Math.ceil((now - start) / 86400_000));
  const days = Math.max(1, Math.round((end - start) / 86400_000));
  const zone = prizeZone(c);
  const entrants = d?.entrants ?? c.entrants;
  const hint = me ? tradesHint(c, me) : null;
  return (
    <Card hot className="relative overflow-hidden" data-testid="contest-hero">
      <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-7 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthStatus status={c.status} />
            {kindChip(c)}
            <Chip>
              {fmtDate(c.startsAt, false)} – {fmtDate(c.endsAt)}
            </Chip>
          </div>
          <h2 className="mt-4 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[34px]">{c.name}</h2>
          {c.description && <p className="mt-1.5 max-w-lg text-[14px] text-fg-2">{c.description}</p>}

          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
            <div>
              <div className="k-label">Prize pool</div>
              <Money value={c.prizePool} decimals={0} countUp={false} className="mt-1.5 block text-[40px] font-semibold leading-none tracking-tight text-gold sm:text-[44px]" />
            </div>
            <div>
              <div className="k-label mb-2 flex items-center gap-1.5">
                <Timer className="size-3.5" /> {running ? "Ends in" : "Starts in"}
              </div>
              <Countdown to={running ? c.endsAt : c.startsAt} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {me ? (
              <Button variant="up-outline" size="lg" disabled className="disabled:opacity-100">
                <Check /> Joined{me.login ? ` · account #${me.login}` : ""}
              </Button>
            ) : canJoin(c) ? (
              <JoinContestButton c={c} onJoined={onJoined} />
            ) : (
              <Button size="lg" variant="surface" disabled>
                Entries closed
              </Button>
            )}
            {me && (
              <a href={TERMINAL_URL} target="_blank" rel="noopener">
                <Button variant="surface" size="lg">
                  Trade in Kalks Trader
                </Button>
              </a>
            )}
            <Link href={`/rewards/contests/${c.id}`}>
              <Button variant="ghost" size="lg">
                Rules & prizes
              </Button>
            </Link>
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className="rounded-[18px] border border-line bg-surface-2/70 p-5">
            {me ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-medium">Your standing</div>
                    <div className="text-[12px] text-fg-3">{me.rank ? `#${me.rank} of ${entrants.toLocaleString("en-US")} traders` : me.status === "disqualified" ? "Entry disqualified" : "Not ranked yet"}</div>
                  </div>
                  {me.status === "disqualified" ? <GrowthStatus status="disqualified" /> : me.rank && zone && me.rank <= zone ? <Chip tone="gold">Prize zone</Chip> : null}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="k-row px-3 py-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Rank</div>
                    <div className="k-num mt-1 text-[20px] font-semibold leading-none">{me.rank ? `#${me.rank}` : "—"}</div>
                  </div>
                  <div className="k-row px-3 py-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{scoringLabel(c.scoring)}</div>
                    <div className={cn("k-num mt-1 text-[17px] font-semibold leading-none", scoreTone(c, me))}>{scoreText(c, me)}</div>
                  </div>
                  <div className="k-row px-3 py-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Trades</div>
                    <div className="k-num mt-1 text-[20px] font-semibold leading-none">{me.trades}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-[14px] font-medium">{running ? "Join while it's running" : "Register early"}</div>
                <div className="mt-1 text-[12.5px] text-fg-3">
                  {c.kind === "demo" ? `A contest demo account${c.startingBalance ? ` with ${fmtUsd(c.startingBalance, 0)}` : ""} is opened for you. No deposit needed.` : "Compete with one of your live accounts. Only trades closed inside the contest window count."}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="k-row flex items-center gap-2 px-3 py-2.5 text-[12.5px]">
                    <Users className="size-3.5 text-fg-3" />
                    <span className="k-num">
                      {entrants.toLocaleString("en-US")}
                      {c.maxEntrants ? ` / ${c.maxEntrants.toLocaleString("en-US")}` : ""} joined
                    </span>
                  </div>
                  <div className="k-row flex items-center gap-2 px-3 py-2.5 text-[12.5px]">
                    <Trophy className="size-3.5 text-fg-3" />
                    <span>{zone ? `Top ${zone} paid` : "Ranking only"}</span>
                  </div>
                </div>
              </>
            )}
            <div className="mt-4 space-y-3 text-[12px]">
              <div>
                <div className="mb-1.5 flex justify-between text-fg-3">
                  <span>Contest progress</span>
                  <span className="k-num text-fg-2">{running ? `Day ${Math.min(dayN, days)} of ${days}` : `${days} days`}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-ember" style={{ width: `${running ? pctTime : 0}%` }} />
                </div>
              </div>
              {hint && (
                <div className="flex items-center justify-between rounded-[12px] border border-warn/25 bg-warn-soft px-3 py-2 text-warn">
                  <span>{hint}</span>
                  <ShieldAlert className="size-3.5 shrink-0" />
                </div>
              )}
              {me && me.status !== "disqualified" && !hint && me.rank && zone > 0 && me.rank > zone && (
                <div className="flex items-center justify-between rounded-[12px] border border-gold/25 bg-gold-soft px-3 py-2 text-gold">
                  <span>
                    {me.rank - zone} place{me.rank - zone === 1 ? "" : "s"} to the prize zone (#{zone})
                  </span>
                  <Trophy className="size-3.5 shrink-0" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function ContestTile({ c, onJoined }: { c: ContestCard; onJoined: () => void }) {
  const fill = c.maxEntrants ? Math.min(100, (c.entrants / c.maxEntrants) * 100) : null;
  const past = isPast(c);
  const me = c.myEntry;
  return (
    <Card className="flex flex-col overflow-hidden" data-testid="contest-card">
      <div className="border-b border-line bg-surface-2/60 px-5 pb-4 pt-4">
        <div className="flex items-center gap-1.5">
          {kindChip(c)}
          <GrowthStatus status={c.status} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Prize pool</div>
            <div className="k-num text-[24px] font-semibold leading-tight text-gold">{fmtUsd(c.prizePool, 0)}</div>
          </div>
          {!past && (
            <Chip>
              <Timer className="size-3" /> <Countdown to={isRunning(c) ? c.endsAt : c.startsAt} compact className="text-[11px]" />
            </Chip>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <Link href={`/rewards/contests/${c.id}`} className="text-[16px] font-medium tracking-tight hover:underline hover:underline-offset-2">
          {c.name}
        </Link>
        {c.description && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-3">{c.description}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div className="k-row flex items-center gap-2 px-3 py-2">
            <CalendarDays className="size-3.5 shrink-0 text-fg-3" />
            <span className="k-num truncate">
              {fmtDate(c.startsAt, false)} – {fmtDate(c.endsAt, false)}
            </span>
          </div>
          <div className="k-row flex items-center gap-2 px-3 py-2">
            <Users className="size-3.5 shrink-0 text-fg-3" />
            <span className="k-num">{c.entrants.toLocaleString("en-US")} joined</span>
          </div>
        </div>
        <div className="mt-2 truncate text-[11.5px] text-fg-3">
          Ranked by {scoringLabel(c.scoring).toLowerCase()}
          {c.minTrades ? ` · min ${c.minTrades} trades` : ""}
          {c.kind === "demo" && c.startingBalance ? ` · ${fmtUsd(c.startingBalance, 0)} demo balance` : ""}
          {c.kind === "live" && c.minEquity ? ` · min equity ${fmtUsd(c.minEquity, 0)}` : ""}
        </div>
        {fill !== null && !past && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-fg-3">
              <span>Seats</span>
              <span className="k-num">
                {c.entrants.toLocaleString("en-US")} / {c.maxEntrants!.toLocaleString("en-US")}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-ember" style={{ width: `${fill}%` }} />
            </div>
          </div>
        )}
        {me && (
          <div className="k-row mt-3 flex items-center gap-3 px-3 py-2.5">
            <RankBadge rank={me.status === "disqualified" ? null : me.rank} size={26} />
            <div className="min-w-0 flex-1 text-[12.5px]">
              <div className="font-medium">{past ? "Your result" : "You're in"}</div>
              <div className="truncate text-fg-3">{me.status === "disqualified" ? "Disqualified" : `${scoreText(c, me)} · ${me.trades} trades`}</div>
            </div>
            {me.prize ? <span className="k-num text-[13px] font-semibold text-gold">{fmtUsd(me.prize, 0)}</span> : null}
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-4">
          {!me && canJoin(c) ? <JoinContestButton c={c} onJoined={onJoined} size="sm" className="flex-1" /> : null}
          <Link href={`/rewards/contests/${c.id}`} className={cn(!me && canJoin(c) ? "" : "flex-1")}>
            <Button size="sm" variant="surface" className="w-full">
              {past ? "Results" : "Details"}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function RewardsShortcuts() {
  const rewards = useGrowth<Rewards>("rewards");
  const cash = useGrowth<CashbackMe>("cashback");
  const r = rewards.data;
  const items = [
    {
      href: "/rewards/loyalty",
      icon: "gem_stone",
      title: r ? `${fmtPoints(r.points.balance)} points` : "Loyalty points",
      sub: r ? `${r.tier.name} tier · ≈ ${fmtUsd(r.points.balance * r.pointValue)} value` : "Earn on every lot you trade",
      chip: "Redeem",
    },
    {
      href: "/rewards/cashback",
      icon: "money_with_wings",
      title: cash.data ? `${fmtUsd(cash.data.totals.lifetime)} cashback` : "Cashback",
      sub: cash.data ? `${fmtUsd(cash.data.totals.accrued)} pending payout to wallet` : "Paid back per lot, to your wallet",
      chip: "View",
    },
    { href: "/rewards/promotions", icon: "wrapped_gift", title: "Promotions", sub: "Deposit bonuses and promo codes", chip: "Open" },
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Your rewards" subtitle="Everything you earn while trading" />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="k-row flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-surface-3/60">
            <Icon3D name={it.icon} size={36} />
            <div className="min-w-0 flex-1">
              <div className="k-num text-[14px] font-medium">{it.title}</div>
              <div className="truncate text-[11.5px] text-fg-3">{it.sub}</div>
            </div>
            <Chip size="sm" tone="ember">
              {it.chip}
            </Chip>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function MyResults({ items }: { items: ContestCard[] }) {
  const rows = items.filter((c) => c.myEntry);
  const columns: Column<ContestCard>[] = [
    {
      key: "name",
      header: "Contest",
      cell: (c) => (
        <Link href={`/rewards/contests/${c.id}`} className="flex items-center gap-2 font-medium hover:underline hover:underline-offset-2">
          {kindChip(c)} {c.name}
        </Link>
      ),
    },
    { key: "dates", header: "Dates", hideOn: "md", cell: (c) => <span className="k-num text-fg-2">{`${fmtDate(c.startsAt, false)} – ${fmtDate(c.endsAt)}`}</span>, sort: (c) => c.startsAt },
    { key: "status", header: "Status", cell: (c) => <GrowthStatus status={c.myEntry?.status === "disqualified" ? "disqualified" : c.status} /> },
    { key: "rank", header: "Rank", align: "right", cell: (c) => <span className="k-num font-medium">{c.myEntry?.rank ? `#${c.myEntry.rank}` : "—"}</span>, sort: (c) => c.myEntry?.rank ?? 99999 },
    { key: "score", header: "Score", align: "right", cell: (c) => <span className={cn("k-num", scoreTone(c, c.myEntry!))}>{scoreText(c, c.myEntry!)}</span> },
    { key: "trades", header: "Trades", align: "right", hideOn: "sm", cell: (c) => <span className="k-num text-fg-2">{c.myEntry!.trades}</span> },
    {
      key: "prize",
      header: "Prize",
      align: "right",
      cell: (c) =>
        c.myEntry?.prize ? (
          <span className="flex items-center justify-end gap-2">
            <span className="k-num font-semibold text-gold">{fmtUsd(c.myEntry.prize, 0)}</span>
            {c.myEntry.prizeStatus && <GrowthStatus status={c.myEntry.prizeStatus} dot={false} />}
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
  ];
  return (
    <Card id="my-results" className="scroll-mt-24">
      <CardHeader title="My results" subtitle="Every contest you entered" icon={<Medal />} />
      <div className="px-4 pb-6 pt-4 sm:px-6">
        {rows.length === 0 ? <CardEmpty title="No entries yet" text="Join a contest above; your rank, score and prizes are tracked here." /> : <DataTable columns={columns} rows={rows} pageSize={8} rowKey={(c) => String(c.id)} />}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function pickFeatured(items: ContestCard[]) {
  const running = items.filter(isRunning).sort((a, b) => Number(!!b.myEntry) - Number(!!a.myEntry) || b.prizePool - a.prizePool);
  if (running[0]) return running[0];
  return items.filter(isUpcoming).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null;
}

export function LiveContestsPage() {
  const list = useGrowth<ContestsResp>("contests", 60_000);
  const featured = list.data ? pickFeatured(list.data.items) : null;
  const detail = useGrowth<ContestDetail>(featured ? `contests/${featured.id}` : null, 15_000);
  const reload = () => {
    list.reload();
    detail.reload();
  };

  const title = "Contests";
  const subtitle = "Compete on demo or live accounts, climb the leaderboard and win cash prizes.";
  if (!list.data)
    return <PageFallback title={title} subtitle={subtitle} error={list.error} onRetry={list.reload} top={<BannerSlot placement="rewards" />} rows={[{ cols: "", h: "h-[320px]", n: 1 }, { cols: "sm:grid-cols-2 xl:grid-cols-4", h: "h-[150px]", n: 4 }]} />;

  const { items, stats } = list.data;
  const upcoming = items.filter((c) => c !== featured && (isUpcoming(c) || isRunning(c)));
  const past = items.filter(isPast).filter((c) => c.status !== "cancelled" || c.myEntry);
  const d = detail.data && featured && detail.data.contest.id === featured.id ? detail.data : null;

  return (
    <div className="pb-16">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <a href="#my-results">
            <Button variant="surface">
              <Medal /> My results
            </Button>
          </a>
        }
      />
      <BannerSlot placement="rewards" />

      {featured ? (
        <Reveal>
          <ContestHero c={featured} d={d} onJoined={reload} />
        </Reveal>
      ) : (
        <Card>
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Icon3D name="trophy" size={52} />
            <h3 className="mt-4 text-[17px] font-medium">No contest running right now</h3>
            <p className="mt-1 max-w-md text-[13.5px] text-fg-3">New demo and live contests are announced here. Past results stay below.</p>
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Contests entered" icon={<Medal />} value={<span className="k-num">{stats.entered}</span>} chip={`${stats.prizeFinishes} prize finish${stats.prizeFinishes === 1 ? "" : "es"}`} chipTone="gold" delay={0.05} />
        <KpiCard label="Prizes won" icon={<Gift />} value={<Money value={stats.prizesWon} countUp={false} />} chip="Paid to wallet" chipTone="up" delay={0.1} />
        <KpiCard label="Best finish" icon={<Trophy />} value={<span className="k-num">{stats.bestRank ? `#${stats.bestRank}` : "—"}</span>} chip={stats.bestRank ? "Across all contests" : "Not ranked yet"} delay={0.15} />
        <KpiCard label="Active contests" value={<span className="k-num">{stats.active}</span>} hot illustration="trophy" chip={`${items.filter(isUpcoming).length} upcoming`} chipTone="ember" delay={0.2} />
      </div>

      {featured && (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal delay={0.1} className="xl:col-span-8">
            {d ? <Leaderboard d={d} limit={10} /> : <Card className="h-full min-h-[360px]" />}
          </Reveal>
          <div className="flex flex-col gap-4 xl:col-span-4">
            <Reveal delay={0.15}>
              <PrizeCard c={featured} />
            </Reveal>
            <Reveal delay={0.2} className="flex-1">
              <RewardsShortcuts />
            </Reveal>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <Reveal delay={0.1} className="mt-8">
          <SectionTitle title="Open for entry" text="Register early; seats on some contests are limited." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((c) => (
              <ContestTile key={String(c.id)} c={c} onJoined={reload} />
            ))}
          </div>
        </Reveal>
      )}

      {past.length > 0 && (
        <Reveal delay={0.1} className="mt-8">
          <SectionTitle title="Past contests" text="Final standings and winners." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {past.slice(0, 8).map((c) => (
              <ContestTile key={String(c.id)} c={c} onJoined={reload} />
            ))}
          </div>
        </Reveal>
      )}

      <Reveal delay={0.1} className="mt-8">
        <MyResults items={items} />
      </Reveal>
    </div>
  );
}

"use client";

import * as React from "react";
import { AlertTriangle, CalendarRange, Flag as FlagIcon, Pencil, Plus, RefreshCw, Trash2, Trophy, Users, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, KpiCard, PageHeader, Progress, Reveal, Segmented, cn } from "@ezymex/ui";
import { TableSkeleton, ago, countryName, useApi, useNow, when } from "@/components/live/kit";
import { M, mkSend, type Contest, type ContestDetail, type ContestFlag, type ContestInput, type ContestInstrument, type Overview, type Prize, type Scoring, type Standing } from "./api";
import {
  AreaF,
  CONTEST_STATUS,
  DateTimeF,
  EmptyNote,
  FormDialog,
  MkError,
  NumF,
  PAY_STATUS,
  ReadOnlyNote,
  SelectF,
  StatusPill,
  TextF,
  Tile,
  ToggleRow,
  fromLocalInput,
  int,
  num,
  numOrNull,
  pct,
  splitList,
  toLocalInput,
  usd,
  usdK,
  useAction,
  usePerms,
} from "./kit";

type F = "all" | "running" | "scheduled" | "ended" | "done";
const SCORING: Record<Scoring, string> = { return_pct: "Return %", profit: "Profit", lots: "Lots traded", contracts: "Contracts traded" };
const FLAG_KIND: Record<string, { label: string; desc: string }> = {
  balance_change: { label: "Balance change", desc: "Deposit, withdrawal, transfer, refill or staff adjustment on the account during the contest" },
  single_trade: { label: "Single trade", desc: "One trade made most of the positive profit" },
  short_holds: { label: "Short holds", desc: "More than half of the trades were held below the minimum hold" },
  self_trade: { label: "Self-trade", desc: "Option trades crossed or hedged with another account of the same client. They are already left out of the score; disqualify if it looks deliberate" },
};
const isOptions = (c: { instrument?: ContestInstrument }) => c.instrument === "options";

/** OPTIONS badge next to LIVE / DEMO (Ezymex FX Options contests, O36). */
function InstrumentChip({ c }: { c: { instrument?: ContestInstrument } }) {
  return isOptions(c) ? (
    <Chip size="sm" tone="info">
      OPTIONS
    </Chip>
  ) : null;
}

function useUrlParam(name: string): [string | null, (v: string | null) => void] {
  const [v, setV] = React.useState<string | null>(null);
  React.useEffect(() => {
    const read = () => setV(new URLSearchParams(window.location.search).get(name));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [name]);
  const set = React.useCallback(
    (next: string | null) => {
      const u = new URL(window.location.href);
      if (next === null) u.searchParams.delete(name);
      else u.searchParams.set(name, next);
      window.history.replaceState(window.history.state, "", u.pathname + u.search);
      setV(next);
    },
    [name],
  );
  return [v, set];
}

const scoreText = (c: { scoring: Scoring }, s: Standing) =>
  c.scoring === "return_pct" ? pct(s.returnPct, 2) : c.scoring === "profit" ? usd(s.profit) : c.scoring === "contracts" ? `${num(s.contracts ?? 0)} contracts` : `${num(s.lots)} lots`;

export function LiveContests() {
  const perms = usePerms();
  const now = useNow();
  const ov = useApi<Overview>(M("overview"));
  const list = useApi<{ items: Contest[] }>(M("contests"), { refreshMs: 60_000 });
  const [f, setF] = React.useState<F>("all");
  const [wizard, setWizard] = React.useState(false);
  const [sel, setSel] = useUrlParam("contest");
  const items = list.data?.items ?? [];
  const match = (c: Contest) => f === "all" || (f === "done" ? ["finalized", "paid", "cancelled"].includes(c.status) : f === "scheduled" ? c.status === "scheduled" || c.status === "draft" : c.status === f);
  const rows = items.filter(match).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  const running = items.filter((c) => c.status === "running");
  const k = ov.data?.contests;

  return (
    <div className="pb-16">
      <PageHeader
        title="Contests"
        subtitle="Demo and live trading competitions with live leaderboards, anti-cheat review and prize payouts."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="create contests" />}
            <Button variant="surface" onClick={() => (list.reload(), ov.reload())}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <Button variant="ember" onClick={() => setWizard(true)} data-testid="new-contest">
                <Plus /> New contest
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Running contests" icon={<Trophy />} value={<span className="k-num">{k ? int(k.running) : "—"}</span>} chip={k ? `${int(k.scheduled)} scheduled` : "Loading"} />
        <KpiCard label="Entrants" icon={<Users />} value={<span className="k-num">{k ? int(k.entrants) : "—"}</span>} chip="Running and scheduled" delay={0.05} />
        <KpiCard label="Live prize pools" icon={<Wallet />} value={<span className="k-num">{list.data ? usdK(running.reduce((s, c) => s + (c.prizePool || 0), 0)) : "—"}</span>} chip="Running contests" chipTone="gold" delay={0.1} />
        <KpiCard label="Awaiting payout" icon={<AlertTriangle />} value={<span className="k-num">{list.data ? int(items.filter((c) => c.status === "ended" || c.status === "finalized").length) : "—"}</span>} chip="Ended or finalized" chipTone="warn" delay={0.15} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader
            title="All contests"
            subtitle="Open a contest for its leaderboard, flags and payouts"
            action={
              <Segmented
                size="xs"
                value={f}
                onChange={setF}
                options={[
                  { value: "all", label: <>All <span className="text-fg-3">{items.length}</span></> },
                  { value: "running", label: "Running" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "ended", label: "Ended" },
                  { value: "done", label: "Closed" },
                ]}
              />
            }
          />
          <div className="mt-4 space-y-2 px-4 pb-6 sm:px-6">
            {list.error && !list.data ? (
              <MkError error={list.error} onRetry={list.reload} />
            ) : !list.data ? (
              <TableSkeleton rows={4} />
            ) : rows.length === 0 ? (
              <EmptyNote title={items.length ? "No contests match this filter" : "No contests yet"} text={items.length ? undefined : "Create a demo contest (a fresh demo account per entrant) or a live one on clients' own accounts."} />
            ) : (
              rows.map((c) => {
                const endsIn = Date.parse(c.endsAt) - now;
                const startsIn = Date.parse(c.startsAt) - now;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`contest-row-${c.id}`}
                    onClick={() => setSel(String(c.id))}
                    className={cn("k-row relative flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-3/60 sm:flex-nowrap", String(c.id) === sel && "border-ember/40")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{c.name}</span>
                        <Chip size="sm" tone={c.kind === "live" ? "ember" : "gold"}>
                          {c.kind === "live" ? "LIVE" : "DEMO"}
                        </Chip>
                        <InstrumentChip c={c} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-fg-3">
                        <CalendarRange className="size-3.5 shrink-0" /> {when(c.startsAt)} – {when(c.endsAt)} · {SCORING[c.scoring] ?? c.scoring}
                        {c.minTrades ? ` · min ${c.minTrades} trades` : ""}
                        {isOptions(c) && c.minPremium ? ` · min premium ${usd(c.minPremium)}` : ""}
                      </div>
                    </div>
                    <div className="hidden w-36 md:block">
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="k-num text-fg-2">{int(c.entrants)}</span>
                        <span className="k-num text-fg-3">/ {c.maxEntrants ? int(c.maxEntrants) : "∞"}</span>
                      </div>
                      <Progress value={c.maxEntrants ? (c.entrants / c.maxEntrants) * 100 : 0} tone={c.kind === "live" ? "ember" : "gold"} />
                    </div>
                    <div className="w-24 text-right">
                      <div className="k-num text-[14px] font-semibold text-gold">{usdK(c.prizePool)}</div>
                      <div className="text-[11px] text-fg-3">prize pool</div>
                    </div>
                    <div className="w-32 text-right">
                      <StatusPill map={CONTEST_STATUS} status={c.status} />
                      <div className="k-num mt-1 text-[11px] text-fg-3">
                        {c.status === "running" ? (endsIn > 0 ? `ends ${ago(c.endsAt, now)}` : "past end") : c.status === "scheduled" ? (startsIn > 0 ? `starts ${ago(c.startsAt, now)}` : "starting") : c.status === "ended" ? "finalize to freeze" : c.status === "finalized" ? "ready to pay" : ""}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </Reveal>

      <ContestDrawer id={sel} onClose={() => setSel(null)} perms={perms} onChanged={() => (list.reload(), ov.reload())} />
      <ContestWizard open={wizard} onOpenChange={setWizard} onSaved={(c) => (list.reload(), ov.reload(), c?.id && setSel(String(c.id)))} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                        */
/* ------------------------------------------------------------------ */

function ContestDrawer({ id, onClose, perms, onChanged }: { id: string | null; onClose: () => void; perms: { write: boolean; approve: boolean }; onChanged: () => void }) {
  const valid = id && /^\d+$/.test(id) ? id : null;
  const { data, error, loading, reload } = useApi<ContestDetail>(valid ? M(`contests/${valid}`) : null, { refreshMs: 15_000 });
  const act = useAction();
  const [editing, setEditing] = React.useState(false);
  const now = useNow(15_000);
  const c = data && String(data.contest.id) === valid ? data.contest : null;
  const board = c ? data!.leaderboard : [];
  const flags = c ? data!.flags : [];
  const done = () => {
    reload();
    onChanged();
  };

  const post = <T = unknown,>(path: string, body: object = {}) => mkSend<T>(`contests/${valid}/${path}`, body);
  const ended = c ? Date.parse(c.endsAt) <= now : false;
  const canFinalize = !!c && (c.status === "ended" || (c.status === "running" && ended));
  const unpaid = board.filter((s) => s.status === "active" && s.prize && s.prizeStatus !== "paid");
  const payTotal = unpaid.reduce((s, x) => s + (x.prize ?? 0), 0);
  const byEntry = new Map(board.map((s) => [s.entryId, s]));

  const refresh = async () => {
    const r = await post("refresh");
    if (r.ok) reload();
  };
  const finalize = () =>
    act.ask({
      title: `Finalize ${c!.name}`,
      description: "Freezes ranks and prize allocation. Scores stop updating. Open flags should be resolved first.",
      body: flags.some((f) => f.status === "open") ? <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-fg">{flags.filter((f) => f.status === "open").length} flag(s) are still open.</div> : undefined,
      confirmLabel: "Finalize contest",
      confirmTestId: "contest-finalize-confirm",
      note: "none",
      run: () => post("finalize"),
      success: `${c!.name} finalized`,
      onDone: done,
    });
  const pay = () =>
    act.ask({
      title: `Pay prizes · ${c!.name}`,
      description: "Wallet prizes are credited to the client's wallet; credit prizes go to the entered live account as engine credit. Each payout is idempotent.",
      body: (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between rounded-[12px] border border-gold/30 bg-gold-soft px-4 py-3">
            <span className="text-[13px] text-fg-2">Total to pay</span>
            <span className="k-num text-[22px] font-semibold text-gold" data-testid="contest-pay-total">
              {usd(payTotal || c!.prizePool)}
            </span>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {unpaid.map((s) => (
              <div key={s.entryId} className="flex items-center justify-between px-1 text-[12.5px]">
                <span className="text-fg-2">
                  #{s.rank} · {s.name}
                  {s.login ? <span className="font-mono text-fg-3"> · {s.login}</span> : null}
                </span>
                <span className="k-num">{usd(s.prize)}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      confirmLabel: "Pay prizes",
      confirmVariant: "buy",
      confirmTestId: "contest-pay-confirm",
      note: "none",
      run: () => post<{ paid?: number; failed?: number; amount?: number }>("pay"),
      success: (r: { paid?: number; failed?: number; amount?: number }) => `Paid ${int(r.paid ?? 0)} prize(s) · ${usd(r.amount ?? 0)}${r.failed ? ` · ${r.failed} failed, will retry` : ""}`,
      onDone: done,
    });
  const cancel = () =>
    act.ask({
      title: `Cancel ${c!.name}`,
      description: "No prizes are paid. Entrants keep their accounts.",
      confirmLabel: "Cancel contest",
      confirmVariant: "sell",
      note: "required",
      run: (note) => post("cancel", { note }),
      success: `${c!.name} cancelled`,
      onDone: done,
    });
  const disqualify = (s: Standing) =>
    act.ask({
      title: `Disqualify ${s.name}`,
      description: `Entry #${s.entryId}${s.login ? ` · account ${s.login}` : ""}. The row stays on the board without a rank or prize.`,
      confirmLabel: "Disqualify",
      confirmVariant: "sell",
      note: "required",
      noteLabel: "Reason",
      run: (reason) => post(`entries/${s.entryId}/disqualify`, { reason }),
      success: `${s.name} disqualified`,
      onDone: done,
    });
  const reinstate = (s: Standing) =>
    act.ask({
      title: `Reinstate ${s.name}`,
      description: `Entry #${s.entryId} is ranked again from the next refresh.`,
      confirmLabel: "Reinstate",
      note: "required",
      noteLabel: "Reason",
      run: (reason) => post(`entries/${s.entryId}/reinstate`, { reason }),
      success: `${s.name} reinstated`,
      onDone: done,
    });
  const resolve = (f: ContestFlag, action: "clear" | "disqualify") =>
    act.ask({
      title: action === "clear" ? `Clear flag #${f.id}` : `Disqualify for flag #${f.id}`,
      description: `${FLAG_KIND[f.kind]?.label ?? f.kind} · ${byEntry.get(f.entryId)?.name ?? f.name ?? `entry #${f.entryId}`}`,
      confirmLabel: action === "clear" ? "Clear flag" : "Disqualify entrant",
      confirmVariant: action === "clear" ? "surface" : "sell",
      note: "required",
      run: (note) => post(`flags/${f.id}/resolve`, { action, note }),
      success: action === "clear" ? `Flag #${f.id} cleared` : "Entrant disqualified",
      onDone: done,
    });

  return (
    <Dialog
      open={!!valid}
      onOpenChange={(o) => !o && onClose()}
      width={1120}
      title={c ? c.name : "Contest"}
      description={c ? `${c.kind === "live" ? "Live accounts" : "Demo accounts"}${isOptions(c) ? " · Ezymex FX Options" : ""} · ${SCORING[c.scoring] ?? c.scoring} · ${when(c.startsAt)} – ${when(c.endsAt)}` : undefined}
    >
      {error && !data ? (
        <MkError error={error} onRetry={reload} />
      ) : !c ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill map={CONTEST_STATUS} status={c.status} />
            <InstrumentChip c={c} />
            <span className="text-[12px] text-fg-3">Leaderboard refreshes every 15 s · updated {ago(c.updatedAt, now)}</span>
            {loading && <span className="text-[12px] text-fg-3">Loading…</span>}
            <span className="ml-auto flex flex-wrap gap-2">
              {perms.write && ["draft", "scheduled", "running", "ended"].includes(c.status) && (
                <Button size="sm" variant="surface" onClick={() => setEditing(true)} data-testid="contest-edit">
                  <Pencil /> Edit
                </Button>
              )}
              {perms.write && ["running", "ended"].includes(c.status) && (
                <Button size="sm" variant="surface" onClick={refresh}>
                  <RefreshCw /> Refresh scores
                </Button>
              )}
              {perms.write && canFinalize && (
                <Button size="sm" variant="ember" onClick={finalize} data-testid="contest-finalize">
                  Finalize
                </Button>
              )}
              {perms.approve && c.status === "finalized" && (
                <Button size="sm" variant="buy" onClick={pay} data-testid="contest-pay">
                  <Wallet /> Pay prizes
                </Button>
              )}
              {perms.write && ["draft", "scheduled", "running"].includes(c.status) && (
                <Button size="sm" variant="down-outline" onClick={cancel}>
                  Cancel contest
                </Button>
              )}
            </span>
          </div>

          <div className={cn("grid grid-cols-2 gap-2", isOptions(c) ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-5")}>
            <Tile label="Entrants" value={`${int(c.entrants)}${c.maxEntrants ? ` / ${int(c.maxEntrants)}` : ""}`} />
            <Tile label="Prize pool" value={usd(c.prizePool, 0)} tone="gold" />
            <Tile label="Min trades" value={int(c.minTrades)} />
            {isOptions(c) && <Tile label="Min premium / trade" value={c.minPremium ? usd(c.minPremium) : "None"} />}
            <Tile label={c.kind === "demo" ? "Starting balance" : "Min equity"} value={c.kind === "demo" ? usd(c.startingBalance, 0) : c.minEquity ? usd(c.minEquity, 0) : "None"} />
            <Tile label="Open flags" value={int(flags.filter((f) => f.status === "open").length)} tone={flags.some((f) => f.status === "open") ? "warn" : undefined} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <div className="k-label mb-2">Leaderboard</div>
              {board.length === 0 ? (
                <EmptyNote title="No entrants yet" text="Clients join from the Client Area under Rewards → Contests." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-[13px]" data-testid="contest-leaderboard">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
                        <th className="pb-2 text-left font-medium">#</th>
                        <th className="pb-2 text-left font-medium">Trader</th>
                        <th className="pb-2 text-right font-medium">{SCORING[c.scoring]}</th>
                        <th className="pb-2 text-right font-medium">Profit</th>
                        <th className="pb-2 text-right font-medium">{isOptions(c) ? "Contracts" : "Lots"}</th>
                        <th className="pb-2 text-right font-medium">Trades</th>
                        <th className="pb-2 text-right font-medium">Prize</th>
                        <th className="pb-2 text-right font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {board.map((s) => (
                        <tr key={s.entryId} className={cn("border-t border-line", s.status === "disqualified" && "opacity-60")}>
                          <td className="py-2 pr-2">
                            {s.rank ? (
                              <span className={cn("k-num grid size-6 place-items-center rounded-full text-[11px] font-semibold", s.rank <= 3 ? "bg-gold-soft text-gold" : "bg-surface-3 text-fg-2")}>{s.rank}</span>
                            ) : (
                              <span className="text-fg-3">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate font-medium">
                                {s.name}
                                {s.country && <span className="text-[11px] font-normal text-fg-3" title={countryName(s.country)}>{s.country}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-[11px] text-fg-3">
                                <span className="font-mono">
                                  {s.userId ? `#${s.userId}` : ""}
                                  {s.login ? ` · ${s.login}` : ""}
                                </span>
                                {!s.qualified && <Chip size="sm">below min trades</Chip>}
                                {!!s.selfTrades && (
                                  <Chip size="sm" tone="warn">
                                    {s.selfTrades} self-trade{s.selfTrades === 1 ? "" : "s"} left out
                                  </Chip>
                                )}
                                {!!s.smallTrades && <Chip size="sm">{s.smallTrades} below min premium</Chip>}
                                {s.status === "disqualified" && (
                                  <Chip size="sm" tone="down">
                                    Disqualified{s.disqualifyReason ? `: ${s.disqualifyReason}` : ""}
                                  </Chip>
                                )}
                                {(s.flags ?? []).map((fl) => (
                                  <Chip key={fl} size="sm" tone="warn">
                                    {FLAG_KIND[fl]?.label ?? fl}
                                  </Chip>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="k-num py-2 text-right font-semibold">{scoreText(c, s)}</td>
                          <td className={cn("k-num py-2 text-right", s.profit > 0 ? "text-up" : s.profit < 0 ? "text-down" : "text-fg-2")}>{usd(s.profit)}</td>
                          <td className="k-num py-2 text-right text-fg-2">{isOptions(c) ? num(s.contracts ?? 0) : num(s.lots)}</td>
                          <td className="k-num py-2 text-right text-fg-2">{int(s.trades)}</td>
                          <td className="py-2 text-right">
                            {s.prize ? (
                              <span className="flex flex-col items-end gap-0.5">
                                <span className="k-num text-gold">{usd(s.prize, 0)}</span>
                                {s.prizeStatus && s.prizeStatus !== "none" && <StatusPill map={PAY_STATUS} status={s.prizeStatus} />}
                              </span>
                            ) : (
                              <span className="text-fg-3">—</span>
                            )}
                          </td>
                          <td className="py-2 pl-2 text-right">
                            {perms.write && !["paid", "cancelled"].includes(c.status) && (
                              s.status === "active" ? (
                                <Button size="xs" variant="down-outline" onClick={() => disqualify(s)}>
                                  Disqualify
                                </Button>
                              ) : (
                                <Button size="xs" variant="surface" onClick={() => reinstate(s)}>
                                  Reinstate
                                </Button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="k-label mb-2">Prizes</div>
                <div className="space-y-1.5">
                  {c.prizes.length === 0 ? (
                    <div className="text-[12.5px] text-fg-3">No prizes set.</div>
                  ) : (
                    c.prizes.map((p, i) => (
                      <div key={i} className={cn("k-row flex items-center gap-3 px-3 py-2", i === 0 && "border-gold/30 bg-gold-soft")}>
                        <span className="flex-1 text-[13px] font-medium">{p.rankFrom === p.rankTo ? `Rank ${p.rankFrom}` : `Ranks ${p.rankFrom}–${p.rankTo}`}</span>
                        <span className="text-[11px] text-fg-3">{p.payout === "credit" ? "credit" : "wallet"}</span>
                        <span className="k-num text-[13.5px] font-semibold">{usd(p.amount, 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="k-label mb-2 flex items-center gap-1.5">
                  <FlagIcon className="size-3.5" /> Anti-cheat flags
                </div>
                {flags.length === 0 ? (
                  <div className="k-row px-3 py-3 text-[12.5px] text-fg-3">No flags. Checks run with every leaderboard refresh.</div>
                ) : (
                  <div className="space-y-2">
                    {flags.map((f) => {
                      const s = byEntry.get(f.entryId);
                      return (
                        <div key={f.id} className="k-row relative overflow-hidden px-3.5 py-2.5 pl-4">
                          <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", f.status === "open" ? "bg-warn" : f.status === "disqualified" ? "bg-down" : "bg-fg-3")} />
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-medium">{s?.name ?? f.name ?? `Entry #${f.entryId}`}</span>
                            <StatusPill map={PAY_STATUS} status={f.status} />
                          </div>
                          <div className="mt-0.5 text-[12px] text-fg-2">{FLAG_KIND[f.kind]?.label ?? f.kind}</div>
                          <div className="text-[11.5px] text-fg-3">{FLAG_KIND[f.kind]?.desc ?? ""}</div>
                          {f.note && <div className="mt-1 text-[11.5px] text-fg-3">Note: {f.note}</div>}
                          {perms.write && f.status === "open" && (
                            <div className="mt-2 flex gap-1.5">
                              <Button size="xs" variant="surface" onClick={() => resolve(f, "clear")}>
                                Clear
                              </Button>
                              <Button size="xs" variant="down-outline" onClick={() => resolve(f, "disqualify")}>
                                Disqualify
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isOptions(c) && (
                <div>
                  <div className="k-label mb-2">Options scoring</div>
                  <ul className="k-row space-y-1.5 px-3 py-2.5 text-[12px] text-fg-2" data-testid="contest-options-rules">
                    <li>Only Ezymex FX Options trades count: closes, expiry settlements and knock-outs, on realised P&L (no floating part). CFD trades on the account don't count.</li>
                    <li>Volume is in contracts{c.minPremium ? `; a trade with an opening premium under ${usd(c.minPremium)} adds no volume and no trade count (its P&L still counts)` : ""}.</li>
                    <li>Self-trades between a client's own accounts (one fill on both, a hedge in the same series, or a cross at the same moment) are left out and flagged.</li>
                    <li>Joining needs the options intro and an account that can trade options (no copy, PAMM, MAM or prop). Options never earn loyalty points, cashback or bonus release.</li>
                  </ul>
                </div>
              )}

              {c.rules && (
                <div>
                  <div className="k-label mb-2">Rules</div>
                  <div className="k-row max-h-40 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-[12px] text-fg-2">{c.rules}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {act.node}
      {c && <ContestWizard open={editing} onOpenChange={setEditing} initial={c} onSaved={() => done()} />}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Create wizard (one scrolling form, numbered steps)                    */
/* ------------------------------------------------------------------ */

type PrizeRow = { rankFrom: string; rankTo: string; amount: string; payout: "wallet" | "credit" };

function startOfTomorrow(addDays = 1) {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Scoring choices per instrument: volume is lots for CFDs and contracts for options (an option contract is never a lot). */
function scoringOptions(instrument: ContestInstrument): { value: Scoring; label: string }[] {
  return [
    { value: "return_pct", label: instrument === "options" ? "Return % (realised option P&L ÷ start equity)" : "Return % (realised + floating ÷ start equity)" },
    { value: "profit", label: instrument === "options" ? "Profit (realised option P&L, USD)" : "Profit (USD)" },
    instrument === "options" ? { value: "contracts", label: "Contracts traded" } : { value: "lots", label: "Lots traded" },
  ];
}

const numText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/**
 * Create or edit a contest. Editing a draft or scheduled contest changes everything; once it has started only the
 * name, description, rules, seats, KYC rule and anti-cheat settings change (the service locks the rest).
 */
function ContestWizard({ open, onOpenChange, onSaved, initial }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: (c: Contest | undefined) => void; initial?: Contest }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"demo" | "live">("demo");
  const [instrument, setInstrument] = React.useState<ContestInstrument>("cfd");
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [scoring, setScoring] = React.useState<Scoring>("return_pct");
  const [minTrades, setMinTrades] = React.useState("5");
  const [minPremium, setMinPremium] = React.useState("");
  const [maxEntrants, setMaxEntrants] = React.useState("");
  const [startingBalance, setStartingBalance] = React.useState("10000");
  const [demoGroup, setDemoGroup] = React.useState("");
  const [accountGroups, setAccountGroups] = React.useState("");
  const [minEquity, setMinEquity] = React.useState("");
  const [kyc, setKyc] = React.useState(false);
  const [prizes, setPrizes] = React.useState<PrizeRow[]>([]);
  const [rules, setRules] = React.useState("");
  const [minHold, setMinHold] = React.useState("60");
  const [maxSingle, setMaxSingle] = React.useState("50");
  const [dqBalance, setDqBalance] = React.useState(true);
  const [status, setStatus] = React.useState<"draft" | "scheduled">("scheduled");
  const editing = !!initial;
  // the service locks timing, scoring, eligibility and prizes once a contest has started
  const locked = !!initial && !["draft", "scheduled"].includes(initial.status);
  // the drawer re-reads the contest every 15 s: the form is filled once per opening, never reset while editing
  const initialRef = React.useRef(initial);
  initialRef.current = initial;
  const initialId = initial?.id;
  React.useEffect(() => {
    if (!open) return;
    const c = initialRef.current;
    setName(c?.name ?? "");
    setDescription(c?.description ?? "");
    setKind(c?.kind ?? "demo");
    setInstrument(c?.instrument ?? "cfd");
    setStartsAt(toLocalInput(c?.startsAt ?? startOfTomorrow(1)));
    setEndsAt(toLocalInput(c?.endsAt ?? startOfTomorrow(8)));
    setScoring(c?.scoring ?? "return_pct");
    setMinTrades(c ? String(c.minTrades) : "5");
    setMinPremium(numText(c?.minPremium));
    setMaxEntrants(numText(c?.maxEntrants));
    setStartingBalance(c ? numText(c.startingBalance) || "10000" : "10000");
    setDemoGroup(c?.demoGroup ?? "");
    setAccountGroups(c?.accountGroups.join(", ") ?? "");
    setMinEquity(numText(c?.minEquity));
    setKyc(c?.kycRequired ?? false);
    setPrizes(
      c
        ? c.prizes.map((p) => ({ rankFrom: String(p.rankFrom), rankTo: String(p.rankTo), amount: String(p.amount), payout: p.payout }))
        : [
            { rankFrom: "1", rankTo: "1", amount: "500", payout: "wallet" },
            { rankFrom: "2", rankTo: "2", amount: "250", payout: "wallet" },
            { rankFrom: "3", rankTo: "3", amount: "100", payout: "wallet" },
          ],
    );
    setRules(c?.rules ?? "");
    setMinHold(c ? String(c.antiCheat.minHoldSeconds) : "60");
    setMaxSingle(c ? String(c.antiCheat.maxSingleTradePct) : "50");
    setDqBalance(c?.antiCheat.disqualifyOnBalanceChange ?? true);
    setStatus(c?.status === "draft" ? "draft" : "scheduled");
  }, [open, initialId]);

  const options = instrument === "options";
  const pickInstrument = (v: ContestInstrument) => {
    setInstrument(v);
    // keep the scoring mode valid: volume is lots for CFDs and contracts for options
    if (v === "options" && scoring === "lots") setScoring("contracts");
    if (v === "cfd" && scoring === "contracts") setScoring("lots");
  };

  const parsed: Prize[] = prizes.map((p) => ({ rankFrom: Math.round(Number(p.rankFrom)), rankTo: Math.round(Number(p.rankTo)), amount: Number(p.amount), payout: kind === "demo" ? "wallet" : p.payout }));
  const pool = parsed.reduce((s, p) => s + (p.rankTo >= p.rankFrom && p.amount > 0 ? (p.rankTo - p.rankFrom + 1) * p.amount : 0), 0);
  const upd = (i: number, patch: Partial<PrizeRow>) => setPrizes((x) => x.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const antiCheat = { minHoldSeconds: Math.max(0, Math.round(Number(minHold) || 0)), maxSingleTradePct: Number(maxSingle) || 0, disqualifyOnBalanceChange: dqBalance };

  const submit = () => {
    if (!name.trim()) return "Give the contest a name.";
    if (locked) {
      // after the start: only the fields the service still accepts
      return mkSend<{ contest: Contest }>(`contests/${initial!.id}`, { name: name.trim(), description: description.trim(), rules: rules.trim(), maxEntrants: numOrNull(maxEntrants), kycRequired: kind === "live" ? kyc : false, antiCheat }, "PATCH");
    }
    const s = fromLocalInput(startsAt);
    const e = fromLocalInput(endsAt);
    if (!s || !e) return "Set when the contest starts and ends.";
    if (e <= s) return "Ends must be after Starts.";
    if (kind === "demo" && !(Number(startingBalance) > 0)) return "Set the demo starting balance.";
    if (options && minPremium.trim() !== "" && !(Number(minPremium) >= 0)) return "The minimum premium must be 0 or more.";
    let last = 0;
    for (const p of parsed) {
      if (!(p.rankFrom >= 1) || !(p.rankTo >= p.rankFrom)) return "Each prize row needs Rank from ≤ Rank to.";
      if (p.rankFrom <= last) return "Prize ranks must not overlap and must go down the table in order.";
      if (!(p.amount > 0)) return "Each prize needs an amount above 0.";
      last = p.rankTo;
    }
    const body: ContestInput = {
      name: name.trim(),
      description: description.trim(),
      kind,
      instrument,
      startsAt: s,
      endsAt: e,
      scoring,
      minTrades: Math.max(0, Math.round(Number(minTrades) || 0)),
      maxEntrants: numOrNull(maxEntrants),
      startingBalance: kind === "demo" ? Number(startingBalance) : null,
      demoGroup: kind === "demo" ? demoGroup.trim() || null : null,
      accountGroups: kind === "live" ? splitList(accountGroups) : [],
      kycRequired: kind === "live" ? kyc : false,
      minEquity: kind === "live" ? numOrNull(minEquity) : null,
      prizes: parsed,
      rules: rules.trim(),
      antiCheat,
      minPremium: options ? numOrNull(minPremium) : null,
      status,
    };
    return editing ? mkSend<{ contest: Contest }>(`contests/${initial!.id}`, body, "PATCH") : mkSend<{ contest: Contest }>("contests", body);
  };

  const Step = ({ n, title, hint }: { n: number; title: string; hint?: string }) => (
    <div className="flex items-center gap-2.5">
      <span className="k-num grid size-6 place-items-center rounded-full border border-line bg-surface-2 text-[11.5px] font-semibold text-fg-2">{n}</span>
      <div>
        <div className="text-[14px] font-medium">{title}</div>
        {hint && <div className="text-[12px] text-fg-3">{hint}</div>}
      </div>
    </div>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={editing ? `Edit ${initial!.name}` : "New contest"}
      description={locked ? "The contest has started: timing, instrument, scoring, eligibility and prizes are locked." : "Configure the window, instrument, scoring, eligibility, prizes and anti-cheat rules."}
      submitLabel={editing ? "Save changes" : status === "draft" ? "Save draft" : "Schedule contest"}
      submitTestId="contest-form-submit"
      footerNote={<span className="k-num">Pool {usd(pool, 0)}</span>}
      submit={submit}
      success={(r: { contest?: Contest }) => (editing ? `${r.contest?.name ?? name} saved` : `${r.contest?.name ?? name} ${status === "draft" ? "saved as draft" : "scheduled"}`)}
      onDone={(r: { contest?: Contest }) => onSaved(r.contest)}
    >
      <div className="space-y-3">
        <Step n={1} title="Basics" />
        <TextF label="Name" value={name} onChange={setName} placeholder="e.g. October FX Masters" maxLength={120} />
        <AreaF label="Description" value={description} onChange={setDescription} rows={2} />
        <fieldset disabled={locked} className={cn("grid min-w-0 grid-cols-2 gap-3", locked && "opacity-60")}>
          <SelectF label="Account type" value={kind} onChange={setKind} options={[{ value: "demo", label: "Demo (new account per entrant)" }, { value: "live", label: "Live (client's own account)" }]} className="col-span-2" />
          <SelectF
            label="Instrument"
            value={instrument}
            onChange={pickInstrument}
            options={[
              { value: "cfd", label: "CFD (lots)" },
              { value: "options", label: "Options (Ezymex FX Options, contracts)" },
            ]}
            hint={options ? "Only option trades count, on realised P&L" : "CFD trades only; options never count"}
            className="col-span-2"
          />
          <DateTimeF label="Starts" value={startsAt} onChange={setStartsAt} />
          <DateTimeF label="Ends" value={endsAt} onChange={setEndsAt} />
        </fieldset>
      </div>

      <fieldset disabled={locked} className={cn("min-w-0 space-y-3", locked && "opacity-60")}>
        <Step n={2} title="Scoring and eligibility" hint={options ? "Only option exits closed inside the window on the entered account count: closes, expiry settlements, knock-outs" : "Only deals closed inside the window on the entered account count"} />
        <div className="grid grid-cols-2 gap-3">
          <SelectF label="Scoring" value={scoring} onChange={setScoring} options={scoringOptions(instrument)} className="col-span-2" />
          <NumF label="Min trades" value={minTrades} onChange={setMinTrades} step={1} hint="to rank" />
          <NumF label="Max entrants" value={maxEntrants} onChange={setMaxEntrants} step={1} placeholder="Unlimited" />
          {options && (
            <NumF
              label="Minimum premium per trade"
              value={minPremium}
              onChange={setMinPremium}
              prefix="$"
              placeholder="None"
              hint="Trades opened for less add no contracts and don't count as a trade (their P&L still counts), so penny options can't farm volume"
              className="col-span-2"
            />
          )}
          {kind === "demo" ? (
            <>
              <NumF label="Starting balance" value={startingBalance} onChange={setStartingBalance} prefix="$" />
              <TextF label="Demo group" value={demoGroup} onChange={setDemoGroup} placeholder="Default demo group" mono hint={options ? "Must have options enabled" : undefined} />
            </>
          ) : (
            <>
              <TextF label="Account groups" value={accountGroups} onChange={setAccountGroups} placeholder="All live groups" hint={options ? "comma separated; copy, PAMM, MAM and prop never trade options" : "comma separated"} />
              <NumF label="Minimum equity" value={minEquity} onChange={setMinEquity} prefix="$" placeholder="None" />
            </>
          )}
        </div>
        {options && (
          <div className="rounded-[12px] border border-info/25 bg-info-soft px-4 py-3 text-[12.5px] leading-relaxed text-fg-2" data-testid="contest-options-note">
            Open only to clients who can trade Ezymex FX Options (the options intro accepted) on accounts outside copy, PAMM, MAM and prop groups. Self-trades between a client&apos;s own accounts are left out of the score and flagged for review. Options still earn no loyalty points, cashback or bonus release.
          </div>
        )}
      </fieldset>
      {kind === "live" && (
        <div className="k-row px-4">
          <ToggleRow label="Require verified KYC" hint="Only verified clients can join" checked={kyc} onChange={setKyc} />
        </div>
      )}

      <fieldset disabled={locked} className={cn("min-w-0 space-y-3", locked && "opacity-60")}>
        <Step n={3} title="Prizes" hint={kind === "demo" ? "Demo contests pay prizes to the wallet" : "Wallet credit, or engine credit on the entered live account"} />
        <div className="space-y-2">
          {prizes.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.3fr_1.2fr_auto] items-end gap-2">
              <NumF label={`Rank from (${i + 1})`} value={p.rankFrom} onChange={(v) => upd(i, { rankFrom: v })} step={1} />
              <NumF label={`Rank to (${i + 1})`} value={p.rankTo} onChange={(v) => upd(i, { rankTo: v })} step={1} />
              <NumF label={`Amount (${i + 1})`} value={p.amount} onChange={(v) => upd(i, { amount: v })} prefix="$" />
              {kind === "live" ? (
                <SelectF label={`Payout (${i + 1})`} value={p.payout} onChange={(v) => upd(i, { payout: v })} options={[{ value: "wallet", label: "Wallet" }, { value: "credit", label: "Credit" }]} />
              ) : (
                <div className="flex h-10 items-center text-[12.5px] text-fg-3">Wallet</div>
              )}
              <button type="button" onClick={() => setPrizes((x) => x.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-[12px] border border-line text-fg-3 hover:text-down" aria-label={`Remove prize row ${i + 1}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="surface"
            onClick={() => {
              const last = prizes[prizes.length - 1];
              const from = last ? Number(last.rankTo) + 1 : 1;
              setPrizes((x) => [...x, { rankFrom: String(from), rankTo: String(from), amount: "50", payout: "wallet" }]);
            }}
          >
            <Plus /> Add prize row
          </Button>
          <div className="k-row flex items-center justify-between px-4 py-2.5">
            <span className="text-[12.5px] text-fg-3">Prize pool</span>
            <span className="k-num text-[15px] font-semibold text-gold">{usd(pool, 0)}</span>
          </div>
        </div>
      </fieldset>

      <div className="space-y-3">
        <Step n={4} title="Rules and anti-cheat" />
        <AreaF label="Rules" value={rules} onChange={setRules} rows={4} placeholder="Shown to clients on the contest page" />
        <div className="grid grid-cols-2 gap-3">
          <NumF label="Minimum hold" value={minHold} onChange={setMinHold} suffix="seconds" step={1} />
          <NumF label="Max single trade" value={maxSingle} onChange={setMaxSingle} suffix="% of profit" />
        </div>
        <div className="k-row px-4">
          <ToggleRow label="Disqualify on balance change" hint="Deposits, withdrawals, transfers or staff adjustments during the contest" checked={dqBalance} onChange={setDqBalance} />
        </div>
        {!locked && <SelectF label="Publish as" value={status} onChange={setStatus} options={[{ value: "scheduled", label: "Scheduled (visible, opens at start)" }, { value: "draft", label: "Draft (hidden)" }]} />}
      </div>
    </FormDialog>
  );
}

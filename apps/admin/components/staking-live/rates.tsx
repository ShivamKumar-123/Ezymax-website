"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, Lock, RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, IconButton, PageHeader, Reveal, Skeleton, cn } from "@ezymex/ui";
import { MiniStat } from "@/components/config/kit";
import { ago, useApi, useNow, when } from "@/components/live/kit";
import { S, stakingSend, type RateItem, type RatesMonth } from "./api";
import { EmptyNote, LinkButton, Note, PLAN_STATUS, ReadOnlyNote, SETTLEMENT_STATUS, StakingError, StatusPill, amt, money, int, isPeriod, monthName, pct, periodOf, shiftPeriod, usePerms, useReasonAction, useUrlParam } from "./kit";

const RATE = /^\d+(\.\d{1,4})?$/;
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Parsed rate of the input, or an error. */
function parseRate(text: string, ceiling: number): { value: number | null; error: string | null } {
  const t = text.trim().replace(",", ".");
  if (!t) return { value: null, error: null };
  if (!RATE.test(t)) return { value: null, error: "A percentage of 0 or more, at most 4 decimals." };
  const v = Number(t);
  if (v > ceiling) return { value: v, error: `Above the plan's ceiling of ${pct(ceiling)} a month.` };
  return { value: v, error: null };
}

/* ------------------------------------------------------------------ */
/* One plan's rate                                                      */
/* ------------------------------------------------------------------ */

function RateRow({ item, m, canEdit, onSaved }: { item: RateItem; m: RatesMonth; canEdit: boolean; onSaved: () => void }) {
  const now = useNow();
  const act = useReasonAction();
  const p = item.plan;
  const initial = item.rate ? String(item.rate.ratePct) : "";
  const [text, setText] = React.useState(initial);
  const [note, setNote] = React.useState(item.rate?.note ?? "");
  React.useEffect(() => {
    setText(item.rate ? String(item.rate.ratePct) : "");
    setNote(item.rate?.note ?? "");
  }, [item.rate, m.period]);

  const { value, error } = parseRate(text, p.maxMonthlyRatePct);
  const estimate = value !== null ? r2(item.basePerPct * value) : null;
  const prevReturns = item.previousReturns;
  const delta = estimate !== null && prevReturns !== null && prevReturns > 0 ? ((estimate - prevReturns) / prevReturns) * 100 : null;
  const dirty = value !== null && (item.rate === null || value !== item.rate.ratePct || (note.trim() || null) !== (item.rate.note || null));
  const missing = item.rate === null && item.positions > 0;

  const save = () => {
    if (value === null || error) return;
    act.ask<{ saved: unknown; month: RatesMonth }>({
      title: `${item.rate ? "Change" : "Set"} the ${monthName(m.period)} rate for ${p.name}`,
      description: m.closed
        ? "The month is over: this rate is what the month's settlement will pay. It stays editable until the settlement is created."
        : "The month is still running: positions that start later this month are counted when the settlement is created.",
      body: (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MiniStat label="Rate" value={pct(value)} sub={item.rate ? `was ${pct(item.rate.ratePct)}` : `ceiling ${pct(p.maxMonthlyRatePct)}`} tone="gold" />
          <MiniStat label="Estimated returns" value={estimate !== null ? money(estimate, p.currency) : "—"} sub={`${int(item.positions)} position${item.positions === 1 ? "" : "s"}`} />
          <MiniStat label={`${monthName(m.previousPeriod, "short")} returns`} value={prevReturns !== null ? money(prevReturns, p.currency) : "—"} sub={item.previous ? `at ${pct(item.previous.ratePct)}` : "No rate"} />
        </div>
      ),
      confirmLabel: item.rate ? "Change rate" : "Set rate",
      placeholder: "Why this rate? Kept in the staking audit log.",
      run: (reason) => stakingSend<{ saved: unknown; month: RatesMonth }>("rates", { planId: p.id, period: m.period, ratePct: value, ...(note.trim() ? { note: note.trim() } : {}), reason }),
      success: `${p.name}: ${pct(value)} for ${monthName(m.period, "short")}`,
      successDetail: estimate !== null ? `About ${amt(estimate, p.currency)} to ${int(item.positions)} position${item.positions === 1 ? "" : "s"} · recorded in the staking audit log` : undefined,
      onDone: onSaved,
    });
  };

  return (
    <div className={cn("k-row grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start", missing && m.closed && "border-warn/40")}>
      {/* plan */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-medium">{p.name}</span>
          <StatusPill map={PLAN_STATUS} status={p.status} />
        </div>
        <div className="mt-1 text-[11.5px] text-fg-3">
          {p.termMonths} month{p.termMonths === 1 ? "" : "s"} · ceiling <span className="k-num text-fg-2">{pct(p.maxMonthlyRatePct)}</span> a month
        </div>
        <div className="k-num mt-2 text-[12px] text-fg-2">
          {int(item.positions)} earning position{item.positions === 1 ? "" : "s"} · {amt(item.principal, p.currency)}
        </div>
      </div>

      {/* previous month */}
      <div className="min-w-0">
        <div className="k-label">{monthName(m.previousPeriod, "short")}</div>
        <div className="k-num mt-1 text-[15px] font-medium">{item.previous ? pct(item.previous.ratePct) : <span className="text-fg-3">No rate</span>}</div>
        <div className="mt-0.5 text-[11.5px] text-fg-3">{prevReturns !== null ? `${amt(prevReturns, p.currency)} paid` : "No returns settled"}</div>
      </div>

      {/* this month */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="k-label">{monthName(m.period, "short")}</span>
          {item.rate ? (
            <span className="truncate text-[11px] text-fg-3" title={`${item.rate.setBy} · ${when(item.rate.setAt)}`}>
              {pct(item.rate.ratePct)} set by {item.rate.setBy || "staff"} {ago(item.rate.setAt, now)}
            </span>
          ) : (
            <span className={cn("text-[11px]", missing ? "text-warn" : "text-fg-3")}>{missing ? "Not set yet" : "No rate"}</span>
          )}
        </div>
        {canEdit ? (
          <>
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className={cn(
                  "flex h-10 flex-1 items-center gap-1.5 rounded-[12px] border bg-surface-2 px-3 text-[14px] transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10",
                  error ? "border-down/50" : "border-line",
                )}
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && dirty && !error && save()}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`${p.name} rate for ${monthName(m.period)}`}
                  className="k-num h-full w-full min-w-0 bg-transparent font-medium text-fg outline-none placeholder:text-fg-3"
                />
                <span className="shrink-0 text-[11.5px] text-fg-3">% a month</span>
              </div>
              <Button size="sm" variant={dirty ? "ember" : "surface"} disabled={!dirty || !!error} onClick={save} className="h-10">
                {item.rate ? "Change" : "Set"}
              </Button>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Note (optional)"
              aria-label="Note"
              className="mt-1.5 h-8 w-full rounded-[10px] border border-line bg-surface-2/60 px-2.5 text-[12px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50"
            />
            <div className={cn("mt-1 text-[11px]", error ? "text-down" : "text-fg-3")}>{error ?? `0 % to ${pct(p.maxMonthlyRatePct)} · 4 decimals`}</div>
          </>
        ) : (
          <div className="mt-1">
            <div className="k-num text-[15px] font-medium">{item.rate ? pct(item.rate.ratePct) : <span className="text-fg-3">—</span>}</div>
            {item.rate?.note && <div className="mt-0.5 text-[11.5px] text-fg-3">“{item.rate.note}”</div>}
          </div>
        )}
      </div>

      {/* preview */}
      <div className="min-w-0 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5">
        <div className="k-label">{value !== null && value !== item.rate?.ratePct ? "Preview" : "Estimated returns"}</div>
        <div className={cn("k-num mt-1 text-[15px] font-medium", estimate !== null ? "text-gold" : "text-fg-3")}>{estimate !== null ? amt(estimate, p.currency) : "—"}</div>
        <div className="mt-0.5 text-[11px] text-fg-3">
          {item.positions === 0
            ? "No position earns in this month"
            : delta !== null
              ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}% vs ${monthName(m.previousPeriod, "tiny")} returns`
              : `${amt(item.basePerPct, p.currency)} per 1 %`}
        </div>
      </div>
      {act.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveStakingRates() {
  const perms = usePerms();
  const [param, setParam] = useUrlParam("period");
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const url = ready ? `${S("rates")}${isPeriod(param) ? `?period=${param}` : ""}` : null;
  const { data, error, loading, reload } = useApi<RatesMonth>(url);
  const m = data;
  const current = m?.currentPeriod ?? periodOf();
  const period = m?.period ?? (isPeriod(param) ? param : shiftPeriod(current, -1));
  const go = (p: string) => setParam(p);

  const items = m?.items ?? [];
  const earning = items.filter((i) => i.positions > 0);
  const missing = earning.filter((i) => i.rate === null);
  const setCount = items.filter((i) => i.rate !== null).length;
  const estimate = items.reduce((a, i) => a + (i.estimate ?? 0), 0);
  const principal = items.reduce((a, i) => a + i.principal, 0);
  const prevPaid = items.reduce((a, i) => a + (i.previousReturns ?? 0), 0);
  const cur = items[0]?.plan.currency ?? "USDT";
  const canEdit = !!m && perms.write && m.editable;

  return (
    <div className="pb-16">
      <PageHeader
        title="Monthly rates"
        subtitle="Each plan's return for a month, set once the month has started and never promised in advance."
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="set rates" />}
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <IconButton size="sm" aria-label="Previous month" onClick={() => go(shiftPeriod(period, -1))}>
            <ChevronLeft />
          </IconButton>
          <div className="min-w-36 text-center">
            <div className="text-[15px] font-medium">{monthName(period)}</div>
            <div className="text-[11px] text-fg-3">{m ? (m.future ? "Not started" : m.closed ? "Closed" : "In progress") : " "}</div>
          </div>
          <IconButton size="sm" aria-label="Next month" disabled={period >= current} onClick={() => go(shiftPeriod(period, 1))}>
            <ChevronRight />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={period === shiftPeriod(current, -1) ? "outline" : "ghost"} onClick={() => go(shiftPeriod(current, -1))}>
            Last closed · {monthName(shiftPeriod(current, -1), "short")}
          </Button>
          <Button size="sm" variant={period === current ? "outline" : "ghost"} onClick={() => go(current)}>
            This month · {monthName(current, "short")}
          </Button>
          <input
            type="month"
            value={period}
            max={current}
            onChange={(e) => isPeriod(e.target.value) && go(e.target.value)}
            aria-label="Pick a month"
            className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none focus:border-ember/50"
          />
        </div>
      </Card>

      {error && !m ? (
        <StakingError error={error} onRetry={reload} />
      ) : !m ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[74px] w-full rounded-[16px]" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-[20px]" />
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : undefined}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Rates set" value={`${int(setCount)} of ${int(items.length)}`} sub={missing.length ? `${int(missing.length)} earning plan${missing.length === 1 ? "" : "s"} without a rate` : "Every earning plan has a rate"} tone={missing.length ? "warn" : setCount ? "up" : undefined} />
            <MiniStat label="Principal earning" value={money(principal, cur)} sub={`${int(earning.reduce((a, i) => a + i.positions, 0))} positions in ${monthName(m.period, "short")}`} />
            <MiniStat label="Estimated returns" value={money(estimate, cur)} sub="From the rates saved" tone="gold" />
            <MiniStat label={`${monthName(m.previousPeriod, "short")} returns`} value={money(prevPaid, cur)} sub="Settled lines of the month before" />
          </div>

          <div className="mt-4">
            {m.future ? (
              <Note tone="info" icon={<CalendarClock />}>
                {monthName(m.period)} hasn&apos;t started yet. Rates are set month by month once the month has begun, so nothing is promised to clients in advance.
              </Note>
            ) : m.settlement ? (
              <Note tone="warn" icon={<Lock />}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Locked: settlement <span className="font-mono">#{m.settlement.id}</span> for {monthName(m.period)} is {SETTLEMENT_STATUS[m.settlement.status]?.label.toLowerCase() ?? m.settlement.status}.
                    {m.settlement.status === "pending_approval" ? " Reject it first to change a rate." : " Its rates can no longer change."}
                  </span>
                  <LinkButton href={`/staking/settlements?settlement=${m.settlement.id}`}>
                    Open settlement <ArrowUpRight />
                  </LinkButton>
                </div>
              </Note>
            ) : m.closed ? (
              <Note tone={missing.length ? "warn" : "up"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {monthName(m.period)} is over in server time.{" "}
                    {missing.length ? `Set the rate for ${missing.map((i) => i.plan.name).join(", ")}, then create the settlement.` : earning.length ? "Every earning plan has its rate: the month can be settled." : "No position earned in this month."}
                  </span>
                  {!missing.length && earning.length > 0 && (
                    <LinkButton href={`/staking/settlements?new=${m.period}`} variant="ember">
                      Preview settlement <ArrowUpRight />
                    </LinkButton>
                  )}
                </div>
              </Note>
            ) : (
              <Note icon={<CalendarClock />}>
                {monthName(m.period)} is in progress; it closes {when(m.closesAt)} server time. Rates can be set now and changed until the month&apos;s settlement is created. Estimates count the positions earning so far.
              </Note>
            )}
          </div>

          <Reveal delay={0.05}>
            <Card className="mt-4">
              <CardHeader title={`${monthName(m.period)} rates`} subtitle="Return = principal × rate × days active in the month ÷ days in the month, rounded to cents. A 0 % month pays nothing." />
              <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                {items.length === 0 ? (
                  <EmptyNote
                    title="No plans to rate"
                    text="Plans show here once they are on sale, paused or closed, or while their positions earn."
                    action={<Link href="/staking/plans"><Button size="sm" variant="surface">Plans</Button></Link>}
                  />
                ) : (
                  items.map((it) => <RateRow key={it.plan.id} item={it} m={m} canEdit={canEdit} onSaved={reload} />)
                )}
              </div>
            </Card>
          </Reveal>
        </div>
      )}
    </div>
  );
}

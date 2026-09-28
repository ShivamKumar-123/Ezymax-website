"use client";

import * as React from "react";
import { CircleDollarSign, Gauge, TrendingUp, Trophy } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, PageHeader, Reveal, cn, type Column } from "@kalks/ui";
import { NumInput } from "@/components/config/kit";
import { Pager, TableSkeleton, ago, qs, useApi, useDebounced, useNow } from "@/components/live/kit";
import { ChallengeDrawer } from "./challenge-drawer";
import { BLOCKER_LABEL, PropError, TraderCell, int, pct, propWrite, reasonText, signedUsd, usd, usdK, useAction, useClientNames, usePropCan, type Challenge, type ChallengeDetail, type Overview, type PayoutQuote } from "./kit";

const LIMIT = 50;
const SCALE_REASONS = ["Scaling review passed", "Management decision", "Retention"];

/** Payout quotes of the listed funded challenges (the admin list has no quote; the detail has one). */
function useQuotes(ids: number[]) {
  const key = ids.slice(0, 50).join(",");
  const [quotes, setQuotes] = React.useState<Record<number, PayoutQuote | null>>({});
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  React.useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all(
      key.split(",").map((id) =>
        fetch(`/api/prop/challenges/${id}`, { cache: "no-store", credentials: "same-origin" })
          .then((r) => (r.ok ? (r.json() as Promise<ChallengeDetail>) : null))
          .then((d) => [Number(id), d?.payout ?? null] as const)
          .catch(() => [Number(id), null] as const),
      ),
    ).then((pairs) => {
      if (alive) setQuotes((q) => ({ ...q, ...Object.fromEntries(pairs) }));
    });
    return () => {
      alive = false;
    };
  }, [key, tick]);
  return quotes;
}

export function LiveFundedPage() {
  const now = useNow();
  const canWrite = usePropCan("prop.write");
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q.trim(), 300);
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [dq]);
  const [sel, setSel] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const act = useAction();
  const scaleTo = React.useRef(0);

  const { data, error, reload } = useApi<{ items: Challenge[]; total: number }>(`/api/prop/challenges${qs({ status: "funded", q: dq, page, limit: LIMIT })}`, { refreshMs: 3000 });
  const ov = useApi<Overview>("/api/prop/overview", { refreshMs: 15_000 });
  const rows = data?.items ?? [];
  const names = useClientNames(rows.map((r) => r.userId));
  const quotes = useQuotes(rows.map((r) => r.id));

  const profitOf = (c: Challenge) => (c.current?.equity ?? c.current?.initialBalance ?? 0) - (c.current?.initialBalance ?? 0);
  const eligible = rows.filter((c) => quotes[c.id]?.eligible).length;

  const scale = (c: Challenge) => {
    const a = c.current;
    if (!a) return;
    const inc = c.plan?.scalingIncrease ?? 25;
    const cap = c.plan?.scalingCap ?? 0;
    scaleTo.current = Math.round((a.initialBalance * (1 + inc / 100)) / 1000) * 1000;
    act.ask({
      title: `Scale funded account #${a.login}`,
      description: `Current size ${usd(a.initialBalance, 0)}. The plan scales by ${inc}% every ${c.plan?.scalingEvery ?? "—"} months at ${c.plan?.scalingProfit ?? "—"}% profit, up to ${usdK(cap)}.`,
      reasons: SCALE_REASONS,
      note: "optional",
      confirmLabel: "Scale account",
      body: <ScaleField valueRef={scaleTo} min={a.initialBalance} cap={cap} />,
      run: (v) => propWrite(`accounts/${a.id}/scale`, { toSize: scaleTo.current, reason: reasonText(v) }),
      success: `#${a.login} scaled`,
      onDone: reload,
    });
  };

  const columns: Column<Challenge>[] = [
    { key: "trader", header: "Trader", cell: (c) => <TraderCell name={c.traderName} userId={c.userId} names={names} sub={<span className="font-mono">{c.current?.login ?? "—"}</span>} />, sort: (c) => c.traderName, csv: (c) => c.traderName },
    { key: "plan", header: "Plan", hideOn: "lg", cell: (c) => <span className="text-[12.5px]">{c.planName}</span>, csv: (c) => c.planName },
    { key: "size", header: "Account", align: "right", cell: (c) => <span className="k-num font-medium">{usd(c.current?.initialBalance, 0)}{c.current?.scaledAt && <span className="block text-[10.5px] font-normal text-up">scaled {ago(c.current.scaledAt, now)}</span>}</span>, sort: (c) => c.current?.initialBalance ?? 0, csv: (c) => c.current?.initialBalance ?? "" },
    { key: "bal", header: "Balance", align: "right", hideOn: "md", cell: (c) => <span className="k-num">{usd(c.current?.balance)}</span>, sort: (c) => c.current?.balance ?? 0, csv: (c) => c.current?.balance ?? "" },
    { key: "eq", header: "Equity", align: "right", cell: (c) => <span className="k-num">{usd(c.current?.equity)}</span>, sort: (c) => c.current?.equity ?? 0, csv: (c) => c.current?.equity ?? "" },
    { key: "pl", header: "Profit", align: "right", cell: (c) => <span className={cn("k-num font-medium", profitOf(c) >= 0 ? "text-up" : "text-down")}>{signedUsd(profitOf(c))}</span>, sort: profitOf, csv: profitOf },
    { key: "split", header: "Split", align: "right", hideOn: "md", cell: (c) => <span className="k-num text-gold">{pct(c.split, 0)}</span>, csv: (c) => c.split },
    {
      key: "payout",
      header: "Payout",
      cell: (c) => {
        const qt = quotes[c.id];
        if (qt === undefined) return <span className="text-fg-3">…</span>;
        if (qt === null) return <span className="text-fg-3">—</span>;
        return qt.eligible ? (
          <span className="flex flex-col items-start gap-0.5">
            <Chip size="sm" tone="up" dot>
              Eligible
            </Chip>
            <span className="k-num text-[11px] text-fg-3">{usd(qt.traderAmount)} to trader</span>
          </span>
        ) : (
          <span className="flex flex-col items-start gap-0.5">
            <Chip size="sm" tone="neutral">
              {BLOCKER_LABEL[qt.blockers[0] ?? ""] ?? "Not eligible"}
            </Chip>
            {qt.eligibleFrom && <span className="text-[11px] text-fg-3">from {ago(qt.eligibleFrom, now)}</span>}
          </span>
        );
      },
      sort: (c) => (quotes[c.id]?.eligible ? 1 : 0),
    },
    { key: "last", header: "Last payout", hideOn: "xl", cell: (c) => <span className="text-[12px] text-fg-3">{c.current?.lastPayoutAt ? ago(c.current.lastPayoutAt, now) : "never"}</span> },
    { key: "flags", header: "Flags", align: "right", hideOn: "lg", cell: (c) => (c.flags ? <Chip size="sm" tone="warn">{c.flags}</Chip> : <span className="text-fg-3">—</span>) },
    ...(canWrite
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (c: Challenge) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Button size="xs" variant="surface" disabled={c.current?.status !== "active"} onClick={() => scale(c)}>
                  <TrendingUp /> Scale
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="pb-24">
      <PageHeader title="Funded traders" subtitle="Simulated funded accounts (B-book): live equity, profit split, payout eligibility and scaling." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Funded traders" icon={<Trophy />} value={<span className="k-num">{int(ov.data?.funded)}</span>} chip={`${usdK(ov.data?.fundedCapital)} simulated capital`} chipTone="gold" />
        <KpiCard label="Eligible for payout (page)" icon={<CircleDollarSign />} value={<span className="k-num">{eligible}</span>} chip="Quote with no blockers" chipTone={eligible ? "up" : "neutral"} delay={0.04} />
        <KpiCard label="Payouts pending" icon={<CircleDollarSign />} value={<span className="k-num">{int(ov.data?.payoutsPending)}</span>} chip={usd(ov.data?.payoutsPendingAmount)} chipTone={(ov.data?.payoutsPending ?? 0) > 0 ? "warn" : "neutral"} href="/prop/payouts" delay={0.08} />
        <KpiCard label="Paid · 30d" icon={<Gauge />} value={<span className="k-num">{usd(ov.data?.paid30d, 0)}</span>} chip={`vs ${usd(ov.data?.fees30d, 0)} fees`} delay={0.12} />
      </div>

      <Reveal delay={0.08} className="mt-4">
        <Card>
          <CardHeader title="Funded accounts" subtitle={data ? `${int(data.total)} funded · click a row for rules, payouts and history` : "Loading…"} />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <div className="mb-3 flex justify-end">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Trader, client id, challenge id, login" aria-label="Search funded accounts" className="h-9 w-72 max-w-full rounded-full border border-line bg-surface-2 px-3.5 text-[12.5px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50" />
            </div>
            {error && !data ? (
              <PropError error={error} onRetry={reload} />
            ) : !data ? (
              <TableSkeleton />
            ) : (
              <>
                <DataTable columns={columns} rows={rows} pageSize={LIMIT} dense rowKey={(c) => String(c.id)} exportName="prop-funded" onRowClick={(c) => { setSel(c.id); setOpen(true); }} empty={<div className="py-10 text-center text-[13px] text-fg-3">No funded accounts yet.</div>} />
                <Pager page={page} perPage={LIMIT} total={data.total} onPage={setPage} />
              </>
            )}
          </div>
        </Card>
      </Reveal>

      <ChallengeDrawer id={sel} open={open} onOpenChange={setOpen} onChanged={reload} funded />
      {act.node}
    </div>
  );
}

function ScaleField({ valueRef, min, cap }: { valueRef: React.MutableRefObject<number>; min: number; cap: number }) {
  const [v, setV] = React.useState(valueRef.current);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5">
      <span className="text-[13px] text-fg-2">New account size</span>
      <NumInput
        size="sm"
        className="w-40"
        prefix="$"
        value={v}
        min={min}
        max={cap || undefined}
        step={1000}
        onChange={(n) => {
          setV(n);
          valueRef.current = n;
        }}
      />
    </div>
  );
}

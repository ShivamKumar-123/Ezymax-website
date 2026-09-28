"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Blocks, BookOpen, CalendarClock, CandlestickChart, Check, CheckCircle2, Download, Hourglass, Loader2, Play, Scale } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Money, PageHeader, Reveal, StatusChip, Tooltip, cn, type Column } from "@kalks/ui";
import { FIN_MISMATCHES, FIN_RECON_REASONS, FIN_RECON_RUNS, type FinMismatch, type FinReconRun } from "@kalks/mock/admin-finance";
import { ColumnChart, PersonCell, TxHash, auditToast, useReason } from "@/components/config/kit";
import { Line, fmtDuration, usd } from "@/components/finance/shared";

const STEPS = ["Fetch TRON / BTC / EVM balances", "Replay wallet ledger", "Pull MT5 balances & credit", "Match transactions", "Build report"];

function Total({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number; sub: string; tone?: string }) {
  return (
    <div className="k-row min-w-0 px-4 py-3.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-fg-3">
        <span className={cn("grid size-6 place-items-center rounded-full bg-surface-3 [&_svg]:size-3.5", tone)}>{icon}</span>
        {label}
      </div>
      <Money value={value} className="mt-2 block truncate text-[22px] font-semibold tracking-tight" />
      <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>
    </div>
  );
}

export default function ReconciliationPage() {
  const [runs, setRuns] = React.useState<FinReconRun[]>(FIN_RECON_RUNS);
  const [mm, setMm] = React.useState<FinMismatch[]>(FIN_MISMATCHES);
  const [selId, setSelId] = React.useState(FIN_RECON_RUNS[0]!.id);
  const [running, setRunning] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<FinMismatch | null>(null);
  const reason = useReason();

  const latest = runs[0]!;
  const run = runs.find((r) => r.id === selId) ?? latest;
  const isLatest = run.id === latest.id;
  const open = mm.filter((m) => m.status === "open");
  const openDelta = open.reduce((s, m) => s + m.amount, 0);
  const status: FinReconRun["status"] = isLatest ? (open.length ? "mismatch" : latest.mismatches ? "resolved" : "matched") : run.status;
  const delta = isLatest ? openDelta : run.delta;

  const resolve = (m: FinMismatch) =>
    reason.ask({
      title: `Resolve ${m.type.toLowerCase()}`,
      description: `${usd(m.amount)} · ${m.ref}${m.client ? ` · ${m.client.person.name}` : ""}`,
      reasons: FIN_RECON_REASONS,
      confirmLabel: "Mark resolved",
      tone: "buy",
      onConfirm: (r) => {
        setMm((list) => list.map((x) => (x.id === m.id ? { ...x, status: "resolved" } : x)));
        setDetail(null);
        auditToast(`${m.ref} reconciled`, r);
      },
    });

  const runNow = () => {
    setRunning(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      if (i >= STEPS.length) {
        clearInterval(t);
        setRunning(null);
        const n = open.length;
        const nr: FinReconRun = { ...latest, id: `RC-M${runs.length}`, date: "24 Sep 2026 · 14:3" + (runs.length % 10), trigger: "Manual", mismatches: n, delta: openDelta, status: n ? "mismatch" : "matched", durationSec: 71 };
        setRuns((r) => [nr, ...r]);
        setSelId(nr.id);
        auditToast(n ? `Manual run finished · ${n} open mismatch${n > 1 ? "es" : ""}` : "Manual run finished · fully matched", `Δ ${usd(openDelta)}`);
      } else setRunning(i);
    }, 650);
  };

  const cols: Column<FinMismatch>[] = [
    {
      key: "type",
      header: "Mismatch",
      cell: (m) => (
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", m.status === "resolved" ? "bg-up-soft text-up" : m.type === "Rounding difference" ? "bg-surface-3 text-fg-2" : "bg-down-soft text-down")}>
            {m.status === "resolved" ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <div className={cn("truncate text-[13.5px] font-medium", m.status === "resolved" && "text-fg-3 line-through decoration-fg-3/40")}>{m.type}</div>
            <div className="font-mono text-[11px] text-fg-3">
              {m.ref} · {m.side === "chain" ? "on-chain" : m.side}
            </div>
          </div>
        </div>
      ),
    },
    { key: "amt", header: "Amount", align: "right", cell: (m) => <span className={cn("k-num font-medium", m.amount < 0 ? "text-down" : "text-fg")}>{m.amount < 0 ? "-" : ""}{usd(Math.abs(m.amount))}</span>, sort: (m) => Math.abs(m.amount) },
    { key: "client", header: "Client", cell: (m) => (m.client ? <PersonCell name={m.client.person.name} photo={m.client.person.photo} sub={<span className="font-mono">{m.client.login}</span>} size={26} /> : <span className="text-[12px] text-fg-3">System · aggregate</span>), hideOn: "md" },
    { key: "tx", header: "Tx", cell: (m) => (m.hash ? <TxHash hash={m.hash} /> : <span className="text-[12px] text-fg-3">—</span>), hideOn: "lg" },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (m) =>
        m.status === "resolved" ? (
          <StatusChip status="completed" label="Resolved" />
        ) : (
          <Button
            size="xs"
            variant="surface"
            onClick={(e) => {
              e.stopPropagation();
              resolve(m);
            }}
          >
            Resolve
          </Button>
        ),
    },
  ];

  const chart = runs
    .filter((r) => r.trigger === "Scheduled" || r.id === latest.id)
    .slice(0, 30)
    .reverse()
    .map((r) => ({ label: r.date.slice(0, 2), values: [Math.round(r.pending), Math.round(Math.abs(r.delta))] }));

  return (
    <div className="pb-24">
      <PageHeader
        title="Reconciliation"
        subtitle="Daily 06:00 GMT+3 · blockchain balances vs wallet ledger vs trading accounts"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Schedule: daily at 06:00 GMT+3", { description: "Alerts to #finance-ops and finance@kalks.io when Δ > $50" })}>
              <CalendarClock /> Schedule
            </Button>
            <Button variant="surface" onClick={() => toast.success(`recon-${run.id}.pdf exported`, { description: "Signed report with per-address breakdown" })}>
              <Download /> Report
            </Button>
            <Button variant="ember" disabled={running !== null} onClick={runNow}>
              {running !== null ? <Loader2 className="animate-spin" /> : <Play />} {running !== null ? "Running…" : "Run now"}
            </Button>
          </>
        }
      />

      <Reveal>
        <Card hot={status === "mismatch"} className="relative overflow-hidden">
          <div className="flex flex-col gap-4 px-6 pt-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="k-label">{isLatest ? "Latest run" : "Historical run"}</span>
                <span className="font-mono text-[12px] text-fg-3">{run.id}</span>
                <Chip size="sm">{run.trigger}</Chip>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-[24px] font-medium tracking-tight">{run.date}{run.trigger === "Scheduled" ? " · 06:00" : ""}</h2>
                {status === "matched" && <Chip tone="up" dot>Fully matched</Chip>}
                {status === "resolved" && <Chip tone="up" dot>All mismatches resolved</Chip>}
                {status === "mismatch" && <Chip tone="down" dot>{isLatest ? open.length : run.mismatches} mismatches open</Chip>}
              </div>
              <div className="mt-1 text-[12.5px] text-fg-3">Completed in {fmtDuration(run.durationSec)} · 18,442 addresses · 41,806 ledger entries · 26,114 MT5 accounts</div>
            </div>
            <div className={cn("rounded-[16px] border px-4 py-3 text-right", Math.abs(delta) < 0.01 ? "border-up/25 bg-up-soft" : "border-down/25 bg-down-soft")}>
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Unexplained Δ</div>
              <div className={cn("k-num text-[24px] font-semibold", Math.abs(delta) < 0.01 ? "text-up" : "text-down")}>{usd(delta)}</div>
            </div>
          </div>
          {running !== null && (
            <div className="mx-6 mt-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-ember/30 bg-ember-soft px-4 py-2.5 text-[12.5px]">
              {STEPS.map((s, i) => (
                <span key={s} className={cn("inline-flex items-center gap-1.5", i < running ? "text-up" : i === running ? "text-ember" : "text-fg-3")}>
                  {i < running ? <CheckCircle2 className="size-3.5" /> : i === running ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                  {s}
                  {i < STEPS.length - 1 && <span className="ml-1 text-fg-3">›</span>}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 px-4 pb-5 pt-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
            <Total icon={<Blocks />} label="Blockchain" value={run.blockchain} sub="Hot + cold + deposit addresses" tone="text-ember" />
            <Total icon={<BookOpen />} label="Wallet ledger" value={run.ledger} sub="Client wallets + house accounts" tone="text-gold" />
            <Total icon={<CandlestickChart />} label="Trading accounts" value={run.trading} sub={`${((run.trading / run.ledger) * 100).toFixed(1)}% of ledger in MT5`} tone="text-up" />
            <Total icon={<Hourglass />} label="Pending / in-flight" value={run.pending} sub="Confirming deposits, unsent payouts" tone="text-info" />
          </div>
          <div className="mx-6 mb-5 flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 font-mono text-[12px] text-fg-2">
            <Scale className="size-4 text-fg-3" />
            Blockchain <span className="text-fg">{usd(run.blockchain, 0)}</span> = Ledger <span className="text-fg">{usd(run.ledger, 0)}</span> + Pending <span className="text-fg">{usd(run.pending, 0)}</span> + Δ <span className={Math.abs(delta) < 0.01 ? "text-up" : "text-down"}>{usd(delta)}</span>
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="min-w-0 xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Mismatches · latest run" subtitle={`${open.length} open · ${mm.length - open.length} resolved · click a row for detail`} icon={<AlertTriangle />} action={<Chip tone={open.length ? "down" : "up"}>{open.length ? `${usd(openDelta)} open` : "Clear"}</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable columns={cols} rows={mm} rowKey={(m) => m.id} dense pageSize={8} onRowClick={setDetail} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Runs" subtitle="Last 30 days · select to inspect" />
            <div className="k-fade-bottom mt-4 max-h-[430px] flex-1 space-y-1.5 overflow-y-auto px-4 pb-5 sm:px-6">
              {runs.map((r) => {
                const st = r.id === latest.id ? status : r.status;
                return (
                  <button key={r.id} type="button" onClick={() => setSelId(r.id)} className={cn("k-row flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-surface-3/60", r.id === run.id && "border-ember/40 bg-ember-soft")}>
                    <span className={cn("size-2 shrink-0 rounded-full", st === "matched" ? "bg-up" : st === "resolved" ? "bg-warn" : "bg-down")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{r.date}</span>
                      <span className="block text-[11px] text-fg-3">
                        {r.trigger} · {fmtDuration(r.durationSec)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={cn("k-num block text-[12.5px] font-medium", r.delta ? "text-down" : "text-up")}>{r.delta ? usd(r.delta) : "Δ 0.00"}</span>
                      <span className="block text-[11px] text-fg-3">{r.mismatches ? `${r.mismatches} mismatch${r.mismatches > 1 ? "es" : ""}` : "matched"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="30-day history" subtitle="In-flight balance and unexplained delta at each 06:00 run" icon={<CalendarClock />} />
          <div className="px-4 pt-4 sm:px-6">
            <div className="flex gap-[3px]">
              {chart.map((c, i) => {
                const r = runs.filter((x) => x.trigger === "Scheduled" || x.id === latest.id).slice(0, 30).reverse()[i]!;
                const st = r.id === latest.id ? status : r.status;
                return (
                  <Tooltip key={r.id} content={`${r.date} · ${st === "matched" ? "matched" : st === "resolved" ? "mismatch resolved" : "mismatch open"}`}>
                    <button type="button" onClick={() => setSelId(r.id)} className={cn("h-3 flex-1 rounded-[3px] transition-opacity hover:opacity-80", st === "matched" ? "bg-up/70" : st === "resolved" ? "bg-warn" : "bg-down")} aria-label={r.date} />
                  </Tooltip>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-fg-3">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-up/70" /> Matched</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-warn" /> Resolved</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-down" /> Open</span>
            </div>
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <ColumnChart data={chart} series={[{ label: "Pending / in-flight", tone: "fg3" }, { label: "Unexplained Δ", tone: "down" }]} height={220} labelEvery={3} format={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`)} />
          </div>
        </Card>
      </Reveal>

      <Dialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        side="right"
        title={detail?.type ?? ""}
        description={detail ? `${detail.ref} · detected by run ${latest.id}` : undefined}
        footer={
          detail?.status === "open" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => toast.success(`${detail.ref} escalated to Finance lead`, { description: "Assigned to James Carter · SLA 4h" })}>
                Escalate
              </Button>
              <Button variant="buy" size="sm" onClick={() => resolve(detail)}>
                <Check /> Resolve
              </Button>
            </>
          ) : (
            <Button size="sm" variant="surface" onClick={() => setDetail(null)}>
              Close
            </Button>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="k-row p-4">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Difference</div>
              <div className={cn("k-num mt-1 text-[26px] font-semibold", detail.amount < 0 ? "text-down" : "text-fg")}>{usd(detail.amount)}</div>
              <p className="mt-2 text-[13px] text-fg-2">{detail.detail}</p>
            </div>
            <div className="divide-y divide-line">
              <Line k="Status" v={detail.status === "open" ? <StatusChip status="pending" label="Open" /> : <StatusChip status="completed" label="Resolved" />} />
              <Line k="Source of truth" v={detail.side === "chain" ? "Blockchain" : detail.side === "ledger" ? "Wallet ledger" : "MT5 trading server"} />
              <Line k="Reference" v={detail.ref} mono />
              {detail.client && <Line k="Client" v={<PersonCell name={detail.client.person.name} photo={detail.client.person.photo} sub={detail.client.login} size={24} />} />}
              {detail.hash && <Line k="Tx hash" v={<TxHash hash={detail.hash} head={10} tail={8} />} />}
            </div>
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">Three-way view</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(["chain", "ledger", "trading"] as const).map((s) => (
                  <div key={s} className={cn("k-row px-2 py-3", s === detail.side && "border-down/40 bg-down-soft")}>
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{s === "chain" ? "Chain" : s === "ledger" ? "Ledger" : "MT5"}</div>
                    <div className="k-num mt-1 text-[13px] font-medium">{s === detail.side ? usd(Math.abs(detail.amount)) : "$0.00"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>
      {reason.node}
    </div>
  );
}

"use client";

import * as React from "react";
import { RefreshCw, RotateCcw, X } from "lucide-react";
import { Button, Card, Chip, DataTable, Money, PageHeader, Reveal, type Column } from "@ezymex/ui";
import { MiniStat } from "@/components/config/kit";
import { FilterSelect, Pager, TableSkeleton, ago, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import { P, ibSend, type CommissionsDoc, type Commission } from "./api";
import { COMM_KIND, COMM_STATUS, EmptyNote, MemberLink, PartnersError, StatusPill, int, isOptionLine, kindLabelOf, lots, optionsLabel, usd, usePerms, useReasonAction } from "./kit";

const PER = 50;
type F = { status: string; kind: string; ib: string; client: string; batch: string; from: string; to: string };
const EMPTY: F = { status: "all", kind: "all", ib: "", client: "", batch: "", from: "", to: "" };

function nextDay(d: string) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

function IdInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 pl-3.5 pr-2 text-[12.5px] text-fg-3">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 18))} inputMode="numeric" placeholder="#" aria-label={label} className="w-16 bg-transparent font-mono text-fg outline-none placeholder:text-fg-3" />
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 pl-3.5 pr-2 text-[12.5px] text-fg-3">
      {label}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="bg-transparent text-fg outline-none" />
    </label>
  );
}

export function LiveCommissions() {
  const now = useNow();
  const perms = usePerms();
  const act = useReasonAction();
  const [f, setF] = React.useState<F>(EMPTY);
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const init: Partial<F> = {};
    for (const k of Object.keys(EMPTY) as (keyof F)[]) {
      const v = u.get(k);
      if (v) init[k] = v;
    }
    if (Object.keys(init).length) setF((x) => ({ ...x, ...init }));
  }, []);
  const df = useDebounced(f, 350);
  React.useEffect(() => setPage(1), [df]);
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));

  const q = new URLSearchParams({ page: String(page), limit: String(PER) });
  if (df.status !== "all") q.set("status", df.status);
  if (df.kind !== "all") q.set("kind", df.kind);
  if (df.ib) q.set("ib", df.ib);
  if (df.client) q.set("client", df.client);
  if (df.batch) q.set("batch", df.batch);
  if (df.from) q.set("from", df.from);
  if (df.to) q.set("to", nextDay(df.to));
  const { data, error, loading, reload } = useApi<CommissionsDoc>(`${P("commissions")}?${q}`);
  const filtered = JSON.stringify(f) !== JSON.stringify(EMPTY);

  const reject = (c: Commission) =>
    act.ask({
      title: `Reject commission line #${c.id}`,
      description: `${usd(c.amount)} to ${c.beneficiary.name || `#${c.beneficiary.id}`} (${kindLabelOf(c)}). The line will not be paid. Only pending lines that are not in a batch can be rejected.`,
      confirmLabel: "Reject line",
      confirmVariant: "sell",
      run: (reason) => ibSend(`commissions/${c.id}/reject`, { reason }),
      success: `Line #${c.id} rejected`,
      onDone: reload,
    });

  const cols: Column<Commission>[] = [
    { key: "t", header: "Created", cell: (c) => <span className="whitespace-nowrap text-[12px] text-fg-2" title={when(c.createdAt)}>{ago(c.createdAt, now)}<span className="block font-mono text-[10.5px] text-fg-3">#{c.id}</span></span>, csv: (c) => c.createdAt },
    { key: "b", header: "Beneficiary", cell: (c) => <MemberLink id={c.beneficiary.id} name={c.beneficiary.name} className="max-w-40" />, csv: (c) => `${c.beneficiary.name} #${c.beneficiary.id}` },
    { key: "c", header: "Client", hideOn: "md", cell: (c) => <MemberLink id={c.client.id} name={c.client.name} sub={c.login ? `login ${c.login}` : undefined} className="max-w-40" />, csv: (c) => `${c.client.name} #${c.client.id}` },
    { key: "k", header: "Kind", cell: (c) => <span className="flex flex-col items-start gap-0.5"><Chip size="sm" tone={COMM_KIND[c.kind]?.tone}>{kindLabelOf(c)}</Chip>{c.kind !== "cpa" && c.kind !== "adjustment" && <span className="font-mono text-[10.5px] text-fg-3">Tier {c.tier}</span>}</span>, csv: (c) => `${c.kind} T${c.tier}` },
    {
      key: "d",
      header: "Deal",
      hideOn: "lg",
      cell: (c) =>
        c.dealId ? (
          isOptionLine(c) ? (
            <span className="whitespace-nowrap">
              <span className="block max-w-56 truncate text-[12.5px] font-medium" title={c.symbol ?? undefined}>{c.symbol ?? "—"}</span>
              <span className="block text-[11px] text-fg-2">{optionsLabel(c.contracts)}</span>
              <span className="block font-mono text-[10.5px] text-fg-3">#{c.dealId}</span>
            </span>
          ) : (
            <span className="whitespace-nowrap"><span className="block text-[12.5px] font-medium">{c.symbol ?? "—"} <span className="k-num font-normal text-fg-2">{lots(c.lots)}</span></span><span className="block font-mono text-[10.5px] text-fg-3">#{c.dealId}{c.symbolGroup ? ` · ${c.symbolGroup}` : ""}</span></span>
          )
        ) : (
          <span className="text-[12px] text-fg-3">—</span>
        ),
      csv: (c) => (isOptionLine(c) ? `${c.dealId ?? ""} ${c.symbol ?? ""} ${optionsLabel(c.contracts)}` : `${c.dealId ?? ""} ${c.symbol ?? ""} ${c.lots} lots`),
    },
    {
      key: "r",
      header: "Rate × share",
      align: "right",
      hideOn: "xl",
      cell: (c) => (c.kind === "cpa" || c.kind === "adjustment" || c.kind === "clawback" ? <span className="text-fg-3">—</span> : <span className="k-num whitespace-nowrap text-[12px] text-fg-2">{usd(c.rate)}{isOptionLine(c) ? "/contract" : "/lot"} × {c.sharePct}%</span>),
      csv: (c) => (c.kind === "cpa" || c.kind === "adjustment" || c.kind === "clawback" ? "" : `${c.rate}${isOptionLine(c) ? "/contract" : "/lot"} x ${c.sharePct}%`),
    },
    { key: "a", header: "Amount", align: "right", cell: (c) => <Money value={c.amount} countUp={false} className={c.amount < 0 ? "font-medium text-down" : "font-medium"} />, csv: (c) => c.amount },
    {
      key: "s",
      header: "Status",
      cell: (c) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusPill map={COMM_STATUS} status={c.status} />
          {c.batchId ? (
            <a href={`/partners/payouts?batch=${c.batchId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[10.5px] text-fg-3 hover:text-ember">
              batch #{c.batchId}
            </a>
          ) : c.status === "pending" && Date.parse(c.availableAt) > now ? (
            <span className="text-[10.5px] text-fg-3">payable {when(c.availableAt).split(",")[0]}</span>
          ) : c.note ? (
            <span className="max-w-32 truncate text-[10.5px] text-fg-3" title={c.note}>{c.note}</span>
          ) : null}
        </span>
      ),
      csv: (c) => c.status,
    },
    ...(perms.approve
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (c: Commission) =>
              c.status === "pending" && !c.batchId ? (
                <button type="button" onClick={() => reject(c)} className="grid size-7 place-items-center rounded-full border border-line text-fg-3 hover:border-down/40 hover:bg-down-soft hover:text-down" aria-label={`Reject line ${c.id}`} title="Reject line">
                  <X className="size-3.5" />
                </button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Commissions"
        subtitle="Every commission line: per-lot and per-contract (options) tiers, sub-IB splits, client rebates, CPA and clawbacks"
        actions={
          <Button variant="surface" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniStat label="Matching lines" value={data ? int(data.total) : "—"} sub={filtered ? "With the filters below" : "All lines"} />
        <MiniStat label="Total amount" value={data ? usd(data.sum) : "—"} sub="Sum of matching lines" tone="gold" />
        <MiniStat label="On this page" value={data ? usd(data.items.reduce((s, c) => s + c.amount, 0)) : "—"} sub={data ? `${int(data.items.length)} lines` : undefined} className="col-span-2 lg:col-span-1" />
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterSelect label="Status" value={f.status} onChange={(v) => set({ status: v })} options={[{ value: "all", label: "All" }, ...Object.entries(COMM_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
            <FilterSelect label="Kind" value={f.kind} onChange={(v) => set({ kind: v })} options={[{ value: "all", label: "All" }, ...Object.entries(COMM_KIND).map(([k, v]) => ({ value: k, label: v.label }))]} />
            <IdInput label="IB" value={f.ib} onChange={(v) => set({ ib: v })} />
            <IdInput label="Client" value={f.client} onChange={(v) => set({ client: v })} />
            <IdInput label="Batch" value={f.batch} onChange={(v) => set({ batch: v })} />
            <DateInput label="From" value={f.from} onChange={(v) => set({ from: v })} />
            <DateInput label="To" value={f.to} onChange={(v) => set({ to: v })} />
            {filtered && (
              <Button size="sm" variant="ghost" onClick={() => setF(EMPTY)}>
                <RotateCcw /> Reset
              </Button>
            )}
          </div>
          {error && !data ? (
            <PartnersError error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              {error && <div className="mb-3 text-[12.5px] text-down">{error.message}</div>}
              <DataTable
                columns={cols}
                rows={data.items}
                pageSize={PER}
                dense
                exportName="ib-commissions"
                rowKey={(c) => String(c.id)}
                empty={
                  <EmptyNote
                    className="mt-3"
                    title={filtered ? "No lines match these filters" : "No commission lines yet"}
                    text={filtered ? "Widen the date range or clear a filter." : "Lines are written when a referred client closes a qualifying live trade, and when a CPA is earned."}
                  />
                }
              />
              <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>
      {act.node}
    </div>
  );
}

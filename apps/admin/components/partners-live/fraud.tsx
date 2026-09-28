"use client";

import * as React from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { Button, Card, Chip, DataTable, Dialog, PageHeader, Reveal, Segmented, Skeleton, type Column } from "@kalks/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { Pager, TableSkeleton, ago, useApi, useNow, when } from "@/components/live/kit";
import { P, ibSend, type Flag, type FlagKind, type FlagsDoc } from "./api";
import { EmptyNote, FLAG_KIND, FLAG_STATUS, MemberLink, PartnersError, ReadOnlyNote, SEV_TONE, StatusPill, int, usePerms, useReasonAction, useUrlParam } from "./kit";

type Tab = "open" | "confirmed" | "dismissed" | "all";
const PER = 50;

/** One-line summary of a flag's evidence. */
export function flagDetail(f: { kind: FlagKind; details: Record<string, unknown> }) {
  const d = f.details ?? {};
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).map(String) : []);
  switch (f.kind) {
    case "self_referral_ip":
      return d.ip ? `Shared IP ${String(d.ip)}` : "Shared IP address";
    case "self_referral_device":
      return "Shared device fingerprint";
    case "self_referral_identity":
      return "Matching identity details";
    case "wash_trading": {
      const deals = arr("deals");
      const vols = arr("volumes");
      return `${d.symbol ? String(d.symbol) : "Same symbol"}${deals.length ? ` · deals ${deals.map((x) => `#${x}`).join(" / ")}` : ""}${vols.length ? ` · volume ${vols.join(" vs ")}` : ""}`;
    }
    case "short_trades":
      return `${d.short ?? "?"} of ${d.total ?? "?"} trades in 24 h held under ${d.minTradeSeconds ?? "?"}s`;
    default:
      return Object.keys(d).length ? JSON.stringify(d) : "—";
  }
}

function effectText(f: Flag, action: "dismiss" | "confirm") {
  const selfRef = f.kind.startsWith("self_referral");
  if (action === "dismiss")
    return selfRef
      ? "Marks this as a false positive. Every open self-referral flag on this client is dismissed and the block is lifted: the client's future deals earn commission again. Lines already voided stay voided."
      : "Marks this as a false positive. Nothing else changes.";
  return "Confirms abuse. All of this client's pending commission lines that are not yet in a payout batch are voided. Lines already in a batch are not touched; reject the batch if needed.";
}

export function LiveFraudFlags() {
  const now = useNow();
  const perms = usePerms();
  const act = useReasonAction();
  const [tab, setTab] = React.useState<Tab>("open");
  const [kind, setKind] = React.useState<"all" | "self" | "wash_trading" | "short_trades">("all");
  const [page, setPage] = React.useState(1);
  const [sel, setSel] = useUrlParam("flag");
  React.useEffect(() => setPage(1), [tab]);
  const { data, error, loading, reload } = useApi<FlagsDoc>(`${P("flags")}?status=${tab}&page=${page}&limit=${PER}`);
  const counts = data?.counts ?? {};
  const all = (counts.open ?? 0) + (counts.confirmed ?? 0) + (counts.dismissed ?? 0);
  const rows = (data?.items ?? []).filter((f) => kind === "all" || (kind === "self" ? f.kind.startsWith("self_referral") : f.kind === kind));
  const selId = sel && /^\d+$/.test(sel) ? Number(sel) : null;
  const flag = data?.items.find((f) => f.id === selId) ?? null;
  // a flag linked from elsewhere may not be on this tab: fetch "all" once to find it
  const { data: lookup } = useApi<FlagsDoc>(selId !== null && data && !flag ? `${P("flags")}?status=all&limit=200` : null);
  const shown = flag ?? lookup?.items.find((f) => f.id === selId) ?? null;

  const resolve = (f: Flag, action: "dismiss" | "confirm") =>
    act.ask({
      title: action === "dismiss" ? `Dismiss flag #${f.id}` : `Confirm flag #${f.id}`,
      description: `${FLAG_KIND[f.kind]?.label ?? f.kind} · client ${f.client.name || `#${f.client.id}`}${f.ib.id ? ` · IB ${f.ib.name || `#${f.ib.id}`}` : ""}`,
      body: <div className={action === "confirm" ? "rounded-[12px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px] text-fg" : "rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2"}>{effectText(f, action)}</div>,
      confirmLabel: action === "dismiss" ? "Dismiss flag" : "Confirm abuse",
      confirmVariant: action === "dismiss" ? "surface" : "sell",
      reasonLabel: "Note",
      placeholder: "What did you check? Kept in the audit log.",
      run: (note) => ibSend<{ status: string; effect: { voidedLines?: number; selfReferralCleared?: number } }>(`flags/${f.id}/resolve`, { action, note }),
      success: action === "dismiss" ? `Flag #${f.id} dismissed` : `Flag #${f.id} confirmed`,
      successDetail: (d) => (d.effect?.voidedLines !== undefined ? `${d.effect.voidedLines} pending line${d.effect.voidedLines === 1 ? "" : "s"} voided` : d.effect?.selfReferralCleared ? "Self-referral block lifted" : undefined),
      onDone: () => {
        reload();
      },
    });

  const cols: Column<Flag>[] = [
    { key: "id", header: "Flag", cell: (f) => <span><span className="block font-mono text-[12.5px]">#{f.id}</span><span className="text-[11.5px] text-fg-3" title={when(f.createdAt)}>{ago(f.createdAt, now)}</span></span>, csv: (f) => f.id },
    { key: "k", header: "Kind", cell: (f) => <span className="block max-w-56"><span className="block text-[13px] font-medium">{FLAG_KIND[f.kind]?.label ?? f.kind}</span><span className="block truncate text-[11.5px] text-fg-3">{flagDetail(f)}</span></span>, csv: (f) => f.kind },
    { key: "c", header: "Client", cell: (f) => <MemberLink id={f.client.id} name={f.client.name} className="max-w-44" />, csv: (f) => f.client.id ?? "" },
    { key: "ib", header: "IB", hideOn: "md", cell: (f) => <MemberLink id={f.ib.id} name={f.ib.name} sub={f.ib.code} className="max-w-44" />, csv: (f) => f.ib.id ?? "" },
    { key: "sv", header: "Severity", cell: (f) => <Chip size="sm" tone={SEV_TONE[f.severity]} dot>{f.severity}</Chip>, csv: (f) => f.severity },
    { key: "s", header: "Status", cell: (f) => <span className="flex flex-col items-start gap-0.5"><StatusPill map={FLAG_STATUS} status={f.status} />{f.resolvedBy && <span className="max-w-36 truncate text-[10.5px] text-fg-3">{f.resolvedBy}</span>}</span>, csv: (f) => f.status },
    ...(perms.write
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (f: Flag) =>
              f.status === "open" ? (
                <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => resolve(f, "dismiss")} className="grid size-7 place-items-center rounded-full border border-line text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Dismiss" title="Dismiss">
                    <X className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => resolve(f, "confirm")} className="grid size-7 place-items-center rounded-full border border-down/40 bg-down-soft text-down hover:bg-down/20" aria-label="Confirm abuse" title="Confirm abuse">
                    <Check className="size-3.5" />
                  </button>
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Fraud flags"
        subtitle="Self-referral, wash-trading and short-trade checks on referred clients"
        actions={
          <>
            {perms.loaded && !perms.write && <ReadOnlyNote what="resolve flags" />}
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Open" value={data ? int(counts.open ?? 0) : "—"} sub="Waiting for review" tone={counts.open ? "warn" : undefined} />
        <MiniStat label="Confirmed" value={data ? int(counts.confirmed ?? 0) : "—"} sub="Pending lines voided" />
        <MiniStat label="Dismissed" value={data ? int(counts.dismissed ?? 0) : "—"} sub="False positives" />
        <MiniStat label="All time" value={data ? int(all) : "—"} sub="Flags raised" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(
          [
            ["self", "Self-referral", "IB and client share an IP, a device or identity details. With “block”, the client earns the IB nothing until cleared."],
            ["wash_trading", "Wash trading", "Opposite trades on the same symbol and size, opened and closed close together."],
            ["short_trades", "Short trades", "Many trades held below the minimum duration within 24 hours."],
          ] as const
        ).map(([k, title, desc]) => {
          const on = kind === k;
          return (
            <button key={k} type="button" onClick={() => setKind(on ? "all" : k)} className={on ? "k-card block border-ember/50 px-5 py-4 text-left" : "k-card block px-5 py-4 text-left hover:border-fg-3/40"}>
              <div className="flex items-center gap-2 text-[14px] font-medium">
                {title}
                {on && <Chip size="sm" tone="ember">Filtered</Chip>}
              </div>
              <div className="mt-1 text-[12px] text-fg-3">{desc}</div>
            </button>
          );
        })}
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4 p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented
              size="xs"
              value={tab}
              onChange={setTab}
              options={[
                { value: "open", label: `Open ${counts.open ?? 0}` },
                { value: "confirmed", label: `Confirmed ${counts.confirmed ?? 0}` },
                { value: "dismissed", label: `Dismissed ${counts.dismissed ?? 0}` },
                { value: "all", label: "All" },
              ]}
            />
            {kind !== "all" && (
              <button type="button" onClick={() => setKind("all")} className="text-[12px] text-fg-3 hover:text-fg">
                Clear kind filter
              </button>
            )}
          </div>
          {error && !data ? (
            <PartnersError error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <DataTable
                columns={cols}
                rows={rows}
                pageSize={PER}
                dense
                rowKey={(f) => String(f.id)}
                onRowClick={(f) => setSel(String(f.id))}
                empty={
                  <EmptyNote
                    className="mt-3"
                    title={tab === "open" ? "No open flags" : `No ${tab === "all" ? "" : `${tab} `}flags`}
                    text={tab === "open" ? "Checks run on every sign-up and closed deal. New flags appear here." : undefined}
                  />
                }
              />
              <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>

      <Dialog open={selId !== null} onOpenChange={(o) => !o && setSel(null)} side="right" title={shown ? `Flag #${shown.id}` : selId !== null ? `Flag #${selId}` : ""} description={shown ? FLAG_KIND[shown.kind]?.label : undefined}
        footer={
          shown && shown.status === "open" && perms.write ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button variant="surface" size="sm" onClick={() => resolve(shown, "dismiss")}>
                <X /> Dismiss
              </Button>
              <Button variant="down-outline" size="sm" onClick={() => resolve(shown, "confirm")}>
                <Check /> Confirm abuse
              </Button>
            </div>
          ) : undefined
        }
      >
        {!shown ? (
          data && lookup ? (
            <EmptyNote title="Flag not found" />
          ) : (
            <Skeleton className="h-40 w-full" />
          )
        ) : (
          <div>
            <Section title="Summary">
              <div className="mb-3 flex flex-wrap gap-1.5">
                <StatusPill map={FLAG_STATUS} status={shown.status} />
                <Chip size="sm" tone={SEV_TONE[shown.severity]} dot>
                  {shown.severity} severity
                </Chip>
              </div>
              <div className="text-[13px] text-fg-2">{FLAG_KIND[shown.kind]?.desc}</div>
              <div className="mt-3 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[12px] text-fg-2">{flagDetail(shown)}</div>
              <div className="mt-2 text-[11.5px] text-fg-3">Raised {when(shown.createdAt)}</div>
            </Section>
            <Section title="Who">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="k-row px-3.5 py-2.5">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">Client</div>
                  <MemberLink id={shown.client.id} name={shown.client.name} />
                  {shown.client.email && <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{shown.client.email}</div>}
                </div>
                <div className="k-row px-3.5 py-2.5">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-3">IB</div>
                  {shown.ib.id ? <MemberLink id={shown.ib.id} name={shown.ib.name} sub={shown.ib.code} /> : <span className="text-[12.5px] text-fg-3">No IB</span>}
                </div>
              </div>
            </Section>
            {shown.status === "open" ? (
              <Section title="What each decision does">
                <div className="space-y-2 text-[12.5px] text-fg-2">
                  <p>
                    <b className="font-medium text-fg">Dismiss</b> — {effectText(shown, "dismiss")}
                  </p>
                  <p>
                    <b className="font-medium text-fg">Confirm</b> — {effectText(shown, "confirm")}
                  </p>
                </div>
              </Section>
            ) : (
              <Section title="Decision">
                <div className="text-[12.5px] text-fg-2">{shown.note || "No note"}</div>
                <div className="mt-1 text-[11.5px] text-fg-3">
                  {shown.resolvedBy ?? "—"} · {when(shown.resolvedAt)}
                </div>
              </Section>
            )}
          </div>
        )}
      </Dialog>
      {act.node}
    </div>
  );
}

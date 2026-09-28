"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, KeyValue, KpiCard, PageHeader, Reveal, Tabs, Toggle, type Column } from "@kalks/ui";
import { FilterSelect, TableSkeleton, ago, qs, useApi, useNow, when } from "@/components/live/kit";
import { FilterPills } from "@/components/prop/rules";
import { ChallengeDrawer } from "./challenge-drawer";
import { JsonView, PropError, PropStatus, ReadOnlyNote, SeverityChip, TraderCell, int, propWrite, ruleLabel, usd, useAction, useClientNames, usePropCan, type Flag, type Overview, type RuleEvent } from "./kit";

type Tab = "breaches" | "flags";

export function LiveViolationsPage() {
  const [tab, setTab] = React.useState<Tab>("breaches");
  const ov = useApi<Overview>("/api/prop/overview", { refreshMs: 15_000 });
  const [sel, setSel] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const openChallenge = (id: number | undefined) => {
    if (!id) return;
    setSel(id);
    setOpen(true);
  };
  return (
    <div className="pb-24">
      <PageHeader title="Violations" subtitle="Rule breaches from the evaluator and banned-strategy flags waiting for review." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Breaches · 24h" icon={<XCircle />} value={<span className="k-num">{int(ov.data?.breaches24h)}</span>} chip="Accounts failed by a hard rule" chipTone={(ov.data?.breaches24h ?? 0) > 0 ? "down" : "neutral"} />
        <KpiCard label="Open strategy flags" icon={<ShieldAlert />} value={<span className="k-num">{int(ov.data?.flagsOpen)}</span>} chip="Waiting for review" chipTone={(ov.data?.flagsOpen ?? 0) > 0 ? "warn" : "neutral"} delay={0.04} />
        <KpiCard label="Top breach reason · 30d" icon={<AlertTriangle />} value={<span className="text-[22px]">{ov.data?.breachReasons[0] ? ruleLabel(ov.data.breachReasons[0].rule) : "—"}</span>} chip={ov.data?.breachReasons[0] ? `${ov.data.breachReasons[0].count} accounts` : "No breaches"} delay={0.08} />
      </div>
      <Reveal delay={0.08} className="mt-4">
        <Card>
          <div className="px-4 pt-5 sm:px-6">
            <Tabs value={tab} onChange={setTab} tabs={[{ value: "breaches", label: "Breaches log" }, { value: "flags", label: "Banned-strategy review", count: ov.data?.flagsOpen }]} />
          </div>
          <div className="px-4 pb-6 pt-4 sm:px-6">{tab === "breaches" ? <BreachesLog onOpen={openChallenge} /> : <FlagReview onOpen={openChallenge} />}</div>
        </Card>
      </Reveal>
      <ChallengeDrawer id={sel} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const RULES = ["daily_loss", "max_drawdown", "time_limit", "weekend_holding", "news_window", "banned_strategy", "profit_target", "manual"];

function BreachesLog({ onOpen }: { onOpen: (id: number | undefined) => void }) {
  const now = useNow();
  const [severity, setSeverity] = React.useState("all");
  const [rule, setRule] = React.useState("all");
  const { data, error, reload } = useApi<{ events: RuleEvent[] }>(`/api/prop/events${qs({ severity, rule, limit: 300 })}`, { refreshMs: 10_000 });
  const rows = data?.events ?? [];
  const names = useClientNames(rows.map((e) => e.userId));
  const columns: Column<RuleEvent>[] = [
    { key: "at", header: "Time", sort: (e) => Date.parse(e.at), csv: (e) => e.at, cell: (e) => <span className="whitespace-nowrap text-[12px] text-fg-2" title={when(e.at, true)}>{ago(e.at, now)}<span className="block text-[11px] text-fg-3">{when(e.at)}</span></span> },
    { key: "sev", header: "Severity", sort: (e) => e.severity, csv: (e) => e.severity, cell: (e) => <SeverityChip severity={e.severity} /> },
    { key: "rule", header: "Rule", sort: (e) => e.rule, csv: (e) => e.rule, cell: (e) => <span className="text-[13px] font-medium">{ruleLabel(e.rule)}</span> },
    { key: "trader", header: "Trader", csv: (e) => e.traderName ?? "", cell: (e) => (e.userId ? <TraderCell name={e.traderName} userId={e.userId} names={names} /> : <span className="text-fg-3">—</span>) },
    { key: "acc", header: "Account", hideOn: "md", csv: (e) => `${e.login}`, cell: (e) => <span className="text-[12.5px]"><span className="font-mono">{e.login}</span><span className="block text-[11px] text-fg-3">{e.planName ?? ""}{e.phase ? ` · ${e.phase}` : ""}{e.size ? ` · ${usd(e.size, 0)}` : ""}</span></span> },
    { key: "eq", header: "Equity", align: "right", hideOn: "lg", csv: (e) => e.equity ?? "", cell: (e) => <span className="k-num text-[12.5px]">{usd(e.equity)}{e.threshold !== null && <span className="block text-[11px] text-fg-3">limit {usd(e.threshold)}</span>}</span> },
    { key: "msg", header: "Message", csv: (e) => e.message, cell: (e) => <span className="block max-w-[360px] text-[12.5px] text-fg-2">{e.message}</span> },
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterPills
          value={severity}
          onChange={setSeverity}
          options={[
            { value: "all", label: "All" },
            { value: "breach", label: "Breaches" },
            { value: "violation", label: "Violations" },
            { value: "warning", label: "Warnings" },
            { value: "info", label: "Info" },
          ]}
        />
        <FilterSelect label="Rule" value={rule} onChange={setRule} options={[{ value: "all", label: "All rules" }, ...RULES.map((r) => ({ value: r, label: ruleLabel(r) }))]} />
      </div>
      {error && !data ? (
        <PropError error={error} onRetry={reload} />
      ) : !data ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          pageSize={25}
          dense
          rowKey={(e) => String(e.id)}
          exportName="prop-rule-events"
          search={(e) => `${e.login} ${e.traderName ?? ""} ${e.message} ${e.planName ?? ""}`}
          searchPlaceholder="Login, trader, message"
          onRowClick={(e) => onOpen(e.challengeId)}
          empty={<div className="py-10 text-center text-[13px] text-fg-3">No rule events match these filters.</div>}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function FlagReview({ onOpen }: { onOpen: (id: number | undefined) => void }) {
  const now = useNow();
  const canWrite = usePropCan("prop.write");
  const [status, setStatus] = React.useState<"open" | "cleared" | "confirmed" | "all">("open");
  const { data, error, reload } = useApi<{ flags: Flag[] }>(`/api/prop/flags${qs({ status })}`, { refreshMs: 10_000 });
  const rows = data?.flags ?? [];
  const names = useClientNames(rows.map((f) => f.userId));
  const [sel, setSel] = React.useState<Flag | null>(null);
  const act = useAction();
  const failRef = React.useRef(false);

  const review = (f: Flag, decision: "clear" | "confirm") => {
    failRef.current = false;
    act.ask({
      title: decision === "clear" ? `Clear flag #${f.id}` : `Confirm flag #${f.id}`,
      description: decision === "clear" ? "The flag is closed as a false positive. Nothing changes on the account." : "The banned strategy is confirmed and recorded on the challenge. Optionally fail the account now.",
      note: "required",
      noteLabel: "Review note",
      notePlaceholder: "What the evidence shows",
      confirmLabel: decision === "clear" ? "Clear flag" : "Confirm flag",
      confirmVariant: decision === "clear" ? "buy" : "sell",
      body: decision === "confirm" ? <FailToggle valueRef={failRef} /> : undefined,
      run: (v) => propWrite(`flags/${f.id}/review`, { decision, note: v.note, ...(decision === "confirm" ? { failAccount: failRef.current } : {}) }),
      success: decision === "clear" ? `Flag #${f.id} cleared` : `Flag #${f.id} confirmed`,
      onDone: () => {
        setSel(null);
        reload();
      },
    });
  };

  const columns: Column<Flag>[] = [
    { key: "at", header: "Raised", sort: (f) => Date.parse(f.createdAt), csv: (f) => f.createdAt, cell: (f) => <span className="whitespace-nowrap text-[12px] text-fg-2" title={when(f.createdAt)}>{ago(f.createdAt, now)}</span> },
    { key: "kind", header: "Strategy", sort: (f) => f.kind, csv: (f) => f.kind, cell: (f) => <span className="text-[13px] font-medium">{ruleLabel(f.kind)}<span className="block max-w-[320px] truncate text-[11.5px] font-normal text-fg-3">{f.summary}</span></span> },
    { key: "trader", header: "Trader", csv: (f) => f.traderName ?? "", cell: (f) => <TraderCell name={f.traderName} userId={f.userId} names={names} /> },
    { key: "acc", header: "Account", hideOn: "md", csv: (f) => f.login, cell: (f) => <span className="text-[12.5px]"><span className="font-mono">{f.login}</span>{f.relatedLogin && <span className="font-mono text-fg-3"> ↔ {f.relatedLogin}</span>}<span className="block text-[11px] text-fg-3">{f.planName ?? ""}{f.phase ? ` · ${f.phase}` : ""}</span></span> },
    { key: "score", header: "Score", align: "right", hideOn: "lg", sort: (f) => f.score ?? 0, csv: (f) => f.score ?? "", cell: (f) => <span className="k-num text-[12.5px]">{f.score === null ? "—" : f.score.toFixed(2)}</span> },
    { key: "status", header: "Status", sort: (f) => f.status, csv: (f) => f.status, cell: (f) => <span className="flex flex-col items-start gap-0.5"><PropStatus status={f.status} />{f.reviewedBy && <span className="text-[10.5px] text-fg-3">{f.reviewedBy}</span>}</span> },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterPills value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "confirmed", label: "Confirmed" }, { value: "cleared", label: "Cleared" }, { value: "all", label: "All" }]} />
        {!canWrite && <ReadOnlyNote what="review flags" />}
      </div>
      {error && !data ? (
        <PropError error={error} onRetry={reload} />
      ) : !data ? (
        <TableSkeleton />
      ) : (
        <DataTable columns={columns} rows={rows} pageSize={25} dense rowKey={(f) => String(f.id)} exportName="prop-strategy-flags" onRowClick={setSel} empty={<div className="py-10 text-center text-[13px] text-fg-3">No flags here.</div>} />
      )}

      <Dialog
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        side="right"
        title={sel ? `${ruleLabel(sel.kind)} · flag #${sel.id}` : ""}
        description={sel ? `Raised ${when(sel.createdAt)} on account ${sel.login}` : undefined}
        footer={
          sel ? (
            <>
              <Button size="sm" variant="ghost" className="mr-auto" onClick={() => onOpen(sel.challengeId)}>
                Open challenge
              </Button>
              {canWrite && sel.status === "open" && (
                <>
                  <Button size="sm" variant="up-outline" onClick={() => review(sel, "clear")}>
                    <CheckCircle2 /> Clear
                  </Button>
                  <Button size="sm" variant="down-outline" onClick={() => review(sel, "confirm")}>
                    <XCircle /> Confirm
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {sel && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <TraderCell name={sel.traderName} userId={sel.userId} names={names} />
              <PropStatus status={sel.status} />
            </div>
            <div className="rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-fg">{sel.summary}</div>
            <KeyValue
              rows={[
                ["Account", <span key="l" className="font-mono">{sel.login}</span>],
                ["Related account", sel.relatedLogin ? <span key="r" className="font-mono">{sel.relatedLogin}</span> : "—"],
                ["Plan", `${sel.planName ?? "—"}${sel.phase ? ` · ${sel.phase}` : ""}`],
                ["Account status", sel.accountStatus ? <PropStatus key="s" status={sel.accountStatus} /> : "—"],
                ["Score", sel.score === null ? "—" : sel.score.toFixed(2)],
                ["Challenge", `#${sel.challengeId}`],
              ]}
            />
            <div>
              <div className="k-label mb-2">Evidence</div>
              <div className="k-row px-4 py-3">
                <JsonView value={sel.evidence} />
              </div>
            </div>
            {sel.reviewedBy && (
              <div>
                <div className="k-label mb-2">Review</div>
                <div className="k-row px-4 py-3 text-[12.5px]">
                  <div className="text-fg-2">
                    {sel.reviewedBy} · {when(sel.reviewedAt)}
                  </div>
                  {sel.reviewNote && <div className="mt-1 text-fg">{sel.reviewNote}</div>}
                </div>
              </div>
            )}
            {sel.status === "open" && (
              <Chip tone="neutral">Detected by the heuristic; a reviewer decides whether it is a breach.</Chip>
            )}
          </div>
        )}
      </Dialog>
      {act.node}
    </>
  );
}

function FailToggle({ valueRef }: { valueRef: React.MutableRefObject<boolean> }) {
  const [v, setV] = React.useState(valueRef.current);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2.5">
      <span className="text-[13px] text-fg">
        Fail the account
        <span className="block text-[11.5px] text-fg-3">Closes every position and disables the account; the challenge fails.</span>
      </span>
      <Toggle
        checked={v}
        onChange={(n) => {
          setV(n);
          valueRef.current = n;
        }}
        label="Fail the account"
      />
    </div>
  );
}

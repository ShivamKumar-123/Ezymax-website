"use client";

import * as React from "react";
import { Download, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Chip, DataTable, Dialog, PageHeader, Progress, Reveal, Segmented, Skeleton, type Column } from "@ezymex/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { FilterSelect, Pager, TableSkeleton, ago, day, downloadCsv, qs, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import { S, stakingGet, type PlansDoc, type Position, type PositionDetail, type PositionReturn, type PositionStatus, type PositionsDoc } from "./api";
import { Amount, ClientLink, EmptyNote, Note, POSITION_STATUS, StakingError, StatusPill, amt, money, int, monthName, pct, statusLabel, usePerms, useUrlParam } from "./kit";

type Tab = "all" | PositionStatus;
const TABS: Tab[] = ["all", "active", "pending_payment", "payment_failed", "matured"];
const PER = 25;

const RETURN_STATUS: Record<PositionReturn["status"], { label: string; tone: "up" | "warn" | "info" }> = {
  paid: { label: "Paid", tone: "up" },
  pending: { label: "Awaiting approval", tone: "warn" },
  processing: { label: "Processing", tone: "info" },
};

/** One-line state under the status pill. */
function stateText(p: Position, now: number) {
  if (p.status === "payment_failed") return p.failureReason || "The wallet refused the debit";
  if (p.status === "pending_payment") return "Waiting for the wallet to confirm the debit";
  if (p.status === "matured") return p.maturedAt ? `Principal returned ${ago(p.maturedAt, now)}` : "Principal returned";
  if (p.redeem) return `Principal return retrying · attempt ${p.redeem.attempts}${p.redeem.nextAttemptAt ? `, next ${ago(p.redeem.nextAttemptAt, now)}` : ""}`;
  if (p.maturesAt && Date.parse(p.maturesAt) <= now) return "Matured: principal return queued";
  return p.maturesAt ? `Matures ${day(p.maturesAt)}` : "";
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                        */
/* ------------------------------------------------------------------ */

function PositionDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const now = useNow();
  const { data, error, reload } = useApi<PositionDetail>(id !== null ? S(`positions/${id}`) : null, { refreshMs: 60_000 });
  const d = data && data.position.id === id ? data : null;
  const p = d?.position;
  const t = d?.terms ?? null;
  const progress = p && p.daysTotal > 0 ? (p.daysElapsed / p.daysTotal) * 100 : 0;

  const cols: Column<PositionReturn>[] = [
    { key: "m", header: "Month", cell: (r) => <span className="text-[12.5px] font-medium">{monthName(r.period, "short")}</span>, csv: (r) => r.period },
    { key: "r", header: "Rate", align: "right", cell: (r) => <span className="k-num text-[12.5px]">{pct(r.ratePct)}</span>, csv: (r) => r.ratePct },
    { key: "d", header: "Days", align: "right", cell: (r) => <span className="k-num text-[12px] text-fg-2">{r.daysActive}/{r.daysInMonth}</span>, csv: (r) => `${r.daysActive}/${r.daysInMonth}` },
    { key: "a", header: "Return", align: "right", cell: (r) => <Amount value={r.amount} currency={p?.currency} className="text-[12.5px] font-medium" />, csv: (r) => r.amount },
    {
      key: "s",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <Chip size="sm" dot tone={RETURN_STATUS[r.status]?.tone ?? "neutral"}>
            {RETURN_STATUS[r.status]?.label ?? r.status}
          </Chip>
          {r.paidAt && <span className="text-[10.5px] text-fg-3">{day(r.paidAt)}</span>}
        </span>
      ),
      csv: (r) => r.status,
    },
  ];

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={p ? `Position #${p.id}` : id !== null ? `Position #${id}` : ""}
      description={p ? `${p.userName || `Client #${p.userId}`} · ${p.planName} v${p.planVersion}` : undefined}
    >
      {error && !d ? (
        <StakingError error={error} onRetry={reload} />
      ) : !d || !p ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div>
          <Section title="Position" action={<StatusPill map={POSITION_STATUS} status={p.status} />}>
            <div className="mb-3">
              <ClientLink id={p.userId} name={p.userName} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Principal" value={money(p.principal, p.currency)} tone="gold" />
              <MiniStat label="Returns paid" value={money(p.returnsPaid, p.currency)} sub={p.lastReturn ? `${monthName(p.lastReturn.period, "short")}: ${pct(p.lastReturn.ratePct)}` : "None yet"} tone={p.returnsPaid > 0 ? "up" : undefined} />
              <MiniStat label="Started" value={p.startedAt ? day(p.startedAt) : "—"} sub={p.startedAt ? when(p.startedAt) : "Not paid yet"} />
              <MiniStat label={p.status === "matured" ? "Matured" : "Matures"} value={p.maturedAt ? day(p.maturedAt) : p.maturesAt ? day(p.maturesAt) : "—"} sub={`${p.termMonths}-month term`} />
            </div>
            {p.daysTotal > 0 && (
              <div className="mt-3">
                <Progress value={progress} tone={p.status === "matured" ? "up" : "gold"} />
                <div className="k-num mt-1 flex justify-between text-[11px] text-fg-3">
                  <span>
                    Day {int(Math.min(p.daysElapsed, p.daysTotal))} of {int(p.daysTotal)}
                  </span>
                  <span>{p.status === "matured" ? "Complete" : `${int(Math.max(0, p.daysTotal - p.daysElapsed))} days left`}</span>
                </div>
              </div>
            )}
            {p.status === "payment_failed" && (
              <Note tone="down" className="mt-3">
                The wallet refused the debit{p.failureReason ? `: ${p.failureReason}` : "."} Nothing was taken from the client.
              </Note>
            )}
            {p.status === "pending_payment" && (
              <Note tone="warn" className="mt-3">
                The wallet hasn&apos;t confirmed the debit yet. The reconciler retries with the same key, so the principal is never taken twice.
              </Note>
            )}
            {p.redeem && (
              <Note tone="warn" className="mt-3">
                Returning the principal: attempt {p.redeem.attempts}
                {p.redeem.nextAttemptAt ? `, next ${ago(p.redeem.nextAttemptAt, now)}` : ""}.{p.redeem.error ? ` Last error: ${p.redeem.error}` : ""}
              </Note>
            )}
          </Section>

          <Section title="Monthly returns">
            <DataTable columns={cols} rows={d.returns} pageSize={12} dense rowKey={(r) => r.period} empty={<EmptyNote title="No returns yet" text="A return is added when a month this position earned in is settled." />} />
          </Section>

          <Section title="Accepted terms" hint={`Plan version ${t?.version ?? p.planVersion}, as the client accepted it. Later plan edits don't change it.`}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Plan" value={t?.name ?? p.planName} sub={`${t?.termMonths ?? p.termMonths} months · ${t?.currency ?? p.currency}`} />
                <MiniStat label="Limits" value={t?.minAmount !== undefined ? `From ${amt(t.minAmount, t.currency ?? p.currency)}` : "—"} sub={t?.maxAmount ? `Up to ${amt(t.maxAmount, t.currency ?? p.currency)}` : "No maximum"} />
              </div>
              <div className="k-row space-y-1.5 px-3.5 py-2.5 text-[12px]">
                <div className="flex items-center gap-2 text-fg-2">
                  <ShieldCheck className="size-3.5 text-up" /> Terms accepted {when(p.termsAcceptedAt)}
                </div>
                <div className="flex items-center gap-2 text-fg-2">
                  <ShieldCheck className="size-3.5 text-up" /> Risk acknowledged {when(p.riskAcknowledgedAt)}
                </div>
              </div>
              {t?.description && (
                <div>
                  <div className="k-label mb-1.5">Description</div>
                  <p className="whitespace-pre-wrap rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">{t.description}</p>
                </div>
              )}
              <div>
                <div className="k-label mb-1.5">Risk disclosure</div>
                <p className="whitespace-pre-wrap rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">{t?.riskText || "—"}</p>
              </div>
            </div>
          </Section>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveStakingPositions() {
  const now = useNow();
  const perms = usePerms();
  const [statusParam, setStatusParam] = useUrlParam("status");
  const [planParam, setPlanParam] = useUrlParam("plan");
  const [userParam, setUserParam] = useUrlParam("user");
  const [sel, setSel] = useUrlParam("position");
  const [text, setText] = React.useState("");
  const q = useDebounced(text.trim(), 350);
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);
  const tab: Tab = (TABS as string[]).includes(statusParam ?? "") ? (statusParam as Tab) : "all";
  const plan = planParam && /^\d+$/.test(planParam) ? planParam : "all";
  const user = userParam && /^\d+$/.test(userParam) ? userParam : null;
  const filters = { status: tab, plan, user, q };
  React.useEffect(() => setPage(1), [tab, plan, user, q]);

  const { data, error, loading, reload } = useApi<PositionsDoc>(`${S("positions")}${qs({ ...filters, page, limit: PER })}`, { refreshMs: 60_000 });
  const { data: plansDoc } = useApi<PlansDoc>(S("plans"));
  const plans = plansDoc?.plans ?? [];
  const selId = sel && /^\d+$/.test(sel) ? Number(sel) : null;
  const cur = plansDoc?.currencies[0] ?? "USDT";

  const exportCsv = async () => {
    setExporting(true);
    const r = await stakingGet<{ items: Position[] }>(`positions/export${qs(filters)}`);
    setExporting(false);
    if (!r.ok) {
      toast.error("Export failed", { description: r.error.message });
      return;
    }
    const rows = r.data.items;
    if (!rows.length) {
      toast.info("Nothing to export", { description: "No position matches these filters." });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `staking-positions-${stamp}`,
      ["Position", "Client ID", "Client", "Plan ID", "Plan", "Plan version", "Currency", "Term (months)", "Principal", "Status", "Started", "Matures", "Matured", "Returns paid", "Days elapsed", "Days total", "Failure reason", "Terms accepted", "Risk acknowledged", "Created"],
      rows.map((p) => [
        p.id,
        p.userId,
        p.userName,
        p.planId,
        p.planName,
        p.planVersion,
        p.currency,
        p.termMonths,
        p.principal.toFixed(2),
        statusLabel(POSITION_STATUS, p.status),
        p.startedAt ?? "",
        p.maturesAt ?? "",
        p.maturedAt ?? "",
        p.returnsPaid.toFixed(2),
        p.daysElapsed,
        p.daysTotal,
        p.failureReason ?? "",
        p.termsAcceptedAt,
        p.riskAcknowledgedAt,
        p.createdAt,
      ]),
    );
  };

  const cols: Column<Position>[] = [
    {
      key: "id",
      header: "Position",
      cell: (p) => (
        <span className="whitespace-nowrap">
          <span className="block font-mono text-[12.5px]">#{p.id}</span>
          <span className="text-[10.5px] text-fg-3" title={when(p.createdAt)}>
            {ago(p.createdAt, now)}
          </span>
        </span>
      ),
    },
    { key: "c", header: "Client", cell: (p) => <ClientLink id={p.userId} name={p.userName} className="max-w-44" /> },
    {
      key: "p",
      header: "Plan",
      hideOn: "md",
      cell: (p) => (
        <span className="block max-w-44">
          <span className="block truncate text-[12.5px]">{p.planName}</span>
          <span className="block text-[10.5px] text-fg-3">
            v{p.planVersion} · {p.termMonths} months
          </span>
        </span>
      ),
    },
    { key: "pr", header: "Principal", align: "right", cell: (p) => <Amount value={p.principal} currency={p.currency} className="text-[13px] font-medium" /> },
    {
      key: "t",
      header: "Term",
      hideOn: "lg",
      cell: (p) =>
        p.daysTotal > 0 ? (
          <span className="block w-32">
            <Progress value={(p.daysElapsed / p.daysTotal) * 100} tone={p.status === "matured" ? "up" : "gold"} />
            <span className="k-num mt-1 block text-[10.5px] text-fg-3">
              {p.status === "matured" ? "Complete" : `${int(Math.max(0, p.daysTotal - p.daysElapsed))} days left`}
            </span>
          </span>
        ) : (
          <span className="text-[12px] text-fg-3">—</span>
        ),
    },
    {
      key: "r",
      header: "Returns",
      align: "right",
      hideOn: "sm",
      cell: (p) => (
        <span className="block">
          <Amount value={p.returnsPaid} currency={p.currency} className="text-[12.5px]" />
          <span className="block text-[10.5px] text-fg-3">{p.lastReturn ? `${monthName(p.lastReturn.period, "short")} · ${pct(p.lastReturn.ratePct)}` : "None yet"}</span>
        </span>
      ),
    },
    {
      key: "s",
      header: "Status",
      cell: (p) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusPill map={POSITION_STATUS} status={p.status} />
          <span className={p.status === "payment_failed" || p.redeem ? "max-w-48 truncate text-[10.5px] text-warn" : "max-w-48 truncate text-[10.5px] text-fg-3"} title={stateText(p, now)}>
            {stateText(p, now)}
          </span>
        </span>
      ),
    },
  ];

  const planName = plan !== "all" ? (plans.find((p) => String(p.id) === plan)?.name ?? `Plan #${plan}`) : null;

  return (
    <div className="pb-16">
      <PageHeader
        title="Staking positions"
        subtitle="Every client subscription: principal, term, returns paid and the terms the client accepted. There is no early withdrawal."
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {perms.export && (
              <Button variant="surface" onClick={exportCsv} disabled={exporting}>
                <Download /> {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Positions" value={data ? int(data.total) : "—"} sub={tab === "all" ? "Matching the filters" : statusLabel(POSITION_STATUS, tab)} />
        <MiniStat label="Principal" value={data ? money(data.principal, cur) : "—"} sub="Sum of the matching positions" tone="gold" />
        <MiniStat label="Plan" value={planName ?? "All plans"} sub={plans.length ? `${int(plans.length)} plan${plans.length === 1 ? "" : "s"}` : undefined} />
        <MiniStat label="Client" value={user ? `#${user}` : "All clients"} sub={user ? "Filtered by client" : "Search by name or id"} />
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4 p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="max-w-full overflow-x-auto">
              <Segmented
                size="xs"
                value={tab}
                onChange={(v) => setStatusParam(v === "all" ? null : v)}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "pending_payment", label: "Payment pending" },
                  { value: "payment_failed", label: "Payment failed" },
                  { value: "matured", label: "Matured" },
                ]}
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <FilterSelect label="Plan" value={plan} onChange={(v) => setPlanParam(v === "all" ? null : v)} options={[{ value: "all", label: "All plans" }, ...plans.map((p) => ({ value: String(p.id), label: p.name }))]} />
              {user && (
                <button type="button" onClick={() => setUserParam(null)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ember/30 bg-ember-soft px-3 text-[12.5px] text-ember">
                  Client #{user} <X className="size-3.5" />
                </button>
              )}
              <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
                <Search className="size-3.5 text-fg-3" />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Client name, client or position id" aria-label="Search positions" className="w-44 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-56" />
              </div>
            </div>
          </div>
          {error && !data ? (
            <StakingError error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <DataTable
                columns={cols}
                rows={data.items}
                pageSize={PER}
                dense
                rowKey={(p) => String(p.id)}
                onRowClick={(p) => setSel(String(p.id))}
                empty={<EmptyNote className="mt-3" title={tab === "all" && plan === "all" && !q && !user ? "No positions yet" : "No positions match"} text={tab === "all" && plan === "all" && !q && !user ? "Positions appear here when clients subscribe to a plan on sale in the Client Area." : "Try another status, plan or search."} />}
              />
              <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>

      <PositionDrawer id={selId} onClose={() => setSel(null)} />
    </div>
  );
}

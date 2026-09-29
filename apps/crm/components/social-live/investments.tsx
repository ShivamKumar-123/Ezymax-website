"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, CalendarClock, Compass, FileText, Landmark, Loader2, Lock, Plus, Repeat, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CHART_COLORS,
  DataTable,
  Dialog,
  Donut,
  EmptyState,
  Field,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Segmented,
  Toggle,
  cn,
  type Column,
} from "@kalks/ui";
import { RangeSlider } from "@/components/social/controls";
import { fmtDate, serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, nav4, pct, socialApi, units4, usd, useSocial, type FundView, type InvestmentView, type RequestView, type Statement } from "./api";
import { BlockSkeleton, InfoBox, SocialError, Tile, useNumber } from "./bits";
import { FundDetailDrawer, FundStatusChip } from "./funds";
import { InvestDialog } from "./invest-dialog";

const REQ_TONE: Record<RequestView["status"], "warn" | "up" | "down" | "neutral"> = { pending: "warn", done: "up", rejected: "down", cancelled: "neutral" };
const KIND_LABEL: Record<string, string> = { seed: "Seed", invest: "Invest", redeem: "Redeem", fee: "Performance fee", stop_loss: "Stop-loss redeem" };

const isLocked = (iso: string | null) => !!iso && Date.parse(iso) > Date.now();

function requestText(r: RequestView) {
  if (r.kind === "invest") return usd(r.amount ?? 0);
  if (r.all) return "All units";
  if (r.units !== null && r.units !== undefined) return `${units4(r.units)} units`;
  return usd(r.amount ?? 0);
}

function useCancel(onDone: () => void) {
  const [busy, setBusy] = React.useState<number | null>(null);
  const cancel = async (r: RequestView) => {
    setBusy(r.id);
    try {
      await socialApi(`requests/${r.id}/cancel`, { body: {} });
      toast.success("Request cancelled", { description: r.kind === "invest" ? `${usd(r.amount ?? 0)} goes back to your wallet` : "Your units stay invested" });
      onDone();
    } catch (e) {
      toast.error("Couldn't cancel the request", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  return { busy, cancel };
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function RedeemDialog({ inv, onClose, onDone }: { inv: InvestmentView | null; onClose: () => void; onDone: () => void }) {
  const [by, setBy] = React.useState<"all" | "amount" | "units">("amount");
  const val = useNumber(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setBy("amount");
    val.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.fundId]);
  if (!inv) return null;
  const f = inv.fund;
  const v = val.value ?? 0;
  const units = by === "all" ? inv.units : by === "units" ? v : f.nav > 0 ? v / f.nav : 0;
  const err = by === "all" ? undefined : !(v > 0) ? "Enter a value" : units > inv.units + 1e-8 ? "More than you hold" : undefined;
  const locked = isLocked(inv.lockedUntil);

  const submit = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      await socialApi(`funds/${f.id}/redeem`, { body: by === "all" ? { all: true } : by === "units" ? { units: v } : { amount: v } });
      toast.success("Redemption queued", { description: `Executes at the rollover on ${serverTime(f.nextRolloverAt)} (server time); the payout goes to your wallet.` });
      onDone();
      onClose();
    } catch (e) {
      toast.error("Couldn't queue the redemption", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!inv}
      onOpenChange={(o) => !o && onClose()}
      width={520}
      title={`Redeem from ${f.name}`}
      description="Redemptions are queued and paid at the next rollover NAV."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={submit} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} Queue redemption
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Units held">{units4(inv.units)}</Tile>
          <Tile label="NAV / unit">{nav4(f.nav)}</Tile>
          <Tile label="Value">{usd(inv.value)}</Tile>
        </div>
        {locked && (
          <InfoBox tone="warn" icon={<Lock />}>
            Your investment is in its lock-in period until <b className="text-fg">{fmtDate(inv.lockedUntil)}</b>. A redemption before then may be refused.
          </InfoBox>
        )}
        <Segmented
          size="xs"
          value={by}
          onChange={(x) => {
            setBy(x);
            val.set(null);
          }}
          options={[
            { value: "amount", label: "By amount" },
            { value: "units", label: "By units" },
            { value: "all", label: "Everything" },
          ]}
        />
        {by !== "all" && (
          <Field label={by === "amount" ? "Amount (USD)" : "Units"} error={val.raw ? err : undefined}>
            <Input type="number" inputMode="decimal" min={0} value={val.raw} onChange={(e) => val.setRaw(e.target.value)} leading={by === "amount" ? "$" : undefined} trailing={by === "amount" ? "USD" : "units"} inputClassName="k-num" />
          </Field>
        )}
        <div className="rounded-[14px] border border-gold/25 bg-gold-soft px-4 py-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-fg-2">Units to redeem</span>
            <span className="k-num font-medium">{units4(Math.min(units, inv.units))}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-fg-2">Estimated payout at today&apos;s NAV</span>
            <span className="k-num font-semibold">{usd(Math.min(units, inv.units) * f.nav)}</span>
          </div>
          <div className="mt-2 text-[11.5px] text-fg-3">
            Executes {serverTime(f.nextRolloverAt)} (server time) at the NAV fixed then. Any performance fee above your high-water mark is settled first.
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function StopLossDialog({ inv, onClose, onDone }: { inv: InvestmentView | null; onClose: () => void; onDone: () => void }) {
  const [on, setOn] = React.useState(false);
  const [sl, setSl] = React.useState(20);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!inv) return;
    setOn(inv.stopLossPct !== null);
    setSl(inv.stopLossPct ?? 20);
  }, [inv]);
  if (!inv) return null;
  const save = async () => {
    setBusy(true);
    try {
      await socialApi(`investments/${inv.fundId}`, { method: "PATCH", body: { stopLossPct: on ? sl : null } });
      toast.success(on ? `Stop-loss set at -${sl}%` : "Stop-loss removed");
      onDone();
      onClose();
    } catch (e) {
      toast.error("Couldn't update the stop-loss", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!inv}
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title="Investor stop-loss"
      description={inv.fund.name}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-fg-2">Redeem me at once if my value falls this far below my net investment ({usd(inv.netInvested)})</div>
          <Toggle checked={on} onChange={setOn} label="Stop-loss" />
        </div>
        <div className={cn(!on && "pointer-events-none opacity-40")}>
          <div className="mb-1 flex justify-between text-[12.5px]">
            <span className="text-fg-3">Trigger</span>
            <span className="k-num font-medium text-down">
              -{sl}% · at {usd(inv.netInvested * (1 - sl / 100), 0)}
            </span>
          </div>
          <RangeSlider value={sl} onChange={setSl} min={5} max={90} tone="down" ticks={[5, 10, 20, 50, 90]} format={(v) => `${v}%`} label="Stop-loss" />
        </div>
        <InfoBox>The redemption runs at the current NAV, subject to the fund&apos;s free margin. Performance fee rules apply.</InfoBox>
      </div>
    </Dialog>
  );
}

function StatementDialog({ fund, onClose }: { fund: FundView | null; onClose: () => void }) {
  const { data, error } = useSocial<Statement>(fund ? `funds/${fund.id}/statement` : null);
  type Item = Statement["items"][number];
  const cols: Column<Item>[] = [
    { key: "at", header: "Time", cell: (i) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(i.at)}</span>, sort: (i) => i.at },
    { key: "k", header: "Entry", cell: (i) => KIND_LABEL[i.kind] ?? i.kind },
    { key: "u", header: "Units", align: "right", cell: (i) => <span className={cn("k-num", i.units > 0 ? "text-up" : i.units < 0 ? "text-down" : "")}>{i.units > 0 ? "+" : ""}{units4(i.units)}</span> },
    { key: "n", header: "NAV", align: "right", cell: (i) => <span className="k-num">{nav4(i.nav)}</span>, hideOn: "sm" },
    { key: "a", header: "Amount", align: "right", cell: (i) => <span className="k-num">{usd(i.amount)}</span> },
  ];
  return (
    <Dialog open={!!fund} onOpenChange={(o) => !o && onClose()} side="right" title="Statement" description={fund ? `${fund.name} · your units and requests` : undefined}>
      {!data ? (
        error ? <InfoBox tone="down">{error.message}</InfoBox> : <BlockSkeleton n={2} h={100} />
      ) : (
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Unit ledger</div>
            {data.items.length ? <DataTable columns={cols} rows={data.items} dense pageSize={15} rowKey={(i, k) => `${i.at}-${k}`} exportName={`kalks-pamm-${fund?.id}-statement`} /> : <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">No unit movements yet.</div>}
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Requests</div>
            <RequestsTable requests={data.requests} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function RequestsTable({ requests, names, onCancel, busy }: { requests: RequestView[]; names?: Record<number, string>; onCancel?: (r: RequestView) => void; busy?: number | null }) {
  const cols: Column<RequestView>[] = [
    { key: "c", header: "Created", cell: (r) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(r.createdAt, false)}</span>, sort: (r) => r.createdAt },
    ...(names ? [{ key: "f", header: "Fund", cell: (r: RequestView) => <span className="truncate">{names[r.fundId] ?? `Fund #${r.fundId}`}</span> } as Column<RequestView>] : []),
    { key: "k", header: "Request", cell: (r) => <span className="capitalize">{r.kind}</span> },
    { key: "a", header: "Amount", align: "right", cell: (r) => <span className="k-num">{requestText(r)}</span> },
    {
      key: "res",
      header: "Result",
      align: "right",
      hideOn: "md",
      cell: (r) =>
        r.status === "done" ? (
          <span className="k-num text-[12px] text-fg-2">
            {r.unitsDelta !== null ? `${r.unitsDelta > 0 ? "+" : ""}${units4(r.unitsDelta)} u` : ""}
            {r.nav !== null ? ` @ ${nav4(r.nav)}` : ""}
            {r.amountOut !== null ? ` · ${usd(r.amountOut)}` : ""}
          </span>
        ) : r.reason ? (
          <span className="text-[12px] text-fg-3">{r.reason.replace(/_/g, " ")}</span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    {
      key: "s",
      header: "Status",
      align: "right",
      cell: (r) =>
        r.status === "pending" && onCancel ? (
          <span className="inline-flex items-center gap-2">
            <Chip size="sm" tone="warn">
              pending
            </Chip>
            <Button size="xs" variant="ghost" disabled={busy === r.id} onClick={() => onCancel(r)}>
              {busy === r.id ? <Loader2 className="animate-spin" /> : null} Cancel
            </Button>
          </span>
        ) : (
          <Chip size="sm" tone={REQ_TONE[r.status] ?? "neutral"}>
            {r.status}
          </Chip>
        ),
    },
  ];
  if (!requests.length) return <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">No requests.</div>;
  return <DataTable columns={cols} rows={[...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))} dense pageSize={10} rowKey={(r) => String(r.id)} />;
}

/* ------------------------------------------------------------------ */
/* Holding row                                                         */
/* ------------------------------------------------------------------ */

function HoldingRow({ inv, onRedeem, onAdd, onStopLoss, onStatement, onOpen, cancel }: { inv: InvestmentView; onRedeem: () => void; onAdd: () => void; onStopLoss: () => void; onStatement: () => void; onOpen: () => void; cancel: ReturnType<typeof useCancel> }) {
  const f = inv.fund;
  const locked = isLocked(inv.lockedUntil);
  return (
    <div className="k-row px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="block truncate text-[15px] font-medium hover:text-ember">{f.name}</span>
          <span className="block truncate text-[12px] text-fg-3">
            by {f.master.nickname} · {PERIOD_LABEL[f.period].toLowerCase()} rollover · next {serverTime(f.nextRolloverAt, false)}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {locked && (
            <Chip size="sm" tone="warn">
              <Lock className="size-3" /> Locked to {fmtDate(inv.lockedUntil)}
            </Chip>
          )}
          <FundStatusChip status={f.status} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            ["Units", units4(inv.units)],
            ["NAV", nav4(inv.nav)],
            ["Value", <span key="v" className="font-semibold">{usd(inv.value)}</span>],
            ["Net invested", usd(inv.netInvested)],
            ["P&L", <span key="p" className={inv.pnl > 0 ? "text-up" : inv.pnl < 0 ? "text-down" : ""}>{usd(inv.pnl, 2, true)}</span>],
            ["P&L %", <span key="pp" className={inv.pnlPct > 0 ? "text-up" : inv.pnlPct < 0 ? "text-down" : ""}>{pct(inv.pnlPct)}</span>],
            ["HWM NAV", nav4(inv.hwmNav)],
            [
              "Stop-loss",
              <button key="s" type="button" onClick={onStopLoss} className="text-left underline decoration-dotted underline-offset-4 hover:text-ember">
                {inv.stopLossPct !== null ? <span className="text-down">-{inv.stopLossPct}%</span> : "Off"}
              </button>,
            ],
          ] as [string, React.ReactNode][]
        ).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[11px] text-fg-3">{k}</div>
            <div className="k-num truncate text-[13.5px] font-medium">{v}</div>
          </div>
        ))}
      </div>
      {inv.pending.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {inv.pending.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-line bg-surface/60 px-3 py-2 text-[12.5px]">
              <CalendarClock className="size-3.5 text-ember" />
              <Chip size="sm" tone={p.kind === "invest" ? "up" : "warn"}>
                {p.kind === "invest" ? "Invest" : "Redeem"}
              </Chip>
              <span className="k-num font-medium">{requestText(p)}</span>
              <span className="text-fg-3">· pending until {serverTime(f.nextRolloverAt, false)}</span>
              <button className="ml-auto text-[12px] text-fg-3 hover:text-down disabled:opacity-50" disabled={cancel.busy === p.id} onClick={() => cancel.cancel(p)}>
                {cancel.busy === p.id ? "Cancelling…" : "Cancel request"}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="xs" variant="ghost" onClick={onStatement}>
          <FileText /> Statement
        </Button>
        <Button size="xs" variant="surface" onClick={onStopLoss}>
          <ShieldAlert /> Stop-loss
        </Button>
        <Button size="xs" variant="surface" onClick={onAdd} disabled={f.status !== "active"}>
          <Plus /> Add funds
        </Button>
        <Button size="xs" variant="surface" onClick={onRedeem} disabled={inv.units <= 0}>
          <ArrowDownToLine /> Redeem
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LiveInvestmentsPage() {
  const { data, error, loading, reload } = useSocial<{ items: InvestmentView[]; requests: RequestView[] }>("investments", 10000);
  const funds = useSocial<{ items: FundView[] }>("funds");
  const [redeem, setRedeem] = React.useState<InvestmentView | null>(null);
  const [sl, setSl] = React.useState<InvestmentView | null>(null);
  const [stmt, setStmt] = React.useState<FundView | null>(null);
  const [add, setAdd] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState<number | null>(null);
  const cancel = useCancel(reload);

  const items = data?.items ?? [];
  const requests = data?.requests ?? [];
  const value = items.reduce((s, i) => s + i.value, 0);
  const invested = items.reduce((s, i) => s + i.netInvested, 0);
  const pnl = items.reduce((s, i) => s + i.pnl, 0);
  const fees = items.reduce((s, i) => s + i.feesPaid, 0);
  const pendingN = requests.filter((r) => r.status === "pending").length;
  const names: Record<number, string> = {};
  for (const f of funds.data?.items ?? []) names[f.id] = f.name;
  for (const i of items) names[i.fundId] = i.fund.name;

  return (
    <div className="pb-24">
      <PageHeader
        title="My investments"
        subtitle="Your PAMM holdings, pending requests and statements."
        actions={
          <>
            <Link href="/social/copy">
              <Button variant="surface" size="lg">
                <Repeat /> Copy subscriptions
              </Button>
            </Link>
            <Link href="/social/pamm">
              <Button variant="ember" size="lg">
                <Landmark /> PAMM funds
              </Button>
            </Link>
          </>
        }
      />

      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} />
      ) : loading ? (
        <BlockSkeleton n={3} h={140} />
      ) : items.length === 0 && requests.length === 0 ? (
        <Card>
          <EmptyState
            illustration="bank"
            title="No PAMM investments yet"
            text="Invest in a master's PAMM fund: your wallet is debited now and units are issued at the next rollover NAV."
            action={
              <Link href="/social/pamm">
                <Button variant="ember">
                  <Compass /> Browse PAMM funds
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Current value" icon={<Landmark />} value={<Money value={value} countUp={false} />} chip={`${items.length} fund${items.length === 1 ? "" : "s"} · units × NAV`} />
            <KpiCard label="Net invested" icon={<Wallet />} value={<Money value={invested} countUp={false} />} chip="Invested minus redeemed" delay={0.04} />
            <KpiCard label="P&L" icon={<Repeat />} value={<Money value={pnl} signed tone="auto" countUp={false} />} chip={invested > 0 ? pct((pnl / invested) * 100) : "—"} chipTone={pnl >= 0 ? "up" : "down"} delay={0.08} />
            <KpiCard label="Fees paid" icon={<ShieldAlert />} value={<Money value={fees} countUp={false} />} chip="Taken as units at rollover" delay={0.12} />
            <KpiCard label="Pending requests" icon={<CalendarClock />} value={<span className="k-num">{pendingN}</span>} chip="Execute at rollover" chipTone={pendingN ? "warn" : "neutral"} delay={0.16} className="sm:col-span-2 lg:col-span-1" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHeader title="PAMM holdings" subtitle="Units valued at the latest NAV" icon={<Landmark />} />
              <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                {items.length === 0 ? (
                  <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No units yet. Pending investments turn into units at the fund&apos;s next rollover.</div>
                ) : (
                  items.map((inv) => (
                    <HoldingRow
                      key={inv.fundId}
                      inv={inv}
                      cancel={cancel}
                      onRedeem={() => setRedeem(inv)}
                      onAdd={() => setAdd(inv.fundId)}
                      onStopLoss={() => setSl(inv)}
                      onStatement={() => setStmt(inv.fund)}
                      onOpen={() => setOpen(inv.fundId)}
                    />
                  ))
                )}
              </div>
            </Card>
            <Card className="h-full xl:col-span-4">
              <CardHeader title="Allocation" subtitle="By fund" />
              {items.length === 0 || value <= 0 ? (
                <div className="px-6 pb-6 pt-4 text-[13px] text-fg-3">Appears once you hold units.</div>
              ) : (
                <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4">
                  <Donut
                    data={items.map((i, k) => ({ label: i.fund.name, value: i.value, color: CHART_COLORS[k % CHART_COLORS.length] }))}
                    size={180}
                    thickness={20}
                    center={
                      <div>
                        <div className="k-num text-[18px] font-semibold">{usd(value, 0)}</div>
                        <div className="text-[11px] text-fg-3">total value</div>
                      </div>
                    }
                  />
                  <div className="w-full space-y-1.5">
                    {items.map((i, k) => (
                      <div key={i.fundId} className="k-row flex items-center gap-2.5 px-3.5 py-2 text-[12.5px]">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[k % CHART_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate">{i.fund.name}</span>
                        <span className="k-num text-fg-2">{((i.value / value) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader title="Requests" subtitle="Invest and redeem requests execute at each fund's rollover" icon={<CalendarClock />} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <RequestsTable requests={requests} names={names} onCancel={cancel.cancel} busy={cancel.busy} />
            </div>
          </Card>
        </>
      )}

      <RedeemDialog inv={redeem} onClose={() => setRedeem(null)} onDone={reload} />
      <StopLossDialog inv={sl} onClose={() => setSl(null)} onDone={reload} />
      <StatementDialog fund={stmt} onClose={() => setStmt(null)} />
      <InvestDialog fundId={add} open={add !== null} onOpenChange={(o) => !o && setAdd(null)} onDone={reload} />
      <FundDetailDrawer
        fundId={open}
        onClose={() => setOpen(null)}
        onInvest={(id) => {
          setOpen(null);
          setAdd(id);
        }}
      />
    </div>
  );
}

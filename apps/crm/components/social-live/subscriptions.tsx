"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Ban, Check, Compass, Layers, ListChecks, Loader2, Pause, Play, Repeat, Settings2, ShieldAlert, ShieldCheck, Sliders, Square, Wallet, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Segmented,
  StatusChip,
  SymbolAvatar,
  SymbolCell,
  Toggle,
  cn,
  type Column,
} from "@kalks/ui";
import { Checkbox, RadioCard, RangeSlider, ToggleChip } from "@/components/social/controls";
import { TradeButton } from "@/components/trading/ui";
import { fmtDate, fmtPrice, serverTime, type EngineOrder, type EnginePosition } from "@/components/trading/api";
import {
  PERIOD_LABEL,
  SIZING_LABEL,
  pct,
  sizingText,
  socialApi,
  usd,
  useSocial,
  type FeeView,
  type SizingMode,
  type StopResult,
  type SubscriptionDetail,
  type SubscriptionView,
} from "./api";
import { BlockSkeleton, HouseBadge, InfoBox, MasterIdentity, RiskBadge, SocialError, Tile, useNumber } from "./bits";

type Log = SubscriptionDetail["log"][number];

const STOP_REASON: Record<string, string> = {
  client: "Stopped by you",
  equity_stop: "Equity stop reached",
  max_dd: "Max drawdown reached",
  admin: "Stopped by the risk team",
  master: "Master no longer active",
};
const stopReason = (r: string | null) => (r ? STOP_REASON[r] ?? r.replace(/_/g, " ") : null);

export const FEE_STATUS_TONE: Record<FeeView["status"], "warn" | "info" | "up" | "down" | "neutral"> = { pending: "warn", approved: "info", paid: "up", rejected: "neutral", failed: "down" };

export function FeesTable({ fees, empty = "No performance fees yet." }: { fees: FeeView[]; empty?: string }) {
  const cols: Column<FeeView>[] = [
    { key: "p", header: "Period", cell: (f) => <span className="whitespace-nowrap text-fg-2">{fmtDate(f.periodStart)} – {fmtDate(f.periodEnd)}</span>, sort: (f) => f.periodEnd },
    { key: "hwm", header: "HWM", align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.hwmBefore)} → {usd(f.hwmAfter)}</span>, hideOn: "md" },
    { key: "a", header: "Fee", align: "right", cell: (f) => <span className="k-num font-medium">{usd(f.amount)}</span>, sort: (f) => f.amount },
    { key: "s", header: "Status", align: "right", cell: (f) => <Chip size="sm" tone={FEE_STATUS_TONE[f.status] ?? "neutral"}>{f.status}</Chip> },
  ];
  if (!fees.length) return <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">{empty}</div>;
  return <DataTable columns={cols} rows={fees} dense pageSize={10} rowKey={(f) => String(f.id)} />;
}

/* ------------------------------------------------------------------ */
/* Settings (PATCH)                                                    */
/* ------------------------------------------------------------------ */

function SettingsDialog({ sub, onClose, onSaved }: { sub: SubscriptionView | null; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = React.useState<SizingMode>("equity");
  const value = useNumber(1);
  const maxLot = useNumber(null);
  const equityStop = useNumber(null);
  const [ddOn, setDdOn] = React.useState(false);
  const [dd, setDd] = React.useState(30);
  const [ex, setEx] = React.useState<string[]>([]);
  const [add, setAdd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const symbolsQ = useSocial<{ symbols: { symbol: string }[] }>(sub ? "symbols" : null);

  React.useEffect(() => {
    if (!sub) return;
    setMode(sub.sizing.mode);
    value.set(sub.sizing.value);
    maxLot.set(sub.maxLot);
    equityStop.set(sub.equityStop);
    setDdOn(sub.maxDdPct !== null);
    setDd(sub.maxDdPct ?? 30);
    setEx(sub.excludedSymbols ?? []);
    setAdd("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.id]);

  if (!sub) return null;
  const val = mode === "equity" ? 1 : value.value;
  const err = mode !== "equity" && !(val! > 0) ? "Enter a sizing value above zero" : maxLot.raw && !(maxLot.value! >= 0.01) ? "Max lot must be at least 0.01" : equityStop.raw && !(equityStop.value! >= 0) ? "Invalid equity stop" : undefined;
  const all = symbolsQ.data?.symbols.map((s) => s.symbol) ?? [];
  const matches = add ? all.filter((s) => s.toLowerCase().includes(add.toLowerCase()) && !ex.includes(s)).slice(0, 12) : [];

  const save = async () => {
    if (err) return toast.error(err);
    setBusy(true);
    try {
      await socialApi(`subscriptions/${sub.id}`, {
        method: "PATCH",
        body: { sizing: { mode, value: val }, maxLot: maxLot.value, equityStop: equityStop.value, maxDdPct: ddOn ? dd : null, excludedSymbols: ex },
      });
      toast.success("Copy settings saved", { description: "They apply to the next copied trades. Open positions keep their size." });
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Couldn't save the settings", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={620}
      title="Copy settings"
      description={`${sub.master.nickname} · copy account #${sub.login}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={save} disabled={busy || !!err}>
            {busy && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Sizing</div>
          <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(SIZING_LABEL) as SizingMode[]).map((k) => (
              <RadioCard
                key={k}
                selected={mode === k}
                onSelect={() => {
                  setMode(k);
                  if (k !== sub.sizing.mode) value.set(k === "fixed_lot" ? 0.1 : k === "multiplier" ? 1 : k === "allocation" ? sub.allocation : 1);
                  else value.set(sub.sizing.value);
                }}
                title={SIZING_LABEL[k]}
                className="p-3"
              />
            ))}
          </div>
          {mode !== "equity" && (
            <Field label={mode === "fixed_lot" ? "Lot size per trade" : mode === "multiplier" ? "Multiplier" : "Allocation used for sizing"} className="mt-3">
              <Input type="number" inputMode="decimal" min={0} step={mode === "fixed_lot" ? 0.01 : 0.1} value={value.raw} onChange={(e) => value.setRaw(e.target.value)} trailing={mode === "fixed_lot" ? "lots" : mode === "multiplier" ? "×" : "USD"} inputClassName="k-num" />
            </Field>
          )}
        </div>
        <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-medium">Max drawdown stop</div>
              <div className="text-[12px] text-fg-3">From the subscription&apos;s peak equity ({usd(sub.peakEquity)})</div>
            </div>
            <Toggle checked={ddOn} onChange={setDdOn} label="Max drawdown stop" />
          </div>
          <div className={cn("mt-4", !ddOn && "pointer-events-none opacity-40")}>
            <div className="mb-1 flex justify-between text-[12.5px]">
              <span className="text-fg-3">Trigger</span>
              <span className="k-num font-medium text-down">-{dd}%</span>
            </div>
            <RangeSlider value={dd} onChange={setDd} min={5} max={90} tone="down" ticks={[5, 20, 30, 50, 90]} format={(v) => `${v}%`} label="Max drawdown" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Equity stop" hint="Empty = off">
            <Input type="number" inputMode="decimal" min={0} placeholder="No equity stop" value={equityStop.raw} onChange={(e) => equityStop.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
          </Field>
          <Field label="Max lot per copied trade" hint="Empty = no cap">
            <Input type="number" inputMode="decimal" min={0.01} step={0.01} placeholder="No cap" value={maxLot.raw} onChange={(e) => maxLot.setRaw(e.target.value)} trailing="lots" inputClassName="k-num" />
          </Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            Excluded symbols <span className="font-normal text-fg-3">{ex.length ? `${ex.length} excluded` : "Copy everything"}</span>
          </div>
          {ex.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {ex.map((s) => (
                <ToggleChip key={s} tone="down" on onClick={() => setEx((x) => x.filter((y) => y !== s))}>
                  <SymbolAvatar symbol={s} size={16} />
                  {s}
                  <XIcon className="size-3" />
                </ToggleChip>
              ))}
            </div>
          )}
          <Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Search a symbol to exclude" className="h-9" />
          {matches.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {matches.map((s) => (
                <ToggleChip
                  key={s}
                  tone="down"
                  on={false}
                  onClick={() => {
                    setEx((x) => [...x, s]);
                    setAdd("");
                  }}
                >
                  <SymbolAvatar symbol={s} size={16} />
                  {s}
                </ToggleChip>
              ))}
            </div>
          )}
        </div>
        <p className="text-[12px] text-fg-3">Changes apply to new copied trades immediately. Open positions keep their current size.</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Stop                                                                */
/* ------------------------------------------------------------------ */

function StopDialog({ sub, onClose, onStopped }: { sub: SubscriptionView | null; onClose: () => void; onStopped: () => void }) {
  const [returnFunds, setReturnFunds] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<StopResult | null>(null);
  React.useEffect(() => {
    setReturnFunds(true);
    setRes(null);
  }, [sub?.id]);
  if (!sub) return null;

  const stop = async () => {
    setBusy(true);
    try {
      const r = await socialApi<StopResult>(`subscriptions/${sub.id}/stop`, { body: returnFunds ? { returnFunds: true } : {} });
      setRes(r);
      toast.success("Copying stopped", { description: `${r.closed?.length ?? 0} copied position${r.closed?.length === 1 ? "" : "s"} closed${r.returned ? ` · ${usd(r.returned)} back to your wallet` : ""}` });
      onStopped();
    } catch (e) {
      toast.error("Couldn't stop copying", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (res) {
    return (
      <Dialog
        open={!!sub}
        onOpenChange={(o) => !o && onClose()}
        width={480}
        title="Copying stopped"
        description={`${sub.master.nickname} · copy account #${sub.login}`}
        footer={
          <Button variant="ember" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-3 text-[13.5px]">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Positions closed">{(res.closed?.length ?? 0).toString()}</Tile>
            <Tile label="Returned to wallet">{res.returned !== null && res.returned !== undefined ? usd(res.returned) : "—"}</Tile>
          </div>
          {res.failed?.length > 0 && (
            <InfoBox tone="down" icon={<AlertTriangle />}>
              {res.failed.length} position{res.failed.length === 1 ? "" : "s"} couldn&apos;t be closed:
              <ul className="mt-1 list-disc pl-4">
                {res.failed.map((f) => (
                  <li key={f.ticket}>
                    #{f.ticket}: {f.error}
                  </li>
                ))}
              </ul>
              Contact support if they stay open.
            </InfoBox>
          )}
          {returnFunds && res.returned === null && (
            <InfoBox tone="warn">The balance couldn&apos;t be moved to your wallet right now. It stays on copy account #{sub.login}; you can transfer it from the wallet later.</InfoBox>
          )}
          {!returnFunds && <InfoBox>The balance stays on copy account #{sub.login}. You can move it to your wallet at any time.</InfoBox>}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title="Stop copying and close all?"
      description={`${sub.master.nickname} · copy account #${sub.login}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Keep copying
          </Button>
          <Button variant="sell" onClick={stop} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Square />} Stop & close all
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13.5px] text-fg-2">
        <InfoBox tone="down" icon={<AlertTriangle />}>
          {sub.positions + sub.orders > 0 ? (
            <>
              All <b className="text-fg">{sub.positions} copied position{sub.positions === 1 ? "" : "s"}</b>
              {sub.orders ? <> and {sub.orders} pending order{sub.orders === 1 ? "" : "s"}</> : null} will close at market price.
            </>
          ) : (
            <>There are no open copied positions. The subscription ends and no new trades are copied.</>
          )}{" "}
          This can&apos;t be undone; to copy {sub.master.nickname} again you start a new subscription.
        </InfoBox>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Equity now">{usd(sub.equity)}</Tile>
          <Tile label="Fees pending">{usd(sub.feesPending)}</Tile>
        </div>
        <Checkbox checked={returnFunds} onChange={setReturnFunds}>
          Move the balance back to my wallet after closing
        </Checkbox>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */

function DetailDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, error } = useSocial<SubscriptionDetail>(id ? `subscriptions/${id}` : null, 5000);
  const [tab, setTab] = React.useState<"positions" | "orders" | "log" | "fees">("positions");
  React.useEffect(() => setTab("positions"), [id]);
  const d = data && data.subscription.id === id ? data : null;

  const posCols: Column<EnginePosition>[] = [
    { key: "s", header: "Symbol", cell: (p) => <SymbolCell symbol={p.symbol} size={22} sub={<span className="font-mono">#{p.ticket}</span>} /> },
    { key: "side", header: "Side", cell: (p) => <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>{p.side.toUpperCase()}</Chip> },
    { key: "v", header: "Lots", align: "right", cell: (p) => <span className="k-num">{p.volume.toFixed(2)}</span> },
    { key: "px", header: "Open", align: "right", cell: (p) => <span className="k-num text-[12px] text-fg-2" title={`now ${fmtPrice(p.currentPrice)}`}>{fmtPrice(p.openPrice)}</span>, hideOn: "sm" },
    { key: "pl", header: "P&L", align: "right", cell: (p) => <span className={cn("k-num font-medium", p.profit > 0 ? "text-up" : p.profit < 0 ? "text-down" : "")}>{usd(p.profit, 2, true)}</span> },
  ];
  const ordCols: Column<EngineOrder>[] = [
    { key: "s", header: "Symbol", cell: (o) => <SymbolCell symbol={o.symbol} size={22} sub={<span className="font-mono">#{o.ticket}</span>} /> },
    { key: "t", header: "Type", cell: (o) => <span className="capitalize">{o.side} {o.type.replace("_", " ")}</span> },
    { key: "v", header: "Lots", align: "right", cell: (o) => <span className="k-num">{o.volume.toFixed(2)}</span> },
    { key: "p", header: "Price", align: "right", cell: (o) => <span className="k-num">{fmtPrice(o.price)}</span> },
  ];
  const logCols: Column<Log>[] = [
    { key: "at", header: "Time", cell: (l) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(l.at, false)}</span> },
    {
      key: "a",
      header: "Action",
      cell: (l) => (
        <span className="block">
          <span className="capitalize">{l.action.replace(/_/g, " ")}</span>
          {l.message && <span className="block text-[11px] text-fg-3">{l.message}</span>}
        </span>
      ),
    },
    { key: "v", header: "Lots", align: "right", cell: (l) => <span className="k-num">{l.volume !== null && l.volume !== undefined ? l.volume.toFixed(2) : "—"}</span>, hideOn: "sm" },
    { key: "st", header: "Result", align: "right", cell: (l) => <Chip size="sm" tone={l.status === "ok" || l.status === "done" ? "up" : l.status === "skipped" ? "neutral" : "down"}>{l.status}</Chip> },
  ];

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()} side="right" title={d ? `${d.subscription.master.nickname} · #${d.subscription.login}` : "Subscription"} description="Copied positions, orders, the copy log and fees">
      {!d ? (
        error ? <InfoBox tone="down">{error.message}</InfoBox> : <BlockSkeleton n={3} h={90} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="Equity">{usd(d.subscription.equity)}</Tile>
            <Tile label="Profit">
              <span className={d.subscription.profit >= 0 ? "text-up" : "text-down"}>{usd(d.subscription.profit, 2, true)}</span>
            </Tile>
            <Tile label="Return">{pct(d.subscription.returnPct)}</Tile>
            <Tile label="High-water mark">{usd(d.subscription.hwm)}</Tile>
            <Tile label="Fees pending">{usd(d.subscription.feesPending)}</Tile>
            <Tile label="Next fee check">{d.subscription.nextFeeAt ? serverTime(d.subscription.nextFeeAt, false) : "—"}</Tile>
          </div>
          <Segmented
            size="xs"
            value={tab}
            onChange={setTab}
            options={[
              { value: "positions", label: `Positions ${d.positions.length}` },
              { value: "orders", label: `Orders ${d.orders.length}` },
              { value: "log", label: "Copy log" },
              { value: "fees", label: `Fees ${d.fees.length}` },
            ]}
          />
          {tab === "positions" &&
            (d.positions.length ? <DataTable columns={posCols} rows={d.positions} dense pageSize={20} rowKey={(p) => String(p.ticket)} /> : <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No copied positions open.</div>)}
          {tab === "orders" && (d.orders.length ? <DataTable columns={ordCols} rows={d.orders} dense pageSize={20} rowKey={(o) => String(o.ticket)} /> : <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No copied pending orders.</div>)}
          {tab === "log" && (d.log.length ? <DataTable columns={logCols} rows={d.log} dense pageSize={20} rowKey={(l, i) => `${l.at}-${i}`} /> : <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">Nothing copied yet.</div>)}
          {tab === "fees" && <FeesTable fees={d.fees} />}
          <InfoBox>Copied positions close when the master closes them. To exit early, stop copying: everything closes at market.</InfoBox>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function SubCard({ s, onChanged, onEdit, onStop, onDetail }: { s: SubscriptionView; onChanged: () => void; onEdit: () => void; onStop: () => void; onDetail: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const stopped = s.status === "stopped";
  const togglePause = async () => {
    setBusy(true);
    const pause = s.status !== "paused";
    try {
      await socialApi(`subscriptions/${s.id}`, { method: "PATCH", body: { paused: pause } });
      toast.success(pause ? "Copying paused" : "Copying resumed", {
        description: pause ? "No new trades are opened. Positions already copied still follow the master's closes and SL/TP changes." : `New trades from ${s.master.nickname} are copied again.`,
      });
      onChanged();
    } catch (e) {
      toast.error(pause ? "Couldn't pause" : "Couldn't resume", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cn("k-card flex h-full flex-col", stopped && "opacity-70")}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <Link href={`/social/masters/${s.masterId}`} className="min-w-0">
          <MasterIdentity nickname={s.master.nickname} size={42} sub={s.master.strategy} />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <RiskBadge risk={s.master.riskScore} />
          <StatusChip status={s.status} />
        </div>
      </div>
      {s.master.house && (
        <div className="mt-2.5 px-5">
          <HouseBadge />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5 text-[12px] text-fg-3">
        Copy account <span className="font-mono text-fg-2">#{s.login}</span>
        <CopyButton value={String(s.login)} label="Copy account" className="size-5" />
        <span>· since {fmtDate(s.createdAt)}</span>
      </div>
      {stopped && s.stopReason && <div className="mt-1 px-5 text-[12px] text-down">{stopReason(s.stopReason)}{s.stoppedAt ? ` · ${fmtDate(s.stoppedAt)}` : ""}</div>}
      {!stopped && s.master.frozen && <div className="mt-1 px-5 text-[12px] text-warn">Copying of this master is paused by the risk team.</div>}
      <div className="mt-4 px-5">
        <div className="text-[11px] uppercase tracking-wider text-fg-3">Equity</div>
        <Money value={s.equity} countUp={false} className="text-[26px] font-semibold" />
        <div className={cn("k-num text-[12.5px] font-medium", s.profit > 0 ? "text-up" : s.profit < 0 ? "text-down" : "text-fg-2")}>
          {usd(s.profit, 2, true)} ({pct(s.returnPct)})
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 px-5 text-[12px] sm:grid-cols-3">
        <Tile label="Net deposits">{usd(s.netDeposits, 0)}</Tile>
        <Tile label="High-water">{usd(s.hwm, 0)}</Tile>
        <Tile label="Fees pending">
          <span className={s.feesPending ? "text-warn" : ""}>{usd(s.feesPending)}</span>
        </Tile>
        <Tile label="Sizing">{sizingText(s.sizing)}</Tile>
        <Tile label="Open">
          {s.positions} pos · {s.orders} ord
        </Tile>
        <Tile label="Fees paid">{usd(s.feesPaid)}</Tile>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5">
        <Chip size="sm">
          {s.perfFeePct}% fee · {PERIOD_LABEL[s.feePeriod].toLowerCase()}
        </Chip>
        {s.maxDdPct !== null && (
          <Chip size="sm" tone="down">
            <ShieldAlert className="size-3" /> DD stop -{s.maxDdPct}%
          </Chip>
        )}
        {s.equityStop !== null && (
          <Chip size="sm" tone="down">
            Equity stop {usd(s.equityStop, 0)}
          </Chip>
        )}
        {s.maxLot !== null && <Chip size="sm">Max {s.maxLot.toFixed(2)} lot</Chip>}
        {s.excludedSymbols.length > 0 ? <Chip size="sm">Excl. {s.excludedSymbols.slice(0, 3).join(", ")}{s.excludedSymbols.length > 3 ? ` +${s.excludedSymbols.length - 3}` : ""}</Chip> : <Chip size="sm">All symbols</Chip>}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 px-5 pb-5 pt-4 sm:grid-cols-3">
        {!stopped && (
          <>
            <Button size="sm" variant="surface" disabled={busy} onClick={togglePause}>
              {busy ? <Loader2 className="animate-spin" /> : s.status === "paused" ? <Play /> : <Pause />} {s.status === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button size="sm" variant="surface" onClick={onEdit}>
              <Settings2 /> Settings
            </Button>
            <Button size="sm" variant="down-outline" onClick={onStop}>
              <Square /> Stop
            </Button>
          </>
        )}
        <Button size="sm" variant="surface" onClick={onDetail} className={cn(stopped && "col-span-1")}>
          <ListChecks /> Details
        </Button>
        <TradeButton a={{ login: s.login, status: "active" }} size="sm" label="Kalks Trader" className="sm:col-span-2" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LiveCopyPage() {
  const { data, error, loading, reload } = useSocial<{ items: SubscriptionView[] }>("subscriptions", 5000);
  const [view, setView] = React.useState<"current" | "stopped">("current");
  const [edit, setEdit] = React.useState<SubscriptionView | null>(null);
  const [stop, setStop] = React.useState<SubscriptionView | null>(null);
  const [detail, setDetail] = React.useState<number | null>(null);

  const items = data?.items ?? [];
  const current = items.filter((s) => s.status !== "stopped");
  const stopped = items.filter((s) => s.status === "stopped");
  const list = view === "current" ? current : stopped;
  const equity = current.reduce((a, s) => a + s.equity, 0);
  const profit = current.reduce((a, s) => a + s.profit, 0);
  const deposits = current.reduce((a, s) => a + s.netDeposits, 0);
  const feesPending = items.reduce((a, s) => a + s.feesPending, 0);
  const feesPaid = items.reduce((a, s) => a + s.feesPaid, 0);

  return (
    <div className="pb-24">
      <PageHeader
        title="Copy trading"
        subtitle="Your copy subscriptions. Each one runs in its own copy account."
        actions={
          <Link href="/social">
            <Button variant="ember" size="lg">
              <Compass /> Find a master
            </Button>
          </Link>
        }
      />

      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} />
      ) : loading ? (
        <BlockSkeleton n={3} h={140} />
      ) : items.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <EmptyState
              illustration="chart_increasing"
              title="You're not copying anyone yet"
              text="Pick a master on the leaderboard, choose how trades are sized and set your limits. A dedicated copy account is opened and funded from your wallet."
              action={
                <Link href="/social">
                  <Button variant="ember">
                    <Compass /> Discover masters
                  </Button>
                </Link>
              }
            />
          </Card>
          <HowItWorks className="xl:col-span-4" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Copy equity" icon={<Wallet />} value={<Money value={equity} countUp={false} />} chip={`${current.length} active or paused`} />
            <KpiCard label="Profit" icon={<Repeat />} value={<Money value={profit} signed tone="auto" countUp={false} />} chip={deposits > 0 ? pct((profit / deposits) * 100) + " on net deposits" : "—"} chipTone={profit >= 0 ? "up" : "down"} delay={0.04} />
            <KpiCard label="Fees pending" icon={<ShieldCheck />} value={<Money value={feesPending} countUp={false} />} chip="Awaiting approval" chipTone="warn" delay={0.08} />
            <KpiCard label="Fees paid" icon={<Layers />} value={<Money value={feesPaid} countUp={false} />} chip="All subscriptions" delay={0.12} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-medium tracking-tight">My subscriptions</h2>
                  <p className="text-[13px] text-fg-3">To exit, pause or stop. Copied trades can&apos;t be closed one by one.</p>
                </div>
                <Segmented
                  size="xs"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "current", label: `Current ${current.length}` },
                    { value: "stopped", label: `Stopped ${stopped.length}` },
                  ]}
                />
              </div>
              {list.length === 0 ? (
                <Card>
                  <div className="px-6 py-12 text-center text-[13px] text-fg-3">{view === "current" ? "No active subscriptions." : "No stopped subscriptions."}</div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {list.map((s) => (
                    <SubCard key={s.id} s={s} onChanged={reload} onEdit={() => setEdit(s)} onStop={() => setStop(s)} onDetail={() => setDetail(s.id)} />
                  ))}
                </div>
              )}
            </div>
            <HowItWorks className="xl:col-span-4 xl:self-start" />
          </div>
        </>
      )}

      <SettingsDialog sub={edit} onClose={() => setEdit(null)} onSaved={reload} />
      <StopDialog sub={stop} onClose={() => setStop(null)} onStopped={reload} />
      <DetailDrawer id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function HowItWorks({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="How copying works" subtitle="Rules that protect you" icon={<ShieldCheck />} />
      <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
        {[
          { icon: <Layers />, t: "Everything is mirrored", s: "Opens, adds, partial closes, SL/TP changes and pending orders, in the master's order." },
          { icon: <Ban />, t: "No single-trade closing", s: "Copied trades can't be closed one by one. Pause to stop new trades, or stop to close everything." },
          { icon: <Sliders />, t: "Your limits win", s: "Max drawdown, equity stop, max lot and excluded symbols override the master." },
          { icon: <Check />, t: "Fees above high-water mark", s: "Charged only on new trading profit at the end of each period, then approved by our team." },
        ].map((r) => (
          <div key={r.t} className="k-row flex items-start gap-3 px-3.5 py-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{r.icon}</span>
            <div>
              <div className="text-[13px] font-medium">{r.t}</div>
              <div className="text-[12px] leading-snug text-fg-3">{r.s}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

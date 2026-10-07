"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, CalendarClock, Compass, Landmark, Lock, Pause, Play, Plus, Repeat, Settings2, ShieldAlert, Square, Wallet, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  Dialog,
  Donut,
  Field,
  Input,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  StatusChip,
  SymbolAvatar,
  Toggle,
  cn,
  formatMoney,
} from "@/components/kit";
import {
  MY_COPY_SUBS,
  MY_PAMM_HOLDINGS,
  fundById,
  masterById,
  masterSpark,
  type CopySubscription,
  type PammFund,
  type PammHolding,
} from "@kalks/mock/social";
import { MasterIdentity, RiskBadge } from "@/components/social/master-bits";
import { InvestDialog } from "@/components/social/invest-dialog";
import { RangeSlider, ToggleChip } from "@/components/social/controls";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveInvestmentsPage } from "@/components/social-live/investments";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (iso: string) => {
  const d = new Date(Date.parse(iso) + 3 * 3600000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const COLORS = ["var(--k-ember)", "var(--k-ember-2)", "#e9b949", "#22c55e", "#38bdf8", "#a1a1aa"];

/* ------------------------------------------------------------------ */
/* Copy subscriptions                                                  */
/* ------------------------------------------------------------------ */

function EditRiskDialog({ sub, onClose }: { sub: CopySubscription | null; onClose: () => void }) {
  const [stop, setStop] = React.useState(25);
  const [maxLot, setMaxLot] = React.useState(1);
  const [ex, setEx] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (sub) {
      setStop(sub.equityStopPct);
      setMaxLot(sub.maxLot);
      setEx(sub.excluded);
    }
  }, [sub]);
  if (!sub) return null;
  const m = masterById(sub.masterId)!;
  const syms = Array.from(new Set([...m.instruments.map((i) => i.label), "XAUUSD", "EURUSD", "GBPUSD", "NAS100", "US30", "BTCUSD"]));
  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={560}
      title="Edit risk controls"
      description={`Copy account #${sub.copyAccount} · ${m.person.name}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ember"
            onClick={() => {
              Object.assign(sub, { equityStopPct: stop, maxLot, excluded: ex });
              toast.success("Risk controls updated", { description: `Equity stop -${stop}% · max ${maxLot.toFixed(2)} lot · ${ex.length} excluded` });
              onClose();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex justify-between text-[13px]">
            <span className="font-medium text-fg-2">Equity stop</span>
            <span className="k-num font-medium text-down">
              -{stop}% · closes at {formatMoney(sub.allocated * (1 - stop / 100), "USD", 0)}
            </span>
          </div>
          <RangeSlider value={stop} onChange={setStop} min={5} max={60} tone="down" ticks={[5, 15, 25, 40, 60]} format={(v) => `${v}%`} label="Equity stop" />
        </div>
        <Field label="Max lot per copied trade">
          <Input type="number" step={0.01} min={0.01} value={maxLot} onChange={(e) => setMaxLot(Math.max(0.01, +e.target.value))} trailing="lots" />
        </Field>
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-fg-2">Excluded symbols</div>
          <div className="flex flex-wrap gap-2">
            {syms.map((s) => {
              const on = ex.includes(s);
              return (
                <ToggleChip key={s} tone="down" on={on} onClick={() => setEx((x) => (on ? x.filter((y) => y !== s) : [...x, s]))}>
                  <SymbolAvatar symbol={s} size={16} />
                  {s}
                  {on && <XIcon className="size-3" />}
                </ToggleChip>
              );
            })}
          </div>
        </div>
        <p className="text-[12px] text-fg-3">Changes apply to new copied trades immediately. Open positions keep their current size.</p>
      </div>
    </Dialog>
  );
}

function StopDialog({ sub, onClose, onStopped }: { sub: CopySubscription | null; onClose: () => void; onStopped: (id: string) => void }) {
  if (!sub) return null;
  const m = masterById(sub.masterId)!;
  return (
    <Dialog
      open={!!sub}
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title="Stop copying & close all?"
      description={`${m.person.name} · copy account #${sub.copyAccount}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Keep copying
          </Button>
          <Button
            variant="sell"
            onClick={() => {
              onStopped(sub.id);
              toast.success("Copying stopped", { description: `${sub.openTrades} positions closed at market · ${formatMoney(sub.equity)} returning to your wallet` });
              onClose();
            }}
          >
            <Square /> Stop & close all
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13.5px] text-fg-2">
        <div className="flex items-start gap-3 rounded-[14px] border border-down/30 bg-down-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-down" />
          <span>
            All <b className="text-fg">{sub.openTrades} copied positions</b> will close at market price. Copied trades can&apos;t be closed individually.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="k-row px-4 py-3">
            <div className="text-[12px] text-fg-3">Returns to wallet</div>
            <Money value={sub.equity - sub.feesAccrued} countUp={false} className="text-[17px] font-semibold" />
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[12px] text-fg-3">Fee settled</div>
            <Money value={sub.feesAccrued} countUp={false} className="text-[17px] font-semibold" />
          </div>
        </div>
        <p className="text-[12px] text-fg-3">Any accrued performance fee above the high-water mark is settled first and held as pending until admin approval.</p>
      </div>
    </Dialog>
  );
}

function SubCard({ s, onPause, onEdit, onStop }: { s: CopySubscription; onPause: () => void; onEdit: () => void; onStop: () => void }) {
  const m = masterById(s.masterId)!;
  const spark = React.useMemo(() => {
    // Master's path, detrended, laid over a line from allocation to current equity
    const raw = masterSpark(m, 30);
    const n = raw.length - 1;
    return raw.map((v, i) => {
      const lin = raw[0]! + ((raw[n]! - raw[0]!) * i) / n;
      return s.allocated + ((s.equity - s.allocated) * i) / n + ((v - lin) / raw[0]!) * s.allocated * 0.8;
    });
  }, [m, s.allocated, s.equity]);
  const pct = (s.pnl / s.allocated) * 100;
  const stopped = s.status === "stopped";
  return (
    <div className={cn("k-card flex h-full flex-col", stopped && "opacity-60")}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <Link href={`/social/masters/${m.id}`} className="min-w-0">
          <MasterIdentity m={m} size={42} />
        </Link>
        <StatusChip status={s.status === "stopped" ? "expired" : s.status} label={stopped ? "Stopped" : undefined} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 px-5 text-[12px] text-fg-3">
        Copy account <span className="font-mono text-fg-2">#{s.copyAccount}</span>
        <CopyButton value={s.copyAccount} label="Copy account" className="size-5" />
        <span>· since {fmtDay(s.startedAt)}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 px-5">
        <div>
          <div className="text-[12px] text-fg-3">Equity</div>
          <Money value={s.equity} className="text-[26px] font-semibold" />
          <div className={cn("k-num text-[12.5px] font-medium", s.pnl >= 0 ? "text-up" : "text-down")}>
            {s.pnl >= 0 ? "+" : "-"}
            {formatMoney(Math.abs(s.pnl))} ({pct >= 0 ? "+" : ""}
            {pct.toFixed(2)}%)
          </div>
        </div>
        <Sparkline data={spark} width={110} height={44} tone={s.pnl >= 0 ? "up" : "down"} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 px-5 text-[12px]">
        {[
          ["Allocated", formatMoney(s.allocated, "USD", 0)],
          ["High-water", formatMoney(s.hwm, "USD", 0)],
          ["Fees accrued", <span key="f" className={s.feesAccrued ? "text-warn" : ""}>{formatMoney(s.feesAccrued)}</span>],
          ["Sizing", s.mode === "proportional" ? "Proportional" : `${{ "fixed-lot": "Fixed", multiplier: "Multiplier", "fixed-allocation": "Alloc." }[s.mode as "fixed-lot"]} · ${s.modeValue}`],
          ["Open trades", s.openTrades.toString()],
          ["Fees paid", formatMoney(s.feesPaid)],
        ].map(([k, v], i) => (
          <div key={i} className="k-row min-w-0 px-2.5 py-2">
            <div className="text-fg-3">{k}</div>
            <div className="k-num mt-0.5 truncate font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5 text-[11.5px]">
        <Chip size="sm" tone="down">
          <ShieldAlert className="size-3" /> Stop -{s.equityStopPct}%
        </Chip>
        <Chip size="sm">Max {s.maxLot.toFixed(2)} lot</Chip>
        {s.excluded.length > 0 ? <Chip size="sm">Excl. {s.excluded.join(", ")}</Chip> : <Chip size="sm">All symbols</Chip>}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 px-5 pb-5 pt-4">
        <Button size="sm" variant="surface" disabled={stopped} onClick={onPause}>
          {s.status === "paused" ? (
            <>
              <Play /> Resume
            </>
          ) : (
            <>
              <Pause /> Pause
            </>
          )}
        </Button>
        <Button size="sm" variant="surface" disabled={stopped} onClick={onEdit}>
          <Settings2 /> Edit risk
        </Button>
        <Button size="sm" variant="down-outline" disabled={stopped} onClick={onStop}>
          <Square /> Stop
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PAMM                                                                */
/* ------------------------------------------------------------------ */

function RedeemDialog({ h, onClose }: { h: PammHolding | null; onClose: () => void }) {
  const [by, setBy] = React.useState<"amount" | "units">("amount");
  const [val, setVal] = React.useState(500);
  const [all, setAll] = React.useState(false);
  React.useEffect(() => {
    setAll(false);
    setBy("amount");
    setVal(500);
  }, [h]);
  if (!h) return null;
  const f = fundById(h.fundId)!;
  const value = h.units * f.navPerUnit;
  const locked = h.lockUntil && Date.parse(h.lockUntil) > Date.parse("2026-09-24T12:00:00Z");
  const units = all ? h.units : by === "units" ? Math.min(val, h.units) : Math.min(val / f.navPerUnit, h.units);
  const amount = units * f.navPerUnit;
  return (
    <Dialog
      open={!!h}
      onOpenChange={(o) => !o && onClose()}
      width={520}
      title={`Redeem from ${f.name}`}
      description="Redemptions are queued and executed at the next rollover NAV."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ember"
            disabled={!!locked || units <= 0}
            onClick={() => {
              toast.success(`Redemption queued until rollover (${f.nextRolloverLabel})`, { description: `${units.toFixed(4)} units ≈ ${formatMoney(amount)} to your wallet` });
              onClose();
            }}
          >
            Queue redemption
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Units held", h.units.toFixed(4)],
            ["NAV / unit", f.navPerUnit.toFixed(4)],
            ["Value", formatMoney(value)],
          ].map(([k, v]) => (
            <div key={k} className="k-row px-3 py-2.5">
              <div className="text-[11px] text-fg-3">{k}</div>
              <div className="k-num text-[14px] font-medium">{v}</div>
            </div>
          ))}
        </div>
        {locked ? (
          <div className="flex items-start gap-3 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px]">
            <Lock className="mt-0.5 size-4 shrink-0 text-warn" />
            <span className="text-fg-2">
              This holding is in its lock-in period until <b className="text-fg">{fmtDay(h.lockUntil!)}</b>. Early redemption isn&apos;t available for this fund.
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Segmented
                size="xs"
                value={by}
                onChange={(v) => {
                  setBy(v);
                  setVal(v === "units" ? +(h.units / 2).toFixed(4) : 500);
                }}
                options={[
                  { value: "amount", label: "By amount" },
                  { value: "units", label: "By units" },
                ]}
              />
              <label className="flex items-center gap-2 text-[13px] text-fg-2">
                Redeem all <Toggle checked={all} onChange={setAll} label="Redeem all" />
              </label>
            </div>
            <Field label={by === "amount" ? "Amount (USD)" : "Units"}>
              <Input type="number" disabled={all} value={all ? (by === "amount" ? +value.toFixed(2) : h.units) : val} onChange={(e) => setVal(+e.target.value)} leading={by === "amount" ? "$" : undefined} trailing={by === "amount" ? "USD" : "units"} inputClassName="k-num" />
            </Field>
            <div className="rounded-[14px] border border-gold/25 bg-gold-soft px-4 py-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-fg-2">Units to redeem</span>
                <span className="k-num font-medium">{units.toFixed(4)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-fg-2">Estimated payout</span>
                <span className="k-num font-semibold">{formatMoney(amount)}</span>
              </div>
              <div className="mt-2 text-[11.5px] text-fg-3">
                Executes {f.nextRolloverLabel} · final NAV fixed at rollover · any fee above the high-water mark is settled first
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function HoldingRow({ h, onRedeem, onAdd }: { h: PammHolding; onRedeem: () => void; onAdd: () => void }) {
  const f = fundById(h.fundId)!;
  const m = masterById(f.masterId)!;
  const value = h.units * f.navPerUnit;
  const pnl = value - h.invested;
  const locked = h.lockUntil && Date.parse(h.lockUntil) > Date.parse("2026-09-24T12:00:00Z");
  const [pending, setPending] = React.useState(h.pending);
  return (
    <div className="k-row px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={`/social/masters/${m.id}`} className="min-w-0">
          <MasterIdentity m={m} size={40} sub={`${f.name} · since ${fmtDay(h.since)}`} />
        </Link>
        <div className="flex items-center gap-2">
          {locked && (
            <Chip size="sm" tone="warn">
              <Lock className="size-3" /> Locked to {fmtDay(h.lockUntil!).slice(0, 6)}
            </Chip>
          )}
          <RiskBadge risk={f.risk} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Units", h.units.toFixed(4)],
          ["Avg → NAV", `${h.avgNav.toFixed(2)} → ${f.navPerUnit.toFixed(2)}`],
          ["Value", <Money key="v" value={value} countUp={false} className="font-semibold" />],
          ["P&L", <span key="p" className={pnl >= 0 ? "text-up" : "text-down"}>{pnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(pnl))}</span>],
          ["HWM NAV", h.hwmNav.toFixed(2)],
          ["Stop-loss", <span key="s" className="text-down">-{h.stopLossPct}%</span>],
        ].map(([k, v], i) => (
          <div key={i} className="min-w-0">
            <div className="text-[11px] text-fg-3">{k}</div>
            <div className="k-num truncate text-[13.5px] font-medium">{v}</div>
          </div>
        ))}
      </div>
      {pending.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {pending.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-[12px] border border-dashed border-line bg-surface/60 px-3 py-2 text-[12.5px]">
              <CalendarClock className="size-3.5 text-ember" />
              <Chip size="sm" tone={p.type === "invest" ? "up" : "warn"}>
                {p.type === "invest" ? "Invest" : "Redeem"}
              </Chip>
              <span className="k-num font-medium">{formatMoney(p.amount)}</span>
              {p.units && <span className="k-num text-fg-3">≈ {p.units.toFixed(4)} units</span>}
              <span className="text-fg-3">· queued until {f.nextRolloverLabel}</span>
              <button
                className="ml-auto text-[12px] text-fg-3 hover:text-down"
                onClick={() => {
                  setPending((x) => x.filter((y) => y.id !== p.id));
                  toast.success("Request cancelled", { description: p.type === "invest" ? `${formatMoney(p.amount)} released back to your wallet` : "Your units stay invested" });
                }}
              >
                Cancel request
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button size="xs" variant="surface" onClick={onAdd}>
          <Plus /> Add funds
        </Button>
        <Button size="xs" variant="surface" onClick={onRedeem}>
          <ArrowDownToLine /> Redeem
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DemoInvestmentsPage() {
  const [subs, setSubs] = React.useState(MY_COPY_SUBS);
  const [edit, setEdit] = React.useState<CopySubscription | null>(null);
  const [stop, setStop] = React.useState<CopySubscription | null>(null);
  const [redeem, setRedeem] = React.useState<PammHolding | null>(null);
  const [add, setAdd] = React.useState<PammFund | null>(null);

  const holdings = MY_PAMM_HOLDINGS.map((h) => ({ h, f: fundById(h.fundId)! }));
  const copyAlloc = subs.reduce((s, x) => s + x.allocated, 0);
  const copyEq = subs.reduce((s, x) => s + x.equity, 0);
  const pammInv = holdings.reduce((s, { h }) => s + h.invested, 0);
  const pammVal = holdings.reduce((s, { h, f }) => s + h.units * f.navPerUnit, 0);
  const invested = copyAlloc + pammInv;
  const value = copyEq + pammVal;
  const fees = subs.reduce((s, x) => s + x.feesPaid, 0) + holdings.reduce((s, { h }) => s + h.feesPaid, 0);
  const accrued = subs.reduce((s, x) => s + x.feesAccrued, 0);
  const pendingN = MY_PAMM_HOLDINGS.reduce((s, h) => s + h.pending.length, 0);

  const alloc = [
    ...subs.map((s) => ({ label: `Copy · ${masterById(s.masterId)!.person.name}`, value: s.equity })),
    ...holdings.map(({ h, f }) => ({ label: `PAMM · ${f.name}`, value: h.units * f.navPerUnit })),
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="My investments"
        subtitle="Your copy subscriptions and PAMM holdings in one place."
        actions={
          <>
            <Link href="/social">
              <Button variant="surface" size="lg">
                <Compass /> Discover
              </Button>
            </Link>
            <Link href="/social/copy">
              <Button variant="ember" size="lg">
                <Plus /> New investment
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total invested" icon={<Wallet />} value={<Money value={invested} />} chip={`${subs.length} copy · ${holdings.length} PAMM`} />
        <KpiCard label="Current value" icon={<Landmark />} value={<Money value={value} />} hot chip="Live equity + NAV" chipTone="ember" delay={0.04} />
        <KpiCard label="Total P&L" icon={<Repeat />} value={<Money value={value - invested} signed tone="auto" />} chip={`${(((value - invested) / invested) * 100).toFixed(2)}% overall`} chipTone={value >= invested ? "up" : "down"} delay={0.08} />
        <KpiCard label="Fees paid" icon={<ShieldAlert />} value={<Money value={fees} />} chip={`${formatMoney(accrued)} accrued · pending`} chipTone="warn" delay={0.12} />
        <KpiCard label="Pending requests" icon={<CalendarClock />} value={<span className="k-num">{pendingN}</span>} chip="Execute at rollover" delay={0.16} className="sm:col-span-2 lg:col-span-1" />
      </div>

      <Reveal delay={0.06} className="mt-6 block">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[18px] font-medium tracking-tight">Copy subscriptions</h2>
            <p className="text-[13px] text-fg-3">Each runs in its own copy account. To exit, pause or stop — copied trades can&apos;t be closed one by one.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {subs.map((s) => (
            <SubCard
              key={s.id}
              s={s}
              onPause={() => {
                const next = s.status === "paused" ? "active" : "paused";
                setSubs((x) => x.map((y) => (y.id === s.id ? { ...y, status: next } : y)));
                toast.success(next === "paused" ? "Copying paused" : "Copying resumed", {
                  description: next === "paused" ? "No new trades will be copied. Open positions stay mirrored until closed by the master." : "New trades from the master will be copied again.",
                });
              }}
              onEdit={() => setEdit(s)}
              onStop={() => setStop(s)}
            />
          ))}
        </div>
      </Reveal>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.08} className="xl:col-span-8">
          <Card>
            <CardHeader title="PAMM holdings" subtitle="Units valued at the latest NAV" icon={<Landmark />} />
            <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
              {MY_PAMM_HOLDINGS.map((h) => (
                <HoldingRow key={h.id} h={h} onRedeem={() => setRedeem(h)} onAdd={() => setAdd(fundById(h.fundId)!)} />
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.12} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Allocation" subtitle="By master and product" />
            <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4">
              <Donut
                data={alloc.map((a, i) => ({ ...a, color: COLORS[i % COLORS.length] }))}
                size={180}
                thickness={20}
                center={
                  <div>
                    <div className="k-num text-[18px] font-semibold">{formatMoney(value, "USD", 0)}</div>
                    <div className="text-[11px] text-fg-3">total value</div>
                  </div>
                }
              />
              <div className="w-full space-y-1.5">
                {alloc.map((a, i) => (
                  <div key={a.label} className="k-row flex items-center gap-2.5 px-3.5 py-2 text-[12.5px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    <span className="k-num text-fg-2">{((a.value / value) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                <div className="k-row px-3.5 py-2.5">
                  <div className="text-[11px] text-fg-3">Copy</div>
                  <div className="k-num text-[14px] font-medium">{((copyEq / value) * 100).toFixed(0)}%</div>
                </div>
                <div className="k-row px-3.5 py-2.5">
                  <div className="text-[11px] text-fg-3">PAMM</div>
                  <div className="k-num text-[14px] font-medium">{((pammVal / value) * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <EditRiskDialog sub={edit} onClose={() => setEdit(null)} />
      <StopDialog sub={stop} onClose={() => setStop(null)} onStopped={(id) => setSubs((x) => x.map((y) => (y.id === id ? { ...y, status: "stopped", openTrades: 0 } : y)))} />
      <RedeemDialog h={redeem} onClose={() => setRedeem(null)} />
      <InvestDialog fund={add} open={!!add} onOpenChange={(o) => !o && setAdd(null)} />
    </div>
  );
}

export default function InvestmentsPage() {
  return DEMO_BUILD ? <DemoInvestmentsPage /> : <LiveInvestmentsPage />;
}

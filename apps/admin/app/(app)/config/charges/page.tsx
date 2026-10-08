"use client";

import * as React from "react";
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Moon, RefreshCcw, RotateCcw, Save, Timer, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Donut, Money, PageHeader, Reveal, Segmented, Toggle, cn, formatMoney, CHART_COLORS } from "@ezymex/ui";
import { INSTRUMENTS, ASSET_CLASS_LABEL, getInstrument, type AssetClass } from "@ezymex/mock";
import { CFD_GROUPS, COMMISSIONS, COMMISSION_CLASSES, FEE_RULES, type ChargeOn, type CommissionCell, type FeeRule } from "@ezymex/mock/admin-config";
import { MiniField, NumInput, Select, auditToast } from "@/components/config/kit";

type Plans = typeof COMMISSIONS;

const KIND_META: Record<FeeRule["kind"], { label: string; icon: React.ReactNode }> = {
  deposit: { label: "Deposit", icon: <ArrowDownToLine /> },
  withdrawal: { label: "Withdrawal", icon: <ArrowUpFromLine /> },
  conversion: { label: "Conversion", icon: <RefreshCcw /> },
  islamic: { label: "Islamic", icon: <Moon /> },
  inactivity: { label: "Inactivity", icon: <Timer /> },
  internal: { label: "Internal", icon: <Repeat /> },
};

function rowCharge(row: Record<AssetClass, CommissionCell>): ChargeOn {
  return row.forex.chargeOn;
}

function commissionFor(cell: CommissionCell, symbol: string, lots: number) {
  const inst = getInstrument(symbol);
  const perSide = cell.unit === "per-lot" ? cell.perLot * lots : (inst.price * inst.contractSize * lots * cell.perLot) / 100;
  if (cell.chargeOn === "round") return { open: perSide / 2, close: perSide / 2 };
  if (cell.chargeOn === "open") return { open: perSide, close: 0 };
  return { open: 0, close: perSide };
}

function CommissionCalc({ plans }: { plans: Plans }) {
  const [gid, setGid] = React.useState("ecn");
  const [symbol, setSymbol] = React.useState("XAUUSD");
  const [lots, setLots] = React.useState(1);
  const inst = getInstrument(symbol);
  const cell = plans[gid]![inst.assetClass];
  const c = commissionFor(cell, symbol, lots);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Commission calculator" subtitle="What the client pays on one round trip" icon={<Calculator />} />
      <div className="grid grid-cols-2 gap-3 px-6 pt-4">
        <MiniField label="Group">
          <Select value={gid} onChange={setGid} options={CFD_GROUPS.map((g) => ({ value: g.id, label: g.name }))} />
        </MiniField>
        <MiniField label="Symbol">
          <Select value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => i.symbol)} />
        </MiniField>
        <MiniField label="Volume" className="col-span-2">
          <NumInput value={lots} onChange={setLots} step={0.1} min={0.01} suffix="lots" stepper />
        </MiniField>
      </div>
      <div className="mt-4 space-y-2 px-6">
        {[
          ["Charged on open", c.open],
          ["Charged on close", c.close],
        ].map(([k, v]) => (
          <div key={k as string} className="k-row flex items-center justify-between px-4 py-2.5 text-[13px]">
            <span className="text-fg-3">{k}</span>
            <span className="k-num font-medium">{formatMoney(v as number)}</span>
          </div>
        ))}
      </div>
      <div className="mx-6 mt-4 flex-1">
        <div className="k-label mb-2">Same trade in other groups</div>
        <div className="divide-y divide-line">
          {CFD_GROUPS.filter((g) => g.id !== gid).map((g) => {
            const o = commissionFor(plans[g.id]![inst.assetClass], symbol, lots);
            return (
              <button key={g.id} onClick={() => setGid(g.id)} className="flex w-full items-center justify-between py-2 text-[12.5px] hover:text-fg">
                <span className="text-fg-2">{g.name}</span>
                <span className="k-num font-medium">{o.open + o.close === 0 ? <span className="text-fg-3">Spread only</span> : formatMoney(o.open + o.close)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mx-6 mb-6 mt-3 flex items-end justify-between rounded-[14px] border border-ember/25 bg-ember-soft px-4 py-3">
        <div>
          <div className="k-label text-ember">Total round trip</div>
          <div className="mt-1 text-[11.5px] text-fg-3">
            {cell.unit === "per-lot" ? `$${cell.perLot}/lot` : `${cell.perLot}% of notional`} · {cell.chargeOn === "round" ? "split open/close" : `on ${cell.chargeOn}`}
          </div>
        </div>
        <Money value={c.open + c.close} countUp={false} className="text-[24px] font-semibold" />
      </div>
    </Card>
  );
}

function FeeRow({ f, onChange }: { f: FeeRule; onChange: (f: FeeRule) => void }) {
  const meta = KIND_META[f.kind];
  return (
    <div className={cn("k-row grid grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]", !f.enabled && "opacity-60")}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2 [&_svg]:size-4">{meta.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13.5px] font-medium">
            {f.label}
            <Chip size="sm">{f.method}</Chip>
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{f.note}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NumInput size="sm" value={f.value} onChange={(v) => onChange({ ...f, value: v })} step={f.type === "pct" ? 0.1 : 0.5} min={0} prefix={f.type === "flat" ? "$" : undefined} suffix={f.type === "pct" ? "%" : undefined} className="w-24" />
        <Segmented size="xs" value={f.type} onChange={(v) => onChange({ ...f, type: v })} options={[{ value: "flat", label: "$" }, { value: "pct", label: "%" }]} />
        {f.min !== undefined && <span className="k-num hidden text-[11px] text-fg-3 xl:inline">min ${f.min}{f.max ? ` · max $${f.max}` : ""}</span>}
      </div>
      <label className="flex items-center gap-2 text-[11.5px] text-fg-3">
        Broker absorbs
        <Toggle checked={f.absorbedByBroker} onChange={(v) => onChange({ ...f, absorbedByBroker: v })} />
      </label>
      <Toggle checked={f.enabled} onChange={(v) => onChange({ ...f, enabled: v })} label={`Enable ${f.label}`} />
    </div>
  );
}

export default function ChargesPage() {
  const [plans, setPlans] = React.useState<Plans>(COMMISSIONS);
  const [savedPlans, setSavedPlans] = React.useState<Plans>(COMMISSIONS);
  const [fees, setFees] = React.useState<FeeRule[]>(FEE_RULES);
  const [savedFees, setSavedFees] = React.useState<FeeRule[]>(FEE_RULES);
  const dirty = JSON.stringify(plans) !== JSON.stringify(savedPlans) || JSON.stringify(fees) !== JSON.stringify(savedFees);

  const setCell = (gid: string, c: AssetClass, cell: CommissionCell) => setPlans((p) => ({ ...p, [gid]: { ...p[gid]!, [c]: cell } }));
  const setRowCharge = (gid: string, on: ChargeOn) =>
    setPlans((p) => ({ ...p, [gid]: Object.fromEntries(Object.entries(p[gid]!).map(([k, v]) => [k, { ...v, chargeOn: on }])) as Record<AssetClass, CommissionCell> }));

  const revenue = [
    { label: "Forex", value: 412_880 },
    { label: "Metals", value: 188_410 },
    { label: "Indices", value: 96_220 },
    { label: "Energies", value: 41_880 },
    { label: "Crypto", value: 72_910 },
    { label: "Stocks", value: 18_402 },
  ];
  const revTotal = revenue.reduce((s, r) => s + r.value, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Charges & fees"
        subtitle="Commission plans per group and asset class, plus deposit, withdrawal, conversion and Islamic fees."
        actions={
          <>
            <Button
              variant="ghost"
              disabled={!dirty}
              onClick={() => {
                setPlans(savedPlans);
                setFees(savedFees);
                toast("Changes discarded");
              }}
            >
              <RotateCcw /> Discard
            </Button>
            <Button
              variant="ember"
              disabled={!dirty}
              onClick={() => {
                setSavedPlans(plans);
                setSavedFees(fees);
                auditToast("Charges published", "Effective for new deals from now");
              }}
            >
              <Save /> Save & publish
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Commission plans" subtitle="$ per lot (FX, metals, indices, energies) · % of notional (crypto, stocks)" action={<Chip tone="ember">{CFD_GROUPS.length} groups × {COMMISSION_CLASSES.length} classes</Chip>} />
            <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-fg-3">
                    <th className="rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left font-medium">Group</th>
                    <th className="border-y border-line bg-surface-2 px-2 py-3 text-left font-medium">Charged</th>
                    {COMMISSION_CLASSES.map((c, i) => (
                      <th key={c} className={cn("border-y border-line bg-surface-2 px-2 py-3 text-left font-medium", i === COMMISSION_CLASSES.length - 1 && "rounded-r-[14px] border-r")}>
                        {ASSET_CLASS_LABEL[c]} <span className="normal-case tracking-normal text-fg-3/70">{c === "crypto" || c === "stocks" ? "%" : "$/lot"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CFD_GROUPS.map((g) => {
                    const row = plans[g.id]!;
                    return (
                      <tr key={g.id} className="group">
                        <td className="border-b border-line px-4 py-2.5 group-hover:bg-surface-2/60">
                          <div className="font-medium">{g.name}</div>
                          <div className="whitespace-nowrap text-[11px] text-fg-3">{g.clients.toLocaleString()} clients</div>
                        </td>
                        <td className="border-b border-line px-2 py-2.5 group-hover:bg-surface-2/60">
                          <Segmented size="xs" value={rowCharge(row)} onChange={(v) => setRowCharge(g.id, v)} options={[{ value: "open", label: "Open" }, { value: "close", label: "Close" }, { value: "round", label: "RT" }]} />
                        </td>
                        {COMMISSION_CLASSES.map((c) => {
                          const cell = row[c];
                          const changed = JSON.stringify(cell) !== JSON.stringify(savedPlans[g.id]![c]);
                          return (
                            <td key={c} className="border-b border-line px-2 py-2.5 group-hover:bg-surface-2/60">
                              <NumInput
                                size="sm"
                                value={cell.perLot}
                                onChange={(v) => setCell(g.id, c, { ...cell, perLot: v })}
                                step={cell.unit === "per-lot" ? 0.5 : 0.01}
                                min={0}
                                prefix={cell.unit === "per-lot" ? "$" : undefined}
                                suffix={cell.unit === "per-lot" ? undefined : "%"}
                                className={cn("h-8 w-[78px]", changed && "border-ember/60 bg-ember-soft", cell.perLot === 0 && !changed && "text-fg-3")}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4 rounded-[14px] border border-dashed border-line p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <div>
                    <div className="k-label">Per-symbol overrides</div>
                    <div className="mt-0.5 text-[11.5px] text-fg-3">Take precedence over the class rate above</div>
                  </div>
                  <Button size="xs" variant="surface" onClick={() => toast.message("Pick a symbol and group", { description: "Overrides are edited from Symbols → contract spec → Commission." })}>
                    Add override
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ["XAUUSD", "ECN", "$10/lot RT"],
                    ["XAGUSD", "ECN", "$12/lot RT"],
                    ["BTCUSD", "VIP", "0.02%"],
                    ["NAS100", "Pro", "$0.5/lot open"],
                    ["USDJPY", "ECN", "$6/lot RT"],
                  ].map(([sym, g, v]) => (
                    <Chip key={sym + g} tone="neutral">
                      <span className="font-mono text-fg">{sym}</span> · {g} · <span className="text-ember">{v}</span>
                    </Chip>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[11.5px] text-fg-3">Round-turn (RT) splits the amount 50/50 between open and close. IB rebates are paid from commission first, then from markup — see Partners → Commission plans.</p>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <CommissionCalc plans={plans} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card>
            <CardHeader title="Payment & account fees" subtitle="Set a fee to 0 or toggle “Broker absorbs” to make it free for clients" />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {fees.map((f) => (
                <FeeRow key={f.id} f={f} onChange={(nf) => setFees((p) => p.map((x) => (x.id === nf.id ? nf : x)))} />
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Commission revenue" subtitle="Month to date by asset class" />
            <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4">
              <Donut
                data={revenue}
                size={190}
                thickness={20}
                center={
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-fg-3">MTD</div>
                    <Money value={revTotal} decimals={0} className="text-[20px] font-semibold" />
                  </div>
                }
              />
              <div className="w-full space-y-1.5">
                {revenue.map((r, i) => (
                  <div key={r.label} className="flex items-center justify-between text-[12.5px]">
                    <span className="inline-flex items-center gap-2 text-fg-2">
                      <span className="size-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                      {r.label}
                    </span>
                    <span className="k-num">
                      {formatMoney(r.value, "USD", 0)} <span className="text-fg-3">· {((r.value / revTotal) * 100).toFixed(1)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

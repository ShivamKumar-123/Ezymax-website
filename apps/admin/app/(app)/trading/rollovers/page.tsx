"use client";

import * as React from "react";
import { ArrowRight, CalendarClock, CheckCircle2, History, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, Segmented, SymbolAvatar, cn, formatMoney, formatNumber } from "@kalks/ui";
import { getInstrument } from "@kalks/mock";
import { ADMIN_NOW } from "@kalks/mock/admin-clients";
import { ROLLOVERS, type Rollover } from "@kalks/mock/admin-trading";
import { ReasonDialog } from "@/components/command/kit";

const DAY = 86_400_000;
const rollAt = (d: string) => Date.parse(`${d}T00:00:00+03:00`);
const daysTo = (d: string) => Math.ceil((rollAt(d) - ADMIN_NOW) / DAY);
const untilLabel = (d: string) => { const ms = rollAt(d) - ADMIN_NOW; return ms < DAY ? `in ${Math.max(1, Math.round(ms / 3_600_000))}h · 00:00 GMT+3` : `in ${Math.ceil(ms / DAY)} days`; };
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function adjustment(r: Rollover) {
  const inst = getInstrument(r.symbol);
  const gap = r.nextPrice - r.currentPrice;
  // swap adjustment: longs receive -(gap) × contract per lot, shorts the opposite — keeps P&L neutral across the roll
  const perLot = -gap * inst.contractSize;
  return { gap, gapPct: (gap / r.currentPrice) * 100, perLot, bookNet: -perLot * r.netLots };
}

function ApplyDialog({ r, open, onOpenChange, onApplied }: { r: Rollover; open: boolean; onOpenChange: (o: boolean) => void; onApplied: () => void }) {
  const a = adjustment(r);
  const [method, setMethod] = React.useState<Rollover["method"]>(r.method);
  const inst = getInstrument(r.symbol);
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      title={`Apply rollover · ${r.symbol}`}
      description={`${r.current} → ${r.next} · ${r.openPositions} open positions`}
      codes={["ROL-01 · Scheduled contract roll", "ROL-02 · Early roll (liquidity)", "ROL-03 · Correction of previous roll"]}
      confirmLabel="Apply rollover"
      successMessage={`${r.symbol} rolled to ${r.next.split(" ")[0]}`}
      onConfirm={onApplied}
    >
      <Segmented size="xs" value={method} onChange={setMethod} options={["Swap adjustment", "Price adjustment", "Close & reopen"] as const} />
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Current", formatNumber(r.currentPrice, inst.digits)],
          ["Next", formatNumber(r.nextPrice, inst.digits)],
          ["Gap", `${a.gap >= 0 ? "+" : ""}${formatNumber(a.gap, inst.digits)} (${a.gapPct.toFixed(2)}%)`],
        ].map(([k, v]) => (
          <div key={k} className="k-row px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
            <div className="k-num font-mono text-[14px]">{v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-[14px] border border-line bg-surface-2 p-4 text-[12.5px]">
        {method === "Swap adjustment" && (
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-fg-3">Long positions, per lot</span><span className={cn("k-num font-mono", a.perLot >= 0 ? "text-up" : "text-down")}>{a.perLot >= 0 ? "+" : ""}{formatMoney(a.perLot)}</span></div>
            <div className="flex justify-between"><span className="text-fg-3">Short positions, per lot</span><span className={cn("k-num font-mono", -a.perLot >= 0 ? "text-up" : "text-down")}>{-a.perLot >= 0 ? "+" : ""}{formatMoney(-a.perLot)}</span></div>
            <div className="flex justify-between border-t border-line pt-2"><span className="text-fg-3">Net client net lots</span><span className="k-num font-mono">{r.netLots}</span></div>
            <div className="flex justify-between"><span className="font-medium">Book cash impact</span><span className={cn("k-num font-mono font-semibold", a.bookNet >= 0 ? "text-up" : "text-down")}>{a.bookNet >= 0 ? "+" : ""}{formatMoney(a.bookNet)}</span></div>
            <p className="pt-1 text-[11.5px] text-fg-3">Open prices stay the same; the gap is booked as a swap line “Rollover {r.next.split(" ")[0]}” so floating P&L is unchanged across the roll.</p>
          </div>
        )}
        {method === "Price adjustment" && <p className="text-fg-2">All open prices, SL, TP and pending orders are shifted by {a.gap >= 0 ? "+" : ""}{formatNumber(a.gap, inst.digits)}. No cash adjustment; chart history is back-adjusted.</p>}
        {method === "Close & reopen" && <p className="text-fg-2">Positions are closed at the current contract price and reopened at the next contract price with the same volume. Realised P&L is booked; spread is waived.</p>}
      </div>
    </ReasonDialog>
  );
}

export default function RolloversPage() {
  const [rows, setRows] = React.useState(ROLLOVERS);
  const [target, setTarget] = React.useState<number | null>(null);
  const upcoming = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.status !== "applied");
  const history = rows.filter((r) => r.status === "applied");
  return (
    <div className="pb-10">
      <PageHeader
        title="Rollovers"
        subtitle="Futures-based CFDs roll to the next contract with a gap adjustment so client P&L is unaffected."
        actions={
          <Button variant="surface" size="lg" onClick={() => toast.success("Contract calendar synced", { description: "CME, ICE, Eurex, OSE · 6 symbols" })}>
            <RefreshCw /> Sync exchange calendar
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Due in 48h" icon={<CalendarClock />} value={<span className="k-num text-warn">{upcoming.filter(({ r }) => daysTo(r.rollDate) <= 2).length}</span>} chip="USOIL tonight 00:00 GMT+3" chipTone="warn" />
        <KpiCard label="Scheduled" icon={<Settings2 />} value={<span className="k-num">{upcoming.length}</span>} chip="Next 90 days" delay={0.04} />
        <KpiCard label="Positions affected" icon={<RefreshCw />} value={<span className="k-num">{upcoming.reduce((s, { r }) => s + r.openPositions, 0)}</span>} chip="across all rolls" delay={0.08} />
        <KpiCard label="Applied (30d)" icon={<History />} value={<span className="k-num">{history.length}</span>} chip="0 corrections" chipTone="up" delay={0.12} />
      </div>
      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Rollover schedule" subtitle="Roll executes at 00:00 GMT+3 on the roll date" />
          <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
                  {["Symbol", "Contract", "Roll date", "Price gap", "Method", "Positions", "Net lots", "Long adj. / lot", "Status", ""].map((h, i) => (
                    <th key={i} className={cn("border-y border-line bg-surface-2 px-3 py-2.5 text-left font-medium", i === 0 && "rounded-l-[14px] border-l pl-4", i === 9 && "rounded-r-[14px] border-r", [3, 5, 6, 7].includes(i) && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcoming.map(({ r, i }) => {
                  const a = adjustment(r);
                  const d = daysTo(r.rollDate);
                  const inst = getInstrument(r.symbol);
                  return (
                    <tr key={i} className="group">
                      <td className="border-b border-line py-3 pl-4 pr-3 group-hover:bg-surface-2/60">
                        <span className="flex items-center gap-2.5">
                          <SymbolAvatar symbol={r.symbol} size={26} />
                          <span>
                            <span className="block font-medium">{r.symbol}</span>
                            <span className="block text-[11px] text-fg-3">{r.underlying}</span>
                          </span>
                        </span>
                      </td>
                      <td className="border-b border-line px-3 group-hover:bg-surface-2/60">
                        <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[12px]">
                          {r.current} <ArrowRight className="size-3 text-fg-3" /> <span className="text-fg">{r.next}</span>
                        </span>
                      </td>
                      <td className="border-b border-line px-3 group-hover:bg-surface-2/60">
                        <span className="block whitespace-nowrap text-[12.5px]">{fmtDate(r.rollDate)}</span>
                        <span className={cn("text-[11px]", d <= 2 ? "text-warn" : "text-fg-3")}>{untilLabel(r.rollDate)}</span>
                      </td>
                      <td className="border-b border-line px-3 text-right group-hover:bg-surface-2/60">
                        <span className={cn("k-num block font-mono text-[12.5px]", a.gap >= 0 ? "text-up" : "text-down")}>{a.gap >= 0 ? "+" : ""}{formatNumber(a.gap, inst.digits)}</span>
                        <span className="k-num text-[11px] text-fg-3">{a.gapPct.toFixed(2)}%</span>
                      </td>
                      <td className="border-b border-line px-3 group-hover:bg-surface-2/60"><Chip size="sm">{r.method}</Chip></td>
                      <td className="k-num border-b border-line px-3 text-right group-hover:bg-surface-2/60">{r.openPositions}</td>
                      <td className={cn("k-num border-b border-line px-3 text-right font-mono group-hover:bg-surface-2/60", r.netLots >= 0 ? "text-up" : "text-down")}>{r.netLots > 0 ? "+" : ""}{r.netLots}</td>
                      <td className={cn("k-num border-b border-line px-3 text-right font-mono text-[12.5px] group-hover:bg-surface-2/60", a.perLot >= 0 ? "text-up" : "text-down")}>{a.perLot >= 0 ? "+" : ""}{formatMoney(a.perLot)}</td>
                      <td className="border-b border-line px-3 group-hover:bg-surface-2/60"><Chip size="sm" dot tone={r.status === "due" ? "warn" : "info"} className="capitalize">{r.status}</Chip></td>
                      <td className="border-b border-line py-2 pl-3 pr-3 text-right group-hover:bg-surface-2/60">
                        <Button size="xs" variant={r.status === "due" ? "ember" : "surface"} onClick={() => setTarget(i)}>
                          Apply rollover
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.15} className="mt-4">
        <Card>
          <CardHeader title="History" subtitle="Applied rollovers" icon={<History />} />
          <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
            {history.map((r, k) => {
              const a = adjustment(r);
              return (
                <div key={k} className="k-row flex flex-wrap items-center gap-4 px-4 py-3 text-[12.5px]">
                  <CheckCircle2 className="size-4 text-up" />
                  <SymbolAvatar symbol={r.symbol} size={22} />
                  <span className="font-medium">{r.symbol}</span>
                  <span className="font-mono text-fg-2">{r.current} → {r.next}</span>
                  <span className="text-fg-3">{fmtDate(r.rollDate)}</span>
                  <span className="text-fg-3">{r.method} · {r.openPositions} positions</span>
                  <span className={cn("k-num ml-auto font-mono", a.bookNet >= 0 ? "text-up" : "text-down")}>book {a.bookNet >= 0 ? "+" : ""}{formatMoney(a.bookNet)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>
      {target !== null && (
        <ApplyDialog
          r={rows[target]!}
          open
          onOpenChange={(o) => !o && setTarget(null)}
          onApplied={() => setRows((xs) => xs.map((x, k) => (k === target ? { ...x, status: "applied" } : x)))}
        />
      )}
    </div>
  );
}

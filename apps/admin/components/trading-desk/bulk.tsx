"use client";

import * as React from "react";
import { ArrowLeftRight, Crosshair, TrendingDown, TrendingUp, X, XCircle } from "lucide-react";
import { Button, Field, Input, Segmented, Toggle, cn, formatNumber } from "@kalks/ui";
import { positionPnl, useDesk, type Book, type DeskPosition, type QuoteFn } from "@/lib/trading-desk";
import { DeskDialog, MetaTile, signedMoney } from "./kit";

type Bulk = { k: "close"; which: "all" | "profit" | "loss" } | { k: "move"; to: Book } | { k: "sltp" } | null;

export function BulkBar({ selected, quote, onClear }: { selected: DeskPosition[]; quote: QuoteFn; onClear: () => void }) {
  const { api } = useDesk();
  const [act, setAct] = React.useState<Bulk>(null);
  const [force, setForce] = React.useState(false);
  const [amount, setAmount] = React.useState<"100" | "75" | "50" | "25">("100");
  const [slPct, setSlPct] = React.useState("");
  const [tpPct, setTpPct] = React.useState("");
  const [clear, setClear] = React.useState<"none" | "sl" | "tp" | "both">("none");

  const pnl = (p: DeskPosition) => positionPnl(p, quote(p.symbol));
  const lots = selected.reduce((s, p) => s + p.volume, 0);
  const total = selected.reduce((s, p) => s + pnl(p), 0);
  const winners = selected.filter((p) => pnl(p) > 0);
  const losers = selected.filter((p) => pnl(p) < 0);
  const aCount = selected.filter((p) => p.route === "A").length;

  const target = act?.k === "close" ? (act.which === "profit" ? winners : act.which === "loss" ? losers : selected) : act?.k === "move" ? selected.filter((p) => p.route !== act.to) : selected;
  const targetPnl = target.reduce((s, p) => s + pnl(p), 0);
  const close = () => setAct(null);

  if (!selected.length) return null;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[16px] border border-ember/30 bg-ember-soft/40 px-3 py-2">
        <span className="px-1 text-[12.5px]">
          <span className="k-num font-medium">{selected.length}</span> selected · <span className="k-num font-mono">{formatNumber(lots, 2)}</span> lots ·{" "}
          <span className={cn("k-num font-mono", total >= 0 ? "text-up" : "text-down")}>{signedMoney(total)}</span>
          <span className="text-fg-3"> · {aCount} A / {selected.length - aCount} B</span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="down-outline" onClick={() => setAct({ k: "close", which: "all" })}>
            <XCircle /> Close
          </Button>
          <Button size="xs" variant="surface" disabled={!winners.length} onClick={() => setAct({ k: "close", which: "profit" })}>
            <TrendingUp /> Close profitable ({winners.length})
          </Button>
          <Button size="xs" variant="surface" disabled={!losers.length} onClick={() => setAct({ k: "close", which: "loss" })}>
            <TrendingDown /> Close losing ({losers.length})
          </Button>
          <Button size="xs" variant="surface" onClick={() => setAct({ k: "move", to: "A" })}>
            <ArrowLeftRight /> Move to A
          </Button>
          <Button size="xs" variant="surface" onClick={() => setAct({ k: "move", to: "B" })}>
            <ArrowLeftRight /> Move to B
          </Button>
          <Button size="xs" variant="surface" onClick={() => setAct({ k: "sltp" })}>
            <Crosshair /> SL / TP
          </Button>
          <Button size="xs" variant="ghost" onClick={onClear} aria-label="Clear selection">
            <X /> Clear
          </Button>
        </div>
      </div>

      <DeskDialog
        open={act?.k === "close"}
        onOpenChange={(o) => !o && close()}
        title={act?.k === "close" ? `Close ${target.length} ${act.which === "profit" ? "profitable" : act.which === "loss" ? "losing" : ""} positions` : ""}
        description="Each ticket closes at the live market and gets its own audit entry."
        confirmLabel={`Close ${target.length} positions`}
        confirmVariant="sell"
        disabled={!target.length && "Nothing to close"}
        onConfirm={(r) => api.closeMany(target.map((p) => p.ticket), r, { force })}
        success={(d) => `${d.done.length} closed · ${signedMoney(d.profit)}${d.failed.length ? ` · ${d.failed.length} skipped (${d.failed[0]!.error})` : ""}`}
      >
        <div className="grid grid-cols-3 gap-2">
          <MetaTile label="Positions" value={target.length} />
          <MetaTile label="Lots" value={formatNumber(target.reduce((s, p) => s + p.volume, 0), 2)} />
          <MetaTile label="Client P&L" value={signedMoney(targetPnl)} tone={targetPnl >= 0 ? "up" : "down"} />
        </div>
        <label className="flex items-center justify-between rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px]">
          <span>
            <span className="font-medium">Force close</span> <span className="text-fg-3">— also closes halted symbols</span>
          </span>
          <Toggle checked={force} onChange={setForce} label="Force close" />
        </label>
      </DeskDialog>

      <DeskDialog
        open={act?.k === "move"}
        onOpenChange={(o) => !o && close()}
        title={act?.k === "move" ? `Move ${target.length} positions to ${act.to}-book` : ""}
        description="Partial percentages split each ticket: the original keeps the rest on its book, a linked child ticket carries the moved volume."
        confirmLabel={act?.k === "move" ? `Move ${amount === "100" ? "all" : `${amount}%`} to ${act.to}-book` : "Move"}
        disabled={!target.length && "All selected positions are already on that book"}
        onConfirm={(r) => api.transferBook(target.map((p) => p.ticket), act?.k === "move" ? act.to : "A", r, amount === "100" ? {} : { pct: Number(amount) })}
        success={(d) => `${d.done.length} moved${d.created.length ? ` · ${d.created.length} split tickets` : ""}${d.failed.length ? ` · ${d.failed.length} skipped` : ""}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-medium text-fg-2">Volume to move</span>
          <Segmented size="sm" value={amount} onChange={setAmount} options={[{ value: "100", label: "Full" }, { value: "75", label: "75%" }, { value: "50", label: "50%" }, { value: "25", label: "25%" }]} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MetaTile label="Positions" value={target.length} />
          <MetaTile label="Lots moved" value={formatNumber((target.reduce((s, p) => s + p.volume, 0) * Number(amount)) / 100, 2)} />
          <MetaTile label="Already there" value={selected.length - target.length} />
        </div>
      </DeskDialog>

      <DeskDialog
        open={act?.k === "sltp"}
        onOpenChange={(o) => !o && close()}
        title={`Modify SL / TP on ${selected.length} positions`}
        description="Distances are measured from each position’s current close price (bid for buys, ask for sells)."
        confirmLabel="Apply to all"
        disabled={!slPct && !tpPct && clear === "none" && "Set a distance or choose what to remove"}
        onConfirm={(r) => api.modifyMany(selected.map((p) => p.ticket), { slPct: Number(slPct) || null, tpPct: Number(tpPct) || null, clear: clear === "none" ? undefined : clear }, r)}
        success={(d) => `SL/TP updated on ${d.done.length} positions`}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stop loss distance" hint="% from market">
            <Input value={slPct} onChange={(e) => setSlPct(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 0.5" trailing="%" aria-label="Stop loss distance" className="font-mono" />
          </Field>
          <Field label="Take profit distance" hint="% from market">
            <Input value={tpPct} onChange={(e) => setTpPct(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 1.0" trailing="%" aria-label="Take profit distance" className="font-mono" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-medium text-fg-2">Remove</span>
          <Segmented size="sm" value={clear} onChange={setClear} options={[{ value: "none", label: "Nothing" }, { value: "sl", label: "SL" }, { value: "tp", label: "TP" }, { value: "both", label: "Both" }]} />
        </div>
      </DeskDialog>
    </>
  );
}

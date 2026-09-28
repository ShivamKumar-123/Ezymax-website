"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Edit3, Layers, Scissors, Share2, X, XCircle } from "lucide-react";
import { getInstrument } from "@kalks/mock";
import { SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useMetrics, useTerminal } from "@/lib/store";
import { PENDING_LABEL, SOURCE_LABEL, accCcy, accMoney, fmtPrice, fmtServer, fmtVol, profitUsd, type PendingOrder, type TPosition } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { Pnl, LiveMoney } from "@/components/ui/primitives";
import { useContextMenu, type MenuItem } from "@/components/ui/menu";
import { PickBox } from "@/components/share/share-dialogs";
import { shareUi, useShareUi } from "@/lib/share";

export function bulkMenu(T: ReturnType<typeof useTerminal>): MenuItem[] {
  const syms = [...new Set(T.positions.map((p) => p.symbol))];
  return [
    { label: "Close all positions", icon: <XCircle />, danger: true, disabled: !T.positions.length, onSelect: () => T.bulkClose("all") },
    { label: "Close profitable", tone: "up", disabled: !T.positions.length, onSelect: () => T.bulkClose("profit") },
    { label: "Close losing", tone: "down", disabled: !T.positions.length, onSelect: () => T.bulkClose("loss") },
    { label: "Close all buys", disabled: !T.positions.some((p) => p.side === "buy"), onSelect: () => T.bulkClose("buys") },
    { label: "Close all sells", disabled: !T.positions.some((p) => p.side === "sell"), onSelect: () => T.bulkClose("sells") },
    { label: "Close by symbol", disabled: !syms.length, items: syms.map((s) => ({ label: `${s} (${T.positions.filter((p) => p.symbol === s).length})`, onSelect: () => T.bulkClose("symbol", s) })) },
    "sep",
    { label: "Cancel all pending orders", icon: <X />, disabled: !T.pendings.length, onSelect: () => T.cancelAllPendings() },
  ];
}

export function TradeTab() {
  const T = useTerminal();
  const cm = useContextMenu(230);
  const [sel, setSel] = React.useState<string | null>(null);
  const hedging = T.account.mode === "hedging";
  const picking = useShareUi().selecting;

  const posMenu = (p: TPosition): MenuItem[] => {
    const opp = T.positions.filter((x) => x.symbol === p.symbol && x.side !== p.side);
    return [
      { label: `Close #${p.ticket}`, icon: <X />, danger: true, onSelect: () => T.closePosition(p.ticket) },
      { label: "Close partial…", icon: <Scissors />, onSelect: () => T.setUi({ positionDialog: p.ticket }) },
      { label: "Close 50%", disabled: p.volume < 0.02, onSelect: () => T.closePosition(p.ticket, Math.max(0.01, Math.floor((p.volume / 2) * 100) / 100)) },
      { label: "Modify or Delete…", icon: <Edit3 />, onSelect: () => T.setUi({ positionDialog: p.ticket }) },
      { label: "Move SL to breakeven", onSelect: () => T.modifyPosition(p.ticket, { sl: p.openPrice }) },
      ...(hedging ? [{ label: "Close By", icon: <ArrowLeftRight />, disabled: !opp.length, items: opp.map((o) => ({ label: `#${o.ticket} ${o.side} ${fmtVol(o.volume)} at ${fmtPrice(o.symbol, o.openPrice)}`, onSelect: () => T.closeBy(p.ticket, o.ticket) })) } as MenuItem] : []),
      "sep",
      { label: "Share this trade…", icon: <Share2 />, onSelect: () => shareUi.shareOne(p.ticket) },
      { label: "Bulk close", icon: <Layers />, items: bulkMenu(T) },
      "sep",
      { label: "Show on chart", onSelect: () => T.openSymbol(p.symbol) },
      { label: "Copy ticket", onSelect: () => (navigator.clipboard?.writeText(p.ticket).catch(() => {}), toast("Ticket copied", { description: `#${p.ticket}` })) },
    ];
  };
  const ordMenu = (o: PendingOrder): MenuItem[] => [
    { label: "Modify or Delete…", icon: <Edit3 />, onSelect: () => T.setUi({ pendingDialog: o.ticket }) },
    { label: `Delete #${o.ticket}`, icon: <X />, danger: true, onSelect: () => T.cancelPending(o.ticket) },
    "sep",
    { label: "Cancel all pending orders", onSelect: () => T.cancelAllPendings() },
    { label: "Share this order…", icon: <Share2 />, onSelect: () => shareUi.shareOne(o.ticket) },
    { label: "Show on chart", onSelect: () => T.openSymbol(o.symbol) },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1120px] border-separate border-spacing-0">
          <thead>
            <tr>
              {picking && <Th className="w-7 pl-3" />}
              <Th className={picking ? undefined : "pl-3"}>Symbol</Th>
              <Th>Ticket</Th>
              <Th>Time</Th>
              <Th>Type</Th>
              <Th right>Volume</Th>
              <Th right>Price</Th>
              <Th right>S / L</Th>
              <Th right>T / P</Th>
              <Th right>Price</Th>
              <Th right>Swap</Th>
              <Th right>Commission</Th>
              <Th right>Profit</Th>
              <Th>Comment</Th>
              <Th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {T.positions.map((p) => (
              <PositionRow
                key={p.ticket}
                p={p}
                picking={picking}
                selected={sel === p.ticket}
                onSelect={() => setSel(p.ticket)}
                onOpen={() => !T.readOnly && T.setUi({ positionDialog: p.ticket })}
                onContext={(e) => {
                  setSel(p.ticket);
                  if (T.readOnly) return e.preventDefault();
                  cm.open(e, posMenu(p), `#${p.ticket} ${p.side} ${fmtVol(p.volume)} ${p.symbol}`);
                }}
              />
            ))}
            {T.positions.length === 0 && (
              <tr>
                <td colSpan={picking ? 15 : 14} className="h-12 border-b border-line/60 text-center text-[12px] text-fg-3">
                  No open positions{T.readOnly ? "" : " · press F9 or use the one-click panel on a chart"}
                </td>
              </tr>
            )}
            {T.pendings.map((o) => (
              <PendingRow
                key={o.ticket}
                o={o}
                picking={picking}
                selected={sel === o.ticket}
                onSelect={() => setSel(o.ticket)}
                onOpen={() => !T.readOnly && T.setUi({ pendingDialog: o.ticket })}
                onContext={(e) => {
                  setSel(o.ticket);
                  if (T.readOnly) return e.preventDefault();
                  cm.open(e, ordMenu(o), `#${o.ticket} ${PENDING_LABEL(o)}`);
                }}
              />
            ))}
          </tbody>
          <tfoot>
            <SummaryRow picking={picking} />
          </tfoot>
        </table>
      </div>
      {cm.node}
    </div>
  );
}

function SummaryRow({ picking }: { picking?: boolean }) {
  const m = useMetrics();
  const a = m.account;
  const ccy = accCcy(a);
  const lvl = Number.isFinite(m.level) ? `${m.level.toFixed(2)}%` : "—";
  return (
    <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:z-[1] [&>td]:border-t [&>td]:border-line [&>td]:bg-panel-2">
      <td colSpan={picking ? 12 : 11} className="h-[28px] whitespace-nowrap pl-3 text-[12px]">
        <span className="flex items-center gap-4 font-mono text-fg-2">
          <SumItem k="Balance" v={`${accMoney(a, m.balance)} ${ccy}`} />
          <SumItem k="Equity" v={accMoney(a, m.equity)} live={m.equity} fmt={(v) => accMoney(a, v)} />
          <SumItem k="Margin" v={accMoney(a, m.margin)} />
          <SumItem k="Free margin" v={accMoney(a, m.free)} live={m.free} fmt={(v) => accMoney(a, v)} />
          <SumItem k="Margin level" v={lvl} tone={Number.isFinite(m.level) && m.level < 200 ? "text-warn" : undefined} />
          {m.credit > 0 && <SumItem k="Credit" v={accMoney(a, m.credit)} />}
        </span>
      </td>
      <td className="h-[28px] whitespace-nowrap px-2 text-right text-[12px] font-semibold">
        <Pnl value={m.floating} text={accMoney(a, m.floating, { signed: false })} format={(v) => accMoney(a, v, { signed: false })} arrow />
      </td>
      <td colSpan={2} />
    </tr>
  );
}

function SumItem({ k, v, tone, live, fmt }: { k: string; v: string; tone?: string; live?: number; fmt?: (v: number) => string }) {
  return (
    <span className="k-num">
      <span className="font-sans text-fg-3">{k}:</span>{" "}
      {live !== undefined && fmt ? <LiveMoney value={live} format={fmt} className={cn("px-0.5 text-fg", tone)} /> : <span className={cn("text-fg", tone)}>{v}</span>}
    </span>
  );
}

const PositionRow = React.memo(function PositionRow({ p, picking, selected, onSelect, onOpen, onContext }: { p: TPosition; picking?: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; onContext: (e: React.MouseEvent) => void }) {
  const T = useTerminal();
  const q = useQuote(p.symbol);
  const a = T.account;
  const cur = p.side === "buy" ? q.bid : q.ask;
  const pr = profitUsd(p, q.bid, q.ask);
  const digits = getInstrument(p.symbol).digits;
  return (
    <tr onClick={picking ? () => shareUi.toggle(p.ticket) : onSelect} onDoubleClick={onOpen} onContextMenu={onContext} className={cn("group cursor-default", selected ? "bg-ember-soft/50" : "hover:bg-surface-2/70")}>
      {picking && (
        <Td className="w-7 pl-3">
          <PickBox ticket={p.ticket} />
        </Td>
      )}
      <Td className={cn(!picking && "pl-3", selected && "shadow-[inset_2px_0_0_var(--k-ember)]")}>
        <span className="flex items-center gap-1.5 font-medium">
          <SymbolAvatar symbol={p.symbol} size={14} />
          {p.symbol}
        </span>
      </Td>
      <Td mono className="text-fg-3">
        {p.ticket}
      </Td>
      <Td mono className="text-fg-3">
        {fmtServer(p.openTime)}
      </Td>
      <Td>
        <span className={cn("font-medium", p.side === "buy" ? "text-up" : "text-down")}>{p.side}</span>
      </Td>
      <Td right mono>
        {fmtVol(p.volume)}
      </Td>
      <Td right mono className="text-fg-2">
        {p.openPrice.toFixed(digits)}
      </Td>
      <Td right mono className={p.sl !== undefined ? "text-down/90" : "text-fg-3"}>
        {p.sl !== undefined ? p.sl.toFixed(digits) : "—"}
        {p.trailing ? <span className="ml-1 rounded-[3px] bg-surface-3 px-0.5 text-[9px] text-fg-2">TS</span> : null}
      </Td>
      <Td right mono className={p.tp !== undefined ? "text-up/90" : "text-fg-3"}>
        {p.tp !== undefined ? p.tp.toFixed(digits) : "—"}
      </Td>
      <Td right mono className="text-fg">
        {cur.toFixed(digits)}
      </Td>
      <Td right mono className="text-fg-2">
        {accMoney(a, p.swap)}
      </Td>
      <Td right mono className="text-fg-2">
        {accMoney(a, -p.commission)}
      </Td>
      <Td right className="font-semibold">
        <Pnl value={pr} text={accMoney(a, pr)} format={(v) => accMoney(a, v)} arrow />
      </Td>
      <Td className="max-w-[140px] truncate text-fg-3">
        <span className="rounded-[3px] bg-surface-3 px-1 py-px text-[10px] uppercase tracking-[0.04em] text-fg-2">{SOURCE_LABEL[p.source]}</span>
        {p.comment && <span className="ml-1.5">{p.comment}</span>}
      </Td>
      <Td className="w-8 pr-2">
        {!T.readOnly && (
          <button onClick={(e) => (e.stopPropagation(), T.closePosition(p.ticket))} aria-label={`Close position ${p.ticket}`} title="Close position" className="grid size-5 place-items-center rounded-[4px] text-fg-3 opacity-60 hover:bg-down-soft hover:text-down group-hover:opacity-100">
            <X className="size-3.5" />
          </button>
        )}
      </Td>
    </tr>
  );
});

function PendingRow({ o, picking, selected, onSelect, onOpen, onContext }: { o: PendingOrder; picking?: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; onContext: (e: React.MouseEvent) => void }) {
  const T = useTerminal();
  const q = useQuote(o.symbol);
  const digits = getInstrument(o.symbol).digits;
  const cur = o.side === "buy" ? q.ask : q.bid;
  return (
    <tr onClick={picking ? () => shareUi.toggle(o.ticket) : onSelect} onDoubleClick={onOpen} onContextMenu={onContext} className={cn("group cursor-default", selected ? "bg-ember-soft/50" : "hover:bg-surface-2/70")}>
      {picking && (
        <Td className="w-7 pl-3">
          <PickBox ticket={o.ticket} />
        </Td>
      )}
      <Td className={cn(!picking && "pl-3", selected && "shadow-[inset_2px_0_0_var(--k-ember)]")}>
        <span className="flex items-center gap-1.5 font-medium text-fg-2">
          <SymbolAvatar symbol={o.symbol} size={14} />
          {o.symbol}
        </span>
      </Td>
      <Td mono className="text-fg-3">
        {o.ticket}
      </Td>
      <Td mono className="text-fg-3">
        {fmtServer(o.placed)}
      </Td>
      <Td>
        <span className={cn(o.side === "buy" ? "text-up" : "text-down")}>{PENDING_LABEL(o)}</span>
        {o.oco && <span className="ml-1 rounded-[3px] bg-gold-soft px-1 text-[9px] font-semibold text-gold">OCO</span>}
      </Td>
      <Td right mono>
        {fmtVol(o.volume)} / 0.00
      </Td>
      <Td right mono className="text-gold">
        {o.price.toFixed(digits)}
        {o.stopLimit !== undefined && <span className="text-fg-3"> → {o.stopLimit.toFixed(digits)}</span>}
      </Td>
      <Td right mono className={o.sl !== undefined ? "text-down/90" : "text-fg-3"}>
        {o.sl !== undefined ? o.sl.toFixed(digits) : "—"}
      </Td>
      <Td right mono className={o.tp !== undefined ? "text-up/90" : "text-fg-3"}>
        {o.tp !== undefined ? o.tp.toFixed(digits) : "—"}
      </Td>
      <Td right mono className="text-fg">
        {cur.toFixed(digits)}
      </Td>
      <Td right mono className="text-fg-3" />
      <Td right mono className="text-fg-3">
        {o.expiry === "Date" ? o.expiryDate : o.expiry}
      </Td>
      <Td right mono className="text-fg-3">
        placed
      </Td>
      <Td className="text-fg-3">
        <span className="rounded-[3px] bg-surface-3 px-1 py-px text-[10px] uppercase tracking-[0.04em] text-fg-2">{SOURCE_LABEL[o.source]}</span>
        {o.comment && <span className="ml-1.5">{o.comment}</span>}
      </Td>
      <Td className="w-8 pr-2">
        {!T.readOnly && (
          <button onClick={(e) => (e.stopPropagation(), T.cancelPending(o.ticket))} aria-label={`Delete order ${o.ticket}`} title="Delete order" className="grid size-5 place-items-center rounded-[4px] text-fg-3 opacity-60 hover:bg-down-soft hover:text-down group-hover:opacity-100">
            <X className="size-3.5" />
          </button>
        )}
      </Td>
    </tr>
  );
}


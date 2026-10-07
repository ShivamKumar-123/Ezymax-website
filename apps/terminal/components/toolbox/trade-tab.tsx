"use client";

// Positions and Orders tabs of the activity panel (docs/TERMINAL-DESIGN.md §2.4 Tables): one row per trade with the
// market, side, volume, open → current price, inline-editable stop loss / take profit, a big P&L and a visible Close
// button. Everything else (partial close, breakeven, close by, share, copy ticket…) is in the ⋯ menu, which is the
// same as the right-click menu.
import * as React from "react";
import { toast } from "@/lib/notify";
import { ArrowLeftRight, Check, Crosshair, Edit3, Layers, MoreHorizontal, Plus, Scissors, Share2, ShoppingCart, X, XCircle } from "lucide-react";
import { getInstrument, priceFeed } from "@kalks/mock";
import { SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { usePositionProfit, useTerminal } from "@/lib/store";
import { PENDING_LABEL, SOURCE_LABEL, accMoney, fmtPrice, fmtServer, fmtVol, pipSize, profitAt, type PendingOrder, type TPosition } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { Pnl, Stepper } from "@/components/ui/primitives";
import { Button, EmptyState, HelpTip, IconButton, Tip } from "@/components/ui/kit";
import { useContextMenu, type MenuItem } from "@/components/ui/menu";
import { PickBox } from "@/components/share/share-dialogs";
import { shareUi, useShareUi } from "@/lib/share";
import { askConfirm } from "@/components/dialogs/confirm";
import { tr, useT } from "@kalks/i18n/react";
import type { T as Translate } from "@kalks/i18n";

/** Translated trade direction, order type and source labels (lowercase as in MT5). */
export const sideLabel = (t: Translate, side: string) => t.dyn(`toolbox.side.${side}`, side);
export const pendingLabel = (t: Translate, o: Pick<PendingOrder, "side" | "type">) => t.dyn(`toolbox.orderType.${o.side}.${o.type === "stop-limit" ? "stopLimit" : o.type}`, PENDING_LABEL(o));
export const sourceLabel = (t: Translate, s: TPosition["source"]) => t.dyn(`toolbox.source.${s}`, SOURCE_LABEL[s]);

/** "Close positions ▾" menu (activity panel header, ⋯ menus): every bulk action asks for confirmation first. */
export function bulkMenu(T: ReturnType<typeof useTerminal>): MenuItem[] {
  const syms = [...new Set(T.positions.map((p) => p.symbol))];
  const n = T.positions.length;
  const ask = (label: string, all: boolean, run: () => void) => () => askConfirm({ title: `${label}?`, text: all ? tr("desk.cf.closeAllText", { count: n }) : tr("desk.cf.closeSomeText"), confirmLabel: label, run });
  return [
    { label: tr("toolbox.bulk.closeAll"), icon: <XCircle />, danger: true, disabled: !n, onSelect: ask(tr("toolbox.bulk.closeAll"), true, () => T.bulkClose("all")) },
    { label: tr("toolbox.bulk.closeProfitable"), tone: "up", disabled: !n, onSelect: ask(tr("toolbox.bulk.closeProfitable"), false, () => T.bulkClose("profit")) },
    { label: tr("toolbox.bulk.closeLosing"), tone: "down", disabled: !n, onSelect: ask(tr("toolbox.bulk.closeLosing"), false, () => T.bulkClose("loss")) },
    { label: tr("toolbox.bulk.closeBuys"), disabled: !T.positions.some((p) => p.side === "buy"), onSelect: ask(tr("toolbox.bulk.closeBuys"), false, () => T.bulkClose("buys")) },
    { label: tr("toolbox.bulk.closeSells"), disabled: !T.positions.some((p) => p.side === "sell"), onSelect: ask(tr("toolbox.bulk.closeSells"), false, () => T.bulkClose("sells")) },
    { label: tr("toolbox.bulk.closeBySymbol"), disabled: !syms.length, items: syms.map((s) => ({ label: `${s} (${T.positions.filter((p) => p.symbol === s).length})`, onSelect: ask(`${tr("toolbox.bulk.closeBySymbol")}: ${s}`, false, () => T.bulkClose("symbol", s)) })) },
    "sep",
    { label: tr("desk.act.breakevenAll"), disabled: !n, onSelect: () => T.positions.forEach((p) => T.modifyPosition(p.ticket, { sl: p.openPrice })) },
    { label: tr("toolbox.bulk.cancelPendings"), icon: <X />, disabled: !T.pendings.length, onSelect: () => askConfirm({ title: `${tr("toolbox.bulk.cancelPendings")}?`, text: tr("desk.cf.cancelText", { count: T.pendings.length }), confirmLabel: tr("toolbox.bulk.cancelPendings"), run: () => T.cancelAllPendings() }) },
  ];
}

/** Opens the order form (popup) for the active market, market or pending (empty states). */
export function focusTicket(T: ReturnType<typeof useTerminal>, pending = false) {
  T.openNewOrder({ symbol: T.activeSymbol, type: pending ? "limit" : "market" });
}

export function SideChip({ side, className }: { side: "buy" | "sell"; className?: string }) {
  const t = useT();
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11.5px] font-semibold", side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down", className)}>{side === "buy" ? t("desk.pos.buy") : t("desk.pos.sell")}</span>;
}

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

export function PositionsTab() {
  const T = useTerminal();
  const t = useT();
  const cm = useContextMenu(260);
  const [sel, setSel] = React.useState<string | null>(null);
  const hedging = T.account.mode === "hedging";
  const picking = useShareUi().selecting;

  const posMenu = (p: TPosition): MenuItem[] => {
    const opp = T.positions.filter((x) => x.symbol === p.symbol && x.side !== p.side);
    return [
      { label: t("toolbox.menu.closeTicket", { ticket: p.ticket }), icon: <X />, danger: true, onSelect: () => T.closePosition(p.ticket) },
      { label: t("toolbox.menu.closePartial"), icon: <Scissors />, onSelect: () => T.setUi({ positionDialog: p.ticket }) },
      { label: t("toolbox.menu.close50"), disabled: p.volume < 0.02, onSelect: () => T.closePosition(p.ticket, Math.max(0.01, Math.floor((p.volume / 2) * 100) / 100)) },
      { label: t("toolbox.menu.modifyOrDelete"), icon: <Edit3 />, onSelect: () => T.setUi({ positionDialog: p.ticket }) },
      { label: t("toolbox.menu.moveSlBreakeven"), onSelect: () => T.modifyPosition(p.ticket, { sl: p.openPrice }) },
      ...(hedging ? [{ label: t("toolbox.menu.closeBy"), icon: <ArrowLeftRight />, disabled: !opp.length, items: opp.map((o) => ({ label: t("toolbox.menu.closeByItem", { ticket: o.ticket, side: sideLabel(t, o.side), volume: fmtVol(o.volume), price: fmtPrice(o.symbol, o.openPrice) }), onSelect: () => T.closeBy(p.ticket, o.ticket) })) } as MenuItem] : []),
      "sep",
      { label: t("toolbox.menu.shareTrade"), icon: <Share2 />, onSelect: () => shareUi.shareOne(p.ticket) },
      { label: t("desk.act.closeMenu"), icon: <Layers />, items: bulkMenu(T) },
      "sep",
      { label: t("toolbox.menu.showOnChart"), icon: <Crosshair />, onSelect: () => T.openSymbol(p.symbol) },
      { label: t("toolbox.menu.copyTicket"), onSelect: () => (navigator.clipboard?.writeText(p.ticket).catch(() => {}), toast(t("toolbox.toast.ticketCopied"), { description: `#${p.ticket}` })) },
    ];
  };
  const title = (p: TPosition) => `#${p.ticket} ${sideLabel(t, p.side)} ${fmtVol(p.volume)} ${p.symbol}`;

  if (!T.positions.length)
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title={t("desk.pos.emptyTitle")}
        text={T.readOnly ? t("desk.pos.emptyRo") : t("desk.pos.emptyText")}
        action={
          !T.readOnly && (
            <Button variant="primary" onClick={() => focusTicket(T)}>
              {t("desk.pos.emptyAction")}
            </Button>
          )
        }
      />
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1020px] border-separate border-spacing-0">
          <thead>
            <tr>
              {picking && <Th className="w-8 ps-3" />}
              <Th className={picking ? undefined : "ps-3"}>{t("desk.pos.col.market")}</Th>
              <Th>{t("desk.pos.col.opened")}</Th>
              <Th>{t("desk.pos.col.side")}</Th>
              <Th right>{t("desk.pos.col.volume")}</Th>
              <Th right>{t("desk.pos.col.openCurrent")}</Th>
              <Th>{t("desk.pos.col.sl")}</Th>
              <Th>{t("desk.pos.col.tp")}</Th>
              <Th right>
                <span className="inline-flex items-center gap-1">
                  {t("desk.pos.col.swap")}
                  <HelpTip title={t("desk.g.swap.t")} text={t("desk.g.swap")} side="bottom" />
                </span>
              </Th>
              <Th right>
                <span className="inline-flex items-center gap-1">
                  {t("desk.pos.col.commission")}
                  <HelpTip title={t("desk.g.commission.t")} text={t("desk.g.commission")} side="bottom" />
                </span>
              </Th>
              <Th right>{t("desk.pos.col.pnl")}</Th>
              <Th className="w-[140px]" />
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
                onMenu={(e) => {
                  setSel(p.ticket);
                  if (T.readOnly) return e.preventDefault?.();
                  cm.open(e, posMenu(p), title(p));
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
      {cm.node}
    </div>
  );
}

const PositionRow = React.memo(function PositionRow({ p, picking, selected, onSelect, onOpen, onMenu }: { p: TPosition; picking?: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; onMenu: (e: React.MouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }) => void }) {
  const T = useTerminal();
  const t = useT();
  const q = useQuote(p.symbol);
  const a = T.account;
  const cur = p.side === "buy" ? q.bid : q.ask;
  const pr = usePositionProfit(p);
  const digits = getInstrument(p.symbol).digits;
  const moved = (p.side === "buy" ? cur - p.openPrice : p.openPrice - cur) >= 0;
  return (
    <tr onClick={picking ? () => shareUi.toggle(p.ticket) : onSelect} onDoubleClick={onOpen} onContextMenu={onMenu} className={cn("group cursor-default", selected ? "bg-ember-soft/40" : "hover:bg-surface-2/70")}>
      {picking && (
        <Td className="w-8 ps-3">
          <PickBox ticket={p.ticket} />
        </Td>
      )}
      <Td className={cn(!picking && "ps-3", selected && "shadow-[inset_2px_0_0_var(--k-ember)]")}>
        <button type="button" onClick={(e) => (e.stopPropagation(), T.openSymbol(p.symbol))} className="flex items-center gap-2 text-start" title={t("toolbox.menu.showOnChart")}>
          <SymbolAvatar symbol={p.symbol} size={16} />
          <span className="text-[13px] font-semibold text-fg">{p.symbol}</span>
          <span className="font-mono text-[11.5px] text-fg-3">#{p.ticket}</span>
          {p.source !== "manual" && <span className="rounded-[4px] bg-surface-3 px-1 text-[10.5px] font-medium text-fg-2">{sourceLabel(t, p.source)}</span>}
          {p.comment && <span className="max-w-[120px] truncate text-[11.5px] text-fg-3">{p.comment}</span>}
        </button>
      </Td>
      <Td mono className="text-[12px] text-fg-3">
        {fmtServer(p.openTime, false).slice(5)}
      </Td>
      <Td>
        <SideChip side={p.side} />
      </Td>
      <Td right mono>
        {fmtVol(p.volume)}
      </Td>
      <Td right mono>
        <span dir="ltr" className="whitespace-nowrap">
          <span className="text-fg-2">{p.openPrice.toFixed(digits)}</span>
          <span className="mx-1 text-fg-3">→</span>
          <span className={moved ? "text-up" : "text-down"}>{cur.toFixed(digits)}</span>
        </span>
      </Td>
      <Td className="py-0.5">
        <InlineStop p={p} kind="sl" />
      </Td>
      <Td className="py-0.5">
        <InlineStop p={p} kind="tp" />
      </Td>
      <Td right mono className="text-fg-2">
        <span dir="ltr">{accMoney(a, p.swap)}</span>
      </Td>
      <Td right mono className="text-fg-2">
        <span dir="ltr">{accMoney(a, -p.commission)}</span>
      </Td>
      <Td right className="text-[13px] font-semibold">
        <span dir="ltr">
          <Pnl value={pr} text={accMoney(a, pr, { signed: true })} format={(v) => accMoney(a, v, { signed: true })} arrow />
        </span>
      </Td>
      <Td className="pe-2">
        {!T.readOnly && (
          <span className="flex items-center justify-end gap-1">
            <Button size="sm" variant="secondary" tip={t("desk.pos.closeTip", { ticket: p.ticket })} onClick={(e) => (e.stopPropagation(), T.closePosition(p.ticket))} aria-label={t("toolbox.trade.closePositionAria", { ticket: p.ticket })} className="hover:border-down/40 hover:bg-down-soft hover:text-down">
              <X /> {t("desk.pos.close")}
            </Button>
            <IconButton
              size="sm"
              label={t("desk.pos.more")}
              tipSide="left"
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                onMenu({ clientX: r.right, clientY: r.bottom + 4 });
              }}
            >
              <MoreHorizontal />
            </IconButton>
          </span>
        )}
      </Td>
    </tr>
  );
});

/** Stop loss / take profit cell: the price and the money at that price, or "Add"; click to edit in place. */
function InlineStop({ p, kind }: { p: TPosition; kind: "sl" | "tp" }) {
  const T = useTerminal();
  const t = useT();
  const inst = getInstrument(p.symbol);
  const pip = pipSize(inst);
  const value = kind === "sl" ? p.sl : p.tp;
  const [edit, setEdit] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const a = T.account;
  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (T.readOnly) return;
    if (value !== undefined) return setEdit(fmtPrice(p.symbol, value));
    // a starting distance from the current close price: 20 pips for a stop loss, 40 for a take profit
    const q = priceFeed().quote(p.symbol);
    const dir = (kind === "tp" ? 1 : -1) * (p.side === "buy" ? 1 : -1);
    const base = p.side === "buy" ? q.bid : q.ask;
    setEdit(fmtPrice(p.symbol, base + dir * (kind === "tp" ? 40 : 20) * pip));
  };
  const save = async (v: number | null) => {
    setBusy(true);
    const ok = await T.modifyPosition(p.ticket, kind === "sl" ? { sl: v } : { tp: v });
    setBusy(false);
    if (ok) setEdit(null);
  };
  if (edit !== null) {
    const n = parseFloat(edit);
    return (
      <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <Stepper size="md" value={edit} onChange={setEdit} step={pip} decimals={inst.digits} tone={kind === "sl" ? "down" : "up"} ariaLabel={kind === "sl" ? t("desk.pos.setSl") : t("desk.pos.setTp")} className="h-6 w-[120px]" onCommit={() => void save(Number.isFinite(n) && n > 0 ? n : null)} />
        <IconButton size="sm" label={t("desk.pos.save")} disabled={busy} onClick={() => void save(Number.isFinite(n) && n > 0 ? n : null)} className="text-up hover:text-up">
          <Check />
        </IconButton>
        <IconButton size="sm" label={t("desk.pos.discard")} onClick={() => setEdit(null)}>
          <X />
        </IconButton>
      </span>
    );
  }
  if (value === undefined)
    return T.readOnly ? (
      <span className="text-fg-3">—</span>
    ) : (
      <button type="button" onClick={start} className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-dashed border-line px-2 text-[12px] text-fg-2 hover:border-fg-3/60 hover:text-fg" aria-label={kind === "sl" ? t("desk.pos.setSl") : t("desk.pos.setTp")}>
        <Plus className="size-3.5" /> {t("desk.pos.add")}
      </button>
    );
  const money = profitAt(p, value);
  return (
    <Tip content={kind === "sl" ? t("desk.g.sl") : t("desk.g.tp")}>
      <button type="button" onClick={start} className="flex h-6 items-baseline gap-1.5 rounded-[6px] border border-transparent px-1.5 pt-0.5 text-start hover:border-line hover:bg-surface-3" aria-label={`${kind === "sl" ? t("desk.pos.setSl") : t("desk.pos.setTp")}: ${fmtPrice(p.symbol, value)}`}>
        <span className={cn("k-num font-mono text-[12.5px]", kind === "sl" ? "text-down" : "text-up")} dir="ltr">
          {fmtPrice(p.symbol, value)}
        </span>
        {kind === "sl" && p.trailing ? <span className="rounded-[3px] bg-surface-3 px-1 text-[10px] text-fg-2">TS</span> : null}
        <span className="k-num font-mono text-[11px] text-fg-3" dir="ltr">
          {accMoney(a, money, { signed: true })}
        </span>
      </button>
    </Tip>
  );
}

/* ------------------------------------------------------------------ */
/* Pending orders                                                      */
/* ------------------------------------------------------------------ */

export function PendingTab() {
  const T = useTerminal();
  const t = useT();
  const cm = useContextMenu(240);
  const [sel, setSel] = React.useState<string | null>(null);
  const picking = useShareUi().selecting;
  const ordMenu = (o: PendingOrder): MenuItem[] => [
    { label: t("toolbox.menu.modifyOrDelete"), icon: <Edit3 />, onSelect: () => T.setUi({ pendingDialog: o.ticket }) },
    { label: t("toolbox.menu.deleteTicket", { ticket: o.ticket }), icon: <X />, danger: true, onSelect: () => T.cancelPending(o.ticket) },
    "sep",
    { label: t("toolbox.bulk.cancelPendings"), onSelect: () => T.cancelAllPendings() },
    { label: t("toolbox.menu.shareOrder"), icon: <Share2 />, onSelect: () => shareUi.shareOne(o.ticket) },
    { label: t("toolbox.menu.showOnChart"), icon: <Crosshair />, onSelect: () => T.openSymbol(o.symbol) },
  ];
  if (!T.pendings.length)
    return (
      <EmptyState
        icon={<Layers />}
        title={t("desk.ord.emptyTitle")}
        text={T.readOnly ? t("desk.pos.emptyRo") : t("desk.ord.emptyText")}
        action={
          !T.readOnly && (
            <Button variant="secondary" onClick={() => focusTicket(T, true)}>
              {t("desk.ord.emptyAction")}
            </Button>
          )
        }
      />
    );
  return (
    <div className="t-scroll h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[1020px] border-separate border-spacing-0">
        <thead>
          <tr>
            {picking && <Th className="w-8 ps-3" />}
            <Th className={picking ? undefined : "ps-3"}>{t("desk.pos.col.market")}</Th>
            <Th>{t("desk.pos.col.type")}</Th>
            <Th right>{t("desk.pos.col.volume")}</Th>
            <Th right>{t("desk.pos.col.price")}</Th>
            <Th right>{t("desk.pos.col.distance")}</Th>
            <Th right>{t("desk.pos.col.sl")}</Th>
            <Th right>{t("desk.pos.col.tp")}</Th>
            <Th>{t("desk.pos.col.expiry")}</Th>
            <Th className="w-[196px]" />
          </tr>
        </thead>
        <tbody>
          {T.pendings.map((o) => (
            <PendingRow
              key={o.ticket}
              o={o}
              picking={picking}
              selected={sel === o.ticket}
              onSelect={() => setSel(o.ticket)}
              onOpen={() => !T.readOnly && T.setUi({ pendingDialog: o.ticket })}
              onMenu={(e) => {
                setSel(o.ticket);
                if (T.readOnly) return e.preventDefault?.();
                cm.open(e, ordMenu(o), `#${o.ticket} ${pendingLabel(t, o)}`);
              }}
            />
          ))}
        </tbody>
      </table>
      {cm.node}
    </div>
  );
}

function PendingRow({ o, picking, selected, onSelect, onOpen, onMenu }: { o: PendingOrder; picking?: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; onMenu: (e: React.MouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }) => void }) {
  const T = useTerminal();
  const t = useT();
  const q = useQuote(o.symbol);
  const inst = getInstrument(o.symbol);
  const digits = inst.digits;
  const cur = o.side === "buy" ? q.ask : q.bid;
  const dist = Math.abs(o.price - cur) / pipSize(inst);
  return (
    <tr onClick={picking ? () => shareUi.toggle(o.ticket) : onSelect} onDoubleClick={onOpen} onContextMenu={onMenu} className={cn("group cursor-default", selected ? "bg-ember-soft/40" : "hover:bg-surface-2/70")}>
      {picking && (
        <Td className="w-8 ps-3">
          <PickBox ticket={o.ticket} />
        </Td>
      )}
      <Td className={cn(!picking && "ps-3", selected && "shadow-[inset_2px_0_0_var(--k-ember)]")}>
        <button type="button" onClick={(e) => (e.stopPropagation(), T.openSymbol(o.symbol))} className="flex items-center gap-2 text-start" title={`${t("toolbox.menu.showOnChart")} · ${fmtServer(o.placed, false)}`}>
          <SymbolAvatar symbol={o.symbol} size={16} />
          <span className="text-[13px] font-semibold text-fg">{o.symbol}</span>
          <span className="font-mono text-[11.5px] text-fg-3">#{o.ticket}</span>
          {o.source !== "manual" && <span className="rounded-[4px] bg-surface-3 px-1 text-[10.5px] font-medium text-fg-2">{sourceLabel(t, o.source)}</span>}
        </button>
      </Td>
      <Td>
        <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11.5px] font-semibold capitalize", o.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{pendingLabel(t, o)}</span>
        {o.oco && <span className="ms-1 rounded-[4px] bg-gold-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-gold">OCO</span>}
      </Td>
      <Td right mono>
        {fmtVol(o.volume)}
      </Td>
      <Td right mono className="text-gold">
        <span dir="ltr">
          {o.price.toFixed(digits)}
          {o.stopLimit !== undefined && <span className="text-fg-3"> → {o.stopLimit.toFixed(digits)}</span>}
        </span>
      </Td>
      <Td right mono className="text-fg-2">
        <Tip content={`${t("desk.op.now", { price: fmtPrice(o.symbol, cur) })}`}>
          <span tabIndex={0}>{t("desk.pos.pipsAway", { n: dist.toFixed(1) })}</span>
        </Tip>
      </Td>
      <Td right mono className={o.sl !== undefined ? "text-down" : "text-fg-3"}>
        {o.sl !== undefined ? o.sl.toFixed(digits) : "—"}
      </Td>
      <Td right mono className={o.tp !== undefined ? "text-up" : "text-fg-3"}>
        {o.tp !== undefined ? o.tp.toFixed(digits) : "—"}
      </Td>
      <Td className="text-fg-2">{o.expiry === "Date" ? o.expiryDate : o.expiry === "Today" ? t("common.today") : t("order.expiry.gtc")}</Td>
      <Td className="pe-2">
        {!T.readOnly && (
          <span className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={(e) => (e.stopPropagation(), T.setUi({ pendingDialog: o.ticket }))}>
              <Edit3 /> {t("desk.pos.edit")}
            </Button>
            <Button size="sm" variant="secondary" tip={t("desk.pos.cancelTip", { ticket: o.ticket })} aria-label={t("toolbox.trade.deleteOrderAria", { ticket: o.ticket })} onClick={(e) => (e.stopPropagation(), T.cancelPending(o.ticket))} className="hover:border-down/40 hover:bg-down-soft hover:text-down">
              <X /> {t("desk.pos.cancel")}
            </Button>
            <IconButton
              size="sm"
              label={t("desk.pos.more")}
              tipSide="left"
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                onMenu({ clientX: r.right, clientY: r.bottom + 4 });
              }}
            >
              <MoreHorizontal />
            </IconButton>
          </span>
        )}
      </Td>
    </tr>
  );
}

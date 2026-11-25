"use client";

// The step between "Close" and the trade actually closing. Closing is the one action in the table that cannot be
// undone and that a mis-click reaches in a single click, so it asks first - and while it is asking, it answers the
// question the client actually has: how much money comes back. The table's P&L column leaves swap out (the account's
// Floating P&L puts it back), so the figure here is the two added up, which is what lands on the balance.
//
// It replaces the ⋯ menu as the ordinary way in: three plain choices instead of ten, and "Close all trades" among
// them, because a client who wants out of everything was reaching for a Close button on one row.
import * as React from "react";
import { XCircle } from "lucide-react";
import { SymbolAvatar, cn, useQuote } from "@ezymex/ui";
import { getInstrument } from "@ezymex/mock";
import { usePositionProfit, usePositionsProfit, useTerminal } from "@/lib/store";
import { accMoney, fmtServer, fmtVol, type TPosition } from "@/lib/trading";
import { TDialog } from "@/components/ui/primitives";
import { Button } from "@/components/ui/kit";
import { useT } from "@ezymex/i18n/react";

/** What the dialog was opened on: one trade, every trade on one symbol, or the whole account. */
export type CloseTarget = { kind: "one"; ticket: string } | { kind: "symbol"; symbol: string } | { kind: "all" };

let current: CloseTarget | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Ask before closing. Called from the table, the chart and the mobile list. */
export function askClose(target: CloseTarget) {
  current = target;
  emit();
}

export function CloseLayer() {
  const target = React.useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => current,
    () => null,
  );
  const close = React.useCallback(() => {
    current = null;
    emit();
  }, []);
  if (!target) return null;
  return <CloseBody target={target} onClose={close} />;
}

/** The trades a target stands for, and the one row's details when it is a single trade. */
function useTargeted(target: CloseTarget) {
  const T = useTerminal();
  const all = T.positions;
  if (target.kind === "one") {
    const p = all.find((x) => x.ticket === target.ticket);
    return { rows: p ? [p] : [], one: p ?? null, all };
  }
  if (target.kind === "symbol") return { rows: all.filter((x) => x.symbol === target.symbol), one: null, all };
  return { rows: all, one: null, all };
}

function CloseBody({ target, onClose }: { target: CloseTarget; onClose: () => void }) {
  const T = useTerminal();
  const t = useT();
  const { rows, one, all } = useTargeted(target);
  const a = T.account;
  const pnl = usePositionsProfit(rows);
  const swap = rows.reduce((s, p) => s + p.swap, 0);
  const net = pnl + swap;
  const lots = rows.reduce((s, p) => s + p.volume, 0);
  const rest = all.length - rows.length;
  const go = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    // nothing left to close (the trade hit its stop while the dialog was open): leave rather than close nothing
    if (!rows.length) onClose();
  }, [rows.length, onClose]);
  React.useEffect(() => {
    const id = setTimeout(() => go.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);
  if (!rows.length) return null;

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const closeTarget = run(() => {
    if (target.kind === "one") void T.closePosition(target.ticket);
    else if (target.kind === "symbol") T.bulkClose("symbol", target.symbol);
    else T.bulkClose("all");
  });
  const closeEverything = run(() => T.bulkClose("all"));

  const title =
    target.kind === "one" ? t("desk.closeBox.titleOne") : target.kind === "symbol" ? t("desk.closeBox.titleSymbol", { symbol: target.symbol }) : t("desk.closeBox.titleAll");
  const confirmLabel =
    target.kind === "one"
      ? t("desk.closeBox.doOne")
      : target.kind === "symbol"
        ? t("desk.closeBox.doSymbol", { symbol: target.symbol, count: rows.length })
        : t("desk.closeBox.doAll", { count: rows.length });

  return (
    <TDialog
      open
      onClose={onClose}
      width={440}
      icon={<XCircle />}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {/* the way out of everything, offered wherever a client is already thinking about closing */}
          {rest > 0 && (
            <Button variant="secondary" onClick={closeEverything}>
              {t("desk.closeBox.doAll", { count: all.length })}
            </Button>
          )}
          <Button ref={go} variant="primary" className="bg-sell-fill" onClick={closeTarget}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="px-4 py-3.5">
        {one ? <OneLine p={one} /> : <ManyLine rows={rows} lots={lots} />}

        {/* the number the client is actually asking about, on its own, in their account's money */}
        <div className="mt-3.5 rounded-[10px] border border-line bg-surface-2/60 px-3.5 py-3 text-center">
          <div className="text-[11.5px] font-medium uppercase tracking-wide text-fg-3">{net >= 0 ? t("desk.closeBox.youGain") : t("desk.closeBox.youLose")}</div>
          <div dir="ltr" className={cn("mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums", net >= 0 ? "text-up" : "text-down")}>
            {accMoney(a, net, { signed: true })}
          </div>
          {Math.abs(swap) >= 0.005 && (
            <div className="mt-1.5 text-[11.5px] text-fg-3">{t("desk.closeBox.swapNote", { pnl: accMoney(a, pnl, { signed: true }), swap: accMoney(a, swap, { signed: true }) })}</div>
          )}
        </div>

        <p className="mt-3 text-[12.5px] leading-[18px] text-fg-3">{t("desk.closeBox.atMarket")}</p>
      </div>
    </TDialog>
  );
}

/** One trade: what it is, when it was opened and where the price stands now. */
function OneLine({ p }: { p: TPosition }) {
  const t = useT();
  const q = useQuote(p.symbol);
  const digits = getInstrument(p.symbol).digits;
  const cur = p.side === "buy" ? q.bid : q.ask;
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface-2/40 px-3 py-2.5">
      <SymbolAvatar symbol={p.symbol} size={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-semibold text-fg">{p.symbol}</span>
          <span className={cn("text-[12px] font-semibold", p.side === "buy" ? "text-up" : "text-down")}>{p.side === "buy" ? t("desk.pos.buy") : t("desk.pos.sell")}</span>
          <span className="font-mono text-[12px] text-fg-2">{fmtVol(p.volume)}</span>
          <span className="font-mono text-[11px] text-fg-3">#{p.ticket}</span>
        </div>
        <div dir="ltr" className="mt-0.5 font-mono text-[11.5px] text-fg-3">
          {p.openPrice.toFixed(digits)} <span className="mx-0.5">&rarr;</span> {cur.toFixed(digits)} &middot; {fmtServer(p.openTime, false).slice(5)}
        </div>
      </div>
    </div>
  );
}

/** Several trades: how many and how much, then each one, so nothing closes unseen. */
function ManyLine({ rows, lots }: { rows: TPosition[]; lots: number }) {
  const t = useT();
  return (
    <div className="rounded-[10px] border border-line bg-surface-2/40">
      <div className="border-b border-line px-3 py-2 text-[12.5px] font-medium text-fg-2">{t("desk.closeBox.summary", { count: rows.length, lots: fmtVol(lots) })}</div>
      <div className="t-scroll max-h-[150px] overflow-auto px-3 py-1.5">
        {rows.map((p) => (
          <Row key={p.ticket} p={p} />
        ))}
      </div>
    </div>
  );
}

function Row({ p }: { p: TPosition }) {
  const T = useTerminal();
  const t = useT();
  const pr = usePositionProfit(p);
  const net = pr + p.swap;
  return (
    <div className="flex items-center gap-2 py-1 text-[12px]">
      <SymbolAvatar symbol={p.symbol} size={14} />
      <span className="font-semibold text-fg">{p.symbol}</span>
      <span className={cn("font-semibold", p.side === "buy" ? "text-up" : "text-down")}>{p.side === "buy" ? t("desk.pos.buy") : t("desk.pos.sell")}</span>
      <span className="font-mono text-fg-2">{fmtVol(p.volume)}</span>
      <span dir="ltr" className={cn("ms-auto font-mono tabular-nums", net >= 0 ? "text-up" : "text-down")}>
        {accMoney(T.account, net, { signed: true })}
      </span>
    </div>
  );
}

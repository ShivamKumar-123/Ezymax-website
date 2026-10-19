"use client";

// Order form (docs/TERMINAL-DESIGN.md §2.2, §2.5), exchange style:
//   Sell | Buy with live prices · Market | Pending · the order price, with the kind (Limit / Stop / Stop limit) as a
//   chip inside the field · Volume · Stop loss and Take profit, settable by price, pips or money · ONE confirm button
//   that names the trade. With one-click trading on, Sell / Buy send the order at once (as on the chart and the order
//   book) and the confirm button steps aside.
//   More options holds what is set occasionally rather than per order: expiry, trailing stop, OCO, comment, max price
//   change, and the two summary numbers that describe an order rather than decide it (position size, overnight swap).
import * as React from "react";
import { Calculator, ChevronDown, Lock, Zap } from "lucide-react";
import { toast } from "@/lib/notify";
import { getInstrument, priceFeed, type Quote } from "@ezymex/mock";
import { visibleInstruments } from "@/lib/scope";
import { PriceText, SymbolAvatar, cn, useQuote } from "@ezymex/ui";
import { useMetrics, useTerminal } from "@/lib/store";
import { useMarketOpen } from "@/lib/market-hours";
import { useSlowQuote } from "@/lib/market";
import { accCcy, accMoney, fmtPrice, fmtVol, marginRequired, pendingLabelKey, pipSize, pipValuePerLot, splitSymbol, type Expiry, type OrderType, type PendingOrder, swapSummary } from "@/lib/trading";
import { TInput, TSelect } from "@/components/ui/primitives";
import { Button, FieldRow, HelpTip, InlineNumber, Segmented, SummaryRow, Switch, Tip } from "@/components/ui/kit";
import { DropMenu } from "@/components/ui/menu";
import { AccountMoney } from "@/components/ui/balances";
import { GuestActions } from "@/components/shell/guest";
import { useT } from "@ezymex/i18n/react";

export interface TicketPrefill {
  side?: "buy" | "sell";
  type?: OrderType;
  price?: number;
}

type StopMode = "price" | "pips" | "money";
interface StopState {
  on: boolean;
  mode: StopMode;
  value: string;
}

const PENDING_TYPES = ["limit", "stop", "stop-limit"] as const satisfies readonly Exclude<OrderType, "market">[];

/* The Markets panel (price click), the order book, empty states and the chart ask the form for a side / a price. */
type Intent = { symbol?: string; side?: "buy" | "sell"; pending?: boolean; price?: number };
let intent: Intent | null = null;
if (typeof window !== "undefined")
  window.addEventListener("ezymex:ticket", (e) => {
    intent = (e as CustomEvent).detail ?? null;
  });

export function OrderTicket({ symbol, onSymbol, prefill, variant = "panel", onDone }: { symbol: string; onSymbol?: (s: string) => void; prefill?: TicketPrefill; variant?: "panel" | "dialog"; onDone?: () => void }) {
  const T = useTerminal();
  if (T.guest) return <GuestTicket symbol={symbol} />;
  if (T.readOnly) return <ReadOnlyTicket />;
  return <Ticket symbol={symbol} onSymbol={onSymbol} prefill={prefill} variant={variant} onDone={onDone} />;
}

function Ticket({ symbol, onSymbol, prefill, variant, onDone }: { symbol: string; onSymbol?: (s: string) => void; prefill?: TicketPrefill; variant: "panel" | "dialog"; onDone?: () => void }) {
  const T = useTerminal();
  const t = useT();
  const acc = T.account;
  // derived numbers follow the price once a second; live prices are leaf components (SideButton, LiveSummary)
  const q = useSlowQuote(symbol);
  const inst = getInstrument(symbol);
  const pip = pipSize(inst);
  const marketOpen = useMarketOpen(symbol);
  const [type, setType] = React.useState<OrderType>(prefill?.type ?? "market");
  const [side, setSide] = React.useState<"buy" | "sell" | null>(prefill?.side ?? null);
  const [volume, setVolume] = React.useState(T.ws.lot.toFixed(2));
  const [price, setPrice] = React.useState(prefill?.price ? fmtPrice(symbol, prefill.price) : "");
  const [stopLimit, setStopLimit] = React.useState("");
  const [sl, setSl] = React.useState<StopState>({ on: false, mode: "pips", value: "" });
  const [tp, setTp] = React.useState<StopState>({ on: false, mode: "pips", value: "" });
  const [trailing, setTrailing] = React.useState(false);
  const [trailPips, setTrailPips] = React.useState("20");
  const [expiry, setExpiry] = React.useState<Expiry>("GTC");
  const [expiryDate, setExpiryDate] = React.useState(tomorrow);
  const [oco, setOco] = React.useState(false);
  const [ocoPrice, setOcoPrice] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [more, setMore] = React.useState(false);
  const [calcOpen, setCalcOpen] = React.useState(false);
  const [riskMode, setRiskMode] = React.useState<"pct" | "usd">("pct");
  const [risk, setRisk] = React.useState("1");
  const [riskPips, setRiskPips] = React.useState("25");
  const [busy, setBusy] = React.useState(false);

  const apply = React.useCallback(
    (d: Intent) => {
      if (d.side) setSide(d.side);
      if (d.pending || d.price) {
        setType((ty) => (ty === "market" ? "limit" : ty));
        if (d.price) setPrice(fmtPrice(symbol, d.price));
      }
    },
    [symbol],
  );
  // a new market: prices and price-mode stops no longer apply; the side comes from the click that changed it, if any
  // compare with the last market (not a "first run" flag: React's dev double-run would reset a prefilled side)
  const shown = React.useRef(symbol);
  React.useEffect(() => {
    const it = intent;
    if (shown.current !== symbol) {
      shown.current = symbol;
      setPrice("");
      setStopLimit("");
      setOcoPrice("");
      setSl((s) => (s.mode === "price" ? { ...s, value: "" } : s));
      setTp((s) => (s.mode === "price" ? { ...s, value: "" } : s));
      setSide(null);
    }
    if (it && (!it.symbol || it.symbol === symbol)) {
      apply(it);
      intent = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);
  React.useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as Intent | null;
      if (!d || (d.symbol && d.symbol !== symbol)) return;
      apply(d);
      intent = null;
    };
    window.addEventListener("ezymex:ticket", on);
    return () => window.removeEventListener("ezymex:ticket", on);
  }, [symbol, apply]);

  const vol = Math.max(0.01, parseFloat(volume) || 0);
  const pending = type !== "market";
  // switching back to Pending returns to the kind last used, rather than always Limit
  const lastPending = React.useRef<Exclude<OrderType, "market">>("limit");
  if (pending) lastPending.current = type as Exclude<OrderType, "market">;
  const pv = pipValuePerLot(symbol, q.bid); // USD per pip per lot
  const cent = acc.cent ? 100 : 1;
  const balance = T.engine ? acc.balance / cent : (T.balances[acc.login] ?? 0);
  const unitLabel = inst.assetClass === "forex" ? splitSymbol(symbol).base : inst.assetClass === "metals" ? t("order.unit.oz") : inst.assetClass === "energies" ? t("order.unit.bbl") : inst.assetClass === "stocks" ? t("order.unit.shares") : t("order.unit.units");
  const spreadPips = Math.max(1, (q.ask - q.bid) / pip);

  const entryFor = (s: "buy" | "sell", qq: Quote = q) => (pending ? parseFloat(type === "stop-limit" && stopLimit ? stopLimit : price) || (s === "buy" ? qq.ask : qq.bid) : s === "buy" ? qq.ask : qq.bid);
  /** distance in pips of a stop typed as pips or money (null for price mode) */
  const distPips = (st: StopState): number | null => {
    const n = parseFloat(st.value);
    if (!(n > 0)) return null;
    if (st.mode === "pips") return n;
    if (st.mode === "money") return n / cent / Math.max(1e-9, pv * vol);
    return null;
  };
  const stopPrice = (st: StopState, which: "sl" | "tp", s: "buy" | "sell", qq: Quote = q): number | undefined => {
    if (!st.on) return undefined;
    if (st.mode === "price") return parseFloat(st.value) || undefined;
    const d = distPips(st);
    if (d === null) return undefined;
    const dir = (which === "tp" ? 1 : -1) * (s === "buy" ? 1 : -1);
    return +(entryFor(s, qq) + dir * d * pip).toFixed(inst.digits);
  };
  /** money at the stop for the current volume (USD), signed: negative for a loss */
  const stopMoney = (st: StopState, which: "sl" | "tp"): number | null => {
    if (!st.on) return null;
    let d = distPips(st);
    if (d === null && st.mode === "price" && side) {
      const p = parseFloat(st.value);
      if (!(p > 0)) return null;
      d = (side === "buy" ? p - entryFor(side) : entryFor(side) - p) / pip;
      return d * pv * vol;
    }
    if (d === null) return null;
    return (which === "sl" ? -1 : 1) * d * pv * vol;
  };
  const wrongSide = (which: "sl" | "tp"): boolean => {
    const st = which === "sl" ? sl : tp;
    if (!side || !st.on || st.mode !== "price") return false;
    const p = parseFloat(st.value);
    if (!(p > 0)) return false;
    const below = p < entryFor(side);
    return which === "sl" ? (side === "buy" ? !below : below) : side === "buy" ? below : !below;
  };
  const toggleStop = (which: "sl" | "tp", on: boolean) => {
    const set = which === "sl" ? setSl : setTp;
    // a starting distance: twice the spread, at least 10 pips; take profit twice the stop loss
    const base = Math.max(10, Math.round(spreadPips * 2));
    set((s) => ({ ...s, on, mode: on && !s.value ? "pips" : s.mode, value: on && !s.value ? String(which === "sl" ? base : base * 2) : s.value }));
  };
  const changeMode = (which: "sl" | "tp", mode: StopMode) => {
    const st = which === "sl" ? sl : tp;
    const set = which === "sl" ? setSl : setTp;
    const s = side ?? "buy";
    const p = stopPrice(st, which, s);
    const d = st.mode === "price" ? (p !== undefined ? Math.abs(p - entryFor(s)) / pip : null) : distPips(st);
    let value = "";
    if (mode === "price") value = p !== undefined ? fmtPrice(symbol, p) : "";
    else if (d !== null) value = mode === "pips" ? d.toFixed(1).replace(/\.0$/, "") : (d * pv * vol * cent).toFixed(2);
    set({ ...st, mode, value });
  };

  const submit = async (s: "buy" | "sell") => {
    if (!marketOpen || busy) return;
    if (pending && !price) {
      toast.error(t("order.toast.enterPendingPrice"));
      return;
    }
    const qq = priceFeed().quote(symbol); // pips / money → prices from the price at the moment of the click
    setBusy(true);
    const ok = await T.placeOrder({
      symbol,
      side: s,
      type,
      volume: vol,
      price: pending ? parseFloat(price) : undefined,
      stopLimit: type === "stop-limit" ? parseFloat(stopLimit) || parseFloat(price) : undefined,
      sl: stopPrice(sl, "sl", s, qq),
      tp: stopPrice(tp, "tp", s, qq),
      trailing: trailing ? (parseFloat(trailPips) || 0) * pip || undefined : undefined,
      expiry: pending ? expiry : undefined,
      expiryDate: pending && expiry === "Date" ? expiryDate : undefined,
      comment: comment || undefined,
      ocoPrice: pending && oco && type !== "stop-limit" && ocoPrice ? parseFloat(ocoPrice) : undefined,
    });
    setBusy(false);
    if (ok) {
      T.setWs({ lot: vol });
      onDone?.();
    }
  };
  const onSide = (s: "buy" | "sell") => {
    setSide(s);
    // One-click trading is a promise about market orders: the price you see is the price you get, so there is
    // nothing left to confirm. A pending order is the opposite - a price typed by hand, an expiry, sometimes a
    // second price - and none of that should go on one click. Sell / Buy only choose the side here; the confirm
    // button below sends it.
    if (T.ws.oneClick && !pending) void submit(s);
  };

  const riskUsd = riskMode === "pct" ? (balance * (parseFloat(risk) || 0)) / 100 : (parseFloat(risk) || 0) / cent;
  const calcLots = Math.max(0.01, Math.floor((riskUsd / ((parseFloat(riskPips) || 1) * pv)) * 100) / 100);
  const applyCalc = () => {
    setVolume(calcLots.toFixed(2));
    setSl({ on: true, mode: "pips", value: riskPips });
    setTp({ on: true, mode: "pips", value: String((parseFloat(riskPips) || 0) * 2) });
    setCalcOpen(false);
    toast.success(t("order.toast.volumeSet", { lots: calcLots.toFixed(2) }), { description: t("order.toast.volumeSetDesc", { amount: accMoney(acc, riskUsd), ccy: accCcy(acc), pips: riskPips }) });
  };

  const priceStep = pip / 10 >= 1 / 10 ** inst.digits ? pip / 10 : 1 / 10 ** inst.digits;
  const dialog = variant === "dialog";
  const sideWord = (s: "buy" | "sell") => (s === "buy" ? t("desk.pos.buy") : t("desk.pos.sell"));
  const typeWord = (ty: OrderType) => (ty === "market" ? t("desk.op.market") : ty === "limit" ? t("desk.op.type.limit") : ty === "stop" ? t("desk.op.type.stop") : t("desk.op.type.stopLimit"));
  const pendLabel = (s: "buy" | "sell") => t(pendingLabelKey({ side: s, type: type as PendingOrder["type"] }));
  const slMoney = stopMoney(sl, "sl");
  const tpMoney = stopMoney(tp, "tp");

  // the confirm button: its words are the order
  // a delayed price (the market isn't streaming yet): shown, not traded
  const delayed = !!q.delayed && !pending;
  let confirm: string;
  if (delayed) confirm = t("desk.side.delayedTip");
  else if (!marketOpen) confirm = t("desk.op.confirm.closed");
  else if (busy) confirm = t("desk.op.confirm.sending");
  else if (!side) confirm = t("desk.op.confirm.pickSide");
  else if (pending && !price) confirm = t("desk.op.confirm.enterPrice");
  else if (pending) confirm = t("desk.op.confirm.pending", { label: pendLabel(side), lots: fmtVol(vol), symbol, price: fmtPrice(symbol, parseFloat(price)) });
  else confirm = t("desk.op.confirm.market", { side: sideWord(side), lots: fmtVol(vol), symbol });
  const canConfirm = !delayed && marketOpen && !busy && !!side && (!pending || !!price);
  const explain = pending ? (side ? t.dyn(`desk.op.explain.${side}.${type === "stop-limit" ? "stopLimit" : type}`) : t("desk.op.explain.pickSide")) : t("desk.op.marketTip");

  const stopRow = (which: "sl" | "tp") => {
    const st = which === "sl" ? sl : tp;
    const set = which === "sl" ? setSl : setTp;
    const money = which === "sl" ? slMoney : tpMoney;
    const at = side ? stopPrice(st, which, side) : undefined;
    const d = st.on ? (st.mode === "price" ? (at !== undefined && side ? Math.abs(at - entryFor(side)) / pip : null) : distPips(st)) : null;
    const bad = wrongSide(which);
    const name = which === "sl" ? t("desk.op.sl") : t("desk.op.tp");
    return (
      <div key={which}>
        <FieldRow
          tone={st.on ? (which === "sl" ? "down" : "up") : undefined}
          label={
            <span className="flex items-center gap-2">
              <Switch size="sm" checked={st.on} onChange={(v) => toggleStop(which, v)} label={name} />
              <span className={cn("whitespace-nowrap", st.on && "text-fg")}>{name}</span>
            </span>
          }
          help={<HelpTip title={which === "sl" ? t("desk.g.sl.t") : t("desk.g.tp.t")} text={which === "sl" ? t("desk.op.slHint") : t("desk.op.tpHint")} />}
        >
          {st.on ? (
            <>
              <InlineNumber
                value={st.value}
                onChange={(v) => set({ ...st, value: v })}
                step={st.mode === "price" ? pip : st.mode === "pips" ? 1 : Math.max(1, Math.round(pv * vol * cent))}
                decimals={st.mode === "price" ? inst.digits : st.mode === "pips" ? 1 : 2}
                ariaLabel={which === "sl" ? t("order.ticket.stopLoss") : t("order.ticket.takeProfit")}
                placeholder={st.mode === "price" ? fmtPrice(symbol, side === "sell" ? q.ask : q.bid) : "0"}
                tone={which === "sl" ? "down" : "up"}
                className="[&_input]:w-[70px]"
              />
              <DropMenu
                align="end"
                width={170}
                items={(["price", "pips", "money"] as const).map((m) => ({ label: m === "price" ? t("desk.op.mode.price") : m === "pips" ? t("desk.op.mode.pips") : `${t("desk.op.mode.money")} (${accCcy(acc)})`, checked: st.mode === m, onSelect: () => changeMode(which, m) }))}
                trigger={({ toggle, open }) => (
                  <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${name}: ${t("desk.op.mode.price")} / ${t("desk.op.mode.pips")} / ${t("desk.op.mode.money")}`} className="flex h-6 items-center gap-0.5 rounded-[6px] border border-line bg-panel px-1.5 text-[11.5px] text-fg-2 hover:text-fg">
                    {st.mode === "price" ? t("desk.op.mode.price") : st.mode === "pips" ? t("desk.op.mode.pips") : accCcy(acc)}
                    <ChevronDown className="size-3 text-fg-3" />
                  </button>
                )}
              />
            </>
          ) : (
            <button type="button" onClick={() => toggleStop(which, true)} className="h-7 pe-2 text-[12px] text-fg-3 hover:text-fg">
              {t("desk.op.notSet")}
            </button>
          )}
        </FieldRow>
        {st.on && (
          <div className="flex flex-wrap items-center gap-x-1.5 px-1 pt-1 text-[12px] text-fg-3">
            {money !== null && <span className={cn("k-num font-mono font-medium", which === "sl" ? "text-down" : "text-up")}>{which === "sl" ? t("desk.op.risk", { amount: accMoney(acc, money, { signed: true }) }) : t("desk.op.reward", { amount: accMoney(acc, money, { signed: true }) })}</span>}
            {at !== undefined ? <span className="k-num font-mono">· {t("desk.op.atPrice", { price: fmtPrice(symbol, at) })}</span> : !side && <span>· {t("desk.op.pickSideForPrice")}</span>}
            {d !== null && st.mode !== "pips" && <span>· {t("desk.op.pipsAway", { n: d.toFixed(1) })}</span>}
            {bad && <span className="basis-full text-down">{t.dyn(`desk.op.check.${which}${side === "buy" ? "Buy" : "Sell"}`)}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className={cn("flex-1 space-y-2", dialog ? "pb-3" : "px-2.5 pb-2.5")}>
        {dialog && (
          <div className="relative">
            <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2">
              <SymbolAvatar symbol={symbol} size={16} />
            </span>
            <TSelect ariaLabel={t("order.ticket.symbol")} value={symbol} onChange={(v) => (onSymbol ? onSymbol(v) : T.openSymbol(v))} options={visibleInstruments().map((i) => ({ value: i.symbol, label: `${i.symbol} · ${i.name}` }))} className="h-8 ps-9 font-medium" />
          </div>
        )}

        {/* side: Sell | Buy with live prices - the two buttons that send the order when one-click is on */}
        <div data-tour="side" role="radiogroup" aria-label={t("desk.op.when")} className="grid grid-cols-2 gap-2">
          {(["sell", "buy"] as const).map((s) => (
            <SideButton key={s} symbol={symbol} side={s} chosen={side === s} armed={T.ws.oneClick && !pending} disabled={!marketOpen || busy} fixed={pending && price ? parseFloat(price) || undefined : undefined} label={sideWord(s)} hint={s === "buy" ? t("desk.op.buyHint") : t("desk.op.sellHint")} onClick={() => onSide(s)} />
          ))}
        </div>

        {/* now, or at a price: the first question, and the spread beside it */}
        <div className="flex items-center gap-2">
          <Segmented
            size="sm"
            stretch={false}
            label={t("desk.op.typeTitle")}
            value={pending ? "pending" : "market"}
            onChange={(v) => setType(v === "market" ? "market" : lastPending.current)}
            options={[
              { value: "market", label: t("desk.op.market") },
              { value: "pending", label: t("desk.op.pending") },
            ]}
          />
          <HelpTip title={t("desk.op.typeTitle")} text={explain} />
          <span className="flex-1" />
          <SpreadChip symbol={symbol} />
        </div>
        {!marketOpen && (
          <div role="status" className="flex items-center gap-2 rounded-[9px] border border-warn/30 bg-warn-soft px-2.5 py-1.5 text-[12px] text-warn">
            <Lock className="size-3.5 shrink-0" /> {t("order.ticket.marketClosedNote", { symbol })}
          </div>
        )}

        {pending && (
          <>
            <FieldRow label={t("desk.op.orderPrice")} htmlFor="tk-price">
              {/* which kind of pending order: a chip in the field it governs, not a row of its own */}
              <DropMenu
                align="end"
                width={190}
                items={[{ header: t("desk.op.typeTitle") }, ...PENDING_TYPES.map((ty) => ({ label: typeWord(ty), checked: type === ty, onSelect: () => setType(ty) }))]}
                trigger={({ toggle, open }) => (
                  <button type="button" onClick={toggle} aria-expanded={open} aria-label={t("desk.op.typeTitle")} className={cn("flex h-6 shrink-0 items-center gap-0.5 rounded-[6px] border border-line bg-panel px-1.5 text-[11.5px] font-medium text-fg-2 hover:text-fg", open && "text-fg")}>
                    {typeWord(type)}
                    <ChevronDown className="size-3 text-fg-3" />
                  </button>
                )}
              />
              <InlineNumber id="tk-price" value={price} onChange={setPrice} step={priceStep} decimals={inst.digits} ariaLabel={t("order.ticket.orderPrice")} placeholder={fmtPrice(symbol, side === "sell" ? q.bid : q.ask)} />
            </FieldRow>
            {/* how far the order sits from where this side can trade now */}
            {side && !!parseFloat(price) && <div className="px-1 text-[12px] text-fg-3">{t("desk.op.pipsAway", { n: ((parseFloat(price) - (side === "buy" ? q.ask : q.bid)) / pip).toFixed(1) })}</div>}
            {type === "stop-limit" && (
              <FieldRow label={t("desk.op.limitPrice")} htmlFor="tk-sl-price">
                <InlineNumber id="tk-sl-price" value={stopLimit} onChange={setStopLimit} step={priceStep} decimals={inst.digits} ariaLabel={t("order.ticket.stopLimitPrice")} placeholder={price || fmtPrice(symbol, q.ask)} />
              </FieldRow>
            )}
          </>
        )}

        <div data-tour="size" className="space-y-2">
          {/* volume */}
          <FieldRow label={t("desk.op.volume")} htmlFor="tk-vol" help={<HelpTip title={t("desk.g.lot.t")} text={t("desk.g.lot")} />}>
            <Tip content={t("desk.op.calc.text")}>
              <button type="button" onClick={() => setCalcOpen(!calcOpen)} aria-expanded={calcOpen} aria-label={t("desk.op.byRisk")} className={cn("grid size-6 shrink-0 place-items-center rounded-[6px]", calcOpen ? "bg-ember-soft text-accent-text" : "text-fg-3 hover:bg-surface-3 hover:text-fg")}>
                <Calculator className="size-3.5" />
              </button>
            </Tip>
            <InlineNumber id="tk-vol" value={volume} onChange={setVolume} step={0.01} min={0.01} decimals={2} ariaLabel={t("order.ticket.volume")} suffix={t("desk.ob.lots").toLowerCase()} />
          </FieldRow>
          {calcOpen && (
            <div className="space-y-2 rounded-[10px] border border-line bg-panel-2/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
                {t("desk.op.calc.title")}
                <HelpTip text={t("desk.op.calc.text")} />
              </div>
              <FieldRow label={t("order.calc.risk")}>
                <Segmented size="sm" stretch={false} value={riskMode} onChange={setRiskMode} label={t("order.calc.risk")} options={[{ value: "pct", label: "%" }, { value: "usd", label: acc.cent ? "¢" : "$" }]} />
                <InlineNumber value={risk} onChange={setRisk} step={riskMode === "pct" ? 0.25 : 25} decimals={riskMode === "pct" ? 2 : 0} ariaLabel={t("order.calc.risk")} className="[&_input]:w-[60px]" />
              </FieldRow>
              <FieldRow label={t("order.calc.slDistancePips")}>
                <InlineNumber value={riskPips} onChange={setRiskPips} step={1} decimals={0} ariaLabel={t("order.calc.slDistance")} className="[&_input]:w-[60px]" />
              </FieldRow>
              <SummaryRow label={t("order.calc.lots")}>{calcLots.toFixed(2)}</SummaryRow>
              <Button variant="soft" className="w-full" onClick={applyCalc}>
                {t("order.calc.apply", { lots: calcLots.toFixed(2), sl: riskPips, tp: (parseFloat(riskPips) || 0) * 2 })}
              </Button>
            </div>
          )}
          {stopRow("sl")}
          {stopRow("tp")}
        </div>

        {/* more options */}
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-[8px] px-1 text-[12.5px] font-medium text-fg-2 hover:text-fg">
          <ChevronDown className={cn("size-3.5 shrink-0 text-fg-3 transition-transform", more ? "rotate-0" : "-rotate-90")} />
          <span className="shrink-0">{t("desk.op.more")}</span>
          <span className="min-w-0 truncate text-[12px] font-normal text-fg-3">{[pending ? t("desk.op.expiry") : null, t("desk.op.trailing"), pending && type !== "stop-limit" ? "OCO" : null, t("desk.op.comment"), t("desk.op.maxDev")].filter(Boolean).join(" · ")}</span>
        </button>
        {more && (
          <div className="space-y-2">
            {pending && (
              <FieldRow label={t("desk.op.expiry")}>
                <TSelect ariaLabel={t("order.ticket.expiry")} value={expiry} onChange={setExpiry} options={[{ value: "GTC", label: t("order.expiry.gtc") }, { value: "Today", label: t("order.expiry.today") }, { value: "Date", label: t("order.expiry.date") }]} className="h-6 w-auto border-0 bg-transparent text-end" />
                {expiry === "Date" && <TInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} aria-label={t("order.ticket.expiryDate")} className="h-6 w-[130px] font-mono" dir="ltr" />}
              </FieldRow>
            )}
            <FieldRow
              label={
                <span className="flex items-center gap-2">
                  <Switch size="sm" checked={trailing} onChange={setTrailing} label={t("desk.op.trailing")} />
                  {t("desk.op.trailing")}
                </span>
              }
              help={<HelpTip title={t("desk.op.trailing")} text={t("desk.op.trailingHint")} />}
            >
              {trailing ? <InlineNumber value={trailPips} onChange={setTrailPips} step={1} decimals={0} min={1} ariaLabel={t("order.ticket.trailingPips")} suffix={t("order.pips")} className="[&_input]:w-[48px]" /> : <span className="pe-2 text-[12px] text-fg-3">{t("desk.op.off")}</span>}
            </FieldRow>
            {pending && type !== "stop-limit" && (
              <FieldRow
                label={
                  <span className="flex items-center gap-2">
                    <Switch size="sm" checked={oco} onChange={setOco} label={t("desk.op.oco")} />
                    OCO
                  </span>
                }
                help={<HelpTip title="OCO" text={t("desk.op.oco")} />}
              >
                {oco ? <InlineNumber value={ocoPrice} onChange={setOcoPrice} step={priceStep} decimals={inst.digits} ariaLabel={t("desk.op.ocoPrice")} placeholder={fmtPrice(symbol, q.bid)} /> : <span className="pe-2 text-[12px] text-fg-3">{t("desk.op.off")}</span>}
              </FieldRow>
            )}
            <FieldRow label={t("desk.op.comment")}>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("common.optional")} maxLength={31} aria-label={t("desk.op.comment")} className="h-7 w-[150px] bg-transparent pe-2 text-end text-[13px] text-fg outline-none placeholder:text-fg-3" />
            </FieldRow>
            <FieldRow label={t("desk.op.maxDev")} help={<HelpTip title={t("desk.set.maxDeviation")} text={t("desk.set.maxDeviationHint")} />}>
              <InlineNumber value={T.ws.maxDeviation === null ? "" : String(T.ws.maxDeviation)} placeholder={t("order.ticket.anyPrice")} onChange={(v) => T.setWs({ maxDeviation: v.trim() === "" ? null : Math.max(0, Math.round(parseFloat(v) || 0)) })} step={1} decimals={0} ariaLabel={t("order.ticket.maxDeviation")} className="[&_input]:w-[80px]" />
            </FieldRow>
          </div>
        )}

        {/* summary */}
        <div className="space-y-0.5 border-t border-line px-1 pt-2">
          <LiveSummary symbol={symbol} volume={vol} unitLabel={unitLabel} detail={more} />
          {sl.on && tp.on && slMoney !== null && tpMoney !== null && slMoney < 0 && (
            <SummaryRow label={t("desk.op.ratioLabel")}>
              <span className="text-down">{accMoney(acc, slMoney, { signed: true })}</span>
              <span className="text-fg-3"> / </span>
              <span className="text-up">{accMoney(acc, tpMoney, { signed: true })}</span>
              <span className="ms-1.5 text-fg-2">· {(tpMoney / Math.abs(slMoney)).toFixed(1)}×</span>
            </SummaryRow>
          )}
        </div>
      </div>

      {/* the one primary action (sticky at the bottom of the panel) */}
      <div className={cn("space-y-2 border-t border-line", dialog ? "pt-3" : "t-bar sticky bottom-0 z-[2] px-2.5 pb-2.5 pt-2.5")}>
        {/* one-click on: Sell and Buy are the action for a market order, so there is no confirm button - the switch
            below says so. A pending order always has one: it is built from typed prices, not from the quote. */}
        {(!T.ws.oneClick || pending) && (
          <Button data-tour="confirm" size="xl" variant={canConfirm ? "primary" : "secondary"} disabled={!canConfirm} onClick={() => side && void submit(side)} className="w-full disabled:opacity-80">
            <span className="truncate">{confirm}</span>
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={T.ws.oneClick} onChange={(v) => T.setWs({ oneClick: v })} label={t("desk.op.oneClick")} size="sm" />
          <span className="text-[12px] font-medium text-fg-2">{t("desk.op.oneClick")}</span>
          <HelpTip title={t("desk.op.oneClick")} text={T.ws.oneClick ? t("desk.op.oneClickOn") : t("desk.op.oneClickOff")} />
          <span className={cn("ms-auto text-[11.5px]", T.ws.oneClick ? "text-accent-text" : "text-fg-3")}>{T.ws.oneClick ? t("trader.oneClick.on") : t("trader.oneClick.off")}</span>
        </div>
      </div>
    </div>
  );
}

function tomorrow() {
  const d = new Date(Date.now() + 86400e3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---- per-tick leaves ---- */

/** Sell / Buy: label and live price on one line, one short line under. Filled in the terminal's own buy and sell
 *  colours (bg-buy-fill / bg-sell-fill, as the depth ladder and the position dialog), because with one-click trading
 *  on these two are the order - there is no confirm button behind them. The ring marks the chosen side, which is what
 *  the confirm button follows when one-click is off. */
function SideButton({ symbol, side, chosen, armed, disabled, fixed, label, hint, onClick }: { symbol: string; side: "buy" | "sell"; chosen: boolean; armed: boolean; disabled: boolean; fixed?: number; label: string; hint: string; onClick: () => void }) {
  const q = useQuote(symbol);
  const buy = side === "buy";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-12 min-w-0 flex-col justify-center rounded-[9px] px-3 text-start text-white transition-[filter,box-shadow] duration-150 hover:brightness-110 active:brightness-95",
        "disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100",
        buy ? "bg-buy-fill" : "bg-sell-fill",
        chosen && "ring-2 ring-white/70",
      )}
    >
      <span className="flex items-baseline gap-1.5">
        <span className="flex items-center gap-1 text-[13px] font-semibold capitalize">
          {armed && <Zap className="size-3 fill-current" aria-hidden />}
          {label}
        </span>
        {/* the price inherits the button, so its grey-on-panel tones do not land on a filled surface */}
        <PriceText symbol={symbol} value={fixed ?? (buy ? q.ask : q.bid)} dir={fixed === undefined ? q.dir : 0} className="ms-auto text-[15px] [&_span]:text-white" />
      </span>
      <span className="truncate text-[11.5px] leading-[15px] text-white/75">{hint}</span>
    </button>
  );
}

function SpreadChip({ symbol }: { symbol: string }) {
  const t = useT();
  const q = useQuote(symbol);
  const spreadPts = Math.round((q.ask - q.bid) * 10 ** getInstrument(symbol).digits);
  return (
    <Tip content={t("desk.op.spreadTip")}>
      <span tabIndex={0} className="k-num shrink-0 rounded-[6px] bg-panel-2 px-1.5 py-0.5 font-mono text-[11.5px] text-fg-2">
        {t("desk.op.spread")} {spreadPts}
      </span>
    </Tip>
  );
}

/** The volume's consequences in plain words. Margin, pip value and the free margin left decide whether to send the
 *  order at all, so they are always here; size and the overnight swap describe it, and follow More options. Hidden
 *  balances mask the free margin and the share of it the margin takes (which would give it away). */
function LiveSummary({ symbol, volume, unitLabel, detail }: { symbol: string; volume: number; unitLabel: string; detail: boolean }) {
  const T = useTerminal();
  const t = useT();
  const m = useMetrics();
  const q = useSlowQuote(symbol);
  const acc = T.account;
  const inst = getInstrument(symbol);
  const margin = marginRequired(symbol, volume, q.ask, acc.leverage);
  const pipV = pipValuePerLot(symbol, q.bid) * volume;
  const pct = m.free > 0 ? (margin / m.free) * 100 : Infinity;
  const short = margin > m.free;
  const ccy = accCcy(acc);
  return (
    <>
      <SummaryRow label={t("desk.op.summary.margin")} help={<HelpTip title={t("desk.g.margin.t")} text={t("desk.g.margin")} />}>
        <span className={short ? "text-down" : undefined}>
          {accMoney(acc, margin)} {ccy}
        </span>
        <span className="ms-1.5 text-fg-3">
          · <AccountMoney>{Number.isFinite(pct) ? `${pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)}%` : "—"}</AccountMoney>
        </span>
      </SummaryRow>
      <SummaryRow label={t("desk.op.summary.pip")} help={<HelpTip title={t("desk.g.pip.t")} text={t("desk.g.pip")} />}>
        {accMoney(acc, pipV)} {ccy}
      </SummaryRow>
      {detail && (
        <SummaryRow label={t("desk.op.summary.size")}>
          {(volume * inst.contractSize).toLocaleString("en-US", { maximumFractionDigits: 2 })} <span className="text-fg-3">{unitLabel}</span>
        </SummaryRow>
      )}
      <SummaryRow label={t("desk.op.summary.free")}>
        <span className={short ? "text-down" : undefined}>
          <AccountMoney>{accMoney(acc, m.free - margin)}</AccountMoney> {ccy}
        </span>
      </SummaryRow>
      {detail && (
        <SummaryRow label={t("desk.sw.title")} help={<HelpTip title={t("desk.g.swap.t")} text={t("desk.g.swap")} />}>
          <span className="whitespace-normal text-end font-sans text-[11.5px] text-fg-2">{swapSummary(t, symbol)}</span>
        </SummaryRow>
      )}
      {short && <div className="text-[12px] font-medium text-down">{t("desk.op.notEnough")}</div>}
    </>
  );
}

function ReadOnlyTicket() {
  const T = useTerminal();
  const t = useT();
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-warn/30 bg-warn-soft text-warn">
          <Lock className="size-4" />
        </div>
        <div className="text-[13.5px] font-semibold">{t("order.ticket.readOnlyTitle")}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{t("order.ticket.readOnlyText", { login: T.account.login })}</p>
      </div>
    </div>
  );
}

/** Guest mode: live prices for the symbol, trade buttons that explain instead of trading. */
function GuestTicket({ symbol }: { symbol: string }) {
  const T = useTerminal();
  const t = useT();
  return (
    <div className="space-y-2.5 px-2.5 pb-2.5">
      <div data-tour="side" className="grid grid-cols-2 gap-1 rounded-[11px] border border-line bg-panel-2 p-1">
        {(["sell", "buy"] as const).map((s) => (
          <SideButton key={s} symbol={symbol} side={s} chosen={false} armed={false} disabled={false} label={s === "buy" ? t("desk.pos.buy") : t("desk.pos.sell")} hint={s === "buy" ? t("desk.op.buyHint") : t("desk.op.sellHint")} onClick={() => T.quickTrade(symbol, s)} />
        ))}
      </div>
      <div className="rounded-[12px] border border-line bg-panel-2/60 px-3 py-3.5 text-center">
        <div className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-ember/30 bg-ember-soft text-accent-text">
          <Lock className="size-3.5" />
        </div>
        <div className="text-[13.5px] font-semibold text-fg">{t("trader.guest.title")}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-fg-2">{t("order.guest.text")}</p>
        <GuestActions className="mt-2.5" />
      </div>
    </div>
  );
}

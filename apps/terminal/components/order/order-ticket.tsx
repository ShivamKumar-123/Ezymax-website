"use client";

import * as React from "react";
import { Calculator, ChevronDown, ChevronUp, Lock, Zap } from "lucide-react";
import { toast } from "@/lib/notify";
import { INSTRUMENTS, getInstrument } from "@kalks/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useMetrics, useTerminal } from "@/lib/store";
import { useMarketOpen } from "@/lib/market-hours";
import { accCcy, accMoney, fmtPrice, marginRequired, pipSize, pipValuePerLot, splitSymbol, type Expiry, type OrderType } from "@/lib/trading";
import { Check, MiniSwitch, Stepper, TInput, TSelect } from "@/components/ui/primitives";
import { GuestActions } from "@/components/shell/guest";
import { GUEST_TITLE } from "@/lib/guest";

const TYPES: { value: OrderType; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop", label: "Stop" },
  { value: "stop-limit", label: "Stop-Lmt" },
];

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">
      <span>{children}</span>
      {right && <span className="normal-case tracking-normal">{right}</span>}
    </div>
  );
}

export interface TicketPrefill {
  side?: "buy" | "sell";
  type?: OrderType;
  price?: number;
}

export function OrderTicket({
  symbol,
  onSymbol,
  prefill,
  variant = "panel",
  onDone,
}: {
  symbol: string;
  onSymbol?: (s: string) => void;
  prefill?: TicketPrefill;
  variant?: "panel" | "dialog";
  onDone?: () => void;
}) {
  const T = useTerminal();
  const m = useMetrics();
  const acc = T.account;
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  const pip = pipSize(inst);
  const marketOpen = useMarketOpen(symbol);
  const [type, setType] = React.useState<OrderType>(prefill?.type ?? "market");
  const [volume, setVolume] = React.useState(T.ws.lot.toFixed(2));
  const [price, setPrice] = React.useState(prefill?.price ? fmtPrice(symbol, prefill.price) : "");
  const [stopLimit, setStopLimit] = React.useState("");
  const [stopMode, setStopMode] = React.useState<"pips" | "price">("pips");
  const [sl, setSl] = React.useState("");
  const [tp, setTp] = React.useState("");
  const [trailing, setTrailing] = React.useState(false);
  const [trailPips, setTrailPips] = React.useState("20");
  const [expiry, setExpiry] = React.useState<Expiry>("GTC");
  const [expiryDate, setExpiryDate] = React.useState("2026-09-30");
  const [oco, setOco] = React.useState(false);
  const [ocoPrice, setOcoPrice] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [calcOpen, setCalcOpen] = React.useState(false);
  const [riskMode, setRiskMode] = React.useState<"pct" | "usd">("pct");
  const [risk, setRisk] = React.useState("1");
  const [riskPips, setRiskPips] = React.useState("25");
  const [busy, setBusy] = React.useState(false);

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPrice("");
    setStopLimit("");
    setOcoPrice("");
    if (stopMode === "price") {
      setSl("");
      setTp("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  if (T.guest) return <GuestTicket symbol={symbol} />;

  if (T.readOnly) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-warn/30 bg-warn-soft text-warn">
            <Lock className="size-4" />
          </div>
          <div className="text-[13px] font-medium">Read-only session</div>
          <p className="mt-1 text-[12px] leading-relaxed text-fg-3">
            You are connected to {acc.login} with the investor password. Quotes, charts and history are live; trading is disabled.
          </p>
        </div>
      </div>
    );
  }

  const vol = Math.max(0.01, parseFloat(volume) || 0);
  const pending = type !== "market";
  const pv = pipValuePerLot(symbol, q.bid);
  const balance = m.balance;
  const riskUsd = riskMode === "pct" ? (balance * (parseFloat(risk) || 0)) / 100 : (parseFloat(risk) || 0) / (acc.cent ? 100 : 1);
  const calcLots = Math.max(0.01, Math.floor((riskUsd / ((parseFloat(riskPips) || 1) * pv)) * 100) / 100);
  const margin = marginRequired(symbol, vol, q.ask, acc.leverage);
  const spreadPts = Math.round((q.ask - q.bid) * 10 ** inst.digits);
  const units = vol * inst.contractSize;
  const unitLabel = inst.assetClass === "forex" ? splitSymbol(symbol).base : inst.assetClass === "metals" ? (symbol === "XAUUSD" ? "oz" : "oz") : inst.assetClass === "energies" ? "bbl" : inst.assetClass === "stocks" ? "shares" : "units";

  const entryFor = (side: "buy" | "sell") => (pending ? parseFloat(type === "stop-limit" && stopLimit ? stopLimit : price) || (side === "buy" ? q.ask : q.bid) : side === "buy" ? q.ask : q.bid);
  const stopsFor = (side: "buy" | "sell") => {
    if (stopMode === "price") return { sl: parseFloat(sl) || undefined, tp: parseFloat(tp) || undefined };
    const e = entryFor(side);
    const s = parseFloat(sl);
    const t = parseFloat(tp);
    const dir = side === "buy" ? 1 : -1;
    return { sl: s > 0 ? +(e - dir * s * pip).toFixed(inst.digits) : undefined, tp: t > 0 ? +(e + dir * t * pip).toFixed(inst.digits) : undefined };
  };
  const slUsd = (side: "buy" | "sell") => {
    const st = stopsFor(side).sl;
    if (st === undefined) return null;
    return -Math.abs(entryFor(side) - st) * vol * inst.contractSize * (pv / (pip * inst.contractSize));
  };
  const tpUsd = (side: "buy" | "sell") => {
    const st = stopsFor(side).tp;
    if (st === undefined) return null;
    return Math.abs(st - entryFor(side)) * vol * inst.contractSize * (pv / (pip * inst.contractSize));
  };

  const submit = async (side: "buy" | "sell") => {
    if (!marketOpen || busy) return;
    if (pending && !price) {
      toast.error("Enter a price for the pending order");
      return;
    }
    const st = stopsFor(side);
    setBusy(true);
    const ok = await T.placeOrder({
      symbol,
      side,
      type,
      volume: vol,
      price: pending ? parseFloat(price) : undefined,
      stopLimit: type === "stop-limit" ? parseFloat(stopLimit) || parseFloat(price) : undefined,
      sl: st.sl,
      tp: st.tp,
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

  const applyCalc = () => {
    setVolume(calcLots.toFixed(2));
    setStopMode("pips");
    setSl(riskPips);
    setTp(String((parseFloat(riskPips) || 0) * 2));
    toast.success(`Volume set to ${calcLots.toFixed(2)} lots`, { description: `Risking ${accMoney(acc, riskUsd)} ${accCcy(acc)} over ${riskPips} pips · TP at 1:2` });
  };

  const priceStep = pip / 10 >= 1 / 10 ** inst.digits ? pip / 10 : 1 / 10 ** inst.digits;
  const dialog = variant === "dialog";

  return (
    <div className={cn("space-y-2.5", dialog ? "p-0" : "p-2.5")}>
      {/* symbol + account */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
            <SymbolAvatar symbol={symbol} size={14} />
          </span>
          <TSelect ariaLabel="Symbol" value={symbol} onChange={(v) => (onSymbol ? onSymbol(v) : T.openSymbol(v))} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} · ${i.name}` }))} className="pl-7 font-medium" />
        </div>
      </div>

      {/* type */}
      <div className="grid grid-cols-4 gap-0.5 rounded-[7px] border border-line bg-surface-2 p-0.5">
        {TYPES.map((t) => (
          <button key={t.value} onClick={() => setType(t.value)} className={cn("h-6 whitespace-nowrap rounded-[5px] px-0.5 text-[11px] font-medium tracking-tight transition-colors", type === t.value ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--k-border-top)]" : "text-fg-3 hover:text-fg-2")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* volume */}
      <div>
        <Label
          right={
            <span className="flex gap-0.5">
              {[0.01, 0.1, 0.5, 1, 2].map((v) => (
                <button key={v} onClick={() => setVolume(v.toFixed(2))} className={cn("k-num rounded-[4px] px-1 font-mono text-[10px]", Math.abs(vol - v) < 1e-9 ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg-2")}>
                  {v}
                </button>
              ))}
            </span>
          }
        >
          Volume, lots
        </Label>
        <Stepper ariaLabel="Volume" value={volume} onChange={setVolume} step={0.01} min={0.01} decimals={2} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-3">
          <span>
            {units.toLocaleString("en-US", { maximumFractionDigits: 2 })} {unitLabel}
          </span>
          <span>Pip {accMoney(acc, pv * vol)}</span>
        </div>
      </div>

      {pending && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{type === "stop-limit" ? "Stop price" : `${type === "limit" ? "Limit" : "Stop"} price`}</Label>
            <Stepper ariaLabel="Order price" value={price} onChange={setPrice} step={priceStep} placeholder={fmtPrice(symbol, q.ask)} decimals={inst.digits} />
          </div>
          {type === "stop-limit" ? (
            <div>
              <Label>Limit price</Label>
              <Stepper ariaLabel="Stop-limit price" value={stopLimit} onChange={setStopLimit} step={priceStep} placeholder={price || fmtPrice(symbol, q.ask)} decimals={inst.digits} />
            </div>
          ) : (
            <div>
              <Label>Expiry</Label>
              <TSelect ariaLabel="Expiry" value={expiry} onChange={setExpiry} options={[{ value: "GTC", label: "GTC" }, { value: "Today", label: "Today" }, { value: "Date", label: "Specified date" }]} />
            </div>
          )}
          {type === "stop-limit" && (
            <div className="col-span-2">
              <Label>Expiry</Label>
              <TSelect ariaLabel="Expiry" value={expiry} onChange={setExpiry} options={[{ value: "GTC", label: "GTC" }, { value: "Today", label: "Today" }, { value: "Date", label: "Specified date" }]} />
            </div>
          )}
          {expiry === "Date" && (
            <div className="col-span-2">
              <TInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} aria-label="Expiry date" className="font-mono" />
            </div>
          )}
          {type !== "stop-limit" && (
            <div className="col-span-2 space-y-1.5 rounded-[6px] border border-line bg-surface-2/50 p-2">
              <Check checked={oco} onChange={setOco} label={<span>OCO — also place the opposite {type} at</span>} />
              {oco && <Stepper ariaLabel="OCO price" value={ocoPrice} onChange={setOcoPrice} step={priceStep} placeholder={fmtPrice(symbol, q.bid)} decimals={inst.digits} />}
            </div>
          )}
        </div>
      )}

      {/* SL / TP */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">Protection</span>
          <div className="flex rounded-[5px] border border-line bg-surface-2 p-px">
            {(["pips", "price"] as const).map((mm) => (
              <button
                key={mm}
                onClick={() => {
                  setStopMode(mm);
                  setSl("");
                  setTp("");
                }}
                className={cn("h-4 rounded-[4px] px-1.5 text-[9.5px] font-medium uppercase", stopMode === mm ? "bg-surface-3 text-fg" : "text-fg-3")}
              >
                {mm}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[10.5px] text-down/90">Stop loss{stopMode === "pips" ? ", pips" : ""}</div>
            <Stepper ariaLabel="Stop loss" tone="down" value={sl} onChange={setSl} step={stopMode === "pips" ? 1 : pip} placeholder="Not set" decimals={stopMode === "pips" ? 0 : inst.digits} />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] text-up/90">Take profit{stopMode === "pips" ? ", pips" : ""}</div>
            <Stepper ariaLabel="Take profit" tone="up" value={tp} onChange={setTp} step={stopMode === "pips" ? 1 : pip} placeholder="Not set" decimals={stopMode === "pips" ? 0 : inst.digits} />
          </div>
        </div>
        {(sl || tp) && (
          <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[10px] text-fg-3">
            <span>{slUsd("buy") !== null && <>Buy {fmtPrice(symbol, stopsFor("buy").sl!)} · <span className="text-down">{accMoney(acc, slUsd("buy")!, { signed: true })}</span></>}</span>
            <span>{tpUsd("buy") !== null && <>Buy {fmtPrice(symbol, stopsFor("buy").tp!)} · <span className="text-up">{accMoney(acc, tpUsd("buy")!, { signed: true })}</span></>}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <Check checked={trailing} onChange={setTrailing} label="Trailing stop (server-side)" />
          {trailing && (
            <div className="flex w-[92px] items-center gap-1">
              <TInput value={trailPips} onChange={(e) => setTrailPips(e.target.value.replace(/[^0-9.]/g, ""))} className="h-6 text-right font-mono" aria-label="Trailing pips" />
              <span className="text-[10px] text-fg-3">pips</span>
            </div>
          )}
        </div>
      </div>

      {/* risk calculator */}
      <div className="rounded-[7px] border border-gold/20 bg-gold-soft/30">
        <button onClick={() => setCalcOpen(!calcOpen)} className="flex h-7 w-full items-center gap-1.5 whitespace-nowrap px-2 text-[11.5px] font-medium text-gold">
          <Calculator className="size-3.5" /> Risk calculator
          <span className="ml-auto font-mono text-[10.5px] font-normal text-fg-3">{calcLots.toFixed(2)} lots</span>
          {calcOpen ? <ChevronUp className="size-3 text-fg-3" /> : <ChevronDown className="size-3 text-fg-3" />}
        </button>
        {calcOpen && (
          <div className="space-y-2 border-t border-gold/15 p-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-[10.5px] text-fg-3">
                  <span>Risk</span>
                  <span className="flex rounded-[4px] border border-line bg-surface-2 p-px">
                    {(["pct", "usd"] as const).map((rm) => (
                      <button key={rm} onClick={() => setRiskMode(rm)} className={cn("h-3.5 rounded-[3px] px-1 text-[9px] font-semibold", riskMode === rm ? "bg-surface-3 text-fg" : "text-fg-3")}>
                        {rm === "pct" ? "%" : acc.cent ? "¢" : "$"}
                      </button>
                    ))}
                  </span>
                </div>
                <Stepper ariaLabel="Risk" value={risk} onChange={setRisk} step={riskMode === "pct" ? 0.25 : 25} decimals={riskMode === "pct" ? 2 : 0} />
              </div>
              <div>
                <div className="mb-1 text-[10.5px] text-fg-3">SL distance, pips</div>
                <Stepper ariaLabel="SL distance" value={riskPips} onChange={setRiskPips} step={1} decimals={0} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                ["Lots", calcLots.toFixed(2)],
                ["Pip value", accMoney(acc, pv * calcLots)],
                ["Margin", accMoney(acc, marginRequired(symbol, calcLots, q.ask, acc.leverage), { decimals: 0 })],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[5px] bg-panel/70 px-1 py-1">
                  <div className="text-[9px] uppercase tracking-[0.06em] text-fg-3">{k}</div>
                  <div className="k-num font-mono text-[11.5px] text-fg">{v}</div>
                </div>
              ))}
            </div>
            <button onClick={applyCalc} className="h-6 w-full rounded-[5px] bg-gold/90 text-[11px] font-semibold text-[#1a1204] hover:bg-gold">
              Apply {calcLots.toFixed(2)} lots · SL {riskPips} · TP {(parseFloat(riskPips) || 0) * 2}
            </button>
          </div>
        )}
      </div>

      {dialog && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Comment</Label>
            <TInput value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional" maxLength={31} />
          </div>
          <div>
            <Label>Max deviation, pts</Label>
            <Stepper ariaLabel="Max deviation" value={String(T.ws.deviation)} onChange={(v) => T.setWs({ deviation: Math.max(0, Math.round(parseFloat(v) || 0)) })} step={1} decimals={0} />
          </div>
        </div>
      )}

      {/* summary */}
      <div className="space-y-0.5 rounded-[6px] border border-line bg-surface-2/40 px-2 py-1.5 font-mono text-[11px]">
        {[
          ["Margin", `${accMoney(acc, margin)} ${accCcy(acc)}`],
          ["Free margin", `${accMoney(acc, m.free)}`],
          ["Leverage · spread", `1:${acc.leverage} · ${spreadPts} pts`],
          ...(!dialog ? [["Deviation", `${T.ws.deviation} pts`]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="font-sans text-fg-3">{k}</span>
            <span className={cn("k-num", k === "Free margin" && margin > m.free ? "text-down" : "text-fg-2")}>{v}</span>
          </div>
        ))}
      </div>

      {/* sell / buy */}
      <div className="relative grid grid-cols-2 gap-1.5">
        <button onClick={() => void submit("sell")} disabled={!marketOpen || busy} title={marketOpen ? undefined : "Market closed"} aria-label={pending ? `Place sell ${type} order` : "Place sell order"} className={cn("group rounded-[7px] bg-down px-2.5 py-1.5 text-left text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100 [&:disabled_span]:!text-fg-3", prefill?.side === "sell" && "ring-2 ring-down/40 ring-offset-1 ring-offset-panel")}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-85">{pending ? `Sell ${type === "stop-limit" ? "stop limit" : type}` : "Sell"}</div>
          <PriceText symbol={symbol} value={pending && price ? parseFloat(price) || q.bid : q.bid} dir={pending ? 0 : q.dir} className="text-[16px] [&_span]:!text-white" />
        </button>
        <button onClick={() => void submit("buy")} disabled={!marketOpen || busy} title={marketOpen ? undefined : "Market closed"} aria-label={pending ? `Place buy ${type} order` : "Place buy order"} className={cn("rounded-[7px] bg-up px-2.5 py-1.5 text-right text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100 [&:disabled_span]:!text-fg-3", prefill?.side === "buy" && "ring-2 ring-up/40 ring-offset-1 ring-offset-panel")}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-85">{pending ? `Buy ${type === "stop-limit" ? "stop limit" : type}` : "Buy"}</div>
          <PriceText symbol={symbol} value={pending && price ? parseFloat(price) || q.ask : q.ask} dir={pending ? 0 : q.dir} className="justify-end text-[16px] [&_span]:!text-white" />
        </button>
        <span className="k-num absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[4px] border border-line bg-panel px-1.5 py-px font-mono text-[10px] text-fg-2">{spreadPts}</span>
      </div>
      {!marketOpen && (
        <div role="status" className="flex items-center gap-1.5 rounded-[6px] border border-warn/30 bg-warn-soft px-2 py-1 text-[11px] text-warn">
          <Lock className="size-3" /> Market closed · {symbol} trading is unavailable until the session opens
        </div>
      )}
      <div className="flex items-center justify-between text-[10.5px] text-fg-3">
        <span className="flex items-center gap-1.5">
          <Zap className={cn("size-3", T.ws.oneClick ? "text-ember" : "")} /> One-click trading
        </span>
        <MiniSwitch checked={T.ws.oneClick} onChange={(v) => T.setWs({ oneClick: v })} label="One-click trading" />
      </div>
    </div>
  );
}

/** Guest mode: live prices for the symbol, trade buttons that explain instead of trading. */
function GuestTicket({ symbol }: { symbol: string }) {
  const T = useTerminal();
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  const spreadPts = Math.round((q.ask - q.bid) * 10 ** inst.digits);
  return (
    <div className="space-y-3 p-2.5">
      <div className="flex items-center gap-2.5">
        <SymbolAvatar symbol={symbol} size={24} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{symbol}</div>
          <div className="truncate text-[11px] text-fg-3">{inst.name}</div>
        </div>
        <span className="ml-auto font-mono text-[10.5px] text-fg-3">spread {spreadPts}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => T.quickTrade(symbol, "sell")} title={GUEST_TITLE} aria-label={`Sell ${symbol} (needs a trading account)`} className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-3">
          <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-down">
            Sell <Lock className="size-2.5 text-fg-3" />
          </span>
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[15px]" />
        </button>
        <button onClick={() => T.quickTrade(symbol, "buy")} title={GUEST_TITLE} aria-label={`Buy ${symbol} (needs a trading account)`} className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-1.5 text-right transition-colors hover:bg-surface-3">
          <span className="flex items-center justify-end gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-up">
            <Lock className="size-2.5 text-fg-3" /> Buy
          </span>
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} className="justify-end text-[15px]" />
        </button>
      </div>
      <div className="rounded-[8px] border border-ember/25 bg-ember-soft/40 px-3 py-3 text-center">
        <div className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
          <Lock className="size-3.5" />
        </div>
        <div className="text-[12.5px] font-semibold text-fg">{GUEST_TITLE}</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">Market, limit and stop orders, SL/TP, trailing stops and one-click trading work here once you log in to a trading account.</p>
        <GuestActions className="mt-2.5" />
      </div>
    </div>
  );
}

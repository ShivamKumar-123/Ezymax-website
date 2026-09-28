"use client";

import * as React from "react";
import { ArrowLeftRight, Edit3, Scissors, X } from "lucide-react";
import { getInstrument } from "@kalks/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { usePositionProfit, useTerminal } from "@/lib/store";
import { PENDING_LABEL, accCcy, accMoney, fmtPrice, fmtServer, fmtVol, pipSize, profitAt, profitUsd } from "@/lib/trading";
import { Badge, Pnl, Stepper, TButton, TDialog, TSelect } from "@/components/ui/primitives";
import { TickSpark } from "@/components/order/right-panel";

const TRAIL_OPTIONS = ["none", "15", "20", "30", "50", "100", "custom"] as const;

/** Modify / close a position: partial close, SL/TP, trailing stop, Close By (hedging). */
export function PositionDialog() {
  const T = useTerminal();
  const ticket = T.ui.positionDialog;
  const p = T.positions.find((x) => x.ticket === ticket);
  const close = React.useCallback(() => T.setUi({ positionDialog: null }), [T]);
  React.useEffect(() => {
    if (ticket && !p) close();
  }, [ticket, p, close]);
  if (!ticket || !p) return null;
  return <PositionDialogBody key={ticket} ticket={ticket} onClose={close} />;
}

function PositionDialogBody({ ticket, onClose }: { ticket: string; onClose: () => void }) {
  const T = useTerminal();
  const p = T.positions.find((x) => x.ticket === ticket)!;
  const q = useQuote(p.symbol);
  const inst = getInstrument(p.symbol);
  const pip = pipSize(inst);
  const a = T.account;
  const [vol, setVol] = React.useState(fmtVol(p.volume));
  const [sl, setSl] = React.useState(p.sl !== undefined ? fmtPrice(p.symbol, p.sl) : "");
  const [tp, setTp] = React.useState(p.tp !== undefined ? fmtPrice(p.symbol, p.tp) : "");
  const initialTrail = p.trailing ? String(Math.round(p.trailing / pip)) : "none";
  const [trail, setTrail] = React.useState<string>(TRAIL_OPTIONS.includes(initialTrail as never) ? initialTrail : "custom");
  const [trailCustom, setTrailCustom] = React.useState(p.trailing ? String(Math.round(p.trailing / pip)) : "25");
  const pr = usePositionProfit(p);
  const cur = p.side === "buy" ? q.bid : q.ask;
  const v = Math.min(p.volume, Math.max(0.01, parseFloat(vol) || 0));
  const partial = v < p.volume - 1e-9;
  const slN = parseFloat(sl);
  const tpN = parseFloat(tp);
  const slUsd = sl ? profitAt(p, slN) : null;
  const tpUsd = tp ? profitAt(p, tpN) : null;
  const opp = T.positions.filter((x) => x.symbol === p.symbol && x.side !== p.side);
  const hedging = a.mode === "hedging";
  const trailPips = trail === "none" ? 0 : trail === "custom" ? parseFloat(trailCustom) || 0 : parseFloat(trail);

  const pipsFrom = (price: number) => ((p.side === "buy" ? price - p.openPrice : p.openPrice - price) / pip).toFixed(1);

  const modify = async () => {
    const ok = await T.modifyPosition(p.ticket, { sl: sl ? slN : null, tp: tp ? tpN : null, trailing: trailPips ? trailPips * pip : null });
    if (ok) onClose();
  };
  const nudge = (which: "sl" | "tp", pips: number) => {
    const base = p.side === "buy" ? cur : cur;
    const dir = (which === "tp" ? 1 : -1) * (p.side === "buy" ? 1 : -1);
    const val = fmtPrice(p.symbol, base + dir * pips * pip);
    if (which === "sl") setSl(val);
    else setTp(val);
  };

  return (
    <TDialog
      open
      onClose={onClose}
      width={720}
      icon={<Edit3 />}
      title={
        <span>
          Position #{p.ticket} <span className={p.side === "buy" ? "text-up" : "text-down"}>{p.side}</span> {fmtVol(p.volume)} {p.symbol}
        </span>
      }
      subtitle={`${a.login} · ${a.mode}`}
    >
      <div className="grid md:grid-cols-[260px_1fr]">
        {/* left: position summary */}
        <div className="space-y-3 border-b border-line p-3.5 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2.5">
            <SymbolAvatar symbol={p.symbol} size={24} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{p.symbol}</div>
              <div className="truncate text-[11px] text-fg-3">{inst.name}</div>
            </div>
            <Badge tone={p.side === "buy" ? "up" : "down"} className="ml-auto">
              {p.side}
            </Badge>
          </div>
          <div className="rounded-[7px] border border-line bg-surface-2/50 p-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-fg-3">Floating profit</div>
            <div className="mt-0.5 text-[22px] font-semibold leading-tight">
              <Pnl value={pr} text={accMoney(a, pr, { signed: true })} />
              <span className="ml-1.5 text-[11px] font-normal text-fg-3">{accCcy(a)}</span>
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-fg-3">{pipsFrom(cur)} pips</div>
            <TickSpark symbol={p.symbol} height={40} />
          </div>
          <div className="space-y-1 font-mono text-[11.5px]">
            {[
              ["Open price", fmtPrice(p.symbol, p.openPrice)],
              ["Current", <PriceText key="c" symbol={p.symbol} value={cur} dir={q.dir} />],
              ["Opened", fmtServer(p.openTime)],
              ["Swap · commission", `${accMoney(a, p.swap)} · ${accMoney(a, -p.commission)}`],
              ["Source", p.source],
            ].map(([k, val]) => (
              <div key={String(k)} className="flex justify-between gap-2">
                <span className="font-sans text-fg-3">{k}</span>
                <span className="text-fg-2">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right: actions */}
        <div className="space-y-4 p-3.5">
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
              <Scissors className="size-3" /> Close {partial ? "partially" : "position"}
            </div>
            <div className="flex items-center gap-2">
              <Stepper ariaLabel="Close volume" value={vol} onChange={setVol} step={0.01} min={0.01} decimals={2} className="w-[130px]" />
              <div className="flex gap-0.5">
                {[0.25, 0.5, 1].map((f) => (
                  <button key={f} onClick={() => setVol(fmtVol(Math.max(0.01, Math.floor(p.volume * f * 100) / 100)))} className="h-6 rounded-[5px] border border-line px-1.5 font-mono text-[10.5px] text-fg-2 hover:bg-surface-3">
                    {f * 100}%
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                T.closePosition(p.ticket, v);
                if (!partial) onClose();
                else setVol(fmtVol(Math.max(0.01, p.volume - v)));
              }}
              className={cn("mt-2 flex h-9 w-full items-center justify-between rounded-[7px] px-3 text-[12.5px] font-semibold text-white hover:brightness-110", p.side === "buy" ? "bg-down" : "bg-up")}
            >
              <span>
                Close #{p.ticket} {p.side} {fmtVol(v)} {p.symbol} at {fmtPrice(p.symbol, cur)}
              </span>
              <span className="font-mono text-[11.5px] opacity-90">{accMoney(a, profitAt({ ...p, volume: v }, cur), { signed: true })}</span>
            </button>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
              <Edit3 className="size-3" /> Modify
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(["sl", "tp"] as const).map((k) => {
                const val = k === "sl" ? sl : tp;
                const set = k === "sl" ? setSl : setTp;
                const usd = k === "sl" ? slUsd : tpUsd;
                return (
                  <div key={k}>
                    <div className={cn("mb-1 flex items-center justify-between text-[10.5px]", k === "sl" ? "text-down/90" : "text-up/90")}>
                      <span>{k === "sl" ? "Stop Loss" : "Take Profit"}</span>
                      <span className="flex gap-0.5">
                        {[10, 25, 50].map((n) => (
                          <button key={n} onClick={() => nudge(k, n)} className="rounded-[3px] px-1 font-mono text-[9.5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                            {n}p
                          </button>
                        ))}
                        {val && (
                          <button onClick={() => set("")} className="rounded-[3px] px-1 text-[9.5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                            clear
                          </button>
                        )}
                      </span>
                    </div>
                    <Stepper ariaLabel={k === "sl" ? "Stop loss" : "Take profit"} tone={k === "sl" ? "down" : "up"} value={val} onChange={set} step={pip} placeholder="Not set" decimals={inst.digits} />
                    <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-3">
                      <span>{val ? `${pipsFrom(parseFloat(val))} pips` : "—"}</span>
                      {usd !== null && <span className={usd >= 0 ? "text-up" : "text-down"}>{accMoney(a, usd + p.swap - p.commission, { signed: true })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 grid grid-cols-[1fr_auto] items-end gap-2">
              <div>
                <div className="mb-1 text-[10.5px] text-fg-3">Trailing stop (server-side)</div>
                <div className="flex gap-1.5">
                  <TSelect ariaLabel="Trailing stop" value={trail} onChange={setTrail} options={TRAIL_OPTIONS.map((o) => ({ value: o, label: o === "none" ? "None" : o === "custom" ? "Custom…" : `${o} pips` }))} className="w-[130px]" />
                  {trail === "custom" && <Stepper ariaLabel="Custom trailing pips" value={trailCustom} onChange={setTrailCustom} step={1} decimals={0} className="w-[110px]" />}
                </div>
              </div>
              <TButton variant="ember" size="md" onClick={modify}>
                Modify
              </TButton>
            </div>
            <button onClick={() => setSl(fmtPrice(p.symbol, p.openPrice))} className="mt-1.5 text-[11px] text-fg-3 underline-offset-2 hover:text-fg hover:underline">
              Move SL to breakeven ({fmtPrice(p.symbol, p.openPrice)})
            </button>
          </section>

          {hedging && (
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                <ArrowLeftRight className="size-3" /> Close By
              </div>
              {opp.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-line px-3 py-2 text-[11.5px] text-fg-3">No opposite {p.side === "buy" ? "sell" : "buy"} position on {p.symbol} to close by.</div>
              ) : (
                <div className="space-y-1">
                  {opp.map((o) => (
                    <div key={o.ticket} className="flex items-center gap-2 rounded-[6px] border border-line bg-surface-2/40 px-2.5 py-1.5 font-mono text-[11.5px]">
                      <span className={o.side === "buy" ? "text-up" : "text-down"}>{o.side}</span>
                      <span>#{o.ticket}</span>
                      <span className="text-fg-2">
                        {fmtVol(o.volume)} at {fmtPrice(o.symbol, o.openPrice)}
                      </span>
                      <TButton size="xs" variant="surface" className="ml-auto" onClick={() => (T.closeBy(p.ticket, o.ticket), onClose())}>
                        Close by #{o.ticket}
                      </TButton>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </TDialog>
  );
}

/** Modify / delete a pending order. */
export function PendingDialog() {
  const T = useTerminal();
  const ticket = T.ui.pendingDialog;
  const o = T.pendings.find((x) => x.ticket === ticket);
  const close = React.useCallback(() => T.setUi({ pendingDialog: null }), [T]);
  if (!ticket || !o) return null;
  return <PendingBody key={ticket} ticket={ticket} onClose={close} />;
}

function PendingBody({ ticket, onClose }: { ticket: string; onClose: () => void }) {
  const T = useTerminal();
  const o = T.pendings.find((x) => x.ticket === ticket)!;
  const q = useQuote(o.symbol);
  const inst = getInstrument(o.symbol);
  const pip = pipSize(inst);
  const [price, setPrice] = React.useState(fmtPrice(o.symbol, o.price));
  const [sl, setSl] = React.useState(o.sl !== undefined ? fmtPrice(o.symbol, o.sl) : "");
  const [tp, setTp] = React.useState(o.tp !== undefined ? fmtPrice(o.symbol, o.tp) : "");
  return (
    <TDialog
      open
      onClose={onClose}
      width={440}
      icon={<Edit3 />}
      title={`Order #${o.ticket} · ${PENDING_LABEL(o)} ${fmtVol(o.volume)} ${o.symbol}`}
      footer={
        <>
          <TButton variant="ghost" className="mr-auto text-down hover:text-down" onClick={() => (T.cancelPending(o.ticket), onClose())}>
            <X /> Delete order
          </TButton>
          <TButton variant="ghost" onClick={onClose}>
            Cancel
          </TButton>
          <TButton variant="ember" onClick={() => void T.modifyPending(o.ticket, { price: parseFloat(price), sl: sl ? parseFloat(sl) : null, tp: tp ? parseFloat(tp) : null }).then((ok) => ok && onClose())}>
            Modify
          </TButton>
        </>
      }
    >
      <div className="space-y-3 p-3.5">
        <div className="flex items-center justify-between font-mono text-[12px]">
          <span className="flex items-center gap-2 font-sans font-medium">
            <SymbolAvatar symbol={o.symbol} size={18} /> {o.symbol}
          </span>
          <span className="text-fg-3">
            Bid <span className="text-fg">{fmtPrice(o.symbol, q.bid)}</span> · Ask <span className="text-fg">{fmtPrice(o.symbol, q.ask)}</span>
          </span>
        </div>
        <div>
          <div className="mb-1 text-[10.5px] text-fg-3">Price</div>
          <Stepper ariaLabel="Order price" value={price} onChange={setPrice} step={pip / 10 >= 1 / 10 ** inst.digits ? pip / 10 : 1 / 10 ** inst.digits} decimals={inst.digits} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[10.5px] text-down/90">Stop Loss</div>
            <Stepper ariaLabel="Stop loss" tone="down" value={sl} onChange={setSl} step={pip} placeholder="Not set" decimals={inst.digits} />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] text-up/90">Take Profit</div>
            <Stepper ariaLabel="Take profit" tone="up" value={tp} onChange={setTp} step={pip} placeholder="Not set" decimals={inst.digits} />
          </div>
        </div>
        <div className="font-mono text-[11px] text-fg-3">
          Expiry {o.expiry === "Date" ? o.expiryDate : o.expiry} · placed {fmtServer(o.placed)} {o.oco && "· OCO linked"}
        </div>
      </div>
    </TDialog>
  );
}

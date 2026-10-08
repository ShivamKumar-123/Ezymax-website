"use client";

import * as React from "react";
import { ArrowLeftRight, Edit3, Scissors, X } from "lucide-react";
import { getInstrument } from "@ezymex/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@ezymex/ui";
import { usePositionProfit, useTerminal } from "@/lib/store";
import { accCcy, accMoney, fmtPrice, fmtServer, fmtVol, pendingLabelKey, pipSize, profitAt, profitUsd } from "@/lib/trading";
import { Badge, Pnl, Stepper, TButton, TDialog, TSelect } from "@/components/ui/primitives";
import { TickSpark } from "@/components/order/right-panel";
import { Trans, useT } from "@ezymex/i18n/react";

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
  const t = useT();
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
      width={780}
      icon={<Edit3 />}
      title={
        <span>
          <Trans k="order.position.title" vars={{ ticket: p.ticket, side: t(`order.side.${p.side}`), volume: fmtVol(p.volume), symbol: p.symbol }} tags={{ side: (c) => <span className={p.side === "buy" ? "text-up" : "text-down"}>{c}</span> }} />
        </span>
      }
      subtitle={`${a.login} · ${t.dyn(`order.mode.${a.mode}`, a.mode)}`}
    >
      <div className="grid md:grid-cols-[280px_1fr]">
        {/* left: position summary */}
        <div className="space-y-3.5 border-b border-line bg-panel-2/40 p-4 md:border-b-0 md:border-e">
          <div className="flex items-center gap-2.5">
            <SymbolAvatar symbol={p.symbol} size={24} />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">{p.symbol}</div>
              <div className="truncate text-[12px] text-fg-3">{inst.name}</div>
            </div>
            <Badge tone={p.side === "buy" ? "up" : "down"} className="ms-auto">
              {t(`order.side.${p.side}`)}
            </Badge>
          </div>
          <div className="rounded-[10px] border border-line bg-panel p-3">
            <div className="text-[12px] text-fg-3">{t("order.position.floatingProfit")}</div>
            <div className="mt-0.5 text-[24px] font-semibold leading-tight">
              <Pnl value={pr} text={accMoney(a, pr, { signed: true })} />
              <span className="ms-1.5 text-[12px] font-normal text-fg-3">{accCcy(a)}</span>
            </div>
            <div className="mt-0.5 font-mono text-[12px] text-fg-3">{t("order.unit.pips", { n: pipsFrom(cur) })}</div>
            <TickSpark symbol={p.symbol} height={40} />
          </div>
          <div className="space-y-1.5 font-mono text-[12.5px]">
            {[
              [t("order.position.openPrice"), fmtPrice(p.symbol, p.openPrice)],
              [t("order.position.current"), <PriceText key="c" symbol={p.symbol} value={cur} dir={q.dir} />],
              [t("order.position.opened"), <span key="o" dir="ltr">{fmtServer(p.openTime)}</span>],
              [t("order.position.swapCommission"), `${accMoney(a, p.swap)} · ${accMoney(a, -p.commission)}`],
              [t("order.position.source"), t.dyn(`order.source.${p.source}`, p.source)],
            ].map(([k, val]) => (
              <div key={String(k)} className="flex justify-between gap-2">
                <span className="font-sans text-fg-3">{k}</span>
                <span className="text-fg-2">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right: actions */}
        <div className="space-y-5 p-4">
          <section>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-fg [&>svg]:size-4 [&>svg]:text-fg-3">
              <Scissors /> {partial ? t("order.position.closePartially") : t("order.position.closePosition")}
            </div>
            <div className="flex items-center gap-2">
              <Stepper size="md" ariaLabel={t("order.position.closeVolume")} value={vol} onChange={setVol} step={0.01} min={0.01} decimals={2} className="w-[150px]" />
              <div className="flex gap-1">
                {[0.25, 0.5, 1].map((f) => (
                  <button key={f} onClick={() => setVol(fmtVol(Math.max(0.01, Math.floor(p.volume * f * 100) / 100)))} className="h-8 rounded-[7px] border border-line px-2.5 font-mono text-[12.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
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
              className={cn("mt-2.5 flex h-10 w-full items-center justify-between gap-3 rounded-[10px] px-4 text-[13.5px] font-semibold text-white hover:brightness-110", p.side === "buy" ? "bg-sell-fill" : "bg-buy-fill")}
            >
              <span>
                {t("order.position.closeButton", { ticket: p.ticket, side: t(`order.side.${p.side}`), volume: fmtVol(v), symbol: p.symbol, price: fmtPrice(p.symbol, cur) })}
              </span>
              <span className="shrink-0 font-mono text-[13px] opacity-95">{accMoney(a, profitAt({ ...p, volume: v }, cur), { signed: true })}</span>
            </button>
          </section>

          <section>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-fg [&>svg]:size-4 [&>svg]:text-fg-3">
              <Edit3 /> {t("order.position.modify")}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(["sl", "tp"] as const).map((k) => {
                const val = k === "sl" ? sl : tp;
                const set = k === "sl" ? setSl : setTp;
                const usd = k === "sl" ? slUsd : tpUsd;
                return (
                  <div key={k}>
                    <div className={cn("mb-1.5 flex items-center justify-between text-[12.5px] font-medium", k === "sl" ? "text-down" : "text-up")}>
                      <span>{k === "sl" ? t("order.position.stopLoss") : t("order.position.takeProfit")}</span>
                      <span className="flex gap-0.5">
                        {[10, 25, 50].map((n) => (
                          <button key={n} onClick={() => nudge(k, n)} className="h-6 rounded-[5px] px-1.5 font-mono text-[11px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                            {t("order.unit.pipsShort", { n })}
                          </button>
                        ))}
                        {val && (
                          <button onClick={() => set("")} className="h-6 rounded-[5px] px-1.5 text-[11px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                            {t("order.position.clear")}
                          </button>
                        )}
                      </span>
                    </div>
                    <Stepper size="md" ariaLabel={k === "sl" ? t("order.ticket.stopLoss") : t("order.ticket.takeProfit")} tone={k === "sl" ? "down" : "up"} value={val} onChange={set} step={pip} placeholder={t("order.ticket.notSet")} decimals={inst.digits} />
                    <div className="mt-1 flex justify-between font-mono text-[12px] text-fg-3">
                      <span>{val ? t("order.unit.pips", { n: pipsFrom(parseFloat(val)) }) : "—"}</span>
                      {usd !== null && <span className={usd >= 0 ? "text-up" : "text-down"}>{accMoney(a, usd + p.swap - p.commission, { signed: true })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 grid grid-cols-[1fr_auto] items-end gap-2">
              <div>
                <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">{t("order.position.trailing")}</div>
                <div className="flex gap-1.5">
                  <TSelect ariaLabel={t("order.position.trailingAria")} value={trail} onChange={setTrail} options={TRAIL_OPTIONS.map((o) => ({ value: o, label: o === "none" ? t("order.position.trailNone") : o === "custom" ? t("order.position.trailCustom") : t("order.unit.pips", { n: o }) }))} className="w-[150px]" />
                  {trail === "custom" && <Stepper ariaLabel={t("order.position.trailCustomAria")} value={trailCustom} onChange={setTrailCustom} step={1} decimals={0} className="w-[110px]" />}
                </div>
              </div>
              <TButton variant="ember" size="md" onClick={modify} className="px-5">
                {t("order.position.modify")}
              </TButton>
            </div>
            <button onClick={() => setSl(fmtPrice(p.symbol, p.openPrice))} className="mt-2 h-7 rounded-[7px] border border-dashed border-line px-2.5 text-[12px] text-fg-2 hover:border-fg-3/60 hover:text-fg">
              {t("order.position.breakeven", { price: fmtPrice(p.symbol, p.openPrice) })}
            </button>
          </section>

          {hedging && (
            <section>
              <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-fg [&>svg]:size-4 [&>svg]:text-fg-3">
                <ArrowLeftRight /> {t("order.position.closeBy")}
              </div>
              {opp.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-line px-3 py-2.5 text-[12.5px] text-fg-3">{p.side === "buy" ? t("order.position.noOppositeSell", { symbol: p.symbol }) : t("order.position.noOppositeBuy", { symbol: p.symbol })}</div>
              ) : (
                <div className="space-y-1">
                  {opp.map((o) => (
                    <div key={o.ticket} className="flex items-center gap-2 rounded-[8px] border border-line bg-panel-2/50 px-3 py-2 font-mono text-[12.5px]">
                      <span className={o.side === "buy" ? "text-up" : "text-down"}>{t(`order.side.${o.side}`)}</span>
                      <span>#{o.ticket}</span>
                      <span className="text-fg-2">
                        {t("order.position.volumeAt", { volume: fmtVol(o.volume), price: fmtPrice(o.symbol, o.openPrice) })}
                      </span>
                      <TButton size="xs" variant="surface" className="ms-auto" onClick={() => (T.closeBy(p.ticket, o.ticket), onClose())}>
                        {t("order.position.closeByTicket", { ticket: o.ticket })}
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
  const t = useT();
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
      width={480}
      icon={<Edit3 />}
      title={t("order.pendingDialog.title", { ticket: o.ticket, label: t(pendingLabelKey(o)), volume: fmtVol(o.volume), symbol: o.symbol })}
      footer={
        <>
          <TButton variant="ghost" className="me-auto text-down hover:text-down" onClick={() => (T.cancelPending(o.ticket), onClose())}>
            <X /> {t("order.pendingDialog.delete")}
          </TButton>
          <TButton variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </TButton>
          <TButton variant="ember" onClick={() => void T.modifyPending(o.ticket, { price: parseFloat(price), sl: sl ? parseFloat(sl) : null, tp: tp ? parseFloat(tp) : null }).then((ok) => ok && onClose())}>
            {t("order.pendingDialog.modify")}
          </TButton>
        </>
      }
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between font-mono text-[12.5px]">
          <span className="flex items-center gap-2 font-sans font-medium">
            <SymbolAvatar symbol={o.symbol} size={18} /> {o.symbol}
          </span>
          <span className="text-fg-3">
            <Trans k="order.pendingDialog.bidAsk" vars={{ bid: fmtPrice(o.symbol, q.bid), ask: fmtPrice(o.symbol, q.ask) }} tags={{ b: (c) => <span className="text-fg">{c}</span>, a: (c) => <span className="text-fg">{c}</span> }} />
          </span>
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">{t("order.pendingDialog.price")}</div>
          <Stepper size="lg" ariaLabel={t("order.ticket.orderPrice")} value={price} onChange={setPrice} step={pip / 10 >= 1 / 10 ** inst.digits ? pip / 10 : 1 / 10 ** inst.digits} decimals={inst.digits} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-down">{t("order.position.stopLoss")}</div>
            <Stepper size="md" ariaLabel={t("order.ticket.stopLoss")} tone="down" value={sl} onChange={setSl} step={pip} placeholder={t("order.ticket.notSet")} decimals={inst.digits} />
          </div>
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-up">{t("order.position.takeProfit")}</div>
            <Stepper size="md" ariaLabel={t("order.ticket.takeProfit")} tone="up" value={tp} onChange={setTp} step={pip} placeholder={t("order.ticket.notSet")} decimals={inst.digits} />
          </div>
        </div>
        <div className="font-mono text-[12px] text-fg-3">
          {t("order.pendingDialog.meta", { expiry: o.expiry === "Date" ? o.expiryDate : o.expiry === "GTC" ? t("order.expiry.gtc") : t("order.expiry.today"), placed: fmtServer(o.placed) })} {o.oco && t("order.pendingDialog.ocoLinked")}
        </div>
      </div>
    </TDialog>
  );
}

"use client";

// Option order ticket: the legs picked from the chain (one series = a single order; several = a strategy that fills
// all-or-nothing), buy / sell, contracts, market or limit premium, stop loss / take profit on the premium, an
// optional trigger on the underlying (send when it trades above / below a price), and the live preview. Premiums
// are typed in USD per contract (plan O8) and sent per unit of the underlying, like the chain's bid / ask.
import * as React from "react";
import { Crosshair, Lock, MousePointerClick, Trash2, Wand2, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { GuestActions } from "@/components/shell/guest";
import { Check, Stepper, TSelect } from "@/components/ui/primitives";
import { optionsApi } from "@/lib/options/api";
import { errText, needsOnboarding } from "@/lib/options/errors";
import { usdPerUnitOf } from "@/lib/options/math";
import { opt, underlyingOf, useOpt, useSeriesQuote, type TicketLeg } from "@/lib/options-store";
import type { OptionQuote, OrderRequest } from "@/lib/options/types";
import { ErrorNote, Flash, RightTag, Seg, StateBadge } from "./bits";
import { expiryLabel, pips, px, usd } from "./format";
import { PreviewSummary, usePreview } from "./preview";

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">
      <span>{children}</span>
      {right && <span className="normal-case tracking-normal">{right}</span>}
    </div>
  );
}

/** USD per contract for one unit of premium (contract size × USD per quote currency). */
function useUsdPerUnit(q: OptionQuote | null): number {
  const chainUsd = useOpt((s) => usdPerUnitOf(s.chain));
  if (q && q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
  return chainUsd;
}

function LegRow({ leg, multi, locale }: { leg: TicketLeg; multi: boolean; locale: string }) {
  const t = useT();
  const q = useSeriesQuote(leg.series);
  const price = q ? (leg.side === "buy" ? q.askUsd : q.bidUsd) : 0;
  return (
    <div className="flex items-center gap-1.5 rounded-[7px] border border-line bg-surface-2/50 px-1.5 py-1">
      {multi && (
        <button onClick={() => opt.updateLeg(leg.id, { side: leg.side === "buy" ? "sell" : "buy" })} title={t("trader.opt.ticket.flipSide")} className={cn("h-5 w-9 shrink-0 rounded-[4px] text-[10px] font-bold uppercase", leg.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
          {leg.side === "buy" ? t("trader.opt.b") : t("trader.opt.s")}
        </button>
      )}
      <RightTag right={leg.right} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-mono text-[12px] font-semibold text-fg">{leg.strikeLabel}</div>
        <div className="truncate text-[10px] text-fg-3">
          {leg.u} · {expiryLabel(leg.expiry, locale, false)}
        </div>
      </div>
      {q && <StateBadge state={q.state} />}
      {multi && (
        <div className="w-[74px]">
          <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(leg.contracts)} onChange={(v) => opt.updateLeg(leg.id, { contracts: Math.max(1, Math.round(parseFloat(v) || 1)) })} step={1} min={1} decimals={0} className="h-6" />
        </div>
      )}
      <span className={cn("w-[56px] text-end font-mono text-[11.5px]", leg.side === "buy" ? "text-up" : "text-down")}>
        <Flash value={price}>{price ? usd(price) : "—"}</Flash>
      </span>
      <button onClick={() => opt.removeLeg(leg.id)} aria-label={t("trader.opt.ticket.removeLeg")} className="grid size-5 shrink-0 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
        <X className="size-3" />
      </button>
    </div>
  );
}

/** Buy / Sell buttons of a single-leg ticket, with the live ask / bid per contract. */
function SideButtons({ leg, pipSize }: { leg: TicketLeg; pipSize: number }) {
  const t = useT();
  const q = useSeriesQuote(leg.series);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(["sell", "buy"] as const).map((side) => {
        const on = leg.side === side;
        const v = q ? (side === "buy" ? q.askUsd : q.bidUsd) : 0;
        const p = q ? (side === "buy" ? q.ask : q.bid) : 0;
        return (
          <button
            key={side}
            onClick={() => opt.updateLeg(leg.id, { side })}
            aria-pressed={on}
            className={cn(
              "rounded-[7px] border px-2.5 py-1.5 transition",
              side === "buy" ? "text-end" : "text-start",
              on ? (side === "buy" ? "border-up bg-up text-white" : "border-down bg-down text-white") : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3",
            )}
          >
            <div className={cn("text-[10px] font-semibold uppercase tracking-[0.1em]", on ? "opacity-90" : side === "buy" ? "text-up" : "text-down")}>{side === "buy" ? t("common.buy") : t("common.sell")}</div>
            <div className="k-num font-mono text-[15px] font-semibold">
              <Flash value={v}>{v ? usd(v) : "—"}</Flash>
            </div>
            <div className={cn("font-mono text-[9.5px]", on ? "opacity-80" : "text-fg-3")}>{q ? `${pips(p / pipSize)} ${t("trader.opt.pips")}` : " "}</div>
          </button>
        );
      })}
    </div>
  );
}

export function OptionTicket({ onDone, className }: { onDone?: () => void; className?: string }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const ticket = useOpt((s) => s.ticket);
  const cur = useOpt((s) => underlyingOf(s, s.ticket.legs[0]?.u ?? s.u));
  const digits = useOpt((s) => s.chain?.digits ?? cur?.digits ?? 5);
  const tradingSoon = useOpt((s) => s.tradingSoon);
  const publicView = useOpt((s) => s.publicView);
  const legs = ticket.legs;
  const single = legs.length === 1 ? legs[0]! : null;
  const q0 = useSeriesQuote(single?.series);
  const usdPerUnit = useUsdPerUnit(q0);
  const [busy, setBusy] = React.useState(false);
  const [lastErr, setLastErr] = React.useState<{ code: string; message: string } | null>(null);
  const u = legs[0]?.u;
  const spot = useOpt((s) => (s.chain && s.chain.underlying === u ? s.chain.spot?.mid : undefined));

  const limitUsd = parseFloat(ticket.limit);
  const limitPremium = ticket.type === "limit" && single && limitUsd > 0 && usdPerUnit > 0 ? limitUsd / usdPerUnit : undefined;
  const preview = usePreview(
    legs.map((l) => ({ series: l.series, u: l.u, right: l.right, strike: l.strike, side: l.side, contracts: l.contracts })),
    single ? ticket.type : "market",
    limitPremium,
  );
  React.useEffect(() => setLastErr(null), [legs.length, single?.series]);

  if (!legs.length) return <EmptyTicket className={className} />;

  const guest = T.guest || publicView;
  const minC = cur?.minContracts ?? 1;
  const stepC = cur?.contractStep ?? 1;
  const maxC = cur?.maxContracts ?? 100;
  const triggerPrice = parseFloat(ticket.triggerPrice);
  const pipSize = cur?.pipSize ?? 10 ** -digits;
  const pipsOf = (amount: number) => (usdPerUnit > 0 && single ? amount / single.contracts / usdPerUnit / pipSize : null);
  const blocked = guest || T.readOnly || busy || !preview.preview || !preview.preview.ok || (preview.preview.estimate && T.live) || (single && q0 && q0.state !== "open") || (single && ticket.type === "limit" && limitPremium === undefined);

  const submit = async () => {
    if (blocked || !preview.preview) return;
    const req: OrderRequest = {
      legs: legs.map((l) => ({ series: l.series, side: l.side, contracts: l.contracts })),
      type: single ? ticket.type : "market",
      limitPremium,
      clientOrderId: `opt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    };
    if (single && usdPerUnit > 0) {
      const sl = parseFloat(ticket.sl);
      const tp = parseFloat(ticket.tp);
      if (sl > 0) req.sl = sl / usdPerUnit;
      if (tp > 0) req.tp = tp / usdPerUnit;
    }
    if (ticket.trigger && triggerPrice > 0 && u) req.trigger = { symbol: u, op: ticket.triggerOp, price: triggerPrice };
    if (ticket.type === "limit" || req.trigger) req.tif = ticket.tif;
    setBusy(true);
    setLastErr(null);
    const r = await optionsApi.order(T.account.login, req);
    setBusy(false);
    const what = single ? t("trader.opt.ticket.what", { side: single.side === "buy" ? t("common.buy") : t("common.sell"), n: single.contracts, series: `${single.u} ${single.strikeLabel} ${single.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}`, date: expiryLabel(single.expiry, locale, false) }) : t("trader.opt.ticket.whatCombo", { n: legs.length, u: u ?? "" });
    if (!r.ok) {
      setLastErr({ code: r.err.code, message: r.err.message });
      T.log("Trade", `'${T.account.login}': option order ${legs.map((l) => `${l.side} ${l.contracts} ${l.series}`).join(", ")} failed [${r.err.code}]`, "error");
      if (!needsOnboarding(r.err.code)) toast.error(t("trader.opt.toast.rejected"), { description: `${what} · ${errText(r.err)}` });
      return;
    }
    const placed = r.data.status === "placed";
    T.log("Trade", `'${T.account.login}': option order ${legs.map((l) => `${l.side} ${l.contracts} ${l.series}`).join(", ")} ${placed ? "placed" : "filled"}`);
    toast.success(placed ? t("trader.opt.toast.placed") : t("trader.opt.toast.filled"), { description: what });
    opt.clearTicket();
    onDone?.();
  };

  const submitLabel = single
    ? `${single.side === "buy" ? t("common.buy") : t("common.sell")} ${single.contracts} × ${single.strikeLabel} ${single.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}`
    : t("trader.opt.ticket.placeStrategy", { count: legs.length });
  const total = preview.preview ? Math.abs(preview.preview.netPremium) : null;

  return (
    <div className={cn("space-y-2.5 p-2.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{single ? t("trader.opt.ticket.single") : t("trader.opt.ticket.strategy", { count: legs.length })}</span>
        <span className="flex items-center gap-1">
          {legs.length > 1 && (
            <button onClick={() => opt.openBuilder(true)} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg">
              <Wand2 className="size-3" /> {t("trader.opt.ticket.payoff")}
            </button>
          )}
          <button onClick={() => opt.clearTicket()} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Trash2 className="size-3" /> {t("trader.opt.ticket.clear")}
          </button>
        </span>
      </div>

      <div className="space-y-1">
        {legs.map((l) => (
          <LegRow key={l.id} leg={l} multi={!single} locale={locale} />
        ))}
        {single && <div className="text-[10.5px] text-fg-3">{t("trader.opt.ticket.addHint")}</div>}
      </div>

      {single && <SideButtons leg={single} pipSize={pipSize} />}

      {single && (
        <div>
          <Label
            right={
              <span className="flex gap-0.5">
                {[1, 2, 5, 10].map((v) => (
                  <button key={v} onClick={() => opt.updateLeg(single.id, { contracts: v })} className={cn("k-num rounded-[4px] px-1 font-mono text-[10px]", single.contracts === v ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg-2")}>
                    {v}
                  </button>
                ))}
              </span>
            }
          >
            {t("trader.opt.ticket.contracts")}
          </Label>
          <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(single.contracts)} onChange={(v) => opt.updateLeg(single.id, { contracts: Math.min(maxC, Math.max(minC, Math.round((parseFloat(v) || minC) / stepC) * stepC)) })} step={stepC} min={minC} decimals={0} />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-3">
            <span>{t("trader.opt.ticket.notional", { n: ((cur?.contractSize ?? 0) * single.contracts).toLocaleString("en-US"), unit: cur?.contractUnit ?? "" })}</span>
            <span>{t("trader.opt.ticket.minMax", { min: minC, max: maxC })}</span>
          </div>
        </div>
      )}

      <div>
        <Label>{t("trader.opt.ticket.orderType")}</Label>
        <Seg
          value={single ? ticket.type : "market"}
          onChange={(v) => single && opt.setTicket({ type: v })}
          options={[
            { value: "market", label: t("trader.opt.ticket.market") },
            { value: "limit", label: t("trader.opt.ticket.limit"), title: single ? undefined : t("trader.opt.ticket.limitSingleOnly") },
          ]}
        />
        {!single && <div className="mt-1 text-[10.5px] text-fg-3">{t("trader.opt.ticket.comboMarket")}</div>}
      </div>

      {single && ticket.type === "limit" && (
        <div>
          <Label right={limitPremium !== undefined ? <span className="font-mono text-[10px] text-fg-3">{px(limitPremium, digits + 2)} / {cur?.contractUnit}</span> : undefined}>{t("trader.opt.ticket.limitPremium")}</Label>
          <Stepper ariaLabel={t("trader.opt.ticket.limitPremium")} value={ticket.limit} onChange={(v) => opt.setTicket({ limit: v })} step={0.5} min={0} decimals={2} placeholder={q0 ? usd(single.side === "buy" ? q0.bidUsd : q0.askUsd) : undefined} />
        </div>
      )}

      {single && (
        <div>
          <Label>{t("trader.opt.ticket.protection")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[10.5px] text-down/90">{t("trader.opt.ticket.slPremium")}</div>
              <Stepper ariaLabel={t("trader.opt.ticket.slPremium")} tone="down" value={ticket.sl} onChange={(v) => opt.setTicket({ sl: v })} step={0.5} min={0} decimals={2} placeholder={t("trader.opt.ticket.notSet")} />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] text-up/90">{t("trader.opt.ticket.tpPremium")}</div>
              <Stepper ariaLabel={t("trader.opt.ticket.tpPremium")} tone="up" value={ticket.tp} onChange={(v) => opt.setTicket({ tp: v })} step={0.5} min={0} decimals={2} placeholder={t("trader.opt.ticket.notSet")} />
            </div>
          </div>
          <div className="mt-1 text-[10px] text-fg-3">{t("trader.opt.ticket.protectionHint")}</div>
        </div>
      )}

      <div className="space-y-1.5 rounded-[7px] border border-line bg-surface-2/40 p-2">
        <Check
          checked={ticket.trigger}
          onChange={(v) => opt.setTicket({ trigger: v, triggerPrice: ticket.triggerPrice || (spot ? spot.toFixed(digits) : "") })}
          label={
            <span className="flex items-center gap-1">
              <Crosshair className="size-3 text-fg-3" /> {t("trader.opt.ticket.trigger", { u: u ?? "" })}
            </span>
          }
        />
        {ticket.trigger && (
          <div className="grid grid-cols-[96px_1fr] gap-1.5">
            <TSelect<"above" | "below"> ariaLabel={t("trader.opt.ticket.triggerOp")} value={ticket.triggerOp} onChange={(v) => opt.setTicket({ triggerOp: v })} options={[{ value: "above", label: t("trader.opt.ticket.above") }, { value: "below", label: t("trader.opt.ticket.below") }]} />
            <Stepper ariaLabel={t("trader.opt.ticket.triggerPrice")} value={ticket.triggerPrice} onChange={(v) => opt.setTicket({ triggerPrice: v })} step={pipSize} decimals={digits} placeholder={spot ? spot.toFixed(digits) : undefined} />
          </div>
        )}
        {(ticket.trigger || (single && ticket.type === "limit")) && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-fg-3">
            <span>{t("trader.opt.ticket.tif")}</span>
            <Seg
              size="sm"
              className="w-[124px]"
              value={ticket.tif}
              onChange={(v) => opt.setTicket({ tif: v })}
              options={[
                { value: "gtc", label: t("trader.opt.ticket.gtc") },
                { value: "day", label: t("trader.opt.ticket.day") },
              ]}
            />
          </div>
        )}
      </div>

      <PreviewSummary state={preview} digits={digits} pipsOf={single ? pipsOf : undefined} />
      {lastErr && <ErrorNote code={lastErr.code} message={lastErr.message} />}

      {guest ? (
        <div className="rounded-[8px] border border-ember/25 bg-ember-soft/40 px-3 py-3 text-center">
          <div className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
            <Lock className="size-3.5" />
          </div>
          <div className="text-[12.5px] font-semibold text-fg">{t("trader.opt.guest.title")}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.guest.text")}</p>
          <GuestActions className="mt-2.5" />
        </div>
      ) : T.readOnly ? (
        <div className="flex items-center gap-1.5 rounded-[7px] border border-warn/30 bg-warn-soft px-2.5 py-1.5 text-[11.5px] text-warn">
          <Lock className="size-3.5" /> {t("trader.opt.ticket.readOnly")}
        </div>
      ) : (
        <button
          onClick={() => void submit()}
          disabled={!!blocked}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-[8px] px-3 text-[12.5px] font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100",
            single ? (single.side === "buy" ? "bg-up" : "bg-down") : "bg-ember",
          )}
        >
          <span className="truncate">{busy ? t("trader.opt.ticket.sending") : tradingSoon && T.live ? t("trader.opt.ticket.soon") : submitLabel}</span>
          {total !== null && <span className="k-num shrink-0 rounded-[5px] bg-black/15 px-1.5 py-0.5 font-mono text-[11px]">{usd(total)} USD</span>}
        </button>
      )}
    </div>
  );
}

function EmptyTicket({ className }: { className?: string }) {
  const t = useT();
  return (
    <div className={cn("grid h-full min-h-[260px] place-items-center p-5 text-center", className)}>
      <div className="max-w-[260px]">
        <div className="mx-auto mb-2.5 grid size-10 place-items-center rounded-full border border-line text-fg-3">
          <MousePointerClick className="size-4" />
        </div>
        <div className="text-[13px] font-semibold text-fg">{t("trader.opt.ticket.emptyTitle")}</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.ticket.emptyText")}</p>
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <button onClick={() => opt.openBuilder(true)} className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-ember px-3 text-[12px] font-semibold text-white hover:brightness-110">
            <Wand2 className="size-3.5" /> {t("trader.opt.builder.open")}
          </button>
          <button onClick={() => opt.setPrefs({ panel: "simple" })} className="text-[11.5px] text-fg-2 underline-offset-2 hover:text-fg hover:underline">
            {t("trader.opt.simple.open")}
          </button>
        </div>
      </div>
    </div>
  );
}

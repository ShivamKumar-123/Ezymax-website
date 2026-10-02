"use client";

// Option order ticket (the right panel, where the CFD order panel sits). Plain language first:
//   1. the option picked in the chain, in words ("Call · profit if EURUSD rises above 1.1250", the expiry and its
//      countdown; Call / Put switch),
//   2. SELL (you receive the bid) or BUY (you pay the ask), USD per contract,
//   3. contracts,
//   4. "What happens": what you pay or receive, where you make money at expiry and when, the most you can lose and
//      make, a small payoff picture, and for sellers a warning that the risk isn't limited to the premium,
//   5. "More order options" (folded): market / limit premium, stop loss / take profit on the premium, a trigger on the
//      underlying, time in force,
//   6. "Details" (folded): the engine's preview numbers (commission, margin before → after, cash after, Greeks),
//   7. the order button with the amount.
// "Add leg" / Shift+click in the chain build a strategy (several legs, all-or-nothing). Premiums are typed in USD per
// contract (plan O8) and sent per unit of the underlying, like the chain's bid / ask.
//
// While the broker's order book is live (docs/OPTIONS-EXCHANGE.md) the buttons show the book's best offer / bid with
// their sizes, a single option is traded with book orders (./book-ticket: limit GTC / IOC / FOK / GTD, post-only,
// market in the band, reduce-only, stops) and a strategy by request for quote (./rfq). Otherwise: house prices.
import * as React from "react";
import { ChevronRight, Crosshair, Lock, MousePointerClick, Plus, Table2, Trash2, Wand2, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { GuestActions } from "@/components/shell/guest";
import { Check, Stepper, TSelect } from "@/components/ui/primitives";
import { optionsApi } from "@/lib/options/api";
import { errText, needsOnboarding } from "@/lib/options/errors";
import { fillOf, usdPerUnitOf, type PayLeg } from "@/lib/options/math";
import { usdPerUnitOfQuote } from "@/lib/options/normalize";
import { opt, quoteOf, underlyingOf, useBookLive, useOpt, useSeriesQuote, type TicketLeg } from "@/lib/options-store";
import type { OptionQuote, OrderRequest } from "@/lib/options/types";
import { Countdown, ErrorNote, Flash, OptAvatar, RightTag, Seg, StateBadge } from "./bits";
import { Explain, IntroCard, useIntroHidden } from "./explain";
import { cutWhen, expiryLabel, iso, money, pips, px, usd } from "./format";
import { commissionOf, OutcomeCard, OutcomeSkeleton } from "./outcome";
import { PreviewSummary, usePreview } from "./preview";
import { BookOrderForm } from "./book-ticket";
import { RfqPanel } from "./rfq";

function Label({ children, right, help }: { children: React.ReactNode; right?: React.ReactNode; help?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-fg-3">
      <span className="flex items-center gap-1">
        {children}
        {help}
      </span>
      {right && <span className="normal-case tracking-normal">{right}</span>}
    </div>
  );
}

/** USD per contract for one unit of premium (contract size × USD per quote currency). */
function useUsdPerUnit(q: OptionQuote | null): number {
  const chainUsd = useOpt((s) => usdPerUnitOf(s.chain));
  if (q && q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
  if (q) {
    const k = usdPerUnitOfQuote(q);
    if (k > 0) return k;
  }
  return chainUsd;
}

/** The cut of a leg's expiry (the list of the underlying on screen, or the chain). */
function useCutAt(leg: Pick<TicketLeg, "u" | "expiry"> | null | undefined): string | null {
  return useOpt((s) => (leg ? (s.expiries.find((e) => e.date === leg.expiry && s.u === leg.u)?.cutAt ?? (s.chain?.expiry === leg.expiry && s.chain.underlying === leg.u ? s.chain.cutAt : null)) : null));
}

function LegRow({ leg, multi, locale }: { leg: TicketLeg; multi: boolean; locale: string }) {
  const t = useT();
  const q = useSeriesQuote(leg.series);
  const price = q ? (leg.side === "buy" ? q.askUsd : q.bidUsd) : 0;
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-line bg-surface-2/50 px-2 py-1.5">
      {multi && (
        <button onClick={() => opt.updateLeg(leg.id, { side: leg.side === "buy" ? "sell" : "buy" })} title={t("trader.opt.ticket.flipSide")} className={cn("h-6 w-11 shrink-0 rounded-[6px] text-[10.5px] font-bold uppercase", leg.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
          {leg.side === "buy" ? t("common.buy") : t("common.sell")}
        </button>
      )}
      <RightTag right={leg.right} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-mono text-[12.5px] font-semibold text-fg">{leg.strikeLabel}</div>
        <div className="truncate text-[10.5px] text-fg-3">
          {leg.right === "call" ? t("trader.opt.call") : t("trader.opt.put")} · {expiryLabel(leg.expiry, locale, false)}
        </div>
      </div>
      {q && <StateBadge state={q.state} />}
      {multi && (
        <div className="w-[78px]">
          <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(leg.contracts)} onChange={(v) => opt.updateLeg(leg.id, { contracts: Math.max(1, Math.round(parseFloat(v) || 1)) })} step={1} min={1} decimals={0} className="h-7" />
        </div>
      )}
      <span className={cn("w-[60px] text-end font-mono text-[12px] font-medium", leg.side === "buy" ? "text-up" : "text-down")}>
        <Flash value={price}>{price ? money(price) : "—"}</Flash>
      </span>
      <button onClick={() => opt.removeLeg(leg.id)} aria-label={t("trader.opt.ticket.removeLeg")} className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** The selected option in words: underlying, Call / Put and strike, what it is a bet on, the expiry and its countdown. */
function SelectedOption({ leg, locale }: { leg: TicketLeg; locale: string }) {
  const t = useT();
  const q = useSeriesQuote(leg.series);
  const cutAt = useCutAt(leg);
  // the switch needs the strike in the chain on screen
  const flippable = useOpt((s) => !!s.chain && s.chain.expiry === leg.expiry && s.chain.underlying === leg.u && s.chain.rows.some((r) => Math.abs(r.strike - leg.strike) < 1e-9 && r.call && r.put));
  const call = leg.right === "call";
  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface-2/50">
      <div className="flex items-center gap-2.5 px-3 pt-2.5">
        <OptAvatar symbol={leg.u} size={20} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold text-fg">{leg.u}</span>
            <span className={cn("rounded-[5px] px-1.5 py-px text-[11px] font-semibold", call ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{call ? t("trader.opt.call") : t("trader.opt.put")}</span>
            <span className="font-mono text-[14px] font-semibold text-fg">{leg.strikeLabel}</span>
            <Explain topic={leg.right} size={12} />
          </div>
          <div className={cn("mt-0.5 truncate text-[11.5px]", call ? "text-up" : "text-down")} dir="auto">
            {call ? t("trader.opt.ticket.betUp", iso({ u: leg.u, strike: leg.strikeLabel })) : t("trader.opt.ticket.betDown", iso({ u: leg.u, strike: leg.strikeLabel }))}
          </div>
        </div>
        {q && <StateBadge state={q.state} className="shrink-0" />}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-line/70 px-3 py-1.5">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[11px] text-fg-3">
          <span className="truncate text-fg-2">{cutAt ? cutWhen(cutAt, locale) : expiryLabel(leg.expiry, locale)}</span>
          {cutAt && <Countdown to={Date.parse(cutAt)} className="text-[10.5px]" />}
        </span>
        {flippable && (
          <Seg<"call" | "put">
            size="sm"
            className="w-[104px] shrink-0"
            value={leg.right}
            onChange={(v) => opt.flipRight(v)}
            options={[
              { value: "call", label: t("trader.opt.call"), tone: "up" },
              { value: "put", label: t("trader.opt.put"), tone: "down" },
            ]}
          />
        )}
      </div>
    </div>
  );
}

/**
 * SELL (you receive the bid) | BUY (you pay the ask), USD per contract. The trader chooses one: the outcome card and
 * the order button follow; until then both stay lit.
 */
function SideButtons({ leg, armed, pipSize, disabled }: { leg: TicketLeg; armed: boolean; pipSize: number; disabled?: boolean }) {
  const t = useT();
  const q = useSeriesQuote(leg.series);
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["sell", "buy"] as const).map((side) => {
        const on = armed && leg.side === side;
        const off = armed && leg.side !== side;
        const v = q ? (side === "buy" ? q.askUsd : q.bidUsd) : 0;
        const p = q ? (side === "buy" ? q.ask : q.bid) : 0;
        const size = q?.book ? (side === "buy" ? q.askQty : q.bidQty) : undefined;
        return (
          <button
            key={side}
            onClick={() => opt.arm(side)}
            disabled={disabled}
            aria-pressed={on}
            title={side === "buy" ? t("trader.opt.clickBuy") : t("trader.opt.clickSell")}
            className={cn(
              "relative overflow-hidden rounded-[12px] border px-3 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-50",
              side === "buy" ? "text-end" : "text-start",
              off
                ? "border-line bg-surface-2 text-fg-2 hover:bg-surface-3"
                : side === "buy"
                  ? "border-up bg-[linear-gradient(180deg,color-mix(in_srgb,var(--k-up)_92%,white),var(--k-up))] text-white hover:brightness-110"
                  : "border-down bg-[linear-gradient(180deg,color-mix(in_srgb,var(--k-down)_92%,white),var(--k-down))] text-white hover:brightness-110",
              on && (side === "buy" ? "ring-2 ring-up/45 ring-offset-2 ring-offset-panel" : "ring-2 ring-down/45 ring-offset-2 ring-offset-panel"),
            )}
          >
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.08em]", off ? (side === "buy" ? "text-up" : "text-down") : "opacity-95")}>{side === "buy" ? t("common.buy") : t("common.sell")}</div>
            <div className="k-num font-mono text-[19px] font-semibold leading-tight">
              <Flash value={v}>{v ? money(v) : "—"}</Flash>
            </div>
            <div className={cn("text-[10px]", off ? "text-fg-3" : "opacity-85")}>
              {!q ? " " : size !== undefined ? (size ? t("trader.opt.book.size", { count: size }) : side === "buy" ? t("trader.opt.book.noOffers") : t("trader.opt.book.noBids")) : side === "buy" ? t("trader.opt.ticket.youPayEach") : t("trader.opt.ticket.youGetEach")}
              {!q?.book && q && <span className="ms-1 font-mono opacity-80">· {pips(p / pipSize)}p</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Folded section ("More order options"). */
function Fold({ title, hint, open, onToggle, children, active }: { title: React.ReactNode; hint?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface-2/30">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex h-9 w-full items-center gap-1.5 px-3 text-start text-[12px] font-medium text-fg-2 hover:text-fg">
        <ChevronRight className={cn("size-3.5 shrink-0 text-fg-3 transition-transform", open && "rotate-90")} />
        <span className="flex-1">{title}</span>
        {active && <span className="size-1.5 rounded-full bg-ember" />}
        {!open && hint && <span className="truncate text-[10.5px] text-fg-3">{hint}</span>}
      </button>
      {open && <div className="space-y-3 border-t border-line/70 px-3 pb-3 pt-2.5">{children}</div>}
    </div>
  );
}

export function OptionTicket({ onDone, onAddLeg, onOpenChain, className }: { onDone?: () => void; onAddLeg?: () => void; onOpenChain?: () => void; className?: string }) {
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
  const bookLive = useBookLive();
  const u = legs[0]?.u;
  const chainOfU = useOpt((s) => (s.chain && s.chain.underlying === u ? s.chain : null));
  const spot = chainOfU?.spot?.mid;
  const cutAt = useCutAt(legs[0]);
  const [more, setMore] = React.useState(false);
  // re-render on quote changes of every leg (outcome numbers)
  useOpt((s) => legs.map((l) => s.index[l.series]?.mark ?? s.quotes[l.series]?.mark ?? 0).join("|"));

  const limitUsd = parseFloat(ticket.limit);
  const limitPremium = ticket.type === "limit" && single && limitUsd > 0 && usdPerUnit > 0 ? limitUsd / usdPerUnit : undefined;
  // a single option shows its numbers once the trader chose Buy or Sell
  const armed = !single || ticket.armed;
  const preview = usePreview(
    legs.map((l) => ({ series: l.series, u: l.u, right: l.right, strike: l.strike, side: l.side, contracts: l.contracts })),
    single ? ticket.type : "market",
    limitPremium,
    // a single option on the book previews with the book (./book-ticket)
    armed && !(bookLive && single),
  );
  React.useEffect(() => setLastErr(null), [legs.length, single?.series]);
  React.useEffect(() => {
    if (ticket.type === "limit" || ticket.sl || ticket.tp || ticket.trigger) setMore(true);
    // open the section when the ticket arrives with advanced settings (a depth click, a kept limit type)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single?.series]);

  if (!legs.length) return <EmptyTicket className={className} onOpenChain={onOpenChain} />;

  const guest = T.guest || publicView;
  const minC = cur?.minContracts ?? 1;
  const stepC = cur?.contractStep ?? 1;
  const maxC = cur?.maxContracts ?? 100;
  const triggerPrice = parseFloat(ticket.triggerPrice);
  const pipSize = cur?.pipSize ?? 10 ** -digits;
  const pipsOf = (amount: number) => (usdPerUnit > 0 && single ? amount / single.contracts / usdPerUnit / pipSize : null);
  const blocked = !armed || guest || T.readOnly || busy || !preview.preview || !preview.preview.ok || (preview.preview.estimate && T.live) || (single && q0 && q0.state !== "open") || (single && ticket.type === "limit" && limitPremium === undefined);

  // the legs at the prices they would fill at (the engine's preview prices once it answered; a book limit price)
  const bookLimit = bookLive && single && ticket.bookType === "limit" && limitUsd > 0 && usdPerUnit > 0 ? limitUsd / usdPerUnit : undefined;
  const legUsd = (series: string) => usdPerUnitOfQuote(quoteOf(series)) || usdPerUnit;
  const pay: PayLeg[] = legs.map((l) => {
    const q = quoteOf(l.series);
    const engine = preview.preview?.legs.find((x) => x.series === l.series)?.price;
    const price = engine && engine > 0 ? engine : q ? fillOf(q, l.side, single ? (limitPremium ?? bookLimit) : undefined) : 0;
    return { right: l.right, strike: l.strike, side: l.side, contracts: l.contracts, premium: price, iv: q?.iv };
  });
  const usdU = single ? usdPerUnit : legUsd(legs[0]!.series);
  const priced = pay.every((p) => p.premium > 0);
  const usePrev = preview.preview && !(bookLive && single) ? preview.preview : null;
  const marginAdd = usePrev ? usePrev.marginAfter - usePrev.marginBefore : null;

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
    // the option stays selected (no side, protection cleared), like the CFD panel staying on its symbol
    opt.afterFill();
    onDone?.();
  };

  const total = preview.preview ? Math.abs(preview.preview.netPremium) + (preview.preview.netPremium >= 0 ? preview.preview.commission : -preview.preview.commission) : null;
  const debit = preview.preview ? preview.preview.netPremium >= 0 : true;
  const submitLabel = !armed
    ? t("trader.opt.ticket.chooseSide")
    : single
      ? `${single.side === "buy" ? t("common.buy") : t("common.sell")} ${single.contracts} × ${single.strikeLabel} ${single.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}`
      : t("trader.opt.ticket.placeStrategy", { count: legs.length });
  const advancedOn = ticket.type === "limit" || !!ticket.sl || !!ticket.tp || ticket.trigger;

  return (
    <div className={cn("space-y-3 p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{single ? t("trader.opt.ticket.single") : t("trader.opt.ticket.strategy", { count: legs.length })}</span>
        <span className="flex items-center gap-0.5">
          {!T.readOnly && !publicView && (
            <button
              onClick={() => {
                opt.setAdding(!ticket.adding);
                if (!ticket.adding) onAddLeg?.();
              }}
              aria-pressed={ticket.adding}
              title={t("trader.opt.chain.adding")}
              className={cn("flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11.5px]", ticket.adding ? "bg-ember-soft text-ember" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}
            >
              <Plus className="size-3.5" /> {t("trader.opt.builder.addLeg")}
            </button>
          )}
          {legs.length > 1 && (
            <button onClick={() => opt.openBuilder(true)} className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11.5px] text-fg-2 hover:bg-surface-3 hover:text-fg">
              <Wand2 className="size-3.5" /> {t("trader.opt.ticket.payoff")}
            </button>
          )}
          <button onClick={() => opt.clearTicket()} title={t("trader.opt.ticket.clear")} aria-label={t("trader.opt.ticket.clear")} className="grid size-7 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </div>

      {single ? (
        <SelectedOption leg={single} locale={locale} />
      ) : (
        <div className="space-y-1.5">
          {legs.map((l) => (
            <LegRow key={l.id} leg={l} multi locale={locale} />
          ))}
        </div>
      )}

      {single && (
        <div>
          <SideButtons leg={single} armed={ticket.armed} pipSize={pipSize} disabled={!q0} />
          {!ticket.armed && (
            <div className="mt-2 rounded-[10px] border border-dashed border-line px-3 py-2 text-center leading-snug">
              <div className="text-[12px] font-semibold text-fg">{t("trader.opt.ticket.chooseSide")}</div>
              <div className="mt-0.5 text-[11px] text-fg-3" dir="auto">
                {single.right === "call" ? t("trader.opt.ticket.chooseCall", iso({ u: single.u })) : t("trader.opt.ticket.choosePut", iso({ u: single.u }))}
              </div>
            </div>
          )}
        </div>
      )}

      {single && (
        <div>
          <Label
            help={<Explain topic="contracts" size={12} />}
            right={
              <span className="flex gap-0.5">
                {[1, 2, 5, 10].map((v) => (
                  <button key={v} onClick={() => opt.updateLeg(single.id, { contracts: v })} aria-pressed={single.contracts === v} className={cn("k-num h-5 min-w-5 rounded-[5px] px-1 font-mono text-[10.5px]", single.contracts === v ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg-2")}>
                    {v}
                  </button>
                ))}
              </span>
            }
          >
            {t("trader.opt.ticket.contracts")}
          </Label>
          <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={String(single.contracts)} onChange={(v) => opt.updateLeg(single.id, { contracts: Math.min(maxC, Math.max(minC, Math.round((parseFloat(v) || minC) / stepC) * stepC)) })} step={stepC} min={minC} decimals={0} className="h-9 [&_input]:text-[14px]" />
          <div className="mt-1 flex justify-between text-[10.5px] text-fg-3">
            <span>{t("trader.opt.ticket.notional", { n: ((cur?.contractSize ?? 0) * single.contracts).toLocaleString("en-US"), unit: cur?.contractUnit ?? "" })}</span>
            <span className="font-mono">{t("trader.opt.ticket.minMax", { min: minC, max: maxC })}</span>
          </div>
        </div>
      )}

      {/* what happens: plain language, once a side is chosen */}
      {armed && u && (priced ? <OutcomeCard u={u} legs={pay} usdPerUnit={usdU} digits={digits} cutAt={cutAt} spot={spot} preview={usePrev} commission={commissionOf(chainOfU, pay, usdU, bookLive)} margin={marginAdd} loading={preview.loading} /> : <OutcomeSkeleton />)}

      {bookLive && single ? (
        <>
          <BookOrderForm leg={single} onDone={onDone} />
          <div className="text-[10.5px] leading-snug text-fg-3">{t("trader.opt.ticket.addHint")}</div>
        </>
      ) : bookLive ? (
        <>
          <PreviewSummary state={preview} digits={digits} collapsible />
          {guest ? (
            <GuestBox />
          ) : T.readOnly ? (
            <ReadOnlyBox />
          ) : (
            <RfqPanel legs={legs.map((l) => ({ series: l.series, side: l.side, contracts: l.contracts }))} onDone={() => (opt.afterFill(), onDone?.())} />
          )}
        </>
      ) : (
        <>
          <Fold title={t("trader.opt.ticket.more")} hint={t("trader.opt.ticket.moreHint")} open={more} onToggle={() => setMore((v) => !v)} active={advancedOn}>
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
                <Stepper ariaLabel={t("trader.opt.ticket.limitPremium")} value={ticket.limit} onChange={(v) => opt.setTicket({ limit: v })} step={0.5} min={0} decimals={2} placeholder={q0 ? usd(single.side === "buy" ? q0.bidUsd : q0.askUsd) : undefined} className="h-8" />
              </div>
            )}

            {single && (
              <div>
                <Label>{t("trader.opt.ticket.protection")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-[10.5px] text-down/90">{t("trader.opt.ticket.slPremium")}</div>
                    <Stepper ariaLabel={t("trader.opt.ticket.slPremium")} tone="down" value={ticket.sl} onChange={(v) => opt.setTicket({ sl: v })} step={0.5} min={0} decimals={2} placeholder={t("trader.opt.ticket.notSet")} className="h-8" />
                  </div>
                  <div>
                    <div className="mb-1 text-[10.5px] text-up/90">{t("trader.opt.ticket.tpPremium")}</div>
                    <Stepper ariaLabel={t("trader.opt.ticket.tpPremium")} tone="up" value={ticket.tp} onChange={(v) => opt.setTicket({ tp: v })} step={0.5} min={0} decimals={2} placeholder={t("trader.opt.ticket.notSet")} className="h-8" />
                  </div>
                </div>
                <div className="mt-1 text-[10.5px] leading-snug text-fg-3">{t("trader.opt.ticket.protectionHint")}</div>
              </div>
            )}

            <div className="space-y-1.5">
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
          </Fold>

          {armed && <PreviewSummary state={preview} digits={digits} pipsOf={single ? pipsOf : undefined} collapsible />}
          {lastErr && <ErrorNote code={lastErr.code} message={lastErr.message} />}

          {guest ? (
            <GuestBox />
          ) : T.readOnly ? (
            <ReadOnlyBox />
          ) : (
            <button
              onClick={() => void submit()}
              disabled={!!blocked}
              className={cn(
                "flex h-12 w-full items-center justify-between gap-2 rounded-[12px] px-4 text-[13px] font-semibold text-white shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:shadow-none disabled:hover:brightness-100",
                !armed ? "bg-surface-3 text-fg-3" : single ? (single.side === "buy" ? "bg-up" : "bg-down") : "bg-ember",
              )}
            >
              <span className="truncate">{busy ? t("trader.opt.ticket.sending") : tradingSoon && T.live ? t("trader.opt.ticket.soon") : submitLabel}</span>
              {total !== null && armed && (
                <span className="k-num shrink-0 rounded-[7px] bg-black/15 px-2 py-0.5 text-[12px]">
                  {debit ? t("trader.opt.ticket.payAmount", iso({ amount: money(Math.max(0, total)) })) : t("trader.opt.ticket.getAmount", iso({ amount: money(Math.max(0, total)) }))}
                </span>
              )}
            </button>
          )}
          {single && <div className="text-[10.5px] leading-snug text-fg-3">{t("trader.opt.ticket.addHint")}</div>}
        </>
      )}
    </div>
  );
}

function GuestBox() {
  const t = useT();
  return (
    <div className="rounded-[12px] border border-ember/25 bg-ember-soft/40 px-3 py-3 text-center">
      <div className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
        <Lock className="size-3.5" />
      </div>
      <div className="text-[12.5px] font-semibold text-fg">{t("trader.opt.guest.title")}</div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.guest.text")}</p>
      <GuestActions className="mt-2.5" />
    </div>
  );
}

function ReadOnlyBox() {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5 rounded-[10px] border border-warn/30 bg-warn-soft px-3 py-2 text-[11.5px] text-warn">
      <Lock className="size-3.5" /> {t("trader.opt.ticket.readOnly")}
    </div>
  );
}

function EmptyTicket({ className, onOpenChain }: { className?: string; onOpenChain?: () => void }) {
  const t = useT();
  const center = useOpt((s) => s.prefs.center);
  const [hidden, setHidden] = useIntroHidden();
  return (
    <div className={cn("flex h-full min-h-[300px] flex-col gap-3 p-3", className)}>
      {!hidden && <IntroCard onHide={() => setHidden(true)} />}
      <div className="grid flex-1 place-items-center text-center">
        <div className="max-w-[270px]">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-ember">
            <MousePointerClick className="size-5" />
          </div>
          <div className="text-[14px] font-semibold text-fg">{t("trader.opt.ticket.emptyTitle")}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{t("trader.opt.ticket.emptyText2")}</p>
          <div className="mt-4 flex flex-col items-stretch gap-2">
            <button onClick={() => opt.setPrefs({ panel: "simple" })} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-ember px-3 text-[12.5px] font-semibold text-white hover:brightness-110">
              {t("trader.opt.guide.start")}
            </button>
            {(onOpenChain || center !== "chain") && (
              <button onClick={() => (onOpenChain ? onOpenChain() : opt.setCenter("chain"))} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line px-3 text-[12.5px] font-medium text-fg-2 hover:border-fg-3/50 hover:text-fg">
                <Table2 className="size-3.5" /> {t("trader.opt.chainTitle")}
              </button>
            )}
            <button onClick={() => opt.openBuilder(true)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line px-3 text-[12.5px] font-medium text-fg-2 hover:border-fg-3/50 hover:text-fg">
              <Wand2 className="size-3.5" /> {t("trader.opt.builder.open")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

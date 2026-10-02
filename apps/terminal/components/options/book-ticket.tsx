"use client";

// The ticket's order-book part (a single option, while the broker's book is live; docs/OPTIONS-EXCHANGE.md §2):
//   Limit   a price in USD per contract (sent per unit on the premium tick), time in force GTC / IOC / FOK / GTD (a
//           date and time), Post-only (GTC: rejected instead of trading at once) and Reduce-only
//   Market  fills now against the book inside the price band around the mark, never rests
//   Stop    stop market / stop limit, triggered by the option's mark (never the last trade) or the underlying's price
//           crossing a level; nothing is reserved until it fires
// The preview (`POST …/book/preview`) shows what fills now at what average price, what rests, the fee (taker) or
// rebate (maker) and the order margin held; the answer to the order shows its fills, partial fills and what rests.
import * as React from "react";
import { ArrowUpRight, CheckCircle2, CircleDashed, Info, Lock, X } from "lucide-react";
import { OPTION_SPEC, parseSeriesCode, tickDecimals } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { GuestActions } from "@/components/shell/guest";
import { Check, Stepper, TInput, TSelect } from "@/components/ui/primitives";
import type { EngineErr } from "@/lib/engine/map";
import { bookApi, bookMissing, clientOrderId } from "@/lib/options/book-api";
import { bookOrders } from "@/lib/options/book-orders";
import { errText, needsOnboarding, optionErrorText, reasonCode } from "@/lib/options/errors";
import { toTick } from "@/lib/options/normalize";
import { getOpt, opt, useOpt, useSeriesQuote, type Ticket, type TicketLeg } from "@/lib/options-store";
import type { BookOrderRequest, BookOrderResult, BookPreview, BookTif } from "@/lib/options/types";
import { ErrorNote, Seg } from "./bits";
import { OrderStatusChip, qty, useSeriesUnits, type SeriesUnits } from "./book-bits";
import { expiryLabel, px, usd } from "./format";
import { MmRulesLink } from "./mm-rules";

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">
      <span>{children}</span>
      {right && <span className="normal-case tracking-normal">{right}</span>}
    </div>
  );
}

/** datetime-local value for an instant (the browser's time zone). */
function localInput(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The ticket as a book order (prices per unit on the tick), or why it can't be sent yet. */
export function bookRequest(ticket: Ticket, leg: TicketLeg, units: SeriesUnits): { req: BookOrderRequest | null; missing: string | null } {
  const base = { series: leg.series, side: leg.side, qty: leg.contracts, reduceOnly: ticket.reduceOnly || undefined, clientOrderId: "preview0000" };
  const unit = (usdText: string) => {
    const v = parseFloat(usdText);
    return v > 0 && units.k > 0 ? toTick(v / units.k, units.tick) : undefined;
  };
  const expireAt = () => (ticket.gtd && Number.isFinite(Date.parse(ticket.gtd)) ? new Date(ticket.gtd).toISOString() : undefined);
  if (ticket.bookType === "market") return { req: { ...base, type: "market", tif: "ioc" }, missing: null };
  if (ticket.bookType === "limit") {
    const price = unit(ticket.limit);
    if (!price) return { req: null, missing: "trader.opt.bt.needPrice" };
    const tif: BookTif = ticket.bookTif;
    if (tif === "gtd" && !expireAt()) return { req: null, missing: "trader.opt.bt.needGtd" };
    return { req: { ...base, type: "limit", price, tif, expireAt: tif === "gtd" ? expireAt() : undefined, postOnly: ticket.postOnly && tif === "gtc" ? true : undefined }, missing: null };
  }
  // stop
  const trigRaw = parseFloat(ticket.trigPrice);
  const trigPrice = ticket.trigSource === "mark" ? unit(ticket.trigPrice) : trigRaw > 0 ? trigRaw : undefined;
  if (!trigPrice) return { req: null, missing: "trader.opt.bt.needTrigger" };
  const trigger = { source: ticket.trigSource, op: ticket.trigOp, price: trigPrice };
  if (ticket.stopKind === "market") return { req: { ...base, type: "stop_market", tif: "ioc", trigger }, missing: null };
  const price = unit(ticket.limit);
  if (!price) return { req: null, missing: "trader.opt.bt.needPrice" };
  const tif: BookTif = ticket.bookTif === "gtd" ? "gtd" : "gtc";
  if (tif === "gtd" && !expireAt()) return { req: null, missing: "trader.opt.bt.needGtd" };
  return { req: { ...base, type: "stop_limit", price, tif, expireAt: tif === "gtd" ? expireAt() : undefined, trigger }, missing: null };
}

interface PreviewState {
  preview: BookPreview | null;
  loading: boolean;
  error: EngineErr | null;
}

/** Debounced book preview, asked again every few seconds while the depth moves. */
function useBookPreview(req: BookOrderRequest | null, enabled: boolean): PreviewState {
  const T = useTerminal();
  const login = T.account.login;
  const [state, setState] = React.useState<PreviewState>({ preview: null, loading: false, error: null });
  const key = req ? JSON.stringify(req) : "";
  React.useEffect(() => {
    if (!enabled || !req || T.guest) {
      setState({ preview: null, loading: false, error: null });
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      setState((p) => ({ ...p, loading: true }));
      const r = await bookApi.preview(login, req);
      if (!alive) return;
      if (r.ok) setState({ preview: r.data, loading: false, error: null });
      else {
        if (bookMissing(r.err)) opt.setBookOff(true);
        setState({ preview: null, loading: false, error: r.err });
      }
      timer = setTimeout(() => void run(), document.visibilityState === "visible" ? 2500 : 10_000);
    };
    timer = setTimeout(() => void run(), 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, login, T.guest]);
  return state;
}

function Line({ k, v, tone, strong, sub }: { k: React.ReactNode; v: React.ReactNode; tone?: "up" | "down" | "warn"; strong?: boolean; sub?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[2px]">
      <span className="font-sans text-fg-3">{k}</span>
      <span className={cn("k-num min-w-0 text-end", strong ? "font-semibold text-fg" : "text-fg-2", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>
        {v}
        {sub && <span className="block text-[9.5px] font-normal text-fg-3">{sub}</span>}
      </span>
    </div>
  );
}

function BookPreviewCard({ state, req, units }: { state: PreviewState; req: BookOrderRequest; units: SeriesUnits }) {
  const t = useT();
  const p = state.preview;
  if (!p && !state.error) return null;
  if (!p) return <ErrorNote code={state.error!.code} message={state.error!.message} />;
  const stop = req.type === "stop_market" || req.type === "stop_limit";
  const reasons = (p.reasons ?? []).filter((r) => reasonCode(r) || typeof r !== "string");
  return (
    <div className="space-y-1.5">
      <div className={cn("rounded-[7px] border border-line bg-surface-2/40 px-2.5 py-1.5 font-mono text-[11px] transition-opacity", state.loading && "opacity-80")}>
        <div className="mb-0.5 flex items-center justify-between">
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.preview.title")}</span>
          {p.estimate && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface-3 px-1.5 font-sans text-[9.5px] font-medium text-fg-3" title={t("trader.opt.preview.estimateHint")}>
              <Info className="size-2.5" /> {t("trader.opt.preview.estimate")}
            </span>
          )}
        </div>
        {stop ? (
          <Line k={t("trader.opt.bt.pv.onTrigger")} v={t("trader.opt.bt.pv.nothingHeld")} />
        ) : (
          <>
            <Line
              k={t("trader.opt.bt.pv.fillsNow")}
              v={p.estFilled > 0 ? t("trader.opt.bt.pv.fillsAt", { n: qty(p.estFilled), total: qty(req.qty), price: p.estAvgPrice !== null ? usd(p.estAvgPrice * units.k) : "—" }) : t("trader.opt.bt.pv.none")}
              strong
              tone={p.estFilled > 0 ? undefined : "warn"}
            />
            {p.estResting > 0 && <Line k={t("trader.opt.bt.pv.rests")} v={t("trader.opt.bt.pv.restsAt", { n: qty(p.estResting), price: req.price !== undefined ? usd(req.price * units.k) : "—" })} />}
            {req.type !== "limit" || req.tif === "ioc" || req.tif === "fok" ? p.estFilled < req.qty && <Line k={t("trader.opt.bt.pv.rest")} v={t("trader.opt.bt.pv.cancelled", { n: qty(req.qty - p.estFilled) })} tone="warn" /> : null}
          </>
        )}
        {p.band && (p.band.max !== null || p.band.min !== null) && <Line k={t("trader.opt.bt.pv.band")} v={p.band.max !== null ? `≤ ${usd(p.band.max * units.k)}` : `≥ ${usd(p.band.min! * units.k)}`} sub={t("trader.opt.bt.pv.bandSub")} />}
        <Line k={t("trader.opt.bt.pv.fee")} v={p.fee > 0 ? usd(p.fee) : "0.00"} />
        {p.rebate > 0 && <Line k={t("trader.opt.bt.pv.rebate")} v={`+${usd(p.rebate)}`} tone="up" sub={t("trader.opt.bt.pv.rebateSub")} />}
        {!stop && (
          <>
            <div className="my-1 border-t border-line/70" />
            <Line k={t("trader.opt.bt.pv.reserve")} v={`${usd(p.reserve)} USD`} sub={t("trader.opt.bt.pv.reserveSub")} />
          </>
        )}
        {p.freeMarginAfter !== undefined && <Line k={t("trader.opt.preview.freeMarginAfter")} v={usd(p.freeMarginAfter)} tone={p.freeMarginAfter < 0 ? "down" : undefined} />}
      </div>
      {reasons.map((r, i) => (
        <ErrorNote key={i} code={reasonCode(r)} message={typeof r === "string" ? undefined : r.message} />
      ))}
    </div>
  );
}

/** What the last order did: filled, partly filled, resting, not filled; its fills with role and fee / rebate. */
function ResultCard({ r, units, onClose }: { r: BookOrderResult; units: SeriesUnits; onClose: () => void }) {
  const t = useT();
  const T = useTerminal();
  const o = r.order;
  const filled = r.fills.reduce((n, f) => n + f.qty, 0) || o?.filled || 0;
  const total = o?.qty ?? filled;
  const avg = filled ? r.fills.reduce((s, f) => s + f.price * f.qty, 0) / (r.fills.reduce((n, f) => n + f.qty, 0) || 1) : null;
  const resting = o && o.left > 0 && (o.status === "working" || o.status === "partially_filled") ? o.left : 0;
  return (
    <div className="rounded-[8px] border border-line bg-surface-2/50 px-2.5 py-2 text-[11.5px]" role="status">
      <div className="flex items-center gap-1.5">
        {r.status === "filled" ? <CheckCircle2 className="size-3.5 text-up" /> : <CircleDashed className="size-3.5 text-fg-3" />}
        <span className="font-semibold text-fg">{t("trader.opt.bt.res.title")}</span>
        <OrderStatusChip status={r.status} />
        <button onClick={onClose} aria-label={t("common.close")} className="ms-auto grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
          <X className="size-3" />
        </button>
      </div>
      <div className="mt-1 space-y-0.5 text-fg-2">
        {filled > 0 && <div>{t("trader.opt.bt.res.filled", { n: qty(filled), total: qty(total), price: avg !== null ? usd(avg * units.k) : "—" })}</div>}
        {resting > 0 && <div>{t("trader.opt.bt.res.resting", { n: qty(resting), price: o?.price !== null && o?.price !== undefined ? usd(o.price * units.k) : "—" })}</div>}
        {!filled && !resting && r.status !== "working" && <div>{r.reason ? optionErrorText(r.reason) : t("trader.opt.bt.res.nothing")}</div>}
        {r.status === "working" && o?.trigger && <div>{t("trader.opt.bt.res.stopArmed")}</div>}
        {filled > 0 && filled < total && !resting && <div className="text-warn">{t("trader.opt.bt.res.restCancelled", { n: qty(total - filled) })}</div>}
      </div>
      {r.fills.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-line/70 pt-1.5 font-mono text-[10.5px] text-fg-3">
          {r.fills.slice(0, 6).map((f) => (
            <li key={f.fillId} className="flex justify-between gap-2">
              <span>
                {qty(f.qty)} @ {usd(f.price * units.k)} · {t.dyn(`trader.opt.ord.role.${f.role}`, f.role)}
              </span>
              <span className={f.rebate > 0 ? "text-up" : undefined}>{f.rebate > 0 ? `+${usd(f.rebate)}` : f.fee > 0 ? `−${usd(f.fee)}` : "0.00"}</span>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => T.setWs({ toolboxTab: "orders" })} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ember hover:underline">
        {t("trader.opt.bt.res.viewOrders")} <ArrowUpRight className="size-3" />
      </button>
    </div>
  );
}

/** Order type, price, time in force, flags, stop trigger, the book preview and the order button of a single option. */
export function BookOrderForm({ leg, onDone }: { leg: TicketLeg; onDone?: () => void }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const ticket = useOpt((s) => s.ticket);
  const publicView = useOpt((s) => s.publicView);
  const cutAt = useOpt((s) => s.expiries.find((e) => e.date === leg.expiry && s.u === leg.u)?.cutAt ?? (s.chain?.expiry === leg.expiry && s.chain.underlying === leg.u ? s.chain.cutAt : null));
  const spot = useOpt((s) => (s.chain && s.chain.underlying === leg.u ? s.chain.spot?.mid : undefined));
  const q = useSeriesQuote(leg.series);
  const units = useSeriesUnits(leg.series);
  const p = parseSeriesCode(leg.series);
  const digits = p ? (OPTION_SPEC[p.underlying]?.digits ?? 5) : 5;
  const [busy, setBusy] = React.useState(false);
  const [last, setLast] = React.useState<BookOrderResult | null>(null);
  const [lastErr, setLastErr] = React.useState<{ code: string; message: string } | null>(null);
  React.useEffect(() => {
    setLast(null);
    setLastErr(null);
  }, [leg.series]);
  // Buy / Sell chosen with an empty limit price: start from the price on that button (the best offer / bid)
  const touch = q ? (leg.side === "buy" ? q.askUsd : q.bidUsd) || q.markUsd : 0;
  React.useEffect(() => {
    const tk = getOpt().ticket;
    if (!tk.armed || tk.bookType !== "limit" || tk.limit || !(touch > 0)) return;
    opt.setTicket({ limit: touch.toFixed(2) });
    // only when the side is chosen (not on every price tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.armed, leg.side, leg.series]);
  const armed = ticket.armed;
  const { req, missing } = bookRequest(ticket, leg, units);
  const preview = useBookPreview(req, armed && !publicView);
  const guest = T.guest || publicView;
  const type = ticket.bookType;
  const limitTif = type === "limit";
  const stopLimit = type === "stop" && ticket.stopKind === "limit";
  const priced = limitTif || stopLimit;
  const markUsd = q?.markUsd;
  const stepUsd = Math.max(0.01, units.tickUsd || 0.01);
  const limitUnit = priced && parseFloat(ticket.limit) > 0 && units.k > 0 ? toTick(parseFloat(ticket.limit) / units.k, units.tick) : null;
  const bandUsd = q && q.mark > 0 ? q.markUsd * 0.1 : null;
  const blocked = !armed || guest || T.readOnly || busy || !req || (q !== null && q.state === "closed") || (preview.preview !== null && !preview.preview.ok);
  const sideWord = leg.side === "buy" ? t("common.buy") : t("common.sell");
  const rightWord = leg.right === "call" ? t("trader.opt.call") : t("trader.opt.put");

  const setType = (v: Ticket["bookType"]) => {
    const patch: Partial<Ticket> = { bookType: v };
    if (v === "stop" && !ticket.trigPrice) {
      patch.trigOp = leg.side === "sell" ? "below" : "above";
      if (ticket.trigSource === "mark" && markUsd) patch.trigPrice = markUsd.toFixed(2);
      else if (spot) patch.trigPrice = spot.toFixed(digits);
    }
    if (v === "limit" && !ticket.limit && q) {
      const join = leg.side === "buy" ? q.bidUsd || q.markUsd : q.askUsd || q.markUsd;
      if (join) patch.limit = join.toFixed(2);
    }
    opt.setTicket(patch);
  };

  const submit = async () => {
    if (blocked || !req) return;
    setBusy(true);
    setLastErr(null);
    const send: BookOrderRequest = { ...req, clientOrderId: clientOrderId("bk") };
    const r = await bookApi.place(T.account.login, send);
    setBusy(false);
    const what = t("trader.opt.ticket.what", { side: sideWord, n: leg.contracts, series: `${leg.u} ${leg.strikeLabel} ${rightWord}`, date: expiryLabel(leg.expiry, locale, false) });
    if (!r.ok) {
      if (bookMissing(r.err)) {
        opt.setBookOff(true);
        toast.warning(t("trader.opt.bt.bookOff"));
        return;
      }
      setLastErr({ code: r.err.code, message: r.err.message });
      T.log("Trade", `'${T.account.login}': book order ${send.side} ${send.qty} ${send.series} ${send.type} failed [${r.err.code}]`, "error");
      if (!needsOnboarding(r.err.code)) toast.error(t("trader.opt.toast.rejected"), { description: `${what} · ${errText(r.err)}` });
      return;
    }
    const res = r.data;
    void bookOrders.refresh(T.account.login);
    opt.syncOrderSeries();
    if (res.status === "rejected") {
      const code = res.reason ?? "rejected";
      setLastErr({ code, message: optionErrorText(code) });
      toast.error(t("trader.opt.toast.rejected"), { description: `${what} · ${optionErrorText(code)}` });
      return;
    }
    setLast(res);
    const filled = res.fills.reduce((n, f) => n + f.qty, 0);
    const avg = filled ? usd((res.fills.reduce((s, f) => s + f.price * f.qty, 0) / filled) * units.k) : "";
    T.log("Trade", `'${T.account.login}': book order #${res.order?.id ?? "?"} ${send.side} ${send.qty} ${send.series} ${send.type} ${res.status}${filled ? ` (${filled} filled @ ${avg})` : ""}`);
    if (res.status === "filled") toast.success(t("trader.opt.bt.toast.filled"), { description: `${what} · ${t("trader.opt.bt.toast.avg", { price: avg })}` });
    else if (res.status === "partially_filled") toast.success(t("trader.opt.bt.toast.partial", { n: filled, total: send.qty }), { description: `${what} · ${t("trader.opt.bt.toast.avg", { price: avg })}` });
    else if (res.status === "working") toast(res.order?.trigger ? t("trader.opt.bt.toast.stop") : t("trader.opt.bt.toast.resting"), { description: what });
    else toast.warning(t("trader.opt.bt.toast.notFilled"), { description: `${what} · ${res.reason ? optionErrorText(res.reason) : ""}` });
    opt.setTicket({ armed: false, limit: "", trigPrice: "", gtd: "", reduceOnly: false, postOnly: false });
    onDone?.();
  };

  const tifHint = t.dyn(`trader.opt.bt.tif.${limitTif ? ticket.bookTif : ticket.bookTif === "gtd" ? "gtd" : "gtc"}Hint`, "");
  const label = !armed
    ? t("trader.opt.ticket.chooseSide")
    : `${sideWord} ${leg.contracts} × ${leg.strikeLabel} ${rightWord} · ${type === "market" ? t("trader.opt.ord.type.market") : type === "stop" ? t(ticket.stopKind === "market" ? "trader.opt.ord.type.stop_market" : "trader.opt.ord.type.stop_limit") : `${t("trader.opt.ord.type.limit")} ${ticket.limit ? usd(parseFloat(ticket.limit)) : ""}`}`;

  return (
    <div className="space-y-2.5">
      <div>
        <Label right={<MmRulesLink />}>{t("trader.opt.ticket.orderType")}</Label>
        <Seg<Ticket["bookType"]>
          value={type}
          onChange={setType}
          options={[
            { value: "limit", label: t("trader.opt.ord.type.limit") },
            { value: "market", label: t("trader.opt.ord.type.market") },
            { value: "stop", label: t("trader.opt.bt.stop") },
          ]}
        />
      </div>

      {type === "stop" && (
        <div className="space-y-1.5 rounded-[7px] border border-line bg-surface-2/40 p-2">
          <Seg<Ticket["stopKind"]>
            size="sm"
            value={ticket.stopKind}
            onChange={(v) => opt.setTicket({ stopKind: v, bookTif: ticket.bookTif === "gtd" ? "gtd" : "gtc" })}
            options={[
              { value: "market", label: t("trader.opt.ord.type.stop_market") },
              { value: "limit", label: t("trader.opt.ord.type.stop_limit") },
            ]}
          />
          <div className="flex items-center justify-between gap-2 text-[11px] text-fg-3">
            <span>{t("trader.opt.bt.trigBy")}</span>
            <Seg<Ticket["trigSource"]>
              size="sm"
              className="w-[150px]"
              value={ticket.trigSource}
              onChange={(v) => opt.setTicket({ trigSource: v, trigPrice: v === "mark" ? (markUsd ? markUsd.toFixed(2) : "") : spot ? spot.toFixed(digits) : "" })}
              options={[
                { value: "mark", label: t("trader.opt.col.mark") },
                { value: "underlying", label: leg.u },
              ]}
            />
          </div>
          <div className="grid grid-cols-[96px_1fr] gap-1.5">
            <TSelect<"above" | "below"> ariaLabel={t("trader.opt.ticket.triggerOp")} value={ticket.trigOp} onChange={(v) => opt.setTicket({ trigOp: v })} options={[{ value: "above", label: t("trader.opt.ticket.above") }, { value: "below", label: t("trader.opt.ticket.below") }]} />
            <Stepper
              ariaLabel={t("trader.opt.ticket.triggerPrice")}
              value={ticket.trigPrice}
              onChange={(v) => opt.setTicket({ trigPrice: v })}
              step={ticket.trigSource === "mark" ? stepUsd : 10 ** -digits}
              decimals={ticket.trigSource === "mark" ? 2 : digits}
              placeholder={ticket.trigSource === "mark" ? (markUsd ? markUsd.toFixed(2) : undefined) : spot ? spot.toFixed(digits) : undefined}
            />
          </div>
          <div className="text-[10px] leading-snug text-fg-3">{ticket.trigSource === "mark" ? t("trader.opt.bt.trigMarkHint", { now: markUsd !== undefined ? usd(markUsd) : "—" }) : t("trader.opt.bt.trigUnderHint", { u: leg.u, now: px(spot, digits) })}</div>
        </div>
      )}

      {priced && (
        <div>
          <Label right={limitUnit !== null ? <span className="font-mono text-[10px] text-fg-3">{t("trader.opt.bt.perUnit", { price: px(limitUnit, tickDecimals(units.tick)) })}</span> : undefined}>{stopLimit ? t("trader.opt.bt.limitAfter") : t("trader.opt.bt.limitPrice")}</Label>
          <Stepper ariaLabel={t("trader.opt.bt.limitPrice")} value={ticket.limit} onChange={(v) => opt.setTicket({ limit: v })} step={stepUsd} min={0} decimals={2} placeholder={markUsd ? usd(markUsd) : undefined} />
          {q && limitTif && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(
                [
                  ["bid", q.bidUsd],
                  ["mid", q.bidUsd > 0 && q.askUsd > 0 ? (q.bidUsd + q.askUsd) / 2 : 0],
                  ["ask", q.askUsd],
                  ["mark", q.markUsd],
                ] as const
              ).map(([k, v]) => (
                <button key={k} disabled={!(v > 0)} onClick={() => opt.setTicket({ limit: v.toFixed(2) })} className="k-num h-5 rounded-[4px] border border-line px-1.5 font-mono text-[10px] text-fg-3 hover:border-fg-3/50 hover:text-fg disabled:opacity-40">
                  {t(`trader.opt.bt.chip.${k}`)} {v > 0 ? usd(v) : "—"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(priced || type === "market") && (
        <div className="space-y-1.5 rounded-[7px] border border-line bg-surface-2/40 p-2">
          {priced && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-fg-3">
              <span>{t("trader.opt.ticket.tif")}</span>
              <Seg<BookTif>
                size="sm"
                className={limitTif ? "w-[176px]" : "w-[96px]"}
                value={limitTif ? ticket.bookTif : ticket.bookTif === "gtd" ? "gtd" : "gtc"}
                onChange={(v) => opt.setTicket({ bookTif: v, gtd: v === "gtd" && !ticket.gtd ? localInput(Math.min(Date.now() + 3_600_000, cutAt ? Date.parse(cutAt) - 120_000 : Infinity)) : ticket.gtd, postOnly: v === "gtc" ? ticket.postOnly : false })}
                options={(limitTif ? (["gtc", "ioc", "fok", "gtd"] as const) : (["gtc", "gtd"] as const)).map((v) => ({ value: v, label: t(`trader.opt.bt.tif.${v}`), title: t.dyn(`trader.opt.bt.tif.${v}Hint`, "") }))}
              />
            </div>
          )}
          {priced && ticket.bookTif === "gtd" && (
            <TInput type="datetime-local" aria-label={t("trader.opt.bt.gtdAt")} value={ticket.gtd} min={localInput(Date.now())} max={cutAt ? localInput(Date.parse(cutAt)) : undefined} onChange={(e) => opt.setTicket({ gtd: e.target.value })} className="font-mono" />
          )}
          {priced && tifHint && <div className="text-[10px] leading-snug text-fg-3">{tifHint}</div>}
          {type === "market" && <div className="text-[10.5px] leading-snug text-fg-2">{t("trader.opt.bt.marketHint", { band: bandUsd !== null ? usd(bandUsd) : "—" })}</div>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {limitTif && (
              <span title={t("trader.opt.bt.postOnlyHint")} className={cn(ticket.bookTif !== "gtc" && "pointer-events-none opacity-45")}>
                <Check checked={ticket.postOnly && ticket.bookTif === "gtc"} onChange={(v) => opt.setTicket({ postOnly: v })} label={<span className="text-[11px]">{t("trader.opt.bt.postOnly")}</span>} />
              </span>
            )}
            <span title={t("trader.opt.bt.reduceOnlyHint")}>
              <Check checked={ticket.reduceOnly} onChange={(v) => opt.setTicket({ reduceOnly: v })} label={<span className="text-[11px]">{t("trader.opt.bt.reduceOnly")}</span>} />
            </span>
          </div>
        </div>
      )}
      {type === "stop" && (
        <div className="flex items-center gap-3">
          <span title={t("trader.opt.bt.reduceOnlyHint")}>
            <Check checked={ticket.reduceOnly} onChange={(v) => opt.setTicket({ reduceOnly: v })} label={<span className="text-[11px]">{t("trader.opt.bt.reduceOnly")}</span>} />
          </span>
          <span className="text-[10px] text-fg-3">{t("trader.opt.bt.stopHint")}</span>
        </div>
      )}

      {armed && missing && <div className="text-[11px] text-fg-3">{t(missing as "trader.opt.bt.needPrice")}</div>}
      {armed && req && !guest && <BookPreviewCard state={preview} req={req} units={units} />}
      {lastErr && <ErrorNote code={lastErr.code} message={lastErr.message} />}
      {last && <ResultCard r={last} units={units} onClose={() => setLast(null)} />}

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
            !armed ? "bg-surface-3 text-fg-3" : leg.side === "buy" ? "bg-up" : "bg-down",
          )}
        >
          <span className="truncate">{busy ? t("trader.opt.ticket.sending") : label}</span>
          {preview.preview && preview.preview.reserve > 0 && <span className="k-num shrink-0 rounded-[5px] bg-black/15 px-1.5 py-0.5 font-mono text-[11px]" title={t("trader.opt.bt.pv.reserve")}>{usd(preview.preview.reserve)} USD</span>}
        </button>
      )}
    </div>
  );
}

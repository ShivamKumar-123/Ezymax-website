"use client";

// Toolbox › Options (and the phone's Positions tab): open option positions as easy cards. Each card says what it is
// ("EURUSD Call 1.1275 · Bought ×2"), whether it is winning or losing (P&L in money and % of the premium), what was paid
// and what it is worth now, the expiry with its countdown, and in plain words what happens at expiry (where it pays,
// and what it would pay at today's price). Close is one tap (the button shows what you get or pay); Close part, Show
// on the chart and the details (ticket, open time, prices per contract, breakeven, commission, Greeks) are next to
// it. Strategies (combos) are one card with their legs, closed all together. Working option orders follow, and the
// footer shows the shared account (CFDs and options use one account: same equity and margin).
//
// Numbers match the engine: P&L is the position's value at the mark (model mid; inside the best bid / offer on the
// order book) against the premium it was opened at, commission excluded, exactly like the engine's `profit`, which
// wins whenever the engine streams it (equity frames carry the mark and the Greeks too). Closing sells at the bid /
// buys back at the ask (house) or reduce-only at market through the book: the close button shows that amount.
import * as React from "react";
import { CalendarClock, ChevronDown, Crosshair, Layers, Scissors, Sigma, Zap } from "lucide-react";
import { OPTION_SPEC } from "@kalks/mock/options";
import { cn, useQuote } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useMetrics, useTerminal } from "@/lib/store";
import { accCcy, accMoney, fmtServer } from "@/lib/trading";
import { useLivePosition, type LivePos } from "@/lib/engine/live";
import { LiveMoney, Pnl, Stepper } from "@/components/ui/primitives";
import { DropMenu } from "@/components/ui/menu";
import { engineUsd, optionsApi } from "@/lib/options/api";
import { usdPerQuote, useOptionBook } from "@/lib/options/book";
import { bookApi } from "@/lib/options/book-api";
import { usdPerUnitOfQuote } from "@/lib/options/normalize";
import { errText, rfqErrorText, rfqRequotable } from "@/lib/options/errors";
import { detectTemplate } from "@/lib/options/math";
import { breakevenOf, expiryCash } from "@/lib/options/plain";
import { setTradeMode } from "@/lib/options/mode";
import { opt, quoteOf, useBookLive, useOpt, useOptionsAttach, useSeriesQuote } from "@/lib/options-store";
import type { OptOrder, OptPosition, OptionQuote } from "@/lib/options/types";
import { OptAvatar, useNow } from "./bits";
import { KalksQuotedTag } from "./book-bits";
import { Explain } from "./explain";
import { countdown, cutWhen, expiryLabel, greek, iso, money, moneySigned, nyCut, pct, pctSigned, px, strikeOf, usd, usdSigned } from "./format";

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

export interface PosLive {
  q: OptionQuote | null;
  /** USD per contract for one unit of premium */
  usdU: number;
  /** premium per contract at the open / at the mark, USD */
  openUsd: number;
  markUsd: number | undefined;
  /** P&L in USD at the mark, commission excluded (the engine's figure when it streams one) */
  profit: number;
  /** premium paid (long) or received (short) for the whole position, USD */
  basis: number;
  /** what closing all of it now pays (+) or costs (−), USD; undefined without a price */
  closeNow: number | undefined;
  g: { delta: number; gamma: number; theta: number; vega: number };
}

/** Live numbers of one position: USD per contract, mark, P&L, Greeks. */
export function useOptionPositionLive(p: OptPosition): PosLive {
  const T = useTerminal();
  const q = useSeriesQuote(p.option.series);
  const live = useLivePosition(T.engine ? p.login || T.account.login : null, p.ticket);
  return derive(p, q, live);
}

/** USD per contract for one unit of premium of a position: its quote, else contract size × USD per quote currency. */
export function usdUnitOfPosition(p: Pick<OptPosition, "option">, q: OptionQuote | null): number {
  const k = usdPerUnitOfQuote(q);
  if (k > 0) return k;
  const size = p.option.contractSize || OPTION_SPEC[p.option.underlying]?.contractSize || 0;
  const perQuote = usdPerQuote(p.option.underlying);
  return size * (perQuote > 0 ? perQuote : 1);
}

export function derive(p: OptPosition, q: OptionQuote | null, live?: LivePos): PosLive {
  const usdU = usdUnitOfPosition(p, q);
  const k = p.side === "buy" ? 1 : -1;
  // the engine's mark for this account (book: clamped inside its best bid / offer), else the chain's, else the state's
  const markUnit = live?.mark ?? q?.mark ?? p.mark;
  // the engine values option positions at the mark, commission excluded (services/trading engine/options.rs)
  const computed = markUnit !== undefined ? k * (markUnit - p.openPrice) * usdU * p.contracts : undefined;
  const profit = live?.profit ?? p.profit ?? computed ?? 0;
  // closing: house prices sell at the bid / buy back at the ask; the book closes at market (≈ the mark). Without a
  // live quote (barrier series, a chain that isn't streamed) the close price isn't known: no amount is shown
  const exitUnit = q ? (q.book ? q.mark : p.side === "buy" ? q.bid : q.ask) : undefined;
  const closeNow = exitUnit !== undefined && exitUnit > 0 ? k * exitUnit * usdU * p.contracts : exitUnit === 0 && p.side === "buy" ? 0 : undefined;
  const lg = live?.greeks;
  const g = lg
    ? { delta: lg.delta ?? 0, gamma: lg.gamma ?? 0, theta: lg.theta ?? 0, vega: lg.vega ?? 0 }
    : q
      ? { delta: k * p.contracts * q.delta, gamma: k * p.contracts * q.gamma, theta: k * p.contracts * q.theta, vega: k * p.contracts * q.vega }
      : { delta: p.greeks?.delta ?? 0, gamma: p.greeks?.gamma ?? 0, theta: p.greeks?.theta ?? 0, vega: p.greeks?.vega ?? 0 };
  return { q, usdU, openUsd: p.openPrice * usdU, markUsd: markUnit !== undefined ? markUnit * usdU : undefined, profit, basis: p.openPrice * usdU * p.contracts, closeNow, g };
}

const sum = (xs: PosLive[]) =>
  xs.reduce((a, x) => ({ profit: a.profit + x.profit, basis: a.basis + x.basis, delta: a.delta + x.g.delta, gamma: a.gamma + x.g.gamma, theta: a.theta + x.g.theta, vega: a.vega + x.g.vega }), { profit: 0, basis: 0, delta: 0, gamma: 0, theta: 0, vega: 0 });

/** Reports each card's numbers up so groups and the summary can total them without re-subscribing. */
type Report = (ticket: string, v: PosLive) => void;

/** Spot of an underlying: the chain on screen, else the CFD feed. */
function useSpot(u: string): number | undefined {
  const chainSpot = useOpt((s) => (s.chain && s.chain.underlying === u ? s.chain.spot?.mid : undefined));
  const fq = useQuote(u);
  const feed = fq.bid > 0 ? (fq.bid + fq.ask) / 2 : undefined;
  return chainSpot ?? feed;
}

const cutOf = (p: OptPosition) => Date.parse(p.option.expiryAt) || (p.option.expiry ? nyCut(p.option.expiry) : NaN);
const digitsOf = (u: string) => OPTION_SPEC[u]?.digits ?? 5;

/* ------------------------------------------------------------------ */
/* Closing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Close one option position (all of it, or `n` contracts), with the toast and journal line. A book-venue position is
 * closed reduce-only at market through the book (`{status: filled | partial, filled, avgPrice, left}`): a partial close
 * says how much is still open; house positions close at the house price (`{status, profit}`). The engine answers
 * money in the account's currency (USC on cent accounts), shown here in USD like everything else.
 */
export async function closeOptionPosition(T: ReturnType<typeof useTerminal>, t: ReturnType<typeof useT>, p: OptPosition, n?: number) {
  const part = n !== undefined && n < p.contracts;
  const want = part ? n! : p.contracts;
  const r = await bookApi.closePosition(T.account.login, p.ticket, part ? n : undefined);
  const what = `${p.option.underlying} ${strikeOf(p.option, digitsOf(p.option.underlying))} ${p.option.right === "call" ? "C" : "P"} #${p.ticket}`;
  if (!r.ok) return void toast.error(t("trader.opt.toast.closeRejected"), { description: `${what} · ${errText(r.err)}` });
  const d = r.data;
  const k = usdUnitOfPosition(p, quoteOf(p.option.series));
  const avg = d.avgPrice !== undefined && d.avgPrice !== null ? t("trader.opt.bt.toast.avg", { price: usd(d.avgPrice * k) }) : null;
  const pr = engineUsd(d.profit, T.account.cent);
  const desc = [what, avg, pr !== undefined ? `${usdSigned(pr)} USD` : null].filter(Boolean).join(" · ");
  if (d.status === "partial") {
    const filled = d.filled ?? 0;
    T.log("Trade", `'${T.account.login}': option position #${p.ticket} ${p.option.series} closed ${filled} of ${want} through the book, ${d.left ?? want - filled} left`, "warn");
    return void toast.warning(t("trader.opt.toast.closedPartialBook", { filled, total: want, left: d.left ?? want - filled }), { description: desc, duration: 9000 });
  }
  T.log("Trade", `'${T.account.login}': option position #${p.ticket} ${p.option.series} ${part ? `partially closed (${n} of ${p.contracts})` : "closed"}${d.status === "filled" ? " through the book" : ""}`);
  (pr === undefined || pr >= 0 ? toast.success : toast.error)(part ? t("trader.opt.toast.closedPartial", { count: n! }) : t("trader.opt.toast.closed"), { description: desc });
}

/**
 * Close a whole strategy. House strategies close at the house prices; a strategy held on the order book closes through
 * a reduce-only combo RFQ to the Kalks market maker (`venue: "book"`, the `net` paid or received per strategy unit),
 * every leg at once or none. Refusals read in plain words; a stale price or no quote offers "Try again".
 * The engine's money is in the account's currency (USC on cent accounts): shown in USD.
 */
async function closeCombo(T: ReturnType<typeof useTerminal>, t: ReturnType<typeof useT>, id: string, legs: OptPosition[]): Promise<void> {
  const r = await optionsApi.closeCombo(T.account.login, id);
  if (!r.ok) {
    const code = r.err.code;
    T.log("Trade", `'${T.account.login}': option strategy ${id} close refused [${code}]`, "warn");
    return void toast.error(t("trader.opt.toast.closeRejected"), {
      description: rfqErrorText(code, r.err.message),
      duration: 10_000,
      action: rfqRequotable(code) ? { label: t("trader.opt.toast.tryAgain"), onClick: () => void closeCombo(T, t, id, legs) } : undefined,
    });
  }
  const d = r.data;
  const pr = engineUsd(d.profit, T.account.cent);
  if (d.venue === "book") {
    // the net per strategy unit (per unit of the underlying) × USD per unit × the strategy's size
    const usdU = legs.length ? usdUnitOfPosition(legs[0]!, quoteOf(legs[0]!.option.series)) : 0;
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
    const size = legs.reduce((g, l) => gcd(g, Math.round(l.contracts)), 0) || 1;
    const amount = d.net !== undefined && usdU > 0 ? Math.abs(d.net) * usdU * size : undefined;
    T.log("Trade", `'${T.account.login}': option strategy ${id} closed through the order book (RFQ ${d.rfq ?? "?"}, net ${d.net ?? "?"})${d.settling ? ", booking" : ""}`);
    const pnl = pr !== undefined ? moneySigned(pr) : "—";
    const desc = amount !== undefined ? t((d.net ?? 0) >= 0 ? "trader.opt.pos.closedNetPaid" : "trader.opt.pos.closedNetGot", iso({ amount: money(amount), pnl })) : pr !== undefined ? `${pnl}` : undefined;
    return void (pr === undefined || pr >= 0 ? toast.success : toast.error)(t("trader.opt.toast.strategyClosedBook"), { description: d.settling && desc ? `${desc} · ${t("trader.opt.toast.settling")}` : desc });
  }
  T.log("Trade", `'${T.account.login}': option strategy ${id} closed`);
  (pr === undefined || pr >= 0 ? toast.success : toast.error)(t("trader.opt.toast.strategyClosed"), { description: pr !== undefined ? moneySigned(pr) : undefined });
}

function PartialClose({ p, onClose, className }: { p: OptPosition; onClose: (n: number) => void; className?: string }) {
  const t = useT();
  const [n, setN] = React.useState(String(Math.max(1, Math.floor(p.contracts / 2))));
  return (
    <DropMenu
      width={220}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} disabled={p.contracts <= 1} title={t("trader.opt.pos.partial")} aria-label={t("trader.opt.pos.partial")} className={cn("grid size-8 place-items-center rounded-[8px] border border-line text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-35", open && "bg-surface-3 text-fg", className)}>
          <Scissors className="size-3.5" />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2 p-3">
          <div className="text-[12px] font-medium text-fg">{t("trader.opt.pos.partialTitle", { ticket: p.ticket })}</div>
          <Stepper ariaLabel={t("trader.opt.ticket.contracts")} value={n} onChange={setN} step={1} min={1} decimals={0} className="h-8" />
          <div className="text-[10.5px] text-fg-3">{t("trader.opt.pos.ofContracts", { count: p.contracts })}</div>
          <button
            onClick={() => {
              const v = Math.min(p.contracts, Math.max(1, Math.round(parseFloat(n) || 1)));
              close();
              onClose(v);
            }}
            className="h-8 w-full rounded-[8px] bg-ember text-[12px] font-semibold text-white hover:brightness-110"
          >
            {t("trader.opt.pos.closeN", { count: Math.min(p.contracts, Math.max(1, Math.round(parseFloat(n) || 1))) })}
          </button>
        </div>
      )}
    </DropMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ResultChip({ v }: { v: number }) {
  const t = useT();
  const tone = v > 0.004 ? "up" : v < -0.004 ? "down" : "flat";
  return (
    <span className={cn("inline-flex h-[18px] items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold", tone === "up" ? "bg-up-soft text-up" : tone === "down" ? "bg-down-soft text-down" : "bg-surface-3 text-fg-3")}>
      <span className={cn("size-1.5 rounded-full", tone === "up" ? "bg-up" : tone === "down" ? "bg-down" : "bg-fg-3")} />
      {tone === "up" ? t("trader.opt.pos.winning") : tone === "down" ? t("trader.opt.pos.losing") : t("trader.opt.pos.even")}
    </span>
  );
}

function SideChip({ side, n }: { side: "buy" | "sell"; n: number }) {
  const t = useT();
  return (
    <span className={cn("inline-flex h-[18px] items-center gap-1 rounded-[5px] px-1.5 text-[10.5px] font-semibold", side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
      {side === "buy" ? t("trader.opt.pos.bought") : t("trader.opt.pos.sold")}
      <span className="font-mono">×{n}</span>
    </span>
  );
}

function RightChip({ right }: { right: "call" | "put" }) {
  const t = useT();
  return <span className={cn("rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold", right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span>;
}

/** Expiry with its countdown; after the cut: "settling". */
function ExpiryLine({ cut, locale, now }: { cut: number; locale: string; now: number }) {
  const t = useT();
  if (!Number.isFinite(cut)) return null;
  const left = cut - now;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-fg-3">
      <CalendarClock className="size-3 shrink-0" />
      <span className="truncate">{cutWhen(cut, locale)}</span>
      {left > 0 ? <span className={cn("k-num shrink-0 font-mono", left < 3_600_000 ? "text-warn" : "text-fg-2")}>{countdown(cut, now)}</span> : <span className="shrink-0 font-medium text-warn">{t("trader.opt.pos.settling")}</span>}
    </span>
  );
}

function Detail({ k, v, title }: { k: React.ReactNode; v: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="truncate text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{k}</div>
      <div className="k-num truncate font-mono text-[11.5px] text-fg-2">{v}</div>
    </div>
  );
}

/** Plain "what happens at expiry" for one position, with what it would pay at today's price. */
function useExpiryText(p: OptPosition, spot: number | undefined, usdU: number) {
  const t = useT();
  const u = p.option.underlying;
  const strike = strikeOf(p.option, digitsOf(u));
  const long = p.side === "buy";
  const what =
    p.option.right === "call"
      ? long
        ? t("trader.opt.pos.exp.longCall", iso({ u, strike }))
        : t("trader.opt.pos.exp.shortCall", iso({ u, strike }))
      : long
        ? t("trader.opt.pos.exp.longPut", iso({ u, strike }))
        : t("trader.opt.pos.exp.shortPut", iso({ u, strike }));
  if (spot === undefined || !(usdU > 0)) return { what, now: null as string | null, nowTone: null as "up" | "down" | null };
  const cash = expiryCash([{ right: p.option.right, strike: p.option.strike, side: p.side, contracts: p.contracts }], spot, usdU);
  const now = cash > 0.004 ? t("trader.opt.pos.exp.nowGet", iso({ amount: money(cash) })) : cash < -0.004 ? t("trader.opt.pos.exp.nowPay", iso({ amount: money(-cash) })) : long ? t("trader.opt.pos.exp.nowZero") : t("trader.opt.pos.exp.nowKeep");
  return { what, now, nowTone: cash > 0.004 ? ("up" as const) : cash < -0.004 ? ("down" as const) : null };
}

function BarrierLine({ p, usdU }: { p: OptPosition; usdU: number }) {
  const t = useT();
  const b = p.option.barrier;
  if (!b) return null;
  const level = b.level ?? b.price;
  const kind = String(b.kind ?? b.type ?? "").toUpperCase();
  const isIn = kind === "UI" || kind === "DI" || kind.includes("IN");
  const knockedIn = !!(b as { knockedIn?: boolean }).knockedIn;
  const lv = level !== undefined ? px(level, digitsOf(p.option.underlying)) : "—";
  const rebate = b.rebate && b.rebate > 0 && usdU > 0 ? money(b.rebate * usdU * p.contracts) : null;
  return (
    <div className="flex items-start gap-1.5 rounded-[7px] bg-warn-soft px-2 py-1 text-[11px] leading-snug text-fg-2" dir="auto">
      <Zap className="mt-px size-3 shrink-0 text-warn" />
      <span>
        {isIn ? (knockedIn ? t("trader.opt.pos.barrier.knockedIn") : t("trader.opt.pos.barrier.in", iso({ u: p.option.underlying, level: lv }))) : t("trader.opt.pos.barrier.out", iso({ u: p.option.underlying, level: lv }))}
        {rebate && !knockedIn && <span className="text-fg-3"> {t("trader.opt.pos.barrier.rebate", iso({ amount: rebate }))}</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function CloseButton({ v, side, busy, onClick, title, small }: { v: PosLive; side: "buy" | "sell"; busy: boolean; onClick: () => void; title?: string; small?: boolean }) {
  const t = useT();
  const amt = v.closeNow;
  return (
    <button onClick={onClick} disabled={busy} title={title} className={cn("flex min-w-0 items-center justify-center gap-1.5 rounded-[8px] border border-line bg-surface-2 px-3 font-medium text-fg transition-colors hover:border-down/50 hover:bg-down-soft hover:text-down disabled:opacity-50", small ? "h-8 text-[11.5px]" : "h-8 text-[12px]")}>
      <span>{busy ? t("trader.opt.ticket.sending") : t("trader.opt.pos.close")}</span>
      {!busy && amt !== undefined && <span className="k-num truncate text-[11px] text-fg-3">· {side === "buy" ? t("trader.opt.pos.closeGet", iso({ amount: money(Math.max(0, amt)) })) : t("trader.opt.pos.closePay", iso({ amount: money(Math.abs(amt)) }))}</span>}
    </button>
  );
}

const PositionCard = React.memo(function PositionCard({ p, readOnly, report, locale }: { p: OptPosition; readOnly: boolean; report?: Report; locale: string }) {
  const T = useTerminal();
  const t = useT();
  const bookLive = useBookLive();
  const v = useOptionPositionLive(p);
  const now = useNow();
  const spot = useSpot(p.option.underlying);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => report?.(p.ticket, v));
  const cut = cutOf(p);
  const u = p.option.underlying;
  const digits = digitsOf(u);
  const strike = strikeOf(p.option, digits);
  const exp = useExpiryText(p, spot, v.usdU);
  const pctOf = v.basis > 0 ? v.profit / v.basis : null;
  const be = breakevenOf(p.option.right, p.option.strike, p.openPrice);
  const close = (n?: number) => {
    setBusy(true);
    void closeOptionPosition(T, t, p, n).finally(() => setBusy(false));
  };
  return (
    <div className="@container min-w-0 rounded-[12px] border border-line bg-panel-2/70 shadow-[var(--k-shadow-card)] transition-colors hover:border-line-top">
      <div className="opt-pos">
        <div data-area="a" className="flex min-w-0 items-start gap-2.5 ps-3 pt-2.5">
          <OptAvatar symbol={u} size={20} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13.5px] font-semibold text-fg">{u}</span>
              <RightChip right={p.option.right} />
              <span className="font-mono text-[13px] font-semibold text-fg">{strike}</span>
              <SideChip side={p.side} n={p.contracts} />
              {p.option.barrier && <span className="rounded-[4px] bg-warn-soft px-1 text-[9.5px] font-semibold text-warn">{t("trader.opt.pos.barrier")}</span>}
              {bookLive && (p.option.barrier || p.venue === "house") && <KalksQuotedTag />}
            </div>
            <div className="mt-1">
              <ExpiryLine cut={cut} locale={locale} now={now} />
            </div>
          </div>
        </div>
        <div data-area="b" className="mt-2 min-w-0 space-y-1 px-3 text-[11.5px] leading-snug" dir="auto">
          <div className="text-fg-2">
            {p.side === "buy"
              ? t("trader.opt.pos.valueLong", iso({ paid: money(v.basis), now: v.markUsd !== undefined ? money(v.markUsd * p.contracts) : "—" }))
              : t("trader.opt.pos.valueShort", iso({ paid: money(v.basis), now: v.markUsd !== undefined ? money(v.markUsd * p.contracts) : "—" }))}
            <Explain topic="mark" size={11} className="ms-1" />
          </div>
          <div className="text-fg-3">
            {exp.what} {exp.now && <span className={cn(exp.nowTone === "up" ? "text-up" : exp.nowTone === "down" ? "text-down" : "text-fg-2")}>{exp.now}</span>}
          </div>
          <BarrierLine p={p} usdU={v.usdU} />
        </div>
        <div data-area="c" className="flex shrink-0 flex-col items-end gap-1 pe-3 pt-2.5">
          <span className="text-[16px] font-semibold leading-none">
            <Pnl value={v.profit} text={moneySigned(v.profit)} format={(x) => moneySigned(x)} />
          </span>
          <span className="flex items-center gap-1.5">
            {pctOf !== null && <span className={cn("k-num font-mono text-[11px]", v.profit > 0 ? "text-up" : v.profit < 0 ? "text-down" : "text-fg-3")}>{pctSigned(pctOf)}</span>}
            <ResultChip v={v.profit} />
          </span>
        </div>
        <div data-area="d" className="flex items-center gap-1.5 px-3 pb-2.5 pt-2.5">
          {!readOnly && <CloseButton v={v} side={p.side} busy={busy} onClick={() => close()} title={bookLive && !p.option.barrier ? t("trader.opt.pos.closeBook") : undefined} />}
          {!readOnly && <PartialClose p={p} onClose={(n) => close(n)} />}
          <button onClick={() => (opt.showSeries(p.option.series) || opt.selectUnderlying(u), opt.focus(p.ticket), setTradeMode("options"))} title={t("trader.opt.pos.showOnChart")} aria-label={t("trader.opt.pos.showOnChart")} className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-line text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Crosshair className="size-3.5" />
          </button>
          <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="ms-auto flex h-8 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[11.5px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            {t("trader.opt.plain.details")}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </div>
        {open && (
          <div data-area="x" className="mx-3 mb-2.5 grid grid-cols-3 gap-x-3 gap-y-2 rounded-[9px] bg-surface-2/60 p-2.5 @[920px]:grid-cols-6">
            <Detail k={t("toolbox.col.ticket")} v={`#${p.ticket}`} />
            <Detail k={t("toolbox.col.openTime")} v={fmtServer(p.openTime, false)} />
            <Detail k={t("trader.opt.col.be")} v={px(be, digits)} />
            <Detail k={t("trader.opt.pos.d.openEach")} v={money(v.openUsd)} />
            <Detail k={t("trader.opt.pos.d.nowEach")} v={v.markUsd !== undefined ? money(v.markUsd) : "—"} title={t("trader.opt.col.markHint")} />
            <Detail k={t("trader.opt.preview.commission")} v={money(p.commission)} />
            <Detail k="Δ" v={greek(v.g.delta, 3)} title={t("trader.opt.col.deltaHint")} />
            <Detail k="Θ" v={usdSigned(v.g.theta)} title={t("trader.opt.col.thetaHint")} />
            <Detail k="Vega" v={usd(v.g.vega)} title={t("trader.opt.col.vegaHint")} />
            <Detail k="Γ" v={greek(v.g.gamma, 4)} title={t("trader.opt.col.gammaHint")} />
            {v.q && <Detail k={t("trader.opt.col.iv")} v={pct(v.q.iv, 1)} title={t("trader.opt.col.ivHint")} />}
            <Detail k={t("trader.opt.pos.d.where")} v={p.venue === "book" ? t("trader.opt.pos.d.book") : t("trader.opt.pos.d.house")} />
          </div>
        )}
      </div>
    </div>
  );
});

function LegLine({ p, report, readOnly, locale }: { p: OptPosition; report?: Report; readOnly: boolean; locale: string }) {
  const t = useT();
  const T = useTerminal();
  const v = useOptionPositionLive(p);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => report?.(p.ticket, v));
  const u = p.option.underlying;
  return (
    <div className="rounded-[8px] px-1 py-1.5 text-[11.5px] hover:bg-surface-2/70">
      <div className="flex min-w-0 items-center gap-1.5">
        <SideChip side={p.side} n={p.contracts} />
        <RightChip right={p.option.right} />
        <span className="font-mono font-semibold text-fg">{strikeOf(p.option, digitsOf(u))}</span>
        <span className="ms-auto shrink-0 text-[12px] font-semibold">
          <Pnl value={v.profit} text={moneySigned(v.profit)} format={(x) => moneySigned(x)} />
        </span>
        {!readOnly && (
          <span className="flex shrink-0 items-center gap-0.5">
            <PartialClose p={p} onClose={(n) => (setBusy(true), void closeOptionPosition(T, t, p, n).finally(() => setBusy(false)))} className="size-7" />
            <button disabled={busy} onClick={() => (setBusy(true), void closeOptionPosition(T, t, p).finally(() => setBusy(false)))} className="h-7 rounded-[7px] border border-line px-2 text-[11px] text-fg-2 hover:border-down/50 hover:text-down disabled:opacity-50">
              {t("trader.opt.pos.close")}
            </button>
          </span>
        )}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1 ps-0.5 text-[10.5px] text-fg-3">
        <span className="k-num font-mono">
          {money(v.openUsd)} → {v.markUsd !== undefined ? money(v.markUsd) : "—"}
        </span>
        <span className="truncate">· {expiryLabel(p.option.expiry, locale, false)}</span>
      </div>
    </div>
  );
}

function StrategyCard({ id, legs, readOnly, report, totals, locale }: { id: string; legs: OptPosition[]; readOnly: boolean; report?: Report; totals: ReturnType<typeof sum>; locale: string }) {
  const t = useT();
  const T = useTerminal();
  const now = useNow();
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!confirm) return;
    const tm = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(tm);
  }, [confirm]);
  const tpl = detectTemplate(legs.map((l) => ({ right: l.option.right, side: l.side, strike: l.option.strike, contracts: l.contracts })));
  const name = tpl ? t.dyn(`trader.opt.tpl.${tpl}.name`, tpl) : t("trader.opt.pos.strategy");
  const u = legs[0]!.option.underlying;
  const spot = useSpot(u);
  const usdU = usdUnitOfPosition(legs[0]!, quoteOf(legs[0]!.option.series));
  const cash = spot !== undefined ? expiryCash(legs.map((l) => ({ right: l.option.right, strike: l.option.strike, side: l.side, contracts: l.contracts })), spot, usdU) : null;
  const cut = cutOf(legs[0]!);
  const net = legs.reduce((s, l) => s + (l.side === "buy" ? 1 : -1) * l.openPrice * usdU * l.contracts, 0);
  return (
    <div className="flex min-w-0 flex-col rounded-[12px] border border-line bg-panel-2/70 shadow-[var(--k-shadow-card)]">
      <div className="flex items-start gap-2.5 px-3 pt-2.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ember-soft text-ember">
          <Layers className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-fg">{name}</span>
            <span className="flex items-center gap-1 text-[12px] text-fg-2">
              <OptAvatar symbol={u} size={13} /> {u}
            </span>
            <span className="rounded-[5px] bg-surface-3 px-1.5 text-[10.5px] text-fg-3">{t("trader.opt.ticket.strategy", { count: legs.length })}</span>
          </div>
          <div className="mt-1">
            <ExpiryLine cut={cut} locale={locale} now={now} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[16px] font-semibold leading-none">
            <Pnl value={totals.profit} text={moneySigned(totals.profit)} format={(x) => moneySigned(x)} />
          </span>
          <ResultChip v={totals.profit} />
        </div>
      </div>
      <div className="mt-2 px-3 text-[11.5px] leading-snug text-fg-3" dir="auto">
        {net >= 0 ? t("trader.opt.pos.comboPaid", iso({ amount: money(net) })) : t("trader.opt.pos.comboReceived", iso({ amount: money(-net) }))}{" "}
        {cash !== null && <span className={cn(cash > 0.004 ? "text-up" : cash < -0.004 ? "text-down" : "text-fg-2")}>{cash > 0.004 ? t("trader.opt.pos.exp.nowGet", iso({ amount: money(cash) })) : cash < -0.004 ? t("trader.opt.pos.exp.nowPay", iso({ amount: money(-cash) })) : t("trader.opt.pos.exp.comboZero")}</span>}
      </div>
      <div className="@container mx-2 mt-1.5 border-t border-line/60 pt-1">
        <div className="grid grid-cols-1 gap-x-4 @[900px]:grid-cols-2">
          {legs.map((p) => (
            <LegLine key={p.ticket} p={p} report={report} readOnly={readOnly} locale={locale} />
          ))}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1.5 px-3 pb-2.5 pt-2">
        {!readOnly && (
          <button disabled={busy} onClick={() => (confirm ? (setConfirm(false), setBusy(true), void closeCombo(T, t, id, legs).finally(() => setBusy(false))) : setConfirm(true))} className={cn("h-8 rounded-[8px] border px-3 text-[12px] font-medium transition-colors disabled:opacity-50", confirm ? "border-down bg-down text-white" : "border-line bg-surface-2 text-fg hover:border-down/50 hover:text-down")}>
            {confirm ? t("trader.opt.pos.confirmClose") : t("trader.opt.pos.closeStrategy")}
          </button>
        )}
        <span className="ms-auto font-mono text-[10.5px] text-fg-3">
          Δ {greek(totals.delta, 2)} · Θ {usdSigned(totals.theta)}
        </span>
      </div>
    </div>
  );
}

function OrderRow({ o, readOnly, onCancel, locale }: { o: OptOrder; readOnly: boolean; onCancel: () => void; locale: string }) {
  const t = useT();
  const q = useSeriesQuote(o.option.series);
  const usdU = usdUnitOfPosition(o, q);
  const u = o.option.underlying;
  const strike = strikeOf(o.option, digitsOf(u));
  const what = t("trader.opt.ticket.what", { side: o.side === "buy" ? t("common.buy") : t("common.sell"), n: o.contracts, series: `${u} ${strike} ${o.option.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}`, date: expiryLabel(o.option.expiry, locale, false) });
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-line bg-panel-2/40 px-3 py-2">
      <OptAvatar symbol={u} size={16} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-medium text-fg">{what}</div>
        <div className="truncate text-[11px] text-fg-3">
          {o.trigger ? t("trader.opt.pos.triggerOrder", { u: o.trigger.symbol, op: o.trigger.op === "below" ? t("trader.opt.ticket.below") : t("trader.opt.ticket.above"), price: o.trigger.price }) : t("trader.opt.pos.limitOrder", { price: o.price !== undefined ? usd(o.price * usdU) : "—" })} · {t("trader.opt.pos.placed", { at: fmtServer(o.placedAt, false) })}
        </div>
      </div>
      {!readOnly && (
        <button onClick={onCancel} className="h-7 shrink-0 rounded-[7px] border border-line px-2.5 text-[11.5px] text-fg-2 hover:border-down/50 hover:text-down">
          {t("trader.opt.pos.cancel")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

/** The cards, strategies first, then working orders (shared by the toolbox tab and the phone). */
export function OptionPositionsList({ onOpenChain, report, className, mobile }: { onOpenChain?: () => void; report?: Report; className?: string; mobile?: boolean }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const login = T.guest ? null : T.account.login;
  const book = useOptionBook(login);
  const vals = React.useRef(new Map<string, PosLive>());
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(bump, 700);
    return () => clearInterval(id);
  }, []);
  const rep = React.useCallback<Report>(
    (ticket, v) => {
      vals.current.set(ticket, v);
      report?.(ticket, v);
    },
    [report],
  );
  const cancel = async (o: OptOrder) => {
    const r = await optionsApi.cancelOrder(T.account.login, o.ticket);
    if (!r.ok) return void toast.error(t("trader.opt.toast.cancelRejected"), { description: errText(r.err) });
    toast(t("trader.opt.toast.cancelled"), { description: `#${o.ticket} ${o.option.series}` });
  };
  const singles = book.positions.filter((p) => !p.comboId);
  const combos = new Map<string, OptPosition[]>();
  for (const p of book.positions) if (p.comboId) (combos.get(p.comboId) ?? combos.set(p.comboId, []).get(p.comboId)!).push(p);
  const present = (ps: OptPosition[]) => ps.map((p) => vals.current.get(p.ticket)).filter((x): x is PosLive => !!x);
  const ro = T.readOnly;

  if (!book.positions.length && !book.orders.length)
    return (
      <div className={cn("grid h-full place-items-center p-6 text-center", className)}>
        <div className="max-w-[340px]">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
            <Layers className="size-5" />
          </div>
          <div className="text-[13.5px] font-semibold text-fg">{book.loaded || !T.engine ? t("trader.opt.pos.emptyTitle") : t("trader.opt.pos.loading")}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{t("trader.opt.pos.emptyText")}</p>
          <button onClick={() => (onOpenChain ? onOpenChain() : (setTradeMode("options"), opt.setPrefs({ panel: "simple" })))} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-ember px-4 text-[12.5px] font-semibold text-white hover:brightness-110">
            {t("trader.opt.guide.start")}
          </button>
        </div>
      </div>
    );

  return (
    <div className={cn("@container space-y-2", className)}>
      <div className={cn("grid gap-2", mobile ? "grid-cols-1" : "grid-cols-1 @[760px]:grid-cols-2 @[1180px]:grid-cols-1")}>
        {[...combos.entries()].map(([id, legs]) => (
          <StrategyCard key={id} id={id} legs={legs} readOnly={ro} report={rep} totals={sum(present(legs))} locale={locale} />
        ))}
        {singles.map((p) => (
          <PositionCard key={p.ticket} p={p} readOnly={ro} report={rep} locale={locale} />
        ))}
      </div>
      {book.orders.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.pos.workingOrders", { count: book.orders.length })}</div>
          {book.orders.map((o) => (
            <OrderRow key={o.ticket} o={o} readOnly={ro} onCancel={() => void cancel(o)} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Portfolio Greeks of the open options (a popover: pro figures stay out of the way). */
function GreeksButton({ totals }: { totals: ReturnType<typeof sum> }) {
  const t = useT();
  return (
    <DropMenu
      width={250}
      align="end"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} className={cn("flex h-6 items-center gap-1 rounded-[6px] border border-line px-2 text-[11px] text-fg-2 hover:text-fg", open && "bg-surface-3")}>
          <Sigma className="size-3.5" /> {t("trader.opt.greeks")}
        </button>
      )}
    >
      {() => (
        <div className="p-3">
          <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-fg">
            {t("trader.opt.pos.greeksTitle")} <Explain topic="greeks" size={11} />
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
            {(
              [
                ["Δ", greek(totals.delta, 3), "trader.opt.col.deltaHint"],
                ["Γ", greek(totals.gamma, 4), "trader.opt.col.gammaHint"],
                ["Θ", usdSigned(totals.theta), "trader.opt.col.thetaHint"],
                ["Vega", usd(totals.vega), "trader.opt.col.vegaHint"],
              ] as const
            ).map(([k, v, h]) => (
              <div key={k} title={t(h)} className="rounded-[7px] bg-surface-2 px-1 py-1.5">
                <div className="font-sans text-[9.5px] uppercase text-fg-3">{k}</div>
                <div className="text-[11px] text-fg">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DropMenu>
  );
}

export function OptionsPositionsTab() {
  const T = useTerminal();
  const t = useT();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  const login = T.guest ? null : T.account.login;
  const book = useOptionBook(login);
  const m = useMetrics();
  const a = m.account;
  // card numbers reported up for the summary (re-rendered on a light timer, not per tick)
  const vals = React.useRef(new Map<string, PosLive>());
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const report = React.useCallback<Report>((ticket, v) => void vals.current.set(ticket, v), []);
  React.useEffect(() => {
    const id = setInterval(bump, 600);
    return () => clearInterval(id);
  }, []);
  const total = sum(book.positions.map((p) => vals.current.get(p.ticket)).filter((x): x is PosLive => !!x));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {book.positions.length > 0 && (
        <div className="flex h-9 shrink-0 items-center gap-4 border-b border-line px-3 text-[11.5px]">
          <span className="flex items-baseline gap-1.5">
            <span className="text-fg-3">{t("trader.opt.pos.openPnl")}</span>
            <span className="text-[13px] font-semibold">
              <Pnl value={total.profit} text={moneySigned(total.profit)} format={(x) => moneySigned(x)} arrow />
            </span>
          </span>
          <span className="text-fg-3">{t("trader.opt.pos.count", { count: book.positions.length })}</span>
          <span className="ms-auto">
            <GreeksButton totals={total} />
          </span>
        </div>
      )}
      <div className="t-scroll min-h-0 flex-1 overflow-auto p-2">
        <OptionPositionsList report={report} />
      </div>
      <div className="flex h-8 shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-panel-2 px-3 font-mono text-[11.5px] text-fg-2">
        <span className="k-num whitespace-nowrap">
          <span className="font-sans text-fg-3">{t("toolbox.summary.equity")}:</span> <LiveMoney value={m.equity} format={(x) => accMoney(a, x)} className="px-0.5 text-fg" />
        </span>
        <span className="k-num whitespace-nowrap">
          <span className="font-sans text-fg-3">{t("toolbox.summary.margin")}:</span> <span className="text-fg">{accMoney(a, m.margin)}</span>
        </span>
        <span className="k-num whitespace-nowrap">
          <span className="font-sans text-fg-3">{t("toolbox.summary.freeMargin")}:</span> <span className={m.free < 0 ? "text-down" : "text-fg"}>{accMoney(a, m.free)}</span> <span className="font-sans text-[10.5px] text-fg-3">{accCcy(a)}</span>
        </span>
        <span className="hidden truncate font-sans text-[10.5px] text-fg-3 md:inline">{t("trader.opt.pos.sharedAccount")}</span>
      </div>
    </div>
  );
}

/** Kept for the phone layout: one card per position. */
export { PositionCard };

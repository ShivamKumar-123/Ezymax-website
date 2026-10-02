"use client";

// Strategies on the order book trade by request for quote (docs/OPTIONS-EXCHANGE.md §5): the legs (sides and whole
// ratios) and a size go out as one RFQ (`POST …/rfq`, open 30 s); the Kalks market maker answers with a firm net
// bid / ask per strategy unit (valid a few seconds, refreshed after that); accepting (`POST …/rfq/{id}/accept`
// {quoteId, side, limitNet}) fills every leg at once in one journal entry, or nothing. "Buy" trades the strategy as
// built at the ask, "Sell" the reverse at the bid. Barrier legs are Kalks-quoted, never on the order book.
import * as React from "react";
import { Hourglass, MessagesSquare, RefreshCw, X } from "lucide-react";
import { parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { bookApi, bookMissing } from "@/lib/options/book-api";
import { errText, needsOnboarding } from "@/lib/options/errors";
import { opt } from "@/lib/options-store";
import type { Rfq, RfqAcceptResult, RfqQuote, Side } from "@/lib/options/types";
import { ErrorNote, RightTag } from "./bits";
import { isBarrierSeries, KalksQuotedTag, qty, useSeriesUnits } from "./book-bits";
import { usd } from "./format";
import { MmRulesLink } from "./mm-rules";

export interface RfqLegSpec {
  series: string;
  side: Side;
  contracts: number;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** Legs → whole ratios and a strategy size (2 × 1 + 2 × 1 = size 2 of a 1:1 strategy). */
export function toRatios(legs: RfqLegSpec[]): { qty: number; legs: { series: string; side: Side; ratio: number }[] } {
  const whole = legs.map((l) => Math.max(1, Math.round(l.contracts)));
  const g = whole.reduce((a, b) => gcd(a, b), whole[0] ?? 1) || 1;
  return { qty: g, legs: legs.map((l, i) => ({ series: l.series, side: l.side, ratio: whole[i]! / g })) };
}

function useNowTick(active: boolean, ms = 250) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

type Phase = "idle" | "requesting" | "live" | "accepting" | "expired" | "done";

export function RfqPanel({ legs, onDone, className, disabled }: { legs: RfqLegSpec[]; onDone?: (r: RfqAcceptResult) => void; className?: string; disabled?: boolean }) {
  const T = useTerminal();
  const t = useT();
  const login = T.account.login;
  const units = useSeriesUnits(legs[0]?.series);
  const spec = React.useMemo(() => toRatios(legs), [legs]);
  const key = JSON.stringify(spec);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [rfq, setRfq] = React.useState<Rfq | null>(null);
  const [quote, setQuote] = React.useState<RfqQuote | null>(null);
  const [err, setErr] = React.useState<{ code: string; message: string } | null>(null);
  const live = phase === "live" || phase === "accepting";
  const now = useNowTick(live || phase === "requesting");
  const rfqRef = React.useRef<Rfq | null>(null);
  rfqRef.current = rfq;

  // new legs or size: the open request no longer matches
  React.useEffect(() => {
    const open = rfqRef.current;
    if (open) void bookApi.rfqCancel(login, open.id);
    setRfq(null);
    setQuote(null);
    setPhase("idle");
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // leaving: withdraw the request
  React.useEffect(
    () => () => {
      const open = rfqRef.current;
      if (open) void bookApi.rfqCancel(login, open.id);
    },
    [login],
  );

  // the request is open: follow its quotes (they refresh after their validity)
  React.useEffect(() => {
    if (!rfq || phase !== "live") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const r = await bookApi.rfqGet(login, rfq.id);
      if (!alive) return;
      if (r.ok) {
        const best = [...r.data.quotes].sort((a, b) => Date.parse(b.validUntil) - Date.parse(a.validUntil))[0] ?? null;
        setQuote(best);
        const st = r.data.rfq?.status;
        if (st === "expired" || st === "cancelled" || Date.parse(r.data.rfq?.expiresAt ?? rfq.expiresAt) <= Date.now()) {
          setPhase("expired");
          setRfq(null);
          return;
        }
      }
      timer = setTimeout(() => void poll(), 700);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rfq, phase, login]);

  const request = async () => {
    setErr(null);
    setPhase("requesting");
    setQuote(null);
    const r = await bookApi.rfq(login, { legs: spec.legs, qty: spec.qty });
    if (!r.ok || !r.data.id) {
      setPhase("idle");
      if (!r.ok && bookMissing(r.err)) {
        opt.setBookOff(true);
        return;
      }
      if (!r.ok) setErr({ code: r.err.code, message: r.err.message });
      return;
    }
    setRfq(r.data);
    setPhase("live");
    T.log("Trade", `'${login}': RFQ ${r.data.id} ${spec.legs.map((l) => `${l.side} ${l.ratio}×${l.series}`).join(", ")} × ${spec.qty}`);
  };

  const cancel = async () => {
    if (rfq) await bookApi.rfqCancel(login, rfq.id);
    setRfq(null);
    setQuote(null);
    setPhase("idle");
  };

  const accept = async (side: Side) => {
    if (!rfq || !quote) return;
    const net = side === "buy" ? quote.ask : quote.bid;
    if (net === null) return;
    setPhase("accepting");
    setErr(null);
    const r = await bookApi.rfqAccept(login, rfq.id, { quoteId: quote.quoteId, side, limitNet: net });
    if (!r.ok) {
      setPhase("live");
      setErr({ code: r.err.code, message: r.err.message });
      if (!needsOnboarding(r.err.code)) toast.error(t("trader.opt.toast.rejected"), { description: errText(r.err) });
      return;
    }
    setPhase("done");
    setRfq(null);
    T.log("Trade", `'${login}': RFQ ${rfq.id} accepted ${side} @ ${net} (${r.data.status}${r.data.comboId ? `, combo ${r.data.comboId}` : ""})`);
    toast.success(t("trader.opt.rfq.toast.filled"), { description: t("trader.opt.rfq.toast.desc", { count: r.data.fills.length || spec.legs.length, price: usd(Math.abs(net) * units.k * spec.qty) }) });
    onDone?.(r.data);
  };

  const validMs = quote ? Date.parse(quote.validUntil) - now : 0;
  const ttl = 5_000;
  const rfqLeft = rfq ? Math.max(0, Math.ceil((Date.parse(rfq.expiresAt) - now) / 1000)) : 0;
  const side = (s: Side) => {
    const net = quote ? (s === "buy" ? quote.ask : quote.bid) : null;
    const total = net !== null ? net * units.k * spec.qty : null;
    // buying the strategy pays a positive net; selling it receives a positive net
    const pays = net !== null && (s === "buy" ? net > 0 : net < 0);
    return (
      <button
        key={s}
        onClick={() => void accept(s)}
        disabled={!quote || net === null || validMs <= 0 || phase === "accepting" || disabled}
        className={cn("rounded-[12px] border px-3 py-2.5 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50", s === "buy" ? "border-up bg-up text-end" : "border-down bg-down text-start")}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-90">{s === "buy" ? t("trader.opt.rfq.buy") : t("trader.opt.rfq.sell")}</div>
        <div className="k-num font-mono text-[16px] font-semibold leading-tight">{net !== null ? usd(net * units.k) : "—"}</div>
        <div className="font-mono text-[9.5px] opacity-85">{total !== null ? t(pays ? "trader.opt.rfq.youPay" : "trader.opt.rfq.youGet", { amount: usd(Math.abs(total)) }) : " "}</div>
      </button>
    );
  };

  return (
    <div className={cn("space-y-2.5 rounded-[12px] border border-line bg-surface-2/40 p-3", className)}>
      <div className="flex items-center gap-1.5">
        <MessagesSquare className="size-3.5 text-ember" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-fg-2">{t("trader.opt.rfq.title")}</span>
        <span className="ms-auto">
          <MmRulesLink />
        </span>
      </div>
      <ul className="space-y-0.5">
        {spec.legs.map((l) => {
          // a barrier series carries a suffix after C / P: the first four parts name the option
          const p = parseSeriesCode(l.series.split("-").slice(0, 4).join("-"));
          return (
            <li key={l.series} className="flex items-center gap-1.5 text-[11px]">
              <span className={cn("w-7 shrink-0 rounded-[3px] text-center text-[9.5px] font-bold uppercase", l.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{l.side === "buy" ? t("trader.opt.b") : t("trader.opt.s")}</span>
              <span className="font-mono text-fg-3">{l.ratio}×</span>
              {p && <RightTag right={p.right} className="h-[15px] min-w-[15px] text-[9px]" />}
              <span className="truncate font-mono text-fg-2">{p ? `${p.underlying} ${p.strikeLabel}` : l.series}</span>
              {isBarrierSeries(l.series) && <KalksQuotedTag />}
            </li>
          );
        })}
      </ul>
      <div className="text-[10.5px] text-fg-3">{t("trader.opt.rfq.size", { n: qty(spec.qty) })}</div>

      {phase === "idle" || phase === "expired" || phase === "done" ? (
        <>
          {phase === "expired" && <div className="flex items-center gap-1.5 text-[11px] text-warn"><Hourglass className="size-3.5" /> {t("trader.opt.rfq.expired")}</div>}
          <button onClick={() => void request()} disabled={disabled || !legs.length} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] bg-ember text-[12.5px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110 disabled:bg-surface-3 disabled:text-fg-3 disabled:shadow-none">
            {phase === "idle" ? <MessagesSquare className="size-3.5" /> : <RefreshCw className="size-3.5" />}
            {phase === "idle" ? t("trader.opt.rfq.request") : t("trader.opt.rfq.again")}
          </button>
          <p className="text-[10.5px] leading-snug text-fg-3">{t("trader.opt.rfq.note")}</p>
        </>
      ) : phase === "requesting" || (phase === "live" && !quote) ? (
        <div className="flex h-[74px] items-center justify-center gap-2 rounded-[12px] border border-dashed border-line text-[11.5px] text-fg-3">
          <RefreshCw className="size-3.5 animate-spin" /> {t("trader.opt.rfq.waiting")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {side("sell")}
            {side("buy")}
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-fg-3">
            <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-200", validMs > 1500 ? "bg-up" : "bg-warn")} style={{ width: `${Math.max(0, Math.min(100, (validMs / ttl) * 100))}%` }} />
            </span>
            <span className="k-num shrink-0 font-mono">{validMs > 0 ? t("trader.opt.rfq.validFor", { s: (validMs / 1000).toFixed(1) }) : t("trader.opt.rfq.refreshing")}</span>
          </div>
          <div className="flex items-center justify-between text-[10.5px] text-fg-3">
            <span>
              {t("trader.opt.rfq.from", { who: quote?.responder === "kalks" || quote?.responder?.startsWith("kalks") ? t("trader.opt.rfq.kalksMm") : (quote?.responder ?? "—") })} · {t("trader.opt.rfq.openFor", { s: rfqLeft })}
            </span>
            <button onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-[4px] px-1 hover:bg-surface-3 hover:text-fg">
              <X className="size-3" /> {t("common.cancel")}
            </button>
          </div>
        </>
      )}
      {err && <ErrorNote code={err.code} message={err.message} />}
    </div>
  );
}

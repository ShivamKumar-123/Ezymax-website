"use client";

// Delta-style option chain for one expiry: calls and puts side by side around the strike (or one list), bid / ask /
// mark in USD per contract with pips under the mark, IV, Greeks (Δ always; Γ Θ Vega with the toggle), probability
// ITM and breakeven, OI and volume once the book reports them. ATM is marked and the spot sits between its strikes;
// in-the-money halves are tinted. Rows update in place from the stream (changed rows only) and their prices flash.
// Click a price: bid sells, ask (or mark) buys; Shift+click adds a leg to the ticket instead of replacing it.
import * as React from "react";
import { Layers } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { Check } from "@/components/ui/primitives";
import { atmIndex } from "@/lib/options/math";
import { getOpt, opt, useOpt, visibleRows } from "@/lib/options-store";
import type { OptionChainRow, OptionQuote, OptionRight, Side } from "@/lib/options/types";
import { Flash, RightTag } from "./bits";
import { greek, pct, pips, px, usd } from "./format";

type Col = "bid" | "ask" | "mark" | "iv" | "delta" | "gamma" | "theta" | "vega" | "prob" | "be" | "oi" | "vol";

const RANGES = [6, 10, 20, 0] as const;

/** Columns per side. Calls and puts side by side keep ITM % / breakeven optional (width); one list always shows them. */
function columns(both: boolean, greeks: boolean, extra: boolean, book: boolean): Col[] {
  return [
    "bid",
    "ask",
    "mark",
    "iv",
    "delta",
    ...(greeks ? (["gamma", "theta", "vega"] as Col[]) : []),
    ...(extra || !both ? (["prob", "be"] as Col[]) : []),
    ...(book ? (["oi", "vol"] as Col[]) : []),
  ];
}

const COL_W: Record<Col, string> = { bid: "w-[64px]", ask: "w-[64px]", mark: "w-[66px]", iv: "w-[52px]", delta: "w-[54px]", gamma: "w-[58px]", theta: "w-[56px]", vega: "w-[50px]", prob: "w-[48px]", be: "w-[72px]", oi: "w-[52px]", vol: "w-[52px]" };

function useHeads(): Record<Col, { label: string; title: string }> {
  const t = useT();
  return React.useMemo(
    () => ({
      bid: { label: t("trader.opt.col.bid"), title: t("trader.opt.col.bidHint") },
      ask: { label: t("trader.opt.col.ask"), title: t("trader.opt.col.askHint") },
      mark: { label: t("trader.opt.col.mark"), title: t("trader.opt.col.markHint") },
      iv: { label: t("trader.opt.col.iv"), title: t("trader.opt.col.ivHint") },
      delta: { label: "Δ", title: t("trader.opt.col.deltaHint") },
      gamma: { label: "Γ", title: t("trader.opt.col.gammaHint") },
      theta: { label: "Θ", title: t("trader.opt.col.thetaHint") },
      vega: { label: "Vega", title: t("trader.opt.col.vegaHint") },
      prob: { label: t("trader.opt.col.prob"), title: t("trader.opt.col.probHint") },
      be: { label: t("trader.opt.col.be"), title: t("trader.opt.col.beHint") },
      oi: { label: t("trader.opt.col.oi"), title: t("trader.opt.col.oiHint") },
      vol: { label: t("trader.opt.col.vol"), title: t("trader.opt.col.volHint") },
    }),
    [t],
  );
}

/** Click on a price: replace the ticket with this leg, or add it (Shift, or a strategy already being built). */
function pick(row: OptionChainRow, right: OptionRight, side: Side, e: React.MouseEvent) {
  opt.addLeg(row, right, side, { replace: !e.shiftKey && getOpt().ticket.legs.length <= 1 });
}

function Cell({ q, col, right, row, digits, picked, readOnly, itm }: { q: OptionQuote | null; col: Col; right: OptionRight; row: OptionChainRow; digits: number; picked: boolean; readOnly: boolean; itm: boolean }) {
  const t = useT();
  const base = cn("h-[30px] whitespace-nowrap border-b border-line/50 px-1.5 text-end font-mono text-[11.5px]", COL_W[col], itm && "bg-gold-soft/25");
  if (!q) return <td className={cn(base, "text-fg-3")}>—</td>;
  const tradable = q.state === "open" && !readOnly;
  switch (col) {
    case "bid":
    case "ask": {
      const side: Side = col === "bid" ? "sell" : "buy";
      const v = col === "bid" ? q.bidUsd : q.askUsd;
      return (
        <td className={cn(base, "p-0")}>
          <button
            onClick={(e) => tradable && pick(row, right, side, e)}
            disabled={!tradable}
            title={tradable ? t(col === "bid" ? "trader.opt.clickSell" : "trader.opt.clickBuy") : undefined}
            className={cn(
              "h-full w-full px-1.5 text-end transition-colors disabled:cursor-default",
              col === "bid" ? "text-down hover:bg-down-soft" : "text-up hover:bg-up-soft",
              picked && "bg-ember-soft/70 shadow-[inset_0_0_0_1px_var(--k-ember)]",
              !tradable && "hover:bg-transparent",
              q.state !== "open" && "opacity-60",
            )}
          >
            <Flash value={v}>{v > 0 ? usd(v) : "—"}</Flash>
          </button>
        </td>
      );
    }
    case "mark":
      return (
        <td className={cn(base, "p-0")}>
          <button onClick={(e) => tradable && pick(row, right, "buy", e)} disabled={!tradable} title={`${pips(q.markPips)} ${t("trader.opt.pips")}`} className="flex h-full w-full flex-col items-end justify-center px-1.5 leading-none text-fg hover:bg-surface-3/60 disabled:cursor-default disabled:hover:bg-transparent">
            <Flash value={q.markUsd}>{usd(q.markUsd)}</Flash>
            <span className="mt-0.5 text-[9px] text-fg-3">{pips(q.markPips)}p</span>
          </button>
        </td>
      );
    case "iv":
      return <td className={cn(base, "text-fg-2")}>{pct(q.iv, 1)}</td>;
    case "delta":
      return <td className={cn(base, "text-fg-2")}>{greek(q.delta, 3)}</td>;
    case "gamma":
      return <td className={cn(base, "text-fg-3")}>{greek(q.gamma, 4)}</td>;
    case "theta":
      return <td className={cn(base, q.theta < 0 ? "text-down/80" : "text-fg-3")}>{usd(q.theta)}</td>;
    case "vega":
      return <td className={cn(base, "text-fg-3")}>{usd(q.vega)}</td>;
    case "prob":
      return <td className={cn(base, "text-fg-2")}>{pct(q.probItm, 0)}</td>;
    case "be":
      return <td className={cn(base, "text-fg-3")}>{px(q.breakeven, digits)}</td>;
    case "oi":
      return <td className={cn(base, "text-fg-3")}>{q.oi === null || q.oi === undefined ? "—" : q.oi.toLocaleString("en-US")}</td>;
    case "vol":
      return <td className={cn(base, "text-fg-3")}>{q.volume === null || q.volume === undefined ? "—" : q.volume.toLocaleString("en-US")}</td>;
  }
}

interface RowProps {
  row: OptionChainRow;
  cols: Col[];
  view: "both" | "calls" | "puts";
  digits: number;
  itmCall: boolean;
  itmPut: boolean;
  atm: boolean;
  /** series codes in the ticket, joined (a cheap memo key) */
  picked: string;
  readOnly: boolean;
}

const ChainRow = React.memo(function ChainRow({ row, cols, view, digits, itmCall, itmPut, atm, picked, readOnly }: RowProps) {
  const set = new Set(picked ? picked.split(",") : []);
  const side = (right: OptionRight, list: Col[]) => {
    const q = right === "call" ? row.call : row.put;
    const itm = right === "call" ? itmCall : itmPut;
    return list.map((c) => <Cell key={`${right}-${c}`} q={q} col={c} right={right} row={row} digits={digits} picked={!!q && set.has(q.code)} readOnly={readOnly} itm={itm} />);
  };
  const strike = (
    <td className={cn("h-[30px] w-[86px] whitespace-nowrap border-x border-b border-line/60 bg-panel-2 px-2 text-center font-mono text-[12px] font-semibold", view !== "both" && "sticky left-0 z-[1]", atm ? "text-ember" : "text-fg")}>
      <span className="inline-flex items-center gap-1">
        {atm && <span className="size-1.5 rounded-full bg-ember" title="ATM" />}
        {row.strikeLabel}
      </span>
    </td>
  );
  return (
    <tr data-atm={atm || undefined}>
      {view === "both" ? (
        <>
          {side("call", [...cols].reverse())}
          {strike}
          {side("put", cols)}
        </>
      ) : (
        <>
          {strike}
          {side(view === "calls" ? "call" : "put", cols)}
        </>
      )}
    </tr>
  );
});

function SpotRow({ span, label, both }: { span: number; label: string; both: boolean }) {
  return (
    <tr aria-hidden>
      <td colSpan={span} className="h-[15px] border-b border-line/50 p-0">
        <div className="pointer-events-none relative flex h-[15px] items-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-ember/60" />
          <span className={cn("relative z-[1] rounded-[3px] border border-ember/40 bg-panel px-1.5 font-mono text-[9.5px] font-semibold leading-[13px] text-ember", both ? "mx-auto" : "ms-2")}>{label}</span>
        </div>
      </td>
    </tr>
  );
}

export function OptionChainTable({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const chain = useOpt((s) => s.chain);
  const loading = useOpt((s) => s.chainLoading);
  const prefs = useOpt((s) => s.prefs);
  const legs = useOpt((s) => s.ticket.legs);
  const readOnly = useOpt((s) => !!s.ctx?.readOnly || s.publicView);
  const heads = useHeads();
  const scroller = React.useRef<HTMLDivElement>(null);
  const centred = React.useRef<string | null>(null);

  const key = chain ? `${chain.underlying}|${chain.expiry}` : null;
  const atmI = chain ? atmIndex(chain) : 0;
  const rows = chain ? visibleRows(chain, prefs.range, atmI) : [];
  const atmStrike = chain?.rows[atmI]?.strike;
  const spot = chain?.spot?.mid;
  const book = !!chain?.rows.some((r) => [r.call?.oi, r.put?.oi].some((v) => v !== undefined && v !== null));
  const cols = compact ? (["bid", "ask", "iv", "delta"] as Col[]) : columns(prefs.view === "both", prefs.greeks, prefs.extra, book);
  const picked = legs.map((l) => l.series).join(",");
  const spotIdx = spot === undefined ? -1 : rows.findIndex((r) => r.strike > spot);

  // centre the ATM strike when a chain first shows
  React.useEffect(() => {
    if (!key || centred.current === key || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>("tr[data-atm]");
    if (!el) return;
    centred.current = key;
    const box = scroller.current;
    box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2 + el.clientHeight);
  });

  if (!chain) {
    return (
      <div className={cn("flex h-full flex-col gap-1 p-2", className)} aria-busy={loading}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-[26px] animate-pulse rounded-[4px] bg-surface-2/70" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    );
  }

  const both = prefs.view === "both" && !compact;
  const view = compact ? prefs.view === "puts" ? "puts" : "calls" : prefs.view;
  const span = both ? cols.length * 2 + 1 : cols.length + 1;
  const thBase = "sticky z-[2] whitespace-nowrap border-b border-line bg-panel-2";
  const head = (list: Col[]) =>
    list.map((c) => (
      <th key={c} title={heads[c].title} className={cn(thBase, "top-[22px] h-6 px-1.5 text-end text-[10px] font-medium uppercase tracking-[0.04em] text-fg-3", COL_W[c])}>
        {heads[c].label}
      </th>
    ));
  const strikeHead = <th className={cn(thBase, "top-[22px] z-[3] h-6 w-[86px] border-x px-2 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-2", !both && "left-0")}>{t("trader.opt.col.strike")}</th>;
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {chain.error && <div className="shrink-0 border-b border-warn/30 bg-warn-soft px-3 py-1 text-[11.5px] text-warn">{t("trader.opt.noPrice")}</div>}
      <div ref={scroller} className="t-scroll relative min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0">
          <thead>
            <tr>
              {both ? (
                <>
                  <th colSpan={cols.length} className={cn(thBase, "top-0 h-[22px] px-2 text-start text-[10px] font-semibold uppercase tracking-[0.1em] text-up")}>
                    <span className="inline-flex items-center gap-1.5">
                      <RightTag right="call" /> {t("trader.opt.calls")}
                    </span>
                  </th>
                  <th className={cn(thBase, "top-0 z-[3] h-[22px] font-mono text-[10px] font-normal text-fg-3")}>{chain.expiry.slice(5)}</th>
                  <th colSpan={cols.length} className={cn(thBase, "top-0 h-[22px] px-2 text-end text-[10px] font-semibold uppercase tracking-[0.1em] text-down")}>
                    <span className="inline-flex items-center gap-1.5">
                      {t("trader.opt.puts")} <RightTag right="put" />
                    </span>
                  </th>
                </>
              ) : (
                <th colSpan={span} className={cn(thBase, "top-0 h-[22px] px-2 text-start text-[10px] font-semibold uppercase tracking-[0.1em]", view === "calls" ? "text-up" : "text-down")}>
                  <span className="inline-flex items-center gap-1.5">
                    <RightTag right={view === "calls" ? "call" : "put"} /> {view === "calls" ? t("trader.opt.calls") : t("trader.opt.puts")}
                  </span>
                </th>
              )}
            </tr>
            <tr>
              {both ? (
                <>
                  {head([...cols].reverse())}
                  {strikeHead}
                  {head(cols)}
                </>
              ) : (
                <>
                  {strikeHead}
                  {head(cols)}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <React.Fragment key={r.strikeLabel}>
                {i === spotIdx && i > 0 && spot !== undefined && <SpotRow span={span} both={both} label={`${t("trader.opt.spot")} ${px(spot, chain.digits)}`} />}
                <ChainRow row={r} cols={cols} view={view} digits={chain.digits} itmCall={spot !== undefined && r.strike < spot} itmPut={spot !== undefined && r.strike > spot} atm={r.strike === atmStrike} picked={picked} readOnly={readOnly} />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (
        <div className="flex h-7 shrink-0 items-center gap-3 border-t border-line bg-panel-2 px-2.5 text-[10.5px] text-fg-3">
          <span className="flex items-center gap-1">
            {t("trader.opt.strikes")}
            {RANGES.map((n) => (
              <button key={n} onClick={() => opt.setPrefs({ range: n })} className={cn("k-num rounded-[4px] px-1.5 font-mono text-[10px]", prefs.range === n ? "bg-ember-soft text-ember" : "hover:bg-surface-3 hover:text-fg-2")}>
                {n === 0 ? t("trader.opt.all") : `±${n}`}
              </button>
            ))}
          </span>
          <Check checked={prefs.extra} onChange={(v) => opt.setPrefs({ extra: v })} label={<span className="text-[10.5px] text-fg-3">{t("trader.opt.showProbBe")}</span>} />
          <span className="ms-auto hidden items-center gap-1 lg:flex">
            <Layers className="size-3" />
            {t("trader.opt.shiftHint")}
          </span>
          <span className="hidden items-center gap-1 md:flex">
            <span className="inline-block size-2 rounded-[2px] bg-gold-soft" /> {t("trader.opt.itm")}
          </span>
        </div>
      )}
    </div>
  );
}

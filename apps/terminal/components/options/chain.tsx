"use client";

// Delta-style option chain for one expiry: calls and puts side by side around the strike (or one list), bid / ask /
// mark in USD per contract with pips under the mark, IV, Greeks (Δ always; Γ Θ Vega with the toggle), probability
// ITM and breakeven, OI and volume once the book reports them. ATM is marked and the spot sits between its strikes;
// in-the-money halves are tinted. Rows update in place from the stream (changed rows only) and their prices flash.
// While the broker's order book is live, bid / ask are the book's best bid / offer with their sizes under them ("—"
// for an empty side), plus the last trade (and its change), the mark with the theo (model value) under it, open
// interest and today's volume.
// Selecting, not trading: a click on a row's call half or put half selects that option (highlighted; the chart shows
// its premium, the ticket on the right trades it once the trader chooses Buy or Sell). Shift+click, "Add leg" in the
// ticket, or a strategy already in the ticket adds the option as a leg instead.
import * as React from "react";
import { Layers, MousePointerClick, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { Check } from "@/components/ui/primitives";
import { atmIndex } from "@/lib/options/math";
import { getOpt, opt, useBookLive, useOpt, visibleRows } from "@/lib/options-store";
import type { OptionChainRow, OptionQuote, OptionRight } from "@/lib/options/types";
import { Flash, RightTag } from "./bits";
import { greek, pct, pips, px, usd } from "./format";

type Col = "bid" | "ask" | "last" | "mark" | "iv" | "delta" | "gamma" | "theta" | "vega" | "prob" | "be" | "oi" | "vol";

const RANGES = [6, 10, 20, 0] as const;

/** Columns per side. Calls and puts side by side keep ITM % / breakeven optional (width); one list always shows them. */
function columns(both: boolean, greeks: boolean, extra: boolean, book: boolean, live = false): Col[] {
  return [
    "bid",
    "ask",
    ...(live ? (["last"] as Col[]) : []),
    "mark",
    "iv",
    "delta",
    ...(greeks ? (["gamma", "theta", "vega"] as Col[]) : []),
    ...(extra || !both ? (["prob", "be"] as Col[]) : []),
    ...(book ? (["oi", "vol"] as Col[]) : []),
  ];
}

const COL_W: Record<Col, string> = { bid: "w-[64px]", ask: "w-[64px]", last: "w-[60px]", mark: "w-[66px]", iv: "w-[52px]", delta: "w-[54px]", gamma: "w-[58px]", theta: "w-[56px]", vega: "w-[50px]", prob: "w-[48px]", be: "w-[72px]", oi: "w-[52px]", vol: "w-[52px]" };

function useHeads(book: boolean): Record<Col, { label: string; title: string }> {
  const t = useT();
  return React.useMemo(
    () => ({
      bid: { label: t("trader.opt.col.bid"), title: t("trader.opt.col.bidHint") },
      ask: { label: t("trader.opt.col.ask"), title: t("trader.opt.col.askHint") },
      last: { label: t("trader.opt.col.last"), title: t("trader.opt.col.lastHint") },
      mark: { label: t("trader.opt.col.mark"), title: book ? t("trader.opt.col.markBookHint") : t("trader.opt.col.markHint") },
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
    [t, book],
  );
}

/** Ticket legs and the selection on one row, as a cheap memo key: "c" / "p" selected, "cb" "cs" "pb" "ps" legs. */
interface Marks {
  sel: OptionRight | null;
  call: "buy" | "sell" | null;
  put: "buy" | "sell" | null;
}

function Cell({ q, col, right, digits, itm, mark, title, theoLabel }: { q: OptionQuote | null; col: Col; right: OptionRight; digits: number; itm: boolean; mark: { sel: boolean; leg: boolean }; title?: string; theoLabel: string }) {
  const base = cn("h-[30px] cursor-pointer whitespace-nowrap border-b border-line/50 px-1.5 text-end font-mono text-[11.5px]", COL_W[col], itm && "bg-gold-soft/25");
  const attrs = { "data-r": right === "call" ? "c" : "p", "data-sel": mark.sel || undefined, "data-leg": (!mark.sel && mark.leg) || undefined, title: q ? title : undefined };
  if (!q)
    return (
      <td {...attrs} className={cn(base, "cursor-default text-fg-3")}>
        —
      </td>
    );
  const dim = q.state !== "open" && "opacity-60";
  switch (col) {
    case "bid":
    case "ask": {
      const v = col === "bid" ? q.bidUsd : q.askUsd;
      const size = col === "bid" ? q.bidQty : q.askQty;
      return (
        <td {...attrs} className={cn(base, "p-0")}>
          <button type="button" tabIndex={col === "ask" ? 0 : -1} aria-label={title} className={cn("h-full w-full px-1.5 text-end outline-none focus-visible:ring-1 focus-visible:ring-ember", col === "bid" ? "text-down" : "text-up", dim, q.book && "flex flex-col items-end justify-center leading-none")}>
            <Flash value={v}>{v > 0 ? usd(v) : "—"}</Flash>
            {q.book && <span className="mt-0.5 text-[9px] text-fg-3">{v > 0 && size ? `×${size.toLocaleString("en-US")}` : " "}</span>}
          </button>
        </td>
      );
    }
    case "last":
      return (
        <td {...attrs} className={cn(base, "p-0")}>
          <span className={cn("flex h-full w-full flex-col items-end justify-center px-1.5 leading-none text-fg-2", dim)}>
            {q.lastUsd ? <Flash value={q.lastUsd}>{usd(q.lastUsd)}</Flash> : <span className="text-fg-3">—</span>}
            <span className={cn("mt-0.5 text-[9px]", q.change === null || q.change === undefined ? "text-fg-3" : q.change >= 0 ? "text-up" : "text-down")}>{q.lastUsd && q.change !== null && q.change !== undefined ? `${q.change >= 0 ? "+" : ""}${(q.change * 100).toFixed(1)}%` : " "}</span>
          </span>
        </td>
      );
    case "mark":
      return (
        <td {...attrs} className={cn(base, "p-0")}>
          <span className={cn("flex h-full w-full flex-col items-end justify-center px-1.5 leading-none text-fg", dim)}>
            <Flash value={q.markUsd}>{usd(q.markUsd)}</Flash>
            {q.book && q.theoUsd !== null && q.theoUsd !== undefined ? <span className="mt-0.5 text-[9px] text-fg-3">{`${theoLabel} ${usd(q.theoUsd)}`}</span> : <span className="mt-0.5 text-[9px] text-fg-3">{pips(q.markPips)}p</span>}
          </span>
        </td>
      );
    case "iv":
      return <td {...attrs} className={cn(base, "text-fg-2")}>{pct(q.iv, 1)}</td>;
    case "delta":
      return <td {...attrs} className={cn(base, "text-fg-2")}>{greek(q.delta, 3)}</td>;
    case "gamma":
      return <td {...attrs} className={cn(base, "text-fg-3")}>{greek(q.gamma, 4)}</td>;
    case "theta":
      return <td {...attrs} className={cn(base, q.theta < 0 ? "text-down/80" : "text-fg-3")}>{usd(q.theta)}</td>;
    case "vega":
      return <td {...attrs} className={cn(base, "text-fg-3")}>{usd(q.vega)}</td>;
    case "prob":
      return <td {...attrs} className={cn(base, "text-fg-2")}>{pct(q.probItm, 0)}</td>;
    case "be":
      return <td {...attrs} className={cn(base, "text-fg-3")}>{px(q.breakeven, digits)}</td>;
    case "oi":
      return <td {...attrs} className={cn(base, "text-fg-3")}>{q.oi === null || q.oi === undefined ? "—" : q.oi.toLocaleString("en-US")}</td>;
    case "vol":
      return <td {...attrs} className={cn(base, "text-fg-3")}>{q.volume === null || q.volume === undefined ? "—" : q.volume.toLocaleString("en-US")}</td>;
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
  /** selection + legs on this row (Marks, joined: a cheap memo key) */
  marks: string;
  interactive: boolean;
}

const parseMarks = (m: string): Marks => {
  const [sel, call, put] = m.split("|");
  return { sel: sel === "c" ? "call" : sel === "p" ? "put" : null, call: call === "b" ? "buy" : call === "s" ? "sell" : null, put: put === "b" ? "buy" : put === "s" ? "sell" : null };
};

/** Click anywhere on a half selects that option; the strike cell picks the side on screen (or the selected one). */
function onRowClick(e: React.MouseEvent<HTMLTableRowElement>, row: OptionChainRow, view: "both" | "calls" | "puts") {
  const td = (e.target as HTMLElement).closest<HTMLElement>("td[data-r]");
  const r = td?.dataset.r;
  let right: OptionRight;
  if (r === "c") right = "call";
  else if (r === "p") right = "put";
  else if (view !== "both") right = view === "calls" ? "call" : "put";
  else {
    const s = getOpt().sel;
    right = s && (row.call?.code === s || row.put?.code === s) ? (row.put?.code === s ? "put" : "call") : "call";
  }
  if (!(right === "call" ? row.call : row.put)) return;
  opt.select(row, right, { add: e.shiftKey });
}

const ChainRow = React.memo(function ChainRow({ row, cols, view, digits, itmCall, itmPut, atm, marks, interactive }: RowProps) {
  const t = useT();
  const m = parseMarks(marks);
  const side = (right: OptionRight, list: Col[]) => {
    const q = right === "call" ? row.call : row.put;
    const itm = right === "call" ? itmCall : itmPut;
    const mark = { sel: m.sel === right, leg: !!(right === "call" ? m.call : m.put) };
    const title = interactive ? t(right === "call" ? "trader.opt.chain.selectCall" : "trader.opt.chain.selectPut", { strike: row.strikeLabel }) : undefined;
    return list.map((c) => <Cell key={`${right}-${c}`} q={q} col={c} right={right} digits={digits} itm={itm} mark={mark} title={title} theoLabel={t("trader.opt.col.theoShort")} />);
  };
  const legChip = (right: OptionRight) => {
    const s = right === "call" ? m.call : m.put;
    if (!s) return null;
    return <span className={cn("rounded-[3px] px-[3px] font-sans text-[8.5px] font-bold leading-[13px]", s === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{s === "buy" ? t("trader.opt.b") : t("trader.opt.s")}</span>;
  };
  const strike = (
    <td data-r="k" className={cn("h-[30px] w-[86px] cursor-pointer whitespace-nowrap border-x border-b border-line/60 bg-panel-2 px-1 text-center font-mono text-[12px] font-semibold", view !== "both" && "sticky left-0 z-[1]", atm ? "text-ember" : "text-fg", m.sel && "bg-ember-soft text-fg")}>
      <span className="inline-flex items-center gap-1">
        {view === "both" && legChip("call")}
        {m.sel === "call" && view === "both" && <span className="text-[9px] text-ember">◀</span>}
        {atm && !m.sel && <span className="size-1.5 rounded-full bg-ember" title="ATM" />}
        {row.strikeLabel}
        {m.sel === "put" && view === "both" && <span className="text-[9px] text-ember">▶</span>}
        {view === "both" ? legChip("put") : legChip(view === "calls" ? "call" : "put")}
      </span>
    </td>
  );
  return (
    <tr data-atm={atm || undefined} data-sel={m.sel ? "" : undefined} onClick={interactive ? (e) => onRowClick(e, row, view) : undefined} className={cn(!interactive && "[&_td]:!cursor-default")}>
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

/** "Add leg" armed, or a strategy in the ticket: what the next click does. */
function ModeBanner() {
  const t = useT();
  const adding = useOpt((s) => s.ticket.adding);
  const legs = useOpt((s) => s.ticket.legs.length);
  if (!adding && legs < 2) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-ember/30 bg-ember-soft/50 px-2.5 py-1 text-[11.5px] text-fg-2">
      <Layers className="size-3.5 shrink-0 text-ember" />
      <span className="min-w-0 flex-1 truncate">{adding ? t("trader.opt.chain.adding") : t("trader.opt.chain.strategy")}</span>
      <button onClick={() => (adding ? opt.setAdding(false) : opt.clearTicket())} className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] text-fg-3 hover:bg-surface-3 hover:text-fg">
        <X className="size-3" /> {adding ? t("common.cancel") : t("trader.opt.ticket.clear")}
      </button>
    </div>
  );
}

/** One-line how-to above the chain (desktop): select first, then Buy or Sell. */
export function ChainHint({ className }: { className?: string }) {
  const t = useT();
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-[11px] text-fg-3", className)}>
      <MousePointerClick className="size-3.5 shrink-0 text-ember" />
      <span className="truncate">{t("trader.opt.chain.hint")}</span>
    </span>
  );
}

export function OptionChainTable({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const chain = useOpt((s) => s.chain);
  const loading = useOpt((s) => s.chainLoading);
  const prefs = useOpt((s) => s.prefs);
  const legs = useOpt((s) => s.ticket.legs);
  const armed = useOpt((s) => s.ticket.armed);
  const sel = useOpt((s) => s.sel);
  // the public chain page is read-only; everywhere else a click selects (guests and investors too: chart, preview)
  const interactive = useOpt((s) => !s.ctx?.publicPage);
  const heads = useHeads(useBookLive());
  const scroller = React.useRef<HTMLDivElement>(null);
  const centred = React.useRef<string | null>(null);

  const key = chain ? `${chain.underlying}|${chain.expiry}` : null;
  const atmI = chain ? atmIndex(chain) : 0;
  const rows = chain ? visibleRows(chain, prefs.range, atmI) : [];
  const atmStrike = chain?.rows[atmI]?.strike;
  const spot = chain?.spot?.mid;
  const bookLive = useBookLive();
  const book = bookLive || !!chain?.rows.some((r) => [r.call?.oi, r.put?.oi].some((v) => v !== undefined && v !== null));
  const cols = compact ? (["bid", "ask", ...(bookLive ? (["last"] as Col[]) : []), "iv", "delta"] as Col[]) : columns(prefs.view === "both", prefs.greeks, prefs.extra, book, bookLive);
  // B / S chips: a strategy's legs, or the single option once Buy or Sell is chosen
  const legSide = new Map(legs.length > 1 || armed ? legs.map((l) => [l.series, l.side]) : []);
  const marksOf = (r: OptionChainRow) => {
    const s = sel && r.call?.code === sel ? "c" : sel && r.put?.code === sel ? "p" : "";
    const c = r.call ? legSide.get(r.call.code) : undefined;
    const p = r.put ? legSide.get(r.put.code) : undefined;
    return `${s}|${c ? c[0] : ""}|${p ? p[0] : ""}`;
  };
  const spotIdx = spot === undefined ? -1 : rows.findIndex((r) => r.strike > spot);

  // centre the ATM strike when a chain first shows
  React.useEffect(() => {
    if (!key || centred.current === key || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>("tr[data-sel]") ?? scroller.current.querySelector<HTMLElement>("tr[data-atm]");
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
  const view = compact ? (prefs.view === "puts" ? "puts" : "calls") : prefs.view;
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
      {interactive && <ModeBanner />}
      <div ref={scroller} className="t-scroll relative min-h-0 flex-1 overflow-auto">
        <table className={cn("w-full min-w-max border-separate border-spacing-0", interactive && "opt-chain")}>
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
                <ChainRow row={r} cols={cols} view={view} digits={chain.digits} itmCall={spot !== undefined && r.strike < spot} itmPut={spot !== undefined && r.strike > spot} atm={r.strike === atmStrike} marks={marksOf(r)} interactive={interactive} />
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
          {bookLive && chain.pcr !== null && chain.pcr !== undefined && (
            <span className="hidden items-center gap-1 md:flex" title={t("trader.opt.book.pcrHint")}>
              {t("trader.opt.book.pcr")} <span className="k-num font-mono text-fg-2">{chain.pcr.toFixed(2)}</span>
            </span>
          )}
          {interactive && (
            <span className="ms-auto hidden items-center gap-1 lg:flex">
              <Layers className="size-3" />
              {t("trader.opt.shiftHint")}
            </span>
          )}
          <span className={cn("hidden items-center gap-1 md:flex", !interactive && "ms-auto")}>
            <span className="inline-block size-2 rounded-[2px] bg-gold-soft" /> {t("trader.opt.itm")}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

// The option chain for one expiry: calls and puts side by side around the strike (or one list). Beginner-first: by
// default each side shows one number, the price of one contract in USD (what you pay to buy it); "Columns" adds the
// sell price, the chance of ending in the money and the breakeven (Standard) or everything a pro wants (Pro: last
// trade, mark, IV, Greeks, open interest and volume), or any columns one by one. The strike closest to today's
// price is marked ATM, the in-the-money halves are shaded, and a line with today's price sits between the strikes.
// Rows update in place from the stream and their prices flash.
// While the broker's order book is live, bid / ask are the book's best bid / offer with their sizes under them ("—"
// for an empty side), the mark carries the theo (model value) under it.
// Selecting, not trading: a click on a row's call half or put half selects that option (highlighted; the ticket on
// the right shows what it costs, risks and pays, and trades it once the trader chooses Buy or Sell). Shift+click,
// "Add leg" in the ticket, or a strategy already in the ticket adds the option as a leg instead.
import * as React from "react";
import { Check as CheckIcon, Columns3, Layers, MousePointerClick, X } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { DropMenu } from "@/components/ui/menu";
import { atmIndex } from "@/lib/options/math";
import { ALL_COLS, COL_PRESETS, getOpt, opt, useBookLive, useOpt, visibleRows, type ChainCol, type ColPreset } from "@/lib/options-store";
import type { OptionChainRow, OptionQuote, OptionRight } from "@/lib/options/types";
import { Flash } from "./bits";
import { Explain } from "./explain";
import { greek, iso, lastChange, pct, pips, px, usd } from "./format";

type Col = ChainCol;

const RANGES = [6, 10, 20, 0] as const;

const COL_W: Record<Col, string> = { bid: "w-[76px]", ask: "w-[76px]", last: "w-[66px]", mark: "w-[72px]", iv: "w-[56px]", delta: "w-[58px]", gamma: "w-[62px]", theta: "w-[60px]", vega: "w-[54px]", prob: "w-[62px]", be: "w-[80px]", oi: "w-[56px]", vol: "w-[56px]" };

/** The columns on screen: the preset's, without the book-only ones while there is no book. */
export function useChainCols(): Col[] {
  const cols = useOpt((s) => s.prefs.cols);
  const bookLive = useBookLive();
  const hasOi = useOpt((s) => !!s.chain?.rows.some((r) => [r.call?.oi, r.put?.oi].some((v) => v !== undefined && v !== null)));
  return React.useMemo(() => cols.filter((c) => (c === "last" ? bookLive : c === "oi" || c === "vol" ? bookLive || hasOi : true)), [cols, bookLive, hasOi]);
}

function useHeads(book: boolean, simple: boolean): Record<Col, { label: string; title: string }> {
  const t = useT();
  return React.useMemo(
    () => ({
      bid: { label: t("trader.opt.col.sell"), title: t("trader.opt.col.bidHint") },
      ask: simple ? { label: t("trader.opt.col.priceSimple"), title: t("trader.opt.col.priceHint") } : { label: t("trader.opt.col.buy"), title: t("trader.opt.col.askHint") },
      last: { label: t("trader.opt.col.last"), title: t("trader.opt.col.lastHint") },
      mark: { label: t("trader.opt.col.mark"), title: book ? t("trader.opt.col.markBookHint") : t("trader.opt.col.markHint") },
      iv: { label: t("trader.opt.col.iv"), title: t("trader.opt.col.ivHint") },
      delta: { label: "Δ", title: t("trader.opt.col.deltaHint") },
      gamma: { label: "Γ", title: t("trader.opt.col.gammaHint") },
      theta: { label: "Θ", title: t("trader.opt.col.thetaHint") },
      vega: { label: "Vega", title: t("trader.opt.col.vegaHint") },
      prob: { label: t("trader.opt.col.chance"), title: t("trader.opt.col.probHint") },
      be: { label: t("trader.opt.col.be"), title: t("trader.opt.col.beHint") },
      oi: { label: t("trader.opt.col.oi"), title: t("trader.opt.col.oiHint") },
      vol: { label: t("trader.opt.col.vol"), title: t("trader.opt.col.volHint") },
    }),
    [t, book, simple],
  );
}

/** Ticket legs and the selection on one row, as a cheap memo key: "c" / "p" selected, "cb" "cs" "pb" "ps" legs. */
interface Marks {
  sel: OptionRight | null;
  call: "buy" | "sell" | null;
  put: "buy" | "sell" | null;
}

interface CellProps {
  q: OptionQuote | null;
  col: Col;
  right: OptionRight;
  digits: number;
  itm: boolean;
  mark: { sel: boolean; leg: boolean };
  title?: string;
  theoLabel: string;
  simple: boolean;
  compact?: boolean;
  /** the cell next to the strike (the price pill points at it) */
  inner: boolean;
}

function Cell({ q, col, right, digits, itm, mark, title, theoLabel, simple, compact, inner }: CellProps) {
  const base = cn(
    "cursor-pointer whitespace-nowrap border-b border-line/40 px-2 font-mono transition-colors",
    compact ? "h-[46px] text-[13px]" : "h-8 text-[12.5px]",
    simple ? (right === "call" ? "text-end" : "text-start") : "text-end",
    COL_W[col],
    itm && "bg-[color-mix(in_srgb,var(--k-gold)_7%,transparent)]",
  );
  const attrs = { "data-r": right === "call" ? "c" : "p", "data-sel": mark.sel || undefined, "data-leg": (!mark.sel && mark.leg) || undefined, title: q ? title : undefined };
  if (!q)
    return (
      <td {...attrs} className={cn(base, "cursor-default text-fg-3/60")}>
        —
      </td>
    );
  const dim = q.state !== "open" && "opacity-60";
  switch (col) {
    case "bid":
    case "ask": {
      const v = col === "bid" ? q.bidUsd : q.askUsd;
      const size = col === "bid" ? q.bidQty : q.askQty;
      if (simple && col === "ask")
        return (
          <td {...attrs} className={cn(base, "px-2.5")}>
            <button
              type="button"
              tabIndex={0}
              aria-label={title}
              className={cn(
                "inline-flex min-w-[78px] items-center justify-center rounded-[8px] border px-2.5 font-semibold outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ember/50",
                compact ? "h-[32px] text-[13.5px]" : "h-[26px] text-[12.5px]",
                mark.sel ? "border-ember bg-ember text-white shadow-[0_6px_18px_-8px_rgba(255,90,31,0.8)]" : "border-line bg-surface-2 text-fg hover:border-fg-3/50 hover:bg-surface-3",
                dim,
                inner && (right === "call" ? "me-0" : "ms-0"),
              )}
            >
              {v > 0 ? (
                <Flash value={v}>
                  <span className={cn("me-px text-[0.85em] font-normal", mark.sel ? "text-white/80" : "text-fg-3")}>$</span>
                  {usd(v)}
                </Flash>
              ) : (
                "—"
              )}
            </button>
          </td>
        );
      return (
        <td {...attrs} className={cn(base, "p-0")}>
          <button
            type="button"
            tabIndex={col === "ask" ? 0 : -1}
            aria-label={title}
            className={cn(
              "my-0.5 me-1.5 ms-auto inline-flex min-w-[64px] items-center justify-end rounded-[6px] border px-1.5 text-end outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/50",
              q.book ? "h-7 flex-col items-end justify-center leading-none" : "h-6",
              col === "bid" ? "border-down/15 bg-down-soft/50 text-down hover:border-down/45 hover:bg-down-soft" : "border-up/15 bg-up-soft/50 text-up hover:border-up/45 hover:bg-up-soft",
              mark.sel && "border-ember ring-1 ring-ember/40",
              dim,
            )}
          >
            <Flash value={v}>{v > 0 ? usd(v) : "—"}</Flash>
            {q.book && <span className="mt-0.5 text-[9.5px] text-fg-3">{v > 0 && size ? `×${size.toLocaleString("en-US")}` : " "}</span>}
          </button>
        </td>
      );
    }
    case "last":
      return (
        <td {...attrs} className={cn(base, "p-0")}>
          <span className={cn("flex h-full w-full flex-col items-end justify-center px-2 leading-none text-fg-2", dim)}>
            {q.lastUsd ? <Flash value={q.lastUsd}>{usd(q.lastUsd)}</Flash> : <span className="text-fg-3">—</span>}
            <span className={cn("mt-0.5 text-[9.5px]", q.change === null || q.change === undefined ? "text-fg-3" : q.change >= 0 ? "text-up" : "text-down")}>{lastChange(q.lastUsd, q.change) ?? " "}</span>
          </span>
        </td>
      );
    case "mark":
      return (
        <td {...attrs} className={cn(base, "p-0")}>
          <span className={cn("flex h-full w-full flex-col items-end justify-center px-2 leading-none text-fg", dim)}>
            <Flash value={q.markUsd}>{usd(q.markUsd)}</Flash>
            {q.book && q.theoUsd !== null && q.theoUsd !== undefined ? <span className="mt-0.5 text-[9.5px] text-fg-3">{`${theoLabel} ${usd(q.theoUsd)}`}</span> : <span className="mt-0.5 text-[9.5px] text-fg-3">{pips(q.markPips)}p</span>}
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
      return (
        <td {...attrs} className={cn(base, "text-fg-2")}>
          <span className="inline-flex items-center justify-end gap-1.5">
            <span className="hidden h-1 w-6 overflow-hidden rounded-full bg-surface-3 min-[900px]:inline-block">
              <span className="block h-full rounded-full bg-fg-3/70" style={{ width: `${Math.round(Math.min(1, Math.max(0, q.probItm)) * 100)}%` }} />
            </span>
            {pct(q.probItm, 0)}
          </span>
        </td>
      );
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
  simple: boolean;
  compact?: boolean;
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

const ChainRow = React.memo(function ChainRow({ row, cols, view, digits, itmCall, itmPut, atm, marks, interactive, simple, compact }: RowProps) {
  const t = useT();
  const m = parseMarks(marks);
  const side = (right: OptionRight, list: Col[]) => {
    const q = right === "call" ? row.call : row.put;
    const itm = right === "call" ? itmCall : itmPut;
    const mark = { sel: m.sel === right, leg: !!(right === "call" ? m.call : m.put) };
    const title = interactive ? t(right === "call" ? "trader.opt.chain.selectCall" : "trader.opt.chain.selectPut", { strike: row.strikeLabel }) : undefined;
    const innerCol = right === "call" ? list[list.length - 1] : list[0];
    return list.map((c) => <Cell key={`${right}-${c}`} q={q} col={c} right={right} digits={digits} itm={itm} mark={mark} title={title} theoLabel={t("trader.opt.col.theoShort")} simple={simple} compact={compact} inner={c === innerCol} />);
  };
  const legChip = (right: OptionRight) => {
    const s = right === "call" ? m.call : m.put;
    if (!s) return null;
    return <span className={cn("rounded-[4px] px-[4px] font-sans text-[9px] font-bold leading-[14px]", s === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{s === "buy" ? t("trader.opt.b") : t("trader.opt.s")}</span>;
  };
  const strike = (
    <td data-r="k" className={cn("cursor-pointer whitespace-nowrap border-x border-b border-line/50 bg-panel-2 px-1.5 text-center font-mono font-semibold", compact ? "h-[46px] w-[92px] text-[13.5px]" : "h-[36px] w-[104px] text-[12.5px]", view !== "both" && "sticky start-0 z-[1]", atm ? "text-ember" : "text-fg", m.sel && "bg-ember-soft text-fg")}>
      <span className="inline-flex flex-col items-center leading-none">
        <span className="inline-flex items-center gap-1">
          {view === "both" && legChip("call")}
          {row.strikeLabel}
          {view === "both" ? legChip("put") : legChip(view === "calls" ? "call" : "put")}
        </span>
        {atm && <span className="mt-[3px] rounded-[3px] bg-ember-soft px-1 font-sans text-[8.5px] font-bold uppercase tracking-[0.08em] text-ember">{t("trader.opt.chain.atm")}</span>}
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

function SpotRow({ span, label, both }: { span: number; label: React.ReactNode; both: boolean }) {
  return (
    <tr aria-hidden>
      <td colSpan={span} className="h-[20px] border-b border-line/40 p-0">
        <div className="pointer-events-none relative flex h-[20px] items-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[linear-gradient(90deg,transparent,var(--k-ember)_15%,var(--k-ember)_85%,transparent)] opacity-70" />
          <span className={cn("relative z-[1] inline-flex items-center gap-1.5 rounded-full border border-ember/45 bg-panel px-2 font-mono text-[10.5px] font-semibold leading-[16px] text-ember shadow-[0_0_0_3px_var(--t-panel)]", both ? "mx-auto" : "ms-3")}>
            <span className="size-1.5 animate-pulse rounded-full bg-ember" />
            {label}
          </span>
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

/** One-line how-to above the chain (desktop): tap a price, the ticket shows what it costs, risks and pays. */
export function ChainHint({ className }: { className?: string }) {
  const t = useT();
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3", className)}>
      <MousePointerClick className="size-3.5 shrink-0 text-ember" />
      <span className="truncate">{t("trader.opt.chain.tapHint")}</span>
    </span>
  );
}

const PRESETS: { id: Exclude<ColPreset, "custom">; label: "trader.opt.cols.simple" | "trader.opt.cols.standard" | "trader.opt.cols.pro"; hint: "trader.opt.cols.simpleHint" | "trader.opt.cols.standardHint" | "trader.opt.cols.proHint" }[] = [
  { id: "simple", label: "trader.opt.cols.simple", hint: "trader.opt.cols.simpleHint" },
  { id: "standard", label: "trader.opt.cols.standard", hint: "trader.opt.cols.standardHint" },
  { id: "pro", label: "trader.opt.cols.pro", hint: "trader.opt.cols.proHint" },
];

const GROUPS: { label: "trader.opt.cols.groupPrices" | "trader.opt.cols.groupOdds" | "trader.opt.cols.groupGreeks" | "trader.opt.cols.groupActivity"; cols: Col[] }[] = [
  { label: "trader.opt.cols.groupPrices", cols: ["bid", "ask", "last", "mark"] },
  { label: "trader.opt.cols.groupOdds", cols: ["prob", "be"] },
  { label: "trader.opt.cols.groupGreeks", cols: ["iv", "delta", "gamma", "theta", "vega"] },
  { label: "trader.opt.cols.groupActivity", cols: ["oi", "vol"] },
];

/** "Columns": Simple / Standard / Pro, or any columns one by one. */
export function ColumnsMenu({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT();
  const preset = useOpt((s) => s.prefs.colPreset);
  const cols = useOpt((s) => s.prefs.cols);
  const bookLive = useBookLive();
  const heads = useHeads(bookLive, false);
  const label = preset === "custom" ? t("trader.opt.cols.custom") : t(PRESETS.find((p) => p.id === preset)!.label);
  const toggle = (c: Col) => {
    const has = cols.includes(c);
    const next = ALL_COLS.filter((x) => (x === c ? !has : cols.includes(x)));
    if (!next.length) return;
    const same = (Object.keys(COL_PRESETS) as Exclude<ColPreset, "custom">[]).find((k) => COL_PRESETS[k].length === next.length && COL_PRESETS[k].every((x) => next.includes(x)));
    opt.setPrefs({ cols: next, colPreset: same ?? "custom" });
  };
  return (
    <DropMenu
      width={280}
      trigger={({ toggle: open, open: on }) => (
        <button onClick={open} aria-expanded={on} className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-line px-2 text-[11.5px] font-medium text-fg-2 transition-colors hover:border-fg-3/40 hover:text-fg", on && "bg-surface-3 text-fg", className)}>
          <Columns3 className="size-3.5 text-fg-3" />
          {!compact && <span className="text-fg-3">{t("trader.opt.cols.title")}:</span>}
          <span>{label}</span>
        </button>
      )}
    >
      {() => (
        <div className="p-2">
          <div className="grid gap-1">
            {PRESETS.map((p) => {
              const on = preset === p.id;
              return (
                <button key={p.id} onClick={() => opt.setPrefs({ colPreset: p.id, cols: COL_PRESETS[p.id] })} aria-pressed={on} className={cn("flex items-start gap-2 rounded-[8px] border px-2.5 py-2 text-start transition-colors", on ? "border-ember/50 bg-ember-soft" : "border-transparent hover:bg-surface-3")}>
                  <span className={cn("mt-px grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-ember bg-ember text-white" : "border-line")}>{on && <CheckIcon className="size-2.5" />}</span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-fg">{t(p.label)}</span>
                    <span className="block text-[11px] leading-snug text-fg-3">{t(p.hint)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 border-t border-line pt-2">
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-1.5 last:mb-0">
                <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t(g.label)}</div>
                <div className="flex flex-wrap gap-1 px-0.5">
                  {g.cols.map((c) => {
                    const on = cols.includes(c);
                    const off = (c === "last" && !bookLive) || ((c === "oi" || c === "vol") && !bookLive);
                    return (
                      <button key={c} onClick={() => toggle(c)} aria-pressed={on} title={heads[c].title} className={cn("h-6 rounded-[6px] border px-2 text-[11px] font-medium transition-colors", on ? "border-ember/45 bg-ember-soft text-fg" : "border-line text-fg-3 hover:text-fg-2", off && "opacity-50")}>
                        {heads[c].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DropMenu>
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
  const bookLive = useBookLive();
  const allCols = useChainCols();
  const scroller = React.useRef<HTMLDivElement>(null);
  const centred = React.useRef<string | null>(null);

  const key = chain ? `${chain.underlying}|${chain.expiry}` : null;
  const atmI = chain ? atmIndex(chain) : 0;
  const rows = chain ? visibleRows(chain, prefs.range, atmI) : [];
  const atmStrike = chain?.rows[atmI]?.strike;
  const spot = chain?.spot?.mid;
  // phones: one price per side fits calls and puts side by side; more columns show one side at a time (max 4)
  const cols = compact && allCols.length > 1 ? allCols.slice(0, 4) : allCols;
  const simple = cols.length === 1 && cols[0] === "ask";
  const heads = useHeads(bookLive, simple);
  // B / S chips: a strategy's legs, or the single option once Buy or Sell is chosen
  const legSide = new Map(legs.length > 1 || armed ? legs.map((l) => [l.series, l.side]) : []);
  const marksOf = (r: OptionChainRow) => {
    const s = sel && r.call?.code === sel ? "c" : sel && r.put?.code === sel ? "p" : "";
    const c = r.call ? legSide.get(r.call.code) : undefined;
    const p = r.put ? legSide.get(r.put.code) : undefined;
    return `${s}|${c ? c[0] : ""}|${p ? p[0] : ""}`;
  };
  const spotIdx = spot === undefined ? -1 : rows.findIndex((r) => r.strike > spot);

  // centre the ATM strike (or the selected one) when a chain first shows
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
      <div className={cn("flex h-full flex-col gap-1.5 p-3", className)} aria-busy={loading}>
        <div className="mx-auto mb-1 h-4 w-48 animate-pulse rounded bg-surface-2" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_96px_1fr] items-center gap-3" style={{ opacity: 1 - i * 0.06 }}>
            <div className="ms-auto h-[22px] w-20 animate-pulse rounded-[7px] bg-surface-2" style={{ animationDelay: `${i * 40}ms` }} />
            <div className="h-[22px] animate-pulse rounded-[5px] bg-surface-2/70" style={{ animationDelay: `${i * 40}ms` }} />
            <div className="h-[22px] w-20 animate-pulse rounded-[7px] bg-surface-2" style={{ animationDelay: `${i * 40}ms` }} />
          </div>
        ))}
      </div>
    );
  }

  const both = (prefs.view === "both" && !compact) || (compact && simple && prefs.view === "both");
  const view: "both" | "calls" | "puts" = both ? "both" : compact ? (prefs.view === "puts" ? "puts" : "calls") : prefs.view;
  const span = view === "both" ? cols.length * 2 + 1 : cols.length + 1;
  const u = chain.underlying;
  const thBase = "sticky z-[2] whitespace-nowrap border-b border-line bg-panel";
  const head = (list: Col[], right: OptionRight) =>
    list.map((c) => (
      <th key={c} title={heads[c].title} className={cn(thBase, "top-[34px] h-6 px-2 text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3", simple ? (right === "call" ? "text-end" : "text-start") : "text-end", COL_W[c])}>
        {heads[c].label}
      </th>
    ));
  const sideHead = (right: OptionRight, colSpan: number, align: "start" | "end") => (
    <th colSpan={colSpan} className={cn(thBase, "top-0 h-[34px] px-2.5", align === "end" ? "text-end" : "text-start")}>
      <span className={cn("inline-flex items-center gap-1.5", align === "end" && "flex-row-reverse")}>
        <span className={cn("grid size-[18px] place-items-center rounded-[5px] font-mono text-[10px] font-bold", right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{right === "call" ? "C" : "P"}</span>
        <span className={cn("flex flex-col leading-none", align === "end" ? "items-end" : "items-start")}>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg">
            {right === "call" ? t("trader.opt.calls") : t("trader.opt.puts")}
            {interactive && <Explain topic={right} size={11} />}
          </span>
          <span className={cn("mt-[3px] text-[10.5px] font-normal normal-case tracking-normal", right === "call" ? "text-up" : "text-down")}>{right === "call" ? t("trader.opt.chain.callsSub", iso({ u })) : t("trader.opt.chain.putsSub", iso({ u }))}</span>
        </span>
      </span>
    </th>
  );
  const strikeHead = (
    <th className={cn(thBase, "top-[34px] z-[3] h-6 border-x px-2 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-2", view !== "both" && "start-0", compact ? "w-[92px]" : "w-[104px]")}>
      <span className="inline-flex items-center gap-1">
        {t("trader.opt.col.strike")}
        {interactive && !compact && <Explain topic="strike" size={11} />}
      </span>
    </th>
  );
  return (
    <div className={cn("@container flex h-full min-h-0 flex-col", className)}>
      {chain.error && <div className="shrink-0 border-b border-warn/30 bg-warn-soft px-3 py-1 text-[11.5px] text-warn">{t("trader.opt.noPrice")}</div>}
      {interactive && <ModeBanner />}
      <div ref={scroller} className="t-scroll relative min-h-0 flex-1 overflow-auto">
        <table className={cn("border-separate border-spacing-0", interactive && "opt-chain", simple && !compact ? "mx-auto w-full max-w-[760px]" : "w-full min-w-max")}>
          <thead>
            <tr>
              {view === "both" ? (
                <>
                  {sideHead("call", cols.length, "end")}
                  <th className={cn(thBase, "top-0 z-[3] h-[34px] px-1 text-center font-mono text-[10px] font-normal text-fg-3")} />
                  {sideHead("put", cols.length, "start")}
                </>
              ) : (
                sideHead(view === "calls" ? "call" : "put", span, "start")
              )}
            </tr>
            <tr>
              {view === "both" ? (
                <>
                  {head([...cols].reverse(), "call")}
                  {strikeHead}
                  {head(cols, "put")}
                </>
              ) : (
                <>
                  {strikeHead}
                  {head(cols, view === "calls" ? "call" : "put")}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <React.Fragment key={r.strikeLabel}>
                {i === spotIdx && i > 0 && spot !== undefined && <SpotRow span={span} both={view === "both"} label={t("trader.opt.chain.spotNow", iso({ u, price: px(spot, chain.digits) }))} />}
                <ChainRow row={r} cols={cols} view={view} digits={chain.digits} itmCall={spot !== undefined && r.strike < spot} itmPut={spot !== undefined && r.strike > spot} atm={r.strike === atmStrike} marks={marksOf(r)} interactive={interactive} simple={simple} compact={compact} />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className={cn("flex shrink-0 items-center gap-3 border-t border-line px-2.5 text-[11.5px] text-fg-3", compact ? "h-9" : "h-8")}>
        <span className="flex items-center gap-1.5">
          <span className="hidden sm:inline">{t("trader.opt.strikes")}</span>
          <span role="radiogroup" aria-label={t("trader.opt.strikes")} className="flex items-center gap-0.5 rounded-[7px] border border-line bg-panel p-0.5">
          {RANGES.map((n) => (
            <button key={n} onClick={() => opt.setPrefs({ range: n })} aria-pressed={prefs.range === n} className={cn("k-num h-5 rounded-[5px] px-1.5 font-mono text-[11.5px] transition-colors", prefs.range === n ? "bg-surface-3 font-semibold text-fg shadow-[inset_0_1px_0_var(--k-border-top)]" : "text-fg-2 hover:text-fg")}>
              {n === 0 ? t("trader.opt.all") : `±${n}`}
            </button>
          ))}
          </span>
        </span>
        {bookLive && chain.pcr !== null && chain.pcr !== undefined && (
          <span className="hidden items-center gap-1 md:flex" title={t("trader.opt.book.pcrHint")}>
            {t("trader.opt.book.pcr")} <span className="k-num font-mono text-fg-2">{chain.pcr.toFixed(2)}</span>
          </span>
        )}
        {interactive && !compact && (
          <span className="ms-auto hidden items-center gap-1 @[860px]:flex">
            <Layers className="size-3" />
            {t("trader.opt.shiftHint")}
          </span>
        )}
        <span className={cn("flex items-center gap-1.5 whitespace-nowrap", !interactive || compact ? "ms-auto" : "ms-auto @[860px]:ms-0")}>
          <span className="inline-block size-2.5 rounded-[3px] border border-gold/30 bg-[color-mix(in_srgb,var(--k-gold)_14%,transparent)]" /> {t("trader.opt.itm")}
          <Explain topic="itm" size={11} />
        </span>
        {!compact && (
          <span className="hidden items-center gap-1.5 lg:flex">
            <span className="rounded-[3px] bg-ember-soft px-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-ember">{t("trader.opt.chain.atm")}</span>
            <Explain topic="atm" size={11} />
          </span>
        )}
      </div>
    </div>
  );
}

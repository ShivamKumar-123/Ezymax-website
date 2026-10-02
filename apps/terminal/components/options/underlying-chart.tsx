"use client";

// The underlying's chart in the options workspace (the terminal's chart engine: same history, live bars, bid / ask
// lines and theme), with option levels drawn as price lines: the selected option's strike and breakeven, strikes and
// breakevens of the legs in the ticket, strikes, breakevens and barriers of open positions on this underlying (the
// focused position drawn bolder). `bare`: the Chart tab draws the header (Premium | Underlying, timeframes) itself.
import * as React from "react";
import { useTheme } from "next-themes";
import { LineStyle, type IPriceLine } from "lightweight-charts";
import { CandlestickChart } from "lucide-react";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { useChartEngine, type LegendData } from "@/components/chart/engine";
import { useTerminal } from "@/lib/store";
import type { Timeframe } from "@/lib/trading";
import { useOptionBook } from "@/lib/options/book";
import { opt, useOpt } from "@/lib/options-store";
import { strikeText } from "./format";

const TFS: Timeframe[] = ["M5", "M15", "H1", "H4", "D1"];

/** The latest legend values (bar under the crosshair, else the forming one), read by a small leaf. */
function createLegendStore() {
  let v: LegendData | null = null;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: LegendData) => {
      v = n;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
}
type LegendStore = ReturnType<typeof createLegendStore>;

function Ohlc({ store, digits }: { store: LegendStore; digits: number }) {
  const l = React.useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!l) return null;
  const up = l.c >= l.o;
  return (
    <>
      {(["o", "h", "l", "c"] as const).map((k) => (
        <span key={k} className="k-num">
          {k.toUpperCase()}
          <span className={cn("ms-1", up ? "text-up" : "text-down")}>{l[k].toFixed(digits)}</span>
        </span>
      ))}
      <span className={cn("k-num", l.chg >= 0 ? "text-up" : "text-down")}>
        {l.chg >= 0 ? "+" : ""}
        {l.chg.toFixed(2)}%
      </span>
    </>
  );
}

interface Level {
  id: string;
  price: number;
  kind: "strike" | "be" | "barrier" | "pos";
  title: string;
  bold?: boolean;
}

export function UnderlyingChart({ className, bare }: { className?: string; bare?: boolean }) {
  const t = useT();
  const T = useTerminal();
  const u = useOpt((s) => s.u);
  const tf = useOpt((s) => s.prefs.tf);
  if (!INSTRUMENT_MAP[u])
    return (
      <div className={cn("grid h-full place-items-center p-4 text-center text-[12px] text-fg-3", className)}>
        <div>
          <CandlestickChart className="mx-auto mb-2 size-5" />
          {t("trader.opt.chartUnavailable", { u })}
        </div>
      </div>
    );
  return <ChartBody key={`${u}|${tf}`} u={u} tf={tf} login={T.guest ? null : T.account.login} className={className} bare={bare} />;
}

function ChartBody({ u, tf, login, className, bare }: { u: string; tf: Timeframe; login: string | null; className?: string; bare?: boolean }) {
  const t = useT();
  const { resolvedTheme } = useTheme();
  const el = React.useRef<HTMLDivElement>(null);
  const legend = React.useMemo(createLegendStore, []);
  const onLegend = React.useCallback((l: LegendData) => legend.set(l), [legend]);
  const indicators = React.useMemo(() => [], []);
  const engine = useChartEngine(el, { symbol: u, tf, type: "candles", indicators, theme: resolvedTheme, crosshair: true, onLegend });
  const legs = useOpt((s) => s.ticket.legs);
  const sel = useOpt((s) => s.sel);
  const index = useOpt((s) => s.index);
  const quotes = useOpt((s) => s.quotes);
  const focus = useOpt((s) => s.focus);
  const digits = useOpt((s) => s.chain?.digits ?? INSTRUMENT_MAP[u]?.digits ?? 5);
  const book = useOptionBook(login);

  const levels = React.useMemo(() => {
    const out: Level[] = [];
    // the selected option (when it isn't a ticket leg already)
    const sp = sel && !legs.some((l) => l.series === sel) ? parseSeriesCode(sel) : null;
    if (sp && sp.underlying === u) {
      const q = index[sel!] ?? quotes[sel!];
      out.push({ id: `sel:${sel}`, price: sp.strike, kind: "strike", title: `${sp.right === "call" ? "C" : "P"} ${sp.strikeLabel}` });
      if (q) out.push({ id: `selbe:${sel}`, price: q.breakeven, kind: "be", title: t("trader.opt.line.be") });
    }
    for (const l of legs) {
      if (l.u !== u) continue;
      const q = index[l.series] ?? quotes[l.series];
      out.push({ id: `leg:${l.series}`, price: l.strike, kind: "strike", title: `${l.side === "buy" ? "B" : "S"} ${l.right === "call" ? "C" : "P"} ${l.strikeLabel}` });
      if (q && legs.length === 1) out.push({ id: `be:${l.series}`, price: q.breakeven, kind: "be", title: t("trader.opt.line.be") });
    }
    for (const p of book.positions) {
      if (p.option.underlying !== u) continue;
      const bold = focus === p.ticket;
      const k = p.option.strike;
      out.push({ id: `pos:${p.ticket}`, price: k, kind: "pos", title: `#${p.ticket} ${p.option.right === "call" ? "C" : "P"} ${strikeText(k, digits)}`, bold });
      const be = p.option.right === "call" ? k + p.openPrice : k - p.openPrice;
      if (bold || book.positions.length <= 4) out.push({ id: `pbe:${p.ticket}`, price: be, kind: "be", title: t("trader.opt.line.beOf", { ticket: p.ticket }), bold });
      const bl = p.option.barrier?.level ?? p.option.barrier?.price;
      if (bl) out.push({ id: `bar:${p.ticket}`, price: bl, kind: "barrier", title: t("trader.opt.line.barrier", { kind: (p.option.barrier?.type ?? p.option.barrier?.kind ?? "").replace(/_/g, " ") }).trim(), bold });
    }
    return out;
  }, [legs, sel, index, quotes, book.positions, focus, u, digits, t]);

  const lines = React.useRef<{ owner: unknown; map: Map<string, IPriceLine> }>({ owner: null, map: new Map() });
  React.useEffect(() => {
    if (!engine || !engine.alive.current) return;
    if (lines.current.owner !== engine.chart) lines.current = { owner: engine.chart, map: new Map() };
    const c = engine.palette;
    const map = lines.current.map;
    const want = new Map(levels.map((l) => [l.id, l]));
    for (const [id, pl] of map) {
      if (want.has(id)) continue;
      try {
        engine.main.removePriceLine(pl);
      } catch {
        /* chart rebuilt */
      }
      map.delete(id);
    }
    for (const l of levels) {
      const color = l.kind === "strike" ? c.gold : l.kind === "be" ? c.ember : l.kind === "barrier" ? c.warn : c.fg2;
      const style = l.kind === "strike" ? LineStyle.Dashed : l.kind === "be" ? LineStyle.Dotted : l.kind === "barrier" ? LineStyle.LargeDashed : LineStyle.Solid;
      const opts = { price: l.price, color, lineWidth: (l.bold ? 2 : 1) as 1 | 2, lineStyle: style, axisLabelVisible: true, title: l.title, axisLabelColor: color, axisLabelTextColor: l.kind === "pos" && c.dark ? "#0a0a0d" : "#fff" };
      const ex = map.get(l.id);
      if (ex) ex.applyOptions(opts);
      else map.set(l.id, engine.main.createPriceLine(opts));
    }
  }, [engine, levels]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {!bare && (
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line bg-panel-2 px-2">
        <span className="pe-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">{u}</span>
        {TFS.map((x) => (
          <button key={x} onClick={() => opt.setPrefs({ tf: x })} className={cn("h-6 rounded-[5px] px-1.5 font-mono text-[10.5px]", tf === x ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg-2")}>
            {x}
          </button>
        ))}
        <span className="ms-auto hidden items-center gap-2.5 text-[10px] text-fg-3 min-[1700px]:flex">
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-gold" /> {t("trader.opt.line.strike")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-dotted border-ember" /> {t("trader.opt.line.be")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 border-t border-fg-2" /> {t("trader.opt.line.position")}
          </span>
        </span>
      </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div ref={el} className="absolute inset-0" />
        {bare && (
          <div className="pointer-events-none absolute left-2 top-1.5 z-[5] max-w-[calc(100%-90px)]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] leading-4 text-fg-3">
              <span className="font-sans text-[11.5px] font-semibold text-fg">
                {u}, {tf}
              </span>
              <span className="font-sans text-fg-3">{INSTRUMENT_MAP[u]?.name}</span>
              <Ohlc store={legend} digits={INSTRUMENT_MAP[u]?.digits ?? digits} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

// The options instruments list: where Market Watch sits in CFD mode. Every underlying of Kalks FX Options with its
// spot, daily change and ATM implied vol, grouped by asset class; the ones not open here yet (NZDUSD…) are listed
// as "soon". Picking one sets the underlying of the chain, the chart and the ticket.
import * as React from "react";
import { Search } from "lucide-react";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { OPTION_UNDERLYINGS } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { atmIndex } from "@/lib/options/math";
import { opt, useOpt } from "@/lib/options-store";
import type { OptionUnderlying } from "@/lib/options/types";
import { OptAvatar } from "./bits";
import { FeedChange, FeedPrice } from "./header";
import { pct } from "./format";

const CLASSES = ["forex", "metals", "energies"] as const;
const CLASS_KEY = { forex: "trader.opt.class.forex", metals: "trader.opt.class.metals", energies: "trader.opt.class.energies" } as const;

interface Item {
  symbol: string;
  name: string;
  assetClass: string;
  atmVol: number | null;
  listed: boolean;
}

function Row({ it, active, narrow, liveIv, mobile, onPick, showIv }: { it: Item; active: boolean; narrow: boolean; liveIv: number | null; mobile?: boolean; onPick: () => void; showIv: boolean }) {
  const t = useT();
  const feed = !!INSTRUMENT_MAP[it.symbol];
  const iv = active && liveIv !== null ? liveIv : it.atmVol;
  return (
    <tr
      onClick={it.listed ? onPick : undefined}
      aria-selected={active}
      aria-disabled={!it.listed || undefined}
      className={cn("group", it.listed ? "cursor-pointer" : "cursor-default opacity-55", active ? "bg-ember-soft/55" : it.listed && "hover:bg-surface-3/70")}
    >
      <td className={cn("relative border-b border-line/50 ps-2.5", mobile ? "h-[52px]" : "h-[38px]")}>
        {active && <span className="absolute inset-y-1 start-0 w-[2px] rounded-full bg-ember" />}
        <span className="flex min-w-0 items-center gap-2">
          <OptAvatar symbol={it.symbol} size={mobile ? 22 : 17} />
          <span className="min-w-0 leading-tight">
            <span className={cn("block truncate font-medium text-fg", mobile ? "text-[13px]" : "text-[12px]")}>{it.symbol}</span>
            <span className={cn("block truncate text-fg-3", mobile ? "text-[10.5px]" : "text-[9.5px]")}>{it.name}</span>
          </span>
          {!it.listed && <span className="ms-auto shrink-0 rounded-[4px] bg-surface-3 px-1 text-[9px] font-semibold uppercase tracking-[0.05em] text-fg-3">{t("trader.opt.soonBadge")}</span>}
        </span>
      </td>
      <td className="border-b border-line/50 pe-1.5 text-end">{it.listed && feed ? <FeedPrice symbol={it.symbol} className={cn("justify-end", mobile ? "text-[12.5px]" : "text-[11.5px]")} /> : <span className="font-mono text-[11px] text-fg-3">—</span>}</td>
      {!narrow && <td className="border-b border-line/50 pe-1.5 text-end">{it.listed && feed ? <FeedChange symbol={it.symbol} /> : <span className="font-mono text-[10.5px] text-fg-3">—</span>}</td>}
      {showIv && (
        <td className="border-b border-line/50 pe-2 text-end font-mono text-[11px] text-fg-2" title={t("trader.opt.atmIvHint")}>
          {it.listed ? pct(iv) : "—"}
        </td>
      )}
    </tr>
  );
}

/** The list itself (desktop panel body and the phone's Instruments tab). */
export function InstrumentList({ mobile, onPick }: { mobile?: boolean; onPick?: (u: string) => void }) {
  const t = useT();
  const list = useOpt((s) => s.underlyings);
  const u = useOpt((s) => s.u);
  const liveIv = useOpt((s) => (s.chain && s.chain.underlying === s.u && s.chain.rows.length ? (s.chain.rows[atmIndex(s.chain)]?.call?.iv ?? null) : null));
  const [q, setQ] = React.useState("");
  const [narrow, setNarrow] = React.useState(false);
  // implied vol is a pro figure: shown with the Pro chain columns
  const showIv = useOpt((s) => s.prefs.colPreset === "pro" || s.prefs.cols.includes("iv"));
  const span = (narrow ? 3 : 4) - (showIv ? 0 : 1);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el || mobile) return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 250));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile]);

  const listed = new Map<string, OptionUnderlying>(list.map((x) => [x.symbol, x]));
  const items: Item[] = [
    ...list.map((x) => ({ symbol: x.symbol, name: x.name, assetClass: x.assetClass, atmVol: x.atmVol, listed: true })),
    // every underlying of Kalks FX Options; the ones not open here yet show as "soon"
    ...OPTION_UNDERLYINGS.filter((x) => !listed.has(x.symbol)).map((x) => ({ symbol: x.symbol, name: x.name, assetClass: x.assetClass, atmVol: null, listed: false })),
  ];
  const match = (x: Item) => !q || x.symbol.toLowerCase().includes(q.toLowerCase()) || x.name.toLowerCase().includes(q.toLowerCase());
  const shown = items.filter(match);
  const pick = (sym: string) => {
    opt.selectUnderlying(sym);
    onPick?.(sym);
  };
  const th = "sticky top-0 z-[1] h-6 border-b border-line bg-panel-2 text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line p-1.5">
        <label className={cn("flex items-center gap-1.5 rounded-[6px] border border-line bg-surface-2 px-2 focus-within:border-ember/50", mobile ? "h-9" : "h-7")}>
          <Search className="size-3.5 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("trader.opt.searchUnderlying")} aria-label={t("trader.opt.searchUnderlying")} className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-3", mobile ? "text-[13px]" : "text-[12px]")} />
        </label>
      </div>
      <div ref={box} className="t-scroll min-h-0 flex-1 overflow-y-auto">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col />
            <col className={mobile ? "w-[86px]" : "w-[70px]"} />
            {!narrow && <col className={mobile ? "w-[64px]" : "w-[56px]"} />}
            {showIv && <col className={mobile ? "w-[56px]" : "w-[46px]"} />}
          </colgroup>
          <thead>
            <tr>
              <th className={cn(th, "ps-2 text-start")}>{t("market.col.symbol")}</th>
              <th className={cn(th, "pe-1.5 text-end")}>{t("trader.opt.spot")}</th>
              {!narrow && <th className={cn(th, "pe-1.5 text-end")}>{t("market.col.change")}</th>}
              {showIv && (
                <th className={cn(th, "pe-2 text-end")} title={t("trader.opt.atmIvHint")}>
                  {t("trader.opt.col.iv")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((c) => {
              const rows = shown.filter((x) => x.listed && x.assetClass === c);
              if (!rows.length) return null;
              return (
                <React.Fragment key={c}>
                  <tr aria-hidden>
                    <td colSpan={span} className="h-7 border-b border-line/50 bg-panel-2/50 ps-2.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                      {t(CLASS_KEY[c])}
                    </td>
                  </tr>
                  {rows.map((x) => (
                    <Row key={x.symbol} it={x} active={x.symbol === u} narrow={narrow} liveIv={liveIv} mobile={mobile} onPick={() => pick(x.symbol)} showIv={showIv} />
                  ))}
                </React.Fragment>
              );
            })}
            {shown.some((x) => !x.listed) && (
              <>
                <tr aria-hidden>
                  <td colSpan={span} className="h-7 border-b border-line/50 bg-panel-2/50 ps-2.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
                    {t("trader.opt.comingSoon")}
                  </td>
                </tr>
                {shown
                  .filter((x) => !x.listed)
                  .map((x) => (
                    <Row key={x.symbol} it={x} active={false} narrow={narrow} liveIv={null} mobile={mobile} onPick={() => {}} showIv={showIv} />
                  ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The left panel in Options mode (Market Watch's place, size and collapse button). */

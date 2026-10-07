"use client";

// The order-book column in Options mode (docs/TERMINAL-DESIGN.md §2.2): the selected option's book and trades while
// the options order book is live; otherwise the underlying's spot depth and ticks, labelled as such. Same BookView as
// the CFD depth. A click on an option level fills the ticket (an offer → Buy, a bid → Sell, as in the chain's book).
import * as React from "react";
import { INSTRUMENT_MAP } from "@kalks/mock";
import { parseSeriesCode } from "@kalks/mock/options";
import { useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { EmptyState } from "@/components/ui/kit";
import { BookView, CfdOrderBook, TickTape, type BookLevel } from "@/components/order/order-book";
import { opt, useBookLive, useOpt, useSeriesQuote } from "@/lib/options-store";
import { useBookOrders } from "@/lib/options/book-orders";
import type { DepthLevel } from "@/lib/options/types";
import { useSeriesUnits, qty } from "./book-bits";
import { TradeTape } from "./depth";
import { usd } from "./format";
import { BookOpenText } from "lucide-react";

const EMPTY: DepthLevel[] = [];

function SeriesBook({ code }: { code: string }) {
  const t = useT();
  const T = useTerminal();
  const live = useBookLive();
  const depth = useOpt((s) => s.depth[code]);
  const units = useSeriesUnits(code);
  const q = useSeriesQuote(code);
  const orders = useBookOrders(T.guest ? null : T.account.login, live);
  const interactive = useOpt((s) => !s.publicView && !s.ctx?.publicPage);
  const mine = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders.open) if (o.series === code && o.price !== null && !o.trigger && o.left > 0) m.set(`${o.side === "buy" ? "b" : "a"}${Math.round(o.price / units.tick)}`, o.left);
    return m;
  }, [orders.open, code, units.tick]);
  const map = (levels: DepthLevel[], side: "a" | "b"): BookLevel[] => levels.slice(0, 14).map((l) => ({ price: l.price, size: l.qty, mine: mine.get(`${side}${Math.round(l.price / units.tick)}`) ?? 0 }));
  const asks = map(depth?.asks ?? EMPTY, "a");
  const bids = map(depth?.bids ?? EMPTY, "b");
  const midUnit = q && q.bid > 0 && q.ask > 0 ? (q.bid + q.ask) / 2 : (q?.markUsd ?? 0) / (units.k || 1);
  const spread = q && q.bid > 0 && q.ask > 0 ? usd(q.askUsd - q.bidUsd) : null;
  return (
    <BookView
      asks={asks}
      bids={bids}
      fmtP={(p) => usd(p * units.k)}
      fmtS={(s) => qty(s)}
      mid={midUnit ? { text: usd(midUnit * units.k), dir: (q?.change ?? 0) > 0 ? 1 : (q?.change ?? 0) < 0 ? -1 : 0 } : null}
      spread={spread}
      note={depth ? null : t("trader.opt.depth.loading")}
      onPick={interactive ? (level, price) => opt.prefillLimit(code, level === "ask" ? "buy" : "sell", price * units.k) : undefined}
      pickTitle={(level, price) => t(level === "ask" ? "trader.opt.depth.clickBuy" : "trader.opt.depth.clickSell", { price })}
      sizeLabel={t("trader.opt.depth.size")}
    />
  );
}

/** The selected option's book (or, while the options book is off, the underlying's spot depth), without a header. */
export function OptionsBookBody({ tab }: { tab: "book" | "trades" }) {
  const t = useT();
  const live = useBookLive();
  const u = useOpt((s) => s.u);
  const sel = useOpt((s) => (s.sel && parseSeriesCode(s.sel)?.underlying === s.u ? s.sel : null));
  const series = live && sel ? sel : null;
  const spot = !series && !!INSTRUMENT_MAP[u];
  return (
    <div className="flex h-full min-h-0 flex-col">
      {spot && <div className="shrink-0 px-3 pb-1 text-[11.5px] text-fg-3">{t("desk.ob.spot", { symbol: u })}</div>}
      <div className="min-h-0 flex-1">
        {series ? (
          tab === "book" ? <SeriesBook code={series} /> : <TradeTape code={series} className="h-full" />
        ) : spot ? (
          tab === "book" ? <CfdOrderBook symbol={u} /> : <TickTape symbol={u} />
        ) : (
          <EmptyState icon={<BookOpenText />} title={t("trader.opt.depth.emptyTitle")} text={t("trader.opt.depth.emptyText")} />
        )}
      </div>
    </div>
  );
}

/** Whether the options book tab shows an option's trades (book live, option selected) or the spot ticks. */
export function useOptionsTradesLabel() {
  const t = useT();
  const live = useBookLive();
  const sel = useOpt((s) => (s.sel && parseSeriesCode(s.sel)?.underlying === s.u ? s.sel : null));
  return live && sel ? t("desk.ob.trades") : t("desk.ob.ticks");
}

"use client";

// "Watchlists" section of the dashboard: a named list of instruments with their live price and today's move, picked
// from a small dropdown that opens on "Popular". The lists are built from the instrument table rather than stored per
// client: the reference shows a read-only shortcut into Markets, so there is nothing to persist yet.
// Prices come from the shared feed, so the rows go through FeedGuard — a live build never shows simulated numbers.

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button, Delta, Menu, PriceText, SymbolAvatar, useQuotes } from "@/components/kit";
import { INSTRUMENTS, topMovers } from "@ezymex/mock";
import { FeedGuard } from "@/components/feed-guard";
import { TERMINAL_URL } from "@/lib/live";
import { useT } from "@ezymex/i18n/react";
import { SectionBar } from "./my-accounts";

type ListKey = "popular" | "gainers" | "losers";

/** The headline markets of every asset class, in the order the reference shows them. */
const POPULAR = ["EURUSD", "XAUUSD", "BTCUSD", "US30", "GBPUSD", "USOIL"];

function useList(key: ListKey) {
  return React.useMemo(() => {
    if (key === "popular") return POPULAR.map((s) => INSTRUMENTS.find((i) => i.symbol === s)).filter((i): i is (typeof INSTRUMENTS)[number] => !!i);
    return topMovers(key).slice(0, 6);
  }, [key]);
}

export function WatchlistsPanel() {
  const t = useT();
  const [key, setKey] = React.useState<ListKey>("popular");
  const list = useList(key);
  const qs = useQuotes(list.map((i) => i.symbol));
  const labels: Record<ListKey, string> = {
    popular: t("dashboard.home.watchlistPopular"),
    gainers: t("dashboard.movers.gainers"),
    losers: t("dashboard.movers.losers"),
  };
  return (
    <section className="min-w-0">
      <SectionBar
        title={t("dashboard.home.watchlists")}
        note={t("dashboard.home.watchlistCount", { count: list.length })}
        action={
          <Menu
            align="end"
            width={180}
            trigger={
              <Button size="sm" variant="surface">
                {labels[key]} <ChevronDown />
              </Button>
            }
            items={(["popular", "gainers", "losers"] as ListKey[]).map((k) => ({ label: labels[k], onSelect: () => setKey(k) }))}
          />
        }
      />
      <FeedGuard minHeight={180}>
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((i) => {
            const q = qs[i.symbol];
            return (
              <a key={i.symbol} href={`${TERMINAL_URL}/?symbol=${i.symbol}`} target="_blank" rel="noopener" className="k-row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-3">
                <SymbolAvatar symbol={i.symbol} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-fg">{i.symbol}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{i.name}</div>
                </div>
                <div className="shrink-0 text-end">
                  {q && <PriceText symbol={i.symbol} value={q.bid} dir={q.dir} className="text-[13px]" />}
                  <div className="mt-0.5">{q ? <Delta value={q.change} className="text-[11.5px]" /> : <span className="text-[11.5px] text-fg-3">—</span>}</div>
                </div>
              </a>
            );
          })}
        </div>
      </FeedGuard>
    </section>
  );
}

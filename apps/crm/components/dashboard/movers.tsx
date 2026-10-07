"use client";

import * as React from "react";
import { CardHeader, Card, Delta, ListRow, PriceText, Segmented, SymbolAvatar, Sparkline, useCloses, useFeedMode, useQuotes } from "@/components/kit";
import { INSTRUMENTS, fetchCandles, sparkline, topMovers, type Quote } from "@kalks/mock";
import { TERMINAL_URL } from "@/lib/live";
import { useT } from "@kalks/i18n/react";

// Top movers card, shared by the live and the demo dashboard (its own module so live builds don't load the demo one).

/** One mover: real closes for the range (1D: M30, 1W: H4, 1M: D1); 1W/1M change is measured on them. */
function MoverRow({ symbol, name, range, q }: { symbol: string; name: string; range: "1D" | "1W" | "1M"; q: Quote }) {
  const [tf, n] = range === "1D" ? ["M30", 48] : range === "1W" ? ["H4", 42] : ["D1", 22];
  const real = useCloses(symbol, tf, n);
  // live: only real numbers (closes are raw last prices, so compare with the last price); the seeded
  // series is a fallback for the offline simulator only
  const sim = useFeedMode() !== "live";
  const px = q.last ?? q.bid;
  const ch = range === "1D" ? q.change : real ? ((px - real[0]!) / real[0]!) * 100 : sim ? q.change * (range === "1W" ? 2.4 : 5.1) : null;
  const data = React.useMemo(() => real ?? (sim ? sparkline(symbol + range, 24, (ch ?? 0) / 100 / 24) : null), [real, sim, symbol, range, ch]);
  return (
    <ListRow target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}`} className="py-2.5">
      <SymbolAvatar symbol={symbol} size={26} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{symbol}</div>
        <div className="truncate text-[11.5px] text-fg-3">{name}</div>
      </div>
      {/* the line takes the colour of the change shown next to it (1D: since the daily open, not the rolling 24 h window it draws) */}
      {data ? <Sparkline data={data} width={64} height={24} tone={(ch ?? data[data.length - 1]! - data[0]!) >= 0 ? "up" : "down"} className="hidden sm:block" /> : <div className="hidden h-6 w-16 sm:block" />}
      <div className="w-24 text-end">
        <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[13px]" />
        <div className="mt-0.5">
          {ch === null ? <span className="text-[11.5px] text-fg-3">—</span> : <Delta value={ch} className="text-[11.5px]" />}
        </div>
      </div>
    </ListRow>
  );
}

const RANGE_BARS = { "1W": ["H4", 42], "1M": ["D1", 22] } as const;
const rangeCache = new Map<string, Promise<number | null>>();

/** % change over 1W / 1M for every listed symbol, from the same closes the rows draw (null until loaded). */
function useRangeChanges(range: "1D" | "1W" | "1M"): Record<string, number> | null {
  const mode = useFeedMode();
  const [v, setV] = React.useState<{ range: string; ch: Record<string, number> } | null>(null);
  React.useEffect(() => {
    if (range === "1D" || mode !== "live") return;
    let alive = true;
    const [tf, n] = RANGE_BARS[range];
    const symbols = INSTRUMENTS.map((i) => i.symbol);
    void Promise.all(
      symbols.map((s) => {
        const key = `${s}|${tf}|${n}`;
        let p = rangeCache.get(key);
        if (!p) {
          p = fetchCandles(s, tf, n).then((b) => (b && b.length > 1 ? ((b[b.length - 1]!.close - b[0]!.close) / b[0]!.close) * 100 : null));
          rangeCache.set(key, p);
        }
        return p;
      }),
    ).then((res) => {
      if (!alive) return;
      const ch: Record<string, number> = {};
      res.forEach((c, i) => c !== null && (ch[symbols[i]!] = c));
      setV({ range, ch });
    });
    return () => {
      alive = false;
    };
  }, [range, mode]);
  return v && v.range === range ? v.ch : null;
}

export function MoversCard() {
  const [dir, setDir] = React.useState<"gainers" | "losers">("gainers");
  const [range, setRange] = React.useState<"1D" | "1W" | "1M">("1D");
  // 1D ranks by today's live change; 1W / 1M rank by the change over that range (not today's)
  const rangeCh = useRangeChanges(range);
  let list = topMovers(dir).slice(0, 6);
  if (range !== "1D" && rangeCh) {
    const ranked = INSTRUMENTS.filter((i) => rangeCh[i.symbol] !== undefined).sort((x, y) => rangeCh[y.symbol]! - rangeCh[x.symbol]!);
    list = (dir === "gainers" ? ranked : ranked.reverse()).slice(0, 6);
  }
  const t = useT();
  const qs = useQuotes(list.map((i) => i.symbol));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.movers.title")}
        action={<Segmented size="xs" value={range} onChange={setRange} options={["1D", "1W", "1M"] as const} />}
      />
      <div className="px-6 pt-3">
        <Segmented size="xs" value={dir} onChange={setDir} options={[{ value: "gainers", label: t("dashboard.movers.gainers") }, { value: "losers", label: t("dashboard.movers.losers") }]} />
      </div>
      <div className="k-fade-bottom mt-3 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {list.map((i) => (
          <MoverRow key={i.symbol} symbol={i.symbol} name={i.name} range={range} q={qs[i.symbol]!} />
        ))}
      </div>
    </Card>
  );
}

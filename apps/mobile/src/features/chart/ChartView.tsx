// Chart data layer: history from market-data (cached per symbol / timeframe, prefetched from the watchlist),
// the forming bar from the quote stream, older pages when the user scrolls back, the tail merged after a
// reconnect, indicators and position lines. It hands shared values to SkiaChart, so after the first frame no
// price, pan or zoom goes through React.
import * as React from "react";
import { AppState, View } from "react-native";
import { makeMutable } from "react-native-reanimated";
import { useQuery } from "@/lib/query";
import { useOnline } from "@/lib/net";
import { feed } from "@/market/feed";
import { useT } from "@/i18n";
import { EmptyState, Skeleton } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { useTrade } from "../trading/live";
import { candlesKey, fetchCandles, serverOffset, TF_SECONDS, toChartTime, type Candle, type Timeframe } from "./data";
import { computeSeries, EMPTY_SERIES, type IndicatorKey } from "./indicators";
import { LINE, SkiaChart, type ChartType } from "./SkiaChart";

const PAGE = 600;
const DEFAULT_W = 9;

/** Chart time -> UTC seconds (inverse of toChartTime, DST-aware). */
function fromChartTime(chart: number): number {
  const summer = chart - 3 * 3600;
  return summer + serverOffset(summer) === chart ? summer : chart - 2 * 3600;
}

function flatten(list: Candle[]): number[] {
  const out = new Array<number>(list.length * 5);
  for (let i = 0; i < list.length; i++) {
    const c = list[i]!;
    out[i * 5] = c.t;
    out[i * 5 + 1] = c.o;
    out[i * 5 + 2] = c.h;
    out[i * 5 + 3] = c.l;
    out[i * 5 + 4] = c.c;
  }
  return out;
}

export type ChartViewProps = { symbol: string; tf: Timeframe; digits: number; type: ChartType; indicators: IndicatorKey[] };

export function ChartView({ symbol, tf, digits, type, indicators }: ChartViewProps) {
  const t = useT();
  const online = useOnline();
  const key = candlesKey(symbol, tf);
  const q = useQuery(key, () => fetchCandles(symbol, tf, PAGE), { staleMs: 15_000 });

  // shared values live as long as the chart; `makeMutable` keeps them out of React state
  const sv = React.useMemo(
    () => ({
      bars: makeMutable<number[]>([]),
      live: makeMutable<number[]>([]),
      closes: makeMutable<number[]>([]),
      series: makeMutable(EMPTY_SERIES),
      lines: makeMutable<number[]>([]),
      barW: makeMutable(DEFAULT_W),
      off: makeMutable(0),
    }),
    [],
  );
  const history = React.useRef<Candle[]>([]);
  const exhausted = React.useRef(false);
  const loadingOlder = React.useRef(false);
  const ready = React.useRef<string | null>(null);

  const publish = React.useCallback(() => {
    const list = history.current;
    sv.bars.value = flatten(list);
    const closes = list.map((c) => c.c);
    sv.closes.value = closes;
    sv.series.value = computeSeries(closes);
    const last = list[list.length - 1];
    if (last) sv.live.value = [last.t, last.o, last.h, last.l, last.c];
  }, [sv]);

  // a new symbol / timeframe: fresh viewport
  React.useEffect(() => {
    history.current = [];
    exhausted.current = false;
    ready.current = null;
    sv.bars.value = [];
    sv.live.value = [];
    sv.off.value = 0;
    sv.barW.value = DEFAULT_W;
  }, [symbol, tf, sv]);

  // history arrived (cache or network): merge with what the stream already added
  React.useEffect(() => {
    const data = q.data;
    if (!data || data.length === 0) return;
    const cur = history.current;
    if (ready.current !== key || cur.length === 0) {
      history.current = data.slice();
      ready.current = key;
    } else {
      // refreshed tail: replace from the first fresh bar on, keep older pages
      const from = data[0]!.t;
      let i = cur.length;
      while (i > 0 && cur[i - 1]!.t >= from) i--;
      history.current = [...cur.slice(0, i), ...data];
    }
    publish();
  }, [q.data, key, publish]);

  // the forming bar from the quote stream (same candle as stored); a new bar keeps a scrolled-back view steady
  React.useEffect(() => {
    return feed.subscribeBars(symbol, tf, (b) => {
      const list = history.current;
      if (!list.length) return;
      const bar: Candle = { t: toChartTime(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v };
      const last = list[list.length - 1]!;
      if (bar.t < last.t) return;
      if (bar.t > last.t) {
        list.push(bar);
        if (sv.off.value > 0.5) sv.off.value = sv.off.value + 1;
        publish();
      } else {
        list[list.length - 1] = bar;
        sv.live.value = [bar.t, bar.o, bar.h, bar.l, bar.c];
      }
    });
  }, [symbol, tf, publish, sv]);

  // back from the background: bring the tail up to date
  const refresh = q.refresh;
  React.useEffect(() => {
    let hiddenAt = 0;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5000) void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const onNeedOlder = React.useCallback(() => {
    if (exhausted.current || loadingOlder.current || !history.current.length) return;
    loadingOlder.current = true;
    const first = history.current[0]!.t;
    void fetchCandles(symbol, tf, PAGE, fromChartTime(first) - 1).then((r) => {
      loadingOlder.current = false;
      if (ready.current !== key) return;
      const older = r.ok ? r.data.filter((c) => c.t < first) : [];
      if (!older.length) {
        exhausted.current = r.ok;
        return;
      }
      history.current = [...older, ...history.current];
      publish();
    });
  }, [symbol, tf, key, publish]);

  // positions and pending orders of the active account on this symbol
  const positions = useTrade((s) => s.positions);
  const orders = useTrade((s) => s.orders);
  React.useEffect(() => {
    const out: number[] = [];
    for (const p of positions) {
      if (p.symbol !== symbol) continue;
      out.push(p.openPrice, p.side === "buy" ? LINE.buy : LINE.sell);
      if (p.sl) out.push(p.sl, LINE.sl);
      if (p.tp) out.push(p.tp, LINE.tp);
    }
    for (const o of orders) if (o.symbol === symbol) out.push(o.price, o.side === "buy" ? LINE.pendingBuy : LINE.pendingSell);
    sv.lines.value = out.slice(0, 24);
  }, [positions, orders, symbol, sv]);

  const quote = feed.sv(symbol);
  const hasData = (q.data?.length ?? 0) > 0;

  return (
    <View style={{ flex: 1 }}>
      {hasData ? (
        <SkiaChart
          bars={sv.bars}
          live={sv.live}
          closes={sv.closes}
          series={sv.series}
          bid={quote.bid}
          ask={quote.ask}
          lines={sv.lines}
          barW={sv.barW}
          off={sv.off}
          digits={digits}
          type={type}
          indicators={indicators}
          step={TF_SECONDS[tf]}
          onNeedOlder={onNeedOlder}
        />
      ) : q.error && !q.fetching ? (
        <EmptyState illustration="connectionLost" size={170} title={online ? t("mobile.state.error.title") : t("mobile.state.offline.title")} body={online ? t("mobile.state.error.body") : t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void q.refresh()} style={{ flex: 1, justifyContent: "center", paddingVertical: space[4] }} />
      ) : (
        <ChartSkeleton />
      )}
    </View>
  );
}

/** Static placeholder shaped like a chart (no shimmer loop). */
function ChartSkeleton() {
  const heights = [40, 62, 48, 80, 70, 96, 84, 110, 92, 76, 104, 128, 116, 98, 122, 140, 126, 150, 134, 118];
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: space[5], paddingBottom: 28, paddingEnd: 70 }} accessibilityLabel="Loading chart">
      {heights.map((h, i) => (
        <Skeleton key={i} w={8} h={h} r={3} style={{ backgroundColor: colors.surface2 }} />
      ))}
    </View>
  );
}

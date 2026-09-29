// Trade tab: symbol header with the live price, timeframes, the Skia chart, and the one-tap Sell / Buy bar that
// opens the order ticket. Depth of market and price alerts open from the header.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { Bell, ChevronDown, Layers, Minus, Plus, SlidersHorizontal } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtPrice } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { kv } from "@/lib/kv";
import { feed } from "@/market/feed";
import { instrument, instruments, type Instrument } from "@/market/instruments";
import { useSession } from "@/session";
import { ChangeText, Display, EmptyState, IconButton, Mono, PressableScale, PriceCell, Screen, Sheet, Skeleton, Text, useBottomInset, useLiveQuote, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { ChartLazy } from "../chart/ChartLazy";
import { prefetchCandles, TIMEFRAMES, type Timeframe } from "../chart/data";
import type { IndicatorKey } from "../chart/indicators";
import { setChartType, toggleIndicator, useChartType, useIndicators } from "../chart/settings";
import { AccountChip, AccountSheet } from "../trading/AccountSwitcher";
import { useAccounts } from "../trading/accounts";
import { useTrade } from "../trading/live";
import { clampLots, useSpec, useSpecs } from "../trading/specs";
import { OrderSheet, type OrderSheetHandle } from "./OrderSheet";
import { setTradeSymbol, setTradeTf, useTradeSymbol, useTradeTf } from "./symbol";

const VOL_KEY = "kalks.tradeVolume";
const volumes = kv.getJSON<Record<string, number>>(VOL_KEY) ?? {};

export function TradeScreen() {
  const t = useT();
  const router = useRouter();
  const symbol = useTradeSymbol();
  const tf = useTradeTf();
  const inst = instrument(symbol);
  const type = useChartType();
  const indicators = useIndicators();
  const viewer = useSession((s) => !!s.viewer);
  const accounts = useAccounts();
  useSpecs();
  const spec = useSpec(symbol);
  const status = useTrade((s) => s.status);
  const bottom = useBottomInset();
  const [volume, setVolume] = React.useState(() => volumes[symbol] ?? 0.01);
  React.useEffect(() => setVolume(clampLots(spec, volumes[symbol] ?? spec?.lotMin ?? 0.01)), [symbol, spec]);
  const saveVolume = React.useCallback((s: string, v: number) => {
    volumes[s] = v;
    kv.setJSON(VOL_KEY, volumes);
  }, []);

  const ticket = React.useRef<OrderSheetHandle>(null);
  const symbolSheet = React.useRef<SheetRef>(null);
  const indSheet = React.useRef<SheetRef>(null);
  const accSheet = React.useRef<SheetRef>(null);

  const noAccount = accounts.data && accounts.data.accounts.length === 0;
  const canTrade = !viewer && !noAccount;
  const openTicket = (side: "buy" | "sell") => {
    haptic.tap();
    ticket.current?.open({ symbol, side, volume });
  };

  return (
    <Screen scroll={false}>
      {/* header */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2], gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <PressableScale onPress={() => symbolSheet.current?.present()} haptics="select" accessibilityLabel={t("mobileTrade.pickSymbol")} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }}>
            <Display size="lg">{symbol}</Display>
            <ChevronDown size={20} color={colors.text3} />
          </PressableScale>
          <View style={{ flex: 1 }} />
          <IconButton accessibilityLabel={t("mobileTrade.alert")} icon={<Bell size={19} color={colors.text} />} onPress={() => router.push({ pathname: "/alerts", params: { symbol } })} />
          <IconButton accessibilityLabel={t("mobileTrade.depth")} icon={<Layers size={19} color={colors.text} />} onPress={() => router.push(`/depth/${symbol}`)} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <QuoteStrip symbol={symbol} digits={inst.digits} />
          </View>
          {canTrade ? <AccountChip onPress={() => accSheet.current?.present()} /> : null}
        </View>
      </View>

      {/* timeframes + chart controls */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingStart: GUTTER, paddingEnd: space[3], marginTop: space[3], gap: space[2] }}>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
          {TIMEFRAMES.map((k) => (
            <PressableScale
              key={k}
              onPress={() => setTradeTf(k)}
              onPressIn={() => prefetchCandles(symbol, k)}
              haptics="select"
              accessibilityRole="tab"
              accessibilityState={{ selected: tf === k }}
              style={{ minWidth: 34, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: tf === k ? colors.cream : "transparent" }}
            >
              <Mono size={11.5} weight="bold" color={tf === k ? colors.ink : colors.text3}>
                {k}
              </Mono>
            </PressableScale>
          ))}
        </View>
        <IconButton size={36} tone="ghost" accessibilityLabel={t("mobileTrade.chart.indicators")} icon={<SlidersHorizontal size={18} color={colors.text2} />} onPress={() => indSheet.current?.present()} />
      </View>

      {/* chart */}
      <View style={{ flex: 1, marginTop: space[2] }}>
        <ChartLazy symbol={symbol} tf={tf} digits={inst.digits} type={type} indicators={indicators} fallback={<Skeleton h={400} r={0} style={{ flex: 1 }} />} />
        {status === "connecting" && canTrade ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 4, start: GUTTER }}>
            <Text variant="caption" tone="tertiary">
              {t("mobileTrade.state.connecting")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Sell / volume / Buy */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: bottom - space[2] }}>
        {noAccount ? (
          <EmptyState title={t("mobileTrade.state.noAccount.title")} body={t("mobileTrade.state.noAccount.body")} action={t("mobileTrade.state.noAccount.action")} onAction={() => router.push("/accounts/new")} style={{ paddingVertical: space[2] }} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "stretch", gap: space[2] }}>
            <TradeButton side="sell" symbol={symbol} digits={inst.digits} disabled={!canTrade} onPress={() => openTicket("sell")} />
            <View style={{ width: 92, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text variant="label" tone="tertiary" style={{ fontSize: 9.5 }}>
                {t("mobileTrade.bar.volume")}
              </Text>
              <Mono size={15} weight="bold">
                {fmtLots(volume)}
              </Mono>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <PressableScale onPress={() => setVolume((v) => clampLots(spec, v - (spec?.lotStep ?? 0.01)))} haptics="select" accessibilityLabel={`${t("mobileTrade.bar.volume")} −`} style={{ width: 36, height: 26, borderRadius: 8, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
                  <Minus size={14} color={colors.text} />
                </PressableScale>
                <PressableScale onPress={() => setVolume((v) => clampLots(spec, v + (spec?.lotStep ?? 0.01)))} haptics="select" accessibilityLabel={`${t("mobileTrade.bar.volume")} +`} style={{ width: 36, height: 26, borderRadius: 8, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
                  <Plus size={14} color={colors.text} />
                </PressableScale>
              </View>
            </View>
            <TradeButton side="buy" symbol={symbol} digits={inst.digits} disabled={!canTrade} onPress={() => openTicket("buy")} />
          </View>
        )}
      </View>

      <OrderSheet ref={ticket} onVolume={saveVolume} />
      <AccountSheet ref={accSheet} />
      <SymbolSheet ref={symbolSheet} />
      <IndicatorsSheet ref={indSheet} type={type} indicators={indicators} />
    </Screen>
  );
}

function QuoteStrip({ symbol, digits }: { symbol: string; digits: number }) {
  const t = useT();
  const q = useLiveQuote(symbol);
  return (
    <View style={{ gap: 2 }} accessibilityLabel={q ? `${symbol} ${fmtPrice(q.bid, digits)}` : symbol}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
        <Mono size={22} weight="bold">
          {q ? fmtPrice(q.bid, digits) : "—"}
        </Mono>
        <ChangeText symbol={symbol} size={13} />
      </View>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {q ? `${t("market.tip.high")} ${fmtPrice(q.high, digits)}  ${t("market.tip.low")} ${fmtPrice(q.low, digits)}` : " "}
      </Text>
    </View>
  );
}

const TradeButton = React.memo(function TradeButton({ side, symbol, digits, disabled, onPress }: { side: "buy" | "sell"; symbol: string; digits: number; disabled?: boolean; onPress: () => void }) {
  const t = useT();
  const buy = side === "buy";
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={t(buy ? "common.buy" : "common.sell")}
      testID={buy ? "bar-buy" : "bar-sell"}
      style={{ flex: 1, height: 76, borderRadius: radius.lg, backgroundColor: buy ? colors.up : colors.down, paddingHorizontal: space[3], justifyContent: "center", alignItems: buy ? "flex-end" : "flex-start" }}
    >
      <Text variant="label" color={buy ? colors.ink : colors.text}>
        {t(buy ? "common.buy" : "common.sell")}
      </Text>
      <PriceCell symbol={symbol} side={buy ? "ask" : "bid"} digits={digits} size={19} align={buy ? "right" : "left"} style={{ paddingHorizontal: 0, backgroundColor: "transparent" }} />
    </PressableScale>
  );
});

const SymbolSheet = React.forwardRef<SheetRef>(function SymbolSheet(_, ref) {
  const t = useT();
  const current = useTradeSymbol();
  const list = React.useMemo(() => instruments().filter((i) => feed.available.size === 0 || feed.available.has(i.symbol)), []);
  const dismiss = () => (ref && typeof ref !== "function" ? ref.current?.dismiss() : undefined);
  return (
    <Sheet ref={ref} enableDynamicSizing={false} snapPoints={["75%"]} scroll>
      <BottomSheetFlatList
        data={list}
        keyExtractor={(i: Instrument) => i.symbol}
        contentContainerStyle={{ paddingBottom: space[10] }}
        ListHeaderComponent={
          <Display size="md" style={{ paddingHorizontal: GUTTER, marginBottom: space[2] }}>
            {t("mobileTrade.pickSymbol")}
          </Display>
        }
        renderItem={({ item }: { item: Instrument }) => (
          <PressableScale
            onPress={() => {
              haptic.select();
              setTradeSymbol(item.symbol);
              dismiss();
            }}
            onPressIn={() => prefetchCandles(item.symbol, "M15")}
            scaleTo={0.985}
            accessibilityState={{ selected: item.symbol === current }}
            style={{ height: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER, gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: item.symbol === current ? colors.surface2 : "transparent" }}
          >
            <View style={{ flex: 1 }}>
              <Text weight="700">{item.symbol}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <PriceCell symbol={item.symbol} side="bid" digits={item.digits} size={15} style={{ width: 100 }} />
          </PressableScale>
        )}
      />
    </Sheet>
  );
});

const IND_KEYS: { key: IndicatorKey; label: "mobileTrade.ind.ma" | "mobileTrade.ind.ema" | "mobileTrade.ind.bb" | "mobileTrade.ind.rsi"; color: string }[] = [
  { key: "ma", label: "mobileTrade.ind.ma", color: colors.gold },
  { key: "ema", label: "mobileTrade.ind.ema", color: colors.mint },
  { key: "bb", label: "mobileTrade.ind.bb", color: colors.periwinkle },
  { key: "rsi", label: "mobileTrade.ind.rsi", color: colors.periwinkle },
];

const IndicatorsSheet = React.forwardRef<SheetRef, { type: "candles" | "line"; indicators: IndicatorKey[] }>(function IndicatorsSheet({ type, indicators }, ref) {
  const t = useT();
  return (
    <Sheet ref={ref}>
      <Display size="md" style={{ marginBottom: space[4] }}>
        {t("mobileTrade.chart.indicators")}
      </Display>
      <View style={{ flexDirection: "row", gap: space[2], marginBottom: space[4] }}>
        {(["candles", "line"] as const).map((k) => (
          <PressableScale key={k} onPress={() => setChartType(k)} haptics="select" accessibilityState={{ selected: type === k }} style={{ flex: 1, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: type === k ? colors.cream : colors.surface2 }}>
            <Text weight="700" color={type === k ? colors.ink : colors.text2}>
              {t(k === "candles" ? "mobileTrade.chart.type.candles" : "mobileTrade.chart.type.line")}
            </Text>
          </PressableScale>
        ))}
      </View>
      <View style={{ gap: space[2] }}>
        {IND_KEYS.map((it) => {
          const on = indicators.includes(it.key);
          return (
            <PressableScale key={it.key} onPress={() => toggleIndicator(it.key)} haptics="select" accessibilityRole="switch" accessibilityState={{ checked: on }} style={{ height: 56, borderRadius: radius.md, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[3] }}>
              <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: it.color }} />
              <Text weight="600" style={{ flex: 1 }}>
                {t(it.label)}
              </Text>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: on ? colors.ember : colors.surface3, padding: 3, alignItems: on ? "flex-end" : "flex-start" }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.cream }} />
              </View>
            </PressableScale>
          );
        })}
      </View>
      <Text variant="caption" tone="tertiary" style={{ marginTop: space[4] }}>
        {t("mobileTrade.chart.hint")}
      </Text>
    </Sheet>
  );
});

export type { Timeframe };

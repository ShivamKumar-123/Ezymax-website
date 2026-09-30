// Trade tab: symbol header with the live price, timeframes, the Skia chart, and the one-tap Sell / Buy bar that
// opens the order ticket. Depth of market and price alerts open from the header.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useIsFocused, useRouter } from "expo-router";
import { Bell, ChevronDown, Layers, Minus, Plus, Search, SlidersHorizontal } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtPrice } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { kv } from "@/lib/kv";
import { feed } from "@/market/feed";
import { instrument, instruments, type Instrument } from "@/market/instruments";
import { useSession } from "@/session";
import { Banner, Button, ChangeText, Display, IconButton, Illustration, Mono, PressableScale, PriceCell, Screen, Sheet, SheetTextInput, Skeleton, Text, NO_WEB_OUTLINE, useBottomInset, useLiveQuote, type SheetRef } from "@/ui";
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
  // while the tab is on screen, the contract specs refresh every minute (the market-closed notice follows them)
  const focused = useIsFocused();
  useSpecs({ live: focused });
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
  const stepVolume = (dir: 1 | -1) => {
    const next = clampLots(spec, volume + dir * (spec?.lotStep ?? 0.01));
    setVolume(next);
    saveVolume(symbol, next);
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
        {/* bid + account chip, then the day's change and range on their own line (fits a 360 pt phone) */}
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <LiveBid symbol={symbol} digits={inst.digits} />
            </View>
            {canTrade ? <AccountChip onPress={() => accSheet.current?.present()} /> : null}
          </View>
          <DayRange symbol={symbol} digits={inst.digits} />
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
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: bottom - space[2], gap: space[3] }}>
        {spec && !spec.open && !noAccount ? <Banner tone="info" title={t("mobileTrade.state.marketClosed.title")} body={t("mobileTrade.state.marketClosed.body", { symbol })} /> : null}
        {noAccount ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], padding: space[4], borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            <Illustration name="welcome" width={64} height={88} />
            <View style={{ flex: 1, gap: space[2] }}>
              <Text variant="headline" weight="700">
                {t("mobileTrade.state.noAccount.title")}
              </Text>
              <Text variant="caption" tone="secondary">
                {t("mobileTrade.state.noAccount.body")}
              </Text>
              <Button label={t("mobileTrade.state.noAccount.action")} size="sm" full={false} onPress={() => router.push("/accounts/new")} />
            </View>
          </View>
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
                <PressableScale onPress={() => stepVolume(-1)} haptics="select" accessibilityLabel={`${t("mobileTrade.bar.volume")} −`} style={{ width: 36, height: 26, borderRadius: 8, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
                  <Minus size={14} color={colors.text} />
                </PressableScale>
                <PressableScale onPress={() => stepVolume(1)} haptics="select" accessibilityLabel={`${t("mobileTrade.bar.volume")} +`} style={{ width: 36, height: 26, borderRadius: 8, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
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

/** The live bid (a leaf: a tick re-renders only this text). */
function LiveBid({ symbol, digits }: { symbol: string; digits: number }) {
  const q = useLiveQuote(symbol);
  return (
    <Mono size={22} weight="bold" numberOfLines={1} accessibilityLabel={q ? `${symbol} ${fmtPrice(q.bid, digits)}` : symbol}>
      {q ? fmtPrice(q.bid, digits) : "—"}
    </Mono>
  );
}

/** The day's change and high / low (a leaf). */
function DayRange({ symbol, digits }: { symbol: string; digits: number }) {
  const t = useT();
  const q = useLiveQuote(symbol);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <ChangeText symbol={symbol} size={12.5} />
      <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
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
      {/* ink on both: light text on the web palette's green / red is under 4.5:1 */}
      <Text variant="label" color={colors.ink}>
        {t(buy ? "common.buy" : "common.sell")}
      </Text>
      <PriceCell symbol={symbol} side={buy ? "ask" : "bid"} digits={digits} size={19} align={buy ? "right" : "left"} flash={false} color={colors.ink} style={{ paddingHorizontal: 0 }} />
    </PressableScale>
  );
});

const SymbolSheet = React.forwardRef<SheetRef>(function SymbolSheet(_, ref) {
  const t = useT();
  const current = useTradeSymbol();
  const [q, setQ] = React.useState("");
  const all = React.useMemo(() => instruments().filter((i) => feed.available.size === 0 || feed.available.has(i.symbol)), []);
  const list = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? all.filter((i) => i.symbol.toLowerCase().includes(s) || i.name.toLowerCase().includes(s)) : all;
  }, [all, q]);
  const dismiss = () => (ref && typeof ref !== "function" ? ref.current?.dismiss() : undefined);
  return (
    <Sheet ref={ref} enableDynamicSizing={false} snapPoints={["75%"]} scroll onDismiss={() => setQ("")}>
      <BottomSheetFlatList
        data={list}
        keyExtractor={(i: Instrument) => i.symbol}
        contentContainerStyle={{ paddingBottom: space[10] }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: GUTTER, marginBottom: space[2], gap: space[3] }}>
            <Display size="md">{t("mobileTrade.pickSymbol")}</Display>
            <View style={{ height: 44, borderRadius: radius.pill, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[2] }}>
              <Search size={17} color={colors.text3} />
              <SheetTextInput
                value={q}
                onChangeText={setQ}
                placeholder={t("mobileTrade.searchSymbol")}
                placeholderTextColor={colors.text3}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t("mobileTrade.searchSymbol")}
                selectionColor={colors.ember}
                style={[{ flex: 1, color: colors.text, fontSize: 16, height: "100%" }, NO_WEB_OUTLINE]}
              />
            </View>
          </View>
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

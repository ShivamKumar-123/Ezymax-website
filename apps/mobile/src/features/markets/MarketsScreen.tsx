// Markets: segments (favourites, forex, metals, indices, energies, crypto, stocks), search, live Bid / Ask with a
// tick flash. Tap opens the chart (candles are prefetched on press-in); press and hold toggles a favourite.
import * as React from "react";
import { RefreshControl, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { useStore } from "@/lib/store";
import { feed, feedStatus } from "@/market/feed";
import { instruments, loadInstruments, onInstruments, SEGMENTS, type Instrument, type Segment } from "@/market/instruments";
import { EmptyState, IconButton, NO_WEB_OUTLINE, PillRow, PressableScale, Screen, ScreenHeader, SkeletonRows, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { prefetchCandles } from "../chart/data";
import { setTradeSymbol, tradeSymbolStore } from "../trade/symbol";
import { toggleFavourite, useFavourites } from "./favourites";
import { MarketRow, ROW_HEIGHT } from "./MarketRow";

type Seg = "favourites" | Segment;
const SEG_KEYS: Record<Seg, MessageKey> = {
  favourites: "market.segment.favourites",
  forex: "market.segment.forex",
  metals: "market.segment.metals",
  indices: "market.segment.indices",
  energies: "market.segment.energies",
  crypto: "market.segment.crypto",
  stocks: "market.segment.stocks",
};

/** Instruments with prices (symbols the service has no provider for are hidden, like the web). */
function useInstruments(): Instrument[] {
  const [list, setList] = React.useState(() => instruments());
  React.useEffect(() => {
    const refresh = () => setList(instruments().filter((i) => feed.available.size === 0 || feed.available.has(i.symbol)));
    refresh();
    const a = onInstruments(refresh);
    const b = feed.onSnapshot(refresh);
    return () => {
      a();
      b();
    };
  }, []);
  return list;
}

export function MarketsScreen() {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const status = useStore(feedStatus, (s) => s.status);
  const all = useInstruments();
  const favs = useFavourites();
  const [seg, setSeg] = React.useState<Seg>(() => "favourites");
  const [searching, setSearching] = React.useState(false);
  const [q, setQ] = React.useState("");
  const bottom = useBottomInset();

  const data = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query) return all.filter((i) => i.symbol.toLowerCase().includes(query) || i.name.toLowerCase().includes(query));
    if (seg === "favourites") return favs.map((s) => all.find((i) => i.symbol === s)).filter((i): i is Instrument => !!i);
    return all.filter((i) => i.segment === seg);
  }, [all, favs, seg, q]);

  const open = React.useCallback(
    (symbol: string) => {
      setTradeSymbol(symbol);
      router.navigate("/trade");
    },
    [router],
  );
  const warm = React.useCallback((symbol: string) => prefetchCandles(symbol, tradeSymbolStore.get().tf), []);
  const fav = React.useCallback(
    (symbol: string) => {
      const on = toggleFavourite(symbol);
      haptic.impact("light");
      toast.show({ title: t(on ? "mobileMarkets.fav.added" : "mobileMarkets.fav.removed", { symbol }) }, 1600);
    },
    [t],
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await feed.snapshot();
    setRefreshing(false);
  }, []);

  const items = React.useMemo(() => (["favourites", ...SEGMENTS] as Seg[]).map((k) => ({ key: k, label: t(SEG_KEYS[k]) })), [t]);
  const loading = all.length === 0;
  // no catalogue and no price stream after a while (the service is down): say so, with a retry
  const [stalled, setStalled] = React.useState(false);
  React.useEffect(() => {
    if (!loading || status === "live") return setStalled(false);
    const id = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(id);
  }, [loading, status]);
  const retry = React.useCallback(() => {
    setStalled(false);
    void loadInstruments();
    void feed.snapshot();
  }, []);

  const header = (
    <View style={{ backgroundColor: colors.bg }}>
      {searching ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[3], flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <View style={{ flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], gap: space[2] }}>
            <Search size={18} color={colors.text3} />
            <TextInput autoFocus value={q} onChangeText={setQ} placeholder={t("market.searchPlaceholder")} placeholderTextColor={colors.text3} selectionColor={colors.ember} autoCapitalize="characters" autoCorrect={false} accessibilityLabel={t("mobileMarkets.a11y.search")} style={[{ flex: 1, color: colors.text, fontSize: 16, height: "100%" }, NO_WEB_OUTLINE]} />
            {q ? (
              <PressableScale onPress={() => setQ("")} scaleTo={1} accessibilityLabel={t("market.clear")} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                <X size={16} color={colors.text3} />
              </PressableScale>
            ) : null}
          </View>
          <PressableScale
            onPress={() => {
              setQ("");
              setSearching(false);
            }}
            scaleTo={1}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text variant="callout" weight="600">
              {t("mobileMarkets.cancel")}
            </Text>
          </PressableScale>
        </View>
      ) : (
        <ScreenHeader eyebrow={t("mobileMarkets.eyebrow")} title={t("mobile.tab.markets")} right={<IconButton accessibilityLabel={t("mobileMarkets.a11y.search")} icon={<Search size={20} color={colors.text} />} onPress={() => setSearching(true)} />} />
      )}
      {!q ? <PillRow items={items} value={seg} onChange={setSeg} compact style={{ flexGrow: 0, marginBottom: space[2] }} /> : null}
      <View style={{ flexDirection: "row", paddingHorizontal: GUTTER, paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Text variant="label" tone="tertiary" style={{ flex: 1 }}>
          {!online ? t("mobileMarkets.status.offline") : status !== "live" ? t("mobileMarkets.status.connecting") : t("market.col.symbol")}
        </Text>
        {/* aligned to the end like the price cells (which pad their text by 6), in both directions */}
        <View style={{ width: 104, alignItems: "flex-end", paddingEnd: 6 }}>
          <Text variant="label" tone="tertiary">
            {t("market.col.bid")}
          </Text>
        </View>
        <View style={{ width: 104 + space[2], alignItems: "flex-end", paddingEnd: 6 }}>
          <Text variant="label" tone="tertiary">
            {t("market.col.ask")}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Screen scroll={false}>
      {header}
      {loading && !online ? (
        <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} />
      ) : loading && stalled ? (
        <EmptyState illustration="connectionLost" title={t("mobile.state.error.title")} body={t("mobileMarkets.status.connecting")} action={t("mobile.action.retry")} onAction={retry} />
      ) : loading ? (
        <SkeletonRows rows={9} height={ROW_HEIGHT} />
      ) : data.length === 0 ? (
        q ? (
          <EmptyState illustration="market" size={160} title={t("market.empty.noMatch")} />
        ) : (
          <EmptyState illustration="emptyWatchlist" title={t("mobileMarkets.empty.favourites.title")} body={t("mobileMarkets.empty.favourites.body")} action={t("mobileMarkets.empty.favourites.action")} onAction={() => setSeg("forex")} />
        )
      ) : (
        <FlashList
          data={data}
          keyExtractor={(i) => i.symbol}
          renderItem={({ item }) => <MarketRow inst={item} onOpen={open} onPressIn={warm} onToggleFav={fav} />}
          contentContainerStyle={{ paddingBottom: bottom }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        />
      )}
    </Screen>
  );
}

// /algo/marketplace — strategies with verified track records (closed deals from their authors' own deployments on
// Kalks, never numbers anyone typed). Browse and search (free / paid, newest / top rated / popular), house strategies
// always carry "House strategy · Operated by Kalks", my subscriptions, and my own listings when I have any
// (publishing stays on the web). One FlashList per tab; rows are fixed-height and memoised.
import * as React from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Search, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Display, EmptyState, Illustration, Mono, Pill, PressableScale, Screen, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchers, keys, prefetchListing, type Listing, type MarketSubscription, type Price, type Sort } from "../api";
import { Note, Tag } from "../components/bits";
import { TopBar } from "../components/chrome";
import { WEB_NO_RING } from "../components/controls";
import { ListingRow, ROW, SubscriptionRow } from "../components/rows";
import { LoadError, RowsSkeleton } from "../components/states";
import { useBack, usePoll, usePullRefresh } from "../hooks";
import { openClientArea } from "../web";

type Tab = "browse" | "subs" | "mine";

const PRICES: { key: Price; label: "mobileAlgo.market.all" | "mobileAlgo.market.free" | "mobileAlgo.market.paid" }[] = [
  { key: "", label: "mobileAlgo.market.all" },
  { key: "free", label: "mobileAlgo.market.free" },
  { key: "paid", label: "mobileAlgo.market.paid" },
];
const SORTS: { key: Sort; label: "mobileAlgo.market.newest" | "mobileAlgo.market.topRated" | "mobileAlgo.market.popular" }[] = [
  { key: "updated", label: "mobileAlgo.market.newest" },
  { key: "rating", label: "mobileAlgo.market.topRated" },
  { key: "subscribers", label: "mobileAlgo.market.popular" },
];

export function MarketplaceScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack("/algo");
  const bottom = useBottomInset(false);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = React.useState<Tab>(params.tab === "subscriptions" ? "subs" : "browse");
  // the search text lives in the field (typing re-renders only the field); the list follows it 300 ms later
  const [q, setQ] = React.useState("");
  const [price, setPrice] = React.useState<Price>("");
  const [sort, setSort] = React.useState<Sort>("updated");

  const browse = useQuery(keys.market(q, price, sort), fetchers.market(q, price, sort), { persist: q === "", staleMs: 20_000, intervalMs: usePoll(tab === "browse" ? 60_000 : undefined) });
  // the previous answer stays on screen (dimmed) while a new search or filter loads, instead of a skeleton flash
  const last = React.useRef(browse.data);
  if (browse.data) last.current = browse.data;
  // a search or filter that failed shows that state (with a retry), never the previous answer dimmed forever
  const failed = !browse.data && !!browse.error && !browse.fetching;
  const shown = failed ? undefined : (browse.data ?? last.current);
  const stale = !browse.data && !!shown;

  const subs = useQuery(keys.subscriptions, fetchers.subscriptions, { persist: true, staleMs: 10_000, intervalMs: usePoll(tab === "subs" ? 30_000 : undefined) });
  const mine = useQuery(keys.mine, fetchers.mine, { persist: true, staleMs: 30_000 });
  const hasMine = (mine.data?.items.length ?? 0) > 0;

  const { refreshing, onRefresh } = usePullRefresh(() => Promise.all([browse.refresh(), subs.refresh(), mine.refresh()]));
  const open = React.useCallback((id: number) => router.push(`/algo/marketplace/${id}`), [router]);
  const subscribed = React.useMemo(() => new Set(shown?.subscribed ?? []), [shown]);
  const activeSubs = (subs.data?.items ?? []).filter((s) => s.status === "active").length;

  if (!shown && browse.error && ["module_disabled", "viewer_scope", "viewer_read_only"].includes(browse.error.code)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={browse.error} onRetry={() => void browse.refresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  const header = (
    <View>
      <TopBar onBack={back} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="ember">
          {t("mobileAlgo.market.eyebrow")}
        </Text>
        <Display size="hero" accessibilityRole="header">
          {t("mobileAlgo.market.title")}
        </Display>
        <Text tone="secondary" style={{ marginTop: space[1] }}>
          {t("mobileAlgo.market.subtitle")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER, marginBottom: space[4] }} accessibilityRole="tablist">
        <Pill label={t("mobileAlgo.market.browse")} selected={tab === "browse"} onPress={() => setTab("browse")} />
        <Pill label={activeSubs ? t("mobileAlgo.market.subsN", { n: activeSubs }) : t("mobileAlgo.market.subs")} selected={tab === "subs"} onPress={() => setTab("subs")} />
        {hasMine ? <Pill label={t("mobileAlgo.market.mine")} selected={tab === "mine"} onPress={() => setTab("mine")} /> : null}
      </View>
      {tab === "browse" ? (
        <View style={{ gap: space[3], marginBottom: space[3] }}>
          <SearchField initial={q} onQuery={setQ} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingHorizontal: GUTTER }}>
            {PRICES.map((p) => (
              <Pill key={p.key || "all"} compact label={t(p.label)} selected={price === p.key} onPress={() => setPrice(p.key)} />
            ))}
            <View style={{ width: 1, height: 26, backgroundColor: colors.line, alignSelf: "center", marginHorizontal: 2 }} />
            {SORTS.map((s) => (
              <Pill key={s.key} compact label={t(s.label)} selected={sort === s.key} onPress={() => setSort(s.key)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />;

  if (tab === "subs") {
    return (
      <Screen scroll={false} tabBar={false}>
        <FlashList
          data={subs.data?.items ?? []}
          keyExtractor={subKey}
          renderItem={({ item }) => <SubscriptionRow s={item} onOpen={open} onPressIn={prefetchListing} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !subs.data ? (
              subs.error ? (
                <LoadError error={subs.error} onRetry={() => void subs.refresh()} />
              ) : (
                <RowsSkeleton rows={3} height={ROW.subscription} />
              )
            ) : (
              <EmptyState illustration="emptyHistory" size={170} title={t("mobileAlgo.market.noSubsTitle")} body={t("mobileAlgo.market.noSubsText")} action={t("mobileAlgo.market.browse")} onAction={() => setTab("browse")} />
            )
          }
          contentContainerStyle={{ paddingBottom: bottom + space[4] }}
          showsVerticalScrollIndicator={false}
          refreshControl={refresh}
        />
      </Screen>
    );
  }

  if (tab === "mine") {
    const m = mine.data;
    return (
      <Screen scroll={false} tabBar={false}>
        <FlashList
          data={m?.items ?? []}
          keyExtractor={listingKey}
          renderItem={({ item }) => <MyListingRow l={item} onOpen={open} />}
          ListHeaderComponent={
            <View>
              {header}
              {m ? (
                <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER, marginBottom: space[4] }}>
                  <Earned label={t("mobileAlgo.market.earned")} value={`${m.earned.toFixed(2)} USDT`} />
                  <Earned label={t("mobileAlgo.market.fees")} value={`${m.platformFees.toFixed(2)} USDT`} />
                  <Earned label={t("mobileAlgo.market.payments")} value={String(m.payments)} />
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View style={{ padding: GUTTER, gap: space[3] }}>
              <Note>{t("mobileAlgo.market.publishWeb")}</Note>
              <PressableScale onPress={() => openClientArea("/developer/marketplace")} scaleTo={0.98} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
                <Text variant="callout" weight="700" tone="ember">
                  {t("mobileAlgo.market.openWeb")}
                </Text>
              </PressableScale>
            </View>
          }
          contentContainerStyle={{ paddingBottom: bottom + space[4] }}
          showsVerticalScrollIndicator={false}
          refreshControl={refresh}
        />
      </Screen>
    );
  }

  const items = shown?.items ?? [];
  const anyHouse = items.some((l) => l.house);
  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={listingKey}
        renderItem={({ item }) => <ListingRow l={item} subscribed={subscribed.has(item.id)} onOpen={open} onPressIn={prefetchListing} />}
        extraData={subscribed}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !shown ? (
            browse.error ? (
              <LoadError error={browse.error} onRetry={() => void browse.refresh()} />
            ) : (
              <View style={{ gap: space[3], paddingHorizontal: GUTTER }}>
                <View style={{ height: ROW.listing - space[3], borderRadius: radius.card, backgroundColor: colors.surface }} />
                <View style={{ height: ROW.listing - space[3], borderRadius: radius.card, backgroundColor: colors.surface }} />
              </View>
            )
          ) : (
            <View style={{ alignItems: "center", paddingHorizontal: space[8], paddingVertical: space[6], gap: space[3] }}>
              <Illustration name="market" width={170} height={140} />
              <Display size="md" align="center">
                {q || price ? t("mobileAlgo.market.noMatchTitle") : t("mobileAlgo.market.emptyTitle")}
              </Display>
              <Text tone="secondary" align="center">
                {q || price ? t("mobileAlgo.market.noMatchText") : t("mobileAlgo.market.emptyText")}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          items.length ? (
            <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], gap: space[3] }}>
              <Note>{t("mobileAlgo.market.disclaimer", { pct: shown?.platformCutPct ?? 20 })}</Note>
              {anyHouse ? <Note>{t("mobileAlgo.market.houseFootnote")}</Note> : null}
            </View>
          ) : null
        }
        style={stale ? { opacity: 0.55 } : undefined}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
      />
    </Screen>
  );
}

const listingKey = (l: Listing) => String(l.id);
const subKey = (s: MarketSubscription) => String(s.id);

function SearchField({ initial, onQuery }: { initial: string; onQuery: (q: string) => void }) {
  const t = useT();
  const [value, setValue] = React.useState(initial);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => onQuery(value.trim()), 300);
    return () => clearTimeout(id);
  }, [value, onQuery]);
  const onChange = (v: string) => setValue(v.slice(0, 60));
  return (
    <View
      style={{
        marginHorizontal: GUTTER,
        height: 48,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: focused ? colors.ember : colors.line,
        flexDirection: "row",
        alignItems: "center",
        paddingStart: space[4],
        paddingEnd: space[1],
        gap: space[2],
      }}
    >
      <Search size={18} color={colors.text3} />
      <TextInput
        testID="market-search"
        value={value}
        onChangeText={onChange}
        placeholder={t("mobileAlgo.market.search")}
        placeholderTextColor={colors.text3}
        selectionColor={colors.ember}
        accessibilityLabel={t("common.search")}
        returnKeyType="search"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[{ flex: 1, height: "100%", color: colors.text, fontSize: 16 }, WEB_NO_RING]}
      />
      {value ? (
        <PressableScale onPress={() => onChange("")} accessibilityLabel={t("mobileAlgo.market.clear")} scaleTo={0.9} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <X size={17} color={colors.text2} />
        </PressableScale>
      ) : null}
    </View>
  );
}

function Earned({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 3, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <Mono size={15} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Mono>
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const MyListingRow = React.memo(function MyListingRow({ l, onOpen }: { l: Listing; onOpen: (id: number) => void }) {
  const t = useT();
  const tone = l.status === "approved" ? "gold" : l.status === "pending" ? "warn" : "neutral";
  return (
    <PressableScale onPress={() => onOpen(l.id)} onPressIn={() => prefetchListing(l.id)} scaleTo={0.985} style={{ height: ROW.subscription, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text variant="headline" weight="700" numberOfLines={1}>
          {l.title}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${t("mobileAlgo.market.subscribers", { count: l.subscribers })} · ${l.priceMonthly > 0 ? t("mobileAlgo.market.perMonth", { price: l.priceMonthly }) : t("mobileAlgo.market.free")}${l.moderationNote ? ` · ${l.moderationNote}` : ""}`}
        </Text>
      </View>
      <Tag compact tone={tone} label={t.dyn(`mobileAlgo.listing.${l.status}`, l.status)} />
    </PressableScale>
  );
});

export default MarketplaceScreen;

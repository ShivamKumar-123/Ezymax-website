// /news — market news, editorial front page: the daily AI brief, the lead story as a colour block (pinned first),
// then every story as a fixed-height row with infinite scroll. Filters (importance, tone, currency, instrument) come
// from a sheet, or from the link (/news?symbol=XAUUSD, /news?currency=USD from a story or a calendar event).
//
// One FlashList: the header scrolls away with the list; rows are memoised on story objects that stay identical
// between polls, so a refresh that brings nothing new re-renders no row, and new stories slide in on top without
// moving what is on screen. Opens on the cached feed (persisted per user) and refreshes in the background.
import * as React from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { X } from "lucide-react-native";
import { useFormat, useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { kv } from "@/lib/kv";
import { useOnline } from "@/lib/net";
import { invalidate, useQuery } from "@/lib/query";
import { Button, Display, EmptyState, Pill, PressableScale, Screen, Text, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { activeFilters, cleanCurrency, cleanSymbol, fetchFeed, fetchOlder, keys, NEWS_FILTERS_KEY as FILTERS_KEY, NO_FILTERS, prefetchRelated, primeStory, savedNewsFilters as savedFilters, type Feed, type Importance, type NewsFilters, type NewsItem } from "../api";
import { BriefCard } from "../components/BriefCard";
import { FilterButton, SectionTitle, TopBar } from "../components/chrome";
import { HeroStory } from "../components/HeroStory";
import { NewsFiltersSheet } from "../components/NewsFiltersSheet";
import { LoadError, StoryRowsSkeleton } from "../components/states";
import { charsPerLine, linesOf, storyRowHeight, StoryRow } from "../components/StoryRow";

const IMPORTANCE: [Importance, MessageKey][] = [
  ["all", "mobileNews.importance.all"],
  ["important", "mobileNews.importance.important"],
  ["top", "mobileNews.importance.top"],
];

const newest = (a: NewsItem, b: NewsItem) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.id - a.id;
function mergeUnique(...lists: NewsItem[][]): NewsItem[] {
  const out = new Map<number, NewsItem>();
  for (const l of lists) for (const n of l) if (!out.has(n.id)) out.set(n.id, n);
  return [...out.values()];
}

/** The lead story: the latest pinned story, else the most important story of the last two days (newest on a tie),
 *  else the newest story. */
function leadOf(feed: Feed | undefined): NewsItem | undefined {
  if (!feed) return undefined;
  if (feed.pinned[0]) return feed.pinned[0];
  const since = Date.now() - 48 * 3_600_000;
  let best: NewsItem | undefined;
  for (const n of feed.items) if (Date.parse(n.publishedAt) >= since && (!best || n.importance > best.importance)) best = n;
  return best ?? feed.items[0];
}

type Pages = { key: string; extra: NewsItem[]; next: string | null | undefined; loading: boolean; failed: boolean };
const NONE: NewsItem[] = [];
const fresh = (key: string): Pages => ({ key, extra: NONE, next: undefined, loading: false, failed: false });

export function NewsScreen() {
  const t = useT();
  const f = useFormat();
  const router = useRouter();
  const focused = useIsFocused();
  const online = useOnline();
  const bottom = useBottomInset(false);
  const { width } = useWindowDimensions();
  const perLine = charsPerLine(width);
  const params = useLocalSearchParams<{ symbol?: string; currency?: string }>();
  const linked = React.useMemo(() => ({ symbol: cleanSymbol(params.symbol), currency: cleanCurrency(params.currency) }), [params.symbol, params.currency]);
  const fromLink = !!(linked.symbol || linked.currency);

  const [filters, setFilters] = React.useState<NewsFilters>(() => (fromLink ? { ...NO_FILTERS, ...linked } : savedFilters()));
  React.useEffect(() => {
    if (!fromLink) kv.setJSON(FILTERS_KEY, filters);
  }, [filters, fromLink]);
  const change = React.useCallback((patch: Partial<NewsFilters>) => setFilters((x) => ({ ...x, ...patch })), []);
  const clear = React.useCallback(() => setFilters(NO_FILTERS), []);
  const sheet = React.useRef<SheetRef>(null);
  // the filter sheet lives in the app's root portal: leaving the screen closes it
  React.useEffect(() => {
    if (!focused) sheet.current?.dismiss();
  }, [focused]);

  const key = keys.feed(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = React.useMemo(() => fetchFeed(filters), [key]);
  const feed = useQuery(key, fetcher, { persist: true, staleMs: 60_000, intervalMs: focused ? 120_000 : undefined });
  // keep the previous answer on screen (dimmed) while a new filter loads, instead of flashing a skeleton; a filter
  // that can't load shows its error (with retry) rather than the other filter's stories
  const shown = React.useRef<Feed | undefined>(undefined);
  if (feed.data) shown.current = feed.data;
  const data = feed.data ?? (feed.error ? undefined : shown.current);
  const stale = !feed.data && !!data;

  // older pages (infinite scroll), plus first pages a refresh replaced: kept for this filter so nothing on screen
  // disappears when new stories arrive on top
  const [pages, setPages] = React.useState<Pages>(() => fresh(key));
  const cur: Pages = pages.key === key ? pages : fresh(key);
  const lastFirst = React.useRef<{ key: string; items: NewsItem[] } | null>(null);
  React.useEffect(() => {
    if (!feed.data) return;
    const prev = lastFirst.current;
    lastFirst.current = { key, items: feed.data.items };
    if (prev && prev.key === key && prev.items !== feed.data.items) setPages((p) => ({ ...(p.key === key ? p : fresh(key)), extra: mergeUnique(p.key === key ? p.extra : [], prev.items) }));
  }, [feed.data, key]);

  const lead = leadOf(data);
  const list = React.useMemo(() => {
    if (!data) return [];
    const pinnedIds = new Set(data.pinned.map((x) => x.id));
    const rest = mergeUnique(data.items, cur.extra)
      .filter((x) => x.id !== lead?.id && !pinnedIds.has(x.id))
      .sort(newest);
    return [...data.pinned.filter((x) => x.id !== lead?.id), ...rest];
  }, [data, cur.extra, lead?.id]);
  const next = cur.next === undefined ? (data?.next ?? null) : cur.next;

  // one older page at a time: the list can report its end twice before `loading` renders
  const loadingRef = React.useRef<string | null>(null);
  const loadMore = React.useCallback(async (retry = false) => {
    if (!data || stale || cur.loading || (cur.failed && !retry) || !next || loadingRef.current === `${key}|${next}`) return;
    loadingRef.current = `${key}|${next}`;
    setPages({ ...cur, loading: true, failed: false });
    const r = await fetchOlder(filters, next);
    loadingRef.current = null;
    setPages((p) => {
      const base = p.key === key ? p : fresh(key);
      if (!r.ok) return { ...base, loading: false, failed: true };
      return { ...base, extra: mergeUnique(base.extra, r.data.items ?? []), next: r.data.next ?? null, loading: false, failed: false };
    });
  }, [data, stale, cur, next, filters, key]);
  const retryMore = React.useCallback(() => void loadMore(true), [loadMore]);

  const open = React.useCallback((n: NewsItem) => router.push(`/news/${n.id}`), [router]);
  const warm = React.useCallback((n: NewsItem) => {
    primeStory(n);
    prefetchRelated(n);
  }, []);
  const avail = width - GUTTER * 2;
  const renderItem = React.useCallback(({ item }: { item: NewsItem }) => <StoryRow n={item} lines={linesOf(item.title, perLine)} avail={avail} onOpen={open} onPressIn={warm} />, [perLine, avail, open, warm]);
  const typeOf = React.useCallback((item: NewsItem) => linesOf(item.title, perLine), [perLine]);
  const endReached = React.useCallback(() => void loadMore(), [loadMore]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    invalidate("news/brief");
    try {
      await feed.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [feed]);

  const n = activeFilters(filters);
  const narrowed = !!(filters.tone || filters.currency || filters.symbol || filters.importance !== "all");

  // other filters: a reader scrolled past the filter row lands back on it (the lead story and the new results follow)
  const listRef = React.useRef<FlashListRef<NewsItem>>(null);
  const filterY = React.useRef(0);
  const firstKey = React.useRef(key);
  React.useEffect(() => {
    if (key === firstKey.current) return;
    firstKey.current = key;
    const l = listRef.current;
    const y = Math.max(0, filterY.current - space[2]);
    if (l && l.getAbsoluteLastScrollOffset() > y) l.scrollToOffset({ offset: y, animated: false });
  }, [key]);

  const header = (
    <View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="ember">
          {t("mobileNews.eyebrow")}
        </Text>
        <Display size="hero" accessibilityRole="header">
          {t("mobileNews.title")}
        </Display>
      </View>
      <View style={{ paddingHorizontal: GUTTER, marginBottom: space[5] }}>
        <BriefCard focused={focused} />
      </View>
      <View onLayout={(e) => (filterY.current = e.nativeEvent.layout.y)}>
        <FilterRow filters={filters} onChange={change} />
      </View>
      {lead ? (
        <View style={{ paddingHorizontal: GUTTER, marginTop: space[4] }}>
          <HeroStory n={lead} onOpen={open} onPressIn={warm} />
        </View>
      ) : null}
      {list.length ? (
        <SectionTitle
          title={t("mobileNews.latest")}
          style={{ marginTop: space[8], marginBottom: space[1] }}
          right={
            feed.updatedAt ? (
              <Text variant="caption" tone="tertiary">
                {t("mobileNews.updated", { time: f.time(feed.updatedAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: undefined }) })}
              </Text>
            ) : null
          }
        />
      ) : null}
    </View>
  );

  const empty = !data ? (
    feed.error ? (
      <LoadError error={feed.error} onRetry={() => void feed.refresh()} />
    ) : (
      <View style={{ marginTop: space[6] }}>
        <StoryRowsSkeleton rows={4} height={storyRowHeight(2)} />
      </View>
    )
  ) : lead ? null : narrowed ? (
    <EmptyState illustration="emptyHistory" title={t("mobileNews.empty.filteredTitle")} body={t("news.list.empty")} action={t("mobileNews.filter.clear")} onAction={clear} />
  ) : (
    <EmptyState illustration={online ? "market" : "connectionLost"} title={t("mobileNews.empty.title")} body={t("news.page.empty")} />
  );

  const footer = list.length ? (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], alignItems: "center", gap: space[2], minHeight: 120 }}>
      {cur.loading ? (
        <Text variant="caption" tone="tertiary">
          {t("mobileNews.list.loadingMore")}
        </Text>
      ) : cur.failed ? (
        <>
          <Text variant="callout" tone="secondary">
            {t("news.list.loadMoreError")}
          </Text>
          <Button label={t("mobile.action.retry")} variant="secondary" size="sm" full={false} onPress={retryMore} />
        </>
      ) : !next ? (
        <>
          <Display size="xs" tone="tertiary">
            {t("mobileNews.list.end")}
          </Display>
          <Text variant="caption" tone="tertiary" align="center" style={{ maxWidth: 280 }}>
            {t("mobileNews.list.endBody")}
          </Text>
        </>
      ) : null}
    </View>
  ) : null;

  return (
    <Screen scroll={false} tabBar={false}>
      <TopBar fallback="/" right={<FilterButton testID="news-filters" count={n} label={n ? t("mobileNews.filtersOn", { n }) : t("mobileNews.filters")} onPress={() => sheet.current?.present()} />} />
      <FlashList
        ref={listRef}
        data={list}
        keyExtractor={keyOf}
        renderItem={renderItem}
        getItemType={typeOf}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={endReached}
        onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        style={stale ? { opacity: 0.55 } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <NewsFiltersSheet ref={sheet} value={filters} onChange={change} onClear={clear} />
    </Screen>
  );
}

const keyOf = (n: NewsItem) => String(n.id);

/** Importance pills, then the other active filters as removable chips (one horizontal row). */
function FilterRow({ filters, onChange }: { filters: NewsFilters; onChange: (patch: Partial<NewsFilters>) => void }) {
  const t = useT();
  const chips: { key: string; label: string; clear: Partial<NewsFilters> }[] = [];
  if (filters.symbol) chips.push({ key: "symbol", label: filters.symbol, clear: { symbol: null } });
  if (filters.currency) chips.push({ key: "currency", label: filters.currency, clear: { currency: null } });
  if (filters.tone) chips.push({ key: "tone", label: t(`news.sentiment.${filters.tone}` as MessageKey), clear: { tone: null } });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space[2] }} accessibilityRole="tablist">
      {IMPORTANCE.map(([k, label]) => (
        <Pill key={k} compact label={t(label)} selected={filters.importance === k} onPress={() => onChange({ importance: k })} />
      ))}
      {chips.map((c) => (
        <PressableScale
          key={c.key}
          onPress={() => onChange(c.clear)}
          haptics="select"
          accessibilityLabel={t("mobileNews.filter.remove", { label: c.label })}
          style={{ height: 34, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.ember, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Text variant="callout" weight="700" color={colors.ink}>
            {c.label}
          </Text>
          <X size={14} color={colors.ink} strokeWidth={2.6} />
        </PressableScale>
      ))}
      <View style={{ width: 1 }} />
    </ScrollView>
  );
}

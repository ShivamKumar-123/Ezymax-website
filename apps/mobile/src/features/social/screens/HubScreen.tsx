// /social — the social hub: the leaderboard of approved masters (with filters), shortcuts to my copies, PAMM
// and MAM, and a summary for masters (their dashboard is managed in the Client Area on the web).
// One FlashList: the editorial header scrolls away with the list; rows are fixed-height and memoised.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { LineChart, ShieldCheck, SlidersHorizontal } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { prefetch, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { ColorBlock, Display, Illustration, Mono, Pill, PressableScale, Screen, Text, useBottomInset, type SheetRef } from "@/ui";
import { blockColors, colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchers, keys, leaderboardPath, shared, socialGet, type Leaderboard, type LbPeriod, type MasterView } from "../api";
import { compactUsd } from "../format";
import { TopBar, useBack } from "../components/chrome";
import { LEADER_ROW_HEIGHT, LeaderRow } from "../components/LeaderRow";
import { MastersCard } from "../components/MastersCard";
import { Note } from "../components/primitives";
import { LoadError, RowsSkeleton } from "../components/states";
import { FiltersSheet } from "../sheets/FiltersSheet";
import { activeFilterCount, DEFAULT_FILTERS, narrowed, setFilters, useFilters } from "../state";

const PERIODS: { key: LbPeriod; label: "mobileSocial.lb.period.1m" | "mobileSocial.lb.period.3m" | "mobileSocial.lb.period.1y" | "mobileSocial.lb.period.all" }[] = [
  { key: "1m", label: "mobileSocial.lb.period.1m" },
  { key: "3m", label: "mobileSocial.lb.period.3m" },
  { key: "1y", label: "mobileSocial.lb.period.1y" },
  { key: "all", label: "mobileSocial.lb.period.all" },
];

export function HubScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack("/");
  const bottom = useBottomInset(false);
  const filters = useFilters();
  const sheet = React.useRef<SheetRef>(null);

  const key = keys.leaderboard(filters);
  const lb = useQuery(
    key,
    shared(key, () => socialGet<Leaderboard>(leaderboardPath(filters))),
    { persist: true, intervalMs: 60_000 },
  );
  // keep the previous answer on screen (dimmed) while a new filter loads, instead of flashing a skeleton
  const shown = React.useRef<Leaderboard | undefined>(undefined);
  if (lb.data) shown.current = lb.data;
  const data = lb.data ?? shown.current;
  const stale = !lb.data && !!data;

  const subs = useQuery(keys.subs, fetchers.subs, { persist: true });
  const inv = useQuery(keys.investments, fetchers.investments, { persist: true });
  const links = useQuery(keys.links, fetchers.links, { persist: true });

  const openMaster = React.useCallback((id: number) => router.push(`/social/masters/${id}`), [router]);
  const warm = React.useCallback((id: number) => prefetch(keys.master(id), fetchers.master(id), { persist: true }), []);

  const refresh = React.useCallback(async () => {
    haptic.select();
    await Promise.all([lb.refresh(), subs.refresh(), inv.refresh(), links.refresh()]);
  }, [lb, subs, inv, links]);
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const items = data?.items ?? [];
  const hasHouse = items.some((m) => m.house);
  const nFilters = activeFilterCount(filters);
  const highlight = filters.sort === "return";

  const header = (
    <View>
      <TopBar onBack={back} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="ember">
          {t("mobileSocial.hub.eyebrow")}
        </Text>
        <Display size="hero" accessibilityRole="header">
          {t("mobileSocial.hub.title")}
        </Display>
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        <RestrictionBanner kinds={["social", "transfers"]} />
        <Hero totals={data?.totals} anyHouse={hasHouse} loading={!data} />
        <MineRow
          copies={subs.data?.items.filter((s) => s.status !== "stopped")}
          invested={inv.data ? inv.data.items.reduce((a, i) => a + i.value, 0) : undefined}
          investedCount={inv.data?.items.length}
          links={links.data?.items.filter((l) => l.status === "active").length}
        />
      </View>
      <View style={{ paddingHorizontal: GUTTER, marginTop: space[8], gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Display size="lg" accessibilityRole="header">
              {t("mobileSocial.lb.title")}
            </Display>
            {data ? (
              <Text variant="caption" tone="tertiary">
                {t("mobileSocial.lb.sub", { count: items.length })}
              </Text>
            ) : null}
          </View>
          <PressableScale
            testID="lb-filters"
            onPress={() => sheet.current?.present()}
            haptics="select"
            accessibilityLabel={t("mobileSocial.lb.filters")}
            style={{
              height: 40,
              paddingHorizontal: space[4],
              borderRadius: radius.pill,
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              backgroundColor: nFilters ? colors.cream : colors.surface,
              borderWidth: 1,
              borderColor: nFilters ? colors.cream : colors.line,
            }}
          >
            <SlidersHorizontal size={16} color={nFilters ? colors.ink : colors.text2} />
            <Text variant="callout" weight="700" color={nFilters ? colors.ink : colors.text2}>
              {nFilters ? t("mobileSocial.lb.filtersOn", { n: nFilters }) : t("mobileSocial.lb.filters")}
            </Text>
          </PressableScale>
        </View>
        <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="tablist">
          {PERIODS.map((p) => (
            <Pill key={p.key} compact label={t(p.label)} selected={filters.period === p.key} onPress={() => setFilters({ period: p.key })} />
          ))}
        </View>
      </View>
      <View style={{ height: space[3] }} />
    </View>
  );

  const empty = !data ? (
    lb.error ? (
      <LoadError error={lb.error} onRetry={() => void lb.refresh()} onBack={back} />
    ) : (
      <RowsSkeleton rows={6} height={LEADER_ROW_HEIGHT} />
    )
  ) : narrowed(filters) ? (
    <EmptyList
      title={t("mobileSocial.lb.empty.filteredTitle")}
      body={t("mobileSocial.lb.empty.filteredText")}
      action={t("mobileSocial.lb.clearFilters")}
      onAction={() => setFilters({ ...DEFAULT_FILTERS, period: filters.period })}
    />
  ) : (
    <EmptyList title={t("mobileSocial.lb.empty.title")} body={t("mobileSocial.lb.empty.text")} />
  );

  const footer = (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], gap: space[3] }}>
      {items.length ? (
        <>
          <Note icon={<LineChart size={14} color={colors.text3} />}>{t("mobileSocial.lb.disclaimer")}</Note>
          {hasHouse ? <Note>{t("mobileSocial.lb.houseNote")}</Note> : null}
        </>
      ) : null}
      <MastersCard style={{ marginTop: space[5] }} />
    </View>
  );

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item, index }) => <LeaderRow m={item} rank={index + 1} period={filters.period} highlight={highlight} onOpen={openMaster} onPressIn={warm} />}
        extraData={`${filters.period}:${highlight}`}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        style={stale ? { opacity: 0.55 } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <FiltersSheet ref={sheet} />
    </Screen>
  );
}

const keyOf = (m: MasterView) => String(m.id);

function EmptyList({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingHorizontal: space[8], paddingVertical: space[8], gap: space[3] }}>
      <Illustration name="copyTrading" width={180} height={150} />
      <Display size="md" align="center">
        {title}
      </Display>
      <Text tone="secondary" align="center">
        {body}
      </Text>
      {action && onAction ? <Pill label={action} onPress={onAction} /> : null}
    </View>
  );
}

/** Ember block: the leaderboard at a glance, with the copy trading illustration. */
function Hero({ totals, anyHouse, loading }: { totals?: Leaderboard["totals"]; anyHouse: boolean; loading: boolean }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <ColorBlock color="ember" style={{ paddingBottom: space[5] }}>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text variant="label" color={colors.ink2}>
            {t("mobileSocial.hub.hero.eyebrow")}
          </Text>
          <Display size="hero" color={colors.ink} style={{ fontSize: 72, lineHeight: 74 }}>
            {loading || !totals ? "—" : fmt.number(totals.masters, 0)}
          </Display>
          <Text variant="callout" weight="700" color={colors.ink}>
            {t("mobileSocial.hub.hero.masters", { count: totals?.masters ?? 0 })}
          </Text>
        </View>
        <Illustration name="copyTrading" width={128} height={112} style={{ marginEnd: -space[2], marginTop: -space[2] }} />
      </View>
      <View style={{ flexDirection: "row", gap: space[3], marginTop: space[5] }}>
        <HeroStat label={t("mobileSocial.hub.hero.aum")} value={totals ? compactUsd(totals.aum) : "—"} />
        <HeroStat label={t("mobileSocial.hub.hero.followers")} value={totals ? fmt.number(totals.followers, 0) : "—"} />
        <HeroStat label={t("mobileSocial.hub.hero.investors")} value={totals ? fmt.number(totals.investors, 0) : "—"} />
      </View>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start", marginTop: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: "rgba(14,14,16,0.14)" }}>
        <ShieldCheck size={15} color={colors.ink} style={{ marginTop: 1 }} />
        <Text variant="caption" color={colors.ink2} style={{ flex: 1, lineHeight: 17 }}>
          {anyHouse ? t("mobileSocial.hub.hero.chipClient") : t("mobileSocial.hub.hero.chipAll")}
        </Text>
      </View>
    </ColorBlock>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Mono size={19} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Mono>
      <Text variant="caption" color={colors.ink2} numberOfLines={2} style={{ fontSize: 11.5 }}>
        {label}
      </Text>
    </View>
  );
}

/** Three colour blocks: my copies, PAMM, MAM (tap to open; the screen's data is warmed on press-in). */
function MineRow({ copies, invested, investedCount, links }: { copies?: { equity: number }[]; invested?: number; investedCount?: number; links?: number }) {
  const t = useT();
  const router = useRouter();
  const equity = copies?.reduce((a, s) => a + s.equity, 0);
  return (
    <View style={{ flexDirection: "row", gap: space[3] }}>
      <MineBlock
        testID="hub-copies"
        color="mint"
        title={t("mobileSocial.hub.mine.copies")}
        value={copies ? String(copies.length) : "—"}
        sub={copies ? (copies.length ? compactUsd(equity) : t("mobileSocial.hub.mine.copiesSub", { count: 0 })) : " "}
        onPressIn={() => prefetch(keys.subs, fetchers.subs, { persist: true })}
        onPress={() => router.push("/social/subscriptions")}
      />
      <MineBlock
        testID="hub-pamm"
        color="gold"
        title={t("mobileSocial.hub.mine.pamm")}
        value={invested !== undefined && investedCount ? compactUsd(invested) : investedCount === 0 ? "0" : "—"}
        sub={t("mobileSocial.hub.mine.pammSub")}
        onPressIn={() => prefetch(keys.funds, fetchers.funds, { persist: true })}
        onPress={() => router.push(investedCount ? "/social/pamm?tab=mine" : "/social/pamm")}
      />
      <MineBlock
        testID="hub-mam"
        color="periwinkle"
        title={t("mobileSocial.hub.mine.mam")}
        value={links === undefined ? "—" : String(links)}
        sub={links === undefined ? t("mobileSocial.hub.mine.mamSub") : t("mobileSocial.hub.mine.links", { count: links })}
        onPressIn={() => prefetch(keys.managers, fetchers.managers, { persist: true })}
        onPress={() => router.push("/social/mam")}
      />
    </View>
  );
}

function MineBlock({
  color,
  title,
  value,
  sub,
  onPress,
  onPressIn,
  testID,
}: {
  color: "mint" | "gold" | "periwinkle";
  title: string;
  value: string;
  sub: string;
  onPress: () => void;
  onPressIn: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}, ${sub}`}
      style={{ flex: 1, height: 136, padding: space[4], borderRadius: radius.card, backgroundColor: blockColors[color], overflow: "hidden" }}
    >
      <Text variant="label" color={colors.ink2} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ flex: 1 }} />
      <Display size="lg" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Display>
      <Text variant="caption" color={colors.ink2} numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 14, height: 28 }}>
        {sub}
      </Text>
    </PressableScale>
  );
}

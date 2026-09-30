// /accounts: the client's live and demo trading accounts. Opens on the cached list (shared with Home and Trade),
// refreshes every 5 s while on screen (equity and margin move with prices), pull to refresh. Rows are fixed-height
// memoised cards in a FlashList; a poll that changed nothing re-renders nothing.
import * as React from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useSharedValue } from "react-native-reanimated";
import { Plus } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { useActiveLogin } from "@/session/activeAccount";
import { Banner, ColorBlock, EmptyState, IconButton, Mono, PillRow, PressableScale, Skeleton, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { prefetchAccount, prefetchWizard, useAccountList, useGroups, useReadOnly } from "../api";
import { ACCOUNT_CARD_GAP, ACCOUNT_CARD_HEIGHT, AccountCard } from "../components/AccountCard";
import { Page, PageTitle, SectionTitle, StackBar } from "../components/Chrome";
import { GroupBlock } from "../components/GroupCards";
import { fitMono, groupColor, offers } from "../format";
import { publishFigures, useStructuralList } from "../figures";
import { useTotals } from "../components/LiveFigure";
import { inkSoft } from "../tint";
import type { Account, AccountKind, Group } from "../types";

/** Totals of the tab's accounts in USD (cent accounts converted from USC), on the kind's colour. A leaf: the
 *  price-driven sums come from the accounts' polled figures, so only this block re-renders when they move. */
const Totals = React.memo(function Totals({ kind, accounts }: { kind: AccountKind; accounts: Account[] }) {
  const t = useT();
  const { equity, free } = useTotals(accounts);
  const balance = accounts.reduce((s, a) => s + (a.cent || a.currency === "USC" ? a.balance / 100 : a.balance), 0);
  const positions = accounts.reduce((s, a) => s + a.positions, 0);
  const usd = (v: number) => fmtMoney(v, { currency: "USD" });
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 520) - GUTTER * 2 - space[6] * 2;
  const size = fitMono(usd(equity), inner, 42, 24);
  // balance and free margin share what the positions count (its own width) leaves, at one size that fits both
  const col = (inner - space[4] * 2 - POSITIONS_W) / 2;
  const small = Math.min(fitMono(usd(balance), col, 15, 10), fitMono(usd(free), col, 15, 10));
  const metric = (label: string, value: string, grow: boolean) => (
    <View key={label} style={grow ? { flex: 1, gap: 2, minWidth: 0 } : { flexShrink: 0, gap: 2, minWidth: 0 }}>
      <Text variant="label" color={inkSoft} numberOfLines={1} style={{ fontSize: 10.5 }}>
        {label}
      </Text>
      <Mono size={grow ? small : 15} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ lineHeight: 19 }}>
        {value}
      </Mono>
    </View>
  );
  return (
    <ColorBlock color={kind === "live" ? "ember" : "periwinkle"} style={{ marginHorizontal: GUTTER, marginBottom: space[5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
        <Text variant="label" color={inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
          {kind === "live" ? t("mobileAccounts.totals.liveEquity") : t("mobileAccounts.totals.demoEquity")}
        </Text>
        <Text variant="label" color={inkSoft}>
          {t("mobileAccounts.totals.accounts", { count: accounts.length })}
        </Text>
      </View>
      {/* the line box follows the largest size, so the block keeps its height while the total changes length */}
      <Mono size={size} weight="bold" color={colors.ink} numberOfLines={1} style={{ marginTop: space[1], lineHeight: Math.round(42 * 1.2) }}>
        {usd(equity)}
      </Mono>
      <View style={{ flexDirection: "row", gap: space[4], marginTop: space[5] }}>
        {metric(t("common.balance"), usd(balance), true)}
        {metric(t("mobileAccounts.metric.freeMargin"), usd(free), true)}
        {metric(t("mobileAccounts.metric.positions"), String(positions), false)}
      </View>
    </ColorBlock>
  );
});

/** Room the positions count takes in the totals block (its label, e.g. "POSITIONS", at 10.5 pt). */
const POSITIONS_W = 72;

/** Loading placeholders shaped like the totals block and two account cards (static, no shimmer). */
function ListSkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: ACCOUNT_CARD_GAP }} accessibilityLabel="Loading" accessible>
      <Skeleton h={176} r={radius.block} style={{ marginBottom: space[2] }} />
      {[0, 1].map((i) => (
        <View key={i} style={{ height: ACCOUNT_CARD_HEIGHT, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[3] }}>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <Skeleton w={52} h={24} r={12} />
            <View style={{ flex: 1 }} />
            <Skeleton w={56} h={24} r={12} />
          </View>
          <Skeleton w={180} h={18} />
          <Skeleton w={96} h={12} />
          <View style={{ flexDirection: "row", gap: space[3], marginTop: space[2] }}>
            <Skeleton w="30%" h={30} />
            <Skeleton w="30%" h={30} />
            <Skeleton w="25%" h={30} />
          </View>
        </View>
      ))}
    </View>
  );
}

const EMPTY: Account[] = [];
const keyOf = (a: Account) => String(a.login);

function Separator() {
  return <View style={{ height: ACCOUNT_CARD_GAP }} />;
}

export function AccountsScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const readOnly = useReadOnly();
  const online = useOnline();
  const q = useAccountList();
  const groupsQ = useGroups(!readOnly);
  // the account the Trade tab uses (a view-only login doesn't trade, so it has none)
  const active = useActiveLogin();
  const activeLogin = readOnly ? null : active;
  const bottom = useBottomInset(false);
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = React.useState(false);

  // rows get each account's structural part (same object while only prices moved); figures go to leaf subscribers
  const accounts = useStructuralList(q.data?.accounts ?? EMPTY);
  React.useEffect(() => {
    if (q.data) publishFigures(q.data.accounts);
  }, [q.data]);
  const live = React.useMemo(() => accounts.filter((a) => a.type === "live"), [accounts]);
  const demo = React.useMemo(() => accounts.filter((a) => a.type === "demo"), [accounts]);
  const [picked, setPicked] = React.useState<AccountKind | null>(params.tab === "demo" || params.tab === "live" ? params.tab : null);
  // the tab with accounts (live first) until the reader picks one
  const tab: AccountKind = picked ?? (live.length === 0 && demo.length > 0 ? "demo" : "live");
  const list = tab === "live" ? live : demo;
  const groups = React.useMemo(() => (groupsQ.data?.groups ?? []).filter((g) => offers(g, "live") || offers(g, "demo")), [groupsQ.data]);

  const onOpen = React.useCallback((login: number) => router.push(`/accounts/${login}`), [router]);
  const onWarm = React.useCallback((login: number) => prefetchAccount(login), []);
  const openNew = React.useCallback(
    (kind?: AccountKind, group?: string) => {
      const p: Record<string, string> = {};
      if (kind) p.type = kind;
      if (group) p.group = group;
      router.push({ pathname: "/accounts/new", params: p });
    },
    [router],
  );
  const openGroup = React.useCallback((code: string) => openNew(undefined, code), [openNew]);

  const renderItem = React.useCallback<ListRenderItem<Account>>(
    ({ item }) => (
      <View style={{ paddingHorizontal: GUTTER }}>
        <AccountCard a={item} active={item.login === activeLogin} onOpen={onOpen} onWarm={onWarm} />
      </View>
    ),
    [activeLogin, onOpen, onWarm],
  );

  const refetchList = q.refresh;
  const refetchGroups = groupsQ.refresh;
  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await Promise.all([refetchList(), readOnly ? Promise.resolve() : refetchGroups()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchList, refetchGroups, readOnly]);
  const retry = React.useCallback(() => void refetchList(), [refetchList]);
  const onScroll = React.useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );
  const refreshControl = React.useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />,
    [refreshing, refresh],
  );

  const pills = React.useMemo(
    () => [
      { key: "live" as const, label: t("mobileAccounts.tab.live", { count: live.length }) },
      { key: "demo" as const, label: t("mobileAccounts.tab.demo", { count: demo.length }) },
    ],
    [t, live.length, demo.length],
  );

  // header, empty state and footer are kept as the same elements across polls, so a refresh that changed nothing
  // structural reaches no header, row or footer (the figures inside update on their own)
  const hasData = !!q.data;
  const error = q.error;
  const header = React.useMemo(
    () => (
      <View>
        <PageTitle eyebrow={t("mobileAccounts.eyebrow.list")} title={t("mobileAccounts.title.list")} />
        {readOnly ? <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} style={{ marginHorizontal: GUTTER, marginBottom: space[4] }} /> : null}
        {hasData ? <PillRow items={pills} value={tab} onChange={setPicked} style={{ marginBottom: space[4], flexGrow: 0 }} contentPadding={GUTTER} /> : null}
        {list.length > 0 ? <Totals kind={tab} accounts={list} /> : null}
      </View>
    ),
    [t, readOnly, hasData, pills, tab, list],
  );

  const empty = React.useMemo(() => {
    if (!hasData) {
      if (!error) return <ListSkeleton />;
      const offline = !online || error.code === "network";
      return (
        <EmptyState
          illustration="connectionLost"
          title={offline ? t("mobile.state.offline.title") : t("mobileAccounts.error.title")}
          body={offline ? t("mobile.state.offline.body") : error.status === 403 ? error.message : t("mobileAccounts.error.body")}
          action={t("mobile.action.retry")}
          onAction={retry}
        />
      );
    }
    if (list.length > 0) return null;
    return (
      <EmptyState
        illustration={tab === "live" ? "welcome" : "market"}
        size={tab === "live" ? 200 : 180}
        title={tab === "live" ? t("mobileAccounts.empty.live.title") : t("mobileAccounts.empty.demo.title")}
        body={tab === "live" ? t("mobileAccounts.empty.live.body") : t("mobileAccounts.empty.demo.body")}
        action={readOnly ? undefined : tab === "live" ? t("mobileAccounts.list.openLive") : t("mobileAccounts.list.openDemo")}
        onAction={readOnly ? undefined : () => openNew(tab)}
        style={{ paddingTop: space[2] }}
      />
    );
  }, [hasData, error, online, list.length, tab, readOnly, t, retry, openNew]);

  const typesData = groupsQ.data?.groups;
  const footer = React.useMemo(() => (
    <View style={{ paddingBottom: bottom + space[4] }}>
      {!readOnly && hasData && list.length > 0 ? (
        <PressableScale
          onPress={() => openNew(tab)}
          onPressIn={prefetchWizard}
          scaleTo={0.98}
          style={{ marginHorizontal: GUTTER, marginTop: ACCOUNT_CARD_GAP, height: 56, borderRadius: radius.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}
        >
          <Plus size={18} color={colors.text2} />
          <Text variant="callout" weight="700" tone="secondary">
            {tab === "live" ? t("mobileAccounts.list.openLive") : t("mobileAccounts.list.openDemo")}
          </Text>
        </PressableScale>
      ) : null}
      {!readOnly && hasData && groups.length > 0 ? (
        <View style={{ marginTop: space[8] }}>
          <SectionTitle title={t("mobileAccounts.list.types")} style={{ paddingHorizontal: GUTTER }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space[3] }} decelerationRate="fast" snapToInterval={232 + space[3]} snapToAlignment="start">
            {groups.map((g: Group) => (
              <GroupBlock key={g.code} g={g} color={groupColor(g.code, typesData ?? [])} onPress={openGroup} />
            ))}
          </ScrollView>
          <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, marginTop: space[3] }}>
            {t("mobileAccounts.list.typesNote")}
          </Text>
        </View>
      ) : null}
    </View>
  ), [bottom, readOnly, hasData, list.length, tab, groups, typesData, openNew, openGroup, t]);

  const newButton = React.useMemo(
    () => (readOnly ? null : <IconButton accessibilityLabel={t("mobileAccounts.list.newAccount")} tone="cream" icon={<Plus size={22} color={colors.ink} strokeWidth={2.2} />} onPress={() => openNew(tab)} />),
    [readOnly, t, openNew, tab],
  );

  return (
    <Page bar={<StackBar title={t("mobileAccounts.title.list")} scrollY={scrollY} right={newButton} />}>
      <FlashList
        data={hasData ? list : EMPTY}
        renderItem={renderItem}
        keyExtractor={keyOf}
        extraData={activeLogin}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    </Page>
  );
}

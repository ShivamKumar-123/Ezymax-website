// /wallet/history[?type=deposit|withdrawal|transfer|other]: every wallet transaction, newest first, on FlashList
// (fixed-height memoised rows, more pages as you scroll). Filters are pills; a row opens the detail sheet with the
// explorer link the server built and the statement note of Back Office adjustments. The first page of each filter
// is cached on the device, so the screen opens on content; pull to refresh.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useQuery } from "@/lib/query";
import { EmptyState, PillRow, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchActivity, QK, walletError, type ActivityItem, type Page } from "../api";
import { ACTIVITY_ROW_HEIGHT, ActivityRow, ActivitySkeleton } from "../components/ActivityRow";
import { ActivitySheet, type ActivitySheetHandle } from "../components/ActivitySheet";
import { WalletState } from "../components/states";
import { WalletHeader } from "../components/WalletHeader";

type Kind = "all" | "deposit" | "withdrawal" | "transfer" | "other";
const KINDS: Kind[] = ["all", "deposit", "withdrawal", "transfer", "other"];
const PER = 25;

const keyOf = (a: ActivityItem) => `${a.type}:${a.id}`;

function Separator() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: GUTTER + 52 }} />;
}

export function HistoryScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const initial = KINDS.includes(params.type as Kind) ? (params.type as Kind) : "all";
  const [kind, setKind] = React.useState<Kind>(initial);
  const bottom = useBottomInset(false);
  const sheet = React.useRef<ActivitySheetHandle>(null);

  const first = useQuery<Page<ActivityItem>>(QK.history(kind), () => fetchActivity(kind, 1, PER), { persist: true, staleMs: 15_000 });
  // further pages (not cached): reset whenever the filter or the first page changes
  const [extra, setExtra] = React.useState<{ kind: Kind; items: ActivityItem[]; page: number }>({ kind, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [moreError, setMoreError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setExtra({ kind, items: [], page: 1 });
    setMoreError(null);
  }, [kind, first.updatedAt]);

  const items = React.useMemo(() => {
    const seen = new Set<string>();
    const out: ActivityItem[] = [];
    for (const a of [...(first.data?.items ?? []), ...(extra.kind === kind ? extra.items : [])]) {
      const k = keyOf(a);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a);
    }
    return out;
  }, [first.data, extra, kind]);
  const total = first.data?.total ?? 0;
  const hasMore = !!first.data && extra.kind === kind && first.data.items.length + extra.items.length < total;

  const loadMore = React.useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const page = extra.page + 1;
    setLoadingMore(true);
    setMoreError(null);
    const r = await fetchActivity(kind, page, PER);
    setLoadingMore(false);
    if (!r.ok) {
      setMoreError(walletError(r.error));
      return;
    }
    setExtra((prev) => (prev.kind === kind ? { kind, items: [...prev.items, ...r.data.items], page } : prev));
  }, [hasMore, loadingMore, extra.page, kind]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await first.refresh();
    setRefreshing(false);
  }, [first.refresh]);

  const open = React.useCallback((a: ActivityItem) => sheet.current?.open(a), []);
  const renderItem = React.useCallback(({ item }: ListRenderItemInfo<ActivityItem>) => <ActivityRow item={item} onPress={open} />, [open]);

  const filters = React.useMemo(
    () => [
      { key: "all" as Kind, label: t("common.all") },
      { key: "deposit" as Kind, label: t("wallet.tab.deposits") },
      { key: "withdrawal" as Kind, label: t("wallet.tab.withdrawals") },
      { key: "transfer" as Kind, label: t("wallet.tab.transfers") },
      { key: "other" as Kind, label: t("wallet.tab.other") },
    ],
    [t],
  );

  const header = (
    <View style={{ paddingBottom: space[3] }}>
      <WalletHeader eyebrow={t("wallet.wallet")} title={t("wallet.history")} subtitle={first.data ? t("wallet.recent.count", { count: total }) : undefined} />
      <PillRow items={filters} value={kind} onChange={(k) => setKind(k)} contentPadding={GUTTER} />
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (first.loading) empty = <ActivitySkeleton rows={8} />;
  else if (!first.data && first.error) empty = <WalletState error={first.error} onRetry={() => void first.refresh()} />;
  else if (first.data && items.length === 0)
    empty = (
      <EmptyState
        illustration="emptyHistory"
        size={220}
        title={kind === "all" ? t("wallet.recent.emptyTitle") : t("common.noData")}
        body={kind === "all" ? t("wallet.recent.emptyText") : t("wallet.history.emptyText")}
        action={kind === "all" ? t("wallet.recent.firstDeposit") : undefined}
        onAction={kind === "all" ? () => router.push("/wallet/deposit") : undefined}
      />
    );

  const footer = loadingMore ? (
    <ActivitySkeleton rows={2} />
  ) : moreError ? (
    <Text variant="caption" tone="tertiary" align="center" style={{ padding: space[5] }} onPress={() => void loadMore()}>
      {`${moreError} · ${t("mobile.action.retry")}`}
    </Text>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeTop />
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        drawDistance={ACTIVITY_ROW_HEIGHT * 10}
        extraData={kind}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="history-list"
      />
      <ActivitySheet ref={sheet} onChanged={() => void first.refresh()} />
    </View>
  );
}

function SafeTop() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top }} />;
}

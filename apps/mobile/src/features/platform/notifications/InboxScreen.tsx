// Notifications inbox (/notifications): the Client Area bell's inbox on the phone. Grouped by day (Today, Yesterday,
// dates), unread first-class (dot, bold title, count), All / Unread, mark all read, pull to refresh, older pages as
// you scroll. A tap marks the notification read and opens its screen (deposit -> wallet history, margin call -> the
// account, support reply -> the chat …); one without a screen opens its full text in a sheet.
//
// Opens on the cached first page, then refreshes. Live while open through the support service's stream (new
// notifications, reads made on the web); a push that arrives refreshes it too (PlatformRoot), and a poll every 60 s
// covers a stream that can't connect. FlashList with fixed-height memoised rows and day headers of their own type.
// Offline with a saved page: the page plus a line saying so; offline with nothing saved: the connection-lost state.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { CheckCheck, Eye, Settings2, WifiOff } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { Banner, EmptyState, IconButton, PillRow, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { LargeTitle, TopBar, useScrollY } from "../components/Chrome";
import { clearInboxDetail, openResolved, openWeb, resolve, useInboxDetailRequest } from "../open";
import { PushCard } from "../push/PushUI";
import { supportStream } from "@/features/support/stream";
import { addCachedItem, fetchInbox, markAllRead, markCachedRead, markRead, PAGE, QK, setUnread, type InboxFilter, type InboxPage, type NotificationItem } from "./api";
import { DAY_H, DayHeader, DetailSheet, InboxSkeleton, NotificationRow, ROW_H, useLocalTime, type DetailHandle } from "./components";
import { groupByDay, type DayRow } from "./days";

type Row = DayRow<NotificationItem>;

export function InboxScreen() {
  const viewer = useSession((s) => !!s.viewer);
  if (viewer) return <ViewerInbox />;
  return <Inbox />;
}

/** View-only logins have no inbox (it is the account owner's). */
function ViewerInbox() {
  const t = useT();
  const { y } = useScrollY();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar y={y} fallback="/" />
      <LargeTitle eyebrow={t("mobilePlatform.inbox.eyebrow")} title={t("dashboard.notifications.title")} />
      <Banner tone="info" icon={<Eye size={18} color={colors.periwinkle} />} title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} style={{ marginHorizontal: GUTTER }} />
    </View>
  );
}

function Inbox() {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const online = useOnline();
  const bottom = useBottomInset(false);
  const { y, onScrollJs } = useScrollY();
  const time = useLocalTime();
  const detail = React.useRef<DetailHandle>(null);
  const [filter, setFilter] = React.useState<InboxFilter>("all");

  const first = useQuery<InboxPage>(QK.inbox(filter), () => fetchInbox(filter), { persist: true, staleMs: 15_000, intervalMs: 60_000 });
  const refreshFirst = first.refresh;

  // live while open: the support service's stream (one socket for the app, src/features/support/stream.ts) brings new
  // notifications and reads made elsewhere (the web bell, another phone)
  React.useEffect(
    () =>
      supportStream.subscribe((f) => {
        if (f.type === "notification" && f.item && typeof f.item === "object") addCachedItem(f.item as NotificationItem, Number(f.unread) || 0);
        else if (f.type === "notifications.read") {
          markCachedRead(f.all === true ? "all" : Array.isArray(f.ids) ? (f.ids as number[]) : []);
          if (typeof f.unread === "number") setUnread(f.unread);
        } else if (f.type === "reconnected") void refreshFirst();
      }),
    [refreshFirst],
  );
  // back online: refresh at once (the connection-lost state or a saved page gives way to the server's answer)
  const wasOnline = React.useRef(online);
  React.useEffect(() => {
    if (online && !wasOnline.current) void refreshFirst();
    wasOnline.current = online;
  }, [online, refreshFirst]);

  // older pages (not cached): reset when the filter changes or a refresh brings a first page with a different cursor
  // (the server's page moved, so the loaded pages could leave a gap). A notification arriving live goes on top of
  // the cached page without moving its cursor, and marking read moves nothing, so the pages scrolled to stay.
  const [older, setOlder] = React.useState<{ filter: InboxFilter; items: NotificationItem[]; next: number | null | undefined }>({ filter, items: [], next: undefined });
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [moreFailed, setMoreFailed] = React.useState(false);
  const pageKey = first.data ? String(first.data.next ?? 0) : "";
  React.useEffect(() => {
    setOlder({ filter, items: [], next: undefined });
    setMoreFailed(false);
  }, [filter, pageKey]);

  // the server's unread count follows every refresh (Home's bell and the icon badge with it)
  React.useEffect(() => {
    if (first.data) setUnread(first.data.unread);
  }, [first.data]);

  const items = React.useMemo(() => {
    const seen = new Set<number>();
    const out: NotificationItem[] = [];
    for (const n of [...(first.data?.items ?? []), ...(older.filter === filter ? older.items : [])]) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
    return out;
  }, [first.data, older, filter]);

  const next = older.filter === filter && older.next !== undefined ? older.next : (first.data?.next ?? null);
  const unread = first.data?.unread ?? 0;

  // a push tapped for a web page or no screen: show that notification (the server's copy) as soon as it is listed
  const wanted = useInboxDetailRequest();
  React.useEffect(() => {
    if (!wanted) return;
    if (Date.now() - wanted.at > 60_000) return clearInboxDetail();
    const n = items.find((x) => x.id === wanted.id);
    if (!n) return;
    clearInboxDetail();
    detail.current?.open(n);
  }, [wanted, items]);

  const dayLabel = React.useCallback(
    (_key: string, daysAgo: number, dayStart: number) => {
      if (daysAgo === 0) return t("common.today");
      if (daysAgo === 1) return t("common.yesterday");
      const sameYear = new Date(dayStart).getFullYear() === new Date().getFullYear();
      return fmt.date(dayStart, { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: undefined });
    },
    [t, fmt],
  );
  const rows = React.useMemo(() => groupByDay(items, Date.now(), dayLabel), [items, dayLabel]);

  const loadMore = React.useCallback(async () => {
    if (!next || loadingMore || !first.data) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const r = await fetchInbox(filter, next);
    setLoadingMore(false);
    if (!r.ok) return setMoreFailed(true);
    setOlder((prev) => ({ filter, items: [...(prev.filter === filter ? prev.items : []), ...r.data.items], next: r.data.items.length < PAGE ? null : r.data.next }));
  }, [next, loadingMore, first.data, filter]);

  const read = React.useCallback(async (ids: number[]) => {
    markCachedRead(ids);
    setOlder((prev) => ({ ...prev, items: prev.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) }));
    const r = await markRead(ids);
    if (r.ok) setUnread(r.data.unread);
  }, []);

  const open = React.useCallback(
    (n: NotificationItem) => {
      if (!n.read) void read([n.id]);
      const target = resolve(n.link);
      if (target?.kind === "route") openResolved(target);
      else detail.current?.open(n);
    },
    [read],
  );

  const readingAll = React.useRef(false);
  const readAll = async () => {
    if (readingAll.current) return;
    readingAll.current = true;
    const r = await markAllRead();
    readingAll.current = false;
    if (!r.ok) return toast.show({ title: r.error.message, tone: "error" });
    markCachedRead("all");
    setOlder((prev) => ({ ...prev, items: prev.items.map((n) => ({ ...n, read: true })) }));
    setUnread(r.data.unread);
    toast.show({ title: t("mobilePlatform.inbox.markedAll") });
  };

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await first.refresh();
    setRefreshing(false);
  }, [first.refresh]);

  const renderItem = React.useCallback(({ item }: ListRenderItemInfo<Row>) => (item.type === "day" ? <DayHeader label={item.label} /> : <NotificationRow item={item.item} time={time(item.item.createdAt)} onPress={open} />), [open, time]);

  const filters = React.useMemo(
    () => [
      { key: "all" as InboxFilter, label: t("common.all") },
      { key: "unread" as InboxFilter, label: t("mobilePlatform.inbox.filter.unread") },
    ],
    [t],
  );

  const header = (
    <View>
      <LargeTitle
        eyebrow={t("mobilePlatform.inbox.eyebrow")}
        title={t("dashboard.notifications.title")}
        subtitle={
          first.data ? (
            <Text tone={unread ? "ember" : "secondary"} weight={unread ? "700" : "400"} style={{ marginTop: space[1] }} testID="inbox-unread">
              {unread ? t("mobilePlatform.inbox.unread", { count: unread }) : t("mobilePlatform.inbox.caughtUp")}
            </Text>
          ) : undefined
        }
      />
      {!online && first.data ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginHorizontal: GUTTER, marginTop: -space[2], marginBottom: space[4] }} testID="inbox-offline">
          <WifiOff size={15} color={colors.text3} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            {t("mobilePlatform.inbox.offlineCached")}
          </Text>
        </View>
      ) : null}
      <PushCard />
      <PillRow items={filters} value={filter} onChange={setFilter} contentPadding={GUTTER} style={{ marginBottom: space[1] }} />
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (first.loading) empty = <InboxSkeleton />;
  else if (!first.data && first.error)
    empty = !online ? (
      <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void first.refresh()} />
    ) : (
      // the server out of reach (a network error while the phone is online): the connection-lost art
      <EmptyState illustration={first.error.code === "network" ? "connectionLost" : "maintenance"} title={t("mobile.state.error.title")} body={first.error.message} action={t("mobile.action.retry")} onAction={() => void first.refresh()} />
    );
  else if (first.data && items.length === 0)
    empty =
      filter === "unread" ? (
        <EmptyState illustration="mascot" size={220} title={t("mobilePlatform.inbox.emptyUnread.title")} body={t("mobilePlatform.inbox.emptyUnread.body")} />
      ) : (
        <EmptyState illustration="emptyHistory" size={220} title={t("dashboard.notifications.emptyTitle")} body={t("dashboard.notifications.emptyText")} />
      );

  const footer = loadingMore ? (
    <InboxSkeleton rows={2} />
  ) : moreFailed ? (
    <Text variant="caption" tone="tertiary" align="center" style={{ padding: space[5] }} onPress={() => void loadMore()}>
      {t("mobilePlatform.inbox.loadMoreFailed")}
    </Text>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="screen-inbox">
      <TopBar
        title={t("dashboard.notifications.title")}
        y={y}
        fallback="/"
        right={
          <>
            {unread > 0 ? <IconButton tone="ghost" accessibilityLabel={t("dashboard.notifications.markAll")} icon={<CheckCheck size={21} color={colors.text} />} onPress={() => void readAll()} /> : null}
            <IconButton tone="ghost" accessibilityLabel={t("mobilePlatform.inbox.a11y.settings")} icon={<Settings2 size={20} color={colors.text} />} onPress={() => router.push("/profile/notifications")} />
          </>
        }
      />
      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(r) => r.key}
        getItemType={(r) => r.type}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        drawDistance={ROW_H * 8 + DAY_H * 2}
        onScroll={onScrollJs}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="inbox-list"
      />
      <DetailSheet ref={detail} webUrl={(n) => (resolve(n.link)?.kind === "web" ? n.link : null)} onOpenWeb={(url) => void openWeb(url)} />
    </View>
  );
}

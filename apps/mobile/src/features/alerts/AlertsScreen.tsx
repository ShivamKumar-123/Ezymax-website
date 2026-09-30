// Price alerts (/alerts, optionally ?symbol= to open a new alert for it): the client's alerts, kept and checked on
// our servers on every price change (market-data), and the ones that triggered. Opens on the cached lists, then
// refreshes; pull to refresh; swipe an alert to delete it, tap to edit. The live numbers in the rows are leaf
// subscribers: a tick never re-renders the list. A trigger shows at once: its notification (the support service's
// realtime stream) refreshes both lists; otherwise they poll every 30 s while the screen is in front.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { Bell, Plus, ShieldAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { invalidate, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { useSharedValue } from "react-native-reanimated";
import { Banner, Button, ColorBlock, Display, EmptyState, Mono, PillRow, PressableScale, Sheet, Skeleton, Text, toast, useBottomInset, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { supportStream } from "../support/stream";
import { Page, PageTitle, StackBar } from "../depth/components/Chrome";
import { ALERTS_KEY, clearHistory, deleteAlert, fetchAlerts, fetchHistory, HISTORY_KEY, type AlertEvent, type PriceAlert } from "./api";
import { AlertSheet, type AlertSheetHandle } from "./components/AlertSheet";
import { AlertRow, ALERT_ROW_H, EVENT_ROW_H, EventRow } from "./components/rows";

type Tab = "active" | "history";
type Item = { kind: "alert"; a: PriceAlert } | { kind: "event"; e: AlertEvent };

const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;
const INK_SKELETON = alpha(colors.ink, 0.12);
const itemType = (i: Item) => i.kind;
const staffReadOnlyOf = (s: { user: unknown }) => (s.user as { impersonation?: { mode?: string } | null } | null)?.impersonation?.mode === "read_only";

export function AlertsScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const viewer = useSession((s) => !!s.viewer);
  // a read-only staff session ("log in as client") reads the client's alerts but changes nothing (the Client Area
  // proxy refuses its writes anyway): no New alert, edit, delete or Clear
  const readOnly = useSession(staffReadOnlyOf);
  const online = useOnline();
  const focused = useIsFocused();
  const [tab, setTab] = React.useState<Tab>("active");
  const list = useQuery(viewer ? null : ALERTS_KEY, fetchAlerts, { persist: true, staleMs: 5_000, intervalMs: focused ? 30_000 : undefined });
  const history = useQuery(viewer || tab !== "history" ? null : HISTORY_KEY, () => fetchHistory(), { persist: true, staleMs: 5_000 });
  const [older, setOlder] = React.useState<AlertEvent[]>([]);
  const [next, setNext] = React.useState<number | null>(null);
  const loadingMore = React.useRef(false);
  const sheet = React.useRef<AlertSheetHandle>(null);
  const clearSheet = React.useRef<SheetRef>(null);
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = React.useState(false);

  const max = list.data?.limit ?? 50;
  const live = list.data?.live ?? 0;

  // the first history page decides where "older" starts
  React.useEffect(() => {
    setOlder([]);
    setNext(history.data?.next ?? null);
  }, [history.data]);

  // a trigger lands at once: its notification comes over the app's realtime socket (the same one the notifications
  // inbox uses), and a reconnect may have missed one
  React.useEffect(() => {
    if (viewer) return;
    return supportStream.subscribe((f) => {
      const type = f.type === "notification" && f.item && typeof f.item === "object" ? (f.item as { type?: unknown }).type : null;
      if ((typeof type === "string" && type.startsWith("alerts.")) || f.type === "reconnected") invalidate("alerts/");
    });
  }, [viewer]);

  // /alerts?symbol=XAUUSD (Trade, Depth): open a new alert for it once, then drop the parameter (a reload or a
  // return to the screen doesn't open it again); the symbol stays the default of "New alert"
  const lastSymbol = React.useRef("XAUUSD");
  React.useEffect(() => {
    const s = typeof params.symbol === "string" ? params.symbol.toUpperCase() : "";
    if (!s || !SYMBOL_RE.test(s) || viewer || readOnly) return;
    lastSymbol.current = s;
    const id = setTimeout(() => {
      sheet.current?.create(s);
      router.setParams({ symbol: undefined });
    }, 250);
    return () => clearTimeout(id);
  }, [params.symbol, viewer, readOnly, router]);

  const newAlert = React.useCallback(() => {
    if (live >= max) {
      toast.show({ title: t("mobileDepth.alerts.limitReached", { max }), tone: "error" }, 4000);
      return;
    }
    sheet.current?.create(lastSymbol.current);
  }, [live, max, t]);

  const onOpen = React.useCallback((a: PriceAlert) => sheet.current?.edit(a), []);
  const onDelete = React.useCallback(
    async (a: PriceAlert) => {
      const r = await deleteAlert(a.id);
      if (r.ok) toast.show({ title: t("mobileDepth.toast.deleted") });
      else if (r.error.code !== "not_found") toast.show({ title: r.error.message, tone: "error" });
    },
    [t],
  );

  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await Promise.all([list.refresh(), tab === "history" ? history.refresh() : Promise.resolve()]);
    setRefreshing(false);
  }, [list, history, tab]);

  const loadOlder = React.useCallback(async () => {
    if (!next || loadingMore.current) return;
    loadingMore.current = true;
    const r = await fetchHistory(next);
    loadingMore.current = false;
    if (r.ok) {
      setOlder((o) => [...o, ...r.data.items]);
      setNext(r.data.next);
    }
  }, [next]);

  const clear = React.useCallback(async () => {
    const r = await clearHistory();
    if (r.ok) {
      setOlder([]);
      setNext(null);
      toast.show({ title: t("mobileDepth.toast.cleared") });
    } else toast.show({ title: r.error.message, tone: "error" });
  }, [t]);

  const items = React.useMemo<Item[]>(() => {
    if (tab === "active") return (list.data?.items ?? []).map((a) => ({ kind: "alert", a }));
    return [...(history.data?.items ?? []), ...older].map((e) => ({ kind: "event", e }));
  }, [tab, list.data, history.data, older]);

  const onDeleteRow = React.useCallback((a: PriceAlert) => void onDelete(a), [onDelete]);
  const renderItem = React.useCallback(({ item }: { item: Item }) => (item.kind === "alert" ? <AlertRow a={item.a} readOnly={readOnly} onOpen={onOpen} onDelete={onDeleteRow} /> : <EventRow e={item.e} />), [readOnly, onOpen, onDeleteRow]);

  const bar = <StackBar title={t("mobileDepth.alerts.title")} scrollY={scrollY} />;

  if (viewer) {
    return (
      <Page bar={<StackBar title={t("mobileDepth.alerts.title")} />}>
        <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} style={{ flex: 1, justifyContent: "center" }} />
      </Page>
    );
  }

  const q = tab === "active" ? list : history;
  const nothing = !q.data;
  const header = (
    <Header
      tab={tab}
      setTab={setTab}
      live={live}
      max={max}
      loading={!list.data}
      readOnly={readOnly}
      onNew={newAlert}
      canClear={!readOnly && tab === "history" && items.length > 0}
      onClear={() => clearSheet.current?.present()}
    />
  );

  let body: React.ReactNode = null;
  if (nothing && q.error) {
    const offline = !online || q.error.code === "network";
    body = (
      <EmptyState
        illustration={offline ? "connectionLost" : "maintenance"}
        title={offline ? t("mobile.state.offline.title") : t("mobile.state.error.title")}
        body={offline ? t("mobile.state.offline.body") : q.error.code === "unavailable" ? t("mobileDepth.alerts.unavailable") : t("mobile.state.error.body")}
        action={t("mobile.action.retry")}
        onAction={() => void q.refresh()}
      />
    );
  } else if (nothing) {
    body = <RowsSkeleton height={tab === "active" ? ALERT_ROW_H : EVENT_ROW_H} />;
  } else if (!items.length) {
    body =
      tab === "active" ? (
        <EmptyState illustration="market" title={t("mobileDepth.alerts.empty.title")} body={t("mobileDepth.alerts.empty.body")} action={readOnly ? undefined : t("mobileDepth.alerts.empty.action")} onAction={readOnly ? undefined : newAlert} />
      ) : (
        <EmptyState illustration="emptyHistory" title={t("mobileDepth.alerts.history.empty.title")} body={t("mobileDepth.alerts.history.empty.body")} />
      );
  }

  return (
    <Page bar={bar}>
      <FlashList
        data={body ? [] : items}
        keyExtractor={(i) => (i.kind === "alert" ? `a${i.a.id}` : `e${i.e.id}`)}
        getItemType={itemType}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={body ? <View>{body}</View> : null}
        ListFooterComponent={<Footer />}
        onEndReached={tab === "history" ? () => void loadOlder() : undefined}
        onEndReachedThreshold={0.5}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <AlertSheet ref={sheet} max={max} />
      <Sheet ref={clearSheet}>
        <View style={{ gap: space[4] }}>
          <Display size="md">{t("mobileDepth.alerts.history.clearTitle")}</Display>
          <Text tone="secondary">{t("mobileDepth.alerts.history.clearBody")}</Text>
          <Button
            label={t("mobileDepth.alerts.history.clear")}
            testID="history-clear-confirm"
            onPress={() => {
              clearSheet.current?.dismiss();
              void clear();
            }}
          />
          <Button label={t("common.cancel")} variant="ghost" onPress={() => clearSheet.current?.dismiss()} />
        </View>
      </Sheet>
    </Page>
  );
}

const Header = React.memo(function Header({ tab, setTab, live, max, loading, readOnly, onNew, canClear, onClear }: { tab: Tab; setTab: (t: Tab) => void; live: number; max: number; loading: boolean; readOnly: boolean; onNew: () => void; canClear: boolean; onClear: () => void }) {
  const t = useT();
  return (
    <View>
      <PageTitle eyebrow={t("mobileDepth.alerts.eyebrow")} title={t("mobileDepth.alerts.title")} />
      <View style={{ paddingHorizontal: GUTTER, marginBottom: space[5] }}>
        <ColorBlock color="gold" style={{ gap: space[4] }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
            <View style={{ gap: 2 }}>
              <Text variant="label" color={colors.ink2}>
                {t("mobileDepth.alerts.live")}
              </Text>
              {loading ? <Skeleton w={96} h={60} r={radius.xs} style={{ backgroundColor: INK_SKELETON }} /> : <Display size="hero" color={colors.ink} testID="alerts-live">{String(live)}</Display>}
              <Mono size={13} weight="medium" color={colors.ink2}>
                {t("mobileDepth.alerts.of", { n: live, max })}
              </Mono>
            </View>
            <Bell size={56} color={colors.ink} strokeWidth={1.4} />
          </View>
          <Text variant="callout" color={colors.ink2}>
            {t("mobileDepth.alerts.server")}
          </Text>
          {readOnly ? null : (
            <PressableScale onPress={onNew} accessibilityRole="button" accessibilityLabel={t("mobileDepth.alerts.new")} testID="alerts-new" style={{ height: 52, borderRadius: radius.pill, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}>
              <Plus size={18} color={colors.cream} strokeWidth={2.4} />
              <Text variant="headline" weight="700" color={colors.cream}>
                {t("mobileDepth.alerts.new")}
              </Text>
            </PressableScale>
          )}
        </ColorBlock>
      </View>
      {readOnly ? <Banner tone="warn" icon={<ShieldAlert size={18} color={colors.gold} />} title={t("mobileDepth.alerts.staffReadOnly")} style={{ marginHorizontal: GUTTER, marginBottom: space[5] }} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space[2] }}>
        <PillRow<Tab>
          items={[
            { key: "active", label: t("mobileDepth.alerts.tab.active") },
            { key: "history", label: t("mobileDepth.alerts.tab.history") },
          ]}
          value={tab}
          onChange={setTab}
          compact
          style={{ flex: 1 }}
        />
        {canClear ? <Button label={t("mobileDepth.alerts.history.clear")} variant="ghost" size="sm" full={false} onPress={onClear} style={{ marginHorizontal: GUTTER - 4 }} /> : null}
      </View>
    </View>
  );
});

function Footer() {
  const t = useT();
  const router = useRouter();
  // a stack screen without the tab bar: the list's end clears the home indicator
  const bottom = useBottomInset(false);
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], paddingBottom: bottom + space[6] }}>
      <Banner tone="info" icon={<Bell size={18} color={colors.text2} />} title={t("mobileDepth.alerts.deliveryTitle")} body={t("mobileDepth.alerts.delivery")} action={t("mobileDepth.alerts.delivery.action")} onAction={() => router.push("/profile/notifications")} />
    </View>
  );
}

/** Shaped like the rows (static). */
function RowsSkeleton({ height }: { height: number }) {
  const t = useT();
  return (
    <View accessibilityLabel={t("common.loading")} accessible>
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={{ height, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Skeleton w={4} h={36} r={2} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton w={84} h={14} />
            <Skeleton w={150} h={11} />
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Skeleton w={80} h={14} />
            <Skeleton w={56} h={10} />
          </View>
        </View>
      ))}
    </View>
  );
}


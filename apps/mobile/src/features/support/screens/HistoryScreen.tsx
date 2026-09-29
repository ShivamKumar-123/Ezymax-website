// /support/history: every support conversation, newest first (subject, date, rating, status). Opens on the cached
// list, refreshes in the background and on pull. A row opens the read-only transcript (warmed on press-in).
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, MessageSquareText, Star } from "lucide-react-native";
import { useFormat, useLocale, useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { prefetch, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { Display, EmptyState, PressableScale, SkeletonRows, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { ChatHeader } from "@/features/chat/ChatHeader";
import { fetchHistory, fetchTranscript, HISTORY_KEY, transcriptKey, type ConvStatus, type Conversation } from "../api";
import { useSupportStream } from "../chat";

const ROW_H = 76;
const STATUS: Record<ConvStatus, { label: MessageKey; color: string }> = {
  bot: { label: "support.status.bot", color: colors.periwinkle },
  waiting: { label: "support.status.waiting", color: colors.gold },
  assigned: { label: "support.status.assigned", color: colors.mint },
  resolved: { label: "support.status.resolved", color: colors.text3 },
};

const warm = (id: number) => prefetch(transcriptKey(id), () => fetchTranscript(id), { persist: true, staleMs: 15_000 });

const Row = React.memo(function Row({ c, onOpen }: { c: Conversation; onOpen: (id: number) => void }) {
  const t = useT();
  const fmt = useFormat();
  const { rtl } = useLocale();
  const st = STATUS[c.status] ?? STATUS.resolved;
  return (
    <PressableScale
      scaleTo={0.985}
      onPressIn={() => warm(c.id)}
      onPress={() => onOpen(c.id)}
      accessibilityLabel={`${c.subject || t("support.conversation")}, ${t(st.label)}`}
      testID={`support-conv-${c.id}`}
      style={{ height: ROW_H, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <MessageSquareText size={18} color={colors.text2} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <Text variant="headline" weight="600" numberOfLines={1}>
          {c.subject || t("support.conversation")}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${t(st.label)} · ${fmt.date(c.lastMessageAt || c.createdAt, { day: "numeric", month: "short", year: "numeric", timeZone: undefined })}`}
          </Text>
          {c.csat ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Star size={12} color={colors.gold} fill={colors.gold} />
              <Text variant="caption" tone="secondary">
                {String(c.csat.rating)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
        <ChevronRight size={18} color={colors.text3} />
      </View>
    </PressableScale>
  );
});

export function HistoryScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const viewer = useSession((s) => !!s.viewer);
  useSupportStream();
  const q = useQuery(HISTORY_KEY, fetchHistory, { persist: true, staleMs: 20_000, enabled: !viewer });
  const [refreshing, setRefreshing] = React.useState(false);
  const open = React.useCallback((id: number) => router.push(`/support/${id}`), [router]);
  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await q.refresh();
    setRefreshing(false);
  }, [q]);
  const items = q.data?.items ?? [];

  const title = (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[4], gap: space[1] }}>
      <Text variant="label" tone="tertiary">
        {t("support.page.title")}
      </Text>
      <Display size="xl" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
        {t("support.history.title")}
      </Display>
      <Text variant="callout" tone="secondary">
        {t("support.history.subtitle")}
      </Text>
    </View>
  );

  let body: React.ReactNode;
  if (viewer) body = <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t("mobileAi.support.viewOnly")} />;
  else if (!q.data && q.error)
    body = !online ? (
      <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void q.refresh()} />
    ) : (
      <EmptyState illustration="maintenance" title={t("mobile.state.error.title")} body={q.error.message} action={t("mobile.action.retry")} onAction={() => void q.refresh()} />
    );
  else if (!q.data)
    body = (
      <>
        {title}
        <SkeletonRows rows={6} height={ROW_H} />
      </>
    );
  else
    body = (
      <FlashList
        data={items}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <Row c={item} onOpen={open} />}
        ListHeaderComponent={title}
        ListEmptyComponent={<EmptyState illustration="emptyHistory" title={t("support.history.emptyTitle")} body={t("support.history.emptyText")} action={t("mobileAi.support.startChat")} onAction={() => (router.canGoBack() ? router.back() : router.replace("/support"))} />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, space[4]) + space[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="support-history"
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ChatHeader title={t("support.history.title")} subtitle={items.length ? t("mobileAi.support.count", { count: items.length }) : undefined} />
      {body}
    </View>
  );
}

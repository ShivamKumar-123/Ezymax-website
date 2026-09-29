// /support/[id]: one past conversation, read-only, with its attachments. A conversation that is still open offers
// "Continue in chat" (the live chat at /support). Opens on the cached transcript; new messages of an open one
// arrive live through the stream.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { Button, EmptyState, Skeleton } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { ChatHeader } from "@/features/chat/ChatHeader";
import { DayDivider } from "@/features/chat/Bubble";
import { dayLabel, sameDay } from "@/features/chat/time";
import { fetchTranscript, transcriptKey, type Message } from "../api";
import { useSupportStream } from "../chat";
import { MessageRow } from "../components/MessageRow";

type Item = { key: string; type: "day"; label: string } | { key: string; type: "msg"; m: Message; above: boolean; below: boolean; time: boolean };
const GROUP_MS = 3 * 60_000;

export function TranscriptScreen() {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const viewer = useSession((s) => !!s.viewer);
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = /^\d{1,18}$/.test(String(raw)) ? Number(raw) : null;
  useSupportStream();
  const q = useQuery(id ? transcriptKey(id) : null, () => fetchTranscript(id!), { persist: true, staleMs: 15_000, enabled: !viewer });
  const conv = q.data?.conversation;
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await q.refresh();
    setRefreshing(false);
  }, [q]);

  const items = React.useMemo<Item[]>(() => {
    const msgs = q.data?.messages ?? [];
    const out: Item[] = [];
    msgs.forEach((m, i) => {
      const prev = msgs[i - 1];
      const next = msgs[i + 1];
      if (!prev || !sameDay(prev.createdAt, m.createdAt)) out.push({ key: `d${m.id}`, type: "day", label: dayLabel(t, fmt, m.createdAt) });
      const same = (a?: Message, b?: Message) => !!a && !!b && a.author !== "system" && a.author === b.author && a.authorName === b.authorName && Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < GROUP_MS && sameDay(a.createdAt, b.createdAt);
      out.push({ key: `m${m.id}`, type: "msg", m, above: same(prev, m), below: same(m, next), time: !same(prev, m) });
    });
    return out;
  }, [q.data, t, fmt]);

  const status = conv?.status;
  const subtitle = conv ? `${fmt.date(conv.createdAt, { day: "numeric", month: "short", year: "numeric", timeZone: undefined })} · ${t.dyn(`support.status.${status}`, status ?? "")}` : undefined;

  let body: React.ReactNode;
  if (viewer) body = <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t("mobileAi.support.viewOnly")} />;
  else if (id === null || (!q.data && q.error))
    body =
      id === null || q.error?.status === 404 ? (
        <EmptyState illustration="emptyHistory" title={t("mobileAi.support.notFound")} action={t("mobile.a11y.back")} onAction={() => (router.canGoBack() ? router.back() : router.replace("/support"))} />
      ) : !online ? (
        <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void q.refresh()} />
      ) : (
        <EmptyState illustration="maintenance" title={t("mobile.state.error.title")} body={q.error?.message} action={t("mobile.action.retry")} onAction={() => void q.refresh()} />
      );
  else if (!q.data)
    body = (
      <View style={{ padding: GUTTER, gap: space[4] }}>
        <Skeleton w="70%" h={64} r={radius.lg} />
        <Skeleton w="50%" h={44} r={radius.lg} style={{ alignSelf: "flex-end" }} />
        <Skeleton w="76%" h={88} r={radius.lg} />
      </View>
    );
  else
    body = (
      <FlashList
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => (item.type === "day" ? <View style={{ paddingTop: space[5] }}><DayDivider label={item.label} /></View> : <MessageRow m={item.m} botName={t("mobileAi.botName")} groupedAbove={item.above} groupedBelow={item.below} showTime={item.time} />)}
        getItemType={(i) => (i.type === "day" ? "day" : i.m.author === "system" ? "system" : i.m.attachment ? "attachment" : i.m.author)}
        contentContainerStyle={{ paddingBottom: space[6] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="support-transcript"
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ChatHeader title={conv?.subject || t("support.conversation")} subtitle={subtitle} dot={status === "resolved" ? "muted" : status === "assigned" ? "mint" : status === "waiting" ? "gold" : "periwinkle"} />
      {body}
      {conv && status !== "resolved" ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: Math.max(insets.bottom, space[3]), borderTopWidth: 1, borderTopColor: colors.line }}>
          <Button label={t("mobileAi.support.continue")} onPress={() => router.navigate("/support")} testID="support-continue" />
        </View>
      ) : null}
    </View>
  );
}

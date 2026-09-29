// /support: live chat with the Kalks AI help bot and the support team (services/support). The bot answers first,
// streamed word by word; "Talk to a person" hands the conversation to the team with the whole transcript, and an
// agent's replies and typing arrive live. Photos and PDFs can be attached. A finished chat can be rated, and past
// conversations are one tap away. Opens at once on the last conversation (cached), then refreshes.
import * as React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useIsFocused, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FileText, History, Image as ImageIcon, MoreHorizontal, RotateCcw, UserRound, XCircle } from "lucide-react-native";
import { useT, type MessageKey } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { prefetch, useQuery } from "@/lib/query";
import { useStore } from "@/lib/store";
import { useMe, useSession } from "@/session";
import { EmptyState, IconButton, Skeleton, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { ActionSheet, type Action } from "@/features/chat/ActionSheet";
import { AuthorLine, Bubble, ChatRow } from "@/features/chat/Bubble";
import { ChatHeader, type HeaderDot } from "@/features/chat/ChatHeader";
import { Composer, type ComposerHandle } from "@/features/chat/Composer";
import { InitialsAvatar, MascotAvatar } from "@/features/chat/MascotAvatar";
import { Rich } from "@/features/chat/Rich";
import { Suggestions, type Suggestion } from "@/features/chat/Suggestions";
import { fetchHistory, fetchHome, HISTORY_KEY, HOME_KEY, uploadAttachment, type Home, type Message } from "../api";
import { agentTyping, botStream, endChat, handover, markRead, send, startNew, typing, useSupportStream } from "../chat";
import { pickFile, pickPhoto, prepare } from "../files";
import { StreamingBubble, TypingBubble } from "../components/Live";
import { SupportIntro } from "../components/Intro";
import { MessageRow } from "../components/MessageRow";
import { RatingCard } from "../components/RatingCard";

type Item = { key: string; type: "greeting" } | { key: string; type: "msg"; m: Message; above: boolean; below: boolean; time: boolean } | { key: string; type: "stream" } | { key: string; type: "typing" } | { key: string; type: "csat" };

const QUICK: MessageKey[] = ["support.quick.verify", "support.quick.deposit", "support.quick.withdrawal", "support.quick.stopOut"];
const GROUP_MS = 3 * 60_000;

const warmHistory = () => prefetch(HISTORY_KEY, fetchHistory, { persist: true, staleMs: 30_000 });

function items(home: Home | undefined, streaming: boolean, typingAgent: boolean): Item[] {
  const out: Item[] = [];
  const conv = home?.conversation ?? null;
  const msgs = home?.messages ?? [];
  if (!conv || !msgs.length) out.push({ key: "greeting", type: "greeting" });
  msgs.forEach((m, i) => {
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    const same = (a?: Message, b?: Message) => !!a && !!b && a.author !== "system" && a.author === b.author && a.authorName === b.authorName && Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < GROUP_MS;
    out.push({ key: `m${m.id}`, type: "msg", m, above: same(prev, m), below: same(m, next), time: !same(prev, m) });
  });
  if (streaming && conv?.status !== "resolved") out.push({ key: "stream", type: "stream" });
  if (typingAgent && conv?.status === "assigned") out.push({ key: "typing", type: "typing" });
  if (conv?.status === "resolved" && msgs.some((m) => m.author === "agent" || m.author === "bot")) out.push({ key: `csat${conv.id}`, type: "csat" });
  return out;
}

function LoadingBubbles() {
  return (
    <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: GUTTER, paddingBottom: space[5], gap: space[4] }} accessibilityLabel="Loading" accessible>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
        <Skeleton w={32} h={32} r={16} />
        <Skeleton w="68%" h={74} r={radius.lg} />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Skeleton w="52%" h={44} r={radius.lg} />
      </View>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
        <Skeleton w={32} h={32} r={16} />
        <Skeleton w="74%" h={96} r={radius.lg} />
      </View>
    </View>
  );
}

export function SupportScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const online = useOnline();
  const me = useMe();
  const viewer = useSession((s) => !!s.viewer);
  useSupportStream();
  const q = useQuery(HOME_KEY, fetchHome, { persist: true, staleMs: 10_000, enabled: !viewer });
  const home = q.data;
  const conv = home?.conversation ?? null;
  const settings = home?.settings;
  const botName = settings?.botName ?? t("mobileAi.botName");
  const streaming = useStore(botStream, (s) => s !== null);
  const typingAgent = useStore(agentTyping, (v) => v !== null);
  const status = conv?.status;
  const resolved = status === "resolved";
  const human = status === "waiting" || status === "assigned";
  const list = React.useRef<FlashListRef<Item>>(null);
  const composer = React.useRef<ComposerHandle>(null);
  const menu = React.useRef<SheetRef>(null);
  const attachSheet = React.useRef<SheetRef>(null);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  // past conversations are one tap away: warm them after the first paint
  React.useEffect(() => {
    if (viewer) return;
    const id = setTimeout(warmHistory, 1500);
    return () => clearTimeout(id);
  }, [viewer]);

  // the open chat reads everything (the unread badge elsewhere clears)
  React.useEffect(() => {
    if (focused && conv && conv.clientUnread > 0) void markRead();
  }, [focused, conv?.id, conv?.clientUnread]);

  const data = React.useMemo(() => items(home, streaming, typingAgent), [home, streaming, typingAgent]);

  const scrollToEnd = React.useCallback(() => {
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
  }, []);

  const doSend = React.useCallback(
    async (text: string, attachmentId?: number) => {
      setSending(true);
      scrollToEnd();
      const r = await send(text, attachmentId);
      setSending(false);
      if (!r.ok) {
        haptic.error();
        toast.show({ title: t("support.toast.notSent"), body: r.error, tone: "error" });
        if (text) composer.current?.setText(text);
        return false;
      }
      scrollToEnd();
      return true;
    },
    [scrollToEnd, t],
  );

  const onSend = React.useCallback((text: string) => void doSend(text), [doSend]);

  const talkToPerson = React.useCallback(async () => {
    if (human) {
      toast.show({ title: status === "assigned" && conv?.assigneeName ? t("support.toast.chattingWith", { name: conv.assigneeName }) : t("support.toast.inQueue") });
      return;
    }
    const r = await handover();
    if (!r.ok) {
      haptic.error();
      toast.show({ title: t("support.toast.teamUnreachable"), body: r.error, tone: "error" });
      return;
    }
    haptic.success();
    scrollToEnd();
  }, [conv?.assigneeName, human, scrollToEnd, status, t]);

  const end = React.useCallback(async () => {
    if (!conv) return;
    const r = await endChat(conv.id);
    if (!r.ok) toast.show({ title: t("support.toast.endFailed"), body: r.error, tone: "error" });
    else scrollToEnd();
  }, [conv, scrollToEnd, t]);

  const attach = React.useCallback(
    async (kind: "photo" | "file") => {
      const p = kind === "photo" ? await pickPhoto() : await pickFile();
      if (p === "denied") {
        toast.show({ title: t("mobileAi.support.photosDenied"), tone: "error" });
        return;
      }
      if (!p) return;
      const max = settings?.maxAttachmentMb ?? 10;
      const c = await prepare(p, max);
      if (!c.ok) {
        haptic.error();
        toast.show(c.reason === "type" ? { title: t("support.toast.unsupported"), body: t("support.toast.unsupportedText"), tone: "error" } : { title: t("support.toast.fileTooLarge"), body: t("support.toast.fileTooLargeText", { mb: max }), tone: "error" });
        return;
      }
      setUploading(0);
      const up = await uploadAttachment(c.blob, p.name, p.mime, setUploading);
      if (!up.ok) {
        setUploading(null);
        haptic.error();
        toast.show({ title: t("support.toast.uploadFailed"), body: up.error.message, tone: "error" });
        return;
      }
      const text = composer.current?.text().trim() ?? "";
      composer.current?.setText("");
      await doSend(text, up.data.attachment.id);
      setUploading(null);
    },
    [doSend, settings?.maxAttachmentMb, t],
  );

  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    await q.refresh();
    setRefreshing(false);
  }, [q]);

  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      switch (item.type) {
        case "greeting":
          return (
            <View style={{ paddingTop: space[4] }}>
              <ChatRow avatar={<MascotAvatar size={32} />}>
                <AuthorLine name={botName} />
                <Bubble tone="bot">
                  <Rich text={`${t("support.greeting", { name: me?.first_name ?? "" })} ${(settings?.greeting ?? "").replace(/^Hi[^.]*\.\s*/, "")}`.trim()} color={colors.text} linkColor={colors.ember} />
                </Bubble>
              </ChatRow>
            </View>
          );
        case "msg":
          return <MessageRow m={item.m} botName={botName} groupedAbove={item.above} groupedBelow={item.below} showTime={item.time} />;
        case "stream":
          return <StreamingBubble botName={botName} />;
        case "typing":
          return <TypingBubble name={conv?.assigneeName ?? t("support.agent")} />;
        case "csat":
          return conv ? <RatingCard conv={conv} /> : null;
      }
    },
    [botName, conv, me?.first_name, settings?.greeting, t],
  );

  // header: who you're talking to
  const agentName = conv?.assigneeName;
  const title = status === "assigned" && agentName ? agentName : status === "waiting" ? t("support.header.supportTeam") : botName;
  // short status labels (the longer "connecting you…" lines are in the conversation itself)
  const subtitle = status === "assigned" ? t("support.chip.liveAgent") : status === "waiting" ? t("support.status.waiting") : resolved ? t("support.status.resolved") : t("support.status.bot");
  const dot: HeaderDot = status === "assigned" ? "mint" : status === "waiting" ? "gold" : resolved ? "muted" : "periwinkle";
  const avatar = status === "assigned" && agentName ? <InitialsAvatar name={agentName} size={36} tone="mint" /> : <MascotAvatar size={36} />;

  const suggestions: Suggestion[] = resolved
    ? [{ key: "new", label: t("support.menu.newChat"), tone: "cream" }]
    : !conv || (status === "bot" && (home?.messages.length ?? 0) < 3)
      ? [...QUICK.map((k) => ({ key: k, label: t(k) })), ...(!human ? [{ key: "person", label: t("support.menu.talkToPerson"), icon: <UserRound size={15} color={colors.text} /> }] : [])]
      : status === "bot"
        ? [{ key: "person", label: t("support.menu.talkToPerson"), icon: <UserRound size={15} color={colors.text} /> }]
        : [];
  const onPick = React.useCallback(
    (key: string) => {
      if (key === "new") return startNew();
      if (key === "person") return void talkToPerson();
      onSend(t(key as MessageKey));
    },
    [onSend, t, talkToPerson],
  );

  const actions: Action[] = [
    ...(!human && !resolved ? [{ key: "person", label: t("support.menu.talkToPerson"), icon: <UserRound size={18} color={colors.text} />, onPress: () => void talkToPerson() }] : []),
    ...(conv && !resolved ? [{ key: "end", label: t("support.menu.endChat"), icon: <XCircle size={18} color={colors.text} />, onPress: () => void end() }] : []),
    ...(resolved ? [{ key: "new", label: t("support.menu.newChat"), icon: <RotateCcw size={18} color={colors.text} />, onPress: startNew }] : []),
    { key: "history", label: t("support.history.title"), hint: t("mobileAi.support.historyHint"), icon: <History size={18} color={colors.text} />, onPress: () => router.push("/support/history") },
  ];

  const agentsOnline = settings?.agentsOnline ?? 0;
  const aiOn = settings?.ai !== false;
  const intro = React.useMemo(() => <SupportIntro agentsOnline={agentsOnline} ai={aiOn} />, [agentsOnline, aiOn]);

  const blocked = viewer || q.error?.code === "viewer_out_of_scope" || q.error?.code === "viewer_read_only";
  let body: React.ReactNode;
  if (blocked) body = <EmptyState illustration="security" title={t("mobile.viewOnly")} body={t("mobileAi.support.viewOnly")} />;
  else if (!home && q.error)
    body = !online ? (
      <EmptyState illustration="connectionLost" title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void q.refresh()} />
    ) : (
      <EmptyState illustration="maintenance" title={t("support.unavailable")} body={q.error.message} action={t("mobile.action.retry")} onAction={() => void q.refresh()} />
    );
  else if (!home) body = <LoadingBubbles />;
  else
    body = (
      <FlashList
        ref={list}
        data={data}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        getItemType={(i) => (i.type === "msg" ? (i.m.author === "system" ? "system" : i.m.attachment ? "attachment" : i.m.author) : i.type)}
        ListHeaderComponent={intro}
        contentContainerStyle={{ paddingBottom: space[5] }}
        maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.25 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
        testID="support-list"
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "web" ? undefined : "padding"}>
        <ChatHeader
          testID="support-header"
          avatar={avatar}
          title={title}
          subtitle={subtitle}
          dot={dot}
          right={
            blocked ? null : (
              <>
                <IconButton tone="ghost" accessibilityLabel={t("support.history.title")} icon={<History size={21} color={colors.text2} strokeWidth={1.9} />} onPress={() => router.push("/support/history")} />
                <IconButton tone="ghost" accessibilityLabel={t("support.menu.aria")} icon={<MoreHorizontal size={22} color={colors.text2} />} onPress={() => menu.current?.present()} />
              </>
            )
          }
        />
        {body}
        {blocked || (!home && q.error) ? null : (
          <Composer
            ref={composer}
            testID="support-composer"
            placeholder={status === "assigned" && agentName ? t("support.composer.messageTo", { name: agentName.split(" ")[0] ?? agentName }) : status === "waiting" ? t("mobileAi.support.writeTeam") : resolved ? t("support.composer.newChat") : t("support.composer.ask", { name: botName })}
            onSend={onSend}
            busy={sending}
            onAttach={() => attachSheet.current?.present()}
            attaching={uploading !== null}
            disabled={!home}
            onTyping={typing}
            onKeyboardShow={scrollToEnd}
            top={
              <>
                {uploading !== null ? (
                  <View style={{ paddingHorizontal: GUTTER, paddingBottom: space[2] }}>
                    <Text variant="caption" tone="secondary" testID="support-uploading">
                      {t("mobileAi.support.uploading", { pct: uploading })}
                    </Text>
                  </View>
                ) : null}
                <Suggestions items={suggestions} onPick={onPick} disabled={sending || !home} testID="support-suggest" />
              </>
            }
            footer={
              <Text variant="caption" tone="tertiary" align="center" style={{ fontSize: 11 }}>
                {t("support.disclaimer", { name: botName })}
              </Text>
            }
          />
        )}
      </KeyboardAvoidingView>
      <ActionSheet ref={menu} title={t("mobileAi.support.options")} actions={actions} testID="support-menu" />
      <ActionSheet
        ref={attachSheet}
        title={t("support.composer.attach")}
        testID="support-attach"
        actions={[
          { key: "photo", label: t("mobileAi.support.attachPhoto"), hint: t("mobileAi.support.attachPhotoHint"), icon: <ImageIcon size={18} color={colors.text} />, onPress: () => void attach("photo") },
          { key: "file", label: t("mobileAi.support.attachFile"), hint: t("mobileAi.support.attachFileHint", { mb: settings?.maxAttachmentMb ?? 10 }), icon: <FileText size={18} color={colors.text} />, onPress: () => void attach("file") },
        ]}
      />
    </View>
  );
}

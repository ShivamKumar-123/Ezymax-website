// /ai: AI Trader. The client describes a strategy in plain words; the algo service's assistant (Claude, server
// side) returns exact rules as a strategy card with its assumptions and questions. The client edits the key
// numbers, backtests it, and deploys it on a demo or live account only through the Deploy sheet's explicit
// confirmation. The conversation opens where it was left (kept on this phone), newest message at the bottom.
import * as React from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RotateCcw } from "lucide-react-native";
import { useFormat, useT, type MessageKey } from "@/i18n";
import { prefetch, useQuery } from "@/lib/query";
import { useStore } from "@/lib/store";
import { useMe, useSession } from "@/session";
import { EmptyState, IconButton, Text, type SheetRef } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { AuthorLine, Bubble, ChatRow, SystemNote } from "@/features/chat/Bubble";
import { ChatHeader, HeaderPill } from "@/features/chat/ChatHeader";
import { Composer, type ComposerHandle } from "@/features/chat/Composer";
import { ConfirmSheet } from "@/features/chat/ConfirmSheet";
import { MascotAvatar } from "@/features/chat/MascotAvatar";
import { Rich } from "@/features/chat/Rich";
import { Suggestions, type Suggestion } from "@/features/chat/Suggestions";
import { clock } from "@/features/chat/time";
import { ACCOUNTS_KEY, fetchAccounts } from "@/features/trading/accounts";
import { useTradeSymbol } from "@/features/trade/symbol";
import { fetchMenu, QK as PROFILE_QK } from "@/features/profile/api";
import { useMeta } from "../api";
import { BacktestCard } from "../components/BacktestCard";
import { BacktestSheet } from "../components/BacktestSheet";
import { DeployedCard } from "../components/DeployedCard";
import { DeploySheet } from "../components/DeploySheet";
import { Drafting } from "../components/Drafting";
import { EditSheet } from "../components/EditSheet";
import { Intro } from "../components/Intro";
import { BlockButton, RiskNote } from "../components/parts";
import { StrategyCard } from "../components/StrategyCard";
import { specKey } from "../spec";
import { ask, hydrateThread, latestDraft, newThread, stopAsking, stopBacktest, threadStore, type AiMessage } from "../thread";

type Item = { key: string; type: "greeting" } | { key: string; type: "msg"; m: AiMessage; head: boolean } | { key: string; type: "pending"; startedAt: number };

const EXAMPLES: { key: string; label: MessageKey; prompt: MessageKey }[] = [
  { key: "ema", label: "mobileAi.example.ema.label", prompt: "mobileAi.example.ema.prompt" },
  { key: "gold", label: "mobileAi.example.gold.label", prompt: "mobileAi.example.gold.prompt" },
  { key: "rsi", label: "mobileAi.example.rsi.label", prompt: "mobileAi.example.rsi.prompt" },
  { key: "london", label: "mobileAi.example.london.label", prompt: "mobileAi.example.london.prompt" },
];
const REFINE: { key: string; label: MessageKey }[] = [
  { key: "trailing", label: "mobileAi.refine.trailing" },
  { key: "session", label: "mobileAi.refine.session" },
  { key: "risk", label: "mobileAi.refine.risk" },
  { key: "limit", label: "mobileAi.refine.limit" },
  { key: "longOnly", label: "mobileAi.refine.longOnly" },
];

const noop = () => {};
const warmAccounts = () => prefetch(ACCOUNTS_KEY, fetchAccounts, { persist: true, staleMs: 15_000 });

/** An assistant row: the mascot and "Kalks AI · 14:02" on the first item after the client spoke. */
function AssistantHead({ at }: { at?: number }) {
  const fmt = useFormat();
  const t = useT();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: 16, marginBottom: space[2] }}>
      <MascotAvatar size={28} />
      <AuthorLine name={t("mobileAi.botName")} time={at ? clock(fmt, at) : undefined} />
    </View>
  );
}

export function AiTraderScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const viewer = useSession((s) => !!s.viewer);
  const meta = useMeta();
  // the broker's module switches (the More tab's cached menu): AI Trader belongs to the algo module
  const menu = useQuery(PROFILE_QK.menu, fetchMenu, { persist: true, staleMs: 60_000, enabled: !viewer });
  const chartSymbol = useTradeSymbol();
  // this user's conversation, loaded before the first frame (a synchronous read of the phone's storage)
  React.useState(hydrateThread);
  const messages = useStore(threadStore, (s) => s.messages);
  const pending = useStore(threadStore, (s) => s.pending);
  const list = React.useRef<FlashListRef<Item>>(null);
  const composer = React.useRef<ComposerHandle>(null);
  const editSheet = React.useRef<SheetRef>(null);
  const btSheet = React.useRef<SheetRef>(null);
  const deploySheet = React.useRef<SheetRef>(null);
  const confirmNew = React.useRef<SheetRef>(null);

  React.useEffect(() => {
    hydrateThread();
  }, [me?.id]);

  const latest = latestDraft(messages);
  const latestId = latest?.id ?? null;
  // the version a backtest card may deploy: the newest draft's saved version while it is unchanged
  const deployable = latest?.saved && latest.saved.key === specKey(latest.built.spec) ? latest.saved.versionId : null;

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = [{ key: "greeting", type: "greeting" }];
    let prevAssistant = true; // the greeting is the assistant's
    for (const m of messages) {
      const assistant = m.kind !== "user" && m.kind !== "notice";
      out.push({ key: m.id, type: "msg", m, head: assistant && !prevAssistant });
      prevAssistant = m.kind === "notice" ? prevAssistant : assistant;
    }
    if (pending) out.push({ key: `pending-${pending.id}`, type: "pending", startedAt: pending.startedAt });
    return out;
  }, [messages, pending]);

  const scrollToEnd = React.useCallback(() => {
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
  }, []);

  // a new strategy card is read from its top (its name and rules), not its last line; everything else (the client's
  // messages, the drafting bubble, backtest and running cards, notes) fits and keeps the view at the end. Scheduled
  // once per new message, twice (the second pass lands once the new row is measured); a backtest that finishes at
  // the end of the conversation brings its result into view.
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const last = messages[messages.length - 1];
  const lastId = last?.id;
  const lastDone = last?.kind === "backtest" && (last.status === "done" || last.status === "failed");
  const seen = React.useRef(lastId);
  React.useEffect(() => {
    if (lastId === seen.current) return;
    seen.current = lastId;
    const m = threadStore.get().messages.at(-1);
    if (!m) return;
    const go = () => {
      if (m.kind !== "draft") return list.current?.scrollToEnd({ animated: true });
      const index = itemsRef.current.findIndex((i) => i.key === m.id);
      if (index >= 0) list.current?.scrollToIndex({ index, viewPosition: 0, viewOffset: 4, animated: true });
    };
    setTimeout(go, 60);
    setTimeout(go, 420);
  }, [lastId]);
  React.useEffect(() => {
    if (lastDone) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 120);
  }, [lastDone]);

  const send = React.useCallback(
    (text: string) => {
      void ask(text, { symbol: chartSymbol, timeframe: "H1" });
      scrollToEnd();
    },
    [chartSymbol, scrollToEnd],
  );

  const onSuggestion = React.useCallback(
    (key: string) => {
      const ex = EXAMPLES.find((e) => e.key === key);
      const re = REFINE.find((r) => r.key === key);
      const text = ex ? t(ex.prompt) : re ? t(re.label) : "";
      if (text) send(text);
    },
    [send, t],
  );

  const [target, setTarget] = React.useState<string | null>(null);
  const onEdit = React.useCallback((id: string) => {
    setTarget(id);
    editSheet.current?.present();
  }, []);
  const onBacktest = React.useCallback((id: string) => {
    setTarget(id);
    btSheet.current?.present();
  }, []);
  const onDeploy = React.useCallback((id: string) => {
    setTarget(id);
    deploySheet.current?.present();
  }, []);
  const onDeployLatest = React.useCallback(() => {
    const d = latestDraft(threadStore.get().messages);
    if (d) onDeploy(d.id);
  }, [onDeploy]);
  const onCancelBacktest = React.useCallback((id: string) => void stopBacktest(id), []);
  const retry = React.useCallback((prompt: string) => send(prompt), [send]);
  const startOver = React.useCallback(() => {
    newThread();
    requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated: false }));
  }, []);

  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      if (item.type === "greeting")
        return (
          <View style={{ paddingTop: space[2] }}>
            <AssistantHead />
            <ChatRow avatar={null}>
              <Bubble tone="bot">
                <Rich text={t("mobileAi.greeting", { name: me?.first_name ?? "" })} color={colors.text} linkColor={colors.ember} />
              </Bubble>
            </ChatRow>
          </View>
        );
      if (item.type === "pending")
        return (
          <View style={{ paddingTop: space[3] }}>
            <AssistantHead at={item.startedAt} />
            <ChatRow avatar={null}>
              <Drafting startedAt={item.startedAt} />
            </ChatRow>
          </View>
        );
      return <Row m={item.m} head={item.head} latestId={latestId} deployable={deployable} onEdit={onEdit} onBacktest={onBacktest} onDeploy={onDeploy} onDeployLatest={onDeployLatest} onCancelBacktest={onCancelBacktest} onRetry={retry} />;
    },
    [deployable, latestId, me?.first_name, onBacktest, onCancelBacktest, onDeploy, onDeployLatest, onEdit, retry, t],
  );

  const intro = React.useMemo(() => <Intro />, []);
  const suggestions: Suggestion[] = pending ? [] : latest ? REFINE.map((r) => ({ key: r.key, label: t(r.label) })) : EXAMPLES.map((e) => ({ key: e.key, label: t(e.label) }));

  const unavailable = viewer ? "viewer" : menu.data?.modules.algo === false ? "module" : meta.data && !meta.data.ai.configured ? "ai" : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "web" ? undefined : "padding"}>
        <ChatHeader
          testID="ai-header"
          avatar={<MascotAvatar size={36} />}
          title={t("mobileAi.title")}
          subtitle={pending ? t("mobileAi.drafting") : t("mobileAi.subtitle")}
          dot={pending ? "gold" : "periwinkle"}
          right={
            <>
              {unavailable === "viewer" || unavailable === "module" ? null : <HeaderPill label={t("mobileAi.algo")} onPress={() => router.push("/algo")} testID="ai-open-algo" />}
              {messages.length ? <IconButton tone="ghost" accessibilityLabel={t("mobileAi.newStrategy")} icon={<RotateCcw size={20} color={colors.text2} strokeWidth={1.9} />} onPress={() => confirmNew.current?.present()} /> : null}
            </>
          }
        />
        {unavailable ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <EmptyState
              illustration={unavailable === "viewer" ? "security" : "maintenance"}
              title={unavailable === "viewer" ? t("mobile.viewOnly") : unavailable === "module" ? t("mobileAi.unavailable.moduleTitle") : t("mobileAi.unavailable.title")}
              body={unavailable === "viewer" ? t("mobileAi.error.viewOnly") : unavailable === "module" ? t("mobileAi.error.module") : t("mobileAi.unavailable.body")}
              action={unavailable === "ai" ? t("mobileAi.openAlgo") : undefined}
              onAction={unavailable === "ai" ? () => router.push("/algo") : undefined}
            />
          </View>
        ) : (
          <>
            <FlashList
              ref={list}
              data={items}
              keyExtractor={(i) => i.key}
              renderItem={renderItem}
              getItemType={(i) => (i.type === "msg" ? i.m.kind : i.type)}
              ListHeaderComponent={intro}
              contentContainerStyle={{ paddingBottom: space[5] }}
              maintainVisibleContentPosition={{ startRenderingFromBottom: messages.length > 0 }}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              testID="ai-list"
            />
            <Composer
              ref={composer}
              testID="ai-composer"
              placeholder={latest ? t("mobileAi.placeholderRefine") : t("mobileAi.placeholder")}
              onSend={send}
              busy={!!pending}
              onStop={stopAsking}
              onKeyboardShow={scrollToEnd}
              top={<Suggestions items={suggestions} onPick={onSuggestion} testID="ai-suggest" />}
              footer={messages.length ? <RiskNote compact /> : null}
            />
          </>
        )}
      </KeyboardAvoidingView>
      <EditSheet ref={editSheet} draftId={target} />
      <BacktestSheet ref={btSheet} draftId={target} onStarted={noop} />
      <DeploySheet ref={deploySheet} draftId={target} onDeployed={noop} />
      <ConfirmSheet ref={confirmNew} testID="ai-new-confirm" title={t("mobileAi.newConfirm.title")} body={t("mobileAi.newConfirm.body")} confirm={t("mobileAi.newConfirm.action")} cancel={t("common.cancel")} onConfirm={startOver} />
    </View>
  );
}

type RowProps = {
  m: AiMessage;
  head: boolean;
  latestId: string | null;
  deployable: number | null;
  onEdit: (id: string) => void;
  onBacktest: (id: string) => void;
  onDeploy: (id: string) => void;
  onDeployLatest: () => void;
  onCancelBacktest: (id: string) => void;
  onRetry: (prompt: string) => void;
};

const Row = React.memo(function Row({ m, head, latestId, deployable, onEdit, onBacktest, onDeploy, onDeployLatest, onCancelBacktest, onRetry }: RowProps) {
  const t = useT();
  const fmt = useFormat();
  const pad = { paddingTop: head ? space[4] : space[3] };
  switch (m.kind) {
    case "user":
      return (
        <View style={{ paddingTop: space[4] }}>
          <ChatRow mine>
            <AuthorLine mine time={clock(fmt, m.at)} />
            <Bubble tone="mine">
              <Text color={colors.ink} selectable>
                {m.text}
              </Text>
            </Bubble>
          </ChatRow>
        </View>
      );
    case "notice":
      return (
        <View style={{ paddingTop: space[3] }}>
          <SystemNote text={m.text} time={clock(fmt, m.at)} />
        </View>
      );
    case "error":
      return (
        <View style={pad}>
          {head ? <AssistantHead at={m.at} /> : null}
          <ChatRow avatar={null}>
            <Bubble tone="bot">
              <View style={{ gap: space[3] }} testID="ai-error">
                <Text weight="700">{t("mobileAi.failed")}</Text>
                <Text tone="secondary">{m.text}</Text>
                {m.prompt ? <BlockButton label={t("mobile.action.retry")} tone="surface" onPress={() => onRetry(m.prompt!)} style={{ alignSelf: "flex-start" }} testID="ai-retry" /> : null}
              </View>
            </Bubble>
          </ChatRow>
        </View>
      );
    case "draft":
      return (
        <View style={pad}>
          {head ? <AssistantHead at={m.at} /> : null}
          <View style={{ paddingHorizontal: 16 }}>
            <StrategyCard m={m} latest={m.id === latestId} onEdit={onEdit} onBacktest={onBacktest} onDeploy={onDeploy} onWarmDeploy={warmAccounts} />
          </View>
        </View>
      );
    case "backtest":
      return (
        <View style={pad}>
          {head ? <AssistantHead at={m.at} /> : null}
          <View style={{ paddingHorizontal: 16 }}>
            <BacktestCard m={m} onCancel={onCancelBacktest} onDeploy={onDeployLatest} canDeploy={deployable !== null && deployable === m.versionId} />
          </View>
        </View>
      );
    case "deployed":
      return (
        <View style={pad}>
          {head ? <AssistantHead at={m.at} /> : null}
          <View style={{ paddingHorizontal: 16 }}>
            <DeployedCard m={m} />
          </View>
        </View>
      );
  }
});

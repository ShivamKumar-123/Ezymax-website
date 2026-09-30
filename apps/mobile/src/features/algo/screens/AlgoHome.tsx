// /algo — automated trading at a glance: what is running right now (status, account, realized P&L) with the
// account-wide kill switch, my strategies, recent backtests, and the ways in (AI Trader, marketplace, API keys and
// webhooks). One FlashList: the editorial header scrolls away with the rows; rows are fixed-height and memoised.
// Polls only while in front: deployments every 10 s, backtests every 2 s while one runs.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Bot, KeyRound, OctagonX, Power, Store } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { prefetch, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, ColorBlock, Display, Illustration, Mono, Pill, PressableScale, Screen, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { fetchers, keys, prefetchBacktest, prefetchDeployment, prefetchMarket, prefetchStrategy, type BacktestRow as Bt, type Deployment, type StrategyItem } from "../api";
import { Note, SectionTitle } from "../components/bits";
import { ForwardIcon, TopBar } from "../components/chrome";
import { BacktestRow, DeploymentRow, StrategyRow } from "../components/rows";
import { LoadError, RowSkeleton } from "../components/states";
import { isLive, realizedOf, tradesOf, usd } from "../format";
import { useBack, usePoll, usePullRefresh, useReadOnly } from "../hooks";
import { KillAllSheet, type KillAllRef } from "../sheets/KillAllSheet";
import { openClientArea } from "../web";

type Item =
  | { type: "section"; key: string; title: string; sub?: string; action?: string; href?: Href }
  | { type: "filter"; key: string }
  | { type: "dep"; key: string; d: Deployment }
  | { type: "strat"; key: string; s: StrategyItem }
  | { type: "bt"; key: string; b: Bt }
  | { type: "empty"; key: string; kind: "deps" | "depsAll" | "strats" | "bts" }
  | { type: "start"; key: string }
  | { type: "skeleton"; key: string }
  | { type: "error"; key: string; message: string }
  | { type: "gap"; key: string };

export function AlgoHome() {
  const t = useT();
  const router = useRouter();
  const back = useBack("/more");
  const bottom = useBottomInset(false);
  const readOnly = useReadOnly();
  const killRef = React.useRef<KillAllRef>(null);
  const [filter, setFilter] = React.useState<"active" | "all">("active");

  const deps = useQuery(keys.deployments, fetchers.deployments, { persist: true, staleMs: 5_000, intervalMs: usePoll(10_000) });
  const strats = useQuery(keys.strategies, fetchers.strategies, { persist: true, staleMs: 10_000, intervalMs: usePoll(30_000) });
  // backtests: every 2 s while one is queued or running, else every 30 s
  const [btPoll, setBtPoll] = React.useState(30_000);
  const bts = useQuery(keys.backtests, fetchers.backtests, { persist: true, staleMs: 1_500, intervalMs: usePoll(btPoll) });
  const anyRunning = (bts.data?.items ?? []).some((b) => b.status === "queued" || b.status === "running");
  React.useEffect(() => setBtPoll(anyRunning ? 2_000 : 30_000), [anyRunning]);
  const controls = useQuery(keys.controls, fetchers.controls, { persist: true, staleMs: 15_000, intervalMs: usePoll(30_000) });
  const viewer = useSession((s) => !!s.viewer);
  const menu = useQuery(keys.menu, fetchers.menu, { persist: true, staleMs: 5 * 60_000, enabled: !viewer });
  const apiOff = menu.data?.modules?.api === false;

  const { refreshing, onRefresh } = usePullRefresh(() => Promise.all([deps.refresh(), strats.refresh(), bts.refresh(), controls.refresh()]));

  const openDep = React.useCallback((id: number) => router.push(`/algo/deployments/${id}`), [router]);
  const openStrat = React.useCallback((id: number) => router.push(`/algo/strategies/${id}`), [router]);
  const openBt = React.useCallback((id: number) => router.push(`/algo/backtests/${id}`), [router]);

  const all = deps.data?.items ?? [];
  const active = all.filter((d) => isLive(d.status));
  const running = all.filter((d) => d.status === "running").length;
  const shownDeps = filter === "active" ? active : all;
  const realized = all.reduce((a, d) => a + realizedOf(d), 0);
  const openPos = active.reduce((a, d) => a + (d.openPositions || Number(d.stats?.open ?? 0)), 0);
  const closedTrades = all.reduce((a, d) => a + tradesOf(d), 0);
  const killed = !!controls.data?.killed;
  const globalKill = !!controls.data?.globalKill;

  // a client with nothing yet sees one getting-started block instead of three empty sections
  const nothing = !!deps.data && !!strats.data && !!bts.data && !all.length && !strats.data.items.length && !bts.data.items.length;

  const items = React.useMemo<Item[]>(() => {
    if (nothing) return [{ type: "start", key: "start" }];
    const out: Item[] = [];
    // deployments
    out.push({ type: "section", key: "s-deps", title: t("mobileAlgo.home.running"), sub: deps.data ? t("mobileAlgo.home.runningSub", { count: running }) : undefined });
    out.push({ type: "filter", key: "f-deps" });
    if (!deps.data) out.push(deps.error ? { type: "error", key: "e-deps", message: deps.error.message } : { type: "skeleton", key: "k-deps" });
    else if (!shownDeps.length) out.push({ type: "empty", key: "x-deps", kind: filter === "active" && all.length ? "depsAll" : "deps" });
    else for (const d of shownDeps) out.push({ type: "dep", key: `d${d.id}`, d });
    out.push({ type: "gap", key: "g1" });
    // strategies
    out.push({ type: "section", key: "s-strats", title: t("mobileAlgo.home.strategies"), sub: strats.data ? t("mobileAlgo.home.strategiesSub", { count: strats.data.items.length }) : undefined, action: readOnly ? undefined : t("mobileAlgo.home.newWithAi"), href: "/ai" });
    if (!strats.data) out.push(strats.error ? { type: "error", key: "e-strats", message: strats.error.message } : { type: "skeleton", key: "k-strats" });
    else if (!strats.data.items.length) out.push({ type: "empty", key: "x-strats", kind: "strats" });
    else for (const s of strats.data.items) out.push({ type: "strat", key: `s${s.id}`, s });
    out.push({ type: "gap", key: "g2" });
    // backtests
    const btItems = (bts.data?.items ?? []).slice(0, 12);
    out.push({ type: "section", key: "s-bts", title: t("mobileAlgo.home.backtests"), sub: bts.data ? t("mobileAlgo.home.backtestsSub") : undefined });
    if (!bts.data) out.push(bts.error ? { type: "error", key: "e-bts", message: bts.error.message } : { type: "skeleton", key: "k-bts" });
    else if (!btItems.length) out.push({ type: "empty", key: "x-bts", kind: "bts" });
    else for (const b of btItems) out.push({ type: "bt", key: `b${b.id}`, b });
    return out;
  }, [t, deps.data, deps.error, strats.data, strats.error, bts.data, bts.error, shownDeps, filter, all.length, running, readOnly, nothing]);


  const onAi = React.useCallback(() => router.push("/ai"), [router]);
  const onMarket = React.useCallback(() => router.push("/algo/marketplace"), [router]);
  const onKeys = React.useCallback(() => router.push("/algo/keys"), [router]);
  const onKill = React.useCallback(() => killRef.current?.open("kill"), []);
  const onRelease = React.useCallback(() => killRef.current?.open("release"), []);
  const onAll = React.useCallback(() => setFilter("all"), []);

  // memoised with primitive props: a poll that changed nothing doesn't redraw the header
  const header = (
    <HomeHeader
      onBack={back}
      globalKill={globalKill}
      running={running}
      realized={realized}
      openPos={openPos}
      trades={closedTrades}
      loading={!deps.data}
      apiOff={apiOff}
      readOnly={readOnly}
      killed={killed}
      killedAt={controls.data?.killedAt ?? null}
      controlsUnavailable={!controls.data && !!controls.error}
      onAi={onAi}
      onMarket={onMarket}
      onKeys={onKeys}
      onKill={onKill}
      onRelease={onRelease}
    />
  );

  const footer = (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[8], gap: space[3] }}>
      <Note>{t("mobileAlgo.home.footnote")}</Note>
      <PressableScale onPress={() => openClientArea("/developer/strategies")} scaleTo={0.98} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }} testID="algo-open-web">
        <Text variant="callout" weight="700" tone="ember">
          {t("mobileAlgo.home.openWeb")}
        </Text>
      </PressableScale>
    </View>
  );

  const onActive = React.useCallback(() => setFilter("active"), []);
  const onSection = React.useCallback((href: Href) => router.push(href), [router]);
  const nActive = active.length;
  const nAll = all.length;
  // stable while nothing changed: a poll that brought the same data re-renders no row
  const renderItem = React.useCallback(
    ({ item }: { item: Item }) => {
      switch (item.type) {
        case "section":
          return <Section title={item.title} sub={item.sub} action={item.action} href={item.href} onAction={onSection} />;
        case "filter":
          return <FilterRow filter={filter} nActive={nActive} nAll={nAll} onActive={onActive} onAll={onAll} />;
        case "dep":
          return <DeploymentRow d={item.d} onOpen={openDep} onPressIn={prefetchDeployment} />;
        case "strat":
          return <StrategyRow s={item.s} onOpen={openStrat} onPressIn={prefetchStrategy} />;
        case "bt":
          return <BacktestRow b={item.b} onOpen={openBt} onPressIn={prefetchBacktest} />;
        case "skeleton":
          return (
            <View>
              <RowSkeleton />
              <RowSkeleton />
            </View>
          );
        case "error":
          return (
            <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[4] }}>
              {item.message}
            </Text>
          );
        case "empty":
          return <EmptyRow kind={item.kind} readOnly={readOnly} onAll={onAll} />;
        case "start":
          return <StartBlock readOnly={readOnly} onAi={onAi} onMarket={onMarket} />;
        case "gap":
          return <View style={{ height: space[10] }} />;
      }
    },
    [filter, nActive, nAll, onActive, onAll, onSection, openDep, openStrat, openBt, readOnly, onAi, onMarket],
  );

  // the algo module is off, the session can't see it, or nothing loaded while offline: one full-screen state
  const blocking = !deps.data && !strats.data && (deps.error ?? strats.error);
  if (blocking && ["module_disabled", "viewer_scope", "viewer_read_only", "network", "maintenance"].includes(blocking.code)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={blocking} onRetry={() => void onRefresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={keyOf}
        getItemType={typeOf}
        renderItem={renderItem}
        extraData={`${filter}:${readOnly}`}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <KillAllSheet ref={killRef} running={active.length} />
    </Screen>
  );
}

const keyOf = (i: Item) => i.key;
const typeOf = (i: Item) => i.type;

const Section = React.memo(function Section({ title, sub, action, href, onAction }: { title: string; sub?: string; action?: string; href?: Href; onAction: (href: Href) => void }) {
  return <SectionTitle title={title} sub={sub} action={action} onAction={href ? () => onAction(href) : undefined} style={{ paddingBottom: space[3] }} />;
});

const FilterRow = React.memo(function FilterRow({ filter, nActive, nAll, onActive, onAll }: { filter: "active" | "all"; nActive: number; nAll: number; onActive: () => void; onAll: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER, paddingBottom: space[2] }} accessibilityRole="tablist">
      <Pill compact label={t("mobileAlgo.home.filterActive", { n: nActive })} selected={filter === "active"} onPress={onActive} />
      <Pill compact label={t("mobileAlgo.home.filterAll", { n: nAll })} selected={filter === "all"} onPress={onAll} />
    </View>
  );
});

type HeaderProps = {
  onBack: () => void;
  globalKill: boolean;
  running: number;
  realized: number;
  openPos: number;
  trades: number;
  loading: boolean;
  apiOff: boolean;
  readOnly: boolean;
  killed: boolean;
  killedAt: string | null;
  controlsUnavailable: boolean;
  onAi: () => void;
  onMarket: () => void;
  onKeys: () => void;
  onKill: () => void;
  onRelease: () => void;
};

/** Title, the running block, the ways in and the kill switch. */
const HomeHeader = React.memo(function HomeHeader(p: HeaderProps) {
  const t = useT();
  const f = useFormat();
  return (
    <View>
      <TopBar onBack={p.onBack} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="ember">
          {t("mobileAlgo.home.eyebrow")}
        </Text>
        <Display size="hero" accessibilityRole="header">
          {t("mobileAlgo.home.title")}
        </Display>
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
        <RestrictionBanner kinds={["trading", "close_only"]} />
        {p.globalKill ? <Banner tone="warn" icon={<OctagonX size={18} color={colors.warn} />} title={t("mobileAlgo.kill.globalTitle")} body={t("mobileAlgo.kill.globalBody")} /> : null}
        <Hero running={p.running} realized={p.realized} openPos={p.openPos} trades={p.trades} loading={p.loading} />
        <QuickActions apiOff={p.apiOff} onAi={p.onAi} onMarket={p.onMarket} onKeys={p.onKeys} />
        {p.readOnly ? null : <KillCard killed={p.killed} since={p.killedAt ? f.dateTime(p.killedAt) : null} unavailable={p.controlsUnavailable} onKill={p.onKill} onRelease={p.onRelease} />}
      </View>
      <View style={{ height: space[8] }} />
    </View>
  );
});

/** Ember block: what runs right now, with the money it made. */
function Hero({ running, realized, openPos, trades, loading }: { running: number; realized: number; openPos: number; trades: number; loading: boolean }) {
  const t = useT();
  return (
    <ColorBlock color="ember" style={{ paddingBottom: space[5] }} testID="algo-hero">
      <Text variant="label" color={colors.ink2}>
        {t("mobileAlgo.home.heroEyebrow")}
      </Text>
      <Display size="hero" color={colors.ink} style={{ fontSize: 76, lineHeight: 78 }}>
        {loading ? "—" : String(running)}
      </Display>
      <Text variant="callout" weight="700" color={colors.ink}>
        {t("mobileAlgo.home.heroRunning", { count: running })}
      </Text>
      <View style={{ flexDirection: "row", gap: space[3], marginTop: space[5] }}>
        <HeroStat label={t("mobileAlgo.home.heroRealized")} value={loading ? "—" : usd(realized, true)} />
        <HeroStat label={t("mobileAlgo.home.heroOpen")} value={loading ? "—" : String(openPos)} />
        <HeroStat label={t("mobileAlgo.home.heroTrades")} value={loading ? "—" : String(trades)} />
      </View>
    </ColorBlock>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Mono size={18} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Mono>
      <Text variant="label" color={colors.ink2} numberOfLines={2} style={{ fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}

/** The ways in: describe a strategy to the AI Trader, the marketplace (two blocks), API keys and webhooks (a row). */
function QuickActions({ apiOff, onAi, onMarket, onKeys }: { apiOff: boolean; onAi: () => void; onMarket: () => void; onKeys: () => void }) {
  const t = useT();
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Tile testID="algo-go-ai" color="cream" icon={<Bot size={24} color={colors.ink} strokeWidth={2} />} label={t("mobileAlgo.home.qaAi")} hint={t("mobileAlgo.home.qaAiHint")} onPress={onAi} />
        <Tile testID="algo-go-market" color="gold" icon={<Store size={24} color={colors.ink} strokeWidth={2} />} label={t("mobileAlgo.home.qaMarket")} hint={t("mobileAlgo.home.qaMarketHint")} onPress={onMarket} onPressIn={prefetchMarket} />
      </View>
      {apiOff ? null : (
        <PressableScale
          testID="algo-go-keys"
          onPress={onKeys}
          onPressIn={() => prefetch(keys.keys, fetchers.keys, { persist: true })}
          scaleTo={0.985}
          accessibilityLabel={t("mobileAlgo.home.qaKeys")}
          style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
        >
          <KeyRound size={20} color={colors.text2} strokeWidth={2} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="callout" weight="700">
              {t("mobileAlgo.home.qaKeys")}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileAlgo.home.qaKeysHint")}
            </Text>
          </View>
          <ForwardIcon />
        </PressableScale>
      )}
    </View>
  );
}

function Tile({ color, icon, label, hint, onPress, onPressIn, testID }: { color: "cream" | "gold"; icon: React.ReactNode; label: string; hint: string; onPress: () => void; onPressIn?: () => void; testID?: string }) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      scaleTo={0.97}
      accessibilityLabel={`${label}. ${hint}`}
      style={{ flex: 1, minHeight: 132, borderRadius: radius.card, backgroundColor: color === "cream" ? colors.cream : colors.gold, padding: space[4], justifyContent: "space-between", gap: space[3] }}
    >
      {icon}
      <View style={{ gap: 2 }}>
        <Text variant="headline" weight="700" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </Text>
        <Text variant="caption" color={colors.ink2} numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

/** The account-wide kill switch: stop everything (and block webhook / API orders), or release it. */
function KillCard({ killed, since, unavailable, onKill, onRelease }: { killed: boolean; since: string | null; unavailable: boolean; onKill: () => void; onRelease: () => void }) {
  const t = useT();
  if (unavailable) return null;
  return (
    <View
      testID="kill-card"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        padding: space[4],
        borderRadius: radius.card,
        backgroundColor: killed ? colors.emberSoft : colors.surface,
        borderWidth: 1,
        borderColor: killed ? colors.ember : colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="700">
          {killed ? t("mobileAlgo.kill.onTitle") : t("mobileAlgo.kill.cardTitle")}
        </Text>
        <Text variant="caption" tone="secondary" style={{ lineHeight: 17 }}>
          {killed ? (since ? t("mobileAlgo.kill.onSince", { at: since }) : t("mobileAlgo.kill.onBody")) : t("mobileAlgo.kill.cardBody")}
        </Text>
      </View>
      {killed ? (
        <Button testID="kill-release" label={t("mobileAlgo.kill.release")} size="sm" variant="secondary" full={false} icon={<Power size={15} color={colors.text} />} onPress={onRelease} />
      ) : (
        <Button testID="kill-open" label={t("mobileAlgo.kill.stopAll")} size="sm" variant="danger" full={false} icon={<OctagonX size={15} color={colors.down} />} onPress={onKill} />
      )}
    </View>
  );
}

/** An empty section (the other sections have content): one line, and "Show all" when only stopped ones exist. */
function EmptyRow({ kind, readOnly, onAll }: { kind: "deps" | "depsAll" | "strats" | "bts"; readOnly: boolean; onAll: () => void }) {
  const t = useT();
  const text = kind === "deps" ? t("mobileAlgo.home.emptyDeps") : kind === "depsAll" ? t("mobileAlgo.home.emptyActive") : kind === "strats" ? t("mobileAlgo.home.emptyStrats") : t("mobileAlgo.home.emptyBts");
  return (
    <View style={{ marginHorizontal: GUTTER, padding: space[5], gap: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed" }} testID={`empty-${kind}`}>
      <Text variant="callout" tone="secondary">
        {text}
      </Text>
      {kind === "depsAll" && !readOnly ? <Button label={t("mobileAlgo.home.showAll")} size="sm" variant="secondary" full={false} onPress={onAll} /> : null}
    </View>
  );
}

/** A client with no strategy, deployment or backtest yet: what Algo does, and the two ways to start. */
function StartBlock({ readOnly, onAi, onMarket }: { readOnly: boolean; onAi: () => void; onMarket: () => void }) {
  const t = useT();
  return (
    <View testID="algo-start" style={{ marginHorizontal: GUTTER, borderRadius: radius.block, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[6], gap: space[5] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, gap: space[2] }}>
          <Text variant="label" tone="ember">
            {t("mobileAlgo.home.startEyebrow")}
          </Text>
          <Display size="lg">{t("mobileAlgo.home.startTitle")}</Display>
        </View>
        <Illustration name="mascot" width={86} height={142} style={{ marginTop: -space[2], marginEnd: -space[2] }} />
      </View>
      <View style={{ gap: space[3] }}>
        {(["mobileAlgo.home.step1", "mobileAlgo.home.step2", "mobileAlgo.home.step3"] as const).map((k, i) => (
          <View key={k} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
              <Mono size={12} weight="bold">
                {String(i + 1)}
              </Mono>
            </View>
            <Text tone="secondary" style={{ flex: 1, lineHeight: 21 }}>
              {t(k)}
            </Text>
          </View>
        ))}
      </View>
      {readOnly ? null : (
        <View style={{ gap: space[3] }}>
          <Button testID="start-ai" label={t("mobileAlgo.home.qaAi")} onPress={onAi} />
          <Button testID="start-market" label={t("mobileAlgo.home.browseMarket")} variant="secondary" onPress={onMarket} />
        </View>
      )}
    </View>
  );
}

export default AlgoHome;

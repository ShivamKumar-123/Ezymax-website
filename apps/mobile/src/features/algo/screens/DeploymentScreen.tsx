// /algo/deployments/[id] — one running (or finished) strategy on one account: realized P&L with the day-by-day curve,
// closed trades and win rate, its controls (pause / resume, stop, kill, close its positions — each behind a
// confirmation), errors and stop reasons, then the runtime log (every evaluated bar, signal, order, close and error;
// older pages on request), its trades and its setup. One FlashList, polled every 5 s while in front.
import * as React from "react";
import { RefreshControl, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { OctagonX, Pause, Play, Square, XCircle } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Banner, Button, Card, Display, Pill, PressableScale, Screen, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchOlderLogs, fetchers, keys, LOG_PAGE, prefetchStrategy, validId, type DeploymentDetail, type DeploymentLog, type DeploymentPosition } from "../api";
import { KV, Note, StatGrid, Tag } from "../components/bits";
import { ForwardIcon, TopBar, Title } from "../components/chrome";
import { Curve } from "../components/chart/Curve";
import { curveHeight, LINE_LAYOUT, type CurveData } from "../components/chart/types";
import { RiskRows, RulesBody } from "../components/Rules";
import { LogRow, PositionRow } from "../components/rows";
import { BlockSkeleton, ChartSkeleton, LoadError, RowsSkeleton } from "../components/states";
import { DEP_TONE, ago, day, depLabel, isLive, kindLabel, moneyTone, pct, realizedOf, tradesOf, usd, winRateOf } from "../format";
import { useBack, usePoll, usePullRefresh, useReadOnly } from "../hooks";
import { DeploymentSheet, type DeploymentAction, type DeploymentSheetRef } from "../sheets/DeploymentSheet";

type Tab = "log" | "trades" | "setup";
type Item = { kind: "log"; key: string; l: DeploymentLog } | { kind: "pos"; key: string; p: DeploymentPosition };

export function DeploymentScreen() {
  const t = useT();
  const back = useBack("/algo");
  const readOnly = useReadOnly();
  const bottom = useBottomInset(false);
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = validId(raw) ? raw : null;
  const q = useQuery(id ? keys.deployment(id) : null, fetchers.deployment(id ?? "0"), { persist: true, staleMs: 3_000, intervalMs: usePoll(5_000) });
  const { refreshing, onRefresh } = usePullRefresh(() => q.refresh());
  const sheet = React.useRef<DeploymentSheetRef>(null);
  const [tab, setTab] = React.useState<Tab>("log");
  const [older, setOlder] = React.useState<DeploymentLog[]>([]);
  const [olderState, setOlderState] = React.useState<"idle" | "loading" | "end" | "error">("idle");

  const d = q.data;
  const logs = React.useMemo(() => {
    if (!d) return [];
    const seen = new Set(d.logs.map((l) => l.id));
    return [...d.logs, ...older.filter((l) => !seen.has(l.id))];
  }, [d, older]);

  const loadOlder = React.useCallback(async () => {
    if (!d || olderState === "loading" || olderState === "end" || !logs.length) return;
    setOlderState("loading");
    const r = await fetchOlderLogs(d.id, logs[logs.length - 1]!.id);
    if (!r.ok) return setOlderState("error");
    setOlder((o) => [...o, ...r.data.logs]);
    setOlderState(r.data.logs.length < LOG_PAGE ? "end" : "idle");
  }, [d, logs, olderState]);

  const items = React.useMemo<Item[]>(() => {
    if (!d) return [];
    if (tab === "log") return logs.map((l) => ({ kind: "log" as const, key: `l${l.id}`, l }));
    if (tab === "trades") return d.positions.map((p) => ({ kind: "pos" as const, key: `p${p.ticket}`, p }));
    return [];
  }, [d, tab, logs]);

  const onAction = React.useCallback((a: DeploymentAction) => d && sheet.current?.open(d, a), [d]);

  if (!id || (!d && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={q.error ?? { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  // memoised: a poll that changed nothing (the same shared `d`) doesn't redraw the header
  const header = <DepHeader d={d} logsCount={logs.length} tab={tab} onTab={setTab} onAction={onAction} readOnly={readOnly} onBack={back} />;

  const empty = !d ? (
    <RowsSkeleton rows={4} height={64} />
  ) : tab === "log" ? (
    <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[5] }}>
      {t("mobileAlgo.dep.noLogs")}
    </Text>
  ) : tab === "trades" ? (
    <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[5] }}>
      {t("mobileAlgo.dep.noTrades")}
    </Text>
  ) : null;

  // the newest page wasn't full and nothing older was fetched: the log starts here
  const atStart = olderState === "end" || (!!d && d.logs.length < LOG_PAGE && older.length === 0);
  const footer = !d ? null : tab === "setup" ? (
    <Setup d={d} />
  ) : tab === "log" && logs.length ? (
    <View style={{ padding: GUTTER, alignItems: "flex-start" }}>
      {atStart ? (
        <Text variant="caption" tone="tertiary">
          {t("mobileAlgo.dep.logStart")}
        </Text>
      ) : (
        <Button testID="dep-older" label={olderState === "error" ? t("mobile.action.retry") : t("mobileAlgo.dep.older")} variant="secondary" size="sm" full={false} loading={olderState === "loading"} onPress={() => void loadOlder()} />
      )}
    </View>
  ) : null;

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={keyOf}
        getItemType={typeOf}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        extraData={tab}
        contentContainerStyle={{ paddingBottom: bottom + space[6] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <DeploymentSheet ref={sheet} onChanged={() => void q.refresh()} />
    </Screen>
  );
}

const keyOf = (i: Item) => i.key;
const typeOf = (i: Item) => i.kind;
const renderItem = ({ item }: { item: Item }) => (item.kind === "log" ? <LogRow l={item.l} /> : <PositionRow p={item.p} />);

const DepHeader = React.memo(function DepHeader({
  d,
  logsCount,
  tab,
  onTab,
  onAction,
  readOnly,
  onBack,
}: {
  d: DeploymentDetail | undefined;
  logsCount: number;
  tab: Tab;
  onTab: (t: Tab) => void;
  onAction: (a: DeploymentAction) => void;
  readOnly: boolean;
  onBack: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const router = useRouter();
  return (
    <View>
      <TopBar onBack={onBack} />
      {!d ? (
        <View style={{ gap: space[5] }}>
          <View style={{ paddingHorizontal: GUTTER, height: 110 }} />
          <BlockSkeleton height={200} />
        </View>
      ) : (
        <View style={{ gap: space[6] }}>
          <Title eyebrow={t("mobileAlgo.dep.eyebrow", { account: `${kindLabel(t, d.accountType)} ${d.login}` })} title={d.strategyName}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
              <Tag label={depLabel(t, d.status)} tone={DEP_TONE[d.status] ?? "neutral"} dot={d.status === "running"} testID="dep-status" />
              <Tag label={`${d.symbol} · ${d.timeframe}`} tone="cream" />
              <Tag label={`v${d.version}`} />
              {d.subscriptionId ? <Tag label={t("mobileAlgo.dep.marketplaceCopy")} tone="gold" /> : null}
            </View>
          </Title>
          <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
            <Hero d={d} />
            {d.error ? <Banner tone="warn" title={t("mobileAlgo.dep.errorTitle")} body={d.error} /> : null}
            {!isLive(d.status) && d.stopReason ? <Banner tone="info" title={t("mobileAlgo.dep.stoppedTitle", { at: d.stoppedAt ? f.dateTime(d.stoppedAt) : "—" })} body={t("mobileAlgo.dep.stoppedWhy", { reason: d.stopReason })} /> : null}
            {isLive(d.status) && !readOnly ? <Controls d={d} onAction={onAction} /> : null}
            {!d.subscriptionId ? (
              <PressableScale testID="dep-open-strategy" onPress={() => router.push(`/algo/strategies/${d.strategyId}`)} onPressIn={() => prefetchStrategy(d.strategyId)} scaleTo={0.98} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[1], alignSelf: "flex-start" }}>
                <Text variant="callout" weight="700" tone="ember">
                  {t("mobileAlgo.dep.openStrategy")}
                </Text>
                <ForwardIcon color={colors.ember} size={16} />
              </PressableScale>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER, paddingBottom: space[2] }} accessibilityRole="tablist">
            <Pill compact label={t("mobileAlgo.dep.tabLog", { n: logsCount })} selected={tab === "log"} onPress={() => onTab("log")} />
            <Pill compact label={t("mobileAlgo.dep.tabTrades", { n: d.positions.length })} selected={tab === "trades"} onPress={() => onTab("trades")} />
            <Pill compact label={t("mobileAlgo.dep.tabSetup")} selected={tab === "setup"} onPress={() => onTab("setup")} />
          </View>
        </View>
      )}
    </View>
  );
});

/** Realized P&L, big, with the day-by-day balance curve and the counts. */
function Hero({ d }: { d: DeploymentDetail }) {
  const t = useT();
  const f = useFormat();
  const width = useWindowDimensions().width - GUTTER * 2 - space[5] * 2;
  const pnl = realizedOf(d);
  const wr = winRateOf(d);
  const start = Number(d.startBalance ?? 0) || 0;
  const data = React.useMemo<CurveData | null>(() => {
    if (d.daily.length < 2) return null;
    let cum = start;
    const main = d.daily.map((p) => (cum += p.realized));
    const hi = Math.max(...main, start);
    const lo = Math.min(...main, start);
    return {
      main,
      baseline: start || undefined,
      tipDate: d.daily.map((p) => p.day),
      tipMain: main.map((v) => usd(v)),
      hi: usd(hi, false, 0),
      lo: usd(lo, false, 0),
      color: colors.gold,
      a11y: t("mobileAlgo.dep.curveA11y", { days: d.daily.length, pnl: usd(pnl, true) }),
    };
  }, [d.daily, start, pnl, t]);
  return (
    <Card style={{ gap: space[4] }} testID="dep-hero">
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="tertiary">
          {t("mobileAlgo.dep.realized")}
        </Text>
        <Display size="xl" color={pnl > 0 ? colors.up : pnl < 0 ? colors.down : colors.text} numberOfLines={1} adjustsFontSizeToFit testID="dep-pnl">
          {usd(pnl, true)}
        </Display>
        {start > 0 ? (
          <Text variant="callout" weight="700" tone={moneyTone(pnl)}>
            {t("mobileAlgo.dep.onStart", { pct: pct((pnl / start) * 100, 2), amount: usd(start, false, 0) })}
          </Text>
        ) : null}
      </View>
      {data ? (
        <View style={{ marginHorizontal: -4 }}>
          <Curve d={data} width={width + 8} layout={LINE_LAYOUT} fallback={<ChartSkeleton height={curveHeight(LINE_LAYOUT, false)} />} testID="dep-curve" />
        </View>
      ) : null}
      <StatGrid
        columns={4}
        size={15}
        items={[
          { label: t("mobileAlgo.dep.trades"), value: String(tradesOf(d)) },
          { label: t("mobileAlgo.dep.winRate"), value: wr === null ? "—" : pct(wr, 0, false) },
          { label: t("mobileAlgo.dep.open"), value: String(d.positions.filter((p) => !p.closedAt).length || d.openPositions) },
          { label: t("mobileAlgo.dep.orders"), value: String(Number(d.stats?.orders ?? 0)) },
        ]}
      />
      <Text variant="caption" tone="tertiary">
        {t("mobileAlgo.dep.lastCheckSince", { ago: ago(t, f, d.lastEvalAt), since: day(f, d.createdAt) })}
      </Text>
    </Card>
  );
}

/** Pause / resume, stop, kill and close positions: each opens its confirmation. */
function Controls({ d, onAction }: { d: DeploymentDetail; onAction: (a: DeploymentAction) => void }) {
  const t = useT();
  const open = d.positions.some((p) => !p.closedAt) || d.openPositions > 0;
  return (
    <View style={{ gap: space[2] }} testID="dep-controls">
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {d.status === "running" ? (
          <Button testID="dep-pause" label={t("mobileAlgo.ctl.pause")} variant="secondary" size="md" full={false} style={{ flex: 1 }} icon={<Pause size={16} color={colors.text} />} onPress={() => onAction("pause")} />
        ) : (
          <Button testID="dep-resume" label={t("mobileAlgo.ctl.resume")} variant="secondary" size="md" full={false} style={{ flex: 1 }} icon={<Play size={16} color={colors.text} />} onPress={() => onAction("resume")} />
        )}
        <Button testID="dep-stop" label={t("mobileAlgo.ctl.stop")} variant="secondary" size="md" full={false} style={{ flex: 1 }} icon={<Square size={15} color={colors.text} />} onPress={() => onAction("stop")} />
      </View>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {open ? <Button testID="dep-close" label={t("mobileAlgo.ctl.closePositions")} variant="secondary" size="md" full={false} style={{ flex: 1 }} icon={<XCircle size={16} color={colors.text} />} onPress={() => onAction("close")} /> : null}
        <Button testID="dep-kill" label={t("mobileAlgo.ctl.kill")} variant="danger" size="md" full={false} style={{ flex: 1 }} icon={<OctagonX size={16} color={colors.down} />} onPress={() => onAction("kill")} />
      </View>
    </View>
  );
}

/** The version's rules (unless a marketplace author keeps them private), risk, limits and dates. */
function Setup({ d }: { d: DeploymentDetail }) {
  const t = useT();
  const f = useFormat();
  const r = d.risk ?? {};
  const spec = d.spec;
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], gap: space[5] }} testID="dep-setup">
      <Card style={{ gap: space[3] }}>
        <Text variant="label" tone="tertiary">
          {t("mobileAlgo.dep.rules")}
        </Text>
        {d.rulesHidden ? <Text tone="secondary">{t("mobileAlgo.dep.rulesHidden")}</Text> : <RulesBody summary={d.summary} kind="code" />}
      </Card>
      {spec ? (
        <Card style={{ paddingVertical: space[2] }}>
          <RiskRows risk={spec} />
        </Card>
      ) : null}
      <Card style={{ paddingVertical: space[2] }}>
        <KV label={t("mobileAlgo.dep.lotMultiplier")} value={`${r.lotMultiplier ?? 1}×`} />
        <KV label={t("mobileAlgo.dep.maxLots")} value={r.maxLots ? String(r.maxLots) : spec?.maxLots ? String(spec.maxLots) : "—"} />
        <KV label={t("mobileAlgo.dep.maxOpen")} value={String(r.maxOpenPositions ?? (spec?.oneAtATime ? 1 : "—"))} />
        <KV label={t("mobileAlgo.dep.dailyLoss")} value={r.maxDailyLoss ? usd(r.maxDailyLoss, false, 0) : spec?.maxDailyLoss ? usd(spec.maxDailyLoss, false, 0) : t("mobileAlgo.deploy.off")} />
        <KV label={t("mobileAlgo.dep.started")} value={f.dateTime(d.createdAt)} />
        <KV label={t("mobileAlgo.dep.startBalance")} value={d.startBalance ? usd(Number(d.startBalance)) : "—"} last />
      </Card>
      <Note>{t("mobileAlgo.dep.setupNote")}</Note>
    </View>
  );
}

export default DeploymentScreen;

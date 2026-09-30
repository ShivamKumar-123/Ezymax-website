// /algo/strategies/[id] — one strategy: its latest version's rules in words (or the code's expressions), risk and
// schedule, the last backtest, every deployment with its controls (pause / resume, stop, kill behind confirmations),
// its backtests and versions. Deploy opens the confirmation form; Backtest opens the period picker. Code strategies
// are edited in the Client Area (or with the AI Trader for visual ones): the phone reads them.
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Archive, FlaskConical, Rocket, TriangleAlert } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Banner, Button, Card, Display, Mono, Screen, Text, toast, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { algoPatch, fetchers, keys, prefetchBacktest, prefetchDeployment, refreshAlgo, validId, type Deployment, type StrategyDetail } from "../api";
import { Note, SectionTitle, StatGrid, Tag } from "../components/bits";
import { BarButton, TopBar, Title } from "../components/chrome";
import { DeploymentCard } from "../components/DeploymentCard";
import { CodeDisclosure, RiskRows, RulesBody } from "../components/Rules";
import { BacktestRow } from "../components/rows";
import { BlockSkeleton, LoadError, RowsSkeleton } from "../components/states";
import { day, moneyTone, originLabel, pct, range, ratio, usd } from "../format";
import { useBack, usePoll, useReadOnly } from "../hooks";
import { BacktestSheet, type BacktestSheetRef, type BacktestTarget } from "../sheets/BacktestSheet";
import { ConfirmSheet, type ConfirmSpec } from "../sheets/ConfirmSheet";
import { DeploymentSheet, type DeploymentAction, type DeploymentSheetRef } from "../sheets/DeploymentSheet";
import { noteText } from "../spec";
import { openClientArea } from "../web";

export function StrategyScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack("/algo");
  const readOnly = useReadOnly();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = validId(raw) ? raw : null;
  const q = useQuery(id ? keys.strategy(id) : null, fetchers.strategy(id ?? "0"), { persist: true, staleMs: 5_000, intervalMs: usePoll(10_000) });
  const depSheet = React.useRef<DeploymentSheetRef>(null);
  const btSheet = React.useRef<BacktestSheetRef>(null);
  const confirmRef = React.useRef<SheetRef>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);

  const s = q.data;
  const openDep = React.useCallback((depId: number) => router.push(`/algo/deployments/${depId}`), [router]);
  const openBt = React.useCallback((btId: number) => router.push(`/algo/backtests/${btId}`), [router]);
  const onAction = React.useCallback((d: Deployment, a: DeploymentAction) => depSheet.current?.open(d, a), []);
  const openBacktest = React.useCallback((target: BacktestTarget) => btSheet.current?.open(target), []);
  const goDeploy = React.useCallback((strategyId: number) => router.push(`/algo/strategies/${strategyId}/deploy`), [router]);

  if (!id || (!s && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={q.error ?? { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  const canChange = !readOnly && s?.status !== "archived";

  const askArchive = () => {
    if (!s) return;
    setConfirm({
      title: t("mobileAlgo.strat.archiveTitle"),
      body: t("mobileAlgo.strat.archiveBody", { name: s.name }),
      confirm: t("mobileAlgo.strat.archive"),
      danger: true,
      testID: "archive-sheet",
      run: () => algoPatch(`strategies/${s.id}`, { status: "archived" }),
      onDone: () => {
        refreshAlgo();
        toast.show({ title: t("mobileAlgo.strat.archived", { name: s.name }), tone: "success" });
        router.replace("/algo");
      },
    });
    requestAnimationFrame(() => confirmRef.current?.present());
  };

  return (
    <Screen
      tabBar={false}
      onRefresh={q.refresh}
      header={
        <TopBar
          onBack={back}
          right={
            canChange && s ? <BarButton testID="strategy-more" accessibilityLabel={t("mobileAlgo.strat.archive")} icon={<Archive size={19} color={colors.text2} />} onPress={askArchive} /> : undefined
          }
        />
      }
    >
      {!s ? (
        <View style={{ gap: space[4] }}>
          <View style={{ paddingHorizontal: GUTTER, gap: space[2] }}>
            <Text variant="label" tone="tertiary">
              {t("mobileAlgo.strat.eyebrow", { version: "…" })}
            </Text>
            <View style={{ height: 96 }} />
          </View>
          <BlockSkeleton height={210} />
          <RowsSkeleton rows={3} />
        </View>
      ) : (
        <StrategyBody s={s} readOnly={readOnly} onOpenDep={openDep} onOpenBt={openBt} onAction={onAction} onBacktest={openBacktest} onDeploy={goDeploy} />
      )}
      <DeploymentSheet ref={depSheet} onChanged={() => void q.refresh()} />
      <BacktestSheet ref={btSheet} onStarted={openBt} />
      <ConfirmSheet ref={confirmRef} spec={confirm} />
    </Screen>
  );
}

const versionOf = (s: StrategyDetail, versionId: number) => s.versions.find((v) => v.id === versionId)?.version;

/** Everything under the top bar. Memoised: a poll that brought the same strategy (shared `s`) redraws nothing. */
const StrategyBody = React.memo(function StrategyBody({
  s,
  readOnly,
  onOpenDep,
  onOpenBt,
  onAction,
  onBacktest,
  onDeploy,
}: {
  s: StrategyDetail;
  readOnly: boolean;
  onOpenDep: (id: number) => void;
  onOpenBt: (id: number) => void;
  onAction: (d: Deployment, a: DeploymentAction) => void;
  onBacktest: (target: BacktestTarget) => void;
  onDeploy: (strategyId: number) => void;
}) {
  const t = useT();
  const f = useFormat();
  const archived = s.status === "archived";
  const canChange = !readOnly && !archived;
  const target: BacktestTarget = { strategyId: s.id, versionId: s.current.id, version: s.current.version, name: s.name, symbol: s.symbol, timeframe: s.timeframe, valid: s.current.valid };
  return (
    <View style={{ gap: space[8] }} testID="strategy-screen">
      <Title eyebrow={t("mobileAlgo.strat.eyebrow", { version: s.current.version })} title={s.name}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
          <Tag label={`${s.symbol} · ${s.timeframe}`} tone="cream" />
          <Tag label={s.kind === "code" ? t("mobileAlgo.kind.code") : t("mobileAlgo.kind.visual")} />
          <Tag label={originLabel(t, s.origin)} tone="sand" />
          {archived ? <Tag label={t("mobileAlgo.strat.archivedTag")} tone="neutral" /> : s.current.valid ? <Tag label={t("mobileAlgo.strat.ready")} tone="gold" /> : <Tag label={t("mobileAlgo.strat.errors", { count: s.current.errors.length })} tone="warn" />}
        </View>
      </Title>

      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <LastBacktest s={s} onOpen={onOpenBt} onRun={canChange ? () => onBacktest(target) : undefined} />
        {canChange ? (
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button
              testID="strategy-deploy"
              label={t("mobileAlgo.strat.deployV", { version: s.current.version })}
              icon={<Rocket size={18} color={colors.ink} />}
              full={false}
              style={{ flex: 1 }}
              disabled={!s.current.valid}
              onPress={() => onDeploy(s.id)}
            />
            <Button testID="strategy-backtest" label={t("mobileAlgo.strat.backtest")} variant="secondary" icon={<FlaskConical size={18} color={colors.text} />} full={false} style={{ flex: 1 }} disabled={!s.current.valid} onPress={() => onBacktest(target)} />
          </View>
        ) : null}
        {!s.current.valid && s.current.errors.length ? (
          <Banner tone="warn" icon={<TriangleAlert size={18} color={colors.warn} />} title={t("mobileAlgo.strat.fixFirst")} body={s.current.errors.map((e) => (e.line ? `${t("mobileAlgo.strat.line", { n: e.line })} ${e.message}` : e.message)).join("\n")} />
        ) : null}
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title={t("mobileAlgo.strat.rules")} sub={s.kind === "code" ? t("mobileAlgo.strat.rulesCodeSub") : t("mobileAlgo.strat.rulesSub")} />
        <Card style={{ marginHorizontal: GUTTER, gap: space[5] }} testID="strategy-rules">
          <RulesBody spec={s.current.spec} summary={s.current.summary} kind={s.kind} />
          {s.current.warnings.length ? (
            <View style={{ gap: space[1] }}>
              {s.current.warnings.map((w) => (
                <Note key={w} icon={<TriangleAlert size={13} color={colors.warn} />}>
                  {noteText(t, w)}
                </Note>
              ))}
            </View>
          ) : null}
          <CodeDisclosure code={s.current.source ?? s.current.code} label={t("mobileAlgo.strat.showCode")} />
        </Card>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title={t("mobileAlgo.strat.risk")} sub={t("mobileAlgo.strat.riskSub")} />
        <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[2] }}>
          <RiskRows risk={s.current.spec} />
        </Card>
        <View style={{ paddingHorizontal: GUTTER }}>
          <Note>{s.kind === "code" ? t("mobileAlgo.strat.editCode") : t("mobileAlgo.strat.editVisual")}</Note>
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title={t("mobileAlgo.strat.deployments")} sub={t("mobileAlgo.strat.deploymentsSub", { count: s.deployments.length })} />
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
          {s.deployments.length ? (
            s.deployments.map((d) => <DeploymentCard key={d.id} d={d} readOnly={readOnly} onOpen={onOpenDep} onPressIn={prefetchDeployment} onAction={onAction} />)
          ) : (
            <Card style={{ gap: space[3] }}>
              <Text tone="secondary">{t("mobileAlgo.strat.notRunning")}</Text>
              {canChange && s.current.valid ? <Button label={t("mobileAlgo.strat.deployV", { version: s.current.version })} size="sm" full={false} onPress={() => onDeploy(s.id)} /> : null}
            </Card>
          )}
        </View>
      </View>

      <View style={{ gap: space[1] }}>
        <SectionTitle
          title={t("mobileAlgo.strat.backtests")}
          sub={t("mobileAlgo.strat.backtestsSub", { count: s.backtests.length })}
          action={canChange && s.current.valid ? t("mobileAlgo.strat.runNew") : undefined}
          onAction={() => onBacktest(target)}
          testID="strategy-run-backtest"
          style={{ paddingBottom: space[2] }}
        />
        {s.backtests.length ? (
          s.backtests.map((b) => <BacktestRow key={b.id} b={b} name={s.name} version={versionOf(s, b.versionId)} onOpen={onOpenBt} onPressIn={prefetchBacktest} />)
        ) : (
          <Text variant="callout" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[3] }}>
            {t("mobileAlgo.strat.noBacktests")}
          </Text>
        )}
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title={t("mobileAlgo.strat.versions")} sub={t("mobileAlgo.strat.versionsSub", { count: s.versions.length })} />
        <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[2] }}>
          {s.versions.slice(0, 8).map((v, i, arr) => (
            <View key={v.id} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
              <Mono size={14} weight="bold" style={{ width: 40 }}>{`v${v.version}`}</Mono>
              <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                {v.note && v.note !== "resave" ? v.note : day(f, v.createdAt)}
              </Text>
              {v.id === s.current.id ? <Tag compact tone="cream" label={t("mobileAlgo.strat.current")} /> : !v.valid ? <Tag compact tone="warn" label={t("mobileAlgo.strat.draft")} /> : null}
            </View>
          ))}
        </Card>
        {s.kind === "code" && !readOnly ? (
          <View style={{ paddingHorizontal: GUTTER }}>
            <Button label={t("mobileAlgo.strat.openWeb")} variant="ghost" size="sm" full={false} onPress={() => openClientArea(`/developer/strategies?id=${s.id}`)} />
          </View>
        ) : null}
      </View>
    </View>
  );
});


/** The latest finished backtest: a huge net profit with the key ratios, or the call to run one. */
function LastBacktest({ s, onOpen, onRun }: { s: StrategyDetail; onOpen: (id: number) => void; onRun?: () => void }) {
  const t = useT();
  const f = useFormat();
  const b = s.backtests.find((x) => x.status === "done" && x.summary);
  if (!b || !b.summary) {
    return (
      <Card style={{ gap: space[3] }} testID="strategy-no-backtest">
        <Text variant="label" tone="tertiary">
          {t("mobileAlgo.strat.lastBacktest")}
        </Text>
        <Display size="sm">{t("mobileAlgo.strat.notTested")}</Display>
        <Text tone="secondary">{t("mobileAlgo.strat.notTestedBody")}</Text>
        {onRun && s.current.valid ? <Button label={t("mobileAlgo.strat.runFirst")} size="md" variant="cream" full={false} onPress={onRun} /> : null}
      </Card>
    );
  }
  const x = b.summary;
  return (
    <Card onPress={() => onOpen(b.id)} style={{ gap: space[4] }} testID="strategy-last-backtest">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
          {`${t("mobileAlgo.strat.lastBacktest")} · ${range(f, b.params.from, b.params.to)}`}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Display size="xl" color={x.netProfit > 0 ? colors.up : x.netProfit < 0 ? colors.down : colors.text} numberOfLines={1} adjustsFontSizeToFit>
          {usd(x.netProfit, true)}
        </Display>
        <Text variant="callout" weight="700" tone={moneyTone(x.returnPct)}>
          {t("mobileAlgo.bt.returnOf", { pct: pct(x.returnPct, 2), amount: usd(b.params.initialBalance, false, 0) })}
        </Text>
      </View>
      <StatGrid
        columns={4}
        size={15}
        items={[
          { label: t("mobileAlgo.bt.trades"), value: String(x.trades) },
          { label: t("mobileAlgo.bt.winRate"), value: pct(x.winRate, 1, false) },
          { label: t("mobileAlgo.bt.pf"), value: ratio(x.profitFactor) },
          { label: t("mobileAlgo.bt.maxDdShort"), value: pct(x.maxDrawdownPct, 1, false) },
        ]}
      />
      <Text variant="callout" weight="700" tone="ember">
        {t("mobileAlgo.strat.openReport")}
      </Text>
    </Card>
  );
}

export default StrategyScreen;

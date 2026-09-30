// /algo/backtests/[id] — a backtest report (D86): while the job runs, its stage and progress (cancel); when done, the
// net profit, the key ratios, the equity and drawdown curves on Skia (scrub with a finger), monthly returns, every
// statistic, the trade list (FlashList, filter wins / losses) and the data and costs that were simulated. "Run again"
// opens the period picker for the same version. A finished report never changes: the last ones are kept on the phone
// and open at once (api.ts).
import * as React from "react";
import { RefreshControl, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { FlaskConical, Info, RotateCcw } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { instrument } from "@/market/instruments";
import { useGroups } from "@/features/trading/accounts";
import { Banner, Button, Card, Display, Mono, Pill, Screen, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { algoPost, fetchers, keys, refreshAlgo, seedReport, validId, type BacktestDetail, type Report, type Trade } from "../api";
import { KV, Note, ProgressBar, SectionTitle, StatGrid, Tag, tint } from "../components/bits";
import { BarButton, TopBar, Title } from "../components/chrome";
import { Curve } from "../components/chart/Curve";
import { curveHeight, downsample, EQUITY_LAYOUT, isoMinute, type CurveData } from "../components/chart/types";
import { ROW, TradeRow } from "../components/rows";
import { BlockSkeleton, ChartSkeleton, LoadError, RowsSkeleton } from "../components/states";
import { btLabel, int, moneyTone, num, pct, range, ratio, stageText, usd } from "../format";
import { useBack, usePoll, usePullRefresh, useReadOnly } from "../hooks";
import { BacktestSheet, type BacktestSheetRef } from "../sheets/BacktestSheet";

type Filter = "all" | "wins" | "losses";
type Item = { type: "filter"; key: string } | { type: "trade"; key: string; x: Trade };

export function BacktestScreen() {
  const t = useT();
  const router = useRouter();
  const back = useBack("/algo");
  const readOnly = useReadOnly();
  const bottom = useBottomInset(false);
  const { width: screenW } = useWindowDimensions();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = validId(raw) ? raw : null;
  // a report kept on the phone opens at once (it never changes once done)
  React.useState(() => id && seedReport(id));
  const [poll, setPoll] = React.useState<number | undefined>(1_200);
  const q = useQuery(id ? keys.backtest(id) : null, fetchers.backtest(id ?? "0"), { staleMs: poll ? 1_000 : 24 * 3600_000, intervalMs: usePoll(poll) });
  const d = q.data;
  const active = !d || d.status === "queued" || d.status === "running";
  React.useEffect(() => setPoll(active ? 1_200 : undefined), [active]);
  const { refreshing, onRefresh } = usePullRefresh(() => q.refresh());
  const sheet = React.useRef<BacktestSheetRef>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [cancelling, setCancelling] = React.useState(false);

  const report = d?.status === "done" ? d.report : null;
  const digits = d ? instrument(d.params.symbol).digits : 5;
  const items = React.useMemo<Item[]>(() => {
    if (!report) return [];
    const trades = filter === "wins" ? report.trades.filter((x) => x.net > 0) : filter === "losses" ? report.trades.filter((x) => x.net <= 0) : report.trades;
    // newest first, like a history
    const out: Item[] = [{ type: "filter", key: "filter" }];
    for (let i = trades.length - 1; i >= 0; i--) out.push({ type: "trade", key: `t${trades[i]!.id}`, x: trades[i]! });
    return out;
  }, [report, filter]);

  // stable callbacks for the memoised header: a poll or a trade filter change never redraws the report above the list
  const current = React.useRef(d);
  current.current = d;
  const refresh = q.refresh;
  const runAgain = React.useCallback(() => {
    const x = current.current;
    if (!x || !x.strategyId) return;
    sheet.current?.open({ strategyId: x.strategyId, versionId: x.versionId, version: x.version ?? 0, name: x.strategyName ?? `#${x.strategyId}`, symbol: x.params.symbol, timeframe: x.params.timeframe, valid: true });
  }, []);
  const openNew = React.useCallback((newId: number) => router.push(`/algo/backtests/${newId}`), [router]);

  const cancelling_ = React.useRef(false);
  const cancel = React.useCallback(async () => {
    const x = current.current;
    if (!x || cancelling_.current) return;
    cancelling_.current = true;
    setCancelling(true);
    const r = await algoPost(`backtests/${x.id}/cancel`, {});
    cancelling_.current = false;
    setCancelling(false);
    // refused (it finished meanwhile, the service is down): say so; the report shows the job's real state
    if (!r.ok) toast.show({ title: r.error.message, tone: "error" });
    refreshAlgo();
    void refresh();
  }, [refresh]);
  const onCancel = React.useCallback(() => void cancel(), [cancel]);

  if (!id || (!d && q.error)) {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={q.error ?? { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={back} style={{ flex: 1, justifyContent: "center" }} />
      </Screen>
    );
  }

  const header = (
    <View>
      <TopBar onBack={back} right={d && !readOnly && d.strategyId && !active ? <BarButton testID="bt-again" accessibilityLabel={t("mobileAlgo.bt.runAgain")} icon={<RotateCcw size={19} color={colors.text} />} onPress={runAgain} /> : undefined} />
      {!d ? (
        <View style={{ gap: space[5] }}>
          <View style={{ height: 120 }} />
          <BlockSkeleton height={190} />
          <ChartSkeleton height={curveHeight(EQUITY_LAYOUT, true)} style={{ marginHorizontal: GUTTER }} />
        </View>
      ) : (
        <ReportHeader d={d} width={screenW - GUTTER * 2} readOnly={readOnly} cancelling={cancelling} onCancel={onCancel} onRunAgain={runAgain} />
      )}
    </View>
  );

  const footer = report ? <DataAndCosts d={d!} r={report} /> : null;

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={keyOf}
        getItemType={typeOf}
        renderItem={({ item }) =>
          item.type === "filter" ? (
            <TradesTitle r={report!} filter={filter} onFilter={setFilter} />
          ) : (
            <TradeRow x={item.x} digits={digits} />
          )
        }
        extraData={`${filter}:${digits}`}
        ListHeaderComponent={header}
        ListEmptyComponent={!d ? <RowsSkeleton rows={3} height={ROW.trade} /> : null}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: bottom + space[6] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <BacktestSheet ref={sheet} onStarted={openNew} />
    </Screen>
  );
}

const keyOf = (i: Item) => i.key;
const typeOf = (i: Item) => i.type;

/** Everything above the trade list. Memoised: a trade filter change never redraws the chart or the tables. */
const ReportHeader = React.memo(function ReportHeader({ d, width, readOnly, cancelling, onCancel, onRunAgain }: { d: BacktestDetail; width: number; readOnly: boolean; cancelling: boolean; onCancel: () => void; onRunAgain: () => void }) {
  const t = useT();
  const f = useFormat();
  const r = d.status === "done" ? d.report : null;
  const running = d.status === "queued" || d.status === "running";
  return (
    <View style={{ gap: space[8], paddingBottom: space[6] }}>
      <Title eyebrow={t("mobileAlgo.bt.eyebrow", { id: d.id, version: d.version ?? "—" })} title={d.strategyName ?? t("mobileAlgo.bt.title")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
          <Tag label={`${d.params.symbol} · ${d.params.timeframe}`} tone="cream" />
          <Tag label={range(f, d.params.from, d.params.to)} />
          <Tag label={t("mobileAlgo.bt.start", { amount: usd(d.params.initialBalance, false, 0) })} />
          {d.status !== "done" ? <Tag label={btLabel(t, d.status)} tone={running ? "ember" : d.status === "failed" ? "warn" : "neutral"} dot={running} testID="bt-status" /> : null}
        </View>
      </Title>

      {running ? (
        <Card style={{ marginHorizontal: GUTTER, gap: space[4] }} testID="bt-progress">
          <Text variant="label" tone="tertiary">
            {btLabel(t, d.status)}
          </Text>
          <Display size="md">{stageText(t, d.stage, d.status)}</Display>
          <ProgressBar value={d.status === "queued" ? 0.02 : d.progress} height={8} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Mono size={14} weight="bold" style={{ flex: 1 }}>{`${Math.round((d.status === "queued" ? 0 : d.progress) * 100)}%`}</Mono>
            {readOnly ? null : <Button testID="bt-cancel" label={t("common.cancel")} variant="secondary" size="sm" full={false} loading={cancelling} onPress={onCancel} />}
          </View>
          <Text variant="caption" tone="tertiary">
            {t("mobileAlgo.bt.runningNote")}
          </Text>
        </Card>
      ) : d.status === "failed" ? (
        <View style={{ marginHorizontal: GUTTER, gap: space[3] }}>
          <Banner tone="warn" title={t("mobileAlgo.bt.failed")} body={d.error ?? t("mobile.state.error.body")} />
          {readOnly || !d.strategyId ? null : <Button label={t("mobileAlgo.bt.runAgain")} variant="secondary" size="md" full={false} icon={<FlaskConical size={17} color={colors.text} />} onPress={onRunAgain} />}
        </View>
      ) : d.status === "cancelled" ? (
        <Card style={{ marginHorizontal: GUTTER, gap: space[3] }}>
          <Display size="sm">{t("mobileAlgo.bt.cancelled")}</Display>
          {readOnly || !d.strategyId ? null : <Button label={t("mobileAlgo.bt.runAgain")} variant="secondary" size="md" full={false} onPress={onRunAgain} />}
        </Card>
      ) : r ? (
        <DoneHeader d={d} r={r} width={width} />
      ) : null}
    </View>
  );
});

function DoneHeader({ d, r, width }: { d: BacktestDetail; r: Report; width: number }) {
  const t = useT();
  const m = r.metrics;
  return (
    <>
      {r.notes.length ? (
        <View style={{ marginHorizontal: GUTTER, gap: space[2] }}>
          {r.notes.map((n) => (
            <Banner key={n} tone="warn" icon={<Info size={17} color={colors.warn} />} title={n} />
          ))}
        </View>
      ) : null}
      <Card style={{ marginHorizontal: GUTTER, gap: space[5] }} testID="bt-hero">
        <View style={{ gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("mobileAlgo.bt.net")}
          </Text>
          <Display size="hero" color={m.netProfit > 0 ? colors.up : m.netProfit < 0 ? colors.down : colors.text} numberOfLines={1} adjustsFontSizeToFit testID="bt-net">
            {usd(m.netProfit, true)}
          </Display>
          <Text variant="callout" weight="700" tone={moneyTone(m.returnPct)}>
            {t("mobileAlgo.bt.returnOf", { pct: pct(m.returnPct, 2), amount: usd(m.initialBalance, false, 0) })}
          </Text>
        </View>
        <StatGrid
          columns={3}
          items={[
            { label: t("mobileAlgo.bt.pf"), value: ratio(m.profitFactor), tone: (m.profitFactor ?? 0) >= 1 ? undefined : "down" },
            { label: t("mobileAlgo.bt.winRate"), value: pct(m.winRate, 1, false), sub: t("mobileAlgo.bt.winsOf", { wins: m.wins, trades: m.trades }) },
            { label: t("mobileAlgo.bt.maxDd"), value: pct(-m.maxDrawdownPct, 2), tone: m.maxDrawdownPct > 0 ? "down" : undefined, sub: usd(-m.maxDrawdown) },
            { label: t("mobileAlgo.bt.sharpe"), value: ratio(m.sharpe), sub: t("mobileAlgo.bt.sortino", { v: ratio(m.sortino) }) },
            { label: t("mobileAlgo.bt.trades"), value: String(m.trades), sub: t("mobileAlgo.bt.longShort", { long: m.longTrades, short: m.shortTrades }) },
            { label: t("mobileAlgo.bt.expectancy"), value: usd(m.expectancy, true), tone: moneyTone(m.expectancy), sub: t("mobileAlgo.bt.perTrade") },
          ]}
        />
      </Card>
      <EquitySection r={r} width={width} />
      <Monthly r={r} />
      <Statistics d={d} r={r} />
    </>
  );
}

/** Equity (gold) and balance (dashed) over the starting balance, drawdown underneath; scrub for the values. */
function EquitySection({ r, width }: { r: Report; width: number }) {
  const t = useT();
  const f = useFormat();
  const m = r.metrics;
  const data = React.useMemo<CurveData | null>(() => {
    if (r.equity.length < 2) return null;
    const idx = downsample(
      r.equity.map((p) => p.equity),
      Math.max(60, Math.round(width / 3)),
    );
    const pts = idx.map((i) => r.equity[i]!);
    const main = pts.map((p) => p.equity);
    const hi = Math.max(...main, ...pts.map((p) => p.balance), m.initialBalance);
    const lo = Math.min(...main, ...pts.map((p) => p.balance), m.initialBalance);
    return {
      main,
      second: pts.map((p) => p.balance),
      dd: pts.map((p) => p.dd),
      baseline: m.initialBalance,
      tipDate: pts.map((p) => isoMinute(p.t * 1000)),
      tipMain: main.map((v) => usd(v)),
      tipSecond: pts.map((p) => usd(p.balance)),
      tipDd: pts.map((p) => pct(p.dd, 2)),
      hi: usd(hi, false, 0),
      lo: usd(lo, false, 0),
      ddTitle: t("mobileAlgo.bt.drawdown"),
      ddLabel: pct(-m.maxDrawdownPct, 2),
      color: colors.gold,
      a11y: t("mobileAlgo.bt.curveA11y", { from: usd(m.initialBalance, false, 0), to: usd(m.finalBalance, false, 0), dd: pct(-m.maxDrawdownPct, 2) }),
    };
  }, [r.equity, width, m.initialBalance, m.finalBalance, m.maxDrawdownPct, t]);
  const H = curveHeight(EQUITY_LAYOUT, true);
  return (
    <View style={{ gap: space[3] }}>
      <SectionTitle title={t("mobileAlgo.bt.equity")} sub={r.firstBar && r.lastBar ? range(f, r.firstBar, r.lastBar) : undefined} />
      <View style={{ marginHorizontal: GUTTER, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingBottom: space[3], overflow: "hidden" }}>
        {data ? (
          <Curve d={data} width={width - 2} layout={EQUITY_LAYOUT} fallback={<View style={{ height: H }} />} testID="bt-curve" />
        ) : (
          <Text tone="tertiary" style={{ padding: space[5] }}>
            {t("mobileAlgo.bt.noCurve")}
          </Text>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[4], paddingHorizontal: space[4], paddingTop: space[2] }}>
          <Legend color={colors.gold} label={t("mobileAlgo.bt.legendEquity")} />
          <Legend color={colors.cream} dashed label={t("mobileAlgo.bt.legendBalance")} />
          <Legend color={colors.lineStrong} dashed label={t("mobileAlgo.bt.legendStart")} />
        </View>
      </View>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Note>{t("mobileAlgo.bt.scrubHint")}</Note>
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 16, height: 0, borderTopWidth: 2, borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

/** Monthly returns as a heat grid per year (3 rows of 4 months: readable on a phone). Green / red: money. */
function Monthly({ r }: { r: Report }) {
  const t = useT();
  const f = useFormat();
  const names = React.useMemo(() => Array.from({ length: 12 }, (_, i) => f.date(Date.UTC(2026, i, 15), { month: "short", timeZone: "UTC" })), [f]);
  if (!r.monthly.length) return null;
  return (
    <View style={{ gap: space[3] }} testID="bt-monthly">
      <SectionTitle title={t("mobileAlgo.bt.monthly")} sub={t("mobileAlgo.bt.monthlySub")} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        {r.monthly.map((y) => (
          <View key={y.year} style={{ gap: space[2] }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
              <Display size="sm">{String(y.year)}</Display>
              <Mono size={14} weight="bold" tone={moneyTone(y.total)}>
                {pct(y.total, 2)}
              </Mono>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {y.months.map((v, i) => (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${names[i]} ${y.year}: ${v === null ? t("mobileAlgo.bt.noTradesMonth") : pct(v, 2)}`}
                  style={{ width: "23.5%", height: 54, borderRadius: radius.sm, padding: space[2], justifyContent: "space-between", backgroundColor: heat(v), borderWidth: 1, borderColor: v === null ? colors.line : "transparent" }}
                >
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {names[i]}
                  </Text>
                  <Mono size={13} weight="bold" tone={v === null ? "tertiary" : moneyTone(v)}>
                    {v === null ? "·" : pct(v, 1)}
                  </Mono>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Flat tint by size of the month's return (money colours). */
function heat(v: number | null): string {
  if (v === null) return "transparent";
  const a = 0.08 + Math.min(1, Math.abs(v) / 6) * 0.3;
  return v >= 0 ? tint(colors.up, a) : tint(colors.down, a);
}

function Statistics({ d, r }: { d: BacktestDetail; r: Report }) {
  const t = useT();
  const m = r.metrics;
  const rows: [string, string][] = [
    [t("mobileAlgo.stat.balance"), `${usd(m.initialBalance, false, 0)} → ${usd(m.finalBalance)}`],
    [t("mobileAlgo.stat.gross"), `${usd(m.grossProfit)} / ${usd(m.grossLoss)}`],
    [t("mobileAlgo.stat.cagr"), pct(m.cagrPct, 2)],
    [t("mobileAlgo.stat.avgWinLoss"), `${usd(m.avgWin)} / ${usd(m.avgLoss)}`],
    [t("mobileAlgo.stat.largest"), `${usd(m.largestWin)} / ${usd(m.largestLoss)}`],
    [t("mobileAlgo.stat.payoff"), ratio(m.payoffRatio)],
    [t("mobileAlgo.stat.long"), `${m.longTrades} · ${pct(m.longWinRate, 1, false)}`],
    [t("mobileAlgo.stat.short"), `${m.shortTrades} · ${pct(m.shortWinRate, 1, false)}`],
    [t("mobileAlgo.stat.streaks"), `${m.maxConsecutiveWins} / ${m.maxConsecutiveLosses}`],
    [t("mobileAlgo.stat.maxDd"), `${usd(-m.maxDrawdown)} · ${pct(-m.maxDrawdownPct, 2)}`],
    [t("mobileAlgo.stat.recovery"), ratio(m.recoveryFactor)],
    [t("mobileAlgo.stat.sharpeSortino"), `${ratio(m.sharpe)} / ${ratio(m.sortino)}`],
    [t("mobileAlgo.stat.avgBars"), num(m.avgBarsHeld, 1)],
    [t("mobileAlgo.stat.exposure"), pct(m.exposurePct, 1, false)],
    [t("mobileAlgo.stat.costs"), `${usd(m.totalCommission)} / ${usd(m.totalSwap)} / ${usd(m.spreadCost)}`],
    [t("mobileAlgo.stat.bars"), int(m.barsTested)],
    [t("mobileAlgo.stat.cpu"), t("mobileAlgo.stat.seconds", { s: ((d.cpuMs ?? 0) / 1000).toFixed(1) })],
  ];
  return (
    <View style={{ gap: space[3] }} testID="bt-stats">
      <SectionTitle title={t("mobileAlgo.bt.statistics")} />
      <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[1] }}>
        {rows.map(([k, v], i) => (
          <KV key={k} label={k} value={v} last={i === rows.length - 1} />
        ))}
      </Card>
    </View>
  );
}

function TradesTitle({ r, filter, onFilter }: { r: Report; filter: Filter; onFilter: (f: Filter) => void }) {
  const t = useT();
  // counted on the list itself (the same rule as the filter: a win is a positive net): a report over 5,000 trades
  // lists only the first 5,000, while its metrics count them all
  const wins = React.useMemo(() => r.trades.reduce((n, x) => n + (x.net > 0 ? 1 : 0), 0), [r.trades]);
  const all = r.trades.length;
  return (
    <View style={{ gap: space[3], paddingBottom: space[2] }} testID="bt-trades">
      <SectionTitle title={t("mobileAlgo.bt.tradeList")} sub={r.tradesTruncated ? t("mobileAlgo.bt.truncated", { n: all }) : t("mobileAlgo.bt.tradeListSub")} />
      <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER }} accessibilityRole="tablist">
        <Pill compact label={t("mobileAlgo.bt.fAll", { n: all })} selected={filter === "all"} onPress={() => onFilter("all")} />
        <Pill compact label={t("mobileAlgo.bt.fWins", { n: wins })} selected={filter === "wins"} onPress={() => onFilter("wins")} />
        <Pill compact label={t("mobileAlgo.bt.fLosses", { n: Math.max(0, all - wins) })} selected={filter === "losses"} onPress={() => onFilter("losses")} />
      </View>
      {all === 0 ? (
        <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[3] }}>
          {t("mobileAlgo.bt.noTrades")}
        </Text>
      ) : null}
    </View>
  );
}

/** What history and costs the simulation used (the web's "Data & costs" tab). Memoised: a trade filter change
 *  doesn't redraw it. */
const DataAndCosts = React.memo(function DataAndCosts({ d, r }: { d: BacktestDetail; r: Report }) {
  const t = useT();
  const f = useFormat();
  const groups = useGroups();
  const c = r.coverage;
  const groupName = (groups.data?.groups as { code: string; name?: string }[] | undefined)?.find((g) => g.code === c.costs.group)?.name ?? c.costs.group;
  return (
    <View style={{ gap: space[3], paddingTop: space[8] }} testID="bt-data">
      <SectionTitle title={t("mobileAlgo.bt.data")} />
      <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[1] }}>
        {c.segments.map((s, i) => (
          <KV key={i} label={`${s.tf} · ${t.dyn(`mobileAlgo.source.${s.source.replace(/\s+/g, "_")}`, s.source)}`} value={range(f, s.from, s.to)} />
        ))}
        <KV label={t("mobileAlgo.bt.m1Bars")} value={c.m1Bars ? `${int(c.m1Bars)}${c.m1From ? ` · ${t("mobileAlgo.bt.since", { date: f.date(c.m1From * 1000) })}` : ""}` : "0"} />
        <KV label={t("mobileAlgo.bt.signals")} value={t("mobileAlgo.bt.signalsValue", { buy: r.signals.buy, sell: r.signals.sell, exits: r.signals.exitBuy + r.signals.exitSell })} mono={false} />
        {r.skipped.map((s) => (
          <KV key={s.reason} label={t("mobileAlgo.bt.skipped", { reason: t.dyn(`mobileAlgo.skip.${s.reason.replace(/\s+/g, "_")}`, s.reason) })} value={String(s.count)} />
        ))}
        <KV label={t("mobileAlgo.bt.model")} value={r.model} mono={false} last />
      </Card>
      <Card style={{ marginHorizontal: GUTTER, paddingVertical: space[1] }}>
        <KV label={t("mobileAlgo.bt.group")} value={groupName} mono={false} />
        <KV label={t("mobileAlgo.bt.spread")} value={t("mobileAlgo.bt.spreadValue", { points: num(c.costs.spreadPoints, 1), source: t.dyn(`mobileAlgo.spreadSource.${c.costs.spreadSource.replace(/\s+/g, "_")}`, c.costs.spreadSource) })} mono={false} />
        <KV label={t("mobileAlgo.bt.commission")} value={t("mobileAlgo.bt.perLot", { amount: usd(c.costs.commissionPerLot) })} mono={false} />
        <KV label={t("mobileAlgo.bt.swaps")} value={c.costs.swaps ? t("mobileAlgo.bt.swapsOn") : t("mobileAlgo.bt.swapsOff")} mono={false} />
        <KV label={t("mobileAlgo.bt.conversion")} value={c.costs.usdBase ? t("mobileAlgo.bt.usdBase") : c.costs.quoteToUsd === 1 ? t("mobileAlgo.bt.usdQuoted") : t("mobileAlgo.bt.currentRate", { rate: num(c.costs.quoteToUsd, 5) })} mono={false} last />
      </Card>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Note>{t("mobileAlgo.bt.simNote", { id: d.id })}</Note>
      </View>
    </View>
  );
});

export default BacktestScreen;

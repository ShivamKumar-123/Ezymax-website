// Reports › Analytics (/reports/analytics?login=all|<login>&period=7D|30D|90D|1Y|ALL): how the client trades, from
// the reports service. Net P&L hero, stat tiles, equity / balance / drawdown curves (Skia, scrub), the P&L calendar,
// breakdowns by symbol, weekday, hour and session, long vs short, money flow, charges and behaviour insights.
// Opens on the cached answer for the account and period, then refreshes; while another period loads, the previous
// answer stays on screen, dimmed and still labelled with its own account and period. If that load fails, the
// screen says so (offline, not shared, service error) with a retry instead of keeping the old answer. Sections are
// list items, so each mounts only when it scrolls near.
import * as React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { FileText } from "lucide-react-native";
import { useT } from "@/i18n";
import { kv } from "@/lib/kv";
import { useOnline } from "@/lib/net";
import { useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { useActiveLogin } from "@/session/activeAccount";
import { Banner, Button, EmptyState, Pill, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { ACCOUNTS_KEY, allowsAll, analyticsKey, analyticsRange, ANALYTICS_STALE_MS, defaultScope, fetchAccounts, fetchAnalytics, isoDay, PERIOD_DAYS, PERIODS, prefetchAnalytics, prefetchMonths } from "./api";
import { AccountCard, AccountSheet } from "./components/AccountPicker";
import { Page, PageTitle, StackBar, useRefresh } from "./components/Chrome";
import { BySession, ByHour, BySymbol, ByWeekday, LongShort } from "./components/analytics/Breakdowns";
import { CurveSection } from "./components/analytics/CurveSection";
import { Hero, Tiles } from "./components/analytics/Headline";
import { Charges, Insights, MoneyFlow } from "./components/analytics/MoneyAndInsights";
import { PnlCalendar } from "./components/analytics/PnlCalendar";
import { CURVE_H } from "./components/charts/layout";
import type { Analytics, Period, ReportAccount, Scope } from "./types";

const PERIOD_PREF = "kalks.reports.period";
type Item = "hero" | "tiles" | "curve" | "calendar" | "symbol" | "weekday" | "hour" | "session" | "side" | "flow" | "charges" | "insights" | "empty" | "footer";
const FULL: Item[] = ["hero", "tiles", "curve", "calendar", "symbol", "weekday", "hour", "session", "side", "flow", "charges", "insights", "footer"];

const isPeriod = (v: unknown): v is Period => typeof v === "string" && (PERIODS as string[]).includes(v);

export function AnalyticsScreen() {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const params = useLocalSearchParams<{ login?: string; period?: string }>();
  const paramScope: Scope | null = params.login === "all" ? "all" : /^\d{8}$/.test(String(params.login ?? "")) ? Number(params.login) : null;
  const viewerKey = useSession((s) => (s.viewer ? s.viewer.accounts.join(",") : null));
  const viewerAccounts = React.useMemo(() => (viewerKey === null ? null : viewerKey.split(",").filter(Boolean).map(Number)), [viewerKey]);
  const active = useActiveLogin();
  const scrollY = useSharedValue(0);
  const accountSheet = React.useRef<SheetRef>(null);

  const accountsQ = useQuery(ACCOUNTS_KEY, fetchAccounts, { persist: true, staleMs: 15_000 });
  const [picked, setPicked] = React.useState<Scope | null>(paramScope);
  const scope: Scope = picked !== null && (picked !== "all" || allowsAll(viewerAccounts)) ? picked : defaultScope(accountsQ.data?.accounts, viewerAccounts, active);
  const [period, setPeriodState] = React.useState<Period>(() => (isPeriod(params.period) ? params.period : isPeriod(kv.get(PERIOD_PREF)) ? (kv.get(PERIOD_PREF) as Period) : "90D"));
  const setPeriod = (p: Period) => {
    setPeriodState(p);
    kv.set(PERIOD_PREF, p);
  };

  const key = analyticsKey(scope, period);
  const q = useQuery(key, () => fetchAnalytics(scope, period), { persist: true, staleMs: ANALYTICS_STALE_MS });
  // the last answer on screen, with the account and period it belongs to
  const last = React.useRef<{ d: Analytics; scope: Scope; period: Period } | undefined>(undefined);
  if (q.data) last.current = { d: q.data, scope, period };
  // nothing for this account / period and the last request failed: say so (never the previous answer)
  const failed = !q.data && !!q.error && !q.fetching;
  const stale = !q.data && !failed && !!last.current;
  const d = q.data ?? (stale ? last.current!.d : undefined);
  const shownScope = stale ? last.current!.scope : scope;
  const shownPeriod = stale ? last.current!.period : period;

  const refreshControl = useRefresh(() => Promise.all([q.refresh(), accountsQ.refresh()]));
  const accounts: ReportAccount[] = React.useMemo(() => accountsQ.data?.accounts ?? d?.accounts ?? [], [accountsQ.data, d]);
  const account = typeof scope === "number" ? accounts.find((a) => a.login === scope) : undefined;
  const noAccounts = !!d && d.accounts.length === 0 && accounts.length === 0;
  const range = analyticsRange(shownPeriod);
  const today = isoDay(new Date());
  const periodLabel = shownPeriod === "ALL" ? t("portfolio.an.period.allTime") : shownPeriod === "1Y" ? t("portfolio.an.period.last12Months") : t("portfolio.an.period.lastDays", { count: PERIOD_DAYS[shownPeriod] });
  const scopeLabel = shownScope === "all" ? t("portfolio.an.allLive") : `#${shownScope}`;

  const items: Item[] = React.useMemo(() => {
    if (!d || d.accounts.length === 0) return [];
    if (d.stats.trades === 0 && d.curve.points.length < 2) return ["empty", ...(d.moneyFlow.deposits || d.moneyFlow.withdrawals ? (["flow"] as Item[]) : []), "footer"];
    return FULL;
  }, [d]);

  const renderItem = React.useCallback<ListRenderItem<Item>>(
    ({ item }) => {
      if (!d) return null;
      const gap = item === "hero" || item === "empty" ? space[5] : item === "tiles" ? space[3] : space[10];
      let body: React.ReactNode = null;
      switch (item) {
        case "hero":
          body = <Hero d={d} periodLabel={periodLabel} />;
          break;
        case "tiles":
          body = <Tiles d={d} />;
          break;
        case "curve":
          body = <CurveSection d={d} label={scopeLabel} />;
          break;
        case "calendar":
          body = <PnlCalendar d={d} from={range.from} today={today} />;
          break;
        case "symbol":
          body = <BySymbol rows={d.bySymbol} />;
          break;
        case "weekday":
          body = <ByWeekday rows={d.byWeekday} />;
          break;
        case "hour":
          body = <ByHour heat={d.hourHeatmap} trades={d.hourTrades} />;
          break;
        case "session":
          body = <BySession rows={d.bySession} />;
          break;
        case "side":
          body = <LongShort all={d.stats} long={d.long} short={d.short} />;
          break;
        case "flow":
          body = <MoneyFlow f={d.moneyFlow} periodLabel={periodLabel} />;
          break;
        case "charges":
          body = <Charges c={d.charges} />;
          break;
        case "insights":
          body = <Insights d={d} periodLabel={periodLabel} />;
          break;
        case "empty":
          body = <EmptyState illustration="emptyHistory" title={t("portfolio.an.empty.title")} body={t("portfolio.an.empty.text")} size={200} />;
          break;
        case "footer":
          body = (
            <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
              <View onTouchStart={() => typeof scope === "number" && prefetchMonths(scope)}>
                <Button variant="secondary" label={t("portfolio.st.title")} icon={<FileText size={18} color={colors.text} strokeWidth={1.75} />} onPress={() => router.push(typeof scope === "number" ? `/reports/statements?login=${scope}` : "/reports/statements")} />
              </View>
              <Text variant="caption" tone="tertiary">
                {t("mobileReports.state.footer")}
              </Text>
            </View>
          );
          break;
      }
      return <View style={{ paddingTop: gap, opacity: stale ? 0.45 : 1 }}>{body}</View>;
    },
    [d, periodLabel, scopeLabel, range.from, today, stale, scope, router, t],
  );

  const bar = <StackBar title={t("portfolio.an.title")} scrollY={scrollY} />;
  const header = (
    <View>
      <PageTitle eyebrow={t("mobileReports.eyebrow.analytics")} title={t("portfolio.an.title")} />
      {/* a client without any trading account has nothing to pick: the empty state below offers to open one */}
      {noAccounts ? null : (
        <>
          <AccountCard scope={scope} account={account} liveCount={accounts.filter((a) => a.type === "live").length} onPress={() => accountSheet.current?.present()} />
          <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER, marginTop: space[3] }} accessibilityRole="tablist">
            {PERIODS.map((p) => (
              <View key={p} style={{ flex: 1 }} onTouchStart={() => p !== period && prefetchAnalytics(scope, p)}>
                <Pill
                  label={t(`portfolio.an.period.${p}`)}
                  accessibilityLabel={p === "ALL" ? t("portfolio.an.period.allTime") : p === "1Y" ? t("portfolio.an.period.last12Months") : t("portfolio.an.period.lastDays", { count: PERIOD_DAYS[p] })}
                  selected={p === period}
                  onPress={() => setPeriod(p)}
                  style={{ paddingHorizontal: 0, alignItems: "center" }}
                />
              </View>
            ))}
          </View>
        </>
      )}
      {stale ? (
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: space[3] }} accessibilityLiveRegion="polite">
          {t("mobileReports.state.updating")}
        </Text>
      ) : q.error && d ? (
        <Banner tone="info" title={t("mobileReports.state.stale")} body={q.error.message} style={{ marginHorizontal: GUTTER, marginTop: space[4] }} />
      ) : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (!d) {
    if (q.error && !q.fetching) {
      const denied = q.error.status === 403;
      const offline = !online || q.error.code === "network";
      empty = (
        <EmptyState
          illustration={offline ? "connectionLost" : denied ? "security" : "mascot"}
          title={offline ? t("mobile.state.offline.title") : denied ? t("mobileReports.state.notShared.title") : t("portfolio.an.failed")}
          body={offline ? t("mobile.state.offline.body") : q.error.message}
          action={denied ? undefined : t("mobile.action.retry")}
          onAction={() => void q.refresh()}
          style={{ marginTop: space[4] }}
        />
      );
    } else empty = <LoadingBody label={t("common.loading")} />;
  } else if (d.accounts.length === 0) {
    empty = <EmptyState illustration="emptyHistory" title={t("portfolio.noAccounts.title")} body={t("portfolio.an.noAccountsText")} action={t("portfolio.openAccount")} onAction={() => router.push("/accounts/new")} style={{ marginTop: space[4] }} />;
  }

  return (
    <Page bar={bar}>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(i) => i}
        getItemType={(i) => i}
        extraData={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: space[16] }}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        drawDistance={600}
      />
      <AccountSheet
        ref={accountSheet}
        accounts={accounts}
        value={scope}
        allowAll={allowsAll(viewerAccounts)}
        onSelect={(s) => {
          setPicked(s);
          accountSheet.current?.dismiss();
        }}
        onPressIn={(s) => prefetchAnalytics(s, period)}
      />
    </Page>
  );
}

/** Shaped like the page: hero block, two rows of tiles, the chart card. Static (no shimmer). */
function LoadingBody({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} accessible style={{ paddingHorizontal: GUTTER, paddingTop: space[5], gap: space[3] }}>
      <Skeleton h={214} r={radius.block} />
      {[0, 1].map((r) => (
        <View key={r} style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ flex: 1 }}>
            <Skeleton h={136} r={radius.card} />
          </View>
          <View style={{ flex: 1 }}>
            <Skeleton h={136} r={radius.card} />
          </View>
        </View>
      ))}
      <View style={{ marginTop: space[8], gap: space[2] }}>
        <Skeleton w={180} h={22} />
        <Skeleton w={220} h={12} />
      </View>
      <Skeleton h={CURVE_H + 70} r={radius.card} />
    </View>
  );
}

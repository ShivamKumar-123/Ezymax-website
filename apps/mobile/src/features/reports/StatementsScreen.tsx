// Reports › Statements (/reports/statements?login=): branded PDF, Excel and CSV statements of one trading account
// for a day, a month, a year or any range, and the account's calendar months. Files come from the reports service
// through the BFF and open the share sheet. Opens on the cached accounts and months, then refreshes.
import * as React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Check } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useOnline } from "@/lib/net";
import { useQuery } from "@/lib/query";
import { useActiveLogin } from "@/session/activeAccount";
import { ColorBlock, Display, EmptyState, Skeleton, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { ACCOUNTS_KEY, fetchAccounts, fetchMonths, monthsKey, pickStatementAccount, prefetchAnalytics } from "./api";
import { AccountCard, AccountSheet } from "./components/AccountPicker";
import { Page, PageTitle, SectionTitle, StackBar, useRefresh } from "./components/Chrome";
import { MonthItem, MonthRowsSkeleton, MonthSheet } from "./components/MonthRows";
import { StatementForm } from "./components/StatementForm";
import { clearSavedStatements } from "./save";
import type { MonthRow, Scope } from "./types";
import { useStatementDownload } from "./useStatementDownload";

const CONTENTS = ["portfolio.st.contents.account", "portfolio.st.contents.trades", "portfolio.st.contents.open", "portfolio.st.contents.funding", "portfolio.st.contents.charges", "portfolio.st.contents.totals"] as const;

export function StatementsScreen() {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const online = useOnline();
  const params = useLocalSearchParams<{ login?: string }>();
  const wanted = /^\d{8}$/.test(String(params.login ?? "")) ? Number(params.login) : null;
  const active = useActiveLogin();
  const scrollY = useSharedValue(0);
  const accountSheet = React.useRef<SheetRef>(null);
  const monthSheet = React.useRef<SheetRef>(null);

  const accountsQ = useQuery(ACCOUNTS_KEY, fetchAccounts, { persist: true, staleMs: 15_000 });
  const accounts = React.useMemo(() => accountsQ.data?.accounts ?? [], [accountsQ.data]);
  const [picked, setPicked] = React.useState<number | null>(wanted);
  const account = pickStatementAccount(accounts, picked, active);
  const login = account?.login ?? null;
  const monthsQ = useQuery(login ? monthsKey(login) : null, () => fetchMonths(login!), { persist: true, staleMs: 60_000 });
  const { busy, download } = useStatementDownload();
  const [openMonth, setOpenMonth] = React.useState<MonthRow | null>(null);

  // files shared in an earlier visit are not kept around
  React.useEffect(() => clearSavedStatements(), []);

  const refreshControl = useRefresh(() => Promise.all([accountsQ.refresh(), monthsQ.refresh()]));
  const currency = account ? (account.cent || account.currency === "USC" ? "USC" : account.currency) : "USD";
  const months = monthsQ.data?.login === login ? (monthsQ.data?.months ?? []) : [];
  const labels = React.useMemo(() => new Map(months.map((m) => [m.month, fmt.date(`${m.from}T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" })])), [months, fmt]);

  const onOpen = React.useCallback((m: MonthRow) => {
    setOpenMonth(m);
    monthSheet.current?.present();
  }, []);
  const renderItem = React.useCallback<ListRenderItem<MonthRow>>(({ item }) => <MonthItem m={item} label={labels.get(item.month) ?? item.month} currency={currency} onOpen={onOpen} />, [labels, currency, onOpen]);
  const select = (s: Scope) => {
    if (s === "all") return;
    setPicked(s);
    accountSheet.current?.dismiss();
  };

  const bar = <StackBar title={t("portfolio.st.title")} scrollY={scrollY} />;
  const title = <PageTitle eyebrow={t("mobileReports.eyebrow")} title={t("portfolio.st.title")} />;

  if (!accountsQ.data) {
    if (accountsQ.error) {
      const denied = accountsQ.error.status === 403;
      const offline = !online || accountsQ.error.code === "network";
      return (
        <Page bar={bar}>
          {title}
          <EmptyState
            illustration={offline ? "connectionLost" : denied ? "security" : "mascot"}
            title={offline ? t("mobile.state.offline.title") : denied ? t("mobileReports.state.notShared.title") : t("mobile.state.error.title")}
            body={offline ? t("mobile.state.offline.body") : accountsQ.error.message}
            action={denied ? undefined : t("mobile.action.retry")}
            onAction={() => void accountsQ.refresh()}
          />
        </Page>
      );
    }
    return (
      <Page bar={bar}>
        {title}
        <LoadingBody />
      </Page>
    );
  }

  if (!account) {
    return (
      <Page bar={bar}>
        {title}
        <EmptyState illustration="emptyHistory" title={t("portfolio.noAccounts.title")} body={t("portfolio.noAccounts.text")} action={t("portfolio.openAccount")} onAction={() => router.push("/accounts/new")} />
      </Page>
    );
  }

  const header = (
    <View>
      {title}
      <AccountCard scope={account.login} account={account} liveCount={accounts.filter((a) => a.type === "live").length} onPress={() => accountSheet.current?.present()} />
      <StatementForm key={account.login} account={account} busy={busy} onDownload={download} />
      <ColorBlock color="periwinkle" style={{ marginHorizontal: GUTTER, marginTop: space[8] }}>
        <Display size="sm" color={colors.ink} accessibilityRole="header">
          {t("portfolio.st.contents.title")}
        </Display>
        <View style={{ marginTop: space[4], gap: space[3] }}>
          {CONTENTS.map((k) => (
            <View key={k} style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Check size={12} color={colors.periwinkle} strokeWidth={3} />
              </View>
              <Text variant="callout" color={colors.ink} style={{ flex: 1 }}>
                {t(k)}
              </Text>
            </View>
          ))}
        </View>
      </ColorBlock>
      <SectionTitle title={t("portfolio.st.monthly.title")} subtitle={t("portfolio.st.monthly.subtitle", { currency })} style={{ marginHorizontal: GUTTER, marginTop: space[10], marginBottom: space[1] }} />
    </View>
  );

  const empty = monthsQ.loading ? (
    <MonthRowsSkeleton />
  ) : monthsQ.error && !monthsQ.data ? (
    <Text tone="tertiary" style={{ marginHorizontal: GUTTER, marginTop: space[4] }} onPress={() => void monthsQ.refresh()}>
      {monthsQ.error.status === 403 ? monthsQ.error.message : t("portfolio.st.monthly.unavailable")}
    </Text>
  ) : (
    <Text tone="tertiary" style={{ marginHorizontal: GUTTER, marginTop: space[4] }}>
      {t("mobileReports.st.monthly.empty")}
    </Text>
  );

  return (
    <Page bar={bar}>
      <FlashList
        data={months}
        renderItem={renderItem}
        keyExtractor={(m) => m.month}
        getItemType={() => "month"}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          <Text variant="caption" tone="tertiary" style={{ marginHorizontal: GUTTER, marginTop: space[6] }}>
            {t("mobileReports.state.footerStatements")}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: space[16] }}
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      />
      <AccountSheet
        ref={accountSheet}
        accounts={accounts}
        value={account.login}
        allowAll={false}
        onSelect={select}
        onPressIn={(s) => {
          if (typeof s === "number") prefetchAnalytics(s);
        }}
      />
      <MonthSheet ref={monthSheet} month={openMonth} label={openMonth ? (labels.get(openMonth.month) ?? openMonth.month) : ""} login={account.login} currency={currency} busy={busy} onDownload={download} />
    </Page>
  );
}

function LoadingBody() {
  return (
    <View accessibilityLabel="Loading" accessible style={{ gap: space[5] }}>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Skeleton h={64} r={radius.lg} />
      </View>
      <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER }}>
        {[64, 76, 60, 78].map((w, i) => (
          <Skeleton key={i} w={w} h={40} r={20} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1 }}>
            <Skeleton h={84} r={radius.lg} />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Skeleton h={54} r={27} />
      </View>
      <MonthRowsSkeleton rows={3} />
    </View>
  );
}

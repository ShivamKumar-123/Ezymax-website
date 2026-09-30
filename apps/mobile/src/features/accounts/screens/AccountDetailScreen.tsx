// /accounts/[login]: one trading account. Opens at once on the list's copy of the account (or the cached detail),
// refreshes every 4 s while on screen. Actions: trade on it (sets the app's active account), transfer, statement,
// demo refill (daily cap), leverage (only without open positions) and the trading / investor passwords (emailed
// code). View-only and read-only staff sessions see the figures only; the server refuses changes from them anyway.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { ArrowLeftRight, CandlestickChart, Copy, FileText, RotateCcw } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { useOnline } from "@/lib/net";
import { useSession } from "@/session";
import { setActiveLogin, useActiveLogin } from "@/session/activeAccount";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, EmptyState, IconButton, Skeleton, Text, toast, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { LOGIN_RE, accountError, cachedAccount, refetchList, refillDemo, useAccountDetail, useReadOnly } from "../api";
import { copyText } from "../components/Credentials";
import { KindTag, Page, PageTitle, StatusTag, StackBar, Tag } from "../components/Chrome";
import { CredentialsSection, DemoFundsSection, EquityHero, InfoSection, LeverageSection, MarginSection } from "../components/DetailParts";
import { LeverageSheet } from "../components/LeverageSheet";
import { PasswordSheet } from "../components/PasswordSheet";
import { canTrade, curOf, demoFull, lev, money, notFunded, refillsLeft, serverOf } from "../format";
import type { Account, PasswordKind } from "../types";
import { publishFigures, useStructural } from "../figures";
import { MarginCallBanner } from "../components/LiveFigure";

/** Broker restrictions that matter on this screen (trading and transfers). */
const RESTRICTION_KINDS = ["trading", "close_only", "transfers"];

/** Half-width action buttons: tighter sides than a full-width button, so an icon and a label fit a 360 pt phone. */
const HALF = { flex: 1, paddingHorizontal: space[4] } as const;

/** Leaves the stack for one of the tabs (Trade, Portfolio) on the app's active account. */
function useGoToTab() {
  const router = useRouter();
  return React.useCallback(
    (tab: "/trade" | "/portfolio") => {
      if (router.canDismiss()) router.dismissAll();
      router.navigate(tab);
    },
    [router],
  );
}

function DetailSkeleton() {
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[4] }} accessibilityLabel="Loading" accessible>
      <Skeleton w={120} h={12} />
      <Skeleton w={220} h={40} />
      <Skeleton h={190} r={radius.block} />
      <Skeleton h={54} r={27} />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Skeleton w="48%" h={46} r={23} />
        <Skeleton w="48%" h={46} r={23} />
      </View>
      <Skeleton h={220} r={radius.card} style={{ marginTop: space[4] }} />
    </View>
  );
}

type BodyProps = {
  a: Account;
  readOnly: boolean;
  /** the account the Trade tab works on */
  active: boolean;
  restricted: boolean;
  refilling: boolean;
  onTrade: () => void;
  onRefill: () => void;
  onPositions: () => void;
  onLeverage: () => void;
  onPassword: (kind: PasswordKind) => void;
};

/** Everything under the bar. Memoised on the account's structural part: a poll that only moved prices re-renders
 *  none of it (the figures inside update on their own). */
const DetailBody = React.memo(function DetailBody({ a, readOnly, active, restricted, refilling, onTrade, onRefill, onPositions, onLeverage, onPassword }: BodyProps) {
  const t = useT();
  const router = useRouter();
  const live = a.type === "live";
  const tradable = canTrade(a);
  const refillBlocked = !a.demo || refillsLeft(a) === 0 || demoFull(a) || a.status === "expired";
  const kind = live ? t("mobileAccounts.kind.live") : t("mobileAccounts.kind.demo");
  const transfer = () => router.push({ pathname: "/wallet/transfer", params: { to: String(a.login) } });
  const statement = () => router.push({ pathname: "/reports/statements", params: { login: String(a.login) } });
  return (
    <>
      <PageTitle eyebrow={t("mobileAccounts.detail.eyebrow", { kind, server: serverOf(a.type) })} title={`#${a.login}`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2], marginTop: space[2] }}>
          <KindTag type={a.type} />
          <Text variant="callout" weight="600">
            {a.groupName} · {t.dyn(`mobileAccounts.mode.${a.mode}`, a.mode)}
          </Text>
          <Tag label={lev(a.leverage)} mono />
          {curOf(a) === "USC" ? <Tag label="USC" /> : null}
          <StatusTag status={a.status} />
          {!readOnly && active ? <Tag label={t("mobileAccounts.list.active")} tone="cream" /> : null}
        </View>
        {a.name ? (
          <Text variant="callout" tone="tertiary" numberOfLines={1} style={{ marginTop: space[1] }}>
            “{a.name}”
          </Text>
        ) : null}
      </PageTitle>

      <EquityHero a={a} />

      {!readOnly ? (
        <View style={{ paddingHorizontal: GUTTER, marginTop: space[4], gap: space[3] }}>
          <Button label={t("mobileAccounts.detail.trade")} variant="cream" icon={<CandlestickChart size={20} color={colors.ink} strokeWidth={2} />} disabled={!tradable} onPress={onTrade} testID="trade-on-account" />
          {!tradable ? (
            <Text variant="caption" tone="tertiary" align="center">
              {t("mobileAccounts.detail.tradeBlocked", { status: t.dyn(`mobileAccounts.status.${a.status}`, a.status) })}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: space[3] }}>
            {live ? (
              <Button label={t("mobileAccounts.detail.transfer")} variant="secondary" size="md" full={false} style={HALF} icon={<ArrowLeftRight size={17} color={colors.text} />} onPress={transfer} />
            ) : (
              <Button label={t("mobileAccounts.detail.refill")} variant="secondary" size="md" full={false} style={HALF} icon={<RotateCcw size={17} color={colors.text} />} disabled={refillBlocked} loading={refilling} onPress={onRefill} testID="refill" />
            )}
            <Button label={t("mobileAccounts.detail.statement")} variant="secondary" size="md" full={false} style={HALF} icon={<FileText size={17} color={colors.text} />} onPress={statement} />
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: GUTTER, marginTop: space[4] }}>
          <Button label={t("mobileAccounts.detail.statement")} variant="secondary" size="md" icon={<FileText size={17} color={colors.text} />} onPress={statement} />
        </View>
      )}

      {!readOnly ? <MarginCallBanner a={a} style={{ marginHorizontal: GUTTER, marginTop: space[4] }} /> : null}
      {!readOnly && notFunded(a) ? <Banner tone="info" title={t("mobileAccounts.detail.notFunded")} action={t("mobileAccounts.detail.fund")} onAction={transfer} style={{ marginHorizontal: GUTTER, marginTop: space[4] }} /> : null}
      {!readOnly && restricted ? (
        <View style={{ paddingHorizontal: GUTTER, marginTop: space[4] }}>
          <RestrictionBanner kinds={RESTRICTION_KINDS} />
        </View>
      ) : null}
      <View style={{ gap: space[8], marginTop: space[8] }}>
        {a.type === "demo" ? <DemoFundsSection a={a} /> : null}
        <MarginSection a={a} onPositions={readOnly ? undefined : onPositions} />
        <LeverageSection a={a} onChange={readOnly ? undefined : onLeverage} />
        <CredentialsSection a={a} onPassword={readOnly ? undefined : onPassword} />
        <InfoSection a={a} />
      </View>
    </>
  );
});

export function AccountDetailScreen() {
  const t = useT();
  const router = useRouter();
  const goTab = useGoToTab();
  const { login: raw } = useLocalSearchParams<{ login: string }>();
  const login = raw && LOGIN_RE.test(String(raw)) ? Number(raw) : null;
  const q = useAccountDetail(login);
  const online = useOnline();
  const readOnly = useReadOnly();
  const activeLogin = useActiveLogin();
  const restricted = useSession((st) => st.restricted.some((k) => RESTRICTION_KINDS.includes(k)));
  const bottom = useBottomInset(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refilling, setRefilling] = React.useState(false);
  const [pwKind, setPwKind] = React.useState<PasswordKind>("trading");
  const leverageSheet = React.useRef<SheetRef>(null);
  const passwordSheet = React.useRef<SheetRef>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // open on what we already know (the list's copy) while the account's own answer loads; the body gets the
  // structural part (same object while only prices moved), the figures reach their leaf subscribers (figures.ts)
  const a: Account | undefined = useStructural(q.data?.account ?? (login ? cachedAccount(login) : undefined));
  React.useEffect(() => {
    if (q.data?.account) publishFigures([q.data.account]);
  }, [q.data]);
  const notFound = !login || (!q.data && q.error?.status === 404);

  const refetch = q.refresh;
  const refresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      // the list (Home, Trade, the accounts list) refreshes too, without fetching this account a second time
      refetchList();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  const refreshControl = React.useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />,
    [refreshing, refresh],
  );

  const trade = React.useCallback(() => {
    if (!a) return;
    setActiveLogin(a.login);
    goTab("/trade");
  }, [a, goTab]);

  const positions = React.useCallback(() => {
    if (!a) return;
    setActiveLogin(a.login);
    goTab("/portfolio");
  }, [a, goTab]);

  const refill = React.useCallback(async () => {
    if (!a || refilling) return;
    setRefilling(true);
    const r = await refillDemo(a.login);
    setRefilling(false);
    if (r.ok) {
      const left = Math.max(0, refillsLeft(a) - 1);
      toast.show({ title: t("mobileAccounts.demo.refilled"), body: t("mobileAccounts.demo.refilledBody", { login: a.login, amount: money(r.data.balance, a), count: left }), tone: "success" });
    } else {
      toast.show({ title: t("mobileAccounts.demo.refillFailed"), body: accountError(r.error), tone: "error" });
    }
  }, [a, refilling, t]);
  const onRefill = React.useCallback(() => void refill(), [refill]);

  const openLeverage = React.useCallback(() => leverageSheet.current?.present(), []);

  const openPassword = React.useCallback((kind: PasswordKind) => {
    setPwKind(kind);
    // present once the sheet has the chosen kind (no frame with the other title)
    requestAnimationFrame(() => passwordSheet.current?.present());
  }, []);

  const copyLogin = React.useMemo(
    () => (login ? <IconButton accessibilityLabel={t("mobileAccounts.copyA11y", { what: t("mobileAccounts.info.login") })} tone="ghost" icon={<Copy size={19} color={colors.text2} />} onPress={() => void copyText(String(login), t("mobileAccounts.info.login"), t)} /> : null),
    [login, t],
  );
  const bar = <StackBar title={login ? `#${login}` : undefined} scrollY={scrollY} right={copyLogin} />;

  if (notFound) {
    return (
      <Page bar={<StackBar />}>
        <EmptyState illustration="emptyHistory" title={t("mobileAccounts.notFound.title")} body={t("mobileAccounts.notFound.body", { login: raw ?? "" })} action={t("mobileAccounts.notFound.back")} onAction={() => router.replace("/accounts")} style={{ flex: 1, justifyContent: "center" }} />
      </Page>
    );
  }

  if (!a) {
    const offline = !online || q.error?.code === "network";
    return (
      <Page bar={bar}>
        {q.error ? (
          <EmptyState
            illustration="connectionLost"
            title={offline ? t("mobile.state.offline.title") : t("mobileAccounts.error.title")}
            body={offline ? t("mobile.state.offline.body") : accountError(q.error)}
            action={t("mobile.action.retry")}
            onAction={() => void refetch()}
            style={{ flex: 1, justifyContent: "center" }}
          />
        ) : (
          <DetailSkeleton />
        )}
      </Page>
    );
  }

  return (
    <Page bar={bar}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + space[6] }} refreshControl={refreshControl}>
        <DetailBody
          a={a}
          readOnly={readOnly}
          active={activeLogin === a.login}
          restricted={restricted}
          refilling={refilling}
          onTrade={trade}
          onRefill={onRefill}
          onPositions={positions}
          onLeverage={openLeverage}
          onPassword={openPassword}
        />
      </Animated.ScrollView>
      {!readOnly ? (
        <>
          <LeverageSheet ref={leverageSheet} a={a} />
          <PasswordSheet ref={passwordSheet} a={a} kind={pwKind} />
        </>
      ) : null}
    </Page>
  );
}

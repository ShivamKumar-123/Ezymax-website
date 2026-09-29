// Portfolio: the active account's summary (balance, equity, margin, free margin, margin level; live), open
// positions (swipe to close, tap for details, partial close, SL / TP), pending orders (edit / cancel) and the
// closed-trade history. Data comes from the engine stream; history from the engine's history endpoint.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { FileText } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtLots, fmtMoney, fmtPrice } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useQuery } from "@/lib/query";
import { instrument } from "@/market/instruments";
import { useSession } from "@/session";
import { useActiveLogin } from "@/session/activeAccount";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, EmptyState, Mono, PressableScale, Screen, ScreenHeader, SkeletonRows, Text, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { accountLabel } from "../trading/AccountSwitcher";
import { useAccounts } from "../trading/accounts";
import { cancelOrder, closePosition } from "../trading/actions";
import { refreshState, useAccountLive, useTrade } from "../trading/live";
import { tradeApi } from "../trading/session";
import type { EngDeal, EngOrder, EngPosition } from "../trading/types";
import { OrderRow, PositionRow } from "./rows";
import { ModifySheet, PartialCloseSheet } from "./sheets";

type Tab = "positions" | "orders" | "history";
type HistoryPage = { deals: EngDeal[]; total: number; totals?: { profit: number; swap: number; commission: number } };

export function PortfolioScreen() {
  const t = useT();
  const router = useRouter();
  const login = useActiveLogin();
  const viewer = useSession((s) => !!s.viewer);
  const accounts = useAccounts();
  const account = accounts.data?.accounts.find((a) => a.login === login);
  const currency = account?.currency ?? "USD";
  const positions = useTrade((s) => s.positions);
  const orders = useTrade((s) => s.orders);
  const status = useTrade((s) => s.status);
  const readOnly = useTrade((s) => s.readOnly) || viewer;
  const [tab, setTab] = React.useState<Tab>("positions");
  const [open, setOpen] = React.useState<number | null>(null);
  const partial = React.useRef<{ open: (p: EngPosition) => void }>(null);
  const modify = React.useRef<{ open: (x: { kind: "position"; p: EngPosition } | { kind: "order"; o: EngOrder }) => void }>(null);
  const bottom = useBottomInset();

  // history: first page cached per account; more pages on demand
  const histKey = login !== null ? `trade/history/${login}` : null;
  const history = useQuery<HistoryPage>(histKey, () => tradeApi<HistoryPage>(login!, "history?limit=50&page=1"), { staleMs: 60_000, enabled: tab === "history" && !viewer });
  const [more, setMore] = React.useState<EngDeal[]>([]);
  const [page, setPage] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  React.useEffect(() => {
    setMore([]);
    setPage(1);
  }, [login, history.updatedAt]);
  const deals = React.useMemo(() => [...(history.data?.deals ?? []), ...more].filter((d) => d.entry !== "in"), [history.data, more]);
  const loadMore = async () => {
    if (login === null || loadingMore) return;
    const total = history.data?.total ?? 0;
    if ((history.data?.deals.length ?? 0) + more.length >= total) return;
    setLoadingMore(true);
    const r = await tradeApi<HistoryPage>(login, `history?limit=50&page=${page + 1}`);
    setLoadingMore(false);
    if (r.ok) {
      setMore((m) => [...m, ...r.data.deals]);
      setPage((p) => p + 1);
    }
  };

  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = async () => {
    haptic.select();
    setRefreshing(true);
    await Promise.all([refreshState(), accounts.refresh(), tab === "history" ? history.refresh() : Promise.resolve()]);
    setRefreshing(false);
  };

  const toggle = React.useCallback((ticket: number) => setOpen((o) => (o === ticket ? null : ticket)), []);
  const onClose = React.useCallback((p: EngPosition) => void closePosition(p.ticket), []);
  const onPartial = React.useCallback((p: EngPosition) => partial.current?.open(p), []);
  const onModify = React.useCallback((p: EngPosition) => modify.current?.open({ kind: "position", p }), []);
  const onCancel = React.useCallback((o: EngOrder) => void cancelOrder(o.ticket), []);
  const onEdit = React.useCallback((o: EngOrder) => modify.current?.open({ kind: "order", o }), []);

  const noAccount = accounts.data && accounts.data.accounts.length === 0;

  const header = (
    <View>
      <ScreenHeader
        eyebrow={account ? accountLabel(t, account) : undefined}
        title={t("mobile.tab.portfolio")}
        right={
          <PressableScale onPress={() => router.push("/reports/statements")} haptics="select" style={{ height: 40, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <FileText size={16} color={colors.text2} />
            <Text variant="callout" weight="600">
              {t("mobilePortfolio.statements")}
            </Text>
          </PressableScale>
        }
      />
      {account ? <Summary currency={currency} fallback={account} /> : null}
      <View style={{ paddingHorizontal: GUTTER, gap: space[3], marginTop: space[4] }}>
        <RestrictionBanner kinds={["trading", "close_only"]} />
        {viewer ? <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobile.viewOnlyBody")} /> : null}
      </View>
      <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: GUTTER, marginTop: space[4], marginBottom: space[2] }} accessibilityRole="tablist">
        {(
          [
            ["positions", t("mobilePortfolio.tab.positions"), positions.length],
            ["orders", t("mobilePortfolio.tab.orders"), orders.length],
            ["history", t("mobilePortfolio.tab.history"), null],
          ] as const
        ).map(([k, label, n]) => (
          <PressableScale key={k} onPress={() => setTab(k)} haptics="select" accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, height: 40, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: tab === k ? colors.cream : colors.surface }}>
            <Text variant="callout" weight="700" color={tab === k ? colors.ink : colors.text2}>
              {label}
            </Text>
            {n ? (
              <Mono size={11} weight="bold" color={tab === k ? colors.ink2 : colors.text3}>
                {String(n)}
              </Mono>
            ) : null}
          </PressableScale>
        ))}
      </View>
      {tab === "history" && history.data?.totals ? (
        <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[2] }}>
          {t("mobilePortfolio.history.totals", { profit: fmtMoney(history.data.totals.profit, { signed: true }), swap: fmtMoney(history.data.totals.swap, { signed: true }), commission: fmtMoney(history.data.totals.commission, { signed: true }) })}
        </Text>
      ) : null}
    </View>
  );

  if (noAccount) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.tab.portfolio")} />
        <EmptyState illustration="emptyPosition" title={t("mobileTrade.state.noAccount.title")} body={t("mobileTrade.state.noAccount.body")} action={t("mobileTrade.state.noAccount.action")} onAction={() => router.push("/accounts/new")} />
      </Screen>
    );
  }

  // before the first snapshot of a (re)connecting stream there is nothing to show yet
  const loading = (status === "connecting" || status === "idle") && positions.length === 0 && orders.length === 0;
  const empty =
    tab === "positions" ? (
      <EmptyState illustration="emptyPosition" title={t("mobilePortfolio.empty.positions.title")} body={t("mobilePortfolio.empty.positions.body")} action={t("mobilePortfolio.empty.positions.action")} onAction={() => router.navigate("/trade")} size={200} />
    ) : tab === "orders" ? (
      <EmptyState title={t("mobilePortfolio.empty.orders.title")} body={t("mobilePortfolio.empty.orders.body")} />
    ) : history.loading ? (
      <SkeletonRows rows={6} />
    ) : (
      <EmptyState illustration="emptyHistory" title={t("mobilePortfolio.empty.history.title")} body={t("mobilePortfolio.empty.history.body")} size={220} />
    );

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />;

  return (
    <Screen scroll={false}>
      {tab === "positions" ? (
        <FlashList
          data={positions}
          keyExtractor={(p) => String(p.ticket)}
          renderItem={({ item }) => <PositionRow p={item} currency={currency} expanded={open === item.ticket} readOnly={readOnly} onToggle={toggle} onClose={onClose} onPartial={onPartial} onModify={onModify} />}
          ListHeaderComponent={header}
          ListEmptyComponent={loading ? <SkeletonRows rows={4} height={72} /> : empty}
          extraData={open}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : tab === "orders" ? (
        <FlashList
          data={orders}
          keyExtractor={(o) => String(o.ticket)}
          renderItem={({ item }) => <OrderRow o={item} expanded={open === item.ticket} readOnly={readOnly} onToggle={toggle} onCancel={onCancel} onEdit={onEdit} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          extraData={open}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlashList
          data={deals}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => <DealRow d={item} currency={currency} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      )}
      <PartialCloseSheet ref={partial} />
      <ModifySheet ref={modify} />
    </Screen>
  );
}

/** Balance / equity / margin / free margin / margin level, live from the engine's equity frames. */
function Summary({ currency, fallback }: { currency: string; fallback: { balance: number; equity: number; margin: number; freeMargin: number; marginLevel: number | null; profit: number; marginCallLevel?: number } }) {
  const t = useT();
  const live = useAccountLive();
  const a = live ?? fallback;
  const level = a.marginLevel;
  const call = fallback.marginCallLevel ?? 100;
  const floating = a.profit;
  const cells: [string, string, "primary" | "down" | "gold"][] = [
    [t("mobilePortfolio.sum.balance"), fmtMoney(a.balance, { currency }), "primary"],
    [t("mobilePortfolio.sum.margin"), fmtMoney(a.margin, { currency }), "primary"],
    [t("mobilePortfolio.sum.free"), fmtMoney(a.freeMargin, { currency }), a.freeMargin < 0 ? "down" : "primary"],
    [t("mobilePortfolio.sum.level"), level ? `${level.toFixed(0)}%` : "—", level && level <= call * 1.5 ? "gold" : "primary"],
  ];
  return (
    <View style={{ marginHorizontal: GUTTER, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text variant="label" tone="tertiary">
            {t("mobilePortfolio.sum.equity")}
          </Text>
          <Mono size={30} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
            {fmtMoney(a.equity, { currency })}
          </Mono>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("mobilePortfolio.sum.floating")}
          </Text>
          <Mono size={16} weight="bold" tone={floating > 0 ? "up" : floating < 0 ? "down" : "primary"}>
            {fmtMoney(floating, { signed: true, currency })}
          </Mono>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[3] }}>
        {cells.map(([k, v, tone], i) => (
          <View key={k} style={{ width: "50%", gap: 3, paddingStart: i % 2 ? space[4] : 0, borderStartWidth: i % 2 ? 1 : 0, borderStartColor: colors.line }}>
            <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 9.5 }}>
              {k}
            </Text>
            <Mono size={14} weight="medium" tone={tone} numberOfLines={1}>
              {v}
            </Mono>
          </View>
        ))}
      </View>
    </View>
  );
}

const DealRow = React.memo(function DealRow({ d, currency }: { d: EngDeal; currency: string }) {
  const t = useT();
  const digits = instrument(d.symbol).digits;
  const side = d.positionSide ?? (d.side === "buy" ? "sell" : "buy");
  const net = d.profit + (d.swap ?? 0) - Math.abs(d.commission ?? 0);
  return (
    <View style={{ minHeight: 64, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text weight="700">{d.symbol}</Text>
          <Text variant="caption" weight="700" tone="secondary">
            {`${t(side === "buy" ? "common.buy" : "common.sell").toUpperCase()} ${fmtLots(d.volume)}`}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${d.openPrice ? `${fmtPrice(d.openPrice, digits)} → ` : ""}${fmtPrice(d.price, digits)} · ${new Date(d.time).toLocaleString()}`}
        </Text>
      </View>
      <Mono size={15} weight="bold" tone={net > 0 ? "up" : net < 0 ? "down" : "primary"}>
        {fmtMoney(net, { signed: true, currency })}
      </Mono>
    </View>
  );
});

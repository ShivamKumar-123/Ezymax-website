// Portfolio: the active account's summary (balance, equity, margin, free margin, margin level; live), open
// positions (swipe to close, tap for details, partial close, SL / TP, Close By on hedging accounts), pending orders
// (edit / cancel) and the closed-trade history (tap for details and "Share P&L"). Statements and Analytics of the
// account open from the header. Data comes from the engine stream; history from the engine's history endpoint.
// A view-only login has no trading session: it reads the same account through the Client Area (refreshed every
// few seconds), without any action.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useIsFocused, useRouter } from "expo-router";
import { ChartColumn, FileText } from "lucide-react-native";
import { useT } from "@/i18n";
import { apiGet } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { kv } from "@/lib/kv";
import { useOnline } from "@/lib/net";
import { useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { useActiveLogin } from "@/session/activeAccount";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, EmptyState, IconButton, Mono, PressableScale, Screen, ScreenHeader, SkeletonRows, Text, toast, useBottomInset } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { isPeriod, PERIOD_PREF, prefetchAnalytics, prefetchStatements } from "../reports/api";
import { accountLabel } from "../trading/AccountSwitcher";
import { noTradingAccount, refreshAccounts, useAccountsSelect, useActiveAccountLabel } from "../trading/accounts";
import { cancelOrder, closePosition } from "../trading/actions";
import { refreshState, retryAccountStream, useAccountValue, useTrade } from "../trading/live";
import { tradeApi } from "../trading/session";
import type { EngAccount, EngDeal, EngOrder, EngPosition } from "../trading/types";
import { DealRow, OrderRow, PositionRow } from "./rows";
import { ShareSheet, type ShareSheetHandle } from "./share/ShareSheet";
import { CloseBySheet, ModifySheet, PartialCloseSheet } from "./sheets";

type Tab = "positions" | "orders" | "history";
type HistoryPage = { deals: EngDeal[]; total: number; totals?: { profit: number; swap: number; commission: number } };
type AccountView = { account: EngAccount; positions: EngPosition[]; orders: EngOrder[] };

const EMPTY_POS: EngPosition[] = [];
const EMPTY_ORD: EngOrder[] = [];
/** Press-in on the Statements button: the months of the account it opens on. */
const warmStatements = () => prefetchStatements();
/** Press-in on the Analytics button: the account's analytics for the period the screen will open on. */
const warmAnalytics = (login: number) => {
  const saved = kv.get(PERIOD_PREF);
  prefetchAnalytics(login, isPeriod(saved) ? saved : "90D");
};
const NO_TICKETS: ReadonlySet<number> = new Set();

export function PortfolioScreen() {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const login = useActiveLogin();
  const viewer = useSession((s) => !!s.viewer);
  // Statements and Analytics: every client; a view-only login when it was given the history section
  const reports = useSession((s) => !s.viewer || s.viewer.sections.includes("history"));
  // the account list is read through selectors: its equity figures refresh often and this screen shows the
  // stream's (or, for a view-only login, the Client Area's) live figures instead
  const account = useActiveAccountLabel();
  const noAccount = useAccountsSelect((list) => noTradingAccount(list, login));
  const currency = account?.currency ?? "USD";
  const [tab, setTab] = React.useState<Tab>("positions");
  const [open, setOpen] = React.useState<number | null>(null);
  const [openDeal, setOpenDeal] = React.useState<number | null>(null);
  const partial = React.useRef<{ open: (p: EngPosition) => void }>(null);
  const modify = React.useRef<{ open: (x: { kind: "position"; p: EngPosition } | { kind: "order"; o: EngOrder }) => void }>(null);
  const closeBySheet = React.useRef<{ open: (p: EngPosition) => void }>(null);
  const shareSheet = React.useRef<ShareSheetHandle>(null);
  const bottom = useBottomInset();

  // the engine stream (clients) or the Client Area's read-only view of the account (view-only logins)
  const streamPositions = useTrade((s) => s.positions);
  const streamOrders = useTrade((s) => s.orders);
  const status = useTrade((s) => s.status);
  const synced = useTrade((s) => s.account !== null);
  const streamError = useTrade((s) => s.error);
  const focused = useIsFocused();
  const view = useQuery<AccountView>(viewer && login !== null ? `trading/account/${login}` : null, () => apiGet<AccountView>(`trading/accounts/${login}`), { staleMs: 4000, intervalMs: focused ? 5000 : undefined });
  const positions = viewer ? (view.data?.positions ?? EMPTY_POS) : streamPositions;
  const orders = viewer ? (view.data?.orders ?? EMPTY_ORD) : streamOrders;
  const readOnly = useTrade((s) => s.readOnly) || viewer;
  // Close By: a hedging account's positions that have an opposite position on the same symbol
  const hedging = useTrade((s) => s.account?.mode === "hedging");
  const closable = React.useMemo(() => {
    if (!hedging || readOnly) return NO_TICKETS;
    const sides = new Map<string, number>();
    for (const p of positions) sides.set(p.symbol, (sides.get(p.symbol) ?? 0) | (p.side === "buy" ? 1 : 2));
    return new Set(positions.filter((p) => sides.get(p.symbol) === 3).map((p) => p.ticket));
  }, [positions, hedging, readOnly]);

  // history: first page cached per account; more pages on demand
  const histKey = login !== null ? `trade/history/${login}` : null;
  const history = useQuery<HistoryPage>(histKey, () => (viewer ? apiGet<HistoryPage>(`trading/accounts/${login}/history?limit=50&page=1`) : tradeApi<HistoryPage>(login!, "history?limit=50&page=1")), { staleMs: 60_000, enabled: tab === "history" });
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
    const q = `history?limit=50&page=${page + 1}`;
    const r = viewer ? await apiGet<HistoryPage>(`trading/accounts/${login}/${q}`) : await tradeApi<HistoryPage>(login, q);
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
    await Promise.all([viewer ? view.refresh() : refreshState(), refreshAccounts(), tab === "history" ? history.refresh() : Promise.resolve()]);
    setRefreshing(false);
  };

  // a close / cancel in flight: its row shows "closing" and a second tap does nothing; a refusal is said in words
  const [busy, setBusy] = React.useState<ReadonlySet<number>>(() => new Set());
  const mark = React.useCallback((ticket: number, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(ticket);
      else next.delete(ticket);
      return next;
    });
  }, []);
  const inflight = React.useRef(new Set<number>());
  const runOnce = React.useCallback(
    (ticket: number, action: () => ReturnType<typeof closePosition>) => {
      if (inflight.current.has(ticket)) return;
      inflight.current.add(ticket);
      mark(ticket, true);
      void action().then((r) => {
        inflight.current.delete(ticket);
        mark(ticket, false);
        if (!r.ok) toast.show({ title: r.title, body: r.body || undefined, tone: "error" }, 5000);
      });
    },
    [mark],
  );

  const toggle = React.useCallback((ticket: number) => setOpen((o) => (o === ticket ? null : ticket)), []);
  const onClose = React.useCallback((p: EngPosition) => runOnce(p.ticket, () => closePosition(p.ticket)), [runOnce]);
  const onPartial = React.useCallback((p: EngPosition) => partial.current?.open(p), []);
  const onModify = React.useCallback((p: EngPosition) => modify.current?.open({ kind: "position", p }), []);
  const onCloseBy = React.useCallback((p: EngPosition) => closeBySheet.current?.open(p), []);
  const onCancel = React.useCallback((o: EngOrder) => runOnce(o.ticket, () => cancelOrder(o.ticket)), [runOnce]);
  const onEdit = React.useCallback((o: EngOrder) => modify.current?.open({ kind: "order", o }), []);
  const toggleDeal = React.useCallback((id: number) => setOpenDeal((o) => (o === id ? null : id)), []);
  const onShare = React.useCallback((d: EngDeal) => shareSheet.current?.open(d, currency), [currency]);

  const extra = React.useMemo(() => ({ open, busy, closable }), [open, busy, closable]);
  // the summary's numbers until live ones arrive: the stream's snapshot (it changes on balance events only), else the
  // account list's figures, read only while there is no snapshot (they refresh often; the live leaves take over)
  const streamAccount = useTrade((s) => s.account);
  const listFigures = useAccountsSelect((list) => {
    if (streamAccount && !viewer) return null;
    const a = list?.find((x) => x.login === login);
    return a ? { balance: a.balance, equity: a.equity, margin: a.margin, freeMargin: a.freeMargin, marginLevel: a.marginLevel, profit: a.profit, marginCallLevel: a.marginCallLevel } : null;
  });
  const summaryFallback = viewer ? (view.data?.account ?? listFigures) : (streamAccount ?? listFigures);

  const header = (
    <View>
      <ScreenHeader
        eyebrow={account ? accountLabel(t, account) : undefined}
        title={t("mobile.tab.portfolio")}
        right={
          reports ? (
            <>
              {login !== null ? <IconButton accessibilityLabel={t("mobilePortfolio.analytics")} icon={<ChartColumn size={19} color={colors.text} />} onPress={() => router.push({ pathname: "/reports/analytics", params: { login: String(login) } })} onPressIn={() => warmAnalytics(login)} /> : null}
              <IconButton accessibilityLabel={t("mobilePortfolio.statements")} icon={<FileText size={19} color={colors.text} />} onPress={() => router.push("/reports/statements")} onPressIn={warmStatements} />
            </>
          ) : undefined
        }
      />
      {summaryFallback ? <Summary currency={currency} fallback={summaryFallback} live={!viewer} /> : null}
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
            <Text variant="callout" weight="700" color={tab === k ? colors.ink : colors.text2} numberOfLines={1}>
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
          {t("mobilePortfolio.history.totals", { profit: fmtMoney(history.data.totals.profit, { signed: true, currency }), swap: fmtMoney(history.data.totals.swap, { signed: true, currency }), commission: fmtMoney(history.data.totals.commission, { signed: true, currency }) })}
        </Text>
      ) : null}
    </View>
  );

  if (noAccount) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.tab.portfolio")} />
        <EmptyState illustration="emptyPosition" title={t("mobileTrade.state.noAccount.title")} body={t("mobileTrade.state.noAccount.body")} action={viewer ? undefined : t("mobileTrade.state.noAccount.action")} onAction={() => router.push("/accounts/new")} />
      </Screen>
    );
  }

  // nothing from the account yet: skeleton while it connects; offline or a failing connection says so (with retry)
  const failing = viewer ? !!view.error && !view.data : !synced && (status === "reconnecting" || status === "error") && !!streamError;
  const waiting = viewer ? view.loading : !synced;
  const retry = () => (viewer ? void view.refresh() : retryAccountStream());
  const notLoaded = !online && waiting ? (
    <EmptyState illustration="connectionLost" size={200} title={t("mobile.state.offline.title")} body={t("mobile.state.offline.body")} />
  ) : failing ? (
    <EmptyState illustration="connectionLost" size={200} title={t("mobileTrade.state.streamError")} body={t("mobileTrade.state.streamErrorBody")} action={t("mobile.action.retry")} onAction={retry} />
  ) : waiting ? (
    <SkeletonRows rows={4} height={72} />
  ) : null;

  const empty =
    tab === "positions" ? (
      (notLoaded ?? <EmptyState illustration="emptyPosition" title={t("mobilePortfolio.empty.positions.title")} body={t("mobilePortfolio.empty.positions.body")} action={readOnly ? undefined : t("mobilePortfolio.empty.positions.action")} onAction={() => router.navigate("/trade")} size={200} />)
    ) : tab === "orders" ? (
      (notLoaded ?? <EmptyState illustration="market" size={170} title={t("mobilePortfolio.empty.orders.title")} body={t("mobilePortfolio.empty.orders.body")} />)
    ) : history.loading ? (
      <SkeletonRows rows={6} />
    ) : history.error && !history.data ? (
      <EmptyState illustration="connectionLost" size={200} title={online ? t("mobile.state.error.title") : t("mobile.state.offline.title")} body={online ? t("mobile.state.error.body") : t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void history.refresh()} />
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
          renderItem={({ item }) => <PositionRow p={item} currency={currency} expanded={open === item.ticket} readOnly={readOnly} busy={busy.has(item.ticket)} canCloseBy={closable.has(item.ticket)} onToggle={toggle} onClose={onClose} onPartial={onPartial} onModify={onModify} onCloseBy={onCloseBy} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          extraData={extra}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : tab === "orders" ? (
        <FlashList
          data={orders}
          keyExtractor={(o) => String(o.ticket)}
          renderItem={({ item }) => <OrderRow o={item} expanded={open === item.ticket} readOnly={readOnly} busy={busy.has(item.ticket)} onToggle={toggle} onCancel={onCancel} onEdit={onEdit} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          extraData={extra}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlashList
          data={deals}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => <DealRow d={item} currency={currency} expanded={openDeal === item.id} onToggle={toggleDeal} onShare={viewer ? undefined : onShare} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          extraData={openDeal}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          contentContainerStyle={{ paddingBottom: bottom }}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      )}
      <PartialCloseSheet ref={partial} />
      <ModifySheet ref={modify} />
      <CloseBySheet ref={closeBySheet} currency={currency} />
      <ShareSheet ref={shareSheet} />
    </Screen>
  );
}

type SummaryData = { balance: number; equity: number; margin: number; freeMargin: number; marginLevel: number | null; profit: number; marginCallLevel?: number };
type Field = "balance" | "equity" | "margin" | "freeMargin" | "marginLevel" | "profit";

/** A number of the summary, live from the engine's equity frames (or the Client Area's figure for a viewer). Each
 *  number is its own leaf: an equity frame re-renders only the numbers that changed, never the card. */
function useNumber(field: Field, fallback: SummaryData, live: boolean): number | null {
  const v = useAccountValue((a) => (live && a ? a[field] : undefined));
  return v === undefined ? fallback[field] : v;
}

function Equity({ currency, fallback, live }: { currency: string; fallback: SummaryData; live: boolean }) {
  const v = useNumber("equity", fallback, live);
  return (
    <Mono size={30} weight="bold" numberOfLines={1} adjustsFontSizeToFit>
      {fmtMoney(v, { currency })}
    </Mono>
  );
}

function Floating({ currency, fallback, live }: { currency: string; fallback: SummaryData; live: boolean }) {
  const v = useNumber("profit", fallback, live) ?? 0;
  return (
    <Mono size={16} weight="bold" tone={v > 0 ? "up" : v < 0 ? "down" : "primary"}>
      {fmtMoney(v, { signed: true, currency })}
    </Mono>
  );
}

function Cell({ field, currency, fallback, live }: { field: Exclude<Field, "equity" | "profit">; currency: string; fallback: SummaryData; live: boolean }) {
  const v = useNumber(field, fallback, live);
  if (field === "marginLevel") {
    const call = fallback.marginCallLevel ?? 100;
    return (
      <Mono size={14} weight="medium" tone={v && v <= call * 1.5 ? "gold" : "primary"} numberOfLines={1}>
        {v ? `${v.toFixed(0)}%` : "—"}
      </Mono>
    );
  }
  return (
    <Mono size={14} weight="medium" tone={field === "freeMargin" && v !== null && v < 0 ? "down" : "primary"} numberOfLines={1}>
      {fmtMoney(v, { currency })}
    </Mono>
  );
}

/** Balance / equity / margin / free margin / margin level, live from the engine's equity frames. */
function Summary({ currency, fallback, live }: { currency: string; fallback: SummaryData; live: boolean }) {
  const t = useT();
  const cells: [string, Exclude<Field, "equity" | "profit">][] = [
    [t("mobilePortfolio.sum.balance"), "balance"],
    [t("mobilePortfolio.sum.margin"), "margin"],
    [t("mobilePortfolio.sum.free"), "freeMargin"],
    [t("mobilePortfolio.sum.level"), "marginLevel"],
  ];
  return (
    <View style={{ marginHorizontal: GUTTER, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: space[5], gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text variant="label" tone="tertiary">
            {t("mobilePortfolio.sum.equity")}
          </Text>
          <Equity currency={currency} fallback={fallback} live={live} />
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text variant="label" tone="tertiary">
            {t("mobilePortfolio.sum.floating")}
          </Text>
          <Floating currency={currency} fallback={fallback} live={live} />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space[3] }}>
        {cells.map(([k, field], i) => (
          <View key={field} style={{ width: "50%", gap: 3, paddingStart: i % 2 ? space[4] : 0, borderStartWidth: i % 2 ? 1 : 0, borderStartColor: colors.line }}>
            <Text variant="label" tone="tertiary" numberOfLines={1} style={{ fontSize: 9.5 }}>
              {k}
            </Text>
            <Cell field={field} currency={currency} fallback={fallback} live={live} />
          </View>
        ))}
      </View>
    </View>
  );
}

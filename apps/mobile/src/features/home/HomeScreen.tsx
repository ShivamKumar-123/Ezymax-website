// Home (bold editorial): the active account's equity as a big colour block with today's closed P&L and the open
// P&L, the account switcher, quick actions, top movers, headlines and the notifications bell.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, CandlestickChart, ChevronRight, TrendingDown, TrendingUp } from "lucide-react-native";
import { useT } from "@/i18n";
import { apiGet } from "@/lib/api";
import { fmtMoney, fmtPct, fmtPrice } from "@/lib/format";
import { useOnline } from "@/lib/net";
import { useQuery } from "@/lib/query";
import { feed } from "@/market/feed";
import { instrument, instruments } from "@/market/instruments";
import { useMe, useSession } from "@/session";
import { useActiveLogin } from "@/session/activeAccount";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Button, Card, ColorBlock, Display, EmptyState, IconButton, Illustration, Mono, PressableScale, Screen, Skeleton, Text, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";
import { serverOffset } from "../chart/data";
import { setTradeSymbol } from "../trade/symbol";
import { prefetchWallet } from "../wallet/api";
import { AccountChip, AccountSheet } from "../trading/AccountSwitcher";
import { useAccounts } from "../trading/accounts";
import { useAccountLive } from "../trading/live";
import { tradeApi } from "../trading/session";

type NewsItem = { id: string | number; title: string; publishedAt: string; source?: { name?: string }; symbols?: string[] };

/** Start of the broker's trading day (New York close) as an ISO time, for "closed today". */
function serverDayStart(): string {
  const now = Math.floor(Date.now() / 1000);
  const off = serverOffset(now);
  const start = Math.floor((now + off) / 86400) * 86400 - off;
  return new Date(start * 1000).toISOString().slice(0, 19) + "Z";
}

export function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const me = useMe();
  const online = useOnline();
  const viewer = useSession((s) => !!s.viewer);
  const login = useActiveLogin();
  const accounts = useAccounts();
  const account = accounts.data?.accounts.find((a) => a.login === login);
  const accSheet = React.useRef<SheetRef>(null);

  const news = useQuery("home/news", () => apiGet<{ items: NewsItem[] }>("news/feed?limit=5"), { persist: true, staleMs: 120_000 });
  const bell = useQuery("home/bell", () => apiGet<{ unread: number }>("notifications?limit=1"), { staleMs: 30_000, intervalMs: 60_000, enabled: !viewer });
  // closed today: the engine's history since the broker's day start (a view-only login reads it through the Client Area)
  type Totals = { totals?: { profit: number; swap: number; commission: number } };
  const today = useQuery(login !== null ? `trade/today/${login}` : null, () => (viewer ? apiGet<Totals>(`trading/accounts/${login}/history?limit=1&from=${serverDayStart()}`) : tradeApi<Totals>(login!, `history?limit=1&from=${serverDayStart()}`)), { staleMs: 30_000 });
  // a view-only login has no engine stream: its account figures refresh every few seconds while Home is on screen
  const focused = useIsFocused();
  const view = useQuery<{ account: { equity: number; profit: number } }>(viewer && login !== null ? `trading/account/${login}` : null, () => apiGet(`trading/accounts/${login}`), { staleMs: 4000, intervalMs: focused ? 5000 : undefined });
  const heroAccount = (viewer ? view.data?.account : undefined) ?? account;

  const liveTotal = React.useMemo(() => (accounts.data?.accounts ?? []).filter((a) => a.type === "live").reduce((s, a) => s + (a.cent ? a.equity / 100 : a.equity), 0), [accounts.data]);
  const hasLive = (accounts.data?.accounts ?? []).some((a) => a.type === "live");
  const closedToday = today.data?.totals ? today.data.totals.profit + today.data.totals.swap - Math.abs(today.data.totals.commission) : undefined;

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "mobileHome.greet.morning" : hour < 18 ? "mobileHome.greet.afternoon" : "mobileHome.greet.evening";

  const refresh = async () => {
    await Promise.all([accounts.refresh(), news.refresh(), bell.refresh(), today.refresh()]);
  };

  const noAccount = accounts.data && accounts.data.accounts.length === 0;
  const kyc = me?.kyc_status;

  return (
    <Screen onRefresh={refresh}>
      {/* greeting + bell */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space[2], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="tertiary" numberOfLines={1}>
            {t(greetKey, { name: me?.first_name ?? "" })}
          </Text>
          <Display size="xl" accessibilityRole="header">
            {t("mobile.tab.home")}
          </Display>
        </View>
        {!viewer ? <IconButton accessibilityLabel={t("mobileHome.a11y.bell", { count: bell.data?.unread ?? 0 })} icon={<Bell size={20} color={colors.text} />} badge={bell.data?.unread} onPress={() => router.push("/notifications")} /> : null}
      </View>

      <View style={{ paddingHorizontal: GUTTER, gap: space[4], marginTop: space[4] }}>
        <RestrictionBanner onContact={() => router.push("/support")} />

        {/* hero: equity (a flat ember block; the globe peeks in from the corner, below every number) */}
        {noAccount ? (
          <ColorBlock color="periwinkle" style={{ gap: space[3], paddingBottom: 0 }}>
            <Display size="lg" color={colors.ink}>
              {t("mobileHome.noAccount.title")}
            </Display>
            <Text color={colors.ink}>{t("mobileHome.noAccount.body")}</Text>
            <View style={{ minHeight: 120, justifyContent: "flex-end", paddingBottom: space[6], paddingEnd: 96 }}>
              <Illustration name="mascot" width={92} height={140} style={{ position: "absolute", bottom: -26, end: -4 }} />
              <Button label={t("mobileHome.noAccount.action")} variant="primary" full={false} onPress={() => router.push("/accounts/new")} />
            </View>
          </ColorBlock>
        ) : !account ? (
          accounts.error && !accounts.data ? (
            <Card style={{ paddingVertical: space[2] }}>
              <EmptyState illustration="connectionLost" size={170} title={online ? t("mobile.state.error.title") : t("mobile.state.offline.title")} body={online ? t("mobile.state.error.body") : t("mobile.state.offline.body")} action={t("mobile.action.retry")} onAction={() => void accounts.refresh()} style={{ paddingVertical: space[4], paddingHorizontal: space[2] }} />
            </Card>
          ) : (
            <Skeleton h={286} r={radius.block} />
          )
        ) : (
          <ColorBlock color="ember" style={{ gap: space[5], paddingBottom: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text variant="label" color={colors.ink}>
                {t("mobileHome.equity")}
              </Text>
              {!viewer ? <AccountChip tone="ink" onPress={() => accSheet.current?.present()} /> : null}
            </View>
            <HeroEquity currency={account.currency} fallback={heroAccount?.equity ?? account.equity} />
            <View style={{ flexDirection: "row", gap: space[4] }}>
              <Stat label={t("mobileHome.closedToday")} value={closedToday} currency={account.currency} />
              <OpenPnl currency={account.currency} fallback={heroAccount?.profit ?? account.profit} />
            </View>
            {/* the caption keeps clear of the globe in the end corner (either direction) */}
            <View style={{ minHeight: 84, justifyContent: "flex-end", paddingEnd: 104, paddingBottom: space[6] }}>
              <Illustration name="market" width={112} height={112} style={{ position: "absolute", bottom: -22, end: -18 }} />
              <Text variant="caption" weight="600" color={colors.ink} numberOfLines={2}>
                {hasLive ? t("mobileHome.allLive", { amount: fmtMoney(liveTotal, { currency: "USD" }) }) : ""}
              </Text>
            </View>
          </ColorBlock>
        )}

        {/* quick actions */}
        {!viewer ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[3] }}>
            <Quick color="mint" icon={<ArrowDownLeft size={20} color={colors.ink} strokeWidth={2.2} />} label={t("mobileHome.quick.deposit")} onPress={() => router.push("/wallet/deposit")} onPressIn={prefetchWallet.deposit} />
            <Quick color="periwinkle" icon={<ArrowUpRight size={20} color={colors.ink} strokeWidth={2.2} />} label={t("mobileHome.quick.withdraw")} onPress={() => router.push("/wallet/withdraw")} onPressIn={prefetchWallet.withdraw} />
            <Quick color="gold" icon={<ArrowLeftRight size={20} color={colors.ink} strokeWidth={2.2} />} label={t("mobileHome.quick.transfer")} onPress={() => router.push("/wallet/transfer")} onPressIn={prefetchWallet.transfer} />
            <Quick color="cream" icon={<CandlestickChart size={20} color={colors.ink} strokeWidth={2.2} />} label={t("mobileHome.quick.trade")} onPress={() => router.navigate("/trade")} />
          </View>
        ) : null}

        {/* verification nudge */}
        {!viewer && (kyc === "unverified" || kyc === "rejected" || kyc === "pending") ? (
          <Card onPress={() => router.push("/profile/verification")} style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
            <Illustration name={kyc === "pending" ? "kycPending" : "security"} width={88} height={72} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline" weight="700">
                {t(kyc === "pending" ? "mobileHome.kyc.pending" : "mobileHome.kyc.title")}
              </Text>
              <Text variant="caption" tone="secondary">
                {t(kyc === "pending" ? "mobileHome.kyc.pendingBody" : "mobileHome.kyc.body")}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.text3} />
          </Card>
        ) : null}
      </View>

      {/* top movers */}
      <SectionTitle title={t("mobileHome.movers")} />
      <Movers />

      {/* headlines */}
      <SectionTitle title={t("mobileHome.news")} action={t("mobileHome.allNews")} onAction={() => router.push("/news")} />
      <View style={{ paddingHorizontal: GUTTER }}>
        <Card padded={false}>
          {news.error && !news.data ? (
            <View style={{ padding: space[5], gap: space[3], alignItems: "flex-start" }}>
              <Text tone="tertiary">{online ? t("mobile.state.error.body") : t("mobile.state.offline.body")}</Text>
              <Button label={t("mobile.action.retry")} variant="secondary" size="sm" full={false} onPress={() => void news.refresh()} />
            </View>
          ) : news.loading ? (
            <View style={{ padding: space[5], gap: space[4] }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ gap: 6 }}>
                  <Skeleton w="90%" h={14} />
                  <Skeleton w="40%" h={10} />
                </View>
              ))}
            </View>
          ) : (news.data?.items ?? []).length === 0 ? (
            <Text tone="tertiary" style={{ padding: space[5] }}>
              {t("mobileHome.news.empty")}
            </Text>
          ) : (
            (news.data?.items ?? []).slice(0, 5).map((n, i) => (
              <PressableScale key={String(n.id)} onPress={() => router.push(`/news/${n.id}`)} scaleTo={0.985} style={{ paddingHorizontal: space[5], paddingVertical: space[4], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, gap: 6 }}>
                <Text variant="headline" weight="600" numberOfLines={2}>
                  {n.title}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {[n.source?.name, relTime(n.publishedAt), (n.symbols ?? []).slice(0, 3).join(" · ")].filter(Boolean).join("  ·  ")}
                </Text>
              </PressableScale>
            ))
          )}
        </Card>
      </View>

      <AccountSheet ref={accSheet} />
    </Screen>
  );
}

function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: space[8], marginBottom: space[3], flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      <Display size="md" accessibilityRole="header">
        {title}
      </Display>
      {action && onAction ? (
        <PressableScale onPress={onAction} scaleTo={1} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text variant="callout" tone="ember" weight="700">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** The big equity number, live from the engine (leaf subscriber). */
function HeroEquity({ currency, fallback }: { currency: string; fallback: number }) {
  const live = useAccountLive();
  return (
    <Mono size={44} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 52, letterSpacing: -1 }}>
      {fmtMoney(live?.equity ?? fallback, { currency })}
    </Mono>
  );
}

function OpenPnl({ currency, fallback }: { currency: string; fallback: number }) {
  const t = useT();
  const live = useAccountLive();
  return <Stat label={t("mobileHome.openPnl")} value={live?.profit ?? fallback} currency={currency} />;
}

/** A small stat on the ember block: ink text with a direction glyph (the block isn't a money colour). */
function Stat({ label, value, currency }: { label: string; value: number | undefined; currency: string }) {
  const Icon = value !== undefined && value < 0 ? TrendingDown : TrendingUp;
  return (
    <View style={{ flex: 1, gap: 4 }}>
      {/* full ink on ember: the 66% ink is under 4.5:1 at label size */}
      <Text variant="label" color={colors.ink}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {value ? <Icon size={16} color={colors.ink} strokeWidth={2.4} /> : null}
        <Mono size={18} weight="bold" color={colors.ink}>
          {value === undefined ? "—" : fmtMoney(value, { signed: true, currency })}
        </Mono>
      </View>
    </View>
  );
}

const QUICK_ICON_BG = alpha(colors.ink, 0.1);

function Quick({ color, icon, label, onPress, onPressIn }: { color: BlockColor; icon: React.ReactNode; label: string; onPress: () => void; onPressIn?: () => void }) {
  return (
    <ColorBlock color={color} padded={false} onPress={onPress} onPressIn={onPressIn} style={{ flexBasis: "47%", flexGrow: 1, height: 68, borderRadius: radius.lg, paddingHorizontal: space[3], flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: QUICK_ICON_BG, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      {/* fits "Withdraw" on a 360 pt phone; longer words in other languages shrink a little instead of cutting */}
      <Text variant="headline" weight="700" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </ColorBlock>
  );
}

/** Biggest daily moves among the symbols with prices (re-sorted on each snapshot, prices live). */
function Movers() {
  const router = useRouter();
  const t = useT();
  const online = useOnline();
  const [list, setList] = React.useState<string[]>([]);
  React.useEffect(() => {
    const pick = () => {
      const rows = instruments()
        .map((i) => ({ s: i.symbol, q: feed.quote(i.symbol) }))
        .filter((x): x is { s: string; q: NonNullable<typeof x.q> } => !!x.q && x.q.open > 0)
        .map((x) => ({ s: x.s, c: Math.abs((x.q.last - x.q.open) / x.q.open) }))
        .sort((a, b) => b.c - a.c)
        .slice(0, 6)
        .map((x) => x.s);
      setList((prev) => (prev.join() === rows.join() ? prev : rows));
    };
    pick();
    const off = feed.onSnapshot(pick);
    const timer = setInterval(pick, 30_000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, []);
  if (!list.length && !online)
    return (
      <Text tone="tertiary" style={{ paddingHorizontal: GUTTER }}>
        {t("mobileMarkets.status.offline")}
      </Text>
    );
  if (!list.length)
    return (
      <View style={{ flexDirection: "row", gap: space[3], paddingHorizontal: GUTTER }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} w={148} h={120} r={radius.card} />
        ))}
      </View>
    );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space[3] }}>
      {list.map((s) => (
        <MoverCard
          key={s}
          symbol={s}
          onPress={() => {
            setTradeSymbol(s);
            router.navigate("/trade");
          }}
        />
      ))}
    </ScrollView>
  );
}

const MoverCard = React.memo(function MoverCard({ symbol, onPress }: { symbol: string; onPress: () => void }) {
  const inst = instrument(symbol);
  const [q, setQ] = React.useState(() => feed.quote(symbol));
  React.useEffect(() => {
    let raf = 0;
    return feed.on(symbol, () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setQ(feed.quote(symbol));
        });
    });
  }, [symbol]);
  const ch = q && q.open > 0 ? ((q.last - q.open) / q.open) * 100 : 0;
  const up = ch >= 0;
  return (
    <Card onPress={onPress} style={{ width: 148, height: 120, justifyContent: "space-between", padding: space[4] }}>
      <View>
        <Text weight="700">{symbol}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {inst.name}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Mono size={20} weight="bold" tone={Math.abs(ch) < 0.005 ? "primary" : up ? "up" : "down"}>
          {fmtPct(ch)}
        </Mono>
        <Mono size={12} tone="secondary">
          {q ? fmtPrice(q.bid, inst.digits) : "—"}
        </Mono>
      </View>
    </Card>
  );
});

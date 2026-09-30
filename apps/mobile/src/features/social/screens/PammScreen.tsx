// /social/pamm — PAMM: the funds (NAV, returns, rollover, lock-in, freeze) and "My investments" (holdings with
// pending requests, stop-loss, redeem / add, and the request history). ?tab=mine opens on my investments.
import * as React from "react";
import { RefreshControl, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { CalendarClock, Coins, ShieldAlert, Snowflake, TrendingUp } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { prefetch, useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Card, ColorBlock, Display, EmptyState, Illustration, Mono, Pill, Screen, Skeleton, Text, useBottomInset, type SheetRef } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fetchers, keys, type FeePeriod, type FundView, type InvestmentView, type RequestView } from "../api";
import { compactUsd, pct, shownTone, usd } from "../format";
import { alpha } from "../tint";
import { TopBar, useBack } from "../components/chrome";
import { FundCard, HoldingCard } from "../components/FundCard";
import { Note, StatGrid } from "../components/primitives";
import { RequestRow } from "../components/rows";
import { LoadError } from "../components/states";
import { CancelRequestSheet, StopLossSheet } from "../sheets/PammSheets";

type Tab = "funds" | "mine";
type Item = { k: "fund"; f: FundView } | { k: "holding"; inv: InvestmentView } | { k: "reqHead" } | { k: "req"; r: RequestView } | { k: "noUnits" };
const ROLL: ("all" | FeePeriod)[] = ["all", "daily", "weekly", "monthly"];

export function PammScreen() {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const back = useBack();
  const bottom = useBottomInset(false);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = React.useState<Tab>(params.tab === "mine" ? "mine" : "funds");
  const [roll, setRoll] = React.useState<"all" | FeePeriod>("all");
  const funds = useQuery(keys.funds, fetchers.funds, { persist: true, intervalMs: 60_000 });
  const inv = useQuery(keys.investments, fetchers.investments, { persist: true, intervalMs: tab === "mine" ? 15_000 : undefined });
  const [refreshing, setRefreshing] = React.useState(false);
  const [slInv, setSlInv] = React.useState<InvestmentView | null>(null);
  const [cancelReq, setCancelReq] = React.useState<RequestView | null>(null);
  const slSheet = React.useRef<SheetRef>(null);
  const cancelSheet = React.useRef<SheetRef>(null);

  const all = funds.data?.items ?? [];
  const holdings = inv.data?.items ?? [];
  const requests = inv.data?.requests ?? [];
  const names = React.useMemo(() => {
    const m: Record<number, string> = {};
    for (const f of all) m[f.id] = f.name;
    for (const i of holdings) m[i.fundId] = i.fund.name;
    return m;
  }, [all, holdings]);

  const items = React.useMemo<Item[]>(() => {
    if (tab === "funds")
      return all
        .filter((f) => roll === "all" || f.period === roll)
        .sort((a, b) => b.aum - a.aum)
        .map((f) => ({ k: "fund", f }));
    if (!inv.data || (!holdings.length && !requests.length)) return [];
    const out: Item[] = holdings.length ? holdings.map((i) => ({ k: "holding", inv: i })) : [{ k: "noUnits" }];
    if (requests.length) {
      out.push({ k: "reqHead" });
      for (const r of [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) out.push({ k: "req", r });
    }
    return out;
  }, [tab, all, roll, inv.data, holdings, requests]);

  const openFund = React.useCallback((id: number) => router.push(`/social/pamm/${id}`), [router]);
  const warmFund = React.useCallback((id: number) => prefetch(keys.fund(id), fetchers.fund(id), { persist: true }), []);
  const invest = React.useCallback((id: number) => router.push(`/social/pamm/${id}/invest`), [router]);
  const redeem = React.useCallback((id: number) => router.push(`/social/pamm/${id}/redeem`), [router]);
  const stopLoss = React.useCallback((i: InvestmentView) => {
    setSlInv(i);
    requestAnimationFrame(() => slSheet.current?.present());
  }, []);
  const cancel = React.useCallback((r: RequestView) => {
    setCancelReq(r);
    requestAnimationFrame(() => cancelSheet.current?.present());
  }, []);

  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await Promise.all([funds.refresh(), inv.refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [funds, inv]);

  const q = tab === "funds" ? funds : inv;
  if (!q.data && q.error && tab === "funds") {
    return (
      <Screen scroll={false} tabBar={false}>
        <TopBar onBack={back} />
        <LoadError error={q.error} onRetry={() => void q.refresh()} onBack={back} />
      </Screen>
    );
  }

  const aum = all.reduce((s, f) => s + f.aum, 0);
  const investors = all.reduce((s, f) => s + f.investors, 0);
  const next = all
    .filter((f) => f.status === "active" && f.nextRolloverAt)
    .map((f) => f.nextRolloverAt!)
    .sort()[0];

  const header = (
    <View style={{ paddingBottom: space[4] }}>
      <TopBar onBack={back} />
      <View style={{ paddingHorizontal: GUTTER, gap: space[1], marginBottom: space[5] }}>
        <Text variant="label" tone="gold">
          {t("mobileSocial.pamm.eyebrow")}
        </Text>
        <Display size="hero" accessibilityRole="header">
          {t("mobileSocial.pamm.title")}
        </Display>
      </View>
      <View style={{ paddingHorizontal: GUTTER, gap: space[4] }}>
        <RestrictionBanner kinds={["social"]} />
        <ColorBlock color="gold">
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <View style={{ flex: 1, gap: space[1] }}>
              <Text variant="label" color={colors.ink2}>
                {t("mobileSocial.pamm.hero.aum")}
              </Text>
              <Display size="hero" color={colors.ink} style={{ fontSize: 56, lineHeight: 60 }} numberOfLines={1} adjustsFontSizeToFit>
                {funds.data ? compactUsd(aum) : "—"}
              </Display>
              <Text variant="callout" weight="700" color={colors.ink}>
                {`${t("mobileSocial.pamm.hero.funds", { count: all.length })} · ${t("mobileSocial.pamm.hero.investors", { count: investors })}`}
              </Text>
            </View>
            <Illustration name="pammFunds" width={112} height={100} style={{ marginEnd: -space[2], marginTop: -space[1] }} />
          </View>
          {next ? (
            <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", marginTop: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: alpha(colors.ink, 0.14) }}>
              <CalendarClock size={15} color={colors.ink} />
              <Text variant="caption" color={colors.ink2}>
                {`${t("mobileSocial.pamm.hero.next", { time: fmt.dateTime(next) })} · ${t("mobileSocial.serverTime")}`}
              </Text>
            </View>
          ) : null}
        </ColorBlock>
        <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="tablist">
          <Pill label={t("mobileSocial.pamm.tab.funds")} selected={tab === "funds"} onPress={() => setTab("funds")} />
          <Pill label={t("mobileSocial.pamm.tab.mine")} selected={tab === "mine"} onPress={() => setTab("mine")} />
        </View>
        {tab === "funds" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {ROLL.map((r) => (
              <Pill key={r} compact label={r === "all" ? t("mobileSocial.pamm.anyRollover") : t(`mobileSocial.period.${r}`)} selected={roll === r} onPress={() => setRoll(r)} />
            ))}
          </View>
        ) : inv.data && holdings.length ? (
          <MineSummary holdings={holdings} pending={requests.filter((r) => r.status === "pending").length} />
        ) : null}
      </View>
    </View>
  );

  const empty =
    tab === "funds" ? (
      !funds.data ? (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
          <Skeleton h={330} r={28} />
          <Skeleton h={330} r={28} />
        </View>
      ) : all.length ? (
        <EmptyState
          illustration="pammFunds"
          title={t("mobileSocial.pamm.empty.filteredTitle")}
          body={t("mobileSocial.pamm.empty.filteredText")}
          action={t("mobileSocial.pamm.anyRollover")}
          onAction={() => setRoll("all")}
        />
      ) : (
        <EmptyState illustration="pammFunds" title={t("mobileSocial.pamm.empty.title")} body={t("mobileSocial.pamm.empty.text")} />
      )
    ) : !inv.data ? (
      inv.error ? (
        <LoadError error={inv.error} onRetry={() => void inv.refresh()} />
      ) : (
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] }}>
          <Skeleton h={320} r={28} />
        </View>
      )
    ) : (
      <EmptyState illustration="pammFunds" title={t("mobileSocial.inv.empty.title")} body={t("mobileSocial.inv.empty.text")} action={t("mobileSocial.inv.browse")} onAction={() => setTab("funds")} />
    );

  return (
    <Screen scroll={false} tabBar={false}>
      <FlashList
        data={items}
        keyExtractor={itemKey}
        getItemType={(i) => i.k}
        renderItem={({ item }) => {
          switch (item.k) {
            case "fund":
              return <FundCard f={item.f} onOpen={openFund} onPressIn={warmFund} onInvest={invest} />;
            case "holding":
              return <HoldingCard inv={item.inv} onOpen={openFund} onAdd={invest} onRedeem={redeem} onStopLoss={stopLoss} onCancel={cancel} />;
            case "noUnits":
              return (
                <Text tone="tertiary" style={{ paddingHorizontal: GUTTER, paddingVertical: space[4] }}>
                  {t("mobileSocial.inv.noUnits")}
                </Text>
              );
            case "reqHead":
              return (
                <Display size="sm" style={{ paddingHorizontal: GUTTER, paddingTop: space[6], paddingBottom: space[2] }}>
                  {t("mobileSocial.inv.requests")}
                </Display>
              );
            case "req":
              return <RequestRow r={item.r} fundName={names[item.r.fundId]} onCancel={cancel} />;
          }
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={tab === "funds" ? <Explain /> : null}
        contentContainerStyle={{ paddingBottom: bottom + space[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />}
      />
      <StopLossSheet ref={slSheet} inv={slInv} />
      <CancelRequestSheet ref={cancelSheet} req={cancelReq} />
    </Screen>
  );
}

const itemKey = (i: Item, n: number) => (i.k === "fund" ? `f${i.f.id}` : i.k === "holding" ? `h${i.inv.fundId}` : i.k === "req" ? `r${i.r.id}` : `${i.k}${n}`);

function MineSummary({ holdings, pending }: { holdings: InvestmentView[]; pending: number }) {
  const t = useT();
  const value = holdings.reduce((s, i) => s + i.value, 0);
  const invested = holdings.reduce((s, i) => s + i.netInvested, 0);
  const pnl = holdings.reduce((s, i) => s + i.pnl, 0);
  const fees = holdings.reduce((s, i) => s + i.feesPaid, 0);
  return (
    <Card>
      <Text variant="label" tone="tertiary">
        {t("mobileSocial.inv.value")}
      </Text>
      <Mono size={40} weight="bold" style={{ letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
        {usd(value)}
      </Mono>
      <Text variant="callout" weight="700" tone={shownTone(pnl)} style={{ marginBottom: space[4] }}>
        {`${usd(pnl, 2, true)} · ${invested > 0 ? pct((pnl / invested) * 100) : "—"}`}
      </Text>
      <StatGrid
        columns={3}
        items={[
          { label: t("mobileSocial.inv.netInvested"), value: usd(invested) },
          { label: t("mobileSocial.inv.feesPaid"), value: usd(fees) },
          { label: t("mobileSocial.inv.pendingShort"), value: String(pending), tone: pending ? "gold" : undefined },
        ]}
      />
    </Card>
  );
}

function Explain() {
  const t = useT();
  const rows = [
    { icon: <Coins size={18} color={colors.gold} />, t: t("mobileSocial.pamm.explain.navT"), s: t("mobileSocial.pamm.explain.navS") },
    { icon: <CalendarClock size={18} color={colors.gold} />, t: t("mobileSocial.pamm.explain.queueT"), s: t("mobileSocial.pamm.explain.queueS") },
    { icon: <TrendingUp size={18} color={colors.gold} />, t: t("mobileSocial.pamm.explain.hwmT"), s: t("mobileSocial.pamm.explain.hwmS") },
    { icon: <ShieldAlert size={18} color={colors.gold} />, t: t("mobileSocial.pamm.explain.slT"), s: t("mobileSocial.pamm.explain.slS") },
    { icon: <Snowflake size={18} color={colors.gold} />, t: t("mobileSocial.pamm.explain.freezeT"), s: t("mobileSocial.pamm.explain.freezeS") },
  ];
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[6], gap: space[4] }}>
      {rows.map((r) => (
        <View key={r.t} style={{ flexDirection: "row", gap: space[3] }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: alpha(colors.gold, 0.12), alignItems: "center", justifyContent: "center" }}>{r.icon}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" weight="700">
              {r.t}
            </Text>
            <Text variant="caption" tone="tertiary" style={{ lineHeight: 17 }}>
              {r.s}
            </Text>
          </View>
        </View>
      ))}
      <Note style={{ marginTop: space[2] }}>{t("mobileSocial.pamm.disclaimer")}</Note>
    </View>
  );
}
